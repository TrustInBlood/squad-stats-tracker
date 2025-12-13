const http = require('http');
const url = require('url');
const { getPlayerStats } = require('./stats');
const logger = require('../utils/logger');

function createApiServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    if (req.method === 'GET' && pathname === '/stats') {
      const steamId = parsedUrl.query.steamid;

      if (!steamId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing steamid query parameter' }));
        return;
      }

      try {
        const stats = await getPlayerStats(steamId);

        if (!stats) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'No player found with that Steam ID' }));
          return;
        }

        res.statusCode = 200;
        res.end(JSON.stringify(stats));
      } catch (error) {
        logger.error(`API error: ${error.message}`);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return server;
}

function startApiServer() {
  const port = process.env.HTTP_PORT || 3000;
  const server = createApiServer();

  server.listen(port, () => {
    logger.info(`API server listening on port ${port}`);
  });

  return server;
}

module.exports = { createApiServer, startApiServer };
