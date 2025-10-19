/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo } from 'react';
import { EyedropperWBIcon, EyedropperWhiteIcon, EyedropperBlackIcon, SparklesIcon, SharpenIcon, GrainIcon } from './icons.tsx';

export type ColorPickerType = 'white' | 'black' | 'gray';

interface AdjustmentPanelProps {
  onApplyAdjustment: (prompt: string) => void;
  onApplyAutoEnhance: () => void;
  onApplySharpen: (intensity: string) => void;
  onApplyGrain: (intensity: string) => void;
  isLoading: boolean;
  onSetActivePicker: (picker: ColorPickerType | null) => void;
  activePicker: ColorPickerType | null;
}

const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({ onApplyAdjustment, onApplyAutoEnhance, onApplySharpen, onApplyGrain, isLoading, onSetActivePicker, activePicker }) => {
  // State for sliders
  const [exposure, setExposure] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [highlights, setHighlights] = useState(0);
  const [shadows, setShadows] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [temperature, setTemperature] = useState(0);
  const [blur, setBlur] = useState(0);

  // State for Color Balance
  const [highlightsRed, setHighlightsRed] = useState(0);
  const [highlightsGreen, setHighlightsGreen] = useState(0);
  const [highlightsBlue, setHighlightsBlue] = useState(0);
  const [midtonesRed, setMidtonesRed] = useState(0);
  const [midtonesGreen, setMidtonesGreen] = useState(0);
  const [midtonesBlue, setMidtonesBlue] = useState(0);
  const [shadowsRed, setShadowsRed] = useState(0);
  const [shadowsGreen, setShadowsGreen] = useState(0);
  const [shadowsBlue, setShadowsBlue] = useState(0);

  // State for custom prompt
  const [customPrompt, setCustomPrompt] = useState('');

  const presets = [
    { name: 'Blur Background', prompt: 'Apply a realistic depth-of-field effect, making the background blurry while keeping the main subject in sharp focus.', description: 'Creates a "Portrait Mode" effect by blurring the background.' },
    { name: 'Enhance Details', prompt: 'Slightly enhance the sharpness and details of the image without making it look unnatural.', description: 'Subtly sharpens the image to bring out fine textures.' },
    { name: 'Warmer Lighting', prompt: 'Adjust the color temperature to give the image warmer, golden-hour style lighting.', description: 'Gives the photo a warm, sunny, "golden hour" feel.' },
    { name: 'Studio Light', prompt: 'Add dramatic, professional studio lighting to the main subject.', description: 'Adds dramatic lighting to make the main subject pop.' },
    { name: 'Boost Color Vibrancy', prompt: 'Subtly increase the color saturation and vibrancy across the image for a more vivid, colorful look.', description: 'Makes colors pop without looking unnatural.' },
    { name: 'Vignette', prompt: 'Apply a subtle vignette effect to the image, darkening the edges slightly to draw focus to the center.', description: 'Darkens the corners of the photo to draw focus to the subject.' },
  ];

  const handlePresetClick = (prompt: string) => {
    if (!isLoading) {
      onApplyAdjustment(prompt);
    }
  };

  const handleCustomPromptApply = () => {
    if (customPrompt.trim() && !isLoading) {
      onApplyAdjustment(customPrompt);
    }
  };

  const handleResetSliders = () => {
    setExposure(0);
    setBrightness(0);
    setContrast(0);
    setHighlights(0);
    setShadows(0);
    setSaturation(0);
    setTemperature(0);
    setBlur(0);
  };
  
  const isSliderChanged = useMemo(() => 
    exposure !== 0 || brightness !== 0 || contrast !== 0 || highlights !== 0 || shadows !== 0 || saturation !== 0 || temperature !== 0 || blur !== 0, 
    [exposure, brightness, contrast, highlights, shadows, saturation, temperature, blur]
  );

  const handleApplySliders = () => {
    if (isLoading || !isSliderChanged) return;

    const promptParts: string[] = [];

    if (exposure !== 0) promptParts.push(`adjust exposure by ${exposure > 0 ? '+' : ''}${exposure}`);
    if (brightness !== 0) promptParts.push(`adjust brightness by ${brightness > 0 ? '+' : ''}${brightness}`);
    
    if (contrast !== 0) {
      const action = contrast > 0 ? 'Increase' : 'Decrease';
      promptParts.push(`${action.toLowerCase()} contrast by ${Math.abs(contrast)}`);
    }

    if (highlights !== 0) promptParts.push(`adjust highlights by ${highlights > 0 ? '+' : ''}${highlights}`);
    if (shadows !== 0) promptParts.push(`adjust shadows by ${shadows > 0 ? '+' : ''}${shadows}`);
    if (saturation !== 0) promptParts.push(`adjust saturation by ${saturation > 0 ? '+' : ''}${saturation}`);
    
    if (temperature !== 0) {
        const tempDirection = temperature > 0 ? 'warmer' : 'cooler';
        promptParts.push(`make the color temperature ${Math.abs(temperature)}% ${tempDirection}`);
    }

    if (blur > 0) {
      promptParts.push(`apply a blur effect with an intensity of ${blur}`);
    } else if (blur < 0) {
      promptParts.push(`reduce blur (sharpen) with an intensity of ${Math.abs(blur)}`);
    }

    if (promptParts.length > 0) {
      // Capitalize the first letter of the first part.
      promptParts[0] = promptParts[0].charAt(0).toUpperCase() + promptParts[0].slice(1);
      
      // Join them with commas and 'and' for the last one.
      const prompt = promptParts.length > 1 
          ? `${promptParts.slice(0, -1).join(', ')} and ${promptParts.slice(-1)}`
          : `${promptParts[0]}`;

      onApplyAdjustment(`${prompt}.`);
    }
  };

  const isColorBalanceChanged = useMemo(() => 
    highlightsRed !== 0 || highlightsGreen !== 0 || highlightsBlue !== 0 ||
    midtonesRed !== 0 || midtonesGreen !== 0 || midtonesBlue !== 0 ||
    shadowsRed !== 0 || shadowsGreen !== 0 || shadowsBlue !== 0,
    [highlightsRed, highlightsGreen, highlightsBlue, midtonesRed, midtonesGreen, midtonesBlue, shadowsRed, shadowsGreen, shadowsBlue]
  );

  const handleResetColorBalance = () => {
    setHighlightsRed(0);
    setHighlightsGreen(0);
    setHighlightsBlue(0);
    setMidtonesRed(0);
    setMidtonesGreen(0);
    setMidtonesBlue(0);
    setShadowsRed(0);
    setShadowsGreen(0);
    setShadowsBlue(0);
  };

  const handleApplyColorBalance = () => {
    if (isLoading || !isColorBalanceChanged) return;

    const promptParts = [];
    const tones = {
      Highlights: { Red: highlightsRed, Green: highlightsGreen, Blue: highlightsBlue },
      Midtones: { Red: midtonesRed, Green: midtonesGreen, Blue: midtonesBlue },
      Shadows: { Red: shadowsRed, Green: shadowsGreen, Blue: shadowsBlue },
    };

    for (const [toneName, colors] of Object.entries(tones)) {
      const changes = [];
      if (colors.Red !== 0) changes.push(`${colors.Red > 0 ? 'add' : 'remove'} ${Math.abs(colors.Red)}% Red`);
      if (colors.Green !== 0) changes.push(`${colors.Green > 0 ? 'add' : 'remove'} ${Math.abs(colors.Green)}% Green`);
      if (colors.Blue !== 0) changes.push(`${colors.Blue > 0 ? 'add' : 'remove'} ${Math.abs(colors.Blue)}% Blue`);

      if (changes.length > 0) {
        promptParts.push(`in the ${toneName}, ${changes.join(', ')}`);
      }
    }
    
    if (promptParts.length > 0) {
      const fullPrompt = `Perform a precise color balance adjustment. ${promptParts.join('; ')}. The changes should be subtle and maintain a photorealistic look.`;
      onApplyAdjustment(fullPrompt);
    }
  };


  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-6 animate-fade-in backdrop-blur-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sliders and custom prompt */}
        <div className="space-y-4 bg-black/20 p-4 rounded-lg border border-gray-700/50">
           <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-300">Light & Color</h3>
            <button
              onClick={handleResetSliders}
              disabled={isLoading || !isSliderChanged}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              Reset
            </button>
           </div>
          {/* Slider Controls */}
          <div className="space-y-3">
            {[
              { label: 'Exposure', value: exposure, setter: setExposure },
              { label: 'Brightness', value: brightness, setter: setBrightness },
              { label: 'Contrast', value: contrast, setter: setContrast },
              { label: 'Highlights', value: highlights, setter: setHighlights },
              { label: 'Shadows', value: shadows, setter: setShadows },
              { label: 'Saturation', value: saturation, setter: setSaturation },
              { label: 'Temperature', value: temperature, setter: setTemperature },
              { label: 'Blur', value: blur, setter: setBlur },
            ].map(({label, value, setter}) => (
              <div key={label}>
                <div className="flex justify-between items-center text-sm mb-1">
                    <label htmlFor={label} className="font-medium text-gray-400">{label}</label>
                    <span className="text-gray-300 bg-gray-700/80 px-2 py-0.5 rounded-md">{value}</span>
                </div>
                <input id={label} type="range" min="-50" max="50" value={value} onChange={(e) => setter(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" disabled={isLoading} />
              </div>
            ))}
          </div>

           <button
            onClick={handleApplySliders}
            disabled={isLoading || !isSliderChanged}
            className="w-full mt-2 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 ease-in-out shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
          >
            Apply Sliders
          </button>
          
          <div className="relative mt-4">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gray-800/50 px-2 text-sm text-gray-500 backdrop-blur-sm">Or</span>
            </div>
          </div>

           {/* Color Balance Section */}
            <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-300">Color Balance</h3>
                    <button
                        onClick={handleResetColorBalance}
                        disabled={isLoading || !isColorBalanceChanged}
                        className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    >
                        Reset
                    </button>
                </div>
                
                {/* Highlights */}
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-400">Highlights</h4>
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-red-500/80"></span>
                        <input type="range" min="-100" max="100" value={highlightsRed} onChange={(e) => setHighlightsRed(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500" disabled={isLoading} />
                        <span className="text-gray-300 w-12 text-center bg-gray-700/80 px-2 py-0.5 rounded-md text-xs">{highlightsRed}</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-green-500/80"></span>
                        <input type="range" min="-100" max="100" value={highlightsGreen} onChange={(e) => setHighlightsGreen(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500" disabled={isLoading} />
                        <span className="text-gray-300 w-12 text-center bg-gray-700/80 px-2 py-0.5 rounded-md text-xs">{highlightsGreen}</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-blue-500/80"></span>
                        <input type="range" min="-100" max="100" value={highlightsBlue} onChange={(e) => setHighlightsBlue(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" disabled={isLoading} />
                        <span className="text-gray-300 w-12 text-center bg-gray-700/80 px-2 py-0.5 rounded-md text-xs">{highlightsBlue}</span>
                    </div>
                </div>

                {/* Midtones */}
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-400">Midtones</h4>
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-red-500/80"></span>
                        <input type="range" min="-100" max="100" value={midtonesRed} onChange={(e) => setMidtonesRed(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500" disabled={isLoading} />
                        <span className="text-gray-300 w-12 text-center bg-gray-700/80 px-2 py-0.5 rounded-md text-xs">{midtonesRed}</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-green-500/80"></span>
                        <input type="range" min="-100" max="100" value={midtonesGreen} onChange={(e) => setMidtonesGreen(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500" disabled={isLoading} />
                        <span className="text-gray-300 w-12 text-center bg-gray-700/80 px-2 py-0.5 rounded-md text-xs">{midtonesGreen}</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-blue-500/80"></span>
                        <input type="range" min="-100" max="100" value={midtonesBlue} onChange={(e) => setMidtonesBlue(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" disabled={isLoading} />
                        <span className="text-gray-300 w-12 text-center bg-gray-700/80 px-2 py-0.5 rounded-md text-xs">{midtonesBlue}</span>
                    </div>
                </div>

                {/* Shadows */}
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-400">Shadows</h4>
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-red-500/80"></span>
                        <input type="range" min="-100" max="100" value={shadowsRed} onChange={(e) => setShadowsRed(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500" disabled={isLoading} />
                        <span className="text-gray-300 w-12 text-center bg-gray-700/80 px-2 py-0.5 rounded-md text-xs">{shadowsRed}</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-green-500/80"></span>
                        <input type="range" min="-100" max="100" value={shadowsGreen} onChange={(e) => setShadowsGreen(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500" disabled={isLoading} />
                        <span className="text-gray-300 w-12 text-center bg-gray-700/80 px-2 py-0.5 rounded-md text-xs">{shadowsGreen}</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-blue-500/80"></span>
                        <input type="range" min="-100" max="100" value={shadowsBlue} onChange={(e) => setShadowsBlue(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" disabled={isLoading} />
                        <span className="text-gray-300 w-12 text-center bg-gray-700/80 px-2 py-0.5 rounded-md text-xs">{shadowsBlue}</span>
                    </div>
                </div>

                <button
                    onClick={handleApplyColorBalance}
                    disabled={isLoading || !isColorBalanceChanged}
                    className="w-full mt-2 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 ease-in-out shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                >
                    Apply Color Balance
                </button>
            </div>

          <div className="relative mt-4">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gray-800/50 px-2 text-sm text-gray-500 backdrop-blur-sm">Or</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe a custom adjustment"
                className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-sm"
                disabled={isLoading}
              />
              <button onClick={handleCustomPromptApply} disabled={isLoading || !customPrompt.trim()} className="bg-white/10 text-gray-200 font-semibold py-3 px-4 rounded-md transition-all hover:bg-white/20 active:scale-95 disabled:opacity-50 text-sm">
                Apply
              </button>
          </div>
        </div>

        {/* Presets and Tools */}
        <div className="space-y-4">
            <div className="space-y-2 bg-black/20 p-4 rounded-lg border border-gray-700/50">
                <h3 className="text-lg font-semibold text-gray-300">Automatic Tools</h3>
                <button
                    onClick={onApplyAutoEnhance}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 text-center bg-white/10 text-gray-200 font-semibold py-3 px-4 rounded-md transition-all hover:bg-white/20 active:scale-95 disabled:opacity-50 text-base"
                >
                    <SparklesIcon className="w-5 h-5" />
                    Auto Enhance
                </button>
            </div>

            <div className="space-y-2 bg-black/20 p-4 rounded-lg border border-gray-700/50">
                <h3 className="text-lg font-semibold text-gray-300">Levels & White Balance</h3>
                <p className="text-xs text-gray-400 -mt-1">Use eyedroppers to correct colors and tones.</p>
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => onSetActivePicker('white')}
                        disabled={isLoading}
                        className={`flex flex-col items-center justify-center gap-1 text-center font-semibold py-2 px-2 rounded-md transition-all active:scale-95 disabled:opacity-50 text-xs ${activePicker === 'white' ? 'bg-blue-600 text-white ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
                    >
                        <EyedropperWhiteIcon className="w-5 h-5" />
                        White Point
                    </button>
                    <button
                        onClick={() => onSetActivePicker('gray')}
                        disabled={isLoading}
                        className={`flex flex-col items-center justify-center gap-1 text-center font-semibold py-2 px-2 rounded-md transition-all active:scale-95 disabled:opacity-50 text-xs ${activePicker === 'gray' ? 'bg-blue-600 text-white ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
                    >
                        <EyedropperWBIcon className="w-5 h-5" />
                        Gray Point
                    </button>
                    <button
                        onClick={() => onSetActivePicker('black')}
                        disabled={isLoading}
                        className={`flex flex-col items-center justify-center gap-1 text-center font-semibold py-2 px-2 rounded-md transition-all active:scale-95 disabled:opacity-50 text-xs ${activePicker === 'black' ? 'bg-blue-600 text-white ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
                    >
                        <EyedropperBlackIcon className="w-5 h-5" />
                        Black Point
                    </button>
                </div>
            </div>

          <div className="space-y-2 bg-black/20 p-4 rounded-lg border border-gray-700/50">
            <div className="flex items-center gap-2">
              <SharpenIcon className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-300">AI Sharpen</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {['Subtle', 'Natural', 'High'].map(intensity => (
                    <button
                        key={intensity}
                        onClick={() => onApplySharpen(intensity)}
                        disabled={isLoading}
                        className="text-center bg-white/10 text-gray-200 font-semibold py-3 px-2 rounded-md transition-all hover:bg-white/20 active:scale-95 disabled:opacity-50 text-sm"
                    >
                        {intensity}
                    </button>
                ))}
            </div>
          </div>

          <div className="space-y-2 bg-black/20 p-4 rounded-lg border border-gray-700/50">
            <div className="flex items-center gap-2">
              <GrainIcon className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-300">AI Grain</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {['Subtle', 'Medium', 'High'].map(intensity => (
                    <button
                        key={intensity}
                        onClick={() => onApplyGrain(intensity)}
                        disabled={isLoading}
                        className="text-center bg-white/10 text-gray-200 font-semibold py-3 px-2 rounded-md transition-all hover:bg-white/20 active:scale-95 disabled:opacity-50 text-sm"
                    >
                        {intensity}
                    </button>
                ))}
            </div>
          </div>
          
          <div className="space-y-2 bg-black/20 p-4 rounded-lg border border-gray-700/50">
            <h3 className="text-lg font-semibold text-gray-300">Presets</h3>
            <div className="grid grid-cols-1 gap-2">
                {presets.map(preset => (
                <div key={preset.name} className="relative group">
                    <button
                        onClick={() => handlePresetClick(preset.prompt)}
                        disabled={isLoading}
                        className="w-full text-left bg-white/5 text-gray-300 font-medium py-3 px-4 rounded-md transition-all hover:bg-white/10 active:scale-[0.98] disabled:opacity-50 text-base"
                    >
                        {preset.name}
                    </button>
                     <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-max max-w-xs px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 shadow-lg">
                        {preset.description}
                        <div className="absolute top-1/2 -translate-y-1/2 right-full w-0 h-0 border-y-4 border-y-transparent border-r-4 border-r-gray-900"></div>
                    </div>
                </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdjustmentPanel;