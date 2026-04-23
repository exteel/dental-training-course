/**
 * tracking.js — Dental Training Progress Tracker
 * Supabase REST API (no npm, pure fetch, no innerHTML)
 * Login: name + clinic only. No PIN.
 */
(function () {
  'use strict';

  /* ================================================================
     CONFIG
  ================================================================ */
  var SB_URL   = window.DENTAL_SUPABASE_URL || '';
  var SB_KEY   = window.DENTAL_SUPABASE_KEY || '';
  var CONFIGURED = SB_URL && SB_URL !== 'REPLACE_WITH_YOUR_SUPABASE_URL';

  var CLINICS = [
    'Yeremchuk Dental IF',
    'Yeremchuk Dental CV',
    'Stomeconom'
  ];

  var SESSION_KEY = 'dental_session_v3';
  var LS_PREFIX   = 'dental_progress_';

  /* ================================================================
     SUPABASE REST HELPERS
  ================================================================ */
  function sbHeaders() {
    return {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  function sbGet(table, query) {
    return fetch(SB_URL + '/rest/v1/' + table + '?' + query, { headers: sbHeaders() })
      .then(function (r) {
        return r.ok ? r.json() : r.text().then(function (t) { throw new Error(t); });
      });
  }

  function sbPost(table, data) {
    return fetch(SB_URL + '/rest/v1/' + table, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify(data)
    }).then(function (r) {
      return r.ok ? r.json() : r.text().then(function (t) { throw new Error(t); });
    });
  }

  function sbUpsert(table, data) {
    var h = sbHeaders();
    h['Prefer'] = 'resolution=merge-duplicates,return=representation';
    return fetch(SB_URL + '/rest/v1/' + table, {
      method: 'POST', headers: h, body: JSON.stringify(data)
    }).then(function (r) {
      return r.ok ? r.json() : r.text().then(function (t) { throw new Error(t); });
    });
  }

  /* ================================================================
     SESSION
  ================================================================ */
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }

  function setSession(doc) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(doc));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  /* ================================================================
     DOCTOR REGISTRATION / LOGIN  (no PIN)
  ================================================================ */
  function findDoctor(name, clinic) {
    var q = 'name=eq.' + encodeURIComponent(name) +
            '&clinic=eq.' + encodeURIComponent(clinic) +
            '&select=*';
    return sbGet('doctors', q);
  }

  function registerDoctor(name, clinic) {
    return sbPost('doctors', { name: name, clinic: clinic, pin: '' })
      .then(function (rows) { return Array.isArray(rows) ? rows[0] : rows; });
  }

  /* ================================================================
     PROGRESS
  ================================================================ */
  function loadProgress(doctorId) {
    return sbGet('progress', 'doctor_id=eq.' + doctorId + '&select=module_key,score,completed_at');
  }

  function saveProgress(moduleKey, score) {
    var session = getSession();
    /* Guard: stale fake id from a previous broken config → treat as unconfigured */
    if (session && typeof session.id === 'string' && session.id.indexOf('local-') === 0) {
      clearSession();
      session = null;
    }
    if (!session || !CONFIGURED) {
      localStorage.setItem(LS_PREFIX + moduleKey, '1');
      return Promise.resolve(true);
    }
    return sbUpsert('progress', {
      doctor_id: session.id,
      module_key: moduleKey,
      score: (score !== undefined && score !== null) ? score : null,
      completed_at: new Date().toISOString()
    }).then(function () {
      localStorage.setItem(LS_PREFIX + moduleKey, '1');
      return true;
    }).catch(function (e) {
      console.warn('Supabase save failed, localStorage fallback:', e.message);
      localStorage.setItem(LS_PREFIX + moduleKey, '1');
      return true;
    });
  }

  /* ================================================================
     DOM HELPERS — safe element builders
  ================================================================ */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'style') {
          node.style.cssText = attrs[k];
        } else if (k === 'class') {
          node.className = attrs[k];
        } else if (k.startsWith('on')) {
          node.addEventListener(k.slice(2), attrs[k]);
        } else {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    if (children) {
      children.forEach(function (c) {
        if (typeof c === 'string') {
          node.appendChild(document.createTextNode(c));
        } else if (c) {
          node.appendChild(c);
        }
      });
    }
    return node;
  }

  function svgIcon(d) {
    var ns  = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '20'); svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    return svg;
  }

  /* ================================================================
     LOGIN MODAL — name + clinic only, no PIN
  ================================================================ */
  var MODAL_ID = 'dental-login-modal';

  function buildInput(id, type, placeholder) {
    return el('input', {
      id: id,
      type: type,
      placeholder: placeholder,
      style: 'width:100%;box-sizing:border-box;background:rgba(255,255,255,0.06);' +
             'border:1px solid rgba(255,255,255,0.12);border-radius:10px;' +
             'padding:0.75rem 1rem;font-size:0.9375rem;color:#fff;outline:none;' +
             'transition:border-color 200ms ease-out;'
    });
  }

  function buildLabel(text) {
    return el('label', {
      style: 'display:block;font-size:0.75rem;font-weight:600;color:rgba(255,255,255,0.55);' +
             'letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0.375rem'
    }, [text]);
  }

  function buildModal() {
    if (document.getElementById(MODAL_ID)) { return; }

    /* Overlay */
    var overlay = el('div', {
      id: MODAL_ID,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'login-title',
      style: 'position:fixed;inset:0;z-index:9999;background:rgba(7,12,22,0.96);' +
             'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);' +
             'display:flex;align-items:center;justify-content:center;padding:1.5rem;' +
             'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    });

    /* Card */
    var card = el('div', {
      style: 'background:#0f1b2d;border:1px solid rgba(255,255,255,0.10);border-radius:20px;' +
             'padding:clamp(1.5rem,4vw,2.5rem);width:100%;max-width:420px;' +
             'box-shadow:0 32px 80px rgba(0,0,0,0.6)'
    });

    /* Header */
    var icon = el('div', {
      style: 'display:inline-flex;align-items:center;justify-content:center;' +
             'width:52px;height:52px;border-radius:14px;' +
             'background:linear-gradient(135deg,#1d4ed8,#0ea5e9);margin-bottom:1rem'
    }, [svgIcon('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2')]);

    var title = el('h2', {
      id: 'login-title',
      style: 'font-size:1.25rem;font-weight:800;color:#fff;margin:0 0 0.375rem'
    }, ['Yeremchuk Dental Education']);

    var subtitle = el('p', {
      style: 'font-size:0.8125rem;color:rgba(255,255,255,0.45);margin:0'
    }, ['Введіть ваші дані щоб зберігати прогрес']);

    var header = el('div', {
      style: 'text-align:center;margin-bottom:1.75rem'
    }, [icon, title, subtitle]);

    /* Error box */
    var errorBox = el('div', {
      id: 'login-error',
      style: 'display:none;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);' +
             'border-radius:10px;padding:0.75rem 1rem;font-size:0.8125rem;color:#f87171;margin-bottom:1rem'
    });

    /* Name field */
    var nameInput = buildInput('login-name', 'text', 'Іваненко Олексій Петрович');
    nameInput.setAttribute('autocomplete', 'name');
    var nameGroup = el('div', null, [buildLabel('Ваше прізвище та ім\'я'), nameInput]);

    /* Clinic select */
    var clinicSel = el('select', {
      id: 'login-clinic',
      style: 'width:100%;box-sizing:border-box;background:#0f1b2d;' +
             'border:1px solid rgba(255,255,255,0.12);border-radius:10px;' +
             'padding:0.75rem 1rem;font-size:0.9375rem;color:#fff;outline:none;' +
             'transition:border-color 200ms ease-out'
    });
    var placeholder = el('option', { value: '' }, ['Оберіть клініку...']);
    clinicSel.appendChild(placeholder);
    CLINICS.forEach(function (c) {
      clinicSel.appendChild(el('option', { value: c }, [c]));
    });
    var clinicGroup = el('div', null, [buildLabel('Ваша клініка'), clinicSel]);

    /* Submit */
    var submitBtn = el('button', {
      id: 'login-submit',
      style: 'width:100%;padding:0.875rem;background:linear-gradient(135deg,#1d4ed8,#0ea5e9);' +
             'border:none;border-radius:10px;font-size:0.9375rem;font-weight:700;color:#fff;' +
             'cursor:pointer;transition:opacity 200ms ease-out;margin-top:0.25rem'
    }, ['Розпочати →']);

    var footnote = el('p', {
      style: 'text-align:center;font-size:0.75rem;color:rgba(255,255,255,0.20);margin:1.25rem 0 0'
    }, ['Ваш прогрес зберігається персонально']);

    /* Form wrapper */
    var form = el('div', {
      style: 'display:flex;flex-direction:column;gap:0.875rem'
    }, [nameGroup, clinicGroup, submitBtn]);

    card.appendChild(header);
    card.appendChild(errorBox);
    card.appendChild(form);
    card.appendChild(footnote);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    /* Focus styles */
    [nameInput, clinicSel].forEach(function (inp) {
      inp.addEventListener('focus', function () {
        inp.style.borderColor = 'rgba(96,165,250,0.6)';
        inp.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)';
      });
      inp.addEventListener('blur', function () {
        inp.style.borderColor = 'rgba(255,255,255,0.12)';
        inp.style.boxShadow = 'none';
      });
    });

    submitBtn.addEventListener('click', handleLogin);
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { clinicSel.focus(); }
    });
    setTimeout(function () { nameInput.focus(); }, 50);

    function showError(msg) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    }

    function setLoading(on) {
      submitBtn.disabled = on;
      submitBtn.style.opacity = on ? '0.6' : '1';
      submitBtn.textContent = on ? 'Завантаження...' : 'Розпочати →';
    }

    function removeModal() {
      var m = document.getElementById(MODAL_ID);
      if (m) { m.remove(); }
    }

    function handleLogin() {
      errorBox.style.display = 'none';
      var name   = (nameInput.value || '').trim();
      var clinic = clinicSel.value;

      if (!name)   { showError('Введіть ваше прізвище та ім\'я'); return; }
      if (!clinic) { showError('Оберіть клініку'); return; }

      if (!CONFIGURED) {
        var fakeDoc = { id: 'local-' + Date.now(), name: name, clinic: clinic };
        setSession(fakeDoc);
        removeModal();
        onLoginSuccess(fakeDoc, []);
        return;
      }

      setLoading(true);

      findDoctor(name, clinic).then(function (rows) {
        if (!rows || rows.length === 0) {
          /* New doctor — register automatically */
          return registerDoctor(name, clinic).then(function (doc) {
            setSession(doc);
            removeModal();
            onLoginSuccess(doc, []);
          });
        } else {
          /* Existing doctor — load progress and continue */
          var doc = rows[0];
          return loadProgress(doc.id).then(function (progressRows) {
            setSession(doc);
            (progressRows || []).forEach(function (p) {
              localStorage.setItem(LS_PREFIX + p.module_key, '1');
            });
            removeModal();
            onLoginSuccess(doc, progressRows || []);
          });
        }
      }).catch(function (e) {
        setLoading(false);
        showError(e.message || 'Помилка з\'єднання. Спробуйте ще раз.');
      });
    }
  }

  /* ================================================================
     LOGIN SUCCESS CALLBACK
  ================================================================ */
  function onLoginSuccess(doc, progressRows) {
    if (typeof window.onDentalLoginSuccess === 'function') {
      window.onDentalLoginSuccess(doc, progressRows);
    } else {
      window.location.reload();
    }
  }

  /* ================================================================
     COMPLETION TOAST — DOM-only, no innerHTML
  ================================================================ */
  function showCompletionToast(message) {
    var ns   = 'http://www.w3.org/2000/svg';
    var svg  = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '20'); svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'white'); svg.setAttribute('stroke-width', '2.5');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    var p1 = document.createElementNS(ns, 'path');
    p1.setAttribute('d', 'M22 11.08V12a10 10 0 1 1-5.93-9.14');
    var p2 = document.createElementNS(ns, 'polyline');
    p2.setAttribute('points', '22 4 12 14.01 9 11.01');
    svg.appendChild(p1); svg.appendChild(p2);

    var styleTag = document.createElement('style');
    styleTag.textContent = '@keyframes toastIn{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}';
    document.head.appendChild(styleTag);

    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);' +
      'background:linear-gradient(135deg,#059669,#10b981);' +
      'color:#fff;padding:0.875rem 1.5rem;border-radius:12px;' +
      'font-size:0.9375rem;font-weight:600;z-index:9999;' +
      'box-shadow:0 8px 32px rgba(5,150,105,0.4);' +
      'display:flex;align-items:center;gap:0.625rem;' +
      'animation:toastIn 300ms cubic-bezier(0.22,1,0.36,1);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';

    toast.appendChild(svg);
    toast.appendChild(document.createTextNode(message || 'Прогрес збережено!'));
    document.body.appendChild(toast);

    setTimeout(function () {
      toast.style.transition = 'opacity 400ms ease-out';
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 400);
    }, 2800);
  }

  /* ================================================================
     SESSION INFO BAR — shown on module/test pages when logged in
  ================================================================ */
  function injectSessionBar() {
    var session = getSession();
    if (!session) { return; }

    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:1000;' +
      'background:rgba(7,12,22,0.90);backdrop-filter:blur(8px);' +
      '-webkit-backdrop-filter:blur(8px);' +
      'border-bottom:1px solid rgba(255,255,255,0.06);' +
      'display:flex;align-items:center;justify-content:space-between;' +
      'padding:0.5rem 1.5rem;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';

    var left = document.createElement('div');
    left.style.cssText = 'font-size:0.8125rem;color:rgba(255,255,255,0.55)';
    left.appendChild(document.createTextNode('👤 '));
    var nameSpan = document.createElement('strong');
    nameSpan.style.color = 'rgba(255,255,255,0.85)';
    nameSpan.textContent = session.name;
    left.appendChild(nameSpan);
    left.appendChild(document.createTextNode(' · ' + session.clinic));

    var right = document.createElement('div');
    right.style.cssText = 'display:flex;align-items:center;gap:1rem';

    var homeLink = document.createElement('a');
    homeLink.href = 'index.html';
    homeLink.textContent = '← До курсу';
    homeLink.style.cssText = 'font-size:0.8125rem;color:rgba(96,165,250,0.80);text-decoration:none';

    var logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Вийти';
    logoutBtn.style.cssText = 'font-size:0.75rem;color:rgba(255,255,255,0.35);' +
      'background:none;border:none;cursor:pointer;padding:0';
    logoutBtn.addEventListener('click', function () {
      clearSession();
      window.location.href = 'index.html';
    });

    right.appendChild(homeLink);
    right.appendChild(logoutBtn);
    bar.appendChild(left);
    bar.appendChild(right);
    document.body.insertBefore(bar, document.body.firstChild);

    /* Push presentation down so bar doesn't overlap slides */
    var presentation = document.querySelector('.presentation');
    if (presentation) {
      presentation.style.marginTop  = '41px';
      presentation.style.height     = 'calc(100vh - 41px)';
    }
    /* Move progress track below the session bar */
    var progressTrack = document.querySelector('.progress-track');
    if (progressTrack) {
      progressTrack.style.top = '41px';
    }
  }

  /* ================================================================
     PUBLIC API
  ================================================================ */
  window.DentalTracking = {
    getSession:           getSession,
    clearSession:         clearSession,
    saveProgress:         saveProgress,
    showLoginModal:       buildModal,
    showCompletionToast:  showCompletionToast,
    injectSessionBar:     injectSessionBar,
    CONFIGURED:           CONFIGURED
  };

  /* ================================================================
     AUTO-INIT
  ================================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    if (window.DENTAL_SHOW_LOGIN && !getSession()) {
      buildModal();
    }
    if (window.DENTAL_SHOW_SESSION_BAR) {
      injectSessionBar();
    }
  });

})();
