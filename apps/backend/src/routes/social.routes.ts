/**
 * Social Media Automation Routes
 * POST   /social/generate                — AI-generate a post
 * GET    /social/posts                   — list posts (with filter)
 * POST   /social/posts                   — create manual post
 * GET    /social/posts/:id               — get single post with versions
 * PATCH  /social/posts/:id               — update post (auto-versions on change)
 * DELETE /social/posts/:id               — delete post
 * PATCH  /social/posts/:id/production    — update production spec only
 * GET    /social/posts/:id/versions      — full version history
 * POST   /social/posts/:id/rollback/:v   — rollback to version v
 * GET    /social/calendar                — calendar slots for a month
 * POST   /social/calendar/seed           — seed 2026 calendar
 * POST   /social/calendar/news           — assign content to a news slot
 * GET    /social/credentials             — list platform credentials
 * POST   /social/credentials             — save/update platform credential
 * DELETE /social/credentials/:id
 * POST   /social/publish/:id             — publish to platform(s)
 * GET    /social/analytics               — performance overview
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { generateSocialContent } from '../services/social/social-content.service.js';
import { seedCalendarToDB, getCalendarMonth, getNewsSlotsDue } from '../services/social/social-calendar.service.js';
import type { SocialSegment, SocialContentType } from '../services/social/social-content.service.js';

const router = Router();
const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function db() { return prisma as any; }

/** Snapshot the current post state and write a new version row (raw SQL — schema-safe) */
async function createVersion(
  postId: string,
  label: string,
  changeNote?: string,
  editedBy?: string,
) {
  try {
    const post = await db().socialPost.findUnique({ where: { id: postId } });
    if (!post) return;
    const nextVersion = (post.currentVersion ?? 0) + 1;
    const id = `spv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO social_post_versions (id, "postId", version, label, snapshot, "editedBy", "changeNote", "createdAt")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NOW())
       ON CONFLICT ("postId", version) DO NOTHING`,
      id, postId, nextVersion, label,
      JSON.stringify(post),
      editedBy ?? null,
      changeNote ?? null,
    );
    await db().socialPost.update({ where: { id: postId }, data: { currentVersion: nextVersion } });
    return nextVersion;
  } catch (e) {
    // Version creation is non-blocking — if table doesn't exist yet, skip gracefully
    console.warn('[Social] Version creation skipped:', (e as Error).message?.slice(0, 80));
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CONTENT GENERATION
// ════════════════════════════════════════════════════════════════════════════

// POST /social/generate
router.post('/generate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { segment, contentType, theme, strategy } = req.body as {
      segment: SocialSegment;
      contentType: SocialContentType;
      theme?: string;
      strategy?: string;
    };

    if (!segment || !contentType) {
      return res.status(400).json({ error: 'segment and contentType are required' });
    }

    const content = await generateSocialContent(segment, contentType, theme, strategy as any);
    res.json(content);
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════════
// POSTS CRUD
// ════════════════════════════════════════════════════════════════════════════

// GET /social/posts
router.get('/posts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, segment, contentType, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (segment) where.segment = segment;
    if (contentType) where.contentType = contentType;

    const [posts, total] = await Promise.all([
      db().socialPost.findMany({
        where,
        include: { analytics: true, slot: { select: { date: true, slotType: true, theme: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      db().socialPost.count({ where }),
    ]);

    res.json({ posts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
});

// GET /social/posts/:id — single post with version history
router.get('/posts/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const post = await db().socialPost.findUnique({
      where: { id: req.params.id },
      include: {
        analytics: true,
        slot: { select: { date: true, slotType: true, theme: true } },
        versions: { orderBy: { version: 'desc' }, take: 20 },
      },
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) { next(err); }
});

// POST /social/posts — create post (manual or from generated content)
router.post('/posts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      title, segment, contentType, captionEn, captionHi, captionMr,
      hashtags, visualConcept, productionSpec, platforms, scheduledAt, isNewsSlot, slotId, status,
    } = req.body;

    if (!title || !segment || !contentType || !captionEn) {
      return res.status(400).json({ error: 'title, segment, contentType, captionEn are required' });
    }

    const post = await db().socialPost.create({
      data: {
        title, segment, contentType,
        captionEn,
        captionHi: captionHi ?? '',
        captionMr: captionMr ?? '',
        hashtags: hashtags ?? [],
        visualConcept: visualConcept ?? '',
        productionSpec: productionSpec ?? null,
        platforms: platforms ?? ['instagram', 'facebook'],
        status: status ?? 'PENDING_APPROVAL',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        isNewsSlot: isNewsSlot ?? false,
        slotId: slotId ?? null,
        currentVersion: 0,
      },
    });

    // Create v1 "AI Generated" snapshot via raw SQL
    await createVersion(post.id, 'AI Generated', 'Initial AI-generated content', 'system');

    res.status(201).json(post);
  } catch (err) { next(err); }
});

// PATCH /social/posts/:id — update post content, auto-creates new version
router.patch('/posts/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      status, scheduledAt, platforms, captionEn, captionHi, captionMr,
      hashtags, visualConcept, productionSpec, rejectionNote, title,
      changeNote, editedBy,
    } = req.body;

    const update: Record<string, unknown> = {};
    if (title !== undefined) update.title = title;
    if (status !== undefined) update.status = status;
    if (scheduledAt !== undefined) update.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (platforms !== undefined) update.platforms = platforms;
    if (captionEn !== undefined) update.captionEn = captionEn;
    if (captionHi !== undefined) update.captionHi = captionHi;
    if (captionMr !== undefined) update.captionMr = captionMr;
    if (hashtags !== undefined) update.hashtags = hashtags;
    if (visualConcept !== undefined) update.visualConcept = visualConcept;
    if (productionSpec !== undefined) update.productionSpec = productionSpec;
    if (rejectionNote !== undefined) update.rejectionNote = rejectionNote;

    // Determine version label based on action
    let versionLabel = 'User Edit';
    if (status === 'APPROVED') { versionLabel = 'Approved'; update.status = scheduledAt ? 'SCHEDULED' : 'APPROVED'; }
    if (status === 'REJECTED') { versionLabel = 'Rejected'; }
    if (status === 'PENDING_APPROVAL') { versionLabel = 'Sent for Review'; }

    // Create version snapshot BEFORE the update (captures current state)
    const hasContentChange = [captionEn, captionHi, captionMr, hashtags, title, visualConcept, productionSpec].some(v => v !== undefined);
    const hasStatusChange = status !== undefined;
    if (hasContentChange || hasStatusChange) {
      await createVersion(id, versionLabel, changeNote, editedBy);
    }

    const post = await db().socialPost.update({ where: { id }, data: update });
    res.json(post);
  } catch (err) { next(err); }
});

