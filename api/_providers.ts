import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export type AiProviderId = 'gemini' | 'groq';
export type AiProviderPreference = 'auto' | AiProviderId;

export interface AiMessageTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AiProviderConfig {
  id: AiProviderId;
  label: string;
  envVarName: 'GEMINI_API_KEY' | 'GROQ_API_KEY';
  primaryModel: string;
  fallbackModel: string;
}

export interface ProviderGenerateParams {
  systemInstruction: string;
  userPrompt: string;
  history?: AiMessageTurn[];
  initialUserContext?: string;
  initialModelAck?: string;
  thinkingLevel?: ThinkingLevel;
  maxTokens?: number;
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderConfig> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    envVarName: 'GEMINI_API_KEY',
    primaryModel: 'gemini-4-hydrogen',
    fallbackModel: 'gemini-3.1-flash-lite',
  },
  groq: {
    id: 'groq',
    label: 'Groq AI',
    envVarName: 'GROQ_API_KEY',
    // llama-3.3-70b-versatile & llama-3.1-8b-instant sudah dimatikan Groq (16 Agu 2026).
    // Bisa diganti tanpa ubah kode lewat env GROQ_MODEL / GROQ_FALLBACK_MODEL di Vercel.
    primaryModel: process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b',
    fallbackModel: process.env.GROQ_FALLBACK_MODEL?.trim() || 'openai/gpt-oss-20b',
  },
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanEnvKey(raw: string | undefined): string {
  return (raw ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function readApiKey(provider: AiProviderId): string | null {
  if (provider === 'gemini') {
    const key = cleanEnvKey(process.env.GEMINI_API_KEY);
    if (!key || key === 'MY_GEMINI_API_KEY') return null;
    return key;
  }
  const key = cleanEnvKey(process.env.GROQ_API_KEY);
  if (!key || key === 'MY_GROQ_API_KEY') return null;
  return key;
}

export function isTransientErrorMessage(rawMsg: string): boolean {
  const lower = rawMsg.toLowerCase();
  return (
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('504') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily') ||
    lower.includes('timeout') ||
    lower.includes('econnreset') ||
    lower.includes('rate_limit') ||
    lower.includes('429')
  );
}

export function resolveProviderOrder(
  preference: AiProviderPreference = 'auto'
): AiProviderId[] {
  const hasGemini = Boolean(readApiKey('gemini'));
  const hasGroq = Boolean(readApiKey('groq'));

  if (preference === 'gemini') return ['gemini'];
  if (preference === 'groq') return ['groq'];

  const envDefault = process.env.AI_DEFAULT_PROVIDER?.trim().toLowerCase();
  const preferredOrder: AiProviderId[] =
    envDefault === 'groq' ? ['groq', 'gemini'] : ['gemini', 'groq'];

  const available = preferredOrder.filter((id) =>
    id === 'gemini' ? hasGemini : hasGroq
  );

  return available.length > 0 ? available : preferredOrder;
}

async function generateWithGemini(
  apiKey: string,
  params: ProviderGenerateParams
): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const primaryThinking = params.thinkingLevel ?? ThinkingLevel.HIGH;
  const attempts: {
    model: string;
    thinkingLevel?: ThinkingLevel;
    waitBeforeMs: number;
  }[] = [
    {
      model: AI_PROVIDERS.gemini.primaryModel,
      thinkingLevel: primaryThinking,
      waitBeforeMs: 0,
    },
    {
      model: AI_PROVIDERS.gemini.primaryModel,
      thinkingLevel: primaryThinking,
      waitBeforeMs: 700,
    },
    {
      model: AI_PROVIDERS.gemini.fallbackModel,
      waitBeforeMs: 300,
    },
  ];

  const contents =
    params.history && params.initialUserContext
      ? [
          {
            role: 'user',
            parts: [{ text: params.initialUserContext }],
          },
          {
            role: 'model',
            parts: [
              {
                text:
                  params.initialModelAck ??
                  'Baik, saya sudah membaca data laporan tersebut.',
              },
            ],
          },
          ...params.history.map((turn) => ({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(turn.text ?? '') }],
          })),
          {
            role: 'user',
            parts: [{ text: params.userPrompt }],
          },
        ]
      : params.userPrompt;

  let lastError: unknown = null;
  for (const attempt of attempts) {
    if (attempt.waitBeforeMs > 0) {
      await delay(attempt.waitBeforeMs);
    }
    try {
      const response = await ai.models.generateContent({
        model: attempt.model,
        contents,
        config: {
          systemInstruction: params.systemInstruction,
          ...(attempt.thinkingLevel
            ? { thinkingConfig: { thinkingLevel: attempt.thinkingLevel } }
            : {}),
        },
      });
      return response.text?.trim() || 'Tidak ada jawaban dari AI.';
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();
      const isModelFallback =
        lower.includes('404') ||
        lower.includes('not_found') ||
        lower.includes('not found') ||
        lower.includes('unsupported');
      if (!isTransientErrorMessage(msg) && !isModelFallback) {
        throw err;
      }
    }
  }

  throw lastError;
}

