#!/usr/bin/env node

/**
 * Sync articles from Google Drive to local repo and convert to HTML.
 *
 * Usage:
 *   node scripts/sync-gdrive.mjs [options]
 *
 * Options:
 *   --local-only    Skip GDrive download, convert existing local files only
 *   --force         Re-download all files, ignore manifest
 *   --dry-run       Show what would happen without writing
 *   --folder NAME   Only process one subfolder (e.g., "2026-04")
 */

import { google } from 'googleapis';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { readdirSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT_FOLDER_ID = '1NftgMsrLgNS_GdIPoqITJP9BHJxD17yE';
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const TOKEN_PATH = join(process.cwd(), '.gdrive-token.json');
const MANIFEST_PATH = join(process.cwd(), '.sync-manifest.json');
const SITE_JSON_PATH = join(process.cwd(), 'src', '_data', 'site.json');
const SRC_ARTICLES = join(process.cwd(), 'src', 'articles');

const CONVERTIBLE_EXTS = new Set(['.md', '.markdown', '.docx']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);
const GDOC_MIME = 'application/vnd.google-apps.document';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const FLAGS = {
  localOnly: args.includes('--local-only'),
  force: args.includes('--force'),
  dryRun: args.includes('--dry-run'),
  folder: args.includes('--folder') ? args[args.indexOf('--folder') + 1] : null,
};

// ---------------------------------------------------------------------------
// .env loader (minimal, no dependency)
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

// ---------------------------------------------------------------------------
// OAuth helper — installed-app flow with local redirect
// ---------------------------------------------------------------------------

async function authorize() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET in .env');
    process.exit(1);
  }

  const REDIRECT_URI = 'http://localhost:8001/import/auth/google/callback';
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  // Try saved token
  if (existsSync(TOKEN_PATH)) {
    const saved = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
    oauth2.setCredentials(saved);
    // Refresh if expired
    if (saved.expiry_date && saved.expiry_date < Date.now()) {
      const { credentials } = await oauth2.refreshAccessToken();
      oauth2.setCredentials(credentials);
      writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2));
    }
    return oauth2;
  }

  // First-time: open browser for consent
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('Opening browser for Google sign-in...');
  const code = await getCodeFromBrowser(authUrl);
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('Token saved to .gdrive-token.json');
  return oauth2;
}

function getCodeFromBrowser(authUrl) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:8001');
      if (url.pathname !== '/import/auth/google/callback') return;
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (error) {
        res.end('Authorization denied. You can close this tab.');
        server.close();
        reject(new Error(`Auth denied: ${error}`));
        return;
      }
      if (code) {
        res.end('Authorization successful! You can close this tab.');
        server.close();
        resolve(code);
      }
    });
    server.listen(8001, () => {
      // Open browser
      import('node:child_process').then(({ execSync }) => {
        execSync(`open "${authUrl}"`);
      });
    });
    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Auth timed out — no response within 2 minutes'));
    }, 120_000);
  });
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

function loadManifest() {
  if (existsSync(MANIFEST_PATH)) {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  }
  return { files: {}, lastSync: null };
}

