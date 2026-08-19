// =============================================================================
// RefLoop — HousekeepingService
// PRD §12: the automatic, read-only housekeeping pass.
// Never sends anything itself — only reads and writes local state.
// =============================================================================

import type {
  JobPosting,
  Contact,
  GlobalSettings,
} from '../domain/models.js';
import type {
  JobRepository,
  ContactRepository,
  SettingsRepository,
} from '../domain/repositories.js';
import type { Clock } from '../clock/Clock.js';
import { SchedulingService } from './SchedulingService.js';

export interface HousekeepingNotification {
  type: 'FOLLOW_UP_READY';
  contact: Contact;
  job: JobPosting;
  stage: 'FU1' | 'FU2';
}

export interface HousekeepingResult {
  /** Contacts that transitioned to READY_TO_SEND during this run */
  notifications: HousekeepingNotification[];
  /** Jobs that were auto-archived */
  archivedJobIds: string[];
  /** Number of sends today (for daily cap warning) */
  sentTodayCount: number;
  /** Whether the daily cap was exceeded */
  dailyCapExceeded: boolean;
}

export class HousekeepingService {
  private readonly scheduling: SchedulingService;

  constructor(
    private readonly jobs: JobRepository,
    private readonly contacts: ContactRepository,
    private readonly settings: SettingsRepository,
    private readonly clock: Clock,
  ) {
    this.scheduling = new SchedulingService(clock);
  }

  /**
   * Main housekeeping pass — implements PRD §12 algorithm.
   * @param acceptedLinkedInProfiles Set of LinkedIn profile URLs for 1st-degree connections
   */
  async run(acceptedLinkedInProfiles: Set<string>): Promise<HousekeepingResult> {
    const [allJobs, allContacts, settings] = await Promise.all([
      this.jobs.getAll(),
      this.contacts.getAll(),
      this.settings.get(),
    ]);

    const now = this.clock.now();
    const notifications: HousekeepingNotification[] = [];
    const archivedJobIds: string[] = [];

    // Group contacts by job for easier iteration
    const contactsByJob = new Map<string, Contact[]>();
    for (const c of allContacts) {
      const arr = contactsByJob.get(c.jobPostingId) ?? [];
      arr.push(c);
      contactsByJob.set(c.jobPostingId, arr);
    }

    // Process each ACTIVE job
    const activeJobs = allJobs.filter((j) => j.status === 'ACTIVE');

    for (const job of activeJobs) {
      const jobContacts = contactsByJob.get(job.id) ?? [];

      for (const contact of jobContacts) {
        await this.processContact(contact, job, settings, now, acceptedLinkedInProfiles, notifications);
      }

      // Reload contacts after mutations (they may have been updated above)
      const updatedJobContacts = await this.contacts.getByJobId(job.id);

      // Auto-archive check: all contacts must have removedAt set (and count > 0)
      // PRD §7.7 point 4, §8.9
      if (
        updatedJobContacts.length > 0 &&
        updatedJobContacts.every((c) => c.removedAt !== undefined)
      ) {
        await this.jobs.update(job.id, {
          status: 'ARCHIVED',
          archiveReason: 'AUTO_NO_ACTIVE_CONTACTS',
        });
        archivedJobIds.push(job.id);
      }
    }

    // Daily send cap check
    const sentTodayCount = this.countSentToday(allContacts, now);
    const dailyCapExceeded = sentTodayCount >= settings.dailySendCap;

    return { notifications, archivedJobIds, sentTodayCount, dailyCapExceeded };
  }

