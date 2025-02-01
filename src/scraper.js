// src/scraper.js
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import config from '../config.json' assert { type: 'json' };

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

async function getShareLink(page, pinId) {
  try {
    await page.goto(`https://pinterest.com/pin/${pinId}`);
    await page.waitForSelector('[data-test-id="share-button"]');
    await page.click('[data-test-id="share-button"]');
    
    const shareUrl = await page.evaluate(() => {
      const input = document.querySelector('input[value^="https://pin.it/"]');
      return input ? input.value : null;
    });
    
    return shareUrl;
  } catch (error) {
    console.error(`Failed to get share link for pin ${pinId}:`, error);
    return null;
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

async function scrapePinterestBoard(boardId) {
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

    const url = `https://www.pinterest.com/?boardId=${boardId}`;
    await page.goto(url);
    await page.waitForTimeout(3000);
    await page.waitForSelector('img', { timeout: 10000 });
    await page.waitForTimeout(3000);

    let pins = await page.evaluate(() => {
      const saveButtons = Array.from(document.querySelectorAll('svg[aria-label="Save"]'));
      return saveButtons.map(btn => {
        const container = btn.closest('[data-test-id="pin"]') || 
                         btn.closest('[role="listitem"]');
        
        if (!container) return null;

        const img = container.querySelector('img');
        const link = container.querySelector('a[href*="/pin/"]');
        
        const imgSrc = img?.src?.replace(/\/\d+x\//, '/originals/').replace(/\?fit=.*$/, '');
        const pinId = link?.href?.match(/\/pin\/(\d+)/)?.[1];
        
        return {
          id: pinId || Date.now().toString(),
          title: img?.alt || '',
          image: imgSrc,
          url: null, // we'll fill this with share link later
          description: container.textContent?.trim() || ''
        };
      }).filter(Boolean);
    });

    const verifiedPins = [];
    for (const pin of pins) {
      if (await verifyImageUrl(page, pin.image)) {
        // Get share link for each pin
        const shareUrl = await getShareLink(page, pin.id);
        if (shareUrl) {
          pin.url = shareUrl;
          verifiedPins.push(pin);
        }
      }
    }

    return verifiedPins;

  } catch (error) {
    console.error(`Failed scraping board ${boardId}:`, error);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeAllBoards() {
  console.log('Starting Pinterest scrape...');
  await fs.mkdir('./data', { recursive: true });
  
  for (const feed of config.feeds) {
    const pins = await scrapePinterestBoard(feed.boardId);
    
    if (pins.length > 0) {
      await fs.writeFile(
        `./data/${feed.id}.json`,
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