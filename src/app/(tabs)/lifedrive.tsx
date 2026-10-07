import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, Pressable, Share, Text, View } from 'react-native';

import { Body, Btn, Card, Empty, Input, Item, Link, Page, Row, Seg, Sheet, TabRow } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { weekdayShortDate } from '@/lib/format';
import { detectFileFolder, driveFolderColors, useLife, type DriveFile } from '@/store/life';
import { toast } from '@/store/toast';

const fileFolders = ['Documenti', 'Ricevute', 'Salute', 'Business', 'Altro'];
const gradients: [string, string][] = [['#3a2a5c', '#171224'], ['#1f3b2c', '#131c17'], ['#3a2a1a', '#221a10'], ['#2a1f45', '#181128'], ['#1a2f3a', '#111c22'], ['#3a1f2c', '#22131a']];
const sizeLabel = (bytes?: number) => (bytes == null ? '—' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export default function LifeDrive() {
  const t = useTheme();
  const { drive, addFile, delFile } = useLife();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('File');
  const [folder, setFolder] = useState('Tutti');
  const [preview, setPreview] = useState<DriveFile | null>(null);
  const [del, setDel] = useState<DriveFile | null>(null);
  const [upload, setUpload] = useState(false);
  const [name, setName] = useState('');

  const photos = drive.filter((f) => f.folder === 'Foto');
  const files = drive.filter((f) => f.folder !== 'Foto');
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
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!r.canceled && r.assets[0]) put(r.assets[0].name, sizeLabel(r.assets[0].size), r.assets[0].uri);
  }
  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast('Serve il permesso di accedere alle foto'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled && r.assets[0]) {
      const a = r.assets[0];
      const n = a.fileName ?? `Foto ${weekdayShortDate().replace('/', '-')}.jpg`;
      addFile({ n, s: sizeLabel(a.fileSize), folder: 'Foto', date: weekdayShortDate(), uri: a.uri });
      setUpload(false);
      toast('Foto aggiunta');
    }
  }

  const Tile = ({ f, i }: { f: DriveFile; i: number }) => {
    const g = gradients[i % gradients.length];
    return (
      <Pressable onPress={() => setPreview(f)} style={{ width: '33.33%', padding: 1.5 }}>
        <View style={{ aspectRatio: 1, borderRadius: 6, overflow: 'hidden' }}>
          {f.uri ? <Image source={{ uri: f.uri }} style={{ flex: 1 }} /> : <LinearGradient colors={g} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />}
        </View>
      </Pressable>
    );
  };

  return (
    <Page id="lifedrive" title="LifeDrive" back>
      <Body small muted style={{ marginBottom: 14 }}>Foto, file e documenti condivisi, raggruppati in cartelle dall'AI in base al contenuto.</Body>
      <Input placeholder="Cerca file…" value={q} onChangeText={setQ} />
      <Btn small ghost style={{ marginBottom: 14 }} title="+ Carica file o foto" onPress={() => setUpload(true)} />
      <Seg options={[`File · ${files.length}`, `Foto · ${photos.length}`]} value={tab === 'File' ? `File · ${files.length}` : `Foto · ${photos.length}`} onChange={(v) => setTab(v.startsWith('File') ? 'File' : 'Foto')} />
      {tab === 'Foto' ? (
        (() => {
          const list = photos.filter((f) => f.n.toLowerCase().includes(lq));
          return list.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{list.map((f, i) => <Tile key={f.id} f={f} i={i} />)}</View> : <Empty text="Ancora nessuna foto qui: caricane una quando vuoi." />;
        })()
      ) : (
        <>
          <TabRow options={['Tutti', ...fileFolders]} value={folder} onChange={setFolder} />
          <Card>
            {(() => {
              const list = files.filter((f) => (folder === 'Tutti' || f.folder === folder) && f.n.toLowerCase().includes(lq));
              if (!list.length) return <Empty text="Nessun file trovato." />;
              return list.map((f, i) => {
                const color = driveFolderColors[f.folder] ?? '#8e98a8';
                return (
                  <Item key={f.id} last={i === list.length - 1}>
                    <Row>
                      <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }} onPress={() => setPreview(f)}>
                        <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: color + '33', borderWidth: 1, borderColor: color + '33', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color, fontWeight: '800', fontSize: 15 }}>{f.folder[0]}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Body numberOfLines={1}>{f.n}</Body>
                          <Body small muted>{f.s} · {f.date}</Body>
                        </View>
                      </Pressable>
                      <View style={{ backgroundColor: color + '22', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color, fontSize: 10, fontWeight: '700' }}>{f.folder}</Text></View>
                      <Link danger onPress={() => setDel(f)}>×</Link>
                    </Row>
                  </Item>
                );
              });
            })()}
          </Card>
        </>
      )}

      <Sheet visible={!!preview} title={preview?.n ?? ''} onClose={() => setPreview(null)}>
        {preview && (
          <>
            {preview.folder === 'Foto' ? (
              preview.uri ? <Image source={{ uri: preview.uri }} style={{ width: '100%', aspectRatio: 1, borderRadius: 16, marginBottom: 14 }} /> : <LinearGradient colors={gradients[drive.indexOf(preview) % gradients.length]} style={{ width: '100%', aspectRatio: 1, borderRadius: 16, marginBottom: 14 }} />
            ) : (
              <View style={{ paddingVertical: 36, alignItems: 'center', backgroundColor: t.input, borderRadius: 16, marginBottom: 14 }}><Text style={{ fontSize: 38 }}>📄</Text></View>
            )}
            <Body small muted>{preview.folder} · {preview.s} · {preview.date}</Body>
            <Btn small ghost style={{ marginTop: 14 }} title="Condividi" onPress={() => Share.share({ message: `File: ${preview.n}`, url: preview.uri })} />
            <Btn small ghost style={{ marginTop: 8 }} title="Elimina" onPress={() => { setDel(preview); setPreview(null); }} />
          </>
        )}
      </Sheet>
      <Sheet visible={!!del} title="Eliminare file?" onClose={() => setDel(null)}>
        <Body small muted>Eliminare "{del?.n}"? L'azione non è reversibile.</Body>
        <Row style={{ marginTop: 14 }}>
          <Btn ghost style={{ flex: 1 }} title="Annulla" onPress={() => setDel(null)} />
          <Btn danger style={{ flex: 1 }} title="Elimina" onPress={() => { if (del) delFile(del.id); setDel(null); toast('File rimosso'); }} />
        </Row>
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
