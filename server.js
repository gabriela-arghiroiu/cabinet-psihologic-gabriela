'use strict';
const express    = require('express');
const session    = require('express-session');
const bcrypt     = require('bcryptjs');
const multer     = require('multer');
const Database   = require('better-sqlite3');
const path       = require('path');
const fs         = require('fs');

const app      = express();
const PORT     = process.env.PORT || 3000;
const ROOT     = __dirname;
const SITE_URL = 'https://www.gabrielaarghiroiu.ro';

// ─── Directoare ───────────────────────────────────────────────────
const DATA_DIR    = path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
[DATA_DIR, UPLOADS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ─── Bază de date ─────────────────────────────────────────────────
const db = new Database(path.join(DATA_DIR, 'blog.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS articles (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    title            TEXT NOT NULL,
    slug             TEXT UNIQUE NOT NULL,
    content          TEXT DEFAULT '',
    excerpt          TEXT DEFAULT '',
    meta_description TEXT DEFAULT '',
    featured_image   TEXT DEFAULT '',
    status           TEXT DEFAULT 'draft',
    published_at     TEXT,
    created_at       TEXT DEFAULT (datetime('now','localtime')),
    updated_at       TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// Migrare sigură — adaugă coloana category dacă nu există
try { db.exec('ALTER TABLE articles ADD COLUMN category TEXT DEFAULT ""'); } catch(e) {}

// Tabele recenzii și setări
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    initials    TEXT DEFAULT '',
    rating      INTEGER DEFAULT 5,
    text        TEXT NOT NULL,
    review_date TEXT DEFAULT '',
    visible     INTEGER DEFAULT 1,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  );
`);
db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('google_rating','5.0')").run();
db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('google_review_count','11')").run();

// Seed recenzii Google + Facebook (rulează o singură dată dacă tabela e goală)
if (!db.prepare('SELECT COUNT(*) as c FROM reviews').get().c) {
  const ins = db.prepare(
    'INSERT INTO reviews (name,initials,rating,text,review_date,visible,sort_order) VALUES (?,?,?,?,?,?,?)'
  );
  [
    ['Laura Codreanu','LC',5,
     'Am avut bucuria de a primi ajutor terapeutic eficient din partea Gabrielei, in momente mai dificile in care resursele fizice si emotionale imi erau aproape epuizate. Am rezonat foarte bine cu stilul ei cald si prezent, impreuna cu abordarea ei profesionista si plina de atentie, rabdare, implicare. Toate acestea mi-au fost de un real folos in experimentarea unor „insight"-uri si initierea unor mici (dar importanti) pasi inspre schimbare benefica. Recomand cu totala incredere serviciile psihologice pe care Gabriela le ofera.',
     'Aprilie 2026',1,1],
    ['Teodora Cristina Onaca','TC',5,
     'O recomand din suflet pe Gabriela Arghiroiu. Este un om cald, blând și foarte atent, care reușește să creeze un spațiu în care te simți în siguranță încă de la început. Are o empatie aparte și știe să asculte cu adevărat, fără să judece, iar felul ei de a ghida discuțiile te ajută să te înțelegi mai bine și să vezi lucrurile cu mai multă claritate. De fiecare dată am plecat de la ședințe mai liniștită și cu mai multă încredere. Pentru mine a fost un sprijin real și o experiență foarte frumoasă. O recomand cu toată căldura oricui simte nevoia să vorbească cu cineva care chiar îi pasă.',
     'Aprilie 2026',1,2],
    ['Roxana Cristea','RC',5,
     'O recomand cu drag pe Gabriela pentru profesionalismul și dedicarea de care dă dovadă. Este o persoană empatică, echilibrată și un bun ascultător, calități esențiale pentru un psiholog de încredere.',
     'Aprilie 2026',1,3],
    ['Anuta Zubascu','AZ',5,
     'Doamna Gabriela a avut un impact profund asupra vieții mele. M-a ajutat să îmi înțeleg și să îmi vindec traumele din copilărie, într-un mod în care nu credeam că este posibil. Cu o răbdare extraordinară și un profesionalism desăvârșit, a fost alături de mine în fiecare etapă a acestui proces dificil. M-am simțit ascultat, înțeles și susținut, iar datorită ei am reușit să îmi recapăt echilibrul și încrederea în mine. Îi sunt profund recunoscătoare pentru tot sprijinul oferit.',
     'Aprilie 2026',1,4],
    ['Mădălina Vingheac','MV',5,
     'Am avut o experienta deschisa și de mare ajutor, recomand din tot sufletul.',
     'Aprilie 2026',1,5],
    ['Diana Cicortas','DC',5,
     'Recomand cu mare drag! Gabi este o persoană empatica, atenta si creeaza un mediu sigur in care te poti deschide fara teama. M-a ajutat sa inteleg mai bine anumite situatii si sa gasesc solutii concrete.',
     'Aprilie 2026',1,6],
    ['Alina Damian','AD',5,
     'Un om atat de bun, care iti este alaturi trup si suflet in rezolvarea oricarei probleme pe care o intampini. Rar mai intalnesti oameni buni care sa te inteleaga si sa iti „mangaie" sufletul. Recomand din toata inima!',
     'Aprilie 2026',1,7],
    ['Ramona Chise','RC',5,
     'Gabi este o terapeuta dedicata, care tratează pacienții cu răbdare, calm și profesionalism, gata să răspundă la orice întrebare care te preocupă. Din interactiunea cu ea am ramas impresionata de experiența și cunoștințele în domeniu, dar și de caracterul sau. M-a intampinat cu o atitudine prietenoasa si empatica si un zâmbet cald ce inspiră încredere și bunătate. Recomand cu incredere!',
     'Aprilie 2026',1,8],
    ['Gabriela Boengiu','GB',5,
     'Pe doamna Gabriela am cunoscut-o doar online intr-o sedinta de terapie in urma pierderii unei persoane dragi. M-a ajutat foarte mult acea sedinta. Prin empatie, intelegere si sfaturi reale si aplicabile doamna psiholog a reusit sa ma ajute sa depasesc momentul si sa integrez pierderea. Chiar daca sedinta a fost gratuita doamna psiholog a dat dovada de multa implicare si profesionalism. Va multumesc si va urez multa sanatate si putere sa ajutati cat mai multi oameni!!! Sunteti o persoana deosebita!',
     'Noiembrie 2025',1,9],
  ].forEach(r => ins.run(...r));
}

// Creare utilizator implicit la primul start
if (!db.prepare('SELECT id FROM users WHERE id=1').get()) {
  db.prepare('INSERT OR IGNORE INTO users (username,password) VALUES (?,?)')
    .run('gabriela', bcrypt.hashSync('admin123', 10));
}

// ─── Middleware ───────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'ga-cabinet-2026-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 3600 * 1000 }
}));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(ROOT));

// ─── Helpers ──────────────────────────────────────────────────────
const esc = (s = '') => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

function makeSlug(title) {
  return title.toLowerCase()
    .replace(/[ăâ]/g,'a').replace(/î/g,'i').replace(/[șş]/g,'s').replace(/[țţ]/g,'t')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
}

function uniqueSlug(title, excludeId = null) {
  let slug = makeSlug(title), base = slug, i = 1;
  while (true) {
    const row = excludeId
      ? db.prepare('SELECT id FROM articles WHERE slug=? AND id!=?').get(slug, excludeId)
      : db.prepare('SELECT id FROM articles WHERE slug=?').get(slug);
    if (!row) break;
    slug = `${base}-${i++}`;
  }
  return slug;
}

function readMin(html = '') {
  return Math.max(1, Math.ceil(html.replace(/<[^>]+>/g,'').trim().split(/\s+/).length / 200));
}

// Convertește paragrafe complet îngroșate (scurte, fără punct final) în H2
function autoHeadings(html) {
  if (!html) return html;
  return html.replace(
    /<p(?:\s[^>]*)?>\s*<strong>\s*([^<]{1,100}?)\s*<\/strong>\s*<\/p>/gi,
    (match, text) => {
      const t = text.trim();
      if (!t || /[.!?;,:]$/.test(t) || t.length > 90) return match;
      return `<h2>${t}</h2>`;
    }
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ro-RO', { day:'numeric', month:'long', year:'numeric' });
}

// ─── Șablon head ──────────────────────────────────────────────────
function htmlHead({ title, desc, canonical, ogImage = '', type = 'website', pub = '', mod = '' }) {
  const img = ogImage || `${SITE_URL}/images/gabriela-arghiroiu-psiholog-oradea.jpg`;
  return `<!DOCTYPE html>
<html lang="ro">
<head>
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-58NN9TL5');</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${canonical}">
${pub ? `<meta property="article:published_time" content="${pub}">` : ''}
${mod ? `<meta property="article:modified_time" content="${mod}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Dancing+Script:wght@600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/blog.css">
</head>
<body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-58NN9TL5" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
}

// ─── Navigare ─────────────────────────────────────────────────────
function navHTML(active = '') {
  const blogActive = active === 'blog' ? ' active' : '';
  return `
<nav id="nav">
  <div class="container">
    <a href="/" class="nav-logo">Gabriela Arghiroiu</a>
    <ul class="nav-links">
      <li><a href="/#despre">Despre mine</a></li>
      <li class="nav-dropdown"><a href="/#servicii">Servicii <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></a>
        <div class="dropdown-menu">
          <a href="/terapie-cuplu-oradea.html">Terapie de Cuplu</a>
          <a href="/terapie-familie-oradea.html">Terapie de Familie</a>
          <a href="/evaluare-psihologica-oradea.html">Evaluare Psihologică</a>
          <a href="/psihoncologie-oradea.html">Psiho-oncologie</a>
        </div>
      </li>
      <li><a href="/#tarife">Tarife</a></li>
      <li><a href="/#abordare">Cum lucrez</a></li>
      <li><a href="/#intrebari">Întrebări</a></li>
      <li><a href="/blog" class="${blogActive}">Blog</a></li>
      <li><a href="/#contact" class="btn btn-nav">Programează o ședință</a></li>
    </ul>
    <button class="hamburger" onclick="toggleMenu()" aria-label="Meniu"><span></span><span></span><span></span></button>
  </div>
</nav>
<div class="mobile-menu" id="mobileMenu">
  <a href="/#despre" onclick="closeMenu()">Despre mine</a>
  <a href="/#servicii" onclick="closeMenu()" style="font-weight:600">Servicii</a>
  <a href="/terapie-cuplu-oradea.html" onclick="closeMenu()" style="padding-left:24px;font-size:0.88rem;opacity:0.85">↳ Terapie de Cuplu</a>
  <a href="/terapie-familie-oradea.html" onclick="closeMenu()" style="padding-left:24px;font-size:0.88rem;opacity:0.85">↳ Terapie de Familie</a>
  <a href="/evaluare-psihologica-oradea.html" onclick="closeMenu()" style="padding-left:24px;font-size:0.88rem;opacity:0.85">↳ Evaluare Psihologică</a>
  <a href="/psihoncologie-oradea.html" onclick="closeMenu()" style="padding-left:24px;font-size:0.88rem;opacity:0.85">↳ Psiho-oncologie</a>
  <a href="/blog" onclick="closeMenu()">Blog</a>
  <a href="/#tarife" onclick="closeMenu()">Tarife</a>
  <a href="/#abordare" onclick="closeMenu()">Cum lucrez</a>
  <a href="/#intrebari" onclick="closeMenu()">Întrebări frecvente</a>
  <a href="/#contact" class="btn" onclick="closeMenu()">Programează o ședință</a>
</div>`;
}

// ─── Footer ───────────────────────────────────────────────────────
const footerHTML = `
<footer>
  <div class="container">
    <div class="footer-grid">
      <div class="footer-col footer-about">
        <div class="footer-brand">Gabriela Arghiroiu</div>
        <p>Psiholog Clinician &amp; Psihoterapeut · Oradea</p>
        <p>Cabinet Individual de Psihologie Arghiroiu Gabriela<br>CUI: 47741060<br>Str. Gheorghe Doja nr. 75H, Oradea, Jud. Bihor<br>Cabinet: Str. General Gheorghe Magheru nr. 21, Bl. 21, Parter, Oradea</p>
        <p style="margin-top:8px"><a href="tel:0724220686">0724 220 686</a> &nbsp;·&nbsp; <a href="mailto:gabriela.arghiroiu@gmail.com">gabriela.arghiroiu@gmail.com</a></p>
      </div>
      <div class="footer-col">
        <h4>Servicii</h4>
        <div class="footer-col-links">
          <a href="/terapie-cuplu-oradea.html">Terapie de Cuplu</a>
          <a href="/terapie-familie-oradea.html">Terapie de Familie</a>
          <a href="/evaluare-psihologica-oradea.html">Evaluare Psihologică</a>
          <a href="/psihoncologie-oradea.html">Psiho-oncologie</a>
          <a href="/blog">Blog</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Legal</h4>
        <div class="footer-col-links">
          <a href="/politica-confidentialitate.html">Politică de confidențialitate</a>
          <a href="/politica-cookies.html">Politică cookies</a>
          <a href="/termeni-conditii.html">Termeni și condiții</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2026 Cabinet Individual de Psihologie Arghiroiu Gabriela. Toate drepturile rezervate.</p>
    </div>
  </div>
</footer>`;

// ─── JS navigare (comun) ──────────────────────────────────────────
const navJS = `<script>
function toggleMenu(){document.getElementById('mobileMenu').classList.toggle('open')}
function closeMenu(){document.getElementById('mobileMenu').classList.remove('open')}
window.addEventListener('scroll',()=>{
  document.getElementById('nav').classList.toggle('scrolled',window.scrollY>20);
});
// Dropdown delay (desktop)
(function(){
  var dd=document.querySelector('.nav-dropdown');
  if(!dd)return;
  var menu=dd.querySelector('.dropdown-menu');
  dd.addEventListener('mouseenter',function(){menu.style.visibility='visible';menu.style.opacity='1';menu.style.transitionDelay='0s';});
  dd.addEventListener('mouseleave',function(){menu.style.transitionDelay='0.2s';menu.style.visibility='hidden';menu.style.opacity='0';});
})();
</script>`;

// ─── Pagina listing blog ──────────────────────────────────────────
app.get('/blog', (req, res) => {
  const articles = db.prepare(
    `SELECT id,title,slug,excerpt,featured_image,published_at,content,category
     FROM articles WHERE status='published' ORDER BY published_at DESC`
  ).all();

  const cards = articles.map(a => {
    const mins = readMin(a.content);
    const dateStr = fmtDate(a.published_at);
    const dateISO = a.published_at ? a.published_at.slice(0,10) : '';
    return `
    <article class="blog-card">
      <a href="/blog/${a.slug}" class="blog-card-img-wrap">
        ${a.featured_image
          ? `<img src="${esc(a.featured_image)}" alt="${esc(a.title)}" loading="lazy">`
          : `<div class="blog-card-placeholder"></div>`}
      </a>
      <div class="blog-card-body">
        <div class="blog-card-meta">
          ${a.category ? `<span class="blog-card-cat">${esc(a.category)}</span><span aria-hidden="true">·</span>` : ''}
          <time datetime="${dateISO}">${dateStr}</time>
          <span aria-hidden="true">·</span>
          <span>${mins} min citire</span>
        </div>
        <h2 class="blog-card-title"><a href="/blog/${a.slug}">${esc(a.title)}</a></h2>
        ${a.excerpt ? `<p class="blog-card-excerpt">${esc(a.excerpt)}</p>` : ''}
        <a href="/blog/${a.slug}" class="blog-card-cta">Citește articolul →</a>
      </div>
    </article>`;
  }).join('');

  res.send(`${htmlHead({
    title: 'Blog — Gabriela Arghiroiu, Psiholog Oradea',
    desc: 'Articole despre psihologie, sănătate emoțională, cuplu și familie. Scrise de Gabriela Arghiroiu, psiholog clinician în Oradea.',
    canonical: `${SITE_URL}/blog`
  })}
${navHTML('blog')}
<section class="blog-hero">
  <div class="container">
    <div class="section-tag">Blog</div>
    <h1 class="section-title">Articole despre psihologie</h1>
    <p class="section-lead">Gânduri, perspective și resurse pentru sănătatea emoțională — scrise din cabinet, pentru viața de zi cu zi.</p>
  </div>
</section>
<main class="blog-listing">
  <div class="container">
    ${articles.length === 0
      ? `<p class="blog-empty">Niciun articol publicat momentan. Reveniți în curând.</p>`
      : `<div class="blog-grid">${cards}</div>`}
  </div>
</main>
<section class="cta-band" style="margin-top:64px">
  <div class="container">
    <h2>Aveți întrebări? Suntem aici pentru dvs.</h2>
    <p>Prima convorbire telefonică este gratuită.</p>
    <a href="tel:0724220686" class="btn" style="margin-top:24px">0724 220 686</a>
  </div>
</section>
${footerHTML}
${navJS}
</body></html>`);
});

// ─── Pagina articol individual ────────────────────────────────────
app.get('/blog/:slug', (req, res) => {
  const a = db.prepare(
    `SELECT * FROM articles WHERE slug=? AND status='published'`
  ).get(req.params.slug);
  if (!a) return res.redirect('/blog');

  const related = db.prepare(
    `SELECT title,slug,featured_image FROM articles
     WHERE status='published' AND slug!=?
     ORDER BY published_at DESC LIMIT 2`
  ).all(a.slug);

  const mins    = readMin(a.content);
  const pubISO  = a.published_at || a.created_at;
  const updISO  = a.updated_at;
  const pubStr  = fmtDate(pubISO);
  const updStr  = fmtDate(updISO);
  const pubDate = pubISO ? pubISO.slice(0,10) : '';

  const jsonLd = JSON.stringify({
    "@context":"https://schema.org","@type":"Article",
    "headline": a.title,
    "description": a.meta_description || a.excerpt || a.title,
    "image": a.featured_image ? `${SITE_URL}${a.featured_image}` : `${SITE_URL}/images/gabriela-arghiroiu-psiholog-oradea.jpg`,
    "datePublished": pubISO,"dateModified": updISO,
    "author":{"@type":"Person","name":"Gabriela Arghiroiu","url":SITE_URL,"jobTitle":"Psiholog Clinician"},
    "publisher":{"@type":"Organization","name":"Cabinet Individual de Psihologie Arghiroiu Gabriela","logo":{"@type":"ImageObject","url":`${SITE_URL}/favicon.svg`}},
    "mainEntityOfPage":{"@type":"WebPage","@id":`${SITE_URL}/blog/${a.slug}`},
    "wordCount": a.content.replace(/<[^>]+>/g,'').trim().split(/\s+/).length,
    "inLanguage":"ro-RO"
  });

  const breadLd = JSON.stringify({
    "@context":"https://schema.org","@type":"BreadcrumbList",
    "itemListElement":[
      {"@type":"ListItem","position":1,"name":"Acasă","item":SITE_URL},
      {"@type":"ListItem","position":2,"name":"Blog","item":`${SITE_URL}/blog`},
      {"@type":"ListItem","position":3,"name":a.title}
    ]
  });

  const relatedHTML = related.length ? `
<section class="related-articles">
  <div class="container article-container">
    <h3 class="related-title">Articole similare</h3>
    <div class="related-grid">
      ${related.map(r => `
      <a href="/blog/${esc(r.slug)}" class="related-card">
        ${r.featured_image ? `<div class="related-card-img"><img src="${esc(r.featured_image)}" alt="${esc(r.title)}" loading="lazy"></div>` : '<div class="related-card-img related-card-img--empty"></div>'}
        <div class="related-card-body">
          <span class="related-card-title">${esc(r.title)}</span>
          <span class="related-card-arrow">→</span>
        </div>
      </a>`).join('')}
    </div>
  </div>
</section>` : '';

  res.send(`${htmlHead({
    title: `${a.title} | Gabriela Arghiroiu`,
    desc: a.meta_description || a.excerpt || a.title,
    canonical: `${SITE_URL}/blog/${a.slug}`,
    ogImage: a.featured_image ? `${SITE_URL}${a.featured_image}` : '',
    type: 'article', pub: pubISO, mod: updISO
  })}
<script type="application/ld+json">${jsonLd}</script>
<script type="application/ld+json">${breadLd}</script>
${navHTML()}
<div class="reading-bar" id="readingBar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>
<main>
<article class="article-page">
  <div class="container article-container">
    <nav class="blog-breadcrumb" aria-label="Traseu navigare">
      <a href="/">Acasă</a> <span>›</span>
      <a href="/blog">Blog</a> <span>›</span>
      <span>${esc(a.title)}</span>
    </nav>
    ${a.category ? `<div class="article-cat-badge">${esc(a.category)}</div>` : ''}
    <header class="article-header">
      <h1>${esc(a.title)}</h1>
      <div class="article-meta">
        <span class="article-author">
          <span class="author-initials" aria-hidden="true">GA</span>
          Gabriela Arghiroiu
        </span>
        <span aria-hidden="true">·</span>
        <time datetime="${pubDate}">Publicat ${pubStr}</time>
        ${updStr !== pubStr ? `<span aria-hidden="true">·</span><span>Actualizat ${updStr}</span>` : ''}
        <span aria-hidden="true">·</span>
        <span>${mins} min citire</span>
      </div>
    </header>
    ${a.featured_image ? `
    <figure class="article-hero-img">
      <img src="${esc(a.featured_image)}" alt="${esc(a.title)}" width="1200" height="630" loading="eager" fetchpriority="high">
      <button class="scroll-down-btn" id="scrollDownBtn" aria-label="Derulează la conținut">
        <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
      </button>
      ${a.meta_description ? `<figcaption class="article-hero-caption">${esc(a.meta_description)}</figcaption>` : ''}
    </figure>` : ''}
    ${a.excerpt ? `
    <aside class="article-tldr" aria-label="Pe scurt">
      <div class="tldr-label">Pe scurt</div>
      <p>${esc(a.excerpt)}</p>
    </aside>` : ''}
    <div class="article-body">
      ${a.content}
    </div>
    <footer class="article-footer-row">
      <a href="/blog" class="back-link">← Înapoi la blog</a>
      <div class="share-row">
        <span>Distribuie:</span>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${SITE_URL}/blog/${a.slug}" target="_blank" rel="noopener noreferrer">Facebook</a>
        <a href="https://wa.me/?text=${encodeURIComponent(a.title+' '+SITE_URL+'/blog/'+a.slug)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
      </div>
    </footer>
    <div class="author-bio">
      <div class="author-bio-avatar" aria-hidden="true">GA</div>
      <div class="author-bio-content">
        <div class="author-bio-name">Gabriela Arghiroiu</div>
        <div class="author-bio-role">Psiholog Clinician &amp; Psihoterapeut · Oradea</div>
        <p class="author-bio-text">Lucrez cu adulți, cupluri și familii în cadrul cabinetului meu din Oradea. Scriu aceste articole pentru a aduce psihologia mai aproape de viața de zi cu zi — în limbaj clar, fără jargon.</p>
        <a href="/#contact" class="author-bio-cta">Programează o ședință →</a>
      </div>
    </div>
  </div>
</article>
</main>
${relatedHTML}
<section class="cta-band article-cta">
  <div class="container">
    <h2>Aveți întrebări sau doriți o programare?</h2>
    <p>Prima convorbire telefonică este gratuită — fără obligații.</p>
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:28px">
      <a href="tel:0724220686" class="btn">0724 220 686</a>
      <a href="/#contact" class="btn btn-outline" style="background:transparent;border-color:rgba(255,255,255,0.6);color:#fff">Trimite un mesaj</a>
    </div>
  </div>
</section>
${footerHTML}
${navJS}
<script>
(function(){
  // ── Bara de progres ──────────────────────────────────────────────
  var bar = document.getElementById('readingBar');
  if (bar) {
    function upd() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var pct = h > 0 ? Math.min(100, window.scrollY / h * 100) : 0;
      bar.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', Math.round(pct));
    }
    var tick = false;
    window.addEventListener('scroll', function(){ if(!tick){ requestAnimationFrame(function(){ upd(); tick=false; }); tick=true; } }, { passive:true });
    upd();
  }

  // ── Cuprins (Table of Contents) ──────────────────────────────────
  (function() {
    var body = document.querySelector('.article-body');
    if (!body) return;
    var headings = body.querySelectorAll('h2');
    if (headings.length < 2) return;
    var items = [];
    headings.forEach(function(h, i) {
      var id = 'sec-' + (i + 1);
      h.id = id;
      items.push('<li><a href="#' + id + '">' + h.textContent + '</a></li>');
    });
    var toc = document.createElement('nav');
    toc.className = 'article-toc';
    toc.setAttribute('aria-label', 'Cuprins articol');
    toc.innerHTML = '<div class="toc-header"><span class="toc-title">Cuprins</span><button class="toc-toggle" aria-expanded="true" aria-label="Ascunde cuprins">▲</button></div><ol class="toc-list">' + items.join('') + '</ol>';
    body.parentNode.insertBefore(toc, body);
    var toggle = toc.querySelector('.toc-toggle');
    var list = toc.querySelector('.toc-list');
    toggle.addEventListener('click', function() {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.textContent = open ? '▼' : '▲';
      list.style.display = open ? 'none' : '';
    });
  })();

  // ── FAQ Accordion (H3 care se termină cu "?") ────────────────────
  (function() {
    var body = document.querySelector('.article-body');
    if (!body) return;
    var h3s = Array.from(body.querySelectorAll('h3')).filter(function(h) {
      return h.textContent.trim().slice(-1) === '?';
    });
    h3s.forEach(function(h3) {
      var siblings = [];
      var next = h3.nextElementSibling;
      while (next && next.tagName !== 'H2' && next.tagName !== 'H3') {
        siblings.push(next);
        next = next.nextElementSibling;
      }
      if (!siblings.length) return;
      var wrapper = document.createElement('div');
      wrapper.className = 'faq-item';
      var btn = document.createElement('button');
      btn.className = 'faq-question';
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<span>' + h3.textContent + '</span><svg class="faq-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
      var answer = document.createElement('div');
      answer.className = 'faq-answer';
      siblings.forEach(function(el) { answer.appendChild(el); });
      wrapper.appendChild(btn);
      wrapper.appendChild(answer);
      h3.parentNode.insertBefore(wrapper, h3);
      h3.remove();
      btn.addEventListener('click', function() {
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        wrapper.classList.toggle('open', !open);
      });
    });
  })();

  // ── Buton scroll-down ────────────────────────────────────────────
  (function() {
    var btn = document.getElementById('scrollDownBtn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var target = document.querySelector('.article-toc') || document.querySelector('.article-tldr') || document.querySelector('.article-body');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    var hero = document.querySelector('.article-hero-img');
    if (!hero) return;
    window.addEventListener('scroll', function() {
      var bottom = hero.getBoundingClientRect().bottom;
      btn.style.opacity = bottom > 80 ? '1' : '0';
      btn.style.pointerEvents = bottom > 80 ? 'auto' : 'none';
    }, { passive: true });
  })();
})();
</script>
</body></html>`);
});

// ─── API autentificare ────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'Neautorizat' });
};

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Utilizator sau parolă incorectă' });
  req.session.userId   = user.id;
  req.session.username = user.username;
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (req.session.userId) res.json({ username: req.session.username });
  else res.status(401).json({ error: 'Neautorizat' });
});

// ─── API articole ─────────────────────────────────────────────────
app.get('/api/articles', requireAuth, (req, res) => {
  res.json(db.prepare(
    'SELECT id,title,slug,status,published_at,created_at FROM articles ORDER BY created_at DESC'
  ).all());
});

app.get('/api/articles/:id', requireAuth, (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Nu a fost găsit' });
  res.json(a);
});

app.post('/api/articles', requireAuth, (req, res) => {
  const { title, content, excerpt, meta_description, featured_image, status, category } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Titlul este obligatoriu' });
  const slug = uniqueSlug(title);
  const now  = new Date().toISOString();
  const pub  = status === 'published' ? now : null;
  const finalContent = status === 'published' ? autoHeadings(content||'') : (content||'');
  const r = db.prepare(
    `INSERT INTO articles (title,slug,content,excerpt,meta_description,featured_image,status,published_at,created_at,updated_at,category)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(title.trim(), slug, finalContent, excerpt||'', meta_description||'', featured_image||'', status||'draft', pub, now, now, category||'');
  res.json({ id: r.lastInsertRowid, slug });
});

app.put('/api/articles/:id', requireAuth, (req, res) => {
  const old = db.prepare('SELECT * FROM articles WHERE id=?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Nu a fost găsit' });
  const { title, content, excerpt, meta_description, featured_image, status, category } = req.body;
  const now  = new Date().toISOString();
  const slug = (title && title.trim() !== old.title) ? uniqueSlug(title, Number(req.params.id)) : old.slug;
  let pub = old.published_at;
  if (status === 'published' && !pub) pub = now;
  if (status === 'draft') pub = null;
  const newStatus  = status || old.status;
  const rawContent = content ?? old.content;
  const finalContent = newStatus === 'published' ? autoHeadings(rawContent) : rawContent;
  db.prepare(
    `UPDATE articles SET title=?,slug=?,content=?,excerpt=?,meta_description=?,featured_image=?,status=?,published_at=?,updated_at=?,category=? WHERE id=?`
  ).run(title?.trim()||old.title, slug, finalContent, excerpt??old.excerpt, meta_description??old.meta_description, featured_image??old.featured_image, newStatus, pub, now, category??old.category??'', req.params.id);
  res.json({ ok: true, slug });
});

