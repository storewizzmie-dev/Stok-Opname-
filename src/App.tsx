// @ts-nocheck -- imported legacy code written for a looser tsconfig
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Beef,
  Boxes,
  CalendarDays,
  CalendarRange,
  Check,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Crown,
  FileSpreadsheet,
  Home,
  Info,
  Layers,
  LayoutGrid,
  Leaf,
  Lightbulb,
  Moon,
  Package,
  PackageSearch,
  Scale,
  Search,
  Settings,
  Sun,
  TrendingDown,
  TrendingUp,
  Trophy,
  Upload,
  Utensils,
  X,
} from 'lucide-react';
import {
  GsapWordTitle,
  LenisGsapProvider,
  MotionCard,
  MotionCardButton,
  MotionSection,
} from './components/AnimationPrimitives';
import {
  BerandaDetailModal,
  BerandaModalType,
} from './components/BerandaDetailModal';
import { DateRangePicker } from './components/DateRangePicker';
import { HarianV2, BarangV2 } from './components/v2/StockViews';
import { GlobalAiChatWidget } from './components/GlobalAiChatWidget';
import { InfoButton, InfoDialog, InfoGuideKey } from './components/InfoGuide';
import { ProfitLossView } from './components/ProfitLossView';
import {
  PendingPnlUploadItem,
  PnlPeriodPickerModal,
} from './components/PnlPeriodPickerModal';
import {
  KeperluanDetailPage,
  KeperluanGroupId,
} from './components/KeperluanDetailPage';
import heroInventory3d from './assets/images/hero_inventory_3d_1795152375997.jpg';
import {
  PnlDataset,
  PnlMonthReport,
  applyPnlManualPeriod,
  clearPnlAiCache,
  clearPnlPermanentNotes,
  detectExcelReportType,
  formatPercentId,
  formatPnlPeriodRange,
  formatSignedRupiah,
  getPnlPeriodDatesList,
  getPnlPeriodDays,
  parseProfitLossBuffer,
  sanitizePnlDataset,
} from './lib/profitLoss';
import {
  ConvertedStockRow,
  StockDataset,
  ViewScope,
  buildSelisihFormulaBreakdown,
  computeSummary,
  convertRowWithMeta,
  formatCompactContainerDiff,
  formatCompactRupiah,
  formatDateFullId,
  formatDateId,
  formatDateRangeFullLabel,
  formatDateRangeLabel,
  formatMonthId,
  formatOuterContainerDiff,
  formatQty,
  formatQtyMap,
  formatRupiah,
  formatSignedQty,
  getItemPackagingSpec,
  parseExcelBuffer,
  sanitizeDataset,
} from './lib/stockOpname';

const STORAGE_KEY = 'so';
const PNL_STORAGE_KEY = 'so_pnl_v1';
const THEME_KEY = 'so_theme_v3';

type MenuTab =
  | 'beranda'
  | 'harian'
  | 'barang'
  | 'labarugi'
  | 'pengaturan';
type DailyFilter = 'all' | 'diff' | 'neg' | 'pos' | 'pas';
type ProductFilter = 'all' | 'neg' | 'pos' | 'pas';
type RankMode = 'neg' | 'pos';

interface StatusMessage {
  text: string;
  isError?: boolean;
}

interface UploadReport {
  addedDates: string[];
  updatedDates: string[];
  unchangedDates: string[];
  monthsAffected: string[];
  totalRows: number;
  diffRows: number;
  pasRows: number;
  uniqueProducts: number;
}

function areStockDateRowsEqual(
  existingRows: StockDataset[string] | undefined,
  incomingRows: StockDataset[string] | undefined
): boolean {
  if (!existingRows || !incomingRows) return false;
  if (existingRows.length !== incomingRows.length) return false;

  const normalizeRowKey = (r: StockDataset[string][number]) =>
    [
      (r[0] ?? '').trim(),
      (r[1] ?? '').trim(),
      Math.round((Number(r[2]) || 0) * 1e4),
      Math.round((Number(r[3]) || 0) * 1e4),
      Math.round((Number(r[4]) || 0) * 1e4),
      Math.round((Number(r[5]) || 0) * 100),
      Math.round((Number(r[6]) || 0) * 100),
      (r[13] ?? '').trim(),
    ].join('|');

  for (let i = 0; i < existingRows.length; i++) {
    if (normalizeRowKey(existingRows[i]) !== normalizeRowKey(incomingRows[i])) {
      return false;
    }
  }
  return true;
}

interface KeperluanGroupMeta {
  id: 'food' | 'packaging' | 'beverage' | 'operational';
  title: string;
  shortLabel: string;
  indicationNeg: string;
  indicationPos: string;
  barColor: string;
  badgeClass: string;
}

const KEPERLUAN_GROUP_DEFINITIONS: KeperluanGroupMeta[] = [
  {
    id: 'food',
    title: 'Bahan Makanan & Masakan',
    shortLabel: 'Bahan Makanan',
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
    indicationNeg: 'Pemakaian kebersihan toko / selisih pencatatan',
    indicationPos: 'Stok gudang operasional belum diinput pemakaian',
    barColor: '#D65106',
    badgeClass:
      'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/30',
  },
];

