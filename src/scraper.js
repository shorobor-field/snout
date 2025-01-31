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
      deviceScaleFactor: 2,
    });
    
    const page = await context.newPage();

    console.log('🔑 attempting login...');
    await page.goto('https://pinterest.com/login', { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
    
    await page.fill('#email', PINTEREST_EMAIL);
    await page.fill('#password', PINTEREST_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for navigation after login
    await page.waitForTimeout(5000);

    console.log(`🎯 scraping board ${boardId}...`);
    await page.goto(`https://pinterest.com/board/${boardId}`, { timeout: 60000 });
    await page.waitForTimeout(5000); // Give it time to load initial content

    // Scroll 3 times to load more content
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(3000);
    }

    const pins = await page.evaluate(() => {
      const pins = document.querySelectorAll('[data-test-id="pin"], [data-test-id="pinrep"], .Grid__Item');
      console.log(`Found ${pins.length} pins`);
      
      return Array.from(pins).map(pin => {
        const img = pin.querySelector('img');
        let imageUrl = img?.src;
        
        // Try to get higher quality image
        if (imageUrl) {
          imageUrl = imageUrl.replace(/\/\d+x\//, '/originals/');
        }
        
        return {
          id: pin.getAttribute('data-pin-id') || Date.now().toString(),
          title: pin.querySelector('[data-test-id="pin-title"], .richPinTitle')?.textContent?.trim() || 'Untitled Pin',
          description: pin.querySelector('[data-test-id="pin-description"], .richPinDescription')?.textContent?.trim() || '',
          image: imageUrl,
          url: pin.querySelector('a[href*="/pin/"]')?.href
        };
      }).filter(pin => pin.url && pin.image);
    });

    console.log(`📌 Found ${pins.length} pins for board ${boardId}`);
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
    console.log(`Processing feed: ${feed.id}`);
    const pins = await scrapePinterestBoard(feed.boardId);
    
    if (pins.length > 0) {
      await fs.writeFile(
        `./data/${feed.id}.json`,
        JSON.stringify(pins, null, 2)
      );
      console.log(`✅ Saved ${pins.length} pins for ${feed.id}`);
    } else {
      console.error(`⚠️ No pins found for ${feed.id}`);
    }
  }
  
  console.log('✨ done scraping all boards!');
}

scrapeAllBoards();