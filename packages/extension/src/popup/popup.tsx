import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ExternalLink, Plus, CheckCircle2, UserPlus, Sparkles } from 'lucide-react';
import { Button, Input, FormField } from '@refloop/ui';
import { createChromeRepositories } from '@refloop/storage-chrome';
import type { UserAccount, JobPosting } from '@refloop/core';
import '../dashboard/index.css';

function PopupApp() {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);

  // Active tab type detection
  const [pageType, setPageType] = useState<'PROFILE' | 'JOB' | 'OTHER'>('OTHER');
  const [personName, setPersonName] = useState('');
  const [personFirstName, setPersonFirstName] = useState('');
  const [personProfileUrl, setPersonProfileUrl] = useState('');

  // Jobs state for dropdown
  const [activeJobs, setActiveJobs] = useState<JobPosting[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');

  // Add Job Form state
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobLink, setJobLink] = useState('');
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('Added to RefLoop!');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const repos = await createChromeRepositories();
        const u = await repos.userAccount.get();
        setUser(u);

        const allJobs = await repos.jobs.getAll();
        const active = allJobs.filter((j) => j.status === 'ACTIVE');
        setActiveJobs(active);
        if (active.length > 0) {
          setSelectedJobId(active[0]!.id);
        }

        // Query current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          const url = tab.url;

          // Check if internal chrome page or newtab
          const isInternal = url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:');

          // Check if Person Profile (/in/)
          if (url.includes('linkedin.com/in/')) {
            setPageType('PROFILE');
            setPersonProfileUrl(url.split('?')[0]!);
            const rawTitle = tab.title?.split('|')[0]?.split('-')[0]?.trim() ?? 'Contact';
            setPersonName(rawTitle);
            const first = rawTitle.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '') ?? 'Contact';
            setPersonFirstName(first);
          } else if (!isInternal && (url.includes('linkedin.com/jobs') || url.includes('indeed.com') || url.includes('greenhouse.io') || url.includes('lever.co'))) {
            setPageType('JOB');
            setJobLink(url.split('?')[0]!);

            const tabUrl = new URL(url);
            const currentJobId = tabUrl.searchParams.get('currentJobId');

            if (tab.id && currentJobId && url.includes('linkedin.com/jobs')) {
              try {
                const response = await chrome.tabs.sendMessage(tab.id, {
                  type: 'GET_CURRENT_JOB_DETAILS',
                }) as { success: boolean; details: { jobTitle: string; companyName: string; jobLink: string } | null } | undefined;

                if (response?.success && response.details) {
                  setJobTitle(response.details.jobTitle);
                  setCompanyName(response.details.companyName);
                  setJobLink(response.details.jobLink);
                } else {
                  if (tab.title) {
                    const cleanedTitle = tab.title.split('|')[0]?.split('-')[0]?.trim() ?? tab.title;
                    setJobTitle(cleanedTitle);
                  }
                }
              } catch {
                if (tab.title) {
                  const cleanedTitle = tab.title.split('|')[0]?.split('-')[0]?.trim() ?? tab.title;
                  setJobTitle(cleanedTitle);
                }
              }
            } else {
              if (tab.title) {
                const cleanedTitle = tab.title.split('|')[0]?.split('-')[0]?.trim() ?? tab.title;
                setJobTitle(cleanedTitle);
              }
            }
          } else {
            setPageType('OTHER');
          }
        }
      } catch (err) {
        console.error('Popup init failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
  };

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !jobTitle) return;

    const res = await chrome.runtime.sendMessage({
      type: 'ADD_JOB_REQUEST',
      payload: {
        companyName,
        jobTitle,
        jobLink: jobLink || `https://manual-entry/${Date.now()}`,
        sourceType: 'COMPANY_SITE',
      },
    }) as { success?: boolean; error?: string } | undefined;

    if (!res?.success) {
      setErrorMessage(res?.error ?? 'Failed to add job');
      return;
    }

    setSuccessMsg(`Added ${jobTitle} at ${companyName}!`);
    setAddedSuccess(true);
    setTimeout(() => {
      openDashboard();
    }, 900);
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !personFirstName || !personProfileUrl) return;

    const res = await chrome.runtime.sendMessage({
      type: 'ADD_LINKEDIN_CONTACT_REQUEST',
      payload: {
        jobPostingId: selectedJobId,
        firstName: personFirstName,
        linkedinProfileUrl: personProfileUrl,
        fullNameRaw: personName,
      },
    }) as { success?: boolean; error?: string } | undefined;

    if (!res?.success) {
      setErrorMessage(res?.error ?? 'Failed to add contact');
      return;
    }

    setSuccessMsg(`Added ${personFirstName} to RefLoop!`);
    setAddedSuccess(true);
    setTimeout(() => {
      openDashboard();
    }, 900);
  };

  if (loading) {
    return (
      <div className="w-[370px] p-8 text-center text-xs text-[#8A919D] bg-[#1B1F24]">
        Loading RefLoop...
      </div>
    );
  }

  return (
    <div className="w-[370px] p-4 bg-[#1B1F24] text-white space-y-4 font-sans select-none border border-white/12 shadow-2xl rounded-b-2xl dark">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-r from-[#FF3C6B] to-[#FF2458] flex items-center justify-center text-white shadow-md font-bold text-sm border border-white/20">
            ⚡
          </div>
          <div>
            <span className="font-heading font-bold text-sm tracking-tight text-white block leading-tight">
              RefLoop
            </span>
            <span className="text-[10px] font-medium text-[#FF3C6B] block">Referral Pipeline</span>
          </div>
        </div>

        <button
          onClick={openDashboard}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#DFE4FC] bg-[#292E35] hover:bg-[#3E424C] hover:text-white transition-colors flex items-center space-x-1.5 border border-white/10 shadow-xs"
        >
          <span>Dashboard</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {!user ? (
        <div className="text-center py-6 px-3 space-y-3 bg-[#1F2228] rounded-xl border border-white/10 p-4 shadow-card">
          <Sparkles className="h-8 w-8 text-[#FF3C6B] mx-auto" />
          <p className="text-xs font-heading font-bold text-white">Welcome to RefLoop</p>
          <p className="text-[11px] text-[#C1C6CD]">
            Sign in on the dashboard to track job postings & outreach pipelines.
          </p>
          <Button onClick={openDashboard} variant="primary" size="sm" className="w-full">
            Open Dashboard to Sign In
          </Button>
        </div>
      ) : addedSuccess ? (
        <div className="text-center py-8 space-y-2 bg-[#1F2228] rounded-xl border border-white/10 p-4 shadow-card">
          <CheckCircle2 className="h-10 w-10 text-[#0BDFC5] mx-auto animate-bounce" />
          <p className="text-sm font-heading font-bold text-white">{successMsg}</p>
          <p className="text-[11px] text-[#C1C6CD]">Opening RefLoop Dashboard...</p>
        </div>
      ) : pageType === 'PROFILE' ? (
        /* Person Profile Mode */
        <form onSubmit={(e) => void handleAddContact(e)} className="space-y-3.5">
          <div className="p-3 rounded-xl bg-[#1F2228] border border-white/10 shadow-card flex items-center space-x-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-r from-[#FF3C6B] to-[#FF2458] text-white flex items-center justify-center font-bold text-sm shrink-0 border border-white/20">
              {personFirstName[0]?.toUpperCase() ?? 'C'}
            </div>
            <div className="truncate flex-1">
              <p className="text-xs font-bold text-white truncate">{personName}</p>
              <p className="text-[11px] font-medium text-[#0BDFC5]">LinkedIn Profile Detected</p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-[rgba(221,44,97,0.15)] border border-[rgba(221,44,97,0.30)] text-[11px] text-[#DD2C61]">
              ⚠️ {errorMessage}
            </div>
          )}

          <FormField label="First Name">
            <Input
              value={personFirstName}
              onChange={(e) => setPersonFirstName(e.target.value)}
              placeholder="First Name"
              className="h-9 text-xs"
            />
          </FormField>

          <FormField label="Target Job Posting">
            <select
              value={selectedJobId}
              onChange={(e) => {
                setSelectedJobId(e.target.value);
                setErrorMessage(null);
              }}
              className="flex h-9 w-full rounded-lg border border-white/12 bg-[#1F2228] px-3 py-1 text-xs text-white font-medium shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3C6B]"
            >
              {activeJobs.length === 0 ? (
                <option value="">No active jobs in RefLoop</option>
              ) : (
                activeJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.companyName} — {j.jobTitle}
                  </option>
                ))
              )}
            </select>
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="w-full space-x-1.5 h-9"
            disabled={activeJobs.length === 0}
          >
            <UserPlus className="h-4 w-4" />
            <span>Add {personFirstName} to RefLoop Job</span>
          </Button>
        </form>
      ) : (
        /* Job Posting / General Mode */
        <form onSubmit={(e) => void handleAddJob(e)} className="space-y-3.5">
          <FormField label="Company Name">
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Fujitsu, Google"
              className="h-9 text-xs"
            />
          </FormField>

          <FormField label="Job Title">
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className="h-9 text-xs"
            />
          </FormField>

          <FormField label="Job Posting URL (Optional)">
            <Input
              value={jobLink}
              onChange={(e) => setJobLink(e.target.value)}
              placeholder="https://linkedin.com/jobs/..."
              className="h-9 text-xs font-mono"
            />
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="w-full space-x-1.5 h-9"
            disabled={!companyName || !jobTitle}
          >
            <Plus className="h-4 w-4" />
            <span>Add Job Posting to RefLoop</span>
          </Button>
        </form>
      )}
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <PopupApp />
    </React.StrictMode>
  );
}
