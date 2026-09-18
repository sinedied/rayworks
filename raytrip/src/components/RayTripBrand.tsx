import rayworksLogo from '@/assets/rayworks-logo.svg';

export function RayTripBrand({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <span className={`raytrip-brand${compact ? ' raytrip-brand-compact' : ''}`}>
      <img src={rayworksLogo} alt="Ray|Works" />
      <span className="raytrip-product">Ray|Trip</span>
    </span>
  );
}
