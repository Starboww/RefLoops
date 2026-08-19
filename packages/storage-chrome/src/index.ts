// =============================================================================
// RefLoop — @refloop/storage-chrome public API
// Factory function creates all repositories and runs migrations on first call.
// Technical Design §3.6 (Factory pattern)
// =============================================================================

import { runMigrations } from './migrations/index.js';
import { ChromeJobRepository } from './ChromeJobRepository.js';
import { ChromeContactRepository } from './ChromeContactRepository.js';
import { ChromeSettingsRepository, ChromeUserAccountRepository } from './ChromeSettingsRepository.js';
import { ChromeGmailSyncRepository } from './ChromeGmailSyncRepository.js';

export type { Unsubscribe } from './changeBus.js';
export { ChromeJobRepository } from './ChromeJobRepository.js';
export { ChromeContactRepository } from './ChromeContactRepository.js';
export { ChromeSettingsRepository, ChromeUserAccountRepository } from './ChromeSettingsRepository.js';
export { ChromeGmailSyncRepository, type GmailSyncState, type UnmatchedAcceptance } from './ChromeGmailSyncRepository.js';
export { onKeyChanged, storageGet, storageSet, storageRemove } from './changeBus.js';
export { runMigrations } from './migrations/index.js';

export interface ChromeRepositories {
  jobs: ChromeJobRepository;
  contacts: ChromeContactRepository;
  settings: ChromeSettingsRepository;
  userAccount: ChromeUserAccountRepository;
  gmailSync: ChromeGmailSyncRepository;
}

let repositoriesInstance: ChromeRepositories | null = null;
let initPromise: Promise<ChromeRepositories> | null = null;

/**
 * Factory: creates (or returns existing) Chrome repository instances.
 * Runs schema migrations on first call before returning.
 * Technical Design §3.6: "Today it always returns the Chrome adapters;
 * later it branches on environment to return REST adapters instead."
 */
export async function createChromeRepositories(): Promise<ChromeRepositories> {
  if (repositoriesInstance) return repositoriesInstance;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    await runMigrations();
    repositoriesInstance = {
      jobs: new ChromeJobRepository(),
      contacts: new ChromeContactRepository(),
      settings: new ChromeSettingsRepository(),
      userAccount: new ChromeUserAccountRepository(),
      gmailSync: new ChromeGmailSyncRepository(),
    };
    return repositoriesInstance;
  })();

  return initPromise;
}
