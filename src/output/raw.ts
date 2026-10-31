/**
 * 生 JSON の gzip 保存と index.csv (F6、設計判断 5.5)。
 */
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import type { Lhr } from '../lighthouse/types.js';

/** 機密情報 (extraHeaders) を生 JSON から取り除く。5.5 参照。 */
export function sanitizeLhr(lhr: Lhr): Lhr {
  const settings = lhr.configSettings;
  if (settings && ('extraHeaders' in settings || 'headers' in settings)) {
    const { extraHeaders, headers, ...rest } = settings as Record<string, unknown>;
    void extraHeaders;
    void headers;
    return { ...lhr, configSettings: { ...rest, extraHeaders: {}, headers: {} } };
  }
  return lhr;
}

export function urlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16);
}

export class RawStore {
  readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    mkdirSync(join(rootDir, 'mobile'), { recursive: true });
    mkdirSync(join(rootDir, 'desktop'), { recursive: true });
    writeFileSync(this.indexPath, 'url,strategy,run,file\n', { flag: 'a', encoding: 'utf8' });
  }

  private get indexPath(): string {
    return join(this.rootDir, 'index.csv');
  }

  /** 1 run 分の LHR を gzip で保存し、index.csv に記録して相対パスを返す。 */
  save(url: string, strategy: string, runNumber: number, lhr: Lhr): string {
    const safeStrategy = strategy === 'desktop' ? 'desktop' : 'mobile';
    const fileName = `${urlHash(url)}-run${runNumber}.json.gz`;
    const relative = `${safeStrategy}/${fileName}`;
    const absolute = join(this.rootDir, relative);
    const sanitized = sanitizeLhr(lhr);
    writeFileSync(absolute, gzipSync(Buffer.from(JSON.stringify(sanitized), 'utf8')));
    appendFileSync(
      this.indexPath,
      `${JSON.stringify(url)},${safeStrategy},${runNumber},${relative}\n`,
      'utf8',
    );
    return absolute;
  }
}
