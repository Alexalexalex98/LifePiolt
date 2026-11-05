import { t } from '@/i18n/core';
import { readUriBytes } from '@/lib/readUri';
import type { Brand } from '@/lib/reports';
import { myUserId, raw } from '@/lib/teams';
import { db, q, run } from '@/lib/teamWork';
import { useBrand } from '@/store/brand';

/** Dati aziendali dei modelli (intestazione, logo, piè di pagina): li vedono tutti i membri, li cambia chi può scrivere gli annunci. */
type Row = { company: string; address: string; email: string; phone: string; vat: string; footer: string; color: string; logo_path: string | null };
const toB64 = (bytes: Uint8Array): string => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const mimeOf = (path: string) => (/\.png$/i.test(path) ? 'image/png' : /\.svg$/i.test(path) ? 'image/svg+xml' : 'image/jpeg');

export const loadBrand = (team: string) => run(async () => {
  const rows = await q<Row[]>((await db()).from('team_brand').select('*').eq('team_id', team));
  const r = rows[0]; const cur = useBrand.getState().brand[team];
  let logo = cur?.logo ?? null;
  if (r?.logo_path && (!logo || (cur as Brand & { path?: string })?.path !== r.logo_path)) {
    const d = await (await raw()).storage.from('team-docs').download(r.logo_path);
    if (!d.error && d.data) logo = `data:${mimeOf(r.logo_path)};base64,${toB64(new Uint8Array(await d.data.arrayBuffer()))}`;
  } else if (r && !r.logo_path) logo = null;
  const b = { company: r?.company ?? '', address: r?.address ?? '', email: r?.email ?? '', phone: r?.phone ?? '', vat: r?.vat ?? '', footer: r?.footer ?? '', color: r?.color ?? '#0F766E', logo, path: r?.logo_path ?? undefined } as Brand;
  useBrand.getState().set(team, b); return b;
});
export const saveBrand = (team: string, b: Omit<Brand, 'logo'>, logo?: { uri: string; name: string }) => run(async () => {
  const me = await myUserId(); if (!me) throw new Error(t('Accedi per continuare.'));
  let path: string | undefined;
  if (logo) {
    const bytes = await readUriBytes(logo.uri);
    if (bytes.length > 400 * 1024) throw new Error(t('Il logo è troppo grande: usa un\'immagine sotto i 400 KB.'));
    path = `${team}/team/logo-${Date.now().toString(36)}-${logo.name.replace(/[^\w.\-]+/g, '_')}`;
    const up = await (await raw()).storage.from('team-docs').upload(path, bytes, { contentType: mimeOf(logo.name), upsert: false });
    if (up.error) throw new Error(up.error.message);
  }
  await q((await db()).from('team_brand').upsert({ team_id: team, ...b, ...(path ? { logo_path: path } : {}), updated_by: me, updated_at: new Date().toISOString() }));
  await loadBrand(team);
});
