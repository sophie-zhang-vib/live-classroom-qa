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

  // ---------- Shared: file helper ----------
  function getFileExtension(filename) {
    if (!filename) return '';
    const idx = filename.lastIndexOf('.');
    return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : '';
  }

  function getFileIcon(ext) {
    const ex = (ext || '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ex)) return 'image';
    if (['pdf'].includes(ex)) return 'pdf';
    if (['doc', 'docx'].includes(ex)) return 'word';
    if (['xls', 'xlsx', 'csv'].includes(ex)) return 'excel';
    if (['ppt', 'pptx'].includes(ex)) return 'ppt';
    if (['zip', 'rar', '7z'].includes(ex)) return 'archive';
    return 'file';
  }

  // ---------- Shared: reactions & comments state ----------
  // viewerName: name of the current user (student name in student view, 'Teacher' in teacher view)
  let viewerName = 'Anonymous';

  // reactionsByAnswer: answerId -> { like: Set<names>, inspiring: Set<names>, surprise: Set<names> }
  const reactionsByAnswer = {};
  // commentsByAnswer: answerId -> array of comment objects
  const commentsByAnswer = {};

  const REACTION_TYPES = [
    { key: 'like', label: 'Like', icon: '👍' },
    { key: 'inspiring', label: 'Inspiring', icon: '✨' },
    { key: 'surprise', label: 'Surprise', icon: '😮' },
  ];

  function getReactionEntry(answerId) {
    if (!reactionsByAnswer[answerId]) {
      reactionsByAnswer[answerId] = { like: new Set(), inspiring: new Set(), surprise: new Set() };
    }
    return reactionsByAnswer[answerId];
  }

  function getReactionCount(answerId, type) {
    return getReactionEntry(answerId)[type].size;
  }

  function hasReacted(answerId, type) {
    return getReactionEntry(answerId)[type].has(viewerName);
  }

  function setReactionFromRow(row) {
    getReactionEntry(row.answer_id)[row.reaction_type].add(row.student_name);
  }

  function removeReactionFromRow(row) {
    getReactionEntry(row.answer_id)[row.reaction_type].delete(row.student_name);
  }

  function getComments(answerId) {
    return commentsByAnswer[answerId] || [];
  }

  function addComment(comment) {
    if (!commentsByAnswer[comment.answer_id]) commentsByAnswer[comment.answer_id] = [];
    commentsByAnswer[comment.answer_id].push(comment);
  }

  function removeCommentById(id) {
    Object.keys(commentsByAnswer).forEach((aid) => {
      commentsByAnswer[aid] = commentsByAnswer[aid].filter((c) => c.id !== id);
    });
  }

  function renderComments(answerId) {
    const list = getComments(answerId);
    if (list.length === 0) return '';
    return list.map((c) =>
      '<div class="answer-comment">' +
        '<span class="comment-author">' + escapeHtml(c.student_name || 'Anonymous') + ':</span> ' +
        '<span class="comment-text">' + escapeHtml(c.comment_text) + '</span>' +
      '</div>'
    ).join('');
  }

  function makeAnswerCard(a) {
    const card = document.createElement('div');
    card.className = 'answer-card';
    card.style.animationDelay = (Math.random() * 0.12).toFixed(3) + 's';
    card.dataset.answerId = a.id;

    let fileHtml = '';
    if (a.file_url && a.file_name) {
      const ext = getFileExtension(a.file_name);
      const icon = getFileIcon(ext);
      const isImage = icon === 'image';
      fileHtml =
        '<a class="answer-file ' + (isImage ? 'answer-file-image' : '') +
        '" href="' + escapeHtml(a.file_url) + '" target="_blank" rel="noopener">' +
        (isImage
          ? '<img src="' + escapeHtml(a.file_url) + '" alt="' + escapeHtml(a.file_name) + '" />'
          : '<span class="file-icon file-icon-' + icon + '"></span>') +
        '<span class="file-name">' + escapeHtml(a.file_name) + '</span>' +
        '</a>';
    }

    const textHtml = a.answer ? '<div class="text">' + escapeHtml(a.answer) + '</div>' : '';

    // Reaction buttons
    const reactionsHtml = REACTION_TYPES.map((r) => {
      const count = getReactionCount(a.id, r.key);
      const active = hasReacted(a.id, r.key);
      return '<button class="reaction-btn ' + (active ? 'active' : '') + '" data-reaction="' + r.key + '" title="' + r.label + '">' +
        '<span class="reaction-icon">' + r.icon + '</span>' +
        '<span class="reaction-count">' + count + '</span>' +
        '</button>';
    }).join('');

    const commentCount = getComments(a.id).length;

    card.innerHTML =
      '<div class="student"><span class="avatar">' + escapeHtml(initialOf(a.student_name || a.studentName)) +
      '</span>' + escapeHtml(a.student_name || a.studentName || 'Anonymous') + '</div>' +
      textHtml +
      fileHtml +
      '<div class="answer-actions">' +
        reactionsHtml +
        '<button class="reaction-btn comment-toggle-btn" title="Comment">' +
          '<span class="reaction-icon">💬</span>' +
          '<span class="reaction-count">' + commentCount + '</span>' +
        '</button>' +
      '</div>' +
      '<div class="answer-comments" hidden>' +
        '<div class="comments-list">' + renderComments(a.id) + '</div>' +
        '<div class="comment-input-row">' +
          '<input type="text" class="comment-input" placeholder="Write a comment…" maxlength="300" />' +
          '<button class="btn btn-primary btn-sm comment-send-btn">Send</button>' +
        '</div>' +
      '</div>';

    // Wire up reaction buttons
    card.querySelectorAll('.reaction-btn[data-reaction]').forEach((btn) => {
      btn.addEventListener('click', () => toggleReaction(a.id, btn.dataset.reaction));
    });

    // Wire up comment toggle
    const toggleBtn = card.querySelector('.comment-toggle-btn');
    const commentsSection = card.querySelector('.answer-comments');
    toggleBtn.addEventListener('click', () => {
      commentsSection.hidden = !commentsSection.hidden;
      if (!commentsSection.hidden) {
        const inp = commentsSection.querySelector('.comment-input');
        if (inp) inp.focus();
      }
    });

    // Wire up comment send
    const sendBtn = card.querySelector('.comment-send-btn');
    const commentInput = card.querySelector('.comment-input');
    function sendComment() {
      const txt = commentInput.value.trim();
      if (!txt) return;
      submitComment(a.id, txt);
      commentInput.value = '';
    }
    sendBtn.addEventListener('click', sendComment);
    commentInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendComment();
    });

    return card;
  }

  // Refresh reaction counts / active state / comments for a single answer card in place
  function refreshAnswerCardInteractions(answerId) {
    const cards = document.querySelectorAll('.answer-card[data-answer-id="' + answerId + '"]');
    cards.forEach((card) => {
      // Reactions
      card.querySelectorAll('.reaction-btn[data-reaction]').forEach((btn) => {
        const type = btn.dataset.reaction;
        btn.querySelector('.reaction-count').textContent = getReactionCount(answerId, type);
        btn.classList.toggle('active', hasReacted(answerId, type));
      });
      // Comment count
      const countEl = card.querySelector('.comment-toggle-btn .reaction-count');
      if (countEl) countEl.textContent = getComments(answerId).length;
      // Comments list
      const listEl = card.querySelector('.comments-list');
      if (listEl) listEl.innerHTML = renderComments(answerId);
    });
  }

  // Toggle a reaction on an answer (insert if not reacted, delete if already reacted)
  async function toggleReaction(answerId, type) {
    try {
      const sb = getSupabase();
      const name = viewerName;
      if (hasReacted(answerId, type)) {
        await sb.from('answer_reactions')
          .delete()
          .eq('answer_id', answerId)
          .eq('student_name', name)
          .eq('reaction_type', type);
      } else {
        await sb.from('answer_reactions').insert({
          answer_id: answerId,
          student_name: name,
          reaction_type: type,
        });
      }
    } catch (err) {
      console.error(err);
      toast('Failed to update reaction', 'error');
    }
  }

  // Submit a comment on an answer
  async function submitComment(answerId, text) {
    try {
      const sb = getSupabase();
      await sb.from('answer_comments').insert({
        answer_id: answerId,
        student_name: viewerName,
        comment_text: text,
      });
    } catch (err) {
      console.error(err);
      toast('Failed to post comment', 'error');
    }
  }

  // Load all reactions and comments for a room (or all answers in the room)
  async function loadReactionsAndComments(room) {
    try {
      const sb = getSupabase();
      const { data: reactions } = await sb.from('answer_reactions')
        .select('*')
        .eq('answer_id', 'not.is.null');
      // Filter by room via answer_id is not directly possible; load all and filter client-side
      // To keep it efficient, load reactions for answers in this room via a join isn't trivial with anon.
      // We load all reactions (small dataset) and they get associated by answer_id.
      (reactions || []).forEach(setReactionFromRow);

      const { data: comments } = await sb.from('answer_comments')
        .select('*')
        .order('created_at', { ascending: true });
      (comments || []).forEach(addComment);
    } catch (err) {
      console.error('Failed to load reactions/comments', err);
    }
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

    // Attached file (image preview or file link)
    let fileHtml = '';
    if (q.file_url && q.file_name) {
      const ext = getFileExtension(q.file_name);
      const icon = getFileIcon(ext);
      const isImage = icon === 'image';
      fileHtml =
        '<a class="answer-file question-file ' + (isImage ? 'answer-file-image' : '') +
        '" href="' + escapeHtml(q.file_url) + '" target="_blank" rel="noopener">' +
        (isImage
          ? '<img src="' + escapeHtml(q.file_url) + '" alt="' + escapeHtml(q.file_name) + '" />'
          : '<span class="file-icon file-icon-' + icon + '"></span>') +
        '<span class="file-name">' + escapeHtml(q.file_name) + '</span>' +
        '</a>';
    }

    const textHtml = q.question_text ? '<div class="question-card-text">' + escapeHtml(q.question_text) + '</div>' : '';

    card.innerHTML =
      '<div class="question-card-header">' +
        '<span class="question-number">Q' + index + '</span>' +
        '<span class="question-time">' + formatTime(q.created_at) + '</span>' +
        actionsHtml +
      '</div>' +
      textHtml +
      fileHtml +
      (isStudent ?
        '<div class="answer-input-bar">' +
          '<div class="answer-input-wrap">' +
            '<label class="add-file-btn" title="Attach file (Word, PDF, image, etc.)">' +
              '<input type="file" class="answer-file-input" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.svg,.zip,.rar" hidden />' +
              '<span class="add-file-icon" aria-hidden="true">+</span>' +
            '</label>' +
            '<input type="text" class="input-field answer-input" placeholder="Type your answer…" maxlength="500" autocomplete="off" />' +
          '</div>' +
          '<span class="file-picker-name" hidden></span>' +
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
    const teacherRoomInput = document.getElementById('teacherRoomCodeInput');
    const rejoinBtn = document.getElementById('rejoinRoomBtn');

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

    // Teacher rejoin existing classroom
    if (rejoinBtn && teacherRoomInput) {
      rejoinBtn.addEventListener('click', async () => {
        const room = teacherRoomInput.value.trim();
        if (!/^\d{6}$/.test(room)) {
          toast('Please enter a 6-digit classroom code', 'error');
          return;
        }
        try {
          const sb = getSupabase();
          const { data, error } = await sb
            .from('rooms')
            .select('room_id')
            .eq('room_id', room)
            .maybeSingle();
          if (error) {
            toast('Failed to rejoin classroom, please try again', 'error');
            return;
          }
          if (!data) {
            toast('Classroom not found, please check the code', 'error');
            return;
          }
          window.location.href = 'teacher.html?room=' + room;
        } catch (err) {
          console.error('Rejoin catch error:', err);
          toast('Failed to rejoin classroom, please try again', 'error');
        }
      });

      teacherRoomInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') rejoinBtn.click();
      });
    }

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

    viewerName = 'Teacher';
    document.getElementById('roomCodeDisplay').textContent = room;
    document.getElementById('statRoomCode').textContent = room;

    const sb = getSupabase();

    const questionInput = document.getElementById('questionInput');
    const postBtn = document.getElementById('postQuestionBtn');
    const questionFileInput = document.getElementById('questionFileInput');
    const questionFileNameLabel = document.querySelector('.question-file-name');
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

    // Subscribe to reactions on answers
    sb.channel('reactions:' + room)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'answer_reactions',
      }, (payload) => {
        setReactionFromRow(payload.new);
        refreshAnswerCardInteractions(payload.new.answer_id);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'answer_reactions',
      }, (payload) => {
        removeReactionFromRow(payload.old);
        refreshAnswerCardInteractions(payload.old.answer_id);
      })
      .subscribe();

    // Subscribe to comments on answers
    sb.channel('comments:' + room)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'answer_comments',
      }, (payload) => {
        addComment(payload.new);
        refreshAnswerCardInteractions(payload.new.answer_id);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'answer_comments',
      }, (payload) => {
        removeCommentById(payload.old.id);
        refreshAnswerCardInteractions(payload.old.answer_id);
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
    loadReactionsAndComments(room);
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

    questionFileInput.addEventListener('change', () => {
      const f = questionFileInput.files[0];
      if (f) {
        questionFileNameLabel.textContent = f.name;
        questionFileNameLabel.title = f.name;
        questionFileNameLabel.hidden = false;
      } else {
        questionFileNameLabel.textContent = '';
        questionFileNameLabel.title = '';
        questionFileNameLabel.hidden = true;
      }
    });

    postBtn.addEventListener('click', async () => {
      const q = questionInput.value.trim();
      const file = questionFileInput.files[0];
      if (!q && !file) {
        toast('Please enter a question or attach a file', 'error');
        return;
      }
      try {
        let fileUrl = null;
        let fileName = null;

        if (file) {
          const fileExt = file.name.slice(file.name.lastIndexOf('.'));
          const storagePath = room + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + fileExt;
          const { error: uploadErr } = await sb.storage
            .from('question-files')
            .upload(storagePath, file, { upsert: false });
          if (uploadErr) throw uploadErr;

          const { data: urlData } = sb.storage.from('question-files').getPublicUrl(storagePath);
          fileUrl = urlData.publicUrl;
          fileName = file.name;
        }

        await sb.from('questions').insert({
          room_id: room,
          question_text: q,
          file_url: fileUrl,
          file_name: fileName,
        });
        questionInput.value = '';
        questionFileInput.value = '';
        questionFileNameLabel.textContent = '';
        questionFileNameLabel.hidden = true;
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

        const rows = [['Question', 'Question File Name', 'Question File URL', 'Student', 'Answer', 'File Name', 'File URL', 'Time']];
        questions.forEach((q) => {
          const qAnswers = (answers || []).filter((a) => a.question_id === q.id);
          if (qAnswers.length === 0) {
            rows.push([q.question_text || '', q.file_name || '', q.file_url || '', '', '', '', '', '']);
          } else {
            qAnswers.forEach((a) => {
              rows.push([
                q.question_text || '',
                q.file_name || '',
                q.file_url || '',
                a.student_name || 'Anonymous',
                a.answer || '',
                a.file_name || '',
                a.file_url || '',
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
    let answersRevealed = false; // whether students can see all answers

    function setRevealButtonUI(revealed) {
      answersRevealed = revealed;
      if (revealed) {
        showResponsesBtn.textContent = 'Hide Responses';
        showResponsesBtn.classList.remove('btn-amber');
        showResponsesBtn.classList.add('btn-ghost');
      } else {
        showResponsesBtn.textContent = 'Show Responses';
        showResponsesBtn.classList.remove('btn-ghost');
        showResponsesBtn.classList.add('btn-amber');
      }
    }

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
        // Toggle the reveal state in the database.
        // When ON: students see all answers AND teacher modal opens.
        // When OFF: students' answers are hidden again.
        const nextRevealed = !answersRevealed;
        await sb.from('rooms').update({ show_answers: nextRevealed }).eq('room_id', room);
        setRevealButtonUI(nextRevealed);

        if (nextRevealed) {
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
          toast('Responses revealed to students', 'success');
        } else {
          toast('Responses hidden from students', 'success');
        }
      } catch (err) {
        console.error(err);
        toast('Failed to update response visibility', 'error');
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

    // Load initial reveal state and keep it in sync across teacher tabs.
    sb.from('rooms').select('show_answers').eq('room_id', room).single()
      .then(({ data }) => setRevealButtonUI(!!(data && data.show_answers)))
      .catch((err) => console.error('Failed to load reveal state', err));

    sb.channel('rooms-state:' + room)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: 'room_id=eq.' + room,
      }, (payload) => {
        if (typeof payload.new.show_answers === 'boolean') {
          setRevealButtonUI(payload.new.show_answers);
        }
      })
      .subscribe();
  }

  // ---------- Student View ----------
  function initStudent() {
    const room = getQueryParam('room');
    const rawName = getQueryParam('name') || '';
    const name = decodeURIComponent(rawName) || 'Anonymous';
    viewerName = name;

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
    let showAnswers = false; // controlled by teacher via rooms.show_answers
    const answersByQuestion = {}; // questionId -> array of answers

    function updateQuestionCount() {
      questionCountEl.textContent = questionsList.querySelectorAll('.question-card').length;
    }

    function getOwnAnswers(questionId) {
      const list = answersByQuestion[questionId] || [];
      return list.filter((a) => (a.student_name || a.studentName) === name);
    }

    function getAllAnswers(questionId) {
      return answersByQuestion[questionId] || [];
    }

    // Re-render the answer wall for a single question based on reveal state.
    function renderAnswersForQuestion(questionId) {
      const card = questionsList.querySelector('.question-card[data-question-id="' + questionId + '"]');
      if (!card) return;
      const wall = card.querySelector('.answers-wall-inner');
      const countEl = card.querySelector('.answer-count');
      const titleEl = card.querySelector('.section-title.small');
      const all = getAllAnswers(questionId);
      const visible = showAnswers ? all : getOwnAnswers(questionId);

      wall.innerHTML = '';
      // Show most recent first
      visible.slice().reverse().forEach((a) => wall.appendChild(makeAnswerCard(a)));

      if (!showAnswers) {
        const placeholder = document.createElement('div');
        placeholder.className = 'answers-placeholder';
        placeholder.textContent = 'Responses will be revealed by your teacher…';
        wall.appendChild(placeholder);
        if (titleEl) titleEl.firstChild.textContent = 'Your Answer ';
      } else {
        if (titleEl) titleEl.firstChild.textContent = "Classmates' Answers ";
      }

      countEl.textContent = all.length;
    }

    // Apply the teacher-controlled reveal flag and re-render everything.
    function applyRevealState(revealed) {
      showAnswers = !!revealed;
      renderAllAnswers();
    }

    // Re-render every question's answer wall (used when reveal state flips).
    function renderAllAnswers() {
      Object.keys(answersByQuestion).forEach(renderAnswersForQuestion);
    }

    function addAnswerToQuestion(questionId, answer) {
      if (!answersByQuestion[questionId]) answersByQuestion[questionId] = [];
      answersByQuestion[questionId].push(answer);
      renderAnswersForQuestion(questionId);
    }

    function addQuestionCard(q) {
      if (emptyState.parentNode) emptyState.remove();
      questionIndex++;
      const card = makeQuestionCard(q, questionIndex, true);
      questionsList.insertBefore(card, questionsList.firstChild);

      // Wire up the answer submit for this question
      const input = card.querySelector('.answer-input');
      const btn = card.querySelector('.submit-answer-btn');
      const fileInput = card.querySelector('.answer-file-input');
      const fileNameLabel = card.querySelector('.file-picker-name');
      const qid = card.dataset.questionId;

      fileInput.addEventListener('change', () => {
        const f = fileInput.files[0];
        if (f) {
          fileNameLabel.textContent = f.name;
          fileNameLabel.title = f.name;
          fileNameLabel.hidden = false;
        } else {
          fileNameLabel.textContent = '';
          fileNameLabel.title = '';
          fileNameLabel.hidden = true;
        }
      });

      async function submitAnswer() {
        const text = input.value.trim();
        const file = fileInput.files[0];

        if (!text && !file) {
          toast('Please enter an answer or attach a file', 'error');
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Submitting…';
        try {
          let fileUrl = null;
          let fileName = null;

          if (file) {
            const fileExt = file.name.slice(file.name.lastIndexOf('.'));
            const storagePath = room + '/' + qid + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + fileExt;
            const { error: uploadErr } = await sb.storage
              .from('answer-files')
              .upload(storagePath, file, { upsert: false });
            if (uploadErr) throw uploadErr;

            const { data: urlData } = sb.storage.from('answer-files').getPublicUrl(storagePath);
            fileUrl = urlData.publicUrl;
            fileName = file.name;
          }

          await sb.from('answers').insert({
            room_id: room,
            question_id: qid,
            answer: text,
            student_name: name,
            file_url: fileUrl,
            file_name: fileName,
          });

          input.value = '';
          fileInput.value = '';
          fileNameLabel.textContent = '';
          fileNameLabel.hidden = true;
          toast('Answer submitted', 'success');
        } catch (err) {
          console.error(err);
          toast('Failed to submit answer', 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Submit';
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

    // Subscribe to reactions on answers
    sb.channel('reactions:' + room)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'answer_reactions',
      }, (payload) => {
        setReactionFromRow(payload.new);
        refreshAnswerCardInteractions(payload.new.answer_id);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'answer_reactions',
      }, (payload) => {
        removeReactionFromRow(payload.old);
        refreshAnswerCardInteractions(payload.old.answer_id);
      })
      .subscribe();

    // Subscribe to comments on answers
    sb.channel('comments:' + room)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'answer_comments',
      }, (payload) => {
        addComment(payload.new);
        refreshAnswerCardInteractions(payload.new.answer_id);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'answer_comments',
      }, (payload) => {
        removeCommentById(payload.old.id);
        refreshAnswerCardInteractions(payload.old.answer_id);
      })
      .subscribe();

    // Subscribe to teacher toggling answer visibility
    sb.channel('rooms-reveal:' + room)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: 'room_id=eq.' + room,
      }, (payload) => {
        if (typeof payload.new.show_answers === 'boolean') {
          applyRevealState(payload.new.show_answers);
        }
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

    // Load initial state (questions + answers + reveal flag)
    sb.from('rooms').select('show_answers').eq('room_id', room).single()
      .then(({ data }) => {
        if (data && typeof data.show_answers === 'boolean') {
          applyRevealState(data.show_answers);
        }
      })
      .catch((err) => console.error('Failed to load reveal state', err));

    loadReactionsAndComments(room);
    loadQuestions();
  }

  return { initEntry, initTeacher, initStudent };
})();
