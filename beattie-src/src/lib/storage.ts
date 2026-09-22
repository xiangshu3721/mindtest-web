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

export function saveArchiveEntry(entry: ArchiveEntry): ArchiveEntry[] {
  const list = loadArchive();
  list.unshift(entry);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
  return list;
}

export function clearArchive(): void {
  localStorage.removeItem(KEY);
}

export function saveDraft(testId: string, draft: unknown): void {
  localStorage.setItem(DRAFT_PREFIX + testId, JSON.stringify(draft));
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
  localStorage.removeItem(DRAFT_PREFIX + testId);
}
