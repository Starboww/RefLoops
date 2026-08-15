// =============================================================================
// RefLoop — MessageAssemblyService
// PRD §8.2: Message assembly rule
// Strategy pattern: resolveFollowUpTemplate checks job override, falls back to global.
// =============================================================================

import type {
  JobPosting,
  Contact,
  GlobalSettings,
  AssembledMessage,
  Stage,
} from '../domain/models.js';

export class MessageAssemblyService {
  /**
   * Assemble the outreach (referral-ask) message for a given contact + job.
   * PRD §8.2: greeting + blank line + template body.
   * LinkedIn has no subject; Email has emailSubjectTemplate.
   */
  assembleOutreach(
    job: JobPosting,
    contact: Contact,
    settings: GlobalSettings,
    override?: string,
  ): AssembledMessage {
    const greeting = this.substituteFirstName(settings.greetingFormat, contact.firstName);
    const body =
      override ??
      contact.outreachMessageOverride ??
      (contact.channel === 'EMAIL'
        ? (job.emailMessageTemplate ?? job.referralMessageTemplate)
        : job.referralMessageTemplate);

    const assembled = `${greeting}\n\n${body}`;

    if (contact.channel === 'EMAIL') {
      const subject = job.emailSubjectTemplate
        ? this.substituteFirstName(job.emailSubjectTemplate, contact.firstName)
        : `Referral request — ${job.jobTitle} at ${job.companyName}`;
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
    const greeting = this.substituteFirstName(settings.greetingFormat, contact.firstName);
    const contactOverride =
      stage === 'FU1' ? contact.followUp1MessageOverride : contact.followUp2MessageOverride;
    const templateBody = override ?? contactOverride ?? this.resolveFollowUpTemplate(job, settings, stage);
    const assembled = `${greeting}\n\n${templateBody}`;

    if (contact.channel === 'EMAIL') {
      const subject = job.emailSubjectTemplate
        ? `Re: ${this.substituteFirstName(job.emailSubjectTemplate, contact.firstName)}`
        : `Re: Referral request — ${job.jobTitle} at ${job.companyName}`;
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
   * Preview all messages for a given job (used by the live preview panel in the Messages tab).
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private substituteFirstName(template: string, firstName: string): string {
    return template.replace(/\{\{firstName\}\}/g, firstName);
  }
}
