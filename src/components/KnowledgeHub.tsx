import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { InterestsPicker } from '@/components/InterestsPicker';
import { Text } from '@/components/T';
import { Body, Btn, Empty, Input, Pill, Row, XBtn } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { confirmDelete } from '@/lib/confirm';
import { itemOf, optionOf, whereNote } from '@/lib/dataCatalog';
import { norm } from '@/lib/knowledge';
import { Icon } from '@/lib/icons';
import { useApp } from '@/store/app';
import { INTEREST_CATALOG, useInterests } from '@/store/interests';
import { useLife } from '@/store/life';
import { answerStyles, DEFAULT_STYLE, styleLabel, usePrefs } from '@/store/prefs';
import { useChoices, useSharing } from '@/store/sharing';
import { go } from '@/lib/nav';
import { toast } from '@/store/toast';
import { t as tl, translateText } from '@/i18n/core';

export type HubSection = 'obiettivi' | 'task' | 'note' | 'interessi' | 'automazioni' | 'preferenze' | 'consensi';

/** Dove vive e chi la vede, preso dal catalogo dei dati: così la schermata resta coerente con "Cosa condivido". */
function Where({ id }: { id: string }) {
  const c = useChoices();
  const it = itemOf(id);
  const o = optionOf(id, c);
  if (!it || !o) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
      <Pill icon="phone" label={whereNote(it.where)} />
      <Pill icon={o.shared ? 'users' : 'lock'} label={tl('La vede: {0}', translateText(o.audience))} />
    </View>
  );
}

function Section({ id, title, count, open, onToggle, forceOpen, children }: { id: HubSection; title: string; count?: number; open: boolean; onToggle: () => void; forceOpen: boolean; children: ReactNode }) {
  const t = useTheme();
  const isOpen = open || forceOpen;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: t.item, paddingTop: 4 }} testID={'hub-' + id}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} accessibilityLabel={translateText(title)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }}>
        <Icon name={isOpen ? 'chevron' : 'chevron-right'} size={14} color={t.muted} stroke={2.2} />
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '800', flex: 1 }}>{title}</Text>
        {count != null && <Text style={{ color: t.muted, fontSize: 13 }}>{count}</Text>}
      </Pressable>
      {isOpen ? <View style={{ paddingBottom: 8 }}>{children}</View> : null}
    </View>
  );
}

