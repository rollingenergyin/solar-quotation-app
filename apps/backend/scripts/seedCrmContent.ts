/**
 * Solar Growth OS — CRM Content Seeder
 * Creates 15 Message Templates, 15 Automation Rules, 15 Campaigns
 * via the live REST API (requires backend running on PORT 4000)
 *
 * Run: tsx scripts/seedCrmContent.ts
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const BASE = process.env.API_BASE ?? 'http://localhost:4000/api';
const EMAIL = 'admin@solar.com';
const PASSWORD = 'Admin123!';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUserId: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${await res.text()}`);
  const data = await res.json() as { token: string };
  return data.token;
}

async function post(token: string, path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`  ✗ POST ${path} → ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }
  return JSON.parse(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1.  MESSAGE TEMPLATES (15)
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    name: 'New Lead — First Introduction',
    category: 'welcome',
    channel: 'whatsapp',
    contentEn: `Hi {name}! 👋 I'm {agent} from Rolling Energy Solar. I noticed you're interested in solar energy. We've helped 500+ families in {city} save ₹3,000–₹8,000/month on electricity. Can I share a quick savings estimate for your home?`,
    contentHi: `नमस्ते {name}! 👋 मैं {agent} हूँ, Rolling Energy Solar से। हमने {city} में 500+ परिवारों को हर महीने ₹3,000–₹8,000 बचाने में मदद की है। क्या मैं आपके घर के लिए एक बचत अनुमान शेयर कर सकता हूँ?`,
    contentMr: `नमस्कार {name}! 👋 मी {agent}, Rolling Energy Solar मधून. {city} मध्ये 500+ कुटुंबांना दरमहा ₹3,000–₹8,000 वाचवण्यास मदत केली आहे. तुमच्या घरासाठी एक बचत अंदाज शेअर करू का?`,
    variables: ['name', 'agent', 'city'],
  },
  {
    name: '24h No Reply — Gentle Follow-up',
    category: 'follow_up',
    channel: 'whatsapp',
    contentEn: `Hi {name}, just checking in! 😊 Did you get a chance to see my message about solar savings? With electricity bills going up every month, many families in {city} are switching to solar. Takes only 5 minutes to understand — want me to share details?`,
    contentHi: `हेलो {name}, बस एक बार फॉलो-अप कर रहा था! 😊 क्या आपने मेरा सोलर बचत वाला मैसेज देखा? बिजली के बिल हर महीने बढ़ रहे हैं — {city} में कई परिवार सोलर की तरफ जा रहे हैं। सिर्फ 5 मिनट में समझ सकते हैं — डिटेल भेजूं?`,
    contentMr: `हॅलो {name}, फक्त एकदा फॉलो-अप करत होतो! 😊 सोलर बचतीबद्दलचा माझा मेसेज पाहिलात का? वीज बिल दरमहा वाढतच आहे — {city} मध्ये अनेक कुटुंबे सोलरकडे वळत आहेत. 5 मिनिटांत समजेल — माहिती पाठवू का?`,
    variables: ['name', 'city'],
  },
  {
    name: 'High Electricity Bill Hook',
    category: 'qualification',
    channel: 'whatsapp',
    contentEn: `{name}, is your electricity bill above ₹3,000/month? ⚡\n\nIf yes — you're spending over ₹36,000/year on electricity. With solar, that becomes ₹0 in 4–5 years, and your system earns for 25 years after that!\n\nWant a free analysis for your home?`,
    contentHi: `{name}, क्या आपका बिजली बिल ₹3,000/महीना से ज़्यादा है? ⚡\n\nअगर हाँ — तो आप हर साल ₹36,000+ बिजली पर खर्च कर रहे हैं। सोलर से 4–5 साल में यह ₹0 हो जाता है, और सिस्टम 25 साल तक काम करता है!\n\nफ्री एनालिसिस चाहते हैं?`,
    contentMr: `{name}, तुमचे वीज बिल ₹3,000/महिन्यापेक्षा जास्त आहे का? ⚡\n\nजर हो — तर तुम्ही दरवर्षी ₹36,000+ वीजेवर खर्च करत आहात. सोलरने 4–5 वर्षांत हे ₹0 होते, आणि सिस्टम 25 वर्षे काम करते!\n\nमोफत विश्लेषण हवे आहे का?`,
    variables: ['name'],
  },
  {
    name: 'PM Surya Ghar Subsidy Awareness',
    category: 'qualification',
    channel: 'whatsapp',
    contentEn: `Great news {name}! 🇮🇳 The Government of India is giving FREE SUBSIDY up to ₹78,000 under PM Surya Ghar Muft Bijli Yojana for residential solar.\n\nDeadline to apply is limited. We'll handle all paperwork for FREE.\n\nInterested? Reply YES 👇`,
    contentHi: `खुशखबरी {name}! 🇮🇳 भारत सरकार PM सूर्य घर मुफ्त बिजली योजना के तहत घरेलू सोलर पर ₹78,000 तक की मुफ्त सब्सिडी दे रही है।\n\nआवेदन की समय सीमा सीमित है। सारे कागज़ात हम मुफ्त में करेंगे।\n\nरुचि है? YES जवाब दें 👇`,
    contentMr: `आनंदाची बातमी {name}! 🇮🇳 भारत सरकार PM सूर्य घर मुफ्त बिजली योजनेंतर्गत घरगुती सोलरसाठी ₹78,000 पर्यंत मोफत अनुदान देत आहे.\n\nअर्जाची मुदत मर्यादित आहे. सर्व कागदपत्रे आम्ही मोफत करू.\n\nस्वारस्य आहे का? YES उत्तर द्या 👇`,
    variables: ['name'],
  },
  {
    name: 'Site Visit Confirmation',
    category: 'site_visit_confirmation',
    channel: 'whatsapp',
    contentEn: `Hi {name}! ✅ Your site visit is confirmed.\n\n📅 Date: {visit_date}\n⏰ Time: {visit_time}\n📍 Address: {address}\n\nOur engineer {engineer} will visit. Please keep electricity bills handy.\n\nCall us at any time: {phone}`,
    contentHi: `हाय {name}! ✅ आपका साइट विज़िट कन्फर्म हो गया है।\n\n📅 तारीख: {visit_date}\n⏰ समय: {visit_time}\n📍 पता: {address}\n\nहमारे इंजीनियर {engineer} आएंगे। कृपया बिजली बिल तैयार रखें।\n\nकभी भी कॉल करें: {phone}`,
    contentMr: `हाय {name}! ✅ तुमची साइट व्हिजिट निश्चित झाली आहे.\n\n📅 तारीख: {visit_date}\n⏰ वेळ: {visit_time}\n📍 पत्ता: {address}\n\nआमचे इंजिनिअर {engineer} येतील. वीज बिले तयार ठेवा.\n\nकेव्हाही कॉल करा: {phone}`,
    variables: ['name', 'visit_date', 'visit_time', 'address', 'engineer', 'phone'],
  },
  {
    name: 'Proposal Sent — Covering Message',
    category: 'proposal',
    channel: 'whatsapp',
    contentEn: `Hi {name}! I've sent your customized solar proposal. Here's the summary:\n\n⚡ System Size: {kw_size} kW\n💰 Total Cost: ₹{total_cost}\n🎁 Subsidy: ₹{subsidy}\n💸 Your Investment: ₹{net_cost}\n📅 Payback: {payback_years} years\n✅ Savings over 25 years: ₹{total_savings}\n\nQuestions? I'm just a call away! 📞`,
    contentHi: `हाय {name}! मैंने आपका कस्टमाइज्ड सोलर प्रोपोज़ल भेज दिया है। सारांश:\n\n⚡ सिस्टम साइज़: {kw_size} kW\n💰 कुल लागत: ₹{total_cost}\n🎁 सब्सिडी: ₹{subsidy}\n💸 आपका निवेश: ₹{net_cost}\n📅 वापसी: {payback_years} साल\n✅ 25 साल की बचत: ₹{total_savings}\n\nकोई सवाल? बस एक कॉल! 📞`,
    contentMr: `हाय {name}! तुमचा कस्टमाइज्ड सोलर प्रपोझल पाठवला आहे. सारांश:\n\n⚡ सिस्टम आकार: {kw_size} kW\n💰 एकूण खर्च: ₹{total_cost}\n🎁 अनुदान: ₹{subsidy}\n💸 तुमची गुंतवणूक: ₹{net_cost}\n📅 परतावा: {payback_years} वर्षे\n✅ 25 वर्षांची बचत: ₹{total_savings}\n\nप्रश्न आहेत? एक कॉल करा! 📞`,
    variables: ['name', 'kw_size', 'total_cost', 'subsidy', 'net_cost', 'payback_years', 'total_savings'],
  },
  {
    name: 'Payment Reminder — Friendly (3 Days Before)',
    category: 'payment_reminder',
    channel: 'whatsapp',
    contentEn: `Hi {name}! 😊 Friendly reminder — your payment of ₹{amount} is due on {due_date}.\n\nPay now to keep your solar installation on schedule!\n\nBank: {bank_name}\nAccount: {account_no}\nUPI: {upi_id}\n\nNeed help? Call {phone} 📞`,
    contentHi: `हाय {name}! 😊 याद दिला दें — आपकी ₹{amount} की पेमेंट {due_date} को देय है।\n\nसमय पर पेमेंट करें ताकि इंस्टॉलेशन शेड्यूल पर रहे!\n\nबैंक: {bank_name}\nखाता: {account_no}\nUPI: {upi_id}\n\nमदद चाहिए? {phone} पर कॉल करें 📞`,
    contentMr: `हाय {name}! 😊 आठवण — तुमची ₹{amount} ची देयता {due_date} रोजी आहे.\n\nवेळेवर पेमेंट करा जेणेकरून इन्स्टॉलेशन वेळेत होईल!\n\nबँक: {bank_name}\nखाते: {account_no}\nUPI: {upi_id}\n\nमदत हवी का? {phone} वर कॉल करा 📞`,
    variables: ['name', 'amount', 'due_date', 'bank_name', 'account_no', 'upi_id', 'phone'],
  },
  {
    name: 'Payment Reminder — Urgent (Overdue)',
    category: 'payment_reminder',
    channel: 'whatsapp',
    contentEn: `⚠️ URGENT: {name}, your payment of ₹{amount} was due on {due_date} and is now overdue.\n\nDelay may pause your installation. Please pay TODAY to avoid disruption.\n\nUPI: {upi_id}\n\nPaid already? Share screenshot and we'll update immediately. 🙏`,
    contentHi: `⚠️ अर्जेंट: {name}, आपकी ₹{amount} की पेमेंट {due_date} को देय थी और अब ओवरड्यू है।\n\nदेरी से इंस्टॉलेशन रुक सकता है। कृपया आज ही पेमेंट करें।\n\nUPI: {upi_id}\n\nपेमेंट कर दिया? स्क्रीनशॉट भेजें। 🙏`,
    contentMr: `⚠️ तातडीचे: {name}, तुमची ₹{amount} ची देयता {due_date} रोजी होती आणि आता थकीत आहे.\n\nउशीर झाल्यास इन्स्टॉलेशन थांबू शकते. कृपया आजच पेमेंट करा.\n\nUPI: {upi_id}\n\nपेमेंट केले? स्क्रीनशॉट पाठवा. 🙏`,
    variables: ['name', 'amount', 'due_date', 'upi_id'],
  },
  {
    name: 'Post-Installation Referral Ask',
    category: 'follow_up',
    channel: 'whatsapp',
    contentEn: `Congratulations {name}! 🎉 Your solar system is live and generating clean energy!\n\nKnow a neighbor, friend, or family member with a high electricity bill? Refer them to us and earn ₹2,000 cash reward for every successful installation!\n\nJust share their number or forward this message. 🌞`,
    contentHi: `बधाई हो {name}! 🎉 आपका सोलर सिस्टम चालू हो गया है!\n\nकोई पड़ोसी, दोस्त या परिवार वाला है जिसका बिजली बिल ज़्यादा है? उन्हें रेफर करें और हर सफल इंस्टॉलेशन पर ₹2,000 कैश पाएं!\n\nबस उनका नंबर शेयर करें या यह मैसेज फॉरवर्ड करें। 🌞`,
    contentMr: `अभिनंदन {name}! 🎉 तुमचे सोलर सिस्टम सुरू झाले आहे!\n\nएखाद्या शेजारी, मित्र किंवा नातेवाइकाचे वीज बिल जास्त आहे का? त्यांना रेफर करा आणि प्रत्येक यशस्वी इन्स्टॉलेशनवर ₹2,000 रोख मिळवा!\n\nत्यांचा नंबर शेअर करा किंवा हा मेसेज फॉरवर्ड करा. 🌞`,
    variables: ['name'],
  },
  {
    name: 'Diwali Festival Solar Offer',
    category: 'welcome',
    channel: 'whatsapp',
    contentEn: `🪔 Happy Diwali {name}! This Diwali, gift yourself ENERGY FREEDOM!\n\n✨ Special Offer: 10% discount + FREE Net Meter installation\n⏳ Valid till: {offer_expiry}\n🎁 Bonus: 5-year extended warranty FREE\n\nOnly {slots_left} slots available this month!\n\nBook now → Reply YES 📲`,
    contentHi: `🪔 दीपावली की शुभकामनाएं {name}! इस दीवाली, खुद को ऊर्जा आज़ादी का तोहफा दें!\n\n✨ स्पेशल ऑफर: 10% छूट + FREE नेट मीटर इंस्टॉलेशन\n⏳ वैधता: {offer_expiry} तक\n🎁 बोनस: 5 साल की एक्सटेंडेड वारंटी FREE\n\nइस महीने सिर्फ {slots_left} स्लॉट बचे हैं!\n\nअभी बुक करें → YES जवाब दें 📲`,
    contentMr: `🪔 दीपावलीच्या शुभेच्छा {name}! या दिवाळीत स्वतःला ऊर्जा स्वातंत्र्याची भेट द्या!\n\n✨ विशेष ऑफर: 10% सूट + FREE नेट मीटर इन्स्टॉलेशन\n⏳ वैधता: {offer_expiry} पर्यंत\n🎁 बोनस: 5 वर्षांची विस्तारित वॉरंटी FREE\n\nया महिन्यात फक्त {slots_left} स्लॉट शिल्लक!\n\nआता बुक करा → YES उत्तर द्या 📲`,
    variables: ['name', 'offer_expiry', 'slots_left'],
  },
  {
    name: '30-Day Cold Lead Re-engagement',
    category: 'follow_up',
    channel: 'whatsapp',
    contentEn: `Hi {name}! It's been a while. 👋\n\nElectricity tariffs in Maharashtra increased 8% this year. Your monthly bill has gone up too.\n\nWe helped 3 families in your area go solar last month. They're now saving ₹4,500/month on average.\n\nWant me to send their case study? No obligation. 🌞`,
    contentHi: `हाय {name}! काफी समय हो गया। 👋\n\nमहाराष्ट्र में बिजली दरें इस साल 8% बढ़ गई हैं। आपका बिल भी बढ़ा होगा।\n\nपिछले महीने हमने आपके इलाके में 3 परिवारों को सोलर लगवाया। वे अब औसतन ₹4,500/महीना बचा रहे हैं।\n\nक्या मैं उनकी केस स्टडी भेजूं? कोई बाध्यता नहीं। 🌞`,
    contentMr: `हाय {name}! बराच वेळ झाला. 👋\n\nमहाराष्ट्रात वीज दर या वर्षी 8% वाढले आहेत. तुमचे बिलही वाढले असेल.\n\nगेल्या महिन्यात आम्ही तुमच्या परिसरात 3 कुटुंबांना सोलर लावले. ते आता सरासरी ₹4,500/महिना वाचवत आहेत.\n\nत्यांची केस स्टडी पाठवू का? कोणतीही बांधिलकी नाही. 🌞`,
    variables: ['name'],
  },
  {
    name: 'Housing Society Bulk Solar Pitch',
    category: 'qualification',
    channel: 'whatsapp',
    contentEn: `Dear {name} (Secretary / Chairman),\n\nIs your society paying ₹{bill_amount}+ on common area electricity every month?\n\n🏘️ Rooftop solar for societies reduces common bills by 70–90%!\n✅ Zero investment option available (RESCO model)\n✅ No maintenance headaches\n✅ Increases property value\n\nWe've done 20+ societies in Pune/Mumbai. Can I arrange a FREE presentation for your committee?`,
    contentHi: `प्रिय {name} (सचिव / अध्यक्ष),\n\nक्या आपकी सोसायटी हर महीने कॉमन एरिया बिजली पर ₹{bill_amount}+ खर्च कर रही है?\n\n🏘️ सोसायटी के लिए रूफटॉप सोलर कॉमन बिल 70–90% कम करता है!\n✅ शून्य निवेश विकल्प उपलब्ध (RESCO मॉडल)\n✅ मेंटेनेंस की झंझट नहीं\n✅ प्रॉपर्टी वैल्यू बढ़ेगी\n\nपुणे/मुंबई में 20+ सोसायटी कर चुके हैं। क्या मैं आपकी कमेटी के लिए एक FREE प्रेज़ेंटेशन अरेंज कर सकता हूँ?`,
    contentMr: `प्रिय {name} (सचिव / अध्यक्ष),\n\nतुमची सोसायटी दरमहा कॉमन एरिया विजेवर ₹{bill_amount}+ खर्च करत आहे का?\n\n🏘️ सोसायटीसाठी रूफटॉप सोलर कॉमन बिल 70–90% कमी करते!\n✅ शून्य गुंतवणूक पर्याय उपलब्ध (RESCO मॉडल)\n✅ देखभालीची काळजी नाही\n✅ मालमत्तेचे मूल्य वाढेल\n\nपुणे/मुंबईत 20+ सोसायट्या केल्या आहेत. तुमच्या कमिटीसाठी मोफत सादरीकरण आयोजित करू का?`,
    variables: ['name', 'bill_amount'],
  },
  {
    name: 'Commercial / Industrial Solar Pitch',
    category: 'proposal',
    channel: 'whatsapp',
    contentEn: `Hello {name},\n\nFor industries and commercial units in Maharashtra — solar is now the LOWEST cost electricity available.\n\n📊 Average savings: 40–60% on electricity bills\n💰 Additional benefit: 40% accelerated depreciation (Section 32)\n📅 ROI in 3–4 years for commercial units\n🔋 Optional: Battery backup for power cuts\n\nWe've installed 2–500 kW systems across Maharashtra. Can I send you a detailed ROI report?`,
    contentHi: `नमस्ते {name},\n\nमहाराष्ट्र में उद्योगों और कमर्शियल यूनिट्स के लिए — सोलर अब सबसे सस्ती बिजली है।\n\n📊 औसत बचत: बिजली बिल में 40–60%\n💰 अतिरिक्त लाभ: 40% एक्सेलरेटेड डेप्रिसिएशन (धारा 32)\n📅 कमर्शियल यूनिट्स के लिए ROI 3–4 साल\n🔋 ऑप्शनल: पावर कट के लिए बैटरी बैकअप\n\nहमने महाराष्ट्र में 2–500 kW सिस्टम लगाए हैं। क्या मैं आपको एक विस्तृत ROI रिपोर्ट भेज सकता हूँ?`,
    contentMr: `नमस्कार {name},\n\nमहाराष्ट्रातील उद्योग आणि व्यावसायिक युनिट्ससाठी — सोलर आता सर्वात स्वस्त वीज आहे.\n\n📊 सरासरी बचत: वीज बिलात 40–60%\n💰 अतिरिक्त फायदा: 40% त्वरित घसारा (कलम 32)\n📅 व्यावसायिक युनिट्ससाठी ROI 3–4 वर्षे\n🔋 पर्यायी: वीज कपातीसाठी बॅटरी बॅकअप\n\nआम्ही महाराष्ट्रात 2–500 kW सिस्टम बसवले आहेत. तुम्हाला सविस्तर ROI रिपोर्ट पाठवू का?`,
    variables: ['name'],
  },
  {
    name: 'Negotiation Stage — Final Push Offer',
    category: 'proposal',
    channel: 'whatsapp',
    contentEn: `Hi {name}, I understand you're thinking it over. 🤝\n\nI've spoken to our director and secured a special one-time offer for you:\n\n✅ Extra ₹{discount} price reduction\n✅ FREE AMC for Year 1 (worth ₹8,000)\n✅ Priority installation within 15 days\n\n⚠️ This offer expires in 48 hours.\n\nShall I lock this in for you? Just reply YES.`,
    contentHi: `हाय {name}, मैं समझता हूँ आप सोच रहे हैं। 🤝\n\nमैंने हमारे डायरेक्टर से बात की और आपके लिए एक खास वन-टाइम ऑफर मिला:\n\n✅ ₹{discount} की अतिरिक्त छूट\n✅ पहले साल मुफ्त AMC (₹8,000 की कीमत)\n✅ 15 दिनों में प्राथमिकता इंस्टॉलेशन\n\n⚠️ यह ऑफर 48 घंटे में समाप्त होगा।\n\nक्या मैं यह आपके लिए बुक करूं? बस YES जवाब दें।`,
    contentMr: `हाय {name}, मला समजते तुम्ही विचार करत आहात. 🤝\n\nमी आमच्या संचालकांशी बोललो आणि तुमच्यासाठी एक विशेष एकवेळचा ऑफर मिळवला:\n\n✅ अतिरिक्त ₹{discount} किंमत कमी\n✅ पहिल्या वर्षी मोफत AMC (₹8,000 किंमत)\n✅ 15 दिवसांत प्राधान्य इन्स्टॉलेशन\n\n⚠️ हा ऑफर 48 तासांत संपेल.\n\nहे तुमच्यासाठी बुक करू का? फक्त YES उत्तर द्या.`,
    variables: ['name', 'discount'],
  },
  {
    name: 'Missed Call — Instant Auto-Response',
    category: 'welcome',
    channel: 'whatsapp',
    contentEn: `Hi {name}! 👋 Sorry I missed your call. I'll call you back within 30 minutes.\n\nMeanwhile — what's the best time to reach you?\nA) Morning (9–12)\nB) Afternoon (12–4)\nC) Evening (4–8)\n\nJust reply A, B, or C and I'll schedule a call! ☎️`,
    contentHi: `हाय {name}! 👋 माफ करना, आपकी कॉल मिस हो गई। मैं 30 मिनट में कॉल बैक करूंगा।\n\nतब तक — आपसे बात करने का सबसे अच्छा समय क्या है?\nA) सुबह (9–12)\nB) दोपहर (12–4)\nC) शाम (4–8)\n\nबस A, B या C जवाब दें! ☎️`,
    contentMr: `हाय {name}! 👋 माफ करा, तुमचा कॉल चुकला. मी 30 मिनिटांत कॉलबॅक करतो.\n\nदरम्यान — तुमच्याशी बोलण्यासाठी सर्वोत्तम वेळ कोणता?\nA) सकाळ (9–12)\nB) दुपार (12–4)\nC) संध्याकाळ (4–8)\n\nफक्त A, B किंवा C उत्तर द्या! ☎️`,
    variables: ['name'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2.  AUTOMATION RULES (15)
// ─────────────────────────────────────────────────────────────────────────────

const AUTOMATIONS = [
  {
    name: 'New Lead — Instant WhatsApp Welcome',
    description: 'Send introduction message within 2 minutes of lead creation',
    trigger: { event: 'lead.created', filter: {} },
    conditions: [],
    actions: [
      { type: 'send_whatsapp', templateId: '', channel: 'whatsapp', delayMinutes: 2 },
      { type: 'add_note', note: 'Auto: Welcome message sent', delayMinutes: 2 },
    ],
    loopGuard: 1,
    priority: 10,
  },
  {
    name: '24h No Reply — Gentle Follow-up',
    description: 'If lead has not replied 24 hours after creation, send a follow-up',
    trigger: { event: 'lead.created', filter: {} },
    conditions: [{ field: 'lead.stage', operator: 'eq', value: 'NEW' }],
    actions: [
      { type: 'send_whatsapp', templateId: '', channel: 'whatsapp', delayMinutes: 1440 },
    ],
    loopGuard: 1,
    priority: 8,
  },
  {
    name: '72h No Reply — Sales Escalation Call Alert',
    description: 'If lead still in NEW after 72h, create a note to trigger sales call',
    trigger: { event: 'lead.created', filter: {} },
    conditions: [{ field: 'lead.stage', operator: 'eq', value: 'NEW' }],
    actions: [
      { type: 'add_note', note: 'ACTION REQUIRED: Lead no reply for 72h. Call immediately.', delayMinutes: 4320 },
      { type: 'update_score', delta: -10, delayMinutes: 4320 },
    ],
    loopGuard: 1,
    priority: 7,
  },
  {
    name: 'High Score Lead — Priority Alert to Sales',
    description: 'When lead score exceeds 70, flag as high priority and add urgent note',
    trigger: { event: 'lead.stage_changed', filter: {} },
    conditions: [{ field: 'lead.score', operator: 'gte', value: 70 }],
    actions: [
      { type: 'add_note', note: '🔥 HIGH VALUE LEAD — Score 70+. Assign senior sales rep. Call within 1 hour.', delayMinutes: 0 },
    ],
    loopGuard: 2,
    priority: 10,
  },
  {
    name: 'Stage → CONTACTED: Score Boost',
    description: 'When lead is contacted, boost score to reflect engagement',
    trigger: { event: 'lead.stage_changed', filter: { toStage: 'CONTACTED' } },
    conditions: [],
    actions: [
      { type: 'update_score', delta: 15, delayMinutes: 0 },
      { type: 'add_note', note: 'Auto: Lead contacted. Score +15.', delayMinutes: 0 },
    ],
    loopGuard: 1,
    priority: 5,
  },
  {
    name: 'Site Visit Reminder — 24h Before',
    description: 'Send WhatsApp reminder 24h before scheduled site visit',
    trigger: { event: 'lead.stage_changed', filter: { toStage: 'SITE_VISIT_SCHEDULED' } },
    conditions: [],
    actions: [
      { type: 'send_whatsapp', templateId: '', channel: 'whatsapp', delayMinutes: 0 },
      { type: 'add_note', note: 'Auto: Site visit confirmation sent.', delayMinutes: 0 },
    ],
    loopGuard: 1,
    priority: 9,
  },
  {
    name: 'Post Site Visit — Push to Proposal',
    description: 'After site visit done, send proposal preparation message and update score',
    trigger: { event: 'lead.stage_changed', filter: { toStage: 'SITE_VISIT_DONE' } },
    conditions: [],
    actions: [
      { type: 'update_score', delta: 20, delayMinutes: 0 },
      { type: 'send_whatsapp', templateId: '', channel: 'whatsapp', delayMinutes: 60 },
      { type: 'add_note', note: 'Auto: Site visit done. Proposal to be sent in 24h.', delayMinutes: 0 },
    ],
    loopGuard: 1,
    priority: 9,
  },
  {
    name: 'Proposal Sent — Day 2 Follow-up',
    description: 'Follow up 48h after proposal with benefits reinforcement',
    trigger: { event: 'lead.stage_changed', filter: { toStage: 'PROPOSAL_SENT' } },
    conditions: [],
    actions: [
      { type: 'update_score', delta: 10, delayMinutes: 0 },
      { type: 'send_whatsapp', templateId: '', channel: 'whatsapp', delayMinutes: 2880 },
    ],
    loopGuard: 1,
    priority: 8,
  },
  {
    name: 'Proposal Sent — Day 5 Urgency Nudge',
    description: 'If still in proposal stage after 5 days, send limited-time offer',
    trigger: { event: 'lead.stage_changed', filter: { toStage: 'PROPOSAL_SENT' } },
    conditions: [],
    actions: [
      { type: 'send_whatsapp', templateId: '', channel: 'whatsapp', delayMinutes: 7200 },
      { type: 'add_note', note: 'Auto: Day 5 urgency nudge sent.', delayMinutes: 7200 },
    ],
    loopGuard: 1,
    priority: 7,
  },
  {
    name: 'Negotiation Stall — Director Offer',
    description: 'Lead stuck in negotiation > 7 days, send special director discount offer',
    trigger: { event: 'lead.stage_changed', filter: { toStage: 'NEGOTIATION' } },
    conditions: [],
    actions: [
      { type: 'add_note', note: 'Auto: Lead in negotiation. Trigger final offer after 7 days.', delayMinutes: 0 },
      { type: 'send_whatsapp', templateId: '', channel: 'whatsapp', delayMinutes: 10080 },
    ],
    loopGuard: 1,
    priority: 9,
  },
  {
    name: 'WhatsApp Reply Received — Score Boost',
    description: 'When a lead sends an inbound WhatsApp message, boost score and notify sales',
    trigger: { event: 'lead.message_received', filter: { channel: 'whatsapp' } },
    conditions: [],
    actions: [
      { type: 'update_score', delta: 25, delayMinutes: 0 },
      { type: 'add_note', note: 'Auto: Lead replied on WhatsApp. Score +25. Call within 30 min.', delayMinutes: 0 },
    ],
    loopGuard: 5,
    priority: 10,
  },
  {
    name: 'Missed Call — Auto WhatsApp in 5 Min',
    description: 'When a missed call event is logged, auto-send WhatsApp response within 5 min',
    trigger: { event: 'lead.message_received', filter: { channel: 'voice' } },
    conditions: [],
    actions: [
      { type: 'send_whatsapp', templateId: '', channel: 'whatsapp', delayMinutes: 5 },
      { type: 'add_note', note: 'Auto: Missed call detected. WhatsApp sent.', delayMinutes: 5 },
    ],
    loopGuard: 3,
    priority: 10,
  },
  {
    name: 'Closed Won — Referral Request',
    description: 'After deal is won, automatically ask for a referral 7 days post-closure',
    trigger: { event: 'lead.stage_changed', filter: { toStage: 'CLOSED_WON' } },
    conditions: [],
    actions: [
      { type: 'update_score', delta: 30, delayMinutes: 0 },
      { type: 'send_whatsapp', templateId: '', channel: 'whatsapp', delayMinutes: 10080 },
      { type: 'add_note', note: 'Auto: Deal won. Referral request scheduled for Day 7.', delayMinutes: 0 },
    ],
    loopGuard: 1,
    priority: 6,
  },
  {
    name: 'Cold Lead — 30-Day Re-engagement',
    description: 'Lead has not had any activity for 30 days — send re-engagement message',
    trigger: { event: 'lead.created', filter: {} },
    conditions: [
      { field: 'lead.stage', operator: 'in', value: ['NEW', 'CONTACTED', 'QUALIFIED'] },
    ],
    actions: [
      { type: 'send_whatsapp', templateId: '', channel: 'whatsapp', delayMinutes: 43200 },
      { type: 'update_score', delta: -5, delayMinutes: 43200 },
      { type: 'add_note', note: 'Auto: 30-day re-engagement message sent.', delayMinutes: 43200 },
    ],
    loopGuard: 2,
    priority: 4,
  },
  {
    name: 'Qualified Lead — Subsidy Awareness Message',
    description: 'When a lead is marked Qualified, send PM Surya Ghar subsidy information',
    trigger: { event: 'lead.stage_changed', filter: { toStage: 'QUALIFIED' } },
    conditions: [],
    actions: [
      { type: 'update_score', delta: 10, delayMinutes: 0 },
      { type: 'send_whatsapp', templateId: '', channel: 'whatsapp', delayMinutes: 30 },
      { type: 'add_note', note: 'Auto: Subsidy awareness message sent to qualified lead.', delayMinutes: 30 },
    ],
    loopGuard: 1,
    priority: 7,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3.  CAMPAIGNS (15)
// ─────────────────────────────────────────────────────────────────────────────

const CAMPAIGNS = [
  {
    name: 'Diwali Solar Festival Campaign',
    type: 'BROADCAST',
    channel: 'whatsapp',
    targetFilter: { stage: 'NEW' },
  },
  {
    name: 'High Electricity Bill — ₹3000+ Leads',
    type: 'BROADCAST',
    channel: 'whatsapp',
    targetFilter: { stage: 'CONTACTED' },
  },
  {
    name: 'PM Surya Ghar Subsidy Awareness Blast',
    type: 'BROADCAST',
    channel: 'whatsapp',
    targetFilter: { stage: 'NEW' },
  },
  {
    name: 'Housing Society Solar — Committee Outreach',
    type: 'BROADCAST',
    channel: 'email',
    targetFilter: { source: 'MANUAL' },
  },
  {
    name: 'New Lead Welcome Drip (7-day sequence)',
    type: 'DRIP',
    channel: 'whatsapp',
    targetFilter: { stage: 'NEW' },
  },
  {
    name: 'Proposal Follow-up Drip (5-day sequence)',
    type: 'DRIP',
    channel: 'whatsapp',
    targetFilter: { stage: 'PROPOSAL_SENT' },
  },
  {
    name: 'Summer Peak Season Push (Mar–Jun)',
    type: 'BROADCAST',
    channel: 'whatsapp',
    targetFilter: { stage: 'CONTACTED' },
  },
  {
    name: 'Cold Lead Re-engagement — 30 Days Inactive',
    type: 'BROADCAST',
    channel: 'whatsapp',
    targetFilter: { stage: 'NEW' },
  },
  {
    name: 'Referral Reward Campaign — Existing Customers',
    type: 'BROADCAST',
    channel: 'whatsapp',
    targetFilter: { stage: 'CLOSED_WON' },
  },
  {
    name: 'Commercial Solar — Factory & Industry Outreach',
    type: 'BROADCAST',
    channel: 'email',
    targetFilter: { source: 'MANUAL' },
  },
  {
    name: 'Agricultural Solar — Farmer Pump Set Campaign',
    type: 'BROADCAST',
    channel: 'whatsapp',
    targetFilter: { stage: 'NEW' },
  },
  {
    name: 'Payment Recovery — Overdue EMI Reminder',
    type: 'DRIP',
    channel: 'whatsapp',
    targetFilter: { stage: 'PROPOSAL_SENT' },
  },
  {
    name: 'Year-End Tax Benefit Campaign (Section 32)',
    type: 'BROADCAST',
    channel: 'email',
    targetFilter: { source: 'MANUAL' },
  },
  {
    name: 'Net Metering Education Campaign',
    type: 'DRIP',
    channel: 'whatsapp',
    targetFilter: { stage: 'QUALIFIED' },
  },
  {
    name: 'Negotiation Final Push — Director Offer',
    type: 'BROADCAST',
    channel: 'whatsapp',
    targetFilter: { stage: 'NEGOTIATION' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌞 Solar Growth OS — CRM Content Seeder\n');

  let token: string;
  try {
    token = await login();
    console.log('✅ Authenticated as admin\n');
  } catch (e) {
    console.error('❌ Authentication failed. Is the backend running on port 4000?');
    console.error(String(e));
    process.exit(1);
  }

  // ── Templates ──────────────────────────────────────────────
  console.log('─── Creating 15 Message Templates ───');
  let tCount = 0;
  for (const t of TEMPLATES) {
    const res = await post(token, '/crm-templates', t);
    if (res) { tCount++; console.log(`  ✓ [${tCount}/15] ${t.name}`); }
  }

  // ── Automations ────────────────────────────────────────────
  console.log('\n─── Creating 15 Automation Rules ───');
  let aCount = 0;
  for (const a of AUTOMATIONS) {
    const res = await post(token, '/automation/rules', a);
    if (res) { aCount++; console.log(`  ✓ [${aCount}/15] ${a.name}`); }
  }

  // ── Campaigns ──────────────────────────────────────────────
  console.log('\n─── Creating 15 Campaigns ───');
  let cCount = 0;
  for (const c of CAMPAIGNS) {
    const res = await post(token, '/campaigns', c);
    if (res) { cCount++; console.log(`  ✓ [${cCount}/15] ${c.name}`); }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Templates:  ${tCount}/15`);
  console.log(`   Automations: ${aCount}/15`);
  console.log(`   Campaigns:  ${cCount}/15`);
  console.log('\n🚀 Open http://localhost:3000/admin/crm to see the data.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
