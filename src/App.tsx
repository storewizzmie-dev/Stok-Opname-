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
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Coins,
  FileSpreadsheet,
  Home,
  Info,
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
  computeSummary,
  convertRowWithMeta,
  formatCompactRupiah,
  formatDateId,
  formatDateRangeLabel,
  formatMonthId,
  formatPackEquivalent,
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
const THEME_KEY = 'so_theme_v2';

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
  monthsAffected: string[];
  totalRows: number;
  diffRows: number;
  pasRows: number;
  uniqueProducts: number;
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
      return localStorage.getItem(THEME_KEY) !== 'light';
    } catch {
      return true;
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
          if (nextData[dateKey]) {
            if (!updatedDates.includes(dateKey)) updatedDates.push(dateKey);
          } else {
            if (!addedDates.includes(dateKey)) addedDates.push(dateKey);
          }
          const rowsForDate = parsed[dateKey];
          nextData[dateKey] = rowsForDate;
          totalRows += rowsForDate.length;
          for (const r of rowsForDate) {
            productSet.add(r[0]);
            if (Math.abs(r[4]) > 1e-9 || Math.abs(r[6]) > 0.5) diffRows++;
            else pasRows++;
          }
        }
      }

      const importedDates = [...addedDates, ...updatedDates].sort();
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
        setStatus({
          text: `Berhasil membaca semua ${totalRows} baris (${productSet.size} barang: ${diffRows} selisih, ${pasRows} pas): ${addedDates.length} tanggal baru, ${updatedDates.length} tanggal diperbarui.`,
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
    if (searchQuery.trim() && matchingProducts.length === 1) {
      return matchingProducts[0];
    }
    return '';
  }, [summary, selectedProduct, searchQuery, matchingProducts]);

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
      <header className="md:sticky md:top-0 z-30 bg-white/90 dark:bg-[#081226]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-[#1C3259] shadow-[0_4px_20px_-10px_rgba(15,23,42,0.12)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('beranda')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center font-black text-slate-950 text-base shadow-md shadow-amber-500/20 shrink-0">
              W
            </span>
            <span className="leading-tight">
              <span className="font-display block text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Pantau Stok Opname
              </span>
              {summary?.locationName || summary?.branchName ? (
                <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[155px] sm:max-w-[220px]">
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
                  className={`relative h-full px-1 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 dark:bg-amber-400 rounded-full" />
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

        {/* PAGE 1: BERANDA */}
        {activeTab === 'beranda' && (
          <div className="space-y-4 sm:space-y-5">
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
                {/* Hero Banner dengan Tombol Rentang Tanggal & Cek 1 Hari di Pojok Kanan */}
                <section className="wizzmie-hero-card relative overflow-hidden rounded-2xl p-4 sm:p-6">
                  <div className="hidden dark:block absolute -right-10 -bottom-10 w-44 h-44 bg-blue-600/15 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
                      {/* 3D Style Clipboard & Box Badge */}
                      <div className="relative shrink-0 w-18 h-18 sm:w-22 sm:h-22 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 p-0.5 shadow-xl shadow-blue-900/40 flex items-center justify-center">
                        <div className="w-full h-full rounded-2xl bg-slate-900 dark:bg-[#0F2244] flex flex-col items-center justify-center relative">
                          <ClipboardCheck className="w-9 h-9 sm:w-10 sm:h-10 text-blue-400" />
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 bg-amber-400 rounded-lg flex items-center justify-center shadow-md rotate-6">
                            <Package className="w-3.5 h-3.5 text-slate-950" />
                          </div>
                        </div>
                      </div>

                      {/* Hero Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="text-[11px] sm:text-xs uppercase font-extrabold tracking-wider text-amber-700 dark:text-amber-400 truncate">
                            {viewScope === 'month'
                              ? 'Rekap Stok Bulanan'
                              : viewScope === 'range'
                              ? 'Rekap Rentang Tanggal'
                              : 'Pemeriksaan Harian'}
                            {summary.locationName || summary.branchName
                              ? ` · ${summary.locationName || summary.branchName}`
                              : ''}
                          </div>
                          <InfoButton
                            guideKey="overview"
                            onOpen={setActiveInfoKey}
                          />
                        </div>

                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 mt-0.5">
                          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">
                            <GsapWordTitle
                              text={
                                viewScope === 'day' ? 'Cek Stok' : 'Rekap Stok'
                              }
                            />
                          </h1>
                          <span className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                            <GsapWordTitle
                              text={
                                viewScope === 'month'
                                  ? formatMonthId(activeMonth)
                                  : viewScope === 'range'
                                  ? formatDateRangeLabel(
                                      summary.rangeStart,
                                      summary.rangeEnd
                                    )
                                  : formatDateId(activeDay)
                              }
                            />
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300/85 mt-1 leading-relaxed tabular-nums">
                          {viewScope === 'month' ? (
                            <>
                              Gabungan hitungan gudang dari {summary.allMonthDates.length} hari vs catatan sistem ESB ({Object.keys(summary.productMap).length} barang · {summary.totalRowsCount.toLocaleString('id-ID')} baris).
                            </>
                          ) : viewScope === 'range' ? (
                            <>
                              Gabungan hitungan gudang dari {summary.activeDates.length} hari ({formatDateRangeLabel(summary.rangeStart, summary.rangeEnd)}) vs catatan sistem ESB ({Object.keys(summary.productMap).length} barang · {summary.totalRowsCount.toLocaleString('id-ID')} baris).
                            </>
                          ) : (
                            <>
                              Menampilkan perbandingan hitungan gudang tanggal {formatDateId(activeDay)} dengan catatan sistem ESB ({summary.totalRowsCount} baris).
                            </>
                          )}
                          {summary.missingDays.length > 0 && (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">
                              {' '}
                              · Tgl {summary.missingDays.join(', ')} belum diupload
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Pojok Kanan: Tombol Rentang Tanggal & Cek 1 Hari */}
                    <div className="flex flex-col items-end gap-2 self-end lg:self-start shrink-0">
                      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-[#0A162B] border border-slate-200 dark:border-[#1C3259]">
                        <button
                          type="button"
                          onClick={() => {
                            setViewScope('range');
                            setIsRangePickerOpen(true);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] whitespace-nowrap cursor-pointer ${
                            viewScope === 'range'
                              ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] whitespace-nowrap cursor-pointer ${
                            viewScope === 'day'
                              ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
                            className="p-2 rounded-xl bg-white dark:bg-[#0F2244] border border-slate-200 dark:border-[#1F3763] text-slate-700 dark:text-slate-200 disabled:opacity-35 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>

                          <div className="relative">
                            <select
                              aria-label="Pilih tanggal"
                              value={activeDay}
                              onChange={(e) => setSelectedDay(e.target.value)}
                              className="appearance-none pl-3 pr-7 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-[#1F3763] bg-white dark:bg-[#0F2244] text-slate-900 dark:text-slate-200 min-h-[36px] focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
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
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          <button
                            type="button"
                            aria-label="Tanggal berikutnya"
                            disabled={
                              activeDayIndex < 0 ||
                              activeDayIndex >= activeMonthDates.length - 1
                            }
                            onClick={() => {
                              if (
                                activeDayIndex >= 0 &&
                                activeDayIndex < activeMonthDates.length - 1
                              ) {
                                setSelectedDay(
                                  activeMonthDates[activeDayIndex + 1]
                                );
                              }
                            }}
                            className="p-2 rounded-xl bg-white dark:bg-[#0F2244] border border-slate-200 dark:border-[#1F3763] text-slate-700 dark:text-slate-200 disabled:opacity-35 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {viewScope === 'range' && summary.activeDates.length === 0 && (
                  <div className="rounded-2xl p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                      Belum ada data file Excel pada rentang{' '}
                      <strong>
                        {formatDateRangeLabel(
                          summary.rangeStart,
                          summary.rangeEnd
                        )}
                      </strong>
                      . Pilih tanggal yang bertanda titik hijau di kalender.
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

                {/* 2-Column KPI Cards: Kekurangan Stok & Kelebihan Stok */}
                <section className="grid grid-cols-2 gap-3 sm:gap-4">
                  {/* Kekurangan Stok */}
                  <MotionCardButton
                    type="button"
                    delay={0.04}
                    onClick={() => setBerandaModal('neg')}
                    className="group text-left rounded-2xl p-3.5 sm:p-5 bg-white dark:bg-gradient-to-b dark:from-[#181B34] dark:to-[#0F1426] border border-rose-200 dark:border-rose-900/45 hover:border-rose-400 dark:hover:border-rose-500/70 flex flex-col justify-between shadow-sm transition-colors cursor-pointer"
                  >
                    <div className="flex flex-col items-center text-center w-full">
                      <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/40 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-2">
                        <ArrowDown className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Kekurangan Stok
                      </span>
                      <div className="text-xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight mt-0.5 tabular-nums">
                        {summary.negProductCount} Barang
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Hitungan Gudang &lt; Sistem ESB
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 w-full">
                      <div className="stat-badge-loss rounded-xl px-2.5 py-2 flex items-center gap-2">
                        <Coins className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                            Nilai Kekurangan
                          </div>
                          <div className="text-xs sm:text-sm font-extrabold font-mono text-rose-600 dark:text-rose-400 break-words leading-snug tabular-nums">
                            - {formatRupiah(summary.totalNeg)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-300 group-hover:underline">
                        <span>Ketuk lihat daftar barang</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </MotionCardButton>

                  {/* Kelebihan Stok */}
                  <MotionCardButton
                    type="button"
                    delay={0.08}
                    onClick={() => setBerandaModal('pos')}
                    className="group text-left rounded-2xl p-3.5 sm:p-5 bg-white dark:bg-gradient-to-b dark:from-[#0F262B] dark:to-[#0A1A22] border border-emerald-200 dark:border-emerald-900/45 hover:border-emerald-400 dark:hover:border-emerald-500/70 flex flex-col justify-between shadow-sm transition-colors cursor-pointer"
                  >
                    <div className="flex flex-col items-center text-center w-full">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                        <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Kelebihan Stok
                      </span>
                      <div className="text-xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5 tabular-nums">
                        {summary.posProductCount} Barang
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Hitungan Gudang &gt; Sistem ESB
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 w-full">
                      <div className="stat-badge-gain rounded-xl px-2.5 py-2 flex items-center gap-2">
                        <Coins className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                            Nilai Kelebihan
                          </div>
                          <div className="text-xs sm:text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400 break-words leading-snug tabular-nums">
                            + {formatRupiah(summary.totalPos)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-300 group-hover:underline">
                        <span>Ketuk lihat daftar barang</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </MotionCardButton>
                </section>

                {/* Banner Hasil Selisih Akhir + Info Alert Notice */}
                <section className="space-y-2.5">
                  <MotionCard
                    role="button"
                    tabIndex={0}
                    delay={0.1}
                    onClick={() => setBerandaModal('net')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setBerandaModal('net');
                      }
                    }}
                    className={`group rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4 transition-all active:scale-[0.995] cursor-pointer ${
                      summary.netTotal < -0.5
                        ? 'wizzmie-loss-banner text-rose-950 dark:text-rose-100 hover:brightness-110'
                        : 'wizzmie-gold-card text-amber-950 dark:text-amber-100 hover:brightness-110'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                        summary.netTotal < -0.5
                          ? 'bg-rose-500/20 border border-rose-400/35 text-rose-700 dark:text-rose-300'
                          : 'bg-amber-500/20 border border-amber-400/35 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {summary.netTotal < -0.5 ? (
                        <Scale className="w-7 h-7" />
                      ) : (
                        <Trophy className="w-7 h-7" />
                      )}
                    </div>

                    <div
                      className={`border-l pl-3.5 sm:pl-4 flex-1 min-w-0 ${
                        summary.netTotal < -0.5
                          ? 'border-rose-400/35'
                          : 'border-amber-500/35 dark:border-amber-400/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-bold tracking-wide uppercase ${
                            summary.netTotal < -0.5
                              ? 'text-rose-800 dark:text-rose-200'
                              : 'text-amber-800 dark:text-amber-200'
                          }`}
                        >
                          {viewScope === 'month'
                            ? 'Hasil Gabungan Bulan Ini (Lebih − Kurang)'
                            : viewScope === 'range'
                            ? `Hasil Gabungan ${formatDateRangeLabel(
                                summary.rangeStart,
                                summary.rangeEnd
                              )} (Lebih − Kurang)`
                            : 'Hasil Selisih Akhir (Lebih − Kurang)'}
                        </span>
                        <InfoButton
                          guideKey="overview"
                          onOpen={setActiveInfoKey}
                        />
                      </div>
                      <div
                        className={`text-2xl sm:text-3xl font-black font-mono tracking-tight leading-tight mt-0.5 tabular-nums ${
                          summary.netTotal < -0.5
                            ? 'text-rose-700 dark:text-rose-200'
                            : 'text-amber-900 dark:text-amber-300'
                        }`}
                      >
                        {summary.netTotal < -0.5
                          ? `- ${formatRupiah(summary.netTotal)}`
                          : summary.netTotal > 0.5
                          ? `+ ${formatRupiah(summary.netTotal)}`
                          : 'Pas Rp 0'}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-mono tabular-nums ${
                            summary.netTotal < -0.5
                              ? 'text-rose-800/80 dark:text-rose-200/80'
                              : 'text-amber-900/75 dark:text-amber-200/80'
                          }`}
                        >
                          Hitungan: (+ {formatCompactRupiah(summary.totalPos)}) − (- {formatCompactRupiah(summary.totalNeg)})
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold group-hover:underline ${
                            summary.netTotal < -0.5
                              ? 'text-rose-700 dark:text-rose-200'
                              : 'text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          <span>Ketuk lihat rumus &amp; asal angka</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </MotionCard>

                  {/* Info Alert Notice */}
                  <div className="rounded-xl bg-white dark:bg-[#0D1C34] border border-slate-200 dark:border-[#1A3157] px-3.5 py-2.5 flex items-start sm:items-center gap-2.5 text-xs text-slate-700 dark:text-blue-200">
                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                      <Info className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] sm:text-xs font-medium leading-relaxed">
                      {summary.netTotal < -0.5
                        ? 'Fungsinya mengecek total selisih uang: nilai kekurangan stok masih lebih besar dari kelebihannya. Cek daftar barang kurang di bawah.'
                        : summary.netTotal > 0.5
                        ? 'Fungsinya mengecek total selisih uang: nilai kelebihan stok lebih besar daripada kekurangan stok. Tetap cek barang kurang di bawah untuk memastikan tidak ada salah hitung.'
                        : 'Fungsinya mengecek total selisih uang: hitungan gudang dan catatan sistem ESB sudah seimbang.'}
                    </span>
                  </div>
                </section>

                {/* Main Analytics Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Left Column: Analisis Selisih Stok + Kondisi Per Bagian */}
                  <div className="lg:col-span-7 space-y-5">
                    {/* Analisis Selisih Stok (Daily Bar Chart) */}
                    <MotionSection className="wizzmie-glass-card rounded-2xl p-4 sm:p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/10 border border-amber-300/60 dark:border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                            <BarChart3 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                                <GsapWordTitle text="Analisis Selisih Stok Per Tanggal" />
                              </h2>
                              <InfoButton
                                guideKey="dailyChart"
                                onOpen={setActiveInfoKey}
                              />
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                              Perbandingan hitungan gudang dengan catatan sistem ESB · {formatMonthId(activeMonth)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-800/70">
                        <div className="flex items-end justify-between gap-1.5 overflow-x-auto pb-2 pt-3">
                          {summary.dailyStats.map((day) => {
                            const barHeight =
                              day.negVal < 0
                                ? Math.max(
                                    16,
                                    Math.round(
                                      (Math.abs(day.negVal) / maxDailyDeficit) *
                                        112
                                    )
                                  )
                                : 6;
                            const isSelected =
                              highlightedBarStat?.date === day.date;
                            const isInRange =
                              viewScope !== 'range' ||
                              (day.date >= summary.rangeStart &&
                                day.date <= summary.rangeEnd);
                            return (
                              <button
                                key={day.date}
                                type="button"
                                onClick={() => {
                                  if (viewScope === 'day') {
                                    setSelectedDay(day.date);
                                  } else {
                                    setActiveBarDate(day.date);
                                  }
                                }}
                                className={`group flex-1 min-w-[36px] h-[160px] flex flex-col justify-end items-center rounded-xl py-1.5 transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-50/70 dark:bg-transparent'
                                    : isInRange
                                    ? 'hover:bg-slate-100/70 dark:hover:bg-[#132548]/60'
                                    : 'opacity-40 hover:opacity-75 hover:bg-slate-100/70 dark:hover:bg-[#132548]/60'
                                }`}
                              >
                                {day.negVal < 0 && (
                                  <span
                                    className={`mb-1.5 text-[9px] sm:text-[10px] leading-none font-mono tabular-nums ${
                                      isSelected
                                        ? 'font-bold text-amber-700 dark:text-amber-300'
                                        : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {formatCompactRupiah(day.negVal)}
                                  </span>
                                )}
                                <span
                                  className={`block w-3/4 max-w-[24px] transition-all ${
                                    day.negVal < 0
                                      ? isSelected
                                        ? 'bg-gradient-to-t from-amber-500 to-amber-300 rounded-t-lg chart-active-glow'
                                        : viewScope === 'range' && isInRange
                                        ? 'bg-gradient-to-t from-amber-600/80 to-amber-400/85 rounded-t-md opacity-90 group-hover:opacity-100'
                                        : 'bg-gradient-to-t from-blue-600/60 to-blue-400/70 dark:from-blue-700/50 dark:to-blue-500/60 rounded-t-md opacity-85 group-hover:opacity-100'
                                      : 'bg-slate-200 dark:bg-slate-700/60 rounded-t-md'
                                  }`}
                                  style={{ height: `${barHeight}px` }}
                                />
                                <span
                                  className={`mt-1.5 text-[10px] leading-none font-mono tabular-nums flex items-center justify-center ${
                                    isSelected
                                      ? 'w-6 h-5 rounded-full bg-amber-400 text-slate-950 font-extrabold'
                                      : viewScope === 'range' && isInRange
                                      ? 'w-6 h-5 rounded-full bg-amber-400/20 text-amber-800 dark:text-amber-200 font-bold'
                                      : 'h-5 font-medium text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {Number(day.date.slice(8))}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {highlightedBarStat && (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 text-left">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                              <CalendarDays className="w-4 h-4" />
                            </div>
                            <div className="tabular-nums">
                              <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                                Tanggal {formatDateId(highlightedBarStat.date)}
                              </div>
                              <div className="text-[11px] sm:text-xs font-mono leading-tight mt-0.5">
                                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                  Kurang -{formatCompactRupiah(highlightedBarStat.negVal)}
                                </span>
                                <span className="text-slate-400 mx-1.5">|</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Lebih +{formatCompactRupiah(highlightedBarStat.posVal)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {viewScope !== 'day' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDay(highlightedBarStat.date);
                                  setViewScope('day');
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#0D1C36] border border-slate-200 dark:border-[#1C3259] text-slate-700 dark:text-slate-200 font-semibold text-xs min-h-[38px] whitespace-nowrap cursor-pointer"
                              >
                                Total Hari Ini
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenDayInHarian(highlightedBarStat.date)
                              }
                              className="shrink-0 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all min-h-[38px] cursor-pointer"
                            >
                              <span>Daftar Barang</span>
                              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          </div>
                        </div>
                      )}
                    </MotionSection>

                    {/* Kondisi Per Bagian (Produksi / Operasional) */}
                    {summary.categoryStats.length > 0 && (
                      <MotionSection className="wizzmie-glass-card rounded-2xl p-4 sm:p-5 space-y-3">
                        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Boxes className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                                <GsapWordTitle text="Kondisi Per Bagian (Produksi / Operasional)" />
                              </h2>
                              <InfoButton
                                guideKey="categories"
                                onOpen={setActiveInfoKey}
                              />
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                              {viewScope === 'month'
                                ? formatMonthId(activeMonth)
                                : viewScope === 'range'
                                ? formatDateRangeLabel(
                                    summary.rangeStart,
                                    summary.rangeEnd
                                  )
                                : formatDateId(activeDay)}{' '}
                              · ketuk salah satu bagian untuk lihat daftar barangnya
                            </p>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                          {summary.categoryStats.map((cat) => {
                            const netState =
                              cat.netVal < -0.5
                                ? 'neg'
                                : cat.netVal > 0.5
                                ? 'pos'
                                : 'eq';
                            const absNeg = Math.abs(cat.negVal);
                            const absPos = Math.abs(cat.posVal);
                            const totalPair = absNeg + absPos || 1;
                            const negShare = Math.round((absNeg / totalPair) * 100);
                            const posShare = 100 - negShare;
                            const lowerName = cat.category.toLowerCase();

                            return (
                              <button
                                key={cat.category}
                                type="button"
                                onClick={() => {
                                  setCategoryFilter(cat.category);
                                  if (viewScope === 'day' && activeDay) {
                                    handleOpenDayInHarian(activeDay);
                                  } else {
                                    setActiveTab('harian');
                                    window.scrollTo({
                                      top: 0,
                                      behavior: 'smooth',
                                    });
                                  }
                                }}
                                className="w-full py-3 px-1.5 flex items-center justify-between gap-3 text-left rounded-xl hover:bg-slate-50 dark:hover:bg-[#132548]/60 transition-colors min-h-[58px] cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                      netState === 'neg'
                                        ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                                        : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                    }`}
                                  >
                                    {lowerName.includes('veg') ||
                                    lowerName.includes('sayur') ? (
                                      <Leaf className="w-4 h-4" />
                                    ) : lowerName.includes('wip') ? (
                                      <ChefHat className="w-4 h-4" />
                                    ) : lowerName.includes('meat') ||
                                      lowerName.includes('daging') ? (
                                      <Beef className="w-4 h-4" />
                                    ) : lowerName.includes('dry') ||
                                      lowerName.includes('amen') ? (
                                      <Package className="w-4 h-4" />
                                    ) : (
                                      <Utensils className="w-4 h-4" />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                                        {cat.category}
                                      </span>
                                      <span className="text-[10px] sm:text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                                        Kurang {formatCompactRupiah(cat.negVal)} · Lebih{' '}
                                        {formatCompactRupiah(cat.posVal)}
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                      {negShare > 0 && (
                                        <div
                                          className="h-full bg-rose-500"
                                          style={{ width: `${negShare}%` }}
                                        />
                                      )}
                                      {posShare > 0 && (
                                        <div
                                          className="h-full bg-emerald-500"
                                          style={{ width: `${posShare}%` }}
                                        />
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 max-w-[48%] text-right">
                                  <span
                                    className={`text-xs sm:text-sm font-mono font-bold tabular-nums leading-snug ${
                                      netState === 'neg'
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : netState === 'pos'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {netState === 'neg'
                                      ? `Kurang ${formatRupiah(cat.netVal)}`
                                      : netState === 'pos'
                                      ? `Lebih ${formatRupiah(cat.netVal)}`
                                      : 'Pas Rp 0'}
                                  </span>
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Warning Callout Box */}
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-gradient-to-r dark:from-amber-500/15 dark:to-yellow-600/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Lightbulb className="w-4 h-4" />
                          </div>
                          <div className="text-[11px] sm:text-xs leading-relaxed">
                            <strong className="text-amber-800 dark:text-amber-300 font-bold block">
                              Informasi Penting
                            </strong>
                            <span className="text-slate-700 dark:text-slate-300">
                              Jika ada bagian dengan selisih besar, pastikan hitungan gudang pada bagian produksi / operasional tersebut sudah sesuai dengan catatan sistem ESB.
                            </span>
                          </div>
                        </div>
                      </MotionSection>
                    )}
                  </div>

                  {/* Right Column: Barang yang Perlu Dicek Duluan */}
                  <MotionSection className="lg:col-span-5 wizzmie-glass-card rounded-2xl p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300/60 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                          <ClipboardList className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                            <GsapWordTitle text="Barang yang Perlu Dicek Duluan" />
                          </h2>
                          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                            {viewScope === 'month'
                              ? `10 selisih terbesar bulan ${formatMonthId(activeMonth)}`
                              : viewScope === 'range'
                              ? `10 selisih terbesar ${formatDateRangeLabel(
                                  summary.rangeStart,
                                  summary.rangeEnd
                                )}`
                              : `Barang selisih terbesar tgl ${formatDateId(activeDay)}`}
                          </p>
                        </div>
                      </div>
                      <InfoButton
                        guideKey="topProducts"
                        onOpen={setActiveInfoKey}
                      />
                    </div>

                    {/* Segmented Buttons: Kurangnya Terbesar vs Lebihnya Terbesar */}
                    <div className="p-1 rounded-xl bg-slate-100 dark:bg-[#0A162B] border border-slate-200 dark:border-[#182C4C] grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => setRankMode('neg')}
                        className={`py-2 px-2.5 text-xs font-bold rounded-lg transition-all min-h-[40px] flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                          rankMode === 'neg'
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                        <span>Kurangnya Terbesar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRankMode('pos')}
                        className={`py-2 px-2.5 text-xs font-bold rounded-lg transition-all min-h-[40px] flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                          rankMode === 'pos'
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                        <span>Lebihnya Terbesar</span>
                      </button>
                    </div>

                    {(rankMode === 'neg'
                      ? summary.topDeficits
                      : summary.topSurpluses
                    ).length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                        {rankMode === 'neg'
                          ? 'Bagus! Tidak ada barang yang hasil akhirnya kurang pada periode ini.'
                          : 'Tidak ada barang yang hasil akhirnya lebih pada periode ini.'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {(rankMode === 'neg'
                          ? summary.topDeficits
                          : summary.topSurpluses
                        ).map((item, index) => {
                          const qtyLabel = formatQtyMap(
                            item.qtyByUnit,
                            item.name,
                            true
                          );
                          const isNeg = rankMode === 'neg';
                          return (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => handlePickProduct(item.name)}
                              className="w-full p-2.5 sm:p-3 rounded-xl bg-slate-50/90 dark:bg-[#0D1C34] border border-slate-200/80 dark:border-[#1A3157] hover:border-amber-400/70 dark:hover:border-amber-500/50 flex items-center justify-between gap-2.5 text-left transition-colors min-h-[58px] cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-7 h-7 rounded-lg bg-white dark:bg-[#16294C] border border-slate-200 dark:border-[#223F74] text-slate-700 dark:text-slate-200 font-mono font-bold text-xs flex items-center justify-center shrink-0 tabular-nums">
                                  {String(index + 1).padStart(2, '0')}
                                </span>
                                <div className="min-w-0">
                                  <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                    {item.name}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                    <span
                                      className={`font-semibold inline-flex items-center gap-1 ${
                                        isNeg
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : 'text-emerald-600 dark:text-emerald-400'
                                      }`}
                                    >
                                      <Package className="w-3 h-3 shrink-0" />
                                      {qtyLabel}
                                    </span>
                                    <span>·</span>
                                    <span className="truncate">
                                      Bagian {item.category}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 max-w-[46%] text-right">
                                <span
                                  className={`text-xs sm:text-sm font-mono font-extrabold tabular-nums leading-snug ${
                                    isNeg
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {isNeg ? '-' : '+'} {formatRupiah(item.netVal)}
                                </span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Action Footer Banner: Lihat Semua Barang */}
                    <button
                      type="button"
                      onClick={() => {
                        if (viewScope === 'day' && activeDay) {
                          handleOpenDayInHarian(activeDay);
                        } else {
                          setActiveTab('barang');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className="w-full p-3.5 rounded-2xl bg-slate-100 dark:bg-gradient-to-r dark:from-[#11244A] dark:to-[#0D1C38] border border-slate-200 dark:border-[#23437A] hover:border-amber-400/70 flex items-center justify-between gap-3 active:scale-[0.99] transition-all text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <Lightbulb className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {viewScope === 'day' && activeDay
                              ? `Lihat Semua Barang Tgl ${formatDateId(activeDay)}`
                              : `Lihat Semua Barang (${Object.keys(summary.productMap).length} Jenis)`}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Ketuk untuk membuka daftar lengkap
                          </div>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </button>
                  </MotionSection>
                </div>

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
                <MotionSection className="surface-3d rounded-3xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                          <GsapWordTitle
                            text={`Catatan Harian (${
                              viewScope === 'range'
                                ? formatDateRangeLabel(
                                    summary.rangeStart,
                                    summary.rangeEnd
                                  )
                                : viewScope === 'day'
                                ? formatDateId(activeDay)
                                : formatMonthId(activeMonth)
                            })`}
                          />
                        </h1>
                        <InfoButton
                          guideKey="harian"
                          onOpen={setActiveInfoKey}
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        Semua {summary.totalRowsCount} baris hitungan dari Excel tampil lengkap (termasuk barang yang Pas). Ketuk tanggal untuk membuka rinciannya.
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 self-end sm:self-start shrink-0">
                      <div className="inline-flex items-center gap-1 p-1 track-3d rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setViewScope('range');
                            setIsRangePickerOpen(true);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all min-h-[36px] whitespace-nowrap cursor-pointer ${
                            viewScope === 'range'
                              ? 'bg-white dark:bg-amber-400 text-slate-900 dark:text-slate-950 shadow-sm'
                              : 'text-slate-600 dark:text-slate-300'
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
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all min-h-[36px] whitespace-nowrap cursor-pointer ${
                            viewScope === 'day'
                              ? 'bg-white dark:bg-amber-400 text-slate-900 dark:text-slate-950 shadow-sm'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                          <span>Cek 1 Hari</span>
                        </button>
                      </div>

                      {viewScope === 'day' && (
                        <select
                          aria-label="Pilih tanggal di Harian"
                          value={activeDay}
                          onChange={(e) => setSelectedDay(e.target.value)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-amber-500/40 bg-white dark:bg-[#0A162B] text-slate-900 dark:text-slate-100 min-h-[36px]"
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
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="search"
                        value={dailySearch}
                        onChange={(e) => setDailySearch(e.target.value)}
                        placeholder="Cari nama barang, kode (Dry 123), atau No. SP (SP2026...)..."
                        autoComplete="off"
                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-[#1E355D] bg-white dark:bg-[#0A162B] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[42px]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-[#0A162B] dark:border dark:border-[#182C4C] rounded-xl">
                        {(
                          [
                            { id: 'all', label: 'Semua' },
                            { id: 'diff', label: 'Selisih' },
                            { id: 'neg', label: 'Kurang' },
                            { id: 'pos', label: 'Lebih' },
                            { id: 'pas', label: 'Pas' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setDailyFilter(tab.id)}
                            className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap min-h-[36px] cursor-pointer ${
                              dailyFilter === tab.id
                                ? 'bg-white dark:bg-amber-400 text-slate-900 dark:text-slate-950 shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {summary.categoryStats.length > 0 && (
                        <select
                          aria-label="Filter bagian"
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-[#1E355D] bg-white dark:bg-[#0A162B] text-slate-900 dark:text-slate-100 min-h-[42px]"
                        >
                          <option value="ALL">Semua Bagian</option>
                          {summary.categoryStats.map((cat) => (
                            <option key={cat.category} value={cat.category}>
                              {cat.category}
                            </option>
                          ))}
                        </select>
                      )}

                      {summary.allPurposes.length > 0 && (
                        <select
                          aria-label="Filter keperluan"
                          value={purposeFilter}
                          onChange={(e) => setPurposeFilter(e.target.value)}
                          className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2124] text-slate-900 dark:text-slate-100 min-h-[42px]"
                        >
                          <option value="ALL">Semua Keperluan</option>
                          {summary.allPurposes.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      )}
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
                        <MotionCard
                          key={day.date}
                          id={`day-${day.date}`}
                          hoverLift={!isOpen}
                          className="surface-3d rounded-3xl overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDays((prev) => ({
                                ...prev,
                                [day.date]: !(prev[day.date] ?? dayIndex === 0),
                              }))
                            }
                            className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              {isOpen ? (
                                <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                              )}
                              <div>
                                <div className="text-base font-bold text-slate-900 dark:text-white">
                                  {formatDateId(day.date)}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                  {day.totalCount} baris ({day.diffCount} selisih ·{' '}
                                  {day.pasCount} pas)
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 sm:gap-5 text-xs sm:text-sm font-mono tabular-nums pl-8 sm:pl-0">
                              <div>
                                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                                  Kurang
                                </div>
                                <div className="font-semibold text-red-700 dark:text-red-400">
                                  - {formatCompactRupiah(day.negVal)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                                  Lebih
                                </div>
                                <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                                  + {formatCompactRupiah(day.posVal)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                                  Hasil Hari Itu
                                </div>
                                <div
                                  className={`font-bold ${
                                    dayNet < -0.5
                                      ? 'text-red-700 dark:text-red-400'
                                      : dayNet > 0.5
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  {dayNet < -0.5
                                    ? `- ${formatRupiah(dayNet)}`
                                    : dayNet > 0.5
                                    ? `+ ${formatRupiah(dayNet)}`
                                    : 'Pas Rp 0'}
                                </div>
                              </div>
                            </div>
                          </button>

                          {isOpen && (
                            <div className="border-t border-slate-100 dark:border-slate-800/90 px-4 sm:px-5 pb-3 divide-y divide-slate-100 dark:divide-slate-800/90">
                              {rows.length === 0 ? (
                                <p className="py-4 text-sm text-slate-500 dark:text-slate-400">
                                  Tidak ada barang yang cocok dengan filter di tanggal ini.
                                </p>
                              ) : (
                                rows.map((meta, idx) => (
                                  <ReadableStockRow
                                    key={`${day.date}-${meta.row[0]}-${idx}`}
                                    title={meta.row[0]}
                                    meta={meta}
                                    onTitleClick={() =>
                                      handlePickProduct(meta.row[0])
                                    }
                                  />
                                ))
                              )}
                            </div>
                          )}
                        </MotionCard>
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
                <MotionSection className="surface-3d rounded-3xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                          <GsapWordTitle text="Cek Kondisi & Riwayat Barang" />
                        </h1>
                        <InfoButton
                          guideKey="cekBarang"
                          onOpen={setActiveInfoKey}
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        {viewScope === 'month'
                          ? `Data yang sedang dilihat: ${formatMonthId(activeMonth)} (sebulan penuh)`
                          : viewScope === 'range'
                          ? `Data yang sedang dilihat: ${formatDateRangeLabel(
                              summary.rangeStart,
                              summary.rangeEnd
                            )} (${summary.activeDates.length} hari)`
                          : `Data yang sedang dilihat: ${formatDateId(activeDay)} (1 hari)`}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 self-end sm:self-start shrink-0">
                      <div className="inline-flex items-center gap-1 p-1 track-3d rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setViewScope('range');
                            setIsRangePickerOpen(true);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all min-h-[36px] whitespace-nowrap cursor-pointer ${
                            viewScope === 'range'
                              ? 'bg-white dark:bg-amber-400 text-slate-900 dark:text-slate-950 shadow-sm'
                              : 'text-slate-600 dark:text-slate-300'
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
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all min-h-[36px] whitespace-nowrap cursor-pointer ${
                            viewScope === 'day'
                              ? 'bg-white dark:bg-amber-400 text-slate-900 dark:text-slate-950 shadow-sm'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                          <span>Cek 1 Hari</span>
                        </button>
                      </div>

                      {viewScope === 'day' && (
                        <select
                          aria-label="Pilih tanggal di Cek Barang"
                          value={activeDay}
                          onChange={(e) => setSelectedDay(e.target.value)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-amber-500/40 bg-white dark:bg-[#0A162B] text-slate-900 dark:text-slate-100 min-h-[36px]"
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
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setSelectedProduct('');
                        }}
                        placeholder="Ketik nama atau kode barang, misal: udang keju, Dry 123, beras..."
                        autoComplete="off"
                        className="w-full pl-10 pr-4 py-3 text-sm sm:text-base rounded-xl border border-slate-200 dark:border-[#1E355D] bg-white dark:bg-[#0A162B] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-[#0A162B] dark:border dark:border-[#182C4C] rounded-xl">
                        {(
                          [
                            { id: 'all', label: 'Semua' },
                            { id: 'neg', label: 'Kurang' },
                            { id: 'pos', label: 'Lebih' },
                            { id: 'pas', label: 'Pas' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setProductFilter(tab.id)}
                            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap min-h-[40px] cursor-pointer ${
                              productFilter === tab.id
                                ? 'bg-white dark:bg-amber-400 text-slate-900 dark:text-slate-950 shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {summary.categoryStats.length > 0 && (
                        <select
                          aria-label="Filter bagian di Cek Barang"
                          value={productCategoryFilter}
                          onChange={(e) => setProductCategoryFilter(e.target.value)}
                          className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-[#1E355D] bg-white dark:bg-[#0A162B] text-slate-900 dark:text-slate-100 min-h-[42px]"
                        >
                          <option value="ALL">Semua Bagian</option>
                          {summary.categoryStats.map((cat) => (
                            <option key={cat.category} value={cat.category}>
                              {cat.category}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </MotionSection>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Matching list */}
                  <MotionSection className="lg:col-span-5 surface-3d rounded-3xl p-4 sm:p-5">
                    <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 tabular-nums">
                      <GsapWordTitle
                        text={
                          searchQuery.trim()
                            ? `Hasil pencarian (${matchingProducts.length})`
                            : productFilter === 'pos'
                            ? `Semua barang lebih (${matchingProducts.length})`
                            : productFilter === 'pas'
                            ? `Semua barang pas (${matchingProducts.length})`
                            : productFilter === 'neg'
                            ? `Semua barang kurang (${matchingProducts.length})`
                            : `Semua barang tercatat (${matchingProducts.length})`
                        }
                      />
                    </h2>

                    {matchingProducts.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                        Barang tidak ditemukan pada periode ini.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/90 max-h-[540px] overflow-y-auto">
                        {matchingProducts.map((name) => {
                          const stat = summary.productMap[name];
                          const isPicked = effectiveSelectedProduct === name;
                          const netQtyText = formatQtyMap(
                            stat.qtyByUnit,
                            name,
                            true
                          );
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
                              onClick={() => setSelectedProduct(name)}
                              className={`w-full flex items-center justify-between gap-3 py-3 px-2.5 text-left rounded-xl transition-colors min-h-[56px] cursor-pointer ${
                                isPicked
                                  ? 'bg-amber-50 dark:bg-[#16294C]'
                                  : 'hover:bg-slate-50 dark:hover:bg-[#132548]/50'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                  {name}
                                </div>
                                <div
                                  className={`text-xs font-semibold tabular-nums ${
                                    netState === 'neg'
                                      ? 'text-red-700 dark:text-red-400'
                                      : netState === 'pos'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {netQtyText}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {stat.code ? `${stat.code} · ` : ''}
                                  {stat.category}
                                  {stat.subcategory && stat.subcategory !== stat.category
                                    ? ` / ${stat.subcategory}`
                                    : ''}
                                </div>
                              </div>
                              <div
                                className={`text-xs sm:text-sm font-mono font-bold tabular-nums whitespace-nowrap shrink-0 ${
                                  netState === 'neg'
                                    ? 'text-red-700 dark:text-red-400'
                                    : netState === 'pos'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {netState === 'neg'
                                  ? `- ${formatRupiah(stat.netVal)}`
                                  : netState === 'pos'
                                  ? `+ ${formatRupiah(stat.netVal)}`
                                  : 'Rp 0'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </MotionSection>

                  {/* Product Detail */}
                  <MotionSection className="lg:col-span-7 surface-3d rounded-3xl p-5 sm:p-6">
                    {!selectedProductStat ? (
                      <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        Ketuk salah satu barang di sebelah kiri untuk melihat kode barang, harga satuan, jumlah bungkus/dos/porsi, dan riwayat tanggalnya.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                              <GsapWordTitle text={selectedProductStat.name} />
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {selectedProductStat.code && (
                                <>
                                  Kode:{' '}
                                  <strong className="font-mono text-slate-700 dark:text-slate-200">
                                    {selectedProductStat.code}
                                  </strong>
                                  {' · '}
                                </>
                              )}
                              Bagian:{' '}
                              <strong className="text-slate-700 dark:text-slate-200">
                                {selectedProductStat.category}
                                {selectedProductStat.subcategory &&
                                selectedProductStat.subcategory !==
                                  selectedProductStat.category
                                  ? ` / ${selectedProductStat.subcategory}`
                                  : ''}
                              </strong>
                              {selectedProductStat.lastUnitPrice > 0 && (
                                <>
                                  {' · '}Harga/unit:{' '}
                                  <strong className="font-mono text-slate-700 dark:text-slate-200">
                                    {formatRupiah(selectedProductStat.lastUnitPrice)}
                                  </strong>
                                </>
                              )}
                              {selectedProductStat.purposes.length > 0 && (
                                <>
                                  {' · '}Keperluan:{' '}
                                  <strong className="text-slate-700 dark:text-slate-200">
                                    {selectedProductStat.purposes.join(', ')}
                                  </strong>
                                </>
                              )}
                            </p>
                            {(() => {
                              const spec = getItemPackagingSpec(
                                selectedProductStat.name
                              );
                              if (!spec) return null;
                              return (
                                <div className="pt-1">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100/90 dark:bg-amber-500/15 border border-amber-300/80 dark:border-amber-500/35 text-amber-900 dark:text-amber-300">
                                    <span>Standar Satuan:</span>
                                    <span className="font-extrabold">
                                      {spec.specText}
                                    </span>
                                  </span>
                                </div>
                              );
                            })()}
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedProduct('')}
                            className="btn-3d-soft px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1 min-h-[36px] shrink-0 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Tutup</span>
                          </button>
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/90 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-0 sm:divide-x divide-slate-100 dark:divide-slate-800/90 text-sm tabular-nums">
                          <div className="sm:pr-4 space-y-0.5">
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                              Saat Kurang ({selectedProductStat.negDays} hari)
                            </div>
                            <div className="text-sm font-bold text-red-700 dark:text-red-400">
                              {Object.keys(selectedProductStat.negQtyByUnit)
                                .length > 0
                                ? formatQtyMap(
                                    selectedProductStat.negQtyByUnit,
                                    selectedProductStat.name,
                                    true
                                  )
                                : '0'}
                            </div>
                            <div className="text-xs font-mono font-semibold text-red-700/90 dark:text-red-400/90">
                              - {formatRupiah(selectedProductStat.negVal)}
                            </div>
                          </div>

                          <div className="sm:px-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/90 space-y-0.5">
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                              Saat Lebih ({selectedProductStat.posDays} hari)
                            </div>
                            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                              {Object.keys(selectedProductStat.posQtyByUnit)
                                .length > 0
                                ? formatQtyMap(
                                    selectedProductStat.posQtyByUnit,
                                    selectedProductStat.name,
                                    true
                                  )
                                : '0'}
                            </div>
                            <div className="text-xs font-mono font-semibold text-emerald-700/90 dark:text-emerald-400/90">
                              + {formatRupiah(selectedProductStat.posVal)}
                            </div>
                          </div>

                          <div className="sm:pl-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/90 space-y-0.5">
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                              {viewScope === 'month'
                                ? 'Hasil Akhir Bulan Ini'
                                : viewScope === 'range'
                                ? `Hasil ${formatDateRangeLabel(
                                    summary.rangeStart,
                                    summary.rangeEnd
                                  )}`
                                : `Hasil Tgl ${formatDateId(activeDay)}`}
                            </div>
                            <div
                              className={`text-sm font-bold ${
                                selectedProductStat.netVal < -0.5
                                  ? 'text-red-700 dark:text-red-400'
                                  : selectedProductStat.netVal > 0.5
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {formatQtyMap(
                                selectedProductStat.qtyByUnit,
                                selectedProductStat.name,
                                true
                              )}
                            </div>
                            <div
                              className={`text-xs font-mono font-semibold ${
                                selectedProductStat.netVal < -0.5
                                  ? 'text-red-700 dark:text-red-400'
                                  : selectedProductStat.netVal > 0.5
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {selectedProductStat.netVal < -0.5
                                ? `Kurang ${formatRupiah(selectedProductStat.netVal)}`
                                : selectedProductStat.netVal > 0.5
                                ? `Lebih ${formatRupiah(selectedProductStat.netVal)}`
                                : 'Pas Rp 0'}
                            </div>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-800/90 border-t border-slate-100 dark:border-slate-800/90">
                          {selectedProductTimeline.map(({ date, meta }, idx) => (
                            <ReadableStockRow
                              key={`${date}-${idx}`}
                              title={formatDateId(date)}
                              meta={meta}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </MotionSection>
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
                        : 'Tidak ada tanggal yang ditimpa.'}
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
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  <GsapWordTitle text="Pengaturan Tampilan" />
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Pilih tema tampilan Navy &amp; Gold (Wizzmie) atau tampilan cerah sesuai kenyamanan Anda.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/90">
                <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Tema Tampilan
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Pilih tampilan Navy &amp; Gold (Wizzmie) atau tampilan cerah.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDark((prev) => !prev)}
                    className="btn-3d-soft px-4 py-2.5 text-sm font-semibold rounded-xl text-slate-800 dark:text-slate-100 flex items-center gap-2 self-start sm:self-auto min-h-[44px] cursor-pointer"
                  >
                    {isDark ? (
                      <Sun className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Moon className="w-4 h-4 text-slate-600" />
                    )}
                    <span>
                      {isDark ? 'Ganti ke Tema Cerah' : 'Pakai Tema Wizzmie (Navy & Gold)'}
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
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#081226]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-[#1C3259] shadow-[0_-8px_24px_-6px_rgba(2,6,23,0.45)]"
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
                className={`flex flex-col items-center justify-center gap-1 min-h-[44px] px-0.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-amber-600 dark:text-amber-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {item.icon}
                <span className="text-[10px] leading-none truncate max-w-full">
                  {item.mobileLabel}
                </span>
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
  meta,
  onTitleClick,
}: {
  title: string;
  meta: ConvertedStockRow;
  onTitleClick?: () => void;
}) {
  const { row, wasConverted, originalUnit, originalDiffQty } = meta;
  const sysQty = row[2];
  const opQty = row[3];
  const diffQty = row[4];
  const valUnit = row[5];
  const diffVal = row[6];
  const unit = row[1];
  const info = row[7];
  const category = row[8];
  const opnameNumber = row[10];
  const purpose = row[12];
  const productCode = row[13];
  const subcategory = row[14];
  const rowStatus = row[15];

  const state =
    diffQty < -1e-9 || diffVal < -0.5
      ? 'neg'
      : diffQty > 1e-9 || diffVal > 0.5
      ? 'pos'
      : 'eq';
  const packEquiv = formatPackEquivalent(Math.abs(diffQty), unit, row[0]);
  const itemSpec = getItemPackagingSpec(row[0]);

  const metaParts = [
    itemSpec?.unitRatios ? `Kemasan: ${itemSpec.specText}` : '',
    productCode ? `Kode ${productCode}` : '',
    opnameNumber ? `No. ${opnameNumber}` : '',
    category
      ? subcategory && subcategory !== category
        ? `${category} / ${subcategory}`
        : category
      : '',
    purpose ? `Keperluan: ${purpose}` : '',
    rowStatus || '',
    info || '',
  ].filter(Boolean);

  return (
    <div className="py-3.5 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        {onTitleClick ? (
          <button
            type="button"
            onClick={onTitleClick}
            className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-300 text-left break-words cursor-pointer"
          >
            {title}
          </button>
        ) : (
          <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white break-words">
            {title}
          </div>
        )}
        <div className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
          Di Sistem ESB:{' '}
          <strong className="font-mono text-slate-800 dark:text-slate-200">
            {formatQty(sysQty)}
          </strong>
          {' · '}
          Hitungan Gudang:{' '}
          <strong className="font-mono text-slate-800 dark:text-slate-200">
            {formatQty(opQty)} {unit}
          </strong>
          {valUnit > 0 && (
            <span>
              {' · '}Harga/unit:{' '}
              <span className="font-mono">{formatRupiah(valUnit)}</span>
            </span>
          )}
          {wasConverted && (
            <span>
              {' · '}di file {formatSignedQty(originalDiffQty)} {originalUnit}
            </span>
          )}
        </div>
        {metaParts.length > 0 && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 break-words">
            {metaParts.join(' · ')}
          </div>
        )}
      </div>

      <div className="text-right shrink-0 font-mono tabular-nums">
        <div
          className={`text-sm font-bold ${
            state === 'neg'
              ? 'text-red-600 dark:text-red-400'
              : state === 'pos'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {state === 'neg'
            ? `Kurang ${formatQty(diffQty)} ${unit}`
            : state === 'pos'
            ? `Lebih ${formatQty(diffQty)} ${unit}`
            : `Pas (0 ${unit})`}
          {packEquiv ? ` (${packEquiv})` : ''}
        </div>
        <div
          className={`text-xs font-semibold ${
            state === 'neg'
              ? 'text-red-600/90 dark:text-red-400/90'
              : state === 'pos'
              ? 'text-emerald-600/90 dark:text-emerald-400/90'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {state === 'neg'
            ? `- ${formatRupiah(diffVal)}`
            : state === 'pos'
            ? `+ ${formatRupiah(diffVal)}`
            : 'Rp 0'}
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
