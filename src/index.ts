import { App } from '@slack/bolt';
import dotenv from 'dotenv';
import { generateAndSaveIdeas } from './services/openai';

dotenv.config();

import { buildIdeaBlocks } from './services/ui';
import { supabase } from './supabase';
import { runVideoGenerationPipeline } from './services/pipeline';

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
});

// Command to manually trigger idea generation
app.command('/docchi_gen', async ({ ack, respond }) => {
    await ack();
    await respond('アイデア生成中... 🧠 (30秒ほどかかります)');

    try {
        const ideas = await generateAndSaveIdeas();
        if (!ideas || ideas.length === 0) {
            await respond('アイデア生成に失敗しました 😢');
            return;
        }

        const blocks = buildIdeaBlocks(ideas);
        await respond({ blocks, text: '新しいアイデアが届きました' });
    } catch (e) {
        console.error(e);
        await respond('エラーが発生しました 💥');
    }
});

// Handle Approval
app.action('approve_idea', async ({ ack, body, action, client }) => {
    await ack();
    const buttonAction = action as any;
    const ideaId = buttonAction.value;

    const { error } = await supabase
        .from('ideas')
        .update({ status: 'approved' })
        .eq('id', ideaId);

    if (error) {
        console.error('Error approving idea:', error);
        return;
    }

    const channelId = body.channel?.id;
    if (channelId) {
        await client.chat.postMessage({
            channel: channelId,
            text: `✅ 企画ID: ${ideaId} を採用しました！動画生成プロセスを開始します...`,
            thread_ts: (body as any).message?.ts
        });

        // Trigger Pipeline Asynchronously (Fire and Forget)
        // Note: Import runVideoGenerationPipeline at the top
        runVideoGenerationPipeline(ideaId, client, channelId).catch(err => {
            console.error('Async Pipeline Error:', err);
        });
    }
});

// Handle Post Now Button
app.action('start_posting_flow', async ({ ack, body, action, client }) => {
    await ack();
    const buttonAction = action as any;
    const videoUrlOrId = buttonAction.value; // In pipeline.ts we passed URL or ID

    // For simplicity in MVP, we just post to a hardcoded Publer Account or fetch first available.
    // In production, we'd show a modal to select accounts.

    await client.chat.postMessage({
        channel: body.channel?.id || '',
        text: `🚀 SNSへの投稿を開始します...`,
        thread_ts: (body as any).message?.ts
    });

    // 1. Get Accounts (For MVP, just log them or pick one)
    // const accounts = await getPublerAccounts(); 
    // const targetParams = { ... }

    // 2. Call Publer (Simulated for MVP unless Env var is set)
    // const postId = await schedulePost(...)

    // Stub response for now until Publer is fully configured
    await client.chat.postMessage({
        channel: body.channel?.id || '',
        text: `⚠️ Publer連携は設定待ちです。\nVideo: ${videoUrlOrId}`,
        thread_ts: (body as any).message?.ts
    });
});

// Handle Rejection
app.action('reject_idea', async ({ ack, body, action, client }) => {
    await ack();
    const buttonAction = action as any;
    const ideaId = buttonAction.value;

    await supabase.from('ideas').update({ status: 'rejected' }).eq('id', ideaId);

    const channelId = body.channel?.id;
    if (channelId) {
        await client.chat.postMessage({
            channel: channelId,
            text: `🗑️ 企画ID: ${ideaId} を却下しました。`,
            thread_ts: (body as any).message?.ts
        });
    }
});

(async () => {
    await app.start(process.env.PORT || 3000);
    console.log('⚡️ Bolt app is running!');
})();
