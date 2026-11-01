 'use client';
import { useState } from 'react';
import Link from 'next/link';
export default function AdminLogin(){
  const [email,setEmail] = useState(''); const [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  return <main className="login-page"><section className="login-card"><div className="brand">Mi Despensa · Administración</div><h1>Acceso de administración</h1><p>Utiliza el correo y la contraseña de tu cuenta administradora de Supabase.</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try {const res=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const data=await res.json();if(!res.ok)throw new Error(data.error||'No se pudo acceder');location.assign('/admin');}catch(err){setError(err instanceof Error?err.message:'No se pudo acceder');setBusy(false);}}}><label className="field">Correo<input autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="field">Contraseña<input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="error" role="alert">{error}</div>}<button className="primary" disabled={busy}>{busy?'Accediendo…':'Entrar en administración'}</button></form><p style={{marginTop:20}}><Link href="/">Volver a Mi Despensa</Link></p></section></main>;
}
