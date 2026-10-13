/**
 * Presentare un file in una diretta o in una chiamata (modulo PURO, nessun alias '@/'): che tipo di file è, cosa si può mostrare
 * e la pagina che visualizza un PDF. I PDF si leggono con pdf.js dentro la pagina; le presentazioni (PowerPoint, Keynote) vanno esportate in PDF.
 */
export type PresKind = 'pdf' | 'image' | 'slides' | 'other';

const IMG = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'bmp'];
const SLIDES = ['ppt', 'pptx', 'pps', 'ppsx', 'key', 'odp'];

export const extOf = (name: string): string => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '');

export function kindOfFile(name: string, mime?: string | null): PresKind {
  const ext = extOf(name), m = (mime ?? '').toLowerCase();
  if (ext === 'pdf' || m === 'application/pdf') return 'pdf';
  if (IMG.includes(ext) || m.startsWith('image/')) return 'image';
  if (SLIDES.includes(ext) || m.includes('presentation') || m.includes('powerpoint')) return 'slides';
  return 'other';
}

/** Cosa dire quando il file non si può mostrare così com'è. */
export function presentHelp(kind: PresKind): string | null {
  if (kind === 'slides') return 'Le presentazioni PowerPoint e Keynote non si aprono direttamente: esportale in PDF (da PowerPoint: File › Esporta › PDF; da Keynote: File › Esporta in › PDF) e scegli quel file.';
  if (kind === 'other') return 'Posso mostrare PDF e immagini. Per altri tipi di file esportali in PDF.';
  return null;
}

export type Presentation = { kind: 'pdf' | 'image'; uri: string; name: string; by: string; startedAt: number };

/** Clamp della pagina corrente (1..total). */
export const clampPage = (page: number, total: number): number => Math.max(1, Math.min(Math.max(1, total), Math.round(page) || 1));

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

/** Pagina HTML che mostra tutte le pagine di un PDF (dato in base64) a tutta larghezza, con contatore «n / N». */
export function pdfHtml(base64: string, o: { dark?: boolean } = {}): string {
  const bg = o.dark === false ? '#e9edf3' : '#0b0e14';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes">
<style>html,body{margin:0;background:${bg};color:#fff;font-family:-apple-system,Roboto,sans-serif}canvas{display:block;margin:8px auto;max-width:100%;box-shadow:0 2px 10px rgba(0,0,0,.45);background:#fff}
#st{position:fixed;left:0;right:0;top:40%;text-align:center;opacity:.8;font-size:15px}#cnt{position:fixed;right:10px;bottom:10px;background:rgba(0,0,0,.6);padding:5px 11px;border-radius:999px;font-size:13px;font-weight:700;display:none}</style>
<script src="${PDFJS}/pdf.min.js"></script></head><body><div id="st">Apro il documento…</div><div id="cnt"></div><div id="pages"></div>
<script>
(function(){
  var st=document.getElementById('st'),cnt=document.getElementById('cnt'),box=document.getElementById('pages');
  function fail(m){st.textContent=m;}
  if(!window.pdfjsLib){fail('Per aprire il PDF serve una connessione internet.');return;}
  pdfjsLib.GlobalWorkerOptions.workerSrc='${PDFJS}/pdf.worker.min.js';
  var bin=atob('${base64}'),arr=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
  pdfjsLib.getDocument({data:arr}).promise.then(function(doc){
    st.style.display='none';cnt.style.display='block';var total=doc.numPages,canvases=[];
    function upd(){var y=window.scrollY+window.innerHeight/2,cur=1;for(var k=0;k<canvases.length;k++){if(canvases[k].offsetTop<=y)cur=k+1;}cnt.textContent=cur+' / '+total;}
    window.addEventListener('scroll',upd);
    var chain=Promise.resolve();
    for(var n=1;n<=total;n++){(function(n){chain=chain.then(function(){return doc.getPage(n).then(function(p){
      var w=Math.min(window.innerWidth-16,1100),v0=p.getViewport({scale:1}),sc=(w/v0.width)*(window.devicePixelRatio||1),v=p.getViewport({scale:sc});
      var c=document.createElement('canvas');c.width=v.width;c.height=v.height;c.style.width=(v.width/(window.devicePixelRatio||1))+'px';box.appendChild(c);canvases.push(c);upd();
      return p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;});});})(n);}
  }).catch(function(e){fail('Non riesco ad aprire questo PDF.');});
})();
</script></body></html>`;
}
