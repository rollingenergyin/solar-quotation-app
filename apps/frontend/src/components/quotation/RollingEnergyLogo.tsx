'use client';

import Image from 'next/image';

interface Props {
  /** "light" → light/white background → logo-main.png (original colours)
   *  "dark"  → dark background (#161c34) → logo-white.png (white version) */
  variant: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const dims = {
  sm: { w: 80,  h: 61  },
  md: { w: 110, h: 84  },
  lg: { w: 150, h: 114 },
  xl: { w: 200, h: 152 },
};

export default function RollingEnergyLogo({ variant, size = 'md', className = '' }: Props) {
  const { w, h } = dims[size];
  const src = variant === 'dark' ? '/logo-white.png' : '/logo-main.png';

  return (
    <div className={className} style={{ lineHeight: 0, flexShrink: 0 }}>
      <Image
        src={src}
        alt="Rolling Energy"
        width={w}
        height={h}
        style={{ width: w, height: 'auto', objectFit: 'contain', display: 'block' }}
        priority
        unoptimized
      />
    </div>
  );
}
