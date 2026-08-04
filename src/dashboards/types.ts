export type DashboardId = 'deal' | 'sales' | 'project' | 'service' | string;

export interface DashboardConfig {
  id: DashboardId;
  name: string;
  shortName: string;
  iconName: string; // Icon key identifier
  description: string;
  status: 'active' | 'coming_soon';
  badge?: string;
  category?: 'core' | 'operations' | 'management';
}
