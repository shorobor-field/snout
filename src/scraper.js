// src/scraper.js
import { chromium } from 'playwright';
import fs from 'fs/promises';
import { dirname } from 'path';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function ensureLogin(page, sessionCookie) {
  try {
    await page.goto('https://pinterest.com', { timeout: 60000 });
    await page.context().addCookies([{
      name: '_pinterest_sess',
      value: sessionCookie,
      domain: '.pinterest.com',
      path: '/'
    }]);

    await page.reload();
    await page.waitForSelector('[data-test-id="header-avatar"], [data-test-id="homefeed-feed"]', {
      timeout: 20000
    });
    
    return true;
  } catch (error) {
    console.error('❌ Cookie auth failed:', error.message);
    return false;
  }
}

async function verifyImageUrl(page, url) {
  if (!url) return false;
  try {
    const response = await page.evaluate(async (url) => {
      const res = await fetch(url, { method: 'HEAD' });
      return res.ok;
    }, url);
    return response;
  } catch {
    return false;
  }
}

async function scrapePinterestBoard(page, boardUrl) {
  try {
    console.log(`🔍 navigating to ${boardUrl}...`);
    
    // First navigate to board
    await page.goto(boardUrl);
    await page.waitForTimeout(3000);

    // Look for "More ideas" button and click it
    console.log('looking for more ideas button...');
    
    // try multiple strategies to find the button
    const moreIdeasButton = await page.evaluate(() => {
      // try svg aria-label first
      const svgButton = document.querySelector('svg[aria-label="More ideas"]')?.closest('.Jea.jzS');
      if (svgButton) return svgButton;
      
      // try text content
      const textButton = Array.from(document.querySelectorAll('.tBJ')).find(el => 
        el.textContent.trim() === 'More ideas'
      )?.closest('.Jea.jzS');
      if (textButton) return textButton;
      
      return null;
    });
    
    if (!moreIdeasButton) {
      throw new Error('Could not find More ideas button');
    }
    
    await page.evaluate(() => {
      const button = document.querySelector('svg[aria-label="More ideas"]')?.closest('.Jea.jzS');
      if (button) button.click();
    });
    
    // Wait for the new content to load
    await page.waitForTimeout(5000);
    await page.waitForSelector('img', { timeout: 10000 });
    
    // Scroll a bit to load more content
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 2);
    });
    await page.waitForTimeout(3000);

    let pins = await page.evaluate(() => {
      const containers = [
        ...document.querySelectorAll('[data-test-id="pin"]'),
        ...document.querySelectorAll('[role="listitem"]'),
        ...document.querySelectorAll('div[data-grid-item="true"]')
      ].slice(0, 15); // take first 15 before processing in case some fail verification
      
      return containers.map(container => {
        if (!container) return null;

        const img = container.querySelector('img');
        const link = container.querySelector('a[href*="/pin/"]');
        
        const imgSrc = img?.src?.replace(/\/\d+x\//, '/originals/').replace(/\?fit=.*$/, '');
        
        return {
          id: link?.href?.match(/\/pin\/(\d+)/)?.[1] || Date.now().toString(),
          title: img?.alt || '',
          image: imgSrc,
          url: link?.href,
          description: container.textContent?.trim() || ''
        };
      }).filter(Boolean);
    });

    console.log(`Found ${pins.length} potential pins, verifying images...`);

    const verifiedPins = [];
    for (const pin of pins) {
      if (await verifyImageUrl(page, pin.image)) {
        verifiedPins.push(pin);
      }
    }

    console.log(`Verified ${verifiedPins.length} pins with valid images`);
    return verifiedPins;

  } catch (error) {
    console.error(`Failed scraping more ideas for ${boardUrl}:`, error);
    return [];
  }
}

async function getUserSession(userId) {
  const envVar = `PINTEREST_SESSION_${userId.toUpperCase()}`;
  const session = process.env[envVar];
  
  if (!session) {
    throw new Error(`No Pinterest session found for user ${userId} (missing ${envVar})`);
  }
  
  return session;
}

async function scrapeUserBoards(user) {
  console.log(`\n🚀 Starting scrape for user: ${user.id}`);
  
  const session = await getUserSession(user.id);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ]
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
      permissions: ['geolocation'],
      bypassCSP: true,
    });
    
    const page = await context.newPage();

    if (!await ensureLogin(page, user.pinterest_session)) {
      throw new Error(`Login failed for user ${user.id}`);
    }

    // create user-specific data directory
    const userDataDir = path.join(__dirname, '..', 'data', user.id);
    await fs.mkdir(userDataDir, { recursive: true });

    for (const feed of user.feeds) {
      const pins = await scrapePinterestBoard(page, feed.boardUrl);
      
      if (pins.length > 0) {
        const dataPath = path.join(userDataDir, `${feed.id}.json`);
        await fs.writeFile(
          dataPath,
          JSON.stringify(pins, null, 2)
        );
        console.log(`✨ Saved ${pins.length} pins for ${user.id}/${feed.id}`);
      } else {
        console.error(`No pins found for ${user.id}/${feed.id}`);
      }
    }

  } catch (error) {
    console.error(`Failed processing user ${user.id}:`, error);
  } finally {
    await browser.close();
  }
}

async function scrapeAllUsers() {
  console.log('🌟 Starting Pinterest scrape for all users...');
  
  // ensure data directory exists
  await fs.mkdir(path.join(__dirname, '..', 'data'), { recursive: true });
  
  // scrape sequentially to avoid rate limiting
  for (const user of config.users) {
    await scrapeUserBoards(user);
  }
  
  console.log('✅ Done scraping all users!');
}

// Clean up old debug screenshots if they exist
fs.rm('./debug-screenshots', { recursive: true, force: true })
  .then(() => scrapeAllUsers());