// Manually drawn paths are built by scripts/build-lettering.mjs, not a font.
export function TheatreLettering({ variant }: { variant: 'hero' | 'about' }) {
  return <img className="theatre-lettering" src={`/media/lettering/${variant}.svg?v=2`} alt="" aria-hidden="true" width={variant === 'hero' ? 567 : 780} height={variant === 'hero' ? 246 : 357} decoding="async" />
}
