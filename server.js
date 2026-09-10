/* ============================================
   Live Classroom Q&A — Static File Server
   (Real-time communication now handled by Supabase)
   ============================================ */
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Live QA server running at http://localhost:${PORT}`);
});
