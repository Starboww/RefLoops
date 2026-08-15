import { describe, it, expect } from 'vitest';

interface BackupData {
  version?: number;
  exportedAt?: string;
  user?: any;
  jobs?: any[];
  contacts?: any[];
  settings?: any;
}

function validateAndParseBackup(jsonText: string): BackupData {
  let data: any;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid JSON file format.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup data format.');
  }

  const hasJobs = Array.isArray(data.jobs);
  const hasContacts = Array.isArray(data.contacts);
  const hasSettings = data.settings && typeof data.settings === 'object';
  const hasUser = data.user && typeof data.user === 'object';

  if (!hasJobs && !hasContacts && !hasSettings && !hasUser) {
    throw new Error('Backup file does not contain valid RefLoop data.');
  }

  return data as BackupData;
}

describe('Export / Import Validation', () => {
  it('validates a complete backup JSON', () => {
    const validJson = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      user: { email: 'user@example.com', name: 'Test User' },
      jobs: [{ id: 'job-1', companyName: 'Acme', jobTitle: 'Engineer' }],
      contacts: [{ id: 'c-1', firstName: 'John', jobPostingId: 'job-1' }],
      settings: { dailySendCap: 15 },
    });

    const parsed = validateAndParseBackup(validJson);
    expect(parsed.jobs?.length).toBe(1);
    expect(parsed.contacts?.length).toBe(1);
    expect(parsed.user.email).toBe('user@example.com');
    expect(parsed.settings.dailySendCap).toBe(15);
  });

  it('validates a backup with partial fields (e.g. only jobs)', () => {
    const json = JSON.stringify({
      jobs: [{ id: 'job-1', companyName: 'Acme', jobTitle: 'Engineer' }],
    });

    const parsed = validateAndParseBackup(json);
    expect(parsed.jobs?.length).toBe(1);
  });

  it('rejects invalid JSON syntax', () => {
    expect(() => validateAndParseBackup('not-a-json')).toThrow('Invalid JSON file format.');
  });

  it('rejects non-object JSON (e.g. numbers or strings)', () => {
    expect(() => validateAndParseBackup('12345')).toThrow('Invalid backup data format.');
  });

  it('rejects JSON with no RefLoop data', () => {
    const json = JSON.stringify({ foo: 'bar', baz: 123 });
    expect(() => validateAndParseBackup(json)).toThrow('Backup file does not contain valid RefLoop data.');
  });
});
