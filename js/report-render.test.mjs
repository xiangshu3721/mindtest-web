import assert from "node:assert/strict";
import test from "node:test";
import { WORDS } from "../star/js/data.js";
import { buildStarResult } from "../star/js/cloud-payload.js";
import { SCALES, TOO_GOOD_REVERSE } from "../pdq/js/data.js";
import { scorePdq4 } from "../pdq/js/score.js";
import { FACTORS } from "../scl90/js/data.js";
import { scoreScl90 } from "../scl90/js/score.js";
import { QUESTIONS, REVERSE_ITEMS } from "../ecr/js/data.js";
import { scoreEcr } from "../ecr/js/score.js";
import { renderReport } from "./report-render.js";

const when = "2026-10-22T09:30:00+08:00";

function sefsCalc(scores, extra = {}) {
  return {
    assessmentId: "sefs",
    assessmentName: "SEFS 主观体验功能状态量表",
    assessmentVersion: "sefs-v4",
    nickname: "阿禾",
    completedAt: when,
    extensionData: {
      score: {
        scores,
        total: scores.reduce((sum, score) => sum + score, 0),
        leaders: extra.leaders,
        complex: extra.complex,
      },
    },
  };
}

test("旧的六芒星报告仍然可读", () => {
  const drive = WORDS.slice(28);
  const pursue = WORDS.slice(0, 3);
  const report = buildStarResult({
    nickname: "小林",
    driveOrder: drive,
    pursueOrder: pursue,
    reportId: "rpt_abcdefghijklmnopqrstuvwxyz",
    clientSubmissionId: "sub_abcdefghijklmnopqrstuvwxyz",
    completedAt: when,
  });
  const html = renderReport(report);
  assert.equal(html.includes("这份报告的阅读页还没接上"), false);
  assert.equal(html.includes("底层动力"), true);
  assert.equal(html.includes("现实追求"), true);
  assert.equal(html.includes(drive[0]), true);
  assert.equal(html.includes(pursue[2]), true);
  assert.equal(html.includes("这是一次自我整理，不是打分，也不是职业诊断。"), true);
  assert.equal(html.includes("体验广度"), false);
});

test("其他测评仍提示阅读页还没接上", () => {
  const html = renderReport({ assessmentId: "holland", assessmentName: "霍兰德" });
  assert.equal(html.includes("这份报告的阅读页还没接上。霍兰德"), true);
  assert.equal(renderReport(null).includes("这份报告的阅读页还没接上。"), true);
});

test("SEFS 用现网 calc() 画出总分、四维和洞察", () => {
  const html = renderReport(sefsCalc([18, 6, 9, 15], { leaders: [0], complex: true }));
  assert.equal(html.includes("这份报告的阅读页还没接上"), false);
  assert.equal(html.includes("SEFS 主观体验功能状态量表"), true);
  assert.equal(html.includes(">48<"), true);
  assert.equal(html.includes("总分 48 分。它是四个体验维度的简单相加，不设未经验证的总体严重程度阈值。"), true);
  for (const name of ["体验广度", "体验容纳", "体验归属", "体验自主"]) {
    assert.equal(html.includes(name), true);
  }
  assert.equal(html.indexOf("体验广度") < html.indexOf("体验容纳"), true);
  assert.equal(html.indexOf("体验容纳") < html.indexOf("体验归属"), true);
  assert.equal(html.includes("18 <small>/ 24</small>"), true);
  assert.equal(html.includes("6 <small>/ 24</small>"), true);
  assert.equal(html.includes("中度受损*"), true);
  assert.equal(html.includes("功能基本完好*"), true);
  assert.equal(html.includes("轻度受损*"), true);
  assert.equal(html.includes("相对突出的体验方向：体验广度（体验压缩型）"), true);
  assert.equal(html.includes("属于“复合关注”模式"), true);
  assert.equal(html.includes("先从微弱而具体的身体感受开始"), true);
  assert.equal(html.includes("探索性分析 · 非病理诊断"), true);
  assert.equal(html.includes("可核验的信效度"), true);
  assert.equal(html.includes("阿禾"), true);
  assert.equal(html.includes("sefs-v4"), true);
  assert.equal(html.includes("2026年10月22日"), true);
});

test("SEFS 并列最高分用现网并列句，分档沿用草案切点", () => {
  const tied = renderReport(sefsCalc([15, 15, 3, 2]));
  assert.equal(tied.includes("并列最高的体验方向：体验广度（体验压缩型）、体验容纳（体验泛滥型）"), true);
  assert.equal(tied.includes("本次有多个并列维度"), true);
  assert.equal(tied.includes("先从微弱而具体的身体感受开始"), false);
  assert.equal(tied.includes("属于“复合关注”模式"), true);

  const edges = renderReport(sefsCalc([7, 8, 11, 12], { leaders: [3], complex: false }));
  assert.equal(edges.includes("功能基本完好*"), true);
  assert.equal(edges.includes("轻度受损*"), true);
  assert.equal(edges.includes("中度受损*"), true);
  assert.equal(edges.includes("重度受损*"), false);
  assert.equal(edges.includes("未达到“两个及以上维度均不少于 15 分”"), true);
  assert.equal(edges.includes("试着把“别人期待我怎样感受”"), true);

  const high = renderReport(sefsCalc([18, 19, 0, 24], { leaders: [3], complex: true }));
  assert.equal(high.includes("重度受损*"), true);
  assert.equal(high.includes("相对突出的体验方向：体验自主（体验被侵占型）"), true);
});

test("SEFS 统一协议字段优先于 calc()，原文洞察不再重写", () => {
  const html = renderReport({
    assessmentId: "sefs",
    assessmentName: "SEFS 主观体验功能状态量表",
    assessmentVersion: "sefs-v4",
    nickname: "小林",
    completedAt: when,
    dimensions: [
      { id: "agency", name: "体验自主", score: 4, max: 24, level: "功能基本完好" },
      { id: "breadth", name: "体验广度", score: 20, max: 24 },
      { id: "belong", name: "体验归属", score: 8, max: 24 },
      { id: "contain", name: "体验容纳", score: 16, max: 24 },
    ],
    result: {
      headline: "自定义标题",
      summary: "自定义总分说明",
      label: "探索性分析 · 非病理诊断",
      flags: ["complex", "breadth"],
    },
    interpretation: [{ id: "note", text: "自定义洞察段落" }],
    recommendations: [{ id: "advice", title: "可以尝试", text: "自定义建议" }],
    reportContent: {
      format: "view-model+sections",
      viewModel: { total: 41, maxTotal: 96 },
    },
    extensionData: { score: { scores: [1, 1, 1, 1], total: 4, leaders: [1], complex: false } },
  });
  assert.equal(html.includes(">41<"), true);
  assert.equal(html.includes(">4<"), false);
  assert.equal(html.includes("自定义总分说明"), true);
  assert.equal(html.includes("自定义标题"), true);
  assert.equal(html.includes("自定义洞察段落"), true);
  assert.equal(html.includes("可以尝试："), true);
  assert.equal(html.includes("自定义建议"), true);
  assert.equal(html.includes("属于“复合关注”模式"), false);
  assert.equal(html.indexOf("体验广度") < html.indexOf("体验容纳"), true);
  assert.equal(html.includes("20 <small>/ 24</small>"), true);
  assert.equal(html.includes("width:83.3%"), true);
  const notice = "可核验的信效度";
  assert.equal(html.split(notice).length - 1, 1);
});

test("SEFS 按 buildSefsResult 的定稿字段阅读", () => {
  const html = renderReport({
    assessmentId: "sefs",
    assessmentName: "SEFS · 主观体验功能状态量表",
    assessmentVersion: "sefs-h5-v1",
    nickname: "阿禾",
    completedAt: when,
    dimensions: [
      { id: "autonomy", name: "体验自主", kind: "score", score: 15, max: 24, level: "中度受损", levelLabel: "体验被侵占型", labels: [] },
      { id: "belonging", name: "体验归属", kind: "score", score: 9, max: 24, level: "轻度受损", levelLabel: "体验割裂型", labels: [] },
      { id: "capacity", name: "体验容纳", kind: "score", score: 6, max: 24, level: "功能基本完好", levelLabel: "体验泛滥型", labels: [] },
      { id: "breadth", name: "体验广度", kind: "score", score: 18, max: 24, level: "中度受损", levelLabel: "体验压缩型", labels: [] },
    ],
    result: {
      headline: "相对突出的体验方向：体验广度（体验压缩型）",
      code: null,
      label: "探索性分析 · 非病理诊断",
      summary: "按草案规则，有至少两个维度达到 15 分，属于“复合关注”模式。得分排序只是本次观察顺序，不等于临床干预优先级。可以尝试：先从微弱而具体的身体感受开始，例如温度、触感或一点点好奇。无需要求自己立刻快乐。",
      flags: ["complex"],
    },
    interpretation: [
      { id: "lead", title: null, text: "相对突出的体验方向：体验广度（体验压缩型）" },
      { id: "pattern", title: null, text: "按草案规则，有至少两个维度达到 15 分，属于“复合关注”模式。得分排序只是本次观察顺序，不等于临床干预优先级。" },
      { id: "ranking", title: null, text: "四维度从高到低：体验广度 18分 · 体验自主 15分 · 体验归属 9分 · 体验容纳 6分。" },
    ],
    recommendations: [
      { id: "try", title: null, text: "可以尝试：先从微弱而具体的身体感受开始，例如温度、触感或一点点好奇。无需要求自己立刻快乐。" },
      { id: "reader", title: null, text: "统一阅读页目前只重绘职业六芒星，SEFS 的阅读页会另开 mindtest-web 任务。链接和存档已按统一协议保存。" },
    ],
    reportContent: {
      format: "view-model+sections",
      viewModel: { scores: [18, 6, 9, 15], total: 48, leaders: [0], complex: true, levels: ["中度受损", "功能基本完好", "轻度受损", "中度受损"] },
      sections: [
        { t: "p", x: "总分 48 / 96。它是四个体验维度的简单相加，不设未经验证的总体严重程度阈值。" },
      ],
    },
    extensionData: { score: { scores: [1, 1, 1, 1], total: 4, leaders: [3], complex: false } },
  });
  assert.equal(html.includes(">48<"), true);
  assert.equal(html.includes("/ 96"), true);
  assert.equal(html.includes("总分 48 / 96。它是四个体验维度的简单相加，不设未经验证的总体严重程度阈值。"), true);
  assert.equal(html.includes("18 <small>/ 24</small>"), true);
  assert.equal(html.includes("6 <small>/ 24</small>"), true);
  assert.equal(html.includes("9 <small>/ 24</small>"), true);
  assert.equal(html.includes("15 <small>/ 24</small>"), true);
  assert.equal(html.indexOf("体验广度") < html.indexOf("体验容纳"), true);
  assert.equal(html.indexOf("体验容纳") < html.indexOf("体验归属"), true);
  assert.equal(html.indexOf("体验归属") < html.indexOf("体验自主"), true);
  assert.equal(html.includes("中度受损*"), true);
  assert.equal(html.includes("体验压缩型*"), false);
  assert.equal(html.split("相对突出的体验方向：体验广度（体验压缩型）").length - 1, 1);
  assert.equal(html.split("可以尝试：").length - 1, 1);
  assert.equal(html.split("属于“复合关注”模式").length - 1, 1);
  assert.equal(html.includes("四维度从高到低：体验广度 18分 · 体验自主 15分 · 体验归属 9分 · 体验容纳 6分。"), true);
  assert.equal(html.includes("统一阅读页目前只重绘职业六芒星"), false);
  assert.equal(html.includes("sefs-h5-v1"), true);
  assert.equal(html.includes("SEFS · 主观体验功能状态量表"), true);
});

test("SEFS 原文里已有声明时不重复贴一份", () => {
  const notice = "题目、分段及类型解释尚未在此提供可核验的信效度、常模或临床验证信息。";
  const html = renderReport({
    assessmentId: "sefs",
    nickname: "小林",
    completedAt: when,
    assessmentVersion: "sefs-v4",
    extensionData: { score: { scores: [1, 1, 1, 1], total: 4, leaders: [0], complex: false } },
    recommendations: [{ text: notice }],
  });
  assert.equal(html.split("可核验的信效度").length - 1, 1);
});

test("SEFS 阅读页转义昵称和洞察，缺分数时不显示假的 0 分", () => {
  const html = renderReport({
    assessmentId: "sefs",
    assessmentName: "<img src=x onerror=alert(1)>",
    nickname: "<script>alert(1)</script>",
    completedAt: when,
    interpretation: [{ text: "<script>alert(1)</script>" }],
  });
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("&lt;script&gt;"), true);
  assert.equal(html.includes("sefs-total-num"), false);
  assert.equal(html.includes("这份结果里没有可显示的分数。"), true);
  assert.equal(html.includes("这份报告的阅读页还没接上"), false);
});

const SCL_NAMES = ["躯体化", "强迫症状", "人际关系敏感", "抑郁", "焦虑", "敌对", "恐怖", "偏执", "精神病性", "其他"];

