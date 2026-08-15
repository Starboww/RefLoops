import { Award, ExternalLink } from 'lucide-react';
import { Card, StatusPill, EmptyState } from '@refloop/ui';
import { useJobsStore, useContactsStore } from '../../store';

export function ReferralReceivedPage() {
  const { jobs } = useJobsStore();
  const { contacts } = useContactsStore();

  const referralJobs = jobs.filter((j) => j.status === 'REFERRAL_RECEIVED');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-2">
          <span>Referrals Received</span>
          <span className="text-xl">🎉</span>
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Hall of fame — job postings where an employee successfully submitted your referral.
        </p>
      </div>

      {referralJobs.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No Referrals Logged Yet"
          description="When an insider agrees to refer you, mark the job as 'Referral Received' on the job detail page!"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {referralJobs.map((job) => {
            const jobContacts = contacts.filter((c) => c.jobPostingId === job.id);
            return (
              <Card key={job.id} className="p-6 space-y-4 border-emerald-200 dark:border-emerald-950 bg-emerald-50/20 dark:bg-emerald-950/10">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-stone-900 dark:text-stone-100">{job.jobTitle}</h3>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{job.companyName}</p>
                  </div>
                  <StatusPill status="REFERRAL_RECEIVED" />
                </div>

                <p className="text-xs text-stone-500">
                  Received on: {job.referralReceivedAt ? new Date(job.referralReceivedAt).toLocaleDateString() : 'N/A'}
                </p>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-stone-200 dark:border-stone-800">
                  <span className="text-stone-500">{jobContacts.length} contacts engaged</span>
                  <a
                    href={job.jobLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline inline-flex items-center space-x-1 font-medium"
                  >
                    <span>Job Link</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
