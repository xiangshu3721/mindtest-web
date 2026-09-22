import type { QuizTest } from './types';
import { emotionalHealth } from './emotional-health';
import { anger } from './anger';
import { fear } from './fear';
import { drama } from './drama';
import { guilt } from './guilt';
import { grief } from './grief';

export const allTests: QuizTest[] = [
  emotionalHealth,
  anger,
  fear,
  drama,
  guilt,
  grief,
];

export function getTestById(id: string): QuizTest | undefined {
  return allTests.find((t) => t.id === id);
}

export * from './types';
export * from './intro';