function sclProtocol(scored, extra = {}) {
  return {
    assessmentId: "scl90",
    assessmentName: "SCL-90 症状自评量表",
    assessmentVersion: extra.version || "scl90-rules-2026-10",
    nickname: extra.nickname || "阿禾",
    completedAt: when,
    dimensions: scored.factors.map((factor) => ({
      id: factor.id,
      name: factor.name,
      kind: "score",
      score: factor.mean === 1 ? 9 : factor.mean,
      max: 5,
      raw: factor.raw,
      level: factor.level,
      levelLabel: factor.levelLabel,
      narrative: factor.narrative,
    })),
    result: {
      headline: `${scored.verdictTitle} · 总症状指数 ${scored.gsi.toFixed(2)}（${scored.gsiLabel}）`,
      code: null,
      label: "筛查不是诊断",
      summary: "旧摘要，不应盖过 verdictText",
      flags: [scored.positive ? "positive" : "negative"].concat(scored.crisis ? [`crisis-${scored.crisis.level}`] : []),
    },
    interpretation: [
      { id: "verdict", text: scored.verdictText },
      { id: "gsi", text: scored.gsiText },
      ...scored.factors.map((factor) => ({ id: factor.id, text: factor.narrative })),
      scored.crisis ? { id: "crisis", text: scored.crisis.text } : null,
      { id: "only-here", text: "只在解释里出现的一句。" },
    ].filter(Boolean),
    recommendations: scored.guidance.map((line, index) => ({ id: `guide-${index}`, text: line })),
    reportContent: {
      format: "view-model+sections",
      viewModel: {
        answers: extra.answers,
        factors: scored.factors,
        ranked: scored.ranked,
        gsi: scored.gsi,
        total: scored.total,
        positiveCount: scored.positiveCount,
        negativeCount: scored.negativeCount,
        positiveMean: scored.positiveMean,
        crisis: scored.crisis,
        guidance: scored.guidance.map((line) => `不该重复的引导：${line}`),
        rules: scored.rules,
        norms: scored.norms,
        gsiLabel: scored.gsiLabel,
        gsiText: scored.gsiText,
        verdictTitle: scored.verdictTitle,
        verdictText: scored.verdictText,
        positive: scored.positive,
        notable: scored.notable,
        profile: extra.profile,
      },
    },
    extensionData: {
      score: { ...scored, total: 1, gsi: 9, positiveCount: 1, positiveMean: 9, verdictTitle: "不该出现的标题" },
      answers: extra.answers,
      profile: extra.profile || null,
      quality: { rushed: Boolean(extra.rushed) },
    },
  };
}

test("SCL-90 统一协议画出十因子、总分、GSI 和阳性项", () => {
  const answers = Array(90).fill(1);
  const scored = scoreScl90(answers);
  const html = renderReport(sclProtocol(scored, { answers }));
  assert.equal(html.includes("这份报告的阅读页还没接上"), false);
  assert.equal(html.includes("SCL-90 症状自评量表"), true);
  assert.equal(html.includes("筛查不是诊断"), true);
  assert.equal(html.includes("筛查阴性"), true);
  assert.equal(html.includes("不该出现的标题"), false);
  assert.equal(html.includes("旧摘要，不应盖过 verdictText"), false);
  assert.equal(html.includes("<strong>1.00</strong>"), true);
  assert.equal(html.includes("总症状指数 · 没有明显症状"), true);
  assert.equal(html.includes("<b>90</b><span>总分</span>"), true);
  assert.equal(html.includes("<b>0</b><span>阳性项目</span>"), true);
  assert.equal(html.includes("<b>90</b><span>阴性项目</span>"), true);
  assert.equal(html.includes("<b>—</b><span>阳性症状均分</span>"), true);
  assert.equal(html.includes(">1</b><span>总分"), false);
  assert.equal(html.includes("0.00"), false);
  for (const name of SCL_NAMES) assert.equal(html.includes(name), true, name);
  for (let i = 1; i < SCL_NAMES.length; i += 1) {
    assert.equal(html.indexOf(SCL_NAMES[i - 1]) < html.indexOf(SCL_NAMES[i]), true, SCL_NAMES[i]);
  }
  assert.equal(html.includes("1.00 <small>/ 5</small>"), true);
  assert.equal(html.includes("9.00"), false);
  assert.equal(html.includes("无明显症状"), true);
  assert.equal(html.split('class="scl-pill"').length - 1, 3);
  assert.equal(html.includes("scl-pill-hit"), false);
  assert.equal(html.includes("scl-crisis"), false);
  assert.equal(html.includes("请先看这里"), false);
  assert.equal(html.includes("没有题目达到偏重或严重。"), true);
  assert.equal(html.split("最近一周，身体不适没有聚成一组明显的躯体主诉。").length - 1, 1);
  assert.equal(html.split("三条界值都没有超过").length - 1, 1);
  assert.equal(html.includes("不该重复的引导"), false);
  assert.equal(html.includes("只在解释里出现的一句。"), true);
  assert.equal(html.includes("也不能代替面谈"), true);
  assert.equal(html.includes("阿禾"), true);
  assert.equal(html.includes("scl90-rules-2026-10"), true);
  assert.equal(html.includes("2026年10月22日"), true);
  assert.equal(html.includes("底层动力"), false);
  assert.equal(html.includes("体验广度"), false);
  assert.equal(FACTORS.length, 10);
});

test("SCL-90 危机提示在分数前面，严重档用醒目样式", () => {
  const answers = Array(90).fill(5);
  const html = renderReport(sclProtocol(scoreScl90(answers), { answers }));
  assert.equal(html.includes("筛查阳性"), true);
  assert.equal(html.includes("scl-tag-pos"), true);
  assert.equal(html.includes("<strong>5.00</strong>"), true);
  assert.equal(html.includes("<b>450</b><span>总分</span>"), true);
  assert.equal(html.includes("<b>90</b><span>阳性项目</span>"), true);
  assert.equal(html.includes("<b>5.00</b><span>阳性症状均分</span>"), true);
  assert.equal(html.includes("scl-crisis-hot"), true);
  assert.equal(html.includes("请先看这里"), true);
  assert.equal(html.includes("12356"), true);
  assert.equal(html.includes("120"), true);
  assert.equal(html.indexOf("请先看这里") < html.indexOf("总症状指数"), true);
  assert.equal(html.indexOf("请先看这里") < html.indexOf("<strong>5.00</strong>"), true);
  assert.equal(html.split("请先看这里").length - 1, 1);
  assert.equal(html.includes("scl-pill-hit"), true);
  assert.equal(html.includes("重度"), true);
  assert.equal(html.includes("偏重和严重的条目（90）"), true);
  assert.equal(html.includes("它是筛查，不是诊断。"), true);
});

test("SCL-90 死亡念头用较轻但仍独立的提示", () => {
  const answers = Array(90).fill(1);
  answers[58] = 5;
  const html = renderReport(sclProtocol(scoreScl90(answers), { answers }));
  assert.equal(html.includes("scl-crisis-note"), true);
  assert.equal(html.includes("关于死亡的想法"), true);
  assert.equal(html.includes("这不等于要结束生命"), true);
  assert.equal(html.includes("scl-crisis-hot"), false);
  assert.equal(html.indexOf("关于死亡的想法") < html.indexOf("十个方面"), true);
});

