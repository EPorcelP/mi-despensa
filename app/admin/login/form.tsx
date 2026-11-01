'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(recovery ? '/api/admin/solicitar-recuperacion' : '/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recovery ? { email } : { email, password })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud');
      if (recovery) setSent(true);
      else window.location.assign('/admin');
    } catch (err) { setError(err instanceof Error ? err.message : 'Error de conexión'); }
    finally { setBusy(false); }
  }
  return <main className="login-page"><section className="login-card">
    <div className="brand">Mi Despensa · Administración</div>
    <h1>{recovery ? 'Recuperar contraseña' : 'Acceso de administración'}</h1>
    {sent ? <p>Si existe una cuenta con ese correo, recibirás un enlace. Revisa también la carpeta de spam.</p> : <>
      <p>{recovery ? 'Introduce el correo de tu cuenta para recibir un enlace.' : 'Utiliza tu cuenta de Supabase Auth.'}</p>
      <form onSubmit={submit}>
        <label className="field">Correo<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        {!recovery && <label className="field">Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>}
        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary" disabled={busy}>{busy ? 'Procesando…' : recovery ? 'Enviar enlace' : 'Entrar en administración'}</button>
      </form>
    </>}
    <p style={{ marginTop: 20 }}><button type="button" onClick={() => { setRecovery(!recovery); setSent(false); setError(''); }}>
      {recovery ? 'Volver al acceso' : '¿Has olvidado tu contraseña?'}</button></p>
    <p><Link href="/">Volver a Mi Despensa</Link></p>
  </section></main>;
}
