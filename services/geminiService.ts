/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";

export type SuggestionAnalysis = {
    image_type: 'portrait' | 'landscape' | 'group_photo' | 'product_shot' | 'document' | 'old_photo' | 'art' | 'other';
    characteristics: ('blurry' | 'low_light' | 'damaged' | 'black_and_white' | 'vibrant_colors' | 'muted_colors')[];
    subject: string;
    mood: string;
    reasoning: string;
};

export type Face = {
    box: {
        x: number; // top-left x
        y: number; // top-left y
        width: number;
        height: number;
    }
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

// Helper function to convert a File object to a Gemini API Part
const fileToPart = async (file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    
    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
};

const handleApiResponse = (
    response: GenerateContentResponse,
    context: string // e.g., "edit", "filter", "adjustment"
): string => {
    const finishReason = response.candidates?.[0]?.finishReason;
    const blockReason = response.promptFeedback?.blockReason;

    // 1. Check for safety blocks first (most common issue)
    if (blockReason === 'PROHIBITED_CONTENT' || finishReason === 'SAFETY') {
        // This specific string will be detected by the frontend to show a helpful message.
        const userFriendlyMessage = `Your request was blocked. See Google's Generative AI Prohibited Use Policy.`;
        const technicalMessage = `Request blocked for safety. Reason: ${blockReason || finishReason}.`;
        console.error(technicalMessage, { response });
        throw new Error(userFriendlyMessage);
    }
    
    // 2. Check for other block reasons
    if (blockReason) {
        const { blockReasonMessage } = response.promptFeedback!;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }
    
    // 3. Try to find the image part
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        console.log(`Received image data (${mimeType}) for ${context}`);
        return `data:${mimeType};base64,${data}`;
    }

    // 4. If no image, handle other finish reasons
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `Image generation for ${context} stopped unexpectedly. Reason: ${finishReason}.`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }
    
    // 5. Fallback for unexpected responses
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image for the ${context}. ` + 
        (textFeedback 
            ? `The model responded with text: "${textFeedback}"`
            : "This can happen if the request is too complex. Please try rephrasing your prompt.");

    console.error(`Model response did not contain an image part for ${context}.`, { response });
    throw new Error(errorMessage);
};

/**
 * Analyzes an image to suggest relevant edits.
 * @param imageFile The image to analyze.
 * @returns A promise resolving to a structured analysis object.
 */
export const analyzeImageForSuggestions = async (imageFile: File): Promise<SuggestionAnalysis> => {
    console.log('Starting image analysis for suggestions...');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

    const imagePart = await fileToPart(imageFile);
    const prompt = `Analyze the provided image and describe it in the requested JSON format. Identify its category, notable characteristics for editing, the main subject, and the overall mood.`;
    const textPart = { text: prompt };

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
          image_type: {
            type: Type.STRING,
            enum: ['portrait', 'landscape', 'group_photo', 'product_shot', 'document', 'old_photo', 'art', 'other'],
            description: 'Categorize the image into one of the provided types.'
          },
          characteristics: {
            type: Type.ARRAY,
            items: { 
                type: Type.STRING,
                enum: ['blurry', 'low_light', 'damaged', 'black_and_white', 'vibrant_colors', 'muted_colors']
            },
            description: 'List key visual characteristics relevant for editing. Choose from the enum. Only include characteristics that are clearly present.'
          },
          subject: {
            type: Type.STRING,
            description: 'A brief, descriptive title for the main subject of the image (e.g., "A golden retriever playing in a park", "A dramatic mountain range at sunrise").'
          },
          mood: {
            type: Type.STRING,
            description: 'Describe the overall mood or feeling of the image in a few words (e.g., "Joyful and energetic", "Peaceful and serene", "Dark and moody").'
          },
          reasoning: {
            type: Type.STRING,
            description: 'Briefly explain why you chose these categories and characteristics.'
          }
        },
        required: ['image_type', 'characteristics', 'subject', 'mood']
      };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
                safetySettings: safetySettings,
            },
        });

        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);
        
        // Basic validation
        if (!parsedJson.image_type || !Array.isArray(parsedJson.characteristics)) {
            throw new Error("Invalid JSON structure received from analysis API.");
        }

        return parsedJson as SuggestionAnalysis;

    } catch (error) {
        console.error("Error during image analysis:", error);
        throw new Error("Failed to analyze the image for suggestions. Please proceed with manual edits.");
    }
};

/**
 * Generates an edited image using generative AI based on a text prompt and a specific point or a mask.
 * @param originalImage The original image file.
 * @param userPrompt The text prompt describing the desired edit.
 * @param hotspot The {x, y} coordinates on the image to focus the edit (used if no mask).
 * @param maskImage A black and white mask image file. Edits are applied to white areas.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateEditedImage = async (
    originalImage: File,
    userPrompt: string,
    hotspot: { x: number; y: number } | null,
    maskImage?: File
): Promise<string> => {
    console.log('Starting generative edit...');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    // FIX: Explicitly type `parts` as an array that can hold both image and text parts
    // to prevent a TypeScript error when pushing a text part later.
    const parts: ({inlineData: {mimeType: string; data: string}} | {text: string})[] = [await fileToPart(originalImage)];
    let prompt = '';

    const safetyPolicy = `Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.`;

    if (maskImage) {
        console.log('Using mask for edit.');
        prompt = `You are an expert photo editor AI. You are provided with an original image and a mask image. Your task is to perform a natural edit on the original image based on the user's request, but ONLY within the white areas of the mask image. The black areas of the mask image must remain completely untouched and identical to the original image.

