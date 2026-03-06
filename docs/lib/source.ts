import { docs } from 'fumadocs-mdx:collections/server';
import { type InferPageType, loader, multiple } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { createOpenAPI, openapiPlugin, openapiSource } from 'fumadocs-openapi/server';
import openapiSpec from '../openapi.json';

export const openapi = createOpenAPI({
  async input() {
    return { api: openapiSpec as Record<string, unknown> };
  },
});

export const source = loader(
  multiple({
    docs: docs.toFumadocsSource(),
    openapi: await openapiSource(openapi, {
      baseDir: 'api-reference',
    }),
  }),
  {
    baseUrl: '/',
    plugins: [lucideIconsPlugin(), openapiPlugin()],
  },
);

export async function getLLMText(page: InferPageType<typeof source>) {
  if ('getText' in page.data && typeof page.data.getText === 'function') {
    const processed = await (page.data as { getText: (mode: string) => Promise<string> }).getText('processed');
    return `# ${page.data.title}\n\n${processed}`;
  }
  return `# ${page.data.title}\n\n${page.data.description ?? ''}`;
}
