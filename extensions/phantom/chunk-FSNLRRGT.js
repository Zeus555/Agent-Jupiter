import{a as B}from"./chunk-FQ4IUREX.js";import{b as $}from"./chunk-2M5IA4XR.js";import{o as V}from"./chunk-GBFCVK7L.js";import{J as P,r as z}from"./chunk-TASZSJEG.js";import{c as r}from"./chunk-X3QTRQZS.js";import{Y as L}from"./chunk-2AOCY26Y.js";import{b as I}from"./chunk-U3L4PRI4.js";import{ga as D}from"./chunk-ZQZJIKZB.js";import{B as S}from"./chunk-WLD4SJJO.js";import{F as w,uf as T}from"./chunk-7YHYDYR3.js";import{$b as k,Ba as s,L as E,M as C,Ma as v,Ta as R}from"./chunk-VKBPNC3B.js";import{a as l,g as h,i as x,n as f}from"./chunk-WKJYWAXG.js";x();f();x();f();var b={header:"_14rx5di1 _14rx5di0 _48j31a5d _48j31a3q _48j31a70 _48j31a23 _48j31a1kg _48j31a1nn _48j31a1ms _48j31al0 _48j31a2c7 _48j31as7 _48j31axa",summaryContainer:"_14rx5di2 _48j31a1c5 _48j31a1x7"};x();f();var A=h(E(),1),u=h(C(),1),_=A.default.memo(({address:e,networkID:o,showConcise:a})=>{let{getExistingAccount:c,getKnownAddressLabel:n}=D(),{data:y}=L(e,o),m=y?.address;if(!e)return null;let i=c(e),p=n(e,o),g=i?i.name:p;return m?(0,u.jsxs)(R,{children:[e," ",(0,u.jsxs)(R,{color:"textDiminished",children:["(",S(m,4),")"]})]}):g?(0,u.jsxs)(R,{children:[g," ",(0,u.jsxs)(R,{color:"textDiminished",children:["(",S(e,4),")"]})]}):(0,u.jsx)(R,{children:a?S(e,4):e})});var t=h(C(),1);function O(e){if(!e){let a=parseInt(s.radiusBase.replace("px",""),10);return{borderTopLeftRadius:a,borderTopRightRadius:a,borderBottomRightRadius:a,borderBottomLeftRadius:a}}let o=e.split(" ").map(a=>a.replace("px","")).map(a=>parseInt(a,10));return o.length===1?{borderTopLeftRadius:o[0],borderTopRightRadius:o[0],borderBottomRightRadius:o[0],borderBottomLeftRadius:o[0]}:o.length===2?{borderTopLeftRadius:o[0],borderTopRightRadius:o[1],borderBottomRightRadius:o[0],borderBottomLeftRadius:o[1]}:{borderTopLeftRadius:o[0],borderTopRightRadius:o[1],borderBottomRightRadius:o[2],borderBottomLeftRadius:o[3]}}l(O,"explodeBorderRadius");var M=r.div`
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid ${s.colors.legacy.areaBase};
  border-bottom-width: ${e=>e.border?1:0}px;
  padding: ${e=>e.padding?e.padding:14}px;
  cursor: ${e=>e.onClick?"pointer":"default"};
`,j=r.div`
  padding-top: 3px;
`,W=r.div`
  display: flex;
  justify-content: space-between;
  font-size: ${e=>e.fontSize?e.fontSize:14}px;
`,H=r.div`
  display: flex;
  justify-content: space-between;
`,U=r.div`
  text-align: left;
  flex: 1;
`,q=r.div`
  text-align: right;
  flex: 1;
`,K=r.div`
  display: flex;
  align-items: center;
  ${e=>e.truncate?"flex: 1; min-width: 0; justify-content:end;":""}
`,G=r.div`
  padding-left: 8px;
  color: ${s.colors.legacy.textDiminished};
`,F=l(({children:e,showArrow:o})=>(0,t.jsxs)(K,{truncate:!o,children:[e,o&&(0,t.jsx)(G,{children:(0,t.jsx)(z,{height:12})})]}),"Value"),d=r.span`
  color: ${e=>e.color||"white"};
  text-align: ${e=>e.align||"left"};
  font-weight: ${e=>e.weight||400};
  overflow-wrap: break-word;
  ${e=>e.margin?"margin: "+e.margin+";":""};
  ${e=>e.size?"font-size: "+e.size+"px;":""}
  ${e=>e.truncate?"white-space: nowrap; text-overflow: ellipsis; overflow:hidden; width: 100%;"+(e.size?"line-height: "+e.size*1.2+"px;":"line-height: 17px;"):""}
`,J=r.a.attrs({target:"_blank",rel:"noopener noreferrer"})`
  color: ${s.colors.legacy.spotBase};
  text-decoration: none;
  cursor: pointer;
`,Q=r.div`
  text-align: center;
  width: 100%;
`,X=l(({children:e,label:o,tooltipContent:a,fontSize:c})=>(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(B,{tooltipAlignment:"topLeft",iconSize:12,lineHeight:17,fontSize:c,fontWeight:500,info:a?(0,t.jsx)(V,{children:a}):null,children:o}),e]}),"InfoRow"),Y=l(e=>{I.capture("activityItemDetailLinkClicked",{data:{hostname:T(e)}})},"captureLinkClickAnalytics"),Z=l(e=>"designSystemOptIn"in e&&e.designSystemOptIn===!0?(0,t.jsx)(ee,{...e}):(0,t.jsx)(te,{...e}),"Summary"),ee=l(({header:e,rows:o,borderRadius:a})=>{let c=O(a);return(0,t.jsxs)(v,{className:b.summaryContainer,...c,children:[e?(0,t.jsx)("div",{className:b.header,children:e}):null,(0,t.jsx)(k,{rows:o.map(n=>({...n.onPress?{onClick:n.onPress}:{},topLeft:n.tooltipContent?{component:l(()=>(0,t.jsx)(B,{textColor:s.colors.legacy.textDiminished,iconColor:s.colors.legacy.textDiminished,tooltipAlignment:"topLeft",iconSize:12,lineHeight:17,fontSize:14,fontWeight:500,info:(0,t.jsx)(V,{children:n.tooltipContent}),children:n.label}),"component")}:{text:n.label,font:"captionMedium",color:"textDiminished"},topRight:{text:n.value,font:"captionMedium",color:"textBase"}}))})]})},"SummaryDesignSystem"),te=l(({header:e,rows:o,borderRadius:a,padding:c,fontSize:n,networkID:y})=>{let m=O(a);return(0,t.jsxs)(v,{className:b.summaryContainer,...m,children:[" ",e?(0,t.jsx)("div",{className:b.header,children:e}):null,o.map((i,p)=>{if(i.value===void 0)return null;let g=i.onClick?{role:"button"}:void 0;return(0,t.jsxs)(M,{border:o.length-1!==p,padding:c,onClick:i.onClick,...g,children:[(0,t.jsx)(W,{fontSize:n,children:typeof i.value=="string"?i.type==="link"?(0,t.jsx)(Q,{children:(0,t.jsx)(J,{href:i.value,onClick:()=>Y(i.value),children:i.label})}):(0,t.jsx)(X,{label:i.label,tooltipContent:i.tooltipContent,fontSize:n,children:(0,t.jsx)(F,{showArrow:!!i.onClick,children:i.type==="address"?(0,t.jsx)(_,{address:i.value,networkID:y??w.Mainnet}):(0,t.jsx)(d,{color:i.color,weight:500,align:"right",truncate:!i.onClick,children:i.value})})}):(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(d,{color:s.colors.legacy.textDiminished,size:n,children:i.label}),(0,t.jsx)(F,{showArrow:!!i.onClick,children:i.value})]})},i.label),(0,t.jsxs)(H,{children:[i.leftSubtext?(0,t.jsx)(U,{children:(0,t.jsx)(j,{children:(0,t.jsx)(d,{color:i.leftSubtextColor||s.colors.legacy.textDiminished,size:13,children:i.leftSubtext})})}):null,i.rightSubtext?(0,t.jsx)(q,{children:(0,t.jsx)(j,{children:(0,t.jsx)(d,{color:i.rightSubtextColor||s.colors.legacy.textDiminished,size:13,children:i.rightSubtext})})}):null]})]},`summary-row-${p}`)})]})},"SummaryLegacy"),st=l(({name:e,imageURL:o})=>(0,t.jsxs)("div",{style:{display:"flex",flexDirection:"row",alignItems:"center"},children:[(0,t.jsx)($,{iconUrl:o,width:16}),(0,t.jsx)(d,{margin:"0 0 0 5px",weight:500,children:e})]}),"ActivityProvider"),oe=r.div`
  height: 100%;
  overflow: scroll;
  margin-top: -16px;
  padding-top: 16px;
  padding-bottom: 64px;
`,ie=r.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`,re=r.div`
  margin-top: 10px;
  margin-bottom: 10px;
