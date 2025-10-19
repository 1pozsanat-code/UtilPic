/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { CloseIcon } from './icons.tsx';

interface HistoryPanelProps {
  history: string[];
  currentIndex: number;
  onSelectHistory: (index: number) => void;
  onClose: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, currentIndex, onSelectHistory, onClose }) => {
    // Reverse history for display to show most recent first
    const reversedHistory = [...history].reverse();
    const reversedCurrentIndex = history.length - 1 - currentIndex;

    const getActionName = (index: number): string => {
        if (index === 0) return 'Original Image';
        return `Edit ${index}`;
    };

  return (
    <div className="fixed inset-0 bg-black/30 z-40 animate-fade-in backdrop-blur-sm" onClick={onClose}>
      <div
        className="fixed top-0 right-0 h-full w-full max-w-sm bg-gray-900/80 border-l border-gray-700/80 shadow-2xl flex flex-col animate-slide-in-right"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-100">Edit History</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close history panel"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto p-4 space-y-3">
          {reversedHistory.map((imageDataUrl, reversedIndex) => {
            const originalIndex = history.length - 1 - reversedIndex;
            const isActive = reversedIndex === reversedCurrentIndex;

            return (
              <button
                key={originalIndex}
                onClick={() => onSelectHistory(originalIndex)}
                className={`w-full flex items-center gap-4 p-2 rounded-lg text-left transition-all duration-200 border-2 ${
                  isActive
                    ? 'bg-blue-500/30 border-blue-500 shadow-md'
                    : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/70 hover:border-gray-600'
                }`}
              >
                <img
                  src={imageDataUrl}
                  alt={`History state ${originalIndex}`}
                  className="w-16 h-16 object-cover rounded-md flex-shrink-0 bg-gray-700"
                  loading="lazy"
                />
                <div className="flex-grow">
                  <span className={`font-semibold text-base ${isActive ? 'text-white' : 'text-gray-300'}`}>
                    {getActionName(originalIndex)}
                  </span>
                  {isActive && (
                    <span className="text-xs font-medium text-blue-300 bg-blue-900/50 border border-blue-500/50 px-2 py-0.5 rounded-full ml-2">
                        Current
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;