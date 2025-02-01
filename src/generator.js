// src/generator.js
import RSS from 'rss';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '..', 'config.json');

const config = JSON.parse(readFileSync(configPath, 'utf8'));

function cleanDescription(desc) {
  if (!desc) return null;
  
  // Remove pinterest's image recognition text
  if (desc.includes('may contain:')) return null;
  
  // Remove CSS transition stuff
  desc = desc.replace(/::view-transition[^}]+}/g, '');
  
  // Clean up whitespace
  desc = desc.trim();
  
  // Truncate if needed
  if (desc.length > 20) {
    desc = desc.slice(0, 20) + '...';
  }
  
  return desc || null;
}

async function generateFeed(feedConfig) {
  const { id, title, description, boardId } = feedConfig;
  
  try {
    const dataPath = path.join(__dirname, '..', 'data', `${id}.json`);
    const data = await fs.readFile(dataPath, 'utf-8');
    console.log('Read data file:', dataPath);
    
    const pins = JSON.parse(data);
    console.log(`Parsed ${pins.length} pins from data`);
    
    const feed = new RSS({
      title: title || 'Pinterest Feed',
      description: description || 'Pinterest Board Feed',
      feed_url: `https://shorobor-field.github.io/snout/feeds/${id}.xml`,
      site_url: "https://pinterest.com",
      pubDate: new Date()
    });

    const feedHtml = `
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300&display=swap" rel="stylesheet">

      <div style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: Georgia, serif;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 3em; color: #1a1a1a; margin: 0; font-weight: 300;">${title}</h1>
          ${description ? `<h2 style="font-weight: normal; color: #666; margin: 10px 0;">${description}</h2>` : ''}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;">
          ${pins.map(pin => {
            const cleanDesc = cleanDescription(pin.description);
            return `
              <div style="flex: 1 1 300px; max-width: 400px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <img src="${pin.image}" alt="${pin.title}" 
                     style="width: 100%; aspect-ratio: 4/3; object-fit: cover;"
                     onerror="this.style.display='none'">
                <div style="padding: 16px;">
                  <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #1a1a1a;">${pin.title}</h3>
                  ${cleanDesc ? `<p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">${cleanDesc}</p>` : ''}
                  <a href="${pin.url}" style="color: #666; text-decoration: none; font-size: 14px;">
                    Open ↗
                  </a>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="text-align: center; margin-top: 40px; color: #666;">
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p>🐕 woof woof!</p>
        </div>
      </div>
    `;

    feed.item({
      title: `${title} - Latest Pins`,
      description: feedHtml,
      url: `https://pinterest.com/board/${boardId}`,
      guid: `${id}-${Date.now()}`,
      date: new Date()
    });

    const publicPath = path.join(__dirname, '..', 'public');
    const feedsPath = path.join(publicPath, 'feeds');
    await fs.mkdir(feedsPath, { recursive: true });
    
    const feedPath = path.join(feedsPath, `${id}.xml`);
    await fs.writeFile(feedPath, feed.xml({indent: true}));
    console.log(`✨ generated feed at: ${feedPath}`);

  } catch (error) {
    console.error(`💀 failed generating ${id}:`, error);
  }
}

async function generateAllFeeds() {
  console.log('📡 generating all feeds...');
  
  for (const feed of config.feeds) {
    await generateFeed(feed);
  }
  
  // Landing page HTML stays mostly the same, just updated the link text
  const indexHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>snout 🐕</title>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300&display=swap" rel="stylesheet">
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
              <a href="./feeds/${feed.id}.xml" style="color: #666; text-decoration: none; font-size: 14px;">
                Subscribe ↗
              </a>
            </div>
          `).join('')}
        </div>

        <div style="text-align: center; margin-top: 40px; color: #666;">
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p>Last updated: ${new Date().toLocaleString()}</p>
          <p>🐕 woof woof!</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const publicPath = path.join(__dirname, '..', 'public');
  await fs.mkdir(publicPath, { recursive: true });
  await fs.writeFile(path.join(publicPath, 'index.html'), indexHtml);
  
  console.log('✨ all feeds generated!');
}

generateAllFeeds();