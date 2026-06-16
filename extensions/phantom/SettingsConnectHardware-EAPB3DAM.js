import{a as N,c as F,d as G,g as I}from"./chunk-VBYLL72J.js";import{a as x}from"./chunk-LUFC3JJZ.js";import"./chunk-CACZWADY.js";import{a as D}from"./chunk-6XWWC2CZ.js";import"./chunk-MDONU2VF.js";import"./chunk-35US6LTY.js";import"./chunk-GDURHALC.js";import"./chunk-IG6T2RDM.js";import"./chunk-QDOMAMUW.js";import"./chunk-G3ZMZLJV.js";import"./chunk-2M5IA4XR.js";import"./chunk-DQWLAPQA.js";import"./chunk-GBFCVK7L.js";import"./chunk-QOPHZSCS.js";import"./chunk-C2TTXVXF.js";import{a as L}from"./chunk-2ICRCYBD.js";import"./chunk-YLF46ZAV.js";import"./chunk-2EHWXEZV.js";import"./chunk-YKCWXP4A.js";import"./chunk-NL3GGYE5.js";import"./chunk-RZGOTFWC.js";import"./chunk-J4XA5VC7.js";import"./chunk-BC332QPU.js";import"./chunk-COY2AKMU.js";import"./chunk-MNQOPN6Y.js";import"./chunk-A6ZZ6VBL.js";import"./chunk-EUEXC4MQ.js";import{a as C}from"./chunk-CM3IULXA.js";import"./chunk-Z5R57KKX.js";import"./chunk-TQ3Z5AJY.js";import"./chunk-OENHJLUF.js";import"./chunk-QD564YCF.js";import"./chunk-S27Q2UQU.js";import"./chunk-F3K4WVVR.js";import"./chunk-ZRXZH5P6.js";import"./chunk-XUJZNDKG.js";import"./chunk-RRRTITMJ.js";import"./chunk-M5GDXRS4.js";import"./chunk-N3C6FBKY.js";import"./chunk-CTKHELYY.js";import"./chunk-7AGHSKOZ.js";import"./chunk-IENUT57A.js";import"./chunk-GB2PTM7B.js";import"./chunk-5W3EK5R3.js";import{q as _}from"./chunk-TASZSJEG.js";import{c as s}from"./chunk-X3QTRQZS.js";import{a as y}from"./chunk-CDWQ2ZZU.js";import"./chunk-UWVKE6UK.js";import"./chunk-WVRYN4MY.js";import"./chunk-TFYO45HT.js";import"./chunk-6LIVARTH.js";import"./chunk-QHYUU3AO.js";import"./chunk-GY6QHOJ7.js";import"./chunk-2AOCY26Y.js";import"./chunk-OXHZN6EN.js";import"./chunk-SQYWWEVC.js";import"./chunk-U3L4PRI4.js";import"./chunk-A2EKZXK7.js";import"./chunk-ZQZJIKZB.js";import"./chunk-YJCG6GWC.js";import{rb as $,xb as O}from"./chunk-WLD4SJJO.js";import"./chunk-2MEZL2PN.js";import{He as P,qe as E}from"./chunk-7YHYDYR3.js";import"./chunk-W3XZ57NO.js";import"./chunk-RWWUDPHX.js";import{Ba as e,L as z,M as u,Ya as R,ab as T}from"./chunk-VKBPNC3B.js";import"./chunk-FNC6PQ53.js";import"./chunk-5QQLABHI.js";import{a as g,g as l,i as n,n as i}from"./chunk-WKJYWAXG.js";n();i();var f=l(z(),1);n();i();n();i();var M=s(C)`
  cursor: pointer;
  width: 24px;
  height: 24px;
  transition: background-color 200ms ease;
  background-color: ${t=>t.$isExpanded?e.colors.legacy.black:e.colors.legacy.elementAccent} !important;
  :hover {
    background-color: ${e.colors.legacy.gray};
    svg {
      fill: white;
    }
  }
  svg {
    fill: ${t=>t.$isExpanded?"white":e.colors.legacy.textDiminished};
    transition: fill 200ms ease;
    position: relative;
    ${t=>t.top?`top: ${t.top}px;`:""}
    ${t=>t.right?`right: ${t.right}px;`:""}
  }
`;var o=l(u(),1),K=s(L).attrs({justify:"space-between"})`
  background-color: ${e.colors.legacy.areaBase};
  padding: 10px 16px;
  border-bottom: 1px solid ${e.colors.legacy.borderDiminished};
  height: 46px;
  opacity: ${t=>t.opacity??"1"};
`,Q=s.div`
  display: flex;
  margin-left: 10px;
  > * {
    margin-right: 10px;
  }
`,W=s.div`
  width: 24px;
  height: 24px;
`,X=g(({onBackClick:t,totalSteps:c,currentStepIndex:d,isHidden:m,showBackButtonOnFirstStep:r,showBackButton:S=!0})=>(0,o.jsxs)(K,{opacity:m?0:1,children:[S&&(r||d!==0)?(0,o.jsx)(M,{right:1,onClick:t,children:(0,o.jsx)(_,{})}):(0,o.jsx)(W,{}),(0,o.jsx)(Q,{children:E(c).map(p=>{let h=p<=d?e.colors.legacy.spotBase:e.colors.legacy.elementAccent;return(0,o.jsx)(C,{diameter:12,color:h},p)})}),(0,o.jsx)(W,{})]}),"StepHeader");n();i();var a=l(u(),1),Z=g(()=>{let{mutateAsync:t}=O(),{hardwareStepStack:c,pushStep:d,popStep:m,currentStep:r,setOnConnectHardwareAccounts:S,setOnConnectHardwareDone:b,setExistingAccounts:p}=N(),{data:h=[],isFetched:H,isError:v}=$(),w=P(c,(k,q)=>k?.length===q.length),J=c.length>(w??[]).length,B=w?.length===0,U={initial:{x:B?0:J?150:-150,opacity:B?1:0},animate:{x:0,opacity:1},exit:{opacity:0},transition:{duration:.2}},V=(0,f.useCallback)(()=>{r()?.props.preventBack||(r()?.props.onBackCallback&&r()?.props.onBackCallback?.(),m())},[r,m]);return D(()=>{S(async k=>{await t(k),await y.set(x,!await y.get(x))}),b(()=>self.close()),d((0,a.jsx)(I,{}))},c.length===0),(0,f.useEffect)(()=>{p({data:h,isFetched:H,isError:v})},[h,H,v,p]),(0,a.jsxs)(F,{children:[(0,a.jsx)(X,{totalSteps:3,onBackClick:V,showBackButton:!r()?.props.preventBack,currentStepIndex:c.length-1}),(0,a.jsx)(R,{mode:"wait",children:(0,a.jsx)(T.div,{style:{display:"flex",flexGrow:1},...U,children:(0,a.jsx)(G,{children:r()})},`${c.length}_${w?.length}`)})]})},"SettingsConnectHardware"),Tt=Z;export{Tt as default};
//# sourceMappingURL=SettingsConnectHardware-EAPB3DAM.js.map
