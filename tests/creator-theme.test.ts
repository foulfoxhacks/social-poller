import {test} from 'node:test';
import assert from 'node:assert/strict';
import {page,embedScript} from '../src/ui.ts';
import {empty,owners} from '../src/model.ts';
import {creatorThemeCss} from '../src/creator-theme.ts';
test('creator embed theme is opt-in without changing metric markup or default pages',()=>{
 const profile=empty('instagram',owners.instagram);
 const plain=page('https://example.test',profile,undefined,true);
 const warm=page('https://example.test',profile,undefined,true,'cards',undefined,true);
 assert.ok(!plain.includes('class="theme-creator"'));
 assert.equal(warm.replace(' class="theme-creator"',''),plain);
 assert.match(creatorThemeCss,/#ffc857/);
 assert.doesNotMatch(creatorThemeCss,/url\(|@import|animation/);
 assert.match(embedScript,/node\.dataset\.theme==='creator'/);
});
