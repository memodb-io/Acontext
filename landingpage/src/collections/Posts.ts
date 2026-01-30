import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'date', 'slug'],
    livePreview: {
      url: ({ data }) =>
        `${process.env.NEXT_PUBLIC_SERVER_URL || 'https://acontext.io'}/blog/${data.slug}`,
    },
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'slug',
                  type: 'text',
                  required: true,
                  unique: true,
                  index: true,
                  admin: {
                    width: '50%',
                    components: {
                      Field: '@/components/payload/SlugField#SlugField',
                    },
                  },
                },
                {
                  name: 'date',
                  type: 'date',
                  required: true,
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'dayOnly',
                      displayFormat: 'yyyy-MM-dd',
                    },
                  },
                },
              ],
            },
            {
              name: 'category',
              type: 'select',
              required: true,
              defaultValue: 'article',
              options: [
                { label: 'Article', value: 'article' },
                { label: 'Tutorial', value: 'tutorial' },
                { label: 'Customer Story', value: 'customer-story' },
                { label: 'Announcement', value: 'announcement' },
                { label: 'Release Notes', value: 'release-notes' },
              ],
            },
            {
              name: 'excerpt',
              type: 'textarea',
              required: true,
              admin: {
                description: 'A short description for the blog card and SEO (1-2 sentences)',
              },
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              required: false,
              admin: {
                description: 'Optional cover image for the post',
              },
            },
            {
              name: 'content',
              type: 'richText',
              required: true,
            },
          ],
        },
        // SEO tab is added by @payloadcms/plugin-seo
      ],
    },
  ],
}
