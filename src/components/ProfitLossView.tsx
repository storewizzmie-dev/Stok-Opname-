// @ts-nocheck -- imported legacy code written for a looser tsconfig
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookmarkCheck,
  Calculator,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Info,
  Lightbulb,
  MessageSquare,
  Percent,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { InfoButton, InfoGuideKey } from './InfoGuide';
import {
  AiTypewriterText,
  GsapWordTitle,
  MotionCard,
  MotionCardButton,
  MotionSection,
} from './AnimationPrimitives';
import {
  PnlAiProviderChoice,
  PnlDataset,
  PnlFollowUpTurn,
  PnlMonthReport,
  PnlPermanentNote,
  PnlRow,
  PnlSection,
  askPnlFollowUpQuestion,
  cleanAiProse,
  describePnlRow,
  fetchPnlRowAnalysis,
  formatPercentId,
  formatPnlPeriodRange,
  formatSignedRupiah,
  getCachedPnlAnalysis,
  getPnlPermanentNote,
  getPnlRowCacheKey,
  removePnlPermanentNote,
  savePnlPermanentNote,
} from '../lib/profitLoss';
import { formatMonthId, formatRupiah } from '../lib/stockOpname';

type SectionFilter = 'all' | PnlSection;

const SECTION_LABELS: Record<PnlSection, string> = {
  revenue: 'Pendapatan & Potongan (Sales)',
  cogs: 'HPP / Bahan Baku (COGS)',
  opex: 'Biaya Operasional',
  other: 'Pendapatan/Biaya Lain & Laba Bersih',
};

