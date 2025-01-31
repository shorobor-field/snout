// src/generator.js
import RSS from 'rss';
import fs from 'fs/promises';
import path from 'path';
import config from '../config.json' assert { type: 'json' };

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

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

    // batch pins into groups of 10
    const batches = chunkArray(pins, 10);
    
    // add each batch as a single item
    batches.forEach((batch, index) => {
      const batchHtml = batch.map(pin => `
        <div style="margin-bottom: 2rem; padding: 1rem; border-bottom: 1px solid #eee;">
          <img src="${pin.image}" style="width: 100%; max-width: 600px; border-radius: 8px;">
          <h3 style="margin: 1rem 0;">${pin.title}</h3>
          ${pin.description ? `<p style="margin: 1rem 0;">${pin.description}</p>` : ''}
          <a href="${pin.url}" style="color: #0066cc; text-decoration: none;">View on Pinterest</a>
        </div>
      `).join('\n');

      feed.item({
        title: `${title} - Batch ${index + 1}`,
        description: `
          <div style="font-family: system-ui, sans-serif;">
            ${batchHtml}
          </div>
        `,
        url: `https://pinterest.com/pin/${boardId}`,
        guid: `${id}-batch-${index}-${Date.now()}`,
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

    console.log(`✨ generated feed for ${id} with ${batches.length} batches`);
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
  
  // generate index page
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
    </style>
</head>
<body>
    <h1>🐕 snout</h1>
    <p>Auto-generated Pinterest RSS feeds: (10 pins per entry)</p>
    
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