const express = require('express');
const path = require('path');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = process.env.VERSION || 'unknown';

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to get version
app.get('/version', (req, res) => {
  res.json({ version: VERSION });
});

// API endpoint to get config data
app.get('/api/config', (req, res) => {
  res.json(config);
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Version: ${VERSION}`);
  console.log('Press Ctrl+C to stop the server');
});