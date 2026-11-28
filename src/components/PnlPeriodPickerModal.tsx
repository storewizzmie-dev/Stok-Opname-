// @ts-nocheck -- imported legacy code written for a looser tsconfig
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import {
  PnlDataset,
  PnlMonthReport,
  formatPnlPeriodRange,
  formatSignedRupiah,
} from '../lib/profitLoss';
import { formatDateId, formatMonthId } from '../lib/stockOpname';

const WEEKDAYS_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const MONTHS_ID = [
  { num: '01', name: 'Januari', short: 'Jan' },
  { num: '02', name: 'Februari', short: 'Feb' },
  { num: '03', name: 'Maret', short: 'Mar' },
  { num: '04', name: 'April', short: 'Apr' },
  { num: '05', name: 'Mei', short: 'Mei' },
  { num: '06', name: 'Juni', short: 'Jun' },
  { num: '07', name: 'Juli', short: 'Jul' },
  { num: '08', name: 'Agustus', short: 'Agu' },
  { num: '09', name: 'September', short: 'Sep' },
  { num: '10', name: 'Oktober', short: 'Okt' },
  { num: '11', name: 'November', short: 'Nov' },
  { num: '12', name: 'Desember', short: 'Des' },
];

export interface PendingPnlUploadItem {
  report: PnlMonthReport;
  fileName: string;
}

