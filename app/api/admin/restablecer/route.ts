import { z } from 'zod';
import { sameOrigin } from '../../../../lib/origin';
import { supabaseAdminFetch } from '../../../../lib/admin-access';
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
    const recoveredUser = await who.json() as { id?:string };
    if(!recoveredUser.id || !/^[a-f0-9-]{36}$/i.test(recoveredUser.id)) return Response.json({error:'Cuenta no válida'}, {status:401});
    const changed = await fetch(new URL('/auth/v1/user', base), {
      method: 'PUT', headers, body: JSON.stringify({ password: parsed.data.password }),
      cache: 'no-store', signal: AbortSignal.timeout(15000)
    });
    if (!changed.ok) return Response.json({ error: 'No se pudo actualizar la contraseña. Solicita otro enlace.' }, { status: 400 });
    // Invalidar cookies propias de MiDespensa tras el cambio.
    const profiles = await supabaseAdminFetch('/rest/v1/mdespensa_profiles?user_id=eq.'+encodeURIComponent(recoveredUser.id)+'&select=session_version&limit=1');
    if(!profiles.ok) throw new Error('Perfil inaccesible');
    const records = await profiles.json() as {session_version:number}[];
    if(records.length!==1) throw new Error('Perfil ausente');
    const ver=records[0].session_version;
    const rev=await supabaseAdminFetch('/rest/v1/mdespensa_profiles?user_id=eq.'+encodeURIComponent(recoveredUser.id)+'&session_version=eq.'+ver,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({session_version:ver+1})});
    if(!rev.ok || (await rev.json() as unknown[]).length!==1){console.error('CRÍTICO: recuperación cambiada sin revocación completa');return Response.json({error:'Contraseña actualizada, pero las sesiones anteriores requieren revisión. Contacta con administración.'},{status:503});}
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'No se pudo completar la recuperación' }, { status: 503 }); }
}
