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

function formatDate(date) {
  return date.toLocaleDateString('en-US', { 
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

async function generateFeed(feedConfig) {
  const { id, title, description, boardId } = feedConfig;
  
  try {
    const dataPath = path.join(__dirname, '..', 'data', `${id}.json`);
    const data = await fs.readFile(dataPath, 'utf-8');
    const allPins = JSON.parse(data);

    // Deduplicate pins based on pin ID
    const uniquePins = Object.values(
      allPins.reduce((acc, pin) => {
        if (!acc[pin.id]) {
          acc[pin.id] = pin;
        }
        return acc;
      }, {})
    );

    // Take only the first 20 unique pins
    const pins = uniquePins.slice(0, 20);

    // Create pin grid HTML
    const pinRows = [];
    for (let i = 0; i < pins.length; i += 2) {
      const pin1 = pins[i];
      const pin2 = pins[i + 1];
      
      pinRows.push(`
        <div class="grid-row">
          <div class="grid-cell">
            <div class="image-container">
              <img src="${pin1.image}" alt="${pin1.title}">
            </div>
            <div class="content">
              <h3>${pin1.title}</h3>
              ${pin1.description ? `<p>${pin1.description}</p>` : ''}
            </div>
          </div>
          ${pin2 ? `
            <div class="grid-cell">
              <div class="image-container">
                <img src="${pin2.image}" alt="${pin2.title}">
              </div>
              <div class="content">
                <h3>${pin2.title}</h3>
                ${pin2.description ? `<p>${pin2.description}</p>` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      `);
    }

    const currentDate = new Date();
    const contentHtml = `
      <!DOCTYPE html>
      <html>
      <head>
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

          .corner-fold {
            position: absolute;
            top: 0;
            right: 0;
            width: 40px;
            height: 40px;
            background: linear-gradient(225deg, transparent 50%, rgba(0,0,0,0.05) 50%);
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

          h2 {
            text-align: center;
            font-family: Georgia, serif;
          }

          .date {
            font-family: "ITC Garamond Light", Georgia, serif;
            text-align: center;
            color: #666;
            margin-bottom: 1.5em;
            font-size: 1.1em;
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
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f8f8f8;
            padding: 0 20px;
            color: #666;
            font-size: 0.9em;
          }

          .divider.top::after {
            content: "☕";
          }

          .divider.bottom::after {
            content: "📰";
          }

          .grid {
            display: table;
            width: 100%;
            border-collapse: separate;
            border-spacing: 10px;
          }

          .grid-row {
            display: table-row;
          }

          .grid-cell {
            display: table-cell;
            width: 50%;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            vertical-align: top;
            position: relative;
          }

          .image-container {
            position: relative;
            width: 100%;
            height: 300px;
            overflow: hidden;
          }

          .image-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .content {
            padding: 12px;
          }

          .content h3 {
            margin: 0 0 4px 0;
            font-size: 16px;
          }

          .content p {
            margin: 0;
            font-size: 14px;
            color: #666;
          }

          .footer {
            text-align: center;
            font-family: Georgia, serif;
            color: #666;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="corner-fold"></div>
        
        <h1 class="title">Snout Digest</h1>
        <h2>${title}</h2>
        <div class="date">${formatDate(currentDate)}</div>
        
        <hr class="divider top">
        
        <div class="grid">
          ${pinRows.join('\n')}
        </div>
        
        <hr class="divider bottom">
        
        <div class="footer">
          via Snout RSS
        </div>
      </body>
      </html>
    `;

    // make feed
    const feed = new RSS({
      title,
      description,
      feed_url: `https://shorobor-field.github.io/snout/feeds/${id}.xml`,
      site_url: "https://pinterest.com",
      pubDate: currentDate
    });

    // Add as single item
    feed.item({
      title: `${title} - ${formatDate(currentDate)}`,
      description: contentHtml,
      url: `https://pinterest.com/board/${boardId}`,
      guid: `${id}-${Date.now()}`,
      date: currentDate
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

    console.log(`✨ generated feed for ${id} with ${pins.length} unique pins`);
  } catch (error) {
    console.error(`💀 failed generating ${id}:`, error);
  }
}

async function generateAllFeeds() {
  console.log('📡 generating all feeds...');
  
  for (const feed of config.feeds) {
    await generateFeed(feed);
  }
  
  // ... rest of the index.html generation code stays the same ...
}

generateAllFeeds();