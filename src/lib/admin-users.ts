import type {PoolClient} from "pg";

export type AdminAccountChange={role?:string;active?:boolean;disabledReason?:string|null};
type UpdateFailure={ok:false;status:number;message:string};
type UpdateSuccess={ok:true;user:{id:string;email:string;name:string;role:string;active:boolean}};
export type AdminAccountOutcome=UpdateFailure|UpdateSuccess;

/**
 * All PATCH operations acquire the same active-admin row locks, in stable order.
 * READ COMMITTED rechecks rows after waiting for another update. This prevents
 * two concurrent admins from both demoting the last remaining administrator.
 */
export async function updateAdminAccount(client:PoolClient,actorId:string,targetId:string,body:AdminAccountChange):Promise<AdminAccountOutcome>{
  await client.query("BEGIN");
  try{
    const activeAdmins=await client.query<{id:string}>(`
      SELECT id FROM users
      WHERE role='admin' AND active=TRUE AND deleted_at IS NULL
      ORDER BY id FOR UPDATE
    `);
    if(!activeAdmins.rows.some(a=>a.id===actorId)){
      await client.query("ROLLBACK");
      return{ok:false,status:403,message:"Administrator access is no longer active."};
    }
    const current=await client.query<{role:string;active:boolean}>(
      "SELECT role,active FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",[targetId]);
    if(!current.rowCount){
      await client.query("ROLLBACK");
      return{ok:false,status:404,message:"User not found"};
    }
    const user=current.rows[0];
    const nextRole=body.role===undefined?user.role:body.role;
    const nextActive=body.active===undefined?user.active:body.active;
    if(actorId===targetId&&(nextRole!=="admin"||!nextActive)){
      await client.query("ROLLBACK");
      return{ok:false,status:400,message:"You cannot disable or demote your own administrator account."};
    }
    if(user.role==="admin"&&user.active&&(nextRole!=="admin"||!nextActive)&&activeAdmins.rows.length<=1){
      await client.query("ROLLBACK");
      return{ok:false,status:400,message:"At least one active administrator must remain."};
    }

    const sets:string[]=[];const params:unknown[]=[];
    const metadata:Record<string,unknown>={};
    if(body.role!==undefined){
      params.push(body.role);sets.push("role=$"+params.length);metadata.role=body.role;
    }
    if(body.active!==undefined){
      params.push(body.active);sets.push("active=$"+params.length);metadata.active=body.active;
      if(body.active)sets.push("disabled_reason=NULL");
    }
    if(body.disabledReason!==undefined&&body.active!==true){
      const reason=body.disabledReason?.trim().slice(0,500)||null;
      params.push(reason);sets.push("disabled_reason=$"+params.length);metadata.disabledReason=reason;
    }
    if(!sets.length){
      await client.query("ROLLBACK");
      return{ok:false,status:400,message:"Nothing to update."};
    }
    params.push(targetId);
    const updated=await client.query<UpdateSuccess["user"]>(
      "UPDATE users SET "+sets.join(",")+" WHERE id=$"+params.length+
      " AND deleted_at IS NULL RETURNING id,email,name,role,active,last_login_at,disabled_reason",
      params);
    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'account_update','user',$2,$3)",
      [actorId,targetId,JSON.stringify(metadata)]
    );
    await client.query("COMMIT");
    return{ok:true,user:updated.rows[0]};
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    throw e;
  }
}
