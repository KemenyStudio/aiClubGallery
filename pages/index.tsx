import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { ThumbsUp, Star, Plus, X } from 'lucide-react';

interface Image {
  id: number;
  title: string;
  description: string;
  artist: string;
  file_path: string;
  votes: number;
  stars: number;
  num_votes: number;
}

const Skeleton = ({ className, ...props }: React.HTMLProps<HTMLDivElement>) => {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded-md ${className}`}
      {...props}
    />
  )
}

export default function Home() {
  const [images, setImages] = useState<Image[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [artist, setArtist] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchImages();
  }, []);

  async function fetchImages() {
    try {
      const { data, error } = await supabase
        .from('images')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setImages(data || []);
    } catch (error) {
      console.error('Error fetching images:', error);
      setError('Failed to fetch images. Please try again later.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file || !title) {
      setError('File and title are required');
      return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const bucketName = 'images';

    console.log(`Attempting to upload ${fileName} to bucket: ${bucketName}`);

    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file);

      if (error) throw error;

      if (!data || !data.path) {
        throw new Error('Upload successful but file path is missing');
      }

      console.log('File uploaded successfully. Path:', data.path);

      const { data: imageData, error: insertError } = await supabase
        .from('images')
        .insert({ 
          title, 
          description, 
          artist, 
          file_path: data.path,
          votes: 0,
          stars: 0,
          num_votes: 0
        });

      if (insertError) throw insertError;

      console.log('Image data inserted successfully');

      setTitle('');
      setDescription('');
      setArtist('');
      setFile(null);
      setShowForm(false);
      fetchImages();

    } catch (error) {
      console.error('Error in handleSubmit:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred');
      }
    }
  }

  async function handleVote(id: number) {
    try {
      const { data, error } = await supabase
        .from('images')
        .update({ votes: images.find(img => img.id === id)!.votes + 1 })
        .eq('id', id);

      if (error) throw error;

      fetchImages();
    } catch (error) {
      console.error('Error updating votes:', error);
      setError('Failed to update votes. Please try again.');
    }
  }

  async function handleRate(id: number) {
    try {
      const image = images.find(img => img.id === id)!;
      const { data, error } = await supabase
        .from('images')
        .update({ 
          stars: image.stars + 1,
          num_votes: image.num_votes + 1
        })
        .eq('id', id);

      if (error) throw error;

      fetchImages();
    } catch (error) {
      console.error('Error updating rating:', error);
      setError('Failed to update rating. Please try again.');
    }
  }

  const renderGalleryItems = () => {
    const items = [...images];
    while (items.length < 10) {
      items.push({ id: items.length, isSkeleton: true } as any);
    }
    return items.map((item) => renderGalleryItem(item));
  };

  const renderGalleryItem = (item: Image | { id: number, isSkeleton: true }) => (
    <Card key={item.id} className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">
          {'isSkeleton' in item ? <Skeleton className="h-6 w-3/4" /> : item.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        {'isSkeleton' in item ? (
          <Skeleton className="w-full h-48 rounded-md" />
        ) : (
          <img
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${item.file_path}`}
            alt={item.title}
            className="w-full h-48 object-cover rounded-md"
          />
        )}
        {'isSkeleton' in item && (
          <>
            <Skeleton className="h-4 w-1/2 mb-2 mt-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-3/4" />
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        {'isSkeleton' in item ? (
          <>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-24" />
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => handleVote(item.id)}>
              <ThumbsUp className="mr-2 h-4 w-4" />
              {item.votes}
            </Button>
            <div className="flex items-center">
              <Button variant="outline" size="sm" onClick={() => handleRate(item.id)}>
                <Star className="mr-2 h-4 w-4" />
                {item.stars}
              </Button>
              <span className="ml-2 text-sm text-gray-500">({item.num_votes} votes)</span>
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  );

  return (
    <div className="max-w-full mx-auto p-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      {showForm ? (
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upload Image</CardTitle>
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
              />
              <Input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="Enter image title" 
              />
              <Textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                placeholder="Enter image description" 
              />
              <Input 
                value={artist} 
                onChange={(e) => setArtist(e.target.value)} 
                placeholder="Enter artist name" 
              />
              <Button type="submit" className="w-full">Submit</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowForm(true)} className="mb-8 w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Add New Image
        </Button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {renderGalleryItems()}
      </div>
    </div>
  );
}