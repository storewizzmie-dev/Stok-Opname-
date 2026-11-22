import * as XLSX from 'xlsx';
import { formatDateId, formatMonthId, formatRupiah } from './stockOpname';

export type PnlSection = 'revenue' | 'cogs' | 'opex' | 'other';
export type PnlRowKind = 'item' | 'summary' | 'anchor';

export interface PnlRow {
  account: string;
  description: string;
  value: number;
  percentToNetSales: number;
  section: PnlSection;
  kind: PnlRowKind;
}

export interface PnlMonthReport {
  monthKey: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  branchName: string;
  netSales: number;
  totalSales: number;
  totalDiscount: number;
  totalCogs: number;
  grossProfit: number;
  totalOpex: number;
  operationalProfit: number;
  netProfit: number;
  rows: PnlRow[];
  updatedAt: string;
}

export type PnlDataset = Record<string, PnlMonthReport>;

export interface PnlRowDescription {
  simpleAnalysis: string;
  meaning: string;
  formulaEquation: string;
  perScaleText: string;
  originFormula: string;
  dailyAvgValue: number;
  periodDays: number;
  actionTip: string;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function normalizeDesc(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const cleaned = v.trim().replace(/,/g, '');
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function formatPercentId(pct: number): string {
  if (!Number.isFinite(pct)) return '0,00%';
  return `${pct.toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function formatSignedRupiah(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = formatRupiah(Math.abs(rounded));
  if (rounded < 0) return `- ${formatted}`;
  return formatted;
}

export function getPnlPeriodDays(report: PnlMonthReport): number {
  const start = new Date(`${report.periodStart}T00:00:00Z`);
  const end = new Date(`${report.periodEnd}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, diff);
}

export function formatPnlPeriodRange(report: PnlMonthReport): string {
  if (!report.periodStart || !report.periodEnd) return report.monthKey;
  if (report.periodStart === report.periodEnd) {
    return formatDateId(report.periodStart);
  }
  return `${formatDateId(report.periodStart)} – ${formatDateId(report.periodEnd)}`;
}

export function detectExcelReportType(
  buffer: ArrayBuffer
): 'pnl' | 'stock' | 'unknown' {
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    if (!wb.SheetNames.length) return 'unknown';
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
      raw: true,
    });
    const scanLimit = Math.min(rows.length, 40);
    for (let i = 0; i < scanLimit; i++) {
      const r = rows[i] ?? [];
      const first = normalizeDesc(cellText(r[0]));
      const second = normalizeDesc(cellText(r[1]));
      if (first === 'account' && second === 'description') {
        return 'pnl';
      }
      if (first.includes('profit loss consolidation')) {
        return 'pnl';
      }
      if (r.some((c) => normalizeDesc(cellText(c)) === 'stock opname date')) {
        return 'stock';
      }
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function classifyPnlRow(
  account: string,
  description: string,
  currentSection: PnlSection
): { section: PnlSection; kind: PnlRowKind } {
  const desc = normalizeDesc(description);
  const accPrefix = account.trim().charAt(0);

  if (desc === 'net sales') {
    return { section: 'revenue', kind: 'anchor' };
  }

  if (accPrefix === '4') return { section: 'revenue', kind: 'item' };
  if (accPrefix === '5') return { section: 'cogs', kind: 'item' };
  if (accPrefix === '6') return { section: 'opex', kind: 'item' };
  if (accPrefix === '7' || accPrefix === '8') {
    return { section: 'other', kind: 'item' };
  }

  if (desc === 'total sales' || desc === 'total discount') {
    return { section: 'revenue', kind: 'summary' };
  }
  if (desc === 'total cost of goods sold' || desc === 'gross profit') {
    return { section: 'cogs', kind: 'summary' };
  }
  if (desc === 'total operational expense' || desc.startsWith('operational profit')) {
    return { section: 'opex', kind: 'summary' };
  }
  if (
    desc.includes('other income') ||
    desc.startsWith('earning before') ||
    desc.startsWith('net profit') ||
    desc.includes('ebitda')
  ) {
    return { section: 'other', kind: 'summary' };
  }

  if (account.trim() === '') {
    return { section: currentSection, kind: 'summary' };
  }
  return { section: currentSection, kind: 'item' };
}

export function parseProfitLossRows(rows: unknown[][]): PnlMonthReport {
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
      'File bukan laporan Profit Loss Consolidation (kolom Account & Description tidak ditemukan)'
    );
  }

  const headerRow = rows[headerIdx] ?? [];
  let valueCol = -1;
  for (let c = 2; c < headerRow.length; c++) {
    if (normalizeDesc(cellText(headerRow[c])) === 'value') {
      valueCol = c;
      break;
    }
  }
  if (valueCol < 0) {
    for (let c = headerRow.length - 1; c >= 2; c--) {
      if (cellText(headerRow[c]) !== '') {
        valueCol = c;
        break;
      }
    }
  }
  if (valueCol < 0) {
    throw new Error('Kolom "Value" tidak ditemukan pada laporan Profit Loss');
  }

  let branchName = '';
  let generatedAt = '';
  let periodText = '';

  for (let i = 0; i < headerIdx; i++) {
    const r = rows[i] ?? [];
    const k = normalizeDesc(cellText(r[0]));
    const v = cellText(r[1]);
    if (k === 'generated') {
      generatedAt = v;
      continue;
    }
    if (k === 'period') {
      periodText = v;
      continue;
    }
    if (
      !branchName &&
      cellText(r[0]) &&
      !/^profit\s*loss/i.test(cellText(r[0])) &&
      !/^(generated|period|show zero|mode|report file)/i.test(cellText(r[0]))
    ) {
      branchName = cellText(r[0]);
    }
  }
  if (!branchName) {
    branchName = cellText(headerRow[2]) || 'Outlet';
  }

  const pm = periodText.match(
    /(\d{1,2})-(\d{1,2})-(\d{4})\s*-\s*(\d{1,2})-(\d{1,2})-(\d{4})/
  );
  if (!pm) {
    throw new Error(
      'Baris "Period" (format DD-MM-YYYY - DD-MM-YYYY) tidak ditemukan'
    );
  }
  const pad = (s: string) => s.padStart(2, '0');
  const periodStart = `${pm[3]}-${pad(pm[2])}-${pad(pm[1])}`;
  const periodEnd = `${pm[6]}-${pad(pm[5])}-${pad(pm[4])}`;
  const monthKey = periodStart.slice(0, 7);

  const rawItems: {
    account: string;
    description: string;
    value: number;
    section: PnlSection;
    kind: PnlRowKind;
  }[] = [];

  let currentSection: PnlSection = 'revenue';
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const description = cellText(r[1]);
    if (!description) continue;
    const value = toNumber(r[valueCol]);
    if (value === null) continue;
    const account = cellText(r[0]);
    const { section, kind } = classifyPnlRow(account, description, currentSection);
    currentSection = section;
    rawItems.push({ account, description, value, section, kind });
  }

  if (!rawItems.length) {
    throw new Error('Tidak ada baris data laba rugi yang terbaca');
  }

  const netSalesItem = rawItems.find(
    (item) => normalizeDesc(item.description) === 'net sales'
  );
  if (!netSalesItem) {
    throw new Error('Baris acuan "Net Sales" tidak ditemukan pada laporan');
  }

  const netSales = netSalesItem.value;
  const rowsWithPct: PnlRow[] = rawItems.map((item) => ({
    ...item,
    percentToNetSales:
      Math.abs(netSales) > 1e-9 ? (item.value / netSales) * 100 : 0,
  }));

  const findVal = (target: string, startsWith = false): number => {
    const t = normalizeDesc(target);
    const found = rowsWithPct.find((r) =>
      startsWith
        ? normalizeDesc(r.description).startsWith(t)
        : normalizeDesc(r.description) === t
    );
    return found ? found.value : 0;
  };

  const totalSales =
    findVal('total sales') ||
    rowsWithPct
      .filter((r) => r.section === 'revenue' && r.kind === 'item' && r.value > 0)
      .reduce((acc, r) => acc + r.value, 0);
  const totalDiscount =
    findVal('total discount') ||
    rowsWithPct
      .filter((r) => r.section === 'revenue' && r.kind === 'item' && r.value < 0)
      .reduce((acc, r) => acc + r.value, 0);
  const totalCogs =
    findVal('total cost of goods sold') ||
    rowsWithPct
      .filter((r) => r.section === 'cogs' && r.kind === 'item')
      .reduce((acc, r) => acc + r.value, 0);
  const grossProfit = findVal('gross profit') || netSales - totalCogs;
  const totalOpex =
    findVal('total operational expense') ||
    rowsWithPct
      .filter((r) => r.section === 'opex' && r.kind === 'item')
      .reduce((acc, r) => acc + r.value, 0);
  const operationalProfit =
    findVal('operational profit', true) || grossProfit - totalOpex;
  const netProfit = findVal('net profit', true) || operationalProfit;

  return {
    monthKey,
    periodStart,
    periodEnd,
    generatedAt,
    branchName,
    netSales,
    totalSales,
    totalDiscount,
    totalCogs,
    grossProfit,
    totalOpex,
    operationalProfit,
    netProfit,
    rows: rowsWithPct,
    updatedAt: new Date().toISOString(),
  };
}

