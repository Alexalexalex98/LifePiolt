import { DayBook } from '@/components/CalendarViews';
import { Page } from '@/components/ui';
import { go } from '@/lib/nav';

/** Agenda a pagine: una pagina per giorno, con le ore. Separata dal Plan: da qui si apre il giorno nel Plan per modificarlo. */
export default function Agenda() {
  const openDay = (k: string) => go('plan', { day: k, at: String(Date.now()) });
  return (
    <Page id="agenda" back title="Agenda">
      <DayBook onPickDay={openDay} onOpenBand={() => go('plan')} />
    </Page>
  );
}