User Request: "${userPrompt}"

Editing Guidelines:
- The edit must be realistic and blend seamlessly with the surrounding area.

${safetyPolicy}

Output: Return ONLY the final edited image. Do not return text.`;
        parts.push(await fileToPart(maskImage));
    } else if (hotspot) {
        console.log('Using hotspot for edit at:', hotspot);
        prompt = `You are an expert photo editor AI. Your task is to perform a natural, localized edit on the provided image based on the user's request.
User Request: "${userPrompt}"
Edit Location: Focus on the area around pixel coordinates (x: ${hotspot.x}, y: ${hotspot.y}).

Editing Guidelines:
- The edit must be realistic and blend seamlessly with the surrounding area.
- The rest of the image (outside the immediate edit area) must remain identical to the original.

${safetyPolicy}

Output: Return ONLY the final edited image. Do not return text.`;
    } else {
        throw new Error("An edit area (mask or hotspot) must be specified.");
    }
    
    parts.push({ text: prompt });

    console.log('Sending image and prompt to the model...');
    // FIX: Moved safetySettings into the config object.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: parts },
        config: {
            safetySettings: safetySettings,
        },
    });
    console.log('Received response from model.', response);

    return handleApiResponse(response, 'edit');
};


/**
 * Generates an image with a filter applied using generative AI.
 * @param originalImage The original image file.
 * @param filterPrompt The text prompt describing the desired filter.
 * @returns A promise that resolves to the data URL of the filtered image.
 */
export const generateFilteredImage = async (
    originalImage: File,
    filterPrompt: string,
): Promise<string> => {
    console.log(`Starting filter generation: ${filterPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to apply a stylistic filter to the entire image based on the user's request. Do not change the composition or content, only apply the style.
Filter Request: "${filterPrompt}"

Safety & Ethics Policy:
- Filters may subtly shift colors, but you MUST ensure they do not alter a person's fundamental race or ethnicity.
- You MUST REFUSE any request that explicitly asks to change a person's race (e.g., 'apply a filter to make me look Chinese').

Output: Return ONLY the final filtered image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and filter prompt to the model...');
    // FIX: Moved safetySettings into the config object.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            safetySettings: safetySettings,
        },
    });
    console.log('Received response from model for filter.', response);
    
    return handleApiResponse(response, 'filter');
};

/**
 * Generates an image with a cinematic color grade applied.
 * @param originalImage The original image file.
 * @param gradePrompt The text prompt describing the desired color grade.
 * @returns A promise that resolves to the data URL of the color-graded image.
 */
