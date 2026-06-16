import{a as A}from"./chunk-Z5R57KKX.js";import{c as F}from"./chunk-ZRXZH5P6.js";import{c as D}from"./chunk-5W3EK5R3.js";import{M as v,_a as f}from"./chunk-TASZSJEG.js";import{c as e}from"./chunk-X3QTRQZS.js";import{ee as C}from"./chunk-2MEZL2PN.js";import"./chunk-7YHYDYR3.js";import"./chunk-W3XZ57NO.js";import"./chunk-RWWUDPHX.js";import{$b as k,Ba as c,Fa as g,L as R,M as y,Ma as b,Y as w}from"./chunk-VKBPNC3B.js";import"./chunk-FNC6PQ53.js";import"./chunk-5QQLABHI.js";import{a,g as u,i as h,n as T}from"./chunk-WKJYWAXG.js";h();T();var H=u(R(),1);var o=u(y(),1),I=16,B=e.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
  height: 100%;
`,M=e.div`
  overflow: scroll;
`,$=e.div`
  margin: 45px 16px 16px 16px;
  padding-top: 16px;
`,z=e(F)`
  left: ${I}px;
  position: absolute;
`,N=e.div`
  align-items: center;
  background: ${c.colors.legacy.areaBase};
  border-bottom: 1px solid ${c.colors.legacy.borderDiminished};
  display: flex;
  height: 46px;
  padding: ${I}px;
  position: absolute;
  width: 100%;
  top: 0;
  left: 0;
`,P=e.div`
  display: flex;
  flex: 1;
  justify-content: center;
`,G=e.footer`
  margin-top: auto;
  flex-shrink: 0;
  min-height: 16px;
`,W=e(f).attrs(r=>({margin:r.margin??"12px 0px"}))`
  text-align: left;
`,L=e(f).attrs({size:16,weight:500,lineHeight:25})``;function S(r){let{actions:i,shortcuts:p,trackAction:n,onClose:s}=r;return(0,H.useMemo)(()=>{let m=i.more.map(t=>{let d=g[C(t.type)],l=t.isDestructive?"spotNegative":"textBase";return{start:(0,o.jsx)(d,{size:18,type:t.type,color:l}),topLeft:{text:t.text,color:l},onClick:a(()=>{n(t),s(),t.onClick(t.type)},"onClick")}}),x=p?.map(t=>{let d=g[C(t.type)],l=t.isDestructive?"spotNegative":"textBase";return{start:(0,o.jsx)(d,{size:18,color:l}),topLeft:{text:t.text,color:l},onClick:a(()=>{n(t),s(),t.onClick(t.type)},"onClick")}})??[];return[{rows:m},{rows:x}]},[i,s,p,n])}a(S,"useConvertActionsToRows");function E(r){let{t:i}=w(),{headerText:p,hostname:n,shortcuts:s}=r,m=S(r);return(0,o.jsx)(B,{children:(0,o.jsxs)(M,{children:[(0,o.jsxs)(N,{onClick:r.onClose,children:[(0,o.jsx)(z,{children:(0,o.jsx)(v,{})}),(0,o.jsx)(P,{children:(0,o.jsx)(L,{children:p})})]}),(0,o.jsxs)($,{children:[(0,o.jsx)(b,{gap:"section",children:m.map((x,t)=>(0,o.jsx)(k,{rows:x.rows},`group-${t}`))}),(0,o.jsx)(G,{children:n&&s&&s.length>0&&(0,o.jsx)(W,{color:c.colors.legacy.textDiminished,size:14,lineHeight:17,children:i("shortcutsWarningDescription",{url:n})})})]}),(0,o.jsx)(A,{removeFooterExpansion:!0,children:(0,o.jsx)(D,{onClick:r.onClose,children:i("commandClose")})})]})})}a(E,"CTAModal");var _=E;export{E as CTAModal,_ as default};
//# sourceMappingURL=Modal-ADABATTD.js.map
