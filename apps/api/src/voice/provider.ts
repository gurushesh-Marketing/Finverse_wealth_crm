import { HttpError } from '../lib/errors';

export interface CallInitiateParams {
  callId: string;
  leadId: string;
  callerEmployeeId: string;
  callerCallingIdentity: string;
  destinationNumber: string;
  idempotencyKey?: string;
}

export interface VoiceProviderCallResult {
  providerName: string;
  providerCallReference: string;
  status: 'connecting' | 'ringing' | 'connected' | 'failed';
  evidenceStatus: 'simulated' | 'provider-verified';
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

export interface VoiceProviderAdapter {
  readonly providerName: string;
  readonly isSimulated: boolean;
  initiateOutboundCall(params: CallInitiateParams): Promise<VoiceProviderCallResult>;
}

/**
 * Synthetic Test Voice Provider
 * Clearly labelled simulated telephony provider for testing and pre-integration.
 * Does not make external network requests or charge carrier minutes.
 */
export class SyntheticTestVoiceProvider implements VoiceProviderAdapter {
  readonly providerName = 'synthetic-test-provider';
  readonly isSimulated = true;

  async initiateOutboundCall(params: CallInitiateParams): Promise<VoiceProviderCallResult> {
    const ref = `SYN-CALL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1e4).toString().padStart(4, '0')}`;
    
    // Mask destination in memory for honest telemetry
    const maskedDest = params.destinationNumber.length > 4
      ? `+91 •••••${params.destinationNumber.slice(-3)}`
      : '••••';

    return {
      providerName: this.providerName,
      providerCallReference: ref,
      status: 'connecting',
      evidenceStatus: 'simulated',
      metadata: {
        callerIdentity: params.callerCallingIdentity,
        destinationMasked: maskedDest,
        simulatedAt: new Date().toISOString(),
        note: 'Test call simulation: synthetic voice provider active',
      },
    };
  }
}

/**
 * Bonvoice Voice Provider (Telephony Adapter Stub)
 * Represents the production vendor adapter once credentials and API docs arrive.
 * Rejects with 503 until live credentials and verified endpoints are configured.
 */
export class BonvoiceVoiceProvider implements VoiceProviderAdapter {
  readonly providerName = 'bonvoice';
  readonly isSimulated = false;

  private apiKey?: string;
  private baseUrl?: string;

  constructor() {
    this.apiKey = process.env.BONVOICE_API_KEY;
    this.baseUrl = process.env.BONVOICE_BASE_URL;
  }

  async initiateOutboundCall(_params: CallInitiateParams): Promise<VoiceProviderCallResult> {
    if (!this.apiKey || !this.baseUrl) {
      throw new HttpError(
        503,
        'PROVIDER_NOT_CONFIGURED',
        'Bonvoice voice provider is not configured. Telephony documentation and credentials are pending from vendor.',
        {}
      );
    }

    // Reserved for genuine vendor integration once documentation and test sandbox are provided.
    // Never make unverified requests or invent endpoints.
    throw new HttpError(
      501,
      'PROVIDER_NOT_CONFIGURED',
      'Bonvoice live calling requires verification against vendor sandbox and approved webhook handlers.',
      {}
    );
  }
}

// Active provider resolver
export function getActiveVoiceProvider(): VoiceProviderAdapter {
  const configuredProvider = process.env.VOICE_PROVIDER?.trim().toLowerCase();
  if (configuredProvider === 'bonvoice' && process.env.BONVOICE_API_KEY) {
    return new BonvoiceVoiceProvider();
  }
  return new SyntheticTestVoiceProvider();
}
