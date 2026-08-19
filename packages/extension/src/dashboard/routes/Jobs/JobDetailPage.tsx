import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Plus,
  Send,
  Mail,
  Linkedin,
  Award,
  Archive,
  Trash2,
  MessageSquare,
  Users,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Copy,
  Check,
  Eye,
  Sparkles,
  Info,
  Calendar,
  Building2,
  RotateCcw,
} from 'lucide-react';
import {
  Button,
  StatusPill,
  Card,
  Input,
  Textarea,
  FormField,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  ConfirmDialog,
  EmptyState,
} from '@refloop/ui';
import { useJobsStore, useContactsStore, useSettingsStore } from '../../store';
import {
  updateJob,
  deleteJob,
  archiveJob,
  markReferralReceived,
  addLinkedInContact,
  addEmailContact,
  sendMessage,
  deleteContact,
  updateSettings,
  markConnectionAccepted,
  revertContactStage,
} from '../../services/appService';
import {
  MessageAssemblyService,
  validateMessageTemplate,
  isDuplicateContact,
  type DetectedVariable,
  type JobPosting,
  type Stage,
  type GlobalSettings,
} from '@refloop/core';

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const { jobs } = useJobsStore();
  const { contacts } = useContactsStore();
  const { settings } = useSettingsStore();

  const job = jobs.find((j) => j.id === jobId);
  const jobContacts = contacts.filter((c) => c.jobPostingId === jobId);

  const [activeTab, setActiveTab] = useState<'contacts' | 'messages'>('contacts');
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteContactTargetId, setDeleteContactTargetId] = useState<string | null>(null);
  const [isReferralConfirmOpen, setIsReferralConfirmOpen] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Template editing state
  const [referralTemplate, setReferralTemplate] = useState(job?.referralMessageTemplate ?? '');
  const [emailTemplate, setEmailTemplate] = useState(job?.emailMessageTemplate ?? '');
  const [fu1Override, setFu1Override] = useState(job?.followUp1TemplateOverride ?? '');
  const [fu2Override, setFu2Override] = useState(job?.followUp2TemplateOverride ?? '');
  const [activeTemplateSubTab, setActiveTemplateSubTab] = useState<'referral' | 'fu1' | 'fu2'>('referral');
  const [previewStage, setPreviewStage] = useState<Stage>('OUTREACH');
  const [previewContactId, setPreviewContactId] = useState<string>('');
  const [savingTemplates, setSavingTemplates] = useState(false);

  // Quick fill variable state
  const [fillVarName, setFillVarName] = useState<string | null>(null);
  const [fillVarValue, setFillVarValue] = useState('');

  // New contact form state
  const [contactChannel, setContactChannel] = useState<'LINKEDIN' | 'EMAIL'>('LINKEDIN');
  const [firstName, setFirstName] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [emailAddr, setEmailAddr] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);
  const [addingContact, setAddingContact] = useState(false);

  const assembler = useMemo(() => new MessageAssemblyService(), []);

  if (!job) {
    return (
      <div className="text-center py-16">
        <EmptyState
          icon={Building2}
          title="Job Posting Not Found"
          description="The job posting you are trying to view does not exist or has been removed."
          actionLabel="Back to All Jobs"
          onAction={() => navigate('/jobs')}
        />
      </div>
    );
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyVar = (variableTag: string) => {
    void navigator.clipboard.writeText(variableTag);
    setCopiedVar(variableTag);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  const handleSaveFilledVariable = async (varName: string, val: string) => {
    const norm = varName.toLowerCase().trim();
    let patch: Partial<GlobalSettings> = {};
    if (norm === 'mycurrenttitle') {
      patch = { myCurrentTitle: val };
    } else if (norm === 'yearsofexperience' || norm === 'yearofexperience') {
      patch = { yearsOfExperience: val };
    } else {
      patch = {
        customVariables: {
          ...(settings.customVariables || {}),
          [varName]: val,
        },
      };
    }
    await updateSettings(patch);
    setFillVarName(null);
    setFillVarValue('');
    showToast(`Updated value for {{${varName}}}! ✨`);
  };

  const handleSaveTemplates = async () => {
    try {
      setSavingTemplates(true);
      const patch: Partial<JobPosting> = {
        referralMessageTemplate: referralTemplate,
        emailMessageTemplate: emailTemplate || undefined,
        followUp1TemplateOverride: fu1Override || undefined,
        followUp2TemplateOverride: fu2Override || undefined,
      };

      await updateJob(job.id, patch);
      showToast('Templates saved successfully! ✨');
    } finally {
      setSavingTemplates(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);

    // Client-side duplicate check
    if (
      isDuplicateContact(jobContacts, {
        jobPostingId: job.id,
        channel: contactChannel,
        linkedinProfileUrl: contactChannel === 'LINKEDIN' ? linkedinUrl : undefined,
        emailAddress: contactChannel === 'EMAIL' ? emailAddr : undefined,
      })
    ) {
      const msg =
        contactChannel === 'LINKEDIN'
          ? 'This LinkedIn profile is already added to this job posting.'
          : 'This email address is already added to this job posting.';
      setContactError(msg);
      return;
    }

    try {
      setAddingContact(true);
      if (contactChannel === 'LINKEDIN') {
        await addLinkedInContact({
          jobPostingId: job.id,
          firstName,
          linkedinProfileUrl: linkedinUrl,
        });
      } else {
        await addEmailContact({
          jobPostingId: job.id,
          firstName,
          emailAddress: emailAddr,
          emailSource: 'MANUAL',
        });
      }
      setIsAddContactOpen(false);
      setFirstName('');
      setLinkedinUrl('');
      setEmailAddr('');
      setContactError(null);
      showToast('Contact added successfully!');
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setAddingContact(false);
    }
  };

  // Preview contact logic
  const selectedContact = jobContacts.find((c) => c.id === previewContactId) || jobContacts[0];
  const sampleContact = selectedContact || {
    id: 'sample-1',
    jobPostingId: job.id,
    channel: 'LINKEDIN',
    firstName: 'Alex',
    outreachMessageStatus: 'READY_TO_SEND',
    followUp1Status: 'NOT_SCHEDULED',
    followUp2Status: 'NOT_SCHEDULED',
    connectionStatus: 'ACCEPTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Dynamic preview assembled message with unsaved or saved template
  const previewJob: JobPosting = {
    ...job,
    referralMessageTemplate: referralTemplate,
    emailMessageTemplate: emailTemplate || undefined,
    followUp1TemplateOverride: fu1Override || undefined,
    followUp2TemplateOverride: fu2Override || undefined,
  };

  const assembledPreview = assembler.assemble(
    previewStage,
    previewJob,
    sampleContact,
    settings
  );

  const activeTemplateBody = useMemo(() => {
    if (activeTemplateSubTab === 'referral') {
      return sampleContact.channel === 'EMAIL' && emailTemplate ? emailTemplate : referralTemplate;
    }
    if (activeTemplateSubTab === 'fu1') {
      return fu1Override || settings.followUp1Template;
    }
    return fu2Override || settings.followUp2Template;
  }, [
    activeTemplateSubTab,
    sampleContact.channel,
    emailTemplate,
    referralTemplate,
    fu1Override,
    fu2Override,
    settings.followUp1Template,
    settings.followUp2Template,
  ]);

  const validationResult = useMemo(() => {
    return validateMessageTemplate(
      activeTemplateBody,
      settings.greetingFormat,
      { job: previewJob, contact: sampleContact, settings },
    );
  }, [activeTemplateBody, settings.greetingFormat, previewJob, sampleContact, settings]);

  const readyContactsCount = jobContacts.filter(
    (c) =>
      c.outreachMessageStatus === 'READY_TO_SEND' ||
      c.followUp1Status === 'READY_TO_SEND' ||
      c.followUp2Status === 'READY_TO_SEND'
  ).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 bg-[#1C1917] text-white px-4 py-3 rounded-xl shadow-2xl border border-stone-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb / Back Action */}
      <div>
        <button
          onClick={() => navigate('/jobs')}
          className="inline-flex items-center space-x-2 text-xs font-bold text-stone-500 dark:text-stone-400 hover:text-[#D97757] dark:hover:text-[#E06D53] transition-colors py-1 mb-3 group"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Jobs</span>
        </button>

        {/* Hero Header Card */}
        <div className="bg-white dark:bg-[#1C1917] border border-[#E8E3DA] dark:border-stone-800 p-6 sm:p-7 rounded-2xl shadow-xs transition-all">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <StatusPill status={job.status} />
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-[#F4F0EA] dark:bg-stone-800 font-bold text-[#1C1917] dark:text-stone-300 border border-[#E8E3DA] dark:border-stone-700">
                  {job.companyName}
                </span>
                {readyContactsCount > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {readyContactsCount} ready to send
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C1917] dark:text-stone-100 tracking-tight truncate">
                {job.jobTitle}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[#78716C] dark:text-stone-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-stone-400" />
                  Added {new Date(job.dateAdded).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="text-stone-300 dark:text-stone-700">•</span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-stone-400" />
                  {jobContacts.length} {jobContacts.length === 1 ? 'Contact' : 'Contacts'}
                </span>
                {job.jobLink && (
                  <>
                    <span className="text-stone-300 dark:text-stone-700">•</span>
                    <a
                      href={job.jobLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#D97757] dark:text-[#E06D53] hover:underline font-semibold"
                    >
                      <span>Job Posting Link</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Structured Action Bar */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#E8E3DA] dark:border-stone-800/80">
              {job.status === 'ACTIVE' && (
                <Button
                  onClick={() => setIsReferralConfirmOpen(true)}
                  variant="outline"
                  className="space-x-1.5 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-xs font-bold"
                >
                  <Award className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Referral Received! 🎉</span>
                </Button>
              )}

              <Button
                onClick={() => setIsAddContactOpen(true)}
                variant="primary"
                className="space-x-1.5 bg-gradient-to-r from-[#E06D53] to-[#D97757] hover:opacity-95 text-white shadow-md shadow-[#D97757]/20 text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Contact</span>
              </Button>

              <div className="flex items-center gap-1.5 pl-1 border-l border-stone-200 dark:border-stone-800">
                {job.status === 'ACTIVE' && (
                  <Button
                    onClick={() => setIsArchiveConfirmOpen(true)}
                    variant="ghost"
                    size="sm"
                    className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 p-2"
                    title="Archive Job"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 p-2"
                  title="Delete Job"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-stone-800 pb-1">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'contacts'
                ? 'bg-[#1C1917] dark:bg-white text-white dark:text-[#1C1917] shadow-sm'
                : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-[#F4F0EA] dark:hover:bg-stone-800'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Contacts</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                activeTab === 'contacts'
                  ? 'bg-white/20 dark:bg-black/15 text-white dark:text-[#1C1917]'
                  : 'bg-[#E8E3DA] dark:bg-stone-800 text-stone-600 dark:text-stone-400'
              }`}
            >
              {jobContacts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'messages'
                ? 'bg-[#1C1917] dark:bg-white text-white dark:text-[#1C1917] shadow-sm'
                : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-[#F4F0EA] dark:hover:bg-stone-800'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Message Templates & Previews</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          TAB 1: CONTACTS
      ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'contacts' && (
        <div className="space-y-4 pt-2">
          {jobContacts.length === 0 ? (
            <Card className="p-12 text-center bg-white dark:bg-[#1C1917] border-[#E8E3DA] dark:border-stone-800 rounded-2xl">
              <div className="max-w-md mx-auto space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-[#FDF4F0] dark:bg-[#3A221C] text-[#D97757] dark:text-[#E06D53] flex items-center justify-center mx-auto text-xl font-bold shadow-xs">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1C1917] dark:text-stone-100">No contacts added yet</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                    Add employees, recruiters, or hiring managers at {job.companyName} to begin tracking referral asks and automated follow-ups.
                  </p>
                </div>
                <Button
                  onClick={() => setIsAddContactOpen(true)}
                  variant="primary"
                  className="space-x-2 bg-gradient-to-r from-[#E06D53] to-[#D97757] hover:opacity-95 text-white"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add First Contact</span>
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {jobContacts.map((contact) => {
                const isReady =
                  contact.outreachMessageStatus === 'READY_TO_SEND' ||
                  (contact.channel === 'LINKEDIN' && contact.connectionStatus === 'ACCEPTED' && contact.outreachMessageStatus === 'QUEUED') ||
                  contact.followUp1Status === 'READY_TO_SEND' ||
                  contact.followUp2Status === 'READY_TO_SEND';

                const readyStage: Stage =
                  contact.outreachMessageStatus === 'READY_TO_SEND' || (contact.channel === 'LINKEDIN' && contact.connectionStatus === 'ACCEPTED' && contact.outreachMessageStatus === 'QUEUED')
                    ? 'OUTREACH'
                    : contact.followUp1Status === 'READY_TO_SEND'
                    ? 'FU1'
                    : 'FU2';

                const canRevert =
                  contact.outreachMessageStatus === 'SENT' ||
                  contact.followUp1Status !== 'NOT_SCHEDULED' ||
                  contact.followUp2Status !== 'NOT_SCHEDULED';

                const revertLabel =
                  contact.followUp2Status !== 'NOT_SCHEDULED'
                    ? 'Revert to FU1'
                    : 'Revert to Outreach';

                return (
                  <Card
                    key={contact.id}
                    className="p-5 bg-white dark:bg-[#1C1917] border-[#E8E3DA] dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 transition-all rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-2xs"
                  >
                    {/* Left: Contact Info */}
                    <div className="flex items-start space-x-4 min-w-0">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#E06D53] to-[#D97757] text-white font-bold flex items-center justify-center text-sm shadow-xs">
                          {contact.firstName[0]?.toUpperCase() || 'C'}
                        </div>
                        <div
                          className={`absolute -bottom-1 -right-1 p-1 rounded-md text-white shadow-xs ${
                            contact.channel === 'LINKEDIN' ? 'bg-[#0A66C2]' : 'bg-purple-600'
                          }`}
                          title={`Channel: ${contact.channel}`}
                        >
                          {contact.channel === 'LINKEDIN' ? (
                            <Linkedin className="h-2.5 w-2.5" />
                          ) : (
                            <Mail className="h-2.5 w-2.5" />
                          )}
                        </div>
                      </div>

                      {/* Name & Details */}
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center space-x-2.5">
                          <h4 className="font-bold text-[#1C1917] dark:text-stone-100 text-base leading-tight">
                            {contact.firstName}
                          </h4>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-[#F4F0EA] dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-[#E8E3DA] dark:border-stone-700">
                            {contact.channel}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#78716C] dark:text-stone-400">
                          {contact.linkedinProfileUrl && (
                            <a
                              href={contact.linkedinProfileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center space-x-1 text-[#D97757] dark:text-[#E06D53] hover:underline font-semibold"
                            >
                              <span>LinkedIn Profile</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {contact.emailAddress && (
                            <span className="font-mono text-stone-600 dark:text-stone-300">
                              {contact.emailAddress}
                            </span>
                          )}
                        </div>

                        {/* Pipeline Progress Badges */}
                        <div className="flex flex-wrap items-center gap-2 pt-1.5">
                          <div className="flex items-center gap-1.5 text-xs bg-stone-50 dark:bg-stone-800/60 px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-800">
                            <span className="font-bold text-stone-500 dark:text-stone-400 text-[10px] uppercase">Outreach</span>
                            <StatusPill status={contact.outreachMessageStatus} />
                          </div>

                          {contact.followUp1Status !== 'NOT_SCHEDULED' && (
                            <div className="flex items-center gap-1.5 text-xs bg-stone-50 dark:bg-stone-800/60 px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-800">
                              <span className="font-bold text-stone-500 dark:text-stone-400 text-[10px] uppercase">FU1</span>
                              <StatusPill status={contact.followUp1Status} />
                            </div>
                          )}

                          {contact.followUp2Status !== 'NOT_SCHEDULED' && (
                            <div className="flex items-center gap-1.5 text-xs bg-stone-50 dark:bg-stone-800/60 px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-800">
                              <span className="font-bold text-stone-500 dark:text-stone-400 text-[10px] uppercase">FU2</span>
                              <StatusPill status={contact.followUp2Status} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center space-x-2.5 shrink-0 self-end md:self-center">
                      {contact.channel === 'LINKEDIN' && contact.connectionStatus === 'PENDING' && (
                        <Button
                          onClick={() => {
                            void markConnectionAccepted(contact.id);
                            showToast(`Marked connection with ${contact.firstName} as accepted! 🎉`);
                          }}
                          variant="primary"
                          size="sm"
                          className="space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Mark Accepted</span>
                        </Button>
                      )}

                      {canRevert && (
                        <Button
                          onClick={async () => {
                            await revertContactStage(contact.id);
                            showToast(`Moved ${contact.firstName} back to previous state! ↩️`);
                          }}
                          variant="outline"
                          size="sm"
                          className="space-x-1.5 text-xs text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                          title={revertLabel}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>{revertLabel}</span>
                        </Button>
                      )}

                      {isReady && (
                        <Button
                          onClick={() => {
                            void sendMessage(contact.id, readyStage);
                            showToast(`Message copied! Click "Message" on ${contact.firstName}'s profile → Cmd+A → Cmd+V 📋`);
                          }}
                          variant="primary"
                          size="sm"
                          className="space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Send Now</span>
                        </Button>
                      )}

                      <Button
                        onClick={() => setDeleteContactTargetId(contact.id)}
                        variant="ghost"
                        size="sm"
                        className="text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 p-2 rounded-xl"
                        title="Delete contact"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          TAB 2: MESSAGE TEMPLATES & PREVIEWS
      ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Left Column: Template Editor Studio (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="p-6 bg-white dark:bg-[#1C1917] border-[#E8E3DA] dark:border-stone-800 rounded-2xl shadow-xs space-y-5">
              {/* Header & Subtabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8E3DA] dark:border-stone-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#1C1917] dark:text-stone-100">Outreach Message Studio</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Customize referral templates specifically for {job.companyName}.
                  </p>
                </div>

                {/* Sub-template Switcher */}
                <div className="flex items-center space-x-1 bg-[#F4F0EA] dark:bg-stone-800 p-1 rounded-xl shrink-0 border border-[#E8E3DA] dark:border-stone-700">
                  <button
                    onClick={() => {
                      setActiveTemplateSubTab('referral');
                      setPreviewStage('OUTREACH');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeTemplateSubTab === 'referral'
                        ? 'bg-white dark:bg-stone-900 text-[#1C1917] dark:text-stone-100 shadow-xs'
                        : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
                    }`}
                  >
                    Referral Ask
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
                    FU 1
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
                    FU 2
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
                    { tag: '{{jobTitle}}', label: 'jobTitle', isFilled: Boolean(job.jobTitle?.trim()), source: 'Job' },
                    { tag: '{{companyName}}', label: 'companyName', isFilled: Boolean(job.companyName?.trim()), source: 'Job' },
                    { tag: '{{firstName}}', label: 'firstName', isFilled: Boolean(sampleContact?.firstName?.trim()), source: 'Contact' },
                    {
                      tag: '{{myCurrentTitle}}',
                      label: 'myCurrentTitle',
                      isFilled: Boolean(settings.myCurrentTitle?.trim()),
                      source: 'Sender Profile',
                    },
                    {
                      tag: '{{yearsOfExperience}}',
                      label: 'yearsOfExperience',
                      isFilled: Boolean(settings.yearsOfExperience?.trim()),
                      source: 'Sender Profile',
                    },
                    ...Object.keys(settings.customVariables || {}).map((key) => ({
                      tag: `{{${key}}}`,
                      label: key,
                      isFilled: Boolean(settings.customVariables?.[key]?.trim()),
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
                          if (norm === 'mycurrenttitle') setFillVarValue(settings.myCurrentTitle || '');
                          else if (norm === 'yearsofexperience') setFillVarValue(settings.yearsOfExperience || '');
                          else setFillVarValue(settings.customVariables?.[item.label] || '');
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

              {/* Quick Fill Variable Popover / Prompt */}
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
                    This variable will be saved in your settings and immediately applied to outreach templates across all jobs.
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

              {/* Subtab 1: Referral Ask */}
              {activeTemplateSubTab === 'referral' && (
                <div className="space-y-4">
                  <FormField
                    label="LinkedIn Referral Message Body"
                    helpText="Sent after contact accepts connection. Greeting (e.g. 'Hi Alex,') & sign-off are automatically attached by RefLoop."
                  >
                    <Textarea
                      rows={5}
                      value={referralTemplate}
                      onChange={(e) => setReferralTemplate(e.target.value)}
                      placeholder="I saw an opening for {jobTitle} at {companyName} and would love to know if you'd be open to referring me..."
                      className="font-mono text-xs leading-relaxed"
                    />
                  </FormField>

                  <FormField
                    label="Email Message Body (Optional Fallback)"
                    helpText="Leave blank to automatically use the LinkedIn message template body for Email contacts."
                  >
                    <Textarea
                      rows={4}
                      value={emailTemplate}
                      onChange={(e) => setEmailTemplate(e.target.value)}
                      placeholder="Leave blank to use the LinkedIn template above..."
                      className="font-mono text-xs leading-relaxed"
                    />
                  </FormField>
                </div>
              )}

              {/* Subtab 2: Follow-up 1 */}
              {activeTemplateSubTab === 'fu1' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
                    <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Follow-up 1 is automatically scheduled {settings.followUp1DelayDays ?? 3} days after the initial referral ask if no reply is received.
                    </span>
                  </div>
                  <FormField
                    label="Follow-Up 1 Message Template Override"
                    helpText="Leave empty to use your Global Follow-Up 1 template from Settings."
                  >
                    <Textarea
                      rows={5}
                      value={fu1Override}
                      onChange={(e) => setFu1Override(e.target.value)}
                      placeholder="Following up on my note regarding the {jobTitle} opening at {companyName}..."
                      className="font-mono text-xs leading-relaxed"
                    />
                  </FormField>
                </div>
              )}

              {/* Subtab 3: Follow-up 2 */}
              {activeTemplateSubTab === 'fu2' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
                    <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Follow-up 2 (final gentle nudge) is scheduled {settings.followUp2DelayDays ?? 5} days after FU1.
                    </span>
                  </div>
                  <FormField
                    label="Follow-Up 2 Message Template Override"
                    helpText="Leave empty to use your Global Follow-Up 2 template from Settings."
                  >
                    <Textarea
                      rows={5}
                      value={fu2Override}
                      onChange={(e) => setFu2Override(e.target.value)}
                      placeholder="One final quick follow-up regarding the {jobTitle} role..."
                      className="font-mono text-xs leading-relaxed"
                    />
                  </FormField>
                </div>
              )}

              {/* Footer Save Button */}
              <div className="pt-2 flex items-center justify-between border-t border-[#E8E3DA] dark:border-stone-800">
                <span className="text-xs text-stone-400">
                  {referralTemplate.length} characters in primary template
                </span>
                <Button
                  onClick={() => void handleSaveTemplates()}
                  isLoading={savingTemplates}
                  variant="primary"
                  className="bg-gradient-to-r from-[#E06D53] to-[#D97757] hover:opacity-95 text-white shadow-md shadow-[#D97757]/20 font-bold text-xs"
                >
                  Save Templates
                </Button>
              </div>
            </Card>
          </div>

          {/* Right Column: Live Message Preview Simulator (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="p-6 bg-white dark:bg-[#1C1917] border-[#E8E3DA] dark:border-stone-800 rounded-2xl shadow-xs space-y-4 sticky top-6">
              <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-stone-800 pb-3.5">
                <div className="flex items-center space-x-2">
                  <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Eye className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1C1917] dark:text-stone-100">Live Preview Simulator</h3>
                </div>

                {/* Stage Selector */}
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

              {/* Select Target Preview Contact */}
              {jobContacts.length > 0 && (
                <div className="flex items-center justify-between text-xs bg-[#FAF8F5] dark:bg-stone-800/40 p-2.5 rounded-xl border border-[#E8E3DA] dark:border-stone-800">
                  <span className="text-stone-500 font-medium">Simulate Contact:</span>
                  <select
                    value={previewContactId}
                    onChange={(e) => setPreviewContactId(e.target.value)}
                    className="h-7 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 text-xs font-semibold text-stone-800 dark:text-stone-200 outline-none"
                  >
                    {jobContacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} ({c.channel})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Warnings Banner: Duplicate Greeting */}
              {validationResult.hasDuplicateGreeting && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Warning: Duplicate Greeting Detected</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    Your message body starts with <code className="font-mono font-bold bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">"{validationResult.duplicateGreetingSnippet}"</code>, but RefLoop also prepends the greeting format <code className="font-mono font-bold bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">"{settings.greetingFormat}"</code>. This causes the greeting to appear twice.
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
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 space-y-2 animate-in fade-in duration-200">
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

              {/* Simulated Chat Bubble */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center justify-between">
                  <span>Simulated {sampleContact.channel === 'LINKEDIN' ? 'LinkedIn Message' : 'Email'}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{previewStage}</span>
                </div>

                {assembledPreview.subject && (
                  <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-800 dark:text-stone-200">
                    <span className="text-stone-400 font-normal mr-1.5">Subject:</span>
                    {assembledPreview.subject}
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-[#F4F0EA]/70 dark:bg-stone-800/60 border border-[#E8E3DA] dark:border-stone-700/80 text-xs text-stone-800 dark:text-stone-100 font-sans leading-relaxed whitespace-pre-wrap shadow-inner relative">
                  {assembledPreview.body || (
                    <span className="text-stone-400 italic">No template text written yet.</span>
                  )}
                </div>
              </div>

              {/* Information pill */}
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/30 border border-stone-200/80 dark:border-stone-800 text-[11px] text-stone-500 dark:text-stone-400 flex items-center space-x-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>All variables dynamically match the target contact and job details.</span>
              </div>
            </Card>
          </div>
        </div>
      )}


      {/* ────────────────────────────────────────────────────────────────────────
          DIALOGS & CONFIRMATIONS
      ──────────────────────────────────────────────────────────────────────── */}

      {/* Add Contact Modal */}
      <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#1C1917] border-[#E8E3DA] dark:border-stone-800 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1C1917] dark:text-stone-100 flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-[#FDF4F0] dark:bg-[#3A221C] text-[#D97757] flex items-center justify-center font-bold text-sm">
                <Plus className="h-4 w-4" />
              </div>
              <span>Add Contact at {job.companyName}</span>
            </DialogTitle>
          </DialogHeader>

          {contactError && (
            <div className="mt-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
              <span>{contactError}</span>
            </div>
          )}

          <form onSubmit={(e) => void handleAddContact(e)} className="space-y-4 py-2">
            <FormField label="Outreach Channel">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setContactChannel('LINKEDIN')}
                  className={`p-3 rounded-xl border flex items-center justify-center space-x-2 text-xs font-bold transition-all ${
                    contactChannel === 'LINKEDIN'
                      ? 'border-[#0A66C2] bg-blue-50/50 dark:bg-blue-950/30 text-[#0A66C2]'
                      : 'border-[#E8E3DA] dark:border-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                  <span>LinkedIn</span>
                </button>

                <button
                  type="button"
                  onClick={() => setContactChannel('EMAIL')}
                  className={`p-3 rounded-xl border flex items-center justify-center space-x-2 text-xs font-bold transition-all ${
                    contactChannel === 'EMAIL'
                      ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 text-purple-600'
                      : 'border-[#E8E3DA] dark:border-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <Mail className="h-4 w-4 text-purple-600" />
                  <span>Email</span>
                </button>
              </div>
            </FormField>

            <FormField label="First Name" required helpText="Used in personal greetings (e.g. 'Hi Alex')">
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Alex"
                className="rounded-xl"
                required
              />
            </FormField>

            {contactChannel === 'LINKEDIN' ? (
              <FormField label="LinkedIn Profile URL" helpText="e.g. https://www.linkedin.com/in/alex-smith">
                <Input
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/alex-smith"
                  className="rounded-xl"
                />
              </FormField>
            ) : (
              <FormField label="Email Address" required helpText="Target employee's company or personal email">
                <Input
                  type="email"
                  value={emailAddr}
                  onChange={(e) => setEmailAddr(e.target.value)}
                  placeholder="alex.smith@company.com"
                  className="rounded-xl"
                  required
                />
              </FormField>
            )}

            <DialogFooter className="mt-5 pt-3 border-t border-[#E8E3DA] dark:border-stone-800">
              <Button type="button" variant="outline" onClick={() => setIsAddContactOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={addingContact}
                className="rounded-xl bg-gradient-to-r from-[#E06D53] to-[#D97757] text-white font-bold"
              >
                Add Contact
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        open={isArchiveConfirmOpen}
        onOpenChange={setIsArchiveConfirmOpen}
        title="Archive Job Posting?"
        description="Archiving this job will cancel all pending outreach and follow-up queue items."
        confirmLabel="Archive Job"
        onConfirm={async () => {
          await archiveJob(job.id);
          setIsArchiveConfirmOpen(false);
          showToast('Job archived');
        }}
      />

      {/* Delete Job Confirmation Dialog */}
      <ConfirmDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title="Delete Job Posting permanently?"
        description="This will permanently delete this job posting and all associated contacts. This action cannot be undone."
        variant="danger"
        confirmLabel="Delete Job"
        onConfirm={async () => {
          await deleteJob(job.id);
          setIsDeleteConfirmOpen(false);
          navigate('/jobs');
        }}
      />

      {/* Delete Contact Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteContactTargetId}
        onOpenChange={() => setDeleteContactTargetId(null)}
        title="Delete Contact?"
        description="This will permanently remove this contact and cancel any scheduled follow-up messages."
        variant="danger"
        confirmLabel="Delete Contact"
        onConfirm={async () => {
          if (deleteContactTargetId) {
            await deleteContact(deleteContactTargetId);
            setDeleteContactTargetId(null);
            showToast('Contact deleted');
          }
        }}
      />

      {/* Referral Received Confirmation Dialog */}
      <ConfirmDialog
        open={isReferralConfirmOpen}
        onOpenChange={setIsReferralConfirmOpen}
        title="Mark Referral Received! 🎉"
        description="Congratulations! This job will move to the Referral Received tab and cancel pending follow-up messages."
        confirmLabel="Mark Received 🎉"
        onConfirm={async () => {
          await markReferralReceived(job.id);
          setIsReferralConfirmOpen(false);
          showToast('Referral logged! 🎉');
        }}
      />
    </div>
  );
}
