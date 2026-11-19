import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Home,
  Moon,
  PackageSearch,
  Search,
  Settings,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { buildStandaloneHtml } from './lib/exportHtml';
import {
  ConvertedStockRow,
  StockDataset,
  StockRow,
  computeSummary,
  convertRowWithMeta,
  formatDateId,
  formatMonthId,
  formatQty,
  formatRupiah,
  formatSignedQty,
  parseExcelBuffer,
  sanitizeDataset,
} from './lib/stockOpname';

const STORAGE_KEY = 'so';
const THEME_KEY = 'so_theme';

type MenuTab = 'beranda' | 'upload' | 'harian' | 'barang' | 'pengaturan';
type DailyFilter = 'all' | 'neg' | 'pos';

interface StatusMessage {
  text: string;
  isError?: boolean;
}

interface UploadReport {
  addedDates: string[];
  updatedDates: string[];
  monthsAffected: string[];
  totalRows: number;
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
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedToDate, setSelectedToDate] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dailyFilter, setDailyFilter] = useState<DailyFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [activeBarDate, setActiveBarDate] = useState<string>('');
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [lastUpload, setLastUpload] = useState<UploadReport | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [wipeArmed, setWipeArmed] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
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

  const activeToDate = useMemo(() => {
    if (!activeMonthDates.length) return '';
    return activeMonthDates.includes(selectedToDate)
      ? selectedToDate
      : activeMonthDates[activeMonthDates.length - 1];
  }, [activeMonthDates, selectedToDate]);

  const summary = useMemo(() => {
    if (!activeMonth || !activeToDate) return null;
    return computeSummary(data, activeMonth, activeToDate);
  }, [data, activeMonth, activeToDate]);

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
          nextData[dateKey] = parsed[dateKey];
          totalRows += parsed[dateKey].length;
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
      setSelectedToDate('');
      setSelectedProduct('');
      setSearchQuery('');
      setActiveBarDate('');
      setLastUpload({
        addedDates: addedDates.sort(),
        updatedDates: updatedDates.sort(),
        monthsAffected,
        totalRows,
      });
      setStatus({
        text: `Berhasil membaca ${totalRows} baris data: ${addedDates.length} tanggal baru ditambahkan, ${updatedDates.length} tanggal diperbarui.`,
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
      setSelectedToDate('');
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
    setSelectedToDate('');
    setSelectedProduct('');
    setSearchQuery('');
    setOpenDays({});
    setActiveBarDate('');
    setLastUpload(null);
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
    const names = Object.keys(summary.productMap);
    if (!q) {
      return names
        .sort((a, b) => summary.productMap[a].negVal - summary.productMap[b].negVal)
        .slice(0, 15);
    }
    return names
      .filter((name) => name.toLowerCase().includes(q))
      .sort((a, b) => summary.productMap[a].negVal - summary.productMap[b].negVal)
      .slice(0, 40);
  }, [summary, searchQuery]);

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
    if (activeBarDate) {
      const found = summary.dailyStats.find((d) => d.date === activeBarDate);
      if (found) return found;
    }
    return worstDay && worstDay.negVal < 0 ? worstDay : null;
  }, [summary, activeBarDate, worstDay]);

  const navItems: { id: MenuTab; label: string; icon: React.ReactNode }[] = [
    { id: 'beranda', label: 'Beranda', icon: <Home className="w-5 h-5 md:w-4 md:h-4" /> },
    { id: 'upload', label: 'Upload', icon: <Upload className="w-5 h-5 md:w-4 md:h-4" /> },
    { id: 'harian', label: 'Harian', icon: <CalendarDays className="w-5 h-5 md:w-4 md:h-4" /> },
    { id: 'barang', label: 'Cek Barang', icon: <PackageSearch className="w-5 h-5 md:w-4 md:h-4" /> },
    { id: 'pengaturan', label: 'Pengaturan', icon: <Settings className="w-5 h-5 md:w-4 md:h-4" /> },
  ];

  const handleSelectMonth = (monthKey: string) => {
    setSelectedMonth(monthKey);
    setSelectedToDate('');
    setSelectedProduct('');
    setActiveBarDate('');
  };

  return (
    <div className="min-h-screen bg-[#f4f6f5] dark:bg-[#0e1313] text-slate-900 dark:text-slate-100 pb-20 md:pb-10 transition-colors">
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

      {/* Top Navigation Bar */}
      <header className="md:sticky md:top-0 z-30 bg-white/95 dark:bg-[#141a1a]/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('beranda')}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            Pantau Stok Opname
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 min-h-[40px] cursor-pointer"
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
          <div className="space-y-5">
            {!summary ? (
              <EmptyStateCard
                onUploadClick={() => fileInputRef.current?.click()}
                onRestoreClick={() => restoreInputRef.current?.click()}
              />
            ) : (
              <>
                {/* Month & Date Filter Bar */}
                <section className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                        Ringkasan {formatMonthId(activeMonth)}
                        {summary.branchName ? ` — ${summary.branchName}` : ''}
                      </h1>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Data masuk{' '}
                        <strong className="text-slate-900 dark:text-white tabular-nums">
                          {summary.allMonthDates.length} hari
                        </strong>{' '}
                        ({formatDateId(summary.allMonthDates[0])} –{' '}
                        {formatDateId(
                          summary.allMonthDates[summary.allMonthDates.length - 1]
                        )}
                        )
                        {summary.missingDays.length > 0 && (
                          <span className="text-red-700 dark:text-red-400 font-medium">
                            {' '}
                            · Belum upload tanggal:{' '}
                            {summary.missingDays.join(', ')}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label
                        htmlFor="to-date-select"
                        className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
                      >
                        Hitung s.d.
                      </label>
                      <select
                        id="to-date-select"
                        value={activeToDate}
                        onChange={(e) => setSelectedToDate(e.target.value)}
                        className="px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2222] text-slate-900 dark:text-slate-100 min-h-[44px]"
                      >
                        {summary.allMonthDates.map((d) => (
                          <option key={d} value={d}>
                            {formatDateId(d)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <MonthSelector
                    months={allMonths}
                    activeMonth={activeMonth}
                    monthCounts={monthCounts}
                    onSelect={handleSelectMonth}
                  />
                </section>

                {/* 3 Big Readable KPI Cards */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 p-5">
                    <div className="text-sm font-semibold text-red-900 dark:text-red-200">
                      1. Total Barang Kurang (Minus)
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-bold font-mono tabular-nums text-red-700 dark:text-red-300">
                      - {formatRupiah(summary.totalNeg)}
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-red-800/90 dark:text-red-200/80">
                      Ada <strong className="tabular-nums">{summary.negProductCount} barang</strong> yang jumlah fisiknya lebih sedikit dari stok di sistem.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-5">
                    <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                      2. Total Barang Lebih (Plus)
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                      + {formatRupiah(summary.totalPos)}
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-emerald-800/90 dark:text-emerald-200/80">
                      Ada <strong className="tabular-nums">{summary.posProductCount} barang</strong> yang jumlah fisiknya lebih banyak dari stok di sistem.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151c1c] p-5">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      3. Selisih Bersih Bulan Ini
                    </div>
                    <div
                      className={`mt-2 text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
                        summary.netTotal < -0.5
                          ? 'text-red-700 dark:text-red-300'
                          : summary.netTotal > 0.5
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {summary.netTotal < -0.5
                        ? `KURANG ${formatRupiah(summary.netTotal)}`
                        : summary.netTotal > 0.5
                        ? `LEBIH ${formatRupiah(summary.netTotal)}`
                        : 'PAS Rp 0'}
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                      Gabungan kurang & lebih dari {formatDateId(summary.activeDates[0])} s.d. {formatDateId(activeToDate)}.
                    </p>
                  </div>
                </section>

                {/* Plain-language takeaway & Category breakdown */}
                {summary.categoryStats.length > 0 && (
                  <section className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        Ringkasan Per Kategori Barang
                      </h2>
                      <p className="mt-0.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                        Kategori dengan nilai barang kurang paling besar:{' '}
                        <strong className="text-red-700 dark:text-red-300">
                          {summary.categoryStats[0].category} (
                          {formatRupiah(summary.categoryStats[0].negVal)})
                        </strong>
                        . Ketuk kategori untuk melihat rinciannya di Laporan Harian.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {summary.categoryStats.map((cat) => (
                        <button
                          key={cat.category}
                          type="button"
                          onClick={() => {
                            setCategoryFilter(cat.category);
                            setActiveTab('harian');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#1a2222] hover:border-teal-500 p-3.5 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {cat.category}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                              {cat.diffItems} selisih
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums">
                            <span className="text-red-700 dark:text-red-300 font-semibold">
                              Kurang {formatRupiah(cat.negVal)}
                            </span>
                            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                              Lebih {formatRupiah(cat.posVal)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Daily Trend & Top 10 */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Daily Bar Chart */}
                  <section className="lg:col-span-7 bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        Grafik Barang Kurang Harian
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                        Ketuk salah satu batang tanggal untuk melihat total selisih di hari tersebut.
                      </p>
                    </div>

                    <div className="flex items-end gap-1.5 overflow-x-auto pb-1 pt-2">
                      {summary.dailyStats.map((day) => {
                        const barHeight =
                          day.negVal < 0
                            ? Math.max(
                                8,
                                Math.round(
                                  (Math.abs(day.negVal) / maxDailyDeficit) * 132
                                )
                              )
                            : 0;
                        const isSelected = activeBarDate === day.date;
                        return (
                          <button
                            key={day.date}
                            type="button"
                            onClick={() => setActiveBarDate(day.date)}
                            className={`group flex-1 min-w-[30px] h-[164px] flex flex-col justify-end items-center rounded-lg py-1.5 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-teal-50 dark:bg-teal-950/50 ring-1 ring-teal-500'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <span
                              className={`block w-4/5 max-w-[24px] rounded-t transition-opacity ${
                                isSelected
                                  ? 'bg-red-600 dark:bg-red-400 opacity-100'
                                  : 'bg-red-500/80 dark:bg-red-400/80 group-hover:opacity-100'
                              }`}
                              style={{ height: `${barHeight}px` }}
                            />
                            <span className="mt-1.5 text-[11px] leading-none font-mono font-medium tabular-nums text-slate-600 dark:text-slate-300">
                              {Number(day.date.slice(8))}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {highlightedBarStat && (
                      <div className="rounded-xl bg-slate-50 dark:bg-[#1a2222] border border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5 text-sm tabular-nums">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {formatDateId(highlightedBarStat.date)} ·{' '}
                            <span className="font-normal text-slate-500 dark:text-slate-400">
                              {highlightedBarStat.diffCount} barang selisih
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm">
                            <span className="text-red-700 dark:text-red-300 font-semibold">
                              Kurang: - {formatRupiah(highlightedBarStat.negVal)}
                            </span>
                            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                              Lebih: + {formatRupiah(highlightedBarStat.posVal)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenDayInHarian(highlightedBarStat.date)
                          }
                          className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 transition-colors flex items-center gap-1.5 self-start sm:self-auto min-h-[40px] cursor-pointer"
                        >
                          <span>Lihat Rincian Tanggal Ini</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </section>

                  {/* Top 10 Deficits */}
                  <section className="lg:col-span-5 bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
                    <div className="mb-3">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        10 Barang Paling Banyak Kurang
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                        Ketuk nama barang untuk melihat riwayat harian barang tersebut.
                      </p>
                    </div>

                    {summary.topDeficits.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                        Tidak ada barang yang kurang pada bulan ini.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {summary.topDeficits.map((item, index) => (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => handlePickProduct(item.name)}
                            className="w-full flex items-center justify-between gap-3 py-3 px-2 text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors min-h-[52px] cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-mono font-bold tabular-nums flex items-center justify-center shrink-0">
                                {index + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                  {item.name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                  Kurang di {item.negDays} hari
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-mono font-bold tabular-nums text-red-700 dark:text-red-300">
                                - {formatRupiah(item.negVal)}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </>
            )}
          </div>
        )}

        {/* PAGE 2: UPLOAD DATA */}
        {activeTab === 'upload' && (
          <div className="space-y-5">
            <section className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Upload Laporan Stock Opname
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Pilih file Excel (.xlsx atau .xls) hasil ekspor laporan Stock Opname harian. Anda bisa memilih satu atau banyak file sekaligus.
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
                className={`rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-teal-600 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-950/30'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-[#182020] hover:border-teal-600 dark:hover:border-teal-500'
                }`}
              >
                <div className="mx-auto w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 flex items-center justify-center mb-3">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <p className="text-base sm:text-lg font-bold text-teal-800 dark:text-teal-300">
                  Ketuk di sini untuk pilih file Excel (.xlsx / .xls)
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Atau tarik file langsung ke kotak ini
                </p>
              </div>

              {/* Plain-language explanation of month/date update rules */}
              <div className="rounded-xl bg-slate-50 dark:bg-[#1a2222] border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cara kerja pembaruan data otomatis:
                </h2>
                <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-5">
                  <li>
                    <strong>Tanggal yang sama di bulan yang sama:</strong> Data tanggal tersebut akan <strong>diperbarui (ditimpa)</strong> dengan file terbaru, tidak terhitung ganda.
                  </li>
                  <li>
                    <strong>Tanggal berbeda di bulan yang sama:</strong> Data ditambahkan ke dalam bulan tersebut dan total bulanan langsung dihitung ulang.
                  </li>
                  <li>
                    <strong>Bulan yang berbeda:</strong> Otomatis masuk ke <strong>bulan baru</strong> secara terpisah agar laporan antar bulan tidak tercampur.
                  </li>
                </ul>
              </div>
            </section>

            {/* Upload result feedback */}
            {lastUpload && (
              <section className="bg-white dark:bg-[#151c1c] border border-teal-200 dark:border-teal-900 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      Ringkasan Upload Terakhir
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Total {lastUpload.totalRows} baris barang diproses ke bulan:{' '}
                      <strong>
                        {lastUpload.monthsAffected.map(formatMonthId).join(', ')}
                      </strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('beranda')}
                    className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 transition-colors flex items-center gap-2 self-start sm:self-auto min-h-[44px] cursor-pointer"
                  >
                    <span>Lihat Hasil di Beranda</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                      Tanggal baru ditambahkan ({lastUpload.addedDates.length})
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      {lastUpload.addedDates.length > 0
                        ? lastUpload.addedDates.map(formatDateId).join(', ')
                        : 'Tidak ada tanggal baru.'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="font-semibold text-teal-700 dark:text-teal-300">
                      Tanggal diperbarui / ditimpa ({lastUpload.updatedDates.length})
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

            {/* Stored Months Overview */}
            {allMonths.length > 0 && (
              <section className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Data Bulan yang Sudah Tersimpan
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
                        className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px] cursor-pointer"
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
                <section className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                        Laporan Harian ({formatMonthId(activeMonth)})
                      </h1>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Ketuk salah satu tanggal untuk melihat barang mana saja yang stok fisiknya berbeda dengan sistem.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start">
                      <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-[#1c2424] rounded-lg">
                        {(
                          [
                            { id: 'all', label: 'Semua Selisih' },
                            { id: 'neg', label: 'Hanya Kurang' },
                            { id: 'pos', label: 'Hanya Lebih' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setDailyFilter(tab.id)}
                            className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap min-h-[36px] cursor-pointer ${
                              dailyFilter === tab.id
                                ? 'bg-white dark:bg-teal-500 text-slate-900 dark:text-slate-950 shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {summary.categoryStats.length > 0 && (
                        <select
                          aria-label="Filter kategori"
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2222] text-slate-900 dark:text-slate-100 min-h-[42px]"
                        >
                          <option value="ALL">Semua Kategori</option>
                          {summary.categoryStats.map((cat) => (
                            <option key={cat.category} value={cat.category}>
                              {cat.category}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <MonthSelector
                    months={allMonths}
                    activeMonth={activeMonth}
                    monthCounts={monthCounts}
                    onSelect={(m) => {
                      handleSelectMonth(m);
                      setCategoryFilter('ALL');
                    }}
                  />
                </section>

                <section className="space-y-3">
                  {summary.dailyStats
                    .slice()
                    .reverse()
                    .map((day) => {
                      const isOpen = Boolean(openDays[day.date]);
                      const rows = isOpen
                        ? data[day.date]
                            .map(convertRowWithMeta)
                            .filter(({ row }) => {
                              const hasDiff =
                                Math.abs(row[4]) > 1e-9 ||
                                Math.abs(row[6]) > 0.5;
                              if (!hasDiff) return false;
                              if (
                                categoryFilter !== 'ALL' &&
                                (row[8] || 'Lainnya') !== categoryFilter
                              ) {
                                return false;
                              }
                              if (dailyFilter === 'neg') return row[4] < -1e-9 || row[6] < -0.5;
                              if (dailyFilter === 'pos') return row[4] > 1e-9 || row[6] > 0.5;
                              return true;
                            })
                            .sort((a, b) => a.row[6] - b.row[6])
                        : [];

                      return (
                        <div
                          key={day.date}
                          id={`day-${day.date}`}
                          className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDays((prev) => ({
                                ...prev,
                                [day.date]: !prev[day.date],
                              }))
                            }
                            className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              {isOpen ? (
                                <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
                              )}
                              <div>
                                <div className="text-base font-bold text-slate-900 dark:text-white">
                                  {formatDateId(day.date)}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                  {day.diffCount} barang selisih · Total kurang bulan ini s.d. tgl ini: {formatRupiah(day.cumNegVal)}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-mono tabular-nums pl-7 sm:pl-0">
                              <span className="text-red-700 dark:text-red-300 font-bold">
                                Kurang {formatRupiah(day.negVal)}
                              </span>
                              <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                                Lebih {formatRupiah(day.posVal)}
                              </span>
                            </div>
                          </button>

                          {isOpen && (
                            <div className="border-t border-slate-200 dark:border-slate-800 px-4 sm:px-5 pb-3 divide-y divide-slate-100 dark:divide-slate-800">
                              {rows.length === 0 ? (
                                <p className="py-4 text-sm text-slate-500 dark:text-slate-400">
                                  Tidak ada barang pada kategori ini di tanggal tersebut.
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
                <section className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                      Cek Riwayat Barang ({formatMonthId(activeMonth)})
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Cari nama barang untuk melihat berapa kali kurang/lebih dan perubahannya dari hari ke hari.
                    </p>
                  </div>

                  <MonthSelector
                    months={allMonths}
                    activeMonth={activeMonth}
                    monthCounts={monthCounts}
                    onSelect={handleSelectMonth}
                  />

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedProduct('');
                      }}
                      placeholder="Ketik nama barang, misal: udang keju, ceker, mie..."
                      autoComplete="off"
                      className="w-full pl-10 pr-4 py-3 text-sm sm:text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2222] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Matching list */}
                  <section className="lg:col-span-5 bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
                    <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                      {searchQuery.trim()
                        ? `Hasil pencarian (${matchingProducts.length})`
                        : 'Daftar barang selisih terbesar bulan ini'}
                    </h2>

                    {matchingProducts.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                        Barang tidak ditemukan pada bulan ini.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
                        {matchingProducts.map((name) => {
                          const stat = summary.productMap[name];
                          const isPicked = effectiveSelectedProduct === name;
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => setSelectedProduct(name)}
                              className={`w-full flex items-center justify-between gap-3 py-3 px-2.5 text-left rounded-lg transition-colors min-h-[52px] cursor-pointer ${
                                isPicked
                                  ? 'bg-teal-50 dark:bg-teal-950/50'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                  {name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                  Kurang {formatRupiah(stat.negVal)} · Lebih{' '}
                                  {formatRupiah(stat.posVal)}
                                </div>
                              </div>
                              <div
                                className={`text-xs sm:text-sm font-mono font-bold tabular-nums whitespace-nowrap shrink-0 ${
                                  stat.negVal < 0
                                    ? 'text-red-700 dark:text-red-300'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {stat.negVal < 0
                                  ? `- ${formatRupiah(stat.negVal)}`
                                  : 'Aman'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Product Detail */}
                  <section className="lg:col-span-7 bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
                    {!selectedProductStat ? (
                      <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        Pilih salah satu barang di samping untuk melihat rincian catatan sistem, hitung fisik, dan selisih per tanggal.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                              {selectedProductStat.name}
                            </h2>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              Kategori: <strong className="text-slate-700 dark:text-slate-200">{selectedProductStat.category}</strong>
                            </p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                              Total selisih jumlah:{' '}
                              <strong className="font-mono text-slate-900 dark:text-white">
                                {Object.entries(selectedProductStat.qtyByUnit)
                                  .filter(([, val]) => Math.abs(val) > 1e-9)
                                  .map(
                                    ([unit, val]) =>
                                      `${formatSignedQty(val)} ${unit}`
                                  )
                                  .join(', ') || '0 (Pas)'}
                              </strong>
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedProduct('')}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 min-h-[36px] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Tutup</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm tabular-nums">
                          <div className="rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200/70 dark:border-red-900/50 p-3">
                            <div className="text-xs text-red-800 dark:text-red-300 font-medium">
                              Total Kurang
                            </div>
                            <div className="mt-0.5 font-mono font-bold text-red-700 dark:text-red-300">
                              - {formatRupiah(selectedProductStat.negVal)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 p-3">
                            <div className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                              Total Lebih
                            </div>
                            <div className="mt-0.5 font-mono font-bold text-emerald-700 dark:text-emerald-300">
                              + {formatRupiah(selectedProductStat.posVal)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-50 dark:bg-[#1a2222] border border-slate-200 dark:border-slate-700 p-3">
                            <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                              Selisih Bersih
                            </div>
                            <div
                              className={`mt-0.5 font-mono font-bold ${
                                selectedProductStat.netVal < -0.5
                                  ? 'text-red-700 dark:text-red-300'
                                  : selectedProductStat.netVal > 0.5
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : 'text-slate-900 dark:text-white'
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

                        <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
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

        {/* PAGE 5: PENGATURAN */}
        {activeTab === 'pengaturan' && (
          <div className="space-y-5 max-w-3xl">
            <section className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Pengaturan & Cadangan Data
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Data laporan stok opname tersimpan langsung di browser perangkat ini. Gunakan cadangan berkala agar data aman jika ganti HP atau hapus riwayat browser.
                </p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Tema Tampilan
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Pilih tampilan terang atau gelap sesuai kenyamanan mata.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDark((prev) => !prev)}
                    className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2222] hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 self-start sm:self-auto min-h-[44px] cursor-pointer"
                  >
                    {isDark ? (
                      <Sun className="w-4 h-4" />
                    ) : (
                      <Moon className="w-4 h-4" />
                    )}
                    <span>{isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}</span>
                  </button>
                </div>

                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Cadangkan & Pulihkan Data (.json)
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Unduh semua data tersimpan ke file cadangan, atau muat ulang dari file cadangan.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleBackupJson}
                      className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2222] hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 min-h-[44px] cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Cadangkan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => restoreInputRef.current?.click()}
                      className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2222] hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 min-h-[44px] cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Pulihkan</span>
                    </button>
                  </div>
                </div>

                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Hapus Semua Data
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Mengosongkan seluruh data stok opname yang tersimpan di browser ini.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleWipeData}
                    className={`px-4 py-2.5 text-sm font-semibold rounded-lg border flex items-center gap-2 self-start sm:self-auto min-h-[44px] cursor-pointer ${
                      wipeArmed
                        ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                        : 'border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>
                      {wipeArmed
                        ? 'Yakin? Ketuk Sekali Lagi'
                        : 'Hapus Semua Data'}
                    </span>
                  </button>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Ekspor File Tunggal GitHub Pages (index.html)
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Unduh versi 1 file statis jika Anda ingin menguploadnya ke GitHub Pages tanpa proses build.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadStandaloneHtml}
                    className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 hover:bg-teal-100/70 flex items-center gap-2 self-start sm:self-auto min-h-[44px] cursor-pointer"
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
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#141a1a]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800"
      >
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors cursor-pointer ${
                  isActive
                    ? 'text-teal-700 dark:text-teal-300 font-bold'
                    : 'text-slate-500 dark:text-slate-400 font-medium'
                }`}
              >
                {item.icon}
                <span className="text-[11px] leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
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
            className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg border transition-colors min-h-[40px] cursor-pointer ${
              isActive
                ? 'bg-teal-700 border-teal-700 text-white dark:bg-teal-500 dark:border-teal-500 dark:text-slate-950'
                : 'bg-slate-50 dark:bg-[#1a2222] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
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
  return (
    <section className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          Belum Ada Data Stok Opname
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl">
          Mulai dengan mengupload file laporan Stock Opname (.xlsx / .xls) Anda. Setiap tanggal akan otomatis dikelompokkan berdasarkan bulannya.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onUploadClick}
          className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 transition-colors flex items-center gap-2 min-h-[44px] cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>Upload File Excel</span>
        </button>
        <button
          type="button"
          onClick={onRestoreClick}
          className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2222] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[44px] cursor-pointer"
        >
          Pulihkan Cadangan (.json)
        </button>
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
  const diffVal = row[6];
  const unit = row[1];
  const info = row[7];
  const state = diffQty < -1e-9 ? 'neg' : diffQty > 1e-9 ? 'pos' : 'eq';

  return (
    <div className="py-3.5 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {onTitleClick ? (
            <button
              type="button"
              onClick={onTitleClick}
              className="text-sm sm:text-base font-bold text-slate-900 dark:text-white hover:text-teal-700 dark:hover:text-teal-300 text-left break-words cursor-pointer"
            >
              {title}
            </button>
          ) : (
            <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white break-words">
              {title}
            </div>
          )}
          {(wasConverted || info) && (
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {wasConverted && (
                <span>
                  Konversi otomatis dari {formatSignedQty(originalDiffQty)}{' '}
                  {originalUnit}
                </span>
              )}
              {wasConverted && info ? ' · ' : ''}
              {info && <span>Catatan: {info}</span>}
            </div>
          )}
        </div>

        <div className="text-right shrink-0 font-mono tabular-nums">
          <div
            className={`text-sm sm:text-base font-bold ${
              state === 'neg'
                ? 'text-red-700 dark:text-red-300'
                : state === 'pos'
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {state === 'neg'
              ? `- ${formatRupiah(diffVal)}`
              : state === 'pos'
              ? `+ ${formatRupiah(diffVal)}`
              : 'Rp 0'}
          </div>
          <div
            className={`text-xs font-semibold ${
              state === 'neg'
                ? 'text-red-700 dark:text-red-300'
                : state === 'pos'
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {state === 'neg'
              ? `Kurang ${formatQty(diffQty)} ${unit}`
              : state === 'pos'
              ? `Lebih ${formatQty(diffQty)} ${unit}`
              : 'Pas'}
          </div>
        </div>
      </div>

      {/* Clear human-readable numbers */}
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 dark:bg-[#1a2222] px-3 py-2 text-xs tabular-nums">
        <div>
          <span className="text-slate-500 dark:text-slate-400">Stok Sistem: </span>
          <strong className="font-mono text-slate-800 dark:text-slate-200">
            {formatQty(sysQty)} {unit}
          </strong>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400">Hitung Fisik: </span>
          <strong className="font-mono text-slate-800 dark:text-slate-200">
            {formatQty(opQty)} {unit}
          </strong>
        </div>
      </div>
    </div>
  );
}
