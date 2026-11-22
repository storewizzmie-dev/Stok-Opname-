import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Loader2,
  Maximize2,
  MessageSquareText,
  Minimize2,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  PnlDataset,
  PnlMonthReport,
  cleanAiProse,
  formatPercentId,
  formatPnlPeriodRange,
  formatSignedRupiah,
  getPnlPeriodDays,
  getPnlPermanentNote,
} from '../lib/profitLoss';
import {
  StockDataset,
  SummaryResult,
  ViewScope,
  buildAiStockContext,
  formatDateId,
  formatDateRangeLabel,
  formatMonthId,
} from '../lib/stockOpname';

type MenuTab = 'beranda' | 'harian' | 'barang' | 'labarugi' | 'pengaturan';
type AiProviderOption = 'auto' | 'gemini' | 'groq';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  provider?: 'gemini' | 'groq';
  timestamp: number;
  isError?: boolean;
}

interface GlobalAiChatWidgetProps {
  activeTab: MenuTab;
  viewScope: ViewScope;
  activeMonth: string;
  activeDay: string;
  activeRange: { start: string; end: string };
  selectedProduct: string;
  summary: SummaryResult | null;
  data: StockDataset;
  pnlData: PnlDataset;
  selectedPnlMonth: string;
}

const CHAT_STORAGE_KEY = 'so_global_ai_chat_v1';
const CHAT_PROVIDER_KEY = 'so_global_ai_provider_v1';

const MENU_LABELS: Record<MenuTab, string> = {
  beranda: 'Menu Beranda',
  harian: 'Menu Harian',
  barang: 'Menu Cek Barang',
  labarugi: 'Menu Laba Rugi',
  pengaturan: 'Menu Pengaturan',
};

