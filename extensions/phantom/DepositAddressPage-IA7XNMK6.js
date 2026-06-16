import{a as R,b as B}from"./chunk-OBBUZE6N.js";import{a as T}from"./chunk-C2TTXVXF.js";import{a as h}from"./chunk-2ICRCYBD.js";import"./chunk-MNQOPN6Y.js";import{a as x}from"./chunk-A6ZZ6VBL.js";import{g as D}from"./chunk-EUEXC4MQ.js";import"./chunk-F3K4WVVR.js";import"./chunk-ZRXZH5P6.js";import{c as f}from"./chunk-5W3EK5R3.js";import{_a as w}from"./chunk-TASZSJEG.js";import{c as r}from"./chunk-X3QTRQZS.js";import"./chunk-OXHZN6EN.js";import{E as k}from"./chunk-WLD4SJJO.js";import"./chunk-7YHYDYR3.js";import"./chunk-W3XZ57NO.js";import"./chunk-RWWUDPHX.js";import{Ba as p,L as P,M as u,Ta as A,Y as S}from"./chunk-VKBPNC3B.js";import"./chunk-FNC6PQ53.js";import"./chunk-5QQLABHI.js";import{a as b,g as a,i as l,n as g}from"./chunk-WKJYWAXG.js";l();g();var I=a(B(),1),c=a(P(),1);l();g();var C=a(P(),1);var N=a(u(),1),z=r(f).attrs({borderRadius:"100px",width:"auto",fontSize:14,fontWeight:600})`
  flex-shrink: 0;
  padding: 5px 12px;
`,E=C.default.memo(s=>{let{copyText:e,className:d}=s,{buttonText:t,copy:n}=R(e),y=(0,C.useCallback)(m=>{m.stopPropagation(),n()},[n]);return(0,N.jsx)(z,{className:d,onClick:y,theme:"primary",children:t})});var o=a(u(),1),H=r(x).attrs({align:"center",justify:"space-between"})`
  height: 100%;
`,M=r(I.default)`
  padding: 8px;
  background: ${p.colors.legacy.white};
  border-radius: 6px;
`,v=r(h).attrs({align:"center",justify:"space-between"})`
  box-shadow: inset 0px 0px 4px rgba(0, 0, 0, 0.25);
  padding: 12px 15px;
  background: ${p.colors.legacy.areaAccent};
  border: 1px solid ${p.colors.legacy.borderDiminished};
  border-radius: 6px;
`,Q=r(x).attrs({align:"center"})`
  ${v} {
    margin-top: 32px;
    margin-bottom: 11px;
  }
`,$=r(h)`
  p:first-child {
    margin-right: 6px;
  }
`,L=b(s=>{let{accountName:e,walletAddress:d,address:t,symbol:n,onClose:y}=s,m=n||(t?k(t):void 0),{t:i}=S();return{i18nStrings:(0,c.useMemo)(()=>({depositAssetInterpolated:i("depositAssetDepositInterpolated",{tokenSymbol:m}),secondaryText:i("depositAssetSecondaryText"),transferFromExchange:i("depositAssetTransferFromExchange"),depositAssetShareAddressError1:i("sendInvalidQRCodeLoadingError1"),depositAssetShareAddressError2:i("sendInvalidQRCodeLoadingError2"),close:i("commandClose")}),[i,m]),accountName:e,walletAddress:d,onClose:y}},"useProps"),K=c.default.memo(s=>{let{i18nStrings:e,accountName:d,walletAddress:t,onClose:n}=s;return(0,o.jsxs)(H,{children:[(0,o.jsx)(D,{children:e.depositAssetInterpolated}),(0,o.jsx)(Q,{children:t?(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(M,{value:t,size:160}),(0,o.jsxs)(v,{children:[(0,o.jsx)($,{children:(0,o.jsx)(T,{name:d,publicKey:t})}),(0,o.jsx)(E,{copyText:t})]}),(0,o.jsx)(w,{size:14,color:p.colors.legacy.textDiminished,lineHeight:20,children:e.secondaryText})]}):(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(A,{align:"center",font:"labelSemibold",children:e.depositAssetShareAddressError1}),(0,o.jsx)(A,{align:"center",font:"body",children:e.depositAssetShareAddressError2})]})}),(0,o.jsx)(x,{children:(0,o.jsx)(f,{onClick:n,children:e.close})})]})}),W=c.default.memo(s=>{let e=L(s);return(0,o.jsx)(K,{...e})}),ao=W;export{ao as default};
//# sourceMappingURL=DepositAddressPage-IA7XNMK6.js.map
