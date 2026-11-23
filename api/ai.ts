import { ThinkingLevel } from '@google/genai';
import {
  AiMessageTurn,
  ProviderGenerateParams,
  generateWithConfiguredProviders,
  isTransientErrorMessage,
  resolveProviderOrder,
} from './_providers.js';

export type ExtendedProviderId = 'gemini' | 'groq' | 'openai';
export type ExtendedProviderPreference = 'auto' | ExtendedProviderId;

export interface AiRequestBody {
  action?: 'summary' | 'chat' | 'pnl_analysis' | 'pnl_chat';
  provider?: ExtendedProviderPreference;
  contextText?: string;
  question?: string;
  history?: AiMessageTurn[];
  pnlTargetLabel?: string;
  initialAnalysis?: string;
}

const SYSTEM_INSTRUCTION = `Kamu adalah Asisten AI Pintar di aplikasi web "Pantau Stok Opname & Laba Rugi" (Wizzmie).
Tugasmu adalah menjawab pertanyaan pengguna tentang APA SAJA dengan bahasa Indonesia sehari-hari yang ramah, cerdas, rapi, dan sangat mudah dipahami orang awam, meliputi:
1. Seluruh Data Stok Opname di semua menu (Menu Beranda, Menu Harian, Menu Cek Barang, Menu Pengaturan).
2. Seluruh Data Laporan Laba Rugi / Profit & Loss (Menu Laba Rugi: Net Sales 100%, COGS, Gross Profit, Biaya Operasional, Net Profit, dan seluruh rincian pos Description).
3. Fungsi, fitur, dan cara menggunakan seluruh menu maupun tombol yang ada di web app ini.
4. Pertanyaan umum seputar operasional toko/restoran, pengelolaan stok gudang, pengendalian biaya, maupun pertanyaan bebas lainnya dari pengguna.

Aturan menjawab:
1. Gunakan angka nyata dari data yang dikirimkan (baik data Stok Opname maupun data Laba Rugi).
   - PENTING — PRIORITASKAN BAGIAN "=== DATA SPESIFIK YANG COCOK DENGAN PERTANYAAN PENGGUNA (PRIORITAS UTAMA) ===":
     Jika pengguna menanyakan barang atau tanggal tertentu (misalnya "pada tanggal 17 Tepung WizzChick kenapa minus 4,18 pack"), WAJIB baca bagian "DATA SPESIFIK YANG COCOK DENGAN PERTANYAAN PENGGUNA" dan "Rincian Harian".
   - JANGAN PERNAH menyangkal adanya minus/lebih pada suatu tanggal hanya karena total gabungan 1–17 hari bernilai sebaliknya! Bedakan dengan jelas antara:
     a) Data pada 1 tanggal yang ditanyakan (sebutkan angka Di Sistem ESB, Hitungan Gudang, Selisih dalam satuan dasar maupun konversi pack/botol/dus, Harga/Unit, dan Nilai Rupiahnya, lalu jelaskan bahwa minus terjadi karena Hitungan Gudang lebih sedikit dari catatan Sistem ESB serta cara konversi kemasannya).
     b) Riwayat hari-hari lainnya dan total akumulasi periode (jelaskan jika di hari lain barang tersebut tercatat lebih/bolak-balik sehingga hasil gabungannya berbeda, yang sering menandakan selisih waktu input ESB atau salah hitung fisik di salah satu hari).
   - Jika pengguna menanyakan pos Laba Rugi (misal "berapa Net Profit", "biaya gaji", "Sales Food"), sebutkan nilai Rupiah dan persentasenya terhadap Net Sales sesuai data Menu Laba Rugi.
   - Jangan pernah mengarang angka laporan yang tidak ada di data.
2. Jika pengguna bertanya tentang fungsi fitur atau cara memakai aplikasi ini, jelaskan dengan jelas berdasarkan "PANDUAN FITUR & MENU WEB APP" yang ada di konteks (seperti fungsi Menu Beranda, Harian, Cek Barang, Laba Rugi, Pengaturan, tombol Rentang Tanggal pop-up di pojok kanan dengan klik 1x aktif & klik 2x buka list tanggal serta tarik tanggal 1-30, tombol Cek 1 Hari, atau cara simpan Note Penjelasan Permanen di Laba Rugi).
3. Gunakan istilah yang konsisten dan mudah dipahami:
   - "Minus (Kurang)" = Hitungan Gudang lebih sedikit dari catatan Sistem ESB.
   - "Lebih (Plus)" = Hitungan Gudang lebih banyak dari catatan Sistem ESB.
   - "Sistem ESB vs Hitungan Gudang" = perbandingan catatan Sistem ESB dengan hitungan barang nyata di gudang.
   - Jika ada barang yang punya hari minus sekaligus hari plus (bolak-balik), ingatkan bahwa itu sering kali indikasi salah hitung di salah satu hari atau telat input di Sistem ESB.
4. Format jawaban WAJIB BERSIH, RAPI, RINGKAS, dan TUNTAS (tidak boleh terpotong):
   - DILARANG KERAS memakai tanda bintang (* atau **) untuk menebalkan/memiringkan kata. Tulis teks biasa saja tanpa simbol bintang sama sekali.
   - DILARANG KERAS menulis tag HTML seperti <br>, <b>, <i>, atau membuat tabel Markdown dengan karakter pipa ("|") dan garis pemisah ("---").
   - Gunakan kalimat paragraf yang mengalir rapi atau daftar poin singkat menggunakan tanda hubung "- " (satu baris per poin).
   - Jawab secara padat, jelas, dan langsung ke inti (maksimal 150–280 kata kecuali pengguna meminta rincian panjang) agar kalimat selalu selesai dengan tuntas sampai titik terakhir.`;

