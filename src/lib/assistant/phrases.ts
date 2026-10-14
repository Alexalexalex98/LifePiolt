/**
 * Frasi di Theia (modulo PURO, nessun alias '@/'): intere frasi di tutti i giorni, ognuna legata a ciò che Theia deve fare.
 * Si confrontano con quello che scrivi per parole significative (senza articoli e preposizioni, tollerando singolare/plurale e coniugazioni),
 * quindi «vorrei ordinare una pizza stasera» combacia con «voglio ordinare una pizza». Vince la frase che copre meglio ciò che hai detto.
 * Per aggiungerne: una riga in PHRASE_SETS, frasi separate da «|». Ogni frase nuova va anche nei test.
 */
import { PHRASE_SETS_MORE } from './phrasesMore.ts';

export type PhraseKind = 'place' | 'cmd' | 'act' | 'page';
export type PhraseSet = {
  id: string; kind: PhraseKind;
  /** place: id della categoria; cmd: comando per l'assistente; act: id dell'azione; page: pagina da aprire */
  target: string;
  /** place: vuole ordinare a domicilio */ order?: boolean;
  phrases: string[];
};

const S = (id: string, kind: PhraseKind, target: string, phrases: string, order?: boolean): PhraseSet => ({ id, kind, target, phrases: phrases.split('|').map((p) => p.trim()).filter(Boolean), ...(order ? { order } : {}) });

