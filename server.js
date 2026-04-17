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
app.post('/api/spara-paket', (req, res) => {
  const { password, filnamn, data } = req.body;
  if (password !== EDITOR_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Ej behörig' });
  }
  const dir = path.join(__dirname, 'public/paket');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fil = path.join(dir, filnamn.replace(/[^a-zA-Z0-9_\-\.]/g, '_'));
  fs.writeFileSync(fil, JSON.stringify(data, null, 2));
  res.json({ ok: true, filnamn });
});

// Lista tillgängliga spelpaket
app.get('/api/paket', (req, res) => {
  const dir = path.join(__dirname, 'public/paket');
  if (!fs.existsSync(dir)) return res.json({ paket: [] });
  const filer = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  res.json({ paket: filer });
});

// Spara kartbild
app.post('/api/spara-karta', (req, res) => {
  const { password, filnamn, data } = req.body;
  if (password !== EDITOR_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Ej behörig' });
  }
  const dir = path.join(__dirname, 'public/kartor');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fil = path.join(dir, filnamn.replace(/[^a-zA-Z0-9_\-\.]/g, '_'));
  const base64 = data.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(fil, Buffer.from(base64, 'base64'));
  res.json({ ok: true, filnamn });
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
