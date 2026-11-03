import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Mascot } from '@/components/mascot/Mascot';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Item, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { fmtBytes } from '@/lib/attachments';
import { confirmDelete } from '@/lib/confirm';
import { persistFile } from '@/lib/chatMedia';
import { weekdayShortDate } from '@/lib/format';
import { WORKSPACE_FOLDER, askWorkspace, searchWorkspace, workspaceFiles, type SearchHit } from '@/lib/workspaceAi';
import { STATUSES, childrenOf, pathOf, slashCommand, useWorkspace, type BlockType, type WsPage } from '@/store/workspace';
import { useWorkspaceChat } from '@/store/workspaceChat';
import { useLife } from '@/store/life';
import { useTeams } from '@/store/teams';
import { deleteSharedPage } from '@/lib/teamSync';
import { toast } from '@/store/toast';

type Tab = 'pagine' | 'file' | 'assistente';
const BLOCKS: { t: BlockType; label: string }[] = [{ t: 'p', label: 'Testo' }, { t: 'h', label: 'Titolo' }, { t: 'todo', label: 'Da fare' }, { t: 'bullet', label: 'Elenco' }, { t: 'quote', label: 'Citazione' }, { t: 'divider', label: 'Linea' }];

/** LifeWorkspace: pagine annidate con blocchi e comandi «/», database (tabella, kanban), commenti, file, ricerca e un assistente AI separato da Theia. */
export default function Workspace() {
  const [open, setOpen] = useState<string | null>(null);
  const pages = useWorkspace((s) => s.pages);
  const page = pages.find((p) => p.id === open) ?? null;
  if (page) return <PageView page={page} onOpen={setOpen} onBack={() => setOpen(page.parent)} />;
  return <Home onOpen={setOpen} />;
}

function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const th = useTheme();
  const pages = useWorkspace((s) => s.pages);
  const { addPage } = useWorkspace.getState();
  const [tab, setTab] = useState<Tab>('pagine');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  useEffect(() => { let on = true; const h = setTimeout(() => { void searchWorkspace(q).then((r) => { if (on) setHits(r); }); }, 250); return () => { on = false; clearTimeout(h); }; }, [q, pages]);
  const teams = useTeams((s) => s.teams);
  const teamName = (id: string) => teams.find((x) => x.id === id)?.name ?? tl('Team');
  const roots = childrenOf(pages, null);
  const node = (p: WsPage, depth: number): React.ReactNode => (
    <View key={p.id}>
      <Item onPress={() => onOpen(p.id)}><Row gap={8} style={{ justifyContent: 'flex-start', paddingStart: depth * 16 }}><Text style={{ color: th.muted }}>{p.kind === 'db' ? '▦' : '▸'}</Text><Body bold={depth === 0}>{p.title || tl('Pagina senza titolo')}</Body>{p.teamId ? <Text style={{ color: th.accent, fontSize: 12 }}>{`  ${teamName(p.teamId)}`}</Text> : null}</Row></Item>
      {childrenOf(pages, p.id).map((c) => node(c, depth + 1))}
    </View>
  );
  return (
    <Page id="workspace" title="LifeWorkspace" back>
      <Input value={q} onChangeText={setQ} placeholder={tl('Cerca in pagine, database e file')} />
      {q.trim().length >= 2 ? (
        <Card>
          <H>{tl('Risultati')}</H>
          {hits.length ? hits.map((h, i) => <Item key={h.kind + h.id} last={i === hits.length - 1} onPress={h.kind === 'page' ? () => onOpen(h.id) : () => setTab('file')}><Body bold>{h.title}</Body>{h.snippet ? <Body small muted numberOfLines={2}>{`…${h.snippet}…`}</Body> : null}<Body small muted>{h.kind === 'page' ? tl('Pagina') : tl('File')}</Body></Item>) : <Body small muted>{tl('Niente trovato.')}</Body>}
        </Card>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {([['pagine', 'Pagine'], ['file', 'File'], ['assistente', 'Theia Lavoro']] as const).map(([id, l]) => <Pill key={id} label={tl(l)} on={tab === id} onPress={() => setTab(id)} />)}
      </ScrollView>
      {tab === 'pagine' ? (
        <Card>
          <Row gap={8} style={{ justifyContent: 'flex-start', marginBottom: 8 }}>
            <Btn small icon="plus" title={tl('Nuova pagina')} onPress={() => onOpen(addPage(null))} />
            <Btn small ghost title={tl('Nuovo database')} onPress={() => onOpen(addPage(null, 'db', tl('Nuovo database')))} />
          </Row>
          {teams.length ? <Row gap={8} style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 8 }}>{teams.map((x) => <Pill key={x.id} label={tl('+ Pagina condivisa: {0}', x.name)} onPress={() => onOpen(addPage(null, 'page', '', x.id))} />)}</Row> : null}
          {roots.length ? roots.map((p) => node(p, 0)) : <Empty text={tl('Nessuna pagina ancora: creane una, anche per il wiki della tua azienda.')} />}
        </Card>
      ) : null}
      {tab === 'file' ? <Files /> : null}
      {tab === 'assistente' ? <Assistant /> : null}
    </Page>
  );
}