const BASE_SETS: PhraseSet[] = [
  /* ---------- cibo ---------- */
  S('pizza-ordina', 'place', 'pizzeria', 'voglio ordinare una pizza|vorrei ordinare una pizza|ordina una pizza|ordinami una pizza|mi ordini una pizza|ordinare una pizza a casa|pizza a domicilio|pizza a casa|portami una pizza|fammi arrivare una pizza|consegna pizza|pizza da asporto|prendiamo una pizza da asporto|ordiniamo delle pizze|ordiniamo la pizza stasera|stasera ordiniamo pizza|due pizze a domicilio|vorrei far consegnare una pizza', true),
  S('pizza-cerca', 'place', 'pizzeria', 'ho voglia di pizza|mi va una pizza|vorrei mangiare una pizza|voglio mangiare la pizza|dove mangio una buona pizza|trovami una pizzeria|cerco una pizzeria|la migliore pizzeria della zona|una pizzeria vicino a me|pizzeria qui vicino|dove si mangia la pizza|consigliami una pizzeria|prenota una pizzeria|prenota un tavolo in pizzeria|andiamo a mangiare la pizza|stasera pizza fuori|pizza napoletana vicino a me|pizzeria con forno a legna'),
  S('sushi', 'place', 'sushi', 'ho voglia di sushi|voglio mangiare sushi|trovami un ristorante giapponese|cerco un sushi vicino|dove mangio un buon sushi|consigliami un sushi|stasera andiamo a mangiare sushi|prenota un tavolo al sushi|vorrei mangiare giapponese|ramen vicino a me'),
  S('sushi-ordina', 'place', 'sushi', 'ordina del sushi|voglio ordinare sushi|sushi a domicilio|ordiniamo sushi stasera|portami del sushi|consegna sushi a casa|vorrei ordinare dei ramen', true),
  S('kebab', 'place', 'kebab', 'ho voglia di un kebab|cerco un kebab|dove mangio un kebab|trovami un kebab aperto|kebab qui vicino|vorrei mangiare un falafel'),
  S('kebab-ordina', 'place', 'kebab', 'ordina un kebab|voglio ordinare un kebab|kebab a domicilio|portami un kebab', true),
  S('burger', 'place', 'hamburger', 'ho voglia di un hamburger|cerco un posto per hamburger|dove mangio un buon burger|voglio mangiare un panino|vorrei mangiare un panino|trovami una paninoteca|fast food vicino a me|un hamburger qui vicino'),
  S('burger-ordina', 'place', 'hamburger', 'ordina un hamburger|voglio ordinare un burger|hamburger a domicilio|ordiniamo dei panini|portami un hamburger', true),
  S('ristorante', 'place', 'ristorante', 'ho fame|ho tanta fame|muoio di fame|dove mangio stasera|dove andiamo a cena|cerco un ristorante|trovami un ristorante|consigliami un ristorante|un buon ristorante qui vicino|ristorante romantico per stasera|ristorante per due|vorrei una cena fuori|andiamo a mangiare fuori|pranzo fuori oggi|dove si mangia bene qui|trattoria tipica vicino a me|ristorante per una cena di lavoro|ristorante per un compleanno|cosa mangio stasera|ho voglia di mangiare fuori'),
  S('ristorante-prenota', 'place', 'ristorante', 'prenota un tavolo|prenotami un tavolo per due|prenota un tavolo per stasera|prenota un ristorante|vorrei prenotare un tavolo per quattro|devo prenotare una cena|tavolo per stasera alle otto|riservami un tavolo|prenota il ristorante per sabato|prenota un tavolo per il compleanno'),
  S('ristorante-ordina', 'place', 'ristorante', 'ordina da mangiare|voglio ordinare da mangiare|cibo a domicilio|ordiniamo qualcosa da mangiare|portami la cena|ordina la cena|mi porti il pranzo|consegna cibo a casa|ordina il pranzo|voglio farmi portare la cena', true),
  S('bar', 'place', 'bar', 'vorrei bere un caffè|voglio prendere un caffè|dove prendo un caffè|cerco un bar|trovami un bar aperto|un bar qui vicino|ho voglia di un cappuccino|dove faccio colazione|vorrei fare colazione fuori|dove faccio un aperitivo|cerco un posto per l aperitivo|andiamo a bere qualcosa|dove bevo una birra|un pub qui vicino|un cocktail bar vicino a me|un enoteca per stasera'),
  S('gelato', 'place', 'gelateria', 'ho voglia di un gelato|voglio mangiare un gelato|dove mangio un gelato|cerco una gelateria|una gelateria qui vicino|trovami una pasticceria|vorrei mangiare un dolce|ho voglia di dolce|dove compro una torta|torta per un compleanno'),
  S('pane', 'place', 'panetteria', 'dove compro il pane|cerco una panetteria|un panificio qui vicino|pane fresco vicino a me|ho voglia di focaccia|forno aperto adesso'),
  S('spesa', 'place', 'supermercato', 'devo fare la spesa|dove faccio la spesa|cerco un supermercato|un supermercato aperto adesso|supermercato qui vicino|dove compro frutta e verdura|cerco una macelleria|negozio di alimentari vicino a me|devo comprare da mangiare|mi serve un supermercato'),
  /* ---------- salute ---------- */
  S('dentista', 'place', 'dentista', 'devo prenotare un dentista|cerco un dentista|trovami un dentista|ho mal di denti|ho un dente che fa male|devo andare dal dentista|mi serve un dentista urgente|il miglior dentista della zona|un dentista qui vicino|vorrei fare una pulizia dei denti|prenota una visita dal dentista|ho bisogno di un igienista dentale|ho una carie|consigliami un dentista'),
  S('medico', 'place', 'medico', 'devo prenotare un medico|cerco un medico|trovami un dottore|mi serve un medico|devo fare una visita medica|ho bisogno di un dottore|devo andare dal medico|il miglior medico qui vicino|prenota una visita|cerco un medico di famiglia|ho bisogno di un dermatologo|mi serve un ortopedico|cerco un cardiologo|devo andare dal ginecologo|ho bisogno di un oculista|cerco un pediatra per mio figlio'),
  S('fisio', 'place', 'fisio', 'cerco un fisioterapista|mi serve un fisioterapista|ho mal di schiena e voglio un fisioterapista|prenota una seduta di fisioterapia|cerco un osteopata|vorrei un massaggio terapeutico|ho bisogno di un massaggiatore|trovami un fisioterapista vicino'),
  S('psico', 'place', 'psico', 'cerco uno psicologo|mi serve uno psicologo|vorrei parlare con uno psicologo|trovami uno psicoterapeuta|ho bisogno di un terapeuta|prenota una seduta di psicoterapia|cerco una psicologa|consigliami uno psicologo'),
  S('farmacia', 'place', 'farmacia', 'cerco una farmacia|dov è la farmacia più vicina|farmacia di turno|una farmacia aperta adesso|mi servono delle medicine|devo comprare una medicina|ho bisogno di una farmacia|trovami una farmacia aperta|farmacia aperta di notte|dove compro un medicinale'),
  S('ospedale', 'place', 'ospedale', 'dov è il pronto soccorso|cerco un pronto soccorso|ho bisogno di un ospedale|devo andare in ospedale|cerco una clinica|ambulatorio vicino a me|mi sento male e voglio un ospedale|pronto soccorso più vicino'),
  S('vet', 'place', 'veterinario', 'cerco un veterinario|il mio cane sta male|il mio gatto sta male|devo portare il cane dal veterinario|mi serve un veterinario|trovami un veterinario|prenota una visita veterinaria|veterinario aperto adesso'),
  S('ottico', 'place', 'ottico', 'cerco un ottico|devo fare gli occhiali|mi servono nuovi occhiali|dove compro le lenti a contatto|ottico qui vicino'),
  /* ---------- bellezza ---------- */
  S('parrucchiere', 'place', 'parrucchiere', 'devo tagliarmi i capelli|cerco un parrucchiere|trovami un parrucchiere|prenota il parrucchiere|vorrei un taglio di capelli|mi serve un barbiere|devo farmi la barba|voglio cambiare colore ai capelli|prenota un taglio di capelli|un buon parrucchiere vicino a me|barbiere qui vicino|prenota un taglio per sabato|ho bisogno di una piega|cerco una parrucchiera'),
  S('estetista', 'place', 'estetista', 'cerco un estetista|voglio fare la manicure|devo fare le unghie|prenota un massaggio|cerco un centro benessere|voglio andare alla spa|devo fare la ceretta|trovami un centro estetico|prenota la pedicure|vorrei un massaggio rilassante'),
  S('tatuaggio', 'place', 'tatuatore', 'voglio farmi un tatuaggio|cerco un tatuatore|trovami uno studio di tatuaggi|vorrei fare un piercing|prenota un tatuaggio'),
  /* ---------- casa e servizi ---------- */
  S('idraulico', 'place', 'idraulico', 'mi serve un idraulico|cerco un idraulico|trovami un idraulico urgente|ho una perdita d acqua|il rubinetto perde|lo scarico è intasato|il lavandino è otturato|si è rotta la caldaia|ho il bagno allagato|idraulico disponibile subito'),
  S('elettricista', 'place', 'elettricista', 'mi serve un elettricista|cerco un elettricista|è saltata la corrente|è saltato il salvavita|ho un problema elettrico|una presa non funziona|trovami un elettricista urgente|devo cambiare le luci di casa'),
  S('meccanico', 'place', 'meccanico', 'mi serve un meccanico|cerco un meccanico|la macchina non parte|devo fare il tagliando|devo cambiare le gomme|cerco un gommista|devo fare la revisione dell auto|ho una gomma bucata|trovami un officina|la macchina fa un rumore strano|devo portare l auto in officina|cerco un carrozziere'),
  S('lavanderia', 'place', 'lavanderia', 'cerco una lavanderia|devo portare i vestiti in lavanderia|una tintoria qui vicino|dove lavo un piumone|devo lavare a secco una giacca|lavanderia aperta adesso'),
  S('trasloco', 'place', 'traslochi', 'devo fare un trasloco|cerco una ditta di traslochi|mi serve un facchino|devo spostare dei mobili|trovami un servizio di traslochi'),
  S('pulizie', 'place', 'pulizie', 'cerco una donna delle pulizie|mi serve un servizio di pulizie|cerco una ditta di pulizie|devo far pulire casa|pulizie di fine locazione|trovami qualcuno per le pulizie'),
  /* ---------- spostamenti e viaggi ---------- */
  S('taxi', 'place', 'taxi', 'mi serve un taxi|chiama un taxi|devo prendere un taxi|prenota un taxi|cerco un taxi|vorrei un taxi per l aeroporto|taxi per stasera|trovami un taxi|un autista per domani|devo andare in stazione in taxi'),
  S('hotel', 'place', 'hotel', 'devo prenotare un hotel|cerco un hotel|prenota un albergo|trovami un albergo|vorrei prenotare una camera|cerco un bed and breakfast|prenota un b&b|mi serve un posto dove dormire|cerco un alloggio per due notti|un hotel vicino alla stazione|hotel economico a|il miglior hotel a|prenotami una camera doppia|cerco un ostello|voglio dormire in un hotel a|cerco una camera per questo weekend'),
  S('benzina', 'place', 'benzinaio', 'devo fare benzina|cerco un distributore|devo fare il pieno|dov è il benzinaio più vicino|distributore di benzina aperto|serve la benzina|cerco una colonnina di ricarica|dove ricarico l auto elettrica|distributore diesel qui vicino|ho finito la benzina'),
  S('parcheggio', 'place', 'parcheggio', 'cerco un parcheggio|dove parcheggio|un parcheggio vicino a me|trovami un posteggio|parcheggio vicino alla stazione|devo parcheggiare in centro'),
  S('noleggio', 'place', 'noleggio', 'devo noleggiare un auto|cerco un noleggio auto|mi serve un auto a noleggio|voglio affittare una macchina|noleggio furgone vicino a me|noleggio auto in aeroporto'),
  /* ---------- tempo libero e acquisti ---------- */
  S('cinema', 'place', 'cinema', 'voglio andare al cinema|cerco un cinema|che film fanno stasera|cinema vicino a me|vorrei vedere uno spettacolo|cerco un teatro|dove c è un concerto|cosa fare stasera in città|programma del cinema'),
  S('palestra', 'place', 'palestra', 'cerco una palestra|voglio iscrivermi in palestra|devo fare un abbonamento in palestra|cerco un personal trainer|voglio fare yoga|cerco un corso di pilates|trovami una piscina|palestra vicino a me|voglio andare a nuotare|cerco un corso di danza'),
  S('museo', 'place', 'museo', 'voglio andare al museo|cerco un museo|dove c è una mostra|vorrei una visita guidata|musei aperti oggi|trovami una galleria d arte'),
  S('negozio', 'place', 'negozio', 'cerco un negozio di scarpe|dove compro dei vestiti|cerco un fioraio|devo comprare dei fiori|mi serve un regalo|cerco una libreria|dove compro un telefono|cerco una ferramenta|devo comprare un regalo di compleanno|negozio di abbigliamento vicino a me'),
  S('banca', 'place', 'banca', 'cerco un bancomat|devo prelevare dei contanti|dov è la banca più vicina|una banca qui vicino|sportello bancomat vicino a me|devo andare in banca'),
  S('posta', 'place', 'posta', 'cerco un ufficio postale|devo spedire un pacco|devo mandare una raccomandata|dov è la posta|posta aperta adesso|devo ritirare un pacco alla posta'),
  /* ---------- soldi ---------- */
  S('fin-analisi', 'cmd', 'Analisi delle mie finanze', 'analizza le mie finanze|come vanno le mie finanze|come sto messo con i soldi|come sono messo economicamente|fammi un riepilogo dei soldi|fai il punto sulle spese|com è il mio bilancio|quanto ho speso questo mese|quanto spendo al mese|dove spendo di più|a cosa spendo più soldi|quanto ho risparmiato|quanto sono riuscito a risparmiare|ho speso troppo questo mese|sto spendendo troppi soldi|come posso risparmiare|dammi un consiglio per risparmiare|voglio risparmiare più soldi|come sto con il budget|sono dentro il budget|quanto mi resta questo mese|quanto posso spendere|riepilogo spese del mese|analisi delle spese|quanto ho sul conto'),
  S('fin-spesa', 'act', 'finance-add', 'ho speso 12 franchi al supermercato|ho speso 20 franchi per la cena|ho pagato 50 franchi di benzina|segna una spesa di 15 franchi|registra una spesa|aggiungi una spesa di 30 franchi|ho comprato una cosa da 40 franchi|ho speso soldi per il pranzo'),
  S('lp-saldo', 'cmd', 'Quanti LifePoints ho?', 'quanti lifepoints ho|quanti lp ho|qual è il mio saldo lifepoints|il mio saldo lifepoints|quanti punti ho|voglio vedere i miei lifepoints|quanti lifepoint mi restano|controlla il saldo lifepoints|mostrami il saldo lp|quanti lp posso ritirare|quanti lifepoints sono bloccati'),
  S('lp-invia', 'act', 'sendlp', 'invia 10 lifepoints a giulia|manda 20 lp a marco|voglio inviare lifepoints a una persona|dai 5 lp a sophie|pago 30 lp a elena|trasferisci 15 lifepoints a tommaso|vorrei mandare dei lifepoints a un amico|invia lifepoints|devo pagare una persona in lifepoints|paga 25 lp a federica|regala 10 lifepoints a luca|manda dei lifepoints|voglio donare lifepoints|invia 50 lp'),
  /* ---------- salute e umore ---------- */
  S('salute', 'cmd', 'Come sto di salute?', 'come sto di salute|come sto fisicamente|come va la mia salute|come ho dormito|ho dormito bene|quanto ho dormito|quanti passi ho fatto|come sono i miei passi|come va il mio sonno|come va il mio battito|mi sento stanco|mi sento molto stanco|sono sempre stanco|come mi sto allenando|quanti allenamenti ho fatto|riepilogo della mia salute|fammi un riepilogo della salute|ho bevuto abbastanza acqua|come va il mio peso|come sto con il movimento'),
  S('sonno', 'act', 'health-sleep', 'stanotte ho dormito 7 ore|ho dormito 6 ore|ho dormito male stanotte|ieri ho dormito 8 ore|registra il sonno|segna che ho dormito 5 ore|ho dormito poco stanotte'),
  S('umore', 'cmd', 'Come va il mio umore?', 'come va il mio umore|come mi sento|come sto di umore|mi sento giù|mi sento stressato|sono molto stressato oggi|mi sento ansioso|oggi sono di buon umore|analizza il mio umore|perché sono di cattivo umore|come è stato il mio umore questa settimana|mi sento stanco e triste'),
  /* ---------- agenda e task ---------- */
  S('brief', 'cmd', 'Riepilogo della giornata', 'riepilogo della giornata|com è la mia giornata|cosa ho oggi|che programma ho oggi|fammi il briefing|dammi il riepilogo di oggi|cosa c è oggi in agenda|com è la giornata di oggi|come si presenta oggi|dimmi cosa devo fare oggi|che impegni ho oggi|riassumi la mia giornata'),
  S('prog-domani', 'cmd', 'Cosa ho in programma domani?', 'cosa ho in programma domani|che impegni ho domani|cosa faccio domani|che programma ho domani|cosa ho in agenda domani|sono libero domani|ho impegni domani|come è la giornata di domani|cosa ho questa settimana|che impegni ho questa settimana|ho impegni questo weekend|che impegni ho dopodomani'),
  S('adesso', 'cmd', 'Cosa devo fare adesso?', 'cosa devo fare adesso|cosa faccio adesso|cosa è urgente|cosa devo fare per prima cosa|da dove comincio|cosa c è di urgente|quali sono le mie priorità|cosa ho di più importante|aiutami a decidere cosa fare|dimmi cosa fare ora|cosa devo fare subito|quali task sono urgenti|non so cosa fare adesso|cosa ho da fare oggi|dammi una cosa da fare'),
  S('piano-mese', 'cmd', 'Pianifica il mese', 'pianifica il mese|organizza il mio mese|aiutami a pianificare il mese|fai il piano del mese|pianificami il mese|organizza la settimana|pianifica la mia settimana|aiutami a organizzare la settimana|fai un piano per questa settimana|come organizzo il mese'),
  S('piano-add', 'act', 'plan-add', 'aggiungi una riunione domani alle 15|segna un appuntamento domani|ho un appuntamento lunedì alle 10|metti in agenda una riunione|aggiungi un impegno al piano|fissa una riunione per giovedì|inserisci un evento in calendario|devo ricordarmi un appuntamento|aggiungi un evento venerdì alle 18|segna una riunione con il team|aggiungi la visita dal medico martedì'),
  S('piano-sposta', 'act', 'plan-move', 'sposta la riunione a giovedì|sposta l appuntamento a domani|rimanda la riunione|cambia l orario della riunione|riprogramma l impegno|sposta il dentista a venerdì|posso spostare un impegno|devo spostare un appuntamento|anticipa la riunione|sposta tutto di un giorno'),
  S('vacanze', 'act', 'plan-vac', 'segna le vacanze dal 10 al 17 agosto|metti le ferie in agenda|ho le ferie la prossima settimana|segna le ferie dal 3 al 10|sono in vacanza dal 20 luglio|blocca il calendario per le vacanze|segna le mie ferie'),
  S('task-add', 'act', 'task-add', 'aggiungi un task|aggiungi un task chiamare il dentista|ricordami di comprare il latte|crea un task|devo ricordarmi di pagare la bolletta|metti tra le cose da fare|aggiungi alla lista delle cose da fare|nuova cosa da fare|segna da fare|ricordami di chiamare la mamma|aggiungi un promemoria|ricordami di prenotare il dentista'),
  S('task-done', 'act', 'task-done', 'segna fatto chiamare il dentista|ho finito il task|ho completato la cosa da fare|task completato|segna come fatto|ho fatto quello che dovevo|ho già fatto il task|spunta il task|segna completato'),
  S('nota', 'act', 'note-add', 'scrivi una nota|nota idee per il weekend|prendi una nota|appunta questa cosa|aggiungi una nota|salva una nota|annota questa idea|crea una nota|scrivi un appunto'),
  /* ---------- rete e persone ---------- */
  S('post', 'act', 'post', 'pubblica un post|voglio pubblicare un post|scrivi un post sul mio profilo|crea un post|fai un post|vorrei condividere un post|pubblica questo sul mio profilo|metti un post su lifenetwork|voglio scrivere un post|condividi un pensiero|pubblica un nuovo post|scrivi un post oggi ho fatto una corsa'),
  S('community', 'act', 'community', 'crea una community|voglio creare una community|apri una community|vorrei fare una community|nuova community|crea una community per i corridori|crea un gruppo pubblico|apri una community sulla cucina'),
  S('lifeclub', 'act', 'lifeclub', 'crea un lifeclub|voglio creare un lifeclub|voglio avviare un lifeclub|vorrei lanciare un lifeclub|nuovo lifeclub|crea il mio lifeclub|voglio fare un corso a pagamento|creo un club per i miei corsi|fondo un club di cucina'),
  S('segui', 'act', 'follow', 'segui giulia|voglio seguire marco|inizia a seguire sophie|seguimi elena|voglio seguire questa persona|segui tommaso|vorrei seguire un amico|inizia a seguire federica'),
  S('scrivi', 'act', 'message', 'scrivi a giulia ci vediamo alle 18|manda un messaggio a marco|invia un messaggio a sophie|scrivi a elena che arrivo tardi|dì a tommaso che ho finito|manda un messaggio|scrivi un messaggio a una persona|scrivi a federica|messaggia luca|manda un messaggio ad anna ciao'),
  S('rete-apri', 'page', 'lifenetwork', 'apri lifenetwork|vai su lifenetwork|mostrami lifenetwork|voglio vedere i post|fammi vedere il feed|cosa c è di nuovo su lifenetwork|apri il feed|vai alla rete|voglio vedere i post degli amici|apri la home di lifenetwork'),
  S('servizi-miei', 'page', 'myServices', 'apri i miei servizi|mostrami i servizi prenotati|voglio vedere i miei servizi|i miei servizi prenotati|quali servizi ho prenotato|apri i tuoi servizi|vai ai miei servizi|le mie prenotazioni di servizi'),
  S('club-miei', 'page', 'myClubs', 'apri i miei lifeclub|mostrami i miei club|voglio vedere i miei lifeclub|a quali lifeclub sono iscritto|apri i tuoi lifeclub|vai ai miei club|mostra i miei club'),
  /* ---------- pagine e aiuto ---------- */
  S('viaggi', 'page', 'lifetravel', 'apri i viaggi|voglio organizzare un viaggio|mostrami i viaggi|pianifica un viaggio|apri lifetravel|cerco un volo|voglio vedere i voli|devo organizzare una vacanza|aiutami con il viaggio|pianifica una vacanza|dove posso andare in vacanza|idee per un weekend fuori'),
  S('finanze-pag', 'page', 'lifefinance', 'apri le finanze|vai alle finanze|mostrami le finanze|apri lifefinance|voglio vedere le mie spese|fammi vedere le spese|apri il budget|voglio vedere il budget|apri gli investimenti|mostrami il portafoglio'),
  S('fitness-pag', 'page', 'lifefitness', 'mostrami gli allenamenti|apri il personal trainer|apri i programmi di allenamento|voglio fare un allenamento|programma di allenamento|apri la sezione fitness|dove sono gli allenamenti'),
  S('calorie', 'page', 'fitnessMeal', 'voglio contare le calorie|apri il diario delle calorie|quante calorie ha il mio pasto|calcola le calorie di un piatto|aggiungi un pasto al diario|apri pasti e calorie'),
  S('salute-pag', 'page', 'lifehealth', 'apri la salute|vai alla salute|mostrami la salute|apri lifehealth|fammi vedere i miei dati di salute|apri gli allenamenti|voglio vedere il sonno'),
  S('piano-pag', 'page', 'plan', 'apri il piano|apri l agenda|apri il calendario|vai al piano|mostrami il calendario|fammi vedere l agenda|voglio vedere il calendario|apri il plan|mostrami la settimana'),
  S('task-pag', 'page', 'lifetask', 'apri i task|mostrami i task|voglio vedere le cose da fare|apri la lista dei task|vai ai task|fammi vedere i task|apri lifetask|le mie cose da fare'),
  S('note-pag', 'page', 'lifenotes', 'apri le note|mostrami le note|voglio vedere i miei appunti|vai alle note|apri lifenotes|fammi vedere le note|dove sono i miei appunti'),
  S('drive-pag', 'page', 'lifedrive', 'apri lifedrive|mostrami i documenti|voglio vedere i miei file|vai ai documenti|apri i miei file|dove sono i miei documenti|apri il drive|fammi vedere le foto|dove sono le mie foto'),
  S('lp-pag', 'page', 'lifepointsPage', 'apri lifepoints|vai ai lifepoints|mostrami i lifepoints|apri il portafoglio lifepoints|voglio vedere il rendiconto lifepoints|apri il rendiconto|voglio ritirare i lifepoints|come ritiro i lifepoints'),
  S('impostazioni', 'page', 'settings', 'apri le impostazioni|vai alle impostazioni|voglio cambiare le impostazioni|cambia la lingua|come cambio la lingua|voglio cambiare le notifiche|apri le notifiche impostazioni|voglio cambiare il tema|attiva la modalità scura|cambia il tema|come cambio il tema'),
  S('notifiche', 'page', 'notifications', 'apri le notifiche|mostrami le notifiche|ho nuove notifiche|cosa mi è arrivato|vai alle notifiche|fammi vedere le notifiche|ho notifiche non lette'),
  S('aiuto', 'cmd', 'Cosa sai fare?', 'cosa sai fare|ho bisogno di aiuto|come funziona theia|che funzioni hai|cosa puoi fare per me|come ti uso|dammi qualche esempio|cosa posso chiederti|come funziona l app|che cosa fai|non so cosa chiederti|quali comandi conosci|mostrami cosa sai fare'),
  S('aiuto-lp', 'cmd', 'A cosa serve il LifePoint giornaliero?', 'a cosa serve il lifepoint giornaliero|come funziona il lifepoint giornaliero|cos è il lifepoint di oggi|cosa sono i lifepoints|come si guadagnano i lifepoints|come funzionano i lifepoints|a cosa servono i lifepoints|come guadagno lifepoints'),
  S('aiuto-qr', 'cmd', 'Come pago con il QR?', 'come pago con il qr|come si paga con il qr|come funziona il pagamento qr|come pago una persona|come invio lifepoints|come si pagano i servizi|come pago in lifepoints|come si usa il qr'),
  S('aiuto-rec', 'cmd', 'Come funzionano le recensioni?', 'come funzionano le recensioni|come si calcola il voto|come funziona il voto complessivo|come si vota|come posso dare un voto|come funzionano le stelle|come si valuta un seminario'),
  S('profilo-priv', 'cmd', 'Rendi privato il mio profilo', 'rendi privato il mio profilo|voglio un profilo privato|nascondi il mio profilo|rendi il profilo privato|voglio maggiore privacy|come rendo privato il profilo|metti il profilo in privato'),
  S('foto-profilo', 'cmd', 'Cambia la foto del profilo', 'cambia la foto del profilo|voglio cambiare la foto profilo|metti una nuova foto profilo|cambia la mia foto|aggiorna la foto del profilo|come cambio la foto profilo'),
];

