// scripts/generate-version.js
const fs = require('fs')
const { execSync } = require('child_process')

function git(cmd) {
  return execSync(cmd).toString().trim()
}

const gitHash = git('git rev-parse HEAD').substring(0, 8)

let baseHash = gitHash
try {
  baseHash = git('git merge-base HEAD origin/master').substring(0, 8)
} catch (e) {
  console.warn(
    'generate-version: could not resolve merge-base with origin/master, falling back to gitHash'
  )
}

const versionInfo = {
  gitHash,
  baseHash,
  buildTime: new Date().toLocaleDateString('en-CA'),
  version: '1.0.0'
}
fs.writeFileSync('public/version.json', JSON.stringify(versionInfo, null, 2))
