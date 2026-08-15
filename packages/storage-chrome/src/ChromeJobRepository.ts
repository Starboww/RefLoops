// =============================================================================
// RefLoop — ChromeJobRepository
// Implements JobRepository against chrome.storage.local.
// Key: 'jobs:v1'
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import type { JobRepository, Unsubscribe } from '@refloop/core';
import type { JobPosting } from '@refloop/core';
import { onKeyChanged, storageGet, storageSet } from './changeBus.js';

const KEY = 'jobs:v1';

export class ChromeJobRepository implements JobRepository {
  async getAll(): Promise<JobPosting[]> {
    return storageGet<JobPosting[]>(KEY, []);
  }

  async getById(id: string): Promise<JobPosting | null> {
    const jobs = await this.getAll();
    return jobs.find((j) => j.id === id) ?? null;
  }

  async create(job: Omit<JobPosting, 'id'>): Promise<JobPosting> {
    const jobs = await this.getAll();
    const newJob: JobPosting = { ...job, id: uuidv4() };
    await storageSet(KEY, [newJob, ...jobs]);
    return newJob;
  }

  async update(id: string, patch: Partial<JobPosting>): Promise<JobPosting> {
    const jobs = await this.getAll();
    const idx = jobs.findIndex((j) => j.id === id);
    if (idx === -1) throw new Error(`Job not found: ${id}`);
    const updated = { ...jobs[idx]!, ...patch };
    jobs[idx] = updated;
    await storageSet(KEY, jobs);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const jobs = await this.getAll();
    await storageSet(KEY, jobs.filter((j) => j.id !== id));
  }

  onChange(cb: (jobs: JobPosting[]) => void): Unsubscribe {
    return onKeyChanged(KEY, (value) => {
      cb((value as JobPosting[] | undefined) ?? []);
    });
  }
}
