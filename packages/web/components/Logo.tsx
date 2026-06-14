/**
 * Consilium mark. Inline SVG so it inherits color from `currentColor` (set the size and color via
 * className, e.g. `size-7 text-foreground`). The pupil punches through to the surrounding background
 * so the "eye" reads on any surface.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-100 -100 200 200"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        <path d="M 2.12 -17.68 L 66.47 -66.47 L 17.68 -2.12 Z" />
        <path d="M -2.12 17.68 L -66.47 66.47 L -17.68 2.12 Z" />
        <path d="M -17.68 -2.12 L -66.47 -66.47 L -2.12 -17.68 Z" />
        <path d="M 17.68 2.12 L 66.47 66.47 L 2.12 17.68 Z" />
        <path d="M 0 -22.00 Q 9.00 0 0 22.00 Q -9.00 0 0 -22.00 Z" />
      </g>
      <circle cx="0" cy="0" r="4.60" className="fill-background" />
    </svg>
  );
}
