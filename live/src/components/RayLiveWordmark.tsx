type RayLiveWordmarkProps = {
  className?: string;
  themed?: boolean;
};

export function RayLiveWordmark({
  className = '',
  themed = false,
}: RayLiveWordmarkProps) {
  return (
    <span
      aria-label="Ray Live"
      className={`inline-flex items-center font-bold tracking-[-0.035em] ${
        themed ? 'text-[var(--ia-text)]' : 'text-[var(--brand-navy)]'
      } ${className}`}
    >
      Ray
      <span
        aria-hidden
        className={`px-[0.08em] ${
          themed ? 'text-[var(--ia-accent)]' : 'text-[var(--brand-blue)]'
        }`}
      >
        |
      </span>
      Live
    </span>
  );
}
