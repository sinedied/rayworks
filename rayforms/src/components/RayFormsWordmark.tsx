import { cn } from '@/lib/utils';
import rayFormsLogo from '@/assets/rayforms.svg';

export function RayFormsWordmark({ className }: { className?: string }) {
  return (
    <img
      src={rayFormsLogo}
      alt="Ray|Forms"
      className={cn(
        'block h-5 w-auto max-w-full',
        className
      )}
    />
  );
}
