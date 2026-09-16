import {
  BarChart3Icon,
  LockIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UnlockIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import type { Form } from '../../rayfin/data/Form';
import { EmptyState } from '@/components/EmptyState';
import { PageShell, PageTitle } from '@/components/PageShell';
import { ShareLinkButton } from '@/components/ShareLinkButton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useForms } from '@/hooks/useForms';

export function Dashboard() {
  const { forms, loading, error, setFormClosed, deleteForm } = useForms();

  const newFormButton = (
    <Button asChild>
      <Link to="/forms/new">
        <PlusIcon className="mr-2 h-4 w-4" />
        New form
      </Link>
    </Button>
  );

  return (
    <PageShell width="regular">
      <PageTitle
        eyebrow="Workspace"
        title="Your forms"
        description="Compose a form, share its link, and watch the answers come in."
        actions={newFormButton}
      />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading forms…</p>
      ) : forms.length === 0 ? (
        <div className="fade-in">
          <EmptyState
            title="A blank page"
            description="Nothing here yet. Your first form is a few questions away."
            action={newFormButton}
          />
        </div>
      ) : (
        <ul className="fade-in space-y-3">
          {forms.map((form) => (
            <FormRow
              key={form.id}
              form={form}
              onToggleClosed={() => setFormClosed(form.id, !form.isClosed)}
              onDelete={() => {
                if (
                  window.confirm(
                    `Delete "${form.title}"? Its questions and all submitted responses will be permanently deleted.`
                  )
                ) {
                  deleteForm(form.id);
                }
              }}
            />
          ))}
        </ul>
      )}
    </PageShell>
  );
}

interface FormRowProps {
  form: Form;
  onToggleClosed: () => void;
  onDelete: () => void;
}

/**
 * Primary actions sit inline from `sm` up; below that they collapse into a menu so the
 * row never wraps into a broken pile of buttons.
 */
function FormRow({ form, onToggleClosed, onDelete }: FormRowProps) {
  return (
    <li className="card card-interactive p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="font-heading truncate text-base text-[var(--text)]">
              {form.title}
            </h2>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                form.isClosed
                  ? 'bg-[var(--surface-sunk)] text-[var(--text-muted)]'
                  : 'bg-[var(--brand-tint)] text-[var(--brand-hover)]'
              }`}
            >
              {form.isClosed ? 'Closed' : 'Open'}
            </span>
          </div>

          {form.description && (
            <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
              {form.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ShareLinkButton shareToken={form.shareToken} />
            <Button asChild variant="outline" size="sm" >
              <Link to={`/forms/${form.id}/results`}>
                <BarChart3Icon className="mr-2 h-3.5 w-3.5" />
                Results
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Link to={`/forms/${form.id}/edit`}>
                <PencilIcon className="mr-2 h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label={`Actions for ${form.title}`}
            >
              <MoreHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild className="sm:hidden">
              <Link to={`/forms/${form.id}/edit`}>
                <PencilIcon className="mr-2 h-3.5 w-3.5" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleClosed}>
              {form.isClosed ? (
                <UnlockIcon className="mr-2 h-3.5 w-3.5" />
              ) : (
                <LockIcon className="mr-2 h-3.5 w-3.5" />
              )}
              {form.isClosed ? 'Reopen form' : 'Close form'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2Icon className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