function Files({ pid }: { pid?: string }) {
  const life = useLife(); const ws = useWorkspace();
  useLife((s) => s.drive);
  const files = workspaceFiles();
  const upload = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
    if (r.canceled) return;
    for (const a of r.assets) {
      const uri = persistFile(a.uri, a.name);
      const id = Math.random().toString(36).slice(2, 10);
      life.addFile({ id, n: a.name, s: fmtBytes(a.size ?? 0) || '—', folder: WORKSPACE_FOLDER, date: weekdayShortDate(), uri, src: 'Workspace', tag: 'Workspace' });
      if (pid) ws.attach(pid, id);
    }
    toast(tl('File caricati nel workspace'));
  };
  const others = life.drive.filter((f) => f.folder !== WORKSPACE_FOLDER && !ws.pages.some((p) => p.files.includes(f.id)) && !f.photo).slice(0, 12);
  return (
    <Card>
      <H>{tl('File del workspace')}</H>
      <Body small muted style={{ marginBottom: 8 }}>{tl('Qui trovi tutti i file caricati: li puoi cercare e chiedere all\'assistente. Restano su LifeDrive, nella cartella «Workspace».')}</Body>
      <Btn small icon="plus" title={tl('Carica file')} onPress={() => void upload()} />
      {files.length ? files.map((f, i) => <Item key={f.id} last={i === files.length - 1}><Row><View style={{ flex: 1 }}><Body bold numberOfLines={1}>{f.n}</Body><Body small muted>{`${f.s} · ${f.date}`}</Body></View>{pid ? <Btn small ghost title={ws.pages.find((p) => p.id === pid)?.files.includes(f.id) ? tl('Scollega') : tl('Collega')} onPress={() => (ws.pages.find((p) => p.id === pid)?.files.includes(f.id) ? ws.detach(pid, f.id) : ws.attach(pid, f.id))} /> : null}</Row></Item>) : <Empty text={tl('Nessun file ancora.')} />}
      {pid && others.length ? (<><Body small muted style={{ marginTop: 10 }}>{tl('Da LifeDrive:')}</Body>{others.map((f) => <Item key={f.id}><Row><Body numberOfLines={1} style={{ flex: 1 }}>{f.n}</Body><Btn small ghost title={tl('Collega')} onPress={() => ws.attach(pid, f.id)} /></Row></Item>)}</>) : null}
    </Card>
  );
}

