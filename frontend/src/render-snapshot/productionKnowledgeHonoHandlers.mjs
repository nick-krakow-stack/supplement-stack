import knowledge from '../../../functions/api/modules/knowledge.ts';
import ingredients from '../../../functions/api/modules/ingredients.ts';
import { r2App } from '../../../functions/api/modules/products.ts';
import publicStats from '../../../functions/api/modules/public-stats.ts';
import {
  auditKnowledgeOverviewProjection,
  hashKnowledgeOverviewRows,
  loadLiveKnowledgeOverviewRows,
  refreshKnowledgeOverviewProjection,
} from '../../../functions/api/modules/knowledge-overview-projection.ts';

const HonoConstructor = knowledge.constructor;
const mountedApiApp = new HonoConstructor();
mountedApiApp.route('/api/knowledge', knowledge);
mountedApiApp.route('/api/ingredients', ingredients);
mountedApiApp.route('/api/public-stats', publicStats);
mountedApiApp.route('/api/r2', r2App);

export function fetchProductionKnowledgeHono(request, env, executionContext) {
  return mountedApiApp.fetch(request, env, executionContext);
}

export function auditProductionKnowledgeOverviewProjection(db) {
  return auditKnowledgeOverviewProjection(db);
}

export function hashProductionKnowledgeOverviewRows(rows) {
  return hashKnowledgeOverviewRows(rows);
}

export function loadProductionKnowledgeOverviewRows(db) {
  return loadLiveKnowledgeOverviewRows(db);
}

export function refreshProductionKnowledgeOverviewProjection(db, guard) {
  return refreshKnowledgeOverviewProjection(db, guard);
}