  /**
   * Count sends since midnight today (all stages, both channels).
   * PRD §13: dailySendCap is a SOFT WARNING ONLY.
   */
  countSentToday(contacts: Contact[], now: Date): number {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startMs = startOfDay.getTime();

    let count = 0;
    for (const c of contacts) {
      if (c.outreachMessageSentAt && new Date(c.outreachMessageSentAt).getTime() >= startMs) count++;
      if (c.followUp1SentAt && new Date(c.followUp1SentAt).getTime() >= startMs) count++;
      if (c.followUp2SentAt && new Date(c.followUp2SentAt).getTime() >= startMs) count++;
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Private — per-contact state machine
  // ---------------------------------------------------------------------------

  private async processContact(
    contact: Contact,
    job: JobPosting,
    settings: GlobalSettings,
    now: Date,
    acceptedProfiles: Set<string>,
    notifications: HousekeepingNotification[],
  ): Promise<void> {
    // Already fully resolved — nothing to do
    if (contact.removedAt) return;

    const patch: Partial<Contact> = {};

    // ---- LinkedIn PENDING checks ----
    if (contact.channel === 'LINKEDIN' && contact.connectionStatus === 'PENDING') {
      const sentAt = contact.connectionRequestSentAt
        ? new Date(contact.connectionRequestSentAt)
        : null;

      if (sentAt) {
        const daysSince = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSince >= settings.contactExpiryDays) {
          // EXPIRED: 14 days passed, still not accepted — PRD §7.7 point 1
          Object.assign(patch, {
            connectionStatus: 'EXPIRED',
            outreachMessageStatus: 'EXPIRED',
            removedAt: now.toISOString(),
          });
        } else if (
          contact.linkedinProfileUrl &&
          acceptedProfiles.has(this.normalizeProfileUrl(contact.linkedinProfileUrl))
        ) {
          Object.assign(patch, {
            connectionStatus: 'ACCEPTED',
            outreachMessageStatus: 'READY_TO_SEND',
          });
        }
      }
    }

    // ---- Auto-heal: LinkedIn contact is ACCEPTED but outreach status is still QUEUED ----
    if (
      contact.channel === 'LINKEDIN' &&
      contact.connectionStatus === 'ACCEPTED' &&
      contact.outreachMessageStatus === 'QUEUED'
    ) {
      Object.assign(patch, {
        outreachMessageStatus: 'READY_TO_SEND',
      });
    }

    // ---- Email expiry safety net — PRD §7.7 point 2 ----
    if (contact.channel === 'EMAIL' && contact.outreachMessageStatus === 'SENT') {
      const sentAt = contact.outreachMessageSentAt
        ? new Date(contact.outreachMessageSentAt)
        : null;
      if (sentAt) {
        const daysSince = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24);
        const fu2Done = [
          'SENT',
          'SKIPPED',
          'CANCELLED_BY_USER',
          'NOT_SCHEDULED',
        ].includes(contact.followUp2Status);

        if (daysSince >= settings.contactExpiryDays && fu2Done) {
          patch.removedAt = now.toISOString();
        }
      }
    }

    // ---- Follow-up 1 readiness — PRD §12 ----
    if (contact.followUp1Status === 'SCHEDULED' && contact.followUp1ScheduledFor) {
      if (now >= new Date(contact.followUp1ScheduledFor)) {
        patch.followUp1Status = 'READY_TO_SEND';
        notifications.push({ type: 'FOLLOW_UP_READY', contact, job, stage: 'FU1' });
      }
    }

    // ---- Follow-up 2 readiness — PRD §12 ----
    if (contact.followUp2Status === 'SCHEDULED' && contact.followUp2ScheduledFor) {
      if (now >= new Date(contact.followUp2ScheduledFor)) {
        patch.followUp2Status = 'READY_TO_SEND';
        notifications.push({ type: 'FOLLOW_UP_READY', contact, job, stage: 'FU2' });
      }
    }

    // ---- Mark as removed if all stages resolved ----
    if (!patch.removedAt && this.isFullyResolved({ ...contact, ...patch })) {
      patch.removedAt = now.toISOString();
    }

    if (Object.keys(patch).length > 0) {
      await this.contacts.update(contact.id, patch);
    }
  }

  /** True when a contact has no remaining work to do */
  private isFullyResolved(c: Contact): boolean {
    const outreachDone = ['SENT', 'EXPIRED', 'CANCELLED_BY_USER'].includes(
      c.outreachMessageStatus,
    );
    const fu1Done = ['SENT', 'SKIPPED', 'CANCELLED_BY_USER', 'NOT_SCHEDULED'].includes(
      c.followUp1Status,
    );
    const fu2Done = ['SENT', 'SKIPPED', 'CANCELLED_BY_USER', 'NOT_SCHEDULED'].includes(
      c.followUp2Status,
    );
    return outreachDone && fu1Done && fu2Done;
  }

  /**
   * Schedule the next follow-up after a stage completes.
   * Called by SendActionRunner after marking a stage SENT.
   */
  async scheduleNextFollowUp(
    contact: Contact,
    stage: 'OUTREACH' | 'FU1',
    sentAt: Date,
  ): Promise<void> {
    const settings = await this.settings.get();
    const patch: Partial<Contact> = {};

    if (stage === 'OUTREACH') {
      const scheduledFor = this.scheduling.scheduledAt(sentAt, settings.followUp1DelayDays, settings);
      patch.followUp1Status = 'SCHEDULED';
      patch.followUp1ScheduledFor = scheduledFor.toISOString();
    } else if (stage === 'FU1') {
      const scheduledFor = this.scheduling.scheduledAt(sentAt, settings.followUp2DelayDays, settings);
      patch.followUp2Status = 'SCHEDULED';
      patch.followUp2ScheduledFor = scheduledFor.toISOString();
    }

    if (Object.keys(patch).length > 0) {
      await this.contacts.update(contact.id, patch);
    }
  }

  /** Normalize a LinkedIn profile URL for comparison */
  private normalizeProfileUrl(url: string): string {
    try {
      const u = new URL(url);
      // Remove trailing slash, query params, hash — just keep the path
      return `${u.origin}${u.pathname.replace(/\/$/, '')}`;
    } catch {
      return url.toLowerCase().trim();
    }
  }
}
