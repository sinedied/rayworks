import { CheckIcon, LinkIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

/** Copies a form's share link, confirming inline so no toast is needed. */
export function ShareLinkButton({
  shareToken,
  variant = 'outline',
}: {
  shareToken: string;
  variant?: 'outline' | 'default' | 'ghost';
}) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/f/${shareToken}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  return (
    <Button
      variant={variant}
      size="sm"
      
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
  );
}
