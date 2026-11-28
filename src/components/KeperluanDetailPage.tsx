// @ts-nocheck -- imported legacy code written for a looser tsconfig
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  ExternalLink,
  LayoutGrid,
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
  formatCompactRupiah,
  formatDateFullId,
  formatDateId,
  formatDateRangeLabel,
  formatMonthId,
  formatPackEquivalent,
  formatQty,
  formatQtyMap,
  formatRupiah,
  getItemPackagingSpec,
} from '../lib/stockOpname';

export type KeperluanGroupId = 'food' | 'packaging' | 'beverage' | 'operational';

export interface KeperluanGroupDefinition {
  id: KeperluanGroupId;
  title: string;
  shortLabel: string;
  description: string;
  indicationNeg: string;
  indicationPos: string;
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
    barColor: '#D65106',
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
    barColor: '#95C747',
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
    barColor: '#928573',
    badgeClass:
      'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30',
  },
  {
    id: 'operational',
    title: 'Perlengkapan & Operasional',
    shortLabel: 'Operasional',
    description:
      'Tisu, sabun cuci, cairan pembersih (chemical), sanitizer, gas LPG, ATK, dan perlengkapan operasional harian.',
    indicationNeg: 'Pemakaian kebersihan harian / selisih pencatatan',
    indicationPos: 'Stok gudang operasional belum diinput pemakaian',
    barColor: '#D65106',
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
  mode,
  onChangeMode,
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
  mode: 'neg' | 'pos';
  onChangeMode: (next: 'neg' | 'pos') => void;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [bagianFilter, setBagianFilter] = useState('ALL');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {}
  );

  // Reset search & filters when switching keperluan or mode
  useEffect(() => {
    setSearchQuery('');
    setBagianFilter('ALL');
    setExpandedItems({});
  }, [activeKeperluanId, mode]);

  const activeGroupDef =
    KEPERLUAN_GROUP_LIST.find((g) => g.id === activeKeperluanId) ??
    KEPERLUAN_GROUP_LIST[0];

  // Compute exact counts & values for all 4 Keperluan buckets (matching Beranda 100%)
  const allBucketsSummary = useMemo(() => {
    const map: Record<
      KeperluanGroupId,
      {
        negVal: number;
        posVal: number;
        netVal: number;
        negItemCount: number;
        posItemCount: number;
        totalCount: number;
      }
    > = {
      food: {
        negVal: 0,
        posVal: 0,
        netVal: 0,
        negItemCount: 0,
        posItemCount: 0,
        totalCount: 0,
      },
      packaging: {
        negVal: 0,
        posVal: 0,
        netVal: 0,
        negItemCount: 0,
        posItemCount: 0,
        totalCount: 0,
      },
      beverage: {
        negVal: 0,
        posVal: 0,
        netVal: 0,
        negItemCount: 0,
        posItemCount: 0,
        totalCount: 0,
      },
      operational: {
        negVal: 0,
        posVal: 0,
        netVal: 0,
        negItemCount: 0,
        posItemCount: 0,
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
      if (prod.negVal < -0.5) b.negItemCount++;
      if (prod.posVal > 0.5) b.posItemCount++;
    }
    return map;
  }, [summary]);

  // Enrich all products belonging to the selected Keperluan
  const { productsInGroup, groupNegVal, groupPosVal } = useMemo(() => {
    const enrichedMap: Record<string, EnrichedKeperluanProduct> = {};
    let gNeg = 0;
    let gPos = 0;

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
    }

    for (const date of summary.activeDates) {
      const rows = data[date] ?? [];
      for (const rawRow of rows) {
        const meta = convertRowWithMeta(rawRow);
        const item = enrichedMap[meta.row[0]];
        if (!item) continue;

        const unit = meta.row[1] || 'Unit';
        item.sysByUnit[unit] = (item.sysByUnit[unit] ?? 0) + meta.row[2];
        item.opByUnit[unit] = (item.opByUnit[unit] ?? 0) + meta.row[3];
        item.entries.push({ date, meta });
      }
    }

    return {
      productsInGroup: Object.values(enrichedMap),
      groupNegVal: gNeg,
      groupPosVal: gPos,
    };
  }, [summary, data, activeKeperluanId]);

  // Exact Minus list (prod.negVal < -0.5) and Lebih list (prod.posVal > 0.5) matching Beranda counts (e.g. 47 barang Minus, 41 barang Lebih)
  const minusProducts = useMemo(
    () =>
      productsInGroup
        .filter((p) => p.stat.negVal < -0.5)
        .sort((a, b) => a.stat.negVal - b.stat.negVal),
    [productsInGroup]
  );

  const plusProducts = useMemo(
    () =>
      productsInGroup
        .filter((p) => p.stat.posVal > 0.5)
        .sort((a, b) => b.stat.posVal - a.stat.posVal),
    [productsInGroup]
  );

  // Active list based on whether the user is in Minus ('neg') or Lebih ('pos') mode
  const activeModeList = mode === 'neg' ? minusProducts : plusProducts;
  const activeModeTotalVal = mode === 'neg' ? groupNegVal : groupPosVal;

  // Bagian breakdown within the active mode list (e.g. within the 47 Minus items or 41 Lebih items)
  const availableBagianList = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of activeModeList) {
      const cat = item.stat.category || 'Lainnya';
      map[cat] = (map[cat] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([bagian, count]) => ({ bagian, count }))
      .sort((a, b) => b.count - a.count);
  }, [activeModeList]);

  // Filtered products by search & bagian
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeModeList.filter((item) => {
      const s = item.stat;
      if (bagianFilter !== 'ALL' && s.category !== bagianFilter) {
        return false;
      }
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.subcategory.toLowerCase().includes(q)
      );
    });
  }, [activeModeList, searchQuery, bagianFilter]);

  const periodLabel =
    viewScope === 'month'
      ? formatMonthId(activeMonth)
      : viewScope === 'range'
      ? formatDateRangeLabel(summary.rangeStart, summary.rangeEnd)
      : formatDateId(activeDay);

  return (
    <div className="space-y-4">
      {/* TOP BAR: TOMBOL KEMBALI KE BERANDA + PILIHAN 4 KEPERLUAN */}
      <section className="rounded-3xl bg-white dark:bg-[#18130F] border border-[#F8C8B6] dark:border-[#3E3731] p-3.5 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToBeranda}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#F9F5F0] hover:bg-[#FEE7DE] dark:bg-[#26201B] dark:hover:bg-[#342D27] border border-[#F8C8B6] dark:border-[#48413B] text-xs sm:text-sm font-extrabold text-[#A33D05] dark:text-amber-300 transition-all cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Kembali ke Beranda</span>
          </button>

          {/* Period & Scope Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#814730] dark:text-[#BEB6AC] mr-1">
              Periode:{' '}
              <strong className="text-[#451300] dark:text-white">
                {periodLabel}
              </strong>{' '}
              ({summary.activeDates.length} hari)
            </span>

            <div className="inline-flex items-center rounded-full border border-[#F8C8B6] dark:border-[#3E3731] bg-[#FBF6F1] dark:bg-[#17120E] p-0.5">
              <button
                type="button"
                onClick={() => {
                  onChangeViewScope('range');
                  onOpenRangePicker();
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                  viewScope === 'range'
                    ? 'wizzmie-pink-pill text-white'
                    : 'text-[#451300] dark:text-slate-300 hover:text-[#BE490C]'
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
                    : 'text-[#451300] dark:text-slate-300 hover:text-[#BE490C]'
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
                className="px-2.5 py-1 text-xs font-bold rounded-full border border-[#F8C8B6] dark:border-[#37302A] bg-white dark:bg-[#241D18] text-[#451300] dark:text-slate-200 cursor-pointer"
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

        {/* 4 Keperluan Quick Switcher Tabs (Shows exact item count for active Minus / Lebih mode) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-[#ECE7E2] dark:border-[#322B25]">
          {KEPERLUAN_GROUP_LIST.map((g) => {
            const isSelected = g.id === activeKeperluanId;
            const bStat = allBucketsSummary[g.id];
            const modeCount =
              mode === 'neg' ? bStat.negItemCount : bStat.posItemCount;
            const modeVal = mode === 'neg' ? bStat.negVal : bStat.posVal;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelectKeperluanId(g.id)}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-br from-[#F9F5F0] to-[#FEE6DD] dark:from-[#2E2722] dark:to-[#241D18] border-[#D65106] dark:border-amber-400 shadow-xs'
                    : 'bg-[#FBF6F1]/70 hover:bg-[#F9F5F0] dark:bg-[#1E1813] dark:hover:bg-[#27201B] border-[#F8C8B6] dark:border-[#362F29]'
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
                          ? 'text-[#BE490C] dark:text-amber-300'
                          : 'text-[#451300] dark:text-slate-200'
                      }`}
                    >
                      {g.title}
                    </span>
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] font-mono font-bold tabular-nums">
                  <span
                    className={
                      mode === 'neg'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }
                  >
                    {mode === 'neg'
                      ? `-${formatCompactRupiah(modeVal)}`
                      : `+${formatCompactRupiah(modeVal)}`}
                  </span>
                  <span className="text-[#814730] dark:text-[#BEB6AC]">
                    {modeCount} barang
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* MAIN LIST SECTION: LANGSUNG MENAMPILKAN DAFTAR BARANG SESUAI TAB MINUS / LEBIH */}
      <section className="surface-3d rounded-3xl p-4 sm:p-6 border border-[#F8C8B6] dark:border-[#3E3731] space-y-4">
        {/* Header: Title, Exact Item Count (e.g. 47 Barang Minus / 41 Barang Lebih), Total Rupiah, & Minus/Lebih Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-3.5 border-b border-[#F9D9CD] dark:border-[#362F29]">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: activeGroupDef.barColor }}
              />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#BE490C] dark:text-[#ACE25B]">
                RINCIAN PER KEPERLUAN ·{' '}
                {mode === 'neg' ? 'DAFTAR BARANG MINUS' : 'DAFTAR BARANG LEBIH'}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-lg sm:text-2xl font-extrabold text-[#451300] dark:text-white">
                {activeGroupDef.title}
              </h1>
              <span
                className={`px-3 py-0.5 rounded-full text-xs sm:text-sm font-extrabold font-mono tabular-nums ${
                  mode === 'neg'
                    ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/35'
                    : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/35'
                }`}
              >
                {activeModeList.length} Barang{' '}
                {mode === 'neg' ? 'Minus' : 'Lebih'} (
                {mode === 'neg'
                  ? `-${formatRupiah(activeModeTotalVal)}`
                  : `+${formatRupiah(activeModeTotalVal)}`}
                )
              </span>
            </div>

            <p className="text-xs text-[#924D32] dark:text-[#BEB6AC]">
              Indikasi utama:{' '}
              <strong className="text-[#451300] dark:text-slate-200">
                {mode === 'neg'
                  ? activeGroupDef.indicationNeg
                  : activeGroupDef.indicationPos}
              </strong>
              . Klik <strong>Lihat Detail</strong> pada barang untuk memunculkan{' '}
              <strong>Di Sistem ESB</strong> dan <strong>Hitungan Gudang</strong>.
            </p>
          </div>

          {/* Toggle Minus vs Lebih (Shows exact count for each tab, e.g. Minus (47) | Lebih (41)) */}
          <div className="inline-flex items-center rounded-full border border-[#F8C8B6] dark:border-[#3E3731] bg-white dark:bg-[#17120E] p-1 shrink-0 self-start lg:self-center shadow-2xs">
            <button
              type="button"
              onClick={() => onChangeMode('neg')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                mode === 'neg'
                  ? 'wizzmie-pink-pill text-white'
                  : 'text-[#814730] dark:text-slate-300 hover:text-[#BE490C]'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Minus ({minusProducts.length} Barang)</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('pos')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                mode === 'pos'
                  ? 'wizzmie-pink-pill text-white'
                  : 'text-[#814730] dark:text-slate-300 hover:text-[#BE490C]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Lebih ({plusProducts.length} Barang)</span>
            </button>
          </div>
        </div>

        {/* Search & Bagian Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-[#924D32] dark:text-[#FE8F63] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari dari ${activeModeList.length} barang ${
                mode === 'neg' ? 'minus' : 'lebih'
              } di ${activeGroupDef.shortLabel}...`}
              className="w-full pl-11 pr-10 py-2.5 text-xs sm:text-sm rounded-full border border-[#F8C8B6] dark:border-[#3E3731] bg-white dark:bg-[#17120E] text-[#451300] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D65106]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="w-6 h-6 rounded-full bg-[#F8D4C6] dark:bg-[#322B26] text-[#521900] dark:text-slate-200 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="sm:col-span-4 relative">
            <LayoutGrid className="w-4 h-4 text-[#732700] dark:text-[#FC753A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              aria-label="Filter bagian"
              value={bagianFilter}
              onChange={(e) => setBagianFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 text-xs sm:text-sm font-bold rounded-full border border-[#F8C8B6] dark:border-[#3E3731] bg-white dark:bg-[#17120E] text-[#451300] dark:text-slate-100 cursor-pointer"
            >
              <option value="ALL">
                Semua Bagian ({activeModeList.length} barang)
              </option>
              {availableBagianList.map((b) => (
                <option key={b.bagian} value={b.bagian}>
                  {b.bagian} ({b.count} barang)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sub-count info when searching or filtering by Bagian */}
        {(searchQuery.trim() !== '' || bagianFilter !== 'ALL') && (
          <div className="flex items-center justify-between text-xs text-[#924D32] dark:text-[#BEB6AC] px-1">
            <span>
              Menampilkan <strong>{filteredProducts.length}</strong> dari{' '}
              <strong>{activeModeList.length}</strong> barang{' '}
              {mode === 'neg' ? 'minus' : 'lebih'}
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setBagianFilter('ALL');
              }}
              className="font-bold text-[#BE490C] dark:text-amber-300 hover:underline cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        )}

        {/* List of All Products in This Mode (e.g. 47 Minus items or 41 Lebih items) */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#18130F] border border-[#F8C8B6] dark:border-[#3E3731] p-8 text-center text-sm text-[#924D32] dark:text-[#BEB6AC]">
            Tidak ada barang {mode === 'neg' ? 'minus' : 'lebih'} yang cocok
            dengan filter ini pada <strong>{activeGroupDef.title}</strong>.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredProducts.map((item, idx) => {
              const s = item.stat;
              const isExpanded = !!expandedItems[s.name];
              const displayVal = mode === 'neg' ? s.negVal : s.posVal;
              const displayQtyMap =
                mode === 'neg' ? s.negQtyByUnit : s.posQtyByUnit;

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
                  className="bg-white dark:bg-[#241E19] border border-[#F8C8B6] dark:border-[#3E3731] rounded-2xl overflow-hidden shadow-xs transition-all"
                >
                  <div className="p-3.5 sm:p-4">
                    {/* Top Row: Always Visible (Nomor, Nama Barang, Kode, Bagian, Frekuensi, Status & Nilai Selisih) */}
                    <div
                      className={`flex justify-between items-start gap-2.5 ${
                        isExpanded ? 'mb-3' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-[#F9F5F0] dark:bg-[#312A25] border border-[#F8C8B6] dark:border-[#49423C] text-[#BE490C] dark:text-amber-300 font-mono text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-[15px] font-bold text-[#451300] dark:text-[#FBF6F1] leading-snug break-words">
                            {s.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-[11px] text-[#924D32] dark:text-[#BEB6AC] mt-0.5">
                            {s.code && (
                              <span className="font-mono font-semibold text-[#BE490C] dark:text-amber-300">
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
                              ·{' '}
                              {mode === 'neg' ? (
                                <strong className="text-rose-600 dark:text-rose-400">
                                  {s.negDays} hari minus
                                </strong>
                              ) : (
                                <strong className="text-emerald-600 dark:text-emerald-400">
                                  {s.posDays} hari lebih
                                </strong>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 tabular-nums">
                        <div className="flex items-center justify-end space-x-1.5">
                          <span
                            className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full leading-none tracking-wide ${
                              mode === 'neg'
                                ? 'bg-rose-500 text-white'
                                : 'bg-emerald-500 text-white'
                            }`}
                          >
                            {mode === 'neg' ? 'MINUS' : 'LEBIH'}
                          </span>
                          <span
                            className={`text-xs sm:text-sm font-bold ${
                              mode === 'neg'
                                ? 'text-rose-600 dark:text-[#FF5B62]'
                                : 'text-emerald-600 dark:text-[#16D6A0]'
                            }`}
                          >
                            {cleanQtyLabel}
                          </span>
                        </div>
                        <div
                          className={`text-[11px] sm:text-xs font-semibold mt-0.5 tracking-tight font-mono ${
                            mode === 'neg'
                              ? 'text-rose-600 dark:text-[#FF5B62]'
                              : 'text-emerald-600 dark:text-[#16D6A0]'
                          }`}
                        >
                          {mode === 'neg'
                            ? `- ${formatRupiah(displayVal)}`
                            : `+ ${formatRupiah(displayVal)}`}
                        </div>
                      </div>
                    </div>

                    {/* EXPANDED DETAILS: Only appears when Lihat Detail is clicked */}
                    {isExpanded && (
                      <div className="space-y-3 pt-2.5 border-t border-[#F6D8CC] dark:border-[#3E3731]/60">
                        {/* Di Sistem ESB vs Hitungan Gudang (Hidden by default until Lihat Detail is clicked) */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#FBF6F1] dark:bg-[#1C1611] p-2.5 rounded-xl border border-[#F6D6C9] dark:border-[#3E3731]/60 text-xs tabular-nums">
                          <div>
                            <p className="text-[10px] text-[#924D32] dark:text-[#BEB6AC]">
                              Di Sistem ESB
                            </p>
                            <p className="font-bold text-[#451300] dark:text-[#FBF6F1] font-mono mt-0.5">
                              {sysLabel}
                            </p>
                          </div>

                          <div className="border-l border-[#F6CFC0] dark:border-[#3E3731]/50 pl-2.5">
                            <p className="text-[10px] text-[#924D32] dark:text-[#BEB6AC]">
                              Hitungan Gudang
                            </p>
                            <p className="font-bold text-[#451300] dark:text-[#FBF6F1] font-mono mt-0.5">
                              {opLabel}
                            </p>
                          </div>

                          <div className="sm:border-l border-t sm:border-t-0 border-[#F6CFC0] dark:border-[#3E3731]/50 pt-2 sm:pt-0 sm:pl-2.5">
                            <p className="text-[10px] text-[#924D32] dark:text-[#BEB6AC]">
                              Harga / Unit
                            </p>
                            <p className="font-bold text-[#451300] dark:text-[#FBF6F1] font-mono mt-0.5">
                              {s.lastUnitPrice > 0
                                ? formatRupiah(s.lastUnitPrice, false)
                                : '-'}
                            </p>
                          </div>

                          <div className="border-l border-t sm:border-t-0 border-[#F6CFC0] dark:border-[#3E3731]/50 pt-2 sm:pt-0 pl-2.5">
                            <p className="text-[10px] text-[#924D32] dark:text-[#BEB6AC]">
                              Hasil Akhir Periode
                            </p>
                            <p
                              className={`font-bold font-mono mt-0.5 ${
                                s.netVal < -0.5
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : s.netVal > 0.5
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-[#451300] dark:text-white'
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
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-[#FDF8F3] dark:bg-[#312A25]/50 px-3 py-2 rounded-xl border border-[#F6D8CC] dark:border-[#3E3731]">
                          <div>
                            <span className="text-[10px] text-[#924D32] dark:text-[#BEB6AC] mr-1.5">
                              Kemasan / Konversi:
                            </span>
                            <strong className="text-[#451300] dark:text-white">
                              {packSpec}
                            </strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenProductInCekBarang(s.name)}
                            className="inline-flex items-center gap-1 text-xs font-extrabold text-[#BE490C] dark:text-amber-300 hover:underline cursor-pointer"
                          >
                            <span>Buka di Cek Barang</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Riwayat Per Tanggal untuk Barang Ini */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#924D32] dark:text-[#BEB6AC]">
                            Rincian Per Tanggal ({item.entries.length} hari tercatat):
                          </div>
                          <div className="divide-y divide-[#ECE7E2] dark:divide-[#322B25] rounded-xl border border-[#F6D8CC] dark:border-[#3E3731] bg-white dark:bg-[#18130F] overflow-hidden">
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
                                        className="font-bold text-[#451300] dark:text-white hover:text-[#BE490C] dark:hover:text-amber-300 cursor-pointer"
                                      >
                                        {formatDateId(entry.date)}
                                      </button>
                                      {r[10] && (
                                        <span className="text-[10px] font-mono text-[#924D32] dark:text-[#BEB6AC]">
                                          No. {r[10]}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] font-mono text-[#814730] dark:text-[#BEB6AC] tabular-nums">
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
                                          : 'text-[#814730] dark:text-[#BEB6AC]'
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
                                          : 'text-[#814730] dark:text-[#BEB6AC]'
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
                    className="w-full py-2 bg-[#FBF6F1] hover:bg-[#F1ECE7] dark:bg-[#312A25]/40 dark:hover:bg-[#312A25]/80 text-[11px] font-bold text-[#924D32] dark:text-[#BEB6AC] flex items-center justify-center space-x-1 border-t border-[#F6D8CC] dark:border-[#3E3731]/60 transition-colors cursor-pointer"
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
