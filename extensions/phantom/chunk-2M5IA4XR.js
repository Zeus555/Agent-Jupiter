import{h as E}from"./chunk-COY2AKMU.js";import{a as F}from"./chunk-CM3IULXA.js";import{c as q}from"./chunk-5W3EK5R3.js";import{D as U,_a as f,ca as z}from"./chunk-TASZSJEG.js";import{c as e}from"./chunk-X3QTRQZS.js";import{_ as P}from"./chunk-6LIVARTH.js";import{Pe as $,Ta as L,Wa as Y}from"./chunk-7YHYDYR3.js";import{Ba as i,Fa as A,Ha as N,L as _,M as c,Y as V,za as W}from"./chunk-VKBPNC3B.js";import{a as o,g as a,i as s,n as d}from"./chunk-WKJYWAXG.js";s();d();var l=a(c(),1),G=e.div`
  position: relative;
  width: 100%;
`,J=e.div`
  position: absolute;
  right: 12px;
  top: calc(50% - 27px / 2);
  display: flex;
  align-items: center;
`,X=e(f)`
  margin-right: ${t=>`calc(120px - (${t.textLength}px * 5))`};
`,Z=e(f)`
  margin-right: 10px;
`,j=e(q)`
  height: 27px;
`,tt=e.div`
  position: relative;
  width: 100%;
  padding: 0px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
`,xt=o(({symbol:t,alignSymbol:m,buttonText:p,width:g,borderRadius:x,onSetTarget:y,targetButtonDisabled:I,placeholder:C,...n})=>{let{t:v}=V(),T=n.value.toString().length;return(0,l.jsxs)(G,{children:[(0,l.jsx)(E,{placeholder:C??v("maxInputAmount"),borderRadius:x,...n}),(0,l.jsxs)(J,{children:[m==="left"?(0,l.jsx)(X,{size:16,textLength:T,color:i.colors.legacy.textDiminished,children:t}):(0,l.jsx)(Z,{size:16,color:i.colors.legacy.textDiminished,children:t}),(0,l.jsx)(j,{disabled:I,fontSize:13,width:`${g}px`,borderRadius:"100px",paddingY:4,onClick:y,children:(0,l.jsx)(tt,{children:p})})]})]})},"TargetInput");s();d();var h=a(_(),1);var b=a(c(),1),et=e.div`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${t=>t.color};
  height: ${t=>t.width}px;
  min-width: ${t=>t.width}px;
  border-radius: 6px;
`,rt=e.img`
  border-radius: ${t=>t.shape==="square"?"0":"50%"};
  height: ${t=>t.width}px;
  width: ${t=>t.width}px;
`,H=h.default.memo(({alt:t,backgroundColor:m=i.colors.legacy.areaBase,className:p,defaultIcon:g,iconUrl:x,localImageSource:y,questionMarkWidth:I,shape:C="circle",width:n})=>{let[v,T]=(0,h.useState)(!1),[R,M]=(0,h.useState)(!1),K=o(()=>{T(!0)},"onLoad"),Q=o(()=>{M(!0)},"onError"),u=x;x&&n?u=N(x,n,n):y&&(u=y);let S=v?"clear":m,B=u?(0,b.jsx)(rt,{src:u,alt:t,width:n,shape:C,loading:"lazy",onLoad:K,onError:Q}):null,D=g||(0,b.jsx)(U,{width:I});return C==="square"?(0,b.jsx)(et,{className:p,color:S,width:n,children:u&&!R?B:D}):(0,b.jsx)(F,{className:p,color:S,diameter:n,children:u&&!R?B:D})});s();d();var r=a(c(),1),Nt=o(t=>{let{data:m}=P(t.keybaseUsername),p=t.name??t.keybaseUsername??t.identifier;return(0,r.jsxs)(nt,{children:[(0,r.jsxs)(at,{children:[(0,r.jsx)(lt,{width:28,iconUrl:t.iconUrl??m}),(0,r.jsx)(f,{textAlign:"left",weight:600,size:16,noWrap:!0,children:p}),t.website&&(0,r.jsx)(it,{href:t.website,children:(0,r.jsx)(z,{})}),t.onInfoClick&&(0,r.jsx)("div",{className:ot.infoContainer,onClick:t.onInfoClick,children:(0,r.jsx)(A.InfoCircle,{size:16,color:"textIncidental"})})]}),(0,r.jsx)(st,{children:t.data.map(g=>(0,r.jsxs)(dt,{children:[(0,r.jsx)(f,{textAlign:"left",color:i.colors.legacy.textDiminished,size:14,lineHeight:17,noWrap:!0,children:g.label}),g.value]},g.label))})]})},"ValidatorCard"),ot={infoContainer:W({cursor:"pointer"})},nt=e.div`
  display: grid;
  grid-template-columns: 100%;
  grid-template-rows: 47px auto;
  align-items: center;
  justify-content: flex-start;
  background: ${i.colors.legacy.elementBase};
  width: 100%;
  border-radius: 6px;
  margin-top: 12px;
`,at=e.div`
  display: grid;
  gap: 10px;
  grid-template-columns: 33px 1fr auto;
  align-items: center;
  padding: 9px 14px;
  border-bottom: 0.5px solid ${i.colors.legacy.borderBase};
`,it=e.a.attrs({target:"_blank",rel:"noopener noreferrer"})`
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
`,lt=e(H)``,st=e.section`
  padding: 14px;
`,dt=e.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
`;s();d();var k=a(c(),1),O=o((t,m)=>$(L(typeof t=="string"?Number(t):t),m),"format"),Ht=o(t=>typeof t.children>"u"?null:(0,k.jsxs)(k.Fragment,{children:[O(t.children,t.format)," SOL"]}),"SolBalance"),Ot=o(t=>typeof t.balance>"u"?null:`${O(t.balance,t.format)} SOL`,"formatSolBalance");export{xt as a,H as b,Nt as c,Ht as d,Ot as e};
//# sourceMappingURL=chunk-2M5IA4XR.js.map
