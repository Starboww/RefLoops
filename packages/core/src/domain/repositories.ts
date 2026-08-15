// =============================================================================
// RefLoop — Repository Interfaces ("ports" in Hexagonal Architecture)
// PRD §6, Technical Design §3.2
// Business logic never imports chrome.* directly — only these interfaces.
// =============================================================================

import type {
  JobPosting,
  Contact,
  GlobalSettings,
  UserAccount,
} from './models.js';

export type Unsubscribe = () => void;

// ---------------------------------------------------------------------------
// JobRepository
// ---------------------------------------------------------------------------

export interface JobRepository {
  getAll(): Promise<JobPosting[]>;
  getById(id: string): Promise<JobPosting | null>;
  create(job: Omit<JobPosting, 'id'>): Promise<JobPosting>;
  update(id: string, patch: Partial<JobPosting>): Promise<JobPosting>;
  delete(id: string): Promise<void>;
  /** Subscribe to changes — returns unsubscribe function */
  onChange(cb: (jobs: JobPosting[]) => void): Unsubscribe;
}

// ---------------------------------------------------------------------------
// ContactRepository
// ---------------------------------------------------------------------------

export interface ContactRepository {
  getAll(): Promise<Contact[]>;
  getByJobId(jobId: string): Promise<Contact[]>;
  create(contact: Omit<Contact, 'id'>): Promise<Contact>;
  update(id: string, patch: Partial<Contact>): Promise<Contact>;
  delete(id: string): Promise<void>;
  onChange(cb: (contacts: Contact[]) => void): Unsubscribe;
}

// ---------------------------------------------------------------------------
// SettingsRepository
// ---------------------------------------------------------------------------

export interface SettingsRepository {
  get(): Promise<GlobalSettings>;
  update(patch: Partial<GlobalSettings>): Promise<GlobalSettings>;
}

// ---------------------------------------------------------------------------
// UserAccountRepository
// ---------------------------------------------------------------------------

export interface UserAccountRepository {
  get(): Promise<UserAccount | null>;
  set(account: UserAccount): Promise<void>;
  clear(): Promise<void>;
}
