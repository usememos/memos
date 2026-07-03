import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import type { Env } from "../env";
import { listMemos, type MemoRow } from "../store/memos";
import { getUser } from "../store/users";
import { generateSnippet } from "../markdown/extract";

const MAX_FEED_ITEMS = 100;
const CACHE_TTL_SECONDS = 3600;

const htmlProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify);

// Handles /explore/rss.xml, /u/{username}/rss.xml, /robots.txt, /sitemap.xml.
// Only PUBLIC memos are ever exposed. Returns undefined for other paths.
export async function handlePublicContent(request: Request, env: Env): Promise<Response | undefined> {
  const url = new URL(request.url);
  const instanceUrl = env.INSTANCE_URL || url.origin;

  if (url.pathname === "/robots.txt") {
    return new Response(`User-agent: *\nAllow: /\nHost: ${instanceUrl}\nSitemap: ${instanceUrl}/sitemap.xml`, {
      headers: { "Content-Type": "text/plain" },
    });
  }
  if (url.pathname === "/sitemap.xml") {
    return withCache(request, async () => {
      const memos = await listMemos(env.DB, {
        visibilityList: ["PUBLIC"],
        rowStatus: "NORMAL",
        excludeComments: true,
        excludeContent: true,
        limit: 1000,
      });
      const urls = [
        `<url><loc>${escapeXml(instanceUrl)}/explore</loc></url>`,
        ...memos.map((m) => `<url><loc>${escapeXml(`${instanceUrl}/memos/${m.uid}`)}</loc></url>`),
      ];
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
      return new Response(xml, { headers: { "Content-Type": "application/xml" } });
    });
  }
  if (url.pathname === "/explore/rss.xml") {
    return withCache(request, async () => {
      const memos = await listMemos(env.DB, {
        visibilityList: ["PUBLIC"],
        rowStatus: "NORMAL",
        excludeComments: true,
        limit: MAX_FEED_ITEMS,
      });
      return buildFeed(env, instanceUrl, "Memos", `${instanceUrl}/explore`, memos);
    });
  }
  const userFeed = /^\/u\/([^/]+)\/rss\.xml$/.exec(url.pathname);
  if (userFeed) {
    return withCache(request, async () => {
      const user = await getUser(env.DB, { username: decodeURIComponent(userFeed[1]!) });
      if (!user) {
        return new Response("Not Found", { status: 404 });
      }
      const memos = await listMemos(env.DB, {
        creatorId: user.id,
        visibilityList: ["PUBLIC"],
        rowStatus: "NORMAL",
        excludeComments: true,
        limit: MAX_FEED_ITEMS,
      });
      return buildFeed(env, instanceUrl, `Memos — ${user.nickname || user.username}`, `${instanceUrl}/u/${user.username}`, memos);
    });
  }
  return undefined;
}

// Edge-caches feed responses for an hour via the Cache API.
async function withCache(request: Request, build: () => Promise<Response>): Promise<Response> {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await build();
  if (response.ok) {
    const cacheable = new Response(response.clone().body, response);
    cacheable.headers.set("Cache-Control", `public, max-age=${CACHE_TTL_SECONDS}`);
    await cache.put(request, cacheable.clone());
    return cacheable;
  }
  return response;
}

async function buildFeed(env: Env, instanceUrl: string, title: string, link: string, memos: MemoRow[]): Promise<Response> {
  const items: string[] = [];
  for (const memo of memos) {
    const memoUrl = `${instanceUrl}/memos/${memo.uid}`;
    const html = String(await htmlProcessor.process(memo.content));
    items.push(
      `<item>` +
        `<title>${escapeXml(generateSnippet(memo.content, 100) || memo.uid)}</title>` +
        `<link>${escapeXml(memoUrl)}</link>` +
        `<guid>${escapeXml(memoUrl)}</guid>` +
        `<pubDate>${new Date(memo.created_ts * 1000).toUTCString()}</pubDate>` +
        `<description><![CDATA[${html}]]></description>` +
        `</item>`,
    );
  }
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0"><channel>` +
    `<title>${escapeXml(title)}</title>` +
    `<link>${escapeXml(link)}</link>` +
    `<description>${escapeXml(title)}</description>` +
    items.join("") +
    `</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml" } });
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}
