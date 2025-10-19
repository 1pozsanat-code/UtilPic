/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { Suggestion, Tab } from '../App.tsx';
import { CloseIcon } from './icons.tsx';

interface SuggestionPanelProps {
  suggestions: Suggestion[];
  onApplySuggestion: (tab: Tab) => void;
  onDismiss: () => void;
}

const SuggestionPanel: React.FC<SuggestionPanelProps> = ({ suggestions, onApplySuggestion, onDismiss }) => {
  return (
    <div className="w-full bg-gray-800/50 border border-gray-700/80 rounded-lg p-4 animate-fade-in backdrop-blur-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-200">AI Suggestions</h3>
        <button
          onClick={onDismiss}
          className="p-2 rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Dismiss suggestions"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={() => onApplySuggestion(suggestion.tab)}
            className="flex items-start text-left gap-4 p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200 ease-in-out group"
          >
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-blue-500/20 rounded-lg text-blue-300 transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-500/30">
                <suggestion.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-gray-100">{suggestion.title}</p>
              <p className="text-sm text-gray-400">{suggestion.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SuggestionPanel;