export function PnlPeriodPickerModal({
  item,
  queueIndex,
  queueTotal,
  existingPnlData,
  defaultMonthKey,
  onConfirm,
  onCancel,
}: {
  item: PendingPnlUploadItem | null;
  queueIndex: number;
  queueTotal: number;
  existingPnlData: PnlDataset;
  defaultMonthKey: string;
  onConfirm: (periodStart: string, periodEnd: string) => void;
  onCancel: () => void;
}) {
  const initialMonthKey = useMemo(() => {
    if (!item) return defaultMonthKey || '2026-11';
    if (
      item.report.monthKey &&
      /^\d{4}-\d{2}$/.test(item.report.monthKey)
    ) {
      return item.report.monthKey;
    }
    if (defaultMonthKey && /^\d{4}-\d{2}$/.test(defaultMonthKey)) {
      return defaultMonthKey;
    }
    return '2026-11';
  }, [item, defaultMonthKey]);

  const [selectedYear, setSelectedYear] = useState<number>(() =>
    Number(initialMonthKey.slice(0, 4)) || 2026
  );
  const [selectedMonthNum, setSelectedMonthNum] = useState<string>(() =>
    initialMonthKey.slice(5, 7) || '11'
  );
  const [mode, setMode] = useState<'range' | 'single'>('range');
  const [startDay, setStartDay] = useState<number>(1);
  const [endDay, setEndDay] = useState<number>(16);
  const [activeSlot, setActiveSlot] = useState<'start' | 'end'>('start');

  // Dragging across the calendar grid
  const dragAnchorDayRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const hasDraggedRef = useRef<boolean>(false);

  const monthKey = `${selectedYear}-${selectedMonthNum}`;
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, Number(selectedMonthNum), 0).getDate() || 30;
  }, [selectedYear, selectedMonthNum]);

  // Existing periods already saved in this month
  const existingReportsInMonth = useMemo(() => {
    return Object.values(existingPnlData)
      .filter((r) => r.monthKey === monthKey)
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  }, [existingPnlData, monthKey]);

  // Set of day numbers (1..31) already covered by existing reports in this month
  const coveredDaysMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const rep of existingReportsInMonth) {
      const sDay = Number(rep.periodStart.slice(8, 10));
      const eDay = Number(rep.periodEnd.slice(8, 10));
      const label = formatPnlPeriodRange(rep);
      for (let d = sDay; d <= eDay; d++) {
        map.set(d, label);
      }
    }
    return map;
  }, [existingReportsInMonth]);

  // Reset intelligent default period whenever a new pending file opens
  useEffect(() => {
    if (!item) return;
    const yr = Number(initialMonthKey.slice(0, 4)) || 2026;
    const mo = initialMonthKey.slice(5, 7) || '11';
    setSelectedYear(yr);
    setSelectedMonthNum(mo);

    const mKey = `${yr}-${mo}`;
    const totalDays = new Date(yr, Number(mo), 0).getDate() || 30;
    const reportsInMo = Object.values(existingPnlData)
      .filter((r) => r.monthKey === mKey)
      .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));

    if (reportsInMo.length > 0) {
      // Find highest day already saved in that month and suggest the next available day
      const maxExistingEnd = Math.max(
        ...reportsInMo.map((r) => Number(r.periodEnd.slice(8, 10)) || 1)
      );
      const nextSuggestedDay = Math.min(totalDays, maxExistingEnd + 1);
      setStartDay(nextSuggestedDay);
      setEndDay(nextSuggestedDay);
      setMode('single');
      setActiveSlot('start');
    } else {
      const fileStartDay = Number(item.report.periodStart.slice(8, 10)) || 1;
      const fileEndDay = Number(item.report.periodEnd.slice(8, 10)) || 16;
      const clampedStart = Math.max(1, Math.min(totalDays, fileStartDay));
      const clampedEnd = Math.max(clampedStart, Math.min(totalDays, fileEndDay));
      setStartDay(clampedStart);
      setEndDay(clampedEnd);
      setMode(clampedStart === clampedEnd ? 'single' : 'range');
      setActiveSlot('start');
    }
  }, [item, initialMonthKey, existingPnlData]);

  // Clamp days if user changes month (e.g. to Feb with 28 days)
  useEffect(() => {
    setStartDay((prev) => Math.min(prev, daysInMonth));
    setEndDay((prev) => Math.min(prev, daysInMonth));
  }, [daysInMonth]);

  useEffect(() => {
    if (!item) return;
    const finishDrag = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      hasDraggedRef.current = false;
      dragAnchorDayRef.current = null;
    };
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [item]);

  if (!item) return null;

  const normStartDay = Math.min(startDay, endDay);
  const normEndDay = mode === 'single' ? normStartDay : Math.max(startDay, endDay);
  const periodStartIso = `${monthKey}-${String(normStartDay).padStart(2, '0')}`;
  const periodEndIso = `${monthKey}-${String(normEndDay).padStart(2, '0')}`;
  const totalSelectedDays = normEndDay - normStartDay + 1;
  const dailyNetSales = item.report.netSales / Math.max(1, totalSelectedDays);

  // Check if any selected day overlaps with an existing report in the same month (unless identical ID)
  const overlappingLabels = (() => {
    const labels = new Set<string>();
    for (let d = normStartDay; d <= normEndDay; d++) {
      const lbl = coveredDaysMap.get(d);
      if (lbl) labels.add(lbl);
    }
    return Array.from(labels);
  })();

  const calendarCells = (() => {
    const firstWeekdaySun0 = new Date(
      selectedYear,
      Number(selectedMonthNum) - 1,
      1
    ).getDay();
    const leadingBlanks = (firstWeekdaySun0 + 6) % 7;
    const cells: (number | null)[] = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  })();

  const handleDayClick = (day: number) => {
    if (mode === 'single') {
      setStartDay(day);
      setEndDay(day);
      return;
    }
    if (activeSlot === 'start') {
      setStartDay(day);
      if (day > endDay) setEndDay(day);
      setActiveSlot('end');
    } else {
      if (day < startDay) {
        setEndDay(startDay);
        setStartDay(day);
      } else {
        setEndDay(day);
      }
      setActiveSlot('start');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pnl-period-modal-title"
      data-lenis-prevent
      className="s3-modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white dark:bg-[#17120E] border border-slate-200 dark:border-[#352E28] rounded-3xl overflow-hidden shadow-2xl max-h-[94vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-[#352E28] bg-gradient-to-r from-[#BE490C]/10 via-amber-500/10 to-transparent dark:from-[#29231D] dark:to-[#17120E] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="pnl-period-modal-title"
                  className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate"
                >
                  Pilih Tanggal &amp; Bulan Profit Loss
                </h2>
                {queueTotal > 1 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-400 text-slate-950 shrink-0">
                    File {queueIndex + 1}/{queueTotal}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                File: <strong>{item.fileName}</strong> · Net Sales:{' '}
                <strong className="text-emerald-700 dark:text-emerald-300 font-mono">
                  {formatSignedRupiah(item.report.netSales)}
                </strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Batal upload file ini"
            className="btn-3d-soft p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div
          data-lenis-prevent
          className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm"
        >
          {/* Step 1: Pilih Bulan & Tahun */}
          <div className="rounded-2xl p-3.5 bg-slate-50 dark:bg-[#130E0B] border border-slate-200 dark:border-[#352E28] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-amber-300">
                1. Pilih Bulan &amp; Tahun Laporan
              </span>

              {/* Year switcher */}
              <div className="inline-flex items-center gap-1 bg-white dark:bg-[#1B1511] border border-slate-200 dark:border-[#37302A] rounded-xl px-1.5 py-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y - 1)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2A231E] text-slate-700 dark:text-slate-200 cursor-pointer"
                  aria-label="Tahun sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono font-extrabold text-xs text-slate-900 dark:text-white">
                  {selectedYear}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y + 1)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2A231E] text-slate-700 dark:text-slate-200 cursor-pointer"
                  aria-label="Tahun berikutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              {MONTHS_ID.map((m) => {
                const isSelected = m.num === selectedMonthNum;
                return (
                  <button
                    key={m.num}
                    type="button"
                    onClick={() => setSelectedMonthNum(m.num)}
                    className={`py-2 px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      isSelected
                        ? 'btn-3d-primary shadow-xs'
                        : 'bg-white dark:bg-[#1B1511] border border-slate-200 dark:border-[#37302A] text-slate-700 dark:text-slate-200 hover:border-amber-400'
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Existing saved periods in this month (so user sees previous uploads like 1-16 Nov) */}
          {existingReportsInMonth.length > 0 && (
            <div className="rounded-2xl p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/35 space-y-1.5">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Periode yang Sudah Tersimpan di {formatMonthId(monthKey)}:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {existingReportsInMonth.map((rep) => (
                  <span
                    key={rep.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-[#1D1712] border border-blue-300 dark:border-blue-500/40 text-blue-900 dark:text-blue-200"
                  >
                    <CalendarDays className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>{formatPnlPeriodRange(rep)}</span>
                    <span className="font-mono text-[11px] opacity-80">
                      ({formatSignedRupiah(rep.netSales)})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Mode Tanggal (Rentang Tanggal vs 1 Hari) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-amber-300">
                2. Tentukan Periode Tanggal ({formatMonthId(monthKey)})
              </span>

              <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-[#130E0B] border border-slate-200 dark:border-[#352E28]">
                <button
                  type="button"
                  onClick={() => {
                    setMode('range');
                    setActiveSlot('start');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    mode === 'range'
                      ? 'btn-3d-primary'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  <span>Rentang Tanggal (Misal 1–16)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('single');
                    setEndDay(startDay);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    mode === 'single'
                      ? 'btn-3d-primary'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>1 Tanggal (Misal 18 Nov)</span>
                </button>
              </div>
            </div>

            {/* Start / End Selector Cards */}
            {mode === 'range' ? (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveSlot('start')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    activeSlot === 'start'
                      ? 'border-amber-400 bg-amber-50/70 dark:bg-amber-500/15 ring-2 ring-amber-400/30'
                      : 'border-slate-200 dark:border-[#352E28] bg-white dark:bg-[#1B1511]'
                  }`}
                >
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Dari Tanggal Mulai
                  </div>
                  <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {formatDateId(periodStartIso)}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSlot('end')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    activeSlot === 'end'
                      ? 'border-cyan-400 bg-cyan-50/70 dark:bg-cyan-500/15 ring-2 ring-cyan-400/30'
                      : 'border-slate-200 dark:border-[#352E28] bg-white dark:bg-[#1B1511]'
                  }`}
                >
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                    Sampai Tanggal Akhir
                  </div>
                  <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {formatDateId(periodEndIso)}
                  </div>
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-2xl border-2 border-amber-400 bg-amber-50/70 dark:bg-amber-500/15 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Tanggal Laporan (1 Hari)
                  </div>
                  <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {formatDateId(periodStartIso)}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-amber-400 text-slate-950">
                  1 Hari Penuh
                </span>
              </div>
            )}

            {/* Calendar Grid 1..30/31 */}
            <div className="rounded-2xl p-3.5 bg-slate-50/90 dark:bg-[#130E0B] border border-slate-200 dark:border-[#352E28] space-y-2 select-none">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  {mode === 'range'
                    ? 'Klik atau tarik dari tanggal mulai ke tanggal akhir'
                    : 'Klik tanggal laporan pada kalender di bawah'}
                </span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                  {totalSelectedDays} hari dipilih
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS_ID.map((w) => (
                  <div
                    key={w}
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-1"
                  >
                    {w}
                  </div>
                ))}
              </div>

              <div
                onPointerMove={(e) => {
                  if (
                    mode !== 'range' ||
                    !isDraggingRef.current ||
                    dragAnchorDayRef.current === null
                  ) {
                    return;
                  }
                  const el = document.elementFromPoint(e.clientX, e.clientY);
                  const btn = el?.closest('[data-pnl-day]');
                  const dayAttr = btn?.getAttribute('data-pnl-day');
                  if (!dayAttr) return;
                  const targetDay = Number(dayAttr);
                  if (!targetDay) return;
                  const anchor = dragAnchorDayRef.current;
                  if (targetDay !== anchor) {
                    hasDraggedRef.current = true;
                  }
                  if (hasDraggedRef.current) {
                    setStartDay(Math.min(anchor, targetDay));
                    setEndDay(Math.max(anchor, targetDay));
                  }
                }}
                className="grid grid-cols-7 gap-1.5 touch-none"
              >
                {calendarCells.map((day, idx) => {
                  if (day === null) {
                    return <div key={`blank-${idx}`} className="h-10" />;
                  }
                  const isStart = day === normStartDay;
                  const isEnd = day === normEndDay;
                  const isBetween = day > normStartDay && day < normEndDay;
                  const existingLabel = coveredDaysMap.get(day);

                  return (
                    <button
                      key={day}
                      type="button"
                      data-pnl-day={day}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        if (mode === 'range') {
                          dragAnchorDayRef.current = day;
                          isDraggingRef.current = true;
                          hasDraggedRef.current = false;
                        }
                        handleDayClick(day);
                      }}
                      className={`relative h-10 rounded-xl flex flex-col items-center justify-center text-xs font-bold tabular-nums transition-all cursor-pointer ${
                        isStart && isEnd
                          ? 'bg-amber-400 text-slate-950 font-bold ring-1 ring-amber-300 z-10'
                          : isStart
                          ? 'bg-amber-400 text-slate-950 font-black shadow-md ring-2 ring-amber-300 z-10'
                          : isEnd
                          ? 'bg-cyan-400 text-slate-950 font-black shadow-md ring-2 ring-cyan-300 z-10'
                          : isBetween
                          ? 'bg-amber-400/25 dark:bg-cyan-400/25 text-slate-900 dark:text-white border border-amber-400/40'
                          : existingLabel
                          ? 'bg-blue-100/70 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-300/60 dark:border-blue-500/35'
                          : 'bg-white dark:bg-[#1B1511] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#2A231E]'
                      }`}
                      title={
                        existingLabel
                          ? `Sudah ada data periode ${existingLabel}`
                          : undefined
                      }
                    >
                      <span className="leading-none">{day}</span>
                      {existingLabel && !isStart && !isEnd && !isBetween && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Warning if overlapping with an already saved period */}
          {overlappingLabels.length > 0 && (
            <div className="rounded-2xl p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Perhatian:</strong> Tanggal yang dipilih beririsan dengan periode yang sudah tersimpan (
                <strong>{overlappingLabels.join(', ')}</strong>). Jika ini adalah upload kedua di bulan yang sama (misal tanggal <strong>18 {formatMonthId(monthKey)}</strong>), pilih tanggal yang belum terpakai agar tidak bertumpuk.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-100 dark:border-[#352E28] bg-slate-50/90 dark:bg-[#130E0B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="space-y-0.5">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
              Periode:{' '}
              {periodStartIso === periodEndIso
                ? formatDateId(periodStartIso)
                : `${normStartDay}–${formatDateId(periodEndIso)}`}{' '}
              ({totalSelectedDays} hari)
            </div>
            <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
              Net Sales/Hari di Grafik Beranda:{' '}
              <strong>{formatSignedRupiah(dailyNetSales)}/hari</strong>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="btn-3d-soft px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-700 dark:text-slate-200 min-h-[40px] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => onConfirm(periodStartIso, periodEndIso)}
              className="btn-3d-primary px-5 py-2 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-1.5 min-h-[40px] cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Simpan Periode Ini</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
