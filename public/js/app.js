/* ============================================
   Live Classroom Q&A — Frontend Logic
   Powered by Supabase Realtime
   ============================================ */
const LiveQA = (function () {
  'use strict';

  let supabaseClient = null;

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

  function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY ||
        window.SUPABASE_URL.includes('YOUR-PROJECT-REF')) {
      throw new Error('Supabase credentials not configured. Edit public/js/supabase-config.js');
    }
    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    return supabaseClient;
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

  function generateRoomId() {
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += Math.floor(Math.random() * 10).toString();
    }
    return id;
  }

  // ---------- Entry Page ----------
  function initEntry() {
    const createBtn = document.getElementById('createRoomBtn');
    const joinBtn = document.getElementById('joinRoomBtn');
    const roomInput = document.getElementById('roomCodeInput');
    const nameInput = document.getElementById('studentNameInput');

    createBtn.addEventListener('click', async () => {
      try {
        const sb = getSupabase();
        // Try up to 5 times to find a unique room ID
        let roomId;
        for (let attempt = 0; attempt < 5; attempt++) {
          roomId = generateRoomId();
          const { error } = await sb.from('rooms').insert({ room_id: roomId });
          if (!error) break;
          if (error.code !== '23505') throw error; // 23505 = unique violation
        }
        window.location.href = 'teacher.html?room=' + roomId;
      } catch (err) {
        console.error(err);
        toast('Failed to create classroom, please try again', 'error');
      }
    });

    joinBtn.addEventListener('click', () => {
      const room = roomInput.value.trim();
      if (!/^\d{6}$/.test(room)) {
        toast('Please enter a 6-digit classroom code', 'error');
        return;
      }
      const name = encodeURIComponent(nameInput.value.trim());
      window.location.href = 'student.html?room=' + room + '&name=' + name;
    });

    roomInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') joinBtn.click();
    });
  }

  // ---------- Teacher Dashboard ----------
  function initTeacher() {
    const room = getQueryParam('room');
    if (!room) {
      window.location.href = 'index.html';
      return;
    }

    document.getElementById('roomCodeDisplay').textContent = room;
    document.getElementById('statRoomCode').textContent = room;

    const sb = getSupabase();

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

    let presenceChannel = null;

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

    function updateStudentCount(count) {
      statStudents.textContent = count;
      studentCountEl.textContent = count;
    }

    async function loadExistingAnswers() {
      const { data } = await sb.from('answers').select('*').eq('room_id', room).order('created_at', { ascending: true });
      if (data) {
        answersWall.innerHTML = '';
        if (data.length === 0) {
          answersWall.appendChild(emptyState);
        } else {
          data.forEach((a) => answersWall.appendChild(makeAnswerCard(a)));
        }
        updateCount();
      }
    }

    async function loadCurrentQuestion() {
      const { data } = await sb.from('rooms').select('question').eq('room_id', room).single();
      if (data && data.question) {
        showActiveQuestion(data.question);
        await loadExistingAnswers();
      }
    }

    // Subscribe to question changes
    sb.channel('rooms:' + room)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: 'room_id=eq.' + room,
      }, (payload) => {
        const question = payload.new.question;
        if (question) {
          showActiveQuestion(question);
          answersWall.innerHTML = '';
          answersWall.appendChild(emptyState);
          updateCount();
          toast('Question posted', 'success');
        } else {
          hideActiveQuestion();
          toast('Current question ended', 'success');
        }
      })
      .subscribe();

    // Subscribe to new answers
    sb.channel('answers:' + room)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'answers',
        filter: 'room_id=eq.' + room,
      }, (payload) => {
        if (emptyState.parentNode) emptyState.remove();
        answersWall.insertBefore(makeAnswerCard(payload.new), answersWall.firstChild);
        updateCount();
      })
      .subscribe();

    // Presence: track online students
    presenceChannel = sb.channel('presence:' + room, {
      config: { presence: { key: 'teacher-' + Date.now() } },
    });

    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      // Count everyone except the teacher (key starts with 'teacher-')
      const students = Object.keys(state).filter((k) => !k.startsWith('teacher-'));
      updateStudentCount(students.length);
    });

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ online_at: new Date().toISOString() });
      }
    });

    // Load initial state
    loadCurrentQuestion();

    postBtn.addEventListener('click', async () => {
      const q = questionInput.value.trim();
      if (!q) {
        toast('Please enter a question', 'error');
        return;
      }
      try {
        // Clear old answers first, then set the new question
        await sb.from('answers').delete().eq('room_id', room);
        await sb.from('rooms').update({ question: q }).eq('room_id', room);
        questionInput.value = '';
      } catch (err) {
        console.error(err);
        toast('Failed to post question', 'error');
      }
    });

    endBtn.addEventListener('click', async () => {
      try {
        await sb.from('rooms').update({ question: null }).eq('room_id', room);
      } catch (err) {
        console.error(err);
        toast('Failed to end question', 'error');
      }
    });

    questionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postBtn.click();
    });
  }

  // ---------- Student View ----------
  function initStudent() {
    const room = getQueryParam('room');
    const rawName = getQueryParam('name') || '';
    const name = decodeURIComponent(rawName) || 'Anonymous';

    if (!room) {
      window.location.href = 'index.html';
      return;
    }

    document.getElementById('roomCodeDisplay').textContent = room;

    const sb = getSupabase();

    const waitingState = document.getElementById('waitingState');
    const questionArea = document.getElementById('questionArea');
    const questionText = document.getElementById('questionText');
    const answerInput = document.getElementById('answerInput');
    const submitBtn = document.getElementById('submitAnswerBtn');
    const answersWall = document.getElementById('answersWall');
    const answerCount = document.getElementById('answerCount');

    let presenceChannel = null;

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

    async function loadExistingAnswers() {
      const { data } = await sb.from('answers').select('*').eq('room_id', room).order('created_at', { ascending: true });
      if (data) {
        answersWall.innerHTML = '';
        data.forEach((a) => answersWall.appendChild(makeAnswerCard(a)));
        updateCount();
      }
    }

    async function loadCurrentQuestion() {
      const { data, error } = await sb.from('rooms').select('question').eq('room_id', room).single();
      if (error || !data) {
        toast('Classroom not found, please check the code', 'error');
        return;
      }
      if (data.question) {
        showQuestion(data.question);
        await loadExistingAnswers();
      }
    }

    // Subscribe to question changes
    sb.channel('rooms:' + room)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: 'room_id=eq.' + room,
      }, (payload) => {
        const question = payload.new.question;
        if (question) {
          showQuestion(question);
          answersWall.innerHTML = '';
          updateCount();
          toast('New question received!', 'success');
        } else {
          hideQuestion();
          toast('Question ended', '');
        }
      })
      .subscribe();

    // Subscribe to new answers
    sb.channel('answers:' + room)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'answers',
        filter: 'room_id=eq.' + room,
      }, (payload) => {
        answersWall.insertBefore(makeAnswerCard(payload.new), answersWall.firstChild);
        updateCount();
      })
      .subscribe();

    // Presence: track online status
    presenceChannel = sb.channel('presence:' + room, {
      config: { presence: { key: 'student-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) } },
    });

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ name: name, online_at: new Date().toISOString() });
      }
    });

    // Load initial state
    loadCurrentQuestion();

    submitBtn.addEventListener('click', submitAnswer);
    answerInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitAnswer();
    });

    async function submitAnswer() {
      const text = answerInput.value.trim();
      if (!text) {
        toast('Please enter an answer', 'error');
        return;
      }
      try {
        await sb.from('answers').insert({
          room_id: room,
          answer: text,
          student_name: name,
        });
        answerInput.value = '';
        toast('Answer submitted', 'success');
      } catch (err) {
        console.error(err);
        toast('Failed to submit answer', 'error');
      }
    }
  }

  return { initEntry, initTeacher, initStudent };
})();
