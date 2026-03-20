'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { QuotationTemplateData } from '../../types/quotation-template';
import RollingEnergyLogo from './RollingEnergyLogo';

import CoverPage            from './pages/01-CoverPage';
import IntroductionLetter   from './pages/02-IntroductionLetter';
import AboutCompany         from './pages/03-AboutCompany';
import OurProcess           from './pages/04-OurProcess';
import ExecutiveSummary     from './pages/05-ExecutiveSummary';
import BillOfMaterials      from './pages/06-BillOfMaterials';
import MaintenanceServices  from './pages/07-MaintenanceServices';
import CostBreakdown        from './pages/08-CostBreakdown';
import DepreciationPage     from './pages/08b-Depreciation';
import PaymentTerms         from './pages/09-PaymentTerms';
import LoanEMI              from './pages/10-LoanEMI';
import ROIAnalysis          from './pages/11-ROIAnalysis';
import WhyChooseUs          from './pages/12-WhyChooseUs';
import ContactPage          from './pages/13-ContactPage';

interface Props {
  data: QuotationTemplateData;
  isPdfMode?: boolean; // true when rendering for backend PDF generation (hides toolbar)
  quotationId?: string; // for Back button fallback when no history
}

function getProposalTitle(data: QuotationTemplateData): string {
  const safeName = data.clientName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').slice(0, 40);
  return `${data.quoteNumber}_${safeName}_${data.systemSizeKw}kW_Proposal`;
}

