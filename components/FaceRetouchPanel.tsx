/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { detectFaces, type Face } from '../services/geminiService.ts';
import { CheckIcon } from './icons.tsx';
import Spinner from './Spinner.tsx';

interface FaceRetouchPanelProps {
  onApplyRetouch: (settings: { skinSmoothing: number; eyeBrightening: number; selectedFaces: Face[] }) => void;
  isLoading: boolean;
  currentImage: File | null;
  onFacesDetected: (faces: Face[]) => void;
  onFaceSelectionChange: (selectedFaces: Face[]) => void;
}

// Helper to create face thumbnail from original image
const createFaceThumbnail = async (imageFile: File, faceBox: Face['box']): Promise<string> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(imageFile);
        image.src = url;
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const { x, y, width, height } = faceBox;
            const sx = x * image.naturalWidth;
            const sy = y * image.naturalHeight;
            const sWidth = width * image.naturalWidth;
            const sHeight = height * image.naturalHeight;
            
            canvas.width = sWidth;
            canvas.height = sHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }
            
            ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
            resolve(canvas.toDataURL());
            URL.revokeObjectURL(url);
        };
        image.onerror = (err) => {
            reject(err);
            URL.revokeObjectURL(url);
        };
    });
};


const FaceRetouchPanel: React.FC<FaceRetouchPanelProps> = ({ onApplyRetouch, isLoading, currentImage, onFacesDetected, onFaceSelectionChange }) => {
  const [skinSmoothing, setSkinSmoothing] = useState(50);
  const [eyeBrightening, setEyeBrightening] = useState(30);
  
  const [detectedFaces, setDetectedFaces] = useState<(Face & { id: number, previewUrl: string })[]>([]);
  const [selectedFaceIds, setSelectedFaceIds] = useState<Set<number>>(new Set());
  const [isLoadingFaces, setIsLoadingFaces] = useState(false);
  const detectionTriggered = useRef(false);

  // When panel becomes visible, reset state
  useEffect(() => {
    detectionTriggered.current = false;
    setDetectedFaces([]);
    setSelectedFaceIds(new Set());
    onFacesDetected([]);
    onFaceSelectionChange([]);
  }, [currentImage, onFacesDetected, onFaceSelectionChange]);
  
  const handleDetectFaces = useCallback(async () => {
    if (!currentImage || isLoadingFaces) return;

    setIsLoadingFaces(true);
    detectionTriggered.current = true;
    try {
        const faces = await detectFaces(currentImage);
        
        // Generate previews
        const facesWithPreviews = await Promise.all(faces.map(async (face, index) => ({
            ...face,
            id: index,
            previewUrl: await createFaceThumbnail(currentImage, face.box)
        })));
        
        setDetectedFaces(facesWithPreviews);
        onFacesDetected(faces);

        // Auto-select all faces by default after detection
        const allIds = new Set(facesWithPreviews.map(f => f.id));
        setSelectedFaceIds(allIds);
        onFaceSelectionChange(facesWithPreviews);

    } catch (error) {
        console.error("Face detection failed", error);
        // Consider showing an error to the user
    } finally {
        setIsLoadingFaces(false);
    }
  }, [currentImage, isLoadingFaces, onFacesDetected, onFaceSelectionChange]);

  const toggleFaceSelection = (faceId: number) => {
    const newSelection = new Set(selectedFaceIds);
    if (newSelection.has(faceId)) {
        newSelection.delete(faceId);
    } else {
        newSelection.add(faceId);
    }
    setSelectedFaceIds(newSelection);
    onFaceSelectionChange(detectedFaces.filter(f => newSelection.has(f.id)));
  };

  const toggleSelectAll = () => {
    if (selectedFaceIds.size === detectedFaces.length) {
        setSelectedFaceIds(new Set());
        onFaceSelectionChange([]);
    } else {
        const allIds = new Set(detectedFaces.map(f => f.id));
        setSelectedFaceIds(allIds);
        onFaceSelectionChange(detectedFaces);
    }
  };

  const handleApply = () => {
    const selectedFaces = detectedFaces.filter(face => selectedFaceIds.has(face.id));
    onApplyRetouch({
      skinSmoothing,
      eyeBrightening,
      selectedFaces: selectedFaces.length > 0 ? selectedFaces : detectedFaces, // If none selected, apply to all
    });
  };
  
  const renderFaceSelection = () => {
    if (isLoadingFaces) {
        return <div className="flex justify-center items-center py-8"><Spinner /></div>;
    }
    if (detectionTriggered.current && detectedFaces.length === 0) {
        return <p className="text-center text-gray-400 py-4">No faces were detected in the image.</p>;
    }
    if (detectedFaces.length > 1) {
        return (
            <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-400">Select faces to retouch</label>
                    <button onClick={toggleSelectAll} className="text-xs text-blue-400 hover:text-blue-300">
                        {selectedFaceIds.size === detectedFaces.length ? 'Deselect All' : 'Select All'}
                    </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 bg-black/20 p-2 rounded-lg border border-gray-700">
                    {detectedFaces.map(face => (
                        <button key={face.id} onClick={() => toggleFaceSelection(face.id)} className="relative aspect-square rounded-md overflow-hidden transition-transform duration-200 active:scale-95">
                            <img src={face.previewUrl} alt={`Face ${face.id + 1}`} className="w-full h-full object-cover" />
                            {selectedFaceIds.has(face.id) && (
                                <div className="absolute inset-0 bg-blue-500/60 flex items-center justify-center border-2 border-blue-300 rounded-md">
                                    <CheckIcon className="w-6 h-6 text-white" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        );
    }
    return null;
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col gap-6 animate-fade-in backdrop-blur-sm">
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-200">AI Face Retouch</h3>
        <p className="text-base text-gray-400 mt-1">Fine-tune enhancements for one or more faces.</p>
      </div>
      
      {!detectionTriggered.current ? (
          <button onClick={handleDetectFaces} disabled={isLoadingFaces || isLoading} className="w-full bg-white/10 text-gray-200 font-semibold py-3 px-4 rounded-md transition-all hover:bg-white/20 active:scale-95 disabled:opacity-50">
            {isLoadingFaces ? 'Detecting...' : 'Detect Faces'}
          </button>
      ) : (
          renderFaceSelection()
      )}
      
      {(detectionTriggered.current && detectedFaces.length > 0) && (
        <div className="animate-fade-in space-y-5">
            <div>
                <div className="flex justify-between items-center mb-1">
                    <label htmlFor="skin-smoothing" className="block text-sm font-medium text-gray-400">Skin Smoothing</label>
                    <span className="text-sm font-semibold text-gray-200 bg-gray-700 px-2 py-1 rounded w-14 text-center">{skinSmoothing}</span>
                </div>
                <input
                    id="skin-smoothing" type="range" min="0" max="100" value={skinSmoothing}
                    onChange={(e) => setSkinSmoothing(Number(e.target.value))}
                    disabled={isLoading} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>
            <div>
                <div className="flex justify-between items-center mb-1">
                    <label htmlFor="eye-brightening" className="block text-sm font-medium text-gray-400">Eye Brightening</label>
                    <span className="text-sm font-semibold text-gray-200 bg-gray-700 px-2 py-1 rounded w-14 text-center">{eyeBrightening}</span>
                </div>
                <input
                    id="eye-brightening" type="range" min="0" max="100" value={eyeBrightening}
                    onChange={(e) => setEyeBrightening(Number(e.target.value))}
                    disabled={isLoading} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>
        </div>
      )}

      <button
        onClick={handleApply}
        disabled={isLoading || !detectionTriggered.current || detectedFaces.length === 0}
        className="w-full max-w-sm mx-auto mt-2 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-lg disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        Apply Retouch
      </button>
    </div>
  );
};

export default FaceRetouchPanel;