import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";

interface Image {
  id: number;
  title: string;
  description: string;
  artist: string;
  file_path: string;
  stars: number;
  num_votes: number;
  created_at: string;
  hidden: boolean;
}

const AdminView: React.FC = () => {
  const [images, setImages] = useState<Image[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchImages();
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    const response = await fetch('/api/check-auth');
    if (response.ok) {
      setIsAuthenticated(true);
    }
  };

  const fetchImages = async () => {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching images:', error);
      setError('Failed to fetch images');
    } else {
      setImages(data || []);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      setIsAuthenticated(true);
    } else {
      setError('Invalid credentials');
    }
  };

  const handleToggleHidden = async (id: number, currentHiddenState: boolean) => {
    const { error } = await supabase
      .from('images')
      .update({ hidden: !currentHiddenState })
      .eq('id', id);

    if (error) {
      console.error('Error updating image:', error);
      setError('Failed to update image');
    } else {
      setImages(images.map(img => 
        img.id === id ? { ...img, hidden: !currentHiddenState } : img
      ));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="submit" className="w-full">Login</Button>
            </form>
            {error && <p className="text-red-500 mt-2">{error}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin View</h1>
      <Button onClick={() => router.push('/')} className="mb-4">Back to Gallery</Button>
      <div className="space-y-4">
        {images.map(image => (
          <Card key={image.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <h2 className="font-bold">{image.title}</h2>
                <p>Artist: {image.artist}</p>
                <p>Description: {image.description}</p>
                <p>Stars: {image.stars}</p>
                <p>Votes: {image.num_votes}</p>
                <p>Created: {new Date(image.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span>{image.hidden ? 'Hidden' : 'Visible'}</span>
                <Switch
                  checked={!image.hidden}
                  onCheckedChange={() => handleToggleHidden(image.id, image.hidden)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminView;