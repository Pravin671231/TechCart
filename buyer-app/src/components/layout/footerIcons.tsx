/**
 * Issue #322 — inline-SVG social and payment marks for the footer, replacing
 * the previous "FB" / "Visa" text placeholders. No icon-library dependency.
 * Social glyphs are monochrome (they sit in dark chips and inherit
 * `currentColor`); payment marks are brand-coloured and sit in white chips.
 */

type IconProps = { className?: string };

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H17V3.6c-.28-.04-1.25-.12-2.38-.12-2.35 0-3.96 1.44-3.96 4.08v2.27H8v3.1h2.66V21z" />
    </svg>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.53 3H20.5l-6.49 7.41L21.75 21h-6.02l-4.71-6.16L5.6 21H2.63l6.94-7.93L2.25 3h6.17l4.26 5.63zm-1.05 16.2h1.65L7.6 4.7H5.83z" />
    </svg>
  );
}

export function YouTubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M23 12s0-3.2-.4-4.7c-.24-.85-.9-1.5-1.75-1.73C19.32 5.2 12 5.2 12 5.2s-7.32 0-8.85.37c-.85.23-1.51.88-1.75 1.73C1 8.8 1 12 1 12s0 3.2.4 4.7c.24.85.9 1.5 1.75 1.73C4.68 18.8 12 18.8 12 18.8s7.32 0 8.85-.37c.85-.23 1.51-.88 1.75-1.73C23 15.2 23 12 23 12zM9.75 15V9l5.2 3z" />
    </svg>
  );
}

function PaymentFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="flex h-8 w-12 items-center justify-center rounded-md bg-white"
    >
      <svg viewBox="0 0 48 24" className="h-5 w-11">
        {children}
      </svg>
    </span>
  );
}

export function VisaMark() {
  return (
    <PaymentFrame label="Visa">
      <text
        x="24"
        y="17"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="13"
        fontStyle="italic"
        fontWeight="700"
        fill="#1a1f71"
      >
        VISA
      </text>
    </PaymentFrame>
  );
}

export function MastercardMark() {
  return (
    <PaymentFrame label="Mastercard">
      <circle cx="19" cy="12" r="8" fill="#eb001b" />
      <circle cx="29" cy="12" r="8" fill="#f79e1b" />
      <path d="M24 5.8a8 8 0 0 0 0 12.4 8 8 0 0 0 0-12.4z" fill="#ff5f00" />
    </PaymentFrame>
  );
}

export function RuPayMark() {
  return (
    <PaymentFrame label="RuPay">
      <text
        x="24"
        y="17"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="11"
        fontWeight="700"
      >
        <tspan fill="#097dc6">Ru</tspan>
        <tspan fill="#f47216">Pay</tspan>
      </text>
    </PaymentFrame>
  );
}

export function UpiMark() {
  return (
    <PaymentFrame label="UPI">
      <text
        x="20"
        y="17"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="12"
        fontWeight="700"
        fill="#3d3d3d"
      >
        UPI
      </text>
      <path d="M33 5l4 7-4 7-2-1 3.2-6L34 5z" fill="#f47216" />
      <path d="M37 5l4 7-4 7-2-1 3.2-6L38 5z" fill="#5aa545" />
    </PaymentFrame>
  );
}
