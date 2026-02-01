import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Slideshow } from '../components/Slideshow';
import { ImageUploadModal } from '../components/ImageUploadModal';

const DEMO_IMAGES = [
  {
    id: '1',
    url: '/images/1.jpg',
    title: 'Cinix from north west Gate',
  },
  {
    id: '2',
    url: '/images/2.jpg',
    title: 'Cinix from south west Forrest',
  },
  {
    id: '3',
    url: '/images/3.jpg',
    title: 'Cinix',
  },
  {
    id: '4',
    url: '/images/4.jpg',
    title: 'Cinix',
  },
  {
    id: '5',
    url: '/images/5.jpg',
    title: 'Cinix',
  },
  {
    id: '6',
    url: '/images/6.jpg',
    title: 'Cinix',
  }
  ,
  {
    id: '7',
    url: '/images/7.jpg',
    title: 'Cinix',
  },
  {
    id: '8',
    url: '/images/8.jpg',
    title: 'Cinix',
  },
  {
    id: '9',
    url: '/images/9.jpg',
    title: 'Cinix',
  }
];

export function LandingPage() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [images, setImages] = useState(DEMO_IMAGES);

  const handleImageSubmit = async (data: any) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const imageUrl = URL.createObjectURL(data.file);
      
      const newImage = {
        id: Date.now().toString(),
        url: imageUrl,
        title: data.title,
        photographer: data.photographer,
        description: data.description
      };
      
      setImages(prevImages => [...prevImages, newImage]);
      setShowUploadModal(false);
    } catch (error) {
      console.error('Failed to upload image:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Background Slideshow */}
      <div className="fixed inset-0">
        <Slideshow images={images} />
      </div>

      {/* Fixed Content Overlay */}
      <div className="relative z-30">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center text-white p-8">
            <h1 className="text-5xl font-bold mb-6">
              Welcome to Our Community
            </h1>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Share your most beautiful moments with the world. Submit your photos to be featured in our background slideshow.
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center px-6 py-3 border border-transparent text-lg font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Upload className="h-5 w-5 mr-2" />
              Submit Your Photo
            </button>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <ImageUploadModal
          onClose={() => setShowUploadModal(false)}
          onSubmit={handleImageSubmit}
        />
      )}
    </div>
  );
}