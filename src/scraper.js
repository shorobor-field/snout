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

async function ensureLogin(context) {
  try {
    // Check if we have stored auth state
    const authFile = './auth.json';
    if (existsSync(authFile)) {
      console.log('🔄 Using cached authentication...');
      await context.loadStorageState({ path: authFile });
      
      // Verify the auth still works
      const page = await context.newPage();
      await page.goto('https://pinterest.com', { timeout: 60000 });
      
      try {
        await page.waitForSelector('[data-test-id="header-avatar"]', { timeout: 10000 });
        console.log('✅ Cached auth valid');
        await page.close();
        return true;
      } catch (e) {
        console.log('⚠️ Cached auth expired, logging in again...');
        await page.close();
      }
    }

    // If no cache or expired, do fresh login
    const page = await context.newPage();
    console.log('🔑 attempting fresh login...');
    await page.goto('https://pinterest.com/login', { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
    
    await takeScreenshot(page, '1-login-page');
    
    await page.waitForSelector('#email', { timeout: 10000 });
    
    // Make password visible for debugging
    await page.evaluate(() => {
      const pwField = document.querySelector('#password');
      if (pwField) pwField.type = 'text';
    });
    
    await page.fill('#email', PINTEREST_EMAIL);
    await page.fill('#password', PINTEREST_PASSWORD);
    
    await takeScreenshot(page, '2-filled-credentials');
    
    await page.click('button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForSelector('[data-test-id="header-avatar"]', { timeout: 20000 });
    
    // Save authentication state
    await context.storageState({ path: authFile });
    console.log('💾 Saved authentication state');
    
    await page.close();
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return false;
  }
}

async function scrapePinterestBoard(context, boardId) {
  const page = await context.newPage();
  page.on('console', msg => console.log('Browser log:', msg.text()));

  try {
    console.log(`🎯 getting suggestions for board ${boardId}...`);
    const url = `https://pinterest.com/?boardId=${boardId}`;
    await page.goto(url, { timeout: 60000 });
    await page.waitForLoadState('networkidle');
    
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
    await page.close();
  }
}

async function scrapeAllBoards() {
  console.log('🐕 woof! starting pinterest scrape...');
  await fs.mkdir('./data', { recursive: true });
  
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

    if (!await ensureLogin(context)) {
      throw new Error('Login failed');
    }
    
    for (const feed of config.feeds) {
      console.log(`Processing feed: ${feed.id}`);
      const pins = await scrapePinterestBoard(context, feed.boardId);
      
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
  } finally {
    await browser.close();
  }
  
  console.log('✨ done scraping all boards!');
}

scrapeAllBoards();