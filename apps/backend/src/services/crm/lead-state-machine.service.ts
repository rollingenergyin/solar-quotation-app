import { PrismaClient, CrmStage } from '@prisma/client';

export const VALID_TRANSITIONS: Record<string, CrmStage[]> = {
  NEW:                    [CrmStage.CONTACTED, CrmStage.DISQUALIFIED],
  CONTACTED:              [CrmStage.QUALIFIED, CrmStage.DISQUALIFIED],
  QUALIFIED:              [CrmStage.SITE_VISIT_SCHEDULED, CrmStage.DISQUALIFIED],
  SITE_VISIT_SCHEDULED:   [CrmStage.SITE_VISIT_DONE, CrmStage.QUALIFIED],
  SITE_VISIT_DONE:        [CrmStage.PROPOSAL_SENT],
  PROPOSAL_SENT:          [CrmStage.NEGOTIATION, CrmStage.CLOSED_LOST],
  NEGOTIATION:            [CrmStage.CLOSED_WON, CrmStage.CLOSED_LOST],
  CLOSED_WON:             [],
  CLOSED_LOST:            [CrmStage.NEW],   // re-engage path
  DISQUALIFIED:           [CrmStage.NEW],
};

export type TransitionResult = {
  success: boolean;
  error?: string;
  eventId?: string;
};

/**
 * Validates and applies a stage transition atomically.
 * Emits a STAGE_CHANGED event inside the same transaction.
 */
export async function transitionStage(
  prisma: PrismaClient,
  leadId: string,
  toStage: CrmStage,
  actor: string,
  payload: Record<string, unknown> = {}
): Promise<TransitionResult> {
  try {
    let eventId = '';

    await prisma.$transaction(async (tx) => {
      const lead = await tx.crmLead.findUniqueOrThrow({ where: { id: leadId } });
      const allowed = VALID_TRANSITIONS[lead.stage] ?? [];

      if (!allowed.includes(toStage)) {
        throw new Error(`Invalid transition: ${lead.stage} → ${toStage}`);
      }

      await tx.crmLead.update({
        where: { id: leadId },
        data: { stage: toStage, updatedAt: new Date() },
      });

      const event =       await tx.crmLeadEvent.create({
        data: {
          leadId,
          eventType: 'STAGE_CHANGED',
          fromStage: lead.stage,
          toStage,
          actor,
          payload: payload as object,
        },
      });
      eventId = event.id;
    });

    return { success: true, eventId };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Logs any event against a lead (doesn't change stage).
 */
export async function emitLeadEvent(
  prisma: PrismaClient,
  leadId: string,
  eventType: string,
  actor: string,
  payload: Record<string, unknown> = {}
): Promise<string> {
  const event = await prisma.crmLeadEvent.create({
    data: { leadId, eventType, actor, payload: payload as object },
  });
  return event.id;
}
