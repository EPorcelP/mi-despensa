import { z } from 'zod';
import { hasSession,sameOrigin } from '../../../lib/auth';
import { household,rpc } from '../../../lib/database';
import { prepareProducts } from '../../../lib/pantry';
import type { PantrySnapshot } from '../../../lib/quick-queue';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const product=z.object({id:z.string().min(1).max(80),name:z.string().trim().min(1).max(120),category:z.string().min(1).max(80),quantity:z.number().int().min(0).max(100000),unit:z.string().min(1).max(40),minimum:z.number().int().min(0).max(100000).nullable(),manual:z.boolean(),categoryAutomatic:z.boolean().optional(),minimumAutomatic:z.boolean().optional(),shoppingOnly:z.boolean().optional()});
const payload=z.object({version:z.number().int().nonnegative(),products:z.array(product).max(1000)}).refine(x=>new Set(x.products.map(p=>p.id)).size===x.products.length);
const quickPayload=z.object({operations:z.array(z.object({operationId:z.string().uuid(),productId:z.string().min(1).max(80),delta:z.union([z.literal(1),z.literal(-1)])})).min(1).max(30)});
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function guard(request?:Request){if(!await hasSession())return reply({error:'Inicia sesión para abrir tu despensa.'},401);if(request&&!sameOrigin(request))return reply({error:'Petición no permitida.'},403);return null;}
export async function GET(){
  const denied=await guard();if(denied)return denied;
  try{const data=await rpc<PantrySnapshot>('mdespensa_read',{p_household:household()});return reply({...data,products:prepareProducts(data.products)});}
  catch{return reply({error:'No se pudo cargar la despensa. Inténtalo de nuevo.'},503);}
}
export async function PUT(request:Request){
  const denied=await guard(request);if(denied)return denied;
  try{
    const raw=await request.text();if(raw.length>500000)return reply({error:'La lista es demasiado grande.'},413);
    const input=payload.safeParse(JSON.parse(raw));if(!input.success)return reply({error:'Revisa los nombres: las cantidades y los avisos deben ser números enteros. No se ha guardado ningún cambio.'},400);
    const data=await rpc<PantrySnapshot & {conflict?:boolean}>('mdespensa_put',{p_household:household(),p_expected_version:input.data.version,p_products:prepareProducts(input.data.products)});
    if(data.conflict)return reply({error:'La despensa cambió en otra ventana. Se ha recargado; vuelve a hacer este cambio.'},409);
    return reply({...data,products:prepareProducts(data.products)});
  }catch{return reply({error:'No se pudo guardar. Revisa la conexión y vuelve a intentarlo.'},503);}
}
export async function PATCH(request:Request){
  const denied=await guard(request);if(denied)return denied;
  try{
    const raw=await request.text();if(raw.length>15000)return reply({error:'Demasiados cambios a la vez.'},413);
    const input=quickPayload.safeParse(JSON.parse(raw));if(!input.success)return reply({error:'Revisa el cambio de cantidad.'},400);
    const data=await rpc<PantrySnapshot>('mdespensa_steps',{p_household:household(),p_operations:input.data.operations});
    return reply({...data,products:prepareProducts(data.products)});
  }catch{return reply({error:'No se han podido confirmar las cantidades. Pulsa Reintentar; no se duplicarán.'},503);}
}
