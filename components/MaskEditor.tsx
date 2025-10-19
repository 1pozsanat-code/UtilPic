/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CloseIcon } from './icons.tsx';

interface MaskEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyMask: (maskDataUrl: string) => void;
  baseImageSrc: string | null;
}

const MASK_BASE_ALPHA = 0.5; // Base transparency of the red overlay

const MaskEditor: React.FC<MaskEditorProps> = ({ isOpen, onClose, onApplyMask, baseImageSrc }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [brushSize, setBrushSize] = useState(40);
  const [brushHardness, setBrushHardness] = useState(100);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [isCursorOverCanvas, setIsCursorOverCanvas] = useState(false);


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
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
        window.addEventListener('resize', resizeCanvas);
        // Timeout to allow image to render before resizing
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

  const draw = useCallback((coords: { x: number, y: number }) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const radius = brushSize / 2;
    // Calculate final alpha based on the base mask alpha and the user-selected opacity
    const dynamicAlpha = MASK_BASE_ALPHA * (brushOpacity / 100);
    
    // Define colors for brush and eraser
    const brushPaintColor = `rgba(239, 68, 68, ${dynamicAlpha})`;
    const brushTransparentColor = `rgba(239, 68, 68, 0)`;
    
    // For eraser, color is irrelevant but alpha is key. We create a black gradient with the same alpha profile.
    const eraserPaintColor = `rgba(0, 0, 0, ${dynamicAlpha})`;
    const eraserTransparentColor = `rgba(0, 0, 0, 0)`;
    
    const paintColor = tool === 'brush' ? brushPaintColor : eraserPaintColor;
    const transparentColor = tool === 'brush' ? brushTransparentColor : eraserTransparentColor;
    
    ctx.globalCompositeOperation = tool === 'brush' ? 'source-over' : 'destination-out';

    // Use a radial gradient for hardness < 100 to create soft edges
    if (brushHardness < 100) {
        const gradient = ctx.createRadialGradient(coords.x, coords.y, 0, coords.x, coords.y, radius);
        const hardnessStop = brushHardness / 100;
        
        gradient.addColorStop(0, paintColor);
        gradient.addColorStop(hardnessStop, paintColor);
        gradient.addColorStop(1, transparentColor);
        
        ctx.fillStyle = gradient;
    } else {
        // For 100% hardness, use a solid color
        ctx.fillStyle = paintColor;
    }

    ctx.beginPath();
    ctx.arc(coords.x, coords.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }, [brushSize, brushHardness, brushOpacity, tool]);

  const startDrawing = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const coords = getCanvasCoords(e);
    if (coords) draw(coords);
  }, [draw]);

  const stopDrawing = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDrawing(false);
  }, []);
  
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const canvasCoords = getCanvasCoords(e);
    
    if (canvas && container && canvasCoords) {
        const containerRect = container.getBoundingClientRect();
        // Calculate cursor position relative to the container for the visual cursor div.
        setCursorPosition({
            x: e.clientX - containerRect.left,
            y: e.clientY - containerRect.top,
        });

        if (isDrawing) {
            // Draw using canvas-relative coordinates
            draw(canvasCoords);
        }
    }
  }, [isDrawing, draw]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
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
        
        onApplyMask(scaledCanvas.toDataURL());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm p-4">
        {/* Header Controls */}
        <div className="w-full max-w-6xl flex items-center justify-between p-4 bg-gray-900/50 border-b border-gray-700 rounded-t-lg">
            <h2 className="text-xl font-bold text-gray-100">Mask Editor</h2>
            <div className="flex items-center gap-4">
                <button onClick={onClose} className="text-gray-400 hover:text-white"><CloseIcon className="w-6 h-6" /></button>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-grow w-full max-w-6xl flex flex-col md:flex-row gap-4 p-4 bg-gray-900/50 rounded-b-lg min-h-0">
            {/* Toolbar */}
            <div className="flex-shrink-0 w-full md:w-64 bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-6">
                <p className="text-sm text-gray-400">Paint over the area you want to edit. Use the eraser to refine your selection.</p>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Tool</label>
                    <div className="flex bg-gray-900/50 p-1 rounded-lg border border-gray-700">
                        <button onClick={() => setTool('brush')} className={`w-full py-2 px-4 rounded-md font-semibold transition-all ${tool === 'brush' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/10'}`}>Brush</button>
                        <button onClick={() => setTool('eraser')} className={`w-full py-2 px-4 rounded-md font-semibold transition-all ${tool === 'eraser' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/10'}`}>Eraser</button>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label htmlFor="brush-size" className="block text-sm font-medium text-gray-400">Brush Size</label>
                        <span className="text-sm font-semibold text-gray-200 bg-gray-700 px-2 py-1 rounded w-14 text-center">{brushSize}</span>
                    </div>
                    <input id="brush-size" type="range" min="1" max="150" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label htmlFor="brush-hardness" className="block text-sm font-medium text-gray-400">Hardness</label>
                        <span className="text-sm font-semibold text-gray-200 bg-gray-700 px-2 py-1 rounded w-14 text-center">{brushHardness}%</span>
                    </div>
                    <input id="brush-hardness" type="range" min="0" max="100" value={brushHardness} onChange={(e) => setBrushHardness(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label htmlFor="brush-opacity" className="block text-sm font-medium text-gray-400">Opacity</label>
                        <span className="text-sm font-semibold text-gray-200 bg-gray-700 px-2 py-1 rounded w-14 text-center">{brushOpacity}%</span>
                    </div>
                    <input id="brush-opacity" type="range" min="1" max="100" value={brushOpacity} onChange={(e) => setBrushOpacity(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="flex-grow"></div>
                <div className="space-y-2">
                    <button onClick={handleClear} className="w-full bg-white/10 text-gray-200 font-semibold py-3 px-4 rounded-md transition-all hover:bg-white/20 active:scale-95">Clear Mask</button>
                    <button onClick={handleApply} className="w-full bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-px active:scale-95">Apply Mask</button>
                </div>
            </div>
            {/* Canvas Area */}
            <div ref={containerRef} className="flex-grow flex items-center justify-center relative bg-black/20 rounded-lg overflow-hidden">
                {baseImageSrc && (
                    <img
                        ref={imageRef}
                        src={baseImageSrc}
                        alt="Masking background"
                        className="max-w-full max-h-full object-contain pointer-events-none"
                        onLoad={resizeCanvas}
                    />
                )}
                <canvas
                    ref={canvasRef}
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${isCursorOverCanvas ? 'cursor-none' : ''}`}
                    onPointerDown={startDrawing}
                    onPointerMove={handlePointerMove}
                    onPointerUp={stopDrawing}
                    onPointerLeave={() => {
                        setIsDrawing(false);
                        setIsCursorOverCanvas(false);
                    }}
                    onPointerEnter={() => setIsCursorOverCanvas(true)}
                />
                {isCursorOverCanvas && cursorPosition && (
                    <div
                        className={`absolute pointer-events-none rounded-full transition-colors duration-100 ${
                            tool === 'brush'
                            ? 'bg-white/20 border-2 border-white'
                            : 'bg-transparent border-2 border-dashed border-gray-400'
                        }`}
                        style={{
                            left: `${cursorPosition.x}px`,
                            top: `${cursorPosition.y}px`,
                            width: `${brushSize}px`,
                            height: `${brushSize}px`,
                            transform: `translate(-50%, -50%)`,
                        }}
                    />
                )}
            </div>
        </div>
    </div>
  );
};

export default MaskEditor;