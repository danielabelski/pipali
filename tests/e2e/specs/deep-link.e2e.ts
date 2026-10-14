/**
 * Deep Link Tests
 *
 * A pipali://chat/<id> link inside a conversation opens that conversation.
 * The link survives markdown's URL sanitizer and routes in the app, rather
 * than navigating the webview to a scheme it cannot load.
 */

import { test, expect, type Page } from '@playwright/test';
import { ChatPage } from '../helpers/page-objects';

/** Seed a conversation whose agent reply is `reply`, and return its id. */
async function seedConversation(page: Page, title: string, reply: string): Promise<string> {
    const response = await page.request.post('/api/conversations/import/atif', {
        data: {
            title,
            atifData: JSON.stringify({
                schema_version: 'ATIF-v1.4',
                session_id: `${title}-session`,
                agent: { name: 'pipali', version: '1.0.0', model_name: 'test-model' },
                steps: [
                    { step_id: 1, timestamp: '2024-01-01T10:00:01Z', source: 'user', message: 'hi' },
                    { step_id: 2, timestamp: '2024-01-01T10:00:02Z', source: 'agent', message: reply },
                ],
            }),
        },
    });
    expect(response.ok()).toBe(true);
    return (await response.json()).conversationId;
}

test.describe('Deep links between conversations', () => {
    test('opens the linked conversation when clicked in a conversation', async ({ page }) => {
        const chatPage = new ChatPage(page);
        const targetId = await seedConversation(page, 'Deep link target', 'Answering from the target conversation.');
        const sourceId = await seedConversation(
            page,
            'Deep link source',
            `Continued in [the other chat](pipali://chat/${targetId}).`
        );

        await page.goto(`/?conversationId=${sourceId}`);
        await chatPage.waitForConnection();

        const link = page.locator('.message-content a', { hasText: 'the other chat' });
        await expect(link).toHaveAttribute('href', `pipali://chat/${targetId}`);

        await link.click();

        // Routed in place: the target's messages render and the URL follows,
        // with no reload back to the conversation we came from.
        await expect(page.locator(`.message-content:has-text("Answering from the target conversation.")`)).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`conversationId=${targetId}`));
    });
});
