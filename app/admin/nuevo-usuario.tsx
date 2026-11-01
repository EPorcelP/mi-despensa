'use client';
import { useState } from 'react';

export default function NuevoUsuario() {
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [status,setStatus]=useState('');
  const [loading,setLoading]=useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);setStatus('');
    try {
      const response=await fetch('/api/admin/usuarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password})});
      const result=await response.json() as {ok?:boolean;error?:string};
      if (!response.ok) {setStatus(result.error || 'No se pudo crear el usuario');return;}
      setStatus('Cuenta creada. El acceso individual se activará en el siguiente bloque.');
      setName('');setEmail('');setPassword('');
      window.location.reload();
    } catch {setStatus('Error de red. Comprueba el resultado antes de repetir el alta.');}
    finally {setLoading(false);}
  }
  return <details style={{marginBottom:20}}><summary style={{cursor:'pointer',fontWeight:700}}>Crear usuario</summary>
    <form onSubmit={submit} style={{display:'grid',gap:12,maxWidth:450,paddingTop:14}}>
      <label>Nombre<input required maxLength={100} minLength={2} value={name} onChange={e=>setName(e.target.value)} autoComplete="off"/></label>
      <label>Correo<input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="off"/></label>
      <label>Contraseña inicial<input required type="password" minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
      <p style={{fontSize:12}}>Cada usuario tendrá una despensa Casa vacía. Su acceso a la aplicación se habilitará cuando terminemos el login individual.</p>
      <button type="submit" disabled={loading}>{loading?'Creando…':'Crear usuario'}</button>
      {status && <p role="status">{status}</p>}
    </form>
  </details>;
}
