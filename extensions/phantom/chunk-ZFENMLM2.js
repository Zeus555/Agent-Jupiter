import{e as Se}from"./chunk-FWDO4YFN.js";import{a as E,c as z,d as K,e as H,f as _}from"./chunk-R7DU4FJL.js";import{a as A}from"./chunk-2ICRCYBD.js";import{a as ye,b as X}from"./chunk-COY2AKMU.js";import{a as ie}from"./chunk-M5GDXRS4.js";import{_a as v,p as W}from"./chunk-TASZSJEG.js";import{c as s}from"./chunk-X3QTRQZS.js";import{N as fe,O as he}from"./chunk-UWVKE6UK.js";import{a as M}from"./chunk-SQYWWEVC.js";import{b as ue}from"./chunk-U3L4PRI4.js";import{g as me}from"./chunk-ZQZJIKZB.js";import{A as oe,B as re,Mb as le,ea as ne,fb as N,ib as se,ic as $,ja as ae,lb as ce,o as te,tb as de,xc as pe}from"./chunk-WLD4SJJO.js";import{Ec as Z,Hc as j,Ib as I,V as Y,qd as ee}from"./chunk-7YHYDYR3.js";import{Ba as L,F as Q,G as J,L as V,M as h,Va as b,Y as C,mb as T}from"./chunk-VKBPNC3B.js";import{a as c,g as p,i as m,n as u}from"./chunk-WKJYWAXG.js";m();u();var be=p(V(),1);m();u();var Ae=p(V(),1);var n=p(h(),1),ge=c(({onChange:e,value:t,networkID:o})=>{let d=N(),i=(0,Ae.useMemo)(()=>{if(!o)return[];let w=I.getAddressTypes(o);return d.filter(l=>w.includes(l))},[d,o]);if(!i||i.length===0)return null;let y=i.includes(t)?t:i[0];return(0,n.jsx)(Be,{onChange:e,value:y,children:({isExpanded:w})=>(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(Fe,{isActive:w,children:(0,n.jsx)(we,{networkID:o,addressType:y,children:(0,n.jsx)(xe,{children:(0,n.jsx)(W,{fill:L.colors.legacy.textDiminished,width:10})})})}),(0,n.jsx)(Pe,{portal:!1,children:(0,n.jsx)(H,{maxHeight:"300px",children:i?.filter(l=>l!==y)?.map(l=>(0,n.jsx)(Ne,{value:l,children:(0,n.jsx)(we,{networkID:o,addressType:l})},l))})})]})})},"SelectAddressTypeDropdown"),we=c(({addressType:e,networkID:t,children:o})=>!t||!e?null:(0,n.jsxs)(A,{justify:"space-between",children:[(0,n.jsxs)(A,{children:[(0,n.jsx)(M,{networkID:t,size:32}),(0,n.jsx)(Le,{children:Y.getDisplayName(e)})]}),o]}),"SelectRow"),Be=s(E)`
  width: 100%;
  position: relative;
`,xe=s.div`
  display: inline-flex;
  line-height: 0;
`,Fe=s(({isActive:e,...t})=>(0,n.jsx)(z,{...t}))`
  padding: 8px 16px 8px 12px;

  ${xe} {
    svg {
      transform: rotate(${e=>e.isActive?"-180deg":"0"});
      transition: transform 0.2s ease-in-out;
    }
  }
`,Pe=s(K)`
  z-index: 2;
  width: 100%;
`,Ne=s(_)`
  padding: 8px 16px 8px 12px;
  min-height: 50px;
`,Le=s(v).attrs({size:16,weight:400,lineHeight:19,margin:"0 0 0 8px"})``;m();u();var a=p(h(),1),Me=s(E)`
  width: 100%;
  position: relative;
`,Ce=s.div`
  display: inline-flex;
  line-height: 0;
`,We=s(({isActive:e,...t})=>(0,a.jsx)(z,{...t}))`
  padding: 8px 16px 8px 12px;

  ${Ce} {
    svg {
      transform: rotate(${e=>e.isActive?"-180deg":"0"});
      transition: transform 0.2s ease-in-out;
    }
  }
`,Ee=s(K)`
  z-index: 2;
  width: 100%;
`,ze=s(_)`
  padding: 8px 16px 8px 12px;
  min-height: 50px;
`,Ke=s(v).attrs({size:16,weight:400,lineHeight:19,margin:"0 0 0 8px"})``,ve=c(({onChange:e,value:t})=>{let o=se();return(0,a.jsx)(Me,{onChange:e,value:t,children:({isExpanded:d})=>(0,a.jsxs)(a.Fragment,{children:[(0,a.jsx)(We,{isActive:d,children:(0,a.jsx)(Ie,{networkID:t,children:(0,a.jsx)(Ce,{children:(0,a.jsx)(W,{fill:L.colors.legacy.textDiminished,width:10})})})}),(0,a.jsx)(Ee,{portal:!1,children:(0,a.jsx)(H,{maxHeight:"300px",children:o.filter(i=>i!==t).map(i=>(0,a.jsx)(ze,{value:i,children:(0,a.jsx)(Ie,{networkID:i})},i))})})]})})},"SelectChainDropdown"),Ie=c(({networkID:e,children:t})=>(0,a.jsxs)(A,{justify:"space-between",children:[(0,a.jsxs)(A,{children:[(0,a.jsx)(M,{networkID:e,size:32}),(0,a.jsx)(Ke,{children:I.getNetworkName(e)})]}),t]}),"SelectRow");var r=p(h(),1),Wt=c(({onClick:e,disabled:t})=>{let{t:o}=C(),d=ce();return(0,r.jsx)(b,{topLeft:{text:o("addAccountImportWalletPrimaryText")},bottomLeft:{text:o(d?"addAccountImportWalletSolanaSecondaryText":"addAccountImportWalletSecondaryText")},start:(0,r.jsx)(T,{backgroundColor:"borderBase",color:"textBase",icon:"Download",shape:"circle",size:32}),onClick:e,disabled:t})},"ImportPrivateKeyButton"),Et=c(({control:e,getValues:t,register:o,setValue:d,trigger:i,errors:y,nameValidations:w,privateKey:l,privateKeyValidations:B,addressPreview:R})=>{let{t:k}=C(),F=pe(x=>x.editableAccountMetadata),S=t("networkID"),O=I.getAddressTypes(S),f=N(),g=f.filter(x=>O.includes(x));return(0,r.jsxs)(Se,{children:[(0,r.jsx)($,{name:"networkID",control:e,render:({field:{onChange:x,value:U}})=>f.length===1?(0,r.jsx)(r.Fragment,{}):(0,r.jsx)(ve,{onChange:P=>{x(P);let Re=I.getAddressTypes(P),ke=f.filter(De=>Re.includes(De));d("addressType",ke[0]),l&&i("privateKey")},value:U})}),(0,r.jsx)($,{name:"addressType",control:e,render:({field:{onChange:x,value:U}})=>g.length===1?(0,r.jsx)(r.Fragment,{}):(0,r.jsx)(ge,{onChange:P=>{x(P),l&&i("privateKey")},value:U,networkID:S})}),(0,r.jsx)(X.WithWarning,{placeholder:k("addAccountImportAccountName"),defaultValue:F?.name,warning:!!y.name,warningMessage:y.name?.message,autoComplete:"off",maxLength:me,...o("name",w)}),(0,r.jsx)(Oe.WithWarning,{placeholder:k("addAccountImportAccountPrivateKey"),defaultValue:"",warning:!!y.privateKey,warningMessage:y.privateKey?.message,autoComplete:"off",...o("privateKey",B)}),R?(0,r.jsx)(He,{label:k("settingsWalletAddress"),pubkey:R}):null]})},"ImportPrivateKeyFormInputStack"),He=be.default.memo(({label:e,pubkey:t})=>(0,r.jsxs)(A,{justify:"space-between",align:"center",margin:"-7px 0 0",children:[(0,r.jsx)(v,{size:16,weight:600,children:e}),(0,r.jsx)(v,{size:16,children:re(t,4)})]})),_e=s(X).attrs({as:"textarea"})`
  height: 120px;
  text-align: start;
  resize: none;
  -webkit-text-security: disc;
  font-size: 16px;
`,Oe=ye(_e);m();u();var q=p(h(),1),$t=c(({onClick:e,disabled:t})=>{let{t:o}=C(),d=Q||J;return(0,q.jsx)(b,{topLeft:{text:o("addAccountHardwareWalletPrimaryText")},bottomLeft:{text:o("addAccountHardwareWalletSecondaryText")},start:(0,q.jsx)(T,{backgroundColor:"borderBase",color:"textBase",icon:"WalletHardware",shape:"circle",size:32}),onClick:e,disabled:t||d})},"ConnectHardwareWalletButton");m();u();var G=p(h(),1),Zt=c(({onClick:e,disabled:t})=>{let{t:o}=C();return(0,G.jsx)(b,{topLeft:{text:o("addAccountImportSeedPhrasePrimaryText")},bottomLeft:{text:o("addAccountImportSeedPhraseSecondaryText")},start:(0,G.jsx)(T,{backgroundColor:"borderBase",color:"textBase",icon:"File",shape:"circle",size:32}),onClick:e,disabled:t})},"ImportSecretPhraseButton");m();u();var Te=p(V(),1);var mo=c(e=>{let t=ae(),{mutateAsync:o}=le(),{mutateAsync:d}=de(),i=ee();return{handleImportSeed:(0,Te.useCallback)(async({mnemonic:w,accountMetas:l,accountName:B,offsetIndex:R=0,seedlessOnboardingType:k})=>{let F={},S=await(e==="seed"?fe(w,l,B):he(w,l,B));if(S.forEach((f,g)=>{F[f.identifier]=te({account:f,index:g,offsetIndex:R})}),S.length===0)throw new Error("Failed to set seed phrase");if(await d({metadataBatch:F}),await o({identifier:S[0].identifier}),e==="seedless"&&k===ie.SeedlessBackup)try{let f=new Set(S.map(g=>g.seedIdentifier));await Promise.all([...f].map(g=>t.addAuthFactor({secretIdentifier:g})))}catch{j.captureError(new Error("Unable to add auth factor for se*dless!"),Z.Auth)}let O=S.flatMap(f=>oe(f));ue.capture("addSeedAccount",{data:{walletIndex:R+1,numAccounts:S.length,accountType:e,walletAddresses:O}}),ne(i)},[d,o,e,i,t])}},"useImportSeed");export{mo as a,ve as b,Wt as c,Et as d,$t as e,Zt as f};
//# sourceMappingURL=chunk-ZFENMLM2.js.map
