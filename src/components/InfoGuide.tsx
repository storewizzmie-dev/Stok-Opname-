import React, { useEffect } from 'react';
import { HelpCircle, Info, X } from 'lucide-react';

export type InfoGuideKey =
  | 'overview'
  | 'dailyChart'
  | 'categories'
  | 'topProducts'
  | 'harian'
  | 'cekBarang'
  | 'upload';

export interface InfoGuideData {
  title: string;
  purpose: string;
  steps: string[];
  example: string;
}

export const INFO_GUIDES: Record<InfoGuideKey, InfoGuideData> = {
  overview: {
    title: 'Ringkasan Stok Opname',
    purpose:
      'Menunjukkan kondisi stok toko secara keseluruhan apakah lebih banyak barang yang kurang (rugi selisih) atau lebih (surplus), baik dalam 1 bulan penuh maupun di 1 hari tertentu.',
    steps: [
      'Pilih mode "Bulan" di kanan atas untuk melihat total selama sebulan penuh, atau pilih "Hari" untuk melihat total di 1 tanggal saja.',
      'Total Kurang (Minus) adalah jumlah nilai barang yang stok fisiknya lebih sedikit daripada catatan komputer.',
      'Total Lebih (Plus) adalah jumlah nilai barang yang stok fisiknya lebih banyak daripada catatan komputer.',
      'Hasil Akhir adalah selisih bersih (Total Lebih dikurangi Total Kurang). Jika bertanda KURANG (-), total minus masih lebih besar.',
    ],
    example:
      'Misalnya Total Kurang - Rp 20 jt dan Total Lebih + Rp 21 jt, maka Hasil Akhirnya LEBIH + Rp 1 jt karena nilai kelebihannya masih menutup minus.',
  },
  dailyChart: {
    title: 'Grafik Kurang Per Hari',
    purpose:
      'Membantu Anda melihat tanggal mana saja yang mengalami kekurangan stok paling besar sepanjang bulan tanpa harus membuka laporan satu per satu.',
    steps: [
      'Setiap batang mewakili 1 tanggal di bulan tersebut (angka di bawah batang adalah tanggalnya).',
      'Semakin tinggi batang merah, semakin besar nilai barang yang kurang di hari itu. Angka di atas batang ditulis ringkas dalam ribuan (rb) atau jutaan (jt).',
      'Ketuk salah satu batang untuk melihat ringkasan hari itu atau langsung mengganti hari yang sedang dilihat.',
    ],
    example:
      'Jika di atas tanggal 8 tertulis "3,2jt", artinya pada tanggal 8 total barang kurangnya sekitar Rp 3.200.000.',
  },
  categories: {
    title: 'Ringkasan Per Bagian',
    purpose:
      'Mengelompokkan selisih barang berdasarkan bagian penyimpanan atau kategori (seperti Dry Store, WIP, Meat, Vegetable, DBL, Amenities) supaya tahu bagian mana yang paling perlu dicek.',
    steps: [
      'Nama bagian ada di sebelah kiri, lengkap dengan nilai Kurang dan Lebihnya.',
      'Angka di sebelah kanan adalah hasil bersih bagian tersebut (merah jika hasil akhirnya Kurang, hijau jika Lebih).',
      'Ketuk salah satu bagian untuk langsung melihat daftar barangnya di menu Harian.',
    ],
    example:
      'Jika bagian WIP bertuliskan "Kurang Rp 1.500.000", artinya seluruh barang WIP di periode ini total bersihnya kurang Rp 1,5 juta.',
  },
  topProducts: {
    title: 'Ringkasan Per Barang',
    purpose:
      'Menampilkan 10 barang dengan selisih nilai paling besar agar tim toko bisa langsung fokus memeriksa barang yang paling berpengaruh.',
    steps: [
      'Gunakan tombol "Paling Kurang" atau "Paling Lebih" untuk berganti daftar.',
      'Di bawah nama barang tertera jumlah barang yang kurang/lebih lengkap dengan satuannya (KG, Porsi, Btl, Pack) serta perkiraan kemasannya dalam kurung.',
      'Di sebelah kanan tertera total nilai Rupiah dari selisih barang tersebut.',
      'Ketuk nama barang mana saja untuk melihat catatan komputer vs hitungan fisik dari hari ke hari.',
    ],
    example:
      'Jika tertulis "Kurang 28 KG (≈ 2 Dos)" dan "- Rp 850.000", artinya stok fisik barang itu kurang 28 KG atau sekitar 2 dos senilai Rp 850 ribu.',
  },
  harian: {
    title: 'Laporan Harian',
    purpose:
      'Melihat daftar lengkap semua barang yang hitungan fisiknya tidak cocok dengan catatan komputer pada setiap tanggal.',
    steps: [
      'Setiap kotak tanggal hanya menghitung Kurang, Lebih, dan Hasil untuk tanggal tersebut saja (tidak digabung hari lain).',
      'Ketuk tanggal mana saja untuk membuka atau menutup daftar barangnya.',
      'Di tiap baris barang tertera perbandingan "Komputer → Fisik". Komputer adalah stok di aplikasi kasir/gudang, sedangkan Fisik adalah hasil hitung nyata.',
    ],
    example:
      'Jika tertulis "Komputer: 12 → Fisik: 10 KG" dan di kanan "Kurang 2 KG", artinya di komputer tercatat 12 KG tetapi barang nyatanya hanya ada 10 KG.',
  },
  cekBarang: {
    title: 'Cek Riwayat Barang',
    purpose:
      'Melacak riwayat satu barang tertentu untuk mengetahui apakah barang tersebut memang terus-terusan kurang atau hanya salah hitung di satu hari lalu kembali pas di hari berikutnya.',
    steps: [
      'Ketik nama barang di kotak pencarian lalu ketuk barang yang muncul di daftar.',
      'Kotak "Saat Kurang" menjumlahkan hari-hari ketika barang tersebut minus; kotak "Saat Lebih" menjumlahkan hari-hari ketika barang tersebut plus.',
      'Kotak "Hasil Akhir" menggabungkan keduanya. Di bawahnya terdapat rincian tanggal demi tanggal.',
    ],
    example:
      'Jika tgl 5 Kurang 14 KG dan tgl 6 Lebih 14 KG, maka Hasil Akhirnya "0 (Pas)". Artinya barang tidak hilang, kemarin hanya salah hitung atau terlambat input.',
  },
  upload: {
    title: 'Aturan Upload File Excel',
    purpose:
      'Menjelaskan bagaimana sistem menyimpan dan memperbarui data saat Anda mengupload file laporan Stock Opname harian (.xlsx / .xls).',
    steps: [
      'Tanggal sama & bulan sama: data lama di tanggal tersebut otomatis diperbarui (ditimpa) oleh file terbaru agar tidak dihitung dua kali.',
      'Tanggal berbeda & bulan sama: tanggal baru ditambahkan ke bulan tersebut dan total bulanan langsung dihitung ulang.',
      'Bulan berbeda: otomatis dipisahkan ke menu bulan baru agar laporan antar bulan tidak tercampur.',
    ],
    example:
      'Anda boleh mengupload ulang file rekap 1–17 Nov jika ada revisi di tgl 15; sistem akan otomatis memperbarui tanpa membuat data ganda.',
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-white dark:bg-[#141a1c] border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[88vh] flex flex-col"
      >
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
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
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
              Apa fungsi data ini?
            </div>
            <p className="text-slate-800 dark:text-slate-200">{guide.purpose}</p>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
              Cara membacanya:
            </div>
            <ol className="space-y-2">
              {guide.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="mt-0.5 w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-[#1a2224] border border-slate-200/80 dark:border-slate-800 p-3.5">
            <div className="text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">
              Contoh membaca data
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              {guide.example}
            </p>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#101517]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 text-sm font-semibold rounded-xl bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 transition-colors min-h-[44px] cursor-pointer"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
