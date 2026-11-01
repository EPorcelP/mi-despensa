import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getAdmin, supabaseAdminFetch } from '../../../../lib/admin-access';
import { sameOrigin } from '../../../../lib/origin';

export const runtime = 'nodejs';
const bodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  password: z.string().min(12).max(128),
}).strict();

type AuthUser = { id?: string };
const json = (body: object, status: number) => Response.json(body, {status,headers:{'Cache-Control':'no-store'}});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({error:'Origen no autorizado'},403);
  const admin = await getAdmin();
  if (!admin) return json({error:'Acceso no autorizado'},401);
  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw=await request.text();
    if (raw.length > 1800) return json({error:'Datos demasiado largos'},400);
    const result=bodySchema.safeParse(JSON.parse(raw));
    if (!result.success) return json({error:'Revisa el nombre, correo y contraseña (mínimo 12 caracteres)'},400);
    parsed=result.data;
  } catch { return json({error:'Datos incorrectos'},400); }
  const id=randomUUID();
  // La clave se genera en el servidor: ningún usuario puede escoger el household de otro.
  const household=`u_${id.replaceAll('-','')}`;
  let authId: string | null=null;
  try {
    const auth=await supabaseAdminFetch('/auth/v1/admin/users', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:parsed.email,password:parsed.password,email_confirm:true,user_metadata:{display_name:parsed.name}})
    });
    if (!auth.ok) {
      if (auth.status===422 || auth.status===409) return json({error:'No se ha podido crear la cuenta. Comprueba si el correo ya está registrado.'},409);
      throw new Error(`Auth ${auth.status}`);
    }
    const created=await auth.json() as AuthUser;
    if (!created.id || !/^[0-9a-f-]{36}$/i.test(created.id)) throw new Error('Auth sin ID');
    authId=created.id;
    const inventory=await supabaseAdminFetch('/rest/v1/mdespensa_inventory',{
      method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({household,version:0,products:[]})
    });
    if (!inventory.ok) throw new Error(`Inventario ${inventory.status}`);
    const profile=await supabaseAdminFetch('/rest/v1/mdespensa_profiles',{
      method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({user_id:authId,display_name:parsed.name,role:'user'})
    });
    if (!profile.ok) throw new Error(`Perfil ${profile.status}`);
    const link=await supabaseAdminFetch('/rest/v1/mdespensa_user_pantries',{
      method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({owner_user_id:authId,household,display_name:'Casa'})
    });
    if (!link.ok) throw new Error(`Vínculo ${link.status}`);
    await supabaseAdminFetch('/rest/v1/mdespensa_admin_audit',{
      method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({actor_user_id:admin.user_id,target_user_id:authId,action:'user_created',detail:{household}})
    });
    return json({ok:true},201);
  } catch (error) {
    // No ocultar estados parciales: borrar Auth en cascada NO borra el inventario creado.
    // Un error requiere revisión administrativa, para evitar cuentas huérfanas invisibles.
    console.error('Alta de usuario incompleta',error instanceof Error ? error.message : 'error', {authId,household});
    return json({error:'No se completó el alta. No la repitas todavía; revisa los registros del servidor.'},503);
  }
}