const APP_FEATURES_GUIDE = `=== PANDUAN FITUR & MENU WEB APP "PANTAU STOK OPNAME & LABA RUGI" ===
1. Fungsi Utama Aplikasi:
   - Aplikasi web ini digunakan untuk memantau laporan Stok Opname Harian (perbandingan catatan Sistem ESB dengan Hitungan Gudang) serta laporan keuangan Laba Rugi (Profit Loss Consolidation) dengan bahasa sederhana.
   - Semua data yang diupload tersimpan otomatis di browser perangkat pengguna.

2. Penjelasan 5 Menu Utama:
   - MENU BERANDA:
     * Menampilkan 3 kartu ringkasan utama: Barang Kurang (Minus), Barang Lebih (Plus), dan Hasil Gabungan (Selisih Bersih). Ketiga kartu ini bisa diklik untuk melihat pop-up rincian barang dan rincian per tanggal.
     * Menampilkan Grafik & Tren Harian, Ringkasan Per Bagian Produksi / Operasional (bisa difilter per bagian), Peringkat 10 Barang Kurang Terbesar & 10 Barang Lebih Terbesar.
     * Menampilkan Deteksi Kemungkinan Salah Hitung (Barang Bolak-Balik): yaitu barang yang di satu hari tercatat kurang (minus) namun di hari lain tercatat lebih (plus), yang biasanya menandakan salah hitung fisik atau telat input di Sistem ESB.
     * Menampilkan Kartu Ringkasan Menu Laba Rugi di bagian bawah Beranda.
   - MENU HARIAN:
     * Menampilkan catatan stok opname per tanggal secara lengkap.
     * Memiliki filter: Semua Barang, Ada Selisih, Kurang (Minus), Lebih (Plus), dan Pas (Sesuai 0), ditambah filter Keperluan (Purpose) serta pencarian nama/kode barang.
     * Setiap baris barang menampilkan angka Di Sistem ESB, Hitungan Gudang, Harga/unit, nilai selisih Rupiah, dan konversi satuan kemasan otomatis.
   - MENU CEK BARANG:
     * Digunakan untuk mencari dan membedah 1 barang spesifik secara mendalam di seluruh tanggal pada periode yang dipilih.
     * Menampilkan total kurang, total lebih, hasil bersih, jumlah hari kurang/lebih/pas, harga per unit, bagian/kategori, dan daftar riwayat harian barang tersebut dari tanggal ke tanggal.
   - MENU LABA RUGI:
     * Menampilkan laporan Profit Loss Consolidation dengan Net Sales sebagai acuan 100,00%.
     * Menampilkan kartu ringkasan Net Sales (100%), Total COGS (HPP), Gross Profit (Laba Kotor), Biaya Operasional (Opex), Operational Profit, dan Net Profit / Net Loss (Laba/Rugi Bersih).
     * Menampilkan tabel rincian setiap pos (Description) beserta nilai Rupiah dan porsi % terhadap Net Sales (Description ÷ Net Sales).
     * Jika salah satu baris pos diklik, muncul pop-up/panel "Analisa Sederhana (Dari Aplikasi)" serta tombol analisa AI (Gemini AI & Groq AI). Setelah jawaban AI muncul, pengguna bisa mengajukan pertanyaan lanjutan di kolom tanya AI dan bisa menekan tombol "Jadikan Note Penjelasan Permanen" agar penjelasan AI tersebut disimpan permanen di Analisa Sederhana.
   - MENU PENGATURAN:
     * Tempat satu-satunya untuk Upload File Excel (.xlsx / .xls), baik file Excel Stok Opname Harian maupun file Excel Profit Loss Consolidation (Laba Rugi). Aplikasi otomatis mengenali jenis file Excel yang diupload.
     * Menampilkan daftar Data Bulan yang Tersimpan serta tombol ganti Tema Tampilan (Tema Wizzmie Navy & Gold atau Tema Cerah).

3. Fitur Tombol "Rentang Tanggal" & "Cek 1 Hari" di Pojok Kanan Atas:
   - Di Menu Beranda, Menu Harian, dan Menu Cek Barang, tombol "Rentang Tanggal" dan "Cek 1 Hari" berada di pojok kanan atas kartu header agar hemat tempat.
   - Saat tombol "Rentang Tanggal" diklik, muncul Pop-up Pilih Rentang Tanggal yang berisi:
     * Kartu 1 ("1. Dari Tanggal Mulai") berwarna Emas / Amber.
     * Kartu 2 ("2. Sampai Tanggal Akhir") berwarna Biru Toska / Cyan agar mudah dibedakan saat menarik tanggal.
     * Klik 1x pada kartu (di HP maupun laptop): Mengaktifkan kartu tersebut tanpa membuka list tanggal.
     * Klik 2x pada kartu (di HP maupun laptop): Memunculkan List Tanggal berurutan (1 s/d 30/31) beserta keterangan hari dan status data Excel.
     * Kalender Tanggal 1 s/d 30/31 selalu tampil di bawah kedua kartu: pengguna bisa langsung menarik tanggal (drag dari tanggal mulai ke tanggal akhir) atau klik tanggal lalu tekan "Oke".
   - Saat tombol "Cek 1 Hari" diklik, pengguna bisa memilih 1 tanggal spesifik menggunakan tombol panah kiri/kanan atau dropdown tanggal di pojok kanan.

4. Fitur Tombol Chat AI di Kanan Bawah & Tombol Info (?):
   - Logo Chat AI di pojok kanan bawah ini bisa membaca seluruh data di semua menu (Stok Opname & Laba Rugi) sekaligus menjelaskan semua fitur aplikasi.
   - Tombol ikon tanda tanya (?) di setiap kartu membuka panduan singkat cara membaca angka bagi orang awam.`;

