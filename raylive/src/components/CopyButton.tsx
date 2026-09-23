import { useState } from 'react';

export function CopyButton({
  value,
  label = 'Copy',
  className = '',
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the URL stays selectable on screen.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={`rounded-lg border border-admin-control-border px-3 py-2 text-sm font-medium text-admin-muted transition-colors hover:bg-admin-canvas ${className}`}
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}
