import { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useProposals } from '@/lib/theia/useRadar';
import { useRadar as useRadarStore } from '@/store/radar';
import { Image } from 'expo-image';

import { Chrome, Tile, type TileRow } from '@/components/dash/Tile';
import { useDashData } from '@/components/dash/data';
import type { WProps } from '@/components/dash/widgetsA';
import { Text } from '@/components/T';
import { useUI } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { formatMoney } from '@/i18n/format';
import { Icon } from '@/lib/icons';
import { BY_SYM } from '@/lib/markets/catalog';
import { portfolio } from '@/lib/markets/invest';
import { agoText } from '@/lib/news/rss';
import { go } from '@/lib/nav';
import { dayKey } from '@/lib/format';
import { useFin } from '@/store/finance';
import { useLife } from '@/store/life';
import { dayChangePct, loadHistory, priceLp, priceUsd, useMarkets } from '@/store/markets';
import { useNet } from '@/store/network';
import { useNews } from '@/store/news';

const base = (p: WProps) => ({ w: p.w, h: p.h, pw: p.pw, ph: p.ph });
const C = { soldi: '#7be0b0', news: '#e0c97b', net: '#c9b6ff', trip: '#e0c97b', theia: '#8fa4ff', mercati: '#7be0b0' };
const money = (n: number) => formatMoney(Math.round(n));
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')}%`;

/* ---------------- Finanza ---------------- */
export function BalanceW(p: WProps) {
  const { fin } = useDashData();
  const cur = fin?.cur;
  const bal = fin?.balance ?? [];
  const prev = bal.length > 1 ? bal[bal.length - 2] : null;
  const d = cur && prev != null ? cur.end - prev : null;
  return <Tile {...base(p)} icon="wallet" label={tl('Saldo')} color={C.soldi} value={cur ? money(cur.end) : undefined} delta={d == null ? undefined : { text: `${d > 0 ? '+' : ''}${money(d)}`, good: d === 0 ? null : d > 0 }} sub={d == null ? undefined : tl('rispetto al mese scorso')} series={bal} empty={tl('Carica un estratto conto')} onPress={() => go('lifefinance', { ex: 'saldo' })}
    rows={cur ? [{ label: tl('Entrate'), value: money(cur.income), color: C.soldi, onPress: () => go('lifefinance', { ex: 'in' }) }, { label: tl('Uscite'), value: money(cur.expense), color: '#ff9d9d', onPress: () => go('lifefinance', { ex: 'out' }) }, { label: tl('Risparmio'), value: money(cur.saved), color: '#8fa4ff', onPress: () => go('lifefinance', { ex: 'save' }) }] : undefined} />;
}

export function SpendW(p: WProps) {
  const { fin } = useDashData();
  const cur = fin?.cur;
  return <Tile {...base(p)} icon="trend-down" label={tl('Spese del mese')} color="#ff9d9d" value={cur ? money(cur.expense) : undefined} series={fin?.series.map((s) => s.expense)} sub={cur ? `${tl('Entrate')}: ${money(cur.income)}` : undefined} empty={tl('Carica un estratto conto')} onPress={() => go('lifefinance', { ex: 'out' })} />;
}

export function SavingW(p: WProps) {
  const { dash, openMetric } = useDashData();
  const a = dash.byId.savings;
  return <Tile {...base(p)} icon="coin" label={tl('Risparmio')} color={C.soldi} value={a ? `${Math.round(a.latest.v)}%` : undefined} sub={a ? tl('del reddito messo da parte') : undefined} progress={a ? a.latest.v / 100 : undefined} series={a?.pts.map((x) => x.v)} empty={tl('Nessun dato ancora')} onPress={() => { if (!openMetric('savings')) go('lifefinance', { ex: 'save' }); }} />;
}

