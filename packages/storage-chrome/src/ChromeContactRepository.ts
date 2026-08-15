// =============================================================================
// RefLoop — ChromeContactRepository
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import type { ContactRepository, Unsubscribe } from '@refloop/core';
import type { Contact } from '@refloop/core';
import { onKeyChanged, storageGet, storageSet } from './changeBus.js';

const KEY = 'contacts:v1';

export class ChromeContactRepository implements ContactRepository {
  async getAll(): Promise<Contact[]> {
    return storageGet<Contact[]>(KEY, []);
  }

  async getByJobId(jobId: string): Promise<Contact[]> {
    const all = await this.getAll();
    return all.filter((c) => c.jobPostingId === jobId);
  }

  async create(contact: Omit<Contact, 'id'>): Promise<Contact> {
    const contacts = await this.getAll();
    const newContact: Contact = { ...contact, id: uuidv4() };
    await storageSet(KEY, [...contacts, newContact]);
    return newContact;
  }

  async update(id: string, patch: Partial<Contact>): Promise<Contact> {
    const contacts = await this.getAll();
    const idx = contacts.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`Contact not found: ${id}`);
    const updated = { ...contacts[idx]!, ...patch };
    contacts[idx] = updated;
    await storageSet(KEY, contacts);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const contacts = await this.getAll();
    await storageSet(KEY, contacts.filter((c) => c.id !== id));
  }

  onChange(cb: (contacts: Contact[]) => void): Unsubscribe {
    return onKeyChanged(KEY, (value) => {
      cb((value as Contact[] | undefined) ?? []);
    });
  }
}
