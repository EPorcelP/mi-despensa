import { z } from 'zod';
import { getAdmin, supabaseAdminFetch } from '../../../../lib/admin-access';
import { sameOrigin } from '../../../../lib/origin';
export const runtime='nodejs';
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('disable'),userId:z.string().uuid()}).strict(),
 z.object({action:z.literal('enable'),userId:z.string().uuid()}).strict(),
 z.object({action:z.literal('password'),userId:z.string().uuid(),password:z.string().min(12).max(128)}).strict(),
 z.object({action:z.literal('recovery'),userId:z.string().uuid()}).strict(),
]);
const send=(data:object,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
type Profile={user_id:string;role:'admin'|'user';disabled_at:string|null;session_version:number};
async function audit(actor:string,target:string,action:string) {
 const r=await supabaseAdminFetch('/rest/v1/mdespensa_admin_audit',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({actor_user_id:actor,target_user_id:target,action})});
 if(!r.ok)console.error('Error de auditoría',r.status,action);
}
export async function POST(request:Request){
 if(!sameOrigin(request))return send({error:'Petición no permitida'},403);
 const admin=await getAdmin();if(!admin)return send({error:'Acceso no autorizado'},403);
 let data:z.infer<typeof schema>;
 try{const raw=await request.text();if(raw.length>1800)return send({error:'Datos demasiado largos'},400);const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success)return send({error:'Revisa los datos'},400);data=parsed.data;}catch{return send({error:'Datos incorrectos'},400);}
 try{
  const lookup=await supabaseAdminFetch('/rest/v1/mdespensa_profiles?user_id=eq.'+encodeURIComponent(data.userId)+'&select=user_id,role,disabled_at,session_version&limit=1');
  if(!lookup.ok)throw new Error('Perfil inaccesible');
  const profiles=await lookup.json() as Profile[];const target=profiles[0];
  if(!target||target.user_id!==data.userId)return send({error:'Usuario no encontrado'},404);
  // No tocar cuentas de administración desde estas acciones: evita pérdida del último administrador.
  if(target.role!=='user'||data.userId===admin.user_id)return send({error:'Las cuentas administradoras no pueden modificarse desde aquí'},403);
  if(data.action==='disable'||data.action==='enable'){
   const disable=data.action==='disable';
   const changed=await supabaseAdminFetch('/rest/v1/mdespensa_profiles?user_id=eq.'+encodeURIComponent(data.userId)+'&session_version=eq.'+target.session_version,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({disabled_at:disable?new Date().toISOString():null,session_version:target.session_version+1})});
   if(!changed.ok)throw new Error('No se pudo actualizar el perfil');
   const rows=await changed.json() as Profile[];if(rows.length!==1)throw new Error('No se actualizó exactamente una cuenta');
   await audit(admin.user_id,data.userId,disable?'user_disabled':'user_enabled');
   return send({ok:true});
  }
  if(data.action==='password'){
   if(target.disabled_at)return send({error:'Activa primero esta cuenta para gestionar el acceso'},409);
   const changed=await supabaseAdminFetch('/auth/v1/admin/users/'+encodeURIComponent(data.userId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:data.password})});
   if(!changed.ok)throw new Error('No se pudo cambiar la contraseña');
   const revoked=await supabaseAdminFetch('/rest/v1/mdespensa_profiles?user_id=eq.'+encodeURIComponent(data.userId)+'&session_version=eq.'+target.session_version,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({session_version:target.session_version+1})});
   if(!revoked.ok || (await revoked.json() as Profile[]).length!==1) { console.error('CRÍTICO: contraseña cambiada, revocación pendiente',data.userId); return send({error:'Contraseña cambiada, pero no se pudieron invalidar todas las sesiones. Bloquea la cuenta y revisa los registros.'},503); }
   await audit(admin.user_id,data.userId,'password_changed_by_admin');return send({ok:true});
  }
  if(target.disabled_at)return send({error:'Activa primero esta cuenta para enviar la recuperación'},409);
  const auth=await supabaseAdminFetch('/auth/v1/admin/users/'+encodeURIComponent(data.userId));
  if(!auth.ok)throw new Error('Usuario de Auth no encontrado');
  const authUser=await auth.json() as {email?:string};
  if(!authUser.email)return send({error:'La cuenta no tiene correo'},409);
  const base=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;
  const appOrigin=process.env.NEXT_PUBLIC_APP_URL;
  if(!base||!anon||!appOrigin) return send({error:'Falta configurar NEXT_PUBLIC_APP_URL para la recuperación'},503);
  const origin=new URL(appOrigin);if(origin.protocol!=='https:')return send({error:'La URL de la aplicación debe utilizar HTTPS'},503);
  const callback=new URL('/admin/restablecer',origin);
  const recovery=new URL('/auth/v1/recover',base);recovery.searchParams.set('redirect_to',callback.toString());
  const response=await fetch(recovery,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email:authUser.email}),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok){console.error('Supabase recuperación',response.status);return send({error:response.status===429?'Límite de correos alcanzado. Intenta más tarde.':'Supabase no ha aceptado el envío. Consulta Auth Logs.'},502);}
  await audit(admin.user_id,data.userId,'password_recovery_requested');return send({ok:true});
 }catch(e){console.error('Gestión usuario',e instanceof Error?e.message:'Error');return send({error:'No se pudo completar la operación. Revisa los registros del servidor.'},503);}
}
