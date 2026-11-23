import * as XLSX from 'xlsx';

/**
 * Tuple layout kept backward-compatible with localStorage('so') and JSON backups:
 * [0] product, [1] unit, [2] systemStock, [3] opnameStock,
 * [4] diffQty, [5] valuePerUnit, [6] diffValue, [7] additionalInfo,
 * [8]? category, [9]? branch,
 * [10]? opnameNumber, [11]? location, [12]? purpose,
 * [13]? productCode, [14]? subcategory, [15]? status
 */
export type StockRow = [
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  string,
  string?,
  string?,
  string?,
  string?,
  string?,
  string?,
  string?,
  string?
];

export type StockDataset = Record<string, StockRow[]>;

export function sanitizeDataset(raw: unknown): StockDataset {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const clean: StockDataset = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Array.isArray(val)) {
      clean[key] = val.filter(
        (row): row is StockRow => Array.isArray(row) && row.length >= 7
      );
    }
  }
  return clean;
}

interface ConversionRule {
  baseUnit: string;
  dosMultiplier: number;
  packLabel: string;
  otherUnits?: Record<string, number>;
}

export type CanonicalUnit =
  | 'dus'
  | 'ball'
  | 'jerigen'
  | 'galon'
  | 'pack'
  | 'slop'
  | 'botol'
  | 'porsi'
  | 'pcs'
  | 'kg'
  | 'gram'
  | 'liter'
  | 'ml';

export interface ItemPackagingSpec {
  name: string;
  specText: string;
  unitRatios?: Partial<Record<CanonicalUnit, number>>;
  displayOrder?: CanonicalUnit[];
}

const CANONICAL_UNIT_LABELS: Record<CanonicalUnit, string> = {
  dus: 'Dus',
  ball: 'Ball',
  jerigen: 'Jerigen',
  galon: 'Galon',
  pack: 'Pack',
  slop: 'Slop',
  botol: 'Botol',
  porsi: 'Porsi',
  pcs: 'Pcs',
  kg: 'Kg',
  gram: 'Gram',
  liter: 'Liter',
  ml: 'ml',
};

export function normalizeItemLookupKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s*\)\s*/g, ') ')
    .replace(/\s*@\s*/g, ' @')
    .replace(/\s*\/\s*/g, '/')
    .replace(/(\d)\s+(oz|ml|kg|gr|gram|l)\b/gi, '$1$2')
    .replace(/papper/g, 'paper')
    .replace(/\s+/g, ' ')
    .trim();
}

