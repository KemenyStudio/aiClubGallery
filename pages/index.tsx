import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Star, Plus, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";

interface Image {
  id: number;
  title: string;
  description: string;
  artist: string;
  file_path: string;
  stars: number;
  num_votes: number;
  created_at: string;
}

type GalleryItem = Image | null;

const Skeleton: React.FC<React.HTMLProps<HTMLDivElement>> = ({ className, ...props }) => {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded-md ${className}`}
      {...props}
    />
  )
}

const Home: React.FC = () => {
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [artist, setArtist] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<{[key: number]: boolean}>({});

  const observer = useRef<IntersectionObserver | null>(null);
  const lastImageElementRef = useCallback((node: HTMLElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchImages();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  const fetchImages = useCallback(async () => {
    if (!hasMore || loading) return;

    try {
      setLoading(true);
      let query = supabase
        .from('images')
        .select('*')
        .eq('hidden', false)  // Only fetch non-hidden images
        .order('created_at', { ascending: false })
        .limit(5);

      if (lastFetchedAt) {
        query = query.lt('created_at', lastFetchedAt);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data.length === 0) {
        setHasMore(false);
      } else {
        setImages(prevImages => [...prevImages, ...data]);
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
    const storedVotes = JSON.parse(localStorage.getItem('userVotes') || '{}');
    setUserVotes(storedVotes);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file || !title || !description || !artist) {
      setError('All fields are required');
      return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const bucketName = 'images';

    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file);

      if (error) throw error;

      if (!data || !data.path) {
        throw new Error('Upload successful but file path is missing');
      }

      const { error: insertError } = await supabase
        .from('images')
        .insert({ 
          title, 
          description, 
          artist, 
          file_path: data.path,
          stars: 0,
          num_votes: 0
        });

      if (insertError) throw insertError;

      setTitle('');
      setDescription('');
      setArtist('');
      setFile(null);
      setShowForm(false);
      setImages([]);
      setLastFetchedAt(null);
      setHasMore(true);
      fetchImages();

    } catch (error) {
      console.error('Error in handleSubmit:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred');
      }
    }
  };

  const handleRate = async (id: number) => {
    try {
      if (userVotes[id]) {
        return; // User has already voted, do nothing
      }

      const image = images.find(img => img?.id === id);
      if (!image) return;

      const { error } = await supabase
        .from('images')
        .update({ 
          stars: image.stars + 1,
          num_votes: image.num_votes + 1
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setImages(prevImages => prevImages.map(img => 
        img?.id === id ? { ...img, stars: img.stars + 1, num_votes: img.num_votes + 1 } : img
      ));

      // Update userVotes state and localStorage
      const newUserVotes = { ...userVotes, [id]: true };
      setUserVotes(newUserVotes);
      localStorage.setItem('userVotes', JSON.stringify(newUserVotes));

    } catch (error) {
      console.error('Error updating rating:', error);
      setError('Failed to update rating. Please try again.');
    }
  };

  const renderGalleryItem = (item: GalleryItem, index: number) => (
    <Card key={item ? item.id : `skeleton-${index}`} className="flex flex-col" ref={index === images.length - 1 ? lastImageElementRef : null}>
      <CardHeader>
        <CardTitle className="text-lg">
          {item ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {item.title}
                </TooltipTrigger>
                <TooltipContent>
                  {`${item.artist} ${item.description}`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Skeleton className="h-6 w-3/4" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        {item ? (
          <img
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${item.file_path}`}
            alt={item.title}
            className="w-full h-48 object-cover rounded-md"
          />
        ) : (
          <Skeleton className="w-full h-48 rounded-md" />
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        {item ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleRate(item.id)}
                  disabled={userVotes[item.id]}
                >
                  {userVotes[item.id] ? (
                    <Star className="mr-2 h-4 w-4" fill="currentColor" />
                  ) : (
                    <Star className="mr-2 h-4 w-4" />
                  )}
                  {item.stars} ({item.num_votes})
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {userVotes[item.id] ? "You&apos;ve already voted" : "Click to vote"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Skeleton className="h-8 w-24" />
        )}
      </CardFooter>
    </Card>
  );

  return (
    <div className="max-w-full mx-auto p-4 pb-16">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      {showForm ? (
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Sube tu imagen</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input 
                type="file" 
                accept="image/*" 
                onChange={(e) => setFile(e.target.files?.[0] || null)} 
                className="mb-2"
                required
              />
              <Input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="Titulo" 
                required
              />
              <Textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                placeholder="Prompt" 
                required
              />
              <Input 
                value={artist} 
                onChange={(e) => setArtist(e.target.value)} 
                placeholder="Tu correo" 
                required
              />
              <Button type="submit" className="w-full">Publicar</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowForm(true)} className="mb-8 w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Subir
        </Button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {images.map((item, index) => renderGalleryItem(item, index))}
      </div>

      {loading && (
        <div className="flex justify-center items-center mt-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}

      {!loading && !hasMore && images.length > 0 && (
        <p className="text-center mt-4 text-gray-500">No more images to load.</p>
      )}

      <footer className="fixed bottom-0 left-0 right-0 bg-white p-4 text-center border-t">
        Bienvenido a la galería de <a href="https://chat.whatsapp.com/CkyVG6bcrMB5nwkDhSX8jz">/Imagine AI</a> de <a href="https://elclubdelaia.com/">El Club de La IA</a>
      </footer>
    </div>
  );
}

export default Home;