export function parseProfitLossBuffer(buffer: ArrayBuffer): PnlMonthReport {
  const wb = XLSX.read(buffer, { type: 'array' });
  if (!wb.SheetNames.length) throw new Error('File Excel kosong');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
  });
  return parseProfitLossRows(rows);
}

function isValidPnlRow(r: unknown): r is PnlRow {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.account === 'string' &&
    typeof o.description === 'string' &&
    typeof o.value === 'number' &&
    typeof o.percentToNetSales === 'number'
  );
}

export function sanitizePnlDataset(raw: unknown): PnlDataset {
  const out: PnlDataset = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}$/.test(key) || !val || typeof val !== 'object') continue;
    const rep = val as Record<string, unknown>;
    if (
      typeof rep.netSales !== 'number' ||
      !Array.isArray(rep.rows) ||
      !rep.rows.length
    ) {
      continue;
    }
    const rows = rep.rows.filter(isValidPnlRow);
    if (!rows.length) continue;
    out[key] = {
      monthKey: typeof rep.monthKey === 'string' ? rep.monthKey : key,
      periodStart: typeof rep.periodStart === 'string' ? rep.periodStart : `${key}-01`,
      periodEnd: typeof rep.periodEnd === 'string' ? rep.periodEnd : `${key}-28`,
      generatedAt: typeof rep.generatedAt === 'string' ? rep.generatedAt : '',
      branchName: typeof rep.branchName === 'string' ? rep.branchName : 'Outlet',
      netSales: rep.netSales,
      totalSales: typeof rep.totalSales === 'number' ? rep.totalSales : rep.netSales,
      totalDiscount: typeof rep.totalDiscount === 'number' ? rep.totalDiscount : 0,
      totalCogs: typeof rep.totalCogs === 'number' ? rep.totalCogs : 0,
      grossProfit: typeof rep.grossProfit === 'number' ? rep.grossProfit : 0,
      totalOpex: typeof rep.totalOpex === 'number' ? rep.totalOpex : 0,
      operationalProfit:
        typeof rep.operationalProfit === 'number' ? rep.operationalProfit : 0,
      netProfit: typeof rep.netProfit === 'number' ? rep.netProfit : 0,
      rows,
      updatedAt:
        typeof rep.updatedAt === 'string' ? rep.updatedAt : new Date().toISOString(),
    };
  }
  return out;
}

