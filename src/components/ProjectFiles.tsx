import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Empty, Item, Row, XBtn } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { driveSubfolders, sameFolder } from '@/lib/projectTree';
import type { DriveFile } from '@/store/life';

/** La cartella «Progetti» di LifeDrive: sottocartelle come i progetti e le loro task, con dentro i file caricati. */
export function ProjectFiles({ files, onOpen, onDelete }: { files: DriveFile[]; onOpen: (f: DriveFile) => void; onDelete: (f: DriveFile) => void }) {
  const t = useTheme();
  const [cur, setCur] = useState<string[]>([]);
  const paths = files.map((f) => f.path ?? []);
  const subs = driveSubfolders(paths, cur);
  const here = files.filter((f) => sameFolder(f.path ?? [], cur));
  const count = (name: string) => files.filter((f) => (f.path ?? []).length > cur.length && cur.every((s, i) => f.path![i] === s) && f.path![cur.length] === name).length;
  return (
    <View>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }} gap={4}>
        <Pressable onPress={() => setCur([])}><Text style={{ color: cur.length ? t.accent : t.text, fontWeight: '700' }}>Progetti</Text></Pressable>
        {cur.map((s, i) => <Row key={i} gap={4}><Icon name="chevron" size={12} color={t.muted} /><Pressable onPress={() => setCur(cur.slice(0, i + 1))}><Text style={{ color: i === cur.length - 1 ? t.text : t.accent, fontWeight: '700' }}>{s}</Text></Pressable></Row>)}
      </Row>
      {!subs.length && !here.length ? <Empty text="Nessun file qui. Carica un file da una task in Progetti: la cartella si crea da sola." /> : null}
      {subs.map((s) => (
        <Item key={s}><Pressable onPress={() => setCur([...cur, s])} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.accent + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name="archive" size={20} color={t.accent} /></View>
          <View style={{ flex: 1 }}><Body bold numberOfLines={1}>{s}</Body><Body small muted>{`${count(s)} ${tl('file')}`}</Body></View>
          <Icon name="chevron" size={16} color={t.muted} />
        </Pressable></Item>
      ))}
      {here.map((f, i) => (
        <Item key={f.id} last={i === here.length - 1}>
          <Row>
            <Pressable style={{ flex: 1 }} onPress={() => onOpen(f)}><Body numberOfLines={1}>{f.n}</Body><Body small muted>{f.s} · {f.date}</Body></Pressable>
            <XBtn onPress={() => onDelete(f)} />
          </Row>
        </Item>
      ))}
    </View>
  );
}
