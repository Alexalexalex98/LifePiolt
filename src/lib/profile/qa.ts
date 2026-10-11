/**
 * Botta e risposta nei commenti. Modulo PURO (test: tests/profileQa.test.mjs).
 * Una risposta è un commento che segue immediatamente una domanda (testo con «?») scritta da un'ALTRA persona: la domanda è
 * il testo del post (autore del post) oppure il commento precedente. Solo chi ha fatto la domanda può votare la risposta.
 */
export type QaComment = { author: string; text: string };
export type QaPair = { index: number; asker: string; answerer: string };
const isQuestion = (t: string) => t.includes('?');

export function qaPairs(postAuthor: string, postText: string, comments: QaComment[]): QaPair[] {
  const out: QaPair[] = [];
  comments.forEach((c, i) => {
    const prev = i === 0 ? { author: postAuthor, text: postText } : comments[i - 1];
    if (prev.author !== c.author && isQuestion(prev.text)) out.push({ index: i, asker: prev.author, answerer: c.author });
  });
  return out;
}
export const qaRef = (postKey: string, index: number) => `${postKey}#${index}`;
export const QA_HINT = 'Il tuo voto aiuta chi risponde a scrivere meglio';
