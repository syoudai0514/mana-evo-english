import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
function offlineAssets() {
  const fixedFiles = [
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/apple-touch-icon.png',
    '/monsters/m049.webp',
    '/monsters/m186.webp',
    '/learning/toeic/photo-sheet-v1.png'
  ]
  let version = 'dev',
    outputDir,
    publicDir,
    rootDir
  return {
    name: 'english-offline-assets',
    configResolved(config) {
      outputDir = config.build.outDir
      publicDir = config.publicDir
      rootDir = config.root
    },
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle).filter((name) =>
        /\.(js|css)$/.test(name)
      )
      version = createHash('sha256')
        .update(assets.sort().join('\n'))
        .update(readFileSync(resolve(rootDir, 'index.html')))
        .update(
          Buffer.concat(
            fixedFiles.map((name) =>
              readFileSync(resolve(publicDir, name.slice(1)))
            )
          )
        )
        .digest('hex')
        .slice(0, 12)
      this.emitFile({
        type: 'asset',
        fileName: 'precache.json',
        source: JSON.stringify({
          version,
          files: ['/', ...fixedFiles, ...assets.map((name) => `/${name}`)]
        })
      })
    },
    writeBundle() {
      const path = resolve(outputDir, 'sw.js')
      writeFileSync(
        path,
        readFileSync(path, 'utf8').replace('__BUILD_VERSION__', version)
      )
    }
  }
}
export default defineConfig({
  plugins: [react(), offlineAssets()],
  build: {
    target: 'es2020',
    assetsInlineLimit: (file) =>
      file.endsWith('.worklet.js') ? false : undefined
  }
})
