import { Clock, Send, XCircle, RotateCcw } from 'lucide-react';
import { Button, StatusPill, Card, EmptyState } from '@refloop/ui';
import { useContactsStore, useJobsStore, useSettingsStore } from '../../store';
import { sendMessage, cancelQueueItem, revertContactStage } from '../../services/appService';
import { MessageAssemblyService } from '@refloop/core';

export function FollowUpQueuePage() {
  const { contacts } = useContactsStore();
  const { jobs } = useJobsStore();
  const { settings } = useSettingsStore();

  const fuItems = [];

  for (const c of contacts) {
    const job = jobs.find((j) => j.id === c.jobPostingId);
    if (!job || job.status !== 'ACTIVE') continue;

    if (c.followUp1Status === 'READY_TO_SEND' || c.followUp1Status === 'SCHEDULED') {
      fuItems.push({ contact: c, job, stage: 'FU1' as const, status: c.followUp1Status, date: c.followUp1ScheduledFor });
    }
    if (c.followUp2Status === 'READY_TO_SEND' || c.followUp2Status === 'SCHEDULED') {
      fuItems.push({ contact: c, job, stage: 'FU2' as const, status: c.followUp2Status, date: c.followUp2ScheduledFor });
    }
  }

  const assembler = new MessageAssemblyService();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Follow-up Queue</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Track upcoming and ready follow-up messages across all active outreach contacts.
        </p>
      </div>

      {fuItems.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No Follow-ups Pending"
          description="Follow-ups will automatically be scheduled after your initial outreach messages are sent."
        />
      ) : (
        <div className="space-y-4">
          {fuItems.map(({ contact, job, stage, status, date }) => {
            const assembled = assembler.assemble(stage, job, contact, settings);
            const isReady = status === 'READY_TO_SEND';

            return (
              <Card key={`${contact.id}-${stage}`} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-stone-900 dark:text-stone-100">{contact.firstName}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 font-semibold">
                      {stage}
                    </span>
                    <StatusPill status={status} />
                  </div>
                  <p className="text-xs text-stone-500">
                    {job.companyName} · {job.jobTitle}
                    {date && ` · Scheduled: ${new Date(date).toLocaleString()}`}
                  </p>

                  <div className="p-3 rounded-lg bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-300 font-mono">
                    {assembled.body}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <Button
                    onClick={() => void revertContactStage(contact.id)}
                    variant="outline"
                    size="sm"
                    className="space-x-1.5 text-xs text-stone-600 dark:text-stone-300"
                    title="Revert to previous stage (e.g. back to Outreach)"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Revert State</span>
                  </Button>
                  {isReady && (
                    <Button
                      onClick={() => void sendMessage(contact.id, stage)}
                      variant="primary"
                      size="sm"
                      className="space-x-1.5 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Send Now</span>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
