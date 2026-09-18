import rayLiveDarkLogo from '@/assets/raylive-dark.svg';
import rayLiveLogo from '@/assets/raylive.svg';

export type RayLiveLogoVariant = 'light' | 'dark';

type RayLiveWordmarkProps = {
  className?: string;
  variant?: RayLiveLogoVariant;
};

export function RayLiveWordmark({
  className = '',
  variant = 'light',
}: RayLiveWordmarkProps) {
  return (
    <img
      src={variant === 'dark' ? rayLiveDarkLogo : rayLiveLogo}
      alt="Ray|Live"
      className={`block h-6 w-auto max-w-full ${className}`}
    />
  );
}
