/** Schede su misura / 1: lavoro, tempo e fasi della giornata, età. Formato: P|id|nome|slogan|obiettivo|livello|luogo|giorni|settimane|bisogni|specialità|per chi|perché|avvertenze ; S|sessione ; x|esercizio|serie x rip (o s)|recupero */
export const P1 = `
P|scrivania|Impiegato da scrivania|Sciogli collo e spalle, rinforza la schiena dopo 8 ore seduto|salute|principiante|casa|3|8|sedentario,collo-spalle,schiena|Postura da ufficio|Chi passa la giornata al computer e a fine giornata ha collo duro, spalle in avanti e lombari tirati.|Alterna aperture del petto e tirate (il contrario della posizione da seduto), rinforza glutei e core che da seduti si spengono, e sciogli le anche.|Se hai formicolii alle braccia o dolore che peggiora, parlane con il medico.
S|Apri il petto e tira
x|apertura-del-petto-in-piedi|2x30s|20
x|stringi-le-scapole|3x12|30
x|rematore-con-elastico|3x12|45
x|angelo-al-muro|3x10|30
x|retrazione-del-mento|3x20s|20
x|plank-sui-gomiti|3x25s|40
S|Glutei e anche
x|ponte-con-pausa|3x12|45
x|alzata-dalla-sedia|3x12|45
x|clamshell|3x15|30
x|allungamento-dei-flessori-dell-anca|2x40s|20
x|bird-dog-con-pausa|3x8|40
x|respirazione-diaframmatica|2x40s|20
S|Mobilità del mattino
x|cat-cow|2x10|20
x|rotazione-toracica|2x8|20
x|cerchi-di-spalle|2x30s|15
x|stretching-collo|2x30s|15
x|apertura-90-90-con-rotazione|2x8|20
P|pausa-pranzo-15|Pausa pranzo in 15 minuti|Un circuito che entra tra una riunione e l'altra|dimagrire|principiante|casa|4|6|poco-tempo,sedentario|Circuito breve|Chi ha davvero solo 15 minuti e vuole non saltare l'allenamento.|Un solo circuito a tutto corpo, senza attrezzi e senza sudare troppo, con transizioni rapide: lavora gambe, spinta e core nello stesso blocco.|~
S|Circuito A
x|squat|3x15|20
x|flessioni-inclinate|3x10|20
x|affondo-indietro|3x10|20
x|plank-sui-gomiti|3x30s|20
x|jumping|2x40s|20
S|Circuito B
x|squat-sumo|3x15|20
x|pike|3x8|20
x|ponte|3x15|20
x|crunch-bicicletta|3x16|20
x|corsa-sul-posto|2x40s|20
S|Circuito C
x|alzata-dalla-sedia|3x15|20
x|dip-tra-due-sedie|3x10|20
x|affondo-laterale|3x10|20
x|dead-bug|3x10|20
x|salti-sul-posto|2x40s|20
P|turnista|Turnista notturno|Energia dopo il turno, senza stancarti di più|salute|principiante|casa|3|8|stress,sedentario|Recupero attivo|Chi lavora di notte o a turni e ha il sonno spezzato: allenamenti brevi, mai a ridosso del sonno, intensità moderata.|Sessioni da 25 minuti con forza leggera e respirazione: niente scatti prima di dormire, perché alzano il battito proprio quando serve riposo. Da fare al risveglio, non prima di coricarti.|Non allenarti nell'ora prima di dormire: l'intensità alta peggiora l'addormentamento.
S|Risveglio dolce
x|cat-cow|2x10|20
x|squat-sulla-sedia|3x12|45
x|spinte-al-muro|3x12|45
x|ponte-assistito|3x12|45
x|passeggiata-del-contadino|2x40s|45
x|respirazione-diaframmatica|2x60s|20
S|Forza leggera
x|squat-con-manubri|3x10|60
x|rematore-a-un-braccio|3x10|60
x|affondo-indietro|3x8|45
x|plank-sui-gomiti|3x25s|40
x|stretching-polpacci-al-muro|2x30s|15
S|Camminata attiva
x|camminata-veloce-a-intervalli|1x25m|0
x|mobilita-della-caviglia|2x10|20
x|rotazione-delle-anche|2x30s|15
P|neogenitore|Neo-genitore: 12 minuti|Allenarti mentre il bimbo dorme o gioca accanto|tonificare|principiante|casa|4|8|poco-tempo,schiena,donna,uomo|Con il bimbo vicino|Chi ha un neonato o un bimbo piccolo e può ritagliarsi dieci minuti alla volta, spesso interrotti.|Esercizi che si fermano e riprendono senza perdere senso (blocchi corti), e rinforzo di schiena e braccia, che si usano molto nel portare il bimbo.|~
S|Blocco 1
x|squat|3x12|20
x|rematore-in-appoggio-sulla-sedia|3x10|20
x|ponte|3x12|20
x|plank-sui-gomiti|2x25s|20
S|Blocco 2
x|affondo-indietro|3x10|20
x|flessioni-inclinate|3x10|20
x|estensione-della-schiena-sdraiato|3x10|20
x|dead-bug|3x8|20
S|Blocco 3
x|squat-bulgaro|3x8|20
x|alzate-con-bottiglie|3x12|20
x|stringi-le-scapole|3x12|20
x|crunch-inverso|3x10|20
P|studente-sessione|Studente in sessione|20 minuti che calmano la testa tra un esame e l'altro|salute|principiante|casa|4|4|stress,sedentario,collo-spalle|Anti-stress|Chi studia ore seduto prima degli esami e ha mente satura, spalle chiuse e poca energia.|Mescola movimento ritmico (abbassa il cortisolo), aperture del petto e respirazione lenta; sessioni brevi che non rubano tempo allo studio.|~
S|Scarica la testa
x|marcia-sul-posto|1x3m|0
x|cerchi-di-spalle|2x30s|15
x|squat|3x12|30
x|spinte-al-muro|3x12|30
x|apertura-del-petto-in-piedi|2x30s|15
x|respirazione-diaframmatica|2x60s|15
S|Energia
x|jumping|3x40s|20
x|affondo-indietro|3x10|30
x|flessioni-sulle-ginocchia|3x10|30
x|plank-sui-gomiti|3x25s|30
x|stretching-collo|2x30s|15
S|Postura
x|stringi-le-scapole|3x12|20
x|angelo-al-muro|3x10|20
x|ponte|3x12|30
x|cat-cow|2x10|15
x|retrazione-del-mento|3x20s|15
P|hotel|Viaggiatore d'affari|Camera d'albergo, nessun attrezzo, 25 minuti|tonificare|intermedio|casa|3|6|viaggio,poco-tempo|In camera|Chi viaggia spesso, dorme in hotel e non ha attrezzi: tutto con corpo libero e, volendo, un elastico nel bagaglio.|Sessioni che non richiedono spazio (si fanno tra letto e armadio), senza salti rumorosi per rispettare i vicini; elastico facoltativo.|~
S|Camera A
x|squat-con-pausa|3x12|30
x|flessioni-larghe|3x12|30
x|affondo-indietro|3x10|30
x|plank-con-tocco-spalla|3x20s|30
x|ponte-con-pausa|3x12|30
S|Camera B
x|squat-bulgaro|3x8|30
x|dip-tra-due-sedie|3x12|30
x|flessioni-con-piedi-rialzati|3x10|30
x|hollow-hold|3x20s|30
x|donkey-kick-con-elastico|3x12|30
S|Camera C
x|squat-sumo|3x15|30
x|pike|3x8|30
x|rematore-con-elastico|3x12|30
x|dead-bug|3x10|30
x|mobilita-della-caviglia|2x10|15
P|sempre-in-piedi|Sempre in piedi|Per chi sta in piedi tutto il giorno: gambe leggere, piedi sani|salute|principiante|casa|3|8|in-piedi,schiena|Gambe e circolazione|Insegnanti, commessi, parrucchieri: ore in piedi, polpacci gonfi, schiena e piedi che dolgono a fine giornata.|Rinforza polpacci, tibiali e glutei (che sostengono la postura in piedi), poi decomprime la schiena a fine giornata con mobilità; niente corsa né salti che caricano ancora le articolazioni.|Se gonfiore e dolore alle gambe sono forti o improvvisi, vai dal medico.
S|Gambe forti
x|calf-raise-in-piedi|3x15|30
x|alzate-della-punta-del-piede|3x15|30
x|squat-sulla-sedia|3x12|45
x|ponte|3x12|45
x|equilibrio-su-una-gamba|2x30s|20
S|Sollievo
x|stretching-polpacci-al-muro|3x40s|15
x|allungamento-dei-polpacci-seduto|2x40s|15
x|child|2x40s|15
x|ponte-con-respirazione|3x10|30
x|mobilita-della-caviglia|2x12|20
S|Schiena sostenuta
x|bird-dog-con-pausa|3x8|40
x|clamshell|3x15|30
x|plank-sui-gomiti|3x25s|40
x|estensione-della-schiena-sdraiato|3x10|30
P|autista|Autista e camionista|Pause attive e rinforzo per lombari e anche|salute|principiante|casa|3|8|sedentario,schiena|Pause attive|Chi guida molte ore: anche chiuse, lombari tirati, glutei addormentati, poche possibilità di allenarsi.|Una sessione da fare a terra o accanto al mezzo, mirata ad anche e lombari, più mini-pause da 5 minuti da ripetere ogni due ore di guida.|Non fare esercizi alla guida: solo in sosta, in luogo sicuro.
S|Pausa 5 minuti (fuori dal mezzo)
x|squat|2x10|15
x|allungamento-dei-flessori-dell-anca|2x30s|10
x|stretching-polpacci-al-muro|2x30s|10
x|cerchi-di-spalle|1x30s|10
x|rotazione-delle-anche|1x30s|10
S|Forza a terra
x|ponte-con-pausa|3x12|40
x|clamshell|3x15|30
x|bird-dog-con-pausa|3x8|40
x|plank-sui-gomiti|3x25s|40
x|stretching-posteriore-coscia|2x40s|15
S|Anche libere
x|apertura-90-90-con-rotazione|3x8|20
x|affondo-con-apertura|2x40s|15
x|cane-a-testa-in-giu|2x40s|15
x|cat-cow|2x10|15
P|smartworking|Smart working|Pause attive e forza in casa, senza uscire dalla stanza|tonificare|principiante|casa|3|8|sedentario,poco-tempo|Lavoro da casa|Chi lavora da casa e si muove pochissimo: niente tragitto, niente scale, giornate di 2.000 passi.|Mini-blocchi da 5 minuti tra una call e l'altra più tre sessioni di forza da 25 minuti; cerca di recuperare i passi mancanti con la camminata a intervalli.|~
S|Forza A
x|squat-con-pausa|3x12|45
x|flessioni-inclinate|3x10|45
x|rematore-in-appoggio-sulla-sedia|3x10|45
x|ponte|3x15|30
x|plank-sui-gomiti|3x30s|30
S|Forza B
x|affondo-indietro|3x10|45
x|dip-tra-due-sedie|3x10|45
x|stringi-le-scapole|3x15|30
x|stacco-a-gamba-tesa|3x10|45
x|dead-bug|3x10|30
S|Pausa attiva + cammino
x|camminata-veloce-a-intervalli|1x20m|0
x|cerchi-di-spalle|1x30s|10
x|apertura-del-petto-in-piedi|2x30s|10
x|squat-sulla-sedia|2x12|20
P|ristorazione|Cameriere e cuoco|Piedi, caviglie e schiena dopo turni lunghi|salute|principiante|casa|3|8|in-piedi,schiena|Servizio lungo|Chi lavora in sala o in cucina: corre, solleva, resta in piedi per ore su pavimenti duri.|Caviglie e piedi stabili, schiena che regge i carichi (piegamento sicuro), allungamenti per polpacci e flessori dell'anca; sessioni brevi da fare dopo il turno.|~
S|Dopo il turno
x|mobilita-della-caviglia|3x12|20
x|stretching-polpacci-al-muro|3x40s|15
x|allungamento-dei-flessori-dell-anca|2x40s|15
x|child|2x40s|15
x|ponte-con-respirazione|3x10|30
S|Caviglie e gambe forti
x|calf-raise-in-piedi|3x15|30
x|alzate-della-punta-del-piede|3x15|30
x|equilibrio-su-una-gamba|3x30s|20
x|squat-con-pausa|3x10|45
x|step-up-su-gradino|3x8|45
S|Sollevare in sicurezza
x|stacco-a-gamba-tesa|3x10|45
x|squat-con-manubri|3x10|60
x|passeggiata-del-contadino|3x30s|45
x|plank-sui-gomiti|3x25s|40
x|bird-dog-con-pausa|3x8|40
P|infermiere|Infermiere e operatori sanitari|Spostare pazienti senza farti male alla schiena|forza|intermedio|casa|3|10|schiena,in-piedi,collo-spalle|Sollevare e spostare|Chi solleva e sposta persone o carichi, spesso di notte, con rischio di lombalgia e spalle sovraccariche.|Forza di cerniera d'anca e core (il modo sicuro di sollevare), stabilità delle scapole per spingere e tirare, allungamenti per chi sta in piedi molte ore.|~
S|Cerniera e core
x|stacco-a-gamba-tesa|4x10|60
x|squat-con-pausa-al-petto|3x8|60
x|plank-laterale|3x25s|40
x|dead-bug|3x10|40
x|passeggiata-del-contadino|3x40s|45
S|Spingere e tirare
x|rematore-a-un-braccio|4x10|60
x|flessioni-con-piedi-rialzati|3x10|60
x|face-pull|3x15|40
x|stringi-le-scapole|3x15|30
x|pallof-press|3x10|40
S|Recupero dei turni
x|ponte-con-respirazione|3x10|30
x|cane-a-testa-in-giu|2x40s|15
x|apertura-90-90-con-rotazione|2x8|20
x|stretching-collo|2x30s|15
x|respirazione-diaframmatica|2x60s|15
P|manager-stress|Manager sotto pressione|Allenamento breve e intenso che scarica lo stress|dimagrire|intermedio|casa|4|8|stress,poco-tempo|Scarica la tensione|Chi ha poco tempo, molta tensione e rischia di saltare gli allenamenti per le riunioni.|Due sessioni intense e brevi (HIIT) per scaricare, una di forza e una di mobilità con respirazione per non tenere il corpo sempre in allerta.|~
S|Scarica A
x|burpee|4x10|30
x|squat-saltato|4x12|30
x|mountain-climber-lento|4x30s|30
x|flessioni-larghe|3x12|30
S|Forza B
x|squat-bulgaro|3x10|45
x|rematore-in-appoggio-sulla-sedia|3x12|45
x|spinte-con-manubri-alternate|3x10|45
x|hollow-hold|3x20s|30
S|Scarica C
x|corda|4x40s|20
x|affondo-con-salto|3x10|30
x|flessioni-diamante|3x10|30
x|crunch-bicicletta|3x20|30
S|Mobilità e respiro
x|cane-a-testa-in-giu|2x40s|15
x|cat-cow|2x10|15
x|apertura-90-90-con-rotazione|2x8|15
x|respirazione-diaframmatica|3x60s|15
P|over60-forza|Over 60: forza che serve|Alzarsi, salire le scale, portare la spesa: forza per la vita di tutti i giorni|salute|principiante|casa|3|12|over60,equilibrio,forza|Autonomia quotidiana|Chi ha più di 60 anni, è in buona salute e vuole mantenere forza e autonomia (scale, spesa, alzarsi dal divano).|Esercizi funzionali con la sedia come appoggio, carichi progressivi e piccoli, equilibrio e respirazione; niente salti né posizioni a terra difficili.|Chiedi il parere del medico prima di iniziare se hai problemi di cuore, pressione o articolazioni.
S|Forza funzionale
x|alzata-dalla-sedia|3x10|60
x|spinte-al-muro|3x10|60
x|rematore-con-elastico|3x10|60
x|ponte-assistito|3x10|45
x|passeggiata-del-contadino|2x30s|60
S|Equilibrio
x|equilibrio-su-una-gamba|3x30s|30
x|camminata-tallone-punta|3x30s|30
x|salita-laterale-sul-gradino|2x8|45
x|alzate-con-bottiglie|3x10|45
x|mobilita-della-caviglia|2x10|20
S|Mobilità
x|cat-cow|2x8|20
x|rotazione-del-busto-da-seduto|2x8|20
x|allungamento-dei-polpacci-seduto|2x30s|15
x|respirazione-diaframmatica|2x40s|15
P|over65-equilibrio|Over 65: niente cadute|Equilibrio, caviglie e gambe per camminare sicuri|salute|principiante|casa|3|12|over60,equilibrio|Prevenzione cadute|Chi ha più di 65 anni e teme di cadere, inciampa o si sente insicuro scendendo le scale.|Equilibrio statico e in movimento con appoggio vicino, forza di caviglie e gambe (le prime a difendere da una caduta), alzarsi dalla sedia con controllo; ogni esercizio vicino a un muro o a un tavolo.|Esegui sempre vicino a un appoggio stabile. Se hai vertigini frequenti parlane con il medico.
S|Equilibrio sicuro
x|equilibrio-su-una-gamba|4x20s|30
x|camminata-tallone-punta|4x30s|30
x|salita-laterale-sul-gradino|3x8|45
x|alzate-della-punta-del-piede|3x12|30
x|calf-raise-in-piedi|3x12|30
S|Gambe stabili
x|alzata-dalla-sedia|3x10|60
x|estensione-della-gamba-da-seduto|3x12|45
x|ponte-assistito|3x10|45
x|discesa-controllata-dal-gradino|2x8|45
S|Mobilità dolce
x|cerchi-di-spalle|2x30s|15
x|rotazione-del-busto-da-seduto|2x8|15
x|stretching-polpacci-al-muro|2x30s|15
x|respirazione-diaframmatica|2x40s|15
P|over70-sedia|Over 70: tutto con la sedia|Un allenamento che si fa da seduti o in piedi con la sedia|salute|principiante|casa|3|12|over60,equilibrio,schiena|Con la sedia|Chi ha più di 70 anni o difficoltà a stare in piedi a lungo: tutto si fa seduti o con la sedia come appoggio.|Movimenti ampi ma lenti, nessun carico a terra; lavora spalle, gambe e schiena per facilitare gesti come vestirsi o alzarsi.|Fermati se senti dolore al petto, capogiro o fiato corto e chiedi al medico.
S|Seduti
x|estensione-della-gamba-da-seduto|3x12|45
x|alzate-con-bottiglie|3x10|45
x|rotazione-del-busto-da-seduto|3x8|30
x|marcia-sul-posto|2x60s|30
x|respirazione-diaframmatica|2x40s|15
S|In piedi con appoggio
x|alzata-dalla-sedia|3x8|60
x|spinte-al-muro|3x10|45
x|equilibrio-su-una-gamba|3x20s|30
x|calf-raise-in-piedi|3x10|30
S|Mobilità
x|cerchi-di-spalle|2x30s|15
x|allungamento-dei-polpacci-seduto|2x30s|15
x|cat-cow|2x8|20
P|over50-donna-ossa|Over 50 donna: ossa forti|Carico dolce per le ossa e sostegno al metabolismo|forza|principiante|casa|3|12|over60,donna,forza,equilibrio|Salute delle ossa|Donne dopo i 50 anni, soprattutto dopo la menopausa, che vogliono proteggere le ossa e mantenere il tono muscolare.|Le ossa rispondono al carico: esercizi in piedi con peso progressivo, impatti lievi (se il medico è d'accordo) e forza per schiena e anche; equilibrio per prevenire cadute.|Se hai osteoporosi o fratture pregresse, chiedi al medico quali esercizi evitare (in particolare flessioni forti della colonna).
S|Carico per le ossa
x|squat-con-manubri|3x10|60
x|stacco-a-gamba-tesa|3x10|60
x|rematore-a-un-braccio|3x10|60
x|spinte-con-manubri-alternate|3x8|60
x|passeggiata-del-contadino|3x40s|60
S|Equilibrio e anche
x|equilibrio-su-una-gamba|3x30s|30
x|clamshell|3x15|30
x|ponte-con-pausa|3x12|45
x|salita-laterale-sul-gradino|3x8|45
S|Schiena e postura
x|estensione-della-schiena-sdraiato|3x10|30
x|stringi-le-scapole|3x15|30
x|bird-dog-con-pausa|3x8|40
x|cat-cow|2x8|15
P|over50-uomo-ripartenza|Over 50 uomo: si riparte|Dopo anni di stop, senza strappi e senza ego|salute|principiante|casa|3|12|over60,uomo,sedentario,forza|Ripartire con calma|Uomini di 50 anni o più che non si allenano da molto e vogliono ripartire senza infortuni.|Carichi modesti e progressione lenta, tecnica prima di tutto; lavoro su schiena, anche e spalle (i punti che cedono per primi), cardio camminando.|Prima di ripartire dopo anni di stop fai una visita con controllo di cuore e pressione.
S|Forza gentile
x|squat-sulla-sedia|3x10|60
x|flessioni-inclinate|3x8|60
x|rematore-con-elastico|3x12|60
x|ponte|3x12|45
x|plank-sui-gomiti|3x20s|45
S|Anche e schiena
x|stacco-con-elastico|3x10|60
x|bird-dog-con-pausa|3x8|45
x|allungamento-dei-flessori-dell-anca|2x30s|15
x|affondo-con-apertura|2x30s|15
S|Cardio dolce
x|camminata-veloce-a-intervalli|1x30m|0
x|mobilita-della-caviglia|2x10|20
x|cerchi-di-spalle|2x30s|15
P|menopausa|Menopausa: forza e metabolismo|Mantieni muscolo e ossa quando cambiano gli ormoni|tonificare|principiante|palestra|3|12|donna,over60,forza,glutei|Cambi ormonali|Donne tra 45 e 58 anni che notano più grasso addominale, meno forza e più stanchezza.|Pesi moderati su grandi gruppi muscolari (muscolo e ossa), un po' di intervalli per il cuore e mobilità per le anche; riposo tra i giorni per non sovraccaricare.|Chiedi il parere del medico se hai disturbi forti, osteoporosi o problemi di cuore.
S|Gambe e glutei
x|squat-con-manubri|4x10|75
x|hip-thrust-con-manubrio|3x10|75
x|stacco-a-gamba-tesa|3x10|75
x|calf-raise-con-manubri|3x12|45
S|Spinta e tirata
x|panca-con-manubri|3x10|75
x|rematore-a-un-braccio|3x10|75
x|spinte-con-manubri-alternate|3x10|75
x|face-pull|3x15|45
S|Cuore e core
x|ellittica|1x20m|0
x|pallof-press|3x10|40
x|plank-sui-gomiti|3x25s|40
x|apertura-90-90-con-rotazione|2x8|20
P|giovane-massa|Primi mesi in palestra|Costruire una base di muscoli a vent'anni|massa|principiante|palestra|3|12|forza,uomo|Massa per iniziare|Giovani tra 18 e 28 anni alla prima volta in palestra che vogliono mettere massa con la tecnica giusta.|Tre full body con i grandi schemi (squat, spinta, tirata, stacco), pochi esercizi e progressione settimanale del carico: a questa età la tecnica conta più del volume.|~
S|Full body A
x|squat-frontale|4x8|90
x|panca-con-manubri|4x8|90
x|lat-machine-presa-larga|3x10|75
x|curl-con-bilanciere|3x10|60
x|plank-sui-gomiti|3x30s|45
S|Full body B
x|stacco-rumeno-con-bilanciere|4x8|90
x|shoulder-press-alla-macchina|3x10|75
x|rematore-alla-macchina|3x10|75
x|leg-extension|3x12|60
x|french-press|3x10|60
S|Full body C
x|hack-squat|4x10|90
x|panca-inclinata-con-manubri|3x10|75
x|tirate-al-cavo-seduto|3x10|75
x|curl-a-martello|3x10|60
x|alzate-di-gambe-alla-sbarra|3x10|60
P|definizione-estate|Definizione per l'estate|Dodici settimane per arrivare in forma|dimagrire|intermedio|palestra|4|12|peso,forza|Definizione|Chi tra 20 e 35 anni vuole ridurre il grasso mantenendo il muscolo in vista di una data (vacanza, evento).|Pesi pesanti a basse ripetizioni per tenere il muscolo, circuiti per consumare, e cardio in zone diverse: non solo corsa, per non perdere massa.|Non scendere sotto le calorie di base: la definizione non è una dieta drastica.
S|Superiore (forza)
x|panca-inclinata-con-bilanciere|4x6|90
x|rematore-con-bilanciere|4x6|90
x|military-press|3x8|75
x|trazioni-assistite-con-elastico|3x6|75
x|curl-con-bilanciere|2x12|45
S|Inferiore (forza)
x|squat-frontale|4x6|90
x|stacco-rumeno-con-bilanciere|4x8|90
x|affondo-con-manubri|3x10|60
x|calf-raise-alla-macchina|4x12|45
S|Circuito
x|kettlebell-swing|4x15|30
x|thruster-con-manubri|4x10|30
x|rematore-in-appoggio-sulla-sedia|4x12|30
x|burpee|3x10|30
x|mountain-climber-lento|3x30s|30
S|Cardio intervalli
x|cyclette-intervalli|1x25m|0
x|plank-laterale|3x30s|30
x|crunch-ai-cavi|3x15|30
P|quarantenni|40 anni: ripartenza completa|Forza, schiena e cardio per il secondo tempo|salute|intermedio|palestra|3|12|sedentario,forza,schiena,uomo,donna|Dai 40|Chi ha 40-50 anni, lavora molto, si è fermato e vuole ripartire con un programma completo ma gestibile.|Tre incontri a settimana: forza di base, stabilità e cardio breve; schiena e spalle protette perché sono i punti che a questa età si lamentano per primi.|~
S|Forza A
x|squat-con-manubri|3x10|75
x|panca-con-manubri|3x10|75
x|rematore-alla-macchina|3x10|75
x|plank-sui-gomiti|3x30s|45
S|Forza B
x|stacco-a-gamba-tesa|3x10|75
x|shoulder-press-alla-macchina|3x10|75
x|lat-machine-presa-larga|3x10|75
x|bird-dog-con-pausa|3x10|45
S|Cardio e mobilità
x|ellittica|1x20m|0
x|ponte-con-pausa|3x12|45
x|apertura-90-90-con-rotazione|2x8|20
x|cane-a-testa-in-giu|2x40s|15
P|over75-autonomia|Over 75: mobilità e autonomia|Dieci minuti al giorno, a letto o in sedia|mobilità|principiante|casa|5|12|over60,equilibrio|Ogni giorno, con calma|Chi ha più di 75 anni e vuole restare autonomo con piccoli gesti quotidiani.|Sedute brevissime ma frequenti: meglio dieci minuti ogni giorno che un'ora una volta; movimenti ampi, lenti, con la respirazione.|Se hai dolore, capogiri o fiato corto fermati e avvisa il medico. Tienti sempre a un appoggio.
S|Al mattino (a letto o seduti)
x|rotazione-del-busto-da-seduto|2x8|15
x|cerchi-di-spalle|2x30s|10
x|estensione-della-gamba-da-seduto|2x10|20
x|respirazione-diaframmatica|2x40s|10
S|In piedi con appoggio
x|alzata-dalla-sedia|2x8|45
x|equilibrio-su-una-gamba|2x20s|30
x|calf-raise-in-piedi|2x10|30
x|camminata-tallone-punta|2x20s|30
`;
