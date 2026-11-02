import React, { useState, useEffect, useRef } from 'react';
import { AppState, UserProfile } from '../types';
import {
  User,
  Shield,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  HardDrive,
  Cpu,
  Lock,
  Sparkles,
  Cloud,
  CloudUpload,
  CloudDownload,
  Loader2,
  Trash2,
  History,
  Check,
  AlertCircle,
} from 'lucide-react';
import { getDefaultState, DEFAULT_PROFILE } from '../utils/storage';
import { getHariIniISO, formatTanggalLengkap } from '../utils/formatters';
import {
  saveStateToCloud,
  loadStateFromCloud,
  createCloudBackupSnapshot,
  fetchUserBackups,
  deleteCloudBackupDoc,
  CloudBackupItem,
  auth,
  googleSignIn,
  logOut,
} from '../services/firebase';

interface SettingsTabProps {
  state: AppState;
  onUpdateProfile: (prof: UserProfile) => void;
  onRestoreState: (newState: AppState) => void;
  lastCloudSaved: string | null;
  onCloudSavedSuccess: (updatedAt: string) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  state,
  onUpdateProfile,
  onRestoreState,
  lastCloudSaved,
  onCloudSavedSuccess,
}) => {
  const [prof, setProf] = useState<UserProfile>(state.prof);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cloud management state
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [cloudBackups, setCloudBackups] = useState<CloudBackupItem[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [cloudMessage, setCloudMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  useEffect(() => {
    setProf(state.prof);
  }, [state.prof]);

  useEffect(() => {
    // Check health endpoint for Gemini Key
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setHasGeminiKey(Boolean(data.hasGeminiKey));
      })
      .catch(() => {
        setHasGeminiKey(false);
      });

    // Load cloud backups list
    loadBackupsList();
  }, []);

  const loadBackupsList = async () => {
    setIsLoadingBackups(true);
    try {
      const list = await fetchUserBackups();
      setCloudBackups(list);
    } catch (err) {
      console.warn('Gagal memuat daftar cadangan cloud:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(prof);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Cloud Save Action
  const handleSaveToCloud = async () => {
    setIsSavingCloud(true);
    setCloudMessage(null);
    try {
      const res = await saveStateToCloud(state);
      onCloudSavedSuccess(res.updatedAt);
      setCloudMessage({
        type: 'success',
        text: 'Data kinerja berhasil dicadangkan dan disinkronkan ke Cloud Firestore!',
      });
      setTimeout(() => setCloudMessage(null), 5000);
    } catch (err: any) {
      setCloudMessage({
        type: 'error',
        text: err?.message || 'Gagal menyimpan ke Cloud Firestore.',
      });
    } finally {
      setIsSavingCloud(false);
    }
  };

  // Cloud Load Action
  const handleLoadFromCloud = async () => {
    if (
      !confirm(
        'Pulihkan data dari Cloud Firestore? Data lokal saat ini akan digantikan dengan data yang ada di cloud.'
      )
    ) {
      return;
    }

    setIsLoadingCloud(true);
    setCloudMessage(null);
    try {
      const cloudData = await loadStateFromCloud();
      if (!cloudData) {
        setCloudMessage({
          type: 'info',
          text: 'Belum ada data cadangan yang tersimpan di cloud untuk akun ini.',
        });
        return;
      }
      onRestoreState(cloudData);
      setCloudMessage({
        type: 'success',
        text: 'Data kinerja berhasil dimuat dari Cloud Firestore!',
      });
      setTimeout(() => setCloudMessage(null), 5000);
    } catch (err: any) {
      setCloudMessage({
        type: 'error',
        text: err?.message || 'Gagal memuat data dari cloud.',
      });
    } finally {
      setIsLoadingCloud(false);
    }
  };

  // Create Named Snapshot
  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingSnapshot(true);
    try {
      await createCloudBackupSnapshot(state, snapshotLabel.trim() || undefined);
      setSnapshotLabel('');
      await loadBackupsList();
      setCloudMessage({
        type: 'success',
        text: 'Titik pemulihan cadangan baru berhasil dibuat di cloud!',
      });
      setTimeout(() => setCloudMessage(null), 5000);
    } catch (err: any) {
      setCloudMessage({
        type: 'error',
        text: 'Gagal membuat snapshot cadangan.',
      });
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  // Restore from specific snapshot
  const handleRestoreSnapshot = (backup: CloudBackupItem) => {
    if (
      confirm(
        `Pulihkan data kinerja dari cadangan "${backup.label}" (${formatTanggalLengkap(
          backup.createdAt.slice(0, 10)
        )})? Data saat ini akan digantikan.`
      )
    ) {
      const restoredState: AppState = {
        prof: backup.profile || state.prof,
        rhk: backup.rhk || [],
        log: backup.log || [],
        ringkas: backup.ringkas || {},
        theme: state.theme,
      };
      onRestoreState(restoredState);
      setCloudMessage({
        type: 'success',
        text: `Data berhasil dipulihkan dari cadangan "${backup.label}"!`,
      });
      setTimeout(() => setCloudMessage(null), 5000);
    }
  };

  // Delete snapshot
  const handleDeleteSnapshot = async (backupId: string) => {
    if (!confirm('Hapus snapshot cadangan ini dari cloud?')) return;
    try {
      await deleteCloudBackupDoc(backupId);
      setCloudBackups((prev) => prev.filter((b) => b.id !== backupId));
    } catch {
      alert('Gagal menghapus snapshot cadangan.');
    }
  };

  // Local JSON Export / Import
  const handleExportBackup = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `cadangan-kinerja-asn-${prof.nama.toLowerCase().replace(/\s+/g, '-')}-${getHariIniISO()}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!Array.isArray(parsed.rhk) || !Array.isArray(parsed.log)) {
          throw new Error('Format berkas tidak sesuai');
        }

        if (
          confirm(
            'Apakah Anda yakin ingin memulihkan cadangan ini? Data saat ini akan digantikan.'
          )
        ) {
          const restored: AppState = {
            prof: { ...DEFAULT_PROFILE, ...(parsed.prof || {}) },
            rhk: parsed.rhk,
            log: parsed.log,
            ringkas: parsed.ringkas || {},
            theme: parsed.theme || state.theme,
          };
          onRestoreState(restored);
          alert('Data kinerja berhasil dipulihkan!');
        }
      } catch {
        alert('Gagal memulihkan: Berkas cadangan JSON tidak valid.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetSampleData = () => {
    if (
      confirm(
        'Muat ulang data contoh ASN Diskominfo? Seluruh RHK dan contoh log kegiatan akan diperbarui.'
      )
    ) {
      const defaultState = getDefaultState();
      onRestoreState(defaultState);
      alert('Data contoh ASN berhasil dimuat.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>Pengaturan Profil Pegawai & Cadangan Cloud</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Kelola profil ASN untuk lembar pengesahan dan cadangkan seluruh data ke Cloud Firebase secara aman.
        </p>
      </div>

      {/* CLOUD BACKUP CARD (FIREBASE FIRESTORE) */}
      <div className="bg-gradient-to-tr from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-md border border-indigo-700/50 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-inner">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg tracking-tight text-white">
                  Pencadangan Cloud (Firebase Firestore)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" /> Terhubung
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Simpan data RHK dan kinerja harian Anda ke cloud agar tidak hilang saat berpindah perangkat.
              </p>
            </div>
          </div>

          {/* Google Account info / login */}
          <div className="flex items-center gap-2">
            {!auth.currentUser ? (
              <button
                onClick={async () => {
                  try {
                    await googleSignIn();
                    loadBackupsList();
                  } catch (e: any) {
                    alert('Gagal masuk: ' + (e.message || 'Error'));
                  }
                }}
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-800 text-xs font-bold hover:bg-slate-100 shadow-sm cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Masuk Akun Google</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs">
                {auth.currentUser.photoURL ? (
                  <img
                    src={auth.currentUser.photoURL}
                    alt=""
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center text-[10px]">
                    G
                  </div>
                )}
                <span className="font-semibold text-white truncate max-w-[150px]">
                  {auth.currentUser.email || auth.currentUser.displayName}
                </span>
                <button
                  onClick={async () => {
                    await logOut();
                    setCloudBackups([]);
                  }}
                  className="text-[10px] text-red-300 hover:text-red-200 ml-1 underline cursor-pointer"
                >
                  Keluar
                </button>
              </div>
            )}
            <button
              onClick={handleSaveToCloud}
              disabled={isSavingCloud}
              type="button"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSavingCloud ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Menyimpan ke Cloud...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4 text-slate-950" />
                  <span>Simpan ke Cloud (Save)</span>
                </>
              )}
            </button>

            <button
              onClick={handleLoadFromCloud}
              disabled={isLoadingCloud}
              type="button"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm border border-white/20 transition-all cursor-pointer disabled:opacity-50"
              title="Muat data terbaru dari Cloud Firestore"
            >
              {isLoadingCloud ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CloudDownload className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Muat dari Cloud</span>
            </button>
          </div>
        </div>

        {/* Sync Info Banner */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between text-xs text-indigo-200">
          <div>
            <span>Status Sinkronisasi Terakhir: </span>
            <strong className="text-white">
              {lastCloudSaved
                ? `${formatTanggalLengkap(lastCloudSaved.slice(0, 10))} pukul ${lastCloudSaved.slice(11, 16)}`
                : 'Belum disimpan ke cloud sesi ini'}
            </strong>
          </div>
          <span className="text-[11px] text-indigo-300">
            {state.rhk.length} RHK · {state.log.length} Kegiatan Aktif
          </span>
        </div>

        {cloudMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
              cloudMessage.type === 'success'
                ? 'bg-emerald-950/70 border border-emerald-500/60 text-emerald-200'
                : cloudMessage.type === 'error'
                ? 'bg-red-950/70 border border-red-500/60 text-red-200'
                : 'bg-indigo-950/70 border border-indigo-400/60 text-indigo-200'
            }`}
          >
            {cloudMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            )}
            <span>{cloudMessage.text}</span>
          </div>
        )}

        {/* Create Named Snapshot Section */}
        <div className="pt-2 border-t border-white/10 space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span>Riwayat Titik Pemulihan (Snapshot) Cloud</span>
          </h4>

          <form onSubmit={handleCreateSnapshot} className="flex gap-2">
            <input
              type="text"
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              placeholder="Beri nama snapshot (misal: Selesai SKP Triwulan III atau Sebelum Revisi RHK)"
              className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="submit"
              disabled={isCreatingSnapshot}
              className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-xs shrink-0 shadow-md transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isCreatingSnapshot ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <History className="w-3.5 h-3.5" />
              )}
              <span>Buat Snapshot Baru</span>
            </button>
          </form>

          {/* Snapshot Table / List */}
          {isLoadingBackups ? (
            <div className="py-4 text-center text-xs text-indigo-300">
              Memuat riwayat cadangan cloud...
            </div>
          ) : cloudBackups.length === 0 ? (
            <div className="py-4 text-center text-xs text-indigo-300/70 italic bg-white/5 rounded-xl">
              Belum ada snapshot cadangan tersimpan. Klik tombol di atas untuk membuat snapshot pertama.
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {cloudBackups.map((bak) => (
                <div
                  key={bak.id}
                  className="p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">{bak.label}</div>
                    <div className="text-[11px] text-indigo-200/80">
                      {formatTanggalLengkap(bak.createdAt.slice(0, 10))} · {bak.createdAt.slice(11, 16)} ·{' '}
                      <span className="text-white font-medium">
                        {bak.totalRhk} RHK, {bak.totalKegiatan} Kegiatan
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleRestoreSnapshot(bak)}
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 text-[11px] font-semibold cursor-pointer transition-colors"
                    >
                      Pulihkan
                    </button>
                    <button
                      onClick={() => handleDeleteSnapshot(bak.id)}
                      type="button"
                      className="p-1 rounded-lg hover:bg-red-500/20 text-red-300 cursor-pointer transition-colors"
                      title="Hapus cadangan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form Identitas Pegawai */}
      <form
        onSubmit={handleProfileSubmit}
        className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6"
      >
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
            <span>A. Identitas Pegawai Yang Dinilai</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Lengkap & Gelar <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={prof.nama}
              onChange={(e) => setProf({ ...prof, nama: e.target.value })}
              required
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nomor Induk Pegawai (NIP)
            </label>
            <input
              type="text"
              value={prof.nip}
              onChange={(e) => setProf({ ...prof, nip: e.target.value })}
              placeholder="Contoh: 19950815 202203 2 004"
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Pangkat / Golongan Ruang
            </label>
            <input
              type="text"
              value={prof.pangkatGol}
              onChange={(e) => setProf({ ...prof, pangkatGol: e.target.value })}
              placeholder="Contoh: Penata Muda / III/a"
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Jabatan Fungsional / Pelaksana <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={prof.jabatan}
              onChange={(e) => setProf({ ...prof, jabatan: e.target.value })}
              required
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Unit Kerja / Bidang <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={prof.unitKerja}
              onChange={(e) => setProf({ ...prof, unitKerja: e.target.value })}
              required
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Instansi Pemerintah
            </label>
            <input
              type="text"
              value={prof.instansi}
              onChange={(e) => setProf({ ...prof, instansi: e.target.value })}
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Pejabat Penilai Kinerja / Atasan */}
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3 pt-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
            <span>B. Pejabat Penilai Kinerja (Atasan Langsung)</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Atasan Langsung
            </label>
            <input
              type="text"
              value={prof.atasanNama}
              onChange={(e) => setProf({ ...prof, atasanNama: e.target.value })}
              placeholder="Contoh: Moch. Hasan, S.Kom., M.T."
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              NIP Atasan
            </label>
            <input
              type="text"
              value={prof.atasanNip}
              onChange={(e) => setProf({ ...prof, atasanNip: e.target.value })}
              placeholder="Contoh: 19820512 200801 1 009"
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Jabatan Atasan
            </label>
            <input
              type="text"
              value={prof.atasanJabatan}
              onChange={(e) => setProf({ ...prof, atasanJabatan: e.target.value })}
              placeholder="Contoh: Kepala Bidang Aplikasi Informatika"
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {saveSuccess ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Identitas pegawai berhasil disimpan!</span>
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              Perubahan identitas otomatis diperbarui pada lembar tanda tangan cetak.
            </span>
          )}

          <button
            type="submit"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md transition-colors cursor-pointer"
          >
            Simpan Identitas
          </button>
        </div>
      </form>

      {/* Cadangan Berkas Offline (.JSON) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Cadangan Berkas Lokal (.json)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Selain pencadangan cloud, Anda juga dapat mengunduh berkas fisik .json sebagai arsip offline mandiri.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <button
            onClick={handleExportBackup}
            type="button"
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/40 text-left transition-all group cursor-pointer"
          >
            <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
              Unduh Cadangan (.json)
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Simpan seluruh RHK dan riwayat kinerja ke dalam satu berkas cadangan offline.
            </div>
          </button>

          <label className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/40 text-left transition-all group cursor-pointer block">
            <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
              Pulihkan dari Cadangan
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Muat data dari berkas .json yang telah diunduh sebelumnya.
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>

          <button
            onClick={handleResetSampleData}
            type="button"
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500 bg-slate-50/50 dark:bg-slate-800/40 text-left transition-all group cursor-pointer"
          >
            <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
              Muat Data Contoh ASN
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Isi otomatis dengan data profil & RHK Diskominfo untuk pengujian cepat.
            </div>
          </button>
        </div>
      </div>

      {/* System & AI Status card */}
      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>Status Asisten AI:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {hasGeminiKey ? 'Gemini Flash Aktif & Terhubung' : 'Mode Offline / Fallback Cerdas'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Didukung oleh model AI Google Gemini dan backend database Cloud Firestore.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
          <Lock className="w-3.5 h-3.5" />
          <span>Privasi Data Kinerja Terjamin</span>
        </div>
      </div>
    </div>
  );
};
