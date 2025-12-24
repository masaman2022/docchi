import { Block, KnownBlock } from '@slack/types';

export const buildIdeaBlocks = (ideas: any[]): (Block | KnownBlock)[] => {
    const blocks: (Block | KnownBlock)[] = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: '🧠 本日の「究極の2択」案が生成されました！',
                emoji: true,
            },
        },
        {
            type: 'divider',
        },
    ];

    ideas.forEach((idea) => {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${idea.title}*\n🅰️ ${idea.option_a}\n🅱️ ${idea.option_b}`,
            },
        });

        blocks.push({
            type: 'actions',
            elements: [
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: '採用 (Approve)',
                        emoji: true,
                    },
                    style: 'primary',
                    value: idea.id,
                    action_id: 'approve_idea',
                },
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: '却下 (Reject)',
                        emoji: true,
                    },
                    style: 'danger',
                    value: idea.id,
                    action_id: 'reject_idea',
                },
            ],
        });

        blocks.push({ type: 'divider' });
    });

    return blocks;
};
