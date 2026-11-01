import { cookies } from 'next/headers';
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { sameOrigin } from '../../../../lib/origin';
import { rpc } from '../../../../lib/database';
import { createUserTicket,USER_COOKIE,userCookieOptions } from '../../../../lib/user-access';
import { supabaseAdminFetch } from '../../../../lib/admin-access';
export const runtime='nodejs';
const json=(body:object,status:number)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'Petición no permitida'},403);
 try {
  const raw=await request.text();if(raw.length>1600)return json({error:'Datos demasiado largos'},400);
  const parsed=z.object({email:z.string().email().max(254),password:z.string().min(1).max(300)}).safeParse(JSON.parse(raw));
  if(!parsed.success)return json({error:'Introduce correo y contraseña'},400);
  const secret=process.env.SESSION_SECRET;
  if(!secret||secret.length<32)throw new Error('Configuración incorrecta');
  const ip=request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'local';
  const hash=createHmac('sha256',secret).update('user:'+ip).digest('hex');
  if(!await rpc<boolean>('mdespensa_login_attempt',{p_key_hash:hash}))return json({error:'Demasiados intentos. Prueba más tarde.'},429);
  const base=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;
  if(!base||!anon)throw new Error('Faltan variables Supabase');
  const response=await fetch(new URL('/auth/v1/token?grant_type=password',base),{method:'POST',headers:{'apikey':anon,'Content-Type':'application/json'},body:JSON.stringify(parsed.data),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)return json({error:'Correo o contraseña incorrectos'},401);
  const data=await response.json() as {user?:{id?:string}};
  const id=data.user?.id;
  if(!id||!/^[a-f0-9-]{36}$/i.test(id))return json({error:'Cuenta no válida'},403);
  const profile=await supabaseAdminFetch('/rest/v1/mdespensa_profiles?user_id=eq.'+encodeURIComponent(id)+'&select=user_id,disabled_at&limit=1');
  if(!profile.ok)throw new Error('No se pudo verificar el perfil');
  const rows=await profile.json() as {user_id:string;disabled_at:string|null}[];
  if(rows[0]?.user_id!==id||rows[0]?.disabled_at!==null)return json({error:'Cuenta no autorizada o desactivada'},403);
  const link=await supabaseAdminFetch('/rest/v1/mdespensa_user_pantries?owner_user_id=eq.'+encodeURIComponent(id)+'&select=household&limit=1');
  if(!link.ok)throw new Error('No se pudo verificar la despensa');
  const pantries=await link.json() as {household:string}[];
  if(!pantries[0]?.household)return json({error:'Cuenta sin despensa asignada'},403);
  (await cookies()).set(USER_COOKIE,createUserTicket(id),userCookieOptions());
  return json({ok:true},200);
 }catch{return json({error:'No se pudo iniciar sesión. Inténtalo de nuevo.'},503);}
}
