import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Mascot } from '@/components/mascot/Mascot';
import { Text } from '@/components/T';
import { WorkChat } from '@/components/workspace/WorkChat';
import { Body, Btn, Empty, Input, Page, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { fmtBytes } from '@/lib/attachments';
import { confirmDelete } from '@/lib/confirm';
import { persistFile } from '@/lib/chatMedia';
import { weekdayShortDate } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { deleteSharedPage } from '@/lib/teamSync';
import { WORKSPACE_FOLDER, searchWorkspace, workspaceFiles, type SearchHit } from '@/lib/workspaceAi';
import { STATUSES, childrenOf, pathOf, slashCommand, useWorkspace, type BlockType, type WsPage } from '@/store/workspace';
import { useWorkspaceChat } from '@/store/workspaceChat';
import { useLife } from '@/store/life';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';

type Tab = 'pagine' | 'file' | 'theia';
const PALETTE = ['#8fa4ff', '#5fd39a', '#ff9d6e', '#c9b6ff', '#6ec9dd', '#e0c97b', '#ff8fb1'];
const colorOf = (id: string) => PALETTE[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length]!;
const ago = (ts: number) => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? tl('adesso') : m < 60 ? tl('{0} min fa', m) : m < 1440 ? tl('{0} h fa', Math.round(m / 60)) : tl('{0} g fa', Math.round(m / 1440)); };
const BLOCKS: { t: BlockType; label: string; icon: string }[] = [{ t: 'p', label: 'Testo', icon: 'note' }, { t: 'h', label: 'Titolo', icon: 'edit' }, { t: 'todo', label: 'Da fare', icon: 'check' }, { t: 'bullet', label: 'Elenco', icon: 'tasks' }, { t: 'quote', label: 'Citazione', icon: 'comment' }, { t: 'divider', label: 'Linea', icon: 'minus' }];

/** LifeWorkspace: pagine annidate, database, file e Theia Lavoro. */
export default function Workspace() {
  const [open, setOpen] = useState<string | null>(null);
  const pages = useWorkspace((s) => s.pages);
  const page = pages.find((p) => p.id === open) ?? null;
  if (page) return <PageView page={page} onOpen={setOpen} onBack={() => setOpen(page.parent)} />;
  return <Home onOpen={setOpen} />;
}

function Tile({ p, onPress, big }: { p: WsPage; onPress: () => void; big?: boolean }) {
  const th = useTheme(); const c = colorOf(p.id);
  const subs = useWorkspace((s) => s.pages.filter((x) => x.parent === p.id).length);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={p.title} style={{ width: big ? 170 : undefined, borderRadius: 20, backgroundColor: th.card, borderWidth: 1, borderColor: th.border, overflow: 'hidden' }}>
      <LinearGradient colors={[c + '55', c + '11']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: big ? 64 : 0 }} />
      <View style={{ padding: 12, flexDirection: big ? 'column' : 'row', alignItems: big ? 'flex-start' : 'center', gap: 10 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c + '33', alignItems: 'center', justifyContent: 'center', marginTop: big ? -30 : 0, borderWidth: big ? 2 : 0, borderColor: th.card }}><Icon name={p.kind === 'db' ? 'chart' : 'note'} size={20} color={c} stroke={2} /></View>
        <View style={{ flex: big ? undefined : 1 }}>
          <Text numberOfLines={1} style={{ color: th.text, fontSize: 15, fontWeight: '800' }}>{p.title || tl('Pagina senza titolo')}</Text>
          <Text numberOfLines={1} style={{ color: th.muted, fontSize: 12, marginTop: 2 }}>{`${p.kind === 'db' ? tl('Database') : tl('Pagina')}${subs ? ` · ${tl('{0} sottopagine', subs)}` : ''} · ${ago(p.updatedAt)}`}</Text>
        </View>
        {!big ? <Icon name="chevron-right" size={18} color={th.muted} /> : null}
      </View>
    </Pressable>
  );
}

