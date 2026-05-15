import React from 'react';

/**
 * Staple brand mark: stapler cap + speech bubble body + check-shaped staple legs.
 * Use `color` for the main shape (defaults to currentColor). Accent check stays red unless `monochrome`.
 */
export default function StapleLogo({
  size = 28,
  color = 'currentColor',
  accentColor = '#EF4444',
  monochrome = false,
  className,
  'aria-hidden': ariaHidden = true,
  title = 'Staple',
}) {
  const w = size;
  const h = size;
  const checkStroke = monochrome ? color : accentColor;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={w}
      height={h}
      fill="none"
      className={className}
      role={ariaHidden ? 'img' : undefined}
      aria-hidden={ariaHidden ? true : undefined}
      aria-label={ariaHidden ? undefined : title}
    >
      {!ariaHidden ? <title>{title}</title> : null}
      <path
        fill={color}
        d="M8 9.5h32a4.5 4.5 0 0 1 4.5 4.5v4.8a3.2 3.2 0 0 1-3.2 3.2H11.7a3.2 3.2 0 0 1-3.2-3.2V14A4.5 4.5 0 0 1 8 9.5Z"
      />
      <rect x="13" y="12.5" width="22" height="3" rx="1.5" fill="#fff" fillOpacity={monochrome ? 0.28 : 0.22} />
      <path fill={color} fillOpacity={0.18} d="M10.5 18.8h27v1.8h-27z" />
      <path
        fill={color}
        d="M10.5 20.2h27a5.2 5.2 0 0 1 5.2 5.2v11.6a5.2 5.2 0 0 1-5.2 5.2H23.4l-4.8 6.1a1.05 1.05 0 0 1-1.65-.85V41.2h-6.4a5.2 5.2 0 0 1-5.2-5.2V25.4a5.2 5.2 0 0 1 5.2-5.2Z"
      />
      <path
        stroke={checkStroke}
        strokeWidth="2.85"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.2 28.4 22.2 34.4 33.8 23.2"
      />
    </svg>
  );
}
