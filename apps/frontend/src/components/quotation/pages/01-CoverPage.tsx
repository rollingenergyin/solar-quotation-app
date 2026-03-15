'use client';

import RollingEnergyLogo from '../RollingEnergyLogo';

interface Props {
  clientName: string;
  systemSizeKw: number;
  date: string;
  quoteNumber: string;
}

export default function CoverPage({ clientName, systemSizeKw, date, quoteNumber }: Props) {
  return (
    <div
      className="quotation-page flex flex-col"
      style={{ background: 'linear-gradient(155deg, #0d1020 0%, #161c34 35%, #1e2f4d 65%, #2c4570 100%)' }}
    >
      {/* Top accent bar */}
      <div className="flex-shrink-0 h-1 w-full" style={{ background: 'linear-gradient(90deg, #6690cc, #85a8e0, #6690cc)' }} />

      {/* Main content */}
      <div className="flex flex-col items-center justify-center flex-1 px-16 text-center" style={{ paddingTop: '48px', paddingBottom: '56px' }}>

        {/* Logo */}
        <RollingEnergyLogo variant="dark" size="xl" className="mb-12 justify-center" />

        {/* Divider */}
        <div className="flex items-center gap-4 mb-10 w-full max-w-xs">
          <div className="flex-1 h-px" style={{ background: 'rgba(102,144,204,0.4)' }} />
          <div className="w-2 h-2 rounded-full" style={{ background: '#6690cc' }} />
          <div className="flex-1 h-px" style={{ background: 'rgba(102,144,204,0.4)' }} />
        </div>

        {/* Tagline */}
        <p className="text-sm font-medium tracking-[0.25em] uppercase mb-4" style={{ color: '#6690cc' }}>
          Detailed Solar Proposal
        </p>

        {/* Main headline */}
        <h1
          className="font-heading font-bold leading-tight mb-6"
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: '32px',
            color: '#ffffff',
            maxWidth: '480px',
          }}
        >
          {systemSizeKw} kW Rooftop Solar System
        </h1>

        {/* Client box */}
        <div
          className="rounded-2xl px-10 py-5 mb-8 w-full max-w-sm"
          style={{
            background: 'rgba(102,144,204,0.12)',
            border: '1px solid rgba(102,144,204,0.3)',
          }}
        >
          <p className="text-xs tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Prepared For
          </p>
          <p className="text-xl font-semibold" style={{ color: '#ffffff', fontFamily: 'Poppins, sans-serif' }}>
            {clientName}
          </p>
        </div>

        {/* Date & quote number */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Date</p>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{date}</p>
          </div>
          <div className="w-px h-8" style={{ background: 'rgba(102,144,204,0.3)' }} />
          <div className="text-center">
            <p className="text-xs tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Quote No.</p>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{quoteNumber}</p>
          </div>
        </div>

        {/* Solar icons row */}
        <div className="flex items-center gap-8 mt-14" style={{ color: 'rgba(102,144,204,0.5)' }}>
          {['☀', '⚡', '🌿'].map((icon, i) => (
            <span key={i} style={{ fontSize: '28px' }}>{icon}</span>
          ))}
        </div>
      </div>

      {/* Bottom footer */}
      <div
        className="flex-shrink-0 px-10 py-4 flex items-center justify-between"
        style={{ background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(102,144,204,0.2)' }}
      >
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          CONFIDENTIAL · For authorised recipient only
        </p>
        <p className="text-xs" style={{ color: '#6690cc' }}>
          rollingenergy.in · +91 98765 43210
        </p>
      </div>
    </div>
  );
}
