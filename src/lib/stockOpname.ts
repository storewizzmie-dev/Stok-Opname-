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

export const CONVERSIONS: Record<string, ConversionRule> = {
  beras: {
    baseUnit: 'KG',
    dosMultiplier: 5,
    packLabel: 'Pack',
    otherUnits: { pack: 5 },
  },
  'dbl - ayam potong dadu': {
    baseUnit: 'KG',
    dosMultiplier: 10,
    packLabel: 'Dos',
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
    otherUnits: { 'pack @5porsi': 5 },
  },
  'fresh milk': {
    baseUnit: 'ML',
    dosMultiplier: 1000,
    packLabel: 'Btl',
    otherUnits: { btl: 1000 },
  },
  'kecap manis': {
    baseUnit: 'KG',
    dosMultiplier: 21,
    packLabel: 'Dos',
  },
  'minyak goreng': {
    baseUnit: 'L',
    dosMultiplier: 18,
    packLabel: 'Jrg',
    otherUnits: { jrg: 18 },
  },
  'skm carnation @2kg': {
    baseUnit: 'KG',
    dosMultiplier: 16,
    packLabel: 'Dos',
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
    otherUnits: { pack: 80 },
  },
  'wip - adonan pangsit': {
    baseUnit: 'KG',
    dosMultiplier: 12,
    packLabel: 'Dos',
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
  },
  'wip - ceker': {
    baseUnit: 'Porsi @3pcs',
    dosMultiplier: 100,
    packLabel: 'Dos',
  },
  'wip - lumpia ayam': {
    baseUnit: 'Porsi @3pcs',
    dosMultiplier: 130,
    packLabel: 'Dos',
  },
  'wip - lumpia udang': {
    baseUnit: 'PORSI',
    dosMultiplier: 110,
    packLabel: 'Dos',
  },
  'wip - mie': {
    baseUnit: 'Pcs',
    dosMultiplier: 160,
    packLabel: 'Dos',
  },
  'wip - pao ayam': {
    baseUnit: 'Porsi @3pcs',
    dosMultiplier: 70,
    packLabel: 'Dos',
  },
  'wip - siomay': {
    baseUnit: 'Porsi @3pcs',
    dosMultiplier: 140,
    packLabel: 'Dos',
  },
  'wip - udang keju': {
    baseUnit: 'Porsi @3pcs',
    dosMultiplier: 120,
    packLabel: 'Dos',
  },
  'wip - udang rambutan': {
    baseUnit: 'Porsi @3pcs',
    dosMultiplier: 140,
    packLabel: 'Dos',
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
  const tag = formatShortRupiahTag(absRounded);
  return tag ? `${base} (${tag})` : base;
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

export function formatPackEquivalent(
  absQty: number,
  unit: string,
  productName: string
): string {
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
      const equiv = formatPackEquivalent(Math.abs(val), unit, productName);
      const prefix = includeSignPrefix
        ? val < -1e-9
          ? 'Kurang '
          : 'Lebih '
        : '';
      return equiv ? `${prefix}${absStr} (${equiv})` : `${prefix}${absStr}`;
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

export type ViewScope = 'month' | 'day';

export function computeSummary(
  data: StockDataset,
  monthKey: string,
  scope: ViewScope = 'month',
  selectedDate?: string
) {
  const allMonthDates = Object.keys(data)
    .filter((d) => d.startsWith(monthKey))
    .sort();

  const resolvedDate =
    selectedDate && allMonthDates.includes(selectedDate)
      ? selectedDate
      : allMonthDates[allMonthDates.length - 1] ?? '';

  const activeDates =
    scope === 'day'
      ? resolvedDate
        ? [resolvedDate]
        : []
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
  if (allMonthDates.length > 0) {
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

export function buildAiStockContext(
  summary: SummaryResult,
  monthKey: string,
  data?: StockDataset,
  options?: { question?: string; currentMenu?: string }
): string {
  const periodLabel =
    summary.scope === 'month'
      ? `Bulan ${formatMonthId(monthKey)} (${summary.activeDates.length} hari: ${formatDateId(
          summary.activeDates[0]
        )} - ${formatDateId(
          summary.activeDates[summary.activeDates.length - 1]
        )})`
      : `Tanggal ${formatDateId(summary.resolvedDate)} (1 hari saja)`;

  const netLabel =
    summary.netTotal < -0.5
      ? `KURANG -${formatRupiah(summary.netTotal)}`
      : summary.netTotal > 0.5
      ? `LEBIH +${formatRupiah(summary.netTotal)}`
      : 'PAS Rp 0';

  const lines: string[] = [
    `Cabang: ${summary.branchName || 'Toko'}`,
    ...(options?.currentMenu ? [`Menu dibuka: ${options.currentMenu}`] : []),
    `Periode dipilih: ${periodLabel}`,
    `Hasil Akhir: ${netLabel}`,
    `Total Kurang (Minus): -${formatRupiah(summary.totalNeg)} (${summary.negProductCount} barang)`,
    `Total Lebih (Plus): +${formatRupiah(summary.totalPos)} (${summary.posProductCount} barang)`,
  ];

  if (summary.missingDays.length > 0) {
    lines.push(
      `Tanggal belum diupload di bulan ini: tgl ${summary.missingDays.join(', ')}`
    );
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
          `- ${formatMonthId(m)} (${mDates.length} hari): Kurang -${formatRupiah(
            mNeg
          )}, Lebih +${formatRupiah(mPos)}, Hasil ${
            mNet < 0 ? 'KURANG -' : 'LEBIH +'
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
          ? `Kurang ${formatRupiah(c.netVal)}`
          : c.netVal > 0.5
          ? `Lebih ${formatRupiah(c.netVal)}`
          : 'Pas Rp 0';
      lines.push(
        `- ${c.category}: Kurang ${formatRupiah(c.negVal)}, Lebih ${formatRupiah(
          c.posVal
        )}, Hasil ${cNet}`
      );
    }
  }

  // ALL products in active scope (Menu Cek Barang)
  const allProducts = Object.values(summary.productMap).sort(
    (a, b) => Math.abs(b.netVal) - Math.abs(a.netVal)
  );
  if (allProducts.length > 0) {
    lines.push(`\nSemua Barang pada Periode Dipilih (${allProducts.length} barang):`);
    for (const p of allProducts) {
      const valStr =
        p.netVal < -0.5
          ? `-${formatRupiah(p.netVal)}`
          : p.netVal > 0.5
          ? `+${formatRupiah(p.netVal)}`
          : 'Rp 0';
      const codeStr = p.code ? `${p.code} ` : '';
      const subStr = p.subcategory && p.subcategory !== p.category ? `/${p.subcategory}` : '';
      const purpStr = p.purposes.length ? ` | Kep:${p.purposes.join(',')}` : '';
      const priceStr = p.lastUnitPrice > 0 ? ` | Hrg:${formatRupiah(p.lastUnitPrice)}` : '';
      lines.push(
        `- ${codeStr}${p.name} [${p.category}${subStr}]: ${formatQtyMap(
          p.qtyByUnit,
          p.name,
          true
        )} (${valStr}) | krg ${p.negDays}hr, lbh ${p.posDays}hr, pas ${p.pasDays}hr${priceStr}${purpStr}`
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
      '\nBarang Bolak-Balik (pernah kurang & pernah lebih, indikasi salah hitung / telat input):'
    );
    for (const p of flipFlop) {
      lines.push(
        `- ${p.name}: Saat kurang ${formatQtyMap(
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
      `- ${d.date} (${formatDateId(d.date)}): Kurang -${formatRupiah(
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

    const keywords = (options?.question ?? '')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const formatRowLine = (dateKey: string, r: StockRow): string => {
      const unit = r[1] || 'Unit';
      const diffQty = r[4];
      const diffVal = r[6];
      const statusStr =
        diffQty < -1e-9 || diffVal < -0.5
          ? `Kurang ${formatQty(diffQty)} ${unit}`
          : diffQty > 1e-9 || diffVal > 0.5
          ? `Lebih ${formatQty(diffQty)} ${unit}`
          : `Pas 0 ${unit}`;
      const valStr =
        diffVal < -0.5
          ? `-${formatRupiah(diffVal)}`
          : diffVal > 0.5
          ? `+${formatRupiah(diffVal)}`
          : 'Rp 0';
      const extraParts = [
        r[13] ? `Kode:${r[13]}` : '',
        r[10] ? `SP:${r[10]}` : '',
        r[12] ? `Kep:${r[12]}` : '',
        r[5] > 0 ? `Hrg:${formatRupiah(r[5])}` : '',
        r[15] ? r[15] : '',
      ]
        .filter(Boolean)
        .join(',');
      return `${dateKey}|${r[0]}|${r[8] || 'Lainnya'}|ESB:${formatQty(
        r[2]
      )}|Gudang:${formatQty(r[3])} ${unit}|${statusStr}|${valStr}${
        extraParts ? `|${extraParts}` : ''
      }`;
    };

    const rowLines: string[] = [];
    const includeAllRowsInMonth = activeMonthRowCount <= 1500;

    for (const dateKey of summary.allMonthDates) {
      const converted = getConvertedRows(data[dateKey] ?? []);
      for (const r of converted) {
        const isNonZero = Math.abs(r[4]) > 1e-9 || Math.abs(r[6]) > 0.5;
        const matchesQuestion =
          keywords.length > 0 &&
          keywords.some(
            (kw) =>
              r[0].toLowerCase().includes(kw) ||
              (r[8] || '').toLowerCase().includes(kw) ||
              (r[10] || '').toLowerCase().includes(kw) ||
              (r[12] || '').toLowerCase().includes(kw) ||
              (r[13] || '').toLowerCase().includes(kw) ||
              (r[14] || '').toLowerCase().includes(kw) ||
              dateKey.includes(kw)
          );
        if (includeAllRowsInMonth || isNonZero || matchesQuestion) {
          rowLines.push(formatRowLine(dateKey, r));
        }
      }
    }

    // If user asked about a product/date in other stored months too, attach matches
    if (keywords.length > 0) {
      const otherDates = Object.keys(data)
        .filter((d) => !d.startsWith(monthKey))
        .sort();
      let extraCount = 0;
      for (const dateKey of otherDates) {
        if (extraCount >= 250) break;
        const converted = getConvertedRows(data[dateKey] ?? []);
        for (const r of converted) {
          const matchesQuestion = keywords.some(
            (kw) =>
              r[0].toLowerCase().includes(kw) ||
              (r[8] || '').toLowerCase().includes(kw) ||
              (r[10] || '').toLowerCase().includes(kw) ||
              (r[12] || '').toLowerCase().includes(kw) ||
              (r[13] || '').toLowerCase().includes(kw) ||
              (r[14] || '').toLowerCase().includes(kw) ||
              dateKey.includes(kw)
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
        '\nRincian Harian Lengkap (Format: Tanggal|Nama Barang|Bagian|Sistem ESB|Hitungan Gudang|Selisih|Rupiah|Info Tambahan):'
      );
      lines.push(...rowLines);
    }
  }

  return lines.join('\n');
}

