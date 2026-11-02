import React, { useState } from 'react';
import { RhkItem, LogItem } from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  Target,
  Clock,
  CheckCircle,
  HelpCircle,
  Sparkles,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { uid, hitungMenitDurasi, formatDurasiLengkap } from '../utils/formatters';

interface RhkTabProps {
  rhkList: RhkItem[];
  logList: LogItem[];
  onSaveRhk: (rhk: RhkItem) => void;
  onDeleteRhk: (id: string) => void;
}

const RHK_TEMPLATES = [
  {
    nama: 'Terkelolanya aduan dan aspirasi masyarakat melalui kanal SP4N-LAPOR! secara cepat dan sesuai SLA',
    ind: '100% aduan masyarakat terdistribusi dan ditindaklanjuti OPD teknis ≤ 3 hari kerja',
    kategori: 'Utama' as const,
  },
  {
    nama: 'Terlaksananya pemeliharaan, monitoring keamanan, dan optimasi ketersediaan server infrastruktur data center',
    ind: 'Uptime sistem dan server aplikasi mencapai minimal 99% per bulan',
    kategori: 'Utama' as const,
  },
  {
    nama: 'Terselenggaranya pendampingan teknis implementasi Sistem Pemerintahan Berbasis Elektronik (SPBE) bagi OPD',
    ind: 'Terlaksananya asistensi teknis SPBE pada minimal 15 Perangkat Daerah',
    kategori: 'Utama' as const,
  },
  {
    nama: 'Tersusunnya dokumen analisis kebutuhan sistem, SOP teknis, dan dokumentasi arsitektur aplikasi',
    ind: 'Terselesaikannya 2 dokumen SOP/spesifikasi teknis sistem informasi baru',
    kategori: 'Utama' as const,
  },
  {
    nama: 'Tersusunnya laporan berkala rekapitulasi capaian kinerja dan evaluasi program bulanan/triwulanan',
    ind: 'Laporan kinerja bulanan tersusun dan diserahkan tepat waktu pada minggu pertama bulan berikutnya',
    kategori: 'Tambahan' as const,
  },
];

export const RhkTab: React.FC<RhkTabProps> = ({
  rhkList,
  logList,
  onSaveRhk,
  onDeleteRhk,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nama, setNama] = useState('');
  const [ind, setInd] = useState('');
  const [kategori, setKategori] = useState<'Utama' | 'Tambahan'>('Utama');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingId(null);
    setNama('');
    setInd('');
    setKategori('Utama');
    setIsEditing(true);
  };

  const handleOpenEdit = (rhk: RhkItem) => {
    setEditingId(rhk.id);
    setNama(rhk.nama);
    setInd(rhk.ind || '');
    setKategori(rhk.kategori || 'Utama');
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) return;

    onSaveRhk({
      id: editingId || uid(),
      nama: nama.trim(),
      ind: ind.trim(),
      kategori,
    });

    setIsEditing(false);
    setEditingId(null);
    setNama('');
    setInd('');
  };

  const handleApplyTemplate = (tpl: typeof RHK_TEMPLATES[0]) => {
    setNama(tpl.nama);
    setInd(tpl.ind);
    setKategori(tpl.kategori);
  };

  const getRhkStats = (rhkId: string) => {
    const activities = logList.filter((l) => l.rhk === rhkId);
    const totalMinutes = activities.reduce(
      (acc, l) => acc + hitungMenitDurasi(l.mulai, l.selesai),
      0
    );
    return {
      count: activities.length,
      totalMinutes,
    };
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-16 sm:pb-0">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Rencana Hasil Kerja (RHK)
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {rhkList.length} RHK Aktif
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Sasaran Kinerja Pegawai (SKP) sesuai perjanjian kinerja yang menjadi rujukan log aktivitas harian Anda.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          type="button"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah RHK Baru</span>
        </button>
      </div>

      {/* Modal or Collapsible Form */}
      {isEditing && (
        <div className="bg-indigo-50/50 dark:bg-slate-800/60 border border-indigo-200 dark:border-slate-700 rounded-2xl p-6 transition-all shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{editingId ? 'Edit Rencana Hasil Kerja' : 'Tambah Rencana Hasil Kerja Baru'}</span>
            </h3>
            <button
              onClick={() => setIsEditing(false)}
              type="button"
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
            >
              Tutup
            </button>
          </div>

          {/* Quick presets templates */}
          {!editingId && (
            <div className="mb-4">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-2">
                Pilih Contoh RHK Standar ASN:
              </span>
              <div className="flex flex-wrap gap-2">
                {RHK_TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="text-left text-[11px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer max-w-xs truncate"
                    title={tpl.nama}
                  >
                    💡 {tpl.nama}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Uraian Rencana Hasil Kerja (RHK) <span className="text-red-500">*</span>
              </label>
              <textarea
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Terkelolanya aduan masyarakat melalui SP4N-LAPOR! sesuai standar pelayanan"
                rows={3}
                required
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Indikator Kinerja Individu (IKI) / Target Output (Opsional)
                </label>
                <input
                  type="text"
                  value={ind}
                  onChange={(e) => setInd(e.target.value)}
                  placeholder="Contoh: 100% aduan tertangani dalam waktu ≤ 3 hari kerja"
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Kategori Kinerja
                </label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value as 'Utama' | 'Tambahan')}
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Utama">Kinerja Utama</option>
                  <option value="Tambahan">Kinerja Tambahan</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {editingId ? 'Simpan Perubahan' : 'Tambahkan RHK'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RHK Cards List */}
      <div className="space-y-3">
        {rhkList.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200/80 dark:border-slate-800">
            <Target className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h4 className="font-semibold text-slate-700 dark:text-slate-200 text-base">
              Belum ada Rencana Hasil Kerja (RHK)
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Tambahkan RHK Anda terlebih dahulu agar log aktivitas harian dapat diklasifikasikan dengan rapi.
            </p>
            <button
              onClick={handleOpenAdd}
              type="button"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah RHK Pertama</span>
            </button>
          </div>
        ) : (
          rhkList.map((rhk, index) => {
            const stats = getRhkStats(rhk.id);
            const isDeleting = deleteConfirmId === rhk.id;

            return (
              <div
                key={rhk.id}
                className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700 transition-all shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center shrink-0 text-xs">
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                          RHK {index + 1}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            rhk.kategori === 'Tambahan'
                              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300'
                              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {rhk.kategori || 'Utama'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                        {rhk.nama}
                      </p>
                      {rhk.ind && (
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                          <span className="font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                            Indikator / Target:
                          </span>
                          <span>{rhk.ind}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Metrics & Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {stats.count} kegiatan
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formatDurasiLengkap(stats.totalMinutes)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(rhk)}
                        type="button"
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Edit RHK"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(rhk.id)}
                        type="button"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus RHK"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Delete Confirmation Box */}
                {isDeleting && (
                  <div className="mt-4 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-800 dark:text-red-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                      <span>
                        Hapus RHK ini?{' '}
                        {stats.count > 0 &&
                          `Terdapat ${stats.count} kegiatan yang terhubung ke RHK ini (akan menjadi belum terklasifikasi).`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 justify-end">
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        type="button"
                        className="px-3 py-1 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 font-medium cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        onClick={() => {
                          onDeleteRhk(rhk.id);
                          setDeleteConfirmId(null);
                        }}
                        type="button"
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold cursor-pointer"
                      >
                        Ya, Hapus
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
