// shared.js — centralizes all JS duplicated across pages do projeto pedagógico
// Loaded synchronously (no defer) so globals are available at parse time.

// ── 1. Prism theme swap ───────────────────────────────────────────────
function updatePrismTheme(theme) {
  const link = document.getElementById('prism-theme');
  if (!link) return;
  link.href = theme === 'dark'
    ? 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css'
    : 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css';
}

// ── 2. Theme toggle ───────────────────────────────────────────────────
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.getElementById('theme-icon').textContent = isDark ? '🌙' : '☀️';
  document.getElementById('theme-label').textContent = isDark ? 'Dark' : 'Light';
  localStorage.setItem('theme', next);
  updatePrismTheme(next);
}

// Restore saved theme immediately (prevents flash)
(function () {
  const t = localStorage.getItem('theme');
  if (!t) return;
  document.documentElement.setAttribute('data-theme', t);
  updatePrismTheme(t);
  document.addEventListener('DOMContentLoaded', function () {
    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    if (t === 'dark' && icon) {
      icon.textContent = '☀️';
      label.textContent = 'Light';
    }
  });
}());

// ── 3. Active Recall system ───────────────────────────────────────────
// PAGE_KEY comes from <body data-page-key="recall_faseN">.
// Exact same keys as the old inline scripts — localStorage is compatible.
(function () {
  const PAGE_KEY = document.body ? (document.body.dataset.pageKey || '') : '';

  if (!document.querySelector('.recall-block')) return;

  function inputKey(input) {
    const blocks = document.querySelectorAll('.recall-block');
    const block  = input.closest('.recall-block');
    const bi     = Array.from(blocks).indexOf(block);
    const inputs = block.querySelectorAll('.code-blank');
    const ii     = Array.from(inputs).indexOf(input);
    return PAGE_KEY + '_b' + bi + '_i' + ii;
  }

  function saveInput(input) {
    const key = inputKey(input);
    localStorage.setItem(key + '_val', input.value);
    const state = ['correct', 'wrong', 'revealed'].find(function (c) {
      return input.classList.contains(c);
    }) || '';
    localStorage.setItem(key + '_state', state);
  }

  function restoreAll() {
    document.querySelectorAll('.recall-block').forEach(function (block, bi) {
      block.querySelectorAll('.code-blank').forEach(function (input, ii) {
        const key   = PAGE_KEY + '_b' + bi + '_i' + ii;
        const val   = localStorage.getItem(key + '_val');
        const state = localStorage.getItem(key + '_state');
        if (val !== null) input.value = val;
        if (state) input.classList.add(state);
      });
      const fbText  = localStorage.getItem(PAGE_KEY + '_b' + bi + '_fb_text');
      const fbClass = localStorage.getItem(PAGE_KEY + '_b' + bi + '_fb_class');
      if (fbText) {
        const fb = block.querySelector('.recall-feedback');
        if (fb) {
          fb.textContent  = fbText;
          fb.className    = fbClass;
          fb.style.display = 'inline-block';
        }
      }
    });
  }

  document.addEventListener('input', function (e) {
    if (!e.target.classList.contains('code-blank')) return;
    e.target.classList.remove('correct', 'wrong', 'revealed');
    saveInput(e.target);
    const block = e.target.closest('.recall-block');
    const bi = Array.from(document.querySelectorAll('.recall-block')).indexOf(block);
    localStorage.removeItem(PAGE_KEY + '_b' + bi + '_fb_text');
    localStorage.removeItem(PAGE_KEY + '_b' + bi + '_fb_class');
    const fb = block.querySelector('.recall-feedback');
    if (fb) fb.style.display = 'none';
  });

  // Keyboard shortcuts inside code-blank inputs
  document.addEventListener('keydown', function (e) {
    if (!document.activeElement || !document.activeElement.classList.contains('code-blank')) return;
    const block = document.activeElement.closest('.recall-block');
    if (!block) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const btn = block.querySelector('.btn-check');
      if (btn) btn.click();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      const btn = block.querySelector('.btn-reset');
      if (btn) btn.click();
      document.activeElement.blur();
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    restoreAll();

    // Inject keyboard shortcut hint below each .recall-actions bar
    document.querySelectorAll('.recall-actions').forEach(function (el) {
      const hint = document.createElement('div');
      hint.className = 'recall-shortcuts-hint';
      hint.textContent = 'Enter = Verificar · Esc = Limpar · Tab = próximo campo';
      el.after(hint);
    });

    // Floating ? button (only on pages with recall blocks)
    const fab = document.createElement('button');
    fab.className = 'shortcuts-fab';
    fab.setAttribute('aria-label', 'Atalhos de teclado');
    fab.textContent = '?';

    const tooltip = document.createElement('div');
    tooltip.className = 'shortcuts-tooltip';
    tooltip.innerHTML =
      '<strong>Atalhos — Active Recall</strong>' +
      '<ul>' +
      '<li><kbd>Enter</kbd><span>Verificar respostas do bloco</span></li>' +
      '<li><kbd>Esc</kbd><span>Limpar respostas do bloco</span></li>' +
      '<li><kbd>Tab</kbd><span>Próximo campo em branco</span></li>' +
      '<li><kbd>Shift+Tab</kbd><span>Campo anterior</span></li>' +
      '</ul>';

    fab.addEventListener('click', function (e) {
      e.stopPropagation();
      tooltip.classList.toggle('visible');
    });
    document.addEventListener('click', function () {
      tooltip.classList.remove('visible');
    });

    document.body.appendChild(fab);
    document.body.appendChild(tooltip);
  });

  window.checkRecall = function (btn) {
    const block  = btn.closest('.recall-block');
    const inputs = block.querySelectorAll('.code-blank');
    let correct  = 0;
    inputs.forEach(function (input) {
      const answer = input.dataset.answer.toLowerCase().trim();
      const val    = input.value.toLowerCase().trim();
      input.classList.remove('correct', 'wrong', 'revealed');
      if (val === answer) { input.classList.add('correct'); correct++; }
      else                { input.classList.add('wrong'); }
      saveInput(input);
    });
    const fb  = block.querySelector('.recall-feedback');
    const all = inputs.length;
    fb.style.display = 'inline-block';
    if (correct === all) {
      fb.textContent = '✓ ' + correct + '/' + all + ' corretos';
      fb.className   = 'recall-feedback ok';
    } else {
      fb.textContent = correct + '/' + all + ' corretos';
      fb.className   = 'recall-feedback fail';
    }
    const bi = Array.from(document.querySelectorAll('.recall-block')).indexOf(block);
    localStorage.setItem(PAGE_KEY + '_b' + bi + '_fb_text',  fb.textContent);
    localStorage.setItem(PAGE_KEY + '_b' + bi + '_fb_class', fb.className);
  };

  window.revealRecall = function (btn) {
    const block = btn.closest('.recall-block');
    block.querySelectorAll('.code-blank').forEach(function (input) {
      input.value = input.dataset.answer;
      input.classList.remove('correct', 'wrong');
      input.classList.add('revealed');
      saveInput(input);
    });
    const fb = block.querySelector('.recall-feedback');
    if (fb) fb.style.display = 'none';
    const bi = Array.from(document.querySelectorAll('.recall-block')).indexOf(block);
    localStorage.removeItem(PAGE_KEY + '_b' + bi + '_fb_text');
    localStorage.removeItem(PAGE_KEY + '_b' + bi + '_fb_class');
  };

  window.resetRecall = function (btn) {
    const block = btn.closest('.recall-block');
    const bi    = Array.from(document.querySelectorAll('.recall-block')).indexOf(block);
    block.querySelectorAll('.code-blank').forEach(function (input, ii) {
      input.value = '';
      input.classList.remove('correct', 'wrong', 'revealed');
      const key = PAGE_KEY + '_b' + bi + '_i' + ii;
      localStorage.removeItem(key + '_val');
      localStorage.removeItem(key + '_state');
    });
    const fb = block.querySelector('.recall-feedback');
    if (fb) fb.style.display = 'none';
    localStorage.removeItem(PAGE_KEY + '_b' + bi + '_fb_text');
    localStorage.removeItem(PAGE_KEY + '_b' + bi + '_fb_class');
  };
}());

