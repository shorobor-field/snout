// src/api/feeds.js
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

async function readConfig() {
  try {
    const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    return { feeds: [] };
  }
}

async function writeConfig(config) {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function addFeed(req, res) {
  try {
    const { id, title, description, boardId } = req.body;

    if (!id || !title || !boardId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const config = await readConfig();
    
    // Check for duplicate ID
    if (config.feeds.some(feed => feed.id === id)) {
      return res.status(400).json({ error: 'Feed ID already exists' });
    }

    config.feeds.push({ id, title, description, boardId });
    await writeConfig(config);

    res.status(200).json({ message: 'Feed added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function removeFeed(req, res) {
  try {
    const { id } = req.params;
    const config = await readConfig();
    
    config.feeds = config.feeds.filter(feed => feed.id !== id);
    await writeConfig(config);

    res.status(200).json({ message: 'Feed removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getFeeds(req, res) {
  try {
    const config = await readConfig();
    res.status(200).json(config.feeds);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}