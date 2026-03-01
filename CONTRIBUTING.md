# Contributing to Cloak

Thanks for your interest in contributing to Cloak! This guide will help you get set up and submit your first pull request.

## Development Setup

### Prerequisites

- **Node.js 20+**
- **pnpm 10+** — `corepack enable` to install
- **poppler-utils** — Required for PDF rendering
  - macOS: `brew install poppler`
  - Ubuntu/Debian: `apt install poppler-utils`
  - Windows: Install from [poppler releases](https://github.com/oschwartz10612/poppler-windows/releases)
- **LibreOffice** *(optional)* — Required for office document conversion (DOCX, PPTX, XLSX to PDF)
  - macOS: `brew install --cask libreoffice`
  - Ubuntu/Debian: `apt install libreoffice-core`
- **ffmpeg** *(optional)* — Required for video support (HLS transcoding)
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `apt install ffmpeg`

### Getting Started

```bash
# Clone the repo
git clone https://github.com/cloakshare/cloakshare.git
cd cloakshare

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

This starts:
- **API server** at `http://localhost:3000`
- **Web dashboard** at `http://localhost:5173`
- **Marketing site** at `http://localhost:4321`

### Project Structure

```
cloak/
├── apps/
│   ├── api/        # Hono API server
│   ├── web/        # React dashboard (Vite + React Router)
│   ├── viewer/     # Secure document & video viewer
│   └── site/       # Astro marketing site
├── packages/
│   ├── shared/     # Shared TypeScript types & constants
│   └── sdk-node/   # Node.js SDK
├── docker-compose.yml
├── pnpm-workspace.yaml
└── turbo.json
```

### Key Technologies

- **API**: [Hono](https://hono.dev) + [Drizzle ORM](https://orm.drizzle.team) + SQLite/Turso
- **Web**: React 19 + Vite + Tailwind CSS
- **Site**: Astro + Tailwind CSS
- **Monorepo**: pnpm workspaces + Turborepo
- **PDF rendering**: Sharp + poppler-utils (pdftoppm)
- **Office conversion**: LibreOffice (headless)
- **Video**: FFmpeg (HLS transcoding)
- **Viewer**: Vanilla TS + HLS.js

## Making Changes

### Branching

Create a branch from `main`:

```bash
git checkout -b feat/your-feature
# or
git checkout -b fix/your-bug-fix
```

### Coding Standards

- **TypeScript** — All code is written in TypeScript. Avoid `any`.
- **ESM** — All packages use ES modules (`"type": "module"`).
- **Formatting** — Follow the existing code style in each file.
- **Naming** — Use camelCase for variables/functions, PascalCase for types/components.
- **Imports** — Use `.js` extensions for local imports in the API (ESM requirement for Node.js).

### Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific app
pnpm test --filter=@cloak/api

# Type-check everything
pnpm lint
```

### Building

```bash
# Build all packages
pnpm build

# Build a specific app
pnpm build --filter=@cloak/api
```

## Submitting a Pull Request

1. **Fork** the repository and create your branch from `main`.
2. **Make your changes** — keep them focused. One PR per feature or fix.
3. **Test** — run `pnpm test` and `pnpm lint` to ensure nothing is broken.
4. **Build** — run `pnpm build` to verify the project compiles.
5. **Write a clear PR description** — explain what changed and why.

### PR Title Convention

Use conventional commit style:

- `feat: add email domain allowlist`
- `fix: correct watermark positioning on landscape PDFs`
- `docs: update self-hosting guide`
- `refactor: simplify storage abstraction`

### What We Look For

- Does the code follow existing patterns?
- Are there any TypeScript errors?
- Is the change well-scoped (not too broad)?
- Does it include tests where appropriate?

## Reporting Issues

- Use [GitHub Issues](https://github.com/cloakshare/cloakshare/issues) to report bugs or request features.
- Include reproduction steps, expected vs actual behavior, and your environment (OS, Node version).
- Check existing issues before opening a new one.

## License

By contributing to Cloak, you agree that your contributions will be licensed under the [MIT License](LICENSE).
