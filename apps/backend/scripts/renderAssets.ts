/**
 * Solar Growth OS — Production Asset Renderer
 * Renders all 31 posts as real JPG files and all 4 reels as MP4 files
 * using Puppeteer (headless Chrome) + FFmpeg
 *
 * Run: tsx scripts/renderAssets.ts
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, readFileSync, existsSync, unlinkSync, readdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BASE = process.env.API_BASE ?? 'http://localhost:4000/api';
const ASSETS = resolve(__dirname, '../assets');
const OUT_JPG = resolve(ASSETS, 'output/jpg');
const OUT_MP4 = resolve(ASSETS, 'output/mp4');
const BRAND_DIR = resolve(ASSETS, 'brand');
const SITE_DIR = resolve(ASSETS, 'site-media');
const FRAMES_TMP = resolve(ASSETS, 'output/frames-tmp');
const HTML_TMP   = resolve(ASSETS, 'output/html-tmp');

const BRAND = {
  blue: '#739bd6',
  dark: '#161c34',
  black: '#000000',
  white: '#ffffff',
  phone: '94296 92920',
  website: 'www.rollingenergy.in',
  name: 'Rolling Energy',
};

mkdirSync(OUT_JPG, { recursive: true });
mkdirSync(OUT_MP4, { recursive: true });
mkdirSync(FRAMES_TMP, { recursive: true });
mkdirSync(HTML_TMP, { recursive: true });

// ─── HELPERS ─────────────────────────────────────────────────────────────────
async function login() {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUserId: 'admin@solar.com', password: 'Admin123!' }),
  });
  return ((await r.json()) as { token: string }).token;
}

function toBase64(filePath: string): string {
  if (!existsSync(filePath)) return '';
  const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png';
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${readFileSync(filePath).toString('base64')}`;
}

function slug(i: number, title: string, date: string) {
  return `${String(i).padStart(2, '0')}-${date}-${title.slice(0, 35).replace(/[^a-z0-9]/gi, '-').toLowerCase()}`.replace(/-+/g, '-').replace(/-$/g, '');
}

// ─── LOGO + SITE PHOTOS ──────────────────────────────────────────────────────
const logoB64 = toBase64(resolve(BRAND_DIR, 'logo.png'));
const sitePhotos = ['site1.jpg', 'site2.jpg', 'site3.jpg', 'site4.jpg']
  .map(f => toBase64(resolve(SITE_DIR, f)))
  .filter(Boolean);

// ─── SEGMENT PALETTE ─────────────────────────────────────────────────────────
const SEG_COLOR: Record<string, string> = {
  RESIDENTIAL: '#739bd6',
  SOCIETY: '#a78bfa',
  COMMERCIAL: '#34d399',
  INDUSTRIAL: '#fb923c',
  GROUND_MOUNT: '#86efac',
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC POST HTML  (1080×1080)
// ─────────────────────────────────────────────────────────────────────────────
function buildStaticHtml(post: any, sitePhotoB64: string): string {
  const spec = post.productionSpec ?? {};
  const ds = spec.designSpec ?? {};
  const layout = ds.layout ?? {};
  const dataPoints: string[] = ds.dataPoints ?? [];
  const accent = SEG_COLOR[post.segment] ?? BRAND.blue;

  // Extract headline from layout or fall back to title
  const headline = layout.middle?.match(/"([^"]+)"/)?.[1]
    ?? layout.top?.match(/"([^"]+)"/)?.[1]
    ?? post.title;
  const subline = layout.bottom?.match(/"([^"]+)"/)?.[1] ?? '';

  const statsHtml = dataPoints.slice(0, 4).map((dp: string) => `
    <div style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,0.07);
      border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:16px 20px;margin-bottom:14px">
      <div style="width:9px;height:9px;border-radius:50%;background:${accent};flex-shrink:0"></div>
      <div style="color:rgba(255,255,255,0.9);font-size:20px;font-weight:600;line-height:1.3">${dp}</div>
    </div>`).join('');

  const captionPreview = post.captionEn.split('\n').slice(0, 4).join('<br>');
  const hasPhoto = sitePhotoB64 && !post.isNewsSlot;
  const hasSiteContent = dataPoints.length > 0;

  const pillText = post.isNewsSlot ? '📰 NEWS SLOT'
    : post.segment.replace('_', ' ');

  // Determine font size for headline based on length
  const hLen = headline.length;
  const hSize = hLen > 60 ? '44px' : hLen > 45 ? '52px' : hLen > 30 ? '60px' : '68px';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1080px;overflow:hidden;background:${BRAND.dark};
    font-family:-apple-system,'Helvetica Neue',Arial,sans-serif}
  .canvas{width:1080px;height:1080px;position:relative;overflow:hidden;
    background:linear-gradient(145deg,${BRAND.dark} 0%,#0d1220 55%,#0a0e1a 100%)}
  .bg-photo{position:absolute;inset:0;z-index:0}
  .bg-photo img{width:100%;height:100%;object-fit:cover;opacity:0.13}
  .grad-overlay{position:absolute;inset:0;z-index:1;
    background:linear-gradient(160deg,rgba(22,28,52,0.96) 0%,rgba(10,14,26,0.92) 100%)}
  .topbar{position:absolute;top:0;left:0;right:0;height:7px;z-index:10;
    background:linear-gradient(90deg,${accent} 0%,${BRAND.blue} 50%,${accent} 100%)}
  .grid{position:absolute;inset:0;z-index:2;
    background-image:linear-gradient(rgba(255,255,255,0.022) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px);
    background-size:60px 60px}
  .glow{position:absolute;width:560px;height:560px;border-radius:50%;z-index:2;
    background:radial-gradient(circle,rgba(115,155,214,0.15) 0%,transparent 70%);
    top:-140px;right:-80px;pointer-events:none}
  .content{position:absolute;inset:0;z-index:5;padding:52px 56px 0;display:flex;flex-direction:column}

  /* Header row */
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:36px}
  .pill{background:${accent};color:#fff;font-size:14px;font-weight:800;
    letter-spacing:2.5px;text-transform:uppercase;padding:8px 20px;border-radius:30px}
  .logo-wrap{display:flex;align-items:center;gap:10px}
  .logo-wrap img{height:56px;width:auto;object-fit:contain}
  .brand-text{text-align:right}
  .brand-name{color:#fff;font-size:16px;font-weight:800}
  .brand-sub{color:${accent};font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px}

  /* Body */
  .eyebrow{color:${accent};font-size:14px;font-weight:700;letter-spacing:3px;
    text-transform:uppercase;margin-bottom:18px;display:flex;align-items:center;gap:10px}
  .eyebrow::before{content:'';display:block;width:28px;height:3px;background:${accent};border-radius:2px}
  .headline{color:#fff;font-size:${hSize};font-weight:900;line-height:1.1;
    letter-spacing:-1.5px;margin-bottom:16px;max-width:900px}
  .headline em{color:${accent};font-style:normal}
  .subline{color:rgba(255,255,255,0.55);font-size:22px;font-weight:400;
    line-height:1.5;margin-bottom:28px;max-width:820px}
  .stats{flex:1;display:flex;flex-direction:column;justify-content:center;max-width:860px}
  .caption-text{color:rgba(255,255,255,0.55);font-size:18px;line-height:1.7;max-width:840px}

  /* CTA */
  .cta-row{display:flex;align-items:center;gap:18px;margin-top:28px}
  .cta-btn{background:${accent};color:#fff;font-size:22px;font-weight:800;
    padding:20px 40px;border-radius:14px;
    box-shadow:0 8px 32px rgba(115,155,214,0.35);white-space:nowrap}
  .cta-contact{display:flex;flex-direction:column;gap:4px;color:rgba(255,255,255,0.6);font-size:16px}

  /* Footer */
  .footer{position:absolute;bottom:0;left:0;right:0;height:76px;z-index:6;
    background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.07);
    display:flex;align-items:center;justify-content:space-between;padding:0 56px}
  .footer-left{display:flex;gap:28px;align-items:center;color:rgba(255,255,255,0.65);font-size:17px;font-weight:500}
  .footer-sep{width:1px;height:26px;background:rgba(255,255,255,0.12)}
  .footer-right{color:rgba(255,255,255,0.28);font-size:13px;letter-spacing:0.3px;max-width:500px;text-align:right}

  /* News slot override */
  .news-badge{background:rgba(251,146,60,0.15);border:1px solid rgba(251,146,60,0.35);
    border-radius:12px;padding:12px 20px;color:rgba(251,146,60,0.9);font-size:16px;
    font-weight:600;display:inline-flex;align-items:center;gap:10px;margin-top:20px}
