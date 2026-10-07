import {NextResponse} from "next/server";
import {getSession,isStaff} from "@/lib/auth";
import {error} from "@/lib/http";
import {pool} from "@/lib/db";
import {isCatchmentLevel} from "@/lib/catchments";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!isStaff(session))return error("Staff access required",403,"FORBIDDEN");
  const{id}=await context.params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return error("Invalid catchment ID.");

  const body=await request.json().catch(()=>null) as {
    verified?:boolean;name?:string;level?:string;parentId?:string|null;method?:string|null;notes?:string|null;
  }|null;
  if(!body)return error("Invalid request body.");

  const sets:string[]=[];
  const params:unknown[]=[];
  const metadata:Record<string,unknown>={};

  if(body.verified!==undefined){
    params.push(Boolean(body.verified));sets.push("verified=$"+params.length);
    if(body.verified){
      params.push(session.sub);sets.push("verified_at=now()","verified_by=$"+params.length);
    }else{
      sets.push("verified_at=NULL","verified_by=NULL");
    }
    metadata.verified=Boolean(body.verified);
  }

  if(body.name!==undefined){
    const name=String(body.name).trim().slice(0,220);
    if(!name)return error("Catchment name cannot be empty.");
    params.push(name);sets.push("name=$"+params.length);metadata.name=name;
  }

  if(body.level!==undefined){
    const level=String(body.level).trim().toLowerCase();
    if(!isCatchmentLevel(level))return error("Invalid catchment level.");
    params.push(level);sets.push("catchment_level=$"+params.length);metadata.level=level;
  }

  if(body.parentId!==undefined){
    const parentId=body.parentId==null||body.parentId===""?null:String(body.parentId);
    if(parentId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parentId))return error("Invalid parent catchment ID.");
    if(parentId===id)return error("A catchment cannot be its own parent.");
    params.push(parentId);sets.push("parent_id=$"+params.length);metadata.parentId=parentId;
  }

  if(body.method!==undefined){
    params.push(body.method==null?null:String(body.method).trim().slice(0,300)||null);
    sets.push("method=$"+params.length);
  }

  if(body.notes!==undefined){
    params.push(body.notes==null?null:String(body.notes).trim().slice(0,3000)||null);
    sets.push("notes=$"+params.length);
  }

  if(!sets.length)return error("Nothing to update.");

  const client=await pool().connect();
  try{
    await client.query("BEGIN");

    if(body.parentId){
      const parent=await client.query(
        "SELECT id FROM catchments WHERE id=$1 AND id<>$2",
        [body.parentId,id]
      );
      if(!parent.rowCount){
        await client.query("ROLLBACK");
        return error("Parent catchment not found.",400);
      }
    }

    params.push(session.sub);sets.push("updated_by=$"+params.length);
    params.push(id);
    const result=await client.query(
      "UPDATE catchments SET "+sets.join(",")+" WHERE id=$"+params.length+" RETURNING id,name,catchment_level,parent_id,verified,verified_at",
      params
    );
    if(!result.rowCount){
      await client.query("ROLLBACK");
      return error("Catchment not found.",404);
    }

    await client.query(
      "INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'catchment_update','catchment',$2,$3)",
      [session.sub,id,JSON.stringify(metadata)]
    );
    await client.query("COMMIT");
    return NextResponse.json({data:result.rows[0]});
  }catch(e){
    await client.query("ROLLBACK").catch(()=>{});
    return error(e instanceof Error?e.message:"Catchment update failed.",400);
  }finally{
    client.release();
  }
}
