import React, { useState } from 'react';
import { Button, Input, FormField, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@refloop/ui';
import { addJob } from '../../services/appService';

export function AddJobDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobLink, setJobLink] = useState('');
  const [sourceType, setSourceType] = useState<'EASY_APPLY' | 'COMPANY_SITE'>('COMPANY_SITE');
  const [companyLinkedInSlug, setCompanyLinkedInSlug] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !jobTitle || !jobLink) {
      setError('Company name, job title, and job link are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await addJob({
        companyName,
        jobTitle,
        jobLink,
        sourceType,
        companyLinkedInSlug: companyLinkedInSlug ? companyLinkedInSlug : undefined,
      });
      onOpenChange(false);
      setCompanyName('');
      setJobTitle('');
      setJobLink('');
      setCompanyLinkedInSlug('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Job Posting</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 py-2">
          {error && (
            <div className="p-3 text-xs rounded-md bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {error}
            </div>
          )}

          <FormField label="Company Name" required>
            <Input
              placeholder="e.g. Microsoft"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </FormField>

          <FormField label="Job Title" required>
            <Input
              placeholder="e.g. Senior Software Engineer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </FormField>

          <FormField label="Job Link (Canonical URL)" required helpText="The primary map key in RefLoop">
            <Input
              placeholder="https://..."
              value={jobLink}
              onChange={(e) => setJobLink(e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Source Type">
              <select
                className="flex h-9 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-stone-700 dark:bg-stone-900"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as 'EASY_APPLY' | 'COMPANY_SITE')}
              >
                <option value="COMPANY_SITE">Company Site / ATS</option>
                <option value="EASY_APPLY">LinkedIn Easy Apply</option>
              </select>
            </FormField>

            <FormField label="Company LinkedIn Slug" helpText="e.g. microsoft">
              <Input
                placeholder="microsoft"
                value={companyLinkedInSlug}
                onChange={(e) => setCompanyLinkedInSlug(e.target.value)}
              />
            </FormField>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={loading}>
              Add Job
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