export const ITEM_PACKAGING_CATALOG: ItemPackagingSpec[] = [
  {
    name: 'Air Mineral Botol',
    specText: '1 dus 24 botol',
    unitRatios: { botol: 1, pcs: 1, dus: 24 },
    displayOrder: ['dus', 'botol'],
  },
  {
    name: 'Beras',
    specText: '1 pack 10 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 10000 },
    displayOrder: ['pack', 'kg'],
  },
  {
    name: 'DBL - Ayam Potong Dadu',
    specText: '1 dus 10 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 10000 },
    displayOrder: ['dus', 'pack'],
  },
  {
    name: 'DBL - Ayam WFC 1.1',
    specText:
      '1 dus 10 pack (5 pack ayam besar @10 porsi & 5 pack ayam kecil @8 porsi), total 1 dus = 90 porsi',
    unitRatios: { porsi: 1, pack: 9, dus: 90 },
    displayOrder: ['dus', 'pack', 'porsi'],
  },
  {
    name: 'DBL - Cabai Rawit',
    specText: '1 dus 10 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 10000 },
    displayOrder: ['dus', 'pack'],
  },
  {
    name: 'DBL - Sayap',
    specText: '1 dus 10 pack, 1 pack 5 porsi, 1 porsi 2 pcs',
    unitRatios: { pcs: 1, porsi: 2, pack: 10, dus: 100 },
    displayOrder: ['dus', 'pack', 'porsi', 'pcs'],
  },
  {
    name: 'Fresh Milk',
    specText: '1 botol 1000 ml',
    unitRatios: { ml: 1, liter: 1000, botol: 1000 },
    displayOrder: ['botol', 'liter'],
  },
  {
    name: 'Gelato',
    specText: 'Satuan sesuai unit laporan',
  },
  {
    name: 'Kecap Manis',
    specText: '1 dus 3 jerigen, 1 jerigen 7 liter',
    unitRatios: {
      ml: 1,
      gram: 1,
      liter: 1000,
      kg: 1000,
      jerigen: 7000,
      dus: 21000,
    },
    displayOrder: ['dus', 'jerigen', 'liter'],
  },
  {
    name: 'Minyak Goreng',
    specText: '1 dus 18 liter',
    unitRatios: { ml: 1, liter: 1000, jerigen: 18000, dus: 18000 },
    displayOrder: ['dus', 'liter'],
  },
  {
    name: 'SKM Carnation @2Kg',
    specText: '1 dus 8 pack, 1 pack 2 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 2000, dus: 16000 },
    displayOrder: ['dus', 'pack', 'kg'],
  },
  {
    name: 'Tong Tji Super Jasmine Tea',
    specText: '1 ball 50 pack, 1 pack 80 gram',
    unitRatios: { gram: 1, pack: 80, kg: 1000, ball: 4000 },
    displayOrder: ['ball', 'pack', 'kg'],
  },
  {
    name: 'Telur Ayam',
    specText: '1 pcs 60 gram',
    unitRatios: { gram: 1, pcs: 60, kg: 1000 },
    displayOrder: ['pcs', 'kg'],
  },
  {
    name: 'Tepung WizzChick (Tepung Krispi)',
    specText: '1 dus 14 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 14000 },
    displayOrder: ['dus', 'pack'],
  },
  {
    name: 'WIP - Adonan Pangsit',
    specText: '1 dus 6 pack, 1 pack 2 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 2000, dus: 12000 },
    displayOrder: ['dus', 'pack', 'kg'],
  },
  {
    name: 'WIP - Ayam Tabur',
    specText: '1 dus 9 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 9000 },
    displayOrder: ['dus', 'pack'],
  },
  {
    name: 'WIP - Bola Keju',
    specText: '1 dus 14 pack, 1 pack 10 porsi, 1 porsi 3 pcs',
    unitRatios: { pcs: 1, porsi: 3, pack: 30, dus: 420 },
    displayOrder: ['dus', 'pack', 'porsi', 'pcs'],
  },
  {
    name: 'WIP - Bumbu Mie',
    specText: '1 dus 12 botol, 1 botol 1000 ml',
    unitRatios: { ml: 1, liter: 1000, botol: 1000, dus: 12000 },
    displayOrder: ['dus', 'botol'],
  },
  {
    name: 'WIP - Ceker',
    specText: '1 dus 10 pack, 1 pack 10 porsi, 1 porsi 3 pcs',
    unitRatios: { pcs: 1, porsi: 3, pack: 30, dus: 300 },
    displayOrder: ['dus', 'pack', 'porsi', 'pcs'],
  },
  {
    name: 'WIP - Ebi Furai (New)',
    specText: '1 dus 12 pack, 1 pack 5 porsi, 1 porsi 15 pcs',
    unitRatios: { pcs: 1, porsi: 15, pack: 75, dus: 900 },
    displayOrder: ['dus', 'pack', 'porsi', 'pcs'],
  },
  {
    name: 'WIP - Kulit Pangsit',
    specText: '1 dus 20 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 20000 },
    displayOrder: ['dus', 'pack'],
  },
  {
    name: 'WIP - Kulit Udang Rambutan',
    specText: '1 dus 12 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 12000 },
    displayOrder: ['dus', 'pack'],
  },
  {
    name: 'WIP - Lumpia Ayam',
    specText: '1 dus 13 pack, 1 pack 10 porsi, 1 porsi 3 pcs',
    unitRatios: { pcs: 1, porsi: 3, pack: 30, dus: 390 },
    displayOrder: ['dus', 'pack', 'porsi', 'pcs'],
  },
  {
    name: 'WIP - Lumpia Udang',
    specText: '1 dus 11 pack, 1 pack 10 porsi, 1 porsi 3 pcs',
    unitRatios: { pcs: 1, porsi: 3, pack: 30, dus: 330 },
    displayOrder: ['dus', 'pack', 'porsi', 'pcs'],
  },
  {
    name: 'WIP - Mie',
    specText: '1 dus 8 pack, 1 pack 20 pcs',
    unitRatios: { pcs: 1, porsi: 1, pack: 20, dus: 160 },
    displayOrder: ['dus', 'pack', 'pcs'],
  },
  {
    name: 'WIP - Pao Ayam',
    specText: '1 dus 7 pack, 1 pack 10 porsi, 1 porsi 3 pcs',
    unitRatios: { pcs: 1, porsi: 3, pack: 30, dus: 210 },
    displayOrder: ['dus', 'pack', 'porsi', 'pcs'],
  },
  {
    name: 'WIP - Sambal Horeg',
    specText: '1 dus 12 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 12000 },
    displayOrder: ['dus', 'pack'],
  },
  {
    name: 'WIP - Siomay',
    specText: '1 dus 14 pack, 1 pack 10 porsi, 1 porsi 3 pcs',
    unitRatios: { pcs: 1, porsi: 3, pack: 30, dus: 420 },
    displayOrder: ['dus', 'pack', 'porsi', 'pcs'],
  },
  {
    name: 'WIP - Udang Keju',
    specText: '1 dus 12 pack, 1 pack 10 porsi, 1 porsi 3 pcs',
    unitRatios: { pcs: 1, porsi: 3, pack: 30, dus: 360 },
    displayOrder: ['dus', 'pack', 'porsi', 'pcs'],
  },
  {
    name: 'WIP - Udang Rambutan',
    specText: '1 dus 14 pack, 1 pack 10 porsi, 1 porsi 3 pcs',
    unitRatios: { pcs: 1, porsi: 3, pack: 30, dus: 420 },
    displayOrder: ['dus', 'pack', 'porsi', 'pcs'],
  },
  { name: 'Air Galon', specText: 'Satuan Galon' },
  {
    name: 'Akeo Galon@19L',
    specText: '1 galon beratnya 12,8 kg (19 Liter)',
    unitRatios: { gram: 1, kg: 1000, galon: 12800 },
    displayOrder: ['galon', 'kg'],
  },
  {
    name: 'Avocado Powder',
    specText: '1 dus 12 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 12000 },
    displayOrder: ['dus', 'pack'],
  },
  { name: 'Balon (Birthday)', specText: 'Satuan Pcs' },
  { name: 'Balon (WizzChicken)', specText: 'Satuan Pcs' },
  { name: 'Bawang Merah', specText: 'Satuan Kg / Gram' },
  {
    name: 'Biji Wijen',
    specText: '1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000 },
    displayOrder: ['pack', 'kg'],
  },
  { name: 'Botol (Birthday)', specText: 'Satuan Pcs / Botol' },
  { name: 'Buah Apel', specText: 'Satuan Kg / Gram' },
  { name: 'Buah Belimbing / Kiwi', specText: 'Satuan Kg / Gram' },
  { name: 'Buah Leci', specText: 'Satuan Kaleng / Gram' },
  { name: 'Bumbu Basic (WPU)', specText: 'Satuan Kg / Gram' },
  {
    name: 'Bungkus Dimsum / Sushi',
    specText: '1 pack 240 pcs',
    unitRatios: { pcs: 1, pack: 240 },
    displayOrder: ['pack', 'pcs'],
  },
  {
    name: 'Bungkus Mie / Rice Bowl',
    specText: '1 pack 120 pcs',
    unitRatios: { pcs: 1, pack: 120 },
    displayOrder: ['pack', 'pcs'],
  },
  {
    name: 'Cappucino Powder',
    specText: '1 dus 12 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 12000 },
    displayOrder: ['dus', 'pack'],
  },
  { name: 'Caramel Powder', specText: 'Satuan Pack / Kg / Gram' },
  {
    name: 'Chocolate Powder',
    specText: '1 dus 12 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 12000 },
    displayOrder: ['dus', 'pack'],
  },
  {
    name: 'Coffee Bean (Roasted)',
    specText: '1 dus 8 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 8000 },
    displayOrder: ['dus', 'pack'],
  },
  {
    name: 'Cone ( Gelato )',
    specText: '1 dus 25 pack, 1 pack 10 pcs',
    unitRatios: { pcs: 1, pack: 10, dus: 250 },
    displayOrder: ['dus', 'pack', 'pcs'],
  },
  {
    name: 'Crabstik',
    specText: '1 dus 12 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 12000 },
    displayOrder: ['dus', 'pack'],
  },
  { name: 'Cuka Dixi', specText: 'Satuan Botol / ml' },
  { name: 'Cup 12 / 14oz', specText: 'Satuan Pcs / Slop' },
  {
    name: 'Cup 12 oz',
    specText: '1 ball 20 slop, 1 slop 50 pcs',
    unitRatios: { pcs: 1, slop: 50, ball: 1000 },
    displayOrder: ['ball', 'slop', 'pcs'],
  },
  { name: 'Cup 16oz', specText: 'Satuan Pcs / Slop' },
  {
    name: 'CUP 25 ml',
    specText: '1 pack 50 pcs',
    unitRatios: { pcs: 1, pack: 50 },
    displayOrder: ['pack', 'pcs'],
  },
  {
    name: 'Cup 35ml',
    specText: '1 pack 50 pcs',
    unitRatios: { pcs: 1, pack: 50 },
    displayOrder: ['pack', 'pcs'],
  },
  { name: 'Cup Gelato 2 Oz', specText: 'Satuan Pcs / Pack' },
  { name: 'Cup Gelato 4 Oz', specText: 'Satuan Pcs / Pack' },
  { name: 'Cup Gelato 5 Oz', specText: 'Satuan Pcs / Pack' },
  { name: 'Cup Hot', specText: 'Satuan Pcs / Pack' },
  { name: 'Daun Bawang', specText: 'Satuan Kg / Gram' },
  { name: 'Daun Jeruk', specText: 'Satuan Kg / Gram' },
  {
    name: 'DBL - Ayam Fillet',
    specText: '1 dus 12 pack, 1 pack 10 porsi, 1 pack 600 gram',
    unitRatios: { gram: 1, porsi: 60, pack: 600, kg: 1000, dus: 7200 },
    displayOrder: ['dus', 'pack', 'porsi', 'kg'],
  },
  {
    name: 'Dolley Papper Dimsum( Pack)',
    specText: '1 dus 8 pack',
    unitRatios: { pack: 1, dus: 8 },
    displayOrder: ['dus', 'pack'],
  },
  {
    name: 'Dolley Paper Dimsum (Pcs)',
    specText: '1 pack 250 pcs',
    unitRatios: { pcs: 1, pack: 250 },
    displayOrder: ['pack', 'pcs'],
  },
  {
    name: 'Es Serut',
    specText: '1 pack 18 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 18000 },
    displayOrder: ['pack', 'kg'],
  },
  {
    name: 'Es Tube',
    specText: '1 pack 18 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 18000 },
    displayOrder: ['pack', 'kg'],
  },
  { name: 'Full Cream', specText: 'Satuan Pack / ml / Liter' },
  {
    name: 'Garpu Plastik',
    specText: '1 dus 30 pack, 1 pack 100 pcs',
    unitRatios: { pcs: 1, pack: 100, dus: 3000 },
    displayOrder: ['dus', 'pack', 'pcs'],
  },
  {
    name: 'Green Tea Powder',
    specText: '1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000 },
    displayOrder: ['pack', 'kg'],
  },
  {
    name: 'Gula Aren Batok',
    specText: '1 pack 2 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 2000 },
    displayOrder: ['pack', 'kg'],
  },
  {
    name: 'Gula Pasir',
    specText: '1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000 },
    displayOrder: ['pack', 'kg'],
  },
  {
    name: 'Gula Sachet',
    specText: '1 pack 150 pcs',
    unitRatios: { pcs: 1, pack: 150 },
    displayOrder: ['pack', 'pcs'],
  },
  { name: 'Hand Soap', specText: 'Satuan ml / Liter / Jerigen' },
  {
    name: 'Hanglove Karet',
    specText: '1 dus 10 pack, 1 pack 100 pcs',
    unitRatios: { pcs: 1, pack: 100, dus: 1000 },
    displayOrder: ['dus', 'pack', 'pcs'],
  },
  {
    name: 'Jelly Bubble',
    specText: '1 dus 20 pack, 1 pack 500 gram',
    unitRatios: { gram: 1, pack: 500, kg: 1000, dus: 10000 },
    displayOrder: ['dus', 'pack', 'kg'],
  },
  {
    name: 'Jelly Mie',
    specText: '1 dus 20 pack, 1 pack 500 gram',
    unitRatios: { gram: 1, pack: 500, kg: 1000, dus: 10000 },
    displayOrder: ['dus', 'pack', 'kg'],
  },
  { name: 'Jeruk Limau', specText: 'Satuan Kg / Gram' },
  { name: 'Jeruk Nipis', specText: 'Satuan Kg / Gram' },
  { name: 'KARBOL', specText: 'Satuan ml / Liter / Jerigen' },
  {
    name: 'Kertas Dimsum',
    specText: '1 pack 500 pcs',
    unitRatios: { pcs: 1, pack: 500 },
    displayOrder: ['pack', 'pcs'],
  },
  { name: 'Kertas Minyak (Wrapper McD)', specText: 'Satuan Pack / Pcs' },
  {
    name: 'Kertas Thermal',
    specText: '1 dus 60 pcs',
    unitRatios: { pcs: 1, dus: 60 },
    displayOrder: ['dus', 'pcs'],
  },
  { name: 'Kertas Filter', specText: 'Satuan Pack / Pcs' },
  { name: 'Ketimun', specText: 'Satuan Kg / Gram' },
  {
    name: 'Kewpie Mayonaise',
    specText: '1 dus 6 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 6000 },
    displayOrder: ['dus', 'pack'],
  },
  { name: 'Kewpie Sesame', specText: 'Satuan Botol / Pack / ml' },
  { name: 'Kresek Sampah 100 x 120', specText: 'Satuan Pack / Pcs' },
  { name: 'Kresek Sampah 60 x 100', specText: 'Satuan Pack / Pcs' },
  { name: 'Kresek Sampah Besar', specText: 'Satuan Pack / Pcs' },
  { name: 'Kubis', specText: 'Satuan Kg / Gram' },
  { name: 'Mangga', specText: 'Satuan Kg / Gram' },
  { name: 'Masker', specText: 'Satuan Box / Pcs' },
  {
    name: 'Matcha Powder',
    specText: '1 dus 10 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 10000 },
    displayOrder: ['dus', 'pack'],
  },
  {
    name: 'Mayonaise Maestro',
    specText: '1 dus 10 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 10000 },
    displayOrder: ['dus', 'pack'],
  },
  { name: 'Merchandise Birthday', specText: 'Satuan Pcs' },
  {
    name: 'Mica Sauce @100/pack',
    specText: '1 pack 100 pcs',
    unitRatios: { pcs: 1, pack: 100 },
    displayOrder: ['pack', 'pcs'],
  },
  {
    name: 'Nata De Coco',
    specText: '1 dus 10 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 10000 },
    displayOrder: ['dus', 'pack'],
  },
  {
    name: 'Nori Sushi',
    specText: '1 pack 50 pcs',
    unitRatios: { pcs: 1, pack: 50 },
    displayOrder: ['pack', 'pcs'],
  },
  {
    name: 'Oreo Crumb',
    specText: '1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000 },
    displayOrder: ['pack', 'kg'],
  },
  { name: 'Paper Tray Dimsum', specText: 'Satuan Pack / Pcs' },
  { name: 'Paper Tray Mie', specText: 'Satuan Pack / Pcs' },
  { name: 'Pin CSO', specText: 'Satuan Pcs' },
  { name: 'Plastik 15', specText: 'Satuan Pack / Pcs' },
  { name: 'Plastik Besar', specText: 'Satuan Pack / Pcs' },
  { name: 'Plastik Cup Sealer (Roll)', specText: 'Satuan Roll' },
  { name: 'Plastik Kecil', specText: 'Satuan Pack / Pcs' },
  { name: 'Plastik Klip 10 x 7', specText: 'Satuan Pack / Pcs' },
  { name: 'Plastik Klip 6 x 4', specText: 'Satuan Pack / Pcs' },
  { name: 'Plastik Klip 8 x 5', specText: 'Satuan Pack / Pcs' },
  { name: 'Plastik Sampah 80x100', specText: 'Satuan Pack / Pcs' },
  { name: 'Plastik STP', specText: 'Satuan Pack / Pcs' },
  { name: 'Plastik Whipping Cream', specText: 'Satuan Pack / Pcs' },
  { name: 'Plastik Wrap', specText: 'Satuan Roll' },
  { name: 'Portex', specText: 'Satuan Botol / ml / Liter' },
  {
    name: 'Powder Frappe Milk @ 2kg/ Pack',
    specText: '1 pack 2 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 2000 },
    displayOrder: ['pack', 'kg'],
  },
  {
    name: 'Redvelvet Powder',
    specText: '1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000 },
    displayOrder: ['pack', 'kg'],
  },
  { name: 'Sabun cuci piring', specText: 'Satuan ml / Liter / Jerigen' },
  { name: 'Sabun Lantai', specText: 'Satuan ml / Liter / Jerigen' },
  { name: 'Saos Finna (Sachet)', specText: 'Satuan Sachet / Pack / Pcs' },
  { name: 'Saos Mentai', specText: 'Satuan Kg / Gram / Pack' },
  { name: 'Saos Sambal WFC (sachet)', specText: 'Satuan Sachet / Pack / Pcs' },
  { name: 'Selada', specText: 'Satuan Kg / Gram' },
  { name: 'Selai Strawberry', specText: 'Satuan Kg / Gram / Pack' },
  { name: 'Sendok Gelato', specText: 'Satuan Pack / Pcs' },
  { name: 'Sendok Plastik', specText: 'Satuan Pack / Pcs' },
  { name: 'Sendok Teh', specText: 'Satuan Pack / Pcs' },
  { name: 'Sereh', specText: 'Satuan Kg / Gram' },
  {
    name: 'SKM Coklat',
    specText: '1 dus 48 kg, keterangan 495 ml',
    unitRatios: { gram: 1, kg: 1000, dus: 48000 },
    displayOrder: ['dus', 'kg'],
  },
  { name: 'SKM Coklat (new)', specText: 'Satuan Kaleng / Pack / Kg' },
  { name: 'Smoked Beef', specText: 'Satuan Pack / Kg / Gram' },
  { name: 'SPOONS', specText: 'Satuan Pack / Pcs' },
  { name: 'Sticker (WizzChicken)', specText: 'Satuan Pcs / Lembar' },
  {
    name: 'Straw',
    specText: '1 dus 20 pack',
    unitRatios: { pack: 1, dus: 20 },
    displayOrder: ['dus', 'pack'],
  },
  { name: 'Strawberry', specText: 'Satuan Kg / Gram' },
  {
    name: 'Sumpit',
    specText: '1 pack 1400 pcs',
    unitRatios: { pcs: 1, pack: 1400 },
    displayOrder: ['pack', 'pcs'],
  },
  {
    name: 'Sunquick Lemon',
    specText: '1 dus 12 botol, 1 botol 300 ml',
    unitRatios: { ml: 1, botol: 300, liter: 1000, dus: 3600 },
    displayOrder: ['dus', 'botol', 'liter'],
  },
  {
    name: 'Sunquick Orange',
    specText: '1 dus 6 botol, 1 botol 2000 ml',
    unitRatios: { ml: 1, liter: 1000, botol: 2000, dus: 12000 },
    displayOrder: ['dus', 'botol', 'liter'],
  },
  {
    name: 'Taro Powder',
    specText: '1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000 },
    displayOrder: ['pack', 'kg'],
  },
  { name: 'Tas (Birthday)', specText: 'Satuan Pcs' },
  { name: 'Tas Spunbond Besar', specText: 'Satuan Pcs / Pack' },
  { name: 'Tas Spunbond Kecil', specText: 'Satuan Pcs / Pack' },
  { name: 'Teh Sosro', specText: 'Satuan Pack / Gram / Pcs' },
  { name: 'Tepung Roti', specText: 'Satuan Kg / Gram / Pack' },
  {
    name: 'Tepung Segitiga',
    specText: '1 dus 12 pack, 1 pack 1 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 1000, dus: 12000 },
    displayOrder: ['dus', 'pack'],
  },
  { name: 'Tepung Tapioka', specText: 'Satuan Kg / Gram / Pack' },
  {
    name: 'Terasi',
    specText: '1 pack 500 gram',
    unitRatios: { gram: 1, pack: 500, kg: 1000 },
    displayOrder: ['pack', 'kg'],
  },
  {
    name: 'Tissue Besar',
    specText: '1 dus 24 pack',
    unitRatios: { pack: 1, pcs: 1, dus: 24 },
    displayOrder: ['dus', 'pack'],
  },
  {
    name: 'Tong Tji Jasmine Tea',
    specText: '1 ball 50 pack, 1 pack 80 gram',
    unitRatios: { gram: 1, pack: 80, kg: 1000, ball: 4000 },
    displayOrder: ['ball', 'pack', 'kg'],
  },
  { name: 'Tobiko', specText: 'Satuan Gram / Kg / Pack' },
  { name: 'Topi (Birthday)', specText: 'Satuan Pcs' },
  { name: 'Topi (WizzChicken)', specText: 'Satuan Pcs' },
  {
    name: 'Toping Caramel',
    specText: '1 dus 1 pack, 1 pack 2 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 2000, dus: 2000 },
    displayOrder: ['pack', 'kg'],
  },
  {
    name: 'Toping Caramel @2Kg',
    specText: '1 dus 1 pack, 1 pack 2 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 2000, dus: 2000 },
    displayOrder: ['pack', 'kg'],
  },
  {
    name: 'Toping Coklat @2kg',
    specText: '1 dus 1 pack, 1 pack 2 kg',
    unitRatios: { gram: 1, kg: 1000, pack: 2000, dus: 2000 },
    displayOrder: ['pack', 'kg'],
  },
  { name: 'Tutup Cup Hot', specText: 'Satuan Pcs / Pack' },
  { name: 'Undangan (Birthday)', specText: 'Satuan Pcs / Pack' },
  {
    name: 'Whipping Cream Powder',
    specText: '1 pack 800 gram',
    unitRatios: { gram: 1, pack: 800, kg: 1000 },
    displayOrder: ['pack', 'kg'],
  },
  {
    name: 'WIP - Minyak Kelapa @1 L',
    specText: '1 kemasan 1 liter (1000 ml)',
    unitRatios: { ml: 1, liter: 1000, botol: 1000, pack: 1000 },
    displayOrder: ['liter'],
  },
  {
    name: 'WIP - Bawang Goreng',
    specText: '1 dus 10 pack, 1 pack 500 gram',
    unitRatios: { gram: 1, pack: 500, kg: 1000, dus: 5000 },
    displayOrder: ['dus', 'pack', 'kg'],
  },
  {
    name: 'WIP - Cuka Sushi',
    specText: '1 dus 12 botol, 1 botol 1300 ml',
    unitRatios: { ml: 1, liter: 1000, botol: 1300, dus: 15600 },
    displayOrder: ['dus', 'botol', 'liter'],
  },
  { name: 'WIP - Dimsum Sushi', specText: 'Satuan Porsi / Pcs / Pack' },
  {
    name: 'WIP - Minyak Bawang',
    specText: '1 dus 12 botol, 1 botol 1000 ml',
    unitRatios: { ml: 1, liter: 1000, botol: 1000, dus: 12000 },
    displayOrder: ['dus', 'botol'],
  },
  {
    name: 'WIP - Saos Asam Manis',
    specText: '1 dus 12 botol, 1 botol 1100 ml',
    unitRatios: { ml: 1, liter: 1000, botol: 1100, dus: 13200 },
    displayOrder: ['dus', 'botol', 'liter'],
  },
  {
    name: 'WIP - Saos Blackpepper',
    specText: '1 dus 12 botol, 1 botol 1200 ml',
    unitRatios: { ml: 1, liter: 1000, botol: 1200, dus: 14400 },
    displayOrder: ['dus', 'botol', 'liter'],
  },
  {
    name: 'WIP - Saos Pedas',
    specText: '1 dus 12 botol, 1 botol 1200 ml',
    unitRatios: { ml: 1, liter: 1000, botol: 1200, dus: 14400 },
    displayOrder: ['dus', 'botol', 'liter'],
  },
  {
    name: 'WIP - Saos Teriyaki',
    specText: '1 dus 12 botol, 1 botol 1100 ml',
    unitRatios: { ml: 1, liter: 1000, botol: 1100, dus: 13200 },
    displayOrder: ['dus', 'botol', 'liter'],
  },
  { name: 'WIP - Sirup Wizzmie Caramel', specText: 'Satuan Botol / ml' },
  { name: 'WIP - Sirup Wizzmie Hazelnut', specText: 'Satuan Botol / ml' },
  {
    name: 'WIP - Sirup Wizzmie Leci',
    specText: '1 dus 12 botol, 1 botol 1000 ml',
    unitRatios: { ml: 1, liter: 1000, botol: 1000, dus: 12000 },
    displayOrder: ['dus', 'botol'],
  },
  {
    name: 'WIP - Sirup Wizzmie Rozen Roos',
    specText: '1 dus 12 botol, 1 botol 1000 ml',
    unitRatios: { ml: 1, liter: 1000, botol: 1000, dus: 12000 },
    displayOrder: ['dus', 'botol'],
  },
  {
    name: 'WIP - Sirup Wizzmie Vanila',
    specText: '1 botol 1000 ml',
    unitRatios: { ml: 1, liter: 1000, botol: 1000 },
    displayOrder: ['botol', 'liter'],
  },
  { name: 'WIP - Tepung Bumbu (Finna)', specText: 'Satuan Kg / Gram / Pack' },
  { name: 'WIP - Tepung Bumbu (New)', specText: 'Satuan Kg / Gram / Pack' },
  { name: 'Wortel', specText: 'Satuan Kg / Gram' },
  { name: 'Nobla Liquid', specText: 'Satuan ml / Liter / Jerigen' },
  { name: 'Nobla Liquid (new)', specText: 'Satuan ml / Liter / Jerigen' },
  { name: 'Oven & Grill Cleaner', specText: 'Satuan ml / Liter / Jerigen' },
  {
    name: 'Oven & Grill Cleaner (new)',
    specText: 'Satuan ml / Liter / Jerigen',
  },
  { name: 'Suma Calc D5', specText: 'Satuan ml / Liter / Jerigen' },
  { name: 'Suma Calc D5 (new)', specText: 'Satuan ml / Liter / Jerigen' },
  { name: 'Miracle Powder', specText: 'Satuan Gram / Kg / Pack' },
  { name: 'Plastik T', specText: 'Satuan Pack / Pcs' },
  { name: 'Terasi Ajinomoto', specText: 'Satuan Pack / Gram' },
];

