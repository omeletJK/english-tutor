type IllustrationProps = {
  size?: number;
  className?: string;
};

const DEFAULT_STROKE = "var(--ink)";
const DEFAULT_WASH = "var(--accent-wash)";
const GOLD_WASH = "var(--gold-wash)";

export function PaperPlane({ size = 56, className }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke={DEFAULT_STROKE}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 30 L58 8 L42 56 L34 38 L6 30 Z" fill={DEFAULT_WASH} />
      <path d="M34 38 L58 8" />
      <path d="M34 38 L26 50" />
    </svg>
  );
}

export function Notebook({ size = 56, className }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke={DEFAULT_STROKE}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="12" y="10" width="40" height="46" rx="3" fill={DEFAULT_WASH} />
      <path d="M18 10 L18 56" />
      <path d="M24 22 L46 22" />
      <path d="M24 30 L46 30" />
      <path d="M24 38 L40 38" />
      <path d="M24 46 L34 46" />
    </svg>
  );
}

export function Microphone({ size = 56, className }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke={DEFAULT_STROKE}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="24" y="8" width="16" height="30" rx="8" fill={DEFAULT_WASH} />
      <path d="M16 30 C16 40, 24 46, 32 46 C40 46, 48 40, 48 30" />
      <path d="M32 46 L32 54" />
      <path d="M24 54 L40 54" />
    </svg>
  );
}

export function Envelope({ size = 56, className }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke={DEFAULT_STROKE}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="6" y="16" width="52" height="36" rx="3" fill={GOLD_WASH} />
      <path d="M6 18 L32 38 L58 18" />
      <circle cx="32" cy="44" r="5" fill="var(--gold)" stroke="var(--gold-deep)" />
    </svg>
  );
}

export function RotateCcw({ size = 20, className }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-7.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export function Star({ size = 24, className }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="var(--gold-wash)"
      stroke="var(--gold-deep)"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3 L14.5 9 L21 9.6 L16 13.9 L17.5 20.4 L12 17 L6.5 20.4 L8 13.9 L3 9.6 L9.5 9 Z" />
    </svg>
  );
}
