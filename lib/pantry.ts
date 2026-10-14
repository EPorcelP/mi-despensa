export const categories = ['Verduras', 'Frutas', 'Conservas', 'Lácteos y huevos', 'Carne y pescado', 'Pasta, arroz y legumbres', 'Café y desayuno', 'Bebidas', 'Limpieza y hogar', 'Otros'];
export const units = ['unidades', 'latas', 'bricks', 'paquetes', 'packs', 'botellas', 'botes', 'litros', 'kg'];
export type Product = { id: string; name: string; category: string; quantity: number; unit: string; minimum: number | null; manual: boolean; categoryAutomatic?: boolean; minimumAutomatic?: boolean };
export type ImportRow = { name: string; quantity: number; unit: string; match: string; category: string; included: boolean; categoryAutomatic?: boolean };
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
  const minimum = minimumAutomatic ? defaultMinimum({ name, category, unit: p.unit }) : p.minimum;
  return { ...p, name, category, minimum, categoryAutomatic, minimumAutomatic };
}
export function prepareProducts(products: Product[]) { return products.map(prepareProduct); }
export function needsPurchase(p: Product) { return p.manual || p.quantity === 0 || (p.minimum !== null && p.quantity <= p.minimum); }
export function parseList(text: string, products: Product[]): ImportRow[] {
  return text.split(/\r?\n/).map(s => s.trim().replace(/^[•*-]\s*/, '')).filter(Boolean).slice(0, 200).map(line => {
    let quantity = 1, name = line, unit = 'unidades';
    const start = line.match(/^(\d+(?:[.,]\d+)?)\s*(?:x\s+|[×]\s*)?(.+)$/i);
    const end = line.match(/^(.+?)\s*(?:—|:|\s[x×]\s|\s-\s)\s*(\d+(?:[.,]\d+)?)\s*(.*)$/i);
    if (start) { quantity = Number(start[1].replace(',', '.')); name = start[2].trim(); }
    else if (end) { name = end[1].trim(); quantity = Number(end[2].replace(',', '.')); unit = end[3].trim() || unit; }
    const unitMatch = name.match(/^(unidades?|latas?|bricks?|paquetes?|packs?|botellas?|botes?|litros?|kg)\s+(?:de\s+)?(.+)$/i);
    if (unitMatch) { unit = unitMatch[1].toLowerCase(); name = unitMatch[2]; }
    const existing = products.find(p => normalize(p.name) === normalize(name));
    return { name: titleCase(name), quantity, unit: existing?.unit ?? unit, match: existing?.id ?? '', category: existing?.category ?? inferCategory(name, unit) ?? 'Otros', included: true, categoryAutomatic: existing?.categoryAutomatic ?? true };
  });
}
export function applyImport(products: Product[], rows: ImportRow[], newId: () => string): Product[] {
  const result = products.map(p => ({ ...p }));
  for (const row of rows.filter(r => r.included)) {
    const existing = result.find(p => row.match ? p.id === row.match : normalize(p.name) === normalize(row.name));
    if (existing) { existing.quantity = Math.round((existing.quantity + row.quantity) * 1000) / 1000; existing.manual = false; }
    else result.push(prepareProduct({ id: newId(), name: row.name.trim(), category: row.category, quantity: row.quantity, unit: row.unit || 'unidades', minimum: null, manual: false, categoryAutomatic: row.categoryAutomatic ?? true }));
  }
  return prepareProducts(result);
}
