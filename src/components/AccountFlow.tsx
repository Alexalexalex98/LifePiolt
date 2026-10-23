import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Body, Btn, Card, H, Input, Row, Toggle } from '@/components/ui';
import { backend, restoreAccount, saveAccount, sendCode, verifyCode, type Backend } from '@/lib/accountApi';
import { EMPTY_FORM, MIN_AGE, emailOk, validateAccount, type AccountForm } from '@/lib/accountCore';
import { t as tl } from '@/i18n/core';
import { go } from '@/lib/nav';
import { useTheme } from '@/hooks/use-theme';
import { useEffect } from 'react';
import { Text } from '@/components/T';

type Mode = 'create' | 'login';
type Step = 'form' | 'login' | 'code';

/**
 * Crea un account o accedi: email + codice a 6 cifre, dati anagrafici, consensi a Termini e Informativa (con data e versione).
 * Un solo account per persona: l'email è l'identità, il codice la conferma. Si usa nell'onboarding e dalle Impostazioni.
 */
export function AccountFlow({ initial = 'create', onDone, onBack }: { initial?: Mode; onDone: () => void; onBack: () => void }) {
  const t = useTheme();
  const [mode, setMode] = useState<Mode>(initial);
  const [step, setStep] = useState<Step>(initial === 'login' ? 'login' : 'form');
  const [f, setF] = useState<AccountForm>(EMPTY_FORM);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<Partial<Record<keyof AccountForm, string>>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [be, setBe] = useState<Backend | null>(null);
  /** email già confermata con il codice: se manca solo il profilo non si richiede il codice */
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { void backend().then(setBe); }, []);
  const up = (k: keyof AccountForm, v: string | boolean) => { setF((x) => ({ ...x, [k]: v })); setErr((e) => ({ ...e, [k]: undefined })); };
  const E = ({ k }: { k: keyof AccountForm }) => (err[k] ? <Text style={{ color: t.danger, fontSize: 12, marginTop: 3 }}>{err[k]}</Text> : null);

  async function submitForm() {
    const e = validateAccount(f);
    setErr(e);
    if (Object.keys(e).length) { setNote('Controlla i campi evidenziati'); return; }
    setBusy(true); setNote('');
    if (confirmed) { const r = await saveAccount(f); setBusy(false); if (r.ok) onDone(); else setNote(r.message ?? ''); return; }
    const r = await sendCode(f.email);
    setBusy(false); setNote(r.message ?? '');
    if (r.ok) { setMode('create'); setStep('code'); }
  }
  async function submitLogin() {
    if (!emailOk(f.email)) { setErr({ email: 'Scrivi un indirizzo email valido' }); return; }
    setBusy(true); setNote('');
    const r = await sendCode(f.email);
    setBusy(false); setNote(r.message ?? '');
    if (r.ok) setStep('code');
  }
  async function submitCode() {
    setBusy(true); setNote('');
    const r = await verifyCode(f.email, code);
    if (!r.ok) { setBusy(false); setNote(r.message ?? 'Codice non valido'); return; }
    if (r.existing) { restoreAccount(f.email, r.existing, be === 'server'); setBusy(false); onDone(); return; }
    if (mode === 'login') {
      // l'email è confermata ma non c'è ancora un profilo: si compila il modulo senza richiedere un secondo codice
      setBusy(false); setConfirmed(true); setMode('create'); setStep('form'); setNote('Email confermata. Completa i tuoi dati per finire.'); return;
    }
    const s = await saveAccount(f);
    setBusy(false);
    if (s.ok) onDone(); else setNote(s.message ?? '');
  }

  const unavailable = be === 'none';
  return (
    <View style={{ gap: 10 }}>
      {unavailable ? <Card><H>Account non ancora attivo</H><Body small muted>Il server che custodisce gli account non è ancora collegato a questa versione dell'app. Nel frattempo puoi esplorare tutto con i dati demo, senza account.</Body></Card> : null}
      {be === 'test' ? <Card><Body small muted>Modalità di prova: nessun server collegato, nessuna email viene inviata e nessun dato lascia il telefono. Questo account non vale per le funzioni social.</Body></Card> : null}

      {step === 'form' ? (
        <>
          <H>Crea il tuo account</H>
          <Body small muted>Un account per persona: serve a collegare l'app a te, ritrovare i tuoi dati su un altro telefono e parlare con gli amici. L'email è la tua identità, la confermi con un codice.</Body>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Input placeholder="Nome" value={f.firstName} onChangeText={(v) => up('firstName', v)} autoCapitalize="words" autoComplete="given-name" accessibilityLabel="Nome" /><E k="firstName" /></View>
            <View style={{ flex: 1 }}><Input placeholder="Cognome" value={f.lastName} onChangeText={(v) => up('lastName', v)} autoCapitalize="words" autoComplete="family-name" accessibilityLabel="Cognome" /><E k="lastName" /></View>
          </View>
          <View><Input placeholder="Email" value={f.email} onChangeText={(v) => up('email', v)} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!confirmed} accessibilityLabel="Email" /><E k="email" /></View>
          <View><Input placeholder="Data di nascita (GG/MM/AAAA)" value={f.birth} onChangeText={(v) => up('birth', v)} keyboardType="numbers-and-punctuation" accessibilityLabel="Data di nascita" /><E k="birth" /></View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Input placeholder="Paese" value={f.country} onChangeText={(v) => up('country', v)} autoCapitalize="words" autoComplete="country" accessibilityLabel="Paese" /><E k="country" /></View>
            <View style={{ flex: 1 }}><Input placeholder="Città" value={f.city} onChangeText={(v) => up('city', v)} autoCapitalize="words" accessibilityLabel="Città" /><E k="city" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Input placeholder="CAP" value={f.postal} onChangeText={(v) => up('postal', v)} autoComplete="postal-code" accessibilityLabel="CAP" /><E k="postal" /></View>
            <View style={{ flex: 2 }}><Input placeholder="Via e numero" value={f.street} onChangeText={(v) => up('street', v)} autoCapitalize="words" autoComplete="street-address" accessibilityLabel="Via" /><E k="street" /></View>
          </View>
          <Body small muted>L'indirizzo completo serve per un account vero e per i servizi che lo richiedono. Nessun altro utente lo vede.</Body>
          <View>
            <Toggle value={f.age} onChange={(v) => up('age', v)} label={`Confermo di avere almeno ${MIN_AGE} anni`} /><E k="age" />
            <Toggle value={f.terms} onChange={(v) => up('terms', v)} label={<Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={4}><Body>Accetto i</Body><Btn small ghost title="Termini di servizio" onPress={() => go('legalDoc', { doc: 'terms' })} /></Row>} /><E k="terms" />
            <Toggle value={f.privacy} onChange={(v) => up('privacy', v)} label={<Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={4}><Body>Ho letto l'</Body><Btn small ghost title="Informativa sulla privacy" onPress={() => go('legalDoc', { doc: 'privacy' })} /></Row>} /><E k="privacy" />
          </View>
          <Body small muted>Salviamo data e versione di ciò che accetti, come prova del consenso. Dati e consensi stanno su un server nell'Unione Europea e si cancellano insieme all'account.</Body>
          {note ? <Body small>{tl(note)}</Body> : null}
          <Btn title={busy ? 'Un momento...' : confirmed ? 'Crea account' : 'Continua'} disabled={busy || unavailable} onPress={() => void submitForm()} />
          {!confirmed ? <Btn ghost small title="Ho già un account" onPress={() => { setStep('login'); setMode('login'); setNote(''); }} /> : null}
        </>
      ) : null}

      {step === 'login' ? (
        <>
          <H>Accedi</H>
          <Body small muted>Scrivi l'email del tuo account: ti mando un codice. Sul nuovo telefono ritrovi i tuoi dati.</Body>
          <View><Input placeholder="Email" value={f.email} onChangeText={(v) => up('email', v)} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" accessibilityLabel="Email" /><E k="email" /></View>
          {note ? <Body small>{tl(note)}</Body> : null}
          <Btn title={busy ? 'Un momento...' : 'Invia il codice'} disabled={busy || unavailable || !emailOk(f.email)} onPress={() => void submitLogin()} />
          <Btn ghost small title="Non ho un account: crealo" onPress={() => { setStep('form'); setMode('create'); setNote(''); }} />
        </>
      ) : null}

      {step === 'code' ? (
        <>
          <H>Inserisci il codice</H>
          <Body small muted>{tl('Codice inviato a {0}.', f.email.trim().toLowerCase())}</Body>
          <Input placeholder="Codice di conferma" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" maxLength={10} autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'} textContentType="oneTimeCode" accessibilityLabel="Codice" />
          {note ? <Body small>{tl(note)}</Body> : null}
          <Btn title={busy ? 'Controllo...' : 'Conferma'} disabled={busy || code.length < 6} onPress={() => void submitCode()} />
          <Row gap={8} style={{ justifyContent: 'flex-start' }}>
            <Btn small ghost title="Invia un nuovo codice" disabled={busy} onPress={() => { void sendCode(f.email).then((r) => setNote(r.message ?? '')); }} />
            <Btn small ghost title="Cambia email" onPress={() => { setCode(''); setNote(''); setStep(mode === 'login' ? 'login' : 'form'); }} />
          </Row>
        </>
      ) : null}

      <Btn ghost small title="Indietro" onPress={onBack} />
    </View>
  );
}
