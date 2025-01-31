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
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2, // Request higher DPI images
      ...(existsSync('auth.json') ? { storageState: 'auth.json' } : {})
    });
    
    const page = await context.newPage();

    if (!existsSync('auth.json')) {
      console.log('🔑 first time login...');
      await page.goto('https://pinterest.com/login');
      await page.fill('#email', PINTEREST_EMAIL);
      await page.fill('#password', PINTEREST_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      await context.storageState({ path: 'auth.json' });
    }

    console.log(`🎯 scraping board ${boardId}...`);
    await page.goto(`https://pinterest.com/board/${boardId}`);
    await page.waitForLoadState('networkidle');

    // Scroll to load more content
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
    }

    const pins = await page.evaluate(() => {
      const pins = document.querySelectorAll('[data-test-id="pin"], [data-test-id="pinrep"], .Grid__Item');
      
      return Array.from(pins).map(pin => {
        const img = pin.querySelector('img');
        // Try to get the highest quality image URL
        const imageUrl = img?.src?.replace(/\/\d+x\//, '/originals/') || img?.src;
        
        return {
          id: pin.getAttribute('data-pin-id') || Date.now().toString(),
          title: pin.querySelector('[data-test-id="pin-title"], .richPinTitle')?.textContent?.trim() || 'Untitled Pin',
          description: pin.querySelector('[data-test-id="pin-description"], .richPinDescription')?.textContent?.trim() || '',
          image: imageUrl,
          url: pin.querySelector('a[href*="/pin/"]')?.href
        };
      }).filter(pin => pin.url && pin.image);
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
  await fs.mkdir('./data', { recursive: true });
  
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