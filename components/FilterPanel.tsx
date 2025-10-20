/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { DocumentDuplicateIcon } from './icons.tsx';

interface FilterPanelProps {
  onApplyFilter: (prompt: string) => void;
  isLoading: boolean;
  onBatchApply: (prompt: string, name: string) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ onApplyFilter, isLoading, onBatchApply }) => {
  const [selectedPreset, setSelectedPreset] = useState<{ name: string; prompt: string; } | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const creativePresets = [
    { name: 'Synthwave', prompt: 'Apply a vibrant 80s synthwave aesthetic with neon magenta and cyan glows, and subtle scan lines.', description: 'Adds neon glows and scan lines for a retro-futuristic vibe.' },
    { name: 'Anime', prompt: 'Give the image a vibrant Japanese anime style, with bold outlines, cel-shading, and saturated colors.', description: 'Creates bold outlines and saturated colors, like a cartoon.' },
    { name: 'Lomo', prompt: 'Apply a Lomography-style cross-processing film effect with high-contrast, oversaturated colors, and dark vignetting.', description: 'High-contrast, oversaturated colors with dark vignetting.' },
    { name: 'Glitch', prompt: 'Transform the image into a futuristic holographic projection with digital glitch effects and chromatic aberration.', description: 'Adds digital distortion and chromatic aberration for a sci-fi look.' },
    { name: 'Dramatic', prompt: 'Apply a high-contrast, dramatic filter. Deepen shadows, enhance highlights, and add a subtle desaturation to create a powerful, cinematic look.', description: 'High contrast and deep shadows for a cinematic feel.' },
    { name: 'Moody', prompt: 'Apply a moody, atmospheric filter. Desaturate the colors, add a cool color cast (blue or green tones), and slightly crush the blacks for a somber, filmic aesthetic.', description: 'Cool, desaturated colors for a somber, filmic vibe.' },
  ];

  const filmSimulations = [
    // Color
    { name: 'Portra 400', prompt: "Apply a Kodak Portra 400 film simulation. This should produce warm, natural skin tones, fine grain, and slightly muted, soft colors, especially in the greens and blues. The overall look should be versatile and flattering for portraits.", description: 'Iconic portrait film. Known for its beautiful, natural skin tones and fine grain.' },
    { name: 'Ektar 100', prompt: "Apply a Kodak Ektar 100 film simulation. This should result in ultra-vivid, saturated colors, extremely fine grain, and high contrast. The image should be sharp and punchy, ideal for landscapes and travel photography.", description: 'Vivid and sharp. Delivers high saturation and ultra-fine grain, perfect for landscapes.' },
    { name: 'Velvia 50', prompt: "Apply a Fujifilm Velvia 50 film simulation. This is a slide film known for its intense color saturation, especially in reds, greens, and blues. It should have very high contrast and fine grain, creating a dramatic, vibrant look.", description: 'Slide film legend. Produces intense, vibrant colors and high contrast.' },
    { name: 'Superia 400', prompt: "Apply a Fujifilm Superia X-TRA 400 film simulation. This should produce slightly cool tones with an emphasis on greens and blues. It should have visible but pleasing grain and a nostalgic, slightly faded look characteristic of consumer film.", description: 'Classic consumer film. Features cool tones with an emphasis on greens and a nostalgic feel.' },
    // Black & White
    { name: 'Tri-X 400', prompt: "Apply a Kodak Tri-X 400 black and white film simulation. This should create a classic, gritty monochrome look with high contrast, deep blacks, and prominent, beautiful grain. The image should have a timeless, photojournalistic feel.", description: "The photojournalist's choice. Gritty, high-contrast black and white with classic grain." },
    { name: 'HP5 Plus 400', prompt: "Apply an Ilford HP5 Plus 400 black and white film simulation. This should produce a flexible monochrome image with a wide tonal range, moderate contrast, and a distinct but fine grain structure. The look should be versatile and slightly less harsh than Tri-X.", description: 'Versatile and classic B&W. Offers a wide tonal range and moderate contrast.' },
  ];
  
  const activePrompt = selectedPreset?.prompt || customPrompt;

  const handlePresetClick = (preset: { name: string; prompt: string; description: string; }) => {
    setSelectedPreset(preset);
    setCustomPrompt('');
  };
  
  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomPrompt(e.target.value);
    setSelectedPreset(null);
  };

  const handleApply = () => {
    if (activePrompt) {
      onApplyFilter(activePrompt);
    }
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-6 animate-fade-in backdrop-blur-sm">
      <h3 className="text-xl font-bold text-center text-gray-200">Creative Filters & Film Simulations</h3>
      
      <div className="space-y-4">
        <div>
          <h4 className="text-lg font-semibold text-gray-300 mb-2">Analog Film Sims</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {filmSimulations.map(preset => (
              <div key={preset.name} className="relative group">
                <button
                  onClick={() => handlePresetClick(preset)}
                  disabled={isLoading}
                  className={`w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed ${selectedPreset?.prompt === preset.prompt ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : ''}`}
                >
                  {preset.name}
                </button>
                <div className="absolute bottom-full mb-2 w-max max-w-xs left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 shadow-lg">
                  {preset.description}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-600/50" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-gray-800/50 px-3 text-sm text-gray-400 backdrop-blur-sm">Creative Filters</span>
          </div>
        </div>

        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {creativePresets.map(preset => (
              <div key={preset.name} className="relative group">
                <button
                  onClick={() => handlePresetClick(preset)}
                  disabled={isLoading}
                  className={`w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed ${selectedPreset?.prompt === preset.prompt ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : ''}`}
                >
                  {preset.name}
                </button>
                <div className="absolute bottom-full mb-2 w-max max-w-xs left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 shadow-lg">
                  {preset.description}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


      <input
        type="text"
        value={customPrompt}
        onChange={handleCustomChange}
        placeholder="Or describe a custom filter"
        className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
        disabled={isLoading}
      />
      
      {activePrompt && (
        <div className="animate-fade-in flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={handleApply}
            className="flex-grow bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
            disabled={isLoading || !activePrompt.trim()}
          >
            Apply Filter
          </button>
          {selectedPreset && (
            <button
                onClick={() => onBatchApply(selectedPreset.prompt, selectedPreset.name)}
                className="flex-shrink-0 flex items-center justify-center gap-2 bg-white/10 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 active:scale-95 disabled:opacity-50"
                disabled={isLoading}
                title="Apply this filter to multiple images"
            >
                <DocumentDuplicateIcon className="w-5 h-5" />
                Batch
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterPanel;