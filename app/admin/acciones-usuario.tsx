'use client';
import { useState } from 'react';
export default function AccionesUsuario({id,name,disabled,isAdmin}:{id:string;name:string;disabled:boolean;isAdmin:boolean}){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const [password,setPassword]=useState('');
 async function perform(action:'disable'|'enable'|'password'|'recovery'){
  if(action==='disable'&&!window.confirm(`¿Desactivar la cuenta de ${name}? No podrá acceder a sus despensas.`))return;
  if(action==='password'&&!window.confirm(`¿Establecer una contraseña nueva para ${name}?`))return;
  if(action==='recovery'&&!window.confirm(`¿Enviar un correo de recuperación a ${name}?`))return;
  setBusy(true);setMessage('');
  try{const res=await fetch('/api/admin/usuario',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,userId:id,...(action==='password'?{password}:{})})});
   const json=await res.json() as {ok?:boolean;error?:string};if(!res.ok){setMessage(json.error||'Operación fallida');return;}
   setPassword('');setMessage(action==='recovery'?'Solicitud aceptada por Supabase (comprueba el correo).':'Operación completada');
   if(action==='disable'||action==='enable')window.location.reload();
  }catch{setMessage('Error de red: comprueba el estado antes de repetir.');}finally{setBusy(false);}
 }
 if(isAdmin)return <p style={{fontSize:12}}>Cuenta administradora protegida.</p>;
 return <details style={{marginTop:12}}><summary style={{cursor:'pointer',fontWeight:600}}>Gestionar cuenta</summary>
 <div style={{display:'grid',gap:10,marginTop:12}}>
 <button type="button" disabled={busy} onClick={()=>perform(disabled?'enable':'disable')}>{disabled?'Reactivar cuenta':'Desactivar cuenta'}</button>
 <button type="button" disabled={busy||disabled} onClick={()=>perform('recovery')}>Enviar recuperación por correo</button>
 <label style={{fontSize:12}}>Nueva contraseña temporal<input type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} disabled={busy||disabled} onChange={e=>setPassword(e.target.value)}/></label>
 <button type="button" disabled={busy||disabled||password.length<12} onClick={()=>perform('password')}>Establecer contraseña</button>
 {message&&<p role="status" style={{fontSize:12}}>{message}</p>}
 </div></details>;
}
