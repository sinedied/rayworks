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
      className={`rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 ${className}`}
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}