`,ae=r.div`
  margin-top: 10px;
  margin-bottom: 20px;
`,ne=r.div`
  margin-bottom: 10px;
`,se=r.div`
  position: relative;
  width: 100%;
  text-align: center;
  margin: 10px 0 10px 0;
`,le=r(d)`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  max-width: 100%;
`,de=r.div`
  background-color: ${s.colors.legacy.spotWarning};
  width: 100%;
  margin-top: 24px;
  margin-bottom: 14px;
  border-radius: 9px;
  padding: 16px;
  gap: 8px;
  display: flex;
  align-items: flex-start;
  align-self: stretch;
`,ce=r.div`
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
`,lt=l(({title:e,primaryText:o,secondaryText:a,image:c,sections:n,leftButton:y,warning:m})=>(0,t.jsxs)(oe,{children:[(0,t.jsxs)(ie,{children:[(0,t.jsxs)(se,{children:[y||!1,(0,t.jsx)(d,{weight:500,size:22,children:e})]}),(0,t.jsx)(re,{children:c}),o.value&&(0,t.jsx)(le,{weight:600,size:34,color:o.color,align:"center",margin:"10px 0 10px 0",children:o.value}),a.value&&(0,t.jsx)(d,{size:16,color:s.colors.legacy.textDiminished,margin:"0 0 10px 0",children:a.value}),m&&(0,t.jsxs)(de,{children:[(0,t.jsx)(ce,{children:(0,t.jsx)(P,{})}),(0,t.jsx)(d,{size:14,color:s.colors.legacy.areaBase,margin:"3px 0px 3px 8px",children:m})]})]}),n.map(({title:i,rows:p},g)=>(0,t.jsxs)(ae,{children:[i&&(0,t.jsx)(ne,{children:(0,t.jsx)(d,{size:14,weight:500,color:s.colors.legacy.textDiminished,children:i})}),(0,t.jsx)(Z,{rows:p})]},`summary-item-${g}`))]}),"Details");export{Z as a,st as b,lt as c};
//# sourceMappingURL=chunk-FSNLRRGT.js.map
