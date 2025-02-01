import { chromium } from 'playwright';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import config from '../config.json' assert { type: 'json' };

const PINTEREST_EMAIL = process.env.PINTEREST_EMAIL;
const PINTEREST_PASSWORD = process.env.PINTEREST_PASSWORD;

async function scrapePinterestBoard(boardId) {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--window-size=1920,1080']
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
    });
    
    const page = await context.newPage();

    // Add debug logging
    page.on('console', msg => console.log('Browser log:', msg.text()));

    console.log('🔑 attempting login...');
    await page.goto('https://pinterest.com/login', { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
    
    await page.fill('#email', PINTEREST_EMAIL);
    await page.fill('#password', PINTEREST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    console.log(`🎯 getting suggestions for board ${boardId}...`);
    const url = `https://pinterest.com/?boardId=${boardId}`;
    console.log('Navigating to:', url);
    await page.goto(url, { timeout: 60000 });
    
    // Wait longer and log progress
    console.log('Waiting for initial load...');
    await page.waitForTimeout(5000);

    // Scroll and log progress
    console.log('Starting scrolls...');
    for (let i = 0; i < 5; i++) {
      await page.evaluate((i) => {
        window.scrollBy(0, window.innerHeight);
        console.log(`Scroll ${i + 1} completed`);
      }, i);
      await page.waitForTimeout(2000);
    }

    // Debug page content
    console.log('Analyzing page content...');
    const debugInfo = await page.evaluate(() => {
      const texts = Array.from(document.querySelectorAll('div'))
        .map(div => div.textContent)
        .filter(text => text && text.includes('More ideas'));
      
      const gridItems = document.querySelectorAll('[data-grid-item="true"]');
      const images = document.querySelectorAll('img');
      
      return {
        foundMoreIdeasTexts: texts,
        totalGridItems: gridItems.length,
        totalImages: images.length,
        pageHeight: document.body.scrollHeight,
        viewportHeight: window.innerHeight
      };
    });
    
    console.log('Debug info:', debugInfo);

    const pins = await page.evaluate(() => {
      // Try different selectors
      const selectors = [
        '[data-grid-item="true"]',
        '[data-test-id="pin"]',
        '[data-test-id="pinrep"]',
        '.Grid__Item'
      ];
      
      let suggestions = [];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`Found ${elements.length} elements with selector ${selector}`);
        if (elements.length > 0) {
          suggestions = Array.from(elements);
          break;
        }
      }

      return suggestions.map(pin => {
        const img = pin.querySelector('img');
        const link = pin.querySelector('a');
        const titleEl = pin.querySelector('[data-test-id="pin-title"]') || 
                       pin.querySelector('[title]');
        
        let imageUrl = img?.src;
        if (imageUrl) {
          imageUrl = imageUrl.replace(/\/\d+x\//, '/originals/');
        }

        const pinData = {
          id: pin.getAttribute('data-pin-id') || Date.now().toString(),
          title: titleEl?.textContent?.trim() || titleEl?.getAttribute('title')?.trim() || 'Untitled Pin',
          description: pin.querySelector('[data-test-id="pin-description"]')?.textContent?.trim() || '',
          image: imageUrl,
          url: link?.href
        };
        
        console.log('Extracted pin data:', pinData);
        return pinData;
      }).filter(pin => pin.url && pin.image);
    });

    console.log(`📌 Found ${pins.length} suggestion pins`);
    return pins;

  } catch (error) {
    console.error(`💀 failed scraping board ${boardId}:`, error);
    
    // Log the full error with stack trace
    console.error('Detailed error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
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