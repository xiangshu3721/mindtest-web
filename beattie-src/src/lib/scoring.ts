import type { McqItem, QuizTest, TfItem, ScoreBand } from '../data/types';

export function scoreLikert(values: (number | null)[]): number {
  return values.reduce<number>((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
}

export function scoreMcq(
  items: McqItem[],
  answers: (string | 'NA' | null)[],
): number {
  return items.reduce((sum, item, i) => {
    const a = answers[i];
    if (a === null || a === undefined) return sum;
    if (a === 'NA') {
      return sum + (item.naScore ?? 0);
    }
    const pts = item.scores[a as keyof typeof item.scores];
    return sum + (typeof pts === 'number' ? pts : 0);
  }, 0);
}

export function scoreTf(
  items: TfItem[],
  answers: (('yes' | 'no' | 'NA') | null)[],
): number {
  return items.reduce((sum, item, i) => {
    const a = answers[i];
    if (a === null || a === undefined) return sum;
    // Guilt Q6 / similar: if unsuitable, award 10 (encoded as NA when stars===2 and user picks N/A)
    if (a === 'NA') return sum + 10;
    if (item.expected === 'either') return sum + 10;
    if (a === item.expected) return sum + 10;
    return sum;
  }, 0);
}

export function findBand(bands: ScoreBand[], total: number): ScoreBand | undefined {
  return bands.find((b) => total >= b.min && total <= b.max);
}

export function computeTotal(test: QuizTest, sections: {
  assessment: number;
  mcq: number;
  tf: number;
}): { total: number; band?: ScoreBand } {
  const total = sections.assessment + sections.mcq + sections.tf;
  return { total, band: findBand(test.bands, total) };
}

export function starsLabel(n: 0 | 1 | 2 | 3): string {
  if (n <= 0) return '';
  return '★'.repeat(n);
}
