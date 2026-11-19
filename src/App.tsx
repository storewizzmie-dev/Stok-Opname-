import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Moon,
  Search,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { buildStandaloneHtml } from './lib/exportHtml';
import {
  StockDataset,
  StockRow,
  computeSummary,
  formatDateId,
  formatMonthId,
  formatQty,
  formatRupiah,
  formatSignedQty,
  getConvertedRows,
  parseExcelBuffer,
  sanitizeDataset,
} from './lib/stockOpname';

const STORAGE_KEY = 'so';
const THEME_KEY = 'so_theme';

interface StatusMessage {
  text: string;
  isError?: boolean;
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

  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedToDate, setSelectedToDate] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [activeBarDate, setActiveBarDate] = useState<string>('');
  const [status, setStatus] = useState<StatusMessage | null>(null);
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
  const productDetailRef = useRef<HTMLDivElement>(null);
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
    setStatus({ text: 'Membaca file laporan...' });

    try {
      let addedCount = 0;
      let updatedCount = 0;
      const importedDates: string[] = [];
      const nextData: StockDataset = { ...data };

      for (const file of list) {
        const buffer = await file.arrayBuffer();
        const parsed = parseExcelBuffer(buffer);
        for (const dateKey of Object.keys(parsed)) {
          if (nextData[dateKey]) updatedCount++;
          else addedCount++;
          nextData[dateKey] = parsed[dateKey];
          importedDates.push(dateKey);
        }
      }

      if (!importedDates.length) {
        throw new Error('tidak ada baris data yang terbaca');
      }

      const latestDate = importedDates.sort()[importedDates.length - 1];
      const latestMonth = latestDate.slice(0, 7);

      setData(nextData);
      persistData(nextData);
      setSelectedMonth(latestMonth);
      setSelectedToDate('');
      setSelectedProduct('');
      setSearchQuery('');
      setActiveBarDate('');
      setStatus({
        text: `${addedCount} tanggal baru ditambahkan, ${updatedCount} tanggal diperbarui. Total ${formatMonthId(
          latestMonth
        )} sudah dihitung ulang.`,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Format file tidak sesuai.';
      setStatus({
        text: `Gagal membaca file: ${message}. Pastikan file adalah laporan Stock Opname (.xlsx).`,
        isError: true,
      });
    }
  };

  const handlePickProduct = (productName: string) => {
    setSelectedProduct(productName);
    setSearchQuery(productName);
    window.requestAnimationFrame(() => {
      productDetailRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  const handleBarClick = (dateKey: string) => {
    setActiveBarDate(dateKey);
    setOpenDays((prev) => ({ ...prev, [dateKey]: true }));
    const target = document.getElementById(`day-${dateKey}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
      text: 'File index.html versi terbaru berhasil diunduh (siap diupload ke GitHub Pages).',
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
      setStatus({ text: `Dipulihkan: ${restoredCount} tanggal.` });
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
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
    setStatus({ text: 'Semua data stok opname telah dihapus.' });
  };

  const matchingProducts = useMemo(() => {
    if (!summary) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return Object.keys(summary.productMap)
      .filter((name) => name.toLowerCase().includes(q))
      .sort((a, b) => summary.productMap[a].negVal - summary.productMap[b].negVal)
      .slice(0, 30);
  }, [summary, searchQuery]);

  const effectiveSelectedProduct = useMemo(() => {
    if (!summary) return '';
    if (selectedProduct && summary.productMap[selectedProduct]) {
      return selectedProduct;
    }
    if (matchingProducts.length === 1) {
      return matchingProducts[0];
    }
    return '';
  }, [summary, selectedProduct, matchingProducts]);

  const selectedProductStat =
    summary && effectiveSelectedProduct
      ? summary.productMap[effectiveSelectedProduct]
      : null;

  const selectedProductTimeline = useMemo(() => {
    if (!summary || !effectiveSelectedProduct) return [];
    const entries: { date: string; row: StockRow }[] = [];
    for (const date of summary.activeDates) {
      const converted = getConvertedRows(data[date]);
      for (const row of converted) {
        if (row[0] === effectiveSelectedProduct) {
          entries.push({ date, row });
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

  return (
    <div className="min-h-screen bg-[#f4f6f5] dark:bg-[#0e1313] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar Contract: 3 zones */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#141a1a]/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            Pantau Stok Opname
          </a>

          {summary && (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
              <a
                href="#ringkasan"
                className="hover:text-teal-700 dark:hover:text-teal-400 transition-colors whitespace-nowrap shrink-0"
              >
                Ringkasan
              </a>
              <a
                href="#peringkat"
                className="hover:text-teal-700 dark:hover:text-teal-400 transition-colors whitespace-nowrap shrink-0"
              >
                Peringkat
              </a>
              <a
                href="#cari"
                className="hover:text-teal-700 dark:hover:text-teal-400 transition-colors whitespace-nowrap shrink-0"
              >
                Cari Barang
              </a>
              <a
                href="#harian"
                className="hover:text-teal-700 dark:hover:text-teal-400 transition-colors whitespace-nowrap shrink-0"
              >
                Harian
              </a>
            </nav>
          )}

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload (.xlsx)</span>
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Intro & Dropzone */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                Pantau Selisih Stok Opname Harian
              </h1>
              <p className="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-300">
                Upload laporan setiap hari. Sistem otomatis menghitung nilai barang yang kurang (minus) dan lebih (plus) beserta konversi dus ke satuan dasar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              className="self-start sm:self-auto px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#171e1e] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              aria-label="Ubah tema tampilan"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>
            </button>
          </div>

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
            className={`rounded-xl border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-teal-600 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-950/30'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#151c1c] hover:border-teal-600 dark:hover:border-teal-500'
            }`}
          >
            <div className="mx-auto w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center mb-2">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-base font-semibold text-teal-800 dark:text-teal-300">
              Pilih file laporan Stock Opname (.xlsx / .xls)
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Tarik file ke sini atau klik untuk memilih beberapa file sekaligus. Tanggal yang sama otomatis diperbarui.
            </p>
          </div>

          {status && (
            <div
              role="status"
              className={`px-4 py-3 rounded-lg text-sm font-medium border ${
                status.isError
                  ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
              }`}
            >
              {status.text}
            </div>
          )}
        </section>

        {/* Empty State */}
        {!summary ? (
          <section className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Belum ada data stok opname
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl">
              Upload file laporan Stock Opname (.xlsx) pertama Anda melalui kotak di atas atau pulihkan dari file cadangan (.json). Ringkasan bulanan, grafik harian, peringkat selisih, dan pencarian barang akan langsung tampil di sini.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 transition-colors cursor-pointer"
              >
                Pilih File Laporan (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => restoreInputRef.current?.click()}
                className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2222] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Pulihkan Cadangan (.json)
              </button>
            </div>
          </section>
        ) : (
          <>
            {/* Section 1: Period Selection & Summary */}
            <section
              id="ringkasan"
              className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Periode Laporan
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    <span>
                      Tersimpan{' '}
                      <strong className="text-slate-700 dark:text-slate-200 tabular-nums">
                        {summary.allMonthDates.length} hari
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {formatDateId(summary.allMonthDates[0])} –{' '}
                      {formatDateId(
                        summary.allMonthDates[summary.allMonthDates.length - 1]
                      )}
                    </span>
                    {summary.missingDays.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-red-700 dark:text-red-400 font-medium">
                          Belum diupload: tanggal {summary.missingDays.join(', ')}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label
                    htmlFor="to-date-select"
                    className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
                  >
                    Sampai tanggal
                  </label>
                  <select
                    id="to-date-select"
                    value={activeToDate}
                    onChange={(e) => setSelectedToDate(e.target.value)}
                    className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2222] text-slate-900 dark:text-slate-100 min-h-[40px]"
                  >
                    {summary.allMonthDates.map((d) => (
                      <option key={d} value={d}>
                        {formatDateId(d)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Segmented Month Selector */}
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-[#1c2424] rounded-lg w-fit max-w-full">
                {allMonths.map((monthKey) => {
                  const isActive = monthKey === activeMonth;
                  return (
                    <button
                      key={monthKey}
                      type="button"
                      onClick={() => {
                        setSelectedMonth(monthKey);
                        setSelectedToDate('');
                        setSelectedProduct('');
                        setActiveBarDate('');
                      }}
                      className={`px-3.5 py-1.5 text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-white dark:bg-teal-500 text-slate-900 dark:text-slate-950 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {formatMonthId(monthKey)}
                    </button>
                  );
                })}
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg border border-red-200/80 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 p-4">
                  <div className="text-xs font-semibold text-red-800 dark:text-red-300">
                    Total Kurang (Minus)
                  </div>
                  <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-red-700 dark:text-red-300">
                    {formatRupiah(summary.totalNeg)}
                  </div>
                  <div className="mt-1 text-xs text-red-700/85 dark:text-red-300/80 tabular-nums">
                    {summary.negProductCount} barang pernah kurang
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4">
                  <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    Total Lebih (Plus)
                  </div>
                  <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                    {formatRupiah(summary.totalPos)}
                  </div>
                  <div className="mt-1 text-xs text-emerald-700/85 dark:text-emerald-300/80 tabular-nums">
                    {summary.posProductCount} barang pernah lebih
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-[#192121] p-4">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Hasil Akhir (Selisih Bersih)
                  </div>
                  <div
                    className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
                      summary.netTotal < -0.5
                        ? 'text-red-700 dark:text-red-300'
                        : summary.netTotal > 0.5
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {formatRupiah(summary.netTotal)}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {summary.netTotal < -0.5
                      ? 'Status: Stok keseluruhan KURANG'
                      : summary.netTotal > 0.5
                      ? 'Status: Stok keseluruhan LEBIH'
                      : 'Status: Stok keseluruhan PAS'}
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-100 dark:border-slate-800">
                Periode{' '}
                <strong className="text-slate-900 dark:text-white">
                  {formatDateId(summary.activeDates[0])}
                </strong>{' '}
                sampai{' '}
                <strong className="text-slate-900 dark:text-white">
                  {formatDateId(activeToDate)}
                </strong>
                : barang kurang bernilai{' '}
                <span className="font-semibold text-red-700 dark:text-red-300 tabular-nums">
                  {formatRupiah(summary.totalNeg)}
                </span>{' '}
                dan barang lebih bernilai{' '}
                <span className="font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {formatRupiah(summary.totalPos)}
                </span>
                . Tiap bulan dihitung terpisah mulai dari nol.
              </p>
            </section>

            {/* Daily Deficit Chart */}
            <section className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Nilai Kurang Setiap Hari
                </h2>
                {highlightedBarStat && (
                  <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatDateId(highlightedBarStat.date)}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span className="text-red-700 dark:text-red-300 font-medium">
                      Kurang {formatRupiah(highlightedBarStat.negVal)}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                      Lebih {formatRupiah(highlightedBarStat.posVal)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-end gap-1.5 overflow-x-auto pb-1 pt-2">
                {summary.dailyStats.map((day) => {
                  const barHeight =
                    day.negVal < 0
                      ? Math.max(
                          6,
                          Math.round(
                            (Math.abs(day.negVal) / maxDailyDeficit) * 124
                          )
                        )
                      : 0;
                  const isSelected = activeBarDate === day.date;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => handleBarClick(day.date)}
                      title={`${formatDateId(day.date)}: Kurang ${formatRupiah(
                        day.negVal
                      )}`}
                      className={`group flex-1 min-w-[26px] h-[152px] flex flex-col justify-end items-center rounded-md py-1 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-teal-50 dark:bg-teal-950/40 ring-1 ring-teal-500'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span
                        className={`block w-4/5 max-w-[22px] rounded-t transition-opacity ${
                          isSelected
                            ? 'bg-red-600 dark:bg-red-400 opacity-100'
                            : 'bg-red-500/80 dark:bg-red-400/80 group-hover:opacity-100'
                        }`}
                        style={{ height: `${barHeight}px` }}
                      />
                      <span className="mt-1.5 text-[11px] leading-none font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {Number(day.date.slice(8))}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ketuk salah satu batang tanggal untuk membuka rincian selisih pada tanggal tersebut.
              </p>
            </section>

            {/* Two-column desktop split for Top 10 & Search */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Section 3: Top 10 Deficits */}
              <section
                id="peringkat"
                className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6"
              >
                <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
                  10 Barang Paling Banyak Kurang
                </h2>
                {summary.topDeficits.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Tidak ada barang yang kurang pada periode ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {summary.topDeficits.map((item, index) => {
                      const isPicked = effectiveSelectedProduct === item.name;
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => handlePickProduct(item.name)}
                          className={`w-full flex items-center justify-between gap-3 py-3 px-2 text-left rounded-lg transition-colors cursor-pointer ${
                            isPicked
                              ? 'bg-teal-50 dark:bg-teal-950/40'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-mono font-bold tabular-nums flex items-center justify-center shrink-0">
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
                          <div className="text-sm font-mono font-semibold tabular-nums text-red-700 dark:text-red-300 whitespace-nowrap shrink-0">
                            Kurang {formatRupiah(item.negVal)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Section 4: Search & Product Breakdown */}
              <section
                id="cari"
                className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4"
              >
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Cari Barang
                </h2>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedProduct('');
                    }}
                    placeholder="Ketik nama barang, misal: udang keju"
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2222] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                {!searchQuery.trim() ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Ketik nama barang atau ketuk salah satu barang di daftar peringkat untuk melihat riwayat selisihnya.
                  </p>
                ) : matchingProducts.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Barang tidak ditemukan pada bulan ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                    {matchingProducts.map((name) => {
                      const stat = summary.productMap[name];
                      const isPicked = effectiveSelectedProduct === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => handlePickProduct(name)}
                          className={`w-full flex items-center justify-between gap-3 py-2.5 px-2 text-left rounded-lg transition-colors cursor-pointer ${
                            isPicked
                              ? 'bg-teal-50 dark:bg-teal-950/40'
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
                            className={`text-sm font-mono font-semibold tabular-nums whitespace-nowrap shrink-0 ${
                              stat.negVal < 0
                                ? 'text-red-700 dark:text-red-300'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {stat.negVal < 0
                              ? `Kurang ${formatRupiah(stat.negVal)}`
                              : 'Tidak ada kurang'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedProductStat && (
                  <div
                    ref={productDetailRef}
                    className="rounded-lg bg-slate-50 dark:bg-[#1a2222] border border-slate-200 dark:border-slate-700 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {selectedProductStat.name}
                        </h3>
                        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                          Kurang{' '}
                          <strong className="text-red-700 dark:text-red-300">
                            {formatRupiah(selectedProductStat.negVal)}
                          </strong>
                          {' · '}
                          Lebih{' '}
                          <strong className="text-emerald-700 dark:text-emerald-300">
                            {formatRupiah(selectedProductStat.posVal)}
                          </strong>
                          {' · '}
                          Akhir{' '}
                          <strong
                            className={
                              selectedProductStat.netVal < -0.5
                                ? 'text-red-700 dark:text-red-300'
                                : selectedProductStat.netVal > 0.5
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : 'text-slate-900 dark:text-white'
                            }
                          >
                            {selectedProductStat.netVal < -0.5
                              ? 'Kurang '
                              : selectedProductStat.netVal > 0.5
                              ? 'Lebih '
                              : 'Pas '}
                            {formatRupiah(selectedProductStat.netVal)}
                          </strong>
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          Total selisih qty:{' '}
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                            {Object.entries(selectedProductStat.qtyByUnit)
                              .filter(([, val]) => Math.abs(val) > 1e-9)
                              .map(
                                ([unit, val]) =>
                                  `${formatSignedQty(val)} ${unit}`
                              )
                              .join(', ') || '0'}
                          </span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedProduct('')}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151c1c] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Tutup</span>
                      </button>
                    </div>

                    <div className="divide-y divide-slate-200 dark:divide-slate-700 border-t border-slate-200 dark:border-slate-700 pt-1">
                      {selectedProductTimeline.map(({ date, row }, idx) => (
                        <StockDetailRow
                          key={`${date}-${idx}`}
                          label={formatDateId(date)}
                          row={row}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Section 5: Rincian Per Tanggal */}
            <section
              id="harian"
              className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-3"
            >
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Rincian Per Tanggal
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Ketuk satu tanggal untuk melihat daftar barang yang memiliki selisih pada hari itu.
                </p>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
                {summary.dailyStats
                  .slice()
                  .reverse()
                  .map((day) => {
                    const isOpen = Boolean(openDays[day.date]);
                    const diffRows = isOpen
                      ? getConvertedRows(data[day.date])
                          .filter(
                            (r) => Math.abs(r[4]) > 1e-9 || Math.abs(r[6]) > 0.5
                          )
                          .sort((a, b) => a[6] - b[6])
                      : [];

                    return (
                      <div key={day.date} id={`day-${day.date}`} className="py-1">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenDays((prev) => ({
                              ...prev,
                              [day.date]: !prev[day.date],
                            }))
                          }
                          className="w-full py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {formatDateId(day.date)}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                              · {day.diffCount} selisih
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm font-mono tabular-nums pl-6 sm:pl-0">
                            <span className="text-red-700 dark:text-red-300 font-semibold">
                              Kurang {formatRupiah(day.negVal)}
                            </span>
                            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                              Lebih {formatRupiah(day.posVal)}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              Kumulatif kurang {formatRupiah(day.cumNegVal)}
                            </span>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="pl-6 pr-2 pb-3 divide-y divide-slate-100 dark:divide-slate-800">
                            {diffRows.length === 0 ? (
                              <p className="py-2 text-sm text-slate-500 dark:text-slate-400">
                                Semua barang pas pada tanggal ini.
                              </p>
                            ) : (
                              diffRows.map((row, idx) => (
                                <StockDetailRow
                                  key={`${day.date}-${row[0]}-${idx}`}
                                  label={row[0]}
                                  row={row}
                                />
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          </>
        )}

        {/* Data Settings */}
        <section className="bg-white dark:bg-[#151c1c] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Pengaturan Data
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Data tersimpan lokal di browser ini. Unduh cadangan secara berkala agar aman, atau ekspor HTML tunggal untuk GitHub Pages.
            </p>
          </div>

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

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={handleBackupJson}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2222] text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Cadangkan Data (.json)</span>
            </button>

            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2222] text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Pulihkan Cadangan</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadStandaloneHtml}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 hover:bg-teal-100/70 dark:hover:bg-teal-950/60 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh index.html (GitHub Pages)</span>
            </button>

            <button
              type="button"
              onClick={handleWipeData}
              className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors flex items-center gap-2 cursor-pointer ${
                wipeArmed
                  ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2222] text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>
                {wipeArmed
                  ? 'Yakin? Klik lagi untuk hapus semua'
                  : 'Hapus Semua Data'}
              </span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function StockDetailRow({ label, row }: { label: string; row: StockRow }) {
  const diffQty = row[4];
  const diffVal = row[6];
  const unit = row[1];
  const info = row[7];
  const state =
    diffQty < -1e-9 ? 'neg' : diffQty > 1e-9 ? 'pos' : 'eq';

  return (
    <div className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-slate-900 dark:text-white break-words">
          {label}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          Sistem {formatQty(row[2])} · Hitungan {formatQty(row[3])} {unit}
          {info ? ` · ${info}` : ''}
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0 font-mono tabular-nums text-xs sm:text-sm">
        <span
          className={`font-semibold ${
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
        </span>

        <span
          className={`min-w-[96px] text-right font-semibold ${
            state === 'neg'
              ? 'text-red-700 dark:text-red-300'
              : state === 'pos'
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {state !== 'eq' ? formatRupiah(diffVal) : '—'}
        </span>
      </div>
    </div>
  );
}
