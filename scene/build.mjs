import { build } from 'esbuild';
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Mesh } from 'three';
import { television, consoleModel, controller, cartridge, brochure } from './models.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(data=>{this.result='data:'+blob.type+';base64,'+Buffer.from(data).toString('base64');this.onloadend?.();});}};
await mkdir(resolve(root,'static/models'),{recursive:true});
const exporter=new GLTFExporter();let counts={};
function batchStatic(group){
 const keep=new Set(['cart_shell','cart_top_lip','cart_art','cart_title','screen_surface','power_light','manual_cover']);
 const batches=new Map();group.updateMatrixWorld(true);
 for(const mesh of [...group.children]){
  if(!mesh.isMesh||mesh.userData.action||mesh.userData.direction||keep.has(mesh.name)||/label|brand/.test(mesh.name))continue;
  const geometry=(mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()).applyMatrix4(mesh.matrix);
  if(!batches.has(mesh.material))batches.set(mesh.material,[]);batches.get(mesh.material).push(geometry);group.remove(mesh);
 }
 for(const [material,geometries] of batches){const mesh=new Mesh(mergeGeometries(geometries),material);mesh.name='static_'+material.color.getHexString();mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
}
for(const [name,factory] of Object.entries({television,console:consoleModel,controller,cartridge,manual:brochure})){
 const group=factory();batchStatic(group);let meshes=0,triangles=0;group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
 const buffer=await exporter.parseAsync(group,{binary:true,onlyVisible:true});await writeFile(resolve(root,'static/models/'+name+'.glb'),Buffer.from(buffer));counts[name]={bytes:buffer.byteLength,meshes,triangles};
}
await writeFile(resolve(root,'static/models/manifest.json'),JSON.stringify({generator:'OpenAIGames procedural hard-surface models',three:'0.186.0',models:counts},null,2));
await copyFile(resolve(root,'node_modules/three/LICENSE'),resolve(root,'static/models/THREE-LICENSE.txt'));
await build({entryPoints:[resolve(root,'scene/scene.mjs')],outfile:resolve(root,'static/scene3d.js'),bundle:true,minify:true,format:'esm',target:['es2022'],sourcemap:false,legalComments:'eof'});
console.log(JSON.stringify(counts,null,2));
