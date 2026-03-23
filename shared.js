/* PRYVEE — Shared JS v2 */

// ── NAV ──────────────────────────────
function initNav() {
  const ham = document.getElementById('ham');
  const drawer = document.getElementById('drawer');
  if (!ham || !drawer) return;
  ham.addEventListener('click', () => {
    const o = drawer.classList.toggle('open');
    ham.setAttribute('aria-expanded', o);
    ham.innerHTML = o ? '&#10005;' : '&#9776;';
  });
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    drawer.classList.remove('open');
    ham.innerHTML = '&#9776;';
  }));
}

// ── REVEAL ───────────────────────────
function initReveal() {
  const obs = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) e.target.classList.add('on'); });
  }, { threshold: 0.07 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// ── LANG ─────────────────────────────
const SHARED_NL = {
  'nav-how':'Hoe het werkt','nav-mod':'Modules','nav-price':'Prijzen',
  'nav-cta':'Early access','dr-how':'Hoe het werkt','dr-mod':'Modules',
  'dr-price':'Prijzen','dr-cta':'Early access',
  'fc-product':'Product','fc-pricing':'Prijzen','fc-privacy':'Privacy','fc-contact':'Contact',
  'fc-snap':'Snapshot','fc-redact':'Redact','fc-guard':'Guard','fc-clean':'Clean','fc-ai':'AI',
  'fc-about':'Over Pryvee',
  'fc-copy':'© 2025 Pryvee · Alle rechten voorbehouden',
  'fc-tagline':'Microsoft 365 governance voor IT-teams en MSP\'s.',
  'fc-built':'Gebouwd op',
};
const SHARED_EN = {
  'nav-how':'How it works','nav-mod':'Modules','nav-price':'Pricing',
  'nav-cta':'Early access','dr-how':'How it works','dr-mod':'Modules',
  'dr-price':'Pricing','dr-cta':'Early access',
  'fc-product':'Product','fc-pricing':'Pricing','fc-privacy':'Privacy','fc-contact':'Contact',
  'fc-snap':'Snapshot','fc-redact':'Redact','fc-guard':'Guard','fc-clean':'Clean','fc-ai':'AI',
  'fc-about':'About Pryvee',
  'fc-copy':'© 2025 Pryvee · All rights reserved',
  'fc-tagline':'Microsoft 365 governance for IT teams and MSPs.',
  'fc-built':'Built on',
};

let lang = localStorage.getItem('pv-lang') || 'nl';

function applyLang(l) {
  lang = l;
  localStorage.setItem('pv-lang', l);
  document.documentElement.lang = l;
  document.getElementById('btnNL')?.classList.toggle('on', l === 'nl');
  document.getElementById('btnEN')?.classList.toggle('on', l === 'en');
  document.getElementById('btnNL')?.setAttribute('aria-pressed', l === 'nl');
  document.getElementById('btnEN')?.setAttribute('aria-pressed', l === 'en');
  const t = { ...( l === 'nl' ? SHARED_NL : SHARED_EN ) };
  Object.keys(t).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = t[id];
  });
  if (typeof pageTrans === 'function') pageTrans(l);
}

function setLang(l) { applyLang(l); }

// ── WAITLIST ──────────────────────────
function initWL() {
  document.querySelectorAll('.wl-form').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      const msg = form.nextElementSibling;
      btn.textContent = lang === 'nl' ? 'Aangemeld ✓' : 'Joined ✓';
      btn.disabled = true; btn.style.background = '#34D399';
      if (msg && msg.classList.contains('wl-msg')) {
        msg.textContent = lang === 'nl'
          ? 'Bedankt! U ontvangt bericht zodra het product beschikbaar is.'
          : 'Thanks! You\'ll hear from us as soon as the product is available.';
        msg.style.opacity = '1';
      }
    });
  });
}

// ── INIT ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav(); initReveal(); applyLang(lang); initWL();
});
