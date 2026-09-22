import type { ArchiveEntry, QuizTest } from '../data/types';
import { insightFor, readingFor, type BandInsight } from '../data/insights';
import { studyAidNote } from '../data/intro';
import { esc, miniBars, scoreDiagram, type SectionScores } from './diagrams';

const DRAMA_NOTE =
  '悲痛还鲜活时，这套分数容易失真。不确定的话，先做悲痛与失落测试，把引发悲痛的事照顾好，再回来看戏剧化。';

function sectionsOf(entry: ArchiveEntry): SectionScores {
  const s = entry.sectionScores ?? { assessment: 0, mcq: 0, tf: 0 };
  return {
    assessment: Number(s.assessment) || 0,
    mcq: Number(s.mcq) || 0,
    tf: Number(s.tf) || 0,
  };
}

function statusBlock(insight: BandInsight, total: number, maxPossible: number): string {
  return `<div class="status-hero">
    <div class="lamp" aria-hidden="true"></div>
    <div>
      <div class="lamp-name">${esc(insight.lamp)} <span>${insight.min}–${insight.max}</span></div>
      <p class="headline">${esc(insight.headline)}</p>
      <p class="score-line">总分 <strong>${total}</strong> / ${maxPossible}</p>
    </div>
  </div>`;
}

export function renderResultBody(opts: {
  test: QuizTest;
  sections: SectionScores;
  total: number;
  bandText: string;
  bandRange: string;
}): string {
  const { test, sections, total, bandText, bandRange } = opts;
  const reading = readingFor(test.id);
  const insight = insightFor(test.id, total);
  const tone = insight?.tone ?? 'gold';

  const means = insight
    ? `<ul class="points">${insight.means.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>`
    : '<p>这一分数没有对上书中的分数段。</p>';
  const actions = insight
    ? `<ol class="actions">${insight.actions.map((line) => `<li><span>${esc(line)}</span></li>`).join('')}</ol>`
    : '';

  const book = bandText
    ? `<details class="book-band">
        <summary>书中原话 <span>${esc(bandRange || '原文')}</span></summary>
        <p>${esc(bandText)}</p>
      </details>`
    : '';

  const drama =
    test.id === 'drama'
      ? `<aside class="grief-remind"><strong>先看悲痛</strong><p>${DRAMA_NOTE}</p></aside>`
      : '';

  return `<section class="card result-card tone-${tone}">
    <p class="kicker">第 ${test.chapter} 章 · 学习解读</p>
    <h1>${esc(test.title)}</h1>
    ${reading ? `<p class="theme">${esc(reading.theme)}</p>` : ''}
    <p class="study-note">${esc(studyAidNote)}</p>

    <h2>状态一眼看懂</h2>
    ${
      insight
        ? statusBlock(insight, total, test.maxPossible)
        : `<p class="headline">总分 ${total} / ${test.maxPossible}。没有匹配到分数段。</p>`
    }

    <h2>分数结构图</h2>
    ${scoreDiagram(sections, total, test.maxPossible)}

    <h2>这意味着什么</h2>
    ${means}

    <h2>你可以怎么做</h2>
    ${actions}
    ${drama}
    ${book}

    <div class="sticky-bar">
      <button class="btn ghost" data-retry>重做</button>
      <button class="btn ghost" data-archive>档案</button>
      <button class="btn primary" data-home>回首页</button>
    </div>
  </section>`;
}

export function renderArchiveCard(entry: ArchiveEntry, maxPossible = 230): string {
  const sections = sectionsOf(entry);
  const total = Number(entry.total) || 0;
  const insight = insightFor(entry.testId, total);
  const tone = insight?.tone ?? 'gold';
  const when = new Date(entry.completedAt).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const headline = insight?.headline ?? '这一次只留下了原文分数段。';
  const book = entry.bandText
    ? `<details class="book-band">
        <summary>书中原话</summary>
        <p>${esc(entry.bandText)}</p>
      </details>`
    : '';

  return `<article class="archive-card tone-${tone}">
    <header>
      <div class="lamp" aria-hidden="true"></div>
      <div class="archive-id">
        <strong>${esc(entry.title)}</strong>
        <div class="when">${esc(when)} · 上海</div>
      </div>
      <div class="arch-total">${total}<small>/${maxPossible}</small></div>
    </header>
    <p class="lamp-name">${insight ? esc(insight.lamp) : '记录'}</p>
    <p class="headline">${esc(headline)}</p>
    <p class="arch-split">评估 ${sections.assessment} · 选择 ${sections.mcq} · 判断 ${sections.tf}</p>
    ${miniBars(sections)}
    ${book}
  </article>`;
}
