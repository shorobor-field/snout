// test-rss.js
import RSS from 'rss';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_SECTIONS = [
  {
    title: "1. Basic HTML",
    html: `
      <h1>Basic HTML Test</h1>
      <p>Regular paragraph</p>
      <b>Bold text</b>
      <i>Italic text</i>
      <a href="https://example.com">Link</a>
      <br>
      <hr>
    `
  },
  // ... other test sections same as before ...
];

async function generateTestFeed() {
  const feed = new RSS({
    title: "RSS Compatibility Test Feed",
    description: "Testing what HTML/CSS features work in RSS readers",
    feed_url: "http://example.com/rss.xml",
    site_url: "http://example.com",
    pubDate: new Date()
  });

  // Create combined test item
  const combinedHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body>
      <h1>RSS Compatibility Test</h1>
      <p>Testing various HTML and CSS features. Each section tests different features.</p>
      <hr>
      ${TEST_SECTIONS.map(section => `
        <div style="margin: 20px 0;">
          <h2>${section.title}</h2>
          ${section.html}
          <hr>
        </div>
      `).join('')}
    </body>
    </html>
  `;

  feed.item({
    title: "HTML/CSS Compatibility Test",
    description: combinedHtml,
    url: "http://example.com/test",
    guid: "test-" + Date.now(),
    date: new Date()
  });

  // Save to test-feed.xml in current directory
  const outputPath = path.join(__dirname, 'test-feed.xml');
  await fs.writeFile(outputPath, feed.xml({ indent: true }));
  console.log('✨ Generated test feed at:', outputPath);
}

generateTestFeed();