app.delete('/api/articles/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM articles WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── API upload imagine ───────────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g,'');
      const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext||'.jpg'}`;
      cb(null, name);
    }
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Numai imagini sunt permise'));
  }
});

app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nicio imagine primită' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ─── Schimbare parolă ─────────────────────────────────────────────
app.post('/api/change-password', requireAuth, (req, res) => {
  const { current, next } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId);
  if (!user || !bcrypt.compareSync(current, user.password))
    return res.status(400).json({ error: 'Parola curentă este greșită' });
  if (!next || next.length < 6)
    return res.status(400).json({ error: 'Parola nouă trebuie să aibă cel puțin 6 caractere' });
  db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(next, 10), user.id);
  res.json({ ok: true });
});

// ─── API recenzii (public) ────────────────────────────────────────
app.get('/api/reviews', (req, res) => {
  const reviews = db.prepare(
    'SELECT * FROM reviews WHERE visible=1 ORDER BY sort_order ASC, id DESC'
  ).all();
  const raw = db.prepare('SELECT * FROM settings WHERE key IN (?,?)').all('google_rating','google_review_count');
  const settings = {};
  raw.forEach(r => { settings[r.key] = r.value; });
  res.json({ reviews, settings });
});

// ─── API recenzii (admin CRUD) ────────────────────────────────────
function makeInitials(name) {
  return (name || '').split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
}

app.get('/api/admin/reviews', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM reviews ORDER BY sort_order ASC, id DESC').all());
});

app.post('/api/admin/reviews', requireAuth, (req, res) => {
  const { name, initials, rating, text, review_date, visible, sort_order } = req.body;
  if (!name?.trim() || !text?.trim())
    return res.status(400).json({ error: 'Numele și textul sunt obligatorii' });
  const init = (initials || '').trim() || makeInitials(name);
  const r = db.prepare(
    'INSERT INTO reviews (name,initials,rating,text,review_date,visible,sort_order) VALUES (?,?,?,?,?,?,?)'
  ).run(name.trim(), init, Number(rating)||5, text.trim(), review_date||'', visible===false?0:1, Number(sort_order)||0);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/admin/reviews/:id', requireAuth, (req, res) => {
  const old = db.prepare('SELECT * FROM reviews WHERE id=?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Nu a fost găsit' });
  const { name, initials, rating, text, review_date, visible, sort_order } = req.body;
  const n = (name ?? old.name).trim();
  const init = (initials || '').trim() || makeInitials(n);
  db.prepare(
    'UPDATE reviews SET name=?,initials=?,rating=?,text=?,review_date=?,visible=?,sort_order=? WHERE id=?'
  ).run(n, init, Number(rating??old.rating)||5, (text??old.text).trim(),
    review_date??old.review_date, visible===false?0:visible===true?1:old.visible,
    Number(sort_order??old.sort_order)||0, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/reviews/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM reviews WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── API setări badge Google ──────────────────────────────────────
app.put('/api/settings', requireAuth, (req, res) => {
  const allowed = ['google_rating','google_review_count'];
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
  Object.entries(req.body).forEach(([k, v]) => { if (allowed.includes(k)) stmt.run(k, String(v)); });
  res.json({ ok: true });
});

// ─── Admin panel ──────────────────────────────────────────────────
app.get('/admin', (req, res) => res.sendFile(path.join(ROOT, 'admin.html')));
app.get('/admin/*', (req, res) => res.redirect('/admin'));

// ─── Start server ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log(`║  Cabinet Psihologic Gabriela — Server  ║`);
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  Site:  http://localhost:${PORT}           ║`);
  console.log(`║  Blog:  http://localhost:${PORT}/blog       ║`);
  console.log(`║  Admin: http://localhost:${PORT}/admin      ║`);
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  User:  gabriela                       ║`);
  console.log(`║  Pass:  admin123                       ║`);
  console.log('╚════════════════════════════════════════╝\n');
});
