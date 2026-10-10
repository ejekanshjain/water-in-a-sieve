/** HTTPS options when `SIEVE_HTTPS` is set, with a self-signed certificate from `.certs/`. */
export function devHttps(): { key: string; cert: string } | undefined
