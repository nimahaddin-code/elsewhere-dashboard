import test from 'node:test';
import assert from 'node:assert/strict';
import {contentPlanConfig,contentPlanSlots} from '../lib/content-plan-data.ts';
import {findContentSlot,generateContent,xWeightedLength} from '../lib/content-generator.ts';

const product=(overrides={})=>({id:'p1',name:'The Ordinary Glycolic Acid 7% Toner',brand:'The Ordinary',category:'Beauty',product_type:'Toner',photo_url:'https://example.com/raw.jpg',...overrides});
const variant=(overrides={})=>({id:'v1',name:'240 ml',option1_value:'240 ml',price_idr:305000,photo_url:'https://example.com/variant.jpg',...overrides});
const slotByAngle=(angle)=>contentPlanSlots.find(slot=>slot.angle===angle);

test('workbook import contains exactly two unique slots for all 30 days',()=>{
 assert.equal(contentPlanSlots.length,60);
 assert.equal(new Set(contentPlanSlots.map(slot=>slot.id)).size,60);
 const dates=Map.groupBy(contentPlanSlots,slot=>slot.date);
 assert.equal(dates.size,30);
 for(const slots of dates.values()) assert.deepEqual(slots.map(slot=>slot.period).sort(),['Malam','Siang']);
});

test('date and period resolve exactly one slot',()=>{
 assert.equal(findContentSlot('2026-09-17','Siang')?.id,'KL-001');
 assert.equal(findContentSlot('2026-09-17','Malam')?.id,'KL-002');
 assert.equal(findContentSlot('2026-10-17','Siang'),null);
});

test('beauty slot uses selected variant price and raw variant image',()=>{
 const result=generateContent({slot:slotByAngle('BEAUTY FIND'),product:product(),variant:variant()});
 assert.equal(result.fallback_reason,null);
 assert.match(result.threads.copy,/Rp305\.000/);
 assert.equal(result.raw_product_image.reference,'https://example.com/variant.jpg');
 assert.equal(result.raw_product_image.is_raw,true);
});

test('fashion mismatch switches to neutral fallback without changing product',()=>{
 const result=generateContent({slot:slotByAngle('FASHION FIND'),product:product(),variant:variant()});
 assert.match(result.fallback_reason,/Kategori/);
 assert.equal(result.applied_angle,'NEUTRAL');
 assert.match(result.threads.copy,/The Ordinary/);
});

test('under 300k accepts eligible price and rejects boundary',()=>{
 const slot=slotByAngle('UNDER 300K');
 assert.equal(generateContent({slot,product:product(),variant:variant({price_idr:299000})}).fallback_reason,null);
 assert.match(generateContent({slot,product:product(),variant:variant({price_idr:300000})}).fallback_reason,/kurang dari/);
});

test('missing raw image becomes Needs Review and cannot be ready',()=>{
 const result=generateContent({slot:contentPlanSlots[0],product:product({photo_url:null}),variant:variant({photo_url:null})});
 assert.equal(result.status,'Needs Review');
 assert.equal(result.ready_to_publish,false);
 assert.ok(result.missing_fields.includes('raw_product_image'));
});

test('every generated post keeps exact WA URL once and respects channel limits',()=>{
 const result=generateContent({slot:contentPlanSlots[0],product:product({name:'A'.repeat(100)}),variant:variant()});
 assert.equal(result.x.posts.length,2);
 for(const post of [...result.threads.posts,...result.x.posts]) assert.equal(post.text.split(contentPlanConfig.waUrl).length-1,1);
 for(const post of result.x.posts) assert.ok(xWeightedLength(post.text)<=contentPlanConfig.xMaxLength);
 for(const post of result.threads.posts) assert.ok(Array.from(post.text).length<=contentPlanConfig.threadsMaxLength);
 assert.equal(result.validation.trip_preserved,true);
});
