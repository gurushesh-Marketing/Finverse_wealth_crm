// Vertical-specific rules for Markets & Securities / Trading (Deck P005, P038, P317, P320).

export const MARKETS_STAGE_TRANSITIONS: Record<string, string[]> = {
  new: ['kyc', 'not-contacted', 'contacted'],
  kyc: ['risk-profile', 'lost'],
  'risk-profile': ['demat-opened', 'kyc', 'lost'],
  'demat-opened': ['active-funded', 'lost'],
  'active-funded': [],
  // Backwards compatibility with generic/intake states
  'not-contacted': ['contacted', 'kyc'],
  contacted: ['kyc', 'risk-profile', 'follow-up'],
  'follow-up': ['kyc', 'risk-profile', 'demat-opened'],
  qualified: ['demat-opened', 'active-funded'],
  converted: [],
  lost: [],
};

export const MARKETS_PRODUCTS = [
  'Equity Delivery & Intraday',
  'F&O Derivatives',
  'Direct Mutual Funds',
  'Commodities & Currencies',
] as const;

export const MARKETS_SOURCES = [
  'Trading App Direct',
  'Broking Partner Referral',
  'Website',
  'Employee referral',
  'Sub-broker Network',
  'Campaign C12',
] as const;

export const MARKETS_LOSS_REASONS = [
  'SEBI KYC rejection',
  'Risk profile unsuitable (derivatives restricted)',
  'Margin requirement shortfall',
  'Opted for discount broker',
  'Incomplete PAN / Aadhaar KYC linkage',
  'Customer dropped onboarding',
  'Duplicate',
  'Not interested',
] as const;

export const MARKETS_STAGE_RULE_VERSION = 'markets-v1';

export function canMarketsTransition(from: string, to: string): boolean {
  return (MARKETS_STAGE_TRANSITIONS[from] ?? []).includes(to);
}
