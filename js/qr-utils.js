/**
 * QR Code utility functions — extracted for unit testing.
 *
 * These pure functions mirror the logic in app.js so it can be tested
 * without a browser or Supabase connection.
 */

/**
 * Build the student join URL that gets encoded into the QR code.
 *
 * @param {string} origin       - window.location.origin (e.g. "https://example.com")
 * @param {string} teacherPath  - window.location.pathname (e.g. "/teacher.html")
 * @param {string} room         - 6-digit room code
 * @returns {string} full URL for QR encoding
 */
function buildStudentJoinUrl(origin, teacherPath, room) {
  var studentPath = teacherPath.replace('teacher.html', 'index.html');
  return origin + studentPath + '?room=' + room;
}

/**
 * Validate that a string is a 6-digit numeric room code.
 *
 * @param {string} code
 * @returns {boolean}
 */
function isValidRoomCode(code) {
  return /^\d{6}$/.test(code);
}

/**
 * Extract the room code from a URL query string.
 *
 * @param {string} queryString - e.g. "?room=123456"
 * @returns {string|null}
 */
function getRoomFromQuery(queryString) {
  var params = new URLSearchParams(queryString);
  return params.get('room');
}

/**
 * Simulate the QR code generation flow: check canvas + QRCode lib exist,
 * then call QRCode.toCanvas with the correct URL.
 *
 * @param {HTMLElement} canvas  - canvas element
 * @param {object} qrLib        - QRCode library (must have toCanvas)
 * @param {string} origin       - window.location.origin
 * @param {string} teacherPath  - window.location.pathname
 * @param {string} room        - room code
 * @returns {string|null} the URL that was encoded, or null if skipped
 */
function generateQrCode(canvas, qrLib, origin, teacherPath, room) {
  if (!canvas || !qrLib) return null;
  var url = buildStudentJoinUrl(origin, teacherPath, room);
  qrLib.toCanvas(canvas, url, { width: 180, margin: 2 }, function () {});
  return url;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildStudentJoinUrl: buildStudentJoinUrl,
    isValidRoomCode: isValidRoomCode,
    getRoomFromQuery: getRoomFromQuery,
    generateQrCode: generateQrCode,
  };
}
