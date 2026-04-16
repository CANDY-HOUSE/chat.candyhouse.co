// scripts/generate-version.js
const fs = require('fs');
const { execSync } = require('child_process');

const gitHash = execSync('git rev-parse HEAD').toString().trim().substring(0,8);
const versionInfo = {
    gitHash,
    buildTime: new Date().toLocaleDateString('en-CA'),
    version: '1.0.0'
};
fs.writeFileSync('public/version.json', JSON.stringify(versionInfo, null, 2));
