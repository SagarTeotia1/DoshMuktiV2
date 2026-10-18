/* Acharya Madhav chat widget — talks to the Doshmukti Backend (POST {api}/api/chat/acharya).
   Request:  { messages: [{ role: 'user' | 'assistant', content }] }  + header x-session-id
   Response: { reply, recommendedProducts: [{ id, slug, name, thumb }], recommendationReason } */
(function () {
  'use strict';

  var root = document.getElementById('AcharyaChat');
  if (!root) return;

  var API = (root.dataset.api || '').replace(/\/+$/, '');
  if (!API) return;
  root.hidden = false;

  var MAX_HISTORY = 20;
  var SESSION_KEY = 'acharya-session-id';
  var MIC_HINT_KEY = 'acharya-mic-hint-seen';

  var GREETING =
    'Namaste, kaise hain aap? 🙏 Main hoon Acharya Madhav.\n\n' +
    'Career, paisa, prem, ya parivaar me koi samasya chal rahi ho, ya apni Kundli vishleshan janna ho — ' +
    'aap apni Date of Birth (janma tithi) ya sawal batayein, main aapke grahon ki sthiti dekhkar sahi margdarshan karunga.';

  var panel = document.getElementById('AcharyaPanel');
  var list = document.getElementById('AcharyaMessages');
  var form = document.getElementById('AcharyaForm');
  var input = document.getElementById('AcharyaInput');
  var sendBtn = document.getElementById('AcharyaSend');
  var micBtn = document.getElementById('AcharyaMic');
  var fab = document.getElementById('AcharyaFab');
  var pop = document.getElementById('AcharyaPop');
  var popClose = document.getElementById('AcharyaPopClose');
  var disclaimer = document.getElementById('AcharyaDisclaimer');

  var messages = [{ role: 'assistant', content: GREETING }];
  var sending = false;
  var userMessageCount = 0;
  var disclaimerTimer = null;

  /* ───────── storage helpers (may throw in private mode) ───────── */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  function sessionId() {
    var id = lsGet(SESSION_KEY);
    if (!id) {
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      lsSet(SESSION_KEY, id);
    }
    return id;
  }

  /* ───────── DOM builders (textContent only — no innerHTML on model output) ───────── */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function scrollDown() {
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }

  function productLink(p) {
    var a = el('a', 'msg__product');
    a.href = '/products/' + encodeURIComponent(p.slug);
    var img = el('span', 'msg__product-img');
    if (p.thumb) {
      var i = document.createElement('img');
      i.src = p.thumb;
      i.alt = '';
      i.loading = 'lazy';
      img.appendChild(i);
    }
    a.appendChild(img);
    a.appendChild(el('span', 'msg__product-name', p.name));
    a.appendChild(el('span', 'msg__product-cta', 'View →'));
    return a;
  }

  function addBubble(m) {
    var wrap = el('div', 'msg ' + (m.role === 'user' ? 'msg--user' : 'msg--bot'));
    wrap.appendChild(el('div', 'msg__bubble', m.content));
    if (m.recommendedProducts && m.recommendedProducts.length) {
      var box = el('div', 'msg__products');
      if (m.recommendationReason) box.appendChild(el('p', 'msg__reason', m.recommendationReason));
      m.recommendedProducts.forEach(function (p) { box.appendChild(productLink(p)); });
      wrap.appendChild(box);
    }
    list.appendChild(wrap);
    scrollDown();
  }

  var typingEl = null;
  function showTyping() {
    typingEl = el('div', 'typing');
    typingEl.appendChild(el('span'));
    typingEl.appendChild(el('span'));
    typingEl.appendChild(el('span'));
    list.appendChild(typingEl);
    scrollDown();
  }
  function hideTyping() {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }

  /* ───────── quick-prompt chips (shown only after the greeting) ───────── */
  var chipsEl = null;
  function renderChips() {
    chipsEl = el('div', 'acharya__chips');

    var dob = el('button', 'acharya__chip acharya__chip--accent', 'Meri Kundli dekhein (DOB)');
    dob.type = 'button';
    dob.addEventListener('click', function () {
      input.value = 'Meri Date of Birth hai: ';
      updateSendState();
      input.focus();
    });
    chipsEl.appendChild(dob);

    [
      ['💼 Career & Dhan Labh', 'Career aur dhan labh ke baare me margdarshan chahiye'],
      ['❤️ Prem & Rishte', 'Prem aur rishton me shanti ke liye upay batayein'],
      ['🧿 Nazar Dosh Nivaran', 'Nazar dosh ya graha shanti ke liye kya karna chahiye?']
    ].forEach(function (c) {
      var b = el('button', 'acharya__chip', c[0]);
      b.type = 'button';
      b.addEventListener('click', function () { send(c[1]); });
      chipsEl.appendChild(b);
    });
    list.appendChild(chipsEl);
  }
  function removeChips() {
    if (chipsEl && chipsEl.parentNode) chipsEl.parentNode.removeChild(chipsEl);
    chipsEl = null;
  }

  /* ───────── send ───────── */
  function updateSendState() {
    sendBtn.disabled = sending || !input.value.trim();
  }

  function send(text) {
    text = (text || '').trim();
    if (!text || sending) return;

    removeChips();
    var userMsg = { role: 'user', content: text };
    messages.push(userMsg);
    addBubble(userMsg);
    userMessageCount += 1;
    if (userMessageCount === 1) track('Lead');

    sending = true;
    input.value = '';
    updateSendState();
    showTyping();

    var history = messages.slice(-MAX_HISTORY).map(function (m) { return { role: m.role, content: m.content }; });

    fetch(API + '/api/chat/acharya', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId() },
      body: JSON.stringify({ messages: history })
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) {
            var err = new Error(body.error || 'request failed');
            err.code = body.code;
            throw err;
          }
          return body;
        });
      })
      .then(function (body) {
        var botMsg = {
          role: 'assistant',
          content: body.reply,
          recommendedProducts: body.recommendedProducts,
          recommendationReason: body.recommendationReason
        };
        messages.push({ role: 'assistant', content: body.reply });
        hideTyping();
        addBubble(botMsg);
      })
      .catch(function (err) {
        hideTyping();
        var content = err && err.code === 'CHAT_DAILY_LIMIT'
          ? err.message
          : "I couldn't reach the stars just now — please try again in a moment.";
        addBubble({ role: 'assistant', content: content });
      })
      .then(function () {
        sending = false;
        updateSendState();
      });
  }

  /* Meta Pixel / GA4 lead event, only if the store has them installed */
  function track(name) {
    try {
      if (typeof window.fbq === 'function') window.fbq('track', name);
      if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead');
    } catch (e) { /* analytics must never break chat */ }
  }

  /* ───────── open / close ───────── */
  function open() {
    panel.hidden = false;
    pop.hidden = true;
    fab.hidden = true;
    document.body.classList.add('acharya-open');

    disclaimer.classList.remove('is-faded');
    clearTimeout(disclaimerTimer);
    disclaimerTimer = setTimeout(function () { disclaimer.classList.add('is-faded'); }, 5000);

    if (!list.childNodes.length) {
      addBubble(messages[0]);
      renderChips();
    }
    setTimeout(function () { input.focus({ preventScroll: true }); }, 50);
  }
  function close() {
    panel.hidden = true;
    fab.hidden = false;
    document.body.classList.remove('acharya-open');
  }

  Array.prototype.forEach.call(root.querySelectorAll('[data-acharya-open]'), function (b) {
    b.addEventListener('click', open);
  });
  Array.prototype.forEach.call(root.querySelectorAll('[data-acharya-close]'), function (b) {
    b.addEventListener('click', close);
  });
  popClose.addEventListener('click', function () { pop.hidden = true; });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) close();
  });

  /* Any button on the page can open the chat with a prefilled message:
     <button data-open-chat="message"> — mirrors the storefront's `open-acharya-chat` event. */
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-open-chat]');
    if (!trigger) return;
    e.preventDefault();
    open();
    var msg = trigger.getAttribute('data-open-chat');
    if (msg) send(msg);
  });
  window.addEventListener('open-acharya-chat', function (e) {
    open();
    var msg = e.detail && e.detail.message;
    if (msg) send(msg);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    send(input.value);
  });
  input.addEventListener('input', updateSendState);

  /* Teaser bubble after a short delay (not on the password page, not if already open) */
  setTimeout(function () {
    if (panel.hidden && !lsGet('acharya-pop-dismissed')) pop.hidden = false;
  }, 2500);
  popClose.addEventListener('click', function () { lsSet('acharya-pop-dismissed', '1'); });

  /* ───────── voice input (Web Speech API, Hindi) ───────── */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR && micBtn) {
    micBtn.hidden = false;
    var rec = null;
    var listening = false;

    function stopListening() {
      listening = false;
      micBtn.classList.remove('is-listening');
      input.placeholder = 'Apna DOB dalein ya sawal puchein...';
    }

    micBtn.addEventListener('click', function () {
      lsSet(MIC_HINT_KEY, '1');
      if (listening && rec) { rec.stop(); return; }
      rec = new SR();
      rec.lang = 'hi-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = function (ev) {
        var transcript = ev.results[0][0].transcript;
        input.value = input.value ? input.value + ' ' + transcript : transcript;
        updateSendState();
      };
      rec.onerror = function (ev) {
        stopListening();
        var msg = ev.error === 'not-allowed' || ev.error === 'service-not-allowed'
          ? 'Microphone access is blocked — allow it in your browser settings to use voice input.'
          : "Couldn't hear anything — try again a little closer to the mic.";
        if (window.theme && window.theme.toast) window.theme.toast(msg, true);
      };
      rec.onend = stopListening;
      try {
        rec.start();
        listening = true;
        micBtn.classList.add('is-listening');
        input.placeholder = 'Listening...';
      } catch (err) {
        stopListening();
      }
    });
  }
})();
