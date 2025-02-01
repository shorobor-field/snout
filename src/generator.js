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

    // Remove duplicates based on pin ID
    const uniquePins = [...new Map(pins.map(pin => [pin.id, pin])).values()];
    
    // Take only the first 20 unique pins
    const selectedPins = uniquePins.slice(0, 20);

    // make feed
    const feed = new RSS({
      title,
      description,
      feed_url: `https://shorobor-field.github.io/snout/feeds/${id}.xml`,
      site_url: "https://pinterest.com",
      pubDate: new Date()
    });

    // Create single batch of 20 items
    const batchHtml = selectedPins.map(pin => `
      <div style="margin-bottom: 2rem; padding: 1rem; border-bottom: 1px solid #eee;">
        <img src="${pin.image}" style="width: 100%; max-width: 800px; border-radius: 8px;">
        <h3 style="margin: 1rem 0;">${pin.title}</h3>
        ${pin.description ? `<p style="margin: 1rem 0;">${pin.description}</p>` : ''}
        <a href="${pin.url}" style="color: #0066cc; text-decoration: none;">View on Pinterest</a>
      </div>
    `).join('\n');

    // Add as a single feed item
    feed.item({
      title: `${title} - Latest Pins`,
      description: `
        <div style="font-family: system-ui, sans-serif;">
          ${batchHtml}
        </div>
      `,
      url: `https://pinterest.com/board/${boardId}`,
      guid: `${id}-${Date.now()}`,
      date: new Date()
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

    console.log(`✨ generated feed for ${id} with ${selectedPins.length} unique pins`);
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
        .feed-card, .add-feed {
            border: 1px solid #eee;
            padding: 1.5rem;
            margin: 1rem 0;
            border-radius: 8px;
            background: white;
        }
        .add-feed {
            background: #f8f9fa;
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
    <p>Auto-generated Pinterest RSS feeds (20 unique pins per feed)</p>
    
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