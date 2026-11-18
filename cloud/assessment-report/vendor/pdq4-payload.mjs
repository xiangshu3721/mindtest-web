/** 合成 PDQ-4 统一结果。字段与 mindtest pdq/js/cloud-payload.js 的 buildPdq4Result 一致。 */
import {
  PDQ4_CONSENT_VERSION,
  PDQ4_ID,
  PDQ4_READER_GAP,
  PDQ4_SCREEN_TEXT,
  PDQ4_VERSION,
  QUESTION_COUNT,
  pdq4Flags,
  scorePdq4,
} from "./pdq4-score.mjs";

export const ASSESSMENT_NAME = "人格障碍筛查 PDQ-4";
export const SCHEMA_VERSION = "1.0.0";

function chars(value) {
  return Array.from(String(value || ""));
}

export function pdq4Nickname(value) {
  return chars(String(value || "").trim()).slice(0, 12).join("");
}

function answersOk(list) {
  return Array.isArray(list)
    && list.length === QUESTION_COUNT
    && list.every((value) => value === 0 || value === 1);
}

function scaleView(scale) {
  return {
    id: scale.id,
    name: scale.name,
    alias: scale.alias || "",
    cluster: scale.cluster,
    score: scale.score,
    max: scale.max,
    cutoff: scale.cutoff,
    positive: scale.positive,
  };
}

export function buildPdq4Result(input) {
  const nickname = pdq4Nickname(input && input.nickname);
  const answers = input && input.answers;
  if (!nickname || !answersOk(answers)) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;

  let scored;
  try {
    scored = scorePdq4(answers);
  } catch {
    return null;
  }

  const answerCopy = answers.slice();
  const scales = scored.scales.map(scaleView);
  const dimensions = scored.scales.map((scale) => ({
    id: scale.id,
    name: scale.name,
    kind: "score",
    score: scale.score,
    max: scale.max,
    cutoff: scale.cutoff,
    positive: scale.positive,
    cluster: scale.cluster,
    level: scale.positive ? "positive" : "negative",
    levelLabel: scale.positive ? "达到划界" : "未达到",
    narrative: scale.about,
    labels: [],
  }));
  const headline = scored.verdict.title;
  const summary = scored.verdict.text;
  const flags = pdq4Flags(scored);
  const interpretation = [
    { id: "verdict", title: headline, text: summary },
    { id: "screen", title: "筛查不是诊断", text: PDQ4_SCREEN_TEXT },
    {
      id: "too-good",
      title: "掩饰",
      text: `掩饰 ${scored.tooGood.score} / ${scored.tooGood.max}${scored.tooGood.flagged ? "，达到注意线" : "，未触发"}。`,
    },
    {
      id: "suspect",
      title: "怀疑",
      text: `怀疑 ${scored.suspect.score} / ${scored.suspect.max}${scored.suspect.flagged ? "，问卷按可疑处理" : "，未触发"}。`,
    },
  ];
  for (const scale of scored.scales) {
    const mark = scale.positive ? "达到划界" : "未达到";
    const detail = scale.positive ? scale.portrait : scale.about;
    interpretation.push({
      id: scale.id,
      title: scale.name,
      text: `${mark}，${scale.score} / ${scale.max}，划界 ${scale.cutoff}。${detail}`,
    });
  }
  const recommendations = [
    { id: "screen", title: null, text: PDQ4_SCREEN_TEXT },
  ];
  const scaleLine = scales.map((scale) => `${scale.name} ${scale.score}/${scale.max}`).join("、");
  const textFallback = [
    `${headline}。${summary}`,
    PDQ4_SCREEN_TEXT,
    `十二个维度得分之和 ${scored.total}，达到划界 ${scored.positiveCount} 个。`,
    `掩饰 ${scored.tooGood.score}/${scored.tooGood.max}，怀疑 ${scored.suspect.score}/${scored.suspect.max}。`,
    `冲动合成 ${scored.impulse.point} 分，早年行为合成 ${scored.conduct.point} 分。`,
    scaleLine,
  ].join("");
  const sections = [
    { t: "h", l: 2, x: headline },
    { t: "p", x: summary },
    { t: "p", x: PDQ4_SCREEN_TEXT },
    { t: "p", x: `掩饰 ${scored.tooGood.score} / ${scored.tooGood.max}，怀疑 ${scored.suspect.score} / ${scored.suspect.max}。` },
    {
      t: "ul",
      it: scales.map((scale) => ({
        x: `${scale.name} ${scale.score} / ${scale.max} · ${scale.positive ? "达到划界" : "未达到"}`,
        d: 0,
        n: 0,
      })),
    },
  ];

  return {
    reportId: input.reportId,
    assessmentId: PDQ4_ID,
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: PDQ4_VERSION,
    nickname,
    completedAt: input.completedAt,
    dimensions,
    result: {
      headline,
      code: scored.verdict.id,
      label: headline,
      summary,
      flags,
    },
    interpretation,
    recommendations,
    reportContent: {
      format: "view-model+sections",
      viewModel: {
        answers: answerCopy,
        scales,
        positiveCount: scored.positiveCount,
        total: scored.total,
        tooGood: scored.tooGood,
        suspect: scored.suspect,
        impulse: scored.impulse,
        conduct: scored.conduct,
        verdict: scored.verdict,
        rushed: Boolean(input.rushed),
      },
      sections,
      textFallback,
    },
    extensionData: {
      answers: answerCopy.slice(),
      score: scored,
      quality: { rushed: Boolean(input.rushed) },
      consent: {
        agreed: true,
        version: PDQ4_CONSENT_VERSION,
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: {
        level: "partial",
        gaps: [PDQ4_READER_GAP],
      },
    },
    source: {
      site: "ASVA 常用心理测试",
      path: "pdq/index.html",
      repo: "mindtest",
      origin: "external-repo",
      pageUrl: "https://xiangshu3721.github.io/mindtest/pdq/",
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "pdq4",
      localKey: "pdq4-session",
    },
    schemaVersion: SCHEMA_VERSION,
  };
}
