import{a as L}from"./chunk-CACZWADY.js";import{a as D}from"./chunk-YLF46ZAV.js";import{e as H,f as F,g as q}from"./chunk-YKCWXP4A.js";import{a as V}from"./chunk-A6ZZ6VBL.js";import{p as R}from"./chunk-OENHJLUF.js";import{a as b,c as h,e as v}from"./chunk-5W3EK5R3.js";import{_a as B}from"./chunk-TASZSJEG.js";import{c as u}from"./chunk-X3QTRQZS.js";import{Ga as y}from"./chunk-6LIVARTH.js";import{a as f}from"./chunk-RWWUDPHX.js";import{Ba as m,L as N,M as x,Ma as E,Ta as P,Ya as T,ab as C}from"./chunk-VKBPNC3B.js";import{a as s,g,i as S,n as k}from"./chunk-WKJYWAXG.js";S();k();var G=g(N(),1);S();k();var t=g(x(),1),I=u.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  width: 100%;
  padding: ${r=>r.addScreenPadding?"16px":"0"};
`,W=u.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
`,X=u.div`
  width: 100%;
  > * {
    margin-top: 10px;
  }
  padding: 16px;
`,z=u(V).attrs({align:"center",justify:"center",margin:"0 0 15px 0"})`
  position: relative;
  border-radius: 50%;
  background-color: ${f(m.colors.legacy.spotBase,.2)};
  box-shadow: 0 0 0 20px ${f(m.colors.legacy.spotBase,.2)};
`,M=u(B).attrs({size:28,weight:500,color:m.colors.legacy.textBase})`
  margin-top: 24px;
  margin-left: 12px;
  margin-right: 12px;
`,j=s(()=>(0,t.jsx)(z,{children:(0,t.jsx)(b,{diameter:54,color:m.colors.legacy.spotBase,trackColor:m.colors.legacy.areaAccent})}),"LoadingIcon"),J=s(({message:r})=>(0,t.jsx)(E,{marginX:12,alignItems:"center",children:Array.isArray(r)?r.map((a,o)=>(0,t.jsx)(P,{font:"body",color:"textDiminished",align:"center",marginX:12,marginTop:16,children:a},`message-${o}`)):(0,t.jsx)(P,{font:"body",marginTop:16,color:"textDiminished",align:"center",children:r})}),"Message"),w=s(({header:r,icon:a,title:o,message:e,txHash:i,txHashTitle:c,isClosable:n,primaryButton:p,secondaryButton:l})=>(0,t.jsxs)(I,{children:[r,(0,t.jsxs)(W,{children:[(0,t.jsx)(T,{mode:"wait",initial:!0,children:(0,t.jsx)(C.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.2},children:a},o)}),(0,t.jsx)(M,{children:o}),(0,t.jsx)(J,{message:e}),i&&(0,t.jsx)(T,{mode:"wait",initial:!1,children:(0,t.jsx)(C.div,{initial:{opacity:0,y:16},animate:{opacity:1,y:0},exit:{opacity:0},transition:{duration:.2},children:(0,t.jsx)(D,{txHash:i,children:c})},i)})]}),n?(0,t.jsx)(X,{children:l&&p?(0,t.jsx)(v,{buttons:[{text:l.title,onClick:l.onPress},{theme:"primary",text:p.title,onClick:p.onPress}]}):p?(0,t.jsx)(h,{theme:"primary",onClick:p.onPress,children:p.title}):l?(0,t.jsx)(h,{onClick:l.onPress,children:l.title}):null}):null]}),"StakeStatus"),K=s(({ledgerAction:r,numberOfTransactions:a,cancel:o,ledgerApp:e})=>(0,t.jsx)(I,{addScreenPadding:!0,children:(0,t.jsx)(F,{ledgerAction:r,numberOfTransactions:a,cancel:o,ledgerApp:e})}),"StakeStatusLedger"),U=s(({title:r,message:a,txHash:o,txHashTitle:e,primaryButton:i,showUKDisclaimer:c,openExternalLink:n})=>(0,t.jsx)(w,{icon:(0,t.jsx)(j,{}),message:a,title:r,txHash:o,txHashTitle:e,primaryButton:i,isClosable:!!o,header:c&&n?(0,t.jsx)(y,{navigateToExternalLink:n,paddingTop:8}):null}),"StakeStatusLoading"),A=s(({title:r,message:a,txHash:o,txHashTitle:e,primaryButton:i,showUKDisclaimer:c,openExternalLink:n})=>(0,t.jsx)(w,{icon:(0,t.jsx)(L,{type:"failure"}),message:a,title:r,txHash:o,txHashTitle:e,primaryButton:i,isClosable:!0,header:c&&n?(0,t.jsx)(y,{navigateToExternalLink:n,paddingTop:8}):null}),"StakeStatusError"),$=s(({title:r,message:a,txHash:o,txHashTitle:e,primaryButton:i,secondaryButton:c,showUKDisclaimer:n,openExternalLink:p})=>(0,t.jsx)(w,{icon:(0,t.jsx)(L,{type:"success"}),title:r,message:a,txHash:o,txHashTitle:e,isClosable:!0,primaryButton:i,secondaryButton:c,header:n&&p?(0,t.jsx)(y,{navigateToExternalLink:p,paddingTop:8}):null}),"StakeStatusSuccess");var d=g(x(),1),Q=s(({txError:r,addressType:a,statusPageProps:o,executeConvertStake:e,onClose:i})=>H(r)?(0,d.jsx)(q,{ledgerActionError:r,onRetryClick:e,onCancelClick:i}):o.type==="error"?(0,d.jsx)(A,{...o}):(0,d.jsx)(K,{ledgerAction:e,numberOfTransactions:1,cancel:i,ledgerApp:R(a)}),"StakeLedgerView"),xt=G.default.memo(r=>{let{addressType:a,isLedger:o,statusPageProps:e,txError:i,onClose:c,executeLiquidStake:n}=r;if(o&&!e.txHash)return(0,d.jsx)(Q,{txError:i,addressType:a,statusPageProps:e,executeConvertStake:n,onClose:c});switch(e.type){case"loading":return(0,d.jsx)(U,{...e});case"error":return(0,d.jsx)(A,{...e});case"success":return(0,d.jsx)($,{title:e.title,txHash:e.txHash,txHashTitle:e.txHashTitle,primaryButton:e.primaryButton,secondaryButton:e.secondaryButton,message:e.message,paddingBottom:e.paddingBottom,showUKDisclaimer:e.showUKDisclaimer,openExternalLink:e.openExternalLink});default:throw new Error("Unsupported status page type")}});export{xt as a};
//# sourceMappingURL=chunk-6FAJQ5WB.js.map
