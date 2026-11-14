import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useToday } from '@/components/casa/shared';
import { Text } from '@/components/T';
import { Employee } from '@/components/workgroup/Employee';
import { Employer } from '@/components/workgroup/Employer';
import { useGroup } from '@/components/workgroup/useGroup';
import { Body, Btn, Card, H, Input, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { go } from '@/lib/nav';
import { createGroup, joinGroup } from '@/lib/groupApi';
import { refreshTeams, serverState, type ServerState } from '@/lib/teams';
import { useTeams } from '@/store/teams';
import { toast } from '@/store/toast';

/** Gruppo di lavoro: datore di lavoro e dipendenti. Il datore pubblica i turni (il dipendente conferma), vede ore, ferie e saldo di tutti; i dipendenti confermano, scambiano turni,
 *  si segnano disponibili a coprire, chiedono ferie e ogni mese confermano le ore con un PDF. È diverso dal Workspace: qui ci sono persone e orari, non progetti. */
export default function WorkGroup() {
  const th = useTheme(); const today = useToday();
  const groups = useTeams((s) => s.groups);
  const [sel, setSel] = useState<string | undefined>(); const [server, setServer] = useState<ServerState | null>(null);
  const [sheet, setSheet] = useState<'new' | 'join' | null>(null); const [name, setName] = useState(''); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { void serverState().then(setServer); void refreshTeams(); }, []);
  const group = groups.find((g) => g.id === (sel ?? groups[0]?.id));
  const data = useGroup(group?.id, today);
  const boss = group?.role !== 'member';

  const create = async () => {
    if (!name.trim()) { toast('Dai un nome al gruppo, per esempio il nome dell\'attività'); return; }
    setBusy(true); const r = await createGroup(name); setBusy(false);
    if (!r.ok) { toast(r.message); return; }
    setSheet(null); setName(''); setSel(r.data); toast('Gruppo creato: la chat di gruppo c\'è già. Invita i dipendenti dalla scheda Persone');
  };
  const join = async () => {
    if (!code.trim()) { toast('Scrivi il codice che ti ha dato il datore'); return; }
    setBusy(true); const r = await joinGroup(code.trim().toUpperCase()); setBusy(false);
    if (!r.ok) { toast(r.message); return; }
    await refreshTeams(); setSheet(null); setCode(''); toast('Sei nel gruppo: i tuoi turni compaiono nel Plan appena li confermi');
  };

  return (
    <Page id="workgroup" title="Gruppo di lavoro" back>
      {server && server !== 'ok' ? (
        <Card accent={th.warn}>
          <H>Serve un account</H>
          <Body muted>{tl('Il gruppo di lavoro collega più persone: serve un account verificato e la connessione al server. Con la demo non si può usare.')}</Body>
        </Card>
      ) : !group ? (
        <>
          <Card accent={th.accent}>
            <H>Datore di lavoro o dipendente?</H>
            <Body muted>{tl('Crea il gruppo della tua attività oppure entra con il codice che ti ha dato il datore. Orari, ferie e scambi di turno stanno tutti qui, con la chat di gruppo.')}</Body>
            <Row gap={8} style={{ justifyContent: 'flex-start', marginTop: 12, flexWrap: 'wrap' }}>
              <Btn icon="plus" title="Crea il gruppo" onPress={() => setSheet('new')} />
              <Btn ghost title="Entra con un codice" onPress={() => setSheet('join')} />
            </Row>
          </Card>
          <Body small muted>{tl('È gratis. Solo la lettura di contratti, buste paga e fogli ore da foto richiede Premium: a mano si compila tutto senza pagare.')}</Body>
        </>
      ) : (
        <>
          <Row>
            <View style={{ flex: 1 }}><Text style={{ color: th.text, fontSize: 20, fontWeight: '800' }}>{group.name}</Text><Body small muted>{boss ? tl('Sei il datore di lavoro · {0} persone', group.members) : tl('Sei un dipendente · {0} persone', group.members)}</Body></View>
            <Btn small ghost title="Altro" onPress={() => setSheet('join')} />
          </Row>
          {groups.length > 1 ? <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={6}>{groups.map((g) => <Pill key={g.id} label={g.name} on={g.id === group.id} onPress={() => setSel(g.id)} />)}</Row> : null}
          {data.loading ? <Body muted>{tl('Carico il gruppo…')}</Body> : boss ? <Employer team={group.id} today={today} data={data} /> : <Employee team={group.id} name={group.name} today={today} data={data} />}
          {!boss ? <Btn ghost title="Il mio conto delle ore e dello stipendio" onPress={() => go('payroll')} /> : null}
        </>
      )}
      <Sheet visible={sheet === 'new'} title="Crea il gruppo di lavoro" onClose={() => setSheet(null)}>
        <View style={{ gap: 10 }}>
          <Input placeholder="Nome dell'attività" value={name} onChangeText={setName} />
          <Btn icon="check" disabled={busy} title={busy ? 'Un attimo…' : 'Crea'} onPress={() => { void create(); }} />
          <Btn ghost title="Ho già un codice d'invito" onPress={() => setSheet('join')} />
        </View>
      </Sheet>
      <Sheet visible={sheet === 'join'} title="Entra con un codice" onClose={() => setSheet(null)}>
        <View style={{ gap: 10 }}>
          <Input placeholder="Codice d'invito" value={code} onChangeText={setCode} autoCapitalize="characters" />
          <Btn icon="check" disabled={busy} title={busy ? 'Un attimo…' : 'Entra'} onPress={() => { void join(); }} />
          <Btn ghost title="Crea un nuovo gruppo" onPress={() => setSheet('new')} />
        </View>
      </Sheet>
    </Page>
  );
}
