/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';

// FIX: Changed to a discriminated union to allow for better type inference. This resolves type errors in App.tsx.
// UPDATE: Added 'generate' and 'url' types.
export type BackgroundSettings = 
  | { type: 'color'; value: string }
  | { type: 'image'; value: File }
  | { type: 'generate'; value: string }
  | { type: 'url'; value: string };

interface BackgroundPanelProps {
  onRemoveBackground: () => void;
  onApplyNewBackground: (settings: BackgroundSettings) => void;
  isLoading: boolean;
  isBgRemovalMode: boolean;
}

const BackgroundPanel: React.FC<BackgroundPanelProps> = ({ onRemoveBackground, onApplyNewBackground, isLoading, isBgRemovalMode }) => {
  const [backgroundType, setBackgroundType] = useState<'color' | 'image' | 'generate' | 'url'>('color');
  const [colorValue, setColorValue] = useState('#ffffff');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [urlValue, setUrlValue] = useState('');


  const handleApply = () => {
    if (backgroundType === 'color') {
      onApplyNewBackground({ type: 'color', value: colorValue });
    } else if (backgroundType === 'image' && imageFile) {
      onApplyNewBackground({ type: 'image', value: imageFile });
    } else if (backgroundType === 'generate' && generatePrompt.trim()) {
        onApplyNewBackground({ type: 'generate', value: generatePrompt });
    } else if (backgroundType === 'url' && urlValue.trim()) {
        onApplyNewBackground({ type: 'url', value: urlValue });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const canApply = (backgroundType === 'color' && colorValue) || (backgroundType === 'image' && imageFile) || (backgroundType === 'generate' && !!generatePrompt.trim()) || (backgroundType === 'url' && !!urlValue.trim());

  if (!isBgRemovalMode) {
    return (
      <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
        <h3 className="text-xl font-bold text-gray-200">AI Background Remover</h3>
        <p className="text-base text-gray-400 text-center max-w-md">
          Automatically detect and remove the background from your image with one click.
        </p>
        <button
          onClick={onRemoveBackground}
          disabled={isLoading}
          className="w-full max-w-sm mt-4 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-lg disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
        >
          Remove Background
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col gap-6 animate-fade-in backdrop-blur-sm">
      <h3 className="text-xl font-bold text-center text-gray-200">Replace Background</h3>
      
      {/* Type Selector */}
      <div className="flex bg-gray-900/50 p-1 rounded-lg border border-gray-700">
        <button
          onClick={() => setBackgroundType('color')}
          className={`w-full py-2 px-4 rounded-md text-base font-semibold transition-all ${backgroundType === 'color' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}
        >
          Color
        </button>
        <button
          onClick={() => setBackgroundType('image')}
          className={`w-full py-2 px-4 rounded-md text-base font-semibold transition-all ${backgroundType === 'image' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}
        >
          Image
        </button>
        <button
          onClick={() => setBackgroundType('generate')}
          className={`w-full py-2 px-4 rounded-md text-base font-semibold transition-all ${backgroundType === 'generate' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}
        >
          Generate
        </button>
        <button
          onClick={() => setBackgroundType('url')}
          className={`w-full py-2 px-4 rounded-md text-base font-semibold transition-all ${backgroundType === 'url' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}
        >
          URL
        </button>
      </div>

      {/* Settings */}
      {backgroundType === 'color' && (
        <div className="flex flex-col items-center gap-2 animate-fade-in">
          <label htmlFor="bg-color" className="text-sm font-medium text-gray-400">Select a background color</label>
          <input
            id="bg-color"
            type="color"
            value={colorValue}
            onChange={(e) => setColorValue(e.target.value)}
            className="w-24 h-12 p-1 bg-gray-800 border border-gray-600 rounded-lg cursor-pointer"
          />
        </div>
      )}
      
      {backgroundType === 'image' && (
        <div className="flex flex-col items-center gap-2 animate-fade-in">
          <label htmlFor="bg-upload" className="block text-sm font-medium text-gray-400 mb-1">Upload a background image</label>
          <input
            id="bg-upload"
            type="file"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleFileChange}
            className="w-full max-w-sm text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
          />
          {imageFile && <p className="text-xs text-gray-500 mt-1">Selected: {imageFile.name}</p>}
        </div>
      )}

      {backgroundType === 'generate' && (
        <div className="flex flex-col items-center gap-2 animate-fade-in w-full">
            <label htmlFor="bg-prompt" className="block text-sm font-medium text-gray-400 mb-1">Describe the background you want to create</label>
            <input
                id="bg-prompt"
                type="text"
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                placeholder="e.g., a serene beach at sunset"
                className="w-full bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
            />
        </div>
      )}

      {backgroundType === 'url' && (
        <div className="flex flex-col items-center gap-2 animate-fade-in w-full">
            <label htmlFor="bg-url" className="block text-sm font-medium text-gray-400 mb-1">Paste an image URL</label>
            <input
                id="bg-url"
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
            />
        </div>
      )}


      {/* Apply Button */}
      <button
        onClick={handleApply}
        disabled={isLoading || !canApply}
        className="w-full mt-4 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-lg disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        {backgroundType === 'generate' ? 'Generate & Apply' : 'Apply Background'}
      </button>
    </div>
  );
};

export default BackgroundPanel;