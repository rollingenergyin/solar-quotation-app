/**
 * Solar Growth OS — Bulk HTML Asset Generator
 * Generates production-ready HTML files for all 31 posts:
 *   • 1080×1080 static post designs
 *   • Interactive carousel previews
 *   • Animated reel previews (scene-by-scene with play control)
 *
 * Run: tsx scripts/generateAllAssets.ts
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
const BASE = process.env.API_BASE ?? 'http://localhost:4000/api';
const OUT = resolve(__dirname, '../assets');

mkdirSync(OUT, { recursive: true });

async function login() {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailOrUserId: 'admin@solar.com', password: 'Admin123!' }) });
  return ((await r.json()) as { token: string }).token;
}

// ─── BRAND ─────────────────────────────────────────────────────────────────
const B = { blue: '#739bd6', dark: '#161c34', black: '#000000', white: '#ffffff', darkBg: '#0a0e1a', darkMid: '#0d1220' };

const LOGO_SVG = `
<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:36px;height:36px">
  <circle cx="24" cy="24" r="10" fill="${B.white}" opacity="0.9"/>
  <line x1="24" y1="2" x2="24" y2="10" stroke="${B.white}" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="24" y1="38" x2="24" y2="46" stroke="${B.white}" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="2" y1="24" x2="10" y2="24" stroke="${B.white}" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="38" y1="24" x2="46" y2="24" stroke="${B.white}" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="7" y1="7" x2="13" y2="13" stroke="${B.white}" stroke-width="3" stroke-linecap="round"/>
  <line x1="35" y1="35" x2="41" y2="41" stroke="${B.white}" stroke-width="3" stroke-linecap="round"/>
  <line x1="41" y1="7" x2="35" y2="13" stroke="${B.white}" stroke-width="3" stroke-linecap="round"/>
  <line x1="13" y1="35" x2="7" y2="41" stroke="${B.white}" stroke-width="3" stroke-linecap="round"/>
</svg>`;

function slug(title: string, date: string) {
  return `${date.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${title.slice(0, 30).replace(/[^a-z0-9]/gi, '-').toLowerCase()}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC POST GENERATOR  (1080×1080)
// ─────────────────────────────────────────────────────────────────────────────
function genStaticPost(post: any): string {
  const spec = post.productionSpec ?? {};
  const ds = spec.designSpec ?? {};
  const ip = spec.imagePrompt ?? {};
  const layout = ds.layout ?? {};
  const dataPoints: string[] = ds.dataPoints ?? [];
  const headline = layout.middle?.match(/"([^"]+)"/)?.[1] ?? post.title;
  const subline = layout.bottom?.match(/"([^"]+)"/)?.[1] ?? '';
  const category = post.isNewsSlot ? '📰 NEWS SLOT' : (post.segment ?? 'SOLAR');
  const date = post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const time = post.scheduledAt ? new Date(post.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '';
  const platforms = (post.platforms ?? []).join(' · ');
  const hashtags = (post.hashtags ?? []).slice(0, 8).map((h: string) => `#${h}`).join(' ');

  // Pick accent color based on segment
  const segColors: Record<string, string> = { RESIDENTIAL: '#739bd6', SOCIETY: '#a78bfa', COMMERCIAL: '#34d399', INDUSTRIAL: '#fb923c', GROUND_MOUNT: '#86efac' };
  const accent = segColors[post.segment] ?? B.blue;

  // News slot: slightly different color
  const bgGrad = post.isNewsSlot
    ? `linear-gradient(145deg, #1a1206 0%, ${B.darkMid} 60%, ${B.darkBg} 100%)`
    : `linear-gradient(145deg, ${B.dark} 0%, ${B.darkMid} 60%, ${B.darkBg} 100%)`;

  const statsHtml = dataPoints.map((dp: string) => `
    <div style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px 18px;margin-bottom:12px">
      <div style="width:8px;height:8px;border-radius:50%;background:${accent};flex-shrink:0"></div>
      <div style="color:rgba(255,255,255,0.85);font-size:18px;font-weight:600">${dp}</div>
    </div>`).join('');

  const captionLines = post.captionEn.split('\n').slice(0, 6).join('<br>');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${post.title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#333;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;padding:40px 20px;font-family:'Segoe UI',system-ui,Arial,sans-serif}
  .wrap{display:flex;flex-direction:column;gap:24px;align-items:center}
  .meta{background:rgba(255,255,255,0.08);border-radius:12px;padding:16px 24px;color:#ccc;font-size:13px;text-align:center;max-width:1080px;width:100%;line-height:1.8}
  .meta strong{color:#fff}
  .canvas{width:1080px;height:1080px;position:relative;overflow:hidden;background:${bgGrad};flex-shrink:0}
  .topbar{position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,${accent},${B.blue},${accent})}
  .glow{position:absolute;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(115,155,214,0.14) 0%,transparent 70%);top:-100px;right:-60px;pointer-events:none}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);background-size:54px 54px}
  .pill{position:absolute;top:32px;left:48px;background:${accent};color:#fff;font-size:15px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;padding:7px 18px;border-radius:30px}
  .logo-area{position:absolute;top:24px;right:48px;display:flex;align-items:center;gap:10px}
  .logo-icon{width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,${B.blue},#4a6fb8);display:flex;align-items:center;justify-content:center}
  .logo-txt .name{color:#fff;font-size:15px;font-weight:800;text-align:right}
  .logo-txt .sub{color:${accent};font-size:10px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;text-align:right;margin-top:2px}
  .body-area{position:absolute;top:110px;left:48px;right:48px;bottom:90px;display:flex;flex-direction:column}
  .eyebrow{color:${accent};font-size:15px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:20px;display:flex;align-items:center;gap:10px}
  .eyebrow::before{content:'';display:block;width:26px;height:3px;background:${accent};border-radius:2px}
  .headline{color:#fff;font-size:${headline.length > 40 ? '50' : headline.length > 30 ? '58' : '66'}px;font-weight:900;line-height:1.1;letter-spacing:-1px;margin-bottom:18px}
  .headline em{color:${accent};font-style:normal}
  .subline{color:rgba(255,255,255,0.6);font-size:22px;font-weight:400;line-height:1.5;margin-bottom:32px;max-width:760px}
  .stats-area{flex:1;display:flex;flex-direction:column;justify-content:center}
  .footer{position:absolute;bottom:0;left:0;right:0;height:72px;background:rgba(0,0,0,0.35);border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;padding:0 48px}
  .footer-l{display:flex;gap:28px;align-items:center;color:rgba(255,255,255,0.65);font-size:16px}
  .footer-sep{width:1px;height:24px;background:rgba(255,255,255,0.15)}
  .footer-r{color:rgba(255,255,255,0.3);font-size:13px;letter-spacing:0.5px}
  .news-badge{position:absolute;bottom:90px;right:48px;background:rgba(251,146,60,0.15);border:1px solid rgba(251,146,60,0.4);border-radius:10px;padding:10px 18px;color:rgba(251,146,60,0.9);font-size:14px;font-weight:600}
  .img-prompt{background:rgba(255,255,255,0.08);border-radius:12px;padding:20px 24px;margin-top:0;max-width:1080px;width:100%}
  .img-prompt h3{color:#739bd6;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
  .img-prompt code{display:block;color:#a3d9a5;font-size:12px;font-family:monospace;line-height:1.6;word-break:break-word}
  .img-prompt .neg{color:rgba(239,68,68,0.7);font-size:11px;margin-top:8px}
  .captions{background:rgba(255,255,255,0.06);border-radius:12px;padding:20px 24px;max-width:1080px;width:100%}
  .captions h3{color:#739bd6;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px}
  .lang-block{margin-bottom:16px}
  .lang-label{color:rgba(255,255,255,0.4);font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px}
  .lang-text{color:rgba(255,255,255,0.8);font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word}
  .hashtags-wrap{background:rgba(115,155,214,0.08);border-radius:12px;padding:20px 24px;max-width:1080px;width:100%}
  .hashtags-wrap h3{color:#739bd6;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px}
  .tags{display:flex;flex-wrap:wrap;gap:8px}
  .tag{background:rgba(115,155,214,0.15);border:1px solid rgba(115,155,214,0.3);color:rgba(255,255,255,0.8);padding:6px 12px;border-radius:20px;font-size:13px}
  .copy-btn{background:#739bd6;color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;margin-top:10px;display:block}
</style>
</head>
<body>
<div class="wrap">

<!-- Post info -->
<div class="meta">
  <strong>POST: ${post.title}</strong> &nbsp;|&nbsp;
  ${post.contentType.replace('_',' ')} &nbsp;|&nbsp;
  ${post.segment} &nbsp;|&nbsp;
  📅 ${date} ${time} IST &nbsp;|&nbsp;
  ${platforms}
  ${post.isNewsSlot ? '&nbsp;|&nbsp; <strong style="color:#fb923c">📰 NEWS SLOT — Fill 5 days before date</strong>' : ''}
</div>

<!-- 1080×1080 Canvas -->
<div class="canvas">
  <div class="topbar"></div>
  <div class="glow"></div>
  <div class="grid"></div>

  <div class="pill">${category.replace('_',' ')}</div>

  <div class="logo-area">
    <div class="logo-txt">
      <div class="name">Rolling Energy</div>
      <div class="sub">Solar · Maharashtra</div>
    </div>
    <div class="logo-icon">${LOGO_SVG}</div>
  </div>

  <div class="body-area">
    <div class="eyebrow">Maharashtra · ${date}</div>
    <div class="headline">${headline.replace(/\bSolar\b/g, '<em>Solar</em>').replace(/₹0/g, '<em>₹0</em>')}</div>
    ${subline ? `<div class="subline">${subline}</div>` : ''}
    <div class="stats-area">${statsHtml || `<div style="color:rgba(255,255,255,0.55);font-size:20px;line-height:1.7;max-width:700px">${captionLines}</div>`}</div>

    <!-- CTA -->
    <div style="margin-top:24px">
      <div style="display:inline-flex;align-items:center;gap:12px;background:${accent};color:#fff;font-size:20px;font-weight:700;padding:18px 36px;border-radius:14px;box-shadow:0 8px 30px rgba(115,155,214,0.35)">
        Get Free Quote →
      </div>
    </div>
  </div>

  ${post.isNewsSlot ? `<div class="news-badge">📰 Reserved — Fill with trending news</div>` : ''}

  <div class="footer">
    <div class="footer-l">
      <span>📞 [Your Phone Number]</span>
      <div class="footer-sep"></div>
      <span>🌐 rollingenergy.in</span>
    </div>
    <div class="footer-r">${hashtags}</div>
  </div>
</div>

<!-- AI Image Prompt -->
${ip.prompt ? `<div class="img-prompt">
  <h3>🤖 AI Image Prompt — ${ip.tool ?? 'Midjourney v6 / DALL-E 3 / Ideogram v2'}</h3>
  <code>${ip.prompt}${ip.aspectRatio ? ` --ar ${ip.aspectRatio === '1:1' ? '1:1' : '4:5'}` : ' --ar 1:1'} --v 6</code>
  ${ip.negativePrompt ? `<div class="neg">--no ${ip.negativePrompt}</div>` : ''}
</div>` : ''}

<!-- Captions -->
<div class="captions">
  <h3>📝 Final Captions — Ready to Post</h3>
  <div class="lang-block">
    <div class="lang-label">🇬🇧 English</div>
    <div class="lang-text" id="cap-en">${post.captionEn}</div>
  </div>
  <div class="lang-block">
    <div class="lang-label" style="font-family:'Noto Sans Devanagari',serif">🇮🇳 हिंदी</div>
    <div class="lang-text" style="font-family:'Noto Sans Devanagari','Mangal',serif" id="cap-hi">${post.captionHi}</div>
  </div>
  <div class="lang-block">
    <div class="lang-label" style="font-family:'Noto Sans Devanagari',serif">🟠 मराठी</div>
    <div class="lang-text" style="font-family:'Noto Sans Devanagari','Mangal',serif" id="cap-mr">${post.captionMr}</div>
  </div>
  <button class="copy-btn" onclick="copyAll()">📋 Copy English Caption</button>
</div>

<!-- Hashtags -->
<div class="hashtags-wrap">
  <h3>🏷 Hashtags — Copy &amp; Paste Ready</h3>
  <div class="tags">
    ${(post.hashtags ?? []).map((h: string) => `<span class="tag">#${h}</span>`).join('')}
  </div>
  <button class="copy-btn" onclick="copyTags()" style="margin-top:16px">📋 Copy All Hashtags</button>
</div>

</div>
<script>
function copyAll() {
  navigator.clipboard.writeText(document.getElementById('cap-en').textContent.trim());
  event.target.textContent = '✓ Copied!';
  setTimeout(() => event.target.textContent = '📋 Copy English Caption', 2000);
}
function copyTags() {
  const tags = [...document.querySelectorAll('.tag')].map(t => t.textContent.trim()).join(' ');
  navigator.clipboard.writeText(tags);
  event.target.textContent = '✓ Copied!';
  setTimeout(() => event.target.textContent = '📋 Copy All Hashtags', 2000);
}
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAROUSEL GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
function genCarousel(post: any): string {
  const spec = post.productionSpec ?? {};
  const ds = spec.designSpec ?? {};
  const ip = spec.imagePrompt ?? {};
  const audio = spec.audioPlan ?? {};
  const slides: any[] = ds.slideDesign ?? [];
  const date = post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const time = post.scheduledAt ? new Date(post.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '';
  const segColors: Record<string, string> = { RESIDENTIAL: '#739bd6', SOCIETY: '#a78bfa', COMMERCIAL: '#34d399', INDUSTRIAL: '#fb923c', GROUND_MOUNT: '#86efac' };
  const accent = segColors[post.segment] ?? B.blue;
  const coverHeadline = ds.layout?.cover?.match(/"([^"]+)"/)?.[1] ?? post.title;

  const slideCards = slides.map((sl: any, i: number) => {
    const bgDark = sl.bgColor === '#161c34' || i % 2 === 0;
    return `
    <div class="slide" data-index="${i + 1}" style="background:${bgDark ? sl.bgColor ?? B.dark : sl.bgColor ?? '#fff'};display:${i === 0 ? 'flex' : 'none'}">
      <div class="slide-num" style="background:${accent}">${String(i + 2).padStart(2, '0')}</div>
      <div class="slide-inner">
        <div class="slide-icon" style="background:rgba(115,155,214,0.12);border:1px solid rgba(115,155,214,0.2)">
          <div style="font-size:52px">${['💡','📊','💰','🏆','✅','⚡','🎯','📈'][i % 8]}</div>
        </div>
        <div class="slide-content">
          <div class="slide-title" style="color:${bgDark ? '#fff' : B.dark}">${sl.title}</div>
          <div class="slide-body" style="color:${bgDark ? 'rgba(255,255,255,0.65)' : 'rgba(22,28,52,0.65)'}">${sl.body}</div>
          <div class="slide-visual" style="color:${accent}">${sl.visual}</div>
        </div>
      </div>
      <div class="slide-footer" style="border-top:1px solid rgba(${bgDark ? '255,255,255' : '0,0,0'},0.08)">
        <span style="color:rgba(${bgDark ? '255,255,255' : '0,0,0'},0.4);font-size:13px">Slide ${i + 2} / ${slides.length + 2}</span>
        <span style="color:${accent};font-size:14px;font-weight:600">Swipe → for more</span>
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${post.title} — Carousel</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#2a2a2a;font-family:'Segoe UI',system-ui,Arial,sans-serif;min-height:100vh;padding:30px 20px;display:flex;flex-direction:column;align-items:center;gap:20px}
  .meta{background:rgba(255,255,255,0.08);border-radius:10px;padding:14px 24px;color:#bbb;font-size:13px;max-width:1080px;width:100%;text-align:center}
  .meta strong{color:#fff}
  .carousel-wrap{width:1080px;position:relative}
  .controls{display:flex;gap:12px;justify-content:center;margin-bottom:16px}
  .ctrl{padding:10px 22px;border-radius:30px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.15);cursor:pointer;font-size:14px;font-weight:600;transition:all 0.2s}
  .ctrl:hover,.ctrl.active-ctrl{background:${accent};border-color:${accent}}
  .dots{display:flex;gap:8px;justify-content:center;margin-top:16px}
  .dot{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,0.2);cursor:pointer;transition:all 0.2s}
  .dot.active{background:${accent};transform:scale(1.3)}

  /* COVER SLIDE */
  .cover{width:1080px;height:1080px;position:relative;overflow:hidden;background:linear-gradient(145deg,${B.dark} 0%,${B.darkMid} 60%,${B.darkBg} 100%);display:flex;flex-direction:column;align-items:center;justify-content:center}
  .cover-topbar{position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,${accent},${B.blue},${accent})}
  .cover-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);background-size:54px 54px}
  .cover-glow{position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(115,155,214,0.16) 0%,transparent 70%);top:-150px;right:-100px}
  .cover-pill{background:${accent};color:#fff;font-size:17px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:10px 22px;border-radius:30px;margin-bottom:36px}
  .cover-headline{color:#fff;font-size:72px;font-weight:900;line-height:1.1;text-align:center;letter-spacing:-1px;max-width:900px;margin-bottom:24px}
  .cover-headline em{color:${accent};font-style:normal}
  .cover-sub{color:rgba(255,255,255,0.55);font-size:26px;text-align:center;margin-bottom:48px}
  .cover-swipe{display:flex;align-items:center;gap:12px;color:rgba(255,255,255,0.4);font-size:20px}
  .cover-logo{position:absolute;top:32px;right:48px;display:flex;align-items:center;gap:10px}
  .cover-logo .lname{color:#fff;font-size:17px;font-weight:800;text-align:right}
  .cover-logo .lsub{color:${accent};font-size:10px;text-align:right;text-transform:uppercase;letter-spacing:1.5px}
  .cover-logo-icon{width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,${B.blue},#4a6fb8);display:flex;align-items:center;justify-content:center}
  .cover-footer{position:absolute;bottom:0;left:0;right:0;height:70px;background:rgba(0,0,0,0.35);border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;padding:0 48px;color:rgba(255,255,255,0.6);font-size:15px}
  .slide-count-badge{position:absolute;bottom:80px;right:48px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:30px;padding:10px 20px;color:rgba(255,255,255,0.4);font-size:16px}

  /* CONTENT SLIDES */
  .slide{width:1080px;height:1080px;position:relative;flex-direction:column;align-items:flex-start;justify-content:center;padding:0}
  .slide-num{position:absolute;top:36px;right:48px;background:${accent};color:#fff;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800}
  .slide-inner{display:flex;height:100%;align-items:center;padding:0 60px}
  .slide-icon{width:240px;height:240px;border-radius:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:60px}
  .slide-content{flex:1}
  .slide-title{font-size:52px;font-weight:900;line-height:1.1;margin-bottom:20px}
  .slide-body{font-size:26px;line-height:1.5;margin-bottom:24px}
  .slide-visual{font-size:18px;font-style:italic;padding:14px 20px;background:rgba(115,155,214,0.08);border-left:3px solid ${accent};border-radius:0 8px 8px 0;line-height:1.5}
  .slide-footer{position:absolute;bottom:0;left:0;right:0;height:68px;display:flex;align-items:center;justify-content:space-between;padding:0 48px}

  /* CTA SLIDE */
  .cta-slide{width:1080px;height:1080px;background:linear-gradient(145deg,${B.dark},${B.darkBg});display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative}
  .cta-slide-topbar{position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,${accent},${B.blue},${accent})}
  .cta-headline{color:#fff;font-size:70px;font-weight:900;margin-bottom:24px}
  .cta-sub{color:rgba(255,255,255,0.55);font-size:28px;margin-bottom:50px}
  .cta-btn{display:inline-block;background:${accent};color:#fff;font-size:32px;font-weight:800;padding:28px 60px;border-radius:20px;box-shadow:0 10px 40px rgba(115,155,214,0.4);margin-bottom:50px}
  .cta-contacts{display:flex;gap:40px;color:rgba(255,255,255,0.65);font-size:26px}
  .brand-info{position:absolute;top:36px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px}

  /* Extras */
  .section-box{background:rgba(255,255,255,0.06);border-radius:12px;padding:20px 24px;max-width:1080px;width:100%}
  .section-box h3{color:${accent};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px}
  .lang-block{margin-bottom:14px}
  .lang-label{color:rgba(255,255,255,0.4);font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px}
  .lang-text{color:rgba(255,255,255,0.8);font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word}
  .tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
  .tag{background:rgba(115,155,214,0.15);border:1px solid rgba(115,155,214,0.3);color:rgba(255,255,255,0.8);padding:6px 12px;border-radius:20px;font-size:13px}
  .copy-btn{background:${accent};color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;margin-top:12px;display:block}
  .audio-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .audio-item{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px}
  .audio-label{color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px}
  .audio-val{color:rgba(255,255,255,0.85);font-size:14px;line-height:1.5}
</style>
</head>
<body>

<div class="meta">
  <strong>${post.title}</strong> &nbsp;|&nbsp; CAROUSEL &nbsp;|&nbsp; ${post.segment} &nbsp;|&nbsp; 📅 ${date} ${time} IST &nbsp;|&nbsp; ${(post.platforms ?? []).join(' · ')}
</div>

<!-- Navigation controls -->
<div class="controls">
  <button class="ctrl" onclick="goSlide(0)" id="ctrl-0">Cover</button>
  ${slides.map((_: any, i: number) => `<button class="ctrl" onclick="goSlide(${i + 1})" id="ctrl-${i + 1}">Slide ${i + 1}</button>`).join('')}
  <button class="ctrl" onclick="goSlide(${slides.length + 1})" id="ctrl-${slides.length + 1}">CTA</button>
</div>

<div class="carousel-wrap">

  <!-- COVER SLIDE -->
  <div class="cover" id="slide-0">
    <div class="cover-topbar"></div>
    <div class="cover-grid"></div>
    <div class="cover-glow"></div>
    <div class="cover-logo">
      <div class="cover-logo .logo-txt">
        <div class="lname">Rolling Energy</div>
        <div class="lsub">Solar · Maharashtra</div>
      </div>
      <div class="cover-logo-icon">${LOGO_SVG}</div>
    </div>
    <div class="cover-pill">${post.segment.replace('_', ' ')}</div>
    <div class="cover-headline">${coverHeadline.replace(/Solar/g, '<em>Solar</em>')}</div>
    <div class="cover-sub">Swipe to see all ${slides.length} slides →</div>
    <div class="cover-swipe">
      <span>◀</span>
      ${Array.from({ length: slides.length + 2 }, (_, i) => `<div style="width:32px;height:4px;border-radius:2px;background:${i === 0 ? accent : 'rgba(255,255,255,0.15)'}"></div>`).join('')}
      <span>▶</span>
    </div>
    <div class="slide-count-badge">1 of ${slides.length + 2} slides</div>
    <div class="cover-footer">
      <span>📞 [Your Phone Number]</span>
      <span>🌐 rollingenergy.in</span>
    </div>
  </div>

  <!-- CONTENT SLIDES -->
  ${slideCards}

  <!-- CTA SLIDE -->
  <div class="cta-slide" id="slide-${slides.length + 1}">
    <div class="cta-slide-topbar"></div>
    <div style="margin-bottom:32px;font-size:70px">☀️</div>
    <div class="cta-headline">Ready to Go Solar?</div>
    <div class="cta-sub">Free consultation · No obligation · MSEDCL-approved</div>
    <div class="cta-btn">Get Free Quote Today →</div>
    <div class="cta-contacts">
      <span>📞 [Your Phone Number]</span>
      <span>🌐 rollingenergy.in</span>
    </div>
    <div style="position:absolute;bottom:80px;color:rgba(255,255,255,0.25);font-size:13px">${(post.hashtags ?? []).slice(0, 6).map((h: string) => `#${h}`).join(' ')}</div>
  </div>

</div>

<!-- Dots -->
<div class="dots">
  ${Array.from({ length: slides.length + 2 }, (_, i) => `<div class="dot${i === 0 ? ' active' : ''}" onclick="goSlide(${i})" id="dot-${i}"></div>`).join('')}
</div>

<!-- Audio Plan -->
${audio.style ? `<div class="section-box">
  <h3>🎵 Audio Plan</h3>
  <div class="audio-grid">
    <div class="audio-item"><div class="audio-label">Style</div><div class="audio-val">${audio.style}</div></div>
    <div class="audio-item"><div class="audio-label">BPM</div><div class="audio-val">${audio.bpm ?? '—'}</div></div>
    <div class="audio-item"><div class="audio-label">Mood</div><div class="audio-val">${audio.mood ?? '—'}</div></div>
    <div class="audio-item"><div class="audio-label">Source</div><div class="audio-val">${audio.source ?? 'Epidemic Sound / Artlist'}</div></div>
  </div>
  <div style="margin-top:14px;color:rgba(255,255,255,0.55);font-size:13px">
    Option A (no voice): ${typeof audio.optionA === 'string' ? audio.optionA : (audio.optionA as any)?.description ?? 'Carousel plays silently'}<br>
    Option B (music): ${typeof audio.optionB === 'string' ? audio.optionB : (audio.optionB as any)?.description ?? '—'}
  </div>
</div>` : ''}

<!-- Image Prompt -->
${ip.prompt ? `<div class="section-box">
  <h3>🤖 AI Image Prompt — ${ip.tool ?? 'Midjourney v6 / DALL-E 3'}</h3>
  <div style="background:rgba(0,0,0,0.3);border-radius:10px;padding:16px;font-family:monospace;color:#a3d9a5;font-size:13px;line-height:1.7;word-break:break-word">${ip.prompt} --ar 1:1 --v 6</div>
  ${ip.negativePrompt ? `<div style="color:rgba(239,68,68,0.6);font-size:12px;margin-top:8px">--no ${ip.negativePrompt}</div>` : ''}
</div>` : ''}

<!-- Captions -->
<div class="section-box">
  <h3>📝 Final Captions</h3>
  <div class="lang-block"><div class="lang-label">🇬🇧 English</div><div class="lang-text" id="cap-en">${post.captionEn}</div></div>
  <div class="lang-block"><div class="lang-label">🇮🇳 हिंदी</div><div class="lang-text" style="font-family:'Noto Sans Devanagari','Mangal',serif" id="cap-hi">${post.captionHi}</div></div>
  <div class="lang-block"><div class="lang-label">🟠 मराठी</div><div class="lang-text" style="font-family:'Noto Sans Devanagari','Mangal',serif" id="cap-mr">${post.captionMr}</div></div>
  <button class="copy-btn" onclick="copyEN()">📋 Copy English Caption</button>
</div>

<!-- Hashtags -->
<div class="section-box" style="background:rgba(115,155,214,0.06)">
  <h3>🏷 Hashtags</h3>
  <div class="tags">${(post.hashtags ?? []).map((h: string) => `<span class="tag">#${h}</span>`).join('')}</div>
  <button class="copy-btn" onclick="copyTags()">📋 Copy All Hashtags</button>
</div>

<script>
let current = 0;
const total = ${slides.length + 2};
function goSlide(n) {
  const prev = document.getElementById('slide-' + current);
  const prevCtrl = document.getElementById('ctrl-' + current);
  const prevDot = document.getElementById('dot-' + current);
  if (prev) { prev.style.display = 'none'; }
  if (prevCtrl) prevCtrl.classList.remove('active-ctrl');
  if (prevDot) prevDot.classList.remove('active');
  current = n;
  const next = document.getElementById('slide-' + current);
  const nextCtrl = document.getElementById('ctrl-' + current);
  const nextDot = document.getElementById('dot-' + current);
  if (next) { next.style.display = (n === 0 || n === total - 1) ? 'flex' : 'flex'; }
  if (nextCtrl) nextCtrl.classList.add('active-ctrl');
  if (nextDot) nextDot.classList.add('active');
}
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' && current < total - 1) goSlide(current + 1);
  if (e.key === 'ArrowLeft' && current > 0) goSlide(current - 1);
});
goSlide(0);
function copyEN() { navigator.clipboard.writeText(document.getElementById('cap-en').textContent.trim()); event.target.textContent='✓ Copied!'; setTimeout(()=>event.target.textContent='📋 Copy English Caption',2000); }
function copyTags() { const t=[...document.querySelectorAll('.tag')].map(x=>x.textContent.trim()).join(' '); navigator.clipboard.writeText(t); event.target.textContent='✓ Copied!'; setTimeout(()=>event.target.textContent='📋 Copy All Hashtags',2000); }
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// REEL GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
function genReel(post: any): string {
  const spec = post.productionSpec ?? {};
  const rs = spec.reelScript ?? {};
  const vp = spec.videoPrompt ?? {};
  const ip = spec.imagePrompt ?? {};
  const audio = spec.audioPlan ?? {};
  const scenes: any[] = rs.scenes ?? [];
  const date = post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const time = post.scheduledAt ? new Date(post.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '';
  const segColors: Record<string, string> = { RESIDENTIAL: '#739bd6', SOCIETY: '#a78bfa', COMMERCIAL: '#34d399', INDUSTRIAL: '#fb923c', GROUND_MOUNT: '#86efac' };
  const accent = segColors[post.segment] ?? B.blue;
  const totalDur = rs.totalDuration ?? '30s';
  const maxSec = parseInt(totalDur) || 30;

  const sceneSlides = scenes.map((sc: any, i: number) => {
    const dur = sc.endSec - sc.startSec;
    const colorPalette = [
      { bg: 'linear-gradient(180deg,#1a0808 0%,#0a0a0a 100%)', accent: '#ef4444' },
      { bg: 'linear-gradient(180deg,#0a1428 0%,#161c34 100%)', accent: B.blue },
      { bg: 'linear-gradient(180deg,#0a1a30 0%,#161c34 100%)', accent: B.blue },
      { bg: 'linear-gradient(180deg,#051a0e 0%,#0d1a10 100%)', accent: '#22c55e' },
      { bg: `linear-gradient(180deg,${B.dark} 0%,${B.darkBg} 100%)`, accent },
    ];
    const cp = colorPalette[i % colorPalette.length];
    return `
  <div class="scene" id="scene-${i}" style="display:${i === 0 ? 'flex' : 'none'}">
    <div class="scene-bg" style="background:${cp.bg}"></div>
    <div class="scene-num" style="background:${cp.accent}">Scene ${i + 1}</div>
    <div class="scene-timing">${sc.startSec}s – ${sc.endSec}s &nbsp;·&nbsp; ${dur}s &nbsp;·&nbsp; ${sc.transition}</div>

    <div class="scene-visual-box">
      <div class="visual-label">📽 VISUAL</div>
      <div class="visual-text">${sc.visual}</div>
    </div>

    <div class="scene-texts">
      <div class="text-row">
        <span class="lang-badge">EN</span>
        <span class="text-content">"${sc.textEn}"</span>
      </div>
      <div class="text-row">
        <span class="lang-badge hi-badge">हि</span>
        <span class="text-content" style="font-family:'Noto Sans Devanagari','Mangal',serif">"${sc.textHi}"</span>
      </div>
      <div class="text-row">
        <span class="lang-badge mr-badge">मर</span>
        <span class="text-content" style="font-family:'Noto Sans Devanagari','Mangal',serif">"${sc.textMr}"</span>
      </div>
    </div>

    <div class="scene-footer-strip">
      <span style="color:rgba(255,255,255,0.35);font-size:18px">TRANSITION:</span>
      <span style="color:${cp.accent};font-size:18px;font-weight:600">${sc.transition}</span>
    </div>
  </div>`;
  }).join('');

  const TIMING_DATA = JSON.stringify(scenes.map((sc: any) => sc.endSec));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${post.title} — Reel</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#1a1a1a;font-family:'Segoe UI',system-ui,Arial,sans-serif;min-height:100vh;padding:30px 20px;display:flex;flex-direction:column;align-items:center;gap:20px}
  .meta{background:rgba(255,255,255,0.07);border-radius:10px;padding:14px 24px;color:#bbb;font-size:13px;max-width:1080px;width:100%;text-align:center}
  .meta strong{color:#fff}
  .reel-wrap{display:flex;gap:24px;align-items:flex-start;max-width:1200px;width:100%}
  .reel-frame{width:540px;height:960px;position:relative;overflow:hidden;background:#000;border-radius:24px;flex-shrink:0;border:2px solid rgba(255,255,255,0.1)}
  .brand-strip{position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,${accent},${B.blue},${accent});z-index:100}
  .progress{position:absolute;top:6px;left:0;height:4px;background:${accent};transition:width 0.1s;z-index:100}
  .scene{position:absolute;inset:0;flex-direction:column;align-items:center;justify-content:center;padding:40px 30px 140px}
  .scene-bg{position:absolute;inset:0;z-index:0}
  .grid-overlay{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);background-size:40px 40px;z-index:1;pointer-events:none}
  .scene-num{position:absolute;top:20px;right:16px;background:${accent};color:#fff;font-size:12px;font-weight:800;padding:5px 12px;border-radius:20px;z-index:10;letter-spacing:1px}
  .scene-timing{position:absolute;top:20px;left:16px;color:rgba(255,255,255,0.4);font-size:11px;z-index:10;letter-spacing:1px}
  .scene-visual-box{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:20px 22px;width:100%;position:relative;z-index:2;margin-bottom:20px}
  .visual-label{color:rgba(255,255,255,0.4);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px}
  .visual-text{color:rgba(255,255,255,0.75);font-size:13px;line-height:1.6}
  .scene-texts{width:100%;display:flex;flex-direction:column;gap:10px;position:relative;z-index:2}
  .text-row{display:flex;align-items:flex-start;gap:10px;background:rgba(0,0,0,0.3);border-radius:12px;padding:12px 14px}
  .lang-badge{flex-shrink:0;background:${accent};color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;letter-spacing:1px;margin-top:1px}
  .hi-badge{background:#a78bfa}
  .mr-badge{background:#fb923c}
  .text-content{color:rgba(255,255,255,0.85);font-size:13px;line-height:1.6}
  .scene-footer-strip{position:absolute;bottom:80px;left:0;right:0;height:50px;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;gap:12px;z-index:5}
  .caption-zone{position:absolute;bottom:0;left:0;right:0;height:80px;background:linear-gradient(to top,rgba(0,0,0,0.7),transparent);display:flex;align-items:center;padding:0 16px;z-index:5}
  .caption-text{color:rgba(255,255,255,0.45);font-size:11px;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}

  /* Right panel */
  .right-panel{flex:1;display:flex;flex-direction:column;gap:16px;min-height:960px;overflow-y:auto;padding-right:4px}
  .panel-block{background:rgba(255,255,255,0.05);border-radius:14px;padding:20px 22px}
  .panel-block h3{color:${accent};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px}
  .ctrl-group{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .ctrl{padding:8px 16px;border-radius:20px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.12);cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s}
  .ctrl:hover,.ctrl.act{background:${accent};border-color:${accent}}
  .scene-list{display:flex;flex-direction:column;gap:8px}
  .scene-item{padding:12px 16px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);cursor:pointer;transition:all 0.2s}
  .scene-item:hover,.scene-item.active-scene{background:rgba(115,155,214,0.1);border-color:rgba(115,155,214,0.3)}
  .scene-item-top{display:flex;align-items:center;gap:8px;margin-bottom:4px}
  .scene-item-badge{background:${accent};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px}
  .scene-item-time{color:rgba(255,255,255,0.35);font-size:11px}
  .scene-item-text{color:rgba(255,255,255,0.65);font-size:12px;line-height:1.5}
  .video-prompt{background:rgba(0,0,0,0.4);border-radius:10px;padding:14px;font-family:monospace;color:#c084fc;font-size:11px;line-height:1.7;word-break:break-word}
  .audio-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .audio-cell{background:rgba(255,255,255,0.04);border-radius:8px;padding:12px}
  .audio-cell-label{color:rgba(255,255,255,0.35);font-size:10px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px}
  .audio-cell-val{color:rgba(255,255,255,0.8);font-size:13px;line-height:1.4}
  .lang-text-full{color:rgba(255,255,255,0.75);font-size:12px;line-height:1.7;white-space:pre-wrap;word-break:break-word}
  .copy-btn{background:${accent};color:#fff;border:none;padding:9px 20px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;margin-top:10px;display:block}
  .tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .tag{background:rgba(115,155,214,0.12);border:1px solid rgba(115,155,214,0.25);color:rgba(255,255,255,0.75);padding:4px 10px;border-radius:14px;font-size:11px}
  .play-bar{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
  .export-note{background:rgba(115,155,214,0.08);border:1px solid rgba(115,155,214,0.2);border-radius:10px;padding:14px;color:rgba(255,255,255,0.55);font-size:12px;line-height:1.7;margin-top:4px}
</style>
</head>
<body>

<div class="meta">
  <strong>${post.title}</strong> &nbsp;|&nbsp; 🎬 REEL &nbsp;·&nbsp; ${totalDur} &nbsp;·&nbsp; ${scenes.length} scenes &nbsp;|&nbsp;
  ${post.segment} &nbsp;|&nbsp; 📅 ${date} ${time} IST &nbsp;|&nbsp; ${(post.platforms ?? []).join(' · ')}
</div>

<div class="reel-wrap">

  <!-- Reel frame -->
  <div class="reel-frame">
    <div class="brand-strip"></div>
    <div class="progress" id="progress" style="width:0%"></div>
    <div class="grid-overlay"></div>
    ${sceneSlides}
    <div class="caption-zone"><div class="caption-text" id="caption-display">${post.captionEn.split('\n')[0]}</div></div>
  </div>

  <!-- Right panel -->
  <div class="right-panel">

    <!-- Playback controls -->
    <div class="panel-block">
      <h3>▶ Playback Control</h3>
      <div class="play-bar">
        <button class="ctrl act" onclick="prevScene()">← Prev</button>
        <button class="ctrl" id="playBtn" onclick="togglePlay()">▶ Play (${totalDur})</button>
        <button class="ctrl" onclick="nextScene()">Next →</button>
        <button class="ctrl" onclick="resetReel()">↺ Reset</button>
      </div>
      <div style="margin-top:12px;color:rgba(255,255,255,0.35);font-size:11px;text-align:center">← → Arrow keys to navigate scenes</div>
    </div>

    <!-- Scene index -->
    <div class="panel-block">
      <h3>🎬 Scene Index</h3>
      <div class="scene-list">
        ${scenes.map((sc: any, i: number) => `
        <div class="scene-item${i === 0 ? ' active-scene' : ''}" id="sitem-${i}" onclick="goScene(${i})">
          <div class="scene-item-top">
            <span class="scene-item-badge">Scene ${i + 1}</span>
            <span class="scene-item-time">${sc.startSec}s – ${sc.endSec}s &nbsp;·&nbsp; ${sc.transition}</span>
          </div>
          <div class="scene-item-text">${sc.textEn}</div>
        </div>`).join('')}
      </div>
    </div>

    <!-- Video prompt -->
    ${vp.prompt ? `<div class="panel-block">
      <h3>🎬 Video Generation Prompt</h3>
      <div style="color:rgba(255,255,255,0.35);font-size:11px;margin-bottom:8px">${vp.tool ?? 'Runway Gen-3 / Kling AI / Pika 2.0'} &nbsp;·&nbsp; ${vp.resolution ?? '1080×1920'} &nbsp;·&nbsp; ${vp.fps ?? 30}fps &nbsp;·&nbsp; ${vp.duration ?? totalDur}</div>
      <div class="video-prompt">${vp.prompt}</div>
      ${vp.negativePrompt ? `<div style="color:rgba(239,68,68,0.55);font-size:11px;margin-top:8px">--no ${vp.negativePrompt}</div>` : ''}
      <button class="copy-btn" onclick="copyPrompt('${vp.prompt.replace(/'/g, "\\'")}')">📋 Copy Prompt</button>
    </div>` : ''}

    <!-- Thumbnail prompt -->
    ${ip.prompt ? `<div class="panel-block">
      <h3>🖼 Thumbnail / Cover Prompt</h3>
      <div style="color:rgba(255,255,255,0.35);font-size:11px;margin-bottom:8px">${ip.tool ?? 'Midjourney v6'}</div>
      <div class="video-prompt" style="color:#a3d9a5">${ip.prompt} --ar 9:16 --v 6</div>
    </div>` : ''}

    <!-- Audio plan -->
    ${audio.style ? `<div class="panel-block">
      <h3>🎵 Audio Plan</h3>
      <div class="audio-grid">
        <div class="audio-cell"><div class="audio-cell-label">Style</div><div class="audio-cell-val">${audio.style}</div></div>
        <div class="audio-cell"><div class="audio-cell-label">BPM</div><div class="audio-cell-val">${audio.bpm ?? '—'}</div></div>
        <div class="audio-cell"><div class="audio-cell-label">Mood</div><div class="audio-cell-val">${audio.mood ?? '—'}</div></div>
        <div class="audio-cell"><div class="audio-cell-label">Source</div><div class="audio-cell-val" style="font-size:11px">${audio.source ?? 'Epidemic Sound / Artlist'}</div></div>
      </div>
      ${audio.optionA ? `<div style="margin-top:12px;color:rgba(255,255,255,0.5);font-size:12px"><span style="color:${accent};font-weight:600">Option A:</span> ${typeof audio.optionA === 'string' ? audio.optionA : (audio.optionA as any).description ?? ''}</div>` : ''}
      ${audio.optionB ? `<div style="margin-top:8px;color:rgba(255,255,255,0.5);font-size:12px"><span style="color:${accent};font-weight:600">Option B:</span> ${typeof audio.optionB === 'string' ? audio.optionB : (audio.optionB as any).description ?? ''}</div>` : ''}
    </div>` : ''}

    <!-- Captions -->
    <div class="panel-block">
      <h3>📝 Final Captions</h3>
      <div style="margin-bottom:12px"><div style="color:rgba(255,255,255,0.35);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">🇬🇧 English</div><div class="lang-text-full" id="cap-en">${post.captionEn}</div></div>
      <div style="margin-bottom:12px"><div style="color:rgba(255,255,255,0.35);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">🇮🇳 हिंदी</div><div class="lang-text-full" style="font-family:'Noto Sans Devanagari','Mangal',serif" id="cap-hi">${post.captionHi}</div></div>
      <div><div style="color:rgba(255,255,255,0.35);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">🟠 मराठी</div><div class="lang-text-full" style="font-family:'Noto Sans Devanagari','Mangal',serif" id="cap-mr">${post.captionMr}</div></div>
      <button class="copy-btn" onclick="copyEN()">📋 Copy English Caption</button>
    </div>

    <!-- Hashtags -->
    <div class="panel-block" style="background:rgba(115,155,214,0.06)">
      <h3>🏷 Hashtags</h3>
      <div class="tags">${(post.hashtags ?? []).map((h: string) => `<span class="tag">#${h}</span>`).join('')}</div>
      <button class="copy-btn" onclick="copyTags()">📋 Copy All Hashtags</button>
    </div>

    <!-- Export note -->
    <div class="panel-block" style="background:rgba(255,255,255,0.03)">
      <h3>⬇ Export Instructions</h3>
      <div class="export-note">
        1. Copy the video prompt → paste into <strong style="color:#c084fc">Runway Gen-3</strong> or <strong style="color:#c084fc">Kling AI</strong><br>
        2. Export each scene at ${vp.resolution ?? '1080×1920'}, ${vp.fps ?? 30}fps<br>
        3. Edit in CapCut / Premiere: add kinetic text per scene timing above<br>
        4. Add audio: ${audio.style ?? 'upbeat corporate'} ${audio.bpm ? `(${audio.bpm} BPM)` : ''}<br>
        ${rs.exportNote ? `5. ${rs.exportNote}` : '5. Export as MP4 H.264, max 90s for Reels'}
      </div>
    </div>

  </div>
</div>

<script>
const TIMING = ${TIMING_DATA};
const TOTAL_SEC = ${maxSec};
let cur = 0;
let playing = false;
let elapsed = 0;
let timer = null;

function goScene(n) {
  document.getElementById('scene-' + cur)?.style.setProperty('display','none');
  document.getElementById('sitem-' + cur)?.classList.remove('active-scene');
  cur = n;
  document.getElementById('scene-' + cur)?.style.setProperty('display','flex');
  document.getElementById('sitem-' + cur)?.classList.add('active-scene');
}
function nextScene() { if (cur < ${scenes.length - 1}) goScene(cur + 1); }
function prevScene() { if (cur > 0) goScene(cur - 1); }

function togglePlay() {
  if (playing) {
    clearInterval(timer); playing = false;
    document.getElementById('playBtn').textContent = '▶ Play (${totalDur})';
  } else {
    if (elapsed >= TOTAL_SEC) { elapsed = 0; goScene(0); document.getElementById('progress').style.width='0%'; }
    playing = true;
    document.getElementById('playBtn').textContent = '⏸ Pause';
    timer = setInterval(() => {
      elapsed += 0.1;
      document.getElementById('progress').style.width = Math.min(elapsed / TOTAL_SEC * 100, 100) + '%';
      const si = TIMING.findIndex(t => elapsed <= t);
      const sceneIdx = si === -1 ? ${scenes.length - 1} : si;
      if (sceneIdx !== cur) goScene(sceneIdx);
      if (elapsed >= TOTAL_SEC) {
        clearInterval(timer); playing = false;
        document.getElementById('playBtn').textContent = '▶ Play (${totalDur})';
      }
    }, 100);
  }
}
function resetReel() {
  clearInterval(timer); playing = false; elapsed = 0;
  document.getElementById('progress').style.width = '0%';
  document.getElementById('playBtn').textContent = '▶ Play (${totalDur})';
  goScene(0);
}
document.addEventListener('keydown', e => {
  if (e.key==='ArrowRight') nextScene();
  if (e.key==='ArrowLeft') prevScene();
  if (e.key===' ') { e.preventDefault(); togglePlay(); }
});
function copyEN() { navigator.clipboard.writeText(document.getElementById('cap-en').textContent.trim()); event.target.textContent='✓ Copied!'; setTimeout(()=>event.target.textContent='📋 Copy English Caption',2000); }
function copyTags() { const t=[...document.querySelectorAll('.tag')].map(x=>x.textContent.trim()).join(' '); navigator.clipboard.writeText(t); event.target.textContent='✓ Copied!'; setTimeout(()=>event.target.textContent='📋 Copy All Hashtags',2000); }
function copyPrompt(p) { navigator.clipboard.writeText(p); event.target.textContent='✓ Copied!'; setTimeout(()=>event.target.textContent='📋 Copy Prompt',2000); }
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n⚡ Solar Growth OS — Bulk HTML Asset Generator\n');
  const token = await login();
  const r = await fetch(`${BASE}/social/posts?limit=50`, { headers: { Authorization: `Bearer ${token}` } });
  const { posts } = await r.json() as { posts: any[] };
  posts.sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());

  let counts = { static: 0, carousel: 0, reel: 0 };
  const index: string[] = [];

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const dateStr = p.scheduledAt ? new Date(p.scheduledAt).toISOString().slice(0, 10) : `post-${i + 1}`;
    const filename = `${String(i + 1).padStart(2, '0')}-${slug(p.title, dateStr)}.html`;
    const outPath = resolve(OUT, filename);

    let html = '';
    if (p.contentType === 'REEL') {
      html = genReel(p);
      counts.reel++;
    } else if (p.contentType === 'CAROUSEL') {
      html = genCarousel(p);
      counts.carousel++;
    } else {
      html = genStaticPost(p);
      counts.static++;
    }

    writeFileSync(outPath, html, 'utf8');
    const icon = p.contentType === 'REEL' ? '🎬' : p.contentType === 'CAROUSEL' ? '🎠' : '🖼️';
    const news = p.isNewsSlot ? ' 📰' : '';
    console.log(`  ${icon} [${String(i + 1).padStart(2, '0')}/31]${news} ${filename}`);

    const dateLabel = p.scheduledAt ? new Date(p.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '';
    const timeLabel = p.scheduledAt ? new Date(p.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '';
    index.push(`<tr onclick="window.open('${filename}','_blank')" style="cursor:pointer">
      <td>${String(i + 1).padStart(2, '0')}</td>
      <td>${icon}</td>
      <td>${p.title}${p.isNewsSlot ? ' <span class="news-tag">NEWS</span>' : ''}</td>
      <td>${p.segment.replace('_', ' ')}</td>
      <td>${dateLabel}</td>
      <td>${timeLabel}</td>
      <td><span class="status ${p.status.toLowerCase()}">${p.status.replace('_', ' ')}</span></td>
      <td><a href="${filename}" target="_blank" class="open-btn">Open →</a></td>
    </tr>`);
  }

  // Master index page
  const indexHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"><title>Solar Growth OS — Asset Index</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0f1218;color:#fff;font-family:'Segoe UI',system-ui,Arial,sans-serif;padding:40px}
  h1{font-size:32px;font-weight:900;margin-bottom:8px}
  .sub{color:rgba(255,255,255,0.4);font-size:15px;margin-bottom:40px}
  .stats{display:flex;gap:20px;margin-bottom:40px}
  .stat-card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px 28px;text-align:center}
  .stat-card .n{font-size:40px;font-weight:900;color:#739bd6}
  .stat-card .l{color:rgba(255,255,255,0.45);font-size:13px;margin-top:4px;text-transform:uppercase;letter-spacing:1px}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;padding:12px 16px;background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.06)}
  td{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:14px}
  tr:hover td{background:rgba(115,155,214,0.05)}
  .news-tag{background:rgba(251,146,60,0.2);color:#fb923c;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;vertical-align:middle;margin-left:6px}
  .status{font-size:11px;padding:3px 10px;border-radius:12px;font-weight:600;text-transform:uppercase}
  .status.pending_approval{background:rgba(234,179,8,0.15);color:#eab308}
  .status.approved{background:rgba(34,197,94,0.15);color:#22c55e}
  .status.draft{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.4)}
  .status.scheduled{background:rgba(115,155,214,0.15);color:#739bd6}
  .status.posted{background:rgba(34,197,94,0.2);color:#22c55e}
  .status.failed{background:rgba(239,68,68,0.15);color:#ef4444}
  .open-btn{background:#739bd6;color:#fff;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap}
  .open-btn:hover{background:#5a82c8}
  .header{display:flex;align-items:center;gap:16px;margin-bottom:8px}
  .logo{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#739bd6,#4a6fb8);display:flex;align-items:center;justify-content:center;font-size:24px}
</style>
</head>
<body>
<div class="header">
  <div class="logo">☀️</div>
  <div>
    <h1>Solar Growth OS — Asset Pack</h1>
    <div class="sub">April 15 – May 15, 2026 &nbsp;·&nbsp; Rolling Energy &nbsp;·&nbsp; Maharashtra</div>
  </div>
</div>
<div class="stats">
  <div class="stat-card"><div class="n">31</div><div class="l">Total Posts</div></div>
  <div class="stat-card"><div class="n">${counts.static}</div><div class="l">🖼️ Static Posts</div></div>
  <div class="stat-card"><div class="n">${counts.carousel}</div><div class="l">🎠 Carousels</div></div>
  <div class="stat-card"><div class="n">${counts.reel}</div><div class="l">🎬 Reels</div></div>
  <div class="stat-card"><div class="n">8</div><div class="l">📰 News Slots</div></div>
</div>
<table>
  <thead><tr><th>#</th><th>Type</th><th>Title</th><th>Segment</th><th>Date</th><th>Time</th><th>Status</th><th>Asset</th></tr></thead>
  <tbody>${index.join('')}</tbody>
</table>
<div style="margin-top:40px;color:rgba(255,255,255,0.25);font-size:12px;text-align:center">
  Solar Growth OS &nbsp;·&nbsp; Generated ${new Date().toISOString()} &nbsp;·&nbsp; rollingenergy.in
</div>
</body>
</html>`;

  writeFileSync(resolve(OUT, 'index.html'), indexHtml, 'utf8');

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅  ALL ASSETS GENERATED`);
  console.log(`\n    📁  Folder:    ${OUT}`);
  console.log(`    📋  Index:     ${OUT}/index.html`);
  console.log(`\n    🖼️  Static:    ${counts.static} files`);
  console.log(`    🎠  Carousels: ${counts.carousel} files`);
  console.log(`    🎬  Reels:     ${counts.reel} files`);
  console.log(`    📄  Total:     ${posts.length + 1} HTML files\n`);
  console.log(`    → Open index.html in your browser to browse all assets`);
  console.log(`    → Each file is standalone — share directly with your designer\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
