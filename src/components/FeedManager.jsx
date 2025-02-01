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

  // ... rest of the component stays the same

  return (
    <Card className="w-full max-w-2xl mx-auto">
      {/* ... other JSX stays the same */}
      <Input
        placeholder="Pinterest Board Share Link (pin.it/...)"
        value={newFeed.shareLink}
        onChange={(e) => setNewFeed({ ...newFeed, shareLink: e.target.value })}
      />
      {/* ... rest of JSX stays the same */}
    </Card>
  );
};