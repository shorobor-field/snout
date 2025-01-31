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

    console.log('🔑 attempting login...');
    await page.goto('https://pinterest.com/login', { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
    
    await page.fill('#email', PINTEREST_EMAIL);
    await page.fill('#password', PINTEREST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    console.log(`🎯 getting suggestions for board ${boardId}...`);
    await page.goto(`https://pinterest.com/ideas/${boardId}`, { timeout: 60000 });
    await page.waitForTimeout(3000);

    // Scroll a few times to ensure content loads
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await page.waitForTimeout(1000);
    }

    const pins = await page.evaluate(() => {
      // Get all pins after "More ideas for this board"
      const allDivs = Array.from(document.querySelectorAll('div'));
      const moreIdeasDiv = allDivs.find(div => 
        div.textContent?.includes('More ideas for this board')
      );
      
      if (!moreIdeasDiv) {
        console.log('Could not find More ideas section');
        return [];
      }

      // Get all pins in the grid after "More ideas"
      const suggestions = Array.from(document.querySelectorAll('[data-grid-item="true"]'))
        .filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.top > moreIdeasDiv.getBoundingClientRect().bottom;
        });

      return suggestions.map(pin => {
        const img = pin.querySelector('img');
        const link = pin.querySelector('a');
        const titleEl = pin.querySelector('[data-test-id="pin-title"]') || 
                       pin.querySelector('[title]');
        
        // Get the highest quality image URL
        let imageUrl = img?.src;
        if (imageUrl) {
          imageUrl = imageUrl.replace(/\/\d+x\//, '/originals/');
        }

        return {
          id: pin.getAttribute('data-pin-id') || Date.now().toString(),
          title: titleEl?.textContent?.trim() || titleEl?.getAttribute('title')?.trim() || 'Untitled Pin',
          description: pin.querySelector('[data-test-id="pin-description"]')?.textContent?.trim() || '',
          image: imageUrl,
          url: link?.href
        };
      }).filter(pin => pin.url && pin.image);
    });

    console.log(`📌 Found ${pins.length} suggestion pins`);
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
      console.error(`⚠️ No pins found for ${feed.id}, trying alternate method...`);
      // You could add fallback scraping method here if needed
    }
  }
  
  console.log('✨ done scraping all boards!');
}

scrapeAllBoards();