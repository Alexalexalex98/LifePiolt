import { useEffect, useRef } from 'react';
import { Image } from 'react-native';

import { makeStory, type Story } from '@/lib/stories';
import { useApp } from '@/store/app';
import { useNet, type Post } from '@/store/network';

const M = {
  pizza: require('../../assets/seed/pizza.jpg'), galeone: require('../../assets/seed/galeone.jpg'), colazione: require('../../assets/seed/colazione.jpg'),
  autoNotte: require('../../assets/seed/auto-notte.jpg'), barSera: require('../../assets/seed/bar-sera.jpg'), aperitivo: require('../../assets/seed/aperitivo.jpg'),
  cappuccino: require('../../assets/seed/cappuccino.jpg'), freccette: require('../../assets/seed/freccette.jpg'), birra: require('../../assets/seed/birra.jpg'),
  voloNotte: require('../../assets/seed/volo-notte.mp4'), spiaggia: require('../../assets/seed/spiaggia-tramonto.mp4'), roma: require('../../assets/seed/roma-tramonto.mp4'),
  spazio: require('../../assets/seed/spazio.mp4'), colosseo: require('../../assets/seed/colosseo.mp4'), positano: require('../../assets/seed/positano.mp4'), newYork: require('../../assets/seed/new-york.mp4'), pizzaPatatine: require('../../assets/seed/pizza-patatine.jpg'), tavolaCalici: require('../../assets/seed/tavola-calici.jpg'), aeroporto: require('../../assets/seed/aeroporto.jpg'), tvVintage: require('../../assets/seed/tv-vintage.jpg'), libro: require('../../assets/seed/libro.jpg'), formulaUno: require('../../assets/seed/formula-uno.jpg'), androne: require('../../assets/seed/androne.jpg'), codaPassaporti: require('../../assets/seed/coda-passaporti.jpg'), peugeot: require('../../assets/seed/peugeot.jpg'), pietraSmart: require('../../assets/seed/pietra-smart.jpg'), caffeFiltro: require('../../assets/seed/caffe-filtro.jpg'), menuBicerin: require('../../assets/seed/menu-bicerin.jpg'), nikis: require('../../assets/seed/nikis.jpg'), tavolinoFinestra: require('../../assets/seed/tavolino-finestra.jpg'), cocktailOlive: require('../../assets/seed/cocktail-olive.jpg'), burgerPatatine: require('../../assets/seed/burger-patatine.jpg'), pubFreccette: require('../../assets/seed/pub-freccette.jpg'), pizzaMucchio: require('../../assets/seed/pizza-patatine-mucchio.jpg'), cocktailScuri: require('../../assets/seed/cocktail-scuri.jpg'), burgerViola: require('../../assets/seed/burger-viola.jpg'), caffeInterno: require('../../assets/seed/caffe-interno.jpg'), tazzeCaffe: require('../../assets/seed/tazze-caffe.jpg'), cappuccinoFiori: require('../../assets/seed/cappuccino-fiori.jpg'), corona: require('../../assets/seed/corona.jpg'), cotolette: require('../../assets/seed/cotolette-birra.jpg'), brindisiBirra: require('../../assets/seed/brindisi-birra.jpg'), marienplatz: require('../../assets/seed/marienplatz.jpg'), finestrino: require('../../assets/seed/finestrino.jpg'), birraPianta: require('../../assets/seed/birra-pianta.jpg'), balconeSedie: require('../../assets/seed/balcone-sedie.jpg'), menuFastFood: require('../../assets/seed/menu-fast-food.jpg'), croissantCappuccino: require('../../assets/seed/croissant-cappuccino.jpg'), tettiMontagna: require('../../assets/seed/tetti-montagna.jpg'), panino28: require('../../assets/seed/panino-candeline.jpg'), vinoCocktail: require('../../assets/seed/vino-cocktail.jpg'), balconeSera: require('../../assets/seed/balcone-sera.jpg'), cenaTacos: require('../../assets/seed/cena-tacos.jpg'), cameraHotel: require('../../assets/seed/camera-hotel.jpg'), colazioneBanana: require('../../assets/seed/colazione-banana.jpg'), duomo: require('../../assets/seed/duomo.jpg'), cucciolo: require('../../assets/seed/cucciolo-prato.jpg'), anatre: require('../../assets/seed/anatre.jpg'), latteRosa: require('../../assets/seed/latte-rosa.jpg'), goldenAdulto: require('../../assets/seed/golden-adulto.jpg'), f1Tv: require('../../assets/seed/formula-uno-tv.jpg'), mcLago: require('../../assets/seed/mc-lago.jpg'), asini: require('../../assets/seed/asini.jpg'), divanoPied: require('../../assets/seed/divano-pied.jpg'), bancone: require('../../assets/seed/bancone.jpg'), burgerArdesia: require('../../assets/seed/burger-ardesia.jpg'), croissantFarciti: require('../../assets/seed/croissant-farciti.jpg'), croissantBianco: require('../../assets/seed/croissant-bianco.jpg'), poltrone: require('../../assets/seed/poltrone.jpg'), vetrinaDolci: require('../../assets/seed/vetrina-dolci.jpg'), pizzaBufala: require('../../assets/seed/pizza-bufala.jpg'), pasticceriaInterno: require('../../assets/seed/pasticceria-interno.jpg'), torreBambu: require('../../assets/seed/torre-bambu.jpg'), videoCaffe: require('../../assets/seed/video-caffe.mp4'), piscinaBald: require('../../assets/seed/piscina-baldacchino.jpg'), colazioneUova: require('../../assets/seed/colazione-uova.jpg'), hamburgerPiatto: require('../../assets/seed/hamburger-piatto.jpg'), triesteCroissant: require('../../assets/seed/trieste-croissant.jpg'), vid01: require('../../assets/seed/v01.mp4'), vid02: require('../../assets/seed/v02.mp4'), vid03: require('../../assets/seed/v03.mp4'), vid04: require('../../assets/seed/v04.mp4'), vid05: require('../../assets/seed/v05.mp4'), vid06: require('../../assets/seed/v06.mp4'), vid07: require('../../assets/seed/v07.mp4'), vid08: require('../../assets/seed/v08.mp4'), vid09: require('../../assets/seed/v09.mp4'), vid10: require('../../assets/seed/v10.mp4'), vid11: require('../../assets/seed/v11.mp4'), vid12: require('../../assets/seed/v12.mp4'),
} as const;
type Key = keyof typeof M;

const H = 3600000;
/** Post di altre persone con foto e video, per vedere Home e Swipe pieni. Solo in modalità demo; i tuoi li pubblichi tu. */
const POSTS: { id: number; author: string; tag: string; media: 'photo' | 'video'; k: Key; /** più foto nello stesso post (carosello) */ ks?: Key[]; text: string; h: number; likes: number }[] = [
  { id: 201, author: 'Davide R.', tag: 'Viaggi', media: 'video', k: 'voloNotte', text: 'Atterraggio al tramonto: la città si accende sotto l’ala.', h: 2, likes: 52 },
  { id: 101, author: 'Marco T.', tag: 'Cucina', media: 'photo', k: 'pizza', text: 'Cena da pizzeria: margherita contro salame piccante. Voi quale scegliete?', h: 3, likes: 71 },
  { id: 202, author: 'Federica L.', tag: 'Viaggi', media: 'video', k: 'spiaggia', text: 'Tramonto rosa sulla spiaggia: palme, onde e niente fretta.', h: 4, likes: 88 },
  { id: 102, author: 'Davide R.', tag: 'Viaggi', media: 'photo', k: 'galeone', text: 'Sul ponte dei cannoni di un vecchio galeone: secchi di legno, funi e palle di cannone ancora al loro posto.', h: 5, likes: 39 },
  { id: 203, author: 'Marco T.', tag: 'Viaggi', media: 'video', k: 'roma', text: 'Roma dall’alto all’ora d’oro: il fiume, i ponti e la cupola di San Pietro.', h: 6, likes: 95 },
  { id: 103, author: 'Sara B.', tag: 'Caffè', media: 'photo', k: 'colazione', text: 'Colazione vicino alla vetrata: cornetto caldo e caffè prima di iniziare la giornata.', h: 7, likes: 33 },
  { id: 204, author: 'Elena F.', tag: 'Mind', media: 'video', k: 'spazio', text: 'Cinque minuti per guardare lontano: dalla cometa alla Terra. Aiuta a rimettere le cose in prospettiva.', h: 8, likes: 64 },
  { id: 104, author: 'Tommaso V.', tag: 'Viaggi', media: 'photo', k: 'autoNotte', text: 'Ultima tappa del viaggio, parcheggio di notte. Domani si riparte.', h: 9, likes: 21 },
  { id: 105, author: 'Federica L.', tag: 'Serate', media: 'photo', k: 'barSera', text: 'Il locale a lume di candela dopo cena: luci blu, piante e un angolo tranquillo.', h: 11, likes: 47 },
  { id: 205, author: 'Chiara N.', tag: 'Viaggi', media: 'video', k: 'colosseo', text: 'Il Colosseo si accende di rosso mentre cala il sole.', h: 12, likes: 77 },
  { id: 106, author: 'Chiara N.', tag: 'Serate', media: 'photo', k: 'aperitivo', text: 'Aperitivo: cocktail con la schiuma, olive e assaggi da dividere.', h: 14, likes: 58 },
  { id: 206, author: 'Sophie M.', tag: 'Viaggi', media: 'video', k: 'positano', text: 'Positano vista dal mare: case colorate appese alla montagna.', h: 16, likes: 120 },
  { id: 107, author: 'Luca Ferri', tag: 'Caffè', media: 'photo', k: 'cappuccino', text: 'Latte art a foglia: la costanza paga anche con il caffè.', h: 18, likes: 44 },
  { id: 207, author: 'Giulia M.', tag: 'Viaggi', media: 'video', k: 'newYork', text: 'New York al tramonto: il ponte e lo skyline dall’alto.', h: 20, likes: 83 },
  { id: 108, author: 'Tommaso V.', tag: 'Giochi', media: 'photo', k: 'freccette', text: 'Serata freccette al pub con i dardi nuovi. Sfida aperta a chi vuole.', h: 22, likes: 29 },
  { id: 109, author: 'Davide R.', tag: 'Amici', media: 'photo', k: 'birra', text: 'Serata all’aperto con gli amici sotto le lucine: la birra è la parte meno importante.', h: 26, likes: 61 },
  { id: 300, author: 'Marco T.', tag: 'Cucina', media: 'photo', k: 'pizzaPatatine', text: 'Pizza e patatine fritte insieme: l’abbinamento che divide. Voi da che parte state?', h: 1.5, likes: 66 },
  { id: 301, author: 'Federica L.', tag: 'Serate', media: 'photo', k: 'tavolaCalici', text: 'Tavola apparecchiata a lume di candela: calici, orchidee viola e occhiali da sole dimenticati.', h: 3.5, likes: 54 },
  { id: 302, author: 'Davide R.', tag: 'Viaggi', media: 'photo', k: 'aeroporto', text: 'Corridoio della stazione verso i treni: valigie, insegne luminose e fretta di partire.', h: 4.5, likes: 27 },
  { id: 303, author: 'Elena F.', tag: 'Mostre', media: 'photo', k: 'tvVintage', text: 'Alla mostra del design: un televisore a colori d’epoca e un proiettore anni Settanta.', h: 6.5, likes: 48 },
  { id: 304, author: 'Sara B.', tag: 'Libri', media: 'photo', k: 'libro', text: 'Ultimo acquisto in libreria: una biografia che cercavo da tempo.', h: 8.5, likes: 36 },
  { id: 305, author: 'Tommaso V.', tag: 'Sport', media: 'photo', k: 'formulaUno', text: 'Qualifiche del sabato: onboard dal circuito cittadino e classifica in diretta.', h: 10, likes: 59 },
  { id: 306, author: 'Chiara N.', tag: 'Casa', media: 'photo', k: 'androne', text: 'Androne del palazzo nuovo: pavimento in graniglia, pianta e panca con i cuscini.', h: 12, likes: 31 },
  { id: 307, author: 'Giulia M.', tag: 'Viaggi', media: 'photo', k: 'codaPassaporti', text: 'Coda ai controlli dei passaporti: pazienza, cuffie e un po’ di musica.', h: 13, likes: 42 },
  { id: 308, author: 'Luca Ferri', tag: 'Viaggi', media: 'photo', k: 'peugeot', text: 'L’auto a noleggio per la gita: strada sterrata e tanta voglia di esplorare.', h: 15, likes: 25 },
  { id: 309, author: 'Sophie M.', tag: 'Design', media: 'photo', k: 'pietraSmart', text: 'Un assistente per la casa scolpito come una pietra: il design può essere anche silenzioso.', h: 17, likes: 92 },
  { id: 310, author: 'Sara B.', tag: 'Caffè', media: 'photo', k: 'caffeFiltro', text: 'Caffè filtro fatto con calma: macinatura media, acqua a 94 gradi e il bollitore a collo d’oca.', h: 19, likes: 57 },
  { id: 311, author: 'Marco T.', tag: 'Cucina', media: 'photo', k: 'menuBicerin', text: 'Il menu del giorno: tartare, poké e gnocchetti al gorgonzola. Cosa ordinereste?', h: 21, likes: 38 },
  { id: 312, author: 'Elena F.', tag: 'Locali', media: 'photo', k: 'nikis', text: 'Ristorante, bar e pasticceria all’angolo: aperti tutto il giorno.', h: 23, likes: 22 },
  { id: 320, author: 'Giulia M.', tag: 'Caffè', media: 'photo', k: 'tavolinoFinestra', text: 'Il tavolino vicino alla vetrata: marmo, sedie grigie e la mattina che comincia piano.', h: 2.5, likes: 41 },
  { id: 321, author: 'Federica L.', tag: 'Serate', media: 'photo', k: 'cocktailOlive', text: 'Aperitivo con cocktail, assaggi caldi e olive: si ordina tutto al centro.', h: 5.5, likes: 63 },
  { id: 322, author: 'Marco T.', tag: 'Cucina', media: 'photo', k: 'burgerPatatine', text: 'Hamburger con uovo, cheddar e bacon, patatine ondulate a parte. Pranzo senza compromessi.', h: 7.5, likes: 74 },
  { id: 323, author: 'Tommaso V.', tag: 'Giochi', media: 'photo', k: 'pubFreccette', text: 'Nel pub c’è ancora la vecchia macchina delle freccette: chi sfida chi?', h: 9.5, likes: 35 },
  { id: 324, author: 'Davide R.', tag: 'Cucina', media: 'photo', k: 'pizzaMucchio', text: 'Pizza con le patatine sopra: giusto o sbagliato? Commentate senza pietà.', h: 11.5, likes: 97 },
  { id: 325, author: 'Chiara N.', tag: 'Serate', media: 'photo', k: 'cocktailScuri', text: 'Locale in penombra: un negroni e un mule con il cetriolo.', h: 14.5, likes: 45 },
  { id: 326, author: 'Luca Ferri', tag: 'Cucina', media: 'photo', k: 'burgerViola', text: 'Due hamburger con patate fatte in casa, piatti viola e tavolo al sole.', h: 16.5, likes: 52 },
  { id: 327, author: 'Elena F.', tag: 'Caffè', media: 'photo', k: 'caffeInterno', text: 'Il nuovo caffè in centro: macchina verde, banco in pietra e sedie intrecciate.', h: 18.5, likes: 60 },
  { id: 328, author: 'Sara B.', tag: 'Caffè', media: 'photo', k: 'tazzeCaffe', text: 'Doppio espresso finito e cappuccino ancora caldo: pausa di metà mattina.', h: 20.5, likes: 34 },
  { id: 329, author: 'Giulia M.', tag: 'Caffè', media: 'photo', k: 'cappuccinoFiori', text: 'Cappuccino con il cuore di schiuma e fiori secchi sul tavolo.', h: 22.5, likes: 49 },
  { id: 330, author: 'Davide R.', tag: 'Amici', media: 'photo', k: 'corona', text: 'Brindisi con le Corona dopo una lunga giornata.', h: 25, likes: 28 },
  { id: 331, author: 'Marco T.', tag: 'Viaggi', media: 'photo', k: 'cotolette', text: 'Cotolette croccanti con insalata di patate e una birra chiara: la tappa bavarese.', h: 27, likes: 68 },
  { id: 332, author: 'Federica L.', tag: 'Amici', media: 'photo', k: 'brindisiBirra', text: 'Cin cin sotto l’ombrellone: la birra più buona è quella in compagnia.', h: 29, likes: 46 },
  { id: 333, author: 'Sophie M.', tag: 'Viaggi', media: 'photo', k: 'marienplatz', text: 'La piazza del municipio sotto un cielo blu: torre, orologio e bandiere colorate.', h: 31, likes: 110 },
  { id: 334, author: 'Chiara N.', tag: 'Viaggi', media: 'photo', k: 'finestrino', text: 'Dal finestrino: le Alpi tra le nuvole e l’ala che taglia il cielo.', h: 33, likes: 86 },
  { id: 335, author: 'Tommaso V.', tag: 'Serate', media: 'photo', k: 'birraPianta', text: 'Birra gelata a tarda sera, sotto l’ombrellone e con la pianta a fare compagnia.', h: 35, likes: 30 },
  { id: 340, author: 'Giulia M.', tag: 'Viaggi', media: 'photo', k: 'marienplatz', ks: ['marienplatz', 'cotolette', 'brindisiBirra', 'finestrino'], text: 'Weekend in Baviera: piazza del municipio, cotolette e birra chiara, e il ritorno tra le nuvole. Scorri per vedere tutto.', h: 3, likes: 134 },
  { id: 341, author: 'Sara B.', tag: 'Caffè', media: 'photo', k: 'caffeInterno', ks: ['caffeInterno', 'tazzeCaffe', 'cappuccinoFiori', 'caffeFiltro'], text: 'Giro di caffè nuovi: un locale in centro, espresso e cappuccino, poi a casa col filtro. Quale preferite?', h: 6, likes: 88 },
  { id: 342, author: 'Federica L.', tag: 'Serate', media: 'photo', k: 'cocktailOlive', ks: ['cocktailOlive', 'cocktailScuri', 'pubFreccette', 'birraPianta'], text: 'Serata lunga: cocktail, un bar in penombra, freccette al pub e l’ultima birra sotto l’ombrellone.', h: 9, likes: 101 },
  { id: 343, author: 'Marco T.', tag: 'Cucina', media: 'photo', k: 'burgerPatatine', ks: ['burgerPatatine', 'burgerViola', 'pizzaPatatine', 'pizzaMucchio'], text: 'Pranzi da ricordare: hamburger, patate fatte in casa e la pizza con le patatine sopra. Peccato di gola.', h: 13, likes: 119 },
  { id: 344, author: 'Davide R.', tag: 'Viaggi', media: 'photo', k: 'aeroporto', ks: ['aeroporto', 'codaPassaporti', 'finestrino'], text: 'Giorno di viaggio: corridoio della stazione, coda ai controlli e poi il cielo dal finestrino.', h: 17, likes: 76 },
  { id: 345, author: 'Elena F.', tag: 'Casa', media: 'photo', k: 'androne', ks: ['androne', 'tvVintage', 'pietraSmart', 'tavolinoFinestra'], text: 'Dettagli di design: un androne in pietra, un televisore d’epoca, una pietra che parla e il tavolino vicino alla vetrata.', h: 24, likes: 93 },
  { id: 360, author: 'Giulia M.', tag: 'Casa', media: 'photo', k: 'balconeSedie', text: 'Il balcone sistemato: bambù, sedie in filo e due tazze sul tavolino con la montagna davanti.', h: 2, likes: 81 },
  { id: 361, author: 'Marco T.', tag: 'Cucina', media: 'photo', k: 'menuFastFood', text: 'Cena sul balcone a lume di candela: panino, nuggets e patatine. Il lusso è non cucinare.', h: 4, likes: 57 },
  { id: 362, author: 'Sara B.', tag: 'Caffè', media: 'photo', k: 'croissantCappuccino', text: 'Colazione in hotel: espresso, croissant lucido e cappuccino con la foglia.', h: 6, likes: 66 },
  { id: 363, author: 'Elena F.', tag: 'Viaggi', media: 'photo', k: 'tettiMontagna', text: 'Dal balcone: tetti rossi, una chiesa con il rosone e il monte che chiude la valle.', h: 8, likes: 102 },
  { id: 364, author: 'Davide R.', tag: 'Amici', media: 'photo', k: 'panino28', text: 'Il panino che fa da torta: due candeline e un calice per brindare.', h: 10, likes: 125 },
  { id: 365, author: 'Federica L.', tag: 'Serate', media: 'photo', k: 'vinoCocktail', text: 'Un bicchiere di bianco e un drink scuro con ghiaccio: aperitivo tardo nel vicolo.', h: 12, likes: 49 },
  { id: 366, author: 'Chiara N.', tag: 'Casa', media: 'photo', k: 'balconeSera', text: 'Luce di fine giornata sul balcone: due bottiglie, le sedie e il monte arancione.', h: 14, likes: 73 },
  { id: 367, author: 'Tommaso V.', tag: 'Cucina', media: 'photo', k: 'cenaTacos', text: 'Cena da gente affamata: hamburger con patate, anelli di cipolla, nuggets e due tacos di pesce.', h: 16, likes: 90 },
  { id: 368, author: 'Sophie M.', tag: 'Viaggi', media: 'photo', k: 'cameraHotel', text: 'La camera con i due quadri della torre sul lago: sobria, luminosa, con i cuscini color senape.', h: 19, likes: 64 },
  { id: 369, author: 'Luca Ferri', tag: 'Caffè', media: 'photo', k: 'colazioneBanana', text: 'Dolce alla banana con cioccolato e nocciole, succo d’arancia e un cappuccino con il cuore.', h: 21, likes: 53 },
  { id: 370, author: 'Marco T.', tag: 'Viaggi', media: 'photo', k: 'duomo', text: 'Il Duomo di Milano nel pomeriggio: cielo blu, guglie di marmo e tantissima gente.', h: 23, likes: 138 },
  { id: 371, author: 'Giulia M.', tag: 'Animali', media: 'photo', k: 'cucciolo', text: 'Il cucciolo di golden con la sua pallina sul prato: la lingua dice tutto.', h: 26, likes: 170 },
  { id: 372, author: 'Elena F.', tag: 'Natura', media: 'photo', k: 'anatre', text: 'Due germani sul muretto del torrente: sembrano in attesa del turno per tuffarsi.', h: 28, likes: 58 },
  { id: 373, author: 'Sara B.', tag: 'Caffè', media: 'photo', k: 'latteRosa', text: 'Latte rosa alla barbabietola con la foglia di schiuma: sa meglio di come sembra.', h: 30, likes: 71 },
  { id: 374, author: 'Davide R.', tag: 'Animali', media: 'photo', k: 'goldenAdulto', text: 'Anche i golden grandi sanno posare: coccola, guinzaglio colorato e sole sul pavimento.', h: 32, likes: 144 },
  { id: 375, author: 'Tommaso V.', tag: 'Sport', media: 'photo', k: 'f1Tv', text: 'Domenica mattina sul divano: Formula 1 con la luce rossa dietro alla TV.', h: 34, likes: 62 },
  { id: 380, author: 'Giulia M.', tag: 'Casa', media: 'photo', k: 'balconeSedie', ks: ['balconeSedie','balconeSera','tettiMontagna'], text: 'Il balcone a tutte le ore: caffè al mattino, un bicchiere alla sera e sempre la montagna.', h: 5, likes: 109 },
  { id: 381, author: 'Davide R.', tag: 'Animali', media: 'photo', k: 'cucciolo', ks: ['cucciolo','goldenAdulto','anatre'], text: 'Passeggiata al parco: golden, anatre e un pomeriggio senza orologio.', h: 15, likes: 131 },
  { id: 400, author: 'Tommaso V.', tag: 'Cucina', media: 'photo', k: 'mcLago', text: 'Pausa pranzo sul lungolago: hamburger, patatine e la pioggia che arriva dall’altra parte.', h: 3, likes: 70 },
  { id: 401, author: 'Elena F.', tag: 'Animali', media: 'photo', k: 'asini', text: 'Due asini che fanno colazione in piazza: uno mangia, l’altro aspetta il suo turno.', h: 5, likes: 115 },
  { id: 402, author: 'Sophie M.', tag: 'Locali', media: 'photo', k: 'divanoPied', text: 'Il divano a pied-de-poule con i cuscini senape: il posto più fotografato del locale.', h: 7, likes: 84 },
  { id: 403, author: 'Federica L.', tag: 'Locali', media: 'photo', k: 'bancone', text: 'Il bancone dall’alto: bottiglie, ottone e il barista che sorride.', h: 9, likes: 59 },
  { id: 404, author: 'Marco T.', tag: 'Cucina', media: 'photo', k: 'burgerArdesia', text: 'Due hamburger serviti su ardesia, patatine nel cestello e birra chiara.', h: 11, likes: 102 },
  { id: 405, author: 'Sara B.', tag: 'Caffè', media: 'photo', k: 'croissantFarciti', text: 'Colazione a tre: croissant farcito al prosciutto, uno al pomodoro e cappuccino con il cuore.', h: 13, likes: 77 },
  { id: 406, author: 'Giulia M.', tag: 'Caffè', media: 'photo', k: 'croissantBianco', text: 'Tavolino bianco, due croissant e un cappuccino: la domenica comincia così.', h: 15, likes: 93 },
  { id: 407, author: 'Elena F.', tag: 'Locali', media: 'photo', k: 'poltrone', text: 'Poltroncine in bouclé e tavolino di marmo: un angolo tranquillo per leggere.', h: 17, likes: 48 },
  { id: 408, author: 'Chiara N.', tag: 'Cucina', media: 'photo', k: 'vetrinaDolci', text: 'La vetrina della pasticceria: croissant alla fragola, krofne e New York roll.', h: 19, likes: 88 },
  { id: 409, author: 'Davide R.', tag: 'Cucina', media: 'photo', k: 'pizzaBufala', text: 'Margherita con bufala e basilico, bordo bruciacchiato al punto giusto.', h: 21, likes: 121 },
  { id: 410, author: 'Luca Ferri', tag: 'Locali', media: 'photo', k: 'pasticceriaInterno', text: 'Entrando: pavimento a fiori bianco e nero, lampade in ottone e il bancone dei dolci.', h: 24, likes: 54 },
  { id: 411, author: 'Tommaso V.', tag: 'Viaggi', media: 'photo', k: 'torreBambu', text: 'Terrazza tra bambù e ginkgo, con la torre di vetro che spunta dietro.', h: 27, likes: 67 },
  { id: 420, author: 'Giulia M.', tag: 'Viaggi', media: 'video', k: 'videoCaffe', text: 'Preparativi sul lago: una tavolata lunghissima davanti all’isola. Domani pranzo per tutti.', h: 1, likes: 143 },
  { id: 421, author: 'Sara B.', tag: 'Caffè', media: 'photo', k: 'croissantFarciti', ks: ['croissantFarciti','croissantBianco','vetrinaDolci','pasticceriaInterno'], text: 'Tour della pasticceria del cuore: dalla vetrina al tavolino.', h: 6, likes: 126 },
  { id: 430, author: 'Sophie M.', tag: 'Viaggi', media: 'photo', k: 'piscinaBald', text: 'Bordo piscina: il letto a baldacchino con le tende bianche e il cielo che minaccia pioggia.', h: 2, likes: 150 },
  { id: 431, author: 'Marco T.', tag: 'Cucina', media: 'photo', k: 'colazioneUova', text: 'Colazione d’albergo: uova all’occhio di bue, formaggio, salame e succo d’arancia.', h: 8, likes: 45 },
  { id: 432, author: 'Davide R.', tag: 'Cucina', media: 'photo', k: 'hamburgerPiatto', text: 'Hamburger alla griglia con patate a spicchi e caprese di bufala: il pranzo perfetto.', h: 14, likes: 82 },
  { id: 433, author: 'Federica L.', tag: 'Caffè', media: 'photo', k: 'triesteCroissant', text: 'Colazione sotto il portico con la chiesa dietro: cappuccino, espresso e due croissant.', h: 20, likes: 98 },
  { id: 440, author: 'Federica L.', tag: 'Serate', media: 'video', k: 'vid01', text: 'Calici sulle rocce, al lume di una candela: la serata comincia così.', h: 2, likes: 132 },
  { id: 441, author: 'Giulia M.', tag: 'Viaggi', media: 'video', k: 'vid02', text: 'Passeggiata sul lungomare al tramonto, tra le palme e la gente.', h: 4, likes: 101 },
  { id: 442, author: 'Tommaso V.', tag: 'Serate', media: 'video', k: 'vid03', text: 'Concerto in piazza di sera: il palco illuminato e tutta la folla.', h: 6, likes: 76 },
  { id: 443, author: 'Davide R.', tag: 'Viaggi', media: 'video', k: 'vid04', text: 'Dal finestrino: la strada lungo il porto in una mattina limpida.', h: 9, likes: 44 },
  { id: 444, author: 'Elena F.', tag: 'Viaggi', media: 'video', k: 'vid05', text: 'Sassi come uova giganti nel giardino: i bambini ci salgono sopra.', h: 11, likes: 63 },
  { id: 445, author: 'Sophie M.', tag: 'Viaggi', media: 'video', k: 'vid06', text: 'Terrazza sul mare con gli ombrelloni chiusi: aspettiamo il sole.', h: 13, likes: 89 },
  { id: 446, author: 'Chiara N.', tag: 'Serate', media: 'video', k: 'vid07', text: 'Gradinata di notte con le lucine: musica, chiacchiere e mare sotto.', h: 16, likes: 70 },
  { id: 447, author: 'Marco T.', tag: 'Cucina', media: 'video', k: 'vid08', text: 'Hamburger e patatine sul vassoio rosso: il pranzo al volo.', h: 18, likes: 58 },
  { id: 448, author: 'Sara B.', tag: 'Caffè', media: 'video', k: 'vid09', text: 'Viale di palme con i tavolini all’aperto: l’ora dell’aperitivo si avvicina.', h: 22, likes: 41 },
  { id: 449, author: 'Luca Ferri', tag: 'Viaggi', media: 'video', k: 'vid10', text: 'Giro dell’hotel: piscina, lettini e palme all’ora del sole.', h: 25, likes: 95 },
  { id: 450, author: 'Giulia M.', tag: 'Viaggi', media: 'video', k: 'vid11', text: 'Dalla palma alla piscina: un giro lento tra i lettini.', h: 28, likes: 66 },
  { id: 451, author: 'Davide R.', tag: 'Viaggi', media: 'video', k: 'vid12', text: 'Il corridoio della piscina visto dall’alto: ombrelloni, palme e un tuffo.', h: 31, likes: 87 },
];
/** Momenti (Recap) di chi segui. */
const STORIES: { id: string; author: string; k: Key; kind: 'photo' | 'video'; h: number; text?: string }[] = [
  { id: 'seed-st-g1', author: 'Giulia M.', k: 'colazione', kind: 'photo', h: 1.2 }, { id: 'seed-st-g2', author: 'Giulia M.', k: 'spiaggia', kind: 'video', h: 1 }, { id: 'seed-st-g3', author: 'Giulia M.', k: 'freccette', kind: 'photo', h: 0.6 },
  { id: 'seed-st-m1', author: 'Marco T.', k: 'pizza', kind: 'photo', h: 2.5 }, { id: 'seed-st-m2', author: 'Marco T.', k: 'roma', kind: 'video', h: 2 },
  { id: 'seed-st-s1', author: 'Sara B.', k: 'cappuccino', kind: 'photo', h: 3 },
  { id: 'seed-st-e1', author: 'Elena F.', k: 'spazio', kind: 'video', h: 4 },
  { id: 'seed-st-so1', author: 'Sophie M.', k: 'positano', kind: 'video', h: 5 },
  { id: 'seed-st-d1', author: 'Davide R.', k: 'aeroporto', kind: 'photo', h: 1.5 },
  { id: 'seed-st-f1', author: 'Federica L.', k: 'tavolaCalici', kind: 'photo', h: 2.5 },
  { id: 'seed-st-t1', author: 'Tommaso V.', k: 'formulaUno', kind: 'photo', h: 3.5 },
  { id: 'seed-st-c1', author: 'Chiara N.', k: 'androne', kind: 'photo', h: 4.5 },
  { id: 'seed-st-s2', author: 'Sara B.', k: 'caffeFiltro', kind: 'photo', h: 5.5 },
  { id: 'seed-st-g2b', author: 'Giulia M.', k: 'tavolinoFinestra', kind: 'photo', h: 0.4 },
  { id: 'seed-st-m3', author: 'Marco T.', k: 'burgerPatatine', kind: 'photo', h: 0.9 },
  { id: 'seed-st-so2', author: 'Sophie M.', k: 'marienplatz', kind: 'photo', h: 1.4 },
  { id: 'seed-st-c2', author: 'Chiara N.', k: 'finestrino', kind: 'photo', h: 1.9 },
  { id: 'seed-st-f2', author: 'Federica L.', k: 'cocktailOlive', kind: 'photo', h: 2.4 },
  { id: 'seed-st-d2', author: 'Davide R.', k: 'duomo', kind: 'photo', h: 0.3 },
  { id: 'seed-st-g4', author: 'Giulia M.', k: 'cucciolo', kind: 'photo', h: 0.7 },
  { id: 'seed-st-s3', author: 'Sara B.', k: 'latteRosa', kind: 'photo', h: 1.1 },
  { id: 'seed-st-t2', author: 'Tommaso V.', k: 'f1Tv', kind: 'photo', h: 1.5000000000000002 },
  { id: 'seed-st-v1', author: 'Giulia M.', k: 'vid02', kind: 'video', h: 0.2 },
  { id: 'seed-st-v2', author: 'Sophie M.', k: 'vid10', kind: 'video', h: 0.5 },
  { id: 'seed-st-v3', author: 'Federica L.', k: 'triesteCroissant', kind: 'photo', h: 0.8 },
];

