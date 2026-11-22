import * as XLSX from 'xlsx';

/**
 * Fitur Laba Rugi (Profit Loss Consolidation Report).
 *
 * Rumus: setiap baris Description dibagi Net Sales x 100 = persen.
 * Data disimpan per outlet + bulan (bulan diambil dari baris "Period" di file).
 *  - Upload bulan yang sama   -> data bulan itu diperbarui (ditimpa file terbaru).
 *  - Upload bulan yang berbeda -> otomatis jadi data bulan baru.
 *
 * Disimpan di localStorage key 'pl_v1', terpisah total dari data Stok Opname ('so').
 */

export const PL_STORAGE_KEY = 'pl_v1';

export interface PlLine {
  account: string;
  description: string;
  value: number;
  /** true untuk baris tanpa kode Account (Total Sales, Net Sales, Gross Profit, dst). */
  isTotal: boolean;
}

export interface PlReport {
  /** `${outlet}|${month}` */
  id: string;
  outlet: string;
  /** YYYY-MM, dari tanggal awal Period. */
  month: string;
  /** YYYY-MM-DD */
  periodStart: string;
  /** YYYY-MM-DD */
  periodEnd: string;
  netSales: number;
  lines: PlLine[];
  /** ISO timestamp saat file diupload. */
  uploadedAt: string;
}

export type PlStore = Record<string, PlReport>;

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeDesc(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Persen = value / netSales x 100. Net Sales 0 -> null (tidak bisa dihitung). */
export function pctOfNetSales(value: number, netSales: number): number | null {
  if (!Number.isFinite(netSales) || Math.abs(netSales) < 1e-9) return null;
  return (value / netSales) * 100;
}

/**
 * Baca baris-baris sheet (array of arrays) menjadi satu laporan.
 * Dipisah dari XLSX supaya mudah diuji.
 */
export function parseProfitLossRows(
  rows: unknown[][],
  uploadedAt: string = new Date().toISOString()
): PlReport {
  // 1) Header kolom: baris yang berisi "Account" | "Description" ...
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (
      normalizeDesc(cellText(r[0])) === 'account' &&
      normalizeDesc(cellText(r[1])) === 'description'
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    throw new Error(
      'bukan laporan Profit Loss (kolom "Account" dan "Description" tidak ditemukan)'
    );
  }

  // 2) Kolom nilai: kolom berjudul "Value" (angka murni). Cadangan: kolom terakhir.
  const headerRow = rows[headerIdx] ?? [];
  let valueCol = -1;
  for (let c = 2; c < headerRow.length; c++) {
    if (normalizeDesc(cellText(headerRow[c])) === 'value') valueCol = c;
  }
  if (valueCol < 0) {
    for (let c = headerRow.length - 1; c >= 2; c--) {
      if (cellText(headerRow[c]) !== '') {
        valueCol = c;
        break;
      }
    }
  }
  if (valueCol < 0) throw new Error('kolom "Value" tidak ditemukan');

  // 3) Outlet: baris ke-2 judul laporan (mis. "079 Wizzmie Bandar Padang").
  let outlet = '';
  for (let i = 0; i < headerIdx; i++) {
    const t = cellText(rows[i]?.[0]);
    if (!t) continue;
    if (/^profit\s*loss/i.test(t)) continue;
    if (/^(generated|period|show zero|mode|report file)/i.test(t)) continue;
    outlet = t;
    break;
  }
  if (!outlet) outlet = cellText(headerRow[2]) || 'Outlet';

  // 4) Period: "01-11-2026 - 30-11-2026"
  let periodText = '';
  for (let i = 0; i < headerIdx; i++) {
    if (normalizeDesc(cellText(rows[i]?.[0])) === 'period') {
      periodText = cellText(rows[i]?.[1]);
      break;
    }
  }
  const pm = periodText.match(
    /(\d{1,2})-(\d{1,2})-(\d{4})\s*-\s*(\d{1,2})-(\d{1,2})-(\d{4})/
  );
  if (!pm) {
    throw new Error('baris "Period" (tanggal awal - akhir) tidak ditemukan');
  }
  const pad = (s: string) => s.padStart(2, '0');
  const periodStart = `${pm[3]}-${pad(pm[2])}-${pad(pm[1])}`;
  const periodEnd = `${pm[6]}-${pad(pm[5])}-${pad(pm[4])}`;
  const month = periodStart.slice(0, 7);

  // 5) Baris data
  const lines: PlLine[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const description = cellText(r[1]);
    if (!description) continue;
    const value = toNumber(r[valueCol]);
    if (value === null) continue;
    const account = cellText(r[0]);
    lines.push({ account, description, value, isTotal: account === '' });
  }
  if (!lines.length) throw new Error('tidak ada baris data yang terbaca');

  const netSalesLine = lines.find(
    (l) => normalizeDesc(l.description) === 'net sales'
  );
  if (!netSalesLine) throw new Error('baris "Net Sales" tidak ditemukan');

  return {
    id: `${outlet}|${month}`,
    outlet,
    month,
    periodStart,
    periodEnd,
    netSales: netSalesLine.value,
    lines,
    uploadedAt,
  };
}

export function parseProfitLossBuffer(buffer: ArrayBuffer): PlReport {
  const wb = XLSX.read(buffer, { type: 'array' });
  if (!wb.SheetNames.length) throw new Error('file Excel kosong');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
  });
  return parseProfitLossRows(rows);
}

