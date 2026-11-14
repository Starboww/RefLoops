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
          <h1 className="heading-md">Job Postings</h1>
          <p className="text-regular-sm text-[#C1C6CD] mt-1">
            Track target roles, manage outreach contacts, and monitor referral asks.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} variant="primary" className="space-x-2 shrink-0">
          <Plus className="h-4 w-4" />
          <span>Add Job Posting</span>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#8A919D]" />
          <Input
            placeholder="Search company or job title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#1F2228] border-white/10 text-white placeholder:text-[#5F646D]"
          />
        </div>
        <div className="flex items-center space-x-1 bg-[#1F2228] p-1 rounded-xl shrink-0 border border-white/10">
          {(['ACTIVE', 'ALL', 'REFERRAL_RECEIVED', 'ARCHIVED'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === filter
                  ? 'bg-[#292E35] text-white shadow-xs font-semibold border border-white/10'
                  : 'text-[#8A919D] hover:text-white'
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
                className="group cursor-pointer hover:border-white/25 transition-all hover:shadow-lg flex flex-col justify-between"
              >
                <div className="p-5 space-y-3" onClick={() => navigate(`/jobs/${job.id}`)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-heading font-bold text-white group-hover:text-[#FF3C6B] transition-colors leading-snug">
                        {job.jobTitle}
                      </h3>
                      <p className="text-xs font-medium text-[#C1C6CD] mt-0.5">
                        {job.companyName}
                      </p>
                    </div>
                    <StatusPill status={job.status} />
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-[#8A919D]">
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

                <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs rounded-b-xl">
                  <div className="flex items-center space-x-2" onClick={() => navigate(`/jobs/${job.id}`)}>
                    {readyCount > 0 ? (
                      <span className="font-semibold text-[#0BDFC5] flex items-center space-x-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#0BDFC5] animate-pulse inline-block" />
                        <span>{readyCount} ready to send</span>
                      </span>
                    ) : (
                      <span className="text-[#8A919D]">View details</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-[#8A919D] group-hover:translate-x-0.5 transition-transform" />
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTargetId(job.id);
                    }}
                    className="p-1 text-[#8A919D] hover:text-[#DD2C61] transition-colors"
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
