import{a as x,b as G}from"./chunk-OBBUZE6N.js";import{a as L}from"./chunk-FWDO4YFN.js";import{d as E}from"./chunk-BC332QPU.js";import{c as Q}from"./chunk-COY2AKMU.js";import{a as z}from"./chunk-A6ZZ6VBL.js";import{g as P,h as N}from"./chunk-EUEXC4MQ.js";import{c as v}from"./chunk-5W3EK5R3.js";import{_a as f,u as S}from"./chunk-TASZSJEG.js";import{c as n}from"./chunk-X3QTRQZS.js";import{a as u}from"./chunk-SQYWWEVC.js";import{B,Ma as D,g as T}from"./chunk-WLD4SJJO.js";import{Ib as b}from"./chunk-7YHYDYR3.js";import{Ba as r,L as A,M as l,Xa as I,Y as R,za as H}from"./chunk-VKBPNC3B.js";import{a as k,g as t,i as c,n as m}from"./chunk-WKJYWAXG.js";c();m();var C=t(A(),1);var h=t(l(),1),se=C.default.memo(({chainAddress:i,onQRClick:p})=>{let{networkID:d,address:o}=i,{buttonText:s,copied:g,copy:w}=x(o),_=B(o,4),F=D(i.networkID),U=(0,C.useCallback)(q=>{q.stopPropagation(),w()},[w]);return(0,h.jsx)(I,{copied:g,copiedText:s,formattedAddress:_,networkBadge:(0,h.jsx)(E,{networkID:d,address:o}),networkLogo:(0,h.jsx)(u,{networkID:d,size:40}),networkName:F,onCopyClick:U,onQRClick:p})});c();m();var $=t(G(),1),O=t(A(),1);c();m();var y=t(A(),1);var a=t(l(),1),Z=n.div`
  width: 100%;
`,j=n(Q)`
  background: ${r.colors.legacy.areaAccent};
  border: 1px solid ${r.colors.legacy.borderDiminished};
  border-radius: 6px 6px 0 0;
  border-bottom: none;
  margin: 0;
  padding: 16px 22px;
  font-size: 16px;
  font-weight: 500;
  line-height: 21px;
  text-align: center;
  resize: none;
  overflow: hidden;
`,J=n.button`
  display: flex;
  justify-content: center;
  align-items: center;
  background: ${r.colors.legacy.areaAccent};
  border: 1px solid ${r.colors.legacy.borderDiminished};
  border-radius: 0 0 6px 6px;
  border-top: none;
  height: 40px;
  width: 100%;
  padding: 0;
  cursor: pointer;

  &:hover {
    background: ${r.colors.brand.black};
  }
`,K=n(f).attrs({size:16,weight:600,lineHeight:16})`
  margin-left: 6px;
`,W=k(({value:i})=>{let{buttonText:p,copy:d}=x(i),o=(0,y.useRef)(null);return(0,y.useEffect)(()=>{k(()=>{if(o&&o.current){let g=o.current.scrollHeight;o.current.style.height=g+"px"}},"autoSizeTextArea")()},[]),(0,a.jsxs)(Z,{children:[(0,a.jsx)(j,{ref:o,readOnly:!0,value:i}),(0,a.jsxs)(J,{onClick:d,children:[(0,a.jsx)(S,{}),(0,a.jsx)(K,{children:p})]})]})},"CopyArea");var e=t(l(),1),V=48,Ne=O.default.memo(({address:i,networkID:p,headerType:d,onCloseClick:o})=>{let{t:s}=R();return(0,e.jsxs)(e.Fragment,{children:[(0,e.jsx)(d==="page"?P:N,{children:s("depositAddress")}),(0,e.jsxs)(L,{children:[(0,e.jsx)(z,{align:"center",justify:"center",id:"column",children:(0,e.jsxs)(Y,{id:"QRCodeWrapper",children:[(0,e.jsx)(X,{value:i,size:160,level:"Q",id:"styledqrcode"}),(0,e.jsx)(u,{networkID:p,size:V,borderColor:"areaBase",className:H({position:"absolute"})})]})}),(0,e.jsx)(f,{size:16,lineHeight:22,weight:600,margin:"16px 0 8px",children:s("depositAddressChainInterpolated",{chain:b.getNetworkName(p)})}),(0,e.jsx)(W,{value:i}),(0,e.jsxs)(f,{size:14,color:r.colors.legacy.textDiminished,lineHeight:20,margin:"16px 0",children:[s("depositAssetSecondaryText")," ",(0,e.jsx)(ee,{href:T,target:"_blank",rel:"noopener noreferrer",children:s("commandLearnMore")})]})]}),(0,e.jsx)(v,{onClick:o,children:s("commandClose")})]})}),X=n($.default)`
  padding: 8px;
  background: ${r.colors.legacy.white};
  border-radius: 6px;
  position: relative;
`,Y=n.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
`,ee=n.a`
  color: ${r.colors.legacy.spotBase};
  text-decoration: none;
  font-weight: 500;
`;export{se as a,W as b,Ne as c};
//# sourceMappingURL=chunk-VQPKVUPS.js.map
