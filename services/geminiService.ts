

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Modality, Type, type GenerateContentResponse } from '@google/genai';

// Initialize the Gemini client
// FIX: Correctly initialize GoogleGenAI with a named apiKey parameter.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to convert a File to a GenerativePart
const fileToGenerativePart = async (file: File) => {
    const base64EncodedData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    return {
        inlineData: {
            data: base64EncodedData,
            mimeType: file.type,
        },
    };
};

// Helper to extract base64 from a Gemini response and format as a data URL
const extractImageDataUrl = (response: GenerateContentResponse): string => {
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            return `data:${mimeType};base64,${part.inlineData.data}`;
        }
    }
    // Check for safety ratings / blocked response
    const blockReason = response.candidates?.[0]?.finishReason;
    if (blockReason === 'SAFETY' || blockReason === 'RECITATION' || blockReason === 'OTHER') {
        const safetyRatings = response.candidates?.[0]?.safetyRatings;
        let reason = `Request was blocked due to ${blockReason}.`;
        if (safetyRatings && safetyRatings.length > 0) {
            reason += ` Categories: ${safetyRatings.map(r => r.category).join(', ')}.`;
        }
        throw new Error(reason + " Please try a different image or a more direct prompt. You can learn more by reading Google's Generative AI Prohibited Use Policy.");
    }
    throw new Error('No image data found in the response, and the request was not blocked for safety reasons.');
};


// --- TYPE DEFINITIONS ---

export type Face = {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type SuggestionAnalysis = {
  image_type: string;
  characteristics: string[];
  mood: string;
};


// --- API FUNCTIONS ---

/**
 * Analyzes an image to suggest potential edits.
 */
export const analyzeImageForSuggestions = async (image: File): Promise<SuggestionAnalysis> => {
  const imagePart = await fileToGenerativePart(image);
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: {
      parts: [
        imagePart,
        { text: 'Analyze this image and provide a JSON object with `image_type`, `characteristics`, and `mood`.' }
      ]
    },
    config: {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                image_type: { type: Type.STRING, description: 'The type of image.', enum: ["portrait", "group_photo", "landscape", "product_shot", "old_photo", "other"]},
                characteristics: { type: Type.ARRAY, items: { type: Type.STRING, description: 'A characteristic of the image.', enum: ["blurry", "low_light", "damaged", "muted_colors", "other"] } },
                mood: { type: Type.STRING, description: 'A short descriptive string about the mood.' }
            },
            required: ['image_type', 'characteristics', 'mood']
        }
    }
  });

  const jsonText = response.text.trim();
  try {
      return JSON.parse(jsonText);
  } catch(e) {
      console.error("Failed to parse suggestion analysis JSON:", jsonText, e);
      throw new Error("Could not analyze image for suggestions.");
  }
};

/**
 * Detects all faces in an image and returns their bounding boxes.
 */
