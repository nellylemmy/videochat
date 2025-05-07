const express = require('express');
const http = require('http');
const nodemailer = require('nodemailer');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const { authenticate, requireRole } = require('./middlewares/authMiddleware');
const authRoutes = require('./routes/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// In-memory dummy data
const students = [
  { id: 's1', name: 'Lemayian K.', email: 'lemayian@example.com' },
  { id: 's2', name: 'Nashipae T.', email: 'nashipae@example.com' },
  { id: 's3', name: 'Saitoti M.', email: 'saitoti@example.com' },
];
const volunteers = [
  { id: 'v1', name: 'Volunteer One', email: 'volunteer@example.com' }
];

// Mailhog SMTP setup
const transporter = nodemailer.createTransport({
  host: '127.0.0.1',
  port: 1025,
  secure: false,
  tls: { rejectUnauthorized: false },
});

app.get('/students', authenticate, (req, res) => {
  res.json(students);
});

app.get('/meetings/:studentId', authenticate, requireRole('student'), async (req, res) => {
  const { studentId } = req.params;

  try {
    const result = await pool.query(`
      SELECT * FROM video_meetings
      WHERE student_id = $1
      ORDER BY created_at DESC
    `, [studentId]);

    const upcoming = result.rows.filter(m => m.status === 'upcoming');
    const completed = result.rows.filter(m => m.status === 'completed');

    res.json({ upcoming, completed });
  } catch (err) {
    console.error('Error fetching meetings:', err);
    res.status(500).json({ error: 'Failed to load meetings' });
  }
});



app.post('/invite', authenticate, requireRole('volunteer'), async (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'Missing name or email' });

  const roomId = uuidv4();
  const joinLink = `http://62.72.3.138/join/${roomId}`;


  const mailOptions = {
    from: 'talktime@example.org',
    to: email,
    subject: 'You’ve been invited to a TalkTime call!',
    html: `
      <p>Hello ${name},</p>
      <p>You’ve been invited to an English exchange call on TalkTime.</p>
      <p><a href="${joinLink}">Click here to join the meeting</a></p>
    `,
  };

    // Save meeting in DB
    await pool.query(
      `INSERT INTO video_meetings (id, room_id, student_id, volunteer_id)
       VALUES ($1, $2, $3, $4)`,
      [uuidv4(), roomId, students.id, volunteers.id]
    );
  

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✉️ Sent invite to ${email} for room ${roomId}`);
    res.json({ success: true, roomId });
  } catch (err) {
    console.error('Mail error:', err);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});


// WebRTC signaling logic
const rooms = {};
io.on('connection', (socket) => {
  console.log(`🟢 Socket connected: ${socket.id}`);

  socket.on('join-room', ({ roomId }) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push(socket.id);
    console.log(`➡️ ${socket.id} joined room '${roomId}'`);

    const others = rooms[roomId].filter(id => id !== socket.id);
    socket.emit('all-users', others);
    socket.join(roomId);

    socket.on('offer', ({ target, sdp }) => {
      io.to(target).emit('offer', { sdp, caller: socket.id });
    });

    socket.on('answer', ({ target, sdp }) => {
      io.to(target).emit('answer', { sdp });
    });

    socket.on('ice-candidate', ({ target, candidate }) => {
      io.to(target).emit('ice-candidate', { candidate });
    });

    socket.on('disconnect', () => {
      for (const room in rooms) {
        rooms[room] = rooms[room].filter(id => id !== socket.id);
        if (rooms[room].length === 0) delete rooms[room];
      }
    });
  });
});

server.listen(4000, () => console.log('🚀 TalkTime backend running on port 4000'));