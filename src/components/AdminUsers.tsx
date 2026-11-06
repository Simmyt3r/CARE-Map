"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {
 WORKSPACES,WORKSPACE_PRESETS,DEFAULT_STAFF_WORKSPACES,type WorkspaceId
} from "@/lib/workspaces";

type UserRow={
 id:string;name:string;email:string;role:"admin"|"staff"|"registered_community";
 active:boolean;created_at:string;last_login_at:string|null;disabled_reason:string|null;
 workspace_access:WorkspaceId[];
};
type CreateRole=UserRow["role"];
type CreateForm={
 name:string;email:string;password:string;role:CreateRole;workspaceAccess:WorkspaceId[];
};
const blank=():CreateForm=>({
 name:"",email:"",password:"",role:"staff",
 workspaceAccess:[...DEFAULT_STAFF_WORKSPACES]
});
function AccessPicker({value,onChange,disabled=false}:{
 value:WorkspaceId[];onChange:(value:WorkspaceId[])=>void;disabled?:boolean;
}){
 const toggle=(id:WorkspaceId,checked:boolean)=>{
  onChange(checked?[...new Set([...value,id])]:value.filter(x=>x!==id));
 };
 return <div className="stack">
  <div className="field">
   <label htmlFor={"workspace-preset-"+(disabled?"disabled":"editor")}>Workspace role preset</label>
   <select id={"workspace-preset-"+(disabled?"disabled":"editor")} disabled={disabled} value="custom"
    onChange={e=>{
     const preset=WORKSPACE_PRESETS.find(x=>x.id===e.target.value);
     if(preset&&preset.modules.length)onChange([...preset.modules] as WorkspaceId[]);
    }}>
    <option value="custom">Select a preset or customize below</option>
    {WORKSPACE_PRESETS.filter(x=>x.id!=="custom").map(x=>
     <option key={x.id} value={x.id}>{x.title}</option>)}
   </select>
  </div>
  <div className="workspace-permission-grid" role="group" aria-label="Assignable staff interfaces">
   {WORKSPACES.map(item=><label key={item.id} className="workspace-permission-option">
    <input type="checkbox" disabled={disabled}
     checked={value.includes(item.id)}
     onChange={e=>toggle(item.id,e.target.checked)}/>
    <span><strong>{item.title}</strong><small>{item.description}</small></span>
   </label>)}
  </div>
  <small className="muted">{value.length} interface(s) selected. Staff need at least one.</small>
 </div>;
}
export default function AdminUsers(){
 const[rows,setRows]=useState<UserRow[]>([]);
 const[form,setForm]=useState<CreateForm>(blank);
 const[message,setMessage]=useState("");
 const[busy,setBusy]=useState(false);
 const[schemaReady,setSchemaReady]=useState(false);
 const[editing,setEditing]=useState<string|null>(null);
 const[grants,setGrants]=useState<WorkspaceId[]>([]);
 const[loadError,setLoadError]=useState(false);
 const selected=rows.find(row=>row.id===editing);

 async function load(){
  try{
   const response=await fetch("/api/admin/users",{cache:"no-store"});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error?.message||"Unable to fetch accounts.");
   setRows(data.data||[]);
   setSchemaReady(Boolean(data.workspaceSchemaReady));
   setLoadError(false);
  }catch{
   setMessage("Could not load accounts. Check connection and migration status.");
   setLoadError(true);
  }
 }
 useEffect(()=>{void load();},[]);
 async function submit(event:React.FormEvent){
  event.preventDefault();
  if(busy)return;
  if(form.role==="staff"&&(!form.workspaceAccess.length||!schemaReady)){
   setMessage("Apply migration 022 and assign at least one staff interface.");
   return;
  }
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/admin/users",{
    method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(form)
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error?.message||"Unable to create account.");
   setForm(blank());setMessage("Account created with its assigned interface access.");
   await load();
  }catch(e){setMessage(e instanceof Error?e.message:"Could not create account.");}
  finally{setBusy(false);}
 }
 async function updateUser(id:string,patch:Record<string,unknown>){
  if(busy)return;
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/admin/users/"+id,{
    method:"PATCH",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error?.message||"Account update failed.");
   setMessage("Account updated.");
   setEditing(null);
   await load();
  }catch(e){setMessage(e instanceof Error?e.message:"Account update failed.");}
  finally{setBusy(false);}
 }
 async function saveAccess(){
  if(!editing||!schemaReady||busy||!grants.length)return;
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/admin/users/"+editing+"/workspaces",{
    method:"PATCH",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({workspaceAccess:grants})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error?.message||"Unable to update permissions.");
   setMessage("Workspace access updated. The change takes effect on the next request.");
   setEditing(null);
   await load();
  }catch(e){setMessage(e instanceof Error?e.message:"Workspace assignment failed.");}
  finally{setBusy(false);}
 }

 return <div className="stack">
  {!schemaReady&&!loadError&&<section className="notice" role="status">
   Workspace permissions require database migration 022.
   <Link href="/staff/admin/migrations"> Open the migration manager</Link> before assigning staff interfaces.
   Administrators still have full access.
  </section>}
  {message&&<div className="notice" role="status">{message}</div>}
  <div className="grid two">
   <form className="card stack" onSubmit={submit}>
    <div><h2>Create account</h2>
     <p className="muted">Choose the user's portal role and the staff interfaces they can access.</p></div>
    {(["name","email","password"] as const).map(key=><div className="field" key={key}>
     <label htmlFor={"new-"+key}>{key[0].toUpperCase()+key.slice(1)}</label>
     <input id={"new-"+key} type={key==="password"?"password":key==="email"?"email":"text"}
      autoComplete={key==="password"?"new-password":"off"}
      required minLength={key==="password"?12:undefined}
      value={form[key]} onChange={e=>setForm(current=>({...current,[key]:e.target.value}))}/>
    </div>)}
    <div className="field"><label htmlFor="new-account-role">Account role</label>
     <select id="new-account-role" value={form.role}
      onChange={e=>setForm(current=>({...current,role:e.target.value as CreateRole}))}>
      <option value="staff">Staff — assigned interfaces</option>
      <option value="admin">Administrator — all interfaces</option>
      <option value="registered_community">Community — public portal only</option>
     </select>
    </div>
    {form.role==="staff"&&<AccessPicker value={form.workspaceAccess} disabled={!schemaReady||busy}
      onChange={value=>setForm(current=>({...current,workspaceAccess:value}))}/>}
    {form.role==="admin"&&<p className="notice">Administrators automatically see every interface, including access management.</p>}
    <button type="submit" className="btn primary"
     disabled={busy||(form.role==="staff"&&(!schemaReady||!form.workspaceAccess.length))}>
     {busy?"Saving…":"Create user"}
    </button>
   </form>
   <aside className="card stack">
    <h2>How access works</h2>
    <p><strong>Administrator:</strong> all interfaces and all administrative settings.</p>
    <p><strong>Staff:</strong> only their assigned interfaces, with server-side route checks.</p>
    <p><strong>Community:</strong> public map, reporting and their own reports.</p>
    <p className="muted">A finance interface assignment does not replace the separate restricted community-fund duty approvals.</p>
    <p className="muted">Changes to staff access are recorded in the audit log.</p>
    <Link className="btn" href="/staff/admin/governance">Governance & audit</Link>
   </aside>
  </div>
  <section className="card stack">
   <div className="section-head">
    <div><h2>Users & interface access</h2>
     <p className="muted">Assign role-specific tools without deleting historical attribution.</p></div>
    <span className="badge">{rows.length} accounts</span>
   </div>
   <div className="table-wrap"><table>
    <thead><tr><th>User</th><th>Account role</th><th>Assigned interfaces</th><th>Status</th><th>Controls</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.id}>
     <td><strong>{row.name}</strong><div className="muted">{row.email}</div></td>
     <td><select value={row.role} disabled={busy}
      aria-label={"Account role for "+row.name}
      onChange={e=>void updateUser(row.id,{role:e.target.value})}>
      <option value="registered_community">Community</option>
      <option value="staff">Staff</option>
      <option value="admin">Administrator</option>
     </select></td>
     <td>{row.role==="admin"?<strong>Full access</strong>:
      row.role==="registered_community"?"Public portal":
      <div className="stack">
       <small>{(row.workspace_access||[]).length} interface(s)</small>
       <button type="button" className="btn" disabled={!schemaReady||busy}
        onClick={()=>{setEditing(row.id);setGrants([...(row.workspace_access||DEFAULT_STAFF_WORKSPACES)]);}}>
        Assign interfaces
       </button>
      </div>}</td>
     <td><span className={"priority-badge "+(row.active?"priority-low":"priority-critical")}>
      {row.active?"Active":"Inactive"}</span></td>
     <td>{row.active?
      <button type="button" className="btn danger" disabled={busy}
       onClick={()=>void updateUser(row.id,{active:false,disabledReason:"Disabled by administrator"})}>
       Deactivate</button>:
      <button type="button" className="btn primary" disabled={busy}
       onClick={()=>void updateUser(row.id,{active:true})}>Reactivate</button>}</td>
    </tr>)}</tbody>
   </table></div>
  </section>
  {selected?.role==="staff"&&schemaReady&&<section className="card stack">
   <div><h2>Assign interfaces — {selected.name}</h2>
    <p className="muted">Changes apply immediately and are enforced for both pages and APIs.</p></div>
   <AccessPicker value={grants} disabled={busy} onChange={setGrants}/>
   <div className="actions">
    <button type="button" className="btn primary" disabled={busy||!grants.length}
     onClick={()=>void saveAccess()}>{busy?"Saving…":"Save interface roles"}</button>
    <button type="button" className="btn" disabled={busy}
     onClick={()=>setEditing(null)}>Cancel</button>
   </div>
  </section>}
 </div>;
}
