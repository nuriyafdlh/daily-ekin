import React, { useState } from 'react';
import { UserProfile } from '../types';
import { User } from 'firebase/auth';
import {
  Moon,
  Sun,
  Printer,
  Shield,
  Sparkles,
  CloudUpload,
  Loader2,
  Check,
  LogOut,
  FolderSync,
} from 'lucide-react';

interface HeaderProps {
  profile: UserProfile;
  currentUser: User | null;
  darkMode: boolean;
  onToggleTheme: () => void;
  onQuickPrint: () => void;
  unclassifiedCount: number;
  onSaveToCloud: () => void;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
  isSavingCloud: boolean;
  isSigningIn: boolean;
  lastCloudSaved: string | null;
  hasUnsavedChanges: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  currentUser,
  darkMode,
  onToggleTheme,
  onQuickPrint,
  unclassifiedCount,
  onSaveToCloud,
  onGoogleSignIn,
  onSignOut,
  isSavingCloud,
  isSigningIn,
  lastCloudSaved,
  hasUnsavedChanges,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="app-header no-print bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col items-stretch justify-center gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:py-0 sm:h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-sm sm:text-lg text-slate-900 dark:text-slate-100 tracking-tight truncate">
                  e-Kinerja ASN
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50 hidden md:inline-flex items-center gap-1">
                  <FolderSync className="w-2.5 h-2.5 text-indigo-500" /> GDrive & Cloud
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate max-w-[140px] sm:max-w-sm">
                {profile.unitKerja || 'Aparatur Sipil Negara'}
              </p>
            </div>
          </div>

          {/* Right actions: Google Login / Profile, Cloud Save Button, print, theme */}
          <div className="flex items-center justify-end gap-2 sm:gap-2.5">
            {/* Google Sign In Button if not signed in */}
            {!currentUser ? (
              <button
                onClick={onGoogleSignIn}
                disabled={isSigningIn}
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-xs transition-colors cursor-pointer"
                title="Login Google untuk sinkronisasi antar perangkat dan Google Drive"
              >
                {isSigningIn ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
                )}
                <span className="hidden sm:inline">Masuk Google</span>
                <span className="sm:hidden text-[11px]">Login</span>
              </button>
            ) : (
              /* Signed in user menu */
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  type="button"
                  aria-label="Menu akun Google"
                  aria-expanded={showUserMenu}
                  className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 text-xs transition-colors cursor-pointer"
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || ''}
                      className="w-6 h-6 rounded-full object-cover border border-indigo-400"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">
                      {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'G'}
                    </div>
                  )}
                  <span className="hidden md:inline font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">
                    {currentUser.displayName?.split(' ')[0]}
                  </span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-3 z-50 text-xs space-y-2">
                    <div className="border-b border-slate-100 dark:border-slate-700 pb-2">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {currentUser.displayName || profile.nama}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {currentUser.email}
                      </div>
                    </div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Tersinkron dengan Google Drive</span>
                    </div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onSignOut();
                      }}
                      type="button"
                      className="w-full mt-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-left font-semibold cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar (Sign Out)</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Cloud Save Button */}
            <button
              onClick={onSaveToCloud}
              disabled={isSavingCloud}
              type="button"
              className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/40 animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
              title="Cadangkan dan simpan seluruh data ke Cloud"
              aria-label={isSavingCloud ? 'Menyimpan ke cloud' : 'Simpan ke cloud'}
              aria-busy={isSavingCloud}
            >
              {isSavingCloud ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">Menyimpan...</span>
                  <span className="sm:hidden text-[11px]">Menyimpan...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Simpan Cloud</span>
                  <span className="sm:hidden text-[11px]">Simpan Cloud</span>
                </>
              )}
            </button>

            {/* Print Button (Hidden on very small screens, accessible via Laporan) */}
            <button
              onClick={onQuickPrint}
              type="button"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Cetak Laporan / Simpan PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Cetak</span>
            </button>

            {/* Dark mode toggle */}
            <button
              onClick={onToggleTheme}
              type="button"
              className="p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
              title={darkMode ? 'Mode Terang' : 'Mode Gelap'}
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
