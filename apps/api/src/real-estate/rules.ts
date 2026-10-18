// Vertical-specific rules for Real Estate Advisory (Deck P005, P038, P317, P320).

export const REAL_ESTATE_STAGE_TRANSITIONS: Record<string, string[]> = {
  new: ['requirement', 'not-contacted', 'contacted'],
  requirement: ['site-visit', 'lost'],
  'site-visit': ['booking', 'requirement', 'lost'],
  booking: ['registration', 'converted', 'lost'],
  registration: ['converted'],
  converted: [],
  lost: [],
  // Backwards compatibility with generic/intake states
  'not-contacted': ['contacted', 'requirement'],
  contacted: ['requirement', 'site-visit', 'follow-up'],
  'follow-up': ['requirement', 'site-visit', 'booking'],
  qualified: ['booking', 'registration', 'converted'],
};

export const REAL_ESTATE_PRODUCTS = [
  'Luxury Residential Mandate',
  'Commercial Office Space',
  'Grade-A Commercial Office Leasehold Mandate',
  'Land Parcel Advisory',
  'Retail High-Street Mandate',
] as const;

export const REAL_ESTATE_SOURCES = [
  'Direct Inbound',
  'Developer Direct Referral',
  'Broking Partner Referral',
  'Website',
  'Employee referral',
  'Channel Partner Network',
] as const;

export const REAL_ESTATE_LOSS_REASONS = [
  'Title diligence issue',
  'Budget mismatch',
  'RERA registration delay',
  'Opted for competitor broker',
  'Client deferred mandate',
  'Duplicate',
  'Not interested',
] as const;

export const REAL_ESTATE_STAGE_RULE_VERSION = 'real-estate-v1';

export function canRealEstateTransition(from: string, to: string): boolean {
  return (REAL_ESTATE_STAGE_TRANSITIONS[from] ?? []).includes(to);
}
