import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;
// Note: Runway Gen-3 Alpha Turbo endpoint might differ; using standard structure for now.
// Actual endpoint usually requires checking specific docs or assume standard '/v1/image_to_video' or similar command.
// For Gen-3 Alpha Turbo, it's often text-to-video.
// Based on user screenshot: POST /v1/text_to_video
const RUNWAY_ENDPOINT = 'https://api.dev.runwayml.com/v1/text_to_video';

export const generateVideoAsset = async (prompt: string): Promise<string | null> => {
    if (!RUNWAY_API_KEY) {
        console.error('RUNWAY_API_KEY is missing');
        return null;
    }

    // Optimized prompt for "Ultimate 2-Choice" background
    const fullPrompt = `Cinematic, slow motion, abstract background, ${prompt}, 4k, high quality, minimal distraction`;

    console.log(`Using Runway Endpoint: ${RUNWAY_ENDPOINT}`);

    try {
        // 1. Initiate Generation
        const response = await axios.post(
            RUNWAY_ENDPOINT,
            {
                promptText: fullPrompt,
                model: 'veo3.1', // Updated from gen-3-alpha-turbo based on screenshot
                ratio: '1280:720', // Screenshot shows pixel dimensions
                duration: 5, // Short duration for background
            },
            {
                headers: {
                    'Authorization': `Bearer ${RUNWAY_API_KEY}`,
                    'Content-Type': 'application/json',
                    'X-Runway-Version': '2024-11-06', // Updated from screenshot
                },
            }
        );

        const taskId = response.data.id;
        console.log(`Runway Generation Started: ${taskId}`);

        // 2. Poll for completion
        return await pollRunwayTask(taskId);

    } catch (error: any) {
        if (error.response) {
            console.error('Runway API Error Status:', error.response.status);
            console.error('Runway API Error Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Runway API Error:', error.message);
        }
        return null;
    }
};

const pollRunwayTask = async (taskId: string): Promise<string | null> => {
    const maxAttempts = 60; // 1 min (if checking every 1s)
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 2000)); // Wait 2s

        try {
            const response = await axios.get(`${RUNWAY_ENDPOINT}/${taskId}`, {
                headers: {
                    'Authorization': `Bearer ${RUNWAY_API_KEY}`,
                    'X-Runway-Version': '2024-11-06',
                },
            });

            const status = response.data.status;
            if (status === 'SUCCEEDED') {
                return response.data.output[0]; // URL of generated video
            } else if (status === 'FAILED') {
                console.error('Runway Task Failed:', response.data.failure);
                return null;
            }
            // If PENDING/RUNNING, continue loop
        } catch (e) {
            console.warn('Polling error', e);
        }
    }
    return null; // Timeout
};