const SPECIFIC_MEANINGS: Record<string, { meaning: string; tip: string }> = {
  'sales - food': {
    meaning:
      'Total omzet kotor dari penjualan semua menu makanan (mie, dimsum, dll) sebelum dikurangi diskon nota.',
    tip: 'Bandingkan porsinya terhadap Total Sales agar terlihat apakah makanan masih menjadi penyumbang omzet utama.',
  },
  'sales - beverage': {
    meaning:
      'Total omzet kotor dari penjualan seluruh menu minuman (es teh, minuman manis, dll) sebelum diskon.',
    tip: 'Minuman biasanya punya margin lebih tebal dibanding makanan; dorong upselling minuman untuk menaikkan Gross Profit.',
  },
  'sales - other': {
    meaning:
      'Penjualan di luar menu makanan/minuman utama (seperti kemasan/packaging berbayar, tambahan topping, atau item lain).',
    tip: 'Cek apakah item tambahan atau kemasan berbayar sudah terinput rapi di POS ESB.',
  },
  'total sales': {
    meaning:
      'Gabungan seluruh penjualan kotor (Makanan + Minuman + Lainnya) sebelum dikurangi diskon nota.',
    tip: 'Total Sales lebih tinggi dari Net Sales karena masih berisi angka diskon.',
  },
  'bill discount': {
    meaning:
      'Potongan harga atau promo pada struk/nota pelanggan yang mengurangi pendapatan penjualan.',
    tip: 'Pantau persentase diskon terhadap Net Sales; jika terlalu besar bisa langsung menggerus laba bersih.',
  },
  'total discount': {
    meaning:
      'Total seluruh potongan penjualan pada periode laporan ini.',
    tip: 'Pastikan setiap promo atau voucher diskon di kasir sesuai program yang disetujui manajemen.',
  },
  'net sales': {
    meaning:
      'Penjualan bersih (Total Sales dikurangi Total Discount). Angka ini menjadi pembagi utama (100,00%) untuk seluruh pos Laba Rugi.',
    tip: 'Semua persentase pos biaya dan laba dihitung dari seberapa besar porsinya dibanding Net Sales.',
  },
  'cogs - food': {
    meaning:
      'Harga Pokok Penjualan (modal bahan baku) yang terpakai khusus untuk menu makanan.',
    tip: 'Cocokkan kenaikan persentase COGS - Food dengan hasil Stok Opname (terutama bagian Meat, WIP, dan Dry Store).',
  },
  'cogs - beverage': {
    meaning:
      'Modal bahan baku yang terpakai khusus untuk menu minuman (teh, susu, sirup, gula, es, cup).',
    tip: 'Jika persen COGS - Beverage melonjak, cek takaran resep bar serta selisih stok minuman di gudang.',
  },
  'cogs - other': {
    meaning:
      'Modal bahan/perlengkapan penjualan selain makanan & minuman utama (misal kemasan take away atau bahan pendukung).',
    tip: 'Periksa penggunaan kemasan take away dan barang pendukung agar sesuai volume penjualan.',
  },
  'cogs minus resolve variance': {
    meaning:
      'Penyesuaian HPP dari selisih stok atau koreksi pembulatan sistem inventori ESB.',
    tip: 'Jika nilainya membesar, cek ulang transaksi stok opname/adjustmen di ESB pada periode terkait.',
  },
  waste: {
    meaning:
      'Nilai bahan baku yang terbuang, rusak, basi, atau gagal produksi dan langsung menambah beban HPP.',
    tip: 'Catat alasan waste harian secara disiplin supaya tim produksi bisa menekan bahan terbuang di bulan berikutnya.',
  },
  'total cost of goods sold': {
    meaning:
      'Total seluruh modal bahan baku (Food + Beverage + Other + Variance + Waste).',
    tip: 'Semakin kecil persen Total COGS ÷ Net Sales, semakin sehat margin kotor restoran.',
  },
  'gross profit': {
    meaning:
      'Laba Kotor (Net Sales dikurangi Total COGS) sebelum membayar gaji/biaya operasional outlet.',
    tip: 'Gross Profit adalah dana yang tersisa untuk menutup seluruh Biaya Operasional sekaligus menghasilkan Laba Bersih.',
  },
  promosi: {
    meaning:
      'Biaya marketing, iklan, spanduk, atau aktivitas promosi untuk menarik pelanggan ke outlet.',
    tip: 'Evaluasi apakah biaya promosi sepadan dengan kenaikan Net Sales di bulan tersebut.',
  },
  'mdr expenses': {
    meaning:
      'Biaya potongan layanan transaksi non-tunai (QRIS, EDC debit/kredit) dari penyedia pembayaran.',
    tip: 'Pastikan tarif potongan MDR sesuai dengan perjanjian bank/payment gateway.',
  },
  'mdr grabfood - go food': {
    meaning:
      'Komisi dan potongan platform pemesanan online (GrabFood, GoFood, ShopeeFood, dll).',
    tip: 'Bandingkan kontribusi order online terhadap komisi agar harga jual ojol tetap memberi untung.',
  },
  gas: {
    meaning:
      'Biaya pemakaian gas untuk kebutuhan memasak di area produksi / operasional.',
    tip: 'Perhatikan rasio biaya gas per hari dan bandingkan antar bulan untuk mendeteksi kebocoran atau pemborosan.',
  },
  ob: {
    meaning:
      'Biaya operasional kebersihan / perlengkapan kebersihan (Office Boy / sanitasi outlet).',
    tip: 'Jaga pengadaan barang kebersihan sesuai anggaran bulanan outlet.',
  },
  'paper supplies': {
    meaning:
      'Biaya tisu, struk thermal, kertas alas, dan kebutuhan kertas operasional outlet.',
    tip: 'Pantau pemakaian rutin agar tidak melebihi rasio wajar terhadap Net Sales.',
  },
  'guest supplies': {
    meaning:
      'Perlengkapan pendukung untuk tamu (sendok/garpu sekali pakai, sedotan, tusuk gigi, dsb). Angka minus menandakan ada retur atau koreksi stok.',
    tip: 'Jika muncul angka minus, periksa riwayat penyesuaian stok atau koreksi nota pembelian di sistem ESB.',
  },
  pengiriman: {
    meaning:
      'Ongkos kirim/ekspedisi distribusi bahan baku atau perlengkapan ke outlet.',
    tip: 'Gabungkan jadwal pengiriman barang bila memungkinkan agar ongkos kirim lebih hemat.',
  },
  'repair & maintenance': {
    meaning:
      'Biaya servis, perbaikan alat masak, AC, chiller, kulkas, atau fasilitas outlet.',
    tip: 'Lakukan perawatan rutin alat agar biaya perbaikan mendadak yang mahal bisa dicegah.',
  },
  'office expense': {
    meaning:
      'Biaya keperluan administrasi kantor/kasir outlet (pulsa/internet, meterai, kebutuhan admin).',
    tip: 'Cek rincian bon/kas kecil agar setiap pengeluaran kantor tercatat pada akun yang tepat.',
  },
  'printing & stationary': {
    meaning:
      'Biaya cetak formulir, alat tulis kantor (ATK), spidol, buku catatan gudang, dan sejenisnya.',
    tip: 'Belanja ATK secukupnya sesuai pemakaian bulanan.',
  },
  'kitchenware & related cost': {
    meaning:
      'Biaya pembelian atau penggantian alat produksi / operasional (panci, wajan, penjepit, mangkuk, wadah).',
    tip: 'Jika angka naik tinggi, cek apakah ada pembelian peralatan baru atau banyak alat rusak/pecah.',
  },
  'biaya lain lain': {
    meaning:
      'Pengeluaran operasional di luar kategori akun biaya utama yang sudah disediakan.',
    tip: 'Pastikan transaksi di pos ini punya bukti bon jelas supaya tidak menumpuk biaya yang sulit dilacak.',
  },
  'total operational expense': {
    meaning:
      'Total seluruh Biaya Operasional outlet (Promosi, MDR, Gas, Kebersihan, Pengiriman, Perawatan, dll).',
    tip: 'Menjaga persentase Biaya Operasional tetap terkendali membuat porsi Laba Bersih lebih tebal.',
  },
  'operational profit/loss': {
    meaning:
      'Laba (atau Rugi) Operasional = Gross Profit dikurangi Total Operational Expense, sebelum pos lain-lain.',
    tip: 'Ini cerminan murni keuntungan dari kegiatan jualan dan operasional harian outlet.',
  },
  'rounding/ pos adjustment': {
    meaning:
      'Selisih pembulatan otomatis atau penyesuaian nominal transaksi pada mesin kasir/POS ESB.',
    tip: 'Wajar muncul dalam jumlah kecil; jika terlalu besar, audit ulang pengaturan pembulatan kasir.',
  },
  'biaya adm bank/transfer': {
    meaning:
      'Biaya administrasi bank atau biaya transfer antar rekening (pada laporan P&L bisa bernilai minus sebagai pengurang laba).',
    tip: 'Gunakan metode transfer bebas biaya (BI-FAST/sesama bank) jika memungkinkan untuk menekan biaya admin.',
  },
  'total other income & expense': {
    meaning:
      'Gabungan seluruh pendapatan dan beban di luar operasional utama restoran.',
    tip: 'Cek komponennya agar tidak ada biaya besar yang tersembunyi di pos lain-lain.',
  },
  'net profit/(net loss)': {
    meaning:
      'Laba Bersih (atau Rugi Bersih) akhir outlet setelah seluruh penjualan dikurangi diskon, HPP, biaya operasional, dan pos lain-lain.',
    tip: 'Persen Net Profit ÷ Net Sales menunjukkan berapa rupiah keuntungan bersih yang benar-benar didapat dari setiap Rp 100 penjualan.',
  },
};

