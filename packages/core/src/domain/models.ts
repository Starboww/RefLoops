// =============================================================================
// RefLoop — Domain Models
// PRD §6: Data model — all interfaces and enums
// =============================================================================

export type JobSourceType = 'EASY_APPLY' | 'COMPANY_SITE';

export type JobStatus = 'ACTIVE' | 'ARCHIVED' | 'CLOSED' | 'REFERRAL_RECEIVED';

export type ArchiveReason = 'MANUAL' | 'AUTO_NO_ACTIVE_CONTACTS';

export interface JobPosting {
  id: string; // uuid, primary key
  jobLink: string; // canonical URL — the "map key"
  sourceType: JobSourceType;
  companyName: string; // display name, editable
  companyLinkedInSlug?: string | undefined; // e.g. "microsoft" — used to filter LinkedIn People search
  jobTitle: string;
  companyJobId?: string | undefined; // ATS requisition ID, for COMPANY_SITE postings
  companyApplyUrl?: string | undefined; // if different from jobLink
  dateAdded: string; // ISO 8601 datetime
  status: JobStatus;
  archiveReason?: ArchiveReason | undefined;
  referralReceivedAt?: string | undefined;

  // Message templates
  referralMessageTemplate: string; // LinkedIn referral-ask body — NO greeting line
  emailMessageTemplate?: string | undefined; // Email referral-ask body
  emailSubjectTemplate?: string | undefined; // Email subject — not needed for LinkedIn

  // Per-job follow-up overrides — unset = inherit GlobalSettings
  followUp1TemplateOverride?: string | undefined;
  followUp2TemplateOverride?: string | undefined;
}

export type ContactChannel = 'LINKEDIN' | 'EMAIL';

export type ConnectionStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'DECLINED_OR_REMOVED' | 'REVIEW_REQUIRED';

export type OutreachMessageStatus =
  | 'QUEUED'
  | 'READY_TO_SEND'
  | 'SENT'
  | 'EXPIRED'
  | 'CANCELLED_BY_USER';

export type FollowUpStatus =
  | 'NOT_SCHEDULED'
  | 'SCHEDULED'
  | 'READY_TO_SEND'
  | 'SENT'
  | 'SKIPPED'
  | 'CANCELLED_BY_USER';

export type EmailSource = 'GENERATED' | 'MANUAL';

export interface Contact {
  id: string;
  jobPostingId: string;
  channel: ContactChannel;
  firstName: string;

  // ---- LinkedIn-only ----
  linkedinProfileUrl?: string | undefined;
  fullNameRaw?: string | undefined;
  connectionRequestSentAt?: string | undefined;
  connectionStatus?: ConnectionStatus | undefined;
  connectionAcceptedAt?: string | undefined;         // ISO 8601 — when acceptance was detected via Gmail
  acceptanceGmailMessageId?: string | undefined;     // Gmail message ID that triggered the update (dedupe key)

  // ---- Email-only ----
  emailAddress?: string | undefined;
  emailSource?: EmailSource | undefined;
  emailAddedAt?: string | undefined;

  // ---- Shared across both channels ----
  outreachMessageStatus: OutreachMessageStatus;
  outreachMessageSentAt?: string | undefined;

  followUp1Status: FollowUpStatus;
  followUp1ScheduledFor?: string | undefined;
  followUp1SentAt?: string | undefined;

  followUp2Status: FollowUpStatus;
  followUp2ScheduledFor?: string | undefined;
  followUp2SentAt?: string | undefined;

  removedAt?: string | undefined;

  outreachMessageOverride?: string | undefined;
  followUp1MessageOverride?: string | undefined;
  followUp2MessageOverride?: string | undefined;

  snoozedUntil?: string | undefined;
}

export interface GlobalSettings {
  contactExpiryDays: number;
  followUp1DelayDays: number;
  followUp2DelayDays: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  activeDays: number[];
  greetingFormat: string;
  followUp1Template: string;
  followUp2Template: string;
  dailySendCap: number;
  interMessageDelaySeconds: [number, number];

  // User profile & template variables
  myCurrentTitle?: string | undefined;
  yearsOfExperience?: string | undefined;
  customVariables?: Record<string, string> | undefined;

  // Pro Mode — Gmail acceptance detection
  proModeEnabled: boolean;
  gmailSyncEnabled: boolean;
  gmailSyncIntervalHours: number;                    // 1–24, default 1
  gmailLinkedInNotificationPromptShown: boolean;     // one-time LinkedIn notification setup checklist
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  contactExpiryDays: 14,
  followUp1DelayDays: 5,
  followUp2DelayDays: 7,
  sendWindowStart: '09:00',
  sendWindowEnd: '10:00',
  activeDays: [1, 2, 3, 4, 5],
  greetingFormat: 'Hi {{firstName}},',
  followUp1Template:
    "Just wanted to follow up on my previous message. I'm very excited about the opportunity for {{jobTitle}} at {{companyName}} and would love to learn more about your experience there. Would you be open to a quick chat?\n\nThanks so much!",
  followUp2Template:
    "I hope I'm not being too persistent — I know you're busy! This is my last follow-up regarding the {{jobTitle}} role at {{companyName}}. If the timing isn't right, no worries at all. I'd still love to connect whenever it works for you.\n\nThanks for your time!",
  dailySendCap: 15,
  interMessageDelaySeconds: [30, 180],

  // User profile & template variables
  myCurrentTitle: '',
  yearsOfExperience: '',
  customVariables: {},

  // Pro Mode — Gmail acceptance detection
  proModeEnabled: false,
  gmailSyncEnabled: false,
  gmailSyncIntervalHours: 1,
  gmailLinkedInNotificationPromptShown: false,
};

export interface UserAccount {
  googleId: string;
  email: string;
  displayName?: string | undefined;
  photoUrl?: string | undefined;
  signedInAt: string;
}

export type Stage = 'OUTREACH' | 'FU1' | 'FU2';

export interface AssembledMessage {
  subject?: string | undefined;
  body: string;
}

export interface NewJobInput {
  jobLink: string;
  sourceType: JobSourceType;
  companyName: string;
  companyLinkedInSlug?: string | undefined;
  jobTitle: string;
  companyJobId?: string | undefined;
  companyApplyUrl?: string | undefined;
}

export interface NewLinkedInContactInput {
  jobPostingId: string;
  linkedinProfileUrl: string;
  firstName: string;
  fullNameRaw?: string | undefined;
  connectionRequestSentAt?: string | undefined;
}

export interface NewEmailContactInput {
  jobPostingId: string;
  firstName: string;
  emailAddress: string;
  emailSource: EmailSource;
}
