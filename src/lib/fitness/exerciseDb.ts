/** Archivio esercizi (modulo PURO): oltre 200 esercizi con attrezzo, muscolo, famiglia di movimento (per la dimostrazione), punti chiave ed errori. */
import { EXERCISES, type Equip, type Exercise, type Muscle } from './data.ts';
import { FAMILIES, type Family } from './poses.ts';

export type ExerciseX = Exercise & { fam?: string; /** creato dall'utente */ custom?: boolean; /** foto di esecuzione scelte dall'utente */ photos?: string[] };

/** Famiglia di movimento degli esercizi storici. */
const OLD_FAM: Record<string, string> = {
  squat: 'squat', affondi: 'lunge', ponte: 'bridge', pushup: 'pushup', plank: 'plank', mountain: 'mountain', jumping: 'jack', burpee: 'burpee', crunch: 'crunch', bird: 'birddog', dips: 'dips', pike: 'downdog', superman: 'superman', wallsit: 'wallsit', cat: 'cat', hip: 'hip9090', stretchq: 'stretchq', child: 'child',
  gsquat: 'squatdb', rdl: 'hinge', press: 'press', row: 'rowbent', curl: 'curl', bandrow: 'rowband', bandpress: 'pressfwd', bandwalk: 'walk', legpress: 'legpress', bench: 'benchpress', lat: 'latpull', squatbar: 'squatbar', deadlift: 'hinge', cable: 'pressfwd', treadmill: 'walk', bike: 'bike', rowerg: 'rowerg', swim: 'swim', aquajog: 'run', run: 'run', walk: 'walk',
};
/** Formato: Nome|muscolo|attrezzo|famiglia|come si fa[|t = a tempo] */
const NEW = `
Squat sumo|gambe|nessuno|squat|Piedi molto larghi, punte aperte, scendi con il busto dritto e le ginocchia verso le punte.
Squat con pausa|gambe|nessuno|squat|Scendi e fermati un secondo in basso, poi risali spingendo sui talloni.
Squat bulgaro|gambe|nessuno|lunge|Piede dietro appoggiato su una sedia, scendi con la gamba davanti e risali. Alterna i lati.
Squat sulla sedia|gambe|nessuno|squat|Scendi fino a sfiorare la sedia con i glutei e risali senza appoggiarti.
Squat a una gamba assistito|gambe|nessuno|squat|Tieniti a un appoggio, scendi su una gamba sola controllando e risali.
Squat saltato|gambe|nessuno|jumpsquat|Scendi in squat e salta in alto, atterra morbido e riparti.
Squat con salto largo|gambe|nessuno|jumpsquat|Scendi e salta in avanti, atterra ammortizzando e torna indietro con un passo.
Squat con manubri|gambe|manubri|squatdb|Manubri ai lati o sulle spalle, scendi con la schiena dritta e risali.
Squat frontale|gambe|palestra|squatbar|Bilanciere sulle spalle davanti, gomiti alti, scendi mantenendo il busto verticale.
Squat al multipower|gambe|palestra|squatbar|Piedi leggermente avanti, scendi in modo controllato e risali con spinta uniforme.
Hack squat|gambe|palestra|legpress|Schiena appoggiata alla macchina, scendi fino a 90 gradi e risali senza bloccare.
Affondo indietro|gambe|nessuno|lunge|Fai un passo indietro e scendi con il ginocchio quasi a terra, poi torna in piedi.
Affondo laterale|gambe|nessuno|lunge|Un passo ampio di lato, siedi sull'anca di quel lato con l'altra gamba distesa.
Affondo camminato|gambe|nessuno|lunge|Affondi in avanti alternati avanzando di un passo a ogni ripetizione.
Affondo con manubri|gambe|manubri|lunge|Un manubrio per mano, affondo avanti con il busto eretto e torna su.
Affondo con salto|gambe|nessuno|lunge|Dal fondo dell'affondo salta e scambia le gambe in aria, atterra morbido.
Step-up su gradino|gambe|nessuno|stepup|Sali su un gradino stabile spingendo con la gamba sopra, poi scendi controllato.
Step-up con manubri|gambe|manubri|stepup|Come lo step-up, con un manubrio per mano. Spingi con la gamba che sale.
Calf raise in piedi|gambe|nessuno|calf|Sali sulle punte il più possibile, pausa in alto, scendi lentamente.
Calf raise con manubri|gambe|manubri|calf|Con un manubrio per mano, sali sulle punte e scendi lentamente.
Calf raise alla macchina|gambe|palestra|calf|Spalle sotto i supporti, spingi sulle punte e scendi fino a sentire l'allungamento.
Leg extension|gambe|palestra|legext|Seduto, estendi le gambe fino a distendere il ginocchio e scendi con calma.
Leg curl sdraiato|gambe|palestra|legcurl|Sdraiato a pancia in giù, porta i talloni verso i glutei e scendi lentamente.
Hack di salita su cassone|gambe|palestra|stepup|Sali su un cassone con una gamba sola, controllando la discesa.
Pistol squat assistito|gambe|nessuno|squat|Scendi su una gamba con l'altra tesa avanti, aiutandoti con una mano a un appoggio.
Sissy squat|gambe|nessuno|squat|Inclinati all'indietro scendendo con le ginocchia in avanti, tenendoti a un appoggio. Per esperti.
Camminata con affondi laterali|gambe|nessuno|lunge|Passi laterali ampi alternando, abbassando il bacino a ogni passo.
Jump lunge laterale|gambe|nessuno|jumpsquat|Salta lateralmente da una gamba all'altra, atterra morbido e controlla.
Ponte glutei a una gamba|glutei|nessuno|bridge|Una gamba tesa in aria, solleva il bacino spingendo con l'altro tallone.
Ponte con pausa|glutei|nessuno|bridge|Solleva il bacino e resta fermo tre secondi in alto stringendo i glutei.
Hip thrust|glutei|nessuno|hipthrust|Spalle su una panca, spingi i talloni e solleva il bacino fino alla linea spalle-ginocchia.
Hip thrust con bilanciere|glutei|palestra|hipthrust|Bilanciere sul bacino con un cuscino, spingi in alto e stringi i glutei.
Hip thrust con manubrio|glutei|manubri|hipthrust|Manubrio sul bacino, spingi in alto stringendo i glutei.
Calcio all'indietro a quattro zampe|glutei|nessuno|kickback|A quattro zampe, stendi una gamba indietro stringendo il gluteo, senza inarcare la schiena.
Calcio ai cavi|glutei|palestra|kickback|Cavigliera al cavo basso, porta la gamba indietro con il busto fermo.
Donkey kick con elastico|glutei|elastico|kickback|Elastico sopra le ginocchia, calcio all'indietro con il ginocchio piegato.
Stacco a gamba tesa|glutei|manubri|hinge|Manubri davanti, piega le anche indietro con la schiena piatta e risali stringendo i glutei.
Stacco rumeno con bilanciere|glutei|palestra|hinge|Bilanciere vicino alle gambe, anche indietro con schiena neutra, risali spingendo le anche avanti.
Stacco a una gamba|glutei|manubri|hinge|Su una gamba, busto in avanti e gamba libera indietro, risali con il gluteo.
Good morning|glutei|palestra|hinge|Bilanciere sulle spalle, piega le anche con la schiena dritta e risali.
Stacco sumo|glutei|palestra|hinge|Piedi larghi e punte aperte, bilanciere tra le gambe, spingi il pavimento e stendi le anche.
Kettlebell swing|glutei|manubri|hinge|Spingi le anche in avanti per far oscillare il peso fino all'altezza del petto. Il movimento parte dalle anche.
Abduzioni con elastico|glutei|elastico|walk|In piedi con l'elastico sopra le ginocchia, apri una gamba di lato in modo controllato.
Camminata mostro|glutei|elastico|walk|Elastico sopra le ginocchia, piccoli passi laterali mantenendo la tensione.
Clamshell|glutei|elastico|bridge|Sdraiato di lato con ginocchia piegate, apri il ginocchio superiore senza muovere il bacino.
Flessioni sulle ginocchia|petto|nessuno|pushupknee|Come la flessione ma sulle ginocchia, corpo in linea dalle ginocchia alla testa.
Flessioni con piedi rialzati|petto|nessuno|pushup|Piedi su una sedia, mani a terra: scendi e spingi. Lavora la parte alta del petto.
Flessioni diamante|braccia|nessuno|pushup|Mani vicine a forma di diamante sotto il petto, gomiti vicini al corpo.
Flessioni larghe|petto|nessuno|pushup|Mani più larghe delle spalle, scendi con il petto fino a sfiorare il pavimento.
Flessioni inclinate|petto|nessuno|pushup|Mani su un rialzo stabile, corpo in linea, scendi con il petto verso il rialzo.
Flessioni con battito|petto|nessuno|pushup|Spingi in modo esplosivo fino a staccare le mani da terra. Solo se sei esperto.
Flessioni arciere|petto|nessuno|pushup|Una mano si allunga di lato mentre l'altra flette il gomito. Alterna.
Panca con manubri|petto|manubri|benchpress|Sdraiato, manubri ai lati del petto, spingi in alto e scendi con controllo.
Panca inclinata con manubri|petto|manubri|benchpress|Panca a 30 gradi, spingi i manubri in alto verso la parte alta del petto.
Panca inclinata con bilanciere|petto|palestra|benchpress|Panca inclinata a 30 gradi, bilanciere al petto alto e spinta verticale.
Panca declinata|petto|palestra|benchpress|Panca declinata, bilanciere al petto basso, spingi in alto senza rimbalzi.
Croci con manubri|petto|manubri|benchpress|Braccia larghe con gomiti morbidi, chiudi come in un abbraccio e torna lentamente.
Croci ai cavi alti|petto|palestra|pressfwd|Cavi in alto, porta le mani davanti al petto in basso con gomiti morbidi.
Chest press alla macchina|petto|palestra|pressfwd|Schiena appoggiata, spingi le maniglie in avanti e torna controllando.
Pec deck|petto|palestra|pressfwd|Gomiti all'altezza delle spalle, chiudi le braccia davanti e torna lentamente.
Pullover con manubrio|petto|manubri|benchpress|Sdraiato, porta il manubrio dietro la testa con braccia quasi tese e richiama sopra il petto.
Dip alle parallele|petto|palestra|dips|Sulle parallele, scendi inclinando il busto in avanti e risali.
Dip tra due sedie|petto|nessuno|dips|Mani su due sedie stabili, scendi controllando e risali.
Spinte con elastico dal petto|petto|elastico|pressfwd|Elastico dietro la schiena, spingi in avanti fino a distendere le braccia.
Svend press|petto|manubri|pressfwd|Premi due dischi o manubri tra le mani e spingi in avanti mantenendo la pressione.
Trazioni alla sbarra|schiena|palestra|pullup|Presa poco più larga delle spalle, porta il mento sopra la sbarra e scendi piano.
Trazioni presa stretta|schiena|palestra|pullup|Presa supina a larghezza spalle, tira finché il mento supera la sbarra.
Trazioni assistite con elastico|schiena|elastico|pullup|Un elastico sotto il piede aiuta la salita: tira fino al mento e scendi lentamente.
Australian pull-up|schiena|nessuno|rowbent|Sotto una sbarra bassa, corpo dritto, tira il petto verso la sbarra.
Lat machine presa larga|schiena|palestra|latpull|Tira la barra al petto con i gomiti verso il basso, risali controllando.
Lat machine presa stretta|schiena|palestra|latpull|Impugnatura stretta, tira al petto con il busto leggermente inclinato indietro.
Tirate al cavo seduto|schiena|palestra|rowerg|Seduto, tira la maniglia verso l'addome stringendo le scapole e torna lentamente.
Rematore con bilanciere|schiena|palestra|rowbent|Busto inclinato, schiena piatta, tira il bilanciere verso l'addome.
Rematore a un braccio|schiena|manubri|rowbent|Appoggio con una mano, tira il manubrio verso l'anca con il gomito vicino.
Rematore alla macchina|schiena|palestra|rowerg|Petto appoggiato, tira le maniglie indietro stringendo le scapole.
Rematore T-bar|schiena|palestra|rowbent|Busto inclinato, tira il peso al petto mantenendo la schiena piatta.
Rematore con elastico|schiena|elastico|rowband|Elastico fissato davanti, tira verso il petto stringendo le scapole.
Face pull|schiena|elastico|rowband|Elastico all'altezza del viso, tira verso la fronte aprendo i gomiti.
Pulldown a braccia tese|schiena|palestra|latpull|Braccia quasi tese, porta la barra dall'alto verso le cosce con il busto fermo.
Estensioni lombari|schiena|nessuno|superman|A pancia in giù solleva il busto con la schiena senza forzare, poi scendi piano.
Superman alternato|schiena|nessuno|superman|A pancia in giù solleva braccio e gamba opposti, alterna lentamente.
Scrollate con manubri|schiena|manubri|shrug|Manubri ai lati, solleva le spalle verso le orecchie, pausa e scendi.
Stacco con trap bar|schiena|palestra|hinge|Dentro la trap bar, schiena neutra, spingi i piedi nel pavimento e stenditi.
Rematore invertito sotto il tavolo|schiena|nessuno|rowbent|Sdraiato sotto un tavolo robusto, tira il petto verso il bordo con il corpo dritto.
Spinte sopra la testa|spalle|manubri|press|Dalle spalle, spingi i manubri in alto senza inarcare la schiena.
Military press|spalle|palestra|press|In piedi, bilanciere dalle spalle in alto con addominali contratti.
Shoulder press alla macchina|spalle|palestra|press|Schiena appoggiata, spingi le maniglie in alto e scendi lentamente.
Arnold press|spalle|manubri|press|Parti con i palmi verso di te, ruota mentre spingi in alto.
Alzate laterali|spalle|manubri|raise|Gomiti appena piegati, solleva i manubri fino all'altezza delle spalle.
Alzate frontali|spalle|manubri|raise|Solleva i manubri davanti a te fino all'altezza delle spalle e scendi piano.
Alzate laterali con elastico|spalle|elastico|raise|Pedana con il piede, solleva l'elastico di lato fino alle spalle.
Alzate a 90 gradi|spalle|manubri|rowbent|Busto inclinato, apri le braccia di lato stringendo le scapole.
Pike push-up|spalle|nessuno|downdog|A V rovesciata, scendi con la testa tra le mani e spingi.
Handstand push-up al muro|spalle|nessuno|pushup|In verticale contro il muro, scendi con la testa e spingi. Solo per esperti.
Upright row|spalle|manubri|curl|Tira i manubri lungo il corpo fino al petto con i gomiti alti.
Rotazioni esterne con elastico|spalle|elastico|curl|Gomito al fianco, ruota l'avambraccio verso l'esterno contro l'elastico.
Curl con bilanciere|braccia|palestra|curl|Bilanciere con presa a larghezza spalle, gomiti fermi, fletti e scendi piano.
Curl a martello|braccia|manubri|curl|Palmi uno verso l'altro, fletti i manubri senza muovere i gomiti.
Curl concentrato|braccia|manubri|curl|Seduto, gomito appoggiato alla coscia, fletti il manubrio lentamente.
Curl con elastico|braccia|elastico|curl|Pedana con i piedi, fletti i gomiti contro la resistenza.
Curl ai cavi|braccia|palestra|curl|Cavo basso, fletti i gomiti mantenendoli fermi ai fianchi.
Curl su panca inclinata|braccia|manubri|curl|Sdraiato su panca inclinata, braccia lungo il corpo, fletti i manubri.
Estensione tricipiti sopra la testa|braccia|manubri|tricepext|Un manubrio con due mani dietro la testa, estendi le braccia in alto.
French press|braccia|palestra|tricepext|Sdraiato, porta il bilanciere verso la fronte piegando i gomiti e spingi in alto.
Pushdown al cavo|braccia|palestra|pushdown|Gomiti fermi ai fianchi, spingi la barra in basso fino a distendere le braccia.
Pushdown con elastico|braccia|elastico|pushdown|Elastico in alto, spingi in basso con i gomiti fermi.
Kickback tricipiti|braccia|manubri|rowbent|Busto inclinato, gomito alto, estendi l'avambraccio all'indietro.
Panca presa stretta|braccia|palestra|benchpress|Presa a larghezza spalle, gomiti vicini al corpo, spingi in alto.
Plank sui gomiti|core|nessuno|plank|Gomiti sotto le spalle, corpo in linea, addominali e glutei contratti.|t
Plank alto|core|nessuno|plank|Sulle mani, braccia tese, corpo in linea retta e respiro regolare.|t
Plank laterale|core|nessuno|plank|Su un gomito, bacino alto e corpo dritto. Cambia lato a metà tempo.|t
Plank con tocco spalla|core|nessuno|plank|In plank alto, tocca alternativamente la spalla opposta senza ruotare il bacino.|t
Hollow hold|core|nessuno|legraise|Sdraiato, solleva spalle e gambe tenendo la schiena bassa a terra.|t
Crunch inverso|core|nessuno|legraise|Sdraiato, porta le ginocchia al petto sollevando il bacino, poi scendi lentamente.
Alzate di gambe|core|nessuno|legraise|Sdraiato, solleva le gambe quasi tese senza staccare la zona lombare.
Alzate di gambe alla sbarra|core|palestra|legraise|Appeso, solleva le gambe o le ginocchia controllando il dondolio.
Sit-up|core|nessuno|situp|Piedi appoggiati, sali con la schiena a rotolo e scendi lentamente.
Crunch bicicletta|core|nessuno|crunch|Gomito verso il ginocchio opposto alternando, con spalle sollevate.
Crunch ai cavi|core|palestra|crunch|In ginocchio, tira le maniglie arrotondando la schiena verso il basso.
Dead bug|core|nessuno|deadbug|Braccio e gamba opposti si allungano lentamente, schiena bassa a terra.
Rotazioni russe|core|nessuno|russian|Seduto inclinato indietro, ruota il busto da un lato all'altro.
Russian twist con peso|core|manubri|russian|Come le rotazioni russe, con un peso tra le mani.
Mountain climber lento|core|nessuno|mountain|Dalla posizione di flessione, porta le ginocchia al petto in modo controllato.|t
Ab wheel|core|palestra|plank|In ginocchio, fai scorrere la ruota in avanti con il corpo teso e torna indietro.
Pallof press|core|elastico|pressfwd|Elastico a lato, spingi le mani avanti e resisti alla rotazione.
Sollevamento del ginocchio in piedi|core|nessuno|run|In piedi, porta il ginocchio al petto alternando, con addome contratto.|t
Bird dog con pausa|core|nessuno|birddog|Estendi braccio e gamba opposti e resta fermo tre secondi.
Burpee|corpo intero|nessuno|burpee|Scendi in flessione, torna in piedi con un salto. Senza salto se serve.
Burpee con flessione|corpo intero|nessuno|burpee|Come il burpee, con una flessione completa in basso.
Thruster con manubri|corpo intero|manubri|squatdb|Squat con manubri alle spalle e spinta sopra la testa in risalita.
Clean con manubri|corpo intero|manubri|hinge|Dal basso, porta i manubri alle spalle con un movimento fluido delle anche.
Kettlebell snatch|corpo intero|manubri|hinge|Dal basso al sopra la testa in un solo movimento esplosivo, controllando l'atterraggio.
Corsa con balzi|corpo intero|nessuno|run|Corsa con balzi ampi in avanti, atterraggio morbido.|t
Skip alto|cardio|nessuno|run|In piedi, porta le ginocchia in alto alternando a ritmo costante.|t
Corsa sul posto|cardio|nessuno|run|Corri sul posto con ginocchia sollevate e braccia che oscillano.|t
Jumping jack|cardio|nessuno|jack|Salta aprendo braccia e gambe, poi richiudi. Ritmo costante.|t
Corda|cardio|nessuno|rope|Salta la corda con piccoli salti sulle punte, polsi che girano.|t
Salti sul posto|cardio|nessuno|jumpsquat|Piccoli salti sulle punte, ammortizzando ogni atterraggio.|t
Shadow boxing|cardio|nessuno|pressfwd|Colpi in aria con rotazione delle anche, spostamento leggero sui piedi.|t
Cyclette intervalli|cardio|palestra|bike|Alterna un minuto veloce a due di ritmo facile.|t
Ellittica|cardio|palestra|walk|Movimento fluido, braccia e gambe in coordinazione, resistenza moderata.|t
Tapis roulant in salita|cardio|palestra|walk|Cammina con pendenza al 5-8 per cento senza tenerti.|t
Scala (macchina)|cardio|palestra|stepup|Sali i gradini a ritmo regolare senza appoggiarti troppo.|t
Corsa lenta|cardio|nessuno|run|Corri a un ritmo in cui riesci a parlare a frasi corte.|t
Corsa a intervalli|cardio|nessuno|run|Alterna 1 minuto veloce e 2 minuti lenti.|t
Camminata in salita|cardio|nessuno|walk|Cammina a passo svelto su un percorso in salita.|t
Nuoto a rana|cardio|piscina|swim|Vasche a rana a ritmo regolare, respirando a ogni bracciata.|t
Nuoto a dorso|cardio|piscina|swim|Vasche a dorso con bracciate ampie e gambe che battono.|t
Gambe con tavoletta|cardio|piscina|swim|Con la tavoletta davanti, solo battuta di gambe.|t
Acquagym|cardio|piscina|jack|Movimenti guidati in acqua alta, a basso impatto.|t
Camminata in acqua|cardio|piscina|walk|In acqua alta, cammina con passi ampi: bassissimo impatto.|t
Cat-cow|mobilità|nessuno|cat|A quattro zampe, inarca e arrotonda la schiena respirando.
Posizione del cobra|mobilità|nessuno|cobra|A pancia in giù, solleva il petto spingendo sulle mani, bacino a terra.|t
Cane a testa in giù|mobilità|nessuno|downdog|Anche in alto, schiena lunga, talloni verso terra.|t
Affondo con apertura|mobilità|nessuno|lungestretch|Passo lungo, bacino basso, ruota il busto verso la gamba davanti.|t
Stretching posteriore coscia|mobilità|nessuno|hamstretch|Gamba distesa su un rialzo, piega le anche con la schiena lunga.|t
Allungamento dei flessori dell'anca|mobilità|nessuno|lungestretch|In ginocchio, spingi il bacino in avanti per allungare il davanti dell'anca.|t
Apertura 90/90 con rotazione|mobilità|nessuno|hip9090|Seduto con le gambe a 90 gradi, ruota da un lato all'altro.
Rotazione toracica|mobilità|nessuno|cat|A quattro zampe, una mano dietro la testa, ruota il busto aprendo il gomito.
Mobilità della caviglia|mobilità|nessuno|lunge|In affondo basso, porta il ginocchio sopra la punta del piede mantenendo il tallone a terra.
Cerchi di braccia|mobilità|nessuno|raise|Braccia aperte, disegna piccoli cerchi che poi allarghi.|t
Rotazione delle anche|mobilità|nessuno|squat|In piedi, disegna cerchi ampi con il bacino in entrambe le direzioni.|t
Stretching spalle|mobilità|nessuno|raise|Porta un braccio disteso davanti al petto e tienilo con l'altro.|t
Stretching collo|mobilità|nessuno|neck|Inclina lentamente la testa di lato con una mano che accompagna, senza tirare.|t
Stretching polpacci al muro|mobilità|nessuno|lungestretch|Mani al muro, gamba dietro tesa con il tallone a terra, spingi in avanti.|t
Squat profondo di mobilità|mobilità|nessuno|squat|Scendi in squat completo tenendo i talloni a terra, gomiti che spingono le ginocchia in fuori.|t
Respirazione diaframmatica|mobilità|nessuno|child|Sdraiato o seduto, respira con la pancia in modo lento e regolare.|t
Alzata dalla sedia|gambe|nessuno|squat|Seduto sul bordo della sedia, piedi larghi come le spalle: spingi sui piedi e alzati senza usare le mani, poi risiediti piano.
Camminata tallone-punta|mobilità|nessuno|walk|Cammina mettendo il tallone di un piede davanti alla punta dell'altro, come su una linea. Tieniti vicino a un appoggio.|t
Equilibrio su una gamba|gambe|nessuno|calf|In piedi vicino a un appoggio, solleva un piede e resta in equilibrio. Cambia gamba a metà tempo.|t
Marcia sul posto|cardio|nessuno|walk|Solleva le ginocchia alternando, a ritmo di camminata, con braccia che oscillano.|t
Spinte al muro|petto|nessuno|pushup|Mani al muro all'altezza del petto, piega i gomiti avvicinando il petto al muro e spingi.
Estensione della gamba da seduto|gambe|nessuno|legext|Seduto, estendi una gamba fino a distenderla e scendi piano. Alterna.
Alzate con bottiglie|spalle|nessuno|raise|Una bottiglia d'acqua per mano, solleva le braccia di lato fino alle spalle.
Cerchi di spalle|mobilità|nessuno|raise|Sciogli le spalle disegnando cerchi lenti avanti e indietro.|t
Ponte assistito|glutei|nessuno|bridge|Sdraiato, piedi a terra, solleva il bacino con le mani ai lati per sicurezza.
Ponte con respirazione|core|nessuno|bridge|Sdraiato, inspira a pancia piena ed espira sollevando il bacino senza forzare.
Contrazione del pavimento pelvico|core|nessuno|bridge|Sdraiato, contrai dolcemente i muscoli del pavimento pelvico per 3 secondi e rilascia, respirando.|t
Retrazione del mento|mobilità|nessuno|neck|Seduto o in piedi, porta il mento indietro come a fare il doppio mento, senza abbassare la testa.|t
Stringi le scapole|schiena|nessuno|rowband|Braccia lungo il corpo, porta le scapole indietro e in basso, senza alzare le spalle.
Angelo al muro|spalle|nessuno|raise|Schiena al muro, braccia piegate a W, sali e scendi facendo scorrere le braccia sul muro.
Estensione della schiena sdraiato|schiena|nessuno|superman|A pancia in giù, solleva solo il petto di pochi centimetri con il collo lungo.
Box jump|gambe|nessuno|jumpsquat|Salta su un rialzo stabile con i piedi uniti, scendi a passo e ripeti.
Salti laterali da pattinatore|gambe|nessuno|jumpsquat|Salta di lato da una gamba all'altra, atterra morbido e resta in equilibrio un attimo.
Scatti sul posto|cardio|nessuno|run|Corri sul posto più veloce che puoi con ginocchia alte per pochi secondi.|t
Affondo con rotazione|gambe|nessuno|lunge|In affondo, ruota il busto verso la gamba davanti e torna al centro.
Taglialegna con elastico|core|elastico|pressfwd|Elastico in alto a un lato, tira in diagonale verso il fianco opposto ruotando il busto.
Lancio della palla medica|corpo intero|palestra|pressfwd|Palla al petto, spingi lontano con tutto il corpo contro un muro e riprendi.
Passi laterali veloci|cardio|nessuno|walk|In posizione bassa, spostati di lato con passi rapidi senza incrociare i piedi.|t
Salto su una gamba|gambe|nessuno|jumpsquat|Piccoli salti su una sola gamba, atterra morbido e controlla il ginocchio. Cambia gamba.|t
Appeso alla sbarra|schiena|palestra|pullup|Appeso a una sbarra con braccia tese e spalle attive, resisti il più possibile.|t
Scapular pull-up|schiena|palestra|pullup|Appeso, senza piegare i gomiti abbassa le scapole per sollevarti di pochi centimetri.
Curl femorale con slider|gambe|nessuno|bridge|Sdraiato, talloni su un asciugamano sul pavimento, fai scivolare i piedi avanti e indietro con il bacino alto.
Nordic curl assistito|gambe|nessuno|legcurl|In ginocchio con i piedi bloccati, scendi in avanti piano trattenendoti con le mani.
Discesa controllata dal gradino|gambe|nessuno|stepup|In piedi su un gradino, abbassa lentamente il tallone dell'altra gamba verso il pavimento e risali.
Passeggiata del contadino|corpo intero|manubri|walk|Un peso per mano, cammina a passo regolare con busto alto e spalle basse.|t
Plank con flessione|core|nessuno|plank|Dal plank sui gomiti passa al plank alto una mano alla volta e torna giù.
Squat con pausa al petto|gambe|manubri|squatdb|Con il peso al petto, scendi e resta fermo due secondi in basso.
Squat dietro con piede rialzato|gambe|nessuno|lunge|Piede dietro su una sedia, scendi verticalmente con la gamba avanti e risali.
Salita laterale sul gradino|gambe|nessuno|stepup|Di fianco a un gradino, sali di lato spingendo con la gamba che sale.
Alzate della punta del piede|gambe|nessuno|calf|Appoggiato al muro, solleva le punte dei piedi lasciando i talloni a terra.
Camminata a quattro zampe|corpo intero|nessuno|birddog|A quattro zampe con le ginocchia appena sollevate, avanza lentamente con passi controllati.|t
Cammello respirato|mobilità|nessuno|cat|A quattro zampe, inarca piano la schiena e respira profondamente.|t
Sollevamento da terra con peso leggero|schiena|manubri|hinge|Un manubrio vicino ai piedi, piega le anche con la schiena piatta e risali.
Spinta con elastico al muro|petto|elastico|pressfwd|Elastico fissato dietro di te, spingi in avanti con i gomiti vicini al corpo.
Pugni con elastico|spalle|elastico|pressfwd|Elastico dietro la schiena, tira un pugno alla volta davanti a te, ruotando leggermente il busto.
Camminata veloce a intervalli|cardio|nessuno|walk|Alterna 2 minuti di passo svelto a 2 minuti di passo normale.|t
Corsa lenta con pause di camminata|cardio|nessuno|run|Alterna 1 minuto di corsa lenta a 1 minuto di camminata.|t
Saltelli leggeri con la corda immaginaria|cardio|nessuno|rope|Piccoli salti sulle punte come con la corda, senza corda: bassissimo impatto.|t
Sollevamento di un ginocchio da sdraiato|core|nessuno|deadbug|Sdraiato con ginocchia piegate, solleva un piede alla volta senza muovere il bacino.
Inchworm|corpo intero|nessuno|downdog|Da in piedi piega in avanti, cammina con le mani fino al plank e torna indietro.
Rotazione del busto da seduto|mobilità|nessuno|russian|Seduto sulla sedia, braccia incrociate al petto, ruota piano il busto a sinistra e a destra.
Allungamento dei polpacci seduto|mobilità|nessuno|stretchq|Seduto con la gamba tesa, tira la punta del piede verso di te con un asciugamano.|t
Apertura del petto in piedi|mobilità|nessuno|raise|Mani dietro la schiena, apri il petto portando le braccia indietro senza inarcare.|t
Stacco con elastico|glutei|elastico|hinge|In piedi sull'elastico, piega le anche indietro con schiena piatta e risali.
Passi in avanti con affondo corto|gambe|nessuno|lunge|Affondo breve in avanti con poca profondità, per iniziare con sicurezza.
Spinte con manubri alternate|spalle|manubri|press|Spingi un manubrio alla volta sopra la testa alternando, con addominali contratti.
Rematore in appoggio sulla sedia|schiena|manubri|rowbent|Una mano sulla sedia, tira il manubrio verso l'anca con la schiena piatta.
Ponte con un ginocchio al petto|glutei|nessuno|bridge|Dal ponte, porta un ginocchio al petto alternando senza abbassare il bacino.
Pistol squat|gambe|nessuno|pistol|Una gamba tesa davanti, scendi sull'altra con il busto in avanti e risali senza slancio. Per esperti.
Squat a una gamba sulla sedia|gambe|nessuno|pistol|Scendi su una gamba sola fino a sfiorare la sedia e risali. Più facile del pistol squat.
Cossack squat|gambe|nessuno|lunge|Piedi molto larghi: siediti su una gamba tenendo l'altra distesa di lato, poi cambia lato.
Skater squat|gambe|nessuno|squat|Su una gamba, gamba libera dietro, scendi piano finché il ginocchio sfiora il pavimento.
Squat con salto a rana|gambe|nessuno|jumpsquat|Squat molto largo con mani a terra, poi salta in avanti e atterra morbido.
Squat con salto e rotazione|gambe|nessuno|jumpsquat|Scendi in squat, salta ruotando di un quarto di giro e atterra in squat.
Squat isometrico|gambe|nessuno|wallsit|Resta fermo in squat a metà discesa, schiena dritta, peso sui talloni.|t
Tuck jump|gambe|nessuno|jumpsquat|Salta in alto portando le ginocchia al petto e atterra ammortizzando.
Step-up con ginocchio alto|gambe|nessuno|stepup|Sali sul gradino e porta in alto il ginocchio dell'altra gamba, poi scendi controllato.
Calf raise a una gamba|gambe|nessuno|calf|Su una gamba, tieniti a un appoggio, sali sulle punte e scendi piano.
Alzata dalla sedia a una gamba|gambe|nessuno|squat|Dalla sedia, alzati spingendo su una gamba sola, senza aiutarti con le mani.
Fire hydrant|glutei|nessuno|kickback|A quattro zampe, solleva il ginocchio di lato mantenendo il bacino fermo.
Ponte con piedi sulla sedia|glutei|nessuno|bridge|Talloni su una sedia, solleva il bacino spingendo con i talloni.
Ponte a marcia|glutei|nessuno|bridge|In ponte, solleva un piede alla volta senza far cadere il bacino.
Hip thrust a una gamba|glutei|nessuno|hipthrust|Spalle su una panca, una gamba tesa in aria, spingi con l'altro tallone.
Frog pump|glutei|nessuno|bridge|Sdraiato con piante dei piedi unite e ginocchia aperte, solleva il bacino stringendo i glutei.
Donkey kick a corpo libero|glutei|nessuno|kickback|A quattro zampe, calcia verso il soffitto con il ginocchio piegato, senza inarcare la schiena.
Stacco a una gamba a corpo libero|glutei|nessuno|hinge|Su una gamba, busto in avanti e gamba libera dietro, poi risali con il gluteo.
Flessioni con rotazione|petto|nessuno|pushup|Dopo ogni flessione ruota il busto e solleva un braccio verso il soffitto. Alterna.
Flessioni spiderman|petto|nessuno|pushup|Scendendo, porta un ginocchio verso il gomito dello stesso lato. Alterna.
Flessioni lente|petto|nessuno|pushup|Scendi in 4 secondi e risali in 2: più tensione, meno slancio.
Flessioni con pausa|petto|nessuno|pushup|Resta fermo 2 secondi con il petto a un dito da terra, poi spingi.
Flessioni pseudo planche|petto|nessuno|pushup|Mani vicino ai fianchi con dita verso i piedi, corpo inclinato in avanti: scendi e spingi.
Flessioni a una mano assistite|petto|nessuno|pushup|Una mano su un rialzo e l'altra a terra, scendi controllando. Per esperti.
Rematore con asciugamano alla porta|schiena|nessuno|rowband|Asciugamano intorno alla maniglia di una porta chiusa, inclinati indietro e tira il petto verso la porta.
Swimmer a terra|schiena|nessuno|superman|A pancia in giù, braccia e gambe sollevate, alterna piccole battute come nel nuoto.|t
Y-T-W a terra|schiena|nessuno|superman|A pancia in giù, solleva le braccia disegnando Y, T e W con le scapole.
Superman con pausa|schiena|nessuno|superman|Solleva braccia e gambe e resta fermo 3 secondi stringendo la schiena.
Trazioni negative|schiena|palestra|pullup|Parti con il mento sopra la sbarra e scendi in 4-5 secondi controllando.
Trazioni a presa neutra|schiena|palestra|pullup|Palmi uno verso l'altro, tira fino a portare il petto verso la sbarra.
Rematore con zaino|schiena|nessuno|rowbent|Zaino con libri, busto inclinato e schiena piatta, tira lo zaino verso l'addome.
Pike push-up con piedi rialzati|spalle|nessuno|downdog|Piedi su una sedia, anche alte: scendi con la testa tra le mani e spingi.
Handstand al muro|spalle|nessuno|downdog|Cammina con i piedi sul muro fino alla verticale e resta fermo, corpo teso. Solo per esperti.|t
Alzate laterali con bottiglie|spalle|nessuno|raise|Una bottiglia piena per mano, solleva le braccia di lato fino alle spalle.
Alzate frontali con zaino|spalle|nessuno|raise|Tieni lo zaino con due mani e sollevalo davanti a te fino alle spalle.
Curl con zaino|braccia|nessuno|curl|Tieni lo zaino con due mani, gomiti fermi, fletti e scendi piano.
Curl con bottiglie|braccia|nessuno|curl|Una bottiglia per mano, gomiti fermi ai fianchi, fletti e scendi.
Curl isometrico con asciugamano|braccia|nessuno|curl|Tira un asciugamano teso con le due mani mentre opponi resistenza con l'altro braccio.|t
Dip su sedia a gambe piegate|braccia|nessuno|dips|Mani sul bordo della sedia e ginocchia piegate: scendi con i gomiti all'indietro e risali.
Estensione tricipiti con zaino|braccia|nessuno|tricepext|Zaino dietro la testa con due mani, gomiti vicini, estendi le braccia in alto.
Plank con sollevamento della gamba|core|nessuno|plank|In plank, solleva una gamba tesa senza ruotare il bacino. Alterna.|t
Plank con salto dei piedi|core|nessuno|plank|Dal plank alto salta con i piedi aperti e chiusi, tenendo il bacino stabile.|t
Plank sulle ginocchia|core|nessuno|plank|Come il plank ma con le ginocchia a terra: più facile, corpo in linea.|t
Plank inverso|core|nessuno|bridge|Seduto con le mani dietro, solleva il bacino fino a linea dritta spalle-talloni.|t
V-up|core|nessuno|situp|Sdraiato, porta insieme busto e gambe tese verso l'alto toccando i piedi.
Flutter kick|core|nessuno|legraise|Sdraiato con le gambe sollevate, batti piccole alternate come nel nuoto.|t
Scissor kick|core|nessuno|legraise|Sdraiato, gambe tese che si incrociano alternando sopra e sotto.|t
L-sit|core|nessuno|lsit|Seduto con le mani a terra ai fianchi, solleva il bacino e le gambe tese.|t
Dragon flag assistito|core|nessuno|legraise|Sdraiato su una panca, aggrappato dietro la testa, scendi con il corpo teso e le ginocchia piegate.
Hollow rock|core|nessuno|legraise|In posizione hollow, dondola avanti e indietro mantenendo il corpo rigido.|t
Tocca-tallone|core|nessuno|crunch|Sdraiato con ginocchia piegate, inclinati di lato a toccare con la mano il tallone, alternando.
Windshield wipers|core|nessuno|legraise|Sdraiato con le gambe verso l'alto, scendile da un lato all'altro senza toccare terra.
Sit-up con rotazione|core|nessuno|situp|A ogni salita ruota il busto portando il gomito verso il ginocchio opposto.
Bear crawl|corpo intero|nessuno|birddog|A quattro zampe con ginocchia sollevate, avanza mano e piede opposti insieme.|t
Sprawl|corpo intero|nessuno|burpee|Da in piedi scendi con i piedi indietro in plank e torna su, senza flessione.
Squat thrust|corpo intero|nessuno|burpee|Mani a terra, porta i piedi indietro e riportali dentro, poi torna in piedi.
Camminata del granchio|corpo intero|nessuno|bridge|Seduto con bacino alto e mani dietro, cammina di lato o indietro come un granchio.|t
Calci ai glutei|cardio|nessuno|run|Corri sul posto portando i talloni verso i glutei.|t
Mountain climber veloce|cardio|nessuno|mountain|In flessione, porta le ginocchia al petto alternando velocemente.|t
Salti da un lato all'altro|cardio|nessuno|jumpsquat|Salta di lato oltre una linea immaginaria con i piedi uniti.|t
World's greatest stretch|mobilità|nessuno|lungestretch|In affondo, mano a terra, ruota il busto e porta il braccio verso il soffitto.|t
Figura 4|mobilità|nessuno|hip9090|Seduto, caviglia sul ginocchio opposto, piega il busto in avanti con la schiena lunga.|t
Stretching dei glutei|mobilità|nessuno|hip9090|Sdraiato, caviglia sul ginocchio opposto e tira la coscia verso il petto.|t
Stretching dei dorsali|mobilità|nessuno|child|In ginocchio, allunga le braccia avanti su un lato e lascia scendere il bacino verso i talloni.|t
Stretching dei pettorali alla porta|mobilità|nessuno|raise|Avambraccio sullo stipite, fai un piccolo passo avanti finché senti l'allungamento al petto.|t
Stretching dei tricipiti|mobilità|nessuno|raise|Mano dietro la schiena, con l'altra premi delicatamente il gomito verso la testa.|t
Stretching degli adduttori|mobilità|nessuno|hip9090|Seduto con le piante dei piedi unite, lascia scendere le ginocchia senza forzare.|t
Squat della rana (mobilità)|mobilità|nessuno|squat|Scendi in squat profondo con i gomiti dentro le ginocchia e respira.|t
`;
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function build(): ExerciseX[] {
  const out: ExerciseX[] = EXERCISES.map((e) => ({ ...e, ...(OLD_FAM[e.id] ? { fam: OLD_FAM[e.id] } : {}) }));
  const names = new Set(out.map((e) => norm(e.name)));
  for (const line of NEW.split('\n')) {
    const a = line.trim().split('|'); if (a.length < 5) continue;
    const name = a[0].trim(); if (names.has(norm(name))) continue; names.add(norm(name));
    let id = slug(name); while (out.some((e) => e.id === id)) id += '-2';
    out.push({ id, name, muscle: a[1] as Muscle, equip: a[2] as Equip, fam: a[3], how: a[4].trim(), ...(a[5] === 't' ? { timed: true } : {}) });
  }
  return out;
}
export const ALL_EXERCISES: ExerciseX[] = build();
const BY_ID = new Map(ALL_EXERCISES.map((e) => [e.id, e]));
/** Un esercizio dell'archivio o, in mancanza, uno creato dall'utente. */
export const exById = (id: string, custom: ExerciseX[] = []): ExerciseX | undefined => BY_ID.get(id) ?? custom.find((e) => e.id === id);

