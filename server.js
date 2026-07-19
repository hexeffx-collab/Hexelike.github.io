// server.js
const express = require('express');
const path = require('path');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple rate limiter (very small) to avoid accidental spamming
let lastRequestAt = 0;
const MIN_INTERVAL_MS = 2000; // 2s between requests, tweak as needed

app.post('/api/send-link', async (req, res) => {
  try {
    const now = Date.now();
    if (now - lastRequestAt < MIN_INTERVAL_MS) {
      return res.status(429).json({ error: 'Too many requests. Slow down.' });
    }
    lastRequestAt = now;

    const { postUrl } = req.body;
    if (!postUrl || typeof postUrl !== 'string' || !postUrl.startsWith('https://www.instagram.com/')) {
      return res.status(400).json({ error: 'Invalid postUrl' });
    }

    // Normalize like the frontend
    const normalized = postUrl.replace('/reel/','/p/').replace('/reels/','/p/').replace('/tv/','/p/');

    // Build payload - you must adapt field names to the target's expected form keys
    // Example: sending as form-data (application/x-www-form-urlencoded)
    const payload = new URLSearchParams();
    payload.append('link', normalized);
    // payload.append('instagram_username', 'example'); // uncomment/modify if required
    // payload.append('email', 'example@example.com'); // if required

    // Example headers - adjust if target expects different headers
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Node.js backend)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    };

    // Forward to the target URL (server-to-server)
    const targetUrl = 'https://nakrutka.com/my/freelikes.php';
    const response = await axios.post(targetUrl, payload.toString(), { headers, timeout: 15000, maxRedirects: 5 });

    // Return success if the target returned 2xx. Optionally parse response.data to detect success message.
    if (response.status >= 200 && response.status < 300) {
      // Inspect response.data to decide success/failure—here we just return raw snippet length.
      return res.json({ message: 'Forwarded to target site', statusCode: response.status, snippetLength: (response.data || '').toString().length });
    } else {
      return res.status(502).json({ error: 'Upstream site responded with non-success status', status: response.status });
    }
  } catch (err) {
    // If axios returns an error, include safe diagnostic info
    const msg = err.response ? `Upstream status ${err.response.status}` : err.message;
    return res.status(500).json({ error: 'Failed to forward link', details: msg });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log('Open your browser to view the form.');
});
