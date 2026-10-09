import { useMemo, useState } from 'react';
import { Text as RNText, View } from 'react-native';

import { Body, Input, Item, Press, Sheet } from '@/components/ui';
import { radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { alertT } from '@/lib/alert';
import { applyLanguage } from '@/i18n/apply';
import { CURRENCIES, currencyLabel, currentLocale } from '@/i18n/format';
import { infoOf, LANGUAGES, normalizeLang, type LangCode } from '@/i18n/languages';
import { Icon } from '@/lib/icons';
import { useApp } from '@/store/app';

/** Cambia lingua: attiva i cataloghi, salva la scelta e, se la scrittura cambia direzione su nativo, avvisa di riaprire l'app. */
export function chooseLanguage(code: LangCode) {
  const cur = normalizeLang(useApp.getState().language);
  if (cur === code) return;
  const restart = applyLanguage(code);
  useApp.getState().set({ language: code });
  if (restart) alertT('Riavvia l\'app per applicare la scrittura da destra a sinistra', undefined, [{ text: 'OK' }]);
}

/** Elenco delle lingue con ricerca. I nomi restano nella loro lingua (non passano dal traduttore). */
export function LanguageList({ onPicked, search = true }: { onPicked?: (c: LangCode) => void; search?: boolean }) {
  const t = useTheme();
  const lang = normalizeLang(useApp((s) => s.language));
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? LANGUAGES.filter((l) => l.native.toLowerCase().includes(n) || l.english.toLowerCase().includes(n) || l.code === n) : LANGUAGES;
  }, [q]);
  return (
    <View>
      {search ? <Input placeholder="Cerca lingua" value={q} onChangeText={setQ} autoCapitalize="none" autoCorrect={false} /> : null}
      {list.map((l, i) => (
        <Item key={l.code} last={i === list.length - 1} onPress={() => { chooseLanguage(l.code); onPicked?.(l.code); }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }} accessibilityState={{ selected: l.code === lang }}>
            <View style={{ flex: 1 }}>
              <RNText style={{ color: t.text, fontSize: 16 }}>{l.native}</RNText>
              <RNText style={{ color: t.muted, fontSize: 12, marginTop: 1 }}>{l.english}</RNText>
            </View>
            {l.code === lang ? <Icon name="check" size={18} color={t.positive} stroke={2.4} /> : null}
          </View>
        </Item>
      ))}
      {!list.length ? <Body muted small>Nessuna lingua trovata</Body> : null}
    </View>
  );
}

/** Pulsante compatto "Lingua: Italiano" che apre l'elenco in una sheet (onboarding). */
export function LanguageButton() {
  const t = useTheme();
  const lang = normalizeLang(useApp((s) => s.language));
  const [open, setOpen] = useState(false);
  return (
    <>
      <Press onPress={() => setOpen(true)} accessibilityLabel="Lingua" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: t.chip }}>
        <Icon name="compass" size={14} color={t.text} stroke={2} />
        <RNText style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>{infoOf(lang).native}</RNText>
      </Press>
      <Sheet visible={open} title="Lingua" onClose={() => setOpen(false)}>
        <LanguageList onPicked={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function currencyName(code: string): string {
  try { return new Intl.DisplayNames([currentLocale()], { type: 'currency' }).of(code) ?? code; } catch { return code; }
}

/** Selettore di valuta: cambia solo l'unità mostrata, i dati non vengono convertiti. */
export function CurrencyPicker() {
  const t = useTheme();
  const currency = useApp((s) => s.currency) || 'CHF';
  const set = useApp((s) => s.set);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Press onPress={() => setOpen(true)} accessibilityLabel={`Valuta: ${currency}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
        <Body>Valuta</Body>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <RNText style={{ color: t.muted, fontSize: 15 }}>{currency} ({currencyLabel(currency)})</RNText>
          <Icon name="chevron" size={16} color={t.muted} stroke={2} />
        </View>
      </Press>
      <Sheet visible={open} title="Valuta" onClose={() => setOpen(false)}>
        <Body small muted style={{ marginBottom: 8 }}>Cambia solo l'unità mostrata: gli importi già inseriti non vengono convertiti.</Body>
        {CURRENCIES.map((c, i) => (
          <Item key={c} last={i === CURRENCIES.length - 1} onPress={() => { set({ currency: c }); setOpen(false); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <RNText style={{ color: t.text, fontSize: 16, flex: 1 }}>{c} · {currencyName(c)}</RNText>
              {c === currency ? <Icon name="check" size={18} color={t.positive} stroke={2.4} /> : null}
            </View>
          </Item>
        ))}
      </Sheet>
    </>
  );
}
