export interface UserProfile {
  nama: string;
  nip: string;
  pangkatGol: string;
  jabatan: string;
  unitKerja: string;
  instansi: string;
  atasanNama: string;
  atasanNip: string;
  atasanJabatan: string;
}

export interface RhkItem {
  id: string;
  nama: string;
  ind?: string; // Indikator Kinerja Individu / Target
  kategori?: 'Utama' | 'Tambahan';
  createdAt?: string;
}

export interface LogItem {
  id: string;
  tgl: string; // YYYY-MM-DD
  mulai: string; // HH:mm
  selesai: string; // HH:mm
  ur: string; // Uraian kegiatan
  bukti: string; // Bukti dukung (URL link atau nama file)
  rhk: string; // ID of the RhkItem (or empty string if unclassified)
  output?: string; // Hasil / luaran kegiatan
  createdAt?: string;
}

export interface AppState {
  prof: UserProfile;
  rhk: RhkItem[];
  log: LogItem[];
  ringkas: Record<string, string[]>; // key: `${periode}|${rhkId}`, value: action plan bullet strings
  theme: 'light' | 'dark' | 'system';
}

export interface AiClassificationResult {
  id: string;
  rhkId: string | null;
  confidence?: number;
  alasan?: string;
}

export interface AiActionPlanResult {
  rhkId: string;
  rencanaAksi: string[];
}