function Assistant() {
  const th = useTheme();
  const log = useWorkspaceChat((s) => s.log);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  const send = async () => { const q = text.trim(); if (!q || busy) return; setText(''); setBusy(true); await askWorkspace(q); setBusy(false); };
  return (
    <Card>
      <Row gap={10} style={{ justifyContent: 'flex-start' }}><Mascot size={44} color={th.accent} expression="happy" /><H>{tl('Theia Lavoro')}</H></Row>
      <Body small muted style={{ marginBottom: 8 }}>{tl('È Theia, in versione lavoro: legge tutte le pagine, i database e i file del workspace e dei tuoi team, e risponde citando la fonte. È separata dalla Theia personale: non vede la tua vita privata, non scrive nella sua memoria e riceve solo i brani che servono, dopo il tuo permesso.')}</Body>
      {log.map((m) => (
        <View key={m.id} style={{ alignSelf: m.who === 'me' ? 'flex-end' : 'flex-start', maxWidth: '90%', backgroundColor: m.who === 'me' ? th.accent + '33' : th.tile, borderRadius: 14, padding: 10, marginBottom: 8 }}>
          <Body>{m.text}</Body>{m.sources?.length ? <Body small muted style={{ marginTop: 4 }}>{tl('Fonti: {0}', m.sources.join(', '))}</Body> : null}
        </View>
      ))}
      <Input value={text} onChangeText={setText} placeholder={tl('Chiedi a Theia Lavoro: file, numeri, decisioni…')} multiline maxLines={4} />
      <Row gap={8} style={{ justifyContent: 'flex-start' }}><Btn small icon="send" title={busy ? tl('Cerco…') : tl('Chiedi')} disabled={busy || !text.trim()} onPress={() => void send()} />{log.length ? <Btn small ghost title={tl('Svuota la chat')} onPress={() => useWorkspaceChat.getState().clear()} /> : null}</Row>
    </Card>
  );
}

