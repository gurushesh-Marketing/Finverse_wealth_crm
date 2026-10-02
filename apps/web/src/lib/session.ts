/**
 * Finverse CRM — Workspace Session Types
 *
 * These types define the contract between the frontend and the auth/session layer.
 * In Phase 0, a typed fixture session is used. The real API will implement the same contract.
 *
 * [ASSUMPTION] Single active assignment per employee; concurrent assignments and role changes
 * mid-period are not yet specified. Fixture uses single active assignment.
 * [ASSUMPTION] Vertical-specific compliance rules are not yet documented; fixture grants
 * conservative read — nothing extra by default.
 */

export type Role =
  | 'SC'   // Sales Consultant
  | 'TL'   // Team Lead
  | 'MG'   // Manager
  | 'RM'   // Relationship Manager
  | 'NM'   // National Manager
  | 'CEO'  // Chief Executive Officer
  | 'CFO'  // Chief Financial Officer
  | 'DE'   // Department Executive
  | 'HR'   // Human Resources
  | 'SA';  // Super Admin

export type Vertical = 'wealth' | 'banking' | 'markets' | 'real-estate';

export interface WorkspaceSession {
  employeeId: string;
  role: Role;
  activeAssignmentId: string;
  verticalGrants: Vertical[];
  teamGrants: string[];
  allowedActions: string[];
  effectiveFrom: string; // ISO 8601 date string
  permissionVersion: string;
}

/**
 * Fixture session for Phase 0 development.
 * Represents a Wealth SC with typical grants.
 *
 * [ASSUMPTION] Example prospect names, amounts, products, and pipeline stages
 * shown in the prototype and catalogue are illustrative only.
 */
export const fixtureSession: WorkspaceSession = {
  employeeId: 'EMP-001',
  role: 'SC',
  activeAssignmentId: 'ASG-WEALTH-001',
  verticalGrants: ['wealth'],
  teamGrants: ['TEAM-WEALTH-ALPHA'],
  allowedActions: [
    'prospect.create',
    'prospect.read',
    'prospect.update',
    'prospect.delete',
    'activity.create',
    'activity.read',
    'activity.update',
    'deal.create',
    'deal.read',
    'deal.update',
    'deal.stage-transition',
    'report.read:personal',
    'enquiry.create',
    'lead.correct',
    'call.place',
    'call.wrapup',
    'activity.manual.create',
    'whatsapp.send',
    'conversation.handle',
    'task.manage',
    'task.reschedule',
    'meeting.book',
    'qualification.edit',
    'pipeline.move',
    'proposal.create',
    'document.request',
    'document.upload',
    'conversion.submit',
    'loss.record',
    'reopen.request',
    'handoff.request',
    'consent.record',
    'complaint.record',
    'report.export',
    'review.acknowledge',
    'help.raise',
    'availability.update',
    'savedview.manage',
  ],
  effectiveFrom: '2026-01-01',
  permissionVersion: 'v1.0.0',
};

/**
 * CEO fixture session — sees all four verticals.
 */
export const fixtureSessionCEO: WorkspaceSession = {
  employeeId: 'EMP-000',
  role: 'CEO',
  activeAssignmentId: 'ASG-CEO-001',
  verticalGrants: ['wealth', 'banking', 'markets', 'real-estate'],
  teamGrants: [],
  allowedActions: ['*'], // wildcard for all actions
  effectiveFrom: '2026-01-01',
  permissionVersion: 'v1.0.0',
};

/**
 * Helper to check if a session has a specific action allowed.
 */
export function hasAction(session: WorkspaceSession, action: string): boolean {
  if (session.allowedActions.includes('*')) return true;
  return session.allowedActions.includes(action);
}

/**
 * Helper to check if a session has access to a vertical.
 */
export function hasVertical(session: WorkspaceSession, vertical: Vertical): boolean {
  // CEO/CFO with all verticals get access to all
  if (session.verticalGrants.length === 4) {
    return true;
  }
  return session.verticalGrants.includes(vertical);
}

/**
 * Helper to check if a session has access to a team.
 */
export function hasTeam(session: WorkspaceSession, teamId: string): boolean {
  return session.teamGrants.includes(teamId);
}