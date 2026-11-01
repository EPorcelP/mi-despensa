import { cookies } from 'next/headers';
import { z } from 'zod';
import { sameOrigin } from '../../../../lib/origin';
import { adminCookieOptions, ADMIN_COOKIE, adminProfile, createAdminTicket, supabaseAdminFetch } from '../../../../lib/admin-access';
import { createHmac } from 'node:crypto';
import { rpc } from '../../../../lib/database';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error:'Petición no permitida'}, {status:403});
  try {
    const raw = await request.text();
    if (raw.length > 1800) return Response.json({error:'Datos incorrectos'}, {status:400});
    const parsed = z.object({email:z.string().email().max(254), password:z.string().min(1).max(300)}).safeParse(JSON.parse(raw));
    if (!parsed.success) return Response.json({error:'Revisa el correo y la contraseña'}, {status:400});
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) throw new Error('Falta SESSION_SECRET');
    const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
    const hash = createHmac('sha256', secret).update('admin:'+ip).digest('hex');
    const allowed = await rpc<boolean>('mdespensa_login_attempt', {p_key_hash:hash});
    if (!allowed) return Response.json({error:'Demasiados intentos. Prueba más tarde.'}, {status:429});
    const key = process.env.SUPABASE_ANON_KEY;
    const base = process.env.SUPABASE_URL;
    if (!key || !base) throw new Error('Falta SUPABASE_ANON_KEY');
    const url = new URL('/auth/v1/token?grant_type=password', base);
    const auth = await fetch(url, { method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(parsed.data), cache:'no-store',signal:AbortSignal.timeout(15000) });
    if (!auth.ok) return Response.json({error:'Credenciales incorrectas o acceso no autorizado'}, {status:401});
    const session = await auth.json() as {user?:{id?:string}};
    const id = session.user?.id;
    if (!id || !await adminProfile(id)) return Response.json({error:'Acceso no autorizado'}, {status:403});
    (await cookies()).set(ADMIN_COOKIE,createAdminTicket(id),adminCookieOptions());
    return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({error:'No se pudo iniciar sesión en administración'}, {status:503});}
}
