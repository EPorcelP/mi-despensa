import Link from 'next/link';
import { requireAdmin, supabaseAdminFetch } from '../../lib/admin-access';
import AdminLogout from './logout';
import NuevoUsuario from './nuevo-usuario';
import ActividadUsuarios from './actividad-usuarios';
import AccionesUsuario from './acciones-usuario';
export const dynamic = 'force-dynamic';
type Profile = {user_id:string;display_name:string;role:string;created_at:string;disabled_at:string|null};
type AuthUser = {id:string;last_sign_in_at?:string|null};
async function loadAuthUsers(): Promise<AuthUser[]> {
  const users: AuthUser[]=[];
  for (let page=1;page<=100;page++) {
    const response=await supabaseAdminFetch(`/auth/v1/admin/users?page=${page}&per_page=100`);
    if (!response.ok) throw new Error('No se pudo recuperar la actividad de inicio de sesión');
    const data=await response.json() as {users?:AuthUser[]};
    if (!Array.isArray(data.users)) throw new Error('Respuesta inesperada de Auth');
    users.push(...data.users);
    if (data.users.length<100) return users;
  }
  throw new Error('Hay más usuarios de los que admite la consulta de actividad');
}
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
  const [u,p,i,authUsers]=await Promise.all([
    supabaseAdminFetch('/rest/v1/mdespensa_profiles?select=user_id,display_name,role,created_at,disabled_at&order=created_at.desc'),
    supabaseAdminFetch('/rest/v1/mdespensa_user_pantries?select=owner_user_id,household,display_name'),
    supabaseAdminFetch('/rest/v1/mdespensa_inventory?select=household,products'),
    loadAuthUsers()
  ]);
  if (!u.ok || !p.ok || !i.ok) throw new Error('No se pudieron cargar los datos de administración');
  const profiles=await u.json() as Profile[];
  const pantries=await p.json() as Pantry[];
  const inventories=await i.json() as Inventory[];
  const byHousehold = new Map(inventories.map(x=>[x.household,summarize(x.products)]));
  const authById=new Map(authUsers.map(x=>[x.id,x]));
  // Agrupamos exclusivamente despensas vinculadas a perfiles registrados.
  const linkedHouseholds=new Set(pantries.filter(p=>profiles.some(u=>u.user_id===p.owner_user_id)).map(p=>p.household));
  const totals={pantries:linkedHouseholds.size,pantry:0,basket:0};
  const categoryTotals=new Map<string,{pantry:number;basket:number}>();
  for(const household of linkedHouseholds){
    const summary=byHousehold.get(household);
    if(!summary)continue;
    totals.pantry+=summary.pantry;totals.basket+=summary.basket;
    for(const [name,values] of Object.entries(summary.categories)){
      const previous=categoryTotals.get(name)??{pantry:0,basket:0};
      categoryTotals.set(name,{pantry:previous.pantry+values.pantry,basket:previous.basket+values.basket});
    }
  }
  const categoryRows=[...categoryTotals.entries()].sort(([a],[b])=>a.localeCompare(b,'es'));
  const activeAccounts=profiles.filter(p=>!p.disabled_at).length;
  const activity=profiles.map(p=>({id:p.user_id,name:p.display_name||'Sin nombre',lastSignIn:authById.get(p.user_id)?.last_sign_in_at??null}));
  return <main className="app-shell" style={{paddingTop:28,paddingBottom:48}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:25}}><div><div className="brand">Mi Despensa · Administración</div><p style={{color:'var(--muted)',fontSize:13,marginTop:9}}>Usuarios y estadísticas · Vista de consulta</p></div><div style={{display:'flex',gap:12,alignItems:'center'}}><Link className="secondary" href="/">Mi despensa</Link><AdminLogout/></div></header>
    <section className="workspace" style={{padding:22}}><ActividadUsuarios activity={activity}/>
      <section aria-label="Estadísticas generales" style={{marginBottom:24}}>
        <h2 style={{fontSize:20,marginBottom:12}}>Resumen general</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:10,marginBottom:14}}>
          {[
            ['Usuarios registrados',profiles.length],['Cuentas habilitadas',activeAccounts],
            ['Despensas',totals.pantries],['Productos en despensa',totals.pantry],['Próxima compra',totals.basket]
          ].map(([label,value])=><div key={label} style={{border:'1px solid var(--line)',borderRadius:12,padding:14}}><div style={{fontSize:12,color:'var(--muted)'}}>{label}</div><strong style={{fontSize:25}}>{value}</strong></div>)}
        </div>
        <details><summary style={{cursor:'pointer',fontWeight:600}}>Ver totales por categoría</summary>
          <div style={{overflowX:'auto',marginTop:10}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',fontSize:13}}>
            <thead><tr><th scope="col" style={{padding:8}}>Categoría</th><th scope="col" style={{padding:8}}>Despensa</th><th scope="col" style={{padding:8}}>Próxima compra</th></tr></thead>
            <tbody>{categoryRows.map(([category,count])=><tr key={category} style={{borderTop:'1px solid var(--line)'}}><th scope="row" style={{padding:8,fontWeight:400}}>{category}</th><td style={{padding:8}}>{count.pantry}</td><td style={{padding:8}}>{count.basket}</td></tr>)}</tbody>
          </table></div>
        </details>
      </section>
      <NuevoUsuario/><h1 style={{fontSize:30,margin:'5px 0 18px'}}>Usuarios registrados: {profiles.length}</h1>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:15}}>
      {profiles.map(user=>{
        const own=pantries.filter(x=>x.owner_user_id===user.user_id);
        const total=own.reduce((acc,x)=>{const s=byHousehold.get(x.household);return {pantry:acc.pantry+(s?.pantry??0),basket:acc.basket+(s?.basket??0)}},{pantry:0,basket:0});
        const perCategory=new Map<string,{pantry:number;basket:number}>();
        for(const pantry of own){for(const [name,v] of Object.entries(byHousehold.get(pantry.household)?.categories??{})){
          const old=perCategory.get(name)??{pantry:0,basket:0};perCategory.set(name,{pantry:old.pantry+v.pantry,basket:old.basket+v.basket});
        }}
        return <article key={user.user_id} style={{border:'1px solid var(--line)',borderRadius:12,padding:18}}><h2 style={{fontSize:17,marginBottom:6}}>{user.display_name||'Sin nombre'}</h2><p style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>{user.role==='admin'?'Administradora':'Usuario'} · {user.disabled_at?'Desactivado':'Activo'} · Registrado: {new Date(user.created_at).toLocaleDateString('es-ES')} · Último acceso: {authById.get(user.user_id)?.last_sign_in_at ? new Date(authById.get(user.user_id)!.last_sign_in_at!).toLocaleString('es-ES') : 'Nunca'}</p><p style={{fontSize:13,marginBottom:8}}>Despensas: <strong>{own.length}</strong> · Productos: <strong>{total.pantry}</strong> · Próxima compra: <strong>{total.basket}</strong></p><details style={{padding:'9px 0',borderTop:'1px solid var(--line)'}}><summary style={{cursor:'pointer'}}>Total por categoría de este usuario</summary><div style={{fontSize:12,paddingTop:8}}>{[...perCategory.entries()].sort(([a],[b])=>a.localeCompare(b,'es')).map(([cat,v])=><p key={cat} style={{marginBottom:5}}>{cat}: {v.pantry} despensa / {v.basket} compra</p>)}</div></details>{own.map(d=>{const s=byHousehold.get(d.household);return <details key={d.household} style={{padding:'9px 0',borderTop:'1px solid var(--line)'}}><summary style={{cursor:'pointer'}}>{d.display_name} · {s?.pantry??0} productos · {s?.basket??0} compra</summary><div style={{fontSize:12,paddingTop:8}}>{Object.entries(s?.categories??{}).sort(([a],[b])=>a.localeCompare(b,'es')).map(([cat,v])=><p key={cat} style={{marginBottom:5}}>{cat}: {v.pantry} despensa / {v.basket} compra</p>)}</div></details>})}<AccionesUsuario id={user.user_id} name={user.display_name||'Sin nombre'} disabled={!!user.disabled_at} isAdmin={user.role==='admin'}/></article>;
      })}</div><p style={{fontSize:12,color:'var(--muted)',marginTop:20}}>La actividad se basa en el último inicio de sesión de Supabase Auth, no en modificaciones del inventario. Las acciones de cuenta se comprueban en el servidor; la actividad depende del último inicio de sesión.</p>
    </section></main>;
}
