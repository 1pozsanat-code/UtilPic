/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback } from 'react';

// Define settings type
export type DownloadSettings = {
  format: 'jpeg' | 'png' | 'webp';
  quality: number; // 0-100 for JPEG/WEBP
};

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (settings: DownloadSettings) => void;
  imageFile: File | null;
}

// Helper to format bytes
const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose, onConfirm, imageFile }) => {
  const [settings, setSettings] = useState<DownloadSettings>({
    format: 'jpeg',
    quality: 92,
  });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [estimatedSize, setEstimatedSize] = useState<string>('Calculating...');

  // Effect to create object URL for preview
  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);
  
  // Effect to calculate estimated file size
  const calculateSize = useCallback(async () => {
    if (!imageFile) return;

    setEstimatedSize('Calculating...');
    const image = new Image();
    const tempUrl = URL.createObjectURL(imageFile);
    
    await new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.src = tempUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    
    const mimeType = `image/${settings.format}`;
    const quality = (settings.format === 'jpeg' || settings.format === 'webp') ? settings.quality / 100 : undefined;

    canvas.toBlob((blob) => {
        if (blob) {
            setEstimatedSize(formatBytes(blob.size));
        } else {
            setEstimatedSize('N/A');
        }
        URL.revokeObjectURL(tempUrl);
    }, mimeType, quality);

  }, [imageFile, settings.format, settings.quality]);

  useEffect(() => {
    if (isOpen) {
        calculateSize();
    }
  }, [isOpen, calculateSize]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in backdrop-blur-sm p-4" onClick={onClose} aria-modal="true" role="dialog">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-5" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-gray-100">Download Settings</h2>
        
        <div className="flex flex-col text-center sm:text-left sm:flex-row gap-4 items-center">
            {imageUrl && <img src={imageUrl} alt="Preview" className="w-24 h-24 object-cover rounded-md bg-gray-700 flex-shrink-0"/>}
            <div className="flex-grow">
                <p className="text-gray-300 font-medium">Image Settings</p>
                <p className="text-sm text-gray-400">Choose your desired format and quality.</p>
                <p className="text-sm text-blue-300 mt-2 font-semibold">Estimated Size: {estimatedSize}</p>
            </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Format</label>
            <div className="flex bg-gray-900/50 p-1 rounded-lg border border-gray-700">
                <button
                    onClick={() => setSettings(s => ({ ...s, format: 'jpeg' }))}
                    className={`w-full py-2 px-4 rounded-md text-base font-semibold transition-all ${settings.format === 'jpeg' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}
                >
                    JPEG
                </button>
                <button
                    onClick={() => setSettings(s => ({ ...s, format: 'png' }))}
                    className={`w-full py-2 px-4 rounded-md text-base font-semibold transition-all ${settings.format === 'png' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}
                >
                    PNG
                </button>
                <button
                    onClick={() => setSettings(s => ({ ...s, format: 'webp' }))}
                    className={`w-full py-2 px-4 rounded-md text-base font-semibold transition-all ${settings.format === 'webp' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}
                >
                    WEBP
                </button>
            </div>
        </div>
        
        {(settings.format === 'jpeg' || settings.format === 'webp') && (
            <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-1">
                    <label htmlFor="quality" className="block text-sm font-medium text-gray-400">Quality</label>
                    <span className="text-sm font-semibold text-gray-200 bg-gray-700 px-2 py-1 rounded">{settings.quality}</span>
                </div>
                <input
                    id="quality"
                    type="range" min="1" max="100"
                    value={settings.quality}
                    onChange={(e) => setSettings(s => ({ ...s, quality: Number(e.target.value) }))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                 {settings.format === 'jpeg' && <p className="text-xs text-gray-500 mt-1">Best for photos. Lower quality results in a smaller file size.</p>}
                 {settings.format === 'webp' && <p className="text-xs text-gray-500 mt-1">Modern format with great compression. Lower quality reduces size.</p>}
            </div>
        )}

        {settings.format === 'png' && (
             <div className="animate-fade-in">
                <p className="text-sm text-gray-400 bg-gray-900/50 p-3 rounded-md border border-gray-700">PNG is a lossless format ideal for images with transparency or sharp lines. Quality is always maximum.</p>
            </div>
        )}
        
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="bg-white/10 border border-white/20 text-gray-200 font-semibold py-2 px-6 rounded-lg transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(settings)}
            className="bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-2 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadModal;