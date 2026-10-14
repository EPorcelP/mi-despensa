export const categories = ['Verduras', 'Frutas', 'Conservas', 'Lácteos y huevos', 'Carne y pescado', 'Pasta, arroz y legumbres', 'Café y desayuno', 'Bebidas', 'Limpieza y hogar', 'Otros'];
export const units = ['unidades', 'latas', 'bricks', 'paquetes', 'packs', 'botellas', 'botes', 'litros', 'kg'];
export type Product = { id: string; name: string; category: string; quantity: number; unit: string; minimum: number | null; manual: boolean; categoryAutomatic?: boolean; minimumAutomatic?: boolean; shoppingOnly?: boolean };
export type ImportRow = { name: string; quantity: number; unit: string; match: string; category: string; included: boolean; categoryAutomatic?: boolean; source?: string; note?: string; receipt?: { quantity: number; packSize: number; itemUnit: string } };
export const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function titleCase(name: string) {
  return name.toLocaleLowerCase('es-ES').replace(/\p{L}[\p{L}\p{M}]*/gu, word => word[0].toLocaleUpperCase('es-ES') + word.slice(1));
}
export function inferCategory(name: string, unit = ''): string | null {
  const n = normalize(name);
  if (/\b(detergente|lavavajillas|lavaplatos|lejia|limpieza|papel|suavizante|champu|gel|jabon|servilletas|bolsas|estropajo)\b/.test(n)) return 'Limpieza y hogar';
  if (/\b(cocacola|coca cola|pepsi|fanta|aquarius|cerveza|mahou|refresco|agua|zumo|vino|bebida|tonica|sprite|nestea)\b/.test(n)) return 'Bebidas';
  if (/\b(cafe|capsulas|nespresso|nescafe|te|infusion|cacao|galletas|cereales|tostadas|pan|desayuno)\b/.test(n)) return 'Café y desayuno';
  if (/\b(leche|yogur|yogures|queso|mozzarella|mantequilla|nata|danone|huevos|huevo)\b/.test(n)) return 'Lácteos y huevos';
  if (/\b(conserva|conservas|atun|sardinas|mejillones|bonito|tomate frito|tomate triturado|lata|latas|encurtidos|pepinillos|aceitunas)\b/.test(n) || /^(latas?|botes?)$/.test(normalize(unit))) return 'Conservas';
  if (/\b(alcachofas?|zanahorias?|cebollas?|patatas?|tomates?|lechuga|espinacas?|brocoli|calabacin|calabacines|pimientos?|verduras?|guisantes|judias verdes|esparragos|berenjenas?)\b/.test(n)) return 'Verduras';
  if (/\b(manzanas?|peras?|platanos?|naranjas?|mandarinas?|limones?|fresas?|uvas|kiwis?|fruta|melon|sandia)\b/.test(n)) return 'Frutas';
  if (/\b(arroz|pasta|macarrones|espaguetis|lentejas|garbanzos|alubias|legumbres|harina|aceite|sal|azucar)\b/.test(n)) return 'Pasta, arroz y legumbres';
  if (/\b(pollo|carne|ternera|cerdo|pavo|jamon|pescado|salmon|merluza|bacalao|gambas)\b/.test(n)) return 'Carne y pescado';
  if (/\b(detergente|lavavajillas|lavaplatos|lejia|limpieza|papel|suavizante|champu|gel|jabon|servilletas|bolsas|estropajo)\b/.test(n)) return 'Limpieza y hogar';
  return null;
}
export function defaultMinimum(p: Pick<Product, 'name' | 'category' | 'unit'>): number | null {
  if (/\bleche\b/.test(normalize(p.name))) return 2;
  if (p.category === 'Bebidas') return 2;
  if (/\bhuevos?\b/.test(normalize(p.name))) return /^(packs?|paquetes?)$/.test(normalize(p.unit)) ? 1 : 4;
  return p.category === 'Otros' ? null : 1;
}
export function prepareProduct(p: Product): Product {
  const name = titleCase(p.name.trim());
  const categoryAutomatic = p.categoryAutomatic ?? true;
  const category = categoryAutomatic ? (inferCategory(name, p.unit) ?? (categories.includes(p.category) ? p.category : 'Otros')) : p.category;
  const minimumAutomatic = p.minimumAutomatic ?? p.minimum === null;
  const rawMinimum = minimumAutomatic ? defaultMinimum({ name, category, unit: p.unit }) : p.minimum;
  const minimum = rawMinimum === null ? null : Math.round(rawMinimum);
  const quantity = Math.round(p.quantity);
  const shoppingOnly = p.shoppingOnly === true && quantity === 0;
  return { ...p, name, category, quantity, minimum, categoryAutomatic, minimumAutomatic, shoppingOnly };
}
export function prepareProducts(products: Product[]) { return products.map(prepareProduct); }
export function needsPurchase(p: Product) { return p.shoppingOnly || p.manual || p.quantity === 0 || (p.minimum !== null && p.quantity <= p.minimum); }
export function removeFromSection(products: Product[], id: string, section: 'pantry' | 'shopping'): Product[] {
  if (section === 'shopping') return products.filter(p => p.id !== id);
  return products.map(p => p.id === id ? { ...p, quantity: 0, manual: true, shoppingOnly: true } : { ...p });
}

// Reglas locales para abreviaturas: no consultan una API ni una base de códigos EAN.
// El nombre original se conserva en la revisión para comprobar cada propuesta.
type ReceiptRule = { pattern: RegExp; name: string; unit: string; category: string; pack?: RegExp; aliases?: string[]; exclude?: boolean };
const receiptRules: ReceiptRule[] = [
  { pattern: /^agua gas\b/, name: 'Agua Con Gas', unit: 'botellas', category: 'Bebidas' },
  { pattern: /^maiz\b/, name: 'Maíz Dulce', unit: 'latas', category: 'Conservas', pack: /\bx\s*(\d+)\b/ },
  { pattern: /^cv m clasica\b/, name: 'Cerveza Mahou Clásica', unit: 'unidades', category: 'Bebidas', pack: /(\d+)\s*x\s*\d+/ },
  { pattern: /^(?:ccola|coca cola|cocacola) zero\b/, name: 'Coca-Cola Zero', unit: 'unidades', category: 'Bebidas', pack: /\bp\s+(\d+)\b/ },
  { pattern: /^(?:cocacola|coca cola|ccola) reg\b/, name: 'Coca-Cola Normal', unit: 'unidades', category: 'Bebidas', pack: /(\d+)\s*x\s*\d+/ },
  { pattern: /^lent pardi\b/, name: 'Lentejas Pardinas', unit: 'paquetes', category: 'Pasta, arroz y legumbres' },
  { pattern: /^c mol mez\b/, name: 'Café Molido Mezcla', unit: 'paquetes', category: 'Café y desayuno', aliases: ['Café'] },
  { pattern: /^(?:agua|ag) lanjaron\b/, name: 'Agua Lanjarón', unit: 'botellas', category: 'Bebidas' },
  { pattern: /^des tub\b/, name: 'Des. Tub Crf 1 L', unit: 'botellas', category: 'Limpieza y hogar', exclude: true },
  { pattern: /^leche entera\b/, name: 'Leche Entera', unit: 'bricks', category: 'Lácteos y huevos' },
  { pattern: /^garb coc\b/, name: 'Garbanzos Cocidos', unit: 'botes', category: 'Conservas' },
  { pattern: /^ac girasol\b/, name: 'Aceite De Girasol', unit: 'botellas', category: 'Pasta, arroz y legumbres' },
  { pattern: /^mayone\b/, name: 'Mayonesa', unit: 'botes', category: 'Otros' },
  { pattern: /^alcach\b/, name: 'Alcachofas', unit: 'botes', category: 'Conservas' },
  { pattern: /^judia ver\b/, name: 'Judías Verdes', unit: 'botes', category: 'Conservas' },
  { pattern: /^arroz\b/, name: 'Arroz', unit: 'paquetes', category: 'Pasta, arroz y legumbres' },
  { pattern: /^ac s h ng\b/, name: 'Aceitunas Negras Sin Hueso', unit: 'botes', category: 'Conservas' },
  { pattern: /^zum d simon nar\b/, name: 'Zumo De Naranja Don Simón', unit: 'bricks', category: 'Bebidas' },
  { pattern: /^pan cere n gl\b/, name: 'Pan De Cereales Sin Gluten', unit: 'paquetes', category: 'Café y desayuno' },
  { pattern: /^atun claro\b/, name: 'Atún Claro', unit: 'latas', category: 'Conservas', pack: /(\d+)\s*x\s*\d+/ },
  { pattern: /^esp blncs\b/, name: 'Espárragos Blancos', unit: 'botes', category: 'Conservas' },
  { pattern: /^cald cocid gb\b/, name: 'Caldo De Cocido Gallina Blanca', unit: 'bricks', category: 'Conservas', pack: /(\d+)\s*x\s*\d+/ },
];
const isPackUnit = (unit: string) => /^(packs?|paquetes?)$/.test(normalize(unit));
const sameUnit = (a: string, b: string) => normalize(a).replace(/s$/, '') === normalize(b).replace(/s$/, '');
const isContainerUnit = (unit: string) => /^(unidades?|latas?|botellas?|botellines?|bricks?|botes?)$/.test(normalize(unit));

