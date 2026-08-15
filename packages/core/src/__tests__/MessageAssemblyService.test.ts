import { describe, it, expect } from 'vitest';
import {
  MessageAssemblyService,
  substituteTemplateVariables,
  detectTemplateVariables,
  validateMessageTemplate,
} from '../services/MessageAssemblyService.js';
import { DEFAULT_SETTINGS, type JobPosting, type Contact } from '../domain/models.js';

describe('MessageAssemblyService & Template Variables', () => {
  const sampleJob: JobPosting = {
    id: 'job-1',
    jobLink: 'https://linkedin.com/jobs/view/12345',
    sourceType: 'EASY_APPLY',
    companyName: 'Acme Corp',
    jobTitle: 'Senior Software Engineer',
    status: 'ACTIVE',
    dateAdded: '2026-08-15T00:00:00.000Z',
    referralMessageTemplate:
      "I saw the {{jobTitle}} opening at {{companyName}} and would love to connect! My title is {{myCurrentTitle}}.",
  };

  const sampleContact: Contact = {
    id: 'contact-1',
    jobPostingId: 'job-1',
    channel: 'LINKEDIN',
    firstName: 'Alex',
    outreachMessageStatus: 'READY_TO_SEND',
    followUp1Status: 'NOT_SCHEDULED',
    followUp2Status: 'NOT_SCHEDULED',
    connectionStatus: 'ACCEPTED',
  };

  const sampleSettings = {
    ...DEFAULT_SETTINGS,
    myCurrentTitle: 'Staff Developer',
    yearsOfExperience: '6 years',
    customVariables: {
      portfolioUrl: 'https://alex.dev',
    },
  };

  it('substitutes {{jobTitle}}, {{companyName}}, {{firstName}}, {{myCurrentTitle}}, {{yearsOfExperience}}, and custom variables', () => {
    const template =
      'Hi {{firstName}}, I am applying for {{jobTitle}} at {{companyName}}. I have {{yearsOfExperience}} of exp. Current: {{myCurrentTitle}}. Portfolio: {{portfolioUrl}}.';
    const result = substituteTemplateVariables(template, sampleJob, sampleContact, sampleSettings);

    expect(result).toBe(
      'Hi Alex, I am applying for Senior Software Engineer at Acme Corp. I have 6 years of exp. Current: Staff Developer. Portfolio: https://alex.dev.',
    );
  });

  it('handles single curly braces {jobTitle} and whitespace {{ jobTitle }}', () => {
    const template = 'Role: {jobTitle} at {{ companyName }}';
    const result = substituteTemplateVariables(template, sampleJob, sampleContact, sampleSettings);

    expect(result).toBe('Role: Senior Software Engineer at Acme Corp');
  });

  it('detects variables and reports fill status', () => {
    const template = 'Hi {{firstName}}, applying for {{jobTitle}} at {{companyName}}. {{missingVar}}';
    const detected = detectTemplateVariables(template, {
      job: sampleJob,
      contact: sampleContact,
      settings: sampleSettings,
    });

    expect(detected).toHaveLength(4);
    expect(detected.find((v) => v.name === 'jobTitle')?.isFilled).toBe(true);
    expect(detected.find((v) => v.name === 'companyName')?.isFilled).toBe(true);
    expect(detected.find((v) => v.name === 'missingVar')?.isFilled).toBe(false);
  });

  it('assembles outreach message with full variable substitution', () => {
    const assembler = new MessageAssemblyService();
    const assembled = assembler.assembleOutreach(sampleJob, sampleContact, sampleSettings);

    expect(assembled.body).toContain('Hi Alex,');
    expect(assembled.body).toContain('Senior Software Engineer');
    expect(assembled.body).toContain('Acme Corp');
    expect(assembled.body).toContain('Staff Developer');
  });

  it('assembles follow-up 1 message with replaced {{jobTitle}} and {{companyName}}', () => {
    const assembler = new MessageAssemblyService();
    const assembled = assembler.assembleFollowUp(sampleJob, sampleContact, sampleSettings, 'FU1');

    expect(assembled.body).toContain('Hi Alex,');
    expect(assembled.body).toContain('Senior Software Engineer');
    expect(assembled.body).toContain('Acme Corp');
    expect(assembled.body).not.toContain('{{jobTitle}}');
  });

  describe('validateMessageTemplate', () => {
    it('detects duplicate greetings when message body starts with Hi/Hello', () => {
      const result = validateMessageTemplate(
        'Hi Alex,\n\nI wanted to follow up on my previous message.',
        'Hi {{firstName}},',
        { job: sampleJob, contact: sampleContact, settings: sampleSettings },
      );

      expect(result.hasDuplicateGreeting).toBe(true);
      expect(result.duplicateGreetingSnippet).toBe('Hi Alex');
      expect(result.warnings.some((w) => w.includes('Duplicate greeting'))).toBe(true);
    });

    it('does not flag duplicate greeting when body is clean of greeting phrases', () => {
      const result = validateMessageTemplate(
        'Just following up on the {{jobTitle}} opportunity at {{companyName}}.',
        'Hi {{firstName}},',
        { job: sampleJob, contact: sampleContact, settings: sampleSettings },
      );

      expect(result.hasDuplicateGreeting).toBe(false);
    });

    it('detects missing contact name when firstName variable is used but contact name is empty', () => {
      const contactWithoutName: Contact = { ...sampleContact, firstName: '' };
      const result = validateMessageTemplate(
        'Looking forward to connecting regarding {{jobTitle}}.',
        'Hi {{firstName}},',
        { job: sampleJob, contact: contactWithoutName, settings: sampleSettings },
      );

      expect(result.hasMissingName).toBe(true);
      expect(result.warnings.some((w) => w.includes('first name is missing'))).toBe(true);
    });

    it('detects unfilled custom variables', () => {
      const result = validateMessageTemplate(
        'Check out my portfolio: {{portfolioUrl}} and Github: {{githubUrl}}',
        'Hi {{firstName}},',
        { job: sampleJob, contact: sampleContact, settings: sampleSettings },
      );

      expect(result.unfilledVariables.some((v) => v.name === 'githubUrl')).toBe(true);
      expect(result.unfilledVariables.some((v) => v.name === 'portfolioUrl')).toBe(false);
      expect(result.warnings.some((w) => w.includes('githubUrl'))).toBe(true);
    });
  });
});

