/**
 * Social Content Generation Service
 * Uses OpenAI to generate multilingual captions, hashtags, and visual concepts
 * for solar business social media content optimized for Indian market (Maharashtra)
 */

import OpenAI from 'openai';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? 'placeholder' });
  }
  return _openai;
}

export type SocialSegment = 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL' | 'GROUND_MOUNT';
export type SocialContentType = 'STATIC_POST' | 'CAROUSEL' | 'REEL';

export interface GeneratedContent {
  title: string;
  captionEn: string;
  captionHi: string;
  captionMr: string;
  hashtags: string[];
  visualConcept: string;
  contentStrategy: 'EDUCATION' | 'AUTHORITY' | 'TRUST' | 'CONVERSION';
  platforms: string[];
}

// ─── Content Strategy Mix ─────────────────────────────────────────────────────
// Education 40% | Authority 30% | Trust 20% | Conversion 10%

const SEGMENT_CONTEXT: Record<SocialSegment, string> = {
  RESIDENTIAL: 'homeowners in Maharashtra with monthly electricity bills of ₹2,000–₹8,000. They care about savings, ROI, government subsidy (PM Surya Ghar), and hassle-free installation.',
  SOCIETY: 'housing societies (RWAs) in Pune/Mumbai/Nashik looking to reduce common area electricity bills by 70–90%. Decision maker is the society secretary/chairman.',
  COMMERCIAL: 'small businesses, shops, offices, and commercial establishments spending ₹10,000–₹1,00,000/month on electricity. They respond to ROI (3–4 years) and 40% depreciation benefit (Section 32).',
  INDUSTRIAL: 'factories and industrial units in Maharashtra (MIDC areas) with very high electricity consumption (100 kW+). They respond to cost per unit savings and accelerated depreciation.',
  GROUND_MOUNT: 'agricultural land owners and developers interested in large-scale (500 kW to 5 MW) ground-mounted solar projects. They respond to land monetization and long-term income.',
};

const CONTENT_TYPE_INSTRUCTIONS: Record<SocialContentType, string> = {
  STATIC_POST: 'A single impactful image post. Caption should be punchy, 2–3 sentences max with a strong CTA.',
  CAROUSEL: 'A multi-slide educational carousel (5–7 slides). Caption should introduce the topic. Visual concept should describe each slide.',
  REEL: 'A 30–60 second reel using ONLY motion graphics, text animations, and stock solar visuals. NO human faces or voices. Describe the scene-by-scene animation sequence.',
};

const BRAND = {
  colors: '#739bd6 (primary blue), #161c34 (dark navy), #000000 (black), #ffffff (white)',
  elements: 'company logo, phone number, website URL',
  style: 'clean, professional, trustworthy. Inspired by Tesla and Tata Solar aesthetics.',
};

// ─── Content Strategy Rotator ─────────────────────────────────────────────────

let strategyIndex = 0;
const STRATEGY_WEIGHTS: Array<{ strategy: GeneratedContent['contentStrategy']; weight: number }> = [
  { strategy: 'EDUCATION', weight: 40 },
  { strategy: 'AUTHORITY', weight: 30 },
  { strategy: 'TRUST', weight: 20 },
  { strategy: 'CONVERSION', weight: 10 },
];

function pickStrategy(): GeneratedContent['contentStrategy'] {
  const strategies: GeneratedContent['contentStrategy'][] = [];
  for (const { strategy, weight } of STRATEGY_WEIGHTS) {
    for (let i = 0; i < weight; i++) strategies.push(strategy);
  }
  const pick = strategies[strategyIndex % strategies.length];
  strategyIndex++;
  return pick;
}

const STRATEGY_PROMPTS: Record<GeneratedContent['contentStrategy'], string> = {
  EDUCATION: 'educational content that teaches the audience something valuable about solar energy. Use facts, numbers, and clear explanations. Build awareness and trust.',
  AUTHORITY: 'authority-building content showcasing expertise: past installations, case studies, certifications, team expertise, or technical knowledge. Build credibility.',
  TRUST: 'trust-building content: customer testimonials (anonymized), guarantee information, after-sales service, government approvals, or social proof. Reduce purchase anxiety.',
  CONVERSION: 'conversion-focused content with a direct offer, limited-time deal, subsidy deadline, or strong CTA. Drive immediate action.',
};

// ─── Main Generation Function ─────────────────────────────────────────────────

