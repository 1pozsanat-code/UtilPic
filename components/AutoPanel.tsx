/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { SparklesIcon } from './icons.tsx';

interface AutoPanelProps {
  onApply: () => void;
  isLoading: boolean;
}

const AutoPanel: React.FC<AutoPanelProps> = ({ onApply, isLoading }) => {
  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-xl font-bold text-gray-200">Auto Enhance</h3>
      <p className="text-base text-gray-400 text-center max-w-md">
        Let AI automatically improve your image's brightness, contrast, color, and sharpness with a single click.
      </p>
      
      <button
        onClick={onApply}
        disabled={isLoading}
        className="w-full max-w-sm mt-4 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-lg disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
      >
        <SparklesIcon className="w-6 h-6" />
        Apply Auto Enhance
      </button>
    </div>
  );
};

export default AutoPanel;