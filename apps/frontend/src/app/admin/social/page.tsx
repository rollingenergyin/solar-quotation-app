'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type SocialSegment = 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL' | 'GROUND_MOUNT';
type SocialContentType = 'STATIC_POST' | 'CAROUSEL' | 'REEL';
type SocialPostStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SCHEDULED' | 'POSTED' | 'FAILED';

type DesignSpec = {
  canvas?: string; layout?: { top?: string; middle?: string; bottom?: string };
  background?: string; textPlacement?: string; ctaButton?: Record<string, string>;
  fonts?: Record<string, string>; logoPlacement?: string; footer?: string;
  colorScheme?: string; slideCount?: number; slideDesign?: unknown[];
  dataPoints?: string[];
};
type AudioPlan = {
  style?: string; bpm?: number; mood?: string;
  optionA?: string | Record<string, string>; optionB?: string | Record<string, string>;
  source?: string;
};
type ReelScene = { startSec: number; endSec: number; visual: string; textEn: string; textHi: string; textMr: string; transition: string };
type ReelScript = { title?: string; totalDuration?: string; scenes: ReelScene[]; exportNote?: string };
type ImagePrompt = { tool?: string; prompt: string; negativePrompt?: string; style?: string; aspectRatio?: string };
type VideoPrompt = { tool?: string; prompt: string; negativePrompt?: string; style?: string; resolution?: string; fps?: number; duration?: string };
type CarouselSlide = { slideNumber?: number; title: string; body: string; visual: string; bgColor?: string; textColor?: string; accentColor?: string };
type GeneratedAssets = {
  jpgUrl?: string;
  mp4Url?: string;
  slideUrls?: string[];
};

type ProductionSpec = {
  type?: string;
  designSpec?: DesignSpec & { slides?: CarouselSlide[] };
  imagePrompt?: ImagePrompt;
  videoPrompt?: VideoPrompt;
  reelScript?: ReelScript;
  audioPlan?: AudioPlan;
  generatedAssets?: GeneratedAssets;
};

type VersionRecord = {
  id: string; postId: string; version: number; label: string;
  editedBy: string | null; changeNote: string | null; createdAt: string;
};

type SocialPost = {
  id: string; title: string; segment: SocialSegment; contentType: SocialContentType;
  status: SocialPostStatus; captionEn: string; captionHi: string; captionMr: string;
  hashtags: string[]; visualConcept: string; platforms: string[];
  scheduledAt: string | null; postedAt: string | null; isNewsSlot: boolean;
  rejectionNote: string | null; productionSpec: ProductionSpec | null;
  currentVersion: number; createdAt: string;
  analytics?: { likes: number; comments: number; shares: number; reach: number; clicks: number } | null;
  slot?: { date: string; slotType: string; theme: string } | null;
  versions?: VersionRecord[];
};

type CalendarSlot = {
  id: string; date: string; slotType: string; theme: string; segment: string | null;
  isNewsSlot: boolean; post: Partial<SocialPost> | null;
};

type GeneratedContent = {
  title: string; captionEn: string; captionHi: string; captionMr: string;
  hashtags: string[]; visualConcept: string; contentStrategy: string; platforms: string[];
};

type Credential = { id: string; platform: string; displayName: string; isActive: boolean; pageId: string | null; expiresAt: string | null };

type AnalyticsData = {
  overview: { totalPosts: number; approvalQueue: number; totalLikes: number; totalReach: number; totalEngagement: number };
  byStatus: { status: string; count: number }[];
  bySegment: { segment: string; count: number }[];
  byContentType: { type: string; count: number }[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'calendar',   label: 'Calendar',          icon: '📅' },
  { id: 'generator',  label: 'Generator',          icon: '✨' },
  { id: 'studio',     label: 'Production Studio',  icon: '🎬' },
  { id: 'analytics',  label: 'Analytics',          icon: '📊' },
  { id: 'settings',   label: 'Platforms',          icon: '🔗' },
] as const;
type TabId = typeof TABS[number]['id'];

const SEGMENTS: Array<{ value: SocialSegment; label: string; icon: string }> = [
  { value: 'RESIDENTIAL', label: 'Residential', icon: '🏠' },
  { value: 'SOCIETY',     label: 'Society',     icon: '🏘️' },
  { value: 'COMMERCIAL',  label: 'Commercial',  icon: '🏢' },
  { value: 'INDUSTRIAL',  label: 'Industrial',  icon: '🏭' },
  { value: 'GROUND_MOUNT',label: 'Ground Mount',icon: '🌾' },
];

const CONTENT_TYPES: Array<{ value: SocialContentType; label: string; icon: string; desc: string }> = [
  { value: 'STATIC_POST', label: 'Static Post',  icon: '🖼️', desc: 'Single image with caption' },
  { value: 'CAROUSEL',    label: 'Carousel',     icon: '🎠', desc: 'Multi-slide educational' },
  { value: 'REEL',        label: 'Reel',         icon: '🎬', desc: 'Motion graphics (no faces)' },
];

const STATUS_CONFIG: Record<SocialPostStatus, { label: string; color: string; dot: string }> = {
  DRAFT:            { label: 'Draft',           color: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400' },
  PENDING_APPROVAL: { label: 'Pending',         color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  APPROVED:         { label: 'Approved',        color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  REJECTED:         { label: 'Rejected',        color: 'bg-red-100 text-red-700',     dot: 'bg-red-500' },
  SCHEDULED:        { label: 'Scheduled',       color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  POSTED:           { label: 'Posted',          color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  FAILED:           { label: 'Failed',          color: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
};

const SLOT_TYPE_COLOR: Record<string, string> = {
  PLANNED:    'bg-blue-50 border-blue-200 text-blue-800',
  NEWS_SLOT:  'bg-orange-50 border-orange-200 text-orange-800',
  FESTIVAL:   'bg-purple-50 border-purple-200 text-purple-800',
  SEASONAL:   'bg-green-50 border-green-200 text-green-800',
  SOLAR_EVENT:'bg-yellow-50 border-yellow-200 text-yellow-800',
};

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', facebook: '👤', linkedin: '💼',
};

const CHART_COLORS = ['#739bd6','#161c34','#10b981','#f59e0b','#ef4444','#8b5cf6'];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Utility ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: CALENDAR
// ════════════════════════════════════════════════════════════════════════════

function CalendarTab() {
  const qc = useQueryClient();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selected, setSelected] = useState<CalendarSlot | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['social', 'calendar', year, month],
    queryFn: () => api<{ slots: CalendarSlot[]; year: number; month: number }>(`/social/calendar?year=${year}&month=${month}`),
  });

  const seedMutation = useMutation({
    mutationFn: () => api<{ seeded: number; message: string }>('/social/calendar/seed', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social', 'calendar'] }),
  });

  const slots = data?.slots ?? [];

  // Build a map of date → slot for the grid
  const slotMap = new Map<number, CalendarSlot[]>();
  for (const slot of slots) {
    const day = new Date(slot.date).getDate();
    if (!slotMap.has(day)) slotMap.set(day, []);
    slotMap.get(day)!.push(slot);
  }

  // Build the calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div>
      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
          <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">‹</button>
          <span className="text-sm font-medium text-gray-800 px-3 min-w-[110px] text-center">{MONTHS[month - 1]} {year}</span>
          <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">›</button>
        </div>

        <div className="flex-1" />

        {/* Legend */}
        <div className="flex flex-wrap gap-2 text-xs">
          {[['PLANNED','blue'],['NEWS_SLOT','orange'],['FESTIVAL','purple'],['SEASONAL','green'],['SOLAR_EVENT','yellow']].map(([type, color]) => (
            <span key={type} className={`px-2 py-1 rounded-full border text-xs font-medium ${SLOT_TYPE_COLOR[type]}`}>{type.replace('_',' ')}</span>
          ))}
        </div>

        <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
          className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40">
          {seedMutation.isPending ? 'Seeding…' : '🌱 Seed 2026 Calendar'}
        </button>
      </div>

      {seedMutation.data && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          ✅ {seedMutation.data.message}
        </div>
      )}

      {isLoading ? (
        <div className="h-96 flex items-center justify-center text-gray-400">Loading calendar…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Month grid */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />;
                const daySlots = slotMap.get(day) ?? [];
                const hasPost = daySlots.some((s) => s.post);
                const isToday = new Date().getDate() === day && new Date().getMonth() + 1 === month && new Date().getFullYear() === year;

                return (
                  <div key={day}
                    onClick={() => daySlots.length > 0 && setSelected(daySlots[0])}
                    className={`min-h-[60px] rounded-xl p-1.5 border text-xs cursor-pointer transition-all
                      ${isToday ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-300'}
                      ${daySlots.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}>
                    <div className={`font-semibold mb-1 w-5 h-5 flex items-center justify-center rounded-full text-[11px]
                      ${isToday ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {daySlots.slice(0, 2).map((slot, si) => (
                        <div key={si} className={`text-[9px] px-1 py-0.5 rounded truncate border font-medium ${SLOT_TYPE_COLOR[slot.slotType] ?? 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                          {slot.isNewsSlot ? '📰' : slot.slotType === 'FESTIVAL' ? '🎉' : slot.slotType === 'SOLAR_EVENT' ? '☀️' : '📝'} {slot.post ? '✓' : ''}
                        </div>
                      ))}
                      {daySlots.length > 2 && <div className="text-[9px] text-gray-400">+{daySlots.length - 2}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Slot detail / month summary */}
          <div className="space-y-4">
            {/* Month summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Month Summary</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Total Slots', value: slots.length, icon: '📅' },
                  { label: 'With Content', value: slots.filter(s => s.post).length, icon: '✅' },
                  { label: 'News Slots', value: slots.filter(s => s.isNewsSlot).length, icon: '📰' },
                  { label: 'Festivals', value: slots.filter(s => s.slotType === 'FESTIVAL').length, icon: '🎉' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="text-lg">{stat.icon}</div>
                    <div className="text-xl font-bold text-gray-900">{stat.value}</div>
                    <div className="text-[10px] text-gray-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected slot detail */}
            {selected ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Slot Detail</h3>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                </div>
                <div className={`text-xs px-2 py-1 rounded-full inline-block border mb-2 font-medium ${SLOT_TYPE_COLOR[selected.slotType] ?? ''}`}>
                  {selected.slotType.replace('_',' ')}
                </div>
                <div className="text-sm font-medium text-gray-800 mb-1">{fmtDate(selected.date)}</div>
                <div className="text-xs text-gray-500 mb-3">{selected.theme}</div>
                {selected.post ? (
                  <div className="bg-green-50 rounded-xl p-3">
                    <div className="text-xs font-semibold text-green-800">✅ Content Assigned</div>
                    <div className="text-xs text-green-700 mt-0.5">{String(selected.post.title)}</div>
                    <div className={`text-xs mt-1 px-2 py-0.5 rounded-full inline-block ${STATUS_CONFIG[selected.post.status as SocialPostStatus]?.color ?? 'bg-gray-100'}`}>
                      {selected.post.status}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
                    No content assigned yet.
                    {selected.isNewsSlot && <div className="text-orange-600 mt-1">📰 News slot — fill 5 days before {fmtDate(selected.date)}</div>}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center text-xs text-gray-400">
                Click a day to see slot details
              </div>
            )}

            {/* Upcoming slots */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming Content</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {slots.filter(s => new Date(s.date) >= new Date() && s.post).slice(0, 6).map((slot) => (
                  <div key={slot.id} className="flex items-center gap-2 text-xs">
                    <div className="text-[10px] text-gray-400 w-14 flex-shrink-0">{new Date(slot.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                    <div className="flex-1 truncate text-gray-700">{String(slot.post?.title ?? '')}</div>
                    <div className={`px-1.5 py-0.5 rounded-full text-[10px] ${STATUS_CONFIG[slot.post?.status as SocialPostStatus]?.color ?? 'bg-gray-100'}`}>
                      {slot.post?.status}
                    </div>
                  </div>
                ))}
                {slots.filter(s => new Date(s.date) >= new Date() && s.post).length === 0 && (
                  <div className="text-xs text-gray-400">No upcoming scheduled posts</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: GENERATOR
// ════════════════════════════════════════════════════════════════════════════

function GeneratorTab() {
  const qc = useQueryClient();
  const [segment, setSegment] = useState<SocialSegment>('RESIDENTIAL');
  const [contentType, setContentType] = useState<SocialContentType>('STATIC_POST');
  const [theme, setTheme] = useState('');
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [previewLang, setPreviewLang] = useState<'en' | 'hi' | 'mr'>('en');
  const [scheduledAt, setScheduledAt] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['instagram', 'facebook']);
  const [saved, setSaved] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () => api<GeneratedContent>('/social/generate', {
      method: 'POST',
      body: JSON.stringify({ segment, contentType, theme: theme || undefined }),
    }),
    onSuccess: (data) => { setGenerated(data); setSaved(false); },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!generated) throw new Error('Nothing generated');
      return api('/social/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: generated.title, segment, contentType,
          captionEn: generated.captionEn, captionHi: generated.captionHi, captionMr: generated.captionMr,
          hashtags: generated.hashtags, visualConcept: generated.visualConcept,
          platforms, scheduledAt: scheduledAt || undefined,
        }),
      });
    },
    onSuccess: () => { setSaved(true); qc.invalidateQueries({ queryKey: ['social', 'posts'] }); },
  });

  const caption = generated
    ? (previewLang === 'en' ? generated.captionEn : previewLang === 'hi' ? generated.captionHi : generated.captionMr)
    : '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Left: inputs */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">1. Choose Target Segment</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SEGMENTS.map((s) => (
              <button key={s.value} onClick={() => setSegment(s.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all ${
                  segment === s.value ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}>
                <span className="text-xl">{s.icon}</span>{s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">2. Content Type</h2>
          <div className="space-y-2">
            {CONTENT_TYPES.map((ct) => (
              <button key={ct.value} onClick={() => setContentType(ct.value)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  contentType === ct.value ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'
                }`}>
                <span className="text-2xl">{ct.icon}</span>
                <div>
                  <div className="text-sm font-medium">{ct.label}</div>
                  <div className={`text-xs ${contentType === ct.value ? 'text-gray-300' : 'text-gray-400'}`}>{ct.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">3. Theme (Optional)</h2>
          <input value={theme} onChange={(e) => setTheme(e.target.value)}
            placeholder="e.g. Diwali offer, PM Surya Ghar, Summer bills…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400" />
          <p className="text-xs text-gray-400 mt-1.5">Leave blank for AI to choose best theme for this segment</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">4. Schedule & Platforms</h2>
          <label className="text-xs font-medium text-gray-500 block mb-1">Schedule Date/Time</label>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 outline-none" />
          <label className="text-xs font-medium text-gray-500 block mb-2">Platforms</label>
          <div className="flex gap-2">
            {['instagram','facebook','linkedin'].map((p) => (
              <button key={p} onClick={() => setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  platforms.includes(p) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600'
                }`}>
                {PLATFORM_ICONS[p]} {p}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#739bd6] to-[#161c34] text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all">
          {generateMutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating with AI…
            </span>
          ) : '✨ Generate Content with AI'}
        </button>
      </div>

      {/* Right: preview */}
      <div className="space-y-4">
        {generated ? (
          <>
            {/* Mock phone preview */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-800">Preview</h2>
                <div className="flex gap-1">
                  {(['en','hi','mr'] as const).map((l) => (
                    <button key={l} onClick={() => setPreviewLang(l)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${previewLang === l ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500'}`}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Instagram-style mock (caption in-frame follows language toggle) */}
              <div className="max-w-xs mx-auto">
                <div className={`bg-gray-900 rounded-t-2xl p-4 aspect-square flex flex-col ${previewLang !== 'en' ? "font-['Noto_Sans_Devanagari','Mangal','Mukta',sans-serif]" : ''}`}>
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-white min-h-0">
                    <div className="text-4xl mb-2 shrink-0">☀️</div>
                    <div className="text-sm font-bold leading-tight px-2 line-clamp-2">{generated.title}</div>
                    <div className="text-xs text-gray-300 mt-1.5 shrink-0">{contentType === 'CAROUSEL' ? '📊 Carousel • 5-7 slides' : contentType === 'REEL' ? '🎬 Reel • Motion graphics' : '🖼️ Static Post'}</div>
                    <div className="mt-2 text-[10px] text-[#739bd6] font-medium shrink-0">Rolling Energy Solar</div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10 text-left max-h-[42%] overflow-y-auto shrink-0">
                    <p className="text-[11px] text-white/90 whitespace-pre-line leading-relaxed">{caption}</p>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-b-2xl p-3">
                  <div className="flex gap-3 text-xs text-gray-500 mb-2">
                    <span>❤️</span><span>💬</span><span>📤</span>
                  </div>
                  <p className="text-xs text-gray-800 whitespace-pre-line leading-relaxed line-clamp-6">{caption}</p>
                  <p className="text-xs text-[#739bd6] mt-1.5 line-clamp-2">
                    {generated.hashtags.slice(0, 8).map(h => `#${h}`).join(' ')}
                  </p>
                </div>
              </div>
            </div>

            {/* Visual concept */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Visual Concept</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{generated.visualConcept}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  generated.contentStrategy === 'EDUCATION' ? 'bg-blue-100 text-blue-700' :
                  generated.contentStrategy === 'AUTHORITY' ? 'bg-purple-100 text-purple-700' :
                  generated.contentStrategy === 'TRUST' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}>{generated.contentStrategy}</span>
                <span className="text-xs text-gray-400">strategy</span>
              </div>
            </div>

            {/* Hashtags */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Hashtags ({generated.hashtags.length})</h3>
              <div className="flex flex-wrap gap-1.5">
                {generated.hashtags.map((h, i) => (
                  <span key={i} className="text-xs bg-[#739bd6]/10 text-[#161c34] px-2 py-0.5 rounded-full font-medium">#{h}</span>
                ))}
              </div>
            </div>

            {/* All language captions */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">All Captions</h3>
              {[
                { label: 'English', key: 'captionEn' as const, flag: '🇬🇧' },
                { label: 'Hindi', key: 'captionHi' as const, flag: '🇮🇳' },
                { label: 'Marathi', key: 'captionMr' as const, flag: '🏛️' },
              ].map(({ label, key, flag }) => (
                <div key={key} className="mb-3 last:mb-0">
                  <div className="text-xs font-medium text-gray-500 mb-1">{flag} {label}</div>
                  <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-2.5 rounded-lg whitespace-pre-line">{generated[key]}</p>
                </div>
              ))}
            </div>

            {/* Save to queue */}
            {!saved ? (
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50">
                {saveMutation.isPending ? 'Sending to Queue…' : '✅ Send to Approval Queue'}
              </button>
            ) : (
              <div className="w-full py-3 rounded-xl bg-green-50 border border-green-200 text-green-800 font-semibold text-sm text-center">
                ✅ Added to Approval Queue!
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 flex flex-col items-center justify-center text-center h-96">
            <div className="text-5xl mb-4">✨</div>
            <div className="text-sm font-medium text-gray-600 mb-1">AI Content Generator</div>
            <div className="text-xs text-gray-400">Configure your options and click Generate to create multilingual solar content</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: APPROVAL QUEUE
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// PRODUCTION STUDIO — Inline Editing + Version Control + Approval Panel
// ════════════════════════════════════════════════════════════════════════════

type StudioPanel = 'content' | 'production' | 'versions' | 'approval';

function ProductionStudioTab() {
  const qc = useQueryClient();

  // ─── Export all assets as downloadable text file
  async function exportAssets() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : '';
    const res = await fetch('/api/social/posts?limit=50', { headers: { Authorization: `Bearer ${token}` } });
    const { posts: allPosts } = await res.json() as { posts: SocialPost[] };
    allPosts.sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());
    const lines: string[] = ['# SOLAR GROWTH OS — FINAL ASSET PACK', `# ${allPosts.length} Posts | Apr 15–May 15, 2026\n`];
    for (let i = 0; i < allPosts.length; i++) {
      const p = allPosts[i];
      const spec = (p.productionSpec ?? {}) as ProductionSpec;
      const date = p.scheduledAt ? new Date(p.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : 'TBD';
      lines.push(`${'═'.repeat(60)}\nPOST ${String(i + 1).padStart(2, '0')} | ${p.contentType.replace('_', ' ')}${p.isNewsSlot ? ' 📰 NEWS SLOT' : ''} | ${date}`);
      lines.push(`TITLE: ${p.title}\nPLATFORMS: ${(p.platforms ?? []).join(', ')}\n`);
      lines.push(`── CAPTION [EN]\n${p.captionEn}\n`);
      lines.push(`── CAPTION [HI]\n${p.captionHi}\n`);
      lines.push(`── CAPTION [MR]\n${p.captionMr}\n`);
      lines.push(`── HASHTAGS\n${(p.hashtags ?? []).map(h => `#${h}`).join(' ')}\n`);
      if (spec.imagePrompt?.prompt) lines.push(`── AI IMAGE PROMPT (${spec.imagePrompt.tool ?? 'Midjourney/DALL-E'})\n${spec.imagePrompt.prompt}\nNEGATIVE: ${spec.imagePrompt.negativePrompt ?? ''}\n`);
      if (spec.videoPrompt?.prompt) lines.push(`── VIDEO PROMPT (${spec.videoPrompt.tool ?? 'Runway/Kling'})\n${spec.videoPrompt.prompt}\nRES: ${spec.videoPrompt.resolution} | FPS: ${spec.videoPrompt.fps} | DUR: ${spec.videoPrompt.duration}\n`);
      if (spec.reelScript?.scenes) {
        lines.push(`── REEL SCRIPT (${spec.reelScript.totalDuration})`);
        for (const sc of spec.reelScript.scenes) {
          lines.push(`  [${sc.startSec}s–${sc.endSec}s] ${sc.visual}\n  EN: "${sc.textEn}"\n  HI: "${sc.textHi}"\n  MR: "${sc.textMr}"\n  TRANSITION: ${sc.transition}`);
        }
        lines.push('');
      }
      if (spec.audioPlan) {
        const optA = spec.audioPlan.optionA;
        const optB = spec.audioPlan.optionB;
        lines.push(`── AUDIO | ${spec.audioPlan.style ?? ''} | ${spec.audioPlan.bpm ?? ''}BPM | ${spec.audioPlan.mood ?? ''}`);
        if (optA) lines.push(`OPT A: ${typeof optA === 'string' ? optA : (optA as Record<string, string>).description}`);
        if (optB) lines.push(`OPT B: ${typeof optB === 'string' ? optB : (optB as Record<string, string>).description}`);
        if (spec.audioPlan.source) lines.push(`SOURCE: ${spec.audioPlan.source}`);
        lines.push('');
      }
    }
    lines.push(`\n${'═'.repeat(60)}\nGenerated: ${new Date().toISOString()}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'solar-content-assets.txt';
    a.click(); URL.revokeObjectURL(url);
  }

  // ─── List state
  const [filter, setFilter] = useState<SocialPostStatus | 'ALL'>('PENDING_APPROVAL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SocialPost | null>(null);

  // ─── Edit state (local copy of selected post)
  const [draft, setDraft] = useState<Partial<SocialPost> & { hashtagStr?: string }>({});
  const [isDirty, setIsDirty] = useState(false);
  const [panel, setPanel] = useState<StudioPanel>('content');
  const [previewLang, setPreviewLang] = useState<'en' | 'hi' | 'mr'>('en');
  const [rejectNote, setRejectNote] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  // ─── Queries
  const { data: listData, isLoading } = useQuery({
    queryKey: ['social', 'posts', filter],
    queryFn: () => api<{ posts: SocialPost[]; total: number }>(`/social/posts?limit=50${filter !== 'ALL' ? `&status=${filter}` : ''}`),
    refetchInterval: 20_000,
  });

  const { data: fullPost, refetch: refetchPost } = useQuery({
    queryKey: ['social', 'post', selected?.id],
    queryFn: () => selected ? api<SocialPost>(`/social/posts/${selected.id}`) : null,
    enabled: !!selected,
  });

  const { data: versionsData, refetch: refetchVersions } = useQuery({
    queryKey: ['social', 'versions', selected?.id],
    queryFn: () => selected ? api<{ versions: VersionRecord[] }>(`/social/posts/${selected.id}/versions`) : null,
    enabled: !!selected && panel === 'versions',
  });

  // ─── Mutations
  const saveMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<SocialPost> & { changeNote?: string }) =>
      api(`/social/posts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['social', 'posts'] });
      setSelected(updated as SocialPost);
      setIsDirty(false);
      setSaveMsg('✓ Saved');
      setTimeout(() => setSaveMsg(''), 2500);
    },
  });

  const specMutation = useMutation({
    mutationFn: ({ id, productionSpec }: { id: string; productionSpec: unknown }) =>
      api(`/social/posts/${id}/production`, { method: 'PATCH', body: JSON.stringify({ productionSpec, changeNote: 'Manual production spec update' }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social', 'posts'] });
      setSaveMsg('✓ Production spec saved');
      setTimeout(() => setSaveMsg(''), 2500);
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api(`/social/posts/${id}/rollback/${version}`, { method: 'POST' }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['social', 'posts'] });
      const post = (data as { post: SocialPost }).post;
      setSelected(post);
      initDraft(post);
      void refetchVersions();
      setSaveMsg('✓ Rolled back successfully');
      setTimeout(() => setSaveMsg(''), 2500);
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api(`/social/publish/${id}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social', 'posts'] }),
  });

  // ─── Helpers
  function initDraft(post: SocialPost) {
    setDraft({
      title: post.title,
      captionEn: post.captionEn,
      captionHi: post.captionHi,
      captionMr: post.captionMr,
      hashtagStr: (post.hashtags ?? []).join(', '),
      visualConcept: post.visualConcept,
    });
    setIsDirty(false);
    setRejectNote('');
  }

  function selectPost(post: SocialPost) {
    setSelected(post);
    initDraft(post);
    setPanel('content');
    setSlideIdx(0);
  }

  function updateDraft(key: string, value: string) {
    setDraft(d => ({ ...d, [key]: value }));
    setIsDirty(true);
  }

  function handleSave() {
    if (!selected || !isDirty) return;
    const hashtags = draft.hashtagStr?.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean) ?? selected.hashtags;
    saveMutation.mutate({
      id: selected.id,
      title: draft.title ?? selected.title,
      captionEn: draft.captionEn ?? selected.captionEn,
      captionHi: draft.captionHi ?? selected.captionHi,
      captionMr: draft.captionMr ?? selected.captionMr,
      hashtags,
      visualConcept: draft.visualConcept ?? selected.visualConcept,
      changeNote: 'User edit',
      editedBy: 'admin',
    } as Parameters<typeof saveMutation.mutate>[0]);
  }

  function handleApprove() {
    if (!selected) return;
    saveMutation.mutate({ id: selected.id, status: 'APPROVED', changeNote: 'Approved by reviewer', editedBy: 'admin' } as Parameters<typeof saveMutation.mutate>[0]);
  }

  function handleReject() {
    if (!selected) return;
    saveMutation.mutate({ id: selected.id, status: 'REJECTED', rejectionNote: rejectNote || 'Content rejected', changeNote: 'Rejected by reviewer', editedBy: 'admin' } as Parameters<typeof saveMutation.mutate>[0]);
  }

  function handleSendToEdit() {
    if (!selected) return;
    saveMutation.mutate({ id: selected.id, status: 'PENDING_APPROVAL', changeNote: 'Sent back to edit', editedBy: 'admin' } as Parameters<typeof saveMutation.mutate>[0]);
  }

  const posts = (listData?.posts ?? []).filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase())
  );

  const currentCaption = selected
    ? (previewLang === 'en' ? (draft.captionEn ?? selected.captionEn)
      : previewLang === 'hi' ? (draft.captionHi ?? selected.captionHi)
      : (draft.captionMr ?? selected.captionMr))
    : '';

  const spec = (fullPost ?? selected)?.productionSpec ?? selected?.productionSpec;
  const versions = versionsData?.versions ?? [];
  const assets = spec?.generatedAssets;

  // Carousel slide navigation
  const [slideIdx, setSlideIdx] = useState(0);
  const slideUrls = assets?.slideUrls ?? [];
  const previewImgUrl = assets?.slideUrls
    ? (assets.slideUrls[slideIdx] ?? assets.jpgUrl)
    : assets?.jpgUrl;

  const devanagariClass = previewLang !== 'en' ? "font-['Noto_Sans_Devanagari','Mangal','Mukta',sans-serif]" : '';

  const mediaDimClass = previewLang !== 'en' ? 'opacity-[0.42]' : '';

  /** In-frame caption (JPG/MP4 text is English-only; this layer follows the language toggle) */
  function GraphicCaptionStrip() {
    if (!selected) return null;
    return (
      <div className={`border-t border-white/10 bg-black/80 px-4 py-3 max-h-[180px] overflow-y-auto shrink-0 ${devanagariClass}`}>
        <div className="text-[9px] font-bold uppercase tracking-wider text-[#739bd6] mb-1.5">
          Caption · {previewLang === 'en' ? 'English' : previewLang === 'hi' ? 'हिंदी' : 'मराठी'}
        </div>
        <p className="text-white text-[11px] leading-relaxed whitespace-pre-line">
          {currentCaption || <span className="text-white/40 italic">No caption</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 min-h-[80vh]">

      {/* ═══ PANEL 1: POST LIST (left, fixed width) ═══════════════════════════ */}
      <div className="w-72 flex-shrink-0">
        {/* Header + Export */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">Posts</div>
          <button onClick={exportAssets}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-[#739bd6] text-white font-semibold hover:opacity-90 transition-all">
            ⬇ Export Assets
          </button>
        </div>

        {/* Search + filter */}
        <div className="mb-3 space-y-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search posts…"
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#739bd6]" />
          <div className="flex flex-wrap gap-1">
            {(['PENDING_APPROVAL','ALL','APPROVED','REJECTED','SCHEDULED','POSTED'] as const).map((s) => (
              <button key={s} onClick={() => setFilter(s)}
                className={`text-[10px] px-2 py-1 rounded-md border font-medium transition-all ${filter === s ? 'bg-[#161c34] text-white border-[#161c34]' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                {s === 'ALL' ? 'All' : s === 'PENDING_APPROVAL' ? `⏳ Pending${listData?.total && filter === 'PENDING_APPROVAL' ? ` (${listData.total})` : ''}` : STATUS_CONFIG[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>

        {/* Post list */}
        <div className="space-y-1.5 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400 text-xs">Loading…</div>
          ) : posts.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 text-center text-gray-400 text-xs">No posts</div>
          ) : posts.map((post) => {
            const sc = STATUS_CONFIG[post.status];
            const typeIcon = post.contentType === 'REEL' ? '🎬' : post.contentType === 'CAROUSEL' ? '🎠' : '🖼️';
            const isActive = selected?.id === post.id;
            const thumbUrl = (post.productionSpec as ProductionSpec | null)?.generatedAssets?.jpgUrl
              ?? (post.productionSpec as ProductionSpec | null)?.generatedAssets?.slideUrls?.[0];
            return (
              <button key={post.id} onClick={() => selectPost(post)}
                className={`w-full text-left rounded-xl border transition-all overflow-hidden ${isActive ? 'bg-[#161c34] text-white border-[#161c34] shadow-md' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                {/* Thumbnail strip */}
                {thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbUrl} alt="" className="w-full h-24 object-cover object-top" />
                )}
                <div className="p-3">
                  <div className="flex items-start gap-1.5 mb-1">
                    <span className="text-sm">{typeIcon}</span>
                    <div className={`text-xs font-medium line-clamp-2 flex-1 ${isActive ? 'text-white' : 'text-gray-900'}`}>{post.title}</div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isActive ? 'bg-white/20 text-white' : sc.color}`}>{sc.label}</span>
                    {post.scheduledAt && <span className={`text-[10px] ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>{fmtDate(post.scheduledAt)}</span>}
                  </div>
                  {post.isNewsSlot && <div className={`text-[10px] mt-1 ${isActive ? 'text-orange-300' : 'text-orange-500'}`}>📰 News Slot</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ PANEL 2 + 3: PREVIEW + EDITOR (right, flexible) ═════════════════ */}
      {selected ? (
        <div className="flex-1 flex gap-4 min-w-0">

          {/* ── Panel 2: Live Preview ──────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Post mock card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3">
              {/* Platform header mock */}
              <div className="bg-[#161c34] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#739bd6] flex items-center justify-center text-xs font-bold text-white">RE</div>
                  <div>
                    <div className="text-white text-xs font-semibold">Rolling Energy</div>
                    <div className="text-gray-400 text-[10px]">{selected.scheduledAt ? fmtDate(selected.scheduledAt) : 'Scheduled'}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {selected.platforms.map(p => <span key={p} className="text-sm">{PLATFORM_ICONS[p]}</span>)}
                </div>
              </div>

              {/* Content visual — real JPG / MP4 + in-frame caption (follows language toggle) */}
              <div className="bg-gradient-to-br from-[#161c34] to-[#0d1220] relative overflow-hidden flex flex-col">
                <div className="relative min-h-0 shrink-0">
                {/* ── REEL: video player ── */}
                {selected.contentType === 'REEL' && assets?.mp4Url ? (
                  <div className="relative">
                    <video
                      key={assets.mp4Url}
                      src={assets.mp4Url}
                      controls
                      className={`w-full max-h-[360px] object-contain bg-black transition-opacity duration-200 ${mediaDimClass}`}
                      poster={assets.jpgUrl}
                    />
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                      🎬 {spec?.reelScript?.totalDuration ?? '30s'} · {spec?.reelScript?.scenes?.length ?? 0} scenes
                    </div>
                    <a href={assets.mp4Url} download
                      className="absolute top-2 right-2 bg-[#739bd6] text-white text-[10px] px-2.5 py-1 rounded-full font-semibold hover:opacity-90">
                      ⬇ MP4
                    </a>
                  </div>
                ) : selected.contentType === 'REEL' ? (
                  <div className="p-8 flex flex-col items-center justify-center min-h-[180px]">
                    <div className="text-4xl mb-2">🎬</div>
                    <div className="text-white text-sm font-semibold mb-1">Reel</div>
                    <div className="text-gray-400 text-xs">{spec?.reelScript?.totalDuration ?? '30–45s'}</div>
                  </div>

                /* ── CAROUSEL: slide viewer ── */
                ) : selected.contentType === 'CAROUSEL' && previewImgUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={previewImgUrl}
                      src={previewImgUrl}
                      alt={`Slide ${slideIdx + 1}`}
                      className={`w-full object-contain max-h-[360px] bg-black transition-opacity duration-200 ${mediaDimClass}`}
                    />
                    {/* Slide navigation */}
                    {slideUrls.length > 1 && (
                      <>
                        <button
                          onClick={() => setSlideIdx(i => Math.max(0, i - 1))}
                          disabled={slideIdx === 0}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white w-7 h-7 rounded-full text-sm flex items-center justify-center disabled:opacity-30 hover:bg-black/80">
                          ‹
                        </button>
                        <button
                          onClick={() => setSlideIdx(i => Math.min(slideUrls.length - 1, i + 1))}
                          disabled={slideIdx === slideUrls.length - 1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 text-white w-7 h-7 rounded-full text-sm flex items-center justify-center disabled:opacity-30 hover:bg-black/80">
                          ›
                        </button>
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                          {slideUrls.map((_, i) => (
                            <button key={i} onClick={() => setSlideIdx(i)}
                              className={`w-1.5 h-1.5 rounded-full transition-all ${i === slideIdx ? 'bg-[#739bd6] scale-125' : 'bg-white/40'}`} />
                          ))}
                        </div>
                      </>
                    )}
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                      🎠 Slide {slideIdx + 1}/{slideUrls.length}
                    </div>
                    <a href={previewImgUrl} download
                      className="absolute top-2 right-2 bg-[#739bd6] text-white text-[10px] px-2.5 py-1 rounded-full font-semibold hover:opacity-90">
                      ⬇ JPG
                    </a>
                  </div>
                ) : selected.contentType === 'CAROUSEL' ? (
                  <div className="p-8 flex flex-col items-center justify-center min-h-[180px]">
                    <div className="text-4xl mb-2">🎠</div>
                    <div className="text-white text-sm font-semibold mb-1">Carousel</div>
                    <div className="text-[#739bd6] text-xs">{spec?.designSpec?.slideCount ?? '5–7'} slides</div>
                  </div>

                /* ── STATIC POST: image viewer ── */
                ) : previewImgUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={previewImgUrl}
                      src={previewImgUrl}
                      alt={selected.title}
                      className={`w-full object-contain max-h-[360px] bg-black transition-opacity duration-200 ${mediaDimClass}`}
                    />
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                      🖼️ 1080×1080px
                    </div>
                    <a href={previewImgUrl} download
                      className="absolute top-2 right-2 bg-[#739bd6] text-white text-[10px] px-2.5 py-1 rounded-full font-semibold hover:opacity-90">
                      ⬇ JPG
                    </a>
                  </div>
                ) : (
                  <div className="p-8 flex flex-col items-center justify-center min-h-[180px]">
                    <div className="text-4xl mb-2">🖼️</div>
                    <div className="text-white text-sm font-semibold mb-1">Static Post</div>
                    <div className="text-[#739bd6] text-xs">1080×1080px</div>
                  </div>
                )}
                </div>
                <GraphicCaptionStrip />
              </div>

              {/* Caption preview with language toggle */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Caption Preview</div>
                  <div className="flex gap-1">
                    {(['en','hi','mr'] as const).map(l => (
                      <button key={l} onClick={() => setPreviewLang(l)}
                        className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold transition-all ${previewLang === l ? 'bg-[#739bd6] text-white border-[#739bd6]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        {l === 'en' ? 'EN' : l === 'hi' ? 'हि' : 'मर'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-xs text-gray-700 whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                  {currentCaption || <span className="text-gray-400 italic">No caption</span>}
                </div>

                {/* Hashtags */}
                {isDirty ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(draft.hashtagStr ?? '').split(',').map(h => h.trim()).filter(Boolean).slice(0, 10).map((h, i) => (
                      <span key={i} className="text-[10px] bg-[#739bd6]/15 text-[#161c34] px-1.5 py-0.5 rounded-full">#{h.replace(/^#/, '')}</span>
                    ))}
                    {isDirty && <span className="text-[10px] text-orange-500 ml-1 font-medium">● unsaved</span>}
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selected.hashtags.slice(0, 10).map((h, i) => (
                      <span key={i} className="text-[10px] bg-[#739bd6]/15 text-[#161c34] px-1.5 py-0.5 rounded-full">#{h}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick approve/reject actions always visible */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-gray-700">Approval Decision</div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[selected.status].color}`}>
                  {STATUS_CONFIG[selected.status].label}
                </span>
              </div>

              {selected.status === 'PENDING_APPROVAL' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button onClick={handleApprove} disabled={saveMutation.isPending}
                      className="flex-1 py-2 rounded-xl bg-green-600 text-white font-semibold text-xs hover:bg-green-700 disabled:opacity-40 transition-all">
                      ✅ Approve
                    </button>
                    <button onClick={handleReject} disabled={saveMutation.isPending}
                      className="flex-1 py-2 rounded-xl bg-red-500 text-white font-semibold text-xs hover:bg-red-600 disabled:opacity-40 transition-all">
                      ✗ Reject
                    </button>
                  </div>
                  <input value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                    placeholder="Rejection reason (optional)…"
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-red-300" />
                </div>
              )}

              {selected.status === 'APPROVED' && (
                <div className="space-y-2">
                  <button onClick={() => publishMutation.mutate(selected.id)} disabled={publishMutation.isPending}
                    className="w-full py-2 rounded-xl bg-[#161c34] text-white font-semibold text-xs hover:opacity-90 disabled:opacity-40">
                    {publishMutation.isPending ? 'Publishing…' : '🚀 Publish to Platforms'}
                  </button>
                  <button onClick={handleSendToEdit}
                    className="w-full py-1.5 rounded-xl border border-gray-200 text-xs text-gray-500 hover:border-gray-400">
                    ↩ Send back to Edit
                  </button>
                </div>
              )}

              {selected.status === 'REJECTED' && (
                <div className="space-y-2">
                  {selected.rejectionNote && (
                    <div className="bg-red-50 rounded-lg p-2 text-xs text-red-600">
                      <span className="font-semibold">Reason: </span>{selected.rejectionNote}
                    </div>
                  )}
                  <button onClick={handleSendToEdit}
                    className="w-full py-2 rounded-xl bg-[#739bd6] text-white font-semibold text-xs hover:opacity-90">
                    ↩ Resubmit for Review
                  </button>
                </div>
              )}

              {['SCHEDULED','POSTED'].includes(selected.status) && (
                <div className="text-xs text-gray-500 text-center py-2">
                  {selected.status === 'POSTED' ? '✅ Published' : `📅 Scheduled: ${selected.scheduledAt ? fmtDate(selected.scheduledAt) : '—'}`}
                </div>
              )}

              {saveMsg && <div className="mt-2 text-xs text-green-600 text-center font-medium">{saveMsg}</div>}
            </div>

            {/* Asset download strip */}
            {assets && (assets.jpgUrl || assets.mp4Url || (assets.slideUrls && assets.slideUrls.length > 0)) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mt-3">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">📦 Download Assets</div>
                <div className="flex flex-wrap gap-2">
                  {assets.mp4Url && (
                    <a href={assets.mp4Url} download
                      className="flex items-center gap-1.5 bg-[#161c34] text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg hover:opacity-90">
                      🎬 Download MP4
                    </a>
                  )}
                  {assets.jpgUrl && !assets.slideUrls && (
                    <a href={assets.jpgUrl} download
                      className="flex items-center gap-1.5 bg-[#739bd6] text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg hover:opacity-90">
                      🖼️ Download JPG
                    </a>
                  )}
                  {assets.slideUrls && assets.slideUrls.map((url, i) => (
                    <a key={i} href={url} download
                      className="flex items-center gap-1 bg-[#739bd6]/20 text-[#161c34] text-[10px] font-semibold px-2.5 py-1 rounded-lg hover:bg-[#739bd6]/30">
                      Slide {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Panel 3: Editor (tabbed) ───────────────────────────────────── */}
          <div className="w-[380px] flex-shrink-0">
            {/* Panel tab bar */}
            <div className="flex gap-0.5 bg-gray-100 p-1 rounded-xl mb-3">
              {([
                { id: 'content',    label: '✍️ Edit',       },
                { id: 'production', label: '🎨 Specs',       },
                { id: 'versions',   label: `🕐 History${selected.currentVersion > 1 ? ` v${selected.currentVersion}` : ''}` },
                { id: 'approval',   label: '📋 Info',        },
              ] as const).map((t) => (
                <button key={t.id} onClick={() => setPanel(t.id as StudioPanel)}
                  className={`flex-1 text-[10px] py-1.5 rounded-lg font-semibold transition-all ${panel === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="max-h-[calc(100vh-220px)] overflow-y-auto space-y-3">

              {/* ── CONTENT EDITOR ── */}
              {panel === 'content' && (
                <>
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <h3 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">Title</h3>
                    <input value={draft.title ?? ''} onChange={e => updateDraft('title', e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#739bd6] leading-snug" />
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Caption</h3>
                      <div className="flex gap-1">
                        {(['en','hi','mr'] as const).map(l => (
                          <button key={l} onClick={() => setPreviewLang(l)}
                            className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${previewLang === l ? 'bg-[#739bd6] text-white border-[#739bd6]' : 'border-gray-200 text-gray-500'}`}>
                            {l === 'en' ? 'EN' : l === 'hi' ? 'हि' : 'मर'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {previewLang === 'en' && (
                      <textarea value={draft.captionEn ?? ''} onChange={e => updateDraft('captionEn', e.target.value)}
                        rows={8} placeholder="English caption…"
                        className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#739bd6] resize-none leading-relaxed" />
                    )}
                    {previewLang === 'hi' && (
                      <textarea value={draft.captionHi ?? ''} onChange={e => updateDraft('captionHi', e.target.value)}
                        rows={8} placeholder="हिंदी कैप्शन…"
                        className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#739bd6] resize-none leading-relaxed" style={{fontFamily: 'Noto Sans Devanagari, sans-serif'}} />
                    )}
                    {previewLang === 'mr' && (
                      <textarea value={draft.captionMr ?? ''} onChange={e => updateDraft('captionMr', e.target.value)}
                        rows={8} placeholder="मराठी कॅप्शन…"
                        className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#739bd6] resize-none leading-relaxed" style={{fontFamily: 'Noto Sans Devanagari, sans-serif'}} />
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <h3 className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Hashtags</h3>
                    <textarea value={draft.hashtagStr ?? ''} onChange={e => updateDraft('hashtagStr', e.target.value)}
                      rows={3} placeholder="SolarEnergy, GoSolar, MaharashtraSolar… (comma-separated)"
                      className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#739bd6] resize-none" />
                    <div className="text-[10px] text-gray-400 mt-1">{(draft.hashtagStr ?? '').split(',').filter(h => h.trim()).length} hashtags</div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <h3 className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Visual Concept</h3>
                    <textarea value={draft.visualConcept ?? ''} onChange={e => updateDraft('visualConcept', e.target.value)}
                      rows={4} placeholder="Describe the visual design…"
                      className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#739bd6] resize-none leading-relaxed" />
                  </div>

                  <div className="flex gap-2">
                    <button onClick={handleSave} disabled={!isDirty || saveMutation.isPending}
                      className="flex-1 py-2.5 rounded-xl bg-[#161c34] text-white font-semibold text-xs hover:opacity-90 disabled:opacity-40 transition-all">
                      {saveMutation.isPending ? 'Saving…' : isDirty ? '💾 Save Changes (new version)' : '✓ No changes'}
                    </button>
                  </div>
                </>
              )}

              {/* ── PRODUCTION SPECS ── */}
              {panel === 'production' && spec && (
                <>
                  {/* Design Spec */}
                  {spec.designSpec && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                      <h3 className="text-xs font-bold text-[#739bd6] mb-3 uppercase tracking-wide">🎨 Design Spec</h3>
                      <div className="space-y-2 text-xs text-gray-700">
                        {spec.designSpec.canvas && (
                          <div><span className="font-semibold text-gray-500">Canvas: </span>{spec.designSpec.canvas}</div>
                        )}
                        {spec.designSpec.layout && Object.entries(spec.designSpec.layout).map(([zone, desc]) => (
                          <div key={zone} className="bg-gray-50 rounded-lg p-2">
                            <span className="font-semibold text-[#161c34] capitalize">{zone}: </span>
                            <span className="text-gray-600">{desc as string}</span>
                          </div>
                        ))}
                        {spec.designSpec.colorScheme && (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-500">Scheme: </span>
                            <span className="capitalize">{spec.designSpec.colorScheme}</span>
                          </div>
                        )}
                        {Array.isArray(spec.designSpec.dataPoints) && spec.designSpec.dataPoints.length > 0 && (
                          <div>
                            <div className="font-semibold text-gray-500 mb-1">Key Data Points:</div>
                            {spec.designSpec.dataPoints.map((dp: string, i: number) => (
                              <div key={i} className="flex items-start gap-1">
                                <span className="text-[#739bd6] mt-0.5">•</span>
                                <span>{dp}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Image Prompt */}
                  {spec.imagePrompt && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                      <h3 className="text-xs font-bold text-[#739bd6] mb-2 uppercase tracking-wide">🤖 AI Image Prompt</h3>
                      <div className="text-[10px] text-gray-400 mb-2 font-medium">{spec.imagePrompt.tool}</div>
                      <div className="bg-gray-900 text-green-400 rounded-xl p-3 text-xs font-mono leading-relaxed select-all cursor-text mb-2 whitespace-pre-wrap break-words">
                        {spec.imagePrompt.prompt}
                      </div>
                      {spec.imagePrompt.negativePrompt && (
                        <div className="bg-red-50 rounded-lg p-2 text-xs text-red-600">
                          <span className="font-semibold">Negative: </span>{spec.imagePrompt.negativePrompt}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Video Prompt (Reels) */}
                  {spec.videoPrompt && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                      <h3 className="text-xs font-bold text-[#739bd6] mb-2 uppercase tracking-wide">🎬 Video Prompt</h3>
                      <div className="text-[10px] text-gray-400 mb-2 font-medium">{spec.videoPrompt.tool}</div>
                      <div className="bg-gray-900 text-purple-400 rounded-xl p-3 text-xs font-mono leading-relaxed select-all cursor-text mb-2 whitespace-pre-wrap break-words">
                        {spec.videoPrompt.prompt}
                      </div>
                      <div className="flex gap-2 text-[10px] text-gray-500">
                        {spec.videoPrompt.resolution && <span>📐 {spec.videoPrompt.resolution}</span>}
                        {spec.videoPrompt.fps && <span>🎞 {spec.videoPrompt.fps}fps</span>}
                        {spec.videoPrompt.duration && <span>⏱ {spec.videoPrompt.duration}</span>}
                      </div>
                    </div>
                  )}

                  {/* Reel Script */}
                  {spec.reelScript?.scenes && spec.reelScript.scenes.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                      <h3 className="text-xs font-bold text-[#739bd6] mb-3 uppercase tracking-wide">🎬 Reel Script</h3>
                      <div className="text-[10px] text-gray-400 mb-3">{spec.reelScript.totalDuration} total · {spec.reelScript.scenes.length} scenes</div>
                      <div className="space-y-3">
                        {spec.reelScript.scenes.map((scene: ReelScene, i: number) => (
                          <div key={i} className="border border-gray-100 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="bg-[#739bd6] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Scene {i + 1}</span>
                              <span className="text-[10px] text-gray-400">{scene.startSec}s – {scene.endSec}s</span>
                              <span className="text-[10px] text-gray-400 ml-auto">→ {scene.transition}</span>
                            </div>
                            <div className="text-xs text-gray-600 mb-2 italic">{scene.visual}</div>
                            <div className="space-y-1">
                              <div className="text-xs"><span className="font-semibold text-gray-500">EN: </span>{scene.textEn}</div>
                              <div className="text-xs" style={{fontFamily: 'Noto Sans Devanagari, sans-serif'}}><span className="font-semibold text-gray-500">HI: </span>{scene.textHi}</div>
                              <div className="text-xs" style={{fontFamily: 'Noto Sans Devanagari, sans-serif'}}><span className="font-semibold text-gray-500">MR: </span>{scene.textMr}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {spec.reelScript.exportNote && (
                        <div className="mt-3 bg-blue-50 rounded-lg p-2 text-[10px] text-blue-600">{spec.reelScript.exportNote}</div>
                      )}
                    </div>
                  )}

                  {/* Audio Plan */}
                  {spec.audioPlan && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                      <h3 className="text-xs font-bold text-[#739bd6] mb-3 uppercase tracking-wide">🎵 Audio Plan</h3>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {spec.audioPlan.style && (
                          <div className="bg-gray-50 rounded-lg p-2 text-xs"><span className="font-semibold text-gray-500">Style: </span>{spec.audioPlan.style}</div>
                        )}
                        {spec.audioPlan.bpm && (
                          <div className="bg-gray-50 rounded-lg p-2 text-xs"><span className="font-semibold text-gray-500">BPM: </span>{spec.audioPlan.bpm}</div>
                        )}
                        {spec.audioPlan.mood && (
                          <div className="bg-gray-50 rounded-lg p-2 text-xs col-span-2"><span className="font-semibold text-gray-500">Mood: </span>{spec.audioPlan.mood}</div>
                        )}
                      </div>
                      {spec.audioPlan.optionA && (
                        <div className="mb-2">
                          <div className="text-[10px] font-semibold text-gray-500 mb-1">Option A — Text Only (no voice)</div>
                          <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2">
                            {typeof spec.audioPlan.optionA === 'string' ? spec.audioPlan.optionA : (spec.audioPlan.optionA as Record<string, string>).description}
                          </div>
                        </div>
                      )}
                      {spec.audioPlan.optionB && (
                        <div>
                          <div className="text-[10px] font-semibold text-gray-500 mb-1">Option B — Background Music</div>
                          <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2">
                            {typeof spec.audioPlan.optionB === 'string' ? spec.audioPlan.optionB : (spec.audioPlan.optionB as Record<string, string>).description}
                          </div>
                          {spec.audioPlan.source && <div className="text-[10px] text-[#739bd6] mt-1">🎵 {spec.audioPlan.source}</div>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Carousel slides */}
                  {spec.designSpec?.slideDesign && Array.isArray(spec.designSpec.slideDesign) && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                      <h3 className="text-xs font-bold text-[#739bd6] mb-3 uppercase tracking-wide">🎠 Carousel Slides</h3>
                      <div className="space-y-2">
                        {(spec.designSpec.slideDesign as CarouselSlide[]).map((slide, i) => (
                          <div key={i} className="border border-gray-100 rounded-xl p-3">
                            <div className="text-xs font-semibold text-gray-700 mb-1">Slide {slide.slideNumber ?? i + 2}: {slide.title}</div>
                            <div className="text-xs text-gray-500 mb-1">{slide.body}</div>
                            <div className="text-[10px] text-[#739bd6] italic">{slide.visual}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!spec.designSpec && !spec.imagePrompt && !spec.reelScript && !spec.audioPlan && (
                    <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-400 text-xs">No production specs available for this post</div>
                  )}
                </>
              )}

              {panel === 'production' && !spec && (
                <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-400 text-xs">
                  <div className="text-2xl mb-2">🎨</div>
                  <div>No production specs yet. The seeder will add them.</div>
                </div>
              )}

              {/* ── VERSION HISTORY ── */}
              {panel === 'versions' && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Version History</h3>
                    <div className="text-[10px] text-gray-400">Current: v{selected.currentVersion}</div>
                  </div>
                  {versions.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-xs">No versions yet</div>
                  ) : (
                    <div className="space-y-2">
                      {versions.map((v) => (
                        <div key={v.id} className={`flex items-start gap-3 p-3 rounded-xl border ${v.version === selected.currentVersion ? 'border-[#739bd6] bg-[#739bd6]/5' : 'border-gray-100'}`}>
                          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#161c34] text-white text-[10px] font-bold flex items-center justify-center">
                            v{v.version}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-800">{v.label}</div>
                            {v.changeNote && <div className="text-[10px] text-gray-500 mt-0.5">{v.changeNote}</div>}
                            <div className="text-[10px] text-gray-400 mt-0.5">{fmtDate(v.createdAt)} {v.editedBy ? `· ${v.editedBy}` : ''}</div>
                          </div>
                          {v.version !== selected.currentVersion && (
                            <button
                              onClick={() => rollbackMutation.mutate({ id: selected.id, version: v.version })}
                              disabled={rollbackMutation.isPending}
                              className="flex-shrink-0 text-[10px] px-2 py-1 rounded-lg border border-[#739bd6] text-[#739bd6] hover:bg-[#739bd6] hover:text-white transition-all disabled:opacity-40">
                              ↩ Restore
                            </button>
                          )}
                          {v.version === selected.currentVersion && (
                            <span className="flex-shrink-0 text-[10px] px-2 py-1 rounded-lg bg-[#739bd6] text-white font-medium">Current</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 p-3 bg-gray-50 rounded-xl text-[10px] text-gray-500 leading-relaxed">
                    <span className="font-semibold">How versioning works:</span> Every save, approval, rejection, or production spec update creates a new immutable version snapshot. Use "Restore" to roll back to any previous state.
                  </div>
                </div>
              )}

              {/* ── POST INFO ── */}
              {panel === 'approval' && (
                <>
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Post Information</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-[10px] text-gray-400 font-medium">Type</div>
                        <div className="font-semibold mt-0.5">{selected.contentType.replace('_',' ')}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-[10px] text-gray-400 font-medium">Segment</div>
                        <div className="font-semibold mt-0.5">{selected.segment}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-[10px] text-gray-400 font-medium">Status</div>
                        <div className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-block mt-0.5 ${STATUS_CONFIG[selected.status].color}`}>{STATUS_CONFIG[selected.status].label}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-[10px] text-gray-400 font-medium">Version</div>
                        <div className="font-semibold mt-0.5">v{selected.currentVersion}</div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-xs">
                      <div className="text-[10px] text-gray-400 font-medium mb-1">Scheduled</div>
                      <div className="font-semibold">{selected.scheduledAt ? fmtDate(selected.scheduledAt) : 'Not scheduled'}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-xs">
                      <div className="text-[10px] text-gray-400 font-medium mb-1">Platforms</div>
                      <div className="flex gap-2">
                        {selected.platforms.map(p => (
                          <span key={p} className="flex items-center gap-1">{PLATFORM_ICONS[p]} <span className="capitalize">{p}</span></span>
                        ))}
                      </div>
                    </div>
                    {selected.isNewsSlot && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-xs text-orange-700">
                        📰 This is a reserved news slot. Replace with trending content 5 days before scheduled date.
                      </div>
                    )}
                    {selected.rejectionNote && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
                        <span className="font-semibold">Rejection note: </span>{selected.rejectionNote}
                      </div>
                    )}
                  </div>

                  {/* Visual Concept (read-only here) */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <h3 className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Visual Concept</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">{selected.visualConcept || '—'}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center text-center text-gray-400">
          <div>
            <div className="text-5xl mb-3">🎬</div>
            <div className="text-sm font-medium mb-1">Production Studio</div>
            <div className="text-xs">Select a post from the left to edit, review production specs, and manage approvals</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: ANALYTICS
// ════════════════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['social', 'analytics'],
    queryFn: () => api<AnalyticsData>('/social/analytics'),
    refetchInterval: 30_000,
  });

  if (isLoading) return <div className="text-center py-20 text-gray-400">Loading analytics…</div>;

  const { overview, byStatus = [], bySegment = [], byContentType = [] } = data ?? { overview: { totalPosts: 0, approvalQueue: 0, totalLikes: 0, totalReach: 0, totalEngagement: 0 }, byStatus: [], bySegment: [], byContentType: [] };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => refetch()} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg">↻ Refresh</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Posts', value: overview.totalPosts, icon: '📝', color: 'bg-blue-500' },
          { label: 'Pending Approval', value: overview.approvalQueue, icon: '⏳', color: 'bg-yellow-500' },
          { label: 'Total Likes', value: overview.totalLikes, icon: '❤️', color: 'bg-red-500' },
          { label: 'Total Reach', value: overview.totalReach.toLocaleString('en-IN'), icon: '👁️', color: 'bg-purple-500' },
          { label: 'Engagement', value: overview.totalEngagement, icon: '💬', color: 'bg-green-500' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              <div className={`w-2 h-2 rounded-full ${card.color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{String(card.value)}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {/* By Status */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Posts by Status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70}
                label={(props) => {
                  const p = props.payload as { status?: string };
                  return `${String(p?.status ?? '').slice(0, 4)} ${props.value ?? ''}`;
                }}>
                {byStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* By Segment */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Posts by Segment</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bySegment} margin={{ top: 4, right: 8, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="segment" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v.slice(0, 4)} angle={-30} textAnchor="end" />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="count" radius={[4,4,0,0]} maxBarSize={28}>
                {bySegment.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By Content Type */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Posts by Content Type</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byContentType} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={70}
                label={(props) => {
                  const p = props.payload as { type?: string };
                  return `${String(p?.type ?? '').replace('_', ' ').slice(0, 6)} ${props.value ?? ''}`;
                }}>
                {byContentType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Content Strategy Guide */}
      <div className="bg-gradient-to-br from-[#161c34] to-[#739bd6]/50 rounded-2xl p-6 text-white">
        <h2 className="text-sm font-bold mb-4">📐 Content Strategy Mix (Target Distribution)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Education', pct: 40, desc: 'How solar works, subsidies, net metering, myths', color: 'bg-blue-400' },
            { label: 'Authority', pct: 30, desc: 'Case studies, installations, certifications', color: 'bg-purple-400' },
            { label: 'Trust', pct: 20, desc: 'Testimonials, warranties, after-sales service', color: 'bg-green-400' },
            { label: 'Conversion', pct: 10, desc: 'Offers, CTAs, subsidy deadlines, limited slots', color: 'bg-orange-400' },
          ].map((item) => (
            <div key={item.label} className="bg-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="text-xl font-bold text-yellow-300">{item.pct}%</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full mb-2">
                <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
              </div>
              <p className="text-xs text-white/70">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB: PLATFORM SETTINGS
// ════════════════════════════════════════════════════════════════════════════

function SettingsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ platform: 'instagram', displayName: '', accessToken: '', refreshToken: '', pageId: '' });
  const [showTokenForm, setShowTokenForm] = useState(false);

  const { data: creds = [], isLoading } = useQuery({
    queryKey: ['social', 'credentials'],
    queryFn: () => api<Credential[]>('/social/credentials'),
  });

  const saveMutation = useMutation({
    mutationFn: () => api('/social/credentials', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['social', 'credentials'] }); setShowTokenForm(false); setForm({ platform: 'instagram', displayName: '', accessToken: '', refreshToken: '', pageId: '' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/social/credentials/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social', 'credentials'] }),
  });

  const PLATFORM_INFO = {
    instagram: { name: 'Instagram', icon: '📸', color: 'from-pink-500 to-purple-500', help: 'Requires Instagram Business Account connected to a Facebook Page. Use Facebook Graph API Access Token.' },
    facebook:  { name: 'Facebook',  icon: '👤', color: 'from-blue-500 to-blue-700',   help: 'Requires Facebook Page Access Token with pages_manage_posts permission.' },
    linkedin:  { name: 'LinkedIn',  icon: '💼', color: 'from-blue-700 to-blue-900',   help: 'Requires LinkedIn OAuth 2.0 access token with w_member_social permission.' },
  };

  const connectedPlatforms = new Set(creds.filter(c => c.isActive).map(c => c.platform));

  return (
    <div className="max-w-3xl">
      {/* Platform status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {(['instagram','facebook','linkedin'] as const).map((platform) => {
          const info = PLATFORM_INFO[platform];
          const cred = creds.find(c => c.platform === platform);
          const connected = !!cred?.isActive;
          return (
            <div key={platform} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className={`inline-flex items-center gap-2 text-white text-sm font-semibold px-3 py-1.5 rounded-xl bg-gradient-to-r ${info.color} mb-3`}>
                <span>{info.icon}</span>{info.name}
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-medium mb-3 ${connected ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
                {connected ? 'Connected' : 'Not connected'}
              </div>
              {cred && (
                <div className="text-xs text-gray-500 mb-2">
                  <div className="font-medium">{cred.displayName}</div>
                  {cred.pageId && <div className="text-gray-400">Page: {cred.pageId}</div>}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setForm(f => ({ ...f, platform })); setShowTokenForm(true); }}
                  className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700">
                  {connected ? 'Update' : 'Connect'}
                </button>
                {cred && (
                  <button onClick={() => deleteMutation.mutate(cred.id)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50">
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Token connection form */}
      {showTokenForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">
                {PLATFORM_INFO[form.platform as keyof typeof PLATFORM_INFO]?.icon} Connect {PLATFORM_INFO[form.platform as keyof typeof PLATFORM_INFO]?.name}
              </h2>
              <button onClick={() => setShowTokenForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 mb-4">
              ℹ️ {PLATFORM_INFO[form.platform as keyof typeof PLATFORM_INFO]?.help}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Platform</label>
                <select value={form.platform} onChange={(e) => setForm(f => ({ ...f, platform: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none">
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Display Name (account name)</label>
                <input value={form.displayName} onChange={(e) => setForm(f => ({ ...f, displayName: e.target.value }))}
                  placeholder="e.g. Rolling Energy Solar Official"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Access Token *</label>
                <textarea value={form.accessToken} onChange={(e) => setForm(f => ({ ...f, accessToken: e.target.value }))}
                  rows={3} placeholder="Paste your API access token here…"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none font-mono resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Page / Account ID</label>
                  <input value={form.pageId} onChange={(e) => setForm(f => ({ ...f, pageId: e.target.value }))}
                    placeholder="Page ID (Facebook/Instagram)"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Refresh Token (optional)</label>
                  <input value={form.refreshToken} onChange={(e) => setForm(f => ({ ...f, refreshToken: e.target.value }))}
                    placeholder="For auto-renewal"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none" />
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-xs text-yellow-800 mt-4">
              🔒 Tokens are stored securely. Never share your tokens publicly. For production, enable AES-256 encryption in backend config.
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowTokenForm(false)} className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600">Cancel</button>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.accessToken || !form.displayName}
                className="flex-1 text-sm bg-gray-900 text-white rounded-lg py-2 disabled:opacity-40 hover:bg-gray-700">
                {saveMutation.isPending ? 'Saving…' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Architecture & Security info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-[#161c34] to-[#739bd6]/30 rounded-2xl p-5 text-white">
          <h3 className="text-sm font-bold mb-3">🔐 Security Architecture</h3>
          <ul className="space-y-1.5 text-xs text-white/80">
            <li>✅ Tokens stored in database (never in browser)</li>
            <li>✅ All API calls authenticated with JWT</li>
            <li>✅ Token list endpoint never returns token values</li>
            <li>⚙️ Production: Encrypt with AES-256 server key</li>
            <li>⚙️ Production: Use OAuth2 redirect flows</li>
            <li>⚙️ Production: Auto-refresh before expiry</li>
          </ul>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">📡 Posting APIs Used</h3>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex items-start gap-2">
              <span>📸</span>
              <div><span className="font-medium">Instagram:</span> Graph API v21 — Media Container → Publish flow</div>
            </div>
            <div className="flex items-start gap-2">
              <span>👤</span>
              <div><span className="font-medium">Facebook:</span> Graph API — /{"{page-id}"}/photos or /feed endpoint</div>
            </div>
            <div className="flex items-start gap-2">
              <span>💼</span>
              <div><span className="font-medium">LinkedIn:</span> UGC Posts API — POST /ugcPosts with organizationId</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function SocialDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>('calendar');

  const { data: analyticsData } = useQuery({
    queryKey: ['social', 'analytics'],
    queryFn: () => api<AnalyticsData>('/social/analytics'),
    refetchInterval: 60_000,
  });

  const pendingCount = analyticsData?.overview.approvalQueue ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 pt-5 pb-0 sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Social Media Automation</h1>
              <p className="text-xs text-gray-400 mt-0.5">AI Content · 2026 Calendar · Approval Flow · Instagram · Facebook · LinkedIn</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Brand palette reference */}
              <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-400">
                {['#739bd6','#161c34','#000000','#ffffff'].map(c => (
                  <div key={c} className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: c }} title={c} />
                ))}
                <span>Brand</span>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 overflow-x-auto pb-px">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors relative ${
                  activeTab === tab.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}>
                <span>{tab.icon}</span>
                {tab.label}
                {tab.id === 'studio' && pendingCount > 0 && (
                  <span className="ml-1 bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-[1400px] mx-auto p-5">
        {activeTab === 'calendar'  && <CalendarTab />}
        {activeTab === 'generator' && <GeneratorTab />}
        {activeTab === 'studio'    && <ProductionStudioTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'settings'  && <SettingsTab />}
      </div>
    </div>
  );
}
