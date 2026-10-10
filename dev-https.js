// Dev only: serves Vite over HTTPS for phones on the LAN, because iOS only sends motion
// data to secure pages. Plain JavaScript, so the game's TypeScript needs no Node types.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CERT_DIR = join(dirname(fileURLToPath(import.meta.url)), '.certs')

/**
 * HTTPS options when `SIEVE_HTTPS` is set, otherwise undefined. Makes a self-signed
 * certificate with openssl the first time and keeps it in `.certs/`.
 */
export function devHttps() {
  if (!process.env.SIEVE_HTTPS) return undefined
  const key = join(CERT_DIR, 'key.pem')
  const cert = join(CERT_DIR, 'cert.pem')
  if (!existsSync(key) || !existsSync(cert)) {
    mkdirSync(CERT_DIR, { recursive: true })
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        key,
        '-out',
        cert,
        '-days',
        '365',
        '-subj',
        '/CN=water-in-a-sieve.local'
      ],
      { stdio: 'ignore' }
    )
  }
  return { key: readFileSync(key, 'utf8'), cert: readFileSync(cert, 'utf8') }
}
