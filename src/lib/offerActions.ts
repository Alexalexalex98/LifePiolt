import { alertT } from '@/lib/alert';
import { confirmDelete } from '@/lib/confirm';
import { deletionImpact, scopeIds, type Scope, type SemLike } from '@/lib/offerEdit';
import { useNet, type Seminar } from '@/store/network';
import { t as tl } from '@/i18n/core';

/** Elimina un proprio seminario (o più date di una serie): avvisa quante persone sono coinvolte e quanti LP si rimborsano; si può annullare subito. */
export function deleteSeminar(sem: Seminar): void {
  const st = useNet.getState();
  const inSeries = !!sem.series && st.seminars.filter((x) => x.series === sem.series).length > 1;
  const run = (scope: Scope) => {
    const ids = scopeIds(st.seminars as SemLike[], sem.id, scope, Date.now());
    const impact = deletionImpact(st.seminars as SemLike[], ids, st.participants ?? {});
    const what = ids.length === 1 ? `il seminario «${sem.title}»` : tl('{0} date del seminario «{1}»', ids.length, sem.title);
    const extra = impact.people > 0 ? ` ${tl('{0} iscritti vengono avvisati', impact.people)}${impact.refund > 0 ? ` ${tl('e rimborsati ({0} LP)', impact.refund)}` : ''}.` : '';
    const before = { seminars: st.seminars, participants: st.participants };
    confirmDelete(`${what}.${extra}`, () => {
      const cur = useNet.getState();
      const parts = { ...(cur.participants ?? {}) };
      ids.forEach((id) => { delete parts[`seminar:${id}`]; });
      cur.patch({ seminars: cur.seminars.filter((x) => !ids.includes(x.id)), participants: parts });
    }, () => useNet.getState().patch(before), { title: 'Eliminare il seminario?', undoMessage: ids.length === 1 ? 'Seminario eliminato' : 'Seminari eliminati' });
  };
  if (!inSeries) { run('one'); return; }
  alertT('Eliminare quale?', 'Questo seminario fa parte di una serie.', [
    { text: 'Solo questo', onPress: () => run('one') },
    { text: 'Questo e i successivi', onPress: () => run('following') },
    { text: 'Tutta la serie', style: 'destructive', onPress: () => run('all') },
    { text: 'Annulla', style: 'cancel' },
  ]);
}
