/**
 * Finverse CRM — Module Manifest
 *
 * Maps session grants to navigation modules.
 * Navigation must derive from permitted modules, not display links to other roles.
 */

import type { WorkspaceSession, Vertical } from './session';

export interface Module {
  key: string;
  label: string;
  description: string;
  icon: string; // lucide-react icon name
  requiredVerticals: Vertical[];
  requiredActions: string[];
  href: string;
  badge?: string;
}

export interface ModuleGroup {
  key: string;
  label: string;
  modules: Module[];
}

// Module definitions for all four verticals
const ALL_MODULES: Module[] = [
  // Wealth vertical modules
  {
    key: 'wealth.dashboard',
    label: 'Wealth Dashboard',
    description: 'Personal pipeline and activity overview',
    icon: 'layout-dashboard',
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:personal'],
    href: '/wealth/dashboard',
  },
  {
    key: 'wealth.prospects',
    label: 'Prospects',
    description: 'Manage wealth prospects and leads',
    icon: 'users',
    requiredVerticals: ['wealth'],
    requiredActions: ['prospect.read'],
    href: '/wealth/prospects',
  },
  {
    key: 'wealth.deals',
    label: 'Deals',
    description: 'Track wealth deal pipeline',
    icon: 'handshake',
    requiredVerticals: ['wealth'],
    requiredActions: ['deal.read'],
    href: '/wealth/deals',
  },
  {
    key: 'wealth.activities',
    label: 'Activities',
    description: 'Log and track client interactions',
    icon: 'calendar',
    requiredVerticals: ['wealth'],
    requiredActions: ['activity.read'],
    href: '/wealth/activities',
  },
  {
    key: 'wealth.reports',
    label: 'Reports',
    description: 'Personal performance reports',
    icon: 'bar-chart-2',
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:personal'],
    href: '/wealth/reports',
  },

  // Banking vertical modules
  {
    key: 'banking.dashboard',
    label: 'Banking Dashboard',
    description: 'Banking portfolio overview',
    icon: 'layout-dashboard',
    requiredVerticals: ['banking'],
    requiredActions: ['report.read:personal'],
    href: '/banking/dashboard',
  },
  {
    key: 'banking.clients',
    label: 'Clients',
    description: 'Banking client relationships',
    icon: 'building-2',
    requiredVerticals: ['banking'],
    requiredActions: ['prospect.read'],
    href: '/banking/clients',
  },
  {
    key: 'banking.facilities',
    label: 'Facilities',
    description: 'Credit facilities and loans',
    icon: 'credit-card',
    requiredVerticals: ['banking'],
    requiredActions: ['deal.read'],
    href: '/banking/facilities',
  },

  // Markets vertical modules
  {
    key: 'markets.dashboard',
    label: 'Markets Dashboard',
    description: 'Markets desk overview',
    icon: 'layout-dashboard',
    requiredVerticals: ['markets'],
    requiredActions: ['report.read:personal'],
    href: '/markets/dashboard',
  },
  {
    key: 'markets.orders',
    label: 'Orders',
    description: 'Client order management',
    icon: 'shopping-cart',
    requiredVerticals: ['markets'],
    requiredActions: ['deal.read'],
    href: '/markets/orders',
  },
  {
    key: 'markets.positions',
    label: 'Positions',
    description: 'Current holdings and positions',
    icon: 'pie-chart',
    requiredVerticals: ['markets'],
    requiredActions: ['deal.read'],
    href: '/markets/positions',
  },

  // Real Estate vertical modules
  {
    key: 'real-estate.dashboard',
    label: 'Real Estate Dashboard',
    description: 'Property portfolio overview',
    icon: 'layout-dashboard',
    requiredVerticals: ['real-estate'],
    requiredActions: ['report.read:personal'],
    href: '/real-estate/dashboard',
  },
  {
    key: 'real-estate.properties',
    label: 'Properties',
    description: 'Property listings and deals',
    icon: 'home',
    requiredVerticals: ['real-estate'],
    requiredActions: ['prospect.read'],
    href: '/real-estate/properties',
  },
  {
    key: 'real-estate.clients',
    label: 'Clients',
    description: 'Buyer and seller relationships',
    icon: 'users',
    requiredVerticals: ['real-estate'],
    requiredActions: ['prospect.read'],
    href: '/real-estate/clients',
  },

  // Cross-vertical / Management modules (require multiple verticals or specific roles)
  {
    key: 'management.team',
    label: 'Team Overview',
    description: 'Team performance and pipeline',
    icon: 'users',
    requiredVerticals: [],
    requiredActions: ['report.read:team'],
    href: '/management/team',
  },
  {
    key: 'management.vertical',
    label: 'Vertical Overview',
    description: 'Cross-team vertical performance',
    icon: 'bar-chart-2',
    requiredVerticals: [],
    requiredActions: ['report.read:vertical'],
    href: '/management/vertical',
  },
  {
    key: 'admin.users',
    label: 'User Management',
    description: 'Manage employees and assignments',
    icon: 'user-cog',
    requiredVerticals: [],
    requiredActions: ['admin.user.manage'],
    href: '/admin/users',
  },
  {
    key: 'admin.roles',
    label: 'Roles & Permissions',
    description: 'Configure role assignments',
    icon: 'shield',
    requiredVerticals: [],
    requiredActions: ['admin.role.manage'],
    href: '/admin/roles',
  },
];

