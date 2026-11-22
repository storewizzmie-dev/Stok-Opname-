import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calculator,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Coins,
  ExternalLink,
  Info,
  Package,
  Scale,
  Search,
  Trophy,
  X,
} from 'lucide-react';
import {
  ConvertedStockRow,
  ProductStat,
  StockDataset,
  ViewScope,
  computeSummary,
  convertRowWithMeta,
  formatDateId,
  formatDateRangeLabel,
  formatMonthId,
  formatPackEquivalent,
  formatQty,
  formatQtyMap,
  formatRupiah,
  formatSignedQty,
} from '../lib/stockOpname';

export type BerandaModalType = 'neg' | 'pos' | 'net' | null;

type SummaryResult = ReturnType<typeof computeSummary>;

interface EnrichedProductItem {
  stat: ProductStat;
  sysByUnit: Record<string, number>;
  opByUnit: Record<string, number>;
  entries: { date: string; meta: ConvertedStockRow }[];
}

export function BerandaDetailModal({
  modalType,
  onChangeModalType,
  onClose,
  onOpenProductInCekBarang,
  onOpenDayInHarian,
  summary,
  data,
  activeMonth,
  activeDay,
  viewScope,
}: {
  modalType: BerandaModalType;
  onChangeModalType: (next: BerandaModalType) => void;
  onClose: () => void;
  onOpenProductInCekBarang: (productName: string) => void;
  onOpenDayInHarian: (date: string) => void;
  summary: SummaryResult | null;
  data: StockDataset;
  activeMonth: string;
  activeDay: string;
  viewScope: ViewScope;
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [listScope, setListScope] = useState<'net' | 'allEvents'>('net');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showDateTable, setShowDateTable] = useState(false);

  useEffect(() => {
    if (!modalType) return;
    setSearch('');
    setCategoryFilter('ALL');
    setListScope('net');
    setExpandedProduct(null);
    setShowDateTable(false);
  }, [modalType]);

  useEffect(() => {
    if (!modalType) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalType, onClose]);

  const enrichedMap = useMemo(() => {
    const map: Record<string, EnrichedProductItem> = {};
    if (!summary) return map;

    for (const [name, stat] of Object.entries(summary.productMap)) {
      map[name] = {
        stat,
        sysByUnit: {},
        opByUnit: {},
        entries: [],
      };
    }

    for (const date of summary.activeDates) {
      const rows = data[date] ?? [];
      for (const rawRow of rows) {
        const meta = convertRowWithMeta(rawRow);
        const item = map[meta.row[0]];
        if (!item) continue;
        const unit = meta.row[1] || 'Unit';
        item.sysByUnit[unit] = (item.sysByUnit[unit] ?? 0) + meta.row[2];
        item.opByUnit[unit] = (item.opByUnit[unit] ?? 0) + meta.row[3];
        item.entries.push({ date, meta });
      }
    }

    return map;
  }, [summary, data]);

  const countsAndSample = useMemo(() => {
    if (!summary) {
      return {
        negRowCount: 0,
        posRowCount: 0,
        pasRowCount: 0,
        sample: null as {
          date: string;
          product: string;
          unit: string;
          sys: number;
          op: number;
          diffQty: number;
          valUnit: number;
          diffVal: number;
        } | null,
      };
    }

    let negRowCount = 0;
    let posRowCount = 0;
    let pasRowCount = 0;
    let bestSample: {
      date: string;
      product: string;
      unit: string;
      sys: number;
      op: number;
      diffQty: number;
      valUnit: number;
      diffVal: number;
    } | null = null;

    for (const date of summary.activeDates) {
      for (const rawRow of data[date] ?? []) {
        const meta = convertRowWithMeta(rawRow);
        const r = meta.row;
        if (r[6] < 0) negRowCount++;
        else if (r[6] > 0) posRowCount++;
        else pasRowCount++;

        if (
          Math.abs(r[6]) > 0.5 &&
          Math.abs(r[4]) > 1e-9 &&
          r[5] > 0 &&
          (!bestSample || Math.abs(r[6]) > Math.abs(bestSample.diffVal))
        ) {
          bestSample = {
            date,
            product: r[0],
            unit: r[1],
            sys: r[2],
            op: r[3],
            diffQty: r[4],
            valUnit: r[5],
            diffVal: r[6],
          };
        }
      }
    }

    return { negRowCount, posRowCount, pasRowCount, sample: bestSample };
  }, [summary, data]);

  const { netList, everList } = useMemo(() => {
    if (!summary || (modalType !== 'neg' && modalType !== 'pos')) {
      return {
        netList: [] as EnrichedProductItem[],
        everList: [] as EnrichedProductItem[],
      };
    }
    const items = Object.values(enrichedMap);
    if (modalType === 'neg') {
      const net = items
        .filter((item) => item.stat.netVal < -0.5)
        .sort((a, b) => a.stat.netVal - b.stat.netVal);
      const ever = items
        .filter((item) => item.stat.negVal < -0.5)
        .sort((a, b) => a.stat.negVal - b.stat.negVal);
      return { netList: net, everList: ever };
    }
    const net = items
      .filter((item) => item.stat.netVal > 0.5)
      .sort((a, b) => b.stat.netVal - a.stat.netVal);
    const ever = items
      .filter((item) => item.stat.posVal > 0.5)
      .sort((a, b) => b.stat.posVal - a.stat.posVal);
    return { netList: net, everList: ever };
  }, [summary, enrichedMap, modalType]);

  const activeBaseList = listScope === 'allEvents' ? everList : netList;

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of activeBaseList) {
      if (item.stat.category) cats.add(item.stat.category);
    }
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'id'));
  }, [activeBaseList]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeBaseList.filter((item) => {
      const s = item.stat;
      if (categoryFilter !== 'ALL' && s.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.subcategory.toLowerCase().includes(q) ||
        s.purposes.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [activeBaseList, search, categoryFilter]);

  const activeDailyRows = useMemo(() => {
    if (!summary) return [];
    const activeSet = new Set(summary.activeDates);
    return summary.dailyStats.filter((d) => activeSet.has(d.date));
  }, [summary]);

  if (!modalType || !summary) return null;

  const periodLabel =
    viewScope === 'month'
      ? `Rekap ${formatMonthId(activeMonth)} (${summary.activeDates.length} hari)`
      : viewScope === 'range'
      ? `Rentang ${formatDateRangeLabel(summary.rangeStart, summary.rangeEnd)} (${summary.activeDates.length} hari)`
      : `Tanggal ${formatDateId(activeDay)}`;

  const absNeg = Math.abs(summary.totalNeg);
  const absPos = Math.abs(summary.totalPos);
  const isNetMinus = summary.netTotal < -0.5;
  const isNetPlus = summary.netTotal > 0.5;

  const filteredSum = filteredList.reduce((acc, item) => {
    if (listScope === 'allEvents') {
      return acc + (modalType === 'neg' ? item.stat.negVal : item.stat.posVal);
    }
    return acc + item.stat.netVal;
  }, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="beranda-detail-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-3xl bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-[#1E355D] rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-[#1E355D] bg-slate-50/80 dark:bg-[#081226] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {modalType === 'neg' ? (
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/35 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <ArrowDown className="w-5 h-5 stroke-[2.5]" />
              </div>
            ) : modalType === 'pos' ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/35 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ArrowUp className="w-5 h-5 stroke-[2.5]" />
              </div>
            ) : (
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                  isNetMinus
                    ? 'bg-rose-100 dark:bg-rose-500/20 border-rose-200 dark:border-rose-500/35 text-rose-600 dark:text-rose-400'
                    : 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/35 text-amber-700 dark:text-amber-300'
                }`}
              >
                {isNetMinus ? (
                  <Scale className="w-5 h-5" />
                ) : (
                  <Trophy className="w-5 h-5" />
                )}
              </div>
            )}

            <div className="min-w-0">
              <h2
                id="beranda-detail-modal-title"
                className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate"
              >
                {modalType === 'neg'
                  ? 'Daftar Barang Kekurangan Stok'
                  : modalType === 'pos'
                  ? 'Daftar Barang Kelebihan Stok'
                  : viewScope === 'month'
                  ? 'Rincian Rumus Hasil Gabungan Bulan Ini'
                  : viewScope === 'range'
                  ? 'Rincian Rumus Hasil Gabungan Periode Dipilih'
                  : 'Rincian Rumus Hasil Selisih Akhir'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {periodLabel}
                {summary.locationName || summary.branchName
                  ? ` · ${summary.locationName || summary.branchName}`
                  : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup rincian"
            className="btn-3d-soft p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-sm">
          {/* MODAL TYPE 1 & 2: KEKURANGAN STOK / KELEBIHAN STOK */}
          {(modalType === 'neg' || modalType === 'pos') && (
            <>
              {/* Top Summary Banner */}
              <div
                className={`rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  modalType === 'neg'
                    ? 'bg-rose-50/90 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900/50'
                    : 'bg-emerald-50/90 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-900/50'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {modalType === 'neg'
                      ? 'Total Nilai Kekurangan Stok'
                      : 'Total Nilai Kelebihan Stok'}
                  </div>
                  <div
                    className={`text-xl sm:text-2xl font-black font-mono tabular-nums ${
                      modalType === 'neg'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {modalType === 'neg' ? '-' : '+'}{' '}
                    {formatRupiah(
                      modalType === 'neg' ? summary.totalNeg : summary.totalPos
                    )}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {modalType === 'neg'
                      ? `${netList.length} barang hasil akhirnya kurang (Hitungan Gudang < Sistem ESB)`
                      : `${netList.length} barang hasil akhirnya lebih (Hitungan Gudang > Sistem ESB)`}
                  </div>
                </div>

                {everList.length > netList.length && (
                  <div className="flex rounded-xl p-1 bg-white/80 dark:bg-[#081226] border border-slate-200 dark:border-[#1E355D] shrink-0 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => setListScope('net')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        listScope === 'net'
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Hasil Akhir ({netList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setListScope('allEvents')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        listScope === 'allEvents'
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Semua Kejadian ({everList.length})
                    </button>
                  </div>
                )}
              </div>

              {everList.length > netList.length && listScope === 'net' && (
                <div className="rounded-xl bg-amber-50 dark:bg-[#0F2244] border border-amber-200 dark:border-[#1E355D] px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200">
                  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Ada{' '}
                    <strong>{everList.length - netList.length} barang lain</strong>{' '}
                    yang sempat {modalType === 'neg' ? 'kurang' : 'lebih'} di
                    tanggal tertentu tapi tertutup di tanggal lain. Ketuk{' '}
                    <strong>Semua Kejadian</strong> di atas jika ingin melihat
                    rincian penuh pembentuk total{' '}
                    <strong>
                      {formatRupiah(
                        modalType === 'neg'
                          ? summary.totalNeg
                          : summary.totalPos
                      )}
                    </strong>
                    .
                  </span>
                </div>
              )}

              {/* Search & Bagian Filter */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-7 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama barang, kode, atau keperluan..."
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-[#1F3763] bg-slate-50 dark:bg-[#081226] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[42px]"
                  />
                </div>
                <div className="sm:col-span-5">
                  <select
                    aria-label="Filter bagian"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-[#1F3763] bg-slate-50 dark:bg-[#081226] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[42px] cursor-pointer"
                  >
                    <option value="ALL">
                      Semua Bagian ({activeBaseList.length} barang)
                    </option>
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        Bagian: {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Item List */}
              {filteredList.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-[#1E355D] p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  {activeBaseList.length === 0
                    ? modalType === 'neg'
                      ? 'Bagus! Tidak ada barang yang kekurangan stok pada periode ini.'
                      : 'Tidak ada barang yang kelebihan stok pada periode ini.'
                    : 'Tidak ada barang yang cocok dengan pencarian Anda.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredList.map((item, idx) => {
                    const s = item.stat;
                    const isNegMode = modalType === 'neg';
                    const isExpanded = expandedProduct === s.name;
                    const displayRupiah =
                      listScope === 'allEvents'
                        ? isNegMode
                          ? s.negVal
                          : s.posVal
                        : s.netVal;
                    const displayQty =
                      listScope === 'allEvents'
                        ? formatQtyMap(
                            isNegMode ? s.negQtyByUnit : s.posQtyByUnit,
                            s.name,
                            true
                          )
                        : formatQtyMap(s.qtyByUnit, s.name, true);
                    const sysLabel = formatQtyMap(item.sysByUnit, s.name);
                    const opLabel = formatQtyMap(item.opByUnit, s.name);

                    return (
                      <div
                        key={s.name}
                        className="rounded-2xl border border-slate-200 dark:border-[#1E355D] bg-slate-50/70 dark:bg-[#0D1C34] overflow-hidden"
                      >
                        <div className="p-3.5 sm:p-4 space-y-3">
                          {/* Row Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="w-7 h-7 rounded-lg bg-white dark:bg-[#16294C] border border-slate-200 dark:border-[#244379] text-slate-700 dark:text-slate-200 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <div className="min-w-0">
                                <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-white break-words leading-snug">
                                  {s.name}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                                  {s.code && (
                                    <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">
                                      Kode: {s.code}
                                    </span>
                                  )}
                                  <span>
                                    Bagian:{' '}
                                    <strong className="text-slate-700 dark:text-slate-200">
                                      {s.subcategory &&
                                      s.subcategory !== s.category
                                        ? `${s.category} / ${s.subcategory}`
                                        : s.category}
                                    </strong>
                                  </span>
                                  {s.purposes.length > 0 && (
                                    <span>
                                      · Keperluan: {s.purposes.join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0 tabular-nums">
                              <div
                                className={`text-sm sm:text-base font-black font-mono ${
                                  displayRupiah < -0.5
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : displayRupiah > 0.5
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {displayRupiah < -0.5
                                  ? `- ${formatRupiah(displayRupiah)}`
                                  : displayRupiah > 0.5
                                  ? `+ ${formatRupiah(displayRupiah)}`
                                  : 'Pas Rp 0'}
                              </div>
                              {s.lastUnitPrice > 0 && (
                                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                  Harga: {formatRupiah(s.lastUnitPrice)}/satuan
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Detail Metrics Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="rounded-xl bg-white dark:bg-[#081226] border border-slate-200/80 dark:border-[#1A3157] px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                                Di Sistem ESB
                              </div>
                              <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums break-words">
                                {sysLabel}
                              </div>
                            </div>

                            <div className="rounded-xl bg-white dark:bg-[#081226] border border-slate-200/80 dark:border-[#1A3157] px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                                Hitungan Gudang
                              </div>
                              <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums break-words">
                                {opLabel}
                              </div>
                            </div>

                            <div className="rounded-xl bg-white dark:bg-[#081226] border border-slate-200/80 dark:border-[#1A3157] px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                                {listScope === 'allEvents'
                                  ? isNegMode
                                    ? 'Total Kurangnya'
                                    : 'Total Lebihnya'
                                  : 'Selisih Bersih'}
                              </div>
                              <div
                                className={`font-mono font-bold mt-0.5 tabular-nums break-words ${
                                  isNegMode
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {displayQty}
                              </div>
                            </div>

                            <div className="rounded-xl bg-white dark:bg-[#081226] border border-slate-200/80 dark:border-[#1A3157] px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                                Frekuensi Kejadian
                              </div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 tabular-nums">
                                <span className="text-rose-600 dark:text-rose-400">
                                  {s.negDays}hr-
                                </span>
                                {' · '}
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  {s.posDays}hr+
                                </span>
                                {' · '}
                                <span className="text-slate-500 dark:text-slate-400">
                                  {s.pasDays}hr pas
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* When item has both kurang and lebih on different dates, show transparent breakdown */}
                          {s.negVal < -0.5 && s.posVal > 0.5 && (
                            <div className="rounded-xl bg-white/90 dark:bg-[#09162D] border border-slate-200/70 dark:border-[#1A3157] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs font-mono tabular-nums">
                              <span className="text-rose-600 dark:text-rose-400">
                                Total saat kurang: -{formatRupiah(s.negVal)}
                              </span>
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Total saat lebih: +{formatRupiah(s.posVal)}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-amber-300">
                                Hasil Akhir:{' '}
                                {s.netVal < 0 ? '-' : s.netVal > 0 ? '+' : ''}
                                {formatRupiah(s.netVal)}
                              </span>
                            </div>
                          )}

                          {/* Item Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedProduct(isExpanded ? null : s.name)
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#13264A] border border-slate-200 dark:border-[#234176] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-amber-400 transition-colors cursor-pointer"
                            >
                              <CalendarDays className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              <span>
                                Rincian Per Tanggal ({item.entries.length}{' '}
                                catatan)
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenProductInCekBarang(s.name)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/15 transition-colors cursor-pointer"
                            >
                              <span>Buka di Cek Barang</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Per-Date Rows */}
                        {isExpanded && (
                          <div className="border-t border-slate-200 dark:border-[#1E355D] bg-white dark:bg-[#081226] divide-y divide-slate-100 dark:divide-[#15284A]">
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
                                  className="px-3.5 sm:px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                >
                                  <div className="space-y-0.5 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-bold text-slate-900 dark:text-white">
                                        {formatDateId(entry.date)}
                                      </span>
                                      {r[10] && (
                                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                          No. {r[10]}
                                        </span>
                                      )}
                                      {r[15] && (
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                          · {r[15]}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                                      Sistem ESB: {formatQty(r[2])} {unit} ·
                                      Hitungan Gudang: {formatQty(r[3])} {unit}
                                      {r[5] > 0 &&
                                        ` · Harga ${formatRupiah(r[5])}/${unit}`}
                                    </div>
                                    {(r[7] || entry.meta.wasConverted) && (
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {entry.meta.wasConverted &&
                                          `Satuan asli Excel: ${formatSignedQty(
                                            entry.meta.originalDiffQty
                                          )} ${entry.meta.originalUnit}`}
                                        {entry.meta.wasConverted && r[7]
                                          ? ' · '
                                          : ''}
                                        {r[7]}
                                      </div>
                                    )}
                                  </div>

                                  <div className="sm:text-right shrink-0 font-mono tabular-nums">
                                    <div
                                      className={`font-bold ${
                                        rowState === 'neg'
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : rowState === 'pos'
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-slate-500 dark:text-slate-400'
                                      }`}
                                    >
                                      {rowState === 'neg'
                                        ? `Kurang ${formatQty(r[4])} ${unit}`
                                        : rowState === 'pos'
                                        ? `Lebih ${formatQty(r[4])} ${unit}`
                                        : 'Pas (0)'}
                                      {packNote ? ` (${packNote})` : ''}
                                    </div>
                                    <div
                                      className={`text-[11px] font-bold ${
                                        rowState === 'neg'
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : rowState === 'pos'
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-slate-500 dark:text-slate-400'
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
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* MODAL TYPE 3: HASIL GABUNGAN (RUMUS DETAIL & ASAL ANGKA) */}
          {modalType === 'net' && (
            <>
              {/* Plain Indonesian Explanation */}
              <div className="rounded-2xl p-4 bg-amber-50/90 dark:bg-gradient-to-br dark:from-[#18294A] dark:to-[#0F1D36] border border-amber-200 dark:border-amber-500/35 space-y-2">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Apa Arti Angka Hasil Gabungan Ini?</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  Angka ini menunjukkan <strong>total selisih nilai uang stok</strong>{' '}
                  bila semua barang yang <strong>lebih di gudang</strong> digabungkan
                  untuk menutup barang yang <strong>kurang</strong>. Tujuannya agar
                  Anda langsung tahu apakah secara keseluruhan stok periode ini masih{' '}
                  <strong>minus (tekor)</strong> atau <strong>plus (tertutup)</strong>.
                </p>
              </div>

              {/* 3-Step Formula Card With Exact Numbers */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1E355D] bg-slate-50/80 dark:bg-[#0D1C34] p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-amber-300">
                  <Calculator className="w-4 h-4" />
                  <span>Rumus Lengkap &amp; Asal Angkanya</span>
                </div>

                {/* Step 1 & Step 2 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onChangeModalType('pos')}
                    className="text-left rounded-xl p-3.5 bg-white dark:bg-[#081226] border border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-400 transition-colors cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        1. Total Kelebihan Stok (+)
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-300 inline-flex items-center gap-0.5">
                        Lihat Barang <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                    <div className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                      + {formatRupiah(absPos)}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Dijumlah dari <strong>{countsAndSample.posRowCount} catatan</strong>{' '}
                      di Excel yang Hitungan Gudang lebih banyak dari Sistem ESB.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeModalType('neg')}
                    className="text-left rounded-xl p-3.5 bg-white dark:bg-[#081226] border border-rose-200 dark:border-rose-900/50 hover:border-rose-400 transition-colors cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                        2. Total Kekurangan Stok (−)
                      </span>
                      <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-300 inline-flex items-center gap-0.5">
                        Lihat Barang <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                    <div className="text-lg sm:text-xl font-black font-mono text-rose-600 dark:text-rose-400 tabular-nums">
                      - {formatRupiah(absNeg)}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Dijumlah dari <strong>{countsAndSample.negRowCount} catatan</strong>{' '}
                      di Excel yang Hitungan Gudang lebih sedikit dari Sistem ESB.
                    </p>
                  </button>
                </div>

                {/* Step 3 Final Equation */}
                <div
                  className={`rounded-xl p-4 border space-y-2 ${
                    isNetMinus
                      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50'
                      : 'bg-amber-50 dark:bg-[#13264A] border-amber-300/70 dark:border-amber-500/35'
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-amber-300">
                    3. Hitungan Hasil Gabungan
                  </div>
                  <div className="font-mono text-xs sm:text-sm space-y-1 tabular-nums">
                    <div className="text-slate-600 dark:text-slate-300">
                      Hasil Gabungan = Total Kelebihan − Total Kekurangan
                    </div>
                    <div className="font-bold text-slate-800 dark:text-slate-100">
                      = <span className="text-emerald-600 dark:text-emerald-400">{formatRupiah(absPos)}</span>{' '}
                      − <span className="text-rose-600 dark:text-rose-400">{formatRupiah(absNeg)}</span>
                    </div>
                    <div
                      className={`text-xl sm:text-2xl font-black pt-1 ${
                        isNetMinus
                          ? 'text-rose-600 dark:text-rose-400'
                          : isNetPlus
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      ={' '}
                      {isNetMinus
                        ? `- ${formatRupiah(summary.netTotal)} (Masih Kurang)`
                        : isNetPlus
                        ? `+ ${formatRupiah(summary.netTotal)} (Lebih / Tertutup)`
                        : 'Pas Rp 0 (Seimbang)'}
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-1 border-t border-black/10 dark:border-white/10">
                    {isNetMinus
                      ? `Artinya nilai barang kurang masih lebih besar ${formatRupiah(
                          summary.netTotal
                        )} daripada nilai barang lebih. Segera cek daftar barang kurang.`
                      : isNetPlus
                      ? `Artinya nilai barang lebih sanggup menutup seluruh kekurangan dan masih bersisa ${formatRupiah(
                          summary.netTotal
                        )}. Namun barang kurang senilai ${formatRupiah(
                          absNeg
                        )} tetap perlu dicek penyebabnya.`
                      : 'Artinya total nilai barang lebih dan kurang saling menutup tepat Rp 0.'}
                  </p>
                </div>
              </div>

              {/* How Each Row is Calculated + Real Example */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1E355D] bg-white dark:bg-[#0D1C34] p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span>Dari Mana Nilai Rupiah Tiap Barang Didapat?</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-1.5">
                  <p>
                    Setiap 1 baris barang di file Excel dihitung dengan cara:
                  </p>
                  <div className="rounded-xl bg-slate-50 dark:bg-[#081226] border border-slate-200 dark:border-[#1A3157] px-3 py-2 font-mono text-xs font-semibold text-slate-800 dark:text-amber-200">
                    Selisih Uang = (Hitungan Gudang − Catatan Sistem ESB) × Harga Satuan
                  </div>
                  {countsAndSample.sample && (
                    <div className="rounded-xl bg-amber-50/70 dark:bg-[#09172E] border border-amber-200/70 dark:border-[#1E355D] px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 space-y-1">
                      <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        <span>
                          Contoh nyata dari data Anda ({countsAndSample.sample.product}, tgl{' '}
                          {formatDateId(countsAndSample.sample.date)}):
                        </span>
                      </div>
                      <div className="font-mono text-[11px] sm:text-xs tabular-nums">
                        ({formatQty(countsAndSample.sample.op)}{' '}
                        {countsAndSample.sample.unit} −{' '}
                        {formatQty(countsAndSample.sample.sys)}{' '}
                        {countsAndSample.sample.unit}) ={' '}
                        <strong>
                          {formatSignedQty(countsAndSample.sample.diffQty)}{' '}
                          {countsAndSample.sample.unit}
                        </strong>{' '}
                        × {formatRupiah(countsAndSample.sample.valUnit)} ={' '}
                        <strong
                          className={
                            countsAndSample.sample.diffVal < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {countsAndSample.sample.diffVal < 0 ? '-' : '+'}
                          {formatRupiah(countsAndSample.sample.diffVal)}
                        </strong>
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Total keseluruhan baris yang dihitung:{' '}
                    <strong>{summary.totalRowsCount.toLocaleString('id-ID')} baris</strong>{' '}
                    ({countsAndSample.negRowCount} kurang,{' '}
                    {countsAndSample.posRowCount} lebih,{' '}
                    {countsAndSample.pasRowCount} pas) dari{' '}
                    <strong>{summary.activeDates.length} hari</strong>.
                  </p>
                </div>
              </div>

              {/* Proof By Category (Sums up exactly to Hasil Gabungan) */}
              {summary.categoryStats.length > 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-[#1E355D] bg-white dark:bg-[#0D1C34] overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-[#1E355D] flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        Rincian Sumber Angka Per Bagian (Produksi / Operasional)
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Jika semua bagian ini dijumlahkan, hasilnya sama persis dengan Hasil Gabungan
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-[#15284A] text-xs">
                    {summary.categoryStats.map((cat) => (
                      <div
                        key={cat.category}
                        className="px-4 py-2.5 flex items-center justify-between gap-3 tabular-nums"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {cat.category}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            <span className="text-emerald-600 dark:text-emerald-400">
                              +{formatRupiah(cat.posVal)}
                            </span>
                            {' − '}
                            <span className="text-rose-600 dark:text-rose-400">
                              {formatRupiah(cat.negVal)}
                            </span>
                          </div>
                        </div>
                        <div
                          className={`font-mono font-extrabold text-right shrink-0 ${
                            cat.netVal < -0.5
                              ? 'text-rose-600 dark:text-rose-400'
                              : cat.netVal > 0.5
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {cat.netVal < -0.5
                            ? `- ${formatRupiah(cat.netVal)}`
                            : cat.netVal > 0.5
                            ? `+ ${formatRupiah(cat.netVal)}`
                            : 'Rp 0'}
                        </div>
                      </div>
                    ))}
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#081226] flex items-center justify-between font-bold text-xs sm:text-sm tabular-nums">
                      <span className="text-slate-800 dark:text-slate-200">
                        Total Semua Bagian
                      </span>
                      <span
                        className={`font-mono font-black ${
                          isNetMinus
                            ? 'text-rose-600 dark:text-rose-400'
                            : isNetPlus
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-slate-700 dark:text-white'
                        }`}
                      >
                        {isNetMinus
                          ? `- ${formatRupiah(summary.netTotal)}`
                          : isNetPlus
                          ? `+ ${formatRupiah(summary.netTotal)}`
                          : 'Pas Rp 0'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Optional Collapsible Daily Proof */}
              {activeDailyRows.length > 1 && (
                <div className="rounded-2xl border border-slate-200 dark:border-[#1E355D] bg-white dark:bg-[#0D1C34] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowDateTable((prev) => !prev)}
                    className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-[#132548] transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        Rincian Sumber Angka Per Tanggal ({activeDailyRows.length} Hari)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Ketuk untuk melihat angka lebih &amp; kurang setiap harinya
                      </div>
                    </div>
                    {showDateTable ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {showDateTable && (
                    <div className="border-t border-slate-100 dark:border-[#1E355D] divide-y divide-slate-100 dark:divide-[#15284A] text-xs">
                      {activeDailyRows
                        .slice()
                        .reverse()
                        .map((day) => {
                          const dayNet = day.posVal + day.negVal;
                          return (
                            <div
                              key={day.date}
                              className="px-4 py-2.5 flex items-center justify-between gap-3 tabular-nums"
                            >
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => onOpenDayInHarian(day.date)}
                                  className="font-bold text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-300 cursor-pointer"
                                >
                                  {formatDateId(day.date)}
                                </button>
                                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    +{formatRupiah(day.posVal)}
                                  </span>
                                  {' − '}
                                  <span className="text-rose-600 dark:text-rose-400">
                                    {formatRupiah(day.negVal)}
                                  </span>
                                </div>
                              </div>
                              <span
                                className={`font-mono font-bold shrink-0 ${
                                  dayNet < -0.5
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : dayNet > 0.5
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {dayNet < -0.5
                                  ? `- ${formatRupiah(dayNet)}`
                                  : dayNet > 0.5
                                  ? `+ ${formatRupiah(dayNet)}`
                                  : 'Rp 0'}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky Modal Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-100 dark:border-[#1E355D] bg-slate-50/90 dark:bg-[#081226] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          {(modalType === 'neg' || modalType === 'pos') && (
            <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              Menampilkan <strong>{filteredList.length} barang</strong> · Total
              daftar:{' '}
              <strong
                className={
                  filteredSum < -0.5
                    ? 'text-rose-600 dark:text-rose-400 font-mono'
                    : filteredSum > 0.5
                    ? 'text-emerald-600 dark:text-emerald-400 font-mono'
                    : 'font-mono'
                }
              >
                {filteredSum < -0.5
                  ? `- ${formatRupiah(filteredSum)}`
                  : filteredSum > 0.5
                  ? `+ ${formatRupiah(filteredSum)}`
                  : 'Rp 0'}
              </strong>
            </div>
          )}
          {modalType === 'net' && (
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Ketuk <strong>Total Kelebihan</strong> atau{' '}
              <strong>Total Kekurangan</strong> di atas untuk melihat daftar
              barangnya.
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="btn-3d-primary px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl min-h-[42px] cursor-pointer sm:ml-auto"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