function isValidReport(r: unknown): r is PlReport {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.outlet === 'string' &&
    typeof o.month === 'string' &&
    /^\d{4}-\d{2}$/.test(o.month) &&
    typeof o.netSales === 'number' &&
    Array.isArray(o.lines)
  );
}

export function sanitizePlStore(raw: unknown): PlStore {
  const store: PlStore = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return store;
  const reports = (raw as { reports?: unknown }).reports;
  if (!reports || typeof reports !== 'object') return store;
  for (const [id, rep] of Object.entries(reports as Record<string, unknown>)) {
    if (isValidReport(rep)) store[id] = rep;
  }
  return store;
}

export function loadPlStore(): PlStore {
  try {
    const raw = localStorage.getItem(PL_STORAGE_KEY);
    if (raw) return sanitizePlStore(JSON.parse(raw));
  } catch {
    // abaikan data rusak
  }
  return {};
}

/** @returns false bila penyimpanan browser penuh / diblokir. */
export function savePlStore(store: PlStore): boolean {
  try {
    localStorage.setItem(PL_STORAGE_KEY, JSON.stringify({ v: 1, reports: store }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Masukkan laporan ke store. Kunci = outlet + bulan:
 * ada -> diperbarui, belum ada -> bulan baru.
 */
export function upsertReport(
  store: PlStore,
  report: PlReport
): { next: PlStore; status: 'new' | 'updated'; shorterPeriod: boolean } {
  const existing = store[report.id];
  return {
    next: { ...store, [report.id]: report },
    status: existing ? 'updated' : 'new',
    shorterPeriod: !!existing && report.periodEnd < existing.periodEnd,
  };
}

/** Cari baris berdasarkan Description (tidak peka huruf besar/kecil). */
export function findLine(report: PlReport, description: string): PlLine | undefined {
  const key = normalizeDesc(description);
  return report.lines.find((l) => normalizeDesc(l.description) === key);
}

export function findNetProfitLine(report: PlReport): PlLine | undefined {
  return report.lines.find((l) =>
    normalizeDesc(l.description).startsWith('net profit')
  );
}

export function lineKey(line: PlLine): string {
  return `${line.account}|${normalizeDesc(line.description)}`;
}

// ---------- Format tampilan ----------

export function formatPct(p: number | null): string {
  if (p === null) return '-';
  return `${p.toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function formatDeltaPoints(d: number | null): string {
  if (d === null) return '-';
  if (Math.abs(d) < 0.005) return '0,00';
  const s = Math.abs(d).toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${d > 0 ? '+' : '-'}${s}`;
}

/** Rupiah bertanda (negatif tetap tampil '-'). */
export function formatSignedRupiah(amount: number): string {
  const rounded = Math.round(amount);
  const s = Math.abs(rounded).toLocaleString('id-ID');
  return rounded < 0 ? `-${s}` : s;
}
