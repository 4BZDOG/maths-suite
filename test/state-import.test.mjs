// =============================================================
// test/state-import.test.mjs — topic slugs + imported-config sanitisation
//
// Guards the two pieces of core/state.js that protect against untrusted
// .json config imports and DOM-id drift (the slug previously existed as
// 4+ hand-copied regexes; one divergent copy broke undo for
// 'Ratios & Rates').
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    topicSlug, subOpDomId, sanitizeImportedState, state, ALL_SUBTOPICS,
} from '../core/state.js';

test('topicSlug strips whitespace and punctuation consistently', () => {
    assert.equal(topicSlug('Ratios & Rates'), 'Ratios--Rates');
    assert.equal(topicSlug('Non-linear Relationships'), 'Non-linear-Relationships');
    assert.equal(topicSlug('Integers'), 'Integers');
    // Every live topic must produce a non-empty, id-safe slug
    for (const t of ALL_SUBTOPICS) {
        const slug = topicSlug(t);
        assert.match(slug, /^[a-zA-Z0-9-]+$/, `bad slug for ${t}`);
    }
});

test('subOpDomId matches the id scheme used across state/history/main', () => {
    assert.equal(subOpDomId('Ratios & Rates', 'simplify'), 'subop-Ratios--Rates-simplify');
});

test('sanitizeImportedState rejects non-objects', () => {
    assert.equal(sanitizeImportedState(null), null);
    assert.equal(sanitizeImportedState('"a string"'), null);
    assert.equal(sanitizeImportedState([1, 2, 3]), null);
});

test('sanitizeImportedState keeps known keys and strips unknown ones', () => {
    const out = sanitizeImportedState({
        selectedTopics: { Integers: true },
        stage: 'Stage 5',
        evil: 'payload',
        settings: { title: 'My Quiz', cols: 3, injectedKey: 'x' },
    });
    assert.deepEqual(out.selectedTopics, { Integers: true });
    assert.equal(out.stage, 'Stage 5');
    assert.equal(out.evil, undefined);
    assert.equal(out.settings.title, 'My Quiz');
    assert.equal(out.settings.cols, 3);
    assert.equal(out.settings.injectedKey, undefined);
});

test('sanitizeImportedState validates the watermark data URL', () => {
    const img = sanitizeImportedState({ watermarkSrc: 'data:image/png;base64,AAA=' });
    assert.equal(img.watermarkSrc, 'data:image/png;base64,AAA=');

    const html = sanitizeImportedState({ watermarkSrc: 'data:text/html,<script>1</script>' });
    assert.equal(html.watermarkSrc, undefined);

    const url = sanitizeImportedState({ settings: { watermarkSrc: 'https://evil.example/x.png' } });
    assert.equal(url.settings.watermarkSrc, undefined);
});

test('sanitizeImportedState normalises legacy flat configs into settings', () => {
    const out = sanitizeImportedState({ title: 'Old Flat Config', cols: 2, junk: true });
    assert.equal(out.settings.title, 'Old Flat Config');
    assert.equal(out.settings.cols, 2);
    assert.equal(out.settings.junk, undefined);
});

test('export payload shape round-trips through the sanitizer unchanged', () => {
    // Mirrors import-export/exportConfig.js downloadConfig()
    const payload = JSON.parse(JSON.stringify({
        selectedTopics:   state.selectedTopics,
        selectedSubOps:   state.selectedSubOps,
        selectedOutcomes: state.selectedOutcomes,
        stage:            state.stage,
        includePath:      state.includePath,
        questionsPerSet:  state.questionsPerSet,
        settings:         state.settings,
        watermarkSrc:     state.watermarkSrc,
    }));
    const out = sanitizeImportedState(payload);
    assert.deepEqual(out, payload);
});
