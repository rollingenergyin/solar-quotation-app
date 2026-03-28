import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : 'https://solar-quotation-app-backend.onrender.com');

export async function GET(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(request, params.path);
}

export async function POST(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(request, params.path);
}

export async function PUT(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(request, params.path);
}

export async function PATCH(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(request, params.path);
}

export async function DELETE(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(request, params.path);
}

async function proxy(request: NextRequest, pathSegments?: string[]) {
  const path = pathSegments?.length ? pathSegments.join('/') : '';
  const url = new URL(`/api/${path}`, BACKEND_URL);
  url.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');

  let body: BodyInit | null = null;
  const contentType = request.headers.get('content-type');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // Forward raw body for multipart (file uploads) to preserve form data
    if (contentType?.includes('multipart/form-data')) {
      body = await request.arrayBuffer();
    } else {
      body = await request.text();
    }
  }

  try {
    const res = await fetch(url.toString(), {
      method: request.method,
      headers,
      body,
    });

    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    const ct = res.headers.get('content-type') || 'application/json';
    // PDF and other binary bodies must not go through .text() (encoding corruption).
    if (
      ct.includes('application/pdf') ||
      ct.startsWith('image/') ||
      (ct.includes('application/octet-stream') && !ct.includes('json'))
    ) {
      const buf = await res.arrayBuffer();
      const out = new Headers();
      out.set('content-type', ct);
      const cd = res.headers.get('content-disposition');
      if (cd) out.set('content-disposition', cd);
      return new NextResponse(buf, {
        status: res.status,
        statusText: res.statusText,
        headers: out,
      });
    }
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      statusText: res.statusText,
      headers: {
        'content-type': ct,
      },
    });
  } catch (err) {
    console.error('API proxy error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Backend unreachable' },
      { status: 502 }
    );
  }
}
