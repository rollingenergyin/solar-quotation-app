export function isCommercialOrIndustrialSite(siteType?: string | null): boolean {
  return siteType === 'COMMERCIAL' || siteType === 'INDUSTRIAL';
}

/** Depreciation page applies to all commercial / industrial quotations (DCR and Non-DCR). */
export function shouldShowDepreciationPage(opts: {
  siteType?: string | null;
  combinedSystems?: Array<{ siteType?: string | null }>;
}): boolean {
  if (isCommercialOrIndustrialSite(opts.siteType)) return true;
  return opts.combinedSystems?.some((s) => isCommercialOrIndustrialSite(s.siteType)) ?? false;
}
