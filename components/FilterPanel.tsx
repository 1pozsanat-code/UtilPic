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

  const presets = [
    { name: 'Synthwave', prompt: 'Apply a vibrant 80s synthwave aesthetic with neon magenta and cyan glows, and subtle scan lines.', description: 'Adds neon glows and scan lines for a retro-futuristic vibe.' },
    { name: 'Anime', prompt: 'Give the image a vibrant Japanese anime style, with bold outlines, cel-shading, and saturated colors.', description: 'Creates bold outlines and saturated colors, like a cartoon.' },
    { name: 'Lomo', prompt: 'Apply a Lomography-style cross-processing film effect with high-contrast, oversaturated colors, and dark vignetting.', description: 'High-contrast, oversaturated colors with dark vignetting.' },
    { name: 'Glitch', prompt: 'Transform the image into a futuristic holographic projection with digital glitch effects and chromatic aberration.', description: 'Adds digital distortion and chromatic aberration for a sci-fi look.' },
    { name: 'Dramatic', prompt: 'Apply a high-contrast, dramatic filter. Deepen shadows, enhance highlights, and add a subtle desaturation to create a powerful, cinematic look.', description: 'High contrast and deep shadows for a cinematic feel.' },
    { name: 'Moody', prompt: 'Apply a moody, atmospheric filter. Desaturate the colors, add a cool color cast (blue or green tones), and slightly crush the blacks for a somber, filmic aesthetic.', description: 'Cool, desaturated colors for a somber, filmic vibe.' },
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
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Apply a Filter</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {presets.map(preset => (
           <div key={preset.name} className="relative group">
            <button
              onClick={() => handlePresetClick(preset)}
              disabled={isLoading}
              className={`w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed ${selectedPreset?.prompt === preset.prompt ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : ''}`}
            >
              {preset.name}
            </button>
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 w-max max-w-xs left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 shadow-lg">
              {preset.description}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
            </div>
          </div>
        ))}
      </div>

      <input
        type="text"
        value={customPrompt}
        onChange={handleCustomChange}
        placeholder="Or describe a custom filter (e.g., '80s synthwave glow')"
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
