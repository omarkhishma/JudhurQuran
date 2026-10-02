// Shared header model for Jadhr pages (data only — each page renders it from its template).
export const NAV = [
  ['Read', 'Lexicon%20Reader%20v5.dc.html'], ['Explore', 'Collections.dc.html'], ['Library', 'Library.dc.html'], ['Look up', 'Lexicon%20Reader%20v5.dc.html?mode=lookup'],
  ['Concordance', 'Concordance.dc.html'], ['Analyser', 'Analyser.dc.html'], ['Graph', 'Lexicon%20Editor%20v5.dc.html'],
  ['Notebook', 'Notebook.dc.html'], ['Review queue', 'Review%20Queue.dc.html'], ['Classroom', 'Classroom.dc.html'], ['Data & API', 'Data%20%26%20API.dc.html']
];
export function navModel(current) {
  return NAV.map(n => ({ label: n[0], href: n[1], current: n[0] === current ? 'page' : undefined, style: 'padding:5px 10px;border-radius:7px;font-size:12.5px;text-decoration:none;white-space:nowrap;' + (n[0] === current ? 'background:#fff;color:#16161a;font-weight:500;box-shadow:0 1px 2px rgba(0,0,0,.06)' : 'color:#4f4f5a') }));
}
export const C = { root: '#a8682c', form: '#6f55c4', word: '#2f6ae0', sentence: '#177a44', desc: '#6f6f7c', amber: '#b45309', good: '#15803d', bad: '#c02626', t1: '#16161a', t2: '#4f4f5a', t3: '#71717c', line: '#e5e5ea', line2: '#d3d3dc', card2: '#f5f5f8', panel: '#f8f8fa' };
export const dot = c => 'width:8px;height:8px;border-radius:99px;flex:none;background:' + c;
export const chip = on => 'font-size:12px;padding:3px 10px;border-radius:99px;cursor:pointer;background:' + (on ? '#eef3fd' : '#fff') + ';border:1px solid ' + (on ? '#2f6ae0' : '#e5e5ea') + ';color:#16161a';
export const seg = on => 'white-space:nowrap;font-size:12.5px;padding:4px 11px;border-radius:7px;cursor:pointer;border:1px solid ' + (on ? '#d3d3dc' : 'transparent') + ';background:' + (on ? '#fff' : 'transparent') + ';color:' + (on ? '#16161a' : '#71717c') + ';font-weight:' + (on ? '500' : '400');
