// QR code for the printed booklet: punycode address, so every phone camera reads it.
// Run: npm run qr -w canvas → canvas/public/qr-canvas.svg (published as /assets/canvas/qr-canvas.svg)
import { writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import QRCode from 'qrcode'

const url = 'https://xn--80aanbjgaodo1bgudcs1l.xn--p1ai/canvas?utm_source=booklet'
const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'Q', margin: 4, color: { dark: '#000000', light: '#ffffff' } })
await writeFile(join(resolve(import.meta.dirname, '..'), 'public/qr-canvas.svg'), svg)
console.log(url)
