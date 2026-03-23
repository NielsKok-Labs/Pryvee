/* PRYVEE v3 — Shared JS */

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

function initReveal() {
  const obs = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) e.target.classList.add('on'); });
  }, { threshold: 0.07 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

let lang = localStorage.getItem('pv-lang') || 'nl';

const SHARED = {
  nl: { 'fc-tagline':'Microsoft 365 governance voor IT-teams en MSP\'s.', 'fc-copy':'© 2025 Pryvee · Alle rechten voorbehouden', 'fc-built':'Gebouwd op', 'fc-product':'Product', 'fc-pricing':'Prijzen', 'fc-company':'Bedrijf', 'fc-standards':'Standaarden', 'nav-cta':'Early access', 'dr-cta':'Early access' },
  en: { 'fc-tagline':'Microsoft 365 governance for IT teams and MSPs.', 'fc-copy':'© 2025 Pryvee · All rights reserved', 'fc-built':'Built on', 'fc-product':'Product', 'fc-pricing':'Pricing', 'fc-company':'Company', 'fc-standards':'Standards', 'nav-cta':'Early access', 'dr-cta':'Early access' }
};

function applyLang(l) {
  lang = l;
  localStorage.setItem('pv-lang', l);
  document.documentElement.lang = l;
  document.getElementById('btnNL')?.classList.toggle('on', l === 'nl');
  document.getElementById('btnEN')?.classList.toggle('on', l === 'en');
  document.getElementById('btnNL')?.setAttribute('aria-pressed', l === 'nl');
  document.getElementById('btnEN')?.setAttribute('aria-pressed', l === 'en');
  const t = SHARED[l] || {};
  Object.keys(t).forEach(id => { const el = document.getElementById(id); if (el) el.textContent = t[id]; });
  if (typeof pageTrans === 'function') pageTrans(l);
}

function setLang(l) { applyLang(l); }

function initWL() {
  document.querySelectorAll('form.wl-form').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      const msg = form.nextElementSibling;
      if (btn) { btn.textContent = lang === 'nl' ? 'Aangemeld ✓' : 'Joined ✓'; btn.disabled = true; btn.style.background = '#4ADE80'; btn.style.color = '#1A0A40'; }
      if (msg && msg.classList.contains('wl-msg')) { msg.textContent = lang === 'nl' ? 'Bedankt! U hoort van ons.' : 'Thanks! We\'ll be in touch.'; msg.style.opacity = '1'; }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => { initNav(); initReveal(); applyLang(lang); initWL(); });
