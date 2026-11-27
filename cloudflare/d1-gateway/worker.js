export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname.startsWith('/images/')) {
      const key = url.pathname.slice('/images/'.length);
      if (!key || key.includes('..')) return new Response('Not found', { status: 404 });
      let object = await env.IMAGES.get(key);
      if (!object && /^product_images\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp)$/.test(key)) {
        // Existing catalogue images are public in this repository. Import
        // each one to R2 on first view, then serve later requests from R2.
        const source = await fetch(
          `https://raw.githubusercontent.com/mdrafiullah1830/nexusplay/main/${key}`,
        );
        if (source.ok && (source.headers.get('Content-Type') || '').startsWith('image/')) {
          const bytes = await source.arrayBuffer();
          if (bytes.byteLength <= 5_000_000) {
            const contentType = source.headers.get('Content-Type');
            await env.IMAGES.put(key, bytes, { httpMetadata: { contentType } });
            object = await env.IMAGES.get(key);
          }
        }
      }
      if (!object) return new Response('Not found', { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('Cache-Control', 'public, max-age=86400');
      headers.set('ETag', object.httpEtag);
      return new Response(object.body, { headers });
    }
    if (!env.GATEWAY_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.GATEWAY_TOKEN}`)
      return new Response('Unauthorized', { status: 401 });
    if (request.method === 'PUT' && url.pathname.startsWith('/images/')) {
      const key = url.pathname.slice('/images/'.length);
      const type = request.headers.get('Content-Type') || '';
      if (!key || key.includes('..') || !['image/jpeg', 'image/png', 'image/webp'].includes(type))
        return new Response('Invalid image', { status: 400 });
      if (Number(request.headers.get('Content-Length') || 0) > 5_000_000)
        return new Response('Image too large', { status: 413 });
      await env.IMAGES.put(key, request.body, { httpMetadata: { contentType: type } });
      return Response.json({ url: `${url.origin}/images/${key}` });
    }
    if (request.method !== 'POST' || url.pathname !== '/query')
      return new Response('Not found', { status: 404 });
    if (Number(request.headers.get('Content-Length') || 0) > 131072) {
      return new Response('Request too large', { status: 413 });
    }
    try {
      const { sql, params = [] } = await request.json();
      if (typeof sql !== 'string' || !Array.isArray(params) || sql.length > 8192 || params.length > 100) {
        return new Response('Invalid query', { status: 400 });
      }
      const result = await env.DB.prepare(sql).bind(...params).all();
      return Response.json(result);
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 500 });
    }
  },
};
