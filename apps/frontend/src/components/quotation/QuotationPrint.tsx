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
import CombinedSystemsPage  from './pages/05a-CombinedSystems';
import BillOfMaterials      from './pages/06-BillOfMaterials';
import SiteCostBreakdown    from './pages/06b-SiteCostBreakdown';
import StructureConfiguration from './pages/06c-StructureConfiguration';
import {
  getTotalQuotationPages,
  buildRoiPrintPages,
  planCombinedSystemsPrintPages,
  planCostingPrintPages,
  hasSiteCostingPage,
  hasStructureConfigPage,
} from './quotation-page-plan';
import { shouldShowPmSuryaGharOnKeyMetrics } from '@/constants/costing-options';
import MaintenanceServices  from './pages/07-MaintenanceServices';
import CostingOptionsPage   from './pages/08c-CostingOptionsPage';
import DepreciationPage     from './pages/08b-Depreciation';
import PaymentTerms         from './pages/09-PaymentTerms';
import LoanEMI              from './pages/10-LoanEMI';
import ROIAnalysis          from './pages/11-ROIAnalysis';
import MultiROIAnalysis     from './pages/11b-MultiROIAnalysis';
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
    sanctionedLoadKw,
    sanctionedLoadIncreasedToKw,
    panelWattageWp,
    meterPhase,
    structureType,
    supplementaryCosts,
    templateConfig,
    showSubsidy, showDepreciation, systemType, siteType,
    depreciationTable, depreciationNote,
    quotationMode, combinedSystems, combinedSingleCosting,
    costingOptions,
    proposalNote,
    siteCosting,
    sitePhotos,
  } = data;

  const isCombined = quotationMode === 'COMBINED' && (combinedSystems?.length ?? 0) >= 2;
  const totalPages = getTotalQuotationPages(data);
  const roiPages = buildRoiPrintPages(data);
  const combinedPageSlices = isCombined
    ? planCombinedSystemsPrintPages(combinedSystems!.length, Boolean(combinedSingleCosting))
    : [];
  const resolvedCostingOptions = costingOptions?.length
    ? costingOptions
    : [{
        index: 1,
        title: '',
        systemType: systemType ?? 'DCR',
        siteType: siteType ?? 'RESIDENTIAL',
        systemSizeKw,
        pricePerWatt: baseCost / (systemSizeKw * 1000) || 0,
        baseCost,
        gstAmount,
        grossCost: totalCost,
        subsidyAmount,
        netCost,
        showSubsidy: showSubsidy ?? true,
      }];
  const costingPageSlices = planCostingPrintPages(resolvedCostingOptions.length);
  const subsidyNoteForKeyMetrics = shouldShowPmSuryaGharOnKeyMetrics(resolvedCostingOptions.length)
    ? resolvedCostingOptions.find((o) => o.showSubsidy) ?? null
    : null;

  let page = 5;

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
              {quoteNumber} · {clientName} · {isCombined ? `Combined ${systemSizeKw} kW` : `${systemSizeKw} kW`}
              {isCombined && combinedSystems ? ` (${combinedSystems.length} systems)` : ''}
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

        <CoverPage
          clientName={clientName}
          systemSizeKw={systemSizeKw}
          date={date}
          quoteNumber={quoteNumber}
          isCombined={isCombined}
          systemCount={combinedSystems?.length}
        />

        <IntroductionLetter
          clientName={clientName}
          clientAddress={clientAddress}
          contactPerson={contactPerson}
          date={date}
          systemSizeKw={systemSizeKw}
          quoteNumber={quoteNumber}
          config={templateConfig}
          proposalNote={proposalNote}
        />

        <AboutCompany quoteNumber={quoteNumber} config={templateConfig} />

        <OurProcess quoteNumber={quoteNumber} config={templateConfig} proposalNote={proposalNote} />

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
          sanctionedLoadKw={sanctionedLoadKw}
          sanctionedLoadIncreasedToKw={sanctionedLoadIncreasedToKw}
          panelWattageWp={panelWattageWp}
          totalPages={totalPages}
          proposalNote={proposalNote}
          hideSanctionedLoadAssessment={isCombined}
          subsidyNoteOption={subsidyNoteForKeyMetrics}
        />

        <BillOfMaterials
          quoteNumber={quoteNumber}
          systemSizeKw={systemSizeKw}
          inverterSizeKw={inverterSizeKw ?? systemSizeKw}
          materials={materials}
          config={templateConfig}
          panelWattageWp={panelWattageWp}
          numModules={numModules}
          structureType={isCombined ? null : structureType}
          meterPhase={meterPhase}
          supplementaryCosts={supplementaryCosts}
          pageNumber={++page}
          totalPages={totalPages}
          proposalNote={proposalNote}
        />

        {hasSiteCostingPage(data) && siteCosting && (
          <SiteCostBreakdown
            quoteNumber={quoteNumber}
            siteCosting={siteCosting}
            sitePhotos={sitePhotos}
            pageNumber={++page}
            totalPages={totalPages}
          />
        )}

        {hasStructureConfigPage(data) && siteCosting?.structureSummary && (
          <StructureConfiguration
            quoteNumber={quoteNumber}
            structureSummary={siteCosting.structureSummary}
            pageNumber={++page}
            totalPages={totalPages}
          />
        )}

        <MaintenanceServices
          quoteNumber={quoteNumber}
          config={templateConfig}
          pageNumber={++page}
          totalPages={totalPages}
          proposalNote={proposalNote}
        />

        {isCombined && combinedSystems && combinedPageSlices.map((slice, idx) => (
          <CombinedSystemsPage
            key={`combined-${idx}`}
            quoteNumber={quoteNumber}
            systems={combinedSystems}
            showSubsidy={showSubsidy}
            systemIndices={slice.systemIndices}
            continuation={slice.continuation}
            pageNumber={++page}
            totalPages={totalPages}
            proposalNote={proposalNote}
            showProposalNote={!slice.continuation}
            singleCosting={Boolean(combinedSingleCosting)}
          />
        ))}

        {costingPageSlices.map((slice, idx) => (
          <CostingOptionsPage
            key={`costing-${idx}`}
            quoteNumber={quoteNumber}
            options={resolvedCostingOptions}
            slice={slice}
            pageNumber={++page}
            totalPages={totalPages}
            proposalNote={proposalNote}
            showProposalNote={idx === 0}
          />
        ))}

        {showDepreciation && (
          <DepreciationPage
            quoteNumber={quoteNumber}
            netCost={netCost}
            depreciationTable={depreciationTable}
            depreciationNote={depreciationNote}
            pageNumber={++page}
            totalPages={totalPages}
            proposalNote={proposalNote}
          />
        )}

        <PaymentTerms
          quoteNumber={quoteNumber}
          config={templateConfig}
          pageNumber={++page}
          totalPages={totalPages}
          proposalNote={proposalNote}
        />

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
          pageNumber={++page}
          totalPages={totalPages}
          proposalNote={proposalNote}
        />

        {roiPages.map((roiPage, i) => {
          const p = ++page;
          if (roiPage.specs.length >= 2) {
            return (
              <MultiROIAnalysis
                key={`roi-multi-${i}`}
                quoteNumber={quoteNumber}
                specs={roiPage.specs}
                gridInflationPct={gridInflationPct}
                pageNumber={p}
                totalPages={totalPages}
                proposalNote={proposalNote}
              />
            );
          }
          const spec = roiPage.specs[0];
          return (
            <ROIAnalysis
              key={`roi-${i}`}
              quoteNumber={quoteNumber}
              netCost={spec.netCost}
              annualSavingsRs={spec.annualSavingsRs}
              savings30YrRs={spec.savings30YrRs}
              breakevenYears={spec.breakevenYears}
              gridInflationPct={gridInflationPct}
              analysisTitle={spec.analysisTitle}
              analysisSubtitle={spec.analysisSubtitle}
              pageNumber={p}
              totalPages={totalPages}
              proposalNote={proposalNote}
            />
          );
        })}

        <WhyChooseUs
          quoteNumber={quoteNumber}
          config={templateConfig}
          pageNumber={++page}
          totalPages={totalPages}
          proposalNote={proposalNote}
        />

        <ContactPage
          quoteNumber={quoteNumber}
          config={templateConfig}
          pageNumber={++page}
          totalPages={totalPages}
        />
      </div>
    </>
  );
}
