'use client';

import { useState } from 'react';

type Suggestion = {
  type: string;
  message: string;
  count: number;
};

const TYPE_ICON: Record<string, string> = {
  followup: '🔁',
  new_lead: '✨',
  cold: '❄️',
};

const TYPE_COLOR: Record<string, string> = {
  followup: 'bg-orange-50 border-orange-200 text-orange-800',
  new_lead: 'bg-green-50 border-green-200 text-green-800',
  cold: 'bg-blue-50 border-blue-200 text-blue-800',
};

export default function SmartSuggestions({ suggestions }: { suggestions: Suggestion[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = suggestions.filter((s) => !dismissed.has(s.type));
  if (visible.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap mb-4">
      {visible.map((s) => (
        <div
          key={s.type}
          className={`flex items-center gap-2 border rounded-full px-3 py-1.5 text-xs font-medium ${TYPE_COLOR[s.type] ?? 'bg-gray-50 border-gray-200 text-gray-700'}`}
        >
          <span>{TYPE_ICON[s.type] ?? '💡'}</span>
          <span>{s.message}</span>
          <button
            onClick={() => setDismissed((prev) => new Set([...prev, s.type]))}
            className="ml-1 opacity-50 hover:opacity-100 transition-opacity text-current"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
