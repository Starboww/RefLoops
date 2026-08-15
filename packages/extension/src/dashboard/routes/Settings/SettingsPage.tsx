import React, { useEffect, useState } from 'react';
import { Save, Download, Upload, Mail, RefreshCw, Unlink, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Input, Textarea, FormField, Card } from '@refloop/ui';
import { useSettingsStore } from '../../store';
import {
  updateSettings,
  exportData,
  importData,
  gmailSyncNow,
  disconnectGmail,
  getGmailSyncState,
} from '../../services/appService';
import { GmailOnboardingModal } from './GmailOnboardingModal';
import type { GmailSyncState } from '@refloop/storage-chrome';

export function SettingsPage() {
  const { settings } = useSettingsStore();

  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // Gmail Pro Mode state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [gmailState, setGmailState] = useState<GmailSyncState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Keep form in sync when settings change reactively
  useEffect(() => {
    setForm(settings);
  }, [settings]);

  // Load Gmail sync state when Pro Mode is on
  useEffect(() => {
    if (!settings.proModeEnabled) return;
    void getGmailSyncState().then(setGmailState).catch(() => null);
  }, [settings.proModeEnabled, settings.gmailSyncEnabled]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateSettings(form);
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImporting(true);
      await importData(file);
      alert('Data imported successfully!');
    } catch (err) {
      alert(`Import failed: ${String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  // Toggle Gmail sync — opens onboarding modal if enabling for the first time
  const handleGmailSyncToggle = async (enable: boolean) => {
    if (enable) {
      setShowOnboarding(true);
    } else {
      await updateSettings({ gmailSyncEnabled: false });
    }
  };

  const handleOnboardingSuccess = async () => {
    setShowOnboarding(false);
    // Reload sync state after connecting
    const state = await getGmailSyncState();
    setGmailState(state);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const state = await gmailSyncNow();
      setGmailState(state);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectGmail();
      await updateSettings({ gmailSyncEnabled: false });
      setGmailState(null);
    } finally {
      setDisconnecting(false);
    }
  };

  const formatLastSynced = (ts: number | null) => {
    if (!ts) return 'Never';
    const diff = Math.round((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    return `${Math.round(diff / 3600)}h ago`;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {showOnboarding && (
        <GmailOnboardingModal
          onSuccess={() => void handleOnboardingSuccess()}
          onCancel={() => setShowOnboarding(false)}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Global Settings</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Configure default delays, message templates, daily caps, and backup/restore.
        </p>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">Scheduling &amp; Delay Delays</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Contact Expiry (Days)" helpText="Auto-expire unaccepted LinkedIn connects">
              <Input
                type="number"
                value={form.contactExpiryDays}
                onChange={(e) => setForm({ ...form, contactExpiryDays: Number(e.target.value) })}
              />
            </FormField>

            <FormField label="Follow-up 1 Delay (Days)" helpText="Delay after outreach sent">
              <Input
                type="number"
                value={form.followUp1DelayDays}
                onChange={(e) => setForm({ ...form, followUp1DelayDays: Number(e.target.value) })}
              />
            </FormField>

            <FormField label="Follow-up 2 Delay (Days)" helpText="Delay after FU1 sent">
              <Input
                type="number"
                value={form.followUp2DelayDays}
                onChange={(e) => setForm({ ...form, followUp2DelayDays: Number(e.target.value) })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <FormField label="Send Window Start" helpText="e.g. 09:00">
              <Input
                type="time"
                value={form.sendWindowStart}
                onChange={(e) => setForm({ ...form, sendWindowStart: e.target.value })}
              />
            </FormField>

            <FormField label="Send Window End" helpText="e.g. 10:00">
              <Input
                type="time"
                value={form.sendWindowEnd}
                onChange={(e) => setForm({ ...form, sendWindowEnd: e.target.value })}
              />
            </FormField>

            <FormField label="Daily Send Soft Cap" helpText="Shows warning when exceeded">
              <Input
                type="number"
                value={form.dailySendCap}
                onChange={(e) => setForm({ ...form, dailySendCap: Number(e.target.value) })}
              />
            </FormField>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">Default Global Templates</h2>
          <FormField label="Greeting Format" helpText="Use {{firstName}} placeholder">
            <Input
              value={form.greetingFormat}
              onChange={(e) => setForm({ ...form, greetingFormat: e.target.value })}
              placeholder="Hi {{firstName}},"
            />
          </FormField>

          <FormField label="Global Follow-up 1 Template">
            <Textarea
              rows={4}
              value={form.followUp1Template}
              onChange={(e) => setForm({ ...form, followUp1Template: e.target.value })}
            />
          </FormField>

          <FormField label="Global Follow-up 2 Template">
            <Textarea
              rows={4}
              value={form.followUp2Template}
              onChange={(e) => setForm({ ...form, followUp2Template: e.target.value })}
            />
          </FormField>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" isLoading={saving} className="space-x-2">
            <Save className="h-4 w-4" />
            <span>Save Settings</span>
          </Button>
        </div>
      </form>

      {/* ------------------------------------------------------------------ */}
      {/* Pro Mode — Gmail Acceptance Detection                               */}
      {/* ------------------------------------------------------------------ */}
      {settings.proModeEnabled && (
        <Card className="p-6 space-y-5 border-2 border-amber-200 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/60 to-orange-50/30 dark:from-amber-900/10 dark:to-stone-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                ✨
              </div>
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Pro Mode — Gmail Acceptance Detection
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Auto-detect when LinkedIn connections are accepted via Gmail metadata
                </p>
              </div>
            </div>

            {/* Gmail Sync toggle */}
            <button
              id="gmail-sync-toggle"
              onClick={() => void handleGmailSyncToggle(!settings.gmailSyncEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 ${
                settings.gmailSyncEnabled
                  ? 'bg-amber-500'
                  : 'bg-stone-200 dark:bg-stone-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  settings.gmailSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {settings.gmailSyncEnabled && (
            <>
              {/* Sync interval */}
              <div className="flex items-center space-x-4 pt-1">
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300 whitespace-nowrap">
                  Check interval:
                </label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    value={settings.gmailSyncIntervalHours}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(24, Number(e.target.value)));
                      void updateSettings({ gmailSyncIntervalHours: val });
                    }}
                    className="w-20 h-8 text-xs text-center"
                  />
                  <span className="text-xs text-stone-500">hour{settings.gmailSyncIntervalHours !== 1 ? 's' : ''}</span>
                  <span className="text-[11px] text-stone-400">(1 – 24)</span>
                </div>
              </div>

              {/* Connection status */}
              <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white/70 dark:bg-stone-800/50 p-4 space-y-3">
                {gmailState?.connected ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">Gmail Connected</span>
                      </div>
                      <span className="text-[11px] text-stone-400">
                        Last synced: {formatLastSynced(gmailState.lastCheckedAt)}
                      </span>
                    </div>

                    {gmailState.lastSyncStatus === 'FAILED' && gmailState.lastSyncError && (
                      <div className="flex items-start space-x-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-2.5">
                        <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-rose-700 dark:text-rose-300">{gmailState.lastSyncError}</p>
                      </div>
                    )}

                    {syncError && (
                      <div className="flex items-start space-x-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-2.5">
                        <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-rose-700 dark:text-rose-300">{syncError}</p>
                      </div>
                    )}

                    <div className="flex items-center space-x-3 pt-1">
                      <Button
                        id="gmail-sync-now-btn"
                        onClick={() => void handleSyncNow()}
                        variant="outline"
                        size="sm"
                        isLoading={syncing}
                        className="space-x-1.5 text-xs h-8"
                      >
                        {!syncing && <RefreshCw className="h-3.5 w-3.5" />}
                        <span>Sync Now</span>
                      </Button>
                      <Button
                        id="gmail-disconnect-btn"
                        onClick={() => void handleDisconnect()}
                        variant="outline"
                        size="sm"
                        isLoading={disconnecting}
                        className="space-x-1.5 text-xs h-8 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                      >
                        {!disconnecting && <Unlink className="h-3.5 w-3.5" />}
                        <span>Disconnect Gmail</span>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-stone-400" />
                      <span className="text-xs text-stone-500 dark:text-stone-400">Gmail not connected</span>
                    </div>
                    <Button
                      id="gmail-connect-btn"
                      onClick={() => setShowOnboarding(true)}
                      variant="primary"
                      size="sm"
                      className="text-xs h-8 bg-[#D97757] hover:bg-[#C86545] text-white space-x-1.5"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Connect Gmail</span>
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {!settings.gmailSyncEnabled && (
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Enable the toggle above to connect Gmail and automatically detect when your LinkedIn connection requests are accepted.
            </p>
          )}
        </Card>
      )}

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">Data Management &amp; Backup</h2>
        <p className="text-xs text-stone-500">
          RefLoop stores all data locally in your browser (`chrome.storage.local`). Export JSON backups anytime.
        </p>
        <div className="flex items-center space-x-4 pt-2">
          <Button onClick={() => void exportData()} variant="outline" className="space-x-2">
            <Download className="h-4 w-4" />
            <span>Export Backup (.json)</span>
          </Button>

          <label className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-stone-300 dark:border-stone-700 bg-transparent hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 h-9 px-4 cursor-pointer">
            <Upload className="h-4 w-4 mr-2" />
            <span>{importing ? 'Importing...' : 'Import Backup'}</span>
            <input type="file" accept=".json" onChange={(e) => void handleFileChange(e)} className="hidden" />
          </label>
        </div>
      </Card>
    </div>
  );
}