export function BillsW(p: WProps) {
  const bills = useFin((s) => s.bills);
  const monthly = bills.reduce((s, b) => s + (b.freq === 'monthly' ? b.amount : b.amount / 12), 0);
  return <Tile {...base(p)} icon="file" label={tl('Bollette e abbonamenti')} color="#e0c97b" value={bills.length ? money(monthly) : undefined} sub={bills.length ? `${bills.length} ${tl('voci al mese')}` : tl('Nessuna bolletta')} rows={bills.slice(0, 8).map((b) => ({ label: b.name, value: money(b.amount), onPress: () => go('lifefinance', { tab: 'Bollette' }) }))} empty={tl('Nessuna bolletta')} onPress={() => go('lifefinance', { tab: 'Bollette' })} />;
}

export function LpW(p: WProps) {
  const lp = useNet((s) => s.lifePoints);
  return <Tile {...base(p)} icon="coin" label="LifePoints" color="#8fa4ff" value={String(Math.round(lp))} unit="LP" onPress={() => go('lifepointsPage')} />;
}

/* ---------------- Mercati ---------------- */
const DEFAULT_SYMS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN'];
const useWatch = () => { const w = useMarkets((s) => s.watch); return w.length ? w : DEFAULT_SYMS; };
function useRefreshMarkets() { useEffect(() => { void useMarkets.getState().refresh(); }, []); }

export function StockW(p: WProps) {
  useRefreshMarkets();
  const watch = useWatch();
  const sym = p.cfg?.sym || watch[0];
  const mk = useMarkets();
  const price = priceLp(mk, sym);
  const chg = dayChangePct(mk, sym);
  const [hist, setHist] = useState<number[]>([]);
  useEffect(() => { let on = true; void loadHistory(sym, priceUsd(useMarkets.getState(), sym)).then((r) => { if (on) setHist(r.closes); }); return () => { on = false; }; }, [sym]);
  const name = BY_SYM[sym]?.name ?? sym;
  return <Tile {...base(p)} icon="trend-up" label={`${sym} · ${name}`} color={chg >= 0 ? C.soldi : '#ff9d9d'} value={`${price.toFixed(2)}`} unit="LP" delta={{ text: pct(chg), good: chg === 0 ? null : chg > 0 }} series={hist.slice(-90)} onPress={() => go('stockAnalysis', { sym })} />;
}

export function WatchW(p: WProps) {
  useRefreshMarkets();
  const watch = useWatch();
  const mk = useMarkets();
  const rows: TileRow[] = watch.map((s) => { const c = dayChangePct(mk, s); return { label: p.pw < 250 ? s : `${s} · ${BY_SYM[s]?.name ?? ''}`, value: `${priceLp(mk, s).toFixed(2)}  ${pct(c)}`, color: c >= 0 ? C.soldi : '#ff9d9d', onPress: () => go('stockAnalysis', { sym: s }) }; });
  return <Tile {...base(p)} icon="chart" label={tl('Titoli seguiti')} color={C.mercati} sub={mk.live ? tl('Prezzi con circa 15 minuti di ritardo') : tl('Prezzi dimostrativi')} rows={rows} onPress={() => go('stocks')} />;
}

export function PortfolioW(p: WProps) {
  const mk = useMarkets();
  const pf = portfolio(Object.values(mk.positions), (s) => priceLp(mk, s));
  return <Tile {...base(p)} icon="briefcase" label={tl('Portafoglio')} color={C.mercati} value={pf.cost > 0 ? `${pf.value.toFixed(0)}` : undefined} unit="LP" delta={pf.cost > 0 ? { text: `${pf.gain >= 0 ? '+' : ''}${pf.gain.toFixed(0)} LP · ${pct(pf.pct)}`, good: pf.gain === 0 ? null : pf.gain > 0 } : undefined} rows={pf.rows.slice(0, 6).map((r) => ({ label: r.sym, value: `${r.value.toFixed(0)} LP`, onPress: () => go('stockAnalysis', { sym: r.sym }) }))} sub={pf.cost > 0 ? undefined : tl('Nessun investimento')} empty={tl('Scegli un titolo e investi da 1 LP')} onPress={() => go('portfolio')} />;
}