/** Tutte le frasi: la raccolta di base più la seconda (phrasesMore.ts). */
export const PHRASE_SETS: PhraseSet[] = [...BASE_SETS, ...PHRASE_SETS_MORE];

/* ---------- confronto ---------- */
const STOP = new Set('il lo la i gli le un uno una un di a da in con su per tra fra e o ma che mi ti ci vi si ne non al allo alla ai agli alle dal dallo dalla dai dagli dalle del dello della dei degli delle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle col mio mia miei mie tuo tua suo sua questo questa quello quella quel è e sono sto stai sta c l d un po più piu anche poi molto tanto troppo proprio magari vorrei volevo voglio vuoi vuole'.split(' '));
// «voglio/vorrei» sono in STOP: da soli non distinguono nulla; contano le parole che li seguono.

/** Nomi di persona usati come esempio nelle frasi: valgono come «una persona qualsiasi». */
const NAMES = new Set(['giulia', 'marco', 'sophie', 'elena', 'tommaso', 'federica', 'luca', 'anna', 'sara', 'paolo']);
export const normText = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9&\s]/g, ' ').replace(/\s+/g, ' ').trim();
/** Parole significative: senza articoli e preposizioni, con le coniugazioni ridotte alla radice (primi 6 caratteri). */
export function contentTokens(s: string, people: string[] = []): string[] {
  const known = people.length ? new Set(people.map((p) => normText(p).split(' ')[0])) : null;
  return normText(s).split(' ').filter((w) => w && !STOP.has(w) && (w.length > 1 || /\d/.test(w))).map((w) => (/^\d+$/.test(w) ? '#' : NAMES.has(w) || known?.has(w) ? '@' : w.length > 6 ? w.slice(0, 6) : w));
}
const same = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

