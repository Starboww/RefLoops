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

            // --- LinkedIn Jobs search/detail pane: read DOM via content script ---
            // The jobs search page is a split-pane SPA: clicking a card only changes
            // ?currentJobId= in the URL. The tab title never reflects the specific job.
            // We query the content script to scrape the right-panel detail DOM instead.
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
                  // Fallback: use tab title if content script couldn't read the DOM
                  if (tab.title) {
                    const cleanedTitle = tab.title.split('|')[0]?.split('-')[0]?.trim() ?? tab.title;
                    setJobTitle(cleanedTitle);
                  }
                }
              } catch {
                // Content script not ready (e.g., restricted page) — fall back to tab title
                if (tab.title) {
                  const cleanedTitle = tab.title.split('|')[0]?.split('-')[0]?.trim() ?? tab.title;
                  setJobTitle(cleanedTitle);
                }
              }
            } else {
              // Non-LinkedIn job page or no specific job selected yet
              if (tab.title) {
                const cleanedTitle = tab.title.split('|')[0]?.split('-')[0]?.trim() ?? tab.title;
                setJobTitle(cleanedTitle);
              }
            }
          } else {
            setPageType('OTHER');
            if (!isInternal) {
              setJobLink(url);
              if (tab.title) {
                setJobTitle(tab.title.split('|')[0]?.split('-')[0]?.trim() ?? '');
              }
            } else {
              setJobLink('');
              setJobTitle('');
            }
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openDashboard = () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
  };

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !jobTitle) return;

    await chrome.runtime.sendMessage({
      type: 'ADD_JOB_REQUEST',
      payload: {
        companyName,
        jobTitle,
        jobLink: jobLink || window.location.href,
        sourceType: 'COMPANY_SITE',
      },
    });

    setSuccessMsg('Job Added to RefLoop!');
    setAddedSuccess(true);
    setTimeout(() => {
      openDashboard();
    }, 900);
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !personFirstName || !personProfileUrl) return;

    await chrome.runtime.sendMessage({
      type: 'ADD_LINKEDIN_CONTACT_REQUEST',
      payload: {
        jobPostingId: selectedJobId,
        firstName: personFirstName,
        linkedinProfileUrl: personProfileUrl,
        fullNameRaw: personName,
      },
    });

    setSuccessMsg(`Added ${personFirstName} to RefLoop!`);
    setAddedSuccess(true);
    setTimeout(() => {
      openDashboard();
    }, 900);
  };

  if (loading) {
    return (
      <div className="w-[360px] p-8 text-center text-xs text-stone-400 bg-[#18181B]">
        Loading RefLoop...
      </div>
    );
  }

  return (
    <div className="w-[360px] p-4 bg-[#18181B] text-stone-100 space-y-4 font-sans select-none border border-stone-800 shadow-2xl rounded-b-2xl dark">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#E06D53] to-[#D97757] flex items-center justify-center text-white shadow-sm font-bold text-sm">
            ⚡
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-stone-100 block leading-tight">RefLoop</span>
            <span className="text-[10px] font-semibold text-[#E06D53] block">Referral Tracker</span>
          </div>
        </div>

        <button
          onClick={openDashboard}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#E06D53] bg-stone-800 hover:bg-stone-700 transition-colors flex items-center space-x-1 border border-stone-700"
        >
          <span>Dashboard</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {!user ? (
        <div className="text-center py-6 px-2 space-y-3 bg-[#27272A] rounded-2xl border border-stone-800 p-4 shadow-xs">
          <Sparkles className="h-8 w-8 text-[#E06D53] mx-auto" />
          <p className="text-xs font-semibold text-stone-100">Welcome to RefLoop!</p>
          <p className="text-[11px] text-stone-400">Sign in on the dashboard to track job postings & outreach requests.</p>
          <Button onClick={openDashboard} variant="primary" size="sm" className="w-full bg-[#D97757] hover:bg-[#C86545] text-white">
            Open Dashboard to Sign In
          </Button>
        </div>
      ) : addedSuccess ? (
        <div className="text-center py-8 space-y-2 bg-[#27272A] rounded-2xl border border-stone-800 p-4 shadow-xs">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto animate-bounce" />
          <p className="text-sm font-bold text-stone-100">{successMsg}</p>
          <p className="text-[11px] text-stone-400">Opening RefLoop Dashboard...</p>
        </div>
      ) : pageType === 'PROFILE' ? (
        /* Person Profile Mode */
        <form onSubmit={(e) => void handleAddContact(e)} className="space-y-3.5">
          <div className="p-3 rounded-xl bg-[#27272A] border border-stone-800 shadow-xs flex items-center space-x-3">
            <div className="h-9 w-9 rounded-full bg-[#D97757] text-white flex items-center justify-center font-bold text-sm shrink-0">
              {personFirstName[0]?.toUpperCase() ?? 'C'}
            </div>
            <div className="truncate flex-1">
              <p className="text-xs font-bold text-stone-100 truncate">{personName}</p>
              <p className="text-[11px] font-medium text-stone-400">LinkedIn Profile</p>
            </div>
          </div>

          <FormField label="First Name">
            <Input
              value={personFirstName}
              onChange={(e) => setPersonFirstName(e.target.value)}
              placeholder="First Name"
              className="h-9 text-xs bg-stone-900 border-stone-700 text-stone-100 placeholder:text-stone-500 focus:border-[#D97757]"
            />
          </FormField>

          <FormField label="Target Job Posting">
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="flex h-9 w-full rounded-xl border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs text-stone-100 font-medium shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757]"
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
            className="w-full space-x-1.5 bg-[#D97757] hover:bg-[#C86545] text-white h-9 shadow-sm"
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
              className="h-9 text-xs bg-stone-900 border-stone-700 text-stone-100 placeholder:text-stone-500 focus:border-[#D97757]"
            />
          </FormField>

          <FormField label="Job Title">
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className="h-9 text-xs bg-stone-900 border-stone-700 text-stone-100 placeholder:text-stone-500 focus:border-[#D97757]"
            />
          </FormField>

          <FormField label="Job Posting URL (Optional)">
            <Input
              value={jobLink}
              onChange={(e) => setJobLink(e.target.value)}
              placeholder="https://linkedin.com/jobs/..."
              className="h-9 text-xs font-mono bg-stone-900 border-stone-700 text-stone-100 placeholder:text-stone-500 focus:border-[#D97757]"
            />
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="w-full space-x-1.5 bg-[#D97757] hover:bg-[#C86545] text-white h-9 shadow-sm"
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