function buildSimpleAppAnalysis(
  row: PnlRow,
  report: PnlMonthReport,
  prevReport?: PnlMonthReport | null
): string {
  const descKey = normalizeDesc(row.description);
  const periodDays = getPnlPeriodDays(report);
  const dailyAvg = row.value / periodDays;
  const pctStr = formatPercentId(row.percentToNetSales);
  const valStr = formatSignedRupiah(row.value);

  const prevRow = prevReport
    ? prevReport.rows.find(
        (r) => normalizeDesc(r.description) === descKey
      )
    : undefined;
  let prevNote = '';
  if (prevReport && prevRow) {
    const diffVal = row.value - prevRow.value;
    const diffPct = row.percentToNetSales - prevRow.percentToNetSales;
    const prevMonthName = formatMonthId(prevReport.monthKey);
    if (Math.abs(diffVal) < 1) {
      prevNote = ` Nilainya hampir sama dibanding ${prevMonthName}.`;
    } else {
      const arah = diffVal > 0 ? 'naik' : 'turun';
      prevNote = ` Dibanding ${prevMonthName}, pos ini ${arah} ${formatSignedRupiah(
        Math.abs(diffVal)
      )} (${diffPct >= 0 ? '+' : ''}${formatPercentId(diffPct)} poin).`;
    }
  }

  if (descKey === 'net sales') {
    const discPct =
      Math.abs(report.totalSales) > 1e-9
        ? (Math.abs(report.totalDiscount) / Math.abs(report.totalSales)) * 100
        : 0;
    return `Penjualan bersih outlet mencapai ${valStr} (rata-rata ${formatSignedRupiah(
      dailyAvg
    )}/hari selama ${periodDays} hari), berasal dari penjualan kotor ${formatSignedRupiah(
      report.totalSales
    )} dikurangi diskon ${formatSignedRupiah(
      Math.abs(report.totalDiscount)
    )} (${formatPercentId(discPct)}). Angka ini menjadi acuan 100,00% untuk mengukur porsi semua biaya dan laba.${prevNote}`;
  }

  if (descKey === 'total sales') {
    const revItems = report.rows
      .filter((r) => r.section === 'revenue' && r.kind === 'item' && r.value > 0)
      .sort((a, b) => b.value - a.value);
    const topRev = revItems[0];
    const topShare =
      topRev && Math.abs(report.totalSales) > 1e-9
        ? (topRev.value / report.totalSales) * 100
        : 0;
    return `Total penjualan kotor sebelum diskon tercatat ${valStr} (${pctStr} dari Net Sales).${
      topRev
        ? ` Penyumbang terbesarnya adalah ${topRev.description} sebesar ${formatSignedRupiah(
            topRev.value
          )} (${formatPercentId(topShare)} dari total penjualan).`
        : ''
    }${prevNote}`;
  }

  if (descKey === 'total cost of goods sold') {
    const cogsItems = report.rows
      .filter((r) => r.section === 'cogs' && r.kind === 'item' && r.value > 0)
      .sort((a, b) => b.value - a.value);
    const topCogs = cogsItems[0];
    const topShare =
      topCogs && Math.abs(report.totalCogs) > 1e-9
        ? (topCogs.value / report.totalCogs) * 100
        : 0;
    const wasteRow = report.rows.find(
      (r) => normalizeDesc(r.description) === 'waste'
    );
    const wasteNote =
      wasteRow && Math.abs(wasteRow.value) > 0
        ? ` Sementara bahan terbuang (Waste) tercatat ${formatSignedRupiah(
            wasteRow.value
          )}.`
        : '';
    return `Total modal bahan baku (HPP) menyerap ${valStr} atau ${pctStr} dari penjualan bersih.${
      topCogs
        ? ` Komponen terbesarnya berasal dari ${topCogs.description} senilai ${formatSignedRupiah(
            topCogs.value
          )} (${formatPercentId(topShare)} dari total COGS).`
        : ''
    }${wasteNote}${prevNote}`;
  }

  if (descKey === 'gross profit') {
    return `Setelah penjualan bersih ${formatSignedRupiah(
      report.netSales
    )} dikurangi modal bahan baku ${formatSignedRupiah(
      report.totalCogs
    )}, tersisa Laba Kotor sebesar ${valStr} (${pctStr}). Dana inilah yang dipakai untuk menutup seluruh biaya operasional outlet sebelum menjadi laba bersih.${prevNote}`;
  }

  if (descKey === 'total operational expense') {
    const opexItems = report.rows
      .filter((r) => r.section === 'opex' && r.kind === 'item' && Math.abs(r.value) > 0)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const top1 = opexItems[0];
    const top2 = opexItems[1];
    const topDesc = top1
      ? top2
        ? ` Pengeluaran terbesar datang dari ${top1.description} senilai ${formatSignedRupiah(
            top1.value
          )} dan ${top2.description} senilai ${formatSignedRupiah(top2.value)}.`
        : ` Pengeluaran terbesar adalah ${top1.description} senilai ${formatSignedRupiah(
            top1.value
          )}.`
      : '';
    return `Seluruh biaya operasional di luar bahan baku tercatat ${valStr} atau ${pctStr} dari Net Sales (rata-rata ${formatSignedRupiah(
      dailyAvg
    )}/hari).${topDesc}${prevNote}`;
  }

  if (descKey.startsWith('operational profit')) {
    const statusText =
      row.value >= 0
        ? `Outlet menghasilkan Laba Operasional sebesar ${valStr} (${pctStr} dari Net Sales)`
        : `Operasional outlet mengalami selisih minus sebesar ${valStr} (${pctStr})`;
    return `${statusText} setelah Laba Kotor ${formatSignedRupiah(
      report.grossProfit
    )} dikurangi Biaya Operasional ${formatSignedRupiah(
      report.totalOpex
    )}.${prevNote}`;
  }

  if (descKey.startsWith('net profit') || descKey.startsWith('earning before')) {
    const otherNet = report.netProfit - report.operationalProfit;
    const isProfit = row.value >= 0;
    return `${
      isProfit ? 'Keuntungan bersih akhir outlet tercatat' : 'Laporan berakhir rugi bersih sebesar'
    } ${valStr} (${pctStr} dari Net Sales), terbentuk dari hasil operasional ${formatSignedRupiah(
      report.operationalProfit
    )} ditambah/dikurangi pos lain-lain bersih ${formatSignedRupiah(
      otherNet
    )}.${prevNote}`;
  }

  if (row.section === 'revenue') {
    const isNegative = row.value < 0;
    const shareSales =
      Math.abs(report.totalSales) > 1e-9
        ? (Math.abs(row.value) / Math.abs(report.totalSales)) * 100
        : 0;
    if (isNegative) {
      return `Pos ${row.description} memotong pendapatan penjualan sebesar ${valStr} (${pctStr} dari Net Sales, rata-rata ${formatSignedRupiah(
        dailyAvg
      )}/hari).${prevNote}`;
    }
    return `${row.description} menyumbang ${valStr} (${formatPercentId(
      shareSales
    )} dari Total Sales atau ${pctStr} dibanding Net Sales), dengan rata-rata ${formatSignedRupiah(
      dailyAvg
    )} per hari.${prevNote}`;
  }

  if (row.section === 'cogs') {
    const shareCogs =
      Math.abs(report.totalCogs) > 1e-9
        ? (row.value / report.totalCogs) * 100
        : 0;
    if (row.value < 0) {
      return `${row.description} bernilai minus ${valStr} (${pctStr} dari Net Sales), yang menandakan adanya penyesuaian atau koreksi pengurang beban HPP pada sistem ESB.${prevNote}`;
    }
    return `${row.description} menyerap biaya bahan sebesar ${valStr} (${pctStr} dari Net Sales) dan menyumbang ${formatPercentId(
      shareCogs
    )} dari total seluruh COGS, rata-rata ${formatSignedRupiah(
      dailyAvg
    )}/hari.${prevNote}`;
  }

  if (row.section === 'opex') {
    const shareOpex =
      Math.abs(report.totalOpex) > 1e-9
        ? (row.value / report.totalOpex) * 100
        : 0;
    if (row.value < 0) {
      return `${row.description} tercatat minus ${valStr} (${pctStr} dari Net Sales). Angka minus pada akun biaya biasanya berasal dari retur barang, pengembalian dana, atau koreksi pencatatan ESB.${prevNote}`;
    }
    if (Math.abs(row.value) < 0.01) {
      return `Tidak ada biaya yang tercatat pada pos ${row.description} (Rp 0) sepanjang periode ${formatPnlPeriodRange(
        report
      )}.${prevNote}`;
    }
    return `Biaya ${row.description} terpakai ${valStr} (${pctStr} dari Net Sales), mengambil porsi ${formatPercentId(
      shareOpex
    )} dari total Biaya Operasional dengan rata-rata ${formatSignedRupiah(
      dailyAvg
    )}/hari.${prevNote}`;
  }

  return `Pos ${row.description} tercatat senilai ${valStr} (${pctStr} terhadap Net Sales) selama ${periodDays} hari periode laporan.${prevNote}`;
}