test("SCL-90 只给了 dimensions 和总分时仍能读，均分不重算", () => {
  const html = renderReport({
    assessmentId: "scl90",
    assessmentName: "SCL-90 症状自评量表",
    assessmentVersion: "scl90-rules-2026-10",
    nickname: "小林",
    completedAt: when,
    dimensions: [
      { id: "anx", name: "焦虑", kind: "score", score: 1.25, max: 5 },
      { id: "dep", name: "抑郁", kind: "score", score: 3.5, max: 5, level: "moderate", levelLabel: "中度", narrative: "低落已经比较稳定。" },
    ],
    reportContent: {
      format: "view-model+sections",
      viewModel: { total: 140, gsi: 1.56, positiveCount: 20, positiveMean: 2.1 },
    },
  });
  assert.equal(html.includes("<strong>1.56</strong>"), true);
  assert.equal(html.includes("<b>140</b><span>总分</span>"), true);
  assert.equal(html.includes("<b>20</b><span>阳性项目</span>"), true);
  assert.equal(html.includes("<b>2.10</b><span>阳性症状均分</span>"), true);
  assert.equal(html.includes("1.25 <small>/ 5</small>"), true);
  assert.equal(html.includes("3.50 <small>/ 5</small>"), true);
  assert.equal(html.includes("中度"), true);
  assert.equal(html.includes("无明显症状"), true);
  assert.equal(html.split("低落已经比较稳定。").length - 1, 1);
  assert.equal(html.indexOf("躯体化") < html.indexOf("抑郁"), true);
  assert.equal(html.indexOf("抑郁") < html.indexOf("焦虑"), true);
  assert.equal(html.includes("scl-crisis"), false);
  assert.equal(html.includes("这份结果里没有可显示的分数。"), false);
  for (const name of SCL_NAMES) assert.equal(html.includes(name), true, name);
});

test("SCL-90 没有 viewModel 时退回 extensionData.score", () => {
  const scored = scoreScl90(Array(90).fill(2));
  const html = renderReport({
    assessmentId: "scl90",
    assessmentName: "SCL-90 症状自评量表",
    nickname: "阿禾",
    completedAt: when,
    assessmentVersion: "scl90-rules-2026-10",
    extensionData: { score: scored, profile: { name: "林深", gender: "女", age: "20岁以下" }, quality: { rushed: true } },
  });
  assert.equal(html.includes("<strong>2.00</strong>"), true);
  assert.equal(html.includes("<b>180</b><span>总分</span>"), true);
  assert.equal(html.includes("筛查阳性"), true);
  assert.equal(html.includes("林深 · 女 · 20岁以下"), true);
  assert.equal(html.includes("不宜直接套用成人界值"), true);
  assert.equal(html.includes("作答偏快"), true);
  assert.equal(html.includes("全国常模里，总分约 129.96 ± 38.76"), true);
});

test("SCL-90 缺字段时降级，不白屏，也不把空分画成 0", () => {
  const html = renderReport({ assessmentId: "scl90", nickname: "阿禾", completedAt: when });
  assert.equal(html.includes("这份报告的阅读页还没接上"), false);
  assert.equal(html.includes("这份结果里没有可显示的分数。"), true);
  assert.equal(html.includes("筛查不是诊断"), true);
  assert.equal(html.includes("也不能代替面谈"), true);
  assert.equal(html.includes("sefs-total-num"), false);
  assert.equal(html.includes("scl-stats"), false);
  assert.equal(html.includes("0.00"), false);
  for (const name of SCL_NAMES) assert.equal(html.includes(name), true, name);
  assert.equal(renderReport({
    assessmentId: "scl90",
    dimensions: "bad",
    interpretation: [null, { text: 3 }],
    reportContent: { viewModel: { factors: [null, 1, { mean: "nope" }], rules: [{ label: "x" }], crisis: 4 } },
  }).includes("十个方面"), true);
});

test("SCL-90 明确没有危机时不从答案推断；解释里的危机文案仍然置顶", () => {
  const answers = Array(90).fill(1);
  answers[14] = 5;
  const quiet = renderReport({
    assessmentId: "scl90",
    reportContent: { format: "view-model+sections", viewModel: { answers, crisis: null, gsi: 1.2, total: 108 } },
  });
  assert.equal(quiet.includes("请先看这里"), false);
  assert.equal(quiet.includes("12356"), false);

  const fromAnswers = renderReport({
    assessmentId: "scl90",
    reportContent: { format: "view-model+sections", viewModel: { answers, total: 108 } },
  });
  assert.equal(fromAnswers.includes("scl-crisis-hot"), true);
  assert.equal(fromAnswers.includes("想结束自己的生命"), true);
  assert.equal(fromAnswers.indexOf("请先看这里") < fromAnswers.indexOf("十个方面"), true);

  const noted = renderReport({
    assessmentId: "scl90",
    result: { flags: ["crisis-note"] },
    interpretation: [{ id: "crisis", text: "你在“想到有关死亡的事”上需要有人陪。可以打 12356。" }],
    reportContent: { viewModel: { crisis: null, gsi: 1.1 } },
  });
  assert.equal(noted.includes("关于死亡的想法"), true);
  assert.equal(noted.includes("可以打 12356。"), true);
  assert.equal(noted.includes("scl-crisis-note"), true);
});

test("SCL-90 阅读页转义昵称、因子叙述和危机文案", () => {
  const html = renderReport({
    assessmentId: "scl90",
    assessmentName: "<img src=x onerror=alert(1)>",
    nickname: "<script>alert(1)</script>",
    completedAt: when,
    dimensions: [{ id: "som", name: "<b>躯体</b>", kind: "score", score: 2, narrative: "<script>alert(1)</script>" }],
    reportContent: {
      viewModel: { gsi: 2, crisis: { level: "urgent", text: "<script>bad</script>" } },
    },
  });
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("<b>躯体"), false);
  assert.equal(html.includes("&lt;script&gt;"), true);
  assert.equal(html.includes("强迫症状"), true);
  assert.equal(html.includes("scl-crisis-hot"), true);
});

function sclPayload(answers, extra = {}) {
  const scored = scoreScl90(answers);
  const factors = scored.factors.map((factor) => ({
    id: factor.id,
    name: factor.name,
    raw: factor.raw,
    score: factor.mean,
    mean: factor.mean,
    level: factor.level,
    levelLabel: factor.levelLabel,
    screened: factor.screened,
    aboveNorm: factor.aboveNorm,
  }));
  const interpretation = [];
  if (scored.crisis) {
    interpretation.push({
      id: "crisis",
      title: scored.crisis.level === "note" ? "关于死亡的想法" : "请先看这里",
      text: scored.crisis.text,
    });
  }
  interpretation.push({ id: "gsi", title: scored.gsiLabel, text: scored.gsiText });
  for (const factor of scored.factors) {
    interpretation.push({
      id: factor.id,
      title: factor.name,
      text: `${factor.levelLabel}，均分 ${factor.mean.toFixed(2)}。${factor.narrative}`,
    });
  }
  const sections = [];
  if (scored.crisis) sections.push({ t: "p", x: scored.crisis.text });
  sections.push(
    { t: "h", l: 2, x: scored.verdictTitle },
    { t: "p", x: scored.verdictText },
    { t: "p", x: scored.gsiText },
    { t: "ul", it: factors.map((factor) => ({ x: `${factor.name} ${factor.score.toFixed(2)} · ${factor.levelLabel}`, d: 0, n: 0 })) },
  );
  for (const line of scored.guidance) sections.push({ t: "p", x: line });
  return {
    assessmentId: "scl90",
    assessmentName: "SCL-90 症状自评量表",
    assessmentVersion: "scl90-cn-1986-v1",
    nickname: "阿禾",
    completedAt: when,
    dimensions: scored.factors.map((factor) => ({
      id: factor.id,
      name: factor.name,
      kind: "score",
      score: factor.mean,
      raw: factor.raw,
      max: 5,
      level: factor.level,
      levelLabel: factor.levelLabel,
      narrative: factor.narrative,
      labels: [],
    })),
    result: {
      headline: scored.verdictTitle,
      code: scored.positive ? "positive" : "negative",
      label: scored.verdictTitle,
      summary: scored.verdictText,
      flags: scored.positive ? ["positive"] : [],
    },
    interpretation,
    recommendations: scored.guidance.map((text, index) => ({ id: `guide-${index + 1}`, title: null, text })),
    reportContent: {
      format: "view-model+sections",
      viewModel: {
        answers,
        total: scored.total,
        gsi: scored.gsi,
        gsiLabel: scored.gsiLabel,
        gsiText: scored.gsiText,
        positiveCount: scored.positiveCount,
        negativeCount: scored.negativeCount,
        positiveMean: scored.positiveMean,
        positive: scored.positive,
        verdictTitle: scored.verdictTitle,
        verdictText: scored.verdictText,
        factors,
        rules: scored.rules,
        crisis: scored.crisis,
        guidance: scored.guidance.slice(),
        rushed: Boolean(extra.rushed),
      },
      sections,
    },
    extensionData: {
      answers: answers.slice(),
      score: scored,
      quality: { rushed: Boolean(extra.rushed) },
    },
  };
}

test("SCL-90 按 mindtest cloud-payload 的形状阅读，十因子不按高低重排", () => {
  const answers = Array(90).fill(1);
  for (const n of FACTORS.find((factor) => factor.id === "dep").items) answers[n - 1] = 4;
  answers[14] = 2;
  const scored = scoreScl90(answers);
  const html = renderReport(sclPayload(answers));
  assert.equal(scored.ranked[0].id, "dep");
  assert.equal(scored.crisis.level, "alert");
  assert.equal(html.includes("这份报告的阅读页还没接上"), false);
  assert.equal(html.includes("scl90-cn-1986-v1"), true);
  assert.equal(html.includes(`<strong>${scored.gsi.toFixed(2)}</strong>`), true);
  assert.equal(html.includes(`<b>${scored.total}</b><span>总分</span>`), true);
  assert.equal(html.includes(`<b>${scored.positiveCount}</b><span>阳性项目</span>`), true);
  assert.equal(html.includes(`<b>${scored.positiveMean.toFixed(2)}</b><span>阳性症状均分</span>`), true);
  assert.equal(html.includes("筛查阳性"), true);
  assert.equal(html.includes("scl-crisis-hot"), true);
  assert.equal(html.split("请先看这里").length - 1, 1);
  assert.equal(html.split(scored.crisis.text).length - 1, 1);
  assert.equal(html.indexOf("请先看这里") < html.indexOf("总症状指数"), true);
  assert.equal(html.split(scored.gsiText).length - 1, 1);
  assert.equal(html.includes(`${scored.gsiLabel}：${scored.gsiText}`), false);
  for (let i = 1; i < SCL_NAMES.length; i += 1) {
    assert.equal(html.indexOf(`<h3>${SCL_NAMES[i - 1]}</h3>`) < html.indexOf(`<h3>${SCL_NAMES[i]}</h3>`), true, SCL_NAMES[i]);
  }
  const dep = scored.factors.find((factor) => factor.id === "dep");
  assert.equal(html.split(dep.narrative).length - 1, 1);
  assert.equal(html.includes(`均分 ${dep.mean.toFixed(2)}。`), false);
  assert.equal(html.split(scored.guidance[0]).length - 1, 1);
  assert.equal(html.includes("全国常模里，总分约 129.96 ± 38.76"), true);
});

test("SCL-90 阴性筛查没有 positive 旗标时仍写出筛查阴性", () => {
  const html = renderReport(sclPayload(Array(90).fill(1)));
  assert.equal(html.includes("筛查阴性"), true);
  assert.equal(html.includes("scl-crisis"), false);
  assert.equal(html.includes("scl-tag-pos"), false);
});

test("SCL-90 只有 interpretation 里的危机和因子句时也能读", () => {
  const html = renderReport({
    assessmentId: "scl90",
    assessmentName: "SCL-90 症状自评量表",
    result: { code: "negative", flags: [] },
    interpretation: [
      { id: "crisis", title: "请先看这里", text: "请联系全国心理援助热线 12356。" },
      { id: "gsi", title: "有症状，并不频繁", text: "总症状指数落在常见的一段说明里。" },
      { id: "dep", title: "抑郁", text: "中度，均分 3.20。低落已经比较稳定。" },
    ],
    reportContent: {
      format: "view-model+sections",
      viewModel: { total: 140, gsi: 1.56, positiveCount: 12, positiveMean: 2.4 },
    },
  });
  assert.equal(html.includes("筛查阴性"), true);
  assert.equal(html.includes("scl-crisis-hot"), true);
  assert.equal(html.split("请联系全国心理援助热线 12356。").length - 1, 1);
  assert.equal(html.indexOf("请先看这里") < html.indexOf("<strong>1.56</strong>"), true);
  assert.equal(html.split("总症状指数落在常见的一段说明里。").length - 1, 1);
  assert.equal(html.includes("有症状，并不频繁：总症状指数"), false);
  assert.equal(html.split("低落已经比较稳定。").length - 1, 1);
  assert.equal(html.includes("均分 3.20。"), false);
  assert.equal(html.includes("3.20 <small>/ 5</small>"), true);
});

const PDQ_NAMES = ["偏执型", "分裂样", "分裂型", "反社会型", "边缘型", "表演型", "自恋型", "回避型", "依赖型", "强迫型", "被动攻击型", "抑郁型"];

function pdqBlank() {
  return Array(126).fill(0);
}

function pdqHonest() {
  const answers = pdqBlank();
  TOO_GOOD_REVERSE.forEach((n) => {
    answers[n - 1] = 1;
  });
  return answers;
}

function pdqMark(answers, items) {
  items.forEach((n) => {
    answers[n - 1] = 1;
  });
  return answers;
}

