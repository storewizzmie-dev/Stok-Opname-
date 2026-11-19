import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface AiChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AiRequestBody {
  action?: 'summary' | 'chat';
  contextText?: string;
  question?: string;
  history?: AiChatTurn[];
}

const SYSTEM_INSTRUCTION = `Kamu adalah Asisten Stok Opname untuk staf toko/restoran (seperti Wizzmie).
Tugasmu membaca ringkasan data stok opname yang diberikan dan menjelaskannya dengan bahasa Indonesia sehari-hari yang SANGAT SEDERHANA, sopan, singkat, dan langsung bisa dipahami orang awam (tanpa istilah akuntansi yang rumit).

Aturan menjawab:
1. Selalu gunakan data angka yang ada di konteks. Jangan pernah mengarang nama barang atau angka yang tidak ada di data.
2. Gunakan istilah yang mudah dipahami:
   - "Kurang (Minus)" = barang di gudang lebih sedikit dari catatan komputer.
   - "Lebih (Plus)" = barang di gudang lebih banyak dari catatan komputer.
   - "Komputer vs Hitung Asli" = perbandingan catatan sistem dengan barang nyata di gudang.
3. Saat menyebut barang, sebutkan juga jumlah/satuannya (KG, Porsi, Btl, Dos, Jrg, Pack) DAN nilai Rupiahnya jika ada di data.
4. Jika ada barang yang punya hari minus sekaligus hari plus (sehingga selisih bersihnya kecil atau berbalik plus), ingatkan bahwa itu sering kali tanda salah hitung di salah satu hari atau telat input, bukan barang hilang permanen.
5. Gunakan format poin-poin singkat agar enak dibaca di layar HP.
6. Fokusmu adalah membaca dan menjelaskan data laporan stok opname (bukan menilai kode/desain aplikasi). Jika pengguna bertanya tentang fitur atau tampilan aplikasi, jelaskan dengan ramah bahwa kamu bertugas membantu menganalisis angka stok, lalu beri 2 contoh pertanyaan stok yang bisa ditanyakan (misalnya menanyakan barang kurang terbesar atau mengecek barang yang salah hitung).`;

function buildSummaryPrompt(contextText: string): string {
  return `Berikut data laporan stok opname saat ini:

${contextText}

Tolong buatkan ringkasan yang sangat gampang dibaca oleh orang awam dengan format 4 bagian singkat:
1. **Kesimpulan Utama**: Apakah kondisi stok secara keseluruhan masih lebih atau kurang, dan seberapa besar nilainya.
2. **Barang yang Wajib Dicek Duluan**: Sebutkan 3–5 barang paling kurang terbesar (jumlah + satuan + Rupiahnya).
3. **Catatan Salah Hitung / Bolak-Balik**: Jika ada barang yang kadang minus lalu besoknya plus, sebutkan agar staf cek ulang hitungannya.
4. **Saran Langkah Hari Ini**: 2 langkah praktis untuk tim toko/dapur.`;
}

function isTransientModelError(rawMsg: string): boolean {
  const lower = rawMsg.toLowerCase();
  return (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily') ||
    lower.includes('timeout') ||
    lower.includes('econnreset')
  );
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithRetryAndFallback(
  ai: GoogleGenAI,
  contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents']
): Promise<string> {
  const attempts: {
    model: string;
    thinkingLevel?: ThinkingLevel;
    waitBeforeMs: number;
  }[] = [
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.HIGH, waitBeforeMs: 0 },
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.HIGH, waitBeforeMs: 700 },
    { model: 'gemini-3.1-flash-lite', waitBeforeMs: 300 },
  ];

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
          systemInstruction: SYSTEM_INSTRUCTION,
          ...(attempt.thinkingLevel
            ? { thinkingConfig: { thinkingLevel: attempt.thinkingLevel } }
            : {}),
        },
      });
      return response.text?.trim() || 'Tidak ada jawaban dari AI.';
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!isTransientModelError(msg)) {
        throw err;
      }
    }
  }

  throw lastError;
}

export async function processAiRequest(
  rawBody: unknown
): Promise<{ status: number; body: Record<string, unknown> }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      status: 500,
      body: {
        error:
          'GEMINI_API_KEY belum diatur di server. Jika memakai Vercel, tambahkan GEMINI_API_KEY di Project Settings > Environment Variables.',
      },
    };
  }

  const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as AiRequestBody;
  const action = body.action === 'summary' ? 'summary' : 'chat';
  const contextText = String(body.contextText ?? '').trim();

  if (!contextText) {
    return {
      status: 400,
      body: { error: 'Data laporan stok belum tersedia. Upload file Excel terlebih dahulu.' },
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  try {
    if (action === 'summary') {
      const reply = await generateWithRetryAndFallback(
        ai,
        buildSummaryPrompt(contextText)
      );
      return {
        status: 200,
        body: { reply },
      };
    }

    const question = String(body.question ?? '').trim();
    if (!question) {
      return {
        status: 400,
        body: { error: 'Pertanyaan tidak boleh kosong.' },
      };
    }

    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `Ini data laporan stok opname yang sedang saya lihat:\n\n${contextText}\n\nJawab pertanyaan saya berikutnya berdasarkan data ini.`,
          },
        ],
      },
      {
        role: 'model',
        parts: [
          {
            text: 'Baik, saya sudah membaca data stok opname tersebut. Silakan tanyakan apa saja dengan bahasa biasa.',
          },
        ],
      },
      ...history.map((turn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(turn.text ?? '') }],
      })),
      {
        role: 'user',
        parts: [{ text: question }],
      },
    ];

    const reply = await generateWithRetryAndFallback(ai, contents);
    return {
      status: 200,
      body: { reply },
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const lower = rawMsg.toLowerCase();
    if (isTransientModelError(rawMsg)) {
      return {
        status: 503,
        body: {
          error:
            'Server AI Gemini sedang sangat ramai sementara (503). Tunggu beberapa detik lalu coba klik lagi.',
        },
      };
    }
    if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
      return {
        status: 429,
        body: {
          error:
            'Kuota gratis Gemini sedang penuh sebentar. Tunggu 1 menit lalu coba lagi.',
        },
      };
    }
    if (lower.includes('403') || lower.includes('400') || lower.includes('api_key')) {
      return {
        status: 500,
        body: {
          error:
            'Kunci Gemini API tidak valid atau belum aktif. Periksa pengaturan Secrets / Environment Variables server.',
        },
      };
    }
    return {
      status: 500,
      body: {
        error: `Gagal menghubungi AI: ${rawMsg}`,
      },
    };
  }
}

export default async function handler(
  req: { method?: string; body?: unknown },
  res: { status: (code: number) => { json: (data: Record<string, unknown>) => void } }
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const result = await processAiRequest(req.body);
  return res.status(result.status).json(result.body);
}