const ITEM_PACKAGING_MAP: Map<string, ItemPackagingSpec> = (() => {
  const map = new Map<string, ItemPackagingSpec>();
  for (const spec of ITEM_PACKAGING_CATALOG) {
    map.set(spec.name.toLowerCase().trim(), spec);
    map.set(normalizeItemLookupKey(spec.name), spec);
  }
  return map;
})();

export function getItemPackagingSpec(
  productName: string
): ItemPackagingSpec | null {
  if (!productName) return null;
  const direct = ITEM_PACKAGING_MAP.get(productName.toLowerCase().trim());
  if (direct) return direct;
  return ITEM_PACKAGING_MAP.get(normalizeItemLookupKey(productName)) ?? null;
}

export const CONVERSIONS: Record<string, ConversionRule> = {
  beras: {
    baseUnit: 'KG',
    dosMultiplier: 10,
    packLabel: 'Pack',
    otherUnits: { pack: 10 },
  },
  'dbl - ayam potong dadu': {
    baseUnit: 'KG',
    dosMultiplier: 10,
    packLabel: 'Dos',
  },
  'dbl - ayam wfc 1.1': {
    baseUnit: 'PORSI',
    dosMultiplier: 90,
    packLabel: 'Dos',
    otherUnits: { pack: 9 },
  },
  'dbl - cabai rawit': {
    baseUnit: 'KG',
    dosMultiplier: 10,
    packLabel: 'Dos',
  },
  'dbl - sayap': {
    baseUnit: 'PORSI',
    dosMultiplier: 50,
    packLabel: 'Dos',
    otherUnits: { 'pack @5porsi': 5, pack: 5 },
  },
  'fresh milk': {
    baseUnit: 'ML',
    dosMultiplier: 1000,
    packLabel: 'Btl',
    otherUnits: { btl: 1000, botol: 1000 },
  },
  'kecap manis': {
    baseUnit: 'KG',
    dosMultiplier: 21,
    packLabel: 'Dos',
    otherUnits: { jerigen: 7, jrg: 7 },
  },
  'minyak goreng': {
    baseUnit: 'L',
    dosMultiplier: 18,
    packLabel: 'Dus',
    otherUnits: { jrg: 18, jerigen: 18 },
  },
  'skm carnation @2kg': {
    baseUnit: 'KG',
    dosMultiplier: 16,
    packLabel: 'Dos',
    otherUnits: { pack: 2 },
  },
  'tepung wizzchick (tepung krispi)': {
    baseUnit: 'KG',
    dosMultiplier: 14,
    packLabel: 'Dos',
  },
  'tong tji super jasmine tea': {
    baseUnit: 'GR',
    dosMultiplier: 80,
    packLabel: 'Pack',
    otherUnits: { pack: 80, ball: 4000 },
  },
  'tong tji jasmine tea': {
    baseUnit: 'GR',
    dosMultiplier: 80,
    packLabel: 'Pack',
    otherUnits: { pack: 80, ball: 4000 },
  },
  'wip - adonan pangsit': {
    baseUnit: 'KG',
    dosMultiplier: 12,
    packLabel: 'Dos',
    otherUnits: { pack: 2 },
  },
  'wip - ayam tabur': {
    baseUnit: 'KG',
    dosMultiplier: 9,
    packLabel: 'Dos',
  },
  'wip - bola keju': {
    baseUnit: 'PORSI',
    dosMultiplier: 140,
    packLabel: 'Dos',
    otherUnits: { pack: 10 },
  },
  'wip - bumbu mie': {
    baseUnit: 'ML',
    dosMultiplier: 12000,
    packLabel: 'Dos',
    otherUnits: { btl: 1000, botol: 1000 },
  },
  'wip - ceker': {
    baseUnit: 'Porsi @3pcs',
    dosMultiplier: 100,
    packLabel: 'Dos',
    otherUnits: { pack: 10 },
  },
  'wip - ebi furai (new)': {
    baseUnit: 'PORSI',
    dosMultiplier: 60,
    packLabel: 'Dos',
    otherUnits: { pack: 5 },
  },
  'wip - kulit pangsit': {
    baseUnit: 'KG',
    dosMultiplier: 20,
    packLabel: 'Dos',
  },
  'wip - kulit udang rambutan': {
    baseUnit: 'KG',
    dosMultiplier: 12,
    packLabel: 'Dos',
  },
  'wip - lumpia ayam': {
    baseUnit: 'Porsi @3pcs',
    dosMultiplier: 130,
    packLabel: 'Dos',
    otherUnits: { pack: 10 },
  },
  'wip - lumpia udang': {
    baseUnit: 'PORSI',
    dosMultiplier: 110,
    packLabel: 'Dos',
    otherUnits: { pack: 10 },
  },
  'wip - mie': {
    baseUnit: 'Pcs',
    dosMultiplier: 160,
    packLabel: 'Dos',
    otherUnits: { pack: 20 },
  },
  'wip - pao ayam': {
    baseUnit: 'Porsi @3pcs',
    dosMultiplier: 70,
    packLabel: 'Dos',
    otherUnits: { pack: 10 },
  },
  'wip - sambal horeg': {
    baseUnit: 'KG',
    dosMultiplier: 12,
    packLabel: 'Dos',
  },
  'wip - siomay': {
    baseUnit: 'Porsi @3pcs',
    dosMultiplier: 140,
    packLabel: 'Dos',
    otherUnits: { pack: 10 },
  },
  'wip - udang keju': {
    baseUnit: 'Porsi @3pcs',
    dosMultiplier: 120,
    packLabel: 'Dos',
    otherUnits: { pack: 10 },
  },
  'wip - udang rambutan': {
    baseUnit: 'Porsi @3pcs',
    dosMultiplier: 140,
    packLabel: 'Dos',
    otherUnits: { pack: 10 },
  },
};

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const MONTHS_FULL = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function formatDateId(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]} ${y}`;
}

export function formatMonthId(monthKey: string): string {
  const year = monthKey.slice(0, 4);
  const monthIdx = Number(monthKey.slice(5)) - 1;
  return `${MONTHS_FULL[monthIdx] ?? monthKey} ${year}`;
}

export function formatDateRangeLabel(start: string, end: string): string {
  if (!start || !end) return '';
  const normStart = start <= end ? start : end;
  const normEnd = start <= end ? end : start;
  if (normStart === normEnd) return formatDateId(normStart);
  if (normStart.slice(0, 7) === normEnd.slice(0, 7)) {
    return `${Number(normStart.slice(8))} – ${formatDateId(normEnd)}`;
  }
  return `${formatDateId(normStart)} – ${formatDateId(normEnd)}`;
}

export function formatShortRupiahTag(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  if (abs >= 1_000_000) {
    return `${(abs / 1_000_000).toLocaleString('id-ID', {
      maximumFractionDigits: 1,
    })} jt`;
  }
  if (abs >= 1_000) {
    return `${(abs / 1_000).toLocaleString('id-ID', {
      maximumFractionDigits: 1,
    })} rb`;
  }
  return '';
}

export function formatRupiah(amount: number, includeShort = true): string {
  const absRounded = Math.abs(Math.round(amount));
  const base = `Rp ${absRounded.toLocaleString('id-ID')}`;
  if (!includeShort) return base;
  if (absRounded >= 1_000_000) return `${base} jt`;
  if (absRounded >= 1_000) return `${base} rb`;
  return base;
}

export function formatCompactRupiah(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  if (abs >= 1_000_000) {
    return `${(abs / 1_000_000).toLocaleString('id-ID', {
      maximumFractionDigits: 1,
    })}jt`;
  }
  if (abs >= 1_000) {
    return `${Math.round(abs / 1_000).toLocaleString('id-ID')}rb`;
  }
  return abs.toLocaleString('id-ID');
}

export function formatQty(qty: number): string {
  return Math.abs(Math.round(qty * 100) / 100).toLocaleString('id-ID', {
    maximumFractionDigits: 2,
  });
}

export function formatSignedQty(qty: number): string {
  const rounded = Math.round(qty * 100) / 100;
  const prefix = rounded > 1e-9 ? '+' : rounded < -1e-9 ? '-' : '';
  return `${prefix}${Math.abs(rounded).toLocaleString('id-ID', {
    maximumFractionDigits: 2,
  })}`;
}

function resolveCanonicalUnit(rawUnit: string): CanonicalUnit | null {
  const u = rawUnit.toLowerCase().trim();
  if (!u) return null;
  if (u === 'kg' || u === 'kilo' || u === 'kilogram') return 'kg';
  if (u === 'gr' || u === 'gram' || u === 'g' || u === 'grm') return 'gram';
  if (u === 'ml' || u === 'mililiter') return 'ml';
  if (u === 'l' || u === 'ltr' || u === 'liter') return 'liter';
  if (u === 'porsi' || u === 'prs' || u.startsWith('porsi')) return 'porsi';
  if (
    u === 'pcs' ||
    u === 'pc' ||
    u === 'buah' ||
    u === 'biji' ||
    u === 'butir' ||
    u === 'lembar'
  ) {
    return 'pcs';
  }
  if (
    u === 'pack' ||
    u === 'pak' ||
    u === 'pck' ||
    u === 'bungkus' ||
    u === 'bks' ||
    u.startsWith('pack ')
  ) {
    return 'pack';
  }
  if (u === 'botol' || u === 'btl') return 'botol';
  if (u === 'dus' || u === 'dos' || u === 'box' || u === 'karton') return 'dus';
  if (u === 'ball' || u === 'bal') return 'ball';
  if (u === 'slop') return 'slop';
  if (u === 'jerigen' || u === 'jrg' || u === 'jrgn') return 'jerigen';
  if (u === 'galon' || u === 'gln') return 'galon';
  return null;
}

export function formatPackEquivalent(
  absQty: number,
  unit: string,
  productName: string
): string {
  if (!absQty || absQty <= 1e-9) return '';

  const spec = getItemPackagingSpec(productName);
  const srcUnit = resolveCanonicalUnit(unit);

  if (spec?.unitRatios && srcUnit) {
    const ratios = spec.unitRatios;
    let srcRatio = ratios[srcUnit];
    if (srcRatio === undefined) {
      if (srcUnit === 'kg' && ratios.gram !== undefined) {
        srcRatio = ratios.gram * 1000;
      } else if (srcUnit === 'gram' && ratios.kg !== undefined) {
        srcRatio = ratios.kg / 1000;
      } else if (srcUnit === 'liter' && ratios.ml !== undefined) {
        srcRatio = ratios.ml * 1000;
      } else if (srcUnit === 'ml' && ratios.liter !== undefined) {
        srcRatio = ratios.liter / 1000;
      }
    }

    if (srcRatio && srcRatio > 0) {
      const baseAmount = absQty * srcRatio;
      const order =
        spec.displayOrder ??
        (Object.keys(ratios) as CanonicalUnit[]).sort(
          (a, b) => (ratios[b] ?? 0) - (ratios[a] ?? 0)
        );

      const parts: string[] = [];
      for (const targetUnit of order) {
        if (targetUnit === srcUnit) continue;
        const targetRatio = ratios[targetUnit];
        if (!targetRatio || targetRatio <= 0) continue;

        // Avoid redundant 1:1 metric alias when a real packaging unit (pack/botol) is already shown
        if (
          parts.length > 0 &&
          ((targetUnit === 'kg' && ratios.pack === 1000) ||
            (targetUnit === 'liter' && ratios.botol === 1000))
        ) {
          continue;
        }

        const converted = baseAmount / targetRatio;
        const isContainer =
          targetUnit === 'dus' ||
          targetUnit === 'ball' ||
          targetUnit === 'jerigen' ||
          targetUnit === 'galon' ||
          targetUnit === 'pack' ||
          targetUnit === 'slop' ||
          targetUnit === 'botol';

        if (isContainer && converted < 0.2) continue;
        if (!isContainer && converted < 0.5) continue;

        const rounded = Math.round(converted * 10) / 10;
        if (rounded <= 0) continue;

        parts.push(
          `${rounded.toLocaleString('id-ID', {
            maximumFractionDigits: 1,
          })} ${CANONICAL_UNIT_LABELS[targetUnit]}`
        );
        if (parts.length >= 2) break;
      }

      if (parts.length > 0) {
        return `sekitar ${parts.join(' / ')}`;
      }
    }
  }

  const rule = CONVERSIONS[productName.toLowerCase()];
  if (!rule) return '';
  if (unit.toLowerCase() !== rule.baseUnit.toLowerCase()) return '';
  if (rule.dosMultiplier <= 1) return '';
  const packs = absQty / rule.dosMultiplier;
  if (packs < 0.25) return '';
  const rounded = Math.round(packs * 10) / 10;
  return `sekitar ${rounded.toLocaleString('id-ID', {
    maximumFractionDigits: 1,
  })} ${rule.packLabel}`;
}

export function formatInnerPackDiff(
  diffQty: number,
  unit: string,
  productName: string
): string {
  const absQty = Math.abs(diffQty);
  if (!absQty || absQty <= 1e-9) return '';

  const spec = getItemPackagingSpec(productName);
  const srcUnit = resolveCanonicalUnit(unit);
  if (!spec?.unitRatios || !srcUnit) return '';

  const ratios = spec.unitRatios;
  let srcRatio = ratios[srcUnit];
  if (srcRatio === undefined) {
    if (srcUnit === 'kg' && ratios.gram !== undefined) {
      srcRatio = ratios.gram * 1000;
    } else if (srcUnit === 'gram' && ratios.kg !== undefined) {
      srcRatio = ratios.kg / 1000;
    } else if (srcUnit === 'liter' && ratios.ml !== undefined) {
      srcRatio = ratios.ml * 1000;
    } else if (srcUnit === 'ml' && ratios.liter !== undefined) {
      srcRatio = ratios.liter / 1000;
    }
  }

  if (!srcRatio || srcRatio <= 0) return '';

  const baseAmount = absQty * srcRatio;
  const preferredUnits: CanonicalUnit[] = [
    'pack',
    'botol',
    'jerigen',
    'slop',
    'galon',
    'porsi',
    'pcs',
    'dus',
    'ball',
  ];

  let chosenUnit: CanonicalUnit | null = null;
  for (const candidate of preferredUnits) {
    const ratio = ratios[candidate];
    if (!ratio || ratio <= 0) continue;
    // Skip porsi/pcs if the source unit is already porsi/pcs and there is no container unit
    if (
      (candidate === 'porsi' || candidate === 'pcs') &&
      candidate === srcUnit
    ) {
      continue;
    }
    chosenUnit = candidate;
    break;
  }

  if (!chosenUnit) return '';
  const targetRatio = ratios[chosenUnit];
  if (!targetRatio || targetRatio <= 0) return '';

  const converted = baseAmount / targetRatio;
  const rounded = Math.round(converted * 100) / 100;
  if (rounded <= 0) return '';

  const prefix = diffQty < -1e-9 ? 'Minus ' : diffQty > 1e-9 ? 'Lebih ' : '';
  const formattedNum = rounded.toLocaleString('id-ID', {
    maximumFractionDigits: 2,
  });
  return `${prefix}${formattedNum} ${CANONICAL_UNIT_LABELS[chosenUnit]}`;
}

export function formatCompactContainerDiff(
  diffQty: number,
  unit: string,
  productName: string
): string {
  const absQty = Math.abs(diffQty);
  if (!absQty || absQty <= 1e-9) return '';

  const signPrefix = diffQty < -1e-9 ? '- ' : diffQty > 1e-9 ? '+ ' : '';
  const spec = getItemPackagingSpec(productName);
  const srcUnit = resolveCanonicalUnit(unit);

  if (spec?.unitRatios && srcUnit) {
    const ratios = spec.unitRatios;
    let srcRatio = ratios[srcUnit];
    if (srcRatio === undefined) {
      if (srcUnit === 'kg' && ratios.gram !== undefined) {
        srcRatio = ratios.gram * 1000;
      } else if (srcUnit === 'gram' && ratios.kg !== undefined) {
        srcRatio = ratios.kg / 1000;
      } else if (srcUnit === 'liter' && ratios.ml !== undefined) {
        srcRatio = ratios.ml * 1000;
      } else if (srcUnit === 'ml' && ratios.liter !== undefined) {
        srcRatio = ratios.liter / 1000;
      }
    }

    if (srcRatio && srcRatio > 0) {
      const baseAmount = absQty * srcRatio;
      const containerPriority: CanonicalUnit[] = [
        'dus',
        'ball',
        'jerigen',
        'galon',
        'pack',
        'slop',
        'botol',
        'porsi',
        'pcs',
      ];
      const order = spec.displayOrder
        ? spec.displayOrder.filter((u) => containerPriority.includes(u))
        : containerPriority.filter((u) => ratios[u] !== undefined);

      const parts: string[] = [];
      for (const targetUnit of order) {
        const targetRatio = ratios[targetUnit];
        if (!targetRatio || targetRatio <= 0) continue;

        // Skip porsi/pcs if the source unit is already porsi/pcs and we already have or don't have container units
        if (
          (targetUnit === 'porsi' || targetUnit === 'pcs') &&
          targetUnit === srcUnit
        ) {
          continue;
        }

        const converted = baseAmount / targetRatio;
        const isOuterBox =
          targetUnit === 'dus' ||
          targetUnit === 'ball' ||
          targetUnit === 'jerigen' ||
          targetUnit === 'galon';
        const rounded = isOuterBox
          ? Math.round(converted * 10) / 10 || Math.round(converted * 100) / 100
          : Math.round(converted * 10) / 10 || Math.round(converted * 100) / 100;

        if (rounded <= 0) continue;

        parts.push(
          `${rounded.toLocaleString('id-ID', {
            maximumFractionDigits: rounded < 0.1 ? 2 : 1,
          })} ${CANONICAL_UNIT_LABELS[targetUnit]}`
        );
        if (parts.length >= 2) break;
      }

      if (parts.length > 0) {
        return `${signPrefix}${parts.join(' / ')}`;
      }
    }
  }

  const rule = CONVERSIONS[productName.toLowerCase()];
  if (rule && rule.dosMultiplier > 1) {
    const packs = absQty / rule.dosMultiplier;
    const rounded =
      Math.round(packs * 10) / 10 || Math.round(packs * 100) / 100;
    if (rounded > 0) {
      const label =
        rule.packLabel.toLowerCase() === 'dos' ? 'Dus' : rule.packLabel;
      return `${signPrefix}${rounded.toLocaleString('id-ID', {
        maximumFractionDigits: rounded < 0.1 ? 2 : 1,
      })} ${label}`;
    }
  }

  return '';
}

export function formatOuterContainerDiff(
  diffQty: number,
  unit: string,
  productName: string,
  meta?: ConvertedStockRow
): string {
  const absQty = Math.abs(diffQty);
  if (!absQty || absQty <= 1e-9) return '';

  const sign = diffQty < -1e-9 ? '-' : diffQty > 1e-9 ? '+' : '';

  if (meta?.wasConverted && Math.abs(meta.originalDiffQty) > 1e-9) {
    const rawUnit = meta.originalUnit.trim();
    const prettyUnit =
      rawUnit.toLowerCase() === 'dos' || rawUnit.toLowerCase() === 'dus'
        ? 'Dus'
        : rawUnit.toLowerCase() === 'btl' || rawUnit.toLowerCase() === 'botol'
        ? 'Botol'
        : rawUnit.toLowerCase() === 'pack'
        ? 'Pack'
        : rawUnit.toLowerCase() === 'jrg' || rawUnit.toLowerCase() === 'jerigen'
        ? 'Jerigen'
        : rawUnit;
    return `${formatSignedQty(meta.originalDiffQty)} ${prettyUnit}`;
  }

  const spec = getItemPackagingSpec(productName);
  const srcUnit = resolveCanonicalUnit(unit);
  if (spec?.unitRatios && srcUnit) {
    const ratios = spec.unitRatios;
    let srcRatio = ratios[srcUnit];
    if (srcRatio === undefined) {
      if (srcUnit === 'kg' && ratios.gram !== undefined) {
        srcRatio = ratios.gram * 1000;
      } else if (srcUnit === 'gram' && ratios.kg !== undefined) {
        srcRatio = ratios.kg / 1000;
      } else if (srcUnit === 'liter' && ratios.ml !== undefined) {
        srcRatio = ratios.ml * 1000;
      } else if (srcUnit === 'ml' && ratios.liter !== undefined) {
        srcRatio = ratios.liter / 1000;
      }
    }

    if (srcRatio && srcRatio > 0) {
      const baseAmount = absQty * srcRatio;
      const outerCandidates: CanonicalUnit[] = [
        'dus',
        'ball',
        'jerigen',
        'galon',
        'pack',
        'slop',
        'botol',
      ];
      for (const candidate of outerCandidates) {
        const ratio = ratios[candidate];
        if (!ratio || ratio <= 0) continue;
        const converted = baseAmount / ratio;
        const rounded =
          Math.round(converted * 100) / 100;
        if (rounded <= 0) continue;
        return `${sign}${rounded.toLocaleString('id-ID', {
          maximumFractionDigits: 2,
        })} ${CANONICAL_UNIT_LABELS[candidate]}`;
      }
    }
  }

  return `${formatSignedQty(diffQty)} ${unit}`;
}

export function formatQtyMap(
  qtyByUnit: Record<string, number>,
  productName: string,
  includeSignPrefix = false
): string {
  const entries = Object.entries(qtyByUnit).filter(
    ([, val]) => Math.abs(val) > 1e-9
  );
  if (!entries.length) return '0 (Pas)';

  return entries
    .map(([unit, val]) => {
      const absStr = `${formatQty(val)} ${unit}`;
      const compactEquiv = formatCompactContainerDiff(val, unit, productName)
        .replace(/^[-+]\s*/, '');
      const prefix = includeSignPrefix
        ? val < -1e-9
          ? 'Minus '
          : 'Lebih '
        : '';
      return compactEquiv
        ? `${prefix}${absStr} (${compactEquiv})`
        : `${prefix}${absStr}`;
    })
    .join(', ');
}

export interface ConvertedStockRow {
  row: StockRow;
  wasConverted: boolean;
  originalUnit: string;
  originalDiffQty: number;
}

export function convertRowWithMeta(row: StockRow): ConvertedStockRow {
  const rule = CONVERSIONS[row[0].toLowerCase()];
  const unitLower = row[1].toLowerCase().trim();
  if (!rule) {
    return {
      row,
      wasConverted: false,
      originalUnit: row[1],
      originalDiffQty: row[4],
    };
  }

  const factor =
    unitLower === 'dos'
      ? rule.dosMultiplier
      : (rule.otherUnits?.[unitLower] ?? 1);

  if (factor === 1 && unitLower !== 'dos') {
    return {
      row,
      wasConverted: false,
      originalUnit: row[1],
      originalDiffQty: row[4],
    };
  }

  const scale = (val: number) => Math.round(val * factor * 1e4) / 1e4;
  return {
    row: [
      row[0],
      rule.baseUnit,
      scale(row[2]),
      scale(row[3]),
      scale(row[4]),
      row[5],
      row[6],
      row[7],
      row[8],
      row[9],
      row[10],
      row[11],
      row[12],
      row[13],
      row[14],
      row[15],
    ],
    wasConverted: true,
    originalUnit: row[1],
    originalDiffQty: row[4],
  };
}

export function convertRow(row: StockRow): StockRow {
  return convertRowWithMeta(row).row;
}

export function getConvertedRows(rows: StockRow[]): StockRow[] {
  return rows.map(convertRow);
}

function parseCellNumber(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.round(val * 1e4) / 1e4;
  }
  if (typeof val === 'string') {
    let cleaned = val.trim().replace(/\s+/g, '');
    if (!cleaned) return 0;
    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');
    if (hasComma && hasDot) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        // Indonesian style: 3.810,00 -> 3810.00
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // US style: 3,810.00 -> 3810.00
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (hasComma) {
      // Single or decimal comma (e.g. -2,50) vs US thousands (1,000)
      if (/^-?\d{1,3}(,\d{3})+$/.test(cleaned)) {
        cleaned = cleaned.replace(/,/g, '');
      } else {
        cleaned = cleaned.replace(/,/g, '.');
      }
    }
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed * 1e4) / 1e4;
    }
  }
  return 0;
}

function parseExcelDate(val: unknown): string | null {
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(
        parsed.d
      ).padStart(2, '0')}`;
    }
  } else if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(val.getDate()).padStart(2, '0')}`;
  } else if (typeof val === 'string') {
    const isoMatch = val.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(
        2,
        '0'
      )}-${isoMatch[3].padStart(2, '0')}`;
    }
    const dmyMatch = val.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      return `${dmyMatch[3]}-${dmyMatch[2].padStart(
        2,
        '0'
      )}-${dmyMatch[1].padStart(2, '0')}`;
    }
  }
  return null;
}

