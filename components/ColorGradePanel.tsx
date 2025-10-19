/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { DocumentDuplicateIcon } from './icons.tsx';

interface ColorGradePanelProps {
  onApplyColorGrade: (prompt: string) => void;
  isLoading: boolean;
  onBatchApply: (prompt: string, name: string) => void;
}

const ColorGradePanel: React.FC<ColorGradePanelProps> = ({ onApplyColorGrade, isLoading, onBatchApply }) => {
  const [selectedPreset, setSelectedPreset] = useState<{ name: string; prompt: string; } | null>(null);

  const presets = [
    // Film & TV Inspired
    { name: 'Blockbuster', prompt: "Apply a classic 'teal and orange' blockbuster color grade. Push skin tones and warm areas towards orange, and shift shadows, skies, and cool areas towards teal/cyan. Increase overall saturation for a vibrant, high-impact look.", description: 'The popular teal & orange look from modern action movies.' },
    { name: 'Digital Matrix', prompt: "Apply a 'Matrix' style color grade. Give the image a strong green tint, especially in the midtones and shadows. Increase the contrast for deep, crushed blacks and bright highlights. The overall feel should be futuristic and digital.", description: 'Futuristic green tint with high contrast, inspired by The Matrix.' },
    { name: 'Whimsical Paris', prompt: "Apply a whimsical 'Amélie' style color grade. Heavily saturate the reds, greens, and golden yellows. Give the entire image a warm, magical, and slightly surreal feel. Ensure skin tones look healthy and rosy.", description: 'Saturated reds and greens for a magical, romantic feel.' },
    { name: '70s Grit', prompt: "Apply a gritty, 1970s 'Joker' film look. Desaturate the colors, especially blues. Introduce a subtle, dirty yellow/green cast to the midtones. Increase film grain and slightly crush the blacks for a raw, unsettling aesthetic.", description: 'A desaturated, gritty look reminiscent of 70s cinema.' },
    { name: 'Dystopian Haze', prompt: "Apply a 'Blade Runner 2049' color grade. Create a dense, atmospheric look with a strong orange and yellow haze. Desaturate blues and greens. The highlights should bloom softly, and the overall image should feel dusty and dystopian.", description: 'Atmospheric orange and yellow haze for a sci-fi look.' },
    { name: 'Middle Earth', prompt: "Apply a 'Lord of the Rings' style color grade. Desaturate the colors for an epic, slightly grim feel. Introduce a subtle blue-green tint to the shadows and enhance earthy tones like greens and browns. The result should feel cinematic and ancient.", description: 'Desaturated, earthy tones for an epic fantasy feel.' },
    { name: 'Pastel Storybook', prompt: "Apply a 'Wes Anderson' inspired color grade. Shift the palette towards pastel colors, particularly yellows, pinks, and light blues. Increase saturation but keep the tones soft. Give the image a clean, symmetrical, and slightly quirky storybook feel.", description: 'A soft, saturated pastel palette for a quirky, storybook look.' },
    { name: 'Cool Noir', prompt: 'Apply a cool, high-contrast noir color grade. Desaturate the colors significantly, pushing the image towards monochrome but retaining a strong blue or cyan cast in the shadows and midtones. Deepen the blacks and enhance highlights to create a dramatic, mysterious mood.', description: 'High-contrast, desaturated blues for a mysterious vibe.' },
    { name: 'Winterfell Saga', prompt: "Apply an epic 'Game of Thrones' color grade. Desaturate the colors slightly, give the shadows a cool, deep blue tint, and enhance earthy tones like greens and browns. The look should be gritty, cinematic, and suitable for a fantasy epic.", description: 'Cool, desaturated tones with gritty textures for a fantasy epic.' },
    { name: 'Apocalypse', prompt: "Apply a gritty 'The Walking Dead' style color grade. Heavily desaturate the colors and apply a faded, greenish-brown tint. Increase the contrast for harsh highlights and deep shadows. Add a significant amount of film grain to create a raw, post-apocalyptic feel.", description: 'A gritty, faded, and desaturated look for a post-apocalyptic world.' },
    { name: 'Heisenberg', prompt: "Apply a high-contrast 'Breaking Bad' color grade. Push the highlights and midtones towards a distinct yellow and green hue, reminiscent of the show's desert scenes. Increase saturation in these tones while keeping blues slightly muted. The result should be bold and tense.", description: 'High-contrast with a signature yellow-green tint for a tense, dramatic look.' },
    { name: 'Upside Down', prompt: "Apply a nostalgic 'Stranger Things' 80s film look. Give the image soft, blooming highlights and slightly lifted shadows. Introduce a warm, analog feel overall, but push blues towards cyan and reds/pinks towards magenta, especially in neon lights. Add a fine layer of film grain.", description: 'A nostalgic 80s film look with warm tones and neon glows.' },
    { name: 'Industrial Grit', prompt: "Apply a dark, moody 'Peaky Blinders' color grade. Heavily desaturate the image and crush the blacks for deep shadows. Introduce a cool, blue-grey tint to the overall image, but allow highlights from light sources like fire or lamps to be a contrasting warm orange. The look should be dark, smoky, and industrial.", description: 'A dark, desaturated, and smoky look with cool tones and warm highlights.' },
    { name: 'Teenage Dream', prompt: "Apply a dreamlike 'Euphoria' color grade. Heavily saturate jewel tones, especially deep blues, purples, and pinks. Give the image soft, glowing highlights (halation) and deep, clean shadows. The overall aesthetic should be stylish, moody, and highly stylized, like a dream.", description: 'Saturated blues, purples, and pinks with glowing highlights for a dreamlike look.' },

    // General Cinematic & Vintage
    { name: 'Cinematic Warm', prompt: 'Apply a cinematic warm color grade. Enhance the golden hour tones, introduce warm, soft highlights, and add a subtle teal tint to the shadows for a classic blockbuster look. Slightly desaturate the overall image to make it feel more filmic.', description: 'Golden tones with teal shadows for a classic movie look.' },
    { name: 'Faded Film', prompt: "Apply a nostalgic, faded film look. Mute the overall color saturation, lift the black point so there are no pure blacks (giving a slightly washed-out feel), and add a subtle, warm color cast to the entire image. The result should feel soft and reminiscent of old film stock.", description: 'Muted, soft colors with lifted blacks for a nostalgic feel.' },
    { name: 'Vintage Sepia', prompt: 'Apply a classic vintage sepia tone. Shift the entire color palette towards warm brown and yellow hues. Reduce the overall contrast for a faded, aged photograph look and add a very subtle film grain effect for authenticity.', description: 'A classic, warm, aged photograph effect.' },
    { name: 'Cyberpunk Neon', prompt: "Apply a vibrant cyberpunk neon color grade. Introduce bright, saturated magenta and cyan tones, especially into the highlights and artificial light sources. Deepen the shadows and give them a cool, dark blue tint to make the neon colors pop.", description: 'Vibrant magenta and cyan glows with dark shadows.' },
  ];
  
  const handleApply = () => {
    if (selectedPreset) {
      onApplyColorGrade(selectedPreset.prompt);
    }
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Apply a Cinematic Color Grade</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
        {presets.map(preset => (
           <div key={preset.name} className="relative group">
            <button
              onClick={() => setSelectedPreset(preset)}
              disabled={isLoading}
              className={`w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed ${selectedPreset?.prompt === preset.prompt ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : ''}`}
            >
              {preset.name}
            </button>
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 w-max max-w-xs left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 shadow-lg">
              {preset.description}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
            </div>
          </div>
        ))}
      </div>
      
      {selectedPreset && (
        <div className="animate-fade-in flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={handleApply}
            className="flex-grow bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
            disabled={isLoading || !selectedPreset.prompt.trim()}
          >
            Apply Color Grade
          </button>
          <button
              onClick={() => onBatchApply(selectedPreset.prompt, selectedPreset.name)}
              className="flex-shrink-0 flex items-center justify-center gap-2 bg-white/10 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 active:scale-95 disabled:opacity-50"
              disabled={isLoading}
              title="Apply this color grade to multiple images"
          >
              <DocumentDuplicateIcon className="w-5 h-5" />
              Batch
          </button>
        </div>
      )}
    </div>
  );
};

export default ColorGradePanel;
