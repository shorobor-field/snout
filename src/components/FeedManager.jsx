import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlusCircle, Trash2, Calendar, Github } from 'lucide-react';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const GITHUB_TOKEN_KEY = 'github_token';

const FeedManager = () => {
  const [feeds, setFeeds] = useState([]);
  const [githubToken, setGithubToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newFeed, setNewFeed] = useState({
    id: '',
    title: '',
    description: '',
    boardUrl: '',
    schedule: DAYS.reduce((acc, day) => ({ ...acc, [day]: false }), {})
  });

  useEffect(() => {
    // Load GitHub token from localStorage
    const token = localStorage.getItem(GITHUB_TOKEN_KEY);
    if (token) {
      setGithubToken(token);
      setIsAuthenticated(true);
    }
    
    // Load current config
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('https://raw.githubusercontent.com/shorobor-field/snout/main/config.json');
      const config = await response.json();
      setFeeds(config.feeds);
    } catch (err) {
      setError('failed to load current config');
    }
  };

  const handleAuth = () => {
    // In real usage, replace YOUR_CLIENT_ID with actual GitHub OAuth app client ID
    window.location.href = `https://github.com/login/oauth/authorize?client_id=YOUR_CLIENT_ID&scope=workflow`;
  };

  const handleLogout = () => {
    localStorage.removeItem(GITHUB_TOKEN_KEY);
    setGithubToken('');
    setIsAuthenticated(false);
  };

  const triggerWorkflow = async (newConfig) => {
    try {
      const response = await fetch(
        'https://api.github.com/repos/shorobor-field/snout/actions/workflows/update-config.yml/dispatches',
        {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${githubToken}`,
          },
          body: JSON.stringify({
            ref: 'main',
            inputs: {
              config: JSON.stringify(newConfig, null, 2),
              commit_message: `Update config.json via UI - ${new Date().toISOString()}`
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to trigger workflow');
      }

      return true;
    } catch (err) {
      console.error('Workflow trigger error:', err);
      return false;
    }
  };

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
    if (!isAuthenticated) {
      setError('please login with github first');
      return;
    }

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

    const newConfig = {
      feeds: [...feeds, feedData]
    };

    const success = await triggerWorkflow(newConfig);
    
    if (success) {
      setFeeds(newConfig.feeds);
      setSuccess('feed added successfully! changes will appear in a few minutes');
      setNewFeed({
        id: '', 
        title: '', 
        description: '', 
        boardUrl: '',
        schedule: DAYS.reduce((acc, day) => ({ ...acc, [day]: false }), {})
      });
    } else {
      setError('failed to update config. check your github permissions');
    }
  };

  const handleRemoveFeed = async (feedId) => {
    if (!isAuthenticated) {
      setError('please login with github first');
      return;
    }

    const newConfig = {
      feeds: feeds.filter(feed => feed.id !== feedId)
    };

    const success = await triggerWorkflow(newConfig);
    
    if (success) {
      setFeeds(newConfig.feeds);
      setSuccess('feed removed successfully! changes will appear in a few minutes');
    } else {
      setError('failed to remove feed. check your github permissions');
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Feed Manager
          </div>
          {isAuthenticated ? (
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          ) : (
            <Button onClick={handleAuth} className="flex items-center gap-2">
              <Github className="w-4 h-4" />
              Login with GitHub
            </Button>
          )}
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

          {isAuthenticated && (
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
                Add Feed
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {feeds.map(feed => (
              <div key={feed.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{feed.title}</h3>
                    <p className="text-sm text-gray-500">{feed.description}</p>
                  </div>
                  {isAuthenticated && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleRemoveFeed(feed.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(feed.schedule || {}).map(([day, enabled]) => (
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