</style>
</head>
<body>
<div class="canvas">
  ${hasPhoto ? `<div class="bg-photo"><img src="${sitePhotoB64}" /></div><div class="grad-overlay"></div>` : ''}
  <div class="topbar"></div>
  <div class="grid"></div>
  <div class="glow"></div>

  <div class="content">
    <!-- Header -->
    <div class="header">
      <div class="pill">${pillText}</div>
      <div class="logo-wrap">
        <div class="brand-text">
          <div class="brand-name">${BRAND.name}</div>
          <div class="brand-sub">Solar · Maharashtra</div>
        </div>
        ${logoB64 ? `<img src="${logoB64}" />` : ''}
      </div>
    </div>

    <!-- Body -->
    <div class="eyebrow">Maharashtra · Solar EPC</div>
    <div class="headline">${headline}</div>
    ${subline ? `<div class="subline">${subline}</div>` : ''}

    <div class="stats">
      ${hasSiteContent ? statsHtml : `<div class="caption-text">${captionPreview}</div>`}
    </div>

    ${post.isNewsSlot
      ? `<div class="news-badge">📰 Reserved for Trending News — Fill 5 days before post date</div>`
      : `<div class="cta-row">
          <div class="cta-btn">Get Free Quote →</div>
          <div class="cta-contact">
            <span>📞 ${BRAND.phone}</span>
            <span>🌐 ${BRAND.website}</span>
          </div>
        </div>`
    }
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <span>📞 ${BRAND.phone}</span>
      <div class="footer-sep"></div>
      <span>🌐 ${BRAND.website}</span>
    </div>
    <div class="footer-right">
      ${(post.hashtags ?? []).slice(0, 6).map((h: string) => `#${h}`).join(' ')}
    </div>
  </div>
