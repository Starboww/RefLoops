// =============================================================================
// RefLoop — LinkedIn Page Classifier
// Accurately determines the current LinkedIn page type to prevent feature collision.
// =============================================================================

export type LinkedInPageType = 'JOB_PAGE' | 'PROFILE_PAGE' | 'COMPANY_PAGE' | 'OTHER';

export function getLinkedInPageType(url: string = window.location.href): LinkedInPageType {
  const cleanUrl = url.split('?')[0]!;

  // 1. Person Profile Page: linkedin.com/in/{username}/
  if (/\/in\/[^/]+/i.test(cleanUrl)) {
    return 'PROFILE_PAGE';
  }

  // 2. Company Page: linkedin.com/company/{company-slug}/
  if (/\/company\/[^/]+/i.test(cleanUrl)) {
    return 'COMPANY_PAGE';
  }

  // 3. Job Posting Page: linkedin.com/jobs/view/{id}/ or linkedin.com/jobs/collections/
  if (/\/jobs\/(view|collections|search)/i.test(cleanUrl)) {
    return 'JOB_PAGE';
  }

  return 'OTHER';
}
