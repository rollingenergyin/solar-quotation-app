/**
 * Multilingual Content Service
 *
 * Strategy:
 * 1. Static templates → filled from DB (fast, consistent, no API cost)
 * 2. Dynamic content → generated fresh via OpenAI in the target language
 *
 * Rules:
 * - Never translate — always generate fresh in target language
 * - Include cultural context (Maharashtra, India, solar energy context)
 */
import { PrismaClient, LeadLanguage } from '@prisma/client';

const prisma = new PrismaClient();

const LANGUAGE_NAMES: Record<LeadLanguage, string> = {
  EN: 'English',
  HI: 'Hindi',
  MR: 'Marathi',
};

const CULTURAL_CONTEXT: Record<LeadLanguage, string> = {
  EN: 'You are a helpful solar energy advisor at Rolling Energy, an EPC company in Maharashtra, India.',
  HI: 'आप Rolling Energy में एक सौर ऊर्जा सलाहकार हैं। महाराष्ट्र, भारत में काम करते हैं। स्वाभाविक हिंदी में लिखें।',
  MR: 'तुम्ही Rolling Energy मध्ये एक सौर ऊर्जा सल्लागार आहात. महाराष्ट्रात काम करता. नैसर्गिक मराठीत लिहा.',
};

/**
 * Render a stored template in the given language, filling {{variables}}.
 */
export async function renderTemplate(
  templateId: string,
  language: LeadLanguage,
  variables: Record<string, string | number>
): Promise<string> {
  const template = await prisma.messageTemplate.findUniqueOrThrow({
    where: { id: templateId },
  });

  let raw: string;
  switch (language) {
    case LeadLanguage.HI:
      raw = template.contentHi ?? template.contentEn;
      break;
    case LeadLanguage.MR:
      raw = template.contentMr ?? template.contentEn;
      break;
    default:
      raw = template.contentEn;
  }

  // Replace {{variable}} placeholders
  return raw.replace(/\{\{(\w+)\}\}/g, (_, key) => String(variables[key] ?? `{{${key}}}`));
}

/**
 * Generate a dynamic, culturally adapted message using OpenAI.
 * Falls back to a static message if OPENAI_API_KEY is not set.
 */
export async function generateDynamicMessage(opts: {
  intent: string;       // 'follow_up' | 'proposal_summary' | 'payment_reminder'
  language: LeadLanguage;
  variables: Record<string, string | number>;
}): Promise<string> {
  const { intent, language, variables } = opts;

  if (!process.env.OPENAI_API_KEY) {
    return generateFallbackMessage(intent, language, variables);
  }

  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const variableStr = Object.entries(variables)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  const systemPrompt = CULTURAL_CONTEXT[language];
  const userPrompt = buildPrompt(intent, language, variableStr);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 200,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content?.trim() ?? generateFallbackMessage(intent, language, variables);
}

function buildPrompt(intent: string, language: LeadLanguage, variableStr: string): string {
  const lang = LANGUAGE_NAMES[language];
  const prompts: Record<string, string> = {
    follow_up: `Write a friendly follow-up WhatsApp message in ${lang}. Context: ${variableStr}. Keep it under 100 words. Sound natural, not salesy.`,
    proposal_summary: `Summarize our solar proposal in ${lang} in 2-3 sentences. Context: ${variableStr}. Highlight cost savings and ROI.`,
    payment_reminder: `Write a polite payment reminder in ${lang}. Context: ${variableStr}. Be respectful and offer help if needed. Under 80 words.`,
    site_visit_confirmation: `Confirm a site visit appointment in ${lang}. Context: ${variableStr}. Be warm and professional.`,
    qualification: `Write a qualifying question message in ${lang} to understand customer's solar needs. Context: ${variableStr}. Ask 1-2 specific questions.`,
  };
  return prompts[intent] ?? `Write a professional solar energy advisory message in ${lang}. Context: ${variableStr}. Under 100 words.`;
}

function generateFallbackMessage(
  intent: string,
  language: LeadLanguage,
  variables: Record<string, string | number>
): string {
  const name = variables['name'] ?? 'there';
  const fallbacks: Record<string, Record<LeadLanguage, string>> = {
    follow_up: {
      EN: `Hi ${name}, just checking in on your solar inquiry. Would you like to discuss further?`,
      HI: `नमस्ते ${name}, आपकी सौर ऊर्जा जांच के बारे में पूछना चाहते थे। क्या आप आगे बात करना चाहेंगे?`,
      MR: `नमस्कार ${name}, तुमच्या सौर उर्जेच्या चौकशीबद्दल विचारायचे होते. पुढे चर्चा करायची आहे का?`,
    },
    payment_reminder: {
      EN: `Hi ${name}, this is a gentle reminder about your pending payment. Please let us know if you need any help.`,
      HI: `नमस्ते ${name}, आपके लंबित भुगतान के बारे में एक विनम्र याद दिलाना चाहते थे। किसी सहायता की ज़रूरत हो तो बताएं।`,
      MR: `नमस्कार ${name}, तुमच्या प्रलंबित पेमेंटबद्दल विनम्र आठवण करून द्यायची होती. काही मदत हवी असल्यास सांगा.`,
    },
    proposal_summary: {
      EN: `Hi ${name}, here's a quick summary of your solar proposal. Please review and let us know your thoughts.`,
      HI: `नमस्ते ${name}, आपके सौर प्रस्ताव का सारांश यहां है। कृपया समीक्षा करें।`,
      MR: `नमस्कार ${name}, तुमच्या सौर प्रस्तावाचा सारांश येथे आहे. कृपया पाहा.`,
    },
  };
  return (fallbacks[intent] ?? fallbacks['follow_up'])[language];
}
