import type { ReactNode } from 'react';

interface SectionCardProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** SaaS-style section with subtle border and padding */
export function SectionCard({ eyebrow, title, description, children, className = '' }: SectionCardProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40 ${className}`}
    >
      <div className="border-b border-slate-100 px-5 py-4">
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{eyebrow}</p>
        ) : null}
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}