export const generateColorGradedImage = async (
    originalImage: File,
    gradePrompt: string,
): Promise<string> => {
    console.log(`Starting color grade generation: ${gradePrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are a professional colorist AI. Your task is to apply a cinematic color grade to the entire image based on the user's request. The focus should be on manipulating colors, tones, and contrast to achieve a specific mood or aesthetic. Do not change the composition or content, only apply the color grade.

Color Grade Request: "${gradePrompt}"

Safety & Ethics Policy:
- Color grading may subtly shift skin tones as part of the overall look, but you MUST ensure they do not alter a person's fundamental race or ethnicity.
- You MUST REFUSE any request that explicitly asks to change a person's race.

Output: Return ONLY the final color-graded image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and color grade prompt to the model...');
    // FIX: Moved safetySettings into the config object.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            safetySettings: safetySettings,
        },
    });
    console.log('Received response from model for color grade.', response);
    
    return handleApiResponse(response, 'color grade');
};

/**
 * Generates an image with a global adjustment applied using generative AI.
 * @param originalImage The original image file.
 * @param adjustmentPrompt The text prompt describing the desired adjustment.
 * @returns A promise that resolves to the data URL of the adjusted image.
 */
export const generateAdjustedImage = async (
    originalImage: File,
    adjustmentPrompt: string,
): Promise<string> => {
    console.log(`Starting global adjustment generation: ${adjustmentPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to perform a natural, global adjustment to the entire image based on the user's request.
User Request: "${adjustmentPrompt}"

Editing Guidelines:
- The adjustment must be applied across the entire image.
- The result must be photorealistic.

Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.

Output: Return ONLY the final adjusted image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and adjustment prompt to the model...');
    // FIX: Moved safetySettings into the config object.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            safetySettings: safetySettings,
        },
    });
    console.log('Received response from model for adjustment.', response);
    
    return handleApiResponse(response, 'adjustment');
};

/**
 * Generates an image with an AI sharpening filter applied.
 * @param originalImage The original image file.
 * @param intensity The desired intensity of the sharpening ('Subtle', 'Natural', 'High').
 * @returns A promise that resolves to the data URL of the sharpened image.
 */
export const generateSharpenedImage = async (
    originalImage: File,
    intensity: string,
): Promise<string> => {
    console.log(`Starting AI sharpen with ${intensity} intensity.`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);

    let intensityInstruction = '';
    switch (intensity.toLowerCase()) {
        case 'subtle':
            intensityInstruction = 'Apply a very subtle sharpening effect. The goal is to gently enhance the finest details without making the image look obviously processed. It should look just slightly crisper than the original.';
            break;
        case 'high':
            intensityInstruction = 'Apply a strong and noticeable sharpening effect. Bring out all possible details and create very crisp edges. Be careful to avoid prominent halos or a "crunchy" look, but the effect should be clearly visible and powerful.';
            break;
        case 'natural':
        default:
            intensityInstruction = 'Apply a natural, balanced sharpening effect. Enhance the details and edges to improve overall clarity, but avoid over-sharpening that creates halos or artifacts. The result should look crisp and clear, as if captured with a high-quality lens.';
            break;
    }
    
    const prompt = `You are an expert photo editor AI. Your task is to apply a sharpening effect to the entire image based on the requested intensity.
Requested Intensity: "${intensity}"

Sharpening Guidelines:
- ${intensityInstruction}
- The sharpening should be applied globally across the entire image.
- The result must be photorealistic and free of digital artifacts.

Output: Return ONLY the final sharpened image. Do not return text.`;
    const textPart = { text: prompt };

    console.log(`Sending image and sharpen prompt to the model...`);
    // FIX: Moved safetySettings into the config object.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            safetySettings: safetySettings,
        },
    });
    console.log('Received response from model for sharpen.', response);
    
    return handleApiResponse(response, 'sharpen');
};

/**
 * Adds AI-powered film grain to an image.
 * @param originalImage The original image file.
 * @param intensity The desired intensity of the grain ('Subtle', 'Medium', 'High').
 * @returns A promise that resolves to the data URL of the grainy image.
 */
export const generateGrainImage = async (
    originalImage: File,
    intensity: string,
): Promise<string> => {
    console.log(`Starting AI grain with ${intensity} intensity.`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);

    let intensityInstruction = '';
    switch (intensity.toLowerCase()) {
        case 'subtle':
            intensityInstruction = 'Apply a very subtle and fine film grain. The effect should be barely noticeable, adding a slight texture that feels organic and not digital. It should mimic a low-ISO, high-quality film stock.';
            break;
        case 'high':
            intensityInstruction = 'Apply a heavy and prominent film grain. The grain should be very visible, giving the image a gritty, vintage, or high-ISO film look. The effect should be stylistic and strong.';
            break;
        case 'medium':
        default:
            intensityInstruction = 'Apply a natural, medium-intensity film grain. The texture should be noticeable and add character to the image, similar to a classic 35mm film stock, without overwhelming the details.';
            break;
    }
    
    const prompt = `You are an expert photo editor AI. Your task is to apply a realistic film grain effect to the entire image based on the requested intensity.

Requested Intensity: "${intensity}"

Grain Application Guidelines:
- ${intensityInstruction}
- The grain should be applied evenly across the entire image, including highlights, midtones, and shadows.
- The result must be photorealistic and look like authentic film grain, not digital noise. Do not alter colors or contrast.

Output: Return ONLY the final image with grain applied. Do not return text.`;
    const textPart = { text: prompt };

    console.log(`Sending image and grain prompt to the model...`);
    // FIX: Moved safetySettings into the config object.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            safetySettings: safetySettings,
        },
    });
    console.log('Received response from model for grain.', response);
    
    return handleApiResponse(response, 'grain');
};


