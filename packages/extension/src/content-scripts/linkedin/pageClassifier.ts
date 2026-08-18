// =============================================================================
// RefLoop — LinkedIn Page Classifier
// Accurately determines the current LinkedIn page type to prevent feature collision.
// =============================================================================

export type LinkedInPageType = 'JOB_PAGE' | 'PROFILE_PAGE' | 'COMPANY_PEOPLE_PAGE' | 'COMPANY_PAGE' | 'OTHER';

export function getLinkedInPageType(url: string = window.location.href): LinkedInPageType {
  const cleanUrl = url.split('?')[0]!.split('#')[0]!;

  // 1. Person Profile Page: linkedin.com/in/{username}/
  if (/\/in\/[^/]+/i.test(cleanUrl)) {
    return 'PROFILE_PAGE';
  }

  // 2. Company / School People Tab: linkedin.com/(company|school)/{slug}/people/
  // Must be checked BEFORE generic COMPANY_PAGE
  if (/\/(?:company|school)\/[^/]+\/people(?:\/|$)/i.test(cleanUrl)) {
    return 'COMPANY_PEOPLE_PAGE';
  }

  // 3. Company / School Page: linkedin.com/(company|school)/{slug}/
  if (/\/(?:company|school)\/[^/]+/i.test(cleanUrl)) {
    return 'COMPANY_PAGE';
  }

  // 4. Job Posting Page: linkedin.com/jobs/view/{id}/ or linkedin.com/jobs/collections/
  if (/\/jobs\/(view|collections|search)/i.test(cleanUrl)) {
    return 'JOB_PAGE';
  }

  return 'OTHER';
}

