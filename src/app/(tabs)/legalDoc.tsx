import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Body, H, Page } from '@/components/ui';
import { LEGAL_DOCS } from '@/lib/legalDocs.generated';
import { getActive } from '@/i18n/core';
import { useApp } from '@/store/app';

/** Testi legali (informativa sulla privacy, termini): italiano per chi usa l'italiano, inglese per tutti gli altri. */
export const LEGAL_TITLE: Record<string, string> = { privacy: 'Informativa sulla privacy', terms: 'Termini di servizio' };

export default function LegalDoc() {
  useApp((s) => s.language);
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const id = doc && LEGAL_DOCS[doc] ? doc : 'privacy';
  const text = LEGAL_DOCS[id]![getActive() === 'it' ? 'it' : 'en'] ?? '';
  const lines = text.split('\n').filter((l) => l.trim() && !/^\|[-| ]+\|$/.test(l.trim()));
  return (
    <Page id="legalDoc" title={LEGAL_TITLE[id]!} back>
      <View style={{ gap: 6, paddingBottom: 24 }}>
        {lines.map((l, i) => {
          const s = l.replace(/\*\*/g, '').replace(/\*/g, '');
          if (l.startsWith('# ')) return null;
          if (l.startsWith('## ')) return <H key={i} style={{ marginTop: 14 }}>{s.slice(3)}</H>;
          if (l.startsWith('> ')) return <Body key={i} small muted style={{ fontStyle: 'italic' }}>{s.slice(2)}</Body>;
          if (l.startsWith('|')) { const cells = s.split('|').map((c) => c.trim()).filter(Boolean); if (cells[0] === 'Categoria' || cells[0] === 'Category') return null; return <Body key={i} small muted>{`• ${cells[0]}: ${cells.slice(1).join(' · ')}`}</Body>; }
          if (l.startsWith('- ')) return <Body key={i} small muted>{`• ${s.slice(2)}`}</Body>;
          return <Body key={i} small muted>{s}</Body>;
        })}
      </View>
    </Page>
  );
}
