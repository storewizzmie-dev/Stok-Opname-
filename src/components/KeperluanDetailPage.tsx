import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Layers,
  LayoutGrid,
  Lightbulb,
  Package,
  Scale,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  ConvertedStockRow,
  ProductStat,
  StockDataset,
  ViewScope,
  computeSummary,
  convertRowWithMeta,
  formatDateFullId,
  formatDateId,
  formatDateRangeLabel,
  formatMonthId,
  formatPackEquivalent,
  formatQty,
  formatQtyMap,
  formatRupiah,
  formatSignedQty,
  getItemPackagingSpec,
   formatCompactRupiah,
} from '../lib/stockOpname';

export type KeperluanGroupId = 'food' | 'packaging' | 'beverage' | 'operational';

export interface KeperluanGroupDefinition {
  id: KeperluanGroupId;
  title: string;
  shortLabel: string;
  description: string;
  indicationNeg: string;
  indicationPos: string;
  whyMinusPoints: string[];
  whyPlusPoints: string[];
  actionSteps: string[];
  barColor: string;
  badgeClass: string;
}

export const KEPERLUAN_GROUP_LIST: KeperluanGroupDefinition[] = [
  {
    id: 'food',
    title: 'Bahan Makanan & Masakan',
    shortLabel: 'Bahan Makanan',
    description:
      'Bahan baku utama makanan, mie, dimsum, daging/ayam, sayuran, bumbu masakan, saus, dan minyak.',
    indicationNeg: 'Potensi waste / takaran porsi berlebih',
    indicationPos: 'Potensi porsi kurang / belum terpotong di sistem',
    whyMinusPoints: [
      'Takaran porsi / gramasi saat penyajian melebihi standar resep (over-portioning).',
      'Bahan rusak, basi, atau jatuh saat produksi belum dicatat pada form waste harian.',
      'Salah konversi satuan saat input opname (misal hitungan pack/porsi tertulis gram atau sebaliknya).',
    ],
    whyPlusPoints: [
      'Takaran porsi sajian kurang dari standar SOP gramasi resep.',
      'Penjualan menu di kasir belum memotong stok bahan secara otomatis atau mutasi masuk belum tercatat.',
      'Hitungan fisik gudang menggabungkan kemasan utuh dan sisa terbuka dengan satuan yang berbeda.',
    ],
    actionSteps: [
      'Cek ulang takaran timbangan/gramasi porsi pada 3 barang minus terbesar di daftar bawah.',
      'Pastikan setiap bahan makanan yang rusak atau terbuang wajib dicatat di laporan waste harian.',
      'Hitung ulang fisik stok di chiller/freezer pada barang yang selisihnya berulang lebih dari 2 hari.',
    ],
    barColor: '#E0139C',
    badgeClass:
      'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
  },
  {
    id: 'packaging',
    title: 'Kemasan & Plastik (Packaging)',
    shortLabel: 'Kemasan & Plastik',
    description:
      'Paper bowl, lunch box, cup, tutup (lid), sedotan, sumpit, sendok, kantong plastik, dan stiker kemasan.',
    indicationNeg: 'Potensi salah input / tercecer / hilang',
    indicationPos: 'Potensi salah hitung pack/pcs atau take-away belum tercatat',
    whyMinusPoints: [
      'Kemasan rusak, penyok, atau kotor saat pengemasan dibuang tanpa dicatat sebagai waste.',
      'Pemakaian kemasan rangkap/dobel untuk pesanan take-away atau delivery online.',
      'Kasir menginput pesanan sebagai Dine-In padahal pelanggan meminta bungkus (Take-Away).',
    ],
    whyPlusPoints: [
      'Kasir menginput pesanan Take-Away tetapi pelanggan makan di tempat (kemasan tidak terpakai).',
      'Salah hitung jumlah isi per slop/pack saat stok opname di gudang.',
      'Stok kemasan cadangan di area kasir/packing ikut terhitung ganda.',
    ],
    actionSteps: [
      'Cocokkan jumlah transaksi Take-Away/Delivery di sistem ESB dengan pemakaian paper bowl & plastik.',
      'Pastikan tim opname menghitung kemasan berdasarkan satuan ESB (per pcs atau per pack/slop).',
      'Simpan kemasan yang penyok/rusak di wadah khusus agar bisa dihitung sebelum dibuang.',
    ],
    barColor: '#F59E0B',
    badgeClass:
      'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  },
  {
    id: 'beverage',
    title: 'Bahan Minuman & Bar',
    shortLabel: 'Bahan Minuman',
    description:
      'Susu, sirup, bubuk minuman (powder), teh, kopi, krimer, topping minuman, jelly, boba, dan gelato.',
    indicationNeg: 'Potensi takaran resep berlebih / tumpah di bar',
    indicationPos: 'Potensi takaran minuman kurang / selisih konversi botol-ml',
    whyMinusPoints: [
      'Takaran pump sirup, jigger susu, atau sendok powder melebihi resep standar bar.',
      'Tumpah, menetes, atau sisa cairan tertinggal di botol/kemasan saat menuang di area bar.',
      'Trial minuman atau minuman salah buat tidak dicatat pada form waste bar.',
    ],
    whyPlusPoints: [
      'Takaran sirup, susu, atau powder kurang dari standar resep minuman.',
      'Selisih taksiran sisa botol/kemasan terbuka saat dikonversi ke ml atau gram.',
      'Barang bar yang baru dibuka belum dipotong atau salah kode varian rasa.',
    ],
    actionSteps: [
      'Kalibrasi ulang alat takar di area bar (jigger, pump sirup, dan sendok takar powder).',
      'Gunakan panduan konversi botol/pack ke ml atau gram secara konsisten saat opname.',
      'Fokus cek barang minuman dengan frekuensi minus tertinggi pada daftar di bawah.',
    ],
    barColor: '#3B82F6',
    badgeClass:
      'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30',
  },
  {
    id: 'operational',
    title: 'Perlengkapan & Operasional',
    shortLabel: 'Operasional',
    description:
      'Tisu, sabun cuci, cairan pembersih (chemical), sanitizer, gas LPG, ATK, dan perlengkapan operasional toko.',
    indicationNeg: 'Pemakaian kebersihan toko / selisih pencatatan',
    indicationPos: 'Stok gudang operasional belum diinput pemakaian',
    whyMinusPoints: [
      'Pengambilan tisu, sabun, atau cairan pembersih dari gudang untuk operasional harian belum diinput pemakaian.',
      'Pemakaian cairan pembersih/chemical melebihi takaran standar harian.',
      'Tabung gas atau perlengkapan operasional berpindah area tanpa catatan.',
    ],
    whyPlusPoints: [
      'Barang operasional sudah dipotong habis di sistem ESB saat dibuka, padahal fisik di gudang masih ada.',
      'Pengiriman barang perlengkapan toko sudah masuk ke gudang tetapi belum diinput penerimaan.',
    ],
    actionSteps: [
      'Catat setiap pengambilan barang operasional & kebersihan dari gudang pada buku/form pengeluaran.',
      'Pastikan pemotongan stok perlengkapan di sistem ESB sesuai dengan fisik yang benar-benar habis.',
      'Gunakan gelas/tutup takar untuk pemakaian sabun dan chemical kebersihan.',
    ],
    barColor: '#8B5CF6',
    badgeClass:
      'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/30',
  },
];

export function classifyKeperluanGroup(
  name: string,
  category: string,
  subcategory: string
): KeperluanGroupId {
  const combined = `${name} ${category} ${subcategory}`.toLowerCase();
  if (
    /\b(packaging|kemasan|cup|lid|straw|sedotan|paper|papper|bowl|lunch\s*box|box|plastik|kresek|tas|spunbond|sumpit|sendok|spoons|garpu|tutup|seal|wrap|mika|kantong|chopstick|sticker|kertas)\b/i.test(
      combined
    )
  ) {
    return 'packaging';
  }
  if (
    /\b(tissue|tisu|sabun|cleaner|soap|sanitizer|nobla|suma|portex|gas|lpg|topi|undangan|balon|birthday|chemical|atk|operasional|kebersihan|general)\b/i.test(
      combined
    )
  ) {
    return 'operational';
  }
  if (
    /\b(beverage|drink|minuman|bar|milk|susu|sirup|syrup|powder|tea|teh|coffee|kopi|sunquick|frappe|matcha|taro|redvelvet|skm|gelato|whipping|air\s*mineral|yakult|jelly|boba|toping\s*(caramel|coklat)|leci|rozen|hazelnut|vanila)\b/i.test(
      combined
    )
  ) {
    return 'beverage';
  }
  return 'food';
}

type SummaryResult = ReturnType<typeof computeSummary>;

interface EnrichedKeperluanProduct {
  stat: ProductStat;
  sysByUnit: Record<string, number>;
  opByUnit: Record<string, number>;
  entries: { date: string; meta: ConvertedStockRow }[];
}

export function KeperluanDetailPage({
  activeKeperluanId,
  onSelectKeperluanId,
  onBackToBeranda,
  onOpenProductInCekBarang,
  onOpenDayInHarian,
  onOpenRangePicker,
  onChangeViewScope,
  onSelectDay,
  summary,
  data,
  activeMonth,
  activeDay,
  activeMonthDates,
  viewScope,
}: {
  activeKeperluanId: KeperluanGroupId;
  onSelectKeperluanId: (id: KeperluanGroupId) => void;
  onBackToBeranda: () => void;
  onOpenProductInCekBarang: (productName: string) => void;
  onOpenDayInHarian: (date: string) => void;
  onOpenRangePicker: () => void;
  onChangeViewScope: (scope: ViewScope) => void;
  onSelectDay: (date: string) => void;
  summary: SummaryResult;
  data: StockDataset;
  activeMonth: string;
  activeDay: string;
  activeMonthDates: string[];
  viewScope: ViewScope;
}) {
  const [itemFilter, setItemFilter] = useState<'all' | 'neg' | 'pos' | 'pas'>(
    'neg'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [bagianFilter, setBagianFilter] = useState('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('ALL');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {}
  );

  const activeGroupDef =
    KEPERLUAN_GROUP_LIST.find((g) => g.id === activeKeperluanId) ??
    KEPERLUAN_GROUP_LIST[0];

  // Compute all 4 buckets summary so the top switcher pills show real numbers
  const allBucketsSummary = useMemo(() => {
    const map: Record<
      KeperluanGroupId,
      {
        negVal: number;
        posVal: number;
        netVal: number;
        negCount: number;
        posCount: number;
        pasCount: number;
        totalCount: number;
      }
    > = {
      food: {
        negVal: 0,
        posVal: 0,
        netVal: 0,
        negCount: 0,
        posCount: 0,
        pasCount: 0,
        totalCount: 0,
      },
      packaging: {
        negVal: 0,
        posVal: 0,
        netVal: 0,
        negCount: 0,
        posCount: 0,
        pasCount: 0,
        totalCount: 0,
      },
      beverage: {
        negVal: 0,
        posVal: 0,
        netVal: 0,
        negCount: 0,
        posCount: 0,
        pasCount: 0,
        totalCount: 0,
      },
      operational: {
        negVal: 0,
        posVal: 0,
        netVal: 0,
        negCount: 0,
        posCount: 0,
        pasCount: 0,
        totalCount: 0,
      },
    };

    for (const prod of Object.values(summary.productMap)) {
      const gid = classifyKeperluanGroup(
        prod.name,
        prod.category,
        prod.subcategory
      );
      const b = map[gid];
      b.totalCount++;
      b.negVal += prod.negVal;
      b.posVal += prod.posVal;
      b.netVal += prod.netVal;
      if (prod.netVal < -0.5) b.negCount++;
      else if (prod.netVal > 0.5) b.posCount++;
      else b.pasCount++;
    }
    return map;
  }, [summary]);

  // Enriched products and per-date stats for the currently selected Keperluan
  const {
    productsInGroup,
    dailyBreakdown,
    bagianBreakdown,
    groupNegVal,
    groupPosVal,
    groupNetVal,
    negItemsCount,
    posItemsCount,
    pasItemsCount,
  } = useMemo(() => {
    const enrichedMap: Record<string, EnrichedKeperluanProduct> = {};
    let gNeg = 0;
    let gPos = 0;
    let gNet = 0;
    let nCount = 0;
    let pCount = 0;
    let eqCount = 0;

    for (const [name, stat] of Object.entries(summary.productMap)) {
      const gid = classifyKeperluanGroup(
        stat.name,
        stat.category,
        stat.subcategory
      );
      if (gid !== activeKeperluanId) continue;

      enrichedMap[name] = {
        stat,
        sysByUnit: {},
        opByUnit: {},
        entries: [],
      };

      gNeg += stat.negVal;
      gPos += stat.posVal;
      gNet += stat.netVal;
      if (stat.netVal < -0.5) nCount++;
      else if (stat.netVal > 0.5) pCount++;
      else eqCount++;
    }

    const dailyMap: Record<
      string,
      {
        date: string;
        negVal: number;
        posVal: number;
        netVal: number;
        diffCount: number;
        pasCount: number;
      }
    > = {};

    for (const date of summary.activeDates) {
      dailyMap[date] = {
        date,
        negVal: 0,
        posVal: 0,
        netVal: 0,
        diffCount: 0,
        pasCount: 0,
      };
      const rows = data[date] ?? [];
      for (const rawRow of rows) {
        const meta = convertRowWithMeta(rawRow);
        const item = enrichedMap[meta.row[0]];
        if (!item) continue;

        const unit = meta.row[1] || 'Unit';
        item.sysByUnit[unit] = (item.sysByUnit[unit] ?? 0) + meta.row[2];
        item.opByUnit[unit] = (item.opByUnit[unit] ?? 0) + meta.row[3];
        item.entries.push({ date, meta });

        const diffVal = meta.row[6];
        const diffQty = meta.row[4];
        const dStat = dailyMap[date];
        if (diffVal < -0.5) dStat.negVal += diffVal;
        else if (diffVal > 0.5) dStat.posVal += diffVal;
        dStat.netVal += diffVal;

        if (Math.abs(diffQty) > 1e-9 || Math.abs(diffVal) > 0.5) {
          dStat.diffCount++;
        } else {
          dStat.pasCount++;
        }
      }
    }

    const bagianMap: Record<
      string,
      {
        bagian: string;
        negVal: number;
        posVal: number;
        netVal: number;
        totalItems: number;
        negItems: number;
        posItems: number;
      }
    > = {};

    for (const item of Object.values(enrichedMap)) {
      const cat = item.stat.category || 'Lainnya';
      if (!bagianMap[cat]) {
        bagianMap[cat] = {
          bagian: cat,
          negVal: 0,
          posVal: 0,
          netVal: 0,
          totalItems: 0,
          negItems: 0,
          posItems: 0,
        };
      }
      const b = bagianMap[cat];
      b.totalItems++;
      b.negVal += item.stat.negVal;
      b.posVal += item.stat.posVal;
      b.netVal += item.stat.netVal;
      if (item.stat.netVal < -0.5) b.negItems++;
      else if (item.stat.netVal > 0.5) b.posItems++;
    }

    return {
      productsInGroup: Object.values(enrichedMap),
      dailyBreakdown: Object.values(dailyMap).sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
      bagianBreakdown: Object.values(bagianMap).sort(
        (a, b) => Math.abs(b.negVal) - Math.abs(a.negVal)
      ),
      groupNegVal: gNeg,
      groupPosVal: gPos,
      groupNetVal: gNet,
      negItemsCount: nCount,
      posItemsCount: pCount,
      pasItemsCount: eqCount,
    };
  }, [summary, data, activeKeperluanId]);

  const totalProductsCount = productsInGroup.length;
  const accuracyPct =
    totalProductsCount > 0
      ? Math.round((pasItemsCount / totalProductsCount) * 100)
      : 100;

  const shareOfStoreMinusPct =
    Math.abs(summary.totalNeg) > 0.5
      ? Math.min(
          100,
          Math.round((Math.abs(groupNegVal) / Math.abs(summary.totalNeg)) * 100)
        )
      : 0;

  const shareOfStorePlusPct =
    Math.abs(summary.totalPos) > 0.5
      ? Math.min(
          100,
          Math.round((Math.abs(groupPosVal) / Math.abs(summary.totalPos)) * 100)
        )
      : 0;

  // Top critical items (Top 3 Minus & Top 3 Lebih)
  const topMinusProducts = useMemo(
    () =>
      [...productsInGroup]
        .filter((p) => p.stat.negVal < -0.5)
        .sort((a, b) => a.stat.negVal - b.stat.negVal),
    [productsInGroup]
  );

  const topPlusProducts = useMemo(
    () =>
      [...productsInGroup]
        .filter((p) => p.stat.posVal > 0.5)
        .sort((a, b) => b.stat.posVal - a.stat.posVal),
    [productsInGroup]
  );

  const worstMinusDateObj = useMemo(() => {
    if (!dailyBreakdown.length) return null;
    const sorted = [...dailyBreakdown].sort((a, b) => a.negVal - b.negVal);
    return sorted[0] && sorted[0].negVal < -0.5 ? sorted[0] : null;
  }, [dailyBreakdown]);

  const maxDailyVal = useMemo(
    () =>
      Math.max(
        1,
        ...dailyBreakdown.map((d) =>
          Math.max(Math.abs(d.negVal), Math.abs(d.posVal))
        )
      ),
    [dailyBreakdown]
  );

  // Filtered product list
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return productsInGroup
      .filter((item) => {
        const s = item.stat;
        if (bagianFilter !== 'ALL' && s.category !== bagianFilter) {
          return false;
        }
        if (selectedDateFilter !== 'ALL') {
          const hasEntryOnDate = item.entries.some(
            (e) =>
              e.date === selectedDateFilter &&
              (itemFilter === 'all'
                ? true
                : itemFilter === 'neg'
                ? e.meta.row[6] < -0.5
                : itemFilter === 'pos'
                ? e.meta.row[6] > 0.5
                : Math.abs(e.meta.row[6]) <= 0.5)
          );
          if (!hasEntryOnDate) return false;
        } else {
          if (itemFilter === 'neg' && s.netVal >= -0.5 && s.negVal >= -0.5) {
            return false;
          }
          if (itemFilter === 'pos' && s.netVal <= 0.5 && s.posVal <= 0.5) {
            return false;
          }
          if (itemFilter === 'pas' && Math.abs(s.netVal) > 0.5) {
            return false;
          }
        }

        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.subcategory.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (itemFilter === 'neg') {
          return a.stat.negVal - b.stat.negVal;
        }
        if (itemFilter === 'pos') {
          return b.stat.posVal - a.stat.posVal;
        }
        return Math.abs(b.stat.netVal) - Math.abs(a.stat.netVal);
      });
  }, [
    productsInGroup,
    itemFilter,
    searchQuery,
    bagianFilter,
    selectedDateFilter,
  ]);

  const periodLabel =
    viewScope === 'month'
      ? formatMonthId(activeMonth)
      : viewScope === 'range'
      ? formatDateRangeLabel(summary.rangeStart, summary.rangeEnd)
      : formatDateId(activeDay);

  return (
    <div className="space-y-4">
      {/* TOP BAR: BACK BUTTON + KEPERLUAN SWITCHER PILLS */}
      <section className="rounded-3xl bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#243F6E] p-3.5 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToBeranda}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#FDF2FA] hover:bg-[#FCE4F6] dark:bg-[#132548] dark:hover:bg-[#1B3360] border border-[#EBC7E9] dark:border-[#2A4A7F] text-xs sm:text-sm font-extrabold text-[#7E22CE] dark:text-amber-300 transition-all cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Kembali ke Beranda</span>
          </button>

          {/* Period & Scope Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#6E4877] dark:text-[#A8B9D3] mr-1">
              Periode:{' '}
              <strong className="text-[#391042] dark:text-white">
                {periodLabel}
              </strong>{' '}
              ({summary.activeDates.length} hari)
            </span>

            <div className="inline-flex items-center rounded-full border border-[#EBC7E9] dark:border-[#243F6E] bg-[#FAF5FC] dark:bg-[#0A162B] p-0.5">
              <button
                type="button"
                onClick={() => {
                  onChangeViewScope('range');
                  onOpenRangePicker();
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                  viewScope === 'range'
                    ? 'wizzmie-pink-pill text-white'
                    : 'text-[#391042] dark:text-slate-300 hover:text-[#C61196]'
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Rentang Tanggal</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeViewScope('day')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                  viewScope === 'day'
                    ? 'wizzmie-pink-pill text-white'
                    : 'text-[#391042] dark:text-slate-300 hover:text-[#C61196]'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Cek 1 Hari</span>
              </button>
            </div>

            {viewScope === 'day' && (
              <select
                aria-label="Pilih tanggal"
                value={activeDay}
                onChange={(e) => onSelectDay(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold rounded-full border border-[#EBC7E9] dark:border-[#1F3763] bg-white dark:bg-[#0F2244] text-[#391042] dark:text-slate-200 cursor-pointer"
              >
                {activeMonthDates
                  .slice()
                  .reverse()
                  .map((d) => (
                    <option key={d} value={d}>
                      {formatDateFullId(d)}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>

        {/* 4 Keperluan Quick Switcher Tabs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-[#F3E2F1] dark:border-[#1B3258]">
          {KEPERLUAN_GROUP_LIST.map((g) => {
            const isSelected = g.id === activeKeperluanId;
            const bStat = allBucketsSummary[g.id];
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  onSelectKeperluanId(g.id);
                  setBagianFilter('ALL');
                  setSelectedDateFilter('ALL');
                }}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-br from-[#FDF2FA] to-[#F5E6FA] dark:from-[#172D56] dark:to-[#1E1B4B] border-[#E0139C] dark:border-amber-400 shadow-xs'
                    : 'bg-[#FAF5FC]/70 hover:bg-[#FDF2FA] dark:bg-[#0E1D38] dark:hover:bg-[#132648] border-[#EBC7E9] dark:border-[#1E365F]'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: g.barColor }}
                    />
                    <span
                      className={`text-xs font-extrabold truncate ${
                        isSelected
                          ? 'text-[#C61196] dark:text-amber-300'
                          : 'text-[#391042] dark:text-slate-200'
                      }`}
                    >
                      {g.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#7D4E85] dark:text-[#A8B9D3] shrink-0">
                    {bStat.totalCount} brg
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] font-mono font-bold tabular-nums">
                  <span className="text-rose-600 dark:text-rose-400">
                    -{formatCompactRupiah(bStat.negVal)}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{formatCompactRupiah(bStat.posVal)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* HERO BANNER KEPERLUAN & 4 KARTU RINGKASAN UTAMA */}
      <section className="surface-3d rounded-3xl p-4 sm:p-6 border border-[#EBC7E9] dark:border-[#243F6E] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#F0D8EE] dark:border-[#1E365F]">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: activeGroupDef.barColor }}
              />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#C61196] dark:text-[#FFC400]">
                HALAMAN RINCIAN PER KEPERLUAN
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold text-[#391042] dark:text-white">
              {activeGroupDef.title}
            </h1>
            <p className="text-xs sm:text-sm text-[#6E4877] dark:text-[#A8B9D3]">
              {activeGroupDef.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="px-3.5 py-2 rounded-2xl bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#243F6E] text-xs">
              <span className="text-[#7D4E85] dark:text-[#A8B9D3] block text-[10px] font-bold uppercase">
                Porsi Minus dari Total Toko
              </span>
              <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                {shareOfStoreMinusPct}% dari total kekurangan toko
              </span>
            </div>
          </div>
        </div>

        {/* 4 Kartu Ringkasan Keperluan Ini */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Kekurangan Stok Keperluan Ini */}
          <button
            type="button"
            onClick={() => setItemFilter('neg')}
            className={`text-left rounded-2xl p-4 bg-white dark:bg-[#0B172E] border transition-all cursor-pointer shadow-xs ${
              itemFilter === 'neg'
                ? 'border-rose-500 ring-2 ring-rose-500/20'
                : 'border-[#EBC7E9] dark:border-[#243F6E] hover:border-rose-400'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#C61196] dark:text-[#FFC400]">
                KEKURANGAN STOK
              </span>
              <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
              - {formatRupiah(groupNegVal)}
            </div>
            <div className="text-xs font-bold text-[#6E4877] dark:text-[#A8B9D3] mt-1">
              {topMinusProducts.length} barang pernah minus ({negItemsCount} hasil akhir minus)
            </div>
          </button>

          {/* Card 2: Kelebihan Stok Keperluan Ini */}
          <button
            type="button"
            onClick={() => setItemFilter('pos')}
            className={`text-left rounded-2xl p-4 bg-white dark:bg-[#0B172E] border transition-all cursor-pointer shadow-xs ${
              itemFilter === 'pos'
                ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                : 'border-[#EBC7E9] dark:border-[#243F6E] hover:border-emerald-400'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#C61196] dark:text-[#FFC400]">
                KELEBIHAN STOK
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
              + {formatRupiah(groupPosVal)}
            </div>
            <div className="text-xs font-bold text-[#6E4877] dark:text-[#A8B9D3] mt-1">
              +{topPlusProducts.length} barang pernah lebih ({posItemsCount} hasil akhir lebih) · {shareOfStorePlusPct}% toko
            </div>
          </button>

          {/* Card 3: Hasil Gabungan Keperluan Ini */}
          <button
            type="button"
            onClick={() => setItemFilter('all')}
            className={`text-left rounded-2xl p-4 bg-white dark:bg-[#0B172E] border transition-all cursor-pointer shadow-xs ${
              itemFilter === 'all'
                ? 'border-[#E0139C] ring-2 ring-[#E0139C]/20'
                : 'border-[#EBC7E9] dark:border-[#243F6E] hover:border-[#E0139C]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#C61196] dark:text-[#FFC400]">
                HASIL GABUNGAN
              </span>
              <Scale className="w-4 h-4 text-[#C61196] dark:text-[#FFC400]" />
            </div>
            <div
              className={`text-xl sm:text-2xl font-black font-mono tabular-nums mt-1 ${
                groupNetVal < -0.5
                  ? 'text-rose-600 dark:text-rose-400'
                  : groupNetVal > 0.5
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-[#391042] dark:text-white'
              }`}
            >
              {groupNetVal < -0.5
                ? `- ${formatRupiah(groupNetVal)}`
                : groupNetVal > 0.5
                ? `+ ${formatRupiah(groupNetVal)}`
                : 'Pas Rp 0'}
            </div>
            <div className="text-xs font-bold text-[#6E4877] dark:text-[#A8B9D3] mt-1">
              {groupNetVal < -0.5
                ? 'Selisih Bersih Masih Kurang'
                : groupNetVal > 0.5
                ? 'Selisih Bersih Lebih'
                : 'Seimbang'}
            </div>
          </button>

          {/* Card 4: Akurasi Stok Pas Keperluan Ini */}
          <button
            type="button"
            onClick={() => setItemFilter('pas')}
            className={`text-left rounded-2xl p-4 bg-white dark:bg-[#0B172E] border transition-all cursor-pointer shadow-xs ${
              itemFilter === 'pas'
                ? 'border-[#7E22CE] ring-2 ring-[#7E22CE]/20'
                : 'border-[#EBC7E9] dark:border-[#243F6E] hover:border-[#7E22CE]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#C61196] dark:text-[#FFC400]">
                AKURASI STOK PAS
              </span>
              <ClipboardCheck className="w-4 h-4 text-[#7E22CE] dark:text-amber-300" />
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[#391042] dark:text-white mt-1">
              {accuracyPct}%
            </div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {pasItemsCount} dari {totalProductsCount} barang pas
            </div>
          </button>
        </div>

        {/* SECTION: YANG HARUS DIKETAHUI MANAJER (DIAGNOSA, BARANG PRIORITAS & TINDAK LANJUT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Left 7 Cols: Apa yang Harus Diketahui & Langkah Tindakan Manajer */}
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#243F6E] p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#FDE4F7] dark:bg-amber-400/15 border border-[#F2BCE7] dark:border-amber-400/35 flex items-center justify-center text-[#C61196] dark:text-amber-300 shrink-0">
                  <Lightbulb className="w-4 h-4 stroke-[2.2]" />
                </span>
                <div>
                  <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.12em] text-[#C61196] dark:text-[#FFC400]">
                    YANG HARUS DIKETAHUI PADA {activeGroupDef.title.toUpperCase()}
                  </h2>
                  <p className="text-[11px] text-[#7D4E85] dark:text-[#A8B9D3]">
                    Diagnosa penyebab utama selisih dan langkah pemeriksaan di lapangan.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Penyebab Minus */}
              <div className="rounded-xl bg-rose-50/70 dark:bg-rose-950/25 border border-rose-200/80 dark:border-rose-500/30 p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Kenapa Bisa Minus (Kurang)?</span>
                </div>
                <ul className="space-y-1.5 text-xs text-[#391042] dark:text-slate-200 leading-relaxed">
                  {activeGroupDef.whyMinusPoints.map((pt, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 shrink-0">
                        {i + 1}.
                      </span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Penyebab Lebih */}
              <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/80 dark:border-emerald-500/30 p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                  <TrendingUp className="w-4 h-4 shrink-0" />
                  <span>Kenapa Bisa Lebih (Surplus)?</span>
                </div>
                <ul className="space-y-1.5 text-xs text-[#391042] dark:text-slate-200 leading-relaxed">
                  {activeGroupDef.whyPlusPoints.map((pt, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {i + 1}.
                      </span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Langkah Tindakan Prioritas */}
            <div className="rounded-xl bg-[#FDF6FC] dark:bg-[#10203D] border border-[#EBC7E9] dark:border-[#243F6E] p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#7E22CE] dark:text-amber-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Langkah Tindakan yang Harus Dilakukan Manajer / PIC:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {activeGroupDef.actionSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#1E365F] p-2.5 text-xs text-[#391042] dark:text-slate-200 leading-relaxed"
                  >
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-gradient-to-r from-[#E0139C] to-[#7E22CE] text-white font-mono text-[10px] font-extrabold mr-1.5">
                      {idx + 1}
                    </span>
                    <span className="font-medium">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Sorotan Kritis (Top 3 Barang Minus Terbesar & Hari Terparah & Bagian) */}
          <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#243F6E] p-4 sm:p-5 flex flex-col justify-between gap-3.5 shadow-xs">
            <div className="space-y-2.5">
              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.12em] text-[#C61196] dark:text-[#FFC400]">
                SOROTAN KRITIS &amp; PRIORITAS AUDIT
              </h2>

              {/* Hari Selisih Terparah pada Keperluan Ini */}
              {worstMinusDateObj ? (
                <div className="rounded-xl bg-rose-50/80 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                      Tanggal Minus Terbesar ({activeGroupDef.shortLabel})
                    </div>
                    <div className="text-xs sm:text-sm font-black font-mono text-rose-700 dark:text-rose-300 mt-0.5">
                      {formatDateFullId(worstMinusDateObj.date)} · -
                      {formatRupiah(worstMinusDateObj.negVal)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenDayInHarian(worstMinusDateObj.date)}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#132548] border border-rose-200 dark:border-rose-500/40 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors shrink-0 cursor-pointer"
                  >
                    Cek Tanggal →
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Tidak ada tanggal dengan selisih minus pada keperluan ini.
                </div>
              )}

              {/* Top 3 Barang Minus Terbesar di Keperluan Ini */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-[#6E4877] dark:text-[#A8B9D3]">
                  <span>3 Barang Minus Terbesar Wajib Dicek</span>
                  <span>Nilai Minus</span>
                </div>

                {topMinusProducts.length === 0 ? (
                  <p className="text-xs text-[#7D4E85] dark:text-[#A8B9D3] py-2">
                    Semua barang pada keperluan ini bebas dari minus.
                  </p>
                ) : (
                  topMinusProducts.slice(0, 3).map((item, idx) => (
                    <button
                      key={item.stat.name}
                      type="button"
                      onClick={() => {
                        setItemFilter('neg');
                        setExpandedItems((prev) => ({
                          ...prev,
                          [item.stat.name]: true,
                        }));
                        const el = document.getElementById(
                          `keperluan-item-${encodeURIComponent(item.stat.name)}`
                        );
                        if (el) {
                          el.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          });
                        }
                      }}
                      className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FDF7FC] hover:bg-[#FCEBF9] dark:bg-[#10203D] dark:hover:bg-[#162B52] border border-[#EBC7E9] dark:border-[#243F6E] text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-rose-500 text-white font-mono text-[10px] font-extrabold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#391042] dark:text-white truncate">
                            {item.stat.name}
                          </div>
                          <div className="text-[10px] text-[#7D4E85] dark:text-[#A8B9D3]">
                            Minus di {item.stat.negDays} hari · Bagian:{' '}
                            {item.stat.category}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono tabular-nums">
                        <div className="text-xs font-black text-rose-600 dark:text-rose-400">
                          -{formatRupiah(item.stat.negVal)}
                        </div>
                        <div className="text-[10px] text-[#6E4877] dark:text-[#A8B9D3]">
                          {formatQtyMap(
                            item.stat.negQtyByUnit,
                            item.stat.name,
                            false
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Filter Cepat Per Bagian di dalam Keperluan Ini */}
            {bagianBreakdown.length > 0 && (
              <div className="pt-2.5 border-t border-[#F3E2F1] dark:border-[#1B3258] space-y-1.5">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#6E4877] dark:text-[#A8B9D3]">
                  Bagian di Dalam {activeGroupDef.shortLabel} (Ketuk untuk Filter):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBagianFilter('ALL')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                      bagianFilter === 'ALL'
                        ? 'bg-gradient-to-r from-[#E0139C] to-[#7E22CE] text-white'
                        : 'bg-[#FAF5FC] dark:bg-[#10203D] border border-[#EBC7E9] dark:border-[#243F6E] text-[#391042] dark:text-slate-200'
                    }`}
                  >
                    Semua ({totalProductsCount})
                  </button>
                  {bagianBreakdown.map((b) => (
                    <button
                      key={b.bagian}
                      type="button"
                      onClick={() =>
                        setBagianFilter(
                          bagianFilter === b.bagian ? 'ALL' : b.bagian
                        )
                      }
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                        bagianFilter === b.bagian
                          ? 'bg-gradient-to-r from-[#E0139C] to-[#7E22CE] text-white'
                          : 'bg-[#FAF5FC] dark:bg-[#10203D] border border-[#EBC7E9] dark:border-[#243F6E] text-[#391042] dark:text-slate-200'
                      }`}
                    >
                      {b.bagian} ({b.totalItems})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION: TREN HARIAN KHUSUS KEPERLUAN INI */}
        {dailyBreakdown.length > 1 && (
          <div className="rounded-2xl bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#243F6E] p-4 sm:p-5 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.12em] text-[#C61196] dark:text-[#FFC400]">
                  PERGERAKAN HARIAN: {activeGroupDef.title.toUpperCase()}
                </h2>
                <p className="text-[11px] text-[#7D4E85] dark:text-[#A8B9D3]">
                  Ketuk salah satu tanggal untuk memfilter daftar barang pada tanggal tersebut.
                </p>
              </div>
              {selectedDateFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedDateFilter('ALL')}
                  className="px-3 py-1 rounded-full bg-[#FDF2FA] dark:bg-[#162B52] border border-[#EBC7E9] dark:border-[#2A4A7F] text-xs font-bold text-[#C61196] dark:text-amber-300 cursor-pointer"
                >
                  Reset Filter Tanggal ({formatDateId(selectedDateFilter)}) ✕
                </button>
              )}
            </div>

            <div className="overflow-x-auto pb-1">
              <div
                className="grid gap-1.5 min-w-[480px]"
                style={{
                  gridTemplateColumns: `repeat(${dailyBreakdown.length}, minmax(34px, 1fr))`,
                }}
              >
                {dailyBreakdown.map((d) => {
                  const isPicked = selectedDateFilter === d.date;
                  const negPct =
                    d.negVal < -0.5
                      ? Math.max(
                          10,
                          Math.round((Math.abs(d.negVal) / maxDailyVal) * 100)
                        )
                      : 0;
                  const posPct =
                    d.posVal > 0.5
                      ? Math.max(
                          10,
                          Math.round((Math.abs(d.posVal) / maxDailyVal) * 100)
                        )
                      : 0;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() =>
                        setSelectedDateFilter(isPicked ? 'ALL' : d.date)
                      }
                      title={`${formatDateFullId(d.date)}\nMinus: -${formatRupiah(
                        d.negVal
                      )}\nLebih: +${formatRupiah(d.posVal)}`}
                      className={`rounded-xl p-1.5 border flex flex-col items-center transition-all cursor-pointer ${
                        isPicked
                          ? 'bg-[#FDF2FA] dark:bg-[#19325E] border-[#E0139C] dark:border-amber-400 ring-2 ring-[#E0139C]/20'
                          : 'bg-[#FAF5FC]/60 hover:bg-[#FDF2FA] dark:bg-[#0E1D38] border-[#EBC7E9] dark:border-[#1E365F]'
                      }`}
                    >
                      {/* Top Half: Plus */}
                      <div className="w-full h-10 flex items-end justify-center">
                        {posPct > 0 ? (
                          <div
                            className="w-3 sm:w-4 rounded-t-md bg-emerald-500"
                            style={{ height: `${posPct}%` }}
                          />
                        ) : (
                          <div className="w-1.5 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                        )}
                      </div>
                      <div className="w-full h-[1px] bg-[#E5C6E3] dark:bg-[#243F6E] my-0.5" />
                      {/* Bottom Half: Minus */}
                      <div className="w-full h-10 flex items-start justify-center">
                        {negPct > 0 ? (
                          <div
                            className="w-3 sm:w-4 rounded-b-md bg-rose-500"
                            style={{ height: `${negPct}%` }}
                          />
                        ) : (
                          <div className="w-1.5 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                        )}
                      </div>
                      <span
                        className={`mt-1 text-[10px] font-mono font-extrabold px-1 py-0.5 rounded ${
                          isPicked
                            ? 'bg-[#E0139C] text-white'
                            : 'text-[#391042] dark:text-slate-200'
                        }`}
                      >
                        {Number(d.date.slice(8))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* DAFTAR LENGKAP BARANG DALAM KEPERLUAN INI */}
      <section className="surface-3d rounded-3xl p-4 sm:p-6 border border-[#EBC7E9] dark:border-[#243F6E] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-lg font-extrabold text-[#391042] dark:text-white">
              Daftar Barang {activeGroupDef.title} ({filteredProducts.length}{' '}
              barang)
            </h2>
            <p className="text-xs text-[#7D4E85] dark:text-[#A8B9D3]">
              Klik <strong>Lihat Detail</strong> pada barang untuk memunculkan
              data <strong>Di Sistem ESB</strong>, <strong>Hitungan Gudang</strong>,
              harga satuan, konversi kemasan, dan rincian tanggalnya.
            </p>
          </div>

          {/* Filter Status Pills */}
          <div className="inline-flex items-center rounded-full border border-[#EBC7E9] dark:border-[#243F6E] bg-white dark:bg-[#0A162B] p-1 self-start sm:self-auto">
            {(
              [
                {
                  id: 'neg',
                  label: `Minus (${topMinusProducts.length})`,
                },
                {
                  id: 'pos',
                  label: `Lebih (${topPlusProducts.length})`,
                },
                {
                  id: 'pas',
                  label: `Pas (${pasItemsCount})`,
                },
                {
                  id: 'all',
                  label: `Semua (${totalProductsCount})`,
                },
              ] as const
            ).map((tab) => {
              const isActive = itemFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setItemFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'wizzmie-pink-pill text-white'
                      : 'text-[#391042] dark:text-slate-300 hover:text-[#C61196]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & Bagian Filter Input */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-[#7D4E85] dark:text-[#FF7AD2] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari nama barang atau kode di ${activeGroupDef.shortLabel}...`}
              className="w-full pl-11 pr-10 py-2.5 text-xs sm:text-sm rounded-full border border-[#EBC7E9] dark:border-[#233F6D] bg-white dark:bg-[#0A162B] text-[#391042] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E0139C]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="w-6 h-6 rounded-full bg-[#EAD4F0] dark:bg-[#1C3259] text-[#4C1048] dark:text-slate-200 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="sm:col-span-4 relative">
            <LayoutGrid className="w-4 h-4 text-[#6E1269] dark:text-[#FF55C8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              aria-label="Filter bagian"
              value={bagianFilter}
              onChange={(e) => setBagianFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 text-xs sm:text-sm font-bold rounded-full border border-[#EBC7E9] dark:border-[#233F6D] bg-white dark:bg-[#0A162B] text-[#391042] dark:text-slate-100 cursor-pointer"
            >
              <option value="ALL">
                Semua Bagian ({totalProductsCount} barang)
              </option>
              {bagianBreakdown.map((b) => (
                <option key={b.bagian} value={b.bagian}>
                  {b.bagian} ({b.totalItems} barang)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* List of Items */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#243F6E] p-8 text-center text-sm text-[#7D4E85] dark:text-[#A8B9D3]">
            Tidak ada barang yang cocok dengan filter ini pada{' '}
            <strong>{activeGroupDef.title}</strong>.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredProducts.map((item, idx) => {
              const s = item.stat;
              const isExpanded = !!expandedItems[s.name];
              const displayVal =
                itemFilter === 'neg'
                  ? s.negVal
                  : itemFilter === 'pos'
                  ? s.posVal
                  : s.netVal;
              const displayQtyMap =
                itemFilter === 'neg'
                  ? s.negQtyByUnit
                  : itemFilter === 'pos'
                  ? s.posQtyByUnit
                  : s.qtyByUnit;

              const state =
                displayVal < -0.5 ? 'neg' : displayVal > 0.5 ? 'pos' : 'pas';
              const cleanQtyLabel = formatQtyMap(displayQtyMap, s.name, false)
                .replace(/^(Kurang|Lebih)\s+/i, '')
                .replace(/^Pas\s*\((.*)\)$/i, '$1');

              const sysLabel = formatQtyMap(item.sysByUnit, s.name);
              const opLabel = formatQtyMap(item.opByUnit, s.name);
              const packSpec =
                getItemPackagingSpec(s.name)?.specText ||
                'Sesuai satuan dasar ESB';

              return (
                <article
                  key={s.name}
                  id={`keperluan-item-${encodeURIComponent(s.name)}`}
                  className="bg-white dark:bg-[#102344] border border-[#EBC7E9] dark:border-[#203F70] rounded-2xl overflow-hidden shadow-xs transition-all"
                >
                  <div className="p-3.5 sm:p-4">
                    {/* Top Row: Always Visible (Nama Barang, Kode, Bagian, Frekuensi, Status & Nilai Selisih) */}
                    <div
                      className={`flex justify-between items-start gap-2.5 ${
                        isExpanded ? 'mb-3' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-[#FDF2FA] dark:bg-[#17315B] border border-[#EBC7E9] dark:border-[#294B82] text-[#C61196] dark:text-amber-300 font-mono text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-[15px] font-bold text-[#391042] dark:text-[#F4F7FF] leading-snug break-words">
                            {s.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-[11px] text-[#7D4E85] dark:text-[#A8B9D3] mt-0.5">
                            {s.code && (
                              <span className="font-mono font-semibold text-[#C61196] dark:text-amber-300">
                                Kode: {s.code}
                              </span>
                            )}
                            <span>
                              Bagian: <strong>{s.category}</strong>
                              {s.subcategory && s.subcategory !== s.category
                                ? ` / ${s.subcategory}`
                                : ''}
                            </span>
                            <span>
                              · Frekuensi:{' '}
                              <strong className="text-rose-600 dark:text-rose-400">
                                {s.negDays}hr minus
                              </strong>
                              ,{' '}
                              <strong className="text-emerald-600 dark:text-emerald-400">
                                {s.posDays}hr lebih
                              </strong>
                              , {s.pasDays}hr pas
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 tabular-nums">
                        <div className="flex items-center justify-end space-x-1.5">
                          <span
                            className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full leading-none tracking-wide ${
                              state === 'neg'
                                ? 'bg-rose-500 text-white'
                                : state === 'pos'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-[#F3E2F1] dark:bg-[#17315B] text-[#5B2163] dark:text-[#A8B9D3]'
                            }`}
                          >
                            {state === 'neg'
                              ? 'MINUS'
                              : state === 'pos'
                              ? 'LEBIH'
                              : 'PAS'}
                          </span>
                          <span
                            className={`text-xs sm:text-sm font-bold ${
                              state === 'neg'
                                ? 'text-rose-600 dark:text-[#FF5B62]'
                                : state === 'pos'
                                ? 'text-emerald-600 dark:text-[#16D6A0]'
                                : 'text-[#6E4877] dark:text-[#A8B9D3]'
                            }`}
                          >
                            {cleanQtyLabel}
                          </span>
                        </div>
                        <div
                          className={`text-[11px] sm:text-xs font-semibold mt-0.5 tracking-tight font-mono ${
                            state === 'neg'
                              ? 'text-rose-600 dark:text-[#FF5B62]'
                              : state === 'pos'
                              ? 'text-emerald-600 dark:text-[#16D6A0]'
                              : 'text-[#6E4877] dark:text-[#A8B9D3]'
                          }`}
                        >
                          {state === 'neg'
                            ? `- ${formatRupiah(displayVal)}`
                            : state === 'pos'
                            ? `+ ${formatRupiah(displayVal)}`
                            : 'Rp 0'}
                        </div>
                      </div>
                    </div>

                    {/* EXPANDED DETAILS: Only appears when Lihat Detail is clicked */}
                    {isExpanded && (
                      <div className="space-y-3 pt-2.5 border-t border-[#EED7EC] dark:border-[#203F70]/60">
                        {/* Di Sistem ESB vs Hitungan Gudang */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#FAF5FC] dark:bg-[#0c1b35] p-2.5 rounded-xl border border-[#EDD5EC] dark:border-[#203F70]/60 text-xs tabular-nums">
                          <div>
                            <p className="text-[10px] text-[#7D4E85] dark:text-[#A8B9D3]">
                              Di Sistem ESB
                            </p>
                            <p className="font-bold text-[#391042] dark:text-[#F4F7FF] font-mono mt-0.5">
                              {sysLabel}
                            </p>
                          </div>

                          <div className="border-l border-[#EBCEE9] dark:border-[#203F70]/50 pl-2.5">
                            <p className="text-[10px] text-[#7D4E85] dark:text-[#A8B9D3]">
                              Hitungan Gudang
                            </p>
                            <p className="font-bold text-[#391042] dark:text-[#F4F7FF] font-mono mt-0.5">
                              {opLabel}
                            </p>
                          </div>

                          <div className="sm:border-l border-t sm:border-t-0 border-[#EBCEE9] dark:border-[#203F70]/50 pt-2 sm:pt-0 sm:pl-2.5">
                            <p className="text-[10px] text-[#7D4E85] dark:text-[#A8B9D3]">
                              Harga / Unit
                            </p>
                            <p className="font-bold text-[#391042] dark:text-[#F4F7FF] font-mono mt-0.5">
                              {s.lastUnitPrice > 0
                                ? formatRupiah(s.lastUnitPrice, false)
                                : '-'}
                            </p>
                          </div>

                          <div className="border-l border-t sm:border-t-0 border-[#EBCEE9] dark:border-[#203F70]/50 pt-2 sm:pt-0 pl-2.5">
                            <p className="text-[10px] text-[#7D4E85] dark:text-[#A8B9D3]">
                              Hasil Akhir Periode
                            </p>
                            <p
                              className={`font-bold font-mono mt-0.5 ${
                                s.netVal < -0.5
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : s.netVal > 0.5
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-[#391042] dark:text-white'
                              }`}
                            >
                              {s.netVal < -0.5
                                ? `-${formatRupiah(s.netVal)}`
                                : s.netVal > 0.5
                                ? `+${formatRupiah(s.netVal)}`
                                : 'Pas Rp 0'}
                            </p>
                          </div>
                        </div>

                        {/* Kemasan & Tombol Buka di Cek Barang */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-[#FDF7FC] dark:bg-[#17315B]/50 px-3 py-2 rounded-xl border border-[#EED7EC] dark:border-[#203F70]">
                          <div>
                            <span className="text-[10px] text-[#7D4E85] dark:text-[#A8B9D3] mr-1.5">
                              Kemasan / Konversi:
                            </span>
                            <strong className="text-[#391042] dark:text-white">
                              {packSpec}
                            </strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenProductInCekBarang(s.name)}
                            className="inline-flex items-center gap-1 text-xs font-extrabold text-[#C61196] dark:text-amber-300 hover:underline cursor-pointer"
                          >
                            <span>Buka di Cek Barang</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Riwayat Per Tanggal untuk Barang Ini */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#7D4E85] dark:text-[#A8B9D3]">
                            Rincian Per Tanggal ({item.entries.length} hari tercatat):
                          </div>
                          <div className="divide-y divide-[#F3E2F1] dark:divide-[#1B3258] rounded-xl border border-[#EED7EC] dark:border-[#203F70] bg-white dark:bg-[#0B172E] overflow-hidden">
                            {item.entries.map((entry, eIdx) => {
                              const r = entry.meta.row;
                              const unit = r[1];
                              const packNote = formatPackEquivalent(
                                Math.abs(r[4]),
                                unit,
                                r[0]
                              );
                              const rowState =
                                r[4] < -1e-9 || r[6] < -0.5
                                  ? 'neg'
                                  : r[4] > 1e-9 || r[6] > 0.5
                                  ? 'pos'
                                  : 'pas';
                              return (
                                <div
                                  key={`${entry.date}-${eIdx}`}
                                  className="px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                                >
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onOpenDayInHarian(entry.date)
                                        }
                                        className="font-bold text-[#391042] dark:text-white hover:text-[#C61196] dark:hover:text-amber-300 cursor-pointer"
                                      >
                                        {formatDateId(entry.date)}
                                      </button>
                                      {r[10] && (
                                        <span className="text-[10px] font-mono text-[#7D4E85] dark:text-[#A8B9D3]">
                                          No. {r[10]}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] font-mono text-[#6E4877] dark:text-[#A8B9D3] tabular-nums">
                                      Di Sistem ESB: {formatQty(r[2])} {unit} ·
                                      Hitungan Gudang: {formatQty(r[3])} {unit}
                                    </div>
                                  </div>

                                  <div className="sm:text-right font-mono tabular-nums">
                                    <div
                                      className={`font-bold ${
                                        rowState === 'neg'
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : rowState === 'pos'
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-[#6E4877] dark:text-[#A8B9D3]'
                                      }`}
                                    >
                                      {rowState === 'neg'
                                        ? `Kurang ${formatQty(Math.abs(r[4]))} ${unit}`
                                        : rowState === 'pos'
                                        ? `Lebih ${formatQty(Math.abs(r[4]))} ${unit}`
                                        : 'Pas (0)'}
                                      {packNote ? ` (${packNote})` : ''}
                                    </div>
                                    <div
                                      className={`text-[11px] font-bold ${
                                        rowState === 'neg'
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : rowState === 'pos'
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-[#6E4877] dark:text-[#A8B9D3]'
                                      }`}
                                    >
                                      {rowState === 'neg'
                                        ? `- ${formatRupiah(r[6])}`
                                        : rowState === 'pos'
                                        ? `+ ${formatRupiah(r[6])}`
                                        : 'Rp 0'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Toggle Detail Button */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedItems((prev) => ({
                        ...prev,
                        [s.name]: !prev[s.name],
                      }))
                    }
                    className="w-full py-2 bg-[#FAF5FC] hover:bg-[#F5E8F8] dark:bg-[#17315B]/40 dark:hover:bg-[#17315B]/80 text-[11px] font-bold text-[#7D4E85] dark:text-[#A8B9D3] flex items-center justify-center space-x-1 border-t border-[#EED7EC] dark:border-[#203F70]/60 transition-colors cursor-pointer"
                  >
                    <span>{isExpanded ? 'Tutup Detail' : 'Lihat Detail'}</span>
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M19 9l-7 7-7-7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
