import { cookies } from 'next/headers';
import { USER_COOKIE,userCookieOptions } from '../../../../lib/user-access';
import { sameOrigin } from '../../../../lib/origin';
import { ADMIN_COOKIE } from '../../../../lib/admin-access';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Petición no permitida'}, {status:403});
 const jar=await cookies();
 jar.set(USER_COOKIE,'',{...userCookieOptions(),maxAge:0});
 jar.delete(ADMIN_COOKIE);
 return Response.redirect(new URL('/login',request.url),303);
}
