// ... imports stay the same ...

const FeedManager = () => {
  const [feeds, setFeeds] = useState([]);
  const [newFeed, setNewFeed] = useState({
    id: '',
    title: '',
    description: '',
    boardUrl: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAddFeed = async () => {
    setError('');
    setSuccess('');

    if (!newFeed.id || !newFeed.title || !newFeed.boardUrl) {
      setError('Please fill in all required fields');
      return;
    }

    // Basic URL validation
    if (!newFeed.boardUrl.includes('pinterest.com/')) {
      setError('Invalid Pinterest board URL');
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
      setNewFeed({ id: '', title: '', description: '', boardUrl: '' });
    } catch (err) {
      setError(err.message);
    }
  };

  // ... rest of the component stays the same ...
};