// =============================================================================
// RefLoop — Schema Migrations
// Technical Design §3.9: schemaVersion + ordered migration functions.
// Run on load before any read to keep data consistent across extension updates.
// =============================================================================

import { storageGet, storageSet } from '../changeBus.js';

const SCHEMA_VERSION_KEY = 'schemaVersion';
const CURRENT_VERSION = 4;

type MigrationFn = () => Promise<void>;

/** Ordered migrations — index = version they migrate TO (1-indexed) */
const MIGRATIONS: MigrationFn[] = [
  // v1 → v2: backfill channel: 'LINKEDIN' on existing contacts
  async () => {
    const contacts = await storageGet<unknown[]>('contacts:v1', []);
    const updated = contacts.map((c) => {
      const contact = c as Record<string, unknown>;
      if (!('channel' in contact)) {
        contact['channel'] = 'LINKEDIN';
      }
      return contact;
    });
    await storageSet('contacts:v1', updated);
  },

  // v2 → v3: backfill followUp1Status/followUp2Status defaults on existing contacts
  async () => {
    const contacts = await storageGet<unknown[]>('contacts:v1', []);
    const updated = contacts.map((c) => {
      const contact = c as Record<string, unknown>;
      if (!('followUp1Status' in contact)) {
        contact['followUp1Status'] = 'NOT_SCHEDULED';
      }
      if (!('followUp2Status' in contact)) {
        contact['followUp2Status'] = 'NOT_SCHEDULED';
      }
      return contact;
    });
    await storageSet('contacts:v1', updated);
  },

  // v3 → v4: backfill Pro Mode / Gmail sync fields onto existing stored settings
  async () => {
    const settings = await storageGet<Record<string, unknown>>('settings:v1', {});
    let changed = false;
    if (!('proModeEnabled' in settings)) { settings['proModeEnabled'] = false; changed = true; }
    if (!('gmailSyncEnabled' in settings)) { settings['gmailSyncEnabled'] = false; changed = true; }
    if (!('gmailSyncIntervalHours' in settings)) { settings['gmailSyncIntervalHours'] = 1; changed = true; }
    if (!('gmailLinkedInNotificationPromptShown' in settings)) {
      settings['gmailLinkedInNotificationPromptShown'] = false;
      changed = true;
    }
    if (changed) await storageSet('settings:v1', settings);
  },
];

/**
 * Run all pending migrations from storedVersion → CURRENT_VERSION.
 * Safe to call multiple times — skips already-applied migrations.
 */
export async function runMigrations(): Promise<void> {
  const storedVersion = await storageGet<number>(SCHEMA_VERSION_KEY, 0);

  if (storedVersion >= CURRENT_VERSION) return;

  for (let v = storedVersion; v < CURRENT_VERSION; v++) {
    const migration = MIGRATIONS[v];
    if (migration) {
      await migration();
    }
  }

  await storageSet(SCHEMA_VERSION_KEY, CURRENT_VERSION);
}
