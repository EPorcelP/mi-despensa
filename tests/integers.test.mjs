import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022}}).outputText;
const domain = await import('data:text/javascript;base64,' + Buffer.from(compile('lib/pantry.ts')).toString('base64'));
const queue = await import('data:text/javascript;base64,' + Buffer.from(compile('lib/quick-queue.ts')).toString('base64'));
const product = {id:'milk',name:'Leche Entera',quantity:2,unit:'bricks',category:'Lácteos y huevos',minimum:2,manual:false,minimumAutomatic:false};

test('Cantidades y mínimos antiguos fraccionados pasan al entero más cercano sin mutar el original', () => {
  const old = {...product,quantity:2.001,minimum:1.999};
  const normalized = domain.prepareProduct(old);
  assert.equal(normalized.quantity, 2);
  assert.equal(normalized.minimum, 2);
  assert.equal(old.quantity, 2.001);
  assert.equal(domain.prepareProduct({...product,minimum:null,minimumAutomatic:false}).minimum,null);
});

test('Las compras no redondean cantidades fraccionadas: exigen corregirlas antes de sumar', () => {
  const rows = domain.parseList('1,5 bricks de leche entera', [product]);
  assert.ok(Number.isNaN(rows[0].quantity));
  assert.match(rows[0].note,/entera/);
  assert.throws(() => domain.applyImport([product], rows, () => 'new'), /número entero/);
  const corrected = [{...rows[0],quantity:2}];
  assert.equal(domain.applyImport([product], corrected, () => 'new')[0].quantity,4);
  assert.equal(product.quantity,2);
});

test('El formato decimal de ticket 12,000 sigue siendo entero; el peso fraccionado requiere revisión', () => {
  const whole = domain.parseList('8431876159905 AGUA GAS CRF 50 CL 12,000 3,12 0,00 3,12 2,84 10,00',[])[0];
  assert.equal(whole.quantity,12);
  const fractional = domain.parseList('8431876159905 AGUA GAS CRF 50 CL 0,500 3,12 0,00 3,12 2,84 10,00',[])[0];
  assert.ok(Number.isNaN(fractional.quantity));
  assert.match(fractional.note,/fraccionada/);
  assert.throws(() => domain.applyImport([], [fractional], () => 'new'), /número entero/);
});

test('Sumar y restar mantienen los enteros incluso si existían decimales antiguos', () => {
  const old = {...product,quantity:2.001};
  assert.equal(queue.applySteps([old],[{operationId:'one',productId:'milk',delta:1}])[0].quantity,3);
  assert.equal(queue.applySteps([old],[{operationId:'one',productId:'milk',delta:-1}])[0].quantity,1);
  assert.equal(queue.applySteps([{...product,quantity:0}],[{operationId:'one',productId:'milk',delta:-1}])[0].quantity,0);
});
