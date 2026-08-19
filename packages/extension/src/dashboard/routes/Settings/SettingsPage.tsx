import React, { useEffect, useState, useMemo } from 'react';
import {
  Save,
  Download,
  Upload,
  Mail,
  RefreshCw,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Shield,
  Sparkles,
  Sliders,
  Database,
  MessageSquare,
  Copy,
  Check,
  Eye,
  Info,
  Zap,
  Plus,
  Trash2,
  AlertTriangle,
  Edit3,
} from 'lucide-react';
import { Button, Input, Textarea, FormField, Card } from '@refloop/ui';
import { useSettingsStore, useJobsStore, useContactsStore } from '../../store';
import {
  updateSettings,
  exportData,
  importData,
  gmailSyncNow,
  disconnectGmail,
  getGmailSyncState,
  resetGmailSyncAndResync,
} from '../../services/appService';
import { GmailOnboardingModal } from './GmailOnboardingModal';
import {
  MessageAssemblyService,
  validateMessageTemplate,
  type DetectedVariable,
  type GlobalSettings,
  type Stage,
} from '@refloop/core';
import type { GmailSyncState } from '@refloop/storage-chrome';

export function SettingsPage() {
  const { settings } = useSettingsStore();
  const { jobs } = useJobsStore();
  const { contacts } = useContactsStore();

  const [form, setForm] = useState<GlobalSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Custom Variable Form State
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarVal, setNewVarVal] = useState('');

  // Quick fill modal/inline input state
  const [fillVarName, setFillVarName] = useState<string | null>(null);
  const [fillVarValue, setFillVarValue] = useState('');

  // Tab State
  const [activeTab, setActiveTab] = useState<'cadence' | 'templates' | 'promode' | 'data'>('cadence');
  const [activeTemplateSubTab, setActiveTemplateSubTab] = useState<'greeting' | 'fu1' | 'fu2'>('greeting');
  const [previewStage, setPreviewStage] = useState<Stage>('FU1');

  // Gmail Pro Mode state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [gmailState, setGmailState] = useState<GmailSyncState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [resetting, setResetting] = useState(false);
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      await updateSettings(form);
      showToast('Settings saved successfully! ✨');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyVar = (variableTag: string) => {
    void navigator.clipboard.writeText(variableTag);
    setCopiedVar(variableTag);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  const handleAddCustomVar = async () => {
    if (!newVarKey.trim()) return;
    const cleanKey = newVarKey.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleanKey) return;
    const norm = cleanKey.toLowerCase();

    let updatedForm = { ...form };
    if (norm === 'mycurrenttitle') {
      updatedForm = { ...updatedForm, myCurrentTitle: newVarVal.trim() };
    } else if (norm === 'yearsofexperience' || norm === 'yearofexperience') {
      updatedForm = { ...updatedForm, yearsOfExperience: newVarVal.trim() };
    } else {
      updatedForm = {
        ...updatedForm,
        customVariables: {
          ...(form.customVariables || {}),
          [cleanKey]: newVarVal.trim(),
        },
      };
    }

    setForm(updatedForm);
    setNewVarKey('');
    setNewVarVal('');
    await updateSettings(updatedForm);
    showToast(`Added variable {{${cleanKey}}} ✨`);
  };

  const handleRemoveCustomVar = async (key: string) => {
    const norm = key.toLowerCase();
    let updatedForm = { ...form };
    if (norm === 'mycurrenttitle') {
      updatedForm = { ...updatedForm, myCurrentTitle: '' };
    } else if (norm === 'yearsofexperience' || norm === 'yearofexperience') {
      updatedForm = { ...updatedForm, yearsOfExperience: '' };
    } else {
      const updatedCustom = { ...(form.customVariables || {}) };
      delete updatedCustom[key];
      updatedForm = { ...updatedForm, customVariables: updatedCustom };
    }
    setForm(updatedForm);
    await updateSettings(updatedForm);
    showToast(`Removed variable {{${key}}}`);
  };

  const handleSaveFilledVariable = async (varName: string, val: string) => {
    const norm = varName.toLowerCase().trim();
    let updatedForm = { ...form };
    if (norm === 'mycurrenttitle') {
      updatedForm = { ...updatedForm, myCurrentTitle: val };
    } else if (norm === 'yearsofexperience' || norm === 'yearofexperience') {
      updatedForm = { ...updatedForm, yearsOfExperience: val };
    } else {
      updatedForm = {
        ...updatedForm,
        customVariables: {
          ...(form.customVariables || {}),
          [varName]: val,
        },
      };
    }
    setForm(updatedForm);
    await updateSettings(updatedForm);
    setFillVarName(null);
    setFillVarValue('');
    showToast(`Updated value for {{${varName}}}! ✨`);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportData();
      showToast('Backup data exported successfully! 📦');
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImporting(true);
      await importData(file);
      showToast('Backup data imported successfully! 🎉');
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // Toggle Gmail sync — opens onboarding modal if enabling for the first time
  const handleGmailSyncToggle = async (enable: boolean) => {
    if (enable) {
      setShowOnboarding(true);
    } else {
      await updateSettings({ gmailSyncEnabled: false });
      showToast('Gmail sync disabled');
    }
  };

  const handleOnboardingSuccess = async () => {
    setShowOnboarding(false);
    const state = await getGmailSyncState();
    setGmailState(state);
    showToast('Gmail connected successfully! 🚀');
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const state = await gmailSyncNow();
      setGmailState(state);
      showToast('Gmail scanned successfully!');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleResetAndResync = async () => {
    setResetting(true);
    setSyncError(null);
    try {
      const state = await resetGmailSyncAndResync();
      setGmailState(state);
      showToast('Sync cache cleared — re-scanning from scratch!');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectGmail();
      await updateSettings({ gmailSyncEnabled: false });
      setGmailState(null);
      showToast('Gmail disconnected');
    } finally {
      setDisconnecting(false);
    }
  };

  const toggleActiveDay = (dayIndex: number) => {
    const currentDays = form.activeDays || [1, 2, 3, 4, 5];
    let newDays: number[];
    if (currentDays.includes(dayIndex)) {
      if (currentDays.length === 1) return; // keep at least 1 day
      newDays = currentDays.filter((d) => d !== dayIndex);
    } else {
      newDays = [...currentDays, dayIndex].sort();
    }
    setForm({ ...form, activeDays: newDays });
  };

  const formatLastSynced = (ts: number | null) => {
    if (!ts) return 'Never';
    const diff = Math.round((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    return `${Math.round(diff / 3600)}h ago`;
  };

  // Template preview assembly
  const assembler = useMemo(() => new MessageAssemblyService(), []);

  const sampleJob = jobs[0] || {
    id: 'sample-job',
    companyName: 'Acme Corp',
    jobTitle: 'Senior Software Engineer',
    jobLink: 'https://linkedin.com/jobs/view/12345',
    status: 'ACTIVE',
    dateAdded: new Date().toISOString(),
    referralMessageTemplate: "I noticed an opening for {jobTitle} at {companyName} and would love to know if you'd be open to referring me.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleContact = contacts[0] || {
    id: 'sample-contact',
    jobPostingId: sampleJob.id,
    channel: 'LINKEDIN',
    firstName: 'Alex',
    outreachMessageStatus: 'READY_TO_SEND',
    followUp1Status: 'NOT_SCHEDULED',
    followUp2Status: 'NOT_SCHEDULED',
    connectionStatus: 'ACCEPTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const assembledPreview = assembler.assemble(
    previewStage,
    sampleJob,
    sampleContact,
    form
  );

  const activeTemplateText = useMemo(() => {
    if (previewStage === 'OUTREACH') return sampleJob.referralMessageTemplate;
    if (previewStage === 'FU1') return form.followUp1Template;
    return form.followUp2Template;
  }, [previewStage, sampleJob.referralMessageTemplate, form.followUp1Template, form.followUp2Template]);

  const validationResult = useMemo(() => {
    return validateMessageTemplate(
      activeTemplateText,
      form.greetingFormat,
      { job: sampleJob, contact: sampleContact, settings: form },
    );
  }, [activeTemplateText, form, sampleJob, sampleContact]);

  const allConfiguredVars = useMemo(() => {
    const list: Array<{ key: string; value: string; isCore?: boolean }> = [];
    if (form.myCurrentTitle?.trim()) {
      list.push({ key: 'myCurrentTitle', value: form.myCurrentTitle, isCore: true });
    }
    if (form.yearsOfExperience?.trim()) {
      list.push({ key: 'yearsOfExperience', value: form.yearsOfExperience, isCore: true });
    }
    if (form.customVariables) {
      for (const [k, v] of Object.entries(form.customVariables)) {
        if (k !== 'myCurrentTitle' && k !== 'yearsOfExperience') {
          list.push({ key: k, value: v });
        }
      }
    }
    return list;
  }, [form.myCurrentTitle, form.yearsOfExperience, form.customVariables]);

  const daysOfWeek = [
    { label: 'Sun', index: 0 },
    { label: 'Mon', index: 1 },
    { label: 'Tue', index: 2 },
    { label: 'Wed', index: 3 },
    { label: 'Thu', index: 4 },
    { label: 'Fri', index: 5 },
    { label: 'Sat', index: 6 },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 bg-[#1C1917] text-white px-4 py-3 rounded-xl shadow-2xl border border-stone-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {showOnboarding && (
        <GmailOnboardingModal
          onSuccess={() => void handleOnboardingSuccess()}
          onCancel={() => setShowOnboarding(false)}
        />
      )}

      {/* Header Hero Card */}
      <div className="bg-white dark:bg-[#1C1917] border border-[#E8E3DA] dark:border-stone-800 p-6 sm:p-7 rounded-2xl shadow-xs transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-[#F4F0EA] dark:bg-stone-800 font-bold text-[#1C1917] dark:text-stone-300 border border-[#E8E3DA] dark:border-stone-700 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-[#D97757]" />
                Global Preferences
              </span>

              <span className="text-xs px-2.5 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 font-semibold text-stone-600 dark:text-stone-400">
                Cap: {form.dailySendCap} msgs/day
              </span>

              {settings.proModeEnabled && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-amber-500 fill-amber-400" />
                  Pro Mode Enabled
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C1917] dark:text-stone-100 tracking-tight">
              Settings &amp; Automation
            </h1>

            <p className="text-xs sm:text-sm font-medium text-[#78716C] dark:text-stone-400">
              Configure outreach cadences, default message templates, daily safety caps, and Gmail sync.
            </p>
          </div>

          {/* Header Action */}
          <div className="flex items-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#E8E3DA] dark:border-stone-800/80">
            <Button
              onClick={() => void handleSave()}
              isLoading={saving}
              variant="primary"
              className="space-x-1.5 bg-gradient-to-r from-[#E06D53] to-[#D97757] hover:opacity-95 text-white shadow-md shadow-[#D97757]/20 text-xs font-bold px-5"
            >
              <Save className="h-4 w-4" />
              <span>Save Changes</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-stone-800 pb-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('cadence')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'cadence'
                ? 'bg-[#1C1917] dark:bg-white text-white dark:text-[#1C1917] shadow-sm'
                : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-[#F4F0EA] dark:hover:bg-stone-800'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Cadence &amp; Safety</span>
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'templates'
                ? 'bg-[#1C1917] dark:bg-white text-white dark:text-[#1C1917] shadow-sm'
                : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-[#F4F0EA] dark:hover:bg-stone-800'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Global Templates</span>
          </button>

          {settings.proModeEnabled && (
            <button
              onClick={() => setActiveTab('promode')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'promode'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
              }`}
            >
              <Zap className="h-4 w-4" />
              <span>Pro Mode (Gmail)</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'data'
                ? 'bg-[#1C1917] dark:bg-white text-white dark:text-[#1C1917] shadow-sm'
                : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-[#F4F0EA] dark:hover:bg-stone-800'
            }`}
          >
            <Database className="h-4 w-4" />
            <span>Data &amp; Backup</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          TAB 1: CADENCE & SAFETY
      ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'cadence' && (
        <div className="space-y-6 pt-2">
          {/* Delays & Expiry Card */}
          <Card className="p-6 bg-white dark:bg-[#1C1917] border-[#E8E3DA] dark:border-stone-800 rounded-2xl shadow-xs space-y-5">
            <div className="flex items-center space-x-3 border-b border-[#E8E3DA] dark:border-stone-800 pb-4">
              <div className="h-9 w-9 rounded-xl bg-[#FDF4F0] dark:bg-[#3A221C] text-[#D97757] flex items-center justify-center font-bold">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1C1917] dark:text-stone-100">Outreach Cadence &amp; Delays</h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Set default waiting times between initial outreach and automated follow-ups.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FormField
                label="Contact Expiry (Days)"
                helpText="Auto-expires unaccepted LinkedIn invites"
              >
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={form.contactExpiryDays}
                    onChange={(e) => setForm({ ...form, contactExpiryDays: Number(e.target.value) })}
                    className="rounded-xl pr-12 font-bold"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-stone-400 font-medium">days</span>
                </div>
              </FormField>

              <FormField
                label="Follow-up 1 Delay"
                helpText="Days to wait after initial outreach sent"
              >
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={form.followUp1DelayDays}
                    onChange={(e) => setForm({ ...form, followUp1DelayDays: Number(e.target.value) })}
                    className="rounded-xl pr-12 font-bold"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-stone-400 font-medium">days</span>
                </div>
              </FormField>

              <FormField
                label="Follow-up 2 Delay"
                helpText="Days to wait after Follow-up 1 sent"
              >
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={form.followUp2DelayDays}
                    onChange={(e) => setForm({ ...form, followUp2DelayDays: Number(e.target.value) })}
                    className="rounded-xl pr-12 font-bold"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-stone-400 font-medium">days</span>
                </div>
              </FormField>
            </div>
          </Card>

          {/* Send Window & Daily Safety Cap Card */}
          <Card className="p-6 bg-white dark:bg-[#1C1917] border-[#E8E3DA] dark:border-stone-800 rounded-2xl shadow-xs space-y-5">
            <div className="flex items-center space-x-3 border-b border-[#E8E3DA] dark:border-stone-800 pb-4">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1C1917] dark:text-stone-100">Send Windows &amp; Safety Limits</h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Control dispatch hours and safety caps to ensure natural, human-like activity.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FormField label="Send Window Start" helpText="Earliest time of day to send (e.g. 09:00)">
                <Input
                  type="time"
                  value={form.sendWindowStart}
                  onChange={(e) => setForm({ ...form, sendWindowStart: e.target.value })}
                  className="rounded-xl font-mono text-xs"
                />
              </FormField>

              <FormField label="Send Window End" helpText="Latest time of day to send (e.g. 18:00)">
                <Input
                  type="time"
                  value={form.sendWindowEnd}
                  onChange={(e) => setForm({ ...form, sendWindowEnd: e.target.value })}
                  className="rounded-xl font-mono text-xs"
                />
              </FormField>

              <FormField label="Daily Send Soft Cap" helpText="Displays alert when threshold reached">
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.dailySendCap}
                    onChange={(e) => setForm({ ...form, dailySendCap: Number(e.target.value) })}
                    className="rounded-xl pr-16 font-bold"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-stone-400 font-medium">msgs/day</span>
                </div>
              </FormField>
            </div>

            {/* Active Weekdays Selector */}
            <div className="pt-2 space-y-2">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                Active Outreach Days
              </label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map(({ label, index }) => {
                  const isActive = (form.activeDays || [1, 2, 3, 4, 5]).includes(index);
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => toggleActiveDay(index)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                        isActive
                          ? 'bg-[#1C1917] dark:bg-white text-white dark:text-[#1C1917] border-transparent shadow-xs'
                          : 'bg-[#FAF8F5] dark:bg-stone-800 text-stone-400 border-[#E8E3DA] dark:border-stone-700 hover:text-stone-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-stone-400">
                Messages will only be queued and dispatched on active days.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          TAB 2: GLOBAL TEMPLATES STUDIO
      ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Left: Template Editor (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">

            {/* 1. Custom & Profile Variables Card */}
            <Card className="p-5 bg-white dark:bg-[#1C1917] border-[#E8E3DA] dark:border-stone-800 rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#E8E3DA] dark:border-stone-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-[#D97757]" />
                  <h3 className="text-sm font-bold text-[#1C1917] dark:text-stone-100">
                    Your Custom &amp; Sender Variables
                  </h3>
                </div>
                <span className="text-[11px] text-stone-400">Personalize templates with dynamic placeholders</span>
              </div>

              {/* Suggestions Chips */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-stone-600 dark:text-stone-300">
                  Quick suggestions (click to pre-fill):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: 'myCurrentTitle', label: 'myCurrentTitle' },
                    { key: 'yearsOfExperience', label: 'yearsOfExperience' },
                    { key: 'portfolioUrl', label: 'portfolioUrl' },
                    { key: 'githubUrl', label: 'githubUrl' },
                    { key: 'myPhone', label: 'myPhone' },
                    { key: 'calendlyLink', label: 'calendlyLink' },
                  ].map((sug) => {
                    const isConfigured = allConfiguredVars.some(
                      (v) => v.key.toLowerCase() === sug.key.toLowerCase() && Boolean(v.value?.trim())
                    );
                    return (
                      <button
                        key={sug.key}
                        type="button"
                        onClick={() => {
                          setNewVarKey(sug.key);
                          if (!newVarVal) setNewVarVal('');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 border ${
                          isConfigured
                            ? 'bg-stone-100 dark:bg-stone-800/80 text-stone-400 dark:text-stone-500 border-stone-200 dark:border-stone-700'
                            : 'bg-[#FDF4F0] dark:bg-[#3A221C] text-[#D97757] dark:text-[#E06D53] border-[#E8E3DA] dark:border-stone-700 hover:border-[#D97757]'
                        }`}
                        title={isConfigured ? `{{${sug.key}}} is configured` : `Click to add {{${sug.key}}}`}
                      >
                        <span className="font-bold">+</span>
                        <span>{"{{" + sug.key + "}}"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Configured Variables List */}
              <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700 dark:text-stone-300">
                    Configured Variables
                  </span>
                  <span className="text-[10px] text-stone-400">
                    {allConfiguredVars.length} {allConfiguredVars.length === 1 ? 'variable' : 'variables'} saved
                  </span>
                </div>

                {allConfiguredVars.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {allConfiguredVars.map(({ key, value }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-mono font-bold text-[#D97757] dark:text-[#E06D53] truncate">
                            {"{{" + key + "}}"}
                          </div>
                          <div className="text-[11px] text-stone-600 dark:text-stone-300 truncate" title={value || '(empty)'}>
                            {value || <span className="italic text-amber-500 font-medium">Unfilled value</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setFillVarName(key);
                              setFillVarValue(value || '');
                            }}
                            className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                            title="Edit value"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemoveCustomVar(key)}
                            className="p-1 rounded-md text-stone-400 hover:text-rose-500 transition-colors"
                            title="Delete variable"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 italic py-1">
                    No custom variables added yet. Click a suggestion above or enter a name below.
                  </p>
                )}

                {/* Add Custom Variable Form */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                  <Input
                    placeholder="Variable name (e.g. portfolioUrl)"
                    value={newVarKey}
                    onChange={(e) => setNewVarKey(e.target.value)}
                    className="text-xs font-mono rounded-xl h-9 text-stone-800 dark:text-stone-100"
                  />
                  <Input
                    placeholder="Value (e.g. https://myportfolio.dev)"
                    value={newVarVal}
                    onChange={(e) => setNewVarVal(e.target.value)}
                    className="text-xs rounded-xl h-9 text-stone-800 dark:text-stone-100"
                  />
                  <Button
                    type="button"
                    onClick={() => void handleAddCustomVar()}
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 text-xs whitespace-nowrap space-x-1 shrink-0 font-bold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Variable</span>
                  </Button>
                </div>
              </div>
            </Card>

            {/* 2. Main Template Editor Card */}
            <Card className="p-6 bg-white dark:bg-[#1C1917] border-[#E8E3DA] dark:border-stone-800 rounded-2xl shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8E3DA] dark:border-stone-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#1C1917] dark:text-stone-100">Global Default Templates</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Fallback templates used across all jobs unless overridden.
                  </p>
                </div>

                {/* Subtab Switcher */}
                <div className="flex items-center space-x-1 bg-[#F4F0EA] dark:bg-stone-800 p-1 rounded-xl shrink-0 border border-[#E8E3DA] dark:border-stone-700">
                  <button
                    onClick={() => {
                      setActiveTemplateSubTab('greeting');
                      setPreviewStage('OUTREACH');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeTemplateSubTab === 'greeting'
                        ? 'bg-white dark:bg-stone-900 text-[#1C1917] dark:text-stone-100 shadow-xs'
                        : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
                    }`}
                  >
                    Greeting
                  </button>
                  <button
                    onClick={() => {
                      setActiveTemplateSubTab('fu1');
                      setPreviewStage('FU1');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeTemplateSubTab === 'fu1'
                        ? 'bg-white dark:bg-stone-900 text-[#1C1917] dark:text-stone-100 shadow-xs'
                        : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
                    }`}
                  >
                    Follow-Up 1
                  </button>
                  <button
                    onClick={() => {
                      setActiveTemplateSubTab('fu2');
                      setPreviewStage('FU2');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeTemplateSubTab === 'fu2'
                        ? 'bg-white dark:bg-stone-900 text-[#1C1917] dark:text-stone-100 shadow-xs'
                        : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
                    }`}
                  >
                    Follow-Up 2
                  </button>
                </div>
              </div>

              {/* Dynamic Variables Quick Chips */}
              <div className="bg-[#FAF8F5] dark:bg-stone-800/40 p-3 rounded-xl border border-[#E8E3DA] dark:border-stone-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#D97757]" />
                    Insert Template Variables
                  </span>
                  <span className="text-[10px] text-stone-400">Click chip to copy / fill value</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: '{{jobTitle}}', label: 'jobTitle', isFilled: true, source: 'Auto (Job Posting)' },
                    { tag: '{{companyName}}', label: 'companyName', isFilled: true, source: 'Auto (Job Posting)' },
                    { tag: '{{firstName}}', label: 'firstName', isFilled: true, source: 'Auto (Contact)' },
                    {
                      tag: '{{myCurrentTitle}}',
                      label: 'myCurrentTitle',
                      isFilled: Boolean(form.myCurrentTitle?.trim()),
                      source: 'Sender Profile',
                    },
                    {
                      tag: '{{yearsOfExperience}}',
                      label: 'yearsOfExperience',
                      isFilled: Boolean(form.yearsOfExperience?.trim()),
                      source: 'Sender Profile',
                    },
                    ...Object.keys(form.customVariables || {}).map((key) => ({
                      tag: `{{${key}}}`,
                      label: key,
                      isFilled: Boolean(form.customVariables?.[key]?.trim()),
                      source: 'Custom Variable',
                    })),
                  ].map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => {
                        handleCopyVar(item.tag);
                        if (!item.isFilled) {
                          setFillVarName(item.label);
                          const norm = item.label.toLowerCase();
                          if (norm === 'mycurrenttitle') setFillVarValue(form.myCurrentTitle || '');
                          else if (norm === 'yearsofexperience') setFillVarValue(form.yearsOfExperience || '');
                          else setFillVarValue(form.customVariables?.[item.label] || '');
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium border transition-all flex items-center gap-1.5 ${
                        item.isFilled
                          ? 'bg-white dark:bg-stone-900 border-[#E8E3DA] dark:border-stone-700 text-[#D97757] dark:text-[#E06D53] hover:border-[#D97757]'
                          : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:border-amber-500'
                      }`}
                      title={item.isFilled ? `Source: ${item.source}` : `Click to fill missing value for ${item.label}`}
                    >
                      <span>{item.tag}</span>
                      {!item.isFilled && (
                        <span className="text-[9px] px-1 bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 rounded font-sans font-bold">
                          Fill Value
                        </span>
                      )}
                      {copiedVar === item.tag ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Fill Variable Popover / Modal Prompt */}
              {fillVarName && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      Set Value for Variable <code className="font-mono text-amber-800 dark:text-amber-100">{"{{" + fillVarName + "}}"}</code>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFillVarName(null)}
                      className="text-amber-700 dark:text-amber-300 hover:text-amber-900 text-xs font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    RefLoop will automatically substitute this value whenever <code className="font-mono font-bold">{"{{" + fillVarName + "}}"}</code> is used in templates.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={fillVarValue}
                      onChange={(e) => setFillVarValue(e.target.value)}
                      placeholder={`Enter value for ${fillVarName}...`}
                      className="text-xs font-mono rounded-xl bg-white dark:bg-stone-900"
                    />
                    <Button
                      type="button"
                      onClick={() => void handleSaveFilledVariable(fillVarName, fillVarValue)}
                      variant="primary"
                      size="sm"
                      className="whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white font-bold"
                    >
                      Save & Apply
                    </Button>
                  </div>
                </div>
              )}

              {/* 3. Greeting Subtab */}
              {activeTemplateSubTab === 'greeting' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-1.5">
                      <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        Default Greeting Format
                      </label>
                      <div
                        className="cursor-pointer text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
                        title="Auto-prepended to outreach and follow-ups. Keep message bodies clean of greeting words like 'Hi Alex' so they are not sent twice."
                      >
                        <Info className="h-3.5 w-3.5 text-[#D97757]" />
                      </div>
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Pre-pended before all messages automatically. Supports <code className="font-mono text-[#D97757]">{"{{firstName}}"}</code>.
                    </p>
                    <Input
                      value={form.greetingFormat}
                      onChange={(e) => setForm({ ...form, greetingFormat: e.target.value })}
                      placeholder="Hi {{firstName}},"
                      className="font-mono text-xs rounded-xl"
                    />
                  </div>
                </div>
              )}

              {/* 4. FU1 Subtab */}
              {activeTemplateSubTab === 'fu1' && (
                <div className="space-y-4">
                  <FormField
                    label="Global Follow-Up 1 Message Template"
                    helpText="Sent if contact does not respond after initial referral ask. Auto-replaces {{jobTitle}}, {{companyName}}, {{firstName}}, {{myCurrentTitle}}, etc."
                  >
                    <Textarea
                      rows={6}
                      value={form.followUp1Template}
                      onChange={(e) => setForm({ ...form, followUp1Template: e.target.value })}
                      placeholder="Just wanted to follow up on my previous message. I'm very excited about the {{jobTitle}} opportunity at {{companyName}}..."
                      className="font-mono text-xs leading-relaxed rounded-xl"
                    />
                  </FormField>
                </div>
              )}

              {/* 5. FU2 Subtab */}
              {activeTemplateSubTab === 'fu2' && (
                <div className="space-y-4">
                  <FormField
                    label="Global Follow-Up 2 Message Template"
                    helpText="Final gentle nudge sent if contact does not respond to FU1. Auto-replaces {{jobTitle}}, {{companyName}}, etc."
                  >
                    <Textarea
                      rows={6}
                      value={form.followUp2Template}
                      onChange={(e) => setForm({ ...form, followUp2Template: e.target.value })}
                      placeholder="One final quick follow-up regarding the {{jobTitle}} role at {{companyName}}..."
                      className="font-mono text-xs leading-relaxed rounded-xl"
                    />
                  </FormField>
                </div>
              )}
            </Card>
          </div>

          {/* Right: Live Preview Simulator (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="p-6 bg-white dark:bg-[#1C1917] border-[#E8E3DA] dark:border-stone-800 rounded-2xl shadow-xs space-y-4 sticky top-6">
              <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-stone-800 pb-3.5">
                <div className="flex items-center space-x-2">
                  <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Eye className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1C1917] dark:text-stone-100">Live Preview Simulator</h3>
                </div>

                <select
                  value={previewStage}
                  onChange={(e) => setPreviewStage(e.target.value as Stage)}
                  className="h-8 rounded-lg border border-[#E8E3DA] dark:border-stone-700 bg-[#FAF8F5] dark:bg-stone-800 px-2 text-xs font-bold text-stone-700 dark:text-stone-200 outline-none"
                >
                  <option value="OUTREACH">Outreach</option>
                  <option value="FU1">Follow-Up 1</option>
                  <option value="FU2">Follow-Up 2</option>
                </select>
              </div>

              {/* Sample Context Card */}
              <div className="p-2.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-800/40 border border-[#E8E3DA] dark:border-stone-800 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Sample Target:</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    Alex @ {sampleJob.companyName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-stone-400">Target Role:</span>
                  <span className="font-mono text-stone-700 dark:text-stone-300">{sampleJob.jobTitle}</span>
                </div>
              </div>

              {/* Warnings Banner: Duplicate Greeting */}
              {validationResult.hasDuplicateGreeting && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Warning: Duplicate Greeting Detected</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    Your message body starts with <code className="font-mono font-bold bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">"{validationResult.duplicateGreetingSnippet}"</code>, but RefLoop also prepends the greeting format <code className="font-mono font-bold bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">"{form.greetingFormat}"</code>. This causes the greeting to appear twice.
                  </p>
                </div>
              )}

              {/* Warnings Banner: Missing Contact First Name */}
              {validationResult.hasMissingName && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-700 text-xs text-rose-900 dark:text-rose-200 space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>Warning: Recipient Name Missing</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-800 dark:text-rose-300">
                    <code className="font-mono font-bold">{"{{firstName}}"}</code> is used, but recipient has no first name set.
                  </p>
                </div>
              )}

              {/* Warnings Banner: Unfilled Variables */}
              {validationResult.unfilledVariables.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Unfilled Variables in Template</span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Click a variable below to set its value:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {validationResult.unfilledVariables.map((uv: DetectedVariable) => (
                      <button
                        key={uv.name}
                        type="button"
                        onClick={() => {
                          setFillVarName(uv.name);
                          setFillVarValue('');
                        }}
                        className="px-2 py-1 rounded-md bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-mono text-[11px] font-bold hover:bg-amber-300 transition-colors flex items-center gap-1 shadow-2xs"
                      >
                        <span>{"{{" + uv.name + "}}"}</span>
                        <span className="text-[9px] px-1 bg-amber-300 dark:bg-amber-800 rounded font-sans">Fill</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Simulated Bubble */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center justify-between">
                  <span>Simulated LinkedIn Outreach</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{previewStage}</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#F4F0EA]/70 dark:bg-stone-800/60 border border-[#E8E3DA] dark:border-stone-700/80 text-xs text-stone-800 dark:text-stone-100 font-sans leading-relaxed whitespace-pre-wrap shadow-inner">
                  {assembledPreview.body || (
                    <span className="text-stone-400 italic">No template text written yet.</span>
                  )}
                </div>
              </div>

              {/* Variable Resolution Status Pill */}
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/30 border border-stone-200/80 dark:border-stone-800 text-[11px] text-stone-600 dark:text-stone-300 space-y-1">
                <div className="flex items-center space-x-2 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Template Variable Resolution:</span>
                </div>
                <p className="text-[10px] text-stone-500 dark:text-stone-400 pl-5">
                  <code className="font-mono text-[#D97757]">{"{{jobTitle}}"}</code> &rarr; "{sampleJob.jobTitle}", <code className="font-mono text-[#D97757]">{"{{companyName}}"}</code> &rarr; "{sampleJob.companyName}".
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}


      {/* ────────────────────────────────────────────────────────────────────────
          TAB 3: PRO MODE (GMAIL SYNC)
      ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'promode' && settings.proModeEnabled && (
        <div className="space-y-6 pt-2">
          <Card className="p-6 bg-gradient-to-br from-amber-50/60 to-orange-50/20 dark:from-amber-900/10 dark:to-stone-900 border-2 border-amber-200 dark:border-amber-800/60 rounded-2xl shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-200/80 dark:border-amber-800/60 pb-5">
              <div className="flex items-center space-x-3.5">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  ✨
                </div>
                <div>
                  <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <span>Pro Mode — Gmail Acceptance Detection</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-extrabold uppercase tracking-wide">
                      Pro
                    </span>
                  </h2>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Automatically detect when your LinkedIn connection requests are accepted via read-only Gmail headers.
                  </p>
                </div>
              </div>

              {/* Main Toggle Switch */}
              <button
                id="gmail-sync-toggle"
                type="button"
                onClick={() => void handleGmailSyncToggle(!settings.gmailSyncEnabled)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 shrink-0 ${
                  settings.gmailSyncEnabled ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                    settings.gmailSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {settings.gmailSyncEnabled ? (
              <div className="space-y-5">
                {/* Sync Interval */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/80 dark:bg-stone-800/60 border border-amber-200/80 dark:border-amber-800/40">
                  <div>
                    <label className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      Background Scan Interval
                    </label>
                    <p className="text-[11px] text-stone-500">
                      How frequently RefLoop checks for new LinkedIn connection notification emails.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={settings.gmailSyncIntervalHours}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(24, Number(e.target.value)));
                        void updateSettings({ gmailSyncIntervalHours: val });
                      }}
                      className="w-20 h-9 text-xs text-center rounded-xl font-bold"
                    />
                    <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                      hour{settings.gmailSyncIntervalHours !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Connection Status Card */}
                <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/80 p-5 space-y-4 shadow-2xs">
                  {gmailState?.connected ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-700/80 pb-3.5">
                        <div className="flex items-center space-x-2.5">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          <div>
                            <p className="text-xs font-bold text-stone-900 dark:text-stone-100">Gmail Connected &amp; Active</p>
                            <p className="text-[11px] text-stone-400">Scoped to <code className="font-mono">gmail.metadata</code></p>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-stone-500 bg-stone-100 dark:bg-stone-700/60 px-2.5 py-1 rounded-lg">
                          Last scanned: {formatLastSynced(gmailState.lastCheckedAt)}
                        </span>
                      </div>

                      {gmailState.lastSyncStatus === 'FAILED' && gmailState.lastSyncError && (
                        <div className="flex items-start space-x-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-700 dark:text-rose-300">
                          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                          <span>{gmailState.lastSyncError}</span>
                        </div>
                      )}

                      {syncError && (
                        <div className="flex items-start space-x-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-700 dark:text-rose-300">
                          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                          <span>{syncError}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <Button
                          id="gmail-sync-now-btn"
                          onClick={() => void handleSyncNow()}
                          variant="outline"
                          size="sm"
                          isLoading={syncing}
                          className="space-x-1.5 text-xs h-9 rounded-xl font-bold"
                        >
                          {!syncing && <RefreshCw className="h-3.5 w-3.5" />}
                          <span>Scan Now</span>
                        </Button>

                        <Button
                          id="gmail-reset-resync-btn"
                          onClick={() => void handleResetAndResync()}
                          variant="outline"
                          size="sm"
                          isLoading={resetting}
                          title="Clears the processed-messages cache and scans all emails from scratch — fixes contacts that were added after their acceptance email was seen"
                          className="space-x-1.5 text-xs h-9 rounded-xl font-bold text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                        >
                          {!resetting && <RefreshCw className="h-3.5 w-3.5" />}
                          <span>Reset &amp; Re-sync</span>
                        </Button>

                        <Button
                          id="gmail-disconnect-btn"
                          onClick={() => void handleDisconnect()}
                          variant="outline"
                          size="sm"
                          isLoading={disconnecting}
                          className="space-x-1.5 text-xs h-9 rounded-xl text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 font-bold"
                        >
                          {!disconnecting && <Unlink className="h-3.5 w-3.5" />}
                          <span>Disconnect Gmail</span>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-xl bg-stone-100 dark:bg-stone-700 flex items-center justify-center text-stone-400">
                          <Mail className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-900 dark:text-stone-100">Gmail Not Connected</p>
                          <p className="text-[11px] text-stone-400">Authorize read-only access to start automated acceptance scans.</p>
                        </div>
                      </div>
                      <Button
                        id="gmail-connect-btn"
                        onClick={() => setShowOnboarding(true)}
                        variant="primary"
                        size="sm"
                        className="text-xs h-9 bg-gradient-to-r from-[#E06D53] to-[#D97757] hover:opacity-95 text-white space-x-1.5 rounded-xl font-bold px-4"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        <span>Connect Gmail</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white/60 dark:bg-stone-800/40 border border-amber-200/60 dark:border-amber-800/40 text-xs text-stone-600 dark:text-stone-400 flex items-start space-x-3">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Enable the toggle above to connect your Gmail and automatically move contacts to <code>READY_TO_SEND</code> when connections are accepted.
                </span>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          TAB 4: DATA & BACKUP
      ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'data' && (
        <div className="space-y-6 pt-2">
          {/* Storage Stats Card */}
          <Card className="p-6 bg-white dark:bg-[#1C1917] border-[#E8E3DA] dark:border-stone-800 rounded-2xl shadow-xs space-y-5">
            <div className="flex items-center space-x-3 border-b border-[#E8E3DA] dark:border-stone-800 pb-4">
              <div className="h-9 w-9 rounded-xl bg-[#FDF4F0] dark:bg-[#3A221C] text-[#D97757] flex items-center justify-center font-bold">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1C1917] dark:text-stone-100">Local Storage &amp; Backup Management</h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Export complete data archives or restore from previously exported JSON backups.
                </p>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-800/50 border border-[#E8E3DA] dark:border-stone-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Active Job Postings</p>
                <p className="text-2xl font-extrabold text-[#1C1917] dark:text-stone-100 mt-1">
                  {jobs.filter((j) => j.status === 'ACTIVE').length}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-800/50 border border-[#E8E3DA] dark:border-stone-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Total Contacts Tracked</p>
                <p className="text-2xl font-extrabold text-[#1C1917] dark:text-stone-100 mt-1">
                  {contacts.length}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-800/50 border border-[#E8E3DA] dark:border-stone-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Storage Engine</p>
                <p className="text-sm font-bold text-[#D97757] dark:text-[#E06D53] mt-2 font-mono">
                  chrome.storage.local
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                onClick={() => void handleExport()}
                variant="primary"
                disabled={exporting}
                className="space-x-2 bg-gradient-to-r from-[#E06D53] to-[#D97757] hover:opacity-95 text-white text-xs font-bold rounded-xl h-10 px-5"
              >
                <Download className="h-4 w-4" />
                <span>{exporting ? 'Exporting…' : 'Export Backup (.json)'}</span>
              </Button>

              <label className="inline-flex items-center justify-center rounded-xl text-xs font-bold transition-colors border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700/80 text-stone-700 dark:text-stone-200 h-10 px-5 cursor-pointer shadow-xs">
                <Upload className="h-4 w-4 mr-2 text-stone-400" />
                <span>{importing ? 'Importing…' : 'Import Backup (.json)'}</span>
                <input type="file" accept=".json" onChange={(e) => void handleFileChange(e)} className="hidden" />
              </label>
            </div>

            {/* Privacy Disclaimer */}
            <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400 flex items-start space-x-2.5">
              <Shield className="h-4 w-4 text-stone-400 shrink-0 mt-0.5" />
              <span>
                RefLoop stores 100% of your data locally in your browser sandbox. Exporting backups lets you easily transfer your tracked pipeline across browsers or computers.
              </span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
