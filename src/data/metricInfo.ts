/**
 * Spiegazione di ogni dato della Dashboard: cos'è, perché conta, qual è il valore ottimale,
 * cosa comporta se è fuori range e come migliorarlo. Valori di riferimento generali per adulti:
 * non sono una diagnosi. Per sintomi o valori anomali persistenti serve un medico.
 */
export type MetricInfo = {
  what: string;
  why: string;
  /** testo breve da mostrare sempre accanto al dato */
  optimal: string;
  /** perché l'ottimale è quello (fonte/ragionamento in una riga) */
  basis: string;
  /** cosa comporta stare sotto / sopra l'ottimale */
  low?: string;
  high?: string;
  /** come migliorare (se il dato non è buono) */
  improve: string[];
  /** come mantenerlo (se è buono) */
  keep: string;
  caution?: string;
};

export const metricInfo: Record<string, MetricInfo> = {
  sleep: {
    what: 'Le ore che dormi ogni notte, ricavate da Apple Health / Apple Watch o inserite a mano.',
    why: 'Il sonno è quando il corpo recupera e il cervello consolida ciò che hai imparato. Muove quasi tutte le altre metriche: stress, HRV, umore, concentrazione.',
    optimal: '7–9 ore a notte', basis: 'Intervallo raccomandato per gli adulti dalle principali società del sonno.',
    low: 'Sotto le 7 ore: più stanchezza, meno concentrazione, umore più basso, recupero muscolare peggiore, più fame e voglia di zuccheri. Se dura settimane pesa anche su difese immunitarie e cuore.',
    high: 'Oltre le 9 ore in modo costante può indicare sonno poco efficace, stanchezza accumulata o altri fattori: se ti senti stanco comunque, parlane con un medico.',
    improve: ['Vai a letto e svegliati alla stessa ora, anche nel weekend.', 'Niente schermi e luci forti nell’ultima ora prima di dormire.', 'Caffeina solo la mattina; cena leggera almeno 2–3 ore prima.', 'Camera fresca (17–19 °C), buia e silenziosa.', 'Se manca tempo: anticipa di 15 minuti l’orario di letto ogni sera finché raggiungi le 7 ore.'],
    keep: 'Stai dormendo bene: mantieni orari regolari, sono la cosa che conta di più.',
  },
  steps: {
    what: 'Il numero di passi che fai in un giorno, contati dal telefono o dall’orologio.',
    why: 'È il modo più semplice di misurare quanto ti muovi nella vita di tutti i giorni, fuori dall’allenamento. Più movimento = meno rischio cardiovascolare, più energia, umore migliore.',
    optimal: '8’000–10’000 passi al giorno', basis: 'I benefici maggiori si vedono fino a circa 8–10 mila passi; oltre, il vantaggio cresce molto più lentamente.',
    low: 'Sotto i 5’000 passi sei in una fascia sedentaria: sale il rischio di problemi di cuore, metabolismo e schiena, e scende l’energia.',
    improve: ['Una camminata di 10 minuti dopo ogni pasto vale ~3’000 passi.', 'Scendi una fermata prima o parcheggia più lontano.', 'Telefonate in piedi o camminando.', 'Scale al posto dell’ascensore.', 'Se oggi sei sotto, sposta un impegno a piedi invece che in auto.'],
    keep: 'Ottimo livello di movimento quotidiano: tienilo anche nei giorni pieni.',
  },
  hr: {
    what: 'Il battito del cuore quando sei a riposo (bpm), misurato dall’orologio.',
    why: 'Un cuore più allenato batte più lentamente per fare lo stesso lavoro. Se sale rispetto al tuo solito, spesso è un segnale di stress, poco sonno, malattia in arrivo o allenamento eccessivo.',
    optimal: '50–70 bpm (meglio se stabile o in calo)', basis: 'Fascia tipica per adulti in buona forma; ciò che conta di più è il confronto con il tuo valore abituale.',
    high: 'Sopra i 80 bpm a riposo in modo costante, o +5–10 bpm rispetto al tuo solito, indica meno recupero o più stress e va tenuto d’occhio.',
    low: 'Sotto i 50 bpm è normale in chi si allena molto. Se hai anche vertigini, svenimenti o affanno, parlane con un medico.',
    improve: ['Dormi 7–9 ore: è l’intervento che lo abbassa di più.', 'Movimento aerobico regolare (camminata veloce, bici, corsa leggera) 3–4 volte a settimana.', 'Riduci alcol e caffeina, soprattutto la sera.', 'Idratati e gestisci lo stress con respirazione lenta.'],
    keep: 'Battito a riposo nella fascia buona: segno di buon recupero.',
    caution: 'Valore indicativo, non diagnostico. Se è molto alto o hai sintomi, consulta un medico.',
  },
  hrv: {
    what: 'La variabilità tra un battito e l’altro (HRV, in millisecondi). Più è alta, più il tuo sistema nervoso è flessibile e recuperato.',
    why: 'È uno dei segnali più sensibili di recupero e stress. Cala con poco sonno, stress, alcol, malattia; sale con riposo e allenamento ben dosato.',
    optimal: 'Il più alto possibile rispetto al TUO solito', basis: 'L’HRV è molto personale (età, genetica): non esiste un valore valido per tutti. Si legge confrontando con la tua media e il tuo trend.',
    low: 'Se è in calo rispetto al tuo solito per più giorni: il corpo non sta recuperando abbastanza. Meglio riposo e allenamenti leggeri.',
    improve: ['Priorità al sonno regolare.', 'Allenamento alternato a giorni di recupero.', 'Niente alcol la sera (abbassa l’HRV di molto).', 'Respirazione lenta o mindfulness 5–10 minuti al giorno.', 'Mangia a orari regolari e non troppo tardi.'],
    keep: 'HRV in linea o sopra il tuo solito: il recupero sta funzionando.',
    caution: 'Confronta solo con te stesso, non con altre persone.',
  },
  weight: {
    what: 'Il tuo peso in chilogrammi.',
    why: 'Da solo non dice se stai bene: conta la direzione rispetto al tuo obiettivo e la stabilità. Oscillazioni giornaliere di 1–2 kg sono normali (acqua, cibo).',
    optimal: 'Stabile, in direzione del tuo obiettivo', basis: 'Un peso “ideale” unico non esiste: dipende da altezza, massa muscolare, età. Una variazione sana è di 0,25–0,5 kg a settimana.',
    high: 'Una salita rapida e continua (oltre 1 kg a settimana) è quasi sempre ritenzione o eccesso calorico.',
    low: 'Una perdita rapida non voluta merita attenzione e un parere medico.',
    improve: ['Pesati sempre alla stessa ora (mattina, dopo il bagno) e guarda la media di 7 giorni, non il singolo giorno.', 'Cambiamenti piccoli e costanti battono le diete drastiche.', 'Proteine a ogni pasto, sonno sufficiente, passi quotidiani.'],
    keep: 'Peso stabile: continua con le abitudini che hai.',
  },
  energy: {
    what: 'Le calorie bruciate col movimento attivo (esclusa la spesa a riposo), da Apple Health.',
    why: 'Misura quanta attività fisica hai fatto davvero in un giorno, includendo camminate e allenamenti.',
    optimal: '300–600 kcal attive al giorno', basis: 'È la fascia tipica di chi si muove regolarmente; l’obiettivo di partenza in LifePilot è 400.',
    low: 'Sotto 200 kcal attive indica una giornata molto sedentaria.',
    improve: ['Aggiungi 20–30 minuti di camminata veloce.', 'Alza l’intensità solo di una parte dell’allenamento (intervalli brevi).', 'Più movimento “nascosto”: scale, commissioni a piedi.'],
    keep: 'Buon livello di attività: mantienilo costante.',
  },
  exercise: {
    what: 'I minuti di esercizio che l’orologio ha riconosciuto come movimento di intensità almeno moderata.',
    why: 'L’attività moderata regolare è tra le abitudini con più effetto su cuore, umore, sonno e longevità.',
    optimal: 'Almeno 30 minuti al giorno (150 a settimana)', basis: 'Raccomandazione dell’Organizzazione Mondiale della Sanità per gli adulti.',
    low: 'Sotto 150 minuti a settimana il beneficio per cuore e metabolismo è molto più basso.',
    improve: ['Spezza in blocchi da 10 minuti: contano uguale.', 'Fissa gli allenamenti nel Piano come impegni veri.', 'Scegli un’attività che ti piace (camminata, bici, nuoto, danza).', 'Inizia con 15 minuti e aumenta di 5 ogni settimana.'],
    keep: 'Stai rispettando la raccomandazione: ottimo.',
  },
  vo2: {
    what: 'Il VO₂ max stimato: quanto ossigeno riesce a usare il tuo corpo durante uno sforzo (ml/kg/min). Misura la forma fisica cardio.',
    why: 'È uno dei migliori indicatori di salute e longevità: più è alto, minore è il rischio cardiovascolare.',
    optimal: 'Dipende da età e sesso: per un adulto 35–50 ml/kg/min è buono', basis: 'Le tabelle di riferimento variano molto con età e sesso; conta soprattutto che salga nel tempo.',
    low: 'Un valore basso per la tua età indica forma cardio da migliorare e rischio cardiovascolare più alto.',
    improve: ['2 sedute a settimana di intervalli (es. 4 × 4 minuti sforzo forte, 3 di recupero).', '3 sedute di cardio facile (conversazione possibile).', 'Costanza per 8–12 settimane: cambia lentamente.'],
    keep: 'Forma cardio buona: continua ad alternare sedute facili e intense.',
    caution: 'È una stima dell’orologio, indicativa.',
  },
  spo2: {
    what: 'La saturazione di ossigeno nel sangue (%).',
    why: 'Indica quanto ossigeno arriva ai tessuti. Nei sani è molto stabile.',
    optimal: '95–100%', basis: 'Intervallo normale a riposo, a livello del mare.',
    low: 'Valori persistenti sotto il 92% o con affanno richiedono un controllo medico. Letture singole basse possono essere solo un errore del sensore (mani fredde, movimento).',
    improve: ['Rimisura da fermo, mani calde, orologio aderente.', 'Se i valori bassi si ripetono o hai sintomi, parlane con un medico.'],
    keep: 'Saturazione nella norma.',
    caution: 'Il sensore dell’orologio non è un dispositivo medico.',
  },
  stress: {
    what: 'Una stima (0–100) dello stress, ricavata da HRV e battito a riposo rispetto al tuo solito. Non è una misura medica.',
    why: 'Stress alto e prolungato peggiora sonno, umore, concentrazione, difese immunitarie e recupero.',
    optimal: 'Sotto 45 (più basso = meglio)', basis: 'Soglia di riferimento di LifePilot sulla stima: sotto 45 significa recupero adeguato.',
    high: 'Sopra 60 per più giorni: il corpo è sotto pressione. Rischio di stanchezza, irritabilità, sonno disturbato.',
    improve: ['Una pausa fissa di 5 minuti a metà giornata (respirazione lenta: 4 secondi dentro, 6 fuori).', 'Camminata all’aperto di 15 minuti.', 'Riduci caffeina nel pomeriggio e alcol la sera.', 'Alleggerisci l’agenda: sposta un impegno non essenziale.', 'Se persiste per settimane, parlane con una persona di fiducia o un professionista.'],
    keep: 'Stress sotto controllo: continua con pause e sonno regolare.',
    caution: 'È una stima, non una diagnosi.',
  },
  mindful: {
    what: 'I minuti di mindfulness / meditazione registrati.',
    why: 'Pochi minuti al giorno abbassano stress e ansia e migliorano la concentrazione se fatti con costanza.',
    optimal: '10 minuti al giorno', basis: 'Dose minima con effetti visibili negli studi; anche 5 minuti sono utili.',
    low: 'Poca pratica non è un problema in sé, ma tendi a gestire lo stress solo “a posteriori”.',
    improve: ['Parti da 3–5 minuti subito dopo il risveglio o prima di dormire.', 'Associa la pratica a una routine (caffè, doccia).', 'Usa la respirazione guidata nell’app Mente.'],
    keep: 'Pratica costante: i benefici si accumulano.',
  },
  mood: {
    what: 'L’umore che registri a mano ogni giorno (1–5).',
    why: 'L’umore riassume come stanno andando sonno, stress, relazioni e lavoro; e i cali ricorrenti vanno notati presto.',
    optimal: '3,5 o più, stabile', basis: 'Soglia di riferimento: sopra 3,5 in media indica una settimana complessivamente positiva.',
    low: 'Sotto 3 per più giorni: guarda sonno, movimento e carico di lavoro; se dura oltre 2 settimane parlane con un professionista.',
    improve: ['Esci all’aperto e muoviti almeno 20 minuti.', 'Contatta una persona che ti fa stare bene.', 'Dormi abbastanza e riduci la sovrastimolazione serale.', 'Scrivi tre cose andate bene oggi.'],
    keep: 'Umore positivo: segnati cosa lo sta sostenendo e ripetilo.',
    caution: 'Non sostituisce un parere professionale: se ti senti molto giù, chiedi aiuto.',
  },
  balance: {
    what: 'Il saldo che ti resta a fine mese: entrate meno uscite, sommato al saldo iniziale.',
    why: 'Dice se stai costruendo margine o stai consumando risorse. Un saldo positivo e crescente è la base di ogni sicurezza finanziaria.',
    optimal: 'Positivo e in crescita; con un cuscinetto di 3–6 mesi di spese', basis: 'Regola classica del fondo di emergenza.',
    low: 'Saldo negativo o in calo: stai spendendo più di quanto entra, e dovrai attingere a risparmi o a debito.',
    improve: ['Individua le 2–3 categorie di spesa che pesano di più e taglia il 10%.', 'Metti in automatico un trasferimento al risparmio appena arriva lo stipendio.', 'Rivedi abbonamenti e spese ricorrenti.'],
    keep: 'Saldo sano: valuta di far crescere il fondo di emergenza o investire l’eccedenza.',
    caution: 'Indicazioni generali, non consulenza finanziaria.',
  },
  savings: {
    what: 'La quota delle entrate che riesci a mettere da parte (%).',
    why: 'È l’indicatore principale di libertà finanziaria: più risparmi, più scelte avrai in futuro.',
    optimal: '20% delle entrate o più', basis: 'Regola del 50/30/20: 50% bisogni, 30% desideri, 20% risparmio.',
    low: 'Sotto il 10% hai poco margine per imprevisti e obiettivi. Tra 10 e 20% sei sulla strada giusta.',
    improve: ['Risparmia prima, spendi dopo: versa subito il 10–20% su un conto a parte.', 'Riduci la categoria in cui spendi di più rispetto al budget.', 'Aumenta di 1 punto percentuale ogni mese.'],
    keep: 'Tasso di risparmio solido: valuta cosa fare con il surplus (fondo di emergenza, obiettivi).',
    caution: 'Indicazioni generali, non consulenza finanziaria.',
  },
  spending: {
    what: 'Il totale delle spese del mese.',
    why: 'Se cresce più delle entrate, il risparmio si riduce. Va letto insieme al budget e alla stagionalità.',
    optimal: 'Entro il budget del mese e sotto le entrate', basis: 'Il budget in LifePilot è calcolato dalle tue entrate e dalle tue abitudini.',
    high: 'Spesa sopra il budget: il saldo e il risparmio ne risentono a fine mese.',
    improve: ['Guarda le categorie in rosso e fissa un limite settimanale.', 'Aspetta 24 ore prima degli acquisti non necessari.', 'Elimina un abbonamento inutilizzato.'],
    keep: 'Spese sotto controllo.',
    caution: 'Indicazioni generali, non consulenza finanziaria.',
  },
  dailyspend: {
    what: 'Quanto spendi ogni giorno, mostrato come media e andamento.',
    why: 'Vedere la spesa giorno per giorno aiuta a scoprire picchi (weekend, acquisti d’impulso) prima che pesino sul mese.',
    optimal: 'Circa il budget mensile diviso 30', basis: 'Una spesa giornaliera costante e prevedibile è più facile da controllare.',
    high: 'Picchi frequenti sopra la media indicano acquisti d’impulso o spese non pianificate.',
    improve: ['Individua i giorni più alti e cosa li ha causati.', 'Pianifica un “giorno senza spese” a settimana.', 'Prepara pranzo e snack invece di comprarli.'],
    keep: 'Spesa regolare: ottimo per prevedere il mese.',
  },
  tasks: {
    what: 'Quanti task completi in media al giorno.',
    why: 'È un indicatore semplice di progresso reale sui tuoi obiettivi: i piccoli passi quotidiani sommati contano più degli sprint.',
    optimal: '2 o più task al giorno', basis: 'Soglia di LifePilot per avanzare in modo costante senza sovraccaricarsi.',
    low: 'Sotto 1 al giorno i tuoi obiettivi rallentano: spesso i task sono troppo grandi.',
    improve: ['Spezza i task grossi in passi da 20–30 minuti (Task Breakdown con Theia).', 'Scegli 3 priorità la sera prima.', 'Fai prima il task più difficile al mattino.'],
    keep: 'Buon ritmo: continua a chiudere piccoli passi ogni giorno.',
  },
};

