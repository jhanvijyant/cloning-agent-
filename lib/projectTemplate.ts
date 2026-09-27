import type { GeneratedFile } from "@/agent/types";

// These files are identical across every generated project. Keeping them
// static (not AI-generated) saves tokens and avoids the model breaking
// config it doesn't need to touch.
export function baseProjectFiles(projectTitle: string): GeneratedFile[] {
  return [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: "generated-site",
          version: "0.1.0",
          private: true,
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
          },
          dependencies: {
            next: "^14.2.5",
            react: "^18.3.1",
            "react-dom": "^18.3.1",
          },
          devDependencies: {
            "@types/node": "^20.14.9",
            "@types/react": "^18.3.3",
            "@types/react-dom": "^18.3.0",
            autoprefixer: "^10.4.19",
            postcss: "^8.4.39",
            tailwindcss: "^3.4.4",
            typescript: "^5.5.3",
          },
        },
        null,
        2
      ),
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2017",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: "esnext",
            moduleResolution: "bundler",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "preserve",
            incremental: true,
          },
          include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
          exclude: ["node_modules"],
        },
        null,
        2
      ),
    },
    {
      path: "next.config.js",
      content: `/** @type {import('next').NextConfig} */
module.exports = {
  images: { unoptimized: true },
};
`,
    },
    {
      path: "tailwind.config.ts",
      content: `import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
`,
    },
    {
      path: "postcss.config.js",
      content: `module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`,
    },
    {
      path: "app/globals.css",
      content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`,
    },
    {
      path: "app/layout.tsx",
      content: `import "./globals.css";

export const metadata = {
  title: "${escapeQuotes(projectTitle)}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
    },
  ];
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}
