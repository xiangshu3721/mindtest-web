import { parseShareLink, resolveEndpoint } from "../js/cloud-client.mjs";

const out = document.querySelector("#out");
const endpoint = resolveEndpoint(location, window.ASSESSMENT_CLOUD_CONFIG || {});

function say(value) {
  out.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

async function call(path, body) {
  if (!endpoint) throw new Error("报告服务还没有接到这个页面");
  const response = await fetch(`${endpoint}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${document.querySelector("#key").value}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

function parsedLink() {
  const parsed = parseShareLink(document.querySelector("#link").value);
  if (!parsed) {
    say("请粘贴作答者发出的完整报告链接");
    return null;
  }
  return parsed;
}

document.querySelector("#preview").addEventListener("click", async () => {
  const parsed = parsedLink();
  if (!parsed) return;
  try {
    const { status, payload } = await call("/v1/integrations/asva/read", parsed);
    if (status === 410) return say("链接已失效，不能导入");
    if (status === 404) return say("链接无效");
    if (status !== 200) return say("暂时读不到报告，请稍后再试");
    say({
      assessmentName: payload.assessmentName,
      nickname: payload.nickname,
      completedAt: payload.completedAt,
      result: payload.result,
      dimensions: payload.dimensions,
      interpretation: payload.interpretation,
      recommendations: payload.recommendations,
      compat: payload.extensionData && payload.extensionData.compat,
      note: "预览只供人工确认。昵称不会自动写成客户昵称。",
    });
  } catch (error) {
    say(error.message || "暂时读不到报告，请稍后再试");
  }
});

document.querySelector("#confirm").addEventListener("click", async () => {
  const parsed = parsedLink();
  if (!parsed) return;
  const customerId = document.querySelector("#customer").value.trim();
  if (!customerId) return say("先填写客户 ID。未选择客户不能确认。");
  try {
    const { status, payload } = await call("/v1/integrations/asva/archive", { ...parsed, customerId });
    if (status === 410) return say("链接已失效，不能导入");
    if (status === 404) return say("链接无效");
    if (status === 409) return say("这份报告已经归到另一位客户，没有覆盖。");
    if (status === 200 && payload.duplicate) return say(`这份报告已经在该客户的原始资料流程里。没有重复归档。`);
    if (status !== 200) return say("没有写入。客户字段保持原样。");
    say({
      archiveStatus: payload.archiveStatus,
      duplicate: payload.duplicate,
      customerFieldsTouched: payload.customerFieldsTouched,
      nicknameAutoMatched: payload.nicknameAutoMatched,
      note: "只更新了报告上的客户归档状态。没有改客户档案里的事实字段。",
    });
  } catch (error) {
    say(error.message || "暂时读不到报告，请稍后再试");
  }
});
