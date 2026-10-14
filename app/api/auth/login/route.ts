import { cookies } from 'next/headers';
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { sameOrigin } from '../../../../lib/auth';
import { COOKIE_NAME,SESSION_SECONDS,createSession,validPassword } from '../../../../lib/session';
import { rpc } from '../../../../lib/database';
export const runtime='nodejs';
export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({error:'Petición no permitida.'},{status:403});
  try{
    const raw=await request.text();if(raw.length>1000)return Response.json({error:'Revisa la contraseña.'},{status:400});
    const input=z.object({password:z.string().min(1).max(200)}).safeParse(JSON.parse(raw));
    if(!input.success)return Response.json({error:'Escribe la contraseña.'},{status:400});
    const secret=process.env.SESSION_SECRET;if(!secret || secret.length<32)throw new Error('Configuration');
    const ip=request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
    const keyHash=createHmac('sha256',secret).update(ip).digest('hex');
    const allowed=await rpc<boolean>('mdespensa_login_attempt',{p_key_hash:keyHash});
    if(!allowed)return Response.json({error:'Demasiados intentos. Vuelve a probar en 15 minutos.'},{status:429});
    if(!validPassword(input.data.password))return Response.json({error:'La contraseña no es correcta.'},{status:401});
    (await cookies()).set(COOKIE_NAME,createSession(),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:SESSION_SECONDS});
    return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'La despensa no está disponible. Comprueba la configuración y vuelve a intentarlo.'},{status:503});}
}
