/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { RotateIcon, RotateCCWIcon, RotateCWIcon } from './icons.tsx';

interface CropPanelProps {
  onApply: () => void;
  onSetAspect: (aspect: number | undefined) => void;
  isLoading: boolean;
  canApply: boolean;
  onAutoRotate: () => void;
  onRotateImage: (direction: 'clockwise' | 'counter-clockwise') => void;
  rotation: number;
  onRotationChange: (rotation: number) => void;
}

const CropPanel: React.FC<CropPanelProps> = ({ onApply, onSetAspect, isLoading, canApply, onAutoRotate, onRotateImage, rotation, onRotationChange }) => {
  const [activeAspect, setActiveAspect] = useState<string>('Free');
  
  const handleAspectChange = (aspect: string, value: number | undefined) => {
    setActiveAspect(aspect);
    onSetAspect(value);
  }

  const aspects: { name: string, value: number | undefined }[] = [
    { name: 'Free', value: undefined },
    { name: '1:1', value: 1 / 1 },
    { name: '4:3', value: 4 / 3 },
    { name: '3:2', value: 3 / 2 },
    { name: '16:9', value: 16 / 9 },
    { name: '3:4', value: 3 / 4 },
    { name: '2:3', value: 2 / 3 },
    { name: '9:16', value: 9 / 16 },
  ];

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-gray-300">Crop & Rotate</h3>
      <p className="text-sm text-gray-400 -mt-2">Select an area, choose an aspect ratio, or adjust orientation.</p>
      
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-400 text-center">Aspect Ratio</span>
            <div className="flex items-center justify-center flex-wrap gap-2">
                {aspects.map(({ name, value }) => (
                  <button
                    key={name}
                    onClick={() => handleAspectChange(name, value)}
                    disabled={isLoading}
                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                      activeAspect === name 
                      ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20' 
                      : 'bg-white/10 hover:bg-white/20 text-gray-200'
                    }`}
                  >
                    {name}
                  </button>
                ))}
            </div>
        </div>
        <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-400 text-center">Orientation</span>
            <div className="grid grid-cols-3 gap-2">
              <div className="relative group">
                <button
                  onClick={() => onRotateImage('counter-clockwise')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center p-3 bg-white/10 hover:bg-white/20 text-gray-200 font-semibold rounded-md transition-all active:scale-95 disabled:opacity-50"
                  aria-label="Rotate counter-clockwise"
                >
                  <RotateCCWIcon className="w-6 h-6" />
                </button>
                <div className="absolute bottom-full mb-2 w-max left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 shadow-lg">
                    Rotate Left
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
                </div>
              </div>
              <div className="relative group">
                <button
                  onClick={onAutoRotate}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center p-3 bg-white/10 hover:bg-white/20 text-gray-200 font-semibold rounded-md transition-all active:scale-95 disabled:opacity-50"
                  aria-label="Auto-rotate"
                >
                  <RotateIcon className="w-6 h-6" />
                </button>
                 <div className="absolute bottom-full mb-2 w-max left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 shadow-lg">
                    Auto-Correct Orientation
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
                </div>
              </div>
              <div className="relative group">
                <button
                  onClick={() => onRotateImage('clockwise')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center p-3 bg-white/10 hover:bg-white/20 text-gray-200 font-semibold rounded-md transition-all active:scale-95 disabled:opacity-50"
                  aria-label="Rotate clockwise"
                >
                  <RotateCWIcon className="w-6 h-6" />
                </button>
                 <div className="absolute bottom-full mb-2 w-max left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 shadow-lg">
                    Rotate Right
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
                </div>
              </div>
            </div>
        </div>
      </div>

      <div className="w-full pt-2">
        <div className="flex justify-between items-center text-sm mb-1">
          <label htmlFor="straighten" className="font-medium text-gray-400">Straighten</label>
            <div className="flex items-center gap-2">
                <span className="text-gray-300 bg-gray-700/80 px-2 py-0.5 rounded-md w-16 text-center">{rotation.toFixed(1)}°</span>
                <button
                    onClick={() => onRotationChange(0)}
                    disabled={isLoading || rotation === 0}
                    className="text-xs font-medium text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Reset straighten"
                >
                    Reset
                </button>
          </div>
        </div>
        <input 
          id="straighten" 
          type="range" 
          min="-45" 
          max="45" 
          step="0.1" 
          value={rotation} 
          onChange={(e) => onRotationChange(Number(e.target.value))} 
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" 
          disabled={isLoading}
        />
      </div>


      <button
        onClick={onApply}
        disabled={isLoading || !canApply}
        className="w-full max-w-xs mt-2 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        Apply
      </button>
    </div>
  );
};

export default CropPanel;