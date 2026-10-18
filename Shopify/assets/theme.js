/* Doshmukti theme — vanilla JS, no dependencies. */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var T = window.theme || { routes: {}, strings: {} };

  /* ───────── Toast ───────── */
  var toastTimer;
  function toast(message, isError) {
    var el = $('#Toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.classList.toggle('is-error', !!isError);
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-visible');
      setTimeout(function () { el.hidden = true; }, 300);
    }, 2600);
  }
  window.theme.toast = toast;

  /* ───────── Money ───────── */
  function money(cents) {
    var value = cents / 100;
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: T.currency || 'INR',
        minimumFractionDigits: value % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
      }).format(value);
    } catch (e) {
      return '₹' + value.toFixed(2);
    }
  }

  /* ───────── Header ───────── */
  function initHeader() {
    var header = $('#SiteHeader');
    if (header) {
      var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 20); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    function bindToggle(btnSel, panelSel, other) {
      var btn = $(btnSel);
      var panel = $(panelSel);
      if (!btn || !panel) return;
      btn.addEventListener('click', function () {
        var open = panel.hidden;
        panel.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
        var o = $('[data-icon-open]', btn);
        var c = $('[data-icon-close]', btn);
        if (o) o.hidden = open;
        if (c) c.hidden = !open;
        if (open && other) other();
        if (open && panelSel === '#SearchBar') {
          var input = $('input[type="search"]', panel);
          if (input) input.focus();
        }
      });
    }

    function closePanel(btnSel, panelSel) {
      var btn = $(btnSel);
      var panel = $(panelSel);
      if (!btn || !panel || panel.hidden) return;
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      var o = $('[data-icon-open]', btn);
      var c = $('[data-icon-close]', btn);
      if (o) o.hidden = false;
      if (c) c.hidden = true;
    }

    bindToggle('[data-search-toggle]', '#SearchBar', function () { closePanel('[data-menu-toggle]', '#MobileMenu'); });
    bindToggle('[data-menu-toggle]', '#MobileMenu', function () { closePanel('[data-search-toggle]', '#SearchBar'); });
  }

  /* ───────── Carousel (hero) ───────── */
  function initCarousels() {
    $$('[data-carousel]').forEach(function (root) {
      if (root.__carousel) return;
      root.__carousel = true;
      var slides = $$('[data-slide]', root);
      var dots = $$('[data-dot]', root);
      if (slides.length < 2) return;
      var active = 0;
      var timer = null;
      var interval = parseInt(root.dataset.interval, 10) || 5000;
      var autoplay = root.dataset.autoplay === 'true';

      function go(i) {
        active = (i + slides.length) % slides.length;
        slides.forEach(function (s, idx) {
          var on = idx === active;
          s.classList.toggle('is-active', on);
          s.setAttribute('aria-hidden', String(!on));
          $$('a', s).forEach(function (a) { a.tabIndex = on ? 0 : -1; });
        });
        dots.forEach(function (d, idx) { d.classList.toggle('is-active', idx === active); });
      }
      function start() {
        stop();
        if (autoplay && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          timer = setInterval(function () { go(active + 1); }, interval);
        }
      }
      function stop() { if (timer) { clearInterval(timer); timer = null; } }

      var prev = $('[data-prev]', root);
      var next = $('[data-next]', root);
      if (prev) prev.addEventListener('click', function () { go(active - 1); start(); });
      if (next) next.addEventListener('click', function () { go(active + 1); start(); });
      dots.forEach(function (d) {
        d.addEventListener('click', function () { go(parseInt(d.dataset.dot, 10)); start(); });
      });
      root.addEventListener('mouseenter', stop);
      root.addEventListener('mouseleave', start);

      var touchX = null;
      root.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
      root.addEventListener('touchend', function (e) {
        if (touchX === null) return;
        var dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 40) { go(active + (dx < 0 ? 1 : -1)); start(); }
        touchX = null;
      }, { passive: true });

      root.addEventListener('shopify:block:select', function (e) {
        var idx = slides.indexOf(e.target);
        if (idx > -1) { go(idx); stop(); }
      });
      root.addEventListener('shopify:block:deselect', start);
      start();
    });
  }

  /* ───────── Reveal on scroll ───────── */
  function initReveal() {
    var targets = $$('[data-reveal], [data-reveal-group]');
    if (!targets.length) return;
    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (t) { t.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    targets.forEach(function (t) { if (!t.classList.contains('is-visible')) io.observe(t); });
  }

  /* ───────── Cart helpers ───────── */
  function setCartCount(count) {
    $$('[data-cart-count]').forEach(function (el) {
      el.textContent = count > 9 ? '9+' : String(count);
      el.hidden = count === 0;
    });
  }
  function refreshCartCount() {
    return fetch(T.routes.cart_js_url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (cart) { setCartCount(cart.item_count); return cart; });
  }
  function addToCart(formData) {
    return fetch(T.routes.cart_add_url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok || data.status) throw new Error(data.description || data.message || T.strings.error);
        return data;
      });
    });
  }

  function initQuickAdd() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-quick-add]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled) return;
      btn.disabled = true;
      var fd = new FormData();
      fd.append('id', btn.dataset.variantId);
      fd.append('quantity', '1');
      addToCart(fd)
        .then(function () { toast(T.strings.added); return refreshCartCount(); })
        .catch(function (err) { toast(err.message || T.strings.error, true); })
        .then(function () { btn.disabled = false; });
    });
  }

  /* ───────── Product page ───────── */
  function initProduct() {
    $$('[data-product-section]').forEach(function (root) {
      if (root.__pdp) return;
      root.__pdp = true;
      var form = $('[data-product-form]', root);
      if (!form) return;

      var variantsEl = $('[data-variants]', form);
      var variants = variantsEl ? JSON.parse(variantsEl.textContent) : [];
      var idInput = $('[data-variant-id]', form);
      var addBtn = $('[data-add-btn]', form);
      var addLabel = $('[data-add-label]', form);
      var nowBtn = $('[data-buy-now]', form);
      var priceEl = $('[data-price]', root);
      var compareEl = $('[data-compare]', root);
      var offEl = $('[data-off]', root);
      var discountEl = $('[data-discount-badge]', root);
      var qtyInput = $('input[name="quantity"]', form);
      var ship = $('[data-ship]', form);
      var bar = $('[data-buybar]');
      var barPrice = bar ? $('[data-bar-price]', bar) : null;
      var origLabel = addLabel ? addLabel.textContent : 'Add to cart';

      /* Gallery */
      var slides = $$('[data-slide]', root);
      var thumbs = $$('[data-thumb]', root);
      function showMedia(id) {
        slides.forEach(function (s) { s.classList.toggle('is-active', String(s.dataset.mediaId) === String(id)); });
        thumbs.forEach(function (t) { t.classList.toggle('is-active', String(t.dataset.thumb) === String(id)); });
        var activeThumb = thumbs.filter(function (t) { return t.classList.contains('is-active'); })[0];
        if (activeThumb && activeThumb.scrollIntoView) activeThumb.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      function step(dir) {
        var idx = 0;
        slides.forEach(function (s, i) { if (s.classList.contains('is-active')) idx = i; });
        var next = slides[(idx + dir + slides.length) % slides.length];
        if (next) showMedia(next.dataset.mediaId);
      }
      thumbs.forEach(function (t) { t.addEventListener('click', function () { showMedia(t.dataset.thumb); }); });
      var gPrev = $('[data-gallery-prev]', root);
      var gNext = $('[data-gallery-next]', root);
      if (gPrev) gPrev.addEventListener('click', function () { step(-1); });
      if (gNext) gNext.addEventListener('click', function () { step(1); });
      var gx = null;
      var gMain = $('.gallery__main', root);
      if (gMain) {
        gMain.addEventListener('touchstart', function (e) { gx = e.touches[0].clientX; }, { passive: true });
        gMain.addEventListener('touchend', function (e) {
          if (gx === null) return;
          var dx = e.changedTouches[0].clientX - gx;
          if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
          gx = null;
        }, { passive: true });
      }

      /* Shipping line (flat fee, free above threshold) */
      function updateShip() {
        if (!ship) return;
        var price = parseInt(ship.dataset.price, 10) || 0;
        var qty = parseInt(qtyInput && qtyInput.value, 10) || 1;
        var threshold = parseInt(ship.dataset.threshold, 10) || 0;
        var fee = parseInt(ship.dataset.fee, 10) || 0;
        ship.textContent = '';
        ship.appendChild(document.createTextNode('Shipping: '));
        var strong = document.createElement('strong');
        if (!threshold || price * qty >= threshold) {
          strong.textContent = 'FREE';
          ship.appendChild(strong);
        } else {
          strong.textContent = money(fee);
          strong.style.color = 'inherit';
          ship.appendChild(strong);
          ship.appendChild(document.createTextNode(' · free above ' + money(threshold)));
        }
      }

      /* Quantity stepper */
      var minus = $('[data-qty-minus]', form);
      var plus = $('[data-qty-plus]', form);
      if (minus && plus && qtyInput) {
        minus.addEventListener('click', function () { qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1); updateShip(); });
        plus.addEventListener('click', function () { qtyInput.value = Math.min(10, (parseInt(qtyInput.value, 10) || 1) + 1); updateShip(); });
        qtyInput.addEventListener('change', updateShip);
      }
      updateShip();

      /* Variant selection */
      function selectedOptions() {
        return $$('.opt', form).map(function (fs) {
          var checked = $('input:checked', fs);
          return checked ? checked.value : null;
        });
      }
      function findVariant(opts) {
        return variants.filter(function (v) { return v.options.every(function (o, i) { return o === opts[i]; }); })[0];
      }
      function render(variant) {
        if (!variant) {
          if (addBtn) addBtn.disabled = true;
          if (nowBtn) nowBtn.disabled = true;
          if (addLabel) addLabel.textContent = 'Unavailable';
          return;
        }
        if (idInput) idInput.value = variant.id;
        if (priceEl) priceEl.textContent = money(variant.price);
        if (barPrice) barPrice.textContent = money(variant.price);
        if (ship) { ship.dataset.price = variant.price; updateShip(); }
        var hasCompare = variant.compare_at_price && variant.compare_at_price > variant.price;
        var pct = hasCompare ? Math.round((variant.compare_at_price - variant.price) * 100 / variant.compare_at_price) : 0;
        if (compareEl) { compareEl.hidden = !hasCompare; if (hasCompare) compareEl.textContent = money(variant.compare_at_price); }
        if (offEl) { offEl.hidden = !hasCompare; offEl.textContent = pct + '% off'; }
        if (discountEl) { discountEl.hidden = !hasCompare; discountEl.firstChild.textContent = pct + '%'; }
        if (addBtn) addBtn.disabled = !variant.available;
        if (nowBtn) nowBtn.disabled = !variant.available;
        if (addLabel) addLabel.textContent = variant.available ? origLabel : 'Sold out';
        if (variant.featured_media && variant.featured_media.id) showMedia(variant.featured_media.id);
        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      }
      form.addEventListener('change', function (e) {
        if (!e.target.closest('.opt')) return;
        render(findVariant(selectedOptions()));
      });

      /* Add to cart (AJAX) / Order now (add, then straight to checkout) */
      form.addEventListener('submit', function (e) {
        var submitter = e.submitter;
        if (submitter && submitter.classList.contains('shopify-payment-button__button')) return;
        if (!addBtn) return;
        e.preventDefault();
        var buyNow = !!(submitter && submitter.hasAttribute('data-buy-now'));
        var btn = buyNow ? nowBtn : addBtn;
        if (btn.disabled) return;
        btn.disabled = true;
        addToCart(new FormData(form))
          .then(function () {
            if (buyNow) { window.location.href = '/checkout'; return; }
            toast(T.strings.added);
            return refreshCartCount();
          })
          .catch(function (err) { toast(err.message || T.strings.error, true); })
          .then(function () {
            if (!buyNow) btn.disabled = false;
            else setTimeout(function () { btn.disabled = false; }, 4000);
          });
      });

      /* Sticky mobile buy bar — shown once the main buttons scroll out of view */
      if (bar && nowBtn && 'IntersectionObserver' in window) {
        bar.hidden = false;
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            bar.classList.toggle('is-visible', !en.isIntersecting && en.boundingClientRect.top < 0);
          });
        }, { threshold: 0 });
        io.observe(nowBtn);
        var barBtn = $('[data-buybar-order]', bar);
        if (barBtn) barBtn.addEventListener('click', function () { nowBtn.click(); });
      }

      /* Description: group consecutive images into a swipeable carousel */
      var desc = $('[data-desc]', root);
      if (desc) {
        var group = [];
        var flush = function () {
          if (group.length > 1) {
            var wrap = document.createElement('div');
            wrap.className = 'desc-carousel hide-scrollbar';
            group[0].parentNode.insertBefore(wrap, group[0]);
            group.forEach(function (p) {
              var img = p.querySelector('img');
              if (img) wrap.appendChild(img);
              p.parentNode.removeChild(p);
            });
          }
          group = [];
        };
        Array.prototype.slice.call(desc.children).forEach(function (el) {
          var onlyImg = el.tagName === 'P' && el.children.length === 1 && el.firstElementChild.tagName === 'IMG' && !el.textContent.trim();
          if (onlyImg) group.push(el); else flush();
        });
        flush();
      }
    });
  }

  /* ───────── Recommendations ───────── */
  function initRecommendations() {
    $$('[data-recommendations]').forEach(function (el) {
      var url = el.dataset.url;
      if (!url) return;
      fetch(url)
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var fresh = $('[data-recommendations]', doc);
          if (fresh && fresh.innerHTML.trim().length) el.innerHTML = fresh.innerHTML;
        })
        .catch(function () {});
    });
  }

  /* ───────── Collection filters ───────── */
  function initFacets() {
    var form = $('[data-facet-form]');
    if (!form) return;
    var toggle = $('[data-filter-toggle]', form);
    var panel = $('#FacetPanel', form);
    if (toggle && panel) {
      toggle.addEventListener('click', function () {
        var open = panel.hidden;
        panel.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
      });
    }
    var t;
    $$('[data-auto-submit]', form).forEach(function (input) {
      input.addEventListener('change', function () {
        clearTimeout(t);
        t = setTimeout(function () { form.submit(); }, input.type === 'number' ? 600 : 0);
      });
    });
  }

  /* ───────── Cart page ───────── */
  function initCartPage() {
    var wrap = $('#MainCartWrapper');
    if (!wrap) return;
    var sectionId = wrap.dataset.sectionId;

    function rerender() {
      return fetch(window.location.pathname + '?section_id=' + encodeURIComponent(sectionId))
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var fresh = $('#MainCartWrapper', doc);
          if (fresh) wrap.innerHTML = fresh.innerHTML;
          return refreshCartCount();
        });
    }
    function change(line, quantity) {
      var page = $('.cart-page', wrap);
      if (page) page.classList.add('is-loading');
      return fetch(T.routes.cart_change_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ line: parseInt(line, 10), quantity: Math.max(0, quantity) })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) { if (data.status) throw new Error(data.description || data.message); return rerender(); })
        .catch(function (err) { toast(err.message || T.strings.error, true); return rerender(); });
    }

    wrap.addEventListener('click', function (e) {
      var q = e.target.closest('[data-cart-qty]');
      if (q) { e.preventDefault(); change(q.dataset.line, parseInt(q.dataset.cartQty, 10)); return; }
      var rm = e.target.closest('[data-cart-remove]');
      if (rm) { e.preventDefault(); change(rm.dataset.cartRemove, 0); }
    });
    wrap.addEventListener('change', function (e) {
      var input = e.target.closest('[data-cart-qty-input]');
      if (input) change(input.dataset.line, parseInt(input.value, 10) || 0);
    });
  }

  /* ───────── Boot ───────── */
  function init() {
    initHeader();
    initCarousels();
    initReveal();
    initQuickAdd();
    initProduct();
    initRecommendations();
    initFacets();
    initCartPage();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Theme editor: re-init sections that were just (re)rendered */
  document.addEventListener('shopify:section:load', function () {
    initCarousels();
    initReveal();
    initProduct();
    initRecommendations();
    initFacets();
  });
})();
