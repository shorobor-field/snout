// src/generator.js
import RSS from 'rss';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import { dirname } from 'path';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = path.join(__dirname, '..', 'config.json');

// Read config
const config = JSON.parse(readFileSync(configPath, 'utf8'));

function cleanContent(pin) {
  let title = pin.title;
  let desc = pin.description?.trim() || null;
  
  const REF_LENGTH = "This may contain: a painting of a person doing a handstand in front of a red background".length;
  
  if (title?.startsWith('This may contain:')) {
    title = null;
  }
  
  if (title && title.length > REF_LENGTH) {
    title = title.slice(0, REF_LENGTH) + '...';
  }
  
  if (desc && desc.length > REF_LENGTH * 3) {
    desc = desc.slice(0, REF_LENGTH * 3) + '...';
  }
  
  desc = desc?.replace(/::view-transition[^}]+}/g, '').trim() || null;
  
  return { title, desc };
}

async function generateFeed(userId, feedConfig) {
  const { id, title, description, boardUrl } = feedConfig;
  
  try {
    const dataPath = path.join(__dirname, '..', 'data', userId, `${id}.json`);
    const data = await fs.readFile(dataPath, 'utf-8');
    const pins = JSON.parse(data);
    
    const feed = new RSS({
      title: `Snout Digest: ${title}`,
      description: description || 'Pinterest Board Feed',
      feed_url: `https://shorobor-field.github.io/snout/feeds/${userId}/${id}.xml`,
      site_url: boardUrl,
      pubDate: new Date(),
      image_url: `https://shorobor-field.github.io/snout/images/logo.png`,
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
            const { title, desc } = cleanContent(pin);
            return `
              <div style="flex: 1 1 300px; max-width: 400px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <img src="${pin.image}" alt="${title || 'Pin image'}" 
                     style="width: 100%; aspect-ratio: 4/3; object-fit: cover;"
                     onerror="this.style.display='none'">
                <div style="padding: 16px;">
                  ${title ? `<h3 style="margin: 0 0 8px 0; font-size: 18px; color: #1a1a1a;">${title}</h3>` : ''}
                  ${desc ? `<p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">${desc}</p>` : ''}
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
      title: `Snout Digest: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      description: feedHtml,
      url: boardUrl,
      guid: `${id}-${Date.now()}`,
      date: new Date()
    });

    // Create user-specific feeds directory
    const publicPath = path.join(__dirname, '..', 'public');
    const userFeedsPath = path.join(publicPath, 'feeds', userId);
    await fs.mkdir(userFeedsPath, { recursive: true });
    
    const feedPath = path.join(userFeedsPath, `${id}.xml`);
    await fs.writeFile(feedPath, feed.xml({indent: true}));
    console.log(`✨ generated feed at: ${feedPath}`);

  } catch (error) {
    console.error(`💀 failed generating ${userId}/${id}:`, error);
  }
}

async function shouldGenerateFeed(schedule) {
  if (!schedule || schedule.includes('daily')) return true;

  const today = new Date().toLocaleLowerCase('en-us', { weekday: 'long' });
  return schedule.some(day => day.toLowerCase() === today.toLowerCase());
}

async function generateUserFeeds(user) {
  console.log(`\n📡 generating feeds for user ${user.id}...`);
  
  for (const feed of user.feeds) {
    if (await shouldGenerateFeed(feed.schedule)) {
      console.log(`generating ${feed.id} (scheduled for ${feed.schedule?.join(', ')})`);
      await generateFeed(user.id, feed);
    } else {
      console.log(`skipping ${feed.id} (not scheduled for today)`);
    }
  }
}

async function generateAllFeeds() {
  console.log('🌟 generating all feeds...');
  
  for (const user of config.users) {
    await generateUserFeeds(user);
  }
  
  // Create landing page with feeds organized by user
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

        ${config.users.map(user => `
          <div style="margin-bottom: 40px;">
            <h3 style="color: #1a1a1a; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
              ${user.id}'s feeds
            </h3>
            <div style="display: flex; flex-wrap: wrap; gap: 20px;">
              ${user.feeds.map(feed => `
                <div style="flex: 1 1 300px; max-width: 400px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 16px;">
                  <h4 style="margin: 0 0 8px 0; font-size: 18px; color: #1a1a1a;">${feed.title}</h4>
                  ${feed.description ? `<p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">${feed.description}</p>` : ''}
                  ${feed.schedule ? `<p style="margin: 0 0 12px 0; color: #666; font-size: 14px; font-style: italic;">
                    Updates: ${feed.schedule.includes('daily') ? 'Daily' : feed.schedule.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                  </p>` : ''}
                  <a href="./feeds/${user.id}/${feed.id}.xml" style="color: #666; text-decoration: none; font-size: 14px;">
                    Subscribe ↗
                  </a>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}

        <div style="text-align: center; margin-top: 40px; color: #666;">
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p>Last updated: ${new Date().toLocaleString()}</p>
          <p>🐕 woof!</p>
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