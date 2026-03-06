import { source } from '@/lib/source';
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const revalidate = false;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const page = source.getPage(slug);

  const title = page?.data.title ?? 'Acontext Docs';
  const description = page?.data.description ?? 'Agent memory stack for production AI Agents';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '60px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          fontFamily: 'sans-serif',
          color: '#f8fafc',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: '#94a3b8',
              letterSpacing: '-0.02em',
            }}
          >
            Acontext Docs
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              marginBottom: '20px',
              color: '#f1f5f9',
            }}
          >
            {title}
          </div>
          {description && (
            <div
              style={{
                fontSize: 24,
                lineHeight: 1.5,
                color: '#94a3b8',
                maxWidth: '80%',
              }}
            >
              {description}
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #334155',
            paddingTop: '24px',
          }}
        >
          <div style={{ fontSize: 18, color: '#64748b' }}>
            docs.acontext.io
          </div>
          <div style={{ fontSize: 18, color: '#64748b' }}>
            Agent Memory Stack
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
