import { translate, matchesGame } from '../lib/i18n.mjs';

const storageKey = 'openaigames-language';
const queryLocale = new URLSearchParams(location.search).get('lang');
let saved;
try { saved = localStorage.getItem(storageKey); } catch {}
let locale = ['zh','en'].includes(queryLocale) ? queryLocale : ['zh','en'].includes(saved) ? saved : navigator.language?.startsWith('zh') ? 'zh' : 'en';
const originals = new WeakMap();
const attrs = ['placeholder','aria-label','title','alt'];
const ignore = 'script,style,textarea,[contenteditable],[data-i18n-ignore],.board-note>p,.board-note footer,.note-avatar';
const observer = new MutationObserver(records => {
  // Disconnect while translating so our own writes never become application source.
  observer.disconnect();
  const roots = new Set();
  for (const record of records) {
    if (record.type === 'characterData') updateText(record.target);
    else if (record.type === 'attributes') updateAttributes(record.target);
    else { for (const node of record.addedNodes) roots.add(node); }
  }
  for (const root of roots) walk(root);
  observe();
});
function store(node, key, current) {
  let record = originals.get(node); if (!record) {record = {}; originals.set(node,record);}
  if (!record[key] || record[key].output !== current) record[key] = {source:current,output:current};
  return record[key];
}
function updateText(node) {
  const parent = node.parentElement;
  if (!parent || parent.closest(ignore) || !node.data.trim()) return;
  const entry = store(node,'text',node.data);
  entry.output = translate(entry.source,locale);
  if (node.data !== entry.output) node.data = entry.output;
}
function updateAttributes(element) {
  if (element.closest(ignore.replace('textarea,',''))) return;
  for (const name of attrs) if (element.hasAttribute(name)) {
    const entry = store(element,name,element.getAttribute(name));
    entry.output = translate(entry.source,locale);
    if (element.getAttribute(name) !== entry.output) element.setAttribute(name,entry.output);
  }
  if (element.matches('time[datetime]')) {
    const date = new Date(element.dateTime);
    if (!Number.isNaN(date.getTime())) element.textContent = date.toLocaleString(locale==='en'?'en-US':'zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  if (element.matches('[data-language-toggle]')) {
    element.textContent = locale === 'en' ? '中文' : 'EN';
    element.setAttribute('aria-label',locale === 'en'?'切换到中文':'Switch to English');
    element.setAttribute('lang',locale === 'en'?'zh-CN':'en');
  }
}
function walk(root) {
  if (root.nodeType === Node.TEXT_NODE) { updateText(root);return; }
  if (![Node.ELEMENT_NODE,Node.DOCUMENT_NODE].includes(root.nodeType)) return;
  if (root.nodeType===Node.ELEMENT_NODE) updateAttributes(root);
  if (root.nodeType===Node.ELEMENT_NODE && root.closest(ignore)) return;
  for (const child of root.childNodes) walk(child);
}
function observe() { observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attrs}); }
function apply() {
  observer.disconnect();
  document.documentElement.lang = locale === 'en'?'en':'zh-CN';
  document.documentElement.dataset.language = locale;
  walk(document);
  const meta = document.querySelector('meta[name="description"]');
  if(meta) {const entry=store(meta,'content',meta.content);entry.output=translate(entry.source,locale);meta.content=entry.output;}
  observe();
}
function setLocale(next) {
  if (!['zh','en'].includes(next)) return;
  locale = next;
  try { localStorage.setItem(storageKey,locale); } catch {}
  const url = new URL(location.href);url.searchParams.set('lang',locale);history.replaceState(history.state,'',url);
  apply(); window.dispatchEvent(new CustomEvent('openaigames-language',{detail:{locale}}));
}
function formMessage(element){
  const validity=element.validity;if(!validity||validity.valid)return '';
  if(validity.valueMissing)return element.type==='checkbox'?'请确认后继续。':'请填写此项。';
  if(validity.typeMismatch&&element.type==='url')return '请填写完整的网址。';
  return '请按要求填写此项。';
}
document.addEventListener('invalid',event=>{const element=event.target;if(element.setCustomValidity)element.setCustomValidity(translate(formMessage(element),locale));},true);
document.addEventListener('input',event=>event.target.setCustomValidity?.(''));
window.addEventListener('openaigames-language',()=>{
  for(const element of document.querySelectorAll('input,textarea,select'))if(element.validity.customError){element.setCustomValidity('');element.setCustomValidity(translate(formMessage(element),locale));}
});
document.addEventListener('click',event=>{if(event.target.closest('[data-language-toggle]'))setLocale(locale==='en'?'zh':'en');});
window.addEventListener('popstate',()=>{const next=new URLSearchParams(location.search).get('lang');if(['zh','en'].includes(next)&&next!==locale)setLocale(next);});
window.OpenAIGamesI18n=Object.freeze({get locale(){return locale;},t:source=>translate(source,locale),english:source=>translate(source,'en'),matchesGame,setLocale,apply});
apply();
