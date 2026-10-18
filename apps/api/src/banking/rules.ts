// Vertical-specific rules for Commercial Banking (Deck P005, P036, P317, P320).

export const BANKING_STAGE_TRANSITIONS: Record<string, string[]> = {
  new: ['eligibility', 'not-contacted', 'contacted'],
  eligibility: ['documents', 'lost'],
  documents: ['eligibility', 'sanction', 'lost'],
  sanction: ['documents', 'disbursal', 'lost'],
  disbursal: [],
  // Backwards compatibility with generic/intake states
  'not-contacted': ['contacted', 'eligibility'],
  contacted: ['eligibility', 'documents', 'follow-up'],
  'follow-up': ['eligibility', 'documents', 'sanction'],
  qualified: ['sanction', 'disbursal'],
  converted: [],
  lost: [],
};

export const BANKING_PRODUCTS = [
  'Corporate Term Loan',
  'V1 Current Account',
  'Working Capital Facility',
  'Trade Finance & Escrow',
] as const;

export const BANKING_SOURCES = [
  'Branch Intake',
  'Corporate Portal',
  'Relationship Manager Referral',
  'Website',
  'Employee referral',
  'Campaign C12',
] as const;

export const BANKING_LOSS_REASONS = [
  'Credit rejected',
  'CIBIL / score below threshold',
  'Insufficient collateral',
  'Pricing / interest rate',
  'Customer dropped facility',
  'Competitor bank opted',
  'Incomplete financial documentation',
  'Duplicate',
  'Not interested',
] as const;

export const BANKING_STAGE_RULE_VERSION = 'banking-v1';

export function canBankingTransition(from: string, to: string): boolean {
  return (BANKING_STAGE_TRANSITIONS[from] ?? []).includes(to);
}
