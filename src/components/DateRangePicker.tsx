import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  X,
} from 'lucide-react';
import {
  formatDateId,
  formatDateRangeLabel,
  formatMonthId,
} from '../lib/stockOpname';

const WEEKDAYS_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const FULL_WEEKDAYS_ID = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

interface DateRangePickerProps {
  monthKey: string;
  allMonths?: string[];
  onSelectMonth?: (monthKey: string) => void;
  availableDates: string[];
  rangeStart: string;
  rangeEnd: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (start: string, end: string) => void;
}

export function DateRangePicker({
  monthKey,
  allMonths = [],
  onSelectMonth,
  availableDates,
  rangeStart,
  rangeEnd,
  isOpen,
  onOpenChange,
  onConfirm,
}: DateRangePickerProps) {
  const normAppliedStart = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
  const normAppliedEnd = rangeStart <= rangeEnd ? rangeEnd : rangeStart;

  const [draftStart, setDraftStart] = useState(normAppliedStart);
  const [draftEnd, setDraftEnd] = useState(normAppliedEnd);
  const [activeSlot, setActiveSlot] = useState<'start' | 'end'>('start');
  // listOpenSlot: null by default; opens a dropdown list of dates when a card is clicked 2x
  const [listOpenSlot, setListOpenSlot] = useState<'start' | 'end' | null>(
    null
  );

  // Double-click / double-tap tracking (works identically on HP touch & laptop mouse)
  const lastTapRef = useRef<{ slot: 'start' | 'end'; time: number }>({
    slot: 'start',
    time: 0,
  });

  // Dragging (tarik tanggal) refs on the always-visible 1-30 calendar grid
  const dragAnchorRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const activeSlotRef = useRef<'start' | 'end'>('start');
  const draftStartRef = useRef(normAppliedStart);
  const draftEndRef = useRef(normAppliedEnd);

  useEffect(() => {
    activeSlotRef.current = activeSlot;
  }, [activeSlot]);

  useEffect(() => {
    draftStartRef.current = draftStart;
    draftEndRef.current = draftEnd;
  }, [draftStart, draftEnd]);

  useEffect(() => {
    if (isOpen) {
      const s = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
      const e = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
      setDraftStart(s);
      setDraftEnd(e);
      draftStartRef.current = s;
      draftEndRef.current = e;
      setActiveSlot('start');
      activeSlotRef.current = 'start';
      setListOpenSlot(null);
      lastTapRef.current = { slot: 'start', time: 0 };
    }
  }, [isOpen, monthKey, rangeStart, rangeEnd]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (listOpenSlot) {
          setListOpenSlot(null);
        } else {
          onOpenChange(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, listOpenSlot, onOpenChange]);

  const applySingleDateToSlot = (slot: 'start' | 'end', iso: string) => {
    if (slot === 'start') {
      const curEnd = draftEndRef.current;
      if (iso > curEnd) {
        setDraftStart(iso);
        setDraftEnd(iso);
        draftStartRef.current = iso;
        draftEndRef.current = iso;
      } else {
        setDraftStart(iso);
        draftStartRef.current = iso;
      }
      setActiveSlot('end');
      activeSlotRef.current = 'end';
    } else {
      const curStart = draftStartRef.current;
      if (iso < curStart) {
        setDraftStart(iso);
        setDraftEnd(curStart);
        draftStartRef.current = iso;
        draftEndRef.current = curStart;
      } else {
        setDraftEnd(iso);
        draftEndRef.current = iso;
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const finishDrag = () => {
      if (!isDraggingRef.current) return;
      const anchor = dragAnchorRef.current;
      const movedToOther = hasDraggedRef.current;
      isDraggingRef.current = false;
      hasDraggedRef.current = false;
      dragAnchorRef.current = null;

      if (!anchor) return;

      if (movedToOther) {
        // Finished dragging a range across dates 1-30
        setActiveSlot('end');
        activeSlotRef.current = 'end';
      } else {
        // Single click/tap on a date cell in the 1-30 calendar
        applySingleDateToSlot(activeSlotRef.current, anchor);
      }
    };

    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [isOpen]);

  const availableSet = useMemo(
    () => new Set(availableDates),
    [availableDates]
  );

  const monthDaysList = useMemo(() => {
    const [yStr, mStr] = monthKey.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    if (!year || !month) return [];

    const daysInMonth = new Date(year, month, 0).getDate();
    const list: { day: number; iso: string; weekdayName: string }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      list.push({
        day: d,
        iso: `${monthKey}-${String(d).padStart(2, '0')}`,
        weekdayName: FULL_WEEKDAYS_ID[dateObj.getDay()] || '',
      });
    }
    return list;
  }, [monthKey]);

  const calendarCells = useMemo(() => {
    const [yStr, mStr] = monthKey.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    if (!year || !month) return [];

    const firstWeekdaySun0 = new Date(year, month - 1, 1).getDay();
    const leadingBlanks = (firstWeekdaySun0 + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();

    const cells: ({ day: number; iso: string } | null)[] = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        iso: `${monthKey}-${String(d).padStart(2, '0')}`,
      });
    }
    return cells;
  }, [monthKey]);

  const matchingDraftDays = useMemo(() => {
    if (!draftStart || !draftEnd) return 0;
    const s = draftStart <= draftEnd ? draftStart : draftEnd;
    const e = draftStart <= draftEnd ? draftEnd : draftStart;
    return availableDates.filter((d) => d >= s && d <= e).length;
  }, [availableDates, draftStart, draftEnd]);

  if (!isOpen) return null;

  // Klik 1x = Aktifkan kartu (tutup list jika sedang terbuka di kartu lain)
  // Klik 2x (dalam 500ms di HP atau laptop) = Munculkan List Tanggal untuk kartu tersebut
  const handleCardTap = (slot: 'start' | 'end') => {
    const now = Date.now();
    const isDoubleTap =
      lastTapRef.current.slot === slot &&
      now - lastTapRef.current.time > 0 &&
      now - lastTapRef.current.time <= 500;

    setActiveSlot(slot);
    activeSlotRef.current = slot;

    if (isDoubleTap) {
      lastTapRef.current = { slot, time: 0 };
      setListOpenSlot((prev) => (prev === slot ? null : slot));
    } else {
      lastTapRef.current = { slot, time: now };
      if (listOpenSlot && listOpenSlot !== slot) {
        setListOpenSlot(null);
      }
    }
  };

  const handleSelectFromDateList = (slot: 'start' | 'end', iso: string) => {
    applySingleDateToSlot(slot, iso);
    setListOpenSlot(null);
  };

  const handleCellPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    iso: string
  ) => {
    e.preventDefault();
    if (listOpenSlot) setListOpenSlot(null);
    dragAnchorRef.current = iso;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
  };

  const handleGridPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !dragAnchorRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el?.closest('[data-date]');
    const targetIso = cell?.getAttribute('data-date');
    if (!targetIso) return;

    const anchor = dragAnchorRef.current;
    if (targetIso !== anchor) {
      hasDraggedRef.current = true;
    }
    if (hasDraggedRef.current) {
      const nextStart = anchor <= targetIso ? anchor : targetIso;
      const nextEnd = anchor <= targetIso ? targetIso : anchor;
      setDraftStart(nextStart);
      setDraftEnd(nextEnd);
      draftStartRef.current = nextStart;
      draftEndRef.current = nextEnd;
    }
  };

  const monthIdx = allMonths.indexOf(monthKey);
  const totalDaysInMonth = monthDaysList.length || 30;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="date-range-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs"
      onClick={() => onOpenChange(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-[#1E355D] rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
      >
        {/* Pop-up Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-[#1E355D] bg-slate-50/80 dark:bg-[#081226] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/35 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <CalendarRange className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="date-range-modal-title"
                className="text-base font-extrabold text-slate-900 dark:text-white truncate"
              >
                Pilih Rentang Tanggal
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Klik 1x kartu untuk aktifkan · Klik 2x kartu untuk buka list tanggal
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

        {/* Pop-up Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5">
          {/* 2 Kartu: 1. Dari Tanggal Mulai (Emas) & 2. Sampai Tanggal Akhir (Biru Toska) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* KARTU 1: Dari Tanggal Mulai (Warna Amber / Gold) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => handleCardTap('start')}
                className={`w-full group text-left p-3 sm:p-3.5 rounded-2xl border-2 transition-all select-none cursor-pointer ${
                  activeSlot === 'start'
                    ? 'border-amber-400 bg-gradient-to-br from-amber-50 via-amber-50/70 to-white dark:from-[#261E0D] dark:via-[#191A2E] dark:to-[#0E1A32] ring-2 ring-amber-400/35 shadow-md shadow-amber-500/10'
                    : 'border-amber-300/60 dark:border-amber-500/30 bg-white dark:bg-[#0D1A32] hover:border-amber-400/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-xs shrink-0" />
                    <span>1. Dari Tanggal Mulai</span>
                  </span>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md transition-colors ${
                      activeSlot === 'start'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-amber-100/80 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {activeSlot === 'start' ? 'Aktif' : 'Klik 1x Aktif'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                    {draftStart ? formatDateId(draftStart) : '-'}
                  </div>
                  <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400 shrink-0">
                    <CalendarDays className="w-4 h-4" />
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${
                        listOpenSlot === 'start' ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>

                <div className="mt-1 text-[10px] text-amber-800/80 dark:text-amber-300/80 font-medium">
                  {listOpenSlot === 'start'
                    ? 'List tanggal terbuka · Pilih tanggal mulai'
                    : 'Klik 1x aktif · Klik 2x buka list tanggal'}
                </div>
              </button>
            </div>

            {/* KARTU 2: Sampai Tanggal Akhir (Warna Berbeda: Cyan / Biru Toska) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => handleCardTap('end')}
                className={`w-full group text-left p-3 sm:p-3.5 rounded-2xl border-2 transition-all select-none cursor-pointer ${
                  activeSlot === 'end'
                    ? 'border-cyan-400 bg-gradient-to-br from-cyan-50 via-sky-50/70 to-white dark:from-[#092534] dark:via-[#0D213A] dark:to-[#0E1A32] ring-2 ring-cyan-400/35 shadow-md shadow-cyan-500/10'
                    : 'border-cyan-300/60 dark:border-cyan-500/30 bg-white dark:bg-[#0D1A32] hover:border-cyan-400/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-xs shrink-0" />
                    <span>2. Sampai Tanggal Akhir</span>
                  </span>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md transition-colors ${
                      activeSlot === 'end'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-cyan-100/80 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300'
                    }`}
                  >
                    {activeSlot === 'end' ? 'Aktif' : 'Klik 1x Aktif'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                    {draftEnd ? formatDateId(draftEnd) : '-'}
                  </div>
                  <div className="flex items-center gap-1 text-cyan-500 dark:text-cyan-400 shrink-0">
                    <CalendarDays className="w-4 h-4" />
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${
                        listOpenSlot === 'end' ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>

                <div className="mt-1 text-[10px] text-cyan-800/80 dark:text-cyan-300/80 font-medium">
                  {listOpenSlot === 'end'
                    ? 'List tanggal terbuka · Pilih tanggal akhir'
                    : 'Klik 1x aktif · Klik 2x buka list tanggal'}
                </div>
              </button>
            </div>
          </div>

          {/* LIST TANGGAL (Muncul saat Kartu 1 atau Kartu 2 di-klik 2x) */}
          {listOpenSlot && (
            <div
              className={`rounded-2xl border-2 overflow-hidden shadow-lg transition-all ${
                listOpenSlot === 'start'
                  ? 'border-amber-400 bg-amber-50/40 dark:bg-[#191710]'
                  : 'border-cyan-400 bg-cyan-50/40 dark:bg-[#091E2C]'
              }`}
            >
              <div
                className={`px-3.5 py-2.5 flex items-center justify-between gap-2 border-b ${
                  listOpenSlot === 'start'
                    ? 'bg-amber-100/80 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-950 dark:text-amber-200'
                    : 'bg-cyan-100/80 dark:bg-cyan-500/15 border-cyan-200 dark:border-cyan-500/30 text-cyan-950 dark:text-cyan-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-extrabold">
                  <ListFilter className="w-4 h-4 shrink-0" />
                  <span>
                    List Tanggal{' '}
                    {listOpenSlot === 'start'
                      ? 'Mulai (Kartu 1)'
                      : 'Akhir (Kartu 2)'}{' '}
                    — 1 s/d {totalDaysInMonth} {formatMonthId(monthKey)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setListOpenSlot(null)}
                  className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 hover:bg-white cursor-pointer"
                >
                  Tutup List
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-200/70 dark:divide-[#1E355D]/60 bg-white dark:bg-[#0D1A32]">
                {monthDaysList.map(({ day, iso, weekdayName }) => {
                  const hasData = availableSet.has(iso);
                  const isSelected =
                    listOpenSlot === 'start'
                      ? iso === draftStart
                      : iso === draftEnd;

                  return (
                    <button
                      key={`list-${iso}`}
                      type="button"
                      onClick={() =>
                        handleSelectFromDateList(listOpenSlot, iso)
                      }
                      className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isSelected
                          ? listOpenSlot === 'start'
                            ? 'bg-amber-400/25 dark:bg-amber-500/25 font-extrabold text-slate-950 dark:text-white'
                            : 'bg-cyan-400/25 dark:bg-cyan-500/25 font-extrabold text-slate-950 dark:text-white'
                          : 'hover:bg-slate-100 dark:hover:bg-[#15284A] text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black tabular-nums shrink-0 ${
                            isSelected
                              ? listOpenSlot === 'start'
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-cyan-400 text-slate-950'
                              : hasData
                              ? 'bg-slate-100 dark:bg-[#16294C] text-slate-900 dark:text-white'
                              : 'bg-slate-50 dark:bg-[#0A1428] text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {day}
                        </span>
                        <div className="truncate">
                          <span className="text-xs sm:text-sm font-bold">
                            {formatDateId(iso)}
                          </span>
                          <span className="ml-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                            ({weekdayName})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {hasData ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Ada Data
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            Kosong
                          </span>
                        )}
                        {isSelected && (
                          <Check className="w-4 h-4 text-slate-900 dark:text-white stroke-[2.5]" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* KALENDER RENTANG TANGGAL 1 - 30/31 (TETAP ADA / SELALU TAMPIL) */}
          <div className="rounded-2xl p-3.5 sm:p-4 bg-slate-50/90 dark:bg-[#081226] border border-slate-200 dark:border-[#1E355D] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {allMonths.length > 1 && onSelectMonth && (
                  <button
                    type="button"
                    disabled={monthIdx <= 0}
                    onClick={() => {
                      if (monthIdx > 0) onSelectMonth(allMonths[monthIdx - 1]);
                    }}
                    aria-label="Bulan sebelumnya"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1F3763] text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {formatMonthId(monthKey)} (Tanggal 1–{totalDaysInMonth})
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tarik atau klik tanggal{' '}
                    <strong className="text-amber-600 dark:text-amber-400">
                      Mulai (Emas)
                    </strong>{' '}
                    ke{' '}
                    <strong className="text-cyan-600 dark:text-cyan-300">
                      Akhir (Biru Toska)
                    </strong>
                  </p>
                </div>
                {allMonths.length > 1 && onSelectMonth && (
                  <button
                    type="button"
                    disabled={monthIdx < 0 || monthIdx >= allMonths.length - 1}
                    onClick={() => {
                      if (monthIdx >= 0 && monthIdx < allMonths.length - 1) {
                        onSelectMonth(allMonths[monthIdx + 1]);
                      }
                    }}
                    aria-label="Bulan berikutnya"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1F3763] text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Indikator Tanggal Mulai vs Akhir */}
              <div className="flex items-center gap-1.5 text-[11px] font-bold shrink-0">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-500/35 tabular-nums">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>{draftStart ? Number(draftStart.slice(8)) : '-'}</span>
                </span>
                <span className="text-slate-400">–</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-500/20 text-cyan-900 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-500/35 tabular-nums">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>{draftEnd ? Number(draftEnd.slice(8)) : '-'}</span>
                </span>
              </div>
            </div>

            {/* Grid Tanggal 1 - 30/31 */}
            <div className="space-y-1.5 select-none">
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS_ID.map((w) => (
                  <div
                    key={w}
                    className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-1"
                  >
                    {w}
                  </div>
                ))}
              </div>

              <div
                onPointerMove={handleGridPointerMove}
                className="grid grid-cols-7 gap-y-1.5 touch-none"
              >
                {calendarCells.map((cell, idx) => {
                  if (!cell) {
                    return <div key={`blank-${idx}`} className="h-10 sm:h-11" />;
                  }

                  const { day, iso } = cell;
                  const hasData = availableSet.has(iso);
                  const isStart = Boolean(draftStart && iso === draftStart);
                  const isEnd = Boolean(draftEnd && iso === draftEnd);
                  const isBetween = Boolean(
                    draftStart &&
                      draftEnd &&
                      iso > draftStart &&
                      iso < draftEnd
                  );

                  return (
                    <button
                      key={iso}
                      type="button"
                      data-date={iso}
                      onPointerDown={(e) => handleCellPointerDown(e, iso)}
                      className={`relative h-10 sm:h-11 flex flex-col items-center justify-center text-xs sm:text-sm tabular-nums transition-all cursor-pointer ${
                        isStart && isEnd
                          ? 'rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-cyan-400 text-slate-950 font-black shadow-md ring-2 ring-amber-300 z-10'
                          : isStart
                          ? 'rounded-l-xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-300 z-10'
                          : isEnd
                          ? 'rounded-r-xl bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950 font-black shadow-md ring-2 ring-cyan-300 z-10'
                          : isBetween
                          ? 'bg-gradient-to-r from-amber-400/20 via-teal-400/20 to-cyan-400/25 text-slate-900 dark:text-white font-bold border-y border-cyan-400/35'
                          : hasData
                          ? 'rounded-xl bg-white dark:bg-[#0D1A32] text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-[#16294C]'
                          : 'rounded-xl text-slate-400 dark:text-slate-600 hover:bg-slate-100/70 dark:hover:bg-[#132548]/50'
                      }`}
                    >
                      <span className="leading-none">{day}</span>
                      {isStart && !isEnd ? (
                        <span className="text-[8px] font-extrabold uppercase leading-none mt-0.5 text-slate-950">
                          Mulai
                        </span>
                      ) : isEnd && !isStart ? (
                        <span className="text-[8px] font-extrabold uppercase leading-none mt-0.5 text-slate-950">
                          Akhir
                        </span>
                      ) : isStart && isEnd ? (
                        <span className="text-[8px] font-extrabold uppercase leading-none mt-0.5 text-slate-950">
                          1 Hr
                        </span>
                      ) : hasData ? (
                        <span className="w-1.5 h-1.5 rounded-full mt-1 bg-emerald-500 dark:bg-emerald-400" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Pop-up Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-100 dark:border-[#1E355D] bg-slate-50/80 dark:bg-[#081226] flex items-center justify-between gap-3 shrink-0">
          <div className="space-y-0.5">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
              {formatDateRangeLabel(draftStart, draftEnd)}
            </div>
            <div
              className={`text-[11px] font-medium ${
                matchingDraftDays > 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {matchingDraftDays > 0
                ? `${matchingDraftDays} hari ada data Excel`
                : 'Belum ada file Excel di rentang ini'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftStart(normAppliedStart);
                setDraftEnd(normAppliedEnd);
                onOpenChange(false);
              }}
              className="btn-3d-soft px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-700 dark:text-slate-200 min-h-[40px] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                const s = draftStart <= draftEnd ? draftStart : draftEnd;
                const e = draftStart <= draftEnd ? draftEnd : draftStart;
                onConfirm(s, e);
                onOpenChange(false);
              }}
              className="btn-3d-primary px-5 py-2 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-1.5 min-h-[40px] cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Oke</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