export const detectFaces = async (image: File): Promise<Face[]> => {
    const imagePart = await fileToGenerativePart(image);
    const prompt = `Analyze the image and provide a JSON array of bounding boxes for every face detected. Each object in the array should have a "box" property with "x", "y", "width", and "height" as normalized values (0-1). If no faces are found, return an empty array.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        box: {
                            type: Type.OBJECT,
                            properties: {
                                x: { type: Type.NUMBER },
                                y: { type: Type.NUMBER },
                                width: { type: Type.NUMBER },
                                height: { type: Type.NUMBER },
                            },
                            required: ['x', 'y', 'width', 'height']
                        }
                    },
                    required: ['box']
                }
            }
        }
    });

    const jsonText = response.text.trim();
    try {
        const faces = JSON.parse(jsonText);
        if (Array.isArray(faces)) {
            return faces;
        }
        console.warn("Face detection returned non-array:", faces);
        return [];
    } catch (e) {
        console.error("Failed to parse face detection JSON:", jsonText, e);
        return [];
    }
};

/**
 * A generic function to apply a full-image effect and return a data URL.
 */
const applyFullImageEffect = async (image: File, prompt: string, model: string = 'gemini-2.5-flash-image'): Promise<string> => {
    const imagePart = await fileToGenerativePart(image);
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [imagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    return extractImageDataUrl(response);
};

/**
 * Applies a generative edit to an image based on a text prompt and optional mask/hotspot.
 */
export const generateEditedImage = async (
  image: File, 
  prompt: string, 
  hotspot: { x: number, y: number } | null,
  mask?: File
): Promise<string> => {
    const imagePart = await fileToGenerativePart(image);
    const parts: any[] = [imagePart];

    let fullPrompt = `Edit this image based on the following instruction: "${prompt}".`;
    if (hotspot && !mask) {
        fullPrompt += ` The edit should be centered around the point (${hotspot.x}, ${hotspot.y}) in natural image coordinates. The change should be localized and blend seamlessly with the rest of the image.`;
    } else if (mask) {
        // The mask is expected to be black and white. White is the area to edit.
        const maskPart = await fileToGenerativePart(mask);
        parts.push(maskPart);
        fullPrompt += ` The provided mask indicates the area to apply the edit to. The changes should be confined to the white region of the mask and blend naturally at the edges.`;
    }

    parts.push({ text: fullPrompt });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    
    return extractImageDataUrl(response);
};

/**
 * Applies a filter to an image.
 */
export const generateFilteredImage = (image: File, filterPrompt: string): Promise<string> => {
    const fullPrompt = `Apply a filter to this image. The filter is described as: "${filterPrompt}". The result should be a full-frame, photorealistic image with the described filter applied consistently across it.`;
    return applyFullImageEffect(image, fullPrompt);
};

/**
 * Applies a color grade to an image.
 */
export const generateColorGradedImage = (image: File, gradePrompt: string): Promise<string> => {
    const fullPrompt = `Apply a color grade to this image. The color grade is described as: "${gradePrompt}". The result should be a full-frame, photorealistic image with the described color grade applied consistently across it.`;
    return applyFullImageEffect(image, fullPrompt);
};

/**
 * Applies a general adjustment to an image.
 */
export const generateAdjustedImage = (image: File, adjustmentPrompt: string): Promise<string> => {
    const fullPrompt = `Apply an adjustment to this image. The adjustment is: "${adjustmentPrompt}". The result should be a full-frame, photorealistic image with the described adjustment applied consistently.`;
    return applyFullImageEffect(image, fullPrompt);
};

/**
 * Sharpens an image.
 */
export const generateSharpenedImage = (image: File, intensity: string): Promise<string> => {
    const fullPrompt = `Apply a sharpening effect to the entire image. The desired intensity is '${intensity}'. The result should look natural and not over-sharpened.`;
    return applyFullImageEffect(image, fullPrompt);
};

/**
 * Adds grain to an image.
 */
export const generateGrainImage = (image: File, intensity: string): Promise<string> => {
    const fullPrompt = `Add a photorealistic film grain effect to the entire image. The desired intensity is '${intensity}'. The grain should be subtle and look authentic.`;
    return applyFullImageEffect(image, fullPrompt);
};

/**
 * Automatically corrects the orientation of an image.
 */
export const generateCorrectedOrientation = (image: File): Promise<string> => {
    const fullPrompt = `Analyze and correct the orientation of this image. If it is tilted, straighten it. If it is sideways or upside down, rotate it to be upright. The result should be a correctly oriented image with the background filled in intelligently if rotation occurs.`;
    return applyFullImageEffect(image, fullPrompt);
};

/**
 * Rotates an image by 90 degrees.
 */
export const generateRotatedImage = (image: File, direction: 'clockwise' | 'counter-clockwise'): Promise<string> => {
    const degrees = direction === 'clockwise' ? 90 : -90;
    const fullPrompt = `Rotate the entire image exactly ${degrees} degrees ${direction}. Fill any empty space created by the rotation with context-aware, photorealistic content.`;
    return applyFullImageEffect(image, fullPrompt);
};

/**
 * Upscales an image to a higher resolution.
 */
export const generateUpscaledImage = async (
    image: File,
    scale: number,
    detailIntensity: string,
    currentWidth: number,
    currentHeight: number
): Promise<string> => {
    const targetWidth = Math.round(currentWidth * scale);
    const targetHeight = Math.round(currentHeight * scale);

    const fullPrompt = `Upscale this image to a resolution of ${targetWidth}x${targetHeight} pixels. The detail enhancement intensity should be '${detailIntensity}'. Generate new, realistic details that are consistent with the original image content.`;
    return applyFullImageEffect(image, fullPrompt);
};

/**
 * Applies professional retouching to selected faces.
 */
export const generateRetouchedFace = async (
    image: File,
    settings: { skinSmoothing: number; eyeBrightening: number; selectedFaces: Face[] }
): Promise<string> => {
    const prompt = `Perform a professional facial retouch on the provided image. Apply the following adjustments ONLY to the faces specified by the bounding boxes:
- Skin Smoothing: ${settings.skinSmoothing}% intensity (natural texture should be preserved).
- Eye Brightening: ${settings.eyeBrightening}% intensity (subtle and realistic).

The adjustments must be seamless and photorealistic. The rest of the image outside the bounding boxes must remain untouched.

Bounding boxes for faces to edit: ${JSON.stringify(settings.selectedFaces.map(f => f.box))}`;

    return applyFullImageEffect(image, prompt);
};

/**
 * Restores old or damaged photos.
 */
export const generateRestoredImage = (image: File): Promise<string> => {
    const prompt = `Restore this old or damaged photo. Repair any scratches, tears, or creases. Correct color fading and improve overall clarity and sharpness. The goal is to make the photo look as close to its original state as possible while maintaining its authenticity.`;
    return applyFullImageEffect(image, prompt);
};

/**
 * Removes the background from an image.
 */
export const generateRemovedBackground = (image: File): Promise<string> => {
    const prompt = `Remove the background from this image, leaving only the main subject. The output must have a transparent background. The edges of the subject should be clean and precise.`;
    return applyFullImageEffect(image, prompt);
};

/**
 * Generates a background image from a text prompt.
 */
export const generateBackgroundImage = async (prompt: string, width: number, height: number): Promise<string> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Generate a photorealistic background image with an aspect ratio of ${width}:${height}. The background should be: "${prompt}"` }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return extractImageDataUrl(response);
};

