/** 爱的 5 种语言计分。30 道二选一与 5loves `src/data/questions.ts` 的语言码一致。
 * 每种语言在题库里出现 12 次，所以单项是 0–12 的整数，五项相加一定是 30。
 * 云端 assessmentId 是 loves5，不是仓库名 5loves。
 */
export const PICK_COUNT = 30;
export const SCORE_MAX = 12;
export const LOVES5_VERSION = "loves5-h5-v1";
export const LOVES5_CONSENT_VERSION = "consent-assessment-loves5-1";
export const LOVES5_ID = "loves5";
export const LOVES5_NAME = "爱的 5 种语言";
export const LOVES5_SCREEN = "这是一份爱的语言整理，不是性格诊断，也不说明哪种语言更好。";
export const LOVES5_READER_GAP = "阅读页若尚未重绘爱的 5 种语言，五种语言的分数在 dimensions、viewModel.scores 与 textFallback。";

export const LANGUAGES = [
  {
    id: "A",
    name: "肯定的言词",
    english: "Words of Affirmation",
    meaning: "赞美、鼓励、感激。口头和书面的肯定，是被看见的证据。",
    how: "认真称赞，说「我爱你」，写短笺，肯定对方的选择。",
  },
  {
    id: "B",
    name: "精心的时刻",
    english: "Quality Time",
    meaning: "全神贯注的陪伴。一起做事，或只是在一起，不被打断。",
    how: "放下手机，一起散步，把一段对话听完。",
  },
  {
    id: "C",
    name: "接受礼物",
    english: "Receiving Gifts",
    meaning: "礼物是看见与惦记的可见记号。贵重与否不重要，有心才重要。",
    how: "记得日子，带一个小物件回来，亲手做也算。",
  },
  {
    id: "D",
    name: "服务的行动",
    english: "Acts of Service",
    meaning: "愿意做对方希望被帮忙的事，把负担从对方肩上挪开。",
    how: "做饭、洗碗、代办琐事，不用等对方开口。",
  },
  {
    id: "E",
    name: "身体的接触",
    english: "Physical Touch",
    meaning: "靠近、触碰、被抱住。身体在场，才会觉得安全。",
    how: "牵手、拥抱、坐近一点，允许亲昵。",
  },
];

/** 第 1–30 题左右选项的语言码。只接受其中一侧，不接受 left/right。 */
export const PAIRS = [
  "AE", "BD", "CB", "DE", "EA", "BC", "AD", "EA", "CA", "BA",
  "CD", "BD", "CA", "BE", "EC", "BA", "CD", "AB", "EC", "DA",
  "EC", "BD", "CD", "BC", "BD", "EA", "DE", "AD", "CE", "BE",
];

const BY_ID = Object.fromEntries(LANGUAGES.map((item) => [item.id, item]));

export function loves5PicksOk(list) {
  return Array.isArray(list)
    && list.length === PICK_COUNT
    && list.every((value, index) => typeof value === "string" && value.length === 1 && PAIRS[index].includes(value));
}

export function scoreLoves5(picks) {
  if (!loves5PicksOk(picks)) throw new Error("作答需要 30 道二选一，每题只能是该题的语言码");
  const scores = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const code of picks) scores[code] += 1;
  const total = LANGUAGES.reduce((sum, item) => sum + scores[item.id], 0);
  if (total !== PICK_COUNT || LANGUAGES.some((item) => scores[item.id] > SCORE_MAX)) {
    throw new Error("五种语言分数需要相加为 30，且每种是 0–12");
  }
  const max = Math.max(...LANGUAGES.map((item) => scores[item.id]));
  const primaries = LANGUAGES.filter((item) => scores[item.id] === max).map((item) => item.id);
  const ranked = LANGUAGES
    .slice()
    .sort((a, b) => scores[b.id] - scores[a.id] || a.id.localeCompare(b.id))
    .map((item) => item.id);
  return { scores, primaries, ranked, total };
}

function primaryTitle(scored) {
  return scored.primaries.map((id) => BY_ID[id].name).join(" 与 ");
}

export function loves5Dimensions(scored) {
  const tied = scored.primaries.length > 1;
  return LANGUAGES.map((item) => ({
    id: item.id,
    name: item.name,
    kind: "score",
    score: scored.scores[item.id],
    raw: scored.scores[item.id],
    max: SCORE_MAX,
    level: scored.primaries.includes(item.id) ? "primary" : "other",
    levelLabel: scored.primaries.includes(item.id) ? (tied ? "并列主爱语" : "主爱语") : null,
    narrative: item.meaning,
    labels: [],
  }));
}

export function loves5Outcome(scored) {
  const title = primaryTitle(scored);
  const order = scored.ranked
    .map((id) => `${BY_ID[id].name} ${scored.scores[id]}`)
    .join(" · ");
  return {
    headline: title,
    code: scored.primaries.join(""),
    label: scored.primaries.length > 1 ? "并列主爱语" : "主爱语",
    summary: `${title}。从高到低：${order}。${LOVES5_SCREEN}`,
    flags: scored.primaries.length > 1 ? ["tied"] : [],
  };
}

export function loves5Interpretation(scored) {
  const outcome = loves5Outcome(scored);
  const blocks = [
    { id: "verdict", title: outcome.headline, text: outcome.summary },
    { id: "screen", title: "不是诊断", text: LOVES5_SCREEN },
  ];
  for (const id of scored.ranked) {
    const item = BY_ID[id];
    blocks.push({
      id,
      title: item.name,
      text: `${scored.scores[id]} / ${SCORE_MAX}。${item.meaning}可以这样表达：${item.how}`,
    });
  }
  return blocks;
}

export function loves5Recommendations() {
  return [
    { id: "screen", title: null, text: LOVES5_SCREEN },
    { id: "reader", title: null, text: LOVES5_READER_GAP },
  ];
}

export function loves5ViewModel(scored, picks, rushed) {
  return {
    picks: picks.slice(),
    scores: { ...scored.scores },
    primaries: scored.primaries.slice(),
    ranked: scored.ranked.slice(),
    rushed: Boolean(rushed),
  };
}

export function loves5Sections(scored) {
  const outcome = loves5Outcome(scored);
  return [
    { t: "h", l: 2, x: outcome.headline },
    { t: "p", x: outcome.summary },
    { t: "p", x: LOVES5_SCREEN },
  ];
}

export function loves5BodyParts(picks, rushed) {
  const scored = scoreLoves5(picks);
  const sections = loves5Sections(scored);
  return {
    dimensions: loves5Dimensions(scored),
    result: loves5Outcome(scored),
    interpretation: loves5Interpretation(scored),
    recommendations: loves5Recommendations(),
    reportContent: {
      format: "view-model+sections",
      viewModel: loves5ViewModel(scored, picks, rushed),
      sections,
      textFallback: sections.map((section) => section.x).join(""),
    },
    score: {
      scores: { ...scored.scores },
      primaries: scored.primaries.slice(),
      ranked: scored.ranked.slice(),
      total: scored.total,
    },
  };
}
