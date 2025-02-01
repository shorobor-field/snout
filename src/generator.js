// src/generator.js
import RSS from 'rss';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '..', 'config.json');

// Read config
const config = JSON.parse(readFileSync(configPath, 'utf8'));

function cleanContent(pin) {
  // ... existing cleanContent function ...
}

async function generateFeed(feedConfig) {
  // ... existing generateFeed function ...
}

async function generateAllFeeds() {
  console.log('📡 generating all feeds...');
  
  const today = new Date().toLocaleLowerCase('en-US', { weekday: 'monday' });
  
  for (const feed of config.feeds) {
    if (feed.schedule && feed.schedule[today]) {
      await generateFeed(feed);
    } else {
      console.log(`skipping ${feed.id} - not scheduled for ${today}`);
    }
  }
  
  // Create landing page with management UI
  const indexHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>snout 🐕</title>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300&display=swap" rel="stylesheet">
      <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
      <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://cdn.jsdelivr.net/npm/@radix-ui/themes@2.0.0/styles.css" rel="stylesheet" />
    </head>
    <body style="margin: 0; padding: 20px; font-family: Georgia, serif; background: #f8f8f8;">
      <div style="max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 3em; color: #1a1a1a; margin: 0; font-weight: 300;">🐕 snout</h1>
          <h2 style="font-weight: normal; color: #666; margin: 10px 0;">Pinterest RSS feeds</h2>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        </div>
        
        <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;">
          ${config.feeds.map(feed => `
            <div style="flex: 1 1 300px; max-width: 400px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 16px;">
              <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #1a1a1a;">${feed.title}</h3>
              ${feed.description ? `<p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">${feed.description}</p>` : ''}
              <p class="text-sm text-gray-500">Published on: ${Object.entries(feed.schedule)
                .filter(([_, enabled]) => enabled)
                .map(([day]) => day)
                .join(', ')}</p>
              <a href="./feeds/${feed.id}.xml" style="color: #666; text-decoration: none; font-size: 14px;">
                Subscribe ↗
              </a>
            </div>
          `).join('')}
        </div>

        <div id="feed-manager"></div>

        <div style="text-align: center; margin-top: 40px; color: #666;">
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p>Last updated: ${new Date().toLocaleString()}</p>
          <p>🐕 woof!</p>
        </div>
      </div>

      <script type="text/babel">
        ${feedManagerCode}  // We'll need to read this from the FeedManager.jsx file
        
        ReactDOM.render(
          <FeedManager />,
          document.getElementById('feed-manager')
        );
      </script>
    </body>
    </html>
  `;

  const publicPath = path.join(__dirname, '..', 'public');
  await fs.mkdir(publicPath, { recursive: true });
  await fs.writeFile(path.join(publicPath, 'index.html'), indexHtml);
  
  console.log('✨ all feeds generated!');
}

generateAllFeeds();