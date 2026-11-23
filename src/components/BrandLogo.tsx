import { useState } from 'react';
import { siteData } from '../siteData';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
};

export function BrandLogo({ size = 'md', className = '' }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !siteData.logo) {
    return (
      <div
        aria-label={siteData.tuitionName}
        className={`${SIZE_MAP[size]} rounded-full bg-[#0F2A4A] text-[#F5A623] font-bold flex items-center justify-center border-2 border-[#F5A623]/40 shrink-0 select-none ${className}`}
      >
        {siteData.logoFallbackInitials}
      </div>
    );
  }

  return (
    <img
      src={siteData.logo}
      alt={siteData.tuitionName}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${SIZE_MAP[size]} rounded-2xl object-cover shrink-0 shadow-sm ${className}`}
    />
  );
}
