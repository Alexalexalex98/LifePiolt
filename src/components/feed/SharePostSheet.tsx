import { PickChatsSheet } from '@/components/chat/sheets';
import { translateText } from '@/i18n/core';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

/** Condividi dentro l'app: il post (con la sua foto o il suo video) arriva nelle chat scelte. */
export function SharePostSheet({ visible, onClose, author, text, media, uri, likeKey }: { visible: boolean; onClose: () => void; author: string; text: string; media?: 'photo' | 'video' | null; uri?: string; likeKey?: string }) {
  const me = useApp((s) => s.account.name);
  return (
    <PickChatsSheet visible={visible} title="Condividi con…" me={me} onClose={onClose} onPick={(ids) => {
      const caption = `${translateText('Post di')} ${author}: ${text}`;
      ids.forEach((id) => useChat.getState().send(id, me, media && uri ? { kind: media === 'video' ? 'video' : 'image', text: caption, media: { uri, mime: media === 'video' ? 'video/mp4' : 'image/jpeg' } } : { kind: 'text', text: caption }));
      if (likeKey) useNet.getState().bumpReach(likeKey, 'share');
      onClose();
      toast(`Condiviso con ${ids.length} ${ids.length === 1 ? 'chat' : 'chat'}`);
    }} />
  );
}
