import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Beef,
  Boxes,
  CalendarDays,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Download,
  FileSpreadsheet,
  Home,
  Info,
  Leaf,
  Lightbulb,
  Moon,
  Package,
  PackageSearch,
  RefreshCw,
  Scale,
  Search,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Upload,
  Utensils,
  X,
} from 'lucide-react';
import { AiAssistantCard, AiChatMessage } from './components/AiAssistantCard';
import {
  BerandaDetailModal,
  BerandaModalType,
} from './components/BerandaDetailModal';
import { InfoButton, InfoDialog, InfoGuideKey } from './components/InfoGuide';
import heroInventory3d from './assets/images/hero_inventory_3d_1795152375997.jpg';
import uploadExcel3d from './assets/images/upload_excel_3d_1795152375933.jpg';
import { buildStandaloneHtml } from './lib/exportHtml';
import {
  ConvertedStockRow,
  StockDataset,
  StockRow,
  ViewScope,
  computeSummary,
  convertRowWithMeta,
  formatCompactRupiah,
  formatDateId,
  formatMonthId,
  formatPackEquivalent,
  formatQty,
  formatQtyMap,
  formatRupiah,
  formatSignedQty,
  parseExcelBuffer,
  sanitizeDataset,
} from './lib/stockOpname';

const STORAGE_KEY = 'so';
const THEME_KEY = 'so_theme_v2';

