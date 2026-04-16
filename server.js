const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use('/kartor', express.static(path.join(__dirname, 'public/kartor')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.send('Taktikspel server körs!');
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
