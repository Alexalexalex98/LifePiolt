import { router, type Href } from 'expo-router';

export const pageHref = (page: string, params?: Record<string, string>): Href => {
  const path = page === 'home' ? '/' : `/${page}`;
  return (params ? { pathname: path, params } : path) as Href;
};

export function go(page: string, params?: Record<string, string>) {
  router.navigate(pageHref(page, params));
}
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.navigate('/');
}
