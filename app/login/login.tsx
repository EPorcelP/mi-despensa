 'use client';
import { useState } from 'react';
import { Leaf,LockKeyhole } from 'lucide-react';
export default function Login(){
  const [password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  return <main className="login-page"><section className="login-card"><div className="brand"><span className="brand-icon"><Leaf size={22}/></span>mi despensa<span className="brand-dot">.</span></div><h1>Tu casa,<br/><em>tu despensa.</em></h1><p>Introduce tu contraseña para ver lo que tienes y preparar tu próxima compra.</p><form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const data=await response.json();if(!response.ok)throw new Error(data.error);window.location.assign('/');}catch(e){setError(e instanceof Error?e.message:'No se pudo entrar.');setBusy(false);}}}><label className="field">Contraseña<input autoFocus type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} maxLength={200}/></label>{error&&<div className="error" role="alert">{error}</div>}<button className="primary" disabled={busy}><LockKeyhole size={17}/>{busy?'Entrando…':'Entrar en mi despensa'}</button></form></section></main>;
}
