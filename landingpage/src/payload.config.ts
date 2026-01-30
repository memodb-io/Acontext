import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import {
  lexicalEditor,
  FixedToolbarFeature,
  InlineToolbarFeature,
  EXPERIMENTAL_TableFeature,
  BlocksFeature,
  CodeBlock,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { CloudflareContext, getCloudflareContext } from '@opennextjs/cloudflare'
import { GetPlatformProxyOptions } from 'wrangler'
import { r2Storage } from '@payloadcms/storage-r2'
import { seoPlugin } from '@payloadcms/plugin-seo'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Posts } from './collections/Posts'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const isCLI = process.argv.some((value) => value.match(/^(generate|migrate):?/))
const isProduction = process.env.NODE_ENV === 'production'

const cloudflare =
  isCLI || !isProduction
    ? await getCloudflareContextFromWrangler()
    : await getCloudflareContext({ async: true })

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Posts],
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      FixedToolbarFeature(),
      InlineToolbarFeature(),
      EXPERIMENTAL_TableFeature(),
      BlocksFeature({
        blocks: [
          CodeBlock({
            defaultLanguage: 'typescript',
            languages: {
              typescript: 'TypeScript',
              javascript: 'JavaScript',
              python: 'Python',
              bash: 'Bash / Shell',
              json: 'JSON',
              yaml: 'YAML',
              markdown: 'Markdown',
              html: 'HTML',
              css: 'CSS',
              sql: 'SQL',
              go: 'Go',
              rust: 'Rust',
              java: 'Java',
              cpp: 'C / C++',
              plaintext: 'Plain Text',
            },
          }),
        ],
      }),
    ],
  }),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteD1Adapter({ binding: cloudflare.env.D1 }),
  plugins: [
    r2Storage({
      bucket: cloudflare.env.R2,
      collections: { media: true },
    }),
    seoPlugin({
      collections: ['posts'],
      uploadsCollection: 'media',
      tabbedUI: true,
      generateTitle: ({ doc }: { doc: Record<string, unknown> }) => `${doc.title as string}`,
      generateDescription: ({ doc }: { doc: Record<string, unknown> }) =>
        (doc.excerpt as string) || '',
      fields: ({ defaultFields }) => [
        ...defaultFields,
        {
          name: 'faq',
          label: 'FAQ Schema',
          type: 'array',
          admin: {
            description:
              'Add FAQ items for structured data (FAQPage schema). These will be rendered as JSON-LD for search engines.',
          },
          fields: [
            {
              name: 'question',
              type: 'text',
              required: true,
              admin: {
                description: 'The question text',
              },
            },
            {
              name: 'answer',
              type: 'textarea',
              required: true,
              admin: {
                description: 'The answer text (plain text, no HTML)',
              },
            },
          ],
        },
      ],
    }),
  ],
})

// Adapted from https://github.com/opennextjs/opennextjs-cloudflare/blob/d00b3a13e42e65aad76fba41774815726422cc39/packages/cloudflare/src/api/cloudflare-context.ts#L328C36-L328C46
function getCloudflareContextFromWrangler(): Promise<CloudflareContext> {
  return import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`).then(
    ({ getPlatformProxy }) =>
      getPlatformProxy({
        environment: process.env.CLOUDFLARE_ENV,
        remoteBindings: isProduction,
      } satisfies GetPlatformProxyOptions),
  )
}
