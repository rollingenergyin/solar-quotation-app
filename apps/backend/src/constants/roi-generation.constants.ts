/**
 * Productive-day assumptions for solar ROI / generation (not calendar 365 / 30).
 * - Annual kWh ≈ kW × peak sun hours × days/year × efficiency
 * - Avg monthly bill kWh → implied daily load uses days/month below
 */
export const ROI_GENERATION_DAYS_PER_YEAR = 300;
export const ROI_GENERATION_DAYS_PER_MONTH = 25;
