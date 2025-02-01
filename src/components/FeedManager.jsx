import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlusCircle, Trash2 } from 'lucide-react';

const FeedManager = () => {
  const [feeds, setFeeds] = useState([]);
  const [newFeed, setNewFeed] = useState({
    id: '',
    title: '',
    description: '',
    shareLink: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Fetch existing feeds on component mount
    const fetchFeeds = async () => {
      try {
        const response = await fetch('/api/feeds');
        if (!response.ok) throw new Error('Failed to fetch feeds');
        const data = await response.json();
        setFeeds(data);
      } catch (err) {
        setError('Failed to load feeds: ' + err.message);
      }
    };

    fetchFeeds();
  }, []);

  const handleAddFeed = async () => {
    setError('');
    setSuccess('');

    if (!newFeed.id || !newFeed.title || !newFeed.shareLink) {
      setError('Please fill in all required fields');
      return;
    }

    if (!newFeed.shareLink.startsWith('https://pin.it/')) {
      setError('Invalid Pinterest share link. Please use a pin.it link');
      return;
    }

    try {
      const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newFeed)
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setFeeds([...feeds, newFeed]);
      setSuccess('Feed added successfully!');
      setNewFeed({ id: '', title: '', description: '', shareLink: '' });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveFeed = async (feedId) => {
    try {
      const response = await fetch(`/api/feeds/${feedId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setFeeds(feeds.filter(feed => feed.id !== feedId));
      setSuccess('Feed removed successfully!');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Feed Manager</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Input
              placeholder="Feed ID (e.g., nature-pics)"
              value={newFeed.id}
              onChange={(e) => setNewFeed({ ...newFeed, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
            />
            <Input
              placeholder="Feed Title"
              value={newFeed.title}
              onChange={(e) => setNewFeed({ ...newFeed, title: e.target.value })}
            />
            <Input
              placeholder="Description (optional)"
              value={newFeed.description}
              onChange={(e) => setNewFeed({ ...newFeed, description: e.target.value })}
            />
            <Input
              placeholder="Pinterest Board Share Link (pin.it/...)"
              value={newFeed.shareLink}
              onChange={(e) => setNewFeed({ ...newFeed, shareLink: e.target.value })}
            />
            <Button 
              onClick={handleAddFeed}
              className="w-full flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Add Feed
            </Button>
          </div>

          <div className="space-y-2">
            {feeds.map(feed => (
              <div key={feed.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">{feed.title}</h3>
                  <p className="text-sm text-gray-500">{feed.description}</p>
                  <p className="text-xs text-gray-400">{feed.shareLink}</p>
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleRemoveFeed(feed.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeedManager;