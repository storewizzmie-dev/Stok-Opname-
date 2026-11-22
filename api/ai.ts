import { ThinkingLevel } from '@google/genai';
import {
  AiMessageTurn,
  AiProviderPreference,
  generateWithConfiguredProviders,
  isTransientErrorMessage,
  resolveProviderOrder,
} from './_providers.js';

export interface AiRequestBody {
  action?: 'summary' | 'chat' | 'pnl_analysis' | 'pnl_chat';
  provider?: AiProviderPreference;
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
   - Jika pengguna menanyakan barang atau tanggal tertentu (misal "udang keju tanggal 17"), cari di bagian "Semua Barang" atau "Rincian Harian" lalu sebutkan angka Sistem ESB, Hitungan Gudang, Selisih (jumlah + satuan), dan nilai Rupiahnya secara lengkap.
   - Jika pengguna menanyakan pos Laba Rugi (misal "berapa Net Profit", "biaya gaji", "Sales Food"), sebutkan nilai Rupiah dan persentasenya terhadap Net Sales sesuai data Menu Laba Rugi.
   - Jangan pernah mengarang angka laporan yang tidak ada di data.
2. Jika pengguna bertanya tentang fungsi fitur atau cara memakai aplikasi ini, jelaskan dengan jelas berdasarkan "PANDUAN FITUR & MENU WEB APP" yang ada di konteks (seperti fungsi Menu Beranda, Harian, Cek Barang, Laba Rugi, Pengaturan, tombol Rentang Tanggal pop-up di pojok kanan dengan klik 1x aktif & klik 2x buka list tanggal serta tarik tanggal 1-30, tombol Cek 1 Hari, atau cara simpan Note Penjelasan Permanen di Laba Rugi).
3. Gunakan istilah yang konsisten dan mudah dipahami:
   - "Kurang (Minus)" = Hitungan Gudang lebih sedikit dari catatan Sistem ESB.
   - "Lebih (Plus)" = Hitungan Gudang lebih banyak dari catatan Sistem ESB.
   - "Sistem ESB vs Hitungan Gudang" = perbandingan catatan Sistem ESB dengan hitungan barang nyata di gudang.
   - Jika ada barang yang punya hari minus sekaligus hari plus (bolak-balik), ingatkan bahwa itu sering kali indikasi salah hitung di salah satu hari atau telat input di Sistem ESB.
4. Format jawaban WAJIB rapi dan nyaman dibaca di HP maupun laptop:
   - Gunakan kalimat paragraf yang mengalir rapi atau poin-poin singkat dengan tanda "-".
   - DILARANG membuat tabel Markdown atau karakter pipa ("|") dan garis pemisah ("---") agar kalimat tidak kacau.`;

const PNL_ANALYSIS_SYSTEM_INSTRUCTION = `Kamu adalah analis keuangan restoran yang menjelaskan satu pos laporan Laba Rugi kepada pemilik outlet dengan bahasa Indonesia sehari-hari yang sederhana, cerdas, rapi, dan langsung ke inti.

ATURAN WAJIB BENTUK & PANJANG JAWABAN:
- Tulis TEPAT 1 paragraf saja berisi maksimal 3–4 kalimat pendek yang mengalir rapi.
- Panjang ideal 40–70 kata dan DILARANG melebihi 90 kata.
- DILARANG keras membuat tabel Markdown, garis tabel (|---|---|), karakter pipa (|), garis pemisah (---), heading (#), daftar bernomor, atau sapaan pembuka. Tulis hanya kalimat paragraf biasa yang rapi.

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
- Tulis dalam bentuk kalimat paragraf yang rapi dan mudah dibaca (atau poin singkat memakai tanda hubung "-" hanya jika membandingkan beberapa pos, maksimal 4 baris).
- DILARANG keras membuat tabel Markdown, karakter pipa ("|"), garis pemisah ("---" atau "|---|"), heading ("#"), atau blok kode. Semua angka dan perbandingan harus ditulis dalam kalimat yang mengalir rapi.

Aturan isi:
1. Gunakan HANYA angka nyata dari data laporan Laba Rugi yang dikirimkan. Jangan mengarang angka atau penyebab yang tidak ada di laporan.
2. Jawab langsung pertanyaan pengguna secara ringkas dan jelas (2–5 kalimat).
3. Jika pengguna menanyakan cara menghitung, porsi %, selisih bulan lalu, atau pos terbesar/terkecil terkait topik yang ditanya, tampilkan angka Rupiah dan % dari Net Sales-nya secara akurat di dalam kalimat.
4. Hindari istilah akuntansi yang kaku atau berbelit-belit.`;

function cleanAiProse(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let tableHeaders: string[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
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
        .map((c) => c.trim())
        .filter(Boolean);

      if (cells.length === 0) continue;

      const nextLine = (lines[i + 1] ?? '').trim();
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
    out.push(line);
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildSummaryPrompt(contextText: string): string {
  return `Berikut data laporan stok opname saat ini:

${contextText}

Tolong buatkan ringkasan yang sangat gampang dibaca oleh orang awam dengan format 4 bagian singkat:
1. **Kesimpulan Utama**: Total barang kurang, total barang lebih, dan hasil gabungannya dalam Rupiah.
2. **Barang yang Wajib Dicek Duluan**: Sebutkan 3–5 barang paling kurang terbesar (jumlah + satuan + Rupiahnya).
3. **Catatan Salah Hitung / Bolak-Balik**: Jika ada barang yang kadang minus lalu besoknya plus, sebutkan agar staf cek ulang hitungannya.
4. **Saran Langkah Hari Ini**: 2 langkah praktis untuk tim toko dan bagian produksi / operasional.`;
}

function normalizeProvider(raw: unknown): AiProviderPreference {
  if (raw === 'gemini' || raw === 'groq') return raw;
  return 'auto';
}

function compactContextForGroq(
  contextText: string,
  question?: string,
  maxChars = 11_500
): string {
  if (contextText.length <= maxChars) return contextText;

  const keywords = (question ?? '')
    .toLowerCase()
    .split(/[\s,?.!:/-]+/)
    .filter((w) => w.length >= 2);

  const lines = contextText.split('\n');
  const priorityLines: string[] = [];
  const detailLines: string[] = [];
  let inLongDetailSection = false;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      lower.startsWith('semua barang pada periode') ||
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
      lower.startsWith('=== data laba rugi')
    ) {
      inLongDetailSection = false;
    }

    if (!inLongDetailSection) {
      priorityLines.push(line);
    } else if (
      keywords.length > 0 &&
      keywords.some((kw) => lower.includes(kw))
    ) {
      priorityLines.push(line);
    } else {
      detailLines.push(line);
    }
  }

  const out: string[] = [];
  let used = 0;

  for (const line of priorityLines) {
    if (used + line.length + 1 > maxChars - 300) break;
    out.push(line);
    used += line.length + 1;
  }

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
    const isGroq =
      providerPref === 'groq' ||
      (providerPref === 'auto' && resolveProviderOrder(providerPref)[0] === 'groq');
    const effectiveContext = isGroq
      ? compactContextForGroq(contextText, body.question)
      : contextText;

    if (action === 'pnl_analysis') {
      const targetLabel = String(body.pnlTargetLabel ?? 'Pos Keuangan').trim();
      const prompt = `Analisis singkat (1 paragraf rapi tanpa tabel dan tanpa garis pemisah, 3-4 kalimat, ideal 40-70 kata, maksimal 90 kata) khusus untuk pos "${targetLabel}" menggunakan bahasa sehari-hari yang mudah dipahami:\n\n${effectiveContext}`;
      const result = await generateWithConfiguredProviders(providerPref, {
        systemInstruction: PNL_ANALYSIS_SYSTEM_INSTRUCTION,
        userPrompt: prompt,
        thinkingLevel: ThinkingLevel.HIGH,
        maxTokens: 320,
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
      const history = isGroq ? rawHistory.slice(-4) : rawHistory.slice(-8);
      const initialAnalysis = String(body.initialAnalysis ?? '').trim();

      const result = await generateWithConfiguredProviders(providerPref, {
        systemInstruction: PNL_CHAT_SYSTEM_INSTRUCTION,
        initialUserContext: `Ini data laporan Laba Rugi aktual untuk pos "${targetLabel}":\n\n${effectiveContext}\n\nJawab pertanyaan lanjutan saya berdasarkan data laporan ini dalam bentuk kalimat yang rapi tanpa tabel.`,
        initialModelAck:
          initialAnalysis ||
          'Baik, saya sudah membaca data Laba Rugi tersebut. Silakan ajukan pertanyaan.',
        history,
        userPrompt: question,
        thinkingLevel: ThinkingLevel.HIGH,
        maxTokens: isGroq ? 550 : 900,
      });

      return {
        status: 200,
        body: { reply: cleanAiProse(result.reply), provider: result.provider },
      };
    }

    if (action === 'summary') {
      const result = await generateWithConfiguredProviders(providerPref, {
        systemInstruction: SYSTEM_INSTRUCTION,
        userPrompt: buildSummaryPrompt(effectiveContext),
        thinkingLevel: ThinkingLevel.HIGH,
        maxTokens: isGroq ? 650 : 1200,
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
    const history = isGroq ? rawHistory.slice(-4) : rawHistory.slice(-8);
    const result = await generateWithConfiguredProviders(providerPref, {
      systemInstruction: SYSTEM_INSTRUCTION,
      initialUserContext: `Ini seluruh informasi fitur aplikasi web beserta data laporan Stok Opname & Laba Rugi dari semua menu:\n\n${effectiveContext}\n\nJawab pertanyaan saya berikutnya dengan bahasa sederhana dan kalimat yang rapi (tanpa tabel Markdown).`,
      initialModelAck:
        'Baik, saya sudah memahami seluruh fitur aplikasi serta membaca data Stok Opname dan Laba Rugi di semua menu. Silakan tanyakan apa saja.',
      history,
      userPrompt: question,
      thinkingLevel: ThinkingLevel.HIGH,
      maxTokens: isGroq ? 750 : 1400,
    });

    return {
      status: 200,
      body: { reply: cleanAiProse(result.reply), provider: result.provider },
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const safeMsg = rawMsg
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
    if (isTransientErrorMessage(safeMsg)) {
      return {
        status: 503,
        body: {
          error:
            'Server AI sedang sibuk sementara (503). Tunggu beberapa detik lalu coba klik lagi.',
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
            'Data yang dikirim ke Groq melebihi batas paket gratis (8.000 token/menit). Coba tanyakan lebih spesifik per barang/tanggal atau gunakan Gemini AI.',
        },
      };
    }
    if (
      lower.includes('429') ||
      lower.includes('resource_exhausted') ||
      lower.includes('quota')
    ) {
      return {
        status: 429,
        body: {
          error:
            'Kuota AI sedang penuh sementara. Tunggu sebentar lalu coba lagi.',
        },
      };
    }
    if (
      /\b(401|403)\b/.test(lower) ||
      lower.includes('api_key_invalid') ||
      lower.includes('invalid_api_key') ||
      lower.includes('invalid api key') ||
      lower.includes('permission_denied')
    ) {
      return {
        status: 500,
        body: {
          error: `API Key AI ditolak / belum aktif. Periksa GEMINI_API_KEY atau GROQ_API_KEY di Vercel lalu Redeploy. Detail: ${safeMsg}`,
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
