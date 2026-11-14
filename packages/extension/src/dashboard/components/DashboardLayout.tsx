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
    // RefLoop is dark-first
    document.documentElement.classList.add('dark');
    if (theme === 'light') {
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
    <div className="flex h-screen bg-[#1B1F24] text-white font-sans select-none overflow-hidden">
      {/* Enterprise Sidebar (280px) */}
      <aside className="w-[280px] shrink-0 border-r border-white/10 bg-[#181B20] flex flex-col justify-between z-20">
        <div>
          {/* Brand header */}
          <div className="h-16 flex items-center px-6 border-b border-white/10">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-r from-[#FF3C6B] to-[#FF2458] flex items-center justify-center text-white shadow-md font-bold text-base border border-white/20">
                ⚡
              </div>
              <div>
                <span className="font-heading font-bold text-lg tracking-tight text-white block leading-tight">
                  RefLoop
                </span>
                <span className="text-[11px] text-[#FF3C6B] font-medium tracking-wide block -mt-0.5">
                  Outreach Pipeline
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3.5 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                    isActive
                      ? 'bg-[#292E35] text-white border border-white/10 font-semibold shadow-xs'
                      : 'text-[#C1C6CD] hover:bg-[#1F2228] hover:text-white font-medium'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? 'text-[#FF3C6B]' : 'text-[#8A919D]'
                      }`}
                      strokeWidth={2}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold transition-all ${
                        item.highlight
                          ? 'bg-gradient-to-r from-[#FF3C6B] to-[#FF2458] text-white shadow-xs animate-pulse'
                          : 'bg-[#292E35] text-[#C1C6CD] border border-white/10'
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

        {/* User Account & Controls Footer */}
        <div className="p-4 border-t border-white/10 space-y-2 bg-[#181B20]">
          {/* Theme Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium text-[#C1C6CD] hover:bg-[#292E35] hover:text-white transition-colors border border-white/5"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <div className="flex items-center space-x-2.5">
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-400" />
              )}
              <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
            </div>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/10 text-white">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </button>

          {/* Pro Mode Toggle */}
          <button
            id="pro-mode-toggle"
            onClick={() => void updateSettings({ proModeEnabled: !settings.proModeEnabled })}
            className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
              settings.proModeEnabled
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                : 'text-[#C1C6CD] hover:bg-[#292E35] border-white/5'
            }`}
            title="Toggle Pro Mode — Gmail acceptance detection"
          >
            <div className="flex items-center space-x-2.5">
              <Zap className={`h-4 w-4 ${settings.proModeEnabled ? 'text-amber-400 fill-amber-400' : 'text-[#8A919D]'}`} />
              <span className="font-semibold">Pro Mode</span>
            </div>
            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded transition-colors ${
              settings.proModeEnabled
                ? 'bg-amber-400 text-black'
                : 'bg-white/10 text-[#8A919D]'
            }`}>
              {settings.proModeEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          {user && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#1F2228] border border-white/10">
              <div className="flex items-center space-x-3 overflow-hidden">
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt={user.displayName ?? ''} className="h-8 w-8 rounded-full border border-white/20" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-[#FF3C6B] to-[#FF2458] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {(user.displayName ?? user.email)[0]?.toUpperCase()}
                  </div>
                )}
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">
                    {user.displayName ?? 'User'}
                  </p>
                  <p className="text-[11px] text-[#C1C6CD] truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => void signOut()}
                className="p-1.5 text-[#8A919D] hover:text-[#DD2C61] transition-colors rounded-lg hover:bg-white/10"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Workspace Area */}
      <main className="flex-1 overflow-y-auto flex flex-col bg-[#1B1F24] relative">
        {/* Subtle Ambient Radial Glows */}
        <div className="glow-purple -top-20 -right-20 opacity-70" />
        <div className="glow-pink bottom-0 left-1/3 opacity-40" />

        <div className="p-8 max-w-7xl w-full mx-auto flex-1 relative z-10">{children}</div>
      </main>
    </div>
  );
}
