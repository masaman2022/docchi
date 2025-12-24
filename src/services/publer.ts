import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PUBLER_API_KEY = process.env.PUBLER_API_KEY;
const PUBLER_ENDPOINT = 'https://io.publer.io/api/v1'; // Check docs for correct version/endpoint

export interface PostOptions {
    videoUrl: string;
    caption: string;
    accountId: string; // Publer Account ID (e.g., for 'Twitter' or 'TikTok')
}

export const schedulePost = async (options: PostOptions): Promise<string | null> => {
    if (!PUBLER_API_KEY) {
        console.error('PUBLER_API_KEY is missing');
        return null;
    }

    try {
        // 1. Upload media (if required separately) or simpler: Post with Media URL
        // Publer API allows passing media URLs directly in the 'media' array.

        const response = await axios.post(
            `${PUBLER_ENDPOINT}/posts`,
            {
                account_ids: [options.accountId],
                text: options.caption,
                media: [
                    {
                        url: options.videoUrl,
                        type: 'video'
                    }
                ],
                // "schedule" can be omitted to post immediately? Or use "shortly" if supported? 
                // Publer usually posts "now" if no time provided, or might need specific flag.
                // Assuming post immediately for "Post Now" button.
            },
            {
                headers: {
                    'Authorization': `Bearer ${PUBLER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('Publer Post Response:', response.data);
        return response.data.id; // Post ID

    } catch (error: any) {
        console.error('Publer API Error:', error.response?.data || error);
        return null;
    }
};

/**
 * Fetch connected accounts to help user pick where to post
 */
export const getPublerAccounts = async () => {
    if (!PUBLER_API_KEY) return [];
    try {
        const response = await axios.get(`${PUBLER_ENDPOINT}/accounts`, {
            headers: { 'Authorization': `Bearer ${PUBLER_API_KEY}` }
        });
        return response.data; // Returns list of accounts
    } catch (e) {
        console.error('Error fetching Publer accounts', e);
        return [];
    }
}
