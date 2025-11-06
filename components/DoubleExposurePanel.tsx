/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef } from 'react';
import { UploadIcon } from './icons.tsx';
import { blendModes, type BlendMode } from './OverlayPanel.tsx';

export type DoubleExposureSettings = {
  overlayFile: File;
  opacity: number;
  blendMode: BlendMode;
};

interface DoubleExposurePanelProps {
  onApply: (settings: DoubleExposureSettings) => void;
  isLoading: boolean;
}

const DoubleExposurePanel: React.FC<DoubleExposurePanelProps> = ({ onApply, isLoading }) => {
  const [overlayFile, setOverlayFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.5);
  const [blendMode, setBlendMode] = useState<BlendMode>('soft-light');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setOverlayFile(file);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleApply = () => {
    if (overlayFile) {
      onApply({ overlayFile, opacity, blendMode });
    }
  };

  const canApply = !!overlayFile;

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col items-center gap-6 animate-fade-in backdrop-blur-sm">
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-200">AI Double Exposure</h3>
        <p className="text-base text-gray-400 max-w-md mt-1">
          Blend a second image into your current photo for a surreal, artistic effect.
        </p>
      </div>

      <div className="w-full max-w-md flex flex-col items-center gap-4">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-white/10 text-gray-200 font-semibold py-3 px-4 rounded-md transition-all hover:bg-white/20 active:scale-95 disabled:opacity-50"
        >
          <UploadIcon className="w-5 h-5" /> {overlayFile ? 'Change Overlay Image' : 'Upload Overlay Image'}
        </button>

        {previewUrl && (
          <div className="p-2 bg-black/20 rounded-lg border border-gray-600">
            <img src={previewUrl} alt="Overlay preview" className="max-h-32 rounded-md" />
          </div>
        )}
      </div>

      {overlayFile && (
        <div className="w-full max-w-md space-y-5 animate-fade-in">
          <div>
              <div className="flex justify-between items-center mb-1">
                  <label htmlFor="de-opacity" className="block text-sm font-medium text-gray-400">Opacity</label>
                  <span className="text-sm font-semibold text-gray-200 bg-gray-700 px-2 py-1 rounded w-14 text-center">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                  id="de-opacity" type="range" min="0" max="1" step="0.01" value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  disabled={isLoading} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
          </div>
          <div>
              <label htmlFor="de-blend-mode" className="block text-sm font-medium text-gray-400 mb-1">Blend Mode</label>
              <select
                  id="de-blend-mode"
                  value={blendMode}
                  onChange={(e) => setBlendMode(e.target.value as BlendMode)}
                  disabled={isLoading}
                  className="w-full bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
              >
                  {blendModes.map(mode => (
                      <option key={mode.value} value={mode.value}>{mode.name}</option>
                  ))}
              </select>
          </div>
        </div>
      )}

      <button
        onClick={handleApply}
        disabled={isLoading || !canApply}
        className="w-full max-w-sm mt-4 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-lg disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        Apply Double Exposure
      </button>
    </div>
  );
};

export default DoubleExposurePanel;
