import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Share, View } from 'react-native';

import { Body, Btn, Card, Empty, H, Input, Item, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { fmtBytes } from '@/lib/attachments';
import { confirmDelete } from '@/lib/confirm';
import { go, goBack } from '@/lib/nav';
import { startTeamSync } from '@/lib/teamSync';
import { serverState, type ServerState, createTeam, deleteTeam, deleteTeamFile, downloadTeamFile, inviteCode, joinTeam, leaveTeam, listMembers, listTeamFiles, myUserId, refreshTeams, removeMember, uploadTeamFile, type Member, type TeamFile } from '@/lib/teams';
import { useApp } from '@/store/app';
import { useAccount } from '@/store/account';
import { useTeams, type TeamInfo } from '@/store/teams';
import { toast } from '@/store/toast';

const ROLE: Record<string, string> = { owner: 'Creatore', admin: 'Amministratore', member: 'Membro' };

/** Team di lavoro: crei uno spazio, inviti con un codice (valido 7 giorni), condividi pagine in tempo reale e un Drive privato. Chi esce o viene rimosso perde subito l'accesso a tutto. */
export default function Teams() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const demoMode = useApp((s) => s.demo);
  const verified = useAccount((s) => s.status === 'verified') || demoMode;
  const teams = useTeams((s) => s.teams);
  const [open, setOpen] = useState<string | null>(null);
  const [srv, setSrv] = useState<ServerState | null>(null);
  useEffect(() => { void serverState().then(setSrv); }, [demoMode, verified]);
  const [name, setName] = useState(''); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (verified) void refreshTeams().then(() => startTeamSync()); }, [verified]);
  const team = teams.find((x) => x.id === open);
  if (team) return <TeamView team={team} onBack={() => setOpen(null)} />;
  const act = async (f: () => Promise<{ ok: boolean; message?: string }>, done?: string) => { setBusy(true); const r = await f(); setBusy(false); if (!r.ok) toast((r as { message?: string }).message ?? tl('Operazione non riuscita: riprova.')); else if (done) toast(done); return r; };
  return (
    <Page id="teams" title={mode === 'create' ? tl('Nuovo workspace') : mode === 'join' ? tl('Entra in un workspace') : tl('Team')} back>
      {srv && srv !== 'ok' ? <Card><H>{tl('Collegamento al server')}</H><Body small style={{ marginTop: 4 }}>{srv === 'config' ? tl('Questa versione dell\'app non conosce l\'indirizzo del server, quindi i workspace restano solo su questo telefono. Per condividerli con altre persone la build deve avere EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY (variabili dell\'ambiente EAS) e va ricompilata.') : tl('Il server c\'è, ma non hai fatto l\'accesso con un account verificato (in demo non c\'è nessun account). Esci dalla demo e accedi con il tuo account da Impostazioni: da quel momento tutto passa dal server e lo vedono anche le altre persone.')}</Body></Card> : null}
      {!verified ? <Card><Body>{tl('Per creare o entrare in un team serve un account verificato: lo crei da Impostazioni o dalla schermata iniziale.')}</Body></Card> : null}
      {mode ? null : <Card>
        <H>{tl('I tuoi team')}</H>
        {teams.length ? teams.map((x, i) => <Item key={x.id} last={i === teams.length - 1} onPress={() => setOpen(x.id)}><Row><View style={{ flex: 1 }}><Body bold>{x.name}</Body><Body small muted>{`${tl(ROLE[x.role] ?? x.role)} · ${tl('{0} persone', x.members)}`}</Body></View></Row></Item>) : <Empty text={tl('Nessun team ancora.')} />}
      </Card>}
      {verified && !mode ? (
        <>
          <Btn icon="plus" title={tl('Crea il mio workspace')} onPress={() => go('teams', { mode: 'create' })} />
          <Btn ghost icon="users" title={tl('Entro in un workspace con un codice')} onPress={() => go('teams', { mode: 'join' })} />
        </>
      ) : null}
      {verified && mode === 'create' ? (
        <Card>
          <H>{tl('Crea il tuo workspace')}</H>
          <Body small muted style={{ marginBottom: 8 }}>{tl('Sarai il proprietario: poi inviti le persone con un codice e assegni le loro posizioni.')}</Body>
          <Input value={name} onChangeText={setName} placeholder={tl('Nome del workspace (es. Studio Rossi)')} />
          <Btn disabled={busy || !name.trim()} title={tl('Crea')} onPress={() => void act(() => createTeam(name.trim()), tl('Workspace creato')).then((r) => { if (r.ok) { setName(''); goBack(); } })} />
        </Card>
      ) : null}
      {verified && mode === 'join' ? (
        <Card>
          <H>{tl('Entra in un workspace')}</H>
          <Body small muted style={{ marginBottom: 8 }}>{tl('Chiedi il codice di invito a un amministratore del workspace: vale 7 giorni.')}</Body>
          <Input value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" placeholder="ABCDE12345" />
          <Btn disabled={busy || (code.trim().length < 6 && !demoMode)} title={tl('Entra')} onPress={() => void act(() => joinTeam(code.trim()), tl('Sei dentro')).then((r) => { if (r.ok) { setCode(''); goBack(); } })} />
        </Card>
      ) : null}
    </Page>
  );
}

