import { describe, expect, it } from 'vitest'
import { splitNameParts } from '../../server/utils/import/names'

describe('splitNameParts (old split_name_parts + this app\'s "Achternaam, Voornaam")', () => {
  it.each([
    ['Remco Land', ['Remco', 'Land']],
    ['Remco van der Land', ['Remco', 'van der Land']],
    ['Land, Remco', ['Remco', 'Land']],
    ['van der Land, Remco', ['Remco', 'van der Land']],
    ['Remco', ['Remco', '']],
    ['  ', ['', '']],
    ['', ['', '']],
  ])('%j -> %j', (input, expected) => {
    expect(splitNameParts(input)).toEqual(expected)
  })
})
