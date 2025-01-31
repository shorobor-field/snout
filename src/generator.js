// src/generator.js
import RSS from 'rss';
import fs from 'fs/promises';
import path from 'path';
import config from '../config.json' assert { type: 'json' };

async function generateFeed(feedConfig) {
  const { id, title, description, boardId } = feedConfig;
  
  try {
    // read scraped data
    const data = await fs.readFile(`./data/${id}.json`, 'utf-8');
    const pins = JSON.parse(data);

    // make feed
    const feed = new RSS({
      title,
      description,
      feed_url: `https://shorobor-field.github.io/snout/feeds/${id}.xml`,
      site_url: "https://pinterest.com",
    });

    // add pins to feed
    pins.forEach(pin => {
      feed.item({
        title: pin.title,
        description: `
          <div style="padding: 1rem;">
            <img src="${pin.image}" style="width: 100%; border-radius: 8px;">
            ${pin.description ? `<p style="margin-top: 1rem;">${pin.description}</p>` : ''}
          </div>
        `,
        url: pin.url,
        guid: pin.id,
        date: new Date()
      });
    });

    // ensure feeds dir exists
    await fs.mkdir('./public/feeds', { recursive: true });
    
    // save feed
    await fs.writeFile(
      `./public/feeds/${id}.xml`, 
      feed.xml({indent: true})
    );

    console.log(`✨ generated feed for ${id}`);
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
  
  // generate simple index page
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
        }
        .feed-card {
            border: 1px solid #eee;
            padding: 1.5rem;
            margin: 1rem 0;
            border-radius: 8px;
        }
        .feed-card h2 {
            margin: 0;
            margin-bottom: 0.5rem;
        }
        .feed-card p {
            margin: 0;
            margin-bottom: 1rem;
            color: #666;
        }
        .feed-card a {
            color: #0066cc;
            text-decoration: none;
        }
        .feed-card a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <h1>🐕 snout</h1>
    <p>Auto-generated Pinterest RSS feeds:</p>
    
    ${config.feeds.map(feed => `
        <div class="feed-card">
            <h2>${feed.title}</h2>
            <p>${feed.description || ''}</p>
            <a href="./feeds/${feed.id}.xml">Subscribe to RSS feed</a>
        </div>
    `).join('')}

    <footer style="margin-top: 2rem; color: #666;">
        <p>Last updated: ${new Date().toLocaleString()}</p>
    </footer>
</body>
</html>
  `;

  await fs.writeFile('./public/index.html', indexHtml);
  
  console.log('✨ all feeds generated!');
}

generateAllFeeds();