// src/scraper.js
import { chromium } from 'playwright';
import fs from 'fs/promises';
import { dirname } from 'path';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PINTEREST_SESSION = process.env.PINTEREST_SESSION;

async function ensureLogin(page) {
  try {
    await page.goto('https://pinterest.com', { timeout: 60000 });
    await page.context().addCookies([{
      name: '_pinterest_sess',
      value: PINTEREST_SESSION,
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

async function scrapePinterestBoard(boardUrl) {
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

    if (!await ensureLogin(page)) {
      throw new Error('Login failed');
    }

    console.log(`🔍 navigating to ${boardUrl}...`);
    // directly navigate to the board url
    await page.goto(boardUrl);
    await page.waitForTimeout(3000);
    await page.waitForSelector('img', { timeout: 10000 });
    await page.waitForTimeout(3000);

    let pins = await page.evaluate(() => {
      // try multiple selectors since pinterest's markup changes often
      const containers = [
        ...document.querySelectorAll('[data-test-id="pin"]'),
        ...document.querySelectorAll('[role="listitem"]'),
        ...document.querySelectorAll('div[data-grid-item="true"]')
      ];
      
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
    console.error(`Failed scraping board ${boardUrl}:`, error);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeAllBoards() {
  console.log('Starting Pinterest scrape...');
  // ensure both data and public folders exist
  await fs.mkdir(path.join(__dirname, '..', 'data'), { recursive: true });
  
  for (const feed of config.feeds) {
    const pins = await scrapePinterestBoard(feed.boardUrl);
    
    if (pins.length > 0) {
      const dataPath = path.join(__dirname, '..', 'data', `${feed.id}.json`);
      await fs.writeFile(
        dataPath,
        JSON.stringify(pins, null, 2)
      );
      console.log(`✨ Saved ${pins.length} pins for ${feed.id}`);
    } else {
      console.error(`No pins found for ${feed.id}`);
    }
  }
  
  console.log('Done scraping all boards!');
}

// Clean up old debug screenshots if they exist
fs.rm('./debug-screenshots', { recursive: true, force: true })
  .then(() => scrapeAllBoards());