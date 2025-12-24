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

    // Use the prompt directly as it is now fully styled by OpenAI
    const fullPrompt = prompt;

    console.log(`Using Runway Endpoint: ${RUNWAY_ENDPOINT}`);
    console.log(`Runway Config: Model=veo3.1, Duration=4, Ratio=1280:720, Audio=false`);

    try {
        // 1. Initiate Generation
        const response = await axios.post(
            RUNWAY_ENDPOINT,
            {
                promptText: fullPrompt,
                model: 'gen-3-alpha-turbo', // Switch to Turbo for cost savings (5 credits/sec vs 20)
                ratio: '720:1280', // Vertical (9:16) for Reels/Shorts
                duration: 5, // Turbo supports 5s or 10s. 5s = 25 credits.
                audio: false,
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
    const maxAttempts = 150; // 5 mins (checking every 2s)
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 2000)); // Wait 2s
        console.log(`Polling Runway Task: ${taskId} (Attempt ${i + 1}/${maxAttempts})`);

        try {
            // Poll standard /tasks endpoint for status
            const response = await axios.get(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
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
