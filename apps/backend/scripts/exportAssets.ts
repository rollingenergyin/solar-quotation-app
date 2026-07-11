/**
 * Solar Growth OS — Final Asset Export
 * Fetches all 31 posts + production specs → writes ready-to-use asset pack
 * Run: tsx scripts/exportAssets.ts
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
const BASE = process.env.API_BASE ?? 'http://localhost:4000/api';

async function login() {
  const r = await fetch(`${BASE}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({emailOrUserId:'admin@solar.com',password:'Admin123!'}) });
  return ((await r.json()) as {token:string}).token;
}

async function main() {
  const token = await login();
  const r = await fetch(`${BASE}/social/posts?limit=50`, { headers:{Authorization:`Bearer ${token}`} });
  const { posts } = await r.json() as { posts: any[] };

  // sort by scheduledAt
  posts.sort((a,b) => new Date(a.scheduledAt??0).getTime() - new Date(b.scheduledAt??0).getTime());

  const lines: string[] = [];
  const json: any[] = [];

  lines.push('# SOLAR GROWTH OS — FINAL ASSET PACK');
  lines.push('# April 15 – May 15, 2026 | 31 Posts | Ready to Use');
  lines.push('# ═══════════════════════════════════════════════════════\n');

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const spec = p.productionSpec ?? {};
    const date = p.scheduledAt ? new Date(p.scheduledAt).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'}) : 'TBD';
    const time = p.scheduledAt ? new Date(p.scheduledAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'}) : '';
    const typeIcon = p.contentType==='REEL'?'🎬':p.contentType==='CAROUSEL'?'🎠':'🖼️';
    const newsTag = p.isNewsSlot ? ' 📰[NEWS SLOT]' : '';

    lines.push(`${'═'.repeat(70)}`);
    lines.push(`POST ${String(i+1).padStart(2,'0')} / 31  |  ${typeIcon} ${p.contentType.replace('_',' ')}${newsTag}`);
    lines.push(`DATE: ${date}  |  TIME: ${time} IST  |  SEGMENT: ${p.segment}`);
    lines.push(`TITLE: ${p.title}`);
    lines.push(`STATUS: ${p.status}  |  PLATFORMS: ${(p.platforms??[]).join(', ')}`);
    lines.push('');

    // ── CAPTIONS
    lines.push('── CAPTION [EN] ───────────────────────────────────────────────');
    lines.push(p.captionEn);
    lines.push('');
    lines.push('── CAPTION [HI] ───────────────────────────────────────────────');
    lines.push(p.captionHi || '(not set)');
    lines.push('');
    lines.push('── CAPTION [MR] ───────────────────────────────────────────────');
    lines.push(p.captionMr || '(not set)');
    lines.push('');

    // ── HASHTAGS
    const tags = (p.hashtags??[]).map((h:string) => `#${h}`).join(' ');
    lines.push('── HASHTAGS ────────────────────────────────────────────────────');
    lines.push(tags);
    lines.push('');

    // ── IMAGE PROMPT
    if (spec.imagePrompt?.prompt) {
      lines.push('── AI IMAGE PROMPT ─────────────────────────────────────────────');
      lines.push(`TOOL: ${spec.imagePrompt.tool ?? 'Midjourney v6 / DALL-E 3 / Ideogram v2'}`);
      lines.push(`PROMPT: ${spec.imagePrompt.prompt}`);
      if (spec.imagePrompt.negativePrompt) lines.push(`NEGATIVE: ${spec.imagePrompt.negativePrompt}`);
      if (spec.imagePrompt.style) lines.push(`STYLE: ${spec.imagePrompt.style}`);
      if (spec.imagePrompt.aspectRatio) lines.push(`ASPECT: ${spec.imagePrompt.aspectRatio}`);
      lines.push('');
    }

    // ── VIDEO PROMPT (reels)
    if (spec.videoPrompt?.prompt) {
      lines.push('── VIDEO GENERATION PROMPT ─────────────────────────────────────');
      lines.push(`TOOL: ${spec.videoPrompt.tool ?? 'Runway Gen-3 / Kling AI / Pika 2.0'}`);
      lines.push(`PROMPT: ${spec.videoPrompt.prompt}`);
      if (spec.videoPrompt.negativePrompt) lines.push(`NEGATIVE: ${spec.videoPrompt.negativePrompt}`);
      lines.push(`RESOLUTION: ${spec.videoPrompt.resolution??'1080x1920'} | FPS: ${spec.videoPrompt.fps??30} | DURATION: ${spec.videoPrompt.duration??''}`);
      lines.push('');
    }

    // ── REEL SCRIPT
    if (spec.reelScript?.scenes?.length) {
      lines.push('── REEL SCRIPT ─────────────────────────────────────────────────');
      lines.push(`TOTAL DURATION: ${spec.reelScript.totalDuration}`);
      for (const sc of spec.reelScript.scenes) {
        lines.push(`  [${sc.startSec}s–${sc.endSec}s] VISUAL: ${sc.visual}`);
        lines.push(`           EN: "${sc.textEn}"`);
        lines.push(`           HI: "${sc.textHi}"`);
        lines.push(`           MR: "${sc.textMr}"`);
        lines.push(`     TRANSITION: ${sc.transition}`);
      }
      if (spec.reelScript.exportNote) lines.push(`EXPORT: ${spec.reelScript.exportNote}`);
      lines.push('');
    }

    // ── AUDIO PLAN
    if (spec.audioPlan) {
      lines.push('── AUDIO PLAN ──────────────────────────────────────────────────');
      if (spec.audioPlan.style) lines.push(`STYLE: ${spec.audioPlan.style} | BPM: ${spec.audioPlan.bpm??'—'} | MOOD: ${spec.audioPlan.mood??'—'}`);
      const optA = spec.audioPlan.optionA;
      const optB = spec.audioPlan.optionB;
      if (optA) lines.push(`OPTION A (No voice): ${typeof optA==='string'?optA:(optA.description??optA.type??JSON.stringify(optA))}`);
      if (optB) lines.push(`OPTION B (Music): ${typeof optB==='string'?optB:(optB.description??optB.type??JSON.stringify(optB))}`);
      if (spec.audioPlan.source) lines.push(`SOURCE: ${spec.audioPlan.source}`);
      lines.push('');
    }

    // ── DESIGN SPEC
    if (spec.designSpec) {
      lines.push('── DESIGN SPEC ─────────────────────────────────────────────────');
      if (spec.designSpec.canvas) lines.push(`CANVAS: ${spec.designSpec.canvas}`);
      const layout = spec.designSpec.layout ?? {};
      if (layout.top) lines.push(`TOP: ${layout.top}`);
      if (layout.middle) lines.push(`MIDDLE: ${layout.middle}`);
      if (layout.bottom) lines.push(`BOTTOM: ${layout.bottom}`);
      if (spec.designSpec.background) lines.push(`BG: ${spec.designSpec.background}`);
      if (spec.designSpec.colorScheme) lines.push(`SCHEME: ${spec.designSpec.colorScheme}`);
      if (Array.isArray(spec.designSpec.dataPoints) && spec.designSpec.dataPoints.length) {
        lines.push(`DATA POINTS: ${spec.designSpec.dataPoints.join(' | ')}`);
      }
      lines.push('BRAND COLORS: #739bd6 (primary) | #161c34 (dark) | #000 | #fff');
      lines.push('FONTS: Poppins Bold (headline) | Inter (body) | Logo top-right');
      lines.push('');
    }

    // ── CAROUSEL SLIDES
    if (Array.isArray(spec.designSpec?.slideDesign) && spec.designSpec.slideDesign.length) {
      lines.push('── CAROUSEL SLIDES ─────────────────────────────────────────────');
      for (const sl of spec.designSpec.slideDesign as any[]) {
        lines.push(`  Slide ${sl.slideNumber??'?'}: [${sl.title}] ${sl.body} — Visual: ${sl.visual}`);
      }
      lines.push('');
    }

    // ── NEWS SLOT FALLBACK
    if (p.isNewsSlot) {
      lines.push('── NEWS SLOT RULE ──────────────────────────────────────────────');
      lines.push('FILL: Replace with trending solar/energy news 5 days before post date.');
      lines.push('FALLBACK: Use caption below if no news available.');
      lines.push('');
    }

    lines.push('');
    json.push({
      index: i + 1,
      id: p.id,
      date,
      time,
      type: p.contentType,
      segment: p.segment,
      isNewsSlot: p.isNewsSlot,
      platforms: p.platforms,
      title: p.title,
      captionEn: p.captionEn,
      captionHi: p.captionHi,
      captionMr: p.captionMr,
      hashtags: p.hashtags,
      hashtagsFormatted: tags,
      imagePrompt: spec.imagePrompt ?? null,
      videoPrompt: spec.videoPrompt ?? null,
      reelScript: spec.reelScript ?? null,
      audioPlan: spec.audioPlan ?? null,
      designSpec: spec.designSpec ?? null,
    });
  }

  lines.push('═'.repeat(70));
  lines.push('END OF ASSET PACK — Solar Growth OS — Apr 15–May 15, 2026');
  lines.push(`Generated: ${new Date().toISOString()}`);

  const txtPath = resolve(__dirname, '../solar-content-assets.txt');
  const jsonPath = resolve(__dirname, '../solar-content-assets.json');

  writeFileSync(txtPath, lines.join('\n'), 'utf8');
  writeFileSync(jsonPath, JSON.stringify(json, null, 2), 'utf8');

  console.log(`\n✅ Asset pack exported:`);
  console.log(`   📄 Text: ${txtPath}`);
  console.log(`   📦 JSON: ${jsonPath}`);
  console.log(`   📊 Posts: ${posts.length}`);
  console.log(`   📝 Lines: ${lines.length}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
