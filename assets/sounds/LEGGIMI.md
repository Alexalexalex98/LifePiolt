# Suoni dell'app

Metti qui i file audio (mp3, m4a, wav, ogg) e poi lancia `npm run sounds:build`: l'app li trova da sola.

**Il nome del file decide dove compaiono**: `gruppo__nome-del-suono.mp3`

| Gruppo (prima di `__`) | Dove compare |
|---|---|
| `natura__`   | Suoni › Natura (pioggia, onde, bosco, ruscello…) |
| `rumori__`   | (non più usato: niente rumori bianco/rosa/bruno) |
| `musica__`   | Suoni › Musica (musica per dormire, per concentrarsi, ambient) |
| `meditazione__` | Meditazioni con musica o campane di sottofondo |
| `focus__`    | Solo nella scheda Focus |

Esempi: `natura__pioggia-leggera.mp3`, `musica__sonno-piano-lento.mp3`, `focus__lofi-studio-1.mp3`.

Il nome dopo `__` diventa il titolo (i trattini diventano spazi). Per i suoni che durano poco (loop) l'app li ripete; le tracce lunghe partono una volta sola.

**Licenze**: usa solo file con licenza CC0 / pubblico dominio / «free for commercial use, no attribution», e tieni un elenco in `assets/sounds/CREDITI.md` (nome del file, sito, licenza, link).
**Peso**: ogni file si porta dentro l'app. Per l'app va bene qualche decina di file da 1-3 MB (mp3 a 96-128 kbps).
