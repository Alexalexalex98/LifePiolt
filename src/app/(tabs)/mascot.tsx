import { MascotSettings } from '@/components/mascot/MascotSettings';
import { Page } from '@/components/ui';

/** Theia, la mascotte: la stessa scheda che trovi in Impostazioni. */
export default function MascotPage() {
  return <Page id="mascot" back title="Theia"><MascotSettings /></Page>;
}
