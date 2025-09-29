#!/usr/bin/env node

import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname workaround for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  // Step 0: Run `npm ci`
  console.log('🔧 Running npm ci...');
  execSync('npm ci', { stdio: 'inherit' });
} catch (err) {
  console.error('❌ npm ci failed:', err.message);
  process.exit(1);
}

// Step 1: Determine architecture
const machine = os.arch();
let architecture = '';

switch (machine) {
  case 'x64':
    architecture = 'amd64';
    break;
  case 'arm64':
    architecture = 'arm64';
    break;
  default:
    console.error(`${machine} Unsupported platform`);
    process.exit(1);
}

console.log('Installing ejsonkms...');

// Step 2: Define version and URL
const version = '0.2.2';
const filename = `ejsonkms_${version}_linux_${architecture}.tar.gz`;
const url = `https://github.com/envato/ejsonkms/releases/download/v${version}/${filename}`;
const tarball = path.join(__dirname, 'ejsonkms.tar.gz');

try {
  // Step 3: Download file using curl
  console.log(`Downloading ${url}...`);
  execSync(`curl -sLo "${tarball}" "${url}"`, { stdio: 'inherit' });

  // Step 4: Extract, move, chmod, and cleanup
  execSync(`tar xfvz "${tarball}"`, { stdio: 'ignore' });
  execSync('mv ejsonkms /usr/local/bin/');
  execSync('chmod +x /usr/local/bin/ejsonkms');
  fs.unlinkSync(tarball);

  console.log('✅ ejsonkms installed successfully.');
} catch (err) {
  console.error('❌ Installation failed:', err.message);
  process.exit(1);
}

