import { PrismaClient } from '@prisma/client';

/**
 * Scoring rules:
 * Recency (0-30):  lead created recently = higher score
 * Engagement (0-40): events logged (messages, replies, site visits)
 * Fit (0-30):      system size specified, complete contact info
 */
export async function recalculateScore(
  prisma: PrismaClient,
  leadId: string
): Promise<number> {
  const lead = await prisma.crmLead.findUniqueOrThrow({
    where: { id: leadId },
    include: { events: { orderBy: { createdAt: 'desc' }, take: 50 } },
  });

  const now = Date.now();
  const ageDays = (now - lead.createdAt.getTime()) / 86_400_000;

  // Recency: full 30 pts if < 7 days, decays linearly to 0 at 60 days
  const recencyScore = Math.max(0, Math.round(30 - (ageDays / 60) * 30));

  // Engagement: each event type has a weight
  const weights: Record<string, number> = {
    MESSAGE_SENT: 3,
    MESSAGE_RECEIVED: 5,
    SITE_VISIT_DONE: 15,
    PROPOSAL_SENT: 10,
    STAGE_CHANGED: 4,
    NOTE_ADDED: 2,
  };
  const rawEngagement = lead.events.reduce(
    (sum, e) => sum + (weights[e.eventType] ?? 1),
    0
  );
  const engagementScore = Math.min(40, rawEngagement);

  // Fit: 10 pts for phone, 10 for systemKw, 10 for email
  const fitScore =
    (lead.phone ? 10 : 0) +
    (lead.systemKw ? 10 : 0) +
    (lead.email ? 10 : 0);

  const totalScore = recencyScore + engagementScore + fitScore;

  await prisma.crmLeadScore.upsert({
    where: { leadId },
    create: { leadId, score: totalScore, recencyScore, engagementScore, fitScore },
    update: { score: totalScore, recencyScore, engagementScore, fitScore, calculatedAt: new Date() },
  });

  await prisma.crmLead.update({ where: { id: leadId }, data: { score: totalScore } });

  return totalScore;
}
