/**
 * Dimostrazioni degli esercizi (modulo PURO): ogni esercizio appartiene a una «famiglia» di movimento con due pose
 * (partenza e arrivo) disegnate con uno scheletro di lato. Qui ci sono le pose, la geometria e i punti chiave.
 * Angoli in gradi, misurati dalla verticale verso il basso e positivi verso la direzione in cui guarda la figura (destra);
 * per il busto 0 = in piedi, positivo = inclinato in avanti.
 */
export type Prop = 'bench' | 'seat' | 'chair' | 'chairhand' | 'wall' | 'band' | 'rope' | 'pullbar';
export type Hold = 'db' | 'bar' | 'barback' | 'ball';
export type Pose = {
  /** busto */ t: number; /** testa (default = busto) */ h?: number;
  /** braccio e avambraccio (vicino) */ ua: number; fa: number; ua2?: number; fa2?: number;
  /** coscia e stinco (vicina) */ th: number; sh: number; th2?: number; sh2?: number;
  /** piede */ ft?: number; ft2?: number;
  /** sollevamento da terra (salto, polpacci) */ lift?: number;
  /** spalle sollevate (scrollate) */ shr?: number;
  /** attrezzo nella scena */ prop?: Prop;
  /** attrezzo tenuto in mano */ hold?: Hold;
};
export type Family = { id: string; name: string; a: Pose; b?: Pose; /** attrezzo disegnato in entrambe le pose */ prop?: Prop; cues: string[]; mistakes: string[] };

const P = (t: number, ua: number, fa: number, th: number, sh: number, o: Partial<Pose> = {}): Pose => ({ t, ua, fa, th, sh, ...o });
const STAND = P(0, 0, 0, 0, 0);

const F = (id: string, name: string, a: Pose, b: Pose | undefined, cues: string[], mistakes: string[], prop?: Prop): Family => ({ id, name, a, ...(b ? { b } : {}), ...(prop ? { prop } : {}), cues, mistakes });

