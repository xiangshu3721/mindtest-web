import assert from "node:assert/strict";
import test from "node:test";
import { WORDS } from "../star/js/data.js";
import { buildStarResult } from "../star/js/cloud-payload.js";
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
  const html = renderReport({ assessmentId: "pdq4", assessmentName: "人格障碍筛查" });
  assert.equal(html.includes("这份报告的阅读页还没接上。人格障碍筛查"), true);
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
