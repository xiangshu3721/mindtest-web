/** 六套情绪测试的云端结果。计分用页面上的 scoreLikert / scoreMcq / scoreTf / computeTotal，字段与云函数 beattie-score 对齐。
 * angerFill 不进入这份结果。
 */
import { getTestById } from './data';
import { insightFor, readingFor } from './data/insights';
import { studyAidNote } from './data/intro';
import { computeTotal, scoreLikert, scoreMcq, scoreTf } from './lib/scoring';

export const BEATTIE_READER_GAP = '阅读页若尚未重绘这套情绪测试，总分、评估、选择、判断和分数段在 dimensions、result 与 viewModel。填空不保存。';
export const BEATTIE_DRAMA_NOTE = '悲痛还鲜活时，这套分数容易失真。不确定的话，先做悲痛与失落测试，把引发悲痛的事照顾好，再回来看戏剧化。';

export const BEATTIE_TESTS = [
  { testId: 'emotional-health', id: 'beattie-emotional-health', name: '情绪健康测试' },
  { testId: 'anger', id: 'beattie-anger', name: '愤怒测试' },
  { testId: 'fear', id: 'beattie-fear', name: '恐惧测试' },
  { testId: 'drama', id: 'beattie-drama', name: '戏剧化与不幸成瘾测试' },
  { testId: 'guilt', id: 'beattie-guilt', name: '内疚测试' },
  { testId: 'grief', id: 'beattie-grief', name: '悲痛与失落测试' },
] as const;

const BY_TEST = Object.fromEntries(BEATTIE_TESTS.map((item) => [item.testId, item]));
const BY_ID = Object.fromEntries(BEATTIE_TESTS.map((item) => [item.id, item]));

export function beattieSpec(assessmentId: string) {
  return BY_ID[assessmentId] || null;
}

function chars(value: string) {
  return Array.from(String(value || ''));
}

export function beattieNickname(value: string) {
  return chars(String(value || '').trim()).slice(0, 12).join('');
}

function phoneNickname(value: string) {
  return /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/.test(value);
}

function tfAllowsNa(testId: string, item: { id: number; stars: number }) {
  return (testId === 'guilt' && item.id === 6) || item.stars === 2;
}

export function beattieOrderKey(testId: string, likert: readonly unknown[], mcq: readonly unknown[], tf: readonly unknown[]) {
  return `${testId}\u0002${likert.join(',')}\u0002${mcq.join(',')}\u0002${tf.join(',')}`;
}

type Answers = {
  testId?: string;
  assessmentId?: string;
  likert?: unknown;
  mcq?: unknown;
  tf?: unknown;
  angerFill?: unknown;
  rushed?: boolean;
};

export function beattieAnswersOk(input: Answers) {
  const spec = input && BY_TEST[input.testId || ''];
  if (!spec) return false;
  if (Object.prototype.hasOwnProperty.call(input, 'angerFill')) return false;
  const test = getTestById(spec.testId);
  if (!test) return false;
  const likert = input.likert;
  const mcq = input.mcq;
  const tf = input.tf;
  if (!Array.isArray(likert) || likert.length !== test.likertItems.length) return false;
  if (!likert.every((value) => Number.isInteger(value) && value >= 0 && value <= 10)) return false;
  if (!Array.isArray(mcq) || mcq.length !== test.mcqItems.length) return false;
  if (!mcq.every((value, index) => {
    const item = test.mcqItems[index];
    if (value === 'NA') return typeof item.naScore === 'number';
    return item.options.some((option) => option.key === value);
  })) return false;
  if (!Array.isArray(tf) || tf.length !== test.tfItems.length) return false;
  if (!tf.every((value, index) => {
    if (value === 'yes' || value === 'no') return true;
    return value === 'NA' && tfAllowsNa(test.id, test.tfItems[index]);
  })) return false;
  return true;
}

export function buildBeattieResult(input: Answers & {
  nickname?: string;
  reportId?: string;
  clientSubmissionId?: string;
  completedAt?: string;
  customText?: unknown;
  narrative?: unknown;
}) {
  const nickname = beattieNickname(input && input.nickname || '');
  const spec = beattieSpec(input && input.assessmentId || '') || BY_TEST[input?.testId || ''];
  if (!nickname || phoneNickname(nickname) || !spec || !beattieAnswersOk({ ...input, testId: spec.testId })) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;
  if (input.customText != null || input.narrative != null) return null;
  if (input.assessmentId && input.assessmentId !== spec.id) return null;

  const test = getTestById(spec.testId);
  if (!test) return null;
  const likert = (input.likert as number[]).slice();
  const mcq = (input.mcq as string[]).slice();
  const tf = (input.tf as string[]).slice();
  const assessment = scoreLikert(likert);
  const mcqScore = scoreMcq(test.mcqItems, mcq);
  const tfScore = scoreTf(test.tfItems, tf as ('yes' | 'no' | 'NA')[]);
  const sections = { assessment, mcq: mcqScore, tf: tfScore };
  const { total, band } = computeTotal(test, sections);
  if (!band) return null;
  const insight = insightFor(spec.testId, total) || null;
  const reading = readingFor(spec.testId);
  const dramaNote = spec.testId === 'drama' ? BEATTIE_DRAMA_NOTE : null;
  const headline = insight ? `${insight.lamp}：${insight.headline}` : `总分 ${total} / ${test.maxPossible}`;
  const dimensions = [
    { id: 'assessment', name: '评估', kind: 'score', score: assessment, raw: assessment, max: 100, level: null, levelLabel: null, narrative: '评估部分的分数。', labels: [] },
    { id: 'mcq', name: '选择', kind: 'score', score: mcqScore, raw: mcqScore, max: 50, level: null, levelLabel: null, narrative: '选择题的分数。', labels: [] },
    { id: 'tf', name: '判断', kind: 'score', score: tfScore, raw: tfScore, max: 80, level: null, levelLabel: null, narrative: '判断题的分数。', labels: [] },
  ];
  const result = {
    headline,
    code: insight ? insight.lamp : `${band.min}-${band.max}`,
    label: insight ? insight.lamp : '分数段',
    summary: `总分 ${total} / ${test.maxPossible}。${studyAidNote}`,
    flags: [] as string[],
  };
  const interpretation: { id: string; title: string | null; text: string }[] = [
    { id: 'headline', title: spec.name, text: headline },
    { id: 'study', title: null, text: studyAidNote },
  ];
  if (reading && reading.theme) interpretation.push({ id: 'theme', title: null, text: reading.theme });
  (insight ? insight.means : []).forEach((text, index) => {
    interpretation.push({ id: `mean-${index + 1}`, title: null, text });
  });
  interpretation.push({ id: 'book', title: `${band.min}–${band.max}`, text: band.text });
  if (dramaNote) interpretation.push({ id: 'drama', title: '先看悲痛', text: dramaNote });
  const recommendations = (insight ? insight.actions : []).map((text, index) => ({
    id: `action-${index + 1}`,
    title: null as string | null,
    text,
  }));
  recommendations.push({ id: 'reader', title: null, text: BEATTIE_READER_GAP });
  const viewModel = {
    testId: spec.testId,
    title: test.title,
    chapter: test.chapter,
    theme: reading ? reading.theme : '',
    studyNote: studyAidNote,
    likert,
    mcq,
    tf,
    sections: { assessment, mcq: mcqScore, tf: tfScore },
    total,
    maxPossible: test.maxPossible,
    band: { min: band.min, max: band.max, text: band.text },
    insight: insight
      ? {
        min: insight.min,
        max: insight.max,
        lamp: insight.lamp,
        tone: insight.tone,
        headline: insight.headline,
        means: insight.means.slice(),
        actions: insight.actions.slice(),
      }
      : null,
    dramaNote,
    rushed: Boolean(input.rushed),
  };
  const blocks = [
    { t: 'h', l: 2, x: headline },
    { t: 'p', x: result.summary },
    { t: 'p', x: `评估 ${assessment} / 100。选择 ${mcqScore} / 50。判断 ${tfScore} / 80。` },
  ];
  return {
    reportId: input.reportId,
    assessmentId: spec.id,
    assessmentName: spec.name,
    assessmentVersion: `${spec.id}-h5-v1`,
    nickname,
    completedAt: input.completedAt,
    dimensions,
    result,
    interpretation,
    recommendations,
    reportContent: {
      format: 'view-model+sections',
      viewModel,
      sections: blocks,
      textFallback: blocks.map((section) => section.x).join(''),
    },
    extensionData: {
      answers: { likert: likert.slice(), mcq: mcq.slice(), tf: tf.slice() },
      score: {
        sections: { assessment, mcq: mcqScore, tf: tfScore },
        total,
        maxPossible: test.maxPossible,
        band: { min: band.min, max: band.max },
        lamp: insight ? insight.lamp : null,
      },
      quality: { rushed: Boolean(input.rushed) },
      consent: {
        agreed: true,
        version: `consent-assessment-${spec.id}-1`,
        at: input.completedAt,
        scopes: ['store', 'share_link', 'mentor_read'],
      },
      compat: {
        level: 'partial',
        gaps: [BEATTIE_READER_GAP],
      },
    },
    source: {
      site: spec.name,
      path: 'beattie/index.html',
      repo: 'mindtest-web',
      origin: 'in-repo',
      pageUrl: 'https://xiangshu3721.github.io/mindtest-web/beattie/',
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: spec.id,
      localKey: `beattie-${spec.testId}`,
    },
    schemaVersion: '1.0.0',
  };
}
