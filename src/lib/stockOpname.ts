import * as XLSX from 'xlsx';

/**
 * Tuple layout kept backward-compatible with localStorage('so') and JSON backups:
 * [0] product, [1] unit, [2] systemStock, [3] opnameStock,
 * [4] diffQty, [5] valuePerUnit, [6] diffValue, [7] additionalInfo,
 * [8]? category, [9]? branch
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
  otherUnits?: Record<string, number>;
}

export const CONVERSIONS: Record<string, ConversionRule> = {
  beras: { baseUnit: 'KG', dosMultiplier: 5, otherUnits: { pack: 5 } },
  'dbl - ayam potong dadu': { baseUnit: 'KG', dosMultiplier: 10 },
  'dbl - cabai rawit': { baseUnit: 'KG', dosMultiplier: 10 },
  'dbl - sayap': {
    baseUnit: 'PORSI',
    dosMultiplier: 50,
    otherUnits: { 'pack @5porsi': 5 },
  },
  'fresh milk': { baseUnit: 'ML', dosMultiplier: 1000, otherUnits: { btl: 1000 } },
  'kecap manis': { baseUnit: 'KG', dosMultiplier: 21 },
  'minyak goreng': { baseUnit: 'L', dosMultiplier: 18, otherUnits: { jrg: 18 } },
  'skm carnation @2kg': { baseUnit: 'KG', dosMultiplier: 16 },
  'tepung wizzchick (tepung krispi)': { baseUnit: 'KG', dosMultiplier: 14 },
  'tong tji super jasmine tea': {
    baseUnit: 'GR',
    dosMultiplier: 80,
    otherUnits: { pack: 80 },
  },
  'wip - adonan pangsit': { baseUnit: 'KG', dosMultiplier: 12 },
  'wip - ayam tabur': { baseUnit: 'KG', dosMultiplier: 9 },
  'wip - bola keju': { baseUnit: 'PORSI', dosMultiplier: 140 },
  'wip - ceker': { baseUnit: 'Porsi @3pcs', dosMultiplier: 100 },
  'wip - lumpia ayam': { baseUnit: 'Porsi @3pcs', dosMultiplier: 130 },
  'wip - lumpia udang': { baseUnit: 'PORSI', dosMultiplier: 110 },
  'wip - mie': { baseUnit: 'Pcs', dosMultiplier: 160 },
  'wip - pao ayam': { baseUnit: 'Porsi @3pcs', dosMultiplier: 70 },
  'wip - siomay': { baseUnit: 'Porsi @3pcs', dosMultiplier: 140 },
  'wip - udang keju': { baseUnit: 'Porsi @3pcs', dosMultiplier: 120 },
  'wip - udang rambutan': { baseUnit: 'Porsi @3pcs', dosMultiplier: 140 },
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

export function formatRupiah(amount: number): string {
  return `Rp ${Math.abs(Math.round(amount)).toLocaleString('id-ID')}`;
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
    const cleaned = val.trim().replace(/\s+/g, '');
    if (!cleaned) return 0;
    const parsed = Number(cleaned.replace(/,/g, ''));
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
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) {
    throw new Error('Sheet pertama tidak ditemukan di file.');
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
  });

  const headerIdx = rows.findIndex(
    (r) =>
      Array.isArray(r) &&
      r.some(
        (cell) => String(cell ?? '').trim().toLowerCase() === 'stock opname date'
      )
  );

  if (headerIdx < 0) {
    throw new Error('Baris judul kolom "Stock Opname date" tidak ditemukan.');
  }

  const headers = rows[headerIdx].map((c) =>
    String(c ?? '').trim().toLowerCase()
  );
  const idx = (name: string) => headers.indexOf(name);

  const cols = {
    date: idx('stock opname date'),
    branch: idx('branch'),
    product: idx('product'),
    category: idx('category'),
    unit: idx('unit'),
    system: idx('period system stock'),
    opname: idx('opname stock'),
    diffQty: idx('difference qty'),
    valUnit: idx('value per unit'),
    diffVal: idx('difference value'),
    info: idx('additional information'),
  };

  if (cols.product < 0 || cols.diffVal < 0 || cols.diffQty < 0) {
    throw new Error(
      'Kolom Product, Difference Qty, atau Difference Value tidak ada.'
    );
  }

  const out: StockDataset = {};
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
    ]);
  }

  return out;
}

export interface DailyStat {
  date: string;
  negVal: number;
  posVal: number;
  cumNegVal: number;
  diffCount: number;
}

export interface ProductStat {
  name: string;
  category: string;
  negVal: number;
  posVal: number;
  netVal: number;
  negDays: number;
  qtyByUnit: Record<string, number>;
}

export interface CategoryStat {
  category: string;
  negVal: number;
  posVal: number;
  netVal: number;
  diffItems: number;
}

export function computeSummary(
  data: StockDataset,
  monthKey: string,
  toDate: string
) {
  const allMonthDates = Object.keys(data)
    .filter((d) => d.startsWith(monthKey))
    .sort();
  const activeDates = allMonthDates.filter((d) => d <= toDate);

  let branchName = '';
  let cumNeg = 0;
  const dailyStats: DailyStat[] = activeDates.map((date) => {
    let negVal = 0;
    let posVal = 0;
    let diffCount = 0;
    for (const r of data[date]) {
      if (!branchName && r[9]) branchName = r[9];
      if (r[6] < 0) negVal += r[6];
      else if (r[6] > 0) posVal += r[6];
      if (Math.abs(r[4]) > 1e-9 || Math.abs(r[6]) > 0.5) diffCount++;
    }
    cumNeg += negVal;
    return {
      date,
      negVal,
      posVal,
      cumNegVal: cumNeg,
      diffCount,
    };
  });

  const productMap: Record<string, ProductStat> = {};
  const categoryMap: Record<string, CategoryStat> = {};

  for (const date of activeDates) {
    const converted = getConvertedRows(data[date]);
    const dayNegSeen = new Set<string>();
    for (const r of converted) {
      const name = r[0];
      const cat = r[8] || 'Lainnya';

      if (!productMap[name]) {
        productMap[name] = {
          name,
          category: cat,
          negVal: 0,
          posVal: 0,
          netVal: 0,
          negDays: 0,
          qtyByUnit: {},
        };
      }
      const stat = productMap[name];
      if (!stat.category || stat.category === 'Lainnya') {
        stat.category = cat;
      }
      if (r[6] < 0) {
        stat.negVal += r[6];
        if (!dayNegSeen.has(name)) {
          stat.negDays++;
          dayNegSeen.add(name);
        }
      } else if (r[6] > 0) {
        stat.posVal += r[6];
      }
      stat.netVal += r[6];
      const unit = r[1] || 'Unit';
      stat.qtyByUnit[unit] = (stat.qtyByUnit[unit] ?? 0) + r[4];

      if (Math.abs(r[4]) > 1e-9 || Math.abs(r[6]) > 0.5) {
        if (!categoryMap[cat]) {
          categoryMap[cat] = {
            category: cat,
            negVal: 0,
            posVal: 0,
            netVal: 0,
            diffItems: 0,
          };
        }
        const cStat = categoryMap[cat];
        if (r[6] < 0) cStat.negVal += r[6];
        else if (r[6] > 0) cStat.posVal += r[6];
        cStat.netVal += r[6];
        cStat.diffItems++;
      }
    }
  }

  const missingDays: number[] = [];
  if (allMonthDates.length > 0) {
    const firstDay = Number(allMonthDates[0].slice(8));
    const lastDay = Number(allMonthDates[allMonthDates.length - 1].slice(8));
    for (let d = firstDay; d <= lastDay; d++) {
      const iso = `${monthKey}-${String(d).padStart(2, '0')}`;
      if (!data[iso]) missingDays.push(d);
    }
  }

  const totalNeg = dailyStats.reduce((sum, x) => sum + x.negVal, 0);
  const totalPos = dailyStats.reduce((sum, x) => sum + x.posVal, 0);
  const netTotal = totalNeg + totalPos;

  const products = Object.values(productMap);
  const negProductCount = products.filter((p) => p.negVal < 0).length;
  const posProductCount = products.filter((p) => p.posVal > 0).length;
  const topDeficits = products
    .filter((p) => p.negVal < 0)
    .sort((a, b) => a.negVal - b.negVal)
    .slice(0, 10);

  const categoryStats = Object.values(categoryMap).sort(
    (a, b) => a.negVal - b.negVal
  );

  return {
    branchName,
    allMonthDates,
    activeDates,
    dailyStats,
    productMap,
    categoryStats,
    missingDays,
    totalNeg,
    totalPos,
    netTotal,
    negProductCount,
    posProductCount,
    topDeficits,
  };
}
