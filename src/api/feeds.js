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
    const { id, title, description, boardId, schedule } = req.body;

    if (!id || !title || !boardId || !schedule) {
      return res.status(400).json({ error: 'missing required fields' });
    }

    // validate schedule has at least one day enabled
    if (!Object.values(schedule).some(Boolean)) {
      return res.status(400).json({ error: 'select at least one day' });
    }

    const config = await readConfig();
    if (config.feeds.some(feed => feed.id === id)) {
      return res.status(400).json({ error: 'feed id already exists' });
    }

    config.feeds.push({ id, title, description, boardId, schedule });
    await writeConfig(config);

    res.status(200).json({ message: 'feed added successfully' });
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

    res.status(200).json({ message: 'feed removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateFeed(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const config = await readConfig();
    const feedIndex = config.feeds.findIndex(feed => feed.id === id);
    
    if (feedIndex === -1) {
      return res.status(404).json({ error: 'feed not found' });
    }

    // validate schedule if it's being updated
    if (updates.schedule && !Object.values(updates.schedule).some(Boolean)) {
      return res.status(400).json({ error: 'select at least one day' });
    }

    config.feeds[feedIndex] = { ...config.feeds[feedIndex], ...updates };
    await writeConfig(config);

    res.status(200).json({ message: 'feed updated successfully' });
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