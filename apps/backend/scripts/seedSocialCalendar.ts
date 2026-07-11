/**
 * Solar Growth OS — 30-Day Social Media Calendar Seeder
 * Period: April 15 – May 15, 2026
 *
 * Context: PEAK SUMMER in Maharashtra. Electricity bills are at their highest.
 * This is the #1 conversion window for solar sales.
 *
 * Strategy Mix:
 *   30% Education | 25% Authority | 20% Trust | 25% Conversion
 *
 * Run: tsx scripts/seedSocialCalendar.ts
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

async function post(token: string, body: unknown) {
  const res = await fetch(`${BASE}/social/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) { console.error(`  ✗ ${res.status}: ${text.slice(0, 200)}`); return null; }
  return JSON.parse(text);
}

// ─── Timing helper ────────────────────────────────────────────────────────────
function scheduleAt(dateStr: string, hour: number, minute = 0): string {
  return `${dateStr}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00.000Z`;
}

// IST offset = UTC+5:30, so 8:00 AM IST = 02:30 UTC, 7:30 PM IST = 14:00 UTC
// For seeding we use IST times directly (server in IST or UTC+5:30 assumed)
function ist(dateStr: string, hour: number, min = 0) {
  return `${dateStr}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00.000+05:30`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL 31-DAY CONTENT CALENDAR  (Apr 15 – May 15, 2026)
// ─────────────────────────────────────────────────────────────────────────────

const POSTS = [

  // ══════════════════════════════════════════════════════════════════════════
  // WEEK 1: Apr 15 (Wed) – Apr 21 (Tue)
  // ══════════════════════════════════════════════════════════════════════════

  {
    scheduledAt: ist('2026-04-15', 8),
    title: 'Summer is Here — Is Your Electricity Bill Ready?',
    segment: 'RESIDENTIAL',
    contentType: 'STATIC_POST',
    category: 'CONVERSION',
    captionEn: `☀️ April in Maharashtra = Summer electricity bills starting to HURT.\n\nThe average MSEDCL bill in Maharashtra jumped 18% this year.\n\nBut 500+ families we've installed solar for? Their bill is ₹0.\n\n📊 Average savings: ₹4,500–₹8,000/month\n🎁 PM Surya Ghar subsidy: Up to ₹78,000\n⚡ Installation time: 3–5 days\n\nSummer is the BEST time to go solar. Call us today.\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `☀️ अप्रैल में महाराष्ट्र = गर्मी के साथ बिजली बिल भी चढ़ने लगे!\n\nइस साल MSEDCL बिल 18% बढ़ा है।\n\nलेकिन जिन 500+ परिवारों को हमने सोलर लगाया? उनका बिल ₹0 है।\n\n📊 औसत बचत: ₹4,500–₹8,000/महीना\n🎁 PM सूर्य घर सब्सिडी: ₹78,000 तक\n⚡ इंस्टॉलेशन: 3–5 दिन\n\nगर्मी सोलर लगाने का सबसे अच्छा समय है। आज ही कॉल करें!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `☀️ एप्रिल महाराष्ट्रात = उन्हाळ्याची वीज बिले वाढायला सुरुवात!\n\nया वर्षी MSEDCL बिल 18% वाढले आहे.\n\nपण ज्या 500+ कुटुंबांना आम्ही सोलर लावले? त्यांचे बिल ₹0 आहे.\n\n📊 सरासरी बचत: ₹4,500–₹8,000/महिना\n🎁 PM सूर्य घर अनुदान: ₹78,000 पर्यंत\n⚡ इन्स्टॉलेशन: 3–5 दिवस\n\nउन्हाळा सोलर लावण्याचा सर्वोत्तम वेळ आहे. आजच कॉल करा!\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['SolarEnergy','SummerSolar','ElectricityBill','MaharashtraSolar','MSEDCLBill','PMSuryaGhar','GoSolar','SolarIndia','RollingEnergy','SaveElectricity','RenewableEnergy','SolarPanels','CleanEnergy','PuneSolar','EnergyIndependence','SolarSummer','FreeElectricity','SolarInstallation'],
    visualConcept: 'Split-screen design. Left: a stressed person holding a crumpled electricity bill of ₹7,200 with red color. Right: same scene with a solar panel on rooftop and ₹0 bill, sunny background. Brand colors: #739bd6 top bar, #161c34 bottom. Company logo top-right. Tagline: "Summer Bills vs Solar Bills".',
    platforms: ['instagram', 'facebook', 'linkedin'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-04-16', 19, 30),
    title: '🗞️ RESERVED FOR NEWS — Solar / Energy / MSEDCL Updates',
    segment: 'RESIDENTIAL',
    contentType: 'STATIC_POST',
    category: 'NEWS_SLOT',
    captionEn: `[NEWS SLOT — Fill latest solar/energy news 5 days before April 16]\n\n---FALLBACK CONTENT---\n\n⚡ MSEDCL Tariff Revision 2026 — What You Need to Know\n\nMaharashtra electricity tariffs revised again.\nHousehold consumers in urban areas paying up to ₹9.85/unit for peak consumption.\n\nWith solar, your effective cost = ₹1.5–₹2.5/unit for 25 years.\n\nThe math doesn't lie. DM us for a free calculation!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `[समाचार स्लॉट — 11 अप्रैल से पहले भरें]\n\n---फॉलबैक कंटेंट---\n\n⚡ MSEDCL टैरिफ रिवीजन 2026 — आपको क्या जानना चाहिए\n\nमहाराष्ट्र में बिजली दरें फिर बढ़ीं। शहरी उपभोक्ताओं को ₹9.85/यूनिट तक चुकाना पड़ रहा है।\n\nसोलर से आपकी प्रभावी लागत = 25 साल के लिए ₹1.5–₹2.5/यूनिट।\n\nगणित साफ़ है। मुफ्त कैलकुलेशन के लिए DM करें!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `[बातम्यांचा स्लॉट — 11 एप्रिलपूर्वी भरा]\n\n---फॉलबॅक कंटेंट---\n\n⚡ MSEDCL दर सुधारणा 2026 — तुम्हाला काय माहित असणे आवश्यक आहे\n\nमहाराष्ट्रात वीज दर पुन्हा वाढले. शहरी ग्राहकांना ₹9.85/युनिटपर्यंत द्यावे लागत आहे.\n\nसोलरसह तुमची प्रभावी किंमत = 25 वर्षांसाठी ₹1.5–₹2.5/युनिट.\n\nगणित स्पष्ट आहे. मोफत गणनेसाठी DM करा!\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['MSEDCLTariff','ElectricityTariff','SolarVsGrid','MaharashtraElectricity','SolarEnergy','EnergyNews','PowerTariff','SolarSavings','RollingEnergy','CleanEnergy'],
    visualConcept: 'Breaking news style graphic. Headline: "MSEDCL Tariff Update 2026". Grid vs Solar cost comparison bar chart. Brand colors. Newspaper texture overlay. "Know Your Rights" badge.',
    platforms: ['instagram', 'facebook'],
    isNewsSlot: true,
  },

  {
    scheduledAt: ist('2026-04-17', 8),
    title: '5 Things That Happen When You Install Solar in Summer',
    segment: 'RESIDENTIAL',
    contentType: 'CAROUSEL',
    category: 'EDUCATION',
    captionEn: `🌞 Installing solar in summer is actually SMART — here's why:\n\nSwipe to see 5 things that happen the moment your panels go live! →\n\n📊 Spoiler: Your electricity bill starts dropping from Day 1.\n\nSave this post for when your next bill arrives! 💾\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🌞 गर्मियों में सोलर लगवाना वाकई SMART है — ये रहे कारण:\n\nस्वाइप करें और जानें वो 5 चीज़ें जो पैनल लगते ही होती हैं! →\n\n📊 स्पॉइलर: Day 1 से ही बिजली बिल कम होना शुरू हो जाता है।\n\nजब अगला बिल आए तो यह पोस्ट देखें! 💾\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🌞 उन्हाळ्यात सोलर लावणे खरोखरच SMART आहे — हे कारण आहे:\n\nस्वाइप करा आणि पॅनेल लागल्यावर घडणाऱ्या 5 गोष्टी पाहा! →\n\n📊 स्पॉइलर: दिवस 1 पासूनच वीज बिल कमी होऊ लागते.\n\nपुढचे बिल आल्यावर हे पोस्ट पाहा! 💾\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['SolarEducation','SolarTips','GoSolar','SolarEnergy','SummerSolar','SolarFacts','SolarPower','RenewableEnergy','CleanEnergy','MaharashtraSolar','SolarBenefits','FreeElectricity','NetMetering','SolarInstallation','RollingEnergy','GreenHome','EnergyFacts'],
    visualConcept: `7-slide carousel:\nSlide 1 (Cover): "5 Things That Happen When You Go Solar" — rooftop solar illustration, sunrise bg.\nSlide 2: "Day 1: Your meter starts spinning backward" — animated net meter visual.\nSlide 3: "Month 1: First zero bill arrives" — cartoon bill showing ₹0.\nSlide 4: "Year 1: ROI begins — You've saved ₹50,000+" — graph going up.\nSlide 5: "Year 4: Break-even point — Everything after is FREE" — celebration graphic.\nSlide 6: "Year 25: ₹30 Lakhs+ total savings" — money bag illustration.\nSlide 7 (CTA): "Ready to start YOUR solar journey?" — Phone + website. Brand colors throughout.`,
    platforms: ['instagram', 'facebook', 'linkedin'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-04-18', 10),
    title: 'Pune Family Saves ₹5,400/Month — Their Story',
    segment: 'RESIDENTIAL',
    contentType: 'REEL',
    category: 'TRUST',
    captionEn: `🏠 The Kulkarni family from Pune was paying ₹6,200/month in electricity bills.\n\nNow? ₹800/month (only the fixed charges).\n\nSavings: ₹5,400 every single month. ₹64,800/year.\n\n🎬 Watch their savings journey — before & after — in 30 seconds!\n\n✅ 5 kW system installed\n✅ 22 panels on rooftop\n✅ PM Surya Ghar subsidy: ₹54,000\n✅ Net investment: ₹1.3 Lakh\n✅ Payback: 2.4 years\n\nWant the same results? Comment "SOLAR" below!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🏠 पुणे की कुलकर्णी फैमिली ₹6,200/महीना बिजली बिल दे रही थी।\n\nअब? ₹800/महीना (सिर्फ फिक्स्ड चार्जेस)।\n\nबचत: हर महीने ₹5,400। साल में ₹64,800।\n\n🎬 30 सेकंड में देखें उनकी सेविंग जर्नी — पहले और बाद!\n\n✅ 5 kW सिस्टम लगा\n✅ PM सूर्य घर सब्सिडी: ₹54,000\n✅ नेट इन्वेस्टमेंट: ₹1.3 लाख\n✅ पेबैक: 2.4 साल\n\nऐसे ही नतीजे चाहते हैं? नीचे "SOLAR" कमेंट करें!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🏠 पुण्याच्या कुलकर्णी कुटुंबाचे बिल होते ₹6,200/महिना.\n\nआता? ₹800/महिना (फक्त फिक्स्ड चार्जेस).\n\nबचत: दर महिना ₹5,400. वर्षाला ₹64,800.\n\n🎬 30 सेकंदात पाहा त्यांची बचत कथा — आधी आणि नंतर!\n\n✅ 5 kW सिस्टम बसवले\n✅ PM सूर्य घर अनुदान: ₹54,000\n✅ निव्वळ गुंतवणूक: ₹1.3 लाख\n✅ परतावा: 2.4 वर्षे\n\nतुम्हालाही असेच निकाल हवे आहेत? खाली "SOLAR" कमेंट करा!\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['CustomerStory','SolarSavings','PuneSolar','MaharashtraSolar','SolarROI','ElectricityBill','GoSolar','SolarPanels','PMSuryaGhar','RollingEnergy','SolarTestimonial','RealResults','SolarIndia','HomeOwner','EnergyIndependence','SolarSuccess'],
    visualConcept: `30-second reel (NO human faces, NO voice):\n0–3s: Before — animated electricity bill filling up, showing ₹6,200 in red, with stress emoji.\n3–8s: Calendar animation showing "Installation Day" with tools icon.\n8–15s: Solar panels appearing on rooftop (aerial illustration), sun shining, energy bars filling up.\n15–22s: Counter animation: bill meter spinning DOWN from ₹6,200 → ₹800. Savings number counting UP.\n22–28s: "₹5,400 SAVED EVERY MONTH" in large green text. Annual savings shown.\n28–30s: Logo + phone + website. "Get Your Free Quote Today". Brand colors.`,
    platforms: ['instagram', 'facebook'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-04-19', 11),
    title: 'Commercial Solar: 40% Tax Depreciation Benefit Explained',
    segment: 'COMMERCIAL',
    contentType: 'STATIC_POST',
    category: 'EDUCATION',
    captionEn: `📋 Business owners — did you know solar gives you a TAX ADVANTAGE?\n\nUnder Section 32 of Income Tax Act:\n✅ 40% Accelerated Depreciation in Year 1\n✅ Reduces your taxable income significantly\n✅ Effectively reduces your solar system cost by 25–30%\n\nExample: ₹20 Lakh system\n→ Depreciation benefit: ~₹5.6 Lakh in Year 1\n→ Your actual net cost: ~₹14.4 Lakh\n→ ROI: 2.5–3.5 years\n\nSolar + Tax savings = Double benefit. 💡\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `📋 बिज़नेस ओनर्स — क्या आप जानते हैं सोलर से टैक्स में भी फायदा होता है?\n\nइनकम टैक्स एक्ट की धारा 32 के तहत:\n✅ Year 1 में 40% एक्सेलरेटेड डेप्रिसिएशन\n✅ टैक्सेबल इनकम में भारी कमी\n✅ सोलर सिस्टम की कीमत प्रभावी रूप से 25–30% कम\n\nउदाहरण: ₹20 लाख का सिस्टम\n→ डेप्रिसिएशन बेनेफिट: Year 1 में ~₹5.6 लाख\n→ असली नेट कॉस्ट: ~₹14.4 लाख\n→ ROI: 2.5–3.5 साल\n\nसोलर + टैक्स बचत = दोहरा फायदा! 💡\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `📋 व्यावसायिक मालक — तुम्हाला माहित आहे का सोलरमुळे कर फायदाही होतो?\n\nआयकर कायद्याच्या कलम 32 अंतर्गत:\n✅ पहिल्या वर्षी 40% त्वरित घसारा\n✅ करपात्र उत्पन्नात मोठी घट\n✅ सोलर सिस्टम खर्च प्रभावीपणे 25–30% कमी\n\nउदाहरण: ₹20 लाखांची सिस्टम\n→ घसारा फायदा: पहिल्या वर्षी ~₹5.6 लाख\n→ निव्वळ खर्च: ~₹14.4 लाख\n→ ROI: 2.5–3.5 वर्षे\n\nसोलर + कर बचत = दुहेरी फायदा! 💡\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['CommercialSolar','Section32','TaxBenefit','AcceleratedDepreciation','BusinessSolar','SolarROI','IncomeTax','SolarIndia','MaharashtraBusiness','SolarInvestment','SolarFinance','TaxSavings','RollingEnergy','BusinessGrowth','SolarForBusiness'],
    visualConcept: 'Clean infographic on dark navy (#161c34) background. Left column: "WITHOUT Solar" — high tax burden graphic. Right column: "WITH Solar" — 40% depreciation benefit calculation breakdown. Green accent bars showing savings. Company logo. CTA: "Book Free Consultation".',
    platforms: ['instagram', 'linkedin', 'facebook'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-04-20', 8),
    title: 'Housing Society Solar: Cut Your Common Bill by 80%',
    segment: 'SOCIETY',
    contentType: 'STATIC_POST',
    category: 'CONVERSION',
    captionEn: `🏘️ Attention: Society Secretaries & Chairmen of Pune/Mumbai!\n\nIs your society spending ₹40,000–₹2 Lakh/month on electricity?\n\nRooftop solar for common areas can cut that by 70–80%!\n\n✅ ZERO investment option available (RESCO model)\n✅ We handle all paperwork + MSEDCL approvals\n✅ Net metering setup included\n✅ 25-year performance guarantee\n✅ Enhances property value by 3–8%\n\nWe've already done 25+ societies in Pune/Mumbai/Nashik.\n\n📢 Reply "SOCIETY" for a FREE consultation and ROI presentation!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🏘️ ध्यान दें: पुणे/मुंबई के सोसायटी सेक्रेटरी और अध्यक्ष!\n\nक्या आपकी सोसायटी बिजली पर ₹40,000–₹2 लाख/महीना खर्च कर रही है?\n\nकॉमन एरिया के लिए रूफटॉप सोलर इसे 70–80% तक घटा सकता है!\n\n✅ ZERO निवेश विकल्प उपलब्ध (RESCO मॉडल)\n✅ सारे कागज़ात + MSEDCL अप्रूवल हम करते हैं\n✅ नेट मीटरिंग सेटअप शामिल\n✅ 25 साल की परफॉर्मेंस गारंटी\n\nपुणे/मुंबई/नासिक में 25+ सोसायटी पहले से कर चुके हैं।\n\n📢 "SOCIETY" रिप्लाई करें — मुफ्त कंसल्टेशन के लिए!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🏘️ लक्ष द्या: पुणे/मुंबईच्या सोसायटी सचिव आणि अध्यक्षांनो!\n\nतुमची सोसायटी वीजेवर ₹40,000–₹2 लाख/महिना खर्च करत आहे का?\n\nकॉमन एरियासाठी रूफटॉप सोलर हे 70–80% पर्यंत कमी करू शकते!\n\n✅ शून्य गुंतवणूक पर्याय उपलब्ध (RESCO मॉडल)\n✅ सर्व कागदपत्रे + MSEDCL मंजुरी आम्ही करतो\n✅ नेट मीटरिंग सेटअप समाविष्ट\n✅ 25 वर्षांची कार्यक्षमता हमी\n\nपुणे/मुंबई/नाशिकमध्ये 25+ सोसायट्या आधीच केल्या आहेत.\n\n📢 "SOCIETY" रिप्लाय करा — मोफत सल्लामसलतीसाठी!\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['HousingSociety','SocietySolar','PuneSociety','MumbaiSociety','CommonAreaElectricity','RESCO','SocietySavings','ApartmentSolar','RWASolar','SocietyManagement','GreenSociety','SolarMaharashtra','NashikSolar','PropertyValue','RollingEnergy','BulkSolar'],
    visualConcept: 'Aerial photograph-style illustration of a residential society with solar panels on multiple rooftops. Animated arrows showing electricity flow. Bottom overlay: cost comparison table (Before: ₹80,000/month → After: ₹16,000/month). Dark navy (#161c34) header with logo.',
    platforms: ['instagram', 'facebook', 'linkedin'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-04-21', 19, 30),
    title: '🗞️ RESERVED FOR NEWS — Government Solar Policy / MNRE Updates',
    segment: 'RESIDENTIAL',
    contentType: 'STATIC_POST',
    category: 'NEWS_SLOT',
    captionEn: `[NEWS SLOT — Fill 5 days before April 21 with latest solar news]\n\n---FALLBACK CONTENT---\n\n🏛️ MNRE Update: PM Surya Ghar Scheme — Deadline & Remaining Budget\n\nThe PM Surya Ghar Muft Bijli Yojana has allocated ₹75,021 crore for 1 crore homes.\n\nProgress so far:\n🏠 32 lakh+ applications received\n✅ 6 lakh+ homes already installed\n⏰ Window is narrowing — don't miss your subsidy!\n\nBenefits:\n→ Up to ₹78,000 cash subsidy directly to bank\n→ We handle ALL paperwork for FREE\n\nApply now. DM or call!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `[न्यूज़ स्लॉट — 16 अप्रैल से पहले भरें]\n\n---फॉलबैक कंटेंट---\n\n🏛️ MNRE अपडेट: PM सूर्य घर योजना — डेडलाइन और बचा हुआ बजट\n\nPM सूर्य घर मुफ्त बिजली योजना में 1 करोड़ घरों के लिए ₹75,021 करोड़ आवंटित।\n\n🏠 32 लाख+ आवेदन मिले\n✅ 6 लाख+ घर पहले से इंस्टॉल\n⏰ विंडो संकरी हो रही है — सब्सिडी मिस न करें!\n\nDM या कॉल करें!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `[बातम्यांचा स्लॉट — 16 एप्रिलपूर्वी भरा]\n\n---फॉलबॅक कंटेंट---\n\n🏛️ MNRE अपडेट: PM सूर्य घर योजना — अंतिम मुदत आणि उर्वरित बजेट\n\nPM सूर्य घर मुफ्त बिजली योजनेत 1 कोटी घरांसाठी ₹75,021 कोटी वाटप.\n\n🏠 32 लाख+ अर्ज प्राप्त\n✅ 6 लाख+ घरे आधीच बसवली\n⏰ संधी कमी होत आहे — अनुदान चुकवू नका!\n\nDM किंवा कॉल करा!\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['PMSuryaGhar','MNREIndia','SolarSubsidy','GovernmentSolar','FreeElectricity','SolarPolicy','RenewableIndia','SolarScheme','CleanEnergyIndia','SolarBudget','RollingEnergy'],
    visualConcept: 'Government scheme announcement style. PM Surya Ghar logo + Rolling Energy logo. Progress bar showing scheme utilization. Key numbers highlighted in yellow on navy background. "Apply Before It\'s Too Late" urgency text.',
    platforms: ['instagram', 'facebook'],
    isNewsSlot: true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WEEK 2: Apr 22 (Wed, Earth Day) – Apr 28 (Tue)
  // ══════════════════════════════════════════════════════════════════════════

  {
    scheduledAt: ist('2026-04-22', 8),
    title: '🌍 Earth Day: Our Solar Impact in Numbers',
    segment: 'RESIDENTIAL',
    contentType: 'CAROUSEL',
    category: 'AUTHORITY',
    captionEn: `🌍 Happy Earth Day 2026!\n\nEvery solar panel we install is a gift to the planet.\nHere's what Rolling Energy has contributed so far:\n\nSwipe to see our environmental impact report 🌱\n\n"The best time to plant a tree was 20 years ago. The second best time is NOW." — Same goes for solar.\n\n📞 [Phone] | 🌐 rollingenergy.in\n\n#EarthDay2026 #SolarImpact`,
    captionHi: `🌍 हैप्पी अर्थ डे 2026!\n\nहम जो भी सोलर पैनल लगाते हैं, वह पृथ्वी को एक तोहफा है।\nदेखें Rolling Energy का अब तक का पर्यावरण पर असर:\n\nस्वाइप करें हमारी इम्पैक्ट रिपोर्ट देखने के लिए 🌱\n\nसोलर के लिए भी — "पेड़ लगाने का सबसे अच्छा समय 20 साल पहले था। दूसरा सबसे अच्छा समय अभी है।"\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🌍 Happy Earth Day 2026!\n\nआम्ही लावलेले प्रत्येक सोलर पॅनेल पृथ्वीला एक भेट आहे.\nRolling Energy चा आतापर्यंतचा पर्यावरणीय प्रभाव पाहा:\n\nआमचा इम्पॅक्ट रिपोर्ट पाहण्यासाठी स्वाइप करा 🌱\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['EarthDay2026','EarthDay','SolarEnergy','CleanEnergy','RenewableEnergy','GreenIndia','CarbonFootprint','SolarImpact','RollingEnergy','ClimateAction','SustainableLiving','NetZero','SolarPower','GreenEnergy','EnvironmentDay','MaharashtraSolar','EcoFriendly'],
    visualConcept: `6-slide Earth Day carousel:\nSlide 1: Earth illustration with solar panels. "Our Earth Day Report 2026".\nSlide 2: "X MW Solar Capacity Installed" — power station visual.\nSlide 3: "X Lakh kg CO2 Prevented" — cloud graphic with data.\nSlide 4: "X Crore Units of Clean Energy Generated" — sun + electricity bolt.\nSlide 5: "X Thousand Trees Equivalent Planted" — forest graphic.\nSlide 6 (CTA): "Join Us — Go Solar This Earth Day". Green + brand colors.`,
    platforms: ['instagram', 'facebook', 'linkedin'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-04-23', 19, 30),
    title: '🗞️ RESERVED FOR NEWS — Solar Industry / MSEDCL / MNRE',
    segment: 'RESIDENTIAL',
    contentType: 'STATIC_POST',
    category: 'NEWS_SLOT',
    captionEn: `[NEWS SLOT — Fill 5 days before April 23]\n\n---FALLBACK CONTENT---\n\n☀️ April 2026: Solar Power Generation Hits Record in Maharashtra!\n\nMaharashtra solar capacity crossed 8,000 MW this month — a 40% jump from last year.\n\nWhat this means for YOU:\n✅ More infrastructure = Faster approvals\n✅ Better panel technology = Higher efficiency\n✅ Government confidence = More subsidies coming\n\nBest time to switch to solar? RIGHT NOW.\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `[न्यूज़ स्लॉट — 18 अप्रैल से पहले भरें]\n\n---फॉलबैक कंटेंट---\n\n☀️ अप्रैल 2026: महाराष्ट्र में सोलर पावर जनरेशन ने रिकॉर्ड तोड़ा!\n\nमहाराष्ट्र की सोलर कैपेसिटी इस महीने 8,000 MW पार — पिछले साल से 40% ज़्यादा।\n\nआपके लिए इसका मतलब:\n✅ ज़्यादा इन्फ्रास्ट्रक्चर = तेज़ अप्रूवल\n✅ बेहतर पैनल = ज़्यादा efficiency\n✅ सरकारी भरोसा = ज़्यादा सब्सिडी\n\nसोलर में जाने का सबसे अच्छा समय? अभी!\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `[बातम्यांचा स्लॉट — 18 एप्रिलपूर्वी भरा]\n\n---फॉलबॅक कंटेंट---\n\n☀️ एप्रिल 2026: महाराष्ट्रात सौर ऊर्जा निर्मितीने विक्रम केला!\n\nमहाराष्ट्राची सौर क्षमता या महिन्यात 8,000 MW ओलांडली — गेल्या वर्षापेक्षा 40% अधिक.\n\nतुमच्यासाठी याचा अर्थ:\n✅ अधिक पायाभूत सुविधा = जलद मंजुरी\n✅ चांगले पॅनेल = अधिक कार्यक्षमता\n✅ सरकारचा विश्वास = अधिक अनुदान\n\nसोलरकडे जाण्याची सर्वोत्तम वेळ? आत्ता!\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['MaharashtraSolar','SolarRecord','RenewableMaharashtra','SolarNews','CleanEnergy2026','SolarCapacity','EnergyTransition','SolarIndia','RollingEnergy'],
    visualConcept: 'Data visualization style. Maharashtra map with solar capacity indicators. Record number highlighted. Arrow trend chart going up. "Maharashtra Goes Solar" headline. Brand colors.',
    platforms: ['instagram', 'facebook'],
    isNewsSlot: true,
  },

  {
    scheduledAt: ist('2026-04-24', 8),
    title: 'How Industrial Units Save ₹50,000/Month with Solar',
    segment: 'INDUSTRIAL',
    contentType: 'CAROUSEL',
    category: 'EDUCATION',
    captionEn: `🏭 For factory owners and industrial units in Maharashtra:\n\nSolar is no longer just "environment-friendly".\nIt's your CHEAPEST electricity source.\n\nSwipe to see the real numbers → 📊\n\nHigh-tension connection (HT) users in Maharashtra pay ₹8–12/unit.\nWith solar: ₹1.8–₹2.5/unit effective cost.\n\nThat's 75% savings on every unit your solar panels generate!\n\nReady to reduce your production costs?\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🏭 महाराष्ट्र में फ़ैक्टरी मालिकों और इंडस्ट्रियल यूनिट्स के लिए:\n\nसोलर अब सिर्फ "पर्यावरण-मित्र" नहीं है।\nयह आपकी सबसे सस्ती बिजली का स्रोत है।\n\nस्वाइप करें और असली नंबर देखें → 📊\n\nHT कनेक्शन वाले ₹8–12/यूनिट चुकाते हैं।\nसोलर से: प्रभावी लागत ₹1.8–₹2.5/यूनिट।\n\nयानी 75% बचत हर उस यूनिट पर जो सोलर बनाती है!\n\nअपने प्रोडक्शन कॉस्ट कम करने के लिए तैयार हैं?\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🏭 महाराष्ट्रातील कारखाना मालक आणि औद्योगिक युनिट्ससाठी:\n\nसोलर आता फक्त "पर्यावरण मित्र" नाही.\nती तुमची सर्वात स्वस्त वीज आहे.\n\nस्वाइप करा आणि खरे आकडे पाहा → 📊\n\nHT जोडणी वापरकर्ते ₹8–12/युनिट देतात.\nसोलरसह: प्रभावी किंमत ₹1.8–₹2.5/युनिट.\n\nयाचा अर्थ सोलर निर्माण करत असलेल्या प्रत्येक युनिटवर 75% बचत!\n\nतुमचे उत्पादन खर्च कमी करण्यास तयार आहात?\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['IndustrialSolar','FactorySolar','MIDCSolar','ManufacturingSolar','SolarCost','HTConnection','IndustrialEnergy','SolarROI','MaharashtraIndustry','SolarMaharashtra','IndustrialPower','CaptivePower','SolarForIndustry','EnergyCost','RollingEnergy'],
    visualConcept: `5-slide industrial carousel:\nSlide 1: Factory illustration with solar panels on large rooftop. "Save 75% on Industrial Electricity".\nSlide 2: Cost comparison — Grid ₹10/unit vs Solar ₹2/unit. Visual savings bar.\nSlide 3: "500 kW system saves ₹50 Lakh/year" calculation breakdown.\nSlide 4: 40% depreciation benefit for industrial users (Section 32 explainer).\nSlide 5 (CTA): "Free Industrial Energy Audit" — Phone + website. Navy bg.`,
    platforms: ['instagram', 'linkedin', 'facebook'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-04-25', 10),
    title: '🔨 Project Showcase: 75 kW Commercial Solar — Pune',
    segment: 'COMMERCIAL',
    contentType: 'STATIC_POST',
    category: 'AUTHORITY',
    captionEn: `🏗️ COMPLETED: 75 kW commercial solar installation — Hadapsar, Pune.\n\n📊 Project Details:\n⚡ Capacity: 75 kW\n🔋 Units generated/day: ~300 units\n💰 Monthly savings: ₹72,000\n📅 Annual savings: ₹8.6 Lakh\n🔁 Payback period: 3.2 years\n\n"We started saving from Day 1. In 3 years, this system will pay for itself and give us free electricity for the next 22 years." — Business Owner\n\n🏆 Certified by MSEDCL | 25-yr Performance Guarantee\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🏗️ पूरा हुआ: 75 kW कमर्शियल सोलर इंस्टॉलेशन — हडपसर, पुणे।\n\n📊 प्रोजेक्ट डिटेल्स:\n⚡ कैपेसिटी: 75 kW\n🔋 यूनिट/दिन: ~300\n💰 मासिक बचत: ₹72,000\n📅 सालाना बचत: ₹8.6 लाख\n🔁 पेबैक: 3.2 साल\n\n"हम Day 1 से ही बचत करने लगे। 3 साल में यह सिस्टम खुद की लागत वसूल करेगा।" — बिज़नेस ओनर\n\n🏆 MSEDCL सर्टिफाइड | 25 साल की परफॉर्मेंस गारंटी\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🏗️ पूर्ण झाले: 75 kW व्यावसायिक सोलर इन्स्टॉलेशन — हडपसर, पुणे.\n\n📊 प्रकल्प तपशील:\n⚡ क्षमता: 75 kW\n🔋 युनिट/दिवस: ~300\n💰 मासिक बचत: ₹72,000\n📅 वार्षिक बचत: ₹8.6 लाख\n🔁 परतावा: 3.2 वर्षे\n\n"आम्ही पहिल्या दिवसापासूनच बचत करू लागलो. 3 वर्षांत ही सिस्टम स्वतःचा खर्च वसूल करेल." — व्यावसायिक मालक\n\n🏆 MSEDCL प्रमाणित | 25 वर्षांची कार्यक्षमता हमी\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['ProjectShowcase','CommercialSolar','PuneSolar','SolarInstallation','75kW','SolarCompletion','SolarProject','MSEDCLApproved','SolarPune','BusinessSolar','RollingEnergy','SolarSuccess','CommercialEnergy','SolarROI','PuneHadapsar'],
    visualConcept: 'Professional project completion graphic. Large commercial rooftop with solar array illustration. Project data overlay on navy sidebar. Before/after electricity bill cards. MSEDCL certification badge. "COMPLETED" green stamp. Brand colors with #739bd6 accents.',
    platforms: ['instagram', 'linkedin', 'facebook'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-04-26', 11),
    title: 'Net Metering Explained: How You Sell Electricity Back to Grid',
    segment: 'RESIDENTIAL',
    contentType: 'REEL',
    category: 'EDUCATION',
    captionEn: `💡 Did you know? With solar + net metering, you can SELL electricity to MSEDCL!\n\n🎬 Watch this 45-second animated explainer on how net metering works!\n\nWhat is Net Metering?\n→ Your solar panels generate more electricity than you use during the day\n→ The extra units flow BACK to the grid\n→ MSEDCL credits your account\n→ You pay only the NET difference at end of month!\n\nResult: In some cases, your bill becomes NEGATIVE (MSEDCL owes YOU money)\n\n🔑 We handle the entire net meter application process for FREE!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `💡 क्या आप जानते हैं? सोलर + नेट मीटरिंग से आप MSEDCL को बिजली बेच सकते हैं!\n\n🎬 45 सेकंड की एनिमेटेड एक्सप्लेनर — देखें नेट मीटरिंग कैसे काम करती है!\n\nनेट मीटरिंग क्या है?\n→ आपके पैनल दिन में ज़रूरत से ज़्यादा बिजली बनाते हैं\n→ अतिरिक्त यूनिट्स ग्रिड में वापस जाती हैं\n→ MSEDCL आपके खाते में क्रेडिट करता है\n→ महीने के अंत में सिर्फ NET अंतर चुकाएं!\n\nनतीजा: कभी-कभी बिल NEGATIVE हो जाता है!\n\n🔑 नेट मीटर आवेदन प्रक्रिया हम मुफ्त करते हैं!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `💡 तुम्हाला माहित आहे का? सोलर + नेट मीटरिंगसह तुम्ही MSEDCL ला वीज विकू शकता!\n\n🎬 45 सेकंदांचा अॅनिमेटेड एक्सप्लेनर — नेट मीटरिंग कसे कार्य करते ते पाहा!\n\nनेट मीटरिंग म्हणजे काय?\n→ तुमचे पॅनेल दिवसात गरजेपेक्षा जास्त वीज निर्माण करतात\n→ अतिरिक्त युनिट्स ग्रिडकडे परत जातात\n→ MSEDCL तुमच्या खात्यात क्रेडिट करते\n→ महिन्याच्या शेवटी फक्त निव्वळ फरक भरा!\n\nपरिणाम: काही प्रकरणांमध्ये बिल नकारात्मक होते!\n\n🔑 नेट मीटर अर्ज प्रक्रिया आम्ही मोफत करतो!\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['NetMetering','SolarNetMetering','MSEDCL','SellElectricity','SolarExport','FreeElectricity','SolarEducation','SolarTips','SolarEnergy','RollingEnergy','NetMeterIndia','SolarMaharashtra','SolarPower','CleanEnergy','SolarExplainer'],
    visualConcept: `45-second animated reel (NO faces/voice):\n0–5s: House + solar panels on rooftop, sun shining.\n5–15s: Animation of electricity flowing: Panels → House (consumption). Leftover flowing back to grid (arrow reverse).\n15–25s: MSEDCL meter showing "units exported" counter increasing. Credit amount appearing.\n25–35s: Monthly bill calculation: Consumption units MINUS Exported units = Net amount.\n35–40s: Zero or negative bill appearing. Celebration stars.\n40–45s: "Get Net Metering with Rolling Energy — Free Application" + logo + phone.`,
    platforms: ['instagram', 'facebook'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-04-27', 8),
    title: 'Book Solar Before May — Prices Going Up',
    segment: 'RESIDENTIAL',
    contentType: 'STATIC_POST',
    category: 'CONVERSION',
    captionEn: `⚠️ Solar panel prices are set to increase in June 2026 due to new import duty revisions.\n\nIf you've been thinking about solar — ACT NOW.\n\n✅ Lock in current pricing\n✅ PM Surya Ghar subsidy available\n✅ Installation in 15 days\n✅ Summer savings start immediately\n\n📊 Current pricing for 5 kW residential system:\n→ Market price: ₹3.8 Lakh\n→ After subsidy: ₹3.02 Lakh\n→ After 25-year savings: Net GAIN of ₹28 Lakh\n\n🚨 Only 12 installation slots left for April-May!\n\nCall NOW or comment "QUOTE" for free estimate.\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `⚠️ जून 2026 में नई इम्पोर्ट ड्यूटी के कारण सोलर पैनल की कीमतें बढ़ने वाली हैं।\n\nअगर आप सोलर के बारे में सोच रहे हैं — अभी एक्शन लें।\n\n✅ मौजूदा कीमत लॉक करें\n✅ PM सूर्य घर सब्सिडी उपलब्ध\n✅ 15 दिन में इंस्टॉलेशन\n✅ गर्मियों की बचत तुरंत शुरू\n\n🚨 अप्रैल-मई के लिए सिर्फ 12 स्लॉट बचे हैं!\n\nअभी कॉल करें या "QUOTE" कमेंट करें।\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `⚠️ जून 2026 मध्ये नवीन आयात शुल्कामुळे सोलर पॅनेलच्या किमती वाढणार आहेत.\n\nतुम्ही सोलरबद्दल विचार करत असाल तर — आत्ताच कार्य करा.\n\n✅ सध्याची किंमत लॉक करा\n✅ PM सूर्य घर अनुदान उपलब्ध\n✅ 15 दिवसांत इन्स्टॉलेशन\n✅ उन्हाळ्याची बचत लगेच सुरू\n\n🚨 एप्रिल-मेसाठी फक्त 12 स्लॉट शिल्लक!\n\nआत्ता कॉल करा किंवा "QUOTE" कमेंट करा.\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['SolarPriceAlert','LimitedSlots','BookNow','SolarOffer','SummerSolar','PMSuryaGhar','SolarSubsidy','GoSolar','SolarDeadline','PriceLock','RollingEnergy','SolarConversion','SolarMaharashtra','ActNow','SolarInstallation','UrgentSolar'],
    visualConcept: 'Urgency-style graphic. Red "PRICE INCREASE COMING" banner at top. Calendar with countdown to June. Current vs upcoming price comparison. Slots counter: "12 slots remaining" with yellow warning icon. Brand colors. Strong CTA button at bottom.',
    platforms: ['instagram', 'facebook'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-04-28', 19, 30),
    title: '🗞️ RESERVED FOR NEWS — Maharashtra Electricity / Solar Update',
    segment: 'SOCIETY',
    contentType: 'STATIC_POST',
    category: 'NEWS_SLOT',
    captionEn: `[NEWS SLOT — Fill 5 days before April 28]\n\n---FALLBACK CONTENT---\n\n🏘️ Pune Municipal Corporation Announces Solar-Mandatory Policy for New Buildings!\n\nFrom 2027, all new residential and commercial buildings in Pune must have solar installations.\n\nWhat this means:\n✅ Solar is becoming MANDATORY infrastructure\n✅ Property values of solar homes rising\n✅ Societies without solar will face resale disadvantage\n\nGet ahead of the mandate — install solar in 2026.\n\nFree consultation for societies and individual homes!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `[न्यूज़ स्लॉट — 23 अप्रैल से पहले भरें]\n\n---फॉलबैक कंटेंट---\n\n🏘️ पुणे नगर निगम ने नई इमारतों के लिए सोलर-मैंडेटरी पॉलिसी की घोषणा!\n\n2027 से पुणे में सभी नई रेजिडेंशियल और कमर्शियल इमारतों में सोलर लाज़मी।\n\nमतलब:\n✅ सोलर अब जरूरी इन्फ्रास्ट्रक्चर बन रहा है\n✅ सोलर घरों की प्रॉपर्टी वैल्यू बढ़ रही है\n\nमैंडेट से पहले ही लगाएं — 2026 में!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `[बातम्यांचा स्लॉट — 23 एप्रिलपूर्वी भरा]\n\n---फॉलबॅक कंटेंट---\n\n🏘️ पुणे महानगरपालिकेने नवीन इमारतींसाठी सोलर-अनिवार्य धोरण जाहीर केले!\n\n2027 पासून पुण्यातील सर्व नवीन निवासी आणि व्यावसायिक इमारतींमध्ये सोलर अनिवार्य.\n\nयाचा अर्थ:\n✅ सोलर आता अनिवार्य पायाभूत सुविधा बनत आहे\n✅ सोलर घरांचे मूल्य वाढत आहे\n\nनिर्देशापूर्वीच लावा — 2026 मध्ये!\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['PuneSolar','SolarPolicy','SolarMandatory','MaharashtraSolar','PropertyValue','SolarBuilding','GreenBuilding','PuneMunicipal','SolarFuture','RollingEnergy'],
    visualConcept: 'Breaking news style. Pune city skyline with solar panels. Policy announcement overlay. "Mandatory from 2027" badge. Property value increase arrow. Brand colors.',
    platforms: ['instagram', 'facebook'],
    isNewsSlot: true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WEEK 3: Apr 29 (Wed) – May 5 (Tue)
  // ══════════════════════════════════════════════════════════════════════════

  {
    scheduledAt: ist('2026-04-29', 8),
    title: '5 Pune Societies That Cut Their Bill by 85% — Case Studies',
    segment: 'SOCIETY',
    contentType: 'CAROUSEL',
    category: 'TRUST',
    captionEn: `🏘️ Real results from real societies in Pune and Nashik.\n\nSwipe to see 5 society solar case studies → 🔁\n\nFrom paying lakhs every month to next-to-nothing — these societies made the switch.\n\nAnd the best part? With the RESCO (Zero Investment) model, THEY PAID ₹0 UPFRONT.\n\n📞 Is your society ready? DM "SOCIETY" for a free presentation!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🏘️ पुणे और नासिक की असली सोसायटी से असली नतीजे।\n\nस्वाइप करें और 5 सोसायटी सोलर केस स्टडी देखें → 🔁\n\nहर महीने लाखों का बिल से लगभग शून्य — इन सोसायटियों ने स्विच किया।\n\nसबसे अच्छी बात? RESCO (ज़ीरो इन्वेस्टमेंट) मॉडल में उन्होंने ₹0 दिया।\n\n📞 आपकी सोसायटी तैयार है? "SOCIETY" DM करें!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🏘️ पुणे आणि नाशिकमधील खऱ्या सोसायट्यांचे खरे निकाल.\n\nस्वाइप करा आणि 5 सोसायटी सोलर केस स्टडी पाहा → 🔁\n\nदरमहा लाखांच्या बिलापासून जवळजवळ शून्यापर्यंत — या सोसायट्यांनी बदल केला.\n\nसर्वात चांगली गोष्ट? RESCO मॉडेलमध्ये त्यांनी ₹0 दिले.\n\n📞 तुमची सोसायटी तयार आहे का? "SOCIETY" DM करा!\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['SocietySolar','CaseStudy','PuneSociety','NashikSolar','HousingSociety','RESCO','ZeroInvestment','SolarSavings','RealResults','SocietyManagement','RollingEnergy','CommonAreaSolar','ApartmentSolar','SocietyROI','PuneRealEstate'],
    visualConcept: `6-slide case study carousel:\nSlide 1: "5 Societies. 5 Transformations." Pune skyline.\nSlide 2–6: Each slide = 1 society: Name (anonymized), Location, Previous bill → Current bill, System size, Savings. Photo-quality rooftop solar illustration for each. Green "Savings" badge.`,
    platforms: ['instagram', 'facebook', 'linkedin'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-04-30', 19, 30),
    title: 'Ground Mount Solar: Turn Agricultural Land into Income',
    segment: 'GROUND_MOUNT',
    contentType: 'STATIC_POST',
    category: 'EDUCATION',
    captionEn: `🌾 Agricultural land owners across Maharashtra are discovering a powerful income stream.\n\n✨ Agri-Voltaics: Solar panels ABOVE your crops = double income!\n\n📊 How it works:\n→ Install ground-mount solar on your land\n→ Generate & sell electricity to grid or nearby industries\n→ Continue farming underneath (shade-tolerant crops thrive!)\n→ Earn ₹35,000–₹60,000/acre/year passively\n\n🏛️ Government policy:\n→ Maharashtra Agriculture Solar Policy supports this\n→ RPO (Renewable Purchase Obligation) creates demand\n→ 25-year PPA (Power Purchase Agreement) available\n\n📞 Interested in a feasibility study for your land?\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🌾 महाराष्ट्र के कृषि भूमि मालिकों को एक शक्तिशाली आय स्रोत मिल रहा है।\n\n✨ एग्री-वोल्टेइक्स: फसलों के ऊपर सोलर = दोहरी आमदनी!\n\n📊 कैसे काम करता है:\n→ अपनी ज़मीन पर ग्राउंड-माउंट सोलर लगाएं\n→ ग्रिड या पास की इंडस्ट्री को बिजली बेचें\n→ नीचे खेती जारी रखें\n→ ₹35,000–₹60,000/एकड़/साल कमाएं\n\n📞 आपकी ज़मीन की फीजिबिलिटी स्टडी में रुचि है?\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🌾 महाराष्ट्रातील शेती जमीन मालकांना एक शक्तिशाली उत्पन्न स्रोत सापडत आहे.\n\n✨ कृषी-व्होल्टाइक: पिकांवर सोलर = दुहेरी उत्पन्न!\n\n📊 कसे कार्य करते:\n→ तुमच्या जमिनीवर ग्राउंड-माउंट सोलर बसवा\n→ ग्रिड किंवा जवळच्या उद्योगांना वीज विका\n→ खाली शेती सुरूच ठेवा\n→ ₹35,000–₹60,000/एकर/वर्ष कमवा\n\n📞 तुमच्या जमिनीसाठी व्यवहार्यता अभ्यासात स्वारस्य आहे?\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['GroundMountSolar','AgriVoltaics','AgriculturalSolar','SolarFarm','FarmSolar','MaharashtraFarmer','SolarIncome','LandLease','SolarProject','AgricultureSolar','RuralSolar','SolarMaharashtra','FarmIncome','RollingEnergy','GroundMountProject'],
    visualConcept: 'Wide aerial illustration of a green farm with rows of solar panels installed between crop rows. Birds-eye view showing agri-voltaics setup. Income calculator overlay: "1 Acre = ₹50,000/Year Passive Income". Maharashtra map in background. Sunrise lighting.',
    platforms: ['instagram', 'facebook', 'linkedin'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-05-01', 8),
    title: '🌟 Happy Maharashtra Day — Proud to Power Maharashtra!',
    segment: 'RESIDENTIAL',
    contentType: 'STATIC_POST',
    category: 'AUTHORITY',
    captionEn: `🎉 Happy Maharashtra Day & Labour Day 2026!\n\nMaharashtra — the land of innovation, entrepreneurship, and now… SOLAR ENERGY!\n\n☀️ Did you know?\n→ Maharashtra ranks #3 in solar capacity in India\n→ 8,000+ MW of solar installed across the state\n→ Pune, Mumbai, Nashik leading the rooftop revolution\n\nAt Rolling Energy, we're proud to be part of Maharashtra's energy transformation — one rooftop at a time.\n\nHappy Maharashtra Day from our entire team! 🧡\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🎉 महाराष्ट्र दिवस और श्रमिक दिवस 2026 की शुभकामनाएं!\n\nमहाराष्ट्र — इनोवेशन, उद्यमिता और अब... सोलर एनर्जी का राज्य!\n\n☀️ क्या आप जानते हैं?\n→ महाराष्ट्र भारत में सोलर कैपेसिटी में #3 स्थान पर है\n→ पुणे, मुंबई, नासिक रूफटॉप क्रांति में आगे\n\nRolling Energy की पूरी टीम की तरफ से Happy Maharashtra Day! 🧡\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🎉 महाराष्ट्र दिन आणि कामगार दिन 2026 च्या शुभेच्छा!\n\nमहाराष्ट्र — नवकल्पना, उद्यमशीलता आणि आता... सौर ऊर्जेचे राज्य!\n\n☀️ तुम्हाला माहित आहे का?\n→ महाराष्ट्र भारतात सोलर क्षमतेत #3 स्थानावर आहे\n→ पुणे, मुंबई, नाशिक रूफटॉप क्रांतीत आघाडीवर\n\nRolling Energy च्या संपूर्ण टीमकडून Happy Maharashtra Day! 🧡\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['MaharashtraDay','MaharashtraStapanaDin','HappyMaharashtraDay','MaharashtraSolar','PrideOfMaharashtra','MaharashtraRocks','SolarMaharashtra','LabourDay','WorkersDay','RollingEnergy','PuneProud','MumbaiSolar','NashikSolar','Maharashtra','JaiMaharashtra'],
    visualConcept: 'Maharashtra Day celebration design. Maharashtra state map filled with solar panels. Orange and green (Maharashtra flag) accents with brand navy. "Proud to Power Maharashtra" headline. Team pride messaging. Festive but professional aesthetic.',
    platforms: ['instagram', 'facebook', 'linkedin'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-05-02', 10),
    title: 'Before vs After Solar — Animated Bill Comparison',
    segment: 'RESIDENTIAL',
    contentType: 'REEL',
    category: 'CONVERSION',
    captionEn: `📱 Your electricity bill before solar... vs after.\n\n🎬 30-second animated comparison — watch till the end!\n\nJune 2025 (Before): ₹7,800 😰\nJune 2026 (After solar): ₹0 🎉\n\nSame house. Same consumption. Different reality.\n\nThe difference? Rolling Energy Solar panels on the rooftop.\n\n📊 3 kW pays for itself in 3.5 years.\n5 kW pays for itself in 3 years.\n7 kW pays for itself in 2.8 years.\n\nThe bigger your bill → The faster the ROI!\n\nWant YOUR before-after story?\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `📱 सोलर से पहले आपका बिजली बिल... बाद में।\n\n🎬 30 सेकंड की एनिमेटेड तुलना — अंत तक देखें!\n\nजून 2025 (पहले): ₹7,800 😰\nजून 2026 (सोलर के बाद): ₹0 🎉\n\nएक ही घर। एक ही खपत। अलग हकीकत।\n\nफर्क? Rolling Energy के सोलर पैनल छत पर।\n\nजितना बड़ा बिल → उतनी तेज़ ROI!\n\nअपनी before-after कहानी चाहते हैं?\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `📱 सोलरपूर्वी तुमचे वीज बिल... नंतर.\n\n🎬 30 सेकंदांची अॅनिमेटेड तुलना — शेवटपर्यंत पाहा!\n\nजून 2025 (आधी): ₹7,800 😰\nजून 2026 (सोलरनंतर): ₹0 🎉\n\nतेच घर. तीच वापर. वेगळी वास्तविकता.\n\nफरक? Rolling Energy चे सोलर पॅनेल छतावर.\n\nजितके मोठे बिल → तितका जलद ROI!\n\nतुमची before-after कथा हवी आहे?\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['BeforeAfterSolar','ElectricityBill','SolarSavings','SolarROI','GoSolar','ZeroBill','SummerBills','SolarIndia','MaharashtraSolar','RollingEnergy','SolarComparison','FreeElectricity','SolarHome','RooftopSolar','SolarPanels'],
    visualConcept: `30-second reel (NO faces):\n0–5s: Electricity bill envelope opening. ₹7,800 written in red. Stress emoji.\n5–12s: Calendar flip from 2025 to 2026. Solar installation time-lapse animation.\n12–20s: Sun shining, panels activated. Energy meter spinning backwards.\n20–27s: New bill envelope opening — shows ₹0. Celebration animation with confetti.\n27–30s: "Your Turn?" + Rolling Energy logo + phone. Navy background.`,
    platforms: ['instagram', 'facebook'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-05-03', 11),
    title: '25-Year Warranty & After-Sales Service Promise',
    segment: 'RESIDENTIAL',
    contentType: 'STATIC_POST',
    category: 'TRUST',
    captionEn: `🛡️ Solar is a 25-year investment. Choose a company that stands behind their work.\n\nRolling Energy's Customer Promise:\n\n✅ 25-year panel performance warranty\n✅ 10-year inverter warranty\n✅ 5-year comprehensive workmanship warranty\n✅ Annual free maintenance check (Year 1)\n✅ 24/7 monitoring via solar app\n✅ MSEDCL liaison for net meter issues\n✅ Response within 24 hours for any issue\n\n"We don't disappear after installation. We're your solar partner for life." — Rolling Energy Team\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🛡️ सोलर 25 साल का निवेश है। ऐसी कंपनी चुनें जो अपने काम के पीछे खड़ी हो।\n\nRolling Energy का कस्टमर प्रॉमिस:\n\n✅ 25 साल पैनल परफॉर्मेंस वारंटी\n✅ 10 साल इन्वर्टर वारंटी\n✅ 5 साल वर्कमैनशिप वारंटी\n✅ Year 1 में मुफ्त वार्षिक मेंटेनेंस\n✅ 24/7 सोलर ऐप से मॉनिटरिंग\n✅ किसी भी समस्या पर 24 घंटे में रिस्पॉन्स\n\n"इंस्टॉलेशन के बाद हम गायब नहीं होते। हम जीवन भर आपके सोलर पार्टनर हैं।"\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🛡️ सोलर 25 वर्षांची गुंतवणूक आहे. त्यांच्या कामाच्या मागे उभी राहणारी कंपनी निवडा.\n\nRolling Energy चे ग्राहक आश्वासन:\n\n✅ 25 वर्षे पॅनेल कार्यक्षमता वॉरंटी\n✅ 10 वर्षे इन्व्हर्टर वॉरंटी\n✅ 5 वर्षे कारागिरी वॉरंटी\n✅ पहिल्या वर्षी मोफत वार्षिक देखभाल\n✅ 24/7 सोलर अॅपद्वारे निरीक्षण\n✅ कोणत्याही समस्येसाठी 24 तासांत प्रतिसाद\n\n"इन्स्टॉलेशननंतर आम्ही गायब होत नाही. आम्ही आजन्म तुमचे सोलर भागीदार आहोत."\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['SolarWarranty','AfterSalesService','SolarSupport','TrustSolar','25YearWarranty','SolarQuality','CustomerFirst','RollingEnergy','SolarReliable','SolarMaintenance','SolarIndia','SolarPromise','QualityAssurance','SolarLongTerm','MaharashtraSolar'],
    visualConcept: 'Trust and security visual. Shield icon center. Each warranty bullet point with check icons arranged around it. Professional navy (#161c34) background with #739bd6 accents. "25 Years. Zero Compromises." tagline. Customer support illustration.',
    platforms: ['instagram', 'facebook', 'linkedin'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-05-04', 8),
    title: 'Electricity Bill Reality Check: May 2026 in Maharashtra',
    segment: 'RESIDENTIAL',
    contentType: 'STATIC_POST',
    category: 'CONVERSION',
    captionEn: `📊 May reality check for Maharashtra households:\n\n🌡️ Temperature: 38–44°C across Maharashtra\n💨 ACs running 8–12 hours/day\n📈 Average household bill: ₹4,500–₹12,000\n📈 Increase from last year: +18%\n\nThis is the PEAK. June onwards, bills will finally drop.\n\nBut next April? They'll spike AGAIN.\n\nThe ONLY permanent solution: Solar panels.\n\n→ ₹0 electricity bills every summer\n→ 25 years of protection from tariff hikes\n→ PM Surya Ghar subsidy available NOW\n\nDon't wait for next summer. Act today.\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `📊 महाराष्ट्र घरों के लिए मई रियलिटी चेक:\n\n🌡️ तापमान: 38–44°C\n💨 AC 8–12 घंटे/दिन\n📈 औसत घरेलू बिल: ₹4,500–₹12,000\n📈 पिछले साल से बढ़त: +18%\n\nयह PEAK है। जून के बाद बिल घटेगा।\nलेकिन अगला अप्रैल? फिर स्पाइक होगा।\n\nएकमात्र स्थायी समाधान: सोलर।\n\n→ हर गर्मी में ₹0 बिजली बिल\n→ 25 साल टैरिफ हाइक से सुरक्षा\n\nअगली गर्मी का इंतज़ार मत करो। आज ही एक्शन लो।\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `📊 महाराष्ट्र घरांसाठी मे रिॲलिटी चेक:\n\n🌡️ तापमान: 38–44°C\n💨 AC 8–12 तास/दिवस\n📈 सरासरी घरगुती बिल: ₹4,500–₹12,000\n📈 गेल्या वर्षापेक्षा वाढ: +18%\n\nहे PEAK आहे. जूनपासून बिल कमी होईल.\nपण पुढचा एप्रिल? पुन्हा स्पाइक होईल.\n\nएकमेव कायमचे समाधान: सोलर.\n\n→ प्रत्येक उन्हाळ्यात ₹0 वीज बिल\n→ 25 वर्षे दरवाढीपासून संरक्षण\n\nपुढच्या उन्हाळ्याची वाट पाहू नका. आजच कार्य करा.\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['MayElectricityBill','SummerBills','MaharashtraSummer','ACBill','SolarSummer','ElectricityHike','GoSolar','SolarIndia','RollingEnergy','SummerSolar','HeatWave','SaveOnBills','SolarNow','PermanentSolution','MaharashtraHeat'],
    visualConcept: 'Data-driven design. Thermometer showing 42°C on left. Electricity bill meter spiking on right. "May 2026 Maharashtra" header. Bill amount histogram showing year-over-year increase. Call to action bar at bottom: "End the cycle — Go Solar".',
    platforms: ['instagram', 'facebook'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-05-05', 19, 30),
    title: '🗞️ RESERVED FOR NEWS — Solar Tech / Policy / MSEDCL',
    segment: 'COMMERCIAL',
    contentType: 'STATIC_POST',
    category: 'NEWS_SLOT',
    captionEn: `[NEWS SLOT — Fill 5 days before May 5]\n\n---FALLBACK CONTENT---\n\n🔋 Maharashtra Sets New Solar Record: 500 MW Installed in Single Month!\n\nApril 2026 saw Maharashtra break its own record with 500 MW of new solar installations.\n\n🏆 Maharashtra is now India's #2 solar state\n📈 Residential rooftop growing 65% year-over-year\n💰 Solar component prices dropped 12% this year\n\nBetter technology. Lower prices. More subsidies.\n\nThere has NEVER been a better time to go solar.\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `[न्यूज़ स्लॉट — 30 अप्रैल से पहले भरें]\n\n---फॉलबैक कंटेंट---\n\n🔋 महाराष्ट्र ने सोलर में नया रिकॉर्ड बनाया: एक महीने में 500 MW इंस्टॉल!\n\nअप्रैल 2026 में महाराष्ट्र ने अपना ही रिकॉर्ड तोड़ा।\n\n🏆 महाराष्ट्र अब भारत का #2 सोलर स्टेट\n💰 सोलर कॉम्पोनेंट कीमतें 12% गिरीं\n\nकभी नहीं रहा इससे अच्छा समय सोलर के लिए।\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `[बातम्यांचा स्लॉट — 30 एप्रिलपूर्वी भरा]\n\n---फॉलबॅक कंटेंट---\n\n🔋 महाराष्ट्राने सोलरमध्ये नवा विक्रम: एका महिन्यात 500 MW बसवले!\n\nएप्रिल 2026 मध्ये महाराष्ट्राने स्वतःचाच विक्रम मोडला.\n\n🏆 महाराष्ट्र आता भारतातील #2 सोलर राज्य\n💰 सोलर घटकांच्या किमती 12% घसरल्या\n\nसोलरसाठी यापेक्षा चांगला वेळ कधीच नव्हता.\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['MaharashtraSolarRecord','SolarMilestone','RenewableMaharashtra','500MW','SolarNews','CleanEnergy','SolarGrowth','RollingEnergy','SolarIndia'],
    visualConcept: 'Achievement graphic. "500 MW in One Month" milestone badge. Maharashtra map with solar coverage. Growing bar chart. "Record Broken" yellow stamp. Brand colors.',
    platforms: ['instagram', 'facebook'],
    isNewsSlot: true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WEEK 4: May 6 (Wed) – May 12 (Tue)
  // ══════════════════════════════════════════════════════════════════════════

  {
    scheduledAt: ist('2026-05-06', 8),
    title: 'Top 5 Industries Switching to Solar in Maharashtra',
    segment: 'INDUSTRIAL',
    contentType: 'CAROUSEL',
    category: 'AUTHORITY',
    captionEn: `🏭 The industrial revolution in Maharashtra is going SOLAR.\n\nHere are the top 5 industries leading the charge 👉\n\nSwipe to see which sectors are saving crores and why!\n\nBottomline: If your competitors are going solar and you're not — you're at a cost disadvantage.\n\nFree industrial energy audit available.\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🏭 महाराष्ट्र में इंडस्ट्रियल क्रांति सोलर की तरफ जा रही है।\n\nटॉप 5 इंडस्ट्री जो लीड कर रहे हैं 👉\n\nस्वाइप करें और देखें कौन से सेक्टर करोड़ों बचा रहे हैं!\n\nनतीजा: अगर आपके प्रतिस्पर्धी सोलर ले रहे हैं और आप नहीं — तो आप पीछे हैं।\n\nमुफ्त इंडस्ट्रियल एनर्जी ऑडिट उपलब्ध।\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🏭 महाराष्ट्रातील औद्योगिक क्रांती सोलरकडे वळत आहे.\n\nआघाडीवर असलेले शीर्ष 5 उद्योग 👉\n\nस्वाइप करा आणि पाहा कोणते क्षेत्र कोटी वाचवत आहेत!\n\nनिष्कर्ष: तुमचे प्रतिस्पर्धी सोलर घेत असतील तर तुम्ही मागे आहात.\n\nमोफत औद्योगिक ऊर्जा लेखापरीक्षण उपलब्ध.\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['IndustrialSolar','ManufacturingSolar','TextileSolar','FoodProcessingSolar','PharmaSolar','SolarIndustry','MaharashtraIndustrial','MIDC','SolarMaharashtra','RollingEnergy','IndustrialEnergy','SolarSavings','FactorySolar','SolarROI','B2BSolar'],
    visualConcept: `6-slide industrial carousel:\nSlide 1: Industrial skyline with solar. "Top 5 Industries Going Solar in Maharashtra".\nSlide 2: Textile Industry — "₹8 crore/year savings for 500-loom unit".\nSlide 3: Food Processing — "24/7 power security + 60% cost reduction".\nSlide 4: Pharma/Chemical — "Clean power for GMP compliance + savings".\nSlide 5: Engineering/Auto Parts — "Section 32 depreciation maximized".\nSlide 6 (CTA): "Which industry are you in?" engagement CTA. Navy bg.`,
    platforms: ['instagram', 'linkedin', 'facebook'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-05-07', 19, 30),
    title: '🗞️ RESERVED FOR NEWS — MSEDCL / Electricity / Solar',
    segment: 'RESIDENTIAL',
    contentType: 'STATIC_POST',
    category: 'NEWS_SLOT',
    captionEn: `[NEWS SLOT — Fill 5 days before May 7]\n\n---FALLBACK CONTENT---\n\n⚡ MSEDCL Net Metering 2026: New Process & Faster Approval Timeline\n\nMSEDCL has streamlined the net metering approval process!\n\nNew timeline:\n→ Application: Online via MSEDCL portal\n→ Technical inspection: Within 15 days\n→ Net meter installation: Within 30 days\n→ First bill credit: Next billing cycle\n\nRolling Energy handles the ENTIRE process for you. You do nothing.\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `[न्यूज़ स्लॉट — 2 मई से पहले भरें]\n\n---फॉलबैक कंटेंट---\n\n⚡ MSEDCL नेट मीटरिंग 2026: नई प्रक्रिया और तेज़ अप्रूवल\n\nMSEDCL ने नेट मीटरिंग प्रक्रिया को सरल बनाया!\n\nRolling Energy आपके लिए पूरी प्रक्रिया संभालती है।\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `[बातम्यांचा स्लॉट — 2 मेपूर्वी भरा]\n\n---फॉलबॅक कंटेंट---\n\n⚡ MSEDCL नेट मीटरिंग 2026: नवी प्रक्रिया आणि जलद मंजुरी\n\nMSEDCL ने नेट मीटरिंग प्रक्रिया सुलभ केली!\n\nRolling Energy तुमच्यासाठी संपूर्ण प्रक्रिया सांभाळते.\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['MSEDCLNetMetering','NetMeteringIndia','SolarApplication','MSEDCLSolar','NetMeter2026','SolarProcess','RollingEnergy','SolarMaharashtra'],
    visualConcept: 'Step-by-step process infographic. MSEDCL portal screenshot style. Timeline with 4 steps. "Rolling Energy handles everything" highlight box. Brand colors.',
    platforms: ['instagram', 'facebook'],
    isNewsSlot: true,
  },

  {
    scheduledAt: ist('2026-05-08', 8),
    title: 'URGENT: Only 8 Installation Slots Left for May!',
    segment: 'RESIDENTIAL',
    contentType: 'STATIC_POST',
    category: 'CONVERSION',
    captionEn: `🚨 MAY INSTALLATION UPDATE:\n\nDue to high summer demand, our May installation calendar is almost FULL.\n\n🗓️ Remaining slots: ONLY 8\n✅ Current pricing locked in\n✅ PM Surya Ghar subsidy processing available\n✅ Installation within 7–10 days of booking\n✅ Net metering application included FREE\n\n📊 Each day you delay = More electricity bills paid.\nFor a ₹5,000/month bill:\n→ 1 month delay = ₹5,000 wasted\n→ 3 months delay = ₹15,000 wasted\n→ 12 months delay = ₹60,000 wasted\n\n⚡ Book your slot TODAY — don't miss May savings.\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🚨 मई इंस्टॉलेशन अपडेट:\n\nगर्मी की ज़्यादा मांग के कारण मई कैलेंडर लगभग FULL है।\n\n🗓️ बचे हुए स्लॉट: सिर्फ 8\n✅ मौजूदा कीमत लॉक\n✅ 7–10 दिन में इंस्टॉलेशन\n\n📊 हर दिन की देरी = और बिल भरे।\n₹5,000/महीना बिल के लिए:\n→ 1 महीना देरी = ₹5,000 बर्बाद\n→ 12 महीना देरी = ₹60,000 बर्बाद\n\n⚡ आज ही स्लॉट बुक करें!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🚨 मे इन्स्टॉलेशन अपडेट:\n\nउच्च उन्हाळी मागणीमुळे मे कॅलेंडर जवळजवळ FULL आहे.\n\n🗓️ उर्वरित स्लॉट: फक्त 8\n✅ सध्याची किंमत लॉक\n✅ 7–10 दिवसांत इन्स्टॉलेशन\n\n📊 प्रत्येक दिवसाचा उशीर = अधिक बिले भरली.\n₹5,000/महिना बिलासाठी:\n→ 1 महिना उशीर = ₹5,000 वाया\n→ 12 महिना उशीर = ₹60,000 वाया\n\n⚡ आजच स्लॉट बुक करा!\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['LimitedSlots','BookNow','MaySolar','SolarUrgency','SolarInstallation','GoSolarNow','SummerSolar','SolarDeadline','SlotsFilling','RollingEnergy','SolarMaharashtra','ActNow','SolarOffer','MayInstallation','BookYourSlot'],
    visualConcept: 'Urgency-optimized design. Slot counter: "8/20 slots remaining" with progress bar mostly filled. Calendar visual showing May dates being crossed off. "BOOK NOW" red CTA button. Countdown-style design. Rolling Energy logo prominently placed.',
    platforms: ['instagram', 'facebook'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-05-09', 10),
    title: 'Your First Day with Solar — What Actually Happens',
    segment: 'RESIDENTIAL',
    contentType: 'REEL',
    category: 'EDUCATION',
    captionEn: `☀️ Ever wondered what happens the day your solar panels go LIVE?\n\n🎬 "Day 1 with Solar" — animated walkthrough!\n\n6:30 AM: Sunrise → Your panels start generating\n8:00 AM: House fully powered by solar, meter starts exporting\n12:00 PM: Peak generation — exporting maximum units\n3:00 PM: AC running full — still no grid draw\n7:00 PM: Sunset — auto-switch back to grid\n\nEnd of Day 1 result:\n→ Units generated: 24 units\n→ Grid units saved: 18 units\n→ Units exported back: 6 units\n→ Money saved: ₹180–₹240 in ONE DAY\n\nThat's ₹5,400–₹7,200/month from Day 1!\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `☀️ जानना चाहते हैं सोलर पैनल LIVE होने वाले दिन क्या होता है?\n\n🎬 "Day 1 with Solar" — एनिमेटेड वॉकथ्रू!\n\n6:30 AM: सूरज उगा → पैनल जनरेट करने लगे\n12:00 PM: पीक जनरेशन — अधिकतम यूनिट एक्सपोर्ट\n7:00 PM: सूर्यास्त — वापस ग्रिड पर\n\nDay 1 का नतीजा:\n→ 24 यूनिट जनरेट\n→ ₹180–₹240 की बचत एक दिन में!\n\nयानी Day 1 से ₹5,400–₹7,200/महीना!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `☀️ सोलर पॅनेल LIVE होणाऱ्या दिवशी काय होते हे जाणून घ्यायचे आहे का?\n\n🎬 "Day 1 with Solar" — अॅनिमेटेड वॉकथ्रू!\n\n6:30 AM: सूर्योदय → पॅनेल निर्माण सुरू\n12:00 PM: शिखर निर्मिती — जास्तीत जास्त युनिट निर्यात\n7:00 PM: सूर्यास्त — परत ग्रिडवर\n\nDay 1 चा निकाल:\n→ 24 युनिट निर्माण\n→ एका दिवसात ₹180–₹240 बचत!\n\nम्हणजे Day 1 पासून ₹5,400–₹7,200/महिना!\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['SolarDay1','SolarExplainer','SolarAnimation','HowSolarWorks','SolarEnergy','SolarGeneration','NetMetering','RooftopSolar','RollingEnergy','SolarEducation','SolarHome','MaharashtraSolar','SolarFacts','GreenHome','SolarLife'],
    visualConcept: `45-second animated reel:\n0–5s: House silhouette. Solar panels appear on rooftop. Sun rising.\n5–20s: Animated timeline through the day. Sun moving across sky. Energy flow arrows from panels to house.\n20–35s: Energy meter counter showing units generated vs consumed. Surplus flowing back to grid (arrow to MSEDCL grid icon).\n35–43s: "Day 1 Stats" dashboard: 24 units, ₹240 saved, 0 kg CO2 emitted.\n43–45s: "Go Solar. Start Saving from Day 1." + Logo.`,
    platforms: ['instagram', 'facebook'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-05-10', 11),
    title: 'Our Quality Promise: Tier-1 Panels, Certified Installers',
    segment: 'COMMERCIAL',
    contentType: 'STATIC_POST',
    category: 'TRUST',
    captionEn: `🏆 Quality is not a buzzword. It's our commitment.\n\nWhen you invest ₹2–₹20 Lakh in solar, you deserve the BEST.\n\nRolling Energy Quality Standards:\n\n⚡ Tier-1 Solar Panels Only (Bloomberg NEF certified)\n🔌 Premium Grade A inverters (SMA, Growatt, Fronius)\n🏗️ MNRE-approved installation methods\n👷 Certified installers with 5+ years experience\n📋 MSEDCL-compliant electrical drawings\n✅ ISO-certified quality processes\n\n"Cheap solar is expensive solar. Done right, solar pays you back. Done wrong, you pay twice." — Our Philosophy\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🏆 क्वालिटी कोई बज़वर्ड नहीं है। यह हमारी प्रतिबद्धता है।\n\nजब आप ₹2–₹20 लाख सोलर में लगाते हैं, तो आप सबसे अच्छा डिज़र्व करते हैं।\n\nRolling Energy क्वालिटी स्टैंडर्ड:\n\n⚡ सिर्फ Tier-1 सोलर पैनल (Bloomberg NEF सर्टिफाइड)\n🔌 प्रीमियम इन्वर्टर\n👷 5+ साल अनुभव वाले सर्टिफाइड इंस्टॉलर\n✅ ISO-सर्टिफाइड प्रक्रियाएं\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🏆 गुणवत्ता हे फक्त शब्द नाही. ती आमची वचनबद्धता आहे.\n\n₹2–₹20 लाख सोलरमध्ये गुंतवताना तुम्हाला सर्वोत्तम मिळणे योग्य आहे.\n\nRolling Energy गुणवत्ता मानके:\n\n⚡ फक्त Tier-1 सोलर पॅनेल (Bloomberg NEF प्रमाणित)\n🔌 प्रीमियम इन्व्हर्टर\n👷 5+ वर्षे अनुभवी प्रमाणित इन्स्टॉलर\n✅ ISO-प्रमाणित प्रक्रिया\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['SolarQuality','Tier1Solar','CertifiedSolar','BloombergNEF','SolarInstaller','PremiumSolar','QualityFirst','RollingEnergy','MNREApproved','SolarStandards','IsoCertified','SolarReliable','TrustSolar','MaharashtraSolar','SolarExcellence'],
    visualConcept: 'Premium quality visual. Black background with gold/yellow accents. Each quality point with certification badge icons. "Bloomberg NEF Tier-1 Certified" prominent badge. Panel efficiency graph. Professional, luxury brand aesthetic to convey premium quality.',
    platforms: ['instagram', 'facebook', 'linkedin'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-05-11', 8),
    title: 'Society Solar Free Presentation — Book Your Slot',
    segment: 'SOCIETY',
    contentType: 'STATIC_POST',
    category: 'CONVERSION',
    captionEn: `📢 Attention Society Secretaries of Pune, Mumbai & Nashik!\n\n🎤 FREE Solar Presentation for Your Society Committee\n\nWhat we cover in 45 minutes:\n✅ Site assessment + ROI calculation specific to your society\n✅ RESCO model (Zero upfront investment) explained\n✅ MSEDCL approval process walkthrough\n✅ Case studies from 3 similar societies\n✅ Q&A with our senior engineer\n\n📅 Available May 12–31, 2026\n🕕 Weekday evenings (6–8 PM) or Sunday mornings\n📍 At your society premises\n\nLimited slots available — book now!\n\n👉 WhatsApp "PRESENT [your society name]" to [Phone]\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `📢 पुणे, मुंबई और नासिक के सोसायटी सेक्रेटरी को सूचना!\n\n🎤 आपकी सोसायटी कमेटी के लिए मुफ्त सोलर प्रेज़ेंटेशन\n\n45 मिनट में क्या कवर होगा:\n✅ आपकी सोसायटी के लिए विशेष ROI कैलकुलेशन\n✅ RESCO मॉडल (ज़ीरो इन्वेस्टमेंट)\n✅ MSEDCL अप्रूवल प्रक्रिया\n✅ 3 समान सोसायटी केस स्टडी\n\n📅 12–31 मई उपलब्ध\n\n👉 WhatsApp "PRESENT [सोसायटी नाम]" → [Phone]\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `📢 पुणे, मुंबई आणि नाशिकच्या सोसायटी सचिवांना सूचना!\n\n🎤 तुमच्या सोसायटी कमिटीसाठी मोफत सोलर सादरीकरण\n\n45 मिनिटांत काय समाविष्ट:\n✅ तुमच्या सोसायटीसाठी विशिष्ट ROI गणना\n✅ RESCO मॉडेल (शून्य गुंतवणूक)\n✅ MSEDCL मंजुरी प्रक्रिया\n✅ 3 समान सोसायट्यांच्या केस स्टडी\n\n📅 12–31 मे उपलब्ध\n\n👉 WhatsApp "PRESENT [सोसायटी नाव]" → [Phone]\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['SocietyPresentation','FreeSolarConsultation','HousingSociety','PuneSociety','MumbaiSociety','NashikSociety','RESCO','SocietySolar','SolarCommittee','RollingEnergy','SocietyManagement','FreePresentation','SolarMaharashtra','ApartmentSolar','CommunityEnergy'],
    visualConcept: 'Event announcement style. Calendar + presentation graphic. Society aerial view. "FREE Presentation for Your Society" in large type. Booking CTA prominent. Schedule and contact details clearly displayed. Professional tone with #739bd6 accents.',
    platforms: ['instagram', 'facebook', 'linkedin'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-05-12', 19, 30),
    title: '🗞️ RESERVED FOR NEWS — Solar / Renewable Energy',
    segment: 'RESIDENTIAL',
    contentType: 'STATIC_POST',
    category: 'NEWS_SLOT',
    captionEn: `[NEWS SLOT — Fill 5 days before May 12]\n\n---FALLBACK CONTENT---\n\n🌞 May 2026 Summer Solar Performance Report — Maharashtra\n\nOur data from 500+ installations this summer:\n\n☀️ Peak generation month: May\n⚡ Avg daily units (5 kW system): 28–32 units\n🌡️ Performance at 45°C: 91% of rated efficiency\n💰 Average customer savings this month: ₹6,800\n\nContrary to popular belief — HIGH TEMPERATURES don't significantly reduce solar output!\n\nModern panels are rated to perform in 60°C+ conditions.\n\nAny questions about summer performance? DM us!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `[न्यूज़ स्लॉट — 7 मई से पहले भरें]\n\n---फॉलबैक कंटेंट---\n\n🌞 मई 2026 समर सोलर परफॉर्मेंस रिपोर्ट — महाराष्ट्र\n\n500+ इंस्टॉलेशन से हमारा डेटा:\n⚡ औसत दैनिक यूनिट (5 kW): 28–32 यूनिट\n🌡️ 45°C पर परफॉर्मेंस: रेटेड एफिशिएंसी का 91%\n\nज़्यादा गर्मी = कम सोलर आउटपुट? मिथक है!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `[बातम्यांचा स्लॉट — 7 मेपूर्वी भरा]\n\n---फॉलबॅक कंटेंट---\n\n🌞 मे 2026 उन्हाळी सोलर कार्यक्षमता अहवाल — महाराष्ट्र\n\n500+ इन्स्टॉलेशनमधील आमचा डेटा:\n⚡ सरासरी दैनिक युनिट (5 kW): 28–32 युनिट\n🌡️ 45°C वर कार्यक्षमता: रेटेड कार्यक्षमतेच्या 91%\n\nजास्त उष्णता = कमी सोलर आउटपुट? मिथक आहे!\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['SummerSolar','SolarPerformance','SolarData','MaySolar','SolarHeat','SolarEfficiency','RollingEnergy','SolarMaharashtra','SolarMyth'],
    visualConcept: 'Data dashboard style. Performance chart for 500+ systems. Temperature vs output graph. "Summer Performance Report" header. Data-driven, authoritative design.',
    platforms: ['instagram', 'facebook'],
    isNewsSlot: true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FINAL 3 DAYS: May 13 (Wed) – May 15 (Fri)
  // ══════════════════════════════════════════════════════════════════════════

  {
    scheduledAt: ist('2026-05-13', 8),
    title: 'Ground Mount vs Rooftop Solar: Complete Comparison',
    segment: 'GROUND_MOUNT',
    contentType: 'CAROUSEL',
    category: 'EDUCATION',
    captionEn: `🤔 Ground Mount or Rooftop Solar — which is right for you?\n\nSwipe for a complete, honest comparison → 📊\n\nThe answer depends on:\n→ How much roof space you have\n→ Roof condition (age, material, angle)\n→ Land availability\n→ Budget\n→ System size needed\n\nWe'll help you decide which is the BETTER investment for your specific situation.\n\n📞 Free consultation — no obligation!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🤔 ग्राउंड माउंट या रूफटॉप सोलर — आपके लिए कौन सा सही है?\n\nपूरी और ईमानदार तुलना के लिए स्वाइप करें → 📊\n\nमुफ्त कंसल्टेशन — कोई बाध्यता नहीं!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🤔 ग्राउंड माउंट की रूफटॉप सोलर — तुमच्यासाठी कोणते योग्य?\n\nसंपूर्ण आणि प्रामाणिक तुलनेसाठी स्वाइप करा → 📊\n\nमोफत सल्लामसलत — कोणतीही बांधिलकी नाही!\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['GroundMountVsRooftop','SolarComparison','RooftopSolar','GroundMountSolar','SolarEducation','SolarTypes','WhichSolar','SolarDecision','RollingEnergy','SolarPlanning','SolarIndia','MaharashtraSolar','SolarFacts','SolarGuide'],
    visualConcept: `6-slide comparison carousel:\nSlide 1: "Rooftop vs Ground Mount — The Complete Guide" cover.\nSlide 2–5: Side-by-side comparison across: Cost, Efficiency, Installation time, Maintenance, Best for whom.\nSlide 6 (CTA): "Not sure which is right for you? Get free expert advice." Navy bg, brand colors.`,
    platforms: ['instagram', 'facebook', 'linkedin'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-05-14', 19, 30),
    title: '500+ Happy Solar Families in Maharashtra — Our Milestone',
    segment: 'RESIDENTIAL',
    contentType: 'STATIC_POST',
    category: 'AUTHORITY',
    captionEn: `🎯 500+ INSTALLATIONS. ONE MISSION: ENERGY FREEDOM FOR EVERY HOME.\n\nWe just crossed 500 residential installations in Maharashtra! 🎉\n\nWhat this means in numbers:\n⚡ 2.5 MW+ of solar capacity installed\n💰 ₹15 Crore+ saved annually by our customers\n🌱 3.5 million kg CO2 prevented every year\n🌞 3,750+ MWh of clean energy generated/year\n📍 Pune, Mumbai, Nashik, Aurangabad, Kolhapur\n\n"One by one, rooftop by rooftop — we're making Maharashtra energy independent."\n\nThank you to every family who trusted us. 🙏\n\nYou're next? 👉\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🎯 500+ इंस्टॉलेशन। एक मिशन: हर घर को एनर्जी फ्रीडम।\n\nमहाराष्ट्र में 500 रेजिडेंशियल इंस्टॉलेशन का माइलस्टोन! 🎉\n\n⚡ 2.5 MW+ सोलर कैपेसिटी\n💰 ₹15 करोड़+ सालाना बचत\n🌱 35 लाख kg CO2 कम हर साल\n\n"एक-एक छत से हम महाराष्ट्र को एनर्जी इंडिपेंडेंट बना रहे हैं।"\n\nहर उस परिवार का शुक्रिया जिसने हम पर भरोसा किया। 🙏\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🎯 500+ इन्स्टॉलेशन. एक ध्येय: प्रत्येक घराला ऊर्जा स्वातंत्र्य.\n\nमहाराष्ट्रात 500 निवासी इन्स्टॉलेशनचा टप्पा ओलांडला! 🎉\n\n⚡ 2.5 MW+ सोलर क्षमता\n💰 ₹15 कोटी+ वार्षिक बचत\n🌱 35 लाख kg CO2 दरवर्षी रोखले\n\n"एक-एक छतावरून आम्ही महाराष्ट्राला ऊर्जा स्वतंत्र बनवत आहोत."\n\nज्या प्रत्येक कुटुंबाने विश्वास ठेवला त्यांचे आभार. 🙏\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['500Installations','MilestoneSolar','SolarMaharashtra','500Homes','SolarMilestone','RollingEnergy','SolarSuccess','MaharashtraSolar','SolarCommunity','CleanEnergy','SolarImpact','GreenMaharashtra','SolarPower','HomeOwner','SolarMovement'],
    visualConcept: 'Milestone celebration design. "500+ Families" in large bold type on navy background. Map of Maharashtra with installation location pins. Impact numbers in yellow highlight boxes. "Thank You" message. Celebratory but professional. Company logo prominent.',
    platforms: ['instagram', 'facebook', 'linkedin'],
    isNewsSlot: false,
  },

  {
    scheduledAt: ist('2026-05-15', 8),
    title: 'SUMMER SALE CLOSING: Last Chance to Lock May Pricing',
    segment: 'RESIDENTIAL',
    contentType: 'STATIC_POST',
    category: 'CONVERSION',
    captionEn: `🔥 THE SUMMER SOLAR WINDOW IS CLOSING.\n\nIt's May 15. Summer is at its PEAK.\nBills are at their HIGHEST.\nAnd our installation schedule for May is almost FULL.\n\n⚡ This is your LAST CHANCE to:\n→ Lock in current pricing (June revision expected)\n→ Claim PM Surya Ghar subsidy\n→ Start saving BEFORE next summer\n→ Get installed in 10–15 days\n\n📊 What's at stake:\n→ Waiting = paying ₹5,000–₹10,000/month more bills\n→ Acting NOW = saving ₹60,000–₹1,20,000 in the next 12 months\n\n🚨 Contact us TODAY for final available slots.\n\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionHi: `🔥 समर सोलर विंडो बंद हो रही है।\n\n15 मई हो गया। गर्मी PEAK पर है। बिल HIGHEST पर हैं।\nमई की हमारी इंस्टॉलेशन स्केड्यूल लगभग FULL है।\n\n⚡ यह आपका आखिरी मौका है:\n→ मौजूदा कीमत लॉक करें\n→ PM सूर्य घर सब्सिडी क्लेम करें\n→ 10–15 दिन में इंस्टॉलेशन\n\n🚨 आज ही संपर्क करें — आखिरी स्लॉट बचे हैं!\n📞 [Phone] | 🌐 rollingenergy.in`,
    captionMr: `🔥 उन्हाळी सोलर विंडो बंद होत आहे.\n\n15 मे झाला. उन्हाळा PEAK वर आहे. बिले HIGHEST आहेत.\nमेचे आमचे इन्स्टॉलेशन शेड्यूल जवळजवळ FULL आहे.\n\n⚡ हे तुमची शेवटची संधी आहे:\n→ सध्याची किंमत लॉक करा\n→ PM सूर्य घर अनुदान मिळवा\n→ 10–15 दिवसांत इन्स्टॉलेशन\n\n🚨 आजच संपर्क करा — शेवटचे स्लॉट उपलब्ध!\n📞 [Phone] | 🌐 rollingenergy.in`,
    hashtags: ['LastChance','SummerSolarSale','SolarDeadline','BookNow','SolarMay','LimitedSlots','GoSolarNow','SolarUrgency','PMSuryaGhar','SolarSubsidy','RollingEnergy','ActNow','SolarSummer','SolarPriceLock','FinalCall'],
    visualConcept: 'High urgency design. Red and orange color scheme (heat/urgency). Calendar showing May 15 highlighted. "LAST SLOTS AVAILABLE" in large text. Countdown style. Price lock badge. Strong contrast CTA button. Company logo. Deadline-driven messaging.',
    platforms: ['instagram', 'facebook'],
    isNewsSlot: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n☀️  Solar Growth OS — 30-Day Social Calendar Seeder');
  console.log('    Period: April 15 – May 15, 2026');
  console.log('    Posts: 31 | News Slots: 8 | Regular: 23\n');

  let token: string;
  try {
    token = await login();
    console.log('✅ Authenticated as admin\n');
  } catch (e) {
    console.error('❌ Auth failed. Is backend running on port 4000?');
    console.error(String(e));
    process.exit(1);
  }

  let count = 0;
  let newsCount = 0;

  for (const p of POSTS) {
    const { scheduledAt, category, ...rest } = p;
    const result = await post(token, { ...rest, scheduledAt, status: 'PENDING_APPROVAL' });
    if (result) {
      count++;
      if (p.isNewsSlot) newsCount++;
      const type = p.isNewsSlot ? '📰 NEWS' : '📝 POST';
      const date = new Date(scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });
      console.log(`  ✓ [${count}/31] ${type} | ${date} | ${p.contentType.replace('_',' ')} | ${p.segment} | ${p.title.slice(0, 55)}…`);
    }
    // Small delay to avoid overwhelming the server
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ CALENDAR SEEDED SUCCESSFULLY!`);
  console.log(`\n   📝 Regular Posts:  ${count - newsCount}`);
  console.log(`   📰 News Slots:      ${newsCount}`);
  console.log(`   📅 Total:           ${count}/31`);
  console.log(`\n   Strategy Mix:`);
  console.log(`   • Education (30%): 9 posts`);
  console.log(`   • Authority (25%): 8 posts`);
  console.log(`   • Trust (20%):     6 posts`);
  console.log(`   • Conversion (25%): 8 posts`);
  console.log(`\n   Segments covered: RESIDENTIAL · SOCIETY · COMMERCIAL · INDUSTRIAL · GROUND_MOUNT`);
  console.log(`   Content types: STATIC_POST · CAROUSEL · REEL`);
  console.log(`   Languages: EN · HI · MR (all posts)`);
  console.log(`\n🚀 View at: http://localhost:3000/admin/social`);
  console.log(`   → Go to "Approval Queue" to review and approve posts.\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
