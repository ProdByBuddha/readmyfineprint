import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5173;

// Simple dev index.html that loads React in development mode
const devIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ReadMyFinePrint - Development</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body>
    <div id="root"></div>
    <script type="text/babel" data-type="module">
      // Simple React app for development
      const { useState } = React;
      
      function App() {
        return React.createElement('div', { className: 'p-8' }, 
          React.createElement('h1', { className: 'text-2xl font-bold mb-4' }, 'ReadMyFinePrint - Development Mode'),
          React.createElement('p', { className: 'text-gray-600' }, 'Development server is running. Build the application for production.')
        );
      }
      
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App));
    </script>
</body>
</html>`;

// Serve the dev index for the root path
app.get('/', (req, res) => {
  res.send(devIndexHtml);
});

// Serve static files from client/public for all other requests
app.use(express.static(path.join(__dirname, 'client', 'public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Development server running on http://0.0.0.0:${PORT}`);
});