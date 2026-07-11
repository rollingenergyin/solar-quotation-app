/**
 * Social Calendar Service — 2026 Full Year Content Plan
 *
 * Strategy:
 *   Mon/Wed/Fri  — Planned content (Education 40% | Authority 30% | Trust 20% | Conversion 10%)
 *   Tue/Thu      — News slots (fill ≤5 days before posting, else auto-fallback)
 *   Special days — Festival / seasonal content overrides
 *
 * Total slots: ~260 planned + ~104 news = ~364 calendar entries
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Indian Festivals & Solar Events 2026 ─────────────────────────────────────

interface SpecialDay {
  date: string; // YYYY-MM-DD
  theme: string;
  slotType: 'FESTIVAL' | 'SEASONAL' | 'SOLAR_EVENT';
  segment?: string;
}

export const SPECIAL_DAYS_2026: SpecialDay[] = [
  // January
  { date: '2026-01-01', theme: 'New Year — Start 2026 with Energy Savings Goals', slotType: 'SEASONAL' },
  { date: '2026-01-14', theme: 'Makar Sankranti — Celebrate with Solar Energy', slotType: 'FESTIVAL' },
  { date: '2026-01-26', theme: 'Republic Day — Energy Independence for India', slotType: 'FESTIVAL' },

  // February
  { date: '2026-02-14', theme: 'Valentine\'s Day — Love Your Planet, Go Solar', slotType: 'SEASONAL' },
  { date: '2026-02-20', theme: 'World Social Justice Day — Affordable Clean Energy for All', slotType: 'SOLAR_EVENT' },

  // March
  { date: '2026-03-08', theme: 'International Women\'s Day — Women-Owned Homes Going Solar', slotType: 'SEASONAL' },
  { date: '2026-03-17', theme: 'Holi — Colourful Future with Solar Energy', slotType: 'FESTIVAL' },
  { date: '2026-03-22', theme: 'World Water Day — Solar Pumps for Water Conservation', slotType: 'SOLAR_EVENT', segment: 'GROUND_MOUNT' },
  { date: '2026-03-28', theme: 'Earth Hour — Switch to Solar, Not Just Off for an Hour', slotType: 'SOLAR_EVENT' },

  // April — Summer build-up
  { date: '2026-04-06', theme: 'Gudi Padwa — New Beginning with Solar Energy', slotType: 'FESTIVAL' },
  { date: '2026-04-14', theme: 'Dr Ambedkar Jayanti — Energy Equality Through Solar', slotType: 'FESTIVAL' },
  { date: '2026-04-22', theme: 'Earth Day — Our Solar Contribution to the Planet', slotType: 'SOLAR_EVENT' },
  { date: '2026-04-15', theme: 'Summer Begins — Electricity Bills Will Spike. Go Solar NOW', slotType: 'SEASONAL' },

  // May — Peak summer
  { date: '2026-05-01', theme: 'Maharashtra Day — Proud to Power Maharashtra with Solar', slotType: 'FESTIVAL' },
  { date: '2026-05-01', theme: 'Labour Day — Solar: The Smart Investment for Hard-Working Families', slotType: 'SEASONAL' },
  { date: '2026-05-10', theme: 'Peak Summer — Record Electricity Bills? Time for Solar', slotType: 'SEASONAL' },
  { date: '2026-05-24', theme: 'Akshay Tritiya — Auspicious Day to Invest in Solar', slotType: 'FESTIVAL' },

  // June
  { date: '2026-06-01', theme: 'Pre-Monsoon Solar Performance — What Happens in Rainy Season?', slotType: 'SEASONAL' },
  { date: '2026-06-05', theme: 'World Environment Day — Our Green Commitment', slotType: 'SOLAR_EVENT' },
  { date: '2026-06-21', theme: 'World Solar Day — Celebrating Clean Energy in India', slotType: 'SOLAR_EVENT' },

  // July
  { date: '2026-07-01', theme: 'Monsoon Myth-Busting — Solar Works in Rain Too!', slotType: 'SEASONAL' },
  { date: '2026-07-15', theme: 'Mid-Year Review — How Much Have Our Customers Saved?', slotType: 'SOLAR_EVENT' },

  // August
  { date: '2026-08-15', theme: 'Independence Day — Energy Independence with Solar', slotType: 'FESTIVAL' },
  { date: '2026-08-25', theme: 'Raksha Bandhan — Protect Your Family from Rising Bills', slotType: 'FESTIVAL' },

  // September
  { date: '2026-09-08', theme: 'Ganesh Chaturthi — Eco-Friendly Solar Celebration', slotType: 'FESTIVAL' },
  { date: '2026-09-20', theme: 'Ganesh Visarjan — Green Visarjan with Solar Commitment', slotType: 'FESTIVAL' },

  // October
  { date: '2026-10-02', theme: 'Gandhi Jayanti — Swachh Urja, Swachh Bharat', slotType: 'FESTIVAL' },
  { date: '2026-10-09', theme: 'Dussehra — Conquer Your Electricity Bills with Solar', slotType: 'FESTIVAL' },
  { date: '2026-10-20', theme: 'Diwali Campaign Launch — Light Up with Solar Energy', slotType: 'FESTIVAL' },

  // November — Diwali season
  { date: '2026-11-01', theme: 'Diwali Special Offer — Solar with ₹X Discount + Free AMC', slotType: 'FESTIVAL' },
  { date: '2026-11-05', theme: 'Post-Diwali — How Solar Reduces Your Carbon Footprint', slotType: 'SEASONAL' },
  { date: '2026-11-15', theme: 'Guru Nanak Jayanti — Seva with Solar: Giving Back Green Energy', slotType: 'FESTIVAL' },

  // December
  { date: '2026-12-01', theme: 'Winter Solar Performance — Panels Work Even in Cold', slotType: 'SEASONAL' },
  { date: '2026-12-14', theme: 'National Energy Conservation Day — Our Solar Impact This Year', slotType: 'SOLAR_EVENT' },
  { date: '2026-12-25', theme: 'Christmas — Gift of Clean Energy', slotType: 'FESTIVAL' },
  { date: '2026-12-31', theme: 'New Year\'s Eve — 2026 Solar Recap + 2027 Goals', slotType: 'SEASONAL' },
];

// ─── Monthly Theme Framework ───────────────────────────────────────────────────

const MONTHLY_THEMES: Record<number, { focus: string; segment: string; contentMix: string }> = {
  1:  { focus: 'New Year Energy Goals', segment: 'RESIDENTIAL', contentMix: 'Education + Trust' },
  2:  { focus: 'Save More Love More', segment: 'RESIDENTIAL', contentMix: 'Education + Conversion' },
  3:  { focus: 'Summer Prep — Act Before Bills Hit', segment: 'RESIDENTIAL', contentMix: 'Conversion + Education' },
  4:  { focus: 'Peak Summer is Coming — Commercial Push', segment: 'COMMERCIAL', contentMix: 'Conversion + Authority' },
  5:  { focus: 'Highest Bills of the Year — Drive Urgency', segment: 'RESIDENTIAL', contentMix: 'Conversion + Trust' },
  6:  { focus: 'Monsoon Performance — Myth Busting', segment: 'RESIDENTIAL', contentMix: 'Education + Authority' },
  7:  { focus: 'Industrial & Society Push — Off-Season Prep', segment: 'SOCIETY', contentMix: 'Authority + Education' },
  8:  { focus: 'Independence Day + Case Studies', segment: 'COMMERCIAL', contentMix: 'Authority + Trust' },
  9:  { focus: 'Ganesh Festival + Society Campaigns', segment: 'SOCIETY', contentMix: 'Festival + Conversion' },
  10: { focus: 'Dussehra/Diwali Build-up + Ground Mount', segment: 'GROUND_MOUNT', contentMix: 'Festival + Conversion' },
  11: { focus: 'Diwali Offers + Industrial Year-End Push', segment: 'INDUSTRIAL', contentMix: 'Conversion + Trust' },
  12: { focus: 'Year-End Review + Section 32 Depreciation', segment: 'COMMERCIAL', contentMix: 'Authority + Conversion' },
};

// ─── Weekly Content Themes (cycling) ─────────────────────────────────────────

const WEEKLY_THEMES = [
  { theme: 'How Solar Works — Simple Explainer', strategy: 'EDUCATION' as const },
  { theme: 'Customer Success Story', strategy: 'AUTHORITY' as const },
  { theme: 'PM Surya Ghar Subsidy Guide', strategy: 'EDUCATION' as const },
  { theme: 'ROI Calculator — See Your Savings', strategy: 'CONVERSION' as const },
  { theme: 'Net Metering — Sell Electricity Back to Grid', strategy: 'EDUCATION' as const },
  { theme: 'Solar Panel Myths vs Reality', strategy: 'EDUCATION' as const },
  { theme: 'Installation Process Walkthrough', strategy: 'TRUST' as const },
  { theme: 'Comparison: Solar vs Generator vs Grid', strategy: 'EDUCATION' as const },
  { theme: 'Government Policy Updates', strategy: 'EDUCATION' as const },
  { theme: 'How We Choose Panels (Quality Assurance)', strategy: 'AUTHORITY' as const },
  { theme: 'Battery Storage FAQ', strategy: 'EDUCATION' as const },
  { theme: 'Monsoon Performance Data', strategy: 'TRUST' as const },
  { theme: 'Limited Time Offer', strategy: 'CONVERSION' as const },
  { theme: 'Maintenance Guide — Zero Effort', strategy: 'TRUST' as const },
  { theme: 'Case Study: Society Bill Reduction', strategy: 'AUTHORITY' as const },
  { theme: 'Industrial Solar Economics', strategy: 'EDUCATION' as const },
  { theme: 'Referral Program Announcement', strategy: 'CONVERSION' as const },
  { theme: 'Certifications & Quality Standards', strategy: 'TRUST' as const },
  { theme: 'Seasonal Savings Analysis', strategy: 'EDUCATION' as const },
  { theme: 'FAQ — Top Questions We Get', strategy: 'EDUCATION' as const },
  { theme: 'Team & Installation Process', strategy: 'TRUST' as const },
  { theme: 'Commercial Depreciation Benefit', strategy: 'EDUCATION' as const },
  { theme: 'Ground Mount Project Showcase', strategy: 'AUTHORITY' as const },
  { theme: 'Electricity Tariff Hike Awareness', strategy: 'CONVERSION' as const },
  { theme: 'Free Site Assessment CTA', strategy: 'CONVERSION' as const },
  { theme: 'Energy Independence Story', strategy: 'TRUST' as const },
];

const CONTENT_TYPES_CYCLE: Array<'STATIC_POST' | 'CAROUSEL' | 'REEL'> = [
  'STATIC_POST', 'CAROUSEL', 'STATIC_POST', 'REEL', 'STATIC_POST',
  'CAROUSEL', 'STATIC_POST', 'STATIC_POST', 'CAROUSEL', 'REEL',
];

// ─── Calendar Generator ───────────────────────────────────────────────────────

export interface CalendarSlot {
  date: string;
  slotType: 'PLANNED' | 'NEWS_SLOT' | 'FESTIVAL' | 'SEASONAL' | 'SOLAR_EVENT';
  theme: string;
  segment: string;
  isNewsSlot: boolean;
  dayOfWeek: number; // 0 = Sun
}

export function generate2026Calendar(): CalendarSlot[] {
  const slots: CalendarSlot[] = [];
  const specialMap = new Map<string, SpecialDay>(SPECIAL_DAYS_2026.map((d) => [d.date, d]));

  const start = new Date('2026-01-01');
  const end = new Date('2026-12-31');

  let weeklyThemeIndex = 0;
  let contentTypeIndex = 0;
  let newsSlotCount = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const month = d.getMonth() + 1;

    // Check for special day
    const special = specialMap.get(dateStr);
    if (special) {
      const monthData = MONTHLY_THEMES[month];
      slots.push({
        date: dateStr,
        slotType: special.slotType,
        theme: special.theme,
        segment: special.segment ?? monthData?.segment ?? 'RESIDENTIAL',
        isNewsSlot: false,
        dayOfWeek: dow,
      });
      continue;
    }

    // Mon/Wed/Fri → planned content
    if (dow === 1 || dow === 3 || dow === 5) {
      const themeData = WEEKLY_THEMES[weeklyThemeIndex % WEEKLY_THEMES.length];
      const monthData = MONTHLY_THEMES[month];
      const segment = monthData?.segment ?? 'RESIDENTIAL';

      slots.push({
        date: dateStr,
        slotType: 'PLANNED',
        theme: themeData.theme,
        segment,
        isNewsSlot: false,
        dayOfWeek: dow,
      });

      if (dow === 1) weeklyThemeIndex++;
      if (dow === 5) contentTypeIndex++;
    }

    // Tue/Thu → news slots (2 per week)
    if (dow === 2 || dow === 4) {
      newsSlotCount++;
      slots.push({
        date: dateStr,
        slotType: 'NEWS_SLOT',
        theme: `News Slot #${newsSlotCount} — To be filled 5 days before ${dateStr}`,
        segment: 'RESIDENTIAL',
        isNewsSlot: true,
        dayOfWeek: dow,
      });
    }
  }

  return slots;
}

// ─── DB Persistence ───────────────────────────────────────────────────────────

export async function seedCalendarToDB(year = 2026): Promise<number> {
  // Check if already seeded
  const existing = await (prisma as any).socialCalendarSlot.count({
    where: { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
  });
  if (existing > 0) return existing;

  const slots = generate2026Calendar();
  const batch = slots.map((s) => ({
    date: new Date(s.date),
    slotType: s.slotType,
    theme: s.theme,
    segment: s.segment,
    isNewsSlot: s.isNewsSlot,
  }));

  await (prisma as any).socialCalendarSlot.createMany({ data: batch, skipDuplicates: true });
  return batch.length;
}

// ─── Calendar Query Helpers ────────────────────────────────────────────────────

export async function getCalendarMonth(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const slots = await (prisma as any).socialCalendarSlot.findMany({
    where: { date: { gte: start, lte: end } },
    include: {
      post: {
        select: {
          id: true, title: true, status: true, contentType: true,
          segment: true, platforms: true, scheduledAt: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  return slots;
}

export async function getNewsSlotsDue(daysAhead = 5) {
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return (prisma as any).socialCalendarSlot.findMany({
    where: {
      isNewsSlot: true,
      date: { gte: now, lte: cutoff },
      post: null,
    },
    orderBy: { date: 'asc' },
  });
}
