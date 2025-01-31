import { chromium } from 'playwright';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import config from '../config.json' assert { type: 'json' };

const PINTEREST_EMAIL = process.env.PINTEREST_EMAIL;
const PINTEREST_PASSWORD = process.env.PINTEREST_PASSWORD;

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if(totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

async function scrapePinterestBoard(boardId) {
  const browser = await chromium.launch({ headless: true });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ...(existsSync('auth.json') ? { storageState: 'auth.json' } : {})
    });
    
    const page = await context.newPage();

    // only login if we need to
    if (!existsSync('auth.json')) {
      console.log('🔑 first time login...');
      await page.goto('https://pinterest.com/login');
      await page.waitForLoadState('networkidle');
      
      await page.fill('#email', PINTEREST_EMAIL);
      await page.fill('#password', PINTEREST_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
      
      // save auth for next time
      await context.storageState({ path: 'auth.json' });
    }

    console.log(`🎯 scraping board ${boardId}...`);
    // Fixed URL format for Pinterest boards
    await page.goto(`https://pinterest.com/pin/${boardId}`);
    await page.waitForLoadState('networkidle');
    
    // Scroll multiple times to load more content
    for(let i = 0; i < 5; i++) {
      await autoScroll(page);
      await page.waitForTimeout(1000);
    }

    const pins = await page.evaluate(() => {
      const pins = document.querySelectorAll('[data-test-id="pin"], [data-test-id="pinrep"], .Grid__Item');
      console.log(`Found ${pins.length} pins`);
      
      return Array.from(pins).map(pin => {
        const pinData = {
          id: pin.getAttribute('data-pin-id') || Date.now().toString(),
          title: pin.querySelector('[data-test-id="pin-title"], .richPinTitle')?.textContent?.trim() || 'Untitled Pin',
          description: pin.querySelector('[data-test-id="pin-description"], .richPinDescription')?.textContent?.trim() || '',
          image: pin.querySelector('img')?.src,
          url: pin.querySelector('a[href*="/pin/"]')?.href
        };
        console.log('Pin data:', pinData);
        return pinData;
      }).filter(pin => pin.url && pin.image);
    });

    console.log(`📌 Scraped ${pins.length} pins`);
    return pins;

  } catch (error) {
    console.error(`💀 failed scraping board ${boardId}:`, error);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeAllBoards() {
  console.log('🐕 woof! starting pinterest scrape...');
  
  // ensure data dir exists
  await fs.mkdir('./data', { recursive: true });
  
  // scrape each board in config
  for (const feed of config.feeds) {
    const pins = await scrapePinterestBoard(feed.boardId);
    
    if (pins.length === 0) {
      console.error(`⚠️ No pins found for board ${feed.boardId}`);
      continue;
    }
    
    await fs.writeFile(
      `./data/${feed.id}.json`,
      JSON.stringify(pins, null, 2)
    );
    
    console.log(`✅ Saved ${pins.length} pins for ${feed.id}`);
  }
  
  console.log('✨ done scraping all boards!');
}

scrapeAllBoards();