export const FAMILIES: Record<string, Family> = Object.fromEntries([
  F('squat', 'Squat', P(4, 75, 85, 0, 0), P(38, 85, 88, 82, -28), ['Piedi larghi come le spalle, punte leggermente aperte', 'Schiena dritta e petto alto', 'Scendi fino a cosce parallele al pavimento', 'Le ginocchia seguono la direzione delle punte dei piedi', 'Risali spingendo sui talloni'], ['Ginocchia che cedono verso l\'interno', 'Talloni che si staccano da terra', 'Schiena arrotondata', 'Scendere troppo poco']),
  F('squatdb', 'Squat con peso al petto', P(2, 15, 165, 0, 0, { hold: 'db' }), P(30, 15, 165, 82, -28, { hold: 'db' }), ['Il peso resta vicino al petto', 'Gomiti verso l\'interno, davanti alle ginocchia', 'Schiena dritta, sguardo avanti', 'Scendi fino a cosce parallele'], ['Il peso si allontana dal corpo', 'Busto che si piega in avanti', 'Talloni che si staccano']),
  F('squatbar', 'Squat con bilanciere', P(5, -5, 170, 0, 0, { hold: 'barback' }), P(42, -5, 170, 84, -30, { hold: 'barback' }), ['Bilanciere appoggiato sui trapezi, non sul collo', 'Core contratto prima di scendere', 'Cosce almeno parallele', 'Spingi il pavimento con tutto il piede'], ['Schiena che si inarca o si arrotonda', 'Ginocchia verso l\'interno', 'Peso troppo alto per la tecnica']),
  F('jumpsquat', 'Squat saltato', P(36, 80, 85, 80, -28), P(0, -30, -20, -4, 6, { lift: 14, ft: 150 }), ['Scendi controllato, poi spingi esplosivo', 'Atterra sulle punte e ammortizza piegando le ginocchia', 'Braccia aiutano lo slancio'], ['Atterraggio con gambe rigide', 'Ginocchia verso l\'interno', 'Salto senza controllo']),
  F('lunge', 'Affondo', STAND, P(6, 5, 5, 85, -5, { th2: -15, sh2: -100, ft2: 0 }), ['Passo lungo in avanti, busto eretto', 'Ginocchio davanti sopra la caviglia', 'Il ginocchio dietro sfiora il pavimento', 'Spingi sul tallone davanti per risalire'], ['Ginocchio davanti oltre la punta del piede', 'Busto inclinato in avanti', 'Passo troppo corto']),
  F('stepup', 'Salita sul gradino', P(5, 0, 0, 70, -10, { th2: -8, sh2: -8, prop: 'chair' }), P(2, 0, 0, 0, 0, { th2: 78, sh2: -4, prop: 'chair' }), ['Appoggia tutto il piede sul gradino', 'Spingi con la gamba che sale, non con quella a terra', 'Sali in piedi e controlla la discesa', 'Busto eretto'], ['Dare lo slancio con la gamba dietro', 'Ginocchio che cede all\'interno', 'Gradino troppo alto']),
  F('calf', 'Polpacci', STAND, P(0, 0, 0, 0, 0, { ft: 35, lift: 6 }), ['Sali sulle punte il più possibile', 'Pausa di un secondo in alto', 'Scendi lentamente', 'Ginocchia ferme e quasi distese'], ['Rimbalzare', 'Ginocchia che si piegano', 'Salita parziale']),
  F('bridge', 'Ponte glutei', P(-90, 0, 0, 135, 45, { ua: 4, fa: 4 }), P(-112, 4, 4, 112, 41), ['Piedi vicini ai glutei, a terra', 'Spingi sui talloni e solleva il bacino', 'In alto la linea spalle-ginocchia è dritta', 'Stringi i glutei e tieni un secondo'], ['Inarcare la zona lombare', 'Spingere con le punte dei piedi', 'Bacino che non sale abbastanza']),
  F('hipthrust', 'Spinta d\'anca', P(-108, 8, 8, 132, 50, { prop: 'bench' }), P(-86, 8, 8, 100, 14, { prop: 'bench' }), ['Spalle appoggiate alla panca', 'Spingi con i talloni, mento verso il petto', 'In alto cosce e busto sono in linea', 'Stringi i glutei, non inarcare la schiena'], ['Iperestendere la schiena', 'Piedi troppo lontani o troppo vicini', 'Non chiudere l\'anca in alto']),
  F('hinge', 'Cerniera d\'anca', P(2, 4, 0, 0, 0), P(76, 4, 0, 12, -5), ['Anche all\'indietro, schiena piatta dalla testa al bacino', 'Ginocchia appena piegate', 'Il peso scorre vicino alle gambe', 'Risali stringendo i glutei'], ['Schiena arrotondata', 'Peso lontano dalle gambe', 'Piegare troppo le ginocchia (diventa uno squat)']),
  F('pushup', 'Flessione', P(78, 0, 0, -76, -76, { ft: 0, ft2: 0 }), P(84, -50, 40, -84, -84, { ft: 0, ft2: 0 }), ['Mani sotto le spalle, corpo in linea retta', 'Addominali e glutei contratti', 'Scendi con il petto verso il pavimento', 'Gomiti a circa 45° dal corpo', 'Spingi fino a distendere le braccia'], ['Bacino che cede o che si alza', 'Gomiti troppo larghi', 'Testa che cade in avanti', 'Mezza ripetizione']),
  F('pushupknee', 'Flessione sulle ginocchia', P(68, 0, 0, -68, -100, { ft: -90 }), P(76, -50, 40, -76, -104, { ft: -90 }), ['Dalle ginocchia alla testa il corpo è in linea', 'Mani sotto le spalle', 'Scendi con controllo e spingi', 'Addominali contratti'], ['Bacino indietro', 'Gomiti larghi', 'Non scendere abbastanza']),
  F('plank', 'Plank', P(86, 0, 90, -82, -82, { ft: 0 }), undefined, ['Gomiti sotto le spalle', 'Corpo in linea dalla testa ai talloni', 'Addominali e glutei contratti', 'Respira con calma, sguardo a terra'], ['Bacino che cede', 'Bacino troppo alto', 'Trattenere il respiro', 'Spalle verso le orecchie']),
  F('crunch', 'Crunch', P(-90, 0, 0, 120, 70, { ua: 160, fa: 160 }), P(-52, 40, 150, 120, 70), ['Ginocchia piegate, piedi a terra', 'Solleva spalle e petto con gli addominali', 'Non tirare il collo con le mani', 'Scendi lentamente senza rilassarti'], ['Tirare la testa con le mani', 'Usare lo slancio', 'Sollevare tutta la schiena']),
  F('situp', 'Sit-up', P(-90, 0, 0, 125, 60, { ua: 160, fa: 170 }), P(-8, 40, 85, 125, 60), ['Piedi bloccati o appoggiati', 'Sali con la schiena a rotolo', 'Espira in salita', 'Scendi con controllo'], ['Tirare il collo', 'Slancio', 'Schiena inarcata in discesa']),
  F('legraise', 'Alzate di gambe', P(-90, 4, 4, 88, 88), P(-90, 4, 4, 178, 178), ['Zona lombare appoggiata al pavimento', 'Gambe quasi distese, sale e scende lento', 'Non far toccare i piedi a terra'], ['Schiena che si stacca da terra', 'Slancio', 'Ginocchia molto piegate']),
  F('deadbug', 'Dead bug', P(-90, 175, 175, 100, 20, { th2: 100, sh2: 20 }), P(-90, 175, 175, 175, 175, { ua2: 95, fa2: 95, th2: 100, sh2: 20, ua: 175, fa: 175 }), ['Schiena bassa a contatto col pavimento', 'Muovi braccio e gamba opposti lentamente', 'Respira, non inarcare la schiena'], ['Zona lombare che si stacca', 'Movimenti veloci']),
  F('birddog', 'Bird dog', P(88, 2, 2, 4, -92, { ft: -90 }), P(88, 88, 88, 4, -92, { ua2: 2, fa2: 2, th2: -88, sh2: -88, ft: -90 }), ['Mani sotto le spalle, ginocchia sotto le anche', 'Estendi braccio e gamba opposti', 'Schiena ferma, bacino livellato', 'Tieni un secondo e torna'], ['Schiena che si inarca', 'Bacino che ruota', 'Movimento troppo veloce']),
  F('mountain', 'Mountain climber', P(70, 0, 0, -75, -75, { th2: 40, sh2: -20, ft: 0 }), P(70, 0, 0, 55, -30, { th2: -75, sh2: -75, ft: 0 }), ['Mani sotto le spalle, corpo in linea', 'Porta le ginocchia al petto alternando', 'Bacino basso, addominali contratti', 'Ritmo veloce ma controllato'], ['Bacino alto', 'Mani troppo avanti', 'Perdere la linea del corpo']),
  F('superman', 'Superman', P(88, 88, 88, -90, -90, { h: 90 }), P(78, 102, 102, -102, -102, { h: 70 }), ['Pancia a terra, braccia avanti', 'Solleva insieme braccia e gambe', 'Collo neutro, sguardo al pavimento', 'Tieni un secondo e scendi piano'], ['Alzare il collo', 'Inarcare troppo la schiena', 'Scatti']),
  F('dips', 'Dip', P(4, -12, -4, 70, 60, { prop: 'chairhand' }), P(6, -62, 12, 70, 60, { prop: 'chairhand' }), ['Mani sul bordo, dita in avanti', 'Scendi piegando i gomiti all\'indietro', 'Spalle lontane dalle orecchie', 'Spingi fino a distendere le braccia'], ['Gomiti larghi', 'Scendere troppo con le spalle', 'Bacino lontano dal bordo']),
  F('benchpress', 'Panca / spinta da sdraiato', P(-90, 178, 178, 80, 8, { prop: 'bench', hold: 'bar' }), P(-90, 72, 178, 80, 8, { prop: 'bench', hold: 'bar' }), ['Scapole unite e appoggiate alla panca', 'Piedi saldi a terra', 'Scendi al petto con i gomiti a 45°', 'Spingi in alto senza sbloccare i gomiti bruscamente'], ['Rimbalzare sul petto', 'Glutei che si staccano', 'Gomiti troppo larghi']),
  F('pullup', 'Trazione', P(0, 178, 178, 4, 6, { ft: 120, prop: 'pullbar' }), P(0, 150, 20, 8, 10, { ft: 120, prop: 'pullbar', lift: 0 }), ['Presa poco più larga delle spalle', 'Parti da braccia distese e spalle attive', 'Porta il mento sopra la sbarra', 'Scendi lentamente'], ['Dondolare', 'Mezza ripetizione', 'Spalle verso le orecchie']),
  F('latpull', 'Lat machine', P(-8, 178, 178, 88, 4, { prop: 'seat', hold: 'bar' }), P(-16, 45, 8, 88, 4, { prop: 'seat', hold: 'bar' }), ['Petto alto, schiena leggermente indietro', 'Tira la barra al petto', 'Gomiti verso il basso e dietro', 'Risali lentamente'], ['Tirare dietro la nuca', 'Dondolare col busto', 'Usare solo le braccia']),
  F('rowbent', 'Rematore', P(70, 0, 0, 10, -8), P(70, -35, 55, 10, -8), ['Schiena piatta, busto inclinato', 'Tira il peso verso l\'anca', 'Gomito vicino al corpo', 'Stringi le scapole in alto'], ['Schiena arrotondata', 'Slancio col busto', 'Braccio che tira senza usare la schiena']),
  F('rowband', 'Tirata orizzontale', P(0, 85, 88, 0, 0, { prop: 'band' }), P(0, -10, 80, 0, 0, { prop: 'band' }), ['Petto alto, spalle basse', 'Tira verso il petto stringendo le scapole', 'Gomiti vicini al corpo', 'Rilascia lentamente'], ['Spalle verso le orecchie', 'Busto che si piega indietro'], 'band'),
  F('curl', 'Curl', P(0, 0, 0, 0, 0, { hold: 'db' }), P(0, 5, 150, 0, 0, { hold: 'db' }), ['Gomiti fermi ai fianchi', 'Fletti fino a portare il peso alla spalla', 'Scendi lentamente', 'Polsi dritti'], ['Dondolare il busto', 'Gomiti che avanzano', 'Scendere di scatto']),
  F('tricepext', 'Estensione tricipiti', P(0, 175, 40, 0, 0, { hold: 'db' }), P(0, 178, 178, 0, 0, { hold: 'db' }), ['Gomiti vicini alla testa e fermi', 'Estendi le braccia verso l\'alto', 'Scendi dietro la testa con controllo'], ['Gomiti larghi', 'Schiena inarcata']),
  F('pushdown', 'Pushdown ai cavi', P(0, 5, 100, 0, 0, { prop: 'band' }), P(0, 5, 5, 0, 0, { prop: 'band' }), ['Gomiti fermi ai fianchi', 'Spingi fino a distendere le braccia', 'Risali controllando'], ['Gomiti che si muovono', 'Busto che si piega']),
  F('raise', 'Alzate', P(0, 0, 0, 0, 0, { hold: 'db' }), P(0, 85, 85, 0, 0, { hold: 'db' }), ['Gomiti appena piegati', 'Sali fino all\'altezza delle spalle', 'Scendi lentamente', 'Niente slancio'], ['Slancio col busto', 'Salire sopra le spalle', 'Peso troppo alto']),
  F('press', 'Spinta sopra la testa', P(2, 20, 170, 0, 0, { hold: 'db' }), P(0, 178, 178, 0, 0, { hold: 'db' }), ['Addominali e glutei contratti', 'Spingi in verticale sopra la testa', 'Non inarcare la zona lombare', 'Scendi fino alle spalle'], ['Schiena inarcata', 'Spingere in avanti', 'Gomiti troppo larghi']),
  F('shrug', 'Scrollata di spalle', P(0, 0, 0, 0, 0, { hold: 'db' }), P(0, 0, 0, 0, 0, { hold: 'db', shr: 5 }), ['Alza le spalle verso le orecchie', 'Pausa in alto e scendi piano', 'Braccia distese, niente rotazioni'], ['Ruotare le spalle', 'Piegare i gomiti']),
  F('legcurl', 'Curl femorale', P(88, 88, 88, -90, -90, { h: 90 }), P(88, 88, 88, -90, -172, { h: 90 }), ['Fianchi a contatto con la panca', 'Porta i talloni verso i glutei', 'Scendi lentamente'], ['Sollevare il bacino', 'Slancio']),
  F('legext', 'Leg extension', P(-8, 20, 20, 90, 4, { prop: 'seat' }), P(-8, 20, 20, 90, 88, { prop: 'seat' }), ['Schiena appoggiata', 'Estendi fino a distendere il ginocchio', 'Scendi lentamente'], ['Slancio', 'Bacino che si solleva']),
  F('kickback', 'Calcio all\'indietro', P(88, 0, 0, 6, -92, { ft: -90, th2: 6, sh2: -92 }), P(88, 0, 0, -100, -100, { ft: 0, th2: 6, sh2: -92, ft2: -90 }), ['Mani sotto le spalle, ginocchia sotto le anche', 'Stendi la gamba indietro stringendo il gluteo', 'Bacino fermo, schiena piatta'], ['Inarcare la schiena', 'Ruotare il bacino']),
  F('jack', 'Jumping jack', P(0, 5, 5, 0, 0), P(0, 170, 170, 20, 20, { lift: 6, th2: -20, sh2: -20 }), ['Salta aprendo braccia e gambe', 'Atterra morbido sulle punte', 'Ritmo costante'], ['Atterrare con gambe rigide', 'Braccia che non salgono']),
  F('run', 'Corsa / ginocchia alte', P(8, 40, 100, 5, -25, { ua2: -45, fa2: 70, th2: 70, sh2: -30 }), P(8, -45, 70, 70, -30, { ua2: 40, fa2: 100, th2: 5, sh2: -25, lift: 4 }), ['Busto leggermente in avanti', 'Atterra sotto il corpo, non lontano', 'Braccia piegate a 90° che oscillano', 'Respira con ritmo'], ['Atterrare con il tallone troppo avanti', 'Spalle contratte', 'Passi troppo lunghi']),
  F('burpee', 'Burpee', P(44, 40, 70, 80, -35), P(78, 0, 0, -78, -78, { ft: 0 }), ['Scendi in squat, mani a terra', 'Porta i piedi indietro in plank', 'Torna in squat e salta in alto', 'Mantieni il core attivo'], ['Bacino che cede in plank', 'Atterrare rigidi']),
  F('rope', 'Corda', P(0, 25, 100, 0, 0, { prop: 'rope' }), P(0, 25, 100, -3, 5, { prop: 'rope', lift: 8, ft: 130 }), ['Polsi che girano, non le braccia', 'Salti bassi sulle punte', 'Gomiti vicini ai fianchi'], ['Salti troppo alti', 'Braccia larghe']),
  F('bike', 'Pedalata', P(25, 55, 80, 70, -20, { ua2: 55, fa2: 80, th2: -10, sh2: -10 }), P(25, 55, 80, -10, -10, { ua2: 55, fa2: 80, th2: 70, sh2: -20 }), ['Schiena dritta, spalle rilassate', 'Pedala in modo rotondo', 'Resistenza che permette di mantenere il ritmo'], ['Schiena curva', 'Sella troppo bassa']),
  F('swim', 'Nuoto', P(88, 88, 88, -88, -88, { ua2: -80, fa2: -70, th2: -84, sh2: -100, h: 90 }), P(88, -80, -70, -84, -100, { ua2: 88, fa2: 88, th2: -88, sh2: -88, h: 90 }), ['Corpo lungo e orizzontale', 'Bracciata ampia e continua', 'Respira ogni 2-3 bracciate'], ['Testa alta', 'Gambe che affondano']),
  F('walk', 'Camminata', P(3, 25, 60, 22, -5, { ua2: -25, fa2: -10, th2: -18, sh2: -22 }), P(3, -25, -10, -18, -22, { ua2: 25, fa2: 60, th2: 22, sh2: -5 }), ['Passo naturale, schiena dritta', 'Braccia che oscillano', 'Appoggia il tallone e rotola sul piede'], ['Passi troppo lunghi', 'Busto indietro']),
  F('cat', 'Gatto-cammello', P(100, 0, 0, 6, -92, { h: 60, ft: -90 }), P(78, 0, 0, 6, -92, { h: 112, ft: -90 }), ['Mani sotto le spalle, ginocchia sotto le anche', 'Inarca e arrotonda la schiena lentamente', 'Respira: inspira inarcando, espira arrotondando'], ['Movimenti bruschi', 'Trattenere il respiro']),
  F('child', 'Posizione del bambino', P(78, 90, 90, 82, -96, { h: 100, ft: -90 }), undefined, ['Siediti sui talloni', 'Allunga le braccia avanti e rilassa la fronte', 'Respira lentamente'], ['Forzare la posizione', 'Trattenere il respiro']),
  F('stretchq', 'Stretching quadricipiti', P(0, 0, 0, 0, 0), P(2, 10, 30, 0, 0, { th2: -8, sh2: -150 }), ['Porta il tallone al gluteo', 'Ginocchia vicine e bacino in avanti', 'Tieni 30 secondi per lato'], ['Inarcare la schiena', 'Tirare con forza']),
  F('hamstretch', 'Stretching posteriori coscia', P(55, 80, 85, 0, 0, { th2: 85, sh2: 5, prop: 'chair' }), undefined, ['Gamba distesa, tallone a terra', 'Piega le anche mantenendo la schiena lunga', 'Senti l\'allungamento dietro la coscia, senza dolore'], ['Schiena arrotondata', 'Rimbalzare']),
  F('lungestretch', 'Affondo di stretching', P(5, 5, 10, 85, -5, { th2: -15, sh2: -100 }), undefined, ['Passo lungo, bacino verso il basso', 'Busto eretto', 'Senti l\'allungamento davanti all\'anca'], ['Inarcare la schiena', 'Ginocchio davanti oltre il piede']),
  F('cobra', 'Cobra', P(88, -80, 80, -90, -90, { h: 88 }), P(63, -60, 60, -90, -90, { h: 55 }), ['Mani sotto le spalle', 'Solleva il petto con la schiena, bacino a terra', 'Spalle lontane dalle orecchie'], ['Alzarsi con le sole braccia', 'Collo piegato all\'indietro']),
  F('downdog', 'Cane a testa in giù', P(145, 25, 20, -28, -25, { ft: 60, h: 160 }), undefined, ['Anche in alto, schiena lunga', 'Mani e piedi ben appoggiati', 'Talloni verso il pavimento senza forzare'], ['Schiena arrotondata', 'Spalle chiuse']),

  F('hip9090', 'Apertura anche 90/90', P(8, 8, 8, 80, 85, { th2: -80, sh2: 95 }), P(-5, 8, 8, 80, 85, { th2: -80, sh2: 95 }), ['Gambe a 90 gradi, schiena lunga', 'Ruota il bacino da un lato all\'altro', 'Senza forzare, respira'], ['Schiena arrotondata', 'Scatti']),
  F('wallsit', 'Wall sit', P(0, 10, 10, 88, 2, { prop: 'wall' }), undefined, ['Schiena aderente al muro', 'Cosce parallele al pavimento, ginocchia sopra le caviglie', 'Respira e resisti'], ['Cosce troppo alte', 'Ginocchia oltre i piedi'], 'wall'),
  F('neck', 'Collo', P(0, 0, 0, 0, 0), P(0, 0, 0, 0, 0, { h: -28 }), ['Spalle basse e rilassate', 'Movimenti lenti, mai forzati', 'Respira regolarmente'], ['Tirare con forza', 'Alzare le spalle', 'Trattenere il respiro']),
  F('legpress', 'Leg press', P(-50, 20, 20, 125, 40), P(-50, 20, 20, 95, 85), ['Schiena e bacino appoggiati', 'Piedi larghi come le spalle sulla pedana', 'Scendi fino a 90° di ginocchio, senza staccare il bacino', 'Spingi senza bloccare le ginocchia'], ['Bacino che si stacca dal sedile', 'Ginocchia bloccate in alto', 'Ginocchia verso l\'interno']),
  F('rowerg', 'Vogatore', P(30, 70, 80, 125, 40), P(-20, -10, 70, 92, 88), ['Spingi prima con le gambe', 'Poi inclina il busto e tira con le braccia', 'Il ritorno è l\'inverso: braccia, busto, gambe'], ['Tirare solo con le braccia', 'Schiena curva']),
  F('pressfwd', 'Spinta in avanti', P(0, 20, 110, 0, 0, { prop: 'band' }), P(0, 88, 88, 0, 0, { prop: 'band' }), ['Gomiti all\'altezza del petto', 'Spingi in avanti distendendo le braccia', 'Busto fermo, addominali contratti'], ['Spalle verso le orecchie', 'Busto che si inclina indietro']),
  F('russian', 'Rotazioni russe', P(-35, 75, 80, 105, 75), undefined, ['Busto inclinato, schiena dritta', 'Ruota con le spalle, non con le braccia', 'Piedi a terra o sollevati'], ['Schiena arrotondata', 'Movimenti veloci']),
  F('pistol', 'Squat a una gamba', STAND, P(30, 85, 88, 82, -28, { th2: 90, sh2: 90 }), ['Una gamba tesa davanti, il tallone dell\'altra resta a terra', 'Busto che si inclina in avanti per bilanciare', 'Ginocchio in linea con la punta del piede', 'Scendi piano, risali senza slancio'], ['Tallone che si stacca', 'Ginocchio verso l\'interno', 'Cadere in basso senza controllo']),
  F('lsit', 'L-sit', P(0, 0, 0, 90, 90, { lift: 8 }), undefined, ['Spingi le mani nel pavimento e allontana le spalle dalle orecchie', 'Gambe tese e unite, punte tese', 'Addominali contratti, bacino alto', 'Respira, non trattenere'], ['Spalle che salgono', 'Ginocchia piegate', 'Schiena arrotondata']),
].map((f) => [f.id, f]));
export const FAMILY_IDS = Object.keys(FAMILIES);

