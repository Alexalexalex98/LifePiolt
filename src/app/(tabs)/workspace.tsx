import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Mascot } from '@/components/mascot/Mascot';
import { Text } from '@/components/T';
import { WorkChat } from '@/components/workspace/WorkChat';
import { Crm } from '@/components/work/Crm';
import { Money } from '@/components/work/Money';
import { Reports } from '@/components/work/Reports';
import { Writing } from '@/components/work/Writing';
import { Documents } from '@/components/work/Documents';
import { People } from '@/components/work/People';
import { Tasks } from '@/components/work/Tasks';
import { NoWorkspace } from '@/components/work/NoWorkspace';
import { MeetingsList } from '@/components/work/Meetings';
import { ChannelView, Messages } from '@/components/work/Messages';
import { WorkPlanner } from '@/components/work/WorkPlanner';
import { Body, Btn, Empty, Input, Page, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { fmtBytes } from '@/lib/attachments';
import { confirmDelete } from '@/lib/confirm';
import { persistFile } from '@/lib/chatMedia';
import { weekdayShortDate } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { deleteSharedPage } from '@/lib/teamSync';
import { applyView, byDay, TEMPLATES, type Filter } from '@/lib/workspaceViews';
import { WORKSPACE_FOLDER, pageAi, searchWorkspace, workspaceFiles, type SearchHit } from '@/lib/workspaceAi';
import { STATUSES, childrenOf, pathOf, slashCommand, useWorkspace, type BlockType, type WsPage } from '@/store/workspace';
import { useWorkspaceChat } from '@/store/workspaceChat';
import { useLife } from '@/store/life';
import { useTour } from '@/store/tour';
import { useDocs } from '@/store/docs';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';

type Tab = 'pagine' | 'piano' | 'task' | 'clienti' | 'report' | 'scrivi' | 'soldi' | 'messaggi' | 'documenti' | 'persone' | 'file' | 'theia';
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
  const [tab, setTab] = useState<Tab>('pagine');
  const [create, setCreate] = useState<{ kind: CreateKind; teamId?: string } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  useEffect(() => { let on = true; const h = setTimeout(() => { void searchWorkspace(q).then((r) => { if (on) setHits(r); }); }, 250); return () => { on = false; clearTimeout(h); }; }, [q, pages]);
  const allDocs = useDocs((d) => d.docs);
  const docHits = useMemo(() => { const n = q.trim().toLowerCase(); if (n.length < 2) return []; return Object.values(allDocs).flat().filter((d) => `${d.title} ${Object.values(d.fields).join(' ')} ${d.file_name}`.toLowerCase().includes(n)).slice(0, 6); }, [q, allDocs]);
  const recent = useMemo(() => [...pages].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6), [pages]);
  const roots = childrenOf(pages, null).filter((p) => !p.teamId);
  const nodes = (parent: string | null, depth: number): React.ReactNode => childrenOf(pages, parent).map((p) => (
    <View key={p.id} style={{ marginStart: depth * 14, marginTop: 8 }}><Tile p={p} onPress={() => onOpen(p.id)} />{nodes(p.id, depth + 1)}</View>
  ));
  return (
    <Page id="workspace" title="LifeWorkspace" back>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: th.input, borderWidth: 1, borderColor: th.border, borderRadius: 16, paddingHorizontal: 14 }}>
          <Icon name="search" size={18} color={th.muted} />
          <Input value={q} onChangeText={setQ} placeholder={tl('Cerca in pagine, database e file')} style={{ flex: 1, borderWidth: 0, backgroundColor: 'transparent', marginBottom: 0 }} />
        </View>
        <Pressable onPress={() => useTour.getState().start('sec-workspace')} accessibilityRole="button" accessibilityLabel={tl('Come si usa')} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: th.card, borderWidth: 1, borderColor: th.border, alignItems: 'center', justifyContent: 'center' }}><Icon name="help" size={20} color={th.accent} /></Pressable>
      </View>
      {q.trim().length >= 2 ? (
        <View style={{ gap: 8 }}>
          {hits.length ? hits.map((h) => (
            <Pressable key={h.kind + h.id} onPress={h.kind === 'page' ? () => onOpen(h.id) : () => setTab('file')} style={{ backgroundColor: th.card, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name={h.kind === 'page' ? 'note' : 'file'} size={16} color={th.accent} /><Text numberOfLines={1} style={{ color: th.text, fontWeight: '800', flex: 1 }}>{h.title}</Text></View>
              {h.snippet ? <Text numberOfLines={2} style={{ color: th.muted, fontSize: 12.5, marginTop: 4 }}>{`…${h.snippet}…`}</Text> : null}
            </Pressable>
          )) : docHits.length ? null : <Body small muted>{tl('Niente trovato.')}</Body>}
          {docHits.map((d) => (
            <Pressable key={'doc' + d.id} onPress={() => { setTab('documenti'); setQ(''); }} accessibilityRole="button" style={{ backgroundColor: th.card, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="file" size={16} color={th.accent} /><Text numberOfLines={1} style={{ color: th.text, fontWeight: '800', flex: 1 }}>{d.title}</Text></View>
              <Text numberOfLines={1} style={{ color: th.muted, fontSize: 12.5, marginTop: 4 }}>{tl('Documento')} · {d.file_name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ backgroundColor: th.card, borderRadius: 16, padding: 4, gap: 2, marginTop: 12, marginBottom: 12, borderWidth: 1, borderColor: th.border }} style={{ flexGrow: 0 }}>
        {([['theia', 'Theia', 'sparkle'], ['pagine', 'Pagine', 'note'], ['piano', 'Piano', 'calendar'], ['task', 'Task', 'check'], ['clienti', 'Clienti', 'contact'], ['soldi', 'Soldi', 'wallet'], ['report', 'Report', 'chart'], ['scrivi', 'Scrivi', 'edit'], ['messaggi', 'Messaggi', 'comment'], ['documenti', 'Documenti', 'note'], ['persone', 'Persone', 'users'], ['file', 'File', 'file']] as const).map(([id, l, ic]) => (
          <Pressable key={id} onPress={() => { setTab(id); if (id === 'theia') setChatOpen(true); }} accessibilityRole="button" accessibilityState={{ selected: tab === id }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: tab === id ? th.text : 'transparent' }}>
            <Icon name={ic} size={15} color={tab === id ? th.onText : th.muted} stroke={2.2} /><Text style={{ color: tab === id ? th.onText : th.muted, fontWeight: '800', fontSize: 13 }}>{tl(l)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab === 'pagine' ? (
        <View style={{ gap: 14 }}>
          {teams.length === 0 ? <NoWorkspace what="condividi pagine, task e riunioni" /> : null}
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
                <Pressable onPress={() => setCreate({ kind: 'page', teamId: tm.id })} hitSlop={8} accessibilityRole="button"><Text style={{ color: th.accent, fontWeight: '800', fontSize: 13 }}>{tl('+ Nuova')}</Text></Pressable>
              </View>
              {nodes(null, 0) && null}
              {childrenOf(pages, null).filter((p) => p.teamId === tm.id).map((p) => <View key={p.id} style={{ marginTop: 8 }}><Tile p={p} onPress={() => onOpen(p.id)} /></View>)}
            </View>
          ))}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: th.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>{tl('Le tue pagine')}</Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Pressable onPress={() => setCreate({ kind: 'page' })} hitSlop={8} accessibilityRole="button"><Text style={{ color: th.accent, fontWeight: '800', fontSize: 13 }}>{tl('+ Pagina')}</Text></Pressable>
                <Pressable onPress={() => setCreate({ kind: 'tpl' })} hitSlop={8} accessibilityRole="button"><Text style={{ color: th.accent, fontWeight: '800', fontSize: 13 }}>{tl('Da modello')}</Text></Pressable>
                <Pressable onPress={() => setCreate({ kind: 'db' })} hitSlop={8} accessibilityRole="button"><Text style={{ color: th.accent, fontWeight: '800', fontSize: 13 }}>{tl('+ Database')}</Text></Pressable>
              </View>
            </View>
            {roots.length ? nodes(null, 0) && roots.map((p) => <View key={p.id} style={{ marginTop: 8 }}><Tile p={p} onPress={() => onOpen(p.id)} />{childrenOf(pages, p.id).map((c) => <View key={c.id} style={{ marginStart: 16, marginTop: 6 }}><Tile p={c} onPress={() => onOpen(c.id)} /></View>)}</View>) : <Empty text={tl('Nessuna pagina ancora: creane una, anche per il wiki della tua azienda.')} />}
          </View>
        </View>
      ) : null}
      {tab === 'piano' ? <WorkPlanner /> : null}
      {tab === 'task' ? <Tasks /> : null}
      {tab === 'clienti' ? <Crm /> : null}
      {tab === 'soldi' ? <Money /> : null}
      {tab === 'report' ? <Reports /> : null}
      {tab === 'scrivi' ? <Writing /> : null}
      {tab === 'messaggi' ? <Messages /> : null}
      {tab === 'documenti' ? <Documents /> : null}
      {tab === 'persone' ? <People /> : null}
      {tab === 'file' ? <Files onChat={() => setTab('theia')} /> : null}
      {tab === 'theia' ? <WorkLauncher onOpen={() => setChatOpen(true)} /> : null}
      {chatOpen ? <WorkChat onClose={() => setChatOpen(false)} /> : null}
      <CreateSheet open={!!create} kind={create?.kind ?? 'page'} parent={null} teamId={create?.teamId} onClose={() => setCreate(null)} onCreated={onOpen} />
    </Page>
  );
}

type CreateKind = 'page' | 'db' | 'tpl';
/** Crea una pagina, un database o una pagina da modello: nome, spiegazione e un grande tasto «Crea» in fondo. */
function CreateSheet({ open, kind: k0, parent, teamId, onClose, onCreated }: { open: boolean; kind: CreateKind; parent: string | null; teamId?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const th = useTheme();
  const [kind, setKind] = useState<CreateKind>(k0); const [title, setTitle] = useState(''); const [tpl, setTpl] = useState<string | null>(null);
  useEffect(() => { if (open) { setKind(k0); setTitle(''); setTpl(null); } }, [open, k0]);
  const ok = kind !== 'tpl' || !!tpl;
  const create = () => {
    if (!ok) return;
    const ws = useWorkspace.getState(); let id: string; let name = title.trim();
    if (kind === 'tpl') { id = ws.fromTemplate(parent, tpl!, teamId); if (name) ws.patch(id, { title: name }); else name = TEMPLATES.find((x) => x.id === tpl)?.name ?? ''; }
    else { name = name || (kind === 'db' ? tl('Nuovo database') : ''); id = ws.addPage(parent, kind, name, teamId); }
    toast(kind === 'db' ? tl('Database creato: «{0}»', name) : tl('Pagina creata{0}', name ? `: «${name}»` : '')); onClose(); onCreated(id);
  };
  const seg = (k: CreateKind, l: string) => <Pressable key={k} onPress={() => setKind(k)} accessibilityRole="button" accessibilityState={{ selected: kind === k }} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: kind === k ? th.text : 'transparent' }}><Text style={{ color: kind === k ? th.onText : th.muted, fontWeight: '800', fontSize: 13 }}>{l}</Text></Pressable>;
  return (
    <Sheet visible={open} title={tl('Crea')} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', backgroundColor: th.card, borderRadius: 14, padding: 3, borderWidth: 1, borderColor: th.border }}>{seg('page', tl('Pagina'))}{seg('db', tl('Database'))}{seg('tpl', tl('Da modello'))}</View>
        <Text style={{ color: th.muted, fontSize: 13.5, lineHeight: 19 }}>
          {kind === 'page' ? tl('Una pagina è un documento: scrivi testo, elenchi di cose da fare, titoli. Può contenere altre pagine, come cartelle.') : kind === 'db' ? tl('Un database è una tabella: ogni riga è una voce (un compito, un libro, un contenuto) e ogni colonna un dato (nome, stato, data). Lo vedi come Tabella, Kanban, Calendario o Galleria.') : tl('Parti da una pagina già impostata: scegli un modello e poi cambia quello che vuoi.')}
        </Text>
        {kind === 'tpl' ? (
          <View style={{ gap: 8 }}>{TEMPLATES.map((x) => { const on = tpl === x.id; return (
            <Pressable key={x.id} onPress={() => { setTpl(x.id); }} accessibilityRole="radio" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: on ? th.accent + '1f' : th.card, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? th.accent : th.border, padding: 12 }}>
              <View style={{ flex: 1 }}><Text style={{ color: th.text, fontWeight: '800' }}>{tl(x.name)}</Text><Text style={{ color: th.muted, fontSize: 12 }}>{tl(x.hint)}</Text></View>
              {on ? <Icon name="check" size={18} color={th.accent} stroke={3} /> : null}
            </Pressable>); })}</View>
        ) : null}
        <Input value={title} onChangeText={setTitle} placeholder={kind === 'tpl' ? tl('Nome (facoltativo)') : kind === 'db' ? tl('Nome del database') : tl('Nome della pagina')} onSubmitEditing={create} returnKeyType="done" style={{ marginBottom: 0 }} />
        <Pressable onPress={create} disabled={!ok} accessibilityRole="button" accessibilityLabel={tl('Crea')} style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, backgroundColor: ok ? th.text : th.border, opacity: ok ? 1 : 0.7 }}>
          <Text style={{ color: ok ? th.onText : th.muted, fontWeight: '800', fontSize: 17 }}>{kind === 'tpl' && !tpl ? tl('Scegli un modello') : tl('Crea')}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function WorkLauncher({ onOpen }: { onOpen: () => void }) {
  const th = useTheme();
  const log = useWorkspaceChat((s) => s.log);
  const last = [...log].reverse().find((m) => m.who === 'ai');
  const n = workspaceFiles().length;
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" style={{ backgroundColor: th.card, borderRadius: 22, borderWidth: 1, borderColor: th.border, padding: 18, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Mascot size={52} color={th.accent} expression="happy" />
        <View style={{ flex: 1 }}><Text style={{ color: th.text, fontSize: 18, fontWeight: '800' }}>Theia Lavoro</Text><Text style={{ color: th.muted, fontSize: 13 }}>{n ? tl('{0} file e tutte le tue pagine a portata di domanda', n) : tl('Leggo pagine, database e file del workspace')}</Text></View>
      </View>
      {last ? <Text numberOfLines={3} style={{ color: th.muted, fontSize: 13.5, lineHeight: 19 }}>{last.text}</Text> : null}
      <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: th.text, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 }}><Icon name="sparkle" size={15} color={th.onText} /><Text style={{ color: th.onText, fontWeight: '800' }}>{log.length ? tl('Riprendi la conversazione') : tl('Apri la chat')}</Text></View>
    </Pressable>
  );
}

