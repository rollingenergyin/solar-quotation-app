/**
 * MessageDispatcher — routes messages to the correct channel adapter.
 * All adapters share the same interface so the automation engine
 * never needs to know which provider is being used.
 */
import { PrismaClient, LeadLanguage } from '@prisma/client';
import { renderTemplate } from '../multilingual.service.js';
import { emitLeadEvent } from '../lead-state-machine.service.js';

const prisma = new PrismaClient();

export type DispatchOptions = {
  leadId: string;
  channel: string;         // whatsapp | email | sms
  templateId?: string;
  language: LeadLanguage;
  variables: Record<string, string | number>;
  rawContent?: string;     // bypass template if provided
};

export async function dispatchMessage(opts: DispatchOptions): Promise<void> {
  const { leadId, channel, templateId, language, variables, rawContent } = opts;

  const content = rawContent
    ? rawContent
    : templateId
    ? await renderTemplate(templateId, language, variables)
    : '';

  if (!content) throw new Error('No content to dispatch');

  let externalId: string | undefined;
  let status = 'SENT';

  switch (channel) {
    case 'whatsapp':
      externalId = await sendWhatsApp(opts, content);
      break;
    case 'email':
      externalId = await sendEmail(opts, content);
      break;
    case 'sms':
      externalId = await sendSms(opts, content);
      break;
    default:
      throw new Error(`Unknown channel: ${channel}`);
  }

  // Persist to conversation + message log
  const conversation = await prisma.crmConversation.upsert({
    where: { leadId_channel: { leadId, channel } },
    create: { leadId, channel, lastMessageAt: new Date() },
    update: { lastMessageAt: new Date() },
  });

  await prisma.crmMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      channel,
      content,
      language: language.toLowerCase(),
      status,
      externalId,
    },
  });

  await emitLeadEvent(prisma, leadId, 'MESSAGE_SENT', 'system', {
    channel,
    templateId,
    externalId,
  });

  console.log(`[Dispatch] ${channel.toUpperCase()} sent to lead ${leadId}`);
}

// ── WhatsApp Adapter (Meta Cloud API) ────────────────────────────────────────

async function sendWhatsApp(opts: DispatchOptions, content: string): Promise<string> {
  const lead = await prisma.crmLead.findUniqueOrThrow({ where: { id: opts.leadId } });
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn('[WhatsApp] API not configured — message logged only');
    return 'simulated_' + Date.now();
  }

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: lead.phone,
        type: 'text',
        text: { preview_url: false, body: content },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`WhatsApp API error: ${err}`);
  }

  const data = await response.json() as { messages?: { id: string }[] };
  return data.messages?.[0]?.id ?? '';
}

// ── Email Adapter (SendGrid) ─────────────────────────────────────────────────

async function sendEmail(opts: DispatchOptions, content: string): Promise<string> {
  const lead = await prisma.crmLead.findUniqueOrThrow({ where: { id: opts.leadId } });
  if (!lead.email) throw new Error('Lead has no email address');

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('[Email] SendGrid not configured — message logged only');
    return 'simulated_email_' + Date.now();
  }

  const { default: sgMail } = await import('@sendgrid/mail');
  sgMail.setApiKey(apiKey);

  const [res] = await sgMail.send({
    to: lead.email,
    from: process.env.FROM_EMAIL ?? 'noreply@rollingenergy.in',
    subject: `Rolling Energy — Solar Update for ${lead.name}`,
    text: content,
    html: `<p>${content.replace(/\n/g, '<br>')}</p>`,
  });

  return res.headers['x-message-id'] as string ?? '';
}

// ── SMS Adapter (Twilio) ─────────────────────────────────────────────────────

async function sendSms(opts: DispatchOptions, content: string): Promise<string> {
  const lead = await prisma.crmLead.findUniqueOrThrow({ where: { id: opts.leadId } });
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('[SMS] Twilio not configured — message logged only');
    return 'simulated_sms_' + Date.now();
  }

  const { default: twilio } = await import('twilio');
  const client = twilio(accountSid, authToken);
  const msg = await client.messages.create({
    body: content,
    from: fromNumber,
    to: lead.phone,
  });

  return msg.sid;
}
