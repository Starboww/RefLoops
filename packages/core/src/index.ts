// =============================================================================
// RefLoop — @refloop/core public API
// =============================================================================

// Domain models
export type {
  JobPosting,
  JobSourceType,
  JobStatus,
  ArchiveReason,
  ContactChannel,
  ConnectionStatus,
  OutreachMessageStatus,
  FollowUpStatus,
  EmailSource,
  Contact,
  GlobalSettings,
  UserAccount,
  Stage,
  AssembledMessage,
  NewJobInput,
  NewLinkedInContactInput,
  NewEmailContactInput,
} from './domain/models.js';

export { DEFAULT_SETTINGS } from './domain/models.js';

// Repository interfaces
export type {
  Unsubscribe,
  JobRepository,
  ContactRepository,
  SettingsRepository,
  UserAccountRepository,
} from './domain/repositories.js';

// Clock
export type { Clock } from './clock/Clock.js';
export { SystemClock, FixedClock } from './clock/Clock.js';

// Messages
export type { ExtensionMessage, MessageType, PasteAndSendMessage } from './messages/messages.js';
export { isExtensionMessage } from './messages/messages.js';

// Services
export { SchedulingService } from './services/SchedulingService.js';
export { MessageAssemblyService } from './services/MessageAssemblyService.js';
export {
  HousekeepingService,
  type HousekeepingResult,
  type HousekeepingNotification,
} from './services/HousekeepingService.js';
export {
  EmailPatternService,
  type NameParts,
  type RankedCandidate,
  type EmailTier,
} from './services/EmailPatternService.js';
export { FuzzySearchService } from './services/FuzzySearchService.js';
export {
  parseLinkedInAcceptanceEmail,
  findMatchingContacts,
  isLinkedInSender,
  type MatchResult,
} from './services/gmailLinkedInMatcher.js';
