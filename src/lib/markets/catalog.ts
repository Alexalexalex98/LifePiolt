/**
 * Elenco dei titoli che si possono comprare in LifePoints. Quotati negli Stati Uniti (in dollari) e convertiti in LP al cambio del momento.
 * Il prezzo qui è solo l'ULTIMO NOTO (approssimato): serve quando non c'è rete. I prezzi correnti li porta `quotes.ts`.
 * Formato di ogni riga: simbolo | nome | settore | prezzo noto
 */
export type Kind = 'azione' | 'etf' | 'obbligazione' | 'materia' | 'cripto';
export type Instrument = { sym: string; name: string; kind: Kind; sector: string; last: number; ccy: 'USD' };

const RAW: Record<Kind, string> = {
  azione: `AAPL|Apple|Tecnologia|230
MSFT|Microsoft|Tecnologia|420
NVDA|NVIDIA|Semiconduttori|135
GOOGL|Alphabet (Google)|Tecnologia|170
AMZN|Amazon|Commercio|190
META|Meta Platforms|Tecnologia|550
TSLA|Tesla|Auto|250
AVGO|Broadcom|Semiconduttori|170
ORCL|Oracle|Tecnologia|140
CRM|Salesforce|Software|280
ADBE|Adobe|Software|500
NFLX|Netflix|Intrattenimento|680
AMD|AMD|Semiconduttori|150
INTC|Intel|Semiconduttori|25
CSCO|Cisco|Tecnologia|55
IBM|IBM|Tecnologia|200
QCOM|Qualcomm|Semiconduttori|170
TXN|Texas Instruments|Semiconduttori|190
UBER|Uber|Trasporti|70
ABNB|Airbnb|Viaggi|140
SHOP|Shopify|Commercio|80
PYPL|PayPal|Pagamenti|70
V|Visa|Pagamenti|280
MA|Mastercard|Pagamenti|480
JPM|JPMorgan Chase|Banche|210
BAC|Bank of America|Banche|40
GS|Goldman Sachs|Banche|500
MS|Morgan Stanley|Banche|110
WFC|Wells Fargo|Banche|65
C|Citigroup|Banche|65
BLK|BlackRock|Finanza|900
SCHW|Charles Schwab|Finanza|75
AXP|American Express|Finanza|250
BRK-B|Berkshire Hathaway|Finanza|450
UNH|UnitedHealth|Salute|550
JNJ|Johnson & Johnson|Salute|155
LLY|Eli Lilly|Salute|800
PFE|Pfizer|Salute|28
MRK|Merck|Salute|100
ABBV|AbbVie|Salute|180
TMO|Thermo Fisher|Salute|550
ABT|Abbott|Salute|115
NVO|Novo Nordisk|Salute|100
AZN|AstraZeneca|Salute|70
NVS|Novartis|Salute|110
RHHBY|Roche|Salute|40
WMT|Walmart|Commercio|80
COST|Costco|Commercio|900
HD|Home Depot|Commercio|380
TGT|Target|Commercio|140
NKE|Nike|Abbigliamento|80
SBUX|Starbucks|Ristorazione|95
MCD|McDonald's|Ristorazione|290
KO|Coca-Cola|Bevande|65
PEP|PepsiCo|Bevande|170
PG|Procter & Gamble|Beni di consumo|165
PM|Philip Morris|Beni di consumo|120
DIS|Disney|Intrattenimento|100
CMCSA|Comcast|Media|40
T|AT&T|Telecomunicazioni|20
VZ|Verizon|Telecomunicazioni|42
XOM|Exxon Mobil|Energia|115
CVX|Chevron|Energia|155
SHEL|Shell|Energia|70
TTE|TotalEnergies|Energia|60
BP|BP|Energia|32
NEE|NextEra Energy|Energia|78
DUK|Duke Energy|Energia|115
CAT|Caterpillar|Industria|370
DE|Deere|Industria|420
BA|Boeing|Aerospazio|170
LMT|Lockheed Martin|Difesa|550
RTX|RTX|Difesa|120
GE|GE Aerospace|Aerospazio|180
HON|Honeywell|Industria|210
UPS|UPS|Logistica|130
FDX|FedEx|Logistica|270
F|Ford|Auto|11
GM|General Motors|Auto|50
TM|Toyota|Auto|180
SONY|Sony|Elettronica|20
TSM|TSMC|Semiconduttori|190
ASML|ASML|Semiconduttori|750
SAP|SAP|Software|240
SAN|Santander|Banche|5
BABA|Alibaba|Commercio|90
NIO|NIO|Auto|5
PLTR|Palantir|Software|60
SNOW|Snowflake|Software|130
CRWD|CrowdStrike|Sicurezza|330
PANW|Palo Alto Networks|Sicurezza|180
NOW|ServiceNow|Software|900
INTU|Intuit|Software|640
BKNG|Booking Holdings|Viaggi|4500
MAR|Marriott|Viaggi|270
SPOT|Spotify|Intrattenimento|420
LVMUY|LVMH|Lusso|140
EL|Estee Lauder|Beni di consumo|75
ADI|Analog Devices|Semiconduttori|220
MU|Micron|Semiconduttori|100
LRCX|Lam Research|Semiconduttori|75
AMAT|Applied Materials|Semiconduttori|180
DELL|Dell|Tecnologia|120
HPQ|HP|Tecnologia|35
XYZ|Block|Pagamenti|70
COIN|Coinbase|Cripto|250
MSTR|MicroStrategy|Cripto|300
HOOD|Robinhood|Finanza|30
RIVN|Rivian|Auto|13
LCID|Lucid|Auto|3`,
  etf: `SPY|SPDR S&P 500|Azioni USA|570
VOO|Vanguard S&P 500|Azioni USA|525
IVV|iShares Core S&P 500|Azioni USA|575
VTI|Vanguard Total Market|Azioni USA|280
QQQ|Invesco Nasdaq 100|Tecnologia|490
DIA|SPDR Dow Jones|Azioni USA|420
IWM|iShares Russell 2000|Piccole imprese|220
VGT|Vanguard Tecnologia|Tecnologia|600
XLK|Tecnologia (settore)|Tecnologia|230
XLF|Finanza (settore)|Finanza|48
XLE|Energia (settore)|Energia|90
XLV|Salute (settore)|Salute|150
XLY|Beni voluttuari (settore)|Consumi|215
XLP|Beni di prima necessità (settore)|Consumi|80
XLI|Industria (settore)|Industria|135
XLU|Servizi pubblici (settore)|Energia|80
VNQ|Vanguard Immobiliare|Immobiliare|90
VT|Vanguard Mondo|Azioni mondo|120
VEA|Vanguard Paesi sviluppati|Azioni mondo|52
VWO|Vanguard Paesi emergenti|Emergenti|46
EEM|iShares Emergenti|Emergenti|43
IEFA|iShares Europa Asia Australia|Azioni mondo|75
EFA|iShares Paesi sviluppati ex USA|Azioni mondo|80
VGK|Vanguard Europa|Europa|65
EWJ|iShares Giappone|Asia|72
EWG|iShares Germania|Europa|33
EWU|iShares Regno Unito|Europa|35
EWL|iShares Svizzera|Europa|55
FXI|iShares Cina|Asia|27
INDA|iShares India|Asia|55
EWZ|iShares Brasile|Emergenti|28
SCHD|Schwab Dividendi USA|Dividendi|82
VIG|Vanguard Crescita dei dividendi|Dividendi|205
VYM|Vanguard Alto dividendo|Dividendi|125
DVY|iShares Selezione dividendi|Dividendi|130
ARKK|ARK Innovazione|Tecnologia|55
SOXX|iShares Semiconduttori|Semiconduttori|220
SMH|VanEck Semiconduttori|Semiconduttori|240
ICLN|iShares Energia pulita|Energia|14
TAN|Invesco Solare|Energia|45
LIT|Global X Litio e batterie|Materie prime|40
BOTZ|Global X Robotica e AI|Tecnologia|30
ESGU|iShares ESG USA|Sostenibili|120
ESGV|Vanguard ESG USA|Sostenibili|105
VUG|Vanguard Crescita|Azioni USA|420
VTV|Vanguard Valore|Azioni USA|170
MTUM|iShares Momentum|Azioni USA|200
USMV|iShares Bassa volatilità|Azioni USA|95
QUAL|iShares Qualità|Azioni USA|175
IJH|iShares Medie imprese|Azioni USA|62
IJR|iShares Piccole imprese|Piccole imprese|120
SCHX|Schwab Grandi imprese USA|Azioni USA|22
ITOT|iShares Total Market|Azioni USA|125
SCHB|Schwab Total Market|Azioni USA|23
RSP|Invesco S&P 500 Equi-peso|Azioni USA|180
XBI|SPDR Biotecnologia|Salute|95
IBB|iShares Biotecnologia|Salute|140
ITA|iShares Aerospazio e difesa|Difesa|140
JETS|US Global Jets|Viaggi|22
XHB|SPDR Costruzioni|Immobiliare|115
KRE|SPDR Banche regionali|Banche|60
KBE|SPDR Banche|Banche|55
VPU|Vanguard Servizi pubblici|Energia|175`,
  obbligazione: `AGG|iShares Obbligazioni USA|Aggregate|100
BND|Vanguard Obbligazioni USA|Aggregate|74
BNDX|Vanguard Obbligazioni estere|Aggregate|49
TLT|Titoli di Stato USA 20+ anni|Governativi lunghi|92
IEF|Titoli di Stato USA 7-10 anni|Governativi medi|96
SHY|Titoli di Stato USA 1-3 anni|Governativi brevi|82
BIL|Buoni del Tesoro 1-3 mesi|Liquidità|91.5
SGOV|Buoni del Tesoro 0-3 mesi|Liquidità|100.5
GOVT|Titoli di Stato USA|Governativi|23
TIP|Titoli di Stato USA legati all'inflazione|Inflazione|108
VTIP|Vanguard Inflazione breve|Inflazione|49
LQD|Obbligazioni societarie di qualità|Societarie|110
VCIT|Vanguard Societarie medie|Societarie|83
VCSH|Vanguard Societarie brevi|Societarie|79
HYG|Obbligazioni ad alto rendimento|Alto rendimento|79
JNK|SPDR Alto rendimento|Alto rendimento|96
EMB|Obbligazioni emergenti in dollari|Emergenti|90
MUB|Obbligazioni comunali USA|Comunali|108
BSV|Vanguard Obbligazioni brevi|Aggregate|78
BIV|Vanguard Obbligazioni medie|Aggregate|76
BLV|Vanguard Obbligazioni lunghe|Governativi lunghi|72
SCHZ|Schwab Obbligazioni USA|Aggregate|23
IGSB|iShares Societarie brevi|Societarie|52
USIG|iShares Societarie USA|Societarie|52
FLOT|iShares Tasso variabile|Liquidità|51
JPST|JPMorgan Ultra-breve|Liquidità|50.5
MINT|PIMCO Liquidità|Liquidità|100
TLH|iShares Titoli di Stato 10-20 anni|Governativi lunghi|112
SPAB|SPDR Obbligazioni USA|Aggregate|26
IAGG|iShares Obbligazioni estere|Aggregate|52
BWX|SPDR Obbligazioni governative estere|Governativi|23
VGSH|Vanguard Titoli di Stato brevi|Governativi brevi|58
VGIT|Vanguard Titoli di Stato medi|Governativi medi|59
VGLT|Vanguard Titoli di Stato lunghi|Governativi lunghi|57
EDV|Vanguard Titoli di Stato molto lunghi|Governativi lunghi|75
ZROZ|PIMCO Zero Coupon 25+|Governativi lunghi|68
SPSB|SPDR Societarie brevi|Societarie|30
ANGL|VanEck Obbligazioni ex-fallen|Alto rendimento|30`,
  materia: `GLD|Oro (SPDR)|Metalli preziosi|230
IAU|Oro (iShares)|Metalli preziosi|47
SLV|Argento (iShares)|Metalli preziosi|27
PPLT|Platino|Metalli preziosi|95
PALL|Palladio|Metalli preziosi|95
GLDM|Oro (mini)|Metalli preziosi|47
USO|Petrolio (WTI)|Energia|75
BNO|Petrolio (Brent)|Energia|32
UNG|Gas naturale|Energia|15
DBA|Prodotti agricoli|Agricoltura|27
DBC|Materie prime diversificate|Diversificate|22
PDBC|Materie prime (senza futures K-1)|Diversificate|14
CPER|Rame|Metalli industriali|27
COPX|Minatori di rame|Metalli industriali|50
GDX|Minatori d'oro|Metalli preziosi|40
GDXJ|Minatori d'oro piccoli|Metalli preziosi|48
SIL|Minatori d'argento|Metalli preziosi|32
URA|Uranio|Energia|28
WEAT|Grano|Agricoltura|5.5
CORN|Mais|Agricoltura|21`,
  cripto: `IBIT|Bitcoin (iShares)|Bitcoin|52
FBTC|Bitcoin (Fidelity)|Bitcoin|85
ARKB|Bitcoin (ARK 21Shares)|Bitcoin|62
BITB|Bitcoin (Bitwise)|Bitcoin|45
GBTC|Bitcoin (Grayscale)|Bitcoin|70
BTC|Bitcoin Mini (Grayscale)|Bitcoin|36
ETHA|Ethereum (iShares)|Ethereum|23
FETH|Ethereum (Fidelity)|Ethereum|23
ETHE|Ethereum (Grayscale)|Ethereum|23
BITO|Bitcoin futures (ProShares)|Bitcoin|22
BKCH|Blockchain (Global X)|Blockchain|35
BLOK|Blockchain (Amplify)|Blockchain|42`,
};

export const KIND_LABEL: Record<Kind, string> = { azione: 'Azioni', etf: 'ETF', obbligazione: 'Obbligazioni', materia: 'Materie prime', cripto: 'Cripto' };
export const KINDS: Kind[] = ['azione', 'etf', 'obbligazione', 'materia', 'cripto'];

export const CATALOG: Instrument[] = (Object.keys(RAW) as Kind[]).flatMap((kind) =>
  RAW[kind].split('\n').map((row) => {
    const [sym, name, sector, last] = row.split('|');
    return { sym: sym.trim(), name: name.trim(), kind, sector: sector.trim(), last: Number(last), ccy: 'USD' as const };
  }),
);
export const BY_SYM: Record<string, Instrument> = Object.fromEntries(CATALOG.map((i) => [i.sym, i]));