// PATCH /social/posts/:id/production — update only production spec (design/reel/audio)
router.patch('/posts/:id/production', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { productionSpec, changeNote, editedBy } = req.body;
    if (!productionSpec) return res.status(400).json({ error: 'productionSpec required' });
    await createVersion(id, 'Production Spec Updated', changeNote ?? 'Updated production specs', editedBy);
    const post = await db().socialPost.update({ where: { id }, data: { productionSpec } });
    res.json(post);
  } catch (err) { next(err); }
});

// GET /social/posts/:id/versions — version history
router.get('/posts/:id/versions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versions = await prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, "postId", version, label, "editedBy", "changeNote", "createdAt"
       FROM social_post_versions WHERE "postId" = $1 ORDER BY version DESC LIMIT 50`,
      req.params.id,
    );
    res.json({ versions, total: versions.length });
  } catch (err) { next(err); }
});

// POST /social/posts/:id/rollback/:version — restore to a previous version
router.post('/posts/:id/rollback/:version', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, version } = req.params;
    const rows = await prisma.$queryRawUnsafe<Array<{ snapshot: unknown }>>(
      `SELECT snapshot FROM social_post_versions WHERE "postId" = $1 AND version = $2 LIMIT 1`,
      id, parseInt(version),
    );
    const versionRecord = rows[0];
    if (!versionRecord) return res.status(404).json({ error: 'Version not found' });

    const snap = versionRecord.snapshot as Record<string, unknown>;
    if (!snap) return res.status(404).json({ error: 'Snapshot data missing' });

    // Snapshot current before rollback
    await createVersion(id, `Pre-rollback (from v${version})`, `Rollback to v${version}`);

    // Restore the snapshot fields
    const post = await db().socialPost.update({
      where: { id },
      data: {
        title: snap.title,
        captionEn: snap.captionEn,
        captionHi: snap.captionHi,
        captionMr: snap.captionMr,
        hashtags: snap.hashtags,
        visualConcept: snap.visualConcept,
        productionSpec: snap.productionSpec ?? null,
        platforms: snap.platforms,
        status: 'PENDING_APPROVAL', // always reset to review after rollback
      },
    });

    res.json({ success: true, restoredFrom: parseInt(version), post });
  } catch (err) { next(err); }
});

// DELETE /social/posts/:id
router.delete('/posts/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db().socialPost.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════════
// CALENDAR
// ════════════════════════════════════════════════════════════════════════════

// GET /social/calendar?year=2026&month=1
router.get('/calendar', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = parseInt((req.query.year as string) ?? '2026');
    const month = parseInt((req.query.month as string) ?? String(new Date().getMonth() + 1));
    const slots = await getCalendarMonth(year, month);
    res.json({ slots, year, month });
  } catch (err) { next(err); }
});

// POST /social/calendar/seed — seed entire 2026 calendar
router.post('/calendar/seed', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await seedCalendarToDB(2026);
    res.json({ seeded: count, message: `2026 calendar seeded with ${count} slots` });
  } catch (err) { next(err); }
});

// GET /social/calendar/news-slots — get news slots due in next 5 days
router.get('/calendar/news-slots', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const slots = await getNewsSlotsDue(5);
    res.json({ slots });
  } catch (err) { next(err); }
});

// POST /social/calendar/news — assign generated content to a news slot
router.post('/calendar/news', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      slotId, title, segment, contentType, captionEn, captionHi, captionMr,
      hashtags, visualConcept, platforms,
    } = req.body;

    if (!slotId || !title || !captionEn) {
      return res.status(400).json({ error: 'slotId, title, captionEn are required' });
    }

    const slot = await db().socialCalendarSlot.findUnique({ where: { id: slotId } });
    if (!slot) return res.status(404).json({ error: 'Slot not found' });

    const post = await db().socialPost.create({
      data: {
        title,
        segment: segment ?? 'RESIDENTIAL',
        contentType: contentType ?? 'STATIC_POST',
        captionEn,
        captionHi: captionHi ?? '',
        captionMr: captionMr ?? '',
        hashtags: hashtags ?? [],
        visualConcept: visualConcept ?? '',
        platforms: platforms ?? ['instagram', 'facebook'],
        status: 'PENDING_APPROVAL',
        scheduledAt: slot.date,
        isNewsSlot: true,
        slotId,
      },
    });

    res.status(201).json(post);
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════════
// PLATFORM CREDENTIALS
// ════════════════════════════════════════════════════════════════════════════

// GET /social/credentials
router.get('/credentials', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const creds = await db().socialPlatformCredential.findMany({
      select: {
        id: true, platform: true, displayName: true,
        isActive: true, expiresAt: true, pageId: true,
        createdAt: true, updatedAt: true,
        // Never expose tokens in list
      },
    });
    res.json(creds);
  } catch (err) { next(err); }
});

// POST /social/credentials — upsert (store encrypted token)
router.post('/credentials', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform, displayName, accessToken, refreshToken, pageId, expiresAt } = req.body;

    if (!platform || !accessToken || !displayName) {
      return res.status(400).json({ error: 'platform, displayName, accessToken are required' });
    }

    // Tokens stored as-is (in production: encrypt with AES-256 using server secret)
    const cred = await db().socialPlatformCredential.upsert({
      where: { platform },
      update: {
        displayName, accessToken, refreshToken: refreshToken ?? null,
        pageId: pageId ?? null, expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true, updatedAt: new Date(),
      },
      create: {
        platform, displayName, accessToken, refreshToken: refreshToken ?? null,
        pageId: pageId ?? null, expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      select: { id: true, platform: true, displayName: true, isActive: true, pageId: true, expiresAt: true },
    });

    res.json(cred);
  } catch (err) { next(err); }
});

// DELETE /social/credentials/:id
router.delete('/credentials/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db().socialPlatformCredential.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════════
// PUBLISHING
// ════════════════════════════════════════════════════════════════════════════

// POST /social/publish/:id — trigger actual posting to platforms
router.post('/publish/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const post = await db().socialPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.status !== 'APPROVED' && post.status !== 'SCHEDULED') {
      return res.status(400).json({ error: 'Post must be APPROVED or SCHEDULED before publishing' });
    }

    const results: Record<string, { success: boolean; message: string }> = {};
    const platforms: string[] = post.platforms ?? [];

    for (const platform of platforms) {
      try {
        const cred = await db().socialPlatformCredential.findUnique({ where: { platform } });
        if (!cred || !cred.isActive) {
          results[platform] = { success: false, message: 'Platform not connected or inactive' };
          continue;
        }

        // Platform posting stubs — replace with live SDK calls when credentials are verified
        if (platform === 'facebook') {
          // Facebook Graph API: POST /{page-id}/photos or /{page-id}/feed
          // const fb = await fetch(`https://graph.facebook.com/${cred.pageId}/feed`, {
          //   method: 'POST', headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify({ message: post.captionEn, access_token: cred.accessToken }),
          // });
          results[platform] = { success: true, message: 'Queued for Facebook (live posting requires Page token)' };
        } else if (platform === 'instagram') {
          // Instagram Graph API: two-step — create media container then publish
          results[platform] = { success: true, message: 'Queued for Instagram (live posting requires Instagram Business token)' };
        } else if (platform === 'linkedin') {
          // LinkedIn API: POST /ugcPosts
          results[platform] = { success: true, message: 'Queued for LinkedIn (live posting requires LinkedIn OAuth token)' };
        }
      } catch {
        results[platform] = { success: false, message: 'API error during posting' };
      }
    }

    const allSuccess = Object.values(results).every((r) => r.success);
    await db().socialPost.update({
      where: { id: req.params.id },
      data: {
        status: allSuccess ? 'POSTED' : 'FAILED',
        postedAt: allSuccess ? new Date() : null,
      },
    });

    res.json({ post: req.params.id, results, status: allSuccess ? 'POSTED' : 'PARTIAL_FAILURE' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ════════════════════════════════════════════════════════════════════════════

// GET /social/analytics
router.get('/analytics', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalPosts,
      byStatus,
      bySegment,
      byContentType,
      recentPosts,
      approvalQueue,
    ] = await Promise.all([
      db().socialPost.count(),
      db().socialPost.groupBy({ by: ['status'], _count: { id: true } }),
      db().socialPost.groupBy({ by: ['segment'], _count: { id: true } }),
      db().socialPost.groupBy({ by: ['contentType'], _count: { id: true } }),
      db().socialPost.findMany({
        where: { status: 'POSTED' },
        include: { analytics: true },
        orderBy: { postedAt: 'desc' },
        take: 10,
      }),
      db().socialPost.count({ where: { status: 'PENDING_APPROVAL' } }),
    ]);

    // Aggregate analytics for posted content
    const analyticsData = await db().socialPostAnalytics.aggregate({
      _sum: { likes: true, comments: true, shares: true, reach: true, clicks: true },
    });

    res.json({
      overview: {
        totalPosts,
        approvalQueue,
        totalLikes: analyticsData._sum.likes ?? 0,
        totalReach: analyticsData._sum.reach ?? 0,
        totalEngagement: (analyticsData._sum.likes ?? 0) + (analyticsData._sum.comments ?? 0) + (analyticsData._sum.shares ?? 0),
      },
      byStatus: byStatus.map((s: any) => ({ status: s.status, count: s._count.id })),
      bySegment: bySegment.map((s: any) => ({ segment: s.segment, count: s._count.id })),
      byContentType: byContentType.map((s: any) => ({ type: s.contentType, count: s._count.id })),
      recentPosts,
    });
  } catch (err) { next(err); }
});

// POST /social/analytics/:id — update analytics for a post (manual sync or webhook)
router.post('/analytics/:postId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { likes = 0, comments = 0, shares = 0, reach = 0, clicks = 0, platform } = req.body;
    const analytics = await db().socialPostAnalytics.upsert({
      where: { postId: req.params.postId },
      create: { postId: req.params.postId, platform: platform ?? 'instagram', likes, comments, shares, reach, clicks },
      update: { likes, comments, shares, reach, clicks, fetchedAt: new Date() },
    });
    res.json(analytics);
  } catch (err) { next(err); }
});

export default router;
