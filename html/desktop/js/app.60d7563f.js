(function(e){function t(t){for(var n,a,i=t[0],c=t[1],l=t[2],u=0,d=[];u<i.length;u++)a=i[u],Object.prototype.hasOwnProperty.call(s,a)&&s[a]&&d.push(s[a][0]),s[a]=0;for(n in c)Object.prototype.hasOwnProperty.call(c,n)&&(e[n]=c[n]);m&&m(t);while(d.length)d.shift()();return r.push.apply(r,l||[]),o()}function o(){for(var e,t=0;t<r.length;t++){for(var o=r[t],n=!0,a=1;a<o.length;a++){var i=o[a];0!==s[i]&&(n=!1)}n&&(r.splice(t--,1),e=c(c.s=o[0]))}return e}var n={},a={app:0},s={app:0},r=[];function i(e){return c.p+"js/"+({about:"about"}[e]||e)+"."+{about:"9fc66c6c","chunk-67936332":"112e6f27"}[e]+".js"}function c(t){if(n[t])return n[t].exports;var o=n[t]={i:t,l:!1,exports:{}};return e[t].call(o.exports,o,o.exports,c),o.l=!0,o.exports}c.e=function(e){var t=[],o={about:1,"chunk-67936332":1};a[e]?t.push(a[e]):0!==a[e]&&o[e]&&t.push(a[e]=new Promise((function(t,o){for(var n="css/"+({about:"about"}[e]||e)+"."+{about:"cf917a38","chunk-67936332":"ebd0544f"}[e]+".css",s=c.p+n,r=document.getElementsByTagName("link"),i=0;i<r.length;i++){var l=r[i],u=l.getAttribute("data-href")||l.getAttribute("href");if("stylesheet"===l.rel&&(u===n||u===s))return t()}var d=document.getElementsByTagName("style");for(i=0;i<d.length;i++){l=d[i],u=l.getAttribute("data-href");if(u===n||u===s)return t()}var m=document.createElement("link");m.rel="stylesheet",m.type="text/css",m.onload=t,m.onerror=function(t){var n=t&&t.target&&t.target.src||s,r=new Error("Loading CSS chunk "+e+" failed.\n("+n+")");r.code="CSS_CHUNK_LOAD_FAILED",r.request=n,delete a[e],m.parentNode.removeChild(m),o(r)},m.href=s;var p=document.getElementsByTagName("head")[0];p.appendChild(m)})).then((function(){a[e]=0})));var n=s[e];if(0!==n)if(n)t.push(n[2]);else{var r=new Promise((function(t,o){n=s[e]=[t,o]}));t.push(n[2]=r);var l,u=document.createElement("script");u.charset="utf-8",u.timeout=120,c.nc&&u.setAttribute("nonce",c.nc),u.src=i(e);var d=new Error;l=function(t){u.onerror=u.onload=null,clearTimeout(m);var o=s[e];if(0!==o){if(o){var n=t&&("load"===t.type?"missing":t.type),a=t&&t.target&&t.target.src;d.message="Loading chunk "+e+" failed.\n("+n+": "+a+")",d.name="ChunkLoadError",d.type=n,d.request=a,o[1](d)}s[e]=void 0}};var m=setTimeout((function(){l({type:"timeout",target:u})}),12e4);u.onerror=u.onload=l,document.head.appendChild(u)}return Promise.all(t)},c.m=e,c.c=n,c.d=function(e,t,o){c.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:o})},c.r=function(e){"undefined"!==typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},c.t=function(e,t){if(1&t&&(e=c(e)),8&t)return e;if(4&t&&"object"===typeof e&&e&&e.__esModule)return e;var o=Object.create(null);if(c.r(o),Object.defineProperty(o,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var n in e)c.d(o,n,function(t){return e[t]}.bind(null,n));return o},c.n=function(e){var t=e&&e.__esModule?function(){return e["default"]}:function(){return e};return c.d(t,"a",t),t},c.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},c.p="/html/desktop/",c.oe=function(e){throw console.error(e),e};var l=window["webpackJsonp"]=window["webpackJsonp"]||[],u=l.push.bind(l);l.push=t,l=l.slice();for(var d=0;d<l.length;d++)t(l[d]);var m=u;r.push([0,"chunk-vendors"]),o()})({0:function(e,t,o){e.exports=o("56d7")},"3c4e":function(e,t,o){"use strict";o("ae21")},"49f8":function(e,t,o){var n={"./en.json":"edd4","./iw.json":"4afc"};function a(e){var t=s(e);return o(t)}function s(e){if(!o.o(n,e)){var t=new Error("Cannot find module '"+e+"'");throw t.code="MODULE_NOT_FOUND",t}return n[e]}a.keys=function(){return Object.keys(n)},a.resolve=s,e.exports=a,a.id="49f8"},"4afc":function(e){e.exports=JSON.parse('{"login":"התחברות","Enter your password":"Enter your password","Enter your email address":"Enter your email address","Forgot Password":"Forgot Password?"}')},"56d7":function(e,t,o){"use strict";o.r(t);o("e260"),o("e6cf"),o("cca6"),o("a79d");var n=o("2b0e"),a=function(){var e=this,t=e.$createElement,o=e._self._c||t;return o("v-app",{attrs:{id:"inspire",color:"bg"}},[o("v-main",[o("router-view",{on:{updatePage:e.updatePage}})],1),o("floating-menu")],1)},s=[],r=o("af52"),i=function(){var e=this,t=e.$createElement;e._self._c;return e._m(0)},c=[function(){var e=this,t=e.$createElement,o=e._self._c||t;return o("div",[o("div",{attrs:{id:"menuBtn"}},[o("div",{attrs:{id:"menuCircle"}}),o("div",{attrs:{id:"menuImg"}})]),o("div",{attrs:{id:"menuBar"}},[o("div",{staticClass:"menuIcon",attrs:{id:"menuHome"}}),o("div",{staticClass:"menuIcon",attrs:{id:"menuTasks"}}),o("div",{staticClass:"menuIcon",attrs:{id:"menuInfo"}})])])}],l=(o("a9e3"),o("1157")),u=o.n(l),d={name:"FloatingMenu",data:function(){return{pos1:0,pos2:0,pos3:0,pos4:0,bodyWidth:0,bodyHeight:0,btnLeft:0,btnTop:0,preventClick:!1,timeoutID:0,elmnt:null,bar:null}},methods:{testFunc:function(){console.log("test")},initMenu:function(e,t){this.elmnt=e,this.bar=t,this.bodyWidth=document.body.clientWidth,this.bodyHeight=document.body.clientHeight,this.btnLeft=Number(r["a"].menuBtnLeft),this.btnTop=Number(r["a"].menuBtnTop),this.positionMenuBtn(),e.onmousedown=this.dragMouseDown,e.onclick=this.clickMenuBtn},positionMenuBtn:function(){var e=!1;return(!this.btnTop||this.btnTop<0)&&(this.btnTop=0,e=!0),this.btnTop+this.elmnt.offsetHeight>this.bodyHeight&&(this.btnTop=this.bodyHeight-this.elmnt.offsetHeight,e=!0),this.btnLeft||(this.btnLeft=this.bodyWidth/2-this.elmnt.offsetWidth/2),this.btnLeft<0&&(this.btnLeft=0,e=!0),this.btnLeft+this.elmnt.offsetWidth>this.bodyWidth&&(this.btnLeft=this.bodyWidth-this.elmnt.offsetWidth,e=!0),this.elmnt.style.top=this.btnTop+"px",this.elmnt.style.left=this.btnLeft+"px",this.positionMenuBar(this.btnLeft,this.btnTop),r["a"].menuBtnLeft=this.btnLeft,r["a"].menuBtnTop=this.btnTop,r["a"].commit(),e},clickMenuBtn:function(){if(console.log(window.location.hash),!this.preventClick)if("visible"!=this.bar.style.visibility){u()("#menuHome").hide(),u()("#menuTasks").hide();var e=this;u()("#menuInfo").click((function(){e.$router.push("/About"),e.bar.style.visibility="hidden",clearTimeout(e.timeoutID)})),this.positionMenuBar(this.elmnt.offsetLeft,this.elmnt.offsetTop),this.bar.style.visibility="visible",this.timeoutID=setTimeout((function(){"visible"===this.bar.style.visibility&&(this.bar.style.visibility="hidden")}),7e3)}else this.bar.style.visibility="hidden",clearTimeout(this.timeoutID)},dragMouseDown:function(e){e=e||window.event,e.preventDefault(),this.pos3=e.clientX,this.pos4=e.clientY,document.onmouseup=this.closeDragElement,document.onmousemove=this.elementDrag,this.preventClick=!1},elementDrag:function(e){e=e||window.event,e.preventDefault(),this.pos1=this.pos3-e.clientX,this.pos2=this.pos4-e.clientY,this.pos3=e.clientX,this.pos4=e.clientY,this.btnTop=this.elmnt.offsetTop-this.pos2,this.btnLeft=this.elmnt.offsetLeft-this.pos1;var t=this.positionMenuBtn();t&&this.closeDragElement(),this.preventClick=!0},positionMenuBar:function(e,t){var o=e+this.elmnt.offsetWidth/2-this.bar.offsetWidth/2;o<0&&(o=0),o+this.bar.offsetWidth>this.bodyWidth&&(o=this.bodyWidth-this.bar.offsetWidth);var n=t-56;n<0?(n=t+56,this.elmnt.style.transform="rotate(180deg)"):this.elmnt.style.transform="",this.bar.style.top=n+"px",this.bar.style.left=o+"px"},closeDragElement:function(){document.onmouseup=null,document.onmousemove=null}},mounted:function(){console.log("FloatingMenu created..");var e=document.getElementById("menuBtn"),t=document.getElementById("menuBar");console.log("menuBtn: ".concat(e)),this.initMenu(e,t)}},m=d,p=(o("3c4e"),o("2877")),h=Object(p["a"])(m,i,c,!1,null,null,null),f=h.exports,v={data:function(){return{drawer:!0,moduleName:"Nubo Desktop Client",menuItems:[],appData:r["a"]}},components:{FloatingMenu:f},methods:{updatePage:function(){}},created:function(){console.log("this.appData.isAuthenticated: ".concat(this.appData.isAuthenticated))}},b=v,g=o("6544"),y=o.n(g),k=o("7496"),w=o("f6c4"),P=Object(p["a"])(b,a,s,!1,null,"757bfc80",null),T=P.exports;y()(P,{VApp:k["a"],VMain:w["a"]});o("5363");var O=o("f309");n["a"].use(O["a"]);var S=new O["a"]({customVariables:["~/assets/variables.scss"],theme:{options:{customProperties:!0},themes:{light:{primary:"#3c4446",secondary:"#5f8982",accent:"#cc974c",error:"#b93e2d",info:"#5f8982",success:"#697d41",warning:"#cc974c",high:"#f2ecdf",bru:"f8f5ed",bg:"f8f5ed"}}},icons:{iconfont:"mdi"}}),C=(o("d3b7"),o("3ca3"),o("ddb0"),o("b0c0"),o("8c4f")),_=function(){var e=this,t=e.$createElement,o=e._self._c||t;return o("v-card",{attrs:{color:"bg"}},[o("v-card-title",[e._v(" "+e._s(e.$t("Dashboard"))+" ")]),o("v-form",[o("v-container",[o("v-row",[o("v-col",{attrs:{cols:"12",sm:"7",md:"4"}},[o("v-card",{attrs:{color:"bg"}},[o("v-card-title",[e._v(e._s(e.$t("Users")))]),o("v-card-subtitle",[e._v(e._s(e.dashboard.onlineUsers)+" "+e._s(e.$t("users are online")))]),o("pie-chart",{attrs:{"chart-data":e.onlineUsers}})],1)],1),e.appData.checkPermission("@/","r")?o("v-col",{attrs:{cols:"12",sm:"7",md:"4"}},[o("v-card",{attrs:{color:"bg"}},[o("v-card-title",[e._v(e._s(e.$t("Platforms")))]),o("v-card-subtitle",[e._v(e._s(e.dashboard.runningPlatforms)+" "+e._s(e.$t("platforms are up")))]),o("pie-chart",{attrs:{"chart-data":e.platforms}})],1)],1):e._e(),o("v-col",{attrs:{cols:"12",sm:"7",md:"4"}},[o("v-card",{attrs:{color:"bg"}},[o("v-card-title",[e._v(e._s(e.$t("Devices")))]),o("v-card-subtitle",[e._v(e._s(e.dashboard.onlineDevices)+" "+e._s(e.$t("devices are online")))]),o("pie-chart",{attrs:{"chart-data":e.onlineDevices}})],1)],1)],1),o("v-row",[e.appData.checkPermission("@/","r")?o("v-col",{attrs:{cols:"12",sm:"7",md:"4"}},[o("v-card",{attrs:{color:"bg"}},[o("v-card-title",[e._v(e._s(e.$t("Storage")))]),o("v-card-subtitle",[e._v(e._s(e.$t("Using"))+" "+e._s(e.dashboard.totalUsedSpaceMB/1e3)+" GB out of "+e._s(e.dashboard.totalSpaceMB)+" GB")]),o("pie-chart",{attrs:{"chart-data":e.storage}})],1)],1):e._e(),o("v-col",{attrs:{cols:"12",sm:"7",md:"4"}},[o("v-card",{attrs:{color:"bg"}},[o("v-card-title",[e._v(e._s(e.$t("Device Types")))]),o("pie-chart",{attrs:{"chart-data":e.deviceTypes}})],1)],1),o("v-col",{attrs:{cols:"12",sm:"7",md:"4"}},[o("v-card",{attrs:{color:"bg"}},[o("v-card-title",[e._v(e._s(e.$t("Sessions")))]),o("v-card-subtitle",[e._v(e._s(e.$t("Online sessions over time")))]),o("line-chart",{attrs:{"chart-data":e.lastSessions,options:e.lastSessionsOptions}})],1)],1)],1)],1)],1),o("v-snackbar",{attrs:{timeout:2e3},scopedSlots:e._u([{key:"action",fn:function(t){var n=t.attrs;return[o("v-btn",e._b({attrs:{color:"info",text:""},on:{click:function(t){e.snackbarSave=!1}}},"v-btn",n,!1),[e._v(" Close ")])]}}]),model:{value:e.snackbarSave,callback:function(t){e.snackbarSave=t},expression:"snackbarSave"}},[e._v(" "+e._s(e.snackbarText)+" ")])],1)},L=[],A={name:"Home",components:{},data:function(){return{dashboard:{},datacollection:null,snackbarSave:!1,snackbarText:"",lastSessionsOptions:{},onlineUsers:{},platforms:{},onlineDevices:{},storage:{},deviceTypes:{},lastSessions:{},appData:r["a"]}},methods:{fillData:function(){},getRandomInt:function(){return Math.floor(46*Math.random())+5},refresh:function(){}},created:function(){this.refresh()}},D=A,E=o("8336"),B=o("b0af"),R=o("99d9"),x=o("62ad"),I=o("a523"),U=o("4bd4"),V=o("0fd9"),N=o("2db4"),M=Object(p["a"])(D,_,L,!1,null,null,null),j=M.exports;y()(M,{VBtn:E["a"],VCard:B["a"],VCardSubtitle:R["b"],VCardTitle:R["d"],VCol:x["a"],VContainer:I["a"],VForm:U["a"],VRow:V["a"],VSnackbar:N["a"]});var W=o("96f7");n["a"].use(C["a"]);var q=[{path:"/",name:"Home",component:j},{path:"/About",name:"About",component:function(){return o.e("about").then(o.bind(null,"f820"))}},{path:"/Splash",name:"Splash",component:function(){return o.e("about").then(o.bind(null,"8f75"))}},{path:"/Signup",name:"Signup",component:function(){return o.e("about").then(o.bind(null,"34c3"))}},{path:"/Password",name:"Password",component:function(){return o.e("about").then(o.bind(null,"43fe"))}},{path:"/OTP",name:"OTP",component:function(){return o.e("about").then(o.bind(null,"19ad"))}},{path:"/Client",name:"Client",component:function(){return o.e("about").then(o.bind(null,"7b94"))}},{path:"/ActivationLink/:status/:activationType",name:"ActivationLink",component:function(){return o.e("chunk-67936332").then(o.bind(null,"1936"))}}],$=new C["a"]({routes:q}),F={About:1,Message:1,Splash:1,Signup:1,ActivationLink:1};$.beforeEach((function(e,t,o){W["a"].getWebCommon().then((function(){F[e.name]?o():r["a"].isValidated?r["a"].isValidated&&!r["a"].isValidatedChecked?(console.log("recheckValidate for login token: "+r["a"].loginToken),W["a"].get({url:"recheckValidate",params:{loginToken:r["a"].loginToken}}).then((function(e){console.log("recheckValidate ressponse.."),console.log(e.data),1==e.data.status?o():o({name:"Splash"})})).catch((function(e){console.error(e),o({name:"Splash"})}))):o():(console.log("Detect no login in route: "+e.name),o({name:"Splash"}))})).catch((function(e){console.error("Error in getWebCommon",e),o({name:"Splash"})}))}));var H=$,G=(o("159b"),o("ac1f"),o("466d"),o("a925"));function Y(){var e=o("49f8"),t={};return e.keys().forEach((function(o){var n=o.match(/([A-Za-z0-9-_]+)\./i);if(n&&n.length>1){var a=n[1];t[a]=e(o)}})),t}n["a"].use(G["a"]);var J=new G["a"]({locale:Object({NODE_ENV:"production",BASE_URL:"/html/desktop/"}).VUE_APP_I18N_LOCALE||"en",fallbackLocale:Object({NODE_ENV:"production",BASE_URL:"/html/desktop/"}).VUE_APP_I18N_FALLBACK_LOCALE||"en",messages:Y()}),X=o("95a1"),K=o.n(X);n["a"].config.productionTip=!1,n["a"].use(K.a,{timer:20,warning:{background:"#cc974c",color:"white"},error:{background:"#b93e2d",color:"white"},success:{background:"#697d41",color:"white"}}),new n["a"]({vuetify:S,router:H,i18n:J,render:function(e){return e(T)}}).$mount("#app")},"96f7":function(e,t,o){"use strict";o("d3b7");var n=o("af52"),a=o("bc3a"),s=o.n(a),r={req:function(e){return n["a"].postURL&&""!=n["a"].postURL&&(e.url=n["a"].postURL+e.url),n["a"].proxyURL&&""!=n["a"].proxyURL&&(e.url=n["a"].proxyURL+e.url),e.method||(e.method="get"),e.headers||(e.headers={}),s()(e)},post:function(e){return e.method="post",r.req(e)},get:function(e){return e.method="get",r.req(e)},put:function(e){return e.method="put",r.req(e)},delete:function(e){return e.method="delete",r.req(e)},getWebCommon:function(){return new Promise((function(e,t){n["a"].webCommon?e():r.get({url:"getWebCommon"}).then((function(t){console.log("getWebCommon ressponse"),console.log(t.data),n["a"].webCommon=t.data,e()})).catch((function(e){console.log(e),t(e)}))}))}};t["a"]=r},ae21:function(e,t,o){},af52:function(e,t,o){"use strict";var n=o("b85c"),a=(o("b0c0"),o("99af"),o("ec26")),s=o("337f"),r=o.n(s),i=!0,c=["firstname","lastname","email","deviceid","deviceName","activationkey","authUserPreference","menuBtnLeft","menuBtnTop"],l=["isAuthenticated","authComplete","isValidated","loginToken","clientauthtype","passwordValidated","biometricValidated","secondauthmethod","isCancelBiometric","isCancelOTP","isCancelPassword","canSetOTPToken","canSetBiometricToken","sessionid"],u="Desktop",d={production:i,postURL:i?"/":"https://labil.nubosoftware.com/",proxyURL:i?null:"http://127.0.0.1:9080/",appName:"Nubo Desktop",appVersion:"3.1.01",firstname:"",lastname:"",email:"",deviceid:"",deviceName:"",activationkey:"",menuBtnLeft:0,menuBtnTop:0,authComplete:"",secondauthmethod:"",isCancelBiometric:!1,isCancelOTP:!1,isCancelPassword:!1,canSetOTPToken:!1,canSetBiometricToken:!1,deviceType:u,isAuthenticated:!1,isValidated:!1,isValidatedChecked:!1,loginToken:"",sessionid:"",clientauthtype:0,passwordValidated:!1,biometricValidated:!1,authUserPreference:0,moduleName:"",commit:function(){var e,t=Object(n["a"])(c);try{for(t.s();!(e=t.n()).done;){var o=e.value;d.commitProp(o)}}catch(i){t.e(i)}finally{t.f()}var a,s=Object(n["a"])(l);try{for(s.s();!(a=s.n()).done;){var r=a.value;d.commitProp(r)}}catch(i){s.e(i)}finally{s.f()}},commitProp:function(e){var t=d[e];t&&"null"!=t?localStorage.setItem(e,d[e]):localStorage.removeItem(e)},load:function(){console.log("Loading app data..");var e,t=Object(n["a"])(c);try{for(t.s();!(e=t.n()).done;){var o=e.value;d[o]=localStorage.getItem(o)}}catch(p){t.e(p)}finally{t.f()}var s,i=Object(n["a"])(l);try{for(i.s();!(s=i.n()).done;){var u=s.value;d[u]=localStorage.getItem(u),console.log("".concat(u,": ").concat(d[u]))}}catch(p){i.e(p)}finally{i.f()}if(d.loginToken||d.clearValidate(),"false"==d.isAuthenticated&&(d.isAuthenticated=!1),console.log("Loading app data appData.isAuthenticated: ".concat(d.isAuthenticated)),d.deviceid&&""!=d.deviceid||(d.deviceid=Object(a["a"])(),localStorage.setItem("deviceid",d.deviceid),console.log("appData.deviceid: "+d.deviceid)),!d.deviceName||""==d.deviceName){var m=r.a.parse(navigator.userAgent);d.deviceName="".concat(m.browser.name),localStorage.setItem("deviceName",d.deviceName),console.log("deviceName: ".concat(d.deviceName))}console.log("Email: ".concat(d.email))},clearValidate:function(){var e,t=Object(n["a"])(l);try{for(t.s();!(e=t.n()).done;){var o=e.value;d[o]=""}}catch(a){t.e(a)}finally{t.f()}},deleteAll:function(){var e,t=Object(n["a"])(c);try{for(t.s();!(e=t.n()).done;){var o=e.value;d[o]=""}}catch(i){t.e(i)}finally{t.f()}var a,s=Object(n["a"])(l);try{for(s.s();!(a=s.n()).done;){var r=a.value;d[r]=""}}catch(i){s.e(i)}finally{s.f()}d.commit(),d.load()}};d.load(),t["a"]=d},edd4:function(e){e.exports=JSON.parse('{"Minimum characters":"- Minimum {minChars} characters.","Start session error":"Session creation failed. message: \'{msg}\'","Remote desktop error":"Remote desktop error. message: \'{msg}\'","Please scan the below QR code":"Please scan the below QR code using a compatible TOTP app (e.g., Google Authenticator) in your mobile device. Click “Scan Complete” when done.","About":"About","Back":"Back","Logout user":"Log out","Delete all user data":"Delete all data","Are you sure you want to delete all user data from this client?":"Are you sure you want to delete all user data from this browser?","Logout command has been sent":"Logout command has been sent","App name":"App name","App version":"App version","User ID":"User ID","Device ID":"Device ID","Browser":"Browser","Operating System":"Operating system","Starting session...":"Starting session...","Loading your remote desktop...":"Loading your remote desktop...","Dashboard":"Dashboard","Users":"Users","users are online":"users are online","Platforms":"Platforms","platforms are up":"platforms are up","Devices":"Devices","devices are online":"devices are online","Storage":"Storage","Using":"Using","Device Types":"Device Types","Sessions":"Sessions","Online sessions over time":"Online sessions over time","Enter your email address":"Enter your email address","Enter your password":"Enter your password","Re-enter your password":"Re-enter your password","login":"login","Forgot Password":"Forgot Password","Reset Password":"Reset Password","Cancel":"Cancel","Validated!":"User info has been validated.","Please select new password":"Please select a new password","Log in to the Admin Control Panel":"Log in to the Admin Control Panel","Reset password":"Reset password","A verification messaage has been sent to your email address. Please click the verification link in that email.":"A verification messaage has been sent to your email address. Please click the verification link in that email.","Reset password error":"Reset password error","Checking login information":"Checking login information","Incorrect email address or password":"Incorrect email address or password","Login successful":"Login successful","Password is required":"Password is required.","Email is required":"Email is required","Email must be valid":"Email must be valid","Remote Desktop":"Remote Desktop","OTP Code":"OTP Code","Login":"Log in","Reset the TOTP code?":"Reset the TOTP code?","Reset the TOTP code":"Reset the TOTP code","Reset OTP Code":"Reset OTP Code","Scan Complete":"Scan Complete","Reset OTP Code?":"Reset OTP Code?","Setting password":"Creating password...","Invalid password":"Invalid password","Setting OTP key..":"Creating OTP key..","Error":"Error","Checking OTP Code..":"Checking OTP Code..","Invalid OTP Code":"Invalid OTP Code","Please enter your one-time password found in the TOTP app in your mobile device.":"Please enter your one-time password found in the TOTP app in your mobile device.","OTP code is required":"OTP code is required","- Both upper-case and lower-case letters.":"- Both upper-case and lower-case letters.","- One or more numerical digits.":"- One or more numerical digits.","- One or more special characters.":"- One or more special characters.","Set Password":"Set Password","Forgot Password?":"Forgot Password?","Incorrect password":"Incorrect password","Create your password.":"Create your password","Required: both upper-case and lower-case letters":"Required: both upper-case and lower-case letters.","Required: one or more numerical digits.":"Required: one or more numerical digits.","Required: one or more special characters.":"Required: one or more special characters.","Enter your password.":"Enter your password.","Remote Desktop Signup":"Remote Desktop Signup","First name":"First name","Last name":"Last name","Activate":"Activate","Signup in progress..":"Signup in progress..","A verification message has been sent to your inbox. Please click the link to gain access to your remote desktop.":"A verification message has been sent to your inbox. Please click the link to gain access to your remote desktop.","Sign up error: ":"Signup error: ","Sign up to gain access to your remote desktop.":"Sign up to gain access to your remote desktop.","Sign Up":"Sign Up","Resend unlock email":"Resend email","Unlock email sent":"Email sent","A verification message has been sent to your inbox. Please click the link to gain access to your remote desktop":"A verification message has been sent to your inbox. Please click the link to gain access to your remote desktop.","A verification message has been sent to your inbox. Please click the link to reset your password":"A verification message has been sent to your inbox. Please click the link to reset your password.","A verification message has been sent to your inbox. Please click the link to reset your OTP key":"A verification message has been sent to your inbox. Please click the link to reset your OTP key.","You password has been locked. A verification message has been sent to your inbox. Please click the link to unlock your password.":"Your password has been locked. A verification message has been sent to your inbox. Please click the link to unlock your password.","Gain access to your remote desktop.":"Gain access to your remote desktop.","Email not found. Please retype, or sign up if you still have not.":"Email not found. Please retype, or sign up if you still haven\'t.","Checking activation...":"Checking activation..."}')}});
//# sourceMappingURL=app.60d7563f.js.map