/** Tab icon follows the browser theme: black silhouette on light, white on dark. */
export function initThemeFavicon(): void {
  try {
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.querySelectorAll<HTMLLinkElement>('link[rel="icon"][data-light][data-dark]').forEach(link => {
        const href = dark.matches ? link.dataset.dark : link.dataset.light
        if (href && link.getAttribute('href') !== href) link.setAttribute('href', href)
      })
    }
    apply()
    dark.addEventListener('change', apply)
  } catch { /* The default black icon stays. */ }
}
