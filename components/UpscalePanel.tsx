/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';

type DetailIntensity = 'Subtle' | 'Natural' | 'High';

interface UpscalePanelProps {
  onApplyUpscale: (scale: number, detailIntensity: DetailIntensity) => void;
  isLoading: boolean;
}

const UpscalePanel: React.FC<UpscalePanelProps> = ({ onApplyUpscale, isLoading }) => {
  const [scale, setScale] = useState<number>(2);
  const [detailIntensity, setDetailIntensity] = useState<DetailIntensity>('Natural');

  const handleApply = () => {
    onApplyUpscale(scale, detailIntensity);
  };

  const detailLevels: { name: DetailIntensity, description: string }[] = [
    { name: 'Subtle', description: 'Preserves original texture with minimal added detail.' },
    { name: 'Natural', description: 'A balanced approach for realistic enhancement.' },
    { name: 'High', description: 'Adds significant new detail for a sharp, high-res look.' },
  ];

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col items-center gap-6 animate-fade-in backdrop-blur-sm">
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-200">AI Image Upscaling</h3>
        <p className="text-base text-gray-400 max-w-md mt-1">
          Increase the resolution of your image while intelligently enhancing details.
        </p>
      </div>
      
      <div className="w-full max-w-md space-y-5">
        <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Scale Factor</label>
            <div className="grid grid-cols-2 gap-2">
                {[2, 4].map((factor) => (
                <button
                    key={factor}
                    onClick={() => setScale(factor)}
                    disabled={isLoading}
                    className={`px-6 py-3 rounded-md text-base font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                    scale === factor
                    ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20' 
                    : 'bg-white/10 hover:bg-white/20 text-gray-200'
                    }`}
                >
                    {factor}x Resolution
                </button>
                ))}
            </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Detail Enhancement</label>
            <div className="grid grid-cols-3 gap-2">
            {detailLevels.map(level => (
                <div key={level.name} className="relative group">
                <button
                    onClick={() => setDetailIntensity(level.name)}
                    disabled={isLoading}
                    className={`w-full px-2 py-3 rounded-md text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
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

      <button
        onClick={handleApply}
        disabled={isLoading}
        className="w-full max-w-sm mt-4 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-lg disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        Apply Upscale
      </button>
    </div>
  );
};

export default UpscalePanel;