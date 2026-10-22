import { weekdayShortDate } from '@/lib/format';
import { useLife } from '@/store/life';

/** Dimensione leggibile (es. «1,2 MB»). */
const sizeText = (b?: number) => (!b ? '—' : b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const DAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const stamp = () => { const d = new Date(); return `${DAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/**
 * Ogni foto o video caricato nell'app (chat, Theia, pasti, scontrini, esercizi…) finisce anche in LifeDrive, sul telefono. Fa eccezione LifeNetwork (post, storie, profilo).
 * Le foto vanno nella scheda «Foto»; i video nella cartella «Video». Lo stesso file non si salva due volte.
 * `from` dice da dove arriva (finisce nel nome), `folder` permette di mettere una foto in un'altra cartella (per esempio «Ricevute»).
 */
export function saveMediaToDrive(m: { uri?: string | null; media: 'photo' | 'video'; from: string; name?: string; size?: number; folder?: string }): boolean {
  if (!m.uri) return false;
  try {
    const life = useLife.getState();
    if (life.drive.some((d) => d.uri === m.uri)) return false;
    const base = m.name && m.name.length > 2 ? m.name : `${m.media === 'video' ? 'Video' : 'Foto'} · ${m.from} · ${stamp()}`;
    life.addFile({ n: base, s: sizeText(m.size), folder: m.folder ?? (m.media === 'video' ? 'Video' : 'Foto'), date: weekdayShortDate(), uri: m.uri });
    return true;
  } catch { return false; }
}