/** Percorsi dei file inclusi nell'app, senza moduli nativi aggiuntivi (funziona anche nella build già installata). */
async function resolve(): Promise<Record<Key, string>> {
  const out = {} as Record<Key, string>;
  (Object.keys(M) as Key[]).forEach((k) => { out[k] = Image.resolveAssetSource(M[k] as number)?.uri ?? ''; });
  return out;
}

/** In modalità demo mette in Home, Swipe e Recap i contenuti di altre persone; a ogni avvio aggiorna i percorsi dei file. */
export function useSeedMedia() {
  const demo = useApp((s) => s.demo);
  const done = useRef(false);
  useEffect(() => {
    if (!demo || done.current) return;
    done.current = true;
    void resolve().then((uris) => {
      const now = Date.now();
      const st = useNet.getState();
      const have = new Map(st.posts.map((p) => [p.id, p]));
      const fresh: Post[] = POSTS.map((p) => ({ id: p.id, author: p.author, text: p.text, media: p.media, tag: p.tag, likes: have.get(p.id)?.likes ?? p.likes, ts: have.get(p.id)?.ts ?? now - p.h * H, uri: uris[p.k], ...(p.ks ? { uris: p.ks.map((k) => uris[k]) } : {}) }));
      const keepPosts = st.posts.filter((p) => !POSTS.some((x) => x.id === p.id));
      const oldS = new Map((st.stories ?? []).map((s) => [s.id, s]));
      const stories: Story[] = STORIES.flatMap((s) => {
        const prev = oldS.get(s.id);
        const made = makeStory({ id: s.id, author: s.author, now: prev?.ts ?? now - s.h * H, kind: s.kind, uri: uris[s.k], ...(s.text ? { text: s.text } : {}) });
        return made ? [prev ? { ...made, views: prev.views } : made] : [];
      });
      st.patch({ posts: [...fresh, ...keepPosts], stories: [...(st.stories ?? []).filter((s) => !s.id.startsWith('seed-st-')), ...stories] });
    }).catch(() => { done.current = false; });
  }, [demo]);
}
