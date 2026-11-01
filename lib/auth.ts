import { redirect } from 'next/navigation';
import { getUser } from './user-access';
export async function hasSession(){return !!await getUser();}
export async function requireSession(){if(!await hasSession())redirect('/login');}
export { sameOrigin } from './origin';