/**
 * Upscales a cropped portion of an image to a target resolution.
 */
export const generateZoomedImage = async (
    croppedImage: File,
    targetWidth: number,
    targetHeight: number,
    detailIntensity: string
): Promise<string> => {
    const prompt = `This is a cropped section of a larger image. Upscale it to ${targetWidth}x${targetHeight} pixels while using AI to fill in missing details and enhance resolution. The detail enhancement intensity should be '${detailIntensity}'. The result should be a plausible, high-resolution version of what this cropped area would look like if it were captured in high definition.`;
    return applyFullImageEffect(croppedImage, prompt);
};

/**
 * Creates a double exposure effect by blending two images.
 */
export const generateDoubleExposure = async (
    baseImage: File,
    overlayImage: File,
    blendMode: string,
    opacity: number
): Promise<string> => {
    const baseImagePart = await fileToGenerativePart(baseImage);
    const overlayImagePart = await fileToGenerativePart(overlayImage);

    const prompt = `Create a surreal and artistic double exposure effect.
- The first image is the base image (e.g., a portrait or landscape).
- The second image is the overlay image (e.g., a texture or another scene).
Blend the overlay image onto the base image using a '${blendMode}' blend mode. The overlay image should have an approximate opacity of ${Math.round(opacity * 100)}%.
The final result must be a seamless, high-quality, and aesthetically pleasing image that merges the two inputs creatively.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [baseImagePart, overlayImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    return extractImageDataUrl(response);
};

// Helper to crop a face from an image and return a File
const cropFace = async (imageFile: File, box: Face['box']): Promise<File> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(imageFile);
        image.src = url;
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const { x, y, width, height } = box;
            const sx = x * image.naturalWidth;
            const sy = y * image.naturalHeight;
            const sWidth = width * image.naturalWidth;
            const sHeight = height * image.naturalHeight;
            
            canvas.width = sWidth;
            canvas.height = sHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(url);
                return reject(new Error('Could not get canvas context for cropping.'));
            }
            
            ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
            
            canvas.toBlob((blob) => {
                if (!blob) {
                    URL.revokeObjectURL(url);
                    return reject(new Error('Failed to create blob from cropped canvas.'));
                }
                resolve(new File([blob], 'cropped_face.png', { type: 'image/png' }));
                URL.revokeObjectURL(url);
            }, 'image/png');
        };
        image.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };
    });
};

// Helper to create a black and white mask file for a face
const createMaskForFace = async (imageFile: File, box: Face['box']): Promise<File> => {
     return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(imageFile);
        image.src = url;
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(url);
                return reject(new Error('Could not get canvas context for mask generation.'));
            }
            
            // Fill with black
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw white rectangle for the face
            const { x, y, width, height } = box;
            ctx.fillStyle = 'white';
            ctx.fillRect(x * canvas.width, y * canvas.height, width * canvas.width, height * canvas.height);
            
            canvas.toBlob((blob) => {
                if (!blob) {
                    URL.revokeObjectURL(url);
                    return reject(new Error('Failed to create blob from mask canvas.'));
                }
                resolve(new File([blob], 'mask.png', { type: 'image/png' }));
                URL.revokeObjectURL(url);
            }, 'image/png');
        };
        image.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };
    });
};

/**
 * Swaps a face from a source image onto a target image.
 */
export const generateFaceSwap = async (
    targetImage: File,
    sourceImage: File,
    targetFace: Face,
    sourceFace: Face
): Promise<string> => {
    // 1. Crop the source face to use as a reference
    const croppedSourceFaceFile = await cropFace(sourceImage, sourceFace.box);

    // 2. Create a mask for the target face area
    const maskFile = await createMaskForFace(targetImage, targetFace.box);

    // 3. Convert all files to generative parts
    const targetImagePart = await fileToGenerativePart(targetImage);
    const croppedSourceFacePart = await fileToGenerativePart(croppedSourceFaceFile);
    const maskPart = await fileToGenerativePart(maskFile);

    // 4. Create a new, more direct prompt with a different input order.
    const prompt = `Perform a photorealistic face swap.
- Use the face from the **first image (this is the source face)**.
- Place it onto the person in the **second image (this is the target image)**.
- The exact area to replace on the target image is marked in white in the **third image (this is the mask)**.

The final result must be perfectly seamless. Match the lighting, angle, and skin tone of the target image. Do not change anything in the target image outside of the masked area.`;

    // 5. Make the API call with the parts in the NEW order described by the prompt.
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [croppedSourceFacePart, targetImagePart, maskPart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    return extractImageDataUrl(response);
};

/**
 * Applies a style from an example edit to a new target image.
 */
export const applyStyleByExample = async (
    originalImage: File,
    editedImage: File,
    targetImage: File
): Promise<string> => {
    const originalImagePart = await fileToGenerativePart(originalImage);
    const editedImagePart = await fileToGenerativePart(editedImage);
    const targetImagePart = await fileToGenerativePart(targetImage);

    const prompt = `You are given three images: an original image, an edited version of that original, and a new target image. Your task is to analyze the style difference between the original and the edited image, and then apply that same stylistic transformation to the new target image. The style includes changes in color grading, contrast, lighting, and filters. Do not replicate content changes, only stylistic ones.

- The first image is the 'Original'.
- The second image is the 'Edited Example'.
- The third image is the 'Target' to which you will apply the style.

Return the modified 'Target' image.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, editedImagePart, targetImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    return extractImageDataUrl(response);
};

/**
 * Applies an artistic style from a reference image to a target image.
 */
export const generateStyleFromReference = async (targetImage: File, styleReferenceImage: File): Promise<string> => {
    const targetImagePart = await fileToGenerativePart(targetImage);
    const styleImagePart = await fileToGenerativePart(styleReferenceImage);
    const prompt = `You are an expert digital artist specializing in style transfer. Your task is to apply the artistic style of one image to another, while strictly preserving the content of the target image.

- **First Image (Target):** This is the image whose content, subjects, and composition MUST be preserved. The style must be applied to the ENTIRETY of this image, from edge to edge.
- **Second Image (Style Reference):** You will analyze this image to extract its artistic style only. This includes its color palette, lighting, texture, contrast, and overall mood. The dimensions of this reference image are irrelevant to the final output size.

**Instruction:** Apply the style from the 'Style Reference' image to the 'Target' image. The final output MUST have the exact same dimensions as the 'Target' image, with the style applied to the full frame.

**CRITICAL RULE:** DO NOT transfer any objects, people, or structural elements from the 'Style Reference' to the 'Target'. The final image must contain ONLY the original content of the 'Target' image, but with the new artistic style applied across the entire canvas.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [targetImagePart, styleImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    return extractImageDataUrl(response);
};