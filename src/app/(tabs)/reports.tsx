import { ReportsView } from '@/components/ReportsSheet';
import { Page } from '@/components/ui';

/** Pagina "Segnalazioni inviate": si apre con go('reports'). */
export default function ReportsPage() {
  return (
    <Page id="reports" title="Segnalazioni inviate" back>
      <ReportsView />
    </Page>
  );
}
