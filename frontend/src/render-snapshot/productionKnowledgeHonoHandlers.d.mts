export function fetchProductionKnowledgeHono(
  request: Request,
  env: unknown,
  executionContext: unknown,
): Promise<Response>;

export type ProductionKnowledgeOverviewRow = {
  row_kind: 'article' | 'status';
  row_key: string;
  payload_json: string;
};

export function auditProductionKnowledgeOverviewProjection(db: unknown): Promise<{
  consistent: boolean;
  active_generation: number;
  source_version: number;
}>;
export function hashProductionKnowledgeOverviewRows(rows: ProductionKnowledgeOverviewRow[]): Promise<string>;
export function loadProductionKnowledgeOverviewRows(db: unknown): Promise<ProductionKnowledgeOverviewRow[]>;
export function refreshProductionKnowledgeOverviewProjection(
  db: unknown,
  guard: {
    active_generation: number;
    source_version: number;
    expected_record_count: number;
    content_hash: string;
  },
): Promise<{ applied: boolean; active_generation: number }>;
