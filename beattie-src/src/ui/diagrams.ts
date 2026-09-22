export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface SectionScores {
  assessment: number;
  mcq: number;
  tf: number;
}

const SECTION_MAX = { assessment: 100, mcq: 50, tf: 80 } as const;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

export function scoreDiagram(sections: SectionScores, total: number, maxPossible: number): string {
  const rows = [
    { label: '评估', value: sections.assessment, max: SECTION_MAX.assessment },
    { label: '选择', value: sections.mcq, max: SECTION_MAX.mcq },
    { label: '判断', value: sections.tf, max: SECTION_MAX.tf },
  ];

  const bars = rows
    .map((row) => {
      const pct = Math.round(clamp01(row.value / row.max) * 100);
      return `<div class="bar-row">
        <div class="bar-label"><span>${row.label}</span><span>${row.value} / ${row.max}</span></div>
        <div class="bar-track" role="img" aria-label="${row.label} ${row.value} 分，满分 ${row.max}">
          <span style="width:${pct}%"></span>
        </div>
      </div>`;
    })
    .join('');

  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = clamp01(maxPossible > 0 ? total / maxPossible : 0);
  const offset = c * (1 - pct);
  const ring = `<svg class="ring" viewBox="0 0 120 120" role="img" aria-label="总分 ${total}，满分 ${maxPossible}">
    <circle class="ring-track" cx="60" cy="60" r="${r}" fill="none"></circle>
    <circle class="ring-value" cx="60" cy="60" r="${r}" fill="none"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
      transform="rotate(-90 60 60)"></circle>
    <text class="ring-num" x="60" y="58" text-anchor="middle">${total}</text>
    <text class="ring-sub" x="60" y="76" text-anchor="middle">满分 ${maxPossible}</text>
  </svg>`;

  const cx = 110;
  const cy = 104;
  const radius = 62;
  const axes = [
    { label: '评估', deg: -90, ratio: clamp01(sections.assessment / SECTION_MAX.assessment), anchor: 'middle' },
    { label: '选择', deg: 30, ratio: clamp01(sections.mcq / SECTION_MAX.mcq), anchor: 'start' },
    { label: '判断', deg: 150, ratio: clamp01(sections.tf / SECTION_MAX.tf), anchor: 'end' },
  ];
  const grid = (scale: number) =>
    axes
      .map((axis) => polar(cx, cy, radius * scale, axis.deg).map((n) => n.toFixed(1)).join(','))
      .join(' ');
  const shape = axes
    .map((axis) => polar(cx, cy, radius * axis.ratio, axis.deg).map((n) => n.toFixed(1)).join(','))
    .join(' ');
  const spokes = axes
    .map((axis) => {
      const [x, y] = polar(cx, cy, radius, axis.deg);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"></line>`;
    })
    .join('');
  const labels = axes
    .map((axis) => {
      const [x, y] = polar(cx, cy, radius + 18, axis.deg);
      const dy = axis.deg === -90 ? -2 : 4;
      return `<text x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${axis.anchor}">${axis.label}</text>`;
    })
    .join('');
  const dots = axes
    .map((axis) => {
      const [x, y] = polar(cx, cy, radius * axis.ratio, axis.deg);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2"></circle>`;
    })
    .join('');

  const radar = `<svg class="radar" viewBox="0 0 220 208" role="img" aria-label="三项占比形状：评估、选择、判断，各按本块满分折算">
    <polygon class="radar-grid" points="${grid(1)}"></polygon>
    <polygon class="radar-grid inner" points="${grid(0.5)}"></polygon>
    <g class="radar-spoke">${spokes}</g>
    <polygon class="radar-shape" points="${shape}"></polygon>
    <g class="radar-dot">${dots}</g>
    <g class="radar-label">${labels}</g>
  </svg>`;

  return `<div class="diagram">
    <div class="diagram-visuals">${ring}${radar}</div>
    <div class="bars">${bars}</div>
    <p class="diagram-note">三条都按本块满分画。评估 100，选择 50，判断 80。形状越满，这一块越高。</p>
  </div>`;
}

export function miniBars(sections: SectionScores): string {
  const rows = [
    sections.assessment / SECTION_MAX.assessment,
    sections.mcq / SECTION_MAX.mcq,
    sections.tf / SECTION_MAX.tf,
  ];
  return `<div class="mini-bars" aria-hidden="true">${rows
    .map((ratio) => `<span><i style="width:${Math.round(clamp01(ratio) * 100)}%"></i></span>`)
    .join('')}</div>`;
}
