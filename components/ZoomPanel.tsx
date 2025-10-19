/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { type PixelCrop } from 'react-image-crop';

type DetailIntensity = 'Subtle' | 'Natural' | 'High';

interface ZoomPanelProps {
  onApplyZoom: (zoomLevel: number, detailIntensity: DetailIntensity) => void;
  isLoading: boolean;
  isZooming: boolean; // From completedCrop, enables Apply button
  completedCrop: PixelCrop | undefined;
  imageRef: React.RefObject<HTMLImageElement>;
}

const ZoomPanel: React.FC<ZoomPanelProps> = ({ onApplyZoom, isLoading, isZooming, completedCrop, imageRef }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [detailIntensity, setDetailIntensity] = useState<DetailIntensity>('Natural');
  const [aspectRatio, setAspectRatio] = useState('1 / 1');

  // Reset controls when the crop selection changes
  useEffect(() => {
    setZoomLevel(1);
    setDetailIntensity('Natural');
  }, [completedCrop]);

  // Update preview when crop or zoom level changes
  useEffect(() => {
    if (!completedCrop || !imageRef.current || !completedCrop.width || !completedCrop.height) {
        setPreviewUrl(null);
        return;
    }

    const image = imageRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Apply zoom level to the completedCrop to calculate the new source area
    const { x, y, width, height } = completedCrop;
    const zoomedWidth = width / zoomLevel;
    const zoomedHeight = height / zoomLevel;
    const zoomedX = x + (width - zoomedWidth) / 2;
    const zoomedY = y + (height - zoomedHeight) / 2;

    const sourceCropWidth = zoomedWidth * scaleX;
    const sourceCropHeight = zoomedHeight * scaleY;
    const sourceCropX = zoomedX * scaleX;
    const sourceCropY = zoomedY * scaleY;

    canvas.width = sourceCropWidth;
    canvas.height = sourceCropHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error("Could not get canvas context for zoom preview.");
      return;
    }

    ctx.drawImage(
      image,
      sourceCropX,
      sourceCropY,
      sourceCropWidth,
      sourceCropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    setPreviewUrl(canvas.toDataURL('image/png'));
    setAspectRatio(`${zoomedWidth} / ${zoomedHeight}`);

  }, [completedCrop, imageRef, zoomLevel]);

  const showPreview = !!completedCrop?.width && !!previewUrl;

  const detailLevels: { name: DetailIntensity, description: string }[] = [
    { name: 'Subtle', description: 'Preserves original texture with minimal added detail.' },
    { name: 'Natural', description: 'A balanced approach for realistic enhancement.' },
    { name: 'High', description: 'Adds significant new detail for a sharp, high-res look.' },
  ];

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col items-center gap-6 animate-fade-in backdrop-blur-sm">
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-200">AI Zoom & Enhance</h3>
        <p className="text-base text-gray-400 max-w-md mt-1">
          Select an area on the image, then fine-tune the zoom and detail level.
        </p>
      </div>
      
      {showPreview ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full animate-fade-in">
          {/* Preview */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-medium text-gray-400">Preview</p>
            <div className="w-full max-w-xs p-1 bg-black/20 rounded-lg border border-gray-600">
                <img 
                    src={previewUrl} 
                    alt="Zoom preview" 
                    className="w-full h-auto object-contain rounded" 
                    style={{ aspectRatio: aspectRatio }}
                />
            </div>
          </div>
          {/* Controls */}
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex justify-between items-center mb-1">
                  <label htmlFor="zoom-level" className="block text-sm font-medium text-gray-400">Zoom Level</label>
                  <span className="text-sm font-semibold text-gray-200 bg-gray-700 px-2 py-1 rounded w-16 text-center">{zoomLevel.toFixed(1)}x</span>
              </div>
              <input
                  id="zoom-level"
                  type="range" min="1" max="3" step="0.1"
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(Number(e.target.value))}
                  disabled={isLoading}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Detail Enhancement</label>
              <div className="grid grid-cols-3 gap-2">
                {detailLevels.map(level => (
                  <div key={level.name} className="relative group">
                    <button
                      onClick={() => setDetailIntensity(level.name)}
                      disabled={isLoading}
                      className={`w-full px-2 py-2 rounded-md text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                        detailIntensity === level.name
                        ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20' 
                        : 'bg-white/10 hover:bg-white/20 text-gray-200'
                      }`}
                    >
                      {level.name}
                    </button>
                     <div className="absolute bottom-full mb-2 w-max max-w-xs left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 shadow-lg">
                      {level.description}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
         <div className="text-center py-8">
            <p className="text-base text-gray-400">Click and drag on the image to select an area to zoom.</p>
        </div>
      )}
      
      <button
        onClick={() => onApplyZoom(zoomLevel, detailIntensity)}
        disabled={isLoading || !isZooming}
        className="w-full max-w-sm mt-2 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-lg disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        Apply AI Zoom
      </button>
    </div>
  );
};

export default ZoomPanel;
