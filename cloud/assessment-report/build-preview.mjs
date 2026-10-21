/**
 * 把职业六芒星和阅读页拷进函数目录，供手机验收。
 * 不包含其他测评，不包含 ASVA 导入原型。
 * 用法：node cloud/assessment-report/build-preview.mjs
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEV_ENDPOINT, PREVIEW_REPORT_BASE } from "./lib/preview.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
export const previewSite = path.join(here, "preview-site");

const COPIED = [
  ["star/index.html", "star/index.html"],
  ["star/css/app.css", "star/css/app.css"],
  ["star/js/app.js", "star/js/app.js"],
  ["star/js/data.js", "star/js/data.js"],
  ["star/js/cloud-payload.js", "star/js/cloud-payload.js"],
  ["js/result-kit.js", "js/result-kit.js"],
  ["js/cloud-kit.js", "js/cloud-kit.js"],
  ["js/cloud-client.mjs", "js/cloud-client.mjs"],
  ["js/report-page.js", "js/report-page.js"],
  ["js/report-render.js", "js/report-render.js"],
  ["r/index.html", "r/index.html"],
  ["r/report.css", "r/report.css"],
];

function previewConfig() {
  return `/** 预览页专用。正式站配置仍是仓库里的 js/assessment-cloud-config.mjs。 */
export const ASSESSMENT_CLOUD_CONFIG = {
  endpoint: ${JSON.stringify(DEV_ENDPOINT)},
  reportPageBase: ${JSON.stringify(PREVIEW_REPORT_BASE)},
};
`;
}

function previewHome() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="referrer" content="no-referrer" />
    <title>职业六芒星验收预览</title>
  </head>
  <body>
    <p>这是草稿分支的手机验收页，不是正式网站。飞书写入关着。不要填写真实客户资料。</p>
    <p><a href="star/index.html">打开职业六芒星</a></p>
  </body>
</html>
`;
}

function withPreviewMeta(html) {
  if (html.includes('name="robots"')) return html;
  return html.replace(
    "<head>",
    `<head>\n    <meta name="robots" content="noindex, nofollow" />\n    <meta name="referrer" content="no-referrer" />`,
  );
}

export async function buildPreview(dest = previewSite) {
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  for (const [from, to] of COPIED) {
    const target = path.join(dest, to);
    await mkdir(path.dirname(target), { recursive: true });
    if (to.endsWith(".html")) {
      const html = await readFile(path.join(repoRoot, from), "utf8");
      await writeFile(target, withPreviewMeta(html));
    } else {
      await cp(path.join(repoRoot, from), target);
    }
  }
  await mkdir(path.join(dest, "js"), { recursive: true });
  await writeFile(path.join(dest, "js/assessment-cloud-config.mjs"), previewConfig());
  await writeFile(path.join(dest, "index.html"), previewHome());
  return dest;
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  await buildPreview();
  console.log(previewSite);
}
