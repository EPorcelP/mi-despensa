import { z } from 'zod';
import { sameOrigin } from '../../../../lib/origin';
export const runtime = 'nodejs';

const schema = z.object({
  access_token: z.string().min(20).max(8192),
  password: z.string().min(12).max(128)
}).strict();

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Petición no permitida' }, { status: 403 });
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!base || !key) return Response.json({ error: 'Configuración incompleta' }, { status: 503 });
  try {
    const raw = await request.text();
    if (raw.length > 10000) return Response.json({ error: 'Solicitud inválida' }, { status: 400 });
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) return Response.json({ error: 'Enlace o contraseña no válidos' }, { status: 400 });
    const headers = { apikey: key, Authorization: `Bearer ${parsed.data.access_token}`, 'Content-Type': 'application/json' };
    const who = await fetch(new URL('/auth/v1/user', base), {
      headers, cache: 'no-store', signal: AbortSignal.timeout(15000)
    });
    if (!who.ok) return Response.json({ error: 'El enlace ha caducado. Solicita otro.' }, { status: 401 });
    const changed = await fetch(new URL('/auth/v1/user', base), {
      method: 'PUT', headers, body: JSON.stringify({ password: parsed.data.password }),
      cache: 'no-store', signal: AbortSignal.timeout(15000)
    });
    if (!changed.ok) return Response.json({ error: 'No se pudo actualizar la contraseña. Solicita otro enlace.' }, { status: 400 });
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'No se pudo completar la recuperación' }, { status: 503 }); }
}
