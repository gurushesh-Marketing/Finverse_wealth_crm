import { z } from 'zod';

export const BANKING_FACILITY_TYPES = [
  'Corporate Term Loan',
  'Working Capital Facility',
  'Trade Finance & Escrow',
  'Asset Backed Finance',
  'Commercial Line of Credit',
  'Other',
] as const;
export type BankingFacilityType = (typeof BANKING_FACILITY_TYPES)[number];

export const loanRequirementSchema = z.object({
  // Amount is a user-entered field in Rupees (e.g. 5000000 for 50L), NOT hardcoded to 1 crore
  requestedAmount: z.number().positive('Requested loan amount must be positive'),
  facilityType: z.enum(BANKING_FACILITY_TYPES).default('Corporate Term Loan'),
  annualTurnover: z.number().nonnegative('Turnover cannot be negative').optional(),
  businessConstitution: z.string().trim().min(1, 'Business constitution is required').optional(),
  loanPurpose: z.string().trim().min(1, 'Loan purpose is required').optional(),
});
export type LoanRequirement = z.infer<typeof loanRequirementSchema>;

export const WEALTH_MANDATE_PRODUCTS = [
  'Portfolio Management Services (PMS)',
  'Alternative Investment Fund (AIF)',
  'Discretionary Portfolio Advisory',
  'Multi-Asset Allocation Solution',
  'Structured Wealth Products',
  'Mutual Fund Advisory & SIP',
  'V1 Wealth Portfolio',
  'V1 Savings Plus',
] as const;
export type WealthMandateProduct = (typeof WEALTH_MANDATE_PRODUCTS)[number];

export const WEALTH_RISK_PROFILES = [
  'Conservative',
  'Moderate',
  'Growth',
  'Aggressive',
] as const;
export type WealthRiskProfile = (typeof WEALTH_RISK_PROFILES)[number];

export const WEALTH_INVESTMENT_HORIZONS = [
  '1-3 Years',
  '3-5 Years',
  '5-10 Years',
  '10+ Years',
] as const;
export type WealthInvestmentHorizon = (typeof WEALTH_INVESTMENT_HORIZONS)[number];

export const wealthRequirementSchema = z.object({
  // Amount in Rupees (e.g. 5000000 for 50L, 10000000 for 1Cr), dynamic per client
  investibleSurplus: z.number().positive('Investible surplus must be positive'),
  mandateType: z.string().trim().min(1, 'Mandate product is required'),
  riskProfile: z.enum(WEALTH_RISK_PROFILES).default('Moderate'),
  investmentHorizon: z.enum(WEALTH_INVESTMENT_HORIZONS).default('3-5 Years'),
  existingPortfolioSize: z.number().nonnegative().optional(),
  currentBrokerOrAmc: z.string().trim().optional(),
  targetReturnExpectation: z.string().trim().optional(),
});
export type WealthRequirement = z.infer<typeof wealthRequirementSchema>;

export const MARKETS_SEGMENTS = [
  'Equity Delivery & Intraday',
  'F&O Derivatives',
  'Commodities & Currencies',
  'Direct Mutual Funds & SGBs',
] as const;
export type MarketsSegment = (typeof MARKETS_SEGMENTS)[number];

export const MARKETS_EXPERIENCE_LEVELS = [
  'Beginner (< 1 Year)',
  'Intermediate (1-3 Years)',
  'Active / Professional (3+ Years)',
  'Algorithmic / High-Frequency',
] as const;
export type MarketsExperienceLevel = (typeof MARKETS_EXPERIENCE_LEVELS)[number];

export const MARKETS_RISK_TOLERANCES = [
  'Low / Conservative (Cash & Delivery only)',
  'Moderate (Equity Delivery + Index Hedging)',
  'High / Speculative (Active F&O & Leverage)',
] as const;
export type MarketsRiskTolerance = (typeof MARKETS_RISK_TOLERANCES)[number];

export const MARKETS_DEPOSITORIES = [
  'CDSL (Central Depository Services India)',
  'NSDL (National Securities Depository Limited)',
] as const;
export type MarketsDepository = (typeof MARKETS_DEPOSITORIES)[number];

