const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ---------- Room Management ----------
const rooms = new Map(); // roomId -> Room

function generateRoomId() {
  let id;
  do {
    id = crypto.randomInt(100000, 1000000).toString();
  } while (rooms.has(id));
  return id;
}

function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

function broadcast(room, message, excludeWs = null) {
  const payload = JSON.stringify(message);
  const sendTo = (ws) => {
    if (ws.readyState === ws.OPEN && ws !== excludeWs) {
      ws.send(payload);
    }
  };
  if (room.teacher) sendTo(room.teacher);
  for (const ws of room.students.keys()) sendTo(ws);
}

function send(ws, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function studentCount(room) {
  return room.students.size;
}

function broadcastStudentCount(room) {
  broadcast(room, { type: 'student_count', count: studentCount(room) });
}

// ---------- WebSocket Connection Handler ----------
wss.on('connection', (ws) => {
  ws.roomId = null;
  ws.role = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { type: 'error', message: 'Invalid message format' });
    }

    switch (msg.type) {
      case 'create_room':
        handleCreateRoom(ws);
        break;
      case 'join':
        handleJoin(ws, msg);
        break;
      case 'post_question':
        handlePostQuestion(ws, msg);
        break;
      case 'submit_answer':
        handleSubmitAnswer(ws, msg);
        break;
      case 'end_question':
        handleEndQuestion(ws, msg);
        break;
      default:
        send(ws, { type: 'error', message: 'Unknown message type' });
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });
});

// ---------- Message Handlers ----------
function handleCreateRoom(ws) {
  const roomId = generateRoomId();
  const room = {
    roomId,
    teacher: ws,
    students: new Map(),
    currentQuestion: null,
    answers: [],
  };
  rooms.set(roomId, room);
  ws.roomId = roomId;
  ws.role = 'teacher';
  send(ws, { type: 'room_created', room: roomId });
}

function handleJoin(ws, msg) {
  const { room: roomId, role, name } = msg;
  const room = getRoom(roomId);
  if (!room) {
    return send(ws, { type: 'error', message: 'Classroom code not found, please check and try again' });
  }
  ws.roomId = roomId;

  if (role === 'teacher') {
    ws.role = 'teacher';
    room.teacher = ws;
  } else {
    ws.role = 'student';
    room.students.set(ws, { name: name || 'Anonymous' });
  }

  send(ws, {
    type: 'joined',
    room: roomId,
    question: room.currentQuestion,
    answers: room.answers,
  });
  broadcastStudentCount(room);
}

function handlePostQuestion(ws, msg) {
  if (ws.role !== 'teacher') return;
  const room = getRoom(ws.roomId);
  if (!room) return;
  const question = (msg.question || '').trim();
  if (!question) {
    return send(ws, { type: 'error', message: 'Question cannot be empty' });
  }
  room.currentQuestion = question;
  room.answers = [];
  broadcast(room, {
    type: 'question_posted',
    question,
    timestamp: Date.now(),
  });
}

function handleSubmitAnswer(ws, msg) {
  if (ws.role !== 'student') return;
  const room = getRoom(ws.roomId);
  if (!room) return;
  if (!room.currentQuestion) {
    return send(ws, { type: 'error', message: 'No active question right now' });
  }
  const answer = (msg.answer || '').trim();
  if (!answer) {
    return send(ws, { type: 'error', message: 'Answer cannot be empty' });
  }
  const student = room.students.get(ws) || { name: 'Anonymous' };
  const entry = {
    id: crypto.randomBytes(8).toString('hex'),
    answer,
    studentName: student.name,
    timestamp: Date.now(),
  };
  room.answers.push(entry);
  broadcast(room, { type: 'answer_received', ...entry });
}

function handleEndQuestion(ws, msg) {
  if (ws.role !== 'teacher') return;
  const room = getRoom(ws.roomId);
  if (!room) return;
  room.currentQuestion = null;
  broadcast(room, { type: 'question_ended' });
}

function handleDisconnect(ws) {
  const room = getRoom(ws.roomId);
  if (!room) return;

  if (ws.role === 'teacher') {
    room.teacher = null;
    broadcast(room, { type: 'teacher_left' });
  } else if (ws.role === 'student') {
    room.students.delete(ws);
    broadcastStudentCount(room);
  }
  // Room state is kept in memory so the teacher can reconnect.
  // Rooms are only cleared on server restart, which prevents accidental
  // deletion during the brief disconnect caused by page navigation.
}

server.listen(PORT, () => {
  console.log(`Live QA server running: http://localhost:${PORT}`);
});
