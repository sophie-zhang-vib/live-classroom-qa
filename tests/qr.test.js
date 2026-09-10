/**
 * @jest-environment jsdom
 */

const {
  buildStudentJoinUrl,
  isValidRoomCode,
  getRoomFromQuery,
  generateQrCode,
} = require('../js/qr-utils.js');

describe('QR Code Feature — Unit Tests', () => {
  // ---------------------------------------------------------------
  // 1. buildStudentJoinUrl
  // ---------------------------------------------------------------
  describe('buildStudentJoinUrl', () => {
    test('builds correct URL from teacher.html path', () => {
      const url = buildStudentJoinUrl(
        'https://sophie-zhang-vib.github.io',
        '/live-classroom-qa/teacher.html',
        '123456'
      );
      expect(url).toBe(
        'https://sophie-zhang-vib.github.io/live-classroom-qa/index.html?room=123456'
      );
    });

    test('works with localhost origin', () => {
      const url = buildStudentJoinUrl(
        'http://localhost:3000',
        '/teacher.html',
        '999888'
      );
      expect(url).toBe('http://localhost:3000/index.html?room=999888');
    });

    test('preserves subpath when replacing teacher.html with index.html', () => {
      const url = buildStudentJoinUrl(
        'https://example.com',
        '/sub/dir/teacher.html',
        '000001'
      );
      expect(url).toBe('https://example.com/sub/dir/index.html?room=000001');
    });

    test('appends room code as query param', () => {
      const url = buildStudentJoinUrl(
        'https://example.com',
        '/teacher.html',
        '555555'
      );
      expect(url).toContain('?room=555555');
    });
  });

  // ---------------------------------------------------------------
  // 2. isValidRoomCode
  // ---------------------------------------------------------------
  describe('isValidRoomCode', () => {
    test('accepts a 6-digit numeric code', () => {
      expect(isValidRoomCode('123456')).toBe(true);
    });

    test('rejects a 5-digit code', () => {
      expect(isValidRoomCode('12345')).toBe(false);
    });

    test('rejects a 7-digit code', () => {
      expect(isValidRoomCode('1234567')).toBe(false);
    });

    test('rejects alphanumeric codes', () => {
      expect(isValidRoomCode('abc123')).toBe(false);
    });

    test('rejects empty string', () => {
      expect(isValidRoomCode('')).toBe(false);
    });

    test('rejects null', () => {
      expect(isValidRoomCode(null)).toBe(false);
    });

    test('rejects undefined', () => {
      expect(isValidRoomCode(undefined)).toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // 3. getRoomFromQuery
  // ---------------------------------------------------------------
  describe('getRoomFromQuery', () => {
    test('extracts room code from query string', () => {
      expect(getRoomFromQuery('?room=654321')).toBe('654321');
    });

    test('returns null when room param is absent', () => {
      expect(getRoomFromQuery('?name=Alice')).toBe(null);
    });

    test('returns null for empty query string', () => {
      expect(getRoomFromQuery('')).toBe(null);
    });

    test('extracts room code when other params are present', () => {
      expect(getRoomFromQuery('?room=112233&name=Bob')).toBe('112233');
    });
  });

  // ---------------------------------------------------------------
  // 4. generateQrCode (DOM interaction)
  // ---------------------------------------------------------------
  describe('generateQrCode', () => {
    let container, qrLib;

    beforeEach(() => {
      container = document.createElement('div');
      container.id = 'qrCanvas';
      document.body.appendChild(container);

      qrLib = jest.fn();
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    test('instantiates QRCode with the container element', () => {
      generateQrCode(container, qrLib, 'https://example.com', '/teacher.html', '123456');
      expect(qrLib).toHaveBeenCalledWith(
        container,
        expect.objectContaining({ text: expect.any(String), width: 180, height: 180 })
      );
    });

    test('encodes the correct student join URL', () => {
      let encodedUrl = null;
      qrLib.mockImplementation((_el, opts) => {
        encodedUrl = opts.text;
      });

      generateQrCode(container, qrLib, 'https://example.com', '/teacher.html', '777888');
      expect(encodedUrl).toBe('https://example.com/index.html?room=777888');
    });

    test('returns the encoded URL string', () => {
      const result = generateQrCode(
        container, qrLib, 'https://test.com', '/teacher.html', '111222'
      );
      expect(result).toBe('https://test.com/index.html?room=111222');
    });

    test('returns null when container is missing', () => {
      const result = generateQrCode(null, qrLib, 'https://test.com', '/teacher.html', '111222');
      expect(result).toBeNull();
      expect(qrLib).not.toHaveBeenCalled();
    });

    test('returns null when QR library is missing', () => {
      const result = generateQrCode(container, null, 'https://test.com', '/teacher.html', '111222');
      expect(result).toBeNull();
    });

    test('passes width=180 and height=180 in options', () => {
      generateQrCode(container, qrLib, 'https://test.com', '/teacher.html', '333444');
      const callArgs = qrLib.mock.calls[0];
      expect(callArgs[1].width).toBe(180);
      expect(callArgs[1].height).toBe(180);
    });

    test('passes colorDark and colorLight in options', () => {
      generateQrCode(container, qrLib, 'https://test.com', '/teacher.html', '333444');
      const callArgs = qrLib.mock.calls[0];
      expect(callArgs[1].colorDark).toBe('#1a1a2e');
      expect(callArgs[1].colorLight).toBe('#ffffff');
    });
  });

  // ---------------------------------------------------------------
  // 5. Integration: full flow from URL to QR encoding
  // ---------------------------------------------------------------
  describe('Integration: URL → room validation → QR encoding', () => {
    test('full flow: extract room, validate, build URL, generate QR', () => {
      const queryString = '?room=456789';
      const origin = 'https://sophie-zhang-vib.github.io';
      const teacherPath = '/live-classroom-qa/teacher.html';

      // Step 1: extract room code from query
      const room = getRoomFromQuery(queryString);
      expect(room).toBe('456789');

      // Step 2: validate
      expect(isValidRoomCode(room)).toBe(true);

      // Step 3: build student URL
      const url = buildStudentJoinUrl(origin, teacherPath, room);
      expect(url).toBe(
        'https://sophie-zhang-vib.github.io/live-classroom-qa/index.html?room=456789'
      );

      // Step 4: generate QR
      const container = document.createElement('div');
      const qrLib = jest.fn();
      const result = generateQrCode(container, qrLib, origin, teacherPath, room);
      expect(result).toBe(url);
      expect(qrLib).toHaveBeenCalledWith(
        container,
        expect.objectContaining({ text: url, width: 180, height: 180 })
      );
    });

    test('rejects invalid room code in full flow', () => {
      const room = getRoomFromQuery('?room=abc');
      expect(isValidRoomCode(room)).toBe(false);
    });
  });
});
