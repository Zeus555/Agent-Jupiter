import{a as U}from"./chunk-FNONDH5E.js";import{a as V,b as D}from"./chunk-DEZAQBMQ.js";import{a as y,b as T}from"./chunk-K7GILTCA.js";import{X as $}from"./chunk-TASZSJEG.js";import{c as L}from"./chunk-X3QTRQZS.js";import{X as x,p as H}from"./chunk-72OC3BG5.js";import{X as S}from"./chunk-W3XZ57NO.js";import{L as I,M as g}from"./chunk-VKBPNC3B.js";import{a as v,g as n,i as f,n as C}from"./chunk-WKJYWAXG.js";f();C();var R=n(I(),1);f();C();var E=n(I(),1);f();C();var P=n(I(),1);var B=n(g(),1),_=L.div`
  visibility: ${e=>e.isHidden?"hidden":"visible"};
  model-viewer {
    --poster-color: transparent;
    --progress-bar-color: transparent;
    --progress-mask: transparent;
    width: ${e=>e.width}px;
    height: ${e=>e.height}px;
  }
`,A=!1;function z(){A||(A=!0,import("./model-viewer-DQPPBUJJ.js"))}v(z,"loadModelViewer");var N=v(({src:e,alt:a,autoRotate:t,autoPlay:r,cameraControls:o,loading:i,width:u=154,height:p=154,onLoad:l=S,onError:b=S,isHidden:w=!1})=>{z();let s=(0,P.useRef)(null);return(0,P.useEffect)(()=>{let h=s.current;if(h)return h.addEventListener("load",l),h.addEventListener("error",b),()=>{h.removeEventListener("load",l),h.removeEventListener("error",b)}},[b,l,s]),(0,B.jsx)(_,{width:u,height:p,isHidden:w,children:(0,B.jsx)("model-viewer",{alt:a,loading:i??"eager","auto-rotate-delay":0,"auto-rotate":t||void 0,autoplay:r||void 0,"camera-controls":o||void 0,ref:s,src:e})})},"ModelViewer"),F=N;var d=n(g(),1),O=E.default.memo(e=>{let{uri:a,width:t,height:r,isCameraControlsEnabled:o}=e,[i,u]=(0,E.useState)(!0),[p,l]=(0,E.useState)(!1);return(0,d.jsxs)(d.Fragment,{children:[p?(0,d.jsx)(y,{children:(0,d.jsx)($,{})}):(0,d.jsx)(y,{children:(0,d.jsx)(F,{src:a,autoRotate:!0,autoPlay:!0,cameraControls:o,onLoad:v(()=>{u(!1),l(!1)},"onLoad"),onError:v(()=>{u(!1),l(!0)},"onError"),width:t,height:r,isHidden:i})}),i?(0,d.jsx)(V,{showBadge:!1}):null]})});f();C();var M=n(I(),1);var c=n(g(),1),X={width:"100%",height:"100%",objectFit:"cover",borderRadius:"8px"},W=M.default.memo(e=>{let{uri:a,showSkeletonBadge:t=!1,autoPlay:r=!0,muted:o=!0,loop:i=!0,controls:u=!0}=e,[p,l]=(0,M.useState)("loading"),b=(0,M.useCallback)(()=>{l("success")},[]),w=(0,M.useCallback)(()=>{l("error")},[]),s=a!==null&&a.trim()!==""?a:null;return(0,c.jsxs)(c.Fragment,{children:[p==="error"||!s?(0,c.jsx)(y,{children:(0,c.jsx)(T,{type:"video"})}):(0,c.jsx)(y,{children:(0,c.jsx)("video",{src:s,onLoadedData:b,onError:w,autoPlay:r,muted:o,loop:i,controls:u,playsInline:!0,style:X})}),p==="loading"&&s?(0,c.jsx)(V,{showBadge:t}):null]})});var m=n(g(),1),Z=328,q=L.div`
  width: ${e=>e.width}px;
  height: ${e=>e.height}px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 8px;
  position: relative;
`,Ee=R.default.memo(({media:e,collectibleChainData:a,width:t=328,height:r=328})=>{let o=e?.type??"image",i=x(e,o,!0),u=x(e,"image",!1,"large"),p=o==="image",l=o==="video",b=o==="audio",w=o==="model",s=o==="other"||b,h=(0,R.useMemo)(()=>{if(i)return(0,m.jsx)(m.Fragment,{children:p?(0,m.jsx)(D,{width:Z,height:Z,uri:i,isZoomControlsEnabled:!0,showSkeletonBadge:!1}):l?(0,m.jsx)(W,{uri:i,width:t,height:r,showSkeletonBadge:!1}):w?(0,m.jsx)(O,{uri:i,width:t,height:r,isCameraControlsEnabled:!0}):s?(0,m.jsx)(D,{uri:u??"",width:t,height:r}):null});if(H(a))return(0,m.jsx)(U,{...a.utxoDetails})},[a,r,p,w,s,l,i,u,t]);return(0,m.jsx)(q,{width:t,height:r,children:h})});export{Ee as a};
//# sourceMappingURL=chunk-VEP5C3XM.js.map
