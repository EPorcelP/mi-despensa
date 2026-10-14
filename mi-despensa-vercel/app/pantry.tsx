'use client';
import { useEffect, useRef, useState } from 'react';
import { Leaf, Plus, Minus, Search, ShoppingBasket, Package, ClipboardList, ArrowUpRight, X, Check, Pencil, Undo2, RefreshCw, Copy, Trash2 } from 'lucide-react';
import { categories, units, needsPurchase, parseList, applyImport, normalize, titleCase, prepareProduct, inferCategory, type Product, type ImportRow } from '../lib/pantry';
import { QuickQueue, type PantrySnapshot } from '../lib/quick-queue';
const example = '10 latas de alcachofas\n6 bricks de leche entera\n2 paquetes de café\n12 latas de Coca-Cola Zero\n3 botes de tomate frito';
const format = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 3 });
function Modal({ title, children, onClose, busy }: { title: string; children: React.ReactNode; onClose: () => void; busy: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  return <dialog ref={ref} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} className="modal">
    <div className="modal-head"><h2>{title}</h2><button disabled={busy} className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={22}/></button></div>
    {children}
  </dialog>;
}
export default function Pantry() {
  const [products, setProducts] = useState<Product[]>([]);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState<'pantry' | 'shopping'>('pantry');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [text, setText] = useState('');
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [undo, setUndo] = useState<Product[] | null>(null);
  const [replenish, setReplenish] = useState<Product | null>(null);
  const [amount, setAmount] = useState('1');
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickFailed, setQuickFailed] = useState(false);
  const quick = useRef<QuickQueue | null>(null);
  if (!quick.current) quick.current = new QuickQueue(
    async operations => {
      const response = await fetch('/api/pantry', { method: 'PATCH', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operations }) });
      const data = await response.json() as PantrySnapshot & { error?: string };
      if (!response.ok) throw new Error(data.error);
      return data;
    },
    (data, pending) => { setProducts(data.products); setVersion(data.version); setQuickBusy(pending); },
    message => { setQuickFailed(true); setError(message); }
  );
  async function load() {
    if (quick.current!.pending.length) return;
    setLoading(true); setError('');
    try { const response = await fetch('/api/pantry', { cache: 'no-store' }); const data = await response.json() as { error?: string; products: Product[]; version: number }; if (!response.ok) throw new Error(data.error); setProducts(data.products); setVersion(data.version); setReady(true); setUndo(null); quick.current!.reset(data); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo conectar.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { const refresh = () => { if (!lock.current && !quick.current!.pending.length && !editing && !importOpen && !replenish) void load(); }; window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, [editing, importOpen, replenish]);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (quick.current!.pending.length) { e.preventDefault(); } };
    const pageHide = () => { const operations=quick.current!.pending.slice(0,30); if(operations.length)void fetch('/api/pantry',{method:'PATCH',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({operations})}); };
    window.addEventListener('beforeunload',beforeUnload);window.addEventListener('pagehide',pageHide);
    return () => {window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('pagehide',pageHide);};
  }, []);
  async function save(next: Product[], message: string, isUndo = false) {
    if (lock.current || quick.current!.pending.length || loading || !ready) return false;
    lock.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/pantry', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version, products: next }) });
      const data = await response.json() as { error?: string; products: Product[]; version: number };
      if (response.status === 409) { await load(); setUndo(null); throw new Error(data.error); }
      if (!response.ok) throw new Error(data.error);
      setUndo(isUndo ? null : products.map(p => ({...p}))); setProducts(data.products); setVersion(data.version); quick.current!.reset(data); setToast(message); return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  function addProduct() { setEditing({ id: crypto.randomUUID(), name: '', category: 'Otros', quantity: 0, unit: 'unidades', minimum: null, manual: false, categoryAutomatic: true, minimumAutomatic: true }); }
  function openImport() { setText(''); setRows(null); setImportOpen(true); }
  function change(p: Product, delta: 1 | -1) { if (loading || !ready || lock.current || quick.current!.failed) return; setUndo(null); setError(''); quick.current!.add({operationId:crypto.randomUUID(),productId:p.id,delta}); }
  const shopping = products.filter(needsPurchase);
  const filtered = products.filter(p => (tab === 'pantry' || needsPurchase(p)) && (!lowOnly || needsPurchase(p)) && (category === 'Todas' || p.category === category) && normalize(p.name).includes(normalize(query)));
  const disabled = busy || quickBusy || loading || !ready;
  const stepDisabled = busy || loading || !ready || quickFailed;
  const groups = [...categories, ...products.map(p=>p.category).filter(c=>!categories.includes(c))].filter((c,i,a)=>a.indexOf(c)===i);
  const included = rows?.filter(r => r.included) ?? [];
  const validRows = included.length > 0 && included.every(r => r.name.trim() && Number.isFinite(r.quantity) && r.quantity > 0 && r.quantity <= 100000 && r.unit.trim());
  function patchRow(i: number, patch: Partial<ImportRow>) { setRows(current => current!.map((r,j) => j === i ? {...r,...patch} : r)); }
  async function copyShopping() {
    const content = shopping.map(p => `${p.name} — tengo ${format(p.quantity)} ${p.unit}${p.minimum !== null ? `; mínimo ${format(p.minimum)}` : ''}`).join('\n');
    try { await navigator.clipboard.writeText(content); setToast('Lista copiada para tu compra online'); } catch { setError('No se pudo copiar. Puedes seleccionar el texto de la lista.'); }
  }
  return <div className="app-shell">
    <header className="topbar"><a href="/" className="brand"><span className="brand-icon"><Leaf size={22}/></span>mi despensa<span className="brand-dot">.</span></a><div className="session-actions"><span className="private-label"><span/>Mi casa</span><form action="/api/auth/logout" method="post"><button className="text-button" title="Cerrar sesión">Salir</button></form></div></header>
    <main>
      <section className="hero"><div className="hero-content"><span className="eyebrow">UN POCO DE ORDEN, MUCHA TRANQUILIDAD</span><h1>Lo que tienes,<br/><em>a mano.</em></h1><button className="primary" disabled={disabled} onClick={openImport}><Plus size={19}/>Añadir compra<ArrowUpRight size={18}/></button></div><div className="pantry-art" aria-hidden="true"><div className="art-shelf"><div className="jar jar-one"><i/><span>CAFÉ</span></div><div className="jar jar-two"><i/><span>PASTA</span></div><div className="bottle"><i/><span>ACEITE</span></div><div className="can"><i/><span>EN CASA</span></div></div><div className="art-note"><Check size={17}/>Todo un poco más fácil</div></div></section>

      {error && <div className="error" role="alert">{error}<button className="text-button" disabled={busy || (quickBusy && !quickFailed)} onClick={()=>{if(quick.current!.pending.length){setQuickFailed(false);setError('');void quick.current!.flush();}else void load();}}>{quickFailed ? 'Reintentar' : 'Recargar'}</button></div>}
      <section className="workspace">
        <div className="workspace-heading"><nav aria-label="Secciones"><button className={tab === 'pantry' ? 'active' : ''} onClick={()=>{setTab('pantry');setLowOnly(false);}}>Mi despensa <span>{products.length}</span></button><button className={tab === 'shopping' ? 'active' : ''} onClick={()=>{setTab('shopping');setLowOnly(false);}}>Próxima compra <span>{shopping.length}</span></button></nav><div className="heading-actions"><button className="secondary" disabled={disabled} onClick={addProduct}><Plus size={17}/>Producto</button></div></div>
        <div className="toolbar"><label className="search"><Search size={18}/><input aria-label="Buscar producto" placeholder="Buscar en tu despensa…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filtrar por categoría" value={category} onChange={e=>setCategory(e.target.value)}><option>Todas</option>{groups.filter(c=>products.some(p=>p.category===c)).map(c=><option key={c}>{c}</option>)}</select>{tab === 'pantry' ? <button aria-pressed={lowOnly} className={`filter-button ${lowOnly ? 'selected' : ''}`} onClick={()=>setLowOnly(!lowOnly)}>Por reponer</button> : <button className="filter-button" disabled={!shopping.length} onClick={()=>void copyShopping()}><Copy size={16}/>Copiar lista</button>}</div>
        {tab === 'shopping' && shopping.length > 0 && <p className="section-help">Aquí aparecen los productos agotados, los que llegan a tu mínimo y los que añades tú.</p>}
        {loading ? <div className="empty"><RefreshCw className="spin" size={28}/><p>Abriendo tu despensa…</p></div> : !products.length ? <div className="empty"><span className="empty-icon"><Package size={30}/></span><h2>Vamos a llenar estas estanterías</h2><p>Pega una lista de lo que ya tienes en casa.<br/>Revisa las cantidades y guárdala de una vez.</p><button className="primary" disabled={disabled} onClick={openImport}><ClipboardList size={18}/>Cargar mi despensa</button><button className="text-button" disabled={disabled} onClick={addProduct}>O añadir un producto</button><p className="tiny">Por ejemplo: 10 latas de alcachofas · 6 bricks de leche</p></div> : !filtered.length ? <div className="empty"><Check size={30}/><h2>{tab === 'shopping' && !shopping.length ? 'Por ahora, todo en orden' : 'No hay productos aquí'}</h2><p>{tab === 'shopping' && !shopping.length ? 'Cuando algo llegue a tu mínimo o se acabe, aparecerá aquí.' : 'Prueba otra búsqueda o categoría.'}</p></div> : <div className="product-grid pantry-grid">{filtered.slice().sort((a,b)=>a.name.localeCompare(b.name,'es')).map(p=>{
          const low = needsPurchase(p); return <article className={`product-card ${low ? 'low' : ''}`} key={p.id}><div className="product-top"><span className="category-label">{p.category}</span><div className="product-actions"><button className="icon-button" disabled={disabled} title="Editar producto" aria-label={`Editar ${p.name}`} onClick={()=>setEditing({...p})}><Pencil size={16}/></button><button className="icon-button delete-action" disabled={disabled} title="Eliminar producto" aria-label={`Eliminar ${p.name}`} onClick={()=>{if(confirm(`¿Eliminar ${p.name} de la despensa?`))void save(products.filter(x=>x.id!==p.id),'Producto eliminado');}}><Trash2 size={16}/></button></div></div><h3>{titleCase(p.name)}</h3><div className="quantity-control"><button className="step" disabled={stepDisabled || p.quantity <= 0} aria-label={`Restar una unidad de ${p.name}`} onClick={()=>change(p,-1)}><Minus size={19}/></button><button className="quantity" disabled={disabled} aria-label={`Corregir cantidad de ${p.name}: ${p.quantity} ${p.unit}`} onClick={()=>setEditing({...p})}><strong>{format(p.quantity)}</strong><span>{p.unit}</span></button><button className="step" disabled={stepDisabled || p.quantity >= 100000} title="He comprado una unidad · +1" aria-label={`He comprado una unidad de ${p.name}`} onClick={()=>change(p,1)}><Plus size={19}/></button></div><div className="product-bottom"><div className="stock-summary">{low && <span className={`status ${p.quantity === 0 ? 'out' : 'warning'}`}>{p.quantity === 0 ? 'Agotado' : 'Por reponer'}</span>}<span>{p.minimum !== null ? `Aviso al quedar ${format(p.minimum)}` : 'Sin mínimo'}</span></div>{tab === 'shopping' ? <button className="text-button" disabled={disabled} onClick={()=>{setReplenish(p);setAmount(String(Math.max(1,(p.minimum ?? 1)-p.quantity)));}}>Reponer<Plus size={15}/></button> : <button className="text-button" disabled={disabled} onClick={()=>void save(products.map(x=>x.id===p.id ? {...x,manual:!x.manual}:x),p.manual?'Quitado de la compra manual':'Añadido a la próxima compra')} aria-label={p.manual ? `Quitar ${p.name} de la compra manual` : `Añadir ${p.name} a la compra`}><ShoppingBasket size={16}/>{p.manual ? 'Añadido' : 'Comprar'}</button>}</div></article>;
        })}</div>}
      </section>
      <footer><Leaf size={16}/><p>No hace falta que sea perfecto. Corrige la cantidad cuando revises lo que tienes.</p><div className="footer-actions"><span className="saved" role="status">{busy || quickBusy ? 'Guardando…' : loading ? 'Cargando…' : error ? 'Revisa el aviso' : 'Guardado'}</span>{undo && <button className="text-button" disabled={disabled} onClick={()=>void save(undo,'Último cambio deshecho',true)}><Undo2 size={16}/>Deshacer</button>}</div><button className="text-button" disabled={disabled} onClick={()=>void load()} aria-label="Actualizar despensa"><RefreshCw size={16}/></button></footer>
    </main>
    {toast && <div className="toast" role="status"><Check size={18}/>{toast}</div>}
    {editing && <Modal title={products.some(p=>p.id===editing.id) ? 'Editar producto' : 'Nuevo producto'} busy={busy} onClose={()=>setEditing(null)}><form onSubmit={async e=>{e.preventDefault();if(products.some(p=>p.id!==editing.id && normalize(p.name)===normalize(editing.name))){setError('Ya existe un producto con ese nombre. Edita su cantidad.');return;}const next=products.some(p=>p.id===editing.id)?products.map(p=>p.id===editing.id?{...editing,name:titleCase(editing.name.trim())}:p):[...products,{...editing,name:titleCase(editing.name.trim())}];if(await save(next,'Producto guardado'))setEditing(null);}}><label className="field">Producto<input autoFocus required maxLength={120} value={editing.name} placeholder="Por ejemplo, alcachofas" onChange={e=>setEditing({...prepareProduct({...editing,name:e.target.value}),name:titleCase(e.target.value)})}/></label><label className="field">Tipo de producto<select value={editing.category} onChange={e=>setEditing(prepareProduct({...editing,category:e.target.value,categoryAutomatic:false}))}>{groups.map(c=><option key={c}>{c}</option>)}</select></label><div className="form-row"><label className="field">Cantidad que tienes<input required type="number" min="0" max="100000" step="0.001" inputMode="decimal" value={Number.isNaN(editing.quantity)?'':editing.quantity} onChange={e=>setEditing({...editing,quantity:e.target.value===''?NaN:Number(e.target.value)})}/></label><label className="field">Unidad<select value={editing.unit} onChange={e=>setEditing({...editing,unit:e.target.value})}>{[...new Set([...units,editing.unit])].map(u=><option key={u}>{u}</option>)}</select></label></div><label className="field">Avisar cuando queden <span className="optional">{editing.minimumAutomatic ? 'Mínimo automático · editable' : 'Mínimo personalizado'}</span><input type="number" min="0" max="100000" step="0.001" inputMode="decimal" placeholder="Déjalo vacío si no lo necesitas" value={editing.minimum??''} onChange={e=>setEditing({...editing,minimum:e.target.value===''?null:Number(e.target.value),minimumAutomatic:false})}/></label><p className="field-help">Cuenta siempre lo mismo: latas, bricks o paquetes. Si compras un pack de 6 latas, añade 6 latas.</p>{error && <p className="error" role="alert">{error}</p>}<div className="modal-actions">{products.some(p=>p.id===editing.id)&&<button type="button" className="danger" disabled={disabled} onClick={async()=>{if(confirm(`¿Eliminar ${editing.name} de la despensa?`)&&await save(products.filter(p=>p.id!==editing.id),'Producto eliminado'))setEditing(null);}}><Trash2 size={16}/>Eliminar</button>}<button type="submit" className="primary" disabled={disabled || !editing.name.trim() || !Number.isFinite(editing.quantity)}>Guardar producto</button></div></form></Modal>}
    {importOpen && <Modal title={rows ? 'Revisa antes de guardar' : products.length ? 'Añadir una compra' : 'Cargar lo que tienes'} busy={busy} onClose={()=>setImportOpen(false)}>{!rows ? <><p className="modal-intro">Pega los productos, uno por línea, con su cantidad. Podrás corregirlos antes de añadirlos.</p><label className="field">Tu lista<textarea autoFocus rows={8} value={text} maxLength={30000} placeholder={'10 latas de alcachofas\n6 bricks de leche entera\n2 paquetes de café'} onChange={e=>setText(e.target.value)}/></label><div className="paste-help"><span>Se sumará a lo que ya tienes.</span><button className="text-button" onClick={()=>setText(example)}>Usar lista de ejemplo</button></div><p className="field-help">Máximo 200 líneas por carga. Fotos, tickets y PDF llegarán en una próxima versión.</p><div className="modal-actions"><button disabled={!text.trim()} className="primary" onClick={()=>{setRows(parseList(text,products));setError('');}}>Revisar lista<ArrowUpRight size={17}/></button></div></> : <><p className="modal-intro">{rows.length} líneas detectadas. Revisa las cantidades y las unidades: un pack puede contener varias latas.</p><div className="import-list">{rows.map((r,i)=>{const p=products.find(p=>p.id===r.match);return <div className={`import-row ${!r.included?'excluded':''}`} key={i}><div className="import-title"><input type="checkbox" aria-label={`Incluir ${r.name}`} checked={r.included} onChange={e=>patchRow(i,{included:e.target.checked})}/><input aria-label={`Nombre del producto ${i+1}`} maxLength={120} value={r.name} onChange={e=>patchRow(i,{name:titleCase(e.target.value),match:'',category:inferCategory(e.target.value,r.unit)??'Otros',categoryAutomatic:true})}/></div><div className="import-fields"><label>Cantidad<input aria-label={`Cantidad de ${r.name}`} type="number" min="0.001" max="100000" step="0.001" value={Number.isNaN(r.quantity)?'':r.quantity} onChange={e=>patchRow(i,{quantity:e.target.value===''?NaN:Number(e.target.value)})}/></label><label>Unidad<input aria-label={`Unidad de ${r.name}`} value={r.unit} maxLength={40} onChange={e=>patchRow(i,{unit:e.target.value})}/></label></div><label className="field compact">Producto en tu despensa<select value={r.match} onChange={e=>{const match=products.find(p=>p.id===e.target.value);patchRow(i,{match:e.target.value,...(match?{name:match.name,unit:match.unit,category:match.category}:{})});}}><option value="">Crear producto nuevo</option>{products.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>{!p && <label className="field compact">Tipo de producto<select value={r.category} onChange={e=>patchRow(i,{category:e.target.value,categoryAutomatic:false})}>{groups.map(c=><option key={c}>{c}</option>)}</select></label>}<p className="import-result">{p?`${format(p.quantity)} + ${Number.isFinite(r.quantity)?format(r.quantity):'?'} = ${Number.isFinite(r.quantity)?format(p.quantity+r.quantity):'?'} ${p.unit}`:'Nuevo producto · se añadirá a tu despensa'}</p></div>;})}</div>{error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><button className="text-button" disabled={busy} onClick={()=>setRows(null)}>Volver a la lista</button><button className="primary" disabled={disabled || !validRows} onClick={async()=>{const next=applyImport(products,rows,()=>crypto.randomUUID());if(await save(next,'Compra añadida a tu despensa')){setImportOpen(false);setRows(null);}}}><Check size={18}/>Confirmar entrada ({included.length})</button></div><p className="field-help">Confirma cada compra una sola vez. Si te equivocas, puedes deshacerla.</p></>}</Modal>}
    {replenish && <Modal title={`Reponer ${replenish.name}`} busy={busy} onClose={()=>setReplenish(null)}><form onSubmit={async e=>{e.preventDefault();const qty=Number(amount);if(!Number.isFinite(qty)||qty<=0)return;if(await save(products.map(p=>p.id===replenish.id?{...p,quantity:Math.round((p.quantity+qty)*1000)/1000,manual:false}:p),'Producto repuesto'))setReplenish(null);}}><p className="modal-intro">Tienes {format(replenish.quantity)} {replenish.unit}. Añade solo lo que has recibido.</p><label className="field">Cantidad comprada ({replenish.unit})<input autoFocus required type="number" min="0.001" max="100000" step="0.001" value={amount} onChange={e=>setAmount(e.target.value)}/></label>{error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><button className="primary" disabled={disabled}>Sumar a la despensa</button></div></form></Modal>}
  </div>;
}
