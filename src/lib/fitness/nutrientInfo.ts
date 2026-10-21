/**
 * Schede dei nutrienti (modulo PURO): cos'è, a cosa serve, dove si trova (alimenti con la quantità per 100 g e per una porzione).
 * Valori approssimativi da tabelle di composizione degli alimenti (CREA e USDA), arrotondati: servono a dare un'idea dell'ordine di grandezza.
 * Informazioni generali, non un consiglio medico o nutrizionale.
 */
import { MICRO_INFO, type MicroKey } from './micro.ts';

export type NutrientId = MicroKey | 'protein' | 'carbs' | 'fat' | 'sat' | 'sugar' | 'fibre' | 'salt' | 'water';
export type FoodSource = {
  name: string;
  /** quantità nel nutriente ogni 100 g di alimento (nell'unità del nutriente) */
  per100: number;
  /** porzione tipica, in grammi, e come si dice */
  portion: number;
  portionLabel: string;
  /** una riga su come e quando mangiarlo */
  note: string;
  /** altri nutrienti per cui vale la pena */
  also?: string;
};
export type NutrientInfo = {
  id: NutrientId;
  label: string;
  unit: 'µg' | 'mg' | 'g' | 'L';
  kind: 'vitamina' | 'minerale' | 'macronutriente' | 'da limitare' | 'altro';
  /** a cosa serve, in una o due frasi */
  what: string;
  /** perché fa bene */
  why: string[];
  /** 5 alimenti dove si trova, dal più ricco */
  sources: FoodSource[];
  tip: string;
  /** attenzioni (eccessi, integratori, farmaci) */
  caution?: string;
  /** riferimento giornaliero in parole */
  ref: string;
};

const S = (name: string, per100: number, portion: number, portionLabel: string, note: string, also?: string): FoodSource => ({ name, per100, portion, portionLabel, note, ...(also ? { also } : {}) });

