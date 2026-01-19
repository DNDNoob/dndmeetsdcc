import * as functions from 'firebase-functions';

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export const freesoundSearch = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only allow GET
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const query = req.query.q || req.query.query || '';
  const pageSize = req.query.page_size || '60';

  if (!query) {
    res.status(400).json({ error: 'Query parameter "q" is required' });
    return;
  }

  // Check cache
  const cacheKey = `${query}-${pageSize}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    functions.logger.info(`Cache hit for query: ${query}`);
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(cached.data);
    return;
  }

  // Get API key from environment
  const apiKey = functions.config().freesound?.apikey;

  if (!apiKey) {
    functions.logger.error('Freesound API key not configured');
    res.status(500).json({ error: 'API key not configured' });
    return;
  }

  try {
    const freesoundUrl = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query as string)}&fields=id,name,previews,tags&page_size=${pageSize}&token=${apiKey}`;

    functions.logger.info(`Fetching from Freesound API for query: ${query}`);

    const response = await fetch(freesoundUrl);

    if (!response.ok) {
      const errorText = await response.text();
      functions.logger.error(`Freesound API error (${response.status}):`, errorText);

      res.status(response.status).json({
        error: 'Freesound API error',
        details: errorText,
        status: response.status
      });
      return;
    }

    const data = await response.json();

    // Transform data
    const results = {
      results: (data.results || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        url: r.previews ? (
          r.previews['preview-hq-mp3'] ||
          r.previews['preview-lq-mp3'] ||
          r.previews['preview-hq-ogg'] ||
          r.previews['preview-lq-ogg']
        ) : '',
        tags: r.tags || [],
        source: 'freesound'
      })).filter((s: any) => s.url),
      count: data.count || 0,
      source: 'freesound-proxy'
    };

    // Cache the results
    cache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }

    functions.logger.info(`Successfully fetched ${results.results.length} results for query: ${query}`);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json(results);
  } catch (error) {
    functions.logger.error('Error:', error);
    res.status(500).json({
      error: 'Failed to search Freesound',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
