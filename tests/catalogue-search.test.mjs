import test from 'node:test';
import assert from 'node:assert/strict';
import {filterCatalogue, catalogueCategoryNames} from '../lib/catalogue-search.ts';
const products = [
 {name:'Café Tote',product_code:'EW-10',brand:'PDI',category:'Tas',status:'Draft',published:false},
 {name:'Cotton Shirt',product_code:'EW-2',brand:'PDI',category:'Pakaian',status:'Ready',published:true},
 {name:'Chocolate',product_code:'EW-3',brand:'',category:'Makanan',status:'Archived',published:false},
];
const find=(q='',category='Semua kategori',brand='Semua brand',status='all',sort='default')=>filterCatalogue(products,q,category,brand,status,sort);
test('search matches name, code, brand and category, ignoring case, accents and surrounding whitespace',()=>{
 for(const q of ['cafe','  CAFÉ  ','ew-10','tas','PDI tote']) assert.deepEqual(find(q),[products[0]]);
 assert.equal(find('PDI').length,2);
 assert.deepEqual(find('tanpa brand'),[products[2]]);
 assert.equal(find('not-present').length,0);
});
test('search tokens combine across fields and intersect all selected filters',()=>{
 assert.deepEqual(find('shirt pdi','Pakaian','PDI','published'),[products[1]]);
 assert.equal(find('shirt','Tas').length,0);
 assert.equal(find('shirt','Pakaian','PDI','Draft').length,0);
 assert.equal(find('shirt','Pakaian','Tanpa brand').length,0);
 assert.equal(find('PDI chocolate').length,0);
});
test('publication and editorial statuses remain distinct and resetting includes all products',()=>{
 assert.deepEqual(find('','Semua kategori','Semua brand','Draft'),[products[0]]);
 assert.deepEqual(find('','Semua kategori','Semua brand','unpublished'),[products[0],products[2]]);
 assert.deepEqual(find('','Semua kategori','Semua brand','Archived'),[products[2]]);
 assert.deepEqual(find('   '),products);
});
test('sorts names and numeric codes without mutating catalogue data',()=>{
 const original=products.slice();
 assert.deepEqual(find('','Semua kategori','Semua brand','all','code').map(p=>p.product_code),['EW-2','EW-3','EW-10']);
 assert.deepEqual(find('','Semua kategori','Semua brand','all','name').map(p=>p.name),['Café Tote','Chocolate','Cotton Shirt']);
 assert.deepEqual(products,original);
});
test('category navigation includes products with categories missing from settings and handles empty data',()=>{
 assert.deepEqual(catalogueCategoryNames(products,['Pakaian','Tas']),['Pakaian','Tas','Makanan']);
 assert.deepEqual(filterCatalogue([], 'anything','Semua kategori','Semua brand','all'),[]);
});