/* ---------- geometria ---------- */
const L = { torso: 26, head: 6, ua: 15, fa: 14, th: 24, sh: 24, foot: 8 };
const rad = (d: number) => (d * Math.PI) / 180;
const dn = (a: number, len: number): [number, number] => [Math.sin(rad(a)) * len, Math.cos(rad(a)) * len];
export type Pt = [number, number];
export type Skeleton = { head: Pt; neck: Pt; hip: Pt; near: { shoulder: Pt; elbow: Pt; wrist: Pt; knee: Pt; ankle: Pt; toe: Pt }; far: { elbow: Pt; wrist: Pt; knee: Pt; ankle: Pt; toe: Pt }; floor: number; props: Prim[] };
export type Prim = { k: 'line'; a: Pt; b: Pt; w: number; o?: number; c?: 'prop' | 'body' | 'floor' } | { k: 'circle'; c: Pt; r: number; fill?: boolean; o?: number; col?: 'prop' | 'body' };
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];

export function skeleton(p: Pose, prop?: Prop): Skeleton {
  const H: Pt = [0, 0];
  const S = add(H, [Math.sin(rad(p.t)) * L.torso, -Math.cos(rad(p.t)) * L.torso - (p.shr ?? 0)]);
  const hd = p.h ?? p.t;
  const head = add(S, [Math.sin(rad(hd)) * (L.head + 3), -Math.cos(rad(hd)) * (L.head + 3)]);
  const arm = (ua: number, fa: number) => { const E = add(S, dn(ua, L.ua)); return { E, W: add(E, dn(fa, L.fa)) }; };
  const leg = (th: number, sh: number, ft: number) => { const K = add(H, dn(th, L.th)); const A = add(K, dn(sh, L.sh)); return { K, A, T: add(A, dn(ft, L.foot)) }; };
  const a1 = arm(p.ua, p.fa), a2 = arm(p.ua2 ?? p.ua, p.fa2 ?? p.fa);
  const l1 = leg(p.th, p.sh, p.ft ?? 90), l2 = leg(p.th2 ?? p.th, p.sh2 ?? p.sh, p.ft2 ?? p.ft ?? 90);
  const lift = p.lift ?? 0;
  const sk: Skeleton = {
    head, neck: S, hip: H,
    near: { shoulder: S, elbow: a1.E, wrist: a1.W, knee: l1.K, ankle: l1.A, toe: l1.T },
    far: { elbow: a2.E, wrist: a2.W, knee: l2.K, ankle: l2.A, toe: l2.T },
    floor: 0, props: [],
  };
  const pts: Pt[] = [head, S, H, a1.E, a1.W, a2.E, a2.W, l1.K, l1.A, l1.T, l2.K, l2.A, l2.T];
  const low = Math.max(...pts.map((q) => q[1])) + 1.5;
  /* il piano d'appoggio è il punto più basso del corpo; con un salto il corpo sta sopra */
  const dy = -low - lift;
  const sh = (q: Pt): Pt => [q[0], q[1] + dy];
  sk.head = sh(sk.head); sk.neck = sh(sk.neck); sk.hip = sh(sk.hip);
  for (const k of Object.keys(sk.near) as (keyof Skeleton['near'])[]) sk.near[k] = sh(sk.near[k]);
  for (const k of Object.keys(sk.far) as (keyof Skeleton['far'])[]) sk.far[k] = sh(sk.far[k]);
  sk.floor = 0;
  const pr = prop ?? p.prop;
  const W = sk.near.wrist, Hh = sk.hip, Ss = sk.neck;
  const hold = p.hold;
  if (hold === 'db') sk.props.push({ k: 'circle', c: W, r: 3.6, fill: true, col: 'prop' });
  if (hold === 'bar') sk.props.push({ k: 'circle', c: W, r: 5.5, fill: true, col: 'prop' });
  if (hold === 'barback') sk.props.push({ k: 'circle', c: add(Ss, [-1, -2]), r: 5.5, fill: true, col: 'prop' });
  if (hold === 'ball') sk.props.push({ k: 'circle', c: W, r: 6, col: 'prop' });
  const post = (x: number, y: number): Prim => ({ k: 'line', a: [x, y], b: [x, 0], w: 2.5, c: 'prop' });
  if (pr === 'bench') {
    if (Hh[1] < Ss[1] - 6) { const y = Ss[1] + 5, x0 = Ss[0] - 14, x1 = Ss[0] + 6; sk.props.push({ k: 'line', a: [x0, y], b: [x1, y], w: 4.5, c: 'prop' }, post(x0 + 3, y), post(x1 - 3, y)); }
    else { const y = Math.max(Ss[1], Hh[1]) + 5, x0 = Math.min(Ss[0], Hh[0]) - 12, x1 = Math.max(Ss[0], Hh[0]) + 14; sk.props.push({ k: 'line', a: [x0, y], b: [x1, y], w: 4.5, c: 'prop' }, post(x0 + 3, y), post(x1 - 3, y)); }
  }
  if (pr === 'seat') { const y = Hh[1] + 5; sk.props.push({ k: 'line', a: [Hh[0] - 12, y], b: [Hh[0] + 12, y], w: 4.5, c: 'prop' }, post(Hh[0] - 8, y), { k: 'line', a: [Hh[0] - 12, y], b: [Hh[0] - 14, y - 30], w: 3, c: 'prop' }); }
  if (pr === 'chair') { const x = Math.max(Hh[0], sk.near.toe[0]) + 14; sk.props.push({ k: 'line', a: [x - 12, -16], b: [x + 10, -16], w: 4, c: 'prop' }, post(x + 6, -16), post(x - 8, -16)); }
  if (pr === 'chairhand') { const y = W[1] + 3; sk.props.push({ k: 'line', a: [W[0] - 10, y], b: [W[0] + 8, y], w: 4, c: 'prop' }, post(W[0] - 7, y), post(W[0] + 5, y)); }
  if (pr === 'wall') { const x = Math.min(Hh[0], Ss[0], sk.near.wrist[0]) - 6; sk.props.push({ k: 'line', a: [x, -60], b: [x, 0], w: 3, c: 'prop' }); }
  if (pr === 'pullbar') sk.props.push({ k: 'line', a: [W[0] - 12, W[1] - 2], b: [W[0] + 12, W[1] - 2], w: 3.2, c: 'prop' });
  if (pr === 'band') sk.props.push({ k: 'line', a: W, b: [W[0] + 34, W[1]], w: 1.6, c: 'prop' }, { k: 'circle', c: [W[0] + 34, W[1]], r: 2.4, fill: true, col: 'prop' });
  if (pr === 'rope') sk.props.push({ k: 'circle', c: W, r: 2.4, fill: true, col: 'prop' }, { k: 'line', a: W, b: [W[0] - 18, W[1] + 28], w: 1.4, c: 'prop' });
  return sk;
}

