// preview-test.js
import RSS from 'rss';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generatePreviewFeed() {
  const feed = new RSS({
    title: "RSS Preview Test",
    description: "Testing elegant mobile-friendly layout",
    feed_url: "https://shorobor-field.github.io/snout/feeds/preview.xml",
    site_url: "https://pinterest.com",
    pubDate: new Date()
  });

  // Mock pins data  
  const pins = [
    {
      title: "Modern Minimalist Living Room",
      description: "Clean lines and natural light create a peaceful sanctuary",
      image: "https://placekitten.com/800/600", 
      url: "https://pinterest.com/pin/1"
    },
    {
      title: "Japanese-Inspired Garden",
      description: "Zen garden with carefully placed stones and manicured plants",
      image: "https://placekitten.com/801/600",
      url: "https://pinterest.com/pin/2"
    },
    {
      title: "Contemporary Kitchen Design",
      description: "Sleek fixtures and marble countertops define this space",
      image: "https://placekitten.com/802/600",
      url: "https://pinterest.com/pin/3"
    }
  ];

  const previewHtml = `
    <!-- Try loading custom font -->
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300&display=swap" rel="stylesheet">

    <div style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: Georgia, serif;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 3em; color: #1a1a1a; margin: 0; font-weight: 300;">Snout Digest</h1>
        <h2 style="font-weight: normal; color: #666; margin: 10px 0;">Pinterest Vibes: Architecture & Design</h2>
      </div>

      <!-- Divider -->
      <div style="text-align: center; margin: 30px 0;">
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      </div>

      <!-- Grid using flexbox -->
      <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;">
        ${pins.map(pin => `
          <div style="flex: 1 1 300px; max-width: 400px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="position: relative; padding-top: 75%; overflow: hidden;">
              <img src="${pin.image}" alt="${pin.title}" 
                   style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">
            </div>
            <div style="padding: 16px;">
              <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #1a1a1a;">${pin.title}</h3>
              <p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">${pin.description}</p>
              <a href="${pin.url}" style="color: #666; text-decoration: none; font-size: 14px;">
                View ↗️
              </a>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 40px; color: #666;">
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p>🐕 woof woof!</p>
      </div>
    </div>
  `;

  feed.item({
    title: "Design Inspiration - Latest Pins",
    description: previewHtml,
    url: "https://pinterest.com/board/test",
    guid: "preview-" + Date.now(),
    date: new Date()
  });

  const outputPath = path.join(__dirname, '..', 'public', 'feeds', 'preview.xml');
  await fs.mkdir(path.join(__dirname, '..', 'public', 'feeds'), { recursive: true });
  await fs.writeFile(outputPath, feed.xml({ indent: true }));
  console.log('✨ Generated preview feed at:', outputPath);
}

generatePreviewFeed();