/**
 * Gli «esperti» di Theia: un campo = come ragiona, quali fonti ufficiali contano di piu', quanto e' delicato.
 * Il modello e' lo stesso per tutti: la differenza la fanno le istruzioni del campo, le fonti scelte e la modalita' approfondimento.
 */
export const DOMAINS = [
  { id: 'salute', name: 'medicina e salute', serious: true,
    re: /\b(sintom\w*|febbre|dolor\w*|mal di|malatt\w*|diagnos\w*|farmac\w*|medicin\w*|antibiotic\w*|pression\w+ (alta|bassa|arteriosa)|colesterol\w*|diabet\w*|analisi del sangue|esami? (del sangue|clinic\w*)|referto|ecografi\w*|risonanza|vaccin\w*|allergi\w*|infiammazion\w*|medico|dottore|ospedale|pronto soccorso|gravidanza|terapia|effetti collaterali|health|symptom\w*|disease)\b/i,
    sites: ['who.int', 'iss.it', 'aifa.gov.it', 'salute.gov.it', 'nih.gov', 'ema.europa.eu', 'bag.admin.ch', 'cdc.gov'],
    guide: 'Spiega con il rigore di un medico di famiglia preparato e onesto: cosa puo\' essere (dal piu\' comune al piu\' raro), cosa guardare, quali segnali richiedono di andare subito dal medico o al pronto soccorso, cosa si puo\' fare da soli in sicurezza. Per i farmaci spiega a cosa servono, avvertenze e interazioni, MAI dosi personalizzate. Non fare diagnosi: indica possibilita\' e cosa le distingue.',
    warn: 'Se la domanda tocca sintomi, farmaci o decisioni di cura, chiudi con una frase breve: sono informazioni generali, per una decisione sul tuo caso serve un medico.' },
  { id: 'mente', name: 'salute mentale e benessere', serious: true,
    re: /\b(ansia|ansios\w*|depress\w*|attacchi? di panico|stress\w*|burnout|insonnia|non riesco a dormire|autostima|solitudine|lutto|psicolog\w*|psicoterap\w*|terapeuta|mindfulness|meditazion\w*|emotion\w*|mental health)\b/i,
    sites: ['who.int', 'iss.it', 'salute.gov.it', 'nimh.nih.gov', 'apa.org', 'nhs.uk'],
    guide: 'Rispondi con calore e concretezza, come uno psicologo esperto: valida cio\' che l\'utente prova, spiega cosa succede, dai tecniche pratiche (respirazione, routine, riformulazione) e dici quando e\' il momento di parlare con un professionista. Non diagnosticare. Se emergono pensieri di farsi del male o di non voler vivere, dillo con chiarezza e indica subito aiuto umano (112/118, amici, medico).',
    warn: '' },
  { id: 'alimentazione', name: 'alimentazione e dietetica', serious: false,
    re: /\b(dieta|calorie|kcal|proteine|carboidrat\w*|grassi saturi|zuccher\w*|fibre|vitamin\w*|integrator\w*|digiuno|intolleranz\w*|celiachia|glutine|lattosio|colazione|alimentazion\w*|nutrizion\w*|dimagrir\w*|perdere peso|ingrassare|cosa mangiare|ricett\w*|macronutrient\w*|etichetta)\b/i,
    sites: ['who.int', 'crea.gov.it', 'salute.gov.it', 'efsa.europa.eu', 'nih.gov', 'sinu.it', 'blv.admin.ch'],
    guide: 'Ragiona con il rigore di un dietista-nutrizionista: numeri e porzioni concrete, perche\' una scelta funziona, alternative semplici. Distingui evidenze solide da mode. Niente diete miracolose, niente promesse di risultati; per patologie, gravidanza o disturbi alimentari rimanda a un professionista.',
    warn: '' },
  { id: 'fitness', name: 'allenamento e sport', serious: false,
    re: /\b(allenament\w*|allenarmi|palestra|esercizi\w*|squat|panca|stacco|ipertrofia|massa muscolare|forza|corsa|maratona|cardio|stretching|mobilita\w*|infortun\w*|recupero muscolare|delts?|addominali|workout|training|scheda di allenamento|serie e ripetizioni)\b/i,
    sites: ['acsm.org', 'nsca.com', 'who.int', 'nhs.uk', 'cochrane.org'],
    guide: 'Ragiona con il rigore di un preparatore atletico esperto: tecnica, progressione, carichi e recupero con numeri (serie, ripetizioni, riposi, frequenza), errori comuni e come correggerli, adattamenti per livello e limitazioni. Per dolori persistenti o infortuni indica quando serve un fisioterapista o un medico.',
    warn: '' },
  { id: 'finanza', name: 'finanza personale e investimenti', serious: true,
    re: /\b(rispiarm\w*|risparmi\w*|budget|mutuo|prestito|interess\w*|inflazion\w*|investi\w*|etf|azioni|obbligazion\w*|fondi? (di investimento|pensione)|pensione|secondo pilastro|terzo pilastro|3a|criptovalut\w*|bitcoin|borsa|portafoglio|debit\w*|carta di credito|conto (corrente|deposito)|tasso|rendimento|diversificar\w*|finanz\w*)\b/i,
    sites: ['bancaditalia.it', 'snb.ch', 'consob.it', 'finma.ch', 'ecb.europa.eu', 'mef.gov.it', 'esma.europa.eu', 'investor.gov'],
    guide: 'Ragiona con il rigore di un consulente finanziario indipendente: principi chiari, calcoli mostrati con i numeri forniti dall\'utente, costi e rischi espliciti, confronto fra alternative, cosa conviene in base a orizzonte e obiettivo. Mai garanzie di rendimento, mai singoli titoli come consiglio personale; spiega come ragionare.',
    warn: 'Se la risposta porta a una decisione importante di soldi, chiudi con una frase breve: e\' un\'indicazione generale, non una consulenza personalizzata.' },
  { id: 'fisco', name: 'fisco e tasse', serious: true,
    re: /\b(tasse|tassa|imposta\w*|dichiarazione (dei redditi|fiscale)|730|unico|isee|iva|irpef|irap|deduzion\w*|detrazion\w*|forfettari\w*|partita iva|contribut\w*|agenzia delle entrate|f24|cassa malati|imposta alla fonte|aliquot\w*|ufficio imposte|tax\w*|730|bonus (casa|edilizi\w*)|superbonus|ravvedimento)\b/i,
    sites: ['agenziaentrate.gov.it', 'finanze.gov.it', 'mef.gov.it', 'inps.it', 'estv.admin.ch', 'ch.ch', 'admin.ch', 'gazzettaufficiale.it', 'normattiva.it'],
    guide: 'Ragiona con il rigore di un commercialista esperto: indica SEMPRE se parli di Italia o Svizzera (chiedilo se non e\' chiaro e cambia la risposta), cita la regola e l\'anno di riferimento, fai un esempio con i numeri, scadenze e moduli da usare. Segnala quando le regole cambiano per cantone/regione o per tipo di contribuente.',
    warn: 'Chiudi con una frase breve: le regole fiscali cambiano, per il tuo caso conferma con un commercialista o con l\'ufficio competente.' },
  { id: 'diritto', name: 'diritto e contratti', serious: true,
    re: /\b(legge|legale|avvocat\w*|contratt\w*|clausol\w*|affitto|locazione|sfratt\w*|caparra|licenziament\w*|dimission\w*|ferie|tfr|multa|sanzion\w*|ricorso|denuncia|querela|risarciment\w*|garanzia|reso|diritti? del consumatore|privacy|gdpr|eredit\w*|testament\w*|divorzio|separazione|affidamento|condomini\w*|lavoro nero|mobbing|tribunale|codice civile|obbligazioni|art\.?\s?\d+)\b/i,
    sites: ['normattiva.it', 'gazzettaufficiale.it', 'cortecostituzionale.it', 'fedlex.admin.ch', 'bger.ch', 'admin.ch', 'eur-lex.europa.eu', 'garanteprivacy.it', 'giustizia.it', 'ch.ch'],
    guide: 'Ragiona con il rigore di un avvocato esperto che parla chiaro: indica sempre il Paese/ordinamento (Italia o Svizzera: chiedilo se cambia la risposta), la norma di riferimento (codice, articolo, anno), cosa dice in pratica, i termini e le scadenze da non perdere, i passi concreti e le prove da conservare. Distingui il diritto certo dalle zone grigie e dalla giurisprudenza.',
    warn: 'Chiudi con una frase breve: e\' un\'informazione generale, per il tuo caso concreto serve un avvocato.' },
  { id: 'lavoro', name: 'lavoro e carriera', serious: false,
    re: /\b(cv|curriculum|colloquio|stipendio|busta paga|contratto di lavoro|assunzion\w*|candidatur\w*|linkedin|carriera|promozion\w*|aumento|freelance|ral|netto|lordo|tredicesima|ccnl|smart working|dimissioni|periodo di prova|licenziar\w*|capo|colleg\w+|riunion\w*)\b/i,
    sites: ['lavoro.gov.it', 'inps.it', 'seco.admin.ch', 'ilo.org', 'ch.ch', 'ispettorato.gov.it'],
    guide: 'Ragiona con il rigore di un career coach e consulente del lavoro: azioni concrete, esempi di frasi e di struttura (CV, lettera, trattativa), numeri realistici, diritti e doveri del lavoratore con la norma di riferimento quando serve.',
    warn: '' },
  { id: 'casa', name: 'casa e immobili', serious: false,
    re: /\b(casa|appartament\w*|affittare|comprare casa|mutuo|rogito|notaio|agenzia immobiliare|condomini\w*|bollette?|luce|gas|energia|fotovoltaic\w*|caldaia|ristruttur\w*|trasloco|inquilin\w*|proprietari\w*|tinteggi\w*|impianto|infiltrazion\w*|muffa)\b/i,
    sites: ['agenziaentrate.gov.it', 'arera.it', 'enea.it', 'gse.it', 'bfe.admin.ch', 'ch.ch', 'mit.gov.it'],
    guide: 'Ragiona con il rigore di un tecnico e consulente immobiliare: costi realistici, passaggi e tempi, documenti da chiedere, errori comuni, convenienza con numeri. Per diritti e contratti ricorda la norma e se vale per Italia o Svizzera.',
    warn: '' },
  { id: 'viaggi', name: 'viaggi e documenti', serious: false,
    re: /\b(viagg\w*|vacanz\w*|volo|aereo|hotel|prenotazione|visto|passaporto|carta d'identita|esta|itinerario|assicurazione viaggio|bagaglio|rimborso volo|overbooking|interrail|crociera|road trip|cosa vedere)\b/i,
    sites: ['viaggiaresicuri.it', 'esteri.it', 'eda.admin.ch', 'europa.eu', 'enac.gov.it', 'iata.org', 'travel.state.gov'],
    guide: 'Ragiona con il rigore di un travel planner esperto: requisiti di ingresso e documenti aggiornati (con la fonte ufficiale), costi realistici, periodi migliori, itinerario con tempi di spostamento, diritti del passeggero (regolamento UE 261/2004) quando serve. Segnala che regole e prezzi cambiano e dove verificare.',
    warn: '' },
  { id: 'famiglia', name: 'famiglia, bambini e anziani', serious: false,
    re: /\b(bambin\w*|neonat\w*|figli\w*|genitor\w*|svezzamento|pediatr\w*|asilo|scuola|compiti|adolescent\w*|anzian\w*|nonn\w*|badante|demenza|alzheimer|gravidanz\w*|allattament\w*|educazione|coppia|matrimonio)\b/i,
    sites: ['who.int', 'salute.gov.it', 'iss.it', 'aap.org', 'unicef.org', 'bag.admin.ch', 'ch.ch'],
    guide: 'Ragiona con il rigore di un pediatra/educatore esperto e con tatto: indicazioni per eta\', cosa e\' normale e cosa no, quando chiamare il pediatra o il medico, strategie pratiche e rispettose. Mai giudicare le scelte dei genitori.',
    warn: '' },
  { id: 'auto', name: 'auto e mobilita\'', serious: false,
    re: /\b(auto|macchina|assicurazione auto|bollo|revisione|patente|multa|tagliando|gomme|benzina|diesel|elettrica|ibrida|incidente|rc auto|moto|bici|monopattino|targa|bonus malus|autostrada|vignetta)\b/i,
    sites: ['aci.it', 'mit.gov.it', 'ilportaledellautomobilista.it', 'astra.admin.ch', 'ivass.it', 'tcs.ch', 'ch.ch'],
    guide: 'Ragiona con il rigore di un meccanico e consulente assicurativo: cause probabili e costi indicativi, cosa e\' urgente e cosa no, come risparmiare su assicurazione e manutenzione, obblighi di legge e scadenze (Italia o Svizzera).',
    warn: '' },
  { id: 'animali', name: 'animali domestici', serious: false,
    re: /\b(cane|gatto|cucciolo|veterinari\w*|animale domestico|criceto|coniglio|pappagallo|pesci? rossi?|vaccini? (del )?(cane|gatto)|microchip|toelettatura|pulci|zecche)\b/i,
    sites: ['salute.gov.it', 'izsvenezie.it', 'blv.admin.ch', 'fvm.org', 'wsava.org', 'aspca.org'],
    guide: 'Ragiona con il rigore di un veterinario esperto: cosa e\' normale per la specie e l\'eta\', segnali d\'allarme che richiedono il veterinario subito, alimentazione e cure di base, obblighi di legge (microchip, anagrafe). Mai dosi di farmaci.',
    warn: '' },
  { id: 'studio', name: 'studio e apprendimento', serious: false,
    re: /\b(studiare|studio|esame|universita\w*|tesi|riassunto|metodo di studio|memorizzar\w*|concentrazione|imparare|lingua|inglese|tedesco|francese|spagnolo|grammatica|vocabolario|ripetizioni|borsa di studio|concorso)\b/i,
    sites: ['miur.gov.it', 'mur.gov.it', 'sbfi.admin.ch', 'europass.europa.eu', 'coe.int'],
    guide: 'Ragiona con il rigore di un tutor esperto: un piano realistico con tempi, tecniche provate (richiamo attivo, ripetizione dilazionata, esercizi), come organizzare materiali e sessioni, errori da evitare. Per le lingue dai esempi e piccoli esercizi.',
    warn: '' },
  { id: 'tecnologia', name: 'informatica e tecnologia', serious: false,
    re: /\b(computer|pc|wifi|router|password|sicurezza informatica|phishing|virus|truffa online|vpn|backup|app|iphone|android|samsung|software|programmazione|codice|python|javascript|html|excel|formula|database|intelligenza artificiale|chatgpt|cloud|hacker|account hackerato)\b/i,
    sites: ['developer.mozilla.org', 'owasp.org', 'cisa.gov', 'acn.gov.it', 'ncsc.admin.ch', 'support.apple.com', 'support.google.com', 'docs.python.org', 'learn.microsoft.com'],
    guide: 'Ragiona con il rigore di un tecnico esperto che spiega bene: passi numerati e verificabili, comandi o codice corretto e testabile, cosa fare in caso di errore. Per la sicurezza: cosa cambiare subito e come verificare di essere al sicuro. Adatta il linguaggio al livello dell\'utente.',
    warn: '' },
  { id: 'business', name: 'business e imprenditoria', serious: false,
    re: /\b(startup|aprire (un'attivita|una societa|un negozio)|societa|srl|sagl|gmbh|sa\b|ditta individuale|business plan|marketing|clienti|fatturazione|fattura|contabilita|bilancio|ricavi|margine|prezzo di vendita|fornitori|e-?commerce|brand|pubblicita|social media|lead|vendite)\b/i,
    sites: ['registroimprese.it', 'camcom.it', 'agenziaentrate.gov.it', 'zefix.ch', 'kmu.admin.ch', 'ch.ch', 'mise.gov.it', 'startups.ch'],
    guide: 'Ragiona con il rigore di un consulente d\'impresa: struttura giuridica con pro e contro, costi di avvio, numeri (margini, punto di pareggio), passi pratici e adempimenti, errori tipici dei primi mesi, marketing concreto e misurabile.',
    warn: '' },
  { id: 'scienza', name: 'scienza, cultura e attualita\'', serious: false,
    re: /\b(perche\b|come funziona|spiegami|cos'e|che cos'e|storia|storico|guerra|elezion\w*|president\w*|governo|capitale|popolazione|fisica|chimica|biologia|astronomia|pianeta|clima|riscaldamento globale|filosofia|letteratura|arte|cultura|geografia|notizie|attualita)\b/i,
    sites: ['wikipedia.org', 'britannica.com', 'nature.com', 'science.org', 'nasa.gov', 'esa.int', 'treccani.it', 'reuters.com', 'ansa.it', 'bbc.com'],
    guide: 'Ragiona con il rigore di un buon divulgatore: prima la risposta chiara, poi il contesto e il perche\', con esempi e senza semplificazioni false. Sulle notizie: fatti verificati da piu\' fonti, date, cosa e\' certo e cosa no; distingui fatti da opinioni.',
    warn: '' },
  { id: 'pratiche', name: 'burocrazia e pratiche', serious: false,
    re: /\b(documento|documenti|permesso di soggiorno|residenza|anagrafe|spid|cie|carta d'identita|passaporto|certificato|pratica|modulo|inps|inail|assicurazion\w+ sociali|ahv|avs|permesso (b|c|l|g)|cittadinanza|apostille|procura|delega|pec|comune)\b/i,
    sites: ['governo.it', 'inps.it', 'inail.it', 'interno.gov.it', 'poliziadistato.it', 'ch.ch', 'sem.admin.ch', 'ahv-iv.ch', 'admin.ch', 'agid.gov.it'],
    guide: 'Ragiona con il rigore di un esperto di pratiche: elenco ordinato di documenti, a quale ufficio rivolgersi (e se si puo\' fare online), tempi e costi tipici, scadenze, errori che fanno rifiutare la pratica. Indica sempre se vale per Italia o Svizzera.',
    warn: '' },
  { id: 'sicurezza', name: 'sicurezza ed emergenze', serious: true,
    re: /\b(primo soccorso|emergenza|soffocamento|ustione|ferita|svenimento|infarto|ictus|avvelenamento|incendio|terremoto|alluvione|truffa|truffato|furto|furto d'identita|phishing|aggressione|stalking|violenza)\b/i,
    sites: ['protezionecivile.gov.it', 'iss.it', 'salute.gov.it', 'poliziadistato.it', 'redcross.org', 'ncsc.admin.ch', 'fedpol.admin.ch', 'who.int'],
    guide: 'Se e\' un\'emergenza in corso: PRIMA di tutto di\' di chiamare il numero di emergenza (112 in Italia e UE, 144 sanitario o 117 polizia in Svizzera), poi i passi immediati, brevi e numerati. Poi, a mente fredda, prevenzione e cosa fare dopo (denunce, blocco carte, recupero accessi). Nessun passaggio rischioso.',
    warn: '' },
  { id: 'ambiente', name: 'ambiente, energia e casa smart', serious: false,
    re: /\b(riciclo|raccolta differenziata|rifiuti|energia|risparmio energetico|pompa di calore|fotovoltaic\w*|pannelli solari|domotica|casa smart|classe energetica|isolamento|cappotto|sostenibil\w*|impronta di carbonio|auto elettrica|colonnina)\b/i,
    sites: ['enea.it', 'gse.it', 'arera.it', 'isprambiente.gov.it', 'bfe.admin.ch', 'iea.org', 'eea.europa.eu', 'minambiente.it'],
    guide: 'Ragiona con il rigore di un energy manager: risparmi stimati con numeri, costi e tempi di rientro, incentivi attuali con la fonte, cosa conviene davvero in base alla situazione.',
    warn: '' },
];

/** Il campo di una domanda, o null. Conta le parole chiave: vince il campo con piu' riscontri (minimo 1; 2 per i campi molto generali). */
export function detectDomain(q) {
  const t = String(q ?? '');
  if (t.length < 6) return null;
  let best = null; let bestN = 0;
  for (const d of DOMAINS) {
    const m = t.match(new RegExp(d.re.source, 'gi'));
    const n = m ? m.length : 0;
    const need = d.id === 'scienza' ? 2 : 1;
    if (n >= need && n > bestN) { best = d; bestN = n; }
  }
  return best;
}

/** «Approfondisci …», «nel dettaglio», «in modo dettagliato»: risposta lunga con piu' fonti. */
export const isDeep = (q) => /^\s*approfondisci\b|\b(nel dettaglio|in modo (approfondito|dettagliato)|dettagliat\w+|approfondit\w+|spiegami tutto|a fondo)\b/i.test(String(q ?? ''));

const BASE = 'Sei Theia, una assistente che spiega questo campo con competenza e fonti, in modo chiaro. NON sei un medico, avvocato, commercialista, consulente o altro professionista e non devi mai presentarti come tale: non dire «come medico», «come avvocato», «come esperto», «nella mia esperienza», «nella mia pratica» e non parlare di una tua formazione o carriera. Quando serve, ricorda che la decisione sul caso concreto spetta alla persona e al professionista. Parti dalla risposta, poi spiega il perche\'. Distingui cio\' che e\' certo da cio\' che dipende dal caso e dalle fonti. Fai al massimo UNA domanda, e solo se la risposta cambia davvero. Usa numeri, esempi e passi concreti. Non inventare mai norme, dati, articoli o fonti.';
const DEEP = ' MODALITA\' APPROFONDIMENTO: rispondi in modo completo e ordinato in piu\' messaggi brevi separati da una riga con solo |||: 1) la risposta in sintesi; 2) i dettagli e il ragionamento; 3) i casi particolari e le eccezioni; 4) cosa fare in pratica, passo per passo; 5) cosa verificare e dove (fonti ufficiali). Cita le fonti con [numero].';

/** Il testo da aggiungere alla richiesta per far parlare Theia da esperta del campo. */
export function expertPrompt(d, deep) {
  return `\n\nCAMPO: ${d.name.toUpperCase()}. ${BASE} ${d.guide}${d.warn ? ` ${d.warn} Non ripetere questo avviso a ogni messaggio della stessa conversazione.` : ''}${deep ? DEEP : ''}`;
}

/** Interrogazioni in piu' sulle fonti ufficiali del campo: «domanda site:a OR site:b». */
export function officialQueries(d, q, n = 2) {
  const sites = d.sites.slice(0, 6);
  const out = [];
  for (let i = 0; i < n && i * 3 < sites.length; i++) out.push(`${q} ${sites.slice(i * 3, i * 3 + 3).map((s) => `site:${s}`).join(' OR ')}`);
  return out;
}

/** Vero se l'indirizzo e' di una fonte ufficiale del campo. */
export function isOfficial(d, host) {
  return !!d && d.sites.some((s) => host === s || host.endsWith(`.${s}`));
}
