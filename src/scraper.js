import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import config from '../config.json' assert { type: 'json' };

// Cookie should be added as a GitHub secret
const PINTEREST_SESSION = process.env.PINTEREST_SESSION;

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

async function scrapePinterestBoard(boardId) {
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--window-size=1920,1080',
      '--no-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials'
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
      // Add common headers to look more like a real browser
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      }
    });
    
    const page = await context.newPage();
    page.on('console', msg => console.log('Browser log:', msg.text()));

    if (!await ensureLogin(page)) {
      throw new Error('Login failed');
    }

    console.log(`🎯 getting pins for board ${boardId}...`);
    const url = `https://www.pinterest.com/?boardId=${boardId}`;
    console.log(`Navigating to: ${url}`);
    
    await page.goto(url);
    console.log('Initial page load complete');
    await takeScreenshot(page, '3a-initial-load');

    // Wait a bit for suggestions to load
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '3b-after-wait');
    
    console.log('Looking for pins...');
    // Wait for any image to appear
    await page.waitForSelector('img', { timeout: 10000 });
    
    // Wait for pins to load
    await page.waitForSelector('img', { timeout: 10000 });
    
    // Don't scroll, just get the initial pins on the page
    const pins = await page.evaluate(() => {
      // Find all pin container divs
      const pinContainers = Array.from(document.querySelectorAll('div'))
        .filter(div => {
          const hasImage = div.querySelector('img');
          const hasLink = div.querySelector('a[href*="/pin/"]');
          const rect = div.getBoundingClientRect();
          // More specific size check for pin containers
          return hasImage && hasLink && rect.width > 200 && rect.height > 200;
        })
        // Take only first 20
        .slice(0, 20);

      return pinContainers.map(div => {
        const img = div.querySelector('img');
        const link = div.querySelector('a[href*="/pin/"]');
        
        let imageUrl = img?.src;
        if (imageUrl) {
          // Get highest quality image
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
      });
    });

    console.log(`Found ${pins.length} initial pins`);
    return pins;

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