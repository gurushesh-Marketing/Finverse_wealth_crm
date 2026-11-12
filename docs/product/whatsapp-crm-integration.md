# WhatsApp CRM integration — deferred after SA/HR acceptance

Status: **planned, not implemented or provider-verified**. Resume this work only after the HR -> Super Admin -> first-login journey and its role/team assignment checks pass. This is a post-gate integration slice, not evidence for the 31 October release.

## Product outcome

Sales Callers in Wealth, Banking, Markets/Trading, and Real Estate need a shared WhatsApp inbox inside the existing Finverse CRM. A caller can view and reply only to conversations for leads currently assigned to that caller and allowed by vertical/team grants. The Relationship Manager receives the conversation with the qualified-lead handoff. Every inbound/outbound message, delivery status, owner change, and opt-out is linked to the existing lead timeline and audit trail. Phone numbers remain masked in caller screens where the current access contract requires masking.

## Candidate and architecture decision

Evaluate [ArnasDon/wacrm](https://github.com/ArnasDon/wacrm) as an MIT-licensed reference or independently hosted messaging service. It is a full **Next.js + Supabase Auth/RLS** CRM, not a drop-in component for Finverse's **React/Vite + Express + custom auth/pg** application. Do not copy its whole UI, identity model, contact database, or migrations into Finverse. Its scoped `/api/v1` endpoints and outbound webhooks may support a sidecar integration, but a proof must establish caller-level authorization, conversation ownership, lead mapping, and failure behavior first. If that boundary is too costly or leaky, implement a focused Meta Cloud API adapter behind the existing Finverse API instead. Keep Finverse the source of truth for employee, lead, team, vertical, consent, and assignment.

Current Finverse seam: `apps/api/src/repo/comms.ts` has `sendWhatsApp` and stores messages with `evidence_status='simulated'`; `apps/api/src/routes/wealth.ts` exposes the current send route. Extend the existing channel contract across four verticals rather than duplicating a CRM per vertical. Retain the simulator for local tests, clearly labelled.

## Implementation order after SA/HR gate

1. Inventory the current SC-09 Action Deck contract (screen P059, contract P060), existing message tables, API contracts, permission checks, and all four vertical lead routes. Decide whether Finverse calls wacrm's scoped API or Meta Cloud API directly; write one proof of concept before adopting wacrm operationally.
2. Define a narrow `WhatsAppProvider` server-side interface for send, receive/status webhook normalization, template metadata, and provider errors. Store provider tokens only on the server. Map provider contact/conversation IDs to Finverse lead IDs and store immutable message/audit events with idempotency keys.
3. Build one inbox/detail experience in the current workspace shell: assigned lead, unread state, conversation history, reply composer, approved-template picker when required, delivery/failure state, and Relationship Manager handoff. Use shared components and vertical-specific permissions, not four copied screens.
4. Enforce opt-in, suppression/opt-out, product/vertical eligibility, template approval, and the customer-service-window rules before sending. Inbound webhooks must verify signatures, tolerate duplicate and out-of-order events, and never bypass lead ownership. Obtain Meta business account, phone-number ID, test number, access token, webhook configuration, and approved templates from the client before live sends.
5. Verify four verticals in browser and API: caller A cannot read/reply to caller B or another team's messages; Relationship Manager handoff changes access correctly; inbound/status events attach to the right lead; duplicate webhooks do not duplicate messages; revoked consent blocks sends; missing provider credentials show an honest unavailable state. Separate simulated tests from real Meta sandbox tests.

## Release boundary

Until Meta access and the above acceptance tests pass, label WhatsApp controls **simulated**. Do not claim live customer messaging, copy production conversations to a test service, or expose a wacrm service key to the browser. The user will resume this milestone after the SA/HR workflow is resolved.
