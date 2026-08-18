// =============================================================================
// RefLoop — MessageAssemblyService
// PRD §8.2: Message assembly rule
// Strategy pattern: resolveFollowUpTemplate checks job override, falls back to global.
// Supports dynamic template variables: {{jobTitle}}, {{companyName}}, {{firstName}},
// {{myCurrentTitle}}, {{yearsOfExperience}}, and custom user variables.
// =============================================================================

import type {
  JobPosting,
  Contact,
  GlobalSettings,
  AssembledMessage,
  Stage,
} from '../domain/models.js';

export interface DetectedVariable {
  raw: string;
  name: string;
  source: 'contact' | 'job' | 'sender' | 'custom' | 'unknown';
  value: string | undefined;
  isFilled: boolean;
}

/**
 * Replace all template variables ({{var}} or {var}) using job, contact, and settings context.
 */
export function substituteTemplateVariables(
  template: string,
  job?: Partial<JobPosting> | null,
  contact?: Partial<Contact> | null,
  settings?: Partial<GlobalSettings> | null,
  options?: { highlightMissing?: boolean },
): string {
  if (!template) return '';

  const valuesMap = new Map<string, string>();

  // Contact values
  if (contact?.firstName) {
    valuesMap.set('firstname', contact.firstName);
  }

  // Job values
  if (job?.jobTitle) {
    valuesMap.set('jobtitle', job.jobTitle);
  }
  if (job?.companyName) {
    valuesMap.set('companyname', job.companyName);
  }

  // Sender profile values
  if (settings?.myCurrentTitle) {
    valuesMap.set('mycurrenttitle', settings.myCurrentTitle);
  }
  if (settings?.yearsOfExperience) {
    valuesMap.set('yearsofexperience', settings.yearsOfExperience);
    valuesMap.set('yearofexperience', settings.yearsOfExperience);
  }

  // Custom variables
  if (settings?.customVariables) {
    for (const [key, val] of Object.entries(settings.customVariables)) {
      if (val) {
        valuesMap.set(key.toLowerCase().trim(), val);
      }
    }
  }

  return template.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{\s*([a-zA-Z0-9_]+)\s*\}/g,
    (match, p1, p2) => {
      const rawKey = p1 || p2;
      const normalizedKey = rawKey.toLowerCase().trim();

      if (valuesMap.has(normalizedKey)) {
        return valuesMap.get(normalizedKey)!;
      }
      if (options?.highlightMissing) {
        return `[⚠️ Set ${rawKey} in settings]`;
      }
      return match;
    },
  );
}

/**
 * Detect all template variables referenced in a string and return their fill status.
 */
export function detectTemplateVariables(
  template: string,
  context: {
    job?: Partial<JobPosting> | null;
    contact?: Partial<Contact> | null;
    settings?: Partial<GlobalSettings> | null;
  },
): DetectedVariable[] {
  if (!template) return [];

  const matches = Array.from(
    template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{\s*([a-zA-Z0-9_]+)\s*\}/g),
  );
  const seen = new Set<string>();
  const result: DetectedVariable[] = [];

  for (const m of matches) {
    const name = m[1] || m[2];
    const norm = name.toLowerCase().trim();
    if (seen.has(norm)) continue;
    seen.add(norm);

    let source: DetectedVariable['source'] = 'unknown';
    let value: string | undefined = undefined;

    if (norm === 'firstname') {
      source = 'contact';
      value = context.contact?.firstName;
    } else if (norm === 'jobtitle') {
      source = 'job';
      value = context.job?.jobTitle;
    } else if (norm === 'companyname') {
      source = 'job';
      value = context.job?.companyName;
    } else if (norm === 'mycurrenttitle') {
      source = 'sender';
      value = context.settings?.myCurrentTitle;
    } else if (norm === 'yearsofexperience' || norm === 'yearofexperience') {
      source = 'sender';
      value = context.settings?.yearsOfExperience;
    } else if (context.settings?.customVariables) {
      const customKey = Object.keys(context.settings.customVariables).find(
        (k) => k.toLowerCase().trim() === norm,
      );
      if (customKey) {
        source = 'custom';
        value = context.settings.customVariables[customKey];
      }
    }

    const isFilled = typeof value === 'string' && value.trim().length > 0;

    result.push({
      raw: m[0],
      name,
      source,
      value,
      isFilled,
    });
  }

  return result;
}

export interface TemplateValidationResult {
  hasDuplicateGreeting: boolean;
  duplicateGreetingSnippet?: string | undefined;
  hasMissingName: boolean;
  unfilledVariables: DetectedVariable[];
  allVariables: DetectedVariable[];
  warnings: string[];
}

/**
 * Validate message template and greeting for common pitfalls like duplicate greetings,
 * missing contact names, and unfilled variables.
 */