/**
 * Detects faces in an image and returns their bounding boxes.
 * @param imageFile The image to analyze.
 * @returns A promise resolving to an array of face objects with bounding boxes.
 */
export const detectFaces = async (imageFile: File): Promise<Face[]> => {
    console.log('Starting face detection...');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

    const imagePart = await fileToPart(imageFile);
    const prompt = `Analyze the provided image and identify all human faces. For each face, provide its bounding box coordinates. The coordinates should be normalized from 0 to 1, where (0,0) is the top-left corner.`;
    const textPart = { text: prompt };

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
          faces: {
            type: Type.ARRAY,
            description: "An array of all detected faces in the image.",
            items: {
              type: Type.OBJECT,
              properties: {
                box: {
                  type: Type.OBJECT,
                  description: "The bounding box of the face, normalized from 0 to 1.",
                  properties: {
                    x: { type: Type.NUMBER, description: "The x-coordinate of the top-left corner." },
                    y: { type: Type.NUMBER, description: "The y-coordinate of the top-left corner." },
                    width: { type: Type.NUMBER, description: "The width of the bounding box." },
                    height: { type: Type.NUMBER, description: "The height of the bounding box." },
                  },
                  required: ["x", "y", "width", "height"]
                }
              },
              required: ["box"]
            }
          }
        },
        required: ["faces"]
      };

    try {
        // FIX: Moved safetySettings into the config object.
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
                safetySettings: safetySettings,
            },
        });

        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);
        
        if (!parsedJson.faces || !Array.isArray(parsedJson.faces)) {
            console.warn("Face detection returned an unexpected JSON structure:", parsedJson);
            return [];
        }

        return parsedJson.faces as Face[];

    } catch (error) {
        console.error("Error during face detection:", error);
        throw new Error("Failed to detect faces in the image.");
    }
};

/**
 * Applies AI-powered facial retouching to an image.
 * @param originalImage The original image file.
 * @param settings The retouch settings.
 * @returns A promise that resolves to the data URL of the retouched image.
 */
export const generateRetouchedFace = async (
    originalImage: File,
    settings: {
        skinSmoothing: number; // 0-100
        eyeBrightening: number; // 0-100
        selectedFaces?: Face[]; // Optional array of faces to apply the edit to
    }
): Promise<string> => {
    console.log(`Starting face retouch generation with settings:`, settings);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const { skinSmoothing, eyeBrightening, selectedFaces } = settings;

    // Create a detailed prompt based on the settings
    const promptParts: string[] = [
        "You are an expert digital artist specializing in professional portrait retouching. Your task is to apply subtle enhancements to the face(s) in the provided image based on the following parameters."
    ];

    if (selectedFaces && selectedFaces.length > 0) {
        const faceInstructions = selectedFaces.map((face, index) => 
            `Face ${index + 1} is located at bounding box (normalized coordinates): {x: ${face.box.x.toFixed(4)}, y: ${face.box.y.toFixed(4)}, width: ${face.box.width.toFixed(4)}, height: ${face.box.height.toFixed(4)}}.`
        ).join(' ');
        promptParts.push(`Apply the edits ONLY to the specified faces: ${faceInstructions} The rest of the image must remain untouched.`);
    } else {
        promptParts.push("Apply the edits to all detected faces in the image.");
    }

    promptParts.push(`Retouching Parameters:
- Skin Smoothing Intensity: ${skinSmoothing}/100. Smooth skin texture to even out tone and reduce minor blemishes. A value of 0 means no smoothing, while 100 is significant but still realistic smoothing. Ensure you preserve natural skin texture and pores appropriate to the intensity. Avoid a plastic or overly airbrushed look.
- Eye Brightening Intensity: ${eyeBrightening}/100. Enhance the eyes to make them clearer and more vibrant. A value of 0 means no change, while 100 means a noticeable 'pop'. This includes subtly brightening the sclera and enhancing the iris. Also, subtly whiten teeth if visible.`);

    promptParts.push(`General Guidelines:
- The goal is enhancement, not alteration. The person/people must remain completely recognizable.
- Do not change the shape of facial features (eyes, nose, mouth, jawline).
- Do not change the person's identity, age, race, or ethnicity.`);
    
    promptParts.push("Output: Return ONLY the final retouched image. Do not return text.");
    
    const fullPrompt = promptParts.join('\n\n');

    const originalImagePart = await fileToPart(originalImage);
    const textPart = { text: fullPrompt };

    console.log('Sending image and face retouch prompt to the model...');
    // FIX: Moved safetySettings into the config object.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            safetySettings: safetySettings,
        },
    });
    console.log('Received response from model for face retouch.', response);
    
    return handleApiResponse(response, 'face retouch');
};

