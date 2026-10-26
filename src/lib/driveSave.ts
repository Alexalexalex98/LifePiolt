import { Directory, File, Paths } from 'expo-file-system';
import { weekdayShortDate } from '@/lib/format';
import { useLife } from '@/store/life';

/** Dimensione leggibile (es. «1,2 MB»). */
const sizeText = (b?: number) => (!b ? '—' : b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const DAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const stamp = () => { const d = new Date(); return `${DAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** Le foto della fotocamera stanno in una cartella temporanea che iOS può svuotare: ne tengo una copia nella cartella dell'app. */
function keep(uri: string): string {
  try {
    if (!/^file:/i.test(uri)) return uri;
    const dir = new Directory(Paths.document, 'drive');
    if (!dir.exists) dir.create({ intermediates: true });
    const ext = /\.(\w{2,4})(?:\?|$)/.exec(uri)?.[1] ?? 'jpg';
    const dest = new File(dir, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`);
    new File(uri).copy(dest);
    return dest.uri;
  } catch { return uri; }
}

/**
 * Ogni foto o video caricato nell'app (chat, Theia, pasti, scontrini, esercizi…) finisce anche in LifeDrive, sul telefono. Fa eccezione LifeNetwork (post, storie, profilo).
 * Le foto vanno nella scheda «Foto»; i video nella cartella «Video». Lo stesso file non si salva due volte.
 * `from` dice da dove arriva (finisce nel nome), `folder` permette di mettere una foto in un'altra cartella (per esempio «Ricevute»).
 */
export function saveMediaToDrive(m: { uri?: string | null; media: 'photo' | 'video'; from: string; name?: string; size?: number; folder?: string }): boolean {
  if (!m.uri) return false;
  try {
    const life = useLife.getState();
    if (life.drive.some((d) => d.uri === m.uri || d.orig === m.uri)) return false;
    const kept = keep(m.uri);
    const base = m.name && m.name.length > 2 ? m.name : `${m.media === 'video' ? 'Video' : 'Foto'} · ${m.from} · ${stamp()}`;
    life.addFile({ n: base, s: sizeText(m.size), folder: m.folder ?? (m.media === 'video' ? 'Video' : 'Foto'), date: weekdayShortDate(), uri: kept, orig: m.uri, photo: true, src: m.from });
    return true;
  } catch { return false; }
}
