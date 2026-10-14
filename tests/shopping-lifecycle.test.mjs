import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const domain=await import('data:text/javascript;base64,'+Buffer.from(compile('lib/pantry.ts')).toString('base64'));
const queue=await import('data:text/javascript;base64,'+Buffer.from(compile('lib/quick-queue.ts')).toString('base64'));
const product={id:'rice',name:'Arroz',category:'Pasta, arroz y legumbres',quantity:3,unit:'paquetes',minimum:1,minimumAutomatic:false,manual:false};

test('Borrar desde la despensa conserva el mismo producto solo en próxima compra',()=>{
  const original=[product];
  const next=domain.prepareProducts(domain.removeFromSection(original,product.id,'pantry'));
  assert.equal(next.length,1);
  assert.equal(next[0].id,product.id);
  assert.equal(next[0].quantity,0);
  assert.equal(next[0].shoppingOnly,true);
  assert.equal(next.filter(p=>!p.shoppingOnly).length,0);
  assert.equal(next.filter(domain.needsPurchase).length,1);
  assert.equal(next[0].minimum,1);
  assert.equal(next[0].unit,'paquetes');
  assert.equal(product.quantity,3);
  const reload=domain.prepareProducts(JSON.parse(JSON.stringify(next)));
  assert.equal(reload[0].shoppingOnly,true);
});

test('Borrar desde próxima compra elimina totalmente incluso un aviso automático',()=>{
  const moved=domain.removeFromSection([product],product.id,'pantry');
  assert.equal(domain.removeFromSection(moved,product.id,'shopping').length,0);
  const low={...product,quantity:1};
  assert.equal(domain.needsPurchase(low),true);
  assert.equal(domain.removeFromSection([low],low.id,'shopping').length,0);
  assert.equal(low.quantity,1);
});

test('Reponer con + devuelve a la despensa y restar después no vuelve a ocultarlo',()=>{
  const moved=domain.removeFromSection([product],product.id,'pantry');
  const replenished=queue.applySteps(moved,[{operationId:'one',productId:product.id,delta:1}]);
  assert.equal(replenished[0].quantity,1);
  assert.equal(replenished[0].shoppingOnly,false);
  assert.equal(replenished[0].manual,false);
  const consumed=queue.applySteps(replenished,[{operationId:'two',productId:product.id,delta:-1}]);
  assert.equal(consumed[0].quantity,0);
  assert.equal(consumed[0].shoppingOnly,false);
});

test('Compra pegada y edición de cantidad restauran el producto; deshacer recupera el estado previo',()=>{
  const original=domain.prepareProducts([product]);
  const moved=domain.prepareProducts(domain.removeFromSection(original,product.id,'pantry'));
  const rows=domain.parseList('4 paquetes de arroz',moved);
  assert.equal(rows[0].match,product.id);
  const bought=domain.applyImport(moved,rows,()=> 'duplicate');
  assert.equal(bought.length,1);
  assert.equal(bought[0].quantity,4);
  assert.equal(bought[0].shoppingOnly,false);
  const edited=domain.prepareProduct({...moved[0],quantity:2});
  assert.equal(edited.shoppingOnly,false);
  const undo=domain.prepareProducts(original);
  assert.equal(undo[0].quantity,3);
  assert.equal(undo[0].shoppingOnly,false);
  assert.equal(moved[0].quantity,0);
});