const PNL_ANALYSIS_SYSTEM_INSTRUCTION = `Kamu adalah analis keuangan restoran yang menjelaskan satu pos laporan Laba Rugi kepada pemilik outlet dengan bahasa Indonesia sehari-hari yang sederhana, cerdas, rapi, dan langsung ke inti.

ATURAN WAJIB BENTUK & PANJANG JAWABAN:
- Tulis TEPAT 1 paragraf saja berisi maksimal 3–4 kalimat pendek yang mengalir rapi dan tuntas sampai titik terakhir.
- Panjang ideal 40–70 kata dan DILARANG melebihi 85 kata.
- DILARANG KERAS memakai tanda bintang (* atau **), tag HTML (<br>), tabel Markdown, garis tabel (|---|---|), karakter pipa (|), garis pemisah (---), heading (#), daftar bernomor, atau sapaan pembuka. Tulis hanya kalimat paragraf biasa yang bersih tanpa simbol bintang.

ATURAN GAYA BAHASA:
- Pakai bahasa sederhana yang mudah dibaca dalam beberapa detik.
- DILARANG memakai istilah kaku/berlebihan seperti: "tulang punggung utama", "konsekuensi langsung pada struktur biaya", "profitabilitas akhir outlet tetap sangat terjaga", "menahan Gross Profit", "menggerus nilai penjualan", "struktur margin yang menentukan", atau kalimat template seperti "Dari setiap Rp100 penjualan bersih...".
- Contoh gaya yang bagus: "Penjualan makanan menjadi sumber pendapatan terbesar restoran." atau "Besarnya penjualan makanan membuat biaya bahan bakunya menjadi komponen terbesar." (jadikan referensi gaya saja, bukan template).

ATURAN FOKUS & KECERDASAN ANALISIS:
1. Baca seluruh data laporan untuk memahami konteksnya, tetapi tampilkan HANYA 1–2 temuan paling penting untuk pos yang sedang dibuka.
2. Fokus pada: arti angka/porsi pos tersebut, pembanding terdekat yang paling relevan (bila benar-benar berguna), dan satu hal yang perlu diperhatikan jika ada (misalnya nilai minus atau biaya tidak biasa).
3. JANGAN memaksakan menghubungkan pos ke seluruh akun lain (Sales ke Gross Profit, Opex, Waste, dan Net Profit sekaligus).
   - Misal saat membahas Sales - Food, cukup fokus ke penjualan makanan dan perbandingannya dengan komponen penjualan lain (seperti minuman) bila relevan.
   - Saat membahas kategori subtotal (seperti Total COGS atau Biaya Operasional), tunjukkan penyumbang terbesarnya secara singkat.
   - Saat membahas laba (Gross Profit, Operational Profit, Net Profit), jelaskan singkat pembentuk utamanya.
4. DILARANG mengulang rumus pembagian, mengulang angka secara hambar tanpa makna, menganggap angka besar otomatis bermasalah, menyebut kondisi "sehat" atau "buruk" tanpa data pembanding bulan lalu, atau mengarang penyebab yang tidak ada di laporan.`;

