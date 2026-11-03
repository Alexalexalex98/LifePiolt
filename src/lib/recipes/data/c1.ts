/**
 * Ricette scritte a mano. Formato (una per riga):
 * Nome|categoria|difficoltà 1-3|minuti preparazione|minuti cottura|porzioni|regione|tag;tag|ingrediente:grammi;…|passo ## passo|attrezzi;…|consiglio
 * Nei passi: {10} o {10:Etichetta} = timer in minuti; {forno:200} o {forno:180:ventilato} = forno.
 */
export const C1 = `
Spaghetti al pomodoro|primi|1|10|15|2|Campania|classico;veloce|Pasta di semola cruda:160;Passata di pomodoro:300;Olio extravergine d'oliva:20;Aglio:6=2 spicchi;Basilico fresco:5;Sale:3|Porta a bollore abbondante acqua in una pentola capiente e salala quando bolle {10:Acqua} ## Intanto scalda l'olio con gli spicchi d'aglio interi, a fuoco dolce, senza farli scurire ## Versa la passata, aggiungi un pizzico di sale e cuoci piano con il coperchio socchiuso {12:Sugo} ## Cuoci gli spaghetti 1 minuto meno di quanto indicato sulla confezione {9:Pasta} ## Scola la pasta tenendo un mestolo d'acqua di cottura, togli l'aglio dal sugo e salta la pasta nel sugo per 1 minuto, aggiungendo l'acqua se serve ## Impiatta con foglie di basilico spezzate a mano e un filo d'olio crudo.|pentola alta;padella ampia;colino|Il basilico va aggiunto a fuoco spento: perde profumo se cuoce.
`;
