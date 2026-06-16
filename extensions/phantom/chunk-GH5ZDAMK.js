import{c as B}from"./chunk-Z4TMSE24.js";import{I as v,J as S,i as c,n as k}from"./chunk-M5GDXRS4.js";import{b as s,d as b}from"./chunk-X3QTRQZS.js";import{l as q}from"./chunk-7CWP5SI2.js";import{x as w}from"./chunk-2AOCY26Y.js";import{a as R,b as u}from"./chunk-U3L4PRI4.js";import{Dc as i,Ec as l,Hc as a,Wc as x}from"./chunk-7YHYDYR3.js";import{Ba as d,H as g,I as y}from"./chunk-VKBPNC3B.js";import{a as h,i as n,n as o}from"./chunk-WKJYWAXG.js";n();o();var M=new w(B({isWriter:!1}),{fetch(e,t){return x.api().bearer(!0).fetch(e,t)}});n();o();var m,_=new R,L=h(async()=>m||(m=new k(new S),m),"juiceboxClient"),O={storage:_,authRepository:q,juiceboxClient:L},f=v(O);f.subscribe(c.RotationResult,({type:e,didRotate:t})=>{let r=`Se*dless Bundle Rotation Result: ${e}, didRotate: ${t}`;a.addBreadcrumb(l.Seedless,r,i.Info),u.capture("seedlessBundleRotationResult",{data:{type:e,didRotate:t}})});f.subscribe(c.RecoverResult,({type:e,reason:t})=>{let r=`Se*dless Bundle Recover Result: ${e}`;t&&(r+=`, reason: ${t}`),a.addBreadcrumb(l.Seedless,r,i.Info),u.capture("seedlessBundleRecoverResult",{data:{type:e,reason:t}})});f.subscribe(c.BackupResult,({type:e,didBackup:t})=>{let r=`Se*dless Bundle Backup Result: ${e}, didBackup: ${t}`;a.addBreadcrumb(l.Seedless,r,i.Info),u.capture("seedlessBundleBackupResult",{data:{type:e,didBackup:t}})});n();o();n();o();var $=function(e,t){return Object.defineProperty?Object.defineProperty(e,"raw",{value:t}):e.raw=t,e},T=s(C||(C=$([`
/* http://meyerweb.com/eric/tools/css/reset/
   v5.0.1 | 20191019
   License: none (public domain)
*/

html, body, div, span, applet, object, iframe,
h1, h2, h3, h4, h5, h6, p, blockquote, pre,
a, abbr, acronym, address, big, cite, code,
del, dfn, em, img, ins, kbd, q, s, samp,
small, strike, strong, sub, sup, tt, var,
b, u, i, center,
dl, dt, dd, menu, ol, ul, li,
fieldset, form, label, legend,
table, caption, tbody, tfoot, thead, tr, th, td,
article, aside, canvas, details, embed,
figure, figcaption, footer, header, hgroup,
main, menu, nav, output, ruby, section, summary,
time, mark, audio, video {
  margin: 0;
  padding: 0;
  border: 0;
  font-size: 100%;
  font: inherit;
  vertical-align: baseline;
}
/* HTML5 display-role reset for older browsers */
article, aside, details, figcaption, figure,
footer, header, hgroup, main, menu, nav, section {
  display: block;
}
/* HTML5 hidden-attribute fix for newer browsers */
*[hidden] {
    display: none;
}
body {
  line-height: 1;
}
menu, ol, ul {
  list-style: none;
}
blockquote, q {
  quotes: none;
}
blockquote:before, blockquote:after,
q:before, q:after {
  content: '';
  content: none;
}
table {
  border-collapse: collapse;
  border-spacing: 0;
}
`],[`
/* http://meyerweb.com/eric/tools/css/reset/
   v5.0.1 | 20191019
   License: none (public domain)
*/

html, body, div, span, applet, object, iframe,
h1, h2, h3, h4, h5, h6, p, blockquote, pre,
a, abbr, acronym, address, big, cite, code,
del, dfn, em, img, ins, kbd, q, s, samp,
small, strike, strong, sub, sup, tt, var,
b, u, i, center,
dl, dt, dd, menu, ol, ul, li,
fieldset, form, label, legend,
table, caption, tbody, tfoot, thead, tr, th, td,
article, aside, canvas, details, embed,
figure, figcaption, footer, header, hgroup,
main, menu, nav, output, ruby, section, summary,
time, mark, audio, video {
  margin: 0;
  padding: 0;
  border: 0;
  font-size: 100%;
  font: inherit;
  vertical-align: baseline;
}
/* HTML5 display-role reset for older browsers */
article, aside, details, figcaption, figure,
footer, header, hgroup, main, menu, nav, section {
  display: block;
}
/* HTML5 hidden-attribute fix for newer browsers */
*[hidden] {
    display: none;
}
body {
  line-height: 1;
}
menu, ol, ul {
  list-style: none;
}
blockquote, q {
  quotes: none;
}
blockquote:before, blockquote:after,
q:before, q:after {
  content: '';
  content: none;
}
table {
  border-collapse: collapse;
  border-spacing: 0;
}
`]))),ee=b(j||(j=$(["",""],["",""])),T),I=T,C,j;var z=s`
  ::-webkit-scrollbar {
    background: ${d.colors.legacy.areaBase};
    width: 7px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${d.colors.legacy.elementBase};
    border-radius: 8px;
  }
`,P=s`
  ::-webkit-scrollbar {
    display: none;
  }
  * {
    scrollbar-width: none; /* Also needed to disable scrollbar Firefox */
  }
`,ae=b`
    ${I}

    body, html, * {
        box-sizing: border-box;
        font-family: 'Inter', 'Roboto', Arial;
        user-select: none;
        color: currentColor;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeSpeed;
        -webkit-font-smoothing: antialiased;
    }
    input, textarea {
        -webkit-user-select: text;
        -khtml-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
        user-select: text;
    }
    body {
        color: ${d.colors.legacy.textBase};
        background: ${e=>e.backgroundColor};
        min-height: 100vh;
        margin: 0;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    *:focus, *:focus-within {
        outline-color: transparent !important;
        outline-style: none !important;
        outline-width: 0px !important;
    }

    ${g||y?P:z}
`;export{M as a,f as b,ae as c};
//# sourceMappingURL=chunk-GH5ZDAMK.js.map
