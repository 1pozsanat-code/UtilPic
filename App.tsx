/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateEditedImage, generateFilteredImage, generateAdjustedImage, generateUpscaledImage, generateRetouchedFace, generateRestoredImage, generateRemovedBackground, generateBackgroundImage, generateZoomedImage, analyzeImageForSuggestions, SuggestionAnalysis, generateColorGradedImage, generateSharpenedImage, generateCorrectedOrientation, generateGrainImage, generateRotatedImage, generateFaceSwap, generateDoubleExposure, generateStyleFromReference, type Face } from './services/geminiService.ts';
import { saveImageToHistoryDB, getAllHistoryImagesDB, clearHistoryDB, removeImagesFromHistoryDB } from './services/sessionDb.ts';
import Header from './components/Header.tsx';
import Spinner from './components/Spinner.tsx';
import FilterPanel from './components/FilterPanel.tsx';
import AdjustmentPanel, { type ColorPickerType } from './components/AdjustmentPanel.tsx';
import CropPanel from './components/CropPanel.tsx';
import UpscalePanel from './components/UpscalePanel.tsx';
import FaceRetouchPanel from './components/FaceRetouchPanel.tsx';
import FaceSwapPanel from './components/FaceSwapPanel.tsx';
import RestorePanel from './components/RestorePanel.tsx';
import WatermarkPanel, { type WatermarkSettings } from './components/WatermarkPanel.tsx';
import BackgroundPanel, { type BackgroundSettings } from './components/BackgroundPanel.tsx';
import OverlayPanel, { type OverlayLayer } from './components/OverlayPanel.tsx';
import ZoomPanel from './components/ZoomPanel.tsx';
import DoubleExposurePanel, { type DoubleExposureSettings } from './components/DoubleExposurePanel.tsx';
import { UndoIcon, RedoIcon, EyeIcon, HistoryIcon, UserCircleIcon, PhotoIcon, SparklesIcon, SunIcon, EyeDropperIcon, ArrowUpOnSquareIcon, BullseyeIcon, PaletteIcon, MagicWandIcon, CropIcon, LayersIcon, MagnifyingGlassPlusIcon, WatermarkIcon, TuneIcon, MaskIcon, DocumentDuplicateIcon, SplitScreenIcon, FaceSwapIcon, PlusIcon, MinusIcon, FitScreenIcon, DoubleExposureIcon } from './components/icons.tsx';
import StartScreen from './components/StartScreen.tsx';
import RestoreSessionModal from './components/RestoreSessionModal.tsx';
import DownloadModal, { type DownloadSettings } from './components/DownloadModal.tsx';
import HistoryPanel from './components/HistoryPanel.tsx';
import SuggestionPanel from './components/SuggestionPanel.tsx';
import ColorGradePanel from './components/ColorGradePanel.tsx';
import MaskEditor from './components/MaskEditor.tsx';
import ViewControls from './components/ViewControls.tsx';
import BatchEditModal from './components/BatchEditModal.tsx';
import BatchPresetModal from './components/BatchPresetModal.tsx';


// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

// Helper to convert a File to a data URL string
const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

// Helper to convert a colored mask overlay into a black and white mask file for the API
const createBlackAndWhiteMask = (redOverlayUrl: string, width: number, height: number): Promise<File> => {
    return new Promise((resolve, reject) => {
        const maskImage = new Image();
        maskImage.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context for mask generation.'));

            // Draw the red, semi-transparent overlay
            ctx.drawImage(maskImage, 0, 0, width, height);
            
            // Process pixels to create a pure black and white mask
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                // Check if the pixel has color (is not transparent)
                if (data[i + 3] > 0) { // Check alpha channel
                    data[i] = 255;     // R
                    data[i + 1] = 255; // G
                    data[i + 2] = 255; // B
                } else {
                    data[i] = 0;
                    data[i + 1] = 0;
                    data[i + 2] = 0;
                }
                // Alpha is kept
            }
            ctx.putImageData(imageData, 0, 0);

            canvas.toBlob((blob) => {
                if (!blob) return reject(new Error('Failed to create blob from mask canvas.'));
                const maskFile = new File([blob], 'mask.png', { type: 'image/png' });
                resolve(maskFile);
            }, 'image/png');
        };
        maskImage.onerror = (err) => reject(err);
        maskImage.src = redOverlayUrl;
    });
};


export type Tab = 'retouch' | 'face' | 'faceSwap' | 'adjust' | 'filters' | 'colorGrade' | 'crop' | 'background' | 'overlay' | 'upscale' | 'zoom' | 'restore' | 'watermark' | 'mask' | 'doubleExposure';

export type Suggestion = {
  id: string;
  tab: Tab;
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
};

// Define a library of all possible suggestions
const suggestionsLibrary: { [key: string]: Suggestion } = {
    // Technical Fixes
    restorePhoto: { id: 'restore', tab: 'restore', title: 'Restore Photo', description: 'Repair damage, fix fading, and improve clarity.', icon: SparklesIcon },
    upscaleSharpen: { id: 'upscale', tab: 'upscale', title: 'Upscale & Sharpen', description: 'Increase resolution and enhance sharpness.', icon: ArrowUpOnSquareIcon },
    improveLighting: { id: 'adjust-light', tab: 'adjust', title: 'Improve Lighting', description: 'Brighten the image and adjust the color temperature.', icon: SunIcon },
    
    // Portrait & People
    retouchFace: { id: 'face', tab: 'face', title: 'Retouch Face', description: 'Enhance portraits with professional facial retouching.', icon: UserCircleIcon },
    retouchFaces: { id: 'face-group', tab: 'face', title: 'Retouch Faces', description: 'Apply natural enhancements to faces in the group.', icon: UserCircleIcon },
    blurBackground: { id: 'adjust-blur-bg', tab: 'adjust', title: 'Blur Background', description: 'Create a professional "portrait mode" depth-of-field effect.', icon: BullseyeIcon },

    // Landscape & Scenery
    enhanceDetails: { id: 'adjust-details', tab: 'adjust', title: 'Enhance Details', description: 'Sharpen details and improve clarity for scenic shots.', icon: PhotoIcon },
    warmerLighting: { id: 'adjust-warm-light', tab: 'adjust', title: 'Add Warm Light', description: 'Give the photo a warm, "golden hour" feel.', icon: SunIcon },
    dramaticLook: { id: 'filter-dramatic', tab: 'filters', title: 'Apply Dramatic Filter', description: 'Add contrast and mood for a more powerful, cinematic look.', icon: PaletteIcon },

    // Color & Style
    boostVibrancy: { id: 'adjust-vibrancy', tab: 'adjust', title: 'Boost Color Vibrancy', description: 'Make the colors in your image pop.', icon: PaletteIcon },
    moodyColors: { id: 'filter-moody', tab: 'filters', title: 'Apply Moody Filter', description: 'Desaturate colors for a cinematic, moody feel.', icon: PaletteIcon },

    // Utility
    removeBackground: { id: 'background', tab: 'background', title: 'Remove Background', description: 'Isolate the main subject with a clean background removal.', icon: EyeDropperIcon },
};

const mapAnalysisToSuggestions = (analysis: SuggestionAnalysis): Suggestion[] => {
    const uniqueSuggestions = new Map<string, Suggestion>();
    
    const addSuggestion = (key: string) => {
        const suggestion = suggestionsLibrary[key];
        if (suggestion && !uniqueSuggestions.has(suggestion.id)) {
            uniqueSuggestions.set(suggestion.id, suggestion);
        }
    };

    // --- Rule-based suggestion logic ---

    // 1. Prioritize critical technical fixes
    if (analysis.characteristics.includes('damaged') || analysis.image_type === 'old_photo') {
        addSuggestion('restorePhoto');
    }
    if (analysis.characteristics.includes('blurry')) {
        addSuggestion('upscaleSharpen');
    }
    if (analysis.characteristics.includes('low_light')) {
        addSuggestion('improveLighting');
    }

    // 2. Suggestions based on image type
    switch (analysis.image_type) {
        case 'portrait':
            addSuggestion('retouchFace');
            addSuggestion('blurBackground');
            break;
        case 'group_photo':
            addSuggestion('retouchFaces');
            break;
        case 'landscape':
            addSuggestion('enhanceDetails');
            break;
        case 'product_shot':
            addSuggestion('removeBackground');
            break;
    }
    
    // 3. Contextual suggestions based on mood and characteristics
    const moodLower = analysis.mood.toLowerCase();

    if (analysis.characteristics.includes('muted_colors')) {
        addSuggestion('boostVibrancy');
    }

    if (analysis.image_type === 'landscape') {
        if (moodLower.includes('dramatic') || moodLower.includes('moody') || moodLower.includes('stormy')) {
            addSuggestion('dramaticLook');
        } else if (moodLower.includes('serene') || moodLower.includes('peaceful') || moodLower.includes('golden')) {
            addSuggestion('warmerLighting');
        }
    }
    
    if (analysis.image_type === 'portrait' && (moodLower.includes('happy') || moodLower.includes('joyful') || moodLower.includes('warm'))) {
        addSuggestion('warmerLighting');
    }

    if (moodLower.includes('moody') || moodLower.includes('dark') || moodLower.includes('somber') || moodLower.includes('cinematic')) {
        addSuggestion('moodyColors');
    }

    return Array.from(uniqueSuggestions.values());
};

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof (error as any).message === 'string') {
        return (error as any).message;
    }
    return 'An unknown error occurred.';
};

