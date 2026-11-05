import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Mascot } from '@/components/mascot/Mascot';
import { Text } from '@/components/T';
import { Database } from '@/components/workspace/Database';
import { PageBlocks } from '@/components/workspace/PageBlocks';
import { WorkChat } from '@/components/workspace/WorkChat';
import { Crm } from '@/components/work/Crm';
import { Hr } from '@/components/work/Hr';
import { KIND_LABEL, searchItems } from '@/lib/workSearch';
import { collectSearchItems } from '@/lib/workSearchData';
import { Career } from '@/components/work/Career';
import { Company } from '@/components/work/Company';
import { useCompany } from '@/store/company';
import { Legal } from '@/components/work/Legal';
import { Trips } from '@/components/work/Trips';
import { WorkWell } from '@/components/work/WorkWell';
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

type Tab = 'pagine' | 'piano' | 'task' | 'clienti' | 'report' | 'legale' | 'benessere' | 'carriera' | 'trasferte' | 'azienda' | 'scrivi' | 'soldi' | 'hr' | 'messaggi' | 'documenti' | 'persone' | 'file' | 'theia';
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
  const lockedCount = useCompany((c) => Object.values(c.locked).flat().filter((l) => !l.unlocked).length);
  const docHits = useMemo(() => { const n = q.trim().toLowerCase(); if (n.length < 2) return []; return Object.values(allDocs).flat().filter((d) => `${d.title} ${Object.values(d.fields).join(' ')} ${d.file_name}`.toLowerCase().includes(n)).slice(0, 6); }, [q, allDocs]);
  const others = useMemo(() => (q.trim().length >= 2 ? searchItems(q, collectSearchItems(), 12).filter((x) => x.kind !== 'page' && x.kind !== 'doc') : []), [q, pages, allDocs]);
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
          {others.map((o) => (
            <Pressable key={o.kind + o.id} onPress={() => { setTab(o.tab as Tab); setQ(''); }} accessibilityRole="button" style={{ backgroundColor: th.card, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 12 }}>
              <Text numberOfLines={1} style={{ color: th.text, fontWeight: '800' }}>{o.title}</Text>
              <Text numberOfLines={2} style={{ color: th.muted, fontSize: 12.5, marginTop: 4 }}>{`${tl(KIND_LABEL[o.kind])}${o.sub ? ` · ${o.sub}` : ''}${o.snippet ? ` · …${o.snippet}…` : ''}`}</Text>
            </Pressable>
          ))}
          {hits.length ? hits.map((h) => (
            <Pressable key={h.kind + h.id} onPress={h.kind === 'page' ? () => onOpen(h.id) : () => setTab('file')} style={{ backgroundColor: th.card, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name={h.kind === 'page' ? 'note' : 'file'} size={16} color={th.accent} /><Text numberOfLines={1} style={{ color: th.text, fontWeight: '800', flex: 1 }}>{h.title}</Text></View>
              {h.snippet ? <Text numberOfLines={2} style={{ color: th.muted, fontSize: 12.5, marginTop: 4 }}>{`…${h.snippet}…`}</Text> : null}
            </Pressable>
          )) : docHits.length || others.length ? null : <Body small muted>{tl('Niente trovato.')}</Body>}
          {docHits.map((d) => (
            <Pressable key={'doc' + d.id} onPress={() => { setTab('documenti'); setQ(''); }} accessibilityRole="button" style={{ backgroundColor: th.card, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="file" size={16} color={th.accent} /><Text numberOfLines={1} style={{ color: th.text, fontWeight: '800', flex: 1 }}>{d.title}</Text></View>
              <Text numberOfLines={1} style={{ color: th.muted, fontSize: 12.5, marginTop: 4 }}>{tl('Documento')} · {d.file_name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ backgroundColor: th.card, borderRadius: 16, padding: 4, gap: 2, marginTop: 12, marginBottom: 12, borderWidth: 1, borderColor: th.border }} style={{ flexGrow: 0 }}>
        {([['theia', 'Theia', 'sparkle'], ['pagine', 'Pagine', 'note'], ['piano', 'Piano', 'calendar'], ['task', 'Task', 'check'], ['clienti', 'Clienti', 'contact'], ['soldi', 'Soldi', 'wallet'], ['hr', 'HR', 'profile'], ['report', 'Report', 'chart'], ['legale', 'Legale', 'note'], ['benessere', 'Benessere', 'heart'], ['carriera', 'Carriera', 'chart'], ['trasferte', 'Trasferte', 'lifetravel'], ['azienda', 'Azienda', 'lock'], ['scrivi', 'Scrivi', 'edit'], ['messaggi', 'Messaggi', 'comment'], ['documenti', 'Documenti', 'note'], ['persone', 'Persone', 'users'], ['file', 'File', 'file']] as const).map(([id, l, ic]) => (
          <Pressable key={id} onPress={() => { setTab(id); if (id === 'theia') setChatOpen(true); }} accessibilityRole="button" accessibilityState={{ selected: tab === id }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: tab === id ? th.text : 'transparent' }}>
            <Icon name={ic} size={15} color={tab === id ? th.onText : th.muted} stroke={2.2} /><Text style={{ color: tab === id ? th.onText : th.muted, fontWeight: '800', fontSize: 13 }}>{tl(l)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab === 'pagine' ? (
        <View style={{ gap: 14 }}>
          {lockedCount ? <Pressable onPress={() => setTab('azienda')} accessibilityRole="button" style={{ backgroundColor: th.card, borderRadius: 16, borderWidth: 1, borderColor: th.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="lock" size={18} color={th.accent} /><Text style={{ color: th.text, flex: 1, fontWeight: '700' }}>{tl('{0} progetti riservati: serve la password', lockedCount)}</Text><Icon name="chevron-right" size={18} color={th.muted} /></Pressable> : null}
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
      {tab === 'hr' ? <Hr /> : null}
      {tab === 'legale' ? <Legal /> : null}
      {tab === 'benessere' ? <WorkWell /> : null}
      {tab === 'carriera' ? <Career /> : null}
      {tab === 'trasferte' ? <Trips /> : null}
      {tab === 'azienda' ? <Company /> : null}
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
      <LinearGradient colors={[c + '77', c + '12']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 64, borderRadius: 20 }} />
      <View style={{ marginTop: -40, paddingHorizontal: 6 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: th.card, borderWidth: 2, borderColor: th.bg, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: c + '33', alignItems: 'center', justifyContent: 'center' }}><Icon name={page.kind === 'db' ? 'chart' : 'note'} size={26} color={c} stroke={2} /></View></View>
        {crumbs.length ? <Text style={{ color: th.muted, fontSize: 12, marginTop: 8 }}>{crumbs.map((x) => x.title || '…').join('  ›  ')}</Text> : null}
        <Input value={page.title} onChangeText={(v) => ws.patch(page.id, { title: v })} placeholder={tl('Pagina senza titolo')} style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.4, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0 }} />
        <Text style={{ color: th.muted, fontSize: 12, marginTop: -4 }}>{`${teamName ? `${tl('Condivisa con {0}', teamName)} · ` : ''}${tl('modificata {0}', ago(page.updatedAt))}`}</Text>
      </View>

      {page.kind === 'db' ? <Database page={page} /> : <PageBlocks page={page} accent={c} onMenu={setMenu} />}

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

