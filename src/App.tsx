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
import { GlobalAiChatWidget } from './components/GlobalAiChatWidget';
import { InfoButton, InfoDialog, InfoGuideKey } from './components/InfoGuide';
import { ProfitLossView } from './components/ProfitLossView';
import heroInventory3d from './assets/images/hero_inventory_3d_1795152375997.jpg';
import uploadExcel3d from './assets/images/upload_excel_3d_1795152375933.jpg';
import {
  PnlDataset,
  PnlMonthReport,
  clearPnlAiCache,
  clearPnlPermanentNotes,
  detectExcelReportType,
  formatPercentId,
  formatPnlPeriodRange,
  formatSignedRupiah,
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
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [activeBarDate, setActiveBarDate] = useState<string>('');
  const [activeInfoKey, setActiveInfoKey] = useState<InfoGuideKey | null>(null);
  const [berandaModal, setBerandaModal] = useState<BerandaModalType>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [lastUpload, setLastUpload] = useState<UploadReport | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadImgFailed, setUploadImgFailed] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setStatus({ text: 'Sedang membaca file Excel...' });

    try {
      const addedDates: string[] = [];
      const updatedDates: string[] = [];
      const unchangedDates: string[] = [];
      let totalRows = 0;
      let diffRows = 0;
      let pasRows = 0;
      const productSet = new Set<string>();
      const nextData: StockDataset = { ...data };
      const nextPnlData: PnlDataset = { ...pnlData };
      const pnlNewMonths: string[] = [];
      const pnlUpdatedMonths: string[] = [];
      let lastPnlPeriod = '';

      for (const file of list) {
        const buffer = await file.arrayBuffer();
        const reportType = detectExcelReportType(buffer);

        if (reportType === 'pnl') {
          const parsedPnl = parseProfitLossBuffer(buffer);
          if (nextPnlData[parsedPnl.monthKey]) {
            if (!pnlUpdatedMonths.includes(parsedPnl.monthKey)) {
              pnlUpdatedMonths.push(parsedPnl.monthKey);
            }
          } else {
            if (!pnlNewMonths.includes(parsedPnl.monthKey)) {
              pnlNewMonths.push(parsedPnl.monthKey);
            }
          }
          nextPnlData[parsedPnl.monthKey] = parsedPnl;
          clearPnlAiCache(parsedPnl.monthKey);
          lastPnlPeriod = formatPnlPeriodRange(parsedPnl);
          continue;
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
      const importedPnlCount = pnlNewMonths.length + pnlUpdatedMonths.length;

      if (!importedDates.length && !importedPnlCount) {
        throw new Error('tidak ada baris data yang terbaca');
      }

      if (importedDates.length > 0) {
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
      }

      if (importedPnlCount > 0) {
        const allImportedPnl = [...pnlNewMonths, ...pnlUpdatedMonths].sort();
        const latestPnlMonth = allImportedPnl[allImportedPnl.length - 1];
        setPnlData(nextPnlData);
        persistPnlData(nextPnlData);
        setSelectedPnlMonth(latestPnlMonth);
      }

      if (importedPnlCount > 0 && importedDates.length === 0) {
        const latestPnlMonth = [...pnlNewMonths, ...pnlUpdatedMonths]
          .sort()
          .pop()!;
        const actionDesc =
          pnlUpdatedMonths.includes(latestPnlMonth) &&
          !pnlNewMonths.includes(latestPnlMonth)
            ? `Data Laba Rugi ${formatMonthId(
                latestPnlMonth
              )} otomatis diperbarui dengan tanggal periode terbaru (${lastPnlPeriod}).`
            : `Data Laba Rugi bulan baru ${formatMonthId(
                latestPnlMonth
              )} (${lastPnlPeriod}) berhasil ditambahkan.`;
        setStatus({
          text: `${actionDesc} Semua baris Description otomatis dibagi Net Sales (%).`,
        });
        setActiveTab('labarugi');
      } else if (importedPnlCount > 0 && importedDates.length > 0) {
        setStatus({
          text: `Berhasil membaca Stok Opname (${totalRows} baris) dan Laba Rugi (${importedPnlCount} laporan).`,
        });
        setActiveTab('pengaturan');
      } else {
        const updateSummaryText =
          updatedDates.length > 0
            ? `${updatedDates.length} tanggal diperbarui`
            : 'tidak ada yang diperbarui';
        setStatus({
          text: `Berhasil membaca semua ${totalRows} baris (${productSet.size} barang: ${diffRows} selisih, ${pasRows} pas): ${addedDates.length} tanggal baru, ${updateSummaryText}.`,
        });
        setActiveTab('pengaturan');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Format file tidak sesuai.';
      setStatus({
        text: `Gagal membaca file: ${message}. Pastikan file adalah laporan Stock Opname atau Profit Loss Consolidation (.xlsx / .xls).`,
        isError: true,
      });
    }
  };

  const handlePickProduct = (productName: string) => {
    setSelectedProduct(productName);
    setSearchQuery(productName);
    setActiveTab('barang');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDayInHarian = (dateKey: string) => {
    if (
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

  const handleDeletePnlMonth = (monthKey: string) => {
    const next = { ...pnlData };
    delete next[monthKey];
    clearPnlAiCache(monthKey);
    clearPnlPermanentNotes(monthKey);
    setPnlData(next);
    persistPnlData(next);
    if (selectedPnlMonth === monthKey) {
      const remaining = Object.keys(next).sort();
      setSelectedPnlMonth(remaining[remaining.length - 1] ?? '');
    }
    setStatus({ text: `Data Laba Rugi ${formatMonthId(monthKey)} dihapus.` });
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

  const pnlMonths = useMemo(() => Object.keys(pnlData).sort(), [pnlData]);

  const berandaPnlReport = useMemo<PnlMonthReport | null>(() => {
    if (!pnlMonths.length) return null;
    if (activeMonth && pnlData[activeMonth]) return pnlData[activeMonth];
    if (selectedPnlMonth && pnlData[selectedPnlMonth]) {
      return pnlData[selectedPnlMonth];
    }
    return pnlData[pnlMonths[pnlMonths.length - 1]] ?? null;
  }, [pnlMonths, pnlData, activeMonth, selectedPnlMonth]);

  const navItems: {
    id: MenuTab;
    label: string;
    mobileLabel: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'beranda',
      label: 'Beranda',
      mobileLabel: 'Beranda',
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

  return (
    <LenisGsapProvider
      activeKey={`${activeTab}-${activeMonth}-${viewScope}-${selectedPnlMonth}`}
    >
      <div className="min-h-screen app-canvas-bg text-slate-900 dark:text-slate-100 pb-20 md:pb-10 transition-colors">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Top Navigation Bar (Clean 3-Zone Contract) */}
      <header className="md:sticky md:top-0 z-30 bg-white/95 dark:bg-[#081226]/95 backdrop-blur-md border-b border-[#EBC7E9] dark:border-[#1C3259] shadow-[0_4px_20px_-10px_rgba(110,17,104,0.14)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('beranda')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF35B8] to-[#C61196] dark:from-amber-400 dark:to-amber-500 flex items-center justify-center font-black text-white dark:text-slate-950 text-base shadow-md shadow-[#E0139C]/25 dark:shadow-amber-500/20 shrink-0">
              W
            </span>
            <span className="leading-tight">
              <span className="font-display block text-sm sm:text-base font-bold tracking-tight text-[#391042] dark:text-white">
                Pantau Stok Opname
              </span>
              {summary?.locationName || summary?.branchName ? (
                <span className="block text-[11px] font-medium text-[#7D4E85] dark:text-slate-400 truncate max-w-[155px] sm:max-w-[220px]">
                  {summary.locationName || summary.branchName}
                </span>
              ) : null}
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-6 h-full">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative h-full px-1 text-sm font-bold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'text-[#C61196] dark:text-amber-400'
                      : 'text-[#6E4877] dark:text-slate-400 hover:text-[#391042] dark:hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E0139C] dark:bg-amber-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-5">
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

        {/* PAGE 1: BERANDA (Executive Overview Layout — 100% Reference Structure) */}
        {activeTab === 'beranda' && (
          <div className="space-y-4">
            {!summary ? (
              <>
                <EmptyStateCard
                  onUploadClick={() => {
                    setActiveTab('pengaturan');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
                <BerandaProfitLossCard
                  report={berandaPnlReport}
                  monthCount={pnlMonths.length}
                  onOpenProfitLoss={(monthKey) => {
                    if (monthKey) setSelectedPnlMonth(monthKey);
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

                  // Max value for Row 2 Col 1 Combo Chart
                  const maxComboVal = Math.max(
                    1,
                    ...chartDays.map((d) =>
                      Math.max(
                        Math.abs(d.negVal),
                        Math.abs(d.posVal),
                        Math.abs(d.negVal + d.posVal)
                      )
                    )
                  );

                  // Category Donut Breakdown (Row 2 Col 2)
                  const donutColors = [
                    '#E0139C',
                    '#64748B',
                    '#F59E0B',
                    '#3B82F6',
                    '#A855F7',
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
                      : 'conic-gradient(#E0139C 0deg 360deg)';

                  // Top 5 Products for Row 2 Col 3 Horizontal Progress Bars
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
                    <div className="surface-3d rounded-3xl p-3.5 sm:p-5 space-y-3.5 border border-[#EBC7E9] dark:border-[#243F6E]">
                      {/* ROW 0: EXECUTIVE HEADER BANNER (Crown Left · Centered Spaced Title · Period & Controls Right) */}
                      <section className="rounded-2xl bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#243F6E] px-4 py-3.5 sm:px-6 sm:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
                        {/* Left: Crown Emblem + Branch Badge */}
                        <div className="flex items-center justify-between lg:justify-start gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#FDE4F7] dark:bg-amber-400/15 border border-[#F2BCE7] dark:border-amber-400/35 flex items-center justify-center text-[#C61196] dark:text-[#FFC400] shrink-0 shadow-xs">
                              <Crown className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
                            </div>
                            <div className="lg:hidden">
                              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#C61196] dark:text-[#FFC400]">
                                RINGKASAN EKSEKUTIF STOK
                              </div>
                              <div className="text-[11px] font-semibold text-[#6E4877] dark:text-[#A8B9D3]">
                                {summary.locationName ||
                                  summary.branchName ||
                                  'Pantau Stok Opname'}
                              </div>
                            </div>
                          </div>

                          <div className="lg:hidden">
                            <InfoButton
                              guideKey="overview"
                              onOpen={setActiveInfoKey}
                            />
                          </div>
                        </div>

                        {/* Center: All-Caps Wide-Tracking Title */}
                        <div className="hidden lg:flex flex-col items-center text-center">
                          <div className="flex items-center gap-2">
                            <h1 className="text-lg xl:text-2xl font-extrabold uppercase tracking-[0.22em] text-[#C61196] dark:text-[#FFC400]">
                              RINGKASAN EKSEKUTIF STOK OPNAME
                            </h1>
                            <InfoButton
                              guideKey="overview"
                              onOpen={setActiveInfoKey}
                            />
                          </div>
                          <p className="text-[11px] text-[#7D4E85] dark:text-[#A8B9D3] mt-0.5 tracking-wide">
                            {summary.locationName || summary.branchName
                              ? `${summary.locationName || summary.branchName} · `
                              : ''}
                            Perbandingan Hitungan Gudang vs Sistem ESB (
                            {summary.totalRowsCount.toLocaleString('id-ID')} baris)
                          </p>
                        </div>

                        {/* Right: Period Title, Monthly Summary Subtitle & Scope Pill Toggle */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-3">
                          <div className="text-left lg:text-right">
                            <div className="text-sm sm:text-base font-extrabold text-[#391042] dark:text-white leading-tight">
                              {viewScope === 'month'
                                ? formatMonthId(activeMonth)
                                : viewScope === 'range'
                                ? formatDateRangeLabel(
                                    summary.rangeStart,
                                    summary.rangeEnd
                                  )
                                : formatDateId(activeDay)}
                            </div>
                            <div className="text-[11px] font-medium text-[#7D4E85] dark:text-[#A8B9D3]">
                              {viewScope === 'day'
                                ? 'Ringkasan 1 Hari'
                                : `${summary.activeDates.length} Hari Tersimpan`}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5">
                            <div className="inline-flex items-center rounded-full border border-[#EBC7E9] dark:border-[#243F6E] bg-[#FAF5FC] dark:bg-[#0A162B] p-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setViewScope('range');
                                  setIsRangePickerOpen(true);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all min-h-[32px] whitespace-nowrap cursor-pointer ${
                                  viewScope === 'range'
                                    ? 'wizzmie-pink-pill text-white'
                                    : 'text-[#391042] dark:text-slate-300 hover:text-[#C61196] dark:hover:text-white'
                                }`}
                              >
                                <CalendarRange className="w-3.5 h-3.5 shrink-0" />
                                <span>Rentang Tanggal</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setViewScope('day');
                                  setIsRangePickerOpen(false);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all min-h-[32px] whitespace-nowrap cursor-pointer ${
                                  viewScope === 'day'
                                    ? 'wizzmie-pink-pill text-white'
                                    : 'text-[#391042] dark:text-slate-300 hover:text-[#C61196] dark:hover:text-white'
                                }`}
                              >
                                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                                <span>Cek 1 Hari</span>
                              </button>
                            </div>

                            {viewScope === 'day' && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  aria-label="Tanggal sebelumnya"
                                  disabled={activeDayIndex <= 0}
                                  onClick={() => {
                                    if (activeDayIndex > 0) {
                                      setSelectedDay(
                                        activeMonthDates[activeDayIndex - 1]
                                      );
                                    }
                                  }}
                                  className="p-1.5 rounded-full bg-white dark:bg-[#0F2244] border border-[#EBC7E9] dark:border-[#1F3763] text-[#391042] dark:text-slate-200 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <select
                                  aria-label="Pilih tanggal"
                                  value={activeDay}
                                  onChange={(e) =>
                                    setSelectedDay(e.target.value)
                                  }
                                  className="px-2.5 py-1 text-xs font-bold rounded-full border border-[#EBC7E9] dark:border-[#1F3763] bg-white dark:bg-[#0F2244] text-[#391042] dark:text-slate-200 cursor-pointer"
                                >
                                  {activeMonthDates
                                    .slice()
                                    .reverse()
                                    .map((d) => (
                                      <option key={d} value={d}>
                                        {formatDateId(d)}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  type="button"
                                  aria-label="Tanggal berikutnya"
                                  disabled={
                                    activeDayIndex < 0 ||
                                    activeDayIndex >=
                                      activeMonthDates.length - 1
                                  }
                                  onClick={() => {
                                    if (
                                      activeDayIndex >= 0 &&
                                      activeDayIndex <
                                        activeMonthDates.length - 1
                                    ) {
                                      setSelectedDay(
                                        activeMonthDates[activeDayIndex + 1]
                                      );
                                    }
                                  }}
                                  className="p-1.5 rounded-full bg-white dark:bg-[#0F2244] border border-[#EBC7E9] dark:border-[#1F3763] text-[#391042] dark:text-slate-200 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </section>

                      {viewScope === 'range' &&
                        summary.activeDates.length === 0 && (
                          <div className="rounded-2xl p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                              Belum ada data file Excel pada rentang{' '}
                              <strong>
                                {formatDateRangeLabel(
                                  summary.rangeStart,
                                  summary.rangeEnd
                                )}
                              </strong>
                              . Pilih tanggal yang bertanda titik hijau di
                              kalender.
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsRangePickerOpen(true)}
                              className="btn-3d-primary px-4 py-2 text-xs font-bold rounded-xl shrink-0 self-start sm:self-auto cursor-pointer"
                            >
                              Ubah Rentang Tanggal
                            </button>
                          </div>
                        )}

                      {/* ROW 1: 4 EXECUTIVE KPI CARDS (Label + Big Value + Subtitle on Left, Circular Outlined Icon on Right) */}
                      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                        {/* Card 1: KEKURANGAN STOK */}
                        <MotionCardButton
                          type="button"
                          delay={0.02}
                          onClick={() => setBerandaModal('neg')}
                          className="group text-left rounded-2xl p-4 bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#243F6E] hover:border-rose-400 dark:hover:border-rose-400/70 flex items-center justify-between gap-3 transition-all shadow-xs cursor-pointer"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#C61196] dark:text-[#FFC400]">
                              KEKURANGAN STOK
                            </div>
                            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[#391042] dark:text-white leading-tight">
                              - {formatRupiah(summary.totalNeg)}
                            </div>
                            <div className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <span>
                                {summary.negProductCount} barang kurang
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 opacity-75 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>

                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-[#EBC7E9] dark:border-amber-400/35 bg-[#FDF5FC] dark:bg-[#102344] flex items-center justify-center text-rose-600 dark:text-[#FFC400] shrink-0">
                            <TrendingDown className="w-6 h-6 stroke-[1.8]" />
                          </div>
                        </MotionCardButton>

                        {/* Card 2: KELEBIHAN STOK */}
                        <MotionCardButton
                          type="button"
                          delay={0.04}
                          onClick={() => setBerandaModal('pos')}
                          className="group text-left rounded-2xl p-4 bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#243F6E] hover:border-emerald-400 dark:hover:border-emerald-400/70 flex items-center justify-between gap-3 transition-all shadow-xs cursor-pointer"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#C61196] dark:text-[#FFC400]">
                              KELEBIHAN STOK
                            </div>
                            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[#391042] dark:text-white leading-tight">
                              + {formatRupiah(summary.totalPos)}
                            </div>
                            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <span>
                                +{summary.posProductCount} barang lebih
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 opacity-75 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>

                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-[#EBC7E9] dark:border-amber-400/35 bg-[#FDF5FC] dark:bg-[#102344] flex items-center justify-center text-emerald-600 dark:text-[#FFC400] shrink-0">
                            <TrendingUp className="w-6 h-6 stroke-[1.8]" />
                          </div>
                        </MotionCardButton>

                        {/* Card 3: TINGKAT AKURASI STOK */}
                        <MotionCardButton
                          type="button"
                          delay={0.06}
                          onClick={() => {
                            setProductFilter('pas');
                            setActiveTab('barang');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="group text-left rounded-2xl p-4 bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#243F6E] hover:border-[#E0139C] dark:hover:border-amber-400/70 flex items-center justify-between gap-3 transition-all shadow-xs cursor-pointer"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#C61196] dark:text-[#FFC400]">
                              AKURASI STOK PAS
                            </div>
                            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[#391042] dark:text-white leading-tight">
                              {accuracyPct}%
                            </div>
                            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {summary.pasProductCount} dari{' '}
                              {totalUniqueProducts} barang pas
                            </div>
                          </div>

                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-[#EBC7E9] dark:border-amber-400/35 bg-[#FDF5FC] dark:bg-[#102344] flex items-center justify-center text-[#C61196] dark:text-[#FFC400] shrink-0">
                            <ClipboardCheck className="w-6 h-6 stroke-[1.8]" />
                          </div>
                        </MotionCardButton>

                        {/* Card 4: HASIL GABUNGAN */}
                        <MotionCardButton
                          type="button"
                          delay={0.08}
                          onClick={() => setBerandaModal('net')}
                          className="group text-left rounded-2xl p-4 bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#243F6E] hover:border-[#E0139C] dark:hover:border-amber-400/70 flex items-center justify-between gap-3 transition-all shadow-xs cursor-pointer"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#C61196] dark:text-[#FFC400]">
                              HASIL GABUNGAN
                            </div>
                            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[#391042] dark:text-white leading-tight">
                              {summary.netTotal < -0.5
                                ? `- ${formatRupiah(summary.netTotal)}`
                                : summary.netTotal > 0.5
                                ? `+ ${formatRupiah(summary.netTotal)}`
                                : 'Pas Rp 0'}
                            </div>
                            <div
                              className={`text-xs font-bold flex items-center gap-1 ${
                                summary.netTotal < -0.5
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              <span>
                                {summary.netTotal < -0.5
                                  ? 'Selisih Kurang'
                                  : summary.netTotal > 0.5
                                  ? 'Selisih Lebih'
                                  : 'Seimbang'}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 opacity-75 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </div>

                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-[#EBC7E9] dark:border-amber-400/35 bg-[#FDF5FC] dark:bg-[#102344] flex items-center justify-center text-[#C61196] dark:text-[#FFC400] shrink-0">
                            <Scale className="w-6 h-6 stroke-[1.8]" />
                          </div>
                        </MotionCardButton>
                      </section>

                      {/* ROW 2: 3 MIDDLE ANALYTICS CARDS (Combo Bar+Line Chart · Donut Breakdown · Top 5 Progress List) */}
                      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
                        {/* Col 1 (4 cols): KURANG VS LEBIH PER TANGGAL (Dual Bar + Net Line Overlay) */}
                        <MotionSection className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#243F6E] p-4 flex flex-col justify-between shadow-xs">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.14em] text-[#C61196] dark:text-[#FFC400]">
                              KURANG VS LEBIH HARIAN
                            </h2>
                            <InfoButton
                              guideKey="dailyChart"
                              onOpen={setActiveInfoKey}
                            />
                          </div>

                          {/* Y-Axis + Paired Bars + Connected Net Dots */}
                          <div className="flex gap-2 items-end pt-3 pb-1">
                            <div className="flex flex-col justify-between h-[136px] text-[9px] font-mono text-[#7D4E85] dark:text-[#A8B9D3] pr-1 select-none tabular-nums">
                              <span>{formatCompactRupiah(maxComboVal)}</span>
                              <span>
                                {formatCompactRupiah(maxComboVal * 0.66)}
                              </span>
                              <span>
                                {formatCompactRupiah(maxComboVal * 0.33)}
                              </span>
                              <span>Rp 0</span>
                            </div>

                            <div className="flex-1 overflow-x-auto">
                              <div className="flex items-end justify-between gap-1.5 min-w-[240px] h-[136px] px-1 border-b border-l border-[#EBC7E9] dark:border-[#243F6E]">
                                {chartDays.map((day) => {
                                  const negH =
                                    day.negVal < 0
                                      ? Math.max(
                                          6,
                                          Math.round(
                                            (Math.abs(day.negVal) /
                                              maxComboVal) *
                                              108
                                          )
                                        )
                                      : 3;
                                  const posH =
                                    day.posVal > 0
                                      ? Math.max(
                                          6,
                                          Math.round(
                                            (Math.abs(day.posVal) /
                                              maxComboVal) *
                                              108
                                          )
                                        )
                                      : 3;
                                  const netH = Math.min(
                                    112,
                                    Math.max(
                                      12,
                                      Math.round(
                                        (Math.abs(day.negVal + day.posVal) /
                                          maxComboVal) *
                                          104
                                      )
                                    )
                                  );
                                  const isSelected =
                                    highlightedBarStat?.date === day.date;

                                  return (
                                    <button
                                      key={day.date}
                                      type="button"
                                      onClick={() => {
                                        setActiveBarDate(day.date);
                                        handleOpenDayInHarian(day.date);
                                      }}
                                      title={`${formatDateId(day.date)}: Kurang -${formatCompactRupiah(day.negVal)} | Lebih +${formatCompactRupiah(day.posVal)}`}
                                      className={`group relative flex-1 min-w-[20px] h-full flex flex-col justify-end items-center cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#FDF0FA] dark:bg-amber-400/10 rounded-t-md'
                                          : ''
                                      }`}
                                    >
                                      {/* Net Trend Dot */}
                                      <span
                                        className="absolute w-2 h-2 rounded-full bg-[#E0139C] dark:bg-[#FFC400] ring-2 ring-white dark:ring-[#0B172E] z-10 pointer-events-none"
                                        style={{ bottom: `${netH + 16}px` }}
                                      />
                                      <div className="w-full flex items-end justify-center gap-0.5 px-0.5">
                                        <span
                                          className="w-2 sm:w-2.5 rounded-t-xs bg-[#E0139C] dark:bg-[#D4A148] transition-all group-hover:brightness-110"
                                          style={{ height: `${negH}px` }}
                                        />
                                        <span
                                          className="w-2 sm:w-2.5 rounded-t-xs bg-slate-400/80 dark:bg-slate-600 transition-all group-hover:brightness-110"
                                          style={{ height: `${posH}px` }}
                                        />
                                      </div>
                                      <span className="mt-1 text-[9px] font-mono font-bold text-[#6E4877] dark:text-[#A8B9D3] tabular-nums">
                                        {Number(day.date.slice(8))}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Legend Footer */}
                          <div className="pt-2.5 mt-2 border-t border-[#F3E2F1] dark:border-[#1B3258] flex items-center justify-center gap-4 text-[11px] font-semibold text-[#6E4877] dark:text-[#A8B9D3]">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-3 h-2 rounded-xs bg-[#E0139C] dark:bg-[#D4A148]" />
                              <span>Kurang</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-3 h-2 rounded-xs bg-slate-400 dark:bg-slate-600" />
                              <span>Lebih</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#E0139C] dark:bg-[#FFC400]" />
                              <span>Hasil</span>
                            </span>
                          </div>
                        </MotionSection>

                        {/* Col 2 (4 cols): RINCIAN PER BAGIAN (Donut Ring Chart + Right Percentage Legend) */}
                        <MotionSection className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#243F6E] p-4 flex flex-col justify-between shadow-xs">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.14em] text-[#C61196] dark:text-[#FFC400]">
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
                                <div className="w-21 h-21 sm:w-24 sm:h-24 rounded-full bg-white dark:bg-[#0B172E] flex flex-col items-center justify-center text-center px-1.5 shadow-xs">
                                  <span className="text-xs sm:text-sm font-black font-mono text-[#391042] dark:text-white tabular-nums leading-tight">
                                    -{formatCompactRupiah(summary.totalNeg)}
                                  </span>
                                  <span className="text-[9px] font-semibold text-[#7D4E85] dark:text-[#A8B9D3] mt-0.5">
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
                                    <span className="font-semibold text-[#391042] dark:text-slate-200 truncate">
                                      {slice.category}
                                    </span>
                                  </span>
                                  <span className="font-mono font-bold text-[#6E4877] dark:text-[#A8B9D3] tabular-nums shrink-0">
                                    {slice.pct}%
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[#F3E2F1] dark:border-[#1B3258] flex items-center justify-between text-[11px] text-[#7D4E85] dark:text-[#A8B9D3]">
                            <span>Ketuk bagian untuk filter harian</span>
                            <span className="font-mono font-bold">
                              {summary.categoryStats.length} Bagian
                            </span>
                          </div>
                        </MotionSection>

                        {/* Col 3 (4 cols): BARANG PRIORITAS DICEK (5 Horizontal Progress Bars + View All Link) */}
                        <MotionSection className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#0B172E] border border-[#EBC7E9] dark:border-[#243F6E] p-4 flex flex-col justify-between shadow-xs">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.14em] text-[#C61196] dark:text-[#FFC400] truncate">
                              BARANG PRIORITAS DICEK
                            </h2>
                            <div className="inline-flex items-center rounded-full border border-[#EBC7E9] dark:border-[#243F6E] bg-[#FAF5FC] dark:bg-[#0A162B] p-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setRankMode('neg')}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                                  rankMode === 'neg'
                                    ? 'wizzmie-pink-pill text-white'
                                    : 'text-[#6E4877] dark:text-slate-400'
                                }`}
                              >
                                Minus
                              </button>
                              <button
                                type="button"
                                onClick={() => setRankMode('pos')}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                                  rankMode === 'pos'
                                    ? 'wizzmie-pink-pill text-white'
                                    : 'text-[#6E4877] dark:text-slate-400'
                                }`}
                              >
                                Lebih
                              </button>
                            </div>
                          </div>

                          {rankedItems.length === 0 ? (
                            <p className="text-xs text-[#7D4E85] dark:text-[#A8B9D3] py-8 text-center">
                              Tidak ada barang selisih pada kategori ini.
                            </p>
                          ) : (
                            <div className="space-y-2.5 my-auto py-1">
                              {rankedItems.map((item) => {
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
                                    className="w-full grid grid-cols-12 items-center gap-2 text-left text-xs hover:bg-[#FDF5FC] dark:hover:bg-[#132548]/60 rounded-lg py-1 px-1 transition-colors cursor-pointer"
                                  >
                                    <span className="col-span-5 font-semibold text-[#391042] dark:text-slate-100 truncate">
                                      {item.name}
                                    </span>
                                    <span className="col-span-3 font-mono font-bold text-right text-[#391042] dark:text-slate-200 tabular-nums">
                                      {formatCompactRupiah(item.netVal)}
                                    </span>
                                    <div className="col-span-3 h-2.5 rounded-xs bg-[#F3E2F1] dark:bg-[#192D52] overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-[#FF35B8] to-[#C61196] dark:from-amber-500 dark:to-amber-300"
                                        style={{ width: `${sharePct}%` }}
                                      />
                                    </div>
                                    <span className="col-span-1 font-mono text-[11px] font-bold text-right text-[#6E4877] dark:text-[#A8B9D3] tabular-nums">
                                      {sharePct}%
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <div className="pt-2 mt-1 border-t border-[#F3E2F1] dark:border-[#1B3258] flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('barang');
                                window.scrollTo({
                                  top: 0,
                                  behavior: 'smooth',
                                });
                              }}
                              className="inline-flex items-center gap-1 text-xs font-extrabold text-[#C61196] dark:text-[#FFC400] hover:underline cursor-pointer"
                            >
                              <span>
                                Lihat Semua Barang ({totalUniqueProducts})
                              </span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </MotionSection>
                      </section>
                    </div>
                  );
                })()}

                {/* Informasi Menu Laba Rugi */}
                <BerandaProfitLossCard
                  report={berandaPnlReport}
                  monthCount={pnlMonths.length}
                  onOpenProfitLoss={(monthKey) => {
                    if (monthKey) setSelectedPnlMonth(monthKey);
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
        )}

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
              <>
                <MotionSection className="surface-3d rounded-[32px] p-5 sm:p-7 space-y-4">
                  {/* Top Row: Circular Pink Calendar Badge + SO DAILY ( 1 - 19 November 2026 ) + Info Button */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#FDE4F7] dark:bg-[#231438] border border-[#F5C5EC] dark:border-[#6A2363] flex items-center justify-center shrink-0">
                        <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-[#6A1064] dark:text-[#FF55C8]" />
                      </div>
                      <h1 className="text-[15px] sm:text-xl font-extrabold tracking-tight text-[#391042] dark:text-white leading-snug">
                        <GsapWordTitle
                          text={`SO DAILY ( ${
                            viewScope === 'range'
                              ? formatDateRangeFullLabel(
                                  summary.rangeStart,
                                  summary.rangeEnd
                                )
                              : viewScope === 'day'
                              ? formatDateFullId(activeDay)
                              : formatMonthId(activeMonth)
                          } )`}
                        />
                      </h1>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveInfoKey('harian')}
                      aria-label="Info penjelasan SO Daily"
                      title="Penjelasan singkat bagian ini"
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-[1.5px] border-[#6E1269] dark:border-[#FF55C8] text-[#6E1269] dark:text-[#FF55C8] hover:bg-[#FDE4F7]/60 dark:hover:bg-[#FF55C8]/15 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    >
                      <span className="font-serif font-bold text-xs sm:text-sm leading-none">
                        i
                      </span>
                    </button>
                  </div>

                  {/* Second Row: Right-aligned Pill Toggle (Rentang Tanggal / Cek 1 Hari) */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="inline-flex items-center rounded-full border border-[#EBC7E9] dark:border-[#243F6E] bg-white dark:bg-[#0A162B] p-0.5 shadow-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setViewScope('range');
                          setIsRangePickerOpen(true);
                        }}
                        className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-full transition-all min-h-[40px] whitespace-nowrap cursor-pointer ${
                          viewScope === 'range'
                            ? 'wizzmie-pink-pill text-white'
                            : 'text-[#391042] dark:text-slate-300 hover:text-[#B80D84] dark:hover:text-white'
                        }`}
                      >
                        <CalendarRange className="w-4 h-4 shrink-0" />
                        <span>Rentang Tanggal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewScope('day');
                          setIsRangePickerOpen(false);
                        }}
                        className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-full transition-all min-h-[40px] whitespace-nowrap cursor-pointer ${
                          viewScope === 'day'
                            ? 'wizzmie-pink-pill text-white'
                            : 'text-[#391042] dark:text-slate-300 hover:text-[#B80D84] dark:hover:text-white'
                        }`}
                      >
                        <CalendarDays
                          className={`w-4 h-4 shrink-0 ${
                            viewScope === 'day'
                              ? 'text-white'
                              : 'text-[#6E1269] dark:text-[#FF55C8]'
                          }`}
                        />
                        <span>Cek 1 Hari</span>
                      </button>
                    </div>

                    {viewScope === 'day' && (
                      <select
                        aria-label="Pilih tanggal di Harian"
                        value={activeDay}
                        onChange={(e) => setSelectedDay(e.target.value)}
                        className="px-4 py-2 text-xs sm:text-sm font-bold rounded-full border border-[#EBC7E9] dark:border-[#243F6E] bg-white dark:bg-[#0A162B] text-[#391042] dark:text-slate-100 min-h-[38px] cursor-pointer"
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

                  {/* Third Row: Full-width Rounded Pill Search Input with Clear (X) Button */}
                  <div className="relative">
                    <Search className="w-5 h-5 text-[#5D1359] dark:text-[#FF7AD2] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.25]" />
                    <input
                      type="text"
                      value={dailySearch}
                      onChange={(e) => setDailySearch(e.target.value)}
                      placeholder="Cari nama barang atau kode"
                      autoComplete="off"
                      className="w-full pl-12 pr-12 py-3 text-sm sm:text-base rounded-full border border-[#E5CEEC] dark:border-[#233F6D] bg-[#FAF5FC] dark:bg-[#0A162B] text-[#391042] dark:text-slate-100 placeholder:text-[#9A77A3] dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#E0139C] min-h-[48px]"
                    />
                    {dailySearch && (
                      <button
                        type="button"
                        onClick={() => setDailySearch('')}
                        aria-label="Bersihkan pencarian"
                        className="w-7 h-7 rounded-full bg-[#EAD4F0] hover:bg-[#DFBEE8] dark:bg-[#1C3259] dark:hover:bg-[#274477] text-[#4C1048] dark:text-slate-200 flex items-center justify-center absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    )}
                  </div>

                  {/* Fourth Row: 5-Column Segmented Pill Filter Bar (Semua, Selisih, Minus, Lebih, Pas) */}
                  <div className="grid grid-cols-5 items-center rounded-full border border-[#E5CEEC] dark:border-[#233F6D] bg-white dark:bg-[#0A162B] p-0.5 overflow-hidden shadow-xs">
                    {(
                      [
                        { id: 'all', label: 'Semua' },
                        { id: 'diff', label: 'Selisih' },
                        { id: 'neg', label: 'Minus' },
                        { id: 'pos', label: 'Lebih' },
                        { id: 'pas', label: 'Pas' },
                      ] as const
                    ).map((tab, idx) => {
                      const isActive = dailyFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setDailyFilter(tab.id)}
                          className={`relative flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-1.5 sm:px-3 text-xs sm:text-base font-bold transition-all min-h-[44px] sm:min-h-[48px] whitespace-nowrap cursor-pointer ${
                            isActive
                              ? 'wizzmie-pink-pill rounded-full text-white z-10'
                              : `text-[#391042] dark:text-slate-200 hover:text-[#C61196] dark:hover:text-white ${
                                  idx > 0
                                    ? 'border-l border-[#EFE0F3] dark:border-[#1B3258]'
                                    : ''
                                }`
                          }`}
                        >
                          {isActive && (
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white text-[#C61196] flex items-center justify-center shrink-0 shadow-xs">
                              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                            </span>
                          )}
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Fifth Row: 2-Column Equal-Width Rounded Pill Dropdowns (Semua Bagian & Semua Keperluan) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <LayoutGrid className="w-5 h-5 text-[#6E1269] dark:text-[#FF55C8] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        aria-label="Filter bagian"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full appearance-none pl-12 pr-10 py-3 text-sm sm:text-base font-bold rounded-full border border-[#EBC7E9] dark:border-[#233F6D] bg-white dark:bg-[#0A162B] text-[#391042] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#E0139C] min-h-[48px] cursor-pointer"
                      >
                        <option value="ALL">Semua Bagian</option>
                        {summary.categoryStats.map((cat) => (
                          <option key={cat.category} value={cat.category}>
                            {cat.category}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-5 h-5 text-[#391042] dark:text-slate-300 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.25]" />
                    </div>

                    <div className="relative">
                      <Layers className="w-5 h-5 text-[#6E1269] dark:text-[#FF55C8] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        aria-label="Filter keperluan"
                        value={purposeFilter}
                        onChange={(e) => setPurposeFilter(e.target.value)}
                        className="w-full appearance-none pl-12 pr-10 py-3 text-sm sm:text-base font-bold rounded-full border border-[#EBC7E9] dark:border-[#233F6D] bg-white dark:bg-[#0A162B] text-[#391042] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#E0139C] min-h-[48px] cursor-pointer"
                      >
                        <option value="ALL">Semua Keperluan</option>
                        {summary.allPurposes.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-5 h-5 text-[#391042] dark:text-slate-300 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.25]" />
                    </div>
                  </div>

                  {!summary.hasExtendedColumns && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Catatan: Data ini tersimpan sebelum pembaruan kolom lengkap. Upload ulang file Excel Anda sekali lagi untuk memunculkan Kode Barang, No. SP, Sub-bagian, Keperluan, Lokasi, dan Status.
                    </p>
                  )}
                </MotionSection>

                <section className="space-y-3">
                  {(() => {
                    const activeSet = new Set(summary.activeDates);
                    const visibleDailyStats =
                      viewScope === 'month'
                        ? summary.dailyStats
                        : summary.dailyStats.filter((d) => activeSet.has(d.date));
                    if (visibleDailyStats.length === 0) {
                      return (
                        <div className="surface-3d rounded-3xl p-6 text-center space-y-3">
                          <p className="text-sm text-slate-600 dark:text-slate-300">
                            Belum ada data Excel pada rentang{' '}
                            <strong>
                              {formatDateRangeLabel(
                                summary.rangeStart,
                                summary.rangeEnd
                              )}
                            </strong>
                            .
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsRangePickerOpen(true)}
                            className="btn-3d-primary px-4 py-2 text-xs font-bold rounded-xl cursor-pointer"
                          >
                            Ubah Rentang Tanggal
                          </button>
                        </div>
                      );
                    }
                    return visibleDailyStats
                      .slice()
                      .reverse()
                      .map((day, dayIndex) => {
                      const isOpen = openDays[day.date] ?? dayIndex === 0;
                      const dayNet = day.negVal + day.posVal;
                      const dq = dailySearch.trim().toLowerCase();
                      const rows = isOpen
                        ? data[day.date]
                            .map(convertRowWithMeta)
                            .filter(({ row }) => {
                              const isNeg = row[4] < -1e-9 || row[6] < -0.5;
                              const isPos = !isNeg && (row[4] > 1e-9 || row[6] > 0.5);
                              const isDiff = isNeg || isPos;

                              if (dailyFilter === 'diff' && !isDiff) return false;
                              if (dailyFilter === 'neg' && !isNeg) return false;
                              if (dailyFilter === 'pos' && !isPos) return false;
                              if (dailyFilter === 'pas' && isDiff) return false;

                              if (
                                categoryFilter !== 'ALL' &&
                                (row[8] || 'Lainnya') !== categoryFilter
                              ) {
                                return false;
                              }
                              if (
                                purposeFilter !== 'ALL' &&
                                (row[12] || '') !== purposeFilter
                              ) {
                                return false;
                              }
                              if (dq) {
                                const hit =
                                  row[0].toLowerCase().includes(dq) ||
                                  (row[13] || '').toLowerCase().includes(dq) ||
                                  (row[10] || '').toLowerCase().includes(dq) ||
                                  (row[12] || '').toLowerCase().includes(dq) ||
                                  (row[8] || '').toLowerCase().includes(dq) ||
                                  (row[14] || '').toLowerCase().includes(dq) ||
                                  (row[7] || '').toLowerCase().includes(dq);
                                if (!hit) return false;
                              }
                              return true;
                            })
                            .sort((a, b) => {
                              const aDiff =
                                Math.abs(a.row[4]) > 1e-9 ||
                                Math.abs(a.row[6]) > 0.5;
                              const bDiff =
                                Math.abs(b.row[4]) > 1e-9 ||
                                Math.abs(b.row[6]) > 0.5;
                              if (aDiff !== bDiff) return aDiff ? -1 : 1;
                              if (a.row[6] !== b.row[6]) {
                                return a.row[6] - b.row[6];
                              }
                              return a.row[0].localeCompare(b.row[0], 'id');
                            })
                        : [];

                      return (
                        <div
                          key={day.date}
                          id={`day-${day.date}`}
                          className="space-y-2.5"
                        >
                          {/* DateSummaryCard */}
                          <MotionCard
                            hoverLift={!isOpen}
                            className="bg-white dark:bg-[#102344] border border-[#EBC7E9] dark:border-[#203F70] rounded-2xl shadow-md overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setOpenDays((prev) => ({
                                  ...prev,
                                  [day.date]: !(prev[day.date] ?? dayIndex === 0),
                                }))
                              }
                              className="w-full p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-[#FDF5FC] dark:hover:bg-[#17315B]/40 transition-colors cursor-pointer"
                            >
                              {/* Left: Calendar & Date Overview */}
                              <div className="flex items-start space-x-2.5">
                                <div className="w-9 h-9 rounded-full bg-[#FDE4F7] dark:bg-[#FFC400]/10 flex items-center justify-center shrink-0 border border-[#F5C5EC] dark:border-[#FFC400]/30 mt-0.5">
                                  <CalendarDays className="w-4 h-4 text-[#6E1269] dark:text-[#FFC400]" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <h2 className="text-[15px] sm:text-base font-bold text-[#391042] dark:text-[#F4F7FF] leading-snug">
                                      {formatDateId(day.date)}
                                    </h2>
                                    <ChevronDown
                                      className={`w-4 h-4 text-[#7D4E85] dark:text-[#A8B9D3] transition-transform duration-200 ${
                                        isOpen ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </div>
                                  <p className="text-[11px] text-[#7D4E85] dark:text-[#A8B9D3] tracking-tight mt-0.5 tabular-nums">
                                    {day.totalCount} baris ({day.diffCount} selisih ·{' '}
                                    {day.pasCount} pas)
                                  </p>
                                </div>
                              </div>

                              {/* Right: Summary Metrics */}
                              <div className="grid grid-cols-3 gap-2.5 sm:gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F3DFEE] dark:border-[#203F70]/60 tabular-nums">
                                <div className="sm:border-l sm:border-[#F0D5EC] dark:sm:border-[#203F70] sm:pl-3">
                                  <span className="block text-[10px] text-[#7D4E85] dark:text-[#A8B9D3]">
                                    Minus
                                  </span>
                                  <span className="text-xs sm:text-[13px] font-bold text-rose-600 dark:text-[#FF5B62]">
                                    - {formatCompactRupiah(day.negVal)}
                                  </span>
                                </div>
                                <div className="border-l border-[#F0D5EC] dark:border-[#203F70] pl-2.5 sm:pl-3">
                                  <span className="block text-[10px] text-[#7D4E85] dark:text-[#A8B9D3]">
                                    Lebih
                                  </span>
                                  <span className="text-xs sm:text-[13px] font-bold text-emerald-600 dark:text-[#16D6A0]">
                                    + {formatCompactRupiah(day.posVal)}
                                  </span>
                                </div>
                                <div className="border-l border-[#F0D5EC] dark:border-[#203F70] pl-2.5 sm:pl-3">
                                  <span className="block text-[10px] text-[#7D4E85] dark:text-[#A8B9D3]">
                                    Hasil Hari Itu
                                  </span>
                                  <span
                                    className={`text-xs sm:text-[13px] font-bold tracking-tight ${
                                      dayNet < -0.5
                                        ? 'text-rose-600 dark:text-[#FF5B62]'
                                        : dayNet > 0.5
                                        ? 'text-emerald-600 dark:text-[#16D6A0]'
                                        : 'text-[#6E4877] dark:text-[#A8B9D3]'
                                    }`}
                                  >
                                    {dayNet < -0.5
                                      ? `- ${formatRupiah(dayNet)}`
                                      : dayNet > 0.5
                                      ? `+ ${formatRupiah(dayNet)}`
                                      : 'Pas Rp 0'}
                                  </span>
                                </div>
                              </div>
                            </button>
                          </MotionCard>

                          {/* Item Cards List for this Date */}
                          {isOpen && (
                            <div className="space-y-2.5">
                              {rows.length === 0 ? (
                                <div className="bg-white dark:bg-[#102344] border border-slate-200 dark:border-[#203F70] rounded-xl p-4 text-center text-sm text-slate-500 dark:text-[#A8B9D3]">
                                  Tidak ada barang yang cocok dengan filter di tanggal ini.
                                </div>
                              ) : (
                                rows.map((meta, idx) => (
                                  <ReadableStockRow
                                    key={`${day.date}-${meta.row[0]}-${idx}`}
                                    title={meta.row[0]}
                                    dateLabel={formatDateId(day.date)}
                                    defaultExpanded={false}
                                    meta={meta}
                                    onTitleClick={() =>
                                      handlePickProduct(meta.row[0])
                                    }
                                  />
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </section>
              </>
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
              <>
                <MotionSection className="surface-3d rounded-[32px] p-5 sm:p-7 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#FDE4F7] dark:bg-[#231438] border border-[#F5C5EC] dark:border-[#6A2363] flex items-center justify-center shrink-0">
                        <PackageSearch className="w-4 h-4 sm:w-5 sm:h-5 text-[#6A1064] dark:text-[#FF55C8]" />
                      </div>
                      <div>
                        <h1 className="text-[15px] sm:text-xl font-extrabold tracking-tight text-[#391042] dark:text-white leading-snug">
                          <GsapWordTitle text="Cek Kondisi & Riwayat Barang" />
                        </h1>
                        <p className="text-[11px] sm:text-xs text-[#7D4E85] dark:text-slate-400">
                          {viewScope === 'month'
                            ? `Periode: ${formatMonthId(activeMonth)} (sebulan penuh)`
                            : viewScope === 'range'
                            ? `Periode: ${formatDateRangeLabel(
                                summary.rangeStart,
                                summary.rangeEnd
                              )} (${summary.activeDates.length} hari)`
                            : `Periode: ${formatDateId(activeDay)} (1 hari)`}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveInfoKey('cekBarang')}
                      aria-label="Info penjelasan Cek Barang"
                      title="Penjelasan singkat bagian ini"
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-[1.5px] border-[#6E1269] dark:border-[#FF55C8] text-[#6E1269] dark:text-[#FF55C8] hover:bg-[#FDE4F7]/60 dark:hover:bg-[#FF55C8]/15 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    >
                      <span className="font-serif font-bold text-xs sm:text-sm leading-none">
                        i
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="inline-flex items-center rounded-full border border-[#EBC7E9] dark:border-[#243F6E] bg-white dark:bg-[#0A162B] p-0.5 shadow-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setViewScope('range');
                          setIsRangePickerOpen(true);
                        }}
                        className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-full transition-all min-h-[40px] whitespace-nowrap cursor-pointer ${
                          viewScope === 'range'
                            ? 'wizzmie-pink-pill text-white'
                            : 'text-[#391042] dark:text-slate-300 hover:text-[#B80D84] dark:hover:text-white'
                        }`}
                      >
                        <CalendarRange className="w-4 h-4 shrink-0" />
                        <span>Rentang Tanggal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewScope('day');
                          setIsRangePickerOpen(false);
                        }}
                        className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-full transition-all min-h-[40px] whitespace-nowrap cursor-pointer ${
                          viewScope === 'day'
                            ? 'wizzmie-pink-pill text-white'
                            : 'text-[#391042] dark:text-slate-300 hover:text-[#B80D84] dark:hover:text-white'
                        }`}
                      >
                        <CalendarDays className="w-4 h-4 shrink-0" />
                        <span>Cek 1 Hari</span>
                      </button>
                    </div>

                    {viewScope === 'day' && (
                      <select
                        aria-label="Pilih tanggal di Cek Barang"
                        value={activeDay}
                        onChange={(e) => setSelectedDay(e.target.value)}
                        className="px-4 py-2 text-xs sm:text-sm font-bold rounded-full border border-[#EBC7E9] dark:border-[#243F6E] bg-white dark:bg-[#0A162B] text-[#391042] dark:text-slate-100 min-h-[38px]"
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

                  <div className="relative">
                    <Search className="w-5 h-5 text-[#5D1359] dark:text-[#FF7AD2] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.25]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedProduct('');
                      }}
                      placeholder="Cari nama barang atau kode"
                      autoComplete="off"
                      className="w-full pl-12 pr-12 py-3 text-sm sm:text-base rounded-full border border-[#E5CEEC] dark:border-[#233F6D] bg-[#FAF5FC] dark:bg-[#0A162B] text-[#391042] dark:text-slate-100 placeholder:text-[#9A77A3] dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#E0139C] min-h-[48px]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedProduct('');
                        }}
                        aria-label="Bersihkan pencarian barang"
                        className="w-7 h-7 rounded-full bg-[#EAD4F0] hover:bg-[#DFBEE8] dark:bg-[#1C3259] dark:hover:bg-[#274477] text-[#4C1048] dark:text-slate-200 flex items-center justify-center absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-8 grid grid-cols-4 items-center rounded-full border border-[#E5CEEC] dark:border-[#233F6D] bg-white dark:bg-[#0A162B] p-0.5 overflow-hidden shadow-xs">
                      {(
                        [
                          { id: 'all', label: 'Semua' },
                          { id: 'neg', label: 'Minus' },
                          { id: 'pos', label: 'Lebih' },
                          { id: 'pas', label: 'Pas' },
                        ] as const
                      ).map((tab, idx) => {
                        const isActive = productFilter === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setProductFilter(tab.id)}
                            className={`relative flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm font-bold transition-all min-h-[42px] whitespace-nowrap cursor-pointer ${
                              isActive
                                ? 'wizzmie-pink-pill rounded-full text-white z-10'
                                : `text-[#391042] dark:text-slate-200 hover:text-[#C61196] dark:hover:text-white ${
                                    idx > 0
                                      ? 'border-l border-[#EFE0F3] dark:border-[#1B3258]'
                                      : ''
                                  }`
                            }`}
                          >
                            {isActive && (
                              <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white text-[#C61196] flex items-center justify-center shrink-0 shadow-xs">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </span>
                            )}
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {summary.categoryStats.length > 0 && (
                      <div className="sm:col-span-4 relative">
                        <LayoutGrid className="w-4 h-4 text-[#6E1269] dark:text-[#FF55C8] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                          aria-label="Filter bagian di Cek Barang"
                          value={productCategoryFilter}
                          onChange={(e) => setProductCategoryFilter(e.target.value)}
                          className="w-full appearance-none pl-10 pr-9 py-2.5 text-xs sm:text-sm font-bold rounded-full border border-[#EBC7E9] dark:border-[#233F6D] bg-white dark:bg-[#0A162B] text-[#391042] dark:text-slate-100 min-h-[44px] cursor-pointer"
                        >
                          <option value="ALL">Semua Bagian</option>
                          {summary.categoryStats.map((cat) => (
                            <option key={cat.category} value={cat.category}>
                              {cat.category}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-[#391042] dark:text-slate-300 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.25]" />
                      </div>
                    )}
                  </div>
                </MotionSection>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Left Column: Matching Products List (Reference Card Style) */}
                  <MotionSection className="lg:col-span-5 bg-white dark:bg-[#102344] border border-slate-200 dark:border-[#203F70] rounded-2xl p-3.5 sm:p-4 shadow-md">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h2 className="text-sm font-bold text-slate-900 dark:text-[#F4F7FF] tabular-nums">
                        <GsapWordTitle
                          text={
                            searchQuery.trim()
                              ? `Hasil Pencarian (${matchingProducts.length})`
                              : productFilter === 'pos'
                              ? `Daftar Barang Lebih (${matchingProducts.length})`
                              : productFilter === 'pas'
                              ? `Daftar Barang Pas (${matchingProducts.length})`
                              : productFilter === 'neg'
                              ? `Daftar Barang Minus (${matchingProducts.length})`
                              : `Semua Barang Tercatat (${matchingProducts.length})`
                          }
                        />
                      </h2>
                      <span className="text-[11px] text-slate-500 dark:text-[#A8B9D3]">
                        Ketuk untuk detail
                      </span>
                    </div>

                    {matchingProducts.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-[#A8B9D3] py-6 text-center">
                        Barang tidak ditemukan pada periode ini.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[620px] overflow-y-auto pr-0.5">
                        {matchingProducts.map((name) => {
                          const stat = summary.productMap[name];
                          const isPicked = effectiveSelectedProduct === name;
                          const netQtyText = formatQtyMap(
                            stat.qtyByUnit,
                            name,
                            false
                          );
                          const cleanQtyText = netQtyText
                            .replace(/^(Kurang|Lebih)\s+/i, '')
                            .replace(/^Pas\s*\((.*)\)$/i, '$1');
                          const netState =
                            stat.netVal < -0.5
                              ? 'neg'
                              : stat.netVal > 0.5
                              ? 'pos'
                              : 'eq';
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setSelectedProduct(name);
                                const detailEl = document.getElementById(
                                  'product-detail-panel'
                                );
                                if (detailEl && window.innerWidth < 1024) {
                                  detailEl.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'start',
                                  });
                                }
                              }}
                              className={`w-full p-3 text-left rounded-xl border transition-all cursor-pointer ${
                                isPicked
                                  ? 'bg-amber-50/90 dark:bg-[#17315B] border-amber-400 dark:border-[#FFC400]'
                                  : 'bg-slate-50/70 dark:bg-[#0c1b35] border-slate-200/80 dark:border-[#203F70]/70 hover:border-amber-400/60 dark:hover:border-[#83B9FF]/50'
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0 pr-1">
                                  <div className="text-sm font-bold text-slate-900 dark:text-[#F4F7FF] leading-snug truncate">
                                    {name}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-[#A8B9D3] mt-0.5 truncate">
                                    {stat.code ? `Kode: ${stat.code} · ` : ''}
                                    {stat.category}
                                    {stat.subcategory &&
                                    stat.subcategory !== stat.category
                                      ? ` / ${stat.subcategory}`
                                      : ''}
                                  </div>
                                </div>

                                <div className="text-right shrink-0 tabular-nums">
                                  <div className="flex items-center justify-end space-x-1.5">
                                    <span
                                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded leading-none ${
                                        netState === 'neg'
                                          ? 'bg-rose-500 dark:bg-[#FF5B62] text-white'
                                          : netState === 'pos'
                                          ? 'bg-emerald-500 dark:bg-[#16D6A0] text-white dark:text-[#061329]'
                                          : 'bg-slate-200 dark:bg-[#17315B] text-slate-700 dark:text-[#A8B9D3]'
                                      }`}
                                    >
                                      {netState === 'neg'
                                        ? 'MINUS'
                                        : netState === 'pos'
                                        ? 'LEBIH'
                                        : 'PAS'}
                                    </span>
                                    <span
                                      className={`text-xs font-bold ${
                                        netState === 'neg'
                                          ? 'text-rose-600 dark:text-[#FF5B62]'
                                          : netState === 'pos'
                                          ? 'text-emerald-600 dark:text-[#16D6A0]'
                                          : 'text-slate-500 dark:text-[#A8B9D3]'
                                      }`}
                                    >
                                      {cleanQtyText}
                                    </span>
                                  </div>
                                  <div
                                    className={`text-[11px] font-semibold mt-0.5 tracking-tight font-mono ${
                                      netState === 'neg'
                                        ? 'text-rose-600 dark:text-[#FF5B62]'
                                        : netState === 'pos'
                                        ? 'text-emerald-600 dark:text-[#16D6A0]'
                                        : 'text-slate-500 dark:text-[#A8B9D3]'
                                    }`}
                                  >
                                    {netState === 'neg'
                                      ? `- ${formatRupiah(stat.netVal)}`
                                      : netState === 'pos'
                                      ? `+ ${formatRupiah(stat.netVal)}`
                                      : 'Rp 0'}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </MotionSection>

                  {/* Right Column: Product Summary Card & Daily Item Cards */}
                  <div
                    id="product-detail-panel"
                    className="lg:col-span-7 space-y-3"
                  >
                    {!selectedProductStat ? (
                      <div className="bg-white dark:bg-[#102344] border border-slate-200 dark:border-[#203F70] rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-[#A8B9D3]">
                        Ketuk salah satu barang di sebelah kiri untuk melihat kode barang, harga satuan, jumlah kemasan, dan riwayat tanggalnya.
                      </div>
                    ) : (
                      <>
                        {/* Product Summary Card (Reference DateSummaryCard / ItemCard Header Style) */}
                        <MotionSection className="bg-white dark:bg-[#102344] border border-slate-200 dark:border-[#203F70] rounded-2xl overflow-hidden shadow-md">
                          <div className="p-3.5 sm:p-4 space-y-3">
                            <div className="flex justify-between items-start gap-3">
                              <div className="min-w-0">
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F4F7FF] leading-snug">
                                  <GsapWordTitle text={selectedProductStat.name} />
                                </h2>
                                <span className="block text-[11px] text-slate-500 dark:text-[#A8B9D3] mt-0.5">
                                  {selectedProductStat.code
                                    ? `Kode: ${selectedProductStat.code} · `
                                    : ''}
                                  Bagian: {selectedProductStat.category}
                                  {selectedProductStat.subcategory &&
                                  selectedProductStat.subcategory !==
                                    selectedProductStat.category
                                    ? ` / ${selectedProductStat.subcategory}`
                                    : ''}
                                </span>
                              </div>

                              {(() => {
                                const netState =
                                  selectedProductStat.netVal < -0.5
                                    ? 'neg'
                                    : selectedProductStat.netVal > 0.5
                                    ? 'pos'
                                    : 'eq';
                                const netQtyLabel = formatQtyMap(
                                  selectedProductStat.qtyByUnit,
                                  selectedProductStat.name,
                                  false
                                )
                                  .replace(/^(Kurang|Lebih)\s+/i, '')
                                  .replace(/^Pas\s*\((.*)\)$/i, '$1');
                                return (
                                  <div className="text-right shrink-0 tabular-nums">
                                    <div className="flex items-center justify-end space-x-1.5">
                                      <span
                                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded leading-none ${
                                          netState === 'neg'
                                            ? 'bg-rose-500 dark:bg-[#FF5B62] text-white'
                                            : netState === 'pos'
                                            ? 'bg-emerald-500 dark:bg-[#16D6A0] text-white dark:text-[#061329]'
                                            : 'bg-slate-200 dark:bg-[#17315B] text-slate-700 dark:text-[#A8B9D3]'
                                        }`}
                                      >
                                        {netState === 'neg'
                                          ? 'MINUS'
                                          : netState === 'pos'
                                          ? 'LEBIH'
                                          : 'PAS'}
                                      </span>
                                      <span
                                        className={`text-xs sm:text-sm font-bold ${
                                          netState === 'neg'
                                            ? 'text-rose-600 dark:text-[#FF5B62]'
                                            : netState === 'pos'
                                            ? 'text-emerald-600 dark:text-[#16D6A0]'
                                            : 'text-slate-500 dark:text-[#A8B9D3]'
                                        }`}
                                      >
                                        {netQtyLabel}
                                      </span>
                                    </div>
                                    <div
                                      className={`text-xs font-semibold mt-0.5 tracking-tight font-mono ${
                                        netState === 'neg'
                                          ? 'text-rose-600 dark:text-[#FF5B62]'
                                          : netState === 'pos'
                                          ? 'text-emerald-600 dark:text-[#16D6A0]'
                                          : 'text-slate-500 dark:text-[#A8B9D3]'
                                      }`}
                                    >
                                      {netState === 'neg'
                                        ? `- ${formatRupiah(selectedProductStat.netVal)}`
                                        : netState === 'pos'
                                        ? `+ ${formatRupiah(selectedProductStat.netVal)}`
                                        : 'Rp 0'}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Side-by-Side Period Summary Box */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 dark:bg-[#0c1b35] p-3 rounded-xl border border-slate-200/80 dark:border-[#203F70]/60 text-xs tabular-nums">
                              <div>
                                <p className="text-[10px] text-slate-500 dark:text-[#A8B9D3] leading-tight">
                                  Saat Minus ({selectedProductStat.negDays} hari)
                                </p>
                                <p className="font-bold text-rose-600 dark:text-[#FF5B62] text-xs sm:text-[13px] mt-0.5">
                                  {Object.keys(selectedProductStat.negQtyByUnit)
                                    .length > 0
                                    ? formatQtyMap(
                                        selectedProductStat.negQtyByUnit,
                                        selectedProductStat.name,
                                        false
                                      )
                                    : '0'}
                                </p>
                                <p className="text-[11px] font-mono font-semibold text-rose-600/90 dark:text-[#FF5B62]/90">
                                  - {formatRupiah(selectedProductStat.negVal)}
                                </p>
                              </div>

                              <div className="sm:border-l border-t sm:border-t-0 border-slate-200 dark:border-[#203F70]/60 pt-2 sm:pt-0 sm:pl-3">
                                <p className="text-[10px] text-slate-500 dark:text-[#A8B9D3] leading-tight">
                                  Saat Lebih ({selectedProductStat.posDays} hari)
                                </p>
                                <p className="font-bold text-emerald-600 dark:text-[#16D6A0] text-xs sm:text-[13px] mt-0.5">
                                  {Object.keys(selectedProductStat.posQtyByUnit)
                                    .length > 0
                                    ? formatQtyMap(
                                        selectedProductStat.posQtyByUnit,
                                        selectedProductStat.name,
                                        false
                                      )
                                    : '0'}
                                </p>
                                <p className="text-[11px] font-mono font-semibold text-emerald-600/90 dark:text-[#16D6A0]/90">
                                  + {formatRupiah(selectedProductStat.posVal)}
                                </p>
                              </div>

                              <div className="sm:border-l border-t sm:border-t-0 border-slate-200 dark:border-[#203F70]/60 pt-2 sm:pt-0 sm:pl-3">
                                <p className="text-[10px] text-slate-500 dark:text-[#A8B9D3] leading-tight">
                                  {viewScope === 'month'
                                    ? 'Hasil Akhir Bulan Ini'
                                    : viewScope === 'range'
                                    ? `Hasil ${formatDateRangeLabel(
                                        summary.rangeStart,
                                        summary.rangeEnd
                                      )}`
                                    : `Hasil Tgl ${formatDateId(activeDay)}`}
                                </p>
                                <p
                                  className={`font-bold text-xs sm:text-[13px] mt-0.5 ${
                                    selectedProductStat.netVal < -0.5
                                      ? 'text-rose-600 dark:text-[#FF5B62]'
                                      : selectedProductStat.netVal > 0.5
                                      ? 'text-emerald-600 dark:text-[#16D6A0]'
                                      : 'text-slate-900 dark:text-[#F4F7FF]'
                                  }`}
                                >
                                  {formatQtyMap(
                                    selectedProductStat.qtyByUnit,
                                    selectedProductStat.name,
                                    false
                                  )}
                                </p>
                                <p
                                  className={`text-[11px] font-mono font-semibold ${
                                    selectedProductStat.netVal < -0.5
                                      ? 'text-rose-600 dark:text-[#FF5B62]'
                                      : selectedProductStat.netVal > 0.5
                                      ? 'text-emerald-600 dark:text-[#16D6A0]'
                                      : 'text-slate-500 dark:text-[#A8B9D3]'
                                  }`}
                                >
                                  {selectedProductStat.netVal < -0.5
                                    ? `- ${formatRupiah(selectedProductStat.netVal)}`
                                    : selectedProductStat.netVal > 0.5
                                    ? `+ ${formatRupiah(selectedProductStat.netVal)}`
                                    : 'Pas Rp 0'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Product Metadata Strip */}
                          <div className="bg-slate-50/90 dark:bg-[#17315B]/50 border-t border-slate-200 dark:border-[#203F70] px-3.5 py-2.5 grid grid-cols-2 gap-y-1.5 gap-x-3 text-[11px]">
                            <div>
                              <span className="block text-[9px] text-slate-500 dark:text-[#A8B9D3]/80">
                                Harga / Unit:
                              </span>
                              <span className="text-slate-900 dark:text-[#F4F7FF] font-medium font-mono">
                                {selectedProductStat.lastUnitPrice > 0
                                  ? formatRupiah(selectedProductStat.lastUnitPrice, false)
                                  : '-'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-slate-500 dark:text-[#A8B9D3]/80">
                                Kemasan / Konversi:
                              </span>
                              <span className="text-slate-900 dark:text-[#F4F7FF] font-medium">
                                {getItemPackagingSpec(selectedProductStat.name)
                                  ?.specText || '-'}
                              </span>
                            </div>
                          </div>
                        </MotionSection>

                        {/* Daily History Cards for Selected Product */}
                        <div className="space-y-2.5">
                          {selectedProductTimeline.map(({ date, meta }, idx) => (
                            <ReadableStockRow
                              key={`${date}-${idx}`}
                              title={formatDateId(date)}
                              subtitle={selectedProductStat.name}
                              dateLabel={formatDateId(date)}
                              defaultExpanded={false}
                              meta={meta}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* PAGE 5: PENGATURAN (TERMASUK UPLOAD EXCEL) */}
        {activeTab === 'pengaturan' && (
          <div className="space-y-5 max-w-4xl">
            <MotionSection className="surface-3d rounded-3xl p-5 sm:p-7 space-y-5">
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    <GsapWordTitle text="Upload Laporan Excel" />
                  </h1>
                  <InfoButton guideKey="upload" onOpen={setActiveInfoKey} />
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Pilih file laporan <strong>Stock Opname</strong> atau <strong>Profit Loss Consolidation</strong> (.xlsx / .xls). Semua baris, tanggal, bulan, dan rumus langsung dirapikan otomatis.
                </p>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
                }}
                className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 cursor-pointer transition-colors grid grid-cols-1 md:grid-cols-12 gap-6 items-center ${
                  isDragging
                    ? 'border-amber-500 bg-amber-50/70 dark:border-amber-400 dark:bg-amber-950/25'
                    : 'border-slate-300 dark:border-[#1E355D] bg-slate-50/60 dark:bg-[#0A162B] hover:border-amber-500 dark:hover:border-amber-400'
                }`}
              >
                <div className="md:col-span-7 text-center md:text-left space-y-2.5">
                  <div className="mx-auto md:mx-0 w-12 h-12 rounded-2xl bg-amber-100/90 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shadow-xs">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <p className="text-base sm:text-lg font-bold text-amber-800 dark:text-amber-300">
                    Ketuk di sini untuk pilih file Excel (.xlsx / .xls)
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Atau tarik file langsung ke kotak ini. Aman upload berulang kali — tanggal yang sama otomatis diperbarui tanpa dobel.
                  </p>
                </div>

                <div className="md:col-span-5 rounded-2xl overflow-hidden bg-white dark:bg-[#0D1C34] h-40 sm:h-48 shadow-[0_10px_24px_-12px_rgba(15,23,42,0.18)]">
                  {!uploadImgFailed ? (
                    <img
                      src={uploadExcel3d}
                      alt="Ilustrasi 3D file Excel berubah menjadi data stok rapi"
                      referrerPolicy="no-referrer"
                      onError={() => setUploadImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <FileSpreadsheet className="w-12 h-12 opacity-75" />
                    </div>
                  )}
                </div>
              </div>
            </MotionSection>

            {lastUpload && (
              <MotionSection className="surface-3d rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      <GsapWordTitle text="Upload Berhasil" />
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                      Semua <strong>{lastUpload.totalRows} catatan stok</strong> ({lastUpload.uniqueProducts} jenis barang: {lastUpload.diffRows} selisih, {lastUpload.pasRows} pas) sudah masuk ke{' '}
                      <strong>
                        {lastUpload.monthsAffected.map(formatMonthId).join(', ')}
                      </strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('beranda')}
                    className="btn-3d-primary px-4 py-2.5 text-sm font-semibold rounded-xl flex items-center gap-2 self-start sm:self-auto min-h-[44px] whitespace-nowrap cursor-pointer"
                  >
                    <span>Lihat Hasil di Beranda</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-sm">
                  <div>
                    <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                      Tanggal baru ({lastUpload.addedDates.length})
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      {lastUpload.addedDates.length > 0
                        ? lastUpload.addedDates.map(formatDateId).join(', ')
                        : 'Tidak ada tanggal baru.'}
                    </p>
                  </div>
                  <div>
                    <div className="font-semibold text-amber-700 dark:text-amber-300">
                      Tanggal diperbarui ({lastUpload.updatedDates.length})
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      {lastUpload.updatedDates.length > 0
                        ? lastUpload.updatedDates.map(formatDateId).join(', ')
                        : 'Tidak ada yang diperbarui.'}
                    </p>
                  </div>
                </div>
              </MotionSection>
            )}

            {allMonths.length > 0 && (
              <MotionSection className="surface-3d rounded-3xl p-5 sm:p-6 space-y-3">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  <GsapWordTitle text="Data Bulan yang Tersimpan" />
                </h2>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {allMonths.map((m) => (
                    <div
                      key={m}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {formatMonthId(m)}
                        </div>
                        <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                          {monthCounts[m]} hari tersimpan
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectMonth(m);
                          setActiveTab('beranda');
                        }}
                        className="btn-3d-soft px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-800 dark:text-slate-100 min-h-[40px] cursor-pointer"
                      >
                        Buka Bulan Ini
                      </button>
                    </div>
                  ))}
                </div>
              </MotionSection>
            )}

            <MotionSection className="surface-3d rounded-3xl p-5 sm:p-6 space-y-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#391042] dark:text-white">
                  <GsapWordTitle text="Pengaturan Tampilan" />
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Pilih tema tampilan Wizzmie Pink &amp; Plum (Cerah) atau Navy &amp; Gold (Gelap) sesuai kenyamanan Anda.
                </p>
              </div>

              <div className="pt-2 border-t border-[#F0D5EC] dark:border-slate-800/90">
                <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[#391042] dark:text-white">
                      Tema Tampilan
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {isDark
                        ? 'Aktif: Tema Gelap (Navy & Gold)'
                        : 'Aktif: Tema Wizzmie Pink & Plum (Cerah)'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDark((prev) => !prev)}
                    className="btn-3d-soft px-4 py-2.5 text-sm font-semibold rounded-xl text-[#391042] dark:text-slate-100 flex items-center gap-2 self-start sm:self-auto min-h-[44px] cursor-pointer"
                  >
                    {isDark ? (
                      <Sun className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Moon className="w-4 h-4 text-[#C61196]" />
                    )}
                    <span>
                      {isDark
                        ? 'Pakai Tema Wizzmie Pink (Cerah)'
                        : 'Ganti ke Tema Gelap (Navy & Gold)'}
                    </span>
                  </button>
                </div>
              </div>
            </MotionSection>
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

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Menu utama"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#061329]/95 backdrop-blur-md border-t border-[#EBC7E9] dark:border-[#203F70] shadow-[0_-8px_24px_-6px_rgba(110,17,104,0.18)]"
      >
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] px-0.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#C61196] dark:text-[#FFC400] font-bold'
                    : 'text-[#6E4877] dark:text-[#A8B9D3] font-medium hover:text-[#391042] dark:hover:text-[#F4F7FF]'
                }`}
              >
                {item.icon}
                <span className="text-[10px] leading-none truncate max-w-full">
                  {item.mobileLabel}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[3px] rounded-t-full bg-[#E0139C] dark:bg-[#FFC400]" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Global Date Range Pop-up Modal */}
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
          rangeStart={activeRange.start}
          rangeEnd={activeRange.end}
          isOpen={isRangePickerOpen}
          onOpenChange={setIsRangePickerOpen}
          onConfirm={(start, end) => {
            setDateRange({ start, end });
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

        <div className="lg:col-span-5 rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50 via-white to-sky-50 dark:from-[#0D1C34] dark:via-[#10213F] dark:to-[#070D1E] border border-slate-200 dark:border-[#1E355D] shadow-[0_12px_28px_-12px_rgba(245,158,11,0.22)] min-h-[220px]">
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
        className="bg-white dark:bg-[#102344] border border-[#EBC7E9] dark:border-[#203F70] rounded-2xl overflow-hidden shadow-sm transition-all duration-200"
        data-purpose="inventory-item"
      >
        <div className="p-3.5 sm:p-4">
          {/* Top Row: Product Name & Diff Status Tag */}
          <div className="flex justify-between items-start gap-2 mb-2.5">
            <div className="pr-2 min-w-0">
              {onTitleClick ? (
                <button
                  type="button"
                  onClick={onTitleClick}
                  className="text-sm sm:text-[15px] font-bold text-[#391042] dark:text-[#F4F7FF] hover:text-[#C61196] dark:hover:text-[#FFC400] leading-snug text-left break-words cursor-pointer"
                >
                  {title}
                </button>
              ) : (
                <h2 className="text-sm sm:text-[15px] font-bold text-[#391042] dark:text-[#F4F7FF] leading-snug break-words">
                  {title}
                </h2>
              )}
              <span className="block text-[10px] sm:text-[11px] text-[#7D4E85] dark:text-[#A8B9D3] mt-0.5">
                {subtitleText}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsFormulaOpen(true)}
              title="Ketuk untuk lihat rumus lengkap selisih"
              className="text-right shrink-0 tabular-nums rounded-lg px-1.5 py-1 -mr-1.5 -mt-1 hover:bg-[#FDF3FB] dark:hover:bg-[#17315B]/70 transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-end space-x-1.5">
                <span
                  className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full leading-none tracking-wide ${
                    state === 'neg'
                      ? 'bg-rose-500 dark:bg-[#FF5B62] text-white'
                      : state === 'pos'
                      ? 'bg-emerald-500 dark:bg-[#16D6A0] text-white dark:text-[#061329]'
                      : 'bg-[#F3E2F1] dark:bg-[#17315B] text-[#5B2163] dark:text-[#A8B9D3]'
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
                      : 'text-[#6E4877] dark:text-[#A8B9D3]'
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
                    : 'text-[#6E4877] dark:text-[#A8B9D3]'
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

          {/* Middle Row: Compact Side-by-Side Comparison (Di Sistem ESB vs Hitungan Gudang) */}
          <div className="grid grid-cols-2 gap-2 bg-[#FAF5FC] dark:bg-[#0c1b35] p-2.5 rounded-xl border border-[#EDD5EC] dark:border-[#203F70]/60 text-xs tabular-nums">
            <div className="flex items-center space-x-2">
              <svg
                className="w-4 h-4 text-[#C61196] dark:text-[#83B9FF] shrink-0"
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
                <p className="text-[10px] text-[#7D4E85] dark:text-[#A8B9D3] leading-tight">
                  Di Sistem ESB
                </p>
                <p className="font-bold text-[#391042] dark:text-[#F4F7FF] text-xs sm:text-[13px] font-mono mt-0.5">
                  {formatQty(sysQty)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 border-l border-[#EBCEE9] dark:border-[#203F70]/50 pl-2.5">
              <svg
                className="w-4 h-4 text-[#C61196] dark:text-[#83B9FF] shrink-0"
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
                <p className="text-[10px] text-[#7D4E85] dark:text-[#A8B9D3] leading-tight">
                  Hitungan Gudang
                </p>
                <p className="font-bold text-[#391042] dark:text-[#F4F7FF] text-xs sm:text-[13px] font-mono mt-0.5">
                  {formatQty(opQty)} {unit}
                </p>
              </div>
            </div>
          </div>

          {/* Expanded Quick Metrics Row (Harga / Unit & Selisih in dus/pack/botol equivalent, or blank if none) */}
          {isExpanded && (
            <div className="grid grid-cols-12 gap-2 pt-2.5 mt-2.5 border-t border-[#EED7EC] dark:border-[#203F70]/60 text-xs tabular-nums">
              <div className="col-span-5 flex items-center space-x-1.5 min-w-0">
                <svg
                  className="w-3.5 h-3.5 text-[#C61196] dark:text-[#FFC400] shrink-0"
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
                  <p className="text-[10px] text-[#7D4E85] dark:text-[#A8B9D3] leading-tight">
                    Harga / Unit
                  </p>
                  <p className="font-bold text-[#391042] dark:text-[#F4F7FF] text-[11px] sm:text-xs font-mono mt-0.5 whitespace-nowrap">
                    {valUnit > 0 ? formatRupiah(valUnit, false) : '-'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFormulaOpen(true)}
                title="Ketuk untuk lihat rincian rumus selisih"
                className="col-span-7 flex items-center space-x-1.5 border-l border-[#EBCEE9] dark:border-[#203F70]/50 pl-2 min-w-0 text-left rounded-lg py-0.5 -my-0.5 hover:bg-[#FDF3FB] dark:hover:bg-[#17315B]/70 transition-colors cursor-pointer group"
              >
                <svg
                  className="w-3.5 h-3.5 text-[#C61196] dark:text-[#83B9FF] shrink-0"
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
                  <p className="text-[10px] text-[#7D4E85] dark:text-[#A8B9D3] leading-tight">
                    Selisih
                  </p>
                  <p
                    className={`font-bold text-[11px] sm:text-xs font-mono mt-0.5 min-h-[16px] whitespace-nowrap group-hover:underline ${
                      state === 'neg'
                        ? 'text-rose-600 dark:text-[#FF5B62]'
                        : state === 'pos'
                        ? 'text-emerald-600 dark:text-[#16D6A0]'
                        : 'text-[#6E4877] dark:text-[#A8B9D3]'
                    }`}
                  >
                    {selisihDetailText || 'Pas (0)'}
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Disclosed Metadata Section */}
        {isExpanded && (
          <div
            className="bg-[#FDF7FC] dark:bg-[#17315B]/50 border-t border-[#EED7EC] dark:border-[#203F70] px-3.5 py-2.5 space-y-2 text-[11px]"
            data-purpose="item-expanded-metadata"
          >
            <div>
              <span className="block text-[9px] text-[#7D4E85] dark:text-[#A8B9D3]/80">
                Kemasan / Konversi:
              </span>
              <span className="text-[#391042] dark:text-[#F4F7FF] font-medium">
                {packagingDisplay}
              </span>
            </div>

            <div className="pt-2 border-t border-[#EED7EC] dark:border-[#203F70]/60 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] text-[#7D4E85] dark:text-[#A8B9D3] tabular-nums font-mono">
                {fileDateSummaryLine}
              </span>
              <button
                type="button"
                onClick={() => setIsFormulaOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FDE7F8] hover:bg-[#FAD2F1] dark:bg-[#83B9FF]/15 dark:hover:bg-[#83B9FF]/25 border border-[#F2BCE7] dark:border-[#83B9FF]/30 text-[10px] font-bold text-[#8E106E] dark:text-[#83B9FF] transition-colors cursor-pointer"
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
          className="w-full py-1.5 px-3 bg-[#FAF0F8] hover:bg-[#F5E2F2] dark:bg-[#14284b] dark:hover:bg-[#17315B]/80 flex items-center justify-center space-x-1.5 text-[11px] text-[#5E1A59] dark:text-[#A8B9D3] font-semibold border-t border-[#EED7EC] dark:border-[#203F70] transition-colors cursor-pointer"
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl bg-white dark:bg-[#08152C] border border-slate-200 dark:border-[#203F70] rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col shadow-2xl"
      >
        {/* Premium Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200/80 dark:border-[#203F70] bg-slate-50/90 dark:bg-[#061124] flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/35 text-amber-700 dark:text-[#FFC400]">
                Rincian Rumus Perhitungan
              </span>
              {dateLabel && (
                <span className="text-xs font-semibold text-slate-500 dark:text-[#A8B9D3]">
                  {dateLabel}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-[#F4F7FF] leading-snug pt-0.5">
              {b.productName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#A8B9D3]">
              {b.productCode ? `Kode: ${b.productCode} · ` : ''}Bagian:{' '}
              {b.category}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup penjelasan rumus"
            className="w-9 h-9 rounded-xl bg-slate-200/70 dark:bg-[#142B52] border border-slate-300/60 dark:border-[#254980] text-slate-600 dark:text-[#F4F7FF] hover:opacity-80 flex items-center justify-center cursor-pointer shrink-0"
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
                ? 'bg-rose-50/90 dark:bg-[#19162B] border-rose-200 dark:border-[#FF5B62]/40'
                : b.state === 'pos'
                ? 'bg-emerald-50/90 dark:bg-[#0D272F] border-emerald-200 dark:border-[#16D6A0]/40'
                : 'bg-slate-100 dark:bg-[#102344] border-slate-200 dark:border-[#203F70]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A8B9D3]">
                Hasil Akhir Selisih
              </span>
              <span
                className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full tracking-wide ${
                  b.state === 'neg'
                    ? 'bg-rose-500 dark:bg-[#FF5B62] text-white'
                    : b.state === 'pos'
                    ? 'bg-emerald-500 dark:bg-[#16D6A0] text-white dark:text-[#061329]'
                    : 'bg-slate-300 dark:bg-[#17315B] text-slate-800 dark:text-[#F4F7FF]'
                }`}
              >
                {statusWord}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/70 dark:border-white/10 tabular-nums">
              <div>
                <span className="block text-[11px] text-slate-500 dark:text-[#A8B9D3]">
                  Jumlah Selisih Fisik
                </span>
                <div
                  className={`text-lg sm:text-xl font-black font-mono mt-0.5 ${
                    b.state === 'neg'
                      ? 'text-rose-600 dark:text-[#FF5B62]'
                      : b.state === 'pos'
                      ? 'text-emerald-600 dark:text-[#16D6A0]'
                      : 'text-slate-800 dark:text-[#F4F7FF]'
                  }`}
                >
                  {signSymbol} {formatQty(Math.abs(b.diffQty))} {b.unit}
                </div>
                {selisihDetailText && (
                  <div className="text-xs font-semibold text-slate-600 dark:text-[#A8B9D3] font-mono mt-0.5">
                    Setara: {selisihDetailText}
                  </div>
                )}
              </div>

              <div className="sm:text-right sm:border-l sm:border-slate-200/70 dark:sm:border-white/10 sm:pl-4">
                <span className="block text-[11px] text-slate-500 dark:text-[#A8B9D3]">
                  Nilai Rupiah Selisih
                </span>
                <div
                  className={`text-lg sm:text-xl font-black font-mono mt-0.5 ${
                    b.state === 'neg'
                      ? 'text-rose-600 dark:text-[#FF5B62]'
                      : b.state === 'pos'
                      ? 'text-emerald-600 dark:text-[#16D6A0]'
                      : 'text-slate-600 dark:text-[#A8B9D3]'
                  }`}
                >
                  {b.state === 'eq'
                    ? 'Rp 0'
                    : `${signSymbol} ${formatRupiah(b.diffVal)}`}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-[#A8B9D3] font-mono mt-0.5">
                  Di file Excel: {outerFileDiff}
                </div>
              </div>
            </div>
          </div>

          {/* Step 1: Rumus Dasar Selisih */}
          <div className="bg-slate-50/90 dark:bg-[#102344] border border-slate-200 dark:border-[#203F70] rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-sky-500/15 dark:bg-[#83B9FF]/20 border border-sky-500/30 dark:border-[#83B9FF]/30 text-sky-700 dark:text-[#83B9FF] font-extrabold text-xs flex items-center justify-center shrink-0">
                1
              </span>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-[#F4F7FF] text-sm">
                  Cara Hitung Selisih Jumlah ({b.unit})
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-[#A8B9D3]">
                  Rumus: Hitungan Gudang dikurangi Di Sistem ESB
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#061329] border border-slate-200/80 dark:border-[#203F70] rounded-xl p-3.5 font-mono text-xs sm:text-[13px] tabular-nums space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-sans text-slate-500 dark:text-[#A8B9D3]">
                  Hitungan Gudang (Fisik)
                </span>
                <span className="font-bold text-slate-900 dark:text-[#F4F7FF]">
                  {formatQty(b.opQty)} {b.unit}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-sans text-slate-500 dark:text-[#A8B9D3]">
                  Di Sistem ESB
                </span>
                <span className="font-bold text-slate-900 dark:text-[#F4F7FF]">
                  - {formatQty(b.sysQty)} {b.unit}
                </span>
              </div>
              <div className="border-t border-slate-200 dark:border-[#203F70] pt-2.5 flex items-center justify-between gap-3">
                <span className="font-sans font-bold text-slate-800 dark:text-[#F4F7FF]">
                  Hasil Selisih
                </span>
                <span
                  className={`text-sm font-extrabold ${
                    b.state === 'neg'
                      ? 'text-rose-600 dark:text-[#FF5B62]'
                      : b.state === 'pos'
                      ? 'text-emerald-600 dark:text-[#16D6A0]'
                      : 'text-slate-900 dark:text-[#F4F7FF]'
                  }`}
                >
                  = {formatSignedQty(b.diffQty)} {b.unit}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#A8B9D3] leading-relaxed">
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
          <div className="bg-slate-50/90 dark:bg-[#102344] border border-slate-200 dark:border-[#203F70] rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-amber-500/15 dark:bg-[#FFC400]/20 border border-amber-500/30 dark:border-[#FFC400]/30 text-amber-700 dark:text-[#FFC400] font-extrabold text-xs flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-[#F4F7FF] text-sm">
                  Cara Hitung Konversi Kemasan (Dus / Pack)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-[#A8B9D3]">
                  Mengubah {formatQty(Math.abs(b.diffQty))} {b.unit} ke satuan kemasan gudang
                </p>
              </div>
            </div>

            <div className="bg-amber-500/10 dark:bg-[#17315B]/80 border border-amber-500/25 dark:border-[#254980] rounded-xl px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs text-slate-500 dark:text-[#A8B9D3]">
                Standar Kemasan Barang:
              </span>
              <strong className="text-xs sm:text-sm text-slate-900 dark:text-[#FFC400]">
                {b.specText}
              </strong>
            </div>

            {b.conversionSteps.length > 0 ? (
              <div className="space-y-2.5">
                {b.conversionSteps.map((step, i) => (
                  <div
                    key={`${step.targetUnitLabel}-${i}`}
                    className="bg-white dark:bg-[#061329] border border-slate-200/80 dark:border-[#203F70] rounded-xl p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-[#F4F7FF]">
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

                    <div className="bg-slate-50 dark:bg-[#0c1b35] border border-slate-200/60 dark:border-[#203F70]/60 rounded-lg px-3 py-2 font-mono text-xs tabular-nums flex items-center justify-between gap-2">
                      <span className="text-slate-600 dark:text-[#A8B9D3]">
                        {step.formulaText}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-[#F4F7FF]">
                        = {step.resultText}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-[#A8B9D3] leading-relaxed">
                      {step.explanationText}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-[#A8B9D3]">
                Barang ini menggunakan satuan dasar ({b.unit}) tanpa konversi dus/pack tambahan.
              </p>
            )}

            <div className="bg-white dark:bg-[#061329] border border-slate-200/80 dark:border-[#203F70] rounded-xl p-3.5 space-y-1.5">
              <div className="text-xs font-bold text-slate-800 dark:text-[#F4F7FF]">
                Asal Angka &ldquo;Di file {outerFileDiff}&rdquo;
              </div>
              {b.wasConvertedFromFile ? (
                <p className="text-xs text-slate-600 dark:text-[#A8B9D3] leading-relaxed">
                  Di file Excel asli, barang ini tercatat dalam satuan{' '}
                  <strong>{b.originalUnit}</strong> sebesar{' '}
                  <strong className="font-mono text-slate-900 dark:text-[#F4F7FF]">
                    {formatSignedQty(b.originalDiffQty)} {b.originalUnit}
                  </strong>
                  . Aplikasi mengalikan{' '}
                  <strong className="font-mono text-slate-900 dark:text-[#F4F7FF]">
                    {formatSignedQty(b.originalDiffQty)} × {b.originalFactor}
                  </strong>{' '}
                  agar tampil dalam satuan{' '}
                  <strong className="font-mono text-slate-900 dark:text-[#F4F7FF]">
                    {formatSignedQty(b.diffQty)} {b.unit}
                  </strong>
                  .
                </p>
              ) : (
                <p className="text-xs text-slate-600 dark:text-[#A8B9D3] leading-relaxed">
                  Angka{' '}
                  <strong className="font-mono text-slate-900 dark:text-[#F4F7FF]">
                    {outerFileDiff}
                  </strong>{' '}
                  adalah hasil konversi selisih{' '}
                  <strong className="font-mono text-slate-900 dark:text-[#F4F7FF]">
                    {formatSignedQty(b.diffQty)} {b.unit}
                  </strong>{' '}
                  ke satuan kemasan utama (2 angka di belakang koma sesuai standar laporan Excel).
                </p>
              )}
            </div>
          </div>

          {/* Step 3: Rumus Nilai Rupiah */}
          <div className="bg-slate-50/90 dark:bg-[#102344] border border-slate-200 dark:border-[#203F70] rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/15 dark:bg-[#16D6A0]/20 border border-emerald-500/30 dark:border-[#16D6A0]/30 text-emerald-700 dark:text-[#16D6A0] font-extrabold text-xs flex items-center justify-center shrink-0">
                3
              </span>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-[#F4F7FF] text-sm">
                  Cara Hitung Nilai Rupiah
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-[#A8B9D3]">
                  Rumus: Jumlah Selisih dikali Harga Satuan
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#061329] border border-slate-200/80 dark:border-[#203F70] rounded-xl p-3.5 font-mono text-xs sm:text-[13px] tabular-nums space-y-2.5">
              {b.wasConvertedFromFile && b.originalFactor > 1 ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-sans text-slate-500 dark:text-[#A8B9D3]">
                      Selisih di File ({b.originalUnit})
                    </span>
                    <span className="font-bold text-slate-900 dark:text-[#F4F7FF]">
                      {formatSignedQty(b.originalDiffQty)} {b.originalUnit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-sans text-slate-500 dark:text-[#A8B9D3]">
                      Harga per {b.originalUnit}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-[#F4F7FF]">
                      × {formatRupiah(b.valUnit, false)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-sans text-slate-500 dark:text-[#A8B9D3]">
                      Jumlah Selisih ({b.unit})
                    </span>
                    <span className="font-bold text-slate-900 dark:text-[#F4F7FF]">
                      {formatSignedQty(b.diffQty)} {b.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-sans text-slate-500 dark:text-[#A8B9D3]">
                      Harga / Unit ({b.unit})
                    </span>
                    <span className="font-bold text-slate-900 dark:text-[#F4F7FF]">
                      × {formatRupiah(b.valUnit, false)}
                    </span>
                  </div>
                </>
              )}
              <div className="border-t border-slate-200 dark:border-[#203F70] pt-2.5 flex items-center justify-between gap-3">
                <span className="font-sans font-bold text-slate-800 dark:text-[#F4F7FF]">
                  Total Nilai Selisih
                </span>
                <span
                  className={`text-sm font-extrabold ${
                    b.state === 'neg'
                      ? 'text-rose-600 dark:text-[#FF5B62]'
                      : b.state === 'pos'
                      ? 'text-emerald-600 dark:text-[#16D6A0]'
                      : 'text-slate-900 dark:text-[#F4F7FF]'
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
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-[#203F70] bg-slate-50 dark:bg-[#061124] shrink-0">
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
      box: 'bg-slate-50/90 dark:bg-[#0D1C34] border-slate-200/80 dark:border-[#1A3157]',
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
      box: 'bg-slate-50/90 dark:bg-[#0D1C34] border-slate-200/80 dark:border-[#1A3157]',
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
              {monthCount > 1 ? ` · ${monthCount} bulan tersimpan` : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenProfitLoss(report.monthKey)}
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
