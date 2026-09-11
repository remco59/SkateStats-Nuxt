/** Ported from app/main.py `norm_name` (old app, commit 4dc6959). */
export function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}
