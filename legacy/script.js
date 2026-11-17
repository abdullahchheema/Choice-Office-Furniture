/* Sweet Homes Furniture — interactions */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
  };

  /* ---------- Page-load choreography ---------- */
  window.addEventListener('load', () => requestAnimationFrame(() => document.documentElement.classList.add('is-ready')));
  setTimeout(() => document.documentElement.classList.add('is-ready'), 1200); // safety net

  /* ---------- Header: scrolled state + mobile menu ---------- */
  const header = $('#header');
  const heroBg = $('#heroBg');
  let ticking = false;
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 24);
    if (heroBg && !reduce && window.scrollY < window.innerHeight * 1.2) {
      // Hero photo drifts slower than the page for a sense of depth
      heroBg.style.transform = `translate3d(0, ${(window.scrollY * 0.28).toFixed(1)}px, 0)`;
    }
    ticking = false;
  };
  onScroll();
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  const menuBtn = $('#menuBtn');
  const nav = $('#nav');
  const setMenu = (open) => {
    nav.classList.toggle('open', open);
    header.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('no-scroll', open);
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  $$('a', nav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- Active nav link on scroll ---------- */
  const navLinks = $$('a', nav);
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- Scroll reveal ---------- */
  const revealEls = $$('[data-reveal]');
  const craftVisual = $('.craft-visual');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        if (e.target.querySelector('[data-count]')) runCounters(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
    if (craftVisual) craftVisual.classList.add('in');
    $$('[data-count]').forEach((el) => { el.textContent = Number(el.dataset.count).toLocaleString('en-US'); });
  }

  /* ---------- Count-up numbers ---------- */
  const counted = new WeakSet();
  function runCounters(scope) {
    const targets = scope.matches && scope.matches('[data-count]') ? [scope] : $$('[data-count]', scope);
    targets.forEach((el) => {
      if (counted.has(el)) return;
      counted.add(el);
      const end = Number(el.dataset.count);
      const dur = 1600;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(end * eased).toLocaleString('en-US');
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  // The 25-year stat sits in a block observed on its own
  const stat = $('.craft-stat');
  if (stat && 'IntersectionObserver' in window && !reduce) {
    const so = new IntersectionObserver(([e]) => { if (e.isIntersecting) { runCounters(stat); so.disconnect(); } }, { threshold: 0.6 });
    so.observe(stat);
  }
  const stats = $('.stats');
  if (stats && 'IntersectionObserver' in window && !reduce) {
    const st = new IntersectionObserver(([e]) => { if (e.isIntersecting) { runCounters(stats); st.disconnect(); } }, { threshold: 0.5 });
    st.observe(stats);
  }

  /* ---------- Hero parallax (pointer devices only) ---------- */
  const arch = $('#heroArch');
  if (arch && !reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const layers = $$('.parallax', arch);
    const hero = $('.hero');
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      layers.forEach((l) => {
        const d = Number(l.dataset.depth || 0);
        l.style.transform = `translate(${(-x * d).toFixed(1)}px, ${(-y * d * 0.6).toFixed(1)}px) scale(1.12)`;
      });
    });
    hero.addEventListener('pointerleave', () => layers.forEach((l) => { l.style.transform = ''; }));
  }

  /* ---------- Product filter ---------- */
  const chips = $$('.chip');
  const cards = $$('#productGrid .card');
  let filterTimer;
  function applyFilter(value) {
    chips.forEach((c) => {
      const on = c.dataset.filter === value;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-pressed', String(on));
    });
    cards.forEach((c) => c.classList.add('is-out'));
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
      let i = 0;
      cards.forEach((c) => {
        const show = value === 'all' || c.dataset.cat.split(' ').includes(value);
        c.hidden = !show;
        c.classList.remove('is-out');
        if (show) {
          c.classList.add('in');
          if (!reduce) { c.animate([{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: i * 70, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }); }
          i++;
        }
      });
    }, reduce ? 0 : 280);
  }
  chips.forEach((c) => c.addEventListener('click', () => applyFilter(c.dataset.filter)));
  $$('[data-filter-link]').forEach((a) => a.addEventListener('click', () => {
    const f = a.dataset.filterLink;
    if (f) applyFilter(f);
  }));

  /* ---------- Wishlist ---------- */
  const wished = new Set(store.get('sh-wish', []));
  $$('.card').forEach((card) => {
    const btn = $('.wish', card);
    if (!btn) return;
    const id = card.dataset.id;
    if (wished.has(id)) btn.setAttribute('aria-pressed', 'true');
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      on ? wished.add(id) : wished.delete(id);
      store.set('sh-wish', [...wished]);
      toast(on ? `Saved ${card.dataset.name} to your wishlist` : `Removed ${card.dataset.name} from wishlist`);
    });
  });

  /* ---------- Toast ---------- */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  /* ---------- Cart ---------- */
  const catalog = {};
  $$('.card').forEach((c) => {
    const img = $('.card-media img', c);
    catalog[c.dataset.id] = {
      id: c.dataset.id,
      name: c.dataset.name,
      price: Number(c.dataset.price),
      img: img ? img.getAttribute('src') : '',
      pos: img ? img.style.objectPosition : ''
    };
  });
  let cart = store.get('sh-cart', []).filter((i) => catalog[i.id]);

  const cartBtn = $('#cartOpen');
  const cartCount = $('#cartCount');
  const drawer = $('#cart');
  const overlay = $('#overlay');
  const cartList = $('#cartList');
  const cartEmpty = $('#cartEmpty');
  const cartFoot = $('#cartFoot');
  const cartTotal = $('#cartTotal');
  let lastFocus = null;

  function renderCart() {
    const qty = cart.reduce((n, i) => n + i.qty, 0);
    const total = cart.reduce((n, i) => n + i.qty * catalog[i.id].price, 0);
    cartCount.textContent = qty;
    cartCount.classList.toggle('has-items', qty > 0);
    cartBtn.setAttribute('aria-label', `Open cart, ${qty} ${qty === 1 ? 'item' : 'items'}`);
    cartEmpty.hidden = cart.length > 0;
    cartFoot.hidden = cart.length === 0;
    cartTotal.textContent = money.format(total);
    cartList.innerHTML = '';
    cart.forEach((item) => {
      const p = catalog[item.id];
      const li = document.createElement('li');
      li.className = 'cart-item';
      li.innerHTML = `
        <div class="cart-thumb"><img src="${p.img}" alt="" width="84" height="84" style="object-position:${p.pos || '50% 50%'}"></div>
        <div>
          <h3></h3>
          <p class="unit">${money.format(p.price)}</p>
          <div class="qty" role="group">
            <button type="button" data-act="dec">−</button><span aria-live="polite">${item.qty}</span><button type="button" data-act="inc">+</button>
          </div>
        </div>
        <div class="cart-line"><span>${money.format(p.price * item.qty)}</span><button type="button" class="remove" data-act="rm">Remove</button></div>`;
      $('h3', li).textContent = p.name;
      $('[data-act="dec"]', li).setAttribute('aria-label', `Decrease quantity of ${p.name}`);
      $('[data-act="inc"]', li).setAttribute('aria-label', `Increase quantity of ${p.name}`);
      $('[data-act="rm"]', li).setAttribute('aria-label', `Remove ${p.name}`);
      li.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (!act) return;
        if (act === 'inc') item.qty++;
        if (act === 'dec') item.qty = Math.max(1, item.qty - 1);
        if (act === 'rm') cart = cart.filter((i) => i !== item);
        persist();
        renderCart();
      });
      cartList.appendChild(li);
    });
  }
  const persist = () => store.set('sh-cart', cart);

  function addToCart(id, btn) {
    const found = cart.find((i) => i.id === id);
    found ? found.qty++ : cart.push({ id, qty: 1 });
    persist();
    renderCart();
    cartCount.classList.remove('bump');
    void cartCount.offsetWidth;
    cartCount.classList.add('bump');
    toast(`${catalog[id].name} added to your cart`);
    if (btn) {
      const label = btn.textContent;
      btn.textContent = 'Added ✓';
      btn.classList.add('added');
      setTimeout(() => { btn.textContent = label; btn.classList.remove('added'); }, 1400);
    }
  }
  $$('[data-add]').forEach((b) => b.addEventListener('click', () => addToCart(b.closest('.card').dataset.id, b)));

  function openCart() {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('show'));
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    setTimeout(() => $('#cartClose').focus(), 60);
  }
  function closeCart() {
    overlay.classList.remove('show');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    setTimeout(() => { overlay.hidden = true; }, 420);
    if (lastFocus) lastFocus.focus();
  }
  cartBtn.addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);
  $$('[data-close-cart]').forEach((a) => a.addEventListener('click', closeCart));
  $('#checkoutBtn').addEventListener('click', () => { closeCart(); toast('Checkout is coming soon — thank you for browsing!'); });

  // Keyboard: Esc closes, Tab stays inside the drawer while open
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (drawer.classList.contains('open')) closeCart();
      else if (nav.classList.contains('open')) { setMenu(false); menuBtn.focus(); }
    }
    if (e.key === 'Tab' && drawer.classList.contains('open')) {
      const f = $$('button, a[href]', drawer).filter((el) => !el.closest('[hidden]'));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  renderCart();

  /* ---------- Finish picker ---------- */
  const finishes = {
    oak:    { name: 'Natural Oak',   wood: '#C8A06E', dk: '#8E6A3F', lt: '#E0C497', desc: 'Light, open grain with honey undertones. Brightens a room and pairs with everything.' },
    walnut: { name: 'Smoked Walnut', wood: '#7A5233', dk: '#4A2F1B', lt: '#9A7350', desc: 'Deep chocolate tones with rich, flowing grain. Quietly dramatic and endlessly warm.' },
    ash:    { name: 'Pale Ash',      wood: '#DCC9A8', dk: '#B09A74', lt: '#EBDDC3', desc: 'Soft, airy and Scandinavian. A calm canvas for light-filled, minimal spaces.' },
    cherry: { name: 'Cherry',        wood: '#A4562F', dk: '#6B3118', lt: '#C27A52', desc: 'A warm reddish glow that deepens beautifully with age and sunlight.' },
    ebony:  { name: 'Ebonised',      wood: '#3E3028', dk: '#241A14', lt: '#5A4A40', desc: 'Dark, refined and graphic. The grain still shows through the hand-rubbed oil.' }
  };
  const finishArt = $('#finishArt');
  const finishName = $('#finishName');
  const finishDesc = $('#finishDesc');
  const finishInfo = $('.finish-info');
  const setFinish = (key) => {
    const f = finishes[key];
    if (!f) return;
    finishArt.style.setProperty('--wood', f.wood);
    finishArt.style.setProperty('--wood-dk', f.dk);
    finishArt.style.setProperty('--wood-lt', f.lt);
    finishName.textContent = f.name;
    finishDesc.textContent = f.desc;
    finishInfo.classList.remove('swap');
    void finishInfo.offsetWidth;
    finishInfo.classList.add('swap');
  };
  $$('input[name="finish"]').forEach((r) => r.addEventListener('change', () => setFinish(r.value)));
  setFinish('oak');

  /* ---------- Newsletter ---------- */
  const form = $('#signup');
  const email = $('#email');
  const msg = $('#emailMsg');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = email.value.trim();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val);
    msg.classList.toggle('error', !ok);
    email.setAttribute('aria-invalid', String(!ok));
    if (!ok) {
      msg.textContent = 'Please enter a valid email address, like name@example.com.';
      email.focus();
      return;
    }
    msg.textContent = 'Thank you — welcome to Sweet Homes! Check your inbox for 10% off.';
    form.reset();
  });
  email.addEventListener('input', () => {
    if (email.getAttribute('aria-invalid') === 'true') { email.setAttribute('aria-invalid', 'false'); msg.textContent = ''; msg.classList.remove('error'); }
  });

  /* ---------- Footer year ---------- */
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
})();
