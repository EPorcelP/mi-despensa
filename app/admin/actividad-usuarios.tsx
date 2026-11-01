'use client';
import {useState} from 'react';
type Activity={id:string;name:string;lastSignIn:string|null};
const periods=[{days:7,label:'7 días'},{days:30,label:'1 mes'},{days:90,label:'3 meses'},{days:180,label:'6 meses'}] as const;
export default function ActividadUsuarios({activity}:{activity:Activity[]}) {
 const [days,setDays]=useState<number>(30);
 const boundary=Date.now()-days*24*60*60*1000;
 const active=activity.filter(u=>u.lastSignIn && Date.parse(u.lastSignIn)>=boundary);
 const never=activity.filter(u=>!u.lastSignIn).length;
 return <section style={{marginBottom:24}} aria-label="Actividad de usuarios">
   <h2 style={{fontSize:20,marginBottom:12}}>Actividad de usuarios</h2>
   <p style={{marginBottom:12}}>Registrados: <strong>{activity.length}</strong> · Nunca han iniciado sesión: <strong>{never}</strong></p>
   <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}} role="group" aria-label="Periodo de actividad">
    {periods.map(p=><button key={p.days} type="button" aria-pressed={days===p.days} onClick={()=>setDays(p.days)} style={{padding:'8px 12px',borderRadius:10,border:'1px solid var(--line)',background:days===p.days?'var(--line)':'transparent',color:'inherit',cursor:'pointer'}}>{p.label}</button>)}
   </div>
   <p role="status">Usuarios que han iniciado sesión en los últimos {days} días: <strong>{active.length}</strong></p>
   <details style={{marginTop:8}}><summary style={{cursor:'pointer'}}>Ver usuarios activos en este periodo</summary>
    {active.length ? <ul style={{paddingLeft:20,marginTop:8}}>{active.map(u=><li key={u.id}>{u.name} · {new Date(u.lastSignIn!).toLocaleString('es-ES')}</li>)}</ul> : <p>No hay accesos registrados en este periodo.</p>}
   </details>
   <p style={{fontSize:12,color:'var(--muted)',marginTop:8}}>Los periodos son ventanas móviles de días naturales completos contados desde este momento. Se mide el último inicio de sesión en Supabase Auth, no el uso del inventario.</p>
 </section>;
}
