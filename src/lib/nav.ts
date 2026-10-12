import { router, type Href } from 'expo-router';
import { log } from '@/lib/log';
import { toast } from '@/store/toast';

export const pageHref = (page: string, params?: Record<string, string>): Href => {
  const path = page === 'home' ? '/' : `/${page}`;
  return (params ? { pathname: path, params } : path) as Href;
};

/** Quando si è aperta l'ultima pagina in avanti: le pagine lo usano per ripartire dall'alto (tornando indietro, invece, restano dov'erano). */
export const navState = { forwardAt: 0 };
export const isFreshForward = () => Date.now() - navState.forwardAt < 1500;

export function go(page: string, params?: Record<string, string>) {
  navState.forwardAt = Date.now();
  try { router.navigate(pageHref(page, params)); } catch (e) { toast('Non riesco ad aprire questa pagina'); log.warn('nav', `Apertura pagina fallita: ${page}`, e); }
}
export function goBack() {
  navState.forwardAt = 0;
  if (router.canGoBack()) router.back();
  else router.navigate('/');
}
