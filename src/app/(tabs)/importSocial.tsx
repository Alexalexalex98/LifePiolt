import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { unzipSync } from 'fflate';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Body, Btn, Card, Item, Page, Row, SectionLabel, Toggle } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { isImagePath, parseInstagram, resolveEntry, wantedJson, type IgParsed } from '@/lib/instagramImport';
import { toast } from '@/store/toast';
import { newId, useNet } from '@/store/network';
import { useApp } from '@/store/app';

const MAX_BYTES = 600 * 1024 * 1024;

async function readBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web') return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  return await new File(uri).bytes();
}

/** Salva un file estratto nella memoria dell'app (sul web lo tiene come dato incorporato, così resta dopo il riavvio). */
function store(name: string, data: Uint8Array): string {
  const ext = name.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? '';
  if (Platform.OS === 'web') {
    const type = /\.png$/i.test(ext) ? 'image/png' : /\.mp4$/i.test(ext) ? 'video/mp4' : 'image/jpeg';
    let bin = ''; for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  }
  const dir = new Directory(Paths.document, 'imported');
  if (!dir.exists) dir.create();
  const f = new File(dir, `${newId()}${ext}`);
  f.create(); f.write(data);
  return f.uri;
}

/** Importa i tuoi dati di Instagram dal file ZIP ufficiale (JSON): tutto resta sul telefono. */
export default function ImportSocial() {
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const [busy, setBusy] = useState('');
  const [zip, setZip] = useState<Uint8Array | null>(null);
  const [data, setData] = useState<IgParsed | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [useBio, setUseBio] = useState(true);
  const [inFeed, setInFeed] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const choose = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'application/x-zip-compressed', '*/*'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      if (a.size && a.size > MAX_BYTES) { toast('Il file è troppo grande: nella richiesta di esportazione scegli un periodo più corto o qualità dei contenuti più bassa'); return; }
      setBusy('Leggo il file…');
      await new Promise((res) => setTimeout(res, 30));
      const bytes = await readBytes(a.uri);
      const files = unzipSync(bytes, { filter: (f) => wantedJson(f.name) });
      const texts: Record<string, string> = {};
      for (const [k, v] of Object.entries(files)) texts[k] = new TextDecoder().decode(v);
      const parsed = parseInstagram(texts);
      if (!parsed.posts.length && !parsed.profile.bio && !parsed.profile.name) { toast('Non ho trovato dati da importare: scarica l\'esportazione in formato JSON'); setBusy(''); return; }
      setZip(bytes); setData(parsed); setPick(new Set(parsed.posts.map((p) => p.id))); setDone(null);
    } catch { toast('Non riesco a leggere questo file: deve essere lo ZIP dell\'esportazione dei tuoi dati'); }
    setBusy('');
  };

  const run = async () => {
    if (!zip || !data) return;
    const chosen = data.posts.filter((p) => pick.has(p.id));
    setBusy('Importo…');
    await new Promise((res) => setTimeout(res, 30));
    try {
      const names: string[] = [];
      unzipSync(zip, { filter: (f) => { names.push(f.name); return false; } });
      const out = [] as ReturnType<typeof useNet.getState>['posts'];
      for (let i = 0; i < chosen.length; i += 10) {
        const batch = chosen.slice(i, i + 10);
        const want = new Map<string, string>();
        batch.forEach((p) => p.media.forEach((u) => { const n = resolveEntry(names, u); if (n) want.set(n, u); }));
        const files = unzipSync(zip, { filter: (f) => want.has(f.name) });
        for (const p of batch) {
          const uris = p.media.map((u) => { const n = resolveEntry(names, u); return n && files[n] ? { uri: store(n, files[n]), img: isImagePath(u) } : null; }).filter((x): x is { uri: string; img: boolean } => !!x);
          if (!uris.length) continue;
          const imgs = uris.filter((x) => x.img).map((x) => x.uri);
          out.push({ id: newId(), author: me, text: p.caption, media: imgs.length ? 'photo' : 'video', uri: (imgs[0] ?? uris[0].uri), uris: imgs.length > 1 ? imgs : undefined, tag: 'Importato', likes: 0, ts: p.ts || Date.now(), imported: true, hideFromFeed: !inFeed });
        }
      }
      const patch: Partial<ReturnType<typeof useNet.getState>> = { posts: [...out, ...net.posts] };
      if (useBio && data.profile.bio) patch.bio = data.profile.bio;
      net.patch(patch);
      setDone(out.length); setZip(null);
      toast(out.length ? tl('{0} post importati', out.length) : 'Nessuna foto trovata nel file');
    } catch { toast('Importazione non riuscita: riprova con un file più piccolo'); }
    setBusy('');
  };

  const toggle = (id: string) => setPick((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Page id="importSocial" back title="Importa da un altro social">
      <Body small muted style={{ marginBottom: 10 }}>Porta qui le tue foto, i tuoi testi e la tua bio. Il file viene letto solo sul tuo telefono: non lo mandiamo da nessuna parte.</Body>
      {!data ? (
        <>
          <SectionLabel>Come ottenere il file</SectionLabel>
          <Card>
            <Body small>1. Nell’altro social apri il profilo › impostazioni › Centro gestione account (o «Privacy»).</Body>
            <Body small>2. Le tue informazioni e autorizzazioni › Scarica le tue informazioni.</Body>
            <Body small>3. Scegli «Alcune delle tue informazioni» › Post, poi formato JSON e «Tutto il periodo».</Body>
            <Body small>4. Quando l’altro social ti avvisa (anche ore dopo) scarica lo ZIP e tocca qui sotto.</Body>
          </Card>
          <Btn style={{ marginTop: 12 }} title={busy || 'Scegli il file ZIP'} disabled={!!busy} onPress={() => void choose()} />
        </>
      ) : done != null ? (
        <Card>
          <Body bold>Fatto: {done} post importati</Body>
          <Body small muted style={{ marginTop: 4 }}>{inFeed ? 'Li trovi nel tuo profilo e nel feed.' : 'Li trovi nel tuo profilo, nei Post. Non compaiono nel feed degli altri.'}</Body>
          <Btn small style={{ marginTop: 10 }} title="Importa un altro file" onPress={() => { setData(null); setDone(null); }} />
        </Card>
      ) : (
        <>
          {data.profile.name || data.profile.bio ? (
            <Card>
              <Body bold>{data.profile.name ?? data.profile.username}</Body>
              {data.profile.bio ? <Body small muted style={{ marginTop: 2 }}>{data.profile.bio}</Body> : null}
              {data.profile.bio ? <Toggle label="Usa questa bio nel mio profilo" value={useBio} onChange={setUseBio} /> : null}
            </Card>
          ) : null}
          <SectionLabel>{tl('Post trovati: {0}', data.posts.length)}</SectionLabel>
          <Row gap={8} style={{ marginBottom: 6 }}>
            <Btn small ghost title="Seleziona tutti" onPress={() => setPick(new Set(data.posts.map((p) => p.id)))} />
            <Btn small ghost title="Nessuno" onPress={() => setPick(new Set())} />
          </Row>
          <Card>
            {data.posts.slice(0, 200).map((p, i, arr) => (
              <Item key={p.id} last={i === arr.length - 1} onPress={() => toggle(p.id)}>
                <Row gap={10}>
                  <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#4f6bff', backgroundColor: pick.has(p.id) ? '#4f6bff' : 'transparent' }} />
                  <View style={{ flex: 1 }}>
                    <Body numberOfLines={2}>{p.caption || tl('Senza testo')}</Body>
                    <Body small muted>{p.ts ? new Date(p.ts).toLocaleDateString() : ''} · {tl('{0} file', p.media.length)}</Body>
                  </View>
                </Row>
              </Item>
            ))}
          </Card>
          <Toggle label="Mostra anche nel feed" hint="Se è spento restano solo nel tuo profilo, come un archivio." value={inFeed} onChange={setInFeed} />
          <Btn style={{ marginTop: 10 }} title={busy || tl('Importa {0} post', pick.size)} disabled={!!busy || (pick.size === 0 && !(useBio && data.profile.bio))} onPress={() => void run()} />
        </>
      )}
    </Page>
  );
}
