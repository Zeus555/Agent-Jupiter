import{c as I}from"./chunk-5W3EK5R3.js";import{_a as u,ba as C,v as h,y as b}from"./chunk-TASZSJEG.js";import{c as n}from"./chunk-X3QTRQZS.js";import{Ba as r,M as d,Y as f}from"./chunk-VKBPNC3B.js";import{a as e,g as a,i as s,n as c}from"./chunk-WKJYWAXG.js";s();c();var i=a(d(),1),O=n.div`
  width: 94px;
  height: 94px;
  margin: auto;
  position: relative;
  border-radius: ${t=>t.borderRadius};
  background: ${t=>t.background};
`,P=n.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`,L=n.div`
  @keyframes rotate {
    0% {
      transform: rotateZ(0deg);
    }
    100% {
      transform: rotateZ(360deg);
    }
  }
  animation: rotate 0.5s linear infinite;
  position: absolute;
  margin: 0 auto;
  width: 94px;
  height: 94px;
  border-radius: 100%;
  box-shadow: 0 0 0 7px rgba(from ${r.colors.legacy.spotWarning} r g b / 10%);
  & > svg {
    position: absolute;
    bottom: -8px;
    right: -9px;
  }
`,x=e(({children:t,color:g=r.colors.brand.yellowMoon})=>(0,i.jsxs)(O,{children:[(0,i.jsx)(L,{children:(0,i.jsx)("svg",{width:38,height:60,viewBox:"0 0 38 60",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:(0,i.jsx)("path",{fillRule:"evenodd",clipRule:"evenodd",d:"M31.897 5.75301C33.5532 5.70601 34.9339 7.01051 34.9809 8.6667C35.2548 18.3187 32.5493 27.8208 27.2322 35.8808C21.9151 43.9408 14.2446 50.1676 5.26377 53.7144C3.72274 54.323 1.98013 53.5671 1.37153 52.0261C0.762941 50.485 1.51883 48.7424 3.05986 48.1338C10.8942 45.0398 17.5855 39.6079 22.2238 32.5769C26.8621 25.5458 29.2223 17.2567 28.9833 8.8369C28.9363 7.18071 30.2408 5.80001 31.897 5.75301Z",fill:g})})}),t&&(0,i.jsx)(P,{children:t})]}),"IconLoading");s();c();var o=a(d(),1),_=e(({icon:t,title:g,onClose:S,iconSize:R="normal",showButton:p=!0,buttonText:y,children:k,onIgnore:T,ignoreText:m})=>{let{t:z}=f(),l=R==="large"?44:32,$=y||z("commandClose");return(0,o.jsxs)(N,{children:[(0,o.jsxs)("section",{children:[t==="loading"?(0,o.jsx)(x,{children:(0,o.jsx)(C,{width:l})}):t==="error"?(0,o.jsx)(F,{iconSize:l}):(0,o.jsx)(M,{iconSize:l}),(0,o.jsx)(D,{children:g}),k]}),m!==void 0&&(0,o.jsx)(j,{onClick:T,children:m}),(0,o.jsx)(Z,{hasMarginBottom:!p,children:p?(0,o.jsx)(I,{onClick:S,children:$}):(0,o.jsx)(o.Fragment,{children:"\xA0"})})]})},"TransactionStatusDetail"),F=e(({iconSize:t})=>(0,o.jsx)(v,{borderRadius:"100%",background:`rgba(from ${r.colors.legacy.spotNegative} r g b / 10%)`,children:(0,o.jsx)(w,{children:(0,o.jsx)(h,{width:t})})}),"ErrorIcon"),M=e(({iconSize:t})=>(0,o.jsx)(v,{borderRadius:"100%",background:`rgba(from ${r.colors.legacy.spotPositive} r g b / 10%)`,children:(0,o.jsx)(w,{children:(0,o.jsx)(b,{width:t,fill:r.colors.legacy.spotPositive})})}),"IconSuccess"),N=n.section`
  display: grid;
  grid-template-rows: 1fr auto;
  height: 100%;
  & > section:first-child {
    display: grid;
    gap: 8.5px;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: auto;
  }
`,D=n(u).attrs({size:28,lineHeight:33.89,weight:500})`
  word-wrap: break-word;
  overflow: hidden;
  margin-top: 15px;
`,v=n.div`
  width: 94px;
  height: 94px;
  margin: auto;
  position: relative;
  border-radius: ${t=>t.borderRadius};
  background: ${t=>t.background};
`,w=n.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`,Z=n.div`
  margin-bottom: ${t=>t.hasMarginBottom&&"60px"};
  width: 100%;
`,j=n(u)`
  margin: auto;
  font-size: 14px;
  padding-bottom: 35px;
  color: ${r.colors.legacy.textDiminished};
  font-weight: 500;
  &:hover {
    color: ${r.colors.legacy.spotNegative};
  }
`;export{x as a,_ as b};
//# sourceMappingURL=chunk-IENUT57A.js.map