const tools = [
  { id: 'retouch', label: 'Retouch', icon: MagicWandIcon },
  { id: 'mask', label: 'Mask', icon: MaskIcon },
  { id: 'face', label: 'Face', icon: UserCircleIcon },
  { id: 'faceSwap', label: 'Face Swap', icon: FaceSwapIcon },
  { id: 'adjust', label: 'Adjust', icon: SunIcon },
  { id: 'filters', label: 'Filters', icon: PaletteIcon },
  { id: 'colorGrade', label: 'Color Grade', icon: TuneIcon },
  { id: 'crop', label: 'Crop', icon: CropIcon },
  { id: 'background', label: 'Background', icon: EyeDropperIcon },
  { id: 'overlay', label: 'Overlay', icon: LayersIcon },
  { id: 'doubleExposure', label: 'Double Exp.', icon: DoubleExposureIcon },
  { id: 'upscale', label: 'Upscale', icon: ArrowUpOnSquareIcon },
  { id: 'zoom', label: 'AI Zoom', icon: MagnifyingGlassPlusIcon },
  { id: 'restore', label: 'Restore', icon: SparklesIcon },
  { id: 'watermark', label: 'Watermark', icon: WatermarkIcon },
] as const;

// Helper to determine if an image has a solid background color, by checking its corners.
const getSolidBackgroundColor = (ctx: CanvasRenderingContext2D, width: number, height: number): { r: number; g: number; b: number } | null => {
    if (width < 2 || height < 2) return null; // Not enough pixels to check corners
    
    const p1 = ctx.getImageData(0, 0, 1, 1).data;
    // If the top-left pixel is already transparent, assume the image has a proper alpha channel and doesn't need keying.
    if (p1[3] < 250) return null; 

    const p2 = ctx.getImageData(width - 1, 0, 1, 1).data;
    const p3 = ctx.getImageData(0, height - 1, 1, 1).data;
    const p4 = ctx.getImageData(width - 1, height - 1, 1, 1).data;

    // All corners must be opaque to be considered for solid background removal.
    if (p1[3] < 250 || p2[3] < 250 || p3[3] < 250 || p4[3] < 250) {
        return null;
    }

    const tolerance = 15;
    
    const isSimilar = (d1: Uint8ClampedArray, d2: Uint8ClampedArray) => 
        Math.abs(d1[0] - d2[0]) < tolerance &&
        Math.abs(d1[1] - d2[1]) < tolerance &&
        Math.abs(d1[2] - d2[2]) < tolerance;
    
    // Check if all corners are similar in color
    if (isSimilar(p1, p2) && isSimilar(p1, p3) && isSimilar(p1, p4)) {
        return { r: p1[0], g: p1[1], b: p1[2] };
    }
    
    return null;
};


