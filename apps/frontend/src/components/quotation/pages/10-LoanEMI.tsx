'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';

interface Props {
  quoteNumber: string;
  totalCost: number;
  netCost: number;
  emi3Yr: number;
  emi5Yr: number;
  emi7Yr: number;
  emi3YrTotalPayable?: number;
  emi3YrTotalInterest?: number;
  emi5YrTotalPayable?: number;
  emi5YrTotalInterest?: number;
  emi7YrTotalPayable?: number;
  emi7YrTotalInterest?: number;
  pageNumber?: number;
  totalPages?: number;
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function LoanEMI({
  quoteNumber, totalCost, netCost,
  emi3Yr, emi5Yr, emi7Yr,
  emi3YrTotalPayable, emi3YrTotalInterest,
  emi5YrTotalPayable, emi5YrTotalInterest,
  emi7YrTotalPayable, emi7YrTotalInterest,
  pageNumber = 10, totalPages = 13,
}: Props) {
  const loanAmount = Math.round(totalCost * 0.8);
  const downPayment = Math.round(totalCost * 0.2);

  const plans = [
    {
      tenure: '3 Years',
      months: 36,
      emi: emi3Yr,
      totalPayable: emi3YrTotalPayable ?? emi3Yr * 36,
      totalInterest: emi3YrTotalInterest ?? emi3Yr * 36 - loanAmount,
      icon: '⚡',
      highlight: false,
      tag: 'Pay off fastest',
    },
    {
      tenure: '5 Years',
      months: 60,
      emi: emi5Yr,
      totalPayable: emi5YrTotalPayable ?? emi5Yr * 60,
      totalInterest: emi5YrTotalInterest ?? emi5Yr * 60 - loanAmount,
      icon: '⭐',
      highlight: true,
      tag: 'Most Popular',
    },
    {
      tenure: '7 Years',
      months: 84,
      emi: emi7Yr,
      totalPayable: emi7YrTotalPayable ?? emi7Yr * 84,
      totalInterest: emi7YrTotalInterest ?? emi7Yr * 84 - loanAmount,
      icon: '💰',
      highlight: false,
      tag: 'Lowest EMI',
    },
  ];

  const banks = [
    { name: 'SBI Solar Loan', rate: '7.5% onwards', note: 'PM Surya Ghar scheme' },
    { name: 'IREDA / NABARD', rate: '8.0% onwards', note: 'Green energy financing' },
    { name: 'PNB / BOB', rate: '8.5% onwards', note: 'Personal / home loan' },
    { name: 'Private Banks', rate: '9–12%', note: 'HDFC, Axis, ICICI etc.' },
  ];

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader quoteNumber={quoteNumber} pageTitle="Loan & EMI Options" pageNumber={pageNumber} totalPages={totalPages} />

      <div className="flex-1 px-12 py-6" style={{ paddingBottom: '36px' }}>
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#6690cc' }}>
            Finance Your Solar System
          </p>
          <h2
            className="text-2xl font-bold"
            style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
          >
            EMI Plans — 80% Loan @ 9% p.a.
          </h2>
          <div className="mt-2 h-0.5 w-12" style={{ background: '#6690cc' }} />
        </div>

        {/* Loan summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total System Cost', value: fmt(totalCost), sub: 'Before subsidy' },
            { label: 'Down Payment (20%)', value: fmt(downPayment), sub: 'On confirmation' },
            { label: 'Loan Amount (80%)', value: fmt(loanAmount), sub: 'Financed amount' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-4 text-center border"
              style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}
            >
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className="text-xl font-bold" style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}>
                {s.value}
              </p>
              <p className="text-xs text-gray-400">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* EMI cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {plans.map((plan) => (
            <div
              key={plan.tenure}
              className="rounded-2xl p-6 relative overflow-hidden"
              style={{
                background: plan.highlight
                  ? 'linear-gradient(135deg, #161c34, #2c4570)'
                  : '#f9fafb',
                border: plan.highlight ? 'none' : '1px solid #e5e7eb',
                boxShadow: plan.highlight ? '0 8px 32px rgba(22,28,52,0.25)' : 'none',
              }}
            >
              {plan.highlight && (
                <div
                  className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: '#6690cc', color: '#ffffff' }}
                >
                  {plan.tag}
                </div>
              )}
              {!plan.highlight && (
                <div
                  className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-3"
                  style={{ background: '#eef3fb', color: '#3c5e94' }}
                >
                  {plan.tag}
                </div>
              )}

              <span style={{ fontSize: '28px' }}>{plan.icon}</span>

              <p
                className="text-xs font-semibold tracking-widest uppercase mt-3 mb-1"
                style={{ color: plan.highlight ? 'rgba(255,255,255,0.6)' : '#9ca3af' }}
              >
                {plan.tenure} ({plan.months} months)
              </p>

              <p
                className="text-3xl font-bold leading-none mb-0.5"
                style={{
                  color: plan.highlight ? '#6690cc' : '#161c34',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {fmt(plan.emi)}
              </p>
              <p
                className="text-xs"
                style={{ color: plan.highlight ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}
              >
                per month
              </p>

              <div
                className="mt-4 pt-4"
                style={{ borderTop: plan.highlight ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb' }}
              >
                <p
                  className="text-xs"
                  style={{ color: plan.highlight ? 'rgba(255,255,255,0.6)' : '#6b7280' }}
                >
                  Total Payable: {fmt(plan.totalPayable)}
                </p>
                <p
                  className="text-xs"
                  style={{ color: plan.highlight ? 'rgba(255,255,255,0.4)' : '#9ca3af' }}
                >
                  Total Interest: {fmt(plan.totalInterest)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bank partners */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#9ca3af' }}>
            Solar Loan Options Available
          </p>
          <div className="grid grid-cols-4 gap-3">
            {banks.map((b) => (
              <div
                key={b.name}
                className="rounded-xl p-3 border text-center"
                style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}
              >
                <p className="text-xs font-semibold mb-1" style={{ color: '#161c34' }}>{b.name}</p>
                <p className="text-sm font-bold" style={{ color: '#6690cc', fontFamily: 'Poppins, sans-serif' }}>
                  {b.rate}
                </p>
                <p className="text-xs text-gray-400">{b.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={pageNumber} />
    </div>
  );
}
