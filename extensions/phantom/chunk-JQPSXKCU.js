import{a as w,b as Y,c as g}from"./chunk-STA4XWFW.js";import{a as W}from"./chunk-FQ4IUREX.js";import{D as M,l as K}from"./chunk-QDOMAMUW.js";import{o as F}from"./chunk-GBFCVK7L.js";import{e as q,h as E}from"./chunk-RZGOTFWC.js";import{a as J}from"./chunk-Z5R57KKX.js";import{a as _}from"./chunk-GB2PTM7B.js";import{Za as H,_a as L}from"./chunk-TASZSJEG.js";import{c as i}from"./chunk-X3QTRQZS.js";import{C as V,Ga as z,t as B}from"./chunk-6LIVARTH.js";import{B as I}from"./chunk-WLD4SJJO.js";import{$b as O,Ba as u,Fa as U,L as po,M as b,Ma as k,Ta as R,Y as D,ib as N,za as s}from"./chunk-VKBPNC3B.js";import{a as d,g as f,i as x,n as T}from"./chunk-WKJYWAXG.js";x();T();var h=f(po(),1);x();T();var r=f(b(),1),uo=i.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  height: 83px;
  padding: 16px;
`,wo=i.div`
  margin-left: 12px;
  width: 100%;
`,go=i(L).attrs({size:14,weight:400,color:u.colors.legacy.textDiminished,textAlign:"left"})``,xo=i.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`,To=i(L).attrs({size:28,lineHeight:32,weight:600,color:u.colors.legacy.textBase,textAlign:"left"})`
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
`,v=d(({title:e,network:a,tokenType:l,symbol:m,logoUri:p,tokenAddress:y,amount:n,amountUsd:t})=>(0,r.jsxs)(uo,{children:[(0,r.jsx)(E,{image:{type:"fungible",src:p,fallback:m||y},size:44,tokenType:l,chainMeta:a}),(0,r.jsxs)(wo,{children:[(0,r.jsxs)(xo,{children:[(0,r.jsx)(go,{children:e}),(0,r.jsx)(q,{value:t,font:"caption",color:"textDiminished"})]}),(0,r.jsx)(To,{children:n})]})]}),"AssetRow");var o=f(b(),1),c={screen:s({overflow:"auto"}),body:s({display:"flex",flexDirection:"column",justifyContent:"space-between"}),content:s({display:"flex",flexDirection:"column",width:"100%"}),assets:s({backgroundColor:"elementBase",borderRadius:6,width:"100%"}),line:s({backgroundColor:"areaBase",width:"100%",height:1}),button:s({width:"100%",height:48})},C=i(H).attrs({color:_.grayLight,size:14})`
  text-align: left;
  line-height: normal;
  max-width: 100%;
  margin: 16px 0;
`,bo=i.a.attrs({target:"_blank",rel:"noopener noreferrer"})`
  color: ${e=>e.theme.purple};
  text-decoration: none;
  cursor: pointer;
`,ko=d(({isJitoSOL:e,feeFootnoteText:a,feeFootnoteDescriptionText:l,feeFootnoteTooltipText:m,showUKDisclaimer:p})=>e?(0,o.jsx)(C,{children:(0,o.jsxs)(B,{i18nKey:"liquidStakeReviewConversionFootnote",children:["When you stake Solana tokens in exchange for JitoSOL you'll receive a slightly lesser amount of JitoSOL.",(0,o.jsx)(bo,{href:V,children:"Learn more"})]})}):p?(0,o.jsx)(M,{disclaimers:[],showUKDisclaimer:!0,showPastPerformanceInline:!0,marginTop:16,onPastPerformancePress:void 0,onDisclosuresPress:void 0,onFeeDisclaimerPress:void 0}):(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(C,{children:(0,o.jsx)(W,{tooltipAlignment:"topLeft",iconSize:12,lineHeight:17,fontWeight:400,info:(0,o.jsx)(Y,{tooltipContent:(0,o.jsx)(F,{children:m})}),textColor:u.colors.legacy.textDiminished,children:a})}),(0,o.jsx)(C,{children:l})]}),"ConversionFootnote"),ho=d(({children:e})=>(0,o.jsx)(k,{direction:"row",width:"100%",gap:8,paddingRight:4,children:e}),"DelayDisclaimer"),yo=d(({durationUntilEpochEnds:e})=>{let{t:a}=D(),l=(0,h.useMemo)(()=>[{topLeft:{component:ho,text:(0,o.jsx)(o.Fragment,{children:(0,o.jsx)(R,{children:a("convertToPSOLDelayDisclaimer",{durationUntilEpochEnds:e})})}),truncate:void 0,style:{wordWrap:"break-word",whiteSpace:"normal"},before:(0,o.jsx)(U.InfoCircle,{color:"white",size:18,style:{alignSelf:"flex-start",marginTop:2}})}}],[a,e]);return(0,o.jsx)(O,{rows:l})},"DepositStakeFootnote"),$o=h.default.memo(({process:e,headerTitle:a,onBack:l,openExternalLink:m,onPrimaryButtonPress:p,canSubmit:y,payAsset:n,receiveAsset:t,account:$,providerName:j,apy:A,networkFee:G,isLoading:S,networkFeeErrorMsg:Q,isJitoSOL:X,strings:Z,showUKDisclaimer:P,durationUntilEpochEnds:oo})=>{let{accountLabelText:eo,providerLabelText:to,apyLabelText:no,apyLabelTextTooltip:io,networkFeeLabelText:ro,primaryButtonText:ao,feeFootnoteText:lo,feeFootnoteDescriptionText:so,feeFootnoteTooltipText:mo}=Z,co=[t?(0,o.jsx)(w,{label:eo,children:(0,o.jsx)(g,{children:(0,o.jsx)(R,{font:"body",children:I($,4)})})},"account-row"):null,(0,o.jsx)(w,{label:to,children:(0,o.jsx)(g,{children:j})},"provider-row"),(0,o.jsx)(w,{label:no,tooltipContent:(0,o.jsx)(F,{children:io}),children:(0,o.jsx)(g,{children:A})},"apy-row"),(0,o.jsx)(w,{label:ro,isLoading:S,error:Q,children:(0,o.jsx)(g,{children:G})},"network-fee-row")];return(0,o.jsxs)("div",{className:c.screen,children:[(0,o.jsx)(K,{leftButton:{type:"back",onClick:l},titleSize:"regular",children:a}),(0,o.jsxs)("div",{className:c.body,children:[m&&P?(0,o.jsx)(k,{marginBottom:"base",children:(0,o.jsx)(z,{paddingTop:8,navigateToExternalLink:m})}):null,(0,o.jsxs)("div",{className:c.content,children:[(0,o.jsxs)("div",{className:c.assets,children:[n?(0,o.jsx)(v,{title:n.title,amount:n.amount+" "+n.symbol,amountUsd:n.amountUsd,logoUri:n.logoUri,symbol:n.symbol,tokenType:n.tokenType,tokenAddress:n.tokenAddress,network:n.network}):null,(0,o.jsx)("div",{className:c.line}),t?(0,o.jsx)(v,{title:t.title,amount:t.amount+" "+t.symbol,amountUsd:t.amountUsd,logoUri:t.logoUri,symbol:t.symbol,tokenType:t.tokenType,tokenAddress:t.tokenAddress,network:t.network}):null]}),(0,o.jsx)(k,{marginY:"base",borderRadius:8,gap:1,overflow:"hidden",children:co}),e==="mint"?(0,o.jsx)(ko,{isJitoSOL:X,feeFootnoteText:lo,feeFootnoteDescriptionText:so,feeFootnoteTooltipText:mo,showUKDisclaimer:P}):e==="convertDelayed"?(0,o.jsx)(yo,{durationUntilEpochEnds:oo}):null]}),(0,o.jsx)(J,{children:(0,o.jsx)(N,{className:c.button,background:"spot",disabled:!y||S,onClick:p,children:ao})})]})]})});export{$o as a};
//# sourceMappingURL=chunk-JQPSXKCU.js.map
