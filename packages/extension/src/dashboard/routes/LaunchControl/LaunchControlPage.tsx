import { useState } from 'react';
import { Send, Linkedin, Mail, Edit3, XCircle, RefreshCw, CheckCircle2, Clock, Info, AlertCircle, RotateCcw } from 'lucide-react';
import { Button, Card, EmptyState, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Textarea } from '@refloop/ui';
import { useContactsStore, useJobsStore, useSettingsStore } from '../../store';
import { sendMessage, cancelQueueItem, markConnectionAccepted, runHousekeepingNow, resolveGmailAmbiguity, dismissGmailAmbiguity, revertContactStage } from '../../services/appService';
import { MessageAssemblyService, type Contact, type JobPosting, type Stage } from '@refloop/core';

export function LaunchControlPage() {
  const { contacts } = useContactsStore();
  const { jobs } = useJobsStore();
  const { settings } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<'ready' | 'queued'>('ready');
  const [editingItem, setEditingItem] = useState<{ contact: Contact; job: JobPosting; stage: Stage } | null>(null);
  const [overrideText, setOverrideText] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [isRunningHousekeeping, setIsRunningHousekeeping] = useState(false);
  const [showInfo, setShowInfo] = useState(true);

  // Ready to Send items
  const readyItems: Array<{ contact: Contact; job: JobPosting; stage: Stage }> = [];
  // Queued or Scheduled items waiting for connection or time
  const pendingItems: Array<{ contact: Contact; job: JobPosting; stage: Stage; reason: string }> = [];

  for (const c of contacts) {
    const job = jobs.find((j) => j.id === c.jobPostingId);
    if (!job || job.status !== 'ACTIVE' || c.removedAt) continue;

    // Outreach stage
    if (
      c.outreachMessageStatus === 'READY_TO_SEND' ||
      (c.channel === 'LINKEDIN' && c.connectionStatus === 'ACCEPTED' && c.outreachMessageStatus === 'QUEUED')
    ) {
      readyItems.push({ contact: c, job, stage: 'OUTREACH' });
    } else if (c.outreachMessageStatus === 'QUEUED' && c.channel === 'LINKEDIN') {
      pendingItems.push({
        contact: c,
        job,
        stage: 'OUTREACH',
        reason: 'Waiting for LinkedIn connection request to be accepted',
      });
    }

    // Follow-up 1 stage
    if (c.followUp1Status === 'READY_TO_SEND') {
      readyItems.push({ contact: c, job, stage: 'FU1' });
    } else if (c.followUp1Status === 'SCHEDULED') {
      const scheduledDate = c.followUp1ScheduledFor
        ? new Date(c.followUp1ScheduledFor).toLocaleDateString()
        : 'Scheduled';
      pendingItems.push({
        contact: c,
        job,
        stage: 'FU1',
        reason: `Follow-up 1 scheduled for ${scheduledDate}`,
      });
    }

    // Follow-up 2 stage
    if (c.followUp2Status === 'READY_TO_SEND') {
      readyItems.push({ contact: c, job, stage: 'FU2' });
    } else if (c.followUp2Status === 'SCHEDULED') {
      const scheduledDate = c.followUp2ScheduledFor
        ? new Date(c.followUp2ScheduledFor).toLocaleDateString()
        : 'Scheduled';
      pendingItems.push({
        contact: c,
        job,
        stage: 'FU2',
        reason: `Follow-up 2 scheduled for ${scheduledDate}`,
      });
    }
  }

  // ---- Needs Review: contacts flagged REVIEW_REQUIRED by Gmail sync ----
  // Group by acceptanceGmailMessageId so each ambiguous email becomes one card.
  const reviewGroups = new Map<string, { contacts: Contact[]; contactJobs: Map<string, JobPosting> }>();
  for (const c of contacts) {
    if (c.connectionStatus !== 'REVIEW_REQUIRED' || !c.acceptanceGmailMessageId || c.removedAt) continue;
    const msgId = c.acceptanceGmailMessageId;
    if (!reviewGroups.has(msgId)) {
      reviewGroups.set(msgId, { contacts: [], contactJobs: new Map() });
    }
    const group = reviewGroups.get(msgId)!;
    group.contacts.push(c);
    const job = jobs.find((j) => j.id === c.jobPostingId);
    if (job) group.contactJobs.set(c.id, job);
  }

  const assembler = new MessageAssemblyService();

  const handleSend = async (item: { contact: Contact; stage: Stage }) => {
    try {
      setSendingId(item.contact.id);
      await sendMessage(item.contact.id, item.stage);
    } finally {
      setSendingId(null);
    }
  };

  const handleSaveOverride = async () => {
    if (!editingItem) return;
    try {
      await sendMessage(editingItem.contact.id, editingItem.stage, overrideText);
      setEditingItem(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunHousekeeping = async () => {
    try {
      setIsRunningHousekeeping(true);
      await runHousekeepingNow();
    } finally {
      setTimeout(() => setIsRunningHousekeeping(false), 800);
    }
  };

  const handleResolveAmbiguity = async (resolvedId: string, allIds: string[]) => {
    try {
      await resolveGmailAmbiguity(resolvedId, allIds.filter((id) => id !== resolvedId));
    } catch (err) {
      console.error('[RefLoop] Failed to resolve Gmail ambiguity:', err);
    }
  };

  const handleDismissAmbiguity = async (allIds: string[], gmailMessageId: string) => {
    try {
      await dismissGmailAmbiguity(allIds, gmailMessageId);
    } catch (err) {
      console.error('[RefLoop] Failed to dismiss Gmail ambiguity:', err);
    }
  };

  const openLinkedInProfile = (url: string) => {
    void chrome.tabs.create({ url });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-2">
            <span>Launch Control</span>
            <span className="text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold px-2.5 py-0.5 rounded-full">
              {readyItems.length} ready to send
            </span>
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Review, edit, and manually dispatch outreach & follow-up messages across all jobs.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <Button
            onClick={() => void handleRunHousekeeping()}
            isLoading={isRunningHousekeeping}
            variant="outline"
            size="sm"
            className="space-x-1.5 text-stone-700 dark:text-stone-300"
            title="Scan LinkedIn for newly accepted connections and update scheduled follow-ups"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRunningHousekeeping ? 'animate-spin' : ''}`} />
            <span>Check Acceptances Now</span>
          </Button>

          <Button
            onClick={() => setShowInfo(!showInfo)}
            variant="ghost"
            size="sm"
            className="text-stone-500"
            title="How Launch Control works"
          >
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showInfo && (
        <Card className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-xs text-indigo-950 dark:text-indigo-200 space-y-2 relative">
          <button
            onClick={() => setShowInfo(false)}
            className="absolute top-3 right-3 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200 font-bold"
          >
            ✕
          </button>
          <div className="font-bold flex items-center space-x-2 text-indigo-900 dark:text-indigo-100 text-sm">
            <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>How Contacts Move to Launch Control:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-stone-700 dark:text-indigo-200">
            <li>
              <strong>LinkedIn Contacts:</strong> Added as <em>Queued (Pending Connection)</em>. Once the connection is accepted on LinkedIn (or manually marked accepted), status becomes <code>READY_TO_SEND</code> and appears here for your manual send click.
            </li>
            <li>
              <strong>Email Contacts:</strong> Automatically land in <code>READY_TO_SEND</code> as soon as created.
            </li>
            <li>
              <strong>Follow-up Messages:</strong> When an outreach is sent, follow-ups are scheduled. When their target delay time arrives, they flip to <code>READY_TO_SEND</code> here.
            </li>
          </ul>
        </Card>
      )}

      {/* ---- Needs Review: Gmail acceptance disambiguation ---- */}
      {reviewGroups.size > 0 && (
        <div className="space-y-3">
          {Array.from(reviewGroups.entries()).map(([gmailMessageId, group]) => {
            const allIds = group.contacts.map((c) => c.id);
            return (
              <Card
                key={gmailMessageId}
                className="p-5 border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20"
              >
                <div className="flex items-start space-x-3 mb-4">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                      Gmail: Connection Accepted — Needs Your Confirmation
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      {group.contacts.length === 1
                        ? 'We found 1 possible match. Confirm if this is the right person.'
                        : `We found ${group.contacts.length} people this could be. Tap "This is them" next to the right person.`}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {group.contacts.map((contact) => {
                    const job = group.contactJobs.get(contact.id);
                    return (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
                                {contact.fullNameRaw ?? contact.firstName}
                              </span>
                              {contact.linkedinProfileUrl && (
                                <button
                                  onClick={() => openLinkedInProfile(contact.linkedinProfileUrl!)}
                                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors shrink-0"
                                  title="View LinkedIn profile"
                                >
                                  <Linkedin className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            {job && (
                              <p className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">
                                {job.companyName} · {job.jobTitle}
                              </p>
                            )}
                          </div>
                        </div>

                        <Button
                          onClick={() => void handleResolveAmbiguity(contact.id, allIds)}
                          variant="primary"
                          size="sm"
                          className="shrink-0 ml-4 space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>This is them</span>
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => void handleDismissAmbiguity(allIds, gmailMessageId)}
                    variant="ghost"
                    size="sm"
                    className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 text-xs"
                  >
                    None of these
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-stone-200 dark:border-stone-800 pb-2">
        <button
          onClick={() => setActiveTab('ready')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center space-x-2 ${
            activeTab === 'ready'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800'
          }`}
        >
          <span>Ready to Send</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white">
            {readyItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('queued')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center space-x-2 ${
            activeTab === 'queued'
              ? 'bg-stone-800 text-white shadow-xs dark:bg-stone-700'
              : 'text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800'
          }`}
        >
          <span>Queued & Scheduled</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
            {pendingItems.length}
          </span>
        </button>
      </div>

      {activeTab === 'ready' && (
        readyItems.length === 0 ? (
          <EmptyState
            icon={Send}
            title="Send Queue Clear!"
            description="There are no pending outreach or follow-up messages currently waiting to be sent. Check 'Queued & Scheduled' for pending connection requests."
          />
        ) : (
          <div className="space-y-4">
            {readyItems.map(({ contact, job, stage }) => {
              const assembled = assembler.assemble(stage, job, contact, settings);
              const isSending = sendingId === contact.id;

              return (
                <Card key={`${contact.id}-${stage}`} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center space-x-3">
                      {contact.channel === 'LINKEDIN' ? (
                        <Linkedin className="h-4 w-4 text-blue-600 shrink-0" />
                      ) : (
                        <Mail className="h-4 w-4 text-purple-600 shrink-0" />
                      )}
                      <h3 className="font-bold text-stone-900 dark:text-stone-100">{contact.firstName}</h3>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">
                        {stage} • READY TO SEND
                      </span>
                      <span className="text-xs text-stone-500">• {job.companyName} ({job.jobTitle})</span>
                    </div>

                    {assembled.subject && (
                      <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                        Subject: {assembled.subject}
                      </p>
                    )}

                    <div className="p-3 rounded-lg bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-300 whitespace-pre-wrap font-mono">
                      {assembled.body}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {stage !== 'OUTREACH' && (
                      <Button
                        onClick={() => void revertContactStage(contact.id)}
                        variant="outline"
                        size="sm"
                        className="space-x-1 text-xs text-stone-600 dark:text-stone-300"
                        title={stage === 'FU2' ? 'Revert to Follow-up 1' : 'Revert to Outreach'}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>{stage === 'FU2' ? 'Revert to FU1' : 'Revert to Outreach'}</span>
                      </Button>
                    )}

                    <Button
                      onClick={() => {
                        setEditingItem({ contact, job, stage });
                        setOverrideText(assembled.body);
                      }}
                      variant="outline"
                      size="sm"
                      className="space-x-1"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      onClick={() => void cancelQueueItem(contact.id, stage)}
                      variant="ghost"
                      size="sm"
                      className="text-stone-500 hover:text-rose-600"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </Button>

                    <Button
                      onClick={() => void handleSend({ contact, stage })}
                      isLoading={isSending}
                      variant="primary"
                      size="sm"
                      className="space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Send Now</span>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'queued' && (
        pendingItems.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No Queued Contacts"
            description="There are no contacts pending connection acceptance or waiting for follow-up dates."
          />
        ) : (
          <div className="space-y-4">
            {pendingItems.map(({ contact, job, stage, reason }) => (
              <Card key={`${contact.id}-${stage}`} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-l-amber-500">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center space-x-3">
                    {contact.channel === 'LINKEDIN' ? (
                      <Linkedin className="h-4 w-4 text-blue-600 shrink-0" />
                    ) : (
                      <Mail className="h-4 w-4 text-purple-600 shrink-0" />
                    )}
                    <h3 className="font-bold text-stone-900 dark:text-stone-100">{contact.firstName}</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                      {stage} • PENDING
                    </span>
                    <span className="text-xs text-stone-500">• {job.companyName} ({job.jobTitle})</span>
                  </div>

                  <p className="text-xs text-stone-600 dark:text-stone-400 flex items-center space-x-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>{reason}</span>
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {(stage === 'FU1' || stage === 'FU2') && (
                    <Button
                      onClick={() => void revertContactStage(contact.id)}
                      variant="outline"
                      size="sm"
                      className="space-x-1.5 text-xs text-stone-600 dark:text-stone-300"
                      title={stage === 'FU2' ? 'Revert to Follow-up 1' : 'Revert to Outreach'}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{stage === 'FU2' ? 'Revert to FU1' : 'Revert to Outreach'}</span>
                    </Button>
                  )}
                  {contact.channel === 'LINKEDIN' && contact.connectionStatus === 'PENDING' && (
                    <Button
                      onClick={() => void markConnectionAccepted(contact.id)}
                      variant="primary"
                      size="sm"
                      className="space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Mark Connection Accepted</span>
                    </Button>
                  )}
                  <Button
                    onClick={() => void cancelQueueItem(contact.id, stage)}
                    variant="ghost"
                    size="sm"
                    className="text-stone-500 hover:text-rose-600"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Cancel</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Message Before Sending</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              rows={8}
              value={overrideText}
              onChange={(e) => setOverrideText(e.target.value)}
              className="font-mono text-xs"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingItem(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void handleSaveOverride()}>
                Send Edited Message
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
