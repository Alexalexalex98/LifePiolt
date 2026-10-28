/**
 * Una foto mandata a Theia senza contesto va dove serve: foto del corpo -> Controllo del corpo (e analisi), frigo -> scorte, piatto -> pasto,
 * scontrino -> spesa. Se si sta gia' parlando di quell'argomento la foto resta nel discorso e al massimo si offre di spostarla.
 */
import { t } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { AiServerError, aiReadFiles, aiServerConfigured } from '@/lib/aiServer';
import { saveMediaToDrive } from '@/lib/driveSave';
import { BODY_SLOTS } from '@/lib/fitness/bodyCheck';
import { runBodyAnalysis } from '@/lib/fitness/bodyRun';
import { MEAL_PROMPT, parseMealReply, resolveItems } from '@/lib/fitness/mealPhoto';
import { macrosFor, sumMacros } from '@/lib/fitness/nutrition';
import { FRIDGE_PROMPT, RECEIPT_ITEMS_PROMPT, parseReceiptItems } from '@/lib/fitness/pantry';
import { useBodyCheck } from '@/store/bodyCheck';
import { assignBodySlots, classifyPrompt, genericCaption, missingSlots, parseClassify, topicFromTalk, type PhotoGuess, type PhotoKind } from './photoRouteCore';
import type { ExtImage, TheiaAction, TheiaExt } from './theiaExt';

type Push = (text: string, extra?: { ext?: TheiaExt }) => unknown;
export type RouteOutcome = { handled: boolean; /** si sta parlando di questo: la foto resta nel discorso e si offre lo spostamento */ offer?: PhotoKind };

const WHERE: Record<Exclude<PhotoKind, 'altro'>, string> = { corpo: 'Controllo del corpo', frigo: 'Frigo e spesa', piatto: 'Diario dei pasti', scontrino: 'Frigo e spesa' };
const money = (n: number) => `${n}`;
const slotName = (s: import('@/lib/fitness/bodyCheck').BodySlot) => ({ front: t('davanti'), back: t('dietro'), left: t('lato sinistro'), right: t('lato destro') })[s];

/** Prova a smistare le foto. `handled` = ha risposto lei; altrimenti prosegue il flusso normale (LifeDrive e lettura con l'AI). */
export async function routePhotos(images: ExtImage[], caption: string, recentTexts: string[], push: Push): Promise<RouteOutcome> {
  if (!images.length || !aiServerConfigured || !genericCaption(caption)) return { handled: false };
  const talk = topicFromTalk([...recentTexts, caption]);
  if (talk) return { handled: false, offer: talk };
  if (!(await askSend('files', t('{0} foto, per capire a cosa servono', images.length)))) return { handled: false };
  let guesses: PhotoGuess[];
  try {
    logSend('files', 0, ['image/jpeg']);
    guesses = parseClassify(await aiReadFiles(classifyPrompt(images.length), images.map((x) => ({ uri: x.uri, mime: x.mime || 'image/jpeg' })), 60000, 640), images.length);
  } catch { return { handled: false }; }
  if (guesses.every((g) => g.kind === 'altro')) return { handled: false };

  const by = (k: PhotoKind) => images.map((im, i) => ({ im, g: guesses[i] })).filter((x) => x.g.kind === k);
  const others = by('altro');
  for (const x of others) saveMediaToDrive({ uri: x.im.uri, media: 'photo', from: 'Theia' });
  const body = by('corpo');
  if (body.length) await routeBody(body.map((x) => ({ uri: x.im.uri, view: x.g.view })), push);
  const fridge = by('frigo');
  if (fridge.length) await routeList(fridge.map((x) => x.im), 'frigo', push);
  const receipt = by('scontrino');
  if (receipt.length) await routeList(receipt.map((x) => x.im), 'scontrino', push);
  const plate = by('piatto');
  for (const x of plate) await routeMeal(x.im, push);
  if (others.length) push(t('{0} foto non sapevo dove metterle: le ho salvate in LifeDrive. Se vuoi che le guardi, dimmi cosa vuoi sapere.', others.length));
  return { handled: true };
}

/** «Spostala in…»: stesso smistamento, ma deciso dall'utente. */
export async function routeAs(kind: PhotoKind, uris: string[], push: Push): Promise<void> {
  const ims: ExtImage[] = uris.map((uri) => ({ uri, mime: 'image/jpeg' }));
  if (kind === 'corpo') await routeBody(ims.map((x) => ({ uri: x.uri })), push);
  else if (kind === 'frigo' || kind === 'scontrino') await routeList(ims, kind, push);
  else if (kind === 'piatto') for (const x of ims) await routeMeal(x, push);
}