export function describePnlRow(
  row: PnlRow,
  report: PnlMonthReport,
  prevReport?: PnlMonthReport | null
): PnlRowDescription {
  const simpleAnalysis = buildSimpleAppAnalysis(row, report, prevReport);
  const descKey = normalizeDesc(row.description);
  const specific = SPECIFIC_MEANINGS[descKey];
  const absVal = Math.abs(row.value);
  const absNetSales = Math.abs(report.netSales);
  const periodDays = getPnlPeriodDays(report);
  const dailyAvgValue = row.value / periodDays;

  const meaning =
    specific?.meaning ??
    (row.section === 'revenue'
      ? `Pos pendapatan/penjualan "${row.description}" yang mempengaruhi total Net Sales outlet.`
      : row.section === 'cogs'
      ? `Pos modal bahan baku / HPP "${row.description}" yang langsung mengurangi Laba Kotor (Gross Profit).`
      : row.section === 'opex'
      ? `Pos biaya operasional "${row.description}" untuk mendukung jalannya operasional outlet.`
      : `Pos laporan "${row.description}" yang mempengaruhi hasil akhir Laba Bersih.`);

  const actionTip =
    specific?.tip ??
    `Pantau perubahan nilai ${row.description} (${formatPercentId(
      row.percentToNetSales
    )}) dari bulan ke bulan agar tetap terkendali.`;

  const formulaEquation = `${formatSignedRupiah(
    row.value
  )} ÷ ${formatSignedRupiah(report.netSales)} × 100% = ${formatPercentId(
    row.percentToNetSales
  )}`;

  const absPer100 =
    absNetSales > 1e-9 ? (absVal / absNetSales) * 100 : 0;
  const absPer1Jt =
    absNetSales > 1e-9 ? (absVal / absNetSales) * 1_000_000 : 0;

  const scaleVerb =
    row.kind === 'anchor'
      ? 'menjadi patokan penjualan bersih'
      : row.description.toLowerCase().includes('profit')
      ? row.value >= 0
        ? 'menjadi laba sebesar'
        : 'menjadi rugi sebesar'
      : row.value < 0 && row.section === 'revenue'
      ? 'memotong penjualan sebesar'
      : row.section === 'revenue'
      ? 'menyumbang pendapatan sebesar'
      : 'menyerap biaya sebesar';

  const perScaleText =
    row.kind === 'anchor'
      ? `Net Sales ${formatRupiah(
          report.netSales
        )} selalu bernilai 100,00% sebagai pembagi utama untuk semua baris lain.`
      : `Dari setiap Rp 100 penjualan bersih (Net Sales), pos ini ${scaleVerb} Rp ${absPer100.toLocaleString(
          'id-ID',
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )} (atau setara ${formatRupiah(absPer1Jt)} per Rp 1 juta penjualan).`;

  let originFormula = '';
  if (descKey === 'total sales') {
    const foodCount = report.rows.filter(
      (r) => r.section === 'revenue' && r.kind === 'item' && r.value > 0
    ).length;
    originFormula = `Penjumlahan dari ${foodCount} akun penjualan (Food + Beverage + Other) sebesar ${formatSignedRupiah(
      report.totalSales
    )}.`;
  } else if (descKey === 'net sales') {
    originFormula = `Total Sales (${formatSignedRupiah(
      report.totalSales
    )}) dikurangi Total Discount (${formatSignedRupiah(
      Math.abs(report.totalDiscount)
    )}) = ${formatSignedRupiah(report.netSales)}.`;
  } else if (descKey === 'total cost of goods sold') {
    const cogsCount = report.rows.filter(
      (r) => r.section === 'cogs' && r.kind === 'item'
    ).length;
    originFormula = `Total dari ${cogsCount} pos bahan baku (COGS & Waste) dengan total ${formatSignedRupiah(
      report.totalCogs
    )}.`;
  } else if (descKey === 'gross profit') {
    originFormula = `Net Sales (${formatSignedRupiah(
      report.netSales
    )}) − Total COGS (${formatSignedRupiah(
      report.totalCogs
    )}) = ${formatSignedRupiah(report.grossProfit)}.`;
  } else if (descKey === 'total operational expense') {
    const opexCount = report.rows.filter(
      (r) => r.section === 'opex' && r.kind === 'item'
    ).length;
    originFormula = `Total dari ${opexCount} akun biaya operasional outlet dengan total ${formatSignedRupiah(
      report.totalOpex
    )}.`;
  } else if (descKey.startsWith('operational profit')) {
    originFormula = `Gross Profit (${formatSignedRupiah(
      report.grossProfit
    )}) − Total Operational Expense (${formatSignedRupiah(
      report.totalOpex
    )}) = ${formatSignedRupiah(report.operationalProfit)}.`;
  } else if (descKey.startsWith('net profit') || descKey.startsWith('earning before')) {
    const otherNet = report.netProfit - report.operationalProfit;
    originFormula = `Operational Profit (${formatSignedRupiah(
      report.operationalProfit
    )}) + Pendapatan/Biaya Lain-lain (${formatSignedRupiah(
      otherNet
    )}) = ${formatSignedRupiah(report.netProfit)}.`;
  } else if (row.section === 'cogs' && Math.abs(report.totalCogs) > 1e-9) {
    const shareOfGroup = (row.value / report.totalCogs) * 100;
    originFormula = `Angka langsung dari akun ${
      row.account || '-'
    } ESB. Porsinya sebesar ${formatPercentId(
      shareOfGroup
    )} dari total seluruh COGS (${formatSignedRupiah(report.totalCogs)}).`;
  } else if (row.section === 'opex' && Math.abs(report.totalOpex) > 1e-9) {
    const shareOfGroup = (row.value / report.totalOpex) * 100;
    originFormula = `Angka langsung dari akun ${
      row.account || '-'
    } ESB. Porsinya sebesar ${formatPercentId(
      shareOfGroup
    )} dari total Biaya Operasional (${formatSignedRupiah(report.totalOpex)}).`;
  } else if (row.section === 'revenue' && Math.abs(report.totalSales) > 1e-9) {
    const shareOfSales = (Math.abs(row.value) / Math.abs(report.totalSales)) * 100;
    originFormula = `Angka langsung dari akun ${
      row.account || '-'
    } ESB, setara ${formatPercentId(shareOfSales)} dari Total Sales (${formatSignedRupiah(
      report.totalSales
    )}).`;
  } else {
    originFormula = `Angka tercatat pada akun ${
      row.account || 'subtotal laporan'
    } untuk periode ${formatPnlPeriodRange(report)}.`;
  }

  return {
    simpleAnalysis,
    meaning,
    formulaEquation,
    perScaleText,
    originFormula,
    dailyAvgValue,
    periodDays,
    actionTip,
  };
}