/**
 * Swaps a face from a source image onto a target image.
 * @param targetImage The image where the face will be placed.
 * @param sourceImage The image from which to take the face.
 * @param targetFace The bounding box of the face to be replaced in the target image.
 * @param sourceFace The bounding box of the face to use from the source image.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateFaceSwap = async (
    targetImage: File,
    sourceImage: File,
    targetFace: Face,
    sourceFace: Face,
): Promise<string> => {
    console.log(`Starting face swap...`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

    // Get target image dimensions to enforce consistent output size
    const { width: targetWidth, height: targetHeight } = await new Promise<{width: number, height: number}>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(targetImage);
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(url);
        };
        img.onerror = (err) => {
            reject(err);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    });

    const targetImagePart = await fileToPart(targetImage);
    const sourceImagePart = await fileToPart(sourceImage);

    const prompt = `You are an expert digital artist specializing in photorealistic face swapping. You will be provided with a 'Target Image' and a 'Source Image'. Your task is to take the face from the specified bounding box in the 'Source Image' and seamlessly place it onto the specified bounding box in the 'Target Image'.

- Source Image Face Bounding Box (normalized): {x: ${sourceFace.box.x.toFixed(4)}, y: ${sourceFace.box.y.toFixed(4)}, width: ${sourceFace.box.width.toFixed(4)}, height: ${sourceFace.box.height.toFixed(4)}}
- Target Image Face Bounding Box (to be replaced): {x: ${targetFace.box.x.toFixed(4)}, y: ${targetFace.box.y.toFixed(4)}, width: ${targetFace.box.width.toFixed(4)}, height: ${targetFace.box.height.toFixed(4)}}

CRITICAL INSTRUCTIONS:
1.  **Preserve Target Scene:** The final image must retain the lighting, skin tone, color grading, and overall atmosphere of the 'Target Image'. The swapped face must look like it naturally belongs in the target scene.
2.  **Precise Pose and Perspective Matching:** This is the most crucial step. You must not simply paste the source face. You must meticulously reconstruct the source face to perfectly match the 3D head position, rotation (tilt, yaw, pitch), and perspective of the original face in the 'Target Image'. The swapped face must look as if it were photographed in that exact position and orientation.
3.  **Natural Expression Blending:** Subtly blend the expression of the source face with the general mood of the target face if it helps create a more natural result. For example, a neutral expression from the source should be adapted to a slight smile if the target face is smiling.
4.  **Seamless Blending:** The edges of the swapped face must be perfectly blended with the surrounding skin in the 'Target Image'. There should be no visible seams.
5.  **Maintain Identity:** The identity of the swapped face must be clearly that of the person in the 'Source Image'.
6.  **Preserve Target Body/Background:** The rest of the 'Target Image' (hair, body, clothing, background) must remain absolutely unchanged.
7.  **Preserve Dimensions:** The output image MUST have the exact same dimensions as the original 'Target Image': ${targetWidth} pixels wide by ${targetHeight} pixels tall. Do not crop or change the aspect ratio.

Safety & Ethics Policy: This tool is for creative and professional photo editing. Do not use it to create misleading or harmful content. Ensure the final result does not fundamentally alter the perceived race or ethnicity in a deceptive way.

Output: Return ONLY the final edited image with the exact dimensions of ${targetWidth}x${targetHeight}. Do not return text.`;

    const parts = [
        { text: "Target Image:" },
        targetImagePart,
        { text: "Source Image:" },
        sourceImagePart,
        { text: prompt },
    ];
    
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: parts },
        config: {
            safetySettings: safetySettings,
        },
    });

    console.log('Received response from model for face swap.', response);
    return handleApiResponse(response, 'face swap');
};

/**
 * Generates an upscaled image using generative AI.
 * @param originalImage The original image file.
 * @param scale The factor to upscale by (e.g., 2 for 2x).
 * @param detailIntensity The desired level of detail enhancement.
 * @param originalWidth The natural width of the original image.
 * @param originalHeight The natural height of the original image.
 * @returns A promise that resolves to the data URL of the upscaled image.
 */
