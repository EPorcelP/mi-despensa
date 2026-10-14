import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME,verifySession } from './session';
export async function hasSession(){const token=(await cookies()).get(COOKIE_NAME)?.value;return !!token && verifySession(token);}
export async function requireSession(){if(!await hasSession())redirect('/login');}
export { sameOrigin } from './origin';
