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
        ],
      },
      {
        role: 'Relationship Manager',
        accounts: [
          { role: 'Relationship Manager', name: 'Tara Iyer', scope: 'Wealth · Wealth Alpha + Wealth Beta', email: 'tara@finverse.demo', status: IMPL },
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
          { role: 'Sales Caller', name: 'Dev Kapoor', scope: 'Banking · Banking Alpha', email: 'dev@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'Relationship Manager',
        accounts: [
          { role: 'Relationship Manager', name: 'Rohan Sen', scope: 'Banking · Banking Alpha', email: 'rohan@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'Manager',
        accounts: [
          { role: 'Manager', name: 'Kunal Shah', scope: 'Banking · Banking Alpha + Beta', email: 'kunal@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'Regional Manager',
        accounts: [
          { role: 'Regional Manager', name: 'Arjun Mehta', scope: 'Banking · Commercial Banking West Zone', email: 'arjun@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'National Manager',
        accounts: [
          { role: 'National Manager', name: 'Suresh Nair', scope: 'Banking · National Scope (West + North Zones)', email: 'suresh@finverse.demo', status: IMPL },
        ],
      },
    ],
  },
  {
    id: 'markets',
    title: 'Markets / Trading',
    roles: [
      {
        role: 'Sales Caller',
        accounts: [
          { role: 'Sales Caller', name: 'Kabir Joshi', scope: 'Markets · Markets Alpha', email: 'kabir@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'Relationship Manager',
        accounts: [
          { role: 'Relationship Manager', name: 'Meera Nair', scope: 'Markets · Markets Alpha', email: 'meera@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'Manager',
        accounts: [
          { role: 'Manager', name: 'Manish Vyas', scope: 'Markets · Markets Alpha + Beta', email: 'manish@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'Regional Manager',
        accounts: [
          { role: 'Regional Manager', name: 'Rajesh Bansal', scope: 'Markets · Markets & Securities West Zone', email: 'rajesh.b@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'National Manager',
        accounts: [
          { role: 'National Manager', name: 'Sanjay Singhania', scope: 'Markets · National Scope (West + North Zones)', email: 'sanjay@finverse.demo', status: IMPL },
        ],
      },
    ],
  },
  {
    id: 'real-estate',
    title: 'Real Estate Advisory',
    roles: [
      {
        role: 'Sales Caller',
        accounts: [
          { role: 'Sales Caller', name: 'Sameer Kulkarni', scope: 'Real Estate · Real Estate Alpha (Luxury Residential)', email: 'sameer@finverse.demo', status: IMPL },
          { role: 'Sales Caller', name: 'Kunal Rao', scope: 'Real Estate · Real Estate Beta (Commercial Mandates)', email: 'kunal.r@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'Relationship Manager',
        accounts: [
          { role: 'Relationship Manager', name: 'Neha Gupta', scope: 'Real Estate · Real Estate Alpha', email: 'neha.g@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'Manager',
        accounts: [
          { role: 'Manager', name: 'Vikramaditya Singhania', scope: 'Real Estate · Real Estate Alpha + Beta', email: 'vikramaditya@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'Regional Manager',
        accounts: [
          { role: 'Regional Manager', name: 'Siddharth Malhotra', scope: 'Real Estate · Real Estate Advisory West Zone', email: 'siddharth.m@finverse.demo', status: IMPL },
        ],
      },
      {
        role: 'National Manager',
        accounts: [
          { role: 'National Manager', name: 'Aditya Singhania', scope: 'Real Estate · National Scope (West + North Zones)', email: 'aditya@finverse.demo', status: IMPL },
        ],
      },
    ],
  },
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
    {
      role: 'Super Admin — all verticals (system governance)',
      accounts: [
        { role: 'SA', name: 'Alok Verma', scope: 'Company function · Identity & Access', email: 'alok@finverse.demo', status: IMPL },
      ],
    },
    {
      role: 'Human Resources — all verticals (people operations)',
      accounts: [
        { role: 'HR', name: 'Pooja Sharma', scope: 'Company function · People Operations', email: 'pooja@finverse.demo', status: IMPL },
      ],
    },
    {
      role: 'Data Entry — operational workspace (intake pipelines)',
      accounts: [
        { role: 'DE', name: 'Deepa Patel', scope: 'All Verticals · Intake & Allocation', email: 'deepa@finverse.demo', status: IMPL },
      ],
    },
  ],
};

export const STATUS_LABEL: Record<DemoStatus, string> = {
  implemented: 'Implemented — verification pending',
  shared: 'Shared Caller screens — Banking build pending',
  'not-implemented': 'Not implemented yet',
};
