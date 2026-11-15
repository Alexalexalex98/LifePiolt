import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { reasonLabel } from '@/lib/modRules';
import { adminDecide, adminReports, type AdminAction, type AdminReport } from '@/lib/reportsApi';
import { useSocialStatus } from '@/social/socialAccess';
import { toast } from '@/store/toast';

const KIND: Record<string, string> = { post: 'Post', comment: 'Commento', seminar: 'Seminario', service: 'Servizio', idea: 'Idea', club: 'LifeClub', clubitem: 'Contenuto di un LifeClub', profile: 'Profilo' };
const ACTIONS: { id: AdminAction; label: string; days?: number; danger?: boolean }[] = [
  { id: 'dismiss', label: 'Nessun problema' }, { id: 'remove', label: 'Togli il contenuto', danger: true }, { id: 'warn', label: 'Ammonisci l\'autore' },
  { id: 'suspend', label: 'Sospendi il social (7 giorni)', days: 7, danger: true }, { id: 'ban', label: 'Escludi dal social', danger: true },
];

/** Per chi amministra l'app: le segnalazioni da rivedere, le più urgenti per prime. Ogni decisione avvisa l'autore e chiude le segnalazioni uguali. */
export default function AdminReports() {
  const t = useTheme(); const st = useSocialStatus();
  const [rows, setRows] = useState<AdminReport[] | null>(null); const [busy, setBusy] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!st.admin) return; let on = true;
    void adminReports('open').then((r) => { if (!on) return; if (!r.ok) { toast(r.message); setRows([]); return; } setRows(r.data ?? []); });
    return () => { on = false; };
  }, [st.admin, tick]);
  const decide = async (rep: AdminReport, a: (typeof ACTIONS)[number]) => {
    setBusy(`${rep.id}${a.id}`); const r = await adminDecide(rep.id, a.id, '', a.days); setBusy('');
    if (!r.ok) { toast(r.message); return; }
    toast('Fatto'); setTick((x) => x + 1);
  };
  if (!st.admin) return <Page id="adminReports" back title="Segnalazioni"><Card><Body>Questa pagina è solo per chi amministra l'app.</Body></Card></Page>;
  return (
    <Page id="adminReports" back title="Segnalazioni">
      <Body muted>Le segnalazioni urgenti (minori, contenuti illegali) sono in cima. Decidi con calma: chi ha segnalato non lo saprà.</Body>
      {rows === null ? <Body muted>Carico…</Body> : rows.length === 0 ? <Empty text="Nessuna segnalazione da rivedere." /> : rows.map((r) => (
        <Card key={r.id} style={{ marginTop: 10 }}>
          <Row gap={8}>
            <Text style={{ color: r.urgent ? t.danger : t.accent, fontSize: 12, fontWeight: '800' }}>{r.urgent ? tl('URGENTE') : tl(KIND[r.kind] ?? r.kind)}</Text>
            {r.times > 1 ? <Text style={{ color: t.muted, fontSize: 12 }}>{tl('{0} segnalazioni', r.times)}</Text> : null}
          </Row>
          <Text style={{ color: t.text, fontSize: 15.5, fontWeight: '700', marginTop: 4 }} numberOfLines={3}>{r.label || r.ref}</Text>
          <Body small muted>{`${tl(reasonLabel(r.reason))}${r.author ? ` · ${r.author}` : ''}`}</Body>
          {r.note ? <Body small style={{ marginTop: 4 }}>{r.note}</Body> : null}
          <View style={{ gap: 6, marginTop: 10 }}>
            {ACTIONS.map((a) => <Btn key={a.id} small ghost danger={a.danger} disabled={!!busy || (a.id !== 'dismiss' && !r.author_id && a.id !== 'remove')} title={a.label} onPress={() => { void decide(r, a); }} />)}
          </View>
        </Card>
      ))}
    </Page>
  );
}
