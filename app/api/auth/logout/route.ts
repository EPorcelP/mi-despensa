import { cookies } from 'next/headers';
import { USER_COOKIE,userCookieOptions } from '../../../../lib/user-access';
import { sameOrigin } from '../../../../lib/origin';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Petición no permitida'}, {status:403});
 (await cookies()).set(USER_COOKIE,'',{...userCookieOptions(),maxAge:0});
 return Response.redirect(new URL('/login',request.url),303);
}
