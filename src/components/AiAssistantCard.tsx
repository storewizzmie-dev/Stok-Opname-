import React, { useMemo, useState } from 'react';
import { RotateCcw, Send, Sparkles } from 'lucide-react';
import {
  SummaryResult,
  buildAiStockContext,
  formatDateId,
  formatMonthId,
} from '../lib/stockOpname';
import { InfoButton, InfoGuideKey } from './InfoGuide';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const QUICK_PROMPTS = [
  'Jelaskan laporan ini dengan bahasa paling gampang',
  'Barang apa yang kemungkinan cuma salah hitung?',
  'Bagian dapur mana yang paling perlu dicek?',
];

export function AiAssistantCard({
  summary,
  activeMonth,
  onOpenInfo,
}: {
  summary: SummaryResult;
  activeMonth: string;
  onOpenInfo: (key: InfoGuideKey) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const periodLabel =
    summary.scope === 'month'
      ? `${formatMonthId(activeMonth)} (sebulan)`
      : `${formatDateId(summary.resolvedDate)} (1 hari)`;

  const contextText = useMemo(
    () => buildAiStockContext(summary, activeMonth),
    [summary, activeMonth]
  );

  const callAiEndpoint = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        'Server AI belum tersedia di hosting ini. Pastikan aplikasi dijalankan lewat Vercel atau AI Studio dengan GEMINI_API_KEY aktif.'
      );
    }

    const data = (await res.json()) as { reply?: string; error?: string };
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Gagal mendapatkan jawaban AI.');
    }
    return data.reply || 'Tidak ada jawaban dari AI.';
  };

  const handleAutoSummary = async () => {
    if (isLoading) return;
    setErrorMsg(null);
    setIsLoading(true);
    const userNote: ChatMessage = {
      role: 'user',
      text: `Buatkan ringkasan stok untuk ${periodLabel}`,
    };
    setMessages((prev) => [...prev, userNote]);

    try {
      const reply = await callAiEndpoint({
        action: 'summary',
        contextText,
      });
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
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
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setIsLoading(true);

    try {
      const reply = await callAiEndpoint({
        action: 'chat',
        contextText,
        question: q,
        history: historySnapshot,
      });
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghubungi AI.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="bg-white dark:bg-[#121719] border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Asisten AI Stok
            </h2>
            <InfoButton guideKey="aiAssistant" onOpen={onOpenInfo} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Membaca data: {periodLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setErrorMsg(null);
              }}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 min-h-[40px] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Hapus Chat</span>
            </button>
          )}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void handleAutoSummary()}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 disabled:opacity-50 transition-colors flex items-center gap-1.5 min-h-[40px] whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isLoading ? 'AI Membaca...' : 'Ringkas Otomatis'}</span>
          </button>
        </div>
      </div>

      {/* 1-tap quick prompts */}
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={isLoading}
            onClick={() => void handleAsk(prompt)}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#1a2124] text-slate-700 dark:text-slate-200 hover:border-teal-600/50 hover:text-teal-800 dark:hover:text-teal-300 disabled:opacity-50 transition-colors min-h-[36px] text-left cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Messages */}
      {(messages.length > 0 || isLoading) && (
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/90 max-h-[420px] overflow-y-auto pr-1">
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
                    ? 'bg-teal-700 text-white dark:bg-teal-500 dark:text-slate-950 font-medium'
                    : 'bg-slate-50 dark:bg-[#182023] border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200'
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
              <div className="rounded-2xl px-4 py-3 text-sm bg-slate-50 dark:bg-[#182023] border border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                Sedang menganalisis laporan stok...
              </div>
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 px-4 py-3 text-xs sm:text-sm text-red-800 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Question Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleAsk();
        }}
        className="flex items-center gap-2 pt-1"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder="Tanya apa saja soal stok ini, misal: kenapa udang keju minus?"
          className="flex-1 min-w-0 px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2124] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 min-h-[44px]"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Kirim pertanyaan ke AI"
          className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 disabled:opacity-40 transition-colors flex items-center gap-1.5 min-h-[44px] shrink-0 cursor-pointer disabled:cursor-not-allowed"
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
          <p
            key={idx}
            className={isBullet ? 'pl-2' : undefined}
          >
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
