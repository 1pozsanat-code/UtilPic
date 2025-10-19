/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState } from 'react';
import { EyeIcon, EyeSlashIcon, TrashIcon, UploadIcon } from './icons.tsx';

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light';

export const blendModes: { name: string; value: BlendMode; description: string }[] = [
    { name: 'Normal', value: 'normal', description: 'Default mode. The top layer simply covers the layer below.' },
    { name: 'Multiply', value: 'multiply', description: 'Darkens the image by multiplying colors. Great for creating shadows.' },
    { name: 'Screen', value: 'screen', description: 'Lightens the image. The opposite of Multiply. Great for highlights.' },
    { name: 'Overlay', value: 'overlay', description: 'Combines Multiply and Screen to increase contrast.' },
    { name: 'Darken', value: 'darken', description: 'Compares pixels and keeps only the darkest of the two layers.' },
    { name: 'Lighten', value: 'lighten', description: 'Compares pixels and keeps only the lightest of the two layers.' },
    { name: 'Color Dodge', value: 'color-dodge', description: 'Brightens the base layer to reflect the blend layer, decreasing contrast.' },
    { name: 'Color Burn', value: 'color-burn', description: 'Darkens the base layer to reflect the blend layer, increasing contrast.' },
    { name: 'Hard Light', value: 'hard-light', description: 'A harsher version of Overlay. Uses Multiply for darks, Screen for lights.' },
    { name: 'Soft Light', value: 'soft-light', description: 'A softer, more subtle version of Overlay.' },
];

export type OverlaySettings = {
  overlayFile: File | null;
  opacity: number;
  size: number; // Percentage of base image width
  position: { x: number, y: number }; // Percentage (0-100) for top-left corner
  blendMode: BlendMode;
};

export interface OverlayLayer extends OverlaySettings {
  id: number;
  name: string;
  previewUrl: string;
  isVisible: boolean;
}

interface OverlayPanelProps {
  layers: OverlayLayer[];
  activeLayerId: number | null;
  onAddLayer: (file: File) => void;
  onDeleteLayer: (id: number) => void;
  onUpdateLayer: (id: number, settings: Partial<OverlayLayer>) => void;
  onSelectLayer: (id: number) => void;
  onToggleVisibility: (id: number) => void;
  onReorderLayers: (layers: OverlayLayer[]) => void;
  onApplyAll: () => void;
  isLoading: boolean;
}

