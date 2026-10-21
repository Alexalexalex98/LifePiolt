/** Fonti gratuite delle notizie: testate svizzere in italiano e italiane. Per aggiungerne o toglierne basta cambiare questo elenco.
 *  Gli indirizzi sono quelli pubblici dei feed RSS delle testate: se una testata li cambia, quella fonte salta e le altre continuano. */
export type Feed = { id: string; name: string; url: string };
export const FEEDS: Feed[] = [
  { id: 'rsi', name: 'RSI', url: 'https://www.rsi.ch/rss/news.xml' },
  { id: 'tio', name: 'Tio', url: 'https://www.tio.ch/rss' },
  { id: 'cdt', name: 'Corriere del Ticino', url: 'https://www.cdt.ch/rss' },
  { id: 'ansa', name: 'ANSA', url: 'https://www.ansa.it/sito/ansait_rss.xml' },
  { id: 'corriere', name: 'Corriere della Sera', url: 'https://xml2.corriereobjects.it/rss/homepage.xml' },
  { id: 'repubblica', name: 'la Repubblica', url: 'https://www.repubblica.it/rss/homepage/rss2.0.xml' },
];