</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAROUSEL SLIDE HTML  (1080×1080 per slide)
// ─────────────────────────────────────────────────────────────────────────────
function buildCarouselSlideHtml(post: any, slide: any, slideIdx: number, totalSlides: number): string {
  const accent = SEG_COLOR[post.segment] ?? BRAND.blue;
  const isCover = slideIdx === 0;
  const isCTA = slideIdx === totalSlides - 1;

  if (isCover) {
    const headline = post.title;
    const hLen = headline.length;
    const hSize = hLen > 50 ? '52px' : hLen > 35 ? '62px' : '72px';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{width:1080px;height:1080px;overflow:hidden;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif}
      .c{width:1080px;height:1080px;background:linear-gradient(145deg,${BRAND.dark},#0a0e1a);
        position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center}
      .topbar{position:absolute;top:0;left:0;right:0;height:7px;
        background:linear-gradient(90deg,${accent},${BRAND.blue},${accent})}
      .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.022) 1px,transparent 1px),
        linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px);background-size:60px 60px}
      .glow{position:absolute;width:600px;height:600px;border-radius:50%;
        background:radial-gradient(circle,rgba(115,155,214,0.16) 0%,transparent 70%);top:-150px;right:-100px}
      .logo-area{position:absolute;top:36px;right:52px;display:flex;align-items:center;gap:10px}
      .logo-area img{height:52px;width:auto}
      .brand-name{color:#fff;font-size:16px;font-weight:800;text-align:right}
      .brand-sub{color:${accent};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;text-align:right;margin-top:2px}
      .pill{background:${accent};color:#fff;font-size:15px;font-weight:800;letter-spacing:2px;
        text-transform:uppercase;padding:10px 24px;border-radius:30px;margin-bottom:36px}
      .headline{color:#fff;font-size:${hSize};font-weight:900;line-height:1.1;letter-spacing:-1.5px;
        text-align:center;max-width:880px;margin-bottom:28px}
      .headline em{color:${accent};font-style:normal}
      .swipe{color:rgba(255,255,255,0.35);font-size:18px;display:flex;align-items:center;gap:10px;margin-top:40px}
      .dots{display:flex;gap:10px}
      .dot{width:36px;height:5px;border-radius:3px}
      .footer{position:absolute;bottom:0;left:0;right:0;height:72px;
        background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.07);
        display:flex;align-items:center;justify-content:space-between;padding:0 52px;
        color:rgba(255,255,255,0.55);font-size:16px}
    </style></head><body>
    <div class="c">
      <div class="topbar"></div><div class="grid"></div><div class="glow"></div>
      <div class="logo-area">
        <div><div class="brand-name">${BRAND.name}</div><div class="brand-sub">Solar · Maharashtra</div></div>
        ${logoB64 ? `<img src="${logoB64}" />` : ''}
      </div>
      <div class="pill">${post.segment.replace('_', ' ')}</div>
      <div class="headline">${headline}</div>
      <div class="swipe">
        <span>Swipe for all ${totalSlides - 2} insights</span>
        <div class="dots">
          ${Array.from({ length: Math.min(totalSlides, 8) }, (_, i) =>
            `<div class="dot" style="background:${i === 0 ? accent : 'rgba(255,255,255,0.15)'}"></div>`
          ).join('')}
        </div>
        <span>→</span>
      </div>
      <div class="footer">
        <span>📞 ${BRAND.phone}</span>
        <span>🌐 ${BRAND.website}</span>
      </div>
    </div></body></html>`;
  }

  if (isCTA) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{width:1080px;height:1080px;overflow:hidden;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif}
      .c{width:1080px;height:1080px;background:linear-gradient(145deg,${BRAND.dark},#0a0e1a);
        position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center}
      .topbar{position:absolute;top:0;left:0;right:0;height:7px;background:linear-gradient(90deg,${accent},${BRAND.blue},${accent})}
      .icon{font-size:90px;margin-bottom:36px}
      .headline{color:#fff;font-size:64px;font-weight:900;line-height:1.1;text-align:center;margin-bottom:20px}
      .sub{color:rgba(255,255,255,0.5);font-size:26px;text-align:center;margin-bottom:50px}
      .btn{background:${accent};color:#fff;font-size:30px;font-weight:800;
        padding:26px 56px;border-radius:18px;margin-bottom:40px;
        box-shadow:0 8px 40px rgba(115,155,214,0.4)}
      .contacts{display:flex;gap:40px;color:rgba(255,255,255,0.6);font-size:24px}
      .footer{position:absolute;bottom:0;left:0;right:0;height:72px;
        background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.07);
        display:flex;align-items:center;justify-content:center;padding:0 52px;
        color:rgba(255,255,255,0.28);font-size:14px;letter-spacing:0.5px}
    </style></head><body>
    <div class="c">
      <div class="topbar"></div>
      <div class="icon">☀️</div>
      <div class="headline">Ready to Go Solar?</div>
      <div class="sub">Free site visit · MSEDCL approved · 30yr system life</div>
      <div class="btn">Get Free Quote Today →</div>
      <div class="contacts"><span>📞 ${BRAND.phone}</span><span>🌐 ${BRAND.website}</span></div>
      <div class="footer">
        ${(post.hashtags ?? []).slice(0, 8).map((h: string) => `#${h}`).join(' ')}
      </div>
    </div></body></html>`;
  }

  // Content slide
  const icons = ['💡', '📊', '💰', '🏆', '✅', '⚡', '🎯', '📈', '🌞', '🔋'];
  const icon = icons[(slideIdx - 1) % icons.length];
  const titleSize = (slide.title ?? '').length > 40 ? '38px' : (slide.title ?? '').length > 25 ? '46px' : '54px';
  const bodySize = (slide.body ?? '').length > 120 ? '20px' : '24px';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:1080px;height:1080px;overflow:hidden;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif}
    .c{width:1080px;height:1080px;position:relative;overflow:hidden;
      background:linear-gradient(145deg,${BRAND.dark} 0%,#0a0e1a 100%);
      display:flex;align-items:center;padding:0 64px}
    .topbar{position:absolute;top:0;left:0;right:0;height:7px;background:linear-gradient(90deg,${accent},${BRAND.blue},${accent})}
    .slide-num{position:absolute;top:36px;right:52px;background:${accent};color:#fff;
      width:52px;height:52px;border-radius:14px;display:flex;align-items:center;
      justify-content:center;font-size:20px;font-weight:900}
    .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);background-size:60px 60px}
    .icon-box{width:200px;height:200px;border-radius:28px;flex-shrink:0;margin-right:56px;
      background:rgba(115,155,214,0.1);border:1px solid rgba(115,155,214,0.2);
      display:flex;align-items:center;justify-content:center;font-size:90px}
    .right{flex:1;display:flex;flex-direction:column}
    .label{color:${accent};font-size:13px;font-weight:700;letter-spacing:3px;
      text-transform:uppercase;margin-bottom:18px}
    .title{color:#fff;font-size:${titleSize};font-weight:900;line-height:1.15;margin-bottom:20px}
    .body{color:rgba(255,255,255,0.65);font-size:${bodySize};line-height:1.6;margin-bottom:24px}
    .visual{color:${accent};font-size:17px;font-style:italic;padding:14px 20px;
      background:rgba(115,155,214,0.08);border-left:3px solid ${accent};
      border-radius:0 10px 10px 0;line-height:1.5}
    .footer{position:absolute;bottom:0;left:0;right:0;height:68px;
      background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.07);
      display:flex;align-items:center;justify-content:space-between;padding:0 52px;
      color:rgba(255,255,255,0.55);font-size:15px}
    .slide-prog{display:flex;gap:8px;align-items:center}
    .prog-dot{width:28px;height:4px;border-radius:2px}
  </style></head><body>
  <div class="c">
    <div class="topbar"></div>
    <div class="grid"></div>
    <div class="slide-num">${String(slideIdx).padStart(2, '0')}</div>
    <div class="icon-box">${icon}</div>
    <div class="right">
      <div class="label">Slide ${slideIdx} of ${totalSlides - 2}</div>
      <div class="title">${slide.title ?? ''}</div>
      <div class="body">${slide.body ?? ''}</div>
      ${slide.visual ? `<div class="visual">${slide.visual}</div>` : ''}
    </div>
    <div class="footer">
      <span>${BRAND.name} · ${BRAND.website}</span>
      <div class="slide-prog">
        ${Array.from({ length: Math.min(totalSlides, 8) }, (_, i) =>
          `<div class="prog-dot" style="background:${i === slideIdx - 1 ? accent : 'rgba(255,255,255,0.15)'}"></div>`
        ).join('')}
      </div>
    </div>
  </div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// REEL FRAME HTML  (1080×1920, per scene)
// ─────────────────────────────────────────────────────────────────────────────
function buildReelFrameHtml(post: any, scene: any, sceneIdx: number, totalScenes: number, sitePhotoB64: string): string {
  const accent = SEG_COLOR[post.segment] ?? BRAND.blue;
  const progress = Math.round(((sceneIdx) / totalScenes) * 100);
  const sceneColors = [
    { bg: 'linear-gradient(180deg,#1a0808 0%,#0a0a0a 100%)', accent: '#ef4444' },
    { bg: `linear-gradient(180deg,${BRAND.dark} 0%,#0d1220 100%)`, accent: BRAND.blue },
    { bg: 'linear-gradient(180deg,#051a0e 0%,#0a1a10 100%)', accent: '#22c55e' },
    { bg: `linear-gradient(180deg,#0a0e1a 0%,${BRAND.dark} 100%)`, accent },
    { bg: 'linear-gradient(180deg,#1a1206 0%,#0a0a0a 100%)', accent: '#f59e0b' },
  ];
  const cp = sceneColors[sceneIdx % sceneColors.length];
  const textLen = (scene.textEn ?? '').length;
  const textSize = textLen > 60 ? '44px' : textLen > 40 ? '54px' : '64px';
  const hasPhoto = sitePhotoB64 && sceneIdx === 1; // Use real photo for scene 2 only

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:1080px;height:1920px;overflow:hidden;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif}
    .c{width:1080px;height:1920px;position:relative;overflow:hidden;
      background:${cp.bg};display:flex;flex-direction:column;align-items:center;justify-content:center}
    .bg-photo{position:absolute;inset:0;z-index:0}
    .bg-photo img{width:100%;height:100%;object-fit:cover;opacity:0.12}
    .bg-overlay{position:absolute;inset:0;z-index:1;background:rgba(10,14,26,0.85)}
    .grid{position:absolute;inset:0;z-index:2;
      background-image:linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),
        linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px);background-size:54px 54px}
    .progress-bar{position:absolute;top:0;left:0;height:8px;z-index:20;
      background:linear-gradient(90deg,${cp.accent},${BRAND.blue});
      width:${progress}%}
    .scene-badge{position:absolute;top:28px;right:36px;background:${cp.accent};color:#fff;
      font-size:14px;font-weight:800;padding:8px 18px;border-radius:20px;z-index:20;letter-spacing:1px}
    .logo-top{position:absolute;top:28px;left:36px;z-index:20;
      display:flex;align-items:center;gap:10px}
    .logo-top img{height:44px;width:auto}
    .logo-name{color:#fff;font-size:14px;font-weight:800}
    .logo-sub{color:${accent};font-size:9px;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px}

    /* Visual concept box */
    .visual-box{width:880px;max-height:360px;background:rgba(255,255,255,0.05);
      border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:32px;z-index:5;
      margin-bottom:48px;display:flex;align-items:center;justify-content:center;
      flex-direction:column;text-align:center;position:relative}
    .visual-icon{font-size:90px;margin-bottom:20px}
    .visual-desc{color:rgba(255,255,255,0.5);font-size:17px;line-height:1.6;font-style:italic;max-width:700px}

    /* Main text block */
    .text-block{width:940px;z-index:5;text-align:center;margin-bottom:36px}
    .text-en{color:#fff;font-size:${textSize};font-weight:900;line-height:1.15;
      letter-spacing:-1px;margin-bottom:20px}
    .text-en em{color:${cp.accent};font-style:normal}
    .text-hi{color:rgba(255,255,255,0.65);font-size:30px;font-weight:600;
      font-family:'Noto Sans Devanagari','Mangal',serif;line-height:1.4;margin-bottom:12px}
    .text-mr{color:rgba(255,255,255,0.5);font-size:26px;font-weight:500;
      font-family:'Noto Sans Devanagari','Mangal',serif;line-height:1.4}

    /* Transition label */
    .transition-label{position:absolute;bottom:160px;left:0;right:0;z-index:5;
      display:flex;justify-content:center}
    .transition-pill{background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);
      border-radius:20px;padding:10px 24px;color:rgba(255,255,255,0.4);font-size:14px;letter-spacing:1px}

    /* Footer */
    .footer{position:absolute;bottom:0;left:0;right:0;height:140px;z-index:10;
      background:rgba(0,0,0,0.5);border-top:1px solid rgba(255,255,255,0.08);
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
    .footer-contact{display:flex;gap:36px;color:rgba(255,255,255,0.7);font-size:20px;font-weight:500}
    .footer-hash{color:rgba(255,255,255,0.25);font-size:14px;letter-spacing:0.5px}
    .footer-progress{display:flex;gap:8px;margin-top:4px}
    .fp-dot{width:10px;height:10px;border-radius:50%}
  </style></head><body>
  <div class="c">
    ${hasPhoto ? `<div class="bg-photo"><img src="${sitePhotoB64}" /></div><div class="bg-overlay"></div>` : ''}
    <div class="grid"></div>
    <div class="progress-bar"></div>
    <div class="scene-badge">Scene ${sceneIdx + 1} / ${totalScenes}</div>
    <div class="logo-top">
      ${logoB64 ? `<img src="${logoB64}" />` : ''}
      <div><div class="logo-name">${BRAND.name}</div><div class="logo-sub">Solar · Maharashtra</div></div>
    </div>

    <!-- Visual concept mockup -->
    <div class="visual-box">
      <div class="visual-icon">${['☀️','⚡','💰','🏡','📊'][sceneIdx % 5]}</div>
      <div class="visual-desc">${scene.visual ?? ''}</div>
    </div>

    <!-- Text overlay -->
    <div class="text-block">
      <div class="text-en">${scene.textEn ?? ''}</div>
      ${scene.textHi ? `<div class="text-hi">${scene.textHi}</div>` : ''}
      ${scene.textMr ? `<div class="text-mr">${scene.textMr}</div>` : ''}
    </div>

    <!-- Transition -->
    <div class="transition-label">
      <div class="transition-pill">✦ ${scene.transition ?? 'Cut'}</div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-contact">
        <span>📞 ${BRAND.phone}</span>
        <span>🌐 ${BRAND.website}</span>
      </div>
      <div class="footer-hash">
        ${(post.hashtags ?? []).slice(0, 5).map((h: string) => `#${h}`).join('  ')}
      </div>
      <div class="footer-progress">
        ${Array.from({ length: totalScenes }, (_, i) =>
          `<div class="fp-dot" style="background:${i <= sceneIdx ? cp.accent : 'rgba(255,255,255,0.15)'}"></div>`
        ).join('')}
      </div>
    </div>
  </div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RENDERER
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 Solar Growth OS — Production Asset Renderer\n');
  console.log('   Company : Rolling Energy');
  console.log('   Phone   : ' + BRAND.phone);
  console.log('   Website : ' + BRAND.website);
  console.log('   Photos  : ' + sitePhotos.length + ' DJI drone shots loaded');
  console.log('   Logo    : ' + (logoB64 ? '✅ Loaded' : '❌ Not found'));
  console.log('');

  const token = await login();
  const r = await fetch(`${BASE}/social/posts?limit=50`, { headers: { Authorization: `Bearer ${token}` } });
  const { posts } = await r.json() as { posts: any[] };
  posts.sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());

  // Dynamically import puppeteer
  const puppeteer = await import('puppeteer');

  // Find Chrome executable — try system Chrome first, then puppeteer's downloaded version
  let executablePath: string | undefined;
  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const p of chromePaths) {
    if (existsSync(p)) { executablePath = p; break; }
  }
  // If not found, let puppeteer auto-detect its downloaded binary
  if (!executablePath) {
    try {
      const { executablePath: pExec } = await import('puppeteer');
      executablePath = pExec();
    } catch {}
  }

  console.log(`   Chrome  : ${executablePath ?? 'auto-detect'}\n`);

  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-web-security', '--allow-file-access-from-files'],
  });

  // Helper: write HTML to temp file and navigate to it (avoids base64 timeout)
  async function renderHtml(page: any, html: string, width: number, height: number): Promise<void> {
    const tmpFile = resolve(HTML_TMP, `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}.html`);
    writeFileSync(tmpFile, html, 'utf8');
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.goto(`file://${tmpFile}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(res => setTimeout(res, 200));
    try { unlinkSync(tmpFile); } catch {}
  }

  const jpgResults: string[] = [];
  const mp4Results: string[] = [];
  let photoIdx = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const dateStr = post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 10) : `post-${i + 1}`;
    const name = slug(i + 1, post.title, dateStr);
    const sitePhoto = sitePhotos[photoIdx % sitePhotos.length];

    // ── REEL → MP4 ───────────────────────────────────────────────────────────
    if (post.contentType === 'REEL') {
      console.log(`  🎬 [${String(i + 1).padStart(2, '0')}/31] REEL: ${post.title.slice(0, 50)}`);
      const spec = post.productionSpec ?? {};
      const rs = spec.reelScript ?? {};
      const scenes: any[] = rs.scenes ?? [];

      if (scenes.length === 0) {
        console.log(`      ⚠️  No scenes found — skipping`);
        continue;
      }

      const frameDir = resolve(FRAMES_TMP, name);
      mkdirSync(frameDir, { recursive: true });

      const page = await browser.newPage();

      // Render each scene for multiple frames (30fps × duration)
      let frameNum = 0;
      for (let si = 0; si < scenes.length; si++) {
        const scene = scenes[si];
        const dur = (scene.endSec - scene.startSec) || 4;
        const frameCount = Math.max(1, Math.round(dur * 30)); // 30fps
        const html = buildReelFrameHtml(post, scene, si, scenes.length, sitePhoto);

        await renderHtml(page, html, 1080, 1920);

        const screenshotBuf = Buffer.from(await page.screenshot({ type: 'png' }));
        // Write same frame N times to simulate duration
        for (let f = 0; f < frameCount; f++) {
          writeFileSync(resolve(frameDir, `frame${String(frameNum).padStart(6, '0')}.png`), screenshotBuf);
          frameNum++;
        }
        process.stdout.write(`      Scene ${si + 1}/${scenes.length} rendered (${dur}s = ${frameCount} frames)\n`);
      }
      await page.close();

      // Compose frames → MP4 with ffmpeg
      const mp4Path = resolve(OUT_MP4, `${name}.mp4`);
      const ffmpegCmd = `ffmpeg -y -framerate 30 -i "${resolve(frameDir, 'frame%06d.png')}" \
        -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:-1:-1:color=black" \
        -c:v libx264 -pix_fmt yuv420p -preset fast -crf 22 \
        -movflags +faststart "${mp4Path}" 2>/dev/null`;
      try {
        execSync(ffmpegCmd, { timeout: 120000 });
        const { statSync } = await import('fs');
        const sizeMb = (statSync(mp4Path).size / 1024 / 1024).toFixed(1);
        console.log(`      ✅ ${name}.mp4  (${sizeMb} MB)\n`);
        mp4Results.push(mp4Path);
      } catch (e) {
        console.log(`      ❌ ffmpeg failed: ${e}\n`);
      }

      // Clean up frames
      try { rmSync(frameDir, { recursive: true, force: true }); } catch {}
      photoIdx++;

    // ── CAROUSEL → JPG slides ─────────────────────────────────────────────
    } else if (post.contentType === 'CAROUSEL') {
      console.log(`  🎠 [${String(i + 1).padStart(2, '0')}/31] CAROUSEL: ${post.title.slice(0, 50)}`);
      const spec = post.productionSpec ?? {};
      const ds = spec.designSpec ?? {};
      const contentSlides: any[] = ds.slideDesign ?? [];
      const allSlides = ['cover', ...contentSlides, 'cta'];

      const page = await browser.newPage();

      const slideFiles: string[] = [];
      for (let si = 0; si < allSlides.length; si++) {
        const slide = typeof allSlides[si] === 'string' ? {} : allSlides[si];
        const html = buildCarouselSlideHtml(post, slide, si, allSlides.length);
        await renderHtml(page, html, 1080, 1080);
        const jpgPath = resolve(OUT_JPG, `${name}-slide${String(si + 1).padStart(2, '0')}.jpg`);
        const slideBuf = await page.screenshot({ type: 'jpeg', quality: 95 });
        writeFileSync(jpgPath, slideBuf);
        slideFiles.push(jpgPath);
        jpgResults.push(jpgPath);
      }
      await page.close();
      console.log(`      ✅ ${allSlides.length} slides saved\n`);
      photoIdx++;

    // ── STATIC POST → JPG ─────────────────────────────────────────────────
    } else {
      const icon = post.isNewsSlot ? '📰' : '🖼️';
      console.log(`  ${icon} [${String(i + 1).padStart(2, '0')}/31] STATIC: ${post.title.slice(0, 50)}`);

      const html = buildStaticHtml(post, sitePhoto);
      const page = await browser.newPage();
      await renderHtml(page, html, 1080, 1080);
      const jpgPath = resolve(OUT_JPG, `${name}.jpg`);
      const buf = await page.screenshot({ type: 'jpeg', quality: 96 });
      writeFileSync(jpgPath, buf);
      await page.close();
      jpgResults.push(jpgPath);
      console.log(`      ✅ ${name}.jpg\n`);
      if (!post.isNewsSlot) photoIdx++;
    }
  }

  await browser.close();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`\n✅  ALL PRODUCTION ASSETS GENERATED\n`);
  console.log(`   📂 JPG Folder:  ${OUT_JPG}`);
  console.log(`   📂 MP4 Folder:  ${OUT_MP4}`);
  console.log(`\n   🖼️  JPG files:  ${jpgResults.length}`);
  console.log(`   🎬 MP4 files:  ${mp4Results.length}`);
  console.log(`\n   Ready to share with designer / upload to Instagram / schedule in dashboard\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
