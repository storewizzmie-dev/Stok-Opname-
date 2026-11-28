import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import {
  ArrowDownRight, ArrowUpRight, CalendarRange, ChevronDown, ChevronRight, ClipboardList, FileSpreadsheet,
  Info, Layers, MapPin, PackageSearch, Search, SlidersHorizontal, Tag,
} from 'lucide-react';
import {
  buildSelisihFormulaBreakdown, convertRowWithMeta, formatCompactContainerDiff, formatCompactRupiah, formatDateId,
  formatDateRangeFullLabel, formatMonthId, formatQty, formatQtyMap, formatRupiah, formatSignedQty,
  type ConvertedStockRow, type ProductStat, type StockDataset, type StockRow, type SummaryResult, type ViewScope,
} from '../../lib/stockOpname';
import { Sheet } from './Sheet';

/* ---------- helpers ---------- */
const sign = (v: number) => (v < -0.5 ? '−' : v > 0.5 ? '+' : '');
const rp = (v: number) => `${sign(v)}${formatCompactRupiah(Math.abs(v))}`;
const rpFull = (v: number) => `${sign(v)}Rp ${Math.abs(Math.round(v)).toLocaleString('id-ID')}`;
const tone = (v: number) => (v < -0.5 ? 'neg' : v > 0.5 ? 'pos' : 'zero');
const dayNum = (d: string) => Number(d.slice(8));
const DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const dow = (d: string) => DOW[new Date(`${d}T00:00:00`).getDay()] ?? '';
const ease = [0.2, 0.8, 0.2, 1] as const;

interface Rec { date: string; raw: StockRow; meta: ConvertedStockRow; row: StockRow }

function useCountUp(value: number, ms = 700) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}

function useRecords(data: StockDataset, dates: string[]) {
  return useMemo(() => {
    const out: Rec[] = [];
    for (const d of dates) for (const raw of data[d] ?? []) {
      const meta = convertRowWithMeta(raw);
      out.push({ date: d, raw, meta, row: meta.row });
    }
    return out;
  }, [data, dates]);
}

export interface StockViewProps {
  summary: SummaryResult;
  data: StockDataset;
  activeMonth: string;
  allMonths: string[];
  viewScope: ViewScope;
  activeDay: string;
  activeRange: { start: string; end: string };
  onSetScope: (s: ViewScope) => void;
  onSelectDay: (d: string) => void;
  onSelectMonth: (m: string) => void;
  onOpenRangePicker: () => void;
  onOpenInfo?: (k: 'harian' | 'cekBarang') => void;
}

function periodLabel(p: StockViewProps) {
  if (p.viewScope === 'day') return formatDateId(p.activeDay);
  if (p.viewScope === 'range') return formatDateRangeFullLabel(p.activeRange.start, p.activeRange.end);
  return formatMonthId(p.activeMonth);
}

