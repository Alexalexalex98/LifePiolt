import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { openMedia } from '@/components/network';
import { Body, Btn, Card, Empty, Input, Page, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { openFile, pickFiles, pickImages } from '@/lib/jobFiles';
import { EMPTY_MENU, MAX_DESC, MAX_FILES, MENU_CATS, groupByCat, hasMenu, priceLabel, validateItem, type MenuCat, type MenuItem } from '@/lib/menu';
import { useApp } from '@/store/app';
import { useMenus } from '@/store/menus';
import { newId } from '@/store/network';
import { toast } from '@/store/toast';

const isPdf = (n: string, m?: string) => m === 'application/pdf' || /\.pdf$/i.test(n);

/** Il menù di un locale: foto, screenshot o PDF caricati da chi lo gestisce, più i piatti con il prezzo. Si vede sempre cosa offre e quanto costa. */
export default function MenuPage() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const { name: param, item: focus } = useLocalSearchParams<{ name?: string; item?: string }>();
  const owner = param || me;
  const mine = owner === me;
  const menu = useMenus((s) => s.byOwner[owner]) ?? EMPTY_MENU;
  const st = useMenus.getState;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const groups = groupByCat(menu.items);

  const upload = async (kind: 'photo' | 'file') => {
    if (busy) return;
    setBusy(true);
    try {
      const left = MAX_FILES - menu.files.length;
      if (left <= 0) { toast(tl('Puoi caricare al massimo {0} file', MAX_FILES)); return; }
      const picked = kind === 'photo' ? await pickImages(true) : await pickFiles(true);
      const ok = picked.filter((f) => isPdf(f.name, f.mime) || (f.mime ?? '').startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name)).slice(0, left);
      if (picked.length && !ok.length) { toast('Servono foto, screenshot o PDF'); return; }
      if (ok.length) { st().addFiles(owner, ok.map((f) => ({ id: String(newId()), name: f.name, uri: f.uri, mime: f.mime, ts: Date.now() }))); toast(ok.length > 1 ? tl('{0} file aggiunti al menù', ok.length) : 'Aggiunto al menù'); }
    } catch (e) { toast(e instanceof Error ? e.message : 'Non riesco ad aprire i file'); } finally { setBusy(false); }
  };

  return (
    <Page id="menuPage" back title={tl('Menù di {0}', owner)}>
      {!hasMenu(menu) ? (
        <Card><Empty text={mine ? 'Non hai ancora caricato il menù. Aggiungi la foto del menù cartaceo, uno screenshot o un PDF.' : 'Questo locale non ha ancora caricato il menù.'} /></Card>
      ) : null}

      {menu.files.length ? (
        <View style={{ marginBottom: 14 }}>
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>{tl('IL MENÙ')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {menu.files.map((f) => (
              <View key={f.id}>
                <Pressable accessibilityRole="button" accessibilityLabel={f.name} onPress={() => (isPdf(f.name, f.mime) ? void openFile({ uri: f.uri, name: f.name, mime: f.mime }) : openMedia({ media: 'photo', seed: f.name, uri: f.uri }))} style={{ width: 124, height: 168, borderRadius: 18, overflow: 'hidden', backgroundColor: t.card, borderWidth: 1, borderColor: t.item, alignItems: 'center', justifyContent: 'center' }}>
                  {isPdf(f.name, f.mime) ? (
                    <View style={{ alignItems: 'center', gap: 8, padding: 10 }}><Icon name="file" size={34} color={t.accent} /><Text style={{ color: t.text, fontWeight: '800' }}>PDF</Text><Text numberOfLines={2} style={{ color: t.muted, fontSize: 11.5, textAlign: 'center' }}>{f.name}</Text></View>
                  ) : <Image source={{ uri: f.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />}
                </Pressable>
                {mine ? <Pressable accessibilityRole="button" accessibilityLabel={tl('Togli {0}', f.name)} onPress={() => st().removeFile(owner, f.id)} hitSlop={8} style={{ position: 'absolute', top: 6, end: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={14} color="#fff" /></Pressable> : null}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {mine ? (
        <Row style={{ marginBottom: 14 }} gap={8}>
          <Btn style={{ flex: 1 }} ghost icon="camera" title="Foto o screenshot" disabled={busy} onPress={() => void upload('photo')} />
          <Btn style={{ flex: 1 }} ghost icon="file" title="PDF" disabled={busy} onPress={() => void upload('file')} />
        </Row>
      ) : null}

      {groups.map((g) => (
        <View key={g.cat} style={{ marginBottom: 14 }}>
          <Text accessibilityRole="header" style={{ color: t.text, fontSize: 18, fontWeight: '800', marginBottom: 8 }}>{tl(g.cat)}</Text>
          <View style={{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.item, overflow: 'hidden' }}>
            {g.items.map((it, i) => (
              <Pressable key={it.id} disabled={!mine} onPress={() => setDraft(draftOf(it))} accessibilityRole={mine ? 'button' : 'text'} accessibilityLabel={`${it.name}, ${priceLabel(it.price)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: t.item, backgroundColor: focus === it.id ? t.accent + '22' : 'transparent' }}>
                {it.photo ? (
                  <Pressable accessibilityRole="imagebutton" accessibilityLabel={tl('Foto di {0}', it.name)} onPress={() => openMedia({ media: 'photo', seed: it.name, uri: it.photo })}>
                    <Image source={{ uri: it.photo }} style={{ width: 60, height: 60, borderRadius: 14 }} contentFit="cover" transition={150} />
                  </Pressable>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 15.5, fontWeight: '700' }}>{it.name}</Text>
                  {it.desc ? <Text style={{ color: t.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>{it.desc}</Text> : null}
                </View>
                <Text style={{ color: t.text, fontSize: 15.5, fontWeight: '800' }}>{priceLabel(it.price)}</Text>
                {mine ? <Icon name="edit" size={16} color={t.muted} /> : null}
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {mine ? <Btn icon="plus" title="Aggiungi un piatto" onPress={() => setDraft(draftOf())} /> : null}
      <Body small muted style={{ marginTop: 12 }}>{tl('I prezzi sono quelli in cassa, in franchi svizzeri.')}</Body>

      <ItemSheet draft={draft} setDraft={setDraft} onSave={(it) => { st().saveItem(owner, it); setDraft(null); toast('Piatto salvato'); }} onDelete={(id) => { st().removeItem(owner, id); setDraft(null); toast('Piatto tolto dal menù'); }} />
    </Page>
  );
}

type Draft = { id?: string; name: string; price: string; desc: string; cat: MenuCat; photo?: string };
const draftOf = (it?: MenuItem): Draft => ({ id: it?.id, name: it?.name ?? '', price: it ? String(it.price).replace('.', ',') : '', desc: it?.desc ?? '', cat: it?.cat ?? 'Primi', photo: it?.photo });

function ItemSheet({ draft, setDraft, onSave, onDelete }: { draft: Draft | null; setDraft: (d: Draft | null) => void; onSave: (i: MenuItem) => void; onDelete: (id: string) => void }) {
  const [err, setErr] = useState('');
  /* il selettore foto non si apre dentro una finestra su iPhone: si chiude il foglio, si sceglie, si riapre con quello che avevi scritto */
  const pickPhoto = async () => {
    if (!draft) return;
    const keep = draft;
    setDraft(null);
    await new Promise((r) => setTimeout(r, 350));
    let photo = keep.photo;
    try { const r = await pickImages(false); if (r[0]) photo = r[0].uri; } catch { toast('Non riesco ad aprire la galleria'); }
    setDraft({ ...keep, photo });
  };
  const d = draft;
  return (
    <Sheet visible={!!d} title={d?.id ? 'Modifica il piatto' : 'Nuovo piatto'} onClose={() => setDraft(null)}>
      {d ? (
        <>
          <Input placeholder="Nome del piatto" value={d.name} onChangeText={(v) => setDraft({ ...d, name: v })} maxLength={70} />
          <Input placeholder="Prezzo in CHF, es. 12,50" value={d.price} onChangeText={(v) => setDraft({ ...d, price: v })} keyboardType="decimal-pad" style={{ marginTop: 8 }} />
          <Input placeholder="Descrizione (facoltativa): ingredienti, allergeni…" value={d.desc} onChangeText={(v) => setDraft({ ...d, desc: v })} multiline maxLength={MAX_DESC} style={{ marginTop: 8, minHeight: 60 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
            {d.photo ? (
              <View>
                <Image source={{ uri: d.photo }} style={{ width: 84, height: 84, borderRadius: 16 }} contentFit="cover" />
                <Pressable accessibilityRole="button" accessibilityLabel={tl('Togli la foto')} onPress={() => setDraft({ ...d, photo: undefined })} hitSlop={8} style={{ position: 'absolute', top: 4, end: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={13} color="#fff" /></Pressable>
              </View>
            ) : null}
            <Btn small ghost icon="camera" title={d.photo ? 'Cambia foto' : 'Aggiungi la foto del piatto'} onPress={() => void pickPhoto()} />
          </View>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
            {MENU_CATS.map((c) => <Pill key={c} label={tl(c)} on={d.cat === c} onPress={() => setDraft({ ...d, cat: c })} />)}
          </Row>
          {err ? <Body small color={t_danger}>{err}</Body> : null}
          <Btn style={{ marginTop: 14 }} title="Salva" onPress={() => { const v = validateItem(d.name, d.price, d.desc); if (!v.ok) { setErr(v.error); return; } setErr(''); onSave({ id: d.id ?? String(newId()), name: v.name, price: v.price, cat: d.cat, ...(v.desc ? { desc: v.desc } : {}), ...(d.photo ? { photo: d.photo } : {}) }); }} />
          {d.id ? <Btn style={{ marginTop: 8 }} ghost danger icon="trash" title="Togli dal menù" onPress={() => onDelete(d.id!)} /> : null}
        </>
      ) : null}
    </Sheet>
  );
}
const t_danger = '#e5484d';