/** "Cosa LifePilot sa di te": memoria, interessi, automazioni e preferenze in un'unica schermata, con ricerca. */
export function KnowledgeHub({ focus, onOpenAutomations }: { focus?: HubSection | null; onOpenAutomations: () => void }) {
  const t = useTheme();
  const life = useLife();
  const { goals, tasks, notes, automations } = life;
  const answerStyle = usePrefs((s) => s.answerStyle);
  const setStyle = usePrefs((s) => s.setAnswerStyle);
  const resetPrefs = usePrefs((s) => s.reset);
  const interests = useInterests();
  const setShare = useSharing((s) => s.set);
  const privacy = useApp((s) => s.privacy);
  const [q, setQ] = useState('');
  const [openMap, setOpenMap] = useState<Partial<Record<HubSection, boolean>>>({ obiettivi: true, ...(focus ? { [focus]: true } : {}) });
  const [edit, setEdit] = useState<{ kind: 'goal' | 'task'; id: string; t: string; p: string } | null>(null);
  const [newGoal, setNewGoal] = useState('');
  const [newTask, setNewTask] = useState('');

  const nq = norm(q);
  const match = (s: string) => !nq || norm(s).includes(nq);
  const searching = !!nq;
  const openTasks = tasks.filter((x) => !x.done);
  const fGoals = goals.filter((g) => match(g.t));
  const fTasks = openTasks.filter((x) => match(x.t));
  const fNotes = notes.filter((n) => match(n.text));
  const fAutos = automations.filter((a) => match(a.t));
  const interestCount = interests.selected.length + interests.custom.length;
  const interestMatch = !nq || INTEREST_CATALOG.some((c) => interests.selected.includes(c.id) && match(c.label)) || interests.custom.some((c) => match(c.label)) || match(interests.homeCity) || match('interessi città');
  const AI_KEYS = ['AI Memory', 'Dati salute', 'Dati finanziari', 'Posizione'];
  const activePriv = AI_KEYS.filter((k) => privacy[k]);
  const toggle = (k: HubSection) => setOpenMap((m) => ({ ...m, [k]: !m[k] }));
  const show = (k: HubSection, has: boolean) => !searching || has;

  const addGoal = () => { const v = newGoal.trim(); if (!v) { toast('Scrivi il titolo dell\'obiettivo'); return; } life.addGoal(v); setNewGoal(''); toast('Obiettivo aggiunto'); };
  const addTask = () => { const v = newTask.trim(); if (!v) { toast('Scrivi il testo del task'); return; } life.addTask({ t: v, done: false }); setNewTask(''); toast('Task aggiunto'); };
  const delGoal = (id: string) => {
    const idx = life.goals.findIndex((g) => g.id === id); const g = life.goals[idx];
    if (!g) return;
    confirmDelete(tl('l\'obiettivo «{0}»', g.t), () => life.delGoal(id), () => life.restoreGoal(g, idx), { undoMessage: 'Obiettivo eliminato' });
  };
  const delTask = (id: string) => {
    const idx = life.tasks.findIndex((x) => x.id === id); const tk = life.tasks[idx];
    if (!tk) return;
    confirmDelete(tl('il task «{0}»', tk.t), () => { life.delTask(id); }, () => life.restoreTask(tk, idx), { undoMessage: 'Task eliminato' });
  };
  const delNote = (id: string) => {
    const n = life.notes.find((x) => x.id === id);
    if (!n) return;
    let removed: { note: typeof n; idx: number } | null = null;
    confirmDelete(tl('la nota «{0}»', n.text.slice(0, 40)), () => { removed = life.delNote(id); }, () => { const r = removed as { note: typeof n; idx: number } | null; if (r) life.restoreNote(r.note, r.idx); }, { undoMessage: 'Nota eliminata' });
  };
  const saveEdit = () => {
    if (!edit) return;
    const title = edit.t.trim();
    if (!title) { toast('Il nome non può essere vuoto'); return; }
    if (edit.kind === 'task') life.patchTask(edit.id, { t: title });
    else { const p = parseInt(edit.p, 10); life.patchGoal(edit.id, { t: title, ...(Number.isFinite(p) ? { p: Math.max(0, Math.min(100, p)) } : {}) }); }
    setEdit(null); toast('Salvato');
  };
  const wipeAll = () => {
    openTasks.forEach((x) => life.delTask(x.id));
    life.notes.forEach((n) => life.delNote(n.id));
    life.goals.forEach((g) => life.delGoal(g.id));
    life.automations.forEach((a) => life.delAuto(a.id));
    life.purgeTrash();
    resetPrefs();
    useApp.getState().set({ privacy: Object.fromEntries(Object.keys(useApp.getState().privacy).map((k) => [k, false])) });
    toast('Memoria cancellata');
  };

  const editor = (
    <View style={{ marginTop: 8 }}>
      <Input value={edit?.t ?? ''} onChangeText={(v) => setEdit((e) => (e ? { ...e, t: v } : e))} placeholder="Nome" autoFocus />
      {edit?.kind === 'goal' && <Input value={edit.p} onChangeText={(v) => setEdit((e) => (e ? { ...e, p: v.replace(/[^0-9]/g, '').slice(0, 3) } : e))} keyboardType="number-pad" placeholder="Percentuale (0-100)" />}
      <Row gap={8}><Btn small style={{ flex: 1 }} title="Salva" onPress={saveEdit} /><Btn small ghost style={{ flex: 1 }} title="Annulla" onPress={() => setEdit(null)} /></Row>
    </View>
  );
  const IconBtn = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={translateText(label)} style={{ padding: 4 }}><Icon name="edit" size={17} color={t.muted} stroke={2} /></Pressable>
  );
  const rowStyle = { paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.item } as const;

  const nothing = searching && !fGoals.length && !fTasks.length && !fNotes.length && !fAutos.length && !interestMatch && !match('preferenze stile risposte') && !activePriv.some(match);

  return (
    <View>
      <Body small muted>Qui vedi tutto ciò che LifePilot ricorda di te. Tutto vive solo sul tuo telefono: non è sui nostri server. Puoi modificare o eliminare ogni voce (con annulla) o cancellare tutto.</Body>
      <Input placeholder="Cerca tra obiettivi, task, note, interessi…" value={q} onChangeText={setQ} style={{ marginTop: 10 }} />
      {nothing && <Empty text="Nessuna voce corrisponde alla ricerca." />}

      {show('obiettivi', fGoals.length > 0) && (
        <Section id="obiettivi" title="Obiettivi" count={goals.length} open={!!openMap.obiettivi} onToggle={() => toggle('obiettivi')} forceOpen={searching}>
          <Where id="plan_goals" />
          {fGoals.length === 0 ? <Body small muted>Nessun obiettivo: aggiungine uno qui sotto.</Body> : fGoals.map((g) => (
            <View key={g.id} style={rowStyle}>
              {edit?.kind === 'goal' && edit.id === g.id ? editor : (
                <Row>
                  <View style={{ flex: 1 }}><Body bold>{g.t}</Body><Body small muted>{tl('Progresso {0}%', g.p)}</Body></View>
                  <IconBtn label={tl('Modifica {0}', g.t)} onPress={() => setEdit({ kind: 'goal', id: g.id, t: g.t, p: String(g.p) })} />
                  <XBtn label={translateText(tl('Elimina {0}', g.t))} onPress={() => delGoal(g.id)} />
                </Row>
              )}
            </View>
          ))}
          {!searching && (<><Input value={newGoal} onChangeText={setNewGoal} placeholder="Nuovo obiettivo, es. Correre 10 km" onSubmitEditing={addGoal} style={{ marginTop: 8 }} /><Btn small title="Aggiungi obiettivo" icon="plus" onPress={addGoal} /></>)}
        </Section>
      )}

      {show('task', fTasks.length > 0) && (
        <Section id="task" title="Task aperti" count={openTasks.length} open={!!openMap.task} onToggle={() => toggle('task')} forceOpen={searching}>
          <Where id="plan_tasks" />
          {fTasks.length === 0 ? <Body small muted>Nessun task aperto.</Body> : fTasks.map((x) => (
            <View key={x.id} style={rowStyle}>
              {edit?.kind === 'task' && edit.id === x.id ? editor : (
                <Row>
                  <Body small style={{ flex: 1 }} numberOfLines={2}>{x.t}</Body>
                  <IconBtn label={tl('Modifica {0}', x.t)} onPress={() => setEdit({ kind: 'task', id: x.id, t: x.t, p: '' })} />
                  <XBtn label={translateText(tl('Elimina {0}', x.t))} onPress={() => delTask(x.id)} />
                </Row>
              )}
            </View>
          ))}
          {!searching && (<><Input value={newTask} onChangeText={setNewTask} placeholder="Nuovo task" onSubmitEditing={addTask} style={{ marginTop: 8 }} /><Btn small title="Aggiungi task" icon="plus" onPress={addTask} /></>)}
        </Section>
      )}

      {show('note', fNotes.length > 0) && (
        <Section id="note" title="Note" count={notes.length} open={!!openMap.note} onToggle={() => toggle('note')} forceOpen={searching}>
          <Where id="plan_notes" />
          {fNotes.length === 0 ? <Body small muted>Nessuna nota.</Body> : fNotes.map((n) => (
            <View key={n.id} style={rowStyle}><Row><Body small style={{ flex: 1 }} numberOfLines={2}>{n.text}</Body><XBtn label={translateText('Elimina nota')} onPress={() => delNote(n.id)} /></Row></View>
          ))}
          <Btn small ghost style={{ marginTop: 8 }} title="Apri LifeNotes per modificarle" onPress={() => go('lifenotes')} />
        </Section>
      )}

      {show('interessi', interestMatch) && (
        <Section id="interessi" title="Interessi e città" count={interestCount} open={!!openMap.interessi} onToggle={() => toggle('interessi')} forceOpen={searching}>
          <Where id="pub_interests" />
          <InterestsPicker query={q} />
        </Section>
      )}

      {show('automazioni', fAutos.length > 0) && (
        <Section id="automazioni" title="Automazioni" count={automations.length} open={!!openMap.automazioni} onToggle={() => toggle('automazioni')} forceOpen={searching}>
          <Where id="plan_auto" />
          {fAutos.length === 0 ? <Body small muted>Nessuna automazione.</Body> : fAutos.map((a) => (
            <View key={a.id} style={rowStyle}><Body small>{a.t} · {a.on ? 'attiva' : 'disattivata'}</Body></View>
          ))}
          <Btn small ghost style={{ marginTop: 8 }} icon="repeat" title="Gestisci le automazioni" onPress={onOpenAutomations} />
        </Section>
      )}

      {show('preferenze', match('preferenze stile risposte ' + styleLabel(answerStyle))) && (
        <Section id="preferenze" title="Come vuoi le risposte" open={!!openMap.preferenze} onToggle={() => toggle('preferenze')} forceOpen={searching}>
          <Where id="plan_auto" />
          <Body small muted style={{ marginBottom: 6 }}>La scelta viene salvata e usata per adattare lo stile delle risposte.</Body>
          {answerStyles.map((o) => (
            <Pressable key={o.id} onPress={() => { setStyle(o.id); toast(tl('Preferenza salvata: {0}', translateText(o.label))); }} accessibilityRole="button" accessibilityState={{ selected: answerStyle === o.id }} style={rowStyle}>
              <Row>
                <View style={{ flex: 1 }}><Body bold>{o.label}</Body><Body small muted>{o.hint}</Body></View>
                {answerStyle === o.id ? <Icon name="check" size={18} color={t.positive} stroke={2.4} /> : null}
              </Row>
            </Pressable>
          ))}
          {answerStyle !== DEFAULT_STYLE && <Btn small ghost style={{ marginTop: 8 }} title="Ripristina la preferenza" onPress={() => { resetPrefs(); toast('Preferenza ripristinata'); }} />}
        </Section>
      )}

      {show('consensi', activePriv.some(match) || match('consensi assistente condivisione')) && (
        <Section id="consensi" title="Cosa può usare l'assistente AI" count={activePriv.length} open={!!openMap.consensi} onToggle={() => toggle('consensi')} forceOpen={searching}>
          <Body small muted style={{ marginBottom: 6 }}>Questi dati restano sul telefono; se li attivi, un riassunto viene aggiunto alle domande che fai all'assistente AI. Il quadro completo è in "Cosa condivido".</Body>
          {activePriv.length === 0 ? <Body small muted>Nessun consenso attivo.</Body> : activePriv.map((k) => {
            const it = [ 'ai_memory', 'health_activity', 'fin_summary', 'loc_live' ].map((id) => itemOf(id)!).find((x) => x.link === `privacy:${k}`);
            return (
              <View key={k} style={rowStyle}>
                <Row><Body small style={{ flex: 1 }}>{it?.label ?? k}</Body><Btn small ghost title="Disattiva" onPress={() => { if (it) setShare(it.id, 'off'); toast(tl('{0}: disattivato', translateText(it?.label ?? k))); }} /></Row>
              </View>
            );
          })}
          <Btn small ghost style={{ marginTop: 8 }} icon="shield" title="Apri Cosa condivido" onPress={() => go('sharing')} />
        </Section>
      )}

      <Btn danger style={{ marginTop: 18 }} icon="trash" title="Cancella tutta la memoria"
        onPress={() => confirmDelete('tutta la memoria di LifePilot: task aperti, note, obiettivi, automazioni, preferenze e consensi per l\'assistente', wipeAll, undefined, { title: 'Cancellare tutta la memoria?', okLabel: 'Sì, cancella tutto' })} />
    </View>
  );
}