export async function generateSocialContent(
  segment: SocialSegment,
  contentType: SocialContentType,
  theme?: string,
  forcedStrategy?: GeneratedContent['contentStrategy'],
): Promise<GeneratedContent> {
  const strategy = forcedStrategy ?? pickStrategy();
  const themeContext = theme ? `\nThis post is themed around: "${theme}"` : '';

  const systemPrompt = `You are a social media content strategist for Rolling Energy Solar, a solar EPC company in Maharashtra, India. 
You create high-conversion content for Instagram, Facebook, and LinkedIn.

Brand guidelines:
- Colors: ${BRAND.colors}
- Always include: ${BRAND.elements}
- Style: ${BRAND.style}

Content rules:
- NO generic content. Every post must feel specifically written for solar business in India.
- Use INR (₹) for all monetary figures.
- Reference real Indian context: Maharashtra electricity tariffs, PM Surya Ghar Yojana, MSEDCL, MNRE.
- Hashtags must be a mix of high-volume + niche solar hashtags.
- Captions must be WhatsApp-friendly (short sentences, emojis used sparingly but effectively).
- Hindi and Marathi translations must be natural, NOT word-for-word Google Translate. Use local idioms.`;

  const userPrompt = `Generate social media content with these specs:

Target Audience: ${SEGMENT_CONTEXT[segment]}
Content Type: ${CONTENT_TYPE_INSTRUCTIONS[contentType]}
Strategy: Create ${STRATEGY_PROMPTS[strategy]}${themeContext}

Return a JSON object with EXACTLY these fields:
{
  "title": "short post title (5–7 words)",
  "captionEn": "full caption in English (platform-ready with emojis)",
  "captionHi": "same caption in Hindi (natural, conversational)",
  "captionMr": "same caption in Marathi (natural, conversational)",
  "hashtags": ["array", "of", "20-25", "hashtags", "no-hash-symbol"],
  "visualConcept": "detailed visual description or slide-by-slide breakdown for reels/carousels. Specify colors from brand palette.",
  "platforms": ["instagram", "facebook"] // or add "linkedin" if B2B content
}

Important: Return ONLY the JSON, no markdown, no explanation.`;

  try {
    // Explicit non-streaming request so the SDK return type is ChatCompletion (not Stream).
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
      stream: false,
    });

    const raw = completion.choices[0]?.message.content ?? '{}';
    const parsedUnknown: unknown = JSON.parse(raw);
    if (!isGeneratedContentPayload(parsedUnknown)) {
      return fallbackContent(segment, contentType, strategy);
    }

    return {
      ...parsedUnknown,
      contentStrategy: strategy,
      hashtags: Array.isArray(parsedUnknown.hashtags)
        ? parsedUnknown.hashtags.slice(0, 25)
        : [],
    };
  } catch {
    return fallbackContent(segment, contentType, strategy);
  }
}

function isGeneratedContentPayload(
  value: unknown,
): value is Omit<GeneratedContent, 'contentStrategy'> {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.title === 'string' &&
    typeof data.captionEn === 'string' &&
    typeof data.captionHi === 'string' &&
    typeof data.captionMr === 'string' &&
    typeof data.visualConcept === 'string' &&
    Array.isArray(data.hashtags) &&
    data.hashtags.every((tag) => typeof tag === 'string') &&
    Array.isArray(data.platforms) &&
    data.platforms.every((platform) => typeof platform === 'string')
  );
}

// ─── Fallback (when OpenAI unavailable) ──────────────────────────────────────

