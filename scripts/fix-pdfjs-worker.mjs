// Nitro's dependency tracer (nft) statically analyzes imports to decide
// which files from node_modules to copy into .output/server/node_modules.
// pdfjs-dist (a transitive dependency of pdf-parse) loads its worker file
// via a dynamic import the tracer can't see, so the traced copy is missing
// pdf.worker.mjs -- caught by actually running a real PDF upload against a
// production build (`node .output/server/index.mjs`), not just `nuxt dev`
// or unit tests, which never exercise the traced output at all.
//
// This is safe to run even when nothing is missing (no-op), and safe to
// run in Docker too, since better-sqlite3's prebuild copy already proves
// Nitro's trace is sometimes incomplete for native/dynamically-loaded
// files -- this is the same class of gap.
import { existsSync, copyFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SOURCE = 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
const DEST = '.output/server/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'

if (!existsSync(DEST) && existsSync(SOURCE)) {
  mkdirSync(dirname(DEST), { recursive: true })
  copyFileSync(SOURCE, DEST)
  console.log(`[fix-pdfjs-worker] copied ${SOURCE} -> ${DEST}`)
} else if (existsSync(DEST)) {
  console.log('[fix-pdfjs-worker] already present, nothing to do')
} else {
  console.warn(`[fix-pdfjs-worker] WARNING: source not found at ${SOURCE} -- PDF import will fail at runtime`)
}
