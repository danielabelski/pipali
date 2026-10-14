/**
 * Pipali deep links (pipali://...). The OS hands us these when they are opened
 * from outside the app; links inside a conversation raise them as a window
 * event instead, since a webview cannot navigate to a custom scheme. Both
 * sources route through parseDeepLink, so a link behaves the same either way.
 */

const DEEP_LINK_SCHEME = 'pipali://';

/** Window event carrying a deep link clicked inside the app. */
const IN_APP_DEEP_LINK_EVENT = 'pipali:deep-link';

export type DeepLinkTarget =
    | { kind: 'tools' }
    | { kind: 'chat'; conversationId: string };

export function conversationDeepLink(conversationId: string): string {
    return `${DEEP_LINK_SCHEME}chat/${conversationId}`;
}

export function isDeepLink(url: string | undefined | null): url is string {
    return !!url && url.startsWith(DEEP_LINK_SCHEME);
}

/** Resolve a deep link to the view it opens, or null when it names no known view. */
export function parseDeepLink(url: string): DeepLinkTarget | null {
    if (/^pipali:\/\/tools\/?$/.test(url)) return { kind: 'tools' };

    const chat = url.match(/^pipali:\/\/chat\/([a-zA-Z0-9-]+)/);
    if (chat?.[1]) return { kind: 'chat', conversationId: chat[1] };

    return null;
}

/** Hand a deep link clicked inside the app to whoever is routing them. */
export function dispatchInAppDeepLink(url: string): void {
    window.dispatchEvent(new CustomEvent(IN_APP_DEEP_LINK_EVENT, { detail: url }));
}

export function onInAppDeepLink(handler: (url: string) => void): () => void {
    const listener = (event: Event) => handler((event as CustomEvent<string>).detail);
    window.addEventListener(IN_APP_DEEP_LINK_EVENT, listener);
    return () => window.removeEventListener(IN_APP_DEEP_LINK_EVENT, listener);
}
