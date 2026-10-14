import { test, expect, describe } from 'bun:test';
import { parseDeepLink, conversationDeepLink, isDeepLink } from '../../src/client/utils/deep-link';

describe('parseDeepLink', () => {
    test('routes a conversation link to its conversation', () => {
        expect(parseDeepLink('pipali://chat/9093ca2b-7f9d-43e0-998f-49dfbd7b6038')).toEqual({
            kind: 'chat',
            conversationId: '9093ca2b-7f9d-43e0-998f-49dfbd7b6038',
        });
    });

    test('routes the link the MCP OAuth flow returns on', () => {
        expect(parseDeepLink('pipali://tools')).toEqual({ kind: 'tools' });
        expect(parseDeepLink('pipali://tools/')).toEqual({ kind: 'tools' });
    });

    test('names no view for links it does not know', () => {
        expect(parseDeepLink('pipali://chat/')).toBeNull();
        expect(parseDeepLink('pipali://settings')).toBeNull();
        expect(parseDeepLink('https://pipali.ai/chat/abc')).toBeNull();
    });

    test('round-trips the link copied from a conversation', () => {
        const id = '9093ca2b-7f9d-43e0-998f-49dfbd7b6038';
        expect(parseDeepLink(conversationDeepLink(id))).toEqual({ kind: 'chat', conversationId: id });
    });
});

describe('isDeepLink', () => {
    test('tells our links apart from the ones the browser opens', () => {
        expect(isDeepLink('pipali://chat/abc')).toBe(true);
        expect(isDeepLink('https://pipali.ai')).toBe(false);
        expect(isDeepLink('file:///tmp/notes.md')).toBe(false);
        expect(isDeepLink(undefined)).toBe(false);
    });
});
