function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

function words(list) {
  return (list || []).map((word) => `<li>${esc(word)}</li>`).join("");
}

function when(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function renderStarReport(report) {
  const drive = report.reportContent?.viewModel?.driveOrder || report.dimensions?.find((item) => item.id === "drive")?.labels || [];
  const pursue = report.reportContent?.viewModel?.pursueOrder || report.dimensions?.find((item) => item.id === "pursue")?.labels || [];
  const notes = []
    .concat(report.interpretation || [], report.recommendations || [])
    .map((item) => item && item.text)
    .filter(Boolean);
  return `
    <p class="read-note">这是同一份结果的阅读页。词的顺序和交卷时一样，这里不能改。</p>
    <figure class="plate">
      <svg class="mark" viewBox="0 0 100 100" aria-hidden="true">
        <polygon class="up" points="50,8 86.4,71 13.6,71" />
        <polygon class="down" points="50,92 13.6,29 86.4,29" />
      </svg>
      <figcaption>职业六芒星</figcaption>
    </figure>
    <section class="roster">
      <div>
        <h2 class="drive-name">底层动力</h2>
        <ol>${words(drive)}</ol>
      </div>
      <div>
        <h2 class="pursue-name">现实追求</h2>
        <ol>${words(pursue)}</ol>
      </div>
    </section>
    <ul class="notes">${notes.map((text) => `<li>${esc(text)}</li>`).join("")}</ul>
    <p class="meta">${esc(report.nickname)} · ${esc(when(report.completedAt))} · ${esc(report.assessmentVersion)}</p>
  `;
}

export function renderReport(report) {
  if (!report || report.assessmentId !== "star") {
    return `<p class="state">这份报告的阅读页还没接上。${esc(report && report.assessmentName || "")}</p>`;
  }
  return renderStarReport(report);
}