export type LineCls = 'body' | 'prop' | 'floor' | 'shirt' | 'skin' | 'shoe';
export type CircleCls = 'body' | 'prop' | 'skin' | 'hair';
export type Panel = { lines: { a: Pt; b: Pt; w: number; o: number; c: LineCls }[]; circles: { c: Pt; r: number; fill: boolean; col: CircleCls }[] };
/** Disegno delle due pose, già adattato a un riquadro 100×100 (stessa scala per entrambe). L'omino ha maglia, pelle, capelli, mani e scarpe. */
export function figurePanels(fam: Family): Panel[] {
  const poses = [fam.a, ...(fam.b ? [fam.b] : [])];
  const sks = poses.map((p) => skeleton(p, p.prop ?? fam.prop));
  const all: Pt[] = [];
  for (const s of sks) { all.push(s.head, s.neck, s.hip, ...Object.values(s.near), ...Object.values(s.far)); for (const pr of s.props) { if (pr.k === 'line') all.push(pr.a, pr.b); else all.push(pr.c); } all.push([0, 0]); }
  const xs = all.map((q) => q[0]), ys = all.map((q) => q[1]);
  const minX = Math.min(...xs) - 8, maxX = Math.max(...xs) + 8, minY = Math.min(...ys) - 8, maxY = Math.max(...ys) + 6;
  const k = Math.min(100 / (maxX - minX), 100 / (maxY - minY));
  const ox = (100 - (maxX - minX) * k) / 2, oy = (100 - (maxY - minY) * k) / 2;
  const T = (q: Pt): Pt => [(q[0] - minX) * k + ox, (q[1] - minY) * k + oy];
  const sc = Math.max(0.7, k * 0.9);
  return sks.map((s) => {
    const lines: Panel['lines'] = []; const circles: Panel['circles'] = [];
    const seg = (a: Pt, b: Pt, w = 3.4, o = 1, c: LineCls = 'body') => lines.push({ a: T(a), b: T(b), w: w * sc, o, c });
    const dot = (c: Pt, r: number, col: CircleCls, fill = true) => circles.push({ c: T(c), r: r * sc, fill, col });
    seg([minX, 0], [maxX, 0], 1.2, 0.5, 'floor');
    /* arti lontani (più chiari): gamba con scarpa, braccio con manica e mano */
    seg(s.hip, s.far.knee, 5.2, 0.5); seg(s.far.knee, s.far.ankle, 4.6, 0.5); seg(s.far.ankle, s.far.toe, 4.2, 0.55, 'shoe');
    seg(s.neck, s.far.elbow, 4.6, 0.55, 'shirt'); seg(s.far.elbow, s.far.wrist, 3.8, 0.55, 'skin'); dot(s.far.wrist, 2.1, 'skin');
    for (const pr of s.props) { if (pr.k === 'line') seg(pr.a, pr.b, pr.w, 1, 'prop'); }
    /* busto con la maglia, poi gamba vicina (pantaloni), piede (scarpa), braccio vicino */
    seg(s.hip, s.neck, 8.6, 1, 'shirt');
    seg(s.hip, s.near.knee, 5.8); seg(s.near.knee, s.near.ankle, 4.8); seg(s.near.ankle, s.near.toe, 4.4, 1, 'shoe');
    seg(s.neck, s.near.elbow, 5, 1, 'shirt'); seg(s.near.elbow, s.near.wrist, 4, 1, 'skin'); dot(s.near.wrist, 2.3, 'skin');
    /* testa: collo, capelli dietro, viso davanti (guarda verso destra) */
    seg(s.neck, s.head, 3, 1, 'skin');
    dot([s.head[0] - 0.8, s.head[1] - 0.6], 6.4, 'hair'); dot([s.head[0] + 0.9, s.head[1] + 0.5], 5.6, 'skin');
    for (const pr of s.props) { if (pr.k === 'circle') circles.push({ c: T(pr.c), r: pr.r * k, fill: !!pr.fill, col: 'prop' }); }
    return { lines, circles };
  });
}
