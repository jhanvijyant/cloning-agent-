// Fetches a public URL's HTML. Deliberately simple: no headless browser.
// This means JS-rendered SPAs will analyze poorly — documented in the
// README as a known limitation rather than solved with a heavier dependency.

export class FetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchError";
  }
}

export async function fetchWebsite(url: string): Promise<{ html: string; finalUrl: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new FetchError("That doesn't look like a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new FetchError("Only http/https URLs are supported.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // A normal browser UA — some sites block default fetch/bot UAs.
        "User-Agent":
          "Mozilla/5.0 (compatible; WebsiteCloningAgent/0.1; +local-mvp)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      throw new FetchError(`Site responded with ${res.status} ${res.statusText}.`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      throw new FetchError(`Expected an HTML page, got "${contentType || "unknown content type"}".`);
    }

    const html = await res.text();
    if (!html || html.trim().length === 0) {
      throw new FetchError("The page returned no content.");
    }

    return { html, finalUrl: res.url };
  } catch (err) {
    if (err instanceof FetchError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new FetchError("The site took too long to respond (timed out after 10s).");
    }
    throw new FetchError(
      `Could not reach that site: ${err instanceof Error ? err.message : "unknown network error"}.`
    );
  } finally {
    clearTimeout(timeout);
  }
}
