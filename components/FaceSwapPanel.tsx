/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { detectFaces, type Face } from '../services/geminiService.ts';
import { CheckIcon, UploadIcon } from './icons.tsx';
import Spinner from './Spinner.tsx';

// Helper to create face thumbnail
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
            canvas.width = sWidth; canvas.height = sHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Could not get canvas context')); return; }
            ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
            resolve(canvas.toDataURL());
            URL.revokeObjectURL(url);
        };
        image.onerror = (err) => { reject(err); URL.revokeObjectURL(url); };
    });
};

type FaceWithPreview = Face & { id: number; previewUrl: string; };

interface FaceSwapPanelProps {
  onApplyFaceSwap: (sourceImage: File, targetFace: Face, sourceFace: Face) => void;
  isLoading: boolean;
  targetImage: File | null;
}

const FaceSwapPanel: React.FC<FaceSwapPanelProps> = ({ onApplyFaceSwap, isLoading, targetImage }) => {
  // State for Target Image
  const [targetFaces, setTargetFaces] = useState<FaceWithPreview[]>([]);
  const [selectedTargetFaceId, setSelectedTargetFaceId] = useState<number | null>(null);
  const [isDetectingTarget, setIsDetectingTarget] = useState(false);

  // State for Source Image
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourceFaces, setSourceFaces] = useState<FaceWithPreview[]>([]);
  const [selectedSourceFaceId, setSelectedSourceFaceId] = useState<number | null>(null);
  const [isDetectingSource, setIsDetectingSource] = useState(false);

  const [error, setError] = useState<string | null>(null);
  
  // Detect faces in the main (target) image when the panel is opened
  useEffect(() => {
    if (targetImage) {
      setIsDetectingTarget(true);
      setError(null);
      detectFaces(targetImage)
        .then(async (faces) => {
          const facesWithPreviews = await Promise.all(faces.map(async (face, index) => ({
            ...face, id: index, previewUrl: await createFaceThumbnail(targetImage, face.box)
          })));
          setTargetFaces(facesWithPreviews);
        })
        .catch(err => {
          console.error("Target face detection failed", err);
          setError("Could not detect faces in the main image.");
        })
        .finally(() => setIsDetectingTarget(false));
    }
  }, [targetImage]);

  const handleSourceImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSourceImage(file);
      setSourceFaces([]);
      setSelectedSourceFaceId(null);
      setIsDetectingSource(true);
      setError(null);
      detectFaces(file)
        .then(async (faces) => {
          const facesWithPreviews = await Promise.all(faces.map(async (face, index) => ({
            ...face, id: index, previewUrl: await createFaceThumbnail(file, face.box)
          })));
          setSourceFaces(facesWithPreviews);
        })
        .catch(err => {
          console.error("Source face detection failed", err);
          setError("Could not detect faces in the source image.");
        })
        .finally(() => setIsDetectingSource(false));
    }
  }, []);

  const handleApply = () => {
    if (!sourceImage || selectedTargetFaceId === null || selectedSourceFaceId === null) return;
    const targetFace = targetFaces.find(f => f.id === selectedTargetFaceId);
    const sourceFace = sourceFaces.find(f => f.id === selectedSourceFaceId);
    if (targetFace && sourceFace) {
      onApplyFaceSwap(sourceImage, targetFace, sourceFace);
    }
  };

  const FaceSelector: React.FC<{ title: string; faces: FaceWithPreview[]; selectedId: number | null; onSelect: (id: number) => void; isLoading: boolean; numFaces: number | undefined }> = 
    ({ title, faces, selectedId, onSelect, isLoading, numFaces }) => (
    <div className="flex-1">
      <h4 className="text-lg font-semibold text-gray-300 mb-2">{title}</h4>
      {isLoading ? (
        <div className="flex justify-center items-center h-24"><Spinner /></div>
      ) : faces.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 bg-black/20 p-2 rounded-lg border border-gray-700">
          {faces.map(face => (
            <button key={face.id} onClick={() => onSelect(face.id)} className="relative aspect-square rounded-md overflow-hidden transition-transform duration-200 active:scale-95">
              <img src={face.previewUrl} alt={`Face ${face.id + 1}`} className="w-full h-full object-cover" />
              {selectedId === face.id && (
                <div className="absolute inset-0 bg-blue-500/60 flex items-center justify-center border-2 border-blue-300 rounded-md">
                  <CheckIcon className="w-6 h-6 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">{numFaces === 0 ? "No faces detected." : "Please upload an image."}</p>
      )}
    </div>
  );

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col gap-6 animate-fade-in backdrop-blur-sm">
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-200">AI Face Swap</h3>
        <p className="text-base text-gray-400 mt-1">Select a face to replace from your image, then upload a source image and select a face to use.</p>
      </div>
      
      {error && <p className="text-red-400 text-center bg-red-500/10 p-3 rounded-md">{error}</p>}

      <div className="flex flex-col md:flex-row gap-6">
        {/* Target Faces */}
        <FaceSelector title="Target Face (to replace)" faces={targetFaces} selectedId={selectedTargetFaceId} onSelect={setSelectedTargetFaceId} isLoading={isDetectingTarget} numFaces={targetFaces.length} />

        {/* Source Faces */}
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-gray-300 mb-2">Source Face (to use)</h4>
          {!sourceImage ? (
             <label htmlFor="source-image-upload" className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                <UploadIcon className="w-8 h-8 text-gray-500" />
                <span className="text-sm text-gray-400">Upload Source Image</span>
             </label>
          ) : (
            <FaceSelector title="" faces={sourceFaces} selectedId={selectedSourceFaceId} onSelect={setSelectedSourceFaceId} isLoading={isDetectingSource} numFaces={sourceFaces.length} />
          )}
           <input id="source-image-upload" type="file" className="hidden" accept="image/*" onChange={handleSourceImageUpload} />
        </div>
      </div>

      <button
        onClick={handleApply}
        disabled={isLoading || selectedTargetFaceId === null || selectedSourceFaceId === null}
        className="w-full max-w-sm mx-auto mt-2 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-lg disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        Apply Face Swap
      </button>
    </div>
  );
};

export default FaceSwapPanel;
