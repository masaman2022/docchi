import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const CREATOMATE_API_KEY = process.env.CREATOMATE_API_KEY;
const CREATOMATE_ENDPOINT = 'https://api.creatomate.com/v2/renders';

export interface RenderOptions {
    templateId: string;
    modifications: {
        [key: string]: string; // e.g., 'Title': 'Are you rich?', 'VideoA': 'http...'
    };
}

export const renderVideo = async (options: RenderOptions): Promise<string | null> => {
    if (!CREATOMATE_API_KEY) {
        console.error('CREATOMATE_API_KEY is missing');
        return null;
    }

    try {
        const response = await axios.post(
            CREATOMATE_ENDPOINT,
            {
                template_id: options.templateId,
                modifications: options.modifications,
            },
            {
                headers: {
                    'Authorization': `Bearer ${CREATOMATE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        // Creatomate usually returns the render info immediately, but processing is async.
        // However, for API calls, we often want to wait or get the 'url' if it's cached or fast.
        // Ideally, use webhook. For MVP, we might poll if we want to block until done.
        // But Creatomate API response usually includes an 'url' that *will* point to the file when done,
        // or we can use `monitor` if we want to check status.

        // For 2-choice videos (short), it might be quick. Let's return the URL but note it might need waiting.
        // Better strategy for MVP: Poll the status endpoint.

        const renderId = response.data.id;
        console.log(`Creatomate Render Started: ${renderId}`);

        return await pollCreatomateRender(renderId);

    } catch (error) {
        console.error('Creatomate API Error:', error);
        return null;
    }
};

const pollCreatomateRender = async (renderId: string): Promise<string | null> => {
    const maxAttempts = 90; // 3 mins (checking every 2s)
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 2000));
        console.log(`Polling Creatomate Render: ${renderId} (Attempt ${i + 1}/${maxAttempts})`);

        try {
            const response = await axios.get(`${CREATOMATE_ENDPOINT}/${renderId}`, {
                headers: { 'Authorization': `Bearer ${CREATOMATE_API_KEY}` },
            });

            const status = response.data.status;
            if (status === 'succeeded') {
                return response.data.url;
            } else if (status === 'failed') {
                console.error('Creatomate Render Failed');
                return null;
            }
        } catch (e) {
            console.warn('Polling error', e);
        }
    }
    return null;
};
