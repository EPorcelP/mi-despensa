 'use client';
export default function AdminLogout(){return <button className="secondary" onClick={async()=>{await fetch('/api/admin/logout',{method:'POST'});location.assign('/admin/login');}}>Salir de administración</button>}
