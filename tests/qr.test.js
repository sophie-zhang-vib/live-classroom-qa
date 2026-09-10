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
    let canvas, qrLib;

    beforeEach(() => {
      canvas = document.createElement('canvas');
      canvas.id = 'qrCanvas';
      document.body.appendChild(canvas);

      qrLib = {
        toCanvas: jest.fn(),
      };
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    test('calls QRCode.toCanvas with the canvas element', () => {
      generateQrCode(canvas, qrLib, 'https://example.com', '/teacher.html', '123456');
      expect(qrLib.toCanvas).toHaveBeenCalledWith(
        canvas,
        expect.any(String),
        expect.objectContaining({ width: 180, margin: 2 }),
        expect.any(Function)
      );
    });

    test('encodes the correct student join URL', () => {
      let encodedUrl = null;
      qrLib.toCanvas.mockImplementation((_c, url, _opts, _cb) => {
        encodedUrl = url;
      });

      generateQrCode(canvas, qrLib, 'https://example.com', '/teacher.html', '777888');
      expect(encodedUrl).toBe('https://example.com/index.html?room=777888');
    });

    test('returns the encoded URL string', () => {
      const result = generateQrCode(
        canvas, qrLib, 'https://test.com', '/teacher.html', '111222'
      );
      expect(result).toBe('https://test.com/index.html?room=111222');
    });

    test('returns null when canvas is missing', () => {
      const result = generateQrCode(null, qrLib, 'https://test.com', '/teacher.html', '111222');
      expect(result).toBeNull();
      expect(qrLib.toCanvas).not.toHaveBeenCalled();
    });

    test('returns null when QR library is missing', () => {
      const result = generateQrCode(canvas, null, 'https://test.com', '/teacher.html', '111222');
      expect(result).toBeNull();
    });

    test('passes width=180 in options', () => {
      generateQrCode(canvas, qrLib, 'https://test.com', '/teacher.html', '333444');
      const callArgs = qrLib.toCanvas.mock.calls[0];
      expect(callArgs[2].width).toBe(180);
    });

    test('passes margin=2 in options', () => {
      generateQrCode(canvas, qrLib, 'https://test.com', '/teacher.html', '333444');
      const callArgs = qrLib.toCanvas.mock.calls[0];
      expect(callArgs[2].margin).toBe(2);
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
      const canvas = document.createElement('canvas');
      const qrLib = { toCanvas: jest.fn() };
      const result = generateQrCode(canvas, qrLib, origin, teacherPath, room);
      expect(result).toBe(url);
      expect(qrLib.toCanvas).toHaveBeenCalledWith(
        canvas,
        url,
        expect.objectContaining({ width: 180 }),
        expect.any(Function)
      );
    });

    test('rejects invalid room code in full flow', () => {
      const room = getRoomFromQuery('?room=abc');
      expect(isValidRoomCode(room)).toBe(false);
    });
  });
});
