import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Share, View } from 'react-native';

import { Body, Btn, Card, H, Input, Page, Row } from '@/components/ui';
import { normalizeCode, showCode, type Friend } from '@/lib/friendsCore';
import { go } from '@/lib/nav';
import { blockUser, myFriendCode, removeFriend, requestFriend, respondFriend } from '@/social/friendsApi';
import { pullDms, refreshFriends } from '@/social/dmSync';
import { socialSession } from '@/social/socialApi';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { useAccount } from '@/store/account';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useFriends } from '@/store/friends';
import { toast } from '@/store/toast';

/** Amici veri: il tuo codice, le richieste e la lista. Per scrivere a qualcuno serve il suo codice e che accetti. */
export default function FriendsPage() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const status = useAccount((s) => s.status);
  const { friends, code } = useFriends();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const s = await socialSession();
    setOnline(!!s);
    if (!s) return;
    await refreshFriends(s);
    if (!useFriends.getState().code) { const c = await myFriendCode(s); if (c.code) useFriends.getState().set({ code: c.code }); else if (c.error) setNote(c.error); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: (s: NonNullable<Awaited<ReturnType<typeof socialSession>>>) => Promise<{ ok: boolean; error?: string }>, ok: string) => {
    setBusy(true); setNote('');
    const s = await socialSession();
    if (!s) { setBusy(false); setNote('Non sei collegato al server.'); return; }
    const r = await fn(s);
    setBusy(false);
    if (!r.ok) { setNote(('error' in r && r.error) || 'Non riuscito'); return; }
    toast(ok); await refreshFriends(s); void pullDms(s);
  };
  const add = () => {
    const c = normalizeCode(input);
    if (!c) { setNote('Il codice ha 8 caratteri (lettere e numeri), per esempio ABCD-2345.'); return; }
    void act((s) => requestFriend(s, c), 'Richiesta inviata').then(() => setInput(''));
  };
  const write = (f: Friend) => { const id = useChat.getState().ensureDm(f.chat, me); go('conversationPage', { id }); };
  const by = (st: Friend['status']) => friends.filter((f) => f.status === st);
  const noAccount = status !== 'verified';

  return (
    <Page id="friendsPage" back title="Amici">
      {noAccount ? (
        <Card><H>Serve un account</H><Body small muted>Per avere amici veri e scrivere loro serve un account confermato. Crealo da Impostazioni → Account.</Body></Card>
      ) : online === false ? (
        <Card><H>Non sei collegato al server</H><Body small muted>Esci e accedi di nuovo da Impostazioni → Account, poi prova «Prova il collegamento social».</Body></Card>
      ) : (
        <>
          <Card accent={t.accent}>
            <H>Il tuo codice amico</H>
            <Body small muted style={{ marginTop: 2 }}>Dallo solo a chi vuoi come amico: senza il codice nessuno può trovarti. Puoi smettere di essere amico di qualcuno quando vuoi.</Body>
            <Body bold style={{ fontSize: 30, letterSpacing: 3, marginTop: 8 }}>{code ? showCode(code) : '…'}</Body>
            <Row style={{ justifyContent: 'flex-start', marginTop: 8 }} gap={8}>
              <Btn small ghost title="Copia" disabled={!code} onPress={() => { void Clipboard.setStringAsync(code); toast('Codice copiato'); }} />
              <Btn small title="Condividi" disabled={!code} onPress={() => { void Share.share({ message: tl('Aggiungimi su LifePilot: il mio codice amico è {0}', showCode(code)) }); }} />
            </Row>
          </Card>

          <Card>
            <H>Aggiungi un amico</H>
            <Input placeholder="Codice amico (es. ABCD-2345)" value={input} onChangeText={setInput} autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Codice amico" />
            <Btn style={{ marginTop: 8 }} title={busy ? 'Un momento...' : 'Invia richiesta'} disabled={busy || !input.trim()} onPress={add} />
            {note ? <Body small style={{ marginTop: 6, color: t.danger }}>{tl(note)}</Body> : null}
          </Card>

          {by('pending_in').length ? (
            <Card>
              <H>Richieste ricevute</H>
              {by('pending_in').map((f) => (
                <View key={f.id} style={{ marginTop: 8 }}>
                  <Body bold>{f.name}</Body>
                  <Row style={{ justifyContent: 'flex-start', marginTop: 4 }} gap={8}>
                    <Btn small title="Accetta" disabled={busy} onPress={() => void act((s) => respondFriend(s, f.id, true), 'Ora siete amici')} />
                    <Btn small ghost title="Rifiuta" disabled={busy} onPress={() => void act((s) => respondFriend(s, f.id, false), 'Richiesta rifiutata')} />
                    <Btn small ghost danger title="Blocca" disabled={busy} onPress={() => void act((s) => blockUser(s, f.id), 'Bloccato')} />
                  </Row>
                </View>
              ))}
            </Card>
          ) : null}

          <Card>
            <H>I tuoi amici</H>
            {by('accepted').length ? by('accepted').map((f) => (
              <View key={f.id} style={{ marginTop: 10 }}>
                <Body bold>{f.name}</Body>
                <Row style={{ justifyContent: 'flex-start', marginTop: 4, flexWrap: 'wrap' }} gap={8}>
                  <Btn small icon="comment" title="Scrivi" onPress={() => write(f)} />
                  <Btn small ghost title="Togli" disabled={busy} onPress={() => void act((s) => removeFriend(s, f.id), 'Tolto dagli amici')} />
                  <Btn small ghost danger title="Blocca" disabled={busy} onPress={() => void act((s) => blockUser(s, f.id), 'Bloccato')} />
                </Row>
              </View>
            )) : <Body small muted style={{ marginTop: 4 }}>Ancora nessun amico. Scambiatevi il codice: uno lo inserisce, l'altro accetta.</Body>}
            {by('pending_out').length ? (
              <View style={{ marginTop: 12 }}>
                <Body small muted>In attesa che accettino:</Body>
                {by('pending_out').map((f) => (
                  <Row key={f.id} style={{ marginTop: 4 }}><Body>{f.name}</Body><Btn small ghost title="Annulla" disabled={busy} onPress={() => void act((s) => removeFriend(s, f.id), 'Richiesta annullata')} /></Row>
                ))}
              </View>
            ) : null}
            {by('blocked').length ? (
              <View style={{ marginTop: 12 }}>
                <Body small muted>Bloccati:</Body>
                {by('blocked').map((f) => <Row key={f.id} style={{ marginTop: 4 }}><Body>{f.name}</Body><Btn small ghost title="Sblocca" disabled={busy} onPress={() => void act((s) => removeFriend(s, f.id), 'Sbloccato')} /></Row>)}
              </View>
            ) : null}
          </Card>

          <Body small muted>I messaggi con gli amici passano dal server e per ora non sono cifrati da un capo all'altro: non scrivere dati che non vuoi che si possano leggere. Online passa solo il testo.</Body>
        </>
      )}
    </Page>
  );
}