type MenuTab = 'beranda' | 'upload' | 'harian' | 'barang' | 'ai' | 'pengaturan';
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

  const [activeTab, setActiveTab] = useState<MenuTab>(() =>
    Object.keys(data).length > 0 ? 'beranda' : 'upload'
  );
  const [viewScope, setViewScope] = useState<ViewScope>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('');
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
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([]);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [lastUpload, setLastUpload] = useState<UploadReport | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [wipeArmed, setWipeArmed] = useState(false);
  const [uploadImgFailed, setUploadImgFailed] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) !== 'light';
    } catch {
      return true;
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const wipeTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (wipeTimerRef.current) window.clearTimeout(wipeTimerRef.current);
    };
  }, []);

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

  const summary = useMemo(() => {
    if (!activeMonth || !activeMonthDates.length) return null;
    return computeSummary(data, activeMonth, viewScope, activeDay);
  }, [data, activeMonth, activeMonthDates.length, viewScope, activeDay]);

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

      for (const file of list) {
        const buffer = await file.arrayBuffer();
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
      if (!importedDates.length) {
        throw new Error('tidak ada baris data yang terbaca');
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
      setStatus({
        text: `Berhasil membaca semua ${totalRows} baris (${productSet.size} barang: ${diffRows} selisih, ${pasRows} pas): ${addedDates.length} tanggal baru, ${updatedDates.length} tanggal diperbarui.`,
      });
      setActiveTab('upload');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Format file tidak sesuai.';
      setStatus({
        text: `Gagal membaca file: ${message}. Pastikan file adalah laporan Stock Opname (.xlsx / .xls).`,
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
    setOpenDays((prev) => ({ ...prev, [dateKey]: true }));
    setActiveTab('harian');
    window.requestAnimationFrame(() => {
      const target = document.getElementById(`day-${dateKey}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleBackupJson = () => {
    if (!allDates.length) {
      setStatus({ text: 'Belum ada data untuk dicadangkan.', isError: true });
      return;
    }
    const blob = new Blob([JSON.stringify({ v: 1, data })], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-stok-opname-${allDates[allDates.length - 1]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus({ text: 'Cadangan data (.json) berhasil diunduh.' });
  };

  const handleDownloadStandaloneHtml = () => {
    const html = buildStandaloneHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus({
      text: 'File index.html tunggal berhasil diunduh.',
    });
  };

  const handleRestoreJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as {
        data?: Record<string, StockRow[]>;
      };
      if (!parsed || !parsed.data || typeof parsed.data !== 'object') {
        throw new Error('format cadangan tidak dikenal');
      }

      const nextData: StockDataset = { ...data };
      let restoredCount = 0;
      for (const dateKey of Object.keys(parsed.data)) {
        if (
          /^\d{4}-\d{2}-\d{2}$/.test(dateKey) &&
          Array.isArray(parsed.data[dateKey])
        ) {
          nextData[dateKey] = parsed.data[dateKey];
          restoredCount++;
        }
      }

      if (!restoredCount) {
        throw new Error('tidak ada data tanggal yang valid');
      }

      const restoredDates = Object.keys(nextData).sort();
      const latestMonth = restoredDates[restoredDates.length - 1].slice(0, 7);
      setData(nextData);
      persistData(nextData);
      setSelectedMonth(latestMonth);
      setSelectedDay('');
      setSelectedProduct('');
      setStatus({ text: `Berhasil memulihkan ${restoredCount} tanggal data.` });
      setActiveTab('beranda');
    } catch (err) {
      const msgText =
        err instanceof Error ? err.message : 'File tidak dapat dibaca';
      setStatus({
        text: `Gagal memulihkan cadangan: ${msgText}.`,
        isError: true,
      });
    }
  };

  const handleWipeData = () => {
    if (!wipeArmed) {
      setWipeArmed(true);
      if (wipeTimerRef.current) window.clearTimeout(wipeTimerRef.current);
      wipeTimerRef.current = window.setTimeout(() => setWipeArmed(false), 4000);
      return;
    }

    setWipeArmed(false);
    setData({});
    setSelectedMonth('');
    setSelectedDay('');
    setSelectedProduct('');
    setSearchQuery('');
    setOpenDays({});
    setActiveBarDate('');
    setLastUpload(null);
    setAiMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
    setStatus({ text: 'Semua data stok opname telah dihapus.' });
    setActiveTab('upload');
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
      id: 'upload',
      label: 'Upload',
      mobileLabel: 'Upload',
      icon: <Upload className="w-5 h-5 md:w-4 md:h-4" />,
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
      id: 'ai',
      label: 'Chat AI',
      mobileLabel: 'Chat AI',
      icon: <Sparkles className="w-5 h-5 md:w-4 md:h-4" />,
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
    setSelectedProduct('');
    setActiveBarDate('');
  };

  return (
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

      <input
        ref={restoreInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleRestoreJson(file);
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

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-3d-primary px-4 py-2 text-xs sm:text-sm font-bold rounded-xl whitespace-nowrap shrink-0 flex items-center gap-1.5 min-h-[40px] cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Excel</span>
            </button>
          </div>
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
              <EmptyStateCard
                onUploadClick={() => fileInputRef.current?.click()}
                onRestoreClick={() => restoreInputRef.current?.click()}
              />
            ) : (
              <>
                {/* Hero Banner */}
                <section className="wizzmie-hero-card relative overflow-hidden rounded-2xl p-4 sm:p-6">
                  <div className="hidden dark:block absolute -right-10 -bottom-10 w-44 h-44 bg-blue-600/15 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center gap-4 sm:gap-5 relative z-10">
                    {/* 3D Style Clipboard & Box Badge */}
                    <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 p-0.5 shadow-xl shadow-blue-900/40 flex items-center justify-center">
                      <div className="w-full h-full rounded-2xl bg-slate-900 dark:bg-[#0F2244] flex flex-col items-center justify-center relative">
                        <ClipboardCheck className="w-10 h-10 sm:w-11 sm:h-11 text-blue-400" />
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 bg-amber-400 rounded-lg flex items-center justify-center shadow-md rotate-6">
                          <Package className="w-4 h-4 text-slate-950" />
                        </div>
                      </div>
                    </div>

                    {/* Hero Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] sm:text-xs uppercase font-extrabold tracking-wider text-amber-700 dark:text-amber-400 truncate">
                          {viewScope === 'month'
                            ? 'Rekap Stok Bulanan'
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
                          {viewScope === 'month' ? 'Rekap Stok' : 'Cek Stok'}
                        </h1>
                        <span className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                          {viewScope === 'month'
                            ? formatMonthId(activeMonth)
                            : formatDateId(activeDay)}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300/85 mt-1 leading-relaxed tabular-nums">
                        {viewScope === 'month' ? (
                          <>
                            Gabungan hitungan gudang dari {summary.allMonthDates.length} hari vs catatan sistem ESB ({Object.keys(summary.productMap).length} barang · {summary.totalRowsCount.toLocaleString('id-ID')} baris).
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
                </section>

                {/* Period Toggle, Month Selector & Date Selector */}
                <section className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setViewScope('month')}
                      className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm active:scale-[0.98] transition-all cursor-pointer min-h-[46px] ${
                        viewScope === 'month'
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/25'
                          : 'bg-white dark:bg-[#0D1C36] border border-slate-200 dark:border-[#1C3259] text-slate-700 dark:text-slate-300 font-semibold'
                      }`}
                    >
                      <RefreshCw className="w-4 h-4 shrink-0" />
                      <span>Rekap Sebulan</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewScope('day')}
                      className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm active:scale-[0.98] transition-all cursor-pointer min-h-[46px] ${
                        viewScope === 'day'
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/25'
                          : 'bg-white dark:bg-[#0D1C36] border border-slate-200 dark:border-[#1C3259] text-slate-700 dark:text-slate-300 font-semibold'
                      }`}
                    >
                      <CalendarDays className="w-4 h-4 shrink-0" />
                      <span>Cek 1 Hari</span>
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <MonthSelector
                      months={allMonths}
                      activeMonth={activeMonth}
                      monthCounts={monthCounts}
                      onSelect={handleSelectMonth}
                    />

                    {viewScope === 'day' && (
                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
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
                          className="p-2.5 rounded-xl bg-white dark:bg-[#0F2244] border border-slate-200 dark:border-[#1F3763] text-slate-700 dark:text-slate-200 disabled:opacity-35 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="relative flex-1 sm:min-w-[200px]">
                          <CalendarDays className="w-4 h-4 text-amber-600 dark:text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <select
                            aria-label="Pilih tanggal"
                            value={activeDay}
                            onChange={(e) => setSelectedDay(e.target.value)}
                            className="w-full appearance-none pl-10 pr-9 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-[#1F3763] bg-white dark:bg-[#0F2244] text-slate-900 dark:text-slate-200 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
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
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                          className="p-2.5 rounded-xl bg-white dark:bg-[#0F2244] border border-slate-200 dark:border-[#1F3763] text-slate-700 dark:text-slate-200 disabled:opacity-35 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                {/* 2-Column KPI Cards: Kekurangan Stok & Kelebihan Stok */}
                <section className="grid grid-cols-2 gap-3 sm:gap-4">
                  {/* Kekurangan Stok */}
                  <button
                    type="button"
                    onClick={() => setBerandaModal('neg')}
                    className="group text-left rounded-2xl p-3.5 sm:p-5 bg-white dark:bg-gradient-to-b dark:from-[#181B34] dark:to-[#0F1426] border border-rose-200 dark:border-rose-900/45 hover:border-rose-400 dark:hover:border-rose-500/70 flex flex-col justify-between shadow-sm transition-all active:scale-[0.99] cursor-pointer"
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
                          <div className="text-xs sm:text-sm font-extrabold font-mono text-rose-600 dark:text-rose-400 truncate tabular-nums">
                            - {formatRupiah(summary.totalNeg)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-300 group-hover:underline">
                        <span>Ketuk lihat daftar barang</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>

                  {/* Kelebihan Stok */}
                  <button
                    type="button"
                    onClick={() => setBerandaModal('pos')}
                    className="group text-left rounded-2xl p-3.5 sm:p-5 bg-white dark:bg-gradient-to-b dark:from-[#0F262B] dark:to-[#0A1A22] border border-emerald-200 dark:border-emerald-900/45 hover:border-emerald-400 dark:hover:border-emerald-500/70 flex flex-col justify-between shadow-sm transition-all active:scale-[0.99] cursor-pointer"
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
                          <div className="text-xs sm:text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400 truncate tabular-nums">
                            + {formatRupiah(summary.totalPos)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-300 group-hover:underline">
                        <span>Ketuk lihat daftar barang</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>
                </section>

                {/* Banner Hasil Selisih Akhir + Info Alert Notice */}
                <section className="space-y-2.5">
                  <div
                    role="button"
                    tabIndex={0}
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
                  </div>

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
                    <section className="wizzmie-glass-card rounded-2xl p-4 sm:p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/10 border border-amber-300/60 dark:border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                            <BarChart3 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                                Analisis Selisih Stok Per Tanggal
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
                                    : 'hover:bg-slate-100/70 dark:hover:bg-[#132548]/60'
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
                                        : 'bg-gradient-to-t from-blue-600/60 to-blue-400/70 dark:from-blue-700/50 dark:to-blue-500/60 rounded-t-md opacity-85 group-hover:opacity-100'
                                      : 'bg-slate-200 dark:bg-slate-700/60 rounded-t-md'
                                  }`}
                                  style={{ height: `${barHeight}px` }}
                                />
                                <span
                                  className={`mt-1.5 text-[10px] leading-none font-mono tabular-nums flex items-center justify-center ${
                                    isSelected
                                      ? 'w-6 h-5 rounded-full bg-amber-400 text-slate-950 font-extrabold'
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
                            {viewScope === 'month' && (
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
                    </section>

                    {/* Kondisi Per Bagian (Produksi / Operasional) */}
                    {summary.categoryStats.length > 0 && (
                      <section className="wizzmie-glass-card rounded-2xl p-4 sm:p-5 space-y-3">
                        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Boxes className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                                Kondisi Per Bagian (Produksi / Operasional)
                              </h2>
                              <InfoButton
                                guideKey="categories"
                                onOpen={setActiveInfoKey}
                              />
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                              {viewScope === 'month'
                                ? formatMonthId(activeMonth)
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

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`text-xs sm:text-sm font-mono font-bold tabular-nums ${
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
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
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
                      </section>
                    )}
                  </div>

                  {/* Right Column: Barang yang Perlu Dicek Duluan */}
                  <section className="lg:col-span-5 wizzmie-glass-card rounded-2xl p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300/60 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                          <ClipboardList className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                            Barang yang Perlu Dicek Duluan
                          </h2>
                          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                            {viewScope === 'month'
                              ? `10 selisih terbesar bulan ${formatMonthId(activeMonth)}`
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

                              <div className="flex items-center gap-1 shrink-0">
                                <span
                                  className={`text-xs sm:text-sm font-mono font-extrabold tabular-nums ${
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
                  </section>
                </div>
              </>
            )}
          </div>
        )}

        {/* PAGE 2: UPLOAD DATA */}
        {activeTab === 'upload' && (
          <div className="space-y-6 max-w-5xl">
            <section className="surface-3d rounded-3xl p-5 sm:p-7 space-y-5">
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    Upload Laporan Excel
                  </h1>
                  <InfoButton guideKey="upload" onOpen={setActiveInfoKey} />
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Pilih file laporan stok (.xlsx atau .xls). Semua baris, kode barang, harga, dan catatan tanggal langsung dirapikan otomatis.
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
            </section>

            {lastUpload && (
              <section className="surface-3d rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      Upload Berhasil
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
              </section>
            )}

            {allMonths.length > 0 && (
              <section className="surface-3d rounded-3xl p-5 sm:p-6 space-y-3">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Data Bulan yang Tersimpan
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
              </section>
            )}
          </div>
        )}

        {/* PAGE 3: LAPORAN HARIAN */}
        {activeTab === 'harian' && (
          <div className="space-y-5">
            {!summary ? (
              <EmptyStateCard
                onUploadClick={() => fileInputRef.current?.click()}
                onRestoreClick={() => restoreInputRef.current?.click()}
              />
            ) : (
              <>
                <section className="surface-3d rounded-3xl p-5 sm:p-6 space-y-4">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                        Catatan Harian ({formatMonthId(activeMonth)})
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

                  <MonthSelector
                    months={allMonths}
                    activeMonth={activeMonth}
                    monthCounts={monthCounts}
                    onSelect={(m) => {
                      handleSelectMonth(m);
                      setCategoryFilter('ALL');
                      setPurposeFilter('ALL');
                    }}
                  />
                </section>

                <section className="space-y-3">
                  {summary.dailyStats
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
                        </div>
                      );
                    })}
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
                onUploadClick={() => fileInputRef.current?.click()}
                onRestoreClick={() => restoreInputRef.current?.click()}
              />
            ) : (
              <>
                <section className="surface-3d rounded-3xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                          Cek Kondisi & Riwayat Barang
                        </h1>
                        <InfoButton
                          guideKey="cekBarang"
                          onOpen={setActiveInfoKey}
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        {viewScope === 'month'
                          ? `Data yang sedang dilihat: ${formatMonthId(activeMonth)} (sebulan penuh)`
                          : `Data yang sedang dilihat: ${formatDateId(activeDay)} (1 hari)`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start">
                      <div className="grid grid-cols-2 gap-1 p-1 track-3d rounded-xl">
                        <button
                          type="button"
                          onClick={() => setViewScope('month')}
                          className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all min-h-[38px] cursor-pointer ${
                            viewScope === 'month'
                              ? 'bg-white dark:bg-amber-400 text-slate-900 dark:text-slate-950 shadow-sm'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          Sebulan
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewScope('day')}
                          className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all min-h-[38px] cursor-pointer ${
                            viewScope === 'day'
                              ? 'bg-white dark:bg-amber-400 text-slate-900 dark:text-slate-950 shadow-sm'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          1 Hari
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <MonthSelector
                      months={allMonths}
                      activeMonth={activeMonth}
                      monthCounts={monthCounts}
                      onSelect={handleSelectMonth}
                    />
                    {viewScope === 'day' && (
                      <select
                        aria-label="Pilih tanggal di Cek Barang"
                        value={activeDay}
                        onChange={(e) => setSelectedDay(e.target.value)}
                        className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-amber-500/40 bg-white dark:bg-[#0A162B] text-slate-900 dark:text-slate-100 min-h-[40px]"
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
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Matching list */}
                  <section className="lg:col-span-5 surface-3d rounded-3xl p-4 sm:p-5">
                    <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 tabular-nums">
                      {searchQuery.trim()
                        ? `Hasil pencarian (${matchingProducts.length})`
                        : productFilter === 'pos'
                        ? `Semua barang lebih (${matchingProducts.length})`
                        : productFilter === 'pas'
                        ? `Semua barang pas (${matchingProducts.length})`
                        : productFilter === 'neg'
                        ? `Semua barang kurang (${matchingProducts.length})`
                        : `Semua barang tercatat (${matchingProducts.length})`}
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
                  </section>

                  {/* Product Detail */}
                  <section className="lg:col-span-7 surface-3d rounded-3xl p-5 sm:p-6">
                    {!selectedProductStat ? (
                      <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        Ketuk salah satu barang di sebelah kiri untuk melihat kode barang, harga satuan, jumlah bungkus/dos/porsi, dan riwayat tanggalnya.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                              {selectedProductStat.name}
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
                  </section>
                </div>
              </>
            )}
          </div>
        )}

        {/* PAGE 5: CHAT AI */}
        {activeTab === 'ai' && (
          <div className="space-y-5 max-w-4xl">
            {!summary ? (
              <EmptyStateCard
                onUploadClick={() => fileInputRef.current?.click()}
                onRestoreClick={() => restoreInputRef.current?.click()}
              />
            ) : (
              <>
                <section className="surface-3d rounded-3xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                        Chat AI Analisis Stok
                      </h1>
                      <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        {viewScope === 'month'
                          ? `AI sedang membaca seluruh data ${formatMonthId(activeMonth)} (sebulan penuh).`
                          : `AI sedang membaca data tanggal ${formatDateId(activeDay)} (1 hari).`}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-1 p-1 track-3d rounded-xl self-start">
                      <button
                        type="button"
                        onClick={() => setViewScope('month')}
                        className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all min-h-[38px] cursor-pointer ${
                          viewScope === 'month'
                            ? 'bg-white dark:bg-amber-400 text-slate-900 dark:text-slate-950 shadow-sm'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Sebulan
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewScope('day')}
                        className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all min-h-[38px] cursor-pointer ${
                          viewScope === 'day'
                            ? 'bg-white dark:bg-amber-400 text-slate-900 dark:text-slate-950 shadow-sm'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        1 Hari
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <MonthSelector
                      months={allMonths}
                      activeMonth={activeMonth}
                      monthCounts={monthCounts}
                      onSelect={handleSelectMonth}
                    />
                    {viewScope === 'day' && (
                      <select
                        aria-label="Pilih tanggal untuk dibaca AI"
                        value={activeDay}
                        onChange={(e) => setSelectedDay(e.target.value)}
                        className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-amber-500/40 bg-white dark:bg-[#0A162B] text-slate-900 dark:text-slate-100 min-h-[40px]"
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
                </section>

                <AiAssistantCard
                  summary={summary}
                  activeMonth={activeMonth}
                  data={data}
                  currentMenuLabel="Chat AI"
                  messages={aiMessages}
                  onMessagesChange={setAiMessages}
                  onOpenInfo={setActiveInfoKey}
                />
              </>
            )}
          </div>
        )}

        {/* PAGE 6: PENGATURAN */}
        {activeTab === 'pengaturan' && (
          <div className="space-y-5 max-w-3xl">
            <section className="surface-3d rounded-3xl p-5 sm:p-6 space-y-5">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Pengaturan & Simpan Cadangan
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Semua data tersimpan aman di perangkat ini. Simpan file cadangan sesekali supaya data tetap aman saat pindah HP atau perangkat lain.
                </p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/90">
                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Simpan & Buka Cadangan Data (.json)
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Unduh semua catatan stok ke file cadangan, atau masukkan lagi dari file cadangan.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleBackupJson}
                      className="btn-3d-soft px-4 py-2.5 text-sm font-semibold rounded-xl text-slate-800 dark:text-slate-100 flex items-center gap-2 min-h-[44px] cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Simpan Cadangan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => restoreInputRef.current?.click()}
                      className="btn-3d-soft px-4 py-2.5 text-sm font-semibold rounded-xl text-slate-800 dark:text-slate-100 flex items-center gap-2 min-h-[44px] cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Buka Cadangan</span>
                    </button>
                  </div>
                </div>

                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Hapus Semua Data
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Mengosongkan seluruh catatan stok opname yang tersimpan di perangkat ini.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleWipeData}
                    className={`px-4 py-2.5 text-sm font-semibold rounded-xl flex items-center gap-2 self-start sm:self-auto min-h-[44px] cursor-pointer ${
                      wipeArmed
                        ? 'border border-red-700 bg-red-600 text-white shadow-[0_3px_0_#991b1b] hover:bg-red-700'
                        : 'btn-3d-soft text-red-700 dark:text-red-400'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>
                      {wipeArmed ? 'Yakin? Ketuk Sekali Lagi' : 'Hapus Semua Data'}
                    </span>
                  </button>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Unduh File Tunggal (index.html)
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Versi 1 file HTML statis untuk disimpan atau diupload ke GitHub Pages.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadStandaloneHtml}
                    className="btn-3d-primary px-4 py-2.5 text-sm font-semibold rounded-xl flex items-center gap-2 self-start sm:self-auto min-h-[44px] cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh index.html</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Menu utama"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#081226]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-[#1C3259] shadow-[0_-8px_24px_-6px_rgba(2,6,23,0.45)]"
      >
        <div className="grid grid-cols-6 h-16">
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
    </div>
  );
}

function MonthSelector({
  months,
  activeMonth,
  monthCounts,
  onSelect,
}: {
  months: string[];
  activeMonth: string;
  monthCounts: Record<string, number>;
  onSelect: (m: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {months.map((m) => {
        const isActive = m === activeMonth;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onSelect(m)}
            className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl min-h-[40px] whitespace-nowrap cursor-pointer ${
              isActive
                ? 'btn-3d-primary'
                : 'btn-3d-soft text-slate-700 dark:text-slate-200'
            }`}
          >
            {formatMonthId(m)} ({monthCounts[m] ?? 0} hr)
          </button>
        );
      })}
    </div>
  );
}

function EmptyStateCard({
  onUploadClick,
  onRestoreClick,
}: {
  onUploadClick: () => void;
  onRestoreClick: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <section className="surface-3d rounded-3xl p-6 sm:p-8 lg:p-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
          <div className="space-y-2.5">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white text-balance">
              Pantau Stok Gudang Jadi Lebih Gampang
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
              <span>Upload File Excel</span>
            </button>
            <button
              type="button"
              onClick={onRestoreClick}
              className="btn-3d-soft px-5 py-2.5 text-sm font-semibold rounded-xl text-slate-700 dark:text-slate-200 min-h-[44px] whitespace-nowrap cursor-pointer"
            >
              Pulihkan Cadangan (.json)
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
    </section>
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

  const metaParts = [
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
