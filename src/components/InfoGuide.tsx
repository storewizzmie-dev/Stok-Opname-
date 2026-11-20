import React, { useEffect } from 'react';
import { HelpCircle, Info, X } from 'lucide-react';

export type InfoGuideKey =
  | 'overview'
  | 'dailyChart'
  | 'categories'
  | 'topProducts'
  | 'harian'
  | 'cekBarang'
  | 'upload'
  | 'aiAssistant';

export interface InfoGuideData {
  title: string;
  purpose: string;
  steps: { label: string; text: string }[];
  example: string;
}

export const INFO_GUIDES: Record<InfoGuideKey, InfoGuideData> = {
  overview: {
    title: 'Cara Membaca 3 Angka Utama',
    purpose:
      'Membandingkan catatan di sistem ESB dengan hitungan gudang, sekaligus melihat total dampak selisih uangnya.',
    steps: [
      {
        label: '1. Barang Kurang (Minus)',
        text: 'Total nilai barang yang saat hitungan gudang jumlahnya lebih sedikit daripada catatan sistem ESB.',
      },
      {
        label: '2. Barang Lebih (Plus)',
        text: 'Total nilai barang yang saat hitungan gudang jumlahnya lebih banyak daripada catatan sistem ESB.',
      },
      {
        label: '3. Hasil Gabungan (Fungsi & Rumusnya)',
        text: 'Dihitung dari Total Lebih dikurangi Total Kurang. Fungsinya untuk melihat apakah total nilai uang bulan ini masih tekor (minus) atau nilainya tertutupi oleh barang yang lebih. Tetap cek barang minus di bawah satu per satu agar tahu penyebab selisihnya.',
      },
      {
        label: 'Tombol Rekap Sebulan / Cek 1 Hari',
        text: 'Pilih "Rekap Sebulan" untuk melihat total 1 bulan penuh, atau pilih "Cek 1 Hari" untuk mengecek 1 tanggal saja.',
      },
    ],
    example:
      'Misalnya Barang Kurang Rp 2 jt dan Barang Lebih Rp 3 jt. Hasil Gabungannya: 3 jt − 2 jt = Lebih Rp 1 jt (secara total rupiah tidak tekor, tapi barang yang kurang Rp 2 jt tetap dicek di daftar bawah).',
  },
  dailyChart: {
    title: 'Tanggal Mana yang Paling Banyak Kurang?',
    purpose:
      'Mencari tahu tanggal berapa saja barang di gudang paling banyak kurangnya.',
    steps: [
      {
        label: 'Tinggi balok merah',
        text: 'Makin tinggi baloknya, makin besar nilai barang yang kurang pada tanggal itu.',
      },
      {
        label: 'Singkatan rb & jt',
        text: '"rb" artinya ribuan, "jt" artinya jutaan. Contoh: 500rb = Rp 500.000, dan 2,5jt = Rp 2.500.000.',
      },
      {
        label: 'Ketuk balok tanggal',
        text: 'Untuk melihat berapa kurang dan lebih di tanggal tersebut, lalu langsung buka daftar barangnya.',
      },
    ],
    example:
      'Kalau balok tanggal 8 paling tinggi dan di atasnya tertulis "3,2jt", artinya di tanggal 8 ada barang kurang senilai sekitar Rp 3,2 juta.',
  },
  categories: {
    title: 'Kondisi Per Bagian (Produksi / Operasional)',
    purpose:
      'Mengetahui bagian produksi atau operasional mana yang paling sering selisih (seperti WIP, Dry Store, Meat, atau Sayur).',
    steps: [
      {
        label: 'Nama bagian di kiri',
        text: 'Di bawahnya ada total Kurang dan Lebih milik bagian tersebut.',
      },
      {
        label: 'Angka di kanan',
        text: 'Hasil gabungan bagian itu. Merah artinya secara total masih Kurang, Hijau artinya masih Lebih.',
      },
      {
        label: 'Ketuk nama bagian',
        text: 'Untuk langsung melihat barang apa saja di bagian tersebut yang tidak pas.',
      },
    ],
    example:
      'Jika baris "WIP" bertuliskan merah "Kurang Rp 1.200.000", artinya seluruh bahan WIP jika dijumlahkan masih kurang Rp 1,2 juta.',
  },
  topProducts: {
    title: 'Barang yang Perlu Dicek Duluan',
    purpose:
      'Menunjukkan 10 barang dengan selisih uang paling besar supaya Anda langsung tahu barang mana yang harus dicek duluan.',
    steps: [
      {
        label: 'Jumlah & satuan di bawah nama',
        text: 'Memberitahu berapa banyak barang yang kurang atau lebih (contoh: KG, Porsi, Btl, Pack) beserta perkiraan dos/jerigennya.',
      },
      {
        label: 'Uang di sebelah kanan',
        text: 'Nilai rupiah dari barang yang kurang (-) atau lebih (+) tersebut.',
      },
      {
        label: 'Ketuk nama barang',
        text: 'Untuk melihat di tanggal mana saja barang ini kurang atau lebih.',
      },
    ],
    example:
      'Tertulis "Minyak Goreng — Kurang 18 L (sekitar 1 Jrg) — - Rp 300.000". Artinya minyak goreng di gudang kurang 18 liter atau sekitar 1 jerigen senilai Rp 300 ribu.',
  },
  harian: {
    title: 'Catatan Harian',
    purpose:
      'Melihat daftar semua barang (yang kurang, lebih, maupun pas) di setiap tanggal.',
    steps: [
      {
        label: 'Angka per tanggal berdiri sendiri',
        text: 'Kurang, Lebih, dan Hasil pada tiap tanggal hanya menghitung hari itu saja (tidak dicampur tanggal lain).',
      },
      {
        label: 'Di Sistem ESB vs Hitungan Gudang',
        text: '"Di Sistem ESB" adalah jumlah stok menurut sistem ESB. "Hitungan Gudang" adalah jumlah barang nyata yang dihitung di gudang.',
      },
      {
        label: 'Ketuk tanggal',
        text: 'Untuk membuka atau menutup daftar barang pada tanggal tersebut.',
      },
    ],
    example:
      'Tertulis "Di Sistem ESB: 10 · Hitungan Gudang: 8 KG" dan di kanan "Kurang 2 KG". Artinya di sistem ESB tercatat ada 10 KG, tapi hitungan gudang cuma ada 8 KG (kurang 2 KG).',
  },
  cekBarang: {
    title: 'Cek Riwayat Barang',
    purpose:
      'Mengecek satu barang dari hari ke hari supaya tahu apakah barang itu benar-benar hilang atau kemarin hanya salah hitung.',
    steps: [
      {
        label: 'Saat Kurang',
        text: 'Menjumlahkan hari-hari ketika barang tersebut minus.',
      },
      {
        label: 'Saat Lebih',
        text: 'Menjumlahkan hari-hari ketika barang tersebut plus.',
      },
      {
        label: 'Hasil Akhir',
        text: 'Gabungan keduanya. Jika kemarin minus lalu besoknya plus dengan jumlah sama, Hasil Akhirnya jadi 0 (Pas).',
      },
    ],
    example:
      'Tgl 5 tepung kurang 14 KG karena lupa dihitung 1 dos, lalu tgl 6 dos itu ketemu jadi lebih 14 KG. Hasil Akhirnya "0 (Pas)" — berarti tepung tidak hilang, kemarin hanya salah hitung.',
  },
  upload: {
    title: 'Cara Kerja Upload Excel',
    purpose:
      'Supaya Anda aman mengupload file harian berkali-kali tanpa takut data dobel atau tercampur antar bulan.',
    steps: [
      {
        label: 'Tanggal sama, bulan sama',
        text: 'Data lama di tanggal itu langsung diganti dengan file baru (tidak dihitung dobel).',
      },
      {
        label: 'Tanggal baru, bulan sama',
        text: 'Otomatis ditambahkan ke bulan tersebut dan totalnya langsung terhitung.',
      },
      {
        label: 'Bulan berbeda',
        text: 'Otomatis dibuatkan menu bulan baru yang terpisah.',
      },
    ],
    example:
      'Kalau file tanggal 15 ada perbaikan lalu Anda upload lagi, data tanggal 15 langsung diperbarui otomatis.',
  },
  aiAssistant: {
    title: 'Asisten AI Stok',
    purpose:
      'Membantu Anda membaca angka laporan stok opname secara otomatis memakai bahasa sehari-hari yang gampang dipahami.',
    steps: [
      {
        label: 'Tombol Ringkas Otomatis',
        text: 'Sekali ketuk, AI langsung menyimpulkan barang mana yang aman, mana yang kurang besar, dan apa yang perlu dicek hari ini.',
      },
      {
        label: 'Tanya Bebas',
        text: 'Anda bisa bertanya dengan kalimat biasa, misalnya menanyakan barang tertentu atau bagian produksi / operasional yang sering selisih.',
      },
      {
        label: 'Sesuai Pilihan Bulan / Hari',
        text: 'AI membaca data sesuai tampilan yang sedang Anda pilih di atas (mode Bulan atau mode Hari).',
      },
    ],
    example:
      'Coba tanya: "Barang apa yang kemarin kurang lalu besoknya lebih?" — AI akan langsung mencarikan daftarnya.',
  },
};

