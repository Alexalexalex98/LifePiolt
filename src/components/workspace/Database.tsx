import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { CalendarPanel } from '@/components/CalendarViews';
import { Text } from '@/components/T';
import { Btn, Input, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { applyView, byDay, parseDate, type Filter } from '@/lib/workspaceViews';
import { STATUSES, useWorkspace, type Col, type ColKind, type WsPage } from '@/store/workspace';
import { toast } from '@/store/toast';

/** Un database come una vera tabella: la prima colonna resta ferma, le altre scorrono; righe alte uguali, stati colorati che si scelgono da un elenco, date dal calendario, totali dei numeri, colonne con nome e tipo. */
const SC: Record<string, string> = { 'Da fare': '#8e98a8', 'In corso': '#e0a030', Fatto: '#3aa86b' };
const FIRST_W = 168, COL_W = 132, ROW_H = 48, HEAD_H = 42;
const KIND_LABEL: Record<ColKind, string> = { text: 'Testo', number: 'Numero', date: 'Data', status: 'Stato' };
const VIEWS = [{ v: 'table', l: 'Tabella' }, { v: 'kanban', l: 'Kanban' }, { v: 'calendar', l: 'Calendario' }, { v: 'gallery', l: 'Galleria' }] as const;
const OPS: { op: Filter['op']; label: string }[] = [{ op: 'has', label: 'contiene' }, { op: 'is', label: 'è' }, { op: 'not', label: 'non è' }, { op: 'gt', label: '>' }, { op: 'lt', label: '<' }];
const isoToCell = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const fmtDate = (v: string) => { const ms = parseDate(v); return ms == null ? v : new Date(ms).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }); };
const num = (s: string) => parseFloat((s ?? '').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;

export function Database({ page }: { page: WsPage }) {
  const th = useTheme(); const ws = useWorkspace.getState();
  const cols = page.cols ?? []; const allRows = page.rows ?? [];
  const first = cols[0]; const rest = cols.slice(1);
  const statusCol = cols.find((x) => x.kind === 'status'); const dateCol = cols.find((x) => x.kind === 'date');
  const view = page.view ?? 'table';
  const rows = useMemo(() => applyView(cols, allRows, page.flt, page.srt), [cols, allRows, page.flt, page.srt]);
  const cal = useMemo(() => byDay(cols, rows), [cols, rows]);
  const [fOpen, setFOpen] = useState(false); const [colSheet, setColSheet] = useState<Col | 'new' | null>(null);
  const [pickStatus, setPickStatus] = useState<{ row: string; col: string } | null>(null); const [pickDate, setPickDate] = useState<{ row: string; col: string } | null>(null);
  const flt: Filter = page.flt ?? { col: first?.id ?? '', op: 'has', v: '' };
  const setFlt = (p: Partial<Filter>) => ws.patch(page.id, { flt: { ...flt, ...p } });
  const sortBy = (id: string) => { const s = page.srt; ws.patch(page.id, { srt: !s || s.col !== id ? { col: id, dir: 1 } : s.dir === 1 ? { col: id, dir: -1 } : null }); };
  const addRow = () => { ws.addRow(page.id); };
  const border = th.border;

  const pill = (v: string) => <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 28, borderRadius: 999, backgroundColor: (SC[v] ?? SC['Da fare']!) + '2b' }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: SC[v] ?? SC['Da fare'] }} /><Text numberOfLines={1} style={{ color: th.text, fontWeight: '700', fontSize: 12.5 }}>{tl(v || STATUSES[0]!)}</Text></View>;
  const cell = (col: Col, r: (typeof rows)[number], w: number) => {
    const v = r.cells[col.id] ?? '';
    const box = { width: w, height: ROW_H, paddingHorizontal: 12, justifyContent: 'center' as const };
    if (col.kind === 'status') return <Pressable key={col.id} onPress={() => setPickStatus({ row: r.id, col: col.id })} accessibilityRole="button" accessibilityLabel={`${col.name}: ${tl(v || STATUSES[0]!)}`} style={box}>{pill(v || STATUSES[0]!)}</Pressable>;
    if (col.kind === 'date') return <Pressable key={col.id} onPress={() => setPickDate({ row: r.id, col: col.id })} accessibilityRole="button" accessibilityLabel={`${col.name}: ${v ? fmtDate(v) : tl('nessuna data')}`} style={{ ...box, flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="calendar" size={14} color={v ? th.accent : th.muted} /><Text numberOfLines={1} style={{ color: v ? th.text : th.muted, fontSize: 13.5 }}>{v ? fmtDate(v) : tl('Scegli')}</Text></Pressable>;
    return (
      <View key={col.id} style={box}>
        <TextInput value={v} onChangeText={(x) => ws.patchRow(page.id, r.id, col.id, x)} keyboardType={col.kind === 'number' ? 'decimal-pad' : 'default'} placeholder={col.kind === 'number' ? '0' : '—'} placeholderTextColor={th.muted} accessibilityLabel={col.name}
          style={{ padding: 0, fontSize: 14.5, color: th.text, textAlign: col.kind === 'number' ? 'right' : 'left', fontVariant: col.kind === 'number' ? ['tabular-nums'] : undefined }} />
      </View>
    );
  };
  const head = (col: Col, w: number, isFirst = false) => (
    <View key={col.id} style={{ width: w, height: HEAD_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 4 }}>
      <Pressable onPress={() => sortBy(col.id)} accessibilityRole="button" accessibilityLabel={tl('Ordina per {0}', col.name)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text numberOfLines={1} style={{ color: th.muted, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', flexShrink: 1 }}>{col.name}</Text>
        {page.srt?.col === col.id ? <Icon name={page.srt.dir === 1 ? 'arrow-up' : 'arrow-down'} size={12} color={th.accent} stroke={2.6} /> : null}
      </Pressable>
      <Pressable onPress={() => setColSheet(col)} hitSlop={8} accessibilityRole="button" accessibilityLabel={tl('Opzioni della colonna {0}', col.name)}><Icon name="more" size={15} color={th.muted} /></Pressable>
    </View>
  );
  const sums = rest.filter((c) => c.kind === 'number').length || first?.kind === 'number';
  const card = (r: (typeof rows)[number], w?: number) => (
    <View key={r.id} style={{ width: w, backgroundColor: th.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: border, gap: 3 }}>
      <Text style={{ color: th.text, fontWeight: '800', fontSize: 15 }}>{(first && r.cells[first.id]) || tl('Senza nome')}</Text>
      {cols.slice(1).filter((x) => r.cells[x.id]).map((x) => <Text key={x.id} style={{ color: th.muted, fontSize: 12.5 }}>{`${x.name}: ${x.kind === 'status' ? tl(r.cells[x.id]!) : x.kind === 'date' ? fmtDate(r.cells[x.id]!) : r.cells[x.id]}`}</Text>)}
      {statusCol ? <Pressable onPress={() => setPickStatus({ row: r.id, col: statusCol.id })} accessibilityRole="button" style={{ marginTop: 6 }}>{pill(r.cells[statusCol.id] || STATUSES[0]!)}</Pressable> : null}
    </View>
  );
  const chip = (on: boolean) => ({ paddingHorizontal: 12, height: 34, justifyContent: 'center' as const, borderRadius: 999, borderWidth: 1, borderColor: on ? th.accent : border, backgroundColor: on ? th.accent + '22' : th.card });

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', backgroundColor: th.card, borderRadius: 14, padding: 3, borderWidth: 1, borderColor: border }}>
            {VIEWS.map((x) => <Pressable key={x.v} onPress={() => ws.patch(page.id, { view: x.v })} accessibilityRole="button" accessibilityState={{ selected: view === x.v }} style={{ paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 11, backgroundColor: view === x.v ? th.text : 'transparent' }}><Text style={{ color: view === x.v ? th.onText : th.muted, fontWeight: '800', fontSize: 13 }}>{tl(x.l)}</Text></Pressable>)}
          </View>
        </ScrollView>
        <Pressable onPress={() => setFOpen(!fOpen)} accessibilityRole="button" accessibilityLabel={tl('Filtra')} style={chip(!!page.flt?.v || fOpen)}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="search" size={14} color={th.text} /><Text style={{ color: th.text, fontWeight: '700', fontSize: 12.5 }}>{page.flt?.v ? tl('Filtro attivo') : tl('Filtra')}</Text></View></Pressable>
      </View>
      {fOpen ? (
        <View style={{ backgroundColor: th.card, borderRadius: 16, borderWidth: 1, borderColor: border, padding: 12, gap: 10 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{cols.map((x) => <Pressable key={x.id} onPress={() => setFlt({ col: x.id })} style={chip(flt.col === x.id)}><Text style={{ color: th.text, fontSize: 12.5, fontWeight: '700' }}>{x.name}</Text></Pressable>)}</ScrollView>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>{OPS.map((o) => <Pressable key={o.op} onPress={() => setFlt({ op: o.op })} style={chip(flt.op === o.op)}><Text style={{ color: th.text, fontSize: 12.5, fontWeight: '700' }}>{tl(o.label)}</Text></Pressable>)}</View>
          <Input value={flt.v} onChangeText={(x) => setFlt({ v: x })} placeholder={tl('Valore da cercare')} style={{ marginBottom: 0 }} />
          {page.flt?.v || page.srt ? <Pressable onPress={() => ws.patch(page.id, { flt: null, srt: null })} accessibilityRole="button"><Text style={{ color: th.accent, fontWeight: '800', fontSize: 13 }}>{tl('Togli filtro e ordine')}</Text></Pressable> : null}
        </View>
      ) : null}

      {view === 'kanban' && statusCol && first ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {STATUSES.map((s) => { const col = rows.filter((r) => (r.cells[statusCol.id] || STATUSES[0]) === s); return (
            <View key={s} style={{ width: 240, backgroundColor: th.card, borderRadius: 18, padding: 10, gap: 8, borderWidth: 1, borderColor: border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: SC[s] }} /><Text style={{ color: th.text, fontWeight: '800' }}>{tl(s)}</Text><Text style={{ color: th.muted }}>{col.length}</Text></View>
              {col.length ? col.map((r) => card(r)) : <Text style={{ color: th.muted, fontSize: 13, padding: 6 }}>{tl('Niente qui.')}</Text>}
            </View>
          ); })}
        </ScrollView>
      ) : view === 'kanban' ? <Text style={{ color: th.muted }}>{tl('Per il Kanban serve una colonna Stato: aggiungila con «+ Colonna».')}</Text>
      : view === 'calendar' ? (
        <View style={{ gap: 10 }}>
          {!dateCol ? <Text style={{ color: th.muted }}>{tl('Per il calendario serve una colonna Data: aggiungila con «+ Colonna».')}</Text> : null}
          {cal.days.map((d) => (
            <View key={d.key} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 54, alignItems: 'center', backgroundColor: th.card, borderRadius: 14, borderWidth: 1, borderColor: border, paddingVertical: 8, alignSelf: 'flex-start' }}>
                <Text style={{ color: th.accent, fontWeight: '800', fontSize: 11 }}>{new Date(d.key).toLocaleDateString('it-IT', { month: 'short' }).toUpperCase()}</Text>
                <Text style={{ color: th.text, fontWeight: '800', fontSize: 20 }}>{new Date(d.key).getDate()}</Text>
                <Text style={{ color: th.muted, fontSize: 10 }}>{new Date(d.key).toLocaleDateString('it-IT', { weekday: 'short' })}</Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>{d.rows.map((r) => card(r))}</View>
            </View>
          ))}
          {cal.undated.length ? <><Text style={{ color: th.muted, fontWeight: '800', fontSize: 12 }}>{tl('SENZA DATA')}</Text>{cal.undated.map((r) => card(r))}</> : null}
        </View>
      ) : view === 'gallery' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{rows.map((r) => card(r, 170))}</View>
      : !first ? <Text style={{ color: th.muted }}>{tl('Aggiungi una colonna per cominciare.')}</Text> : (
        <View style={{ borderRadius: 18, borderWidth: 1, borderColor: border, overflow: 'hidden', backgroundColor: th.card }}>
          <View style={{ flexDirection: 'row' }}>
            {/* prima colonna ferma */}
            <View style={{ width: FIRST_W, borderEndWidth: 1, borderEndColor: border, backgroundColor: th.card }}>
              <View style={{ backgroundColor: th.chip, borderBottomWidth: 1, borderBottomColor: border }}>{head(first, FIRST_W, true)}</View>
              {rows.map((r) => <View key={r.id} style={{ borderBottomWidth: 1, borderBottomColor: border }}>{cell(first, r, FIRST_W)}</View>)}
              <Pressable onPress={addRow} accessibilityRole="button" accessibilityLabel={tl('Nuova riga')} style={{ height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}><Icon name="plus" size={16} color={th.accent} stroke={2.6} /><Text style={{ color: th.accent, fontWeight: '800', fontSize: 14 }}>{tl('Nuova riga')}</Text></Pressable>
            </View>
            {/* le altre colonne scorrono */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              <View>
                <View style={{ flexDirection: 'row', backgroundColor: th.chip, borderBottomWidth: 1, borderBottomColor: border }}>
                  {rest.map((c) => head(c, COL_W))}
                  <Pressable onPress={() => setColSheet('new')} accessibilityRole="button" accessibilityLabel={tl('Aggiungi una colonna')} style={{ width: 110, height: HEAD_H, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 }}><Icon name="plus" size={14} color={th.accent} stroke={2.6} /><Text style={{ color: th.accent, fontWeight: '800', fontSize: 12.5 }}>{tl('Colonna')}</Text></Pressable>
                </View>
                {rows.map((r) => (
                  <View key={r.id} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: border, alignItems: 'center' }}>
                    {rest.map((c) => cell(c, r, COL_W))}
                    <Pressable onPress={() => ws.delRow(page.id, r.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={tl('Elimina la riga')} style={{ width: 110, height: ROW_H, justifyContent: 'center', alignItems: 'center' }}><Icon name="trash" size={16} color={th.muted} /></Pressable>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', height: ROW_H, alignItems: 'center' }}>
                  {rest.map((c) => <View key={c.id} style={{ width: COL_W, paddingHorizontal: 12 }}>{c.kind === 'number' ? <Text style={{ color: th.text, fontWeight: '800', fontSize: 13.5, textAlign: 'right' }}>{`${tl('Tot.')} ${rows.reduce((a, r) => a + num(r.cells[c.id] ?? ''), 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })}`}</Text> : c.kind === 'status' ? <Text style={{ color: th.muted, fontSize: 12.5 }}>{`${rows.filter((r) => (r.cells[c.id] || STATUSES[0]) === 'Fatto').length}/${rows.length} ${tl('fatti')}`}</Text> : null}</View>)}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
      <Text style={{ color: th.muted, fontSize: 12.5 }}>{`${rows.length} ${rows.length === 1 ? tl('riga') : tl('righe')}${rows.length < allRows.length ? ` ${tl('su {0} (filtro attivo)', String(allRows.length))}` : ''}${sums ? '' : ''}`}</Text>
      {view !== 'table' ? <Btn small icon="plus" title="Nuova riga" onPress={() => { addRow(); toast(tl('Riga aggiunta')); }} /> : null}

      <Sheet visible={!!pickStatus} title="Scegli lo stato" onClose={() => setPickStatus(null)}>
        {STATUSES.map((s) => <Pressable key={s} onPress={() => { if (pickStatus) ws.patchRow(page.id, pickStatus.row, pickStatus.col, s); setPickStatus(null); }} accessibilityRole="button" style={{ minHeight: 52, justifyContent: 'center', paddingVertical: 6 }}>{pill(s)}</Pressable>)}
      </Sheet>
      <Sheet visible={!!pickDate} title="Scegli il giorno dal Plan" onClose={() => setPickDate(null)}>
        <CalendarPanel selectMode={false} onPickDay={(k) => { if (pickDate) ws.patchRow(page.id, pickDate.row, pickDate.col, isoToCell(k)); setPickDate(null); }} onOpenBand={() => undefined} />
        <Btn style={{ marginTop: 10 }} ghost title="Nessuna data" onPress={() => { if (pickDate) ws.patchRow(page.id, pickDate.row, pickDate.col, ''); setPickDate(null); }} />
      </Sheet>
      {colSheet ? <ColumnSheet pageId={page.id} col={colSheet === 'new' ? null : colSheet} onClose={() => setColSheet(null)} /> : null}
    </View>
  );
}

function ColumnSheet({ pageId, col, onClose }: { pageId: string; col: Col | null; onClose: () => void }) {
  const th = useTheme(); const ws = useWorkspace.getState();
  const [name, setName] = useState(col?.name ?? ''); const [kind, setKind] = useState<ColKind>(col?.kind ?? 'text');
  const isFirst = col ? (useWorkspace.getState().pages.find((p) => p.id === pageId)?.cols ?? [])[0]?.id === col.id : false;
  return (
    <Sheet visible title={col ? tl('Colonna «{0}»', col.name) : tl('Nuova colonna')} onClose={onClose}>
      <Input value={name} onChangeText={setName} placeholder={tl('Nome della colonna')} />
      {!col ? (
        <>
          <Text style={{ color: th.muted, fontSize: 12, fontWeight: '800', marginBottom: 6 }}>{tl('CHE COSA CONTIENE').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {(Object.keys(KIND_LABEL) as ColKind[]).map((k) => <Pressable key={k} onPress={() => setKind(k)} accessibilityRole="button" accessibilityState={{ selected: kind === k }} style={{ paddingHorizontal: 14, height: 40, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: kind === k ? th.accent : th.border, backgroundColor: kind === k ? th.accent + '22' : th.card }}><Text style={{ color: th.text, fontWeight: '700' }}>{tl(KIND_LABEL[k])}</Text></Pressable>)}
          </View>
        </>
      ) : <Text style={{ color: th.muted, fontSize: 13, marginBottom: 10 }}>{`${tl('Tipo')}: ${tl(KIND_LABEL[col.kind])}`}</Text>}
      <Btn icon="check" title={col ? 'Salva il nome' : 'Aggiungi la colonna'} onPress={() => { if (!name.trim()) { toast(tl('Scrivi il nome')); return; } if (col) ws.renameCol(pageId, col.id, name); else ws.addCol(pageId, name, kind); onClose(); }} />
      {col && !isFirst ? <Btn style={{ marginTop: 8 }} ghost danger title="Elimina la colonna" onPress={() => { ws.delCol(pageId, col.id); onClose(); }} /> : null}
    </Sheet>
  );
}
