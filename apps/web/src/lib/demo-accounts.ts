/**
 * TEMPORARY demo-access directory — synthetic accounts only (mirrors database/seed.ts).
 * Loaded only by DemoAccessPanel, which LoginPage imports solely in dev or when
 * VITE_DEMO_ACCESS=true; production builds tree-shake this module away.
 * PRODUCTION HANDOVER: remove this file, DemoAccessPanel and the login hook
 * (see docs/process/PRODUCTION_HANDOVER.md).
 * Passwords here are the synthetic seed password; real credentials never belong here.
 */
export const DEMO_PASSWORD = 'demo1234';

export type DemoStatus = 'implemented' | 'shared' | 'not-implemented';

export interface DemoAccount {
  role: string;
  name: string;
  scope: string;
  email: string;
  status: DemoStatus;
}

export interface DemoRoleRow {
  role: string;
  /** Present only for working accounts; absent roles render "Not implemented yet". */
  accounts: DemoAccount[];
}

export interface DemoGroup {
  id: string;
  title: string;
  roles: DemoRoleRow[];
}

const IMPL = 'implemented' as const;

export const DEMO_GROUPS: DemoGroup[] = [
  {
    id: 'wealth',
    title: 'Wealth',
    roles: [
      {
        role: 'Sales Caller',
        accounts: [
          { role: 'Sales Caller', name: 'Asha Rao', scope: 'Wealth · Wealth Alpha', email: 'asha@finverse.demo', status: IMPL },
          { role: 'Sales Caller', name: 'Ravi Menon', scope: 'Wealth · Wealth Beta', email: 'ravi@finverse.demo', status: IMPL },
          { role: 'Sales Caller', name: 'Priya Sharma', scope: 'Wealth · Wealth Alpha', email: 'priya@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'Team Lead',
        accounts: [
          { role: 'Team Lead', name: 'Tara Iyer', scope: 'Wealth · Wealth Alpha + Wealth Beta', email: 'tara@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'Manager',
        accounts: [
          { role: 'Manager', name: 'Neel Verma', scope: 'Wealth · Wealth Alpha + Beta + Gamma', email: 'neel@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'Regional Manager',
        accounts: [
          { role: 'Regional Manager', name: 'Kavita Rao', scope: 'Wealth · South Region', email: 'kavita@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'National Manager',
        accounts: [
          { role: 'National Manager', name: 'Vikram Malhotra', scope: 'Wealth · All Regions', email: 'vikram@finverse.demo', status: IMPL },
        ],
      },
    ],
  },
  {
    id: 'banking',
    title: 'Banking',
    roles: [
      {
        role: 'Sales Caller',
        accounts: [
          { role: 'Sales Caller', name: 'Dev Kapoor', scope: 'Banking · Banking Alpha', email: 'dev@finverse.demo', status: 'shared' },
        ],
      },
      { role: 'Team Lead', accounts: [] },
      { role: 'Manager', accounts: [] },
    ],
  },
  { id: 'markets', title: 'Markets / Trading', roles: [{ role: 'All roles', accounts: [] }] },
  { id: 'real-estate', title: 'Real Estate', roles: [{ role: 'All roles', accounts: [] }] },
];

export const DEMO_EXECUTIVE_GROUP: DemoGroup = {
  id: 'executive',
  title: 'Executive & administration',
  roles: [
    {
      role: 'CEO — all verticals (executive scope)',
      accounts: [
        { role: 'CEO', name: 'Rajiv Mehta', scope: 'All Verticals · Executive', email: 'rajiv@finverse.demo', status: IMPL },
      ],
    },
    {
      role: 'CFO — all verticals (financial scope)',
      accounts: [
        { role: 'CFO', name: 'Ananya Roy', scope: 'All Verticals · Finance', email: 'ananya@finverse.demo', status: IMPL },
      ],
    },
    { role: 'Administration — HR / Data / System admin', accounts: [] },
  ],
};

export const STATUS_LABEL: Record<DemoStatus, string> = {
  implemented: 'Implemented — verification pending',
  shared: 'Shared Caller screens — Banking build pending',
  'not-implemented': 'Not implemented yet',
};
