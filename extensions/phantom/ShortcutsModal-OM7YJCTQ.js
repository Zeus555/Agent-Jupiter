import{a as A,c as B}from"./chunk-BHPNJQYH.js";import{a as V}from"./chunk-ZMCUEDJA.js";import{c as G}from"./chunk-5W3EK5R3.js";import{Aa as w,Ba as L,Ca as T,Da as v,Ea as C,Fa as M,Ga as P,Ha as b,Ia as D,Ja as R,Ka as W,La as l,Ma as F,_a as O,ua as S,va as f,wa as h,xa as x,ya as k,za as y}from"./chunk-TASZSJEG.js";import{c as o}from"./chunk-X3QTRQZS.js";import{b as g}from"./chunk-U3L4PRI4.js";import"./chunk-A2EKZXK7.js";import"./chunk-ZQZJIKZB.js";import"./chunk-YJCG6GWC.js";import"./chunk-WLD4SJJO.js";import"./chunk-7YHYDYR3.js";import"./chunk-W3XZ57NO.js";import"./chunk-RWWUDPHX.js";import{Ba as d,L as E,M as p,Y as I}from"./chunk-VKBPNC3B.js";import"./chunk-FNC6PQ53.js";import"./chunk-5QQLABHI.js";import{a as i,g as c,i as s,n as a}from"./chunk-WKJYWAXG.js";s();a();var z=c(E(),1);s();a();var U=c(p(),1),Y={[V]:l,vote:T,"vote-2":v,stake:C,"stake-2":M,view:P,chat:b,tip:D,mint:R,"mint-2":W,"generic-link":l,"generic-add":F,discord:S,twitter:f,"twitter-2":h,x:h,instagram:x,telegram:k,leaderboard:L,gaming:y,"gaming-2":w};function N({icon:r,...n}){let m=Y[r];return(0,U.jsx)(m,{...n})}i(N,"ShortcutsIcon");var t=c(p(),1),_=o.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  margin-top: -16px; // compensate for generic screen margins
`,q=o.footer`
  margin-top: auto;
  flex-shrink: 0;
  min-height: 16px;
`,J=o.div`
  overflow: scroll;
`,K=o.ul`
  flex: 1;
  max-height: 350px;
  padding-top: 16px; // compensate for the override of the generic screen margins
`,Q=o.li``,X=o.div`
  display: flex;
  align-items: center;
  padding: 6px 12px;
`,Z=o(O).attrs(r=>({margin:r.margin??"12px 0px"}))`
  text-align: left;
`;function $({shortcuts:r,...n}){let{t:m}=I(),u=(0,z.useMemo)(()=>n.hostname.includes("//")?new URL(n.hostname).hostname:n.hostname,[n.hostname]);return(0,t.jsxs)(_,{children:[(0,t.jsx)(J,{children:(0,t.jsx)(K,{children:r.map(e=>(0,t.jsx)(Q,{children:(0,t.jsxs)(G,{type:"button",onClick:()=>{g.capture("walletShortcutsLinkOpenClick",A(n,e)),self.open(e.uri)},theme:"text",paddingY:6,children:[(0,t.jsx)(X,{children:(0,t.jsx)(N,{icon:B(e.uri,e.icon)})}),e.label]})},e.uri))})}),(0,t.jsx)(q,{children:u&&(0,t.jsx)(Z,{color:d.colors.legacy.textDiminished,size:14,lineHeight:17,children:m("shortcutsWarningDescription",{url:u})})})]})}i($,"ShortcutsModal");var It=$;export{$ as ShortcutsModal,It as default};
//# sourceMappingURL=ShortcutsModal-OM7YJCTQ.js.map
