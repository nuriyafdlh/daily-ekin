export const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const HARI = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];

export const formatTanggalLengkap = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const hari = HARI[d.getDay()];
    const tgl = d.getDate();
    const bln = BULAN[d.getMonth()];
    const thn = d.getFullYear();
    return `${hari}, ${tgl} ${bln} ${thn}`;
  } catch {
    return dateStr;
  }
};

export const formatTanggalPendek = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const tgl = d.getDate();
    const bln = BULAN[d.getMonth()].slice(0, 3);
    const thn = d.getFullYear();
    return `${tgl} ${bln} ${thn}`;
  } catch {
    return dateStr;
  }
};

export const formatPeriodeBulan = (monthStr: string): string => {
  if (!monthStr || monthStr.length < 7) return '-';
  const parts = monthStr.split('-');
  const thn = parts[0];
  const blnIndex = parseInt(parts[1], 10) - 1;
  return `${BULAN[blnIndex] || parts[1]} ${thn}`;
};

export const hitungMenitDurasi = (mulai: string, selesai: string): number => {
  if (!mulai || !selesai) return 0;
  try {
    const [h1, m1] = mulai.split(':').map(Number);
    const [h2, m2] = selesai.split(':').map(Number);
    const menit1 = h1 * 60 + m1;
    const menit2 = h2 * 60 + m2;
    const diff = menit2 - menit1;
    return diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
};

export const formatDurasi = (menit: number): string => {
  if (menit <= 0) return '0 m';
  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;
  if (jam === 0) return `${sisaMenit} m`;
  if (sisaMenit === 0) return `${jam} j`;
  return `${jam} j ${sisaMenit} m`;
};

export const formatDurasiLengkap = (menit: number): string => {
  if (menit <= 0) return '0 menit';
  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;
  if (jam === 0) return `${sisaMenit} menit`;
  if (sisaMenit === 0) return `${jam} jam`;
  return `${jam} jam ${sisaMenit} menit`;
};

export const getHariIniISO = (): string => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export const getBulanIniISO = (): string => {
  return getHariIniISO().slice(0, 7);
};

export const isUrl = (str: string): boolean => {
  if (!str) return false;
  return /^https?:\/\//i.test(str.trim());
};

export const uid = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
};
