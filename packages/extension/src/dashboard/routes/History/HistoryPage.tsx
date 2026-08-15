import { History as HistoryIcon, Archive, XCircle } from 'lucide-react';
import { Card, StatusPill, EmptyState } from '@refloop/ui';
import { useJobsStore, useContactsStore } from '../../store';

export function HistoryPage() {
  const { jobs } = useJobsStore();
  const { contacts } = useContactsStore();

  const archivedJobs = jobs.filter((j) => j.status === 'ARCHIVED');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Pipeline History & Archive</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Review archived job postings, expired connection requests, and completed outreach cycles.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center space-x-4">
          <div className="h-10 w-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-600">
            <Archive className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-medium">Archived Jobs</p>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{archivedJobs.length}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center space-x-4">
          <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-medium">Expired Connections (14d)</p>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {contacts.filter((c) => c.connectionStatus === 'EXPIRED').length}
            </p>
          </div>
        </Card>

        <Card className="p-5 flex items-center space-x-4">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
            <HistoryIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-stone-500 font-medium">Total Contacts Handled</p>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{contacts.length}</p>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">Archived Job Postings</h2>
        {archivedJobs.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="No History Yet"
            description="Jobs that auto-archive or are manually archived will appear here."
          />
        ) : (
          <div className="space-y-3">
            {archivedJobs.map((job) => (
              <Card key={job.id} className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm">{job.jobTitle}</h3>
                  <p className="text-xs text-stone-500">
                    {job.companyName} · Archived: {job.archiveReason === 'AUTO_NO_ACTIVE_CONTACTS' ? 'Auto (No active contacts)' : 'Manual'}
                  </p>
                </div>
                <StatusPill status="ARCHIVED" />
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
