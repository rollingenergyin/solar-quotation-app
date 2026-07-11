/**
 * Links generated JPG/MP4 files to their SocialPost records.
 * Stores URLs in productionSpec.generatedAssets so the frontend can display them.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const BASE     = process.env.API_BASE ?? 'http://localhost:4000/api';
const ASSET_BASE = 'http://localhost:4000/assets/output';
const JPG_DIR  = resolve(__dirname, '../assets/output/jpg');
const MP4_DIR  = resolve(__dirname, '../assets/output/mp4');

async function login() {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUserId: 'admin@solar.com', password: 'Admin123!' }),
  });
  return ((await r.json()) as { token: string }).token;
}

function slug(i: number, title: string, date: string) {
  return `${String(i).padStart(2, '0')}-${date}-${title.slice(0, 35)
    .replace(/[^a-z0-9]/gi, '-').toLowerCase()}`.replace(/-+/g, '-').replace(/-$/g, '');
}

async function main() {
  console.log('\n🔗 Solar Growth OS — Linking generated assets to posts\n');

  const token = await login();
  const r = await fetch(`${BASE}/social/posts?limit=50`, { headers: { Authorization: `Bearer ${token}` } });
  const { posts } = await r.json() as { posts: any[] };
  posts.sort((a: any, b: any) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());

  // Read all generated files
  const jpgFiles = existsSync(JPG_DIR) ? readdirSync(JPG_DIR) : [];
  const mp4Files = existsSync(MP4_DIR) ? readdirSync(MP4_DIR) : [];

  let linked = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const dateStr = post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 10) : `post-${i + 1}`;
    const prefix = slug(i + 1, post.title, dateStr);

    const generatedAssets: Record<string, any> = {};

    if (post.contentType === 'REEL') {
      // Find MP4 file
      const mp4 = mp4Files.find(f => f.startsWith(prefix));
      if (mp4) {
        generatedAssets.mp4Url = `${ASSET_BASE}/mp4/${mp4}`;
        // Also find cover JPG (use first slide of adjacent carousel or first jpg with same prefix)
        const coverJpg = jpgFiles.find(f => f.startsWith(prefix));
        if (coverJpg) generatedAssets.jpgUrl = `${ASSET_BASE}/jpg/${coverJpg}`;
      }
    } else if (post.contentType === 'CAROUSEL') {
      // Find all slide JPGs
      const slides = jpgFiles.filter(f => f.startsWith(prefix + '-slide')).sort();
      if (slides.length > 0) {
        generatedAssets.jpgUrl = `${ASSET_BASE}/jpg/${slides[0]}`; // cover
        generatedAssets.slideUrls = slides.map(f => `${ASSET_BASE}/jpg/${f}`);
      }
    } else {
      // Static post
      const jpg = jpgFiles.find(f => f.startsWith(prefix) && !f.includes('-slide'));
      if (jpg) generatedAssets.jpgUrl = `${ASSET_BASE}/jpg/${jpg}`;
    }

    if (Object.keys(generatedAssets).length === 0) {
      console.log(`  ⚠️  [${String(i + 1).padStart(2, '0')}] No files found for: ${post.title.slice(0, 50)}`);
      continue;
    }

    // Merge into existing productionSpec
    const existingSpec = post.productionSpec ?? {};
    const updatedSpec = { ...existingSpec, generatedAssets };

    const res = await fetch(`${BASE}/social/posts/${post.id}/production`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ productionSpec: updatedSpec, changeNote: 'Asset URLs linked' }),
    });

    if (res.ok) {
      const icon = post.contentType === 'REEL' ? '🎬' : post.contentType === 'CAROUSEL' ? '🎠' : '🖼️';
      const assetInfo = generatedAssets.slideUrls
        ? `${generatedAssets.slideUrls.length} slides`
        : generatedAssets.mp4Url ? 'MP4 + cover' : 'JPG';
      console.log(`  ${icon} [${String(i + 1).padStart(2, '0')}] ${post.title.slice(0, 48)} — ${assetInfo}`);
      linked++;
    } else {
      console.log(`  ❌ [${String(i + 1).padStart(2, '0')}] Failed to update: ${await res.text()}`);
    }
  }

  console.log(`\n✅  Linked ${linked}/${posts.length} posts\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
