import { type Product } from './pantry';
export type QuantityOperation = { operationId: string; productId: string; delta: 1 | -1 };
export type PantrySnapshot = { version: number; products: Product[] };
export function applySteps(products: Product[], operations: QuantityOperation[]): Product[] {
  const result = products.map(p=>({...p}));
  for (const op of operations) {
    const p = result.find(p=>p.id===op.productId);
    if (p) { p.quantity = Math.min(100000,Math.max(0,Math.round(p.quantity)+op.delta)); if (op.delta>0) { p.manual=false; p.shoppingOnly=false; } }
  }
  return result;
}
export class QuickQueue {
  base: PantrySnapshot = {version:0,products:[]};
  pending: QuantityOperation[] = [];
  running = false;
  failed = false;
  timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private send: (ops: QuantityOperation[])=>Promise<PantrySnapshot>, private update: (data: PantrySnapshot, pending: boolean)=>void, private fail: (message: string)=>void) {}
  reset(snapshot: PantrySnapshot) { if(this.pending.length || this.running)return; this.base=snapshot; this.failed=false; this.emit(); }
  emit() { this.update({version:this.base.version, products:applySteps(this.base.products,this.pending)},this.pending.length>0); }
  add(op: QuantityOperation) { this.pending.push(op);this.emit();if(!this.timer && !this.running && !this.failed)this.timer=setTimeout(()=>{this.timer=null;void this.flush();},150); }
  async flush() {
    if(this.running || !this.pending.length)return;
    this.running=true;this.failed=false;
    const batch=this.pending.slice(0,30);
    try { this.base=await this.send(batch);this.pending.splice(0,batch.length);this.emit(); }
    catch(e) { this.failed=true;this.fail(e instanceof Error?e.message:'No se pudo guardar. Pulsa Reintentar.'); }
    finally {this.running=false;}
    if(this.pending.length && !this.failed)void this.flush();
  }
}
