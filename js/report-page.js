import { ASSESSMENT_CLOUD_CONFIG } from "./assessment-cloud-config.js";
import { parseShareHash, resolveEndpoint } from "./cloud-client.js";
import { renderReport, sharePageTitle } from "./report-render.js?v=cloud9";

const box = document.querySelector("#report");
const endpoint = resolveEndpoint(location, { ...ASSESSMENT_CLOUD_CONFIG, ...(window.ASSESSMENT_CLOUD_CONFIG || {}) });
const KNOWN_ASSESSMENTS = ["star", "sefs", "scl90", "pdq4", "ecr", "root", "loves5", "juying", "holland"];

function applyPageTitle(report) {
  const title = sharePageTitle(report);
  document.title = title;
  for (const selector of ['meta[property="og:title"]', 'meta[property="og:description"]']) {
    const node = document.querySelector(selector);
    if (node) node.setAttribute("content", title);
  }
  const shell = document.querySelector("article.sheet > h1");
  if (!shell) return;
  if (KNOWN_ASSESSMENTS.includes(report && report.assessmentId)) shell.remove();
  else shell.textContent = title;
}

function setAssessment(id) {
  if (typeof id === "string" && id) document.body.dataset.assessment = id;
  else delete document.body.dataset.assessment;
}

function show(message, retry) {
  setAssessment("");
  box.innerHTML = `<p class="state">${message}</p>${retry ? `<button class="retry" type="button">再试一次</button>` : ""}`;
  const button = box.querySelector(".retry");
  if (button) button.addEventListener("click", () => { void load(); });
}

box.addEventListener("click", (event) => {
  const button = event.target.closest(".toggle-career");
  if (!button || !box.contains(button)) return;
  const section = button.closest(".rsec");
  const more = section && section.querySelector(".more");
  if (!section || !more) return;
  const collapsed = !more.hidden;
  more.hidden = collapsed;
  section.classList.toggle("is-collapsed", collapsed);
  button.textContent = collapsed ? "展开看看" : "收起";
  button.setAttribute("aria-expanded", String(!collapsed));
});

async function load() {
  const parsed = parseShareHash(location.hash);
  if (!parsed) {
    show("链接不完整");
    return;
  }
  show("正在打开报告");
  if (!endpoint) {
    show("报告服务还没有接到这个页面。");
    return;
  }
  try {
    const response = await fetch(`${endpoint}/v1/results/read`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed),
    });
    if (response.status === 410) {
      setAssessment("");
      box.innerHTML = `<p class="state">这条链接已经失效</p>`;
      return;
    }
    if (!response.ok) {
      show("打不开", true);
      return;
    }
    const report = await response.json();
    setAssessment(report && report.assessmentId);
    box.innerHTML = renderReport(report);
    applyPageTitle(report);
  } catch {
    show("打不开", true);
  }
}

load();
