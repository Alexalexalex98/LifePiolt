import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/T';
import { NoWorkspace } from '@/components/work/NoWorkspace';
import { Body, Btn, Card, ChipBtn, Empty, H, Pill, Row, Sheet } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { go } from '@/lib/nav';
import { loadPeople, setPosition, setRole, useCaps } from '@/lib/teamPeople';
import { AREA_LABELS, CAP_LABELS, POSITIONS, byArea, positionOf, type Cap, type Position } from '@/lib/workRoles';
import { usePeople, type Person } from '@/store/people';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';
import { useWork } from '@/store/work';

const ROLE_TEXT = { owner: 'Proprietario', admin: 'Amministratore', member: '' } as const;

/** Persone, posizioni e responsabilità del workspace: chi fa che cosa, a chi risponde, che cosa può vedere e fare. */
export function People() {
  const teams = useTeams((s) => s.teams);
  const active = useWork((s) => s.active);
  const team = teams.find((x) => x.id === active) ?? teams[0];
  const people = usePeople((s) => (team ? s.people[team.id] : undefined)) ?? [];
  const me = usePeople((s) => s.me);
  const { caps, role, position } = useCaps(team?.id);
  const [edit, setEdit] = useState<Person | null>(null);
  const [info, setInfo] = useState<Position | null>(null);
  const [catalog, setCatalog] = useState(false);
  useEffect(() => { if (team) void loadPeople(team.id); }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const nameOf = (id: string | null) => people.find((p) => p.user_id === id)?.name || tl('Collega');
  const mine = positionOf(position);
  const tree = useMemo(() => {
    const ids = new Set(people.map((p) => p.user_id));
    const kids = (parent: string | null) => people.filter((p) => (p.reports_to && ids.has(p.reports_to) ? p.reports_to : null) === parent);
    const out: { p: Person; depth: number }[] = [];
    const walk = (parent: string | null, depth: number, seen: Set<string>) => { for (const p of kids(parent)) { if (seen.has(p.user_id)) continue; seen.add(p.user_id); out.push({ p, depth }); walk(p.user_id, depth + 1, seen); } };
    walk(null, 0, new Set());
    return out;
  }, [people]);
  if (!team) return <NoWorkspace />;
  const canManage = caps.has('members.manage');

  return (
    <View style={{ gap: 14 }}>
      {teams.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{teams.map((x) => <Pill key={x.id} label={x.name} on={x.id === team.id} onPress={() => useWork.getState().set({ active: x.id })} />)}</View> : null}

      <Card>
        <H>Il mio ruolo</H>
        {mine ? (
          <>
            <Body bold style={{ marginTop: 4 }}>{tl(mine.label)}{role === 'owner' || role === 'admin' ? ` · ${tl(ROLE_TEXT[role])}` : ''}</Body>
            <Body small muted>{tl(mine.summary)}</Body>
            <Detail pos={mine} />
          </>
        ) : <Body small muted style={{ marginTop: 4 }}>{role === 'owner' || role === 'admin' ? tl('Sei {0} del workspace: puoi vedere e fare tutto.', tl(ROLE_TEXT[role]).toLowerCase()) : tl('Non hai ancora una posizione. La assegna chi gestisce le persone (per esempio HR o la direzione).')}</Body>}
        <Body small bold muted style={{ marginTop: 10 }}>{tl('CHE COSA PUOI FARE').toUpperCase()}</Body>
        {[...caps].map((c) => <Body key={c} small style={{ marginTop: 2 }}>{`• ${tl(CAP_LABELS[c])}`}</Body>)}
        {caps.size === 0 ? <Body small muted style={{ marginTop: 2 }}>{tl('Lavori sui tuoi task e partecipi alle riunioni e alle chat dei progetti.')}</Body> : null}
      </Card>

      <Card>
        <Row><H>Persone</H><Btn small ghost icon="plus" title="Invita" onPress={() => go('teams')} /></Row>
        {people.length === 0 ? <Empty text="Nessuna persona caricata." /> : tree.map(({ p, depth }) => {
          const pos = positionOf(p.position);
          return (
            <View key={p.user_id} style={{ paddingVertical: 8, paddingStart: depth * 16 }}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Body bold>{p.user_id === me ? `${p.name || tl('Tu')} (${tl('tu')})` : p.name || tl('Collega')}</Body>
                  <Body small muted>{[pos ? tl(pos.label) : tl('Senza posizione'), ROLE_TEXT[p.role] ? tl(ROLE_TEXT[p.role]) : '', p.reports_to ? tl('risponde a {0}', nameOf(p.reports_to)) : ''].filter(Boolean).join(' · ')}</Body>
                </View>
                {pos ? <ChipBtn icon="note" title="Cosa fa" onPress={() => setInfo(pos)} /> : null}
                {canManage && (p.role === 'member' || role === 'owner' || role === 'admin') ? <ChipBtn icon="edit" title="Modifica" onPress={() => setEdit(p)} /> : null}
              </Row>
            </View>
          );
        })}
      </Card>

      <Card>
        <Row><View style={{ flex: 1 }}><H>Catalogo delle posizioni</H><Body small muted>{tl('Tutte le posizioni di un lavoro d\'ufficio, con funzioni e responsabilità.')}</Body></View><Btn small ghost title={catalog ? 'Chiudi' : 'Apri'} onPress={() => setCatalog(!catalog)} /></Row>
        {catalog ? byArea().map((g) => (
          <View key={g.area} style={{ marginTop: 10 }}>
            <Body small bold muted>{tl(AREA_LABELS[g.area]).toUpperCase()}</Body>
            {g.list.map((p) => <Btn key={p.id} ghost style={{ marginTop: 6 }} title={tl(p.label)} onPress={() => setInfo(p)} />)}
          </View>
        )) : null}
      </Card>

      <Sheet visible={!!info} title={info ? tl(info.label) : ''} onClose={() => setInfo(null)}>
        {info ? (
          <>
            <Body small muted>{tl(AREA_LABELS[info.area])}</Body>
            <Body style={{ marginTop: 6 }}>{tl(info.summary)}</Body>
            <Detail pos={info} />
            <Body small bold muted style={{ marginTop: 10 }}>{tl('PERMESSI').toUpperCase()}</Body>
            {info.caps.length ? info.caps.map((c: Cap) => <Body key={c} small style={{ marginTop: 2 }}>{`• ${tl(CAP_LABELS[c])}`}</Body>) : <Body small muted style={{ marginTop: 2 }}>{tl('Nessun permesso speciale.')}</Body>}
          </>
        ) : null}
      </Sheet>
      {edit ? <EditPerson team={team.id} person={edit} people={people} myRole={role} onClose={() => setEdit(null)} /> : null}
    </View>
  );
}

function Detail({ pos }: { pos: Position }) {
  return (
    <View>
      <Body small bold muted style={{ marginTop: 10 }}>{tl('FUNZIONI').toUpperCase()}</Body>
      {pos.duties.map((d) => <Body key={d} small style={{ marginTop: 2 }}>{`• ${tl(d)}`}</Body>)}
      <Body small bold muted style={{ marginTop: 10 }}>{tl('RESPONSABILITÀ').toUpperCase()}</Body>
      {pos.responsible.map((d) => <Body key={d} small style={{ marginTop: 2 }}>{`• ${tl(d)}`}</Body>)}
    </View>
  );
}

function EditPerson({ team, person, people, myRole, onClose }: { team: string; person: Person; people: Person[]; myRole: 'owner' | 'admin' | 'member' | undefined; onClose: () => void }) {
  const [pos, setPos] = useState<string | null>(person.position);
  const [boss, setBoss] = useState<string | null>(person.reports_to);
  const [area, setArea] = useState(positionOf(person.position)?.area ?? 'hr');
  const [busy, setBusy] = useState(false);
  const save = () => { setBusy(true); void setPosition(team, person.user_id, pos, boss).then((r) => { setBusy(false); if (r.ok) { toast('Salvato'); onClose(); } else toast(r.message); }); };
  return (
    <Sheet visible title={person.name || tl('Collega')} onClose={onClose}>
      <Body small bold muted style={{ marginBottom: 6 }}>{tl('AREA').toUpperCase()}</Body>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{byArea().map((g) => <Pill key={g.area} label={tl(AREA_LABELS[g.area])} on={area === g.area} onPress={() => setArea(g.area)} />)}</ScrollView>
      <Body small bold muted style={{ marginTop: 10, marginBottom: 6 }}>{tl('POSIZIONE').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Pill label={tl('Nessuna')} on={pos === null} onPress={() => setPos(null)} />
        {POSITIONS.filter((p) => p.area === area).map((p) => <Pill key={p.id} label={tl(p.label)} on={pos === p.id} onPress={() => setPos(p.id)} />)}
      </View>
      {pos ? <Text style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>{tl(positionOf(pos)?.summary ?? '')}</Text> : null}
      <Body small bold muted style={{ marginTop: 10, marginBottom: 6 }}>{tl('RISPONDE A').toUpperCase()}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Pill label={tl('Nessuno')} on={boss === null} onPress={() => setBoss(null)} />
        {people.filter((p) => p.user_id !== person.user_id).map((p) => <Pill key={p.user_id} label={p.name || tl('Collega')} on={boss === p.user_id} onPress={() => setBoss(p.user_id)} />)}
      </View>
      <Btn style={{ marginTop: 12 }} icon="check" disabled={busy} title={busy ? 'Un momento…' : 'Salva'} onPress={save} />
      {myRole === 'owner' && person.role !== 'owner' ? (
        <Btn style={{ marginTop: 8 }} ghost title={person.role === 'admin' ? 'Togli il ruolo di amministratore' : 'Rendi amministratore'} onPress={() => { void setRole(team, person.user_id, person.role === 'admin' ? 'member' : 'admin').then((r) => { toast(r.ok ? 'Ruolo cambiato' : r.message); if (r.ok) onClose(); }); }} />
      ) : null}
    </Sheet>
  );
}
