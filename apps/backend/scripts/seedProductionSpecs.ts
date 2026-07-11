/**
 * Solar Growth OS — Production Spec Seeder
 *
 * Patches all 31 calendar posts with full production-ready specs:
 *   • AI Image Generation Prompts (Midjourney / DALL-E / Ideogram compatible)
 *   • Video Generation Prompts (Runway / Kling / Pika compatible)
 *   • Design Specs (layout, typography, color zones)
 *   • Reel Scripts (scene-by-scene with timing)
 *   • Audio Plans (music type, BPM, mood)
 *
 * Run: tsx scripts/seedProductionSpecs.ts
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const BASE = process.env.API_BASE ?? 'http://localhost:4000/api';

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUserId: 'admin@solar.com', password: 'Admin123!' }),
  });
  if (!res.ok) throw new Error(`Login failed: ${await res.text()}`);
  return ((await res.json()) as { token: string }).token;
}

async function getPosts(token: string) {
  const res = await fetch(`${BASE}/social/posts?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json() as { posts: Array<{ id: string; title: string; contentType: string; scheduledAt: string }> };
  return data.posts;
}

async function patchProductionSpec(token: string, postId: string, spec: unknown) {
  const res = await fetch(`${BASE}/social/posts/${postId}/production`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ productionSpec: spec, changeNote: 'Production specs added by seeder', editedBy: 'system' }),
  });
  if (!res.ok) { console.error(`  ✗ Patch failed for ${postId}: ${await res.text()}`); return null; }
  return await res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION SPEC TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

/** Brand constants injected in every spec */
const BRAND = {
  colors: { primary: '#739bd6', dark: '#161c34', black: '#000000', white: '#ffffff' },
  logo: 'Rolling Energy logo — top-right corner, 80px wide, white version on dark bg',
  footer: 'Footer bar (#161c34): Phone [Phone] | Website: rollingenergy.in | Logo small',
  fonts: { headline: 'Poppins Bold / Montserrat ExtraBold', body: 'Inter / DM Sans', accent: 'Poppins SemiBold' },
};

function staticPostSpec(opts: {
  headline: string;
  subtext: string;
  imagePromptEn: string;
  colorScheme: 'dark' | 'light' | 'gradient';
  dataPoints?: string[];
}) {
  return {
    type: 'STATIC_POST',
    brand: BRAND,
    designSpec: {
      canvas: '1080x1080px (square) | 1080x1350px (portrait) for Reel cover',
      colorScheme: opts.colorScheme,
      layout: {
        top: 'Logo (top-right) + Category pill (top-left, #739bd6 bg, white text)',
        middle: `Hero visual (60% of canvas height). Text overlay: "${opts.headline}" in Poppins Bold, 48–56px, white`,
        bottom: `Subtext: "${opts.subtext}" in Inter 20px. CTA bar with phone + website.`,
      },
      background: opts.colorScheme === 'dark' ? '#161c34 gradient to #0a1020' : '#f0f5ff to #ffffff',
      textPlacement: 'Left-aligned text block with 40px left padding. Semi-transparent overlay behind text (#000 at 40% opacity).',
      dataPoints: opts.dataPoints ?? [],
      ctaButton: { text: 'Get Free Quote →', bg: '#739bd6', textColor: '#ffffff', radius: '8px', padding: '12px 24px' },
      fonts: BRAND.fonts,
      logoPlacement: BRAND.logo,
      footer: BRAND.footer,
    },
    imagePrompt: {
      tool: 'Midjourney v6 / DALL-E 3 / Ideogram v2',
      prompt: opts.imagePromptEn,
      negativePrompt: 'human faces, people, low quality, blurry, watermark, text, cluttered',
      style: 'Clean, modern, professional, photorealistic + graphic hybrid, India context',
      aspectRatio: '1:1 (square) or 4:5 (portrait)',
    },
    audioPlan: null, // Static posts: no audio
    reelScript: null,
  };
}

function carouselSpec(opts: {
  coverHeadline: string;
  slides: Array<{ title: string; body: string; visual: string }>;
  imagePromptEn: string;
  audioBpm?: number;
}) {
  return {
    type: 'CAROUSEL',
    brand: BRAND,
    designSpec: {
      canvas: '1080x1080px per slide',
      slideCount: opts.slides.length + 2, // cover + content slides + CTA slide
      layout: {
        cover: `Full bleed hero image. "${opts.coverHeadline}" in Poppins Bold 52px, white. "Swipe →" chevron bottom-right.`,
        contentSlides: 'Left: icon/visual (40%). Right: text block (60%). Slide number: top-right circle.',
        ctaSlide: 'Full brand color (#161c34). CTA: "Get Free Quote" button. Phone + website.',
      },
      slideDesign: opts.slides.map((s, i) => ({
        slideNumber: i + 2,
        title: s.title,
        body: s.body,
        visual: s.visual,
        bgColor: i % 2 === 0 ? '#161c34' : '#ffffff',
        textColor: i % 2 === 0 ? '#ffffff' : '#161c34',
        accentColor: '#739bd6',
      })),
      swipeIndicator: 'Bottom-center: dots progress indicator. Each slide: "Swipe for more →" subtle text.',
      fonts: BRAND.fonts,
      logoPlacement: BRAND.logo,
      footer: BRAND.footer,
    },
    imagePrompt: {
      tool: 'Midjourney v6 / DALL-E 3',
      prompt: opts.imagePromptEn,
      negativePrompt: 'human faces, people, text, watermark',
      style: 'Flat illustration / infographic style, brand colors',
      aspectRatio: '1:1',
    },
    audioPlan: {
      style: 'Upbeat corporate ambient',
      bpm: opts.audioBpm ?? 110,
      mood: 'Optimistic, data-driven',
      optionA: 'No audio — carousel viewed in feed silently',
      optionB: 'Background: Acoustic guitar loop, 110 BPM, major key, no lyrics',
      source: 'Epidemic Sound / Artlist: search "corporate upbeat" or "tech optimistic"',
    },
    reelScript: null,
  };
}

function reelSpec(opts: {
  title: string;
  durationSec: number;
  scenes: Array<{ startSec: number; endSec: number; visual: string; textEn: string; textHi: string; textMr: string; transition: string; }>;
  videoPromptEn: string;
  audioBpm: number;
  audioStyle: string;
  audioMood: string;
}) {
  return {
    type: 'REEL',
    brand: BRAND,
    designSpec: {
      canvas: '1080x1920px (9:16 vertical)',
      duration: `${opts.durationSec} seconds`,
      safeZone: 'Keep text within 150px from edges. Bottom 200px reserved for Instagram captions/buttons.',
      textStyle: 'Kinetic typography — text animates in per word, white with drop shadow',
      fonts: BRAND.fonts,
      logoPlacement: 'Logo: bottom-right, 70px wide, white, last 5 seconds visible',
      footer: BRAND.footer,
      colorOverlay: 'Semi-transparent gradient overlay: #161c34 at 50% from bottom',
    },
    reelScript: {
      title: opts.title,
      totalDuration: `${opts.durationSec}s`,
      scenes: opts.scenes,
      exportNote: 'Export: MP4 H.264, 1080x1920, 30fps, stereo audio, max 90s for Reels',
    },
    videoPrompt: {
      tool: 'Runway Gen-3 / Kling AI / Pika 2.0',
      prompt: opts.videoPromptEn,
      negativePrompt: 'human faces, people, logos of competitors, explicit content',
      style: 'Motion graphics, kinetic text, infographic animation, clean modern',
      resolution: '1080x1920 (9:16)',
      fps: 30,
      duration: `${opts.durationSec}s`,
    },
    audioPlan: {
      style: opts.audioStyle,
      bpm: opts.audioBpm,
      mood: opts.audioMood,
      optionA: {
        type: 'Text-only kinetic',
        description: 'No voiceover. Beat-synced text animations. Text appears on each beat.',
        execution: `Use After Effects / CapCut: Beat markers at every ${Math.round(60 / opts.audioBpm * 1000)}ms`,
      },
      optionB: {
        type: 'Background music',
        description: `${opts.audioStyle} track, ${opts.audioBpm} BPM`,
        source: `Epidemic Sound / Artlist: search "${opts.audioMood}" — no lyrics, royalty-free`,
        mixing: 'Music at -18dB under any motion graphic sound effects',
      },
    },
    imagePrompt: {
      tool: 'Midjourney v6 (for thumbnail/cover frame)',
      prompt: opts.videoPromptEn,
      negativePrompt: 'human faces, people, text, blurry',
      style: 'Motion graphic still frame, cinematic, clean',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION SPEC MAP — keyed by title substring for matching
// ─────────────────────────────────────────────────────────────────────────────

const SPEC_MAP: Record<string, unknown> = {

  // APR 15 — Static Post: Summer Is Here
  'Summer is Here': staticPostSpec({
    headline: 'Summer Electricity Bills are RISING',
    subtext: 'Go Solar. Pay ₹0 from Month 1.',
    colorScheme: 'dark',
    dataPoints: ['₹4,500–₹8,000/month avg savings', 'Up to ₹78,000 govt subsidy', 'Installation: 3–5 days'],
    imagePromptEn: 'Aerial view of an Indian residential neighborhood in summer heat, rooftops glowing with solar panels, warm golden sunlight, haze of heat visible, electricity meter in foreground with rupee symbol, photorealistic, no people, clean modern style, India suburbs, Maharashtra atmosphere',
  }),

  // APR 16 — News Slot
  '🗞️ RESERVED FOR NEWS — Solar / Energy / MSEDCL Updates': staticPostSpec({
    headline: '[NEWS] Solar Energy Update',
    subtext: 'Breaking: Latest updates for Maharashtra solar users',
    colorScheme: 'dark',
    imagePromptEn: 'Breaking news style graphic with solar panels and electricity grid, Maharashtra skyline at sunset, abstract glowing energy lines, news bulletin aesthetic, no people, brand colors #739bd6 and #161c34, modern infographic style',
  }),

  // APR 17 — Carousel: 5 Things
  '5 Things That Happen': carouselSpec({
    coverHeadline: '5 Things That Happen When You Go Solar',
    imagePromptEn: 'Flat vector illustration of an Indian home with solar panels on rooftop, sun shining, energy flow arrows, minimalist infographic style, brand colors #739bd6 navy blue and white, no people, modern clean design',
    audioBpm: 112,
    slides: [
      { title: 'Day 1: Meter Spins Backward', body: 'Your net meter starts exporting excess units back to MSEDCL', visual: 'Animated electricity meter counter going down' },
      { title: 'Month 1: Your First Zero Bill', body: 'Average ₹0–₹200 bill instead of ₹5,000+', visual: 'Electricity bill showing ₹0 in green' },
      { title: 'Year 1: ₹50,000+ Saved', body: 'Real savings start compounding immediately', visual: 'Money bag with upward growth arrow' },
      { title: 'Year 4: Break-Even Point', body: 'System has paid itself back. 21 years of FREE electricity', visual: 'Scales/balance tipping to solar side' },
      { title: 'Year 25: ₹30 Lakh+ Net Gain', body: 'Solar transforms into your best long-term investment', visual: 'Trophy with solar panel icon' },
    ],
  }),

  // APR 18 — Reel: Pune Family Saves
  'Pune Family Saves': reelSpec({
    title: 'Before vs After Solar — Pune Family Story',
    durationSec: 30,
    videoPromptEn: 'Cinematic animation of Indian suburban house, before state shows dark sky and large electricity bill, dramatic transition to after state with bright solar panels on rooftop, sunshine, energy meter going to zero, clean motion graphic style, India context, no people, 9:16 vertical format, brand colors navy blue and light blue',
    audioBpm: 120,
    audioStyle: 'Uplifting corporate pop',
    audioMood: 'inspiring hopeful transformation',
    scenes: [
      { startSec: 0, endSec: 4, visual: 'Electricity bill animation — counter filling up to ₹6,200 in red. Stress emoji icon.', textEn: '₹6,200 electricity bill. Every. Single. Month.', textHi: '₹6,200 का बिजली बिल। हर महीने।', textMr: '₹6,200 वीज बिल. दर महिना.', transition: 'None — cold open for attention' },
      { startSec: 4, endSec: 10, visual: 'Calendar flip animation: "Installation Day" text with solar panel icons appearing on rooftop aerial view. Tools/wrench icon.', textEn: 'Then they installed solar.', textHi: 'फिर उन्होंने सोलर लगाया।', textMr: 'मग त्यांनी सोलर लावले.', transition: 'Wipe left' },
      { startSec: 10, endSec: 20, visual: 'Solar panels on rooftop animation, sun rising, energy bars filling green. Electricity meter spinning backwards fast.', textEn: '5 kW system. 22 panels. Day 1 savings begin.', textHi: '5 kW सिस्टम। 22 पैनल। Day 1 से बचत।', textMr: '5 kW सिस्टम. 22 पॅनेल. Day 1 पासून बचत.', transition: 'Zoom in on meter' },
      { startSec: 20, endSec: 27, visual: 'Large counter animation: bill amount counts DOWN from ₹6,200 → ₹800. Savings counter UP: ₹5,400/month. Annual: ₹64,800.', textEn: 'Bill: ₹800. Savings: ₹5,400/month 🎉', textHi: 'बिल: ₹800। बचत: ₹5,400/महीना 🎉', textMr: 'बिल: ₹800. बचत: ₹5,400/महिना 🎉', transition: 'Bounce scale' },
      { startSec: 27, endSec: 30, visual: 'Rolling Energy logo. Phone number. Website. "Comment SOLAR for free quote" CTA.', textEn: 'Want the same? Comment "SOLAR" 👇', textHi: 'यही चाहते हैं? "SOLAR" कमेंट करें 👇', textMr: 'हेच हवे? "SOLAR" कमेंट करा 👇', transition: 'Fade in' },
    ],
  }),

  // APR 19 — Static: Commercial Tax
  'Commercial Solar: 40%': staticPostSpec({
    headline: '40% Tax Depreciation on Solar — Save More',
    subtext: 'Section 32 benefit: Your ₹20L system effectively costs ₹14.4L',
    colorScheme: 'dark',
    dataPoints: ['40% Accelerated Depreciation Year 1', '₹5.6L tax benefit on ₹20L system', 'ROI: 2.5–3.5 years'],
    imagePromptEn: 'Professional business infographic visual of a modern commercial building in India with solar panels on rooftop, income tax documents in foreground, Indian rupee symbols, calculator, business district atmosphere, no people, clean corporate style, dark navy background with blue accents',
  }),

  // APR 20 — Static: Society Solar
  'Housing Society Solar': staticPostSpec({
    headline: 'Is Your Society Still Paying ₹2L/Month?',
    subtext: '80% bill reduction available. Zero upfront with RESCO model.',
    colorScheme: 'dark',
    dataPoints: ['₹40K–₹2L/month saved', 'RESCO: ₹0 upfront', '25 societies done in Pune/Mumbai/Nashik'],
    imagePromptEn: 'Aerial view of a large Indian residential housing society with multiple rooftops covered with solar panels, blue sky, urban Maharashtra setting, electricity grid visible transforming to clean solar, no people, clean modern infographic overlay, brand colors #739bd6 and navy',
  }),

  // APR 21 — News Slot
  '🗞️ RESERVED FOR NEWS — Government Solar Policy': staticPostSpec({
    headline: '[NEWS] Government Solar Policy Update',
    subtext: 'PM Surya Ghar — Latest news for Maharashtra',
    colorScheme: 'dark',
    imagePromptEn: 'Government policy announcement style graphic, Indian parliament building silhouette with solar panels, official document visual, PM Surya Ghar scheme logo placeholder, India flag colors subtle, no people, modern news graphic style, brand colors navy and light blue',
  }),

  // APR 22 — Carousel: Earth Day
  '🌍 Earth Day': carouselSpec({
    coverHeadline: 'Rolling Energy Earth Day Report 2026',
    imagePromptEn: 'Earth Day illustration, planet Earth with solar panels orbiting, green energy transformation, Maharashtra India highlighted, environmental data visualization, clean modern graphic, no people, green and navy color palette with brand blue accents',
    audioBpm: 95,
    slides: [
      { title: 'X MW Solar Installed', body: 'Total capacity commissioned by Rolling Energy team', visual: 'Power station / electrical grid illustration with green energy flowing' },
      { title: 'X Lakh kg CO2 Prevented', body: 'Every unit of solar = less carbon', visual: 'Cloud with CO2 molecule crossed out. Clean air graphic.' },
      { title: 'X Crore Units of Clean Energy', body: 'Generated across all our installations this year', visual: 'Sun icon with energy bolt, counter animation' },
      { title: 'Equivalent to X Trees Planted', body: 'Our solar installations offset this much forest', visual: 'Forest of trees with solar panels. Nature + tech fusion.' },
      { title: 'Join the Mission', body: 'Every rooftop matters. Make yours count.', visual: 'Rooftop with sunrise. Call to action.' },
    ],
  }),

  // APR 23 — News Slot
  '🗞️ RESERVED FOR NEWS — Solar Industry': staticPostSpec({
    headline: '[NEWS] Solar Industry Update — Maharashtra',
    subtext: 'Latest renewable energy milestones and policy updates',
    colorScheme: 'dark',
    imagePromptEn: 'Solar industry news graphic, large solar farm in Maharashtra landscape, data charts overlaid, electricity grid with solar generation, India renewable energy milestone visual, no people, modern business news style, navy and blue color scheme',
  }),

  // APR 24 — Carousel: Industrial Solar
  'How Industrial Units Save': carouselSpec({
    coverHeadline: 'Industrial Solar: Save ₹50,000/Month',
    imagePromptEn: 'Large industrial factory in Maharashtra with massive solar panel array on rooftop, MIDC industrial area, energy cost comparison graphic overlay, no people, aerial drone style illustration, brand colors, modern industrial photography style without people',
    audioBpm: 108,
    slides: [
      { title: 'Grid Rate: ₹8–12/Unit', body: 'HT connection users pay premium rates. It adds up fast.', visual: 'Power grid icon with ₹12/unit price tag in red' },
      { title: 'Solar Rate: ₹1.8–2.5/Unit', body: 'Effective cost over 25 years — 75% cheaper', visual: 'Solar panel icon with ₹2/unit in green' },
      { title: '500 kW = ₹50L/Year Saved', body: 'Real data from our industrial installations in MIDC', visual: 'Factory + savings calculator graphic' },
      { title: '40% Tax Depreciation', body: 'Section 32 benefit makes the investment even better', visual: 'Tax document with green checkmark' },
      { title: 'Free Energy Audit', body: 'We assess your factory and show exact savings', visual: 'Factory blueprint with solar overlay' },
    ],
  }),

  // APR 25 — Static: Project Showcase
  '🔨 Project Showcase': staticPostSpec({
    headline: '75 kW Commercial Solar — Hadapsar, Pune ✅',
    subtext: '₹72,000 saved monthly | 3.2-year payback | 25yr guarantee',
    colorScheme: 'dark',
    dataPoints: ['300 units/day generated', '₹8.6L annual savings', 'MSEDCL certified'],
    imagePromptEn: 'Professional photography style illustration of a large commercial building in Hadapsar Pune with 75kW solar panel array on rooftop, aerial perspective, data overlay showing project statistics, clean morning light, no people, photorealistic rendered style, proud achievement visual',
  }),

  // APR 26 — Reel: Net Metering
  'Net Metering Explained': reelSpec({
    title: 'How Net Metering Works — Animated',
    durationSec: 45,
    videoPromptEn: 'Clean animation of Indian suburban house with solar panels, energy flow arrows showing electricity going from panels to house and excess flowing back into power grid, MSEDCL meter visual, day/night cycle animation, credit system visualization, no people, modern motion graphic style, 9:16 format, navy blue and light blue color scheme',
    audioBpm: 105,
    audioStyle: 'Educational explainer ambient',
    audioMood: 'calm informative positive',
    scenes: [
      { startSec: 0, endSec: 5, visual: 'House with solar panels illustration. Sun appears. Question mark: "Who pays you for extra electricity?"', textEn: 'Your solar produces MORE than you need. Then what?', textHi: 'आपका सोलर ज़रूरत से ज़्यादा बिजली बनाता है। फिर क्या?', textMr: 'तुमचे सोलर गरजेपेक्षा जास्त वीज बनवते. मग काय?', transition: 'None — hook question' },
      { startSec: 5, endSec: 15, visual: 'Animated energy flow: panels → house (house icons lighting up). Excess energy shown as overflow arrow → MSEDCL grid icon.', textEn: 'Step 1: Panels power your home first.', textHi: 'Step 1: पैनल पहले आपके घर को बिजली देते हैं।', textMr: 'Step 1: पॅनेल प्रथम तुमच्या घराला वीज देतात.', transition: 'Flow animation right' },
      { startSec: 15, endSec: 28, visual: 'MSEDCL grid receives excess units. Credit counter adds up. "Units Exported: 127" shown as ledger. MSEDCL logo placeholder.', textEn: 'Step 2: Extra units flow TO the grid. MSEDCL credits you.', textHi: 'Step 2: अतिरिक्त यूनिट ग्रिड में जाती हैं। MSEDCL क्रेडिट देता है।', textMr: 'Step 2: जास्तीचे युनिट ग्रिडकडे जातात. MSEDCL तुम्हाला क्रेडिट देते.', transition: 'Slide up' },
      { startSec: 28, endSec: 40, visual: 'Month-end calculation: Units consumed 280 MINUS Units exported 127 = NET 153 units billed. Bill amount: ₹250 instead of ₹2,800.', textEn: 'Step 3: You pay only the NET difference at month end!', textHi: 'Step 3: महीने के अंत में सिर्फ NET अंतर चुकाएं!', textMr: 'Step 3: महिन्याच्या शेवटी फक्त निव्वळ फरक भरा!', transition: 'Calculator animation' },
      { startSec: 40, endSec: 45, visual: 'Zero or negative bill. Celebration graphic. Rolling Energy logo. "We handle the net meter application — FREE"', textEn: 'Net Metering = Your solar works 24/7. Even at night!', textHi: 'नेट मीटरिंग = आपका सोलर 24/7 काम करता है!', textMr: 'नेट मीटरिंग = तुमचे सोलर 24/7 काम करते!', transition: 'Fade to brand screen' },
    ],
  }),

  // APR 27 — Static: Book Before May
  'Book Solar Before May': staticPostSpec({
    headline: '⚠️ Solar Prices Increasing in June',
    subtext: 'Lock current pricing today. Only 12 slots left.',
    colorScheme: 'dark',
    dataPoints: ['Current: ₹3.02L after subsidy (5kW)', 'June price revision expected', '12 slots remaining'],
    imagePromptEn: 'Urgency-style Indian solar business graphic, calendar showing April/May dates, price lock icon, solar panels in background, countdown clock motif, red warning elements with brand navy, no people, modern marketing style, rupee symbols, scarcity visual',
  }),

  // APR 28 — News Slot
  '🗞️ RESERVED FOR NEWS — Maharashtra Electricity': staticPostSpec({
    headline: '[NEWS] Maharashtra Solar Policy Update',
    subtext: 'Latest developments for housing societies and homeowners',
    colorScheme: 'dark',
    imagePromptEn: 'Maharashtra state government policy graphic, Pune city skyline with solar panels, official announcement style, building permits visual, policy document, no people, clean corporate news graphic, brand colors navy and blue',
  }),

  // APR 29 — Carousel: Society Case Studies
  '5 Pune Societies': carouselSpec({
    coverHeadline: '5 Societies That Slashed Their Bill by 85%',
    imagePromptEn: 'Aerial illustration of Pune residential society complex with solar panels covering multiple rooftops, RESCO model visual, Maharashtra cityscape, before/after comparison, no people, modern infographic style, brand colors navy blue and white',
    audioBpm: 105,
    slides: [
      { title: 'Society 1 — Baner, Pune', body: 'Before: ₹95,000/month → After: ₹14,000/month. 200 kW system.', visual: 'Society rooftop aerial, bill comparison chart' },
      { title: 'Society 2 — Kothrud, Pune', body: 'RESCO model: ₹0 investment. Saving ₹60,000/month from Day 1.', visual: 'Zero investment badge with savings counter' },
      { title: 'Society 3 — Nashik Road', body: '48 apartments. 80 kW. Monthly bill: ₹8,500 (was ₹47,000).', visual: 'Apartment complex with solar, Maharashtra map pin' },
      { title: 'Society 4 — Mumbai Suburbs', body: 'Lift + pump + lighting powered by solar. ₹72,000 saved/month.', visual: 'Common area illustration with solar-powered amenities' },
      { title: 'Your Society Next?', body: 'Free presentation for your committee. We handle everything.', visual: 'Society secretary + solar presentation illustration (no face, just icons)' },
    ],
  }),

  // APR 30 — Static: Ground Mount
  'Ground Mount Solar: Turn': staticPostSpec({
    headline: 'Earn ₹50,000/Acre/Year from Your Land',
    subtext: 'Agri-Voltaics: Solar + farming on the same land',
    colorScheme: 'dark',
    dataPoints: ['₹35K–₹60K/acre/year passive income', 'Farm below, solar above', '25-year PPA available'],
    imagePromptEn: 'Aerial view of Indian agricultural land with ground-mounted solar panels installed between crop rows, Maharashtra farmland landscape, golden hour lighting, agri-voltaic system, green crops visible below solar panels, no people, photorealistic rendered, serene rural atmosphere',
  }),

  // MAY 1 — Static: Maharashtra Day
  'Happy Maharashtra Day': staticPostSpec({
    headline: 'Happy Maharashtra Day! ☀️',
    subtext: 'Proud to power Maharashtra — one rooftop at a time',
    colorScheme: 'gradient',
    imagePromptEn: 'Maharashtra Day celebration graphic, Maharashtra state map with solar panels, orange and green Maharashtra colors with brand navy, Sahyadri mountains in background, sunrise over Maharashtra with solar energy rays, patriotic celebration visual, no people, clean festive design, Maharashtra pride',
  }),

  // MAY 2 — Reel: Before vs After
  'Before vs After Solar — Animated': reelSpec({
    title: 'Before vs After Solar — Animated Bill Comparison',
    durationSec: 30,
    videoPromptEn: 'Clean animation comparison: left side shows Indian house with large electricity bill in red, dark cloudy sky; right side transforms to same house with solar panels, bright sun, green bill showing zero, dramatic transformation animation, motion graphics style, 9:16 vertical format, no people, brand colors navy blue and light blue',
    audioBpm: 124,
    audioStyle: 'Dramatic transformation reveal',
    audioMood: 'surprise reveal uplifting triumph',
    scenes: [
      { startSec: 0, endSec: 6, visual: 'Split screen appears. Left: "BEFORE" text in white. Bill envelope opening, red number ₹7,800 fills screen.', textEn: 'June 2025. Electricity bill: ₹7,800 😰', textHi: 'जून 2025. बिजली बिल: ₹7,800 😰', textMr: 'जून 2025. वीज बिल: ₹7,800 😰', transition: 'None — shock value open' },
      { startSec: 6, endSec: 14, visual: 'Calendar animation: "Rolling Energy Installation". Solar panels appearing on rooftop time-lapse style. 3 days to install.', textEn: 'Then: Rolling Energy Solar Installed ☀️', textHi: 'फिर: Rolling Energy सोलर लगाया ☀️', textMr: 'मग: Rolling Energy सोलर बसवले ☀️', transition: 'Page flip / calendar turn' },
      { startSec: 14, endSec: 23, visual: '"AFTER" reveals. Same house, bright sun, solar panels glowing. New bill envelope opens. Counter drops: ₹7,800 → ₹7,000 → ₹3,000 → ₹0', textEn: 'June 2026. Same house. Same AC. New bill: ₹0 🎉', textHi: 'जून 2026. वही घर। वही AC। नया बिल: ₹0 🎉', textMr: 'जून 2026. तेच घर. तोच AC. नवे बिल: ₹0 🎉', transition: 'Dramatic reveal wipe' },
      { startSec: 23, endSec: 30, visual: 'Annual savings calculation: 12 × ₹7,800 = ₹93,600 per year. 25 years. Logo. Phone. Website.', textEn: 'Your turn! Comment "QUOTE" for free estimate 👇', textHi: 'आपकी बारी! "QUOTE" कमेंट करें 👇', textMr: 'तुमची वेळ! "QUOTE" कमेंट करा 👇', transition: 'Bounce scale + confetti' },
    ],
  }),

  // MAY 3 — Static: Warranty Promise
  '25-Year Warranty': staticPostSpec({
    headline: '25 Years. Zero Compromises.',
    subtext: 'Tier-1 panels. Certified installers. Life-long support.',
    colorScheme: 'dark',
    dataPoints: ['25yr panel warranty', '10yr inverter warranty', '5yr workmanship', '24/7 app monitoring'],
    imagePromptEn: 'Premium trust and quality visual, large shield icon with solar panel inside, certificate documents, quality assurance badges, dark navy background with gold and blue accents, luxury professional aesthetic, trust symbols, Indian solar market, no people, premium brand style',
  }),

  // MAY 4 — Static: May Bill Reality Check
  'Electricity Bill Reality Check': staticPostSpec({
    headline: 'May in Maharashtra: Bills at ₹12,000+',
    subtext: 'This happens every summer. Solar ends it permanently.',
    colorScheme: 'dark',
    dataPoints: ['38–44°C average May temp', 'AC: 8–12 hrs/day', '+18% tariff hike this year'],
    imagePromptEn: 'Data-driven infographic, thermometer showing 42°C, Maharashtra summer heat visualization, electricity meter spiking upward, heat wave visual elements, rupee symbols rising, calendar showing May, no people, urgent data visualization style, red and navy color scheme, Indian summer atmosphere',
  }),

  // MAY 5 — News Slot
  '🗞️ RESERVED FOR NEWS — Solar Tech': staticPostSpec({
    headline: '[NEWS] Maharashtra Renewable Energy Milestone',
    subtext: 'Record solar capacity installed — what it means for you',
    colorScheme: 'dark',
    imagePromptEn: 'Maharashtra solar industry milestone graphic, record achievement visual, solar farm and rooftop combined, growth chart, Maharashtra state outline, clean energy achievement, news announcement style, no people, brand colors with achievement gold accents',
  }),

  // MAY 6 — Carousel: Top 5 Industries
  'Top 5 Industries Switching': carouselSpec({
    coverHeadline: 'Top 5 Industries Going Solar in Maharashtra',
    imagePromptEn: 'Industrial Maharashtra landscape with multiple factories and large solar panel arrays, MIDC Pune industrial area, aerial perspective, manufacturing facilities with solar, clean energy transformation, no people, professional industrial photography style, brand colors',
    audioBpm: 115,
    slides: [
      { title: '#1 Textile Industry', body: 'Looms running 24/7 = massive power bills. Solar saves ₹8Cr/year for large mills.', visual: 'Textile factory exterior with solar panels, fabric bolt icon' },
      { title: '#2 Food Processing', body: 'Refrigeration + processing = constant load. Solar provides stable cheap power.', visual: 'Food plant exterior + solar array, fork/factory icon' },
      { title: '#3 Pharma & Chemical', body: 'Clean power for GMP compliance. Section 32 tax benefit maximized.', visual: 'Chemical plant exterior, pharmaceutical bottle icons' },
      { title: '#4 Engineering & Auto Parts', body: 'CNC, welding, presses — heavy loads. ₹4–6Cr/year savings for 1MW+ systems.', visual: 'Engineering workshop exterior, gear + solar icon' },
      { title: '#5 Cold Storage & Logistics', body: 'Constant refrigeration load perfectly matched to daytime solar.', visual: 'Warehouse with solar, snowflake + sun icon' },
    ],
  }),

  // MAY 7 — News Slot
  '🗞️ RESERVED FOR NEWS — MSEDCL': staticPostSpec({
    headline: '[NEWS] MSEDCL Net Metering Update',
    subtext: 'Process changes, timelines, and what it means for solar owners',
    colorScheme: 'dark',
    imagePromptEn: 'MSEDCL process update graphic, smart electricity meter visual, Maharashtra power grid, net metering approval process flowchart style, official documentation visual, no people, clean informational graphic, brand navy and blue colors',
  }),

  // MAY 8 — Static: Urgent Slots
  'URGENT: Only 8': staticPostSpec({
    headline: '🚨 Only 8 Installation Slots Left for May',
    subtext: 'Each day you delay = ₹167 wasted (based on ₹5,000/month bill)',
    colorScheme: 'dark',
    dataPoints: ['8/20 slots remaining', 'PM Surya Ghar subsidy: ₹78,000', 'Installed in 7–10 days'],
    imagePromptEn: 'Scarcity urgency marketing visual, calendar with slots being crossed out, countdown clock, solar panels in background, red warning elements, limited availability graphic, Indian marketing style, no people, strong CTA visual design, brand colors with urgency red accents',
  }),

  // MAY 9 — Reel: First Day with Solar
  'Your First Day with Solar': reelSpec({
    title: 'Your First Day with Solar — Day 1 Walkthrough',
    durationSec: 45,
    videoPromptEn: 'Time-lapse animation of Indian house from sunrise to sunset with solar panels, energy generation visualization throughout the day, sun arc across sky, energy meter tracking generation and consumption, evening grid switch, informational motion graphic, 9:16 format, no people, clean modern animation style, brand colors blue and navy',
    audioBpm: 100,
    audioStyle: 'Positive educational explainer',
    audioMood: 'warm curious discovery',
    scenes: [
      { startSec: 0, endSec: 5, visual: 'Dark house. Sunrise begins. Solar panels catch first light. Energy bar starts filling.', textEn: '6:30 AM. Your panels wake up before you.', textHi: 'सुबह 6:30। आपके पैनल आपसे पहले जागते हैं।', textMr: 'सकाळी 6:30. तुमचे पॅनेल तुमच्यापेक्षा आधी जागतात.', transition: 'Sunrise fade in' },
      { startSec: 5, endSec: 15, visual: 'House powering up icon by icon: lights, fan, refrigerator, TV. All green. "Powered by Solar" badge.', textEn: '8 AM: Your entire home runs on solar. No grid draw.', textHi: 'सुबह 8: पूरा घर सोलर पर। ग्रिड: 0।', textMr: 'सकाळी 8: संपूर्ण घर सोलरवर. ग्रिड: 0.', transition: 'Icon pop-ins' },
      { startSec: 15, endSec: 28, visual: 'Midday peak. Sun at zenith. Generation bar maxes out. AC icon running. Surplus energy flowing back to grid with credit counter.', textEn: '12 PM: Peak generation. AC runs free. Exporting to MSEDCL.', textHi: 'दोपहर 12: पीक जनरेशन। AC फ्री में। MSEDCL को निर्यात।', textMr: 'दुपारी 12: शिखर निर्मिती. AC मोफत. MSEDCL ला निर्यात.', transition: 'Energy pulse animation' },
      { startSec: 28, endSec: 40, visual: 'Sunset. Panels dim. Grid auto-switches. Day summary dashboard appears: 24 units generated, 18 used, 6 exported.', textEn: 'Evening: Auto-switch to grid. Day summary:', textHi: 'शाम: ग्रिड पर वापस। दिन का सारांश:', textMr: 'संध्याकाळ: ग्रिडवर परत. दिवसाचा सारांश:', transition: 'Dashboard slide up' },
      { startSec: 40, endSec: 45, visual: 'Bold stat: "Day 1 Savings: ₹240". "Month projection: ₹7,200". Logo + phone + CTA.', textEn: 'Day 1 savings: ₹240. That\'s ₹7,200/month.', textHi: 'Day 1 बचत: ₹240। यानी ₹7,200/महीना।', textMr: 'Day 1 बचत: ₹240. म्हणजे ₹7,200/महिना.', transition: 'Bounce scale reveal' },
    ],
  }),

  // MAY 10 — Static: Quality Promise
  'Our Quality Promise': staticPostSpec({
    headline: 'Tier-1 Panels. Bloomberg Certified. 25-Year Guaranteed.',
    subtext: 'Premium quality. No shortcuts. That\'s our promise.',
    colorScheme: 'dark',
    dataPoints: ['Bloomberg NEF Tier-1 Certified', 'SMA / Growatt / Fronius inverters', 'MNRE-approved methods', 'ISO-certified process'],
    imagePromptEn: 'Premium quality solar panel close-up macro shot, high quality monocrystalline silicon cells, Bloomberg NEF certification badge, quality assurance symbols, pristine installation on modern commercial rooftop, trust and premium brand visual, no people, dark luxury aesthetic, brand navy blue background',
  }),

  // MAY 11 — Static: Society Presentation
  'Society Solar Free Presentation': staticPostSpec({
    headline: 'Free Solar Presentation for Your Society',
    subtext: 'We come to you. 45 minutes. ROI calculated live.',
    colorScheme: 'dark',
    dataPoints: ['Free for all committees', 'ROI calculated on-site', 'May 12–31 slots available'],
    imagePromptEn: 'Professional business presentation in Indian housing society meeting, presentation slide visible on screen with solar ROI data, meeting room setting, no people visible, presentation board with solar graphics, professional consultation visual, brand colors, modern clean business style',
  }),

  // MAY 12 — News Slot
  '🗞️ RESERVED FOR NEWS — Solar / Renewable': staticPostSpec({
    headline: '[NEWS] May 2026 Solar Performance Report',
    subtext: 'Data from 500+ Maharashtra installations this summer',
    colorScheme: 'dark',
    imagePromptEn: 'Solar performance data report graphic, graphs and charts showing performance metrics, thermometer showing 45°C with efficiency percentages, summer solar data visualization, Maharashtra context, no people, clean data journalism style, brand navy and light blue',
  }),

  // MAY 13 — Carousel: Ground Mount vs Rooftop
  'Ground Mount vs Rooftop Solar': carouselSpec({
    coverHeadline: 'Rooftop vs Ground Mount: Complete Guide',
    imagePromptEn: 'Split comparison visual, left side: rooftop solar on Indian house, right side: ground-mounted solar array on land, Maharashtra landscape, professional comparison graphic, no people, clean modern infographic style, brand colors',
    audioBpm: 100,
    slides: [
      { title: 'Cost Comparison', body: 'Rooftop: Lower installation cost. Ground: Higher but larger capacity possible.', visual: 'Price comparison bar chart' },
      { title: 'Efficiency & Output', body: 'Ground mount: Can be optimally angled. Rooftop: Fixed to roof orientation.', visual: 'Angle optimization diagram, sun path' },
      { title: 'Best For: Rooftop', body: 'Residential homes, Commercial buildings, Societies. Space: 1kW needs ~10 sq ft.', visual: 'House + factory icons' },
      { title: 'Best For: Ground Mount', body: 'Agricultural land, Large open spaces, 1MW+ projects.', visual: 'Farm land + large solar array illustration' },
      { title: 'Not Sure? Let Us Decide', body: 'Free site assessment. We recommend what\'s best for YOUR needs.', visual: 'Expert consultation icon' },
    ],
  }),

  // MAY 14 — Static: 500 Installations
  '500+ Happy Solar Families': staticPostSpec({
    headline: '500+ Families. One Mission: Energy Freedom.',
    subtext: '₹15 Crore+ saved annually. 3.5 million kg CO2 prevented.',
    colorScheme: 'dark',
    dataPoints: ['500+ installations', '2.5 MW capacity', '₹15Cr/year customer savings', 'Pune · Mumbai · Nashik · Aurangabad'],
    imagePromptEn: 'Milestone achievement graphic, 500 rooftop solar installations shown as Maharashtra city map with glowing installation pins, solar panels on rooftops across Maharashtra, achievement celebration visual, data numbers prominently displayed, no people, brand navy with gold achievement accents, pride visual',
  }),

  // MAY 15 — Static: Summer Sale Closing
  'SUMMER SALE CLOSING': staticPostSpec({
    headline: '🔥 Last Chance: Summer Solar Window Closing',
    subtext: 'May 15. Peak bills. Final installation slots.',
    colorScheme: 'dark',
    dataPoints: ['FINAL slots available', 'PM Surya Ghar subsidy active', 'Installed in 10–15 days'],
    imagePromptEn: 'Final call urgency marketing graphic, calendar showing May 15 highlighted in red, solar panels on rooftop with dramatic sunset/end of season feeling, last chance visual elements, countdown aesthetic, Indian summer heat, no people, high-urgency marketing design, red orange and navy colors',
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎨 Solar Growth OS — Production Spec Seeder');
  console.log('   Patching 31 posts with design specs, AI prompts, reel scripts & audio plans\n');

  let token: string;
  try {
    token = await login();
    console.log('✅ Authenticated\n');
  } catch (e) {
    console.error('❌ Auth failed:', String(e));
    process.exit(1);
  }

  const posts = await getPosts(token);
  console.log(`📋 Found ${posts.length} posts in system\n`);

  let matched = 0;
  let unmatched = 0;

  for (const post of posts) {
    // Find matching spec by title substring
    const specKey = Object.keys(SPEC_MAP).find(k => post.title.includes(k));
    if (!specKey) {
      // Use a generic spec based on content type
      const genericSpec = post.contentType === 'REEL'
        ? { type: 'REEL', note: 'Generic reel spec — customize per post', brand: BRAND }
        : post.contentType === 'CAROUSEL'
          ? { type: 'CAROUSEL', note: 'Generic carousel spec — customize per post', brand: BRAND }
          : { type: 'STATIC_POST', note: 'Generic static spec — customize per post', brand: BRAND };

      await patchProductionSpec(token, post.id, genericSpec);
      console.log(`  ⚠️  [GENERIC] ${post.contentType} | ${post.title.slice(0, 50)}…`);
      unmatched++;
      continue;
    }

    const spec = SPEC_MAP[specKey];
    const result = await patchProductionSpec(token, post.id, spec);
    if (result) {
      matched++;
      const type = (spec as any).type ?? post.contentType;
      const icon = type === 'REEL' ? '🎬' : type === 'CAROUSEL' ? '🎠' : '🖼️';
      console.log(`  ✓ ${icon} [${matched}] ${post.contentType} | ${post.title.slice(0, 55)}…`);
    }
    await new Promise(r => setTimeout(r, 80));
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ PRODUCTION SPECS ADDED`);
  console.log(`\n   🖼️  Static Posts: specs include AI image prompts (Midjourney/DALL-E)`);
  console.log(`   🎠  Carousels:    specs include slide-by-slide design + audio plan`);
  console.log(`   🎬  Reels:        specs include scene scripts + video prompts (Runway/Kling)`);
  console.log(`\n   ✅  Matched:   ${matched}`);
  console.log(`   ⚠️   Generic:   ${unmatched}`);
  console.log(`\n🚀 View at: http://localhost:3000/admin/social → Production Studio tab\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
