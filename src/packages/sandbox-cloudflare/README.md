# @acontext/sandbox-cloudflare

Create a new [Acontext Cloudflare Sandbox Worker](https://github.com/memodb-io/Acontext) project with one command.

## Usage

```bash
npx @acontext/sandbox-cloudflare@latest my-app
```

Or using `npm create`:

```bash
npm create @acontext/sandbox-cloudflare@latest my-app
```

Or with the `--yes` flag to skip prompts:

```bash
npx @acontext/sandbox-cloudflare@latest my-app --yes
```

## Options

- `--yes`, `-y`: Skip prompts and use defaults
- `--skip-install`, `--no-install`: Skip installing dependencies after creating the project

## What it creates

This will create a new directory with:

- ✅ Cloudflare Worker setup with TypeScript
- ✅ Cloudflare Sandbox SDK integration
- ✅ Pre-configured Wrangler configuration
- ✅ Dockerfile for sandbox containers
- ✅ All necessary dependencies

## Next steps

After creating your project:

```bash
cd my-app
pnpm run dev  # or npm run dev / yarn dev
```

## Learn more

- [Acontext Documentation](https://github.com/memodb-io/Acontext)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Sandbox SDK](https://developers.cloudflare.com/sandbox/)
