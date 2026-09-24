import { test, expect, describe } from 'bun:test';
import { parseConfirmationIntent, parseGoAhead, parseAddressing, parseStopWork, normalizeUtterance, routeOpenVoice } from '../../src/client/utils/voice/voice-intent';

describe('parseStopWork', () => {
    test('recognizes the stop vocabulary', () => {
        for (const s of ['stop', 'Stop.', 'stop it', 'hold on', 'wait', 'never mind', 'that’s enough', 'please stop']) {
            expect(parseStopWork(s)).toBe(true);
        }
    });

    test('a sentence merely containing one does not abandon work in flight', () => {
        for (const s of ['wait for the build to finish', 'stop the server after deploying', 'do not stop']) {
            expect(parseStopWork(s)).toBe(false);
        }
    });

    test('stopping work is distinct from stopping the voice session', () => {
        expect(parseStopWork('stop listening')).toBe(false);
        expect(parseConfirmationIntent('stop listening', { isQuestion: false }).type).toBe('stop_listening');
    });
});

describe('normalizeUtterance', () => {
    test('lowercases, strips punctuation/apostrophes, and drops filler', () => {
        expect(normalizeUtterance('Um, Yes please!')).toBe('yes');
        expect(normalizeUtterance("Don't ask again.")).toBe('dont ask again');
        expect(normalizeUtterance('   ')).toBe('');
    });
});

describe('parseGoAhead', () => {
    test('accepts affirmatives, details requests, and readiness phrases', () => {
        for (const s of ['yes', 'ok', 'go ahead', 'sure', 'details', 'tell me', 'ready', 'go on']) {
            expect(parseGoAhead(s)).toBe(true);
        }
    });
    test('rejects empty or unrelated speech', () => {
        expect(parseGoAhead('')).toBe(false);
        expect(parseGoAhead('what is the meaning of life')).toBe(false);
    });
});

describe('routeOpenVoice', () => {
    test('a wake phrase only reads pending content that has not been heard', () => {
        // `false`: something is pending but unread, so a wake/readiness phrase permits the readout.
        expect(routeOpenVoice('', false)).toBe('speak_pending');
        expect(routeOpenVoice('go ahead', false)).toBe('speak_pending');

        // `true`: the pending content was already read, so the same phrases start its reply.
        expect(routeOpenVoice('', true)).toBe('reply');
        expect(routeOpenVoice('go ahead', true)).toBe('reply');
    });

    test('addressed content routes to the pending reply or a new message', () => {
        // Other speech answers the pending item even if its readout has not played yet.
        expect(routeOpenVoice('use the staging bucket', false)).toBe('reply');

        // `null`: nothing is pending, so addressed speech starts a new chat message.
        expect(routeOpenVoice('summarize this', null)).toBe('compose');
    });
});

describe('parseAddressing', () => {
    test('matches the address word with payload extraction', () => {
        expect(parseAddressing('Pipali, also check the logs')).toEqual({ addressed: true, payload: 'also check the logs' });
        expect(parseAddressing('pipali go ahead')).toEqual({ addressed: true, payload: 'go ahead' });
    });

    test('allows lead-ins like hey/ok', () => {
        expect(parseAddressing('Hey Pipali, what is pending?')).toEqual({ addressed: true, payload: 'what is pending?' });
        expect(parseAddressing('Okay Pipali')).toEqual({ addressed: true, payload: '' });
    });

    test('tolerates STT mangling of the proper noun', () => {
        expect(parseAddressing('Bipali, summarize this').addressed).toBe(true);
        expect(parseAddressing('Pipally check the deploy').addressed).toBe(true);
        expect(parseAddressing('Pip ali, run the report').addressed).toBe(true);
    });

    // Verbatim transcripts of synthesized "Pipali" utterances returned by the
    // speech model the platform serves. It hears the name as "people" plus a
    // vowel, which is four to five letter edits from the spelling and so was
    // rejected outright, taking the wake phrase with it.
    test('matches the renderings the speech model actually returns', () => {
        expect(parseAddressing('Hey peopley!')).toEqual({ addressed: true, payload: '' });
        expect(parseAddressing('Peoply, go ahead.')).toEqual({ addressed: true, payload: 'go ahead.' });
        expect(parseAddressing('Peoplely, summarize this file.').addressed).toBe(true);
        expect(parseAddressing('Hey peopley, what is on my calendar?')).toEqual({
            addressed: true,
            payload: 'what is on my calendar?',
        });
        for (const s of ['Ok, pipili.', 'Ok, Peeply.', 'Hi Peepali, are you there?', 'Hi Peabolly, are you there?']) {
            expect(parseAddressing(s).addressed).toBe(true);
        }
        // The closing /i/ however it lands in spelling, silent "e" excepted.
        for (const w of ['Peepalee', 'Peoplie', 'Peopley', 'Peoply', 'Pipali']) {
            expect(parseAddressing(`${w}, run it`)).toEqual({ addressed: true, payload: 'run it' });
        }
        // How the name came out of real dictation.
        for (const w of ['Pipli', 'Piply', 'Pipley']) {
            expect(parseAddressing(`Hey ${w}, run it`)).toEqual({ addressed: true, payload: 'run it' });
        }
    });

    test('tolerates punctuation inside the name', () => {
        expect(parseAddressing('People.ly, summarize this file.')).toEqual({
            addressed: true,
            payload: 'summarize this file.',
        });
    });

    test('tolerates a mangled lead-in', () => {
        expect(parseAddressing('Hei, peopley!').addressed).toBe(true);
        expect(parseAddressing('Okey Pipali, run it')).toEqual({ addressed: true, payload: 'run it' });
    });

    test('steps over filler before the name', () => {
        expect(parseAddressing('Um, Pipali, check the logs')).toEqual({ addressed: true, payload: 'check the logs' });
        expect(parseAddressing('Well, people are saying it is fine').addressed).toBe(false);
    });

    // The price of matching by sound: the words sharing the name's consonants
    // must stay out, or a room conversation wakes the session.
    test('rejects the ordinary words that share the name’s consonants', () => {
        for (const s of ['people are saying it is fine', 'pupils dilate in the dark', 'apply the patch', 'supply the token', 'reply to the thread', 'puppy is asleep']) {
            expect(parseAddressing(s).addressed).toBe(false);
        }
        // These have the name's p and l, but not its second p.
        for (const s of ['Play some music', 'Please play the next one', 'Polly wants a cracker', 'Paulie is coming over', 'Poly bags are cheaper']) {
            expect(parseAddressing(s).addressed).toBe(false);
        }
    });

    // A split name merges with the word after it, which must not get to supply
    // the closing /i/.
    test('rejects a name-like word followed by one that sounds like its ending', () => {
        for (const s of ['People I know say so', 'Paul, I think so', 'People lie all the time']) {
            expect(parseAddressing(s).addressed).toBe(false);
        }
    });

    test('rejects unaddressed ambient speech', () => {
        for (const s of ['the pipeline is broken', 'happily ever after', 'yes, exactly', 'can you pass the salt', '']) {
            expect(parseAddressing(s).addressed).toBe(false);
        }
    });

    test('requires the address word at the start, not mid-sentence', () => {
        expect(parseAddressing('I told Pipali to check it').addressed).toBe(false);
    });
});

