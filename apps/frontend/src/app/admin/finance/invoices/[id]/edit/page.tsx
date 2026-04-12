'use client';

import { useParams } from 'next/navigation';
import { InvoiceForm } from '../../new/components/InvoiceForm';

export default function EditInvoicePage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  if (!id) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
        <p className="text-sm text-slate-600">Missing invoice id.</p>
      </div>
    );
  }
  return <InvoiceForm mode="edit" invoiceId={id} />;
}
