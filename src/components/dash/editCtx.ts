import { createContext } from 'react';

/** I widget leggono da qui come entrare in modifica con un tocco lungo. */
export const EditCtx = createContext<{ enter: () => void } | null>(null);
