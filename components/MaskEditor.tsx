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
  
  // Offscreen canvas to store the pure mask data (alpha channel)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
  const resetMask = useCallback(() => {
    // Clear mask canvas
    if (maskCanvasRef.current) {
        const ctx = maskCanvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    }
    // Redraw main canvas
    drawMainCanvas();
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

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Initialize or Resize Mask Canvas
        if (!maskCanvasRef.current) {
            maskCanvasRef.current = document.createElement('canvas');
        }
        // If dimensions changed, we might lose mask data. Ideally we'd scale it.
        // For simplicity, we keep it consistent or clear it. 
        // Let's try to preserve by drawing old to new if needed, but basic implementation first.
        const prevMaskCtx = maskCanvasRef.current.getContext('2d');
        const tempMask = document.createElement('canvas');
        if (maskCanvasRef.current.width > 0) {
            tempMask.width = maskCanvasRef.current.width;
            tempMask.height = maskCanvasRef.current.height;
            tempMask.getContext('2d')?.drawImage(maskCanvasRef.current, 0, 0);
        }
        
        maskCanvasRef.current.width = canvasWidth;
        maskCanvasRef.current.height = canvasHeight;
        
        if (tempMask.width > 0) {
             prevMaskCtx?.drawImage(tempMask, 0, 0, canvasWidth, canvasHeight);
        }

        drawMainCanvas();
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
        window.addEventListener('resize', resizeCanvas);
        // Delay slightly to ensure container is rendered
        setTimeout(resizeCanvas, 100);
    } else {
        window.removeEventListener('resize', resizeCanvas);
    }
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [isOpen, resizeCanvas]);
  
  // Re-draw whenever adjustments change
  useEffect(() => {
    drawMainCanvas();
  }, [adjustments]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): { x: number, y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };


  // --- COMPOSITING & DRAWING ---
  
  // This function is responsible for rendering the final view:
  // 1. If no adjustments: Show Red Overlay on top of Base Image.
  // 2. If adjustments: Show Base Image + (Base Image * Filters * MaskAlpha).
  const drawMainCanvas = () => {
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const image = imageRef.current;
      if (!canvas || !maskCanvas || !image) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Clear Screen
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 2. Draw pure original image? No, wait. 
      // We want to verify if adjustments are active.
      const hasAdjustments = Object.values(adjustments).some(v => v !== 0);

      if (hasAdjustments) {
          // --- PREVIEW MODE ---
          // Draw Original
          // Draw Filtered Version masked by MaskCanvas
          
          // Layer 1: Original
          // (Can't draw image element directly if aspect ratio differs, use resize logic or background div?)
          // Since the canvas matches the displayed image area perfectly:
          // We can't draw the HTMLImageElement easily if it's styled "object-contain".
          // But our resizeCanvas logic sets canvas size exactly to the image display size.
          // So we can draw the image scaled to canvas size.
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          
          // Layer 2: Adjusted
          ctx.save();
          // Construct filter string
          // Mapping:
          // Exposure -> Brightness (50% to 150%)
          // Contrast -> Contrast (50% to 150%)
          // Highlights/Shadows/Whites/Blacks -> Approximation via brightness/contrast curves is hard in CSS filters.
          // We will map Highlights/Whites to Brightness and Shadows/Blacks to Contrast/Brightness combo for preview.
          const brightnessVal = 100 + adjustments.exposure + (adjustments.highlights / 2) + (adjustments.whites / 2);
          const contrastVal = 100 + adjustments.contrast + (adjustments.shadows / 4) + (adjustments.blacks / 4); // Crude approximation
          const saturateVal = 100 + (adjustments.structure / 2); // Structure often correlates with local contrast/sat perception slightly, or just ignore.
          
          let filterString = `brightness(${brightnessVal}%) contrast(${contrastVal}%) saturate(${saturateVal}%)`;
          if (adjustments.temperature !== 0) {
             filterString += adjustments.temperature > 0 ? ` sepia(${adjustments.temperature * 0.3}%)` : ` hue-rotate(${adjustments.temperature/2}deg)`;
          }

          ctx.filter = filterString;
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          // Layer 3: Apply Mask (Keep only the adjusted parts where mask exists)
          // We use 'destination-in' to keep the adjusted image ONLY where the mask is opaque.
          // BUT, we already drew the original on Step 1.
          // So Step 2 drew over it. Now we need to CUT Step 2 to the mask shape.
          // Wait, 'destination-in' will cut the *entire canvas* content.
          // Correct approach:
          // 1. Draw Original.
          // 2. Save state.
          // 3. Create Offscreen canvas for Adjusted Image.
          // 4. Draw Adjusted Image on Offscreen.
          // 5. Draw Mask on Offscreen (composite destination-in).
          // 6. Draw Offscreen on Main Canvas.
          
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
              // Draw filtered image
              tempCtx.filter = filterString;
              tempCtx.drawImage(image, 0, 0, canvas.width, canvas.height);
              tempCtx.filter = 'none';

              // Composite Mask
              tempCtx.globalCompositeOperation = 'destination-in';
              tempCtx.drawImage(maskCanvas, 0, 0);
              
              // Draw back to main
              ctx.drawImage(tempCanvas, 0, 0);
          }

      } else {
          // --- SELECTION MODE ---
          // Just draw the red overlay.
          // We assume the background image is visible via the <img> tag behind the canvas.
          // The canvas only needs to show the Red Mask.
          // Wait, if we clear the canvas, we see the image behind.
          // So we just draw the maskCanvas in Red.
          
          // 1. Clear
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // 2. Draw Mask as Red
          // Create a temp canvas filled with Red
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tCtx = tempCanvas.getContext('2d');
          if (tCtx) {
              tCtx.fillStyle = `rgba(239, 68, 68, ${MASK_BASE_ALPHA})`; // Red with alpha
              tCtx.fillRect(0, 0, canvas.width, canvas.height);
              
              // Cut to mask shape
              tCtx.globalCompositeOperation = 'destination-in';
              tCtx.drawImage(maskCanvas, 0, 0);
              
              // Draw to main
              ctx.drawImage(tempCanvas, 0, 0);
          }
      }
  };

  // --- DRAWING OPERATIONS ON MASK CANVAS ---

  const drawBrush = (x: number, y: number) => {
    const ctx = maskCanvasRef.current?.getContext('2d');
    if (!ctx) return;

    const radius = brushSize / 2;
    
    // For the mask logic: White = Selected (Opaque), Transparent = Unselected.
    // The "Red" visual is handled in drawMainCanvas.
    // So here we draw pure white (or eraser clears it).
    
    ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';

    // Handle Softness
    if (brushHardness < 100) {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(brushHardness / 100, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Update visual
    drawMainCanvas();
  };

  const drawGradient = (ctx: CanvasRenderingContext2D, start: {x:number, y:number}, end: {x:number, y:number}, type: 'linear' | 'radial') => {
      // White gradient
      const color = `rgba(255, 255, 255, 1)`;
      const transparent = `rgba(255, 255, 255, 0)`;

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
  };
  
  // Store snapshot of mask for gradient preview
  const [maskSnapshot, setMaskSnapshot] = useState<ImageData | null>(null);

  useEffect(() => {
      if (isDrawing && startPos && (activeTool === 'linear-gradient' || activeTool === 'radial-gradient')) {
          const ctx = maskCanvasRef.current?.getContext('2d');
          if (ctx && !maskSnapshot) {
              setMaskSnapshot(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height));
          }
      } else if (!isDrawing) {
          setMaskSnapshot(null);
      }
  }, [isDrawing, startPos, activeTool, maskSnapshot]);

  useEffect(() => {
      // Render loop for gradient preview on MASK canvas
      if (isDrawing && maskSnapshot && startPos && currentPos && (activeTool === 'linear-gradient' || activeTool === 'radial-gradient')) {
          const ctx = maskCanvasRef.current?.getContext('2d');
          if (ctx) {
              ctx.putImageData(maskSnapshot, 0, 0);
              ctx.globalCompositeOperation = 'source-over'; 
              drawGradient(ctx, startPos, currentPos, activeTool === 'linear-gradient' ? 'linear' : 'radial');
              drawMainCanvas(); // Update view
          }
      }
  }, [currentPos, isDrawing, maskSnapshot, startPos, activeTool]);


  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDrawing(false);
    setStartPos(null);
    setCurrentPos(null);
  };

  // --- AI SELECTION LOGIC ---

  const handleAISelect = async (type: 'sky' | 'subject') => {
      const image = imageRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (!image || !maskCanvas || !baseImageSrc) return;

      setIsGeneratingMask(true);
      try {
          // Convert current base image to File
          const res = await fetch(baseImageSrc);
          const blob = await res.blob();
          const file = new File([blob], "base.png", { type: "image/png" });

          // Call API
          const maskDataUrl = await generateSegmentationMask(file, type);

          // Draw result onto MASK canvas
          const maskImg = new Image();
          maskImg.onload = () => {
             const ctx = maskCanvas.getContext('2d');
             if (ctx) {
                 // The AI returns B&W mask. We just draw it onto our mask canvas.
                 // Lighter pixels = Selected.
                 // We might need to ensure it's treated as an alpha map.
                 // Simple approach: Draw it. The visualizer handles the red.
                 ctx.globalCompositeOperation = 'source-over'; // Add to current selection or replace? usually add.
                 ctx.drawImage(maskImg, 0, 0, maskCanvas.width, maskCanvas.height);
                 
                 drawMainCanvas();
             }
             setIsGeneratingMask(false);
          };
          maskImg.src = maskDataUrl;

      } catch (err) {
          console.error("AI Selection failed", err);
          setIsGeneratingMask(false);
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
    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas) {
        const scaledCanvas = document.createElement('canvas');
        const image = imageRef.current;
        if (!image) return;

        scaledCanvas.width = image.naturalWidth;
        scaledCanvas.height = image.naturalHeight;
        const ctx = scaledCanvas.getContext('2d');
        if (!ctx) return;

        // Draw the mask from the display canvas onto the full-res canvas
        // This scales the red/alpha mask up to full res
        ctx.drawImage(maskCanvas, 0, 0, image.naturalWidth, image.naturalHeight);
        
        // If we are applying adjustments, we generate a prompt.
        // If no adjustments, we just return mask for other uses?
        // The prompt assumes we are doing adjustments.
        
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
                {/* Background Image: Only shown if no adjustments active, otherwise Canvas draws it. */}
                {/* Actually, if we use object-contain on image and canvas, they align. 
                    But Canvas drawing image manually might miss sub-pixel antialiasing or differ in scaling slightly.
                    However, for preview it's fine. 
                    Let's hide the background <img> when we are drawing full preview on canvas. 
                */}
                {baseImageSrc && (
                    <img
                        ref={imageRef}
                        src={baseImageSrc}
                        alt="Masking background"
                        className={`max-w-full max-h-full object-contain pointer-events-none select-none ${isAdjustmentActive ? 'opacity-0' : 'opacity-100'}`}
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
                    <button onClick={resetMask} className="w-full bg-gray-800 text-gray-300 font-semibold py-3 px-4 rounded-lg transition-all hover:bg-gray-700 active:scale-95 text-sm">
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