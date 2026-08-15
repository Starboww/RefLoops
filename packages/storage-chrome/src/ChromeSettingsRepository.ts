// =============================================================================
// RefLoop — ChromeSettingsRepository
// get() merges stored settings with DEFAULT_SETTINGS so new fields always
// have sensible defaults — critical for extension updates that add fields.
// =============================================================================

import type { SettingsRepository } from '@refloop/core';
import type { GlobalSettings } from '@refloop/core';
import { DEFAULT_SETTINGS } from '@refloop/core';
import { storageGet, storageSet } from './changeBus.js';

const KEY = 'settings:v1';

export class ChromeSettingsRepository implements SettingsRepository {
  async get(): Promise<GlobalSettings> {
    const stored = await storageGet<Partial<GlobalSettings>>(KEY, {});
    // Always merge with defaults so newly added fields appear automatically
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async update(patch: Partial<GlobalSettings>): Promise<GlobalSettings> {
    const current = await this.get();
    const updated = { ...current, ...patch };
    await storageSet(KEY, updated);
    return updated;
  }
}

// =============================================================================
// ChromeUserAccountRepository
// =============================================================================

import type { UserAccountRepository } from '@refloop/core';
import type { UserAccount } from '@refloop/core';
import { storageRemove } from './changeBus.js';

const UA_KEY = 'userAccount:v1';

export class ChromeUserAccountRepository implements UserAccountRepository {
  async get(): Promise<UserAccount | null> {
    return storageGet<UserAccount | null>(UA_KEY, null);
  }

  async set(account: UserAccount): Promise<void> {
    await storageSet(UA_KEY, account);
  }

  async clear(): Promise<void> {
    await storageRemove(UA_KEY);
  }
}
