import { Suspense } from 'react';
import BankTransactionsClient from './BankTransactionsClient';

export default function BankTransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 lg:p-8 w-full max-w-[1600px]">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
          <div className="mt-6 space-y-2">
            <div className="h-4 w-full max-w-xl animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-full max-w-md animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      }
    >
      <BankTransactionsClient />
    </Suspense>
  );
}
