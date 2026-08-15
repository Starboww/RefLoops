import React, { useState } from 'react';
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
} from 'lucide-react';
import {
  Button,
  StatusPill,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
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
} from '@refloop/ui';
import { useJobsStore, useContactsStore } from '../../store';
import {
  updateJob,
  deleteJob,
  archiveJob,
  markReferralReceived,
  addLinkedInContact,
  addEmailContact,
  sendMessage,
  deleteContact,
} from '../../services/appService';
import type { JobPosting } from '@refloop/core';

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const { jobs } = useJobsStore();
  const { contacts } = useContactsStore();

  const job = jobs.find((j) => j.id === jobId);
  const jobContacts = contacts.filter((c) => c.jobPostingId === jobId);

  const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'contacts'>('contacts');
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteContactTargetId, setDeleteContactTargetId] = useState<string | null>(null);
  const [isReferralConfirmOpen, setIsReferralConfirmOpen] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Template editing state
  const [referralTemplate, setReferralTemplate] = useState(job?.referralMessageTemplate ?? '');
  const [emailTemplate, setEmailTemplate] = useState(job?.emailMessageTemplate ?? '');
  const [fu1Override, setFu1Override] = useState(job?.followUp1TemplateOverride ?? '');
  const [fu2Override, setFu2Override] = useState(job?.followUp2TemplateOverride ?? '');
  const [savingTemplates, setSavingTemplates] = useState(false);

  // New contact form state
  const [contactChannel, setContactChannel] = useState<'LINKEDIN' | 'EMAIL'>('LINKEDIN');
  const [firstName, setFirstName] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [emailAddr, setEmailAddr] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500">Job posting not found.</p>
        <Button onClick={() => navigate('/jobs')} variant="outline" className="mt-4">
          Back to Jobs
        </Button>
      </div>
    );
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveTemplates = async () => {
    try {
      setSavingTemplates(true);
      const patch: Partial<JobPosting> = {
        referralMessageTemplate: referralTemplate,
      };
      if (emailTemplate) patch.emailMessageTemplate = emailTemplate;
      if (fu1Override) patch.followUp1TemplateOverride = fu1Override;
      if (fu2Override) patch.followUp2TemplateOverride = fu2Override;

      await updateJob(job.id, patch);
      showToast('Templates saved successfully! ✨');
    } finally {
      setSavingTemplates(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
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
      showToast('Contact added successfully!');
    } finally {
      setAddingContact(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 bg-[#1C1917] text-white px-4 py-3 rounded-xl shadow-lg border border-stone-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      <div>
        <button
          onClick={() => navigate('/jobs')}
          className="inline-flex items-center space-x-2 text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Jobs</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-stone-900 border border-[#E8E3DA] dark:border-stone-800 p-6 rounded-2xl shadow-xs">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-[#1C1917] dark:text-stone-100">{job.jobTitle}</h1>
              <StatusPill status={job.status} />
            </div>
            <p className="text-base font-medium text-[#78716C] dark:text-stone-400 mt-1">
              {job.companyName} · <span className="text-xs text-stone-400">Added {new Date(job.dateAdded).toLocaleDateString()}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={job.jobLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-medium border border-[#E8E3DA] dark:border-stone-700 rounded-xl hover:bg-[#FAF8F5] dark:hover:bg-stone-800 transition-colors"
            >
              <span>View Job Link</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            {job.status === 'ACTIVE' && (
              <>
                <Button
                  onClick={() => setIsReferralConfirmOpen(true)}
                  variant="primary"
                  className="space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Award className="h-4 w-4" />
                  <span>Referral Received! 🎉</span>
                </Button>

                <Button
                  onClick={() => setIsArchiveConfirmOpen(true)}
                  variant="outline"
                  className="space-x-1.5 text-stone-600"
                >
                  <Archive className="h-4 w-4" />
                  <span>Archive Job</span>
                </Button>
              </>
            )}

            <Button
              onClick={() => setIsDeleteConfirmOpen(true)}
              variant="danger"
              className="space-x-1.5"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Job</span>
            </Button>

            <Button onClick={() => setIsAddContactOpen(true)} variant="primary" className="space-x-1.5">
              <Plus className="h-4 w-4" />
              <span>Add Contact</span>
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'overview' | 'messages' | 'contacts')}>
        <TabsList className="w-full justify-start border-b border-[#E8E3DA] dark:border-stone-800 rounded-none bg-transparent p-0 h-12 space-x-6">
          <TabsTrigger
            value="contacts"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#D97757] data-[state=active]:bg-transparent px-1 py-3 text-stone-600 dark:text-stone-400"
          >
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Contacts ({jobContacts.length})</span>
            </div>
          </TabsTrigger>
          <TabsTrigger
            value="messages"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#D97757] data-[state=active]:bg-transparent px-1 py-3 text-stone-600 dark:text-stone-400"
          >
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span>Message Templates & Previews</span>
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="pt-4">
          {jobContacts.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-stone-500">No contacts added for this job yet.</p>
              <Button onClick={() => setIsAddContactOpen(true)} variant="primary" className="mt-4 space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add First Contact</span>
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {jobContacts.map((contact) => {
                const isReady =
                  contact.outreachMessageStatus === 'READY_TO_SEND' ||
                  contact.followUp1Status === 'READY_TO_SEND' ||
                  contact.followUp2Status === 'READY_TO_SEND';

                return (
                  <Card key={contact.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        {contact.channel === 'LINKEDIN' ? (
                          <Linkedin className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Mail className="h-4 w-4 text-purple-600" />
                        )}
                        <h4 className="font-bold text-[#1C1917] dark:text-stone-100">{contact.firstName}</h4>
                        <span className="text-xs px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600">
                          {contact.channel}
                        </span>
                      </div>

                      <div className="text-xs text-stone-500 space-x-4">
                        {contact.linkedinProfileUrl && (
                          <a
                            href={contact.linkedinProfileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline text-[#D97757]"
                          >
                            LinkedIn Profile
                          </a>
                        )}
                        {contact.emailAddress && <span>{contact.emailAddress}</span>}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <span className="text-xs font-semibold text-stone-500">Outreach:</span>
                        <StatusPill status={contact.outreachMessageStatus} />
                        {contact.followUp1Status !== 'NOT_SCHEDULED' && (
                          <>
                            <span className="text-xs font-semibold text-stone-500 ml-2">FU1:</span>
                            <StatusPill status={contact.followUp1Status} />
                          </>
                        )}
                        {contact.followUp2Status !== 'NOT_SCHEDULED' && (
                          <>
                            <span className="text-xs font-semibold text-stone-500 ml-2">FU2:</span>
                            <StatusPill status={contact.followUp2Status} />
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isReady && (
                        <Button
                          onClick={() => {
                            const stage =
                              contact.outreachMessageStatus === 'READY_TO_SEND'
                                ? 'OUTREACH'
                                : contact.followUp1Status === 'READY_TO_SEND'
                                ? 'FU1'
                                : 'FU2';
                            void sendMessage(contact.id, stage);
                          }}
                          variant="primary"
                          size="sm"
                          className="space-x-1.5 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Send Now</span>
                        </Button>
                      )}

                      <Button
                        onClick={() => setDeleteContactTargetId(contact.id)}
                        variant="ghost"
                        size="sm"
                        className="text-stone-400 hover:text-rose-600 p-2"
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
        </TabsContent>

        <TabsContent value="messages" className="pt-4 space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#1C1917] dark:text-stone-100">Referral Message Template</h3>
            <p className="text-xs text-stone-500">
              This message is sent after connection acceptance. Do NOT include a greeting line like "Hi Name" — RefLoop automatically appends your greeting setting.
            </p>
            <FormField label="LinkedIn Referral Ask Body">
              <Textarea
                rows={4}
                value={referralTemplate}
                onChange={(e) => setReferralTemplate(e.target.value)}
                placeholder="I noticed an opening for..."
              />
            </FormField>

            <FormField label="Email Message Body (Optional fallback)">
              <Textarea
                rows={3}
                value={emailTemplate}
                onChange={(e) => setEmailTemplate(e.target.value)}
                placeholder="Leave blank to use LinkedIn template body for Email"
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="FU1 Template Override (Optional)">
                <Textarea
                  rows={3}
                  value={fu1Override}
                  onChange={(e) => setFu1Override(e.target.value)}
                  placeholder="Overrides global FU1 template for this job..."
                />
              </FormField>

              <FormField label="FU2 Template Override (Optional)">
                <Textarea
                  rows={3}
                  value={fu2Override}
                  onChange={(e) => setFu2Override(e.target.value)}
                  placeholder="Overrides global FU2 template for this job..."
                />
              </FormField>
            </div>

            <Button onClick={() => void handleSaveTemplates()} isLoading={savingTemplates} variant="primary">
              Save Templates
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact for {job.companyName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleAddContact(e)} className="space-y-4 py-2">
            <FormField label="Channel">
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="channel"
                    checked={contactChannel === 'LINKEDIN'}
                    onChange={() => setContactChannel('LINKEDIN')}
                  />
                  <span>LinkedIn</span>
                </label>
                <label className="flex items-center space-x-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="channel"
                    checked={contactChannel === 'EMAIL'}
                    onChange={() => setContactChannel('EMAIL')}
                  />
                  <span>Email</span>
                </label>
              </div>
            </FormField>

            <FormField label="First Name" required>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
            </FormField>

            {contactChannel === 'LINKEDIN' ? (
              <FormField label="LinkedIn Profile URL">
                <Input
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/jane-doe"
                />
              </FormField>
            ) : (
              <FormField label="Email Address" required>
                <Input
                  value={emailAddr}
                  onChange={(e) => setEmailAddr(e.target.value)}
                  placeholder="jane.doe@company.com"
                />
              </FormField>
            )}

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddContactOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={addingContact}>
                Add Contact
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isArchiveConfirmOpen}
        onOpenChange={setIsArchiveConfirmOpen}
        title="Archive Job Posting?"
        description="Archiving this job will cancel all pending outreach and follow-up queue items."
        variant="danger"
        confirmLabel="Archive Job"
        onConfirm={async () => {
          await archiveJob(job.id);
          setIsArchiveConfirmOpen(false);
          showToast('Job archived');
        }}
      />

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

      <ConfirmDialog
        open={!!deleteContactTargetId}
        onOpenChange={() => setDeleteContactTargetId(null)}
        title="Delete Contact?"
        description="This will permanently remove this contact from the job posting."
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

      <ConfirmDialog
        open={isReferralConfirmOpen}
        onOpenChange={setIsReferralConfirmOpen}
        title="Mark Referral Received! 🎉"
        description="Congratulations! This job will move to the Referral Received tab."
        confirmLabel="Mark Received"
        onConfirm={async () => {
          await markReferralReceived(job.id);
          setIsReferralConfirmOpen(false);
          showToast('Referral logged! 🎉');
        }}
      />
    </div>
  );
}
