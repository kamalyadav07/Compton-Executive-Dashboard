import type { DependencyNode } from './types';

const INITIAL_NODES: DependencyNode[] = [
  { id: 'sheet_won', label: 'Won Deals Sheet', type: 'source', dependencies: [], status: 'valid' },
  { id: 'sheet_lost', label: 'Lost Deals Sheet', type: 'source', dependencies: [], status: 'valid' },
  { id: 'sheet_progress', label: 'In Progress Sheet', type: 'source', dependencies: [], status: 'valid' },
  
  { id: 'view_customer_health', label: 'Customer Health View', type: 'view', dependencies: ['sheet_won', 'sheet_progress'], status: 'valid' },
  { id: 'view_salesperson_kpi', label: 'Salesperson KPI View', type: 'view', dependencies: ['sheet_won', 'sheet_lost'], status: 'valid' },
  { id: 'view_pipeline', label: 'Pipeline Stage View', type: 'view', dependencies: ['sheet_progress'], status: 'valid' },
  
  { id: 'kpi_revenue', label: 'Gross/Net Revenue KPI', type: 'kpi', dependencies: ['view_customer_health', 'sheet_won'], status: 'valid' },
  { id: 'kpi_win_rate', label: 'Win Rate KPI', type: 'kpi', dependencies: ['view_salesperson_kpi'], status: 'valid' },
  { id: 'kpi_pipeline', label: 'Pipeline Value KPI', type: 'kpi', dependencies: ['view_pipeline'], status: 'valid' },

  { id: 'chart_monthly_rev', label: 'Monthly Revenue Chart', type: 'chart', dependencies: ['kpi_revenue'], status: 'valid' },
  { id: 'ai_context', label: 'AI Context Cache', type: 'ai', dependencies: ['kpi_revenue', 'kpi_win_rate'], status: 'valid' }
];

export class DependencyGraph {
  private nodes: Map<string, DependencyNode> = new Map();

  constructor() {
    INITIAL_NODES.forEach(n => this.nodes.set(n.id, { ...n }));
  }

  public getNodes(): DependencyNode[] {
    return Array.from(this.nodes.values());
  }

  // Selective Invalidation Algorithm (Item 14 & 25)
  public invalidateFromSource(sourceId: string): string[] {
    const invalidated: string[] = [sourceId];
    const sourceNode = this.nodes.get(sourceId);
    if (sourceNode) {
      sourceNode.status = 'stale';
      sourceNode.lastInvalidatedAt = new Date().toISOString();
    }

    let addedNew = true;
    while (addedNew) {
      addedNew = false;
      for (const node of this.nodes.values()) {
        if (!invalidated.includes(node.id)) {
          const hasInvalidatedDep = node.dependencies.some(dep => invalidated.includes(dep));
          if (hasInvalidatedDep) {
            invalidated.push(node.id);
            node.status = 'stale';
            node.lastInvalidatedAt = new Date().toISOString();
            addedNew = true;
          }
        }
      }
    }

    return invalidated;
  }

  public markNodeValid(nodeId: string) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = 'valid';
    }
  }

  public markAllValid() {
    this.nodes.forEach(n => n.status = 'valid');
  }
}

export const globalDependencyGraph = new DependencyGraph();