export function InfoButton({
  guideKey,
  onOpen,
  label,
}: {
  guideKey: InfoGuideKey;
  onOpen: (key: InfoGuideKey) => void;
  label?: string;
}) {
  const guide = INFO_GUIDES[guideKey];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(guideKey);
      }}
      title={`Penjelasan: ${guide.title}`}
      aria-label={`Info cara membaca ${guide.title}`}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors min-h-[32px] cursor-pointer shrink-0"
    >
      <Info className="w-4 h-4" />
      {label && <span>{label}</span>}
    </button>
  );
}

export function InfoDialog({
  guideKey,
  onClose,
}: {
  guideKey: InfoGuideKey | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!guideKey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [guideKey, onClose]);

  if (!guideKey) return null;
  const guide = INFO_GUIDES[guideKey];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-dialog-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/35 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface-3d w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[88vh] flex flex-col"
      >
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
              <HelpCircle className="w-4 h-4" />
            </span>
            <h2
              id="info-dialog-title"
              className="text-base font-bold text-slate-900 dark:text-white truncate"
            >
              Cara Membaca: {guide.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan"
            className="btn-3d-soft p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
              Untuk apa data ini?
            </div>
            <p className="text-slate-900 dark:text-slate-100 font-medium">
              {guide.purpose}
            </p>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
              Cara membacanya:
            </div>
            <ul className="space-y-2.5">
              {guide.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="mt-0.5 w-5 h-5 rounded-md bg-teal-50 dark:bg-slate-800 text-teal-800 dark:text-slate-200 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">
                      {step.label}:
                    </strong>{' '}
                    <span>{step.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-teal-50/75 dark:bg-teal-950/30 p-4">
            <div className="text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">
              Contoh gampangnya
            </div>
            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200">
              {guide.example}
            </p>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#101517]">
          <button
            type="button"
            onClick={onClose}
            className="btn-3d-primary w-full py-2.5 px-4 text-sm font-semibold rounded-xl min-h-[44px] cursor-pointer"
          >
            Saya Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
