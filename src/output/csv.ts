/**
 * RFC 4180 のエスケープと、CSV への逐次追記 (F4)、および読み取り。
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

/** RFC 4180 に従ったフィールドのエスケープ。 */
export function escapeField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/** 1 行分の CSV 文字列 (改行は LF)。 */
export function toCsvLine(values: string[]): string {
  return values.map(escapeField).join(',') + '\n';
}

/** RFC 4180 を前提とした 1 行の解析。 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export interface CsvTable {
  header: string[];
  rows: string[][];
}

/** CSV ファイルを読む (BOM を除去する)。ファイルが無ければ null。 */
export function readCsv(path: string): CsvTable | null {
  if (!existsSync(path)) return null;
  const content = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const lines = content.split('\n').filter((l) => l !== '');
  if (lines.length === 0) return null;
  const header = parseCsvLine(lines[0]!);
  return { header, rows: lines.slice(1).map((l) => parseCsvLine(l)) };
}

export class CsvWriter {
  readonly path: string;
  private readonly bom: boolean;
  private initialized = false;

  constructor(path: string, options: { bom?: boolean } = {}) {
    this.path = path;
    this.bom = options.bom ?? false;
  }

  /** ヘッダー行を書く (ファイルを新規作成する)。 */
  writeHeader(columns: string[]): void {
    const bom = this.bom ? '\uFEFF' : '';
    writeFileSync(this.path, bom + toCsvLine(columns), 'utf8');
    this.initialized = true;
  }

  /** 既存ファイルへの追記を続ける (resume 時)。ヘッダーを書き直さない。 */
  continueExisting(): void {
    this.initialized = true;
  }

  /** 1 行を追記する (F4-6: 途中経過を逐次残す)。 */
  appendRow(columns: string[], row: Record<string, string>): void {
    if (!this.initialized) this.writeHeader(columns);
    appendFileSync(this.path, toCsvLine(columns.map((c) => row[c] ?? '')), 'utf8');
  }
}
