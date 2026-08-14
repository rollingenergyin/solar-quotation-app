'use client';

import { useParams } from 'next/navigation';
import LeadDetail from '@/components/leads/LeadDetail';

export default function SalesLeadDetailPage() {
  const params = useParams<{ id: string }>();
  return <LeadDetail leadId={params.id} basePath="/sales/leads" />;
}
