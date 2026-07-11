import CrmPanel from '@/components/crm/CrmPanel';

export default function SalesCrmPage() {
  return <CrmPanel basePath="/sales/crm" allowedTabs={['pipeline', 'analytics', 'import']} />;
}
