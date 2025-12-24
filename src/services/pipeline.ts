import { supabase } from '../supabase';
import { createVisualPrompts, Idea } from './openai';
import { generateVideoAsset } from './runway';
import { renderVideo } from './creatomate';
import { App } from '@slack/bolt';

export const runVideoGenerationPipeline = async (ideaId: string, slackClient: App['client'], channelId?: string) => {
    console.log(`🚀 Starting pipeline for Idea: ${ideaId}`);

    // 1. Fetch Idea
    const { data: idea } = await supabase.from('ideas').select('*').eq('id', ideaId).single();
    if (!idea) {
        console.error('Idea not found');
        return;
    }

    // Notify Slack: Start
    if (channelId) {
        await slackClient.chat.postMessage({
            channel: channelId,
            text: `🎬 企画「${idea.title}」の動画生成を開始しました！\n1. 映像プロンプト生成中...`,
        });
    }

    try {
        // 2. Generate Visual Prompts
        const { promptA, promptB } = await createVisualPrompts(idea);
        console.log('Visual Prompts Created:', { promptA, promptB });

        // Notify Slack: Video Gen
        if (channelId) {
            await slackClient.chat.postMessage({
                channel: channelId,
                text: `2. Runwayで素材動画を生成中... (数分かかります) 🏃‍♂️💨\nPrompt A: ${promptA.substring(0, 50)}...\nPrompt B: ${promptB.substring(0, 50)}...`,
            });
        }

        // 3. Generate Videos via Runway (Parallel)
        // IMPORTANT: Check costs. For demo/dev, maybe only generate one or use placeholders if API Key missing.
        const [videoUrlA, videoUrlB] = await Promise.all([
            generateVideoAsset(promptA),
            generateVideoAsset(promptB)
        ]);

        if (!videoUrlA || !videoUrlB) {
            throw new Error('Failed to generate video assets from Runway');
        }

        // Notify Slack: Rendering
        if (channelId) {
            await slackClient.chat.postMessage({
                channel: channelId,
                text: `3. 素材生成完了！Creatomateで最終レンダリング中... 🎨`,
            });
        }

        // 4. Render Final Video via Creatomate
        const templateId = process.env.CREATOMATE_TEMPLATE_ID;
        if (!templateId) throw new Error('CREATOMATE_TEMPLATE_ID is missing');

        const finalVideoUrl = await renderVideo({
            templateId,
            modifications: {
                'Title': idea.title,
                'TextA': idea.option_a,
                'TextB': idea.option_b,
                'VideoA': videoUrlA,
                'VideoB': videoUrlB,
            },
        });

        if (!finalVideoUrl) {
            throw new Error('Failed to render final video');
        }

        // 5. Save to DB
        const { data: videoRecord, error: dbError } = await supabase
            .from('videos')
            .insert({
                idea_id: ideaId,
                file_path: finalVideoUrl,
                status: 'done'
            })
            .select()
            .single();

        if (dbError) console.error('DB Error:', dbError);

        // 6. Notify Slack: Finish!
        if (channelId) {
            await slackClient.chat.postMessage({
                channel: channelId,
                text: `✨ 動画が完成しました！\n${finalVideoUrl}`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `✨ *動画が完成しました！*\n<${finalVideoUrl}|視聴する>`,
                        },
                    },
                    {
                        type: 'actions',
                        elements: [
                            {
                                type: 'button',
                                text: { type: 'plain_text', text: '投稿予約へ進む (Post)', emoji: true },
                                style: 'primary',
                                action_id: 'start_posting_flow',
                                value: videoRecord?.id || finalVideoUrl // Pass Video ID
                            }
                        ]
                    }
                ]
            });
        }

    } catch (error: any) {
        console.error('Pipeline failed:', error);
        if (channelId) {
            await slackClient.chat.postMessage({
                channel: channelId,
                text: `❌ エラーが発生しました: ${error.message}`,
            });
        }
        // Update status to rejected or error
        await supabase.from('ideas').update({ status: 'rejected' }).eq('id', ideaId);
    }
};