function saveManifest(manifest) {
  manifest.lastSync = new Date().toISOString();
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// ---------------------------------------------------------------------------
// Google Drive helpers
// ---------------------------------------------------------------------------

async function listChildren(drive, folderId, mimeFilter) {
  const items = [];
  let pageToken;
  do {
    const q = `'${folderId}' in parents and trashed=false` +
      (mimeFilter ? ` and mimeType='${mimeFilter}'` : '');
    const res = await drive.files.list({
      q,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size)',
      pageSize: 100,
      pageToken,
    });
    items.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return items;
}

async function downloadFile(drive, fileId, destPath) {
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  writeFileSync(destPath, Buffer.from(res.data));
}

async function exportGoogleDoc(drive, fileId, destPath) {
  const res = await drive.files.export({ fileId, mimeType: DOCX_MIME }, { responseType: 'arraybuffer' });
  writeFileSync(destPath, Buffer.from(res.data));
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

function slugify(filename) {
  return basename(filename, extname(filename))
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function convertToHtml(filePath) {
  const ext = extname(filePath).toLowerCase();
  const from = ext === '.docx' ? 'docx' : 'markdown';
  const raw = execFileSync('pandoc', [filePath, '-f', from, '-t', 'html', '--wrap=none'], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  // Light cleanup: remove empty spans and div wrappers
  return raw
    .replace(/<span[^>]*>\s*<\/span>/g, '')
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/g, '$1')
    .trim();
}

function extractTitle(html, filename) {
  // Try <h1> first
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) return h1Match[1].replace(/<[^>]+>/g, '').trim();
  // Fall back to filename
  return basename(filename, extname(filename))
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function buildFrontmatter(title, slug) {
  let site = {};
  if (existsSync(SITE_JSON_PATH)) {
    site = JSON.parse(readFileSync(SITE_JSON_PATH, 'utf8'));
  }
  const issue = `vol${site.volume || '1'}-no${site.issue || '1'}`;
  const pubDate = site.season || 'Spring 2026';

  return `---
layout: article.njk
title: "${title.replace(/"/g, '\\"')}"
section: "TODO"
subsection: "TODO"
dek: "TODO"
author: "TODO"
pubDate: "${pubDate}"
issue: "${issue}"
order: 99
permalink: "articles/{{ page.fileSlug }}.html"
---`;
}

// ---------------------------------------------------------------------------
// Stage A: Sync from Google Drive
// ---------------------------------------------------------------------------

async function syncFromDrive(drive, manifest) {
  console.log('\n--- Stage A: Syncing from Google Drive ---\n');

  // List top-level subfolders
  const folders = await listChildren(drive, ROOT_FOLDER_ID, FOLDER_MIME);
  const dateFolders = folders.filter(f => /^20\d{2}-\d{2}$/.test(f.name));

  if (FLAGS.folder) {
    const match = dateFolders.find(f => f.name === FLAGS.folder);
    if (!match) {
      console.error(`Folder "${FLAGS.folder}" not found in Drive. Available: ${dateFolders.map(f => f.name).join(', ')}`);
      process.exit(1);
    }
    dateFolders.length = 0;
    dateFolders.push(match);
  }

  console.log(`Found ${dateFolders.length} issue folder(s): ${dateFolders.map(f => f.name).join(', ')}`);

  const downloaded = [];

  for (const folder of dateFolders) {
    const localDir = join(process.cwd(), folder.name);
    if (!existsSync(localDir)) mkdirSync(localDir, { recursive: true });

    const files = await listChildren(drive, folder.id);
    console.log(`\n  ${folder.name}/  (${files.length} files)`);

    for (const file of files) {
      if (file.mimeType === FOLDER_MIME) continue; // skip nested folders

      const prev = manifest.files[file.id];
      if (!FLAGS.force && prev && prev.modifiedTime === file.modifiedTime) {
        console.log(`    skip  ${file.name} (unchanged)`);
        continue;
      }

      const isGoogleDoc = file.mimeType === GDOC_MIME;
      const ext = isGoogleDoc ? '.docx' : extname(file.name).toLowerCase();
      const localName = isGoogleDoc ? `${file.name}.docx` : file.name;
      const localPath = join(localDir, localName);
      const relPath = `${folder.name}/${localName}`;

      if (FLAGS.dryRun) {
        console.log(`    would download  ${file.name}${isGoogleDoc ? ' (export as .docx)' : ''}`);
      } else {
        if (isGoogleDoc) {
          await exportGoogleDoc(drive, file.id, localPath);
        } else {
          await downloadFile(drive, file.id, localPath);
        }
        console.log(`    downloaded  ${file.name}${isGoogleDoc ? ' → .docx' : ''}`);
      }

      const slug = slugify(localName);
      manifest.files[file.id] = {
        name: file.name,
        modifiedTime: file.modifiedTime,
        localPath: relPath,
        slug,
      };

      if (CONVERTIBLE_EXTS.has(ext)) {
        downloaded.push({ localPath, slug, folderName: folder.name });
      }
    }
  }

  return downloaded;
}

// ---------------------------------------------------------------------------
// Stage B & C: Convert and scaffold
// ---------------------------------------------------------------------------

function convertAndScaffold(files) {
  console.log('\n--- Stage B/C: Convert & Scaffold ---\n');

  let created = 0;
  let skipped = 0;

  for (const { localPath, slug } of files) {
    if (!existsSync(localPath)) {
      console.log(`  skip  ${localPath} (file not found)`);
      skipped++;
      continue;
    }

    const articlePath = join(SRC_ARTICLES, `${slug}.html`);
    if (existsSync(articlePath)) {
      console.log(`  skip  ${slug}.html (already exists in src/articles/)`);
      skipped++;
      continue;
    }

    if (FLAGS.dryRun) {
      console.log(`  would create  src/articles/${slug}.html`);
      created++;
      continue;
    }

    const html = convertToHtml(localPath);
    const title = extractTitle(html, localPath);
    const frontmatter = buildFrontmatter(title, slug);
    const content = `${frontmatter}\n\n${html}\n`;

    mkdirSync(SRC_ARTICLES, { recursive: true });
    writeFileSync(articlePath, content);
    console.log(`  created  src/articles/${slug}.html  ("${title}")`);
    created++;
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped`);
}

// ---------------------------------------------------------------------------
// Local-only mode: convert files already in date folders
// ---------------------------------------------------------------------------

function gatherLocalFiles() {
  const files = [];
  const entries = readdirSync(process.cwd(), { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || !/^20\d{2}-\d{2}$/.test(entry.name)) continue;
    if (FLAGS.folder && entry.name !== FLAGS.folder) continue;

    const dirPath = join(process.cwd(), entry.name);
    for (const file of readdirSync(dirPath)) {
      const ext = extname(file).toLowerCase();
      if (!CONVERTIBLE_EXTS.has(ext)) continue;
      files.push({
        localPath: join(dirPath, file),
        slug: slugify(file),
        folderName: entry.name,
      });
    }
  }

  return files;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnv();

  const manifest = loadManifest();
  let files;

  if (FLAGS.localOnly) {
    console.log('Running in --local-only mode (no GDrive download)\n');
    files = gatherLocalFiles();
  } else {
    const auth = await authorize();
    const drive = google.drive({ version: 'v3', auth });
    files = await syncFromDrive(drive, manifest);

    // Also include any local files not yet converted
    const localFiles = gatherLocalFiles();
    const slugsSeen = new Set(files.map(f => f.slug));
    for (const lf of localFiles) {
      if (!slugsSeen.has(lf.slug)) {
        files.push(lf);
      }
    }
  }

  convertAndScaffold(files);

  if (!FLAGS.dryRun && !FLAGS.localOnly) {
    saveManifest(manifest);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