export type PhraseHit = { set: PhraseSet; phrase: string; score: number };
/** Quanto una frase copre ciò che hai scritto (0-1): conta di più la copertura della frase, un poco la precisione. */
export function scorePhrase(userTokens: string[], phrase: string): number {
  const pt = contentTokens(phrase);
  if (pt.length < 2 || !userTokens.length) return 0;
  const used = new Set<number>();
  let matched = 0;
  for (const p of pt) {
    const i = userTokens.findIndex((u, k) => !used.has(k) && same(p, u));
    if (i >= 0) { used.add(i); matched++; }
  }
  const coverage = matched / pt.length, precision = matched / userTokens.length;
  // ciò che hai detto è tutto dentro la frase: bastano due parole sicure anche se la frase ne ha altre
  const inside = precision === 1 && matched >= 2 && coverage >= 0.5;
  if (coverage < 0.75 && !inside) return 0;
  const base = coverage * 0.75 + precision * 0.25;
  return Math.round((inside && base < 0.8 ? 0.8 + coverage * 0.1 : base) * 1000) / 1000;
}

const MIN_SCORE = 0.8;
/** La frase che combacia meglio con ciò che hai detto (null = nessuna abbastanza sicura). */
export function matchPhrase(text: string, people: string[] = []): PhraseHit | null {
  const ut = contentTokens(text, people);
  if (ut.length < 2) return null;
  let best: PhraseHit | null = null;
  for (const set of PHRASE_SETS) for (const phrase of set.phrases) {
    const score = scorePhrase(ut, phrase);
    if (score < MIN_SCORE) continue;
    const longer = best && Math.abs(score - best.score) < 1e-9 && contentTokens(phrase).length > contentTokens(best.phrase).length;
    if (!best || score > best.score || longer) best = { set, phrase, score };
  }
  return best;
}
export const PHRASE_COUNT = PHRASE_SETS.reduce((n, s) => n + s.phrases.length, 0);