export const generateUpscaledImage = async (
    originalImage: File,
    scale: number,
    detailIntensity: string,
    originalWidth: number,
    originalHeight: number,
): Promise<string> => {
    console.log(`Starting upscale generation: ${scale}x with ${detailIntensity} detail.`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);

    let detailInstruction = '';
    switch (detailIntensity.toLowerCase()) {
        case 'subtle':
            detailInstruction = 'When reconstructing details, focus on clean lines and preserving the original texture as much as possible. Add only the minimum necessary new detail to achieve the target resolution.';
            break;
        case 'high':
            detailInstruction = 'When reconstructing details, add a high amount of intricate, plausible new detail to enhance realism and texture, making the result look like it was originally captured with a high-resolution camera.';
            break;
        case 'natural':
        default:
            detailInstruction = 'When reconstructing details, add a natural amount of new detail, balancing enhancement with the original character of the image. The result should look realistic and not over-sharpened.';
            break;
    }

    const targetWidth = Math.round(originalWidth * scale);
    const targetHeight = Math.round(originalHeight * scale);
    
    const prompt = `You are an expert in AI image processing specializing in high-quality upscaling. Your task is to upscale the provided image to a target resolution of exactly ${targetWidth} by ${targetHeight} pixels, paying close attention to the requested detail intensity.

Upscaling Guidelines:
- Increase the resolution of the image to the target dimensions: ${targetWidth}x${targetHeight}.
- ${detailInstruction}
- Reduce any existing noise or compression artifacts where possible.
- The final result must be a photorealistic, high-resolution version of the original image, free of AI-generated artifacts.

Output: Return ONLY the final upscaled image. Do not return text.`;
    const textPart = { text: prompt };

    console.log(`Sending image and ${scale}x upscale prompt to the model (target: ${targetWidth}x${targetHeight})...`);
    // FIX: Moved safetySettings into the config object.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            safetySettings: safetySettings,
        },
    });
    console.log('Received response from model for upscale.', response);
    
    return handleApiResponse(response, 'upscale');
};

/**
 * Restores an old or damaged photo using generative AI.
 * @param originalImage The original image file.
 * @returns A promise that resolves to the data URL of the restored image.
 */
export const generateRestoredImage = async (
    originalImage: File,
): Promise<string> => {
    console.log(`Starting photo restoration.`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert in digital photo restoration. Your task is to restore the provided old, and potentially damaged, photo.

Restoration Guidelines:
- Repair any physical damage such as scratches, tears, and creases.
- Remove digital noise, grain, and compression artifacts.
- Enhance the clarity and sharpness of the image, bringing details into focus.
- Improve color balance and correct fading. If the image is black and white, enhance its tonal range.
- Do NOT colorize a black and white image unless specifically asked.
- The goal is to create a clean, clear, and high-quality version of the original photo while preserving its authenticity. Do not add or remove any content or alter the subjects' appearances.

Output: Return ONLY the final restored image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and restoration prompt to the model...');
    // FIX: Moved safetySettings into the config object.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            safetySettings: safetySettings,
        },
    });
    console.log('Received response from model for restoration.', response);
    
    return handleApiResponse(response, 'restoration');
};

/**
 * Removes the background from an image using generative AI.
 * @param originalImage The original image file.
 * @returns A promise that resolves to the data URL of the image with a transparent background.
 */