const PNL_CHAT_SYSTEM_INSTRUCTION = `Kamu adalah analis keuangan restoran yang menjawab pertanyaan lanjutan pemilik outlet tentang laporan Laba Rugi dengan bahasa Indonesia sehari-hari yang sederhana, ramah, rapi, dan langsung ke inti.

Aturan format WAJIB:
- Tulis dalam bentuk kalimat paragraf yang rapi dan mudah dibaca (atau poin singkat memakai tanda hubung "- " hanya jika membandingkan beberapa pos, maksimal 4 baris).
- DILARANG KERAS memakai tanda bintang (* atau **), tag HTML (<br>), tabel Markdown, karakter pipa ("|"), garis pemisah ("---" atau "|---|"), heading ("#"), atau blok kode. Semua angka dan perbandingan harus ditulis dalam kalimat bersih tanpa simbol bintang.

Aturan isi:
1. Gunakan HANYA angka nyata dari data laporan Laba Rugi yang dikirimkan. Jangan mengarang angka atau penyebab yang tidak ada di laporan.
2. Jawab langsung pertanyaan pengguna secara ringkas, padat, dan tuntas (2–5 kalimat).
3. Jika pengguna menanyakan cara menghitung, porsi %, selisih bulan lalu, atau pos terbesar/terkecil terkait topik yang ditanya, tampilkan angka Rupiah dan % dari Net Sales-nya secara akurat di dalam kalimat.
4. Hindari istilah akuntansi yang kaku atau berbelit-belit.`;

