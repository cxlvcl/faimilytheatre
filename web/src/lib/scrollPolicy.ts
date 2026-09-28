export interface ReturnToList { pathname: '/repertoire' | '/afisha'; key: string; y: number }
export function isPerformancePath(path: string): boolean { return /^\/repertoire\/[^/]+$/.test(path) }
export function listReturnState(pathname: string, key: string, y: number, destination: string): ReturnToList | undefined {
  return (pathname === '/repertoire' || pathname === '/afisha') && isPerformancePath(destination)
    ? { pathname, key, y: Math.max(0, y) } : undefined
}
export function scrollDestination(navigation: string, previousPath: string, pathname: string, key: string, origin?: ReturnToList): number {
  return navigation === 'POP' && isPerformancePath(previousPath) && origin?.pathname === pathname && origin.key === key ? origin.y : 0
}
