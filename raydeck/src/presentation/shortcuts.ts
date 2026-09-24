export function ignoresPresentationShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return true;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('input, textarea, select, [contenteditable="true"], [role="menu"], [role="dialog"], .save-menu, .present-menu, .slide-picker')) return true;
  return event.key === ' ' && Boolean(target?.closest('button, a, [role="button"]'));
}