export const generateRemovedBackground = async (
    originalImage: File,
): Promise<string> => {
    console.log(`Starting background removal.`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert AI photo segmentation and masking tool. Your task is to perform a professional-quality background removal on the provided image, paying special attention to the quality of the edges.

CRITICAL INSTRUCTIONS:
1.  **Identify and Isolate Subject:** Perfectly identify the main subject(s) in the image.
2.  **Transparent Background:** Remove the entire background, making it 100% transparent.
3.  **Refine Edges (De-fringe):** This is the most important step. You MUST refine the edges of the subject to remove any color fringing or halo effects from the original background. The edges, especially around fine details like hair, fur, or fabric, should blend smoothly and naturally when placed on a new background. The semi-transparent pixels on the edges should contain the pure color of the subject, not a mix of the subject and the old background.
4.  **Preserve Subject:** Do NOT alter the subject itself in any way (color, shape, texture).
5.  **Output Format:** The final output MUST be a PNG image with a high-quality alpha channel for transparency. Do not add a solid color background.

Return ONLY the final, edge-refined PNG image with a transparent background. Do not respond with text.`;
    const textPart = { text: prompt };

    console.log('Sending image and background removal prompt to the model...');
    // FIX: Moved safetySettings into the config object.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            safetySettings: safetySettings,
        },
    });
    console.log('Received response from model for background removal.', response);
    
    return handleApiResponse(response, 'background removal');
};

/**
 * Automatically corrects the orientation of an image.
 * @param originalImage The original image file.
 * @returns A promise that resolves to the data URL of the correctly oriented image.
 */
export const generateCorrectedOrientation = async (
    originalImage: File,
): Promise<string> => {
    console.log(`Starting auto-orientation.`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to analyze the provided image to determine its correct upright orientation. Rotate the image so that the main subject is oriented correctly (e.g., people are standing upright, horizons are level).

Editing Guidelines:
- Do not crop, resize, or make any other changes to the image content or quality.
- The output image dimensions should be adjusted to reflect the rotation (e.g., a 1000x800 portrait image rotated 90 degrees should become 800x1000).

Output: Return ONLY the final rotated image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and auto-rotate prompt to the model...');
    // FIX: Moved safetySettings into the config object.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            safetySettings: safetySettings,
        },
    });
    console.log('Received response from model for auto-orientation.', response);
    
    return handleApiResponse(response, 'auto-orientation');
};

/**
 * Manually rotates an image 90 degrees.
 * @param originalImage The original image file.
 * @param direction The direction to rotate.
 * @returns A promise that resolves to the data URL of the rotated image.
 */
export const generateRotatedImage = async (
    originalImage: File,
    direction: 'clockwise' | 'counter-clockwise'
): Promise<string> => {
    console.log(`Starting manual rotation: ${direction}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to rotate the entire image exactly 90 degrees ${direction}.

Editing Guidelines:
- Do not crop, resize, or make any other changes to the image content or quality.
- The output image dimensions must be adjusted to reflect the rotation (e.g., a 1000x800 portrait image rotated 90 degrees should become 800x1000).

Output: Return ONLY the final rotated image. Do not return text.`;
    const textPart = { text: prompt };

    console.log(`Sending image and rotate ${direction} prompt to the model...`);
    // FIX: Moved safetySettings into the config object.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            safetySettings: safetySettings,
        },
    });
    console.log(`Received response from model for manual rotation.`, response);
    
    return handleApiResponse(response, 'manual rotation');
};


/**
 * Generates a zoomed and enhanced image using generative AI.
 * @param imageToZoom The cropped image file to be upscaled.
 * @param targetWidth The target width to upscale to (original image width).
 * @param targetHeight The target height to upscale to (original image height).
 * @param detailIntensity The desired level of detail enhancement.
 * @returns A promise that resolves to the data URL of the zoomed image.
 */
export const generateZoomedImage = async (
    imageToZoom: File,
    targetWidth: number,
    targetHeight: number,
    detailIntensity: string
): Promise<string> => {
    console.log(`Starting AI Zoom generation to ${targetWidth}x${targetHeight} with ${detailIntensity} detail.`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const imagePart = await fileToPart(imageToZoom);
    
    let detailInstruction = '';
    switch (detailIntensity.toLowerCase()) {
        case 'subtle':
            detailInstruction = 'Focus on clean lines and preserving the original texture as much as possible. Add only minimal necessary new detail to achieve the target resolution.';
            break;
        case 'high':
            detailInstruction = 'Add a high amount of intricate, plausible new detail to enhance realism and texture, making the result look like a high-resolution photograph.';
            break;
        case 'natural':
        default:
            detailInstruction = 'Add a natural amount of new detail, balancing enhancement with the original character of the image.';
            break;
    }

    const prompt = `You are an expert in AI image processing specializing in high-quality upscaling and detail reconstruction (super-resolution). Your task is to upscale the provided image to a target resolution of exactly ${targetWidth} by ${targetHeight} pixels.

Upscaling Guidelines:
- Intelligently enhance and reconstruct details to fill the new resolution. Do not just enlarge pixels.
- ${detailInstruction}
- The upscaled content should be photorealistic and blend seamlessly with the style of the source image.
- Avoid introducing any AI-generated artifacts.
- The final result must be a high-resolution version of the provided cropped image.

Output: Return ONLY the final upscaled image. Do not return text.`;

    const textPart = { text: prompt };

    console.log(`Sending image and ${targetWidth}x${targetHeight} zoom prompt to the model...`);
    // FIX: Moved safetySettings into the config object.
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, textPart] },
        config: {
            safetySettings: safetySettings,
        },
    });
    console.log('Received response from model for AI zoom.', response);
    
    return handleApiResponse(response, 'AI zoom');
};


const getClosestAspectRatio = (width: number, height: number): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" => {
    const ratio = width / height;
    const supportedRatios = {
        "16:9": 16 / 9,
        "9:16": 9 / 16,
        "4:3": 4 / 3,
        "3:4": 3 / 4,
        "1:1": 1,
    };

    let closest = "1:1" as keyof typeof supportedRatios;
    let minDiff = Math.abs(ratio - supportedRatios[closest]);

    for (const key in supportedRatios) {
        const ar = key as keyof typeof supportedRatios;
        const diff = Math.abs(ratio - supportedRatios[ar]);
        if (diff < minDiff) {
            minDiff = diff;
            closest = ar;
        }
    }
    return closest;
};

/**
 * Generates a background image using generative AI.
 * @param prompt The text prompt describing the desired background.
 * @param width The width of the target canvas.
 * @param height The height of the target canvas.
 * @returns A promise that resolves to the data URL of the generated background.
 */
export const generateBackgroundImage = async (
    prompt: string,
    width: number,
    height: number
): Promise<string> => {
    console.log(`Starting background generation with prompt: ${prompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

    const aspectRatio = getClosestAspectRatio(width, height);
    
    console.log(`Generating image with aspect ratio: ${aspectRatio}`);

    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: `Generate a high-quality, photorealistic background image based on the following description. The image should be scenic and should not contain any prominent subjects or people, as it will be used as a background for another photo. Description: "${prompt}"`,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio,
        },
    });
    console.log('Received response from image generation model.', response);

    if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image.imageBytes) {
        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        return `data:image/jpeg;base64,${base64ImageBytes}`;
    }
    
    throw new Error('AI model failed to generate a background image. Please try a different prompt.');
};

