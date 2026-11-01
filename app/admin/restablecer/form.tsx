'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';

export default function RecoveryForm() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase estándar redirige con #access_token=...&type=recovery.
    // El fragmento no viaja al servidor; retirarlo inmediatamente de la URL.
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const value = fragment.get('access_token') || '';
    const type = fragment.get('type');
    window.history.replaceState(null, '', '/admin/restablecer');
    if (type === 'recovery' && value.length >= 20) setToken(value);
    else setError('El enlace no contiene una sesión de recuperación válida. Solicita un correo nuevo.');
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('');
    if (!token) return setError('Solicita un nuevo enlace de recuperación.');
    if (password.length < 12 || password.length > 128) return setError('Usa entre 12 y 128 caracteres.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      const response = await fetch('/api/admin/restablecer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token, password }), cache: 'no-store'
      });
      const data = await response.json() as { error?: string; ok?: boolean };
      if (!response.ok) throw new Error(data.error || 'No se pudo actualizar la contraseña');
      setToken(''); setPassword(''); setConfirm(''); setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al cambiar la contraseña'); }
    finally { setBusy(false); }
  }

  return <main className="login-page"><section className="login-card">
    <div className="brand">Mi Despensa · Administración</div>
    <h1>Restablecer contraseña</h1>
    {done ? <><p>Contraseña actualizada. Ya puedes iniciar sesión.</p><p><Link href="/admin/login">Ir a administración</Link></p></> : <>
      <p>Establece tu nueva contraseña.</p>
      <form onSubmit={submit}>
        <label className="field">Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label className="field">Repetir contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary" type="submit" disabled={busy || !token}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
      </form>
    </>}
    <p style={{ marginTop: 20 }}><Link href="/admin/login">Volver al acceso</Link></p>
  </section></main>;
}
