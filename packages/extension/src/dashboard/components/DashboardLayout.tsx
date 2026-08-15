import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Briefcase,
  Send,
  Clock,
  Award,
  History,
  Mail,
  Settings,
  LogOut,
  Sun,
  Moon,
  Zap,
} from 'lucide-react';
import { useAuthStore, useContactsStore, useJobsStore, useSettingsStore } from '../store';
import { signOut, updateSettings } from '../services/appService';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { contacts } = useContactsStore();
  const { jobs } = useJobsStore();
  const { settings } = useSettingsStore();
  const location = useLocation();

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('refloop_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('refloop_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const readyToSendCount = contacts.filter(
    (c) =>
      c.outreachMessageStatus === 'READY_TO_SEND' ||
      c.followUp1Status === 'READY_TO_SEND' ||
      c.followUp2Status === 'READY_TO_SEND'
  ).length;

  const followUpCount = contacts.filter(
    (c) => c.followUp1Status === 'READY_TO_SEND' || c.followUp2Status === 'READY_TO_SEND'
  ).length;

  const referralCount = jobs.filter((j) => j.status === 'REFERRAL_RECEIVED').length;

  const navItems = [
    { label: 'Jobs', path: '/jobs', icon: Briefcase, count: jobs.filter((j) => j.status === 'ACTIVE').length },
    { label: 'Launch Control', path: '/launch', icon: Send, count: readyToSendCount, highlight: readyToSendCount > 0 },
    { label: 'Follow-ups', path: '/followups', icon: Clock, count: followUpCount },
    { label: 'Referrals Received', path: '/referrals', icon: Award, count: referralCount },
    { label: 'History', path: '/history', icon: History },
    { label: 'Email Finder', path: '/email-finder', icon: Mail },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#FAF8F5] dark:bg-[#18181B] text-[#1C1917] dark:text-stone-100 font-sans select-none">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#E8E3DA] dark:border-stone-800 bg-[#FFFFFF] dark:bg-[#1C1917] flex flex-col justify-between">
        <div>
          {/* Brand header */}
          <div className="h-16 flex items-center px-6 border-b border-[#E8E3DA] dark:border-stone-800">
            <div className="flex items-center space-x-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#E06D53] to-[#D97757] flex items-center justify-center text-white shadow-sm font-bold">
                ⚡
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight text-[#1C1917] dark:text-stone-100">RefLoop</span>
                <span className="text-xs text-[#D97757] dark:text-[#E06D53] font-semibold block -mt-1">Outreach Pipeline</span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#FDF4F0] text-[#D97757] dark:bg-[#3A221C] dark:text-[#E06D53] font-semibold'
                      : 'text-[#78716C] hover:bg-[#F4F0EA] dark:text-stone-400 dark:hover:bg-stone-800 hover:text-[#1C1917]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-4 w-4 ${isActive ? 'text-[#D97757] dark:text-[#E06D53]' : 'text-[#A8A29E]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        item.highlight
                          ? 'bg-[#D97757] text-white animate-pulse'
                          : 'bg-[#E8E3DA] dark:bg-stone-800 text-[#1C1917] dark:text-stone-300'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Account & Theme Toggle Footer */}
        <div className="p-4 border-t border-[#E8E3DA] dark:border-stone-800 space-y-2">
          {/* Theme Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium text-[#78716C] dark:text-stone-300 hover:bg-[#F4F0EA] dark:hover:bg-stone-800 transition-colors border border-transparent dark:border-stone-800"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <div className="flex items-center space-x-2.5">
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-500" />
              )}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </div>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </button>

          {/* Pro Mode Toggle */}
          <button
            id="pro-mode-toggle"
            onClick={() => void updateSettings({ proModeEnabled: !settings.proModeEnabled })}
            className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
              settings.proModeEnabled
                ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300'
                : 'text-[#78716C] dark:text-stone-400 hover:bg-[#F4F0EA] dark:hover:bg-stone-800 border-transparent dark:border-stone-800'
            }`}
            title="Toggle Pro Mode — Gmail acceptance detection"
          >
            <div className="flex items-center space-x-2.5">
              <Zap className={`h-4 w-4 ${settings.proModeEnabled ? 'text-amber-500 fill-amber-400' : 'text-[#A8A29E]'}`} />
              <span className="font-semibold">Pro Mode</span>
            </div>
            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded transition-colors ${
              settings.proModeEnabled
                ? 'bg-amber-400 text-white'
                : 'bg-stone-200 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
            }`}>
              {settings.proModeEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          {user && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-800/60 border border-[#E8E3DA] dark:border-stone-800">
              <div className="flex items-center space-x-3 overflow-hidden">
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt={user.displayName ?? ''} className="h-8 w-8 rounded-full border border-[#E8E3DA]" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[#D97757] text-white flex items-center justify-center font-bold text-xs">
                    {(user.displayName ?? user.email)[0]?.toUpperCase()}
                  </div>
                )}
                <div className="truncate">
                  <p className="text-xs font-semibold text-[#1C1917] dark:text-stone-100 truncate">
                    {user.displayName ?? 'User'}
                  </p>
                  <p className="text-[11px] text-[#78716C] dark:text-stone-400 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => void signOut()}
                className="p-1.5 text-[#A8A29E] hover:text-rose-600 dark:hover:text-rose-400 transition-colors rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto flex flex-col bg-[#FAF8F5] dark:bg-[#18181B]">
        <div className="p-8 max-w-7xl w-full mx-auto flex-1">{children}</div>
      </main>
    </div>
  );
}