export function parseExcelBuffer(buffer: ArrayBuffer): StockDataset {
  const wb = XLSX.read(buffer, { type: 'array' });
  if (!wb.SheetNames.length) {
    throw new Error('Tidak ada sheet di file Excel.');
  }

  const out: StockDataset = {};
  let foundHeaderInAnySheet = false;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
    });

    const headerIdx = rows.findIndex(
      (r) =>
        Array.isArray(r) &&
        r.some(
          (cell) =>
            String(cell ?? '').trim().toLowerCase() === 'stock opname date'
        )
    );

    if (headerIdx < 0) continue;
    foundHeaderInAnySheet = true;

    const headers = rows[headerIdx].map((c) =>
      String(c ?? '').trim().toLowerCase()
    );
    const idx = (name: string) => headers.indexOf(name);

    const cols = {
      opnameNumber: idx('stock opname number'),
      date: idx('stock opname date'),
      branch: idx('branch'),
      location: idx('location'),
      purpose: idx('purpose'),
      product: idx('product'),
      productCode: idx('product code'),
      category: idx('category'),
      subcategory: idx('subcategory'),
      unit: idx('unit'),
      system: idx('period system stock'),
      opname: idx('opname stock'),
      diffQty: idx('difference qty'),
      valUnit: idx('value per unit'),
      diffVal: idx('difference value'),
      status: idx('status'),
      info: idx('additional information'),
    };

    if (cols.product < 0 || cols.diffVal < 0 || cols.diffQty < 0) {
      throw new Error(
        'Kolom Product, Difference Qty, atau Difference Value tidak ada.'
      );
    }

    for (const row of rows.slice(headerIdx + 1)) {
      if (!Array.isArray(row)) continue;
      const dateKey = parseExcelDate(row[cols.date]);
      const productRaw = row[cols.product];
      if (!dateKey || !productRaw) continue;

      const product = String(productRaw).trim();
      if (!product) continue;

      const unit = cols.unit >= 0 ? String(row[cols.unit] ?? '').trim() : '';
      const sysStock = cols.system >= 0 ? parseCellNumber(row[cols.system]) : 0;
      const opStock = cols.opname >= 0 ? parseCellNumber(row[cols.opname]) : 0;
      const diffQty = parseCellNumber(row[cols.diffQty]);
      const valUnit = cols.valUnit >= 0 ? parseCellNumber(row[cols.valUnit]) : 0;
      const diffVal = Math.round(parseCellNumber(row[cols.diffVal]) * 100) / 100;
      const info = cols.info >= 0 ? String(row[cols.info] ?? '').trim() : '';
      const category =
        cols.category >= 0 ? String(row[cols.category] ?? '').trim() : '';
      const branch = cols.branch >= 0 ? String(row[cols.branch] ?? '').trim() : '';
      const opnameNumber =
        cols.opnameNumber >= 0
          ? String(row[cols.opnameNumber] ?? '').trim()
          : '';
      const location =
        cols.location >= 0 ? String(row[cols.location] ?? '').trim() : '';
      const purpose =
        cols.purpose >= 0 ? String(row[cols.purpose] ?? '').trim() : '';
      const productCode =
        cols.productCode >= 0 ? String(row[cols.productCode] ?? '').trim() : '';
      const subcategory =
        cols.subcategory >= 0 ? String(row[cols.subcategory] ?? '').trim() : '';
      const status = cols.status >= 0 ? String(row[cols.status] ?? '').trim() : '';

      if (!out[dateKey]) out[dateKey] = [];
      out[dateKey].push([
        product,
        unit,
        sysStock,
        opStock,
        diffQty,
        valUnit,
        diffVal,
        info,
        category,
        branch,
        opnameNumber,
        location,
        purpose,
        productCode,
        subcategory,
        status,
      ]);
    }
  }

  if (!foundHeaderInAnySheet) {
    throw new Error('Baris judul kolom "Stock Opname date" tidak ditemukan.');
  }

  return out;
}

