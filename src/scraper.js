import { chromium } from 'playwright';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import config from '../config.json' assert { type: 'json' };

const PINTEREST_EMAIL = process.env.PINTEREST_EMAIL;
const PINTEREST_PASSWORD = process.env.PINTEREST_PASSWORD;

async function ensureScreenshotDir() {
  const dir = './debug-screenshots';
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function takeScreenshot(page, name) {
  const dir = await ensureScreenshotDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `${dir}/${name}-${timestamp}.png`;
  await page.screenshot({ 
    path,
    fullPage: true 
  });
  console.log(`📸 Saved screenshot: ${path}`);
}

async function ensureLogin(page) {
  try {
    console.log('🔑 attempting login...');
    await page.goto('https://pinterest.com/login', { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
    
    // Take screenshot of initial login page
    await takeScreenshot(page, '1-login-page');
    
    await page.waitForSelector('#email', { timeout: 10000 });
    
    // Make password visible for debugging
    await page.evaluate(() => {
      const pwField = document.querySelector('#password');
      if (pwField) pwField.type = 'text';
    });
    
    await page.fill('#email', PINTEREST_EMAIL);
    await page.fill('#password', PINTEREST_PASSWORD);
    
    // Screenshot with visible password
    await takeScreenshot(page, '2-filled-credentials');
    
    await page.click('button[type="submit"]');
    
    await takeScreenshot(page, '3-after-submit');
    
    // Wait for login to complete - look for avatar or home feed
    await page.waitForSelector('[data-test-id="header-avatar"], [data-test-id="homefeed-feed"]', {
      timeout: 20000
    });
    
    await takeScreenshot(page, '4-login-success');
    
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    await takeScreenshot(page, 'error-state');
    
    console.error('❌ Login failed:', error.message);
    console.log('Current URL:', page.url());
    const content = await page.content();
    console.log('Page content:', content.slice(0, 500) + '...'); // First 500 chars
    
    return false;
  }
}

async function scrapePinterestBoard(boardId) {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--window-size=1920,1080', '--no-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,  // Kept high quality
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    page.on('console', msg => console.log('Browser log:', msg.text()));

    if (!await ensureLogin(page)) {
      throw new Error('Login failed');
    }

    console.log(`🎯 getting suggestions for board ${boardId}...`);
    const url = `https://pinterest.com/?boardId=${boardId}`;
    await page.goto(url, { timeout: 60000 });
    await page.waitForLoadState('networkidle');
    
    await takeScreenshot(page, '5-board-page');
    
    // Wait for content to load
    await page.waitForTimeout(5000);

    // Scroll multiple times with pauses
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await page.waitForTimeout(2000);
    }

    const pins = await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div'));
      const pinDivs = allDivs.filter(div => {
        const hasImage = div.querySelector('img');
        const hasLink = div.querySelector('a[href*="/pin/"]');
        const rect = div.getBoundingClientRect();
        return hasImage && hasLink && rect.width > 100 && rect.height > 100;
      });

      return pinDivs.map(div => {
        const img = div.querySelector('img');
        const link = div.querySelector('a[href*="/pin/"]');
        
        let imageUrl = img?.src;
        if (imageUrl) {
          imageUrl = imageUrl.replace(/\/\d+x\//, '/originals/')
                            .replace(/\?fit=.*$/, '');
        }

        return {
          id: link?.href?.match(/\/pin\/(\d+)/)?.[1] || Date.now().toString(),
          title: img?.alt || 'Untitled Pin',
          image: imageUrl,
          url: link?.href,
          description: div.textContent?.trim() || ''
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