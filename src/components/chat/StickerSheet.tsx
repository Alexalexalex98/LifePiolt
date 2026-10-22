import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { Mascot } from '@/components/mascot/Mascot';
import { Body, Btn, H, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { EXPRESSIONS, stickerFromText, type Expression } from '@/lib/mascot';
import { ACCENTS } from '@/lib/themeCustom';
import { useStickers } from '@/store/stickers';
import { toast } from '@/store/toast';

type Sticker = { expr: Expression; color: string; label?: string };

/**
 * Gli adesivi di Theia al posto delle emoji: scegli un'espressione (e il colore), oppure descrivi a Theia quello che vuoi e crea il tuo.
 * Si manda nel colore che hai scelto; chi riceve lo vede animato.
 */
export function StickerSheet({ visible, onClose, onSend }: { visible: boolean; onClose: () => void; onSend: (s: Sticker) => void }) {
  const t = useTheme();
  const mine = useStickers((s) => s.mine);
  const [color, setColor] = useState(t.accent);
  const [desc, setDesc] = useState('');
  const [made, setMade] = useState<(Sticker & { matched: boolean }) | null>(null);
  const [label, setLabel] = useState('');
  const send = (s: Sticker) => { onSend(s); onClose(); };

  const create = () => {
    const r = stickerFromText(desc);
    setMade({ expr: r.expr, color: r.color ?? color, matched: r.matched });
    if (r.color) setColor(r.color);
  };
  const cell = (s: Sticker, key: string, del?: () => void) => (
    <Pressable key={key} accessibilityRole="button" accessibilityLabel={tl('Manda questo adesivo')} onPress={() => send(s)} onLongPress={del} style={{ width: '25%', alignItems: 'center', paddingVertical: 6 }}>
      <Mascot size={64} color={s.color} expression={s.expr} animated={false} ritual={false} />
      {s.label ? <Text numberOfLines={1} style={{ color: t.muted, fontSize: 10.5 }}>{s.label}</Text> : null}
    </Pressable>
  );
  return (
    <Sheet visible={visible} title={tl('Adesivi di Theia')} onClose={onClose}>
      <ScrollView style={{ maxHeight: 520 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        <Body small muted style={{ marginBottom: 6 }}>{tl('Colore')}</Body>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
          {[t.accent, ...ACCENTS.map((a) => a.hex)].map((hex, i) => <Pressable key={hex + i} accessibilityRole="button" accessibilityLabel={hex} onPress={() => setColor(hex)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: hex, borderWidth: color === hex ? 3 : 0, borderColor: t.text }} />)}
        </ScrollView>

        <H style={{ marginTop: 12 }}>{tl('Crea il tuo con Theia')}</H>
        <Row gap={8}>
          <View style={{ flex: 1 }}><Input value={desc} onChangeText={setDesc} placeholder={tl('Es. che festeggia, rosso')} onSubmitEditing={create} /></View>
          <Btn small title={tl('Crea')} onPress={create} disabled={!desc.trim()} />
        </Row>
        {made ? (
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <Mascot size={110} color={made.color} expression={made.expr} ritual={false} />
            {!made.matched ? <Body small muted style={{ textAlign: 'center' }}>{tl('Non ho capito bene che espressione vuoi: ho scelto quella felice. Prova con parole come festeggia, dorme, ti voglio bene, grazie.')}</Body> : null}
            <Input value={label} onChangeText={setLabel} placeholder={tl('Scritta sotto (facoltativa)')} maxLength={24} />
            <Row gap={8} style={{ marginTop: 8 }}>
              <Btn small ghost title={tl('Salva tra i miei')} onPress={() => { useStickers.getState().add({ expr: made.expr, color: made.color, ...(label.trim() ? { label: label.trim() } : {}) }); toast(tl('Adesivo salvato')); }} />
              <Btn small title={tl('Manda')} onPress={() => send({ expr: made.expr, color: made.color, ...(label.trim() ? { label: label.trim() } : {}) })} />
            </Row>
          </View>
        ) : null}

        {mine.length ? (
          <>
            <H style={{ marginTop: 14 }}>{tl('I miei')}</H>
            <Body small muted>{tl('Tieni premuto per toglierne uno.')}</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{mine.map((s) => cell(s, s.id, () => { useStickers.getState().remove(s.id); toast(tl('Adesivo tolto')); }))}</View>
          </>
        ) : null}

        <H style={{ marginTop: 14 }}>{tl('Tutte le espressioni')}</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {EXPRESSIONS.map((e) => cell({ expr: e.id, color }, e.id))}
        </View>
      </ScrollView>
    </Sheet>
  );
}