export const NUTRIENTS: Record<NutrientId, NutrientInfo> = {
  vitA: {
    id: 'vitA', label: 'Vitamina A', unit: 'µg', kind: 'vitamina', ref: 'Riferimento: 800 µg al giorno.',
    what: 'Serve alla vista (soprattutto al buio), alla pelle, alle mucose e alle difese immunitarie.',
    why: ['Aiuta la vista e tiene sane pelle e mucose.', 'Sostiene le difese immunitarie.'],
    sources: [
      S('Carote', 835, 80, '1 carota media', 'Crude o cotte con un goccio d\'olio: il corpo la assorbe meglio.', 'fibre, potassio'),
      S('Patata dolce', 709, 150, '1 patata dolce piccola', 'Al forno o al vapore.', 'potassio, vitamina C'),
      S('Spinaci', 469, 100, '1 porzione cotta', 'Cotti o crudi nelle insalate.', 'vitamina K, folati, ferro'),
      S('Zucca', 426, 200, '1 porzione', 'In zuppa o al forno.', 'potassio, fibre'),
      S('Uova', 160, 60, '1 uovo', 'Il tuorlo è la parte più ricca.', 'vitamina B12, vitamina D'),
    ],
    tip: 'Le verdure arancioni e verdi danno provitamina A: con un po\' d\'olio si assorbe meglio.',
    caution: 'Non esagerare con gli integratori di vitamina A: in eccesso può fare male, soprattutto in gravidanza.',
  },
  vitC: {
    id: 'vitC', label: 'Vitamina C', unit: 'mg', kind: 'vitamina', ref: 'Riferimento: 80 mg al giorno.',
    what: 'È un antiossidante: serve alla pelle (produzione di collagene), alle difese e ad assorbire meglio il ferro dei vegetali.',
    why: ['Protegge le cellule dallo stress ossidativo.', 'Aiuta pelle, vasi e gengive.', 'Fa assorbire meglio il ferro di legumi e verdure.'],
    sources: [
      S('Peperone rosso', 128, 120, '1 peperone piccolo', 'Meglio crudo o cotto poco.', 'vitamina A'),
      S('Kiwi', 93, 80, '1 kiwi', 'Un kiwi al giorno copre quasi tutto il fabbisogno.', 'fibre, vitamina K'),
      S('Broccoli', 89, 150, '1 porzione', 'Al vapore pochi minuti: la cottura lunga distrugge la vitamina C.', 'folati, vitamina K'),
      S('Fragole', 59, 150, '1 coppetta', 'Fresche, di stagione.', 'fibre, manganese'),
      S('Arance', 53, 180, '1 arancia', 'Meglio il frutto intero della spremuta: tiene le fibre.', 'folati, potassio'),
    ],
    tip: 'Si rovina con il calore e con la conservazione lunga: meglio crude o cotte poco.',
  },
  vitD: {
    id: 'vitD', label: 'Vitamina D', unit: 'µg', kind: 'vitamina', ref: 'Riferimento: 5 µg al giorno (200 UI).',
    what: 'Serve a ossa, denti e muscoli: aiuta ad assorbire il calcio.',
    why: ['Aiuta il calcio a fissarsi nelle ossa.', 'Sostiene i muscoli e le difese.'],
    sources: [
      S('Sgombro', 16, 120, '1 filetto', 'Anche in scatola, al naturale.', 'omega-3, vitamina B12'),
      S('Salmone', 11, 130, '1 trancio', 'Al forno o alla piastra.', 'omega-3, vitamina B12'),
      S('Sardine', 5, 100, '1 scatoletta piccola', 'Fresche o in scatola.', 'calcio, omega-3'),
      S('Uova', 2, 60, '1 uovo', 'Il tuorlo contiene la vitamina D.', 'vitamina A, B12'),
      S('Funghi esposti al sole', 2, 100, '1 porzione', 'Contano solo se sono stati esposti alla luce.', 'vitamine del gruppo B'),
    ],
    tip: 'Gran parte la produce la pelle con il sole: d\'inverno, o se stai poco all\'aperto, il cibo da solo spesso non basta.',
    caution: 'Gli integratori di vitamina D vanno presi solo se te li indica il medico: in eccesso fanno male.',
  },
  vitE: {
    id: 'vitE', label: 'Vitamina E', unit: 'mg', kind: 'vitamina', ref: 'Riferimento: 12 mg al giorno.',
    what: 'È un antiossidante che protegge le cellule, in particolare le membrane.',
    why: ['Protegge le cellule dallo stress ossidativo.', 'Aiuta la pelle.'],
    sources: [
      S('Semi di girasole', 35, 20, '1 cucchiaio e mezzo', 'Sulle insalate o nello yogurt.', 'magnesio, vitamina B1'),
      S('Mandorle', 26, 30, 'una manciata', 'Una manciata come spuntino.', 'magnesio, calcio, fibre'),
      S('Nocciole', 15, 30, 'una manciata', 'Al naturale, non salate né tostate con zucchero.', 'fibre, magnesio'),
      S('Olio extravergine d\'oliva', 14, 10, '1 cucchiaio', 'Crudo sulle verdure.', 'grassi monoinsaturi'),
      S('Avocado', 2, 100, '½ avocado', 'Nelle insalate o sul pane integrale.', 'potassio, fibre, folati'),
    ],
    tip: 'Si trova soprattutto in frutta secca, semi e oli: una manciata al giorno basta.',
  },
  vitK: {
    id: 'vitK', label: 'Vitamina K', unit: 'µg', kind: 'vitamina', ref: 'Riferimento: 75 µg al giorno.',
    what: 'Serve alla coagulazione del sangue e alla salute delle ossa.',
    why: ['Permette al sangue di coagulare.', 'Contribuisce alla salute delle ossa.'],
    sources: [
      S('Spinaci', 483, 100, '1 porzione', 'Crudi o cotti.', 'vitamina A, folati, ferro'),
      S('Cavolo riccio', 390, 80, '1 porzione', 'In padella o nei frullati.', 'vitamina C, calcio'),
      S('Cavolini di Bruxelles', 177, 100, '1 porzione', 'Al vapore o al forno.', 'vitamina C, fibre'),
      S('Rucola', 109, 50, '1 manciata', 'Cruda nelle insalate.', 'folati, calcio'),
      S('Broccoli', 102, 150, '1 porzione', 'Al vapore.', 'vitamina C, folati'),
    ],
    tip: 'Si trova nelle verdure a foglia verde: è un buon motivo per averne una porzione al giorno.',
    caution: 'Se prendi anticoagulanti (come il warfarin) il medico ti chiede di tenere costante la quantità di vitamina K: non cambiare la dieta senza sentirlo.',
  },
  b1: {
    id: 'b1', label: 'Vitamina B1', unit: 'mg', kind: 'vitamina', ref: 'Riferimento: 1,1 mg al giorno.',
    what: 'Aiuta a ricavare energia dai carboidrati e serve a nervi e muscoli.',
    why: ['Aiuta a trasformare i carboidrati in energia.', 'Serve al sistema nervoso e al cuore.'],
    sources: [
      S('Semi di girasole', 1.5, 20, '1 cucchiaio e mezzo', 'Nello yogurt o sulle insalate.', 'vitamina E, magnesio'),
      S('Pistacchi', 0.9, 30, 'una manciata', 'Al naturale.', 'vitamina B6, fibre'),
      S('Carne di maiale', 0.9, 120, '1 fetta', 'Magra, alla piastra o al forno.', 'proteine, zinco'),
      S('Lenticchie secche', 0.9, 60, '1 porzione (da secche)', 'In zuppa o come contorno.', 'ferro, folati, fibre'),
      S('Riso integrale', 0.4, 80, '1 porzione (da secco)', 'Meglio dell\'integrale rispetto al riso bianco raffinato.', 'magnesio, fibre'),
    ],
    tip: 'I cereali integrali ne hanno più di quelli raffinati: la vitamina B1 sta soprattutto nella parte esterna del chicco.',
  },
  b2: {
    id: 'b2', label: 'Vitamina B2', unit: 'mg', kind: 'vitamina', ref: 'Riferimento: 1,4 mg al giorno.',
    what: 'Aiuta a ricavare energia dal cibo e serve a pelle, occhi e sistema nervoso.',
    why: ['Aiuta a produrre energia.', 'Serve a pelle, occhi e mucose.'],
    sources: [
      S('Mandorle', 1.1, 30, 'una manciata', 'Come spuntino.', 'vitamina E, magnesio, calcio'),
      S('Uova', 0.46, 60, '1 uovo', 'Sode, in camicia o in frittata.', 'vitamina B12, vitamina D'),
      S('Funghi champignon', 0.4, 100, '1 porzione', 'Trifolati o crudi.', 'vitamina B3, potassio'),
      S('Parmigiano', 0.4, 20, '1 cucchiaio colmo', 'Una spolverata sui piatti.', 'calcio, proteine'),
      S('Latte', 0.17, 200, '1 bicchiere', 'Intero o parzialmente scremato.', 'calcio, vitamina B12'),
    ],
    tip: 'La luce la distrugge: il latte conservato in contenitori opachi la mantiene meglio.',
  },
  b3: {
    id: 'b3', label: 'Vitamina B3', unit: 'mg', kind: 'vitamina', ref: 'Riferimento: 16 mg al giorno.',
    what: 'Aiuta a produrre energia e serve a pelle, intestino e sistema nervoso.',
    why: ['Aiuta il corpo a ricavare energia.', 'Serve a pelle e sistema nervoso.'],
    sources: [
      S('Arachidi', 12, 30, 'una manciata', 'Al naturale, non salate.', 'proteine, magnesio'),
      S('Petto di pollo', 10, 120, '1 fetta', 'Alla piastra o al forno.', 'proteine, vitamina B6'),
      S('Tonno', 9, 100, '1 porzione', 'Fresco o al naturale in scatola.', 'proteine, vitamina B12, omega-3'),
      S('Salmone', 8, 130, '1 trancio', 'Al forno o alla piastra.', 'omega-3, vitamina D'),
      S('Funghi champignon', 4, 100, '1 porzione', 'Trifolati.', 'vitamina B2'),
    ],
    tip: 'Nei cibi mediamente vari se ne assume abbastanza: è raro che manchi.',
  },
  b6: {
    id: 'b6', label: 'Vitamina B6', unit: 'mg', kind: 'vitamina', ref: 'Riferimento: 1,4 mg al giorno.',
    what: 'Serve al metabolismo delle proteine, al sistema nervoso e alla produzione di globuli rossi.',
    why: ['Aiuta a usare le proteine.', 'Serve a nervi e globuli rossi.'],
    sources: [
      S('Pistacchi', 1.7, 30, 'una manciata', 'Al naturale.', 'vitamina B1, fibre'),
      S('Tonno', 0.9, 100, '1 porzione', 'Fresco o al naturale.', 'vitamina B3, omega-3'),
      S('Salmone', 0.6, 130, '1 trancio', 'Al forno.', 'omega-3, vitamina D'),
      S('Petto di pollo', 0.6, 120, '1 fetta', 'Alla piastra.', 'proteine, vitamina B3'),
      S('Banana', 0.4, 120, '1 banana', 'Come spuntino.', 'potassio, magnesio'),
    ],
    tip: 'Un po\' di pesce, carne bianca e frutta nella giornata di solito bastano.',
  },
  b12: {
    id: 'b12', label: 'Vitamina B12', unit: 'µg', kind: 'vitamina', ref: 'Riferimento: 2,5 µg al giorno.',
    what: 'Serve a globuli rossi e sistema nervoso. Si trova quasi solo negli alimenti di origine animale.',
    why: ['Serve alla formazione dei globuli rossi.', 'Serve al sistema nervoso.'],
    sources: [
      S('Vongole', 99, 100, '1 porzione', 'Sono la fonte più ricca, ma ne bastano piccole quantità.', 'ferro, proteine'),
      S('Sardine', 9, 100, '1 scatoletta piccola', 'Fresche o in scatola.', 'vitamina D, calcio, omega-3'),
      S('Salmone', 3, 130, '1 trancio', 'Al forno o alla piastra.', 'omega-3, vitamina D'),
      S('Carne di manzo', 2.6, 120, '1 fetta', 'Magra, con moderazione.', 'ferro, zinco'),
      S('Uova', 1.1, 60, '1 uovo', 'Sode o in camicia.', 'vitamina A, vitamina D'),
    ],
    tip: 'Latte, yogurt e formaggi ne danno quantità minori ma costanti.',
    caution: 'Chi non mangia alimenti di origine animale di solito ha bisogno di alimenti fortificati o di integratori: parlane con il medico.',
  },
  folate: {
    id: 'folate', label: 'Folati', unit: 'µg', kind: 'vitamina', ref: 'Riferimento: 200 µg al giorno.',
    what: 'Servono a creare nuove cellule e globuli rossi; sono importanti prima e durante la gravidanza.',
    why: ['Servono a formare cellule e globuli rossi.', 'Sono importanti nelle prime settimane di gravidanza.'],
    sources: [
      S('Spinaci', 194, 100, '1 porzione', 'Crudi: la cottura ne riduce la quantità.', 'vitamina K, vitamina A, ferro'),
      S('Lenticchie cotte', 181, 150, '1 porzione', 'In zuppa o come contorno.', 'ferro, fibre, proteine'),
      S('Ceci cotti', 172, 150, '1 porzione', 'In zuppa, insalata o hummus.', 'fibre, proteine, ferro'),
      S('Asparagi cotti', 149, 150, '1 porzione', 'Al vapore.', 'vitamina K, vitamina C'),
      S('Avocado', 81, 100, '½ avocado', 'Nelle insalate.', 'potassio, vitamina E'),
    ],
    tip: 'Legumi e verdure a foglia verde sono le fonti migliori; si perdono con la cottura lunga.',
    caution: 'Se cerchi una gravidanza o sei incinta, parlane con il medico o la ginecologa.',
  },
  calcium: {
    id: 'calcium', label: 'Calcio', unit: 'mg', kind: 'minerale', ref: 'Riferimento: 800 mg al giorno.',
    what: 'Serve a ossa e denti, ai muscoli e al cuore.',
    why: ['Mantiene forti ossa e denti.', 'Serve alla contrazione dei muscoli e al cuore.'],
    sources: [
      S('Parmigiano', 1180, 20, '1 cucchiaio colmo', 'Grattugiato sui piatti: ne bastano piccole quantità.', 'proteine, vitamina B2'),
      S('Mozzarella', 400, 100, '1 porzione', 'Con moderazione: ha anche grassi saturi.', 'proteine'),
      S('Sardine con le lische', 380, 100, '1 scatoletta piccola', 'Le lische morbide sono la parte più ricca.', 'vitamina D, omega-3, B12'),
      S('Mandorle', 270, 30, 'una manciata', 'Al naturale.', 'vitamina E, magnesio'),
      S('Latte e yogurt', 120, 200, '1 bicchiere o 1 vasetto', 'Meglio lo yogurt bianco senza zuccheri aggiunti.', 'proteine, vitamina B12'),
    ],
    tip: 'Si assorbe meglio con la vitamina D: occhio a sole e pesce.',
    caution: 'Gli integratori di calcio vanno presi solo se te li indica il medico.',
  },
  iron: {
    id: 'iron', label: 'Ferro', unit: 'mg', kind: 'minerale', ref: 'Riferimento: 14 mg al giorno.',
    what: 'Serve a trasportare l\'ossigeno nel sangue (emoglobina). Quello della carne si assorbe meglio di quello dei vegetali.',
    why: ['Porta l\'ossigeno ai muscoli e agli organi.', 'Aiuta contro stanchezza e debolezza da poca disponibilità.'],
    sources: [
      S('Semi di zucca', 9, 20, '1 cucchiaio e mezzo', 'Sulle insalate o nello yogurt.', 'magnesio, zinco'),
      S('Lenticchie cotte', 3.3, 150, '1 porzione', 'Con un po\' di limone: la vitamina C aiuta ad assorbirlo.', 'folati, fibre, proteine'),
      S('Ceci cotti', 2.9, 150, '1 porzione', 'In insalata o in zuppa.', 'folati, fibre, proteine'),
      S('Spinaci', 2.7, 100, '1 porzione', 'Con limone o peperoni.', 'folati, vitamina K'),
      S('Carne di manzo', 2.6, 120, '1 fetta', 'Magra e con moderazione.', 'zinco, vitamina B12'),
    ],
    tip: 'Con una fonte di vitamina C (limone, peperoni) se ne assorbe di più; tè e caffè ai pasti ne riducono l\'assorbimento.',
    caution: 'Non prendere ferro in integratori senza che te lo dica il medico: l\'eccesso fa male.',
  },
  magnesium: {
    id: 'magnesium', label: 'Magnesio', unit: 'mg', kind: 'minerale', ref: 'Riferimento: 375 mg al giorno.',
    what: 'Serve a muscoli, nervi, ossa e alla produzione di energia.',
    why: ['Aiuta il lavoro di muscoli e nervi.', 'Contribuisce alla produzione di energia e alla salute delle ossa.'],
    sources: [
      S('Semi di zucca', 592, 20, '1 cucchiaio e mezzo', 'Sulle insalate o nello yogurt.', 'ferro, zinco'),
      S('Anacardi', 292, 30, 'una manciata', 'Al naturale.', 'zinco, ferro'),
      S('Mandorle', 270, 30, 'una manciata', 'Al naturale.', 'vitamina E, calcio'),
      S('Fiocchi d\'avena', 177, 40, '1 porzione (da secchi)', 'A colazione con yogurt e frutta.', 'fibre, vitamina B1'),
      S('Spinaci', 79, 100, '1 porzione', 'Crudi o cotti.', 'ferro, folati'),
    ],
    tip: 'Frutta secca, semi, legumi e cereali integrali sono le fonti più semplici.',
  },
  potassium: {
    id: 'potassium', label: 'Potassio', unit: 'mg', kind: 'minerale', ref: 'Riferimento: 2000 mg al giorno.',
    what: 'Serve a muscoli, nervi e alla pressione del sangue; contrasta in parte l\'effetto del sale.',
    why: ['Aiuta a mantenere la pressione nella norma.', 'Serve ai muscoli e ai nervi.'],
    sources: [
      S('Fagioli bianchi cotti', 561, 150, '1 porzione', 'In zuppa o come contorno.', 'fibre, proteine, ferro'),
      S('Spinaci', 558, 100, '1 porzione', 'Crudi o cotti.', 'vitamina K, folati'),
      S('Avocado', 485, 100, '½ avocado', 'Nelle insalate.', 'folati, vitamina E'),
      S('Patate', 420, 200, '1 patata grande', 'Al forno o lessate, meglio con la buccia.', 'vitamina C, vitamina B6'),
      S('Banane', 358, 120, '1 banana', 'Come spuntino.', 'vitamina B6, magnesio'),
    ],
    tip: 'Frutta, verdura e legumi ne danno molto: un motivo in più per mangiarne ogni giorno.',
    caution: 'Se hai problemi ai reni o prendi alcuni farmaci per la pressione, chiedi al medico prima di aumentarlo.',
  },
  zinc: {
    id: 'zinc', label: 'Zinco', unit: 'mg', kind: 'minerale', ref: 'Riferimento: 10 mg al giorno.',
    what: 'Serve alle difese immunitarie, alla pelle e alla guarigione delle ferite.',
    why: ['Sostiene le difese immunitarie.', 'Aiuta pelle e guarigione.'],
    sources: [
      S('Ostriche', 16, 60, '3-4 ostriche', 'Fresche e di buona provenienza.', 'vitamina B12, ferro'),
      S('Semi di zucca', 8, 20, '1 cucchiaio e mezzo', 'Sulle insalate.', 'magnesio, ferro'),
      S('Anacardi', 6, 30, 'una manciata', 'Al naturale.', 'magnesio, ferro'),
      S('Carne di manzo', 5, 120, '1 fetta', 'Magra e con moderazione.', 'ferro, vitamina B12'),
      S('Parmigiano', 3, 20, '1 cucchiaio colmo', 'Grattugiato.', 'calcio, proteine'),
    ],
    tip: 'Carne, frutta secca, semi e formaggi ne contengono; i legumi un po\' meno e si assorbe meno.',
    caution: 'Gli integratori di zinco in eccesso fanno male: prendili solo se te li indica il medico.',
  },
  omega3: {
    id: 'omega3', label: 'Omega-3', unit: 'mg', kind: 'altro', ref: 'Riferimento: 250 mg al giorno di EPA e DHA.',
    what: 'Grassi «buoni» (EPA e DHA) utili a cuore, cervello e vista.',
    why: ['Fanno bene al cuore e ai trigliceridi.', 'Sono importanti per cervello e vista.'],
    sources: [
      S('Sgombro', 2300, 120, '1 filetto', 'Al forno o alla piastra.', 'vitamina D, vitamina B12'),
      S('Salmone', 2000, 130, '1 trancio', 'Al forno o alla piastra.', 'vitamina D, vitamina B12'),
      S('Sardine', 1400, 100, '1 scatoletta piccola', 'Fresche o in scatola.', 'calcio, vitamina D'),
      S('Acciughe', 1400, 80, '1 porzione', 'Fresche o sott\'olio.', 'calcio'),
      S('Trota', 1000, 130, '1 trancio', 'Al forno.', 'vitamina B12'),
    ],
    tip: 'Pesce azzurro o salmone due volte a settimana. Noci e semi di lino danno un altro tipo di omega-3 (ALA) che il corpo converte poco in EPA e DHA.',
    caution: 'Gli integratori di omega-3 vanno presi solo se te li indica il medico, soprattutto se prendi anticoagulanti.',
  },
  protein: {
    id: 'protein', label: 'Proteine', unit: 'g', kind: 'macronutriente', ref: 'Obiettivo indicativo: circa 1,2 g per kg di peso (più alto se ti alleni).',
    what: 'Servono a costruire e riparare muscoli, pelle e tessuti e a fare enzimi e ormoni.',
    why: ['Mantengono e riparano i muscoli.', 'Danno sazietà.'],
    sources: [
      S('Parmigiano', 36, 20, '1 cucchiaio colmo', 'Poche quantità fanno già differenza.', 'calcio'),
      S('Petto di pollo', 31, 120, '1 fetta (cotto)', 'Alla piastra o al forno.', 'vitamina B3, B6'),
      S('Tonno al naturale', 25, 80, '1 scatoletta', 'Fresco o in scatola.', 'omega-3, vitamina B12'),
      S('Lenticchie secche', 25, 60, '1 porzione (da secche)', 'Con un cereale completano le proteine.', 'ferro, folati, fibre'),
      S('Uova', 13, 60, '1 uovo', 'Sode, in camicia o in frittata.', 'vitamina B12, D'),
    ],
    tip: 'Distribuiscile nei pasti della giornata, non tutte in uno solo; alterna carne, pesce, uova, legumi e latticini.',
    caution: 'Se hai problemi ai reni, parlane con il medico prima di aumentare le proteine.',
  },
  carbs: {
    id: 'carbs', label: 'Carboidrati', unit: 'g', kind: 'macronutriente', ref: 'In media circa il 45-60% delle calorie.',
    what: 'Sono la principale fonte di energia per cervello e muscoli.',
    why: ['Danno energia pronta.', 'I cereali integrali e i legumi danno anche fibre e vitamine.'],
    sources: [
      S('Riso (da secco)', 80, 80, '1 porzione', 'Meglio integrale.', 'vitamina B1, magnesio'),
      S('Pasta (da secca)', 75, 80, '1 porzione', 'Meglio integrale.', 'fibre, vitamina B1'),
      S('Fiocchi d\'avena', 66, 40, '1 porzione', 'A colazione con yogurt e frutta.', 'fibre, magnesio'),
      S('Pane', 50, 60, '2 fette', 'Meglio integrale, con meno sale.', 'fibre'),
      S('Patate', 17, 200, '1 patata grande', 'Al forno o lessate.', 'potassio, vitamina C'),
    ],
    tip: 'Scegli carboidrati integrali e poco raffinati, e meno dolci e bibite zuccherate.',
  },
  fat: {
    id: 'fat', label: 'Grassi', unit: 'g', kind: 'macronutriente', ref: 'In media circa il 20-35% delle calorie.',
    what: 'Danno energia e servono ad assorbire le vitamine A, D, E e K e a produrre ormoni.',
    why: ['Servono ad assorbire alcune vitamine.', 'Il tipo conta: meglio olio d\'oliva, pesce e frutta secca.'],
    sources: [
      S('Olio extravergine d\'oliva', 100, 10, '1 cucchiaio', 'Crudo sulle verdure, con misura.', 'vitamina E'),
      S('Noci', 65, 30, 'una manciata', 'Al naturale.', 'omega-3 vegetali (ALA)'),
      S('Mandorle', 50, 30, 'una manciata', 'Al naturale.', 'vitamina E, magnesio'),
      S('Avocado', 15, 100, '½ avocado', 'Nelle insalate.', 'potassio, folati'),
      S('Salmone', 13, 130, '1 trancio', 'Al forno.', 'omega-3, vitamina D'),
    ],
    tip: 'Preferisci grassi insaturi (olio d\'oliva, pesce, frutta secca) e limita fritti e grassi animali.',
  },
  sat: {
    id: 'sat', label: 'Grassi saturi', unit: 'g', kind: 'da limitare', ref: 'Massimo circa il 10% delle calorie.',
    what: 'Sono i grassi di burro, formaggi grassi, salumi e carni grasse: in eccesso fanno salire il colesterolo «cattivo».',
    why: ['Tenerli bassi aiuta il cuore e il colesterolo.', 'Non vanno eliminati: basta non esagerare.'],
    sources: [
      S('Burro', 51, 10, '1 noce di burro', 'Meglio olio d\'oliva per cucinare.', 'vitamina A'),
      S('Parmigiano', 19, 20, '1 cucchiaio colmo', 'Poche quantità.', 'calcio, proteine'),
      S('Salame', 14, 30, '3-4 fette', 'Da limitare, ha anche molto sale.', 'proteine'),
      S('Cioccolato al latte', 18, 30, '1 quadratino grande', 'Meglio fondente, in piccole dosi.', 'magnesio'),
      S('Mozzarella', 14, 100, '1 porzione', 'Più leggera la ricotta.', 'calcio, proteine'),
    ],
    tip: 'Meno fritti, salumi e dolci con burro; più olio d\'oliva, pesce e legumi.',
  },
  sugar: {
    id: 'sugar', label: 'Zuccheri', unit: 'g', kind: 'da limitare', ref: 'Zuccheri aggiunti: meno del 10% delle calorie.',
    what: 'Qui sono contati tutti gli zuccheri, anche quelli naturali di frutta e latte. Quelli aggiunti (bibite, dolci, succhi) vanno limitati.',
    why: ['Gli zuccheri aggiunti danno calorie «vuote».', 'Quelli della frutta intera arrivano con fibre e vitamine.'],
    sources: [
      S('Bibite zuccherate', 10.6, 330, '1 lattina', 'Da limitare: 1 lattina ha circa 35 g.', 'nessuno'),
      S('Succhi di frutta', 10, 200, '1 bicchiere', 'Meglio la frutta intera.', 'vitamina C'),
      S('Dolci e biscotti', 30, 50, '2-3 biscotti', 'Da limitare.', 'nessuno di rilievo'),
      S('Miele', 80, 15, '1 cucchiaino', 'È zucchero: con misura.', 'poco altro'),
      S('Frutta fresca', 10, 150, '1 frutto', 'Ha zuccheri ma anche fibre: va bene.', 'vitamina C, potassio'),
    ],
    tip: 'Controlla le etichette: spesso lo zucchero è nei prodotti che non sembrano dolci (salse, yogurt, cereali).',
  },
  fibre: {
    id: 'fibre', label: 'Fibre', unit: 'g', kind: 'altro', ref: 'Obiettivo: 25-30 g al giorno.',
    what: 'Fanno bene all\'intestino, danno sazietà e aiutano a tenere stabili glicemia e colesterolo.',
    why: ['Aiutano la regolarità intestinale.', 'Danno sazietà e aiutano la glicemia.'],
    sources: [
      S('Crusca di frumento', 42, 15, '1 cucchiaio e mezzo', 'Nello yogurt o nei cereali.', 'magnesio'),
      S('Fagioli e ceci secchi', 16, 60, '1 porzione (da secchi)', 'In zuppa.', 'ferro, folati, proteine'),
      S('Lamponi', 7, 125, '1 coppetta', 'Freschi.', 'vitamina C'),
      S('Fiocchi d\'avena', 10, 40, '1 porzione', 'A colazione.', 'magnesio, vitamina B1'),
      S('Carciofi', 5, 150, '1-2 carciofi', 'Al vapore o al forno.', 'potassio, folati'),
    ],
    tip: 'Aumentale piano e bevi di più: troppe fibre di colpo possono dare gonfiore.',
  },
  salt: {
    id: 'salt', label: 'Sale', unit: 'g', kind: 'da limitare', ref: 'Massimo 5 g al giorno.',
    what: 'Il sale (sodio) in eccesso fa salire la pressione. Gran parte arriva da cibi già pronti, salumi, formaggi e pane.',
    why: ['Meno sale aiuta la pressione e il cuore.', 'Si abitua il gusto in poche settimane.'],
    sources: [
      S('Salumi (prosciutto crudo)', 5.5, 50, '3-4 fette', 'Da limitare.', 'proteine'),
      S('Olive in salamoia', 3, 30, 'una manciata', 'Con misura.', 'vitamina E'),
      S('Formaggi stagionati', 1.6, 30, '1 porzione', 'Con misura.', 'calcio'),
      S('Pane', 1.5, 60, '2 fette', 'Esistono pani con meno sale.', 'fibre (se integrale)'),
      S('Snack salati e patatine', 1.5, 30, '1 sacchetto piccolo', 'Da limitare.', 'nessuno'),
    ],
    tip: 'Insaporisci con erbe, spezie e limone invece che con il sale; guarda le etichette.',
    caution: 'Se hai pressione alta o problemi ai reni, chiedi al medico quanto sale puoi assumere.',
  },
  water: {
    id: 'water', label: 'Acqua', unit: 'L', kind: 'altro', ref: 'Circa 30 ml per kg di peso, tra 1,5 e 2,5 litri.',
    what: 'Serve a tutte le funzioni del corpo, a regolare la temperatura e a digerire. Una parte arriva dal cibo.',
    why: ['Aiuta digestione, circolazione e temperatura.', 'Aiuta a restare concentrati e a ridurre la stanchezza da poca acqua.'],
    sources: [
      S('Acqua', 100, 200, '1 bicchiere', 'La scelta migliore, anche frizzante.', 'nessuna caloria'),
      S('Cetriolo', 96, 150, '1 porzione', 'Crudo.', 'potassio'),
      S('Anguria', 91, 200, '1 fetta', 'In estate.', 'potassio'),
      S('Zuppe e minestre', 90, 250, '1 piatto', 'Anche in inverno.', 'verdure e fibre'),
      S('Arance', 87, 180, '1 arancia', 'Intere.', 'vitamina C'),
    ],
    tip: 'Tieni una bottiglia a portata di mano e bevi un bicchiere a ogni pasto e a metà mattina e pomeriggio.',
    caution: 'Se hai problemi ai reni o al cuore, chiedi al medico quanta acqua bere.',
  },
};

/** Quantità nella porzione e quota del riferimento giornaliero (solo per vitamine e minerali, di cui conosciamo il riferimento). */
export function portionAmount(id: NutrientId, f: FoodSource): { amount: number; pct: number | null } {
  const amount = (f.per100 * f.portion) / 100;
  const ref = id in MICRO_INFO ? MICRO_INFO[id as MicroKey].ref : null;
  return { amount: Math.round(amount * 10) / 10, pct: ref ? Math.round((amount / ref) * 100) : null };
}

/** Avviso da mostrare sempre nelle schede. */
export const NUTRIENT_DISCLAIMER = 'Le quantità sono valori medi approssimativi per 100 g di alimento crudo (o secco dove indicato) e cambiano con varietà, stagione e cottura. Informazioni generali, non un consiglio medico o nutrizionale: per dubbi, sintomi, gravidanza, malattie o integratori parla con il medico o con un dietista.';
