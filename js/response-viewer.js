/* ============================================
   Response Viewer — Presentation Mode Logic
   Pure functions for paginating questions & answers
   ============================================ */

/**
 * Build a list of "pages", one per question, each carrying the question
 * object and its associated answers.
 *
 * @param {Array} questions - array of question objects (must have `id`)
 * @param {Array} answers   - array of answer objects (must have `question_id`)
 * @returns {Array<{question: object, answers: Array}>}
 */
function buildResponsePages(questions, answers) {
  var qs = Array.isArray(questions) ? questions : [];
  var as = Array.isArray(answers) ? answers : [];
  return qs.map(function (q) {
    return {
      question: q,
      answers: as.filter(function (a) { return a.question_id === q.id; }),
    };
  });
}

/**
 * Return the page indicator string, e.g. "Q2 of 5".
 *
 * @param {number} currentIndex - 0-based index of current page
 * @param {number} totalPages   - total number of pages
 * @returns {string}
 */
function getPageIndicator(currentIndex, totalPages) {
  var safeTotal = Math.max(0, totalPages | 0);
  if (safeTotal === 0) return 'Q0 of 0';
  var safeIndex = Math.min(Math.max(0, currentIndex | 0), safeTotal - 1);
  return 'Q' + (safeIndex + 1) + ' of ' + safeTotal;
}

/**
 * Compute the previous index (wraps around to the last page).
 */
function getPrevIndex(currentIndex, totalPages) {
  var safeTotal = Math.max(0, totalPages | 0);
  if (safeTotal <= 1) return 0;
  var safeIndex = Math.min(Math.max(0, currentIndex | 0), safeTotal - 1);
  return (safeIndex - 1 + safeTotal) % safeTotal;
}

/**
 * Compute the next index (wraps around to the first page).
 */
function getNextIndex(currentIndex, totalPages) {
  var safeTotal = Math.max(0, totalPages | 0);
  if (safeTotal <= 1) return 0;
  var safeIndex = Math.min(Math.max(0, currentIndex | 0), safeTotal - 1);
  return (safeIndex + 1) % safeTotal;
}

/**
 * Pluralize "answer" → "answers" when count !== 1.
 * @param {number} count
 * @returns {string}
 */
function getAnswerCountLabel(count) {
  var n = Math.max(0, count | 0);
  return n === 1 ? '1 answer' : n + ' answers';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildResponsePages: buildResponsePages,
    getPageIndicator: getPageIndicator,
    getPrevIndex: getPrevIndex,
    getNextIndex: getNextIndex,
    getAnswerCountLabel: getAnswerCountLabel,
  };
}
