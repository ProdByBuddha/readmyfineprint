import { useState, useEffect } from 'react';

export default function BlogPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Simple fetch without any complex logic
    console.log('Blog page mounted, fetching posts...');
    
    fetch('/api/blog/posts')
      .then(response => {
        console.log('Response received:', response.status);
        return response.json();
      })
      .then(data => {
        console.log('Data received:', data);
        setPosts(data.posts || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Blog Posts</h1>
      
      {loading && <p>Loading...</p>}
      
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      
      {!loading && !error && posts.length === 0 && (
        <p>No posts found</p>
      )}
      
      {!loading && !error && posts.length > 0 && (
        <div>
          <p>Found {posts.length} posts:</p>
          {posts.map((post: any) => (
            <div key={post.id} style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
              <small>{new Date(post.publishedAt).toLocaleDateString()}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}