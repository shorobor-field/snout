import { chromium } from 'playwright';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import config from '../config.json' assert { type: 'json' };

const PINTEREST_EMAIL = process.env.PINTEREST_EMAIL;
const PINTEREST_PASSWORD = process.env.PINTEREST_PASSWORD;

// Debug helpers
async function saveScreenshot(page, name) {
  const dir = './debug-screenshots';
  await fs.mkdir(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ 
    path: `${dir}/${name}-${timestamp}.png`,
    fullPage: true 
  });
}

// Main login function
async function login(page) {
  try {
    console.log('🔑 Logging in...');
    await page.goto('https://pinterest.com/login');
    await saveScreenshot(page, '1-login-page');
    
    // Fill credentials
    await page.waitForSelector('#email');
    await page.fill('#email', PINTEREST_EMAIL);
    await page.fill('#password', PINTEREST_PASSWORD);
    await saveScreenshot(page, '2-credentials');
    
    // Click login
    await page.click('button[type="submit"]');
    await saveScreenshot(page, '3-clicked-login');
    
    // Wait for successful login
    await page.waitForSelector('[data-test-id="header-avatar"]', { timeout: 30000 });
    await saveScreenshot(page, '4-success');
    
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return false;
  }
}

// Get pins from a board
async function scrapePins(page, boardId) {
  try {
    console.log(`Getting pins for board ${boardId}...`);
    await page.goto(`https://pinterest.com/ideas/?boardId=${boardId}`);
    await page.waitForLoadState('networkidle');
    
    // Scroll a few times to load more pins
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(1000);
    }

    // Extract pins
    const pins = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div'))
        .filter(div => {
          const img = div.querySelector('img');
          const link = div.querySelector('a[href*="/pin/"]');
          return img && link && div.offsetWidth > 100;
        })
        .map(div => {
          const img = div.querySelector('img');
          const link = div.querySelector('a[href*="/pin/"]');
          const title = img?.alt || 'Untitled Pin';
          const description = div.textContent?.trim() || '';
          let imageUrl = img?.src || '';

          // Get highest quality image
          if (imageUrl) {
            imageUrl = imageUrl.replace(/\/\d+x\//, '/originals/')
                              .replace(/\?fit=.*$/, '');
          }

          return {
            id: link?.href?.match(/\/pin\/(\d+)/)?.[1] || Date.now().toString(),
            title: title.slice(0, 100), // Truncate long titles
            description: description.slice(0, 200), // Truncate long descriptions
            image: imageUrl,
            url: link?.href || ''
          };
        })
        .filter(pin => pin.url && pin.image);
    });

    console.log(`Found ${pins.length} pins`);
    return pins;

  } catch (error) {
    console.error(`Failed to get pins:`, error.message);
    return [];
  }
}

// Main scraping function
async function scrapeBoards() {
  console.log('Starting Pinterest scrape...');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Create data directory
    await fs.mkdir('./data', { recursive: true });

    const page = await context.newPage();
    if (!await login(page)) {
      throw new Error('Login failed');
    }

    // Process each feed
    for (const feed of config.feeds) {
      console.log(`\nProcessing feed: ${feed.id}`);
      const pins = await scrapePins(page, feed.boardId);
      
      if (pins.length > 0) {
        const outputPath = `./data/${feed.id}.json`;
        await fs.writeFile(outputPath, JSON.stringify(pins, null, 2));
        console.log(`✅ Saved ${pins.length} pins to ${outputPath}`);
      }
    }

  } catch (error) {
    console.error('💥 Scraping failed:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }

  console.log('\n✨ Scraping complete!');
}

// Run the scraper
scrapeBoards();