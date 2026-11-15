import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { QrCode } from '@/components/bills/QrCode';
import { AudienceSelect } from '@/components/people/AudienceSelect';
import { SocialGate } from '@/components/people/SocialGate';
import { Text } from '@/components/T';
import { Body, Btn, Card, H, Input, Page, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { go } from '@/lib/nav';
import { cleanUsername, formatCode, qrPayload, usernameProblem, type Me } from '@/lib/people';
import { myProfile, setPrivacy, setUsername } from '@/lib/peopleApi';
import { serverState, type ServerState } from '@/lib/teams';
import { usePrefs } from '@/store/prefs';
import { toast } from '@/store/toast';

/** Il mio codice: QR e codice univoci (fissi), nome utente facoltativo e privacy del profilo. Nome e cognome ci sono sempre; i dati personali (via, età, email) non si vedono mai. */
function MyCodeInner() {
  const th = useTheme(); const [me, setMe] = useState<Me | null>(null); const [server, setServer] = useState<ServerState | null>(null); const [user, setUser] = useState(''); const [busy, setBusy] = useState(false); const [now] = useState(() => Date.now());
  const audience = usePrefs((s) => s.postAudience); const setAudience = usePrefs((s) => s.setPostAudience);
  const load = async () => { const r = await myProfile(); if (r.ok) { setMe(r.data); setUser(r.data.username ?? ''); } else toast(r.message); };
  useEffect(() => { void serverState().then((s) => { setServer(s); if (s === 'ok') void load(); }); }, []);
  const saveUser = async () => {
    const p = usernameProblem(user); if (p) { toast(p); return; }
    setBusy(true); const r = await setUsername(cleanUsername(user)); setBusy(false);
    if (!r.ok) { toast(r.message); return; }
    toast(r.data ? 'Nome utente salvato' : 'Nome utente tolto'); await load();
  };
  const privacy = async (discoverable: boolean, approval: boolean) => {
    if (!me) return; const prev = me; setMe({ ...me, discoverable, follow_approval: approval });
    const r = await setPrivacy(discoverable, approval); if (!r.ok) { setMe(prev); toast(r.message); }
  };
  const copy = async () => { if (!me) return; try { await Clipboard.setStringAsync(formatCode(me.code)); toast('Codice copiato'); } catch { toast('Non riesco a copiare: leggilo e scrivilo a mano'); } };
  const when = me?.can_change_username_at ? new Date(me.can_change_username_at) : null; const locked = !!(me?.username && when && when.getTime() > now);

  return (
    <Page id="myCode" title="Il mio codice" back>
      {server && server !== 'ok' ? (
        <Card accent={th.warn}><H>Serve un account</H><Body muted>{tl('Il codice e il profilo online servono un account verificato e la connessione al server. Con la demo non si possono creare.')}</Body></Card>
      ) : !me ? <Body muted>{tl('Carico il tuo profilo…')}</Body> : (
        <>
          <Card accent={th.accent}>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <View style={{ backgroundColor: '#fff', padding: 8, borderRadius: 14 }}><QrCode value={qrPayload(me.code)} size={210} /></View>
              <Text style={{ color: th.text, fontSize: 18, fontWeight: '800' }}>{me.display_name}</Text>
              {me.username ? <Body muted>{`@${me.username}`}</Body> : null}
              <Text selectable style={{ color: th.text, fontSize: 28, fontWeight: '800', letterSpacing: 3 }}>{formatCode(me.code)}</Text>
              <Btn small ghost icon="file" title="Copia il codice" onPress={() => { void copy(); }} />
              <Body small muted style={{ textAlign: 'center' }}>{tl('Il QR e il codice sono solo tuoi e non cambiano mai. Chi li ha può trovarti anche se il tuo profilo è privato. Dentro non ci sono dati personali.')}</Body>
            </View>
          </Card>
          <Card>
            <H>Nome utente (facoltativo)</H>
            <Input placeholder="per esempio anna.verdi" value={user} onChangeText={setUser} autoCapitalize="none" editable={!locked} />
            <Body small muted style={{ marginTop: 6 }}>{locked ? tl('Puoi cambiarlo di nuovo dal {0}.', when!.toLocaleDateString()) : tl('3-20 caratteri: lettere, numeri, punto e trattino basso. Si può cambiare una volta ogni 30 giorni. Se lo lasci vuoto, ti trovano con nome e cognome, codice o QR.')}</Body>
            <Btn icon="check" disabled={busy || locked} title={busy ? 'Un attimo…' : 'Salva'} onPress={() => { void saveUser(); }} style={{ marginTop: 10 }} />
          </Card>
          <Card>
            <H>Chi può trovarti</H>
            <Toggle label={tl('Fatti trovare cercando il mio nome')} value={me.discoverable} onChange={(v) => { void privacy(v, me.follow_approval); }} hint={me.discoverable ? tl('Compari nelle ricerche per nome, cognome e nome utente.') : tl('Profilo privato: non compari nelle ricerche. Ti trova solo chi ha il tuo QR o il tuo codice, o chi arriva da un tuo annuncio o post pubblico.')} />
            <Toggle label={tl('Approvo io chi mi segue')} value={me.follow_approval} onChange={(v) => { void privacy(me.discoverable, v); }} hint={tl('Chi vuole seguirti manda una richiesta e tu la accetti.')} />
            <Body small muted style={{ marginTop: 4 }}>{tl('Nome e cognome si vedono sempre. Indirizzo, età, email e telefono non si vedono mai.')}</Body>
          </Card>
          <Card>
            <H>I miei nuovi post</H>
            <AudienceSelect post value={audience} onChange={(a) => { if (a !== 'not_followers') setAudience(a); }} />
            <Body small muted style={{ marginTop: 8 }}>{tl('Per annunci, servizi, seminari e idee scegli il pubblico quando li pubblichi: tutti, solo chi ti segue, oppure tutti tranne chi ti segue.')}</Body>
          </Card>
          <Btn ghost icon="users" title="Trova persone" onPress={() => go('people')} />
        </>
      )}
    </Page>
  );
}

export default function MyCode() { return <SocialGate id="myCode" title="Il tuo codice"><MyCodeInner /></SocialGate>; }