function Files({ pid, onChat }: { pid?: string; onChat?: () => void }) {
  const th = useTheme(); const life = useLife(); const ws = useWorkspace();
  const [pick, setPick] = useState(false);
  useLife((s) => s.drive);
  const files = workspaceFiles();
  const mine = pid ? files.filter((f) => ws.pages.find((p) => p.id === pid)?.files.includes(f.id)) : [];
  const fromPhone = async () => {
    setPick(false);
    const r = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
    if (r.canceled) return;
    for (const a of r.assets) {
      const id = Math.random().toString(36).slice(2, 10);
      life.addFile({ id, n: a.name, s: fmtBytes(a.size ?? 0) || '—', folder: WORKSPACE_FOLDER, date: weekdayShortDate(), uri: persistFile(a.uri, a.name), src: 'Workspace', tag: 'Workspace' });
      if (pid) ws.attach(pid, id);
    }
    toast(r.assets.length === 1 ? tl('File caricato: «{0}»', r.assets[0]!.name) : tl('{0} file caricati', r.assets.length));
  };
  const fromDrive = (id: string, name: string) => {
    if (pid) ws.attach(pid, id); else useWorkspaceChat.getState().set({ linked: [...new Set([...useWorkspaceChat.getState().linked, id])] });
    toast(tl('Aggiunto: «{0}»', name)); setPick(false);
  };
  const drive = life.drive.filter((f) => !f.photo && f.uri && !(pid ? ws.pages.find((p) => p.id === pid)?.files.includes(f.id) : workspaceFiles().some((w) => w.id === f.id)));
  const kindIcon = (n: string) => (/\.(xlsx?|csv)$/i.test(n) ? 'chart' : /\.(pptx?)$/i.test(n) ? 'projects' : /\.(docx?|txt|md)$/i.test(n) ? 'note' : 'file');
  return (
    <View style={{ gap: 10 }}>
      <Pressable onPress={() => setPick(true)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 18, backgroundColor: th.text }}>
        <Icon name="plus" size={18} color={th.onText} stroke={2.6} /><Text style={{ color: th.onText, fontWeight: '800', fontSize: 16 }}>{tl('Carica file')}</Text>
      </Pressable>
      {pid ? (
        mine.length ? mine.map((f) => (
          <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: th.card, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 12 }}>
            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: th.accent + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={kindIcon(f.n)} size={20} color={th.accent} stroke={2} /></View>
            <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: th.text, fontWeight: '800', fontSize: 14.5 }}>{f.n}</Text><Text style={{ color: th.muted, fontSize: 12 }}>{`${f.s} · ${f.date}`}</Text></View>
            <Btn small ghost title={tl('Scollega')} onPress={() => ws.detach(pid, f.id)} />
          </View>
        )) : <Text style={{ color: th.muted, fontSize: 13 }}>{tl('Nessun file in questa pagina.')}</Text>
      ) : (
        <Text style={{ color: th.muted, fontSize: 13.5, lineHeight: 19, textAlign: 'center' }}>{files.length ? tl('Hai {0} file nel workspace. Per leggerli apri Theia Lavoro e chiedi quello che vuoi: scegli il file o lascia che li cerchi tutti.', files.length) : tl('Carica un PDF, un documento, un foglio Excel o una presentazione, poi chiedi a Theia Lavoro cosa c\'è dentro.')}</Text>
      )}
      {!pid && onChat ? <Btn ghost icon="sparkle" title={tl('Chiedi a Theia Lavoro')} onPress={onChat} /> : null}
      <Sheet visible={pick} title={tl('Carica un file')} onClose={() => setPick(false)}>
        <View style={{ gap: 10 }}>
          <Pressable onPress={() => void fromPhone()} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: th.card, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 14 }}>
            <Icon name="phone" size={22} color={th.accent} /><View style={{ flex: 1 }}><Text style={{ color: th.text, fontWeight: '800' }}>{tl('Dal telefono')}</Text><Text style={{ color: th.muted, fontSize: 12.5 }}>{tl('Scegli uno o più file dal telefono')}</Text></View><Icon name="chevron-right" size={18} color={th.muted} />
          </Pressable>
          <Text style={{ color: th.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 4 }}>{tl('Da LifeDrive')}</Text>
          {drive.length ? drive.slice(0, 40).map((f) => (
            <Pressable key={f.id} onPress={() => fromDrive(f.id, f.n)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: th.accent + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={kindIcon(f.n)} size={18} color={th.accent} /></View>
              <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: th.text, fontWeight: '700' }}>{f.n}</Text><Text style={{ color: th.muted, fontSize: 12 }}>{`${f.s} · ${f.date}`}</Text></View>
              <Text style={{ color: th.accent, fontWeight: '800', fontSize: 13 }}>{tl('Aggiungi')}</Text>
            </Pressable>
          )) : <Text style={{ color: th.muted, fontSize: 13 }}>{tl('Non ci sono altri file in LifeDrive.')}</Text>}
        </View>
      </Sheet>
    </View>
  );
}

