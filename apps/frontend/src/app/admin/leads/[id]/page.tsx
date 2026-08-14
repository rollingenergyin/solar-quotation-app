'use client';

import { useParams } from 'next/navigation';
import LeadDetail from '@/components/leads/LeadDetail';

export default function AdminLeadDetailPage() {
  const params = useParams<{ id: string }>();
  return <LeadDetail leadId={params.id} basePath="/admin/leads" />;
}
