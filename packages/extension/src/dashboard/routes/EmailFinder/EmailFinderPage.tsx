import React, { useState } from 'react';
import { Sparkles, Plus, Copy, Check } from 'lucide-react';
import { Button, Input, FormField, Card } from '@refloop/ui';
import { EmailPatternService, type RankedCandidate } from '@refloop/core';
import { useJobsStore } from '../../store';
import { addEmailContact } from '../../services/appService';

export function EmailFinderPage() {
  const { jobs } = useJobsStore();

  const [fullName, setFullName] = useState('');
  const [domain, setDomain] = useState('');
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [candidates, setCandidates] = useState<RankedCandidate[]>([]);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const emailService = new EmailPatternService();

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !domain) return;

    const nameParts = emailService.parseDisplayName(fullName);
    const results = emailService.generateCandidates(nameParts, domain, confirmedEmail || undefined);
    setCandidates(results);
  };

  const handleCopy = (email: string) => {
    void navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleAddCandidateToJob = async (email: string) => {
    if (!selectedJobId) {
      alert('Please select a target job posting first!');
      return;
    }
    const firstName = emailService.parseFirstName(fullName);
    await addEmailContact({
      jobPostingId: selectedJobId,
      firstName,
      emailAddress: email,
      emailSource: 'GENERATED',
    });
    alert(`Added ${email} to target job!`);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-2">
          <span>Email Pattern Generator</span>
          <Sparkles className="h-5 w-5 text-indigo-500" />
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Generate 3-tier ranked candidate email addresses from a contact's name and target company domain.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Full Name" required helpText="e.g. Jane Smith, MBA">
              <Input
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </FormField>

            <FormField label="Company Domain" required helpText="e.g. microsoft.com">
              <Input
                placeholder="microsoft.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Confirmed Real Email Example (Optional Gold Standard)" helpText="If you know one real employee email at this company, paste it here to infer exact pattern">
            <Input
              placeholder="e.g. satya.nadella@microsoft.com"
              value={confirmedEmail}
              onChange={(e) => setConfirmedEmail(e.target.value)}
            />
          </FormField>

          <FormField label="Target Job Posting (to add selected candidate directly)">
            <select
              className="flex h-9 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-stone-700 dark:bg-stone-900"
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
            >
              <option value="">-- Select Target Job --</option>
              {jobs
                .filter((j) => j.status === 'ACTIVE')
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.companyName} — {j.jobTitle}
                  </option>
                ))}
            </select>
          </FormField>

          <Button type="submit" variant="primary" className="space-x-2">
            <Sparkles className="h-4 w-4" />
            <span>Generate Candidates</span>
          </Button>
        </form>
      </Card>

      {candidates.length > 0 && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
            Ranked Email Candidates ({candidates.length})
          </h2>
          <div className="space-y-2">
            {candidates.map((candidate) => (
              <div
                key={candidate.email}
                className="flex items-center justify-between p-3 rounded-lg border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-sm font-semibold text-stone-900 dark:text-stone-100">
                    {candidate.email}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600">
                    Tier {candidate.tier} ({candidate.pattern})
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => handleCopy(candidate.email)}
                    variant="ghost"
                    size="sm"
                    className="space-x-1"
                  >
                    {copiedEmail === candidate.email ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedEmail === candidate.email ? 'Copied' : 'Copy'}</span>
                  </Button>

                  {selectedJobId && (
                    <Button
                      onClick={() => void handleAddCandidateToJob(candidate.email)}
                      variant="primary"
                      size="sm"
                      className="space-x-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add to Job</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
