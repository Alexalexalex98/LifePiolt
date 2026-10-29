import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, H, Progress, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { sendToAssistant } from '@/lib/assistant/run';
import { computeDashboard } from '@/lib/analyticsData';
import { go } from '@/lib/nav';
import type { FactorResult } from '@/lib/wellbeing/score';

const CONF: Record<string, string> = { bassa: 'Provvisorio: dati ancora pochi', media: 'Affidabilità media', alta: 'Affidabilità alta' };

/** Il Life Score con TUTTI i motivi: cosa lo abbassa, cosa lo sostiene, il contesto, cosa l'app non vede e i limiti. */
export function LifeScoreBody({ onClose }: { onClose?: () => void }) {
  const t = useTheme();
  const ls = computeDashboard().lifeScore;
  const [open, setOpen] = useState<string | null>(null);
  const col = (s: number) => (s >= 75 ? '#5fd39a' : s >= 50 ? '#ffb020' : t.danger);
  const Factor = ({ f }: { f: FactorResult }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`${tl(f.label)}: ${f.score}`} onPress={() => setOpen(open === f.id ? null : f.id)} style={{ paddingVertical: 8 }}>
      <Row><Body bold style={{ flex: 1 }}>{tl(f.label)}</Body><Text style={{ color: col(f.score), fontWeight: '800', fontSize: 16 }}>{f.score}</Text></Row>
      <Progress value={f.score} />
      <Body small muted style={{ marginTop: 4 }}>{tl(f.why)}</Body>
      {open === f.id ? (
        <View style={{ marginTop: 6, gap: 4 }}>
          {f.vsBase ? <Body small>{f.vsBase}</Body> : null}
          <Body small muted>{tl('Da dove arriva')}: {tl(f.about)}</Body>
          <Body small muted>{tl('Dato')}: {f.value}</Body>
          {f.score < 75 ? <Body small>{tl('Cosa può aiutare')}: {tl(f.tip)}</Body> : null}
        </View>
      ) : null}
    </Pressable>
  );
  return (
    <View style={{ gap: 12 }}>
      <View style={{ alignItems: 'center', paddingVertical: 6 }}>
        <Text style={{ color: ls.score == null ? t.muted : col(ls.score), fontSize: 54, fontWeight: '800' }}>{ls.score ?? '—'}</Text>
        <Body small muted>{tl(CONF[ls.confidence]!)}{ls.score != null ? ` · ${Math.round(ls.coverage * 100)}% ${tl('dei segnali')}` : ''}</Body>
      </View>
      <Body>{tl(ls.summary)}</Body>

      {ls.reasons.length ? (
        <Card>
          <H>{tl('Perché questo numero')}</H>
          {ls.reasons.map((r, i) => <Body key={i} small style={{ marginTop: 4 }}>• {tl(r)}</Body>)}
        </Card>
      ) : null}

      {ls.down.length ? (
        <Card accent={t.danger}>
          <H>{tl('Cosa lo abbassa')}</H>
          {ls.down.map((f) => <Factor key={f.id} f={f} />)}
        </Card>
      ) : null}
      {ls.up.length ? (
        <Card accent="#5fd39a">
          <H>{tl('Cosa lo sostiene')}</H>
          {ls.up.map((f) => <Factor key={f.id} f={f} />)}
        </Card>
      ) : null}
      {ls.factors.length ? (
        <Card>
          <H>{tl('Tutti i fattori')}</H>
          <Body small muted style={{ marginBottom: 4 }}>{tl('Tocca un fattore per vedere da dove arriva e cosa può aiutare.')}</Body>
          {ls.factors.map((f) => <Factor key={f.id} f={f} />)}
        </Card>
      ) : null}

      {ls.context.length ? (
        <Card>
          <H>{tl('Cosa può spiegarlo (contesto)')}</H>
          <Body small muted style={{ marginBottom: 4 }}>{tl('Non misurano come stai, ma aiutano a capire il perché dei numeri.')}</Body>
          {ls.context.map((c) => <Body key={c.id} small style={{ marginTop: 4 }}><Text style={{ fontWeight: '800', color: t.text }}>{tl(c.label)}: </Text>{c.text}</Body>)}
        </Card>
      ) : null}

      <Card>
        <H>{tl('Cosa non riesco a vedere')}</H>
        {ls.notSeen.map((n, i) => <Body key={i} small muted style={{ marginTop: 4 }}>• {tl(n)}</Body>)}
      </Card>

      <Body small muted>{tl(ls.limits)}</Body>
      <View style={{ gap: 8 }}>
        <Btn icon="sparkle" title={tl('Parlane con Theia')} onPress={() => { onClose?.(); void sendToAssistant('vorrei parlare di come sto'); go('ai'); }} />
        <Btn ghost title={tl('Fai il questionario breve (WHO-5)')} onPress={() => { onClose?.(); void sendToAssistant('questionario sul benessere'); go('ai'); }} />
        <Btn ghost title={tl('Fai il check-in di oggi')} onPress={() => { onClose?.(); go('mood'); }} />
      </View>
    </View>
  );
}
