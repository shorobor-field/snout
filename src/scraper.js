// src/scraper.js
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import config from '../config.json' assert { type: 'json' };

const PINTEREST_SESSION = process.env.PINTEREST_SESSION;

async function ensureLogin(page) {
  try {
    await page.goto('https://pinterest.com', { timeout: 60000 });
    await page.context().addCookies([{
      name: '_pinterest_sess',
      value: PINTEREST_SESSION,
      domain: '.pinterest.com',
      path: '/'
    }]);

    await page.reload();
    await page.waitForSelector('[data-test-id="header-avatar"], [data-test-id="homefeed-feed"]', {
      timeout: 20000
    });
    
    return true;
  } catch (error) {
    console.error('❌ Cookie auth failed:', error.message);
    return false;
  }
}

async function verifyImageUrl(page, url) {
  if (!url) return false;
  try {
    const response = await page.evaluate(async (url) => {
      const res = await fetch(url, { method: 'HEAD' });
      return res.ok;
    }, url);
    return response;
  } catch {
    return false;
  }
}

async function scrapePinterestBoard(shareLink) {
  console.log(`\n🔄 Starting scrape for: ${shareLink}`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ]
  });
  
  try {
    console.log('🌐 Browser launched');
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
      permissions: ['geolocation'],
      bypassCSP: true,
    });
    
    const page = await context.newPage();
    console.log('📄 Page created');

    if (!await ensureLogin(page)) {
      throw new Error('Pinterest login failed - check your session cookie');
    }
    console.log('🔓 Login successful');

    console.log(`🔄 Navigating to: ${shareLink}`);
    await page.goto(shareLink, { 
      waitUntil: 'networkidle',
      timeout: 30000 // Increased timeout
    });
    console.log('📍 Navigation complete');
    
    await page.waitForTimeout(3000);
    console.log('⏳ Initial wait complete');
    
    await page.waitForSelector('img', { 
      timeout: 10000,
      state: 'attached'
    });
    console.log('🖼️ Images found');
    
    await page.waitForTimeout(3000);

    // Take screenshot for debugging
    await page.screenshot({ 
      path: './debug.png',
      fullPage: true 
    });
    console.log('📸 Debug screenshot saved');

    let pins = await page.evaluate(() => {
      const saveButtons = Array.from(document.querySelectorAll('svg[aria-label="Save"]'));
      console.log(`Found ${saveButtons.length} save buttons`);
      
      return saveButtons.map(btn => {
        const container = btn.closest('[data-test-id="pin"]') || 
                         btn.closest('[role="listitem"]');
        
        if (!container) {
          console.log('No container found for save button');
          return null;
        }

        const img = container.querySelector('img');
        const link = container.querySelector('a[href*="/pin/"]');
        
        const imgSrc = img?.src?.replace(/\/\d+x\//, '/originals/').replace(/\?fit=.*$/, '');
        
        return {
          id: link?.href?.match(/\/pin\/(\d+)/)?.[1] || Date.now().toString(),
          title: img?.alt || '',
          image: imgSrc,
          url: link?.href,
          description: container.textContent?.trim() || ''
        };
      }).filter(Boolean);
    });

    console.log(`🔍 Found ${pins.length} potential pins`);

    const verifiedPins = [];
    for (const pin of pins) {
      if (await verifyImageUrl(page, pin.image)) {
        verifiedPins.push(pin);
      }
    }
    console.log(`✅ Verified ${verifiedPins.length} pins`);

    return verifiedPins;

  } catch (error) {
    console.error('❌ Scraping failed:', error);
    console.error('Full error:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    return [];
  } finally {
    await browser.close();
    console.log('🔒 Browser closed');
  }
}

async function scrapeAllBoards() {
  console.log('🔍 Starting Pinterest scrape...');
  
  // Debug: Print config
  console.log('📋 Config:', JSON.stringify(config, null, 2));
  
  await fs.mkdir('./data', { recursive: true });
  console.log('📁 Created data directory');
  
  for (const feed of config.feeds) {
    console.log(`\n🎯 Processing feed: ${feed.id}`);
    console.log(`🔗 Share link: ${feed.shareLink}`);
    
    const pins = await scrapePinterestBoard(feed.shareLink);
    console.log(`📌 Found ${pins.length} pins`);
    
    if (pins.length > 0) {
      const dataPath = `./data/${feed.id}.json`;
      await fs.writeFile(dataPath, JSON.stringify(pins, null, 2));
      console.log(`✨ Saved pins to: ${dataPath}`);
    } else {
      console.error(`❌ No pins found for ${feed.id}`);
    }
  }
  
  console.log('\n✅ Done scraping all boards!');
}

// Clean up old debug screenshots if they exist
fs.rm('./debug-screenshots', { recursive: true, force: true })
  .then(() => scrapeAllBoards());