import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Trash2, Upload, X } from 'lucide-react';
import { formatDateId, formatMonthId } from '../lib/stockOpname';
import {
  PlReport,
  PlStore,
  findLine,
  findNetProfitLine,
  formatDeltaPoints,
  formatPct,
  formatSignedRupiah,
  lineKey,
  loadPlStore,
  parseProfitLossBuffer,
  pctOfNetSales,
  savePlStore,
  upsertReport,
} from '../lib/profitLoss';

interface Status {
  text: string;
  isError?: boolean;
}

export function ProfitLossPage() {
  const [store, setStore] = useState<PlStore>(() => loadPlStore());
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const reports = useMemo(() => Object.values(store), [store]);

  const outlets = useMemo(
    () => Array.from(new Set(reports.map((r) => r.outlet))).sort(),
    [reports]
  );
  const activeOutlet = outlets.includes(selectedOutlet)
    ? selectedOutlet
    : outlets[0] ?? '';

  const months = useMemo(
    () =>
      reports
        .filter((r) => r.outlet === activeOutlet)
        .map((r) => r.month)
        .sort(),
    [reports, activeOutlet]
  );
  const activeMonth = months.includes(selectedMonth)
    ? selectedMonth
    : months[months.length - 1] ?? '';

  const report: PlReport | undefined = store[`${activeOutlet}|${activeMonth}`];

  const prevReport: PlReport | undefined = useMemo(() => {
    const idx = months.indexOf(activeMonth);
    if (idx <= 0) return undefined;
    return store[`${activeOutlet}|${months[idx - 1]}`];
  }, [months, activeMonth, activeOutlet, store]);

  const prevPctMap = useMemo(() => {
    const map = new Map<string, number | null>();
    if (!prevReport) return map;
    for (const l of prevReport.lines) {
      map.set(lineKey(l), pctOfNetSales(l.value, prevReport.netSales));
    }
    return map;
  }, [prevReport]);

  const handleFile = async (file: File) => {
    setStatus({ text: 'Sedang membaca file laba rugi...' });
    try {
      const parsed = parseProfitLossBuffer(await file.arrayBuffer());
      const { next, status: result, shorterPeriod } = upsertReport(store, parsed);
      setStore(next);
      setSelectedOutlet(parsed.outlet);
      setSelectedMonth(parsed.month);
      const saved = savePlStore(next);
      const label = formatMonthId(parsed.month);
      const range = `${formatDateId(parsed.periodStart)} - ${formatDateId(
        parsed.periodEnd
      )}`;
      let text =
        result === 'new'
          ? `Bulan baru ${label} ditambahkan (periode ${range}).`
          : `Data ${label} diperbarui dengan file terbaru (periode ${range}).`;
      if (shorterPeriod) {
        text +=
          ' Perhatian: periode file ini lebih pendek dari data sebelumnya.';
      }
      if (!saved) {
        text =
          'Gagal menyimpan: penyimpanan browser penuh atau diblokir. Data hanya tampil sementara.';
      }
      setStatus({ text, isError: !saved || shorterPeriod });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Format file tidak sesuai.';
      setStatus({
        text: `Gagal membaca file: ${message}. Pastikan file adalah Profit Loss Consolidation Report (.xlsx / .xls).`,
        isError: true,
      });
    }
  };

  const handleDelete = () => {
    if (!report) return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setDeleteArmed(false), 4000);
      return;
    }
    setDeleteArmed(false);
    const next = { ...store };
    delete next[report.id];
    setStore(next);
    savePlStore(next);
    setSelectedMonth('');
    setStatus({ text: `Data ${formatMonthId(report.month)} dihapus.` });
  };

  const kpis = useMemo(() => {
    if (!report) return [];
    const items: { label: string; line?: ReturnType<typeof findLine> }[] = [
      { label: 'COGS', line: findLine(report, 'Total Cost of Goods Sold') },
      { label: 'Gross Profit', line: findLine(report, 'Gross Profit') },
      {
        label: 'Biaya Operasional',
        line: findLine(report, 'Total Operational Expense'),
      },
      { label: 'Net Profit', line: findNetProfitLine(report) },
    ];
    return items.filter((i) => i.line);
  }, [report]);

  const showDelta = prevPctMap.size > 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />

      <section className="surface-3d rounded-3xl p-5 sm:p-7 space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Laba Rugi (% dari Net Sales)
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Upload Profit Loss Consolidation Report (.xlsx). Setiap baris
            dibagi Net Sales lalu ditampilkan dalam persen. Bulan yang sama
            akan diperbarui, bulan berbeda otomatis menjadi data bulan baru.
          </p>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
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
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`border-2 border-dashed rounded-2xl px-4 py-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
              : 'border-slate-300 dark:border-[#1C3259] hover:border-amber-400'
          }`}
        >
          <FileSpreadsheet className="w-8 h-8 mx-auto text-amber-500" />
          <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Klik atau tarik file Profit Loss ke sini
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Contoh: Profit_Loss_Consolidation_Report_*.xlsx
          </p>
          <span className="mt-3 inline-flex btn-3d-primary px-4 py-2 text-sm font-bold rounded-xl items-center gap-1.5">
            <Upload className="w-4 h-4" />
            Pilih File
          </span>
        </div>

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
      </section>

      {!report ? (
        <section className="surface-3d rounded-3xl p-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Belum ada data laba rugi. Upload file untuk mulai.
        </section>
      ) : (
        <>
          <section className="surface-3d rounded-3xl p-5 sm:p-7 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {outlets.length > 1 && (
                <select
                  value={activeOutlet}
                  onChange={(e) => {
                    setSelectedOutlet(e.target.value);
                    setSelectedMonth('');
                  }}
                  className="px-3 py-2 text-sm font-semibold rounded-xl border border-slate-300 dark:border-[#1C3259] bg-white dark:bg-[#0b172e] text-slate-800 dark:text-slate-100"
                  aria-label="Pilih outlet"
                >
                  {outlets.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )}
              {months.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMonth(m)}
                  className={`px-3 py-2 text-sm font-semibold rounded-xl cursor-pointer min-h-[40px] ${
                    m === activeMonth
                      ? 'btn-3d-primary'
                      : 'btn-3d-soft text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {formatMonthId(m)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {report.outlet}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Periode {formatDateId(report.periodStart)} -{' '}
                  {formatDateId(report.periodEnd)} · diupload{' '}
                  {new Date(report.uploadedAt).toLocaleString('id-ID')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDelete}
                className="btn-3d-soft px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 text-red-600 dark:text-red-400 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                {deleteArmed ? 'Klik lagi untuk hapus' : 'Hapus bulan ini'}
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="wizzmie-glass-card rounded-2xl p-4 col-span-2 lg:col-span-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Net Sales
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                  Rp {formatSignedRupiah(report.netSales)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  = 100,00%
                </p>
              </div>
              {kpis.map((k) => (
                <div
                  key={k.label}
                  className="wizzmie-glass-card rounded-2xl p-4"
                >
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {k.label}
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                    {formatPct(pctOfNetSales(k.line!.value, report.netSales))}
                  </p>
                  <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    Rp {formatSignedRupiah(k.line!.value)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-3d rounded-3xl p-3 sm:p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1C3259]">
                    <th className="py-2 pr-3 font-semibold">Description</th>
                    <th className="py-2 pr-3 font-semibold text-right">
                      Nilai (Rp)
                    </th>
                    <th className="py-2 pr-3 font-semibold text-right">
                      % Net Sales
                    </th>
                    {showDelta && (
                      <th className="py-2 font-semibold text-right whitespace-nowrap">
                        vs bln lalu (poin)
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.lines.map((l, i) => {
                    const p = pctOfNetSales(l.value, report.netSales);
                    const prevP = prevPctMap.get(lineKey(l));
                    const delta =
                      p !== null && prevP !== undefined && prevP !== null
                        ? p - prevP
                        : null;
                    const barWidth =
                      p === null ? 0 : Math.min(100, Math.abs(p));
                    return (
                      <tr
                        key={`${l.account}-${l.description}-${i}`}
                        className={`border-b border-slate-100 dark:border-[#14264a] ${
                          l.isTotal
                            ? 'font-bold bg-amber-50/70 dark:bg-amber-500/10 text-slate-900 dark:text-white'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <td className="py-2 pr-3">
                          <div>{l.description}</div>
                          {l.account && (
                            <div className="text-[10px] font-normal text-slate-400">
                              {l.account}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">
                          {formatSignedRupiah(l.value)}
                        </td>
                        <td className="py-2 pr-3 text-right whitespace-nowrap">
                          <div className="tabular-nums">{formatPct(p)}</div>
                          <div className="mt-1 h-1 rounded-full bg-slate-200 dark:bg-[#14264a] overflow-hidden ml-auto w-20">
                            <div
                              className={`h-full rounded-full ${
                                p !== null && p < 0
                                  ? 'bg-red-400'
                                  : 'bg-amber-400'
                              }`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </td>
                        {showDelta && (
                          <td className="py-2 text-right tabular-nums whitespace-nowrap text-slate-500 dark:text-slate-400">
                            {formatDeltaPoints(delta)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