function stripInlineFormatting(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanAiProse(raw: string): string {
  // Replace <br> tags outside tables with newlines, except keep table rows on single line first
  const rawLines = raw.replace(/\r\n/g, '\n').split('\n');
  const expandedLines: string[] = [];

  for (const rl of rawLines) {
    if (rl.includes('|')) {
      expandedLines.push(rl);
    } else {
      const splitBr = rl.replace(/<br\s*\/?>/gi, '\n').split('\n');
      expandedLines.push(...splitBr);
    }
  }

  const out: string[] = [];
  let tableHeaders: string[] | null = null;

  for (let i = 0; i < expandedLines.length; i++) {
    let line = expandedLines[i].trim();
    if (!line) {
      tableHeaders = null;
      if (out.length > 0 && out[out.length - 1] !== '') {
        out.push('');
      }
      continue;
    }

    if (line.startsWith('```')) {
      continue;
    }

    // Strip horizontal rules / table divider rows
    if (/^\|?[\s:*-]+\|[\s|:-]*$/.test(line) || /^[-*_]{3,}$/.test(line)) {
      continue;
    }

    // Strip markdown heading prefixes
    line = line.replace(/^#{1,6}\s+/, '');

    // Convert any markdown table row into clean prose/bullet
    if (line.includes('|')) {
      const cells = line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => stripInlineFormatting(c))
        .filter(Boolean);

      if (cells.length === 0) continue;

      const nextLine = (expandedLines[i + 1] ?? '').trim();
      const nextIsDivider = /^\|?[\s:*-]+\|[\s|:-]*$/.test(nextLine);
      if (nextIsDivider) {
        tableHeaders = cells;
        continue;
      }

      if (tableHeaders && tableHeaders.length === cells.length) {
        const pairs = cells.map((cell, idx) =>
          idx === 0 ? cell : `${tableHeaders![idx]}: ${cell}`
        );
        out.push(`- ${pairs.join(' — ')}`);
      } else if (cells.length >= 2) {
        out.push(`- ${cells[0]}: ${cells.slice(1).join(' · ')}`);
      } else {
        out.push(cells[0]);
      }
      continue;
    }

    tableHeaders = null;
    // Normalize bullet prefix (*, •, ●, ▪) to "- "
    line = line.replace(/^(\*|[•●▪‣])\s+/, '- ');
    line = stripInlineFormatting(line);
    if (line) {
      out.push(line);
    }
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildSummaryPrompt(contextText: string): string {
  return `Berikut data laporan stok opname saat ini:

${contextText}

Tolong buatkan ringkasan singkat yang sangat gampang dibaca oleh orang awam (TANPA tanda bintang * sama sekali dan TANPA tag <br>) dengan 4 bagian pendek:
1. Kesimpulan Utama: Total barang kurang, total barang lebih, dan hasil gabungannya dalam Rupiah.
2. Barang yang Wajib Dicek Duluan: Sebutkan 3–5 barang paling kurang terbesar (jumlah + satuan + Rupiahnya).
3. Catatan Salah Hitung / Bolak-Balik: Jika ada barang yang kadang minus lalu besoknya plus, sebutkan agar staf cek ulang hitungannya.
4. Saran Langkah Hari Ini: 2 langkah praktis untuk tim toko dan bagian produksi / operasional.`;
}

function normalizeProvider(raw: unknown): ExtendedProviderPreference {
  if (raw === 'gemini' || raw === 'groq' || raw === 'openai') return raw;
  return 'auto';
}

function readOpenAiApiKey(): string | null {
  const key = (process.env.OPENAI_API_KEY ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
  if (!key || key === 'MY_OPENAI_API_KEY') return null;
  return key;
}

interface OpenAiChatCompletionResponse {
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

async function generateWithOpenAi(
  apiKey: string,
  params: ProviderGenerateParams
): Promise<string> {
  const primaryModel = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const fallbackModel = process.env.OPENAI_FALLBACK_MODEL?.trim() || 'gpt-4o';
  const modelsToTry = [primaryModel, fallbackModel].filter(
    (m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx
  );

  const messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }> = [{ role: 'system', content: params.systemInstruction }];

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
      await new Promise((r) => setTimeout(r, 300));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28_000);

    try {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.25,
            max_completion_tokens: params.maxTokens ?? 1200,
          }),
        }
      );

      const rawText = await response.text();
      let data: OpenAiChatCompletionResponse = {};
      try {
        data = JSON.parse(rawText) as OpenAiChatCompletionResponse;
      } catch {
        data = {};
      }

      if (!response.ok || data.error) {
        const fallbackSnippet = rawText
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 180);
        const errMsg =
          data.error?.message ||
          fallbackSnippet ||
          `OpenAI HTTP ${response.status}`;
        const errCode = (data.error?.code || data.error?.type || '').toLowerCase();
        const isQuotaOrBilling =
          errCode.includes('insufficient_quota') ||
          errCode.includes('billing') ||
          /exceeded your current quota|check your plan and billing|insufficient_quota/i.test(
            errMsg
          );

        if (isQuotaOrBilling) {
          throw new Error(
            `OPENAI_QUOTA_EXCEEDED:[OpenAI ${response.status}] ${errMsg}`
          );
        }

        const err = new Error(`[OpenAI ${response.status}] ${errMsg}`);
        lastError = err;
        const modelUnavailable =
          response.status === 404 ||
          /model_not_found|does not exist/i.test(errMsg);
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
        throw new Error('OpenAI tidak mengembalikan isi jawaban.');
      }
      return content;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.startsWith('OPENAI_QUOTA_EXCEEDED:') ||
        !isTransientErrorMessage(msg)
      ) {
        throw err;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

async function tryOpenAiFallbackViaGroqOrGemini(
  params: ProviderGenerateParams
): Promise<{ reply: string; provider: ExtendedProviderId }> {
  try {
    // Groq menjalankan model resmi OpenAI open-weight: openai/gpt-oss-120b & openai/gpt-oss-20b
    const groqRes = await generateWithConfiguredProviders('groq', params);
    return { reply: groqRes.reply, provider: 'openai' };
  } catch {
    const autoRes = await generateWithConfiguredProviders('auto', params);
    return { reply: autoRes.reply, provider: 'openai' };
  }
}

async function generateWithAnyProvider(
  preference: ExtendedProviderPreference,
  params: ProviderGenerateParams
): Promise<{ reply: string; provider: ExtendedProviderId }> {
  const openAiKey = readOpenAiApiKey();

  if (preference === 'openai') {
    if (openAiKey) {
      try {
        const reply = await generateWithOpenAi(openAiKey, params);
        return { reply, provider: 'openai' };
      } catch (openAiErr) {
        try {
          return await tryOpenAiFallbackViaGroqOrGemini(params);
        } catch {
          throw openAiErr;
        }
      }
    }

    try {
      return await tryOpenAiFallbackViaGroqOrGemini(params);
    } catch {
      throw new Error(
        'MISSING_KEY:OPENAI_API_KEY belum diatur di server. Tambahkan OPENAI_API_KEY di Project Settings > Environment Variables Vercel lalu Redeploy.'
      );
    }
  }

  if (preference === 'gemini' || preference === 'groq') {
    return generateWithConfiguredProviders(preference, params);
  }

  // preference === 'auto'
  const envDefault = process.env.AI_DEFAULT_PROVIDER?.trim().toLowerCase();
  if (envDefault === 'openai' && openAiKey) {
    try {
      const reply = await generateWithOpenAi(openAiKey, params);
      return { reply, provider: 'openai' };
    } catch (openAiErr) {
      try {
        return await generateWithConfiguredProviders('auto', params);
      } catch {
        throw openAiErr;
      }
    }
  }

  try {
    return await generateWithConfiguredProviders('auto', params);
  } catch (primaryErr) {
    if (openAiKey) {
      const reply = await generateWithOpenAi(openAiKey, params);
      return { reply, provider: 'openai' };
    }
    throw primaryErr;
  }
}

const COMPACT_STOPWORDS = new Set([
  'pada',
  'tanggal',
  'tgl',
  'bulan',
  'tahun',
  'hari',
  'ini',
  'itu',
  'yang',
  'dan',
  'atau',
  'dari',
  'untuk',
  'dengan',
  'kenapa',
  'mengapa',
  'berapa',
  'apa',
  'apakah',
  'bagaimana',
  'gimana',
  'tolong',
  'coba',
  'lihat',
  'cek',
  'cari',
  'data',
  'stok',
  'opname',
  'menu',
  'harian',
  'barang',
  'beranda',
  'laba',
  'rugi',
  'laporan',
  'selisih',
  'minus',
  'kurang',
  'lebih',
  'plus',
  'pas',
  'pack',
  'pak',
  'dus',
  'dos',
  'botol',
  'btl',
  'jerigen',
  'galon',
  'slop',
  'ball',
  'pcs',
  'porsi',
  'kg',
  'gram',
  'gr',
  'liter',
  'ml',
  'rupiah',
  'rp',
  'rb',
  'jt',
  'sistem',
  'esb',
  'gudang',
  'hitungan',
]);

function compactContextForGroq(
  contextText: string,
  question?: string,
  maxChars = 15_500
): string {
  if (contextText.length <= maxChars) return contextText;

  const cleanedQ = (question ?? '').toLowerCase().replace(/\d+[,.]\d+/g, ' ');
  const keywords = cleanedQ
    .split(/[\s,?.!:/()-]+/)
    .filter((w) => w.length >= 2 && !COMPACT_STOPWORDS.has(w));

  const lines = contextText.split('\n');
  const spotlightLines: string[] = [];
  const priorityLines: string[] = [];
  const scoredDetailLines: { score: number; line: string }[] = [];
  const detailLines: string[] = [];

  let inSpotlightSection = false;
  let inLongDetailSection = false;

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (
      lower.startsWith(
        '=== data spesifik yang cocok dengan pertanyaan pengguna'
      )
    ) {
      inSpotlightSection = true;
      spotlightLines.push(line);
      continue;
    }
    if (lower.startsWith('=== akhir data spesifik pertanyaan ===')) {
      spotlightLines.push(line);
      inSpotlightSection = false;
      continue;
    }
    if (inSpotlightSection) {
      spotlightLines.push(line);
      continue;
    }

    if (
      lower.startsWith('semua barang pada periode') ||
      lower.startsWith('ringkasan akumulasi barang') ||
      lower.startsWith('ringkasan barang utama') ||
      lower.startsWith('rincian harian') ||
      lower.startsWith('rincian setiap description') ||
      lower.startsWith('=== seluruh baris laporan')
    ) {
      inLongDetailSection = true;
      priorityLines.push(line);
      continue;
    }
    if (
      lower.startsWith('daftar semua bulan') ||
      lower.startsWith('ringkasan per bagian') ||
      lower.startsWith('barang bolak-balik') ||
      lower.startsWith('ringkasan harian bulan aktif') ||
      lower.startsWith('=== data laba rugi') ||
      lower.startsWith('=== standar satuan & konversi kemasan')
    ) {
      inLongDetailSection = false;
    }

    if (!inLongDetailSection) {
      priorityLines.push(line);
    } else if (keywords.length > 0) {
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          score += kw.length >= 4 ? 2 : 1;
        }
      }
      if (score > 0) {
        scoredDetailLines.push({ score, line });
      } else {
        detailLines.push(line);
      }
    } else {
      detailLines.push(line);
    }
  }

  scoredDetailLines.sort((a, b) => b.score - a.score);

  const out: string[] = [];
  let used = 0;

  // 1. Always include the question spotlight block first!
  for (const line of spotlightLines) {
    if (used + line.length + 1 > maxChars - 500) break;
    out.push(line);
    used += line.length + 1;
  }

  // 2. Include core headers & summaries
  for (const line of priorityLines) {
    if (used + line.length + 1 > maxChars - 1500) break;
    out.push(line);
    used += line.length + 1;
  }

  // 3. Include highest-scoring detail rows matching question keywords
  for (const { line } of scoredDetailLines) {
    if (used + line.length + 1 > maxChars - 200) break;
    out.push(line);
    used += line.length + 1;
  }

  // 4. Fill remaining budget with general detail lines
  for (const line of detailLines) {
    if (used + line.length + 1 > maxChars) break;
    out.push(line);
    used += line.length + 1;
  }

  return out.join('\n');
}

