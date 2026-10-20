import * as Contacts from 'expo-contacts';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { FormHead } from '@/components/formKit';
import { Body, Btn, Card, Input, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { GOOD_ENOUGH, planPlaceSearch } from '@/lib/findPlace';
import { Icon } from '@/lib/icons';
import { libraryPermission } from '@/lib/mediaPerm';
import { mapsUrl } from '@/lib/maps';
import { go } from '@/lib/nav';
import { callScript, dialNumber, taskIntent, validPhone } from '@/lib/taskIntent';
import { useApp } from '@/store/app';
import { useLife } from '@/store/life';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

const uid = () => Math.random().toString(36).slice(2, 9);
const call = (phone: string) => { void Linking.openURL(`tel:${dialNumber(phone)}`).catch(() => toast('Non riesco ad aprire il telefono da qui')); };

/** Cosa si può fare con un task: il dentista da prenotare (contatto, professionisti, cosa dire), la lista della spesa, una chiamata. */
export function TaskActionSheet({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const t = useTheme();
  const task = useLife((s) => s.tasks.find((x) => x.id === taskId));
  const { patchTask, toggleTask } = useLife();
  const me = useApp((s) => s.account.name);
  const providers = useNet((s) => s.providers);
  const intent = useMemo(() => (task ? taskIntent(task.t) : { kind: 'none' as const }), [task?.t]); // eslint-disable-line react-hooks/exhaustive-deps
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [item, setItem] = useState('');

  if (!task) return <Sheet visible={false} title="" onClose={onClose}>{null}</Sheet>;
  const contact = task.contact;
  const person = intent.kind === 'call' ? intent.person.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : '';

  const saveContact = () => {
    if (name.trim().length < 2) { toast('Scrivi il nome'); return; }
    if (phone.trim() && !validPhone(phone)) { toast('Il numero non sembra giusto'); return; }
    patchTask(task.id, { contact: { name: name.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) } });
    setName(''); setPhone(''); toast('Contatto salvato nel task');
  };
  const pickFromBook = async () => {
    try {
      const c = await Contacts.presentContactPickerAsync();
      if (!c) return;
      const num = c.phoneNumbers?.[0]?.number;
      setName([c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || '');
      if (num) setPhone(num);
    } catch { toast('Non riesco ad aprire la rubrica: scrivi il numero a mano'); }
  };
  const contactBlock = (label: string) => (
    <View style={{ marginTop: 12 }}>
      <Body bold style={{ marginBottom: 6 }}>{label}</Body>
      {contact ? (
        <Card accent={t.accent}>
          <Row gap={10}><Icon name="contact" size={22} color={t.accent} /><View style={{ flex: 1 }}><Body bold>{contact.name}</Body><Body small muted>{contact.phone ?? 'Nessun numero'}</Body></View></Row>
          {contact.phone ? <Btn style={{ marginTop: 8 }} icon="phone" title={tl('Chiama {0}', contact.name)} onPress={() => call(contact.phone!)} /> : null}
          <Btn small ghost style={{ marginTop: 6 }} title="Cambia contatto" onPress={() => { setName(contact.name); setPhone(contact.phone ?? ''); patchTask(task.id, { contact: undefined }); }} />
        </Card>
      ) : (
        <>
          <Input placeholder={intent.kind === 'service' ? `Nome del tuo ${intent.cat.label}` : 'Nome'} value={name || (intent.kind === 'call' ? person : '')} onChangeText={setName} />
          <Input placeholder="Numero di telefono" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Row gap={8}><Btn style={{ flex: 1 }} title="Salva nel task" onPress={saveContact} /><Btn ghost style={{ flex: 1 }} icon="contact" title="Dalla rubrica" onPress={() => void pickFromBook()} /></Row>
        </>
      )}
    </View>
  );

  /* ---- servizio da prenotare ---- */
  const service = () => {
    if (intent.kind !== 'service') return null;
    const plan = planPlaceSearch(intent.cat, providers.map((p) => ({ name: p.name, role: p.role, rating: p.rating, price: p.price, tag: p.tag })), GOOD_ENOUGH, false);
    const script = callScript({ who: contact?.name ?? '', service: `un appuntamento (${intent.cat.label})`, when: task.callWhen, name: me });
    return (
      <>
        <FormHead icon="phone" title={`Prenota: ${intent.cat.label}`} text="Il tuo contatto, i migliori su LifePilot e cosa dire al telefono." />
        {contactBlock(contact ? `Il tuo ${intent.cat.label}` : `Hai già un ${intent.cat.label}? Inseriscilo`)}

        <Body bold style={{ marginTop: 14, marginBottom: 6 }}>{contact ? 'Altri su LifePilot' : `${intent.cat.label.charAt(0).toUpperCase()}${intent.cat.label.slice(1)} su LifePilot`}</Body>
        {plan.kind === 'in-app' ? plan.best.map((p) => (
          <Pressable key={p.name} onPress={() => { onClose(); go('servicePage', { name: p.name }); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.item }}>
            <View style={{ flex: 1 }}><Body bold>{p.name}</Body><Body small muted>{p.role}{p.price ? ` · ${p.price} LP` : ''}</Body></View>
            <Icon name="star" size={14} color={t.accent} /><Body small>{p.score.toFixed(1).replace('.', ',')}</Body><Icon name="chevron-right" size={16} color={t.muted} />
          </Pressable>
        )) : <Body small muted>{`Su LifePilot non c'è ancora un ${intent.cat.label} con un buon voto. Da qui non leggo le recensioni fuori dall'app.`}</Body>}
        <Btn style={{ marginTop: 8 }} ghost icon="location" title="Cerca vicino a te (apre le mappe)" onPress={() => void Linking.openURL(mapsUrl(intent.cat.query, Platform.OS)).catch(() => toast('Non riesco ad aprire le mappe'))} />

        <Body bold style={{ marginTop: 16, marginBottom: 6 }}>Per telefono</Body>
        <Input placeholder="Quando? (es. giovedì mattina)" value={task.callWhen ?? ''} onChangeText={(v) => patchTask(task.id, { callWhen: v })} />
        <Card><Body small>{script}</Body></Card>
        {contact?.phone ? <Btn style={{ marginTop: 8 }} icon="phone" title="Chiama ora" onPress={() => call(contact.phone!)} /> : <Body small muted style={{ marginTop: 6 }}>Salva il numero qui sopra per chiamare con un tocco.</Body>}
        <Body small muted style={{ marginTop: 8 }}>La chiamata con voce AI che prenota da sola richiede un servizio telefonico che non è ancora collegato: oggi ti preparo numero e testo, e tu premi Chiama.</Body>
        <Btn style={{ marginTop: 10 }} ghost title="Fatto: appuntamento preso" onPress={() => { toggleTask(task.id, true); toast('Task completato'); onClose(); }} />
      </>
    );
  };

  /* ---- chiamata ---- */
  const callTask = () => (intent.kind === 'call' ? (<><FormHead icon="phone" title={`Chiama ${person}`} text="Salva il numero nel task e chiami con un tocco." />{contactBlock(`Contatto di ${person}`)}</>) : null);

  /* ---- lista della spesa ---- */
  const list = task.list ?? { items: [], photos: [] };
  const setList = (l: typeof list) => patchTask(task.id, { list: l });
  const addItem = () => { const v = item.trim(); if (!v) return; setList({ ...list, items: [...list.items, { id: uid(), t: v }] }); setItem(''); };
  const addPhoto = async () => {
    const perm = await libraryPermission(); if (!perm.granted) { toast('Serve il permesso per le foto'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled && r.assets[0]?.uri) setList({ ...list, photos: [...(list.photos ?? []), r.assets[0].uri] });
  };
  const shopping = () => {
    if (intent.kind !== 'shopping') return null;
    const left = list.items.filter((x) => !x.done).length;
    return (
      <>
        <FormHead icon="orders" title="Lista della spesa" text="Scrivi cosa ti serve o aggiungi la foto di un biglietto. Spunta mentre compri." />
        <Row gap={8}><Input flex={1} placeholder="Aggiungi (es. latte)" value={item} onChangeText={setItem} onSubmitEditing={addItem} returnKeyType="done" style={{ marginBottom: 0 }} /><Btn title="Aggiungi" onPress={addItem} /></Row>
        {list.items.map((x) => (
          <Pressable key={x.id} onPress={() => setList({ ...list, items: list.items.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)) })} accessibilityRole="checkbox" accessibilityState={{ checked: !!x.done }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.item }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: x.done ? t.positive : t.muted, backgroundColor: x.done ? t.positive : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{x.done ? <Icon name="check" size={14} color={t.bg} stroke={3} /> : null}</View>
            <Text style={{ flex: 1, color: t.text, fontSize: 16, textDecorationLine: x.done ? 'line-through' : 'none', opacity: x.done ? 0.5 : 1 }}>{x.t}</Text>
            <Pressable hitSlop={10} onPress={() => setList({ ...list, items: list.items.filter((y) => y.id !== x.id) })} accessibilityRole="button" accessibilityLabel={tl('Togli')}><Icon name="x" size={16} color={t.muted} /></Pressable>
          </Pressable>
        ))}
        {list.items.length ? <Body small muted style={{ marginTop: 6 }}>{left ? tl('Ancora {0} da prendere', left) : 'Hai preso tutto.'}</Body> : <Body small muted style={{ marginTop: 8 }}>Ancora vuota.</Body>}
        <Row gap={8} style={{ marginTop: 10, flexWrap: 'wrap', justifyContent: 'flex-start' }}>{(list.photos ?? []).map((u) => <Pressable key={u} onLongPress={() => setList({ ...list, photos: (list.photos ?? []).filter((p) => p !== u) })} accessibilityLabel={tl('Foto della lista: tieni premuto per toglierla')}><Image source={{ uri: u }} style={{ width: 96, height: 96, borderRadius: 12 }} contentFit="cover" /></Pressable>)}</Row>
        <Btn style={{ marginTop: 10 }} ghost icon="image" title="Aggiungi la foto di una lista" onPress={() => void addPhoto()} />
        <Btn style={{ marginTop: 8 }} title={left || !list.items.length ? 'Segna la spesa come fatta' : 'Spesa fatta'} onPress={() => { toggleTask(task.id, true); toast('Task completato'); onClose(); }} />
      </>
    );
  };

  return (
    <Sheet visible title={task.t} onClose={onClose}>
      {service()}{callTask()}{shopping()}
      {intent.kind === 'none' ? <Body muted>Per questo task non ho azioni particolari: puoi scomporlo in passi o dargli una scadenza.</Body> : null}
    </Sheet>
  );
}