async function routeBody(list: { uri: string; view?: import('@/lib/fitness/bodyCheck').BodySlot }[], push: Push) {
  const bc = useBodyCheck.getState();
  const slots = assignBodySlots(list, bc.photos);
  (Object.keys(slots) as (keyof typeof slots)[]).forEach((s) => bc.setPhoto(s, slots[s]));
  const have = useBodyCheck.getState().photos;
  const miss = missingSlots(have);
  const open: TheiaAction[] = [{ kind: 'open', label: t('Apri il Controllo del corpo'), page: 'fitnessBody' }];
  if (miss.length) {
    push(t('Sono foto del corpo: le ho messe in Controllo del corpo e restano solo sul tuo telefono (non vanno in LifeDrive). Per l\'analisi mi servono tutte e 4: mi mancano {0}.', miss.map((s) => slotName(s)).join(', ')), { ext: { actions: open, card: { icon: 'lifefitness', title: t('Controllo del corpo'), sub: t('{0} foto su 4', BODY_SLOTS.length - miss.length), page: 'fitnessBody' } } });
    return;
  }
  push(t('Sono le 4 foto del corpo: le ho messe in Controllo del corpo (restano solo sul telefono). Le guardo adesso, ci vuole un minuto.'));
  const r = await runBodyAnalysis();
  if (!r.ok) { push(t(r.error), { ext: { actions: open } }); return; }
  push(r.text, { ext: { actions: open, card: { icon: 'lifefitness', title: t('Controllo del corpo'), sub: t('Analisi salvata: la trovi nella pagina'), page: 'fitnessBody' } } });
}

async function routeList(ims: ExtImage[], kind: 'frigo' | 'scontrino', push: Push) {
  for (const x of ims) saveMediaToDrive({ uri: x.uri, media: 'photo', from: kind === 'frigo' ? 'Frigo' : 'Scontrino', ...(kind === 'scontrino' ? { folder: 'Ricevute' } : {}) });
  try {
    const lines = parseReceiptItems(await aiReadFiles(kind === 'frigo' ? FRIDGE_PROMPT : RECEIPT_ITEMS_PROMPT, ims.map((x) => ({ uri: x.uri, mime: x.mime || 'image/jpeg' })), 90000, 1000));
    if (!lines.length) { push(t('Sembra {0} ma non riesco a leggere i prodotti: riprova più da vicino, oppure scrivimi la lista.', kind === 'frigo' ? t('un frigo') : t('uno scontrino'))); return; }
    const unit = (u: string) => (u === 'pz' ? '' : ` ${u}`);
    push(`${kind === 'frigo' ? t('È il tuo frigo: ho letto questi prodotti.') : t('È uno scontrino: ho letto questi prodotti.')}\n\n${lines.slice(0, 40).map((l) => `• ${l.name} · ${money(l.qty)}${unit(l.unit)}`).join('\n')}\n\n${t('Controlla: posso sbagliare nomi e quantità. Li aggiungo al frigo?')}`, {
      ext: { actions: [{ kind: 'pantry-add', label: t('Aggiungi al frigo'), lines }, { kind: 'open', label: t('Apri Frigo e spesa'), page: 'fitnessFridge' }, { kind: 'dismiss', label: t('No, grazie') }] },
    });
  } catch (e) { push(e instanceof AiServerError ? e.message : t('Non sono riuscita a leggere la foto: riprova tra poco.')); }
}

async function routeMeal(im: ExtImage, push: Push) {
  saveMediaToDrive({ uri: im.uri, media: 'photo', from: 'Pasto' });
  try {
    const found = resolveItems(parseMealReply(await aiReadFiles(MEAL_PROMPT, [{ uri: im.uri, mime: im.mime || 'image/jpeg' }], 70000, 1024))).filter((x) => x.food);
    if (!found.length) { push(t('Sembra un piatto ma non riesco a riconoscere gli alimenti: inquadralo più da vicino e con più luce.')); return; }
    const rows = found.map((x) => ({ food: x.food!, g: x.grams }));
    const m = sumMacros(rows.map((r) => macrosFor(r.food, r.g)));
    const items = rows.map((r) => ({ foodId: r.food.id, name: r.food.name, grams: r.g }));
    push(`${t('È un piatto: vedo')} ${rows.map((r) => `${r.food.name} (${r.g} g)`).join(', ')}.\n\n${t('Circa {0} kcal · proteine {1} g · carboidrati {2} g · grassi {3} g. È una stima dalla foto.', m.kcal, Math.round(m.p), Math.round(m.c), Math.round(m.f))}`, {
      ext: { actions: [{ kind: 'meal-save', label: t('Salva nel diario'), items, kcal: m.kcal, foods: rows.map((r) => r.food).filter((f) => f.id.startsWith('ai-')), photo: im.uri }, { kind: 'open', label: t('Apri il diario dei pasti'), page: 'fitnessDiary' }, { kind: 'dismiss', label: t('Non salvare') }] },
    });
  } catch (e) { push(e instanceof AiServerError ? e.message : t('Non sono riuscita a leggere la foto: riprova tra poco.')); }
}

/** Dopo la risposta normale, se si parlava di un argomento: offre di mettere le foto nella sua sezione. */
export function offerFor(kind: PhotoKind, uris: string[]): TheiaAction[] {
  if (kind === 'altro') return [];
  const label = kind === 'corpo' ? t('Mettile in Controllo del corpo') : kind === 'frigo' ? t('Leggi il frigo e aggiungilo alle scorte') : kind === 'scontrino' ? t('Leggi lo scontrino e aggiungilo alle scorte') : t('Salvalo nel diario dei pasti');
  return [{ kind: 'photo-route', label, to: kind, uris }, { kind: 'dismiss', label: t('No, resta qui') }];
}
export { WHERE };
