/** "Ridgeline Coffee: From ridge to cup" → lead "Ridgeline Coffee", main "From ridge to cup". */
export function splitTitle(title: string): { lead: string; main: string } {
  const index = title.indexOf(': ');
  if (index <= 0) return { lead: '', main: title };
  return { lead: title.slice(0, index), main: title.slice(index + 2) };
}

/** Splits a formatted metric such as "18.4k t" into its figure and unit. */
export function splitMetric(text: string): { figure: string; unit: string } {
  const space = text.indexOf(' ');
  return space === -1 ? { figure: text, unit: '' } : { figure: text.slice(0, space), unit: text.slice(space + 1) };
}