/**
 * Applies an edit style from an example pair to a new target image.
 * @param originalImage The original, unedited image file.
 * @param editedImage The final, edited image file that serves as the style example.
 * @param targetImage The new image to apply the transformation to.
 * @returns A promise that resolves to the data URL of the newly edited target image.
 */
export const applyStyleByExample = async (
    originalImage: File,
    editedImage: File,
    targetImage: File,
): Promise<string> => {
    console.log('Starting batch edit by example for:', targetImage.name);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

    const originalImagePart = await fileToPart(originalImage);
    const editedImagePart = await fileToPart(editedImage);
    const targetImagePart = await fileToPart(targetImage);

    const prompt = `You are an expert photo editor AI. You will be given three images: 'Original Image', 'Edited Image', and 'Target Image'.

'Original Image' was edited by a user to become 'Edited Image'. Your task is to analyze the transformation that occurred between 'Original Image' and 'Edited Image'. This transformation could be a color grade, a filter, a brightness/contrast adjustment, or a combination of these.

Once you have identified the transformation, apply the *exact same stylistic and tonal transformation* to the 'Target Image'.

CRITICAL INSTRUCTIONS:
- Do not copy any content from the 'Original Image' or 'Edited Image' onto the 'Target Image'.
- Only replicate the *style* of the edit (e.g., the color grading, contrast change, filter effect).
- The content and composition of the 'Target Image' must remain unchanged.
- The output should be the transformed 'Target Image'.

Output: Return ONLY the final edited image. Do not return text.`;

    const parts = [
        { text: "Original Image:" },
        originalImagePart,
        { text: "Edited Image:" },
        editedImagePart,
        { text: "Target Image:" },
        targetImagePart,
        { text: prompt },
    ];

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: parts },
        config: {
            safetySettings: safetySettings,
        },
    });
    console.log('Received response from model for batch style transfer.', response);
    
    return handleApiResponse(response, 'style transfer');
};