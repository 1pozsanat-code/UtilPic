/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface RestorePanelProps {
  onApplyRestore: () => void;
  isLoading: boolean;
}

const RestorePanel: React.FC<RestorePanelProps> = ({ onApplyRestore, isLoading }) => {
  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-xl font-bold text-gray-200">AI Photo Restoration</h3>
      <p className="text-base text-gray-400 text-center max-w-md">
        Repair scratches, reduce noise, and enhance clarity in old or damaged photos with a single click.
      </p>
      
      <button
        onClick={onApplyRestore}
        disabled={isLoading}
        className="w-full max-w-sm mt-4 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-lg disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        Apply Restoration
      </button>
    </div>
  );
};

export default RestorePanel;