function pdqProtocol(answers, extra = {}) {
  const scored = scorePdq4(answers);
  const scales = scored.scales.map((scale) => ({
    id: scale.id,
    name: scale.name,
    alias: scale.alias,
    cluster: scale.cluster,
    about: scale.about,
    portrait: scale.portrait,
    score: scale.score,
    max: scale.max,
    cutoff: scale.cutoff,
    positive: scale.positive,
  }));
  return {
    scored,
    report: {
      assessmentId: "pdq4",
      assessmentName: "PDQ-4 人格障碍筛查",
      assessmentVersion: "pdq4-h5-v1",
      nickname: extra.nickname || "阿禾",
      completedAt: when,
      dimensions: scales.map((scale) => ({
        id: scale.id,
        name: scale.name,
        kind: "score",
        score: 0,
        max: scale.max,
        level: "clear",
        levelLabel: "未达到",
        narrative: "不该出现的维度旧句",
        labels: [],
      })),
      result: {
        headline: "不该用结果标题",
        code: "clear",
        label: "筛查不是诊断",
        summary: "不该用结果正文",
        flags: [],
      },
      interpretation: scored.positiveScales.map((scale) => ({
        id: scale.id,
        title: scale.name,
        text: scale.portrait,
      })),
      recommendations: [
        { id: "reader", text: "统一阅读页目前只重绘职业六芒星，PDQ-4 的阅读页会另开任务。" },
        { id: "note", title: "可以放一放", text: "分数只是这次问卷的筛查标记。" },
      ],
      reportContent: {
        format: "view-model+sections",
        viewModel: {
          scales,
          positiveCount: scored.positiveCount,
          total: scored.total,
          tooGood: scored.tooGood,
          suspect: scored.suspect,
          impulse: scored.impulse,
          conduct: scored.conduct,
          verdict: scored.verdict,
          clusters: [
            { id: "A", name: "A 群", note: "疏离、猜疑或古怪" },
            { id: "B", name: "B 群", note: "情绪强烈、人际动荡" },
            { id: "C", name: "C 群", note: "焦虑、依赖或过度控制" },
            { id: "X", name: "附录", note: "DSM-IV 建议进一步观察的类型" },
          ],
          rushed: Boolean(extra.rushed),
        },
      },
      extensionData: {
        answers: Array(126).fill(1),
        score: {
          ...scored,
          total: 999,
          positiveCount: 11,
          scales: scored.scales.map((scale) => ({ ...scale, score: 0, positive: false, portrait: "不该出现的画像" })),
          tooGood: { score: 0, max: 4, cutoff: 2, flagged: false, items: [] },
          suspect: { score: 9, max: 2, cutoff: 1, flagged: true, items: [99] },
          impulse: { count: 9, need: 2, point: 0 },
          conduct: { count: 9, need: 3, point: 0 },
          verdict: { id: "clear", title: "不该用的标题", text: "不该用的正文" },
        },
        quality: { rushed: false },
      },
    },
  };
}

test("PDQ-4 协议对象画出十二量表、效度和分群，viewModel 盖过旧分", () => {
  const answers = pdqHonest();
  const par = SCALES.find((scale) => scale.id === "par");
  const bor = SCALES.find((scale) => scale.id === "bor");
  pdqMark(answers, par.items.slice(0, par.cutoff));
  pdqMark(answers, bor.items.slice(0, bor.cutoff));
  const { scored, report } = pdqProtocol(answers);
  const html = renderReport(report);
  assert.equal(html.includes("这份报告的阅读页还没接上"), false);
  assert.equal(html.includes("PDQ-4 人格障碍筛查"), true);
  assert.equal(html.includes("筛查不是诊断"), true);
  assert.equal(html.includes(scored.verdict.title), true);
  assert.equal(html.includes(scored.verdict.text), true);
  assert.equal(html.includes("不该用的标题"), false);
  assert.equal(html.includes("不该用的正文"), false);
  assert.equal(html.includes("不该用结果标题"), false);
  assert.equal(html.includes("不该出现的画像"), false);
  assert.equal(html.includes("不该出现的维度旧句"), false);
  assert.equal(html.includes("统一阅读页目前只重绘"), false);
  assert.equal(html.includes("分数只是这次问卷的筛查标记。"), true);
  assert.equal(html.includes(`<b>${scored.positiveCount}</b><span>达到划界</span>`), true);
  assert.equal(html.includes(`<b>${scored.total}</b><span>十二维合计</span>`), true);
  assert.equal(html.includes("<b>999</b>"), false);
  assert.equal(html.includes("<b>11</b>"), false);
  assert.equal(html.includes("合计把第 60 题算了两次"), true);
  assert.equal(html.split("pdq-hit").length - 1, scored.positiveCount);
  for (let i = 1; i < PDQ_NAMES.length; i += 1) {
    assert.equal(html.indexOf(`<h3>${PDQ_NAMES[i - 1]}`) < html.indexOf(`<h3>${PDQ_NAMES[i]}`), true, PDQ_NAMES[i]);
  }
  assert.equal(html.indexOf("A 群") < html.indexOf("B 群"), true);
  assert.equal(html.indexOf("B 群") < html.indexOf("C 群"), true);
  assert.equal(html.indexOf("C 群") < html.indexOf("附录"), true);
  assert.equal(html.includes("疏离、猜疑或古怪"), true);
  assert.equal(html.includes("癔症型"), true);
  const parScore = scored.scales.find((scale) => scale.id === "par");
  const borScore = scored.scales.find((scale) => scale.id === "bor");
  assert.equal(html.includes(`${parScore.score} <small>/ ${parScore.max}</small>`), true);
  assert.equal(html.includes(`${borScore.score} <small>/ ${borScore.max}</small>`), true);
  assert.equal(html.split(parScore.portrait).length - 1, 1);
  assert.equal(html.split(borScore.portrait).length - 1, 1);
  const quiet = scored.scales.find((scale) => scale.id === "szd");
  assert.equal(html.includes(quiet.portrait), false);
  assert.equal(html.includes(quiet.about), true);
  assert.equal(html.includes(`<h3>掩饰</h3>`), true);
  assert.equal(html.includes(`<h3>怀疑</h3>`), true);
  assert.equal(html.includes(`${scored.tooGood.score} <small>/ ${scored.tooGood.max}</small>`), true);
  assert.equal(html.includes(`${scored.suspect.score} <small>/ ${scored.suspect.max}</small>`), true);
  assert.equal(html.includes("未触发"), true);
  assert.equal(html.includes("记分题号：99"), false);
  assert.equal(html.includes("pdq4-h5-v1"), true);
  assert.equal(html.includes("阿禾"), true);
  assert.equal(html.includes("2026年10月22日"), true);
  assert.equal(html.includes("作答偏快"), false);
});

test("PDQ-4 全否时掩饰可读，十二个量表都不标成阳性", () => {
  const { scored, report } = pdqProtocol(pdqBlank());
  const html = renderReport(report);
  assert.equal(scored.verdict.id, "too-good-clear");
  assert.equal(scored.tooGood.flagged, true);
  assert.equal(scored.suspect.flagged, false);
  assert.equal(html.includes(scored.verdict.title), true);
  assert.equal(html.includes("需要留意"), true);
  assert.equal(html.includes("未触发"), true);
  assert.equal(html.includes("pdq-hit"), false);
  assert.equal(html.includes(`${scored.tooGood.score} <small>/ ${scored.tooGood.max}</small>`), true);
  assert.equal(html.includes("0 <small>/ 2</small>"), true);
  assert.equal(html.includes("scl-crisis"), false);
  assert.equal(scored.positiveScales.length, 0);
  scored.scales.forEach((scale) => {
    assert.equal(html.includes(scale.portrait), false, scale.id);
  });
});

