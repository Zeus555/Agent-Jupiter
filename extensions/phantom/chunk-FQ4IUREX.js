import{r as d}from"./chunk-GBFCVK7L.js";import{V as I,_a as b}from"./chunk-TASZSJEG.js";import{c as a}from"./chunk-X3QTRQZS.js";import{Ba as t,L as W,M as h}from"./chunk-VKBPNC3B.js";import{a as n,g as l,i as m,n as g}from"./chunk-WKJYWAXG.js";m();g();var u=l(W(),1);var o=l(h(),1),v=a.div`
  display: flex;
  ${e=>e.isVisible?"cursor: pointer;":""}
  align-items: center;
  margin-right: ${e=>e.hasChildren?10:0}px;
  p {
    margin-right: 6px;
    ${e=>!e.allowWrap&&"white-space: nowrap;"}
  }
`,z=a.div`
  position: relative;
  top: 1px;
`,D=n(({children:e,fontWeight:C,fontSize:w=14,iconSize:x,info:s,lineHeight:T,tooltipAlignment:y,noWrap:p,textAlign:R="left",showInfoIcon:S=!0,textColor:A,iconColor:P})=>{let[V,c]=(0,u.useState)(!1),i=!!s,r=i&&V,f=r?t.colors.legacy.spotBase:t.colors.legacy.textDiminished;return(0,o.jsx)(d,{label:i?s:(0,o.jsx)(o.Fragment,{}),ariaLabel:"Info",color:t.colors.legacy.areaBase,alignment:y,isVisible:r,triggerParams:{onMouseEnter:n(()=>c(!0),"onMouseEnter"),onMouseLeave:n(()=>{c(!1)},"onMouseLeave")},children:(0,o.jsxs)(v,{isVisible:r,hasChildren:!!e,allowWrap:!p,children:[(0,o.jsx)(b,{color:A??f,lineHeight:T,size:w,weight:C,noWrap:p,textAlign:R,children:e}),i&&S?(0,o.jsx)(z,{children:(0,o.jsx)(I,{fill:P??f,width:x})}):null]})})},"Info");export{D as a};
//# sourceMappingURL=chunk-FQ4IUREX.js.map
