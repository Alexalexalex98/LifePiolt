import { TEXT_LG_SCALE } from '@/constants/theme';
import { useApp } from '@/store/app';

import { setTextScaleFactor } from './textScaleState';

/** Collega "Testo più grande" (Impostazioni > Accessibilità) al <Text> di @/components/T. */
let installed = false;
export function installTextScale() {
  if (installed) return;
  installed = true;
  const sync = () => setTextScaleFactor(useApp.getState().accessibility.textLg ? TEXT_LG_SCALE : 1);
  sync();
  useApp.subscribe(sync);
}