export function matchImportProduct(row: ImportRow, product?: Product): ImportRow {
  if (!row.receipt) return { ...row, match: product?.id ?? '', ...(product ? { name: product.name, unit: product.unit, category: product.category, categoryAutomatic: product.categoryAutomatic ?? true } : {}) };
  const receipt = row.receipt;
  const unit = product?.unit ?? receipt.itemUnit;
  const packed = receipt.packSize > 1 && isPackUnit(unit);
  const compatible = packed || sameUnit(unit, receipt.itemUnit) || normalize(unit) === 'unidades' || (isContainerUnit(unit) && isContainerUnit(receipt.itemUnit));
  const proposedQuantity = compatible ? receipt.quantity * (packed ? 1 : receipt.packSize) : NaN;
  const quantity = Number.isInteger(proposedQuantity) ? proposedQuantity : NaN;
  const note = !compatible
    ? 'Las unidades son diferentes. Escribe la cantidad que añadirás en la unidad de tu despensa.'
    : !Number.isInteger(proposedQuantity)
      ? 'El ticket indica una cantidad fraccionada. Escribe cuántos envases o unidades enteras añadirás.'
    : receipt.packSize > 1
      ? `${receipt.quantity} packs × ${receipt.packSize} = ${receipt.quantity * receipt.packSize} unidades. ${packed ? 'Se suman packs completos.' : 'Se suman las unidades interiores.'}`
      : 'Cantidad de la columna CANTIDAD. Revisa el nombre propuesto y el envase.';
  return { ...row, match: product?.id ?? '', quantity, unit, note, ...(product ? { name: product.name, category: product.category, categoryAutomatic: product.categoryAutomatic ?? true } : {}) };
}