// Sub-component for 2D position control
const PositionControl: React.FC<{
  position: { x: number; y: number };
  onUpdate: (newPosition: { x: number; y: number }) => void;
  disabled: boolean;
}> = ({ position, onUpdate, disabled }) => {
    const controlRef = useRef<HTMLDivElement>(null);

    const handlePositionChange = (e: React.MouseEvent | React.TouchEvent) => {
        if (!controlRef.current) return;
        const rect = controlRef.current.getBoundingClientRect();
        
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
        onUpdate({ x, y });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        handlePositionChange(e);

        const onMouseMove = (moveEvent: MouseEvent) => handlePositionChange(moveEvent as any);
        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };
    
    const handleTouchStart = (e: React.TouchEvent) => {
        if (disabled) return;
        e.preventDefault();
        handlePositionChange(e);

        const onTouchMove = (moveEvent: TouchEvent) => handlePositionChange(moveEvent as any);
        const onTouchEnd = () => {
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
        };
        
        window.addEventListener('touchmove', onTouchMove);
        window.addEventListener('touchend', onTouchEnd);
    };

    return (
        <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Position</label>
            <div
                ref={controlRef}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                className={`relative w-full aspect-square bg-gray-900/50 rounded-lg border border-gray-600 ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
                aria-label="Overlay position control"
                role="slider"
            >
                <div
                    style={{ left: `${position.x}%`, top: `${position.y}%` }}
                    className="absolute w-5 h-5 bg-blue-500 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-lg"
                />
            </div>
        </div>
    );
};


const OverlayPanel: React.FC<OverlayPanelProps> = ({
  layers,
  activeLayerId,
  onAddLayer,
  onDeleteLayer,
  onUpdateLayer,
  onSelectLayer,
  onToggleVisibility,
  onReorderLayers,
  onApplyAll,
  isLoading
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [draggedLayerId, setDraggedLayerId] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onAddLayer(e.target.files[0]);
    }
    // Reset file input to allow uploading the same file again
    e.target.value = '';
  };

  const activeLayer = layers.find(l => l.id === activeLayerId);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number, layerId: number) => {
    dragItem.current = index;
    setDraggedLayerId(layerId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const newLayers = [...layers];
      const draggedItemContent = newLayers.splice(dragItem.current, 1)[0];
      newLayers.splice(dragOverItem.current, 0, draggedItemContent);
      onReorderLayers(newLayers);
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggedLayerId(null);
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Layer List */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-gray-200">Layers</h3>
          <div
            className="flex-grow space-y-2 pr-2 overflow-y-auto max-h-80 bg-black/20 p-2 rounded-lg border border-gray-700"
            onDragOver={(e) => e.preventDefault()}
          >
            {layers.length > 0 ? (
              layers.map((layer, index) => (
                <div
                  key={layer.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index, layer.id)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelectLayer(layer.id)}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-grab active:cursor-grabbing border-2 transition-all ${
                    activeLayerId === layer.id
                      ? 'bg-blue-500/20 border-blue-500'
                      : 'bg-gray-700/50 border-transparent hover:bg-gray-700'
                  } ${draggedLayerId === layer.id ? 'opacity-40' : ''} ${
                    dragOverItem.current === index && draggedLayerId !== layer.id ? '!border-dashed !border-gray-400' : ''
                  }`}
                >
                  <img src={layer.previewUrl} alt={layer.name} className="w-12 h-12 object-cover rounded-md flex-shrink-0 bg-gray-800 pointer-events-none"/>
                  <span className="flex-grow text-sm text-gray-200 truncate pointer-events-none" title={layer.name}>{layer.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }} className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10" aria-label="Toggle Visibility">
                    {layer.isVisible ? <EyeIcon className="w-5 h-5"/> : <EyeSlashIcon className="w-5 h-5"/>}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteLayer(layer.id); }} className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-white/10" aria-label="Delete Layer">
                    <TrashIcon className="w-5 h-5"/>
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No layers yet. Add one!</p>
            )}
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-white/10 text-gray-200 font-semibold py-3 px-4 rounded-md transition-all hover:bg-white/20 active:scale-95 disabled:opacity-50">
            <UploadIcon className="w-5 h-5" /> Add Layer
          </button>
        </div>

        {/* Settings Panel */}
        <div className="lg:col-span-2">
          {activeLayer ? (
            <div className="bg-black/20 p-4 rounded-lg border border-gray-700 h-full flex flex-col gap-6">
              <h3 className="text-lg font-semibold text-gray-200">Layer Settings: <span className="text-blue-400 font-normal truncate">{activeLayer.name}</span></h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 flex-grow">
                  <div className="flex flex-col justify-start gap-6">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="opacity" className="block text-sm font-medium text-gray-400">Opacity</label>
                            <span className="text-sm font-semibold text-gray-200 bg-gray-700 px-2 py-1 rounded w-14 text-center">{Math.round(activeLayer.opacity * 100)}%</span>
                        </div>
                        <input
                            id="opacity" type="range" min="0" max="1" step="0.01" value={activeLayer.opacity}
                            onChange={(e) => onUpdateLayer(activeLayer.id, { opacity: Number(e.target.value) })}
                            disabled={isLoading} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="size" className="block text-sm font-medium text-gray-400">Size</label>
                            <span className="text-sm font-semibold text-gray-200 bg-gray-700 px-2 py-1 rounded w-14 text-center">{activeLayer.size}%</span>
                        </div>
                        <input
                            id="size" type="range" min="1" max="200" value={activeLayer.size}
                            onChange={(e) => onUpdateLayer(activeLayer.id, { size: Number(e.target.value) })}
                            disabled={isLoading} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <div>
                        <label htmlFor="blend-mode" className="block text-sm font-medium text-gray-400 mb-1">Blend Mode</label>
                        <select
                            id="blend-mode"
                            value={activeLayer.blendMode}
                            onChange={(e) => onUpdateLayer(activeLayer.id, { blendMode: e.target.value as BlendMode })}
                            disabled={isLoading}
                            className="w-full bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                        >
                            {blendModes.map(mode => (
                                <option key={mode.value} value={mode.value}>{mode.name}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-2 min-h-[2rem]">
                            {blendModes.find(b => b.value === activeLayer.blendMode)?.description || ''}
                        </p>
                    </div>
                  </div>
                  <div>
                    <PositionControl
                        position={activeLayer.position}
                        onUpdate={(newPos) => onUpdateLayer(activeLayer.id, { position: newPos })}
                        disabled={isLoading}
                    />
                  </div>
              </div>
            </div>
          ) : (
            <div className="bg-black/20 p-4 rounded-lg border border-dashed border-gray-700 h-full flex items-center justify-center">
              <p className="text-gray-500">Select a layer to edit its properties.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Apply Button */}
      <button
        onClick={onApplyAll}
        disabled={isLoading || layers.length === 0}
        className="w-full mt-2 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-lg disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        Apply All Layers
      </button>
    </div>
  );
};

export default OverlayPanel;