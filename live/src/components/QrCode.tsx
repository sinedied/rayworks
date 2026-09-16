import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** Renders a QR code for a URL, sized for either a control panel or a slide. */
export function QrCode({ url, size = 160 }: { url: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: size * 2 })
      .then((generated) => {
        if (!cancelled) setDataUrl(generated);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (!dataUrl) {
    return (
      <div
        className="rounded-xl bg-gray-100 animate-pulse"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`QR code for ${url}`}
      width={size}
      height={size}
      className="rounded-xl bg-white"
    />
  );
}
