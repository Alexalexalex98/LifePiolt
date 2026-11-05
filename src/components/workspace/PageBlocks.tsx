import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/T';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { slashCommand, useWorkspace, type Block, type BlockType, type WsPage } from '@/store/workspace';

/** Il contenuto di una pagina, in modo chiaro: ogni titolo apre una sezione in una scheda, i punti degli elenchi stanno vicini, le righe vuote spiegano cosa scrivere, i pulsanti in basso aggiungono titoli, elenchi e cose da fare. */
const HINT: Record<BlockType, string> = { p: 'Scrivi qui', h: 'Titolo della sezione', todo: 'Cosa c\'è da fare?', bullet: 'Aggiungi un punto', quote: 'Scrivi una citazione', divider: '', link: 'Scrivi o incolla un link' };
const ADD: { t: BlockType; label: string; icon: string }[] = [{ t: 'h', label: 'Sezione', icon: 'edit' }, { t: 'p', label: 'Testo', icon: 'note' }, { t: 'bullet', label: 'Elenco', icon: 'tasks' }, { t: 'todo', label: 'Da fare', icon: 'check' }, { t: 'quote', label: 'Citazione', icon: 'comment' }, { t: 'divider', label: 'Linea', icon: 'minus' }];
type Section = { head: Block | null; body: Block[] };

