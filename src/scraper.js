import { chromium } from 'playwright';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import config from '../config.json' assert { type: 'json' };

const PINTEREST_EMAIL = process.env.PINTEREST_EMAIL;
const PINTEREST_PASSWORD = process.env.PINTEREST_PASSWORD;

// Create screenshots directory if it doesn't exist
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
    
    // Wait for email input to be ready
    await page.waitForSelector('#email', { timeout: 10000 });
    
    // Take screenshot before filling credentials
    await takeScreenshot(page, '2-before-credentials');
    
    await page.fill('#email', PINTEREST_EMAIL);
    await page.fill('#password', PINTEREST_PASSWORD);
    
    // Take screenshot after filling credentials (password will be masked)
    await takeScreenshot(page, '3-after-credentials');
    
    await page.click('button[type="submit"]');
    
    // Take screenshot immediately after clicking submit
    await takeScreenshot(page, '4-after-submit');
    
    // Wait for login to complete - look for avatar or home feed
    await page.waitForSelector('[data-test-id="header-avatar"], [data-test-id="homefeed-feed"]', {
      timeout: 20000
    });
    
    // Take screenshot of successful login
    await takeScreenshot(page, '5-login-success');
    
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    // Take screenshot of error state
    await takeScreenshot(page, 'error-state');
    
    console.error('❌ Login failed:', error.message);
    // Log more details about the current page
    console.log('Current URL:', page.url());
    const content = await page.content();
    console.log('Page content:', content.slice(0, 500) + '...'); // First 500 chars
    
    return false;
  }
}

// Rest of the code remains the same...
async function scrapePinterestBoard(boardId) {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--window-size=1920,1080', '--no-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
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
    
    // Take screenshot of board page
    await takeScreenshot(page, 'board-page');
    
    // Rest of the scraping logic...
    // ... (same as before)
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