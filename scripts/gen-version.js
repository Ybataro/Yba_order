// Build 前自動產生 version.json
import { writeFileSync } from 'fs'

const version = new Date().toISOString()
writeFileSync('public/version.json', JSON.stringify({ version }))
console.log(`📌 version.json generated: ${version}`)
