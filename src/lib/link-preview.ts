// Link previews for texted and shared links. iMessage, WhatsApp, Slack and
// the like fetch a link to build its preview card, but every page sits behind
// the friends & family password, so they used to get nothing back. The proxy
// answers these fetchers with a tiny page holding just a title, a one-line
// description and the SDB image (public/og.png), and none of the page itself.
// Anyone can pretend to be one of them, so the card only ever names the
// section, never a post title, a number or anything else behind the password.

export const SITE_NAME = "somebodydiedbeverly";

const PREVIEW_BOTS =
  /facebookexternalhit|facebot|twitterbot|whatsapp|slackbot|discordbot|telegrambot|linkedinbot|skypeuripreview|iframely|embedly|redditbot|pinterest|snapchat|mastodon|bluesky|signal/i;

export function isPreviewBot(userAgent: string | null): boolean {
  return Boolean(userAgent && PREVIEW_BOTS.test(userAgent));
}

const SECTIONS: [prefix: string, title: string][] = [
  ["/forecast", "2026 Senate forecast"],
  ["/blog", "Blog"],
  ["/gallery", "Gallery"],
  ["/plates", "Diplomat plates"],
];

export const PREVIEW_DESCRIPTION = "Election forecasting and other silly projects. Friends and family only.";

function previewTitle(pathname: string): string {
  const section = SECTIONS.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return section ? `${section[1]} · ${SITE_NAME}` : SITE_NAME;
}

export function previewHtml(pathname: string, origin: string): string {
  const title = previewTitle(pathname);
  const url = `${origin}${pathname}`;
  const image = `${origin}/og.png`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${PREVIEW_DESCRIPTION}">
<meta name="robots" content="noindex, nofollow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${PREVIEW_DESCRIPTION}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
</head><body></body></html>`;
}
