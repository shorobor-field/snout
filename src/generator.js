// src/generator.js
import RSS from 'rss';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '..', 'config.json');

// Read config synchronously at startup
const config = JSON.parse(readFileSync(configPath, 'utf8'));

async function generateFeed(feedConfig) {
  const { id, title, description, boardId } = feedConfig;
  
  try {
    // read scraped data
    const dataPath = path.join(__dirname, '..', 'data', `${id}.json`);
    const data = await fs.readFile(dataPath, 'utf-8');
    console.log('Read data file:', dataPath);
    
    const pins = JSON.parse(data);
    console.log(`Parsed ${pins.length} pins from data`);
    
    // make feed
    const feed = new RSS({
      title: title || 'Pinterest Feed',
      description: description || 'Pinterest Board Feed',
      feed_url: `https://shorobor-field.github.io/snout/feeds/${id}.xml`,
      site_url: "https://pinterest.com",
      pubDate: new Date()
    });

    // Create simple HTML content
    const feedHtml = `
      <div style="font-family: system-ui, -apple-system, sans-serif;">
        <h1>${title}</h1>
        ${pins.map(pin => `
          <div style="margin-bottom: 2rem;">
            <img src="${pin.image}" style="max-width: 100%;">
            <h3>${pin.title}</h3>
            ${pin.description ? `<p>${pin.description}</p>` : ''}
            <a href="${pin.url}">View on Pinterest</a>
          </div>
        `).join('')}
      </div>
    `;

    // Add as a single feed item
    feed.item({
      title: `${title} - Latest Pins`,
      description: feedHtml,
      url: `https://pinterest.com/board/${boardId}`,
      guid: `${id}-${Date.now()}`,
      date: new Date(),
      author: 'Raiyan Rahman'
    });

    // ensure feeds dir exists
    const publicPath = path.join(__dirname, '..', 'public');
    const feedsPath = path.join(publicPath, 'feeds');
    await fs.mkdir(feedsPath, { recursive: true });
    
    // save feed
    const feedPath = path.join(feedsPath, `${id}.xml`);
    await fs.writeFile(feedPath, feed.xml({indent: true}));
    console.log(`✨ generated feed at: ${feedPath}`);

  } catch (error) {
    console.error(`💀 failed generating ${id}:`, error);
  }
}

async function generateAllFeeds() {
  console.log('📡 generating all feeds...');
  
  // generate each feed in config
  for (const feed of config.feeds) {
    await generateFeed(feed);
  }
  
  // Create simple index page
  const indexHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>snout 🐕</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 800px;
          margin: 2rem auto;
          padding: 0 1rem;
        }
        .feed {
          border: 1px solid #eee;
          padding: 1rem;
          margin: 1rem 0;
          border-radius: 8px;
        }
      </style>
    </head>
    <body>
      <h1>🐕 snout</h1>
      <p>Pinterest RSS feeds</p>
      
      ${config.feeds.map(feed => `
        <div class="feed">
          <h2>${feed.title}</h2>
          ${feed.description ? `<p>${feed.description}</p>` : ''}
          <a href="./feeds/${feed.id}.xml">Subscribe to RSS feed</a>
        </div>
      `).join('')}

      <footer style="margin-top: 2rem; color: #666;">
        <p>Last updated: ${new Date().toLocaleString()}</p>
      </footer>
    </body>
    </html>
  `;

  const publicPath = path.join(__dirname, '..', 'public');
  await fs.mkdir(publicPath, { recursive: true });
  await fs.writeFile(path.join(publicPath, 'index.html'), indexHtml);
  
  console.log('✨ all feeds generated!');
}

generateAllFeeds();