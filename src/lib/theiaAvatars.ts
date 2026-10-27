import type { AvatarId } from './theiaAvatarIds';

/** Le immagini delle facce di Theia (assets/theia/avatars). Metro vuole require statici, per questo l'elenco è scritto per esteso. */
export const AVATAR_IMG: Record<AvatarId, number> = {
  salute: require('../../assets/theia/avatars/01-salute.png'),
  alimentazione: require('../../assets/theia/avatars/02-alimentazione.png'),
  fitness: require('../../assets/theia/avatars/03-fitness.png'),
  mente: require('../../assets/theia/avatars/04-mente.png'),
  finanza: require('../../assets/theia/avatars/05-finanza.png'),
  fisco: require('../../assets/theia/avatars/06-fisco.png'),
  diritto: require('../../assets/theia/avatars/07-diritto.png'),
  lavoro: require('../../assets/theia/avatars/08-lavoro.png'),
  casa: require('../../assets/theia/avatars/09-casa.png'),
  viaggi: require('../../assets/theia/avatars/10-viaggi.png'),
  famiglia: require('../../assets/theia/avatars/11-famiglia.png'),
  auto: require('../../assets/theia/avatars/12-auto.png'),
  animali: require('../../assets/theia/avatars/13-animali.png'),
  studio: require('../../assets/theia/avatars/14-studio.png'),
  tecnologia: require('../../assets/theia/avatars/15-tecnologia.png'),
  business: require('../../assets/theia/avatars/16-business.png'),
  scienza: require('../../assets/theia/avatars/17-scienza.png'),
  pratiche: require('../../assets/theia/avatars/18-pratiche.png'),
  sicurezza: require('../../assets/theia/avatars/19-sicurezza.png'),
  ambiente: require('../../assets/theia/avatars/20-ambiente.png'),
};
