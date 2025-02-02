// src/scraper.js
import { chromium } from 'playwright';
import fs from 'fs/promises';
import { dirname } from 'path';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function shouldRunToday(schedule) {
  if (!schedule || schedule.includes('daily')) return true;
  const today = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Dhaka',
    weekday: 'long' 
  }).toLowerCase();
  return schedule.some(day => day.toLowerCase() === today);
}

async function getUserSession(userId) {
  const envVar = `PINTEREST_SESSION_${userId.toUpperCase()}`;
  const rawSessionValue = process.env[envVar];
  
  if (!rawSessionValue) {
    throw new Error(`No Pinterest session found for user ${userId} (missing ${envVar})`);
  }
  return rawSessionValue;
}

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

    const loginResult = await Promise.race([
      page.waitForSelector('[data-test-id="header-avatar"]', { timeout: 20000 })
        .then(() => true)
        .catch(() => false),
      page.waitForSelector('[data-test-id="homefeed-feed"]', { timeout: 20000 })
        .then(() => true)
        .catch(() => false)
    ]);

    return loginResult;
  } catch {
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
    await page.goto(boardUrl);
    await page.waitForTimeout(3000);

    const moreIdeasButton = await page.evaluate(() => {
      const svgButton = document.querySelector('svg[aria-label="More ideas"]')?.closest('.Jea.jzS');
      if (svgButton) return true;
      
      const textButton = Array.from(document.querySelectorAll('.tBJ')).find(el => 
        el.textContent.trim() === 'More ideas'
      )?.closest('.Jea.jzS');
      return !!textButton;
    });
    
    if (moreIdeasButton) {
      await page.evaluate(() => {
        const button = document.querySelector('svg[aria-label="More ideas"]')?.closest('.Jea.jzS');
        if (button) button.click();
      });
      await page.waitForTimeout(5000);
    }

    await page.waitForSelector('img', { timeout: 10000 });
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await page.waitForTimeout(3000);

    let pins = await page.evaluate(() => {
      const containers = [
        ...document.querySelectorAll('[data-test-id="pin"]'),
        ...document.querySelectorAll('[role="listitem"]'),
        ...document.querySelectorAll('div[data-grid-item="true"]')
      ].slice(0, 15);
      
      return containers.map(container => {
        if (!container) return null;
        const img = container.querySelector('img');
        const link = container.querySelector('a[href*="/pin/"]');
        
        const imgSrc = img?.src
          ?.replace(/\/\d+x\//, '/originals/')
          ?.replace(/\?fit=.*$/, '');
        
        return {
          id: link?.href?.match(/\/pin\/(\d+)/)?.[1] || Date.now().toString(),
          title: img?.alt || '',
          image: imgSrc,
          url: link?.href,
          description: container.textContent?.trim() || '',
          timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })
        };
      }).filter(Boolean);
    });

    const verifiedPins = [];
    for (const pin of pins) {
      if (await verifyImageUrl(page, pin.image)) {
        verifiedPins.push(pin);
      }
    }

    return verifiedPins;
  } catch (error) {
    return [];
  }
}

async function scrapeUserBoards(user, feedsToScrape = user.feeds) {
  const session = await getUserSession(user.id);
  const userDataDir = path.join(__dirname, '..', 'data', user.id);
  await fs.mkdir(userDataDir, { recursive: true });
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-web-security']
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true
    });
    
    const page = await context.newPage();

    const loginSuccess = await ensureLogin(page, session);
    if (!loginSuccess) {
      for (const feed of feedsToScrape) {
        const errorData = {
          error: 'AUTH_ERROR',
          message: 'Pinterest session expired or invalid',
          timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })
        };
        
        await fs.writeFile(
          path.join(userDataDir, `${feed.id}.json`),
          JSON.stringify(errorData, null, 2)
        );
      }
      throw new Error(`Login failed for user ${user.id}`);
    }

    for (const feed of feedsToScrape) {
      const pins = await scrapePinterestBoard(page, feed.boardUrl);
      
      if (pins.length > 0) {
        await fs.writeFile(
          path.join(userDataDir, `${feed.id}.json`),
          JSON.stringify(pins, null, 2)
        );
        console.log(`✨ ${user.id}/${feed.id}: saved ${pins.length} pins`);
      } else {
        const errorData = {
          error: 'SCRAPE_ERROR',
          message: 'No pins could be extracted from board',
          timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })
        };
        
        await fs.writeFile(
          path.join(userDataDir, `${feed.id}.json`),
          JSON.stringify(errorData, null, 2)
        );
        console.log(`❌ ${user.id}/${feed.id}: no pins found`);
      }
    }

  } catch (error) {
    console.log(`❌ ${user.id}: ${error.message}`);
  } finally {
    await browser.close();
  }
}

async function scrapeAllUsers() {
  console.log('🌟 starting pinterest scrape...');
  
  await fs.mkdir(path.join(__dirname, '..', 'data'), { recursive: true });
  
  for (const user of config.users) {
    const feedsToRun = [];
    
    for (const feed of user.feeds) {
      if (await shouldRunToday(feed.schedule)) {
        feedsToRun.push(feed);
      }
    }
    
    if (feedsToRun.length > 0) {
      console.log(`📡 ${user.id}: scraping ${feedsToRun.length} feeds...`);
      await scrapeUserBoards(user, feedsToRun);
    }
  }
  
  console.log('✅ scraping complete!');
}

fs.rm('./debug-screenshots', { recursive: true, force: true })
  .then(() => scrapeAllUsers())
  .catch(error => {
    console.log('❌ fatal error:', error.message);
    process.exit(1);
  });