/* ============================================
   Live Classroom Q&A — Frontend Logic
   ============================================ */
const LiveQA = (function () {
  'use strict';

  // ---------- Utilities ----------
  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function toast(message, type) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.className = 'toast show ' + (type || '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.className = 'toast ' + (type || '');
    }, 2800);
  }

  function connectWS() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return new WebSocket(`${proto}://${window.location.host}/ws`);
  }

  function initialOf(name) {
    return (name || 'A').trim().charAt(0).toUpperCase() || 'A';
  }

  function makeAnswerCard(a) {
    const card = document.createElement('div');
    card.className = 'answer-card';
    card.style.animationDelay = (Math.random() * 0.12).toFixed(3) + 's';
    card.innerHTML =
      '<div class="student"><span class="avatar">' + escapeHtml(initialOf(a.studentName)) +
      '</span>' + escapeHtml(a.studentName || 'Anonymous') + '</div>' +
      '<div class="text">' + escapeHtml(a.answer) + '</div>';
    return card;
  }

  // ---------- Entry Page ----------
  function initEntry() {
    const createBtn = document.getElementById('createRoomBtn');
    const joinBtn = document.getElementById('joinRoomBtn');
    const roomInput = document.getElementById('roomCodeInput');
    const nameInput = document.getElementById('studentNameInput');

    createBtn.addEventListener('click', () => {
      const ws = connectWS();
      ws.onopen = () => ws.send(JSON.stringify({ type: 'create_room' }));
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'room_created') {
          window.location.href = '/teacher.html?room=' + msg.room;
        } else if (msg.type === 'error') {
          toast(msg.message, 'error');
        }
      };
      ws.onerror = () => toast('Connection failed, please try again', 'error');
    });

    joinBtn.addEventListener('click', () => {
      const room = roomInput.value.trim();
      if (!/^\d{6}$/.test(room)) {
        toast('Please enter a 6-digit classroom code', 'error');
        return;
      }
      const name = encodeURIComponent(nameInput.value.trim());
      window.location.href = '/student.html?room=' + room + '&name=' + name;
    });

    roomInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') joinBtn.click();
    });
  }

  // ---------- Teacher Dashboard ----------
  function initTeacher() {
    const room = getQueryParam('room');
    if (!room) {
      window.location.href = '/';
      return;
    }

    document.getElementById('roomCodeDisplay').textContent = room;
    document.getElementById('statRoomCode').textContent = room;

    const ws = connectWS();

    const questionInput = document.getElementById('questionInput');
    const postBtn = document.getElementById('postQuestionBtn');
    const endBtn = document.getElementById('endQuestionBtn');
    const activeBar = document.getElementById('activeQuestionBar');
    const activeText = document.getElementById('activeQuestionText');
    const answersWall = document.getElementById('answersWall');
    const emptyState = document.getElementById('emptyState');
    const answerCount = document.getElementById('answerCount');
    const statAnswered = document.getElementById('statAnswered');
    const statStudents = document.getElementById('statStudents');
    const studentCountEl = document.getElementById('studentCount');

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', role: 'teacher', room: room }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'joined':
          if (msg.question) {
            showActiveQuestion(msg.question);
            msg.answers.forEach((a) => answersWall.appendChild(makeAnswerCard(a)));
            updateCount();
          }
          break;
        case 'question_posted':
          showActiveQuestion(msg.question);
          answersWall.innerHTML = '';
          answersWall.appendChild(emptyState);
          updateCount();
          toast('Question posted', 'success');
          break;
        case 'answer_received':
          if (emptyState.parentNode) emptyState.remove();
          answersWall.insertBefore(makeAnswerCard(msg), answersWall.firstChild);
          updateCount();
          break;
        case 'question_ended':
          hideActiveQuestion();
          toast('Current question ended', 'success');
          break;
        case 'student_count':
          statStudents.textContent = msg.count;
          studentCountEl.textContent = msg.count;
          break;
        case 'teacher_left':
          toast('Teacher connection lost, reconnecting…', 'error');
          break;
        case 'error':
          toast(msg.message, 'error');
          break;
      }
    };

    ws.onclose = () => toast('Connection lost, please refresh the page', 'error');
    ws.onerror = () => toast('Connection error', 'error');

    postBtn.addEventListener('click', () => {
      const q = questionInput.value.trim();
      if (!q) {
        toast('Please enter a question', 'error');
        return;
      }
      ws.send(JSON.stringify({ type: 'post_question', room: room, question: q }));
      questionInput.value = '';
    });

    endBtn.addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'end_question', room: room }));
    });

    questionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postBtn.click();
    });

    function showActiveQuestion(q) {
      activeText.textContent = q;
      activeBar.style.display = '';
      postBtn.textContent = 'Post New Question';
      endBtn.style.display = '';
    }

    function hideActiveQuestion() {
      activeBar.style.display = 'none';
      postBtn.textContent = 'Post Question';
      endBtn.style.display = 'none';
    }

    function updateCount() {
      const n = answersWall.querySelectorAll('.answer-card').length;
      answerCount.textContent = n;
      statAnswered.textContent = n;
    }
  }

  // ---------- Student View ----------
  function initStudent() {
    const room = getQueryParam('room');
    const rawName = getQueryParam('name') || '';
    const name = decodeURIComponent(rawName);

    if (!room) {
      window.location.href = '/';
      return;
    }

    document.getElementById('roomCodeDisplay').textContent = room;

    const ws = connectWS();
    const waitingState = document.getElementById('waitingState');
    const questionArea = document.getElementById('questionArea');
    const questionText = document.getElementById('questionText');
    const answerInput = document.getElementById('answerInput');
    const submitBtn = document.getElementById('submitAnswerBtn');
    const answersWall = document.getElementById('answersWall');
    const answerCount = document.getElementById('answerCount');

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', role: 'student', room: room, name: name || 'Anonymous' }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'joined':
          if (msg.question) {
            showQuestion(msg.question);
            msg.answers.forEach((a) => answersWall.appendChild(makeAnswerCard(a)));
            updateCount();
          }
          break;
        case 'question_posted':
          showQuestion(msg.question);
          answersWall.innerHTML = '';
          updateCount();
          toast('New question received!', 'success');
          break;
        case 'answer_received':
          answersWall.insertBefore(makeAnswerCard(msg), answersWall.firstChild);
          updateCount();
          break;
        case 'question_ended':
          hideQuestion();
          toast('Question ended', '');
          break;
        case 'error':
          toast(msg.message, 'error');
          break;
      }
    };

    ws.onclose = () => toast('Connection lost, please refresh the page', 'error');
    ws.onerror = () => toast('Connection error', 'error');

    submitBtn.addEventListener('click', submitAnswer);
    answerInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitAnswer();
    });

    function submitAnswer() {
      const text = answerInput.value.trim();
      if (!text) {
        toast('Please enter an answer', 'error');
        return;
      }
      ws.send(JSON.stringify({ type: 'submit_answer', room: room, answer: text, studentName: name || 'Anonymous' }));
      answerInput.value = '';
      toast('Answer submitted', 'success');
    }

    function showQuestion(q) {
      questionText.textContent = q;
      waitingState.style.display = 'none';
      questionArea.style.display = '';
      answerInput.focus();
    }

    function hideQuestion() {
      questionArea.style.display = 'none';
      waitingState.style.display = '';
    }

    function updateCount() {
      answerCount.textContent = answersWall.querySelectorAll('.answer-card').length;
    }
  }

  return { initEntry, initTeacher, initStudent };
})();
