import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Send, Sparkles, X } from 'lucide-react';
import {
  PnlDataset,
  buildAiPnlContext,
} from '../lib/profitLoss';
import {
  StockDataset,
  SummaryResult,
  buildAiStockContext,
  formatDateId,
  formatMonthId,
} from '../lib/stockOpname';
import { InfoButton, InfoGuideKey } from './InfoGuide';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const QUICK_PROMPTS = [
  'Jelaskan kondisi stok bulan ini pakai bahasa gampang',
  'Barang apa saja yang kemarin kurang tapi besoknya lebih?',
  'Bagian produksi / operasional mana yang harus dicek duluan?',
];

export function AiAssistantCard({
  summary,
  activeMonth,
  data,
  pnlData = {},
  activePnlMonth = '',
  currentMenuLabel = 'Beranda',
  messages,
  onMessagesChange,
  onOpenInfo,
  onClose,
}: {
  summary: SummaryResult | null;
  activeMonth: string;
  data: StockDataset;
  pnlData?: PnlDataset;
  activePnlMonth?: string;
  currentMenuLabel?: string;
  messages: AiChatMessage[];
  onMessagesChange: React.Dispatch<React.SetStateAction<AiChatMessage[]>>;
  onOpenInfo: (key: InfoGuideKey) => void;
  onClose?: () => void;
}) {
  const [input, setInput] = useState('');
  const [aiProvider, setAiProvider] = useState<'auto' | 'gemini' | 'groq'>('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const pnlMonths = Object.keys(pnlData).sort();
  const hasPnl = pnlMonths.length > 0;
  const resolvedPnlMonth =
    activePnlMonth && pnlData[activePnlMonth]
      ? activePnlMonth
      : activeMonth && pnlData[activeMonth]
      ? activeMonth
      : pnlMonths[pnlMonths.length - 1] ?? '';

  const periodLabel = summary
    ? summary.scope === 'month'
      ? `${formatMonthId(activeMonth)} (sebulan)`
      : `${formatDateId(summary.resolvedDate)} (1 hari)`
    : resolvedPnlMonth
    ? `Laba Rugi ${formatMonthId(resolvedPnlMonth)}`
    : 'Laporan';

  const totalProducts = summary ? Object.keys(summary.productMap).length : 0;
  const totalDates = summary ? summary.allMonthDates.length : 0;

  useEffect(() => {
    if (messages.length > 0 || isLoading) {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [messages, isLoading]);

  const callAiEndpoint = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: aiProvider, ...payload }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        'Server AI belum tersedia di hosting ini. Pastikan aplikasi dijalankan lewat Vercel atau AI Studio dengan GEMINI_API_KEY atau GROQ_API_KEY aktif.'
      );
    }

    const resData = (await res.json()) as { reply?: string; error?: string };
    if (!res.ok || resData.error) {
      throw new Error(resData.error || 'Gagal mendapatkan jawaban AI.');
    }
    return resData.reply || 'Tidak ada jawaban dari AI.';
  };

  const buildCombinedContext = (question?: string) => {
    const parts: string[] = [];
    if (summary && activeMonth) {
      parts.push(
        buildAiStockContext(summary, activeMonth, data, {
          question,
          currentMenu: currentMenuLabel,
        })
      );
    }
    if (hasPnl) {
      const pnlContext = buildAiPnlContext(pnlData, resolvedPnlMonth);
      if (pnlContext) parts.push(pnlContext);
    }
    return parts.join('\n');
  };

  const handleAutoSummary = async () => {
    if (isLoading) return;
    setErrorMsg(null);
    setIsLoading(true);
    const userNote: AiChatMessage = {
      role: 'user',
      text: `Buatkan ringkasan laporan untuk ${periodLabel}`,
    };
    onMessagesChange((prev) => [...prev, userNote]);

    try {
      const contextText = buildCombinedContext();
      const reply = await callAiEndpoint({
        action: 'summary',
        contextText,
      });
      onMessagesChange((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghubungi AI.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAsk = async (questionText?: string) => {
    const q = (questionText ?? input).trim();
    if (!q || isLoading) return;

    setErrorMsg(null);
    if (!questionText) setInput('');
    const historySnapshot = messages.slice(-8);
    onMessagesChange((prev) => [...prev, { role: 'user', text: q }]);
    setIsLoading(true);

    try {
      const contextText = buildCombinedContext(q);
      const reply = await callAiEndpoint({
        action: 'chat',
        contextText,
        question: q,
        history: historySnapshot,
      });
      onMessagesChange((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghubungi AI.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      className={`surface-3d rounded-3xl p-5 sm:p-7 space-y-4 ${
        onClose ? 'flex flex-col max-h-[88vh]' : ''
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              Asisten AI Stok
            </h2>
            <InfoButton guideKey="aiAssistant" onOpen={onOpenInfo} />
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {summary
              ? `Siap membantu membaca ${totalProducts} jenis barang dari ${totalDates} hari laporan (${formatMonthId(activeMonth)})${
                  hasPnl ? ` + Laba Rugi ${formatMonthId(resolvedPnlMonth)}` : ''
                }`
              : `Siap membantu membaca laporan Laba Rugi ${formatMonthId(
                  resolvedPnlMonth
                )} (rumus Description ÷ Net Sales)`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <select
            aria-label="Pilih penyedia AI"
            value={aiProvider}
            disabled={isLoading}
            onChange={(e) =>
              setAiProvider(e.target.value as 'auto' | 'gemini' | 'groq')
            }
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-[#1E355D] bg-white dark:bg-[#0A162B] text-slate-700 dark:text-slate-200 min-h-[40px] cursor-pointer"
          >
            <option value="auto">AI: Otomatis</option>
            <option value="gemini">Gemini AI</option>
            <option value="groq">Groq AI</option>
          </select>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onMessagesChange([]);
                setErrorMsg(null);
              }}
              className="btn-3d-soft px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 flex items-center gap-1.5 min-h-[40px] whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Hapus Chat</span>
            </button>
          )}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void handleAutoSummary()}
            className="btn-3d-primary px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl disabled:opacity-50 flex items-center gap-1.5 min-h-[42px] whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isLoading ? 'AI Sedang Membaca...' : 'Ringkas Pakai AI'}</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup jendela AI"
              className="btn-3d-soft p-2 rounded-xl text-slate-600 dark:text-slate-300 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 1-tap quick prompts */}
      <div className="flex flex-wrap gap-2 shrink-0">
          {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={isLoading}
            onClick={() => void handleAsk(prompt)}
            className="btn-3d-soft px-3.5 py-2 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-200 hover:text-amber-700 dark:hover:text-amber-300 disabled:opacity-50 min-h-[38px] text-left cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Messages */}
      {(messages.length > 0 || isLoading) && (
        <div
          className={`space-y-3 pt-3 border-t border-slate-100 dark:border-[#1E355D] overflow-y-auto pr-1 ${
            onClose ? 'flex-1 min-h-[160px]' : 'max-h-[520px]'
          }`}
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-semibold shadow-sm'
                    : 'bg-slate-100/80 dark:bg-[#0D1C34] border border-slate-200/70 dark:border-[#1E355D] text-slate-800 dark:text-slate-200'
                }`}
              >
                {msg.role === 'user' ? (
                  <span>{msg.text}</span>
                ) : (
                  <FormattedAiText text={msg.text} />
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 text-sm bg-slate-100/80 dark:bg-[#0D1C34] border border-slate-200/70 dark:border-[#1E355D] text-slate-500 dark:text-slate-400">
                Sedang membaca seluruh catatan stok Anda...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 px-4 py-3 text-xs sm:text-sm text-red-800 dark:text-red-300 shrink-0">
          {errorMsg}
        </div>
      )}

      {/* Question Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleAsk();
        }}
        className="flex items-center gap-2.5 pt-1 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder="Tulis pertanyaan biasa di sini, misal: info udang keju tanggal 17"
          className="flex-1 min-w-0 px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-[#1E355D] bg-slate-50/70 dark:bg-[#0A162B] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[44px]"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Kirim pertanyaan ke AI"
          className="btn-3d-primary px-4 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-40 flex items-center gap-1.5 min-h-[44px] shrink-0 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Kirim</span>
        </button>
      </form>
    </section>
  );
}

function FormattedAiText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;
        const isBullet =
          trimmed.startsWith('- ') ||
          trimmed.startsWith('* ') ||
          /^\d+\.\s/.test(trimmed);
        return (
          <p key={idx} className={isBullet ? 'pl-2' : undefined}>
            {renderInlineBold(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function renderInlineBold(line: string): React.ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
