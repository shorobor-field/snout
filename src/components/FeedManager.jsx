import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlusCircle, Trash2, Calendar } from 'lucide-react';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const FeedManager = () => {
  const [feeds, setFeeds] = useState([]);
  const [newFeed, setNewFeed] = useState({
    id: '',
    title: '',
    description: '',
    boardUrl: '',
    schedule: DAYS.reduce((acc, day) => ({ ...acc, [day]: false }), {})
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const extractBoardId = (url) => {
    const match = url.match(/pinterest\.com\/.*\/(.+?)(\/|$)/);
    return match ? match[1] : null;
  };

  const handleScheduleChange = (day) => {
    setNewFeed(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: !prev.schedule[day]
      }
    }));
  };

  const handleAddFeed = async () => {
    setError('');
    setSuccess('');

    if (!newFeed.id || !newFeed.title || !newFeed.boardUrl) {
      setError('please fill in all required fields');
      return;
    }

    if (!Object.values(newFeed.schedule).some(Boolean)) {
      setError('select at least one day for the feed');
      return;
    }

    const boardId = extractBoardId(newFeed.boardUrl);
    if (!boardId) {
      setError('invalid pinterest board url');
      return;
    }

    const feedData = {
      ...newFeed,
      boardId
    };

    try {
      const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedData)
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setFeeds([...feeds, feedData]);
      setSuccess('feed added successfully!');
      setNewFeed({
        id: '', 
        title: '', 
        description: '', 
        boardUrl: '',
        schedule: DAYS.reduce((acc, day) => ({ ...acc, [day]: false }), {})
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Feed Scheduler
        </CardTitle>
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

          <div className="space-y-4">
            <Input
              placeholder="feed id (e.g., nature-pics)"
              value={newFeed.id}
              onChange={(e) => setNewFeed({ ...newFeed, id: e.target.value })}
            />
            <Input
              placeholder="feed title"
              value={newFeed.title}
              onChange={(e) => setNewFeed({ ...newFeed, title: e.target.value })}
            />
            <Input
              placeholder="description (optional)"
              value={newFeed.description}
              onChange={(e) => setNewFeed({ ...newFeed, description: e.target.value })}
            />
            <Input
              placeholder="pinterest board url"
              value={newFeed.boardUrl}
              onChange={(e) => setNewFeed({ ...newFeed, boardUrl: e.target.value })}
            />
            
            <div className="space-y-2">
              <p className="text-sm font-medium">schedule feed for:</p>
              <div className="flex flex-wrap gap-4">
                {DAYS.map(day => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={day}
                      checked={newFeed.schedule[day]}
                      onCheckedChange={() => handleScheduleChange(day)}
                    />
                    <label
                      htmlFor={day}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {day}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleAddFeed}
              className="w-full flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              add feed
            </Button>
          </div>

          <div className="space-y-2">
            {feeds.map(feed => (
              <div key={feed.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{feed.title}</h3>
                    <p className="text-sm text-gray-500">{feed.description}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleRemoveFeed(feed.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(feed.schedule).map(([day, enabled]) => (
                    enabled && (
                      <span key={day} className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {day}
                      </span>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeedManager;