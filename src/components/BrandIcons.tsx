import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

/**
 * Authentic Official YouTube Brand Icon
 * Red rounded rect with centered white play triangle
 */
export const YouTubeIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={size ? { width: size, height: size } : undefined}
    aria-hidden="true"
  >
    <path
      fill="#FF0000"
      d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
    />
    <path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

/**
 * Authentic Official Facebook Brand Icon
 * Blue badge with crisp white lowercase 'f'
 */
export const FacebookIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={size ? { width: size, height: size } : undefined}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="12" fill="#1877F2" />
    <path
      d="M13.6 18V12.1h2l.3-2.3h-2.3v-1.5c0-.7.2-1.1 1.2-1.1h1.1V5.2c-.2 0-.9-.1-1.7-.1-1.7 0-2.9 1-2.9 3v1.7h-2v2.3h2V18h2.3z"
      fill="#FFFFFF"
    />
  </svg>
);

/**
 * Authentic Official Instagram Brand Icon
 * Clean glyph or subtle gradient camera glyph
 */
export const InstagramIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={size ? { width: size, height: size } : undefined}
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="igGradient" cx="20%" cy="100%" r="120%">
        <stop offset="0%" stopColor="#fdf497" />
        <stop offset="5%" stopColor="#fdf497" />
        <stop offset="45%" stopColor="#fd5949" />
        <stop offset="60%" stopColor="#d6249f" />
        <stop offset="90%" stopColor="#285AEB" />
      </radialGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#igGradient)" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8.2c-1.77 0-3.2-1.43-3.2-3.2s1.43-3.2 3.2-3.2 3.2 1.43 3.2 3.2-1.43 3.2-3.2 3.2zm6.2-8.3c-.66 0-1.2.54-1.2 1.2s.54 1.2 1.2 1.2 1.2-.54 1.2-1.2-.54-1.2-1.2-1.2z"
      fill="#FFFFFF"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M17.5 4H6.5C5.12 4 4 5.12 4 6.5v11C4 18.88 5.12 20 6.5 20h11c1.38 0 2.5-1.12 2.5-2.5v-11C20 5.12 18.88 4 17.5 4zm.7 12.5c0 .94-.76 1.7-1.7 1.7H7.5c-.94 0-1.7-.76-1.7-1.7V7.5c0-.94.76-1.7 1.7-1.7h9c.94 0 1.7.76 1.7 1.7v9z"
      fill="#FFFFFF"
    />
  </svg>
);

/**
 * Authentic Official TikTok Brand Icon
 * Using uploaded official 3D glitch note asset
 */
export const TikTokIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size }) => (
  <img
    src="/assets/aistudio/image_759c4859.png"
    alt="TikTok"
    className={`${className} object-contain rounded-xs shrink-0 inline-block`}
    style={size ? { width: size, height: size } : undefined}
    loading="lazy"
  />
);

/**
 * Authentic Official bKash Brand Icon
 * Using uploaded official origami bird asset
 */
export const BKashIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size }) => (
  <img
    src="/assets/aistudio/image_011ee9bb.png"
    alt="bKash"
    className={`${className} object-contain rounded-xs shrink-0 inline-block`}
    style={size ? { width: size, height: size } : undefined}
    loading="lazy"
  />
);

/**
 * Authentic Official Nagad Brand Icon
 * Using uploaded official postal runner + Bengali text asset
 */
export const NagadIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', size }) => (
  <img
    src="/assets/aistudio/image_5ebe9697.png"
    alt="Nagad"
    className={`${className} object-contain rounded-xs shrink-0 inline-block`}
    style={size ? { width: size, height: size } : undefined}
    loading="lazy"
  />
);