const App: React.FC = () => {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number, y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [rotation, setRotation] = useState(0);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Zoom & Pan state
  const [viewTransform, setViewTransform] = useState({ scale: 1, pan: { x: 0, y: 0 } });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingHotspot, setIsDraggingHotspot] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [sessionToRestore, setSessionToRestore] = useState<{ historyLength: number; historyIndex: number; activeTab?: Tab; prompt?: string; } | null>(null);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);
  const [isBatchEditModalOpen, setIsBatchEditModalOpen] = useState<boolean>(false);
  const [isBgRemovalMode, setIsBgRemovalMode] = useState<boolean>(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState<boolean>(false);
  const [isBatchPresetModalOpen, setIsBatchPresetModalOpen] = useState<boolean>(false);
  const [batchPresetInfo, setBatchPresetInfo] = useState<{ name: string; prompt: string; type: 'filter' | 'colorGrade' | 'adjustment' } | null>(null);
  const [activeColorPicker, setActiveColorPicker] = useState<ColorPickerType | null>(null);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  
  // Real-time preview filter string (e.g., "contrast(1.2) brightness(1.1)")
  const [previewFilter, setPreviewFilter] = useState<string>('');

  // Split View state
  const [isSplitView, setIsSplitView] = useState<boolean>(false);
  const [splitPosition, setSplitPosition] = useState<number>(50); // percentage
  const isDraggingSplitter = useRef(false);

  // State for multi-layer overlays
  const [overlayLayers, setOverlayLayers] = useState<OverlayLayer[]>([]);
  const [activeOverlayId, setActiveOverlayId] = useState<number | null>(null);

  // State for AI Suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  
  // State for Face Retouch
  const [detectedFaces, setDetectedFaces] = useState<Face[]>([]);
  const [selectedFaces, setSelectedFaces] = useState<Face[]>([]);

  const isZoomPanEnabled = activeTab !== 'crop' && !isSplitView;

  // FIX: Moved useMemo to the top level of the component to obey the Rules of Hooks.
  const cursorStyle = useMemo(() => {
    if (!isZoomPanEnabled) return 'default';
    if (viewTransform.scale > 1) return isPanning ? 'grabbing' : 'grab';
    if ((activeTab === 'retouch' || activeTab === 'adjust' || activeTab === 'zoom') && !maskDataUrl && !activeColorPicker) return 'crosshair';
    if (activeColorPicker) return 'crosshair';
    return 'default';
  }, [isZoomPanEnabled, viewTransform.scale, isPanning, activeTab, maskDataUrl, activeColorPicker]);


  const resetViewTransform = useCallback(() => {
    setViewTransform({ scale: 1, pan: { x: 0, y: 0 } });
  }, []);

  // Check for saved session on initial load
  useEffect(() => {
    try {
        const savedSession = localStorage.getItem('utilpic-session');
        if (savedSession) {
            const parsed = JSON.parse(savedSession);
            if (typeof parsed.historyLength === 'number' && typeof parsed.historyIndex === 'number' && parsed.historyLength > 0) {
                setSessionToRestore({ 
                    historyLength: parsed.historyLength, 
                    historyIndex: parsed.historyIndex,
                    activeTab: parsed.activeTab,
                    prompt: parsed.prompt,
                });
            }
        }
    } catch (e) {
        console.error("Failed to load session from localStorage", e);
        localStorage.removeItem('utilpic-session');
    } finally {
        setIsLoadingSession(false);
    }
  }, []);

  // Auto-save session to localStorage
  useEffect(() => {
    // Don't save while the restore prompt is active
    if (sessionToRestore || isLoadingSession) return;

    const saveSession = () => {
        if (history.length > 0) {
            try {
                const sessionData = {
                    historyLength: history.length,
                    historyIndex,
                    activeTab,
                    prompt: activeTab === 'retouch' ? prompt : '',
                };
                localStorage.setItem('utilpic-session', JSON.stringify(sessionData));
            } catch (e) {
                console.error("Failed to save session:", e);
            }
        } else {
            localStorage.removeItem('utilpic-session');
        }
    };

    saveSession();
  }, [history.length, historyIndex, activeTab, prompt, sessionToRestore, isLoadingSession]);

  // Reset states based on active tab
  useEffect(() => {
    // Clear preview filter when changing tabs
    setPreviewFilter('');

    if (activeTab !== 'background') {
        setIsBgRemovalMode(false);
    }
    if (activeTab !== 'adjust') {
        setActiveColorPicker(null);
    }
    if (activeTab !== 'face') {
        setDetectedFaces([]);
        setSelectedFaces([]);
    }
    // Reset view when switching to crop/zoom tabs
    if (activeTab === 'crop' || activeTab === 'zoom') {
        resetViewTransform();
    }
    // Exit split view when changing tabs
    setIsSplitView(false);
  }, [activeTab, resetViewTransform]);

  const currentImageUrl = history[historyIndex] ?? null;
  const originalImageUrl = history[0] ?? null;

  // Lazily create a File object from the current data URL only when needed for an API call.
  const currentImage = useMemo<File | null>(() => {
    if (!currentImageUrl) return null;
    return dataURLtoFile(currentImageUrl, `edit-${historyIndex}.png`);
  }, [currentImageUrl, historyIndex]);

  const originalImage = useMemo<File | null>(() => {
    if (!originalImageUrl) return null;
    return dataURLtoFile(originalImageUrl, `original.png`);
  }, [originalImageUrl]);


  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback(async (newImageDataUrl: string) => {
    setShowSuggestions(false);
    // Clear the preview filter now that the change is committed
    setPreviewFilter(''); 
    
    const newHistory = history.slice(0, historyIndex + 1);
    const newHistoryIndex = newHistory.length;

    try {
      await removeImagesFromHistoryDB(newHistoryIndex); // Clear any "redo" states from DB
      await saveImageToHistoryDB(newHistoryIndex, newImageDataUrl);
    } catch (e) {
      console.error("Failed to save image to IndexedDB", e);
      setError("Could not save your edit. Your browser might be in private mode or storage is full.");
      return;
    }
    
    // Reset transient states *before* updating history to prevent race conditions.
    setEditHotspot(null);
    setDisplayHotspot(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setOverlayLayers([]);
    setActiveOverlayId(null);
    setDetectedFaces([]);
    setSelectedFaces([]);
    setMaskDataUrl(null);
    setRotation(0);
    resetViewTransform();

    newHistory.push(newImageDataUrl);
    setHistory(newHistory);
    setHistoryIndex(newHistoryIndex);
  }, [history, historyIndex, resetViewTransform]);

  const handleImageUpload = useCallback(async (file: File) => {
    localStorage.removeItem('utilpic-session');
    await clearHistoryDB();
    setError(null);
    setIsLoading(true);
    setSuggestions([]);
    setShowSuggestions(false);
    setPreviewFilter('');
    resetViewTransform();

    try {
        const dataUrl = await fileToDataURL(file);
        await saveImageToHistoryDB(0, dataUrl);
        setHistory([dataUrl]);
        setHistoryIndex(0);
        setPrompt('');
        setEditHotspot(null);
        setDisplayHotspot(null);
        setActiveTab('retouch');
        setCrop(undefined);
        setCompletedCrop(undefined);
        setIsBgRemovalMode(false);
        setOverlayLayers([]);
        setActiveOverlayId(null);
        setDetectedFaces([]);
        setSelectedFaces([]);
        setMaskDataUrl(null);
        setRotation(0);

        // Don't await this, let it run in the background
        analyzeImageForSuggestions(file).then(analysis => {
            console.log("Image analysis complete:", analysis);
            const newSuggestions = mapAnalysisToSuggestions(analysis);
            if (newSuggestions.length > 0) {
              setSuggestions(newSuggestions);
              setShowSuggestions(true);
            }
        }).catch(err => {
            // Log the error but don't show it to the user, it's not critical
            console.error("Failed to get AI suggestions:", err);
        });

    } catch(e) {
        console.error("Failed to load image", e);
        setError("There was a problem loading your image. Please try a different file.");
    } finally {
        setIsLoading(false);
    }
  }, [resetViewTransform]);

  const handleGenerate = useCallback(async (overridePrompt?: string) => {
    if (!currentImage) {
      setError('No image loaded to edit.');
      return;
    }
    
    // Use the override prompt if provided, otherwise check the state
    const promptToUse = overridePrompt || prompt;

    if (!promptToUse.trim()) {
        setError('Please enter a description for your edit.');
        return;
    }

    if (!editHotspot && !maskDataUrl) {
        setError('Please click on the image to select an area to edit, or use the Mask tool for a more complex selection.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewFilter(''); // Clear preview when generating
    
    try {
        let maskFile: File | undefined = undefined;
        if (maskDataUrl && imgRef.current) {
            maskFile = await createBlackAndWhiteMask(maskDataUrl, imgRef.current.naturalWidth, imgRef.current.naturalHeight);
        }
        
        const editedImageUrl = await generateEditedImage(currentImage, promptToUse, editHotspot, maskFile);
        await addImageToHistory(editedImageUrl);
        setPrompt(''); // Clear prompt after success
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to generate the image. ${errorMessage}`);
        console.error("Caught error in handleGenerate:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, prompt, editHotspot, addImageToHistory, maskDataUrl]);

  const handleApplyLocalAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply an adjustment to.');
      return;
    }
    if (!editHotspot && !maskDataUrl) {
        setError('Please click on the image to select an area, or use the Mask tool for a more complex selection.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewFilter('');
    
    try {
        let maskFile: File | undefined = undefined;
        if (maskDataUrl && imgRef.current) {
            maskFile = await createBlackAndWhiteMask(maskDataUrl, imgRef.current.naturalWidth, imgRef.current.naturalHeight);
        }
        
        const editedImageUrl = await generateEditedImage(currentImage, adjustmentPrompt, editHotspot, maskFile);
        await addImageToHistory(editedImageUrl);
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to apply the local adjustment. ${errorMessage}`);
        console.error("Caught error in handleApplyLocalAdjustment:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, editHotspot, maskDataUrl, addImageToHistory]);
  
  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply a filter to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPreviewFilter('');
    
    try {
        const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
        await addImageToHistory(filteredImageUrl);
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to apply the filter. ${errorMessage}`);
        console.error("Caught error in handleApplyFilter:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyColorGrade = useCallback(async (gradePrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply a color grade to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPreviewFilter('');
    
    try {
        const gradedImageUrl = await generateColorGradedImage(currentImage, gradePrompt);
        await addImageToHistory(gradedImageUrl);
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to apply the color grade. ${errorMessage}`);
        console.error("Caught error in handleApplyColorGrade:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleApplyAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply an adjustment to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    // Note: We don't clear previewFilter here immediately if we wanted to fade it out, 
    // but clearing it ensures the new image (from AI) replaces the CSS preview cleanly.
    setPreviewFilter(''); 
    
    try {
        const adjustedImageUrl = await generateAdjustedImage(currentImage, adjustmentPrompt);
        await addImageToHistory(adjustedImageUrl);
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to apply the adjustment. ${errorMessage}`);
        console.error("Caught error in handleApplyAdjustment:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyStyleFromUrl = useCallback(async (styleUrl: string) => {
    if (!currentImage) {
        setError('No image loaded to apply a style to.');
        return;
    }
    setIsLoading(true);
    setError(null);
    setPreviewFilter('');

    try {
        // Fetch the image from the URL
        const response = await fetch(styleUrl);
        if (!response.ok) throw new Error(`Failed to fetch image from URL (status: ${response.status})`);
        const blob = await response.blob();
        const styleFile = new File([blob], 'style-reference.jpg', { type: blob.type });

        const newImageUrl = await generateStyleFromReference(currentImage, styleFile);
        await addImageToHistory(newImageUrl);
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to apply style from URL. ${errorMessage}. Please check the URL and ensure the server allows access (CORS policy).`);
        console.error("Caught error in handleApplyStyleFromUrl:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplySharpen = useCallback(async (intensity: string) => {
    if (!currentImage) {
      setError('No image loaded to apply sharpening to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPreviewFilter('');
    
    try {
        const sharpenedImageUrl = await generateSharpenedImage(currentImage, intensity);
        await addImageToHistory(sharpenedImageUrl);
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to apply sharpening. ${errorMessage}`);
        console.error("Caught error in handleApplySharpen:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyGrain = useCallback(async (intensity: string) => {
    if (!currentImage) {
      setError('No image loaded to apply grain to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPreviewFilter('');
    
    try {
        const grainyImageUrl = await generateGrainImage(currentImage, intensity);
        await addImageToHistory(grainyImageUrl);
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to apply grain. ${errorMessage}`);
        console.error("Caught error in handleApplyGrain:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyAutoEnhance = useCallback(async () => {
    const autoEnhancePrompt = "Apply a suite of automatic adjustments to improve the image's overall visual appeal, including subtle improvements to brightness, contrast, saturation, and sharpness. The goal is a natural, photorealistic enhancement.";
    await handleApplyAdjustment(autoEnhancePrompt);
  }, [handleApplyAdjustment]);

  const handleApplyFaceRetouch = useCallback(async (settings: { skinSmoothing: number; eyeBrightening: number; selectedFaces: Face[] }) => {
    if (!currentImage) {
      setError('No image loaded to apply retouching to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPreviewFilter('');
    
    try {
        const retouchedImageUrl = await generateRetouchedFace(currentImage, settings);
        await addImageToHistory(retouchedImageUrl);
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to apply face retouch. ${errorMessage}`);
        console.error("Caught error in handleApplyFaceRetouch:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyFaceSwap = useCallback(async (sourceImage: File, targetFace: Face, sourceFace: Face) => {
    if (!currentImage) {
      setError('No target image loaded to apply face swap to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPreviewFilter('');
    
    try {
        const swappedImageUrl = await generateFaceSwap(currentImage, sourceImage, targetFace, sourceFace);
        await addImageToHistory(swappedImageUrl);
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to apply face swap. ${errorMessage}`);
        console.error("Caught error in handleApplyFaceSwap:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyUpscale = useCallback(async (scale: number, detailIntensity: string) => {
    if (!currentImage || !imgRef.current) {
        setError('No image loaded to upscale.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewFilter('');

    try {
        const { naturalWidth, naturalHeight } = imgRef.current;
        
        // The AI will enhance details but might not change dimensions. The prompt guides it, but we'll enforce the final size.
        const enhancedImageUrl = await generateUpscaledImage(currentImage, scale, detailIntensity, naturalWidth, naturalHeight);

        // --- Client-side resizing to guarantee final dimensions ---
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = (err) => reject(new Error('Failed to load the AI-enhanced image for resizing.'));
            image.src = enhancedImageUrl;
        });

        const canvas = document.createElement('canvas');
        const targetWidth = naturalWidth * scale;
        const targetHeight = naturalHeight * scale;
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context for final resizing.');
        }
        
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

        const finalDataUrl = canvas.toDataURL('image/png'); // Using PNG to preserve quality after upscale.
        
        await addImageToHistory(finalDataUrl);

    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to upscale the image. ${errorMessage}`);
        console.error("Caught error in handleApplyUpscale:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyRestoration = useCallback(async () => {
    if (!currentImage) {
        setError('No image loaded to restore.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewFilter('');

    try {
        const restoredImageUrl = await generateRestoredImage(currentImage);
        await addImageToHistory(restoredImageUrl);
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to restore the image. ${errorMessage}`);
        console.error("Caught error in handleApplyRestoration:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyWatermark = useCallback(async (settings: WatermarkSettings) => {
    if (!currentImageUrl) {
        setError('No image loaded to apply a watermark to.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewFilter('');

    try {
        const image = new Image();
        
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = (err) => reject(err);
            image.src = currentImageUrl;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context.');
        }

        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        ctx.drawImage(image, 0, 0);

        // Set styles
        ctx.globalAlpha = settings.opacity;
        const margin = canvas.width * 0.02; // 2% margin

        // Draw watermark
        if (settings.type === 'text' && settings.text) {
            const fontSize = settings.fontSize * (canvas.width / 1000); // Scale font size relative to image width
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.fillStyle = settings.textColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';

            const textMetrics = ctx.measureText(settings.text);
            const textWidth = textMetrics.width;
            const textHeight = fontSize; // Approximate height

            let x = 0, y = 0;

            const pos = settings.position.split('-');
            if (pos[0] === 'top') y = margin + textHeight;
            else if (pos[0] === 'middle') y = canvas.height / 2 + textHeight / 2;
            else y = canvas.height - margin;

            if (pos[1] === 'left') x = margin;
            else if (pos[1] === 'center') x = (canvas.width - textWidth) / 2;
            else x = canvas.width - textWidth - margin;
            
            ctx.fillText(settings.text, x, y);

        } else if (settings.type === 'logo' && settings.logoFile) {
            const logo = new Image();
            const logoUrl = URL.createObjectURL(settings.logoFile);
            await new Promise<void>((resolve, reject) => {
                logo.onload = () => resolve();
                logo.onerror = (err) => reject(err);
                logo.src = logoUrl;
            });
            URL.revokeObjectURL(logoUrl);

            const logoWidth = canvas.width * (settings.logoSize / 100);
            const logoHeight = logo.height * (logoWidth / logo.width); // maintain aspect ratio

            let x = 0, y = 0;

            const pos = settings.position.split('-');
            if (pos[0] === 'top') y = margin;
            else if (pos[0] === 'middle') y = (canvas.height - logoHeight) / 2;
            else y = canvas.height - logoHeight - margin;

            if (pos[1] === 'left') x = margin;
            else if (pos[1] === 'center') x = (canvas.width - logoWidth) / 2;
            else x = canvas.width - logoWidth - margin;

            ctx.drawImage(logo, x, y, logoWidth, logoHeight);
        }
        
        const watermarkedDataUrl = canvas.toDataURL('image/png');
        await addImageToHistory(watermarkedDataUrl);

    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to apply watermark. ${errorMessage}`);
        console.error("Caught error in handleApplyWatermark:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImageUrl, addImageToHistory]);

  const handleRemoveBackground = useCallback(async () => {
    if (!currentImage) {
        setError('No image loaded to remove the background from.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewFilter('');

    try {
        const removedBgImageUrl = await generateRemovedBackground(currentImage);
        await addImageToHistory(removedBgImageUrl);
        setIsBgRemovalMode(true);
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to remove the background. ${errorMessage}`);
        console.error("Caught error in handleRemoveBackground:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyNewBackground = useCallback(async (settings: BackgroundSettings) => {
    if (!currentImageUrl) {
        setError('No image available to apply a background to.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewFilter('');

    let backgroundImageUrl: string | null = null;
    let isObjectURL = false;

    try {
        // --- ROBUST FOREGROUND PREPARATION ---
        const foreground = new Image();
        await new Promise<void>((resolve, reject) => {
            foreground.onload = () => resolve();
            foreground.onerror = (err) => reject(err);
            foreground.src = currentImageUrl; // This is the image from background removal
        });

        // Step 1: Create a clean foreground by keying out the background color if a solid one is detected.
        const fgCanvas = document.createElement('canvas');
        fgCanvas.width = foreground.naturalWidth;
        fgCanvas.height = foreground.naturalHeight;
        const fgCtx = fgCanvas.getContext('2d', { willReadFrequently: true }); // Optimization for frequent getImageData calls
        if (!fgCtx) {
            throw new Error('Could not create foreground canvas context.');
        }
        
        fgCtx.drawImage(foreground, 0, 0);
        
        // Check for and remove a solid background color (handles cases where AI returns a solid bg instead of transparency)
        const solidBgColor = getSolidBackgroundColor(fgCtx, fgCanvas.width, fgCanvas.height);

        if (solidBgColor) {
            console.log("Solid background color detected, keying it out:", solidBgColor);
            const imageData = fgCtx.getImageData(0, 0, fgCanvas.width, fgCanvas.height);
            const data = imageData.data;
            const tolerance = 25; 

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                if (
                    Math.abs(r - solidBgColor.r) < tolerance &&
                    Math.abs(g - solidBgColor.g) < tolerance &&
                    Math.abs(b - solidBgColor.b) < tolerance
                ) {
                    data[i + 3] = 0; // Make pixel transparent
                }
            }
            fgCtx.putImageData(imageData, 0, 0);
        } else {
             console.log("No solid background detected, assuming image has transparency.");
        }


        // --- COMPOSITING LOGIC ---
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = foreground.naturalWidth;
        finalCanvas.height = foreground.naturalHeight;
        const finalCtx = finalCanvas.getContext('2d');
        if (!finalCtx) {
            throw new Error('Could not get final canvas context.');
        }
        
        finalCtx.imageSmoothingQuality = 'high';

        // Step 2: Prepare and draw the new background layer.
        if (settings.type === 'color') {
            finalCtx.fillStyle = settings.value;
            finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        } else {
            // This 'else' block handles 'image', 'generate', and 'url'
            if (settings.type === 'generate') {
                backgroundImageUrl = await generateBackgroundImage(settings.value, finalCanvas.width, finalCanvas.height);
            } else if (settings.type === 'image') {
                backgroundImageUrl = URL.createObjectURL(settings.value);
                isObjectURL = true;
            } else { // url
                try {
                    // Note: This can fail due to CORS. Using a proxy or server-side fetch is more robust.
                    // For this client-side app, we'll try and provide a good error message.
                    const response = await fetch(settings.value);
                    if (!response.ok) throw new Error(`Failed to fetch image from URL (status: ${response.status})`);
                    const blob = await response.blob();
                    backgroundImageUrl = URL.createObjectURL(blob);
                    isObjectURL = true;
                } catch (fetchError) {
                    console.error("Error fetching image from URL:", fetchError);
                    throw new Error("Could not load the image from the provided URL. The server might be blocking the request (CORS policy). Please try a different URL or download the image and upload it directly.");
                }
            }

            if (!backgroundImageUrl) {
                throw new Error("Background image could not be loaded.");
            }

            const background = new Image();
            // Important for CORS-loaded images
            background.crossOrigin = "anonymous";
            await new Promise<void>((resolve, reject) => {
                background.onload = () => resolve();
                background.onerror = (err) => reject(err);
                background.src = backgroundImageUrl!;
            });

            // Draw background image to fill canvas (cover)
            const canvasAspect = finalCanvas.width / finalCanvas.height;
            const bgAspect = background.naturalWidth / background.naturalHeight;
            let sx = 0, sy = 0, sWidth = background.naturalWidth, sHeight = background.naturalHeight;

            if (bgAspect > canvasAspect) { // Background is wider, crop sides
                sWidth = background.naturalHeight * canvasAspect;
                sx = (background.naturalWidth - sWidth) / 2;
            } else { // Background is taller, crop top/bottom
                sHeight = background.naturalWidth / canvasAspect;
                sy = (background.naturalHeight - sHeight) / 2;
            }
            finalCtx.drawImage(background, sx, sy, sWidth, sHeight, 0, 0, finalCanvas.width, finalCanvas.height);
        }

        // Step 3: Draw the corrected foreground (`fgCanvas`) on top of the background.
        finalCtx.drawImage(fgCanvas, 0, 0);

        const finalDataUrl = finalCanvas.toDataURL('image/png');

        if (isObjectURL && backgroundImageUrl) {
            URL.revokeObjectURL(backgroundImageUrl);
        }

        await addImageToHistory(finalDataUrl);
        setIsBgRemovalMode(false);

    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to apply new background. ${errorMessage}`);
        console.error("Caught error in handleApplyNewBackground:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImageUrl, addImageToHistory]);


  const handleApplyAllOverlays = useCallback(async () => {
    if (!currentImageUrl || overlayLayers.length === 0) {
        setError('Please add at least one overlay layer to apply.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewFilter('');

    try {
        const baseImage = new Image();
        await new Promise<void>((resolve, reject) => {
            baseImage.onload = () => resolve();
            baseImage.onerror = (err) => reject(err);
            baseImage.src = currentImageUrl;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context.');
        }

        canvas.width = baseImage.naturalWidth;
        canvas.height = baseImage.naturalHeight;

        // 1. Draw base image
        ctx.drawImage(baseImage, 0, 0);

        // 2. Iterate and draw each visible overlay layer
        for (const layer of overlayLayers) {
            if (!layer.isVisible || !layer.overlayFile) continue;

            const overlayImage = new Image();
            // We use the previewUrl as it's an already created ObjectURL
            await new Promise<void>((resolve, reject) => {
                overlayImage.onload = () => resolve();
                overlayImage.onerror = (err) => reject(err);
                overlayImage.src = layer.previewUrl;
            });
            
            ctx.globalAlpha = layer.opacity;
            ctx.globalCompositeOperation = layer.blendMode === 'normal' ? 'source-over' : layer.blendMode;

            const overlayWidth = canvas.width * (layer.size / 100);
            const overlayHeight = overlayImage.height * (overlayWidth / overlayImage.width);

            const xPos = canvas.width * (layer.position.x / 100);
            const yPos = canvas.height * (layer.position.y / 100);

            ctx.drawImage(overlayImage, xPos, yPos, overlayWidth, overlayHeight);
        }
        
        // Reset canvas context properties
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0; 

        const finalDataUrl = canvas.toDataURL('image/png');
        await addImageToHistory(finalDataUrl);

    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to apply overlays. ${errorMessage}`);
        console.error("Caught error in handleApplyAllOverlays:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImageUrl, overlayLayers, addImageToHistory]);

  const handleApplyDoubleExposure = useCallback(async (settings: DoubleExposureSettings) => {
    if (!currentImage) {
      setError('No base image loaded to apply the effect to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPreviewFilter('');
    
    try {
        const newImageUrl = await generateDoubleExposure(currentImage, settings.overlayFile, settings.blendMode, settings.opacity);
        await addImageToHistory(newImageUrl);
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to apply double exposure. ${errorMessage}`);
        console.error("Caught error in handleApplyDoubleExposure:", err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleAddNewOverlay = (file: File) => {
      const newLayer: OverlayLayer = {
        id: Date.now(),
        name: file.name,
        overlayFile: file,
        previewUrl: URL.createObjectURL(file),
        opacity: 0.7,
        size: 50,
        position: { x: 25, y: 25 },
        isVisible: true,
        blendMode: 'normal',
      };
      setOverlayLayers(prev => [...prev, newLayer]);
      setActiveOverlayId(newLayer.id);
  };

  const handleUpdateOverlay = (id: number, newSettings: Partial<OverlayLayer>) => {
      setOverlayLayers(prev => 
          prev.map(layer => layer.id === id ? { ...layer, ...newSettings } : layer)
      );
  };
  
  const handleDeleteOverlay = (id: number) => {
      const layerToDelete = overlayLayers.find(l => l.id === id);
      if (layerToDelete) {
          URL.revokeObjectURL(layerToDelete.previewUrl); // Clean up memory
      }
      setOverlayLayers(prev => prev.filter(layer => layer.id !== id));
      if (activeOverlayId === id) {
          setActiveOverlayId(null);
      }
  };

  const handleSelectOverlay = (id: number) => {
      setActiveOverlayId(id);
  };
  
  const handleToggleOverlayVisibility = (id: number) => {
      setOverlayLayers(prev => 
          prev.map(layer => 
              layer.id === id ? { ...layer, isVisible: !layer.isVisible } : layer
          )
      );
  };

  const handleReorderOverlays = (newLayers: OverlayLayer[]) => {
      setOverlayLayers(newLayers);
  };

  const handleApplyCropAndRotate = useCallback(async () => {
    const image = imgRef.current;
    if (!image) {
        setError('Image reference is not available.');
        return;
    }

    const cropToUse = (completedCrop?.width && completedCrop.height) 
      ? completedCrop 
      : {
          x: 0,
          y: 0,
          width: image.width, // Use client width as the base for the full image
          height: image.height,
          unit: 'px'
        } as PixelCrop;


    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        setError('Could not process the crop.');
        return;
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(cropToUse.width * scaleX * pixelRatio);
    canvas.height = Math.floor(cropToUse.height * scaleY * pixelRatio);

    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = 'high';

    const cropX = cropToUse.x * scaleX;
    const cropY = cropToUse.y * scaleY;

    const rotateRads = (rotation * Math.PI) / 180;
    const centerX = image.naturalWidth / 2;
    const centerY = image.naturalHeight / 2;

    ctx.save();
    
    // 1. Move the crop origin to the canvas origin (0,0)
    ctx.translate(-cropX, -cropY);
    // 2. Move the origin to the center of the original image
    ctx.translate(centerX, centerY);
    // 3. Rotate around the image's center
    ctx.rotate(rotateRads);
    // 4. Move the image's center back to the origin
    ctx.translate(-centerX, -centerY);
    
    // 5. Draw the rotated image
    ctx.drawImage(
      image,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight
    );

    ctx.restore();
    
    const resultDataUrl = canvas.toDataURL('image/png');
    await addImageToHistory(resultDataUrl);

  }, [completedCrop, addImageToHistory, rotation]);

  const handleAutoRotate = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to rotate.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewFilter('');
    
    try {
      const rotatedImageUrl = await generateCorrectedOrientation(currentImage);
      await addImageToHistory(rotatedImageUrl);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(`Failed to auto-rotate the image. ${errorMessage}`);
      console.error("Caught error in handleAutoRotate:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleRotateImage = useCallback(async (direction: 'clockwise' | 'counter-clockwise') => {
    if (!currentImage) {
      setError('No image loaded to rotate.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewFilter('');
    
    try {
      const rotatedImageUrl = await generateRotatedImage(currentImage, direction);
      await addImageToHistory(rotatedImageUrl);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(`Failed to rotate the image. ${errorMessage}`);
      console.error("Caught error in handleRotateImage:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyZoom = useCallback(async (zoomLevel: number, detailIntensity: string) => {
    if (!editHotspot || !imgRef.current) {
        setError('Please click on the image to select a center point for the zoom.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewFilter('');

    try {
        const image = imgRef.current;
        const canvas = document.createElement('canvas');
        const { naturalWidth, naturalHeight } = image;
        
        // Calculate the source crop area based on the hotspot (center) and zoom level
        const sourceCropWidth = Math.round(naturalWidth / zoomLevel);
        const sourceCropHeight = Math.round(naturalHeight / zoomLevel);

        // Center the crop on the hotspot, but ensure it stays within image bounds
        let sourceCropX = Math.round(editHotspot.x - sourceCropWidth / 2);
        let sourceCropY = Math.round(editHotspot.y - sourceCropHeight / 2);

        sourceCropX = Math.max(0, Math.min(naturalWidth - sourceCropWidth, sourceCropX));
        sourceCropY = Math.max(0, Math.min(naturalHeight - sourceCropHeight, sourceCropY));

        canvas.width = sourceCropWidth;
        canvas.height = sourceCropHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context for cropping.');

        ctx.drawImage(
            image,
            sourceCropX,
            sourceCropY,
            sourceCropWidth,
            sourceCropHeight,
            0,
            0,
            sourceCropWidth,
            sourceCropHeight
        );

        const croppedBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!croppedBlob) throw new Error('Failed to create blob from cropped canvas.');

        const croppedFile = new File([croppedBlob], 'zoom-source.png', { type: 'image/png' });

        const targetWidth = naturalWidth;
        const targetHeight = naturalHeight;

        const zoomedImageUrl = await generateZoomedImage(croppedFile, targetWidth, targetHeight, detailIntensity);

        await addImageToHistory(zoomedImageUrl);

    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to apply AI Zoom. ${errorMessage}`);
        console.error("Caught error in handleApplyZoom:", err);
    } finally {
        setIsLoading(false);
    }
  }, [editHotspot, addImageToHistory]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
      setShowSuggestions(false);
      setPrompt('');
      setEditHotspot(null);
      setDisplayHotspot(null);
      setIsBgRemovalMode(false);
      setOverlayLayers([]);
      setActiveOverlayId(null);
      setMaskDataUrl(null);
      setRotation(0);
      setPreviewFilter('');
      resetViewTransform();
    }
  }, [canUndo, historyIndex, resetViewTransform]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      setShowSuggestions(false);
      setPrompt('');
      setEditHotspot(null);
      setDisplayHotspot(null);
      setIsBgRemovalMode(false);
      setOverlayLayers([]);
      setActiveOverlayId(null);
      setMaskDataUrl(null);
      setRotation(0);
      setPreviewFilter('');
      resetViewTransform();
    }
  }, [canRedo, historyIndex, resetViewTransform]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      setShowSuggestions(false);
      setError(null);
      setPrompt('');
      setEditHotspot(null);
      setDisplayHotspot(null);
      setIsBgRemovalMode(false);
      setOverlayLayers([]);
      setActiveOverlayId(null);
      setMaskDataUrl(null);
      setRotation(0);
      setPreviewFilter('');
      resetViewTransform();
    }
  }, [history, resetViewTransform]);

    const handleHistorySelect = useCallback((index: number) => {
        if (index >= 0 && index < history.length) {
            setHistoryIndex(index);
            setShowSuggestions(false);
            setPrompt('');
            setEditHotspot(null);
            setDisplayHotspot(null);
            setIsBgRemovalMode(false);
            setOverlayLayers([]);
            setActiveOverlayId(null);
            setCrop(undefined);
            setCompletedCrop(undefined);
            setMaskDataUrl(null);
            setRotation(0);
            setPreviewFilter('');
            resetViewTransform();
        }
    }, [history.length, resetViewTransform]);

  const handleUploadNew = useCallback(async () => {
      localStorage.removeItem('utilpic-session');
      await clearHistoryDB();
      setHistory([]);
      setHistoryIndex(-1);
      setError(null);
      setPrompt('');
      setShowSuggestions(false);
      setSuggestions([]);
      setEditHotspot(null);
      setDisplayHotspot(null);
      setIsBgRemovalMode(false);
      setOverlayLayers([]);
      setActiveOverlayId(null);
      setMaskDataUrl(null);
      setRotation(0);
      setPreviewFilter('');
      resetViewTransform();
  }, [resetViewTransform]);

  const handleDownload = useCallback(() => {
    if (currentImage) {
      setIsDownloadModalOpen(true);
    }
  }, [currentImage]);
  
  const handleConfirmDownload = useCallback(async (settings: DownloadSettings) => {
    if (!currentImageUrl) return;

    setIsLoading(true);
    try {
        const image = new Image();
        
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = (err) => reject(err);
            image.src = currentImageUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error("Could not create canvas context for download.");
        };
        ctx.drawImage(image, 0, 0);
        
        const quality = (settings.format === 'jpeg' || settings.format === 'webp') ? settings.quality / 100 : undefined;
        const mimeType = `image/${settings.format}`;
        
        const dataUrl = canvas.toDataURL(mimeType, quality);
        
        const link = document.createElement('a');
        link.href = dataUrl;
        
        const fileExtension = settings.format;
        const baseName = `utilpic-edit-${historyIndex}`;
        link.download = `${baseName}-utilpic-edited.${fileExtension}`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(`Failed to process image for download. ${errorMessage}`);
    } finally {
        setIsLoading(false);
        setIsDownloadModalOpen(false);
    }
  }, [currentImageUrl, historyIndex]);
  
  const handleFileSelect = (files: FileList | null) => {
    if (files && files[0]) {
      handleImageUpload(files[0]);
    }
  };

  const getCoordsFromEvent = useCallback((e: React.PointerEvent) => {
    const img = imgRef.current;
    if (!img) return null;

    const rect = img.getBoundingClientRect();
    
    // Check if click is strictly inside the visible image
    if (
        e.clientX < rect.left || 
        e.clientX > rect.right || 
        e.clientY < rect.top || 
        e.clientY > rect.bottom
    ) {
        return null;
    }

    // Normalized coordinates (0 to 1) based on the visual bounding box
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;

    // Natural coordinates (for API usage)
    const originalX = Math.round(normX * img.naturalWidth);
    const originalY = Math.round(normY * img.naturalHeight);

    // Display coordinates (for marker placement)
    // The red marker is placed inside the transformed container relative to the image's layout position.
    // We calculate the position relative to the image element's offset within that container.
    // Note: This assumes the marker is absolute positioned inside the same container as the img.
    // `img.offsetLeft` gives the x-offset of the image from the container's left edge (handling centering).
    // `img.offsetWidth` gives the width of the rendered image element (handling scaling/containment).
    
    return {
        display: { 
            x: img.offsetLeft + normX * img.offsetWidth, 
            y: img.offsetTop + normY * img.offsetHeight 
        },
        edit: { x: originalX, y: originalY },
    };
}, []);

  const handleImageClick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isZoomPanEnabled) return;
    
    const coords = getCoordsFromEvent(e);
    if (!coords) return;

    // Allow setting hotspot in both 'retouch' and 'adjust' tabs if not in a sub-mode like color picking or masking.
    if ((activeTab === 'retouch' || activeTab === 'adjust' || activeTab === 'zoom') && !maskDataUrl && !activeColorPicker) {
        setDisplayHotspot(coords.display);
        setEditHotspot(coords.edit);
        return;
    }

    if (activeColorPicker) {
        const img = imgRef.current;
        if (!img) return;

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setError('Could not process image for color picking.');
            return;
        }
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
        const pixelData = ctx.getImageData(coords.edit.x, coords.edit.y, 1, 1).data;
        const [r, g, b] = pixelData;
        
        let prompt = '';
        switch (activeColorPicker) {
            case 'white':
                prompt = `Perform a precise levels and white balance correction on the entire image. A color that should be pure white is currently showing as RGB(${r}, ${g}, ${b}). Adjust the overall color cast and highlights to make this color pure white (255, 255, 255) while maintaining natural tones elsewhere.`;
                break;
            case 'black':
                prompt = `Perform a precise levels adjustment on the entire image. A color that should be pure black is currently showing as RGB(${r}, ${g}, ${b}). Adjust the overall shadows to make this color pure black (0, 0, 0) without crushing details in other areas.`;
                break;
            case 'gray':
            default:
                prompt = `Perform a precise white balance correction on the entire image. A color that should be neutral gray is currently showing as RGB(${r}, ${g}, ${b}). Adjust the overall color cast of the image to make this color a neutral gray, ensuring the correction is applied naturally across all tones.`;
                break;
        }
        
        handleApplyAdjustment(prompt);
        setActiveColorPicker(null); // Turn off picking mode after selection
    }
};

  const handleRestoreSession = async () => {
    if (sessionToRestore) {
        setIsLoading(true);
        setError(null);
        try {
            const historyImages = await getAllHistoryImagesDB(sessionToRestore.historyLength);
            if (historyImages.length !== sessionToRestore.historyLength) {
                throw new Error("Mismatch between session metadata and stored images. Session may be corrupt.");
            }
            setHistory(historyImages);
            setHistoryIndex(sessionToRestore.historyIndex);
            if (sessionToRestore.activeTab) {
                setActiveTab(sessionToRestore.activeTab);
            }
            if (sessionToRestore.prompt) {
                setPrompt(sessionToRestore.prompt);
            }
        } catch (e) {
            const errorMessage = getErrorMessage(e);
            console.error("Failed to restore session files from IndexedDB:", e);
            setError(`Could not restore session. The saved data might be corrupted. ${errorMessage} Starting a new session.`);
            localStorage.removeItem('utilpic-session');
            await clearHistoryDB();
            setHistory([]);
            setHistoryIndex(-1);
        } finally {
            setSessionToRestore(null);
            setIsLoading(false);
        }
    }
  };

  const handleStartNewSession = async () => {
      localStorage.removeItem('utilpic-session');
      await clearHistoryDB();
      setSessionToRestore(null);
      setHistory([]);
      setHistoryIndex(-1);
  };
  
  const handleApplySuggestion = (tab: Tab) => {
    setActiveTab(tab);
    setShowSuggestions(false);
  };

  const handleApplyMask = useCallback(async (newMaskDataUrl: string, autoPrompt?: string) => {
    setMaskDataUrl(newMaskDataUrl);
    
    if (autoPrompt) {
        // If the mask editor provided a generated prompt, apply it immediately.
        // We need to wait for state updates, so we'll call generate directly with the new mask data
        // instead of relying on state (which might be stale in this callback scope)
        setIsLoading(true);
        setError(null);
        setPreviewFilter('');
        try {
            let maskFile: File | undefined = undefined;
            if (imgRef.current) {
                maskFile = await createBlackAndWhiteMask(newMaskDataUrl, imgRef.current.naturalWidth, imgRef.current.naturalHeight);
            }
            
            // We use the current image file memoized in the component scope
            if (currentImage) {
                const editedImageUrl = await generateEditedImage(currentImage, autoPrompt, null, maskFile);
                await addImageToHistory(editedImageUrl);
                // Clear mask after successful generation
                setMaskDataUrl(null); 
            }
        } catch (err) {
             const errorMessage = getErrorMessage(err);
            setError(`Failed to apply local adjustments. ${errorMessage}`);
        } finally {
            setIsLoading(false);
            setActiveTab('retouch'); // Return to main view
        }
    } else {
        // Standard manual flow
        setActiveTab('retouch');
    }
  }, [addImageToHistory, currentImage]);

  const handleOpenBatchPresetModal = useCallback((prompt: string, name:string, type: 'filter' | 'colorGrade' | 'adjustment') => {
    setBatchPresetInfo({ prompt, name, type });
    setIsBatchPresetModalOpen(true);
  }, []);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setImageAspectRatio(naturalWidth / naturalHeight);
    resetViewTransform();
  };
  
  // --- Zoom & Pan & Splitter Handlers ---
  const zoomAtPoint = useCallback((scale: number, pointX: number, pointY: number) => {
    const container = imageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    // Convert viewport coordinates to container-relative coordinates.
    const containerRelativeX = pointX - rect.left;
    const containerRelativeY = pointY - rect.top;
    
    // Calculate where the zoom point is on the un-transformed content.
    const pointOnContentX = (containerRelativeX - viewTransform.pan.x) / viewTransform.scale;
    const pointOnContentY = (containerRelativeY - viewTransform.pan.y) / viewTransform.scale;

    // Calculate the new pan to keep the zoom point under the cursor.
    const newPanX = containerRelativeX - pointOnContentX * scale;
    const newPanY = containerRelativeY - pointOnContentY * scale;

    setViewTransform({ scale, pan: { x: newPanX, y: newPanY } });
  }, [viewTransform.pan, viewTransform.scale]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!isZoomPanEnabled) return;

    const container = imageContainerRef.current;
    const img = imgRef.current;
    // The image must be loaded to get natural dimensions
    if (!container || !img || !img.naturalWidth) return;

    // --- Check if cursor is over the actual image, not the container's empty space, ONLY when not zoomed ---
    if (viewTransform.scale <= 1) {
        const containerRect = container.getBoundingClientRect();
        const cursorX = e.clientX - containerRect.left;
        const cursorY = e.clientY - containerRect.top;

        const { clientWidth: containerWidth, clientHeight: containerHeight } = container;
        
        const imageAspectRatioVal = img.naturalWidth / img.naturalHeight;
        const containerAspectRatio = containerWidth / containerHeight;

        let renderedImgWidth, renderedImgHeight;
        if (imageAspectRatioVal > containerAspectRatio) {
            renderedImgWidth = containerWidth;
            renderedImgHeight = containerWidth / imageAspectRatioVal;
        } else {
            renderedImgHeight = containerHeight;
            renderedImgWidth = containerHeight * imageAspectRatioVal;
        }

        const imgLeft = (containerWidth - renderedImgWidth) / 2;
        const imgTop = (containerHeight - renderedImgHeight) / 2;
        const imgRight = imgLeft + renderedImgWidth;
        const imgBottom = imgTop + renderedImgHeight;

        if (cursorX < imgLeft || cursorX > imgRight || cursorY < imgTop || cursorY > imgBottom) {
            return; // Don't zoom, allow page scroll
        }
    }
    // --- End Check ---
    
    const { deltaY } = e;

    // If we are at base zoom and trying to zoom out (scroll down),
    // let the browser handle it (i.e., scroll the page).
    if (viewTransform.scale <= 1 && deltaY > 0) {
        return;
    }
    
    e.preventDefault(); // Prevent page scroll because we are zooming
    const rect = container.getBoundingClientRect();
    
    // Determine zoom center: hotspot or mouse cursor
    let zoomCenterX = e.clientX;
    let zoomCenterY = e.clientY;

    if ((activeTab === 'retouch' || activeTab === 'adjust' || activeTab === 'zoom') && displayHotspot) {
        zoomCenterX = displayHotspot.x + rect.left;
        zoomCenterY = displayHotspot.y + rect.top;
    }

    const scaleFactor = 1.1;
    const newScaleValue = deltaY < 0 ? viewTransform.scale * scaleFactor : viewTransform.scale / scaleFactor;
    const newScale = Math.max(1, Math.min(newScaleValue, 8));

    zoomAtPoint(newScale, zoomCenterX, zoomCenterY);
  }, [isZoomPanEnabled, activeTab, displayHotspot, viewTransform.scale, zoomAtPoint]);
  
  const handleHotspotPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation(); // Prevent image panning when dragging the hotspot
    setIsDraggingHotspot(true);
  };
  
  const handleSplitterPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation(); // prevent image panning
    isDraggingSplitter.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !isZoomPanEnabled) return;
    setIsDragging(false); 
    if (viewTransform.scale > 1) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - viewTransform.pan.x,
        y: e.clientY - viewTransform.pan.y,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDraggingSplitter.current) {
        const container = imageContainerRef.current;
        if (container) {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const newPosition = (x / rect.width) * 100;
            setSplitPosition(Math.max(0, Math.min(100, newPosition)));
        }
        return; // Prevent other move logic
    }
    if (isDraggingHotspot) {
        const coords = getCoordsFromEvent(e);
        if (coords) {
            setDisplayHotspot(coords.display);
            setEditHotspot(coords.edit);
        }
    } else if (isPanning) {
      if (!isDragging) setIsDragging(true);
      setViewTransform(prev => ({
        ...prev,
        pan: {
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        }
      }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSplitter.current) {
        isDraggingSplitter.current = false;
        if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }
        return;
    }
    if (isDraggingHotspot) {
        setIsDraggingHotspot(false);
        return; // Don't trigger a new click
    }
    
    if (isPanning && !isDragging) {
      handleImageClick(e);
    } else if (!isPanning) {
      handleImageClick(e);
    }
    setIsPanning(false);
    setIsDragging(false);
  };

  const handleZoomIn = useCallback(() => {
    const container = imageContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const newScale = Math.min(viewTransform.scale * 1.25, 8);
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    zoomAtPoint(newScale, centerX, centerY);
  }, [viewTransform.scale, zoomAtPoint]);

  const handleZoomOut = useCallback(() => {
    const container = imageContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const newScale = Math.max(viewTransform.scale / 1.25, 1);
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    zoomAtPoint(newScale, centerX, centerY);
  }, [viewTransform.scale, zoomAtPoint]);

  const handleSetActivePicker = (picker: ColorPickerType | null) => {
      setActiveColorPicker(current => (current === picker ? null : picker));
  };
  
  if (isLoadingSession) {
    return (
        <div className="min-h-screen text-gray-100 flex flex-col items-center justify-center">
             <Spinner />
        </div>
    );
  }

    // ReactCrop setup for crop image display
    const cropImageElement = (
      <img 
        ref={imgRef}
        key={`crop-${currentImageUrl}`}
        src={currentImageUrl || ''} 
        onLoad={onImageLoad}
        alt="Crop this image"
        className="w-full h-auto object-contain max-h-full rounded-xl"
        style={{ transform: `rotate(${rotation}deg)` }}
        loading="lazy"
      />
    );


  return (
      <div className="flex h-screen w-full bg-[#090A0F] text-white overflow-hidden font-sans">
        {/* Navigation Rail (Desktop) / Bottom Nav is implicit by design in mobile via CSS order but we use sidebar layout */}
        <div className="flex flex-col lg:flex-row w-full h-full">
            
            {/* Sidebar Navigation */}
            <nav className="flex-shrink-0 flex flex-row lg:flex-col gap-2 bg-gray-900 border-r border-gray-800 p-2 overflow-x-auto lg:overflow-y-auto lg:w-20 custom-scrollbar z-20 items-center lg:items-center">
                 {/* Logo Area */}
                <div className="hidden lg:flex flex-col items-center justify-center mb-4 p-2">
                     <SparklesIcon className="w-8 h-8 text-blue-500"/>
                </div>

                {tools.map(tool => (
                    <button
                        key={tool.id}
                        onClick={() => setActiveTab(tool.id)}
                        className={`flex-shrink-0 flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-xl transition-all duration-200 ease-out group relative ${
                            activeTab === tool.id
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                        title={tool.label}
                    >
                        <tool.icon className={`w-6 h-6 transition-all duration-300 ${activeTab === tool.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                        <span className="text-[9px] uppercase tracking-wider font-semibold">{tool.label}</span>
                    </button>
                ))}
            </nav>

            {/* Main Content Area: Image + Toolbar */}
            <div className="flex-grow flex flex-col min-w-0 bg-black/40 relative">
                {/* Header / Top Bar */}
                <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/50 backdrop-blur-md z-10">
                    <div className="flex items-center gap-2 lg:hidden">
                        <SparklesIcon className="w-6 h-6 text-blue-500"/>
                        <span className="font-bold">UtilPic</span>
                    </div>
                     {/* History / Actions */}
                     <div className="flex items-center gap-2 ml-auto">
                        <button onClick={handleUndo} disabled={!canUndo} className="p-2 text-gray-400 hover:text-white disabled:opacity-30"><UndoIcon className="w-5 h-5"/></button>
                        <button onClick={handleRedo} disabled={!canRedo} className="p-2 text-gray-400 hover:text-white disabled:opacity-30"><RedoIcon className="w-5 h-5"/></button>
                        <div className="h-6 w-px bg-gray-700 mx-2"></div>
                        <button onClick={() => setIsHistoryPanelOpen(true)} className="p-2 text-gray-400 hover:text-white"><HistoryIcon className="w-5 h-5"/></button>
                        <button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold ml-2 shadow-lg shadow-blue-500/20">Download</button>
                     </div>
                </header>

                {/* Image Workspace */}
                <div className="flex-grow relative overflow-hidden flex items-center justify-center">
                    {/* Error Display */}
                    {error && (
                         <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-xl backdrop-blur-md max-w-md text-center">
                            <p>{error}</p>
                            <button onClick={() => setError(null)} className="text-xs underline mt-1">Dismiss</button>
                        </div>
                    )}
                    
                    {!currentImageUrl ? (
                        <StartScreen onFileSelect={handleFileSelect} />
                    ) : (
                       <div 
                        ref={imageContainerRef}
                        className="w-full h-full relative"
                        style={{ cursor: isSplitView ? 'default' : cursorStyle }}
                        onWheel={handleWheel}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                       >
                            {isLoading && (
                                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                                    <Spinner />
                                    <p className="text-gray-300 mt-4 animate-pulse">Processing...</p>
                                </div>
                            )}

                            {activeTab === 'crop' ? (
                                <div className="w-full h-full flex items-center justify-center p-8 overflow-auto">
                                    <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)} aspect={aspect}>
                                        {cropImageElement}
                                    </ReactCrop>
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center overflow-hidden relative">
                                    <div 
                                        className="relative transition-transform duration-100 ease-out origin-center"
                                        style={{ 
                                            transform: `translate(${viewTransform.pan.x}px, ${viewTransform.pan.y}px) scale(${viewTransform.scale})`,
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        {/* Base Images */}
                                        {isSplitView ? (
                                            <div className="relative w-full h-full max-w-full max-h-full flex items-center justify-center">
                                                 <img 
                                                    ref={imgRef}
                                                    src={currentImageUrl} 
                                                    alt="Current" 
                                                    className="max-w-full max-h-full object-contain absolute"
                                                    style={{ filter: previewFilter }}
                                                 />
                                                 <div className="absolute inset-0 w-full h-full flex items-center justify-center" style={{ clipPath: `inset(0 ${100 - splitPosition}% 0 0)` }}>
                                                     <img src={originalImageUrl!} alt="Original" className="max-w-full max-h-full object-contain" />
                                                 </div>
                                                  {/* Splitter Handle */}
                                                  <div
                                                    className="absolute top-0 bottom-0 w-1 bg-white/75 cursor-ew-resize z-10"
                                                    style={{ left: `${splitPosition}%` }}
                                                    onPointerDown={handleSplitterPointerDown}
                                                >
                                                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                                                        <SplitScreenIcon className="w-4 h-4 rotate-90" />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Original (for comparison) */}
                                                {originalImageUrl && (
                                                     <img 
                                                        src={originalImageUrl} 
                                                        alt="Original" 
                                                        className="max-w-full max-h-full object-contain absolute pointer-events-none opacity-0" 
                                                     />
                                                )}
                                                {/* Current Image */}
                                                 <img
                                                    ref={imgRef}
                                                    src={currentImageUrl}
                                                    alt="Current"
                                                    onLoad={onImageLoad}
                                                    className={`max-w-full max-h-full object-contain transition-opacity duration-200 ${isComparing ? 'opacity-0' : 'opacity-100'}`}
                                                    style={{ filter: previewFilter }}
                                                 />
                                                 {/* Mask Overlay */}
                                                 {maskDataUrl && <img src={maskDataUrl} className="max-w-full max-h-full object-contain absolute pointer-events-none" alt="Mask"/>}
                                            </>
                                        )}
                                        
                                        {/* Overlays */}
                                        {activeTab === 'overlay' && !isSplitView && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="relative w-full h-full flex items-center justify-center">
                                                    {overlayLayers.map(layer => layer.isVisible && (
                                                         <img
                                                            key={layer.id}
                                                            src={layer.previewUrl}
                                                            style={{
                                                                position: 'absolute',
                                                                left: `${layer.position.x}%`,
                                                                top: `${layer.position.y}%`,
                                                                width: `${layer.size}%`,
                                                                opacity: layer.opacity,
                                                                mixBlendMode: layer.blendMode,
                                                            }}
                                                            alt="Overlay"
                                                         />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                         {/* Hotspot Indicator */}
                                        {!isSplitView && displayHotspot && !isLoading && (activeTab === 'retouch' || activeTab === 'adjust' || activeTab === 'zoom') && !maskDataUrl && (
                                            <div 
                                                className="absolute z-10 animate-hotspot-appear"
                                                style={{ 
                                                    left: displayHotspot.x, 
                                                    top: displayHotspot.y,
                                                    transform: 'translate(-50%, -50%)',
                                                    cursor: isDraggingHotspot ? 'grabbing' : 'grab',
                                                }}
                                                onPointerDown={handleHotspotPointerDown}
                                            >
                                                <div className="w-8 h-8 rounded-full border-2 border-white shadow-[0_0_10px_rgba(0,0,0,0.5)] bg-blue-500/30"></div>
                                                <div className="w-1 h-1 bg-white rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                             {/* Bottom Controls */}
                             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-full px-4 py-2 border border-white/10">
                                <button onMouseDown={() => setIsComparing(true)} onMouseUp={() => setIsComparing(false)} onMouseLeave={() => setIsComparing(false)} onTouchStart={() => setIsComparing(true)} onTouchEnd={() => setIsComparing(false)} className="p-2 hover:bg-white/10 rounded-full transition"><EyeIcon className="w-5 h-5 text-gray-300" /></button>
                                <div className="w-px h-4 bg-gray-500"></div>
                                <button onClick={() => setIsSplitView(!isSplitView)} className={`p-2 rounded-full transition ${isSplitView ? 'text-blue-400 bg-white/10' : 'text-gray-300 hover:bg-white/10'}`}><SplitScreenIcon className="w-5 h-5" /></button>
                             </div>
                             
                             {/* View Controls */}
                             {isZoomPanEnabled && (
                                <ViewControls 
                                    zoom={viewTransform.scale} 
                                    onZoomIn={handleZoomIn}
                                    onZoomOut={handleZoomOut}
                                    onResetView={resetViewTransform}
                                />
                             )}
                       </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Tools */}
            <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col h-[45vh] lg:h-full bg-gray-900 border-l border-gray-800 z-30">
                <div className="flex-grow overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6">
                     {/* Suggestion Panel */}
                     {showSuggestions && suggestions.length > 0 && (
                        <SuggestionPanel
                            suggestions={suggestions}
                            onApplySuggestion={handleApplySuggestion}
                            onDismiss={() => setShowSuggestions(false)}
                        />
                    )}

                    {/* Active Tool Content */}
                    <div className="animate-fade-in">
                        {activeTab === 'retouch' && (
                             <div className="space-y-4">
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-gray-200">Magic Retouch</h3>
                                    <p className="text-sm text-gray-400">Select an area and describe your change.</p>
                                </div>
                                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder={maskDataUrl ? "Describe how to change the masked area..." : "Click a point on the image and describe what to change..."}
                                        className="w-full bg-gray-900 border border-gray-600 text-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition min-h-[100px] text-sm resize-none"
                                        disabled={isLoading}
                                    />
                                    <div className="flex gap-2 mt-3">
                                        {maskDataUrl && (
                                            <button onClick={() => setMaskDataUrl(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded-md transition text-sm">
                                                Clear Mask
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleGenerate()}
                                            disabled={isLoading || !prompt.trim() || (!editHotspot && !maskDataUrl)}
                                            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-2 rounded-md shadow-lg hover:shadow-blue-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Generate
                                        </button>
                                    </div>
                                </div>
                             </div>
                        )}
                        {activeTab === 'mask' && (
                            <div className="text-center p-8 bg-gray-800/50 rounded-lg border border-gray-700">
                                <p className="text-gray-300 mb-4">Launch the advanced Mask Editor to create precise selections and apply local adjustments.</p>
                                <button 
                                    onClick={() => {/* Mask Editor is handled by modal, but we can trigger it here if needed or just use the Nav button logic to open a modal state */}} 
                                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:bg-blue-500"
                                >
                                    Open Mask Editor
                                </button>
                                {/* Note: Mask Editor is a full screen modal triggered by state. We render it conditionally below. */}
                            </div>
                        )}
                        {activeTab === 'adjust' && (
                             <AdjustmentPanel 
                                onApplyAdjustment={handleApplyAdjustment} 
                                onApplyAutoEnhance={handleApplyAutoEnhance}
                                onApplySharpen={handleApplySharpen}
                                onApplyGrain={handleApplyGrain}
                                isLoading={isLoading} 
                                onSetActivePicker={handleSetActivePicker}
                                activePicker={activeColorPicker}
                                onApplyLocalAdjustment={handleApplyLocalAdjustment}
                                isAreaSelected={!!editHotspot || !!maskDataUrl}
                                onApplyStyleFromUrl={handleApplyStyleFromUrl}
                                onBatchApply={(prompt, name) => handleOpenBatchPresetModal(prompt, name, 'adjustment')}
                                onPreviewChange={setPreviewFilter}
                            />
                        )}
                        {activeTab === 'filters' && (
                            <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} onBatchApply={(prompt, name) => handleOpenBatchPresetModal(prompt, name, 'filter')} />
                        )}
                        {activeTab === 'colorGrade' && (
                            <ColorGradePanel onApplyColorGrade={handleApplyColorGrade} isLoading={isLoading} onBatchApply={(prompt, name) => handleOpenBatchPresetModal(prompt, name, 'colorGrade')} />
                        )}
                         {activeTab === 'face' && (
                            <FaceRetouchPanel 
                                onApplyRetouch={handleApplyFaceRetouch} 
                                isLoading={isLoading}
                                currentImage={currentImage}
                                onFacesDetected={setDetectedFaces}
                                onFaceSelectionChange={setSelectedFaces}
                            />
                        )}
                        {activeTab === 'faceSwap' && (
                            <FaceSwapPanel 
                                onApplyFaceSwap={handleApplyFaceSwap} 
                                isLoading={isLoading}
                                targetImage={currentImage}
                            />
                        )}
                        {activeTab === 'crop' && (
                            <CropPanel 
                                onApply={handleApplyCropAndRotate} 
                                onSetAspect={setAspect} 
                                isLoading={isLoading} 
                                canApply={(!!completedCrop?.width && completedCrop.width > 0) || rotation !== 0}
                                onAutoRotate={handleAutoRotate} 
                                onRotateImage={handleRotateImage}
                                rotation={rotation}
                                onRotationChange={setRotation}
                            />
                        )}
                         {activeTab === 'background' && (
                             <BackgroundPanel onRemoveBackground={handleRemoveBackground} onApplyNewBackground={handleApplyNewBackground} isLoading={isLoading} isBgRemovalMode={isBgRemovalMode} />
                        )}
                        {activeTab === 'overlay' && (
                            <OverlayPanel 
                                layers={overlayLayers}
                                activeLayerId={activeOverlayId}
                                onAddLayer={handleAddNewOverlay}
                                onDeleteLayer={handleDeleteOverlay}
                                onUpdateLayer={handleUpdateOverlay}
                                onSelectLayer={handleSelectOverlay}
                                onToggleVisibility={handleToggleOverlayVisibility}
                                onReorderLayers={handleReorderOverlays}
                                onApplyAll={handleApplyAllOverlays}
                                isLoading={isLoading} 
                            />
                        )}
                        {activeTab === 'doubleExposure' && (
                             <DoubleExposurePanel onApply={handleApplyDoubleExposure} isLoading={isLoading} />
                        )}
                        {activeTab === 'upscale' && (
                            <UpscalePanel onApplyUpscale={handleApplyUpscale} isLoading={isLoading} />
                        )}
                        {activeTab === 'zoom' && (
                             <ZoomPanel
                                onApplyZoom={handleApplyZoom}
                                isLoading={isLoading}
                                isAreaSelected={!!editHotspot}
                                editHotspot={editHotspot}
                                imageRef={imgRef}
                            />
                        )}
                        {activeTab === 'restore' && (
                             <RestorePanel onApplyRestore={handleApplyRestoration} isLoading={isLoading} />
                        )}
                        {activeTab === 'watermark' && (
                             <WatermarkPanel onApplyWatermark={handleApplyWatermark} isLoading={isLoading} />
                        )}
                    </div>
                </div>
                
                {/* Sidebar Footer */}
                <div className="p-4 bg-gray-800/50 border-t border-gray-700">
                     <button 
                        onClick={() => setIsBatchEditModalOpen(true)}
                        disabled={!canUndo}
                        className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 py-3 rounded-lg transition text-sm font-medium border border-gray-700 disabled:opacity-50 mb-3"
                    >
                        <DocumentDuplicateIcon className="w-4 h-4" /> Batch Edit History Style
                    </button>
                    <div className="flex gap-2">
                        <button onClick={handleReset} className="flex-1 py-2 text-sm text-gray-400 hover:text-white transition bg-gray-800 rounded-lg">Reset All</button>
                        <button onClick={handleUploadNew} className="flex-1 py-2 text-sm text-gray-400 hover:text-white transition bg-gray-800 rounded-lg">New Image</button>
                    </div>
                </div>
            </div>
        </div>

        {/* Global Modals */}
        <DownloadModal 
            isOpen={isDownloadModalOpen} 
            onClose={() => setIsDownloadModalOpen(false)} 
            onConfirm={handleConfirmDownload}
            imageFile={currentImage}
        />
        {originalImage && currentImage && (
            <BatchEditModal
                isOpen={isBatchEditModalOpen}
                onClose={() => setIsBatchEditModalOpen(false)}
                originalImage={originalImage}
                editedImage={currentImage}
            />
        )}
        {batchPresetInfo && (
            <BatchPresetModal
                isOpen={isBatchPresetModalOpen}
                onClose={() => setIsBatchPresetModalOpen(false)}
                presetName={batchPresetInfo.name}
                presetPrompt={batchPresetInfo.prompt}
                presetType={batchPresetInfo.type}
            />
        )}
        {isHistoryPanelOpen && (
            <HistoryPanel 
                history={history} 
                currentIndex={historyIndex} 
                onSelectHistory={handleHistorySelect} 
                onClose={() => setIsHistoryPanelOpen(false)} 
            />
        )}
        {/* Mask Editor: Rendered when tab is Mask OR specifically opened via state if we had a dedicated state. 
            Currently leveraging activeTab. For better UX, it overlays the whole screen. */}
        <MaskEditor
            isOpen={activeTab === 'mask'}
            onClose={() => setActiveTab('retouch')}
            onApplyMask={handleApplyMask}
            baseImageSrc={currentImageUrl}
        />
        {sessionToRestore && (
            <RestoreSessionModal 
                onRestore={handleRestoreSession} 
                onStartNew={handleStartNewSession} 
            />
        )}
      </div>
  );
};

export default App;