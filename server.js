const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

// Load .env* before reading PORT / NODE_ENV (custom server does not auto-load them).
// Resolve via next so pnpm's strict node_modules layout still finds @next/env.
const { loadEnvConfig } = require(
  require.resolve('@next/env', { paths: [require.resolve('next/package.json')] })
);
loadEnvConfig(process.cwd());

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Global live state
global._liveState = {
  activeQuizId: null,
  activeQuizTitle: null,
  timeLimitSeconds: null,
  currentQuestion: null,
  showResults: false,
  resultStats: null,
  fastestAnswers: [],
  allTeams: [],       // [{ id, name }] non-banned active teams
  submittedTeamIds: [], // teamIds that answered current question
};

// Map teamId → Set of socket IDs (for targeted messages)
global._teamSockets = {};
// Map questionId → setTimeout handle (for auto-submit timers)
global._questionTimers = {};

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
  });

  global._io = io;

  io.on('connection', (socket) => {
    // Send current live state to new connection
    socket.emit('state:sync', global._liveState);

    // Team clients identify themselves so we can route messages
    socket.on('team:join', ({ teamId, teamName }) => {
      if (!teamId) return;
      socket.teamId = teamId;
      socket.teamName = teamName;
      socket.join(`team-${teamId}`);

      if (!global._teamSockets[teamId]) global._teamSockets[teamId] = new Set();
      global._teamSockets[teamId].add(socket.id);
    });

    socket.on('disconnect', () => {
      if (socket.teamId && global._teamSockets[socket.teamId]) {
        global._teamSockets[socket.teamId].delete(socket.id);
        if (global._teamSockets[socket.teamId].size === 0) {
          delete global._teamSockets[socket.teamId];
        }
      }
    });
  });

  httpServer
    .once('error', (err) => { console.error(err); process.exit(1); })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
