import { AppState, RhkItem, LogItem, UserProfile } from '../types';
import { getHariIniISO, getBulanIniISO } from './formatters';

export const STORAGE_KEY = 'kinerja-harian-v2';
export const LEGACY_STORAGE_KEY = 'kinerja-harian-v1';

export const DEFAULT_PROFILE: UserProfile = {
  nama: 'Nuriya Fadilah',
  nip: '19950815 202203 2 004',
  pangkatGol: 'Penata Muda / III/a',
  jabatan: 'Penata Kelola Sistem dan Teknologi Informasi',
  unitKerja: 'Bidang Aplikasi Informatika, Dinas Komunikasi dan Informatika',
  instansi: 'Pemerintah Kabupaten Bangkalan',
  atasanNama: 'Moch. Hasan, S.Kom., M.T.',
  atasanNip: '19820512 200801 1 009',
  atasanJabatan: 'Kepala Bidang Aplikasi Informatika',
};

export const INITIAL_RHK: RhkItem[] = [
  {
    id: 'rhk-1',
    nama: 'Terkelolanya aduan dan aspirasi masyarakat melalui SP4N-LAPOR! secara cepat dan sesuai SLA',
    ind: '100% aduan masyarakat terdistribusi dan ditindaklanjuti OPD teknis ≤ 3 hari kerja',
    kategori: 'Utama',
  },
  {
    id: 'rhk-2',
    nama: 'Terlaksananya pemeliharaan, monitoring, dan pengamanan server serta sistem aplikasi pemerintah daerah',
    ind: 'Uptime layanan aplikasi dan server Diskominfo mencapai minimal 99% per bulan',
    kategori: 'Utama',
  },
  {
    id: 'rhk-3',
    nama: 'Terselenggaranya asistensi teknis dan pendampingan implementasi SPBE bagi seluruh Organisasi Perangkat Daerah (OPD)',
    ind: 'Jumlah OPD yang mendapatkan pendampingan arsitektur SPBE minimal 15 OPD per semester',
    kategori: 'Utama',
  },
  {
    id: 'rhk-4',
    nama: 'Tersusunnya dokumentasi teknis, SOP operasional sistem informasi, dan laporan kinerja berkala',
    ind: 'Tersusunnya 1 dokumen laporan rekapitulasi kinerja bulanan tepat waktu',
    kategori: 'Tambahan',
  },
];

export const INITIAL_LOGS: LogItem[] = [
  {
    id: 'log-1',
    tgl: getHariIniISO(),
    mulai: '07:30',
    selesai: '10:00',
    ur: 'Melakukan verifikasi dan disposisi 4 tiket pengaduan masyarakat pada aplikasi SP4N-LAPOR! ke Dinas Lingkungan Hidup dan Dinas PUPR',
    bukti: 'https://drive.google.com/file/d/disposisi-sp4n-lapor/view',
    rhk: 'rhk-1',
  },
  {
    id: 'log-2',
    tgl: getHariIniISO(),
    mulai: '10:15',
    selesai: '12:00',
    ur: 'Pemeriksaan rutin kesehatan server database utama, monitoring utilitas RAM dan kapasitas storage VM Diskominfo',
    bukti: 'log_monitoring_server_proxmox.pdf',
    rhk: 'rhk-2',
  },
  {
    id: 'log-3',
    tgl: getHariIniISO(),
    mulai: '13:00',
    selesai: '15:30',
    ur: 'Memberikan bimbingan teknis integrasi SSO Satu Data dan pemanfaatan tanda tangan elektronik (TTE) kepada staf Bappeda',
    bukti: 'https://kominfo.bangkalankab.go.id/dokumentasi-bimtek-tte',
    rhk: 'rhk-3',
  },
];

export const getDefaultState = (): AppState => {
  return {
    prof: { ...DEFAULT_PROFILE },
    rhk: [...INITIAL_RHK],
    log: [...INITIAL_LOGS],
    ringkas: {},
    theme: 'system',
  };
};

export const loadState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        prof: { ...DEFAULT_PROFILE, ...(parsed.prof || {}) },
        rhk: Array.isArray(parsed.rhk) ? parsed.rhk : INITIAL_RHK,
        log: Array.isArray(parsed.log) ? parsed.log : INITIAL_LOGS,
        ringkas: parsed.ringkas || {},
        theme: parsed.theme || 'system',
      };
    }

    // Check if legacy v1 storage exists
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const migrated: AppState = {
        prof: {
          ...DEFAULT_PROFILE,
          nama: parsed.prof?.nama || DEFAULT_PROFILE.nama,
          nip: parsed.prof?.nip || DEFAULT_PROFILE.nip,
          jabatan: parsed.prof?.jab || DEFAULT_PROFILE.jabatan,
          unitKerja: parsed.prof?.unit || DEFAULT_PROFILE.unitKerja,
        },
        rhk: Array.isArray(parsed.rhk) && parsed.rhk.length > 0 ? parsed.rhk : INITIAL_RHK,
        log: Array.isArray(parsed.log) ? parsed.log : INITIAL_LOGS,
        ringkas: parsed.ringkas || {},
        theme: 'system',
      };
      saveState(migrated);
      return migrated;
    }
  } catch (err) {
    console.warn('Gagal memuat state dari storage, menggunakan state default', err);
  }
  return getDefaultState();
};

export const saveState = (state: AppState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Gagal menyimpan ke localStorage:', err);
  }
};