export interface DailyStat {
  date: string;
  negVal: number;
  posVal: number;
  cumNegVal: number;
  diffCount: number;
  pasCount: number;
  totalCount: number;
}

export interface ProductStat {
  name: string;
  code: string;
  category: string;
  subcategory: string;
  purposes: string[];
  location: string;
  lastUnitPrice: number;
  negVal: number;
  posVal: number;
  netVal: number;
  negDays: number;
  posDays: number;
  pasDays: number;
  totalDays: number;
  negQtyByUnit: Record<string, number>;
  posQtyByUnit: Record<string, number>;
  qtyByUnit: Record<string, number>;
}

export interface CategoryStat {
  category: string;
  negVal: number;
  posVal: number;
  netVal: number;
  diffItems: number;
  totalItems: number;
}

export type ViewScope = 'month' | 'range' | 'day';

export interface DateRangeSelection {
  start: string;
  end: string;
}

export function computeSummary(
  data: StockDataset,
  monthKey: string,
  scope: ViewScope = 'month',
  selectedDate?: string,
  dateRange?: DateRangeSelection
) {
  const allMonthDates = Object.keys(data)
    .filter((d) => d.startsWith(monthKey))
    .sort();

  const resolvedDate =
    selectedDate && allMonthDates.includes(selectedDate)
      ? selectedDate
      : allMonthDates[allMonthDates.length - 1] ?? '';

  const fallbackStart = allMonthDates[0] ?? `${monthKey}-01`;
  const fallbackEnd = allMonthDates[allMonthDates.length - 1] ?? fallbackStart;
  const rawStart = dateRange?.start?.startsWith(monthKey)
    ? dateRange.start
    : fallbackStart;
  const rawEnd = dateRange?.end?.startsWith(monthKey)
    ? dateRange.end
    : fallbackEnd;
  const rangeStart = rawStart <= rawEnd ? rawStart : rawEnd;
  const rangeEnd = rawStart <= rawEnd ? rawEnd : rawStart;

  const activeDates =
    scope === 'day'
      ? resolvedDate
        ? [resolvedDate]
        : []
      : scope === 'range'
      ? allMonthDates.filter((d) => d >= rangeStart && d <= rangeEnd)
      : allMonthDates;

  let branchName = '';
  let locationName = '';
  let cumNeg = 0;
  const dailyStats: DailyStat[] = allMonthDates.map((date) => {
    let negVal = 0;
    let posVal = 0;
    let diffCount = 0;
    const dayRows = data[date] ?? [];
    for (const r of dayRows) {
      if (!branchName && r[9]) branchName = r[9];
      if (!locationName && r[11]) locationName = r[11];
      if (r[6] < 0) negVal += r[6];
      else if (r[6] > 0) posVal += r[6];
      if (Math.abs(r[4]) > 1e-9 || Math.abs(r[6]) > 0.5) diffCount++;
    }
    cumNeg += negVal;
    const totalCount = dayRows.length;
    return {
      date,
      negVal,
      posVal,
      cumNegVal: cumNeg,
      diffCount,
      pasCount: Math.max(0, totalCount - diffCount),
      totalCount,
    };
  });

  const productMap: Record<string, ProductStat> = {};
  const categoryMap: Record<string, CategoryStat> = {};
  const purposeSet = new Set<string>();
  let totalNeg = 0;
  let totalPos = 0;
  let totalRowsCount = 0;
  let totalPasRowsCount = 0;
  let hasExtendedColumns = false;

  for (const date of activeDates) {
    const converted = getConvertedRows(data[date]);
    const dayNegSeen = new Set<string>();
    const dayPosSeen = new Set<string>();
    const dayPasSeen = new Set<string>();
    for (const r of converted) {
      totalRowsCount++;
      if (r[10] || r[13]) hasExtendedColumns = true;
      if (r[12]) purposeSet.add(r[12]);

      if (r[6] < 0) totalNeg += r[6];
      else if (r[6] > 0) totalPos += r[6];

      const name = r[0];
      const cat = r[8] || 'Lainnya';
      const subcat = r[14] || '';
      const code = r[13] || '';
      const purpose = r[12] || '';
      const loc = r[11] || '';

      if (!productMap[name]) {
        productMap[name] = {
          name,
          code,
          category: cat,
          subcategory: subcat,
          purposes: purpose ? [purpose] : [],
          location: loc,
          lastUnitPrice: r[5] || 0,
          negVal: 0,
          posVal: 0,
          netVal: 0,
          negDays: 0,
          posDays: 0,
          pasDays: 0,
          totalDays: 0,
          negQtyByUnit: {},
          posQtyByUnit: {},
          qtyByUnit: {},
        };
      }
      const stat = productMap[name];
      if (!stat.category || stat.category === 'Lainnya') {
        stat.category = cat;
      }
      if (!stat.code && code) stat.code = code;
      if (!stat.subcategory && subcat) stat.subcategory = subcat;
      if (!stat.location && loc) stat.location = loc;
      if (r[5] > 0) stat.lastUnitPrice = r[5];
      if (purpose && !stat.purposes.includes(purpose)) {
        stat.purposes.push(purpose);
      }
      stat.totalDays++;

      const unit = r[1] || 'Unit';
      const isNeg = r[6] < 0 || r[4] < -1e-9;
      const isPos = !isNeg && (r[6] > 0 || r[4] > 1e-9);
      const isDiff = isNeg || isPos;

      if (isNeg) {
        stat.negVal += r[6];
        stat.negQtyByUnit[unit] = (stat.negQtyByUnit[unit] ?? 0) + r[4];
        if (!dayNegSeen.has(name)) {
          stat.negDays++;
          dayNegSeen.add(name);
        }
      } else if (isPos) {
        stat.posVal += r[6];
        stat.posQtyByUnit[unit] = (stat.posQtyByUnit[unit] ?? 0) + r[4];
        if (!dayPosSeen.has(name)) {
          stat.posDays++;
          dayPosSeen.add(name);
        }
      } else {
        totalPasRowsCount++;
        if (!dayPasSeen.has(name)) {
          stat.pasDays++;
          dayPasSeen.add(name);
        }
      }
      stat.netVal += r[6];
      stat.qtyByUnit[unit] = (stat.qtyByUnit[unit] ?? 0) + r[4];

      if (!categoryMap[cat]) {
        categoryMap[cat] = {
          category: cat,
          negVal: 0,
          posVal: 0,
          netVal: 0,
          diffItems: 0,
          totalItems: 0,
        };
      }
      const cStat = categoryMap[cat];
      cStat.totalItems++;
      if (r[6] < 0) cStat.negVal += r[6];
      else if (r[6] > 0) cStat.posVal += r[6];
      cStat.netVal += r[6];
      if (isDiff) cStat.diffItems++;
    }
  }

  const missingDays: number[] = [];
  if (scope === 'range' && rangeStart && rangeEnd) {
    const firstDay = Number(rangeStart.slice(8));
    const lastDay = Number(rangeEnd.slice(8));
    for (let d = firstDay; d <= lastDay; d++) {
      const iso = `${monthKey}-${String(d).padStart(2, '0')}`;
      if (!data[iso]) missingDays.push(d);
    }
  } else if (allMonthDates.length > 0) {
    const firstDay = Number(allMonthDates[0].slice(8));
    const lastDay = Number(allMonthDates[allMonthDates.length - 1].slice(8));
    for (let d = firstDay; d <= lastDay; d++) {
      const iso = `${monthKey}-${String(d).padStart(2, '0')}`;
      if (!data[iso]) missingDays.push(d);
    }
  }

  const netTotal = totalNeg + totalPos;

  const products = Object.values(productMap);
  const negProductCount = products.filter((p) => p.netVal < -0.5).length;
  const posProductCount = products.filter((p) => p.netVal > 0.5).length;
  const pasProductCount = products.filter(
    (p) => Math.abs(p.netVal) <= 0.5
  ).length;
  const topDeficits = products
    .filter((p) => p.netVal < -0.5)
    .sort((a, b) => a.netVal - b.netVal)
    .slice(0, 10);
  const topSurpluses = products
    .filter((p) => p.netVal > 0.5)
    .sort((a, b) => b.netVal - a.netVal)
    .slice(0, 10);

  const categoryStats = Object.values(categoryMap).sort(
    (a, b) => a.negVal - b.negVal
  );

  return {
    scope,
    resolvedDate,
    rangeStart,
    rangeEnd,
    branchName,
    locationName,
    allMonthDates,
    activeDates,
    dailyStats,
    productMap,
    categoryStats,
    allPurposes: Array.from(purposeSet).sort(),
    missingDays,
    totalNeg,
    totalPos,
    netTotal,
    totalRowsCount,
    totalPasRowsCount,
    hasExtendedColumns,
    negProductCount,
    posProductCount,
    pasProductCount,
    topDeficits,
    topSurpluses,
  };
}