/* ---------------- Notizie ---------------- */
export function NewsW(p: WProps) {
  const t = useTheme();
  const items = useNews((s) => s.items);
  const loading = useNews((s) => s.loading);
  const ok = useNews((s) => s.ok), total = useNews((s) => s.total), at = useNews((s) => s.updatedAt);
  const [k, setK] = useState(0);
  useEffect(() => { void useNews.getState().refresh(); const h = setInterval(() => { void useNews.getState().refresh(); }, 180000); return () => clearInterval(h); }, []);
  useEffect(() => { if (p.h > 1 || items.length < 2) return; const h = setInterval(() => setK((n) => n + 1), 6000); return () => clearInterval(h); }, [p.h, items.length]);
  const open = (u: string) => { void Linking.openURL(u).catch(() => undefined); };
  const cells = p.w * p.h;
  const rowsFit = Math.max(1, Math.floor((p.ph - 24 - 34) / (items.some((n) => n.image) && cells >= 8 ? 56 : 46)));
  const shown = p.h === 1 ? [items[k % Math.max(1, items.length)]].filter(Boolean) : items.slice(0, rowsFit);
  return (
    <Chrome pw={p.pw} ph={p.ph} color={C.news} label={tl('Notizie')}>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="note" size={15} color={C.news} stroke={2} />
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', flex: 1 }}>{tl('Notizie')}</Text>
          {p.pw >= 250 ? <Text numberOfLines={1} style={{ color: t.muted, fontSize: 10.5 }}>{loading ? tl('Aggiorno…') : at ? `${tl('Aggiornate')} ${agoText(at)}` : ''}</Text> : null}
        </View>
        {!shown.length ? <Text style={{ color: t.muted, fontSize: 12.5 }}>{loading ? tl('Carico le notizie…') : tl('Non riesco a caricare le notizie. Controlla la connessione.')}</Text> : null}
        {shown.map((n) => (
          <Pressable key={n.id} accessibilityRole="link" accessibilityLabel={n.title} onPress={() => open(n.link)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {n.image && cells >= 4 && p.h > 1 ? <Image source={{ uri: n.image }} style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: t.chip }} contentFit="cover" /> : null}
            <View style={{ flex: 1 }}>
              <Text numberOfLines={p.h === 1 ? 2 : 2} style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{n.title}</Text>
              <Text numberOfLines={1} style={{ color: t.muted, fontSize: 11 }}>{n.source} · {agoText(n.ts)}</Text>
            </View>
          </Pressable>
        ))}
        {p.h > 1 && cells >= 8 && total ? <Text style={{ color: t.muted, fontSize: 10.5 }}>{tl('Fonti attive: {0} su {1}', ok, total)}</Text> : null}
      </View>
    </Chrome>
  );
}

/* ---------------- Network, viaggi, Theia ---------------- */
export function MessagesW(p: WProps) {
  const n = useUI((s) => s.badges.msg);
  return <Tile {...base(p)} icon="send" label={tl('Messaggi')} color={C.net} value={String(n)} sub={n ? tl('da leggere') : tl('Tutto letto')} onPress={() => go('messagesPage')} />;
}
export function NotifsW(p: WProps) {
  const n = useUI((s) => s.badges.notif);
  return <Tile {...base(p)} icon="bell" label={tl('Notifiche')} color={C.net} value={String(n)} sub={n ? tl('nuove') : tl('Nessuna nuova')} onPress={() => go('notificationsPage')} />;
}

export function TripW(p: WProps) {
  const vac = useLife((s) => s.vacations);
  const today = dayKey();
  const next = [...vac].filter((v) => v.start && v.start >= today).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))[0];
  const days = next?.start ? Math.round((Date.parse(next.start) - Date.parse(today)) / 86400000) : null;
  return <Tile {...base(p)} icon="lifetravel" label={tl('Prossimo viaggio')} color={C.trip} value={days == null ? undefined : String(days)} unit={days == null ? undefined : tl('giorni')} sub={next ? next.dest : tl('Nessun viaggio in programma')} empty={tl('Pianifica una vacanza')} onPress={() => go('lifetravel')} />;
}

