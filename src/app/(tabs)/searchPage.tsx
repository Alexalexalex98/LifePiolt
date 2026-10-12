import React, { useEffect, useState } from 'react';

import { Text } from '@/components/T';
import { Body, Card, Input, Item, Page, Tag } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { go } from '@/lib/nav';
import { parseHighlight, searchAll, stripHighlight, type SearchHit, type SearchType } from '@/lib/search';

const GROUPS: { type: SearchType; label: string; max: number }[] = [
  { type: 'note', label: 'Note', max: 20 },
  { type: 'task', label: 'Task', max: 20 },
  { type: 'goal', label: 'Obiettivi', max: 10 },
  { type: 'event', label: 'Impegni', max: 10 },
  { type: 'chat', label: 'Chat', max: 8 },
  { type: 'bill', label: 'Bollette', max: 10 },
  { type: 'idea', label: 'Idee', max: 20 },
  { type: 'post', label: 'Post', max: 8 },
  { type: 'file', label: 'File', max: 20 },
];

function open(h: SearchHit) {
  switch (h.type) {
    case 'note': return go('noteedit', { id: h.id });
    case 'task': case 'goal': return go('lifetask');
    case 'event': return go('plan');
    case 'chat': return go('conversationPage', { id: h.id.split('@@')[0] });
    case 'bill': return go('billDetail', { id: h.id });
    case 'idea': return go('ideaProfile', { id: h.id });
    case 'post': return go('lifenetwork');
    case 'file': return go('lifedrive');
  }
}

/** Testo con i termini trovati in grassetto. */
function Marked({ s }: { s: string }) {
  return <>{parseHighlight(s).map((p, i) => (p.hit ? <Text key={i} style={{ fontWeight: '700' }}>{p.text}</Text> : p.text))}</>;
}

export default function Search() {
  const t = useTheme();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const s = q.trim().toLowerCase();

  useEffect(() => {
    if (s.length < 2) { setHits(null); return; }
    let alive = true;
    const h = setTimeout(() => { void searchAll(s, { limit: 120 }).then((r) => { if (alive) setHits(r); }).catch(() => { if (alive) setHits([]); }); }, 120);
    return () => { alive = false; clearTimeout(h); };
  }, [s]);

  const groups = GROUPS.map((g) => ({ ...g, rows: (hits ?? []).filter((h) => h.type === g.type).slice(0, g.max) })).filter((g) => g.rows.length);
  return (
    <Page id="searchPage" title="Cerca" back>
      <Input autoFocus placeholder="Cerca note, task, idee, post, file…" value={q} onChangeText={setQ} />
      {s.length < 2 ? <Body small muted>Scrivi almeno 2 caratteri per cercare in note, task, obiettivi, impegni, chat, bollette, idee, post e file.</Body> : hits === null ? null : groups.length === 0 ? <Body small muted>Nessun risultato per "{s}".</Body> : groups.map((g) => (
        <React.Fragment key={g.type}>
          <Tag>{g.label}</Tag>
          <Card>{g.rows.map((r, i) => (
            <Item key={r.id + i} last={i === g.rows.length - 1} onPress={() => open(r)}>
              <Body><Marked s={r.title} /></Body>
              {r.snippet && g.type !== 'task' && g.type !== 'goal' && g.type !== 'file' && !stripHighlight(r.snippet).startsWith(stripHighlight(r.title).slice(0, 15)) ? <Text numberOfLines={2} style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}><Marked s={r.snippet} /></Text> : null}
            </Item>
          ))}</Card>
        </React.Fragment>
      ))}
    </Page>
  );
}
