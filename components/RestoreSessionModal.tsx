/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface RestoreSessionModalProps {
  onRestore: () => void;
  onStartNew: () => void;
}

const RestoreSessionModal: React.FC<RestoreSessionModalProps> = ({ onRestore, onStartNew }) => {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-100 mb-3">Welcome Back!</h2>
        <p className="text-gray-400 mb-6">
          It looks like you have an unsaved session. Would you like to restore it?
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={onStartNew}
            className="bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-8 rounded-lg transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
          >
            Start New
          </button>
          <button
            onClick={onRestore}
            className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base"
          >
            Restore Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestoreSessionModal;