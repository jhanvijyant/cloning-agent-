// Structured representation of a website, produced by the fetcher/analyzer
// and consumed by the generator. Kept deliberately flat and small — this is
// what gets sent to the LLM instead of a raw HTML dump.

export type WebsiteAnalysis = {
  url: string;
  metadata: {
    title: string;
    description: string | null;
  };
  navigation: {
    label: string;
    href: string;
  }[];
  sections: Section[];
  typography: {
    headingFont: string | null;
    bodyFont: string | null;
  };
  colors: {
    // Most frequently used colors found in inline styles / <style> blocks,
    // most common first. Best-effort — see README limitations.
    palette: string[];
    primary: string | null;
    background: string | null;
    text: string | null;
  };
  assets: {
    images: { src: string; alt: string | null }[];
    logoSrc: string | null;
  };
  layout: {
    hasHeader: boolean;
    hasFooter: boolean;
    // Rough column count guess for the widest content section, based on
    // sibling counts in the DOM. Not a real layout engine.
    approxColumns: number;
  };
  responsiveNotes: string[];
};

// One visible "block" of the page: hero, feature grid, testimonials,
// pricing, footer, etc. The analyzer guesses a `kind` from heuristics;
// the generator is told these are guesses, not ground truth.
export type Section = {
  id: string;
  kind:
    | "header"
    | "hero"
    | "feature-grid"
    | "text-block"
    | "gallery"
    | "pricing"
    | "testimonials"
    | "cta"
    | "footer"
    | "unknown";
  heading: string | null;
  text: string[];
  buttons: { label: string; href: string | null }[];
  images: string[];
};

export type GeneratedFile = {
  path: string; // relative to the generated project root
  content: string;
};

export type ValidationResult = {
  success: boolean;
  // Raw compiler/build output, trimmed. Only shown to the user as a short
  // summary; full output is logged server-side.
  errorOutput: string | null;
};

export type Job = {
  id: string;
  slug: string;
  sourceUrl: string;
  analysis: WebsiteAnalysis | null;
  generatedFiles: GeneratedFile[];
  previewPort: number | null;
  status: JobStatus;
  statusMessage: string;
  createdAt: number;
};

export type JobStatus =
  | "analyzing"
  | "analyzed"
  | "generating"
  | "checking-build"
  | "fixing"
  | "ready"
  | "modifying"
  | "error";