test("PDQ-4 没有 viewModel 时退回 extensionData.score", () => {
  const answers = pdqMark(pdqHonest(), SCALES.find((scale) => scale.id === "avo").items.slice(0, 4));
  const scored = scorePdq4(answers);
  const html = renderReport({
    assessmentId: "pdq4",
    assessmentName: "人格障碍筛查",
    assessmentVersion: "pdq4-h5-v1",
    nickname: "小林",
    completedAt: when,
    extensionData: { score: scored, quality: { rushed: true } },
  });
  const avo = scored.scales.find((scale) => scale.id === "avo");
  assert.equal(html.includes("人格障碍筛查"), true);
  assert.equal(html.includes("筛查不是诊断"), true);
  assert.equal(html.includes(scored.verdict.title), true);
  assert.equal(html.includes(`${avo.score} <small>/ ${avo.max}</small>`), true);
  assert.equal(html.includes("pdq-hit"), true);
  assert.equal(html.split(avo.portrait).length - 1, 1);
  assert.equal(html.includes("作答偏快"), true);
  assert.equal(html.includes(`<b>${scored.total}</b><span>十二维合计</span>`), true);
  assert.equal(html.includes("小林"), true);
});

test("PDQ-4 缺字段时降级，不白屏，也不把空分画成 0", () => {
  const html = renderReport({
    assessmentId: "pdq4",
    nickname: "阿禾",
    completedAt: when,
    assessmentVersion: "pdq4-h5-v1",
    reportContent: { viewModel: { scales: null, tooGood: null, suspect: null, verdict: null } },
  });
  assert.equal(html.includes("这份报告的阅读页还没接上"), false);
  assert.equal(html.includes("这份结果里没有可显示的分数。"), true);
  assert.equal(html.includes("筛查不是诊断"), true);
  assert.equal(html.includes("PDQ-4 人格障碍筛查"), true);
  for (const name of PDQ_NAMES) assert.equal(html.includes(`<h3>${name}`), true, name);
  assert.equal(html.includes("<h3>掩饰</h3>"), true);
  assert.equal(html.includes("<h3>怀疑</h3>"), true);
  assert.equal(html.includes("— <small>/ 7</small>"), true);
  assert.equal(html.includes("— <small>/ 4</small>"), true);
  assert.equal(html.includes("— <small>/ 2</small>"), true);
  assert.equal(html.includes(">0 <small>"), false);
  assert.equal(html.includes("pdq-hit"), false);
  assert.equal(html.includes("需要留意"), false);
  assert.equal(html.includes("未触发"), false);
  assert.equal(html.includes("这项效度没有随结果一起送来。"), true);
});

test("PDQ-4 只给了部分维度时仍能读，答案不会被拿来重算", () => {
  const html = renderReport({
    assessmentId: "pdq4",
    assessmentName: "PDQ-4 人格障碍筛查",
    dimensions: [
      { id: "histrionic", name: "癔症型", score: 2, max: 8 },
      { id: "par", name: "偏执型", score: 5, max: 7, levelLabel: "达到划界" },
    ],
    extensionData: { answers: Array(126).fill(1), score: { total: 94, positiveCount: 12 } },
    reportContent: { viewModel: { total: 5, positiveCount: 1 } },
  });
  assert.equal(html.includes("5 <small>/ 7</small>"), true);
  assert.equal(html.includes("2 <small>/ 8</small>"), true);
  assert.equal(html.includes("表演型"), true);
  assert.equal(html.includes("癔症型"), true);
  assert.equal(html.includes("pdq-hit"), true);
  assert.equal(html.includes("达到划界的是偏执型。"), true);
  assert.equal(html.includes("<b>1</b><span>达到划界</span>"), true);
  assert.equal(html.includes("<b>5</b><span>十二维合计</span>"), true);
  assert.equal(html.includes("<b>94</b>"), false);
  assert.equal(html.includes("<b>12</b>"), false);
  assert.equal(html.includes("边缘型</h3>"), true);
  assert.equal(html.includes("未达到"), true);
});

test("PDQ-4 掩饰和怀疑同时标记时平实可读，并转义昵称和画像", () => {
  const html = renderReport({
    assessmentId: "pdq4",
    assessmentName: "<img src=x onerror=alert(1)>",
    nickname: "<script>alert(1)</script>",
    completedAt: when,
    result: { code: "invalid" },
    reportContent: {
      viewModel: {
        positiveCount: 1,
        total: 4,
        verdict: { id: "invalid", title: "<b>作答本身先要打折</b>", text: "有题目提示问卷可疑，同时也有掩饰倾向。" },
        tooGood: { score: 2, max: 4, cutoff: 2, flagged: true, items: [12, 25] },
        suspect: { score: 1, max: 2, cutoff: 1, flagged: true, items: [64] },
        impulse: { count: 2, need: 2, point: 1 },
        conduct: { count: 0, need: 3, point: 0 },
        scales: [{ id: "bor", score: 5, max: 9, cutoff: 5, positive: true, portrait: "<script>alert(1)</script>" }],
      },
    },
  });
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("<b>作答"), false);
  assert.equal(html.includes("&lt;script&gt;"), true);
  assert.equal(html.includes("作答本身先要打折"), true);
  assert.equal(html.includes("scl-crisis"), false);
  assert.equal(html.split("需要留意").length - 1, 2);
  assert.equal(html.includes("记分题号：12、25。"), true);
  assert.equal(html.includes("记分题号：64。"), true);
  assert.equal(html.includes("pdq-portrait"), true);
  assert.equal(html.includes("合成 1 分，记在边缘型。"), true);
  assert.equal(html.includes("合成 0 分，记在反社会型。"), true);
  assert.equal(html.includes("筛查不是诊断"), true);
});

const ECR_REVERSE = new Set(REVERSE_ITEMS);
const ECR_TYPE_NAMES = ["安全型", "恐惧型", "专注型", "冷漠型"];

function ecrPattern({ avoidance = 1, anxiety = 1 } = {}) {
  return QUESTIONS.map((_, index) => {
    const n = index + 1;
    const want = n % 2 === 1 ? avoidance : anxiety;
    return ECR_REVERSE.has(n) ? 8 - want : want;
  });
}

