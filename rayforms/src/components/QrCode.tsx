import { useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function QrCode({ url, title }: { url: string; title: string }) {
  const [result, setResult] = useState<{
    url: string;
    dataUrl?: string;
    error?: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const current = result?.url === url ? result : null;

  useEffect(() => {
    let cancelled = false;
    setResult({ url });
    async function generate() {
      try {
        const { default: encoder } = await import('qrcode');
        const dataUrl = await encoder.toDataURL(url, {
          width: 512,
          margin: 4,
          color: { dark: '#000000', light: '#ffffff' },
        });
        if (!cancelled) setResult({ url, dataUrl });
      } catch (error) {
        console.error('Failed to generate QR code:', error);
        if (!cancelled) {
          setResult({
            url,
            error: 'Could not generate the QR code. Please try again.',
          });
        }
      }
    }
    void generate();
    return () => {
      cancelled = true;
    };
  }, [url, attempt]);

  if (current?.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {current.error}
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry QR code
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return current?.dataUrl ? (
    <img
      src={current.dataUrl}
      alt={`QR code to open ${title}`}
      width={256}
      height={256}
      className="mx-auto h-auto w-64 max-w-full bg-white"
    />
  ) : (
    <div role="status" className="mx-auto flex aspect-square w-64 max-w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
      Generating QR code...
    </div>
  );
}