export const marketsRequirementSchema = z.object({
  // Trading Capital / Initial Margin in Rupees (e.g. 500000 for 5L, 2500000 for 25L)
  tradingCapital: z.number().positive('Trading capital commitment must be positive'),
  tradingSegment: z.string().trim().min(1, 'Trading segment is required'),
  tradingExperience: z.enum(MARKETS_EXPERIENCE_LEVELS).default('Intermediate (1-3 Years)'),
  riskTolerance: z.enum(MARKETS_RISK_TOLERANCES).default('Moderate (Equity Delivery + Index Hedging)'),
  depositoryPreference: z.enum(MARKETS_DEPOSITORIES).default('CDSL (Central Depository Services India)'),
  incomeProofAvailable: z.boolean().default(true),
  existingBroker: z.string().trim().optional(),
  dematAccountNumber: z.string().trim().optional(),
});
export type MarketsRequirement = z.infer<typeof marketsRequirementSchema>;

export const REAL_ESTATE_PROPERTY_TYPES = [
  'Luxury Residential Villa / Apartment',
  'Commercial Office Space',
  'Retail High Street & Mall Store',
  'Industrial & Logistics Warehousing',
  'Plotted Land Development',
  'Penthouse / Duplex Mandate',
] as const;
export type RealEstatePropertyType = (typeof REAL_ESTATE_PROPERTY_TYPES)[number];

export const REAL_ESTATE_PURCHASE_TIMELINES = [
  'Immediate (Within 30 Days)',
  '1-3 Months (Active Shortlist)',
  '3-6 Months (Planning & Evaluation)',
  '6+ Months (Investor Mandate)',
] as const;
export type RealEstatePurchaseTimeline = (typeof REAL_ESTATE_PURCHASE_TIMELINES)[number];

export const REAL_ESTATE_PURCHASE_PURPOSES = [
  'End-Use / Self-Occupation',
  'Rental Yield & Investment',
  'Corporate Headquarters / Branch',
  'Capital Gains Reinvestment (54EC)',
] as const;
export type RealEstatePurchasePurpose = (typeof REAL_ESTATE_PURCHASE_PURPOSES)[number];

export const REAL_ESTATE_SITE_VISIT_PREFERENCES = [
  'Weekend Preferred',
  'Weekday Morning',
  'Private Chauffeur Inspection',
  'Virtual 3D Walkthrough First',
] as const;
export type RealEstateSiteVisitPreference = (typeof REAL_ESTATE_SITE_VISIT_PREFERENCES)[number];

export const REAL_ESTATE_FUNDING_SOURCES = [
  'Self-Funded / Equity Liquidity',
  'Bank Home Loan Required',
  'Corporate Treasury / Escrow',
] as const;
export type RealEstateFundingSource = (typeof REAL_ESTATE_FUNDING_SOURCES)[number];

export const REAL_ESTATE_POSSESSION_PREFERENCES = [
  'Ready to Move In (OC Received)',
  'Under Construction (Within 12M)',
  'Pre-Launch / Investor Allocation',
] as const;
export type RealEstatePossessionPreference = (typeof REAL_ESTATE_POSSESSION_PREFERENCES)[number];

export const realEstateRequirementSchema = z.object({
  // Property Budget in Rupees (e.g. 35000000 for 3.5 Cr)
  budget: z.number().positive('Budget commitment must be positive'),
  propertyType: z.string().trim().min(1, 'Property type is required'),
  preferredLocation: z.string().trim().min(1, 'Preferred location / micro-market is required'),
  purchaseTimeline: z.enum(REAL_ESTATE_PURCHASE_TIMELINES).default('1-3 Months (Active Shortlist)'),
  purchasePurpose: z.enum(REAL_ESTATE_PURCHASE_PURPOSES).default('End-Use / Self-Occupation'),
  siteVisitPreference: z.enum(REAL_ESTATE_SITE_VISIT_PREFERENCES).default('Weekend Preferred'),
  fundingSource: z.enum(REAL_ESTATE_FUNDING_SOURCES).default('Self-Funded / Equity Liquidity'),
  possessionPreference: z.enum(REAL_ESTATE_POSSESSION_PREFERENCES).default('Ready to Move In (OC Received)'),
  developerPreference: z.string().trim().optional(),
});
export type RealEstateRequirement = z.infer<typeof realEstateRequirementSchema>;

export const qualifyAndHandoffInputSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  vertical: z.enum(['banking', 'wealth', 'markets', 'real_estate', 'real-estate']).optional(),
  loanRequirement: loanRequirementSchema.optional(),
  wealthRequirement: wealthRequirementSchema.optional(),
  marketsRequirement: marketsRequirementSchema.optional(),
  realEstateRequirement: realEstateRequirementSchema.optional(),
  qualificationEvidence: z.string().trim().min(10, 'Provide at least 10 characters of qualification evidence'),
  requiredDocuments: z.array(z.string().trim().min(1)).min(1, 'Select at least one required document'),
  notes: z.string().trim().optional(),
}).refine(
  (data) => Boolean(data.loanRequirement || data.wealthRequirement || data.marketsRequirement || data.realEstateRequirement),
  { message: 'Provide either a loan requirement (Banking), a wealth requirement (Wealth), a trading requirement (Markets), or a property requirement (Real Estate)', path: ['leadId'] }
);
export type QualifyAndHandoffInput = z.infer<typeof qualifyAndHandoffInputSchema>;

export const handoffDecisionInputSchema = z.object({
  decision: z.enum(['accept', 'return']),
  reason: z.string().trim().optional(),
  nextStep: z.string().trim().optional(),
}).refine(
  (data) => data.decision !== 'return' || (typeof data.reason === 'string' && data.reason.trim().length >= 5),
  { message: 'A return reason of at least 5 characters is required when returning a handoff', path: ['reason'] }
);
export type HandoffDecisionInput = z.infer<typeof handoffDecisionInputSchema>;

export const INSTITUTION_STATUSES = [
  'submitted',
  'under-review',
  'term-sheet-issued',
  'sanctioned',
  'declined',
  'proposal-shared',
  'mandate-drafted',
  'onboarding-initiated',
] as const;
export type InstitutionStatus = (typeof INSTITUTION_STATUSES)[number];

export const institutionCoordinationInputSchema = z.object({
  institutionName: z.string().trim().min(1, 'Institution / partner name is required'),
  facilityOffered: z.string().trim().min(1, 'Facility or strategy offered is required'),
  sanctionAmount: z.number().positive('Sanction or allocation amount must be positive').optional(),
  interestRate: z.string().trim().optional(),
  status: z.enum(INSTITUTION_STATUSES).default('submitted'),
  notes: z.string().trim().optional(),
});
export type InstitutionCoordinationInput = z.infer<typeof institutionCoordinationInputSchema>;

export interface InstitutionCoordinationRecord {
  id: string;
  institutionName: string;
  facilityOffered: string;
  sanctionAmount?: number;
  interestRate?: string;
  status: InstitutionStatus;
  notes?: string;
  recordedAt: string;
  recordedBy: string;
}

export type VerificationStatus = 'pending_verification' | 'verified' | 'unverified' | 'synthetic_demo';
export type VerificationSource = 'human_review' | 'real_provider' | 'synthetic_demo' | 'none';

export const recordVerificationInputSchema = z.object({
  checkType: z.enum(['suitability', 'markets_kyc', 'real_estate', 'credit_bureau']),
  status: z.enum(['verified', 'unverified', 'pending_verification', 'synthetic_demo']).default('verified'),
  evidenceReference: z.string().trim().min(3, 'Evidence reference must be at least 3 characters'),
  // Client cannot claim real_provider; only human_review or explicit synthetic_demo
  source: z.enum(['human_review', 'synthetic_demo']).default('human_review'),
  notes: z.string().trim().optional(),
  // Real Estate sub-checks (separated)
  reraApprovalStatus: z.enum(['verified', 'pending', 'unverified']).optional(),
  reraProjectNumber: z.string().trim().optional(),
  titleSearchStatus: z.enum(['clear_unencumbered', 'under_legal_review', 'pending_legal_search']).optional(),
  // Markets sub-checks (separated)
  incomeProofStatus: z.enum(['verified', 'pending', 'unverified', 'exempt_cash_only']).optional(),
  sebiRiskDisclosureAcknowledged: z.boolean().optional(),
  // Wealth sub-checks (separated)
  suitabilityStatus: z.enum(['verified', 'pending', 'unverified']).optional(),
  kraVerified: z.boolean().optional(),
  ckycStatus: z.enum(['verified', 'pending', 'unverified']).optional(),
});
export type RecordVerificationInput = z.infer<typeof recordVerificationInputSchema>;

