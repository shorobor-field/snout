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

    console.log(`🎯 navigating to suggestions for board ${boardId}...`);
    // Use the correct URL format for board suggestions
    await page.goto(`https://pinterest.com/?boardId=${boardId}`, { timeout: 60000 });
    await page.waitForTimeout(5000);

    // Wait for and scroll to the "More ideas" section
    const moreIdeasText = await page.getByText('More ideas for this board');
    await moreIdeasText.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);

    // Scroll a bit more to load suggestions
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
            const moreIdeas = document.querySelector('div:has-text("More ideas for this board")');
            if (moreIdeas) {
                moreIdeas.scrollIntoView({ behavior: 'smooth', block: 'start' });
                window.scrollBy(0, 500); // Scroll a bit more to load content below "More ideas"
            }
        });
        await page.waitForTimeout(2000);
    }

    // Extract pins specifically from the suggestions section
    const pins = await page.evaluate(() => {
        // Find the "More ideas" section
        const moreIdeasText = Array.from(document.querySelectorAll('div'))
            .find(div => div.textContent.includes('More ideas for this board'));
        
        if (!moreIdeasText) {
            console.log('Could not find "More ideas" section');
            return [];
        }

        // Get pins from the next sibling elements (the suggestions)
        const suggestionsContainer = moreIdeasText.parentElement;
        const pins = suggestionsContainer.querySelectorAll('[data-test-id="pin"], [data-test-id="pinrep"], .Grid__Item');
        
        console.log(`Found ${pins.length} suggestion pins`);
        
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

    console.log(`📌 Found ${pins.length} suggestion pins for board ${boardId}`);
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