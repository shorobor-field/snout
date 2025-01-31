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

// ... rest of your generator code stays the same ...

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
    const dataPath = path.join(__dirname, '..', 'data', `${id}.json`);
    const data = await fs.readFile(dataPath, 'utf-8');
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
          <img src="${pin.image}" style="width: 100%; max-width: 800px; border-radius: 8px;">
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
        url: `https://pinterest.com/board/${boardId}`,
        guid: `${id}-batch-${index}-${Date.now()}`,
        date: new Date()
      });
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
        input {
            display: block;
            width: 100%;
            padding: 0.75rem;
            margin-bottom: 1rem;
            border: 1px solid #ddd;
            border-radius: 6px;
            box-sizing: border-box;
            font-size: 1rem;
        }
        input:focus {
            outline: none;
            border-color: #0066cc;
            box-shadow: 0 0 0 2px rgba(0,102,204,0.1);
        }
        button {
            width: 100%;
            padding: 0.75rem;
            background: #0066cc;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            transition: background 0.2s;
        }
        button:hover {
            background: #0052a3;
        }
        .note {
            font-size: 0.9rem;
            color: #666;
            margin-top: 0.5rem;
        }
        .error {
            color: #dc2626;
            margin-bottom: 1rem;
            display: none;
        }
    </style>
    <script>
        function extractBoardId(url) {
            // Handle both full URLs and just board IDs
            const match = url.match(/pinterest\.com\\/.*\\/(.+?)(\\/|$)/);
            return match ? match[1] : url.trim();
        }

        async function addFeed(event) {
            event.preventDefault();
            const form = event.target;
            const errorDiv = document.getElementById('error-message');
            errorDiv.style.display = 'none';
            
            const boardInput = form.boardId.value;
            const boardId = extractBoardId(boardInput);
            
            if (!boardId) {
                errorDiv.textContent = 'Please enter a valid Pinterest board URL or ID';
                errorDiv.style.display = 'block';
                return;
            }

            const feedId = boardId.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const title = form.title.value || 'Pinterest Board';

            try {
                const response = await fetch('https://api.github.com/repos/shorobor-field/snout/dispatches', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + form.token.value,
                        'Accept': 'application/vnd.github.v3+json'
                    },
                    body: JSON.stringify({
                        event_type: 'add-feed',
                        client_payload: {
                            feedId,
                            title,
                            boardId,
                            description: form.description.value
                        }
                    })
                });

                if (response.ok) {
                    alert('Feed added! It will be generated in a few minutes.');
                    form.reset();
                } else {
                    const error = await response.text();
                    throw new Error(error);
                }
            } catch (error) {
                errorDiv.textContent = 'Error adding feed: ' + error.message;
                errorDiv.style.display = 'block';
            }
        }
    </script>
</head>
<body>
    <h1>🐕 snout</h1>
    <p>Auto-generated Pinterest RSS feeds (10 high-quality pins per entry)</p>
    
    <div class="add-feed">
        <h2>Add New Feed</h2>
        <form onsubmit="addFeed(event)">
            <div id="error-message" class="error"></div>
            <input 
              type="text" 
              name="boardId" 
              placeholder="Pinterest Board URL or ID" 
              required
            >
            <input 
              type="text" 
              name="title" 
              placeholder="Feed Title (optional)"
            >
            <input 
              type="text" 
              name="description" 
              placeholder="Description (optional)"
            >
            <input 
              type="password" 
              name="token" 
              placeholder="GitHub Token" 
              required
            >
            <button type="submit">Add Feed</button>
            <div class="note">
                Paste a Pinterest board URL or ID and your GitHub token to create a new feed
            </div>
        </form>
    </div>

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