function fallbackContent(
  segment: SocialSegment,
  contentType: SocialContentType,
  strategy: GeneratedContent['contentStrategy'],
): GeneratedContent {
  const fallbacks: Record<SocialSegment, GeneratedContent> = {
    RESIDENTIAL: {
      title: 'Cut Your Electricity Bill by 90%',
      captionEn: `⚡ Electricity bill above ₹3,000/month?\n\nGo solar and pay ₹0 for the next 25 years!\n\nPM Surya Ghar subsidy available up to ₹78,000 — limited slots.\n\n📞 Call us today for a FREE site assessment!\n\n👉 rollingenergy.in`,
      captionHi: `⚡ बिजली बिल ₹3,000/महीना से ज़्यादा?\n\nसोलर लगाएं और अगले 25 साल ₹0 बिल दें!\n\nPM सूर्य घर योजना में ₹78,000 तक की सब्सिडी — सीमित स्लॉट।\n\n📞 आज ही मुफ्त साइट असेसमेंट के लिए कॉल करें!`,
      captionMr: `⚡ वीज बिल ₹3,000/महिन्यापेक्षा जास्त?\n\nसोलर लावा आणि पुढे 25 वर्षे ₹0 बिल भरा!\n\nPM सूर्य घर योजनेत ₹78,000 पर्यंत अनुदान — मर्यादित जागा.\n\n📞 आजच मोफत साइट तपासणीसाठी कॉल करा!`,
      hashtags: ['SolarEnergy','GoSolar','SolarPower','RenewableEnergy','SolarIndia','PMSuryaGhar','ElectricityBill','SolarSubsidy','Maharashtra','RollingEnergy','CleanEnergy','SolarInstallation','GreenEnergy','SolarPanels','EnergyIndependence'],
      visualConcept: 'Split-screen: left shows a stressed family with a high electricity bill (₹6,500), right shows same family happy with solar panels on roof and ₹0 bill. Brand colors #739bd6 and #161c34. Logo bottom right.',
      contentStrategy: strategy,
      platforms: ['instagram', 'facebook'],
    },
    SOCIETY: {
      title: 'Reduce Society Electricity Bill 80%',
      captionEn: `🏘️ Is your society paying ₹50,000+ per month on common area electricity?\n\nRooftop solar can bring that down by 80%!\n\n✅ Zero investment option available (RESCO model)\n✅ All paperwork handled by us\n✅ 25-year performance warranty\n\nDM us or call for a FREE society consultation! 📞`,
      captionHi: `🏘️ क्या आपकी सोसायटी का बिजली बिल ₹50,000+/महीना है?\n\nसोलर से 80% तक बचाएं!\n\n✅ जीरो इन्वेस्टमेंट ऑप्शन उपलब्ध\n✅ सारी कागज़ी कार्यवाही हम करते हैं\n\nमुफ्त सोसायटी कंसल्टेशन के लिए संपर्क करें! 📞`,
      captionMr: `🏘️ तुमच्या सोसायटीचे वीज बिल ₹50,000+/महिना आहे का?\n\nसोलरने 80% वाचवा!\n\n✅ शून्य गुंतवणूक पर्याय उपलब्ध\n✅ सर्व कागदपत्रे आम्ही करतो\n\nमोफत सोसायटी सल्लामसलतीसाठी संपर्क करा! 📞`,
      hashtags: ['HousingSociety','SocietySolar','CommonAreaElectricity','SolarSociety','PuneSolar','MumbaiSolar','RESCO','BulkSolar','SocietyManagement','GreenSociety'],
      visualConcept: 'Aerial view of a residential society with solar panels on multiple rooftops. Overlaid text showing bill reduction percentage. Professional infographic style.',
      contentStrategy: strategy,
      platforms: ['instagram', 'facebook', 'linkedin'],
    },
    COMMERCIAL: {
      title: 'Cut Commercial Electricity Costs 50%',
      captionEn: `💼 Business owners — solar is your smartest investment in 2026!\n\n📊 Save 40–60% on electricity bills\n💰 40% accelerated depreciation (Section 32 benefit)\n📅 ROI in just 3–4 years\n\nIndia's commercial electricity tariffs increased 12% this year. Lock in solar NOW.\n\n📞 Free commercial energy audit — contact us today!`,
      captionHi: `💼 बिज़नेस ओनर्स — सोलर 2026 का सबसे स्मार्ट निवेश है!\n\n📊 बिजली बिल में 40–60% बचत\n💰 40% एक्सेलरेटेड डेप्रिसिएशन (धारा 32)\n📅 सिर्फ 3–4 साल में ROI\n\n📞 मुफ्त कमर्शियल एनर्जी ऑडिट के लिए आज संपर्क करें!`,
      captionMr: `💼 व्यावसायिक — सोलर हे 2026 मधील सर्वात स्मार्ट गुंतवणूक आहे!\n\n📊 वीज बिलात 40–60% बचत\n💰 40% त्वरित घसारा (कलम 32)\n📅 फक्त 3–4 वर्षांत ROI\n\n📞 मोफत व्यावसायिक ऊर्जा लेखापरीक्षणासाठी आज संपर्क करा!`,
      hashtags: ['CommercialSolar','BusinessSolar','SolarROI','Section32','TaxBenefit','IndiaCommercial','SolarBusiness','EnergyAudit','MaharashtraBusiness','SolarMSME'],
      visualConcept: 'Professional infographic showing a bar chart of monthly electricity savings. Left side: before solar (high bill), right side: after solar (low bill). Navy background with blue accent.',
      contentStrategy: strategy,
      platforms: ['instagram', 'facebook', 'linkedin'],
    },
    INDUSTRIAL: {
      title: 'Industrial Solar — Lowest Cost Electricity',
      captionEn: `🏭 Manufacturing unit? Industrial facility?\n\nSolar electricity now costs ₹2–3/unit vs ₹8–12/unit from the grid!\n\n✅ 40% accelerated depreciation Year 1\n✅ Systems from 100 kW to 5 MW\n✅ On-grid + hybrid configurations\n✅ 25-year production guarantee\n\nWe've installed 50+ industrial systems in Maharashtra. Let's talk ROI.\n\n📞 Call for FREE industrial assessment.`,
      captionHi: `🏭 मैन्युफैक्चरिंग यूनिट? इंडस्ट्रियल फैसिलिटी?\n\nसोलर बिजली अब ₹2–3/यूनिट — ग्रिड से ₹8–12/यूनिट की तुलना में!\n\n✅ Year 1 में 40% एक्सेलरेटेड डेप्रिसिएशन\n✅ 100 kW से 5 MW तक सिस्टम\n\n📞 फ्री इंडस्ट्रियल असेसमेंट के लिए कॉल करें।`,
      captionMr: `🏭 उत्पादन युनिट? औद्योगिक सुविधा?\n\nसोलर वीज आता ₹2–3/युनिट — ग्रिडच्या ₹8–12/युनिटच्या तुलनेत!\n\n✅ पहिल्या वर्षी 40% त्वरित घसारा\n✅ 100 kW ते 5 MW पर्यंत सिस्टम\n\n📞 मोफत औद्योगिक मूल्यांकनासाठी कॉल करा.`,
      hashtags: ['IndustrialSolar','ManufacturingSolar','MIDCSolar','SolarMaharashtra','IndustrialEnergy','SolarCPP','CaptivePower','SolarInfrastructure','LargeSolar','GreenManufacturing'],
      visualConcept: 'Time-lapse animation concept: factory rooftop with large solar array. Cost-per-unit comparison chart animated in. Professional B2B aesthetic.',
      contentStrategy: strategy,
      platforms: ['linkedin', 'facebook'],
    },
    GROUND_MOUNT: {
      title: 'Earn From Your Land with Solar',
      captionEn: `🌱 Agricultural land owner? Turn your land into a solar power plant!\n\n✅ Earn ₹35,000–₹60,000/acre/year passively\n✅ 25-year income security\n✅ Land still usable for agri-voltaics\n✅ Government policy support (RPO targets)\n\nWe've developed 10+ MW of ground-mounted projects across Maharashtra.\n\n📞 DM or call for FREE feasibility study!`,
      captionHi: `🌱 कृषि भूमि मालिक? अपनी ज़मीन को सोलर पावर प्लांट बनाएं!\n\n✅ ₹35,000–₹60,000/एकड़/साल कमाएं\n✅ 25 साल की आय सुरक्षा\n✅ एग्री-वोल्टेइक्स के लिए ज़मीन उपयोगी\n\n📞 मुफ्त फीज़िबिलिटी स्टडी के लिए कॉल करें!`,
      captionMr: `🌱 शेतजमीन मालक? तुमची जमीन सोलर पॉवर प्लांट बनवा!\n\n✅ ₹35,000–₹60,000/एकर/वर्ष कमवा\n✅ 25 वर्षांचे उत्पन्न सुरक्षित\n✅ कृषी-व्होल्टाइक वापरासाठी जमीन उपलब्ध\n\n📞 मोफत व्यवहार्यता अभ्यासासाठी कॉल करा!`,
      hashtags: ['GroundMountSolar','SolarFarm','AgriculturalSolar','AgriVoltaics','SolarProject','LandLease','SolarIncome','MaharashtraSolar','RenewableProject','SolarDeveloper'],
      visualConcept: 'Wide aerial shot of a ground-mounted solar farm in a green landscape. Overlaid income calculation graphic. Sunrise lighting to evoke optimism and growth.',
      contentStrategy: strategy,
      platforms: ['instagram', 'facebook', 'linkedin'],
    },
  };

  return fallbacks[segment];
}

// ─── Batch generation for calendar seeding ───────────────────────────────────

export async function generateBatchContent(
  items: Array<{ segment: SocialSegment; contentType: SocialContentType; theme: string; strategy?: GeneratedContent['contentStrategy'] }>,
  delayMs = 500,
): Promise<GeneratedContent[]> {
  const results: GeneratedContent[] = [];
  for (const item of items) {
    const content = await generateSocialContent(item.segment, item.contentType, item.theme, item.strategy);
    results.push(content);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  return results;
}
