import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Star, Plus, X, Bot, Github, InfoIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import ReactDOM from 'react-dom';

interface Image {
  id: number;
  title: string;
  description: string;
  artist: string;
  artist_name: string;
  file_path: string | null;
  youtube_link: string | null;
  stars: number;
  num_votes: number;
  created_at: string;
}

const Home: React.FC = () => {
  const [images, setImages] = useState<Image[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', artist: '', artistName: '', youtubeLink: '' });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<{ [key: number]: boolean }>({});

  const observer = useRef<IntersectionObserver | null>(null);

  const lastImageElementRef = useCallback((node: HTMLElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) fetchImages();
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  const fetchImages = useCallback(async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      let query = supabase.from('images').select('*').eq('hidden', false).order('created_at', { ascending: false }).limit(5);
      if (lastFetchedAt) query = query.lt('created_at', lastFetchedAt);
      const { data, error } = await query;
      if (error) throw error;
      if (data.length === 0) setHasMore(false);
      else {
        ReactDOM.flushSync(() => {
          setImages(prev => [...prev, ...data]);
        });
        setLastFetchedAt(data[data.length - 1].created_at);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      setError('Failed to fetch images. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, lastFetchedAt]);

  useEffect(() => {
    fetchImages();
    setUserVotes(JSON.parse(localStorage.getItem('userVotes') || '{}'));
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoadingSubmit(true);
    const { title, description, artist, artistName, youtubeLink } = formData;
    if ((!file && !youtubeLink) || !title || !description || !artist || !artistName) {
      setError('All fields are required. Please provide either a file or a YouTube link.');
      setLoadingSubmit(false);
      return;
    }
    try {
      let file_path: string | null = null;
      if (file) {
        const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
        const { data, error } = await supabase.storage.from('images').upload(fileName, file);
        if (error) throw error;
        file_path = data?.path || null;
      }
      if (!file_path && youtubeLink) {
        file_path = '';
      }
      const { data: insertData, error: insertError } = await supabase.from('images').insert({
        title, description, artist, artist_name: artistName, file_path, youtube_link: youtubeLink || null,
        stars: 0, num_votes: 0, hidden: false
      });
      if (insertError) throw insertError;

      setFormData({ title: '', description: '', artist: '', artistName: '', youtubeLink: '' });
      setFile(null);
      setShowForm(false);
      ReactDOM.flushSync(() => {
        setImages([]);
        setLastFetchedAt(null);
        setHasMore(true);
      });
      await fetchImages();
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setError('An unexpected error occurred. Please check the console for more details.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleRate = async (id: number) => {
    if (userVotes[id]) return;
    try {
      const image = images.find(img => img.id === id);
      if (!image) return;
      const { error } = await supabase.from('images')
        .update({ stars: image.stars + 1, num_votes: image.num_votes + 1 })
        .eq('id', id);
      if (error) throw error;
      ReactDOM.flushSync(() => {
        setImages(prev => prev.map(img => 
          img.id === id ? { ...img, stars: img.stars + 1, num_votes: img.num_votes + 1 } : img
        ));
      });
      const newUserVotes = { ...userVotes, [id]: true };
      setUserVotes(newUserVotes);
      localStorage.setItem('userVotes', JSON.stringify(newUserVotes));
    } catch (error) {
      console.error('Error updating rating:', error);
      setError('Failed to update rating. Please try again.');
    }
  };

  const renderGalleryItem = (item: Image, index: number) => (
    <Card key={item.id} className="flex flex-col" ref={index === images.length - 1 ? lastImageElementRef : null}>
      <CardHeader>
        <CardTitle className="text-lg">{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        {item.youtube_link ? (
          <iframe
            width="100%"
            height="200"
            src={`https://www.youtube.com/embed/${item.youtube_link.split('v=')[1]}`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        ) : item.file_path ? (
          <img
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${item.file_path}`}
            alt={item.title}
            className="w-full h-48 object-cover rounded-md"
          />
        ) : (
          <div className="w-full h-48 bg-gray-200 flex items-center justify-center rounded-md">
            No image or video available
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm">
                <InfoIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-bold">{item.title}</p>
              <p className="text-sm mt-1">Prompt: {item.description}</p>
              <p className="text-sm mt-1">Artist: {item.artist_name}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleRate(item.id)}
                disabled={userVotes[item.id]}
              >
                <Star className={`mr-2 h-4 w-4 ${userVotes[item.id] ? 'fill-current' : ''}`} />
                {item.stars} ({item.num_votes})
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {userVotes[item.id] ? "You've already voted" : "Click to vote"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardFooter>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Image Gallery</h1>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {showForm ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Upload New Image</span>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex space-x-4">
                <Input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={!!formData.youtubeLink}
                  className="flex-1"
                />
                <Input
                  name="youtubeLink"
                  value={formData.youtubeLink}
                  onChange={handleInputChange}
                  placeholder="YouTube Link"
                  disabled={!!file}
                  className="flex-1"
                />
              </div>
              <Input
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Title"
                required
              />
              <Textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Prompt"
                required
              />
              <Input
                name="artist"
                value={formData.artist}
                onChange={handleInputChange}
                placeholder="Your Email"
                required
              />
              <Input
                name="artistName"
                value={formData.artistName}
                onChange={handleInputChange}
                placeholder="Artist Name"
                required
              />
              <Button type="submit" className="w-full" disabled={loadingSubmit}>
                {loadingSubmit ? 'Uploading...' : 'Upload'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowForm(true)} className="mb-8">
          <Plus className="mr-2 h-4 w-4" /> Upload New Image
        </Button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {images.map((item, index) => renderGalleryItem(item, index))}
      </div>

      {loading && (
        <div className="flex justify-center items-center mt-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}

      {!loading && !hasMore && images.length > 0 && (
        <p className="text-center mt-8 text-gray-500">No more images to load.</p>
      )}

      <footer className="mt-16 border-t pt-8">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="flex items-center mb-4 sm:mb-0">
            <Bot className="h-5 w-5 text-blue-600 mr-2" />
            <span className="text-sm text-gray-600">
              Welcome to the /Imagine AI Gallery by El Club de La IA
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://github.com/yourusername/yourrepository"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <Github className="h-5 w-5" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>Star on GitHub</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://chat.whatsapp.com/CkyVG6bcrMB5nwkDhSX8jz"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    WhatsApp Group
                  </a>
                </TooltipTrigger>
                <TooltipContent>Join our WhatsApp group</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://elclubdelaia.com/"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    El Club de La IA
                  </a>
                </TooltipTrigger>
                <TooltipContent>Visit our website</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
