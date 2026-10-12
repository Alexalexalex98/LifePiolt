import { useSyncExternalStore } from 'react';

import { getNotices, getStorageInfo, subscribeNotices } from '@/db/status';

export const useNotices = () => useSyncExternalStore(subscribeNotices, getNotices, getNotices);
export const useStorageInfo = () => useSyncExternalStore(subscribeNotices, getStorageInfo, getStorageInfo);
