import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface MockSignInDialogProps {
  open: boolean;
  onConfirm: (email: string) => void;
  onCancel: () => void;
}

export function MockSignInDialog({
  open,
  onConfirm,
  onCancel,
}: MockSignInDialogProps) {
  const [email, setEmail] = useState('dev@contoso.com');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-sm rounded-2xl p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 text-left">
            Sign in
          </DialogTitle>
          <p className="mt-1 text-sm text-gray-500 text-left">
            Running in local development mode.
          </p>
        </DialogHeader>

        {/* Mock warning banner */}
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span className="text-sm">
            This is a local mock of Entra authentication.
          </span>
        </div>

        {/* Email input */}
        <div className="rounded-lg bg-gray-50 p-4">
          <label
            htmlFor="mock-email"
            className="mb-1 block text-sm text-gray-500"
          >
            Signing in as
          </label>
          <Input
            id="mock-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="font-medium"
          />
        </div>

        <DialogFooter className="flex-row gap-3 sm:justify-center">
          <Button
            variant="outline"
            className="flex-1 rounded-lg"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => onConfirm(email)}
            disabled={!email.trim()}
          >
            Confirm Sign In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