// ── 4. Progress Tracking ──────────────────────────────────────────────
window.ProgressTracker = (function () {
  function storageKey(phase, challenge) {
    return 'progress_' + phase + '_challenge_' + challenge;
  }

  function toggle(checkbox) {
    const phase     = checkbox.dataset.phase;
    const challenge = checkbox.dataset.challenge;
    const done      = checkbox.checked;
    localStorage.setItem(storageKey(phase, challenge), done ? '1' : '0');
    const challengeEl = checkbox.closest('.challenge');
    if (challengeEl) challengeEl.classList.toggle('challenge-done', done);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('input[data-phase][data-challenge]').forEach(function (cb) {
      const k = storageKey(cb.dataset.phase, cb.dataset.challenge);
      cb.checked = localStorage.getItem(k) === '1';
      const challengeEl = cb.closest('.challenge');
      if (challengeEl) challengeEl.classList.toggle('challenge-done', cb.checked);
    });
  });

  return { toggle: toggle };
}());

// ── 5. Scroll-to-top button ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const btn = document.createElement('button');
  btn.className = 'scroll-top-btn';
  btn.setAttribute('aria-label', 'Voltar ao topo');
  btn.innerHTML = '↑';
  btn.title = 'Voltar ao topo';
  document.body.appendChild(btn);

  window.addEventListener('scroll', function () {
    btn.classList.toggle('visible', window.scrollY > 300);
  }, { passive: true });

  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

// ── 6. Time badges on challenge headers ───────────────────────────────
var CHALLENGE_TIMES = {
  '1.1': '~20 min', '1.2': '~25 min', '1.3': '~20 min', '1.4': '~25 min',
  '2.1': '~20 min', '2.2': '~35 min', '2.3': '~20 min', '2.4': '~15 min',
  '3.1': '~30 min', '3.2': '~25 min', '3.3': '~20 min',
  '4.1': '~20 min', '4.2': '~30 min', '4.3': '~25 min', '4.4': '~20 min',
  'B.1': '~30 min', 'B.2': '~20 min'
};

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.challenge-header').forEach(function (header) {
    const text  = header.textContent || '';
    const match = text.match(/Desafio\s+([\w.]+)/);
    if (!match) return;
    const id   = match[1];
    const time = CHALLENGE_TIMES[id];
    if (!time) return;

    const badge = document.createElement('span');
    badge.className = 'badge badge-time';
    badge.textContent = time;

    // Insert before the filename span (last child element)
    const filenameSpan = header.querySelector('span');
    if (filenameSpan) {
      header.insertBefore(badge, filenameSpan);
    } else {
      header.appendChild(badge);
    }
  });
});
