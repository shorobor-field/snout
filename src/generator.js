// src/generator.js
// ... (keep existing imports and functions) ...

async function generateAllFeeds() {
  console.log('📡 generating all feeds...');
  
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
    </style>
    <script>
        function extractBoardId(url) {
            // Handle both full URLs and just board IDs
            const match = url.match(/pinterest\.com\/.*\/(.+?)(\/|$)/);
            return match ? match[1] : url.trim();
        }

        async function addFeed(event) {
            event.preventDefault();
            const form = event.target;
            const boardInput = form.boardId.value;
            const boardId = extractBoardId(boardInput);
            
            if (!boardId) {
                alert('Please enter a valid Pinterest board URL or ID');
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
                    throw new Error('Failed to add feed');
                }
            } catch (error) {
                alert('Error adding feed: ' + error.message);
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