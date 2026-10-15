/** Dati di LifeFitness (modulo PURO): esercizi, programmi specializzati, centri convenzionati di esempio. */

export type Equip = 'nessuno' | 'manubri' | 'elastico' | 'palestra' | 'piscina';
export type Muscle = 'gambe' | 'glutei' | 'petto' | 'schiena' | 'spalle' | 'braccia' | 'core' | 'corpo intero' | 'cardio' | 'mobilità';
export type Exercise = { id: string; name: string; muscle: Muscle; equip: Equip; how: string; timed?: boolean };

const E = (id: string, name: string, muscle: Muscle, equip: Equip, how: string, timed = false): Exercise => ({ id, name, muscle, equip, how, ...(timed ? { timed } : {}) });
export const EXERCISES: Exercise[] = [
  E('squat', 'Squat a corpo libero', 'gambe', 'nessuno', 'Piedi larghi come le spalle, scendi con la schiena dritta fino a cosce parallele, risali spingendo sui talloni.'),
  E('affondi', 'Affondi alternati', 'gambe', 'nessuno', 'Un passo avanti, ginocchio dietro che sfiora il pavimento, busto eretto. Alterna le gambe.'),
  E('ponte', 'Ponte glutei', 'glutei', 'nessuno', 'Sdraiato, piedi a terra, solleva il bacino stringendo i glutei e tieni un secondo in alto.'),
  E('pushup', 'Flessioni', 'petto', 'nessuno', 'Mani sotto le spalle, corpo in linea, scendi con il petto verso il pavimento e spingi. Su ginocchia se serve.'),
  E('plank', 'Plank', 'core', 'nessuno', 'Avambracci a terra, corpo dritto dalla testa ai talloni, addominali e glutei contratti.', true),
  E('mountain', 'Mountain climber', 'cardio', 'nessuno', 'In posizione di flessione porta le ginocchia al petto, alternando a ritmo veloce.', true),
  E('jumping', 'Jumping jack', 'cardio', 'nessuno', 'Salta aprendo braccia e gambe, poi richiudi. Ritmo costante.', true),
  E('burpee', 'Burpee', 'corpo intero', 'nessuno', 'Scendi in flessione, torna in piedi con un piccolo salto. Fai la versione senza salto se serve.'),
  E('crunch', 'Crunch addominali', 'core', 'nessuno', 'Sdraiato, ginocchia piegate, solleva spalle e petto senza tirare il collo.'),
  E('bird', 'Bird dog', 'core', 'nessuno', 'A quattro zampe estendi braccio e gamba opposti, schiena ferma. Alterna.'),
  E('dips', 'Dip su sedia', 'braccia', 'nessuno', 'Mani su una sedia stabile, scendi piegando i gomiti all\'indietro e risali.'),
  E('pike', 'Pike push-up', 'spalle', 'nessuno', 'A V rovesciata, scendi con la testa tra le mani e spingi: lavora le spalle.'),
  E('superman', 'Superman', 'schiena', 'nessuno', 'A pancia in giù solleva braccia e gambe insieme, tieni un secondo.'),
  E('wallsit', 'Wall sit', 'gambe', 'nessuno', 'Schiena al muro, cosce parallele al pavimento, resisti.', true),
  E('cat', 'Gatto-cammello', 'mobilità', 'nessuno', 'A quattro zampe arrotonda e inarca la schiena lentamente, respirando.'),
  E('hip', 'Apertura anche (90/90)', 'mobilità', 'nessuno', 'Seduto con le gambe a 90 gradi ruota il bacino da un lato all\'altro con la schiena lunga.'),
  E('stretchq', 'Stretching quadricipiti', 'mobilità', 'nessuno', 'In piedi porta il tallone al gluteo, ginocchia vicine, tieni 30 secondi per lato.', true),
  E('child', 'Posizione del bambino', 'mobilità', 'nessuno', 'In ginocchio, siediti sui talloni e allunga le braccia avanti, respira lentamente.', true),
  E('gsquat', 'Goblet squat', 'gambe', 'manubri', 'Un manubrio al petto, scendi in squat mantenendo il busto alto.'),
  E('rdl', 'Stacco rumeno', 'glutei', 'manubri', 'Manubri davanti alle cosce, piega le anche indietro con schiena piatta, risali stringendo i glutei.'),
  E('press', 'Spinte sopra la testa', 'spalle', 'manubri', 'Dalle spalle spingi i manubri in alto senza inarcare la schiena.'),
  E('row', 'Rematore con manubrio', 'schiena', 'manubri', 'Appoggiato a una panca, tira il manubrio verso l\'anca con il gomito vicino al corpo.'),
  E('curl', 'Curl bicipiti', 'braccia', 'manubri', 'Gomiti fermi ai fianchi, fletti i manubri e scendi lentamente.'),
  E('bandrow', 'Tirate con elastico', 'schiena', 'elastico', 'Elastico fissato davanti, tira verso il petto stringendo le scapole.'),
  E('bandpress', 'Spinte con elastico', 'petto', 'elastico', 'Elastico dietro la schiena, spingi in avanti con le mani all\'altezza del petto.'),
  E('bandwalk', 'Camminata laterale con elastico', 'glutei', 'elastico', 'Elastico sopra le ginocchia, passi laterali mantenendo la tensione.'),
  E('legpress', 'Leg press', 'gambe', 'palestra', 'Spingi la piattaforma senza bloccare le ginocchia, schiena appoggiata.'),
  E('bench', 'Panca piana', 'petto', 'palestra', 'Bilanciere al petto, spingi in alto con scapole ferme. Chiedi un aiuto per sicurezza.'),
  E('lat', 'Lat machine', 'schiena', 'palestra', 'Tira la barra al petto con la schiena dritta, gomiti verso il basso.'),
  E('squatbar', 'Squat con bilanciere', 'gambe', 'palestra', 'Bilanciere sulla schiena, scendi controllato con core attivo. Parti leggero.'),
  E('deadlift', 'Stacco da terra', 'schiena', 'palestra', 'Bilanciere vicino alle gambe, schiena neutra, spingi i piedi nel pavimento. Parti leggero.'),
  E('cable', 'Croci ai cavi', 'petto', 'palestra', 'Cavi all\'altezza delle spalle, chiudi le braccia davanti al petto con gomiti morbidi.'),
  E('treadmill', 'Tapis roulant', 'cardio', 'palestra', 'Cammina o corri al ritmo indicato dal programma.', true),
  E('bike', 'Cyclette', 'cardio', 'palestra', 'Pedala a ritmo regolare e resistenza moderata.', true),
  E('rowerg', 'Vogatore', 'cardio', 'palestra', 'Spingi con le gambe, poi tira con la schiena e le braccia. Ritmo costante.', true),
  E('swim', 'Nuoto libero', 'cardio', 'piscina', 'Vasche a stile libero a ritmo regolare, respirando ogni 3 bracciate.', true),
  E('aquajog', 'Corsa in acqua', 'cardio', 'piscina', 'In acqua alta, simula la corsa senza toccare il fondo: a basso impatto.', true),
  E('run', 'Corsa', 'cardio', 'nessuno', 'Corri al ritmo indicato: dovresti riuscire a parlare a frasi corte.', true),
  E('walk', 'Camminata veloce', 'cardio', 'nessuno', 'Cammina a passo svelto, braccia che oscillano.', true),
];
export const EX = (id: string): Exercise | undefined => EXERCISES.find((e) => e.id === id);

