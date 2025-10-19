/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';

// Exporting the settings type to be used in App.tsx
export type WatermarkSettings = {
  type: 'text' | 'logo';
  text: string;
  textColor: string;
  fontSize: number; // Represents a base size, will be scaled in App.tsx
  opacity: number;
  position: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  logoFile: File | null;
  logoSize: number; // Percentage of image width
};

interface WatermarkPanelProps {
  onApplyWatermark: (settings: WatermarkSettings) => void;
  isLoading: boolean;
}

const WatermarkPanel: React.FC<WatermarkPanelProps> = ({ onApplyWatermark, isLoading }) => {
  const [settings, setSettings] = useState<WatermarkSettings>({
    type: 'text',
    text: 'UtilPic',
    textColor: '#ffffff',
    fontSize: 40,
    opacity: 0.7,
    position: 'bottom-right',
    logoFile: null,
    logoSize: 20,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSettings(s => ({ ...s, logoFile: e.target.files![0] }));
    }
  };

  const handleApply = () => {
    onApplyWatermark(settings);
  };
  
  const positions: WatermarkSettings['position'][] = [
    'top-left', 'top-center', 'top-right',
    'middle-left', 'middle-center', 'middle-right',
    'bottom-left', 'bottom-center', 'bottom-right'
  ];

  const canApply = (settings.type === 'text' && !!settings.text.trim()) || (settings.type === 'logo' && !!settings.logoFile);

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col gap-6 animate-fade-in backdrop-blur-sm">
      <h3 className="text-xl font-bold text-center text-gray-200">Add Watermark</h3>
      
      {/* Type Selector */}
      <div className="flex bg-gray-900/50 p-1 rounded-lg border border-gray-700">
        <button
          onClick={() => setSettings(s => ({ ...s, type: 'text' }))}
          className={`w-full py-2 px-4 rounded-md text-base font-semibold transition-all ${settings.type === 'text' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}
        >
          Text
        </button>
        <button
          onClick={() => setSettings(s => ({ ...s, type: 'logo' }))}
          className={`w-full py-2 px-4 rounded-md text-base font-semibold transition-all ${settings.type === 'logo' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}
        >
          Logo
        </button>
      </div>
      
      {/* Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {settings.type === 'text' ? (
          <>
            {/* Text Content */}
            <div className="md:col-span-2">
              <label htmlFor="watermark-text" className="block text-sm font-medium text-gray-400 mb-1">Watermark Text</label>
              <input
                id="watermark-text"
                type="text"
                value={settings.text}
                onChange={(e) => setSettings(s => ({ ...s, text: e.target.value }))}
                placeholder="Your Text"
                className="w-full bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
              />
            </div>
            {/* Font Size */}
            <div>
                <label htmlFor="font-size" className="block text-sm font-medium text-gray-400 mb-1">Font Size</label>
                <input
                    id="font-size"
                    type="range" min="10" max="100"
                    value={settings.fontSize}
                    onChange={(e) => setSettings(s => ({ ...s, fontSize: Number(e.target.value) }))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>
            {/* Text Color */}
            <div className="flex flex-col items-start">
              <label htmlFor="text-color" className="block text-sm font-medium text-gray-400 mb-1">Color</label>
              <input
                id="text-color"
                type="color"
                value={settings.textColor}
                onChange={(e) => setSettings(s => ({ ...s, textColor: e.target.value }))}
                className="w-20 h-10 p-1 bg-gray-800 border border-gray-600 rounded-lg cursor-pointer"
              />
            </div>
          </>
        ) : (
          <>
            {/* Logo Upload */}
            <div className="md:col-span-2">
              <label htmlFor="logo-upload" className="block text-sm font-medium text-gray-400 mb-1">Logo Image</label>
              <input
                id="logo-upload"
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
              />
            </div>
             {/* Logo Size */}
            <div className="md:col-span-2">
                <label htmlFor="logo-size" className="block text-sm font-medium text-gray-400 mb-1">Logo Size ({settings.logoSize}%)</label>
                <input
                    id="logo-size"
                    type="range" min="5" max="50"
                    value={settings.logoSize}
                    onChange={(e) => setSettings(s => ({ ...s, logoSize: Number(e.target.value) }))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>
          </>
        )}
        {/* Opacity */}
        <div className="md:col-span-2">
            <label htmlFor="opacity" className="block text-sm font-medium text-gray-400 mb-1">Opacity</label>
            <input
                id="opacity"
                type="range" min="0.1" max="1" step="0.05"
                value={settings.opacity}
                onChange={(e) => setSettings(s => ({ ...s, opacity: Number(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
        </div>
      </div>
      
      {/* Position */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Position</label>
        <div className="grid grid-cols-3 gap-1 max-w-xs mx-auto p-1 bg-gray-900/50 rounded-lg border border-gray-700">
            {positions.map(pos => (
                <button
                    key={pos}
                    onClick={() => setSettings(s => ({ ...s, position: pos }))}
                    className={`h-12 w-full flex items-center justify-center rounded-md transition-colors ${settings.position === pos ? 'bg-blue-600' : 'bg-gray-700/50 hover:bg-gray-600/50'}`}
                    aria-label={`Set position to ${pos.replace('-', ' ')}`}
                >
                  <div className={`w-3 h-3 rounded-full ${settings.position === pos ? 'bg-white' : 'bg-gray-500'}`} />
                </button>
            ))}
        </div>
      </div>

      {/* Apply Button */}
      <button
        onClick={handleApply}
        disabled={isLoading || !canApply}
        className="w-full mt-4 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-lg disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        Apply Watermark
      </button>
    </div>
  );
};

export default WatermarkPanel;