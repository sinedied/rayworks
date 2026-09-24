import { CheckIcon, LinkIcon, QrCodeIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { QrCode } from '@/components/QrCode';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/** One public URL for both clipboard sharing and the QR dialog. */
export function ShareLinkButton({
  shareToken,
  formTitle,
  variant = 'outline',
}: {
  shareToken: string;
  formTitle: string;
  variant?: 'outline' | 'default' | 'ghost';
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const url = `${window.location.origin}/f/${shareToken}`;

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    clearTimeout(timer.current);
    setCopied(false);
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy share link:', err);
      setCopyError('Could not copy the link. Open the QR dialog to select the URL manually.');
    }
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Button
        variant={variant}
        size="sm"
        className="min-h-11 sm:min-h-10 pointer-coarse:min-h-11"
        onClick={copy}
        title={url}
      >
        {copied ? (
          <CheckIcon className="mr-2 h-3.5 w-3.5" />
        ) : (
          <LinkIcon className="mr-2 h-3.5 w-3.5" />
        )}
        {copied ? 'Copied' : 'Copy link'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant={variant}
            size="sm"
            className="min-h-11 sm:min-h-10 pointer-coarse:min-h-11"
            aria-label={`Show QR code for ${formTitle}`}
          >
            <QrCodeIcon className="mr-2 h-3.5 w-3.5" />
            Show QR code
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto [&>[data-slot=dialog-close]]:top-1 [&>[data-slot=dialog-close]]:right-1 [&>[data-slot=dialog-close]]:flex [&>[data-slot=dialog-close]]:size-11 [&>[data-slot=dialog-close]]:items-center [&>[data-slot=dialog-close]]:justify-center">
          <DialogHeader>
            <DialogTitle className="break-words pr-5">
              {formTitle}
            </DialogTitle>
            <DialogDescription>
              Scan to open this form. No account needed to respond.
            </DialogDescription>
          </DialogHeader>
          {open && <QrCode url={url} title={formTitle} />}
          <p className="select-all break-all rounded-md border bg-muted p-3 text-sm">
            {url}
          </p>
          <Button onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
          {copyError && (
            <p role="alert" className="text-sm text-destructive">{copyError}</p>
          )}
        </DialogContent>
      </Dialog>
      {copyError && !open && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {copyError}
        </p>
      )}
    </div>
  );
}