export const scoreInfo: Record<string, { what: string; optimal: string; improve: string[] }> = {
  total: { what: 'Il Life Score è la media di quattro aree: salute, mente, finanze e crescita. Riassume in un numero come stai andando.', optimal: '80–100 = ottima condizione · 60–79 = buona, con margini · sotto 60 = serve attenzione', improve: ['Guarda l’area più bassa: è dove un piccolo cambiamento fa più differenza.', 'Parti da sonno e movimento: influenzano quasi tutto il resto.'] },
  salute: { what: 'Quanto ti avvicini agli obiettivi di sonno, movimento, battito e recupero.', optimal: '80+ = obiettivi quasi sempre raggiunti', improve: ['Dormi 7–9 ore.', 'Raggiungi 8–10 mila passi.', 'Almeno 30 minuti di esercizio al giorno.'] },
  mente: { what: 'Combina stress stimato, mindfulness e umore.', optimal: '80+ = stress basso, pratica regolare, umore positivo', improve: ['5–10 minuti di respirazione o mindfulness.', 'Pause durante il lavoro.', 'Tempo con persone che ti fanno stare bene.'] },
  finanza: { what: 'Tasso di risparmio, saldo e controllo delle spese rispetto al budget.', optimal: '80+ = risparmio ≥ 20% e spese entro il budget', improve: ['Automatizza il risparmio.', 'Riduci la categoria in cui superi il budget.'] },
  crescita: { what: 'Avanzamento negli obiettivi e task completati.', optimal: '80+ = ritmo costante di task e obiettivi in progresso', improve: ['Spezza gli obiettivi in passi piccoli.', 'Fai avanzare un obiettivo ogni giorno, anche di poco.'] },
};
