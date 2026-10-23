import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Page, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { confirmDelete } from '@/lib/confirm';
import { weekdayShortDate } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { childrenOf, isDone, isLeaf, pathOf, progressOf, toOutline, type PNode } from '@/lib/projectTree';
import { readUriBytes } from '@/lib/readUri';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { uid } from '@/lib/format';
import { useLife } from '@/store/life';
import { useProjects } from '@/store/projects';
import { toast } from '@/store/toast';

const sizeLabel = (b?: number) => (b == null ? '—' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

function Pct({ pct, color }: { pct: number; color: string }) {
  const t = useTheme();
  return <View style={{ height: 7, borderRadius: 4, backgroundColor: t.chip, overflow: 'hidden', marginTop: 6 }}><View style={{ width: `${Math.max(2, pct)}%`, height: 7, backgroundColor: color }} /></View>;
}

/** Progetti: task con sotto-task a più livelli. Il padre si completa quando lo sono tutti i figli; la percentuale si vede in cima. */
export default function Projects() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const nodes = useProjects((s) => s.nodes);
  const P = useProjects.getState;
  const [openRoot, setOpenRoot] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [imp, setImp] = useState(false);
  const [text, setText] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [menu, setMenu] = useState<PNode | null>(null);
  const [rename, setRename] = useState('');
  const [child, setChild] = useState('');
  const [share, setShare] = useState(false);
  const [who, setWho] = useState('');
  const chats = useChat((s) => s.chats);

  const roots = useMemo(() => nodes.filter((n) => n.parent === null), [nodes]);
  const root = openRoot ? nodes.find((n) => n.id === openRoot) : null;
  const done = (id: string) => isDone(nodes, id);

  const doImport = (raw: string) => {
    const r = P().importText(raw);
    if (!r.count) { toast('Non ho trovato voci: scrivi un elenco con un elemento per riga'); return; }
    setImp(false); setText('');
    toast(`${tl('Importati {0} elementi in {1} progetti', r.count, r.roots)}${r.truncated ? ` · ${tl('troppi: ho tenuto i primi')}` : ''}`);
  };
  async function importFile() {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['text/*', 'application/octet-stream'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets[0]) return;
      const bytes = await readUriBytes(r.assets[0].uri);
      doImport(new TextDecoder().decode(bytes));
    } catch { toast('Non riesco a leggere il file: usa «Incolla testo»'); }
  }
  async function attachFile(n: PNode) {
    try {
      const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0]; const id = uid();
      useLife.getState().addFile({ id, n: a.name, s: sizeLabel(a.size), folder: 'Progetti', date: weekdayShortDate(), uri: a.uri, path: pathOf(P().nodes, n.id) });
      P().attach(n.id, id);
      toast('File caricato: lo trovi anche in LifeDrive, cartella Progetti');
    } catch { toast('Impossibile aprire i file'); }
  }
  const outlineOf = (id: string) => toOutline(P().nodes, id);
  const sendTo = (chatId: string, label: string) => {
    if (!root) return;
    useChat.getState().send(chatId, me, { kind: 'text', text: `${tl('Progetto')} «${root.title}»\n\n${outlineOf(root.id)}\n\n${tl('Per averlo anche tu: copia questo testo e in Progetti scegli «Incolla testo».')}` });
    P().setShared(root.id, [...root.shared, label]);
    setShare(false); setWho(''); toast(`${tl('Inviato a')} ${label}`);
  };
  const targets = Object.values(chats).filter((c) => c.type !== 'club' && (c.name ?? '').toLowerCase().includes(who.trim().toLowerCase()));

  const Row_ = ({ n, depth }: { n: PNode; depth: number }) => {
    const kids = childrenOf(nodes, n.id); const leaf = !kids.length; const pr = progressOf(nodes, n.id); const d = done(n.id);
    const open = !collapsed[n.id];
    return (
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingLeft: depth * 16, borderBottomWidth: 1, borderBottomColor: t.border }}>
          {leaf ? (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: n.done }} accessibilityLabel={n.title} onPress={() => P().toggle(n.id)} hitSlop={8} style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: n.done ? t.positive : t.border, backgroundColor: n.done ? t.positive : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{n.done ? <Icon name="check" size={14} color="#07110c" stroke={3} /> : null}</Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel={open ? tl('Chiudi') : tl('Apri')} onPress={() => setCollapsed((c) => ({ ...c, [n.id]: open }))} hitSlop={8} style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: open ? '90deg' : '0deg' }] }}><Icon name="chevron" size={18} color={t.muted} /></Pressable>
          )}
          <Pressable style={{ flex: 1 }} onPress={() => { setMenu(n); setRename(n.title); setChild(''); }}>
            <Text style={{ color: d ? t.muted : t.text, textDecorationLine: d ? 'line-through' : 'none', fontWeight: leaf ? '500' : '700' }}>{n.title}</Text>
            {!leaf ? <Text style={{ color: t.muted, fontSize: 11 }}>{`${pr.done}/${pr.total} · ${pr.pct}%${d ? ` · ${tl('completato')}` : ''}`}</Text> : null}
          </Pressable>
          {n.files.length ? <Row gap={2}><Icon name="paperclip" size={14} color={t.muted} /><Text style={{ color: t.muted, fontSize: 11 }}>{n.files.length}</Text></Row> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Altro')} onPress={() => { setMenu(n); setRename(n.title); setChild(''); }} hitSlop={8}><Icon name="more" size={18} color={t.muted} /></Pressable>
        </View>
        {open ? kids.map((k) => <Row_ key={k.id} n={k} depth={depth + 1} />) : null}
      </View>
    );
  };

  const menuFiles = menu ? useLife.getState().drive.filter((f) => menu.files.includes(f.id)) : [];

  return (
    <Page id="projects" back title="Progetti">
      {root ? (
        <>
          <Btn small ghost style={{ alignSelf: 'flex-start' }} icon="chevron" title="Tutti i progetti" onPress={() => setOpenRoot(null)} />
          <Card accent={t.accent}>
            <Row><H style={{ flex: 1 }}>{root.title}</H><Text style={{ color: t.accent, fontWeight: '800', fontSize: 24 }}>{`${progressOf(nodes, root.id).pct}%`}</Text></Row>
            <Pct pct={progressOf(nodes, root.id).pct} color={done(root.id) ? t.positive : t.accent} />
            <Body small muted style={{ marginTop: 6 }}>{tl('{0} su {1} attività fatte.', progressOf(nodes, root.id).done, progressOf(nodes, root.id).total)}{root.shared.length ? ` · ${tl('Condiviso con')} ${root.shared.join(', ')}` : ''}</Body>
            <Row style={{ justifyContent: 'flex-start', marginTop: 8, flexWrap: 'wrap' }} gap={8}>
              <Btn small icon="share" title="Condividi" onPress={() => setShare(true)} />
              <Btn small ghost title="Copia come testo" onPress={() => { void Clipboard.setStringAsync(outlineOf(root.id)); toast('Copiato: lo puoi incollare in un file o importare altrove'); }} />
              <Btn small ghost icon="lifedrive" title="Apri i file" onPress={() => go('lifedrive')} />
            </Row>
          </Card>
          <Card><Row_ n={root} depth={0} /></Card>
          <Body small muted>Il padre si spunta da solo quando sono fatti tutti i figli. Tocca una voce per rinominarla, aggiungere sotto-attività, caricare file o eliminarla.</Body>
        </>
      ) : (
        <>
          <Card>
            <H>I tuoi progetti</H>
            <Body small muted style={{ marginTop: 2 }}>Un progetto è una task con tante sotto-task, a quanti livelli vuoi. Importa un elenco da file o scrivilo qui: ogni riga rientrata diventa un figlio.</Body>
            <Row style={{ justifyContent: 'flex-start', marginTop: 8, flexWrap: 'wrap' }} gap={8}>
              <Btn small icon="file" title="Importa da file" onPress={() => void importFile()} />
              <Btn small ghost title="Incolla testo" onPress={() => setImp(true)} />
            </Row>
            <Row style={{ marginTop: 10 }} gap={8}><View style={{ flex: 1 }}><Input placeholder="Nuovo progetto" value={newTitle} onChangeText={setNewTitle} onSubmitEditing={() => { const id = P().addChild(null, newTitle); if (id) { setNewTitle(''); setOpenRoot(id); } }} /></View><Btn small icon="plus" title="" disabled={!newTitle.trim()} onPress={() => { const id = P().addChild(null, newTitle); if (id) { setNewTitle(''); setOpenRoot(id); } }} /></Row>
          </Card>
          {roots.length ? roots.map((r) => {
            const pr = progressOf(nodes, r.id);
            return (
              <Card key={r.id} onPress={() => setOpenRoot(r.id)}>
                <Row><H style={{ flex: 1 }}>{r.title}</H><Text style={{ color: done(r.id) ? t.positive : t.accent, fontWeight: '800', fontSize: 20 }}>{`${pr.pct}%`}</Text></Row>
                <Pct pct={pr.pct} color={done(r.id) ? t.positive : t.accent} />
                <Body small muted style={{ marginTop: 4 }}>{tl('{0} su {1} attività fatte.', pr.done, pr.total)}</Body>
              </Card>
            );
          }) : <Empty text="Ancora nessun progetto. Importa un elenco o crea il primo." />}
        </>
      )}

      <Sheet visible={imp} title="Incolla un elenco" onClose={() => setImp(false)}>
        <Body small muted style={{ marginBottom: 6 }}>Una voce per riga. Per fare i figli rientra la riga (2 spazi o un tab), oppure usa i titoli # e ##. Vanno bene anche - [ ] e - [x] (la casella spuntata è già fatta).</Body>
        <Input value={text} onChangeText={setText} multiline maxLines={10} placeholder={'# LifePilot\n## Fitness\n- [ ] Allenamento\n- [ ] Pasti\n  - [ ] Frigo'} />
        <Btn style={{ marginTop: 10 }} title="Importa" disabled={!text.trim()} onPress={() => doImport(text)} />
      </Sheet>

      <Sheet visible={!!menu} title={menu?.title ?? ''} onClose={() => setMenu(null)}>
        {menu ? (
          <View style={{ gap: 10 }}>
            <Input value={rename} onChangeText={setRename} placeholder="Nome" />
            <Btn small ghost title="Rinomina" disabled={!rename.trim() || rename.trim() === menu.title} onPress={() => { P().rename(menu.id, rename); setMenu({ ...menu, title: rename.trim() }); }} />
            <Row gap={8}><View style={{ flex: 1 }}><Input value={child} onChangeText={setChild} placeholder="Nuova sotto-attività" onSubmitEditing={() => { if (P().addChild(menu.id, child)) { setChild(''); toast('Aggiunta'); } else toast('Non posso aggiungere altri livelli'); }} /></View><Btn small icon="plus" title="" disabled={!child.trim()} onPress={() => { if (P().addChild(menu.id, child)) { setChild(''); toast('Aggiunta'); } else toast('Non posso aggiungere altri livelli'); }} /></Row>
            {!isLeaf(nodes, menu.id) ? <Body small muted>{tl('Questa attività si completa da sola quando lo sono tutte le sue sotto-attività.')}</Body> : null}
            <Btn small icon="paperclip" title="Carica un file" onPress={() => void attachFile(menu)} />
            {menuFiles.length ? (
              <View style={{ gap: 4 }}>
                <Body small muted>{tl('File di questa attività:')}</Body>
                {menuFiles.map((f) => <Row key={f.id}><Body small numberOfLines={1} style={{ flex: 1 }}>{f.n}</Body><Btn small ghost title="Togli" onPress={() => { P().detach(menu.id, f.id); setMenu({ ...menu, files: menu.files.filter((x) => x !== f.id) }); }} /></Row>)}
                <Body small muted>{tl('Restano anche in LifeDrive, nella cartella Progetti.')}</Body>
              </View>
            ) : null}
            <Btn small ghost danger icon="trash" title="Elimina con tutto ciò che contiene" onPress={() => { const m = menu; confirmDelete(`«${m.title}» e le sue sotto-attività`, () => { P().remove(m.id); setMenu(null); if (openRoot === m.id) setOpenRoot(null); }); }} />
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={share} title={`Condividi «${root?.title ?? ''}»`} onClose={() => setShare(false)}>
        <Body small muted style={{ marginBottom: 6 }}>Mando l'elenco del progetto in una chat. Chi lo riceve lo importa con «Incolla testo» e lo ha tutto. L'avanzamento non si aggiorna da solo tra le due persone: per ora è una copia.</Body>
        <Input placeholder="Cerca una chat o scrivi un nome" value={who} onChangeText={setWho} />
        {targets.slice(0, 8).map((c) => <Pressable key={c.id} onPress={() => sendTo(c.id, c.name)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}><Body>{c.name}</Body></Pressable>)}
        {who.trim() && !targets.length ? <Btn style={{ marginTop: 8 }} title={`Scrivi a ${who.trim()}`} onPress={() => sendTo(useChat.getState().ensureDm(who.trim(), me), who.trim())} /> : null}
      </Sheet>
    </Page>
  );
}
