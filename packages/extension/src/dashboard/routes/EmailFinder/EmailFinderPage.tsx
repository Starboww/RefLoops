import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Copy,
  Check,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Globe,
} from 'lucide-react';
import { Button, Input, Card, FormField } from '@refloop/ui';
import { EmailPatternService, type RankedCandidate, type EmailTier } from '@refloop/core';
import { useJobsStore } from '../../store';
import { addEmailContact } from '../../services/appService';

const VERIFICATION_SERVICES = [
  {
    id: 'mailmeteor',
    name: 'Mailmeteor Email Checker',
    url: 'https://mailmeteor.com/email-checker',
    description: 'Free instant verification for MX records, format, and deliverability.',
    badge: 'Recommended',
    recommended: true,
  },
  {
    id: 'verifalia',
    name: 'Verifalia Validator',
    url: 'https://verifalia.com/validate-email',
    description: 'Deep mailbox-level syntax and MX verification engine.',
    badge: 'Deep Verification',
  },
  {
    id: 'hunter',
    name: 'Hunter.io Verifier',
    url: 'https://hunter.io/email-verifier',
    description: 'Professional deliverability score and domain confidence check.',
    badge: 'Popular',
  },
];

export function EmailFinderPage() {
  const { jobs } = useJobsStore();
  const activeJobs = jobs.filter((j) => j.status === 'ACTIVE');

  // Main Tab State
  const [activeTab, setActiveTab] = useState<'finder' | 'checker'>('finder');

  // Email Finder State
  const [fullName, setFullName] = useState('');
  const [domain, setDomain] = useState('');
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [candidates, setCandidates] = useState<RankedCandidate[]>([]);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [showAdvancedInference, setShowAdvancedInference] = useState(false);

  // Email Checker State
  const [emailToCheck, setEmailToCheck] = useState('');
  const [selectedVerifierId, setSelectedVerifierId] = useState('mailmeteor');
  const [customVerifierUrl, setCustomVerifierUrl] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const emailService = new EmailPatternService();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fullName.trim() || !domain.trim()) return;

    const nameParts = emailService.parseDisplayName(fullName);
    const cleanDomain = domain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || domain;
    const results = emailService.generateCandidates(nameParts, cleanDomain, confirmedEmail.trim() || undefined);
    setCandidates(results);
    showToast(`Generated ${results.length} candidate email patterns! ✨`);
  };

  const handleCopy = (email: string) => {
    void navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    showToast(`Copied ${email} to clipboard! 📋`);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleCopyAll = (tierFilter?: EmailTier) => {
    const list = tierFilter ? candidates.filter((c) => c.tier === tierFilter) : candidates;
    const text = list.map((c) => c.email).join('\n');
    void navigator.clipboard.writeText(text);
    showToast(`Copied ${list.length} email addresses to clipboard! 📋`);
  };

  const handleAddCandidateToJob = async (email: string) => {
    if (!selectedJobId) {
      alert('Please select a target job posting first!');
      return;
    }
    const firstName = emailService.parseFirstName(fullName);
    await addEmailContact({
      jobPostingId: selectedJobId,
      firstName: firstName || 'Contact',
      emailAddress: email,
      emailSource: 'GENERATED',
    });
    showToast(`Added ${email} to target job! 🚀`);
  };

  const handleVerifyInChecker = (email: string) => {
    void navigator.clipboard.writeText(email);
    setEmailToCheck(email);
    setActiveTab('checker');
    showToast(`Copied ${email} and switched to Email Checker! 🛡️`);
  };

  const handleOpenVerifier = (serviceUrl: string, email: string) => {
    if (email) {
      void navigator.clipboard.writeText(email);
    }
    window.open(serviceUrl, '_blank', 'noopener,noreferrer');
    showToast('Copied email to clipboard and opened verifier! ↗');
  };

  const selectedVerifier =
    selectedVerifierId === 'custom'
      ? {
          id: 'custom',
          name: 'Custom Email Verifier',
          url: customVerifierUrl || 'https://mailmeteor.com/email-checker',
          description: 'Your custom configured verification service URL.',
        }
      : VERIFICATION_SERVICES.find((s) => s.id === selectedVerifierId) || VERIFICATION_SERVICES[0]!;

  // Group candidates by tier
  const tier1Candidates = candidates.filter((c) => c.tier === 1);
  const tier2Candidates = candidates.filter((c) => c.tier === 2);
  const tier3Candidates = candidates.filter((c) => c.tier === 3 || c.tier === 'middle');

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 bg-[#1C1917] text-white px-4 py-3 rounded-xl shadow-2xl border border-stone-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Hero Presentation Header (Clean SaaS Look) */}
      <div className="text-center space-y-3 pt-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#FDF4F0] dark:bg-[#3A221C] border border-[#F7D5C8] dark:border-[#5A3228] text-xs font-extrabold uppercase tracking-wider text-[#D97757] dark:text-[#E06D53]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Email Finder &amp; Validator</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-[#1C1917] dark:text-stone-100 tracking-tight">
          Find work email addresses of anyone in seconds
        </h1>

        <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 max-w-xl mx-auto leading-relaxed">
          Generate high-confidence candidate work emails from any name &amp; company domain, or verify addresses on trusted deliverability engines.
        </p>
      </div>

      {/* Primary Tabbed Card Container */}
      <div className="bg-white dark:bg-[#1C1917] border border-[#E8E3DA] dark:border-stone-800 rounded-3xl shadow-sm overflow-hidden">
        {/* Navigation Tabs Bar */}
        <div className="grid grid-cols-2 border-b border-[#E8E3DA] dark:border-stone-800 bg-[#FAF8F5]/60 dark:bg-stone-900/40">
          <button
            onClick={() => setActiveTab('finder')}
            className={`py-4 text-xs sm:text-sm font-bold transition-all flex items-center justify-center space-x-2 border-b-2 ${
              activeTab === 'finder'
                ? 'border-[#D97757] text-[#D97757] dark:text-[#E06D53] bg-white dark:bg-[#1C1917]'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Search className="h-4 w-4" />
            <span className="tracking-wide">EMAIL FINDER</span>
          </button>

          <button
            onClick={() => setActiveTab('checker')}
            className={`py-4 text-xs sm:text-sm font-bold transition-all flex items-center justify-center space-x-2 border-b-2 ${
              activeTab === 'checker'
                ? 'border-[#D97757] text-[#D97757] dark:text-[#E06D53] bg-white dark:bg-[#1C1917]'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="tracking-wide">EMAIL CHECKER</span>
          </button>
        </div>

        {/* Tab 1: Email Finder Form */}
        {activeTab === 'finder' && (
          <div className="p-6 sm:p-8 space-y-6">
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="flex flex-col md:flex-row items-stretch gap-3">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Full name (e.g. Satya Nadella)"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-12 text-sm rounded-xl px-4 font-medium border-[#E8E3DA] dark:border-stone-700 bg-[#FAF8F5]/50 dark:bg-stone-800/50"
                    required
                  />
                </div>

                <div className="flex-1 relative">
                  <Input
                    placeholder="company.com (e.g. microsoft.com)"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="h-12 text-sm rounded-xl px-4 font-medium border-[#E8E3DA] dark:border-stone-700 bg-[#FAF8F5]/50 dark:bg-stone-800/50"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="h-12 px-6 rounded-xl bg-gradient-to-r from-[#E06D53] to-[#D97757] hover:opacity-95 text-white font-bold text-sm shadow-md shadow-[#D97757]/20 flex items-center justify-center space-x-2 shrink-0"
                >
                  <Search className="h-4 w-4" />
                  <span>FIND EMAIL</span>
                </Button>
              </div>

              {/* Secondary Options Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
                {/* Pre-fill with sample tester */}
                <div className="flex items-center space-x-1.5 text-stone-500 dark:text-stone-400">
                  <span>Try sample:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFullName('Satya Nadella');
                      setDomain('microsoft.com');
                      const results = emailService.generateCandidates({ first: 'Satya', last: 'Nadella' }, 'microsoft.com');
                      setCandidates(results);
                    }}
                    className="text-[#D97757] dark:text-[#E06D53] font-bold hover:underline"
                  >
                    Satya Nadella @ microsoft.com
                  </button>
                </div>

                {/* Target Job Picker */}
                {activeJobs.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-stone-400 font-medium">Auto-add to Job:</span>
                    <select
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(e.target.value)}
                      className="h-8 rounded-lg border border-[#E8E3DA] dark:border-stone-700 bg-[#FAF8F5] dark:bg-stone-800 px-2 text-xs font-semibold text-stone-700 dark:text-stone-200 outline-none max-w-[200px] truncate"
                    >
                      <option value="">-- None (Generate Only) --</option>
                      {activeJobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.companyName} — {j.jobTitle}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Advanced Gold Standard Option Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedInference(!showAdvancedInference)}
                  className="text-[11px] font-bold text-stone-500 hover:text-[#D97757] dark:hover:text-[#E06D53] transition-colors flex items-center gap-1"
                >
                  <span>{showAdvancedInference ? '− Hide' : '+ Show'} Exact Corporate Pattern Inference (Gold Standard)</span>
                </button>

                {showAdvancedInference && (
                  <div className="mt-2.5 p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-800/40 border border-[#E8E3DA] dark:border-stone-800 space-y-2">
                    <FormField
                      label="Confirmed Real Employee Email Example (Optional)"
                      helpText="If you already know one real employee's email at this company, paste it to reverse-engineer and prioritize the exact pattern."
                    >
                      <Input
                        placeholder="e.g. satya.nadella@microsoft.com"
                        value={confirmedEmail}
                        onChange={(e) => setConfirmedEmail(e.target.value)}
                        className="rounded-lg text-xs font-mono"
                      />
                    </FormField>
                  </div>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Email Checker & Verification */}
        {activeTab === 'checker' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#1C1917] dark:text-stone-100">Verify Email Deliverability</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Copy your generated email and run MX and deliverability checks on trusted validation platforms.
                </p>
              </div>

              {/* Verification Input Box */}
              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Enter email address to verify (e.g. satya.nadella@microsoft.com)"
                    value={emailToCheck}
                    onChange={(e) => setEmailToCheck(e.target.value)}
                    className="h-12 text-sm rounded-xl px-4 font-mono font-medium border-[#E8E3DA] dark:border-stone-700 bg-[#FAF8F5]/50 dark:bg-stone-800/50"
                  />
                </div>

                <Button
                  onClick={() => handleOpenVerifier(selectedVerifier.url, emailToCheck)}
                  variant="primary"
                  className="h-12 px-6 rounded-xl bg-gradient-to-r from-[#E06D53] to-[#D97757] hover:opacity-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-[#D97757]/20 flex items-center justify-center space-x-2 shrink-0"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy &amp; Open Checker ↗</span>
                </Button>
              </div>

              {/* Verifier Services Grid */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                  Select Verification Engine:
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {VERIFICATION_SERVICES.map((service) => {
                    const isSelected = selectedVerifierId === service.id;
                    return (
                      <div
                        key={service.id}
                        onClick={() => setSelectedVerifierId(service.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                          isSelected
                            ? 'border-[#D97757] bg-[#FDF4F0]/60 dark:bg-[#3A221C]/30 shadow-xs'
                            : 'border-[#E8E3DA] dark:border-stone-800 bg-[#FAF8F5]/50 dark:bg-stone-900/50 hover:border-stone-300 dark:hover:border-stone-700'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[#1C1917] dark:text-stone-100">
                              {service.name}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              service.recommended
                                ? 'bg-[#D97757] text-white'
                                : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                            }`}>
                              {service.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-normal">
                            {service.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[#E8E3DA]/80 dark:border-stone-800">
                          <span className="text-[11px] font-semibold text-[#D97757] dark:text-[#E06D53] flex items-center gap-1">
                            <span>Open Tool</span>
                            <ExternalLink className="h-3 w-3" />
                          </span>
                          <span className="text-[10px] text-stone-400">External</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Custom Verifier Option */}
                <div className="pt-2">
                  <div
                    onClick={() => setSelectedVerifierId('custom')}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      selectedVerifierId === 'custom'
                        ? 'border-[#D97757] bg-[#FDF4F0]/60 dark:bg-[#3A221C]/30'
                        : 'border-[#E8E3DA] dark:border-stone-800 bg-[#FAF8F5]/50 dark:bg-stone-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#1C1917] dark:text-stone-100 flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-[#D97757]" />
                        Use Custom Validator Tool URL
                      </span>
                      {selectedVerifierId === 'custom' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D97757] text-white font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <Input
                      placeholder="e.g. https://your-preferred-email-checker.com"
                      value={customVerifierUrl}
                      onChange={(e) => {
                        setCustomVerifierUrl(e.target.value);
                        setSelectedVerifierId('custom');
                      }}
                      className="rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          RESULTS SECTION: RANKED CANDIDATE CARDS (When generated)
      ──────────────────────────────────────────────────────────────────────── */}
      {candidates.length > 0 && activeTab === 'finder' && (
        <div className="space-y-6">
          {/* Results Summary Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2">
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1C1917] dark:text-stone-100">
                  {candidates.length} Ranked Candidates for {fullName}
                </h2>
                <p className="text-xs text-stone-500">Domain: {domain}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                onClick={() => handleCopyAll(1)}
                variant="outline"
                size="sm"
                className="text-xs font-bold space-x-1 rounded-xl"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Top Tier 1</span>
              </Button>

              <Button
                onClick={() => handleCopyAll()}
                variant="outline"
                size="sm"
                className="text-xs font-bold space-x-1 rounded-xl"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Copy All ({candidates.length})</span>
              </Button>
            </div>
          </div>

          {/* Group 1: Tier 1 Candidates (High Probability) */}
          {tier1Candidates.length > 0 && (
            <Card className="p-6 bg-white dark:bg-[#1C1917] border-[#E8E3DA] dark:border-stone-800 rounded-2xl shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-stone-800 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Tier 1 — High Probability Patterns
                  </h3>
                </div>
                <span className="text-xs font-bold text-stone-400">{tier1Candidates.length} matches</span>
              </div>

              <div className="space-y-2">
                {tier1Candidates.map((c) => (
                  <CandidateRow
                    key={c.email}
                    candidate={c}
                    isCopied={copiedEmail === c.email}
                    selectedJobId={selectedJobId}
                    onCopy={() => handleCopy(c.email)}
                    onVerify={() => handleVerifyInChecker(c.email)}
                    onAddToJob={() => void handleAddCandidateToJob(c.email)}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Group 2: Tier 2 Candidates (Common Variations) */}
          {tier2Candidates.length > 0 && (
            <Card className="p-6 bg-white dark:bg-[#1C1917] border-[#E8E3DA] dark:border-stone-800 rounded-2xl shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-stone-800 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    Tier 2 — Common Secondary Patterns
                  </h3>
                </div>
                <span className="text-xs font-bold text-stone-400">{tier2Candidates.length} matches</span>
              </div>

              <div className="space-y-2">
                {tier2Candidates.map((c) => (
                  <CandidateRow
                    key={c.email}
                    candidate={c}
                    isCopied={copiedEmail === c.email}
                    selectedJobId={selectedJobId}
                    onCopy={() => handleCopy(c.email)}
                    onVerify={() => handleVerifyInChecker(c.email)}
                    onAddToJob={() => void handleAddCandidateToJob(c.email)}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Group 3: Tier 3 & Fallback */}
          {tier3Candidates.length > 0 && (
            <Card className="p-6 bg-white dark:bg-[#1C1917] border-[#E8E3DA] dark:border-stone-800 rounded-2xl shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-stone-800 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="h-2 w-2 rounded-full bg-stone-400" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    Tier 3 — Fallback &amp; Middle-Initial Patterns
                  </h3>
                </div>
                <span className="text-xs font-bold text-stone-400">{tier3Candidates.length} matches</span>
              </div>

              <div className="space-y-2">
                {tier3Candidates.map((c) => (
                  <CandidateRow
                    key={c.email}
                    candidate={c}
                    isCopied={copiedEmail === c.email}
                    selectedJobId={selectedJobId}
                    onCopy={() => handleCopy(c.email)}
                    onVerify={() => handleVerifyInChecker(c.email)}
                    onAddToJob={() => void handleAddCandidateToJob(c.email)}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

interface CandidateRowProps {
  candidate: RankedCandidate;
  isCopied: boolean;
  selectedJobId: string;
  onCopy: () => void;
  onVerify: () => void;
  onAddToJob: () => void;
}

function CandidateRow({
  candidate,
  isCopied,
  selectedJobId,
  onCopy,
  onVerify,
  onAddToJob,
}: CandidateRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-[#E8E3DA] dark:border-stone-800/80 bg-[#FAF8F5]/60 dark:bg-stone-900/40 hover:bg-white dark:hover:bg-stone-800 transition-all gap-3">
      {/* Left: Email & Tag */}
      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
        <span className="font-mono text-sm font-bold text-[#1C1917] dark:text-stone-100 truncate">
          {candidate.email}
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
          {candidate.pattern}
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* Copy Button */}
        <Button
          onClick={onCopy}
          variant="outline"
          size="sm"
          className="text-xs font-bold space-x-1 rounded-lg h-8 px-2.5"
          title="Copy email to clipboard"
        >
          {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-stone-400" />}
          <span>{isCopied ? 'Copied' : 'Copy'}</span>
        </Button>

        {/* Verify Button */}
        <Button
          onClick={onVerify}
          variant="outline"
          size="sm"
          className="text-xs font-bold space-x-1 rounded-lg h-8 px-2.5 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
          title="Verify email deliverability"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Verify</span>
        </Button>

        {/* Add to Job Button */}
        {selectedJobId && (
          <Button
            onClick={onAddToJob}
            variant="primary"
            size="sm"
            className="text-xs font-bold space-x-1 rounded-lg h-8 px-3 bg-gradient-to-r from-[#E06D53] to-[#D97757] text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add to Job</span>
          </Button>
        )}
      </div>
    </div>
  );
}
