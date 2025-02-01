async function scrapePinterestBoard(shareLink) {
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
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
    });
    
    const page = await context.newPage();

    if (!await ensureLogin(page)) {
      throw new Error('Login failed');
    }

    // Just navigate directly to the pin.it link
    await page.goto(shareLink, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.waitForSelector('img', { timeout: 10000 });
    await page.waitForTimeout(3000);

    let pins = await page.evaluate(() => {
      const saveButtons = Array.from(document.querySelectorAll('svg[aria-label="Save"]'));
      return saveButtons.map(btn => {
        const container = btn.closest('[data-test-id="pin"]') || 
                         btn.closest('[role="listitem"]');
        
        if (!container) return null;

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

    const verifiedPins = [];
    for (const pin of pins) {
      if (await verifyImageUrl(page, pin.image)) {
        verifiedPins.push(pin);
      }
    }

    return verifiedPins;

  } catch (error) {
    console.error(`Failed scraping board ${shareLink}:`, error);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeAllBoards() {
  console.log('Starting Pinterest scrape...');
  await fs.mkdir('./data', { recursive: true });
  
  for (const feed of config.feeds) {
    const pins = await scrapePinterestBoard(feed.shareLink);
    
    if (pins.length > 0) {
      await fs.writeFile(
        `./data/${feed.id}.json`,
        JSON.stringify(pins, null, 2)
      );
      console.log(`✨ Saved ${pins.length} pins for ${feed.id}`);
    } else {
      console.error(`No pins found for ${feed.id}`);
    }
  }
  
  console.log('Done scraping all boards!');
}