function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const th = useTheme();
  const pages = useWorkspace((s) => s.pages);
  const teams = useTeams((s) => s.teams);
  const { addPage } = useWorkspace.getState();
  const [tab, setTab] = useState<Tab>('pagine');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  useEffect(() => { let on = true; const h = setTimeout(() => { void searchWorkspace(q).then((r) => { if (on) setHits(r); }); }, 250); return () => { on = false; clearTimeout(h); }; }, [q, pages]);
  const recent = useMemo(() => [...pages].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6), [pages]);
  const roots = childrenOf(pages, null).filter((p) => !p.teamId);
  const nodes = (parent: string | null, depth: number): React.ReactNode => childrenOf(pages, parent).map((p) => (
    <View key={p.id} style={{ marginStart: depth * 14, marginTop: 8 }}><Tile p={p} onPress={() => onOpen(p.id)} />{nodes(p.id, depth + 1)}</View>
  ));
  return (
    <Page id="workspace" title="LifeWorkspace" back>
      <LinearGradient colors={[th.accent + '40', th.accent + '0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 18, borderWidth: 1, borderColor: th.accent + '44' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: th.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }}>{tl('Il tuo spazio di lavoro')}</Text>
            <Text style={{ color: th.muted, fontSize: 13.5, marginTop: 4, lineHeight: 19 }}>{tl('Pagine, database, file e Theia Lavoro che li legge tutti.')}</Text>
          </View>
          <Mascot size={72} color={th.accent} expression="happy" />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Pressable onPress={() => onOpen(addPage(null))} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: th.text }}><Icon name="plus" size={16} color={th.onText} stroke={2.6} /><Text style={{ color: th.onText, fontWeight: '800' }}>{tl('Nuova pagina')}</Text></Pressable>
          <Pressable onPress={() => setTab('theia')} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: th.card, borderWidth: 1, borderColor: th.border }}><Icon name="sparkle" size={16} color={th.accent} stroke={2.2} /><Text style={{ color: th.text, fontWeight: '800' }}>Theia Lavoro</Text></Pressable>
        </View>
      </LinearGradient>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: th.input, borderWidth: 1, borderColor: th.border, borderRadius: 16, paddingHorizontal: 14, marginTop: 14 }}>
        <Icon name="search" size={18} color={th.muted} />
        <Input value={q} onChangeText={setQ} placeholder={tl('Cerca in pagine, database e file')} style={{ flex: 1, borderWidth: 0, backgroundColor: 'transparent', marginBottom: 0 }} />
      </View>
      {q.trim().length >= 2 ? (
        <View style={{ gap: 8 }}>
          {hits.length ? hits.map((h) => (
            <Pressable key={h.kind + h.id} onPress={h.kind === 'page' ? () => onOpen(h.id) : () => setTab('file')} style={{ backgroundColor: th.card, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name={h.kind === 'page' ? 'note' : 'file'} size={16} color={th.accent} /><Text numberOfLines={1} style={{ color: th.text, fontWeight: '800', flex: 1 }}>{h.title}</Text></View>
              {h.snippet ? <Text numberOfLines={2} style={{ color: th.muted, fontSize: 12.5, marginTop: 4 }}>{`…${h.snippet}…`}</Text> : null}
            </Pressable>
          )) : <Body small muted>{tl('Niente trovato.')}</Body>}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', backgroundColor: th.card, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: th.border, marginTop: 12, marginBottom: 12 }}>
        {([['pagine', 'Pagine', 'note'], ['file', 'File', 'file'], ['theia', 'Theia Lavoro', 'sparkle']] as const).map(([id, l, ic]) => (
          <Pressable key={id} onPress={() => setTab(id)} accessibilityRole="button" accessibilityState={{ selected: tab === id }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 12, backgroundColor: tab === id ? th.text : 'transparent' }}>
            <Icon name={ic} size={15} color={tab === id ? th.onText : th.muted} stroke={2.2} /><Text style={{ color: tab === id ? th.onText : th.muted, fontWeight: '800', fontSize: 13 }}>{tl(l)}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'pagine' ? (
        <View style={{ gap: 14 }}>
          {recent.length ? (
            <View>
              <Text style={{ color: th.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>{tl('Recenti')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>{recent.map((p) => <Tile key={p.id} p={p} big onPress={() => onOpen(p.id)} />)}</ScrollView>
            </View>
          ) : null}
          {teams.map((tm) => (
            <View key={tm.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: th.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>{`${tm.name} · ${tl('condivise')}`}</Text>
                <Pressable onPress={() => onOpen(addPage(null, 'page', '', tm.id))} hitSlop={8} accessibilityRole="button"><Text style={{ color: th.accent, fontWeight: '800', fontSize: 13 }}>{tl('+ Nuova')}</Text></Pressable>
              </View>
              {nodes(null, 0) && null}
              {childrenOf(pages, null).filter((p) => p.teamId === tm.id).map((p) => <View key={p.id} style={{ marginTop: 8 }}><Tile p={p} onPress={() => onOpen(p.id)} /></View>)}
            </View>
          ))}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: th.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>{tl('Le tue pagine')}</Text>
              <Pressable onPress={() => onOpen(addPage(null, 'db', tl('Nuovo database')))} hitSlop={8} accessibilityRole="button"><Text style={{ color: th.accent, fontWeight: '800', fontSize: 13 }}>{tl('+ Database')}</Text></Pressable>
            </View>
            {roots.length ? nodes(null, 0) && roots.map((p) => <View key={p.id} style={{ marginTop: 8 }}><Tile p={p} onPress={() => onOpen(p.id)} />{childrenOf(pages, p.id).map((c) => <View key={c.id} style={{ marginStart: 16, marginTop: 6 }}><Tile p={c} onPress={() => onOpen(c.id)} /></View>)}</View>) : <Empty text={tl('Nessuna pagina ancora: creane una, anche per il wiki della tua azienda.')} />}
          </View>
        </View>
      ) : null}
      {tab === 'file' ? <Files onChat={() => setTab('theia')} /> : null}
      {tab === 'theia' ? <WorkChat /> : null}
    </Page>
  );
}

function Files({ pid, onChat }: { pid?: string; onChat?: () => void }) {
  const th = useTheme(); const life = useLife(); const ws = useWorkspace();
  useLife((s) => s.drive);
  const files = workspaceFiles();
  const upload = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
    if (r.canceled) return;
    for (const a of r.assets) {
      const id = Math.random().toString(36).slice(2, 10);
      life.addFile({ id, n: a.name, s: fmtBytes(a.size ?? 0) || '—', folder: WORKSPACE_FOLDER, date: weekdayShortDate(), uri: persistFile(a.uri, a.name), src: 'Workspace', tag: 'Workspace' });
      if (pid) ws.attach(pid, id);
    }
    toast(tl('File caricati nel workspace'));
  };
  const others = life.drive.filter((f) => f.folder !== WORKSPACE_FOLDER && !ws.pages.some((p) => p.files.includes(f.id)) && !f.photo).slice(0, 12);
  const kindIcon = (n: string) => (/\.(xlsx?|csv)$/i.test(n) ? 'chart' : /\.(pptx?)$/i.test(n) ? 'projects' : /\.(docx?|txt|md)$/i.test(n) ? 'note' : 'file');
  const asked = (id: string) => { useWorkspaceChat.getState().set({ focus: [id], mode: 'ask' }); onChat?.(); };
  return (
    <View style={{ gap: 10 }}>
      <Pressable onPress={() => void upload()} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: th.accent + '88', backgroundColor: th.accent + '12' }}><Icon name="plus" size={18} color={th.accent} stroke={2.6} /><Text style={{ color: th.text, fontWeight: '800' }}>{tl('Carica file')}</Text></Pressable>
      {files.length ? files.map((f) => {
        const linked = pid ? ws.pages.find((p) => p.id === pid)?.files.includes(f.id) : false;
        return (
          <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: th.card, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 12 }}>
            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: th.accent + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={kindIcon(f.n)} size={20} color={th.accent} stroke={2} /></View>
            <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: th.text, fontWeight: '800', fontSize: 14.5 }}>{f.n}</Text><Text style={{ color: th.muted, fontSize: 12 }}>{`${f.s} · ${f.date}`}</Text></View>
            {pid ? <Btn small ghost title={linked ? tl('Scollega') : tl('Collega')} onPress={() => (linked ? ws.detach(pid, f.id) : ws.attach(pid, f.id))} /> : onChat ? <Btn small ghost title={tl('Chiedi')} onPress={() => asked(f.id)} /> : null}
          </View>
        );
      }) : <Empty text={tl('Nessun file ancora: carica il primo e chiedi a Theia Lavoro.')} />}
      {pid && others.length ? (<><Text style={{ color: th.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 6 }}>{tl('Da LifeDrive')}</Text>{others.map((f) => <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}><Icon name="file" size={16} color={th.muted} /><Text numberOfLines={1} style={{ color: th.text, flex: 1 }}>{f.n}</Text><Btn small ghost title={tl('Collega')} onPress={() => ws.attach(pid, f.id)} /></View>)}</>) : null}
    </View>
  );
}