export type SummaryResult = ReturnType<typeof computeSummary>;

const AI_QUESTION_STOPWORDS = new Set([
  'pada',
  'tanggal',
  'tgl',
  'bulan',
  'tahun',
  'hari',
  'ini',
  'itu',
  'yang',
  'dan',
  'atau',
  'dari',
  'untuk',
  'dengan',
  'kenapa',
  'mengapa',
  'berapa',
  'apa',
  'apakah',
  'bagaimana',
  'gimana',
  'tolong',
  'coba',
  'lihat',
  'cek',
  'cari',
  'data',
  'stok',
  'opname',
  'menu',
  'harian',
  'barang',
  'beranda',
  'laba',
  'rugi',
  'laporan',
  'selisih',
  'minus',
  'kurang',
  'lebih',
  'plus',
  'pas',
  'pack',
  'pak',
  'dus',
  'dos',
  'botol',
  'btl',
  'jerigen',
  'galon',
  'slop',
  'ball',
  'pcs',
  'porsi',
  'kg',
  'gram',
  'gr',
  'liter',
  'ml',
  'rupiah',
  'rp',
  'rb',
  'jt',
  'sistem',
  'esb',
  'gudang',
  'hitungan',
  'nov',
  'november',
  'okt',
  'oktober',
  'des',
  'desember',
  'jan',
  'feb',
  'mar',
  'apr',
  'mei',
  'jun',
  'jul',
  'agu',
  'sep',
]);