function classifyItemKeperluanGroup(
  name: string,
  category: string,
  subcategory: string
): KeperluanGroupMeta['id'] {
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

export default function App() {
  const [data, setData] = useState<StockDataset>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return sanitizeDataset(JSON.parse(raw));
    } catch {
      // Ignore corrupted localStorage
    }
    return {};
  });

  const [pnlData, setPnlData] = useState<PnlDataset>(() => {
    try {
      const raw = localStorage.getItem(PNL_STORAGE_KEY);
      if (raw) return sanitizePnlDataset(JSON.parse(raw));
    } catch {
      // Ignore corrupted localStorage
    }
    return {};
  });

  const [activeTab, setActiveTab] = useState<MenuTab>(() =>
    Object.keys(data).length > 0
      ? 'beranda'
      : Object.keys(pnlData).length > 0
      ? 'labarugi'
      : 'pengaturan'
  );
  const [viewScope, setViewScope] = useState<ViewScope>('range');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedPnlMonth, setSelectedPnlMonth] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [dateRange, setDateRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dailyFilter, setDailyFilter] = useState<DailyFilter>('all');
  const [dailySearch, setDailySearch] = useState<string>('');
  const [purposeFilter, setPurposeFilter] = useState<string>('ALL');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [productCategoryFilter, setProductCategoryFilter] =
    useState<string>('ALL');
  const [rankMode, setRankMode] = useState<RankMode>('neg');
  const [purposeRankMode, setPurposeRankMode] = useState<RankMode>('neg');
  const [activeKeperluanPageId, setActiveKeperluanPageId] =
    useState<KeperluanGroupId | null>(null);
  const [selectedCombinedMonths, setSelectedCombinedMonths] = useState<
    string[]
  >([]);
  const [combinedChartTab, setCombinedChartTab] = useState<
    'daily_timeline' | 'month_compare'
  >('daily_timeline');
  const [activeCombinedDate, setActiveCombinedDate] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [activeBarDate, setActiveBarDate] = useState<string>('');
  const [activeInfoKey, setActiveInfoKey] = useState<InfoGuideKey | null>(null);
  const [berandaModal, setBerandaModal] = useState<BerandaModalType>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [lastUpload, setLastUpload] = useState<UploadReport | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPnlDragging, setIsPnlDragging] = useState(false);
  const [pendingPnlQueue, setPendingPnlQueue] = useState<
    PendingPnlUploadItem[]
  >([]);
  const [pendingPnlBatchTotal, setPendingPnlBatchTotal] = useState<number>(0);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) !== 'light';
    } catch {
      return false;
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pnlFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage error
    }
  }, [isDark]);

  const allDates = useMemo(() => Object.keys(data).sort(), [data]);
  const allMonths = useMemo(
    () => Array.from(new Set(allDates.map((d) => d.slice(0, 7)))),
    [allDates]
  );

  const activeMonth = useMemo(() => {
    if (!allMonths.length) return '';
    return allMonths.includes(selectedMonth)
      ? selectedMonth
      : allMonths[allMonths.length - 1];
  }, [allMonths, selectedMonth]);

  const activeMonthDates = useMemo(
    () => allDates.filter((d) => d.startsWith(activeMonth)),
    [allDates, activeMonth]
  );

  const activeDay = useMemo(() => {
    if (!activeMonthDates.length) return '';
    return activeMonthDates.includes(selectedDay)
      ? selectedDay
      : activeMonthDates[activeMonthDates.length - 1];
  }, [activeMonthDates, selectedDay]);

  const activeDayIndex = useMemo(
    () => activeMonthDates.indexOf(activeDay),
    [activeMonthDates, activeDay]
  );

  const activeRange = useMemo(() => {
    if (!activeMonthDates.length) {
      return { start: '', end: '' };
    }
    const defaultStart = activeMonthDates[0];
    const defaultEnd = activeMonthDates[activeMonthDates.length - 1];
    if (
      dateRange &&
      dateRange.start.startsWith(activeMonth) &&
      dateRange.end.startsWith(activeMonth)
    ) {
      return dateRange.start <= dateRange.end
        ? dateRange
        : { start: dateRange.end, end: dateRange.start };
    }
    return { start: defaultStart, end: defaultEnd };
  }, [activeMonth, activeMonthDates, dateRange]);

  const summary = useMemo(() => {
    if (!activeMonth || !activeMonthDates.length) return null;
    return computeSummary(data, activeMonth, viewScope, activeDay, activeRange);
  }, [data, activeMonth, activeMonthDates.length, viewScope, activeDay, activeRange]);

  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of allDates) {
      const m = d.slice(0, 7);
      counts[m] = (counts[m] ?? 0) + 1;
    }
    return counts;
  }, [allDates]);

  const persistData = (next: StockDataset) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setStatus({
        text: 'Gagal menyimpan: penyimpanan browser penuh atau diblokir.',
        isError: true,
      });
    }
  };

  const persistPnlData = (next: PnlDataset) => {
    try {
      localStorage.setItem(PNL_STORAGE_KEY, JSON.stringify(next));
    } catch {
      setStatus({
        text: 'Gagal menyimpan data Laba Rugi: penyimpanan browser penuh atau diblokir.',
        isError: true,
      });
    }
  };

  // Dedicated Upload Handler 1: Stock Opname (.xlsx / .xls)
  const handleStockFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setStatus({ text: 'Sedang membaca file Stock Opname...' });

    try {
      const addedDates: string[] = [];
      const updatedDates: string[] = [];
      const unchangedDates: string[] = [];
      let totalRows = 0;
      let diffRows = 0;
      let pasRows = 0;
      const productSet = new Set<string>();
      const nextData: StockDataset = { ...data };

      for (const file of list) {
        const buffer = await file.arrayBuffer();
        const reportType = detectExcelReportType(buffer);

        if (reportType === 'pnl') {
          throw new Error(
            `File "${file.name}" adalah laporan Profit Loss Consolidation. Silakan unggah pada kotak "Upload Profit Loss Consolidation" di sebelahnya.`
          );
        }

        const parsed = parseExcelBuffer(buffer);
        for (const dateKey of Object.keys(parsed)) {
          const rowsForDate = parsed[dateKey];
          if (nextData[dateKey]) {
            if (areStockDateRowsEqual(nextData[dateKey], rowsForDate)) {
              if (
                !unchangedDates.includes(dateKey) &&
                !updatedDates.includes(dateKey) &&
                !addedDates.includes(dateKey)
              ) {
                unchangedDates.push(dateKey);
              }
            } else {
              if (!updatedDates.includes(dateKey)) updatedDates.push(dateKey);
              const unchangedIdx = unchangedDates.indexOf(dateKey);
              if (unchangedIdx >= 0) unchangedDates.splice(unchangedIdx, 1);
            }
          } else {
            if (!addedDates.includes(dateKey)) addedDates.push(dateKey);
          }
          nextData[dateKey] = rowsForDate;
          totalRows += rowsForDate.length;
          for (const r of rowsForDate) {
            productSet.add(r[0]);
            if (Math.abs(r[4]) > 1e-9 || Math.abs(r[6]) > 0.5) diffRows++;
            else pasRows++;
          }
        }
      }

      const importedDates = [
        ...addedDates,
        ...updatedDates,
        ...unchangedDates,
      ].sort();

      if (!importedDates.length) {
        throw new Error('tidak ada baris data Stock Opname yang terbaca');
      }

      const latestDate = importedDates[importedDates.length - 1];
      const latestMonth = latestDate.slice(0, 7);
      const monthsAffected = Array.from(
        new Set(importedDates.map((d) => d.slice(0, 7)))
      ).sort();

      setData(nextData);
      persistData(nextData);
      setSelectedMonth(latestMonth);
      setSelectedDay(latestDate);
      setDateRange(null);
      setIsRangePickerOpen(false);
      setSelectedProduct('');
      setSearchQuery('');
      setDailySearch('');
      setPurposeFilter('ALL');
      setProductCategoryFilter('ALL');
      setActiveBarDate('');
      setLastUpload({
        addedDates: addedDates.sort(),
        updatedDates: updatedDates.sort(),
        unchangedDates: unchangedDates.sort(),
        monthsAffected,
        totalRows,
        diffRows,
        pasRows,
        uniqueProducts: productSet.size,
      });

      const updateSummaryText =
        updatedDates.length > 0
          ? `${updatedDates.length} tanggal diperbarui`
          : 'tidak ada yang diperbarui';
      setStatus({
        text: `Berhasil membaca Stock Opname (${totalRows} baris · ${productSet.size} barang: ${diffRows} selisih, ${pasRows} pas): ${addedDates.length} tanggal baru, ${updateSummaryText}.`,
      });
      setActiveTab('pengaturan');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Format file tidak sesuai.';
      setStatus({
        text: `Gagal membaca file Stock Opname: ${message}`,
        isError: true,
      });
    }
  };

  // Dedicated Upload Handler 2: Profit Loss Consolidation (.xlsx / .xls) -> Opens Pop-up Date & Month Picker
  const handlePnlFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setStatus({ text: 'Sedang membaca file Profit Loss Consolidation...' });

    try {
      const parsedItems: PendingPnlUploadItem[] = [];
      for (const file of list) {
        const buffer = await file.arrayBuffer();
        const reportType = detectExcelReportType(buffer);
        if (reportType === 'stock') {
          throw new Error(
            `File "${file.name}" adalah laporan Stock Opname. Silakan unggah pada kotak "Upload Laporan Stock Opname".`
          );
        }
        const parsedPnl = parseProfitLossBuffer(buffer);
        parsedItems.push({
          report: parsedPnl,
          fileName: file.name,
        });
      }

      if (!parsedItems.length) {
        throw new Error('Tidak ada file Profit Loss Consolidation yang terbaca');
      }

      setPendingPnlBatchTotal(parsedItems.length);
      setPendingPnlQueue(parsedItems);
      setStatus({
        text: `File "${parsedItems[0].fileName}" berhasil dibaca. Silakan pilih tanggal dan bulan periode pada pop-up.`,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Format file tidak sesuai.';
      setStatus({
        text: `Gagal membaca file Profit Loss Consolidation: ${message}`,
        isError: true,
      });
    }
  };

  const handleConfirmPnlPeriod = (periodStart: string, periodEnd: string) => {
    const currentItem = pendingPnlQueue[0];
    if (!currentItem) return;

    const finalizedReport = applyPnlManualPeriod(
      currentItem.report,
      periodStart,
      periodEnd,
      currentItem.fileName
    );
    const nextPnlData: PnlDataset = {
      ...pnlData,
      [finalizedReport.id]: finalizedReport,
    };
    clearPnlAiCache(finalizedReport.monthKey);
    setPnlData(nextPnlData);
    persistPnlData(nextPnlData);
    setSelectedPnlMonth(finalizedReport.id);

    const remainingQueue = pendingPnlQueue.slice(1);
    setPendingPnlQueue(remainingQueue);

    const periodLabel = formatPnlPeriodRange(finalizedReport);
    if (remainingQueue.length > 0) {
      setStatus({
        text: `Periode ${periodLabel} (${formatSignedRupiah(
          finalizedReport.netSales
        )}) tersimpan. Silakan tentukan periode untuk file berikutnya: "${
          remainingQueue[0].fileName
        }".`,
      });
    } else {
      setPendingPnlBatchTotal(0);
      setStatus({
        text: `Profit Loss Consolidation periode ${periodLabel} (Net Sales ${formatSignedRupiah(
          finalizedReport.netSales
        )}) berhasil disimpan tanpa menimpa periode lain dan sudah masuk ke Menu Laba Rugi.`,
      });
    }
  };

  const handleCancelPnlPeriod = () => {
    const remainingQueue = pendingPnlQueue.slice(1);
    setPendingPnlQueue(remainingQueue);
    if (remainingQueue.length === 0) {
      setPendingPnlBatchTotal(0);
    }
    setStatus({
      text: 'Pemilihan periode Profit Loss dibatalkan.',
    });
  };

  const handlePickProduct = (productName: string) => {
    setSelectedProduct(productName);
    setSearchQuery(productName);
    setActiveTab('barang');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDayInHarian = (dateKey: string) => {
    const targetMonth = dateKey.slice(0, 7);
    if (targetMonth && targetMonth !== activeMonth) {
      setSelectedMonth(targetMonth);
      setDateRange(null);
      setViewScope('range');
    } else if (
      (viewScope === 'day' && activeDay !== dateKey) ||
      (viewScope === 'range' && !summary?.activeDates.includes(dateKey))
    ) {
      setDateRange(null);
      setViewScope('range');
    }
    setOpenDays((prev) => ({ ...prev, [dateKey]: true }));
    setActiveTab('harian');
    window.requestAnimationFrame(() => {
      const target = document.getElementById(`day-${dateKey}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleDeletePnlMonth = (reportKey: string) => {
    const targetReport = pnlData[reportKey];
    const next = { ...pnlData };
    delete next[reportKey];
    if (targetReport) {
      clearPnlAiCache(targetReport.monthKey);
      clearPnlPermanentNotes(targetReport.id);
      clearPnlPermanentNotes(targetReport.monthKey);
    }
    setPnlData(next);
    persistPnlData(next);
    if (selectedPnlMonth === reportKey) {
      const remaining = Object.keys(next).sort();
      setSelectedPnlMonth(remaining[remaining.length - 1] ?? '');
    }
    setStatus({
      text: `Data Profit Loss periode ${
        targetReport ? formatPnlPeriodRange(targetReport) : reportKey
      } dihapus.`,
    });
  };

  const matchingProducts = useMemo(() => {
    if (!summary) return [];
    const q = searchQuery.trim().toLowerCase();
    let names = Object.keys(summary.productMap).filter((name) => {
      const stat = summary.productMap[name];
      if (
        productCategoryFilter !== 'ALL' &&
        stat.category !== productCategoryFilter
      ) {
        return false;
      }
      if (productFilter === 'neg') return stat.netVal < -0.5;
      if (productFilter === 'pos') return stat.netVal > 0.5;
      if (productFilter === 'pas') return Math.abs(stat.netVal) <= 0.5;
      return true;
    });
    if (q) {
      names = names.filter((name) => {
        const stat = summary.productMap[name];
        return (
          name.toLowerCase().includes(q) ||
          stat.code.toLowerCase().includes(q) ||
          stat.category.toLowerCase().includes(q) ||
          stat.subcategory.toLowerCase().includes(q) ||
          stat.purposes.some((p) => p.toLowerCase().includes(q))
        );
      });
    }
    names.sort((a, b) => {
      const sa = summary.productMap[a];
      const sb = summary.productMap[b];
      if (productFilter === 'pos') return sb.netVal - sa.netVal;
      if (productFilter === 'pas') return a.localeCompare(b, 'id');
      return sa.netVal - sb.netVal;
    });
    return names;
  }, [summary, searchQuery, productFilter, productCategoryFilter]);

  const effectiveSelectedProduct = useMemo(() => {
    if (!summary) return '';
    if (selectedProduct && summary.productMap[selectedProduct]) {
      return selectedProduct;
    }
    return matchingProducts[0] ?? '';
  }, [summary, selectedProduct, matchingProducts]);

  const selectedProductStat =
    summary && effectiveSelectedProduct
      ? summary.productMap[effectiveSelectedProduct]
      : null;

  const selectedProductTimeline = useMemo(() => {
    if (!summary || !effectiveSelectedProduct) return [];
    const entries: { date: string; meta: ConvertedStockRow }[] = [];
    for (const date of summary.activeDates) {
      for (const rawRow of data[date]) {
        if (rawRow[0] === effectiveSelectedProduct) {
          entries.push({ date, meta: convertRowWithMeta(rawRow) });
        }
      }
    }
    return entries;
  }, [summary, effectiveSelectedProduct, data]);

  const maxDailyDeficit = useMemo(() => {
    if (!summary) return 1;
    return Math.max(1, ...summary.dailyStats.map((d) => Math.abs(d.negVal)));
  }, [summary]);

  const worstDay = useMemo(() => {
    if (!summary || !summary.dailyStats.length) return null;
    return summary.dailyStats.reduce(
      (min, curr) => (curr.negVal < min.negVal ? curr : min),
      summary.dailyStats[0]
    );
  }, [summary]);

  const highlightedBarStat = useMemo(() => {
    if (!summary) return null;
    if (viewScope === 'day' && activeDay) {
      return summary.dailyStats.find((d) => d.date === activeDay) ?? null;
    }
    if (activeBarDate) {
      const found = summary.dailyStats.find((d) => d.date === activeBarDate);
      if (found) return found;
    }
    return worstDay && worstDay.negVal < 0 ? worstDay : null;
  }, [summary, viewScope, activeDay, activeBarDate, worstDay]);

  const pnlReportList = useMemo(
    () =>
      Object.values(pnlData).sort((a, b) => {
        if (a.periodStart !== b.periodStart) {
          return a.periodStart.localeCompare(b.periodStart);
        }
        return a.periodEnd.localeCompare(b.periodEnd);
      }),
    [pnlData]
  );

  const pnlMonths = useMemo(
    () =>
      Array.from(
        new Set(pnlReportList.map((r) => r.monthKey).filter(Boolean))
      ).sort(),
    [pnlReportList]
  );

  const berandaPnlReport = useMemo<PnlMonthReport | null>(() => {
    if (!pnlReportList.length) return null;
    if (selectedPnlMonth && pnlData[selectedPnlMonth]) {
      return pnlData[selectedPnlMonth];
    }
    if (activeMonth) {
      const inActiveMonth = pnlReportList.filter(
        (r) => r.monthKey === activeMonth
      );
      if (inActiveMonth.length > 0) {
        return inActiveMonth[inActiveMonth.length - 1];
      }
    }
    return pnlReportList[pnlReportList.length - 1] ?? null;
  }, [pnlReportList, pnlData, activeMonth, selectedPnlMonth]);

  const navItems: {
    id: MenuTab;
    label: string;
    mobileLabel: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'beranda',
      label: 'Beranda',
      mobileLabel: 'Home',
      icon: <Home className="w-5 h-5 md:w-4 md:h-4" />,
    },
    {
      id: 'harian',
      label: 'Harian',
      mobileLabel: 'Harian',
      icon: <CalendarDays className="w-5 h-5 md:w-4 md:h-4" />,
    },
    {
      id: 'barang',
      label: 'Cek Barang',
      mobileLabel: 'Barang',
      icon: <PackageSearch className="w-5 h-5 md:w-4 md:h-4" />,
    },
    {
      id: 'labarugi',
      label: 'Laba Rugi',
      mobileLabel: 'Laba',
      icon: <Coins className="w-5 h-5 md:w-4 md:h-4" />,
    },
    {
      id: 'pengaturan',
      label: 'Pengaturan',
      mobileLabel: 'Atur',
      icon: <Settings className="w-5 h-5 md:w-4 md:h-4" />,
    },
  ];

  const handleSelectMonth = (monthKey: string) => {
    setSelectedMonth(monthKey);
    setSelectedDay('');
    setDateRange(null);
    setIsRangePickerOpen(false);
    setSelectedProduct('');
    setActiveBarDate('');
  };

  useEffect(() => {
    const order: MenuTab[] = ['beranda', 'harian', 'barang', 'labarugi', 'pengaturan'];
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5 && !e.metaKey && !e.ctrlKey) {
        setActiveKeperluanPageId(null);
        setActiveTab(order[n - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
      <LenisGsapProvider
      activeKey={`${activeTab}-${activeMonth}-${viewScope}-${selectedPnlMonth}-${activeKeperluanPageId ?? 'main'}`}
    >
      <div className="min-h-screen app-canvas-bg text-slate-900 dark:text-slate-100 pb-20 md:pb-10 transition-colors">
      {/* Dedicated Hidden File Input 1: Stock Opname */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleStockFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {/* Dedicated Hidden File Input 2: Profit Loss Consolidation */}
      <input
        ref={pnlFileInputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handlePnlFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* ===== Sidebar (desktop) ===== */}
      <aside className="wz-sidebar hidden md:flex">
        <div className="flex items-center gap-3 px-2">
          <span className="wz-logo">W</span>
          <span className="leading-tight">
            <span className="wz-brand block">Stok<span className="wz-brand-accent">Opname</span></span>
            <span className="wz-brand-sub block">Control Room</span>
          </span>
        </div>
        <div className="wz-side-label">Navigasi</div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item, idx) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveKeperluanPageId(null);
                  setActiveTab(item.id);
                }}
                className={`wz-side-item ${isActive ? 'is-active' : ''}`}
              >
                <span className="wz-side-icon">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                <kbd className="wz-kbd">{idx + 1}</kbd>
              </button>
            );
          })}
        </nav>
        <div className="wz-side-label">Sumber Data</div>
        <div className="wz-data-card">
          <div className="flex items-center justify-between">
            <span>Stok Opname</span>
            <span className={allMonths.length ? 'wz-dot-on' : 'wz-dot-off'} />
          </div>
          <div className="wz-data-num">{allMonths.length} <small>bulan</small></div>
          <button type="button" className="wz-mini-btn" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" /> Upload Excel
          </button>
        </div>
        <div className="wz-data-card">
          <div className="flex items-center justify-between">
            <span>Laba Rugi</span>
            <span className={pnlMonths.length ? 'wz-dot-on' : 'wz-dot-off'} />
          </div>
          <div className="wz-data-num">{pnlMonths.length} <small>periode</small></div>
          <button type="button" className="wz-mini-btn" onClick={() => pnlFileInputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" /> Upload Excel
          </button>
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <button type="button" className="wz-ai-cta" onClick={() => window.dispatchEvent(new Event('wz-open-ai'))}>
            <span className="wz-ai-orb" />
            <span className="text-left leading-tight">
              <b className="block">Tanya AI</b>
              <small>Analisis stok & laba rugi</small>
            </span>
          </button>
          <button type="button" className="wz-side-item" onClick={() => setIsDark((prev) => !prev)}>
            <span className="wz-side-icon">{isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</span>
            <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>
          </button>
        </div>
      </aside>

      <div className="md:pl-[17.5rem]">
      {/* ===== Command bar ===== */}
      <header className="wz-topbar">
        <div className="flex items-center gap-3 min-w-0">
          <span className="md:hidden"><span className="wz-logo">W</span></span>
          <div className="min-w-0">
            <div className="wz-crumb">Wizzmie / {navItems.find((n) => n.id === activeTab)?.label}</div>
            <h1 className="wz-page-title truncate">
              {({ beranda: 'Ringkasan Outlet', harian: 'Opname Harian', barang: 'Cek per Barang', labarugi: 'Laba & Rugi', pengaturan: 'Data & Pengaturan' } as Record<string, string>)[activeTab]}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="wz-chip hidden lg:inline-flex"><span className="wz-dot-on" /> Live · {new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <button type="button" className="wz-icon-btn" aria-label="Upload stok" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4" />
          </button>
          <button type="button" className="wz-icon-btn md:hidden" aria-label="Ganti tema" onClick={() => setIsDark((prev) => !prev)}>
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button type="button" className="wizzmie-pink-pill hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm" onClick={() => window.dispatchEvent(new Event('wz-open-ai'))}>
            <Lightbulb className="w-4 h-4" /> Tanya AI
          </button>
        </div>
      </header>

      <main className="wz-main max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5">
        {status && (
          <div
            role="status"
            className={`px-4 py-3 rounded-xl text-sm font-medium border flex items-center justify-between gap-3 ${
              status.isError
                ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
            }`}
          >
            <span>{status.text}</span>
            <button
              type="button"
              onClick={() => setStatus(null)}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 shrink-0 cursor-pointer"
              aria-label="Tutup pesan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PAGE 1: BERANDA (Removed from navigation as requested by user) */}
        {activeTab === 'beranda' &&
          (() => {
            // Multi-Month & Multi-Period Combined Daily Profit (Net Sales) / Stock Chart Data
            const availableCombinedMonths = Array.from(
              new Set([...allMonths, ...pnlMonths])
            ).sort();
            const effectiveCombinedMonths = (() => {
              const validSelected = selectedCombinedMonths.filter((m) =>
                availableCombinedMonths.includes(m)
              );
              if (validSelected.length > 0) {
                return [...validSelected].sort();
              }
              return availableCombinedMonths;
            })();

            // Build per-date map of Net Sales from all uploaded Profit Loss Consolidation periods
            // Each period (e.g. 1–16 Nov 2026, 18 Nov 2026) distributes its Net Sales across its own selected dates
            const pnlDailyByDate = new Map<
              string,
              {
                dailyNetSales: number;
                dailyNetProfit: number;
                dailyOpex: number;
                periodLabels: string[];
              }
            >();
            for (const rep of pnlReportList) {
              const repDates = getPnlPeriodDatesList(rep);
              const daysCount = Math.max(1, repDates.length);
              const perDaySales = rep.netSales / daysCount;
              const perDayProfit = rep.netProfit / daysCount;
              const perDayOpex = rep.totalOpex / daysCount;
              const pLabel = formatPnlPeriodRange(rep);
              for (const dIso of repDates) {
                const prev = pnlDailyByDate.get(dIso);
                if (prev) {
                  prev.dailyNetSales += perDaySales;
                  prev.dailyNetProfit += perDayProfit;
                  prev.dailyOpex += perDayOpex;
                  if (!prev.periodLabels.includes(pLabel)) {
                    prev.periodLabels.push(pLabel);
                  }
                } else {
                  pnlDailyByDate.set(dIso, {
                    dailyNetSales: perDaySales,
                    dailyNetProfit: perDayProfit,
                    dailyOpex: perDayOpex,
                    periodLabels: [pLabel],
                  });
                }
              }
            }

            // Build per-month summary & combined daily timeline across effectiveCombinedMonths
            const combinedTimelineDays: {
              date: string;
              monthKey: string;
              isFirstOfMonth: boolean;
              negVal: number;
              posVal: number;
              netStockVal: number;
              dailyPnlProfit: number | null;
              dailyPnlOpex: number | null;
              pnlPeriodLabel: string | null;
              combinedDailyProfit: number;
              diffCount: number;
            }[] = [];

            const perMonthComparison: {
              monthKey: string;
              soDayCount: number;
              totalNeg: number;
              totalPos: number;
              netStock: number;
              avgDailyStockNet: number;
              pnlNetProfit: number | null;
              pnlNetSales: number | null;
              pnlDaysCount: number;
              avgDailyPnlProfit: number | null;
              combinedDailyAvg: number;
            }[] = [];

            for (const mKey of effectiveCombinedMonths) {
              const mDates = allDates.filter((d) => d.startsWith(mKey)).sort();
              const monthPnlReports = pnlReportList.filter(
                (r) => r.monthKey === mKey
              );
              const monthPnlDates = Array.from(pnlDailyByDate.keys())
                .filter((d) => d.startsWith(mKey))
                .sort();

              const effectiveMonthDates = Array.from(
                new Set([...mDates, ...monthPnlDates])
              ).sort();

              let mNeg = 0;
              let mPos = 0;

              effectiveMonthDates.forEach((date, idx) => {
                let dNeg = 0;
                let dPos = 0;
                let dDiffCount = 0;
                for (const r of data[date] ?? []) {
                  if (r[6] < 0) dNeg += r[6];
                  else if (r[6] > 0) dPos += r[6];
                  if (Math.abs(r[4]) > 1e-9 || Math.abs(r[6]) > 0.5) {
                    dDiffCount++;
                  }
                }
                mNeg += dNeg;
                mPos += dPos;
                const dNetStock = dNeg + dPos;
                const pnlDayInfo = pnlDailyByDate.get(date) ?? null;
                const dailyPnlSalesVal = pnlDayInfo
                  ? pnlDayInfo.dailyNetSales
                  : null;
                const dailyPnlOpexVal = pnlDayInfo
                  ? pnlDayInfo.dailyOpex
                  : null;
                const dCombinedProfit =
                  dailyPnlSalesVal !== null ? dailyPnlSalesVal : dNetStock;

                combinedTimelineDays.push({
                  date,
                  monthKey: mKey,
                  isFirstOfMonth: idx === 0,
                  negVal: dNeg,
                  posVal: dPos,
                  netStockVal: dNetStock,
                  dailyPnlProfit: dailyPnlSalesVal,
                  dailyPnlOpex: dailyPnlOpexVal,
                  pnlPeriodLabel: pnlDayInfo
                    ? pnlDayInfo.periodLabels.join(', ')
                    : null,
                  combinedDailyProfit: dCombinedProfit,
                  diffCount: dDiffCount,
                });
              });

              const mNetStock = mNeg + mPos;
              const avgDailyStockNet =
                mDates.length > 0 ? mNetStock / mDates.length : 0;
              const monthTotalNetSales =
                monthPnlReports.length > 0
                  ? monthPnlReports.reduce((acc, r) => acc + r.netSales, 0)
                  : null;
              const monthTotalNetProfit =
                monthPnlReports.length > 0
                  ? monthPnlReports.reduce((acc, r) => acc + r.netProfit, 0)
                  : null;
              const pnlDaysDivisor =
                monthPnlDates.length > 0
                  ? monthPnlDates.length
                  : effectiveMonthDates.length || 1;
              const avgDailyPnlSales =
                monthTotalNetSales !== null
                  ? monthTotalNetSales / Math.max(1, pnlDaysDivisor)
                  : null;
              const combinedDailyAvg =
                avgDailyPnlSales !== null ? avgDailyPnlSales : avgDailyStockNet;

              perMonthComparison.push({
                monthKey: mKey,
                soDayCount: effectiveMonthDates.length,
                totalNeg: mNeg,
                totalPos: mPos,
                netStock: mNetStock,
                avgDailyStockNet,
                pnlNetProfit: monthTotalNetProfit,
                pnlNetSales: monthTotalNetSales,
                pnlDaysCount: pnlDaysDivisor,
                avgDailyPnlProfit: avgDailyPnlSales,
                combinedDailyAvg,
              });
            }

            const hasAnyPnlInCombined = perMonthComparison.some(
              (m) => m.pnlNetSales !== null
            );

            const selectedCombinedDayObj =
              combinedTimelineDays.find((d) => d.date === activeCombinedDate) ??
              combinedTimelineDays[combinedTimelineDays.length - 1] ??
              null;

            const totalCombinedPosStock = perMonthComparison.reduce(
              (acc, m) => acc + m.totalPos,
              0
            );
            const totalCombinedPnlSales = perMonthComparison.reduce(
              (acc, m) => acc + (m.pnlNetSales ?? 0),
              0
            );

            const renderProfitChartSection = () => {
              const formatShortVal = (val: number) => {
                const abs = Math.abs(val);
                if (abs >= 1_000_000_000) {
                  return `${(abs / 1_000_000_000).toLocaleString('id-ID', {
                    maximumFractionDigits: 1,
                  })}M`;
                }
                if (abs >= 1_000_000) {
                  return `${(abs / 1_000_000).toLocaleString('id-ID', {
                    maximumFractionDigits: 1,
                  })}jt`;
                }
                if (abs >= 1_000) {
                  return `${Math.round(abs / 1_000)}rb`;
                }
                return `${Math.round(abs)}`;
              };

              const latestMonthKey =
                availableCombinedMonths[availableCombinedMonths.length - 1] ||
                activeMonth ||
                '2026-11';
              const activeYearStr = latestMonthKey.slice(0, 4);

              const MONTH_NAMES_UPPER = [
                'JANUARI',
                'FEBRUARI',
                'MARET',
                'APRIL',
                'MEI',
                'JUNI',
                'JULI',
                'AGUSTUS',
                'SEPTEMBER',
                'OKTOBER',
                'NOVEMBER',
                'DESEMBER',
              ];

              const twelveMonthsData = MONTH_NAMES_UPPER.map((mName, mIdx) => {
                const mKey = `${activeYearStr}-${String(mIdx + 1).padStart(
                  2,
                  '0'
                )}`;
                const mDates = allDates
                  .filter((d) => d.startsWith(mKey))
                  .sort();
                const monthPnlReports = pnlReportList.filter(
                  (r) => r.monthKey === mKey
                );
                const monthPnlDates = Array.from(pnlDailyByDate.keys())
                  .filter((d) => d.startsWith(mKey))
                  .sort();
                const combinedMonthDaysCount = new Set([
                  ...mDates,
                  ...monthPnlDates,
                ]).size;

                let mPos = 0;
                for (const d of mDates) {
                  for (const r of data[d] ?? []) {
                    if (r[6] > 0) mPos += r[6];
                  }
                }
                const hasData =
                  mDates.length > 0 || monthPnlReports.length > 0;
                const isSelectedMonth =
                  effectiveCombinedMonths.includes(mKey);
                const monthNetSalesSum =
                  monthPnlReports.length > 0
                    ? monthPnlReports.reduce((acc, r) => acc + r.netSales, 0)
                    : null;

                const barVal =
                  monthNetSalesSum !== null
                    ? Math.max(0, Math.abs(monthNetSalesSum))
                    : mPos;

                return {
                  monthKey: mKey,
                  label: mName,
                  shortLabel: mName.slice(0, 3),
                  hasData,
                  isSelected: isSelectedMonth,
                  dayCount: combinedMonthDaysCount,
                  periodCount: monthPnlReports.length,
                  barVal,
                  lineVal: barVal,
                  pnlNetSales: monthNetSalesSum,
                };
              });

              const chartColumns =
                combinedChartTab === 'daily_timeline'
                  ? combinedTimelineDays.map((d) => {
                      const dayNum = Number(d.date.slice(8));
                      const shortMo = formatDateId(d.date)
                        .split(' ')[1]
                        .toUpperCase();
                      const barValue =
                        d.dailyPnlProfit !== null
                          ? Math.max(0, d.dailyPnlProfit)
                          : Math.abs(d.posVal);
                      const isHighlighted =
                        selectedCombinedDayObj?.date === d.date ||
                        combinedTimelineDays.length <= 24;

                      return {
                        id: d.date,
                        dateKey: d.date,
                        monthKey: d.monthKey,
                        isFirstOfMonth: d.isFirstOfMonth,
                        bottomLabel: `${dayNum} ${shortMo}`,
                        barVal: barValue,
                        lineVal: barValue,
                        isActive: isHighlighted,
                        isFocused: selectedCombinedDayObj?.date === d.date,
                        hasRealData: true,
                      };
                    })
                  : twelveMonthsData.map((m) => ({
                      id: m.monthKey,
                      dateKey: '',
                      monthKey: m.monthKey,
                      isFirstOfMonth: false,
                      bottomLabel: m.label,
                      barVal: m.barVal,
                      lineVal: m.lineVal,
                      isActive: m.isSelected && m.hasData,
                      isFocused: m.isSelected && m.hasData,
                      hasRealData: m.hasData,
                    }));

              const rawMaxChartVal = Math.max(
                10_000,
                ...chartColumns.map((c) => c.barVal)
              );
              const magnitude = Math.pow(
                10,
                Math.max(3, Math.floor(Math.log10(rawMaxChartVal)) - 1)
              );
              const niceMaxScale =
                Math.ceil((rawMaxChartVal * 1.15) / magnitude) * magnitude;
              const yGridSteps = [
                1, 0.875, 0.75, 0.625, 0.5, 0.375, 0.25, 0.125, 0,
              ].map((ratio) => Math.round(niceMaxScale * ratio));

              const headerNetSalesVal = hasAnyPnlInCombined
                ? totalCombinedPnlSales
                : totalCombinedPosStock;

              const colCount = Math.max(1, chartColumns.length);
              const colSlotW =
                combinedChartTab === 'daily_timeline' ? 54 : 68;
              const plotLeft = 58;
              const plotRight = 20;
              const plotTop = 30;
              const plotBottom = 18;
              const plotH = 215;
              const plotW = colCount * colSlotW;
              const svgW = plotLeft + plotW + plotRight;
              const svgH = plotTop + plotH + plotBottom;
              const baseY = plotTop + plotH;

              const computedPts = chartColumns.map((col, idx) => {
                const cx = plotLeft + idx * colSlotW + colSlotW / 2;
                const barRatio = Math.min(
                  1,
                  Math.max(0, col.barVal / niceMaxScale)
                );
                const barH = col.hasRealData
                  ? Math.max(18, Math.round(barRatio * plotH))
                  : 12;
                const barY = baseY - barH;
                // Smooth curve sits gracefully inside the upper portion of each bar
                const lineY = col.hasRealData
                  ? Math.min(
                      baseY - 14,
                      Math.max(plotTop + 14, Math.round(barY + barH * 0.28))
                    )
                  : baseY - 18;

                return {
                  ...col,
                  cx,
                  barW: Math.min(26, Math.round(colSlotW * 0.44)),
                  barY,
                  barH,
                  lineY,
                };
              });

              const smoothCurvePath = (() => {
                if (computedPts.length === 0) return '';
                if (computedPts.length === 1) {
                  const p = computedPts[0];
                  return `M ${p.cx - 20} ${p.lineY} L ${p.cx + 20} ${p.lineY}`;
                }
                let d = `M ${computedPts[0].cx} ${computedPts[0].lineY}`;
                for (let i = 0; i < computedPts.length - 1; i++) {
                  const curr = computedPts[i];
                  const next = computedPts[i + 1];
                  const dx = (next.cx - curr.cx) * 0.44;
                  const cp1x = Math.round(curr.cx + dx);
                  const cp1y = curr.lineY;
                  const cp2x = Math.round(next.cx - dx);
                  const cp2y = next.lineY;
                  d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.cx} ${next.lineY}`;
                }
                return d;
              })();

              return (
                <MotionSection className="rounded-2xl bg-white dark:bg-[#18130F] border border-[#F8C8B6] dark:border-[#3E3731] p-4 sm:p-5 space-y-4 shadow-xs">
                  {/* Top Header: Only Keuntungan (Net Sales) + Compact Per Hari / Per Bulan Toggle */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-[#ECE7E2] dark:border-[#322B25]">
                    <div className="flex flex-wrap items-baseline gap-2.5">
                      <span className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.12em] text-[#BE490C] dark:text-[#ACE25B]">
                        {hasAnyPnlInCombined
                          ? 'GRAFIK KEUNTUNGAN (NET SALES)'
                          : 'GRAFIK KEUNTUNGAN'}
                      </span>
                      <span className="text-lg sm:text-xl font-black font-mono text-[#451300] dark:text-white tabular-nums tracking-tight">
                        {headerNetSalesVal < 0 ? '-' : ''}
                        {formatRupiah(headerNetSalesVal)}
                      </span>
                    </div>

                    {/* Compact Mode Toggle & Gabung Semua */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="inline-flex items-center rounded-full bg-[#FBF6F1] dark:bg-[#17120E] border border-[#F8C8B6] dark:border-[#3E3731] p-0.5">
                        <button
                          type="button"
                          onClick={() => setCombinedChartTab('daily_timeline')}
                          className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer leading-none ${
                            combinedChartTab === 'daily_timeline'
                              ? 'bg-gradient-to-r from-[#D65106] to-[#A33D05] text-white shadow-xs'
                              : 'text-[#814730] dark:text-slate-300 hover:text-[#BE490C]'
                          }`}
                        >
                          Per Hari ({combinedTimelineDays.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCombinedChartTab('month_compare')}
                          className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer leading-none ${
                            combinedChartTab === 'month_compare'
                              ? 'bg-gradient-to-r from-[#D65106] to-[#A33D05] text-white shadow-xs'
                              : 'text-[#814730] dark:text-slate-300 hover:text-[#BE490C]'
                          }`}
                        >
                          Per Bulan
                        </button>
                      </div>

                      {availableCombinedMonths.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCombinedMonths(availableCombinedMonths)
                          }
                          className="px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-[#F9F5F0] hover:bg-[#FEE7DE] dark:bg-[#26201B] border border-[#F8C8B6] dark:border-[#3E3731] text-[#A33D05] dark:text-amber-300 transition-colors cursor-pointer leading-none"
                        >
                          Gabung ({availableCombinedMonths.length} Bln)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Selected Day Quick Detail Bar (when in Per Hari mode) */}
                  {combinedChartTab === 'daily_timeline' &&
                    selectedCombinedDayObj && (
                      <div className="rounded-xl bg-[#FDF8F3] dark:bg-[#211B16] border border-[#F8C8B6] dark:border-[#3E3731] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-[#D65106] to-[#A33D05] text-white font-extrabold text-[11px]">
                            {formatDateFullId(selectedCombinedDayObj.date)}
                          </span>
                          {selectedCombinedDayObj.pnlPeriodLabel && (
                            <span className="px-2 py-0.5 rounded-md bg-[#F1EDE8] dark:bg-purple-500/20 border border-[#F8C8B6] dark:border-purple-400/35 text-[#A33D05] dark:text-purple-200 font-bold text-[11px]">
                              Periode: {selectedCombinedDayObj.pnlPeriodLabel}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
                          {selectedCombinedDayObj.dailyPnlProfit !== null && (
                            <span className="text-[#814730] dark:text-slate-300">
                              Net Sales/Hr:{' '}
                              <strong className="text-[#BE490C] dark:text-amber-300">
                                {selectedCombinedDayObj.dailyPnlProfit >= 0
                                  ? '+'
                                  : '-'}
                                {formatRupiah(
                                  selectedCombinedDayObj.dailyPnlProfit
                                )}
                              </strong>
                            </span>
                          )}
                          {allDates.includes(selectedCombinedDayObj.date) && (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenDayInHarian(
                                  selectedCombinedDayObj.date
                                )
                              }
                              className="px-2 py-0.5 rounded-md bg-white hover:bg-[#FEEAE2] dark:bg-[#2E2721] border border-[#F8C8B6] dark:border-[#4A423D] font-sans font-bold text-[11px] text-[#A33D05] dark:text-white cursor-pointer"
                            >
                              Buka Tanggal →
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Main Chart Canvas (Dominant White Surface with Pink & Purple Bars and Smooth Curve) */}
                  <div className="overflow-x-auto pb-1">
                    <div
                      style={{
                        minWidth: `${Math.max(660, svgW)}px`,
                      }}
                    >
                      <svg
                        viewBox={`0 0 ${svgW} ${svgH}`}
                        className="w-full h-auto select-none overflow-visible"
                      >
                        <defs>
                          {/* Pink-to-Purple Gradient for Active Bars */}
                          <linearGradient
                            id="refActiveBarGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor="#FE7A43" />
                            <stop offset="50%" stopColor="#D24E00" />
                            <stop offset="100%" stopColor="#A33D05" />
                          </linearGradient>

                          {/* Soft Pink-Lavender Gradient for Inactive Bars on White */}
                          <linearGradient
                            id="refMutedBarGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor="#F3EEEA" />
                            <stop offset="100%" stopColor="#FBD6C8" />
                          </linearGradient>

                          {/* Soft Pink-Purple Glow Filter for the Smooth Curve */}
                          <filter
                            id="refMagentaGlow"
                            x="-20%"
                            y="-20%"
                            width="140%"
                            height="140%"
                          >
                            <feDropShadow
                              dx="0"
                              dy="2"
                              stdDeviation="3"
                              floodColor="#BE490C"
                              floodOpacity="0.32"
                            />
                          </filter>
                        </defs>

                        {/* 9 Horizontal Grid Lines + Left Y-Axis Scale Labels */}
                        {yGridSteps.map((stepVal, sIdx) => {
                          const yPos = Math.round(
                            plotTop +
                              (sIdx / (yGridSteps.length - 1)) * plotH
                          );
                          return (
                            <g key={`grid-${sIdx}`}>
                              <text
                                x={plotLeft - 10}
                                y={yPos + 4}
                                textAnchor="end"
                                fill="#924D32"
                                fontSize="10"
                                fontFamily="ui-monospace, monospace"
                              >
                                {stepVal === 0
                                  ? '0'
                                  : formatShortVal(stepVal)}
                              </text>
                              <line
                                x1={plotLeft}
                                y1={yPos}
                                x2={svgW - plotRight}
                                y2={yPos}
                                stroke="#E9E5E0"
                                strokeWidth="1"
                              />
                            </g>
                          );
                        })}

                        {/* Vertical Rounded Pill Bars + Top Value Labels */}
                        {computedPts.map((pt) => {
                          const xLeft = Math.round(pt.cx - pt.barW / 2);
                          return (
                            <g
                              key={`bar-${pt.id}`}
                              className="cursor-pointer"
                              onClick={() => {
                                if (
                                  combinedChartTab === 'daily_timeline' &&
                                  pt.dateKey
                                ) {
                                  setActiveCombinedDate(pt.dateKey);
                                } else if (pt.hasRealData) {
                                  const current = effectiveCombinedMonths;
                                  const isChecked = current.includes(
                                    pt.monthKey
                                  );
                                  if (isChecked && current.length > 1) {
                                    setSelectedCombinedMonths(
                                      current.filter((m) => m !== pt.monthKey)
                                    );
                                  } else if (!isChecked) {
                                    setSelectedCombinedMonths(
                                      [...current, pt.monthKey].sort()
                                    );
                                  }
                                }
                              }}
                            >
                              {/* Month boundary dashed line in daily mode */}
                              {combinedChartTab === 'daily_timeline' &&
                                pt.isFirstOfMonth && (
                                  <g>
                                    <line
                                      x1={pt.cx - Math.round(colSlotW / 2)}
                                      y1={plotTop - 10}
                                      x2={pt.cx - Math.round(colSlotW / 2)}
                                      y2={baseY}
                                      stroke="rgba(190,73,12, 0.35)"
                                      strokeWidth="1.5"
                                      strokeDasharray="4 4"
                                    />
                                    <text
                                      x={pt.cx}
                                      y={plotTop - 14}
                                      textAnchor="middle"
                                      fill="#BE490C"
                                      fontSize="9"
                                      fontWeight="800"
                                    >
                                      {formatMonthId(pt.monthKey).toUpperCase()}
                                    </text>
                                  </g>
                                )}

                              {/* Rounded Pill Bar */}
                              <rect
                                x={xLeft}
                                y={pt.barY}
                                width={pt.barW}
                                height={pt.barH}
                                rx={8}
                                ry={8}
                                fill={
                                  pt.isActive
                                    ? 'url(#refActiveBarGrad)'
                                    : 'url(#refMutedBarGrad)'
                                }
                                stroke={
                                  pt.isFocused
                                    ? '#A33D05'
                                    : pt.isActive
                                    ? 'transparent'
                                    : '#F8C8B6'
                                }
                                strokeWidth={pt.isFocused ? '2' : '1'}
                              />

                              {/* Top Value Label right above the bar */}
                              {pt.isActive && pt.hasRealData && (
                                <text
                                  x={pt.cx}
                                  y={Math.max(12, pt.barY - 6)}
                                  textAnchor="middle"
                                  fill="#722600"
                                  fontSize="10.5"
                                  fontWeight="800"
                                  fontFamily="ui-monospace, monospace"
                                >
                                  {formatShortVal(pt.barVal)}
                                </text>
                              )}
                            </g>
                          );
                        })}

                        {/* Smooth Cubic-Bezier Pink-Purple Curve Overlay */}
                        {smoothCurvePath && (
                          <path
                            d={smoothCurvePath}
                            fill="none"
                            stroke="#BE490C"
                            strokeWidth="2.75"
                            strokeLinecap="round"
                            filter="url(#refMagentaGlow)"
                          />
                        )}

                        {/* White-Centered Dots on the Curve */}
                        {computedPts.map((pt) => {
                          if (!pt.isActive || !pt.hasRealData) {
                            return null;
                          }
                          return (
                            <g
                              key={`dot-${pt.id}`}
                              className="cursor-pointer"
                              onClick={() => {
                                if (pt.dateKey) {
                                  setActiveCombinedDate(pt.dateKey);
                                }
                              }}
                            >
                              <circle
                                cx={pt.cx}
                                cy={pt.lineY}
                                r="6.5"
                                fill="rgba(214,81,6, 0.2)"
                              />
                              <circle
                                cx={pt.cx}
                                cy={pt.lineY}
                                r="4"
                                fill="#FFFFFF"
                                stroke="#A33D05"
                                strokeWidth="2.5"
                              />
                            </g>
                          );
                        })}
                      </svg>

                      {/* Bottom Column Labels Strip directly aligned with each bar */}
                      {combinedChartTab === 'daily_timeline' && (
                        <div
                          className="flex items-center gap-1 pt-1"
                          style={{
                            paddingLeft: `${plotLeft}px`,
                            paddingRight: `${plotRight}px`,
                          }}
                        >
                          {computedPts.map((pt) => (
                            <button
                              key={`col-lbl-${pt.id}`}
                              type="button"
                              onClick={() => {
                                if (pt.dateKey) {
                                  setActiveCombinedDate(pt.dateKey);
                                }
                              }}
                              style={{ width: `${colSlotW}px` }}
                              className={`py-1 px-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider text-center truncate transition-all cursor-pointer ${
                                pt.isFocused
                                  ? 'bg-gradient-to-r from-[#D65106] to-[#A33D05] text-white shadow-xs'
                                  : 'bg-[#FBF7F2] hover:bg-[#FEEAE2] dark:bg-[#211B16] border border-[#F8C8B6] dark:border-[#3E3731] text-[#6B2300] dark:text-slate-200'
                              }`}
                            >
                              {pt.bottomLabel}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom 12-Month Selector Bar (White + Pink + Purple Theme) */}
                  <div className="pt-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#924D32] dark:text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>
                        Klik Bulan untuk Menggabungkan / Memisahkan Data (
                        {activeYearStr}):
                      </span>
                      <span className="text-[#BE490C] dark:text-amber-300">
                        Aktif:{' '}
                        {effectiveCombinedMonths
                          .map((m) => formatMonthId(m))
                          .join(' + ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
                      {twelveMonthsData.map((mItem) => {
                        const isSelected = mItem.isSelected;
                        const hasData = mItem.hasData;

                        return (
                          <button
                            key={mItem.monthKey}
                            type="button"
                            disabled={!hasData}
                            onClick={() => {
                              if (!hasData) return;
                              const current = effectiveCombinedMonths;
                              if (isSelected) {
                                if (current.length > 1) {
                                  setSelectedCombinedMonths(
                                    current.filter(
                                      (item) => item !== mItem.monthKey
                                    )
                                  );
                                }
                              } else {
                                setSelectedCombinedMonths(
                                  [...current, mItem.monthKey].sort()
                                );
                              }
                            }}
                            className={`py-1.5 px-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider text-center transition-all ${
                              isSelected && hasData
                                ? 'bg-gradient-to-r from-[#D65106] to-[#A33D05] border-b-[2px] border-[#722600] text-white shadow-xs cursor-pointer'
                                : hasData
                                ? 'bg-[#FBF7F2] hover:bg-[#FEEAE2] dark:bg-[#26201B] border border-[#F8C8B6] dark:border-[#3E3731] text-[#6B2300] dark:text-slate-200 cursor-pointer'
                                : 'bg-slate-50 dark:bg-[#15100D] border border-slate-200/70 dark:border-[#2E2721] text-slate-400 dark:text-slate-600 cursor-not-allowed'
                            }`}
                          >
                            <div className="truncate">{mItem.label}</div>
                            {hasData && (
                              <div className="text-[8px] font-mono opacity-90 mt-0.5">
                                {mItem.dayCount}hr
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </MotionSection>
              );
            };

            return (
              <div className="space-y-4">
                {!summary ? (
                  <>
                    <EmptyStateCard
                      onUploadClick={() => {
                        setActiveTab('pengaturan');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    />
                    {pnlReportList.length > 0 && renderProfitChartSection()}
                    <BerandaProfitLossCard
                      report={berandaPnlReport}
                      monthCount={pnlReportList.length}
                      onOpenProfitLoss={(reportId) => {
                        if (reportId) setSelectedPnlMonth(reportId);
                        setActiveTab('labarugi');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      onUploadClick={() => {
                        setActiveTab('pengaturan');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      onOpenInfo={setActiveInfoKey}
                    />
                  </>
                ) : activeKeperluanPageId ? (
                  <KeperluanDetailPage
                    activeKeperluanId={activeKeperluanPageId}
                    mode={purposeRankMode}
                    onChangeMode={setPurposeRankMode}
                    onSelectKeperluanId={(id) => {
                      setActiveKeperluanPageId(id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onBackToBeranda={() => {
                      setActiveKeperluanPageId(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onOpenProductInCekBarang={(name) => {
                      setActiveKeperluanPageId(null);
                      handlePickProduct(name);
                    }}
                    onOpenDayInHarian={(date) => {
                      setActiveKeperluanPageId(null);
                      handleOpenDayInHarian(date);
                    }}
                    onOpenRangePicker={() => setIsRangePickerOpen(true)}
                    onChangeViewScope={(scope) => {
                      setViewScope(scope);
                      if (scope === 'day') setIsRangePickerOpen(false);
                    }}
                    onSelectDay={(date) => setSelectedDay(date)}
                    summary={summary}
                    data={data}
                    activeMonth={activeMonth}
                    activeDay={activeDay}
                    activeMonthDates={activeMonthDates}
                    viewScope={viewScope}
                  />
                ) : (
                  <>
                {(() => {
                  const totalUniqueProducts = Math.max(
                    1,
                    Object.keys(summary.productMap).length
                  );
                  const accuracyPct = Math.round(
                    (summary.pasProductCount / totalUniqueProducts) * 100
                  );
                  const activeDaysStat = summary.dailyStats.filter((d) =>
                    viewScope === 'month'
                      ? true
                      : summary.activeDates.includes(d.date)
                  );
                  const chartDays =
                    activeDaysStat.length > 0
                      ? activeDaysStat
                      : summary.dailyStats;

                  // Max value for Diverging Daily Chart (Lebih up, Kurang down)
                  const maxDailySideVal = Math.max(
                    1,
                    ...chartDays.map((d) =>
                      Math.max(Math.abs(d.negVal), Math.abs(d.posVal))
                    )
                  );

                  const selectedDailyBar =
                    chartDays.find((d) => d.date === activeBarDate) ??
                    (highlightedBarStat &&
                    chartDays.some((d) => d.date === highlightedBarStat.date)
                      ? highlightedBarStat
                      : chartDays[chartDays.length - 1] ?? null);

                  const worstMinusDay =
                    chartDays.length > 0
                      ? chartDays.reduce(
                          (worst, cur) =>
                            cur.negVal < worst.negVal ? cur : worst,
                          chartDays[0]
                        )
                      : null;

                  const bestPlusDay =
                    chartDays.length > 0
                      ? chartDays.reduce(
                          (best, cur) =>
                            cur.negVal + cur.posVal >
                            best.negVal + best.posVal
                              ? cur
                              : best,
                          chartDays[0]
                        )
                      : null;

                  const avgDailyNeg =
                    chartDays.length > 0
                      ? summary.totalNeg / chartDays.length
                      : 0;
                  const avgDailyPos =
                    chartDays.length > 0
                      ? summary.totalPos / chartDays.length
                      : 0;

                  // Rincian Per Keperluan (4 Operational Buckets: Bahan Makanan, Kemasan, Bahan Minuman, Operasional)
                  const keperluanBuckets = KEPERLUAN_GROUP_DEFINITIONS.map(
                    (def) => ({
                      ...def,
                      negVal: 0,
                      posVal: 0,
                      netVal: 0,
                      negItems: [] as (typeof summary.topDeficits)[number][],
                      posItems: [] as (typeof summary.topSurpluses)[number][],
                      totalCount: 0,
                    })
                  );
                  const bucketById = Object.fromEntries(
                    keperluanBuckets.map((b) => [b.id, b])
                  ) as Record<
                    KeperluanGroupMeta['id'],
                    (typeof keperluanBuckets)[number]
                  >;

                  for (const prod of Object.values(summary.productMap)) {
                    const gid = classifyItemKeperluanGroup(
                      prod.name,
                      prod.category,
                      prod.subcategory
                    );
                    const bucket = bucketById[gid];
                    bucket.totalCount++;
                    bucket.negVal += prod.negVal;
                    bucket.posVal += prod.posVal;
                    bucket.netVal += prod.netVal;
                    if (prod.negVal < -0.5) {
                      bucket.negItems.push(prod);
                    }
                    if (prod.posVal > 0.5) {
                      bucket.posItems.push(prod);
                    }
                  }

                  for (const b of keperluanBuckets) {
                    b.negItems.sort((a, c) => a.negVal - c.negVal);
                    b.posItems.sort((a, c) => c.posVal - a.posVal);
                  }

                  const totalKeperluanModeAbs =
                    keperluanBuckets.reduce(
                      (acc, b) =>
                        acc +
                        (purposeRankMode === 'neg'
                          ? Math.abs(b.negVal)
                          : Math.abs(b.posVal)),
                      0
                    ) || 1;

                  const sortedKeperluanBuckets = [...keperluanBuckets].sort(
                    (a, b) =>
                      purposeRankMode === 'neg'
                        ? Math.abs(b.negVal) - Math.abs(a.negVal)
                        : Math.abs(b.posVal) - Math.abs(a.posVal)
                  );

                  // Category Donut Breakdown
                  const donutColors = [
                    '#D65106',
                    '#6B6560',
                    '#95C747',
                    '#928573',
                    '#E15400',
                  ];
                  const topCategories = summary.categoryStats.slice(0, 5);
                  const totalCatAbs =
                    topCategories.reduce(
                      (acc, c) => acc + Math.abs(c.negVal) + Math.abs(c.posVal),
                      0
                    ) || 1;
                  let cumulativeDeg = 0;
                  const categorySlices = topCategories.map((c, idx) => {
                    const weight =
                      Math.abs(c.negVal) + Math.abs(c.posVal);
                    const pct = Math.max(
                      1,
                      Math.round((weight / totalCatAbs) * 100)
                    );
                    const deg = (weight / totalCatAbs) * 360;
                    const startDeg = cumulativeDeg;
                    cumulativeDeg += deg;
                    return {
                      category: c.category,
                      pct,
                      netVal: c.netVal,
                      negVal: c.negVal,
                      color: donutColors[idx % donutColors.length],
                      startDeg,
                      endDeg: cumulativeDeg,
                    };
                  });
                  const conicGradientStr =
                    categorySlices.length > 0
                      ? `conic-gradient(${categorySlices
                          .map(
                            (s) =>
                              `${s.color} ${s.startDeg.toFixed(1)}deg ${s.endDeg.toFixed(1)}deg`
                          )
                          .join(', ')})`
                      : 'conic-gradient(#D65106 0deg 360deg)';

                  const rankedItems = (
                    rankMode === 'neg'
                      ? summary.topDeficits
                      : summary.topSurpluses
                  ).slice(0, 5);
                  const totalRankedAbs =
                    (rankMode === 'neg'
                      ? Math.abs(summary.totalNeg)
                      : Math.abs(summary.totalPos)) || 1;

                  return (
                    <div className="space-y-4">
                      {/* V2 BERANDA HERO */}
                      {(() => {
                        const acc = summary.totalRowsCount ? Math.round((summary.totalPasRowsCount / summary.totalRowsCount) * 100) : 0;
                        const lastPnl = pnlReportList[pnlReportList.length - 1];
                        const worst = worstDay;
                        const topItem = summary.topDeficits[0];
                        const sign = (v: number) => (v < -0.5 ? '−' : v > 0.5 ? '+' : '');
                        return (
                          <>
                            <section className="v2-hero">
                              <div className="v2-hero-glow" />
                              <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                                <div className="min-w-0">
                                  <div className="v2-eyebrow">
                                    Ringkasan Outlet · {summary.branchName || 'Wizzmie'}
                                    <InfoButton guideKey="overview" onOpen={setActiveInfoKey} />
                                  </div>
                                  <div className={`v2-hero-num ${summary.netTotal < -0.5 ? 'v2-t-neg' : 'v2-t-pos'}`}>
                                    {sign(summary.netTotal)}{formatCompactRupiah(Math.abs(summary.netTotal))}
                                  </div>
                                  <p className="v2-hero-sub">
                                    Selisih stok bersih ·{' '}
                                    {viewScope === 'day' ? formatDateId(activeDay) : formatDateRangeFullLabel(activeRange.start, activeRange.end)}
                                  </p>
                                </div>
                                <div className="v2-controls">
                                  <div className="v2-seg">
                                    {(['range', 'day'] as ViewScope[]).map((sc) => (
                                      <button key={sc} type="button" className={viewScope === sc ? 'is-on' : ''} onClick={() => { setViewScope(sc); if (sc === 'day') setIsRangePickerOpen(false); }}>
                                        {sc === 'range' ? 'Rentang' : '1 Hari'}
                                      </button>
                                    ))}
                                  </div>
                                  <button type="button" className="v2-ghost" onClick={() => setIsRangePickerOpen(true)}>
                                    <CalendarRange className="w-4 h-4" /> Ubah Tanggal
                                  </button>
                                </div>
                              </div>
                            </section>

                            <div className="v2-kpis">
                              <button type="button" className="v2-kpi v2-neg text-left" onClick={() => setBerandaModal('neg')}>
                                <div className="v2-kpi-icon"><TrendingDown /></div>
                                <div className="v2-kpi-label">Kekurangan Stok</div>
                                <div className="v2-kpi-value">−{formatCompactRupiah(Math.abs(summary.totalNeg))}</div>
                                <div className="v2-kpi-sub">{summary.negProductCount} barang · ketuk detail</div>
                              </button>
                              <button type="button" className="v2-kpi v2-pos text-left" onClick={() => setBerandaModal('pos')}>
                                <div className="v2-kpi-icon"><TrendingUp /></div>
                                <div className="v2-kpi-label">Kelebihan Stok</div>
                                <div className="v2-kpi-value">+{formatCompactRupiah(summary.totalPos)}</div>
                                <div className="v2-kpi-sub">{summary.posProductCount} barang · ketuk detail</div>
                              </button>
                              <button type="button" className="v2-kpi v2-ok text-left" onClick={() => setBerandaModal('net')}>
                                <div className="v2-kpi-icon"><Scale /></div>
                                <div className="v2-kpi-label">Hasil Gabungan</div>
                                <div className="v2-kpi-value">{sign(summary.netTotal)}{formatCompactRupiah(Math.abs(summary.netTotal))}</div>
                                <div className="v2-kpi-sub">minus + lebih · ketuk detail</div>
                              </button>
                              <button type="button" className="v2-kpi v2-acc text-left" onClick={() => { setActiveKeperluanPageId(null); setActiveTab('barang'); }}>
                                <div className="v2-kpi-icon"><Check /></div>
                                <div className="v2-kpi-label">Akurasi Stok Pas</div>
                                <div className="v2-kpi-value">{acc}%</div>
                                <div className="v2-kpi-sub">{summary.pasProductCount} barang pas · buka Cek Barang</div>
                              </button>
                            </div>

                            <div className="v2-attn">
                              <button type="button" className="v2-attn-card" onClick={() => { if (worst) { setSelectedDay(worst.date); setViewScope('day'); setActiveTab('harian'); } }}>
                                <span className="v2-attn-tag v2-t-neg">Hari terburuk</span>
                                <b>{worst ? formatDateId(worst.date) : '—'}</b>
                                <small>{worst ? `−${formatCompactRupiah(Math.abs(worst.negVal))} kekurangan` : 'Belum ada data'}</small>
                              </button>
                              <button type="button" className="v2-attn-card" onClick={() => { if (topItem) { setSelectedProduct(topItem.name); setActiveTab('barang'); } }}>
                                <span className="v2-attn-tag v2-t-neg">Minus terbesar</span>
                                <b className="truncate">{topItem ? topItem.name : 'Tidak ada'}</b>
                                <small>{topItem ? `−${formatCompactRupiah(Math.abs(topItem.netVal))} · ${topItem.negDays} hari` : 'Semua aman'}</small>
                              </button>
                              <button type="button" className="v2-attn-card" onClick={() => setActiveTab(lastPnl ? 'labarugi' : 'pengaturan')}>
                                <span className="v2-attn-tag" style={{ color: 'var(--ember)' }}>Laba bersih</span>
                                <b>{lastPnl ? `${lastPnl.netProfit < 0 ? '−' : ''}${formatCompactRupiah(Math.abs(lastPnl.netProfit))}` : 'Belum upload'}</b>
                                <small>{lastPnl ? formatPnlPeriodRange(lastPnl) : 'Upload laporan Laba Rugi'}</small>
                              </button>
                            </div>
                          </>
                        );
                      })()}

                      {/* ROW 2: KURANG VS LEBIH HARIAN (7 cols, Jelas & Mudah Dipahami) + RINCIAN PER KEPERLUAN (5 cols, Horizontal Bars + Indikasi) */}
                      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
                        {/* Left (7 cols): KURANG VS LEBIH HARIAN — Diverging Atas (Hijau Lebih) & Bawah (Merah Kurang) + Kotak Info Tanggal */}
                        <MotionSection className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#18130F] border border-[#F8C8B6] dark:border-[#3E3731] p-4 sm:p-5 flex flex-col justify-between gap-3.5 shadow-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.14em] text-[#BE490C] dark:text-[#ACE25B]">
                                  GRAFIK KURANG VS LEBIH HARIAN
                                </h2>
                                <InfoButton
                                  guideKey="dailyChart"
                                  onOpen={setActiveInfoKey}
                                />
                              </div>
                              <p className="text-[11px] text-[#924D32] dark:text-[#BEB6AC] mt-0.5">
                                Batang <strong className="text-emerald-600 dark:text-emerald-400">Hijau ke atas = Stok Lebih (+)</strong> · Batang <strong className="text-rose-600 dark:text-rose-400">Merah ke bawah = Stok Kurang (−)</strong>. Ketuk tanggal untuk lihat angkanya.
                              </p>
                            </div>

                            <div className="inline-flex items-center gap-3 text-[11px] font-bold">
                              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                <span className="w-3 h-3 rounded-xs bg-emerald-500" />
                                <span>Lebih (+)</span>
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                                <span className="w-3 h-3 rounded-xs bg-rose-500" />
                                <span>Kurang (−)</span>
                              </span>
                            </div>
                          </div>

                          {/* Kotak Rincian Tanggal yang Dipilih */}
                          {selectedDailyBar && (
                            <div className="rounded-xl bg-[#FCF8F3] dark:bg-[#1F1914] border border-[#F8C8B6] dark:border-[#3E3731] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex items-center justify-between sm:justify-start gap-2.5">
                                <div className="px-2.5 py-1 rounded-lg bg-[#D65106] dark:bg-amber-400 text-white dark:text-slate-950 font-extrabold text-xs">
                                  {formatDateId(selectedDailyBar.date)}
                                </div>
                                <span className="text-xs font-semibold text-[#814730] dark:text-[#BEB6AC]">
                                  {selectedDailyBar.diffCount} barang selisih ·{' '}
                                  {selectedDailyBar.pasCount} barang pas
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums">
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 font-bold text-emerald-700 dark:text-emerald-300">
                                  Lebih: +{formatRupiah(selectedDailyBar.posVal)}
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 font-bold text-rose-700 dark:text-rose-300">
                                  Kurang: -{formatRupiah(selectedDailyBar.negVal)}
                                </span>
                                <span
                                  className={`px-2.5 py-1 rounded-lg border font-extrabold ${
                                    selectedDailyBar.negVal +
                                      selectedDailyBar.posVal <
                                    -0.5
                                      ? 'bg-rose-100/80 dark:bg-rose-500/20 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-200'
                                      : 'bg-emerald-100/80 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
                                  }`}
                                >
                                  Hasil:{' '}
                                  {selectedDailyBar.negVal +
                                    selectedDailyBar.posVal <
                                  -0.5
                                    ? `-${formatRupiah(selectedDailyBar.negVal + selectedDailyBar.posVal)}`
                                    : `+${formatRupiah(selectedDailyBar.negVal + selectedDailyBar.posVal)}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenDayInHarian(selectedDailyBar.date)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#2D2620] border border-[#F8C8B6] dark:border-amber-400/40 font-sans font-extrabold text-[#BE490C] dark:text-[#ACE25B] hover:underline cursor-pointer"
                                >
                                  Buka Barang →
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Diverging Up/Down Bar Chart Area */}
                          <div className="flex gap-2 items-stretch">
                            {/* Left Y-Axis Labels */}
                            <div className="flex flex-col justify-between py-1 text-[10px] font-mono font-bold tabular-nums select-none shrink-0 text-right pr-1">
                              <span className="text-emerald-600 dark:text-emerald-400">
                                +{formatCompactRupiah(maxDailySideVal)}
                              </span>
                              <span className="text-[#924D32] dark:text-[#BEB6AC]">
                                Rp 0
                              </span>
                              <span className="text-rose-600 dark:text-rose-400">
                                -{formatCompactRupiah(maxDailySideVal)}
                              </span>
                            </div>

                            {/* Scrollable Columns */}
                            <div className="flex-1 overflow-x-auto pb-1">
                              <div
                                className="flex items-stretch justify-between gap-1.5 px-1.5"
                                style={{
                                  minWidth: `${Math.max(280, chartDays.length * 32)}px`,
                                }}
                              >
                                {chartDays.map((day) => {
                                  const posRatio =
                                    Math.abs(day.posVal) / maxDailySideVal;
                                  const negRatio =
                                    Math.abs(day.negVal) / maxDailySideVal;
                                  const posPx =
                                    day.posVal > 0.5
                                      ? Math.max(6, Math.round(posRatio * 64))
                                      : 2;
                                  const negPx =
                                    day.negVal < -0.5
                                      ? Math.max(6, Math.round(negRatio * 64))
                                      : 2;
                                  const isSelected =
                                    selectedDailyBar?.date === day.date;
                                  const dayNet = day.negVal + day.posVal;

                                  return (
                                    <button
                                      key={day.date}
                                      type="button"
                                      onClick={() => setActiveBarDate(day.date)}
                                      onDoubleClick={() =>
                                        handleOpenDayInHarian(day.date)
                                      }
                                      title={`${formatDateId(day.date)}: Lebih +${formatRupiah(day.posVal)} | Kurang -${formatRupiah(day.negVal)}`}
                                      className={`group flex-1 min-w-[26px] rounded-xl py-1.5 px-0.5 flex flex-col items-center transition-all cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#FEEAE2] dark:bg-amber-400/15 ring-2 ring-[#D65106] dark:ring-amber-400'
                                          : 'hover:bg-[#FBF7F2] dark:hover:bg-[#26201B]/60'
                                      }`}
                                    >
                                      {/* Top Zone: Lebih (+) Green Bar growing UP from center line */}
                                      <div className="h-[68px] w-full flex flex-col justify-end items-center">
                                        {day.posVal > 0.5 && isSelected && (
                                          <span className="text-[8px] font-mono font-extrabold text-emerald-700 dark:text-emerald-300 mb-0.5 leading-none">
                                            +{formatCompactRupiah(day.posVal)}
                                          </span>
                                        )}
                                        <div
                                          className={`w-3.5 sm:w-4 rounded-t-md transition-all ${
                                            day.posVal > 0.5
                                              ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-xs'
                                              : 'bg-slate-200 dark:bg-slate-700'
                                          }`}
                                          style={{ height: `${posPx}px` }}
                                        />
                                      </div>

                                      {/* Zero Line Divider */}
                                      <div className="w-full h-[2px] bg-[#EAA88F] dark:bg-[#4C453F]" />

                                      {/* Bottom Zone: Kurang (-) Red Bar growing DOWN from center line */}
                                      <div className="h-[68px] w-full flex flex-col justify-start items-center">
                                        <div
                                          className={`w-3.5 sm:w-4 rounded-b-md transition-all ${
                                            day.negVal < -0.5
                                              ? 'bg-gradient-to-b from-rose-500 to-rose-600 shadow-xs'
                                              : 'bg-slate-200 dark:bg-slate-700'
                                          }`}
                                          style={{ height: `${negPx}px` }}
                                        />
                                        {day.negVal < -0.5 && isSelected && (
                                          <span className="text-[8px] font-mono font-extrabold text-rose-700 dark:text-rose-300 mt-0.5 leading-none">
                                            -{formatCompactRupiah(day.negVal)}
                                          </span>
                                        )}
                                      </div>

                                      {/* Date Number Badge */}
                                      <span
                                        className={`mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold tabular-nums ${
                                          isSelected
                                            ? 'bg-[#D65106] dark:bg-amber-400 text-white dark:text-slate-950'
                                            : dayNet < -0.5
                                            ? 'text-rose-700 dark:text-rose-300'
                                            : 'text-emerald-700 dark:text-emerald-300'
                                        }`}
                                      >
                                        {Number(day.date.slice(8))}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* 3 Quick Insight Pills Footer */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[#ECE7E2] dark:border-[#322B25] text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                if (worstMinusDay) {
                                  setActiveBarDate(worstMinusDay.date);
                                }
                              }}
                              className="text-left rounded-xl p-2.5 bg-rose-50/70 dark:bg-rose-500/10 border border-rose-200/80 dark:border-rose-500/25 hover:border-rose-400 transition-colors cursor-pointer"
                            >
                              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                                Hari Minus Terbesar
                              </div>
                              <div className="font-mono font-black text-rose-700 dark:text-rose-300 mt-0.5 tabular-nums">
                                {worstMinusDay
                                  ? `${formatDateId(worstMinusDay.date)} (-${formatCompactRupiah(worstMinusDay.negVal)})`
                                  : '-'}
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (bestPlusDay) {
                                  setActiveBarDate(bestPlusDay.date);
                                }
                              }}
                              className="text-left rounded-xl p-2.5 bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/25 hover:border-emerald-400 transition-colors cursor-pointer"
                            >
                              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                Hari Hasil Terbaik
                              </div>
                              <div className="font-mono font-black text-emerald-700 dark:text-emerald-300 mt-0.5 tabular-nums">
                                {bestPlusDay
                                  ? `${formatDateId(bestPlusDay.date)} (${
                                      bestPlusDay.negVal + bestPlusDay.posVal >=
                                      0
                                        ? '+'
                                        : '-'
                                    }${formatCompactRupiah(bestPlusDay.negVal + bestPlusDay.posVal)})`
                                  : '-'}
                              </div>
                            </button>

                            <div className="rounded-xl p-2.5 bg-[#FBF6F1] dark:bg-[#1F1914] border border-[#F8C8B6] dark:border-[#3E3731]">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-[#814730] dark:text-[#BEB6AC]">
                                Rata-rata Per Hari ({chartDays.length} hr)
                              </div>
                              <div className="font-mono font-bold text-[11px] mt-0.5 tabular-nums flex items-center gap-2">
                                <span className="text-rose-600 dark:text-rose-400">
                                  -{formatCompactRupiah(avgDailyNeg)}/hr
                                </span>
                                <span className="text-slate-400">·</span>
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  +{formatCompactRupiah(avgDailyPos)}/hr
                                </span>
                              </div>
                            </div>
                          </div>
                        </MotionSection>

                        {/* Right (5 cols): RINCIAN PER KEPERLUAN — Horizontal Bar Chart + Indikasi Penyebab (Bahan Makanan vs Kemasan vs Minuman vs Operasional) */}
                        <MotionSection className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#18130F] border border-[#F8C8B6] dark:border-[#3E3731] p-4 sm:p-5 flex flex-col justify-between gap-3 shadow-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.14em] text-[#BE490C] dark:text-[#ACE25B]">
                                RINCIAN PER KEPERLUAN
                              </h2>
                              <p className="text-[11px] text-[#924D32] dark:text-[#BEB6AC] mt-0.5">
                                Deteksi cepat sumber selisih: bahan makanan (waste/porsi) vs kemasan (salah input/hilang).
                              </p>
                            </div>

                            <div className="inline-flex items-center rounded-full border border-[#F8C8B6] dark:border-[#3E3731] bg-[#FBF6F1] dark:bg-[#17120E] p-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setPurposeRankMode('neg')}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer ${
                                  purposeRankMode === 'neg'
                                    ? 'wizzmie-pink-pill text-white'
                                    : 'text-[#814730] dark:text-slate-400'
                                }`}
                              >
                                Minus
                              </button>
                              <button
                                type="button"
                                onClick={() => setPurposeRankMode('pos')}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer ${
                                  purposeRankMode === 'pos'
                                    ? 'wizzmie-pink-pill text-white'
                                    : 'text-[#814730] dark:text-slate-400'
                                }`}
                              >
                                Lebih
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2.5 my-auto">
                            {sortedKeperluanBuckets.map((bucket) => {
                              const activeVal =
                                purposeRankMode === 'neg'
                                  ? bucket.negVal
                                  : bucket.posVal;
                              const activeItems =
                                purposeRankMode === 'neg'
                                  ? bucket.negItems
                                  : bucket.posItems;
                              const pct =
                                Math.abs(activeVal) > 0.5
                                  ? Math.min(
                                      100,
                                      Math.max(
                                        3,
                                        Math.round(
                                          (Math.abs(activeVal) /
                                            totalKeperluanModeAbs) *
                                            100
                                        )
                                      )
                                    )
                                  : 0;
                              return (
                                <button
                                  key={bucket.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveKeperluanPageId(bucket.id);
                                    window.scrollTo({
                                      top: 0,
                                      behavior: 'smooth',
                                    });
                                  }}
                                  className="group w-full text-left rounded-xl border border-[#FAD6C8] hover:border-[#D65106] dark:border-[#362F29] dark:hover:border-amber-400/70 bg-[#FDFAF6] hover:bg-[#F9F5F0] dark:bg-[#1E1813] dark:hover:bg-[#27201B] p-3 space-y-2 transition-all cursor-pointer shadow-2xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className="w-2.5 h-2.5 rounded-full shrink-0"
                                          style={{
                                            backgroundColor: bucket.barColor,
                                          }}
                                        />
                                        <span className="text-xs sm:text-sm font-extrabold text-[#451300] group-hover:text-[#BE490C] dark:text-white dark:group-hover:text-amber-300 truncate">
                                          {bucket.title}
                                        </span>
                                        <ChevronRight className="w-3.5 h-3.5 text-[#BE490C] dark:text-amber-300 opacity-75 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                      </div>
                                      <div className="text-[11px] font-medium text-[#924D32] dark:text-[#BEB6AC] mt-0.5">
                                        {purposeRankMode === 'neg'
                                          ? bucket.indicationNeg
                                          : bucket.indicationPos}
                                      </div>
                                    </div>

                                    <div className="text-right shrink-0 font-mono tabular-nums">
                                      <div
                                        className={`text-xs sm:text-sm font-black ${
                                          purposeRankMode === 'neg'
                                            ? 'text-rose-600 dark:text-rose-400'
                                            : 'text-emerald-600 dark:text-emerald-400'
                                        }`}
                                      >
                                        {purposeRankMode === 'neg'
                                          ? `-${formatRupiah(bucket.negVal)}`
                                          : `+${formatRupiah(bucket.posVal)}`}
                                      </div>
                                      <div className="text-[10px] font-bold text-[#814730] dark:text-[#BEB6AC]">
                                        {activeItems.length} barang ({pct}%)
                                      </div>
                                    </div>
                                  </div>

                                  {/* Horizontal Progress Bar */}
                                  <div className="w-full h-2.5 rounded-full bg-[#ECE7E2] dark:bg-[#2E2721] overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all duration-300"
                                      style={{
                                        width: `${pct}%`,
                                        backgroundColor: bucket.barColor,
                                      }}
                                    />
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          <div className="pt-2 border-t border-[#ECE7E2] dark:border-[#322B25] flex items-center justify-between text-[11px] text-[#924D32] dark:text-[#BEB6AC]">
                            <span>Ketuk keperluan untuk buka halaman rinciannya</span>
                            <span className="font-mono font-bold">
                              4 Kelompok Keperluan
                            </span>
                          </div>
                        </MotionSection>
                      </section>

                      {/* ROW 3: RINCIAN PER BAGIAN (5 cols) + BARANG PRIORITAS DICEK (7 cols) */}
                      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
                        {/* Col 1 (5 cols): RINCIAN PER BAGIAN (Donut Ring Chart + Right Percentage Legend) */}
                        <MotionSection className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#18130F] border border-[#F8C8B6] dark:border-[#3E3731] p-4 sm:p-5 flex flex-col justify-between shadow-xs">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.14em] text-[#BE490C] dark:text-[#ACE25B]">
                              RINCIAN PER BAGIAN
                            </h2>
                            <InfoButton
                              guideKey="categories"
                              onOpen={setActiveInfoKey}
                            />
                          </div>

                          <div className="my-auto py-2 grid grid-cols-12 gap-3 items-center">
                            {/* Left: Donut Chart with Center Total */}
                            <div className="col-span-6 flex items-center justify-center">
                              <div
                                className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full flex items-center justify-center shadow-inner"
                                style={{ background: conicGradientStr }}
                              >
                                <div className="w-21 h-21 sm:w-24 sm:h-24 rounded-full bg-white dark:bg-[#18130F] flex flex-col items-center justify-center text-center px-1.5 shadow-xs">
                                  <span className="text-xs sm:text-sm font-black font-mono text-[#451300] dark:text-white tabular-nums leading-tight">
                                    -{formatCompactRupiah(summary.totalNeg)}
                                  </span>
                                  <span className="text-[9px] font-semibold text-[#924D32] dark:text-[#BEB6AC] mt-0.5">
                                    Total Kurang
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Category Legend with Percentages */}
                            <div className="col-span-6 space-y-2">
                              {categorySlices.map((slice) => (
                                <button
                                  key={slice.category}
                                  type="button"
                                  onClick={() => {
                                    setCategoryFilter(slice.category);
                                    setActiveTab('harian');
                                    window.scrollTo({
                                      top: 0,
                                      behavior: 'smooth',
                                    });
                                  }}
                                  className="w-full flex items-center justify-between gap-1.5 text-left text-xs hover:opacity-80 transition-opacity cursor-pointer"
                                >
                                  <span className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: slice.color }}
                                    />
                                    <span className="font-semibold text-[#451300] dark:text-slate-200 truncate">
                                      {slice.category}
                                    </span>
                                  </span>
                                  <span className="font-mono font-bold text-[#814730] dark:text-[#BEB6AC] tabular-nums shrink-0">
                                    {slice.pct}%
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[#ECE7E2] dark:border-[#322B25] flex items-center justify-between text-[11px] text-[#924D32] dark:text-[#BEB6AC]">
                            <span>Ketuk bagian untuk filter harian</span>
                            <span className="font-mono font-bold">
                              {summary.categoryStats.length} Bagian
                            </span>
                          </div>
                        </MotionSection>

                        {/* Col 2 (7 cols): BARANG PRIORITAS DICEK (5 Horizontal Progress Bars + View All Link) */}
                        <MotionSection className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#18130F] border border-[#F8C8B6] dark:border-[#3E3731] p-4 sm:p-5 flex flex-col justify-between shadow-xs">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div>
                              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.14em] text-[#BE490C] dark:text-[#ACE25B] truncate">
                                BARANG PRIORITAS DICEK (TOP 5)
                              </h2>
                              <p className="text-[11px] text-[#924D32] dark:text-[#BEB6AC] mt-0.5">
                                5 barang dengan nilai selisih Rupiah terbesar pada periode ini.
                              </p>
                            </div>
                            <div className="inline-flex items-center rounded-full border border-[#F8C8B6] dark:border-[#3E3731] bg-[#FBF6F1] dark:bg-[#17120E] p-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setRankMode('neg')}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer ${
                                  rankMode === 'neg'
                                    ? 'wizzmie-pink-pill text-white'
                                    : 'text-[#814730] dark:text-slate-400'
                                }`}
                              >
                                Minus
                              </button>
                              <button
                                type="button"
                                onClick={() => setRankMode('pos')}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer ${
                                  rankMode === 'pos'
                                    ? 'wizzmie-pink-pill text-white'
                                    : 'text-[#814730] dark:text-slate-400'
                                }`}
                              >
                                Lebih
                              </button>
                            </div>
                          </div>

                          {rankedItems.length === 0 ? (
                            <p className="text-xs text-[#924D32] dark:text-[#BEB6AC] py-8 text-center">
                              Tidak ada barang selisih pada kategori ini.
                            </p>
                          ) : (
                            <div className="space-y-2.5 my-auto py-1">
                              {rankedItems.map((item, idx) => {
                                const sharePct = Math.min(
                                  100,
                                  Math.max(
                                    6,
                                    Math.round(
                                      (Math.abs(item.netVal) / totalRankedAbs) *
                                        100
                                    )
                                  )
                                );
                                return (
                                  <button
                                    key={item.name}
                                    type="button"
                                    onClick={() => handlePickProduct(item.name)}
                                    className="w-full grid grid-cols-12 items-center gap-2 text-left text-xs hover:bg-[#FBF7F2] dark:hover:bg-[#26201B]/60 rounded-xl py-1.5 px-2 transition-colors cursor-pointer"
                                  >
                                    <span className="col-span-5 font-semibold text-[#451300] dark:text-slate-100 truncate flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-md bg-[#FEE7DE] dark:bg-amber-400/15 text-[#BE490C] dark:text-amber-300 font-mono text-[10px] font-extrabold flex items-center justify-center shrink-0">
                                        {idx + 1}
                                      </span>
                                      <span className="truncate">
                                        {item.name}
                                      </span>
                                    </span>
                                    <span
                                      className={`col-span-3 font-mono font-bold text-right tabular-nums ${
                                        rankMode === 'neg'
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : 'text-emerald-600 dark:text-emerald-400'
                                      }`}
                                    >
                                      {rankMode === 'neg' ? '-' : '+'}
                                      {formatRupiah(item.netVal)}
                                    </span>
                                    <div className="col-span-3 h-2.5 rounded-full bg-[#ECE7E2] dark:bg-[#2E2721] overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          rankMode === 'neg'
                                            ? 'bg-gradient-to-r from-[#F96213] to-[#BE490C] dark:from-rose-500 dark:to-rose-400'
                                            : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                                        }`}
                                        style={{ width: `${sharePct}%` }}
                                      />
                                    </div>
                                    <span className="col-span-1 font-mono text-[11px] font-bold text-right text-[#814730] dark:text-[#BEB6AC] tabular-nums">
                                      {sharePct}%
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <div className="pt-2 mt-1 border-t border-[#ECE7E2] dark:border-[#322B25] flex items-center justify-between">
                            <span className="text-[11px] text-[#924D32] dark:text-[#BEB6AC]">
                              Ketuk barang untuk lihat riwayat tanggalnya
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('barang');
                                window.scrollTo({
                                  top: 0,
                                  behavior: 'smooth',
                                });
                              }}
                              className="inline-flex items-center gap-1 text-xs font-extrabold text-[#BE490C] dark:text-[#ACE25B] hover:underline cursor-pointer"
                            >
                              <span>
                                Lihat Semua Barang ({totalUniqueProducts})
                              </span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </MotionSection>
                      </section>

                      {/* ROW 4: GRAFIK KEUNTUNGAN (Dominant White Surface · Pink & Purple Wizzmie Theme · Net Sales Based on Upload Dates) */}
                      {renderProfitChartSection()}
                    </div>
                  );
                })()}

                {/* Informasi Menu Laba Rugi */}
                <BerandaProfitLossCard
                  report={berandaPnlReport}
                  monthCount={pnlReportList.length}
                  onOpenProfitLoss={(reportId) => {
                    if (reportId) setSelectedPnlMonth(reportId);
                    setActiveTab('labarugi');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onUploadClick={() => {
                    setActiveTab('pengaturan');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onOpenInfo={setActiveInfoKey}
                />
                  </>
                )}
              </div>
            );
          })()}

        {/* PAGE 2: LAPORAN HARIAN */}
        {activeTab === 'harian' && (
          <div className="space-y-5">
            {!summary ? (
              <EmptyStateCard
                onUploadClick={() => {
                  setActiveTab('pengaturan');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            ) : (
              <HarianV2
                summary={summary}
                data={data}
                activeMonth={activeMonth}
                allMonths={allMonths}
                viewScope={viewScope}
                activeDay={activeDay}
                activeRange={activeRange}
                onSetScope={(sc) => { setViewScope(sc); if (sc === 'day') setIsRangePickerOpen(false); }}
                onSelectDay={(d) => setSelectedDay(d)}
                onSelectMonth={(m) => handleSelectMonth(m)}
                onOpenRangePicker={() => setIsRangePickerOpen(true)}
                onOpenInfo={(k) => setActiveInfoKey(k)}
              />
            )}
          </div>
        )}

        {/* PAGE 4: CEK BARANG */}
        {activeTab === 'barang' && (
          <div className="space-y-5">
            {!summary ? (
              <EmptyStateCard
                onUploadClick={() => {
                  setActiveTab('pengaturan');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            ) : (
              <BarangV2
                summary={summary}
                data={data}
                activeMonth={activeMonth}
                allMonths={allMonths}
                viewScope={viewScope}
                activeDay={activeDay}
                activeRange={activeRange}
                onSetScope={(sc) => { setViewScope(sc); if (sc === 'day') setIsRangePickerOpen(false); }}
                onSelectDay={(d) => setSelectedDay(d)}
                onSelectMonth={(m) => handleSelectMonth(m)}
                onOpenRangePicker={() => setIsRangePickerOpen(true)}
                onOpenInfo={(k) => setActiveInfoKey(k)}
                selected={effectiveSelectedProduct}
                onSelect={(n) => setSelectedProduct(n)}
              />
            )}
          </div>
        )}

        {/* PAGE 5: PENGATURAN (UPLOAD TERPISAH: 1. STOCK OPNAME & 2. PROFIT LOSS CONSOLIDATION) */}
        {activeTab === 'pengaturan' && (
          <div className="v2-grid">
            <section className="v2-hero v2-span-full">
              <div className="v2-hero-glow" />
              <div className="relative">
                <div className="v2-eyebrow">Pusat Data</div>
                <div className="v2-hero-num" style={{ fontSize: 'clamp(2rem,6vw,3.6rem)' }}>Upload &amp; kelola laporan</div>
                <p className="v2-hero-sub">{allMonths.length} bulan stok · {pnlReportList.length} periode laba rugi tersimpan di perangkat ini</p>
              </div>
            </section>

            {[
              { key: 'stok', title: 'Stock Opname', sub: 'File Stock Opname Detail Report (.xlsx/.xls). Tanggal dibaca otomatis dari kolom Stock Opname Date. Tanggal yang sama diperbarui tanpa dobel.', icon: <FileSpreadsheet className="w-6 h-6" />, guide: 'upload' as InfoGuideKey, open: () => fileInputRef.current?.click(), drop: (f: FileList) => void handleStockFiles(f) },
              { key: 'pnl', title: 'Laba Rugi', sub: 'File Profit Loss Consolidation (.xlsx/.xls). Setelah dipilih muncul pop-up untuk menentukan tanggal & bulan periodenya.', icon: <Coins className="w-6 h-6" />, guide: 'profitLoss' as InfoGuideKey, open: () => pnlFileInputRef.current?.click(), drop: (f: FileList) => void handlePnlFiles(f) },
            ].map((u) => (
              <section
                key={u.key}
                className="v2-drop"
                role="button"
                tabIndex={0}
                onClick={u.open}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('is-over'); }}
                onDragLeave={(e) => e.currentTarget.classList.remove('is-over')}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('is-over'); if (e.dataTransfer.files?.length) u.drop(e.dataTransfer.files); }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="v2-drop-icon">{u.icon}</span>
                  <span onClick={(e) => e.stopPropagation()}><InfoButton guideKey={u.guide} onOpen={setActiveInfoKey} /></span>
                </div>
                <h3 className="v2-drop-title">{u.title}</h3>
                <p className="v2-drop-sub">{u.sub}</p>
                <span className="wizzmie-pink-pill inline-flex items-center gap-2 px-5 py-2.5 text-sm mt-auto self-start">
                  <Upload className="w-4 h-4" /> Pilih atau tarik file ke sini
                </span>
              </section>
            ))}

            <section className="v2-panel">
              <header className="v2-panel-head"><h3>Tampilan</h3></header>
              <button type="button" className="v2-theme" onClick={() => setIsDark((prev) => !prev)}>
                <span className="v2-kpi-icon" style={{ ['--k' as string]: 'var(--ember)' }}>{isDark ? <Moon /> : <Sun />}</span>
                <span className="flex-1 text-left"><b className="block">{isDark ? 'Midnight Ember' : 'Terang'}</b><small>Ketuk untuk ganti ke {isDark ? 'tema terang' : 'Midnight Ember'}</small></span>
                <span className={`v2-switch ${isDark ? 'is-on' : ''}`}><i /></span>
              </button>
            </section>

            {lastUpload && (
              <section className="v2-panel v2-span-full v2-success">
                <header className="v2-panel-head flex-wrap">
                  <h3><Check className="w-4 h-4 inline" /> Upload Stock Opname berhasil</h3>
                  <button type="button" className="v2-ghost" onClick={() => setActiveTab('harian')}>Lihat di Harian <ArrowRight className="w-4 h-4" /></button>
                </header>
                <p className="text-sm" style={{ color: 'var(--v2-mute)' }}>
                  <b style={{ color: 'var(--v2-fg)' }}>{lastUpload.totalRows} catatan</b> · {lastUpload.uniqueProducts} jenis barang · {lastUpload.diffRows} selisih · {lastUpload.pasRows} pas → {lastUpload.monthsAffected.map(formatMonthId).join(', ')}
                </p>
                <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
                  <div className="v2-cat"><b className="v2-t-pos">Tanggal baru ({lastUpload.addedDates.length})</b><small className="block mt-1">{lastUpload.addedDates.length ? lastUpload.addedDates.map(formatDateId).join(', ') : 'Tidak ada tanggal baru.'}</small></div>
                  <div className="v2-cat"><b style={{ color: 'var(--ember)' }}>Diperbarui ({lastUpload.updatedDates.length})</b><small className="block mt-1">{lastUpload.updatedDates.length ? lastUpload.updatedDates.map(formatDateId).join(', ') : 'Tidak ada yang diperbarui.'}</small></div>
                </div>
              </section>
            )}

            <section className="v2-panel v2-span-full lg:col-span-1">
              <header className="v2-panel-head"><h3>Bulan Stok Tersimpan</h3><span>{allMonths.length}</span></header>
              <div className="flex flex-col gap-2">
                {allMonths.map((m) => (
                  <button key={m} type="button" className="v2-row" onClick={() => { handleSelectMonth(m); setActiveTab('harian'); }}>
                    <span className="v2-row-badge">{m.slice(5)}</span>
                    <span className="flex-1 text-left"><b className="block">{formatMonthId(m)}</b><small>{monthCounts[m]} hari tersimpan</small></span>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>
                ))}
                {!allMonths.length && <div className="v2-empty">Belum ada data stok.</div>}
              </div>
            </section>

            <section className="v2-panel v2-span-2">
              <header className="v2-panel-head"><h3>Periode Laba Rugi Tersimpan</h3><span>{pnlReportList.length}</span></header>
              <div className="flex flex-col gap-2">
                {pnlReportList.map((rep) => {
                  const daysCount = getPnlPeriodDays(rep);
                  const perDay = rep.netSales / Math.max(1, daysCount);
                  return (
                    <div key={rep.id} className="v2-row">
                      <span className="v2-row-badge">{daysCount}h</span>
                      <span className="flex-1 min-w-0">
                        <b className="block truncate">{formatPnlPeriodRange(rep)} <small>· {formatMonthId(rep.monthKey)}{rep.fileName ? ` · ${rep.fileName}` : ''}</small></b>
                        <small>Net Sales <span className="v2-t-pos">{formatSignedRupiah(rep.netSales)}</span> ({formatSignedRupiah(perDay)}/hari) · Net Profit <b>{formatSignedRupiah(rep.netProfit)}</b></small>
                      </span>
                      <button type="button" className="v2-ghost" onClick={() => { setSelectedPnlMonth(rep.id); setActiveTab('labarugi'); }}>Buka</button>
                      <button type="button" className="v2-ghost v2-t-neg" onClick={() => handleDeletePnlMonth(rep.id)}>Hapus</button>
                    </div>
                  );
                })}
                {!pnlReportList.length && <div className="v2-empty">Belum ada laporan laba rugi.</div>}
              </div>
            </section>
          </div>
        )}

        {/* PAGE: LABA RUGI (Profit Loss, % dari Net Sales) */}
        {activeTab === 'labarugi' && (
          <ProfitLossView
            pnlData={pnlData}
            activeMonth={selectedPnlMonth}
            onSelectMonth={setSelectedPnlMonth}
            onDeleteMonth={handleDeletePnlMonth}
            onOpenInfo={setActiveInfoKey}
          />
        )}
      </main>
      </div>

      {/* Pop-up Pemilihan Tanggal & Bulan setelah Upload Profit Loss Consolidation */}
      <PnlPeriodPickerModal
        item={pendingPnlQueue[0] ?? null}
        queueIndex={Math.max(
          0,
          pendingPnlBatchTotal - pendingPnlQueue.length
        )}
        queueTotal={Math.max(1, pendingPnlBatchTotal)}
        existingPnlData={pnlData}
        defaultMonthKey={activeMonth || pnlMonths[pnlMonths.length - 1] || '2026-11'}
        onConfirm={handleConfirmPnlPeriod}
        onCancel={handleCancelPnlPeriod}
      />

      {/* Mobile floating dock */}
      <nav aria-label="Menu utama" className="md:hidden fixed bottom-3 left-3 right-3 z-30 wz-navbar">
        <div className="grid grid-cols-5 h-16 p-1.5 gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                onClick={() => {
                  setActiveKeperluanPageId(null);
                  setActiveTab(item.id);
                }}
                className={`wz-dock-item ${isActive ? 'is-active' : ''}`}
              >
                {item.icon}
                <span className="text-[10px] leading-none truncate max-w-full">{item.mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Global Date Range Pop-up Modal (Copied from Menu Pengaturan Period Picker) */}
      {activeMonth && (
        <DateRangePicker
          monthKey={activeMonth}
          allMonths={allMonths}
          onSelectMonth={(m) => {
            handleSelectMonth(m);
            setCategoryFilter('ALL');
            setPurposeFilter('ALL');
          }}
          availableDates={activeMonthDates}
          allAvailableDates={allDates}
          rangeStart={viewScope === 'day' && activeDay ? activeDay : activeRange.start}
          rangeEnd={viewScope === 'day' && activeDay ? activeDay : activeRange.end}
          isOpen={isRangePickerOpen}
          onOpenChange={setIsRangePickerOpen}
          onConfirm={(start, end) => {
            const targetMonth = start.slice(0, 7);
            if (targetMonth && targetMonth !== activeMonth) {
              setSelectedMonth(targetMonth);
              setCategoryFilter('ALL');
              setPurposeFilter('ALL');
            }
            setDateRange({ start, end });
            if (start === end) {
              setSelectedDay(start);
            }
            setViewScope('range');
            setIsRangePickerOpen(false);
          }}
        />
      )}

      {/* Global Info Guide Modal */}
      <InfoDialog
        guideKey={activeInfoKey}
        onClose={() => setActiveInfoKey(null)}
      />

      {/* Beranda Detail Modals (Kekurangan / Kelebihan / Hasil Gabungan) */}
      <BerandaDetailModal
        modalType={berandaModal}
        onChangeModalType={setBerandaModal}
        onClose={() => setBerandaModal(null)}
        onOpenProductInCekBarang={(name) => {
          setBerandaModal(null);
          handlePickProduct(name);
        }}
        onOpenDayInHarian={(date) => {
          setBerandaModal(null);
          handleOpenDayInHarian(date);
        }}
        summary={summary}
        data={data}
        activeMonth={activeMonth}
        activeDay={activeDay}
        viewScope={viewScope}
      />

      {/* Global Premium AI Chat Floating Button & Pop-up (Reads All Menus & App Features) */}
      <GlobalAiChatWidget
        activeTab={activeTab}
        viewScope={viewScope}
        activeMonth={activeMonth}
        activeDay={activeDay}
        activeRange={activeRange}
        selectedProduct={selectedProduct}
        summary={summary}
        data={data}
        pnlData={pnlData}
        selectedPnlMonth={selectedPnlMonth}
      />
      </div>
    </LenisGsapProvider>
  );
}

function EmptyStateCard({
  onUploadClick,
}: {
  onUploadClick: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <MotionSection className="surface-3d rounded-3xl p-6 sm:p-8 lg:p-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
          <div className="space-y-2.5">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white text-balance">
              <GsapWordTitle text="Pantau Stok Gudang Jadi Lebih Gampang" />
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
              Upload file Excel stok opname harian Anda. Aplikasi langsung menghitung mana barang yang kurang, mana yang lebih, dan membantu mengecek kemungkinan salah hitung dengan bahasa sederhana.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onUploadClick}
              className="btn-3d-primary px-5 py-2.5 text-sm font-semibold rounded-xl flex items-center gap-2 min-h-[44px] whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload di Menu Pengaturan</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50 via-white to-sky-50 dark:from-[#1D1712] dark:via-[#221C17] dark:to-[#0E0A08] border border-slate-200 dark:border-[#352E28] shadow-[0_12px_28px_-12px_rgba(149,199,71,0.22)] min-h-[220px]">
          {!imgFailed ? (
            <img
              src={heroInventory3d}
              alt="Ilustrasi 3D rak penyimpanan stok produksi / operasional dan tablet pemantau"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-amber-600 dark:text-amber-400">
              <PackageSearch className="w-14 h-14 opacity-75" />
            </div>
          )}
        </div>
      </div>
    </MotionSection>
  );
}

function ReadableStockRow({
  title,
  subtitle,
  dateLabel,
  defaultExpanded = false,
  meta,
  onTitleClick,
}: {
  title: string;
  subtitle?: string;
  dateLabel?: string;
  defaultExpanded?: boolean;
  meta: ConvertedStockRow;
  onTitleClick?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isFormulaOpen, setIsFormulaOpen] = useState(false);
  const { row } = meta;
  const sysQty = row[2];
  const opQty = row[3];
  const diffQty = row[4];
  const valUnit = row[5];
  const diffVal = row[6];
  const unit = row[1];
  const category = row[8];
  const productCode = row[13];
  const subcategory = row[14];

  const state =
    diffQty < -1e-9 || diffVal < -0.5
      ? 'neg'
      : diffQty > 1e-9 || diffVal > 0.5
      ? 'pos'
      : 'eq';
  const itemSpec = getItemPackagingSpec(row[0]);

  const selisihDetailText =
    state === 'eq' ? '' : formatCompactContainerDiff(diffQty, unit, row[0]);

  const subtitleText =
    subtitle ??
    ([
      productCode ? `Kode: ${productCode}` : '',
      category
        ? subcategory && subcategory !== category
          ? `${category} / ${subcategory}`
          : category
        : '',
    ]
      .filter(Boolean)
      .join(' · ') ||
      'Stok Opname Harian');

  const packagingDisplay = itemSpec?.specText || '-';

  const outerFileDiff =
    state === 'eq'
      ? `0 ${unit}`
      : formatOuterContainerDiff(diffQty, unit, row[0], meta);

  const fileDateSummaryLine = dateLabel
    ? `${dateLabel} : Di file ${outerFileDiff}`
    : `Di file ${outerFileDiff}`;

  return (
    <>
      <article
        className="bg-white dark:bg-[#241E19] border border-[#F8C8B6] dark:border-[#3E3731] rounded-2xl overflow-hidden shadow-sm transition-all duration-200"
        data-purpose="inventory-item"
      >
        <div className="p-3.5 sm:p-4">
          {/* Top Row: Product Name & Diff Status Tag */}
          <div className={`flex justify-between items-start gap-2 ${isExpanded ? 'mb-2.5' : ''}`}>
            <div className="pr-2 min-w-0">
              {onTitleClick ? (
                <button
                  type="button"
                  onClick={onTitleClick}
                  className="text-sm sm:text-[15px] font-bold text-[#451300] dark:text-[#FBF6F1] hover:text-[#BE490C] dark:hover:text-[#ACE25B] leading-snug text-left break-words cursor-pointer"
                >
                  {title}
                </button>
              ) : (
                <h2 className="text-sm sm:text-[15px] font-bold text-[#451300] dark:text-[#FBF6F1] leading-snug break-words">
                  {title}
                </h2>
              )}
              <span className="block text-[10px] sm:text-[11px] text-[#924D32] dark:text-[#BEB6AC] mt-0.5">
                {subtitleText}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsFormulaOpen(true)}
              title="Ketuk untuk lihat rumus lengkap selisih"
              className="text-right shrink-0 tabular-nums rounded-lg px-1.5 py-1 -mr-1.5 -mt-1 hover:bg-[#FAF6F1] dark:hover:bg-[#312A25]/70 transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-end space-x-1.5">
                <span
                  className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full leading-none tracking-wide ${
                    state === 'neg'
                      ? 'bg-rose-500 dark:bg-[#FF5B62] text-white'
                      : state === 'pos'
                      ? 'bg-emerald-500 dark:bg-[#16D6A0] text-white dark:text-[#140F0B]'
                      : 'bg-[#ECE7E2] dark:bg-[#312A25] text-[#6B2300] dark:text-[#BEB6AC]'
                  }`}
                >
                  {state === 'neg' ? 'MINUS' : state === 'pos' ? 'LEBIH' : 'PAS'}
                </span>
                <span
                  className={`text-xs sm:text-sm font-bold group-hover:underline ${
                    state === 'neg'
                      ? 'text-rose-600 dark:text-[#FF5B62]'
                      : state === 'pos'
                      ? 'text-emerald-600 dark:text-[#16D6A0]'
                      : 'text-[#814730] dark:text-[#BEB6AC]'
                  }`}
                >
                  {formatQty(Math.abs(diffQty))} {unit}
                </span>
              </div>
              <div
                className={`text-[11px] sm:text-xs font-semibold mt-0.5 tracking-tight font-mono ${
                  state === 'neg'
                    ? 'text-rose-600 dark:text-[#FF5B62]'
                    : state === 'pos'
                    ? 'text-emerald-600 dark:text-[#16D6A0]'
                    : 'text-[#814730] dark:text-[#BEB6AC]'
                }`}
              >
                {state === 'neg'
                  ? `- ${formatRupiah(diffVal)}`
                  : state === 'pos'
                  ? `+ ${formatRupiah(diffVal)}`
                  : 'Rp 0'}
              </div>
            </button>
          </div>

          {/* Expanded Section: Di Sistem ESB vs Hitungan Gudang + Quick Metrics Row */}
          {isExpanded && (
            <>
              <div className="grid grid-cols-2 gap-2 bg-[#FBF6F1] dark:bg-[#1C1611] p-2.5 rounded-xl border border-[#F6D6C9] dark:border-[#3E3731]/60 text-xs tabular-nums">
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-4 h-4 text-[#BE490C] dark:text-[#C2B4A1] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#924D32] dark:text-[#BEB6AC] leading-tight">
                      Di Sistem ESB
                    </p>
                    <p className="font-bold text-[#451300] dark:text-[#FBF6F1] text-xs sm:text-[13px] font-mono mt-0.5">
                      {formatQty(sysQty)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 border-l border-[#F6CFC0] dark:border-[#3E3731]/50 pl-2.5">
                  <svg
                    className="w-4 h-4 text-[#BE490C] dark:text-[#C2B4A1] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#924D32] dark:text-[#BEB6AC] leading-tight">
                      Hitungan Gudang
                    </p>
                    <p className="font-bold text-[#451300] dark:text-[#FBF6F1] text-xs sm:text-[13px] font-mono mt-0.5">
                      {formatQty(opQty)} {unit}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 pt-2.5 mt-2.5 border-t border-[#F6D8CC] dark:border-[#3E3731]/60 text-xs tabular-nums">
              <div className="col-span-5 flex items-center space-x-1.5 min-w-0">
                <svg
                  className="w-3.5 h-3.5 text-[#BE490C] dark:text-[#ACE25B] shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
                <div className="min-w-0">
                  <p className="text-[10px] text-[#924D32] dark:text-[#BEB6AC] leading-tight">
                    Harga / Unit
                  </p>
                  <p className="font-bold text-[#451300] dark:text-[#FBF6F1] text-[11px] sm:text-xs font-mono mt-0.5 whitespace-nowrap">
                    {valUnit > 0 ? formatRupiah(valUnit, false) : '-'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFormulaOpen(true)}
                title="Ketuk untuk lihat rincian rumus selisih"
                className="col-span-7 flex items-center space-x-1.5 border-l border-[#F6CFC0] dark:border-[#3E3731]/50 pl-2 min-w-0 text-left rounded-lg py-0.5 -my-0.5 hover:bg-[#FAF6F1] dark:hover:bg-[#312A25]/70 transition-colors cursor-pointer group"
              >
                <svg
                  className="w-3.5 h-3.5 text-[#BE490C] dark:text-[#C2B4A1] shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-[#924D32] dark:text-[#BEB6AC] leading-tight">
                    Selisih
                  </p>
                  <p
                    className={`font-bold text-[11px] sm:text-xs font-mono mt-0.5 min-h-[16px] whitespace-nowrap group-hover:underline ${
                      state === 'neg'
                        ? 'text-rose-600 dark:text-[#FF5B62]'
                        : state === 'pos'
                        ? 'text-emerald-600 dark:text-[#16D6A0]'
                        : 'text-[#814730] dark:text-[#BEB6AC]'
                    }`}
                  >
                    {selisihDetailText || 'Pas (0)'}
                  </p>
                </div>
              </button>
              </div>
            </>
          )}
        </div>

        {/* Disclosed Metadata Section */}
        {isExpanded && (
          <div
            className="bg-[#FDF8F3] dark:bg-[#312A25]/50 border-t border-[#F6D8CC] dark:border-[#3E3731] px-3.5 py-2.5 space-y-2 text-[11px]"
            data-purpose="item-expanded-metadata"
          >
            <div>
              <span className="block text-[9px] text-[#924D32] dark:text-[#BEB6AC]/80">
                Kemasan / Konversi:
              </span>
              <span className="text-[#451300] dark:text-[#FBF6F1] font-medium">
                {packagingDisplay}
              </span>
            </div>

            <div className="pt-2 border-t border-[#F6D8CC] dark:border-[#3E3731]/60 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] text-[#924D32] dark:text-[#BEB6AC] tabular-nums font-mono">
                {fileDateSummaryLine}
              </span>
              <button
                type="button"
                onClick={() => setIsFormulaOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEEAE2] hover:bg-[#FED6C7] dark:bg-[#C2B4A1]/15 dark:hover:bg-[#C2B4A1]/25 border border-[#FEBFA8] dark:border-[#C2B4A1]/30 text-[10px] font-bold text-[#8B3202] dark:text-[#C2B4A1] transition-colors cursor-pointer"
              >
                <span>Klik untuk rincian rumus</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Toggle Button (Lihat Detail / Tutup Detail) */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full py-1.5 px-3 bg-[#F7F3EE] hover:bg-[#ECE8E3] dark:bg-[#29221D] dark:hover:bg-[#312A25]/80 flex items-center justify-center space-x-1.5 text-[11px] text-[#672200] dark:text-[#BEB6AC] font-semibold border-t border-[#F6D8CC] dark:border-[#3E3731] transition-colors cursor-pointer"
          data-purpose="detail-toggle-button"
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

      {isFormulaOpen && (
        <SelisihFormulaModal
          meta={meta}
          dateLabel={dateLabel}
          outerFileDiff={outerFileDiff}
          selisihDetailText={selisihDetailText}
          onClose={() => setIsFormulaOpen(false)}
        />
      )}
    </>
  );
}

function SelisihFormulaModal({
  meta,
  dateLabel,
  outerFileDiff,
  selisihDetailText,
  onClose,
}: {
  meta: ConvertedStockRow;
  dateLabel?: string;
  outerFileDiff: string;
  selisihDetailText: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const b = useMemo(() => buildSelisihFormulaBreakdown(meta), [meta]);
  const signSymbol = b.state === 'neg' ? '-' : b.state === 'pos' ? '+' : '';
  const statusWord =
    b.state === 'neg'
      ? 'MINUS (Stok Kurang)'
      : b.state === 'pos'
      ? 'LEBIH (Stok Lebih)'
      : 'PAS (Sesuai)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Rincian Rumus Selisih ${b.productName}`}
      className="s3-modal fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl bg-white dark:bg-[#16110D] border border-slate-200 dark:border-[#3E3731] rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col shadow-2xl"
      >
        {/* Premium Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200/80 dark:border-[#3E3731] bg-slate-50/90 dark:bg-[#120D0A] flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/35 text-amber-700 dark:text-[#ACE25B]">
                Rincian Rumus Perhitungan
              </span>
              {dateLabel && (
                <span className="text-xs font-semibold text-slate-500 dark:text-[#BEB6AC]">
                  {dateLabel}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-[#FBF6F1] leading-snug pt-0.5">
              {b.productName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#BEB6AC]">
              {b.productCode ? `Kode: ${b.productCode} · ` : ''}Bagian:{' '}
              {b.category}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup penjelasan rumus"
            className="w-9 h-9 rounded-xl bg-slate-200/70 dark:bg-[#2C2520] border border-slate-300/60 dark:border-[#47403A] text-slate-600 dark:text-[#FBF6F1] hover:opacity-80 flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body with Generous Spacing */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {/* Hero Summary Card */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border ${
              b.state === 'neg'
                ? 'bg-rose-50/90 dark:bg-[#191511] border-rose-200 dark:border-[#FF5B62]/40'
                : b.state === 'pos'
                ? 'bg-emerald-50/90 dark:bg-[#211D1A] border-emerald-200 dark:border-[#16D6A0]/40'
                : 'bg-slate-100 dark:bg-[#241E19] border-slate-200 dark:border-[#3E3731]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#BEB6AC]">
                Hasil Akhir Selisih
              </span>
              <span
                className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full tracking-wide ${
                  b.state === 'neg'
                    ? 'bg-rose-500 dark:bg-[#FF5B62] text-white'
                    : b.state === 'pos'
                    ? 'bg-emerald-500 dark:bg-[#16D6A0] text-white dark:text-[#140F0B]'
                    : 'bg-slate-300 dark:bg-[#312A25] text-slate-800 dark:text-[#FBF6F1]'
                }`}
              >
                {statusWord}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/70 dark:border-white/10 tabular-nums">
              <div>
                <span className="block text-[11px] text-slate-500 dark:text-[#BEB6AC]">
                  Jumlah Selisih Fisik
                </span>
                <div
                  className={`text-lg sm:text-xl font-black font-mono mt-0.5 ${
                    b.state === 'neg'
                      ? 'text-rose-600 dark:text-[#FF5B62]'
                      : b.state === 'pos'
                      ? 'text-emerald-600 dark:text-[#16D6A0]'
                      : 'text-slate-800 dark:text-[#FBF6F1]'
                  }`}
                >
                  {signSymbol} {formatQty(Math.abs(b.diffQty))} {b.unit}
                </div>
                {selisihDetailText && (
                  <div className="text-xs font-semibold text-slate-600 dark:text-[#BEB6AC] font-mono mt-0.5">
                    Setara: {selisihDetailText}
                  </div>
                )}
              </div>

              <div className="sm:text-right sm:border-l sm:border-slate-200/70 dark:sm:border-white/10 sm:pl-4">
                <span className="block text-[11px] text-slate-500 dark:text-[#BEB6AC]">
                  Nilai Rupiah Selisih
                </span>
                <div
                  className={`text-lg sm:text-xl font-black font-mono mt-0.5 ${
                    b.state === 'neg'
                      ? 'text-rose-600 dark:text-[#FF5B62]'
                      : b.state === 'pos'
                      ? 'text-emerald-600 dark:text-[#16D6A0]'
                      : 'text-slate-600 dark:text-[#BEB6AC]'
                  }`}
                >
                  {b.state === 'eq'
                    ? 'Rp 0'
                    : `${signSymbol} ${formatRupiah(b.diffVal)}`}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-[#BEB6AC] font-mono mt-0.5">
                  Di file Excel: {outerFileDiff}
                </div>
              </div>
            </div>
          </div>

          {/* Step 1: Rumus Dasar Selisih */}
          <div className="bg-slate-50/90 dark:bg-[#241E19] border border-slate-200 dark:border-[#3E3731] rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-sky-500/15 dark:bg-[#C2B4A1]/20 border border-sky-500/30 dark:border-[#C2B4A1]/30 text-sky-700 dark:text-[#C2B4A1] font-extrabold text-xs flex items-center justify-center shrink-0">
                1
              </span>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-[#FBF6F1] text-sm">
                  Cara Hitung Selisih Jumlah ({b.unit})
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-[#BEB6AC]">
                  Rumus: Hitungan Gudang dikurangi Di Sistem ESB
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#140F0B] border border-slate-200/80 dark:border-[#3E3731] rounded-xl p-3.5 font-mono text-xs sm:text-[13px] tabular-nums space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-sans text-slate-500 dark:text-[#BEB6AC]">
                  Hitungan Gudang (Fisik)
                </span>
                <span className="font-bold text-slate-900 dark:text-[#FBF6F1]">
                  {formatQty(b.opQty)} {b.unit}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-sans text-slate-500 dark:text-[#BEB6AC]">
                  Di Sistem ESB
                </span>
                <span className="font-bold text-slate-900 dark:text-[#FBF6F1]">
                  - {formatQty(b.sysQty)} {b.unit}
                </span>
              </div>
              <div className="border-t border-slate-200 dark:border-[#3E3731] pt-2.5 flex items-center justify-between gap-3">
                <span className="font-sans font-bold text-slate-800 dark:text-[#FBF6F1]">
                  Hasil Selisih
                </span>
                <span
                  className={`text-sm font-extrabold ${
                    b.state === 'neg'
                      ? 'text-rose-600 dark:text-[#FF5B62]'
                      : b.state === 'pos'
                      ? 'text-emerald-600 dark:text-[#16D6A0]'
                      : 'text-slate-900 dark:text-[#FBF6F1]'
                  }`}
                >
                  = {formatSignedQty(b.diffQty)} {b.unit}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#BEB6AC] leading-relaxed">
              {b.state === 'neg'
                ? `Penjelasan: Stok fisik di gudang lebih sedikit ${formatQty(
                    Math.abs(b.diffQty)
                  )} ${b.unit} dibandingkan catatan Sistem ESB.`
                : b.state === 'pos'
                ? `Penjelasan: Stok fisik di gudang lebih banyak ${formatQty(
                    Math.abs(b.diffQty)
                  )} ${b.unit} dibandingkan catatan Sistem ESB.`
                : 'Penjelasan: Stok fisik di gudang sudah sama persis dengan catatan Sistem ESB.'}
            </p>
          </div>

          {/* Step 2: Rumus Konversi Kemasan (Dus / Pack / Botol / Pcs) */}
          <div className="bg-slate-50/90 dark:bg-[#241E19] border border-slate-200 dark:border-[#3E3731] rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-amber-500/15 dark:bg-[#ACE25B]/20 border border-amber-500/30 dark:border-[#ACE25B]/30 text-amber-700 dark:text-[#ACE25B] font-extrabold text-xs flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-[#FBF6F1] text-sm">
                  Cara Hitung Konversi Kemasan (Dus / Pack)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-[#BEB6AC]">
                  Mengubah {formatQty(Math.abs(b.diffQty))} {b.unit} ke satuan kemasan gudang
                </p>
              </div>
            </div>

            <div className="bg-amber-500/10 dark:bg-[#312A25]/80 border border-amber-500/25 dark:border-[#47403A] rounded-xl px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs text-slate-500 dark:text-[#BEB6AC]">
                Standar Kemasan Barang:
              </span>
              <strong className="text-xs sm:text-sm text-slate-900 dark:text-[#ACE25B]">
                {b.specText}
              </strong>
            </div>

            {b.conversionSteps.length > 0 ? (
              <div className="space-y-2.5">
                {b.conversionSteps.map((step, i) => (
                  <div
                    key={`${step.targetUnitLabel}-${i}`}
                    className="bg-white dark:bg-[#140F0B] border border-slate-200/80 dark:border-[#3E3731] rounded-xl p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-[#FBF6F1]">
                        Konversi ke {step.targetUnitLabel}
                      </span>
                      <span
                        className={`text-xs sm:text-sm font-extrabold font-mono px-2.5 py-0.5 rounded-md ${
                          b.state === 'neg'
                            ? 'bg-rose-500/10 text-rose-600 dark:bg-[#FF5B62]/15 dark:text-[#FF5B62]'
                            : 'bg-emerald-500/10 text-emerald-600 dark:bg-[#16D6A0]/15 dark:text-[#16D6A0]'
                        }`}
                      >
                        {step.resultText}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#1C1611] border border-slate-200/60 dark:border-[#3E3731]/60 rounded-lg px-3 py-2 font-mono text-xs tabular-nums flex items-center justify-between gap-2">
                      <span className="text-slate-600 dark:text-[#BEB6AC]">
                        {step.formulaText}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-[#FBF6F1]">
                        = {step.resultText}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-[#BEB6AC] leading-relaxed">
                      {step.explanationText}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-[#BEB6AC]">
                Barang ini menggunakan satuan dasar ({b.unit}) tanpa konversi dus/pack tambahan.
              </p>
            )}

            <div className="bg-white dark:bg-[#140F0B] border border-slate-200/80 dark:border-[#3E3731] rounded-xl p-3.5 space-y-1.5">
              <div className="text-xs font-bold text-slate-800 dark:text-[#FBF6F1]">
                Asal Angka &ldquo;Di file {outerFileDiff}&rdquo;
              </div>
              {b.wasConvertedFromFile ? (
                <p className="text-xs text-slate-600 dark:text-[#BEB6AC] leading-relaxed">
                  Di file Excel asli, barang ini tercatat dalam satuan{' '}
                  <strong>{b.originalUnit}</strong> sebesar{' '}
                  <strong className="font-mono text-slate-900 dark:text-[#FBF6F1]">
                    {formatSignedQty(b.originalDiffQty)} {b.originalUnit}
                  </strong>
                  . Aplikasi mengalikan{' '}
                  <strong className="font-mono text-slate-900 dark:text-[#FBF6F1]">
                    {formatSignedQty(b.originalDiffQty)} × {b.originalFactor}
                  </strong>{' '}
                  agar tampil dalam satuan{' '}
                  <strong className="font-mono text-slate-900 dark:text-[#FBF6F1]">
                    {formatSignedQty(b.diffQty)} {b.unit}
                  </strong>
                  .
                </p>
              ) : (
                <p className="text-xs text-slate-600 dark:text-[#BEB6AC] leading-relaxed">
                  Angka{' '}
                  <strong className="font-mono text-slate-900 dark:text-[#FBF6F1]">
                    {outerFileDiff}
                  </strong>{' '}
                  adalah hasil konversi selisih{' '}
                  <strong className="font-mono text-slate-900 dark:text-[#FBF6F1]">
                    {formatSignedQty(b.diffQty)} {b.unit}
                  </strong>{' '}
                  ke satuan kemasan utama (2 angka di belakang koma sesuai standar laporan Excel).
                </p>
              )}
            </div>
          </div>

          {/* Step 3: Rumus Nilai Rupiah */}
          <div className="bg-slate-50/90 dark:bg-[#241E19] border border-slate-200 dark:border-[#3E3731] rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/15 dark:bg-[#16D6A0]/20 border border-emerald-500/30 dark:border-[#16D6A0]/30 text-emerald-700 dark:text-[#16D6A0] font-extrabold text-xs flex items-center justify-center shrink-0">
                3
              </span>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-[#FBF6F1] text-sm">
                  Cara Hitung Nilai Rupiah
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-[#BEB6AC]">
                  Rumus: Jumlah Selisih dikali Harga Satuan
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#140F0B] border border-slate-200/80 dark:border-[#3E3731] rounded-xl p-3.5 font-mono text-xs sm:text-[13px] tabular-nums space-y-2.5">
              {b.wasConvertedFromFile && b.originalFactor > 1 ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-sans text-slate-500 dark:text-[#BEB6AC]">
                      Selisih di File ({b.originalUnit})
                    </span>
                    <span className="font-bold text-slate-900 dark:text-[#FBF6F1]">
                      {formatSignedQty(b.originalDiffQty)} {b.originalUnit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-sans text-slate-500 dark:text-[#BEB6AC]">
                      Harga per {b.originalUnit}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-[#FBF6F1]">
                      × {formatRupiah(b.valUnit, false)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-sans text-slate-500 dark:text-[#BEB6AC]">
                      Jumlah Selisih ({b.unit})
                    </span>
                    <span className="font-bold text-slate-900 dark:text-[#FBF6F1]">
                      {formatSignedQty(b.diffQty)} {b.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-sans text-slate-500 dark:text-[#BEB6AC]">
                      Harga / Unit ({b.unit})
                    </span>
                    <span className="font-bold text-slate-900 dark:text-[#FBF6F1]">
                      × {formatRupiah(b.valUnit, false)}
                    </span>
                  </div>
                </>
              )}
              <div className="border-t border-slate-200 dark:border-[#3E3731] pt-2.5 flex items-center justify-between gap-3">
                <span className="font-sans font-bold text-slate-800 dark:text-[#FBF6F1]">
                  Total Nilai Selisih
                </span>
                <span
                  className={`text-sm font-extrabold ${
                    b.state === 'neg'
                      ? 'text-rose-600 dark:text-[#FF5B62]'
                      : b.state === 'pos'
                      ? 'text-emerald-600 dark:text-[#16D6A0]'
                      : 'text-slate-900 dark:text-[#FBF6F1]'
                  }`}
                >
                  ={' '}
                  {b.state === 'eq'
                    ? 'Rp 0'
                    : `${signSymbol} ${formatRupiah(b.diffVal)}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Button */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-[#3E3731] bg-slate-50 dark:bg-[#120D0A] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm transition-colors shadow-sm cursor-pointer"
          >
            Tutup Rincian Rumus
          </button>
        </div>
      </div>
    </div>
  );
}

function BerandaProfitLossCard({
  report,
  monthCount,
  onOpenProfitLoss,
  onUploadClick,
  onOpenInfo,
}: {
  report: PnlMonthReport | null;
  monthCount: number;
  onOpenProfitLoss: (monthKey?: string) => void;
  onUploadClick: () => void;
  onOpenInfo: (key: InfoGuideKey) => void;
}) {
  if (!report) {
    return (
      <MotionSection className="wizzmie-glass-card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 border border-amber-300/60 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                <GsapWordTitle text="Informasi Menu Laba Rugi" />
              </h2>
              <InfoButton guideKey="profitLoss" onOpen={onOpenInfo} />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300/85 leading-relaxed">
              Belum ada laporan Profit Loss yang diupload. Upload file Excel <strong>Profit Loss Consolidation (.xlsx / .xls)</strong> untuk melihat Net Sales (100%), Total COGS, Gross Profit, Biaya Operasional, Net Profit, serta analisa sederhana setiap pos.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onUploadClick}
            className="btn-3d-primary px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 min-h-[40px] whitespace-nowrap cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload di Pengaturan</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenProfitLoss()}
            className="btn-3d-soft px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 flex items-center gap-1.5 min-h-[40px] whitespace-nowrap cursor-pointer"
          >
            <span>Buka Menu Laba Rugi</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </MotionSection>
    );
  }

  const pct = (value: number) =>
    report.netSales > 0 ? (value / report.netSales) * 100 : 0;

  const isLoss = report.netProfit < 0;

  const metrics = [
    {
      label: 'Net Sales',
      sub: 'Acuan 100,00%',
      value: formatSignedRupiah(report.netSales),
      tone: 'text-amber-700 dark:text-amber-300',
      box: 'bg-amber-50/80 dark:bg-amber-500/10 border-amber-200/80 dark:border-amber-500/25',
    },
    {
      label: 'Total COGS',
      sub: `${formatPercentId(pct(report.totalCogs))} dari Net Sales`,
      value: formatSignedRupiah(report.totalCogs),
      tone: 'text-slate-900 dark:text-white',
      box: 'bg-slate-50/90 dark:bg-[#1D1712] border-slate-200/80 dark:border-[#312A25]',
    },
    {
      label: 'Gross Profit',
      sub: `${formatPercentId(pct(report.grossProfit))} dari Net Sales`,
      value: formatSignedRupiah(report.grossProfit),
      tone: 'text-sky-700 dark:text-sky-300',
      box: 'bg-sky-50/70 dark:bg-sky-500/10 border-sky-200/80 dark:border-sky-500/25',
    },
    {
      label: 'Biaya Operasional',
      sub: `${formatPercentId(pct(report.totalOpex))} dari Net Sales`,
      value: formatSignedRupiah(report.totalOpex),
      tone: 'text-slate-900 dark:text-white',
      box: 'bg-slate-50/90 dark:bg-[#1D1712] border-slate-200/80 dark:border-[#312A25]',
    },
    {
      label: isLoss ? 'Net Loss (Rugi Bersih)' : 'Net Profit (Laba Bersih)',
      sub: `${formatPercentId(pct(report.netProfit))} dari Net Sales`,
      value: formatSignedRupiah(report.netProfit),
      tone: isLoss
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-emerald-600 dark:text-emerald-400',
      box: isLoss
        ? 'bg-rose-50/80 dark:bg-rose-500/10 border-rose-200/80 dark:border-rose-500/30 col-span-2 sm:col-span-1'
        : 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200/80 dark:border-emerald-500/30 col-span-2 sm:col-span-1',
    },
  ];

  return (
    <MotionSection className="wizzmie-glass-card rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/15 border border-amber-300/60 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Coins className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight truncate">
                <GsapWordTitle
                  text={`Ringkasan Menu Laba Rugi · ${formatMonthId(
                    report.monthKey
                  )}`}
                />
              </h2>
              <InfoButton guideKey="profitLoss" onOpen={onOpenInfo} />
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Periode {formatPnlPeriodRange(report)}
              {report.branchName ? ` · ${report.branchName}` : ''}
              {monthCount > 1 ? ` · ${monthCount} periode tersimpan` : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenProfitLoss(report.id)}
          className="shrink-0 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all min-h-[38px] cursor-pointer"
        >
          <span>Buka Detail Laba Rugi</span>
          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {metrics.map((m, idx) => (
          <MotionCard
            key={m.label}
            delay={idx * 0.04}
            className={`rounded-xl border p-3 space-y-1 ${m.box}`}
          >
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
              {m.label}
            </div>
            <div
              className={`text-xs sm:text-sm font-black font-mono tabular-nums break-words leading-snug ${m.tone}`}
            >
              {m.value}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium tabular-nums truncate">
              {m.sub}
            </div>
          </MotionCard>
        ))}
      </div>

      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Ketuk <strong>Buka Detail Laba Rugi</strong> untuk melihat seluruh baris Description ÷ Net Sales (%) beserta penjelasan sederhana langsung dari aplikasi atau analisa tambahan Gemini / Groq / OpenAI.
      </p>
    </MotionSection>
  );
}
