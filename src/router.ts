import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'import'; courseId?: string }
  | { name: 'course'; id: string }
  | { name: 'chapter'; id: string }
  | { name: 'review'; courseId?: string }
  | { name: 'boss'; courseId: string }
  | { name: 'data' }
  | { name: 'help' };

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query);
  switch (parts[0]) {
    case 'import':
      return { name: 'import', courseId: params.get('course') ?? undefined };
    case 'course':
      return parts[1] ? { name: 'course', id: parts[1] } : { name: 'home' };
    case 'chapter':
      return parts[1] ? { name: 'chapter', id: parts[1] } : { name: 'home' };
    case 'review':
      return { name: 'review', courseId: parts[1] };
    case 'boss':
      return parts[1] ? { name: 'boss', courseId: parts[1] } : { name: 'home' };
    case 'data':
      return { name: 'data' };
    case 'help':
      return { name: 'help' };
    default:
      return { name: 'home' };
  }
}

export function href(r: Route): string {
  const e = encodeURIComponent;
  switch (r.name) {
    case 'home':
      return '#/';
    case 'import':
      return r.courseId ? `#/import?course=${e(r.courseId)}` : '#/import';
    case 'course':
      return `#/course/${e(r.id)}`;
    case 'chapter':
      return `#/chapter/${e(r.id)}`;
    case 'review':
      return r.courseId ? `#/review/${e(r.courseId)}` : '#/review';
    case 'boss':
      return `#/boss/${e(r.courseId)}`;
    case 'data':
      return '#/data';
    case 'help':
      return '#/help';
  }
}

export function go(r: Route): void {
  window.location.hash = href(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