export function buildAiStockContext(
  summary: SummaryResult,
  monthKey: string,
  data?: StockDataset,
  options?: { question?: string; currentMenu?: string; compact?: boolean }
): string {
  const isCompact = Boolean(options?.compact);
  const rawQuestion = (options?.question ?? '').toLowerCase();

  // Extract explicit day numbers (1..31) after stripping decimal numbers like "4,18" or "4.18"
  const questionWithoutDecimals = rawQuestion.replace(/\d+[,.]\d+/g, ' ');
  const askedDayNums = Array.from(
    new Set(
      (questionWithoutDecimals.match(/\b([1-9]|[12]\d|3[01])\b/g) ?? []).map(
        (n) => n.padStart(2, '0')
      )
    )
  );

  // Meaningful product/category keywords (excluding stopwords and pure numbers)
  const productKeywords = questionWithoutDecimals
    .split(/[\s,?.!:/()-]+/)
    .filter(
      (w) =>
        w.length >= 2 &&
        !/^\d+$/.test(w) &&
        !AI_QUESTION_STOPWORDS.has(w)
    );

  const keywords = rawQuestion
    .split(/[\s,?.!:/()-]+/)
    .filter((w) => w.length >= 2);

  const periodLabel =
    summary.scope === 'month'
      ? `Bulan ${formatMonthId(monthKey)} (${summary.activeDates.length} hari: ${formatDateId(
          summary.activeDates[0]
        )} - ${formatDateId(
          summary.activeDates[summary.activeDates.length - 1]
        )})`
      : summary.scope === 'range'
      ? `Rentang ${formatDateRangeLabel(summary.rangeStart, summary.rangeEnd)} (${summary.activeDates.length} hari ada data)`
      : `Tanggal ${formatDateId(summary.resolvedDate)} (1 hari saja)`;

  const netLabel =
    summary.netTotal < -0.5
      ? `MINUS -${formatRupiah(summary.netTotal)}`
      : summary.netTotal > 0.5
      ? `LEBIH +${formatRupiah(summary.netTotal)}`
      : 'PAS Rp 0';

  const lines: string[] = [
    `Cabang: ${summary.branchName || 'Toko'}`,
    ...(options?.currentMenu ? [`Menu dibuka: ${options.currentMenu}`] : []),
    `Periode dipilih di layar: ${periodLabel}`,
    `Hasil Akhir Periode: ${netLabel}`,
    `Total Minus (Kurang): -${formatRupiah(summary.totalNeg)} (${summary.negProductCount} barang)`,
    `Total Lebih (Plus): +${formatRupiah(summary.totalPos)} (${summary.posProductCount} barang)`,
  ];

  if (summary.missingDays.length > 0) {
    lines.push(
      `Tanggal belum diupload di bulan ini: tgl ${summary.missingDays.join(', ')}`
    );
  }

  const allProducts = Object.values(summary.productMap).sort(
    (a, b) => Math.abs(b.netVal) - Math.abs(a.netVal)
  );

  const formatDetailedRowForAi = (dateKey: string, r: StockRow): string => {
    const unit = r[1] || 'Unit';
    const diffQty = r[4];
    const diffVal = r[6];
    const innerPack = formatInnerPackDiff(diffQty, unit, r[0]);
    const packEquiv = formatPackEquivalent(Math.abs(diffQty), unit, r[0]);
    const statusStr =
      diffQty < -1e-9 || diffVal < -0.5
        ? `Minus ${formatQty(diffQty)} ${unit}${
            innerPack ? ` (${innerPack}${packEquiv ? ` / ${packEquiv}` : ''})` : ''
          }`
        : diffQty > 1e-9 || diffVal > 0.5
        ? `Lebih ${formatQty(diffQty)} ${unit}${
            innerPack ? ` (${innerPack}${packEquiv ? ` / ${packEquiv}` : ''})` : ''
          }`
        : `Pas 0 ${unit}`;
    const valStr =
      diffVal < -0.5
        ? `-${formatRupiah(diffVal)}`
        : diffVal > 0.5
        ? `+${formatRupiah(diffVal)}`
        : 'Rp 0';
    const extraParts = [
      r[13] ? `Kode:${r[13]}` : '',
      r[5] > 0 ? `Harga/Unit:${formatRupiah(r[5])}/${unit}` : '',
      r[10] ? `No.SO:${r[10]}` : '',
      r[12] ? `Keperluan:${r[12]}` : '',
      r[15] ? r[15] : '',
    ].filter(Boolean);
    return `${dateKey} (${formatDateId(dateKey)}) | ${r[0]} | Bagian:${
      r[8] || 'Lainnya'
    } | Di Sistem ESB: ${formatQty(r[2])} ${unit} | Hitungan Gudang: ${formatQty(
      r[3]
    )} ${unit} | Selisih: ${statusStr} | Nilai: ${valStr}${
      extraParts.length > 0 ? ` | ${extraParts.join(' | ')}` : ''
    }`;
  };

  // HIGH-PRIORITY QUESTION SPOTLIGHT: Put exact matched products & dates at the very top!
  if (data && (productKeywords.length > 0 || askedDayNums.length > 0)) {
    const spotlightLines: string[] = [];

    if (productKeywords.length > 0) {
      const scoredProducts = allProducts
        .map((p) => {
          const hay = `${p.name} ${p.code || ''} ${p.category}`.toLowerCase();
          let score = 0;
          for (const kw of productKeywords) {
            if (hay.includes(kw)) score += kw.length >= 4 ? 2 : 1;
          }
          return { product: p, score };
        })
        .filter((item) => item.score > 0)
        .sort(
          (a, b) =>
            b.score - a.score ||
            Math.abs(b.product.netVal) - Math.abs(a.product.netVal)
        )
        .slice(0, 4);

      for (const { product: p } of scoredProducts) {
        const pkgSpec = getItemPackagingSpec(p.name);
        const netSummary =
          p.netVal < -0.5
            ? `Minus ${formatQtyMap(p.qtyByUnit, p.name, false)} (-${formatRupiah(
                p.netVal
              )})`
            : p.netVal > 0.5
            ? `Lebih ${formatQtyMap(p.qtyByUnit, p.name, false)} (+${formatRupiah(
                p.netVal
              )})`
            : 'Pas Rp 0';

        spotlightLines.push(
          `\n[BARANG YANG DITANYAKAN: ${p.code ? `${p.code} ` : ''}${p.name} (Bagian ${
            p.category
          })]`,
          `- Standar Satuan & Kemasan: ${
            pkgSpec ? pkgSpec.specText : 'Sesuai satuan dasar'
          }`,
          `- Harga Satuan Terakhir: ${
            p.lastUnitPrice > 0 ? formatRupiah(p.lastUnitPrice) : '-'
          }`,
          `- Ringkasan Akumulasi Periode (${periodLabel}): Pernah Minus di ${
            p.negDays
          } hari (Total Saat Minus: ${
            Object.keys(p.negQtyByUnit).length > 0
              ? formatQtyMap(p.negQtyByUnit, p.name, false)
              : '0'
          } / -${formatRupiah(p.negVal)}), Pernah Lebih di ${
            p.posDays
          } hari (Total Saat Lebih: ${
            Object.keys(p.posQtyByUnit).length > 0
              ? formatQtyMap(p.posQtyByUnit, p.name, false)
              : '0'
          } / +${formatRupiah(p.posVal)}), Pas di ${
            p.pasDays
          } hari -> Hasil Bersih Gabungan Periode = ${netSummary}.`
        );

        // Collect all daily rows for this product across all stored dates in active month
        const productDailyRows: { dateKey: string; row: StockRow }[] = [];
        for (const dateKey of summary.allMonthDates) {
          const converted = getConvertedRows(data[dateKey] ?? []);
          for (const r of converted) {
            if (r[0] === p.name) {
              productDailyRows.push({ dateKey, row: r });
            }
          }
        }

        // Highlight specific date(s) asked by the user first!
        if (askedDayNums.length > 0) {
          for (const dayNum of askedDayNums) {
            const matchedDayEntries = productDailyRows.filter((e) =>
              e.dateKey.endsWith(`-${dayNum}`)
            );
            for (const entry of matchedDayEntries) {
              const r = entry.row;
              const unit = r[1] || 'Unit';
              const diffQty = r[4];
              const diffVal = r[6];
              const innerPack = formatInnerPackDiff(diffQty, unit, r[0]);
              const isMinus = diffQty < -1e-9 || diffVal < -0.5;
              const isPlus = diffQty > 1e-9 || diffVal > 0.5;
              spotlightLines.push(
                `- >>> DATA SPESIFIK TANGGAL ${formatDateId(
                  entry.dateKey
                )} (${entry.dateKey}) UNTUK ${p.name}: Di Sistem ESB tercatat ${formatQty(
                  r[2]
                )} ${unit}, sedangkan Hitungan Gudang adalah ${formatQty(
                  r[3]
                )} ${unit}. Karena Hitungan Gudang ${
                  isMinus
                    ? `lebih sedikit ${formatQty(diffQty)} ${unit} dari Sistem ESB`
                    : isPlus
                    ? `lebih banyak ${formatQty(diffQty)} ${unit} dari Sistem ESB`
                    : 'sama dengan Sistem ESB'
                }, maka pada tanggal ${formatDateId(entry.dateKey)} tercatat ${
                  isMinus
                    ? `MINUS ${formatQty(diffQty)} ${unit}${
                        innerPack ? ` (setara ${innerPack})` : ''
                      } dengan nilai -${formatRupiah(diffVal)}`
                    : isPlus
                    ? `LEBIH ${formatQty(diffQty)} ${unit}${
                        innerPack ? ` (setara ${innerPack})` : ''
                      } dengan nilai +${formatRupiah(diffVal)}`
                    : 'PAS (Rp 0)'
                } (Harga/Unit: ${
                  r[5] > 0 ? `${formatRupiah(r[5])} / ${unit}` : '-'
                }${r[10] ? `, No.SO: ${r[10]}` : ''}).`
              );
            }
          }
        }

        if (productDailyRows.length > 0) {
          spotlightLines.push(
            `- Riwayat Harian Lengkap ${p.name} per Tanggal:`
          );
          for (const entry of productDailyRows) {
            spotlightLines.push(
              `  * ${formatDetailedRowForAi(entry.dateKey, entry.row)}`
            );
          }
        }
      }
    } else if (askedDayNums.length > 0) {
      // User asked about specific date(s) without specifying a product name
      for (const dayNum of askedDayNums) {
        const matchedDates = summary.allMonthDates.filter((d) =>
          d.endsWith(`-${dayNum}`)
        );
        for (const dateKey of matchedDates) {
          const converted = getConvertedRows(data[dateKey] ?? []);
          const diffRows = converted
            .filter((r) => Math.abs(r[4]) > 1e-9 || Math.abs(r[6]) > 0.5)
            .sort((a, b) => a[6] - b[6]);
          spotlightLines.push(
            `\n[DATA HARIAN TANGGAL ${formatDateId(dateKey)} (${dateKey}) — ${
              diffRows.length
            } barang selisih dari ${converted.length} baris]:`
          );
          for (const r of diffRows.slice(0, 40)) {
            spotlightLines.push(`  * ${formatDetailedRowForAi(dateKey, r)}`);
          }
        }
      }
    }

    if (spotlightLines.length > 0) {
      lines.push(
        '\n=== DATA SPESIFIK YANG COCOK DENGAN PERTANYAAN PENGGUNA (PRIORITAS UTAMA) ===',
        ...spotlightLines,
        '=== AKHIR DATA SPESIFIK PERTANYAAN ==='
      );
    }
  }

  // All stored months overview (Menu Upload / Pengaturan)
  if (data) {
    const allDates = Object.keys(data).sort();
    const months = Array.from(new Set(allDates.map((d) => d.slice(0, 7))));
    if (months.length > 0) {
      lines.push('\nDaftar Semua Bulan Tersimpan:');
      for (const m of months) {
        const mDates = allDates.filter((d) => d.startsWith(m));
        let mNeg = 0;
        let mPos = 0;
        for (const d of mDates) {
          for (const r of data[d]) {
            if (r[6] < 0) mNeg += r[6];
            else if (r[6] > 0) mPos += r[6];
          }
        }
        const mNet = mNeg + mPos;
        lines.push(
          `- ${formatMonthId(m)} (${mDates.length} hari): Minus -${formatRupiah(
            mNeg
          )}, Lebih +${formatRupiah(mPos)}, Hasil ${
            mNet < 0 ? 'MINUS -' : 'LEBIH +'
          }${formatRupiah(mNet)}`
        );
      }
    }
  }

  if (summary.categoryStats.length > 0) {
    lines.push('\nRingkasan Per Bagian (Periode Dipilih):');
    for (const c of summary.categoryStats) {
      const cNet =
        c.netVal < -0.5
          ? `Minus ${formatRupiah(c.netVal)}`
          : c.netVal > 0.5
          ? `Lebih ${formatRupiah(c.netVal)}`
          : 'Pas Rp 0';
      lines.push(
        `- ${c.category}: Minus ${formatRupiah(c.negVal)}, Lebih ${formatRupiah(
          c.posVal
        )}, Hasil ${cNet}`
      );
    }
  }

  // Products in active scope (Menu Cek Barang)
  if (allProducts.length > 0) {
    const selectedProducts = isCompact
      ? (() => {
          const matched =
            productKeywords.length > 0
              ? allProducts.filter((p) =>
                  productKeywords.some(
                    (kw) =>
                      p.name.toLowerCase().includes(kw) ||
                      p.category.toLowerCase().includes(kw) ||
                      (p.code || '').toLowerCase().includes(kw)
                  )
                )
              : [];
          const picked = new Set(matched.slice(0, 25));
          for (const p of allProducts) {
            if (picked.size >= 45) break;
            picked.add(p);
          }
          return Array.from(picked);
        })()
      : allProducts;

    lines.push(
      `\n${
        isCompact
          ? `Ringkasan Akumulasi Barang (${selectedProducts.length} dari ${allProducts.length} barang):`
          : `Semua Barang pada Periode Dipilih (${allProducts.length} barang):`
      }`
    );
    for (const p of selectedProducts) {
      const valStr =
        p.netVal < -0.5
          ? `-${formatRupiah(p.netVal)}`
          : p.netVal > 0.5
          ? `+${formatRupiah(p.netVal)}`
          : 'Rp 0';
      const codeStr = !isCompact && p.code ? `${p.code} ` : '';
      const subStr =
        !isCompact && p.subcategory && p.subcategory !== p.category
          ? `/${p.subcategory}`
          : '';
      const purpStr =
        !isCompact && p.purposes.length ? ` | Kep:${p.purposes.join(',')}` : '';
      const priceStr =
        !isCompact && p.lastUnitPrice > 0
          ? ` | Hrg:${formatRupiah(p.lastUnitPrice)}`
          : '';
      const pkgSpec = getItemPackagingSpec(p.name);
      const specStr =
        pkgSpec && pkgSpec.unitRatios
          ? ` | Kemasan: ${pkgSpec.specText}`
          : '';
      lines.push(
        `- ${codeStr}${p.name} [${p.category}${subStr}]: Hasil Akumulasi ${formatQtyMap(
          p.qtyByUnit,
          p.name,
          true
        )} (${valStr}) | minus ${p.negDays}hr (-${formatRupiah(
          p.negVal
        )}), lebih ${p.posDays}hr (+${formatRupiah(p.posVal)}), pas ${
          p.pasDays
        }hr${priceStr}${purpStr}${specStr}`
      );
    }
  }

  const flipFlop = allProducts
    .filter(
      (p) =>
        p.negVal < -20000 &&
        p.posVal > 20000 &&
        Math.abs(p.netVal) < Math.abs(p.negVal) * 0.8
    )
    .sort((a, b) => a.negVal - b.negVal)
    .slice(0, 12);
  if (flipFlop.length > 0) {
    lines.push(
      '\nBarang Bolak-Balik (pernah minus & pernah lebih di hari berbeda, indikasi salah hitung / telat input):'
    );
    for (const p of flipFlop) {
      lines.push(
        `- ${p.name}: Saat minus ${formatQtyMap(
          p.negQtyByUnit,
          p.name,
          false
        )} (-${formatRupiah(p.negVal)}), Saat lebih ${formatQtyMap(
          p.posQtyByUnit,
          p.name,
          false
        )} (+${formatRupiah(p.posVal)}) -> Hasil akhir ${formatQtyMap(
          p.qtyByUnit,
          p.name,
          true
        )}`
      );
    }
  }

  lines.push('\nRingkasan Harian Bulan Aktif (Menu Harian):');
  for (const d of summary.dailyStats) {
    const net = d.negVal + d.posVal;
    lines.push(
      `- ${d.date} (${formatDateId(d.date)}): Minus -${formatRupiah(
        d.negVal
      )}, Lebih +${formatRupiah(d.posVal)}, Hasil ${
        net < 0 ? '-' : '+'
      }${formatRupiah(net)} (${d.totalCount} baris: ${d.diffCount} selisih, ${d.pasCount} pas)`
    );
  }

  // Full per-date item rows (Menu Harian + Cek Barang detail)
  if (data) {
    const activeMonthRowCount = summary.allMonthDates.reduce(
      (sum, d) => sum + (data[d]?.length ?? 0),
      0
    );

    const formatRowLine = (dateKey: string, r: StockRow): string => {
      const unit = r[1] || 'Unit';
      const diffQty = r[4];
      const diffVal = r[6];
      const innerPack = formatInnerPackDiff(diffQty, unit, r[0]);
      const statusStr =
        diffQty < -1e-9 || diffVal < -0.5
          ? `Minus ${formatQty(diffQty)} ${unit}${
              innerPack ? ` (${innerPack})` : ''
            }`
          : diffQty > 1e-9 || diffVal > 0.5
          ? `Lebih ${formatQty(diffQty)} ${unit}${
              innerPack ? ` (${innerPack})` : ''
            }`
          : `Pas 0 ${unit}`;
      const valStr =
        diffVal < -0.5
          ? `-${formatRupiah(diffVal)}`
          : diffVal > 0.5
          ? `+${formatRupiah(diffVal)}`
          : 'Rp 0';
      const extraParts = isCompact
        ? [r[5] > 0 ? `Hrg:${formatRupiah(r[5])}` : ''].filter(Boolean)
        : [
            r[13] ? `Kode:${r[13]}` : '',
            r[10] ? `SP:${r[10]}` : '',
            r[12] ? `Kep:${r[12]}` : '',
            r[5] > 0 ? `Hrg:${formatRupiah(r[5])}` : '',
            r[15] ? r[15] : '',
          ].filter(Boolean);
      const extraJoined = extraParts.join(',');
      return `${dateKey}|${r[0]}|${r[8] || 'Lainnya'}|ESB:${formatQty(
        r[2]
      )}|Gudang:${formatQty(r[3])} ${unit}|${statusStr}|${valStr}${
        extraJoined ? `|${extraJoined}` : ''
      }`;
    };

    const rowLines: string[] = [];
    const includeAllRowsInMonth = !isCompact && activeMonthRowCount <= 1500;
    const compactScoredRows: { score: number; absVal: number; line: string }[] =
      [];
    const compactTopDiffRows: { absVal: number; line: string }[] = [];

    // Iterate newest dates first so latest days (e.g. 17 Nov) are prioritized
    const datesNewestFirst = summary.allMonthDates.slice().reverse();

    for (const dateKey of datesNewestFirst) {
      const converted = getConvertedRows(data[dateKey] ?? []);
      const dayNum = dateKey.slice(8, 10);
      const isAskedDay = askedDayNums.includes(dayNum);

      for (const r of converted) {
        const isNonZero = Math.abs(r[4]) > 1e-9 || Math.abs(r[6]) > 0.5;
        let matchScore = isAskedDay ? 3 : 0;
        if (productKeywords.length > 0) {
          const rowText = `${r[0]} ${r[8] || ''} ${r[10] || ''} ${
            r[13] || ''
          }`.toLowerCase();
          for (const kw of productKeywords) {
            if (rowText.includes(kw)) {
              matchScore += kw.length >= 4 ? 2 : 1;
            }
          }
        }

        if (isCompact) {
          if (matchScore > 0) {
            compactScoredRows.push({
              score: matchScore,
              absVal: Math.abs(r[6]),
              line: formatRowLine(dateKey, r),
            });
          } else if (isNonZero) {
            compactTopDiffRows.push({
              absVal: Math.abs(r[6]),
              line: formatRowLine(dateKey, r),
            });
          }
        } else if (includeAllRowsInMonth || isNonZero || matchScore > 0) {
          rowLines.push(formatRowLine(dateKey, r));
        }
      }
    }

    if (isCompact) {
      compactScoredRows
        .sort((a, b) => b.score - a.score || b.absVal - a.absVal)
        .slice(0, 60)
        .forEach((item) => rowLines.push(item.line));
      if (rowLines.length < 35) {
        compactTopDiffRows
          .sort((a, b) => b.absVal - a.absVal)
          .slice(0, 35 - rowLines.length)
          .forEach((item) => rowLines.push(item.line));
      }
    } else if (keywords.length > 0) {
      const otherDates = Object.keys(data)
        .filter((d) => !d.startsWith(monthKey))
        .sort()
        .reverse();
      let extraCount = 0;
      for (const dateKey of otherDates) {
        if (extraCount >= 250) break;
        const converted = getConvertedRows(data[dateKey] ?? []);
        for (const r of converted) {
          const matchesQuestion = productKeywords.some(
            (kw) =>
              r[0].toLowerCase().includes(kw) ||
              (r[8] || '').toLowerCase().includes(kw) ||
              (r[10] || '').toLowerCase().includes(kw) ||
              (r[13] || '').toLowerCase().includes(kw)
          );
          if (matchesQuestion) {
            rowLines.push(formatRowLine(dateKey, r));
            extraCount++;
            if (extraCount >= 250) break;
          }
        }
      }
    }

    if (rowLines.length > 0) {
      lines.push(
        '\nRincian Harian (Format: Tanggal|Nama Barang|Bagian|Sistem ESB|Hitungan Gudang|Selisih|Rupiah):'
      );
      lines.push(...rowLines);
    }
  }

  return lines.join('\n');
}