/* ---------- small UI atoms ---------- */
function Seg<T extends string>({ id, value, options, onChange, full }: {
  id: string; value: T; options: readonly (readonly [T, string, number?])[]; onChange: (v: T) => void; full?: boolean;
}) {
  return (
    <LayoutGroup id={id}>
      <div className={`s3-seg ${full ? 'w-full' : ''}`}>
        {options.map(([k, l, n]) => (
          <button key={k} type="button" onClick={() => onChange(k)} className={`${full ? 'flex-1' : ''} ${value === k ? 'is-on' : ''}`}>
            {value === k && <motion.span layoutId="pill" className="s3-seg-pill" transition={{ type: 'spring', damping: 30, stiffness: 400 }} />}
            <span className="relative">{l}{n !== undefined && <em>{n}</em>}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}

function Section({ title, hint, right, children, collapsible, defaultOpen = true, className = '' }: {
  title: ReactNode; hint?: ReactNode; right?: ReactNode; children: ReactNode; collapsible?: boolean; defaultOpen?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.section className={`s3-card ${className}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
      <header className="s3-card-head">
        <button type="button" className="s3-card-title" onClick={() => collapsible && setOpen(!open)} disabled={!collapsible}>
          <span>{title}</span>
          {collapsible && <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />}
        </button>
        {right ?? (hint && <span className="s3-hint">{hint}</span>)}
      </header>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }} style={{ overflow: 'hidden' }}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function Field({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="s3-field">
      <dt>{label}</dt>
      <dd className={mono ? 's3-mono' : ''}>{children || '—'}</dd>
    </div>
  );
}

/* ---------- Date tape (period selector) ---------- */
function DateTape(p: StockViewProps & { maxNeg: number }) {
  const s = p.summary;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.is-on');
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [p.activeDay, p.viewScope]);
  const inRange = new Set(s.activeDates);
  return (
    <div className="s3-tape-wrap">
      <div className="s3-tape-top">
        <button type="button" className="s3-period" onClick={p.onOpenRangePicker}>
          <CalendarRange className="w-4 h-4" />
          <span className="truncate">{periodLabel(p)}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </button>
        {p.allMonths.length > 1 && (
          <select className="s3-select" value={p.activeMonth} onChange={(e) => p.onSelectMonth(e.target.value)} aria-label="Pilih bulan">
            {p.allMonths.map((m) => <option key={m} value={m}>{formatMonthId(m)}</option>)}
          </select>
        )}
      </div>
      <div className="s3-tape" ref={ref}>
        <button type="button" className={`s3-tape-all ${p.viewScope !== 'day' ? 'is-on' : ''}`} onClick={() => p.onSetScope('range')}>
          <b>Semua</b><small>{s.activeDates.length || s.allMonthDates.length} hari</small>
        </button>
        {s.allMonthDates.map((d) => {
          const st = s.dailyStats.find((x) => x.date === d);
          const h = st ? Math.max(6, (Math.abs(st.negVal) / p.maxNeg) * 100) : 0;
          const on = p.viewScope === 'day' && d === p.activeDay;
          return (
            <button key={d} type="button" className={`s3-tape-day ${on ? 'is-on' : ''} ${p.viewScope !== 'day' && inRange.has(d) ? 'is-range' : ''}`}
              onClick={() => { p.onSelectDay(d); p.onSetScope('day'); }}>
              <small>{dow(d)}</small>
              <b>{dayNum(d)}</b>
              <span className="s3-tape-meter"><i style={{ height: `${h}%` }} /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Summary ticket ---------- */
function SummaryTicket({ s, label, extra }: { s: SummaryResult; label: string; extra?: ReactNode }) {
  const net = useCountUp(s.netTotal);
  const accuracy = s.totalRowsCount ? Math.round((s.totalPasRowsCount / s.totalRowsCount) * 100) : 0;
  const tot = Math.abs(s.totalNeg) + s.totalPos || 1;
  const negPct = (Math.abs(s.totalNeg) / tot) * 100;
  return (
    <motion.section className="s3-ticket" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55, ease }}>
      <div className="s3-ticket-top">
        <div className="s3-eyebrow">Selisih bersih · {label}</div>
        <div className={`s3-big s3-t-${tone(s.netTotal)}`}>{rpFull(net)}</div>
        {(s.branchName || s.locationName) && (
          <div className="s3-sub">{[s.branchName, s.locationName].filter(Boolean).join(' · ')}</div>
        )}
      </div>
      <div className="s3-split">
        <motion.i className="s3-bg-neg" initial={{ width: 0 }} animate={{ width: `${negPct}%` }} transition={{ duration: 0.8, ease }} />
        <motion.i className="s3-bg-pos" initial={{ width: 0 }} animate={{ width: `${100 - negPct}%` }} transition={{ duration: 0.8, ease }} />
      </div>
      <div className="s3-split-legend">
        <span><ArrowDownRight className="w-3.5 h-3.5 s3-t-neg" /> Minus <b className="s3-t-neg">{rp(s.totalNeg)}</b> <small>{s.negProductCount} barang</small></span>
        <span className="text-right"><ArrowUpRight className="w-3.5 h-3.5 s3-t-pos" /> Lebih <b className="s3-t-pos">{rp(s.totalPos)}</b> <small>{s.posProductCount} barang</small></span>
      </div>
      <div className="s3-perf" />
      <dl className="s3-stats">
        <div><dt>Hari</dt><dd>{s.activeDates.length}</dd></div>
        <div><dt>Baris Excel</dt><dd>{s.totalRowsCount.toLocaleString('id-ID')}</dd></div>
        <div><dt>Akurasi</dt><dd>{accuracy}%</dd></div>
        <div><dt>Barang pas</dt><dd>{s.pasProductCount}</dd></div>
      </dl>
      {extra}
    </motion.section>
  );
}

/* ---------- Row detail (one Excel line) ---------- */
function RecordDetail({ rec }: { rec: Rec }) {
  const r = rec.row;
  const raw = rec.raw;
  const f = useMemo(() => buildSelisihFormulaBreakdown(rec.meta), [rec.meta]);
  const pack = formatCompactContainerDiff(r[4], r[1], r[0]);
  const pct = r[2] ? Math.min(100, (r[3] / Math.max(r[2], r[3], 1)) * 100) : 0;
  const pctSys = r[2] ? Math.min(100, (r[2] / Math.max(r[2], r[3], 1)) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className={`s3-detail-hero s3-edge-${tone(r[6])}`}>
        <div className="s3-eyebrow">Nilai selisih</div>
        <div className={`s3-big-sm s3-t-${tone(r[6])}`}>{rpFull(r[6])}</div>
        <div className="s3-sub">{formatSignedQty(r[4])} {r[1]}{pack ? ` · ${pack}` : ''} × {formatRupiah(r[5], false)}/{r[1]}</div>
      </div>

      <div className="s3-compare">
        <div><span>Sistem</span><b>{formatQty(r[2])} <small>{r[1]}</small></b><i><motion.em initial={{ width: 0 }} animate={{ width: `${pctSys}%` }} transition={{ duration: 0.6, ease }} /></i></div>
        <div><span>Fisik</span><b>{formatQty(r[3])} <small>{r[1]}</small></b><i><motion.em className={`s3-bg-${tone(r[4])}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: 0.1, ease }} /></i></div>
      </div>

      {(f.conversionSteps.length > 0 || f.wasConvertedFromFile) && (
        <div className="s3-formula">
          <div className="s3-eyebrow"><SlidersHorizontal className="w-3.5 h-3.5" /> Rumus konversi pack</div>
          <p className="s3-sub">Kemasan: {f.specText}</p>
          {f.wasConvertedFromFile && (
            <p className="s3-formula-line">Di Excel tercatat <b>{formatSignedQty(f.originalDiffQty)} {f.originalUnit}</b>, dikonversi ke <b>{formatSignedQty(r[4])} {r[1]}</b>.</p>
          )}
          {f.conversionSteps.map((st, i) => (
            <div key={i} className="s3-formula-step">
              <code>{st.formulaText}</code><b>= {st.resultText}</b>
              <small>{st.explanationText}</small>
            </div>
          ))}
        </div>
      )}

      <dl className="s3-fields">
        <Field label="No. Stock Opname" mono>{raw[10]}</Field>
        <Field label="Tanggal">{formatDateId(rec.date)}</Field>
        <Field label="Kode produk" mono>{raw[13]}</Field>
        <Field label="Status">{raw[15] && <span className="s3-pill">{raw[15]}</span>}</Field>
        <Field label="Kategori">{raw[8]}</Field>
        <Field label="Subkategori">{raw[14]}</Field>
        <Field label="Keperluan">{raw[12]}</Field>
        <Field label="Satuan Excel">{raw[1]}</Field>
        <Field label="Nilai per unit">{formatRupiah(raw[5], false)}</Field>
        <Field label="Selisih Excel">{formatSignedQty(raw[4])} {raw[1]}</Field>
        <Field label="Cabang">{raw[9]}</Field>
        <Field label="Lokasi">{raw[11]}</Field>
      </dl>
      {raw[7] && <div className="s3-note"><ClipboardList className="w-4 h-4" /> {raw[7]}</div>}
    </div>
  );
}

/* ---------- Product detail ---------- */
function ProductDetail({ ps, recs, onOpenRec }: { ps: ProductStat; recs: Rec[]; onOpenRec: (r: Rec) => void }) {
  const mine = useMemo(() => recs.filter((r) => r.row[0] === ps.name), [recs, ps.name]);
  const max = Math.max(1, ...mine.map((r) => Math.abs(r.row[6])));
  const net = useCountUp(ps.netVal);
  return (
    <div className="space-y-4">
      <div className={`s3-detail-hero s3-edge-${tone(ps.netVal)}`}>
        <div className="s3-eyebrow">Akumulasi selisih</div>
        <div className={`s3-big-sm s3-t-${tone(ps.netVal)}`}>{rpFull(net)}</div>
        <div className="s3-sub">{formatQtyMap(ps.qtyByUnit, ps.name, true) || '0'}</div>
      </div>
      <div className="s3-tri">
        <div><b className="s3-t-neg">{ps.negDays}</b><span>hari minus</span><small>{rp(ps.negVal)}</small></div>
        <div><b className="s3-t-pos">{ps.posDays}</b><span>hari lebih</span><small>{rp(ps.posVal)}</small></div>
        <div><b>{ps.pasDays}</b><span>hari pas</span><small>dari {ps.totalDays}</small></div>
      </div>

      <div className="s3-subcard">
        <div className="s3-card-head"><span className="s3-card-title">Grafik per tanggal</span><span className="s3-hint">{mine.length} catatan</span></div>
        <div className="s3-spark">
          {mine.map((r, i) => (
            <button type="button" key={r.date + i} onClick={() => onOpenRec(r)} title={`${formatDateId(r.date)} · ${rp(r.row[6])}`}>
              <span className="up"><motion.i initial={{ height: 0 }} animate={{ height: `${(Math.max(0, r.row[6]) / max) * 100}%` }} transition={{ duration: 0.5, delay: i * 0.02, ease }} /></span>
              <span className="dn"><motion.i initial={{ height: 0 }} animate={{ height: `${(Math.max(0, -r.row[6]) / max) * 100}%` }} transition={{ duration: 0.5, delay: i * 0.02, ease }} /></span>
              <small>{dayNum(r.date)}</small>
            </button>
          ))}
        </div>
      </div>

      <dl className="s3-fields">
        <Field label="Kode produk" mono>{ps.code}</Field>
        <Field label="Kategori">{ps.category}</Field>
        <Field label="Subkategori">{ps.subcategory}</Field>
        <Field label="Harga terakhir">{formatRupiah(ps.lastUnitPrice, false)}</Field>
        <Field label="Keperluan">{ps.purposes.join(', ')}</Field>
        <Field label="Lokasi">{ps.location}</Field>
      </dl>

      <div>
        <div className="s3-eyebrow mb-2">Catatan per tanggal · ketuk untuk rincian</div>
        <ul className="s3-ledger">
          {mine.slice().reverse().map((r, i) => (
            <motion.li key={r.date + i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
              <button type="button" className="s3-line" onClick={() => onOpenRec(r)}>
                <span className={`s3-line-edge s3-bg-${tone(r.row[6])}`} />
                <span className="s3-line-date"><b>{dayNum(r.date)}</b><small>{dow(r.date)}</small></span>
                <span className="s3-line-main">
                  <b className="s3-mono text-xs">{r.raw[10] || 'Tanpa nomor'}</b>
                  <small>Sistem {formatQty(r.row[2])} → Fisik {formatQty(r.row[3])} {r.row[1]}</small>
                </span>
                <span className="s3-line-val">
                  <b className={`s3-t-${tone(r.row[6])}`}>{rp(r.row[6])}</b>
                  <small className={`s3-t-${tone(r.row[4])}`}>{formatSignedQty(r.row[4])} {r.row[1]}</small>
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- Ledger list item ---------- */
interface Item { key: string; name: string; code: string; cat: string; sub: string; unit: string; purposes: string[];
  sys: number | null; fis: number | null; qtyText: string; packText: string; val: number; info: string; so: string; rec?: Rec }

function ItemLine({ it, i, onOpen }: { it: Item; i: number; onOpen: () => void }) {
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(i, 14) * 0.025, ease }}>
      <button type="button" className="s3-item" onClick={onOpen}>
        <span className={`s3-line-edge s3-bg-${tone(it.val)}`} />
        <span className="s3-item-main">
          <b>{it.name}</b>
          <small>
            {it.code && <span className="s3-mono">{it.code}</span>}
            {it.sub || it.cat ? <span>{it.sub || it.cat}</span> : null}
            {it.purposes[0] && <span>{it.purposes[0]}</span>}
          </small>
          {it.sys !== null && it.fis !== null && (
            <span className="s3-item-flow">
              <em>{formatQty(it.sys)}</em><ChevronRight className="w-3 h-3" /><em>{formatQty(it.fis)}</em> <small>{it.unit}</small>
            </span>
          )}
        </span>
        <span className="s3-item-val">
          <b className={`s3-t-${tone(it.val)}`}>{rp(it.val)}</b>
          <small className={`s3-t-${tone(it.val)}`}>{it.qtyText}</small>
          {it.packText && <small className="s3-pack">{it.packText}</small>}
        </span>
      </button>
    </motion.li>
  );
}

type Filt = 'diff' | 'neg' | 'pos' | 'pas' | 'all';
type Sort = 'minus' | 'plus' | 'abs' | 'name';
const passF = (f: Filt, v: number) => (f === 'neg' ? v < -0.5 : f === 'pos' ? v > 0.5 : f === 'pas' ? Math.abs(v) <= 0.5 : f === 'diff' ? Math.abs(v) > 0.5 : true);
const sorter = (s: Sort) => (a: Item, b: Item) => (s === 'minus' ? a.val - b.val : s === 'plus' ? b.val - a.val : s === 'abs' ? Math.abs(b.val) - Math.abs(a.val) : a.name.localeCompare(b.name));

function ItemToolbar({ q, setQ, sort, setSort, placeholder }: { q: string; setQ: (v: string) => void; sort: Sort; setSort: (s: Sort) => void; placeholder: string }) {
  return (
    <div className="s3-toolbar">
      <label className="s3-search"><Search className="w-4 h-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} /></label>
      <select className="s3-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Urutkan">
        <option value="minus">Minus terbesar</option>
        <option value="plus">Lebih terbesar</option>
        <option value="abs">Selisih terbesar</option>
        <option value="name">Nama A–Z</option>
      </select>
    </div>
  );
}

/* =================== HARIAN =================== */
export function HarianV2(p: StockViewProps) {
  const s = p.summary;
  const isDay = p.viewScope === 'day';
  const dates = useMemo(() => (isDay ? [p.activeDay] : s.activeDates), [isDay, p.activeDay, s.activeDates]);
  const recs = useRecords(p.data, dates);
  const allRecs = useRecords(p.data, s.allMonthDates);
  const maxNeg = Math.max(1, ...s.dailyStats.map((d) => Math.abs(d.negVal)));

  const [filter, setFilter] = useState<Filt>('diff');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('minus');
  const [purpose, setPurpose] = useState('');
  const [session, setSession] = useState('');
  const [limit, setLimit] = useState(60);
  const [openRec, setOpenRec] = useState<Rec | null>(null);
  const [openProd, setOpenProd] = useState<string>('');
  useEffect(() => { setSession(''); setLimit(60); }, [p.activeDay, p.viewScope]);

  const sessions = useMemo(() => {
    const m = new Map<string, { so: string; info: string; status: string; count: number; diff: number; val: number }>();
    for (const r of recs) {
      const k = `${r.raw[10] ?? ''}|${r.raw[7] ?? ''}`;
      const e = m.get(k) ?? { so: r.raw[10] ?? '', info: r.raw[7] ?? '', status: r.raw[15] ?? '', count: 0, diff: 0, val: 0 };
      e.count++; if (Math.abs(r.row[6]) > 0.5) e.diff++; e.val += r.row[6];
      m.set(k, e);
    }
    return [...m.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => a.val - b.val);
  }, [recs]);

  const purposes = useMemo(() => {
    const m = new Map<string, { n: number; neg: number; pos: number }>();
    for (const r of recs) {
      const k = r.raw[12] || 'Tanpa keperluan';
      const e = m.get(k) ?? { n: 0, neg: 0, pos: 0 };
      e.n++; if (r.row[6] < 0) e.neg += r.row[6]; else e.pos += r.row[6];
      m.set(k, e);
    }
    return [...m.entries()].sort((a, b) => a[1].neg - b[1].neg);
  }, [recs]);

  const items: Item[] = useMemo(() => {
    if (isDay) {
      return recs
        .filter((r) => !session || `${r.raw[10] ?? ''}|${r.raw[7] ?? ''}` === session)
        .map((r, i) => ({
          key: `${r.row[0]}-${i}`, name: r.row[0], code: r.raw[13] ?? '', cat: r.raw[8] ?? '', sub: r.raw[14] ?? '', unit: r.row[1],
          purposes: r.raw[12] ? [r.raw[12]] : [], sys: r.row[2], fis: r.row[3], qtyText: `${formatSignedQty(r.row[4])} ${r.row[1]}`,
          packText: formatCompactContainerDiff(r.row[4], r.row[1], r.row[0]), val: r.row[6], info: r.raw[7] ?? '', so: r.raw[10] ?? '', rec: r,
        }));
    }
    return Object.values(s.productMap).map((ps) => ({
      key: ps.name, name: ps.name, code: ps.code, cat: ps.category, sub: ps.subcategory, unit: Object.keys(ps.qtyByUnit)[0] ?? '',
      purposes: ps.purposes, sys: null, fis: null, qtyText: formatQtyMap(ps.qtyByUnit, ps.name, true) || '0',
      packText: `${ps.negDays} hari minus · ${ps.posDays} lebih`, val: ps.netVal, info: '', so: '',
    }));
  }, [isDay, recs, session, s.productMap]);

  const counts = useMemo(() => {
    const base = items.filter((i) => !purpose || i.purposes.includes(purpose));
    return { diff: base.filter((i) => passF('diff', i.val)).length, neg: base.filter((i) => passF('neg', i.val)).length,
      pos: base.filter((i) => passF('pos', i.val)).length, pas: base.filter((i) => passF('pas', i.val)).length, all: base.length };
  }, [items, purpose]);

  const shown = items
    .filter((i) => !purpose || i.purposes.includes(purpose))
    .filter((i) => passF(filter, i.val))
    .filter((i) => !q || `${i.name} ${i.code} ${i.cat} ${i.sub}`.toLowerCase().includes(q.toLowerCase()))
    .sort(sorter(sort));

  const catMax = Math.max(1, ...s.categoryStats.map((c) => Math.abs(c.negVal)));
  const prodStat = openProd ? s.productMap[openProd] : undefined;
  const dataKey = `${p.activeMonth}-${p.viewScope}-${isDay ? p.activeDay : `${p.activeRange.start}_${p.activeRange.end}`}`;
  const listKey = `${dataKey}-${filter}-${purpose}-${session}-${sort}`;

  return (
    <motion.div
      className="s3-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease }}
    >
      <DateTape {...p} maxNeg={maxNeg} />

      <div className="s3-cols">
        <div className="s3-col-side">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={dataKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease }}
            >
              <SummaryTicket s={s} label={periodLabel(p)} extra={p.onOpenInfo && (
                <button type="button" className="s3-link" onClick={() => p.onOpenInfo?.('harian')}><Info className="w-3.5 h-3.5" /> Cara membaca halaman ini</button>
              )} />
            </motion.div>
          </AnimatePresence>

          {!isDay && s.dailyStats.length > 1 && (
            <Section title="Arus selisih harian" hint="ketuk batang untuk buka hari">
              <div className="s3-flow">
                {s.dailyStats.map((d, i) => (
                  <button key={d.date} type="button" onClick={() => { p.onSelectDay(d.date); p.onSetScope('day'); }} title={`${formatDateId(d.date)} · ${rp(d.negVal + d.posVal)}`}>
                    <span className="up"><motion.i initial={{ height: 0 }} animate={{ height: `${(d.posVal / maxNeg) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.025, ease }} /></span>
                    <span className="dn"><motion.i initial={{ height: 0 }} animate={{ height: `${(Math.abs(d.negVal) / maxNeg) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.025, ease }} /></span>
                    <small>{dayNum(d.date)}</small>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {isDay && sessions.length > 0 && (
            <Section title={<><FileSpreadsheet className="w-4 h-4" /> Sesi opname</>} hint={`${sessions.length} nomor SO`}>
              <ul className="s3-sessions">
                {sessions.map((se) => (
                  <li key={se.k}>
                    <button type="button" className={`s3-session ${session === se.k ? 'is-on' : ''}`} onClick={() => setSession(session === se.k ? '' : se.k)}>
                      <span className="min-w-0 flex-1 text-left">
                        <b className="s3-mono">{se.so || 'Tanpa nomor'}</b>
                        <small className="block truncate">{se.info || '—'}</small>
                        <small className="block">{se.count} barang · {se.diff} selisih{se.status ? ` · ${se.status}` : ''}</small>
                      </span>
                      <b className={`s3-t-${tone(se.val)}`}>{rp(se.val)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={<><Tag className="w-4 h-4" /> Keperluan</>} hint="ketuk untuk menyaring" collapsible>
            <div className="s3-purposes">
              {purposes.map(([k, v]) => (
                <button key={k} type="button" className={`s3-purpose ${purpose === k ? 'is-on' : ''}`} onClick={() => setPurpose(purpose === k ? '' : k)}>
                  <span className="truncate">{k}</span>
                  <small>{v.n} baris</small>
                  <b className="s3-t-neg">{rp(v.neg)}</b>
                </button>
              ))}
            </div>
          </Section>

          <Section title={<><Layers className="w-4 h-4" /> Kategori</>} hint={`${s.categoryStats.length} kategori`} collapsible defaultOpen={false}>
            <div className="s3-cats">
              {s.categoryStats.map((c, i) => (
                <div key={c.category} className="s3-cat">
                  <div className="flex justify-between gap-2"><span className="truncate">{c.category || 'Lainnya'}</span><b className={`s3-t-${tone(c.netVal)}`}>{rp(c.netVal)}</b></div>
                  <div className="s3-track"><motion.i initial={{ width: 0 }} animate={{ width: `${(Math.abs(c.negVal) / catMax) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.04, ease }} /></div>
                  <small>{c.diffItems} dari {c.totalItems} barang selisih</small>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="s3-col-main">
          <section className="s3-card s3-list-card">
            <header className="s3-list-head">
              <div>
                <div className="s3-eyebrow">{isDay ? 'Baris Excel' : 'Akumulasi per barang'}</div>
                <h3 className="s3-h3">Rincian barang</h3>
              </div>
              <span className="s3-hint">{shown.length} tampil</span>
            </header>
            <Seg id="harian-f" value={filter} onChange={setFilter} full
              options={[['diff', 'Selisih', counts.diff], ['neg', 'Minus', counts.neg], ['pos', 'Lebih', counts.pos], ['pas', 'Pas', counts.pas], ['all', 'Semua', counts.all]] as const} />
            <ItemToolbar q={q} setQ={setQ} sort={sort} setSort={setSort} placeholder="Cari nama, kode, kategori…" />
            {(purpose || session) && (
              <div className="s3-active-filters">
                {purpose && <button type="button" onClick={() => setPurpose('')}>Keperluan: {purpose} ✕</button>}
                {session && <button type="button" onClick={() => setSession('')}>SO: {session.split('|')[0] || 'Tanpa nomor'} ✕</button>}
              </div>
            )}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={listKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.24, ease }}
              >
                <ul className="s3-items">
                  {shown.slice(0, limit).map((it, i) => (
                    <ItemLine key={it.key} it={it} i={i} onOpen={() => (it.rec ? setOpenRec(it.rec) : setOpenProd(it.name))} />
                  ))}
                </ul>
                {!shown.length && <div className="s3-empty">Tidak ada barang untuk saringan ini.</div>}
                {shown.length > limit && <button type="button" className="s3-more" onClick={() => setLimit(limit + 60)}>Tampilkan {Math.min(60, shown.length - limit)} lagi</button>}
              </motion.div>
            </AnimatePresence>
          </section>
        </div>
      </div>

      <Sheet open={!!openRec} onClose={() => setOpenRec(null)} eyebrow={openRec ? `${formatDateId(openRec.date)} · ${openRec.raw[8] ?? ''}` : ''} title={openRec?.row[0]}>
        {openRec && (
          <>
            <RecordDetail rec={openRec} />
            {s.productMap[openRec.row[0]] && (
              <button type="button" className="s3-more mt-4" onClick={() => { const n = openRec.row[0]; setOpenRec(null); setTimeout(() => setOpenProd(n), 250); }}>
                Lihat riwayat barang ini <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </Sheet>
      <Sheet open={!!prodStat} onClose={() => setOpenProd('')} eyebrow={prodStat ? `${prodStat.code || 'Tanpa kode'} · ${prodStat.category}` : ''} title={prodStat?.name} wide>
        {prodStat && <ProductDetail ps={prodStat} recs={isDay ? allRecs.filter((r) => s.activeDates.includes(r.date) || r.date === p.activeDay) : recs} onOpenRec={(r) => { setOpenProd(''); setTimeout(() => setOpenRec(r), 250); }} />}
      </Sheet>
    </motion.div>
  );
}

/* =================== CEK BARANG =================== */
export function BarangV2(p: StockViewProps & { selected: string; onSelect: (n: string) => void }) {
  const s = p.summary;
  const recs = useRecords(p.data, s.activeDates);
  const maxNeg = Math.max(1, ...s.dailyStats.map((d) => Math.abs(d.negVal)));
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filt>('neg');
  const [sort, setSort] = useState<Sort>('minus');
  const [cat, setCat] = useState('');
  const [limit, setLimit] = useState(60);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [openRec, setOpenRec] = useState<Rec | null>(null);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setDesktop(mq.matches); on();
    mq.addEventListener('change', on); return () => mq.removeEventListener('change', on);
  }, []);

  const all = Object.values(s.productMap);
  const cats = useMemo(() => [...new Set(all.map((x) => x.category || 'Lainnya'))].sort(), [all]);
  const items: Item[] = useMemo(() => all.map((ps) => ({
    key: ps.name, name: ps.name, code: ps.code, cat: ps.category, sub: ps.subcategory, unit: Object.keys(ps.qtyByUnit)[0] ?? '',
    purposes: ps.purposes, sys: null, fis: null, qtyText: formatQtyMap(ps.qtyByUnit, ps.name, true) || '0',
    packText: `${ps.negDays}× minus · ${ps.posDays}× lebih`, val: ps.netVal, info: '', so: '',
  })), [all]);
  const base = items.filter((i) => !cat || (i.cat || 'Lainnya') === cat);
  const counts = { neg: base.filter((i) => passF('neg', i.val)).length, pos: base.filter((i) => passF('pos', i.val)).length, pas: base.filter((i) => passF('pas', i.val)).length, all: base.length };
  const shown = base.filter((i) => passF(f, i.val))
    .filter((i) => !q || `${i.name} ${i.code} ${i.cat} ${i.sub}`.toLowerCase().includes(q.toLowerCase()))
    .sort(sorter(sort));
  const sel = s.productMap[p.selected] ?? (shown[0] ? s.productMap[shown[0].name] : undefined);

  const open = (n: string) => { p.onSelect(n); if (!desktop) setSheetOpen(true); };
  const dataKey = `${p.activeMonth}-${p.viewScope}-${p.viewScope === 'day' ? p.activeDay : `${p.activeRange.start}_${p.activeRange.end}`}`;
  const listKey = `${dataKey}-${f}-${cat}-${sort}`;

  return (
    <motion.div
      className="s3-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease }}
    >
      <DateTape {...p} maxNeg={maxNeg} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={dataKey}
          className="s3-ticket s3-ticket-row"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.24, ease }}
        >
          <div>
            <div className="s3-eyebrow"><PackageSearch className="w-3.5 h-3.5" /> Cek barang · {periodLabel(p)}</div>
            <div className="s3-big">{all.length}<span className="s3-unit"> barang</span></div>
          </div>
          <dl className="s3-stats s3-stats-3">
            <div><dt>Minus</dt><dd className="s3-t-neg">{s.negProductCount}</dd></div>
            <div><dt>Lebih</dt><dd className="s3-t-pos">{s.posProductCount}</dd></div>
            <div><dt>Pas</dt><dd>{s.pasProductCount}</dd></div>
          </dl>
          {p.onOpenInfo && <button type="button" className="s3-link" onClick={() => p.onOpenInfo?.('cekBarang')}><Info className="w-3.5 h-3.5" /> Panduan</button>}
        </motion.section>
      </AnimatePresence>

      <div className="s3-cols s3-cols-explorer">
        <section className="s3-card s3-list-card s3-sticky-list">
          <div className="s3-list-sticky">
            <ItemToolbar q={q} setQ={setQ} sort={sort} setSort={setSort} placeholder="Cari nama, kode, kategori…" />
            <Seg id="barang-f" value={f} onChange={setF} full
              options={[['neg', 'Minus', counts.neg], ['pos', 'Lebih', counts.pos], ['pas', 'Pas', counts.pas], ['all', 'Semua', counts.all]] as const} />
            <div className="s3-chips">
              <button type="button" className={!cat ? 'is-on' : ''} onClick={() => setCat('')}>Semua kategori</button>
              {cats.map((c) => <button key={c} type="button" className={cat === c ? 'is-on' : ''} onClick={() => setCat(cat === c ? '' : c)}>{c}</button>)}
            </div>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={listKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease }}
            >
              <ul className="s3-items">
                {shown.slice(0, limit).map((it, i) => (
                  <div key={it.key} className={desktop && sel?.name === it.name ? 's3-item-on' : ''}>
                    <ItemLine it={it} i={i} onOpen={() => open(it.name)} />
                  </div>
                ))}
              </ul>
              {!shown.length && <div className="s3-empty">Tidak ada barang.</div>}
              {shown.length > limit && <button type="button" className="s3-more" onClick={() => setLimit(limit + 60)}>Tampilkan {Math.min(60, shown.length - limit)} lagi</button>}
            </motion.div>
          </AnimatePresence>
        </section>

        {desktop && (
          <section className="s3-card s3-detail-pane">
            <AnimatePresence mode="wait">
              {sel ? (
                <motion.div key={sel.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease }}>
                  <div className="s3-eyebrow">{sel.code || 'Tanpa kode'} · {sel.category}{sel.subcategory ? ` · ${sel.subcategory}` : ''}</div>
                  <h2 className="s3-sheet-title mb-4">{sel.name}</h2>
                  {sel.location && <p className="s3-sub mb-3"><MapPin className="w-3.5 h-3.5 inline" /> {sel.location}</p>}
                  <ProductDetail ps={sel} recs={recs} onOpenRec={setOpenRec} />
                </motion.div>
              ) : <div className="s3-empty">Pilih barang di daftar.</div>}
            </AnimatePresence>
          </section>
        )}
      </div>

      <Sheet open={!desktop && sheetOpen && !!sel} onClose={() => setSheetOpen(false)} eyebrow={sel ? `${sel.code || 'Tanpa kode'} · ${sel.category}` : ''} title={sel?.name} wide>
        {sel && <ProductDetail ps={sel} recs={recs} onOpenRec={(r) => { setSheetOpen(false); setTimeout(() => setOpenRec(r), 250); }} />}
      </Sheet>
      <Sheet open={!!openRec} onClose={() => setOpenRec(null)} eyebrow={openRec ? formatDateId(openRec.date) : ''} title={openRec?.row[0]}>
        {openRec && <RecordDetail rec={openRec} />}
      </Sheet>
    </motion.div>
  );
}
