import { cpSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const standalone = join(root, '.next', 'standalone')

// User uploads are a persistent runtime directory, never part of the bundle.
// They live in /opt/pakloan/uploads on the host and are symlinked into
// public/uploads. Anything already staged gets removed so stale dev images
// (test KYC/proof screenshots) never ship.
const UPLOADS_REL = 'public/uploads'

for (const rel of ['.next/static', 'public']) {
  const src = join(root, rel)
  const dest = join(standalone, rel)
  if (!existsSync(src)) continue
  mkdirSync(dirname(dest), { recursive: true })

  if (rel === 'public') {
    // Remove the target uploads dir (old staged test files) before copying fresh.
    rmSync(join(standalone, UPLOADS_REL), { recursive: true, force: true })
    // Drop source uploads from the copy: runtime data, not app assets.
    cpSync(src, dest, {
      recursive: true,
      filter: (p) => join(p).replace(/\\/g, '/') !== join(src, 'uploads').replace(/\\/g, '/'),
    })
  } else {
    cpSync(src, dest, { recursive: true })
  }
  console.log(`[postbuild] copied ${src} -> ${dest}`)
}

// sharp's native platform binaries are resolved at runtime by platform name. On
// a non-Linux build machine (e.g. Windows) Next's tracer only ships the build
// machine's binary, so the cPanel host would have no image engine. The repo
// keeps the linux x64 (glibc) prebuilt in /vendor/@img/sharp-linux-x64 and it
// is copied into the standalone output so image optimization works on the host.
const VENDORED_SHARP_REL = 'vendor/@img/sharp-linux-x64'
const LINUX_SHARP_REL = 'node_modules/@img/sharp-linux-x64'
const sharpSrc = existsSync(join(root, VENDORED_SHARP_REL)) ? join(root, VENDORED_SHARP_REL) : existsSync(join(root, LINUX_SHARP_REL)) ? join(root, LINUX_SHARP_REL) : null
if (sharpSrc) {
  const dest = join(standalone, 'node_modules', '@img', 'sharp-linux-x64')
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(sharpSrc, dest, { recursive: true })
  console.log(`[postbuild] copied linux sharp binary -> ${dest}`)
}

// Deployment launcher used on the cPanel host (pins DATABASE_URL + starts the
// standalone server). Lives at the repo root and is copied into the bundle.
const START_SRC = join(root, 'start.cjs')
const START_DEST = join(standalone, 'start.cjs')
if (existsSync(START_SRC)) {
  cpSync(START_SRC, START_DEST)
  console.log(`[postbuild] copied ${START_SRC} -> ${START_DEST}`)
}

// The app's SQLite database is runtime data, not part of the source tree used
// for building. The dev/seed database lives in prisma/db and is bundled next to
// the server so the deploy is self-contained. start.cjs pins DATABASE_URL to
// this absolute path regardless of the host working directory.
const DB_SRC = join(root, 'prisma', 'db', 'custom.db')
const DB_DEST = join(standalone, 'db', 'custom.db')
if (existsSync(DB_SRC)) {
  mkdirSync(join(standalone, 'db'), { recursive: true })
  cpSync(DB_SRC, DB_DEST)
  console.log(`[postbuild] copied ${DB_SRC} -> ${DB_DEST}`)
}

// Prisma query-engine binaries are loaded at runtime via fs probes, so Next's
// file-tracing can silently drop them from the standalone output. Copy the
// whole generated client (all configured binaryTargets) so the bundle always
// ships every engine, matching the schema.prisma binaryTargets list.
const PRISMA_SRC = join(root, 'node_modules', '.prisma', 'client')
const PRISMA_DEST = join(standalone, 'node_modules', '.prisma', 'client')
if (existsSync(PRISMA_SRC)) {
  rmSync(PRISMA_DEST, { recursive: true, force: true })
  mkdirSync(PRISMA_DEST, { recursive: true })
  cpSync(PRISMA_SRC, PRISMA_DEST, {
    recursive: true,
    // Skip junk partial-download duplicates (Prisma's atomic rename leftovers).
    filter: (p) => !/\.(node|dll)\.tmp\d+(\.node)?$/.test(p),
  })
  console.log(`[postbuild] copied ${PRISMA_SRC} -> ${PRISMA_DEST}`)
}