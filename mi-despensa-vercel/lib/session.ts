import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export const SESSION_SECONDS=14*24*60*60;
export const COOKIE_NAME=process.env.NODE_ENV==='production'?'__Host-midespensa_session':'midespensa_session';
function sessionKey() {
  const secret=process.env.SESSION_SECRET, password=process.env.DESPENSA_PASSWORD;
  if(!secret || secret.length<32 || !password || password.length<12)throw new Error('Completa la configuración privada.');
  return createHmac('sha256',secret).update(createHash('sha256').update(password).digest()).digest();
}
export function validPassword(value:string) {
  const expected=process.env.DESPENSA_PASSWORD;
  if(!expected || expected.length<12)throw new Error('Completa la configuración privada.');
  return timingSafeEqual(createHash('sha256').update(value).digest(),createHash('sha256').update(expected).digest());
}
function sign(value:string){return createHmac('sha256',sessionKey()).update(value).digest('base64url');}
export function createSession(now=Date.now()){
  const payload=Buffer.from(JSON.stringify({exp:Math.floor(now/1000)+SESSION_SECONDS,nonce:randomBytes(16).toString('hex')})).toString('base64url');
  return payload+'.'+sign(payload);
}
export function verifySession(token:string,now=Date.now()) {
  try {
    if(token.length>1024)return false;
    const parts=token.split('.');if(parts.length!==2)return false;
    const expected=Buffer.from(sign(parts[0]),'base64url'), actual=Buffer.from(parts[1],'base64url');
    if(expected.length!==actual.length || !timingSafeEqual(expected,actual))return false;
    const payload=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    return typeof payload.exp==='number' && Number.isFinite(payload.exp) && payload.exp>Math.floor(now/1000);
  } catch {return false;}
}
