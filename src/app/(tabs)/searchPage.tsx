import React, { useState } from 'react';

import { Body, Card, Input, Item, Page, Tag } from '@/components/ui';
import { go } from '@/lib/nav';
import { noteTitle } from '@/lib/notes';
import { useLife } from '@/store/life';
import { useNet } from '@/store/network';

export default function Search() {
  const { notes, tasks, drive } = useLife();
  const { ideas, posts } = useNet();
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const groups: { label: string; rows: { text: string; on: () => void }[] }[] = [];
  if (s.length >= 2) {
    const nh = notes.filter((n) => n.text.toLowerCase().includes(s));
    if (nh.length) groups.push({ label: 'Note', rows: nh.map((n) => ({ text: noteTitle(n.text), on: () => go('noteedit', { id: n.id }) })) });
    const th = tasks.filter((t) => t.t.toLowerCase().includes(s));
    if (th.length) groups.push({ label: 'Task', rows: th.map((t) => ({ text: t.t, on: () => go('lifetask') })) });
    const ih = ideas.filter((i) => i.title.toLowerCase().includes(s) || i.desc.toLowerCase().includes(s));
    if (ih.length) groups.push({ label: 'Idee', rows: ih.map((i) => ({ text: i.title, on: () => go('ideaProfile', { id: String(i.id) }) })) });
    const ph = posts.filter((p) => p.text.toLowerCase().includes(s) || p.author.toLowerCase().includes(s));
    if (ph.length) groups.push({ label: 'Post', rows: ph.slice(0, 8).map((p) => ({ text: `${p.author}: ${p.text}`, on: () => go('lifenetwork') })) });
    const fh = drive.filter((f) => f.n.toLowerCase().includes(s));
    if (fh.length) groups.push({ label: 'File', rows: fh.map((f) => ({ text: f.n, on: () => go('lifedrive') })) });
  }
  return (
    <Page id="searchPage" title="Cerca" back>
      <Input autoFocus placeholder="Cerca note, task, idee, post, file…" value={q} onChangeText={setQ} />
      {s.length < 2 ? <Body small muted>Scrivi almeno 2 caratteri per cercare in note, task, idee, post e file.</Body> : groups.length === 0 ? <Body small muted>Nessun risultato per "{s}".</Body> : groups.map((g) => (
        <React.Fragment key={g.label}>
          <Tag>{g.label}</Tag>
          <Card>{g.rows.map((r, i) => <Item key={i} last={i === g.rows.length - 1} onPress={r.on}><Body>{r.text}</Body></Item>)}</Card>
        </React.Fragment>
      ))}
    </Page>
  );
}
