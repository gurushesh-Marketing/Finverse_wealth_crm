// Vertical-specific rules for the Wealth Caller domain (kept out of shared UI/API layers).

export const WEALTH_STAGE_TRANSITIONS: Record<string, string[]> = {
  new: ['not-contacted'],
  'not-contacted': ['contacted'],
  contacted: ['follow-up', 'qualified'],
  'follow-up': ['contacted', 'qualified'],
  qualified: ['follow-up'],
  converted: [],
  lost: [],
};

export const BACKDATE_WINDOW_HOURS = 24;
export const MAX_DEFERRALS_BEFORE_APPROVAL = 2;
export const STAGE_RULE_VERSION = 'wealth-v1';

export const WEALTH_PRODUCTS = ['V1 Wealth Portfolio', 'V1 Savings Plus'] as const;
export const ENQUIRY_SOURCES = ['Website', 'Campaign C12', 'Employee referral'] as const;

export const WHATSAPP_TEMPLATES: Record<string, string[]> = {
  'Appointment reminder': ['date', 'time', 'link'],
  'Brochure follow-up': ['product', 'link'],
  'Document checklist': ['documents', 'due', 'link'],
};

export const LOSS_REASONS = [
  'Not interested',
  'Price',
  'Competitor',
  'No response',
  'Not eligible',
  'Invalid data',
  'Duplicate',
] as const;

export function canTransition(from: string, to: string): boolean {
  return (WEALTH_STAGE_TRANSITIONS[from] ?? []).includes(to);
}

export function isBackdatedWithinWindow(occurredAt: Date): boolean {
  const diff = Date.now() - occurredAt.getTime();
  return diff >= 0 && diff <= BACKDATE_WINDOW_HOURS * 3_600_000;
}

export function channelEligibleForCall(suppressedChannels: string[]): boolean {
  return !suppressedChannels.includes('voice');
}

export function channelEligibleForWhatsapp(suppressedChannels: string[]): boolean {
  return !suppressedChannels.includes('whatsapp');
}