export function TipW(p: WProps) {
  const t = useTheme();
  const { dash, openMetric } = useDashData();
  const i = dash.insights[0];
  const open = () => {
    if (!i) { go('ai'); return; }
    if (i.metricId && openMetric(i.metricId)) return;
    go(({ salute: 'lifehealth', mente: 'mood', finanza: 'lifefinance', crescita: 'plan', contesto: 'mood' } as Record<string, string>)[i.domain] ?? 'lifehealth');
  };
  return (
    <Chrome pw={p.pw} ph={p.ph} color={C.theia} label="Theia" onPress={open}>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="sparkle" size={15} color={C.theia} stroke={2} /><Text style={{ color: t.muted, fontSize: 12, fontWeight: '700' }}>{tl('Da guardare oggi')}</Text></View>
        <Text numberOfLines={p.h === 1 ? 1 : 3} style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{i ? i.title : tl('Per ora nessun segnale da evidenziare')}</Text>
        {i && p.h > 1 ? <Text numberOfLines={p.h > 2 ? 6 : 3} style={{ color: t.muted, fontSize: 12.5 }}>{i.detail}</Text> : null}
      </View>
    </Chrome>
  );
}

/* ---------------- Scorciatoie ---------------- */
type Short = { icon: string; label: string; page: string; params?: Record<string, string>; color: string };
export const shortcutW = (s: Short) => function Shortcut(p: WProps) {
  const t = useTheme();
  const row = p.w >= 2;
  return (
    <Chrome pw={p.pw} ph={p.ph} color={s.color} label={s.label} pad={8} onPress={() => go(s.page, s.params)}>
      <View style={{ flex: 1, flexDirection: row && p.h === 1 ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: s.color + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={s.icon} size={19} color={s.color} stroke={2} /></View>
        <Text numberOfLines={2} style={{ color: t.text, fontSize: row ? 13 : 10.5, fontWeight: '700', textAlign: 'center' }}>{tl(s.label)}</Text>
      </View>
    </Chrome>
  );
};

/* ---------------- Radar di Theia ---------------- */
export function RadarW(p: WProps) {
  const t = useTheme();
  const list = useProposals();
  const dismiss = useRadarStore((s) => s.dismiss);
  const cells = p.w * p.h;
  const n = p.h === 1 ? 1 : Math.max(1, Math.floor((p.ph - 56) / (cells >= 8 ? 92 : 84)));
  const tone = (sev: string) => (sev === 'bad' ? t.danger : sev === 'warn' ? t.warn : C.theia);
  return (
    <Chrome pw={p.pw} ph={p.ph} color={list[0] ? tone(list[0].severity) : C.theia} label="Theia ha notato" onPress={p.h === 1 && list[0]?.action ? () => go(list[0].action!.page, list[0].action!.params) : undefined}>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="sparkle" size={15} color={C.theia} stroke={2} />
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', flex: 1 }}>{tl('Theia ha notato')}</Text>
          {list.length > 1 ? <Text style={{ color: t.muted, fontSize: 11 }}>{`${list.length} ${tl('avvisi')}`}</Text> : null}
        </View>
        {!list.length ? <Text style={{ color: t.muted, fontSize: 12.5 }}>{tl('Per ora è tutto in ordine: controllo soldi, agenda, turni, sonno e task.')}</Text> : null}
        {list.slice(0, n).map((x) => (
          <View key={x.id} style={{ gap: 3 }}>
            <Text numberOfLines={p.h === 1 ? 1 : 2} style={{ color: t.text, fontSize: 13.5, fontWeight: '800' }}>{x.title}</Text>
            {p.h > 1 ? <Text numberOfLines={cells >= 8 ? 4 : 3} style={{ color: t.muted, fontSize: 12 }}>{x.why}</Text> : null}
            {p.h > 1 ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                {x.action ? <Pressable accessibilityRole="button" onPress={() => go(x.action!.page, x.action!.params)} style={{ paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: C.theia + '30', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.text, fontSize: 12, fontWeight: '800' }}>{tl(x.action.label)}</Text></Pressable> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={tl('Non mostrare più questo avviso')} onPress={() => dismiss(x.id)} style={{ paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.muted, fontSize: 12, fontWeight: '700' }}>{tl('Chiudi')}</Text></Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </Chrome>
  );
}
