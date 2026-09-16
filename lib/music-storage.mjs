const dbName='openaigames-music';
let database;
async function db(){
 if(!database)database=new Promise((resolve,reject)=>{
  const request=indexedDB.open(dbName,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('audio');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>{database=null;reject(request.error);};
 });return database;
}
async function operation(mode,run){const database=await db();return new Promise((resolve,reject)=>{const transaction=database.transaction('audio',mode);const request=run(transaction.objectStore('audio'));transaction.oncomplete=()=>resolve(request?.result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});}
export const saveAudio=(id,file)=>operation('readwrite',store=>store.put(file,id));
export const readAudio=id=>operation('readonly',store=>store.get(id));
export const deleteAudio=id=>operation('readwrite',store=>store.delete(id));
