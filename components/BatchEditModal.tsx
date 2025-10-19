/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { applyStyleByExample } from '../services/geminiService';
import { CloseIcon, UploadIcon, DocumentDuplicateIcon } from './icons';
import Spinner from './Spinner';

interface BatchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalImage: File;
  editedImage: File;
}

type ProcessStatus = 'queued' | 'processing' | 'complete' | 'error';

interface ProcessFile {
  id: string;
  file: File;
  status: ProcessStatus;
  previewUrl: string;
  resultUrl?: string;
  error?: string;
}

// Helper to convert data URL to Blob for zipping
const dataURLtoBlob = (dataurl: string): Blob => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type");
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

const BatchEditModal: React.FC<BatchEditModalProps> = ({ isOpen, onClose, originalImage, editedImage }) => {
  const [files, setFiles] = useState<ProcessFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [originalPreview, setOriginalPreview] = useState<string>('');
  const [editedPreview, setEditedPreview] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
        setOriginalPreview(URL.createObjectURL(originalImage));
        setEditedPreview(URL.createObjectURL(editedImage));
    } else {
        // Reset state on close
        setFiles([]);
        setIsProcessing(false);
        setProgress(0);
    }

    return () => {
        URL.revokeObjectURL(originalPreview);
        URL.revokeObjectURL(editedPreview);
    }
  }, [isOpen, originalImage, editedImage]);
  

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const newFiles: ProcessFile[] = Array.from(selectedFiles)
        .filter(file => file.type.startsWith('image/'))
        .map(file => ({
            id: `${file.name}-${file.lastModified}`,
            file,
            status: 'queued',
            previewUrl: URL.createObjectURL(file),
        }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleProcess = async () => {
    setIsProcessing(true);
    setProgress(0);
    
    let completed = 0;
    
    for (let i = 0; i < files.length; i++) {
        const currentFile = files[i];
        
        // Update status to processing
        setFiles(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'processing' } : f));
        
        try {
            const resultUrl = await applyStyleByExample(originalImage, editedImage, currentFile.file);
            setFiles(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'complete', resultUrl } : f));
        } catch (err) {
            console.error(`Failed to process ${currentFile.file.name}:`, err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setFiles(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'error', error: errorMessage } : f));
        }
        
        completed++;
        setProgress((completed / files.length) * 100);
    }
    
    setIsProcessing(false);
  };

  const handleDownloadAll = async () => {
    setIsZipping(true);
    try {
        const zip = new JSZip();
        const completedFiles = files.filter(f => f.status === 'complete' && f.resultUrl);

        for (const file of completedFiles) {
            const blob = dataURLtoBlob(file.resultUrl!);
            const fileExtension = blob.type.split('/')[1] || 'png';
            const baseName = file.file.name.substring(0, file.file.name.lastIndexOf('.'));
            zip.file(`${baseName}-edited.${fileExtension}`, blob);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'UtilPic_Batch_Edit.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

    } catch(err) {
        console.error("Failed to create zip file", err);
        // You could show an error to the user here
    } finally {
        setIsZipping(false);
    }
  };

  const completedCount = files.filter(f => f.status === 'complete').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in backdrop-blur-sm p-4" onClick={onClose} aria-modal="true" role="dialog">
      <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-4xl w-full shadow-2xl flex flex-col h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <DocumentDuplicateIcon className="w-6 h-6 text-blue-400"/>
            <h2 className="text-xl font-bold text-gray-100">Batch Edit: Apply Style by Example</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition-colors" aria-label="Close">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-grow p-6 flex flex-col gap-6 min-h-0">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 p-4 bg-black/20 rounded-lg border border-gray-700">
                <p className="text-gray-300 font-semibold">Edit Style:</p>
                <div className="flex items-center gap-4">
                    <div className="text-center">
                        <img src={originalPreview} alt="Original" className="w-24 h-24 object-cover rounded-md bg-gray-700"/>
                        <span className="text-xs text-gray-400 mt-1 block">Original</span>
                    </div>
                     <span className="text-2xl text-gray-500 font-light">&rarr;</span>
                    <div className="text-center">
                        <img src={editedPreview} alt="Edited" className="w-24 h-24 object-cover rounded-md bg-gray-700"/>
                        <span className="text-xs text-gray-400 mt-1 block">Edited Style</span>
                    </div>
                </div>
            </div>

            <div 
                className={`relative flex-grow border-2 rounded-lg transition-all ${isDraggingOver ? 'border-blue-400 bg-blue-500/10' : 'border-dashed border-gray-600'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(false);
                    handleFileSelect(e.dataTransfer.files);
                }}
            >
                {files.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-gray-500">
                        <UploadIcon className="w-12 h-12" />
                        <p className="font-semibold text-lg">Drag & Drop Images Here</p>
                        <p>or</p>
                        <label htmlFor="batch-upload" className="bg-white/10 text-gray-200 font-semibold py-2 px-5 rounded-md transition-all hover:bg-white/20 active:scale-95 cursor-pointer">
                            Click to Upload
                        </label>
                        <input id="batch-upload" type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {files.map(f => (
                            <div key={f.id} className="bg-gray-700/50 rounded-lg p-2 flex flex-col gap-2 relative overflow-hidden">
                                <img src={f.status === 'complete' ? f.resultUrl : f.previewUrl} alt={f.file.name} className="w-full h-32 object-cover rounded-md bg-gray-900" />
                                <p className="text-xs text-gray-300 truncate" title={f.file.name}>{f.file.name}</p>
                                <div className="text-xs font-semibold flex items-center justify-center">
                                    {f.status === 'queued' && <span className="px-2 py-1 rounded-full bg-gray-500 text-white">Queued</span>}
                                    {f.status === 'processing' && <span className="px-2 py-1 rounded-full bg-blue-500 text-white flex items-center gap-1"><Spinner/> Processing</span>}
                                    {f.status === 'complete' && <span className="px-2 py-1 rounded-full bg-green-500 text-white">Complete</span>}
                                    {f.status === 'error' && <span className="px-2 py-1 rounded-full bg-red-500 text-white" title={f.error}>Error</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        <div className="flex-shrink-0 p-4 border-t border-gray-700 bg-gray-800/50">
            {isProcessing && (
                <div className="w-full">
                    <div className="flex justify-between items-center mb-1 text-sm">
                        <span className="text-gray-300">Processing...</span>
                        <span className="font-semibold text-white">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-2.5">
                        <div className="bg-blue-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            )}
            {!isProcessing && (
                 <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-gray-400">{files.length} images queued. {completedCount} complete.</p>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleDownloadAll}
                            disabled={completedCount === 0 || isZipping}
                            className="bg-green-600 text-white font-bold py-3 px-5 rounded-md transition-all shadow-md hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isZipping ? <><Spinner/> Zipping...</> : 'Download All (.zip)'}
                        </button>
                        <button
                            onClick={handleProcess}
                            disabled={files.length === 0}
                            className="bg-blue-600 text-white font-bold py-3 px-8 rounded-md transition-all shadow-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            Start
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default BatchEditModal;
