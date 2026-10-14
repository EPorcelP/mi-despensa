import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const session=await import('data:text/javascript;base64,'+Buffer.from(compile('lib/session.ts')).toString('base64'));
const domain=await import('data:text/javascript;base64,'+Buffer.from(compile('lib/pantry.ts')).toString('base64'));
const queueModule=await import('data:text/javascript;base64,'+Buffer.from(compile('lib/quick-queue.ts')).toString('base64'));
test('Sesión: contraseña, firma, caducidad y revocación al cambiar contraseña',()=>{
  process.env.SESSION_SECRET='a'.repeat(64);process.env.DESPENSA_PASSWORD='UnaClaveDePrueba-123!';
  assert.equal(session.validPassword('incorrecta'),false);assert.equal(session.validPassword('UnaClaveDePrueba-123!'),true);
  const now=1700000000000,token=session.createSession(now);
  assert.equal(session.verifySession(token,now),true);assert.equal(session.verifySession(token+'x',now),false);
  assert.equal(session.verifySession(token,now+(session.SESSION_SECONDS+1)*1000),false);
  process.env.DESPENSA_PASSWORD='OtraClaveDePrueba-456!';assert.equal(session.verifySession(token,now),false);
});
test('Una compra suma stock; categorías y mínimos siguen el funcionamiento validado',()=>{
  const p=domain.prepareProduct({id:'milk',name:'leche entera',category:'Otros',quantity:2,unit:'bricks',minimum:null,manual:false});
  assert.equal(p.name,'Leche Entera');assert.equal(p.minimum,2);assert.equal(domain.needsPurchase(p),true);
  const next=domain.applyImport([p],domain.parseList('6 bricks de leche entera',[p]),()=> 'new');
  assert.equal(next[0].quantity,8);assert.equal(p.quantity,2);assert.equal(domain.needsPurchase(next[0]),false);
  assert.equal(domain.inferCategory('cocacola'),'Bebidas');
});
test('La cola conserva los toques hechos mientras guarda y reutiliza IDs al reintentar',async()=>{
  const p={id:'rice',name:'Arroz',quantity:2,category:'Otros',unit:'paquetes',minimum:null,manual:false};
  let resolve,latest,calls=[];
  const queue=new queueModule.QuickQueue(ops=>{calls.push(ops);return new Promise(r=>resolve=r);},s=>latest=s,()=>{});
  queue.reset({version:0,products:[p]});queue.add({operationId:'one',productId:'rice',delta:1});
  const pending=queue.flush();queue.add({operationId:'two',productId:'rice',delta:1});assert.equal(latest.products[0].quantity,4);
  resolve({version:1,products:[{...p,quantity:3}]});await pending;assert.equal(latest.products[0].quantity,4);
  resolve({version:2,products:[{...p,quantity:4}]});await new Promise(r=>setTimeout(r,0));assert.equal(queue.pending.length,0);
  let tries=0,ids=[];const retry=new queueModule.QuickQueue(async ops=>{ids.push(ops[0].operationId);if(tries++===0)throw Error('offline');return{version:1,products:[{...p,quantity:3}]};},()=>{},()=>{});
  retry.reset({version:0,products:[p]});retry.add({operationId:'stable',productId:'rice',delta:1});await retry.flush();await retry.flush();assert.deepEqual(ids,['stable','stable']);
});

const originModule=await import('data:text/javascript;base64,'+Buffer.from(compile('lib/origin.ts')).toString('base64'));
test('Origen: localhost, subdominio real y rechazo de sitios externos',()=>{
  assert.equal(originModule.sameOrigin(new Request('http://localhost:3000/api',{headers:{origin:'http://localhost:3000'}})),true);
  assert.equal(originModule.sameOrigin(new Request('http://localhost:3000/api',{headers:{origin:'https://despensa.example.com',host:'despensa.example.com'}})),true);
  assert.equal(originModule.sameOrigin(new Request('https://despensa.example.com/api',{headers:{origin:'https://otro.example.com',host:'despensa.example.com'}})),false);
  assert.equal(originModule.sameOrigin(new Request('https://despensa.example.com/api')),false);
});