function buildAllPnlContext(
  pnlData: PnlDataset,
  selectedPnlMonth: string
): string {
  const months = Object.keys(pnlData).sort();
  if (months.length === 0) {
    return '=== DATA MENU LABA RUGI ===\nBelum ada file Excel Profit Loss Consolidation (Laba Rugi) yang diupload.';
  }

  const activeKey =
    selectedPnlMonth && pnlData[selectedPnlMonth]
      ? selectedPnlMonth
      : months[months.length - 1];
  const activeReport: PnlMonthReport = pnlData[activeKey];

  const lines: string[] = [
    '=== DATA MENU LABA RUGI (PROFIT & LOSS CONSOLIDATION) ===',
    `Jumlah Bulan Laba Rugi Tersimpan: ${months.length} bulan (${months
      .map(formatMonthId)
      .join(', ')})`,
  ];

  // Summary of all stored P&L months
  if (months.length > 1) {
    lines.push('\nRingkasan Semua Bulan Laba Rugi Tersimpan:');
    for (const m of months) {
      const rep = pnlData[m];
      const pct = (v: number) =>
        rep.netSales > 0 ? (v / rep.netSales) * 100 : 0;
      lines.push(
        `- ${formatMonthId(m)} (${formatPnlPeriodRange(rep)} | ${
          rep.branchName || 'Outlet'
        }): Net Sales ${formatSignedRupiah(
          rep.netSales
        )} (100%) | Total COGS ${formatSignedRupiah(
          rep.totalCogs
        )} (${formatPercentId(
          pct(rep.totalCogs)
        )}) | Gross Profit ${formatSignedRupiah(
          rep.grossProfit
        )} (${formatPercentId(
          pct(rep.grossProfit)
        )}) | Biaya Operasional ${formatSignedRupiah(
          rep.totalOpex
        )} (${formatPercentId(
          pct(rep.totalOpex)
        )}) | Net Profit/Loss ${formatSignedRupiah(
          rep.netProfit
        )} (${formatPercentId(pct(rep.netProfit))})`
      );
    }
  }

  // Detailed breakdown of the active P&L month
  const netPct = (v: number) =>
    activeReport.netSales > 0 ? (v / activeReport.netSales) * 100 : 0;
  const periodDays = getPnlPeriodDays(activeReport);

  lines.push(
    `\nDetail Laba Rugi Bulan Aktif: ${formatMonthId(
      activeReport.monthKey
    )} (Periode ${formatPnlPeriodRange(activeReport)}, ${periodDays} hari, Cabang: ${
      activeReport.branchName || 'Outlet'
    }):`,
    `- Total Sales (Penjualan Kotor): ${formatSignedRupiah(
      activeReport.totalSales
    )} (${formatPercentId(netPct(activeReport.totalSales))} dari Net Sales)`,
    `- Total Discount (Potongan/Diskon): ${formatSignedRupiah(
      activeReport.totalDiscount
    )} (${formatPercentId(netPct(activeReport.totalDiscount))} dari Net Sales)`,
    `- Net Sales (Penjualan Bersih - Acuan 100,00%): ${formatSignedRupiah(
      activeReport.netSales
    )}`,
    `- Total COGS (HPP / Biaya Bahan Baku): ${formatSignedRupiah(
      activeReport.totalCogs
    )} (${formatPercentId(netPct(activeReport.totalCogs))} dari Net Sales)`,
    `- Gross Profit (Laba Kotor): ${formatSignedRupiah(
      activeReport.grossProfit
    )} (${formatPercentId(netPct(activeReport.grossProfit))} dari Net Sales)`,
    `- Total Operational Expense (Biaya Operasional): ${formatSignedRupiah(
      activeReport.totalOpex
    )} (${formatPercentId(netPct(activeReport.totalOpex))} dari Net Sales)`,
    `- Operational Profit (Laba Operasional): ${formatSignedRupiah(
      activeReport.operationalProfit
    )} (${formatPercentId(
      netPct(activeReport.operationalProfit)
    )} dari Net Sales)`,
    `- Net Profit / Net Loss (Laba/Rugi Bersih Akhir): ${formatSignedRupiah(
      activeReport.netProfit
    )} (${formatPercentId(netPct(activeReport.netProfit))} dari Net Sales)`,
    '\nRincian Setiap Description di Menu Laba Rugi Bulan Aktif:'
  );

  for (const r of activeReport.rows) {
    const accLabel = r.account ? `[${r.account}] ` : '';
    const permanentNote = getPnlPermanentNote(
      activeReport.monthKey,
      r.description
    );
    const noteSuffix = permanentNote
      ? ` | Note Permanen: "${permanentNote.text}"`
      : '';
    lines.push(
      `- ${accLabel}${r.description} (${r.section.toUpperCase()}): ${formatSignedRupiah(
        r.value
      )} (${formatPercentId(r.percentToNetSales)} dari Net Sales)${noteSuffix}`
    );
  }

  return lines.join('\n');
}

