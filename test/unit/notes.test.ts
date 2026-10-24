import { describe, expect, it } from 'vitest'
import { isAutoImportNote, parseNotes } from '../../shared/utils/notes'
import golden from '../../reference/fixtures/calculations/golden_notes.json'

// markupsafe.escape
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;').replace(/"/g, '&#34;')

const renderLikeOldApp = (notes: string) =>
  parseNotes(notes)
    .map((l) =>
      l.link
        ? `${escapeHtml(l.before)}<a href="${escapeHtml(l.link.url)}" target="_blank" rel="noreferrer">${escapeHtml(l.link.text)}</a>`
        : escapeHtml(l.before),
    )
    .join('<br>')

describe('notes (golden fixture: the old app\'s own format_notes_html)', () => {
  for (const c of golden.cases) {
    it(JSON.stringify(c.notes).slice(0, 70), () => {
      expect(renderLikeOldApp(c.notes)).toBe(c.expected_html)
    })
  }
})

describe('isAutoImportNote', () => {
  it('recognises the automatic import line, in either spelling and after normalisation', () => {
    for (const n of [
      'Geïmporteerd van OSTA: https://www.osta.nl/?pid=1',
      'Geimporteerd van SpeedSkatingResults',
      'Imported from OSTA pid abc',
    ]) {
      expect(isAutoImportNote(parseNotes(n)[0]!), n).toBe(true)
    }
  })

  it('leaves real notes alone', () => {
    for (const n of ['Goed ijs', 'Zie https://example.com/x', 'Rondetijden van OSTA']) {
      expect(isAutoImportNote(parseNotes(n)[0]!), n).toBe(false)
    }
  })
})
