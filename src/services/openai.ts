import OpenAI from 'openai';
import dotenv from 'dotenv';
import { supabase } from '../supabase';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface Idea {
    title: string;
    option_a: string;
    option_b: string;
}

export const generateIdeas = async (count: number = 10): Promise<Idea[]> => {
    const prompt = `
  あなたは「究極の2択」ショート動画の企画作家です。
  視聴者が思わずコメントしたくなる、議論を呼ぶ、または共感できる2択を${count}個考えてください。
  
  【条件】
  - タイトルは短く、問いかける形式
  - 選択肢AとBは対照的なもの
  - JSON形式で出力すること
  - 配列形式で返すこと
  
  【例】
  [
    { "title": "明日休みなら何する？", "option_a": "一日中寝る", "option_b": "外に出かける" },
    { "title": "宝くじで10億円当たったら？", "option_a": "誰にも言わない", "option_b": "SNSで自慢する" }
  ]
  `;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: 'You are a creative video planner. You must output a valid JSON object with the key "ideas" containing an array of ideas. The user will provide the specific format and topic.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            response_format: { type: 'json_object' },
        });

        const validChoice = response.choices[0];
        if (!validChoice?.message?.content) throw new Error('No content from OpenAI');

        const content = validChoice.message.content;

        const result = JSON.parse(content);
        // Handle cases where GPT wraps it in a key like { "ideas": [...] }
        const ideas: Idea[] = Array.isArray(result) ? result : result.ideas || result.data || [];

        return ideas;

    } catch (error) {
        console.error('Error generating ideas:', error);
        throw error;
    }
};

/**
 * Generate ideas and save them to Supabase as 'pending'
 */
export const generateAndSaveIdeas = async () => {
    const ideas = await generateIdeas(10);

    if (ideas.length === 0) return [];

    const { data, error } = await supabase
        .from('ideas')
        .insert(ideas.map(idea => ({ ...idea, status: 'pending' })))
        .select();

    if (error) {
        console.error('Error saving ideas to Supabase:', error);
        throw new Error(`Supabase Error: ${error.message}`);
    } else {
        console.log(`Saved ${data?.length} ideas to Supabase.`);
        return data;
    }
};

export const createVisualPrompts = async (idea: Idea): Promise<{ promptA: string; promptB: string }> => {
    const prompt = `
  以下の「究極の2択」の選択肢を、動画生成AI (Runway) に入力するための「英語の映像プロンプト」に変換してください。
  
  【企画】
  タイトル: ${idea.title}
  選択肢A: ${idea.option_a}
  選択肢B: ${idea.option_b}
  
  【条件】
  - 英語で出力
  - 抽象的で美しく、各選択肢の雰囲気を表すもの
  - 人物は極力出さない（抽象背景動画にするため）
  - "Cinematic, slow motion, high quality, 4k, abstract background representing..." で始める
  - JSONで { "promptA": "...", "promptB": "..." } の形式で返す
  `;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [{ role: 'system', content: prompt }],
            response_format: { type: 'json_object' },
        });

        const validChoice = response.choices[0];
        if (!validChoice?.message?.content) throw new Error('No content for visual prompts');

        const content = validChoice.message.content;
        const result = JSON.parse(content);
        return {
            promptA: result.promptA || `Cinematic abstract background representing ${idea.option_a}`,
            promptB: result.promptB || `Cinematic abstract background representing ${idea.option_b}`,
        };
    } catch (error) {
        console.error('Error creating visual prompts:', error);
        return {
            promptA: `Cinematic abstract background representing ${idea.option_a}`,
            promptB: `Cinematic abstract background representing ${idea.option_b}`
        };
    }
};