function parseReceiptLine(line: string, products: Product[]): ImportRow {
  // EAN + descripción + cantidad + cinco columnas económicas. Nunca se usa el EAN como cantidad.
  const columns = line.match(/^(\d{8,14})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(?:-?\d+(?:[.,]\d+)?\s+){4}-?\d+(?:[.,]\d+)?$/);
  if (!columns) return { name: titleCase(line.replace(/^\d{8,14}\s+/, '')).slice(0, 120), quantity: NaN, unit: 'unidades', match: '', category: 'Otros', included: false, source: line, note: 'No se pudo separar esta línea del ticket. Corrige el nombre y la cantidad para incluirla.' };
  const description = columns[2];
  const quantity = Number(columns[3].replace(',', '.'));
  const normalized = normalize(description);
  const rule = receiptRules.find(r => r.pattern.test(normalized));
  const packMatch = rule?.pack?.exec(normalized);
  const packSize = packMatch ? Number(packMatch[1]) : 1;
  const name = titleCase(rule?.name ?? description);
  const itemUnit = rule?.unit ?? 'unidades';
  let row: ImportRow = { name, quantity: quantity * packSize, unit: itemUnit, match: '', category: rule?.category ?? inferCategory(name, itemUnit) ?? 'Otros', included: quantity > 0 && !rule?.exclude, categoryAutomatic: false, source: line, receipt: { quantity, packSize, itemUnit } };
  const aliases = [name, ...(rule?.aliases ?? [])].map(normalize);
  const candidates = products.filter(p => aliases.includes(normalize(p.name)));
  // No se unen sabores, tamaños o variedades mediante coincidencias aproximadas.
  const existing = candidates.length === 1 ? candidates[0] : undefined;
  row = matchImportProduct(row, existing);
  if (!rule) row.note = `${row.note} Abreviatura sin reconocer: conservamos el texto del ticket. Revisa producto y packs.`;
  if (rule?.exclude) row.note = 'Producto de limpieza: desmarcado por defecto. Puedes incluirlo si lo guardas en tu despensa.';
  return row;
}

export function parseList(text: string, products: Product[]): ImportRow[] {
  const lines = text.split(/\r?\n/).map(s => s.trim().replace(/^[•*-]\s*/, '')).filter(Boolean);
  if (lines.some(line => /^\d{8,14}\s+/.test(line))) return lines.filter(line => /^\d{8,14}\s+/.test(line)).slice(0, 200).map(line => parseReceiptLine(line, products));
  return lines.slice(0, 200).map(line => {
    let quantity = 1, name = line, unit = 'unidades';
    const start = line.match(/^(\d+(?:[.,]\d+)?)\s*(?:x\s+|[×]\s*)?(.+)$/i);
    const end = line.match(/^(.+?)\s*(?:—|:|\s[x×]\s|\s-\s)\s*(\d+(?:[.,]\d+)?)\s*(.*)$/i);
    if (start) { quantity = Number(start[1].replace(',', '.')); name = start[2].trim(); }
    else if (end) { name = end[1].trim(); quantity = Number(end[2].replace(',', '.')); unit = end[3].trim() || unit; }
    const unitMatch = name.match(/^(unidades?|latas?|bricks?|paquetes?|packs?|botellas?|botes?|litros?|kg)\s+(?:de\s+)?(.+)$/i);
    if (unitMatch) { unit = unitMatch[1].toLowerCase(); name = unitMatch[2]; }
    const existing = products.find(p => normalize(p.name) === normalize(name));
    return { name: titleCase(name), quantity: Number.isInteger(quantity) ? quantity : NaN, unit: existing?.unit ?? unit, match: existing?.id ?? '', category: existing?.category ?? inferCategory(name, unit) ?? 'Otros', included: true, categoryAutomatic: existing?.categoryAutomatic ?? true, ...(!Number.isInteger(quantity) ? {source: line, note: 'Escribe una cantidad entera de envases o unidades antes de guardar.'} : {}) };
  });
}
export function applyImport(products: Product[], rows: ImportRow[], newId: () => string): Product[] {
  const result = prepareProducts(products).map(p => ({ ...p }));
  for (const row of rows.filter(r => r.included)) {
    const existing = result.find(p => row.match ? p.id === row.match : normalize(p.name) === normalize(row.name));
    if (!Number.isInteger(row.quantity) || row.quantity <= 0 || row.quantity > 100000) throw new Error(`Revisa la cantidad de ${row.name}: utiliza un número entero.`);
    if (row.receipt && existing && !sameUnit(existing.unit, row.unit)) throw new Error(`Revisa la unidad de ${row.name}: tu despensa cuenta ${existing.unit}.`);
    if (existing) { existing.quantity += row.quantity; existing.manual = false; existing.shoppingOnly = false; }
    else result.push(prepareProduct({ id: newId(), name: row.name.trim(), category: row.category, quantity: row.quantity, unit: row.unit || 'unidades', minimum: null, manual: false, categoryAutomatic: row.categoryAutomatic ?? true }));
  }
  return prepareProducts(result);
}
