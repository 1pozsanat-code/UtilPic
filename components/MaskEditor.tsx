/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { CloseIcon, MagicWandIcon, UserCircleIcon, SunIcon } from './icons.tsx';
import { generateSegmentationMask } from '../services/geminiService.ts';
import Spinner from './Spinner.tsx';

// --- ICONS ---
const BrushIcon = ({className}:{className?:string}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.475 2.118A2.25 2.25 0 0 1 .879 16.5a3 3 0 0 1 4.242-4.242 3 3 0 0 0 4.242 0 3 3 0 0 0 0-4.242 3 3 0 0 1-4.242-4.242 3 3 0 0 1 4.242 0 3 3 0 0 1 0 4.242 3 3 0 0 0 4.242 4.242 3 3 0 0 0 5.78-1.128 2.25 2.25 0 0 1 2.475-2.118 2.25 2.25 0 0 1 .879 3.5a3 3 0 0 1-4.242 4.242 3 3 0 0 0-4.242 0 3 3 0 0 0 0 4.242Z" /></svg>;
const EraserIcon = ({className}:{className?:string}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12l-2.25 2.25m-2.25-2.25 2.25-2.25M12 9.75l-2.25 2.25M12 9.75l2.25-2.25M3.375 7.5h17.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125H3.375c-.621 0-1.125-.504-1.125-1.125v-9.75c0-.621.504-1.125 1.125-1.125Z" /></svg>;
const GradientLinearIcon = ({className}:{className?:string}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path d="M11 7h2v10h-2z" opacity=".5"/></svg>;
const GradientRadialIcon = ({className}:{className?:string}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><circle cx="12" cy="12" r="5" opacity=".5"/></svg>;


interface MaskEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyMask: (maskDataUrl: string, autoPrompt?: string) => void;
  baseImageSrc: string | null;
}

const MASK_BASE_ALPHA = 0.5; // Base transparency of the red overlay
const DEFAULT_BRUSH_OPACITY = 100;

type Tool = 'brush' | 'eraser' | 'linear-gradient' | 'radial-gradient';

const MaskEditor: React.FC<MaskEditorProps> = ({ isOpen, onClose, onApplyMask, baseImageSrc }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tool State
  const [activeTool, setActiveTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState(40);
  const [brushHardness, setBrushHardness] = useState(100);
  
  // Interaction State
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);
  const [currentPos, setCurrentPos] = useState<{x: number, y: number} | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [isCursorOverCanvas, setIsCursorOverCanvas] = useState(false);
  const [isGeneratingMask, setIsGeneratingMask] = useState(false);

  // Adjustments State
  const [adjustments, setAdjustments] = useState({
      exposure: 0,
      contrast: 0,
      highlights: 0,
      shadows: 0,
      whites: 0,
      blacks: 0,
      structure: 0,
      temperature: 0,
  });

  const isAdjustmentActive = useMemo(() => {
    return Object.values(adjustments).some(val => val !== 0);
  }, [adjustments]);

  // Reset Logic
  const resetCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const container = containerRef.current;
    if (canvas && image && container && image.naturalWidth > 0) {
        const { width, height } = container.getBoundingClientRect();
        
        const imageAspectRatio = image.naturalWidth / image.naturalHeight;
        const containerAspectRatio = width / height;

        let canvasWidth, canvasHeight;

        if (imageAspectRatio > containerAspectRatio) {
            canvasWidth = width;
            canvasHeight = width / imageAspectRatio;
        } else {
            canvasHeight = height;
            canvasWidth = height * imageAspectRatio;
        }

        // Save current canvas content before resizing to restore it? 
        // For simplicity in this demo, we might lose it or rely on a separate buffer if needed.
        // But React lifecycle might trigger this on init mainly.
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx?.drawImage(canvas, 0, 0);

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(tempCanvas, 0, 0, canvasWidth, canvasHeight);
        }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
        window.addEventListener('resize', resizeCanvas);
        setTimeout(resizeCanvas, 100);
    } else {
        window.removeEventListener('resize', resizeCanvas);
    }
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [isOpen, resizeCanvas]);
  
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): { x: number, y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // --- DRAWING LOGIC ---

  const drawBrush = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const radius = brushSize / 2;
    const dynamicAlpha = MASK_BASE_ALPHA;
    
    // We only support brush (add) and eraser (remove) in this simple pixel mode
    const color = `rgba(239, 68, 68, ${dynamicAlpha})`;
    
    ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';

    if (brushHardness < 100) {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(brushHardness / 100, color);
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = color;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawGradient = (ctx: CanvasRenderingContext2D, start: {x:number, y:number}, end: {x:number, y:number}, type: 'linear' | 'radial') => {
      const color = `rgba(239, 68, 68, ${MASK_BASE_ALPHA})`;
      const transparent = `rgba(239, 68, 68, 0)`;

      let gradient;
      if (type === 'linear') {
          gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, transparent);
      } else {
          const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
          gradient = ctx.createRadialGradient(start.x, start.y, 0, start.x, start.y, radius);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, transparent);
      }
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  };

  // --- INTERACTION HANDLERS ---

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const coords = getCanvasCoords(e);
    if (!coords) return;

    setIsDrawing(true);
    setStartPos(coords);
    setCurrentPos(coords);

    if (activeTool === 'brush' || activeTool === 'eraser') {
        drawBrush(coords.x, coords.y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const container = containerRef.current;
    
    if (container && e.currentTarget) {
         const containerRect = container.getBoundingClientRect();
         setCursorPosition({
             x: e.clientX - containerRect.left,
             y: e.clientY - containerRect.top,
         });
    }

    if (!isDrawing || !coords) return;
    setCurrentPos(coords);

    if (activeTool === 'brush' || activeTool === 'eraser') {
        drawBrush(coords.x, coords.y);
    } 
    // For gradients, we render on a loop or on frame, but here we'll let a separate overlay handle the preview or implement a temporary draw cycle?
    // Simplified: We will just re-render the whole canvas if it were layer-based, but since it's destructive, 
    // we need to save the state on Down, and restore+draw on Move.
    // For MVP Complexity: We will only draw gradient on UP. (Or implement a temp overlay layer).
    // Let's implement a temp overlay approach for gradients in a future iteration. 
    // For now, let's just draw on 'Up' or use a 'preview' layer logic if possible.
    // Actually, let's do the "Restore Image Data" trick for smooth UX.
  };
  
  // To handle live gradient preview, we need to save canvas state on PointerDown
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);

  useEffect(() => {
      if (isDrawing && startPos && (activeTool === 'linear-gradient' || activeTool === 'radial-gradient')) {
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx && !snapshot) {
              setSnapshot(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height));
          }
      } else if (!isDrawing) {
          setSnapshot(null);
      }
  }, [isDrawing, startPos, activeTool, snapshot]);

  useEffect(() => {
      // Render loop for gradient preview
      if (isDrawing && snapshot && startPos && currentPos && (activeTool === 'linear-gradient' || activeTool === 'radial-gradient')) {
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) {
              ctx.putImageData(snapshot, 0, 0);
              ctx.globalCompositeOperation = 'source-over'; // Gradients always add
              drawGradient(ctx, startPos, currentPos, activeTool === 'linear-gradient' ? 'linear' : 'radial');
          }
      }
  }, [currentPos, isDrawing, snapshot, startPos, activeTool]);


  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDrawing(false);
    setStartPos(null);
    setCurrentPos(null);
  };

  // --- AI SELECTION LOGIC ---

  const handleAISelect = async (type: 'sky' | 'subject') => {
      const image = imageRef.current;
      const canvas = canvasRef.current;
      if (!image || !canvas || !baseImageSrc) return;

      setIsGeneratingMask(true);
      try {
          // Convert current base image to File
          const res = await fetch(baseImageSrc);
          const blob = await res.blob();
          const file = new File([blob], "base.png", { type: "image/png" });

          // Call API
          const maskDataUrl = await generateSegmentationMask(file, type);

          // Draw result onto canvas
          const maskImg = new Image();
          maskImg.onload = () => {
             const ctx = canvas.getContext('2d');
             if (ctx) {
                 // We need to draw this mask (which is B&W) as Red transparent on our canvas
                 // 1. Draw B&W to a temp canvas
                 const tempCanvas = document.createElement('canvas');
                 tempCanvas.width = canvas.width;
                 tempCanvas.height = canvas.height;
                 const tCtx = tempCanvas.getContext('2d');
                 tCtx?.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
                 
                 // 2. Iterate pixels and convert White to Red-Transparent
                 const imgData = tCtx?.getImageData(0, 0, canvas.width, canvas.height);
                 if (imgData) {
                     const data = imgData.data;
                     for(let i=0; i<data.length; i+=4) {
                         const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
                         if (brightness > 128) { // It's white-ish (selected)
                             data[i] = 239; // R
                             data[i+1] = 68; // G
                             data[i+2] = 68; // B
                             data[i+3] = Math.floor(255 * MASK_BASE_ALPHA); // Alpha
                         } else {
                             data[i+3] = 0; // Transparent
                         }
                     }
                     
                     // 3. Put onto main canvas (Adding to selection)
                     const newCanvas = document.createElement('canvas');
                     newCanvas.width = canvas.width;
                     newCanvas.height = canvas.height;
                     const nCtx = newCanvas.getContext('2d');
                     nCtx?.putImageData(imgData, 0, 0);
                     
                     ctx.globalCompositeOperation = 'source-over';
                     ctx.drawImage(newCanvas, 0, 0);
                 }
             }
             setIsGeneratingMask(false);
          };
          maskImg.src = maskDataUrl;

      } catch (err) {
          console.error("AI Selection failed", err);
          setIsGeneratingMask(false);
          // Optional: Show error
      }
  };

  // --- PROMPT GENERATION ---

  const generatePromptFromValues = () => {
    const parts = [];
    const { exposure, contrast, highlights, shadows, whites, blacks, structure, temperature } = adjustments;

    if (exposure !== 0) parts.push(`${exposure > 0 ? 'increase' : 'decrease'} exposure`);
    if (contrast !== 0) parts.push(`${contrast > 0 ? 'increase' : 'decrease'} contrast`);
    if (highlights !== 0) parts.push(`${highlights > 0 ? 'brighten' : 'dim'} highlights`);
    if (shadows !== 0) parts.push(`${shadows > 0 ? 'brighten' : 'darken'} shadows`);
    if (whites !== 0) parts.push(`${whites > 0 ? 'boost' : 'mute'} whites`);
    if (blacks !== 0) parts.push(`${blacks > 0 ? 'lift' : 'deepen'} blacks`);
    if (structure !== 0) parts.push(`${structure > 0 ? 'enhance' : 'soften'} clarity/structure`);
    if (temperature !== 0) parts.push(`make the color temperature ${temperature > 0 ? 'warmer' : 'cooler'}`);

    if (parts.length === 0) return undefined;
    return `In the masked area: ${parts.join(', ')}. Blend naturally.`;
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (canvas) {
        const scaledCanvas = document.createElement('canvas');
        const image = imageRef.current;
        if (!image) return;

        scaledCanvas.width = image.naturalWidth;
        scaledCanvas.height = image.naturalHeight;
        const ctx = scaledCanvas.getContext('2d');
        if (!ctx) return;

        // Draw the mask from the display canvas onto the full-res canvas
        ctx.drawImage(canvas, 0, 0, image.naturalWidth, image.naturalHeight);
        
        const autoPrompt = generatePromptFromValues();
        onApplyMask(scaledCanvas.toDataURL(), autoPrompt);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm p-2 md:p-4">
        {/* Header */}
        <div className="w-full max-w-7xl flex items-center justify-between p-4 bg-gray-900/80 border-b border-gray-700 rounded-t-lg backdrop-blur-md">
            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                Local Adjustments & Masking
            </h2>
            <div className="flex items-center gap-4">
                <button onClick={onClose} className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition"><CloseIcon className="w-6 h-6" /></button>
            </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-grow w-full max-w-7xl flex flex-col lg:flex-row gap-0 lg:gap-0 bg-gray-900/50 rounded-b-lg min-h-0 overflow-hidden border-x border-b border-gray-700">
            
            {/* LEFT TOOLBAR */}
            <div className="w-full lg:w-20 bg-gray-900 border-r border-gray-700 flex flex-row lg:flex-col items-center p-2 gap-2 overflow-x-auto lg:overflow-visible">
                <button onClick={() => setActiveTool('brush')} className={`p-3 rounded-lg transition-all ${activeTool === 'brush' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:bg-white/10'}`} title="Brush">
                    <BrushIcon className="w-6 h-6" />
                </button>
                <button onClick={() => setActiveTool('eraser')} className={`p-3 rounded-lg transition-all ${activeTool === 'eraser' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:bg-white/10'}`} title="Eraser">
                    <EraserIcon className="w-6 h-6" />
                </button>
                <div className="w-px h-8 lg:w-8 lg:h-px bg-gray-700 mx-1 lg:my-1"></div>
                <button onClick={() => setActiveTool('linear-gradient')} className={`p-3 rounded-lg transition-all ${activeTool === 'linear-gradient' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:bg-white/10'}`} title="Linear Gradient">
                    <GradientLinearIcon className="w-6 h-6" />
                </button>
                <button onClick={() => setActiveTool('radial-gradient')} className={`p-3 rounded-lg transition-all ${activeTool === 'radial-gradient' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:bg-white/10'}`} title="Radial Gradient">
                    <GradientRadialIcon className="w-6 h-6" />
                </button>
                <div className="w-px h-8 lg:w-8 lg:h-px bg-gray-700 mx-1 lg:my-1"></div>
                <button onClick={() => handleAISelect('sky')} disabled={isGeneratingMask} className={`p-3 rounded-lg transition-all text-gray-400 hover:bg-white/10 ${isGeneratingMask ? 'opacity-50' : ''}`} title="Select Sky (AI)">
                    <SunIcon className="w-6 h-6" />
                </button>
                <button onClick={() => handleAISelect('subject')} disabled={isGeneratingMask} className={`p-3 rounded-lg transition-all text-gray-400 hover:bg-white/10 ${isGeneratingMask ? 'opacity-50' : ''}`} title="Select Subject (AI)">
                    <UserCircleIcon className="w-6 h-6" />
                </button>
            </div>

            {/* MIDDLE CANVAS AREA */}
            <div ref={containerRef} className="flex-grow relative bg-black/40 flex items-center justify-center overflow-hidden">
                {baseImageSrc && (
                    <img
                        ref={imageRef}
                        src={baseImageSrc}
                        alt="Masking background"
                        className="max-w-full max-h-full object-contain pointer-events-none select-none"
                        onLoad={resizeCanvas}
                    />
                )}
                <canvas
                    ref={canvasRef}
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 touch-none ${isCursorOverCanvas ? 'cursor-none' : ''}`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={() => {
                        setIsDrawing(false);
                        setIsCursorOverCanvas(false);
                    }}
                    onPointerEnter={() => setIsCursorOverCanvas(true)}
                />
                
                {/* Visual Cursor for Brush/Eraser */}
                {isCursorOverCanvas && cursorPosition && (activeTool === 'brush' || activeTool === 'eraser') && (
                    <div
                        className={`absolute pointer-events-none rounded-full transition-colors duration-75 border-2 ${activeTool === 'brush' ? 'border-red-500 bg-red-500/20' : 'border-white bg-white/20'}`}
                        style={{
                            left: `${cursorPosition.x}px`,
                            top: `${cursorPosition.y}px`,
                            width: `${brushSize}px`,
                            height: `${brushSize}px`,
                            transform: `translate(-50%, -50%)`,
                        }}
                    />
                )}
                
                {isGeneratingMask && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20 backdrop-blur-sm">
                        <div className="bg-gray-800 p-6 rounded-lg flex flex-col items-center gap-4 shadow-2xl">
                            <Spinner />
                            <p className="text-white font-medium">AI is selecting...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT SETTINGS PANEL */}
            <div className="w-full lg:w-80 bg-gray-900 border-l border-gray-700 flex flex-col p-4 gap-6 overflow-y-auto max-h-[40vh] lg:max-h-full">
                
                {/* Brush Settings (Only if brush/eraser active) */}
                {(activeTool === 'brush' || activeTool === 'eraser') && (
                    <div className="space-y-4 border-b border-gray-700 pb-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Tool Settings</h3>
                        <div>
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Size</span>
                                <span>{brushSize}px</span>
                            </div>
                            <input type="range" min="5" max="200" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                        </div>
                        <div>
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Hardness</span>
                                <span>{brushHardness}%</span>
                            </div>
                            <input type="range" min="0" max="100" value={brushHardness} onChange={(e) => setBrushHardness(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                        </div>
                    </div>
                )}

                {/* Adjustments */}
                <div className="space-y-4 flex-grow">
                     <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Adjustments</h3>
                        <button onClick={() => setAdjustments({ exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, structure: 0, temperature: 0 })} className="text-xs text-blue-400 hover:text-blue-300">Reset</button>
                    </div>

                    {[
                        { key: 'exposure', label: 'Light / Exposure' },
                        { key: 'contrast', label: 'Contrast' },
                        { key: 'highlights', label: 'Highlights' },
                        { key: 'shadows', label: 'Shadows' },
                        { key: 'whites', label: 'Whites' },
                        { key: 'blacks', label: 'Blacks' },
                        { key: 'structure', label: 'Structure / Pose' },
                        { key: 'temperature', label: 'Temperature' },
                    ].map(({ key, label }) => (
                        <div key={key}>
                            <div className="flex justify-between text-xs text-gray-300 mb-1">
                                <span>{label}</span>
                                <span className={adjustments[key as keyof typeof adjustments] !== 0 ? 'text-blue-400 font-bold' : 'text-gray-500'}>{adjustments[key as keyof typeof adjustments]}</span>
                            </div>
                            <input 
                                type="range" 
                                min="-100" 
                                max="100" 
                                value={adjustments[key as keyof typeof adjustments]} 
                                onChange={(e) => setAdjustments(prev => ({...prev, [key]: Number(e.target.value)}))}
                                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                            />
                        </div>
                    ))}
                </div>

                <div className="space-y-3 pt-2">
                    <button onClick={resetCanvas} className="w-full bg-gray-800 text-gray-300 font-semibold py-3 px-4 rounded-lg transition-all hover:bg-gray-700 active:scale-95 text-sm">
                        Clear Mask
                    </button>
                    <button onClick={handleApply} className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg hover:shadow-blue-500/30 active:scale-95 text-sm">
                         {isAdjustmentActive ? 'Apply Mask & Adjustments' : 'Use Mask with Prompt'}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default MaskEditor;