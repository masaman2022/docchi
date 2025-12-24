import { App } from '@slack/bolt';
import dotenv from 'dotenv';
import { createServer } from 'http'; // For Render health checks

import { generateAndSaveIdeas } from './services/openai';
import { supabase } from './supabase';
import { buildIdeaBlocks } from './services/ui';
import { runVideoGenerationPipeline } from './services/pipeline';

dotenv.config();

// --- Health Check Server for Render.com ---
const server = createServer((req, res) => {
    res.writeHead(200);
    res.end('Health check OK');
});
const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Health check server listening on port ${port}`);
});
// ------------------------------------------

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
});

app.command('/docchi_gen', async ({ command, ack, client }) => {
    await ack();

    await client.chat.postMessage({
        channel: command.channel_id,
        text: 'アイデア生成中... 🧠 (30秒ほどかかります)',
    });

    try {
        const ideas = await generateAndSaveIdeas();

        if (!ideas || ideas.length === 0) {
            // Note: If generateAndSaveIdeas returns [], it usually means an error occurred but was caught.
            // Check logs or modify service to throw.
            throw new Error('アイデアが0件でした。OpenAIまたはSupabaseの接続を確認してください。');
        }

        const blocks = buildIdeaBlocks(ideas);

        await client.chat.postMessage({
            channel: command.channel_id,
            text: '究極の2択のアイデアが生成されました！',
            blocks: blocks,
        });
    } catch (error: any) {
        console.error(error);
        await client.chat.postMessage({
            channel: command.channel_id,
            text: `⚠️ エラーが発生しました:\n\`\`\`${error.message}\`\`\``,
        });
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
