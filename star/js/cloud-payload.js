import { WORDS } from "./data.js";

export const STAR_VERSION = "star-words-31-v1";
export const CONSENT_VERSION = "consent-assessment-star-1";
export const SCHEMA_VERSION = "1.0.0";

const WORD_SET = new Set(WORDS);
const NOTES = [
  "倒三角（底层动力）是划了三轮之后留下的 3 个词，是对你最要紧的。",
  "正三角（现实追求）是从划掉的词里复活的 3 个，是你现在想去够的。",
  "这是一次自我整理，不是打分，也不是职业诊断。",
];

function cleanWords(list) {
  if (!Array.isArray(list) || list.length !== 3) return null;
  if (list.some((word) => !WORD_SET.has(word))) return null;
  if (new Set(list).size !== 3) return null;
  return list.slice();
}

export function starNotes() {
  return NOTES.slice();
}

/** 把当前六芒星结果收成协议对象。没有分数。失败返回 null，不上传。 */
export function buildStarResult(input) {
  const drive = cleanWords(input.driveOrder);
  const pursue = cleanWords(input.pursueOrder);
  const nickname = String(input.nickname || "").trim();
  if (!drive || !pursue || !nickname) return null;
  if (drive.some((word) => pursue.includes(word))) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;

  const headline = `底层动力：${drive.join("、")}`;
  const summary = `现实追求：${pursue.join("、")}`;
  return {
    reportId: input.reportId,
    assessmentId: "star",
    assessmentName: "职业六芒星",
    assessmentVersion: STAR_VERSION,
    nickname,
    completedAt: input.completedAt,
    dimensions: [
      { id: "drive", name: "底层动力", kind: "category", score: null, labels: drive },
      { id: "pursue", name: "现实追求", kind: "category", score: null, labels: pursue },
    ],
    result: {
      headline,
      code: null,
      label: "自我整理，不是职业诊断",
      summary,
      flags: [],
    },
    interpretation: [
      { id: "note-1", title: null, text: NOTES[0] },
      { id: "note-2", title: null, text: NOTES[1] },
    ],
    recommendations: [
      { id: "note-3", title: null, text: NOTES[2] },
    ],
    reportContent: {
      format: "view-model+sections",
      viewModel: { driveOrder: drive, pursueOrder: pursue },
      sections: [
        { t: "hex", drive: drive.slice(), pursue: pursue.slice() },
        { t: "ul", it: NOTES.map((text) => ({ x: text, d: 0, n: 0 })) },
      ],
      textFallback: `${headline}。${summary}。`,
    },
    extensionData: {
      rounds: {
        cull1: Array.isArray(input.cull1) ? input.cull1.slice() : [],
        cull2: Array.isArray(input.cull2) ? input.cull2.slice() : [],
        cull3: Array.isArray(input.cull3) ? input.cull3.slice() : [],
        revived: Array.isArray(input.revived) ? input.revived.slice() : pursue.slice(),
      },
      score: null,
      consent: {
        agreed: true,
        version: CONSENT_VERSION,
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: { level: "full", gaps: [] },
    },
    source: {
      site: "ASVA 常用心理测试",
      path: "star/index.html",
      repo: "mindtest-web",
      origin: "in-repo",
      pageUrl: null,
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "star",
      localKey: "career-star-v2",
    },
    schemaVersion: SCHEMA_VERSION,
  };
}