// Group modules by vertical for navigation
const MODULE_GROUPS: ModuleGroup[] = [
  {
    key: 'wealth',
    label: 'Wealth',
    modules: ALL_MODULES.filter(m => m.requiredVerticals.includes('wealth')),
  },
  {
    key: 'banking',
    label: 'Banking',
    modules: ALL_MODULES.filter(m => m.requiredVerticals.includes('banking')),
  },
  {
    key: 'markets',
    label: 'Markets',
    modules: ALL_MODULES.filter(m => m.requiredVerticals.includes('markets')),
  },
  {
    key: 'real-estate',
    label: 'Real Estate',
    modules: ALL_MODULES.filter(m => m.requiredVerticals.includes('real-estate')),
  },
  {
    key: 'management',
    label: 'Management',
    modules: ALL_MODULES.filter(m => m.requiredVerticals.length === 0 && m.key.startsWith('management')),
  },
  {
    key: 'admin',
    label: 'Administration',
    modules: ALL_MODULES.filter(m => m.requiredVerticals.length === 0 && m.key.startsWith('admin')),
  },
];

/**
 * Check if a session has access to a module.
 */
export function canAccessModule(session: WorkspaceSession, module: Module): boolean {
  // Check vertical grants
  const hasVertical = module.requiredVerticals.length === 0 ||
    module.requiredVerticals.some(v => session.verticalGrants.includes(v));

  // Check action grants
  const hasAction = module.requiredActions.some(a => {
    if (session.allowedActions.includes('*')) return true;
    return session.allowedActions.includes(a);
  });

  return hasVertical && hasAction;
}

/**
 * Get all modules accessible to a session.
 */
export function getAccessibleModules(session: WorkspaceSession): Module[] {
  return ALL_MODULES.filter(m => canAccessModule(session, m));
}

/**
 * Get module groups with only accessible modules for a session.
 */
export function getAccessibleModuleGroups(session: WorkspaceSession): ModuleGroup[] {
  return MODULE_GROUPS
    .map(group => ({
      ...group,
      modules: group.modules.filter(m => canAccessModule(session, m)),
    }))
    .filter(group => group.modules.length > 0);
}

/**
 * Get the default landing module for a session (first accessible).
 */
export function getDefaultModule(session: WorkspaceSession): Module | null {
  const accessible = getAccessibleModules(session);
  return accessible[0] || null;
}

/**
 * Find a module by key.
 */
export function findModuleByKey(key: string): Module | undefined {
  return ALL_MODULES.find(m => m.key === key);
}

/**
 * Check if a session can access a specific route.
 */
export function canAccessRoute(session: WorkspaceSession, href: string): boolean {
  const found = ALL_MODULES.find(m => m.href === href);
  if (!found) return false; // Unknown route — deny by default
  return canAccessModule(session, found);
}