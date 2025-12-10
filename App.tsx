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
  { id: 'doubleExposure', label: 'Double Exposure', icon: DoubleExposureIcon },
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
    const container = imageContainerRef.current;
    const img = imgRef.current;
    if (!container || !img) return null;

    const containerRect = container.getBoundingClientRect();
    const clickX = e.clientX - containerRect.left;
    const clickY = e.clientY - containerRect.top;

    // Undo the view transform to find the click position on the untransformed, fitted image element
    const pointOnImageElementX = (clickX - viewTransform.pan.x) / viewTransform.scale;
    const pointOnImageElementY = (clickY - viewTransform.pan.y) / viewTransform.scale;

    // Convert from image element coordinates to natural image coordinates
    const { naturalWidth, naturalHeight, clientWidth, clientHeight } = img;
    const scaleToNaturalX = naturalWidth / clientWidth;
    const scaleToNaturalY = naturalHeight / clientHeight;

    const originalX = Math.round(pointOnImageElementX * scaleToNaturalX);
    const originalY = Math.round(pointOnImageElementY * scaleToNaturalY);
    
    // Check if click is within the image bounds on the element
    if (pointOnImageElementX < 0 || pointOnImageElementX > clientWidth || pointOnImageElementY < 0 || pointOnImageElementY > clientHeight) {
        return null;
    }

    return {
        display: { x: clickX, y: clickY },
        edit: { x: originalX, y: originalY },
    };
}, [viewTransform]);

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

    if ((activeTab === 'retouch' || activeTab === 'zoom') && displayHotspot) {
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

  const renderContent = () => {
    if (error) {
       const isSafetyError = error.includes("Generative AI Prohibited Use Policy");
       return (
           <div className="text-center animate-fade-in bg-red-500/10 border border-red-500/20 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold text-red-300">An Error Occurred</h2>
            <p className="text-md text-red-400">
                {isSafetyError ? (
                    <>
                        Your request was blocked due to safety policies, which can be triggered by the image or your text prompt. Please try a different image or a more direct prompt. You can learn more by reading Google's <a href="https://policies.google.com/terms/generative-ai/use-policy" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">Generative AI Prohibited Use Policy</a>.
                    </>
                ) : (
                    error
                )}
            </p>
            <button
                onClick={() => setError(null)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors"
              >
                Try Again
            </button>
          </div>
        );
    }
    
    if (!currentImageUrl) {
      return <StartScreen onFileSelect={handleFileSelect} />;
    }

    const imageDisplay = (
      <div
        ref={imageContainerRef}
        className="relative w-full h-full"
        style={{ cursor: isSplitView ? 'default' : cursorStyle }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
            setIsPanning(false);
            setIsDragging(false);
            setIsDraggingHotspot(false);
            isDraggingSplitter.current = false;
        }}
      >
        {isSplitView ? (
             <>
                {/* Base Image (Current Edit) */}
                <img
                    ref={imgRef}
                    key={`current-split-${currentImageUrl}`}
                    src={currentImageUrl}
                    alt="Current"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />
                {/* Clipped Original Image */}
                <div 
                    className="absolute inset-0 w-full h-full"
                    style={{ clipPath: `inset(0 ${100 - splitPosition}% 0 0)`}}
                >
                    <img
                        key={`original-split-${originalImageUrl}`}
                        src={originalImageUrl}
                        alt="Original"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    />
                </div>
                {/* Splitter Handle */}
                <div
                    className="absolute top-0 bottom-0 w-1 bg-white/75 cursor-ew-resize group z-10 flex items-center"
                    style={{ left: `calc(${splitPosition}%)`, transform: 'translateX(-50%)' }}
                    onPointerDown={handleSplitterPointerDown}
                >
                    <div className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-gray-600 group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
                    </div>
                </div>
            </>
        ) : (
            <div
                className="w-full h-full"
                style={{ 
                    transform: `translate(${viewTransform.pan.x}px, ${viewTransform.pan.y}px) scale(${viewTransform.scale})`,
                    transition: isPanning || isDraggingHotspot ? 'none' : 'transform 0.1s ease-out',
                }}
            >
                {/* Base image is the original, always at the bottom */}
                {originalImageUrl && (
                    <img
                        key={originalImageUrl}
                        src={originalImageUrl}
                        alt="Original"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        loading="lazy"
                    />
                )}
                {/* The current image is an overlay that fades in/out for comparison */}
                <img
                    ref={imgRef}
                    key={currentImageUrl}
                    src={currentImageUrl}
                    alt="Current"
                    onLoad={onImageLoad}
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ease-in-out animate-image-update ${isComparing ? 'opacity-0' : 'opacity-100'}`}
                    loading="lazy"
                />
                {/* Mask Overlay */}
                {maskDataUrl && (
                    <img
                        src={maskDataUrl}
                        alt="Active mask"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    />
                )}
                {/* Face Detection Bounding Boxes */}
                {activeTab === 'face' && detectedFaces.length > 0 && (
                    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
                        {detectedFaces.map((face, index) => {
                            const isSelected = selectedFaces.some(sf => JSON.stringify(sf.box) === JSON.stringify(face.box));
                            const { x, y, width, height } = face.box;

                            return (
                                <div
                                    key={index}
                                    className={`absolute transition-all duration-200 border-2 rounded-md ${isSelected ? 'border-blue-400 bg-blue-400/20 shadow-lg' : 'border-white/50 border-dashed'}`}
                                    style={{
                                        left: `${x * 100}%`,
                                        top: `${y * 100}%`,
                                        width: `${width * 100}%`,
                                        height: `${height * 100}%`,
                                    }}
                                />
                            );
                        })}
                    </div>
                )}
                {/* Overlays Live Preview */}
                {activeTab === 'overlay' && (
                    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
                    {overlayLayers.map(layer => {
                        if (!layer.isVisible) return null;
                        
                        const styles: React.CSSProperties = {
                            position: 'absolute',
                            opacity: layer.opacity,
                            width: `${layer.size}%`,
                            height: 'auto',
                            top: `${layer.position.y}%`,
                            left: `${layer.position.x}%`,
                            mixBlendMode: layer.blendMode,
                        };

                        return (
                            <img
                                key={layer.id}
                                src={layer.previewUrl}
                                alt={layer.name}
                                style={styles}
                                className="pointer-events-none"
                            />
                        );
                    })}
                    </div>
                )}
            </div>
        )}
        {!isSplitView && displayHotspot && !isLoading && (activeTab === 'retouch' || activeTab === 'adjust' || activeTab === 'zoom') && !maskDataUrl && (
            <div 
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 animate-hotspot-appear"
                style={{ 
                    left: `${displayHotspot.x}px`, 
                    top: `${displayHotspot.y}px`,
                    cursor: isDraggingHotspot ? 'grabbing' : 'grab',
                }}
                onPointerDown={handleHotspotPointerDown}
            >
                <div className="relative flex justify-center items-center w-16 h-16">
                    <div className="absolute w-full h-full rounded-full border-2 border-blue-400 animate-spin-slow"></div>
                    <div className="absolute w-[80%] h-[80%] rounded-full border-2 border-dashed border-white/50 animate-spin-reverse-slow"></div>
                    <div className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400 shadow-[0_0_10px_3px_rgba(56,189,248,0.7)]"></div>
                    <div className="absolute w-full h-px bg-blue-400/50"></div>
                    <div className="absolute h-full w-px bg-blue-400/50"></div>
                </div>
            </div>
        )}
      </div>
    );
    
    // For ReactCrop, we need a single image element. We'll use the current one.
    // Fix: The `rotate` prop is not supported by `ReactCrop`. Rotation is applied
    // directly to the image element via CSS transform. The cropping logic
    // in `handleApplyCropAndRotate` already accounts for this.
    const cropImageElement = (
      <img 
        ref={imgRef}
        key={`crop-${currentImageUrl}`}
        src={currentImageUrl} 
        onLoad={onImageLoad}
        alt="Crop this image"
        className="w-full h-auto object-contain max-h-[50vh] lg:max-h-[60vh] rounded-xl"
        style={{ transform: `rotate(${rotation}deg)` }}
        loading="lazy"
      />
    );


    return (
      <div className="w-full flex flex-col lg:flex-row items-start gap-4 lg:gap-8 animate-fade-in">
        {/* Sidebar Navigation */}
        <nav className="flex flex-row lg:flex-col gap-1 bg-gray-800/80 border border-gray-700/80 rounded-lg p-2 backdrop-blur-sm lg:sticky top-24 lg:self-start w-full lg:w-auto overflow-x-auto">
            {tools.map(tool => (
                <button
                    key={tool.id}
                    onClick={() => setActiveTab(tool.id)}
                    className={`flex-shrink-0 flex items-center gap-3 font-semibold py-3 px-4 rounded-md transition-all duration-300 ease-out text-base text-left group origin-left transform hover:-translate-y-0.5 active:scale-[0.98] ${
                        activeTab === tool.id
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/30' 
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <tool.icon className={`w-6 h-6 transition-all duration-300 ease-out ${activeTab === tool.id ? 'scale-110 text-white' : 'text-gray-400 group-hover:text-white group-hover:scale-110'}`} />
                    <span>{tool.label}</span>
                </button>
            ))}
        </nav>

        {/* Main Content Area */}
        <div className="flex-grow flex flex-col items-center gap-6 min-w-0 w-full">
            <div className={`relative w-full max-w-4xl shadow-2xl rounded-xl overflow-hidden bg-black/20 transition-all duration-500 ${isLoading ? 'animate-pulse-border animate-subtle-pulse' : ''}`}>
                {isLoading && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in animate-shimmer-bg">
                        <Spinner />
                        <p className="text-gray-300 animate-pulse-text">AI is working its magic...</p>
                    </div>
                )}
                
                <div 
                  className="w-full max-h-[50vh] lg:max-h-[60vh] flex items-center justify-center" 
                  style={{ aspectRatio: imageAspectRatio ?? '1 / 1' }}
                >
                    {activeTab === 'crop' ? (
                        <ReactCrop 
                            crop={crop} 
                            onChange={c => setCrop(c)} 
                            onComplete={c => setCompletedCrop(c)} 
                            aspect={aspect}
                            className="flex justify-center items-center"
                        >
                            {cropImageElement}
                        </ReactCrop>
                    ) : imageDisplay }
                </div>
                
                {isZoomPanEnabled && (
                    <ViewControls 
                        zoom={viewTransform.scale} 
                        onZoomIn={handleZoomIn}
                        onZoomOut={handleZoomOut}
                        onResetView={resetViewTransform}
                    />
                )}
            </div>

            {history.length > 0 && (
                <div className="w-full max-w-4xl flex items-center justify-center gap-3 animate-fade-in">
                    <button 
                        onClick={handleUndo}
                        disabled={!canUndo}
                        className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                        aria-label="Undo last action"
                    >
                        <UndoIcon className="w-5 h-5 mr-2" />
                        Undo
                    </button>
                    <button 
                        onClick={handleRedo}
                        disabled={!canRedo}
                        className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                        aria-label="Redo last action"
                    >
                        <RedoIcon className="w-5 h-5 mr-2" />
                        Redo
                    </button>
                    <button 
                        onClick={() => setIsHistoryPanelOpen(true)}
                        className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
                        aria-label="Show edit history"
                    >
                        <HistoryIcon className="w-5 h-5 mr-2" />
                        History
                    </button>
                </div>
            )}
            
            {showSuggestions && suggestions.length > 0 && (
                <SuggestionPanel
                    suggestions={suggestions}
                    onApplySuggestion={handleApplySuggestion}
                    onDismiss={() => setShowSuggestions(false)}
                />
            )}

            <div className="w-full max-w-4xl grid">
                {/* Retouch Panel */}
                <div className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${activeTab === 'retouch' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.97] pointer-events-none'}`}>
                    <div className="flex flex-col items-center gap-4">
                        <p className="text-md text-gray-400">
                           {maskDataUrl ? 'A mask is active. Describe your edit for the selected area.' :
                           (editHotspot ? 'Great! Drag the point to adjust, then describe your edit.' : 'Click an area on the image to make a precise edit.')}
                        </p>
                        <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="w-full flex flex-col sm:flex-row items-center gap-2">
                            <input
                                type="text"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder={maskDataUrl ? "e.g., 'make this area glow'" : (editHotspot ? "e.g., 'change my shirt color to blue'" : "First click a point on the image")}
                                className="flex-grow bg-gray-800 border border-gray-700 text-gray-200 rounded-lg p-5 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={isLoading || (!editHotspot && !maskDataUrl)}
                            />
                            {maskDataUrl && (
                                <button type="button" onClick={() => setMaskDataUrl(null)} className="text-sm bg-white/10 hover:bg-white/20 text-gray-200 font-semibold py-5 px-4 rounded-md transition-all active:scale-95 disabled:opacity-50">
                                    Clear Mask
                                </button>
                            )}
                            <button 
                                type="submit"
                                className="w-full sm:w-auto bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-5 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                                disabled={isLoading || !prompt.trim() || (!editHotspot && !maskDataUrl)}
                            >
                                Generate
                            </button>
                        </form>
                    </div>
                </div>

                {/* Face Retouch Panel */}
                <div className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${activeTab === 'face' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.97] pointer-events-none'}`}>
                <FaceRetouchPanel 
                    onApplyRetouch={handleApplyFaceRetouch} 
                    isLoading={isLoading}
                    currentImage={currentImage}
                    onFacesDetected={setDetectedFaces}
                    onFaceSelectionChange={setSelectedFaces}
                />
                </div>

                {/* Face Swap Panel */}
                <div className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${activeTab === 'faceSwap' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.97] pointer-events-none'}`}>
                    <FaceSwapPanel 
                        onApplyFaceSwap={handleApplyFaceSwap} 
                        isLoading={isLoading}
                        targetImage={currentImage}
                    />
                </div>

                {/* Crop Panel */}
                <div className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${activeTab === 'crop' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.97] pointer-events-none'}`}>
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
                </div>

                {/* Adjust Panel */}
                <div className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${activeTab === 'adjust' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.97] pointer-events-none'}`}>
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
                />
                </div>
                
                {/* Filters Panel */}
                <div className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${activeTab === 'filters' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.97] pointer-events-none'}`}>
                <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} onBatchApply={(prompt, name) => handleOpenBatchPresetModal(prompt, name, 'filter')} />
                </div>

                {/* Color Grade Panel */}
                <div className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${activeTab === 'colorGrade' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.97] pointer-events-none'}`}>
                <ColorGradePanel onApplyColorGrade={handleApplyColorGrade} isLoading={isLoading} onBatchApply={(prompt, name) => handleOpenBatchPresetModal(prompt, name, 'colorGrade')} />
                </div>

                {/* Background Panel */}
                <div className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${activeTab === 'background' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.97] pointer-events-none'}`}>
                <BackgroundPanel onRemoveBackground={handleRemoveBackground} onApplyNewBackground={handleApplyNewBackground} isLoading={isLoading} isBgRemovalMode={isBgRemovalMode} />
                </div>

                {/* Overlay Panel */}
                <div className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${activeTab === 'overlay' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.97] pointer-events-none'}`}>
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
                </div>

                {/* Double Exposure Panel */}
                <div className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${activeTab === 'doubleExposure' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.97] pointer-events-none'}`}>
                    <DoubleExposurePanel onApply={handleApplyDoubleExposure} isLoading={isLoading} />
                </div>

                {/* Upscale Panel */}
                <div className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${activeTab === 'upscale' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.97] pointer-events-none'}`}>
                <UpscalePanel onApplyUpscale={handleApplyUpscale} isLoading={isLoading} />
                </div>

                {/* Zoom Panel */}
                <div className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${activeTab === 'zoom' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.97] pointer-events-none'}`}>
                <ZoomPanel
                    onApplyZoom={handleApplyZoom}
                    isLoading={isLoading}
                    isAreaSelected={!!editHotspot}
                    editHotspot={editHotspot}
                    imageRef={imgRef}
                />
                </div>
                
                {/* Restore Panel */}
                <div className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${activeTab === 'restore' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.97] pointer-events-none'}`}>
                <RestorePanel onApplyRestore={handleApplyRestoration} isLoading={isLoading} />
                </div>

                {/* Watermark Panel */}
                <div className={`col-start-1 row-start-1 transition-all duration-300 ease-out ${activeTab === 'watermark' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.97] pointer-events-none'}`}>
                <WatermarkPanel onApplyWatermark={handleApplyWatermark} isLoading={isLoading} />
                </div>
            </div>
            
            <div className="w-full max-w-4xl flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-4 lg:mt-6">
                {canUndo && (
                  <>
                    <button 
                        onMouseDown={() => setIsComparing(true)}
                        onMouseUp={() => setIsComparing(false)}
                        onMouseLeave={() => setIsComparing(false)}
                        onTouchStart={() => setIsComparing(true)}
                        onTouchEnd={() => setIsComparing(false)}
                        className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
                        aria-label="Press and hold to see original image"
                    >
                        <EyeIcon className="w-5 h-5 mr-2" />
                        Compare
                    </button>
                    <button 
                        onClick={() => {
                            const nextState = !isSplitView;
                            if (nextState) {
                                resetViewTransform();
                            }
                            setIsSplitView(nextState);
                        }}
                        className={`flex items-center justify-center text-center border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:border-white/30 active:scale-95 text-base ${isSplitView ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}
                        aria-label="Toggle split-screen comparison view"
                    >
                        <SplitScreenIcon className="w-5 h-5 mr-2" />
                        Split View
                    </button>
                  </>
                )}
                 <button 
                    onClick={() => setIsBatchEditModalOpen(true)}
                    disabled={!canUndo}
                    className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                    aria-label="Batch edit images"
                >
                    <DocumentDuplicateIcon className="w-5 h-5 mr-2" />
                    Batch Edit
                </button>

                <div className="w-full sm:w-auto flex flex-grow justify-end gap-2 sm:gap-3 mt-4 sm:mt-0">
                    <button 
                        onClick={handleReset}
                        disabled={!canUndo}
                        className="text-center bg-transparent border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/10 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent"
                    >
                        Reset
                    </button>
                    <button 
                        onClick={handleUploadNew}
                        className="text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
                    >
                        Upload New
                    </button>

                    <button 
                        onClick={handleDownload}
                        className="bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-3 px-5 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base"
                    >
                        Download
                    </button>
                </div>
            </div>
        </div>
      </div>
    );
  };
  
  if (isLoadingSession) {
    return (
        <div className="min-h-screen text-gray-100 flex flex-col">
            <Header />
            <main className="flex-grow w-full flex items-center justify-center">
                <Spinner />
            </main>
        </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-100 flex flex-col">
      {sessionToRestore && (
        <RestoreSessionModal 
            onRestore={handleRestoreSession} 
            onStartNew={handleStartNewSession} 
        />
      )}
      {isDownloadModalOpen && currentImage && (
        <DownloadModal 
            isOpen={isDownloadModalOpen}
            onClose={() => setIsDownloadModalOpen(false)}
            onConfirm={handleConfirmDownload}
            imageFile={currentImage}
        />
      )}
      {isHistoryPanelOpen && currentImageUrl && (
        <HistoryPanel
          history={history}
          currentIndex={historyIndex}
          onSelectHistory={handleHistorySelect}
          onClose={() => setIsHistoryPanelOpen(false)}
        />
      )}
      {isBatchEditModalOpen && originalImage && currentImage && (
        <BatchEditModal
          isOpen={isBatchEditModalOpen}
          onClose={() => setIsBatchEditModalOpen(false)}
          originalImage={originalImage}
          editedImage={currentImage}
        />
      )}
      {isBatchPresetModalOpen && batchPresetInfo && (
        <BatchPresetModal
          isOpen={isBatchPresetModalOpen}
          onClose={() => setIsBatchPresetModalOpen(false)}
          presetName={batchPresetInfo.name}
          presetPrompt={batchPresetInfo.prompt}
          presetType={batchPresetInfo.type}
        />
      )}
      {currentImageUrl && (
        <MaskEditor
            isOpen={activeTab === 'mask'}
            onClose={() => setActiveTab('retouch')}
            onApplyMask={handleApplyMask}
            baseImageSrc={currentImageUrl}
        />
      )}
      <Header />
      <main className={`flex-grow w-full max-w-[1600px] mx-auto p-4 md:p-8 flex justify-center ${currentImageUrl ? 'items-start' : 'items-center'}`}>
        {!sessionToRestore && renderContent()}
      </main>
    </div>
  );
};

export default App;