export function buildAiPnlContext(
  pnlData: PnlDataset,
  monthKey: string
): string {
  const report = pnlData[monthKey];
  if (!report) return '';
  const lines = report.rows
    .slice(0, 60)
    .map(
      (r) =>
        `- ${r.description}${r.account ? ` [${r.account}]` : ''}: ${formatSignedRupiah(
          r.value
        )} (${formatPercentId(r.percentToNetSales)} dari Net Sales)`
    )
    .join('\n');

  return [
    `=== DATA LABA RUGI (PROFIT LOSS CONSOLIDATION) ${formatMonthId(
      report.monthKey
    )} ===`,
    `Outlet: ${report.branchName}`,
    `Periode: ${formatPnlPeriodRange(report)}`,
    `Net Sales (Pembagi 100%): ${formatSignedRupiah(report.netSales)}`,
    `Total COGS: ${formatSignedRupiah(report.totalCogs)} (${formatPercentId(
      report.netSales ? (report.totalCogs / report.netSales) * 100 : 0
    )})`,
    `Gross Profit: ${formatSignedRupiah(report.grossProfit)} (${formatPercentId(
      report.netSales ? (report.grossProfit / report.netSales) * 100 : 0
    )})`,
    `Biaya Operasional: ${formatSignedRupiah(report.totalOpex)} (${formatPercentId(
      report.netSales ? (report.totalOpex / report.netSales) * 100 : 0
    )})`,
    `Net Profit: ${formatSignedRupiah(report.netProfit)} (${formatPercentId(
      report.netSales ? (report.netProfit / report.netSales) * 100 : 0
    )})`,
    `Rincian setiap Description ÷ Net Sales:`,
    lines,
  ].join('\n');
}

// ---------- AI Analysis (Khusus Menu Laba Rugi) ----------

const PNL_AI_CACHE_KEY = 'so_pnl_ai_cache_v2';
const MAX_PNL_AI_CACHE_ENTRIES = 60;

interface PnlAiCacheEntry {
  text: string;
  monthKey: string;
  cachedAt: number;
}

const memoryPnlAiCache = new Map<string, PnlAiCacheEntry>();
let storageCacheHydrated = false;

function hydratePnlAiCache(): void {
  if (storageCacheHydrated) return;
  storageCacheHydrated = true;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem('so_pnl_ai_cache_v1');
    const raw = window.localStorage.getItem(PNL_AI_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, PnlAiCacheEntry>;
    if (!parsed || typeof parsed !== 'object') return;
    for (const [k, v] of Object.entries(parsed)) {
      if (
        v &&
        typeof v === 'object' &&
        typeof v.text === 'string' &&
        typeof v.monthKey === 'string' &&
        typeof v.cachedAt === 'number'
      ) {
        memoryPnlAiCache.set(k, v);
      }
    }
  } catch {
    // Ignore corrupted cache
  }
}

function persistPnlAiCache(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (memoryPnlAiCache.size > MAX_PNL_AI_CACHE_ENTRIES) {
      const sorted = Array.from(memoryPnlAiCache.entries()).sort(
        (a, b) => b[1].cachedAt - a[1].cachedAt
      );
      memoryPnlAiCache.clear();
      for (const [k, v] of sorted.slice(0, MAX_PNL_AI_CACHE_ENTRIES)) {
        memoryPnlAiCache.set(k, v);
      }
    }
    const serialized: Record<string, PnlAiCacheEntry> = {};
    for (const [k, v] of memoryPnlAiCache.entries()) {
      serialized[k] = v;
    }
    window.localStorage.setItem(PNL_AI_CACHE_KEY, JSON.stringify(serialized));
  } catch {
    // Ignore storage quota issues
  }
}

export function getPnlReportVersionKey(
  report: PnlMonthReport,
  prevReport: PnlMonthReport | null
): string {
  const prevSig = prevReport
    ? `${prevReport.monthKey}:${prevReport.periodStart}:${prevReport.periodEnd}:${prevReport.updatedAt}:${Math.round(prevReport.netSales)}:${Math.round(prevReport.netProfit)}`
    : 'no-prev';
  return `${report.monthKey}|${report.periodStart}|${report.periodEnd}|${report.updatedAt}|${Math.round(report.netSales)}|${Math.round(report.totalCogs)}|${Math.round(report.totalOpex)}|${Math.round(report.netProfit)}|${report.rows.length}|${prevSig}`;
}

export type PnlAiProviderChoice = 'gemini' | 'groq';

export function getPnlRowCacheKey(
  row: PnlRow,
  report: PnlMonthReport,
  prevReport: PnlMonthReport | null,
  provider?: PnlAiProviderChoice
): string {
  const versionKey = getPnlReportVersionKey(report, prevReport);
  const providerSuffix = provider ? `::${provider}` : '';
  return `${versionKey}::${row.account}|${normalizeDesc(row.description)}|${Math.round(row.value)}${providerSuffix}`;
}

export function getCachedPnlAnalysis(cacheKey: string): string | null {
  hydratePnlAiCache();
  const raw = memoryPnlAiCache.get(cacheKey)?.text;
  return raw ? cleanAiProse(raw) : null;
}

export function clearPnlAiCache(monthKey?: string): void {
  hydratePnlAiCache();
  if (!monthKey) {
    memoryPnlAiCache.clear();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(PNL_AI_CACHE_KEY);
      }
    } catch {
      // Ignore storage error
    }
    return;
  }
  for (const [k, v] of Array.from(memoryPnlAiCache.entries())) {
    if (v.monthKey === monthKey || k.startsWith(`${monthKey}|`)) {
      memoryPnlAiCache.delete(k);
    }
  }
  persistPnlAiCache();
}

export function buildPnlAnalysisContext(
  row: PnlRow,
  report: PnlMonthReport,
  prevReport: PnlMonthReport | null
): string {
  const periodDays = getPnlPeriodDays(report);
  const netPct = (v: number) =>
    Math.abs(report.netSales) > 1e-9 ? (v / report.netSales) * 100 : 0;

  let groupShareLine = '';
  if (row.section === 'cogs' && row.kind === 'item' && Math.abs(report.totalCogs) > 1e-9) {
    groupShareLine = `Porsi terhadap Total COGS: ${formatPercentId(
      (row.value / report.totalCogs) * 100
    )}`;
  } else if (
    row.section === 'opex' &&
    row.kind === 'item' &&
    Math.abs(report.totalOpex) > 1e-9
  ) {
    groupShareLine = `Porsi terhadap Total Operational Expense: ${formatPercentId(
      (row.value / report.totalOpex) * 100
    )}`;
  } else if (
    row.section === 'revenue' &&
    row.kind === 'item' &&
    Math.abs(report.totalSales) > 1e-9
  ) {
    groupShareLine = `Porsi terhadap Total Sales: ${formatPercentId(
      (Math.abs(row.value) / Math.abs(report.totalSales)) * 100
    )}`;
  }

  const sameSectionRows = report.rows
    .filter((r) => r.section === row.section)
    .map(
      (r) =>
        `  - ${r.description}${r.account ? ` [${r.account}]` : ''}${
          r.kind === 'anchor' ? ' (ACUAN 100%)' : r.kind === 'summary' ? ' (SUBTOTAL)' : ''
        }: ${formatSignedRupiah(r.value)} | ${formatPercentId(r.percentToNetSales)} dari Net Sales`
    )
    .join('\n');

  const allReportRows = report.rows
    .map(
      (r) =>
        `  - [${r.section.toUpperCase()}${r.account ? ` ${r.account}` : ''}] ${
          r.description
        }: ${formatSignedRupiah(r.value)} (${formatPercentId(r.percentToNetSales)})`
    )
    .join('\n');

  let prevSection =
    'Perbandingan bulan sebelumnya: Belum tersedia laporan bulan sebelumnya sebagai pembanding (hanya ada data bulan ini).';
  if (prevReport) {
    const prevMatch = prevReport.rows.find(
      (r) => normalizeDesc(r.description) === normalizeDesc(row.description)
    );
    const prevParts = [
      `Perbandingan vs ${formatMonthId(prevReport.monthKey)} (${formatPnlPeriodRange(prevReport)}):`,
      `- Net Sales bulan lalu: ${formatSignedRupiah(prevReport.netSales)} -> bulan ini: ${formatSignedRupiah(report.netSales)}`,
      `- Total COGS bulan lalu: ${formatSignedRupiah(prevReport.totalCogs)} (${formatPercentId(
        prevReport.netSales ? (prevReport.totalCogs / prevReport.netSales) * 100 : 0
      )}) -> bulan ini: ${formatPercentId(netPct(report.totalCogs))}`,
      `- Biaya Operasional bulan lalu: ${formatSignedRupiah(prevReport.totalOpex)} (${formatPercentId(
        prevReport.netSales ? (prevReport.totalOpex / prevReport.netSales) * 100 : 0
      )}) -> bulan ini: ${formatPercentId(netPct(report.totalOpex))}`,
      `- Net Profit bulan lalu: ${formatSignedRupiah(prevReport.netProfit)} (${formatPercentId(
        prevReport.netSales ? (prevReport.netProfit / prevReport.netSales) * 100 : 0
      )}) -> bulan ini: ${formatPercentId(netPct(report.netProfit))}`,
    ];
    if (prevMatch) {
      const valDiff = row.value - prevMatch.value;
      const pctDiff = row.percentToNetSales - prevMatch.percentToNetSales;
      prevParts.push(
        `- Pos "${row.description}" bulan lalu: ${formatSignedRupiah(prevMatch.value)} (${formatPercentId(
          prevMatch.percentToNetSales
        )}) | Selisih ke bulan ini: ${valDiff >= 0 ? '+' : ''}${formatSignedRupiah(
          valDiff
        )} (${pctDiff >= 0 ? '+' : ''}${formatPercentId(pctDiff)} poin)`
      );
    } else {
      prevParts.push(
        `- Pos "${row.description}" tidak muncul pada laporan bulan lalu.`
      );
    }
    prevSection = prevParts.join('\n');
  }

  return [
    `=== PROFIL LAPORAN LABA RUGI ===`,
    `Outlet: ${report.branchName}`,
    `Bulan: ${formatMonthId(report.monthKey)} (${formatPnlPeriodRange(report)}, ${periodDays} hari)`,
    report.generatedAt ? `Waktu Generate ESB: ${report.generatedAt}` : '',
    ``,
    `=== POS YANG SEDANG DIANALISIS ===`,
    `Nama Pos: ${row.description}`,
    `Kode Akun: ${row.account || 'Subtotal / Laba Laporan'}`,
    `Kelompok: ${row.section} (${row.kind})`,
    `Nilai Pos: ${formatSignedRupiah(row.value)}`,
    `Persentase terhadap Net Sales: ${formatPercentId(row.percentToNetSales)}`,
    `Rata-rata Harian (${periodDays} hari): ${formatSignedRupiah(row.value / periodDays)}/hari`,
    groupShareLine,
    ``,
    `=== RINGKASAN UTAMA LAPORAN AKTIF ===`,
    `- Total Sales (Kotor): ${formatSignedRupiah(report.totalSales)} (${formatPercentId(netPct(report.totalSales))})`,
    `- Total Discount: ${formatSignedRupiah(report.totalDiscount)} (${formatPercentId(netPct(report.totalDiscount))})`,
    `- Net Sales (Acuan 100%): ${formatSignedRupiah(report.netSales)}`,
    `- Total COGS (HPP): ${formatSignedRupiah(report.totalCogs)} (${formatPercentId(netPct(report.totalCogs))})`,
    `- Gross Profit: ${formatSignedRupiah(report.grossProfit)} (${formatPercentId(netPct(report.grossProfit))})`,
    `- Total Operational Expense: ${formatSignedRupiah(report.totalOpex)} (${formatPercentId(netPct(report.totalOpex))})`,
    `- Operational Profit/Loss: ${formatSignedRupiah(report.operationalProfit)} (${formatPercentId(netPct(report.operationalProfit))})`,
    `- Net Profit/(Net Loss): ${formatSignedRupiah(report.netProfit)} (${formatPercentId(netPct(report.netProfit))})`,
    ``,
    `=== POS DALAM KELOMPOK YANG SAMA (${row.section.toUpperCase()}) ===`,
    sameSectionRows,
    ``,
    `=== SELURUH BARIS LAPORAN AKTUAL ===`,
    allReportRows,
    ``,
    prevSection,
  ]
    .filter((line) => line !== undefined && line !== '')
    .join('\n');
}

