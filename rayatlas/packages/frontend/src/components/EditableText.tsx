import { useLayoutEffect, useRef, type ElementType } from 'react';

import { cn } from '@/lib/utils';

interface EditableTextProps {
  value: string;
  editing: boolean;
  /** Accessible name of the field while editing, e.g. "Chapter title". */
  label: string;
  onChange: (value: string) => void;
  as?: ElementType;
  className?: string;
  /** Titles and labels stay on one line: Enter is ignored and pasted newlines become spaces. */
  singleLine?: boolean;
  id?: string;
}

function AutoSizeTextarea({ value, className, label, onChange, singleLine }: Omit<EditableTextProps, 'editing' | 'as' | 'id'>) {
  const field = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={field}
      rows={1}
      className={cn('editable-field', className)}
      aria-label={label}
      value={value}
      spellCheck
      onKeyDown={(event) => {
        if (singleLine && event.key === 'Enter') event.preventDefault();
      }}
      onChange={(event) => onChange(singleLine ? event.target.value.replace(/\s*\n\s*/g, ' ') : event.target.value)}
    />
  );
}

/** Story text that turns into an in-place field in edit mode, keeping its typography. */
export function EditableText({ value, editing, label, onChange, as: Tag = 'p', className, singleLine, id }: EditableTextProps) {
  if (!editing) return <Tag id={id} className={className}>{value}</Tag>;
  return (
    <Tag id={id} className={cn(className, 'is-editing')}>
      <AutoSizeTextarea value={value} label={label} onChange={onChange} singleLine={singleLine} />
    </Tag>
  );
}