export function ProfitLossView({
  pnlData,
  activeMonth,
  onSelectMonth,
  onDeleteMonth,
  onOpenInfo,
}: {
  pnlData: PnlDataset;
  activeMonth: string;
  onSelectMonth: (reportId: string) => void;
  onDeleteMonth: (reportId: string) => void;
  onOpenInfo: (key: InfoGuideKey) => void;
}) {
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const [selectedKpiDesc, setSelectedKpiDesc] = useState<string | null>(null);
  const [deleteArmedMonth, setDeleteArmedMonth] = useState<string | null>(null);
  const [notesVersion, setNotesVersion] = useState<number>(0);

  const allReportKeys = useMemo(
    () =>
      Object.keys(pnlData).sort((a, b) => {
        const ra = pnlData[a];
        const rb = pnlData[b];
        if (!ra || !rb) return a.localeCompare(b);
        if (ra.periodStart !== rb.periodStart) {
          return ra.periodStart.localeCompare(rb.periodStart);
        }
        return ra.periodEnd.localeCompare(rb.periodEnd);
      }),
    [pnlData]
  );

  const resolvedKey = useMemo(() => {
    if (!allReportKeys.length) return '';
    if (allReportKeys.includes(activeMonth)) return activeMonth;
    const byMonth = allReportKeys.filter(
      (k) => pnlData[k]?.monthKey === activeMonth
    );
    if (byMonth.length > 0) return byMonth[byMonth.length - 1];
    return allReportKeys[allReportKeys.length - 1];
  }, [allReportKeys, activeMonth, pnlData]);

  const report = resolvedKey ? pnlData[resolvedKey] : null;

  const prevReport = useMemo(() => {
    if (!resolvedKey) return null;
    const idx = allReportKeys.indexOf(resolvedKey);
    if (idx <= 0) return null;
    return pnlData[allReportKeys[idx - 1]] ?? null;
  }, [allReportKeys, pnlData, resolvedKey]);

  const prevRowMap = useMemo(() => {
    const map = new Map<string, PnlRow>();
    if (!prevReport) return map;
    for (const r of prevReport.rows) {
      map.set(r.description.trim().toLowerCase(), r);
    }
    return map;
  }, [prevReport]);

  const filteredRows = useMemo(() => {
    if (!report) return [];
    const q = searchQuery.trim().toLowerCase();
    return report.rows.filter((row) => {
      if (sectionFilter !== 'all' && row.section !== sectionFilter) {
        return false;
      }
      if (hideZero && Math.abs(row.value) < 0.01 && row.kind === 'item') {
        return false;
      }
      if (!q) return true;
      return (
        row.description.toLowerCase().includes(q) ||
        row.account.toLowerCase().includes(q)
      );
    });
  }, [report, sectionFilter, hideZero, searchQuery]);

  if (!report) {
    return (
      <MotionSection className="surface-3d rounded-3xl p-6 sm:p-8 lg:p-10 space-y-6">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold">
            <Percent className="w-4 h-4" />
            <span>Profit Loss Consolidation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white text-balance">
            <GsapWordTitle text="Pantau Persentase Laba Rugi (Description ÷ Net Sales)" />
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Upload file Excel <strong>Profit Loss Consolidation Report</strong>{' '}
            dari sistem ESB melalui menu <strong>Pengaturan</strong> lalu tentukan periode tanggalnya. Aplikasi langsung menghitung persentase setiap pos{' '}
            <strong>Description dibagi Net Sales</strong> secara otomatis.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
          <MotionCard delay={0.03} className="rounded-2xl p-4 bg-slate-50 dark:bg-[#1D1712] border border-slate-200 dark:border-[#352E28] space-y-1">
            <div className="font-bold text-slate-900 dark:text-white">
              1. Pilih Tanggal &amp; Bulan Manual
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
              Setiap file yang diupload ditentukan tanggal/periodenya lewat pop-up (misal 1–16 Nov &amp; 18 Nov) sehingga tidak saling menimpa.
            </p>
          </MotionCard>
          <MotionCard delay={0.07} className="rounded-2xl p-4 bg-slate-50 dark:bg-[#1D1712] border border-slate-200 dark:border-[#352E28] space-y-1">
            <div className="font-bold text-slate-900 dark:text-white">
              2. Periode Tersimpan Rapi
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
              Semua periode yang diupload tersimpan sendiri-sendiri dan otomatis muncul pada Grafik Keuntungan di Beranda.
            </p>
          </MotionCard>
          <MotionCard delay={0.11} className="rounded-2xl p-4 bg-slate-50 dark:bg-[#1D1712] border border-slate-200 dark:border-[#352E28] space-y-1">
            <div className="font-bold text-slate-900 dark:text-white">
              3. Rumus Otomatis (%)
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
              Setiap baris Description langsung dibagi <strong>Net Sales</strong>{' '}
              untuk melihat porsi biaya dan laba.
            </p>
          </MotionCard>
        </div>

        <div className="flex flex-wrap gap-3">
          <InfoButton
            guideKey="profitLoss"
            onOpen={onOpenInfo}
            label="Cara Kerja Laba Rugi"
          />
        </div>
      </MotionSection>
    );
  }

  const pct = (val: number) =>
    report.netSales !== 0 ? (val / report.netSales) * 100 : 0;

  const isNetLoss = report.netProfit < -0.5;

  const findKpiRow = (target: string, startsWith = false): PnlRow | null => {
    const key = target.trim().toLowerCase();
    const match = report.rows.find((r) => {
      const d = r.description.trim().toLowerCase();
      return startsWith ? d.startsWith(key) : d === key;
    });
    if (match) return match;
    if (key === 'net sales') {
      return {
        account: '',
        description: 'Net Sales',
        value: report.netSales,
        percentToNetSales: 100,
        section: 'revenue',
        kind: 'anchor',
      };
    }
    if (key === 'total cost of goods sold') {
      return {
        account: '',
        description: 'Total Cost of Goods Sold',
        value: report.totalCogs,
        percentToNetSales: pct(report.totalCogs),
        section: 'cogs',
        kind: 'summary',
      };
    }
    if (key === 'gross profit') {
      return {
        account: '',
        description: 'Gross Profit',
        value: report.grossProfit,
        percentToNetSales: pct(report.grossProfit),
        section: 'cogs',
        kind: 'summary',
      };
    }
    if (key === 'total operational expense') {
      return {
        account: '',
        description: 'Total Operational Expense',
        value: report.totalOpex,
        percentToNetSales: pct(report.totalOpex),
        section: 'opex',
        kind: 'summary',
      };
    }
    if (key === 'net profit') {
      return {
        account: '',
        description: 'Net Profit/(Net Loss)',
        value: report.netProfit,
        percentToNetSales: pct(report.netProfit),
        section: 'other',
        kind: 'summary',
      };
    }
    return null;
  };

  const selectedKpiRow = useMemo(() => {
    if (!selectedKpiDesc) return null;
    return findKpiRow(selectedKpiDesc, selectedKpiDesc === 'net profit');
  }, [selectedKpiDesc, report]);

  const toggleKpiSelection = (key: string) => {
    setSelectedKpiDesc((prev) => (prev === key ? null : key));
  };

  return (
    <div className="space-y-5 v2-pnl">
      {/* V2 Hero */}
      <section className="v2-hero">
        <div className="v2-hero-glow" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="v2-eyebrow">
              Laba Bersih · {formatPnlPeriodRange(report)}
              <InfoButton guideKey="profitLoss" onOpen={onOpenInfo} />
            </div>
            <div className={`v2-hero-num ${isNetLoss ? 'v2-t-neg' : 'v2-t-pos'}`}>
              {formatSignedRupiah(report.netProfit)}
            </div>
            <p className="v2-hero-sub">
              Margin {pct(report.netProfit)} dari Net Sales {formatRupiah(report.netSales)}
              {report.branchName ? ` · ${report.branchName}` : ''}
            </p>
          </div>
          <div className="v2-share w-full lg:max-w-md">
            {(() => {
              const ns = Math.max(1, Math.abs(report.netSales));
              const parts = [
                { k: 'HPP', v: Math.abs(report.totalCogs), c: 'v2-share-cogs' },
                { k: 'Biaya Operasional', v: Math.abs(report.totalOpex), c: 'v2-share-opex' },
                { k: 'Laba', v: Math.max(0, report.netProfit), c: 'v2-share-profit' },
              ];
              return (
                <>
                  <div className="v2-share-bar">
                    {parts.map((pp) => (
                      <i key={pp.k} className={pp.c} style={{ width: `${Math.min(100, (pp.v / ns) * 100)}%` }} />
                    ))}
                  </div>
                  <div className="v2-share-legend">
                    {parts.map((pp) => (
                      <span key={pp.k}><i className={pp.c} />{pp.k} <b>{((pp.v / ns) * 100).toFixed(1)}%</b></span>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </section>

      {/* Period / Report Switcher */}
      <section className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap gap-2">
          {allReportKeys.map((repKey) => {
            const isActive = repKey === resolvedKey;
            const r = pnlData[repKey];
            if (!r) return null;
            return (
              <button
                key={repKey}
                type="button"
                onClick={() => {
                  onSelectMonth(repKey);
                  setExpandedRowKey(null);
                  setSelectedKpiDesc(null);
                  setDeleteArmedMonth(null);
                }}
                className={`v2-chip ${isActive ? 'is-on' : ''}`}
              >
                {formatPnlPeriodRange(r)}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            if (deleteArmedMonth === resolvedKey) {
              setDeleteArmedMonth(null);
              onDeleteMonth(resolvedKey);
            } else {
              setDeleteArmedMonth(resolvedKey);
            }
          }}
          className={`px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 min-h-[38px] cursor-pointer ${
            deleteArmedMonth === resolvedKey
              ? 'bg-rose-600 text-white border border-rose-700'
              : 'btn-3d-soft text-rose-600 dark:text-rose-400'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>
            {deleteArmedMonth === resolvedKey
              ? 'Yakin? Ketuk Lagi'
              : `Hapus Periode (${formatPnlPeriodRange(report)})`}
          </span>
        </button>
      </section>

      {/* 5 Main Summary KPI Cards (Klik untuk Rincian & Analisa) */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Net Sales */}
        <MotionCardButton
          delay={0}
          onClick={() => toggleKpiSelection('net sales')}
          className={`col-span-2 lg:col-span-1 rounded-2xl p-4 bg-white dark:bg-[#1D1712] border shadow-sm flex flex-col justify-between text-left transition-all cursor-pointer hover:border-amber-400 dark:hover:border-amber-400/70 ${
            selectedKpiDesc === 'net sales'
              ? 'border-amber-400 ring-2 ring-amber-400/60'
              : 'border-amber-300/70 dark:border-amber-500/35'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Net Sales (Acuan)
              </span>
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white mt-1 tabular-nums break-words leading-snug">
              {formatRupiah(report.netSales)}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#322B26] flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              {selectedKpiDesc === 'net sales' ? 'Rincian dibuka' : 'Ketuk · Rincian'}
            </span>
            <span className="font-mono font-extrabold text-amber-700 dark:text-amber-300">
              100,00%
            </span>
          </div>
        </MotionCardButton>

        {/* Total COGS */}
        <MotionCardButton
          delay={0.04}
          onClick={() => toggleKpiSelection('total cost of goods sold')}
          className={`rounded-2xl p-4 bg-white dark:bg-[#1D1712] border shadow-sm flex flex-col justify-between text-left transition-all cursor-pointer hover:border-amber-400 dark:hover:border-amber-400/70 ${
            selectedKpiDesc === 'total cost of goods sold'
              ? 'border-amber-400 ring-2 ring-amber-400/60'
              : 'border-slate-200 dark:border-[#352E28]'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total COGS (HPP)
              </span>
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            </div>
            <div className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white mt-1 tabular-nums break-words leading-snug">
              {formatSignedRupiah(report.totalCogs)}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#322B26] flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              {selectedKpiDesc === 'total cost of goods sold' ? 'Rincian dibuka' : '÷ Net Sales'}
            </span>
            <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400">
              {formatPercentId(pct(report.totalCogs))}
            </span>
          </div>
        </MotionCardButton>

        {/* Gross Profit */}
        <MotionCardButton
          delay={0.08}
          onClick={() => toggleKpiSelection('gross profit')}
          className={`rounded-2xl p-4 bg-white dark:bg-[#1D1712] border shadow-sm flex flex-col justify-between text-left transition-all cursor-pointer hover:border-amber-400 dark:hover:border-amber-400/70 ${
            selectedKpiDesc === 'gross profit'
              ? 'border-amber-400 ring-2 ring-amber-400/60'
              : 'border-slate-200 dark:border-[#352E28]'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Gross Profit
              </span>
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            </div>
            <div className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white mt-1 tabular-nums break-words leading-snug">
              {formatSignedRupiah(report.grossProfit)}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#322B26] flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              {selectedKpiDesc === 'gross profit' ? 'Rincian dibuka' : '÷ Net Sales'}
            </span>
            <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatPercentId(pct(report.grossProfit))}
            </span>
          </div>
        </MotionCardButton>

        {/* Operational Expense */}
        <MotionCardButton
          delay={0.12}
          onClick={() => toggleKpiSelection('total operational expense')}
          className={`rounded-2xl p-4 bg-white dark:bg-[#1D1712] border shadow-sm flex flex-col justify-between text-left transition-all cursor-pointer hover:border-amber-400 dark:hover:border-amber-400/70 ${
            selectedKpiDesc === 'total operational expense'
              ? 'border-amber-400 ring-2 ring-amber-400/60'
              : 'border-slate-200 dark:border-[#352E28]'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Biaya Operasional
              </span>
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            </div>
            <div className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white mt-1 tabular-nums break-words leading-snug">
              {formatSignedRupiah(report.totalOpex)}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#322B26] flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              {selectedKpiDesc === 'total operational expense' ? 'Rincian dibuka' : '÷ Net Sales'}
            </span>
            <span className="font-mono font-extrabold text-amber-600 dark:text-amber-300">
              {formatPercentId(pct(report.totalOpex))}
            </span>
          </div>
        </MotionCardButton>

        {/* Net Profit */}
        <MotionCardButton
          delay={0.16}
          onClick={() => toggleKpiSelection('net profit')}
          className={`rounded-2xl p-4 border shadow-sm flex flex-col justify-between text-left transition-all cursor-pointer hover:brightness-105 ${
            isNetLoss
              ? 'wizzmie-loss-banner text-rose-950 dark:text-rose-100'
              : 'wizzmie-gold-card text-amber-950 dark:text-amber-100'
          } ${
            selectedKpiDesc === 'net profit' ? 'ring-2 ring-amber-400' : ''
          }`}
        >
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide opacity-85 flex items-center justify-between gap-1">
              <span className="flex items-center gap-1">
                {isNetLoss ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <TrendingUp className="w-3.5 h-3.5" />
                )}
                <span>Net Profit / Loss</span>
              </span>
              <Info className="w-3.5 h-3.5 shrink-0" />
            </div>
            <div className="text-sm sm:text-base font-black font-mono mt-1 tabular-nums break-words leading-snug">
              {formatSignedRupiah(report.netProfit)}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/15 flex items-center justify-between text-xs">
            <span className="opacity-80">
              {selectedKpiDesc === 'net profit' ? 'Rincian dibuka' : '÷ Net Sales'}
            </span>
            <span className="font-mono font-black">
              {formatPercentId(pct(report.netProfit))}
            </span>
          </div>
        </MotionCardButton>
      </section>

      {/* Detail & Simple App Analysis Panel when a top KPI card is clicked */}
      {selectedKpiRow && (() => {
        const kpiInfo = describePnlRow(selectedKpiRow, report, prevReport);
        const noteScopeKey = report.id || report.monthKey;
        const kpiNote = getPnlPermanentNote(
          noteScopeKey,
          selectedKpiRow.description
        );
        void notesVersion;
        return (
          <section className="rounded-2xl bg-slate-50 dark:bg-[#130E0B] border border-amber-300/80 dark:border-amber-500/40 p-4 sm:p-5 space-y-3 shadow-sm text-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  Detail Pos Terpilih
                </div>
                <div className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white break-words leading-snug">
                  {selectedKpiRow.description} · {formatSignedRupiah(selectedKpiRow.value)} (
                  {formatPercentId(selectedKpiRow.percentToNetSales)})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKpiDesc(null)}
                aria-label="Tutup rincian kartu"
                className="btn-3d-soft p-2 rounded-xl text-slate-500 dark:text-slate-300 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <SimpleAnalysisCard
              defaultText={kpiInfo.simpleAnalysis}
              permanentNote={kpiNote}
              onResetPermanentNote={() => {
                removePnlPermanentNote(
                  noteScopeKey,
                  selectedKpiRow.description
                );
                setNotesVersion((v) => v + 1);
              }}
            />

            <PnlAiAnalysisPanel
              key={getPnlRowCacheKey(selectedKpiRow, report, prevReport)}
              row={selectedKpiRow}
              report={report}
              prevReport={prevReport}
              permanentNote={kpiNote}
              onSavePermanentNote={(text, provider) => {
                savePnlPermanentNote({
                  monthKey: noteScopeKey,
                  description: selectedKpiRow.description,
                  text,
                  provider,
                });
                setNotesVersion((v) => v + 1);
              }}
            />
          </section>
        );
      })()}

      {/* Formula Info Banner */}
      <MotionCard className="rounded-xl bg-white dark:bg-[#1D1712] border border-slate-200 dark:border-[#312A25] px-4 py-3 flex items-start sm:items-center gap-3 text-xs text-slate-700 dark:text-blue-200">
        <Calculator className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
        <div className="leading-relaxed">
          <strong>Rumus Otomatis:</strong> Setiap baris{' '}
          <strong>Description ÷ Net Sales ({formatRupiah(report.netSales)})</strong>{' '}
          × 100%. Ketuk baris mana saja di bawah untuk melihat rincian hitungan
          angka persisnya.
          {prevReport && (
            <span className="text-amber-700 dark:text-amber-300 font-semibold">
              {' '}
              · Menampilkan pembanding vs {formatPnlPeriodRange(prevReport)}.
            </span>
          )}
        </div>
      </MotionCard>

      {/* Filter & Search Bar */}
      <MotionSection delay={0.04} className="wizzmie-glass-card rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', 'Semua Pos'],
                ['revenue', 'Pendapatan'],
                ['cogs', 'COGS / Bahan'],
                ['opex', 'Operasional'],
                ['other', 'Lain-lain & Laba'],
              ] as [SectionFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSectionFilter(key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer min-h-[36px] ${
                  sectionFilter === key
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-xs'
                    : 'bg-slate-100 dark:bg-[#130E0B] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#352E28]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari description atau kode..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-[#37302A] bg-slate-50 dark:bg-[#130E0B] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[38px]"
              />
            </div>

            <button
              type="button"
              onClick={() => setHideZero((prev) => !prev)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border min-h-[38px] whitespace-nowrap cursor-pointer ${
                hideZero
                  ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300'
                  : 'bg-slate-50 dark:bg-[#130E0B] border-slate-200 dark:border-[#37302A] text-slate-600 dark:text-slate-300'
              }`}
            >
              {hideZero ? 'Rp 0 Disembunyikan' : 'Tampilkan Semua (Termasuk Rp 0)'}
            </button>
          </div>
        </div>

        {/* Rows List */}
        {filteredRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Tidak ada baris Description yang cocok dengan filter Anda.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRows.map((row, idx) => {
              const rowKey = `${row.account}-${row.description}-${idx}`;
              const isExpanded = expandedRowKey === rowKey;
              const isSummary = row.kind === 'summary';
              const isAnchor = row.kind === 'anchor';
              const barWidth = Math.min(
                100,
                Math.max(0, Math.abs(row.percentToNetSales))
              );
              const prevRow = prevRowMap.get(
                row.description.trim().toLowerCase()
              );
              const deltaPct =
                prevRow !== undefined
                  ? row.percentToNetSales - prevRow.percentToNetSales
                  : null;
              const info = isExpanded
                ? describePnlRow(row, report, prevReport)
                : null;
              const noteScopeKey = report.id || report.monthKey;
              const rowPermanentNote =
                (void notesVersion,
                getPnlPermanentNote(noteScopeKey, row.description));

              return (
                <div
                  key={rowKey}
                  className={`rounded-xl border transition-colors overflow-hidden ${
                    isAnchor
                      ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40'
                      : isSummary
                      ? 'bg-slate-100/90 dark:bg-[#26201A] border-slate-300/80 dark:border-[#423B35]'
                      : 'bg-white dark:bg-[#17120E] border-slate-200/80 dark:border-[#312A25]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedRowKey(isExpanded ? null : rowKey)
                    }
                    className="w-full px-3.5 py-3 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {(isAnchor || isSummary) && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${
                              isAnchor
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                            }`}
                          >
                            {isAnchor ? 'ACUAN 100%' : 'SUBTOTAL / LABA'}
                          </span>
                        )}
                        <span
                          className={`text-xs sm:text-sm truncate ${
                            isAnchor || isSummary
                              ? 'font-extrabold text-slate-900 dark:text-white'
                              : 'font-semibold text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {row.description}
                        </span>
                        {rowPermanentNote && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                            <BookmarkCheck className="w-3 h-3 shrink-0" />
                            <span>Note Tersimpan</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-xs h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isAnchor
                                ? 'bg-amber-400'
                                : row.value < 0
                                ? 'bg-rose-500'
                                : row.section === 'cogs' || row.section === 'opex'
                                ? 'bg-blue-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 hidden sm:inline">
                          {SECTION_LABELS[row.section]}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 tabular-nums">
                      <div className="sm:text-right">
                        <div
                          className={`text-xs sm:text-sm font-mono ${
                            isAnchor || isSummary ? 'font-extrabold' : 'font-bold'
                          } ${
                            row.value < -0.5
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {formatSignedRupiah(row.value)}
                        </div>
                        {deltaPct !== null && Math.abs(deltaPct) >= 0.01 && (
                          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            vs periode lalu:{' '}
                            <span
                              className={
                                deltaPct > 0
                                  ? 'text-amber-600 dark:text-amber-300 font-bold'
                                  : 'text-emerald-600 dark:text-emerald-400 font-bold'
                              }
                            >
                              {deltaPct > 0 ? '+' : ''}
                              {formatPercentId(deltaPct)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs sm:text-sm font-mono font-black min-w-[76px] text-right ${
                            isAnchor
                              ? 'bg-amber-400 text-slate-950'
                              : row.percentToNetSales < -0.01
                              ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                              : 'bg-slate-100 dark:bg-[#2A231E] text-slate-900 dark:text-amber-300'
                          }`}
                        >
                          {formatPercentId(row.percentToNetSales)}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </button>

                  {isExpanded && info && (
                    <div className="px-4 py-4 border-t border-slate-200/80 dark:border-[#352E28] bg-slate-50 dark:bg-[#130E0B] text-xs space-y-3">
                      {/* 1. Analisa Sederhana Bawaan Aplikasi / Note Permanen */}
                      <SimpleAnalysisCard
                        defaultText={info.simpleAnalysis}
                        permanentNote={rowPermanentNote}
                        onResetPermanentNote={() => {
                          removePnlPermanentNote(
                            noteScopeKey,
                            row.description
                          );
                          setNotesVersion((v) => v + 1);
                        }}
                      />

                      {/* 2. Arti Pos Ini */}
                      <div className="rounded-xl bg-white dark:bg-[#1D1712] border border-slate-200 dark:border-[#352E28] p-3 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>Apa Arti Pos Ini?</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                          {info.meaning}
                        </p>
                      </div>

                      {/* 2. Rumus Persentase */}
                      <div className="rounded-xl bg-white dark:bg-[#1D1712] border border-slate-200 dark:border-[#352E28] p-3 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                          <Calculator className="w-3.5 h-3.5 shrink-0" />
                          <span>Rumus Persentase (÷ Net Sales)</span>
                        </div>
                        <div className="font-mono text-[11px] sm:text-xs bg-slate-50 dark:bg-[#130E0B] border border-slate-200/80 dark:border-[#312A25] rounded-lg px-2.5 py-2 text-slate-800 dark:text-slate-100 tabular-nums">
                          {info.formulaEquation}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                          {info.perScaleText}
                        </p>
                      </div>

                      {/* 3. Perbandingan Periode Sebelumnya (jika ada) */}
                      {prevReport && prevRow && (
                        <div className="rounded-xl bg-white dark:bg-[#1D1712] border border-slate-200 dark:border-[#352E28] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 tabular-nums">
                          <div className="text-slate-600 dark:text-slate-300">
                            <strong className="text-slate-900 dark:text-white">
                              Bandingkan vs {formatPnlPeriodRange(prevReport)}:
                            </strong>{' '}
                            Periode lalu{' '}
                            <span className="font-mono font-semibold">
                              {formatSignedRupiah(prevRow.value)} (
                              {formatPercentId(prevRow.percentToNetSales)})
                            </span>{' '}
                            → Periode ini{' '}
                            <span className="font-mono font-semibold">
                              {formatSignedRupiah(row.value)} (
                              {formatPercentId(row.percentToNetSales)})
                            </span>
                          </div>
                          <div className="font-mono font-bold text-amber-700 dark:text-amber-300 shrink-0">
                            Selisih:{' '}
                            {row.value - prevRow.value >= 0 ? '+' : ''}
                            {formatSignedRupiah(row.value - prevRow.value)} (
                            {deltaPct !== null && deltaPct >= 0 ? '+' : ''}
                            {deltaPct !== null ? formatPercentId(deltaPct) : '0,00%'})
                          </div>
                        </div>
                      )}

                      {/* 4. Saran Praktis */}
                      <div className="rounded-xl bg-amber-50/90 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/30 p-3 flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <span className="font-bold text-amber-800 dark:text-amber-300 block">
                            Catatan Penting
                          </span>
                          <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                            {info.actionTip}
                          </p>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5" />
                          Periode data: {formatPnlPeriodRange(report)} (
                          {formatMonthId(report.monthKey)} · {info.periodDays} hari)
                        </span>
                        {row.account && (
                          <span className="font-mono">
                            Kode Akun ESB: {row.account}
                          </span>
                        )}
                      </div>

                      {/* 5. Analisa Tambahan AI (Opsional: Pilih Gemini atau Groq lalu klik Analisa) */}
                      <PnlAiAnalysisPanel
                        key={getPnlRowCacheKey(row, report, prevReport)}
                        row={row}
                        report={report}
                        prevReport={prevReport}
                        permanentNote={rowPermanentNote}
                        onSavePermanentNote={(text, provider) => {
                          savePnlPermanentNote({
                            monthKey: noteScopeKey,
                            description: row.description,
                            text,
                            provider,
                          });
                          setNotesVersion((v) => v + 1);
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </MotionSection>
    </div>
  );
}

function SimpleAnalysisCard({
  defaultText,
  permanentNote,
  onResetPermanentNote,
}: {
  defaultText: string;
  permanentNote: PnlPermanentNote | null;
  onResetPermanentNote: () => void;
}) {
  const displayParagraphs = useMemo(() => {
    const raw = permanentNote ? cleanAiProse(permanentNote.text) : defaultText;
    return raw
      .split(/\n{2,}|\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [permanentNote, defaultText]);

  return (
    <div
      className={`rounded-xl bg-white dark:bg-[#1D1712] border p-3.5 space-y-2 ${
        permanentNote
          ? 'border-emerald-300 dark:border-emerald-500/45'
          : 'border-blue-200 dark:border-blue-500/35'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className={`flex items-center gap-1.5 font-extrabold uppercase tracking-wide text-[11px] ${
            permanentNote
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-blue-700 dark:text-blue-300'
          }`}
        >
          {permanentNote ? (
            <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Info className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>Analisa Sederhana (Dari Aplikasi)</span>
        </div>

        <div className="flex items-center gap-1.5">
          {permanentNote ? (
            <>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                Note Permanen ·{' '}
                {permanentNote.provider === 'groq'
                  ? 'Groq AI'
                  : permanentNote.provider === 'openai'
                  ? 'OpenAI'
                  : 'Gemini AI'}
              </span>
              <button
                type="button"
                onClick={onResetPermanentNote}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#2A231E] text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-300 cursor-pointer"
                title="Hapus note permanen dan kembalikan analisa bawaan aplikasi"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Pakai Bawaan</span>
              </button>
            </>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300">
              Otomatis · Instan
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5 text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed">
        {displayParagraphs.map((para, idx) => (
          <p key={idx}>{renderAnalysisInlineBold(para)}</p>
        ))}
      </div>
    </div>
  );
}

function PnlAiAnalysisPanel({
  row,
  report,
  prevReport,
  permanentNote,
  onSavePermanentNote,
}: {
  row: PnlRow;
  report: PnlMonthReport;
  prevReport: PnlMonthReport | null;
  permanentNote: PnlPermanentNote | null;
  onSavePermanentNote: (text: string, provider: PnlAiProviderChoice) => void;
}) {
  const [selectedProvider, setSelectedProvider] =
    useState<PnlAiProviderChoice>('gemini');
  const cacheKey = useMemo(
    () => getPnlRowCacheKey(row, report, prevReport, selectedProvider),
    [row, report, prevReport, selectedProvider]
  );

  const [analysisText, setAnalysisText] = useState<string | null>(() =>
    getCachedPnlAnalysis(cacheKey)
  );
  const [animateMain, setAnimateMain] = useState<boolean>(false);
  const [typingFollowUpIdx, setTypingFollowUpIdx] = useState<number | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [qaByKey, setQaByKey] = useState<Record<string, PnlFollowUpTurn[]>>({});
  const [questionInput, setQuestionInput] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const qaAbortRef = React.useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    qaAbortRef.current?.abort();
    qaAbortRef.current = null;
    const cached = getCachedPnlAnalysis(cacheKey);
    setAnalysisText(cached);
    setAnimateMain(false);
    setTypingFollowUpIdx(null);
    setIsLoading(false);
    setErrorMsg(null);
    setIsAsking(false);
    setQaError(null);

    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      qaAbortRef.current?.abort();
      qaAbortRef.current = null;
    };
  }, [cacheKey]);

  const handleRunAnalysis = (forceRefresh: boolean) => {
    if (isLoading) return;
    abortRef.current?.abort();
    qaAbortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setErrorMsg(null);
    setQaError(null);

    fetchPnlRowAnalysis({
      row,
      report,
      prevReport,
      provider: selectedProvider,
      forceRefresh,
      signal: controller.signal,
    })
      .then((res) => {
        if (controller.signal.aborted) return;
        setAnimateMain(!res.fromCache);
        setAnalysisText(res.text);
        if (forceRefresh) {
          setQaByKey((prev) => {
            const next = { ...prev };
            delete next[cacheKey];
            return next;
          });
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setErrorMsg(
          err instanceof Error
            ? err.message
            : `Gagal memuat analisis ${
                selectedProvider === 'groq' ? 'Groq' : 'Gemini'
              } untuk pos ini.`
        );
        setIsLoading(false);
      });
  };

  const followUpMessages = qaByKey[cacheKey] ?? [];

  const handleAskQuestion = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = questionInput.trim();
    if (!trimmed || !analysisText || isAsking || isLoading) return;

    qaAbortRef.current?.abort();
    const controller = new AbortController();
    qaAbortRef.current = controller;

    const priorTurns = followUpMessages;
    setQuestionInput('');
    setQaError(null);
    setIsAsking(true);
    setQaByKey((prev) => ({
      ...prev,
      [cacheKey]: [...priorTurns, { role: 'user', text: trimmed }],
    }));

    askPnlFollowUpQuestion({
      row,
      report,
      prevReport,
      provider: selectedProvider,
      initialAnalysis: analysisText,
      history: priorTurns,
      question: trimmed,
      signal: controller.signal,
    })
      .then((res) => {
        if (controller.signal.aborted) return;
        setQaByKey((prev) => {
          const base =
            prev[cacheKey] ?? [...priorTurns, { role: 'user', text: trimmed }];
          const updated = [...base, { role: 'assistant' as const, text: res.text }];
          setTypingFollowUpIdx(updated.length - 1);
          return {
            ...prev,
            [cacheKey]: updated,
          };
        });
        setIsAsking(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setQaByKey((prev) => ({
          ...prev,
          [cacheKey]: priorTurns,
        }));
        setQuestionInput(trimmed);
        setQaError(
          err instanceof Error
            ? err.message
            : `Gagal mengirim pertanyaan ke ${
                selectedProvider === 'groq' ? 'Groq' : 'Gemini'
              }.`
        );
        setIsAsking(false);
      });
  };

  const cleanedMainAnalysis = useMemo(
    () => (analysisText ? cleanAiProse(analysisText) : ''),
    [analysisText]
  );

  const paragraphs = useMemo(() => {
    if (!cleanedMainAnalysis) return [];
    return cleanedMainAnalysis
      .split(/\n{2,}|\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [cleanedMainAnalysis]);

  const providerLabel =
    selectedProvider === 'groq'
      ? 'Groq AI'
      : selectedProvider === 'openai'
      ? 'OpenAI'
      : 'Gemini AI';
  const isMainPinned =
    Boolean(cleanedMainAnalysis) &&
    permanentNote?.text === cleanedMainAnalysis;

  return (
    <div className="rounded-xl bg-white dark:bg-[#1D1712] border border-amber-300/75 dark:border-amber-500/35 p-3.5 space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-500/20 border border-amber-300/60 dark:border-amber-500/35 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0">
            <span className="font-extrabold tracking-wide uppercase text-[11px] text-amber-800 dark:text-amber-300 block">
              Analisa Tambahan AI (Opsional)
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
              Pilih Gemini, Groq, atau OpenAI, lalu klik Analisa
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Pilih penyedia AI"
            className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-[#130E0B] border border-slate-200 dark:border-[#352E28]"
          >
            <button
              type="button"
              disabled={isLoading || isAsking}
              onClick={() => setSelectedProvider('gemini')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-60 ${
                selectedProvider === 'gemini'
                  ? 'bg-amber-400 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Gemini
            </button>
            <button
              type="button"
              disabled={isLoading || isAsking}
              onClick={() => setSelectedProvider('groq')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-60 ${
                selectedProvider === 'groq'
                  ? 'bg-amber-400 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Groq
            </button>
            <button
              type="button"
              disabled={isLoading || isAsking}
              onClick={() => setSelectedProvider('openai')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-60 ${
                selectedProvider === 'openai'
                  ? 'bg-amber-400 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              OpenAI
            </button>
          </div>

          <button
            type="button"
            disabled={isLoading || isAsking}
            onClick={() => handleRunAnalysis(Boolean(analysisText))}
            className="btn-3d-primary px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[30px]"
          >
            {isLoading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            <span>
              {isLoading
                ? 'Menganalisis...'
                : analysisText
                ? 'Analisa Ulang'
                : 'Analisa'}
            </span>
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2 py-1" aria-live="polite">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>
              {providerLabel} sedang membaca laporan Laba Rugi &amp; menganalisis{' '}
              <strong>{row.description}</strong>...
            </span>
          </div>
          <div className="space-y-1.5 animate-pulse">
            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-[#2A231E] w-full" />
            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-[#2A231E] w-11/12" />
            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-[#2A231E] w-4/5" />
          </div>
        </div>
      )}

      {!isLoading && errorMsg && (
        <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 px-3 py-2.5 text-xs text-rose-800 dark:text-rose-300 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => handleRunAnalysis(true)}
            className="px-2.5 py-1 rounded-md bg-rose-600 text-white font-semibold text-[11px] shrink-0 cursor-pointer hover:bg-rose-700"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {!isLoading && !errorMsg && paragraphs.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-[#312A25]">
          <div className="space-y-2 text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Hasil Analisa {providerLabel}
              </div>
              <button
                type="button"
                disabled={isMainPinned}
                onClick={() =>
                  onSavePermanentNote(cleanedMainAnalysis, selectedProvider)
                }
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer disabled:cursor-default ${
                  isMainPinned
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/35'
                    : 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/35 hover:bg-amber-100 dark:hover:bg-amber-500/25'
                }`}
              >
                {isMainPinned ? (
                  <>
                    <Check className="w-3 h-3 shrink-0" />
                    <span>Dipakai sbg Note Permanen</span>
                  </>
                ) : (
                  <>
                    <BookmarkCheck className="w-3 h-3 shrink-0" />
                    <span>Jadikan Note Permanen</span>
                  </>
                )}
              </button>
            </div>
            <AiTypewriterText
              text={cleanedMainAnalysis}
              animate={animateMain}
              onComplete={() => setAnimateMain(false)}
            />
          </div>

          {/* Follow-up Q&A thread + input */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-[#312A25] space-y-2.5">
            {followUpMessages.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {followUpMessages.map((msg, idx) => {
                  const cleanedReply =
                    msg.role === 'assistant' ? cleanAiProse(msg.text) : msg.text;
                  const isReplyPinned =
                    msg.role === 'assistant' &&
                    Boolean(cleanedReply) &&
                    permanentNote?.text === cleanedReply;

                  return (
                    <div
                      key={idx}
                      className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-amber-50 dark:bg-amber-500/15 border border-amber-200/80 dark:border-amber-500/30 text-slate-900 dark:text-amber-100 ml-4 sm:ml-8'
                          : 'bg-slate-50 dark:bg-[#130E0B] border border-slate-200/80 dark:border-[#352E28] text-slate-700 dark:text-slate-200 mr-4 sm:mr-8 space-y-1.5'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-0.5">
                        <div
                          className={`text-[10px] font-bold uppercase tracking-wide ${
                            msg.role === 'user'
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {msg.role === 'user'
                            ? 'Pertanyaan Anda'
                            : `Jawaban ${providerLabel}`}
                        </div>

                        {msg.role === 'assistant' && cleanedReply && (
                          <button
                            type="button"
                            disabled={isReplyPinned}
                            onClick={() =>
                              onSavePermanentNote(cleanedReply, selectedProvider)
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer disabled:cursor-default ${
                              isReplyPinned
                                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                : 'bg-white dark:bg-[#1D1712] border border-slate-200 dark:border-[#37302A] text-amber-700 dark:text-amber-300 hover:border-amber-400'
                            }`}
                          >
                            {isReplyPinned ? (
                              <>
                                <Check className="w-3 h-3 shrink-0" />
                                <span>Note Permanen</span>
                              </>
                            ) : (
                              <>
                                <BookmarkCheck className="w-3 h-3 shrink-0" />
                                <span>Jadikan Note Permanen</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      {msg.role === 'user' ? (
                        <p>{msg.text}</p>
                      ) : (
                        <AiTypewriterText
                          text={cleanedReply}
                          animate={typingFollowUpIdx === idx}
                          onComplete={() =>
                            setTypingFollowUpIdx((prev) =>
                              prev === idx ? null : prev
                            )
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isAsking && (
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 px-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>{providerLabel} sedang menyiapkan jawaban...</span>
              </div>
            )}

            {qaError && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 px-3 py-2 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{qaError}</span>
              </div>
            )}

            <form
              onSubmit={handleAskQuestion}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
            >
              <div className="relative flex-1">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  disabled={isAsking}
                  placeholder={`Tanya lanjutan ke ${providerLabel} tentang ${row.description}...`}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-[#37302A] bg-slate-50 dark:bg-[#130E0B] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[38px] disabled:opacity-60"
                />
              </div>
              <button
                type="submit"
                disabled={isAsking || !questionInput.trim()}
                className="btn-3d-primary px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 min-h-[38px] disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Tanya AI</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function renderAnalysisInlineBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}
