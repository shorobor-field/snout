import { chromium } from 'playwright';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import config from '../config.json' assert { type: 'json' };

const PINTEREST_EMAIL = process.env.PINTEREST_EMAIL;
const PINTEREST_PASSWORD = process.env.PINTEREST_PASSWORD;

async function scrapePinterestBoard(boardId) {
  const browser = await chromium.launch({ headless: true });
  
  try {
    // reuse auth if exists
    const context = await browser.newContext(
      existsSync('auth.json')  // <-- fixed syntax
        ? { storageState: 'auth.json' }
        : {}
    );
    
    const page = await context.newPage();

    // only login if we need to
    if (!existsSync('auth.json')) {  // <-- fixed here too
      console.log('🔑 first time login...');
      await page.goto('https://pinterest.com/login');
      await page.fill('#email', PINTEREST_EMAIL);
      await page.fill('#password', PINTEREST_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      
      // save auth for next time
      await context.storageState({ path: 'auth.json' });
    }

    console.log(`🎯 scraping board ${boardId}...`);
    await page.goto(`https://pinterest.com/?boardId=${boardId}`);
    
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    const pins = await page.evaluate(() => {
      const pins = document.querySelectorAll('[data-test-id="pin"], [data-test-id="pinrep"], .Grid__Item');
      
      return Array.from(pins).map(pin => ({
        id: pin.getAttribute('data-pin-id') || Date.now().toString(),
        title: pin.querySelector('[data-test-id="pin-title"], .richPinTitle')?.textContent?.trim() || 'Untitled Pin',
        description: pin.querySelector('[data-test-id="pin-description"], .richPinDescription')?.textContent?.trim() || '',
        image: pin.querySelector('img')?.src,
        url: pin.querySelector('a[href*="/pin/"]')?.href
      })).filter(pin => pin.url && pin.image);
    });

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
    
    await fs.writeFile(
      `./data/${feed.id}.json`,
      JSON.stringify(pins, null, 2)
    );
  }
  
  console.log('✨ done scraping all boards!');
}

scrapeAllBoards();