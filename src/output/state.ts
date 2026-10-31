/**
 * 完了済み (URL, strategy) の記録と resume (F2-8、設計判断 5.4)。
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

export interface StateEntry {
  url: string;
  strategy: string;
}

export function stateKey(url: string, strategy: string): string {
  return `${strategy}\t${url}`;
}

export class StateStore {
  readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  /** state.jsonl を読む。壊れた最終行は無視する。 */
  load(): Set<string> {
    const done = new Set<string>();
    if (!existsSync(this.path)) return done;
    const lines = readFileSync(this.path, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      try {
        const entry = JSON.parse(trimmed) as StateEntry;
        if (typeof entry.url === 'string' && typeof entry.strategy === 'string') {
          done.add(stateKey(entry.url, entry.strategy));
        }
      } catch {
        // 書き込み途中で壊れた行は無視する (5.4)
      }
    }
    return done;
  }

  /** 1 件ずつ追記する。 */
  append(url: string, strategy: string): void {
    appendFileSync(this.path, JSON.stringify({ url, strategy }) + '\n', 'utf8');
  }
}

/** output ルート直下の実行 ID ディレクトリから最新のものを返す。 */
export function latestRunId(
  listDir: (path: string) => string[],
  outputRoot: string,
): string | null {
  const entries = listDir(outputRoot).filter((name) => /^\d{8}-\d{6}$/.test(name));
  entries.sort();
  return entries.length > 0 ? entries[entries.length - 1]! : null;
}
