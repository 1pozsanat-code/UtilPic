/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { PlusIcon, MinusIcon, FitScreenIcon } from './icons.tsx';

interface ViewControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

const ViewControls: React.FC<ViewControlsProps> = ({ zoom, onZoomIn, onZoomOut, onResetView }) => {
  return (
    <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-gray-900/60 border border-gray-700/80 rounded-lg p-1.5 backdrop-blur-sm shadow-lg animate-fade-in">
      <button onClick={onZoomOut} className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-md transition-colors" aria-label="Zoom out">
        <MinusIcon className="w-5 h-5" />
      </button>
      <span className="text-sm font-semibold text-gray-200 w-16 text-center tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <button onClick={onZoomIn} className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-md transition-colors" aria-label="Zoom in">
        <PlusIcon className="w-5 h-5" />
      </button>
      <div className="w-px h-5 bg-gray-600 mx-1"></div>
      <button onClick={onResetView} className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-md transition-colors" aria-label="Fit to view">
        <FitScreenIcon className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ViewControls;