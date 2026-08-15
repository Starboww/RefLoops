// =============================================================================
// RefLoop — Gmail Onboarding Modal
// 3-step modal shown before Gmail OAuth is ever triggered:
//   Step 1: Permission disclosure (always shown)
//   Step 2: LinkedIn notification setup (shown only once)
//   Step 3: Connect Gmail CTA
// =============================================================================

import React, { useState } from 'react';
import {
  Shield,
  Bell,
  Mail,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  X,
} from 'lucide-react';
import { Button } from '@refloop/ui';
import { connectGmail } from '../../services/appService';
import { updateSettings } from '../../services/appService';
import { useSettingsStore } from '../../store';

interface GmailOnboardingModalProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function GmailOnboardingModal({ onSuccess, onCancel }: GmailOnboardingModalProps) {
  const { settings } = useSettingsStore();
  // Skip step 2 if the LinkedIn notification prompt has already been shown
  const skipStep2 = settings.gmailLinkedInNotificationPromptShown;
  const totalSteps = skipStep2 ? 2 : 3;

  const [step, setStep] = useState(1);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map visual step (1,2,3) to logical step skipping step 2 if needed
  const logicalStep = skipStep2 && step >= 2 ? step + 1 : step;
  // 1 = disclosure, 2 = LinkedIn notifications, 3 = connect

  const handleNext = async () => {
    if (logicalStep === 2) {
      // Mark LinkedIn notification prompt as shown
      await updateSettings({ gmailLinkedInNotificationPromptShown: true });
    }
    setStep((s) => s + 1);
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await connectGmail();
      await updateSettings({ gmailSyncEnabled: true });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-[#1C1917] rounded-2xl shadow-2xl border border-[#E8E3DA] dark:border-stone-800 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E8E3DA] dark:border-stone-800">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
              ✨
            </div>
            <div>
              <p className="text-sm font-bold text-stone-900 dark:text-stone-100">Pro Mode — Gmail Setup</p>
              <p className="text-[11px] text-stone-400">Step {step} of {totalSteps}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-stone-100 dark:bg-stone-800">
          <div
            className="h-1 bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Step content */}
        <div className="p-6">
          {/* ---------------------------------------------------------------- */}
          {/* Step 1: Permission Disclosure                                     */}
          {/* ---------------------------------------------------------------- */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">What RefLoop will access</h2>
                  <p className="text-[11px] text-stone-400">Read-only Gmail metadata — no email body</p>
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-2">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Permission requested</p>
                <code className="text-xs font-mono text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded-md block">
                  gmail.metadata
                </code>
                <p className="text-[11px] text-blue-600 dark:text-blue-400">This gives access to email headers only — not the email body.</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">We read from your Gmail:</p>
                {[
                  { label: 'Sender address', sub: 'To detect LinkedIn emails' },
                  { label: 'Email subject line', sub: 'To detect acceptance notifications' },
                  { label: 'Email date', sub: 'For ordering and deduplication' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start space-x-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-stone-800 dark:text-stone-200">{item.label}</p>
                      <p className="text-[11px] text-stone-400">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">We NEVER read or store:</p>
                {[
                  'Email body or content',
                  'Attachments',
                  'Recipients (To / CC / BCC)',
                  'Any non-LinkedIn emails (processed locally, not stored)',
                ].map((item) => (
                  <div key={item} className="flex items-center space-x-2.5">
                    <XCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                    <p className="text-xs text-stone-500 dark:text-stone-400">{item}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 p-3 text-[11px] text-stone-500 dark:text-stone-400">
                🔒 All data stays in <code className="font-mono text-stone-600 dark:text-stone-300">chrome.storage.local</code> on your device. Nothing is sent to any server.
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Step 2: LinkedIn Notification Setup (first time only)             */}
          {/* ---------------------------------------------------------------- */}
          {step === 2 && !skipStep2 && (
            <div className="space-y-5">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <Bell className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">Enable LinkedIn notifications</h2>
                  <p className="text-[11px] text-stone-400">Required so LinkedIn emails you when connections are accepted</p>
                </div>
              </div>

              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                For Gmail detection to work, LinkedIn must send you an email when someone accepts your connection request.
                Please verify this setting is turned on in your LinkedIn account.
              </p>

              <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Steps to enable:</p>
                {[
                  'Go to LinkedIn → Me → Settings & Privacy',
                  'Navigate to Communications → Email notifications',
                  'Find "Invitations and connections" section',
                  'Ensure "Accepted invitations" is turned ON ✓',
                ].map((step, i) => (
                  <div key={i} className="flex items-start space-x-2.5">
                    <span className="h-5 w-5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-200 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs text-stone-700 dark:text-stone-300">{step}</p>
                  </div>
                ))}
              </div>

              <a
                href="https://www.linkedin.com/mypreferences/d/email-notifications"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-2 w-full px-4 py-2.5 rounded-xl border border-[#0077B5] text-[#0077B5] dark:text-blue-400 dark:border-blue-500 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <span>Open LinkedIn Email Settings</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              <p className="text-[11px] text-stone-400 text-center">
                Already enabled? You can proceed — this prompt won't appear again.
              </p>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Step 3 (or Step 2 if step 2 was skipped): Connect Gmail           */}
          {/* ---------------------------------------------------------------- */}
          {(step === totalSteps) && (
            <div className="space-y-5">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">Connect your Gmail</h2>
                  <p className="text-[11px] text-stone-400">One-click Google authorization</p>
                </div>
              </div>

              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                RefLoop will request read-only access to Gmail message metadata (sender, subject, and date only).
                You'll see a standard Google permissions screen.
              </p>

              <div className="rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 p-4 space-y-2">
                <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">On the Google screen you'll see:</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  <span className="font-medium text-stone-700 dark:text-stone-300">RefLoop</span> wants to access your Google Account
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">✓ View your email message metadata such as labels and headers, but not the email body</p>
              </div>

              {error && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-3">
                  <p className="text-xs text-rose-700 dark:text-rose-300">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between px-6 pb-6 pt-2">
          <button
            onClick={step === 1 ? onCancel : () => setStep((s) => s - 1)}
            className="flex items-center space-x-1 text-xs font-medium text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors px-2 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>{step === 1 ? 'Cancel' : 'Back'}</span>
          </button>

          {step < totalSteps ? (
            <Button
              onClick={() => void handleNext()}
              variant="primary"
              size="sm"
              className="flex items-center space-x-1.5 bg-[#D97757] hover:bg-[#C86545] text-white"
            >
              <span>I understand — Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              onClick={() => void handleConnect()}
              variant="primary"
              size="sm"
              isLoading={connecting}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px] justify-center"
            >
              {!connecting && <Mail className="h-4 w-4" />}
              <span>{connecting ? 'Connecting…' : 'Connect Gmail'}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
