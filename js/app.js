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
  // isStudent: if true, includes answer input bar; else shows teacher action buttons
  function makeQuestionCard(q, index, isStudent) {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.dataset.questionId = q.id;

    const answersWallClass = isStudent ? 'student-answers-wall' : 'answers-wall';
    const answersTitle = isStudent ? "Classmates' Answers" : 'Answers';

    // Reference answer block (shown when teacher reveals it)
    const showAnswer = !!q.show_answer;
    const hasRefAnswer = q.correct_answer && q.correct_answer.trim() !== '';
    let refAnswerHtml = '';
    if (showAnswer && hasRefAnswer) {
      refAnswerHtml =
        '<div class="reference-answer">' +
          '<span class="ref-label">Reference Answer</span>' +
          '<span class="ref-text">' + escapeHtml(q.correct_answer) + '</span>' +
        '</div>';
    }

    // Teacher action buttons (Show/Hide Answer + Delete)
    let actionsHtml = '';
    if (!isStudent) {
      const toggleLabel = showAnswer ? 'Hide Answer' : 'Show Answer';
      const toggleClass = showAnswer ? 'btn-ghost' : 'btn-outline';
      actionsHtml =
        '<div class="question-actions">' +
          (hasRefAnswer
            ? '<button class="btn ' + toggleClass + ' btn-sm toggle-answer-btn">' + toggleLabel + '</button>'
            : '') +
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
      refAnswerHtml +
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
    const correctAnswerInput = document.getElementById('correctAnswerInput');
    const postBtn = document.getElementById('postQuestionBtn');
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

    // Update a card in place when its question row changes (show_answer toggle)
    function updateQuestionCard(q) {
      const card = questionsList.querySelector('.question-card[data-question-id="' + q.id + '"]');
      if (!card) return;
      // Preserve the answer wall content, then re-render the card skeleton
      const savedWall = card.querySelector('.answers-wall-inner').innerHTML;
      const savedCount = card.querySelector('.answer-count').textContent;
      // Use the existing Q number from the card
      const qNum = card.querySelector('.question-number').textContent.replace('Q', '');
      const fresh = makeQuestionCard(q, parseInt(qNum, 10) || 1, false);
      card.replaceWith(fresh);
      const newWall = fresh.querySelector('.answers-wall-inner');
      newWall.innerHTML = savedWall;
      fresh.querySelector('.answer-count').textContent = savedCount;
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

    // Subscribe to question changes (INSERT / UPDATE / DELETE)
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
        event: 'UPDATE',
        schema: 'public',
        table: 'questions',
        filter: 'room_id=eq.' + room,
      }, (payload) => {
        updateQuestionCard(payload.new);
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

    postBtn.addEventListener('click', async () => {
      const q = questionInput.value.trim();
      if (!q) {
        toast('Please enter a question', 'error');
        return;
      }
      try {
        const ref = correctAnswerInput.value.trim();
        await sb.from('questions').insert({
          room_id: room,
          question_text: q,
          correct_answer: ref || null,
        });
        questionInput.value = '';
        correctAnswerInput.value = '';
      } catch (err) {
        console.error(err);
        toast('Failed to post question', 'error');
      }
    });

    questionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postBtn.click();
    });

    // Event delegation: Delete question + Toggle show_answer
    questionsList.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.delete-question-btn');
      const toggleBtn = e.target.closest('.toggle-answer-btn');
      if (!deleteBtn && !toggleBtn) return;

      const card = e.target.closest('.question-card');
      if (!card) return;
      const qid = card.dataset.questionId;

      if (deleteBtn) {
        if (!confirm('Delete this question and all its answers?')) return;
        try {
          await sb.from('questions').delete().eq('id', qid);
          toast('Question deleted', 'success');
        } catch (err) {
          console.error(err);
          toast('Failed to delete question', 'error');
        }
      }

      if (toggleBtn) {
        const currentlyShown = toggleBtn.textContent === 'Hide Answer';
        try {
          await sb.from('questions')
            .update({ show_answer: !currentlyShown })
            .eq('id', qid);
        } catch (err) {
          console.error(err);
          toast('Failed to update answer visibility', 'error');
        }
      }
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

    // Re-render a card when show_answer toggles, preserving answer input + wall
    function updateQuestionCard(q) {
      const card = questionsList.querySelector('.question-card[data-question-id="' + q.id + '"]');
      if (!card) return;
      const savedInputVal = card.querySelector('.answer-input')?.value || '';
      const savedWall = card.querySelector('.answers-wall-inner').innerHTML;
      const savedCount = card.querySelector('.answer-count').textContent;
      const qNum = card.querySelector('.question-number').textContent.replace('Q', '');

      const fresh = makeQuestionCard(q, parseInt(qNum, 10) || 1, true);
      card.replaceWith(fresh);
      const newInput = fresh.querySelector('.answer-input');
      if (newInput) newInput.value = savedInputVal;
      fresh.querySelector('.answers-wall-inner').innerHTML = savedWall;
      fresh.querySelector('.answer-count').textContent = savedCount;

      // Re-wire submit handlers for the new card
      const input = fresh.querySelector('.answer-input');
      const btn = fresh.querySelector('.submit-answer-btn');
      const qid = fresh.dataset.questionId;
      async function submitAnswer() {
        const text = input.value.trim();
        if (!text) { toast('Please enter an answer', 'error'); return; }
        try {
          await sb.from('answers').insert({
            room_id: room, question_id: qid, answer: text, student_name: name,
          });
          input.value = '';
          toast('Answer submitted', 'success');
        } catch (err) {
          console.error(err);
          toast('Failed to submit answer', 'error');
        }
      }
      btn.addEventListener('click', submitAnswer);
      input.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitAnswer(); });
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

    // Subscribe to question changes (INSERT / UPDATE / DELETE)
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
        event: 'UPDATE',
        schema: 'public',
        table: 'questions',
        filter: 'room_id=eq.' + room,
      }, (payload) => {
        updateQuestionCard(payload.new);
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