export type Goal = 'dimagrire' | 'tonificare' | 'massa' | 'forza' | 'resistenza' | 'mobilità' | 'salute';
export type Level = 'principiante' | 'intermedio' | 'avanzato';
export type Place = 'casa' | 'palestra' | 'piscina';
export type Step = { ex: string; sets: number; reps?: number; secs?: number; rest: number };
export type Session = { name: string; steps: Step[] };
export type Program = { id: string; name: string; tagline: string; goal: Goal; level: Level; place: Place; days: number; weeks: number; specialty?: string; sessions: Session[]; /** per chi è pensato */ who?: string; /** perché è fatto così */ why?: string; /** avvertenze */ caution?: string; /** bisogni a cui risponde */ tags?: string[] };

const S = (ex: string, sets: number, reps: number, rest = 60): Step => ({ ex, sets, reps, rest });
const T = (ex: string, sets: number, secs: number, rest = 45): Step => ({ ex, sets, secs, rest });
const P = (id: string, name: string, tagline: string, goal: Goal, level: Level, place: Place, days: number, weeks: number, sessions: Session[], specialty?: string): Program => ({ id, name, tagline, goal, level, place, days, weeks, sessions, ...(specialty ? { specialty } : {}) });

export const PROGRAMS: Program[] = [
  P('casa-start', 'Casa: si parte', 'Corpo libero, 20 minuti, zero attrezzi', 'salute', 'principiante', 'casa', 3, 6, [
    { name: 'Giorno A · Tutto il corpo', steps: [S('squat', 3, 12), S('pushup', 3, 8), S('ponte', 3, 12), T('plank', 3, 20), T('jumping', 2, 30)] },
    { name: 'Giorno B · Gambe e core', steps: [S('affondi', 3, 10), S('crunch', 3, 15), S('bird', 3, 10), T('wallsit', 3, 25), S('superman', 3, 10)] },
  ]),
  P('casa-dimagrire', 'Brucia a casa', 'Circuiti ad alta intensità per dimagrire', 'dimagrire', 'intermedio', 'casa', 4, 8, [
    { name: 'Circuito 1', steps: [S('burpee', 4, 10, 40), T('mountain', 4, 35, 30), S('squat', 4, 20, 30), T('jumping', 4, 45, 30)] },
    { name: 'Circuito 2', steps: [S('affondi', 4, 16, 40), S('pushup', 4, 12, 30), T('plank', 4, 40, 30), S('crunch', 4, 25, 30)] },
  ]),
  P('calisthenics', 'Calisthenics', 'Forza e controllo del corpo libero', 'forza', 'intermedio', 'casa', 4, 10, [
    { name: 'Spinta', steps: [S('pushup', 5, 12), S('pike', 4, 8), S('dips', 4, 12), T('plank', 3, 45)] },
    { name: 'Gambe e core', steps: [S('squat', 5, 20), S('affondi', 4, 14), T('wallsit', 3, 45), S('ponte', 4, 15), S('crunch', 4, 25)] },
  ], 'Corpo libero'),
  P('manubri-tono', 'Tonificare con i manubri', 'Due manubri e tanta costanza', 'tonificare', 'principiante', 'casa', 3, 8, [
    { name: 'Parte alta', steps: [S('press', 3, 12), S('row', 3, 12), S('curl', 3, 12), S('pushup', 3, 8)] },
    { name: 'Parte bassa', steps: [S('gsquat', 3, 12), S('rdl', 3, 12), S('affondi', 3, 10), T('plank', 3, 30)] },
  ]),
  P('elastico', 'Elastici ovunque', 'Allenamento leggero da portare in viaggio', 'tonificare', 'principiante', 'casa', 3, 6, [
    { name: 'Tutto il corpo', steps: [S('bandrow', 3, 15), S('bandpress', 3, 12), S('bandwalk', 3, 12), S('squat', 3, 15), T('plank', 3, 25)] },
  ], 'In viaggio'),
  P('palestra-start', 'Palestra: primi passi', 'Impari le macchine in sicurezza', 'salute', 'principiante', 'palestra', 3, 8, [
    { name: 'Giorno A', steps: [S('legpress', 3, 12), S('lat', 3, 12), S('bench', 3, 10), T('bike', 1, 600)] },
    { name: 'Giorno B', steps: [S('gsquat', 3, 12), S('row', 3, 12), S('press', 3, 10), T('treadmill', 1, 600)] },
  ]),
  P('massa', 'Massa muscolare', 'Ipertrofia in 4 giorni: spinta, tirata, gambe, richiamo', 'massa', 'intermedio', 'palestra', 4, 12, [
    { name: 'Spinta', steps: [S('bench', 4, 8, 90), S('press', 4, 10), S('cable', 3, 12), S('dips', 3, 12)] },
    { name: 'Tirata', steps: [S('deadlift', 4, 6, 120), S('lat', 4, 10, 90), S('row', 3, 10), S('curl', 3, 12)] },
    { name: 'Gambe', steps: [S('squatbar', 4, 8, 120), S('legpress', 4, 12, 90), S('rdl', 3, 10), S('ponte', 3, 15)] },
    { name: 'Richiamo', steps: [S('bench', 3, 10, 90), S('lat', 3, 12), S('gsquat', 3, 12), T('plank', 3, 45)] },
  ], 'Ipertrofia'),
  P('forza', 'Forza di base', 'I tre grandi schemi con progressione lenta', 'forza', 'avanzato', 'palestra', 3, 12, [
    { name: 'Squat e panca', steps: [S('squatbar', 5, 5, 150), S('bench', 5, 5, 150), S('row', 3, 8)] },
    { name: 'Stacco e spinte', steps: [S('deadlift', 5, 3, 180), S('press', 4, 6, 120), S('lat', 3, 8)] },
  ], 'Powerlifting'),
  P('cardio-palestra', 'Cardio e definizione', 'Macchine cardio e pesi leggeri', 'dimagrire', 'intermedio', 'palestra', 4, 8, [
    { name: 'Cardio misto', steps: [T('treadmill', 1, 1200), T('rowerg', 1, 600), T('bike', 1, 600), T('plank', 3, 40)] },
    { name: 'Pesi e core', steps: [S('legpress', 3, 15, 45), S('lat', 3, 15, 45), S('cable', 3, 15, 45), S('crunch', 3, 25, 30)] },
  ]),
  P('corsa-5k', 'Corsa: i tuoi primi 5 km', 'Alterni camminata e corsa fino a correre 30 minuti', 'resistenza', 'principiante', 'casa', 3, 8, [
    { name: 'Uscita 1', steps: [T('walk', 1, 300), T('run', 6, 90, 90), T('walk', 1, 300)] },
    { name: 'Uscita 2', steps: [T('walk', 1, 300), T('run', 5, 120, 90), T('walk', 1, 300)] },
    { name: 'Uscita 3 · lunga', steps: [T('walk', 1, 300), T('run', 3, 300, 120), T('walk', 1, 300)] },
  ], 'Corsa'),
  P('corsa-10k', 'Corsa: 10 km', 'Ripetute, ritmo e lungo per i 10 km', 'resistenza', 'intermedio', 'casa', 4, 10, [
    { name: 'Ripetute', steps: [T('run', 1, 600), T('run', 6, 120, 90), T('walk', 1, 300)] },
    { name: 'Ritmo', steps: [T('run', 1, 1800)] },
    { name: 'Lungo lento', steps: [T('run', 1, 3000)] },
  ], 'Corsa'),
  P('nuoto', 'Nuoto: resistenza', 'Vasche progressive e corsa in acqua', 'resistenza', 'intermedio', 'piscina', 3, 8, [
    { name: 'Vasche', steps: [T('swim', 8, 120, 30)] },
    { name: 'Misto', steps: [T('swim', 4, 180, 30), T('aquajog', 1, 600)] },
  ], 'Piscina'),
  P('acqua-dolce', 'Acqua dolce', 'Basso impatto per articolazioni e ripartenze', 'salute', 'principiante', 'piscina', 2, 6, [
    { name: 'Corsa in acqua', steps: [T('aquajog', 1, 900), T('swim', 4, 60, 30)] },
  ], 'Basso impatto'),
  P('mobilita', 'Mobilità e postura', 'Sciogli schiena e anche in 15 minuti', 'mobilità', 'principiante', 'casa', 5, 4, [
    { name: 'Routine mattutina', steps: [S('cat', 2, 10, 20), S('hip', 2, 8, 20), T('stretchq', 2, 30, 15), T('child', 2, 40, 15)] },
  ], 'Postura'),
  P('schiena', 'Schiena in forma', 'Rinforzo gentile per chi sta molto seduto', 'salute', 'principiante', 'casa', 3, 6, [
    { name: 'Core e schiena', steps: [S('bird', 3, 10, 30), S('superman', 3, 10, 30), T('plank', 3, 20, 30), S('ponte', 3, 12, 30), S('cat', 2, 10, 20)] },
  ], 'Mal di schiena'),
  P('over50', 'Over 50 attivi', 'Equilibrio, forza e articolazioni protette', 'salute', 'principiante', 'casa', 3, 8, [
    { name: 'Forza dolce', steps: [S('squat', 2, 10, 60), S('ponte', 2, 12, 45), S('bandrow', 2, 12, 45), T('walk', 1, 600), S('cat', 2, 8, 20)] },
  ], 'Over 50'),
];

/* ---------- centri convenzionati (esempi) ---------- */
export type GymKind = 'palestra' | 'piscina' | 'centro';
export type Gym = { id: string; name: string; kind: GymKind; city: string; address: string; services: string[]; hours: string; rating: number };
const G = (id: string, name: string, kind: GymKind, city: string, address: string, services: string, hours: string, rating: number): Gym => ({ id, name, kind, city, address, services: services.split(',').map((x) => x.trim()), hours, rating });
export const PARTNER_GYMS: Gym[] = [
  G('g1', 'Palestra Riva', 'palestra', 'Lugano', 'Via Nassa 12', 'Sala pesi, Cardio, Corsi di gruppo', 'Lun-Ven 6-22 · Sab-Dom 8-18', 4.6),
  G('g2', 'Acquamarina', 'piscina', 'Lugano', 'Viale Cattaneo 8', 'Piscina 25 m, Acquagym, Sauna', 'Lun-Dom 7-21', 4.5),
  G('g3', 'Centro Sport Ceresio', 'centro', 'Lugano', 'Via Ceresio 31', 'Tennis, Squash, Sala pesi, Spa', 'Lun-Dom 7-23', 4.7),
  G('g4', 'Fit Bellinzona', 'palestra', 'Bellinzona', 'Via Camminata 5', 'Sala pesi, Cross training, Yoga', 'Lun-Ven 6-22 · Sab 8-16', 4.3),
  G('g5', 'Nuoto Castelli', 'piscina', 'Bellinzona', 'Viale Stazione 14', 'Piscina 25 m, Corsi nuoto', 'Lun-Sab 7-21', 4.4),
  G('g6', 'Lago Fitness', 'palestra', 'Locarno', 'Lungolago 3', 'Sala pesi, Cardio, Pilates', 'Lun-Ven 6-22 · Sab-Dom 9-17', 4.5),
  G('g7', 'Centro Maggia', 'centro', 'Locarno', 'Via Franscini 20', 'Palestra, Piscina, Sauna, Squash', 'Lun-Dom 7-22', 4.6),
  G('g8', 'Mendrisio Training', 'palestra', 'Mendrisio', 'Via Lavizzari 9', 'Sala pesi, Functional, Boxe', 'Lun-Ven 6-22', 4.2),
  G('g9', 'Aqua Chiasso', 'piscina', 'Chiasso', 'Via Valdani 2', 'Piscina 25 m, Acquagym', 'Lun-Dom 7-21', 4.1),
  G('g10', 'Yoga e Respiro', 'centro', 'Lugano', 'Via Pioda 4', 'Yoga, Pilates, Meditazione', 'Lun-Sab 8-21', 4.8),
  G('g11', 'Arrampica Ticino', 'centro', 'Giubiasco', 'Via Industria 17', 'Arrampicata indoor, Boulder', 'Lun-Dom 10-22', 4.6),
  G('g12', 'Forza Mendrisiotto', 'palestra', 'Balerna', 'Via Stazione 6', 'Sala pesi, Powerlifting, Cardio', 'Lun-Ven 6-22 · Sab 8-16', 4.4),
];
