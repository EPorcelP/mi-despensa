import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import { supabaseAdminFetch } from './admin-access';

export const USER_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-md_user' : 'md_user';
const AGE = 60 * 60 * 8;
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('Falta SESSION_SECRET');
  return createHmac('sha256', secret).update('MiDespensa/usuario/v1').digest();
}
function sign(data:string) {return createHmac('sha256',key()).update(data).digest('base64url');}
export function userCookieOptions(){return {httpOnly:true as const,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/',maxAge:AGE};}
export function createUserTicket(id:string,version:number){const data=Buffer.from(JSON.stringify({uid:id,ver:version,exp:Math.floor(Date.now()/1000)+AGE})).toString('base64url');return `${data}.${sign(data)}`;}
function parseTicket(ticket:string):{id:string;version:number}|null {
 try {
  if (ticket.length>2000) return null;
  const parts=ticket.split('.'); if(parts.length!==2)return null;
  const expected=Buffer.from(sign(parts[0]),'base64url');
  const actual=Buffer.from(parts[1],'base64url');
  if(expected.length!==actual.length || !timingSafeEqual(expected,actual))return null;
  const payload=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8')) as {uid?:unknown;exp?:unknown;ver?:unknown};
  if(typeof payload.uid!=='string'||!/^[a-f0-9-]{36}$/i.test(payload.uid)||typeof payload.exp!=='number'||payload.exp<=Date.now()/1000)return null;
  if (!Number.isSafeInteger(payload.ver) || (payload.ver as number)<0) return null;
  return {id:payload.uid,version:payload.ver as number};
 }catch{return null;}
}
type UserProfile = {user_id:string;role:string;disabled_at:string|null;session_version:number};
type PantryLink = {household:string;display_name:string};
export async function getUser(): Promise<{id:string;role:string;household:string;pantryName:string}|null> {
 const token=(await cookies()).get(USER_COOKIE)?.value;const ticketData=token?parseTicket(token):null;
 if(!ticketData)return null;
 const id=ticketData.id;
 try {
  const p=await supabaseAdminFetch('/rest/v1/mdespensa_profiles?user_id=eq.'+encodeURIComponent(id)+'&select=user_id,role,disabled_at,session_version&limit=1');
  if(!p.ok)return null;
  const profiles=await p.json() as UserProfile[];
  if(profiles[0]?.user_id!==id || profiles[0]?.disabled_at!==null || profiles[0]?.session_version!==ticketData.version)return null;
  const link=await supabaseAdminFetch('/rest/v1/mdespensa_user_pantries?owner_user_id=eq.'+encodeURIComponent(id)+'&select=household,display_name&order=created_at.asc&limit=1');
  if(!link.ok)return null;
  const pantries=await link.json() as PantryLink[];
  const selected=pantries[0];if(!selected?.household)return null;
  return {id,role:profiles[0].role,household:selected.household,pantryName:selected.display_name};
 }catch{return null;}
}
export async function requireUser(){const user=await getUser();if(!user)redirect('/login');return user;}