export interface WealthSuitabilityCheck {
  status: VerificationStatus;
  suitabilityStatus?: 'verified' | 'pending' | 'unverified';
  riskCategory: WealthRiskProfile;
  suitabilityAssessment: string;
  ckycStatus: 'verified' | 'pending' | 'unverified';
  kraVerified: boolean;
  isLiveProviderConnected: boolean;
  evidenceReference: string | null;
  source: VerificationSource;
  reviewerOrProvider: string | null;
  verifiedAt: string | null;
  notice: string;
}

export interface MarketsKycCheck {
  status: VerificationStatus;
  riskCategory?: string;
  ckycStatus: 'verified' | 'pending' | 'unverified';
  ckycVerified?: boolean;
  panAadhaarLinked: boolean;
  incomeProofStatus: 'verified' | 'pending' | 'unverified' | 'exempt_cash_only';
  derivativeSuitability: 'eligible_active' | 'restricted_cash_only' | 'pending_review';
  sebiRiskDisclosureAcknowledged: boolean;
  depositoryStatus: string;
  isLiveProviderConnected: boolean;
  evidenceReference: string | null;
  source: VerificationSource;
  reviewerOrProvider: string | null;
  verifiedAt: string | null;
  notice: string;
}

export interface RealEstateVerificationCheck {
  status: VerificationStatus;
  reraApprovalStatus: 'verified' | 'pending' | 'unverified';
  reraProjectNumber: string | null;
  titleSearchStatus: 'clear_unencumbered' | 'under_legal_review' | 'pending_legal_search';
  siteVisitStatus: 'scheduled' | 'completed' | 'requested';
  bookingMilestoneStatus: 'token_advance' | 'builder_agreement' | 'escrow_funded' | 'pending';
  isLiveProviderConnected: boolean;
  evidenceReference: string | null;
  source: VerificationSource;
  reviewerOrProvider: string | null;
  verifiedAt: string | null;
  notice: string;
}

export interface CreditBureauCheck {
  status: 'pending_authorization' | 'verified' | 'pending_credentials';
  provider: string;
  score: number | null;
  scoreBand: string | null;
  isLiveProviderConnected: boolean;
  consentVerified: boolean;
  evidenceReference: string | null;
  source: VerificationSource;
  reviewerOrProvider: string | null;
  verifiedAt: string | null;
  notice: string;
}

export interface LeadHandoffRecord {
  id: string;
  leadId: string;
  vertical: string;
  callerEmployeeId: string;
  callerName: string;
  relEmployeeId: string;
  relName: string;
  status: 'pending' | 'accepted' | 'returned';
  loanRequirement?: LoanRequirement | null;
  wealthRequirement?: WealthRequirement | null;
  marketsRequirement?: MarketsRequirement | null;
  realEstateRequirement?: RealEstateRequirement | null;
  requiredDocuments: string[];
  qualificationEvidence: string;
  handoffTime: string;
  decisionTime: string | null;
  decisionReason: string | null;
  // Restricted from Sales Caller:
  institutionOptions?: InstitutionCoordinationRecord[];
  nextStep: string | null;
  leadDisplayName: string;
  leadPhoneMasked: string;
  leadProduct: string;
  leadStage: string;
}

export interface RelPortfolioItem {
  leadId: string;
  displayName: string;
  phoneMasked: string;
  product: string;
  stage: string;
  handoffId: string;
  handoffStatus: 'pending' | 'accepted' | 'returned';
  handoffTime: string;
  callerName: string;
  requestedAmount: number;
  facilityType: string;
  mandateType?: string;
  investibleSurplus?: number;
  riskProfile?: string;
  tradingCapital?: number;
  tradingSegment?: string;
  tradingExperience?: string;
  riskTolerance?: string;
  propertyBudget?: number;
  propertyType?: string;
  preferredLocation?: string;
  siteVisitPreference?: string;
  institutionsCount: number;
  nextStep?: string | null;
  lastActivityAt: string;
}

