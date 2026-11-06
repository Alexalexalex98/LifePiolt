import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, Card, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { openDocument } from '@/lib/openDoc';
import { coverage, durationLabel, expiryOf, legalExpiry, nextExpiry, productExpiry, progress, purchaseTitle, remaining, statusOf, type Purchase, type Status } from '@/lib/warranty';

const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const money = (n: number, c: string) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;
const EXT = '#8b5cf6';
const INS = '#2563eb';
export const STATUS_LABEL: Record<Status, string> = { attiva: 'Attiva', 'in scadenza': 'In scadenza', scaduta: 'Scaduta' };

/** Una scheda per acquisto: il nome di tutti i prodotti e, per ognuno, i dati e il conto alla rovescia dalla data di acquisto alla scadenza. */
export function WarrantyCard({ p, today, onEdit, onDelete }: { p: Purchase; today: string; onEdit: () => void; onDelete: () => void }) {
  const th = useTheme();
  const color = (s: Status) => (s === 'attiva' ? '#22c55e' : s === 'in scadenza' ? '#f59e0b' : th.danger);
  const worst = statusOf(nextExpiry(p, today), today);
  return (
    <Card accent={color(worst)}>
      <Row>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${color(worst)}22`, alignItems: 'center', justifyContent: 'center' }}><Icon name="shield" size={20} color={color(worst)} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontSize: 17, fontWeight: '800' }}>{purchaseTitle(p)}</Text>
          <Body small muted>{[p.store, `${tl('acquistato il')} ${fmt(p.date)}`, p.total != null ? money(p.total, p.currency) : ''].filter(Boolean).join(' · ')}</Body>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: `${color(worst)}22` }}><Text style={{ color: color(worst), fontWeight: '800', fontSize: 12 }}>{tl(STATUS_LABEL[worst])}</Text></View>
      </Row>
      {p.products.map((x) => {
        const ex = productExpiry(p, x); const st = statusOf(ex, today); const rem = remaining(today, ex); const pr = Math.round(progress(p.date, ex, today) * 100);
        const cv = coverage(x); const lex = legalExpiry(p.date, x); const legalLeft = remaining(today, lex);
        return (
          <View key={x.id} style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: th.border }}>
            <Row><Text style={{ color: th.text, fontSize: 15, fontWeight: '800', flex: 1 }}>{x.name}</Text>{cv.extended ? <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: `${EXT}22` }}><Text style={{ color: EXT, fontWeight: '800', fontSize: 11 }}>{tl('Prolungata')}</Text></View> : null}</Row>
            {[[x.brand, x.model].filter(Boolean).join(' · '), x.serial ? `${tl('N. di serie')}: ${x.serial}` : '', x.price != null ? `${tl('Prezzo')}: ${money(x.price, p.currency)}` : ''].filter(Boolean).map((l, i) => <Body key={i} small muted>{l}</Body>)}

            <View style={{ marginTop: 8, gap: 4 }}>
              <Row><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: th.muted }} /><Body small style={{ flex: 1 }}>{`${tl('Garanzia legale')} · ${durationLabel(cv.legal)}${x.assumed ? ` (${tl('non scritta sul documento')})` : ''}`}</Body><Body small bold>{`${tl('fino al')} ${fmt(lex)}`}</Body></Row>
              {cv.extended ? <Row><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: EXT }} /><Body small style={{ flex: 1 }}>{`${tl('Estensione')} · +${durationLabel(cv.extra)}${x.ext?.by ? ` · ${x.ext.by}` : ''}${x.ext?.name ? ` · ${x.ext.name}` : ''}${x.ext?.cost != null ? ` · ${money(x.ext.cost, p.currency)}` : ''}`}</Body><Body small bold>{`${tl('fino al')} ${fmt(ex)}`}</Body></Row> : null}
            </View>

            {x.ins ? (() => { const iex = x.ins.months ? expiryOf(p.date, x.ins.months) : null; return (
              <View style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: `${INS}18`, gap: 2 }}>
                <Row><Icon name="shield" size={16} color={INS} /><Text style={{ color: th.text, fontWeight: '800', flex: 1 }}>{tl('Assicurazione')}</Text><View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: `${INS}30` }}><Text style={{ color: INS, fontWeight: '800', fontSize: 11 }}>{tl(x.ins.kind)}</Text></View></Row>
                <Body small>{[x.ins.name, x.ins.by, x.ins.cost != null ? money(x.ins.cost, p.currency) : ''].filter(Boolean).join(' · ')}</Body>
                {iex ? <Body small muted>{`${durationLabel(x.ins.months!)} · ${tl('fino al')} ${fmt(iex)} · ${tl(remaining(today, iex).label)}`}</Body> : <Body small muted>{tl('Durata non indicata sul documento')}</Body>}
                <Body small muted>{tl('Non è una garanzia: copre altro (per esempio furto o danni).')}</Body>
              </View>
            ); })() : null}
            <Text style={{ color: color(st), fontSize: 20, fontWeight: '800', marginTop: 10 }} accessibilityLiveRegion="polite">{tl(rem.label)}</Text>
            {cv.extended ? <Body small muted>{legalLeft.expired ? tl('La garanzia legale è finita: ora vale l\'estensione.') : tl('La garanzia legale: {0}', tl(legalLeft.label).toLowerCase())}</Body> : null}
            <CoverageBar legal={cv.legal} extra={cv.extra} elapsed={pr} color={color(st)} />
            <Row style={{ marginTop: 4 }}><Body small muted style={{ flex: 1 }}>{`${tl('Acquisto')} ${fmt(p.date)}`}</Body><Body small muted>{`${pr}% ${tl('trascorso')}`}</Body></Row>
          </View>
        );
      })}
      {p.note ? <View style={{ marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: th.chip }}><Body small bold muted>{tl('NOTE').toUpperCase()}</Body><Body small>{p.note}</Body></View> : null}
      <Row style={{ marginTop: 14, flexWrap: 'wrap' }}>
        {p.pdf ? <Btn small icon="file" title="Fattura (PDF)" onPress={() => { void openDocument({ uri: p.pdf, name: `${purchaseTitle(p)}.pdf`, mime: 'application/pdf' }); }} /> : null}
        <Btn small ghost icon="edit" title="Modifica" onPress={onEdit} />
        <Btn small ghost danger icon="trash" title="" onPress={onDelete} />
      </Row>
    </Card>
  );
}

/** La barra dell'intera garanzia: la parte di legge e, in un altro colore, l'estensione; sopra, quanto tempo è già passato. */
function CoverageBar({ legal, extra, elapsed, color }: { legal: number; extra: number; elapsed: number; color: string }) {
  const th = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: elapsed }} style={{ height: 10, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', marginTop: 8, backgroundColor: th.border }}>
      <View style={{ flex: legal, backgroundColor: th.border }} />
      {extra ? <View style={{ flex: extra, backgroundColor: `${EXT}55` }} /> : null}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(1, elapsed)}%`, backgroundColor: color, opacity: 0.9 }} />
    </View>
  );
}
