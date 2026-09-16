import { cn } from '@/lib/utils';

export function RayFormsWordmark({ className }: { className?: string }) {
  return (
    <span
      aria-label="Ray Forms"
      className={cn(
        'font-heading inline-flex items-center text-[var(--brand-navy)]',
        className
      )}
    >
      Ray
      <span aria-hidden className="px-[0.08em] text-[var(--brand)]">
        |
      </span>
      Forms
    </span>
  );
}
