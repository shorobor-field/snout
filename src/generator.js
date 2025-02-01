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
    const pins = JSON.parse(data);
    
    // make feed
    const feed = new RSS({
      title: `Snout Digest`,
      description: description || 'Pinterest Curated Feed',
      feed_url: `https://shorobor-field.github.io/snout/feeds/${id}.xml`,
      site_url: "https://pinterest.com",
      image_url: 'https://raw.githubusercontent.com/shorobor-field/snout/main/logo.png',
      managingEditor: 'Raiyan Rahman',
      webMaster: 'Raiyan Rahman',
      copyright: `${new Date().getFullYear()} Snout`,
      language: 'en',
      pubDate: new Date(),
      ttl: '360'
    });

    // Create the HTML content
    const feedHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          margin: 0;
          padding: 20px;
          background-color: #f8f8f8;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        body::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E");
          opacity: 0.4;
          pointer-events: none;
        }
        
        .title {
          font-family: "ITC Garamond Light", Georgia, serif;
          font-size: 3.5em;
          line-height: 1;
          letter-spacing: -0.02em;
          font-weight: 300;
          text-align: center;
          color: #1a1a1a;
          margin-bottom: 0.1em;
        }
        
        .divider {
          text-align: center;
          height: 20px;
          margin: 20px 0;
          position: relative;
          border: none;
        }
        
        .divider::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 20%;
          right: 20%;
          height: 1px;
          background: linear-gradient(to right, 
            transparent, 
            #ddd 10%, 
            #ddd 45%, 
            transparent 50%,
            #ddd 55%,
            #ddd 90%,
            transparent
          );
        }
        
        .divider::after {
          content: "☕";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #f8f8f8;
          padding: 0 20px;
          color: #666;
          font-size: 0.9em;
        }
        
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          padding: 20px;
        }
        
        .pin {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        
        .pin img {
          width: 100%;
          aspect-ratio: 4/3;
          object-fit: cover;
        }
        
        .pin-content {
          padding: 15px;
        }
        
        .pin-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .pin-description {
          margin: 8px 0 0 0;
          font-size: 14px;
          color: #666;
        }
        
        .pin-link {
          display: inline-block;
          margin-top: 12px;
          color: #0066cc;
          text-decoration: none;
          font-size: 14px;
        }
        
        .footer {
          text-align: center;
          font-family: Georgia, serif;
          color: #666;
          margin-top: 40px;
        }
      </style>
    </head>
    <body>
      <h1 class="title">Snout Digest</h1>
      <h2 style="text-align: center; font-family: Georgia, serif;">${title}</h2>
      
      <hr class="divider">
      
      <div class="grid">
        ${pins.map(pin => `
          <div class="pin">
            <img src="${pin.image}" alt="${pin.title}">
            <div class="pin-content">
              <h3 class="pin-title">${pin.title}</h3>
              ${pin.description ? `<p class="pin-description">${pin.description}</p>` : ''}
              <a class="pin-link" href="${pin.url}" target="_blank">View on Pinterest →</a>
            </div>
          </div>
        `).join('')}
      </div>
      
      <hr class="divider">
      
      <div class="footer">
        by Raiyan Rahman, via Claude Sonnet 3.5
      </div>
    </body>
    </html>
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
    await fs.writeFile(
      path.join(feedsPath, `${id}.xml`), 
      feed.xml({indent: true})
    );

    console.log(`✨ generated feed for ${id} with ${pins.length} pins`);
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
            line-height: 1.5;
            color: #333;
        }
        .feed-card {
            border: 1px solid #eee;
            padding: 1.5rem;
            margin: 1rem 0;
            border-radius: 8px;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        h1, h2 {
            margin: 0;
            margin-bottom: 0.5rem;
        }
        p {
            margin: 0;
            margin-bottom: 1rem;
            color: #666;
        }
    </style>
</head>
<body>
    <h1>🐕 snout</h1>
    <p>Curated Pinterest RSS feeds</p>
    
    ${config.feeds.map(feed => `
        <div class="feed-card">
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