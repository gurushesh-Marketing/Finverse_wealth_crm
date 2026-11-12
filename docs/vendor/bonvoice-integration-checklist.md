# Bonvoice Telephony Vendor Integration Checklist — Finverse CRM v2

**Document Status:** Pending Vendor Documentation & Credentials  
**Module:** Voice Provider Adapter (`apps/api/src/voice/provider.ts`)  
**Target Action:** `SC-06` (Place Voice Call)  
**Security Classification:** Restricted / PII Privacy Sensitive  

---

## 1. Executive Summary

Finverse CRM v2 implements secure, server-side click-to-call architecture. Frontline Sales Callers (`SC`) never receive, view, or transmit raw customer phone numbers. The client web application sends only the `leadId` to `/api/calls/initiate`. The backend validates lead ownership, vertical/team authorization, and suppression status, resolves the destination phone number privately from PostgreSQL in memory, and dispatches the call through the Voice Provider Adapter.

Until official Bonvoice documentation and test credentials are provided by the client, Finverse CRM v2 operates with the **Synthetic Test Voice Provider** (`SyntheticTestVoiceProvider`), clearly labelled in the UI as **“Test call simulation”**.

This checklist details the exact technical items required from Bonvoice to transition from the synthetic provider to live production telephony.

---

## 2. Technical Requirements Checklist

### A. Authentication & Transport Security
- [ ] **Base URLs:** Distinct endpoints for:
  - Staging / Sandbox Environment (e.g. `https://sandbox-api.bonvoice.com/v1`)
  - Production Environment (e.g. `https://api.bonvoice.com/v1`)
- [ ] **Authentication Scheme:**
  - Method (API Key in custom header, Bearer JWT, or Basic Auth)
  - Key rotation lifecycle and expiration policies
  - Rate limiting parameters (requests/second, concurrent calls/agent)
- [ ] **Network Egress/Ingress Security:**
  - Outbound static IP whitelist for Finverse CRM API servers
  - TLS 1.3 requirement & supported cipher suites

### B. Outbound Click-to-Call (Initiation) API
- [ ] **Endpoint Specification:**
  - Method & URI: e.g. `POST /v1/calls/click-to-call` or `POST /v1/outbound/initiate`
- [ ] **Request Schema:**
  - `agent_identifier`: Agent virtual number / extension / agent ID
  - `destination_number`: E.164 formatted target phone number (e.g., `+919876543210`)
  - `caller_id_cli`: Approved institutional outbound CLI to display to the customer
  - `idempotency_key`: Client request deduplication token (prevents double dialling)
  - `custom_reference`: Finverse internal `callId` for webhook reconciliation
  - `call_type`: Direct bridge (agent legs first) vs predictive / preview dialler
- [ ] **Response Schema:**
  - Provider call session ID (e.g., `bonvoice_session_id`)
  - Immediate request status (`queued`, `initiated`, `failed`)
  - Error codes catalogue (invalid number, carrier rejected, agent offline, balance exhausted)

### C. Webhook Event Notifications (Real-Time State Machine)
- [ ] **Webhook Ingress Endpoint:** Finverse API will expose `POST /api/webhooks/bonvoice/events`
- [ ] **Webhook Signature Verification:**
  - HMAC-SHA256 signature header (e.g., `X-Bonvoice-Signature`)
  - Shared webhook signing secret
  - Timestamp header to prevent replay attacks
- [ ] **Event Catalogue & Payload Specs:**
  - `call.initiated`: Call dispatched by carrier
  - `call.ringing`: Ringing on customer handset
  - `call.answered`: Connected / active conversation start (starts billable duration)
  - `call.completed`: Call terminated normally (includes authoritative duration in seconds)
  - `call.busy`: Handset busy
  - `call.no_answer`: Timed out without answer
  - `call.failed`: Carrier routing failure with diagnostic code
- [ ] **Retry & Delivery Policy:**
  - Backoff policy for 5xx responses from CRM webhook
  - Webhook delivery timeout window

### D. Agent Number & DID Mapping
- [ ] **Outbound Identity Provisioning:**
  - List of approved institutional virtual DIDs (e.g., `+91 80 4000 0001` through `+91 80 4000 0050`)
  - Mapping between Finverse employee IDs (`EMP-001` Asha Rao, `EMP-002` Ravi Menon, etc.) and Bonvoice agent extensions
- [ ] **Two-Leg Dialling Architecture:**
  - Leg 1: Telephony server rings agent handset/WebRTC softphone
  - Leg 2: Telephony server dials customer and bridges audio upon agent answer

### E. Privacy & Masking Verification
- [ ] **Carrier-Level Number Privacy:**
  - Confirmation that customer MSISDN is never echoed back in webhook URLs, unencrypted query params, or agent-facing SIP headers
  - Support for custom masking rules in call logs / CDR reports on vendor portal

### F. Sandbox Environment & Test Credentials
- [ ] **Sandbox Access:**
  - Test Account SID / API Key
  - Webhook signing test secret
  - Whitelisted test customer phone numbers for live audio verification
  - Simulated disposition trigger numbers (e.g., dummy numbers returning guaranteed busy, no-answer, or connected)

---

## 3. Transition Plan Once Credentials Arrive

1. **Populate Server Secrets:** Configure `BONVOICE_API_KEY`, `BONVOICE_BASE_URL`, and `BONVOICE_WEBHOOK_SECRET` in restricted environment configuration (never committed to Git).
2. **Implement Bonvoice Adapter:** Complete `BonvoiceVoiceProvider` in `apps/api/src/voice/provider.ts` to transform generic `CallInitiateParams` into the vendor's JSON payload.
3. **Register Webhook Ingress:** Implement `apps/api/src/routes/webhooks.ts` with signature verification and atomic call status updates in `calls` table.
4. **End-to-End Sandbox Verification:** Run full test dial to verified test handset; verify transition from `connecting` -> `ringing` -> `connected` -> `ended` with genuine duration.
5. **Update Honest UI Label:** Change UI indicator from "Test call simulation" to "Provider verified" only after end-to-end sandbox call succeeds.
