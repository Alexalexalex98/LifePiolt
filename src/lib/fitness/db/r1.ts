/** Ricette: Nome|metodo breve|ingrediente:grammi;… (per UNA porzione). Gli ingredienti sono nomi del database alimenti. */
export const R1 = `
Risotto ai funghi|Soffriggi la cipolla, tosta il riso, sfuma, aggiungi brodo e funghi, manteca con burro e parmigiano.|Riso bianco crudo:80;Funghi champignon:100;Cipolla:20;Burro:10;Parmigiano reggiano:15;Brodo vegetale:250;Olio extravergine d'oliva:5
Risotto alla milanese|Tosta il riso nel burro, aggiungi brodo e zafferano, manteca con burro e grana.|Riso bianco crudo:80;Burro:15;Cipolla:20;Parmigiano reggiano:20;Brodo di carne:250;Vino bianco:30
Risotto agli asparagi|Cuoci il riso con brodo e punte di asparagi, manteca con parmigiano.|Riso bianco crudo:80;Asparagi:120;Cipolla:20;Burro:10;Parmigiano reggiano:15;Brodo vegetale:250
Risotto alla zucca|Cuoci la zucca a cubetti e il riso con brodo, manteca con parmigiano.|Riso bianco crudo:80;Zucca:150;Cipolla:20;Burro:10;Parmigiano reggiano:15;Brodo vegetale:250
Risotto ai frutti di mare|Rosola l'aglio, aggiungi i frutti di mare, tosta il riso, sfuma e cuoci con brodo di pesce.|Riso bianco crudo:80;Cozze:80;Vongole:80;Gamberi:50;Olio extravergine d'oliva:10;Vino bianco:30;Passata di pomodoro:30
Risotto alla parmigiana|Cuoci il riso in brodo, manteca con burro e abbondante parmigiano.|Riso bianco crudo:80;Burro:15;Parmigiano reggiano:30;Cipolla:20;Brodo di carne:250
Spaghetti alla carbonara|Rosola il guanciale, unisci uova e pecorino fuori dal fuoco alla pasta cotta.|Pasta di semola cruda:90;Guanciale:30;Uovo di gallina intero:50;Tuorlo:20;Pecorino romano:20
Spaghetti all'amatriciana|Rosola il guanciale, aggiungi pomodoro, condisci la pasta con pecorino.|Pasta di semola cruda:90;Guanciale:30;Polpa di pomodoro:100;Pecorino romano:15;Olio extravergine d'oliva:5
Spaghetti aglio olio e peperoncino|Rosola aglio e peperoncino nell'olio e salta la pasta.|Pasta di semola cruda:90;Olio extravergine d'oliva:15;Aglio:5;Prezzemolo:3
Spaghetti al pomodoro|Cuoci il sugo di pomodoro con basilico e condisci la pasta.|Pasta di semola cruda:90;Passata di pomodoro:120;Olio extravergine d'oliva:10;Basilico fresco:3;Parmigiano reggiano:10
Spaghetti alle vongole|Apri le vongole con aglio e vino, salta la pasta nel fondo di cottura.|Pasta di semola cruda:90;Vongole:200;Olio extravergine d'oliva:12;Aglio:5;Vino bianco:30;Prezzemolo:3
Spaghetti cacio e pepe|Mantecare la pasta con pecorino e pepe con acqua di cottura.|Pasta di semola cruda:90;Pecorino romano:40;Pepe:1
Spaghetti alla puttanesca|Soffriggi aglio, acciughe, olive e capperi, aggiungi pomodoro.|Pasta di semola cruda:90;Polpa di pomodoro:100;Olive nere:20;Capperi:5;Acciughe sott'olio:10;Olio extravergine d'oliva:10;Aglio:5
Penne all'arrabbiata|Cuoci pomodoro, aglio e peperoncino e condisci la pasta.|Pasta di semola cruda:90;Passata di pomodoro:120;Olio extravergine d'oliva:10;Aglio:5
Pasta al pesto|Condisci la pasta con il pesto genovese.|Pasta di semola cruda:90;Pesto alla genovese:30;Parmigiano reggiano:10
Pasta al forno|Condisci pasta con ragù, mozzarella e besciamella, gratina in forno.|Pasta di semola cruda:80;Ragù di carne:100;Mozzarella di vacca:50;Besciamella:50;Parmigiano reggiano:15
Pasta e fagioli|Cuoci fagioli e pasta in un soffritto con brodo.|Pasta di semola cruda:50;Fagioli borlotti cotti:150;Cipolla:20;Sedano:20;Carote crude:20;Olio extravergine d'oliva:10;Passata di pomodoro:30
Pasta e ceci|Cuoci ceci, rosmarino e pasta in brodo.|Pasta di semola cruda:50;Ceci cotti:150;Olio extravergine d'oliva:10;Aglio:5;Rosmarino:2;Passata di pomodoro:30
Pasta e patate|Cuoci patate e pasta insieme con provola.|Pasta di semola cruda:50;Patate lesse:200;Cipolla:20;Olio extravergine d'oliva:10;Provola affumicata:20
Lasagne alla bolognese|Alterna sfoglie, ragù e besciamella, gratina.|Pasta all'uovo cruda:70;Ragù di carne:120;Besciamella:100;Parmigiano reggiano:20
Cannelloni ricotta e spinaci|Farcisci le sfoglie con ricotta e spinaci, copri con besciamella.|Pasta all'uovo cruda:60;Ricotta di vacca:80;Spinaci lessati:80;Besciamella:80;Parmigiano reggiano:15
Gnocchi al pomodoro|Condisci gli gnocchi con sugo di pomodoro e basilico.|Gnocchi di patate:200;Passata di pomodoro:100;Olio extravergine d'oliva:8;Parmigiano reggiano:10
Gnocchi al gorgonzola|Fondi il gorgonzola con la panna e condisci gli gnocchi.|Gnocchi di patate:200;Gorgonzola dolce:50;Panna da cucina:30
Tortellini in brodo|Cuoci i tortellini nel brodo di carne.|Tortellini di carne cotti:150;Brodo di carne:250;Parmigiano reggiano:10
Riso al curry|Salta il riso con cipolla e curry.|Riso bianco crudo:80;Curry in polvere:3;Cipolla:30;Olio extravergine d'oliva:8;Piselli surgelati:50
Insalata di riso|Mescola riso freddo con tonno, uova sode, verdure e olive.|Riso bianco crudo:70;Tonno sott'olio sgocciolato:50;Uova sode:50;Mais dolce in scatola:30;Olive verdi:20;Pomodori da insalata:50;Olio extravergine d'oliva:10
Insalata di pasta|Condisci la pasta fredda con mozzarella, pomodori e olive.|Pasta di semola cruda:80;Mozzarella di vacca:60;Pomodori ciliegino:80;Olive nere:15;Basilico fresco:3;Olio extravergine d'oliva:10;Tonno sott'olio sgocciolato:40
Insalata caprese|Alterna fette di pomodoro e mozzarella con basilico e olio.|Mozzarella di vacca:125;Pomodori da insalata:150;Basilico fresco:3;Olio extravergine d'oliva:8
Insalata Caesar|Lattuga con pollo, crostini, grana e salsa.|Lattuga romana:100;Petto di pollo alla piastra:100;Crostini:20;Parmigiano reggiano:15;Olio extravergine d'oliva:10;Maionese:15
Insalata greca|Pomodori, cetrioli, cipolla, olive e feta.|Pomodori da insalata:100;Cetrioli:80;Cipolla rossa di Tropea:20;Olive nere:20;Feta:50;Olio extravergine d'oliva:10
Insalata mista con tonno|Insalata, pomodori e tonno condita con olio.|Insalata mista:150;Pomodori da insalata:80;Tonno al naturale:80;Olio extravergine d'oliva:8;Mais dolce in scatola:30
Poke bowl con salmone|Riso, salmone, avocado, edamame e cetrioli.|Riso per sushi cotto:150;Salmone fresco:100;Avocado:50;Edamame:50;Cetrioli:50;Salsa di soia:10
Pollo alla piastra con insalata|Petto di pollo grigliato con insalata.|Petto di pollo alla piastra:150;Insalata mista:150;Olio extravergine d'oliva:8;Pomodori da insalata:50
Pollo al forno con patate|Cosce di pollo e patate al forno con rosmarino.|Coscia di pollo senza pelle:180;Patate al forno:200;Olio extravergine d'oliva:10;Rosmarino:2
Pollo al curry|Pollo a pezzi cotto con curry e latte di cocco.|Petto di pollo crudo:150;Curry in polvere:4;Latte di cocco (lattina):60;Cipolla:40;Olio extravergine d'oliva:8;Riso basmati cotto:150
Cotoletta alla milanese|Vitello impanato e fritto nel burro.|Cotoletta alla milanese:150;Burro:10;Limone:20
Scaloppine al limone|Fettine di vitello infarinate, cotte con limone.|Vitello arrosto:150;Farina 00:10;Burro:10;Limone:20
Polpette al sugo|Polpette di carne cotte nel sugo di pomodoro.|Polpette di carne:150;Passata di pomodoro:100;Olio extravergine d'oliva:8
Hamburger con panino|Hamburger di manzo in panino con insalata e pomodoro.|Hamburger di manzo:120;Pane per hamburger:70;Lattuga:20;Pomodori da insalata:30;Ketchup:10
Cheeseburger|Hamburger con formaggio fuso nel panino.|Hamburger di manzo:120;Pane per hamburger:70;Cheddar:25;Lattuga:20;Ketchup:10
Salmone al forno con verdure|Salmone e verdure cotti al forno.|Salmone fresco:150;Zucchine:100;Pomodori ciliegino:60;Olio extravergine d'oliva:8;Limone:15
Orata al forno con patate|Orata e patate al forno con erbe.|Orata:200;Patate lesse:150;Olio extravergine d'oliva:10;Prezzemolo:3
Branzino alla griglia|Branzino grigliato con limone.|Branzino:200;Olio extravergine d'oliva:8;Limone:15
Frittata di zucchine|Uova sbattute con zucchine cotte in padella.|Uovo di gallina intero:120;Zucchine:120;Parmigiano reggiano:10;Olio extravergine d'oliva:8
Frittata di cipolle|Uova con cipolle stufate.|Uovo di gallina intero:120;Cipolla:100;Olio extravergine d'oliva:8;Parmigiano reggiano:10
Omelette al formaggio|Uova con formaggio fuso.|Uovo di gallina intero:120;Emmental:30;Burro:5
Uova strapazzate|Uova mescolate in padella con burro.|Uovo di gallina intero:120;Burro:8;Latte intero:20
Parmigiana di melanzane|Melanzane fritte, pomodoro e mozzarella a strati.|Melanzane:200;Passata di pomodoro:100;Mozzarella di vacca:80;Parmigiano reggiano:20;Olio extravergine d'oliva:20
Zuppa di verdure|Verdure miste cotte in brodo.|Minestrone:300;Olio extravergine d'oliva:5;Parmigiano reggiano:10
Minestrone con pasta|Minestrone con pastina e parmigiano.|Minestrone:250;Pasta di semola cruda:30;Olio extravergine d'oliva:5;Parmigiano reggiano:10
Crema di zucca|Zucca e patata frullate con brodo.|Zucca:200;Patate lesse:60;Cipolla:30;Olio extravergine d'oliva:8;Brodo vegetale:150
Zuppa di lenticchie|Lenticchie cotte con verdure.|Lenticchie cotte:180;Carote crude:30;Sedano:20;Cipolla:30;Olio extravergine d'oliva:8;Passata di pomodoro:40
Purè di patate|Patate schiacciate con latte e burro.|Patate lesse:250;Latte intero:40;Burro:10;Parmigiano reggiano:10
Patate al forno|Patate a spicchi con olio e rosmarino.|Patate lesse:250;Olio extravergine d'oliva:12;Rosmarino:2
Verdure grigliate|Zucchine, melanzane e peperoni grigliati.|Zucchine:80;Melanzane:80;Peperoni:80;Olio extravergine d'oliva:10
Pane con pomodoro e mozzarella|Pane tostato con pomodoro e mozzarella.|Pane bianco:60;Pomodori da insalata:60;Mozzarella di vacca:60;Olio extravergine d'oliva:5
Bruschetta al pomodoro|Pane grigliato con pomodoro, aglio e basilico.|Pane bianco:60;Pomodori da insalata:80;Olio extravergine d'oliva:8;Aglio:3;Basilico fresco:2
Toast prosciutto e formaggio|Pane in cassetta con prosciutto cotto e formaggio.|Pane in cassetta bianco:60;Prosciutto cotto:40;Emmental:30
Panino col prosciutto crudo|Panino con prosciutto crudo.|Panino al latte:70;Prosciutto crudo:50;Burro:5
Panino con tonno e pomodoro|Panino con tonno, pomodoro e maionese.|Michetta:70;Tonno al naturale:60;Pomodori da insalata:40;Maionese:10;Lattuga:15
Panino con cotoletta|Cotoletta in panino con insalata.|Michetta:70;Cotoletta alla milanese:100;Lattuga:15;Maionese:10
Piadina crudo e squacquerone|Piadina con prosciutto crudo, squacquerone e rucola.|Piadina romagnola:100;Prosciutto crudo:50;Squacquerone:50;Rucola:15
Wrap di pollo|Tortilla con pollo, insalata e salsa yogurt.|Tortilla di grano:60;Petto di pollo alla piastra:80;Lattuga:30;Salsa yogurt:30;Pomodori da insalata:30
Pizza margherita fatta in casa|Impasto condito con pomodoro e mozzarella.|Impasto per pizza:250;Passata di pomodoro:80;Mozzarella per pizza:100;Olio extravergine d'oliva:8;Basilico fresco:2
Pancake con miele|Frittelle di latte e uova con miele.|Pancake:150;Miele:15;Burro:5
Pancake con sciroppo d'acero|Frittelle con sciroppo.|Pancake:150;Sciroppo d'acero:25
Porridge con frutta|Fiocchi d'avena cotti nel latte con frutta.|Avena fiocchi:40;Latte parzialmente scremato:200;Banana:60;Miele:8;Frutti di bosco:50
Porridge al cioccolato|Avena cotta nel latte con cacao.|Avena fiocchi:40;Latte parzialmente scremato:200;Cacao amaro in polvere:8;Miele:8
Overnight oats con yogurt|Avena e yogurt in frigo tutta la notte.|Avena fiocchi:40;Yogurt greco intero:100;Latte parzialmente scremato:80;Frutti di bosco:60;Miele:8
Colazione italiana|Cappuccino e cornetto.|Cappuccino:150;Cornetto vuoto:60
Colazione con yogurt e cereali|Yogurt con cereali e frutta.|Yogurt bianco intero:125;Muesli croccante:40;Banana:80
Colazione salata|Uova strapazzate con pane tostato e avocado.|Uovo di gallina intero:120;Pane tostato:40;Avocado:60
Frullato di banana e latte|Banana frullata con latte.|Banana:120;Latte parzialmente scremato:200
Frullato proteico|Proteine con latte e banana.|Proteine del siero:30;Latte parzialmente scremato:250;Banana:100
Frullato verde|Spinaci, mela e banana frullati.|Spinaci crudi:50;Mela:100;Banana:100;Succo di mela:100
Smoothie alla fragola|Fragole e yogurt frullati.|Fragole:150;Yogurt bianco intero:125;Miele:8
Spremuta con biscotti|Spremuta e biscotti secchi.|Spremuta d'arancia:200;Biscotti secchi:30
Tiramisù|Savoiardi, mascarpone, uova e caffè.|Savoiardi:30;Mascarpone:60;Uovo di gallina intero:30;Zucchero bianco:15;Caffè espresso:30;Cacao amaro in polvere:3
Panna cotta ai frutti di bosco|Panna dolce gelatinata con frutti di bosco.|Panna fresca:100;Zucchero bianco:15;Frutti di bosco:50
Torta di mele|Impasto di farina, uova e mele.|Farina 00:40;Zucchero bianco:30;Uovo di gallina intero:30;Mela:100;Burro:15;Latte intero:20
Crostata con marmellata|Frolla con marmellata.|Pasta frolla:60;Marmellata di albicocche:40
Ciambellone|Dolce soffice con farina, uova e latte.|Farina 00:40;Zucchero bianco:30;Uovo di gallina intero:30;Latte intero:30;Olio di semi di girasole:10
Brownie|Cioccolato e burro in un dolce umido.|Cioccolato fondente:30;Burro:25;Zucchero bianco:30;Uovo di gallina intero:30;Farina 00:20;Noci:10
Biscotti al burro fatti in casa|Frolla al burro.|Farina 00:30;Burro:20;Zucchero bianco:15;Uovo di gallina intero:10
Hummus fatto in casa|Ceci frullati con tahin, limone e olio.|Ceci cotti:100;Tahin:15;Limone:10;Olio extravergine d'oliva:10;Aglio:2
Guacamole|Avocado schiacciato con lime e cipolla.|Avocado:100;Lime:10;Cipolla:10;Pomodori da insalata:20
Pesto fatto in casa|Basilico, pinoli, grana e olio.|Basilico fresco:30;Pinoli:10;Parmigiano reggiano:15;Olio extravergine d'oliva:25;Aglio:2
Besciamella|Burro, farina e latte.|Burro:10;Farina 00:10;Latte intero:100
Ragù alla bolognese|Soffritto con carne e pomodoro, cotto a lungo.|Macinato di manzo:80;Passata di pomodoro:60;Carote crude:20;Sedano:15;Cipolla:20;Olio extravergine d'oliva:8;Vino rosso:30
Sugo al pomodoro|Pomodoro cotto con olio e basilico.|Passata di pomodoro:120;Olio extravergine d'oliva:10;Basilico fresco:2;Cipolla:15
Tonno e fagioli|Fagioli e tonno con cipolla.|Fagioli cannellini cotti:120;Tonno sott'olio sgocciolato:60;Cipolla rossa di Tropea:20;Olio extravergine d'oliva:8
Pasta al tonno|Pasta con tonno e pomodoro.|Pasta di semola cruda:90;Tonno sott'olio sgocciolato:60;Passata di pomodoro:100;Olio extravergine d'oliva:8
Pasta alla Norma|Pasta con melanzane, pomodoro e ricotta salata.|Pasta di semola cruda:90;Melanzane:100;Passata di pomodoro:100;Olio extravergine d'oliva:15;Ricotta di vacca:30
Pasta con broccoli|Pasta con broccoli stufati.|Pasta di semola cruda:90;Broccoli lessati:150;Olio extravergine d'oliva:10;Aglio:3;Parmigiano reggiano:10
Pasta ai quattro formaggi|Pasta con crema di formaggi.|Pasta di semola cruda:90;Gorgonzola dolce:20;Fontina:20;Parmigiano reggiano:15;Mozzarella di vacca:20;Panna da cucina:20
Pasta con salmone e panna|Pasta con salmone affumicato e panna.|Pasta di semola cruda:90;Salmone affumicato:50;Panna da cucina:40;Cipolla:15
Pasta in bianco con parmigiano|Pasta condita con olio e parmigiano.|Pasta di semola cruda:90;Olio extravergine d'oliva:8;Parmigiano reggiano:15
Cous cous con verdure|Cous cous con verdure e ceci.|Couscous crudo:70;Zucchine:60;Peperoni:60;Ceci cotti:60;Olio extravergine d'oliva:10
Quinoa con verdure|Quinoa saltata con verdure.|Quinoa cruda:60;Zucchine:80;Carote crude:50;Olio extravergine d'oliva:10
Farro con verdure|Farro cotto con verdure e olio.|Farro crudo:70;Pomodori ciliegino:80;Cetrioli:60;Olio extravergine d'oliva:10;Feta:30
Bowl con pollo e riso|Riso, pollo e verdure.|Riso bianco crudo:70;Petto di pollo alla piastra:100;Broccoli lessati:80;Olio extravergine d'oliva:8;Salsa di soia:10
Bowl vegetariana|Riso, ceci, avocado e verdure.|Riso integrale crudo:60;Ceci cotti:80;Avocado:50;Carote crude:40;Olio extravergine d'oliva:8
Spiedini di pollo|Pollo a cubetti alla griglia.|Petto di pollo crudo:150;Peperoni:60;Olio extravergine d'oliva:8
Cotoletta di pollo|Petto di pollo impanato.|Petto di pollo crudo:130;Pangrattato:25;Uovo di gallina intero:25;Olio di semi di girasole:15
Straccetti di manzo e rucola|Manzo a striscioline con rucola e grana.|Controfiletto:150;Rucola:40;Parmigiano reggiano:15;Olio extravergine d'oliva:8;Pomodori ciliegino:50
Tagliata di manzo|Manzo scottato con rucola e grana.|Controfiletto:180;Rucola:40;Parmigiano reggiano:15;Olio extravergine d'oliva:8
Fesa di tacchino ai ferri|Tacchino grigliato.|Fettine di tacchino:150;Olio extravergine d'oliva:6;Limone:15
Merluzzo con pomodorini|Merluzzo cotto con pomodorini e olive.|Merluzzo fresco:180;Pomodori ciliegino:100;Olive nere:15;Olio extravergine d'oliva:10
Gamberi alla griglia|Gamberi grigliati con limone.|Gamberoni alla griglia:150;Olio extravergine d'oliva:8;Limone:15
Insalata di polpo e patate|Polpo lessato con patate e prezzemolo.|Polpo:150;Patate lesse:150;Olio extravergine d'oliva:10;Prezzemolo:3
Sushi fatto in casa|Riso per sushi con salmone e alga.|Riso per sushi cotto:150;Salmone fresco:60;Avocado:30;Cetrioli:30
Ramen fatto in casa|Noodles in brodo con uovo e carne.|Pasta di semola cruda:80;Brodo di pollo:350;Uova sode:50;Petto di pollo lesso:60;Salsa di soia:10
Burrito con pollo|Tortilla con pollo, fagioli e riso.|Tortilla di grano:70;Petto di pollo alla piastra:80;Fagioli neri cotti:60;Riso bianco bollito:60;Formaggio spalmabile:20
Chili con carne|Manzo con fagioli e pomodoro speziati.|Macinato di manzo magro:100;Fagioli rossi cotti:100;Polpa di pomodoro:100;Cipolla:30;Olio extravergine d'oliva:8
Fajitas di pollo|Pollo e peperoni in tortilla.|Petto di pollo crudo:120;Peperoni:80;Cipolla:40;Tortilla di grano:70;Olio extravergine d'oliva:8
Tacos di manzo|Tortilla con manzo, insalata e salsa.|Tortilla di mais:60;Macinato di manzo magro:80;Lattuga:20;Pomodori da insalata:40;Formaggio spalmabile:15
Shakshuka|Uova cotte in sugo di pomodoro e peperoni.|Uovo di gallina intero:120;Passata di pomodoro:150;Peperoni:80;Cipolla:30;Olio extravergine d'oliva:8
Falafel con salsa|Polpette di ceci fritte con salsa.|Falafel:120;Tzatziki:50;Pane arabo (pita):60
Curry di ceci|Ceci in salsa speziata.|Ceci cotti:180;Passata di pomodoro:80;Curry in polvere:4;Cipolla:40;Olio extravergine d'oliva:10;Riso basmati cotto:150
Tofu saltato con verdure|Tofu e verdure in padella.|Tofu:120;Peperoni:80;Zucchine:80;Salsa di soia:10;Olio di sesamo:8
Cena leggera|Zuppa di verdure con pane.|Minestrone:300;Pane integrale:50;Olio extravergine d'oliva:5
Pranzo al sacco|Panino con prosciutto e frutta.|Pane bianco:80;Prosciutto cotto:50;Emmental:20;Mela:150
Merenda sana|Yogurt con frutta secca e miele.|Yogurt greco intero:150;Noci:15;Miele:10
Spuntino proteico|Uova sode e frutta.|Uova sode:100;Mela:150
Aperitivo all'italiana|Spritz con patatine e olive.|Aperol spritz:200;Patatine in sacchetto:25;Olive verdi:20
Pizza e birra|Pizza margherita e birra chiara.|Pizza margherita:350;Birra chiara:330
Fondue di formaggio con pane|Formaggi fusi con vino e pane.|Fondue moitié-moitié:150;Pane bianco:100;Vino bianco:50
Rösti con uovo|Patate grattugiate fritte con uovo.|Rösti di patate:200;Uovo fritto:60
Polenta con brasato|Polenta con manzo brasato.|Polenta cotta:250;Brasato di manzo:150
Polenta con formaggio|Polenta con fontina fusa.|Polenta cotta:250;Fontina:50;Burro:10
`;