export function validateMessageTemplate(
  templateBody: string,
  greetingFormat?: string | null,
  context?: {
    job?: Partial<JobPosting> | null;
    contact?: Partial<Contact> | null;
    settings?: Partial<GlobalSettings> | null;
  },
): TemplateValidationResult {
  const warnings: string[] = [];
  const ctx = context ?? {};

  // 1. Detect variables across greeting and body
  const combinedText = `${greetingFormat ?? ''} ${templateBody ?? ''}`;
  const allVariables = detectTemplateVariables(combinedText, ctx);
  const unfilledVariables = allVariables.filter((v) => !v.isFilled);

  if (unfilledVariables.length > 0) {
    const varNames = unfilledVariables.map((v) => `{{${v.name}}}`).join(', ');
    warnings.push(`Unfilled variable(s) detected: ${varNames}. Please configure their values.`);
  }

  // 2. Missing recipient name check
  let hasMissingName = false;
  const usesFirstName = /\{\{\s*firstname\s*\}\}|\{\s*firstname\s*\}/i.test(combinedText);
  if (usesFirstName && (!ctx.contact?.firstName || !ctx.contact.firstName.trim())) {
    hasMissingName = true;
    warnings.push('Recipient first name is missing or empty.');
  }

  // 3. Duplicate greeting detection
  let hasDuplicateGreeting = false;
  let duplicateGreetingSnippet: string | undefined = undefined;

  const trimmedBody = (templateBody || '').trim();
  const trimmedGreeting = (greetingFormat || '').trim();

  if (trimmedGreeting && trimmedBody) {
    // Check if the body itself starts with a common greeting phrase
    const greetingMatch = trimmedBody.match(
      /^(hi|hello|hey|dear|greetings|good\s+(morning|afternoon|evening))\b[^\n\r,]*/i,
    );
    if (greetingMatch) {
      hasDuplicateGreeting = true;
      duplicateGreetingSnippet = greetingMatch[0];
      warnings.push(
        `Duplicate greeting: Your message body already starts with "${duplicateGreetingSnippet}". RefLoop automatically prepends the greeting format.`,
      );
    }
  }

  return {
    hasDuplicateGreeting,
    duplicateGreetingSnippet,
    hasMissingName,
    unfilledVariables,
    allVariables,
    warnings,
  };
}

export class MessageAssemblyService {
  /**
   * Assemble the outreach (referral-ask) message for a given contact + job.
   */
  assembleOutreach(
    job: JobPosting,
    contact: Contact,
    settings: GlobalSettings,
    override?: string,
  ): AssembledMessage {
    const greeting = substituteTemplateVariables(settings.greetingFormat, job, contact, settings);
    const rawBody =
      override ??
      contact.outreachMessageOverride ??
      (contact.channel === 'EMAIL'
        ? (job.emailMessageTemplate ?? job.referralMessageTemplate)
        : job.referralMessageTemplate);

    const body = substituteTemplateVariables(rawBody, job, contact, settings);
    const assembled = greeting ? `${greeting}\n\n${body}` : body;

    if (contact.channel === 'EMAIL') {
      const rawSubject =
        job.emailSubjectTemplate ?? `Referral request — ${job.jobTitle} at ${job.companyName}`;
      const subject = substituteTemplateVariables(rawSubject, job, contact, settings);
      return { subject, body: assembled };
    }

    return { body: assembled };
  }

  /**
   * Resolve the follow-up template body for a given stage.
   * Strategy pattern: job override wins, else global default (PRD §7.6).
   */
  resolveFollowUpTemplate(
    job: JobPosting,
    settings: GlobalSettings,
    stage: 'FU1' | 'FU2',
  ): string {
    if (stage === 'FU1') {
      return job.followUp1TemplateOverride ?? settings.followUp1Template;
    }
    return job.followUp2TemplateOverride ?? settings.followUp2Template;
  }

  /**
   * Assemble a follow-up message (FU1 or FU2) for a given contact + job.
   */
  assembleFollowUp(
    job: JobPosting,
    contact: Contact,
    settings: GlobalSettings,
    stage: 'FU1' | 'FU2',
    override?: string,
  ): AssembledMessage {
    const greeting = substituteTemplateVariables(settings.greetingFormat, job, contact, settings);
    const contactOverride =
      stage === 'FU1' ? contact.followUp1MessageOverride : contact.followUp2MessageOverride;
    const rawTemplateBody =
      override ?? contactOverride ?? this.resolveFollowUpTemplate(job, settings, stage);

    const templateBody = substituteTemplateVariables(rawTemplateBody, job, contact, settings);
    const assembled = greeting ? `${greeting}\n\n${templateBody}` : templateBody;

    if (contact.channel === 'EMAIL') {
      const rawSubject = job.emailSubjectTemplate
        ? `Re: ${job.emailSubjectTemplate}`
        : `Re: Referral request — ${job.jobTitle} at ${job.companyName}`;
      const subject = substituteTemplateVariables(rawSubject, job, contact, settings);
      return { subject, body: assembled };
    }

    return { body: assembled };
  }

  /**
   * General-purpose assemble function — dispatches to outreach or follow-up.
   */
  assemble(
    stage: Stage,
    job: JobPosting,
    contact: Contact,
    settings: GlobalSettings,
    override?: string,
  ): AssembledMessage {
    if (stage === 'OUTREACH') {
      return this.assembleOutreach(job, contact, settings, override);
    }
    return this.assembleFollowUp(job, contact, settings, stage === 'FU1' ? 'FU1' : 'FU2', override);
  }

  /**
   * Preview all messages for a given job.
   */
  previewAll(
    job: JobPosting,
    contacts: Contact[],
    settings: GlobalSettings,
    stage: Stage,
  ): Array<{ contact: Contact; message: AssembledMessage }> {
    return contacts
      .filter((c) => c.jobPostingId === job.id)
      .map((contact) => ({
        contact,
        message: this.assemble(stage, job, contact, settings),
      }));
  }
}
