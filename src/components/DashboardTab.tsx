import React from 'react';
import { AppState, RhkItem, LogItem } from '../types';
import {
  Clock,
  Target,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Plus,
  Calendar,
  ExternalLink,
  FileSpreadsheet,
} from 'lucide-react';
import {
  hitungMenitDurasi,
  formatDurasiLengkap,
  formatTanggalLengkap,
  formatPeriodeBulan,
  getBulanIniISO,
  isUrl,
} from '../utils/formatters';

interface DashboardTabProps {
  state: AppState;
  onNavigate: (tab: 'rhk' | 'log' | 'lap' | 'set') => void;
  onOpenAddLog: () => void;
  onTriggerAiClassification: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  state,
  onNavigate,
  onOpenAddLog,
  onTriggerAiClassification,
}) => {
  const currentMonth = getBulanIniISO();
  const currentMonthLogs = state.log.filter((l) => l.tgl.startsWith(currentMonth));

  // Total minutes this month
  const totalMinutesThisMonth = currentMonthLogs.reduce(
    (acc, l) => acc + hitungMenitDurasi(l.mulai, l.selesai),
    0
  );

  // Target standard ASN: ~7.5 hours per day * ~20 working days = ~150 hours (or 112.5 jam minimal efektif)
  const targetMinutes = 112.5 * 60;
  const targetPercent = Math.min(100, Math.round((totalMinutesThisMonth / targetMinutes) * 100));

  // Classified vs Unclassified count
  const unclassifiedLogs = currentMonthLogs.filter(
    (l) => !l.rhk || !state.rhk.some((r) => r.id === l.rhk)
  );
  const unclassifiedCount = unclassifiedLogs.length;
  const classificationPercent =
    currentMonthLogs.length > 0
      ? Math.round(
          ((currentMonthLogs.length - unclassifiedCount) / currentMonthLogs.length) * 100
        )
      : 100;

  // Active working days count
  const activeDaysCount = new Set(currentMonthLogs.map((l) => l.tgl)).size;

  // RHK Breakdown
  const rhkStats = state.rhk.map((r, idx) => {
    const logsForRhk = currentMonthLogs.filter((l) => l.rhk === r.id);
    const minutes = logsForRhk.reduce(
      (acc, l) => acc + hitungMenitDurasi(l.mulai, l.selesai),
      0
    );
    const percentage =
      totalMinutesThisMonth > 0 ? Math.round((minutes / totalMinutesThisMonth) * 100) : 0;
    return {
      rhk: r,
      index: idx + 1,
      count: logsForRhk.length,
      minutes,
      percentage,
    };
  });

  // Recent logs
  const recentLogs = [...state.log]
    .sort((a, b) => (b.tgl + b.mulai).localeCompare(a.tgl + a.mulai))
    .slice(0, 5);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-8 shadow-lg relative overflow-hidden border border-indigo-900/40">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-400 via-sky-300 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-[11px] sm:text-xs font-medium mb-2 sm:mb-3">
              <Calendar className="w-3 h-3" />
              <span>Periode: {formatPeriodeBulan(currentMonth)}</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white">
              Selamat datang, {state.prof.nama}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              {state.prof.jabatan} — {state.prof.unitKerja}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={onOpenAddLog}
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Kinerja Hari Ini</span>
            </button>
            <button
              onClick={() => onNavigate('lap')}
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs sm:text-sm backdrop-blur-sm border border-white/15 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Laporan SKP</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total jam kerja */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Jam Bulan Ini
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {formatDurasiLengkap(totalMinutesThisMonth)}
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
              <span>Efektivitas ASN</span>
              <span>{targetPercent}% dari target</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, targetPercent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Klasifikasi RHK Status */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Kesesuaian RHK
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                unclassifiedCount === 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
              }`}
            >
              {unclassifiedCount === 0 ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {classificationPercent}%
            </span>
            <span className="text-xs text-slate-500">terpetakan</span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {unclassifiedCount === 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Semua kegiatan sudah terhubung ke RHK
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {unclassifiedCount} kegiatan belum diklasifikasi
              </span>
            )}
          </p>
        </div>

        {/* Jumlah Kegiatan Terinput */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Kegiatan Bulan Ini
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {currentMonthLogs.length}
            </span>
            <span className="text-xs text-slate-500">aktivitas</span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Tercatat di {activeDaysCount} hari kerja efektif
          </p>
        </div>

        {/* RHK Aktif */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Rencana Hasil Kerja (RHK)
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {state.rhk.length}
            </span>
            <span className="text-xs text-slate-500">sasaran</span>
          </div>
          <button
            onClick={() => onNavigate('rhk')}
            type="button"
            className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
          >
            <span>Kelola RHK Pegawai</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* AI Quick Banner if there are unclassified items */}
      {unclassifiedCount > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Otomatisasi Penataan SKP dengan AI
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
                Terdapat {unclassifiedCount} kegiatan harian yang belum dihubungkan ke RHK.
                Gunakan Gemini AI untuk mengelompokkan secara otomatis dalam hitungan detik.
              </p>
            </div>
          </div>
          <button
            onClick={onTriggerAiClassification}
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0 shadow-sm transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Jalankan Klasifikasi AI</span>
          </button>
        </div>
      )}

      {/* Grid: RHK Distribution & Recent logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RHK Distribution (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                Distribusi Kinerja per RHK
              </h3>
              <p className="text-xs text-slate-500">
                Alokasi waktu dan frekuensi kegiatan periode {formatPeriodeBulan(currentMonth)}
              </p>
            </div>
            <button
              onClick={() => onNavigate('rhk')}
              type="button"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
            >
              Lihat Detail
            </button>
          </div>

          {state.rhk.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Belum ada RHK terdaftar.
            </div>
          ) : (
            <div className="space-y-4">
              {rhkStats.map((item) => (
                <div key={item.rhk.id} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3 text-xs">
                    <div className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 mr-1.5">
                        RHK {item.index}.
                      </span>
                      {item.rhk.nama}
                    </div>
                    <div className="shrink-0 text-right text-slate-500 font-mono">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.count} kegiatan
                      </span>
                      <span className="mx-1.5">·</span>
                      <span>{formatDurasiLengkap(item.minutes)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities Timeline (1 col) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                Aktivitas Terakhir
              </h3>
              <button
                onClick={() => onNavigate('log')}
                type="button"
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
              >
                Semua
              </button>
            </div>

            {recentLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Belum ada aktivitas tercatat.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentLogs.map((log) => {
                  const matchedRhk = state.rhk.find((r) => r.id === log.rhk);
                  return (
                    <div key={log.id} className="py-3 text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {log.tgl} · {log.mulai}–{log.selesai}
                        </span>
                        {matchedRhk ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 font-medium truncate max-w-[100px]">
                            RHK {state.rhk.indexOf(matchedRhk) + 1}
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-medium">
                            Belum RHK
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 dark:text-slate-200 line-clamp-2">{log.ur}</p>
                      {log.bukti && (
                        <div className="text-[11px] text-slate-400 truncate">
                          {isUrl(log.bukti) ? (
                            <a
                              href={log.bukti}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-500 hover:underline inline-flex items-center gap-1"
                            >
                              <span>Bukti tautan</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span>Berkas: {log.bukti}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={onOpenAddLog}
            type="button"
            className="w-full mt-4 py-2 px-3 border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Catatan Kinerja</span>
          </button>
        </div>
      </div>
    </div>
  );
};