function TeamView({ team, onBack }: { team: TeamInfo; onBack: () => void }) {
  const th = useTheme();
  const [members, setMembers] = useState<Member[]>([]);
  const [files, setFiles] = useState<TeamFile[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [invite, setInvite] = useState('');
  const admin = team.role === 'owner' || team.role === 'admin';
  const load = useCallback(async () => {
    const [m, f, id] = await Promise.all([listMembers(team.id), listTeamFiles(team.id), myUserId()]);
    if (m.ok) setMembers(m.data); else { void refreshTeams(); if (/permesso/.test(m.message)) { toast(tl('Non fai più parte di questo team.')); onBack(); } }
    if (f.ok) setFiles(f.data); setMe(id);
  }, [team.id, onBack]);
  useEffect(() => { void load(); }, [load]);

  const newInvite = async (role: 'member' | 'admin') => { const r = await inviteCode(team.id, role); if (r.ok) setInvite(r.data); else toast(r.message); };
  const upload = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
    if (r.canceled) return;
    for (const a of r.assets) { const u = await uploadTeamFile(team.id, { uri: a.uri, name: a.name, mime: a.mimeType ?? undefined, size: a.size ?? undefined }); if (!u.ok) { toast(u.message); break; } }
    void load();
  };
  const open = async (f: TeamFile) => {
    const r = await downloadTeamFile(f); if (!r.ok) { toast(r.message); return; }
    try {
      const { File, Paths } = await import('expo-file-system'); const Sharing = await import('expo-sharing');
      const file = new File(Paths.cache, `team-${Date.now().toString(36)}-${f.name.replace(/[^\w.\-]+/g, '_')}`);
      file.create({ overwrite: true }); file.write(r.data);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: f.mime ?? undefined, dialogTitle: f.name });
    } catch { toast(tl('Non riesco ad aprire il file su questo dispositivo.')); }
  };
  const leave = () => confirmDelete(tl('il team «{0}»: perderai subito l\'accesso a pagine e file', team.name), () => { void leaveTeam(team.id).then((r) => { if (r.ok) onBack(); else toast(r.message); }); }, undefined, { title: tl('Uscire dal team?'), okLabel: tl('Esci') });
  const kill = () => confirmDelete(tl('il team «{0}» con tutte le pagine e i file', team.name), () => { void deleteTeam(team.id).then((r) => { if (r.ok) onBack(); else toast(r.message); }); });

  return (
    <Page id="teams" title={team.name} back onBack={onBack}>
      <Card>
        <H>{tl('Pagine condivise')}</H>
        <Body small muted style={{ marginBottom: 8 }}>{tl('Le pagine del team si modificano insieme, in tempo reale. Le crei da LifeWorkspace.')}</Body>
        <Btn small title={tl('Apri LifeWorkspace')} onPress={() => go('workspace')} />
      </Card>
      <Card>
        <Row><H>{tl('Persone')}</H><Body small muted>{members.length}</Body></Row>
        {members.map((m, i) => (
          <Item key={m.user_id} last={i === members.length - 1}>
            <Row><View style={{ flex: 1 }}><Body bold>{m.name || tl('Senza nome')}{m.user_id === me ? ` (${tl('tu')})` : ''}</Body><Body small muted>{tl(ROLE[m.role] ?? m.role)}</Body></View>
              {admin && m.role !== 'owner' && m.user_id !== me ? <Btn small ghost danger title={tl('Rimuovi')} onPress={() => confirmDelete(tl('{0} dal team: non vedrà più né pagine né file', m.name || tl('questa persona')), () => { void removeMember(team.id, m.user_id).then((r) => { if (r.ok) void load(); else toast(r.message); }); }, undefined, { title: tl('Rimuovere?'), okLabel: tl('Rimuovi') })} /> : null}</Row>
          </Item>
        ))}
        {admin ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            <Row gap={8} style={{ justifyContent: 'flex-start' }}><Pill label={tl('Invita un membro')} onPress={() => void newInvite('member')} /><Pill label={tl('Invita un amministratore')} onPress={() => void newInvite('admin')} /></Row>
            {invite ? <View style={{ backgroundColor: th.tile, borderRadius: 12, padding: 12, gap: 6 }}><Body small muted>{tl('Codice (vale 7 giorni, una sola persona):')}</Body><Body bold style={{ fontSize: 22, letterSpacing: 2 }}>{invite}</Body><Btn small ghost title={tl('Condividi')} onPress={() => { void Share.share({ message: tl('Entra nel team «{0}» su LifePilot con il codice {1}', team.name, invite) }); }} /></View> : null}
          </View>
        ) : null}
      </Card>
      <Card>
        <Row><H>{tl('Drive del team')}</H><Btn small ghost icon="plus" title={tl('Carica')} onPress={() => void upload()} /></Row>
        <Body small muted style={{ marginBottom: 6 }}>{tl('File privati: li vedono solo i membri. Se esci o ti rimuovono, non li vedi più.')}</Body>
        {files.length ? files.map((f, i) => (
          <Item key={f.id} last={i === files.length - 1}>
            <Row><View style={{ flex: 1 }}><Body bold numberOfLines={1}>{f.name}</Body><Body small muted>{`${fmtBytes(f.size)} · ${new Date(f.created_at).toLocaleDateString()}`}</Body></View>
              <Btn small ghost title={tl('Apri')} onPress={() => void open(f)} />
              {(admin || f.uploaded_by === me) ? <Btn small ghost danger title={tl('Elimina')} onPress={() => confirmDelete(tl('il file «{0}»', f.name), () => { void deleteTeamFile(f).then((r) => { if (r.ok) void load(); else toast(r.message); }); }, undefined)} /> : null}</Row>
          </Item>
        )) : <Empty text={tl('Nessun file nel Drive del team.')} />}
      </Card>
      {team.role === 'owner' ? <Btn ghost danger small title={tl('Elimina il team')} onPress={kill} /> : <Btn ghost danger small title={tl('Esci dal team')} onPress={leave} />}
    </Page>
  );
}
