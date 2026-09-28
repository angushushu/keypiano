// Thin wrapper over the Google Analytics tag loaded in index.html. The tag is
// missing whenever it is blocked (ad blockers, mainland China networks), so
// every call is best-effort and must never interfere with playing.

type EventParams = Record<string, string | number | boolean>;

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
    }
}

export const trackEvent = (name: string, params: EventParams = {}) => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    try {
        window.gtag('event', name, params);
    } catch {
        // Analytics is optional; a failing tag must not surface to the player.
    }
};
