/**
 * Campaign Engine
 *
 * Three modes:
 * 1. BROADCAST  — one-shot to all matching leads (paginated, rate-limited)
 * 2. DRIP       — multi-step timed sequence per lead enrollment
 * 3. BEHAVIORAL — handled by Automation Engine (event-triggered)
 *
 * Drip tick: called by cron every minute — sends any enrollment whose nextSendAt <= now.
 */
import { PrismaClient, CampaignStatus, CampaignType } from '@prisma/client';
import { dispatchMessage } from './communication/message-dispatcher.service.js';
import { LeadLanguage } from '@prisma/client';

const prisma = new PrismaClient();

// ── Target audience resolver ──────────────────────────────────────────────────

async function resolveTargetLeads(targetFilter: Record<string, unknown>): Promise<string[]> {
  const where: Record<string, unknown> = {};
  if (targetFilter['stage']) where['stage'] = targetFilter['stage'];
  if (targetFilter['source']) where['source'] = targetFilter['source'];
  if (targetFilter['score_gte']) where['score'] = { gte: Number(targetFilter['score_gte']) };
  if (targetFilter['score_lte']) {
    where['score'] = { ...(where['score'] as object ?? {}), lte: Number(targetFilter['score_lte']) };
  }
  if (targetFilter['language']) where['language'] = targetFilter['language'];

  const leads = await prisma.crmLead.findMany({
    where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    select: { id: true },
  });
  return leads.map((l) => l.id);
}

// ── Broadcast launch ──────────────────────────────────────────────────────────

export async function launchBroadcast(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  if (!campaign.templateId) throw new Error('Broadcast campaign needs a templateId');

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.RUNNING } });

  const leadIds = await resolveTargetLeads(campaign.targetFilter as Record<string, unknown>);
  console.log(`[Campaign] Broadcast "${campaign.name}" → ${leadIds.length} leads`);

  let sent = 0;
  const BATCH = 10;

  for (let i = 0; i < leadIds.length; i += BATCH) {
    const batch = leadIds.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (leadId) => {
        const lead = await prisma.crmLead.findUnique({ where: { id: leadId } });
        if (!lead) return;
        await dispatchMessage({
          leadId,
          channel: campaign.channel,
          templateId: campaign.templateId!,
          language: lead.language,
          variables: { name: lead.name, phone: lead.phone },
        });
        sent++;
      })
    );
    // Rate limit: 100ms between batches (~100 msgs/sec max)
    await new Promise((r) => setTimeout(r, 100));
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.COMPLETED, sentCount: sent },
  });

  console.log(`[Campaign] Broadcast "${campaign.name}" completed. Sent: ${sent}`);
}

// ── Drip enrollment ───────────────────────────────────────────────────────────

export async function enrollLeadInDrip(campaignId: string, leadId: string): Promise<void> {
  const steps = await prisma.dripStep.findMany({
    where: { campaignId },
    orderBy: { stepNumber: 'asc' },
  });
  if (!steps.length) return;

  const firstStep = steps[0];
  const nextSendAt = new Date(Date.now() + firstStep.delayDays * 86_400_000);

  await prisma.campaignEnrollment.upsert({
    where: { campaignId_leadId: { campaignId, leadId } },
    create: { campaignId, leadId, currentStep: 0, nextSendAt, status: 'ACTIVE' },
    update: {}, // don't re-enroll if already active
  });
}

// ── Drip tick (called by cron every minute) ───────────────────────────────────

export async function processDripTick(): Promise<void> {
  const due = await prisma.campaignEnrollment.findMany({
    where: {
      status: 'ACTIVE',
      nextSendAt: { lte: new Date() },
    },
    include: {
      campaign: { include: { steps: { orderBy: { stepNumber: 'asc' } } } },
      lead: true,
    },
    take: 100, // process max 100 per tick
  });

  for (const enrollment of due) {
    try {
      const steps = enrollment.campaign.steps;
      const currentIdx = enrollment.currentStep;

      if (currentIdx >= steps.length) {
        await prisma.campaignEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'COMPLETED' },
        });
        continue;
      }

      const step = steps[currentIdx];
      await dispatchMessage({
        leadId: enrollment.leadId,
        channel: enrollment.campaign.channel,
        templateId: step.templateId,
        language: enrollment.lead.language,
        variables: { name: enrollment.lead.name, phone: enrollment.lead.phone },
      });

      const nextIdx = currentIdx + 1;
      if (nextIdx >= steps.length) {
        await prisma.campaignEnrollment.update({
          where: { id: enrollment.id },
          data: { currentStep: nextIdx, status: 'COMPLETED', nextSendAt: null },
        });
      } else {
        const nextStep = steps[nextIdx];
        const nextSendAt = new Date(Date.now() + nextStep.delayDays * 86_400_000);
        await prisma.campaignEnrollment.update({
          where: { id: enrollment.id },
          data: { currentStep: nextIdx, nextSendAt },
        });
      }
    } catch (err) {
      console.error(`[DripTick] Enrollment ${enrollment.id} failed:`, (err as Error).message);
    }
  }
}

// ── Phase 7: Payment follow-up — stop all follow-up campaigns for a lead ─────

export async function stopPaymentFollowups(leadId: string): Promise<void> {
  const updated = await prisma.campaignEnrollment.updateMany({
    where: {
      leadId,
      status: 'ACTIVE',
      campaign: { name: { contains: 'payment', mode: 'insensitive' } },
    },
    data: {
      status: 'STOPPED',
      stoppedAt: new Date(),
      stopReason: 'payment_received',
    },
  });
  if (updated.count > 0) {
    console.log(`[PaymentFollowup] Stopped ${updated.count} follow-up(s) for lead ${leadId}`);
  }
}

/**
 * Adaptive payment follow-up intensity.
 * Returns the correct template ID based on how many days overdue.
 */
export function getPaymentFollowupTemplate(daysSinceInvoice: number): string | null {
  if (daysSinceInvoice === 1)  return process.env.TEMPLATE_PAYMENT_D1  ?? '';
  if (daysSinceInvoice === 3)  return process.env.TEMPLATE_PAYMENT_D3  ?? '';
  if (daysSinceInvoice === 7)  return process.env.TEMPLATE_PAYMENT_D7  ?? '';
  if (daysSinceInvoice === 14) return process.env.TEMPLATE_PAYMENT_D14 ?? '';
  return null; // no message for other days
}
