import { Platform, View } from 'react-native';

import { Body, Card, H, Page, Row, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { LOCK_CATS } from '@/lib/lockScreen';
import { previewItems } from '@/lib/lockSync';
import { Icon } from '@/lib/icons';
import { useLockScreen } from '@/store/lockScreen';

/** Cosa compare sul blocco schermo e nei widget. Tutto resta sul telefono: il widget legge solo ciò che scegli qui. */
export default function LockScreenSettings() {
  const t = useTheme();
  const s = useLockScreen();
  const items = previewItems();
  return (
    <Page id="lockScreenSettings" back title="Blocco schermo e widget">
      <Card>
        <Row><View style={{ flex: 1 }}><H>Mostra sul blocco schermo</H><Body small muted>Aggiungi il widget LifePilot dal blocco schermo (tieni premuto, Personalizza) o dalla schermata Home. Quando un turno è in corso compare da solo sul blocco schermo con il conto alla rovescia.</Body></View><Switch value={s.on} onValueChange={(v) => s.set({ on: v })} accessibilityLabel="Mostra sul blocco schermo" /></Row>
        {Platform.OS !== 'ios' ? <Body small muted style={{ marginTop: 8 }}>Per ora i widget del blocco schermo funzionano su iPhone.</Body> : null}
      </Card>

      <Card>
        <H>Cosa mostrare</H>
        {LOCK_CATS.map((c) => (
          <Row key={c.id} style={{ marginTop: 10 }}>
            <View style={{ flex: 1 }}><Body bold>{c.label}</Body><Body small muted>{c.note}</Body></View>
            <Switch value={s.cats[c.id]} onValueChange={() => s.toggle(c.id)} accessibilityLabel={c.label} />
          </Row>
        ))}
      </Card>

      <Card>
        <Row><View style={{ flex: 1 }}><H>Privacy</H><Body small muted>Il blocco schermo lo vede chiunque abbia il telefono in mano. Con questa opzione compaiono solo il tipo e l'ora («Turno di lavoro, 14:00»), senza nomi e senza il testo dei task.</Body></View><Switch value={s.hideTitles} onValueChange={(v) => s.set({ hideTitles: v })} accessibilityLabel="Nascondi i nomi sul blocco schermo" /></Row>
        <Body small muted style={{ marginTop: 8 }}>Salute, soldi e messaggi non compaiono mai.</Body>
      </Card>

      <Card>
        <H>Anteprima</H>
        {!s.on || !items.length ? <Body muted style={{ marginTop: 6 }}>Niente da mostrare adesso.</Body> : items.map((it) => (
          <Row key={it.kind} gap={10} style={{ marginTop: 10, justifyContent: 'flex-start' }}>
            <Icon name={it.kind === 'turni' ? 'briefcase' : it.kind === 'impegni' ? 'calendar' : it.kind === 'task' ? 'tasks' : it.kind === 'acqua' ? 'drop' : 'lifefitness'} size={18} color={it.color} />
            <View style={{ flex: 1 }}><Body bold>{tl(it.title)}</Body>{it.sub ? <Body small muted>{it.sub}</Body> : null}</View>
          </Row>
        ))}
      </Card>
    </Page>
  );
}