interface GroqChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

async function generateWithGroq(
  apiKey: string,
  params: ProviderGenerateParams
): Promise<string> {
  const modelsToTry = [
    AI_PROVIDERS.groq.primaryModel,
    AI_PROVIDERS.groq.fallbackModel,
  ].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> =
    [{ role: 'system', content: params.systemInstruction }];

  if (params.history && params.initialUserContext) {
    messages.push({ role: 'user', content: params.initialUserContext });
    messages.push({
      role: 'assistant',
      content:
        params.initialModelAck ??
        'Baik, saya sudah membaca data laporan tersebut.',
    });
    for (const turn of params.history) {
      messages.push({
        role: turn.role === 'assistant' ? 'assistant' : 'user',
        content: String(turn.text ?? ''),
      });
    }
  }
  messages.push({ role: 'user', content: params.userPrompt });

  let lastError: unknown = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    if (i > 0) {
      await delay(300);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    try {
      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'PantauStokOpname/1.0 (+https://stok-opname-ecru.vercel.app)',
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.25,
            // Model reasoning memakai sebagian token untuk "berpikir", jadi diberi ruang ekstra
            // agar jawaban tidak terpotong / kosong. Panjang jawaban tetap diatur oleh prompt.
            max_completion_tokens: (params.maxTokens ?? 1024) + 800,
            ...(model.startsWith('openai/gpt-oss')
              ? { reasoning_effort: 'low', include_reasoning: false }
              : {}),
          }),
        }
      );

      const rawText = await response.text();
      let data: GroqChatCompletionResponse = {};
      try {
        data = JSON.parse(rawText) as GroqChatCompletionResponse;
      } catch {
        data = {};
      }

      if (!response.ok || data.error) {
        const fallbackSnippet = rawText.replace(/\s+/g, ' ').trim().slice(0, 180);
        const errMsg =
          data.error?.message ||
          fallbackSnippet ||
          `Groq HTTP ${response.status}`;
        const err = new Error(`[Groq ${response.status}] ${errMsg}`);
        lastError = err;
        const modelUnavailable =
          response.status === 404 ||
          /model_not_found|decommissioned|does not exist/i.test(errMsg);
        if (
          modelUnavailable ||
          response.status === 429 ||
          response.status >= 500 ||
          isTransientErrorMessage(errMsg)
        ) {
          continue;
        }
        throw err;
      }

      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('Groq tidak mengembalikan isi jawaban.');
      }
      return content;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!isTransientErrorMessage(msg) && i === modelsToTry.length - 1) {
        throw err;
      }
      if (!isTransientErrorMessage(msg)) {
        throw err;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

export async function generateWithConfiguredProviders(
  preference: AiProviderPreference,
  params: ProviderGenerateParams
): Promise<{ reply: string; provider: AiProviderId }> {
  const candidates = resolveProviderOrder(preference);
  const availableKeys = candidates.filter((id) => Boolean(readApiKey(id)));

  if (availableKeys.length === 0) {
    if (preference === 'groq') {
      throw new Error(
        'MISSING_KEY:GROQ_API_KEY belum diatur di server. Tambahkan GROQ_API_KEY di Project Settings > Environment Variables Vercel.'
      );
    }
    if (preference === 'gemini') {
      throw new Error(
        'MISSING_KEY:GEMINI_API_KEY belum diatur di server. Tambahkan GEMINI_API_KEY di Environment Variables server.'
      );
    }
    throw new Error(
      'MISSING_KEY:Belum ada API Key AI yang aktif di server (GEMINI_API_KEY atau GROQ_API_KEY). Tambahkan di Environment Variables server atau Vercel.'
    );
  }

  let lastError: unknown = null;

  for (const providerId of availableKeys) {
    const apiKey = readApiKey(providerId);
    if (!apiKey) continue;

    try {
      const reply =
        providerId === 'gemini'
          ? await generateWithGemini(apiKey, params)
          : await generateWithGroq(apiKey, params);
      return { reply, provider: providerId };
    } catch (err) {
      lastError = err;
      // In 'auto' mode, fall over to the next configured provider if available.
      if (preference === 'auto' && availableKeys.length > 1) {
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
