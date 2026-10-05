import { THEME_KEY } from "@/lib/site";

/**
 * The script every page runs in its <head>, before it paints: the theme (an embed's from its address), the digits
 * (SHL-Q05), more contrast and wider spacing (B9), each read from this browser and set on <html>, and each followed
 * when another tab changes it. One statement after another — a syntax error here takes every one of them down
 * (headScript.test.ts parses it and runs it).
 */
const DIGITS_KEY = "jadhr-digits";
const CONTRAST_KEY = "jadhr-contrast";
const SPACING_KEY = "jadhr-spacing";

export const themeScript = `if(/^\\/(en\\/)?embed\\//.test(location.pathname)){var m=/[?&]theme=(dark|light)/.exec(location.search);document.documentElement.dataset.theme=m?m[1]:"light"}else{try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}else{document.documentElement.dataset.theme="light"}}catch(e){document.documentElement.dataset.theme="light"}addEventListener("storage",function(e){if(e.key===${JSON.stringify(THEME_KEY)}&&(e.newValue==="dark"||e.newValue==="light"))document.documentElement.dataset.theme=e.newValue})}try{var d=localStorage.getItem(${JSON.stringify(DIGITS_KEY)});if(d==="arabic"||d==="latin")document.documentElement.dataset.digits=d}catch(e){}addEventListener("storage",function(e){if(e.key===${JSON.stringify(DIGITS_KEY)}){if(e.newValue==="arabic"||e.newValue==="latin")document.documentElement.dataset.digits=e.newValue;else delete document.documentElement.dataset.digits}});try{var c=localStorage.getItem(${JSON.stringify(CONTRAST_KEY)});if(c==="more")document.documentElement.dataset.contrast=c;var sp=localStorage.getItem(${JSON.stringify(SPACING_KEY)});if(sp==="wide")document.documentElement.dataset.spacing=sp}catch(e){}addEventListener("storage",function(e){if(e.key===${JSON.stringify(CONTRAST_KEY)}){if(e.newValue==="more")document.documentElement.dataset.contrast="more";else delete document.documentElement.dataset.contrast}if(e.key===${JSON.stringify(SPACING_KEY)}){if(e.newValue==="wide")document.documentElement.dataset.spacing="wide";else delete document.documentElement.dataset.spacing}})`;
