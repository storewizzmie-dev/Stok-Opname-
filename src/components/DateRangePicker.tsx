// @ts-nocheck -- imported legacy code written for a looser tsconfig
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
} from 'lucide-react';
import {
  formatDateId,
  formatDateRangeLabel,
  formatMonthId,
} from '../lib/stockOpname';

const SHORT_DOW_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

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

  const [selectedYear, setSelectedYear] = useState<number>(
    () => Number(initialMonthKey.slice(0, 4)) || 2026
  );
  const [selectedMonthNum, setSelectedMonthNum] = useState<string>(
    () => initialMonthKey.slice(5, 7) || '11'
  );
  const [startDay, setStartDay] = useState<number>(1);
  const [endDay, setEndDay] = useState<number>(1);
  // selectionPhase: 'awaitingSecond' means 1st tap just chose a single day; next tap extends it to a range
  const [selectionPhase, setSelectionPhase] = useState<'complete' | 'awaitingSecond'>('complete');

  const dragAnchorDayRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const hasDraggedRef = useRef<boolean>(false);

  const activeMonthKey = `${selectedYear}-${selectedMonthNum}`;
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, Number(selectedMonthNum), 0).getDate() || 30;
  }, [selectedYear, selectedMonthNum]);

  const effectiveAllDates = useMemo(
    () =>
      allAvailableDates && allAvailableDates.length > 0
        ? allAvailableDates
        : availableDates,
    [allAvailableDates, availableDates]
  );

  const savedDatesInMonth = useMemo(() => {
    return effectiveAllDates
      .filter((d) => d.startsWith(activeMonthKey))
      .sort();
  }, [effectiveAllDates, activeMonthKey]);

  const coveredDaysSet = useMemo(() => {
    const set = new Set<number>();
    for (const iso of savedDatesInMonth) {
      const d = Number(iso.slice(8, 10));
      if (d >= 1 && d <= 31) set.add(d);
    }
    return set;
  }, [savedDatesInMonth]);

  const sortedCoveredDays = useMemo(
    () => Array.from(coveredDaysSet).sort((a, b) => a - b),
    [coveredDaysSet]
  );

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
    setSelectionPhase('complete');
  }, [isOpen, initialMonthKey, rangeStart, rangeEnd]);

  useEffect(() => {
    setStartDay((prev) => Math.min(prev, daysInMonth));
    setEndDay((prev) => Math.min(prev, daysInMonth));
  }, [daysInMonth]);

  useEffect(() => {
    if (!isOpen) return;
    const finishDrag = () => {
      if (!isDraggingRef.current) return;
      if (hasDraggedRef.current) {
        setSelectionPhase('complete');
      }
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
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onOpenChange]);

  if (!isOpen) return null;

  const normStartDay = Math.min(startDay, endDay);
  const normEndDay = Math.max(startDay, endDay);
  const periodStartIso = `${activeMonthKey}-${String(normStartDay).padStart(2, '0')}`;
  const periodEndIso = `${activeMonthKey}-${String(normEndDay).padStart(2, '0')}`;
  const totalSelectedDays = normEndDay - normStartDay + 1;
  const isSingleDay = normStartDay === normEndDay;

  let matchingSavedDaysCount = 0;
  for (let d = normStartDay; d <= normEndDay; d++) {
    if (coveredDaysSet.has(d)) matchingSavedDaysCount++;
  }

  const handleSelectMonthButton = (mNum: string) => {
    setSelectedMonthNum(mNum);
    const nextMonthKey = `${selectedYear}-${mNum}`;
    const totalDays = new Date(selectedYear, Number(mNum), 0).getDate() || 30;
    const datesInTargetMonth = effectiveAllDates
      .filter((d) => d.startsWith(nextMonthKey))
      .sort();

    if (datesInTargetMonth.length > 0) {
      const firstDay = Number(datesInTargetMonth[0].slice(8, 10)) || 1;
      const lastDay =
        Number(datesInTargetMonth[datesInTargetMonth.length - 1].slice(8, 10)) ||
        totalDays;
      setStartDay(firstDay);
      setEndDay(lastDay);
    } else {
      setStartDay(1);
      setEndDay(totalDays);
    }
    setSelectionPhase('complete');
  };

  const handleTileTap = (day: number) => {
    if (selectionPhase === 'complete') {
      // First tap: select single day immediately, ready for optional 2nd tap to form range
      setStartDay(day);
      setEndDay(day);
      setSelectionPhase('awaitingSecond');
    } else {
      // Second tap: if tapping same day, keep single day; otherwise form range
      if (day === startDay) {
        setStartDay(day);
        setEndDay(day);
      } else {
        setStartDay(Math.min(startDay, day));
        setEndDay(Math.max(startDay, day));
      }
      setSelectionPhase('complete');
    }
  };

  const firstCovered = sortedCoveredDays[0] ?? 1;
  const lastCovered = sortedCoveredDays[sortedCoveredDays.length - 1] ?? daysInMonth;

  const quickPresets = [
    {
      id: 'all-data',
      label: savedDatesInMonth.length > 0 ? `Semua Data (${firstCovered}–${lastCovered})` : '1 Bulan Penuh',
      start: savedDatesInMonth.length > 0 ? firstCovered : 1,
      end: savedDatesInMonth.length > 0 ? lastCovered : daysInMonth,
    },
    {
      id: 'first-half',
      label: 'Tgl 1–15',
      start: 1,
      end: Math.min(15, daysInMonth),
    },
    {
      id: 'second-half',
      label: `Tgl 16–${daysInMonth}`,
      start: Math.min(16, daysInMonth),
      end: daysInMonth,
    },
  ];

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dowIdx = new Date(selectedYear, Number(selectedMonthNum) - 1, day).getDay();
    return {
      day,
      dow: SHORT_DOW_ID[dowIdx],
      isWeekend: dowIdx === 0 || dowIdx === 6,
    };
  });

  const trackLeftPct = ((normStartDay - 1) / Math.max(1, daysInMonth - 1)) * 100;
  const trackWidthPct =
    ((normEndDay - normStartDay) / Math.max(1, daysInMonth - 1)) * 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pilih Tanggal"
      data-lenis-prevent
      className="s3-modal fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-md"
      onClick={() => onOpenChange(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] bg-white dark:bg-[#141018] border border-pink-200/80 dark:border-pink-500/25 rounded-3xl overflow-hidden shadow-[0_24px_60px_-15px_rgba(219,39,119,0.28)] flex flex-col"
      >
        {/* Top Glowing Live Capsule Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-pink-600 via-fuchsia-600 to-purple-600 text-white flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              <CalendarRange className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-extrabold tracking-tight truncate">
                  {isSingleDay
                    ? formatDateId(periodStartIso)
                    : formatDateRangeLabel(periodStartIso, periodEndIso)}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-white/20 text-white shrink-0">
                  {isSingleDay ? '1 Hari' : `${totalSelectedDays} Hari`}
                </span>
              </div>
              <div className="text-[10px] text-pink-100 font-medium truncate">
                {matchingSavedDaysCount > 0
                  ? `${matchingSavedDaysCount} hari data tersedia pada pilihan ini`
                  : `Belum ada data pada tanggal ini`}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Tutup"
            className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white shrink-0 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 space-y-3">
          {/* Compact Single-Row Year + Month Horizontal Ribbon */}
          <div className="flex items-center gap-1.5">
            <div className="inline-flex items-center bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl px-1 py-1 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedYear((y) => y - 1)}
                className="p-0.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer"
                aria-label="Tahun sebelumnya"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 font-mono font-extrabold text-[11px] text-slate-800 dark:text-white">
                {selectedYear}
              </span>
              <button
                type="button"
                onClick={() => setSelectedYear((y) => y + 1)}
                className="p-0.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer"
                aria-label="Tahun berikutnya"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {MONTHS_ID.map((m) => {
                const isSelected = m.num === selectedMonthNum;
                const mKeyCandidate = `${selectedYear}-${m.num}`;
                const hasData = effectiveAllDates.some((d) =>
                  d.startsWith(mKeyCandidate)
                );
                return (
                  <button
                    key={m.num}
                    type="button"
                    onClick={() => handleSelectMonthButton(m.num)}
                    className={`relative px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-xs'
                        : hasData
                        ? 'bg-pink-50 dark:bg-pink-500/15 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-500/30'
                        : 'bg-slate-100/80 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-800'
                    }`}
                  >
                    <span>{m.short}</span>
                    {hasData && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-pink-500'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1-Tap Smart Presets Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {quickPresets.map((preset) => {
              const isPresetActive =
                normStartDay === preset.start && normEndDay === preset.end;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setStartDay(preset.start);
                    setEndDay(preset.end);
                    setSelectionPhase('complete');
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 transition-all cursor-pointer border ${
                    isPresetActive
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/10 hover:border-pink-400'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Interactive Range Timeline Ribbon */}
          <div className="px-1">
            <div className="relative h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
              <div
                className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 transition-all duration-150"
                style={{
                  left: `${trackLeftPct}%`,
                  width: `${Math.max(4, trackWidthPct)}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
              <span>
                {selectionPhase === 'awaitingSecond'
                  ? 'Ketuk tanggal kedua untuk rentang, atau langsung Terapkan'
                  : 'Ketuk 1× = 1 hari · Ketuk 2 tanggal / geser = rentang'}
              </span>
              <span className="font-mono text-pink-600 dark:text-pink-400 font-bold">
                {normStartDay === normEndDay
                  ? `Tgl ${normStartDay}`
                  : `Tgl ${normStartDay}–${normEndDay}`}
              </span>
            </div>
          </div>

          {/* Unique 6-Column Tactile Number Matrix (Zero Blank Cells, Super Compact) */}
          <div
            onPointerMove={(e) => {
              if (!isDraggingRef.current || dragAnchorDayRef.current === null) {
                return;
              }
              const el = document.elementFromPoint(e.clientX, e.clientY);
              const btn = el?.closest('[data-matrix-day]');
              const dayAttr = btn?.getAttribute('data-matrix-day');
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
            className="grid grid-cols-6 gap-1.5 select-none touch-none"
          >
            {daysArray.map(({ day, dow, isWeekend }) => {
              const isStart = day === normStartDay;
              const isEnd = day === normEndDay;
              const isBetween = day > normStartDay && day < normEndDay;
              const hasSavedData = coveredDaysSet.has(day);

              return (
                <button
                  key={day}
                  type="button"
                  data-matrix-day={day}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    dragAnchorDayRef.current = day;
                    isDraggingRef.current = true;
                    hasDraggedRef.current = false;
                    handleTileTap(day);
                  }}
                  className={`relative h-11 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                    isStart || isEnd
                      ? 'bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 text-white border-pink-400 shadow-[0_6px_16px_-4px_rgba(236,72,153,0.65)] scale-[1.03] z-10'
                      : isBetween
                      ? 'bg-gradient-to-r from-pink-500/15 to-purple-500/15 dark:from-pink-500/25 dark:to-purple-500/25 text-pink-700 dark:text-pink-200 border-pink-300/70 dark:border-pink-500/40'
                      : hasSavedData
                      ? 'bg-white dark:bg-white/[0.06] text-slate-900 dark:text-white border-pink-200/90 dark:border-pink-500/30 hover:border-pink-400'
                      : 'bg-slate-50/70 dark:bg-white/[0.02] text-slate-400 dark:text-slate-500 border-slate-200/50 dark:border-white/5 hover:border-slate-300'
                  }`}
                >
                  <span
                    className={`text-[8px] font-bold uppercase tracking-wider leading-none ${
                      isStart || isEnd
                        ? 'text-pink-100'
                        : isBetween
                        ? 'text-pink-600/80 dark:text-pink-300/80'
                        : isWeekend
                        ? 'text-rose-400 dark:text-rose-400/80'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {dow}
                  </span>
                  <span className="text-xs sm:text-[13px] font-mono font-extrabold tabular-nums leading-tight mt-0.5">
                    {day}
                  </span>
                  {hasSavedData && (
                    <span
                      className={`w-1 h-1 rounded-full mt-0.5 ${
                        isStart || isEnd
                          ? 'bg-white'
                          : 'bg-pink-500 dark:bg-pink-400'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Compact Action Bar */}
          <div className="pt-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
              <span>= Ada data ({savedDatesInMonth.length} hr)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 cursor-pointer"
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
                className="wizzmie-pink-pill px-4 py-2 rounded-xl text-xs font-extrabold text-white inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>
                  Terapkan ({isSingleDay ? '1 Hari' : `${totalSelectedDays} Hari`})
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
