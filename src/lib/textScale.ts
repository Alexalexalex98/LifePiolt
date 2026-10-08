import { TEXT_LG_SCALE } from '@/constants/theme';
import { useApp } from '@/store/app';

import { setTextScaleFactor } from './rn-shim';

/** Collega "Testo più grande" (Impostazioni > Accessibilità) al wrapper <Text> di rn-shim. */
let installed = false;
export function installTextScale() {
  if (installed) return;
  installed = true;
  const sync = () => setTextScaleFactor(useApp.getState().accessibility.textLg ? TEXT_LG_SCALE : 1);
  sync();
  useApp.subscribe(sync);
}
