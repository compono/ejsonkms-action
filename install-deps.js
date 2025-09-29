#!/usr/bin/env node

import os from 'os';
import https from 'https';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname workaround for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Step 2: Define download URL and filenames
const version = '0.2.2';
const filename = `ejsonkms_${version}_linux_${architecture}.tar.gz`;
const url = `https://github.com/envato/ejsonkms/releases/download/v${version}/${filename}`;
const outputFile = path.join(__dirname, 'ejsonkms.tar.gz');

// Step 3: Download file
function download(url, dest, callback) {
  const file = fs.createWriteStream(dest);
  https.get(url, (response) => {
    if (response.statusCode !== 200) {
      console.error(`Failed to download: ${url}`);
      process.exit(1);
    }
    response.pipe(file);
    file.on('finish', () => {
      file.close(callback);
    });
  }).on('error', (err) => {
    fs.unlink(dest, () => {}); // Delete the file on error
    console.error('Error downloading file:', err.message);
    process.exit(1);
  });
}

// Step 4: Extract, move, chmod, and cleanup
function installBinary() {
  try {
    execSync('tar xfvz ejsonkms.tar.gz', { stdio: 'ignore' });
    execSync('mv ejsonkms /usr/local/bin/');
    execSync('chmod +x /usr/local/bin/ejsonkms');
    fs.unlinkSync('ejsonkms.tar.gz');
    console.log('ejsonkms installed successfully.');
  } catch (err) {
    console.error('Installation failed:', err.message);
    process.exit(1);
  }
}

// Run the steps
download(url, outputFile, installBinary);

