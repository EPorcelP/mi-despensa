import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';

export const ADMIN_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-md_admin' : 'md_admin';
const MAX_AGE = 60 * 60 * 8;
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET no está configurado');
  return createHmac('sha256', value).update('MiDespensa/admin/v1').digest();
}
function sign(part: string) { return createHmac('sha256', secret()).update(part).digest('base64url'); }
export function createAdminTicket(userId: string, version: number) {
  const data = Buffer.from(JSON.stringify({ uid: userId, ver: version, exp: Math.floor(Date.now()/1000)+MAX_AGE })).toString('base64url');
  return `${data}.${sign(data)}`;
}
export function adminCookieOptions() {
  return { httpOnly: true as const, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: MAX_AGE };
}
export async function supabaseAdminFetch(path: string, options: RequestInit = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Falta configuración de Supabase');
  const base = new URL(url);
  if (base.protocol !== 'https:') throw new Error('Supabase debe usar HTTPS');
  const headers = new Headers(options.headers);
  headers.set('apikey', key);
  if (!key.startsWith('sb_secret_')) headers.set('Authorization', `Bearer ${key}`);
  return fetch(new URL(path, base), { ...options, headers, cache: 'no-store', signal: AbortSignal.timeout(15000) });
}
export async function adminProfile(id: string): Promise<{user_id:string; role:string; disabled_at:string|null;session_version:number}|null> {
  const q = new URLSearchParams({ user_id: `eq.${id}`, select: 'user_id,role,disabled_at,session_version', limit: '1' });
  const res = await supabaseAdminFetch(`/rest/v1/mdespensa_profiles?${q}`);
  if (!res.ok) throw new Error('No se puede consultar el perfil');
  const rows = await res.json() as {user_id:string;role:string;disabled_at:string|null;session_version:number}[];
  const profile = rows[0];
  return profile?.role === 'admin' && profile.disabled_at === null ? profile : null;
}
export async function getAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || token.length > 2000) return null;
  try {
    const [payload, signature, ...extra] = token.split('.');
    if (extra.length || !payload || !signature) return null;
    const expected = Buffer.from(sign(payload), 'base64url');
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { uid?:unknown; exp?:unknown; ver?:unknown };
    if (!Number.isSafeInteger(data.ver) || (data.ver as number) < 0) return null;
    if (typeof data.uid !== 'string' || !/^[0-9a-f-]{36}$/i.test(data.uid) || typeof data.exp !== 'number' || data.exp <= Date.now()/1000) return null;
    // La sesión de administración solo es válida para el usuario personal actual.
    const { getUser } = await import('./user-access');
    const currentUser = await getUser();
    if (!currentUser || currentUser.id !== data.uid) return null;
    const profile = await adminProfile(data.uid);
    return profile && profile.session_version === data.ver ? profile : null;
  } catch { return null; }
}
export async function requireAdmin() { const admin = await getAdmin(); if (!admin) redirect('/admin/login'); return admin; }