function PageView({ page, onOpen, onBack }: { page: WsPage; onOpen: (id: string) => void; onBack: () => void }) {
  const th = useTheme(); const ws = useWorkspace.getState();
  const pages = useWorkspace((s) => s.pages);
  const [menu, setMenu] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [focusBlock, setFocusBlock] = useState<string | null>(null);
  const [ai, setAi] = useState<'summary' | 'tasks' | null>(null);
  const [sub, setSub] = useState<CreateKind | null>(null);
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

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn small ghost title={ai === 'summary' ? tl('Theia legge…') : tl('Theia: riassumi')} disabled={!!ai} onPress={() => { setAi('summary'); void pageAi(page.id, 'summary').then((r) => { setAi(null); toast(r.msg); }); }} />
        <Btn small ghost title={ai === 'tasks' ? tl('Theia legge…') : tl('Theia: estrai i task')} disabled={!!ai} onPress={() => { setAi('tasks'); void pageAi(page.id, 'tasks').then((r) => { setAi(null); toast(r.msg); }); }} />
      </View>
      <Section title={tl('Sottopagine')} action={tl('+ Pagina')} onAction={() => setSub('page')} extra={tl('+ Database')} onExtra={() => setSub('db')}>
        {subs.length ? subs.map((s) => <View key={s.id} style={{ marginBottom: 8 }}><Tile p={s} onPress={() => onOpen(s.id)} /></View>) : <Text style={{ color: th.muted, fontSize: 13 }}>{tl('Una pagina può contenere altre pagine, come cartelle.')}</Text>}
      </Section>
      {page.teamId ? <MeetingsList team={page.teamId} project={page.id} /> : null}
      {page.teamId && page.parent === null ? <ChannelView team={page.teamId} channel={page.id} admin={useTeams.getState().teams.find((x) => x.id === page.teamId)?.role !== 'member'} name={tl('Chat del progetto')} /> : null}
      <Section title={tl('File collegati')}><Files pid={page.id} /></Section>
      <Section title={tl('Commenti')}>
        {page.comments.map((cm) => <View key={cm.id} style={{ backgroundColor: th.card, borderRadius: 14, borderWidth: 1, borderColor: th.border, padding: 10, marginBottom: 8 }}><Text style={{ color: th.text, fontSize: 14 }}>{cm.text}</Text><Text style={{ color: th.muted, fontSize: 11, marginTop: 4 }}>{new Date(cm.ts).toLocaleString()}</Text></View>)}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Input value={comment} onChangeText={setComment} placeholder={tl('Scrivi un commento')} flex={1} style={{ marginBottom: 0 }} /><Btn small disabled={!comment.trim()} title={tl('Invia')} onPress={() => { ws.addComment(page.id, comment); setComment(''); }} /></View>
      </Section>
      <Btn ghost danger small title={tl('Elimina la pagina')} onPress={del} />
      <CreateSheet open={!!sub} kind={sub ?? 'page'} parent={page.id} teamId={page.teamId} onClose={() => setSub(null)} onCreated={onOpen} />
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

const OPS: { op: Filter['op']; label: string }[] = [{ op: 'has', label: 'contiene' }, { op: 'is', label: 'è' }, { op: 'not', label: 'non è' }, { op: 'gt', label: '>' }, { op: 'lt', label: '<' }];
const VIEWS = [{ v: 'table', l: 'Tabella' }, { v: 'kanban', l: 'Kanban' }, { v: 'calendar', l: 'Calendario' }, { v: 'gallery', l: 'Galleria' }] as const;

function Database({ page }: { page: WsPage }) {
  const th = useTheme(); const ws = useWorkspace.getState();
  const [colName, setColName] = useState('');
  const [fOpen, setFOpen] = useState(false);
  const cols = page.cols ?? []; const allRows = page.rows ?? [];
  const status = cols.find((x) => x.kind === 'status'); const first = cols[0];
  const rows = useMemo(() => applyView(cols, allRows, page.flt, page.srt), [cols, allRows, page.flt, page.srt]);
  const view = page.view ?? 'table';
  const next = (v: string | undefined) => STATUSES[(STATUSES.indexOf(v ?? '') + 1) % STATUSES.length]!;
  const SC: Record<string, string> = { 'Da fare': '#8e98a8', 'In corso': '#e0c97b', Fatto: '#5fd39a' };
  const flt: Filter = page.flt ?? { col: first?.id ?? '', op: 'has', v: '' };
  const setFlt = (p: Partial<Filter>) => ws.patch(page.id, { flt: { ...flt, ...p } });
  const sortBy = (id: string) => { const s = page.srt; ws.patch(page.id, { srt: !s || s.col !== id ? { col: id, dir: 1 } : s.dir === 1 ? { col: id, dir: -1 } : null }); };
  const dateCol = cols.find((x) => x.kind === 'date');
  const cal = useMemo(() => byDay(cols, rows), [cols, rows]);
  const chip = (on: boolean) => ({ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? th.accent : th.border, backgroundColor: on ? th.accent + '22' : th.card } as const);
  const card = (r: (typeof rows)[number], w?: number) => (
    <Pressable key={r.id} onPress={() => status ? ws.patchRow(page.id, r.id, status.id, next(r.cells[status.id] || STATUSES[0])) : undefined} style={{ width: w, backgroundColor: th.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: th.border }}>
      <Text style={{ color: th.text, fontWeight: '800' }}>{(first && r.cells[first.id]) || tl('Senza nome')}</Text>
      {cols.slice(1).filter((x) => r.cells[x.id]).map((x) => <Text key={x.id} style={{ color: th.muted, fontSize: 12, marginTop: 3 }}>{`${x.name}: ${x.kind === 'status' ? tl(r.cells[x.id]!) : r.cells[x.id]}`}</Text>)}
    </Pressable>
  );
  return (
    <View style={{ gap: 12 }}>
      <View style={{ backgroundColor: th.accent + '14', borderRadius: 16, padding: 12, gap: 4 }}>
        <Text style={{ color: th.text, fontWeight: '800', fontSize: 14 }}>{allRows.length ? tl('Come si usa questo database') : tl('Un database vuoto: iniziamo')}</Text>
        <Text style={{ color: th.muted, fontSize: 13, lineHeight: 19 }}>{allRows.length ? tl('Scrivi nelle celle per cambiare un dato. Tocca lo stato per passare a Da fare, In corso o Fatto. In alto scegli come vederlo: Tabella, Kanban, Calendario (serve una colonna Data) o Galleria.') : tl('1) Premi «Nuova riga» in fondo: ogni riga è una voce (un compito, un libro…). 2) Scrivi il nome nella prima cella. 3) Cambia vista in alto: Tabella, Kanban (colonne per stato), Calendario o Galleria.')}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', backgroundColor: th.card, borderRadius: 14, padding: 3, borderWidth: 1, borderColor: th.border }}>
          {VIEWS.map((x) => <Pressable key={x.v} onPress={() => ws.patch(page.id, { view: x.v })} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 11, backgroundColor: view === x.v ? th.text : 'transparent' }}><Text style={{ color: view === x.v ? th.onText : th.muted, fontWeight: '800', fontSize: 13 }}>{tl(x.l)}</Text></Pressable>)}
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Pressable onPress={() => setFOpen(!fOpen)} accessibilityRole="button" style={chip(!!page.flt?.v)}><Text style={{ color: th.text, fontWeight: '700', fontSize: 12 }}>{page.flt?.v ? `${tl('Filtro')}: ${page.flt.v}` : tl('Filtra')}</Text></Pressable>
        {cols.map((x) => <Pressable key={x.id} onPress={() => sortBy(x.id)} accessibilityRole="button" style={chip(page.srt?.col === x.id)}><Text style={{ color: th.text, fontWeight: '700', fontSize: 12 }}>{`${x.name}${page.srt?.col === x.id ? (page.srt.dir === 1 ? ' ↑' : ' ↓') : ''}`}</Text></Pressable>)}
        {page.flt?.v || page.srt ? <Pressable onPress={() => ws.patch(page.id, { flt: null, srt: null })} hitSlop={8}><Text style={{ color: th.accent, fontWeight: '800', fontSize: 12 }}>{tl('Azzera')}</Text></Pressable> : null}
      </View>
      {fOpen ? (
        <View style={{ backgroundColor: th.card, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 10, gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{cols.map((x) => <Pressable key={x.id} onPress={() => setFlt({ col: x.id })} style={chip(flt.col === x.id)}><Text style={{ color: th.text, fontSize: 12, fontWeight: '700' }}>{x.name}</Text></Pressable>)}</ScrollView>
          <View style={{ flexDirection: 'row', gap: 6 }}>{OPS.map((o) => <Pressable key={o.op} onPress={() => setFlt({ op: o.op })} style={chip(flt.op === o.op)}><Text style={{ color: th.text, fontSize: 12, fontWeight: '700' }}>{tl(o.label)}</Text></Pressable>)}</View>
          <Input value={flt.v} onChangeText={(v) => setFlt({ v })} placeholder={tl('Valore')} style={{ marginBottom: 0 }} />
        </View>
      ) : null}
      {view === 'kanban' && status && first ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {STATUSES.map((s) => { const col = rows.filter((r) => (r.cells[status.id] || STATUSES[0]) === s); return (
            <View key={s} style={{ width: 220, backgroundColor: th.card, borderRadius: 18, padding: 10, gap: 8, borderWidth: 1, borderColor: th.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: SC[s] }} /><Text style={{ color: th.text, fontWeight: '800' }}>{tl(s)}</Text><Text style={{ color: th.muted }}>{col.length}</Text></View>
              {col.map((r) => <Pressable key={r.id} onPress={() => ws.patchRow(page.id, r.id, status.id, next(r.cells[status.id] || STATUSES[0]))} style={{ backgroundColor: th.bg, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: th.border }}><Text style={{ color: th.text, fontWeight: '700' }}>{r.cells[first.id] || tl('Senza nome')}</Text><Text style={{ color: th.muted, fontSize: 11, marginTop: 4 }}>{tl('Tocca per spostare')}</Text></Pressable>)}
            </View>
          ); })}
        </ScrollView>
      ) : view === 'calendar' ? (
        <View style={{ gap: 10 }}>
          {!dateCol ? <Text style={{ color: th.muted }}>{tl('Per il calendario serve una colonna Data: aggiungila qui sotto.')}</Text> : null}
          {cal.days.map((d) => (
            <View key={d.key} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 54, alignItems: 'center', backgroundColor: th.card, borderRadius: 14, borderWidth: 1, borderColor: th.border, paddingVertical: 8, alignSelf: 'flex-start' }}>
                <Text style={{ color: th.accent, fontWeight: '800', fontSize: 11 }}>{new Date(d.key).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text>
                <Text style={{ color: th.text, fontWeight: '800', fontSize: 20 }}>{new Date(d.key).getDate()}</Text>
                <Text style={{ color: th.muted, fontSize: 10 }}>{new Date(d.key).toLocaleDateString(undefined, { weekday: 'short' })}</Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>{d.rows.map((r) => card(r))}</View>
            </View>
          ))}
          {cal.undated.length ? <><Text style={{ color: th.muted, fontWeight: '800', fontSize: 12 }}>{tl('Senza data')}</Text>{cal.undated.map((r) => card(r))}</> : null}
        </View>
      ) : view === 'gallery' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{rows.map((r) => card(r, 160))}</View>
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
      {rows.length < allRows.length ? <Text style={{ color: th.muted, fontSize: 12 }}>{tl('{0} righe su {1} (filtro attivo)', String(rows.length), String(allRows.length))}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn small icon="plus" title={tl('Nuova riga')} onPress={() => { ws.addRow(page.id); toast(tl('Riga aggiunta')); }} />
        <Input value={colName} onChangeText={setColName} placeholder={tl('Nuova colonna')} style={{ width: 130, marginBottom: 0 }} />
        {(['text', 'number', 'date'] as const).map((k) => <Btn key={k} small ghost disabled={!colName.trim()} title={k === 'text' ? tl('Testo') : k === 'number' ? tl('Numero') : tl('Data')} onPress={() => { ws.addCol(page.id, colName, k); setColName(''); }} />)}
      </View>
    </View>
  );
}
