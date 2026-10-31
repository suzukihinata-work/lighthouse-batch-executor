/**
 * CSV の列定義と columns.json (F4-7、設計判断 5.1)。
 */
import { promises as fs } from 'node:fs';
import { CSV_SCHEMA_VERSION } from '../config.js';
import type { AggregatedResult } from '../aggregate/median.js';
import { CATEGORY_SCORE_COLUMNS, METRIC_AUDITS } from '../aggregate/extract.js';

/** 固定列 (スキーマバージョンで管理される) */
export const FIXED_COLUMNS: readonly string[] = [
  'schema_version',
  'url',
  'strategy',
  'fetched_at',
  'lighthouse_version',
  'runs_total',
  'runs_succeeded',
  'status',
  'error_message',
  'final_url',
  'raw_path',
  'score_performance',
  'score_accessibility',
  'score_best_practices',
  'score_seo',
  ...Object.keys(METRIC_AUDITS),
  'failed_audits',
  'opportunities_json',
  'diagnostics_json',
];

export interface ColumnDefinition {
  schema_version: number;
  columns: string[];
}

/** 最初に成功した集約結果から、audit 由来の動的列を確定する。 */
export function buildColumnDefinition(sample: AggregatedResult): ColumnDefinition {
  const auditIds = Object.keys(sample.audits).sort();
  const auditColumns = auditIds.flatMap((id) => [`audit:${id}:score`, `audit:${id}:value`]);
  return {
    schema_version: CSV_SCHEMA_VERSION,
    columns: [...FIXED_COLUMNS, ...auditColumns],
  };
}

/** 全 URL が失敗した場合の固定列のみの定義。 */
export function fixedOnlyColumnDefinition(): ColumnDefinition {
  return { schema_version: CSV_SCHEMA_VERSION, columns: [...FIXED_COLUMNS] };
}

export async function saveColumnDefinition(path: string, def: ColumnDefinition): Promise<void> {
  await fs.writeFile(path, JSON.stringify(def, null, 2) + '\n', 'utf8');
}

export async function loadColumnDefinition(path: string): Promise<ColumnDefinition> {
  const text = await fs.readFile(path, 'utf8');
  return JSON.parse(text) as ColumnDefinition;
}

/** 集約結果を 1 行分の値 (列名 → 値) に組み立てる。columns に無い動的列は無視する。 */
export function buildRowValues(
  def: ColumnDefinition,
  url: string,
  strategy: string,
  result: AggregatedResult,
  rawPath: string,
  unknownAuditIds: string[] = [],
): Record<string, string> {
  const row: Record<string, string> = {};
  for (const col of def.columns) row[col] = '';

  row['schema_version'] = String(def.schema_version);
  row['url'] = url;
  row['strategy'] = strategy;
  row['fetched_at'] = result.fetchedAt;
  row['lighthouse_version'] = result.lighthouseVersion;
  row['runs_total'] = String(result.runsTotal);
  row['runs_succeeded'] = String(result.runsSucceeded);
  row['status'] = result.status;
  row['error_message'] = result.errorMessage ?? '';
  row['final_url'] = result.finalUrl;
  row['raw_path'] = rawPath;

  for (const [column, category] of Object.entries(CATEGORY_SCORE_COLUMNS)) {
    const value = result.scores[category];
    row[column] = value === null || value === undefined ? '' : String(Math.round(value));
  }
  for (const metric of Object.keys(METRIC_AUDITS)) {
    const value = result.metrics[metric];
    row[metric] = value === null || value === undefined ? '' : String(value);
  }
  row['failed_audits'] = result.failedAudits.join(';');
  row['opportunities_json'] = JSON.stringify(result.opportunities);
  row['diagnostics_json'] = JSON.stringify(result.diagnostics);

  const known = new Set(def.columns);
  for (const [id, audit] of Object.entries(result.audits)) {
    const scoreCol = `audit:${id}:score`;
    const valueCol = `audit:${id}:value`;
    if (known.has(scoreCol)) {
      row[scoreCol] = audit.score === null || audit.score === undefined ? '' : String(audit.score);
    } else {
      unknownAuditIds.push(id);
    }
    if (known.has(valueCol)) {
      row[valueCol] = audit.numericValue === undefined ? '' : String(audit.numericValue);
    }
  }
  return row;
}
