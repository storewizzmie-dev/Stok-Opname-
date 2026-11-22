import { ThinkingLevel } from '@google/genai';
import {
  AiMessageTurn,
  AiProviderPreference,
  generateWithConfiguredProviders,
  isTransientErrorMessage,
} from './_providers';

export interface AiRequestBody {
  action?: 'summary' | 'chat' | 'pnl_analysis';
  provider?: AiProviderPreference;
  contextText?: string;
  question?: string;
  history?: AiMessageTurn[];
  pnlTargetLabel?: string;
}

const SYSTEM_INSTRUCTION = `Kamu adalah Asisten Stok Opname untuk staf toko/restoran (seperti Wizzmie).
Tugasmu membaca data laporan stok opname dari semua data yang diupload (ringkasan bulanan, per bagian, daftar seluruh barang, dan catatan harian) lalu menjelaskannya dengan bahasa Indonesia sehari-hari yang SANGAT SEDERHANA, sopan, singkat, dan langsung bisa dipahami orang awam (tanpa istilah akuntansi yang rumit).

Data yang dikirim ke kamu sudah mencakup:
- Ringkasan periode aktif & daftar semua bulan tersimpan (Menu Beranda & Upload).
- Ringkasan per bagian produksi / operasional (Menu Beranda).
- "Semua Barang pada Periode Dipilih" (seluruh barang di Menu Cek Barang, bukan hanya 10 besar).
- "Ringkasan Harian Bulan Aktif" dan "Rincian Harian Lengkap" berisi baris per tanggal (Tanggal | Nama Barang | Bagian | ESB = catatan sistem ESB | Gudang = Hitungan Gudang | Selisih | Rupiah) seperti di Menu Harian & riwayat Cek Barang.

Aturan menjawab:
1. Selalu cari dan gunakan angka nyata dari bagian "Semua Barang" dan "Rincian Harian Lengkap". Jika pengguna menanyakan barang dan tanggal tertentu (misal "udang keju tanggal 17"), cari baris tanggal tersebut dan sebutkan angka Sistem ESB, Hitungan Gudang, Selisih (jumlah + satuan), dan Rupiahnya secara lengkap. Jangan pernah mengarang angka yang tidak ada.
2. Gunakan istilah yang mudah dipahami:
   - "Kurang (Minus)" = hitungan gudang lebih sedikit dari catatan sistem ESB.
   - "Lebih (Plus)" = hitungan gudang lebih banyak dari catatan sistem ESB.
   - "Sistem ESB vs Hitungan Gudang" = perbandingan catatan sistem ESB dengan hitungan barang nyata di gudang.
3. Saat menyebut barang, sebutkan juga jumlah/satuannya (KG, Porsi, Btl, Dos, Jrg, Pack) DAN nilai Rupiahnya jika ada di data.
4. Jika ada barang yang punya hari minus sekaligus hari plus (sehingga selisih bersihnya kecil atau berbalik plus), ingatkan bahwa itu sering kali tanda salah hitung di salah satu hari atau telat input di sistem ESB, bukan barang hilang permanen.
5. Gunakan format poin-poin singkat agar enak dibaca di layar HP.
6. Fokusmu adalah membaca dan menjelaskan data laporan stok opname (bukan menilai kode/desain aplikasi). Jika pengguna bertanya tentang fitur atau tampilan aplikasi, jelaskan dengan ramah bahwa kamu bertugas membantu menganalisis angka stok, lalu beri 2 contoh pertanyaan stok yang bisa ditanyakan (misalnya menanyakan barang kurang terbesar atau mengecek barang di tanggal tertentu).`;

const PNL_ANALYSIS_SYSTEM_INSTRUCTION = `Kamu adalah analis keuangan restoran yang menjelaskan satu pos laporan Laba Rugi kepada pemilik outlet dengan bahasa Indonesia sehari-hari yang sederhana, cerdas, dan langsung ke inti.

ATURAN WAJIB BENTUK & PANJANG JAWABAN:
- Tulis TEPAT 1 paragraf saja berisi maksimal 3–4 kalimat pendek.
- Panjang ideal 40–70 kata dan DILARANG melebihi 90 kata.
- Jangan membuat daftar bernomor, poin-poin, judul, atau sapaan pembuka. Langsung tulis intinya.

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

export async function processAiRequest(
  rawBody: unknown
): Promise<{ status: number; body: Record<string, unknown> }> {
  let parsedRaw = rawBody;
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
      : 'chat';
  const providerPref = normalizeProvider(body.provider);
  const contextText = String(body.contextText ?? '').trim();

  if (!contextText) {
    return {
      status: 400,
      body: {
        error:
          action === 'pnl_analysis'
            ? 'Data laporan Laba Rugi belum tersedia untuk dianalisis.'
            : 'Data laporan stok belum tersedia. Upload file Excel terlebih dahulu.',
      },
    };
  }

  try {
    if (action === 'pnl_analysis') {
      const targetLabel = String(body.pnlTargetLabel ?? 'Pos Keuangan').trim();
      const prompt = `Analisis singkat (1 paragraf, 3-4 kalimat, ideal 40-70 kata, maksimal 90 kata) khusus untuk pos "${targetLabel}" menggunakan bahasa sehari-hari yang mudah dipahami:\n\n${contextText}`;
      const result = await generateWithConfiguredProviders(providerPref, {
        systemInstruction: PNL_ANALYSIS_SYSTEM_INSTRUCTION,
        userPrompt: prompt,
        thinkingLevel: ThinkingLevel.HIGH,
        maxTokens: 320,
      });
      return {
        status: 200,
        body: { reply: result.reply, provider: result.provider },
      };
    }

    if (action === 'summary') {
      const result = await generateWithConfiguredProviders(providerPref, {
        systemInstruction: SYSTEM_INSTRUCTION,
        userPrompt: buildSummaryPrompt(contextText),
        thinkingLevel: ThinkingLevel.HIGH,
        maxTokens: 1200,
      });
      return {
        status: 200,
        body: { reply: result.reply, provider: result.provider },
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
    const result = await generateWithConfiguredProviders(providerPref, {
      systemInstruction: SYSTEM_INSTRUCTION,
      initialUserContext: `Ini data laporan stok opname & keuangan yang sedang saya lihat:\n\n${contextText}\n\nJawab pertanyaan saya berikutnya berdasarkan data ini.`,
      initialModelAck:
        'Baik, saya sudah membaca data laporan tersebut. Silakan tanyakan apa saja dengan bahasa biasa.',
      history,
      userPrompt: question,
      thinkingLevel: ThinkingLevel.HIGH,
      maxTokens: 1200,
    });

    return {
      status: 200,
      body: { reply: result.reply, provider: result.provider },
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const lower = rawMsg.toLowerCase();

    if (rawMsg.startsWith('MISSING_KEY:')) {
      return {
        status: 500,
        body: {
          error: rawMsg.replace('MISSING_KEY:', ''),
        },
      };
    }
    if (isTransientErrorMessage(rawMsg)) {
      return {
        status: 503,
        body: {
          error:
            'Server AI sedang sibuk sementara (503). Tunggu beberapa detik lalu coba klik lagi.',
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
      lower.includes('401') ||
      lower.includes('403') ||
      lower.includes('400') ||
      lower.includes('api_key') ||
      lower.includes('invalid api key')
    ) {
      return {
        status: 500,
        body: {
          error:
            'API Key AI tidak valid atau belum aktif. Periksa GEMINI_API_KEY / GROQ_API_KEY di Environment Variables server.',
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
