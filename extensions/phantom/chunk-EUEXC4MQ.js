import{b as W}from"./chunk-F3K4WVVR.js";import{c as T}from"./chunk-ZRXZH5P6.js";import{M as v,Y as O,_ as R,_a as P}from"./chunk-TASZSJEG.js";import{c as p}from"./chunk-X3QTRQZS.js";import{d as I}from"./chunk-OXHZN6EN.js";import{Hb as L,Pa as C}from"./chunk-WLD4SJJO.js";import{He as A,oe as M}from"./chunk-7YHYDYR3.js";import{X as m}from"./chunk-W3XZ57NO.js";import{Ba as D,L as b,M as V,Rb as _,Ya as B,ab as N}from"./chunk-VKBPNC3B.js";import{a as s,g as u,i as g,n as w}from"./chunk-WKJYWAXG.js";g();w();var $=u(_(),1);var n=u(b(),1);var x=u(V(),1),F=(0,n.createContext)({pushDetailViewCallback:s(()=>m,"pushDetailViewCallback"),pushDetailView:m,popDetailView:m,resetDetailView:m,detailViewStackLength:0}),X=p(N.div)`
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  max-height: ${e=>e.theme?.detailViewMaxHeight??"100%"};
  min-height: ${e=>e.theme?.detailViewMinHeight??"initial"};
`,ue=n.default.memo(({children:e,shouldResetOnAccountChange:t,shouldPushDetailView:o})=>{let{detailViewStack:a,setDetailViewStack:c,pushDetailView:r,...l}=G(),{data:d}=L();return(0,n.useEffect)(()=>{t&&c([])},[d,c,t]),(0,n.useEffect)(()=>{o&&r(e)},[e,o,r]),(0,x.jsx)(F.Provider,{value:{...l,pushDetailView:r,detailViewStackLength:a.length},children:(0,x.jsx)(q,{stack:a,children:e})})}),j=navigator.webdriver?0:500,G=s(()=>{let[e,t]=(0,n.useState)([]),o=(0,n.useMemo)(()=>(0,$.default)(l=>{t(d=>C(d,f=>{f.push(l)}))},j,{leading:!0,trailing:!1}),[t]),a=(0,n.useCallback)(()=>{t(l=>C(l,d=>{d.pop()}))},[t]),c=(0,n.useCallback)(l=>()=>{o(l)},[o]),r=(0,n.useCallback)(()=>()=>{t([])},[t]);return(0,n.useMemo)(()=>({detailViewStack:e,setDetailViewStack:t,pushDetailView:o,popDetailView:a,resetDetailView:r,pushDetailViewCallback:c}),[e,a,o,r,c])},"useDetailViewStack"),J=.15,q=s(({children:e,stack:t})=>{let o=A(t,(f,h)=>f?.length===h.length),a=M(t),c=t.length>(o??[]).length,r=o===void 0;return(0,x.jsx)(B,{mode:"wait",children:(0,x.jsx)(X,{initial:{x:r?0:c?10:-10,opacity:r?1:0},animate:{x:0,opacity:1},exit:{opacity:0},transition:{duration:J},ref:K,children:a||e},`${t.length}_${o?.length}`)})},"DetailViewsController"),k=s(()=>{let e=(0,n.useContext)(F);if(!e)throw new Error("Missing detail view context");return e},"useDetailViews"),K=s(e=>{e&&e.parentElement&&(e.parentElement.scrollTop=0)},"resetScroll");g();w();var S=u(b(),1);var Q=(0,S.createContext)({isOpen:!1,showSettingsMenu:m,hideSettingsMenu:m}),z=s(()=>(0,S.useContext)(Q),"useSettingsMenu");g();w();var y=u(b(),1);var i=u(V(),1),Y=p.section`
  z-index: 1;
  background-color: ${D.colors.legacy.areaBase};
  padding: 10px 16px;
  display: flex;
  flex-shrink: 0;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${D.colors.legacy.elementBase};
  height: ${I}px;
  width: 100%;
`,Z=p(P).attrs(e=>({size:16,weight:500,lineHeight:25,maxWidth:e.maxWidth??"280px",noWrap:e.noWrap??!0}))``,ee=p.div`
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  padding-bottom: 17px;
  position: relative;
  width: 100%;
`,U=p(W)`
  position: absolute;
  right: 0;
`,H=p(T)`
  position: absolute;
  left: 0;
`,Le=s(({children:e,items:t,sections:o,icon:a,shouldWrap:c,onIconClick:r,onLeftButtonClick:l,useCloseButton:d})=>{let f=ie({withCloseButton:d??!1,onLeftButtonClick:l}),h=o&&o.length>0||t&&t.length>0;return(0,i.jsxs)(ee,{children:[f,(0,i.jsx)(P,{weight:500,size:22,noWrap:!c,maxWidth:"280px",children:e}),h||r?(0,i.jsx)(U,{sections:o,items:t,icon:a||(0,i.jsx)(O,{}),onIconClick:r}):(0,i.jsx)("div",{})]})},"PageHeader"),te=p(Y)`
  position: relative;
  border-bottom: none;

  &:after {
    content: "";
    position: absolute;
    bottom: 0;
    left: -20px;
    width: calc(100% + 40px);
    border-bottom: 1px solid ${D.colors.legacy.borderDiminished};
  }
`,oe=p.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
`,Be=s(({children:e,sections:t,items:o,icon:a,shouldWrap:c,onIconClick:r,onLeftButtonClick:l,disableIconBackground:d})=>{let f=ne(l),h=t&&t.length>0||o&&o.length>0;return(0,i.jsxs)(te,{children:[f,(0,i.jsx)(oe,{children:typeof e=="string"?(0,i.jsx)(Z,{noWrap:!c,children:e}):e}),h||r?(0,i.jsx)(U,{sections:t,items:o,icon:a,onIconClick:r,disableIconBackground:d}):(0,i.jsx)("div",{})]})},"SettingsHeader"),ie=s(({withCloseButton:e,onLeftButtonClick:t})=>{let{popDetailView:o,detailViewStackLength:a}=k();return(0,y.useMemo)(()=>a===0?(0,i.jsx)("div",{}):(0,i.jsx)(H,{onClick:()=>{t?.(),o()},"data-testid":"header--back",children:e?(0,i.jsx)(v,{}):(0,i.jsx)(R,{})}),[e,a,t,o])},"usePageHeaderLeftButton"),ne=s(e=>{let{hideSettingsMenu:t}=z(),{popDetailView:o,detailViewStackLength:a}=k();return(0,y.useMemo)(()=>a>0?(0,i.jsx)(H,{onClick:()=>{o()},"data-testid":"header--back",children:(0,i.jsx)(R,{})}):(0,i.jsx)(H,{"data-testid":"settings-menu-close-button",onClick:e??t,children:(0,i.jsx)(v,{})}),[a,t,e,o])},"useSettingsHeaderLeftButton");export{ue as a,k as b,Q as c,z as d,Y as e,Z as f,Le as g,Be as h,ne as i};
//# sourceMappingURL=chunk-EUEXC4MQ.js.map
