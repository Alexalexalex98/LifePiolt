import * as DocumentPicker from 'expo-document-picker';
import { openDocument } from '@/lib/openDoc';
import { go } from '@/lib/nav';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Share, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Card, Empty, Input, Item, Link, Page, Pill, Row, Seg, Sheet, TabRow, XBtn } from '@/components/ui';
import { useInk, useTheme } from '@/hooks/use-theme';
import { confirmDelete } from '@/lib/confirm';
import { weekdayShortDate } from '@/lib/format';
import { detectFileFolder, driveFolderColors, isPhoto, photoSource, useLife, type DriveFile } from '@/store/life';
import { toast } from '@/store/toast';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { Icon } from '@/lib/icons';
import { libraryPermission } from '@/lib/mediaPerm';
import { DriveFilter } from '@/components/DriveFilter';
import { ProjectFiles } from '@/components/ProjectFiles';

const fileFolders = ['Documenti', 'Video', 'Ricevute', 'Bollette e fatture', 'Salute', 'Lavoro', 'Progetti', 'Altro'];
const gradients: [string, string][] = [['#3a2a5c', '#171224'], ['#1f3b2c', '#131c17'], ['#3a2a1a', '#221a10'], ['#2a1f45', '#181128'], ['#1a2f3a', '#111c22'], ['#3a1f2c', '#22131a']];
const sizeLabel = (bytes?: number) => (bytes == null ? '—' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

function PhotoTile({ f, g, on, onPress }: { f: DriveFile; g: readonly [string, string, ...string[]] | string[]; on: boolean; onPress: () => void }) {
  const t = useTheme();
  const [bad, setBad] = useState(false);
  return (
    <Pressable onPress={onPress} style={{ width: '33.33%', padding: 1.5 }}>
      <View style={{ aspectRatio: 1, borderRadius: 6, overflow: 'hidden', borderWidth: on ? 3 : 0, borderColor: t.accent }}>
        {f.uri && !bad ? <Image source={{ uri: f.uri }} style={{ flex: 1 }} onError={() => setBad(true)} /> : bad ? <View style={{ flex: 1, backgroundColor: t.item, alignItems: 'center', justifyContent: 'center', gap: 4 }}><Icon name="image" size={22} color={t.muted} /><Text style={{ color: t.muted, fontSize: 10, fontWeight: '700' }}>Non disponibile</Text></View> : <LinearGradient colors={g as [string, string]} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />}
      </View>
    </Pressable>
  );
}

export default function LifeDrive() {
  const t = useTheme();
  const ink = useInk();
  const { drive, addFile, delFile, restoreFile } = useLife();
  const askDel = (f: DriveFile) => confirmDelete(`il file «${f.n}»`, () => delFile(f.id), () => restoreFile(f), { undoMessage: 'File rimosso' });
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('File');
  const [folder, setFolder] = useState('Tutti');
  const [preview, setPreview] = useState<DriveFile | null>(null);
  const [hl, setHl] = useState<string | null>(null);
  /* da «Apri documento» / «Mostra» / ricerca: si arriva sul file giusto, evidenziato e aperto */
  const params = useLocalSearchParams<{ file?: string; folder?: string }>();
  useEffect(() => {
    const f = params.file ? drive.find((x) => x.id === params.file) : undefined;
    if (f) { setTab(isPhoto(f) ? 'Foto' : 'File'); setFolder('Tutti'); setQ(''); setHl(f.id); setPreview(f); const h = setTimeout(() => setHl(null), 4000); return () => clearTimeout(h); }
    if (params.folder && fileFolders.includes(params.folder)) { setTab('File'); setFolder(params.folder); }
  }, [params.file, params.folder]); // eslint-disable-line react-hooks/exhaustive-deps
  const [upload, setUpload] = useState(false);
  const [name, setName] = useState('');
  const [shareTo, setShareTo] = useState<DriveFile | null>(null);
  const [who, setWho] = useState('');
  const me = useApp((s) => s.account.name);
  const chats = useChat((s) => s.chats), last = useChat((s) => s.messages);
  const targets = Object.values(chats).filter((c) => c.type !== 'club' && (c.name ?? '').toLowerCase().includes(who.trim().toLowerCase()))
    .sort((a, b) => ((last[b.id]?.slice(-1)[0]?.ts) ?? 0) - ((last[a.id]?.slice(-1)[0]?.ts) ?? 0));
  function sendTo(chatId: string, label: string) {
    const f = shareTo; if (!f) return;
    useChat.getState().send(chatId, me, { kind: 'file', media: { uri: f.uri ?? '', name: f.n, mime: isPhoto(f) ? 'image/jpeg' : undefined } });
    setShareTo(null); setWho(''); toast(`«${f.n}» inviato a ${label}`);
  }
  function sendToNew() {
    const n = who.trim(); if (!n) return;
    sendTo(useChat.getState().ensureDm(n, me), n);
  }

  const photos = drive.filter(isPhoto);
  const files = drive.filter((f) => !isPhoto(f));
  const [cat, setCat] = useState('Tutte');
  const photoCats: Record<string, number> = {};
  photos.forEach((f) => { const c = photoSource(f); photoCats[c] = (photoCats[c] || 0) + 1; });
  const photoCatList = Object.keys(photoCats).sort((a, b) => photoCats[b]! - photoCats[a]!);
  const activeCat = cat === 'Tutte' || photoCats[cat] ? cat : 'Tutte';
  const counts: Record<string, number> = {};
  files.forEach((f) => { counts[f.folder] = (counts[f.folder] || 0) + 1; });
  const lq = q.toLowerCase();

  function put(n: string, size: string, uri?: string) {
    const f = detectFileFolder(n);
    addFile({ n, s: size, folder: f, date: weekdayShortDate(), uri });
    setUpload(false);
    toast(`Aggiunto e raccolto in "${f}" dall'AI`);
  }
  async function pickFile() {
    try {
      const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (!r.canceled && r.assets[0]) put(r.assets[0].name, sizeLabel(r.assets[0].size), r.assets[0].uri);
    } catch { toast('Impossibile aprire i file'); }
  }
  async function pickPhoto() {
    try {
      const perm = await libraryPermission();
      if (!perm.granted) { toast('Serve il permesso di accedere alle foto'); return; }
      const r = await ImagePicker.launchImageLibraryAsync({ preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible, mediaTypes: ['images'], quality: 0.8 });
      if (!r.canceled && r.assets[0]) {
        const a = r.assets[0];
        const n = a.fileName ?? `Foto ${weekdayShortDate().replace('/', '-')}.jpg`;
        addFile({ n, s: sizeLabel(a.fileSize), folder: 'Foto', date: weekdayShortDate(), uri: a.uri });
        setUpload(false);
        toast('Foto aggiunta');
      }
    } catch { toast('Impossibile aprire le foto'); }
  }

  const Tile = ({ f, i }: { f: DriveFile; i: number }) => <PhotoTile f={f} g={gradients[i % gradients.length]} on={hl === f.id} onPress={() => setPreview(f)} />;

  return (
    <Page id="lifedrive" title="LifeDrive" back>
      <Body small muted style={{ marginBottom: 14 }}>Foto, file e documenti condivisi, raggruppati in cartelle dall'AI in base al contenuto.</Body>
      <Input placeholder="Cerca file…" value={q} onChangeText={setQ} />
      <Btn small ghost style={{ marginBottom: 14 }} title="+ Carica file o foto" onPress={() => setUpload(true)} />
      <Seg options={[`File · ${files.length}`, `Foto · ${photos.length}`]} value={tab === 'File' ? `File · ${files.length}` : `Foto · ${photos.length}`} onChange={(v) => setTab(v.startsWith('File') ? 'File' : 'Foto')} />
      {tab === 'Foto' ? (
        (() => {
          const list = photos.filter((f) => (activeCat === 'Tutte' || photoSource(f) === activeCat) && f.n.toLowerCase().includes(lq));
          return (
            <>
              {photoCatList.length > 0 ? (
                <DriveFilter value={activeCat} onChange={setCat} items={[{ id: 'Tutte', count: photos.length }, ...photoCatList.map((c) => ({ id: c, count: photoCats[c]! }))]} />
              ) : null}
              {list.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{list.map((f, i) => <Tile key={f.id} f={f} i={i} />)}</View> : <Empty text="Ancora nessuna foto qui: caricane una quando vuoi." />}
            </>
          );
        })()
      ) : (
        <>
          <DriveFilter value={folder} onChange={setFolder} items={[{ id: 'Tutti', count: files.length }, ...Object.keys(counts).sort((a, b) => counts[b]! - counts[a]!).map((c) => ({ id: c, count: counts[c]! }))]} />
          {folder === 'Progetti' ? <Card><ProjectFiles files={files.filter((f) => f.folder === 'Progetti' && f.n.toLowerCase().includes(lq))} onOpen={setPreview} onDelete={askDel} /></Card> : <Card>
            {(() => {
              const list = files.filter((f) => (folder === 'Tutti' || f.folder === folder) && f.n.toLowerCase().includes(lq));
              if (!list.length) return <Empty text="Nessun file trovato." />;
              return list.map((f, i) => {
                const color = driveFolderColors[f.folder] ?? '#8e98a8';
                return (
                  <Item key={f.id} last={i === list.length - 1}>
                    <Row style={hl === f.id ? { backgroundColor: t.accent + '22', borderRadius: 12, borderWidth: 1, borderColor: t.accent, padding: 4 } : undefined}>
                      <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }} onPress={() => setPreview(f)}>
                        <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: color + '33', borderWidth: 1, borderColor: color + '33', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: ink(color), fontWeight: '800', fontSize: 15 }}>{f.folder[0]}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Body numberOfLines={1}>{f.n}</Body>
                          <Body small muted>{f.s} · {f.date}</Body>
                        </View>
                      </Pressable>
                      <View style={{ backgroundColor: color + '22', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: ink(color), fontSize: 10, fontWeight: '700' }}>{f.folder}</Text></View>
                      <XBtn onPress={() => askDel(f)} />
                    </Row>
                  </Item>
                );
              });
            })()}
          </Card>}
        </>
      )}

      <Sheet visible={!!preview} title={preview?.n ?? ''} onClose={() => setPreview(null)}>
        {preview && (
          <>
            {isPhoto(preview) ? (
              preview.uri ? <Image source={{ uri: preview.uri }} resizeMode="contain" style={{ width: '100%', aspectRatio: 1, borderRadius: 16, marginBottom: 14, backgroundColor: t.input }} /> : <LinearGradient colors={gradients[drive.indexOf(preview) % gradients.length]} style={{ width: '100%', aspectRatio: 1, borderRadius: 16, marginBottom: 14 }} />
            ) : (
              <View style={{ paddingVertical: 36, alignItems: 'center', backgroundColor: t.input, borderRadius: 16, marginBottom: 14 }}><Icon name="file" size={40} color={t.muted} /></View>
            )}
            <Body small muted>{preview.folder} · {preview.s} · {preview.date}</Body>
            <Btn small style={{ marginTop: 14 }} icon="eye" title="Apri e leggi" onPress={() => { const p = preview; setPreview(null); void openDocument({ uri: p.uri, name: p.n, mime: isPhoto(p) ? 'image/jpeg' : undefined }); }} />
            <Btn small style={{ marginTop: 8 }} icon="send" title="Condividi con una persona" onPress={() => { const p = preview; setPreview(null); setShareTo(p); }} />
            <Btn small ghost style={{ marginTop: 8 }} title="Condividi con altre app" onPress={() => Share.share({ message: `File: ${preview.n}`, url: preview.uri })} />
            <Btn small ghost style={{ marginTop: 8 }} title="Elimina" onPress={() => { const p = preview; setPreview(null); askDel(p); }} />
          </>
        )}
      </Sheet>
      <Sheet visible={!!shareTo} title={`Condividi «${shareTo?.n ?? ''}»`} onClose={() => { setShareTo(null); setWho(''); }}>
        <Body small muted style={{ marginBottom: 8 }}>Scegli la chat a cui mandare il file, oppure scrivi il nome di una persona.</Body>
        <Input placeholder="Cerca o scrivi un nome…" value={who} onChangeText={setWho} />
        <Card>
          {targets.length === 0 ? <Body small muted>Nessuna chat trovata.</Body> : targets.slice(0, 12).map((c, i) => (
            <Item key={c.id} last={i === Math.min(targets.length, 12) - 1} onPress={() => sendTo(c.id, c.name ?? 'chat')}>
              <Row><Body style={{ flex: 1 }}>{c.name}</Body><Body small muted>{c.type === 'group' ? 'Gruppo' : 'Chat'}</Body></Row>
            </Item>
          ))}
        </Card>
        {who.trim() && !targets.some((c) => (c.name ?? '').toLowerCase() === who.trim().toLowerCase()) ? <Btn style={{ marginTop: 10 }} title={`Invia a ${who.trim()}`} onPress={sendToNew} /> : null}
      </Sheet>
      <Sheet visible={upload} title="Aggiungi file o foto" onClose={() => setUpload(false)}>
        <View style={{ gap: 8 }}>
          <Btn title="Scegli un file" onPress={pickFile} />
          <Btn ghost title="Scegli una foto" onPress={pickPhoto} />
        </View>
        <Body small muted style={{ marginTop: 14, marginBottom: 6 }}>Oppure aggiungi solo il nome: l'AI lo mette nella cartella giusta.</Body>
        <Input placeholder="Nome file o foto…" value={name} onChangeText={setName} />
        <Btn small ghost title="Aggiungi per nome" onPress={() => { const n = name.trim(); if (!n) return; put(n, `${(Math.random() * 3 + 0.1).toFixed(1)} MB`); setName(''); }} />
      </Sheet>
    </Page>
  );
}
