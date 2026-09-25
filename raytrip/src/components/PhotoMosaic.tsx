import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { TripPhoto } from '../../rayfin/data/TripPhoto';
import { mosaicLayout } from '@/lib/photo-mosaic';
import { useTripPhoto } from '@/hooks/useTripPhotos';

function Tile({ photo, style, onError }: { photo: TripPhoto; style: CSSProperties; onError?: (message: string) => void }) {
  const { url, error } = useTripPhoto(photo);
  useEffect(() => { if (error) onError?.(error); }, [error, onError]);
  return (
    <div className="mosaic-tile" style={style}>
      {url && <img src={url} alt="" />}
      {error && <span className="mosaic-tile-error">Photo unavailable</span>}
    </div>
  );
}

export function PhotoMosaic({ photos, onError }: { photos: readonly TripPhoto[]; onError?: (message: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 360 });
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width && height) setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const invalid = photos.some(photo => !photo.width || !photo.height);
  useEffect(() => { if (invalid) onError?.('Some selected photos have invalid dimensions. Choose the header photos again.'); }, [invalid, onError]);
  const tiles = useMemo(() => invalid ? [] : mosaicLayout(
    photos.map(photo => ({ width: photo.width!, height: photo.height! })), size.width, size.height
  ), [photos, size, invalid]);
  return (
    <div className="photo-mosaic" ref={ref} aria-hidden="true">
      {invalid ? <span className="mosaic-tile-error">Photo dimensions unavailable</span> : tiles.map(tile => (
        <Tile key={photos[tile.index].id} photo={photos[tile.index]} onError={onError} style={{
          left: `${tile.x / size.width * 100}%`, top: `${tile.y / size.height * 100}%`,
          width: `${tile.width / size.width * 100}%`, height: `${tile.height / size.height * 100}%`,
        }} />
      ))}
    </div>
  );
}
