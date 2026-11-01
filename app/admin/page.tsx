import Link from 'next/link';
import { requireAdmin, supabaseAdminFetch } from '../../lib/admin-access';
import AdminLogout from './logout';
export const dynamic = 'force-dynamic';
type Profile = {user_id:string;display_name:string;role:string;created_at:string;disabled_at:string|null};
type Pantry = {owner_user_id:string;household:string;display_name:string};
type Inventory = {household:string;products:unknown};
type Product = {category?:unknown;shoppingOnly?:unknown;manual?:unknown;quantity?:unknown;minimum?:unknown};
function summarize(products:unknown) {
  const summary: Record<string,{pantry:number;basket:number}> = {};
  if (!Array.isArray(products)) return {pantry:0,basket:0,categories:summary};
  let pantry=0,basket=0;
  for (const v of products) {
    if (!v || typeof v !== 'object') continue;
    const p = v as Product;
    const cat = typeof p.category==='string' ? p.category : 'Otros';
    summary[cat] ??= {pantry:0,basket:0};
    if (p.shoppingOnly !== true) {pantry++;summary[cat].pantry++;}
    const needsPurchase = p.shoppingOnly === true || p.manual === true || p.quantity === 0 || (typeof p.minimum === 'number' && typeof p.quantity === 'number' && p.quantity <= p.minimum);
    if (needsPurchase) {basket++;summary[cat].basket++;}
  }
  return {pantry,basket,categories:summary};
}
export default async function AdminPage(){
  await requireAdmin();
  const [u,p,i]=await Promise.all([
    supabaseAdminFetch('/rest/v1/mdespensa_profiles?select=user_id,display_name,role,created_at,disabled_at&order=created_at.desc'),
    supabaseAdminFetch('/rest/v1/mdespensa_user_pantries?select=owner_user_id,household,display_name'),
    supabaseAdminFetch('/rest/v1/mdespensa_inventory?select=household,products')
  ]);
  if (!u.ok || !p.ok || !i.ok) throw new Error('No se pudieron cargar los datos de administración');
  const profiles=await u.json() as Profile[];
  const pantries=await p.json() as Pantry[];
  const inventories=await i.json() as Inventory[];
  const byHousehold = new Map(inventories.map(x=>[x.household,summarize(x.products)]));
  return <main className="app-shell" style={{paddingTop:28,paddingBottom:48}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:25}}><div><div className="brand">Mi Despensa · Administración</div><p style={{color:'var(--muted)',fontSize:13,marginTop:9}}>Usuarios y estadísticas · Vista de consulta</p></div><div style={{display:'flex',gap:12,alignItems:'center'}}><Link className="secondary" href="/">Mi despensa</Link><AdminLogout/></div></header>
    <section className="workspace" style={{padding:22}}><h1 style={{fontSize:30,margin:'5px 0 18px'}}>Usuarios registrados: {profiles.length}</h1>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:15}}>
      {profiles.map(user=>{
        const own=pantries.filter(x=>x.owner_user_id===user.user_id);
        const total=own.reduce((acc,x)=>{const s=byHousehold.get(x.household);return {pantry:acc.pantry+(s?.pantry??0),basket:acc.basket+(s?.basket??0)}},{pantry:0,basket:0});
        return <article key={user.user_id} style={{border:'1px solid var(--line)',borderRadius:12,padding:18}}><h2 style={{fontSize:17,marginBottom:6}}>{user.display_name||'Sin nombre'}</h2><p style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>{user.role==='admin'?'Administradora':'Usuario'} · {user.disabled_at?'Desactivado':'Activo'} · Registrado: {new Date(user.created_at).toLocaleDateString('es-ES')}</p><p style={{fontSize:13,marginBottom:8}}>Despensas: <strong>{own.length}</strong> · Productos: <strong>{total.pantry}</strong> · Próxima compra: <strong>{total.basket}</strong></p>{own.map(d=>{const s=byHousehold.get(d.household);return <details key={d.household} style={{padding:'9px 0',borderTop:'1px solid var(--line)'}}><summary style={{cursor:'pointer'}}>{d.display_name} · {s?.pantry??0} productos · {s?.basket??0} compra</summary><div style={{fontSize:12,paddingTop:8}}>{Object.entries(s?.categories??{}).sort(([a],[b])=>a.localeCompare(b,'es')).map(([cat,v])=><p key={cat} style={{marginBottom:5}}>{cat}: {v.pantry} despensa / {v.basket} compra</p>)}</div></details>})}</article>;
      })}</div><p style={{fontSize:12,color:'var(--muted)',marginTop:20}}>Esta primera fase solo permite consultar datos. Alta de usuarios, cambio de contraseñas, último acceso, bajas y auditoría se incorporarán en el siguiente bloque.</p>
    </section></main>;
}
