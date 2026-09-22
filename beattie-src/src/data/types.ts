export type StarMark = 0 | 1 | 2 | 3;

export interface LikertItem {
  id: number;
  text: string;
  stars: StarMark;
  note?: string;
}

export type McqScoreMap = Partial<Record<'A' | 'B' | 'C' | 'D' | 'E', number>>;

export interface McqItem {
  id: number;
  prompt: string;
  options: { key: 'A' | 'B' | 'C' | 'D' | 'E'; text: string; stars?: StarMark }[];
  /** Points awarded for each option letter */
  scores: McqScoreMap;
  /** If the question does not apply, award this many points (book rule) */
  naScore?: number;
  scoreNote?: string;
}

export type TfExpected = 'yes' | 'no' | 'either';

export interface TfItem {
  id: number;
  text: string;
  stars: StarMark;
  /** Correct answer for scoring. 'either' means both √ and × score full points. */
  expected: TfExpected;
  note?: string;
}

export interface ScoreBand {
  min: number;
  max: number;
  text: string;
}

export interface QuizTest {
  id: string;
  chapter: number;
  title: string;
  assessmentTitle: string;
  warning?: string;
  likertNotes?: string[];
  likertItems: LikertItem[];
  mcqItems: McqItem[];
  tfItems: TfItem[];
  tfIntroNote?: string;
  tfScoringNote?: string;
  bands: ScoreBand[];
  maxPossible: number;
}

export interface ArchiveEntry {
  testId: string;
  title: string;
  completedAt: string;
  sectionScores: { assessment: number; mcq: number; tf: number };
  total: number;
  bandText: string;
}
