/**
 * The story card is built from separate parts (plain text, a coloured number,
 * a link to a race). The old template put whitespace between every part, and
 * the sentences were written for that ("...reed je in" + "Thialf" + ", waar
 * je" + "28.90"). This decides where a space goes when rendering: between two
 * parts, unless the previous one already ends in whitespace or the next one
 * starts with whitespace or punctuation (so no "Thialf ," and no "28.90 .").
 */
export function needsSpaceBefore(previous: { text: string } | undefined, part: { text: string }): boolean {
  if (!previous) return false
  if (/\s$/.test(previous.text)) return false
  return !/^[\s.,;:!?)]/.test(part.text)
}
