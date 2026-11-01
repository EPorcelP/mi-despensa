import { z } from 'zod';
import { sameOrigin } from '../../../../lib/origin';
import { createHmac } from 'node:crypto';
import { rpc } from '../../../../lib/database';

export const runtime = 'nodejs';
const schema = z.object({ email: z.string().email().max(254) }).strict();

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Petición no permitida' }, { status: 403 });
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const secret = process.env.SESSION_SECRET;
  if (!base || !key || !secret || secret.length < 32) return Response.json({ error: 'Configuración incompleta' }, { status: 503 });
  try {
    const raw = await request.text();
    if (raw.length > 1000) return Response.json({ error: 'Solicitud inválida' }, { status: 400 });
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) return Response.json({ error: 'Introduce un correo válido' }, { status: 400 });
    const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
    const hash = createHmac('sha256', secret).update('recover:' + ip).digest('hex');
    const allowed = await rpc<boolean>('mdespensa_login_attempt', { p_key_hash: hash });
    if (!allowed) return Response.json({ error: 'Demasiadas solicitudes. Inténtalo más tarde.' }, { status: 429 });
    // Dirección de retorno fija: no se acepta una URL enviada por el navegador.
    const site = process.env.MIDESPENSA_SITE_URL || 'https://midespensa.evaporcel.com';
    const callback = new URL('/admin/restablecer', site);
    if (callback.protocol !== 'https:' && callback.hostname !== 'localhost') throw new Error('URL de retorno inválida');
    const recoverUrl = new URL('/auth/v1/recover', base);
    recoverUrl.searchParams.set('redirect_to', callback.toString());
    await fetch(recoverUrl, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: parsed.data.email }),
      cache: 'no-store', signal: AbortSignal.timeout(15000)
    });
    // No revelar si la cuenta existe; la política de correo es de Supabase.
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'No se pudo solicitar la recuperación. Inténtalo más tarde.' }, { status: 503 });
  }
}
