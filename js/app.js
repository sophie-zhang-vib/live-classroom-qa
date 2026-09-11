/* ============================================
   Live Classroom Q&A — Frontend Logic
   Powered by Supabase Realtime (Multi-Question)
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
      throw new Error('Supabase credentials not configured. Edit js/supabase-config.js');
    }
    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    return supabaseClient;
  }

  function initialOf(name) {
    return (name || 'A').trim().charAt(0).toUpperCase() || 'A';
  }

  function generateRoomId() {
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += Math.floor(Math.random() * 10).toString();
    }
    return id;
  }

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function makeAnswerCard(a) {
    const card = document.createElement('div');
    card.className = 'answer-card';
    card.style.animationDelay = (Math.random() * 0.12).toFixed(3) + 's';
    card.innerHTML =
      '<div class="student"><span class="avatar">' + escapeHtml(initialOf(a.student_name || a.studentName)) +
      '</span>' + escapeHtml(a.student_name || a.studentName || 'Anonymous') + '</div>' +
      '<div class="text">' + escapeHtml(a.answer) + '</div>';
    return card;
  }

  // ---------- Shared: create a question card ----------
  // isStudent: if true, includes answer input bar; else shows delete button
  function makeQuestionCard(q, index, isStudent) {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.dataset.questionId = q.id;

    const answersWallClass = isStudent ? 'student-answers-wall' : 'answers-wall';
    const answersTitle = isStudent ? "Classmates' Answers" : 'Answers';

    // Teacher action buttons (Delete only)
    let actionsHtml = '';
    if (!isStudent) {
      actionsHtml =
        '<div class="question-actions">' +
          '<button class="btn btn-ghost btn-sm btn-danger delete-question-btn">Delete</button>' +
        '</div>';
    }

    card.innerHTML =
      '<div class="question-card-header">' +
        '<span class="question-number">Q' + index + '</span>' +
        '<span class="question-time">' + formatTime(q.created_at) + '</span>' +
        actionsHtml +
      '</div>' +
      '<div class="question-card-text">' + escapeHtml(q.question_text) + '</div>' +
      (isStudent ?
        '<div class="answer-input-bar">' +
          '<input type="text" class="input-field answer-input" placeholder="Type your answer…" maxlength="500" autocomplete="off" />' +
          '<button class="btn btn-primary submit-answer-btn">Submit</button>' +
        '</div>' : '') +
      '<div class="answers-section">' +
        '<h4 class="section-title small">' + answersTitle + ' <span class="count answer-count">0</span></h4>' +
        '<div class="' + answersWallClass + ' answers-wall-inner"></div>' +
      '</div>';

    return card;
  }

  // ---------- Entry Page ----------
  function initEntry() {
    const createBtn = document.getElementById('createRoomBtn');
    const joinBtn = document.getElementById('joinRoomBtn');
    const roomInput = document.getElementById('roomCodeInput');
    const nameInput = document.getElementById('studentNameInput');

    // Pre-fill room code if provided in URL (e.g. from QR code scan)
    const urlRoom = getQueryParam('room');
    if (urlRoom && /^\d{6}$/.test(urlRoom)) {
      roomInput.value = urlRoom;
      nameInput.focus();
    }

    createBtn.addEventListener('click', async () => {
      try {
        const sb = getSupabase();
        let roomId;
        for (let attempt = 0; attempt < 5; attempt++) {
          roomId = generateRoomId();
          const { error } = await sb.from('rooms').insert({ room_id: roomId });
          if (!error) break;
          if (error.code !== '23505') throw error;
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
    const exportBtn = document.getElementById('exportBtn');
    const questionsList = document.getElementById('questionsList');
    const emptyState = document.getElementById('emptyState');
    const questionCountEl = document.getElementById('questionCount');
    const statQuestions = document.getElementById('statQuestions');
    const statAnswers = document.getElementById('statAnswers');
    const statStudents = document.getElementById('statStudents');
    const studentCountEl = document.getElementById('studentCount');

    let questionIndex = 0; // running counter for numbering
    let presenceChannel = null;

    function updateQuestionCount() {
      const n = questionsList.querySelectorAll('.question-card').length;
      questionCountEl.textContent = n;
      statQuestions.textContent = n;
    }

    function updateTotalAnswers() {
      let total = 0;
      questionsList.querySelectorAll('.question-card').forEach((card) => {
        total += card.querySelectorAll('.answer-card').length;
      });
      statAnswers.textContent = total;
    }

    function updateStudentCount(count) {
      statStudents.textContent = count;
      studentCountEl.textContent = count;
    }

    function addAnswerToQuestion(questionId, answer) {
      const card = questionsList.querySelector('.question-card[data-question-id="' + questionId + '"]');
      if (!card) return;
      const wall = card.querySelector('.answers-wall-inner');
      const countEl = card.querySelector('.answer-count');
      wall.insertBefore(makeAnswerCard(answer), wall.firstChild);
      countEl.textContent = card.querySelectorAll('.answer-card').length;
      updateTotalAnswers();
    }

    function addQuestionCard(q) {
      if (emptyState.parentNode) emptyState.remove();
      questionIndex++;
      const card = makeQuestionCard(q, questionIndex, false);
      // Newest question appears at the top
      questionsList.insertBefore(card, questionsList.firstChild);
      updateQuestionCount();
    }

    function removeQuestionCard(questionId) {
      const card = questionsList.querySelector('.question-card[data-question-id="' + questionId + '"]');
      if (card) card.remove();
      if (questionsList.querySelectorAll('.question-card').length === 0) {
        questionsList.appendChild(emptyState);
      }
      updateQuestionCount();
      updateTotalAnswers();
    }

    // Load existing questions + answers
    async function loadQuestions() {
      const { data: questions } = await sb.from('questions')
        .select('*')
        .eq('room_id', room)
        .order('created_at', { ascending: true });

      const { data: answers } = await sb.from('answers')
        .select('*')
        .eq('room_id', room)
        .order('created_at', { ascending: true });

      if (!questions) return;

      questionsList.innerHTML = '';
      questionIndex = 0;

      if (questions.length === 0) {
        questionsList.appendChild(emptyState);
        return;
      }

      // Render questions oldest first (so Q1 is at bottom, newest at top)
      questions.forEach((q) => addQuestionCard(q));

      // Populate answers into the right question cards
      if (answers) {
        answers.forEach((a) => addAnswerToQuestion(a.question_id, a));
      }
    }

    // Subscribe to question changes (INSERT / DELETE)
    sb.channel('questions:' + room)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'questions',
        filter: 'room_id=eq.' + room,
      }, (payload) => {
        addQuestionCard(payload.new);
        toast('Question posted', 'success');
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'questions',
        filter: 'room_id=eq.' + room,
      }, (payload) => {
        removeQuestionCard(payload.old.id);
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
        addAnswerToQuestion(payload.new.question_id, payload.new);
      })
      .subscribe();

    // Presence: track online students
    presenceChannel = sb.channel('presence:' + room, {
      config: { presence: { key: 'teacher-' + Date.now() } },
    });

    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      const students = Object.keys(state).filter((k) => !k.startsWith('teacher-'));
      updateStudentCount(students.length);
    });

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ online_at: new Date().toISOString() });
      }
    });

    // Load initial state
    loadQuestions();

    // Generate QR code for students to scan and join
    const qrCanvas = document.getElementById('qrCanvas');
    if (qrCanvas && typeof QRCode !== 'undefined') {
      const studentUrl = window.location.origin + window.location.pathname.replace('teacher.html', 'index.html') + '?room=' + room;
      new QRCode(qrCanvas, {
        text: studentUrl,
        width: 180,
        height: 180,
        colorDark: '#1a1a2e',
        colorLight: '#ffffff',
      });
    }

    postBtn.addEventListener('click', async () => {
      const q = questionInput.value.trim();
      if (!q) {
        toast('Please enter a question', 'error');
        return;
      }
      try {
        await sb.from('questions').insert({
          room_id: room,
          question_text: q,
        });
        questionInput.value = '';
      } catch (err) {
        console.error(err);
        toast('Failed to post question', 'error');
      }
    });

    questionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postBtn.click();
    });

    // Event delegation: Delete question
    questionsList.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.delete-question-btn');
      if (!deleteBtn) return;

      const card = e.target.closest('.question-card');
      if (!card) return;
      const qid = card.dataset.questionId;

      if (!confirm('Delete this question and all its answers?')) return;
      try {
        await sb.from('questions').delete().eq('id', qid);
        toast('Question deleted', 'success');
      } catch (err) {
        console.error(err);
        toast('Failed to delete question', 'error');
      }
    });

    // Export all questions + answers as a CSV file
    exportBtn.addEventListener('click', async () => {
      try {
        const { data: questions } = await sb.from('questions')
          .select('*')
          .eq('room_id', room)
          .order('created_at', { ascending: true });

        const { data: answers } = await sb.from('answers')
          .select('*')
          .eq('room_id', room)
          .order('created_at', { ascending: true });

        if (!questions || questions.length === 0) {
          toast('No questions to export', 'error');
          return;
        }

        const rows = [['Question', 'Student', 'Answer', 'Time']];
        questions.forEach((q) => {
          const qAnswers = (answers || []).filter((a) => a.question_id === q.id);
          if (qAnswers.length === 0) {
            rows.push([q.question_text, '', '', '']);
          } else {
            qAnswers.forEach((a) => {
              rows.push([
                q.question_text,
                a.student_name || 'Anonymous',
                a.answer,
                formatTime(a.created_at),
              ]);
            });
          }
        });

        const csv = rows
          .map((r) => r.map((cell) => {
            const s = String(cell ?? '');
            return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
          }).join(','))
          .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = 'live-qa-' + room + '-' + ts + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('Exported ' + (rows.length - 1) + ' row(s)', 'success');
      } catch (err) {
        console.error(err);
        toast('Failed to export data', 'error');
      }
    });

    // ---------- Response Viewer (Presentation Mode) ----------
    const showResponsesBtn = document.getElementById('showResponsesBtn');
    const rvOverlay = document.getElementById('rvOverlay');
    const rvCloseBtn = document.getElementById('rvCloseBtn');
    const rvPrevBtn = document.getElementById('rvPrevBtn');
    const rvNextBtn = document.getElementById('rvNextBtn');
    const rvQuestion = document.getElementById('rvQuestion');
    const rvAnswers = document.getElementById('rvAnswers');
    const rvPageIndicator = document.getElementById('rvPageIndicator');
    const rvAnswerCount = document.getElementById('rvAnswerCount');

    let rvPages = [];   // array of { question, answers }
    let rvIndex = 0;     // current page index

    function renderRvPage() {
      const page = rvPages[rvIndex];
      if (!page) return;
      const { question, answers } = page;

      rvQuestion.innerHTML =
        '<div class="rv-q-number">Q' + (rvIndex + 1) + '</div>' +
        '<div class="rv-q-text">' + escapeHtml(question.question_text) + '</div>' +
        '<div class="rv-q-time">' + formatTime(question.created_at) + '</div>';

      rvAnswers.innerHTML = '';
      if (answers.length === 0) {
        rvAnswers.innerHTML = '<div class="rv-empty">No responses yet</div>';
      } else {
        answers.forEach((a) => {
          rvAnswers.appendChild(makeAnswerCard(a));
        });
      }

      rvPageIndicator.textContent = getPageIndicator(rvIndex, rvPages.length);
      rvAnswerCount.textContent = getAnswerCountLabel(answers.length);
    }

    function openResponseViewer() {
      if (rvPages.length === 0) {
        toast('No questions to show', 'error');
        return;
      }
      rvIndex = 0;
      renderRvPage();
      rvOverlay.hidden = false;
      document.body.style.overflow = 'hidden';
    }

    function closeResponseViewer() {
      rvOverlay.hidden = true;
      document.body.style.overflow = '';
    }

    showResponsesBtn.addEventListener('click', async () => {
      try {
        const { data: questions } = await sb.from('questions')
          .select('*')
          .eq('room_id', room)
          .order('created_at', { ascending: true });

        const { data: answers } = await sb.from('answers')
          .select('*')
          .eq('room_id', room)
          .order('created_at', { ascending: true });

        rvPages = buildResponsePages(questions, answers);
        openResponseViewer();
      } catch (err) {
        console.error(err);
        toast('Failed to load responses', 'error');
      }
    });

    rvCloseBtn.addEventListener('click', closeResponseViewer);
    rvOverlay.addEventListener('click', (e) => {
      if (e.target === rvOverlay) closeResponseViewer();
    });

    rvPrevBtn.addEventListener('click', () => {
      rvIndex = getPrevIndex(rvIndex, rvPages.length);
      renderRvPage();
    });

    rvNextBtn.addEventListener('click', () => {
      rvIndex = getNextIndex(rvIndex, rvPages.length);
      renderRvPage();
    });

    document.addEventListener('keydown', (e) => {
      if (rvOverlay.hidden) return;
      if (e.key === 'Escape') closeResponseViewer();
      else if (e.key === 'ArrowLeft') rvPrevBtn.click();
      else if (e.key === 'ArrowRight') rvNextBtn.click();
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

    const questionsList = document.getElementById('questionsList');
    const emptyState = document.getElementById('emptyState');
    const questionCountEl = document.getElementById('questionCount');

    let questionIndex = 0;
    let presenceChannel = null;

    function updateQuestionCount() {
      questionCountEl.textContent = questionsList.querySelectorAll('.question-card').length;
    }

    function addAnswerToQuestion(questionId, answer) {
      const card = questionsList.querySelector('.question-card[data-question-id="' + questionId + '"]');
      if (!card) return;
      const wall = card.querySelector('.answers-wall-inner');
      const countEl = card.querySelector('.answer-count');
      wall.insertBefore(makeAnswerCard(answer), wall.firstChild);
      countEl.textContent = card.querySelectorAll('.answer-card').length;
    }

    function addQuestionCard(q) {
      if (emptyState.parentNode) emptyState.remove();
      questionIndex++;
      const card = makeQuestionCard(q, questionIndex, true);
      questionsList.insertBefore(card, questionsList.firstChild);

      // Wire up the answer submit for this question
      const input = card.querySelector('.answer-input');
      const btn = card.querySelector('.submit-answer-btn');
      const qid = card.dataset.questionId;

      async function submitAnswer() {
        const text = input.value.trim();
        if (!text) {
          toast('Please enter an answer', 'error');
          return;
        }
        try {
          await sb.from('answers').insert({
            room_id: room,
            question_id: qid,
            answer: text,
            student_name: name,
          });
          input.value = '';
          toast('Answer submitted', 'success');
        } catch (err) {
          console.error(err);
          toast('Failed to submit answer', 'error');
        }
      }

      btn.addEventListener('click', submitAnswer);
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitAnswer();
      });

      updateQuestionCount();
    }

    function removeQuestionCard(questionId) {
      const card = questionsList.querySelector('.question-card[data-question-id="' + questionId + '"]');
      if (card) card.remove();
      if (questionsList.querySelectorAll('.question-card').length === 0) {
        questionsList.appendChild(emptyState);
      }
      updateQuestionCount();
    }

    // Load existing questions + answers
    async function loadQuestions() {
      const { data: questions, error: qErr } = await sb.from('questions')
        .select('*')
        .eq('room_id', room)
        .order('created_at', { ascending: true });

      if (qErr || !questions) {
        toast('Classroom not found, please check the code', 'error');
        return;
      }

      const { data: answers } = await sb.from('answers')
        .select('*')
        .eq('room_id', room)
        .order('created_at', { ascending: true });

      questionsList.innerHTML = '';
      questionIndex = 0;

      if (questions.length === 0) {
        questionsList.appendChild(emptyState);
        return;
      }

      questions.forEach((q) => addQuestionCard(q));

      if (answers) {
        answers.forEach((a) => addAnswerToQuestion(a.question_id, a));
      }
    }

    // Subscribe to question changes (INSERT / DELETE)
    sb.channel('questions:' + room)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'questions',
        filter: 'room_id=eq.' + room,
      }, (payload) => {
        addQuestionCard(payload.new);
        toast('New question received!', 'success');
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'questions',
        filter: 'room_id=eq.' + room,
      }, (payload) => {
        removeQuestionCard(payload.old.id);
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
        addAnswerToQuestion(payload.new.question_id, payload.new);
      })
      .subscribe();

    // Presence
    presenceChannel = sb.channel('presence:' + room, {
      config: { presence: { key: 'student-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) } },
    });

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ name: name, online_at: new Date().toISOString() });
      }
    });

    // Load initial state
    loadQuestions();
  }

  return { initEntry, initTeacher, initStudent };
})();
