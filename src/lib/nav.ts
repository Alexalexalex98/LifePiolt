import { router, type Href } from 'expo-router';
import { toast } from '@/store/toast';

export const pageHref = (page: string, params?: Record<string, string>): Href => {
  const path = page === 'home' ? '/' : `/${page}`;
  return (params ? { pathname: path, params } : path) as Href;
};

export function go(page: string, params?: Record<string, string>) {
  try { router.navigate(pageHref(page, params)); } catch (e) { toast('Non riesco ad aprire questa pagina'); console.warn('go', page, e); }
}
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.navigate('/');
}