export default function QuotationPrint({ data, isPdfMode = false, quotationId }: Props) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else if (quotationId) {
      router.push(`/sales/quotations/${quotationId}`);
    } else {
      router.push('/sales/quotations');
    }
  };
  useEffect(() => {
    const prev = document.title;
    document.title = getProposalTitle(data);
    return () => { document.title = prev; };
  }, [data.quoteNumber, data.clientName, data.systemSizeKw]);

  useEffect(() => {
    if (isPdfMode) {
      document.documentElement.classList.add('pdf-mode');
      return () => document.documentElement.classList.remove('pdf-mode');
    }
  }, [isPdfMode]);

  const handlePrint = () => {
    const desiredTitle = getProposalTitle(data);
    const prev = document.title;
    document.title = desiredTitle;
    const onAfterPrint = () => {
      document.title = prev;
      window.removeEventListener('afterprint', onAfterPrint);
    };
    window.addEventListener('afterprint', onAfterPrint);
    window.print();
  };

  const {
    quoteNumber, date, clientName, clientAddress, contactPerson,
    systemSizeKw, systemSizeWatts, numModules, inverterSizeKw, areaSquareFt,
    dailyProductionKwh, monthlyProductionKwh, annualProductionKwh,
    monthlySavingsRs, annualSavingsRs, savings30YrRs, breakevenYears,
    baseCost, gstAmount, totalCost, subsidyAmount, netCost,
    emi3Yr, emi5Yr, emi7Yr,
    emi3YrTotalPayable, emi3YrTotalInterest,
    emi5YrTotalPayable, emi5YrTotalInterest,
    emi7YrTotalPayable, emi7YrTotalInterest,
    materials, gridInflationPct,
    templateConfig,
    showSubsidy, showDepreciation, systemType, siteType,
    depreciationTable, depreciationNote,
  } = data;

  // Dynamic page count: DCR = 13 pages, Non-DCR = 14 pages (depreciation inserted as page 9)
  const totalPages = showDepreciation ? 14 : 13;
  const d = showDepreciation ? 1 : 0; // page offset for pages after depreciation insertion

  const systemLabel = systemType === 'NON_DCR' ? 'Non-DCR' : 'DCR';
  const siteLabel   = siteType === 'SOCIETY' ? 'Society' : siteType === 'COMMERCIAL' ? 'Commercial' : siteType === 'INDUSTRIAL' ? 'Industrial' : 'Residential';

  return (
    <>
      {/* ── Sticky toolbar (hidden on print and when isPdfMode for Puppeteer) ──────────────────────────────── */}
      {!isPdfMode && (
      <div
        className="no-print sticky top-0 z-50 flex items-center justify-between px-6 py-3 shadow-md"
        style={{ background: '#161c34' }}
      >
        <div className="flex items-center gap-3">
          <RollingEnergyLogo variant="dark" size="sm" className="flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {templateConfig?.companyName ?? 'Rolling Energy'} — Solar Proposal
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {quoteNumber} · {clientName} · {systemSizeKw} kW
              {' '}·{' '}
              <span style={{ color: systemType === 'NON_DCR' ? '#fbbf24' : '#86efac' }}>
                {systemLabel} / {siteLabel}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{totalPages} pages</span>
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            ← Back
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: '#6690cc', color: '#ffffff' }}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>
      )}

      {/* ── All pages ──────────────────────────────────────────────────────── */}
      <div
        id="quotation-root"
        className={`quotation-wrapper ${isPdfMode ? 'pdf-capturing w-[1200px] min-w-[1200px] mx-auto' : 'w-full'}`}
        data-pdf-ready="true"
      >

        {/* Page 1 — Cover */}
        <CoverPage
          clientName={clientName}
          systemSizeKw={systemSizeKw}
          date={date}
          quoteNumber={quoteNumber}
        />

        {/* Page 2 — Introduction Letter */}
        <IntroductionLetter
          clientName={clientName}
          clientAddress={clientAddress}
          contactPerson={contactPerson}
          date={date}
          systemSizeKw={systemSizeKw}
          quoteNumber={quoteNumber}
          config={templateConfig}
        />

        {/* Page 3 — About Company */}
        <AboutCompany quoteNumber={quoteNumber} config={templateConfig} />

        {/* Page 4 — Our Process */}
        <OurProcess quoteNumber={quoteNumber} config={templateConfig} />

        {/* Page 5 — Executive Summary */}
        <ExecutiveSummary
          quoteNumber={quoteNumber}
          systemSizeKw={systemSizeKw}
          inverterSizeKw={inverterSizeKw ?? systemSizeKw}
          numModules={numModules}
          areaSquareFt={areaSquareFt}
          dailyProductionKwh={dailyProductionKwh}
          monthlyProductionKwh={monthlyProductionKwh}
          annualProductionKwh={annualProductionKwh}
          monthlySavingsRs={monthlySavingsRs}
          annualSavingsRs={annualSavingsRs}
          savings30YrRs={savings30YrRs}
          breakevenYears={breakevenYears}
          netCost={netCost}
          sanctionedLoadKw={data.sanctionedLoadKw}
        />

        {/* Page 6 — Bill of Materials */}
        <BillOfMaterials
          quoteNumber={quoteNumber}
          systemSizeKw={systemSizeKw}
          inverterSizeKw={inverterSizeKw ?? systemSizeKw}
          materials={materials}
          config={templateConfig}
        />

        {/* Page 7 — Maintenance & Services */}
        <MaintenanceServices
          quoteNumber={quoteNumber}
          config={templateConfig}
          pageNumber={7}
          totalPages={totalPages}
        />

        {/* Page 8 — Cost Breakdown (conditional subsidy) */}
        <CostBreakdown
          quoteNumber={quoteNumber}
          systemSizeKw={systemSizeKw}
          baseCost={baseCost}
          gstAmount={gstAmount}
          totalCost={totalCost}
          subsidyAmount={subsidyAmount}
          netCost={netCost}
          showSubsidy={showSubsidy}
          systemType={systemType}
          siteType={siteType}
          pageNumber={8}
          totalPages={totalPages}
        />

        {/* Page 9 (Non-DCR only) — Depreciation Benefits */}
        {showDepreciation && (
          <DepreciationPage
            quoteNumber={quoteNumber}
            netCost={netCost}
            depreciationTable={depreciationTable}
            depreciationNote={depreciationNote}
            pageNumber={9}
            totalPages={totalPages}
          />
        )}

        {/* Page 9 (DCR) / 10 (Non-DCR) — Payment Terms */}
        <PaymentTerms
          quoteNumber={quoteNumber}
          netCost={netCost}
          config={templateConfig}
          pageNumber={9 + d}
          totalPages={totalPages}
        />

        {/* Page 10 / 11 — Loan & EMI */}
        <LoanEMI
          quoteNumber={quoteNumber}
          totalCost={totalCost}
          netCost={netCost}
          emi3Yr={emi3Yr}
          emi5Yr={emi5Yr}
          emi7Yr={emi7Yr}
          emi3YrTotalPayable={emi3YrTotalPayable}
          emi3YrTotalInterest={emi3YrTotalInterest}
          emi5YrTotalPayable={emi5YrTotalPayable}
          emi5YrTotalInterest={emi5YrTotalInterest}
          emi7YrTotalPayable={emi7YrTotalPayable}
          emi7YrTotalInterest={emi7YrTotalInterest}
          pageNumber={10 + d}
          totalPages={totalPages}
        />

        {/* Page 11 / 12 — ROI Analysis */}
        <ROIAnalysis
          quoteNumber={quoteNumber}
          netCost={netCost}
          annualSavingsRs={annualSavingsRs}
          savings30YrRs={savings30YrRs}
          breakevenYears={breakevenYears}
          gridInflationPct={gridInflationPct}
          pageNumber={11 + d}
          totalPages={totalPages}
        />

        {/* Page 12 / 13 — Why Choose Us */}
        <WhyChooseUs
          quoteNumber={quoteNumber}
          config={templateConfig}
          pageNumber={12 + d}
          totalPages={totalPages}
        />

        {/* Page 13 / 14 — Contact */}
        <ContactPage
          quoteNumber={quoteNumber}
          config={templateConfig}
          pageNumber={13 + d}
          totalPages={totalPages}
        />
      </div>
    </>
  );
}
