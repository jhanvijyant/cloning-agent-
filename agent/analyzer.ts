import * as cheerio from "cheerio";
import type { WebsiteAnalysis, Section } from "./types";

// Heuristics used throughout this file are intentionally simple. The goal
// is "good enough structure for an LLM to work from", not a pixel-perfect
// layout engine. Every guess is a best effort — see README limitations.

export function analyzeHtml(html: string, url: string): WebsiteAnalysis {
  const $ = cheerio.load(html);

  // Strip elements that add noise without visual/content value.
  $("script, noscript, template").remove();

  const title = $("title").first().text().trim() || new URL(url).hostname;
  const description =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null;

  const navigation = extractNavigation($, url);
  const sections = extractSections($);
  const colors = extractColors($, html);
  const typography = extractTypography($, html);
  const assets = extractAssets($, url);
  const layout = {
    hasHeader: $("header").length > 0,
    hasFooter: $("footer").length > 0,
    approxColumns: guessColumnCount($),
  };
  const responsiveNotes = extractResponsiveNotes($, html);

  return {
    url,
    metadata: { title, description },
    navigation,
    sections,
    typography,
    colors,
    assets,
    layout,
    responsiveNotes,
  };
}

function extractNavigation(
  $: cheerio.CheerioAPI,
  baseUrl: string
): WebsiteAnalysis["navigation"] {
  const links: WebsiteAnalysis["navigation"] = [];
  const seen = new Set<string>();

  $("nav a, header a").each((_, el) => {
    const label = $(el).text().trim();
    const href = $(el).attr("href");
    if (!label || !href || label.length > 40) return;
    const key = `${label}|${href}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ label, href: resolveUrl(href, baseUrl) });
  });

  return links.slice(0, 12);
}

// Splits the page into rough "sections" using semantic tags first,
// falling back to top-level divs with visible content.
function extractSections($: cheerio.CheerioAPI): Section[] {
  const candidates = $("body")
    .find("section, header, footer, main > div, [class*='section']")
    .toArray();

  const roots = candidates.length > 0 ? candidates : $("body > *").toArray();

  const sections: Section[] = [];
  let index = 0;

  for (const el of roots) {
    const $el = $(el);
    const text = $el
      .clone()
      .find("script, style")
      .remove()
      .end()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 5 && $el.find("img").length === 0) continue;

    const heading = $el.find("h1, h2, h3").first().text().trim() || null;
    const paragraphs = $el
      .find("p")
      .map((_, p) => $(p).text().trim())
      .get()
      .filter((t) => t.length > 0)
      .slice(0, 6);

    const buttons = $el
      .find("a, button")
      .map((_, b) => ({
        label: $(b).text().trim(),
        href: $(b).attr("href") || null,
      }))
      .get()
      .filter((b) => b.label.length > 0 && b.label.length < 40)
      .slice(0, 5);

    const images = $el
      .find("img")
      .map((_, img) => $(img).attr("src") || "")
      .get()
      .filter(Boolean)
      .slice(0, 6);

    const position = index; // 0-based position before incrementing below
    sections.push({
      id: `section-${index++}`,
      kind: guessSectionKind(el.tagName?.toLowerCase() ?? "", heading, position),
      heading,
      text: paragraphs,
      buttons,
      images,
    });

    if (sections.length >= 12) break; // keep the payload small and cheap
  }

  return sections;
}

function guessSectionKind(
  tag: string,
  heading: string | null,
  position: number
): Section["kind"] {
  if (tag === "header") return "header";
  if (tag === "footer") return "footer";
  const h = (heading || "").toLowerCase();
  if (position === 0 || position === 1) return "hero";
  if (h.includes("pricing") || h.includes("plan")) return "pricing";
  if (h.includes("testimonial") || h.includes("review") || h.includes("customer"))
    return "testimonials";
  if (h.includes("feature") || h.includes("why")) return "feature-grid";
  if (h.includes("gallery") || h.includes("menu") || h.includes("work"))
    return "gallery";
  if (h.includes("contact") || h.includes("get started") || h.includes("sign up"))
    return "cta";
  return "unknown";
}

// Pulls hex/rgb colors out of inline styles and <style> blocks and ranks
// them by frequency. No computed-style access since there's no browser.
function extractColors(
  $: cheerio.CheerioAPI,
  html: string
): WebsiteAnalysis["colors"] {
  const colorRegex = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)/g;
  const counts = new Map<string, number>();

  const styleBlocks = $("style")
    .map((_, s) => $(s).html() || "")
    .get()
    .join("\n");
  const inlineStyles = $("[style]")
    .map((_, el) => $(el).attr("style") || "")
    .get()
    .join(";");

  for (const match of `${styleBlocks}\n${inlineStyles}`.matchAll(colorRegex)) {
    const c = normalizeColor(match[0]);
    if (!c || isNearWhiteOrBlack(c)) continue;
    counts.set(c, (counts.get(c) || 0) + 1);
  }

  const palette = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([c]) => c);

  return {
    palette,
    primary: palette[0] || null,
    background: html.match(/background(-color)?:\s*(#fff|white)/i) ? "#ffffff" : null,
    text: null,
  };
}

function normalizeColor(c: string): string | null {
  if (c.startsWith("#")) return c.toLowerCase();
  return c;
}

function isNearWhiteOrBlack(c: string): boolean {
  const w = ["#fff", "#ffffff", "#000", "#000000", "white", "black"];
  return w.includes(c.toLowerCase());
}

function extractTypography(
  $: cheerio.CheerioAPI,
  html: string
): WebsiteAnalysis["typography"] {
  const fontMatch = html.match(/font-family:\s*([^;"'}]+)/i);
  const googleFontLink = $('link[href*="fonts.googleapis.com"]').attr("href");
  let font = fontMatch ? fontMatch[1].split(",")[0].trim() : null;

  if (!font && googleFontLink) {
    const familyMatch = googleFontLink.match(/family=([^:&]+)/);
    if (familyMatch) font = decodeURIComponent(familyMatch[1]).replace(/\+/g, " ");
  }

  return { headingFont: font, bodyFont: font };
}

function extractAssets(
  $: cheerio.CheerioAPI,
  baseUrl: string
): WebsiteAnalysis["assets"] {
  const images = $("img")
    .map((_, img) => ({
      src: resolveUrl($(img).attr("src") || "", baseUrl),
      alt: $(img).attr("alt") || null,
    }))
    .get()
    .filter((i) => i.src)
    .slice(0, 15);

  const logoImg = $("header img, nav img, [class*='logo'] img").first();
  const logoSrc = logoImg.length
    ? resolveUrl(logoImg.attr("src") || "", baseUrl)
    : null;

  return { images, logoSrc };
}

function guessColumnCount($: cheerio.CheerioAPI): number {
  let max = 1;
  $("section, main, div").each((_, el) => {
    const children = $(el).children();
    if (children.length >= 2 && children.length <= 6) {
      const tagsMatch = children.toArray().every((c) => c.tagName === children.get(0)?.tagName);
      if (tagsMatch) max = Math.max(max, children.length);
    }
  });
  return Math.min(max, 4);
}

function extractResponsiveNotes(
  $: cheerio.CheerioAPI,
  html: string
): string[] {
  const notes: string[] = [];
  if ($('meta[name="viewport"]').length > 0) {
    notes.push("Has a responsive viewport meta tag.");
  }
  if (/@media/.test(html)) {
    notes.push("Uses CSS media queries — likely responsive.");
  }
  if (notes.length === 0) {
    notes.push("No clear responsive signals found; assume desktop-first.");
  }
  return notes;
}

function resolveUrl(href: string, baseUrl: string): string {
  if (!href) return "";
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}
