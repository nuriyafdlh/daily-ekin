import React, { useState } from 'react';
import { AppState, RhkItem, LogItem } from '../types';
import {
  Sparkles,
  FileText,
  Printer,
  Download,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  FolderOpen,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';
import {
  formatTanggalLengkap,
  formatTanggalPendek,
  formatPeriodeBulan,
  formatDurasi,
  formatDurasiLengkap,
  hitungMenitDurasi,
  getHariIniISO,
  getBulanIniISO,
  isUrl,
} from '../utils/formatters';
import { classifyLocally } from '../utils/aiFallback';

interface LaporanTabProps {
  state: AppState;
  onUpdateLogs: (newLogs: LogItem[]) => void;
  onUpdateRingkas: (periode: string, rhkId: string, actionPlans: string[]) => void;
}

export const LaporanTab: React.FC<LaporanTabProps> = ({
  state,
  onUpdateLogs,
  onUpdateRingkas,
}) => {
  const today = getHariIniISO();
  const currentMonth = getBulanIniISO();

  // Mode: 'h' (Harian) or 'b' (Bulanan)
  const [reportType, setReportType] = useState<'h' | 'b'>('b');
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // AI Classification states
  const [reclassifyAll, setReclassifyAll] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiMessage, setAiMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Active period string
  const activePeriod = reportType === 'h' ? selectedDate : selectedMonth;

  // Filter logs for this period
  const periodLogs = state.log
    .filter((l) => activePeriod && l.tgl.startsWith(activePeriod))
    .sort((a, b) => (a.tgl + a.mulai).localeCompare(b.tgl + b.mulai));

  // Total minutes in period
  const totalPeriodMinutes = periodLogs.reduce(
    (acc, l) => acc + hitungMenitDurasi(l.mulai, l.selesai),
    0
  );

  // Group by RHK
  const rhkGroups = state.rhk
    .map((r, i) => {
      const logs = periodLogs.filter((l) => l.rhk === r.id);
      const minutes = logs.reduce(
        (acc, l) => acc + hitungMenitDurasi(l.mulai, l.selesai),
        0
      );
      return {
        rhk: r,
        index: i + 1,
        logs,
        minutes,
      };
    })
    .filter((g) => g.logs.length > 0);

  // Unclassified in period
  const unclassifiedLogs = periodLogs.filter(
    (l) => !l.rhk || !state.rhk.some((r) => r.id === l.rhk)
  );

  // Get action plan for an RHK
  const getActionPlans = (rhkId: string): string[] => {
    const key = `${selectedMonth}|${rhkId}`;
    if (state.ringkas && state.ringkas[key] && state.ringkas[key].length > 0) {
      return state.ringkas[key];
    }
    const logs = periodLogs.filter((l) => l.rhk === rhkId);
    return Array.from(new Set(logs.map((l) => l.ur))).slice(0, 4);
  };

  // AI Automatic Classification
  const handleRunAiClassification = async () => {
    if (state.rhk.length === 0) {
      alert('Mohon buat minimal 1 Rencana Hasil Kerja (RHK) terlebih dahulu.');
      return;
    }

    const targetLogs = periodLogs.filter(
      (l) => reclassifyAll || !l.rhk || !state.rhk.some((r) => r.id === l.rhk)
    );

    if (targetLogs.length === 0) {
      setAiMessage({
        type: 'info',
        text: 'Semua kegiatan pada periode ini sudah terhubung ke RHK.',
      });
      return;
    }

    setIsClassifying(true);
    setAiMessage({
      type: 'info',
      text: `Sedang menganalisis dan mengelompokkan ${targetLogs.length} kegiatan dengan Gemini AI...`,
    });

    try {
      const res = await fetch('/api/ai/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rhkList: state.rhk,
          activities: targetLogs,
        }),
      });

      let results: any[] = [];
      if (res.ok) {
        const data = await res.json();
        results = data.results || [];
      } else {
        results = classifyLocally(state.rhk, targetLogs);
      }

      let updatedCount = 0;
      const updatedAllLogs = state.log.map((log) => {
        const found = results.find((r: any) => r.id === log.id);
        if (found && found.rhkId) {
          updatedCount++;
          return { ...log, rhk: found.rhkId };
        }
        return log;
      });

      onUpdateLogs(updatedAllLogs);
      setAiMessage({
        type: 'success',
        text: `✨ Berhasil mengklasifikasikan ${updatedCount} kegiatan ke dalam RHK.`,
      });
    } catch {
      const localResults = classifyLocally(state.rhk, targetLogs);
      let updatedCount = 0;
      const updatedAllLogs = state.log.map((log) => {
        const found = localResults.find((r) => r.id === log.id);
        if (found && found.rhkId) {
          updatedCount++;
          return { ...log, rhk: found.rhkId };
        }
        return log;
      });
      onUpdateLogs(updatedAllLogs);
      setAiMessage({
        type: 'success',
        text: `✨ Diklasifikasikan secara lokal (${updatedCount} kegiatan).`,
      });
    } finally {
      setIsClassifying(false);
    }
  };

  // AI Summarize Monthly Action Plans
  const handleRunAiSummarize = async () => {
    if (rhkGroups.length === 0) {
      setAiMessage({
        type: 'error',
        text: 'Belum ada kegiatan yang terkelompokkan ke RHK pada bulan ini. Jalankan Klasifikasi AI terlebih dahulu.',
      });
      return;
    }

    setIsSummarizing(true);
    setAiMessage({
      type: 'info',
      text: 'Menganalisis dan menyusun draf Rencana Aksi bulanan ASN dengan Gemini...',
    });

    const payload = rhkGroups.map((g) => ({
      rhkId: g.rhk.id,
      rhkNomor: g.index,
      rhkNama: g.rhk.nama,
      kegiatan: Array.from(new Set(g.logs.map((l) => l.ur))),
    }));

    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periode: formatPeriodeBulan(selectedMonth),
          rhkListWithActivities: payload,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];
        results.forEach((item: any) => {
          if (item.rhkId && Array.isArray(item.rencanaAksi)) {
            onUpdateRingkas(selectedMonth, item.rhkId, item.rencanaAksi);
          }
        });
        setAiMessage({
          type: 'success',
          text: `✨ Berhasil menyusun Rencana Aksi resmi untuk ${results.length} RHK.`,
        });
      }
    } catch {
      rhkGroups.forEach((g) => {
        const plans = Array.from(new Set(g.logs.map((l) => l.ur)))
          .slice(0, 3)
          .map((txt) => (txt.startsWith('Melakukan') ? txt : `Melaksanakan kegiatan ${txt}`));
        onUpdateRingkas(selectedMonth, g.rhk.id, plans);
      });
      setAiMessage({
        type: 'success',
        text: '✨ Rencana Aksi dirangkum dari log kegiatan.',
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    const p = state.prof;
    const periodeLabel =
      reportType === 'h' ? formatTanggalLengkap(selectedDate) : formatPeriodeBulan(selectedMonth);

    let csvContent = '\uFEFF';
    csvContent += `"LAPORAN KINERJA PEGAWAI - ${reportType === 'h' ? 'HARIAN' : 'BULANAN'}"\n`;
    csvContent += `"Periode:","${periodeLabel}"\n`;
    csvContent += `"Nama Pegawai:","${p.nama}"\n`;
    csvContent += `"NIP:","${p.nip}"\n`;
    csvContent += `"Jabatan:","${p.jabatan}"\n`;
    csvContent += `"Unit Kerja:","${p.unitKerja}"\n\n`;

    if (reportType === 'h') {
      csvContent += `"No","Tanggal","Jam Mulai","Jam Selesai","Durasi","RHK","Uraian Kegiatan","Bukti Dukung Google Drive / Dokumen"\n`;
      periodLogs.forEach((l, idx) => {
        const matchedRhk = state.rhk.find((r) => r.id === l.rhk);
        const rhkName = matchedRhk ? matchedRhk.nama : 'Belum Terklasifikasi';
        const dur = formatDurasi(hitungMenitDurasi(l.mulai, l.selesai));
        csvContent += `"${idx + 1}","${l.tgl}","${l.mulai}","${l.selesai}","${dur}","${rhkName.replace(
          /"/g,
          '""'
        )}","${l.ur.replace(/"/g, '""')}","${(l.bukti || '').replace(/"/g, '""')}"\n`;
      });
    } else {
      csvContent += `"No","Rencana Hasil Kerja (RHK)","Indikator Target","Rencana Aksi","Jumlah Kegiatan","Total Jam","Bukti Dukung Google Drive"\n`;
      rhkGroups.forEach((g, idx) => {
        const plans = getActionPlans(g.rhk.id).join('; ');
        const buktiList = Array.from(new Set(g.logs.map((l) => l.bukti).filter(Boolean))).join('; ');
        csvContent += `"${idx + 1}","${g.rhk.nama.replace(/"/g, '""')}","${(g.rhk.ind || '').replace(
          /"/g,
          '""'
        )}","${plans.replace(/"/g, '""')}","${g.logs.length}","${formatDurasiLengkap(
          g.minutes
        )}","${buktiList.replace(/"/g, '""')}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `laporan-kinerja-${reportType === 'h' ? selectedDate : selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const p = state.prof;
  const displayPeriode =
    reportType === 'h' ? formatTanggalLengkap(selectedDate) : formatPeriodeBulan(selectedMonth);

  return (
    <div className="space-y-4 sm:space-y-6 pb-16 sm:pb-0">
      {/* Configuration Card */}
      <div className="no-print bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Laporan SKP & Tautan Google Drive</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Format cetak resmi SKP ASN lengkap dengan tautan bukti dukung Google Drive dan lembar tanda tangan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              type="button"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak PDF</span>
            </button>
          </div>
        </div>

        {/* Period Selector Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Jenis Laporan
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as 'h' | 'b')}
              className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="b">Laporan Kinerja Bulanan (Format SKP)</option>
              <option value="h">Laporan Kinerja Harian (Detail Jam)</option>
            </select>
          </div>

          {reportType === 'h' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pilih Tanggal
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pilih Bulan
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Statistik Periode
            </label>
            <div className="text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-between font-mono">
              <span>{periodLogs.length} Kegiatan</span>
              <span className="font-bold">{formatDurasiLengkap(totalPeriodMinutes)}</span>
            </div>
          </div>
        </div>

        {/* AI Action Box */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-slate-800/80 dark:to-indigo-950/40 p-3 sm:p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Otomatisasi Asisten AI (Gemini Flash)
              </span>
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={reclassifyAll}
                onChange={(e) => setReclassifyAll(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-[11px]">Klasifikasi ulang semua</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunAiClassification}
              disabled={isClassifying || isSummarizing}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isClassifying ? 'animate-spin' : ''}`} />
              <span>{isClassifying ? 'Mengklasifikasi...' : '✨ Klasifikasi Otomatis ke RHK'}</span>
            </button>

            {reportType === 'b' && (
              <button
                onClick={handleRunAiSummarize}
                disabled={isSummarizing || isClassifying}
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSummarizing ? 'animate-spin text-indigo-600' : ''}`} />
                <span>📝 Ringkas Rencana Aksi (AI)</span>
              </button>
            )}
          </div>

          {aiMessage && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                aiMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200'
                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{aiMessage.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Official Printable Report Document Container */}
      <div className="bg-white text-slate-900 rounded-2xl p-4 sm:p-10 border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 print:rounded-none overflow-hidden">
        {/* Official Header */}
        <div className="text-center pb-4 sm:pb-6 border-b-2 border-slate-900 space-y-0.5 sm:space-y-1">
          <div className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-slate-600">
            {p.instansi || 'Pemerintah Kabupaten Bangkalan'}
          </div>
          <div className="text-xs sm:text-sm uppercase font-bold tracking-tight text-slate-800">
            {p.unitKerja || 'Dinas Komunikasi dan Informatika'}
          </div>
          <h1 className="text-base sm:text-2xl font-extrabold uppercase tracking-tight text-slate-950 pt-1">
            {reportType === 'h' ? 'LAPORAN KINERJA HARIAN PEGAWAI' : 'LAPORAN CAPAIAN KINERJA BULANAN'}
          </h1>
          <div className="text-xs sm:text-sm font-semibold text-slate-700">
            Periode: {displayPeriode}
          </div>
        </div>

        {/* Pegawai Info Box */}
        <div className="my-4 sm:my-6 p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm print:bg-white print:border-none print:p-0">
          <table className="w-full border-none text-xs sm:text-sm">
            <tbody>
              <tr>
                <td className="w-28 sm:w-36 py-0.5 font-semibold text-slate-600 print:text-black border-none">
                  Nama Pegawai
                </td>
                <td className="py-0.5 text-slate-900 font-bold border-none">: {p.nama}</td>
              </tr>
              <tr>
                <td className="py-0.5 font-semibold text-slate-600 print:text-black border-none">
                  NIP
                </td>
                <td className="py-0.5 text-slate-900 font-mono border-none">: {p.nip || '-'}</td>
              </tr>
              {p.pangkatGol && (
                <tr>
                  <td className="py-0.5 font-semibold text-slate-600 print:text-black border-none">
                    Pangkat / Gol.
                  </td>
                  <td className="py-0.5 text-slate-900 border-none">: {p.pangkatGol}</td>
                </tr>
              )}
              <tr>
                <td className="py-0.5 font-semibold text-slate-600 print:text-black border-none">
                  Jabatan
                </td>
                <td className="py-0.5 text-slate-900 border-none">: {p.jabatan}</td>
              </tr>
              <tr>
                <td className="py-0.5 font-semibold text-slate-600 print:text-black border-none">
                  Unit Kerja
                </td>
                <td className="py-0.5 text-slate-900 border-none">: {p.unitKerja}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Content based on Report Type */}
        {periodLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs sm:text-sm border border-dashed border-slate-300 rounded-xl">
            Tidak ada catatan kinerja pada periode {displayPeriode}.
          </div>
        ) : reportType === 'b' ? (
          /* Monthly Report: Grouped by RHK with Action Plans and GOOGLE DRIVE EVIDENCE */
          <div className="space-y-4 sm:space-y-6">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-left text-xs border-collapse min-w-[600px] sm:min-w-full">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="p-2 sm:p-3 w-8 sm:w-10 text-center font-bold border border-slate-300">
                      No
                    </th>
                    <th className="p-2 sm:p-3 w-1/3 font-bold border border-slate-300">
                      Rencana Hasil Kerja (RHK) & Indikator
                    </th>
                    <th className="p-2 sm:p-3 font-bold border border-slate-300">
                      Rencana Aksi / Ringkasan Capaian Bulanan
                    </th>
                    <th className="p-2 sm:p-3 w-56 font-bold border border-slate-300">
                      Bukti Dukung Google Drive
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rhkGroups.map((group, idx) => {
                    const actionPlans = getActionPlans(group.rhk.id);
                    const evidenceList = Array.from(
                      new Set(group.logs.map((l) => l.bukti).filter(Boolean))
                    );

                    return (
                      <tr key={group.rhk.id} className="align-top hover:bg-slate-50/50">
                        <td className="p-2 sm:p-3 text-center font-bold border border-slate-300">
                          {idx + 1}
                        </td>
                        <td className="p-2 sm:p-3 border border-slate-300">
                          <div className="font-bold text-slate-900">
                            RHK {group.index}. {group.rhk.nama}
                          </div>
                          {group.rhk.ind && (
                            <div className="mt-1 text-[11px] text-slate-600 italic">
                              Target: {group.rhk.ind}
                            </div>
                          )}
                          <div className="mt-1.5 text-[11px] font-mono text-slate-500">
                            {group.logs.length} kegiatan · {formatDurasiLengkap(group.minutes)}
                          </div>
                        </td>
                        <td className="p-2 sm:p-3 border border-slate-300">
                          {actionPlans.length > 0 ? (
                            <ul className="list-disc pl-4 space-y-1 text-slate-800">
                              {actionPlans.map((plan, pIdx) => (
                                <li key={pIdx} className="leading-relaxed">
                                  {plan}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400 italic">
                              Belum ada rencana aksi.
                            </span>
                          )}
                        </td>
                        <td className="p-2 sm:p-3 border border-slate-300 text-[11px]">
                          {evidenceList.length > 0 ? (
                            <ol className="list-decimal pl-4 space-y-1.5">
                              {evidenceList.map((ev, eIdx) => (
                                <li key={eIdx} className="break-all">
                                  {isUrl(ev) ? (
                                    <div className="space-y-0.5">
                                      <a
                                        href={ev}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:underline font-bold inline-flex items-center gap-1"
                                      >
                                        <FolderOpen className="w-3 h-3 text-indigo-500 shrink-0" />
                                        <span>Bukti Google Drive #{eIdx + 1}</span>
                                        <ExternalLink className="w-2.5 h-2.5 no-print shrink-0" />
                                      </a>
                                      <div className="text-[10px] text-slate-500 truncate max-w-xs font-mono">
                                        {ev}
                                      </div>
                                    </div>
                                  ) : (
                                    <span>{ev}</span>
                                  )}
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2 print:bg-white print:border print:border-slate-300">
              <span className="font-semibold text-slate-700">Total Akumulasi:</span>
              <span className="font-bold text-slate-900 font-mono">
                {periodLogs.length} Kegiatan · {formatDurasiLengkap(totalPeriodMinutes)}
              </span>
            </div>
          </div>
        ) : (
          /* Daily Report */
          <div className="space-y-4 sm:space-y-6">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-left text-xs border-collapse min-w-[600px] sm:min-w-full">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="p-2 sm:p-3 w-8 sm:w-10 text-center font-bold border border-slate-300">
                      No
                    </th>
                    <th className="p-2 sm:p-3 w-24 font-bold border border-slate-300">Jam</th>
                    <th className="p-2 sm:p-3 w-20 font-bold border border-slate-300">Durasi</th>
                    <th className="p-2 sm:p-3 font-bold border border-slate-300">Uraian Kegiatan</th>
                    <th className="p-2 sm:p-3 w-40 font-bold border border-slate-300">RHK</th>
                    <th className="p-2 sm:p-3 w-44 font-bold border border-slate-300">
                      Tautan Google Drive
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {periodLogs.map((log, idx) => {
                    const matchedRhk = state.rhk.find((r) => r.id === log.rhk);
                    const durationMins = hitungMenitDurasi(log.mulai, log.selesai);

                    return (
                      <tr key={log.id} className="align-top hover:bg-slate-50/50">
                        <td className="p-2 sm:p-3 text-center font-bold border border-slate-300">
                          {idx + 1}
                        </td>
                        <td className="p-2 sm:p-3 font-mono border border-slate-300 whitespace-nowrap">
                          {log.mulai}–{log.selesai}
                        </td>
                        <td className="p-2 sm:p-3 font-mono border border-slate-300 whitespace-nowrap">
                          {formatDurasi(durationMins)}
                        </td>
                        <td className="p-2 sm:p-3 border border-slate-300 leading-relaxed">
                          {log.ur}
                        </td>
                        <td className="p-2 sm:p-3 border border-slate-300">
                          {matchedRhk ? (
                            <span className="font-semibold text-slate-900">
                              RHK {state.rhk.indexOf(matchedRhk) + 1}
                            </span>
                          ) : (
                            <span className="text-amber-700 italic">Belum RHK</span>
                          )}
                        </td>
                        <td className="p-2 sm:p-3 border border-slate-300 text-[11px] break-all">
                          {log.bukti ? (
                            isUrl(log.bukti) ? (
                              <div>
                                <a
                                  href={log.bukti}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:underline font-bold inline-flex items-center gap-1"
                                >
                                  <FolderOpen className="w-3 h-3 text-indigo-500 shrink-0" />
                                  <span>Tautan GDrive</span>
                                  <ExternalLink className="w-2.5 h-2.5 no-print shrink-0" />
                                </a>
                                <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                                  {log.bukti}
                                </div>
                              </div>
                            ) : (
                              <span>{log.bukti}</span>
                            )
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Official Signatures Section */}
        <div className="mt-10 sm:mt-14 grid grid-cols-2 gap-4 sm:gap-8 text-xs sm:text-sm text-center">
          <div>
            <div className="text-slate-600 text-[11px] sm:text-xs">Mengetahui,</div>
            <div className="font-semibold text-slate-900 text-xs sm:text-sm">
              {p.atasanJabatan || 'Pejabat Penilai Kinerja'}
            </div>
            <div className="h-16 sm:h-20" />
            <div className="font-bold text-slate-950 underline text-xs sm:text-sm">
              {p.atasanNama || 'Nama Atasan Langsung'}
            </div>
            <div className="font-mono text-slate-600 text-[10px] sm:text-xs">
              {p.atasanNip ? `NIP. ${p.atasanNip}` : 'NIP. ........................................'}
            </div>
          </div>

          <div>
            <div className="text-slate-600 text-[11px] sm:text-xs">
              Bangkalan, {formatTanggalLengkap(today)}
            </div>
            <div className="font-semibold text-slate-900 text-xs sm:text-sm">Pegawai Yang Dinilai,</div>
            <div className="h-16 sm:h-20" />
            <div className="font-bold text-slate-950 underline text-xs sm:text-sm">{p.nama}</div>
            <div className="font-mono text-slate-600 text-[10px] sm:text-xs">
              {p.nip ? `NIP. ${p.nip}` : 'NIP. ........................................'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
