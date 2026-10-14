import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(fs.readFileSync('lib/pantry.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const domain = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const ticket = fs.readFileSync('tests/ticket-ejemplo.txt', 'utf8');
const product = (name, unit, quantity = 2) => ({ id: name, name, unit, quantity, category: 'Otros', minimum: null, manual: false });

test('Ticket completo: 23 artículos, sin importar cabecera, precios ni EAN como cantidades', () => {
  const rows = domain.parseList(ticket, []);
  assert.equal(rows.length, 23);
  assert.equal(rows.filter(r => r.included).length, 22);
  assert.deepEqual(rows.map(r => r.quantity), [12, 18, 12, 12, 2, 2, 18, 20, 1, 16, 30, 6, 4, 2, 3, 4, 2, 6, 5, 1, 36, 3, 4]);
  assert.equal(rows[1].name, 'Maíz Dulce');
  assert.equal(rows[20].name, 'Atún Claro');
  assert.equal(rows[8].included, false);
  assert.equal(rows[8].category, 'Limpieza y hogar');
  assert.ok(rows.every(r => r.source && r.note));
});

test('Un pack no se suma como doce packs: respeta las unidades del inventario', () => {
  const beer = product('Cerveza Mahou Clásica', 'packs');
  const milk = product('Leche Entera', 'bricks', 6);
  const rice = product('Arroz', 'unidades', 5);
  const rows = domain.parseList(ticket, [beer, milk, rice]);
  assert.equal(rows[2].match, beer.id);
  assert.equal(rows[2].quantity, 1);
  assert.equal(rows[2].unit, 'packs');
  assert.equal(rows[9].match, milk.id);
  assert.equal(rows[9].quantity, 16);
  assert.equal(rows[16].match, rice.id);
  const next = domain.applyImport([beer, milk, rice], rows, (() => { let n = 0; return () => String(n++); })());
  assert.equal(next.find(p => p.id === beer.id).quantity, 3);
  assert.equal(next.find(p => p.id === milk.id).quantity, 22);
  assert.equal(next.find(p => p.id === rice.id).quantity, 7);
});

test('Las equivalencias ambiguas se revisan y las unidades incompatibles bloquean el guardado', () => {
  const rows = domain.parseList(ticket, [product('Coca-Cola Pequeñas', 'latas'), product('Atún Claro En Aceite De Girasol', 'latas')]);
  assert.equal(rows[3].match, '');
  assert.equal(rows[20].match, '');
  const litres = product('Agua Lanjarón', 'litros');
  const withLitres = domain.parseList(ticket, [litres]);
  assert.equal(withLitres[6].match, litres.id);
  assert.ok(Number.isNaN(withLitres[6].quantity));
  assert.throws(() => domain.applyImport([litres], [withLitres[6]], () => 'new'), /Revisa la cantidad/);
  const maize = rows[1];
  assert.equal(domain.matchImportProduct(maize, product('Maíz', 'packs')).quantity, 6);
  assert.equal(domain.matchImportProduct(maize, product('Maíz', 'latas')).quantity, 18);
});

test('Abreviaturas desconocidas y líneas rotas se conservan para revisión', () => {
  const rows = domain.parseList('EAN DESCRIPCIÓN CANTIDAD\n1234567890123 PROD NUEVO X4 2,000 8,00 0,00 8,00 7,27 10,00\n1234567890124 LINEA INCOMPLETA\nTOTAL 8,00', []);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].quantity, 2);
  assert.equal(rows[0].name, 'Prod Nuevo X4');
  assert.match(rows[0].note, /sin reconocer/);
  assert.equal(rows[1].included, false);
  assert.ok(Number.isNaN(rows[1].quantity));
  assert.ok(rows[1].source.includes('LINEA INCOMPLETA'));
});

test('Las listas sencillas siguen funcionando y agrupan productos repetidos', () => {
  const milk = product('Leche Entera', 'bricks', 2);
  const rows = domain.parseList('6 bricks de leche entera\n2 bricks de leche entera', [milk]);
  assert.equal(rows.length, 2);
  assert.equal(domain.applyImport([milk], rows, () => 'new')[0].quantity, 10);
});
