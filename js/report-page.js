import { ASSESSMENT_CLOUD_CONFIG } from "./assessment-cloud-config.js";
import { parseShareHash, resolveEndpoint } from "./cloud-client.js";
import { renderReport } from "./report-render.js?v=cloud4";

const box = document.querySelector("#report");
const endpoint = resolveEndpoint(location, { ...ASSESSMENT_CLOUD_CONFIG, ...(window.ASSESSMENT_CLOUD_CONFIG || {}) });

function show(message, retry) {
  box.innerHTML = `<p class="state">${message}</p>${retry ? `<button class="retry" type="button">再试一次</button>` : ""}`;
  const button = box.querySelector(".retry");
  if (button) button.addEventListener("click", () => { void load(); });
}

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
      box.innerHTML = `<p class="state">这条链接已经失效</p>`;
      return;
    }
    if (!response.ok) {
      show("打不开", true);
      return;
    }
    const report = await response.json();
    box.innerHTML = renderReport(report);
  } catch {
    show("打不开", true);
  }
}

load();
