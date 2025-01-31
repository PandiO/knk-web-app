import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Slideshow } from '../components/Slideshow';
import { ImageUploadModal } from '../components/ImageUploadModal';

const DEMO_IMAGES = [
  {
    id: '1',
    url: 'https://previews.dropbox.com/p/thumb/ACh6trT201Gtnz2JCtSCqJ-a_2SYHa9QN2iimrCZquTZuixusxEcHwBBVhsZ6GmWUwEvuwNY_yFQxo4K9-yHPx-F3ewj5rZC7BuweHjKleHzvUCWa4mQtuOr2WL8tG6M1YC9l7LJnJt99eQ_MIcdEdW8TsSLOzdijp2MorSScBVqAU55L5SJRjREDttdtgx2HF-Ji3T_7C2j_G2-AM4F06Y2YMJBm59wx7L771x6OZ7_OdAM50vosPaCHHGwmlJwPX55bXeqnORCBaHWnJdnER9GbXdECCWfzl38heNNkTYz1nEs1GnppAI63BycKlb85xjy-dJD_S5YbzJHWnIL2yr513k4rnPyrxjrRP7ju0SA3xQ-j_JL-hJoLmIkY67Ec2bGW9I07wKgn2DvzyFxWxAD/p.jpeg?is_prewarmed=true',
    title: 'Cinix from north west Gate',
    // photographer: 'Bailey Zindel',
    // description: 'Sunrise at Yosemite National Park'
  },
  {
    id: '2',
    url: 'https://previews.dropbox.com/p/thumb/ACgUXbiuF12VY0whmI2WXOVNwtt1NfXTWmKhbGPuqV-debNG-M9tNcmNldxBXbyE-rG-X-E7-_dELghWikC4fA4F5PpW4-gyShi_3ezlO0cQquBGnNv32CtesnUQvsl9ZymSbDUAt8DVGUB3Na2xxP4xBIZXlDJ73vKpXCszL7k581pQzV_6RYLny23EwV5h2_7WCdTO3uUgYJdt254wqbX5DxpWN31amcsNPRKJXXwT5CpkUB2B7I15Cwfyghx2pDik2A5ovsY85yilngMuqTh_UrF9QchovhJgDV7AkYSIhsZWJZFV6Zs-3Ei3NtBJWBZHAVyJk3j6rMVKqbU70TpIDi6TjZbcB6xtvtBkBmm0ZeiYp-ypo-LfnLhrlO6m7mUMwhjCwLoOfhA1itrjc8lw11w3dTbacVmlLCPoYrXmCYfUJRZqHuoVfHRA01ySnX9AVFeEEnnX85nTG2WV5fTh/p.jpeg?is_prewarmed=true',
    title: 'Cinix from south west Forrest',
    // photographer: 'Jonatan Pie',
    // description: 'Aurora Borealis in Iceland'
  },
  {
    id: '3',
    url: 'https://previews.dropbox.com/p/thumb/ACjXV1Z_4skF4qkcuxsXlyKxUmPO4BcZo8H6RJYw1jWn6owRgZtySBgwFrgjlcAk55OVrkPRKyphtOk26zC-Y9SEMxcvm9da9qfihQJDEA3xEm61dJ9gY3EzhWIkLZerdG7g1i1B0hNeRglHYdMNCYM66miC_lYDqEzRHdl7bgYJnFrDcLeg3fqlUvkKY14OkUXmpUsuByR9djkQbWCzaRZM0be2lkLUm4YnM4iWhdSFjjX8c6jFXKZbaBJlEwufMCq-bgbqANeIeeRHVWb_lRRwVZvkvQEQuQyAGOH6vmm4G2p9htTppJ5Lj-Qa0wUEuP1yKi7INHgoj-2YjzLVh6tipx90t_iJWyHT33R6ShVuVfSwGpP4pbfOg_QPt2qX1kUwKaQllld4f0pXIYzstRor5X-PnYkhllverKm6suGTR2WCyVMf5mwPFIGmZvwr8YFab4CoXK2hvMdV3B5FGHp0/p.jpeg?is_prewarmed=true',
    title: 'Cinix',
    // photographer: 'Aman Upadhyay',
    // description: 'Light beams in Upper Antelope Canyon'
  },
  {
    id: '4',
    url: 'https://previews.dropbox.com/p/thumb/ACgGAlCV0tKHT0ZQuyqGoP2kFSuR7ikPF6S9Y3_NU5Nx06PBrhrXLMVFrc3u9kxtsdRUTOFDmY8yhB9DRan8mRyjpLzUcvvj_T_HbntnsEDKtTOkp0Ha86uYdJDdx98q4xswUvqGC86GlSqFqPVrIPDe5fq4jsZHlMDhDirgNBlWYqVtqECUpZokDtsoPZosKe6qRd2H4n9Omvbnr6MbvwV-Yy8YBwywv1g7tpvfAcdkJWr3vCTDFftiDQO38PvlPurdOvCBT2aNXNcDSLcz1rnM39jVPOs7v-wtRTDx7dkCRLn2g_xIWaoY8CzpZHSUUwWQaAyiWwaSic7M5fXcI2H0_jpphpyAMYY46r-Y4wN2jMyEfIr5ObCPYB2Wi6de6Vhp1kDni9CKsJQktsB-CXnG/p.jpeg?is_prewarmed=true',
    title: 'Cinix',
    // photographer: 'Aman Upadhyay',
    // description: 'Light beams in Upper Antelope Canyon'
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