test("ECR 用 scoreEcr 的结果画出类型、两维和四个判别分", () => {
  const scored = scoreEcr(ecrPattern({ avoidance: 2, anxiety: 6 }));
  const html = renderReport({
    assessmentId: "ecr",
    assessmentName: "成人依恋关系测评 ECR",
    assessmentVersion: "ecr-cn-2006-v1",
    nickname: "阿禾",
    completedAt: when,
    extensionData: { score: scored },
  });
  const win = scored.types.find((type) => type.win);
  assert.equal(scored.type.id, "preoccupied");
  assert.equal(html.includes("这份报告的阅读页还没接上"), false);
  assert.equal(html.includes("成人依恋关系测评 ECR"), true);
  assert.equal(html.includes("<h2 class=\"sefs-name\">专注型</h2>"), true);
  assert.equal(html.includes(scored.type.short), true);
  assert.equal(html.includes(scored.type.text), true);
  assert.equal(html.includes("2.00 <small>/ 7</small>"), true);
  assert.equal(html.includes("6.00 <small>/ 7</small>"), true);
  assert.equal(html.includes("低于中点"), true);
  assert.equal(html.includes("高于中点"), true);
  assert.equal(html.includes("width:16.7%"), true);
  assert.equal(html.includes("width:83.3%"), true);
  assert.equal(html.includes("left:50%"), true);
  assert.equal(html.indexOf("<h3>依恋回避</h3>") < html.indexOf("<h3>依恋焦虑</h3>"), true);
  assert.equal(html.includes(`<span>专注型 · 最高</span><b>${win.m.toFixed(2)}</b>`), true);
  for (let i = 1; i < ECR_TYPE_NAMES.length; i += 1) {
    assert.equal(html.indexOf(`<span>${ECR_TYPE_NAMES[i - 1]}`) < html.indexOf(`<span>${ECR_TYPE_NAMES[i]}`), true);
  }
  assert.equal(html.split("ecr-win").length - 1, 1);
  assert.equal(html.includes("18 题合计 36"), true);
  assert.equal(html.includes("18 题合计 108"), true);
  assert.equal(html.includes("筛查不是诊断"), true);
  assert.equal(html.includes("也不能代替面谈"), true);
  assert.equal(html.includes("阿禾"), true);
  assert.equal(html.includes("ecr-cn-2006-v1"), true);
  assert.equal(html.includes("2026年10月22日"), true);
  assert.equal(html.includes("作答偏快"), false);
  assert.equal(html.includes("两个均分都贴着中点"), false);
});

test("ECR 的 viewModel 盖过 extensionData.score，答案不会被拿来重算", () => {
  const scored = scoreEcr(ecrPattern({ avoidance: 2, anxiety: 6 }));
  const html = renderReport({
    assessmentId: "ecr",
    assessmentName: "成人依恋关系测评 ECR",
    nickname: "小林",
    completedAt: when,
    result: { headline: "不该用的标题", summary: "不该用的正文", label: "不该用的短句", code: "fearful" },
    dimensions: [
      { id: "avoidance", name: "依恋回避", score: 7, max: 7, level: "high", levelLabel: "不该出现的水平" },
      { id: "anxiety", name: "依恋焦虑", score: 7, max: 7 },
    ],
    reportContent: {
      viewModel: {
        avoidance: { mean: 1, level: "low", levelLabel: "低于中点" },
        anxiety: { mean: 1.5, level: "low", levelLabel: "低于中点" },
        type: { id: "secure", name: "安全型", short: "自定义短句", text: "自定义类型说明" },
        types: [
          { id: "secure", m: 3.5, win: true },
          { id: "fearful", m: 1, win: false },
          { id: "preoccupied", m: 0.2, win: false },
          { id: "dismissing", m: -1, win: false },
        ],
        tied: false,
        closeCall: false,
        nearMidpoint: false,
        differsFromQuadrant: false,
      },
    },
    extensionData: { answers: Array(36).fill(7), score: scored },
  });
  assert.equal(html.includes("自定义类型说明"), true);
  assert.equal(html.includes("自定义短句"), true);
  assert.equal(html.includes("<h2 class=\"sefs-name\">安全型</h2>"), true);
  assert.equal(html.includes(scored.type.text), false);
  assert.equal(html.includes("不该用的标题"), false);
  assert.equal(html.includes("不该用的正文"), false);
  assert.equal(html.includes("不该用的短句"), false);
  assert.equal(html.includes("不该出现的水平"), false);
  assert.equal(html.includes("1.00 <small>/ 7</small>"), true);
  assert.equal(html.includes("1.50 <small>/ 7</small>"), true);
  assert.equal(html.includes("6.00 <small>/ 7</small>"), false);
  assert.equal(html.includes("2.00 <small>/ 7</small>"), false);
  assert.equal(html.includes("<span>安全型 · 最高</span><b>3.50</b>"), true);
  assert.equal(html.includes("<b>-1.00</b>"), true);
  assert.equal(html.includes("恐惧型</h2>"), false);
  assert.equal(html.includes("小林"), true);
});

test("ECR 只有答案时不重算，缺字段留空且转义", () => {
  const html = renderReport({
    assessmentId: "ecr",
    assessmentName: "<img src=x onerror=alert(1)>",
    nickname: "<script>alert(1)</script>",
    completedAt: when,
    extensionData: { answers: Array(36).fill(1) },
    reportContent: { viewModel: { types: null, avoidance: null, type: 4, dimensions: [null, 1, "x"] } },
  });
  assert.equal(html.includes("这份报告的阅读页还没接上"), false);
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("&lt;script&gt;"), true);
  assert.equal(html.includes("这份结果里没有可显示的类型。"), true);
  assert.equal(html.includes("这份结果里没有可显示的分数。"), true);
  assert.equal(html.includes("— <small>/ 7</small>"), true);
  assert.equal(html.includes("1.33"), false);
  assert.equal(html.includes("4.00"), false);
  assert.equal(html.includes("<h3>依恋回避</h3>"), true);
  assert.equal(html.includes("<h3>依恋焦虑</h3>"), true);
  for (const name of ECR_TYPE_NAMES) assert.equal(html.includes(`<span>${name}</span>`), true, name);
  assert.equal(html.includes("ecr-win"), false);
  assert.equal(html.includes("筛查不是诊断"), true);
  assert.equal(html.includes("也不能代替面谈"), true);
});

test("ECR 贴着中点时写出恐惧型，并标出并列或贴近的说明", () => {
  const scored = scoreEcr(Array(36).fill(4));
  const html = renderReport({
    assessmentId: "ecr",
    nickname: "阿禾",
    completedAt: when,
    extensionData: { score: scored, quality: { rushed: true } },
    recommendations: [{ id: "reader", text: "统一阅读页目前只重绘职业六芒星，ECR 的阅读页会另开任务。" }],
  });
  assert.equal(scored.type.id, "fearful");
  assert.equal(scored.nearMidpoint, true);
  assert.equal(html.includes("<h2 class=\"sefs-name\">恐惧型</h2>"), true);
  assert.equal(html.includes("4.00 <small>/ 7</small>"), true);
  assert.equal(html.includes("处于中点"), true);
  assert.equal(html.includes("两个均分都贴着中点"), true);
  assert.equal(html.includes("作答偏快"), true);
  assert.equal(html.includes("统一阅读页目前只重绘"), false);
  assert.equal(html.includes("若只按 4 分切成四格"), false);
  assert.equal(html.includes(`<span>恐惧型 · 最高</span><b>${scored.types.find((type) => type.win).m.toFixed(2)}</b>`), true);
});
