import type { DashboardConfig } from './types';

export const DASHBOARDS: DashboardConfig[] = [
  {
    id: 'deal',
    name: 'Deal Dashboard',
    shortName: 'Deals',
    iconName: 'Briefcase',
    description: 'Real-time sales deal flow, revenue pipelines & conversion intelligence',
    status: 'active',
    badge: 'LIVE',
    category: 'core'
  },
  {
    id: 'sales',
    name: 'Sales Dashboard',
    shortName: 'Sales',
    iconName: 'TrendingUp',
    description: 'Comprehensive sales performance, team targets & quotas',
    status: 'coming_soon',
    badge: 'SOON',
    category: 'core'
  },
  {
    id: 'project',
    name: 'Project Dashboard',
    shortName: 'Projects',
    iconName: 'FolderKanban',
    description: 'Project delivery timelines, resource allocation & budget variance analytics',
    status: 'active',
    badge: 'LIVE',
    category: 'operations'
  },
  {
    id: 'service',
    name: 'Service Dashboard',
    shortName: 'Service',
    iconName: 'Headphones',
    description: 'Customer support SLAs, ticket analytics & CSAT scores',
    status: 'coming_soon',
    badge: 'SOON',
    category: 'operations'
  }
];

export function getDashboardConfig(id: string): DashboardConfig | undefined {
  return DASHBOARDS.find(d => d.id === id);
}