export type ExFilter = { q?: string; muscle?: Muscle | 'tutti'; equip?: Equip | 'tutti' };
/** Cerca tra tutti gli esercizi (archivio + creati dall'utente) per nome, muscolo e attrezzo. */
export function searchExercises(f: ExFilter, custom: ExerciseX[] = [], max = 80): ExerciseX[] {
  const words = norm(f.q ?? '').split(' ').filter(Boolean);
  const list = [...custom, ...ALL_EXERCISES].filter((e) => (!f.muscle || f.muscle === 'tutti' || e.muscle === f.muscle) && (!f.equip || f.equip === 'tutti' || e.equip === f.equip));
  if (!words.length) return list.slice(0, max);
  return list.map((e, i) => { const hay = norm(`${e.name} ${e.muscle} ${e.equip}`); const hits = words.filter((w) => hay.includes(w)).length; return { e, i, hits, start: hay.startsWith(words[0]) ? 1 : 0 }; })
    .filter((x) => x.hits === words.length).sort((a, b) => b.start - a.start || a.i - b.i).slice(0, max).map((x) => x.e);
}

export type Guide = { family?: Family; cues: string[]; mistakes: string[] };
/** Punti chiave ed errori comuni dell'esercizio (dalla sua famiglia di movimento). */
export function guideOf(e: ExerciseX | undefined): Guide {
  const fam = e?.fam ? FAMILIES[e.fam] : undefined;
  return { ...(fam ? { family: fam } : {}), cues: fam?.cues ?? [], mistakes: fam?.mistakes ?? [] };
}
/** Crea un esercizio personale. */
export function makeCustom(input: { name: string; muscle: Muscle; equip: Equip; how: string; timed?: boolean; fam?: string; photos?: string[] }, id: string): ExerciseX | null {
  const name = input.name.trim().slice(0, 60); if (name.length < 2) return null;
  return { id, name, muscle: input.muscle, equip: input.equip, how: input.how.trim().slice(0, 400) || 'Esegui il movimento con controllo.', ...(input.timed ? { timed: true } : {}), ...(input.fam && FAMILIES[input.fam] ? { fam: input.fam } : {}), ...(input.photos?.length ? { photos: input.photos.slice(0, 2) } : {}), custom: true };
}
