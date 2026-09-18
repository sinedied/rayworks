import raytripLogo from '@/assets/raytrip.svg';

export function RayTripBrand({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <span className={`raytrip-brand${compact ? ' raytrip-brand-compact' : ''}`}>
      <img src={raytripLogo} alt="Ray|Trip" />
    </span>
  );
}
