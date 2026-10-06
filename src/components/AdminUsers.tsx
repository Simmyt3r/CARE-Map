"use client";
import Link from "next/link";
import {useEffect,useState} from "react";

export default function AdminUsers(){
  const[rows,setRows]=useState<any[]>([]);
  const[form,setForm]=useState({name:"",email:"",password:"",role:"staff"});
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  async function load(){
    const r=await fetch("/api/admin/users");
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return setMessage(j.error?.message||"Users could not be loaded.");
    setRows(j.data||[]);
  }

  useEffect(()=>{load();},[]);

  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    const r=await fetch("/api/admin/users",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(form)});
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Could not create user.");
    setForm({name:"",email:"",password:"",role:"staff"});
    setMessage("User created.");load();
  }

  async function updateUser(id:string,patch:Record<string,unknown>){
    setBusy(true);setMessage("");
    const r=await fetch("/api/admin/users/"+id,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(patch)});
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok)return setMessage(j.error?.message||"Account update failed.");
    setMessage("Account updated.");load();
  }

  return <div className="stack">
    <div className="grid two">
      <form className="card stack" onSubmit={submit}>
        <div><h2>Create user</h2><div className="muted">Create staff, administrators or registered community accounts.</div></div>
        {(["name","email","password"]as const).map(k=><div className="field" key={k}><label>{k[0].toUpperCase()+k.slice(1)}</label><input type={k==="password"?"password":k==="email"?"email":"text"} required minLength={k==="password"?12:undefined} value={form[k]} onChange={e=>setForm(x=>({...x,[k]:e.target.value}))}/></div>)}
        <div className="field"><label>Role</label><select value={form.role} onChange={e=>setForm(x=>({...x,role:e.target.value}))}><option value="staff">Staff</option><option value="admin">Administrator</option><option value="registered_community">Community</option></select></div>
        <button className="btn primary" disabled={busy}>Create user</button>
      </form>

      <div className="card">
        <h2>Account policy</h2>
        <div className="stack">
          <div className="notice">Inactive accounts cannot sign in. CARE-Map prevents the last active administrator from being disabled or demoted.</div>
          <div className="notice">Role and activation changes are written to the audit log.</div>
          <Link className="btn" href="/staff/admin/governance">Open Governance & Audit</Link>
        </div>
      </div>
    </div>

    {message&&<div className="notice">{message}</div>}

    <div className="card">
      <div className="section-head"><div><h2>Users</h2><div className="muted">Manage access without deleting historical attribution.</div></div><span className="badge">{rows.length}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last login</th><th>Created</th><th>Controls</th></tr></thead>
        <tbody>{rows.map(r=><tr key={r.id}>
          <td><strong>{r.name}</strong><div className="muted">{r.email}</div>{r.disabled_reason&&<small className="overdue-text">{r.disabled_reason}</small>}</td>
          <td><select value={r.role} disabled={busy} onChange={e=>updateUser(r.id,{role:e.target.value})}><option value="registered_community">Community</option><option value="staff">Staff</option><option value="admin">Administrator</option></select></td>
          <td><span className={"priority-badge "+(r.active?"priority-low":"priority-critical")}>{r.active?"Active":"Inactive"}</span></td>
          <td>{r.last_login_at?new Date(r.last_login_at).toLocaleString():"Never"}</td>
          <td>{new Date(r.created_at).toLocaleDateString()}</td>
          <td>{r.active
            ?<button className="btn danger" disabled={busy} onClick={()=>updateUser(r.id,{active:false,disabledReason:"Disabled by administrator"})}>Deactivate</button>
            :<button className="btn primary" disabled={busy} onClick={()=>updateUser(r.id,{active:true})}>Reactivate</button>}
          </td>
        </tr>)}</tbody>
      </table></div>
    </div>
  </div>;
}