export function GlobalAiChatWidget({
  activeTab,
  viewScope,
  activeMonth,
  activeDay,
  activeRange,
  selectedProduct,
  summary,
  data,
  pnlData,
  selectedPnlMonth,
}: GlobalAiChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [providerChoice, setProviderChoice] = useState<AiProviderOption>(() => {
    try {
      const saved = localStorage.getItem(CHAT_PROVIDER_KEY);
      if (saved === 'gemini' || saved === 'groq' || saved === 'auto') {
        return saved;
      }
    } catch {
      // Ignore storage error
    }
    return 'auto';
  });
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(-30);
      }
    } catch {
      // Ignore storage error
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      // Ignore storage error
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_PROVIDER_KEY, providerChoice);
    } catch {
      // Ignore storage error
    }
  }, [providerChoice]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 80);
    }
  }, [isOpen, messages.length, isLoading]);

  const stockMonthCount = useMemo(() => {
    const dates = Object.keys(data);
    return new Set(dates.map((d) => d.slice(0, 7))).size;
  }, [data]);

  const pnlMonthCount = useMemo(() => Object.keys(pnlData).length, [pnlData]);

  const buildOmniContext = (questionText?: string): string => {
    const isGroq = providerChoice === 'groq';
    const sections: string[] = [
      APP_FEATURES_GUIDE,
      '',
      '=== POSISI & STATUS PENGGUNA SAAT INI ===',
      `- Menu yang sedang dibuka pengguna: ${MENU_LABELS[activeTab]}`,
      `- Mode Tanggal Stok Opname: ${
        viewScope === 'day'
          ? `Cek 1 Hari (${activeDay ? formatDateId(activeDay) : '-'})`
          : `Rentang Tanggal (${
              activeRange.start
                ? formatDateRangeLabel(activeRange.start, activeRange.end)
                : '-'
            })`
      }`,
      ...(selectedProduct
        ? [`- Barang yang sedang dipilih di Menu Cek Barang: ${selectedProduct}`]
        : []),
      `- Data Stok Opname Tersimpan: ${stockMonthCount} bulan (${
        Object.keys(data).length
      } tanggal)`,
      `- Data Laba Rugi Tersimpan: ${pnlMonthCount} bulan`,
      '',
    ];

    if (summary && activeMonth) {
      sections.push(
        '=== DATA MENU BERANDA, HARIAN & CEK BARANG (STOK OPNAME) ===',
        buildAiStockContext(summary, activeMonth, data, {
          question: questionText,
          currentMenu: MENU_LABELS[activeTab],
          compact: isGroq,
        }),
        ''
      );
    } else {
      sections.push(
        '=== DATA MENU BERANDA, HARIAN & CEK BARANG (STOK OPNAME) ===',
        'Belum ada file Excel Stok Opname yang diupload. Pengguna dapat mengupload file Excel Stok Opname di Menu Pengaturan.',
        ''
      );
    }

    sections.push(buildAllPnlContext(pnlData, selectedPnlMonth));

    return sections.join('\n');
  };

  const sendQuestion = async (rawQuestion: string) => {
    const trimmed = rawQuestion.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };

    const historyForApi = messages
      .filter((m) => !m.isError)
      .slice(-8)
      .map((m) => ({
        role: m.role,
        text: m.text,
      }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const contextText = buildOmniContext(trimmed);
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          provider: providerChoice,
          contextText,
          question: trimmed,
          history: historyForApi,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          `Server AI belum merespons JSON (HTTP ${res.status}). Pastikan endpoint /api/ai aktif.`
        );
      }

      const payload = (await res.json()) as {
        reply?: string;
        error?: string;
        provider?: 'gemini' | 'groq';
      };

      if (!res.ok || payload.error) {
        throw new Error(
          payload.error || 'Gagal menghubungi Asisten AI. Silakan coba lagi.'
        );
      }

      const replyText = cleanAiProse(payload.reply ?? '');
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text:
          replyText ||
          'Maaf, AI tidak mengembalikan jawaban. Silakan ulangi pertanyaan Anda.',
        provider: payload.provider,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat menghubungi AI.';
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: errMsg,
          timestamp: Date.now(),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1800);
    });
  };

  return (
    <>
      {/* FLOATING CHAT LAUNCHER LOGO (KANAN BAWAH) */}
      <div className="fixed right-4 sm:right-6 bottom-20 md:bottom-6 z-40 flex flex-col items-end">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Buka Chat Asisten AI"
          className="group relative flex items-center gap-2.5 pl-3.5 pr-4 py-3 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 text-slate-950 font-extrabold shadow-[0_10px_28px_-6px_rgba(245,158,11,0.65),0_4px_0_0_#b45309] hover:brightness-105 active:translate-y-0.5 transition-all cursor-pointer border-2 border-amber-200/90"
        >
          {/* Pulse Online Dot */}
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-950" />
          </span>

          <div className="w-8 h-8 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center shadow-inner shrink-0">
            {isOpen ? (
              <X className="w-4 h-4 stroke-[2.5]" />
            ) : (
              <MessageSquareText className="w-4 h-4 stroke-[2.2]" />
            )}
          </div>

          <div className="text-left leading-tight">
            <div className="flex items-center gap-1 text-xs sm:text-sm font-black tracking-tight text-slate-950">
              <span>Tanya AI</span>
              <Sparkles className="w-3.5 h-3.5 text-slate-900 shrink-0" />
            </div>
            <div className="text-[10px] font-bold text-slate-900/80 hidden sm:block">
              Semua Menu &amp; Fitur
            </div>
          </div>
        </button>
      </div>

      {/* PREMIUM AI CHAT POP-UP WINDOW */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Asisten AI Wizzmie"
          className={`fixed z-50 transition-all duration-200 flex flex-col bg-white dark:bg-[#081226] border-2 border-slate-200/90 dark:border-[#243E6C] rounded-3xl shadow-[0_24px_60px_-15px_rgba(2,6,23,0.75)] overflow-hidden ${
            isExpanded
              ? 'inset-3 sm:inset-auto sm:right-6 sm:bottom-24 md:bottom-24 sm:w-[680px] sm:h-[78vh] max-h-[840px]'
              : 'inset-x-3 bottom-20 top-14 sm:inset-auto sm:right-6 sm:bottom-24 md:bottom-24 sm:w-[430px] sm:h-[620px] max-h-[82vh]'
          }`}
        >
          {/* Premium Pop-up Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-[#09152B] via-[#0F2142] to-[#132952] text-white border-b border-[#223B68] shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shadow-md shrink-0">
                  <Bot className="w-5 h-5 stroke-[2.2]" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#09152B]" />
                </div>
                <h3 className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                  Asisten AI Pintar
                </h3>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Pilihan Engine AI: Otomatis / Gemini / Groq */}
                <div className="inline-flex items-center rounded-lg bg-[#060E1D] p-0.5 border border-white/10 shrink-0">
                  {(
                    [
                      { id: 'auto', label: 'Auto' },
                      { id: 'gemini', label: 'Gemini' },
                      { id: 'groq', label: 'Groq' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setProviderChoice(opt.id)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-colors cursor-pointer ${
                        providerChoice === opt.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  title={isExpanded ? 'Perkecil Jendela' : 'Perbesar Jendela'}
                  className="hidden sm:flex p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {isExpanded ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessages([])}
                    title="Bersihkan Riwayat Chat"
                    className="p-1.5 rounded-xl text-slate-300 hover:text-rose-300 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Tutup Chat AI"
                  className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Chat Messages Scroll Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/70 dark:bg-[#071022]">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3.5 py-3 text-xs sm:text-sm leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-semibold rounded-br-xs'
                        : msg.isError
                        ? 'bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 rounded-bl-xs'
                        : 'bg-white dark:bg-[#0D1A32] border border-slate-200/90 dark:border-[#1E355D] text-slate-800 dark:text-slate-100 rounded-bl-xs'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center justify-between gap-2 mb-1.5 pb-1.5 border-b border-slate-100 dark:border-[#1C325A]">
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          <Bot className="w-3.5 h-3.5" />
                          <span>
                            Asisten AI{' '}
                            {msg.provider
                              ? `(${msg.provider === 'groq' ? 'Groq' : 'Gemini'})`
                              : ''}
                          </span>
                        </span>
                        {!msg.isError && (
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500">Tersalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Salin</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5 whitespace-pre-wrap break-words">
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start">
                <div className="rounded-2xl rounded-bl-xs px-4 py-3 bg-white dark:bg-[#0D1A32] border border-slate-200/90 dark:border-[#1E355D] text-xs sm:text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2.5 shadow-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
                  <span>
                    Asisten AI sedang memeriksa data semua menu...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="p-3 bg-white dark:bg-[#081226] border-t border-slate-200 dark:border-[#1E355D] shrink-0"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendQuestion(input);
                  }
                }}
                placeholder="Tanya apa saja: data stok, barang, laba rugi, atau fungsi fitur web ini..."
                disabled={isLoading}
                className="flex-1 resize-none rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm bg-slate-100 dark:bg-[#0D1A32] border border-slate-200 dark:border-[#213A67] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                aria-label="Kirim pertanyaan ke AI"
                className="btn-3d-primary h-11 px-4 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 disabled:opacity-45 shrink-0 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Kirim</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
