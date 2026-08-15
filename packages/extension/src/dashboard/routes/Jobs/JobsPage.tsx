import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, Calendar, ChevronRight, Briefcase, Trash2 } from 'lucide-react';
import { Button, Input, StatusPill, EmptyState, Card, ConfirmDialog } from '@refloop/ui';
import { useJobsStore, useContactsStore } from '../../store';
import { AddJobDialog } from './AddJobDialog';
import { deleteJob } from '../../services/appService';

export function JobsPage() {
  const navigate = useNavigate();
  const { jobs } = useJobsStore();
  const { contacts } = useContactsStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED' | 'REFERRAL_RECEIVED'>('ACTIVE');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const filteredJobs = jobs.filter((j) => {
    const matchesSearch =
      j.companyName.toLowerCase().includes(search.toLowerCase()) ||
      j.jobTitle.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' ? true : j.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1917] dark:text-stone-100">Job Postings</h1>
          <p className="text-sm text-[#78716C] dark:text-stone-400">
            Track jobs, manage outreach contacts, and monitor referral asks.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} variant="primary" className="space-x-2 shrink-0">
          <Plus className="h-4 w-4" />
          <span>Add Job Posting</span>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-stone-400" />
          <Input
            placeholder="Search company or job title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center space-x-1 bg-[#F4F0EA] dark:bg-stone-800 p-1 rounded-xl shrink-0 border border-[#E8E3DA] dark:border-stone-800">
          {(['ACTIVE', 'ALL', 'REFERRAL_RECEIVED', 'ARCHIVED'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === filter
                  ? 'bg-white dark:bg-stone-900 text-[#1C1917] dark:text-stone-100 shadow-xs font-bold'
                  : 'text-[#78716C] dark:text-stone-400 hover:text-[#1C1917] dark:hover:text-stone-100'
              }`}
            >
              {filter === 'ALL' ? 'All Jobs' : filter.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs found"
          description={
            search
              ? "No job postings matched your search criteria."
              : "Get started by adding your first target job posting."
          }
          actionLabel="Add Job Posting"
          onAction={() => setIsAddOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => {
            const jobContacts = contacts.filter((c) => c.jobPostingId === job.id);
            const readyCount = jobContacts.filter(
              (c) =>
                c.outreachMessageStatus === 'READY_TO_SEND' ||
                c.followUp1Status === 'READY_TO_SEND' ||
                c.followUp2Status === 'READY_TO_SEND'
            ).length;

            return (
              <Card
                key={job.id}
                className="group cursor-pointer hover:border-[#D97757] dark:hover:border-stone-700 transition-all hover:shadow-md flex flex-col justify-between"
              >
                <div className="p-5 space-y-3" onClick={() => navigate(`/jobs/${job.id}`)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-[#1C1917] dark:text-stone-100 group-hover:text-[#D97757] dark:group-hover:text-[#E06D53] transition-colors">
                        {job.jobTitle}
                      </h3>
                      <p className="text-sm font-semibold text-[#78716C] dark:text-stone-400">
                        {job.companyName}
                      </p>
                    </div>
                    <StatusPill status={job.status} />
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-[#78716C] dark:text-stone-400">
                    <div className="flex items-center space-x-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span>{jobContacts.length} contacts</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{new Date(job.dateAdded).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-[#E8E3DA] dark:border-stone-800/60 bg-[#FAF8F5]/50 dark:bg-stone-900/50 flex items-center justify-between text-xs rounded-b-2xl">
                  <div className="flex items-center space-x-2" onClick={() => navigate(`/jobs/${job.id}`)}>
                    {readyCount > 0 ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        <span>{readyCount} ready to send</span>
                      </span>
                    ) : (
                      <span className="text-stone-400">View details</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTargetId(job.id);
                    }}
                    className="p-1 text-stone-400 hover:text-rose-600 transition-colors"
                    title="Delete job"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AddJobDialog open={isAddOpen} onOpenChange={setIsAddOpen} />

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={() => setDeleteTargetId(null)}
        title="Delete Job Posting?"
        description="This will permanently delete this job posting and all associated contacts. This action cannot be undone."
        variant="danger"
        confirmLabel="Delete Job"
        onConfirm={async () => {
          if (deleteTargetId) {
            await deleteJob(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
      />
    </div>
  );
}