function PageView({ page, onOpen, onBack }: { page: WsPage; onOpen: (id: string) => void; onBack: () => void }) {
  const th = useTheme(); const ws = useWorkspace.getState();
  const pages = useWorkspace((s) => s.pages);
  const [menu, setMenu] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [focusBlock, setFocusBlock] = useState<string | null>(null);
  const subs = childrenOf(pages, page.id);
  const crumbs = useMemo(() => pathOf(pages, page.id).slice(0, -1), [pages, page.id]);
  const c = colorOf(page.id);
  const teamName = page.teamId ? useTeams.getState().teams.find((x) => x.id === page.teamId)?.name : undefined;
  const del = () => confirmDelete(tl('la pagina «{0}» e le sue sottopagine', page.title || tl('senza titolo')), () => { if (page.teamId) void deleteSharedPage(page.id); ws.remove(page.id); onBack(); }, () => undefined);
  const onText = (bid: string, v: string) => { const sc = slashCommand(v); if (sc) { ws.patchBlock(page.id, bid, { t: sc.t, text: sc.rest }); if (sc.t === 'divider') ws.addBlock(page.id); } else ws.patchBlock(page.id, bid, { text: v }); };
  return (
    <Page id="workspace" title={page.title || tl('Pagina senza titolo')} back onBack={onBack}>
      <LinearGradient colors={[c + '77', c + '12']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 96, borderRadius: 22 }} />
      <View style={{ marginTop: -40, paddingHorizontal: 6 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: th.card, borderWidth: 2, borderColor: th.bg, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: c + '33', alignItems: 'center', justifyContent: 'center' }}><Icon name={page.kind === 'db' ? 'chart' : 'note'} size={26} color={c} stroke={2} /></View></View>
        {crumbs.length ? <Text style={{ color: th.muted, fontSize: 12, marginTop: 8 }}>{crumbs.map((x) => x.title || '…').join('  ›  ')}</Text> : null}
        <Input value={page.title} onChangeText={(v) => ws.patch(page.id, { title: v })} placeholder={tl('Pagina senza titolo')} style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.6, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0 }} />
        <Text style={{ color: th.muted, fontSize: 12, marginTop: -4 }}>{`${teamName ? `${tl('Condivisa con {0}', teamName)} · ` : ''}${tl('modificata {0}', ago(page.updatedAt))}`}</Text>
      </View>

      {page.kind === 'db' ? <Database page={page} /> : (
        <View style={{ gap: 2, paddingHorizontal: 4 }}>
          {page.blocks.map((b) => {
            const on = focusBlock === b.id; const slash = b.text.startsWith('/') && on;
            if (b.t === 'divider') return <Pressable key={b.id} onLongPress={() => setMenu(b.id)} style={{ height: 1, backgroundColor: th.border, marginVertical: 14 }} />;
            return (
              <View key={b.id}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderStartWidth: b.t === 'quote' ? 3 : 0, borderStartColor: c, paddingStart: b.t === 'quote' ? 10 : 0 }}>
                  {b.t === 'todo' ? <Pressable onPress={() => ws.patchBlock(page.id, b.id, { done: !b.done })} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: !!b.done }} style={{ marginTop: 11, width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: b.done ? th.positive : th.muted, backgroundColor: b.done ? th.positive : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{b.done ? <Icon name="check" size={13} color="#fff" stroke={3} /> : null}</Pressable> : b.t === 'bullet' ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c, marginTop: 17 }} /> : null}
                  <Input value={b.text} onChangeText={(v) => onText(b.id, v)} multiline onFocus={() => setFocusBlock(b.id)} placeholder={b.t === 'p' ? tl('Scrivi, o «/» per un comando') : b.t === 'h' ? tl('Titolo') : ''} flex={1}
                    style={{ borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, fontSize: b.t === 'h' ? 22 : 16, lineHeight: b.t === 'h' ? 28 : 24, fontWeight: b.t === 'h' ? '800' : '400', fontStyle: b.t === 'quote' ? 'italic' : 'normal', color: b.t === 'todo' && b.done ? th.muted : th.text, textDecorationLine: b.t === 'todo' && b.done ? 'line-through' : 'none' }} />
                  {on ? <Pressable onPress={() => setMenu(b.id)} hitSlop={8} accessibilityRole="button" style={{ marginTop: 12 }}><Icon name="more" size={18} color={th.muted} /></Pressable> : null}
                </View>
                {slash ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>{BLOCKS.map((x) => <Pressable key={x.t} onPress={() => { ws.patchBlock(page.id, b.id, { t: x.t, text: '' }); if (x.t === 'divider') ws.addBlock(page.id); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: th.card, borderWidth: 1, borderColor: th.border }}><Icon name={x.icon} size={14} color={c} /><Text style={{ color: th.text, fontWeight: '700', fontSize: 13 }}>{tl(x.label)}</Text></Pressable>)}</ScrollView> : null}
              </View>
            );
          })}
          <Pressable onPress={() => { const id = ws.addBlock(page.id); setFocusBlock(id); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }}><Icon name="plus" size={16} color={th.muted} stroke={2.4} /><Text style={{ color: th.muted, fontSize: 14 }}>{tl('Aggiungi un blocco')}</Text></Pressable>
        </View>
      )}

      <Section title={tl('Sottopagine')} action={tl('+ Pagina')} onAction={() => onOpen(ws.addPage(page.id, 'page', '', page.teamId))} extra={tl('+ Database')} onExtra={() => onOpen(ws.addPage(page.id, 'db', tl('Nuovo database'), page.teamId))}>
        {subs.length ? subs.map((s) => <View key={s.id} style={{ marginBottom: 8 }}><Tile p={s} onPress={() => onOpen(s.id)} /></View>) : <Text style={{ color: th.muted, fontSize: 13 }}>{tl('Una pagina può contenere altre pagine, come cartelle.')}</Text>}
      </Section>
      <Section title={tl('File collegati')}><Files pid={page.id} /></Section>
      <Section title={tl('Commenti')}>
        {page.comments.map((cm) => <View key={cm.id} style={{ backgroundColor: th.card, borderRadius: 14, borderWidth: 1, borderColor: th.border, padding: 10, marginBottom: 8 }}><Text style={{ color: th.text, fontSize: 14 }}>{cm.text}</Text><Text style={{ color: th.muted, fontSize: 11, marginTop: 4 }}>{new Date(cm.ts).toLocaleString()}</Text></View>)}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Input value={comment} onChangeText={setComment} placeholder={tl('Scrivi un commento')} flex={1} style={{ marginBottom: 0 }} /><Btn small disabled={!comment.trim()} title={tl('Invia')} onPress={() => { ws.addComment(page.id, comment); setComment(''); }} /></View>
      </Section>
      <Btn ghost danger small title={tl('Elimina la pagina')} onPress={del} />
      <Sheet visible={!!menu} title={tl('Blocco')} onClose={() => setMenu(null)}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{BLOCKS.map((x) => <Pressable key={x.t} onPress={() => { if (menu) ws.patchBlock(page.id, menu, { t: x.t }); setMenu(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: th.card, borderWidth: 1, borderColor: th.border }}><Icon name={x.icon} size={14} color={c} /><Text style={{ color: th.text, fontWeight: '700' }}>{tl(x.label)}</Text></Pressable>)}</View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}><Btn small ghost title={tl('Su')} onPress={() => { if (menu) ws.moveBlock(page.id, menu, -1); }} /><Btn small ghost title={tl('Giù')} onPress={() => { if (menu) ws.moveBlock(page.id, menu, 1); }} /><Btn small ghost danger title={tl('Elimina')} onPress={() => { if (menu) ws.delBlock(page.id, menu); setMenu(null); }} /></View>
      </Sheet>
    </Page>
  );
}

