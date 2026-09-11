/* ============================================
   Response Viewer Module — Unit Tests
   ============================================ */
const {
  buildResponsePages,
  getPageIndicator,
  getPrevIndex,
  getNextIndex,
  getAnswerCountLabel,
} = require('../js/response-viewer.js');

describe('Response Viewer module', () => {
  // ---------------------------------------------------------------
  // 1. buildResponsePages
  // ---------------------------------------------------------------
  describe('buildResponsePages', () => {
    const questions = [
      { id: 1, question_text: 'Capital of France?', created_at: '2026-01-01T10:00:00Z' },
      { id: 2, question_text: '2+2?', created_at: '2026-01-01T10:05:00Z' },
      { id: 3, question_text: 'Color of sky?', created_at: '2026-01-01T10:10:00Z' },
    ];
    const answers = [
      { id: 101, question_id: 1, answer: 'Paris', student_name: 'Alice' },
      { id: 102, question_id: 1, answer: 'Lyon', student_name: 'Bob' },
      { id: 103, question_id: 2, answer: '4', student_name: 'Alice' },
      // question 3 has no answers
    ];

    test('returns one page per question', () => {
      const pages = buildResponsePages(questions, answers);
      expect(pages).toHaveLength(3);
    });

    test('each page has a question and answers array', () => {
      const pages = buildResponsePages(questions, answers);
      pages.forEach((p) => {
        expect(p).toHaveProperty('question');
        expect(p).toHaveProperty('answers');
        expect(Array.isArray(p.answers)).toBe(true);
      });
    });

    test('answers are matched to their question by question_id', () => {
      const pages = buildResponsePages(questions, answers);
      expect(pages[0].answers).toHaveLength(2);
      expect(pages[0].answers.map((a) => a.answer)).toEqual(['Paris', 'Lyon']);
      expect(pages[1].answers).toHaveLength(1);
      expect(pages[1].answers[0].answer).toBe('4');
      expect(pages[2].answers).toHaveLength(0);
    });

    test('preserves question order', () => {
      const pages = buildResponsePages(questions, answers);
      expect(pages[0].question.id).toBe(1);
      expect(pages[1].question.id).toBe(2);
      expect(pages[2].question.id).toBe(3);
    });

    test('handles empty questions array', () => {
      expect(buildResponsePages([], answers)).toEqual([]);
    });

    test('handles empty answers array', () => {
      const pages = buildResponsePages(questions, []);
      expect(pages).toHaveLength(3);
      pages.forEach((p) => expect(p.answers).toEqual([]));
    });

    test('handles null/undefined inputs gracefully', () => {
      expect(buildResponsePages(null, null)).toEqual([]);
      expect(buildResponsePages(undefined, undefined)).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // 2. getPageIndicator
  // ---------------------------------------------------------------
  describe('getPageIndicator', () => {
    test('returns "Q1 of 3" for index 0, total 3', () => {
      expect(getPageIndicator(0, 3)).toBe('Q1 of 3');
    });

    test('returns "Q3 of 3" for index 2, total 3', () => {
      expect(getPageIndicator(2, 3)).toBe('Q3 of 3');
    });

    test('returns "Q0 of 0" when total is 0', () => {
      expect(getPageIndicator(0, 0)).toBe('Q0 of 0');
    });

    test('clamps negative index to 0', () => {
      expect(getPageIndicator(-5, 3)).toBe('Q1 of 3');
    });

    test('clamps index beyond total to last page', () => {
      expect(getPageIndicator(99, 3)).toBe('Q3 of 3');
    });
  });

  // ---------------------------------------------------------------
  // 3. getPrevIndex / getNextIndex (wrap-around)
  // ---------------------------------------------------------------
  describe('getPrevIndex', () => {
    test('moves to previous index', () => {
      expect(getPrevIndex(2, 5)).toBe(1);
    });

    test('wraps from first to last', () => {
      expect(getPrevIndex(0, 5)).toBe(4);
    });

    test('returns 0 when total is 0', () => {
      expect(getPrevIndex(0, 0)).toBe(0);
    });

    test('returns 0 when total is 1', () => {
      expect(getPrevIndex(0, 1)).toBe(0);
    });
  });

  describe('getNextIndex', () => {
    test('moves to next index', () => {
      expect(getNextIndex(1, 5)).toBe(2);
    });

    test('wraps from last to first', () => {
      expect(getNextIndex(4, 5)).toBe(0);
    });

    test('returns 0 when total is 0', () => {
      expect(getNextIndex(0, 0)).toBe(0);
    });

    test('returns 0 when total is 1', () => {
      expect(getNextIndex(0, 1)).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // 4. getAnswerCountLabel
  // ---------------------------------------------------------------
  describe('getAnswerCountLabel', () => {
    test('returns "0 answers" for count 0', () => {
      expect(getAnswerCountLabel(0)).toBe('0 answers');
    });

    test('returns "1 answer" for count 1', () => {
      expect(getAnswerCountLabel(1)).toBe('1 answer');
    });

    test('returns "5 answers" for count 5', () => {
      expect(getAnswerCountLabel(5)).toBe('5 answers');
    });

    test('handles negative count as 0', () => {
      expect(getAnswerCountLabel(-3)).toBe('0 answers');
    });
  });
});