export async function processAiRequest(
  rawBody: unknown
): Promise<{ status: number; body: Record<string, unknown> }> {
  let parsedRaw = rawBody;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(parsedRaw)) {
    parsedRaw = parsedRaw.toString('utf8');
  }
  if (typeof parsedRaw === 'string') {
    try {
      parsedRaw = JSON.parse(parsedRaw);
    } catch {
      parsedRaw = {};
    }
  }

  const body = (
    parsedRaw && typeof parsedRaw === 'object' ? parsedRaw : {}
  ) as AiRequestBody;
  const action =
    body.action === 'summary'
      ? 'summary'
      : body.action === 'pnl_analysis'
      ? 'pnl_analysis'
      : body.action === 'pnl_chat'
      ? 'pnl_chat'
      : 'chat';
  const providerPref = normalizeProvider(body.provider);
  const contextText = String(body.contextText ?? '').trim();

  if (!contextText) {
    return {
      status: 400,
      body: {
        error:
          action === 'pnl_analysis' || action === 'pnl_chat'
            ? 'Data laporan Laba Rugi belum tersedia untuk dianalisis.'
            : 'Data laporan stok belum tersedia. Upload file Excel terlebih dahulu.',
      },
    };
  }

  try {
    const isCompactProvider =
      providerPref === 'groq' ||
      providerPref === 'openai' ||
      (providerPref === 'auto' && resolveProviderOrder(providerPref)[0] === 'groq');
    const effectiveContext = isCompactProvider
      ? compactContextForGroq(contextText, body.question)
      : contextText;

    if (action === 'pnl_analysis') {
      const targetLabel = String(body.pnlTargetLabel ?? 'Pos Keuangan').trim();
      const prompt = `Analisis singkat (1 paragraf rapi tanpa tanda bintang *, tanpa tabel, dan tanpa garis pemisah, 3-4 kalimat, ideal 40-70 kata, maksimal 85 kata) khusus untuk pos "${targetLabel}" menggunakan bahasa sehari-hari yang mudah dipahami:\n\n${effectiveContext}`;
      const result = await generateWithAnyProvider(providerPref, {
        systemInstruction: PNL_ANALYSIS_SYSTEM_INSTRUCTION,
        userPrompt: prompt,
        thinkingLevel: ThinkingLevel.HIGH,
        maxTokens: 700,
      });
      return {
        status: 200,
        body: { reply: cleanAiProse(result.reply), provider: result.provider },
      };
    }

    if (action === 'pnl_chat') {
      const question = String(body.question ?? '').trim();
      if (!question) {
        return {
          status: 400,
          body: { error: 'Pertanyaan tidak boleh kosong.' },
        };
      }
      const targetLabel = String(body.pnlTargetLabel ?? 'Pos Keuangan').trim();
      const rawHistory = Array.isArray(body.history) ? body.history : [];
      const history = isCompactProvider ? rawHistory.slice(-4) : rawHistory.slice(-8);
      const initialAnalysis = String(body.initialAnalysis ?? '').trim();

      const result = await generateWithAnyProvider(providerPref, {
        systemInstruction: PNL_CHAT_SYSTEM_INSTRUCTION,
        initialUserContext: `Ini data laporan Laba Rugi aktual untuk pos "${targetLabel}":\n\n${effectiveContext}\n\nJawab pertanyaan lanjutan saya berdasarkan data laporan ini dalam bentuk kalimat yang rapi tanpa tanda bintang * dan tanpa tabel.`,
        initialModelAck:
          initialAnalysis ||
          'Baik, saya sudah membaca data Laba Rugi tersebut. Silakan ajukan pertanyaan.',
        history,
        userPrompt: question,
        thinkingLevel: ThinkingLevel.HIGH,
        maxTokens: 1400,
      });

      return {
        status: 200,
        body: { reply: cleanAiProse(result.reply), provider: result.provider },
      };
    }

    if (action === 'summary') {
      const result = await generateWithAnyProvider(providerPref, {
        systemInstruction: SYSTEM_INSTRUCTION,
        userPrompt: buildSummaryPrompt(effectiveContext),
        thinkingLevel: ThinkingLevel.HIGH,
        maxTokens: 1800,
      });
      return {
        status: 200,
        body: { reply: cleanAiProse(result.reply), provider: result.provider },
      };
    }

    const question = String(body.question ?? '').trim();
    if (!question) {
      return {
        status: 400,
        body: { error: 'Pertanyaan tidak boleh kosong.' },
      };
    }

    const rawHistory = Array.isArray(body.history) ? body.history : [];
    const history = isCompactProvider ? rawHistory.slice(-4) : rawHistory.slice(-8);

    const spotlightMatch = contextText.match(
      /=== DATA SPESIFIK YANG COCOK DENGAN PERTANYAAN PENGGUNA \(PRIORITAS UTAMA\) ===[\s\S]*?=== AKHIR DATA SPESIFIK PERTANYAAN ===/
    );
    const enrichedUserPrompt = spotlightMatch
      ? `${question}\n\n(Gunakan data aktual berikut yang cocok langsung dengan pertanyaan di atas:\n${spotlightMatch[0]})`
      : question;

    const result = await generateWithAnyProvider(providerPref, {
      systemInstruction: SYSTEM_INSTRUCTION,
      initialUserContext: `Ini seluruh informasi fitur aplikasi web beserta data laporan Stok Opname & Laba Rugi dari semua menu:\n\n${effectiveContext}\n\nJawab pertanyaan saya berikutnya dengan bahasa sederhana, ringkas, tuntas, dan kalimat yang rapi (tanpa tanda bintang *, tanpa <br>, dan tanpa tabel Markdown).`,
      initialModelAck:
        'Baik, saya sudah memahami seluruh fitur aplikasi serta membaca data Stok Opname dan Laba Rugi di semua menu. Silakan tanyakan apa saja.',
      history,
      userPrompt: enrichedUserPrompt,
      thinkingLevel: ThinkingLevel.HIGH,
      maxTokens: 2000,
    });

    return {
      status: 200,
      body: { reply: cleanAiProse(result.reply), provider: result.provider },
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const safeMsg = rawMsg
      .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
      .replace(/gsk_[A-Za-z0-9_-]+/g, 'gsk_***')
      .replace(/AIza[A-Za-z0-9_-]+/g, 'AIza***')
      .replace(/AQ\.[A-Za-z0-9._-]+/g, 'AQ.***');
    const lower = safeMsg.toLowerCase();

    if (safeMsg.startsWith('MISSING_KEY:')) {
      return {
        status: 500,
        body: {
          error: safeMsg.replace('MISSING_KEY:', ''),
        },
      };
    }
    if (
      safeMsg.startsWith('OPENAI_QUOTA_EXCEEDED:') ||
      lower.includes('insufficient_quota') ||
      lower.includes('exceeded your current quota') ||
      lower.includes('check your plan and billing')
    ) {
      return {
        status: 429,
        body: {
          error:
            'Saldo kredit API OpenAI Anda Rp 0 / $0.00 (insufficient_quota). Berbeda dengan Gemini & Groq yang gratis, akun OpenAI API membutuhkan isi saldo minimal $5 di platform.openai.com/settings/organization/billing.',
        },
      };
    }
    if (
      /\b413\b/.test(lower) ||
      lower.includes('request too large') ||
      lower.includes('tokens per minute')
    ) {
      return {
        status: 413,
        body: {
          error:
            'Data yang dikirim ke AI melebihi batas token per menit. Coba tanyakan lebih spesifik per barang/tanggal.',
        },
      };
    }
    if (
      /\b(401|403)\b/.test(lower) ||
      lower.includes('api_key_invalid') ||
      lower.includes('invalid_api_key') ||
      lower.includes('invalid api key') ||
      lower.includes('incorrect api key') ||
      lower.includes('permission_denied')
    ) {
      return {
        status: 500,
        body: {
          error: `API Key AI ditolak / belum aktif. Periksa GEMINI_API_KEY, GROQ_API_KEY, atau OPENAI_API_KEY di Vercel lalu Redeploy. Detail: ${safeMsg}`,
        },
      };
    }
    if (
      lower.includes('429') ||
      lower.includes('resource_exhausted') ||
      lower.includes('rate_limit') ||
      lower.includes('quota')
    ) {
      return {
        status: 429,
        body: {
          error:
            'Kuota request AI per menit sedang penuh sementara (429). Tunggu beberapa detik lalu coba lagi.',
        },
      };
    }
    if (isTransientErrorMessage(safeMsg)) {
      return {
        status: 503,
        body: {
          error:
            'Server AI sedang sibuk sementara (503). Tunggu beberapa detik lalu coba klik lagi.',
        },
      };
    }
    return {
      status: 500,
      body: {
        error: `Gagal menghubungi AI: ${safeMsg}`,
      },
    };
  }
}

export default async function handler(
  req: { method?: string; body?: unknown },
  res: { status: (code: number) => { json: (data: Record<string, unknown>) => void } }
) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const result = await processAiRequest(req.body);
    return res.status(result.status).json(result.body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: `Server AI error: ${msg}` });
  }
}
