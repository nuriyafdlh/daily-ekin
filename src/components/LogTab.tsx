import React, { useState, useRef } from 'react';
import { AppState, RhkItem, LogItem } from '../types';
import {
  Plus,
  Clock,
  Calendar,
  Sparkles,
  Link as LinkIcon,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit3,
  Trash2,
  Table as TableIcon,
  LayoutGrid,
  Check,
  UploadCloud,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import {
  uid,
  hitungMenitDurasi,
  formatDurasiLengkap,
  formatTanggalLengkap,
  formatTanggalPendek,
  getHariIniISO,
  getBulanIniISO,
  isUrl,
} from '../utils/formatters';
import { uploadBuktiToDrive } from '../services/googleDrive';
import { getAccessToken, googleSignIn } from '../services/firebase';

interface LogTabProps {
  state: AppState;
  onSaveLog: (log: LogItem) => void;
  onDeleteLog: (id: string) => void;
  onBatchUpdateRhk: (logIds: string[], rhkId: string) => void;
  onBatchDelete: (logIds: string[]) => void;
  initialOpenAdd?: boolean;
}

const COMMON_ACTIVITIES = [
  'Verifikasi dan tindak lanjut aduan masyarakat pada aplikasi SP4N-LAPOR!',
  'Pemeriksaan rutin kesehatan dan utilitas resource server data center',
  'Pendampingan teknis implementasi SPBE bagi perangkat daerah',
  'Menghadiri rapat koordinasi teknis penyusunan rencana kerja OPD',
  'Penyusunan draf laporan evaluasi capaian kinerja bulanan',
  'Pemeliharaan jaringan lokal (LAN) dan akses internet instansi',
];

const WORKING_HOURS_PRESETS = [
  { label: '07:30 – 16:00 (Senin–Kamis)', mulai: '07:30', selesai: '16:00' },
  { label: '07:30 – 16:30 (Jumat)', mulai: '07:30', selesai: '16:30' },
  { label: '08:00 – 15:00 (Ramadan)', mulai: '08:00', selesai: '15:00' },
  { label: 'Pagi (08:00 – 12:00)', mulai: '08:00', selesai: '12:00' },
  { label: 'Siang (13:00 – 16:00)', mulai: '13:00', selesai: '16:00' },
];

export const LogTab: React.FC<LogTabProps> = ({
  state,
  onSaveLog,
  onDeleteLog,
  onBatchUpdateRhk,
  onBatchDelete,
  initialOpenAdd = false,
}) => {
  const today = getHariIniISO();
  const currentMonth = getBulanIniISO();

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(initialOpenAdd);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tgl, setTgl] = useState(today);
  const [mulai, setMulai] = useState('07:30');
  const [selesai, setSelesai] = useState('16:00');
  const [ur, setUr] = useState('');
  const [bukti, setBukti] = useState('');
  const [rhkId, setRhkId] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishMessage, setPolishMessage] = useState<string | null>(null);

  // Google Drive upload state
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [driveUploadSuccess, setDriveUploadSuccess] = useState<string | null>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);

  // Filters State
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRhk, setFilterRhk] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchTargetRhk, setBatchTargetRhk] = useState('');

  const currentDurationMinutes = hitungMenitDurasi(mulai, selesai);

  const handleOpenAdd = () => {
    setEditingId(null);
    setTgl(today);
    setMulai('07:30');
    setSelesai('16:00');
    setUr('');
    setBukti('');
    setRhkId(state.rhk.length > 0 ? state.rhk[0].id : '');
    setIsFormOpen(true);
    setPolishMessage(null);
    setDriveUploadSuccess(null);
  };

  const handleOpenEdit = (item: LogItem) => {
    setEditingId(item.id);
    setTgl(item.tgl);
    setMulai(item.mulai);
    setSelesai(item.selesai);
    setUr(item.ur);
    setBukti(item.bukti || '');
    setRhkId(item.rhk || '');
    setIsFormOpen(true);
    setPolishMessage(null);
    setDriveUploadSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setUr('');
    setBukti('');
    setPolishMessage(null);
    setDriveUploadSuccess(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgl || !mulai || !selesai || !ur.trim()) {
      alert('Mohon lengkapi tanggal, jam kerja, dan uraian kegiatan.');
      return;
    }
    if (hitungMenitDurasi(mulai, selesai) <= 0) {
      alert('Jam selesai harus setelah jam mulai.');
      return;
    }

    onSaveLog({
      id: editingId || uid(),
      tgl,
      mulai,
      selesai,
      ur: ur.trim(),
      bukti: bukti.trim(),
      rhk: rhkId,
    });

    handleCancelForm();
  };

  // Google Drive File Upload Handler
  const handleDriveFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let token = getAccessToken();
    if (!token) {
      try {
        const authResult = await googleSignIn();
        token = authResult.accessToken;
      } catch (err: any) {
        alert('Gagal menghubungkan Google Drive. Silakan login akun Google terlebih dahulu.');
        return;
      }
    }

    if (!token) {
      alert('Izin Google Drive belum aktif. Silakan hubungkan akun Google Anda.');
      return;
    }

    setIsUploadingDrive(true);
    setDriveUploadSuccess(null);

    try {
      const selectedRhkIndex = state.rhk.findIndex((r) => r.id === rhkId);
      const rhkNomor = selectedRhkIndex >= 0 ? selectedRhkIndex + 1 : 'Umum';
      const rhkObj = state.rhk.find((r) => r.id === rhkId);
      const rhkTitle = rhkObj ? rhkObj.nama : 'Umum';
      const monthPeriod = tgl.slice(0, 7);

      const result = await uploadBuktiToDrive(token, file, monthPeriod, rhkNomor, rhkTitle);

      // Automatically set the supporting evidence link to the Google Drive URL
      setBukti(result.webViewLink);
      setDriveUploadSuccess(
        `Berkas berhasil diunggah ke Google Drive di: ${result.folderPath}`
      );
    } catch (err: any) {
      console.error('Drive upload error:', err);
      alert('Gagal mengunggah berkas ke Google Drive: ' + (err.message || 'Error'));
    } finally {
      setIsUploadingDrive(false);
      if (fileUploadInputRef.current) fileUploadInputRef.current.value = '';
    }
  };

  // AI Refine Action
  const handleRefineWithAi = async () => {
    if (!ur.trim()) return;
    setIsPolishing(true);
    setPolishMessage(null);

    const selectedRhkObj = state.rhk.find((r) => r.id === rhkId);
    try {
      const res = await fetch('/api/ai/refine-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ur,
          rhkContext: selectedRhkObj ? selectedRhkObj.nama : '',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.refined) {
          setUr(data.refined);
          setPolishMessage('✨ Uraian disempurnakan dengan tata bahasa ASN formal');
        }
      }
    } catch {
      // Fallback
      if (!ur.toLowerCase().startsWith('melakukan') && !ur.toLowerCase().startsWith('menyusun')) {
        setUr('Melaksanakan kegiatan ' + ur);
      }
    } finally {
      setIsPolishing(false);
      setTimeout(() => setPolishMessage(null), 4000);
    }
  };

  const handleSetPresetHours = (preset: typeof WORKING_HOURS_PRESETS[0]) => {
    setMulai(preset.mulai);
    setSelesai(preset.selesai);
  };

  // Filter logs
  const filteredLogs = state.log
    .filter((log) => {
      if (filterMonth && !log.tgl.startsWith(filterMonth)) return false;
      if (filterRhk === 'unclassified') {
        if (log.rhk && state.rhk.some((r) => r.id === log.rhk)) return false;
      } else if (filterRhk !== 'all') {
        if (log.rhk !== filterRhk) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesUr = log.ur.toLowerCase().includes(q);
        const matchesBukti = (log.bukti || '').toLowerCase().includes(q);
        const matchesTgl = log.tgl.includes(q);
        if (!matchesUr && !matchesBukti && !matchesTgl) return false;
      }
      return true;
    })
    .sort((a, b) => (b.tgl + b.mulai).localeCompare(a.tgl + a.mulai));

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredLogs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLogs.map((l) => l.id));
    }
  };

  const handleApplyBatchRhk = () => {
    if (!batchTargetRhk || selectedIds.length === 0) return;
    onBatchUpdateRhk(selectedIds, batchTargetRhk);
    setSelectedIds([]);
  };

  const handleBatchDeleteClick = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Hapus ${selectedIds.length} kegiatan yang dipilih?`)) {
      onBatchDelete(selectedIds);
      setSelectedIds([]);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-16 sm:pb-0">
      {/* Top Banner & Control */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Log Kinerja Harian ASN</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold">
              {filteredLogs.length} Kegiatan
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">
            Catat jam kerja dan unggah bukti dukung otomatis ke folder Google Drive terstruktur.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          type="button"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Kegiatan Kinerja</span>
        </button>
      </div>

      {/* Input / Edit Form Drawer */}
      {isFormOpen && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border-2 border-indigo-500/40 dark:border-indigo-500/30 shadow-md">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
              <span>{editingId ? 'Edit Catatan Kinerja' : 'Input Catatan Kinerja Harian'}</span>
            </h3>
            <button
              onClick={handleCancelForm}
              type="button"
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
            >
              Batal
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Row 1: Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tanggal Pelaksanaan <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={tgl}
                    onChange={(e) => setTgl(e.target.value)}
                    required
                    className="w-full text-xs sm:text-sm px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setTgl(today)}
                    className="text-[11px] px-2.5 py-2 sm:py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap cursor-pointer shrink-0"
                  >
                    Hari Ini
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Jam Mulai <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={mulai}
                  onChange={(e) => setMulai(e.target.value)}
                  required
                  className="w-full text-xs sm:text-sm px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Jam Selesai <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={selesai}
                    onChange={(e) => setSelesai(e.target.value)}
                    required
                    className="w-full text-xs sm:text-sm px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <div className="shrink-0 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold font-mono">
                    {formatDurasiLengkap(currentDurationMinutes)}
                  </div>
                </div>
              </div>
            </div>

            {/* Presets chips for working hours */}
            <div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                Pilihan Cepat Jam Kerja:
              </span>
              <div className="flex flex-wrap gap-1">
                {WORKING_HOURS_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSetPresetHours(p)}
                    className="text-[10px] sm:text-[11px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: Uraian Kegiatan with AI Polish */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Uraian Kegiatan Kerja <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleRefineWithAi}
                  disabled={!ur.trim() || isPolishing}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-40 cursor-pointer"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isPolishing ? 'animate-spin text-amber-500' : 'text-indigo-500'}`} />
                  <span>{isPolishing ? 'Menyempurnakan...' : 'Poles Bahasa (AI)'}</span>
                </button>
              </div>

              <textarea
                value={ur}
                onChange={(e) => setUr(e.target.value)}
                placeholder="Apa yang Anda kerjakan hari ini? (Misal: Melakukan verifikasi dan disposisi 4 tiket pengaduan SP4N-LAPOR!...)"
                rows={3}
                required
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              {polishMessage && (
                <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>{polishMessage}</span>
                </div>
              )}
            </div>

            {/* Row 3: RHK Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kaitkan dengan Sasaran Kinerja (RHK)
              </label>
              <select
                value={rhkId}
                onChange={(e) => setRhkId(e.target.value)}
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Belum Diklasifikasikan (Bisa dipetakan AI nanti) --</option>
                {state.rhk.map((r, i) => (
                  <option key={r.id} value={r.id}>
                    RHK {i + 1}. {r.nama.length > 70 ? r.nama.slice(0, 70) + '...' : r.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 4: Bukti Dukung & GOOGLE DRIVE UPLOAD */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Bukti Dukung Kegiatan (Google Drive Sync)
                </label>

                {/* Direct Google Drive File Upload Button */}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileUploadInputRef}
                    type="file"
                    onChange={handleDriveFileUpload}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
                  />
                  <button
                    type="button"
                    onClick={() => fileUploadInputRef.current?.click()}
                    disabled={isUploadingDrive}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isUploadingDrive ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Mengunggah ke Drive...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Unggah File ke Google Drive</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Upload Success notice */}
              {driveUploadSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold">{driveUploadSuccess}</div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Tautan Google Drive telah otomatis dimasukkan ke kolom bukti dukung.
                    </div>
                  </div>
                </div>
              )}

              {/* Link Input (Manual or Filled by Drive) */}
              <div className="relative">
                <input
                  type="text"
                  value={bukti}
                  onChange={(e) => setBukti(e.target.value)}
                  placeholder="https://drive.google.com/file/d/… atau nama berkas fisik"
                  className="w-full text-xs sm:text-sm pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>📁 Otomatis masuk ke folder: e-Kinerja ASN / Bulan / RHK</span>
                {bukti && isUrl(bukti) && (
                  <a
                    href={bukti}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-500 hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    <span>Uji Buka Tautan</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-6 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-colors cursor-pointer"
              >
                {editingId ? 'Simpan Perubahan' : 'Simpan Catatan Kinerja'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toolbar: Filters, Search, Views & Batch */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kegiatan, bukti link..."
              className="w-full pl-9 pr-3 py-1.5 sm:py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filter options */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="text-xs px-2.5 py-1.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            />

            <select
              value={filterRhk}
              onChange={(e) => setFilterRhk(e.target.value)}
              className="text-xs px-2.5 py-1.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white max-w-[140px] truncate"
            >
              <option value="all">Semua RHK</option>
              <option value="unclassified">⚠️ Belum RHK</option>
              {state.rhk.map((r, i) => (
                <option key={r.id} value={r.id}>
                  RHK {i + 1}
                </option>
              ))}
            </select>

            <div className="hidden sm:flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden p-0.5 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-400'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-400'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Batch action bar if items are selected */}
        {selectedIds.length > 0 && (
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-indigo-900 dark:text-indigo-200">
              {selectedIds.length} dipilih
            </span>
            <div className="flex items-center gap-1.5">
              <select
                value={batchTargetRhk}
                onChange={(e) => setBatchTargetRhk(e.target.value)}
                className="text-xs px-2 py-1 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              >
                <option value="">Pilih RHK</option>
                {state.rhk.map((r, i) => (
                  <option key={r.id} value={r.id}>
                    RHK {i + 1}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleApplyBatchRhk}
                disabled={!batchTargetRhk}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold disabled:opacity-40 cursor-pointer text-xs"
              >
                Terapkan
              </button>
              <button
                type="button"
                onClick={handleBatchDeleteClick}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold cursor-pointer text-xs"
              >
                Hapus
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logs View: Cards (Mobile friendly) */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 sm:p-12 text-center border border-slate-200/80 dark:border-slate-800">
          <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <h4 className="font-semibold text-slate-700 dark:text-slate-200 text-sm sm:text-base">
            Tidak ada log kinerja yang sesuai
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            Mulai catat aktivitas harian atau ganti filter bulan/RHK.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const matchedRhk = state.rhk.find((r) => r.id === log.rhk);
            const durationMins = hitungMenitDurasi(log.mulai, log.selesai);
            const isSelected = selectedIds.includes(log.id);

            return (
              <div
                key={log.id}
                className={`bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border transition-all shadow-xs ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20'
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(log.id)}
                      className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />

                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Meta header */}
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatTanggalLengkap(log.tgl)}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          {log.mulai}–{log.selesai}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] sm:text-[11px] font-mono font-medium text-slate-700 dark:text-slate-300">
                          {formatDurasiLengkap(durationMins)}
                        </span>
                      </div>

                      {/* Main description */}
                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                        {log.ur}
                      </p>

                      {/* Bukti dukung with Google Drive Badge */}
                      {log.bukti && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                          {isUrl(log.bukti) ? (
                            <a
                              href={log.bukti}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 truncate max-w-full font-medium text-[11px] bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50"
                            >
                              <FolderOpen className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span className="truncate">Buka Bukti Google Drive</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400 truncate">
                              Berkas: {log.bukti}
                            </span>
                          )}
                        </div>
                      )}

                      {/* RHK Badge / Selector */}
                      <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                        <select
                          value={log.rhk || ''}
                          onChange={(e) => {
                            onSaveLog({ ...log, rhk: e.target.value });
                          }}
                          className={`text-[11px] px-2 py-1 rounded-lg border transition-colors max-w-full truncate ${
                            matchedRhk
                              ? 'border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                              : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                          }`}
                        >
                          <option value="">⚠️ Belum Diklasifikasikan</option>
                          {state.rhk.map((r, i) => (
                            <option key={r.id} value={r.id}>
                              RHK {i + 1}. {r.nama.slice(0, 45)}...
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(log)}
                      type="button"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Hapus kegiatan ini?')) onDeleteLog(log.id);
                      }}
                      type="button"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