export async function fetchPnlRowAnalysis({
  row,
  report,
  prevReport,
  provider = 'gemini',
  forceRefresh = false,
  signal,
}: {
  row: PnlRow;
  report: PnlMonthReport;
  prevReport: PnlMonthReport | null;
  provider?: PnlAiProviderChoice;
  forceRefresh?: boolean;
  signal?: AbortSignal;
}): Promise<{ text: string; provider: PnlAiProviderChoice; fromCache: boolean }> {
  const cacheKey = getPnlRowCacheKey(row, report, prevReport, provider);
  if (!forceRefresh) {
    const cached = getCachedPnlAnalysis(cacheKey);
    if (cached) {
      return { text: cached, provider, fromCache: true };
    }
  }

  const contextText = buildPnlAnalysisContext(row, report, prevReport);
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      action: 'pnl_analysis',
      provider,
      pnlTargetLabel: `${row.description}${row.account ? ` (${row.account})` : ''}`,
      contextText,
    }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Server AI belum tersedia di hosting ini (HTTP ${res.status}). Pastikan endpoint /api/ai sudah ter-deploy di Vercel dan GEMINI_API_KEY atau GROQ_API_KEY aktif.`
    );
  }

  const payload = (await res.json()) as {
    reply?: string;
    error?: string;
    provider?: PnlAiProviderChoice;
  };
  if (!res.ok || payload.error) {
    throw new Error(
      payload.error ||
        `Gagal mendapatkan analisis AI dari ${provider === 'groq' ? 'Groq' : 'Gemini'}.`
    );
  }

  const text = cleanAiProse(payload.reply ?? '');
  if (!text) {
    throw new Error(
      `${provider === 'groq' ? 'Groq' : 'Gemini'} tidak mengembalikan isi analisis.`
    );
  }

  hydratePnlAiCache();
  memoryPnlAiCache.set(cacheKey, {
    text,
    monthKey: report.monthKey,
    cachedAt: Date.now(),
  });
  persistPnlAiCache();

  return { text, provider: payload.provider ?? provider, fromCache: false };
}

export interface PnlFollowUpTurn {
  role: 'user' | 'assistant';
  text: string;
}

export async function askPnlFollowUpQuestion({
  row,
  report,
  prevReport,
  provider = 'gemini',
  initialAnalysis,
  history,
  question,
  signal,
}: {
  row: PnlRow;
  report: PnlMonthReport;
  prevReport: PnlMonthReport | null;
  provider?: PnlAiProviderChoice;
  initialAnalysis: string;
  history: PnlFollowUpTurn[];
  question: string;
  signal?: AbortSignal;
}): Promise<{ text: string; provider: PnlAiProviderChoice }> {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error('Pertanyaan tidak boleh kosong.');
  }

  const contextText = buildPnlAnalysisContext(row, report, prevReport);
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      action: 'pnl_chat',
      provider,
      pnlTargetLabel: `${row.description}${row.account ? ` (${row.account})` : ''}`,
      contextText,
      initialAnalysis,
      history,
      question: trimmedQuestion,
    }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Server AI belum tersedia di hosting ini (HTTP ${res.status}). Pastikan endpoint /api/ai sudah ter-deploy di Vercel dan GEMINI_API_KEY atau GROQ_API_KEY aktif.`
    );
  }

  const payload = (await res.json()) as {
    reply?: string;
    error?: string;
    provider?: PnlAiProviderChoice;
  };
  if (!res.ok || payload.error) {
    throw new Error(
      payload.error ||
        `Gagal mengirim pertanyaan ke ${provider === 'groq' ? 'Groq' : 'Gemini'}.`
    );
  }

  const text = cleanAiProse(payload.reply ?? '');
  if (!text) {
    throw new Error(
      `${provider === 'groq' ? 'Groq' : 'Gemini'} tidak mengembalikan jawaban.`
    );
  }

  return { text, provider: payload.provider ?? provider };
}

export function cleanAiProse(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let tableHeaders: string[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) {
      tableHeaders = null;
      if (out.length > 0 && out[out.length - 1] !== '') {
        out.push('');
      }
      continue;
    }

    if (line.startsWith('```')) {
      continue;
    }

    if (/^\|?[\s:*-]+\|[\s|:-]*$/.test(line) || /^[-*_]{3,}$/.test(line)) {
      continue;
    }

    line = line.replace(/^#{1,6}\s+/, '');

    if (line.includes('|')) {
      const cells = line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);

      if (cells.length === 0) continue;

      const nextLine = (lines[i + 1] ?? '').trim();
      const nextIsDivider = /^\|?[\s:*-]+\|[\s|:-]*$/.test(nextLine);
      if (nextIsDivider) {
        tableHeaders = cells;
        continue;
      }

      if (tableHeaders && tableHeaders.length === cells.length) {
        const pairs = cells.map((cell, idx) =>
          idx === 0 ? cell : `${tableHeaders![idx]}: ${cell}`
        );
        out.push(`- ${pairs.join(' — ')}`);
      } else if (cells.length >= 2) {
        out.push(`- ${cells[0]}: ${cells.slice(1).join(' · ')}`);
      } else {
        out.push(cells[0]);
      }
      continue;
    }

    tableHeaders = null;
    out.push(line);
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------- Permanent Note untuk Analisa Sederhana (Dari Aplikasi) ----------

const PNL_PERMANENT_NOTES_KEY = 'so_pnl_permanent_notes_v1';

export interface PnlPermanentNote {
  text: string;
  provider: PnlAiProviderChoice;
  savedAt: number;
  monthKey: string;
  description: string;
}

const memoryPnlPermanentNotes = new Map<string, PnlPermanentNote>();
let permanentNotesHydrated = false;

function hydratePnlPermanentNotes(): void {
  if (permanentNotesHydrated) return;
  permanentNotesHydrated = true;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(PNL_PERMANENT_NOTES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, PnlPermanentNote>;
    if (!parsed || typeof parsed !== 'object') return;
    for (const [k, v] of Object.entries(parsed)) {
      if (
        v &&
        typeof v === 'object' &&
        typeof v.text === 'string' &&
        typeof v.monthKey === 'string' &&
        typeof v.description === 'string'
      ) {
        memoryPnlPermanentNotes.set(k, {
          text: cleanAiProse(v.text),
          provider: v.provider === 'groq' ? 'groq' : 'gemini',
          savedAt: typeof v.savedAt === 'number' ? v.savedAt : Date.now(),
          monthKey: v.monthKey,
          description: v.description,
        });
      }
    }
  } catch {
    // Ignore corrupted storage
  }
}

function persistPnlPermanentNotes(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const serialized: Record<string, PnlPermanentNote> = {};
    for (const [k, v] of memoryPnlPermanentNotes.entries()) {
      serialized[k] = v;
    }
    window.localStorage.setItem(
      PNL_PERMANENT_NOTES_KEY,
      JSON.stringify(serialized)
    );
  } catch {
    // Ignore storage quota issues
  }
}

export function getPnlPermanentNoteKey(
  monthKey: string,
  description: string
): string {
  return `${monthKey}::${normalizeDesc(description)}`;
}

export function getPnlPermanentNote(
  monthKey: string,
  description: string
): PnlPermanentNote | null {
  hydratePnlPermanentNotes();
  return (
    memoryPnlPermanentNotes.get(
      getPnlPermanentNoteKey(monthKey, description)
    ) ?? null
  );
}

export function savePnlPermanentNote({
  monthKey,
  description,
  text,
  provider,
}: {
  monthKey: string;
  description: string;
  text: string;
  provider: PnlAiProviderChoice;
}): PnlPermanentNote {
  hydratePnlPermanentNotes();
  const cleaned = cleanAiProse(text);
  const entry: PnlPermanentNote = {
    text: cleaned,
    provider,
    savedAt: Date.now(),
    monthKey,
    description,
  };
  memoryPnlPermanentNotes.set(
    getPnlPermanentNoteKey(monthKey, description),
    entry
  );
  persistPnlPermanentNotes();
  return entry;
}

export function removePnlPermanentNote(
  monthKey: string,
  description: string
): void {
  hydratePnlPermanentNotes();
  memoryPnlPermanentNotes.delete(getPnlPermanentNoteKey(monthKey, description));
  persistPnlPermanentNotes();
}

export function clearPnlPermanentNotes(monthKey?: string): void {
  hydratePnlPermanentNotes();
  if (!monthKey) {
    memoryPnlPermanentNotes.clear();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(PNL_PERMANENT_NOTES_KEY);
      }
    } catch {
      // Ignore storage error
    }
    return;
  }
  for (const [k, v] of Array.from(memoryPnlPermanentNotes.entries())) {
    if (v.monthKey === monthKey || k.startsWith(`${monthKey}::`)) {
      memoryPnlPermanentNotes.delete(k);
    }
  }
  persistPnlPermanentNotes();
}



