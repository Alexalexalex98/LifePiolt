import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { dayKey } from '@/lib/format';
import { useApp } from '@/store/app';
import { moodOptions, useHealth } from '@/store/health';
import { toast } from '@/store/toast';

/** Alla prima apertura di ogni giornata chiede «Come ti senti?» (una volta sola, e solo se l'umore di oggi non c'è già). */
export function MoodCheckinPrompt({ ready }: { ready: boolean }) {
  const t = useTheme();
  const onboarded = useApp((s) => s.onboarded);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready || !onboarded) return;
    const today = dayKey();
    if (useApp.getState().moodAskedDay === today) return;
    if (useHealth.getState().moods.some((m) => m.day === today)) { useApp.getState().set({ moodAskedDay: today }); return; }
    const id = setTimeout(() => { useApp.getState().set({ moodAskedDay: today }); setOpen(true); }, 1800);
    return () => clearTimeout(id);
  }, [ready, onboarded]);

  return (
    <Sheet visible={open} title={tl('Come ti senti?')} onClose={() => setOpen(false)}>
      <Body small muted style={{ marginBottom: 12 }}>{tl('Un tocco al giorno: lo confronto con sonno, impegni e spese per capire cosa ti fa stare meglio.')}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {moodOptions.map(([m, c]) => (
          <Pressable key={m} accessibilityRole="button" accessibilityLabel={m} onPress={() => { useHealth.getState().logMood(m); setOpen(false); toast(tl('Umore registrato: {0}', m)); }}
            style={{ width: '31%', alignItems: 'center', paddingVertical: 13, borderRadius: 14, backgroundColor: t.tile, borderWidth: 1, borderColor: t.border }}>
            <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: c, marginBottom: 7 }} />
            <Text style={{ color: t.text, fontSize: 13 }}>{m}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
