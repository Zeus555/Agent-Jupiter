import{a as oo,b as G}from"./chunk-4HDKJQH4.js";import{a as z}from"./chunk-7AGHSKOZ.js";import"./chunk-IENUT57A.js";import{a as A}from"./chunk-GB2PTM7B.js";import"./chunk-5W3EK5R3.js";import{_a as p,d as J,n as $}from"./chunk-TASZSJEG.js";import{a as M,c}from"./chunk-X3QTRQZS.js";import"./chunk-MZKQ4MSV.js";import{g as E,l as _}from"./chunk-7CWP5SI2.js";import{a as y}from"./chunk-CDWQ2ZZU.js";import"./chunk-72OC3BG5.js";import"./chunk-UWVKE6UK.js";import"./chunk-WVRYN4MY.js";import"./chunk-TFYO45HT.js";import{t as I}from"./chunk-6LIVARTH.js";import"./chunk-QHYUU3AO.js";import{b as S,f as D}from"./chunk-GY6QHOJ7.js";import"./chunk-2AOCY26Y.js";import"./chunk-OXHZN6EN.js";import"./chunk-SQYWWEVC.js";import{a as F}from"./chunk-U3L4PRI4.js";import{a as N}from"./chunk-A2EKZXK7.js";import{M as P}from"./chunk-ZQZJIKZB.js";import"./chunk-YJCG6GWC.js";import"./chunk-WLD4SJJO.js";import{ib as j}from"./chunk-2MEZL2PN.js";import{Fc as T,ed as U,qc as v,xd as m}from"./chunk-7YHYDYR3.js";import"./chunk-W3XZ57NO.js";import"./chunk-RWWUDPHX.js";import{Ba as f,L,M as l,Y as C}from"./chunk-VKBPNC3B.js";import"./chunk-FNC6PQ53.js";import"./chunk-5QQLABHI.js";import{a as e,g as i,i as a,n as s}from"./chunk-WKJYWAXG.js";a();s();var Co=i(L(),1);var X=i(oo(),1);a();s();var x=i(L(),1);a();s();var q=i(j(),1);var o=i(l(),1),g=f.colors.legacy.spotNegative,to=c.div`
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  background-color: ${f.colors.brand.white};
  padding: clamp(24px, 16vh, 256px) 24px;
  box-sizing: border-box;
`,ro=c.div`
  margin-bottom: 24px;
  padding-bottom: 8vh;
`,io=c.div`
  max-width: 100ch;
  margin: auto;

  * {
    text-align: left;
  }
`,K=c.a`
  text-decoration: underline;
  color: ${g};
`,h=new F,Q=e(({origin:r,subdomain:n})=>{let{t:d}=C(),b=r?D(r):"",Y=r??"",B=new URL(Y),k=B.hostname,W=n==="true"?k:b,w=(0,q.toUnicode)(W),Z=e(async()=>{if(n==="true"){let O=await h.get(m.UserWhitelistSubdomains),t=JSON.parse(`${O}`);t?t.push(k):t=[k],t=[...new Set(t)],h.set(m.UserWhitelistSubdomains,JSON.stringify(t))}else{let O=await h.get(m.UserWhitelistedOrigins),t=JSON.parse(`${O}`);t?t.push(b):t=[b],t=[...new Set(t)],h.set(m.UserWhitelistedOrigins,JSON.stringify(t))}["http:","https:"].includes(B.protocol)&&self.location.assign(r)},"handleClick");return(0,o.jsx)(to,{children:(0,o.jsxs)(io,{children:[(0,o.jsx)(ro,{children:(0,o.jsx)($,{width:128,fill:f.colors.brand.white})}),(0,o.jsx)(p,{size:30,color:g,weight:"600",children:d("blocklistOriginDomainIsBlocked",{domainName:w||d("blocklistOriginThisDomain")})}),(0,o.jsx)(p,{color:g,children:d("blocklistOriginSiteIsMalicious")}),(0,o.jsx)(p,{color:g,children:(0,o.jsxs)(I,{i18nKey:"blocklistOriginCommunityDatabaseInterpolated",children:["This site has been flagged as part of a",(0,o.jsx)(K,{href:S,rel:"noopener",target:"_blank",children:"community-maintained database"}),"of known phishing websites and scams. If you believe the site has been flagged in error,",(0,o.jsx)(K,{href:S,rel:"noopener",target:"_blank",children:"please file an issue"}),"."]})}),W?(0,o.jsx)(p,{color:g,onClick:Z,hoverUnderline:!0,children:d("blocklistOriginIgnoreWarning",{domainName:w})}):(0,o.jsx)(o.Fragment,{})]})})},"BlocklistOrigin");var u=i(l(),1),eo=e(()=>{let r;try{r=new URLSearchParams(self.location.search).get("origin")||"",new URL(r)}catch{r=""}return r},"getOriginParam"),no=e(()=>new URLSearchParams(self.location.search).get("subdomain")||"","getSubdomainParam"),V=e(()=>{let r=(0,x.useMemo)(()=>eo(),[]),n=(0,x.useMemo)(()=>no(),[]);return(0,u.jsx)(J,{future:{v7_startTransition:!0},children:(0,u.jsx)(z,{children:(0,u.jsx)(Q,{origin:r,subdomain:n})})})},"Blocklist");var R=i(l(),1);N();v([[U,y]]);T.init({provider:G});await P(y);await E("frontend",_);var ao=document.getElementById("root"),so=(0,X.createRoot)(ao);so.render((0,R.jsx)(M,{theme:A,children:(0,R.jsx)(V,{})}));
//# sourceMappingURL=Phishing.js.map
