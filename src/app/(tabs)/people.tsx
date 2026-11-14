import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ProfilePreview } from '@/components/people/ProfilePreview';
import { QrScanner } from '@/components/QrScanner';
import { Text } from '@/components/T';
import { Body, Btn, Card, Empty, H, Input, Item, Page, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { go } from '@/lib/nav';
import { initials, parseQr, queryKind, type Card as PCard } from '@/lib/people';
import { answerFollow, followRequests, personByCode, searchPeople } from '@/lib/peopleApi';
import { serverState, type ServerState } from '@/lib/teams';
import { toast } from '@/store/toast';

/** Trova persone: per nome e cognome, @nome utente, codice o QR. Chi ha il profilo privato si trova solo con il codice o il QR. */
export default function People() {
  const th = useTheme(); const [text, setText] = useState(''); const [list, setList] = useState<PCard[] | null>(null); const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false); const [card, setCard] = useState<PCard | null>(null); const [reqs, setReqs] = useState<PCard[]>([]); const [server, setServer] = useState<ServerState | null>(null);
  const loadReqs = async () => { const r = await followRequests(); if (r.ok) setReqs(r.data); };
  useEffect(() => { void serverState().then((s) => { setServer(s); if (s === 'ok') void loadReqs(); }); }, []);

  const search = async () => {
    const k = queryKind(text);
    if (k === 'short') { toast('Scrivi almeno 3 caratteri del nome, o il codice di 8 caratteri'); return; }
    setBusy(true);
    const r = k === 'code' ? await personByCode(text) : await searchPeople(text);
    setBusy(false);
    if (!r.ok) { toast(r.message); return; }
    const found = Array.isArray(r.data) ? r.data : [r.data]; setList(found);
    if (k === 'code' && found.length === 1) setCard(found[0]!);
  };
  const scanned = async (raw: string) => {
    setScan(false); const code = parseQr(raw); if (!code) { toast('Questo QR non è di un profilo LifePilot'); return; }
    const r = await personByCode(code); if (r.ok) setCard(r.data); else toast(r.message);
  };
  const update = (c: PCard) => { setCard(c); setList((l) => l?.map((x) => (x.user_id === c.user_id ? c : x)) ?? l); };
  const answer = async (c: PCard, ok: boolean) => { const r = await answerFollow(c.user_id, ok); toast(r.ok ? (ok ? 'Accettata' : 'Rifiutata') : r.message); await loadReqs(); };

  return (
    <Page id="people" title="Trova persone" back>
      {server && server !== 'ok' ? (
        <Card accent={th.warn}><H>Serve un account</H><Body muted>{tl('La ricerca delle persone serve un account verificato e la connessione al server.')}</Body></Card>
      ) : (
        <>
          <Card accent={th.accent}>
            <Input placeholder="Nome e cognome, @nome utente o codice" value={text} onChangeText={setText} autoCapitalize="none" returnKeyType="search" onSubmitEditing={() => { void search(); }} />
            <Row gap={8} style={{ justifyContent: 'flex-start', marginTop: 10, flexWrap: 'wrap' }}>
              <Btn icon="search" disabled={busy} title={busy ? 'Cerco…' : 'Cerca'} onPress={() => { void search(); }} />
              <Btn ghost icon="camera" title="Scansiona un QR" onPress={() => setScan(true)} />
              <Btn ghost title="Il mio codice" onPress={() => go('myCode')} />
            </Row>
          </Card>
          {reqs.length ? (
            <Card accent={th.warn}>
              <H>Richieste di follow</H>
              {reqs.map((c, i) => (
                <Item key={c.user_id} last={i === reqs.length - 1}>
                  <Row gap={10}><View style={{ flex: 1 }}><Body bold>{c.display_name}</Body>{c.username ? <Body small muted>{`@${c.username}`}</Body> : null}</View><Btn small icon="check" title="Accetta" onPress={() => { void answer(c, true); }} /><Btn small ghost title="Rifiuta" onPress={() => { void answer(c, false); }} /></Row>
                </Item>
              ))}
            </Card>
          ) : null}
          {list ? (
            <Card>
              <H>Risultati</H>
              {list.length === 0 ? <Empty text={tl('Nessuno trovato. Chi ha il profilo privato si trova solo con il suo codice o il suo QR.')} /> : list.map((c, i) => (
                <Item key={c.user_id} last={i === list.length - 1} onPress={() => setCard(c)}>
                  <Row gap={12}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: th.chip, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: th.text, fontWeight: '800' }}>{initials(c.display_name)}</Text></View>
                    <View style={{ flex: 1 }}><Body bold>{c.display_name}</Body>{c.username ? <Body small muted>{`@${c.username}`}</Body> : null}</View>
                    {c.follow ? <Body small muted>{tl(c.follow === 'pending' ? 'Richiesta inviata' : 'Segui già')}</Body> : null}
                  </Row>
                </Item>
              ))}
            </Card>
          ) : <Body small muted>{tl('Cerca per nome e cognome o @nome utente. Chi ha scelto il profilo privato non compare: serve il suo codice o il suo QR.')}</Body>}
        </>
      )}
      <Sheet visible={scan} title="Scansiona il QR di un profilo" onClose={() => setScan(false)}><QrScanner onCode={(t) => { void scanned(t); }} onClose={() => setScan(false)} /></Sheet>
      <ProfilePreview card={card} onClose={() => setCard(null)} onChange={update} />
    </Page>
  );
}
