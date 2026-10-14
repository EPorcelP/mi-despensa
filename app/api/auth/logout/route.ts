import { cookies } from 'next/headers';
import { COOKIE_NAME } from '../../../../lib/session';
import { sameOrigin } from '../../../../lib/auth';
export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({error:'Petición no permitida.'},{status:403});
  (await cookies()).set(COOKIE_NAME,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
  return Response.redirect(new URL('/login',request.url),303);
}
