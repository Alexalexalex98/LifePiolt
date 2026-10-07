export function noteTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const first = (clean.match(/^.*?[.!?](?=\s|$)/) || [clean])[0];
  const title = first.split(' ').filter(Boolean).slice(0, 7).join(' ').replace(/[.,;:!?]+$/, '');
  return title || 'Nota senza titolo';
}
export function notePreview(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 90 ? clean.slice(0, 90) + '…' : clean;
}
