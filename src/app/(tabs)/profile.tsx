import { useState } from 'react';
import { View } from 'react-native';
import { UserAvatar } from '@/components/network';
import { AutomationsSheet } from '@/components/Automations';
import { KnowledgeHub, type HubSection } from '@/components/KnowledgeHub';
import { useInterests } from '@/store/interests';

import { Body, Btn, Card, Chev, H, Item, Metric, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { summarize } from '@/lib/dataCatalog';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { computeScores } from '@/lib/scores';
import { useApp } from '@/store/app';
import { useFin } from '@/store/finance';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { styleLabel, usePrefs } from '@/store/prefs';
import { useChoices } from '@/store/sharing';
import { t as tl } from '@/i18n/core';

type SheetKey = null | 'know' | 'module';

/** Moduli futuri: cosa sono, a che punto sono e (se esiste già qualcosa) dove aprirli. */
const modules: { name: string; icon: string; what: string; state: string; page?: string; pageLabel?: string }[] = [
  { name: 'Social', icon: 'users', what: 'Feed, post e interazioni tra persone, per condividere avanzamenti e idee.', state: 'Una prima versione è già in LifeNetwork.', page: 'lifenetwork', pageLabel: 'Apri LifeNetwork' },
  { name: 'Community', icon: 'users', what: 'Gruppi e community tematiche con chat e eventi.', state: 'Gruppi e chat sono già disponibili in LifeNetwork.', page: 'lifenetwork', pageLabel: 'Apri LifeNetwork' },
  { name: 'Marketplace', icon: 'briefcase', what: 'Servizi, seminari e offerte di lavoro tra utenti.', state: 'Una versione dimostrativa è in LifeNetwork.', page: 'lifenetwork', pageLabel: 'Apri LifeNetwork' },
  { name: 'Wallet', icon: 'euro', what: 'Portafoglio per pagamenti e punti, collegato alle tue finanze.', state: 'Oggi esistono solo i LifePoints; i pagamenti reali richiedono un provider e la conformità normativa.', page: 'lifepointsPage', pageLabel: 'Apri i LifePoints' },
  { name: 'Investments', icon: 'chart', what: 'Portafoglio titoli, ordini e watchlist.', state: 'Disponibile in modalità simulata, senza denaro reale.', page: 'portfolio', pageLabel: 'Apri il portafoglio' },
  { name: 'Travel', icon: 'lifetravel', what: 'Pianificazione viaggi, voli e hotel.', state: 'Disponibile con dati d\'esempio.', page: 'lifetravel', pageLabel: 'Apri LifeTravel' },
  { name: 'Translate', icon: 'repeat', what: 'Traduzione di testi e conversazioni dentro l\'app.', state: 'Non ancora disponibile: serve un servizio di traduzione esterno.' },
  { name: 'Voice Calls', icon: 'mic', what: 'Chiamate vocali tra utenti.', state: 'Non ancora disponibile: servono un backend e un provider di chiamate.' },
  { name: 'Hardware', icon: 'gear', what: 'Dispositivi collegati (sensori e accessori LifePilot).', state: 'Non ancora disponibile: dipende dal prodotto fisico in sviluppo.' },
];

export default function Profile() {
  const t = useTheme();
  const { account } = useApp();
  const { goals, automations } = useLife();
  const answerStyle = usePrefs((s) => s.answerStyle);
  useHealth((s) => s.series); useFin((s) => s.months);
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [focus, setFocus] = useState<HubSection | null>(null);
  const [autoSheet, setAutoSheet] = useState(false);
  const nInterests = useInterests((x) => x.selected.length + x.custom.length);
  const [mod, setMod] = useState<(typeof modules)[number] | null>(null);
  const sc = computeScores();
  const main = goals.slice().sort((a, b) => b.p - a.p)[0];
  const sum = summarize(useChoices());
  const close = () => setSheet(null);
  const openHub = (f: HubSection | null) => { setFocus(f); setSheet('know'); };

  return (
    <Page id="profile" title="Profilo & Memory">
      <Card onPress={() => go('userProfile', { name: account.name })}>
        <Row style={{ justifyContent: 'flex-start' }}>
          <UserAvatar name={account.name} size={46} />
          <View style={{ flex: 1 }}>
            <H>{account.name}</H>
            <Body small muted>Il tuo profilo LifeNetwork · post, follower, voti, biglietto da visita</Body>
          </View>
          <Chev />
        </Row>
      </Card>
      <Card onPress={() => go('life')}>
        <Row>
          <View style={{ flex: 1 }}><H>La tua vita</H><Body small muted>Life Score, Health, Mind, Finance, Growth e altro</Body></View>
          <Metric>{sc.total ?? '—'}</Metric>
        </Row>
      </Card>
      <Card>
        <H>Cosa LifePilot sa di te</H>
        <Body small muted style={{ marginBottom: 4 }}>Memoria, interessi e preferenze in un'unica schermata. Resta tutto sul tuo telefono.</Body>
        <Item onPress={() => openHub('obiettivi')}><Row><Body style={{ flex: 1 }}>Obiettivo principale · {main ? main.t : 'non ancora impostato'}</Body><Chev /></Row></Item>
        <Item onPress={() => setAutoSheet(true)}><Row><Body style={{ flex: 1 }}>Automazioni attive · {automations.filter((a) => a.on).length}</Body><Chev /></Row></Item>
        <Item onPress={() => openHub('interessi')}><Row><Body style={{ flex: 1 }}>Interessi e città · {nInterests ? nInterests : 'non ancora scelti'}</Body><Chev /></Row></Item>
        <Item last onPress={() => openHub('preferenze')}><Row><Body style={{ flex: 1 }}>Preferenza · {styleLabel(answerStyle)}</Body><Chev /></Row></Item>
        <Btn small ghost style={{ marginTop: 10 }} title="Vedi e gestisci tutto" onPress={() => openHub(null)} />
      </Card>
      <Card onPress={() => go('sharing')}>
        <Row>
          <View style={{ flex: 1 }}>
            <H>Cosa condivido</H>
            <Body small muted>{tl('Condivisi: {0} · Segreti: {1}. Vedi e cambia in ogni momento cosa è condiviso e con chi.', sum.shared, sum.secret)}</Body>
          </View>
          <Icon name="shield" size={22} color={t.accent} stroke={1.9} />
        </Row>
      </Card>
      <Card onPress={() => go('settings')}>
        <H>Settings</H>
        <Body small muted>Integrazioni, privacy, notifiche, aspetto · tocca per aprire</Body>
      </Card>
      <Card>
        <H>Moduli futuri</H>
        <Body small muted style={{ marginBottom: 8 }}>Tocca un modulo per vedere a che punto è.</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{modules.map((x) => <Pill key={x.name} label={x.name} icon={x.icon} onPress={() => { setMod(x); setSheet('module'); }} />)}</View>
        <Body small muted>Presenti nella mappa prodotto; richiedono backend, provider esterni e, per finanza/pagamenti, compliance dedicata.</Body>
      </Card>

      <AutomationsSheet visible={autoSheet} onClose={() => setAutoSheet(false)} />
      <Sheet visible={sheet === 'know'} title="Cosa LifePilot sa di te" onClose={close}>
        <KnowledgeHub key={focus ?? 'all'} focus={focus} onOpenAutomations={() => { setSheet(null); setAutoSheet(true); }} />
      </Sheet>

      {/* moduli futuri */}
      <Sheet visible={sheet === 'module'} title={mod?.name ?? ''} onClose={close}>
        {mod && (
          <>
            <Body>{mod.what}</Body>
            <View style={{ backgroundColor: t.accent + '1f', borderRadius: 12, padding: 10, marginVertical: 12 }}><Body small>Stato: {mod.state}</Body></View>
            {mod.page ? <Btn title={mod.pageLabel ?? 'Apri'} onPress={() => { close(); go(mod.page!); }} /> : <Body small muted>Lo aggiungeremo quando i requisiti tecnici saranno pronti.</Body>}
          </>
        )}
      </Sheet>
      <View style={{ height: 1, backgroundColor: t.bg }} />
    </Page>
  );
}
