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
  formatDateId,
  formatDateRangeLabel,
  formatMonthId,
} from '../lib/stockOpname';

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

interface DateRangePickerProps {
  monthKey: string;
  allMonths?: string[];
  onSelectMonth?: (monthKey: string) => void;
  availableDates: string[];
  allAvailableDates?: string[];
  rangeStart: string;
  rangeEnd: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (start: string, end: string) => void;
}

export function DateRangePicker({
  monthKey,
  onSelectMonth,
  availableDates,
  allAvailableDates,
  rangeStart,
  rangeEnd,
  isOpen,
  onOpenChange,
  onConfirm,
}: DateRangePickerProps) {
  const initialMonthKey = useMemo(() => {
    if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
      return monthKey;
    }
    return '2026-11';
  }, [monthKey]);

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

  // Dragging across the calendar grid (identical to PnlPeriodPickerModal in Menu Pengaturan)
  const dragAnchorDayRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const hasDraggedRef = useRef<boolean>(false);

  const activeMonthKey = `${selectedYear}-${selectedMonthNum}`;
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, Number(selectedMonthNum), 0).getDate() || 30;
  }, [selectedYear, selectedMonthNum]);

  // All saved dates across all months (fallback to availableDates if allAvailableDates not provided)
  const effectiveAllDates = useMemo(
    () =>
      allAvailableDates && allAvailableDates.length > 0
        ? allAvailableDates
        : availableDates,
    [allAvailableDates, availableDates]
  );

  // Saved dates in the currently selected month in Step 1
  const savedDatesInMonth = useMemo(() => {
    return effectiveAllDates
      .filter((d) => d.startsWith(activeMonthKey))
      .sort();
  }, [effectiveAllDates, activeMonthKey]);

  // Set of day numbers (1..31) that have Stock Opname data in this month
  const coveredDaysSet = useMemo(() => {
    const set = new Set<number>();
    for (const iso of savedDatesInMonth) {
      const d = Number(iso.slice(8, 10));
      if (d >= 1 && d <= 31) set.add(d);
    }
    return set;
  }, [savedDatesInMonth]);

  // Group contiguous saved dates in this month into readable period chips (like Menu Pengaturan)
  const savedPeriodGroups = useMemo(() => {
    if (savedDatesInMonth.length === 0) return [];
    const sortedDays = Array.from(coveredDaysSet).sort((a, b) => a - b);
    const groups: { startDay: number; endDay: number; count: number }[] = [];
    let curStart = sortedDays[0];
    let curEnd = sortedDays[0];

    for (let i = 1; i < sortedDays.length; i++) {
      const d = sortedDays[i];
      if (d === curEnd + 1) {
        curEnd = d;
      } else {
        groups.push({
          startDay: curStart,
          endDay: curEnd,
          count: curEnd - curStart + 1,
        });
        curStart = d;
        curEnd = d;
      }
    }
    groups.push({
      startDay: curStart,
      endDay: curEnd,
      count: curEnd - curStart + 1,
    });
    return groups;
  }, [savedDatesInMonth.length, coveredDaysSet]);

  // Sync state whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    const yr = Number(initialMonthKey.slice(0, 4)) || 2026;
    const mo = initialMonthKey.slice(5, 7) || '11';
    setSelectedYear(yr);
    setSelectedMonthNum(mo);

    const totalDays = new Date(yr, Number(mo), 0).getDate() || 30;
    const normStart = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
    const normEnd = rangeStart <= rangeEnd ? rangeEnd : rangeStart;

    const sDay =
      normStart && normStart.startsWith(initialMonthKey)
        ? Number(normStart.slice(8, 10)) || 1
        : 1;
    const eDay =
      normEnd && normEnd.startsWith(initialMonthKey)
        ? Number(normEnd.slice(8, 10)) || totalDays
        : totalDays;

    const clampedStart = Math.max(1, Math.min(totalDays, sDay));
    const clampedEnd = Math.max(clampedStart, Math.min(totalDays, eDay));
    setStartDay(clampedStart);
    setEndDay(clampedEnd);
    setMode(clampedStart === clampedEnd ? 'single' : 'range');
    setActiveSlot('start');
  }, [isOpen, initialMonthKey, rangeStart, rangeEnd]);

  // Clamp days if user changes month (e.g. to Feb with 28 days)
  useEffect(() => {
    setStartDay((prev) => Math.min(prev, daysInMonth));
    setEndDay((prev) => Math.min(prev, daysInMonth));
  }, [daysInMonth]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onOpenChange]);

  if (!isOpen) return null;

  const normStartDay = Math.min(startDay, endDay);
  const normEndDay =
    mode === 'single' ? normStartDay : Math.max(startDay, endDay);
  const periodStartIso = `${activeMonthKey}-${String(normStartDay).padStart(
    2,
    '0'
  )}`;
  const periodEndIso = `${activeMonthKey}-${String(normEndDay).padStart(
    2,
    '0'
  )}`;
  const totalSelectedDays = normEndDay - normStartDay + 1;

  // Count how many days in the selected range have saved Stock Opname data
  const matchingSavedDaysCount = (() => {
    let count = 0;
    for (let d = normStartDay; d <= normEndDay; d++) {
      if (coveredDaysSet.has(d)) count++;
    }
    return count;
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

  const handleSelectMonthButton = (mNum: string) => {
    setSelectedMonthNum(mNum);
    const nextMonthKey = `${selectedYear}-${mNum}`;
    const totalDays =
      new Date(selectedYear, Number(mNum), 0).getDate() || 30;
    const datesInTargetMonth = effectiveAllDates
      .filter((d) => d.startsWith(nextMonthKey))
      .sort();

    if (datesInTargetMonth.length > 0) {
      const firstDay =
        Number(datesInTargetMonth[0].slice(8, 10)) || 1;
      const lastDay =
        Number(
          datesInTargetMonth[datesInTargetMonth.length - 1].slice(8, 10)
        ) || totalDays;
      setStartDay(firstDay);
      setEndDay(lastDay);
      setMode(firstDay === lastDay ? 'single' : 'range');
      setActiveSlot('start');
    } else {
      setStartDay(1);
      setEndDay(Math.min(16, totalDays));
      setMode('range');
      setActiveSlot('start');
    }
  };

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
      aria-labelledby="date-range-modal-title"
      data-lenis-prevent
      className="s3-modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs"
      onClick={() => onOpenChange(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white dark:bg-[#17120E] border border-slate-200 dark:border-[#352E28] rounded-3xl overflow-hidden shadow-2xl max-h-[94vh] flex flex-col"
      >
        {/* Header (Copied from PnlPeriodPickerModal in Menu Pengaturan) */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-[#352E28] bg-gradient-to-r from-[#BE490C]/10 via-amber-500/10 to-transparent dark:from-[#29231D] dark:to-[#17120E] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="date-range-modal-title"
                  className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate"
                >
                  Pilih Tanggal &amp; Bulan Stock Opname
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                Bulan: <strong>{formatMonthId(activeMonthKey)}</strong> · Data
                Tersimpan:{' '}
                <strong className="text-emerald-700 dark:text-emerald-300 font-mono">
                  {savedDatesInMonth.length} hari
                </strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Tutup pop up rentang tanggal"
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
          {/* Step 1: Pilih Bulan & Tahun Laporan */}
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
                const mKeyCandidate = `${selectedYear}-${m.num}`;
                const hasMonthData = effectiveAllDates.some((d) =>
                  d.startsWith(mKeyCandidate)
                );
                return (
                  <button
                    key={m.num}
                    type="button"
                    onClick={() => handleSelectMonthButton(m.num)}
                    className={`py-2 px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      isSelected
                        ? 'btn-3d-primary shadow-xs'
                        : 'bg-white dark:bg-[#1B1511] border border-slate-200 dark:border-[#37302A] text-slate-700 dark:text-slate-200 hover:border-amber-400'
                    }`}
                  >
                    <span>{m.name}</span>
                    {hasMonthData && !isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Existing saved dates in this month (matches "Periode yang Sudah Tersimpan" box in Menu Pengaturan) */}
          {savedPeriodGroups.length > 0 && (
            <div className="rounded-2xl p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/35 space-y-1.5">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Periode yang Sudah Tersimpan di {formatMonthId(activeMonthKey)}:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {savedPeriodGroups.map((grp) => {
                  const sIso = `${activeMonthKey}-${String(
                    grp.startDay
                  ).padStart(2, '0')}`;
                  const eIso = `${activeMonthKey}-${String(grp.endDay).padStart(
                    2,
                    '0'
                  )}`;
                  const label =
                    grp.startDay === grp.endDay
                      ? formatDateId(sIso)
                      : formatDateRangeLabel(sIso, eIso);
                  return (
                    <button
                      key={`${grp.startDay}-${grp.endDay}`}
                      type="button"
                      onClick={() => {
                        setStartDay(grp.startDay);
                        setEndDay(grp.endDay);
                        setMode(grp.startDay === grp.endDay ? 'single' : 'range');
                        setActiveSlot('start');
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-[#1D1712] border border-blue-300 dark:border-blue-500/40 text-blue-900 dark:text-blue-200 hover:border-amber-400 transition-colors cursor-pointer"
                    >
                      <CalendarDays className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>{label}</span>
                      <span className="font-mono text-[11px] opacity-80">
                        ({grp.count} hari)
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Mode Tanggal (Rentang Tanggal vs 1 Hari) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-amber-300">
                2. Tentukan Periode Tanggal ({formatMonthId(activeMonthKey)})
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
                  const hasSavedData = coveredDaysSet.has(day);

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
                          : hasSavedData
                          ? 'bg-blue-100/70 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-300/60 dark:border-blue-500/35'
                          : 'bg-white dark:bg-[#1B1511] text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#2A231E]'
                      }`}
                      title={
                        hasSavedData
                          ? `Ada data Stock Opname tanggal ${day} ${formatMonthId(activeMonthKey)}`
                          : undefined
                      }
                    >
                      <span className="leading-none">{day}</span>
                      {hasSavedData && !isStart && !isEnd && !isBetween && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Info notice if selected range has no saved Stock Opname files yet */}
          {matchingSavedDaysCount === 0 && (
            <div className="rounded-2xl p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Perhatian:</strong> Belum ada data Stock Opname yang
                tersimpan pada tanggal ini di{' '}
                <strong>{formatMonthId(activeMonthKey)}</strong>. Tanggal yang
                memiliki data ditandai warna biru dengan titik biru di kalender.
              </div>
            </div>
          )}
        </div>

        {/* Footer (Copied from PnlPeriodPickerModal in Menu Pengaturan) */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-100 dark:border-[#352E28] bg-slate-50/90 dark:bg-[#130E0B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="space-y-0.5">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
              Periode:{' '}
              {periodStartIso === periodEndIso
                ? formatDateId(periodStartIso)
                : `${normStartDay}–${formatDateId(periodEndIso)}`}{' '}
              ({totalSelectedDays} hari)
            </div>
            <div
              className={`text-[11px] font-mono ${
                matchingSavedDaysCount > 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              Data Stock Opname di Periode Ini:{' '}
              <strong>{matchingSavedDaysCount} hari tersimpan</strong>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="btn-3d-soft px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-700 dark:text-slate-200 min-h-[40px] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeMonthKey !== monthKey && onSelectMonth) {
                  onSelectMonth(activeMonthKey);
                }
                onConfirm(periodStartIso, periodEndIso);
                onOpenChange(false);
              }}
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