export function PageBlocks({ page, accent, onMenu }: { page: WsPage; accent: string; onMenu: (id: string) => void }) {
  const th = useTheme(); const ws = useWorkspace.getState();
  const [focus, setFocus] = useState<string | null>(null);
  const sections = useMemo(() => { const out: Section[] = [{ head: null, body: [] }]; for (const b of page.blocks) { if (b.t === 'h') out.push({ head: b, body: [] }); else out[out.length - 1]!.body.push(b); } return out.filter((s, i) => s.head || s.body.length || i === 0); }, [page.blocks]);
  const onlyEmpty = page.blocks.every((b) => !b.text.trim() && b.t !== 'divider');

  const onText = (b: Block, v: string) => {
    const sc = slashCommand(v); if (sc) { ws.patchBlock(page.id, b.id, { t: sc.t, text: sc.rest }); if (sc.t === 'divider') ws.addBlockAfter(page.id, b.id); return; }
    // Invio: la riga si divide e quella nuova resta dello stesso tipo (elenco, da fare)
    const nl = v.indexOf('\n');
    if (nl >= 0 && b.t !== 'h') { ws.patchBlock(page.id, b.id, { text: v.slice(0, nl) }); const keep = b.t === 'bullet' || b.t === 'todo' ? b.t : 'p'; const id = ws.addBlockAfter(page.id, b.id, keep, v.slice(nl + 1)); setFocus(id); return; }
    if (nl >= 0 && b.t === 'h') { ws.patchBlock(page.id, b.id, { text: v.slice(0, nl) }); setFocus(ws.addBlockAfter(page.id, b.id, 'p', v.slice(nl + 1))); return; }
    ws.patchBlock(page.id, b.id, { text: v });
  };
  const add = (t: BlockType) => { const last = page.blocks[page.blocks.length - 1]; const id = last && !last.text.trim() && last.t !== 'divider' ? (ws.patchBlock(page.id, last.id, { t }), last.id) : ws.addBlock(page.id, t); if (t === 'divider') { ws.addBlock(page.id, 'p'); return; } setFocus(id); };
  const addPoint = (s: Section) => { const last = s.body[s.body.length - 1] ?? s.head; const t = last && (last.t === 'bullet' || last.t === 'todo') ? last.t : 'bullet'; setFocus(ws.addBlockAfter(page.id, (last ?? page.blocks[0]!).id, t)); };

  const row = (b: Block) => {
    if (b.t === 'divider') return <Pressable key={b.id} onLongPress={() => onMenu(b.id)} accessibilityRole="button" accessibilityLabel={tl('Linea')} style={{ paddingVertical: 8 }}><View style={{ height: 1, backgroundColor: th.border }} /></Pressable>;
    const on = focus === b.id;
    return (
      <View key={b.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 3, borderStartWidth: b.t === 'quote' ? 3 : 0, borderStartColor: accent, paddingStart: b.t === 'quote' ? 10 : 0 }}>
        {b.t === 'todo' ? <Pressable onPress={() => ws.patchBlock(page.id, b.id, { done: !b.done })} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: !!b.done }} style={{ marginTop: 4, width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: b.done ? th.positive : th.muted, backgroundColor: b.done ? th.positive : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{b.done ? <Icon name="check" size={14} color={th.bg} stroke={3} /> : null}</Pressable> : null}
        {b.t === 'bullet' ? <View style={{ marginTop: 11, width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} /> : null}
        <TextInput
          value={b.text} onChangeText={(v) => onText(b, v)} multiline autoFocus={focus === b.id} onFocus={() => setFocus(b.id)}
          onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace' && !b.text && page.blocks.length > 1) { ws.delBlock(page.id, b.id); setFocus(null); } }}
          placeholder={tl(HINT[b.t])} placeholderTextColor={th.muted} accessibilityLabel={tl(HINT[b.t])}
          style={{ flex: 1, padding: 0, margin: 0, minHeight: 26, fontSize: 16, lineHeight: 24, color: b.t === 'todo' && b.done ? th.muted : th.text, fontStyle: b.t === 'quote' ? 'italic' : 'normal', textDecorationLine: b.t === 'todo' && b.done ? 'line-through' : 'none' }}
        />
        {on ? <Pressable onPress={() => onMenu(b.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={tl('Opzioni della riga')} style={{ marginTop: 3 }}><Icon name="more" size={18} color={th.muted} /></Pressable> : null}
      </View>
    );
  };

  return (
    <View style={{ gap: 12 }}>
      {onlyEmpty ? <Text style={{ color: th.muted, fontSize: 13.5, lineHeight: 19 }}>{tl('Tocca una riga per scrivere. Con i pulsanti qui sotto aggiungi titoli, elenchi e cose da fare.')}</Text> : null}
      {sections.map((s, i) => (
        s.head ? (
          <View key={s.head.id} style={{ backgroundColor: th.card, borderRadius: 18, borderWidth: 1, borderColor: th.border, padding: 14, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: accent }} />
              <TextInput value={s.head.text} onChangeText={(v) => onText(s.head!, v)} onFocus={() => setFocus(s.head!.id)} placeholder={tl(HINT.h)} placeholderTextColor={th.muted} accessibilityLabel={tl(HINT.h)} style={{ flex: 1, padding: 0, fontSize: 17, fontWeight: '800', color: th.text }} />
              <Pressable onPress={() => onMenu(s.head!.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={tl('Opzioni della sezione')}><Icon name="more" size={18} color={th.muted} /></Pressable>
            </View>
            {s.body.length === 0 ? <Text style={{ color: th.muted, fontSize: 14, paddingVertical: 4 }}>{tl('Vuota: aggiungi un punto o scrivi un testo.')}</Text> : s.body.map(row)}
            <Pressable onPress={() => addPoint(s)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8 }}><Icon name="plus" size={15} color={th.accent} stroke={2.6} /><Text style={{ color: th.accent, fontWeight: '800', fontSize: 13.5 }}>{tl('Aggiungi un punto')}</Text></Pressable>
          </View>
        ) : s.body.length ? <View key={'intro' + i} style={{ paddingHorizontal: 2 }}>{s.body.map(row)}</View> : null
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {ADD.map((a) => <Pressable key={a.t} onPress={() => add(a.t)} accessibilityRole="button" accessibilityLabel={tl('Aggiungi: {0}', tl(a.label))} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 40, borderRadius: 999, backgroundColor: th.card, borderWidth: 1, borderColor: th.border }}><Icon name={a.icon} size={15} color={th.accent} stroke={2.2} /><Text style={{ color: th.text, fontWeight: '700', fontSize: 13.5 }}>{tl(a.label)}</Text></Pressable>)}
      </View>
    </View>
  );
}
