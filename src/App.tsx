import React, { useState, useEffect } from 'react';
import { AppState, RhkItem, LogItem, UserProfile } from './types';
import { loadState, saveState } from './utils/storage';
import { Header } from './components/Header';
import { Navigation, TabKey } from './components/Navigation';
import { DashboardTab } from './components/DashboardTab';
import { RhkTab } from './components/RhkTab';
import { LogTab } from './components/LogTab';
import { LaporanTab } from './components/LaporanTab';
import { SettingsTab } from './components/SettingsTab';
import { ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logOut,
  saveStateToCloud,
  loadStateFromCloud,
} from './services/firebase';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [openAddLogDirectly, setOpenAddLogDirectly] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme-pref');
      if (savedTheme) return savedTheme === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Cloud Save State
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [lastCloudSaved, setLastCloudSaved] = useState<string | null>(() => {
    return localStorage.getItem('last-cloud-saved') || null;
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Auth state listener on boot
  useEffect(() => {
    const unsubscribe = initAuth(
      async (user) => {
        setCurrentUser(user);
      },
      () => {
        setCurrentUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Apply dark mode class to root HTML
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme-pref', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme-pref', 'light');
    }
  }, [darkMode]);

  // Google Sign-In Handler for Cross-Device Sync & Drive
  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await googleSignIn();
      setCurrentUser(result.user);
      showToast(
        'success',
        `Masuk sebagai ${result.user.displayName || result.user.email}. Sinkronisasi Google Drive aktif!`
      );

      // Attempt to load cloud state if exists
      try {
        const cloudData = await loadStateFromCloud();
        if (cloudData && (cloudData.log.length > 0 || cloudData.rhk.length > 0)) {
          if (
            confirm(
              'Ditemukan data kinerja tersimpan di cloud untuk akun Google ini. Muat data dari cloud?'
            )
          ) {
            setState(cloudData);
            saveState(cloudData);
            setHasUnsavedChanges(false);
            showToast('success', 'Data kinerja berhasil disinkronkan dari akun Google Anda!');
          }
        }
      } catch (loadErr) {
        console.warn('Tidak ada data cloud sebelumnya:', loadErr);
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        showToast('error', err?.message || 'Gagal masuk dengan Google.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      await logOut();
      setCurrentUser(null);
      showToast('info', 'Anda telah keluar dari akun Google.');
    } catch (err: any) {
      showToast('error', 'Gagal keluar.');
    }
  };

  // Save state on changes
  const updateStateAndSave = (updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev);
      saveState(next);
      setHasUnsavedChanges(true);
      return next;
    });
  };

  // Cloud Save Handler
  const handleSaveToCloud = async () => {
    if (!currentUser) {
      showToast('info', 'Silakan masuk dengan akun Google terlebih dahulu untuk menyimpan ke cloud.');
      handleGoogleSignIn();
      return;
    }

    setIsSavingCloud(true);
    try {
      const res = await saveStateToCloud(state);
      setLastCloudSaved(res.updatedAt);
      localStorage.setItem('last-cloud-saved', res.updatedAt);
      setHasUnsavedChanges(false);
      showToast('success', 'Data kinerja berhasil dicadangkan ke Cloud Firestore!');
    } catch (err: any) {
      showToast('error', err?.message || 'Gagal menyimpan ke cloud.');
    } finally {
      setIsSavingCloud(false);
    }
  };

  // Profile update
  const handleUpdateProfile = (prof: UserProfile) => {
    updateStateAndSave((prev) => ({
      ...prev,
      prof,
    }));
  };

  // RHK operations
  const handleSaveRhk = (rhkItem: RhkItem) => {
    updateStateAndSave((prev) => {
      const exists = prev.rhk.some((r) => r.id === rhkItem.id);
      const updatedRhk = exists
        ? prev.rhk.map((r) => (r.id === rhkItem.id ? rhkItem : r))
        : [...prev.rhk, rhkItem];
      return { ...prev, rhk: updatedRhk };
    });
  };

  const handleDeleteRhk = (id: string) => {
    updateStateAndSave((prev) => ({
      ...prev,
      rhk: prev.rhk.filter((r) => r.id !== id),
      log: prev.log.map((l) => (l.rhk === id ? { ...l, rhk: '' } : l)),
    }));
  };

  // Log operations
  const handleSaveLog = (logItem: LogItem) => {
    updateStateAndSave((prev) => {
      const exists = prev.log.some((l) => l.id === logItem.id);
      const updatedLog = exists
        ? prev.log.map((l) => (l.id === logItem.id ? logItem : l))
        : [logItem, ...prev.log];
      return { ...prev, log: updatedLog };
    });
  };

  const handleDeleteLog = (id: string) => {
    updateStateAndSave((prev) => ({
      ...prev,
      log: prev.log.filter((l) => !logIdsMatch(l.id, id)),
    }));
  };

  const logIdsMatch = (a: string, b: string) => a === b;

  const handleBatchUpdateRhk = (logIds: string[], rhkId: string) => {
    updateStateAndSave((prev) => ({
      ...prev,
      log: prev.log.map((l) => (logIds.includes(l.id) ? { ...l, rhk: rhkId } : l)),
    }));
  };

  const handleBatchDelete = (logIds: string[]) => {
    updateStateAndSave((prev) => ({
      ...prev,
      log: prev.log.filter((l) => !logIds.includes(l.id)),
    }));
  };

  const handleUpdateLogs = (newLogs: LogItem[]) => {
    updateStateAndSave((prev) => ({
      ...prev,
      log: newLogs,
    }));
  };

  const handleUpdateRingkas = (periode: string, rhkId: string, actionPlans: string[]) => {
    updateStateAndSave((prev) => {
      const key = `${periode}|${rhkId}`;
      return {
        ...prev,
        ringkas: {
          ...prev.ringkas,
          [key]: actionPlans,
        },
      };
    });
  };

  const handleRestoreState = (newState: AppState) => {
    setState(newState);
    saveState(newState);
    setHasUnsavedChanges(false);
  };

  const handleOpenAddLog = () => {
    setActiveTab('log');
    setOpenAddLogDirectly(true);
  };

  const handleTriggerAiClassification = () => {
    setActiveTab('lap');
  };

  const unclassifiedCount = state.log.filter(
    (l) => !l.rhk || !state.rhk.some((r) => r.id === l.rhk)
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Header with Google Sign-In & Save Button */}
      <Header
        profile={state.prof}
        currentUser={currentUser}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(!darkMode)}
        onQuickPrint={() => {
          setActiveTab('lap');
          setTimeout(() => window.print(), 300);
        }}
        unclassifiedCount={unclassifiedCount}
        onSaveToCloud={handleSaveToCloud}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        isSavingCloud={isSavingCloud}
        isSigningIn={isSigningIn}
        lastCloudSaved={lastCloudSaved}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Tabs Navigation (Desktop Top Bar + Mobile Bottom Bar) */}
      <Navigation
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setOpenAddLogDirectly(false);
        }}
        rhkCount={state.rhk.length}
        logCount={state.log.length}
        unclassifiedCount={unclassifiedCount}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl bg-slate-900 text-white border border-slate-700 text-xs sm:text-sm animate-bounce">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Content Area (with bottom spacing for mobile nav bar) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 sm:pb-8">
        {activeTab === 'dashboard' && (
          <DashboardTab
            state={state}
            onNavigate={(t) => {
              setActiveTab(t);
              setOpenAddLogDirectly(false);
            }}
            onOpenAddLog={handleOpenAddLog}
            onTriggerAiClassification={handleTriggerAiClassification}
          />
        )}

        {activeTab === 'rhk' && (
          <RhkTab
            rhkList={state.rhk}
            logList={state.log}
            onSaveRhk={handleSaveRhk}
            onDeleteRhk={handleDeleteRhk}
          />
        )}

        {activeTab === 'log' && (
          <LogTab
            state={state}
            onSaveLog={handleSaveLog}
            onDeleteLog={handleDeleteLog}
            onBatchUpdateRhk={handleBatchUpdateRhk}
            onBatchDelete={handleBatchDelete}
            initialOpenAdd={openAddLogDirectly}
          />
        )}

        {activeTab === 'lap' && (
          <LaporanTab
            state={state}
            onUpdateLogs={handleUpdateLogs}
            onUpdateRingkas={handleUpdateRingkas}
          />
        )}

        {activeTab === 'set' && (
          <SettingsTab
            state={state}
            onUpdateProfile={handleUpdateProfile}
            onRestoreState={handleRestoreState}
            lastCloudSaved={lastCloudSaved}
            onCloudSavedSuccess={(updatedAt) => {
              setLastCloudSaved(updatedAt);
              localStorage.setItem('last-cloud-saved', updatedAt);
              setHasUnsavedChanges(false);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="no-print mt-auto border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 sm:py-6 text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              e-Kinerja Harian ASN
            </span>
            <span>· Standar SKP PermenPAN-RB No. 6 Tahun 2022</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Sinkronisasi Google Drive & Cloud</span>
            <span>·</span>
            <span>Didukung Gemini Flash</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
