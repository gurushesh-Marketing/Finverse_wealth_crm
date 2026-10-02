/**
 * Finverse CRM — local database (node:sqlite, zero external dependencies).
 *
 * This is the agreed local database approach: one SQLite file at
 * apps/web/.data/finverse.db (gitignored) behind the typed repository
 * interfaces. Real production persistence/APIs replace this later without
 * rewriting UI behavior.
 *
 * [ASSUMPTION] All seeded people, companies, and amounts are illustrative
 * fixture data. Demo credentials are intentionally trivial (local demo only).
 */

import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  const dir = path.join(process.cwd(), '.data');
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'finverse.db'));
  initSchema(db);
  migrateColumns(db);
  reseedIfNeeded(db);
  dbInstance = db;
  return db;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      vertical TEXT NOT NULL,
      team_id TEXT NOT NULL,
      team_name TEXT NOT NULL,
      effective_from TEXT NOT NULL,
      permission_version TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      vertical TEXT NOT NULL,
      team_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      masked_phone TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      product TEXT NOT NULL,
      source TEXT NOT NULL,
      source_detail TEXT,
      stage TEXT NOT NULL,
      next_action TEXT NOT NULL,
      due_at TEXT NOT NULL,
      contact_eligible INTEGER NOT NULL DEFAULT 1,
      owner_name TEXT NOT NULL,
      owner_team_name TEXT NOT NULL,
      ownership_history TEXT NOT NULL DEFAULT '[]',
      reassigned_away INTEGER NOT NULL DEFAULT 0,
      preferred_language TEXT NOT NULL DEFAULT 'English',
      contact_permission TEXT NOT NULL DEFAULT 'active',
      need TEXT,
      intake_kind TEXT NOT NULL DEFAULT 'routed',
      intake_ref TEXT,
      created_by TEXT,
      lost_reason TEXT,
      lost_explanation TEXT,
      lost_competitor TEXT,
      lost_future_contact TEXT,
      lost_at TEXT,
      reopened_at TEXT,
      pending_conversion INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lead_tasks (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      title TEXT NOT NULL,
      due_at TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      purpose TEXT,
      reminder_at TEXT,
      kind TEXT NOT NULL DEFAULT 'follow-up',
      created_by TEXT,
      completed_at TEXT,
      completion_outcome TEXT,
      completion_evidence TEXT,
      next_step TEXT,
      next_due_at TEXT,
      cancel_reason TEXT,
      cancelled_at TEXT,
      cancel_status TEXT,
      original_due_at TEXT,
      reschedule_reason TEXT,
      customer_informed INTEGER,
      defer_count INTEGER NOT NULL DEFAULT 0,
      meeting_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lead_activities (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      actor TEXT NOT NULL,
      type TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      outcome TEXT,
      event_at TEXT NOT NULL,
      evidence_status TEXT NOT NULL DEFAULT 'system',
      provider_ref TEXT,
      manual_reason TEXT,
      correction_of TEXT,
      actor_team TEXT,
      actor_role TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS task_revisions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      from_due_at TEXT,
      to_due_at TEXT NOT NULL,
      reason TEXT,
      customer_informed INTEGER,
      requested_by TEXT,
      status TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      employee_id TEXT,
      idempotency_key TEXT UNIQUE,
      state TEXT,
      provider_ref TEXT,
      simulated INTEGER NOT NULL DEFAULT 1,
      started_at TEXT,
      connected_at TEXT,
      ended_at TEXT,
      duration_seconds INTEGER,
      wrapup_disposition TEXT,
      wrapup_need_confirmed INTEGER,
      wrapup_note TEXT,
      wrapup_next_action TEXT,
      wrapup_due_at TEXT,
      wrapup_saved_at TEXT,
      wrapup_draft_json TEXT,
      wrapup_draft_expires_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      employee_id TEXT,
      direction TEXT,
      channel TEXT DEFAULT 'whatsapp',
      template_key TEXT,
      language TEXT,
      body TEXT,
      variables_json TEXT,
      provider_ref TEXT,
      status TEXT,
      inbound_event_id TEXT UNIQUE,
      intent TEXT,
      handled INTEGER NOT NULL DEFAULT 0,
      handled_by TEXT,
      handled_at TEXT,
      event_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saved_views (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      name TEXT NOT NULL,
      filters_json TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(employee_id, name)
    );
    CREATE TABLE IF NOT EXISTS availability_events (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      status TEXT,
      note TEXT,
      effective_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lead_edit_audits (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      actor TEXT,
      before_json TEXT,
      after_json TEXT,
      reason TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS identity_reviews (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      field TEXT,
      requested_value TEXT,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS enquiries (
      id TEXT PRIMARY KEY,
      created_by TEXT,
      display_name TEXT,
      phone TEXT,
      email TEXT,
      product TEXT,
      source TEXT,
      source_detail TEXT,
      permission_evidence TEXT,
      permission_date TEXT,
      need TEXT,
      status TEXT,
      linked_lead_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      meeting_type TEXT,
      slot_at TEXT,
      location TEXT,
      attendees TEXT,
      agenda TEXT,
      status TEXT,
      invite_status TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qualifications (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      checklist_version TEXT,
      need TEXT,
      product TEXT,
      expected_value REAL,
      currency TEXT DEFAULT 'INR',
      time_horizon TEXT,
      answers_json TEXT,
      next_step TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stage_events (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      from_stage TEXT,
      to_stage TEXT,
      reason TEXT,
      required_evidence TEXT,
      actor TEXT,
      rule_version TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      version INTEGER,
      product TEXT,
      template_key TEXT,
      terms_json TEXT,
      valid_until TEXT,
      attachment_name TEXT,
      recipient TEXT,
      status TEXT,
      approval_note TEXT,
      sent_via TEXT,
      sent_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS doc_requests (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      checklist_version TEXT,
      items_json TEXT,
      due_at TEXT,
      reminder_enabled INTEGER,
      token TEXT,
      token_expires_at TEXT,
      channel TEXT,
      status TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      request_id TEXT,
      doc_type TEXT,
      file_name TEXT,
      size_bytes INTEGER,
      mime TEXT,
      version INTEGER,
      visibility TEXT,
      scan_status TEXT,
      review_status TEXT,
      review_reason TEXT,
      uploaded_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversion_requests (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      version INTEGER,
      milestone TEXT,
      milestone_date TEXT,
      value REAL,
      currency TEXT DEFAULT 'INR',
      evidence_ref TEXT,
      credit_json TEXT,
      status TEXT,
      payload_json TEXT,
      reject_reason TEXT,
      approver TEXT,
      submitted_by TEXT,
      created_at TEXT NOT NULL,
      decided_at TEXT
    );
    CREATE TABLE IF NOT EXISTS loss_events (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      reason TEXT,
      explanation TEXT,
      competitor TEXT,
      future_contact TEXT,
      actor TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reopen_requests (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      reason TEXT,
      evidence_ref TEXT,
      requested_stage TEXT,
      next_action TEXT,
      status TEXT,
      decided_by TEXT,
      created_at TEXT NOT NULL,
      decided_at TEXT
    );
    CREATE TABLE IF NOT EXISTS handoff_requests (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      reason TEXT,
      destination TEXT,
      permission_evidence TEXT,
      note TEXT,
      status TEXT,
      deadline_at TEXT,
      response_reason TEXT,
      created_at TEXT NOT NULL,
      decided_at TEXT
    );
    CREATE TABLE IF NOT EXISTS suppressions (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      channels_json TEXT,
      source TEXT,
      received_at TEXT,
      note TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      category TEXT,
      statement TEXT,
      status TEXT,
      resolution TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
    CREATE TABLE IF NOT EXISTS targets (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      period TEXT NOT NULL,
      metric TEXT NOT NULL,
      value REAL,
      currency TEXT DEFAULT 'INR',
      UNIQUE(employee_id, period, metric)
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      period TEXT NOT NULL,
      reviewer_name TEXT,
      self_reflection TEXT,
      commitments_json TEXT,
      employee_response TEXT,
      acknowledged_at TEXT,
      rating_private TEXT,
      snapshot_json TEXT,
      snapshot_version TEXT,
      status TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS export_jobs (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      period TEXT,
      snapshot_json TEXT,
      metric_version TEXT,
      cutoff_at TEXT,
      status TEXT,
      recipient TEXT,
      file_name TEXT,
      watermark TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS help_requests (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      category TEXT,
      record_ref TEXT,
      description TEXT,
      evidence_name TEXT,
      priority TEXT,
      routed_to TEXT,
      status TEXT,
      sla_due_at TEXT,
      resolution TEXT,
      correction_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

/** Additive column migration for databases created before the Wealth slice. */
function migrateColumns(db: DatabaseSync): void {
  const additions: Array<[string, string, string]> = [
    // leads
    ['leads', 'phone', 'TEXT'],
    ['leads', 'preferred_language', "TEXT NOT NULL DEFAULT 'English'"],
    ['leads', 'contact_permission', "TEXT NOT NULL DEFAULT 'active'"],
    ['leads', 'need', 'TEXT'],
    ['leads', 'intake_kind', "TEXT NOT NULL DEFAULT 'routed'"],
    ['leads', 'intake_ref', 'TEXT'],
    ['leads', 'created_by', 'TEXT'],
    ['leads', 'lost_reason', 'TEXT'],
    ['leads', 'lost_explanation', 'TEXT'],
    ['leads', 'lost_competitor', 'TEXT'],
    ['leads', 'lost_future_contact', 'TEXT'],
    ['leads', 'lost_at', 'TEXT'],
    ['leads', 'reopened_at', 'TEXT'],
    ['leads', 'pending_conversion', 'INTEGER NOT NULL DEFAULT 0'],
    // lead_tasks
    ['lead_tasks', 'kind', "TEXT NOT NULL DEFAULT 'follow-up'"],
    ['lead_tasks', 'created_by', 'TEXT'],
    ['lead_tasks', 'completed_at', 'TEXT'],
    ['lead_tasks', 'completion_outcome', 'TEXT'],
    ['lead_tasks', 'completion_evidence', 'TEXT'],
    ['lead_tasks', 'next_step', 'TEXT'],
    ['lead_tasks', 'next_due_at', 'TEXT'],
    ['lead_tasks', 'cancel_reason', 'TEXT'],
    ['lead_tasks', 'cancelled_at', 'TEXT'],
    ['lead_tasks', 'cancel_status', 'TEXT'],
    ['lead_tasks', 'original_due_at', 'TEXT'],
    ['lead_tasks', 'reschedule_reason', 'TEXT'],
    ['lead_tasks', 'customer_informed', 'INTEGER'],
    ['lead_tasks', 'defer_count', 'INTEGER NOT NULL DEFAULT 0'],
    ['lead_tasks', 'meeting_id', 'TEXT'],
    // lead_activities
    ['lead_activities', 'evidence_status', "TEXT NOT NULL DEFAULT 'system'"],
    ['lead_activities', 'provider_ref', 'TEXT'],
    ['lead_activities', 'manual_reason', 'TEXT'],
    ['lead_activities', 'correction_of', 'TEXT'],
    ['lead_activities', 'actor_team', 'TEXT'],
    ['lead_activities', 'actor_role', 'TEXT'],
  ];

  for (const [table, column, ddl] of additions) {
    if (!hasColumn(db, table, column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  }
}

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

function getSchemaVersion(db: DatabaseSync): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  return row ? Number(row.value) : 0;
}

/**
 * Schema v2 refresh: after the additive migration, rebuild the demo fixture
 * (approved wipe — never touch anything outside this database file). Idempotent
 * by the schema_version guard.
 */
function reseedIfNeeded(db: DatabaseSync): void {
  if (getSchemaVersion(db) >= 2) return;
  db.exec('BEGIN');
  try {
    wipeAppData(db);
    seed(db);
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '2')").run();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const APP_TABLES = [
  'users',
  'assignments',
  'sessions',
  'leads',
  'lead_tasks',
  'lead_activities',
  'task_revisions',
  'calls',
  'messages',
  'saved_views',
  'availability_events',
  'lead_edit_audits',
  'identity_reviews',
  'enquiries',
  'meetings',
  'qualifications',
  'stage_events',
  'proposals',
  'doc_requests',
  'documents',
  'conversion_requests',
  'loss_events',
  'reopen_requests',
  'handoff_requests',
  'suppressions',
  'complaints',
  'targets',
  'reviews',
  'export_jobs',
  'help_requests',
];

function wipeAppData(db: DatabaseSync): void {
  for (const table of APP_TABLES) {
    db.exec(`DELETE FROM ${table}`);
  }
}

function localDaysFromNow(days: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function plusSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}

function seed(db: DatabaseSync): void {
  // Idempotency guard: never duplicate the canonical demo users.
  const existing = db.prepare("SELECT COUNT(*) AS n FROM users WHERE id = 'USR-B01'").get() as { n: number };
  if (existing.n > 0) return;

  const nowIso = new Date().toISOString();
  const salt = 'finverse-demo-salt';
  const pw = hashPassword('demo1234', salt);

  const users: Array<[string, string, string, string]> = [
    ['USR-B01', 'ravi@finverse.demo', 'Ravi Kumar', 'EMP-B01'],
    ['USR-B02', 'sana@finverse.demo', 'Sana Iyer', 'EMP-B02'],
    ['USR-W01', 'asha@finverse.demo', 'Asha Nair', 'EMP-001'],
    ['USR-W02', 'kiran@finverse.demo', 'Kiran Rao', 'EMP-002'],
    ['USR-W03', 'trainee@finverse.demo', 'Dev Sharma', 'EMP-003'],
  ];
  const insertUser = db.prepare(
    'INSERT INTO users (id, email, display_name, employee_id, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const [id, email, name, emp] of users) {
    insertUser.run(id, email, name, emp, pw, salt);
  }

  const insertAsg = db.prepare(
    'INSERT INTO assignments (id, user_id, role, vertical, team_id, team_name, effective_from, permission_version, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertAsg.run('ASG-B01', 'USR-B01', 'SC', 'banking', 'TEAM-BANKING-ALPHA', 'Banking Alpha', '2026-01-01', 'v1.0.0', 1);
  insertAsg.run('ASG-B02', 'USR-B02', 'SC', 'banking', 'TEAM-BANKING-BETA', 'Banking Beta', '2026-01-01', 'v1.0.0', 1);
  insertAsg.run('ASG-W01', 'USR-W01', 'SC', 'wealth', 'TEAM-WEALTH-ALPHA', 'Wealth Alpha', '2026-01-01', 'v1.0.0', 1);
  insertAsg.run('ASG-W02', 'USR-W02', 'SC', 'wealth', 'TEAM-WEALTH-ALPHA', 'Wealth Alpha', '2026-01-01', 'v1.0.0', 1);
  insertAsg.run('ASG-W03', 'USR-W03', 'SC', 'wealth', 'TEAM-WEALTH-ALPHA', 'Wealth Alpha', '2026-01-01', 'v1.0.0', 0);

  const raviHist = JSON.stringify([{ ownerName: 'Ravi Kumar', teamName: 'Banking Alpha', from: '2026-01-05T09:00:00Z' }]);
  const sanaHist = JSON.stringify([{ ownerName: 'Sana Iyer', teamName: 'Banking Beta', from: '2026-02-01T09:00:00Z' }]);
  const ashaHist = JSON.stringify([{ ownerName: 'Asha Nair', teamName: 'Wealth Alpha', from: '2026-01-10T09:00:00Z' }]);
  const kiranHist = JSON.stringify([{ ownerName: 'Kiran Rao', teamName: 'Wealth Alpha', from: '2026-01-10T09:00:00Z' }]);
  const reassignedHist = JSON.stringify([
    { ownerName: 'Asha Nair', teamName: 'Wealth Alpha', from: '2026-01-10T09:00:00Z', to: '2026-09-20T09:00:00Z' },
    { ownerName: 'Kiran Rao', teamName: 'Wealth Alpha', from: '2026-09-20T09:00:00Z' },
  ]);

  const insertLead = db.prepare(
    `INSERT INTO leads (
      id, vertical, team_id, employee_id, display_name, masked_phone, phone, email,
      product, source, source_detail, stage, next_action, due_at, contact_eligible,
      owner_name, owner_team_name, ownership_history, reassigned_away,
      preferred_language, contact_permission, need, intake_kind,
      lost_reason, lost_explanation, lost_future_contact, lost_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  type LeadSeed = {
    id: string;
    vertical: string;
    team: string;
    employee: string;
    name: string;
    masked: string;
    phone: string | null;
    email: string | null;
    product: string;
    source: string;
    sourceDetail: string | null;
    stage: string;
    nextAction: string;
    dueAt: string;
    contactEligible: number;
    owner: string;
    ownerTeam: string;
    history: string;
    reassignedAway: number;
    prefLang: string;
    contactPerm: string;
    need: string | null;
    intakeKind: string;
    lostReason: string | null;
    lostExplanation: string | null;
    lostFutureContact: string | null;
    lostAt: string | null;
    createdAt: string;
  };

  const leads: LeadSeed[] = [
    // Banking leads (unchanged field values from the original seed).
    { id: 'FV-2001', vertical: 'banking', team: 'TEAM-BANKING-ALPHA', employee: 'EMP-B01', name: 'Meera Textiles Pvt Ltd', masked: '•••• •• 2001', phone: null, email: 'meera.textiles@example.com', product: 'Working capital loan', source: 'Website', sourceDetail: 'Campaign B07', stage: 'not-contacted', nextAction: 'Intro call', dueAt: '2026-09-24T11:00:00Z', contactEligible: 1, owner: 'Ravi Kumar', ownerTeam: 'Banking Alpha', history: raviHist, reassignedAway: 0, prefLang: 'English', contactPerm: 'active', need: null, intakeKind: 'routed', lostReason: null, lostExplanation: null, lostFutureContact: null, lostAt: null, createdAt: '2026-09-25T09:00:00Z' },
    { id: 'FV-2002', vertical: 'banking', team: 'TEAM-BANKING-ALPHA', employee: 'EMP-B01', name: 'Sunrise Logistics', masked: '•••• •• 2002', phone: null, email: null, product: 'Vehicle finance', source: 'Referral', sourceDetail: 'Partner P3', stage: 'contacted', nextAction: 'Follow-up call', dueAt: '2026-09-25T15:00:00Z', contactEligible: 1, owner: 'Ravi Kumar', ownerTeam: 'Banking Alpha', history: raviHist, reassignedAway: 0, prefLang: 'English', contactPerm: 'active', need: null, intakeKind: 'routed', lostReason: null, lostExplanation: null, lostFutureContact: null, lostAt: null, createdAt: '2026-09-25T09:00:00Z' },
    { id: 'FV-2003', vertical: 'banking', team: 'TEAM-BANKING-ALPHA', employee: 'EMP-B01', name: 'Greenfield Agro Foods', masked: '•••• •• 2003', phone: null, email: 'greenfield@example.com', product: 'Term loan', source: 'Website', sourceDetail: null, stage: 'not-contacted', nextAction: 'Share term sheet', dueAt: '2026-09-28T10:00:00Z', contactEligible: 1, owner: 'Ravi Kumar', ownerTeam: 'Banking Alpha', history: raviHist, reassignedAway: 0, prefLang: 'English', contactPerm: 'active', need: null, intakeKind: 'routed', lostReason: null, lostExplanation: null, lostFutureContact: null, lostAt: null, createdAt: '2026-09-25T09:00:00Z' },
    { id: 'FV-2004', vertical: 'banking', team: 'TEAM-BANKING-BETA', employee: 'EMP-B02', name: 'Orbit Retail Chains', masked: '•••• •• 2004', phone: null, email: null, product: 'Working capital loan', source: 'Outbound', sourceDetail: null, stage: 'not-contacted', nextAction: 'Intro call', dueAt: '2026-09-26T12:00:00Z', contactEligible: 1, owner: 'Sana Iyer', ownerTeam: 'Banking Beta', history: sanaHist, reassignedAway: 0, prefLang: 'English', contactPerm: 'active', need: null, intakeKind: 'routed', lostReason: null, lostExplanation: null, lostFutureContact: null, lostAt: null, createdAt: '2026-09-25T09:00:00Z' },
    // Wealth leads (EMP-001).
    { id: 'FV-1042', vertical: 'wealth', team: 'TEAM-WEALTH-ALPHA', employee: 'EMP-001', name: 'Prospect B', masked: '•••• •• 4021', phone: '+91 98765 40210', email: null, product: 'V1 product', source: 'Website', sourceDetail: 'Campaign C12', stage: 'not-contacted', nextAction: 'Call today 11:00', dueAt: localDaysFromNow(0, 11, 0), contactEligible: 1, owner: 'Asha Nair', ownerTeam: 'Wealth Alpha', history: ashaHist, reassignedAway: 0, prefLang: 'English', contactPerm: 'active', need: 'Portfolio review', intakeKind: 'routed', lostReason: null, lostExplanation: null, lostFutureContact: null, lostAt: null, createdAt: nowIso },
    { id: 'FV-1043', vertical: 'wealth', team: 'TEAM-WEALTH-ALPHA', employee: 'EMP-001', name: 'Prospect C', masked: '•••• •• 4031', phone: '+91 98765 40310', email: null, product: 'V1 product', source: 'Referral', sourceDetail: 'Partner P1', stage: 'contacted', nextAction: 'Follow-up call', dueAt: localDaysFromNow(1, 15, 0), contactEligible: 1, owner: 'Asha Nair', ownerTeam: 'Wealth Alpha', history: ashaHist, reassignedAway: 0, prefLang: 'English', contactPerm: 'active', need: null, intakeKind: 'routed', lostReason: null, lostExplanation: null, lostFutureContact: null, lostAt: null, createdAt: nowIso },
    { id: 'FV-1044', vertical: 'wealth', team: 'TEAM-WEALTH-ALPHA', employee: 'EMP-001', name: 'Prospect D', masked: '•••• •• 4041', phone: '+91 98765 40410', email: null, product: 'V1 product', source: 'Website', sourceDetail: null, stage: 'not-contacted', nextAction: 'Intro call', dueAt: localDaysFromNow(3, 10, 0), contactEligible: 1, owner: 'Asha Nair', ownerTeam: 'Wealth Alpha', history: ashaHist, reassignedAway: 0, prefLang: 'English', contactPerm: 'active', need: null, intakeKind: 'routed', lostReason: null, lostExplanation: null, lostFutureContact: null, lostAt: null, createdAt: nowIso },
    { id: 'FV-1045', vertical: 'wealth', team: 'TEAM-WEALTH-ALPHA', employee: 'EMP-001', name: 'Prospect E', masked: '•••• •• 4051', phone: '+91 98765 40510', email: null, product: 'V1 product', source: 'Employee referral', sourceDetail: null, stage: 'follow-up', nextAction: 'Await documents', dueAt: localDaysFromNow(0, 16, 0), contactEligible: 1, owner: 'Asha Nair', ownerTeam: 'Wealth Alpha', history: ashaHist, reassignedAway: 0, prefLang: 'English', contactPerm: 'active', need: null, intakeKind: 'routed', lostReason: null, lostExplanation: null, lostFutureContact: null, lostAt: null, createdAt: nowIso },
    { id: 'FV-0920', vertical: 'wealth', team: 'TEAM-WEALTH-ALPHA', employee: 'EMP-001', name: 'Prospect A', masked: '•••• •• 4201', phone: '+91 98765 42010', email: null, product: 'V1 product', source: 'Website', sourceDetail: null, stage: 'lost', nextAction: 'No action — lost', dueAt: localDaysFromNow(-10, 12, 0), contactEligible: 1, owner: 'Asha Nair', ownerTeam: 'Wealth Alpha', history: ashaHist, reassignedAway: 0, prefLang: 'English', contactPerm: 'active', need: null, intakeKind: 'routed', lostReason: 'Not interested', lostExplanation: 'Customer declined current offer', lostFutureContact: 'Permitted', lostAt: localDaysFromNow(-10, 12, 0), createdAt: nowIso },
    { id: 'FV-1051', vertical: 'wealth', team: 'TEAM-WEALTH-ALPHA', employee: 'EMP-001', name: 'Prospect G', masked: '•••• •• 4511', phone: '+91 98765 45110', email: null, product: 'V1 product', source: 'Website', sourceDetail: null, stage: 'contacted', nextAction: 'Handled elsewhere', dueAt: localDaysFromNow(2, 12, 0), contactEligible: 1, owner: 'Asha Nair', ownerTeam: 'Wealth Alpha', history: reassignedHist, reassignedAway: 1, prefLang: 'English', contactPerm: 'active', need: null, intakeKind: 'routed', lostReason: null, lostExplanation: null, lostFutureContact: null, lostAt: null, createdAt: nowIso },
    { id: 'FV-1047', vertical: 'wealth', team: 'TEAM-WEALTH-ALPHA', employee: 'EMP-001', name: 'Prospect H', masked: '•••• •• 4071', phone: '+91 98765 40710', email: null, product: 'V1 product', source: 'Website', sourceDetail: null, stage: 'contacted', nextAction: 'No outreach — opt-out recorded', dueAt: localDaysFromNow(5, 12, 0), contactEligible: 0, owner: 'Asha Nair', ownerTeam: 'Wealth Alpha', history: ashaHist, reassignedAway: 0, prefLang: 'English', contactPerm: 'none', need: null, intakeKind: 'routed', lostReason: null, lostExplanation: null, lostFutureContact: null, lostAt: null, createdAt: nowIso },
    // Wealth lead (EMP-002) — cross-employee isolation.
    { id: 'FV-1050', vertical: 'wealth', team: 'TEAM-WEALTH-ALPHA', employee: 'EMP-002', name: 'Prospect F', masked: '•••• •• 4501', phone: '+91 98765 45010', email: null, product: 'V1 product', source: 'Referral', sourceDetail: null, stage: 'not-contacted', nextAction: 'Intro call', dueAt: localDaysFromNow(1, 12, 0), contactEligible: 1, owner: 'Kiran Rao', ownerTeam: 'Wealth Alpha', history: kiranHist, reassignedAway: 0, prefLang: 'English', contactPerm: 'active', need: null, intakeKind: 'routed', lostReason: null, lostExplanation: null, lostFutureContact: null, lostAt: null, createdAt: nowIso },
  ];

  for (const l of leads) {
    insertLead.run(
      l.id, l.vertical, l.team, l.employee, l.name, l.masked, l.phone, l.email,
      l.product, l.source, l.sourceDetail, l.stage, l.nextAction, l.dueAt, l.contactEligible,
      l.owner, l.ownerTeam, l.history, l.reassignedAway,
      l.prefLang, l.contactPerm, l.need, l.intakeKind,
      l.lostReason, l.lostExplanation, l.lostFutureContact, l.lostAt, l.createdAt, l.createdAt
    );
  }

  const insertTask = db.prepare(
    `INSERT INTO lead_tasks (id, lead_id, title, due_at, priority, status, purpose, reminder_at, kind, original_due_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertTask.run('TASK-001', 'FV-2002', 'Follow-up call', '2026-09-25T15:00:00Z', 'normal', 'open', 'Confirm documents', '2026-09-25T14:45:00Z', 'follow-up', null, '2026-09-23T14:35:00Z');
  const task120Due = localDaysFromNow(1, 11, 0);
  insertTask.run('TASK-120', 'FV-1043', 'Follow-up call', task120Due, 'normal', 'open', 'Confirm documents', plusSeconds(task120Due, -15 * 60), 'follow-up', null, nowIso);
  insertTask.run('TASK-002', 'FV-1045', 'Await documents', localDaysFromNow(2, 10, 0), 'normal', 'open', 'Collect income proof', null, 'document', null, nowIso);

  const insertAct = db.prepare(
    `INSERT INTO lead_activities (id, lead_id, actor, type, subject, description, outcome, event_at, created_at, evidence_status, provider_ref, actor_team, actor_role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertAct.run('ACT-001', 'FV-2001', 'System', 'note', 'Lead routed to caller', 'Assigned by intake routing', null, '2026-09-20T09:00:00Z', '2026-09-20T09:00:00Z', 'system', null, null, null);
  insertAct.run('ACT-002', 'FV-2002', 'Ravi Kumar', 'call', 'Intro call completed', 'Discussed vehicle finance requirements', 'Connected', '2026-09-23T14:00:00Z', '2026-09-23T14:30:00Z', 'simulated', null, 'Banking Alpha', 'SC');
  const act3At = localDaysFromNow(-2, 14, 0);
  insertAct.run('ACT-003', 'FV-1043', 'EMP-001', 'call', 'Intro call completed', 'Discussed V1 product requirements', 'Connected', act3At, act3At, 'simulated', 'CALL-7821', 'Wealth Alpha', 'SC');
  const act4At = localDaysFromNow(-3, 12, 0);
  insertAct.run('ACT-004', 'FV-1042', 'System', 'note', 'Enquiry routed', 'Assigned by intake routing', null, act4At, act4At, 'system', null, 'Wealth Alpha', 'SC');

  const callStarted = localDaysFromNow(-2, 14, 0);
  db.prepare(
    `INSERT INTO calls (id, lead_id, employee_id, idempotency_key, state, provider_ref, simulated, started_at, connected_at, ended_at, duration_seconds, wrapup_disposition, wrapup_need_confirmed, wrapup_note, wrapup_next_action, wrapup_due_at, wrapup_saved_at, wrapup_draft_json, wrapup_draft_expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'CALL-7821', 'FV-1043', 'EMP-001', 'seed-call-7821', 'ended', 'CALL-7821', 1,
    callStarted, plusSeconds(callStarted, 10), localDaysFromNow(-2, 14, 7), 420,
    'connected', 1, 'Callback requested', 'Follow-up call', localDaysFromNow(1, 11, 0),
    localDaysFromNow(-2, 14, 10), null, null, callStarted
  );

  const insertMsg = db.prepare(
    `INSERT INTO messages (id, lead_id, employee_id, direction, channel, template_key, language, body, variables_json, provider_ref, status, inbound_event_id, intent, handled, handled_by, handled_at, event_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const msg1At = localDaysFromNow(-1, 10, 0);
  insertMsg.run('MSG-1001', 'FV-1042', 'EMP-001', 'outbound', 'whatsapp', 'appointment-reminder', 'English', 'Reminder: your consultation is scheduled. Reply to reschedule.', null, 'sim-wa-1001', 'delivered', null, null, 0, null, null, msg1At, msg1At);
  const msg2At = localDaysFromNow(0, 14, 10);
  insertMsg.run('MSG-1002', 'FV-1042', null, 'inbound', 'whatsapp', null, null, 'Please reschedule my appointment', null, null, 'received', 'EVT-IN-1001', 'Reschedule', 0, null, null, msg2At, msg2At);

  const suppAt = localDaysFromNow(-7, 12, 0);
  db.prepare(
    `INSERT INTO suppressions (id, lead_id, channels_json, source, received_at, note, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('SUP-001', 'FV-1047', '["whatsapp"]', 'Customer reply', suppAt, 'Customer asked to stop WhatsApp contact', 1, suppAt);

  const reviewAt = localDaysFromNow(-3, 12, 0);
  db.prepare(
    `INSERT INTO reviews (id, employee_id, period, reviewer_name, self_reflection, commitments_json, employee_response, acknowledged_at, rating_private, snapshot_json, snapshot_version, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'REV-2026-09', 'EMP-001', '2026-09', 'Meera Rao', null, '[]', null, null, 'Exceeds expectations',
    '{"verifiedCalls":31,"connected":18,"followUpsDue":9,"followUpsCompleted":8,"wins":2,"estimatedPipelineValue":450000,"period":"2026-09"}',
    'v3', 'awaiting-employee', reviewAt, reviewAt
  );

  db.prepare(
    `INSERT INTO targets (id, employee_id, period, metric, value, currency) VALUES (?, ?, ?, ?, ?, ?)`
  ).run('TGT-001', 'EMP-001', '2026-09', 'wins', 5, 'INR');

  db.prepare(
    `INSERT INTO doc_requests (id, lead_id, checklist_version, items_json, due_at, reminder_enabled, token, token_expires_at, channel, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'DQR-001', 'FV-1042', 'V1 product version 2', '["Identity proof","Address proof","Income proof"]',
    localDaysFromNow(7, 12, 0), 1, 'tok-demo-1042', new Date(Date.now() + 48 * 3600 * 1000).toISOString(), 'whatsapp', 'sent', nowIso
  );

  const insertDoc = db.prepare(
    `INSERT INTO documents (id, lead_id, request_id, doc_type, file_name, size_bytes, mime, version, visibility, scan_status, review_status, review_reason, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertDoc.run('DOC-001', 'FV-1042', 'DQR-001', 'Identity proof', 'identity-proof.pdf', 184320, 'application/pdf', 1, 'reviewers', 'clean', 'pending', null, 'customer (secure link)', nowIso);
  insertDoc.run('DOC-002', 'FV-1042', null, 'Address proof', 'update-flash.exe', 92160, 'application/octet-stream', 1, null, 'quarantined', 'pending', null, 'customer (secure link)', nowIso);
}
