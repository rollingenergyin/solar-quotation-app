/**
 * Automation Engine
 *
 * Flow:
 *  Event arrives → load matching active rules →
 *  evaluate conditions → idempotency check → loop guard →
 *  execute actions → write execution record
 */
import { PrismaClient } from '@prisma/client';
import { onEvent, type BusEvent } from './event-bus.service.js';
import { getNestedValue } from '../../utils/object.utils.js';

const prisma = new PrismaClient();

// ── Condition evaluator ──────────────────────────────────────────────────────

type Condition = {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains';
  value: unknown;
};

function evaluateConditions(conditions: Condition[], context: Record<string, unknown>): boolean {
  if (!conditions.length) return true;
  return conditions.every((c) => {
    const actual = getNestedValue(context, c.field);
    switch (c.op) {
      case 'eq':       return actual === c.value;
      case 'neq':      return actual !== c.value;
      case 'gt':       return Number(actual) > Number(c.value);
      case 'gte':      return Number(actual) >= Number(c.value);
      case 'lt':       return Number(actual) < Number(c.value);
      case 'lte':      return Number(actual) <= Number(c.value);
      case 'in':       return (c.value as unknown[]).includes(actual);
      case 'nin':      return !(c.value as unknown[]).includes(actual);
      case 'contains': return String(actual ?? '').toLowerCase().includes(String(c.value).toLowerCase());
      default:         return false;
    }
  });
}

// ── Loop guard ───────────────────────────────────────────────────────────────

async function loopGuardPassed(ruleId: string, leadId: string, maxPerDay: number): Promise<boolean> {
  const since = new Date(Date.now() - 86_400_000);
  const count = await prisma.automationExecution.count({
    where: {
      ruleId,
      leadId,
      status: { in: ['DONE', 'RUNNING'] },
      createdAt: { gte: since },
    },
  });
  return count < maxPerDay;
}

// ── Action executor ──────────────────────────────────────────────────────────

type Action = {
  type: string;
  templateId?: string;
  channel?: string;
  delayMinutes?: number;
  toStage?: string;
  message?: string;
  assignTo?: string;
  [key: string]: unknown;
};

async function executeActions(leadId: string, actions: Action[]): Promise<void> {
  for (const action of actions) {
    if (action.delayMinutes && action.delayMinutes > 0) {
      await new Promise((r) => setTimeout(r, Math.min(action.delayMinutes! * 60_000, 5000)));
    }

    switch (action.type) {
      case 'send_whatsapp':
      case 'send_email':
      case 'send_sms': {
        const { dispatchMessage } = await import('./communication/message-dispatcher.service.js');
        const lead = await prisma.crmLead.findUnique({ where: { id: leadId } });
        if (lead && action.templateId) {
          await dispatchMessage({
            leadId,
            channel: action.channel ?? action.type.replace('send_', ''),
            templateId: action.templateId,
            language: lead.language,
            variables: { name: lead.name, phone: lead.phone },
          });
        }
        break;
      }
      case 'change_stage': {
        if (action.toStage) {
          const { transitionStage } = await import('./lead-state-machine.service.js');
          const { CrmStage } = await import('@prisma/client');
          const stage = action.toStage as keyof typeof CrmStage;
          if (stage in CrmStage) {
            await transitionStage(prisma, leadId, CrmStage[stage], 'automation');
          }
        }
        break;
      }
      case 'add_note': {
        if (action.message) {
          await prisma.crmLeadEvent.create({
            data: {
              leadId,
              eventType: 'NOTE_ADDED',
              actor: 'automation',
              payload: { note: action.message },
            },
          });
        }
        break;
      }
      case 'assign_rep': {
        if (action.assignTo) {
          await prisma.crmLead.update({
            where: { id: leadId },
            data: { assignedToId: action.assignTo },
          });
        }
        break;
      }
      case 'recalculate_score': {
        const { recalculateScore } = await import('./lead-scorer.service.js');
        await recalculateScore(prisma, leadId);
        break;
      }
      default:
        console.warn('[Automation] Unknown action type:', action.type);
    }
  }
}

// ── Main engine ──────────────────────────────────────────────────────────────

async function processEvent(busEvent: BusEvent): Promise<void> {
  const rules = await prisma.automationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'asc' },
  });

  const lead = await prisma.crmLead.findUnique({ where: { id: busEvent.leadId } });
  if (!lead) return;

  const context = {
    event: busEvent.event,
    lead: { ...lead, score: lead.score },
    payload: busEvent.payload,
  };

  for (const rule of rules) {
    const trigger = rule.trigger as { event: string; filter?: Record<string, unknown> };
    if (trigger.event !== busEvent.event) continue;

    // Check trigger filter (simple key=value match)
    if (trigger.filter) {
      const filterMatch = Object.entries(trigger.filter).every(
        ([k, v]) => getNestedValue(context.payload as Record<string, unknown>, k) === v
          || getNestedValue(context as Record<string, unknown>, k) === v
      );
      if (!filterMatch) continue;
    }

    // Evaluate conditions
    const conditions = (rule.conditions as Condition[]) ?? [];
    if (!evaluateConditions(conditions, context as Record<string, unknown>)) continue;

    // Loop guard
    if (!(await loopGuardPassed(rule.id, busEvent.leadId, rule.loopGuard))) {
      console.log(`[Automation] Loop guard blocked rule ${rule.id} for lead ${busEvent.leadId}`);
      continue;
    }

    // Idempotency — skip if already executed
    const existing = await prisma.automationExecution.findUnique({
      where: {
        ruleId_leadId_triggerEventId: {
          ruleId: rule.id,
          leadId: busEvent.leadId,
          triggerEventId: busEvent.eventId,
        },
      },
    });
    if (existing) continue;

    // Create execution record
    const exec = await prisma.automationExecution.create({
      data: {
        ruleId: rule.id,
        leadId: busEvent.leadId,
        triggerEventId: busEvent.eventId,
        status: 'RUNNING',
        startedAt: new Date(),
        attempts: 1,
      },
    });

    try {
      await executeActions(busEvent.leadId, rule.actions as Action[]);
      await prisma.automationExecution.update({
        where: { id: exec.id },
        data: { status: 'DONE', completedAt: new Date() },
      });
      console.log(`[Automation] Rule "${rule.name}" executed for lead ${busEvent.leadId}`);
    } catch (err) {
      await prisma.automationExecution.update({
        where: { id: exec.id },
        data: {
          status: 'FAILED',
          result: { error: (err as Error).message },
          completedAt: new Date(),
        },
      });
      console.error(`[Automation] Rule "${rule.name}" failed:`, (err as Error).message);
    }
  }
}

/**
 * Register the automation engine as a listener on all CRM events.
 * Called once at server startup.
 */
export function startAutomationEngine() {
  const crmEvents = [
    'lead.created',
    'lead.stage_changed',
    'lead.message_received',
    'lead.message_sent',
    'lead.score_updated',
  ];
  for (const event of crmEvents) {
    onEvent(event, processEvent);
  }
  console.log('[Automation] Engine registered for', crmEvents.length, 'event types');
}
