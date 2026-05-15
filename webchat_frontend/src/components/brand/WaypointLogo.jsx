import React from 'react';

/** Drop your file at `webchat_frontend/public/logo.png` (served as `/logo.png`). */
const LOGO_SRC = '/logo.png';

export default function WaypointLogo({
  size = 28,
  className,
  title = 'Waypoint',
  'aria-hidden': ariaHidden = false,
}) {
  return (
    <img
      src={LOGO_SRC}
      width={size}
      height={size}
      alt={ariaHidden ? '' : title}
      aria-hidden={ariaHidden || undefined}
      className={className}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  );
}
