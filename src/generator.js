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
const config = JSON.parse(readFileSync(configPath, 'utf8'));

function cleanContent(pin) {
  let title = pin.title;
  let desc = pin.description?.trim() || null;
  const REF_LENGTH = 120;
  
  if (title?.startsWith('This may contain:')) title = null;
  if (title?.length > REF_LENGTH) title = title.slice(0, REF_LENGTH) + '...';
  if (desc?.length > REF_LENGTH * 2) desc = desc.slice(0, REF_LENGTH * 2) + '...';
  desc = desc?.replace(/::view-transition[^}]+}/g, '').trim() || null;
  
  return { title, desc };
}

function makeErrorHtml(error) {
  const messages = {
    AUTH_ERROR: 'Pinterest session has expired or is invalid.',
    SCRAPE_ERROR: 'Unable to fetch new pins from Pinterest board.',
    UNKNOWN_ERROR: 'An unknown error occurred while updating the feed.'
  };

  return `
    <div style="padding: 2rem; text-align: center; font-family: system-ui;">
      <h2 style="color: #e11d48;">🚨 Feed Update Failed</h2>
      <p>${messages[error.error] || messages.UNKNOWN_ERROR}</p>
      <p>Please check the configuration and try again.</p>
      <p style="color: #666; font-size: 0.9rem;">
        Error occurred at: ${new Date(error.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}
      </p>
    </div>
  `;
}

function makePinsHtml(pins, feedConfig) {
  return `
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300&display=swap" rel="stylesheet">
    <div style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: Georgia, serif;">
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-family: 'Cormorant Garamond', serif; font-size: 3em; color: #1a1a1a; margin: 0; font-weight: 300;">
          ${feedConfig.title}
        </h1>
        ${feedConfig.description ? 
          `<h2 style="font-weight: normal; color: #666; margin: 10px 0;">${feedConfig.description}</h2>` 
          : ''
        }
      </div>

      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

      <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;">
        ${pins.map(pin => {
          const { title, desc } = cleanContent(pin);

          return `
            <div style="flex: 1 1 300px; max-width: 400px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <img src="${pin.image}" alt="${title || 'Pin image'}" 
                   style="width: 100%; object-fit: contain; max-height: 600px; background: #f0f0f0;"
                   onerror="this.style.display='none'">
              <div style="padding: 16px;">
                ${title ? `<h3 style="margin: 0 0 8px 0; font-size: 18px; color: #1a1a1a;">${title}</h3>` : ''}
                ${desc ? `<p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">${desc}</p>` : ''}
                <div style="text-align: left;">
                  <a href="${pin.url}" style="color: #666; text-decoration: none; font-size: 14px;">Open ↗</a>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="text-align: center; color: #666;">🐕 woof woof!</p>
    </div>
  `;
}

async function generateFeed(userId, feedConfig) {
  const { id, title, description, boardUrl } = feedConfig;
  
  try {
    const dataPath = path.join(__dirname, '..', 'data', userId, `${id}.json`);
    const data = await fs.readFile(dataPath, 'utf-8');
    const parsed = JSON.parse(data);
    
    const feed = new RSS({
      title: `Snout: ${title}`,
      description: description || 'Pinterest Board Feed',
      feed_url: `https://shorobor-field.github.io/snout/feeds/${userId}/${id}.xml`,
      site_url: boardUrl,
      pubDate: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }),
      language: 'en',
      image_url: `https://shorobor-field.github.io/snout/images/logo.png`,
      custom_namespaces: {
        'webfeeds': 'http://webfeeds.org/rss/1.0',
        'atom': 'http://www.w3.org/2005/Atom'
      },
      custom_elements: [
        {'webfeeds:icon': `https://shorobor-field.github.io/snout/images/favicon.ico`},
        {'webfeeds:logo': `https://shorobor-field.github.io/snout/images/logo.png`},
        {'atom:icon': `https://shorobor-field.github.io/snout/images/favicon.ico`}
      ]
    });

    if (parsed.error) {
      feed.item({
        title: `🚨 Feed Update Failed - ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}`,
        description: makeErrorHtml(parsed),
        url: boardUrl,
        guid: `error-${id}-${Date.now()}`,
        date: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })
      });
    } else {
      feed.item({
        title: `${title} - ${new Date().toLocaleString('en-US', { 
          timeZone: 'Asia/Dhaka',
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}`,
        description: makePinsHtml(parsed, feedConfig),
        url: boardUrl,
        guid: `${id}-${Date.now()}`,
        date: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })
      });
    }

    const publicPath = path.join(__dirname, '..', 'public');
    const userFeedsPath = path.join(publicPath, 'feeds', userId);
    await fs.mkdir(userFeedsPath, { recursive: true });
    
    await fs.writeFile(path.join(userFeedsPath, `${id}.xml`), feed.xml({indent: true}));
    console.log(`✨ generated ${userId}/${id}`);

  } catch (error) {
    console.log(`❌ ${userId}/${id}: ${error.message}`);
  }
}
async function generateUserFeeds(user) {
  console.log(`📡 ${user.id}: generating feeds...`);
  for (const feed of user.feeds) {
    await generateFeed(user.id, feed);
  }
}

async function generateAllFeeds() {
  console.log('🌟 starting feed generation...');
  
  for (const user of config.users) {
    await generateUserFeeds(user);
  }
  
// Create landing page
  const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>snout</title>
  <link rel="icon" type="image/x-icon" href="/images/favicon.ico">
  <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16x16.png">
</head>
<body style="margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; background: #f8f8f8;">
  <div style="max-width: 800px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 40px;">
      <div style="display: flex; align-items: center; justify-content: center; gap: 16px;">
        <img src="/images/logo.png" alt="Snout" style="width: 48px; height: 48px;">
        <h1 style="font-size: 3em; color: #1a1a1a; margin: 0; font-weight: 300;">
          snout
        </h1>
      </div>
    </div>

    ${config.users.map(user => `
      <div style="margin-bottom: 40px;">
        <h3 style="color: #1a1a1a; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
          ${user.id}'s feeds
        </h3>
        <div style="display: flex; flex-wrap: wrap; gap: 20px;">
          ${user.feeds.map(feed => `
            <div style="flex: 1 1 300px; max-width: 400px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 16px;">
              <h4 style="margin: 0 0 8px 0; font-size: 18px; color: #1a1a1a;">
                ${feed.title}
              </h4>
              ${feed.description ? 
                `<p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">${feed.description}</p>` 
                : ''
              }
              ${feed.schedule ? 
                `<p style="margin: 0 0 12px 0; color: #666; font-size: 14px; font-style: italic;">
                  Updates: ${feed.schedule.includes('daily') ? 'Daily' : feed.schedule.map(d => 
                    d.charAt(0).toUpperCase() + d.slice(1)
                  ).join(', ')}
                </p>` 
                : ''
              }
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
      <p>Last updated: ${new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Dhaka',
        dateStyle: 'medium',
        timeStyle: 'medium'
      })}</p>
    </div>
  </div>
</body>
</html>`;

  const publicPath = path.join(__dirname, '..', 'public');
  await fs.mkdir(publicPath, { recursive: true });
  await fs.writeFile(path.join(publicPath, 'index.html'), indexHtml);
  
  console.log('✅ feed generation complete!');
}

generateAllFeeds();