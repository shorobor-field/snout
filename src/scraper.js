import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import config from '../config.json' assert { type: 'json' };

// Cookie should be added as a GitHub secret
const PINTEREST_SESSION = process.env.PINTEREST_SESSION;

async function ensureLogin(page) {
  try {
    console.log('🍪 Setting up cookie-based auth...');
    
    // First navigate to Pinterest
    await page.goto('https://pinterest.com', { timeout: 60000 });
    
    // Set the session cookie
    await page.context().addCookies([{
      name: '_pinterest_sess',  // Pinterest's session cookie
      value: PINTEREST_SESSION,
      domain: '.pinterest.com',
      path: '/'
    }]);

    // Take screenshot after setting cookie
    await takeScreenshot(page, '1-after-cookie');

    // Verify login by checking for avatar
    await page.reload();
    await page.waitForSelector('[data-test-id="header-avatar"], [data-test-id="homefeed-feed"]', {
      timeout: 20000
    });
    
    // Take screenshot of logged in state
    await takeScreenshot(page, '2-logged-in');
    
    console.log('✅ Cookie auth successful');
    return true;
  } catch (error) {
    console.error('❌ Cookie auth failed:', error.message);
    // Take error screenshot
    await takeScreenshot(page, 'error-state');
    return false;
  }
}

async function takeScreenshot(page, name) {
  const dir = './debug-screenshots';
  await fs.mkdir(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `${dir}/${name}-${timestamp}.png`;
  await page.screenshot({ 
    path,
    fullPage: true 
  });
  console.log(`📸 Saved screenshot: ${path}`);
}

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

    console.log(`🎯 getting pins from board ${boardId}...`);
    
    // Try different Pinterest board URL formats
    const urls = [
      `https://pinterest.com/pin/${boardId}/`,
      `https://pinterest.com/board/${boardId}/`,
      `https://pinterest.com/w/${boardId}/`
    ];
    
    let loaded = false;
    for (const url of urls) {
      try {
        console.log(`Attempting to load: ${url}`);
        await page.goto(url, { timeout: 30000 });
        await page.waitForSelector('img', { timeout: 5000 }); // Check if we got any content
        loaded = true;
        console.log(`✅ Successfully loaded: ${url}`);
        break;
      } catch (error) {
        console.log(`Failed to load ${url}: ${error.message}`);
        continue;
      }
    }
    
    if (!loaded) {
      throw new Error('Could not load board with any known URL format');
    await page.waitForLoadState('networkidle');
    
    await takeScreenshot(page, '3-board-page');
    
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