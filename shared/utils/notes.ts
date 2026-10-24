/**
 * Free-text notes with clickable source links. Ported from the old app's
 * normalize_note_line / format_notes_html, pinned by
 * reference/fixtures/calculations/golden_notes.json (the old function run on
 * 27 notes, including the legacy "Imported from ..." formats that migrated
 * data still contains).
 *
 * Returns structure, not HTML, so the page renders it with plain Vue
 * (no v-html): each line is some text, optionally followed by one link.
 */

export interface NoteLine {
  /** Text before the link (all of it, when there is no link). */
  before: string
  link: { text: string; url: string } | null
}

const OSTA_BASE = 'https://www.osta.nl/'
const URL_LINE_RE = /^(.*?)(https?:\/\/\S+)\s*$/
const SOURCE_NOTE_RE = /^(Geïmporteerd van|Geimporteerd van|Rondetijden van)\s+(.+?):\s*(https?:\/\/\S+)\s*$/

// Python's str.splitlines() splits on more than \n.
const LINE_BREAKS = new RegExp(String.raw`\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]`)

/** urllib.parse.quote(): leaves letters, digits and _.-~ and "/" alone. */
function pythonQuote(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%2F/g, '/')
}

function sourceNote(sourceName: string, url: string | null): string {
  const value = (url ?? '').trim()
  return value ? `Geïmporteerd van ${sourceName}: ${value}` : `Geïmporteerd van ${sourceName}`
}

function updateNote(sourceName: string, url: string | null): string {
  const value = (url ?? '').trim()
  return value ? `Rondetijden van ${sourceName}: ${value}` : `Rondetijden van ${sourceName}`
}

const afterFirstColon = (line: string) => line.slice(line.indexOf(':') + 1).trim()
const firstUrl = (text: string) => text.match(/https?:\/\/\S+/)?.[0] ?? null

/** Rewrites the importers' older note formats into the current wording. */
export function normalizeNoteLine(line: string): string {
  if (line.startsWith('Imported from OSTA:')) {
    return sourceNote('OSTA', afterFirstColon(line))
  }

  if (line.startsWith('Imported from SpeedSkatingResults:')) {
    const raw = afterFirstColon(line)
    if (raw.startsWith('{')) {
      try {
        const payload: unknown = JSON.parse(raw)
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const link = (payload as Record<string, unknown>).link
          return sourceNote('SpeedSkatingResults', link ? String(link) : '')
        }
      } catch {
        // not JSON: fall through to looking for a bare URL, like the old app
      }
    }
    return sourceNote('SpeedSkatingResults', firstUrl(raw))
  }

  if (line.startsWith('Imported from SpeedSkatingResults season ')) {
    return sourceNote('SpeedSkatingResults', firstUrl(line))
  }

  if (line.startsWith('Imported from OSTA pid ')) {
    const pid = line.slice('Imported from OSTA pid '.length).trim()
    return sourceNote('OSTA', pid ? `${OSTA_BASE}index.php?pid=${pythonQuote(pid)}` : '')
  }

  if (line.startsWith('OSTA sync via pid ')) {
    return updateNote('OSTA', null)
  }

  return line
}

export function parseNotes(notes: string | null | undefined): NoteLine[] {
  const lines: NoteLine[] = []
  for (const raw of (notes ?? '').split(LINE_BREAKS)) {
    const line = normalizeNoteLine(raw.trim())
    if (!line) continue

    const source = line.match(SOURCE_NOTE_RE)
    if (source) {
      lines.push({ before: `${source[1]} `, link: { text: source[2]!, url: source[3]! } })
      continue
    }
    const urlLine = line.match(URL_LINE_RE)
    if (urlLine) {
      lines.push({ before: urlLine[1]!, link: { text: urlLine[2]!, url: urlLine[2]! } })
      continue
    }
    lines.push({ before: line, link: null })
  }
  return lines
}

/** The automatic "imported from ..." line, which the race page replaces by a "Bron" link. */
export function isAutoImportNote(line: NoteLine): boolean {
  return /^Ge[iï]mporteerd van /.test(line.before + (line.link ? line.link.text : ''))
}