function PageView({ page, onOpen, onBack }: { page: WsPage; onOpen: (id: string) => void; onBack: () => void }) {
  const th = useTheme();
  const ws = useWorkspace.getState();
  const pages = useWorkspace((s) => s.pages);
  const [menu, setMenu] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const subs = childrenOf(pages, page.id);
  const crumbs = useMemo(() => pathOf(pages, page.id).slice(0, -1), [pages, page.id]);
  const del = () => confirmDelete(tl('la pagina «{0}» e le sue sottopagine', page.title || tl('senza titolo')), () => { if (page.teamId) void deleteSharedPage(page.id); const gone = ws.remove(page.id); onBack(); return gone; }, () => undefined);
  const onText = (bid: string, v: string) => {
    const c = slashCommand(v);
    if (c) { ws.patchBlock(page.id, bid, { t: c.t, text: c.rest }); if (c.t === 'divider') ws.addBlock(page.id); } else ws.patchBlock(page.id, bid, { text: v });
  };
  return (
    <Page id="workspace" title={page.title || tl('Pagina senza titolo')} back onBack={onBack}>
      {page.teamId ? <Body small color={th.accent}>{tl('Pagina condivisa con il team «{0}»: le modifiche si vedono subito, per tutti.', useTeams.getState().teams.find((x) => x.id === page.teamId)?.name ?? '')}</Body> : null}
      {crumbs.length ? <Body small muted>{crumbs.map((c) => c.title || '…').join(' › ')}</Body> : null}
      <Input value={page.title} onChangeText={(v) => ws.patch(page.id, { title: v })} placeholder={tl('Titolo')} style={{ fontSize: 22, fontWeight: '800' }} />
      {page.kind === 'db' ? <Database page={page} /> : (
        <Card>
          {page.blocks.map((b) => b.t === 'divider' ? (
            <Pressable key={b.id} onLongPress={() => setMenu(b.id)} style={{ height: 1, backgroundColor: th.border, marginVertical: 10 }} />
          ) : (
            <Row key={b.id} gap={6} style={{ alignItems: 'flex-start' }}>
              {b.t === 'todo' ? <Pressable onPress={() => ws.patchBlock(page.id, b.id, { done: !b.done })} style={{ paddingTop: 12 }}><Text style={{ color: b.done ? th.positive : th.muted, fontSize: 18 }}>{b.done ? '☑' : '☐'}</Text></Pressable> : b.t === 'bullet' ? <Text style={{ color: th.muted, paddingTop: 12 }}>•</Text> : null}
              <Input value={b.text} onChangeText={(v) => onText(b.id, v)} multiline placeholder={b.t === 'p' ? tl('Scrivi, o «/» per un comando (titolo, todo, elenco…)') : ''} flex={1}
                style={{ borderWidth: 0, backgroundColor: 'transparent', fontSize: b.t === 'h' ? 20 : 15, fontWeight: b.t === 'h' ? '800' : '400', fontStyle: b.t === 'quote' ? 'italic' : 'normal', textDecorationLine: b.t === 'todo' && b.done ? 'line-through' : 'none' }} />
              <Pressable onPress={() => setMenu(b.id)} hitSlop={8} style={{ paddingTop: 12 }}><Text style={{ color: th.muted, fontSize: 18 }}>⋮</Text></Pressable>
            </Row>
          ))}
          <Row gap={8} style={{ justifyContent: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>{BLOCKS.slice(0, 4).map((x) => <Pill key={x.t} label={`+ ${tl(x.label)}`} onPress={() => ws.addBlock(page.id, x.t)} />)}</Row>
        </Card>
      )}
      <Card>
        <Row><H>{tl('Sottopagine')}</H><Btn small ghost icon="plus" title={tl('Aggiungi')} onPress={() => onOpen(ws.addPage(page.id))} /></Row>
        {subs.length ? subs.map((c, i) => <Item key={c.id} last={i === subs.length - 1} onPress={() => onOpen(c.id)}><Body>{`${c.kind === 'db' ? '▦' : '▸'}  ${c.title || tl('Pagina senza titolo')}`}</Body></Item>) : <Body small muted>{tl('Una pagina può contenere altre pagine, come cartelle.')}</Body>}
        <Btn small ghost style={{ marginTop: 6, alignSelf: 'flex-start' }} title={tl('Aggiungi un database')} onPress={() => onOpen(ws.addPage(page.id, 'db', tl('Nuovo database'), page.teamId))} />
      </Card>
      <Files pid={page.id} />
      <Card>
        <H>{tl('Commenti')}</H>
        {page.comments.map((c) => <Body key={c.id} small style={{ marginBottom: 6 }}>{`${new Date(c.ts).toLocaleDateString()} · ${c.text}`}</Body>)}
        <Input value={comment} onChangeText={setComment} placeholder={tl('Scrivi un commento')} />
        <Btn small ghost disabled={!comment.trim()} title={tl('Commenta')} onPress={() => { ws.addComment(page.id, comment); setComment(''); }} />
      </Card>
      <Btn ghost danger small title={tl('Elimina la pagina')} onPress={del} />
      <Sheet visible={!!menu} title={tl('Blocco')} onClose={() => setMenu(null)}>
        <Row gap={8} style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>{BLOCKS.map((x) => <Pill key={x.t} label={tl(x.label)} onPress={() => { if (menu) ws.patchBlock(page.id, menu, { t: x.t }); setMenu(null); }} />)}</Row>
        <Row gap={8} style={{ justifyContent: 'flex-start', marginTop: 12 }}>
          <Btn small ghost title={tl('Su')} onPress={() => { if (menu) ws.moveBlock(page.id, menu, -1); }} /><Btn small ghost title={tl('Giù')} onPress={() => { if (menu) ws.moveBlock(page.id, menu, 1); }} />
          <Btn small ghost danger title={tl('Elimina')} onPress={() => { if (menu) ws.delBlock(page.id, menu); setMenu(null); }} />
        </Row>
      </Sheet>
    </Page>
  );
}

function Database({ page }: { page: WsPage }) {
  const th = useTheme(); const ws = useWorkspace.getState();
  const [colName, setColName] = useState('');
  const cols = page.cols ?? []; const rows = page.rows ?? [];
  const status = cols.find((c) => c.kind === 'status');
  const first = cols[0];
  const next = (v: string | undefined) => STATUSES[(STATUSES.indexOf(v ?? '') + 1) % STATUSES.length]!;
  return (
    <Card>
      <Row gap={8} style={{ justifyContent: 'flex-start' }}>
        <Pill label={tl('Tabella')} on={page.view !== 'kanban'} onPress={() => ws.patch(page.id, { view: 'table' })} />
        <Pill label={tl('Kanban')} on={page.view === 'kanban'} onPress={() => ws.patch(page.id, { view: 'kanban' })} />
      </Row>
      {page.view === 'kanban' && status && first ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 10 }}>
          {STATUSES.map((s) => (
            <View key={s} style={{ width: 200, backgroundColor: th.tile, borderRadius: 12, padding: 8, gap: 6 }}>
              <Body bold>{`${tl(s)} · ${rows.filter((r) => (r.cells[status.id] || STATUSES[0]) === s).length}`}</Body>
              {rows.filter((r) => (r.cells[status.id] || STATUSES[0]) === s).map((r) => (
                <Pressable key={r.id} onPress={() => ws.patchRow(page.id, r.id, status.id, next(r.cells[status.id] || STATUSES[0]))} style={{ backgroundColor: th.card, borderRadius: 10, padding: 8 }}><Body>{r.cells[first.id] || tl('Senza nome')}</Body><Body small muted>{tl('Tocca per spostare')}</Body></Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ paddingVertical: 8 }}>
            <Row gap={6} style={{ justifyContent: 'flex-start' }}>{cols.map((c) => <View key={c.id} style={{ width: 130 }}><Body small bold muted>{c.name}</Body></View>)}</Row>
            {rows.map((r) => (
              <Row key={r.id} gap={6} style={{ justifyContent: 'flex-start' }}>
                {cols.map((c) => c.kind === 'status'
                  ? <View key={c.id} style={{ width: 130 }}><Pill label={tl(r.cells[c.id] || STATUSES[0]!)} onPress={() => ws.patchRow(page.id, r.id, c.id, next(r.cells[c.id] || STATUSES[0]))} /></View>
                  : <Input key={c.id} value={r.cells[c.id] ?? ''} onChangeText={(v) => ws.patchRow(page.id, r.id, c.id, v)} keyboardType={c.kind === 'number' ? 'decimal-pad' : 'default'} placeholder={c.kind === 'date' ? 'GG/MM/AAAA' : ''} style={{ width: 130, marginBottom: 4 }} />)}
                <Pressable onPress={() => ws.delRow(page.id, r.id)} hitSlop={8}><Text style={{ color: th.muted }}>✕</Text></Pressable>
              </Row>
            ))}
          </View>
        </ScrollView>
      )}
      <Row gap={8} style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <Btn small icon="plus" title={tl('Nuova riga')} onPress={() => ws.addRow(page.id)} />
        <Input value={colName} onChangeText={setColName} placeholder={tl('Nuova colonna')} style={{ width: 130, marginBottom: 0 }} />
        <Btn small ghost title={tl('Testo')} disabled={!colName.trim()} onPress={() => { ws.addCol(page.id, colName, 'text'); setColName(''); }} />
        <Btn small ghost title={tl('Numero')} disabled={!colName.trim()} onPress={() => { ws.addCol(page.id, colName, 'number'); setColName(''); }} />
        <Btn small ghost title={tl('Data')} disabled={!colName.trim()} onPress={() => { ws.addCol(page.id, colName, 'date'); setColName(''); }} />
      </Row>
    </Card>
  );
}