function Section({ title, children, action, onAction, extra, onExtra }: { title: string; children: React.ReactNode; action?: string; onAction?: () => void; extra?: string; onExtra?: () => void }) {
  const th = useTheme();
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: th.text, fontSize: 16, fontWeight: '800' }}>{title}</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {action ? <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button"><Text style={{ color: th.accent, fontWeight: '800', fontSize: 13 }}>{action}</Text></Pressable> : null}
          {extra ? <Pressable onPress={onExtra} hitSlop={8} accessibilityRole="button"><Text style={{ color: th.accent, fontWeight: '800', fontSize: 13 }}>{extra}</Text></Pressable> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function Database({ page }: { page: WsPage }) {
  const th = useTheme(); const ws = useWorkspace.getState();
  const [colName, setColName] = useState('');
  const cols = page.cols ?? []; const rows = page.rows ?? [];
  const status = cols.find((x) => x.kind === 'status'); const first = cols[0];
  const next = (v: string | undefined) => STATUSES[(STATUSES.indexOf(v ?? '') + 1) % STATUSES.length]!;
  const SC: Record<string, string> = { 'Da fare': '#8e98a8', 'In corso': '#e0c97b', Fatto: '#5fd39a' };
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', backgroundColor: th.card, borderRadius: 14, padding: 3, borderWidth: 1, borderColor: th.border, alignSelf: 'flex-start' }}>
        {(['table', 'kanban'] as const).map((v) => <Pressable key={v} onPress={() => ws.patch(page.id, { view: v })} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 11, backgroundColor: (page.view ?? 'table') === v ? th.text : 'transparent' }}><Text style={{ color: (page.view ?? 'table') === v ? th.onText : th.muted, fontWeight: '800', fontSize: 13 }}>{v === 'table' ? tl('Tabella') : 'Kanban'}</Text></Pressable>)}
      </View>
      {page.view === 'kanban' && status && first ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {STATUSES.map((s) => { const col = rows.filter((r) => (r.cells[status.id] || STATUSES[0]) === s); return (
            <View key={s} style={{ width: 220, backgroundColor: th.card, borderRadius: 18, padding: 10, gap: 8, borderWidth: 1, borderColor: th.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: SC[s] }} /><Text style={{ color: th.text, fontWeight: '800' }}>{tl(s)}</Text><Text style={{ color: th.muted }}>{col.length}</Text></View>
              {col.map((r) => <Pressable key={r.id} onPress={() => ws.patchRow(page.id, r.id, status.id, next(r.cells[status.id] || STATUSES[0]))} style={{ backgroundColor: th.bg, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: th.border }}><Text style={{ color: th.text, fontWeight: '700' }}>{r.cells[first.id] || tl('Senza nome')}</Text><Text style={{ color: th.muted, fontSize: 11, marginTop: 4 }}>{tl('Tocca per spostare')}</Text></Pressable>)}
            </View>
          ); })}
        </ScrollView>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: th.border, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', backgroundColor: th.card }}>{cols.map((x) => <View key={x.id} style={{ width: 140, padding: 10 }}><Text style={{ color: th.muted, fontSize: 12, fontWeight: '800' }}>{x.name}</Text></View>)}<View style={{ width: 36 }} /></View>
            {rows.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: th.border, alignItems: 'center' }}>
                {cols.map((x) => x.kind === 'status'
                  ? <View key={x.id} style={{ width: 140, padding: 6 }}><Pressable onPress={() => ws.patchRow(page.id, r.id, x.id, next(r.cells[x.id] || STATUSES[0]))} style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: SC[r.cells[x.id] || STATUSES[0]!]! + '33' }}><Text style={{ color: SC[r.cells[x.id] || STATUSES[0]!], fontWeight: '800', fontSize: 12 }}>{tl(r.cells[x.id] || STATUSES[0]!)}</Text></Pressable></View>
                  : <Input key={x.id} value={r.cells[x.id] ?? ''} onChangeText={(v) => ws.patchRow(page.id, r.id, x.id, v)} keyboardType={x.kind === 'number' ? 'decimal-pad' : 'default'} placeholder={x.kind === 'date' ? 'GG/MM/AAAA' : ''} style={{ width: 140, marginBottom: 0, borderWidth: 0, backgroundColor: 'transparent', borderRadius: 0 }} />)}
                <Pressable onPress={() => ws.delRow(page.id, r.id)} hitSlop={8} style={{ width: 36, alignItems: 'center' }}><Icon name="x" size={14} color={th.muted} /></Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn small icon="plus" title={tl('Nuova riga')} onPress={() => ws.addRow(page.id)} />
        <Input value={colName} onChangeText={setColName} placeholder={tl('Nuova colonna')} style={{ width: 130, marginBottom: 0 }} />
        {(['text', 'number', 'date'] as const).map((k) => <Btn key={k} small ghost disabled={!colName.trim()} title={k === 'text' ? tl('Testo') : k === 'number' ? tl('Numero') : tl('Data')} onPress={() => { ws.addCol(page.id, colName, k); setColName(''); }} />)}
      </View>
    </View>
  );
}