describe('parseConfirmationIntent (non-question)', () => {
    const opts = { isQuestion: false };

    test('approve words', () => {
        for (const s of ['yes', 'yeah', 'go ahead', 'do it', 'proceed', 'confirm']) {
            expect(parseConfirmationIntent(s, opts)).toEqual({ type: 'approve' });
        }
    });

    test('decline words', () => {
        for (const s of ['no', 'nope', 'cancel', 'reject', 'never mind']) {
            expect(parseConfirmationIntent(s, opts)).toEqual({ type: 'decline' });
        }
    });

    test('"don\'t ask again" → approve_dont_ask', () => {
        expect(parseConfirmationIntent("yes, don't ask again", opts)).toEqual({ type: 'approve_dont_ask' });
        expect(parseConfirmationIntent('always', opts)).toEqual({ type: 'approve_dont_ask' });
    });

    test('details and repeat', () => {
        expect(parseConfirmationIntent('details', opts)).toEqual({ type: 'details' });
        expect(parseConfirmationIntent('tell me more', opts)).toEqual({ type: 'details' });
        expect(parseConfirmationIntent('say again', opts)).toEqual({ type: 'repeat' });
    });

    test('stop listening', () => {
        expect(parseConfirmationIntent('stop listening', opts)).toEqual({ type: 'stop_listening' });
        expect(parseConfirmationIntent('turn off voice', opts)).toEqual({ type: 'stop_listening' });
        expect(parseConfirmationIntent('please stop listening', opts)).toEqual({ type: 'stop_listening' });
    });

    test('mode switches', () => {
        expect(parseConfirmationIntent('speak freely', opts)).toEqual({ type: 'set_mode', mode: 'speak_freely' });
        expect(parseConfirmationIntent('Ask first!', opts)).toEqual({ type: 'set_mode', mode: 'ask_first' });
        expect(parseConfirmationIntent('please ask before speaking', opts)).toEqual({ type: 'set_mode', mode: 'ask_first' });
    });

    test('mode switch requires the whole utterance, not a substring', () => {
        for (const s of ['you can speak freely with me', 'lets ask first thing tomorrow']) {
            expect(parseConfirmationIntent(s, opts)).toEqual({ type: 'guidance', text: s });
        }
    });

    test('stop-listening requires the whole utterance, not a substring', () => {
        // Hallucinated/ambient sentences containing the phrase must not kill voice.
        for (const s of [
            'key phrases: pipali, over to you, stop listening, cancel that',
            'you should stop listening to that podcast',
        ]) {
            expect(parseConfirmationIntent(s, opts)).toEqual({ type: 'guidance', text: s });
        }
    });

    test('free-form utterances become guidance with original text', () => {
        const text = 'use the staging bucket instead';
        expect(parseConfirmationIntent(text, opts)).toEqual({ type: 'guidance', text });
    });

    test('"stop" alone is a decline, "stop listening" is not', () => {
        expect(parseConfirmationIntent('stop', opts)).toEqual({ type: 'decline' });
        expect(parseConfirmationIntent('stop listening', opts)).toEqual({ type: 'stop_listening' });
    });
});

describe('parseConfirmationIntent (question / ask_user)', () => {
    const opts = { isQuestion: true };

    test('a yes/no answer to a question is guidance, not approve/decline', () => {
        expect(parseConfirmationIntent('yes', opts)).toEqual({ type: 'guidance', text: 'yes' });
        expect(parseConfirmationIntent('no', opts)).toEqual({ type: 'guidance', text: 'no' });
    });

    test('free-form answer is guidance', () => {
        const text = 'the production database';
        expect(parseConfirmationIntent(text, opts)).toEqual({ type: 'guidance', text });
    });

    test('universal commands still work for questions', () => {
        expect(parseConfirmationIntent('stop listening', opts)).toEqual({ type: 'stop_listening' });
        expect(parseConfirmationIntent('repeat', opts)).toEqual({ type: 'repeat' });
        expect(parseConfirmationIntent('speak freely', opts)).toEqual({ type: 'set_mode', mode: 'speak_freely' });
    });
});
