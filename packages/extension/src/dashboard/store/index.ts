// =============================================================================
// RefLoop — Zustand Stores (Dashboard)
// Technical Design §3.4: In-memory mirror of chrome.storage.local data.
// Updated reactively via chrome.storage.onChanged subscriptions.
// =============================================================================

import { create } from 'zustand';
import { onKeyChanged } from '@refloop/storage-chrome';
import type {
  JobPosting,
  Contact,
  GlobalSettings,
  UserAccount,
} from '@refloop/core';
import { DEFAULT_SETTINGS } from '@refloop/core';

// ---------------------------------------------------------------------------
// Jobs Store
// ---------------------------------------------------------------------------

interface JobsState {
  jobs: JobPosting[];
  loading: boolean;
  setJobs: (jobs: JobPosting[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useJobsStore = create<JobsState>((set) => ({
  jobs: [],
  loading: true,
  setJobs: (jobs) => set({ jobs }),
  setLoading: (loading) => set({ loading }),
}));

// Subscribe to storage changes — keeps store in sync across contexts
onKeyChanged('jobs:v1', (newValue) => {
  useJobsStore.getState().setJobs((newValue as JobPosting[] | undefined) ?? []);
});

// ---------------------------------------------------------------------------
// Contacts Store
// ---------------------------------------------------------------------------

interface ContactsState {
  contacts: Contact[];
  loading: boolean;
  setContacts: (contacts: Contact[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useContactsStore = create<ContactsState>((set) => ({
  contacts: [],
  loading: true,
  setContacts: (contacts) => set({ contacts }),
  setLoading: (loading) => set({ loading }),
}));

onKeyChanged('contacts:v1', (newValue) => {
  useContactsStore.getState().setContacts((newValue as Contact[] | undefined) ?? []);
});

// ---------------------------------------------------------------------------
// Settings Store
// ---------------------------------------------------------------------------

interface SettingsState {
  settings: GlobalSettings;
  loading: boolean;
  setSettings: (settings: GlobalSettings) => void;
  setLoading: (loading: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  loading: true,
  setSettings: (settings) => set({ settings }),
  setLoading: (loading) => set({ loading }),
}));

onKeyChanged('settings:v1', (newValue) => {
  const stored = (newValue as Partial<GlobalSettings> | undefined) ?? {};
  useSettingsStore.getState().setSettings({ ...DEFAULT_SETTINGS, ...stored });
});

// ---------------------------------------------------------------------------
// Auth Store
// ---------------------------------------------------------------------------

interface AuthState {
  user: UserAccount | null;
  loading: boolean;
  setUser: (user: UserAccount | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}));

onKeyChanged('userAccount:v1', (newValue) => {
  useAuthStore.getState().setUser((newValue as UserAccount | null) ?? null);
});
