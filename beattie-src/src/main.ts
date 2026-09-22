import './style.css';
import { allTests, getTestById, homeCopy, starNotes, footerCopyright } from './data';
import { readingFor } from './data/insights';
import type { QuizTest, ArchiveEntry } from './data/types';
import { scoreLikert, scoreMcq, scoreTf, computeTotal, starsLabel } from './lib/scoring';
import {
  loadArchive,
  saveArchiveEntry,
  clearArchive,
  saveDraft,
  loadDraft,
  clearDraft,
} from './lib/storage';
import { renderArchiveCard, renderResultBody } from './ui/result';

type Step = 'warning' | 'assessment' | 'mcq' | 'tf' | 'result';

interface DraftState {
  step: Step;
  warningAccepted?: boolean;
  likert: (number | null)[];
  mcq: (string | 'NA' | null)[];
  tf: (('yes' | 'no' | 'NA') | null)[];
  angerFill?: string;
}

const app = document.querySelector<HTMLDivElement>('#app')!;

function route(): { page: string; id?: string } {
  const hash = location.hash.replace(/^#\/?/, '') || '';
  const [page, id] = hash.split('/');
  if (!page) return { page: 'home' };
  return { page, id };
}

function go(path: string) {
  location.hash = '#/' + path.replace(/^\//, '');
}

function footerHtml() {
  return `<footer class="footer">${footerCopyright}</footer>`;
}

function topbar(extra = '') {
  return `<header class="topbar">
    <a class="brand" href="#/">情绪档案<small>如何为爱立界限 · Part 3</small></a>
    <div class="nav-actions">${extra}
      <button class="btn ghost" data-nav="archive">情绪档案</button>
    </div>
  </header>`;
}

function renderHome() {
  const archive = loadArchive();
  const cards = allTests
    .map((t) => {
      const done = archive.find((a) => a.testId === t.id);
      const blurb = readingFor(t.id)?.blurb ?? '';
      return `<a class="test-card" href="#/test/${t.id}">
        <div class="ch">第 ${t.chapter} 章</div>
        <h3>${t.title}</h3>
        <p class="blurb">${blurb}</p>
        <div class="meta">评估 ${t.likertItems.length} · 选择 ${t.mcqItems.length} · 判断 ${t.tfItems.length}</div>
        ${t.warning ? '<span class="badge warn">开始前先读悲痛提醒</span>' : ''}
        ${done ? `<span class="badge">最近 ${done.total}</span>` : ''}
      </a>`;
    })
    .join('');

  const introCards = homeCopy.cards
    .map((c) => `<article class="intro-card"><h2>${c.title}</h2><p>${c.text}</p></article>`)
    .join('');

  app.innerHTML = `<div class="shell">
    ${topbar()}
    <section class="hero">
      <p class="kicker">${homeCopy.kicker}</p>
      <h1>${homeCopy.title}</h1>
      <p class="lead">${homeCopy.lead}</p>
      <div class="intro-grid">${introCards}</div>
      <p class="star-label">星号</p>
      <ul class="star-list">
        ${starNotes
          .map((s) => `<li><span class="mark">${s.label}</span><span>${s.text}</span></li>`)
          .join('')}
      </ul>
    </section>
    <div class="test-grid">${cards}</div>
  </div>${footerHtml()}`;

  app.querySelector('[data-nav="archive"]')?.addEventListener('click', () => go('archive'));
}

function renderArchive() {
  const list = loadArchive();
  const empty = `<div class="empty-card">
      <strong>还没有记录</strong>
      <p>做完任何一套，结果会留在这台浏览器里。</p>
      <button class="btn primary" data-nav="home">去看六套测试</button>
    </div>`;
  app.innerHTML = `<div class="shell">
    ${topbar('<button class="btn ghost" data-nav="home">回首页</button>')}
    <section class="archive-page">
      <header class="archive-head">
        <h1>情绪档案</h1>
        <p>只留在这台浏览器里，不会上传。</p>
      </header>
      ${list.length === 0 ? empty : `<div class="archive-list">${list.map((e) => renderArchiveCard(e)).join('')}</div>`}
      ${list.length ? '<button class="btn danger" data-clear>清空档案</button>' : ''}
    </section>
  </div>${footerHtml()}`;

  app.querySelector('[data-nav="home"]')?.addEventListener('click', () => go(''));
  app.querySelector('[data-nav="archive"]')?.addEventListener('click', () => go('archive'));
  app.querySelector('[data-clear]')?.addEventListener('click', () => {
    if (confirm('确定清空全部情绪档案？')) {
      clearArchive();
      renderArchive();
    }
  });
}

function emptyDraft(test: QuizTest): DraftState {
  return {
    step: test.warning ? 'warning' : 'assessment',
    warningAccepted: !test.warning,
    likert: Array(test.likertItems.length).fill(null),
    mcq: Array(test.mcqItems.length).fill(null),
    tf: Array(test.tfItems.length).fill(null),
    angerFill: '',
  };
}

function stepOrder(test: QuizTest): { id: Step; label: string }[] {
  const steps: { id: Step; label: string }[] = [];
  if (test.warning) steps.push({ id: 'warning', label: '提醒' });
  steps.push(
    { id: 'assessment', label: '评估' },
    { id: 'mcq', label: '选择' },
    { id: 'tf', label: '判断' },
    { id: 'result', label: '结果' },
  );
  return steps;
}

function progressPct(step: Step, test: QuizTest): number {
  const order = stepOrder(test);
  const i = Math.max(0, order.findIndex((s) => s.id === step));
  return Math.round(((i + 1) / order.length) * 100);
}

function stepsHtml(step: Step, test: QuizTest): string {
  return `<ol class="steps">${stepOrder(test)
    .map((s) => `<li class="${s.id === step ? 'on' : ''}">${s.label}</li>`)
    .join('')}</ol>`;
}

function renderTest(test: QuizTest) {
  let draft = loadDraft<DraftState>(test.id) ?? emptyDraft(test);
  // sanitize lengths
  if (draft.likert.length !== test.likertItems.length) draft = emptyDraft(test);

  const persist = () => saveDraft(test.id, draft);

  const paint = () => {
    const pct = progressPct(draft.step, test);
    let body = '';

    if (draft.step === 'warning' && test.warning) {
      const paragraphs = test.warning
        .split(/\n\n+/)
        .map((p) => `<p>${p}</p>`)
        .join('');
      body = `<section class="card">
        <p class="kicker">开始前</p>
        <h1>${test.title}</h1>
        <div class="warning-box">${paragraphs}</div>
        <div class="sticky-bar">
          <button class="btn ghost" data-back>返回</button>
          <button class="btn primary" data-accept>读过了，开始</button>
        </div>
      </section>`;
    } else if (draft.step === 'assessment') {
      body = `<section class="card">
        <h1>${test.title}</h1>
        <h2 class="section-title">${test.assessmentTitle}</h2>
        <div class="notes-block"><ul>${(test.likertNotes ?? [])
          .map((n) => `<li>${n}</li>`)
          .join('')}</ul></div>
        ${test.likertItems
          .map((item, i) => {
            const stars = starsLabel(item.stars);
            return `<div class="item" data-likert="${i}">
              <div class="q">${item.id}．${item.text}${stars ? `<span class="stars">${stars}</span>` : ''}</div>
              ${item.note ? `<div class="note">${item.note}</div>` : ''}
              ${
                test.id === 'emotional-health' && item.id === 3
                  ? `<label style="display:flex;gap:.4rem;align-items:center;margin-bottom:.5rem;font-size:.9rem;color:var(--ink-soft)">
                      <input type="checkbox" data-no-kids ${draft.likert[i] === 10 && (draft as any)._noKids ? 'checked' : ''}/> 我没有孩子（按书中说明本题打 10 分）
                    </label>`
                  : ''
              }
              <div class="likert">
                ${Array.from({ length: 11 }, (_, v) => {
                  const active = draft.likert[i] === v ? 'active' : '';
                  return `<button type="button" data-v="${v}" class="${active}">${v}</button>`;
                }).join('')}
              </div>
            </div>`;
          })
          .join('')}
        <div class="sticky-bar">
          <button class="btn ghost" data-back>${test.warning ? '上一步' : '返回'}</button>
          <button class="btn primary" data-next>下一节：选择</button>
        </div>
      </section>`;
    } else if (draft.step === 'mcq') {
      body = `<section class="card">
        <h1>${test.title}</h1>
        <h2 class="section-title">二、选择题</h2>
        <div class="notes-block">阅读每个句子的前半部分，然后选择适合你的后半部分描述。</div>
        ${test.mcqItems
          .map((item, i) => {
            const hasNa = typeof item.naScore === 'number';
            return `<div class="item" data-mcq="${i}">
              <div class="q">${item.id}．${item.prompt}</div>
              ${item.scoreNote ? `<div class="note">${item.scoreNote}</div>` : ''}
              <div class="options">
                ${item.options
                  .map((op) => {
                    const checked = draft.mcq[i] === op.key ? 'checked' : '';
                    const st = op.stars ? `<span class="stars">${starsLabel(op.stars)}</span>` : '';
                    return `<label class="option"><input type="radio" name="mcq-${i}" value="${op.key}" ${checked}/><span class="key">${op.key}．</span><span>${op.text}${st}</span></label>`;
                  })
                  .join('')}
                ${
                  hasNa
                    ? `<label class="option"><input type="radio" name="mcq-${i}" value="NA" ${draft.mcq[i] === 'NA' ? 'checked' : ''}/><span class="key">—</span><span>本题不符合我的情况（按书中说明打 ${item.naScore} 分）</span></label>`
                    : ''
                }
              </div>
            </div>`;
          })
          .join('')}
        <div class="sticky-bar">
          <button class="btn ghost" data-prev>上一节</button>
          <button class="btn primary" data-next>下一节：判断</button>
        </div>
      </section>`;
    } else if (draft.step === 'tf') {
      body = `<section class="card">
        <h1>${test.title}</h1>
        <h2 class="section-title">三、判断题</h2>
        <div class="notes-block">${test.tfScoringNote ?? '阅读每个陈述，然后画“√”（是）或“×”（否）。'}</div>
        ${test.tfItems
          .map((item, i) => {
            const stars = starsLabel(item.stars);
            const showNa =
              (test.id === 'guilt' && item.id === 6) ||
              item.stars === 2;
            const fill =
              test.id === 'anger' && item.id === 1
                ? `<input type="text" placeholder="填空（可选）" data-anger-fill value="${draft.angerFill ?? ''}" style="width:100%;margin:.4rem 0 .6rem;padding:.5rem .7rem;border:1px solid var(--line);border-radius:10px;font:inherit"/>`
                : '';
            return `<div class="item" data-tf="${i}">
              <div class="q">${item.id}．${item.text}${stars ? `<span class="stars">${stars}</span>` : ''}</div>
              ${fill}
              ${item.note ? `<div class="note">${item.note}</div>` : ''}
              <div class="tf-row">
                <button type="button" class="yes ${draft.tf[i] === 'yes' ? 'active' : ''}" data-a="yes">√ 是</button>
                <button type="button" class="no ${draft.tf[i] === 'no' ? 'active' : ''}" data-a="no">× 否</button>
                ${
                  showNa
                    ? `<button type="button" class="na ${draft.tf[i] === 'NA' ? 'active' : ''}" data-a="NA">不适用（10分）</button>`
                    : ''
                }
              </div>
            </div>`;
          })
          .join('')}
        <div class="sticky-bar">
          <button class="btn ghost" data-prev>上一节</button>
          <button class="btn primary" data-finish>看结果</button>
        </div>
      </section>`;
    } else if (draft.step === 'result') {
      const a = scoreLikert(draft.likert);
      const m = scoreMcq(test.mcqItems, draft.mcq);
      const t = scoreTf(test.tfItems, draft.tf);
      const { total, band } = computeTotal(test, { assessment: a, mcq: m, tf: t });
      body = renderResultBody({
        test,
        sections: { assessment: a, mcq: m, tf: t },
        total,
        bandText: band?.text ?? '',
        bandRange: band ? `${band.min}–${band.max}` : '',
      });
    }

    app.innerHTML = `<div class="shell">
      ${topbar('<button class="btn ghost" data-nav="home">首页</button>')}
      ${stepsHtml(draft.step, test)}
      <div class="progress" aria-hidden="true"><span style="width:${pct}%"></span></div>
      ${body}
    </div>${footerHtml()}`;

    bind();
  };

  function bind() {
    app.querySelector('[data-nav="home"]')?.addEventListener('click', () => go(''));
    app.querySelector('[data-nav="archive"]')?.addEventListener('click', () => go('archive'));

    app.querySelector('[data-back]')?.addEventListener('click', () => {
      if (draft.step === 'warning' || (draft.step === 'assessment' && !test.warning)) {
        go('');
        return;
      }
      if (draft.step === 'assessment' && test.warning) draft.step = 'warning';
      persist();
      paint();
    });

    app.querySelector('[data-accept]')?.addEventListener('click', () => {
      draft.warningAccepted = true;
      draft.step = 'assessment';
      persist();
      paint();
    });

    app.querySelectorAll('[data-likert]').forEach((el) => {
      const i = Number((el as HTMLElement).dataset.likert);
      el.querySelectorAll('button[data-v]').forEach((btn) => {
        btn.addEventListener('click', () => {
          draft.likert[i] = Number((btn as HTMLElement).dataset.v);
          persist();
          paint();
        });
      });
      const noKids = el.querySelector('[data-no-kids]') as HTMLInputElement | null;
      noKids?.addEventListener('change', () => {
        if (noKids.checked) {
          draft.likert[i] = 10;
          (draft as any)._noKids = true;
        } else {
          (draft as any)._noKids = false;
        }
        persist();
        paint();
      });
    });

    app.querySelector('[data-next]')?.addEventListener('click', () => {
      if (draft.step === 'assessment') {
        if (draft.likert.some((v) => v === null)) {
          alert('评估部分还有题没打分。');
          return;
        }
        draft.step = 'mcq';
      } else if (draft.step === 'mcq') {
        if (draft.mcq.some((v) => v === null)) {
          alert('选择题还有空着的。');
          return;
        }
        draft.step = 'tf';
      }
      persist();
      paint();
    });

    app.querySelector('[data-prev]')?.addEventListener('click', () => {
      if (draft.step === 'mcq') draft.step = 'assessment';
      else if (draft.step === 'tf') draft.step = 'mcq';
      persist();
      paint();
    });

    app.querySelectorAll('[data-mcq]').forEach((el) => {
      const i = Number((el as HTMLElement).dataset.mcq);
      el.querySelectorAll('input[type=radio]').forEach((input) => {
        input.addEventListener('change', () => {
          draft.mcq[i] = (input as HTMLInputElement).value as any;
          persist();
        });
      });
    });

    app.querySelectorAll('[data-tf]').forEach((el) => {
      const i = Number((el as HTMLElement).dataset.tf);
      el.querySelectorAll('button[data-a]').forEach((btn) => {
        btn.addEventListener('click', () => {
          draft.tf[i] = (btn as HTMLElement).dataset.a as any;
          persist();
          paint();
        });
      });
    });

    const angerFill = app.querySelector('[data-anger-fill]') as HTMLInputElement | null;
    angerFill?.addEventListener('input', () => {
      draft.angerFill = angerFill.value;
      persist();
    });

    app.querySelector('[data-finish]')?.addEventListener('click', () => {
      if (draft.tf.some((v) => v === null)) {
        alert('判断题还有空着的。');
        return;
      }
      const a = scoreLikert(draft.likert);
      const m = scoreMcq(test.mcqItems, draft.mcq);
      const t = scoreTf(test.tfItems, draft.tf);
      const { total, band } = computeTotal(test, { assessment: a, mcq: m, tf: t });
      const entry: ArchiveEntry = {
        testId: test.id,
        title: test.title,
        completedAt: new Date().toISOString(),
        sectionScores: { assessment: a, mcq: m, tf: t },
        total,
        bandText: band?.text ?? '',
      };
      saveArchiveEntry(entry);
      draft.step = 'result';
      persist();
      paint();
    });

    app.querySelector('[data-retry]')?.addEventListener('click', () => {
      clearDraft(test.id);
      draft = emptyDraft(test);
      persist();
      paint();
    });

    app.querySelector('[data-home]')?.addEventListener('click', () => {
      clearDraft(test.id);
      go('');
    });

    app.querySelector('[data-archive]')?.addEventListener('click', () => {
      go('archive');
    });
  }

  paint();
}

function render() {
  const { page, id } = route();
  if (page === 'archive') return renderArchive();
  if (page === 'test' && id) {
    const test = getTestById(id);
    if (!test) {
      go('');
      return;
    }
    return renderTest(test);
  }
  renderHome();
}

window.addEventListener('hashchange', render);
render();
