import { describe, expect, it } from 'vitest'
import { needsSpaceBefore } from '../../shared/utils/story'

const render = (parts: { text: string }[]) =>
  parts.map((p, i) => (needsSpaceBefore(parts[i - 1], p) ? ' ' : '') + p.text).join('')

describe('needsSpaceBefore', () => {
  it('puts a space between a word and a highlighted value', () => {
    expect(render([{ text: 'Je snelste ronde reed je in' }, { text: 'Thialf' }, { text: ', waar je' }, { text: '28.90' }, { text: ' noteerde op de 1000m.' }])).toBe(
      'Je snelste ronde reed je in Thialf, waar je 28.90 noteerde op de 1000m.',
    )
  })

  it('keeps punctuation attached', () => {
    expect(render([{ text: 'je miste het daar met' }, { text: '4.10' }, { text: '.' }])).toBe('je miste het daar met 4.10.')
  })

  it('does not double up when a part already carries the space', () => {
    expect(render([{ text: 'De' }, { text: '1500m' }, { text: ' was je meest gereden afstand.' }])).toBe(
      'De 1500m was je meest gereden afstand.',
    )
    expect(render([{ text: 'Eén zin.' }, { text: ' ' }, { text: 'Tweede zin.' }])).toBe('Eén zin. Tweede zin.')
  })

  it('adds nothing before the first part', () => {
    expect(needsSpaceBefore(undefined, { text: 'x' })).toBe(false)
  })
})
