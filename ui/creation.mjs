import {creationMethods, creationLabel} from '../lib/creation.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const creationDisclosure = '依据投稿声明与补充材料标注，不代表平台认证。';
export function creationBadge(project) {
  const method = Object.hasOwn(creationMethods, project.creation_method) ? project.creation_method : 'undeclared';
  return `<span class="creation-badge" data-creation-method="${method}" title="${creationDisclosure}"><span>制作方式</span><span aria-hidden="true"> · </span><span>${creationLabel(method)}</span></span>`;
}
export function creationDetails(project) {
  return `<section class="title-instructions creation-details"><h2>制作方式</h2><p>${creationBadge(project)}</p>${project.creation_method === 'human' ? '<p>人工制作表示声明未使用生成式 AI；可以使用常规引擎和开发工具。</p>' : ''}${project.creation_note ? `<p class="creation-note" data-i18n-ignore>${esc(project.creation_note)}</p>` : ''}<small>${creationDisclosure}</small></section>`;
}
export function creationOptions(value='undeclared', locale='zh') {
  return Object.keys(creationMethods).map(key => `<option value="${key}" ${key===value?'selected':''}>${creationLabel(key,locale)}</option>`).join('');
}
