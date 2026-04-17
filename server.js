
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const EDITOR_PASSWORD = process.env.EDITOR_PASSWORD || 'Gamer1337';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'NordstedtSweden/taktikspel';
const GITHUB_BRANCH = 'main';

async function sparaTillGitHub(filsökväg, base64data, meddelande) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filsökväg}`;
  
  // Kolla om filen redan finns (för att få SHA)
  let sha = null;
  try {
    const check = await fetch(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (check.ok) {
      const existing = await check.json();
      sha = existing.sha;
    }
  } catch(e) {}

  // Spara filen
  const body = {
    message: meddelande || 'Uppladdad från editor',
    content: base64data,
    branch: GITHUB_BRANCH
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  return res.ok;
}

app.use(express.json({ limit: '50mb' }));
app.use('/kartor', express.static(path.join(__dirname, 'public/kartor')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use(express.static(path.join(__dirname, 'public')));

// Kontrollera lösenord
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === EDITOR_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Fel lösenord' });
  }
});

// Spara spelpaket
app.post('/api/spara-paket', async (req, res) => {
  const { password, filnamn, data } = req.body;
  if (password !== EDITOR_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Ej behörig' });
  }
  try {
    const base64 = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const ok = await sparaTillGitHub(`public/paket/${filnamn}`, base64, 'Nytt spelpaket: ' + filnamn);
    res.json({ ok });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Lista tillgängliga spelpaket
app.get('/api/paket', async (req, res) => {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/public/paket`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!response.ok) return res.json({ paket: [] });
    const filer = await response.json();
    const paket = filer
      .filter(f => f.name.endsWith('.json'))
      .map(f => f.name);
    res.json({ paket });
  } catch(e) {
    res.json({ paket: [] });
  }
});

// Spara kartbild
app.post('/api/spara-karta', async (req, res) => {
  const { password, filnamn, data } = req.body;
  if (password !== EDITOR_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Ej behörig' });
  }
  try {
    const base64 = data.replace(/^data:image\/\w+;base64,/, '');
    const ok = await sparaTillGitHub(`public/kartor/${filnamn}`, base64, 'Ny kartbild: ' + filnamn);
    res.json({ ok });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Spara enhetsikon
app.post('/api/spara-ikon', async (req, res) => {
  const { password, filnamn, data } = req.body;
  if (password !== EDITOR_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Ej behörig' });
  }
  try {
    const base64 = data.replace(/^data:image\/\w+;base64,/, '');
    const ok = await sparaTillGitHub(`public/assets/units/${filnamn}`, base64, 'Ny enhetsikon: ' + filnamn);
    res.json({ ok });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const spel = {};

io.on('connection', socket => {
  socket.on('gå-med', ({ kod, roll }) => {
    socket.join(kod);
    socket.data.kod = kod;
    socket.data.roll = roll;
    if (!spel[kod]) spel[kod] = {};
    console.log(`${roll} anslöt till spel ${kod}`);
    io.to(kod).emit('ansluten', { roll, kod });
  });

  socket.on('state', data => {
    socket.to(data.kod).emit('state', data);
  });

  socket.on('disconnect', () => {
    console.log('Frånkopplad:', socket.data.roll);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server igång på port', PORT);
});
