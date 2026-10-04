import type { ArchiveEntry } from '../data/types';

const KEY = 'boundary-emotion-archive-v1';
const DRAFT_PREFIX = 'boundary-emotion-draft-v1:';

export function loadArchive(): ArchiveEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 每一套测试最多留 30 条，其余按时间从旧到新丢掉。 */
export const PER_TEST_MAX = 30;

function capPerTest(list: ArchiveEntry[]): ArchiveEntry[] {
  const seen: Record<string, number> = {};
  return list.filter((e) => {
    seen[e.testId] = (seen[e.testId] ?? 0) + 1;
    return seen[e.testId] <= PER_TEST_MAX;
  });
}

/** 保存一条结果。失败（无痕模式、空间满）时不抛错，返回 false，结果页照常能看。 */
export function saveArchiveEntry(entry: ArchiveEntry): boolean {
  const list = capPerTest([entry, ...loadArchive()]);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12)));
      return true;
    } catch {
      return false;
    }
  }
}

export function deleteArchiveEntry(entry: ArchiveEntry): void {
  const list = loadArchive().filter(
    (e) => !(e.testId === entry.testId && e.completedAt === entry.completedAt),
  );
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* 忽略 */
  }
}

export function clearArchive(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 忽略 */
  }
}

export function saveDraft(testId: string, draft: unknown): void {
  try {
    localStorage.setItem(DRAFT_PREFIX + testId, JSON.stringify(draft));
  } catch {
    /* 存不下草稿也不影响继续作答 */
  }
}

export function loadDraft<T>(testId: string): T | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + testId);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearDraft(testId: string): void {
  try {
    localStorage.removeItem(DRAFT_PREFIX + testId);
  } catch {
    /* 忽略 */
  }
}
