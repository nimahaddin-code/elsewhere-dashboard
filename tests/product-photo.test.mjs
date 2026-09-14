import test from 'node:test';
import assert from 'node:assert/strict';
import {productPhoto} from '../lib/product-photo.ts';
test('photo follows selected variant and falls back for blank or missing links',()=>{
 const p={photo_url:'https://example.com/product.jpg'};
 assert.equal(productPhoto({photo_url:'https://example.com/blue.jpg'},p),'https://example.com/blue.jpg');
 assert.equal(productPhoto({photo_url:'https://example.com/red.jpg'},p),'https://example.com/red.jpg');
 for(const v of [undefined,{}, {photo_url:null},{photo_url:'  '},{photo_url:'javascript:alert(1)'}]) assert.equal(productPhoto(v,p),p.photo_url);
 assert.equal(productPhoto(undefined,{}),'');
});
