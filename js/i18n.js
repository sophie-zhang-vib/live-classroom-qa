/* ============================================
   Live Classroom Q&A — i18n (EN / ZH)
   ============================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'qa-lang';
  var DEFAULT_LANG = 'en';
  var SUPPORTED = ['en', 'zh'];

  var MESSAGES = {
    en: {
      // Language toggle button label (shows the *target* language name)
      'lang.toggleLabel': '中文',

      // Entry page
      'entry.eyebrow': 'Live Classroom Q&A',
      'entry.title': 'Make Every Answer<br/>Seen Instantly',
      'entry.subtitle': 'Teachers post questions, students respond simultaneously, and every answer appears in real time — for a highly interactive classroom experience.',
      'role.teacher': "I'm a Teacher",
      'role.teacher.desc': 'Create a classroom, post questions, and receive student answers in real time.',
      'role.teacher.btn': 'Create Classroom',
      'role.teacher.rejoin.divider': 'or rejoin an existing classroom',
      'role.teacher.rejoin.btn': 'Rejoin',
      'role.student': "I'm a Student",
      'role.student.desc': "Enter a classroom code to join and answer your teacher's questions in real time.",
      'role.student.btn': 'Join Classroom',

      // Placeholders
      'placeholder.classroomCode': 'Classroom Code',
      'placeholder.enterClassroomCode': 'Enter classroom code',
      'placeholder.studentName': 'Your name (optional)',

      // Common
      'common.code': 'Code',
      'common.connected': 'Connected',
      'common.studentsOnline': 'students online',
      'common.allQuestions': 'All Questions',
      'common.anonymous': 'Anonymous',
      'common.send': 'Send',
      'common.submit': 'Submit',
      'common.delete': 'Delete',
      'common.teacher': 'Teacher',

      // Teacher dashboard
      'teacher.postQuestion': 'Post a New Question',
      'teacher.questionPlaceholder': 'Type your question here, e.g. What is the capital of France?',
      'teacher.attachFile': 'Attach file (image, PDF, etc.)',
      'teacher.sameRoomHint': 'Students can answer all questions using the same room code',
      'teacher.postBtn': 'Post Question',
      'teacher.empty': 'No questions yet. Post your first question above to get started.',
      'teacher.onlineStudents': 'Online Students',
      'teacher.questions': 'Questions',
      'teacher.totalAnswers': 'Total Answers',
      'teacher.roomCode': 'Room Code',
      'teacher.showResponses': 'Show Responses',
      'teacher.hideResponses': 'Hide Responses',
      'teacher.exportCsv': 'Export Q&A (CSV)',
      'teacher.scanToJoin': 'Scan to Join',
      'teacher.qrHint': 'Students scan with phone camera',

      // Response viewer
      'rv.previous': 'Previous',
      'rv.next': 'Next',
      'rv.noResponses': 'No responses yet',
      'rv.noQuestions': 'No questions to show',
      'rv.pageIndicator': 'Q{n} of {total}',
      'rv.answerCount': '{n} answers',

      // Student view
      'student.waiting': 'Waiting for teacher to post a question…',
      'student.answerPlaceholder': 'Type your answer…',
      'student.answerAttach': 'Attach file (Word, PDF, image, etc.)',
      'student.answersTitle': 'Answers',
      'student.classmatesAnswers': "Classmates' Answers",
      'student.yourAnswer': 'Your Answer',
      'student.placeholder': 'Responses will be revealed by your teacher…',

      // Answer card
      'answer.commentPlaceholder': 'Write a comment…',

      // Reactions
      'reaction.like': 'Like',
      'reaction.inspiring': 'Inspiring',
      'reaction.surprise': 'Surprise',
      'reaction.comment': 'Comment',

      // Toasts
      'toast.createFailed': 'Failed to create classroom, please try again',
      'toast.invalidCode': 'Please enter a 6-digit classroom code',
      'toast.rejoinFailed': 'Failed to rejoin classroom, please try again',
      'toast.classroomNotFound': 'Classroom not found, please check the code',
      'toast.reactionFailed': 'Failed to update reaction',
      'toast.commentFailed': 'Failed to post comment',
      'toast.questionPosted': 'Question posted',
      'toast.questionDeleted': 'Question deleted',
      'toast.deleteQuestionFailed': 'Failed to delete question',
      'toast.deleteConfirm': 'Delete this question and all its answers?',
      'toast.noExportData': 'No questions to export',
      'toast.exportedRows': 'Exported {n} row(s)',
      'toast.exportFailed': 'Failed to export data',
      'toast.revealed': 'Responses revealed to students',
      'toast.hidden': 'Responses hidden from students',
      'toast.revealFailed': 'Failed to update response visibility',
      'toast.answerRequired': 'Please enter an answer or attach a file',
      'toast.answerSubmitted': 'Answer submitted',
      'toast.answerFailed': 'Failed to submit answer',
      'toast.newQuestion': 'New question received!',
      'toast.submitting': 'Submitting…',
      'toast.questionRequired': 'Please enter a question or attach a file',
      'toast.postFailed': 'Failed to post question'
    },
    zh: {
      'lang.toggleLabel': 'EN',

      'entry.eyebrow': '实时课堂问答',
      'entry.title': '让每一个回答<br/>即刻可见',
      'entry.subtitle': '教师发布问题，学生同步作答，所有回答实时呈现 —— 打造高互动的课堂体验。',
      'role.teacher': '我是老师',
      'role.teacher.desc': '创建课堂、发布问题，并实时接收学生回答。',
      'role.teacher.btn': '创建课堂',
      'role.teacher.rejoin.divider': '或重新进入已有课堂',
      'role.teacher.rejoin.btn': '重入',
      'role.student': '我是学生',
      'role.student.desc': '输入课堂码加入课堂，实时回答老师的问题。',
      'role.student.btn': '加入课堂',

      'placeholder.classroomCode': '课堂码',
      'placeholder.enterClassroomCode': '请输入课堂码',
      'placeholder.studentName': '你的名字（可选）',

      'common.code': '课堂码',
      'common.connected': '已连接',
      'common.studentsOnline': '位学生在线',
      'common.allQuestions': '全部问题',
      'common.anonymous': '匿名',
      'common.send': '发送',
      'common.submit': '提交',
      'common.delete': '删除',
      'common.teacher': '老师',

      'teacher.postQuestion': '发布新问题',
      'teacher.questionPlaceholder': '在此输入问题，例如：法国的首都是哪里？',
      'teacher.attachFile': '附加文件（图片、PDF 等）',
      'teacher.sameRoomHint': '学生可使用同一个课堂码回答所有问题',
      'teacher.postBtn': '发布问题',
      'teacher.empty': '暂无问题。在上方发布第一个问题即可开始。',
      'teacher.onlineStudents': '在线学生',
      'teacher.questions': '问题数',
      'teacher.totalAnswers': '回答总数',
      'teacher.roomCode': '课堂码',
      'teacher.showResponses': '展示回答',
      'teacher.hideResponses': '隐藏回答',
      'teacher.exportCsv': '导出问答 (CSV)',
      'teacher.scanToJoin': '扫码加入',
      'teacher.qrHint': '学生用手机扫码',

      'rv.previous': '上一题',
      'rv.next': '下一题',
      'rv.noResponses': '暂无回答',
      'rv.noQuestions': '暂无可展示的问题',
      'rv.pageIndicator': '第 {n} / {total} 题',
      'rv.answerCount': '{n} 个回答',

      'student.waiting': '等待老师发布问题…',
      'student.answerPlaceholder': '输入你的回答…',
      'student.answerAttach': '附加文件（Word、PDF、图片等）',
      'student.answersTitle': '回答',
      'student.classmatesAnswers': '同学的回答',
      'student.yourAnswer': '你的回答',
      'student.placeholder': '回答将由老师统一公布…',

      'answer.commentPlaceholder': '写下评论…',

      'reaction.like': '点赞',
      'reaction.inspiring': '有启发',
      'reaction.surprise': '惊讶',
      'reaction.comment': '评论',

      'toast.createFailed': '创建课堂失败，请重试',
      'toast.invalidCode': '请输入 6 位课堂码',
      'toast.rejoinFailed': '重入课堂失败，请重试',
      'toast.classroomNotFound': '未找到课堂，请检查课堂码',
      'toast.reactionFailed': '更新反应失败',
      'toast.commentFailed': '评论发送失败',
      'toast.questionPosted': '问题已发布',
      'toast.questionDeleted': '问题已删除',
      'toast.deleteQuestionFailed': '删除问题失败',
      'toast.deleteConfirm': '确定删除此问题及其所有回答吗？',
      'toast.noExportData': '没有可导出的问题',
      'toast.exportedRows': '已导出 {n} 行',
      'toast.exportFailed': '导出失败',
      'toast.revealed': '回答已对学生公开',
      'toast.hidden': '回答已对学生隐藏',
      'toast.revealFailed': '更新显示状态失败',
      'toast.answerRequired': '请输入回答或附加文件',
      'toast.answerSubmitted': '回答已提交',
      'toast.answerFailed': '提交回答失败',
      'toast.newQuestion': '收到新问题！',
      'toast.submitting': '提交中…',
      'toast.questionRequired': '请输入问题或附加文件',
      'toast.postFailed': '发布问题失败'
    }
  };

  function detectLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.indexOf(saved) >= 0) return saved;
    } catch (e) {}
    var nav = (navigator.language || '').toLowerCase();
    if (nav.indexOf('zh') === 0) return 'zh';
    return DEFAULT_LANG;
  }

  var currentLang = detectLang();

  function getLang() { return currentLang; }

  function setLang(lang) {
    if (SUPPORTED.indexOf(lang) < 0) return;
    if (lang === currentLang) return;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    // Reload so dynamically-rendered content picks up the new language
    window.location.reload();
  }

  function toggle() {
    setLang(currentLang === 'en' ? 'zh' : 'en');
  }

  function t(key, params) {
    var dict = MESSAGES[currentLang] || MESSAGES[DEFAULT_LANG];
    var msg = dict[key];
    if (msg == null) {
      msg = MESSAGES[DEFAULT_LANG][key] || key;
    }
    if (params) {
      Object.keys(params).forEach(function (k) {
        msg = msg.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
      });
    }
    return msg;
  }

  function applyTranslations(root) {
    var scope = root || document;
    var nodes;
    nodes = scope.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
    nodes = scope.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < nodes.length; j++) {
      nodes[j].innerHTML = t(nodes[j].getAttribute('data-i18n-html'));
    }
    nodes = scope.querySelectorAll('[data-i18n-ph]');
    for (var k = 0; k < nodes.length; k++) {
      nodes[k].setAttribute('placeholder', t(nodes[k].getAttribute('data-i18n-ph')));
    }
    nodes = scope.querySelectorAll('[data-i18n-title]');
    for (var m = 0; m < nodes.length; m++) {
      nodes[m].setAttribute('title', t(nodes[m].getAttribute('data-i18n-title')));
    }
    document.documentElement.setAttribute('lang', currentLang === 'zh' ? 'zh-CN' : 'en');
  }

  function initToggle() {
    var btns = document.querySelectorAll('[data-lang-toggle]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', toggle);
        var labelEl = btn.querySelector('[data-lang-toggle-label]');
        if (labelEl) {
          labelEl.textContent = currentLang === 'en' ? '中文' : 'EN';
        }
      })(btns[i]);
    }
  }

  function init() {
    initToggle();
    applyTranslations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.i18n = { t: t, getLang: getLang, setLang: setLang, toggle: toggle, applyTranslations: applyTranslations };
})();
