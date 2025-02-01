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
  {
    title: "2. Tables",
    html: `
      <table border="1">
        <tr>
          <td>Table cell 1</td>
          <td>Table cell 2</td>
        </tr>
      </table>
    `
  },
  {
    title: "3. Images",
    html: `
      <img src="https://placekitten.com/200/200" alt="Test image">
      <figure>
        <img src="https://placekitten.com/201/201" alt="Test figure image">
        <figcaption>Image caption</figcaption>
      </figure>
    `
  },
  {
    title: "4. Basic inline CSS",
    html: `
      <p style="color: blue;">Blue text</p>
      <p style="font-size: 20px;">Large text</p>
      <p style="font-family: Arial;">Arial font</p>
      <div style="padding: 10px; margin: 10px;">Padded and margined div</div>
    `
  },
  {
    title: "5. CSS classes with style tag",
    html: `
      <style>
        .test-class { color: red; }
        .box { padding: 10px; background: #eee; }
      </style>
      <p class="test-class">Red text via class</p>
      <div class="box">Box with background</div>
    `
  },
  {
    title: "6. Flexbox layout",
    html: `
      <div style="display: flex; gap: 10px;">
        <div style="flex: 1;">Flex item 1</div>
        <div style="flex: 1;">Flex item 2</div>
      </div>
    `
  },
  {
    title: "7. Grid layout",
    html: `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div>Grid item 1</div>
        <div>Grid item 2</div>
      </div>
    `
  }
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