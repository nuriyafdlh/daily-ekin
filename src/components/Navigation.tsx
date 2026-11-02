import React from 'react';
import {
  LayoutDashboard,
  Target,
  Clock,
  FileSpreadsheet,
  Settings,
  Sparkles,
  Cloud,
} from 'lucide-react';

export type TabKey = 'dashboard' | 'rhk' | 'log' | 'lap' | 'set';

interface NavigationProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  rhkCount: number;
  logCount: number;
  unclassifiedCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  rhkCount,
  logCount,
  unclassifiedCount,
}) => {
  const tabs = [
    {
      id: 'dashboard' as TabKey,
      label: 'Dashboard',
      mobileLabel: 'Beranda',
      icon: LayoutDashboard,
    },
    {
      id: 'rhk' as TabKey,
      label: '1. RHK',
      mobileLabel: 'RHK',
      icon: Target,
      badge: rhkCount > 0 ? `${rhkCount}` : undefined,
    },
    {
      id: 'log' as TabKey,
      label: '2. Kinerja Harian',
      mobileLabel: 'Catat',
      icon: Clock,
      badge: logCount > 0 ? `${logCount}` : undefined,
      warningBadge: unclassifiedCount > 0 ? unclassifiedCount : undefined,
    },
    {
      id: 'lap' as TabKey,
      label: '3. Laporan SKP',
      mobileLabel: 'Laporan',
      icon: FileSpreadsheet,
      hasAi: true,
    },
    {
      id: 'set' as TabKey,
      label: 'Pengaturan',
      mobileLabel: 'Akun',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Desktop / Tablet Navigation (Hidden on mobile) */}
      <nav className="no-print hidden sm:block bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto no-scrollbar gap-1 sm:gap-2 py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  type="button"
                  className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm whitespace-nowrap transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  />
                  <span>{tab.label}</span>

                  {tab.hasAi && (
                    <span
                      className={`inline-flex items-center text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        isActive
                          ? 'bg-indigo-500/50 text-white'
                          : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                      }`}
                    >
                      AI
                    </span>
                  )}

                  {tab.badge && !tab.warningBadge && (
                    <span
                      className={`text-[11px] font-semibold px-1.5 py-0.2 rounded-md ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}

                  {tab.warningBadge !== undefined && (
                    <span
                      title={`${tab.warningBadge} kegiatan belum diklasifikasikan`}
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md flex items-center gap-0.5 ${
                        isActive
                          ? 'bg-amber-400 text-amber-950'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                      }`}
                    >
                      {tab.warningBadge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar (Sticky, Native-App Experience) */}
      <nav className="no-print sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-2 py-1 shadow-2xl safe-area-bottom">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                type="button"
                className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all relative ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 font-medium'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                  {tab.warningBadge !== undefined && (
                    <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-amber-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center animate-pulse">
                      {tab.warningBadge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-1 leading-none truncate max-w-[58px]">
                  {tab.mobileLabel}
                </span>
                {isActive && (
                  <span className="w-1 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
