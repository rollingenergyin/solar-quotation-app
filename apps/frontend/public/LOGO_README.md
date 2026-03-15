# Rolling Energy Logo

Place your logo file here as:

- `rolling-energy-logo.png`  (recommended, PNG with transparent background)
- `rolling-energy-logo.svg`  (alternative, scalable)

## Usage in components

Once placed, update `RollingEnergyLogo.tsx` to use the actual image:

```tsx
import Image from 'next/image';

// Replace the SVG monogram with:
<Image
  src="/rolling-energy-logo.png"
  alt="Rolling Energy"
  width={size === 'sm' ? 80 : size === 'md' ? 120 : 160}
  height={size === 'sm' ? 40 : size === 'md' ? 60 : 80}
  priority
/>
```

## Recommended logo specs

- Format: PNG (transparent background) or SVG
- Dimensions: min 400px wide
- Aspect ratio: ideally 3:1 (wide) or square
- Color: provide both dark and light variants if possible
