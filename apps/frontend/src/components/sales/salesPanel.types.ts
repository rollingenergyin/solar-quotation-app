export type Bucket = 'URGENT' | 'HOT' | 'WARM' | 'COLD';
export type Urgency = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type EngagementSignal = 'REPLIED' | 'OPENED' | 'MISSED_CALL' | 'IGNORED' | 'NONE';
export type ActionType = 'CALL' | 'WHATSAPP' | 'EMAIL' | 'STAGE_UPDATE';

export type TimelineItem = {
  id: string;
  kind: 'event' | 'message';
  eventType: string;
  description: string;
  detail: string | null;
  at: string;
};

export type SalesPanelLead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  language: string;
  systemKw: number | null;
  score: number;
  source: string;
  stage: string;
  notes: string | null;
  createdAt: string;
  assignedTo: { id: string; name: string } | null;
  // computed
  priorityScore: number;
  bucket: Bucket;
  hoursInactive: number;
  engagementSignal: EngagementSignal;
  conversionProbability: number;
  riskFlags: string[];
  nextAction: {
    type: ActionType;
    urgency: Urgency;
    reason: string;
    cta: string;
    messageKey: string | null;
    suggestedMessage: { en: string; hi: string; mr: string } | null;
  };
  timeline: TimelineItem[];
};
