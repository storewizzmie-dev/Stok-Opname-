import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Sparkles,
  X,
} from 'lucide-react';
import {
  formatDateId,
  formatDateRangeLabel,
  formatMonthId,
} from '../lib/stockOpname';

interface DateRangePickerProps {
  monthKey: string;
  availableDates: string[];
  rangeStart: string;
  rangeEnd: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  onConfirm: (start: string, end: string) => void;
}

interface QuickPreset {
  id: string;
  label: string;
  sublabel: string;
  start: string;
  end: string;
}

export function DateRangePicker({
  monthKey,
  availableDates,
  rangeStart,
  rangeEnd,
  isOpen,
  onToggleOpen,
  onClose,
  onConfirm,
}: DateRangePickerProps) {
  const daysInMonth = useMemo(() => {
    const [yStr, mStr] = monthKey.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    if (!year || !month) return 31;
    return new Date(year, month, 0).getDate();
  }, [monthKey]);

  const makeIso = (dayNum: number) => {
    const clamped = Math.max(1, Math.min(daysInMonth, dayNum));
    return `${monthKey}-${String(clamped).padStart(2, '0')}`;
  };

  const normAppliedStart = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
  const normAppliedEnd = rangeStart <= rangeEnd ? rangeEnd : rangeStart;

  const [draftStart, setDraftStart] = useState(normAppliedStart);
  const [draftEnd, setDraftEnd] = useState(normAppliedEnd);
  const [activeSlot, setActiveSlot] = useState<'start' | 'end'>('start');

  useEffect(() => {
    const s = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
    const e = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
    setDraftStart(s);
    setDraftEnd(e);
    setActiveSlot('start');
  }, [isOpen, monthKey, rangeStart, rangeEnd]);

  const availableSet = useMemo(
    () => new Set(availableDates),
    [availableDates]
  );

  const presets = useMemo<QuickPreset[]>(() => {
    const sorted = [...availableDates].sort();
    const lastAvailDay = sorted.length
      ? Number(sorted[sorted.length - 1].slice(8))
      : daysInMonth;

    const last7Start = Math.max(1, lastAvailDay - 6);
    const last14Start = Math.max(1, lastAvailDay - 13);

    return [
      {
        id: 'p1-15',
        label: 'Tgl 1 – 15',
        sublabel: 'Paruh Pertama',
        start: makeIso(1),
        end: makeIso(Math.min(15, daysInMonth)),
      },
      {
        id: 'p16-end',
        label: `Tgl 16 – ${daysInMonth}`,
        sublabel: 'Paruh Kedua',
        start: makeIso(Math.min(16, daysInMonth)),
        end: makeIso(daysInMonth),
      },
      {
        id: 'w1',
        label: 'Tgl 1 – 7',
        sublabel: 'Minggu 1',
        start: makeIso(1),
        end: makeIso(Math.min(7, daysInMonth)),
      },
      {
        id: 'w2',
        label: 'Tgl 8 – 15',
        sublabel: 'Minggu 2',
        start: makeIso(Math.min(8, daysInMonth)),
        end: makeIso(Math.min(15, daysInMonth)),
      },
      {
        id: 'w3',
        label: 'Tgl 16 – 23',
        sublabel: 'Minggu 3',
        start: makeIso(Math.min(16, daysInMonth)),
        end: makeIso(Math.min(23, daysInMonth)),
      },
      {
        id: 'w4',
        label: `Tgl 24 – ${daysInMonth}`,
        sublabel: 'Minggu 4',
        start: makeIso(Math.min(24, daysInMonth)),
        end: makeIso(daysInMonth),
      },
      {
        id: 'last7',
        label: '7 Hari Terakhir',
        sublabel: `Tgl ${last7Start} – ${lastAvailDay}`,
        start: makeIso(last7Start),
        end: makeIso(lastAvailDay),
      },
      {
        id: 'last14',
        label: '14 Hari Terakhir',
        sublabel: `Tgl ${last14Start} – ${lastAvailDay}`,
        start: makeIso(last14Start),
        end: makeIso(lastAvailDay),
      },
    ];
  }, [availableDates, daysInMonth, monthKey]);

  const draftStartNum = Number(draftStart.slice(8)) || 1;
  const draftEndNum = Number(draftEnd.slice(8)) || daysInMonth;

  const matchingDraftDays = useMemo(() => {
    if (!draftStart || !draftEnd) return 0;
    const s = draftStart <= draftEnd ? draftStart : draftEnd;
    const e = draftStart <= draftEnd ? draftEnd : draftStart;
    return availableDates.filter((d) => d >= s && d <= e).length;
  }, [availableDates, draftStart, draftEnd]);

  const appliedMatchingDays = useMemo(() => {
    if (!normAppliedStart || !normAppliedEnd) return 0;
    return availableDates.filter(
      (d) => d >= normAppliedStart && d <= normAppliedEnd
    ).length;
  }, [availableDates, normAppliedStart, normAppliedEnd]);

  const setNormalizedDraft = (rawA: string, rawB: string) => {
    if (rawA <= rawB) {
      setDraftStart(rawA);
      setDraftEnd(rawB);
    } else {
      setDraftStart(rawB);
      setDraftEnd(rawA);
    }
  };

  const handlePickDayPill = (dayNum: number) => {
    const iso = makeIso(dayNum);
    if (activeSlot === 'start') {
      if (iso > draftEnd) {
        setDraftStart(iso);
        setDraftEnd(iso);
      } else {
        setDraftStart(iso);
      }
      setActiveSlot('end');
    } else {
      if (iso < draftStart) {
        setDraftStart(iso);
        setDraftEnd(draftStart);
      } else {
        setDraftEnd(iso);
      }
      setActiveSlot('start');
    }
  };

  const shiftStartDay = (delta: number) => {
    const next = Math.max(1, Math.min(draftEndNum, draftStartNum + delta));
    setDraftStart(makeIso(next));
  };

  const shiftEndDay = (delta: number) => {
    const next = Math.max(
      draftStartNum,
      Math.min(daysInMonth, draftEndNum + delta)
    );
    setDraftEnd(makeIso(next));
  };

  const sliderLeftPct =
    daysInMonth > 1 ? ((draftStartNum - 1) / (daysInMonth - 1)) * 100 : 0;
  const sliderRightPct =
    daysInMonth > 1
      ? ((daysInMonth - draftEndNum) / (daysInMonth - 1)) * 100
      : 0;

  return (
    <div className="space-y-2.5 w-full">
      {/* Baris Tombol Utama + Shortcut Cepat 1-Klik */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={isOpen}
          className={`inline-flex items-center justify-between gap-2.5 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl border transition-all min-h-[42px] cursor-pointer ${
            isOpen
              ? 'border-amber-400 bg-amber-50/95 dark:bg-[#152A52] text-slate-900 dark:text-white ring-2 ring-amber-400/40 shadow-sm'
              : 'border-amber-400/60 dark:border-amber-500/40 bg-white dark:bg-[#0F2244] text-slate-900 dark:text-slate-100 hover:border-amber-400 shadow-xs'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <CalendarRange className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate tabular-nums">
              {formatDateRangeLabel(normAppliedStart, normAppliedEnd)}
            </span>
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300 shrink-0 tabular-nums">
              {appliedMatchingDays} hr
            </span>
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>

        {/* Quick Preset Chips langsung di luar agar bisa 1-klik ganti periode */}
        {presets.slice(0, 4).map((p) => {
          const isCurrent =
            normAppliedStart === p.start && normAppliedEnd === p.end;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setDraftStart(p.start);
                setDraftEnd(p.end);
                onConfirm(p.start, p.end);
              }}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all min-h-[40px] whitespace-nowrap cursor-pointer ${
                isCurrent
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold border-amber-400 shadow-xs'
                  : 'bg-white/90 dark:bg-[#0D1C36] border-slate-200 dark:border-[#1C3259] text-slate-700 dark:text-slate-300 hover:border-amber-400/60'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Panel Modern Date Range Selector */}
      {isOpen && (
        <div className="surface-3d rounded-2xl p-4 sm:p-5 border border-amber-300/80 dark:border-amber-500/40 space-y-4 w-full max-w-xl shadow-xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-4 h-4" />
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Atur Rentang Tanggal · {formatMonthId(monthKey)}
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
                Pilih paket cepat di bawah, geser slider, atau ketuk angka tanggal mulai &amp; selesai lalu klik <strong>Terapkan</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pemilih rentang tanggal"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Paket Cepat (Quick Presets) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Pilihan Cepat</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {presets.map((p) => {
                const isSelected =
                  draftStart === p.start && draftEnd === p.end;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setDraftStart(p.start);
                      setDraftEnd(p.end);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-400/15 ring-2 ring-amber-400/35'
                        : 'border-slate-200 dark:border-[#1E355D] bg-slate-50/70 dark:bg-[#0A162B] hover:border-amber-400/60'
                    }`}
                  >
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">
                      {p.label}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {p.sublabel}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Dual Card Dari Tanggal & Sampai Tanggal dengan Stepper +/- & Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Dari Tanggal */}
            <div
              onClick={() => setActiveSlot('start')}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                activeSlot === 'start'
                  ? 'border-amber-400 bg-amber-50/50 dark:bg-[#13264A] ring-2 ring-amber-400/30'
                  : 'border-slate-200 dark:border-[#1E355D] bg-white dark:bg-[#0A162B]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  1. Dari Tanggal Mulai
                </span>
                {activeSlot === 'start' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                    Aktif
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    shiftStartDay(-1);
                  }}
                  disabled={draftStartNum <= 1}
                  aria-label="Kurangi tanggal mulai"
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-[#223C6A] bg-slate-50 dark:bg-[#0F2244] flex items-center justify-center text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <select
                  aria-label="Pilih tanggal mulai"
                  value={draftStart}
                  onChange={(e) =>
                    setNormalizedDraft(e.target.value, draftEnd)
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-center font-extrabold text-xs sm:text-sm bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer tabular-nums"
                >
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                    (d) => {
                      const iso = makeIso(d);
                      const has = availableSet.has(iso);
                      return (
                        <option
                          key={iso}
                          value={iso}
                          className="bg-white dark:bg-[#0F2244] text-slate-900 dark:text-white"
                        >
                          {formatDateId(iso)} {has ? '●' : ''}
                        </option>
                      );
                    }
                  )}
                </select>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    shiftStartDay(1);
                  }}
                  disabled={draftStartNum >= draftEndNum}
                  aria-label="Tambah tanggal mulai"
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-[#223C6A] bg-slate-50 dark:bg-[#0F2244] flex items-center justify-center text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sampai Tanggal */}
            <div
              onClick={() => setActiveSlot('end')}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                activeSlot === 'end'
                  ? 'border-amber-400 bg-amber-50/50 dark:bg-[#13264A] ring-2 ring-amber-400/30'
                  : 'border-slate-200 dark:border-[#1E355D] bg-white dark:bg-[#0A162B]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  2. Sampai Tanggal Akhir
                </span>
                {activeSlot === 'end' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                    Aktif
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    shiftEndDay(-1);
                  }}
                  disabled={draftEndNum <= draftStartNum}
                  aria-label="Kurangi tanggal akhir"
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-[#223C6A] bg-slate-50 dark:bg-[#0F2244] flex items-center justify-center text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <select
                  aria-label="Pilih tanggal akhir"
                  value={draftEnd}
                  onChange={(e) =>
                    setNormalizedDraft(draftStart, e.target.value)
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-center font-extrabold text-xs sm:text-sm bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer tabular-nums"
                >
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                    (d) => {
                      const iso = makeIso(d);
                      const has = availableSet.has(iso);
                      return (
                        <option
                          key={iso}
                          value={iso}
                          className="bg-white dark:bg-[#0F2244] text-slate-900 dark:text-white"
                        >
                          {formatDateId(iso)} {has ? '●' : ''}
                        </option>
                      );
                    }
                  )}
                </select>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    shiftEndDay(1);
                  }}
                  disabled={draftEndNum >= daysInMonth}
                  aria-label="Tambah tanggal akhir"
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-[#223C6A] bg-slate-50 dark:bg-[#0F2244] flex items-center justify-center text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 3. Slider Visual & Deretan Tombol Angka Tanggal (1 s/d Akhir Bulan) */}
          <div className="space-y-3 p-3.5 rounded-xl bg-slate-50/90 dark:bg-[#0A162B] border border-slate-200/80 dark:border-[#182C4C]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-200">
                Geser atau Ketuk Angka Tanggal (
                {activeSlot === 'start'
                  ? 'Pilih Tgl Mulai'
                  : 'Pilih Tgl Akhir'}
                )
              </span>
              <span className="font-mono font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">
                Tgl {draftStartNum} – {draftEndNum} (
                {draftEndNum - draftStartNum + 1} hr)
              </span>
            </div>

            {/* Dual Slider Bar */}
            <div className="space-y-2 pt-1">
              <div className="relative h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                  style={{
                    left: `${sliderLeftPct}%`,
                    right: `${sliderRightPct}%`,
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    Mulai: {draftStartNum}
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={daysInMonth}
                    value={draftStartNum}
                    aria-label="Slider tanggal mulai"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const iso = makeIso(val);
                      if (val > draftEndNum) {
                        setDraftStart(iso);
                        setDraftEnd(iso);
                      } else {
                        setDraftStart(iso);
                      }
                    }}
                    className="w-full accent-amber-500 cursor-pointer h-1.5"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    Akhir: {draftEndNum}
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={daysInMonth}
                    value={draftEndNum}
                    aria-label="Slider tanggal akhir"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const iso = makeIso(val);
                      if (val < draftStartNum) {
                        setDraftStart(iso);
                        setDraftEnd(iso);
                      } else {
                        setDraftEnd(iso);
                      }
                    }}
                    className="w-full accent-amber-500 cursor-pointer h-1.5"
                  />
                </div>
              </div>
            </div>

            {/* Number Pill Matrix (1..31) */}
            <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5 pt-1">
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                (dayNum) => {
                  const iso = makeIso(dayNum);
                  const hasData = availableSet.has(iso);
                  const isStart = dayNum === draftStartNum;
                  const isEnd = dayNum === draftEndNum;
                  const isInRange =
                    dayNum > draftStartNum && dayNum < draftEndNum;
                  const isEndpoint = isStart || isEnd;

                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => handlePickDayPill(dayNum)}
                      className={`relative h-9 rounded-lg font-mono text-xs flex flex-col items-center justify-center transition-all tabular-nums cursor-pointer ${
                        isEndpoint
                          ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-black shadow-sm scale-[1.03]'
                          : isInRange
                          ? 'bg-amber-400/20 dark:bg-amber-400/25 text-amber-950 dark:text-amber-100 font-bold border border-amber-400/40'
                          : hasData
                          ? 'bg-white dark:bg-[#0F2244] border border-slate-200 dark:border-[#1E355D] text-slate-900 dark:text-slate-100 font-semibold hover:border-amber-400'
                          : 'bg-slate-100/70 dark:bg-[#0D1A31]/50 text-slate-400 dark:text-slate-600 hover:bg-slate-200/60'
                      }`}
                    >
                      <span className="leading-none">{dayNum}</span>
                      {hasData && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                            isEndpoint
                              ? 'bg-slate-950'
                              : 'bg-emerald-500 dark:bg-emerald-400'
                          }`}
                        />
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                {formatDateRangeLabel(draftStart, draftEnd)}
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span
                  className={`font-semibold ${
                    matchingDraftDays > 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {matchingDraftDays > 0
                    ? `${matchingDraftDays} hari ada data Excel`
                    : 'Belum ada file Excel di rentang ini'}
                </span>
                <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Ada data
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-3d-soft px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl text-slate-700 dark:text-slate-200 min-h-[42px] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => onConfirm(draftStart, draftEnd)}
                className="btn-3d-primary px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-1.5 min-h-[42px] cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Terapkan (Oke)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
