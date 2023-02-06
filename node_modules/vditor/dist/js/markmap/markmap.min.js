// https://d3js.org v6.7.0 Copyright 2021 Mike Bostock
!function(t,n){"object"==typeof exports&&"undefined"!=typeof module?n(exports):"function"==typeof define&&define.amd?define(["exports"],n):n((t="undefined"!=typeof globalThis?globalThis:t||self).d3=t.d3||{})}(this,(function(t){"use strict";function n(t,n){return t<n?-1:t>n?1:t>=n?0:NaN}function e(t){let e=t,r=t;function i(t,n,e,i){for(null==e&&(e=0),null==i&&(i=t.length);e<i;){const o=e+i>>>1;r(t[o],n)<0?e=o+1:i=o}return e}return 1===t.length&&(e=(n,e)=>t(n)-e,r=function(t){return(e,r)=>n(t(e),r)}(t)),{left:i,center:function(t,n,r,o){null==r&&(r=0),null==o&&(o=t.length);const a=i(t,n,r,o-1);return a>r&&e(t[a-1],n)>-e(t[a],n)?a-1:a},right:function(t,n,e,i){for(null==e&&(e=0),null==i&&(i=t.length);e<i;){const o=e+i>>>1;r(t[o],n)>0?i=o:e=o+1}return e}}}function r(t){return null===t?NaN:+t}const i=e(n),o=i.right,a=i.left,u=e(r).center;function c(t,n){let e=0;if(void 0===n)for(let n of t)null!=n&&(n=+n)>=n&&++e;else{let r=-1;for(let i of t)null!=(i=n(i,++r,t))&&(i=+i)>=i&&++e}return e}function f(t){return 0|t.length}function s(t){return!(t>0)}function l(t){return"object"!=typeof t||"length"in t?t:Array.from(t)}function h(t,n){let e,r=0,i=0,o=0;if(void 0===n)for(let n of t)null!=n&&(n=+n)>=n&&(e=n-i,i+=e/++r,o+=e*(n-i));else{let a=-1;for(let u of t)null!=(u=n(u,++a,t))&&(u=+u)>=u&&(e=u-i,i+=e/++r,o+=e*(u-i))}if(r>1)return o/(r-1)}function d(t,n){const e=h(t,n);return e?Math.sqrt(e):e}function p(t,n){let e,r;if(void 0===n)for(const n of t)null!=n&&(void 0===e?n>=n&&(e=r=n):(e>n&&(e=n),r<n&&(r=n)));else{let i=-1;for(let o of t)null!=(o=n(o,++i,t))&&(void 0===e?o>=o&&(e=r=o):(e>o&&(e=o),r<o&&(r=o)))}return[e,r]}class g{constructor(){this._partials=new Float64Array(32),this._n=0}add(t){const n=this._partials;let e=0;for(let r=0;r<this._n&&r<32;r++){const i=n[r],o=t+i,a=Math.abs(t)<Math.abs(i)?t-(o-i):i-(o-t);a&&(n[e++]=a),t=o}return n[e]=t,this._n=e+1,this}valueOf(){const t=this._partials;let n,e,r,i=this._n,o=0;if(i>0){for(o=t[--i];i>0&&(n=o,e=t[--i],o=n+e,r=e-(o-n),!r););i>0&&(r<0&&t[i-1]<0||r>0&&t[i-1]>0)&&(e=2*r,n=o+e,e==n-o&&(o=n))}return o}}class y extends Map{constructor(t,n=x){if(super(),Object.defineProperties(this,{_intern:{value:new Map},_key:{value:n}}),null!=t)for(const[n,e]of t)this.set(n,e)}get(t){return super.get(_(this,t))}has(t){return super.has(_(this,t))}set(t,n){return super.set(b(this,t),n)}delete(t){return super.delete(m(this,t))}}class v extends Set{constructor(t,n=x){if(super(),Object.defineProperties(this,{_intern:{value:new Map},_key:{value:n}}),null!=t)for(const n of t)this.add(n)}has(t){return super.has(_(this,t))}add(t){return super.add(b(this,t))}delete(t){return super.delete(m(this,t))}}function _({_intern:t,_key:n},e){const r=n(e);return t.has(r)?t.get(r):e}function b({_intern:t,_key:n},e){const r=n(e);return t.has(r)?t.get(r):(t.set(r,e),e)}function m({_intern:t,_key:n},e){const r=n(e);return t.has(r)&&(e=t.get(e),t.delete(r)),e}function x(t){return null!==t&&"object"==typeof t?t.valueOf():t}function w(t){return t}function M(t,...n){return S(t,w,w,n)}function A(t,n,...e){return S(t,w,n,e)}function T(t){if(1!==t.length)throw new Error("duplicate key");return t[0]}function S(t,n,e,r){return function t(i,o){if(o>=r.length)return e(i);const a=new y,u=r[o++];let c=-1;for(const t of i){const n=u(t,++c,i),e=a.get(n);e?e.push(t):a.set(n,[t])}for(const[n,e]of a)a.set(n,t(e,o));return n(a)}(t,0)}function E(t,n){return Array.from(n,(n=>t[n]))}function k(t,...e){if("function"!=typeof t[Symbol.iterator])throw new TypeError("values is not iterable");t=Array.from(t);let[r=n]=e;if(1===r.length||e.length>1){const i=Uint32Array.from(t,((t,n)=>n));return e.length>1?(e=e.map((n=>t.map(n))),i.sort(((t,r)=>{for(const i of e){const e=n(i[t],i[r]);if(e)return e}}))):(r=t.map(r),i.sort(((t,e)=>n(r[t],r[e])))),E(t,i)}return t.sort(r)}var N=Array.prototype.slice;function C(t){return function(){return t}}var P=Math.sqrt(50),z=Math.sqrt(10),D=Math.sqrt(2);function q(t,n,e){var r,i,o,a,u=-1;if(e=+e,(t=+t)===(n=+n)&&e>0)return[t];if((r=n<t)&&(i=t,t=n,n=i),0===(a=R(t,n,e))||!isFinite(a))return[];if(a>0){let e=Math.round(t/a),r=Math.round(n/a);for(e*a<t&&++e,r*a>n&&--r,o=new Array(i=r-e+1);++u<i;)o[u]=(e+u)*a}else{a=-a;let e=Math.round(t*a),r=Math.round(n*a);for(e/a<t&&++e,r/a>n&&--r,o=new Array(i=r-e+1);++u<i;)o[u]=(e+u)/a}return r&&o.reverse(),o}function R(t,n,e){var r=(n-t)/Math.max(0,e),i=Math.floor(Math.log(r)/Math.LN10),o=r/Math.pow(10,i);return i>=0?(o>=P?10:o>=z?5:o>=D?2:1)*Math.pow(10,i):-Math.pow(10,-i)/(o>=P?10:o>=z?5:o>=D?2:1)}function F(t,n,e){var r=Math.abs(n-t)/Math.max(0,e),i=Math.pow(10,Math.floor(Math.log(r)/Math.LN10)),o=r/i;return o>=P?i*=10:o>=z?i*=5:o>=D&&(i*=2),n<t?-i:i}function O(t,n,e){let r;for(;;){const i=R(t,n,e);if(i===r||0===i||!isFinite(i))return[t,n];i>0?(t=Math.floor(t/i)*i,n=Math.ceil(n/i)*i):i<0&&(t=Math.ceil(t*i)/i,n=Math.floor(n*i)/i),r=i}}function I(t){return Math.ceil(Math.log(c(t))/Math.LN2)+1}function U(){var t=w,n=p,e=I;function r(r){Array.isArray(r)||(r=Array.from(r));var i,a,u=r.length,c=new Array(u);for(i=0;i<u;++i)c[i]=t(r[i],i,r);var f=n(c),s=f[0],l=f[1],h=e(c,s,l);if(!Array.isArray(h)){const t=l,e=+h;if(n===p&&([s,l]=O(s,l,e)),(h=q(s,l,e))[h.length-1]>=l)if(t>=l&&n===p){const t=R(s,l,e);isFinite(t)&&(t>0?l=(Math.floor(l/t)+1)*t:t<0&&(l=(Math.ceil(l*-t)+1)/-t))}else h.pop()}for(var d=h.length;h[0]<=s;)h.shift(),--d;for(;h[d-1]>l;)h.pop(),--d;var g,y=new Array(d+1);for(i=0;i<=d;++i)(g=y[i]=[]).x0=i>0?h[i-1]:s,g.x1=i<d?h[i]:l;for(i=0;i<u;++i)s<=(a=c[i])&&a<=l&&y[o(h,a,0,d)].push(r[i]);return y}return r.value=function(n){return arguments.length?(t="function"==typeof n?n:C(n),r):t},r.domain=function(t){return arguments.length?(n="function"==typeof t?t:C([t[0],t[1]]),r):n},r.thresholds=function(t){return arguments.length?(e="function"==typeof t?t:Array.isArray(t)?C(N.call(t)):C(t),r):e},r}function B(t,n){let e;if(void 0===n)for(const n of t)null!=n&&(e<n||void 0===e&&n>=n)&&(e=n);else{let r=-1;for(let i of t)null!=(i=n(i,++r,t))&&(e<i||void 0===e&&i>=i)&&(e=i)}return e}function Y(t,n){let e;if(void 0===n)for(const n of t)null!=n&&(e>n||void 0===e&&n>=n)&&(e=n);else{let r=-1;for(let i of t)null!=(i=n(i,++r,t))&&(e>i||void 0===e&&i>=i)&&(e=i)}return e}function L(t,e,r=0,i=t.length-1,o=n){for(;i>r;){if(i-r>600){const n=i-r+1,a=e-r+1,u=Math.log(n),c=.5*Math.exp(2*u/3),f=.5*Math.sqrt(u*c*(n-c)/n)*(a-n/2<0?-1:1);L(t,e,Math.max(r,Math.floor(e-a*c/n+f)),Math.min(i,Math.floor(e+(n-a)*c/n+f)),o)}const n=t[e];let a=r,u=i;for(j(t,r,e),o(t[i],n)>0&&j(t,r,i);a<u;){for(j(t,a,u),++a,--u;o(t[a],n)<0;)++a;for(;o(t[u],n)>0;)--u}0===o(t[r],n)?j(t,r,u):(++u,j(t,u,i)),u<=e&&(r=u+1),e<=u&&(i=u-1)}return t}function j(t,n,e){const r=t[n];t[n]=t[e],t[e]=r}function H(t,n,e){if(r=(t=Float64Array.from(function*(t,n){if(void 0===n)for(let n of t)null!=n&&(n=+n)>=n&&(yield n);else{let e=-1;for(let r of t)null!=(r=n(r,++e,t))&&(r=+r)>=r&&(yield r)}}(t,e))).length){if((n=+n)<=0||r<2)return Y(t);if(n>=1)return B(t);var r,i=(r-1)*n,o=Math.floor(i),a=B(L(t,o).subarray(0,o+1));return a+(Y(t.subarray(o+1))-a)*(i-o)}}function X(t,n,e=r){if(i=t.length){if((n=+n)<=0||i<2)return+e(t[0],0,t);if(n>=1)return+e(t[i-1],i-1,t);var i,o=(i-1)*n,a=Math.floor(o),u=+e(t[a],a,t);return u+(+e(t[a+1],a+1,t)-u)*(o-a)}}function G(t,n){let e,r=-1,i=-1;if(void 0===n)for(const n of t)++i,null!=n&&(e<n||void 0===e&&n>=n)&&(e=n,r=i);else for(let o of t)null!=(o=n(o,++i,t))&&(e<o||void 0===e&&o>=o)&&(e=o,r=i);return r}function V(t){return Array.from(function*(t){for(const n of t)yield*n}(t))}function $(t,n){let e,r=-1,i=-1;if(void 0===n)for(const n of t)++i,null!=n&&(e>n||void 0===e&&n>=n)&&(e=n,r=i);else for(let o of t)null!=(o=n(o,++i,t))&&(e>o||void 0===e&&o>=o)&&(e=o,r=i);return r}function W(t,n){return[t,n]}function Z(t,n,e){t=+t,n=+n,e=(i=arguments.length)<2?(n=t,t=0,1):i<3?1:+e;for(var r=-1,i=0|Math.max(0,Math.ceil((n-t)/e)),o=new Array(i);++r<i;)o[r]=t+r*e;return o}function K(t,e=n){if(1===e.length)return $(t,e);let r,i=-1,o=-1;for(const n of t)++o,(i<0?0===e(n,n):e(n,r)<0)&&(r=n,i=o);return i}var Q=J(Math.random);function J(t){return function(n,e=0,r=n.length){let i=r-(e=+e);for(;i;){const r=t()*i--|0,o=n[i+e];n[i+e]=n[r+e],n[r+e]=o}return n}}function tt(t){if(!(i=t.length))return[];for(var n=-1,e=Y(t,nt),r=new Array(e);++n<e;)for(var i,o=-1,a=r[n]=new Array(i);++o<i;)a[o]=t[o][n];return r}function nt(t){return t.length}function et(t){return t instanceof Set?t:new Set(t)}function rt(t,n){const e=t[Symbol.iterator](),r=new Set;for(const t of n){if(r.has(t))continue;let n,i;for(;({value:n,done:i}=e.next());){if(i)return!1;if(r.add(n),Object.is(t,n))break}}return!0}var it=Array.prototype.slice;function ot(t){return t}var at=1e-6;function ut(t){return"translate("+t+",0)"}function ct(t){return"translate(0,"+t+")"}function ft(t){return n=>+t(n)}function st(t,n){return n=Math.max(0,t.bandwidth()-2*n)/2,t.round()&&(n=Math.round(n)),e=>+t(e)+n}function lt(){return!this.__axis}function ht(t,n){var e=[],r=null,i=null,o=6,a=6,u=3,c="undefined"!=typeof window&&window.devicePixelRatio>1?0:.5,f=1===t||4===t?-1:1,s=4===t||2===t?"x":"y",l=1===t||3===t?ut:ct;function h(h){var d=null==r?n.ticks?n.ticks.apply(n,e):n.domain():r,p=null==i?n.tickFormat?n.tickFormat.apply(n,e):ot:i,g=Math.max(o,0)+u,y=n.range(),v=+y[0]+c,_=+y[y.length-1]+c,b=(n.bandwidth?st:ft)(n.copy(),c),m=h.selection?h.selection():h,x=m.selectAll(".domain").data([null]),w=m.selectAll(".tick").data(d,n).order(),M=w.exit(),A=w.enter().append("g").attr("class","tick"),T=w.select("line"),S=w.select("text");x=x.merge(x.enter().insert("path",".tick").attr("class","domain").attr("stroke","currentColor")),w=w.merge(A),T=T.merge(A.append("line").attr("stroke","currentColor").attr(s+"2",f*o)),S=S.merge(A.append("text").attr("fill","currentColor").attr(s,f*g).attr("dy",1===t?"0em":3===t?"0.71em":"0.32em")),h!==m&&(x=x.transition(h),w=w.transition(h),T=T.transition(h),S=S.transition(h),M=M.transition(h).attr("opacity",at).attr("transform",(function(t){return isFinite(t=b(t))?l(t+c):this.getAttribute("transform")})),A.attr("opacity",at).attr("transform",(function(t){var n=this.parentNode.__axis;return l((n&&isFinite(n=n(t))?n:b(t))+c)}))),M.remove(),x.attr("d",4===t||2===t?a?"M"+f*a+","+v+"H"+c+"V"+_+"H"+f*a:"M"+c+","+v+"V"+_:a?"M"+v+","+f*a+"V"+c+"H"+_+"V"+f*a:"M"+v+","+c+"H"+_),w.attr("opacity",1).attr("transform",(function(t){return l(b(t)+c)})),T.attr(s+"2",f*o),S.attr(s,f*g).text(p),m.filter(lt).attr("fill","none").attr("font-size",10).attr("font-family","sans-serif").attr("text-anchor",2===t?"start":4===t?"end":"middle"),m.each((function(){this.__axis=b}))}return h.scale=function(t){return arguments.length?(n=t,h):n},h.ticks=function(){return e=it.call(arguments),h},h.tickArguments=function(t){return arguments.length?(e=null==t?[]:it.call(t),h):e.slice()},h.tickValues=function(t){return arguments.length?(r=null==t?null:it.call(t),h):r&&r.slice()},h.tickFormat=function(t){return arguments.length?(i=t,h):i},h.tickSize=function(t){return arguments.length?(o=a=+t,h):o},h.tickSizeInner=function(t){return arguments.length?(o=+t,h):o},h.tickSizeOuter=function(t){return arguments.length?(a=+t,h):a},h.tickPadding=function(t){return arguments.length?(u=+t,h):u},h.offset=function(t){return arguments.length?(c=+t,h):c},h}var dt={value:()=>{}};function pt(){for(var t,n=0,e=arguments.length,r={};n<e;++n){if(!(t=arguments[n]+"")||t in r||/[\s.]/.test(t))throw new Error("illegal type: "+t);r[t]=[]}return new gt(r)}function gt(t){this._=t}function yt(t,n){return t.trim().split(/^|\s+/).map((function(t){var e="",r=t.indexOf(".");if(r>=0&&(e=t.slice(r+1),t=t.slice(0,r)),t&&!n.hasOwnProperty(t))throw new Error("unknown type: "+t);return{type:t,name:e}}))}function vt(t,n){for(var e,r=0,i=t.length;r<i;++r)if((e=t[r]).name===n)return e.value}function _t(t,n,e){for(var r=0,i=t.length;r<i;++r)if(t[r].name===n){t[r]=dt,t=t.slice(0,r).concat(t.slice(r+1));break}return null!=e&&t.push({name:n,value:e}),t}gt.prototype=pt.prototype={constructor:gt,on:function(t,n){var e,r=this._,i=yt(t+"",r),o=-1,a=i.length;if(!(arguments.length<2)){if(null!=n&&"function"!=typeof n)throw new Error("invalid callback: "+n);for(;++o<a;)if(e=(t=i[o]).type)r[e]=_t(r[e],t.name,n);else if(null==n)for(e in r)r[e]=_t(r[e],t.name,null);return this}for(;++o<a;)if((e=(t=i[o]).type)&&(e=vt(r[e],t.name)))return e},copy:function(){var t={},n=this._;for(var e in n)t[e]=n[e].slice();return new gt(t)},call:function(t,n){if((e=arguments.length-2)>0)for(var e,r,i=new Array(e),o=0;o<e;++o)i[o]=arguments[o+2];if(!this._.hasOwnProperty(t))throw new Error("unknown type: "+t);for(o=0,e=(r=this._[t]).length;o<e;++o)r[o].value.apply(n,i)},apply:function(t,n,e){if(!this._.hasOwnProperty(t))throw new Error("unknown type: "+t);for(var r=this._[t],i=0,o=r.length;i<o;++i)r[i].value.apply(n,e)}};var bt="http://www.w3.org/1999/xhtml",mt={svg:"http://www.w3.org/2000/svg",xhtml:bt,xlink:"http://www.w3.org/1999/xlink",xml:"http://www.w3.org/XML/1998/namespace",xmlns:"http://www.w3.org/2000/xmlns/"};function xt(t){var n=t+="",e=n.indexOf(":");return e>=0&&"xmlns"!==(n=t.slice(0,e))&&(t=t.slice(e+1)),mt.hasOwnProperty(n)?{space:mt[n],local:t}:t}function wt(t){return function(){var n=this.ownerDocument,e=this.namespaceURI;return e===bt&&n.documentElement.namespaceURI===bt?n.createElement(t):n.createElementNS(e,t)}}function Mt(t){return function(){return this.ownerDocument.createElementNS(t.space,t.local)}}function At(t){var n=xt(t);return(n.local?Mt:wt)(n)}function Tt(){}function St(t){return null==t?Tt:function(){return this.querySelector(t)}}function Et(t){return"object"==typeof t&&"length"in t?t:Array.from(t)}function kt(){return[]}function Nt(t){return null==t?kt:function(){return this.querySelectorAll(t)}}function Ct(t){return function(){return this.matches(t)}}function Pt(t){return function(n){return n.matches(t)}}var zt=Array.prototype.find;function Dt(){return this.firstElementChild}var qt=Array.prototype.filter;function Rt(){return this.children}function Ft(t){return new Array(t.length)}function Ot(t,n){this.ownerDocument=t.ownerDocument,this.namespaceURI=t.namespaceURI,this._next=null,this._parent=t,this.__data__=n}function It(t){return function(){return t}}function Ut(t,n,e,r,i,o){for(var a,u=0,c=n.length,f=o.length;u<f;++u)(a=n[u])?(a.__data__=o[u],r[u]=a):e[u]=new Ot(t,o[u]);for(;u<c;++u)(a=n[u])&&(i[u]=a)}function Bt(t,n,e,r,i,o,a){var u,c,f,s=new Map,l=n.length,h=o.length,d=new Array(l);for(u=0;u<l;++u)(c=n[u])&&(d[u]=f=a.call(c,c.__data__,u,n)+"",s.has(f)?i[u]=c:s.set(f,c));for(u=0;u<h;++u)f=a.call(t,o[u],u,o)+"",(c=s.get(f))?(r[u]=c,c.__data__=o[u],s.delete(f)):e[u]=new Ot(t,o[u]);for(u=0;u<l;++u)(c=n[u])&&s.get(d[u])===c&&(i[u]=c)}function Yt(t){return t.__data__}function Lt(t,n){return t<n?-1:t>n?1:t>=n?0:NaN}function jt(t){return function(){this.removeAttribute(t)}}function Ht(t){return function(){this.removeAttributeNS(t.space,t.local)}}function Xt(t,n){return function(){this.setAttribute(t,n)}}function Gt(t,n){return function(){this.setAttributeNS(t.space,t.local,n)}}function Vt(t,n){return function(){var e=n.apply(this,arguments);null==e?this.removeAttribute(t):this.setAttribute(t,e)}}function $t(t,n){return function(){var e=n.apply(this,arguments);null==e?this.removeAttributeNS(t.space,t.local):this.setAttributeNS(t.space,t.local,e)}}function Wt(t){return t.ownerDocument&&t.ownerDocument.defaultView||t.document&&t||t.defaultView}function Zt(t){return function(){this.style.removeProperty(t)}}function Kt(t,n,e){return function(){this.style.setProperty(t,n,e)}}function Qt(t,n,e){return function(){var r=n.apply(this,arguments);null==r?this.style.removeProperty(t):this.style.setProperty(t,r,e)}}function Jt(t,n){return t.style.getPropertyValue(n)||Wt(t).getComputedStyle(t,null).getPropertyValue(n)}function tn(t){return function(){delete this[t]}}function nn(t,n){return function(){this[t]=n}}function en(t,n){return function(){var e=n.apply(this,arguments);null==e?delete this[t]:this[t]=e}}function rn(t){return t.trim().split(/^|\s+/)}function on(t){return t.classList||new an(t)}function an(t){this._node=t,this._names=rn(t.getAttribute("class")||"")}function un(t,n){for(var e=on(t),r=-1,i=n.length;++r<i;)e.add(n[r])}function cn(t,n){for(var e=on(t),r=-1,i=n.length;++r<i;)e.remove(n[r])}function fn(t){return function(){un(this,t)}}function sn(t){return function(){cn(this,t)}}function ln(t,n){return function(){(n.apply(this,arguments)?un:cn)(this,t)}}function hn(){this.textContent=""}function dn(t){return function(){this.textContent=t}}function pn(t){return function(){var n=t.apply(this,arguments);this.textContent=null==n?"":n}}function gn(){this.innerHTML=""}function yn(t){return function(){this.innerHTML=t}}function vn(t){return function(){var n=t.apply(this,arguments);this.innerHTML=null==n?"":n}}function _n(){this.nextSibling&&this.parentNode.appendChild(this)}function bn(){this.previousSibling&&this.parentNode.insertBefore(this,this.parentNode.firstChild)}function mn(){return null}function xn(){var t=this.parentNode;t&&t.removeChild(this)}function wn(){var t=this.cloneNode(!1),n=this.parentNode;return n?n.insertBefore(t,this.nextSibling):t}function Mn(){var t=this.cloneNode(!0),n=this.parentNode;return n?n.insertBefore(t,this.nextSibling):t}function An(t){return t.trim().split(/^|\s+/).map((function(t){var n="",e=t.indexOf(".");return e>=0&&(n=t.slice(e+1),t=t.slice(0,e)),{type:t,name:n}}))}function Tn(t){return function(){var n=this.__on;if(n){for(var e,r=0,i=-1,o=n.length;r<o;++r)e=n[r],t.type&&e.type!==t.type||e.name!==t.name?n[++i]=e:this.removeEventListener(e.type,e.listener,e.options);++i?n.length=i:delete this.__on}}}function Sn(t,n,e){return function(){var r,i=this.__on,o=function(t){return function(n){t.call(this,n,this.__data__)}}(n);if(i)for(var a=0,u=i.length;a<u;++a)if((r=i[a]).type===t.type&&r.name===t.name)return this.removeEventListener(r.type,r.listener,r.options),this.addEventListener(r.type,r.listener=o,r.options=e),void(r.value=n);this.addEventListener(t.type,o,e),r={type:t.type,name:t.name,value:n,listener:o,options:e},i?i.push(r):this.__on=[r]}}function En(t,n,e){var r=Wt(t),i=r.CustomEvent;"function"==typeof i?i=new i(n,e):(i=r.document.createEvent("Event"),e?(i.initEvent(n,e.bubbles,e.cancelable),i.detail=e.detail):i.initEvent(n,!1,!1)),t.dispatchEvent(i)}function kn(t,n){return function(){return En(this,t,n)}}function Nn(t,n){return function(){return En(this,t,n.apply(this,arguments))}}Ot.prototype={constructor:Ot,appendChild:function(t){return this._parent.insertBefore(t,this._next)},insertBefore:function(t,n){return this._parent.insertBefore(t,n)},querySelector:function(t){return this._parent.querySelector(t)},querySelectorAll:function(t){return this._parent.querySelectorAll(t)}},an.prototype={add:function(t){this._names.indexOf(t)<0&&(this._names.push(t),this._node.setAttribute("class",this._names.join(" ")))},remove:function(t){var n=this._names.indexOf(t);n>=0&&(this._names.splice(n,1),this._node.setAttribute("class",this._names.join(" ")))},contains:function(t){return this._names.indexOf(t)>=0}};var Cn=[null];function Pn(t,n){this._groups=t,this._parents=n}function zn(){return new Pn([[document.documentElement]],Cn)}function Dn(t){return"string"==typeof t?new Pn([[document.querySelector(t)]],[document.documentElement]):new Pn([[t]],Cn)}Pn.prototype=zn.prototype={constructor:Pn,select:function(t){"function"!=typeof t&&(t=St(t));for(var n=this._groups,e=n.length,r=new Array(e),i=0;i<e;++i)for(var o,a,u=n[i],c=u.length,f=r[i]=new Array(c),s=0;s<c;++s)(o=u[s])&&(a=t.call(o,o.__data__,s,u))&&("__data__"in o&&(a.__data__=o.__data__),f[s]=a);return new Pn(r,this._parents)},selectAll:function(t){t="function"==typeof t?function(t){return function(){var n=t.apply(this,arguments);return null==n?[]:Et(n)}}(t):Nt(t);for(var n=this._groups,e=n.length,r=[],i=[],o=0;o<e;++o)for(var a,u=n[o],c=u.length,f=0;f<c;++f)(a=u[f])&&(r.push(t.call(a,a.__data__,f,u)),i.push(a));return new Pn(r,i)},selectChild:function(t){return this.select(null==t?Dt:function(t){return function(){return zt.call(this.children,t)}}("function"==typeof t?t:Pt(t)))},selectChildren:function(t){return this.selectAll(null==t?Rt:function(t){return function(){return qt.call(this.children,t)}}("function"==typeof t?t:Pt(t)))},filter:function(t){"function"!=typeof t&&(t=Ct(t));for(var n=this._groups,e=n.length,r=new Array(e),i=0;i<e;++i)for(var o,a=n[i],u=a.length,c=r[i]=[],f=0;f<u;++f)(o=a[f])&&t.call(o,o.__data__,f,a)&&c.push(o);return new Pn(r,this._parents)},data:function(t,n){if(!arguments.length)return Array.from(this,Yt);var e=n?Bt:Ut,r=this._parents,i=this._groups;"function"!=typeof t&&(t=It(t));for(var o=i.length,a=new Array(o),u=new Array(o),c=new Array(o),f=0;f<o;++f){var s=r[f],l=i[f],h=l.length,d=Et(t.call(s,s&&s.__data__,f,r)),p=d.length,g=u[f]=new Array(p),y=a[f]=new Array(p),v=c[f]=new Array(h);e(s,l,g,y,v,d,n);for(var _,b,m=0,x=0;m<p;++m)if(_=g[m]){for(m>=x&&(x=m+1);!(b=y[x])&&++x<p;);_._next=b||null}}return(a=new Pn(a,r))._enter=u,a._exit=c,a},enter:function(){return new Pn(this._enter||this._groups.map(Ft),this._parents)},exit:function(){return new Pn(this._exit||this._groups.map(Ft),this._parents)},join:function(t,n,e){var r=this.enter(),i=this,o=this.exit();return r="function"==typeof t?t(r):r.append(t+""),null!=n&&(i=n(i)),null==e?o.remove():e(o),r&&i?r.merge(i).order():i},merge:function(t){if(!(t instanceof Pn))throw new Error("invalid merge");for(var n=this._groups,e=t._groups,r=n.length,i=e.length,o=Math.min(r,i),a=new Array(r),u=0;u<o;++u)for(var c,f=n[u],s=e[u],l=f.length,h=a[u]=new Array(l),d=0;d<l;++d)(c=f[d]||s[d])&&(h[d]=c);for(;u<r;++u)a[u]=n[u];return new Pn(a,this._parents)},selection:function(){return this},order:function(){for(var t=this._groups,n=-1,e=t.length;++n<e;)for(var r,i=t[n],o=i.length-1,a=i[o];--o>=0;)(r=i[o])&&(a&&4^r.compareDocumentPosition(a)&&a.parentNode.insertBefore(r,a),a=r);return this},sort:function(t){function n(n,e){return n&&e?t(n.__data__,e.__data__):!n-!e}t||(t=Lt);for(var e=this._groups,r=e.length,i=new Array(r),o=0;o<r;++o){for(var a,u=e[o],c=u.length,f=i[o]=new Array(c),s=0;s<c;++s)(a=u[s])&&(f[s]=a);f.sort(n)}return new Pn(i,this._parents).order()},call:function(){var t=arguments[0];return arguments[0]=this,t.apply(null,arguments),this},nodes:function(){return Array.from(this)},node:function(){for(var t=this._groups,n=0,e=t.length;n<e;++n)for(var r=t[n],i=0,o=r.length;i<o;++i){var a=r[i];if(a)return a}return null},size:function(){let t=0;for(const n of this)++t;return t},empty:function(){return!this.node()},each:function(t){for(var n=this._groups,e=0,r=n.length;e<r;++e)for(var i,o=n[e],a=0,u=o.length;a<u;++a)(i=o[a])&&t.call(i,i.__data__,a,o);return this},attr:function(t,n){var e=xt(t);if(arguments.length<2){var r=this.node();return e.local?r.getAttributeNS(e.space,e.local):r.getAttribute(e)}return this.each((null==n?e.local?Ht:jt:"function"==typeof n?e.local?$t:Vt:e.local?Gt:Xt)(e,n))},style:function(t,n,e){return arguments.length>1?this.each((null==n?Zt:"function"==typeof n?Qt:Kt)(t,n,null==e?"":e)):Jt(this.node(),t)},property:function(t,n){return arguments.length>1?this.each((null==n?tn:"function"==typeof n?en:nn)(t,n)):this.node()[t]},classed:function(t,n){var e=rn(t+"");if(arguments.length<2){for(var r=on(this.node()),i=-1,o=e.length;++i<o;)if(!r.contains(e[i]))return!1;return!0}return this.each(("function"==typeof n?ln:n?fn:sn)(e,n))},text:function(t){return arguments.length?this.each(null==t?hn:("function"==typeof t?pn:dn)(t)):this.node().textContent},html:function(t){return arguments.length?this.each(null==t?gn:("function"==typeof t?vn:yn)(t)):this.node().innerHTML},raise:function(){return this.each(_n)},lower:function(){return this.each(bn)},append:function(t){var n="function"==typeof t?t:At(t);return this.select((function(){return this.appendChild(n.apply(this,arguments))}))},insert:function(t,n){var e="function"==typeof t?t:At(t),r=null==n?mn:"function"==typeof n?n:St(n);return this.select((function(){return this.insertBefore(e.apply(this,arguments),r.apply(this,arguments)||null)}))},remove:function(){return this.each(xn)},clone:function(t){return this.select(t?Mn:wn)},datum:function(t){return arguments.length?this.property("__data__",t):this.node().__data__},on:function(t,n,e){var r,i,o=An(t+""),a=o.length;if(!(arguments.length<2)){for(u=n?Sn:Tn,r=0;r<a;++r)this.each(u(o[r],n,e));return this}var u=this.node().__on;if(u)for(var c,f=0,s=u.length;f<s;++f)for(r=0,c=u[f];r<a;++r)if((i=o[r]).type===c.type&&i.name===c.name)return c.value},dispatch:function(t,n){return this.each(("function"==typeof n?Nn:kn)(t,n))},[Symbol.iterator]:function*(){for(var t=this._groups,n=0,e=t.length;n<e;++n)for(var r,i=t[n],o=0,a=i.length;o<a;++o)(r=i[o])&&(yield r)}};var qn=0;function Rn(){return new Fn}function Fn(){this._="@"+(++qn).toString(36)}function On(t){let n;for(;n=t.sourceEvent;)t=n;return t}function In(t,n){if(t=On(t),void 0===n&&(n=t.currentTarget),n){var e=n.ownerSVGElement||n;if(e.createSVGPoint){var r=e.createSVGPoint();return r.x=t.clientX,r.y=t.clientY,[(r=r.matrixTransform(n.getScreenCTM().inverse())).x,r.y]}if(n.getBoundingClientRect){var i=n.getBoundingClientRect();return[t.clientX-i.left-n.clientLeft,t.clientY-i.top-n.clientTop]}}return[t.pageX,t.pageY]}function Un(t){t.stopImmediatePropagation()}function Bn(t){t.preventDefault(),t.stopImmediatePropagation()}function Yn(t){var n=t.document.documentElement,e=Dn(t).on("dragstart.drag",Bn,!0);"onselectstart"in n?e.on("selectstart.drag",Bn,!0):(n.__noselect=n.style.MozUserSelect,n.style.MozUserSelect="none")}function Ln(t,n){var e=t.document.documentElement,r=Dn(t).on("dragstart.drag",null);n&&(r.on("click.drag",Bn,!0),setTimeout((function(){r.on("click.drag",null)}),0)),"onselectstart"in e?r.on("selectstart.drag",null):(e.style.MozUserSelect=e.__noselect,delete e.__noselect)}Fn.prototype=Rn.prototype={constructor:Fn,get:function(t){for(var n=this._;!(n in t);)if(!(t=t.parentNode))return;return t[n]},set:function(t,n){return t[this._]=n},remove:function(t){return this._ in t&&delete t[this._]},toString:function(){return this._}};var jn=t=>()=>t;function Hn(t,{sourceEvent:n,subject:e,target:r,identifier:i,active:o,x:a,y:u,dx:c,dy:f,dispatch:s}){Object.defineProperties(this,{type:{value:t,enumerable:!0,configurable:!0},sourceEvent:{value:n,enumerable:!0,configurable:!0},subject:{value:e,enumerable:!0,configurable:!0},target:{value:r,enumerable:!0,configurable:!0},identifier:{value:i,enumerable:!0,configurable:!0},active:{value:o,enumerable:!0,configurable:!0},x:{value:a,enumerable:!0,configurable:!0},y:{value:u,enumerable:!0,configurable:!0},dx:{value:c,enumerable:!0,configurable:!0},dy:{value:f,enumerable:!0,configurable:!0},_:{value:s}})}function Xn(t){return!t.ctrlKey&&!t.button}function Gn(){return this.parentNode}function Vn(t,n){return null==n?{x:t.x,y:t.y}:n}function $n(){return navigator.maxTouchPoints||"ontouchstart"in this}function Wn(t,n,e){t.prototype=n.prototype=e,e.constructor=t}function Zn(t,n){var e=Object.create(t.prototype);for(var r in n)e[r]=n[r];return e}function Kn(){}Hn.prototype.on=function(){var t=this._.on.apply(this._,arguments);return t===this._?this:t};var Qn=.7,Jn=1/Qn,te="\\s*([+-]?\\d+)\\s*",ne="\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*",ee="\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)%\\s*",re=/^#([0-9a-f]{3,8})$/,ie=new RegExp("^rgb\\("+[te,te,te]+"\\)$"),oe=new RegExp("^rgb\\("+[ee,ee,ee]+"\\)$"),ae=new RegExp("^rgba\\("+[te,te,te,ne]+"\\)$"),ue=new RegExp("^rgba\\("+[ee,ee,ee,ne]+"\\)$"),ce=new RegExp("^hsl\\("+[ne,ee,ee]+"\\)$"),fe=new RegExp("^hsla\\("+[ne,ee,ee,ne]+"\\)$"),se={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074};function le(){return this.rgb().formatHex()}function he(){return this.rgb().formatRgb()}function de(t){var n,e;return t=(t+"").trim().toLowerCase(),(n=re.exec(t))?(e=n[1].length,n=parseInt(n[1],16),6===e?pe(n):3===e?new _e(n>>8&15|n>>4&240,n>>4&15|240&n,(15&n)<<4|15&n,1):8===e?ge(n>>24&255,n>>16&255,n>>8&255,(255&n)/255):4===e?ge(n>>12&15|n>>8&240,n>>8&15|n>>4&240,n>>4&15|240&n,((15&n)<<4|15&n)/255):null):(n=ie.exec(t))?new _e(n[1],n[2],n[3],1):(n=oe.exec(t))?new _e(255*n[1]/100,255*n[2]/100,255*n[3]/100,1):(n=ae.exec(t))?ge(n[1],n[2],n[3],n[4]):(n=ue.exec(t))?ge(255*n[1]/100,255*n[2]/100,255*n[3]/100,n[4]):(n=ce.exec(t))?we(n[1],n[2]/100,n[3]/100,1):(n=fe.exec(t))?we(n[1],n[2]/100,n[3]/100,n[4]):se.hasOwnProperty(t)?pe(se[t]):"transparent"===t?new _e(NaN,NaN,NaN,0):null}function pe(t){return new _e(t>>16&255,t>>8&255,255&t,1)}function ge(t,n,e,r){return r<=0&&(t=n=e=NaN),new _e(t,n,e,r)}function ye(t){return t instanceof Kn||(t=de(t)),t?new _e((t=t.rgb()).r,t.g,t.b,t.opacity):new _e}function ve(t,n,e,r){return 1===arguments.length?ye(t):new _e(t,n,e,null==r?1:r)}function _e(t,n,e,r){this.r=+t,this.g=+n,this.b=+e,this.opacity=+r}function be(){return"#"+xe(this.r)+xe(this.g)+xe(this.b)}function me(){var t=this.opacity;return(1===(t=isNaN(t)?1:Math.max(0,Math.min(1,t)))?"rgb(":"rgba(")+Math.max(0,Math.min(255,Math.round(this.r)||0))+", "+Math.max(0,Math.min(255,Math.round(this.g)||0))+", "+Math.max(0,Math.min(255,Math.round(this.b)||0))+(1===t?")":", "+t+")")}function xe(t){return((t=Math.max(0,Math.min(255,Math.round(t)||0)))<16?"0":"")+t.toString(16)}function we(t,n,e,r){return r<=0?t=n=e=NaN:e<=0||e>=1?t=n=NaN:n<=0&&(t=NaN),new Te(t,n,e,r)}function Me(t){if(t instanceof Te)return new Te(t.h,t.s,t.l,t.opacity);if(t instanceof Kn||(t=de(t)),!t)return new Te;if(t instanceof Te)return t;var n=(t=t.rgb()).r/255,e=t.g/255,r=t.b/255,i=Math.min(n,e,r),o=Math.max(n,e,r),a=NaN,u=o-i,c=(o+i)/2;return u?(a=n===o?(e-r)/u+6*(e<r):e===o?(r-n)/u+2:(n-e)/u+4,u/=c<.5?o+i:2-o-i,a*=60):u=c>0&&c<1?0:a,new Te(a,u,c,t.opacity)}function Ae(t,n,e,r){return 1===arguments.length?Me(t):new Te(t,n,e,null==r?1:r)}function Te(t,n,e,r){this.h=+t,this.s=+n,this.l=+e,this.opacity=+r}function Se(t,n,e){return 255*(t<60?n+(e-n)*t/60:t<180?e:t<240?n+(e-n)*(240-t)/60:n)}Wn(Kn,de,{copy:function(t){return Object.assign(new this.constructor,this,t)},displayable:function(){return this.rgb().displayable()},hex:le,formatHex:le,formatHsl:function(){return Me(this).formatHsl()},formatRgb:he,toString:he}),Wn(_e,ve,Zn(Kn,{brighter:function(t){return t=null==t?Jn:Math.pow(Jn,t),new _e(this.r*t,this.g*t,this.b*t,this.opacity)},darker:function(t){return t=null==t?Qn:Math.pow(Qn,t),new _e(this.r*t,this.g*t,this.b*t,this.opacity)},rgb:function(){return this},displayable:function(){return-.5<=this.r&&this.r<255.5&&-.5<=this.g&&this.g<255.5&&-.5<=this.b&&this.b<255.5&&0<=this.opacity&&this.opacity<=1},hex:be,formatHex:be,formatRgb:me,toString:me})),Wn(Te,Ae,Zn(Kn,{brighter:function(t){return t=null==t?Jn:Math.pow(Jn,t),new Te(this.h,this.s,this.l*t,this.opacity)},darker:function(t){return t=null==t?Qn:Math.pow(Qn,t),new Te(this.h,this.s,this.l*t,this.opacity)},rgb:function(){var t=this.h%360+360*(this.h<0),n=isNaN(t)||isNaN(this.s)?0:this.s,e=this.l,r=e+(e<.5?e:1-e)*n,i=2*e-r;return new _e(Se(t>=240?t-240:t+120,i,r),Se(t,i,r),Se(t<120?t+240:t-120,i,r),this.opacity)},displayable:function(){return(0<=this.s&&this.s<=1||isNaN(this.s))&&0<=this.l&&this.l<=1&&0<=this.opacity&&this.opacity<=1},formatHsl:function(){var t=this.opacity;return(1===(t=isNaN(t)?1:Math.max(0,Math.min(1,t)))?"hsl(":"hsla(")+(this.h||0)+", "+100*(this.s||0)+"%, "+100*(this.l||0)+"%"+(1===t?")":", "+t+")")}}));const Ee=Math.PI/180,ke=180/Math.PI,Ne=.96422,Ce=.82521,Pe=4/29,ze=6/29,De=3*ze*ze;function qe(t){if(t instanceof Fe)return new Fe(t.l,t.a,t.b,t.opacity);if(t instanceof je)return He(t);t instanceof _e||(t=ye(t));var n,e,r=Be(t.r),i=Be(t.g),o=Be(t.b),a=Oe((.2225045*r+.7168786*i+.0606169*o)/1);return r===i&&i===o?n=e=a:(n=Oe((.4360747*r+.3850649*i+.1430804*o)/Ne),e=Oe((.0139322*r+.0971045*i+.7141733*o)/Ce)),new Fe(116*a-16,500*(n-a),200*(a-e),t.opacity)}function Re(t,n,e,r){return 1===arguments.length?qe(t):new Fe(t,n,e,null==r?1:r)}function Fe(t,n,e,r){this.l=+t,this.a=+n,this.b=+e,this.opacity=+r}function Oe(t){return t>.008856451679035631?Math.pow(t,1/3):t/De+Pe}function Ie(t){return t>ze?t*t*t:De*(t-Pe)}function Ue(t){return 255*(t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055)}function Be(t){return(t/=255)<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)}function Ye(t){if(t instanceof je)return new je(t.h,t.c,t.l,t.opacity);if(t instanceof Fe||(t=qe(t)),0===t.a&&0===t.b)return new je(NaN,0<t.l&&t.l<100?0:NaN,t.l,t.opacity);var n=Math.atan2(t.b,t.a)*ke;return new je(n<0?n+360:n,Math.sqrt(t.a*t.a+t.b*t.b),t.l,t.opacity)}function Le(t,n,e,r){return 1===arguments.length?Ye(t):new je(t,n,e,null==r?1:r)}function je(t,n,e,r){this.h=+t,this.c=+n,this.l=+e,this.opacity=+r}function He(t){if(isNaN(t.h))return new Fe(t.l,0,0,t.opacity);var n=t.h*Ee;return new Fe(t.l,Math.cos(n)*t.c,Math.sin(n)*t.c,t.opacity)}Wn(Fe,Re,Zn(Kn,{brighter:function(t){return new Fe(this.l+18*(null==t?1:t),this.a,this.b,this.opacity)},darker:function(t){return new Fe(this.l-18*(null==t?1:t),this.a,this.b,this.opacity)},rgb:function(){var t=(this.l+16)/116,n=isNaN(this.a)?t:t+this.a/500,e=isNaN(this.b)?t:t-this.b/200;return new _e(Ue(3.1338561*(n=Ne*Ie(n))-1.6168667*(t=1*Ie(t))-.4906146*(e=Ce*Ie(e))),Ue(-.9787684*n+1.9161415*t+.033454*e),Ue(.0719453*n-.2289914*t+1.4052427*e),this.opacity)}})),Wn(je,Le,Zn(Kn,{brighter:function(t){return new je(this.h,this.c,this.l+18*(null==t?1:t),this.opacity)},darker:function(t){return new je(this.h,this.c,this.l-18*(null==t?1:t),this.opacity)},rgb:function(){return He(this).rgb()}}));var Xe=-.14861,Ge=1.78277,Ve=-.29227,$e=-.90649,We=1.97294,Ze=We*$e,Ke=We*Ge,Qe=Ge*Ve-$e*Xe;function Je(t){if(t instanceof nr)return new nr(t.h,t.s,t.l,t.opacity);t instanceof _e||(t=ye(t));var n=t.r/255,e=t.g/255,r=t.b/255,i=(Qe*r+Ze*n-Ke*e)/(Qe+Ze-Ke),o=r-i,a=(We*(e-i)-Ve*o)/$e,u=Math.sqrt(a*a+o*o)/(We*i*(1-i)),c=u?Math.atan2(a,o)*ke-120:NaN;return new nr(c<0?c+360:c,u,i,t.opacity)}function tr(t,n,e,r){return 1===arguments.length?Je(t):new nr(t,n,e,null==r?1:r)}function nr(t,n,e,r){this.h=+t,this.s=+n,this.l=+e,this.opacity=+r}function er(t,n,e,r,i){var o=t*t,a=o*t;return((1-3*t+3*o-a)*n+(4-6*o+3*a)*e+(1+3*t+3*o-3*a)*r+a*i)/6}function rr(t){var n=t.length-1;return function(e){var r=e<=0?e=0:e>=1?(e=1,n-1):Math.floor(e*n),i=t[r],o=t[r+1],a=r>0?t[r-1]:2*i-o,u=r<n-1?t[r+2]:2*o-i;return er((e-r/n)*n,a,i,o,u)}}function ir(t){var n=t.length;return function(e){var r=Math.floor(((e%=1)<0?++e:e)*n),i=t[(r+n-1)%n],o=t[r%n],a=t[(r+1)%n],u=t[(r+2)%n];return er((e-r/n)*n,i,o,a,u)}}Wn(nr,tr,Zn(Kn,{brighter:function(t){return t=null==t?Jn:Math.pow(Jn,t),new nr(this.h,this.s,this.l*t,this.opacity)},darker:function(t){return t=null==t?Qn:Math.pow(Qn,t),new nr(this.h,this.s,this.l*t,this.opacity)},rgb:function(){var t=isNaN(this.h)?0:(this.h+120)*Ee,n=+this.l,e=isNaN(this.s)?0:this.s*n*(1-n),r=Math.cos(t),i=Math.sin(t);return new _e(255*(n+e*(Xe*r+Ge*i)),255*(n+e*(Ve*r+$e*i)),255*(n+e*(We*r)),this.opacity)}}));var or=t=>()=>t;function ar(t,n){return function(e){return t+e*n}}function ur(t,n){var e=n-t;return e?ar(t,e>180||e<-180?e-360*Math.round(e/360):e):or(isNaN(t)?n:t)}function cr(t){return 1==(t=+t)?fr:function(n,e){return e-n?function(t,n,e){return t=Math.pow(t,e),n=Math.pow(n,e)-t,e=1/e,function(r){return Math.pow(t+r*n,e)}}(n,e,t):or(isNaN(n)?e:n)}}function fr(t,n){var e=n-t;return e?ar(t,e):or(isNaN(t)?n:t)}var sr=function t(n){var e=cr(n);function r(t,n){var r=e((t=ve(t)).r,(n=ve(n)).r),i=e(t.g,n.g),o=e(t.b,n.b),a=fr(t.opacity,n.opacity);return function(n){return t.r=r(n),t.g=i(n),t.b=o(n),t.opacity=a(n),t+""}}return r.gamma=t,r}(1);function lr(t){return function(n){var e,r,i=n.length,o=new Array(i),a=new Array(i),u=new Array(i);for(e=0;e<i;++e)r=ve(n[e]),o[e]=r.r||0,a[e]=r.g||0,u[e]=r.b||0;return o=t(o),a=t(a),u=t(u),r.opacity=1,function(t){return r.r=o(t),r.g=a(t),r.b=u(t),r+""}}}var hr=lr(rr),dr=lr(ir);function pr(t,n){n||(n=[]);var e,r=t?Math.min(n.length,t.length):0,i=n.slice();return function(o){for(e=0;e<r;++e)i[e]=t[e]*(1-o)+n[e]*o;return i}}function gr(t){return ArrayBuffer.isView(t)&&!(t instanceof DataView)}function yr(t,n){var e,r=n?n.length:0,i=t?Math.min(r,t.length):0,o=new Array(i),a=new Array(r);for(e=0;e<i;++e)o[e]=Mr(t[e],n[e]);for(;e<r;++e)a[e]=n[e];return function(t){for(e=0;e<i;++e)a[e]=o[e](t);return a}}function vr(t,n){var e=new Date;return t=+t,n=+n,function(r){return e.setTime(t*(1-r)+n*r),e}}function _r(t,n){return t=+t,n=+n,function(e){return t*(1-e)+n*e}}function br(t,n){var e,r={},i={};for(e in null!==t&&"object"==typeof t||(t={}),null!==n&&"object"==typeof n||(n={}),n)e in t?r[e]=Mr(t[e],n[e]):i[e]=n[e];return function(t){for(e in r)i[e]=r[e](t);return i}}var mr=/[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,xr=new RegExp(mr.source,"g");function wr(t,n){var e,r,i,o=mr.lastIndex=xr.lastIndex=0,a=-1,u=[],c=[];for(t+="",n+="";(e=mr.exec(t))&&(r=xr.exec(n));)(i=r.index)>o&&(i=n.slice(o,i),u[a]?u[a]+=i:u[++a]=i),(e=e[0])===(r=r[0])?u[a]?u[a]+=r:u[++a]=r:(u[++a]=null,c.push({i:a,x:_r(e,r)})),o=xr.lastIndex;return o<n.length&&(i=n.slice(o),u[a]?u[a]+=i:u[++a]=i),u.length<2?c[0]?function(t){return function(n){return t(n)+""}}(c[0].x):function(t){return function(){return t}}(n):(n=c.length,function(t){for(var e,r=0;r<n;++r)u[(e=c[r]).i]=e.x(t);return u.join("")})}function Mr(t,n){var e,r=typeof n;return null==n||"boolean"===r?or(n):("number"===r?_r:"string"===r?(e=de(n))?(n=e,sr):wr:n instanceof de?sr:n instanceof Date?vr:gr(n)?pr:Array.isArray(n)?yr:"function"!=typeof n.valueOf&&"function"!=typeof n.toString||isNaN(n)?br:_r)(t,n)}function Ar(t,n){return t=+t,n=+n,function(e){return Math.round(t*(1-e)+n*e)}}var Tr,Sr=180/Math.PI,Er={translateX:0,translateY:0,rotate:0,skewX:0,scaleX:1,scaleY:1};function kr(t,n,e,r,i,o){var a,u,c;return(a=Math.sqrt(t*t+n*n))&&(t/=a,n/=a),(c=t*e+n*r)&&(e-=t*c,r-=n*c),(u=Math.sqrt(e*e+r*r))&&(e/=u,r/=u,c/=u),t*r<n*e&&(t=-t,n=-n,c=-c,a=-a),{translateX:i,translateY:o,rotate:Math.atan2(n,t)*Sr,skewX:Math.atan(c)*Sr,scaleX:a,scaleY:u}}function Nr(t,n,e,r){function i(t){return t.length?t.pop()+" ":""}return function(o,a){var u=[],c=[];return o=t(o),a=t(a),function(t,r,i,o,a,u){if(t!==i||r!==o){var c=a.push("translate(",null,n,null,e);u.push({i:c-4,x:_r(t,i)},{i:c-2,x:_r(r,o)})}else(i||o)&&a.push("translate("+i+n+o+e)}(o.translateX,o.translateY,a.translateX,a.translateY,u,c),function(t,n,e,o){t!==n?(t-n>180?n+=360:n-t>180&&(t+=360),o.push({i:e.push(i(e)+"rotate(",null,r)-2,x:_r(t,n)})):n&&e.push(i(e)+"rotate("+n+r)}(o.rotate,a.rotate,u,c),function(t,n,e,o){t!==n?o.push({i:e.push(i(e)+"skewX(",null,r)-2,x:_r(t,n)}):n&&e.push(i(e)+"skewX("+n+r)}(o.skewX,a.skewX,u,c),function(t,n,e,r,o,a){if(t!==e||n!==r){var u=o.push(i(o)+"scale(",null,",",null,")");a.push({i:u-4,x:_r(t,e)},{i:u-2,x:_r(n,r)})}else 1===e&&1===r||o.push(i(o)+"scale("+e+","+r+")")}(o.scaleX,o.scaleY,a.scaleX,a.scaleY,u,c),o=a=null,function(t){for(var n,e=-1,r=c.length;++e<r;)u[(n=c[e]).i]=n.x(t);return u.join("")}}}var Cr=Nr((function(t){const n=new("function"==typeof DOMMatrix?DOMMatrix:WebKitCSSMatrix)(t+"");return n.isIdentity?Er:kr(n.a,n.b,n.c,n.d,n.e,n.f)}),"px, ","px)","deg)"),Pr=Nr((function(t){return null==t?Er:(Tr||(Tr=document.createElementNS("http://www.w3.org/2000/svg","g")),Tr.setAttribute("transform",t),(t=Tr.transform.baseVal.consolidate())?kr((t=t.matrix).a,t.b,t.c,t.d,t.e,t.f):Er)}),", ",")",")");function zr(t){return((t=Math.exp(t))+1/t)/2}var Dr=function t(n,e,r){function i(t,i){var o,a,u=t[0],c=t[1],f=t[2],s=i[0],l=i[1],h=i[2],d=s-u,p=l-c,g=d*d+p*p;if(g<1e-12)a=Math.log(h/f)/n,o=function(t){return[u+t*d,c+t*p,f*Math.exp(n*t*a)]};else{var y=Math.sqrt(g),v=(h*h-f*f+r*g)/(2*f*e*y),_=(h*h-f*f-r*g)/(2*h*e*y),b=Math.log(Math.sqrt(v*v+1)-v),m=Math.log(Math.sqrt(_*_+1)-_);a=(m-b)/n,o=function(t){var r=t*a,i=zr(b),o=f/(e*y)*(i*function(t){return((t=Math.exp(2*t))-1)/(t+1)}(n*r+b)-function(t){return((t=Math.exp(t))-1/t)/2}(b));return[u+o*d,c+o*p,f*i/zr(n*r+b)]}}return o.duration=1e3*a*n/Math.SQRT2,o}return i.rho=function(n){var e=Math.max(.001,+n),r=e*e;return t(e,r,r*r)},i}(Math.SQRT2,2,4);function qr(t){return function(n,e){var r=t((n=Ae(n)).h,(e=Ae(e)).h),i=fr(n.s,e.s),o=fr(n.l,e.l),a=fr(n.opacity,e.opacity);return function(t){return n.h=r(t),n.s=i(t),n.l=o(t),n.opacity=a(t),n+""}}}var Rr=qr(ur),Fr=qr(fr);function Or(t){return function(n,e){var r=t((n=Le(n)).h,(e=Le(e)).h),i=fr(n.c,e.c),o=fr(n.l,e.l),a=fr(n.opacity,e.opacity);return function(t){return n.h=r(t),n.c=i(t),n.l=o(t),n.opacity=a(t),n+""}}}var Ir=Or(ur),Ur=Or(fr);function Br(t){return function n(e){function r(n,r){var i=t((n=tr(n)).h,(r=tr(r)).h),o=fr(n.s,r.s),a=fr(n.l,r.l),u=fr(n.opacity,r.opacity);return function(t){return n.h=i(t),n.s=o(t),n.l=a(Math.pow(t,e)),n.opacity=u(t),n+""}}return e=+e,r.gamma=n,r}(1)}var Yr=Br(ur),Lr=Br(fr);function jr(t,n){void 0===n&&(n=t,t=Mr);for(var e=0,r=n.length-1,i=n[0],o=new Array(r<0?0:r);e<r;)o[e]=t(i,i=n[++e]);return function(t){var n=Math.max(0,Math.min(r-1,Math.floor(t*=r)));return o[n](t-n)}}var Hr,Xr,Gr=0,Vr=0,$r=0,Wr=0,Zr=0,Kr=0,Qr="object"==typeof performance&&performance.now?performance:Date,Jr="object"==typeof window&&window.requestAnimationFrame?window.requestAnimationFrame.bind(window):function(t){setTimeout(t,17)};function ti(){return Zr||(Jr(ni),Zr=Qr.now()+Kr)}function ni(){Zr=0}function ei(){this._call=this._time=this._next=null}function ri(t,n,e){var r=new ei;return r.restart(t,n,e),r}function ii(){ti(),++Gr;for(var t,n=Hr;n;)(t=Zr-n._time)>=0&&n._call.call(null,t),n=n._next;--Gr}function oi(){Zr=(Wr=Qr.now())+Kr,Gr=Vr=0;try{ii()}finally{Gr=0,function(){var t,n,e=Hr,r=1/0;for(;e;)e._call?(r>e._time&&(r=e._time),t=e,e=e._next):(n=e._next,e._next=null,e=t?t._next=n:Hr=n);Xr=t,ui(r)}(),Zr=0}}function ai(){var t=Qr.now(),n=t-Wr;n>1e3&&(Kr-=n,Wr=t)}function ui(t){Gr||(Vr&&(Vr=clearTimeout(Vr)),t-Zr>24?(t<1/0&&(Vr=setTimeout(oi,t-Qr.now()-Kr)),$r&&($r=clearInterval($r))):($r||(Wr=Qr.now(),$r=setInterval(ai,1e3)),Gr=1,Jr(oi)))}function ci(t,n,e){var r=new ei;return n=null==n?0:+n,r.restart((e=>{r.stop(),t(e+n)}),n,e),r}ei.prototype=ri.prototype={constructor:ei,restart:function(t,n,e){if("function"!=typeof t)throw new TypeError("callback is not a function");e=(null==e?ti():+e)+(null==n?0:+n),this._next||Xr===this||(Xr?Xr._next=this:Hr=this,Xr=this),this._call=t,this._time=e,ui()},stop:function(){this._call&&(this._call=null,this._time=1/0,ui())}};var fi=pt("start","end","cancel","interrupt"),si=[];function li(t,n,e,r,i,o){var a=t.__transition;if(a){if(e in a)return}else t.__transition={};!function(t,n,e){var r,i=t.__transition;function o(t){e.state=1,e.timer.restart(a,e.delay,e.time),e.delay<=t&&a(t-e.delay)}function a(o){var f,s,l,h;if(1!==e.state)return c();for(f in i)if((h=i[f]).name===e.name){if(3===h.state)return ci(a);4===h.state?(h.state=6,h.timer.stop(),h.on.call("interrupt",t,t.__data__,h.index,h.group),delete i[f]):+f<n&&(h.state=6,h.timer.stop(),h.on.call("cancel",t,t.__data__,h.index,h.group),delete i[f])}if(ci((function(){3===e.state&&(e.state=4,e.timer.restart(u,e.delay,e.time),u(o))})),e.state=2,e.on.call("start",t,t.__data__,e.index,e.group),2===e.state){for(e.state=3,r=new Array(l=e.tween.length),f=0,s=-1;f<l;++f)(h=e.tween[f].value.call(t,t.__data__,e.index,e.group))&&(r[++s]=h);r.length=s+1}}function u(n){for(var i=n<e.duration?e.ease.call(null,n/e.duration):(e.timer.restart(c),e.state=5,1),o=-1,a=r.length;++o<a;)r[o].call(t,i);5===e.state&&(e.on.call("end",t,t.__data__,e.index,e.group),c())}function c(){for(var r in e.state=6,e.timer.stop(),delete i[n],i)return;delete t.__transition}i[n]=e,e.timer=ri(o,0,e.time)}(t,e,{name:n,index:r,group:i,on:fi,tween:si,time:o.time,delay:o.delay,duration:o.duration,ease:o.ease,timer:null,state:0})}function hi(t,n){var e=pi(t,n);if(e.state>0)throw new Error("too late; already scheduled");return e}function di(t,n){var e=pi(t,n);if(e.state>3)throw new Error("too late; already running");return e}function pi(t,n){var e=t.__transition;if(!e||!(e=e[n]))throw new Error("transition not found");return e}function gi(t,n){var e,r,i,o=t.__transition,a=!0;if(o){for(i in n=null==n?null:n+"",o)(e=o[i]).name===n?(r=e.state>2&&e.state<5,e.state=6,e.timer.stop(),e.on.call(r?"interrupt":"cancel",t,t.__data__,e.index,e.group),delete o[i]):a=!1;a&&delete t.__transition}}function yi(t,n){var e,r;return function(){var i=di(this,t),o=i.tween;if(o!==e)for(var a=0,u=(r=e=o).length;a<u;++a)if(r[a].name===n){(r=r.slice()).splice(a,1);break}i.tween=r}}function vi(t,n,e){var r,i;if("function"!=typeof e)throw new Error;return function(){var o=di(this,t),a=o.tween;if(a!==r){i=(r=a).slice();for(var u={name:n,value:e},c=0,f=i.length;c<f;++c)if(i[c].name===n){i[c]=u;break}c===f&&i.push(u)}o.tween=i}}function _i(t,n,e){var r=t._id;return t.each((function(){var t=di(this,r);(t.value||(t.value={}))[n]=e.apply(this,arguments)})),function(t){return pi(t,r).value[n]}}function bi(t,n){var e;return("number"==typeof n?_r:n instanceof de?sr:(e=de(n))?(n=e,sr):wr)(t,n)}function mi(t){return function(){this.removeAttribute(t)}}function xi(t){return function(){this.removeAttributeNS(t.space,t.local)}}function wi(t,n,e){var r,i,o=e+"";return function(){var a=this.getAttribute(t);return a===o?null:a===r?i:i=n(r=a,e)}}function Mi(t,n,e){var r,i,o=e+"";return function(){var a=this.getAttributeNS(t.space,t.local);return a===o?null:a===r?i:i=n(r=a,e)}}function Ai(t,n,e){var r,i,o;return function(){var a,u,c=e(this);if(null!=c)return(a=this.getAttribute(t))===(u=c+"")?null:a===r&&u===i?o:(i=u,o=n(r=a,c));this.removeAttribute(t)}}function Ti(t,n,e){var r,i,o;return function(){var a,u,c=e(this);if(null!=c)return(a=this.getAttributeNS(t.space,t.local))===(u=c+"")?null:a===r&&u===i?o:(i=u,o=n(r=a,c));this.removeAttributeNS(t.space,t.local)}}function Si(t,n){return function(e){this.setAttribute(t,n.call(this,e))}}function Ei(t,n){return function(e){this.setAttributeNS(t.space,t.local,n.call(this,e))}}function ki(t,n){var e,r;function i(){var i=n.apply(this,arguments);return i!==r&&(e=(r=i)&&Ei(t,i)),e}return i._value=n,i}function Ni(t,n){var e,r;function i(){var i=n.apply(this,arguments);return i!==r&&(e=(r=i)&&Si(t,i)),e}return i._value=n,i}function Ci(t,n){return function(){hi(this,t).delay=+n.apply(this,arguments)}}function Pi(t,n){return n=+n,function(){hi(this,t).delay=n}}function zi(t,n){return function(){di(this,t).duration=+n.apply(this,arguments)}}function Di(t,n){return n=+n,function(){di(this,t).duration=n}}function qi(t,n){if("function"!=typeof n)throw new Error;return function(){di(this,t).ease=n}}function Ri(t,n,e){var r,i,o=function(t){return(t+"").trim().split(/^|\s+/).every((function(t){var n=t.indexOf(".");return n>=0&&(t=t.slice(0,n)),!t||"start"===t}))}(n)?hi:di;return function(){var a=o(this,t),u=a.on;u!==r&&(i=(r=u).copy()).on(n,e),a.on=i}}var Fi=zn.prototype.constructor;function Oi(t){return function(){this.style.removeProperty(t)}}function Ii(t,n,e){return function(r){this.style.setProperty(t,n.call(this,r),e)}}function Ui(t,n,e){var r,i;function o(){var o=n.apply(this,arguments);return o!==i&&(r=(i=o)&&Ii(t,o,e)),r}return o._value=n,o}function Bi(t){return function(n){this.textContent=t.call(this,n)}}function Yi(t){var n,e;function r(){var r=t.apply(this,arguments);return r!==e&&(n=(e=r)&&Bi(r)),n}return r._value=t,r}var Li=0;function ji(t,n,e,r){this._groups=t,this._parents=n,this._name=e,this._id=r}function Hi(t){return zn().transition(t)}function Xi(){return++Li}var Gi=zn.prototype;ji.prototype=Hi.prototype={constructor:ji,select:function(t){var n=this._name,e=this._id;"function"!=typeof t&&(t=St(t));for(var r=this._groups,i=r.length,o=new Array(i),a=0;a<i;++a)for(var u,c,f=r[a],s=f.length,l=o[a]=new Array(s),h=0;h<s;++h)(u=f[h])&&(c=t.call(u,u.__data__,h,f))&&("__data__"in u&&(c.__data__=u.__data__),l[h]=c,li(l[h],n,e,h,l,pi(u,e)));return new ji(o,this._parents,n,e)},selectAll:function(t){var n=this._name,e=this._id;"function"!=typeof t&&(t=Nt(t));for(var r=this._groups,i=r.length,o=[],a=[],u=0;u<i;++u)for(var c,f=r[u],s=f.length,l=0;l<s;++l)if(c=f[l]){for(var h,d=t.call(c,c.__data__,l,f),p=pi(c,e),g=0,y=d.length;g<y;++g)(h=d[g])&&li(h,n,e,g,d,p);o.push(d),a.push(c)}return new ji(o,a,n,e)},filter:function(t){"function"!=typeof t&&(t=Ct(t));for(var n=this._groups,e=n.length,r=new Array(e),i=0;i<e;++i)for(var o,a=n[i],u=a.length,c=r[i]=[],f=0;f<u;++f)(o=a[f])&&t.call(o,o.__data__,f,a)&&c.push(o);return new ji(r,this._parents,this._name,this._id)},merge:function(t){if(t._id!==this._id)throw new Error;for(var n=this._groups,e=t._groups,r=n.length,i=e.length,o=Math.min(r,i),a=new Array(r),u=0;u<o;++u)for(var c,f=n[u],s=e[u],l=f.length,h=a[u]=new Array(l),d=0;d<l;++d)(c=f[d]||s[d])&&(h[d]=c);for(;u<r;++u)a[u]=n[u];return new ji(a,this._parents,this._name,this._id)},selection:function(){return new Fi(this._groups,this._parents)},transition:function(){for(var t=this._name,n=this._id,e=Xi(),r=this._groups,i=r.length,o=0;o<i;++o)for(var a,u=r[o],c=u.length,f=0;f<c;++f)if(a=u[f]){var s=pi(a,n);li(a,t,e,f,u,{time:s.time+s.delay+s.duration,delay:0,duration:s.duration,ease:s.ease})}return new ji(r,this._parents,t,e)},call:Gi.call,nodes:Gi.nodes,node:Gi.node,size:Gi.size,empty:Gi.empty,each:Gi.each,on:function(t,n){var e=this._id;return arguments.length<2?pi(this.node(),e).on.on(t):this.each(Ri(e,t,n))},attr:function(t,n){var e=xt(t),r="transform"===e?Pr:bi;return this.attrTween(t,"function"==typeof n?(e.local?Ti:Ai)(e,r,_i(this,"attr."+t,n)):null==n?(e.local?xi:mi)(e):(e.local?Mi:wi)(e,r,n))},attrTween:function(t,n){var e="attr."+t;if(arguments.length<2)return(e=this.tween(e))&&e._value;if(null==n)return this.tween(e,null);if("function"!=typeof n)throw new Error;var r=xt(t);return this.tween(e,(r.local?ki:Ni)(r,n))},style:function(t,n,e){var r="transform"==(t+="")?Cr:bi;return null==n?this.styleTween(t,function(t,n){var e,r,i;return function(){var o=Jt(this,t),a=(this.style.removeProperty(t),Jt(this,t));return o===a?null:o===e&&a===r?i:i=n(e=o,r=a)}}(t,r)).on("end.style."+t,Oi(t)):"function"==typeof n?this.styleTween(t,function(t,n,e){var r,i,o;return function(){var a=Jt(this,t),u=e(this),c=u+"";return null==u&&(this.style.removeProperty(t),c=u=Jt(this,t)),a===c?null:a===r&&c===i?o:(i=c,o=n(r=a,u))}}(t,r,_i(this,"style."+t,n))).each(function(t,n){var e,r,i,o,a="style."+n,u="end."+a;return function(){var c=di(this,t),f=c.on,s=null==c.value[a]?o||(o=Oi(n)):void 0;f===e&&i===s||(r=(e=f).copy()).on(u,i=s),c.on=r}}(this._id,t)):this.styleTween(t,function(t,n,e){var r,i,o=e+"";return function(){var a=Jt(this,t);return a===o?null:a===r?i:i=n(r=a,e)}}(t,r,n),e).on("end.style."+t,null)},styleTween:function(t,n,e){var r="style."+(t+="");if(arguments.length<2)return(r=this.tween(r))&&r._value;if(null==n)return this.tween(r,null);if("function"!=typeof n)throw new Error;return this.tween(r,Ui(t,n,null==e?"":e))},text:function(t){return this.tween("text","function"==typeof t?function(t){return function(){var n=t(this);this.textContent=null==n?"":n}}(_i(this,"text",t)):function(t){return function(){this.textContent=t}}(null==t?"":t+""))},textTween:function(t){var n="text";if(arguments.length<1)return(n=this.tween(n))&&n._value;if(null==t)return this.tween(n,null);if("function"!=typeof t)throw new Error;return this.tween(n,Yi(t))},remove:function(){return this.on("end.remove",function(t){return function(){var n=this.parentNode;for(var e in this.__transition)if(+e!==t)return;n&&n.removeChild(this)}}(this._id))},tween:function(t,n){var e=this._id;if(t+="",arguments.length<2){for(var r,i=pi(this.node(),e).tween,o=0,a=i.length;o<a;++o)if((r=i[o]).name===t)return r.value;return null}return this.each((null==n?yi:vi)(e,t,n))},delay:function(t){var n=this._id;return arguments.length?this.each(("function"==typeof t?Ci:Pi)(n,t)):pi(this.node(),n).delay},duration:function(t){var n=this._id;return arguments.length?this.each(("function"==typeof t?zi:Di)(n,t)):pi(this.node(),n).duration},ease:function(t){var n=this._id;return arguments.length?this.each(qi(n,t)):pi(this.node(),n).ease},easeVarying:function(t){if("function"!=typeof t)throw new Error;return this.each(function(t,n){return function(){var e=n.apply(this,arguments);if("function"!=typeof e)throw new Error;di(this,t).ease=e}}(this._id,t))},end:function(){var t,n,e=this,r=e._id,i=e.size();return new Promise((function(o,a){var u={value:a},c={value:function(){0==--i&&o()}};e.each((function(){var e=di(this,r),i=e.on;i!==t&&((n=(t=i).copy())._.cancel.push(u),n._.interrupt.push(u),n._.end.push(c)),e.on=n})),0===i&&o()}))},[Symbol.iterator]:Gi[Symbol.iterator]};function Vi(t){return((t*=2)<=1?t*t:--t*(2-t)+1)/2}function $i(t){return((t*=2)<=1?t*t*t:(t-=2)*t*t+2)/2}var Wi=function t(n){function e(t){return Math.pow(t,n)}return n=+n,e.exponent=t,e}(3),Zi=function t(n){function e(t){return 1-Math.pow(1-t,n)}return n=+n,e.exponent=t,e}(3),Ki=function t(n){function e(t){return((t*=2)<=1?Math.pow(t,n):2-Math.pow(2-t,n))/2}return n=+n,e.exponent=t,e}(3),Qi=Math.PI,Ji=Qi/2;function to(t){return(1-Math.cos(Qi*t))/2}function no(t){return 1.0009775171065494*(Math.pow(2,-10*t)-.0009765625)}function eo(t){return((t*=2)<=1?no(1-t):2-no(t-1))/2}function ro(t){return((t*=2)<=1?1-Math.sqrt(1-t*t):Math.sqrt(1-(t-=2)*t)+1)/2}var io=4/11,oo=7.5625;function ao(t){return(t=+t)<io?oo*t*t:t<.7272727272727273?oo*(t-=.5454545454545454)*t+.75:t<.9090909090909091?oo*(t-=.8181818181818182)*t+.9375:oo*(t-=.9545454545454546)*t+.984375}var uo=1.70158,co=function t(n){function e(t){return(t=+t)*t*(n*(t-1)+t)}return n=+n,e.overshoot=t,e}(uo),fo=function t(n){function e(t){return--t*t*((t+1)*n+t)+1}return n=+n,e.overshoot=t,e}(uo),so=function t(n){function e(t){return((t*=2)<1?t*t*((n+1)*t-n):(t-=2)*t*((n+1)*t+n)+2)/2}return n=+n,e.overshoot=t,e}(uo),lo=2*Math.PI,ho=function t(n,e){var r=Math.asin(1/(n=Math.max(1,n)))*(e/=lo);function i(t){return n*no(- --t)*Math.sin((r-t)/e)}return i.amplitude=function(n){return t(n,e*lo)},i.period=function(e){return t(n,e)},i}(1,.3),po=function t(n,e){var r=Math.asin(1/(n=Math.max(1,n)))*(e/=lo);function i(t){return 1-n*no(t=+t)*Math.sin((t+r)/e)}return i.amplitude=function(n){return t(n,e*lo)},i.period=function(e){return t(n,e)},i}(1,.3),go=function t(n,e){var r=Math.asin(1/(n=Math.max(1,n)))*(e/=lo);function i(t){return((t=2*t-1)<0?n*no(-t)*Math.sin((r-t)/e):2-n*no(t)*Math.sin((r+t)/e))/2}return i.amplitude=function(n){return t(n,e*lo)},i.period=function(e){return t(n,e)},i}(1,.3),yo={time:null,delay:0,duration:250,ease:$i};function vo(t,n){for(var e;!(e=t.__transition)||!(e=e[n]);)if(!(t=t.parentNode))throw new Error(`transition ${n} not found`);return e}zn.prototype.interrupt=function(t){return this.each((function(){gi(this,t)}))},zn.prototype.transition=function(t){var n,e;t instanceof ji?(n=t._id,t=t._name):(n=Xi(),(e=yo).time=ti(),t=null==t?null:t+"");for(var r=this._groups,i=r.length,o=0;o<i;++o)for(var a,u=r[o],c=u.length,f=0;f<c;++f)(a=u[f])&&li(a,t,n,f,u,e||vo(a,n));return new ji(r,this._parents,t,n)};var _o=[null];var bo=t=>()=>t;function mo(t,{sourceEvent:n,target:e,selection:r,mode:i,dispatch:o}){Object.defineProperties(this,{type:{value:t,enumerable:!0,configurable:!0},sourceEvent:{value:n,enumerable:!0,configurable:!0},target:{value:e,enumerable:!0,configurable:!0},selection:{value:r,enumerable:!0,configurable:!0},mode:{value:i,enumerable:!0,configurable:!0},_:{value:o}})}function xo(t){t.stopImmediatePropagation()}function wo(t){t.preventDefault(),t.stopImmediatePropagation()}var Mo={name:"drag"},Ao={name:"space"},To={name:"handle"},So={name:"center"};const{abs:Eo,max:ko,min:No}=Math;function Co(t){return[+t[0],+t[1]]}function Po(t){return[Co(t[0]),Co(t[1])]}var zo={name:"x",handles:["w","e"].map(Bo),input:function(t,n){return null==t?null:[[+t[0],n[0][1]],[+t[1],n[1][1]]]},output:function(t){return t&&[t[0][0],t[1][0]]}},Do={name:"y",handles:["n","s"].map(Bo),input:function(t,n){return null==t?null:[[n[0][0],+t[0]],[n[1][0],+t[1]]]},output:function(t){return t&&[t[0][1],t[1][1]]}},qo={name:"xy",handles:["n","w","e","s","nw","ne","sw","se"].map(Bo),input:function(t){return null==t?null:Po(t)},output:function(t){return t}},Ro={overlay:"crosshair",selection:"move",n:"ns-resize",e:"ew-resize",s:"ns-resize",w:"ew-resize",nw:"nwse-resize",ne:"nesw-resize",se:"nwse-resize",sw:"nesw-resize"},Fo={e:"w",w:"e",nw:"ne",ne:"nw",se:"sw",sw:"se"},Oo={n:"s",s:"n",nw:"sw",ne:"se",se:"ne",sw:"nw"},Io={overlay:1,selection:1,n:null,e:1,s:null,w:-1,nw:-1,ne:1,se:1,sw:-1},Uo={overlay:1,selection:1,n:-1,e:null,s:1,w:null,nw:-1,ne:-1,se:1,sw:1};function Bo(t){return{type:t}}function Yo(t){return!t.ctrlKey&&!t.button}function Lo(){var t=this.ownerSVGElement||this;return t.hasAttribute("viewBox")?[[(t=t.viewBox.baseVal).x,t.y],[t.x+t.width,t.y+t.height]]:[[0,0],[t.width.baseVal.value,t.height.baseVal.value]]}function jo(){return navigator.maxTouchPoints||"ontouchstart"in this}function Ho(t){for(;!t.__brush;)if(!(t=t.parentNode))return;return t.__brush}function Xo(t){return t[0][0]===t[1][0]||t[0][1]===t[1][1]}function Go(t){var n,e=Lo,r=Yo,i=jo,o=!0,a=pt("start","brush","end"),u=6;function c(n){var e=n.property("__brush",g).selectAll(".overlay").data([Bo("overlay")]);e.enter().append("rect").attr("class","overlay").attr("pointer-events","all").attr("cursor",Ro.overlay).merge(e).each((function(){var t=Ho(this).extent;Dn(this).attr("x",t[0][0]).attr("y",t[0][1]).attr("width",t[1][0]-t[0][0]).attr("height",t[1][1]-t[0][1])})),n.selectAll(".selection").data([Bo("selection")]).enter().append("rect").attr("class","selection").attr("cursor",Ro.selection).attr("fill","#777").attr("fill-opacity",.3).attr("stroke","#fff").attr("shape-rendering","crispEdges");var r=n.selectAll(".handle").data(t.handles,(function(t){return t.type}));r.exit().remove(),r.enter().append("rect").attr("class",(function(t){return"handle handle--"+t.type})).attr("cursor",(function(t){return Ro[t.type]})),n.each(f).attr("fill","none").attr("pointer-events","all").on("mousedown.brush",h).filter(i).on("touchstart.brush",h).on("touchmove.brush",d).on("touchend.brush touchcancel.brush",p).style("touch-action","none").style("-webkit-tap-highlight-color","rgba(0,0,0,0)")}function f(){var t=Dn(this),n=Ho(this).selection;n?(t.selectAll(".selection").style("display",null).attr("x",n[0][0]).attr("y",n[0][1]).attr("width",n[1][0]-n[0][0]).attr("height",n[1][1]-n[0][1]),t.selectAll(".handle").style("display",null).attr("x",(function(t){return"e"===t.type[t.type.length-1]?n[1][0]-u/2:n[0][0]-u/2})).attr("y",(function(t){return"s"===t.type[0]?n[1][1]-u/2:n[0][1]-u/2})).attr("width",(function(t){return"n"===t.type||"s"===t.type?n[1][0]-n[0][0]+u:u})).attr("height",(function(t){return"e"===t.type||"w"===t.type?n[1][1]-n[0][1]+u:u}))):t.selectAll(".selection,.handle").style("display","none").attr("x",null).attr("y",null).attr("width",null).attr("height",null)}function s(t,n,e){var r=t.__brush.emitter;return!r||e&&r.clean?new l(t,n,e):r}function l(t,n,e){this.that=t,this.args=n,this.state=t.__brush,this.active=0,this.clean=e}function h(e){if((!n||e.touches)&&r.apply(this,arguments)){var i,a,u,c,l,h,d,p,g,y,v,_=this,b=e.target.__data__.type,m="selection"===(o&&e.metaKey?b="overlay":b)?Mo:o&&e.altKey?So:To,x=t===Do?null:Io[b],w=t===zo?null:Uo[b],M=Ho(_),A=M.extent,T=M.selection,S=A[0][0],E=A[0][1],k=A[1][0],N=A[1][1],C=0,P=0,z=x&&w&&o&&e.shiftKey,D=Array.from(e.touches||[e],(t=>{const n=t.identifier;return(t=In(t,_)).point0=t.slice(),t.identifier=n,t}));if("overlay"===b){T&&(g=!0);const n=[D[0],D[1]||D[0]];M.selection=T=[[i=t===Do?S:No(n[0][0],n[1][0]),u=t===zo?E:No(n[0][1],n[1][1])],[l=t===Do?k:ko(n[0][0],n[1][0]),d=t===zo?N:ko(n[0][1],n[1][1])]],D.length>1&&U()}else i=T[0][0],u=T[0][1],l=T[1][0],d=T[1][1];a=i,c=u,h=l,p=d;var q=Dn(_).attr("pointer-events","none"),R=q.selectAll(".overlay").attr("cursor",Ro[b]);gi(_);var F=s(_,arguments,!0).beforestart();if(e.touches)F.moved=I,F.ended=B;else{var O=Dn(e.view).on("mousemove.brush",I,!0).on("mouseup.brush",B,!0);o&&O.on("keydown.brush",Y,!0).on("keyup.brush",L,!0),Yn(e.view)}f.call(_),F.start(e,m.name)}function I(t){for(const n of t.changedTouches||[t])for(const t of D)t.identifier===n.identifier&&(t.cur=In(n,_));if(z&&!y&&!v&&1===D.length){const t=D[0];Eo(t.cur[0]-t[0])>Eo(t.cur[1]-t[1])?v=!0:y=!0}for(const t of D)t.cur&&(t[0]=t.cur[0],t[1]=t.cur[1]);g=!0,wo(t),U(t)}function U(t){const n=D[0],e=n.point0;var r;switch(C=n[0]-e[0],P=n[1]-e[1],m){case Ao:case Mo:x&&(C=ko(S-i,No(k-l,C)),a=i+C,h=l+C),w&&(P=ko(E-u,No(N-d,P)),c=u+P,p=d+P);break;case To:D[1]?(x&&(a=ko(S,No(k,D[0][0])),h=ko(S,No(k,D[1][0])),x=1),w&&(c=ko(E,No(N,D[0][1])),p=ko(E,No(N,D[1][1])),w=1)):(x<0?(C=ko(S-i,No(k-i,C)),a=i+C,h=l):x>0&&(C=ko(S-l,No(k-l,C)),a=i,h=l+C),w<0?(P=ko(E-u,No(N-u,P)),c=u+P,p=d):w>0&&(P=ko(E-d,No(N-d,P)),c=u,p=d+P));break;case So:x&&(a=ko(S,No(k,i-C*x)),h=ko(S,No(k,l+C*x))),w&&(c=ko(E,No(N,u-P*w)),p=ko(E,No(N,d+P*w)))}h<a&&(x*=-1,r=i,i=l,l=r,r=a,a=h,h=r,b in Fo&&R.attr("cursor",Ro[b=Fo[b]])),p<c&&(w*=-1,r=u,u=d,d=r,r=c,c=p,p=r,b in Oo&&R.attr("cursor",Ro[b=Oo[b]])),M.selection&&(T=M.selection),y&&(a=T[0][0],h=T[1][0]),v&&(c=T[0][1],p=T[1][1]),T[0][0]===a&&T[0][1]===c&&T[1][0]===h&&T[1][1]===p||(M.selection=[[a,c],[h,p]],f.call(_),F.brush(t,m.name))}function B(t){if(xo(t),t.touches){if(t.touches.length)return;n&&clearTimeout(n),n=setTimeout((function(){n=null}),500)}else Ln(t.view,g),O.on("keydown.brush keyup.brush mousemove.brush mouseup.brush",null);q.attr("pointer-events","all"),R.attr("cursor",Ro.overlay),M.selection&&(T=M.selection),Xo(T)&&(M.selection=null,f.call(_)),F.end(t,m.name)}function Y(t){switch(t.keyCode){case 16:z=x&&w;break;case 18:m===To&&(x&&(l=h-C*x,i=a+C*x),w&&(d=p-P*w,u=c+P*w),m=So,U());break;case 32:m!==To&&m!==So||(x<0?l=h-C:x>0&&(i=a-C),w<0?d=p-P:w>0&&(u=c-P),m=Ao,R.attr("cursor",Ro.selection),U());break;default:return}wo(t)}function L(t){switch(t.keyCode){case 16:z&&(y=v=z=!1,U());break;case 18:m===So&&(x<0?l=h:x>0&&(i=a),w<0?d=p:w>0&&(u=c),m=To,U());break;case 32:m===Ao&&(t.altKey?(x&&(l=h-C*x,i=a+C*x),w&&(d=p-P*w,u=c+P*w),m=So):(x<0?l=h:x>0&&(i=a),w<0?d=p:w>0&&(u=c),m=To),R.attr("cursor",Ro[b]),U());break;default:return}wo(t)}}function d(t){s(this,arguments).moved(t)}function p(t){s(this,arguments).ended(t)}function g(){var n=this.__brush||{selection:null};return n.extent=Po(e.apply(this,arguments)),n.dim=t,n}return c.move=function(n,e){n.tween?n.on("start.brush",(function(t){s(this,arguments).beforestart().start(t)})).on("interrupt.brush end.brush",(function(t){s(this,arguments).end(t)})).tween("brush",(function(){var n=this,r=n.__brush,i=s(n,arguments),o=r.selection,a=t.input("function"==typeof e?e.apply(this,arguments):e,r.extent),u=Mr(o,a);function c(t){r.selection=1===t&&null===a?null:u(t),f.call(n),i.brush()}return null!==o&&null!==a?c:c(1)})):n.each((function(){var n=this,r=arguments,i=n.__brush,o=t.input("function"==typeof e?e.apply(n,r):e,i.extent),a=s(n,r).beforestart();gi(n),i.selection=null===o?null:o,f.call(n),a.start().brush().end()}))},c.clear=function(t){c.move(t,null)},l.prototype={beforestart:function(){return 1==++this.active&&(this.state.emitter=this,this.starting=!0),this},start:function(t,n){return this.starting?(this.starting=!1,this.emit("start",t,n)):this.emit("brush",t),this},brush:function(t,n){return this.emit("brush",t,n),this},end:function(t,n){return 0==--this.active&&(delete this.state.emitter,this.emit("end",t,n)),this},emit:function(n,e,r){var i=Dn(this.that).datum();a.call(n,this.that,new mo(n,{sourceEvent:e,target:c,selection:t.output(this.state.selection),mode:r,dispatch:a}),i)}},c.extent=function(t){return arguments.length?(e="function"==typeof t?t:bo(Po(t)),c):e},c.filter=function(t){return arguments.length?(r="function"==typeof t?t:bo(!!t),c):r},c.touchable=function(t){return arguments.length?(i="function"==typeof t?t:bo(!!t),c):i},c.handleSize=function(t){return arguments.length?(u=+t,c):u},c.keyModifiers=function(t){return arguments.length?(o=!!t,c):o},c.on=function(){var t=a.on.apply(a,arguments);return t===a?c:t},c}var Vo=Math.abs,$o=Math.cos,Wo=Math.sin,Zo=Math.PI,Ko=Zo/2,Qo=2*Zo,Jo=Math.max,ta=1e-12;function na(t,n){return Array.from({length:n-t},((n,e)=>t+e))}function ea(t){return function(n,e){return t(n.source.value+n.target.value,e.source.value+e.target.value)}}function ra(t,n){var e=0,r=null,i=null,o=null;function a(a){var u,c=a.length,f=new Array(c),s=na(0,c),l=new Array(c*c),h=new Array(c),d=0;a=Float64Array.from({length:c*c},n?(t,n)=>a[n%c][n/c|0]:(t,n)=>a[n/c|0][n%c]);for(let n=0;n<c;++n){let e=0;for(let r=0;r<c;++r)e+=a[n*c+r]+t*a[r*c+n];d+=f[n]=e}u=(d=Jo(0,Qo-e*c)/d)?e:Qo/c;{let n=0;r&&s.sort(((t,n)=>r(f[t],f[n])));for(const e of s){const r=n;if(t){const t=na(1+~c,c).filter((t=>t<0?a[~t*c+e]:a[e*c+t]));i&&t.sort(((t,n)=>i(t<0?-a[~t*c+e]:a[e*c+t],n<0?-a[~n*c+e]:a[e*c+n])));for(const r of t)if(r<0){(l[~r*c+e]||(l[~r*c+e]={source:null,target:null})).target={index:e,startAngle:n,endAngle:n+=a[~r*c+e]*d,value:a[~r*c+e]}}else{(l[e*c+r]||(l[e*c+r]={source:null,target:null})).source={index:e,startAngle:n,endAngle:n+=a[e*c+r]*d,value:a[e*c+r]}}h[e]={index:e,startAngle:r,endAngle:n,value:f[e]}}else{const t=na(0,c).filter((t=>a[e*c+t]||a[t*c+e]));i&&t.sort(((t,n)=>i(a[e*c+t],a[e*c+n])));for(const r of t){let t;if(e<r?(t=l[e*c+r]||(l[e*c+r]={source:null,target:null}),t.source={index:e,startAngle:n,endAngle:n+=a[e*c+r]*d,value:a[e*c+r]}):(t=l[r*c+e]||(l[r*c+e]={source:null,target:null}),t.target={index:e,startAngle:n,endAngle:n+=a[e*c+r]*d,value:a[e*c+r]},e===r&&(t.source=t.target)),t.source&&t.target&&t.source.value<t.target.value){const n=t.source;t.source=t.target,t.target=n}}h[e]={index:e,startAngle:r,endAngle:n,value:f[e]}}n+=u}}return(l=Object.values(l)).groups=h,o?l.sort(o):l}return a.padAngle=function(t){return arguments.length?(e=Jo(0,t),a):e},a.sortGroups=function(t){return arguments.length?(r=t,a):r},a.sortSubgroups=function(t){return arguments.length?(i=t,a):i},a.sortChords=function(t){return arguments.length?(null==t?o=null:(o=ea(t))._=t,a):o&&o._},a}const ia=Math.PI,oa=2*ia,aa=1e-6,ua=oa-aa;function ca(){this._x0=this._y0=this._x1=this._y1=null,this._=""}function fa(){return new ca}ca.prototype=fa.prototype={constructor:ca,moveTo:function(t,n){this._+="M"+(this._x0=this._x1=+t)+","+(this._y0=this._y1=+n)},closePath:function(){null!==this._x1&&(this._x1=this._x0,this._y1=this._y0,this._+="Z")},lineTo:function(t,n){this._+="L"+(this._x1=+t)+","+(this._y1=+n)},quadraticCurveTo:function(t,n,e,r){this._+="Q"+ +t+","+ +n+","+(this._x1=+e)+","+(this._y1=+r)},bezierCurveTo:function(t,n,e,r,i,o){this._+="C"+ +t+","+ +n+","+ +e+","+ +r+","+(this._x1=+i)+","+(this._y1=+o)},arcTo:function(t,n,e,r,i){t=+t,n=+n,e=+e,r=+r,i=+i;var o=this._x1,a=this._y1,u=e-t,c=r-n,f=o-t,s=a-n,l=f*f+s*s;if(i<0)throw new Error("negative radius: "+i);if(null===this._x1)this._+="M"+(this._x1=t)+","+(this._y1=n);else if(l>aa)if(Math.abs(s*u-c*f)>aa&&i){var h=e-o,d=r-a,p=u*u+c*c,g=h*h+d*d,y=Math.sqrt(p),v=Math.sqrt(l),_=i*Math.tan((ia-Math.acos((p+l-g)/(2*y*v)))/2),b=_/v,m=_/y;Math.abs(b-1)>aa&&(this._+="L"+(t+b*f)+","+(n+b*s)),this._+="A"+i+","+i+",0,0,"+ +(s*h>f*d)+","+(this._x1=t+m*u)+","+(this._y1=n+m*c)}else this._+="L"+(this._x1=t)+","+(this._y1=n);else;},arc:function(t,n,e,r,i,o){t=+t,n=+n,o=!!o;var a=(e=+e)*Math.cos(r),u=e*Math.sin(r),c=t+a,f=n+u,s=1^o,l=o?r-i:i-r;if(e<0)throw new Error("negative radius: "+e);null===this._x1?this._+="M"+c+","+f:(Math.abs(this._x1-c)>aa||Math.abs(this._y1-f)>aa)&&(this._+="L"+c+","+f),e&&(l<0&&(l=l%oa+oa),l>ua?this._+="A"+e+","+e+",0,1,"+s+","+(t-a)+","+(n-u)+"A"+e+","+e+",0,1,"+s+","+(this._x1=c)+","+(this._y1=f):l>aa&&(this._+="A"+e+","+e+",0,"+ +(l>=ia)+","+s+","+(this._x1=t+e*Math.cos(i))+","+(this._y1=n+e*Math.sin(i))))},rect:function(t,n,e,r){this._+="M"+(this._x0=this._x1=+t)+","+(this._y0=this._y1=+n)+"h"+ +e+"v"+ +r+"h"+-e+"Z"},toString:function(){return this._}};var sa=Array.prototype.slice;function la(t){return function(){return t}}function ha(t){return t.source}function da(t){return t.target}function pa(t){return t.radius}function ga(t){return t.startAngle}function ya(t){return t.endAngle}function va(){return 0}function _a(){return 10}function ba(t){var n=ha,e=da,r=pa,i=pa,o=ga,a=ya,u=va,c=null;function f(){var f,s=n.apply(this,arguments),l=e.apply(this,arguments),h=u.apply(this,arguments)/2,d=sa.call(arguments),p=+r.apply(this,(d[0]=s,d)),g=o.apply(this,d)-Ko,y=a.apply(this,d)-Ko,v=+i.apply(this,(d[0]=l,d)),_=o.apply(this,d)-Ko,b=a.apply(this,d)-Ko;if(c||(c=f=fa()),h>ta&&(Vo(y-g)>2*h+ta?y>g?(g+=h,y-=h):(g-=h,y+=h):g=y=(g+y)/2,Vo(b-_)>2*h+ta?b>_?(_+=h,b-=h):(_-=h,b+=h):_=b=(_+b)/2),c.moveTo(p*$o(g),p*Wo(g)),c.arc(0,0,p,g,y),g!==_||y!==b)if(t){var m=+t.apply(this,arguments),x=v-m,w=(_+b)/2;c.quadraticCurveTo(0,0,x*$o(_),x*Wo(_)),c.lineTo(v*$o(w),v*Wo(w)),c.lineTo(x*$o(b),x*Wo(b))}else c.quadraticCurveTo(0,0,v*$o(_),v*Wo(_)),c.arc(0,0,v,_,b);if(c.quadraticCurveTo(0,0,p*$o(g),p*Wo(g)),c.closePath(),f)return c=null,f+""||null}return t&&(f.headRadius=function(n){return arguments.length?(t="function"==typeof n?n:la(+n),f):t}),f.radius=function(t){return arguments.length?(r=i="function"==typeof t?t:la(+t),f):r},f.sourceRadius=function(t){return arguments.length?(r="function"==typeof t?t:la(+t),f):r},f.targetRadius=function(t){return arguments.length?(i="function"==typeof t?t:la(+t),f):i},f.startAngle=function(t){return arguments.length?(o="function"==typeof t?t:la(+t),f):o},f.endAngle=function(t){return arguments.length?(a="function"==typeof t?t:la(+t),f):a},f.padAngle=function(t){return arguments.length?(u="function"==typeof t?t:la(+t),f):u},f.source=function(t){return arguments.length?(n=t,f):n},f.target=function(t){return arguments.length?(e=t,f):e},f.context=function(t){return arguments.length?(c=null==t?null:t,f):c},f}var ma=Array.prototype.slice;function xa(t,n){return t-n}var wa=t=>()=>t;function Ma(t,n){for(var e,r=-1,i=n.length;++r<i;)if(e=Aa(t,n[r]))return e;return 0}function Aa(t,n){for(var e=n[0],r=n[1],i=-1,o=0,a=t.length,u=a-1;o<a;u=o++){var c=t[o],f=c[0],s=c[1],l=t[u],h=l[0],d=l[1];if(Ta(c,l,n))return 0;s>r!=d>r&&e<(h-f)*(r-s)/(d-s)+f&&(i=-i)}return i}function Ta(t,n,e){var r,i,o,a;return function(t,n,e){return(n[0]-t[0])*(e[1]-t[1])==(e[0]-t[0])*(n[1]-t[1])}(t,n,e)&&(i=t[r=+(t[0]===n[0])],o=e[r],a=n[r],i<=o&&o<=a||a<=o&&o<=i)}function Sa(){}var Ea=[[],[[[1,1.5],[.5,1]]],[[[1.5,1],[1,1.5]]],[[[1.5,1],[.5,1]]],[[[1,.5],[1.5,1]]],[[[1,1.5],[.5,1]],[[1,.5],[1.5,1]]],[[[1,.5],[1,1.5]]],[[[1,.5],[.5,1]]],[[[.5,1],[1,.5]]],[[[1,1.5],[1,.5]]],[[[.5,1],[1,.5]],[[1.5,1],[1,1.5]]],[[[1.5,1],[1,.5]]],[[[.5,1],[1.5,1]]],[[[1,1.5],[1.5,1]]],[[[.5,1],[1,1.5]]],[]];function ka(){var t=1,n=1,e=I,r=u;function i(t){var n=e(t);if(Array.isArray(n))n=n.slice().sort(xa);else{var r=p(t),i=r[0],a=r[1];n=F(i,a,n),n=Z(Math.floor(i/n)*n,Math.floor(a/n)*n,n)}return n.map((function(n){return o(t,n)}))}function o(e,i){var o=[],u=[];return function(e,r,i){var o,u,c,f,s,l,h=new Array,d=new Array;o=u=-1,f=e[0]>=r,Ea[f<<1].forEach(p);for(;++o<t-1;)c=f,f=e[o+1]>=r,Ea[c|f<<1].forEach(p);Ea[f<<0].forEach(p);for(;++u<n-1;){for(o=-1,f=e[u*t+t]>=r,s=e[u*t]>=r,Ea[f<<1|s<<2].forEach(p);++o<t-1;)c=f,f=e[u*t+t+o+1]>=r,l=s,s=e[u*t+o+1]>=r,Ea[c|f<<1|s<<2|l<<3].forEach(p);Ea[f|s<<3].forEach(p)}o=-1,s=e[u*t]>=r,Ea[s<<2].forEach(p);for(;++o<t-1;)l=s,s=e[u*t+o+1]>=r,Ea[s<<2|l<<3].forEach(p);function p(t){var n,e,r=[t[0][0]+o,t[0][1]+u],c=[t[1][0]+o,t[1][1]+u],f=a(r),s=a(c);(n=d[f])?(e=h[s])?(delete d[n.end],delete h[e.start],n===e?(n.ring.push(c),i(n.ring)):h[n.start]=d[e.end]={start:n.start,end:e.end,ring:n.ring.concat(e.ring)}):(delete d[n.end],n.ring.push(c),d[n.end=s]=n):(n=h[s])?(e=d[f])?(delete h[n.start],delete d[e.end],n===e?(n.ring.push(c),i(n.ring)):h[e.start]=d[n.end]={start:e.start,end:n.end,ring:e.ring.concat(n.ring)}):(delete h[n.start],n.ring.unshift(r),h[n.start=f]=n):h[f]=d[s]={start:f,end:s,ring:[r,c]}}Ea[s<<3].forEach(p)}(e,i,(function(t){r(t,e,i),function(t){for(var n=0,e=t.length,r=t[e-1][1]*t[0][0]-t[e-1][0]*t[0][1];++n<e;)r+=t[n-1][1]*t[n][0]-t[n-1][0]*t[n][1];return r}(t)>0?o.push([t]):u.push(t)})),u.forEach((function(t){for(var n,e=0,r=o.length;e<r;++e)if(-1!==Ma((n=o[e])[0],t))return void n.push(t)})),{type:"MultiPolygon",value:i,coordinates:o}}function a(n){return 2*n[0]+n[1]*(t+1)*4}function u(e,r,i){e.forEach((function(e){var o,a=e[0],u=e[1],c=0|a,f=0|u,s=r[f*t+c];a>0&&a<t&&c===a&&(o=r[f*t+c-1],e[0]=a+(i-o)/(s-o)-.5),u>0&&u<n&&f===u&&(o=r[(f-1)*t+c],e[1]=u+(i-o)/(s-o)-.5)}))}return i.contour=o,i.size=function(e){if(!arguments.length)return[t,n];var r=Math.floor(e[0]),o=Math.floor(e[1]);if(!(r>=0&&o>=0))throw new Error("invalid size");return t=r,n=o,i},i.thresholds=function(t){return arguments.length?(e="function"==typeof t?t:Array.isArray(t)?wa(ma.call(t)):wa(t),i):e},i.smooth=function(t){return arguments.length?(r=t?u:Sa,i):r===u},i}function Na(t,n,e){for(var r=t.width,i=t.height,o=1+(e<<1),a=0;a<i;++a)for(var u=0,c=0;u<r+e;++u)u<r&&(c+=t.data[u+a*r]),u>=e&&(u>=o&&(c-=t.data[u-o+a*r]),n.data[u-e+a*r]=c/Math.min(u+1,r-1+o-u,o))}function Ca(t,n,e){for(var r=t.width,i=t.height,o=1+(e<<1),a=0;a<r;++a)for(var u=0,c=0;u<i+e;++u)u<i&&(c+=t.data[a+u*r]),u>=e&&(u>=o&&(c-=t.data[a+(u-o)*r]),n.data[a+(u-e)*r]=c/Math.min(u+1,i-1+o-u,o))}function Pa(t){return t[0]}function za(t){return t[1]}function Da(){return 1}const qa=Math.pow(2,-52),Ra=new Uint32Array(512);class Fa{static from(t,n=Ha,e=Xa){const r=t.length,i=new Float64Array(2*r);for(let o=0;o<r;o++){const r=t[o];i[2*o]=n(r),i[2*o+1]=e(r)}return new Fa(i)}constructor(t){const n=t.length>>1;if(n>0&&"number"!=typeof t[0])throw new Error("Expected coords to contain numbers.");this.coords=t;const e=Math.max(2*n-5,0);this._triangles=new Uint32Array(3*e),this._halfedges=new Int32Array(3*e),this._hashSize=Math.ceil(Math.sqrt(n)),this._hullPrev=new Uint32Array(n),this._hullNext=new Uint32Array(n),this._hullTri=new Uint32Array(n),this._hullHash=new Int32Array(this._hashSize).fill(-1),this._ids=new Uint32Array(n),this._dists=new Float64Array(n),this.update()}update(){const{coords:t,_hullPrev:n,_hullNext:e,_hullTri:r,_hullHash:i}=this,o=t.length>>1;let a=1/0,u=1/0,c=-1/0,f=-1/0;for(let n=0;n<o;n++){const e=t[2*n],r=t[2*n+1];e<a&&(a=e),r<u&&(u=r),e>c&&(c=e),r>f&&(f=r),this._ids[n]=n}const s=(a+c)/2,l=(u+f)/2;let h,d,p,g=1/0;for(let n=0;n<o;n++){const e=Oa(s,l,t[2*n],t[2*n+1]);e<g&&(h=n,g=e)}const y=t[2*h],v=t[2*h+1];g=1/0;for(let n=0;n<o;n++){if(n===h)continue;const e=Oa(y,v,t[2*n],t[2*n+1]);e<g&&e>0&&(d=n,g=e)}let _=t[2*d],b=t[2*d+1],m=1/0;for(let n=0;n<o;n++){if(n===h||n===d)continue;const e=Ya(y,v,_,b,t[2*n],t[2*n+1]);e<m&&(p=n,m=e)}let x=t[2*p],w=t[2*p+1];if(m===1/0){for(let n=0;n<o;n++)this._dists[n]=t[2*n]-t[0]||t[2*n+1]-t[1];La(this._ids,this._dists,0,o-1);const n=new Uint32Array(o);let e=0;for(let t=0,r=-1/0;t<o;t++){const i=this._ids[t];this._dists[i]>r&&(n[e++]=i,r=this._dists[i])}return this.hull=n.subarray(0,e),this.triangles=new Uint32Array(0),void(this.halfedges=new Uint32Array(0))}if(Ua(y,v,_,b,x,w)){const t=d,n=_,e=b;d=p,_=x,b=w,p=t,x=n,w=e}const M=function(t,n,e,r,i,o){const a=e-t,u=r-n,c=i-t,f=o-n,s=a*a+u*u,l=c*c+f*f,h=.5/(a*f-u*c);return{x:t+(f*s-u*l)*h,y:n+(a*l-c*s)*h}}(y,v,_,b,x,w);this._cx=M.x,this._cy=M.y;for(let n=0;n<o;n++)this._dists[n]=Oa(t[2*n],t[2*n+1],M.x,M.y);La(this._ids,this._dists,0,o-1),this._hullStart=h;let A=3;e[h]=n[p]=d,e[d]=n[h]=p,e[p]=n[d]=h,r[h]=0,r[d]=1,r[p]=2,i.fill(-1),i[this._hashKey(y,v)]=h,i[this._hashKey(_,b)]=d,i[this._hashKey(x,w)]=p,this.trianglesLen=0,this._addTriangle(h,d,p,-1,-1,-1);for(let o,a,u=0;u<this._ids.length;u++){const c=this._ids[u],f=t[2*c],s=t[2*c+1];if(u>0&&Math.abs(f-o)<=qa&&Math.abs(s-a)<=qa)continue;if(o=f,a=s,c===h||c===d||c===p)continue;let l=0;for(let t=0,n=this._hashKey(f,s);t<this._hashSize&&(l=i[(n+t)%this._hashSize],-1===l||l===e[l]);t++);l=n[l];let g,y=l;for(;g=e[y],!Ua(f,s,t[2*y],t[2*y+1],t[2*g],t[2*g+1]);)if(y=g,y===l){y=-1;break}if(-1===y)continue;let v=this._addTriangle(y,c,e[y],-1,-1,r[y]);r[c]=this._legalize(v+2),r[y]=v,A++;let _=e[y];for(;g=e[_],Ua(f,s,t[2*_],t[2*_+1],t[2*g],t[2*g+1]);)v=this._addTriangle(_,c,g,r[c],-1,r[_]),r[c]=this._legalize(v+2),e[_]=_,A--,_=g;if(y===l)for(;g=n[y],Ua(f,s,t[2*g],t[2*g+1],t[2*y],t[2*y+1]);)v=this._addTriangle(g,c,y,-1,r[y],r[g]),this._legalize(v+2),r[g]=v,e[y]=y,A--,y=g;this._hullStart=n[c]=y,e[y]=n[_]=c,e[c]=_,i[this._hashKey(f,s)]=c,i[this._hashKey(t[2*y],t[2*y+1])]=y}this.hull=new Uint32Array(A);for(let t=0,n=this._hullStart;t<A;t++)this.hull[t]=n,n=e[n];this.triangles=this._triangles.subarray(0,this.trianglesLen),this.halfedges=this._halfedges.subarray(0,this.trianglesLen)}_hashKey(t,n){return Math.floor(function(t,n){const e=t/(Math.abs(t)+Math.abs(n));return(n>0?3-e:1+e)/4}(t-this._cx,n-this._cy)*this._hashSize)%this._hashSize}_legalize(t){const{_triangles:n,_halfedges:e,coords:r}=this;let i=0,o=0;for(;;){const a=e[t],u=t-t%3;if(o=u+(t+2)%3,-1===a){if(0===i)break;t=Ra[--i];continue}const c=a-a%3,f=u+(t+1)%3,s=c+(a+2)%3,l=n[o],h=n[t],d=n[f],p=n[s];if(Ba(r[2*l],r[2*l+1],r[2*h],r[2*h+1],r[2*d],r[2*d+1],r[2*p],r[2*p+1])){n[t]=p,n[a]=l;const r=e[s];if(-1===r){let n=this._hullStart;do{if(this._hullTri[n]===s){this._hullTri[n]=t;break}n=this._hullPrev[n]}while(n!==this._hullStart)}this._link(t,r),this._link(a,e[o]),this._link(o,s);const u=c+(a+1)%3;i<Ra.length&&(Ra[i++]=u)}else{if(0===i)break;t=Ra[--i]}}return o}_link(t,n){this._halfedges[t]=n,-1!==n&&(this._halfedges[n]=t)}_addTriangle(t,n,e,r,i,o){const a=this.trianglesLen;return this._triangles[a]=t,this._triangles[a+1]=n,this._triangles[a+2]=e,this._link(a,r),this._link(a+1,i),this._link(a+2,o),this.trianglesLen+=3,a}}function Oa(t,n,e,r){const i=t-e,o=n-r;return i*i+o*o}function Ia(t,n,e,r,i,o){const a=(r-n)*(i-t),u=(e-t)*(o-n);return Math.abs(a-u)>=33306690738754716e-32*Math.abs(a+u)?a-u:0}function Ua(t,n,e,r,i,o){return(Ia(i,o,t,n,e,r)||Ia(t,n,e,r,i,o)||Ia(e,r,i,o,t,n))<0}function Ba(t,n,e,r,i,o,a,u){const c=t-a,f=n-u,s=e-a,l=r-u,h=i-a,d=o-u,p=s*s+l*l,g=h*h+d*d;return c*(l*g-p*d)-f*(s*g-p*h)+(c*c+f*f)*(s*d-l*h)<0}function Ya(t,n,e,r,i,o){const a=e-t,u=r-n,c=i-t,f=o-n,s=a*a+u*u,l=c*c+f*f,h=.5/(a*f-u*c),d=(f*s-u*l)*h,p=(a*l-c*s)*h;return d*d+p*p}function La(t,n,e,r){if(r-e<=20)for(let i=e+1;i<=r;i++){const r=t[i],o=n[r];let a=i-1;for(;a>=e&&n[t[a]]>o;)t[a+1]=t[a--];t[a+1]=r}else{let i=e+1,o=r;ja(t,e+r>>1,i),n[t[e]]>n[t[r]]&&ja(t,e,r),n[t[i]]>n[t[r]]&&ja(t,i,r),n[t[e]]>n[t[i]]&&ja(t,e,i);const a=t[i],u=n[a];for(;;){do{i++}while(n[t[i]]<u);do{o--}while(n[t[o]]>u);if(o<i)break;ja(t,i,o)}t[e+1]=t[o],t[o]=a,r-i+1>=o-e?(La(t,n,i,r),La(t,n,e,o-1)):(La(t,n,e,o-1),La(t,n,i,r))}}function ja(t,n,e){const r=t[n];t[n]=t[e],t[e]=r}function Ha(t){return t[0]}function Xa(t){return t[1]}const Ga=1e-6;class Va{constructor(){this._x0=this._y0=this._x1=this._y1=null,this._=""}moveTo(t,n){this._+=`M${this._x0=this._x1=+t},${this._y0=this._y1=+n}`}closePath(){null!==this._x1&&(this._x1=this._x0,this._y1=this._y0,this._+="Z")}lineTo(t,n){this._+=`L${this._x1=+t},${this._y1=+n}`}arc(t,n,e){const r=(t=+t)+(e=+e),i=n=+n;if(e<0)throw new Error("negative radius");null===this._x1?this._+=`M${r},${i}`:(Math.abs(this._x1-r)>Ga||Math.abs(this._y1-i)>Ga)&&(this._+="L"+r+","+i),e&&(this._+=`A${e},${e},0,1,1,${t-e},${n}A${e},${e},0,1,1,${this._x1=r},${this._y1=i}`)}rect(t,n,e,r){this._+=`M${this._x0=this._x1=+t},${this._y0=this._y1=+n}h${+e}v${+r}h${-e}Z`}value(){return this._||null}}class $a{constructor(){this._=[]}moveTo(t,n){this._.push([t,n])}closePath(){this._.push(this._[0].slice())}lineTo(t,n){this._.push([t,n])}value(){return this._.length?this._:null}}class Wa{constructor(t,[n,e,r,i]=[0,0,960,500]){if(!((r=+r)>=(n=+n)&&(i=+i)>=(e=+e)))throw new Error("invalid bounds");this.delaunay=t,this._circumcenters=new Float64Array(2*t.points.length),this.vectors=new Float64Array(2*t.points.length),this.xmax=r,this.xmin=n,this.ymax=i,this.ymin=e,this._init()}update(){return this.delaunay.update(),this._init(),this}_init(){const{delaunay:{points:t,hull:n,triangles:e},vectors:r}=this,i=this.circumcenters=this._circumcenters.subarray(0,e.length/3*2);for(let n,r,o=0,a=0,u=e.length;o<u;o+=3,a+=2){const u=2*e[o],c=2*e[o+1],f=2*e[o+2],s=t[u],l=t[u+1],h=t[c],d=t[c+1],p=t[f],g=t[f+1],y=h-s,v=d-l,_=p-s,b=g-l,m=y*y+v*v,x=_*_+b*b,w=2*(y*b-v*_);if(w)if(Math.abs(w)<1e-8)n=(s+p)/2,r=(l+g)/2;else{const t=1/w;n=s+(b*m-v*x)*t,r=l+(y*x-_*m)*t}else n=(s+p)/2-1e8*b,r=(l+g)/2+1e8*_;i[a]=n,i[a+1]=r}let o,a,u,c=n[n.length-1],f=4*c,s=t[2*c],l=t[2*c+1];r.fill(0);for(let e=0;e<n.length;++e)c=n[e],o=f,a=s,u=l,f=4*c,s=t[2*c],l=t[2*c+1],r[o+2]=r[f]=u-l,r[o+3]=r[f+1]=s-a}render(t){const n=null==t?t=new Va:void 0,{delaunay:{halfedges:e,inedges:r,hull:i},circumcenters:o,vectors:a}=this;if(i.length<=1)return null;for(let n=0,r=e.length;n<r;++n){const r=e[n];if(r<n)continue;const i=2*Math.floor(n/3),a=2*Math.floor(r/3),u=o[i],c=o[i+1],f=o[a],s=o[a+1];this._renderSegment(u,c,f,s,t)}let u,c=i[i.length-1];for(let n=0;n<i.length;++n){u=c,c=i[n];const e=2*Math.floor(r[c]/3),f=o[e],s=o[e+1],l=4*u,h=this._project(f,s,a[l+2],a[l+3]);h&&this._renderSegment(f,s,h[0],h[1],t)}return n&&n.value()}renderBounds(t){const n=null==t?t=new Va:void 0;return t.rect(this.xmin,this.ymin,this.xmax-this.xmin,this.ymax-this.ymin),n&&n.value()}renderCell(t,n){const e=null==n?n=new Va:void 0,r=this._clip(t);if(null===r||!r.length)return;n.moveTo(r[0],r[1]);let i=r.length;for(;r[0]===r[i-2]&&r[1]===r[i-1]&&i>1;)i-=2;for(let t=2;t<i;t+=2)r[t]===r[t-2]&&r[t+1]===r[t-1]||n.lineTo(r[t],r[t+1]);return n.closePath(),e&&e.value()}*cellPolygons(){const{delaunay:{points:t}}=this;for(let n=0,e=t.length/2;n<e;++n){const t=this.cellPolygon(n);t&&(t.index=n,yield t)}}cellPolygon(t){const n=new $a;return this.renderCell(t,n),n.value()}_renderSegment(t,n,e,r,i){let o;const a=this._regioncode(t,n),u=this._regioncode(e,r);0===a&&0===u?(i.moveTo(t,n),i.lineTo(e,r)):(o=this._clipSegment(t,n,e,r,a,u))&&(i.moveTo(o[0],o[1]),i.lineTo(o[2],o[3]))}contains(t,n,e){return(n=+n)==n&&(e=+e)==e&&this.delaunay._step(t,n,e)===t}*neighbors(t){const n=this._clip(t);if(n)for(const e of this.delaunay.neighbors(t)){const t=this._clip(e);if(t)t:for(let r=0,i=n.length;r<i;r+=2)for(let o=0,a=t.length;o<a;o+=2)if(n[r]==t[o]&&n[r+1]==t[o+1]&&n[(r+2)%i]==t[(o+a-2)%a]&&n[(r+3)%i]==t[(o+a-1)%a]){yield e;break t}}}_cell(t){const{circumcenters:n,delaunay:{inedges:e,halfedges:r,triangles:i}}=this,o=e[t];if(-1===o)return null;const a=[];let u=o;do{const e=Math.floor(u/3);if(a.push(n[2*e],n[2*e+1]),u=u%3==2?u-2:u+1,i[u]!==t)break;u=r[u]}while(u!==o&&-1!==u);return a}_clip(t){if(0===t&&1===this.delaunay.hull.length)return[this.xmax,this.ymin,this.xmax,this.ymax,this.xmin,this.ymax,this.xmin,this.ymin];const n=this._cell(t);if(null===n)return null;const{vectors:e}=this,r=4*t;return e[r]||e[r+1]?this._clipInfinite(t,n,e[r],e[r+1],e[r+2],e[r+3]):this._clipFinite(t,n)}_clipFinite(t,n){const e=n.length;let r,i,o,a,u,c=null,f=n[e-2],s=n[e-1],l=this._regioncode(f,s);for(let h=0;h<e;h+=2)if(r=f,i=s,f=n[h],s=n[h+1],o=l,l=this._regioncode(f,s),0===o&&0===l)a=u,u=0,c?c.push(f,s):c=[f,s];else{let n,e,h,d,p;if(0===o){if(null===(n=this._clipSegment(r,i,f,s,o,l)))continue;[e,h,d,p]=n}else{if(null===(n=this._clipSegment(f,s,r,i,l,o)))continue;[d,p,e,h]=n,a=u,u=this._edgecode(e,h),a&&u&&this._edge(t,a,u,c,c.length),c?c.push(e,h):c=[e,h]}a=u,u=this._edgecode(d,p),a&&u&&this._edge(t,a,u,c,c.length),c?c.push(d,p):c=[d,p]}if(c)a=u,u=this._edgecode(c[0],c[1]),a&&u&&this._edge(t,a,u,c,c.length);else if(this.contains(t,(this.xmin+this.xmax)/2,(this.ymin+this.ymax)/2))return[this.xmax,this.ymin,this.xmax,this.ymax,this.xmin,this.ymax,this.xmin,this.ymin];return c}_clipSegment(t,n,e,r,i,o){for(;;){if(0===i&&0===o)return[t,n,e,r];if(i&o)return null;let a,u,c=i||o;8&c?(a=t+(e-t)*(this.ymax-n)/(r-n),u=this.ymax):4&c?(a=t+(e-t)*(this.ymin-n)/(r-n),u=this.ymin):2&c?(u=n+(r-n)*(this.xmax-t)/(e-t),a=this.xmax):(u=n+(r-n)*(this.xmin-t)/(e-t),a=this.xmin),i?(t=a,n=u,i=this._regioncode(t,n)):(e=a,r=u,o=this._regioncode(e,r))}}_clipInfinite(t,n,e,r,i,o){let a,u=Array.from(n);if((a=this._project(u[0],u[1],e,r))&&u.unshift(a[0],a[1]),(a=this._project(u[u.length-2],u[u.length-1],i,o))&&u.push(a[0],a[1]),u=this._clipFinite(t,u))for(let n,e=0,r=u.length,i=this._edgecode(u[r-2],u[r-1]);e<r;e+=2)n=i,i=this._edgecode(u[e],u[e+1]),n&&i&&(e=this._edge(t,n,i,u,e),r=u.length);else this.contains(t,(this.xmin+this.xmax)/2,(this.ymin+this.ymax)/2)&&(u=[this.xmin,this.ymin,this.xmax,this.ymin,this.xmax,this.ymax,this.xmin,this.ymax]);return u}_edge(t,n,e,r,i){for(;n!==e;){let e,o;switch(n){case 5:n=4;continue;case 4:n=6,e=this.xmax,o=this.ymin;break;case 6:n=2;continue;case 2:n=10,e=this.xmax,o=this.ymax;break;case 10:n=8;continue;case 8:n=9,e=this.xmin,o=this.ymax;break;case 9:n=1;continue;case 1:n=5,e=this.xmin,o=this.ymin}r[i]===e&&r[i+1]===o||!this.contains(t,e,o)||(r.splice(i,0,e,o),i+=2)}if(r.length>4)for(let t=0;t<r.length;t+=2){const n=(t+2)%r.length,e=(t+4)%r.length;(r[t]===r[n]&&r[n]===r[e]||r[t+1]===r[n+1]&&r[n+1]===r[e+1])&&(r.splice(n,2),t-=2)}return i}_project(t,n,e,r){let i,o,a,u=1/0;if(r<0){if(n<=this.ymin)return null;(i=(this.ymin-n)/r)<u&&(a=this.ymin,o=t+(u=i)*e)}else if(r>0){if(n>=this.ymax)return null;(i=(this.ymax-n)/r)<u&&(a=this.ymax,o=t+(u=i)*e)}if(e>0){if(t>=this.xmax)return null;(i=(this.xmax-t)/e)<u&&(o=this.xmax,a=n+(u=i)*r)}else if(e<0){if(t<=this.xmin)return null;(i=(this.xmin-t)/e)<u&&(o=this.xmin,a=n+(u=i)*r)}return[o,a]}_edgecode(t,n){return(t===this.xmin?1:t===this.xmax?2:0)|(n===this.ymin?4:n===this.ymax?8:0)}_regioncode(t,n){return(t<this.xmin?1:t>this.xmax?2:0)|(n<this.ymin?4:n>this.ymax?8:0)}}const Za=2*Math.PI,Ka=Math.pow;function Qa(t){return t[0]}function Ja(t){return t[1]}function tu(t,n,e){return[t+Math.sin(t+n)*e,n+Math.cos(t-n)*e]}class nu{static from(t,n=Qa,e=Ja,r){return new nu("length"in t?function(t,n,e,r){const i=t.length,o=new Float64Array(2*i);for(let a=0;a<i;++a){const i=t[a];o[2*a]=n.call(r,i,a,t),o[2*a+1]=e.call(r,i,a,t)}return o}(t,n,e,r):Float64Array.from(function*(t,n,e,r){let i=0;for(const o of t)yield n.call(r,o,i,t),yield e.call(r,o,i,t),++i}(t,n,e,r)))}constructor(t){this._delaunator=new Fa(t),this.inedges=new Int32Array(t.length/2),this._hullIndex=new Int32Array(t.length/2),this.points=this._delaunator.coords,this._init()}update(){return this._delaunator.update(),this._init(),this}_init(){const t=this._delaunator,n=this.points;if(t.hull&&t.hull.length>2&&function(t){const{triangles:n,coords:e}=t;for(let t=0;t<n.length;t+=3){const r=2*n[t],i=2*n[t+1],o=2*n[t+2];if((e[o]-e[r])*(e[i+1]-e[r+1])-(e[i]-e[r])*(e[o+1]-e[r+1])>1e-10)return!1}return!0}(t)){this.collinear=Int32Array.from({length:n.length/2},((t,n)=>n)).sort(((t,e)=>n[2*t]-n[2*e]||n[2*t+1]-n[2*e+1]));const t=this.collinear[0],e=this.collinear[this.collinear.length-1],r=[n[2*t],n[2*t+1],n[2*e],n[2*e+1]],i=1e-8*Math.hypot(r[3]-r[1],r[2]-r[0]);for(let t=0,e=n.length/2;t<e;++t){const e=tu(n[2*t],n[2*t+1],i);n[2*t]=e[0],n[2*t+1]=e[1]}this._delaunator=new Fa(n)}else delete this.collinear;const e=this.halfedges=this._delaunator.halfedges,r=this.hull=this._delaunator.hull,i=this.triangles=this._delaunator.triangles,o=this.inedges.fill(-1),a=this._hullIndex.fill(-1);for(let t=0,n=e.length;t<n;++t){const n=i[t%3==2?t-2:t+1];-1!==e[t]&&-1!==o[n]||(o[n]=t)}for(let t=0,n=r.length;t<n;++t)a[r[t]]=t;r.length<=2&&r.length>0&&(this.triangles=new Int32Array(3).fill(-1),this.halfedges=new Int32Array(3).fill(-1),this.triangles[0]=r[0],this.triangles[1]=r[1],this.triangles[2]=r[1],o[r[0]]=1,2===r.length&&(o[r[1]]=0))}voronoi(t){return new Wa(this,t)}*neighbors(t){const{inedges:n,hull:e,_hullIndex:r,halfedges:i,triangles:o,collinear:a}=this;if(a){const n=a.indexOf(t);return n>0&&(yield a[n-1]),void(n<a.length-1&&(yield a[n+1]))}const u=n[t];if(-1===u)return;let c=u,f=-1;do{if(yield f=o[c],c=c%3==2?c-2:c+1,o[c]!==t)return;if(c=i[c],-1===c){const n=e[(r[t]+1)%e.length];return void(n!==f&&(yield n))}}while(c!==u)}find(t,n,e=0){if((t=+t)!=t||(n=+n)!=n)return-1;const r=e;let i;for(;(i=this._step(e,t,n))>=0&&i!==e&&i!==r;)e=i;return i}_step(t,n,e){const{inedges:r,hull:i,_hullIndex:o,halfedges:a,triangles:u,points:c}=this;if(-1===r[t]||!c.length)return(t+1)%(c.length>>1);let f=t,s=Ka(n-c[2*t],2)+Ka(e-c[2*t+1],2);const l=r[t];let h=l;do{let r=u[h];const l=Ka(n-c[2*r],2)+Ka(e-c[2*r+1],2);if(l<s&&(s=l,f=r),h=h%3==2?h-2:h+1,u[h]!==t)break;if(h=a[h],-1===h){if(h=i[(o[t]+1)%i.length],h!==r&&Ka(n-c[2*h],2)+Ka(e-c[2*h+1],2)<s)return h;break}}while(h!==l);return f}render(t){const n=null==t?t=new Va:void 0,{points:e,halfedges:r,triangles:i}=this;for(let n=0,o=r.length;n<o;++n){const o=r[n];if(o<n)continue;const a=2*i[n],u=2*i[o];t.moveTo(e[a],e[a+1]),t.lineTo(e[u],e[u+1])}return this.renderHull(t),n&&n.value()}renderPoints(t,n=2){const e=null==t?t=new Va:void 0,{points:r}=this;for(let e=0,i=r.length;e<i;e+=2){const i=r[e],o=r[e+1];t.moveTo(i+n,o),t.arc(i,o,n,0,Za)}return e&&e.value()}renderHull(t){const n=null==t?t=new Va:void 0,{hull:e,points:r}=this,i=2*e[0],o=e.length;t.moveTo(r[i],r[i+1]);for(let n=1;n<o;++n){const i=2*e[n];t.lineTo(r[i],r[i+1])}return t.closePath(),n&&n.value()}hullPolygon(){const t=new $a;return this.renderHull(t),t.value()}renderTriangle(t,n){const e=null==n?n=new Va:void 0,{points:r,triangles:i}=this,o=2*i[t*=3],a=2*i[t+1],u=2*i[t+2];return n.moveTo(r[o],r[o+1]),n.lineTo(r[a],r[a+1]),n.lineTo(r[u],r[u+1]),n.closePath(),e&&e.value()}*trianglePolygons(){const{triangles:t}=this;for(let n=0,e=t.length/3;n<e;++n)yield this.trianglePolygon(n)}trianglePolygon(t){const n=new $a;return this.renderTriangle(t,n),n.value()}}var eu={},ru={};function iu(t){return new Function("d","return {"+t.map((function(t,n){return JSON.stringify(t)+": d["+n+'] || ""'})).join(",")+"}")}function ou(t){var n=Object.create(null),e=[];return t.forEach((function(t){for(var r in t)r in n||e.push(n[r]=r)})),e}function au(t,n){var e=t+"",r=e.length;return r<n?new Array(n-r+1).join(0)+e:e}function uu(t){var n=t.getUTCHours(),e=t.getUTCMinutes(),r=t.getUTCSeconds(),i=t.getUTCMilliseconds();return isNaN(t)?"Invalid Date":function(t){return t<0?"-"+au(-t,6):t>9999?"+"+au(t,6):au(t,4)}(t.getUTCFullYear())+"-"+au(t.getUTCMonth()+1,2)+"-"+au(t.getUTCDate(),2)+(i?"T"+au(n,2)+":"+au(e,2)+":"+au(r,2)+"."+au(i,3)+"Z":r?"T"+au(n,2)+":"+au(e,2)+":"+au(r,2)+"Z":e||n?"T"+au(n,2)+":"+au(e,2)+"Z":"")}function cu(t){var n=new RegExp('["'+t+"\n\r]"),e=t.charCodeAt(0);function r(t,n){var r,i=[],o=t.length,a=0,u=0,c=o<=0,f=!1;function s(){if(c)return ru;if(f)return f=!1,eu;var n,r,i=a;if(34===t.charCodeAt(i)){for(;a++<o&&34!==t.charCodeAt(a)||34===t.charCodeAt(++a););return(n=a)>=o?c=!0:10===(r=t.charCodeAt(a++))?f=!0:13===r&&(f=!0,10===t.charCodeAt(a)&&++a),t.slice(i+1,n-1).replace(/""/g,'"')}for(;a<o;){if(10===(r=t.charCodeAt(n=a++)))f=!0;else if(13===r)f=!0,10===t.charCodeAt(a)&&++a;else if(r!==e)continue;return t.slice(i,n)}return c=!0,t.slice(i,o)}for(10===t.charCodeAt(o-1)&&--o,13===t.charCodeAt(o-1)&&--o;(r=s())!==ru;){for(var l=[];r!==eu&&r!==ru;)l.push(r),r=s();n&&null==(l=n(l,u++))||i.push(l)}return i}function i(n,e){return n.map((function(n){return e.map((function(t){return a(n[t])})).join(t)}))}function o(n){return n.map(a).join(t)}function a(t){return null==t?"":t instanceof Date?uu(t):n.test(t+="")?'"'+t.replace(/"/g,'""')+'"':t}return{parse:function(t,n){var e,i,o=r(t,(function(t,r){if(e)return e(t,r-1);i=t,e=n?function(t,n){var e=iu(t);return function(r,i){return n(e(r),i,t)}}(t,n):iu(t)}));return o.columns=i||[],o},parseRows:r,format:function(n,e){return null==e&&(e=ou(n)),[e.map(a).join(t)].concat(i(n,e)).join("\n")},formatBody:function(t,n){return null==n&&(n=ou(t)),i(t,n).join("\n")},formatRows:function(t){return t.map(o).join("\n")},formatRow:o,formatValue:a}}var fu=cu(","),su=fu.parse,lu=fu.parseRows,hu=fu.format,du=fu.formatBody,pu=fu.formatRows,gu=fu.formatRow,yu=fu.formatValue,vu=cu("\t"),_u=vu.parse,bu=vu.parseRows,mu=vu.format,xu=vu.formatBody,wu=vu.formatRows,Mu=vu.formatRow,Au=vu.formatValue;const Tu=new Date("2019-01-01T00:00").getHours()||new Date("2019-07-01T00:00").getHours();function Su(t){if(!t.ok)throw new Error(t.status+" "+t.statusText);return t.blob()}function Eu(t){if(!t.ok)throw new Error(t.status+" "+t.statusText);return t.arrayBuffer()}function ku(t){if(!t.ok)throw new Error(t.status+" "+t.statusText);return t.text()}function Nu(t,n){return fetch(t,n).then(ku)}function Cu(t){return function(n,e,r){return 2===arguments.length&&"function"==typeof e&&(r=e,e=void 0),Nu(n,e).then((function(n){return t(n,r)}))}}var Pu=Cu(su),zu=Cu(_u);function Du(t){if(!t.ok)throw new Error(t.status+" "+t.statusText);if(204!==t.status&&205!==t.status)return t.json()}function qu(t){return(n,e)=>Nu(n,e).then((n=>(new DOMParser).parseFromString(n,t)))}var Ru=qu("application/xml"),Fu=qu("text/html"),Ou=qu("image/svg+xml");function Iu(t,n,e,r){if(isNaN(n)||isNaN(e))return t;var i,o,a,u,c,f,s,l,h,d=t._root,p={data:r},g=t._x0,y=t._y0,v=t._x1,_=t._y1;if(!d)return t._root=p,t;for(;d.length;)if((f=n>=(o=(g+v)/2))?g=o:v=o,(s=e>=(a=(y+_)/2))?y=a:_=a,i=d,!(d=d[l=s<<1|f]))return i[l]=p,t;if(u=+t._x.call(null,d.data),c=+t._y.call(null,d.data),n===u&&e===c)return p.next=d,i?i[l]=p:t._root=p,t;do{i=i?i[l]=new Array(4):t._root=new Array(4),(f=n>=(o=(g+v)/2))?g=o:v=o,(s=e>=(a=(y+_)/2))?y=a:_=a}while((l=s<<1|f)==(h=(c>=a)<<1|u>=o));return i[h]=d,i[l]=p,t}function Uu(t,n,e,r,i){this.node=t,this.x0=n,this.y0=e,this.x1=r,this.y1=i}function Bu(t){return t[0]}function Yu(t){return t[1]}function Lu(t,n,e){var r=new ju(null==n?Bu:n,null==e?Yu:e,NaN,NaN,NaN,NaN);return null==t?r:r.addAll(t)}function ju(t,n,e,r,i,o){this._x=t,this._y=n,this._x0=e,this._y0=r,this._x1=i,this._y1=o,this._root=void 0}function Hu(t){for(var n={data:t.data},e=n;t=t.next;)e=e.next={data:t.data};return n}var Xu=Lu.prototype=ju.prototype;function Gu(t){return function(){return t}}function Vu(t){return 1e-6*(t()-.5)}function $u(t){return t.x+t.vx}function Wu(t){return t.y+t.vy}function Zu(t){return t.index}function Ku(t,n){var e=t.get(n);if(!e)throw new Error("node not found: "+n);return e}Xu.copy=function(){var t,n,e=new ju(this._x,this._y,this._x0,this._y0,this._x1,this._y1),r=this._root;if(!r)return e;if(!r.length)return e._root=Hu(r),e;for(t=[{source:r,target:e._root=new Array(4)}];r=t.pop();)for(var i=0;i<4;++i)(n=r.source[i])&&(n.length?t.push({source:n,target:r.target[i]=new Array(4)}):r.target[i]=Hu(n));return e},Xu.add=function(t){const n=+this._x.call(null,t),e=+this._y.call(null,t);return Iu(this.cover(n,e),n,e,t)},Xu.addAll=function(t){var n,e,r,i,o=t.length,a=new Array(o),u=new Array(o),c=1/0,f=1/0,s=-1/0,l=-1/0;for(e=0;e<o;++e)isNaN(r=+this._x.call(null,n=t[e]))||isNaN(i=+this._y.call(null,n))||(a[e]=r,u[e]=i,r<c&&(c=r),r>s&&(s=r),i<f&&(f=i),i>l&&(l=i));if(c>s||f>l)return this;for(this.cover(c,f).cover(s,l),e=0;e<o;++e)Iu(this,a[e],u[e],t[e]);return this},Xu.cover=function(t,n){if(isNaN(t=+t)||isNaN(n=+n))return this;var e=this._x0,r=this._y0,i=this._x1,o=this._y1;if(isNaN(e))i=(e=Math.floor(t))+1,o=(r=Math.floor(n))+1;else{for(var a,u,c=i-e||1,f=this._root;e>t||t>=i||r>n||n>=o;)switch(u=(n<r)<<1|t<e,(a=new Array(4))[u]=f,f=a,c*=2,u){case 0:i=e+c,o=r+c;break;case 1:e=i-c,o=r+c;break;case 2:i=e+c,r=o-c;break;case 3:e=i-c,r=o-c}this._root&&this._root.length&&(this._root=f)}return this._x0=e,this._y0=r,this._x1=i,this._y1=o,this},Xu.data=function(){var t=[];return this.visit((function(n){if(!n.length)do{t.push(n.data)}while(n=n.next)})),t},Xu.extent=function(t){return arguments.length?this.cover(+t[0][0],+t[0][1]).cover(+t[1][0],+t[1][1]):isNaN(this._x0)?void 0:[[this._x0,this._y0],[this._x1,this._y1]]},Xu.find=function(t,n,e){var r,i,o,a,u,c,f,s=this._x0,l=this._y0,h=this._x1,d=this._y1,p=[],g=this._root;for(g&&p.push(new Uu(g,s,l,h,d)),null==e?e=1/0:(s=t-e,l=n-e,h=t+e,d=n+e,e*=e);c=p.pop();)if(!(!(g=c.node)||(i=c.x0)>h||(o=c.y0)>d||(a=c.x1)<s||(u=c.y1)<l))if(g.length){var y=(i+a)/2,v=(o+u)/2;p.push(new Uu(g[3],y,v,a,u),new Uu(g[2],i,v,y,u),new Uu(g[1],y,o,a,v),new Uu(g[0],i,o,y,v)),(f=(n>=v)<<1|t>=y)&&(c=p[p.length-1],p[p.length-1]=p[p.length-1-f],p[p.length-1-f]=c)}else{var _=t-+this._x.call(null,g.data),b=n-+this._y.call(null,g.data),m=_*_+b*b;if(m<e){var x=Math.sqrt(e=m);s=t-x,l=n-x,h=t+x,d=n+x,r=g.data}}return r},Xu.remove=function(t){if(isNaN(o=+this._x.call(null,t))||isNaN(a=+this._y.call(null,t)))return this;var n,e,r,i,o,a,u,c,f,s,l,h,d=this._root,p=this._x0,g=this._y0,y=this._x1,v=this._y1;if(!d)return this;if(d.length)for(;;){if((f=o>=(u=(p+y)/2))?p=u:y=u,(s=a>=(c=(g+v)/2))?g=c:v=c,n=d,!(d=d[l=s<<1|f]))return this;if(!d.length)break;(n[l+1&3]||n[l+2&3]||n[l+3&3])&&(e=n,h=l)}for(;d.data!==t;)if(r=d,!(d=d.next))return this;return(i=d.next)&&delete d.next,r?(i?r.next=i:delete r.next,this):n?(i?n[l]=i:delete n[l],(d=n[0]||n[1]||n[2]||n[3])&&d===(n[3]||n[2]||n[1]||n[0])&&!d.length&&(e?e[h]=d:this._root=d),this):(this._root=i,this)},Xu.removeAll=function(t){for(var n=0,e=t.length;n<e;++n)this.remove(t[n]);return this},Xu.root=function(){return this._root},Xu.size=function(){var t=0;return this.visit((function(n){if(!n.length)do{++t}while(n=n.next)})),t},Xu.visit=function(t){var n,e,r,i,o,a,u=[],c=this._root;for(c&&u.push(new Uu(c,this._x0,this._y0,this._x1,this._y1));n=u.pop();)if(!t(c=n.node,r=n.x0,i=n.y0,o=n.x1,a=n.y1)&&c.length){var f=(r+o)/2,s=(i+a)/2;(e=c[3])&&u.push(new Uu(e,f,s,o,a)),(e=c[2])&&u.push(new Uu(e,r,s,f,a)),(e=c[1])&&u.push(new Uu(e,f,i,o,s)),(e=c[0])&&u.push(new Uu(e,r,i,f,s))}return this},Xu.visitAfter=function(t){var n,e=[],r=[];for(this._root&&e.push(new Uu(this._root,this._x0,this._y0,this._x1,this._y1));n=e.pop();){var i=n.node;if(i.length){var o,a=n.x0,u=n.y0,c=n.x1,f=n.y1,s=(a+c)/2,l=(u+f)/2;(o=i[0])&&e.push(new Uu(o,a,u,s,l)),(o=i[1])&&e.push(new Uu(o,s,u,c,l)),(o=i[2])&&e.push(new Uu(o,a,l,s,f)),(o=i[3])&&e.push(new Uu(o,s,l,c,f))}r.push(n)}for(;n=r.pop();)t(n.node,n.x0,n.y0,n.x1,n.y1);return this},Xu.x=function(t){return arguments.length?(this._x=t,this):this._x},Xu.y=function(t){return arguments.length?(this._y=t,this):this._y};const Qu=4294967296;function Ju(t){return t.x}function tc(t){return t.y}var nc=Math.PI*(3-Math.sqrt(5));function ec(t,n){if((e=(t=n?t.toExponential(n-1):t.toExponential()).indexOf("e"))<0)return null;var e,r=t.slice(0,e);return[r.length>1?r[0]+r.slice(2):r,+t.slice(e+1)]}function rc(t){return(t=ec(Math.abs(t)))?t[1]:NaN}var ic,oc=/^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;function ac(t){if(!(n=oc.exec(t)))throw new Error("invalid format: "+t);var n;return new uc({fill:n[1],align:n[2],sign:n[3],symbol:n[4],zero:n[5],width:n[6],comma:n[7],precision:n[8]&&n[8].slice(1),trim:n[9],type:n[10]})}function uc(t){this.fill=void 0===t.fill?" ":t.fill+"",this.align=void 0===t.align?">":t.align+"",this.sign=void 0===t.sign?"-":t.sign+"",this.symbol=void 0===t.symbol?"":t.symbol+"",this.zero=!!t.zero,this.width=void 0===t.width?void 0:+t.width,this.comma=!!t.comma,this.precision=void 0===t.precision?void 0:+t.precision,this.trim=!!t.trim,this.type=void 0===t.type?"":t.type+""}function cc(t,n){var e=ec(t,n);if(!e)return t+"";var r=e[0],i=e[1];return i<0?"0."+new Array(-i).join("0")+r:r.length>i+1?r.slice(0,i+1)+"."+r.slice(i+1):r+new Array(i-r.length+2).join("0")}ac.prototype=uc.prototype,uc.prototype.toString=function(){return this.fill+this.align+this.sign+this.symbol+(this.zero?"0":"")+(void 0===this.width?"":Math.max(1,0|this.width))+(this.comma?",":"")+(void 0===this.precision?"":"."+Math.max(0,0|this.precision))+(this.trim?"~":"")+this.type};var fc={"%":(t,n)=>(100*t).toFixed(n),b:t=>Math.round(t).toString(2),c:t=>t+"",d:function(t){return Math.abs(t=Math.round(t))>=1e21?t.toLocaleString("en").replace(/,/g,""):t.toString(10)},e:(t,n)=>t.toExponential(n),f:(t,n)=>t.toFixed(n),g:(t,n)=>t.toPrecision(n),o:t=>Math.round(t).toString(8),p:(t,n)=>cc(100*t,n),r:cc,s:function(t,n){var e=ec(t,n);if(!e)return t+"";var r=e[0],i=e[1],o=i-(ic=3*Math.max(-8,Math.min(8,Math.floor(i/3))))+1,a=r.length;return o===a?r:o>a?r+new Array(o-a+1).join("0"):o>0?r.slice(0,o)+"."+r.slice(o):"0."+new Array(1-o).join("0")+ec(t,Math.max(0,n+o-1))[0]},X:t=>Math.round(t).toString(16).toUpperCase(),x:t=>Math.round(t).toString(16)};function sc(t){return t}var lc,hc=Array.prototype.map,dc=["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];function pc(t){var n,e,r=void 0===t.grouping||void 0===t.thousands?sc:(n=hc.call(t.grouping,Number),e=t.thousands+"",function(t,r){for(var i=t.length,o=[],a=0,u=n[0],c=0;i>0&&u>0&&(c+u+1>r&&(u=Math.max(1,r-c)),o.push(t.substring(i-=u,i+u)),!((c+=u+1)>r));)u=n[a=(a+1)%n.length];return o.reverse().join(e)}),i=void 0===t.currency?"":t.currency[0]+"",o=void 0===t.currency?"":t.currency[1]+"",a=void 0===t.decimal?".":t.decimal+"",u=void 0===t.numerals?sc:function(t){return function(n){return n.replace(/[0-9]/g,(function(n){return t[+n]}))}}(hc.call(t.numerals,String)),c=void 0===t.percent?"%":t.percent+"",f=void 0===t.minus?"−":t.minus+"",s=void 0===t.nan?"NaN":t.nan+"";function l(t){var n=(t=ac(t)).fill,e=t.align,l=t.sign,h=t.symbol,d=t.zero,p=t.width,g=t.comma,y=t.precision,v=t.trim,_=t.type;"n"===_?(g=!0,_="g"):fc[_]||(void 0===y&&(y=12),v=!0,_="g"),(d||"0"===n&&"="===e)&&(d=!0,n="0",e="=");var b="$"===h?i:"#"===h&&/[boxX]/.test(_)?"0"+_.toLowerCase():"",m="$"===h?o:/[%p]/.test(_)?c:"",x=fc[_],w=/[defgprs%]/.test(_);function M(t){var i,o,c,h=b,M=m;if("c"===_)M=x(t)+M,t="";else{var A=(t=+t)<0||1/t<0;if(t=isNaN(t)?s:x(Math.abs(t),y),v&&(t=function(t){t:for(var n,e=t.length,r=1,i=-1;r<e;++r)switch(t[r]){case".":i=n=r;break;case"0":0===i&&(i=r),n=r;break;default:if(!+t[r])break t;i>0&&(i=0)}return i>0?t.slice(0,i)+t.slice(n+1):t}(t)),A&&0==+t&&"+"!==l&&(A=!1),h=(A?"("===l?l:f:"-"===l||"("===l?"":l)+h,M=("s"===_?dc[8+ic/3]:"")+M+(A&&"("===l?")":""),w)for(i=-1,o=t.length;++i<o;)if(48>(c=t.charCodeAt(i))||c>57){M=(46===c?a+t.slice(i+1):t.slice(i))+M,t=t.slice(0,i);break}}g&&!d&&(t=r(t,1/0));var T=h.length+t.length+M.length,S=T<p?new Array(p-T+1).join(n):"";switch(g&&d&&(t=r(S+t,S.length?p-M.length:1/0),S=""),e){case"<":t=h+t+M+S;break;case"=":t=h+S+t+M;break;case"^":t=S.slice(0,T=S.length>>1)+h+t+M+S.slice(T);break;default:t=S+h+t+M}return u(t)}return y=void 0===y?6:/[gprs]/.test(_)?Math.max(1,Math.min(21,y)):Math.max(0,Math.min(20,y)),M.toString=function(){return t+""},M}return{format:l,formatPrefix:function(t,n){var e=l(((t=ac(t)).type="f",t)),r=3*Math.max(-8,Math.min(8,Math.floor(rc(n)/3))),i=Math.pow(10,-r),o=dc[8+r/3];return function(t){return e(i*t)+o}}}}function gc(n){return lc=pc(n),t.format=lc.format,t.formatPrefix=lc.formatPrefix,lc}function yc(t){return Math.max(0,-rc(Math.abs(t)))}function vc(t,n){return Math.max(0,3*Math.max(-8,Math.min(8,Math.floor(rc(n)/3)))-rc(Math.abs(t)))}function _c(t,n){return t=Math.abs(t),n=Math.abs(n)-t,Math.max(0,rc(n)-rc(t))+1}t.format=void 0,t.formatPrefix=void 0,gc({thousands:",",grouping:[3],currency:["$",""]});var bc=1e-6,mc=1e-12,xc=Math.PI,wc=xc/2,Mc=xc/4,Ac=2*xc,Tc=180/xc,Sc=xc/180,Ec=Math.abs,kc=Math.atan,Nc=Math.atan2,Cc=Math.cos,Pc=Math.ceil,zc=Math.exp,Dc=Math.hypot,qc=Math.log,Rc=Math.pow,Fc=Math.sin,Oc=Math.sign||function(t){return t>0?1:t<0?-1:0},Ic=Math.sqrt,Uc=Math.tan;function Bc(t){return t>1?0:t<-1?xc:Math.acos(t)}function Yc(t){return t>1?wc:t<-1?-wc:Math.asin(t)}function Lc(t){return(t=Fc(t/2))*t}function jc(){}function Hc(t,n){t&&Gc.hasOwnProperty(t.type)&&Gc[t.type](t,n)}var Xc={Feature:function(t,n){Hc(t.geometry,n)},FeatureCollection:function(t,n){for(var e=t.features,r=-1,i=e.length;++r<i;)Hc(e[r].geometry,n)}},Gc={Sphere:function(t,n){n.sphere()},Point:function(t,n){t=t.coordinates,n.point(t[0],t[1],t[2])},MultiPoint:function(t,n){for(var e=t.coordinates,r=-1,i=e.length;++r<i;)t=e[r],n.point(t[0],t[1],t[2])},LineString:function(t,n){Vc(t.coordinates,n,0)},MultiLineString:function(t,n){for(var e=t.coordinates,r=-1,i=e.length;++r<i;)Vc(e[r],n,0)},Polygon:function(t,n){$c(t.coordinates,n)},MultiPolygon:function(t,n){for(var e=t.coordinates,r=-1,i=e.length;++r<i;)$c(e[r],n)},GeometryCollection:function(t,n){for(var e=t.geometries,r=-1,i=e.length;++r<i;)Hc(e[r],n)}};function Vc(t,n,e){var r,i=-1,o=t.length-e;for(n.lineStart();++i<o;)r=t[i],n.point(r[0],r[1],r[2]);n.lineEnd()}function $c(t,n){var e=-1,r=t.length;for(n.polygonStart();++e<r;)Vc(t[e],n,1);n.polygonEnd()}function Wc(t,n){t&&Xc.hasOwnProperty(t.type)?Xc[t.type](t,n):Hc(t,n)}var Zc,Kc,Qc,Jc,tf,nf,ef,rf,of,af,uf,cf,ff,sf,lf,hf,df=new g,pf=new g,gf={point:jc,lineStart:jc,lineEnd:jc,polygonStart:function(){df=new g,gf.lineStart=yf,gf.lineEnd=vf},polygonEnd:function(){var t=+df;pf.add(t<0?Ac+t:t),this.lineStart=this.lineEnd=this.point=jc},sphere:function(){pf.add(Ac)}};function yf(){gf.point=_f}function vf(){bf(Zc,Kc)}function _f(t,n){gf.point=bf,Zc=t,Kc=n,Qc=t*=Sc,Jc=Cc(n=(n*=Sc)/2+Mc),tf=Fc(n)}function bf(t,n){var e=(t*=Sc)-Qc,r=e>=0?1:-1,i=r*e,o=Cc(n=(n*=Sc)/2+Mc),a=Fc(n),u=tf*a,c=Jc*o+u*Cc(i),f=u*r*Fc(i);df.add(Nc(f,c)),Qc=t,Jc=o,tf=a}function mf(t){return[Nc(t[1],t[0]),Yc(t[2])]}function xf(t){var n=t[0],e=t[1],r=Cc(e);return[r*Cc(n),r*Fc(n),Fc(e)]}function wf(t,n){return t[0]*n[0]+t[1]*n[1]+t[2]*n[2]}function Mf(t,n){return[t[1]*n[2]-t[2]*n[1],t[2]*n[0]-t[0]*n[2],t[0]*n[1]-t[1]*n[0]]}function Af(t,n){t[0]+=n[0],t[1]+=n[1],t[2]+=n[2]}function Tf(t,n){return[t[0]*n,t[1]*n,t[2]*n]}function Sf(t){var n=Ic(t[0]*t[0]+t[1]*t[1]+t[2]*t[2]);t[0]/=n,t[1]/=n,t[2]/=n}var Ef,kf,Nf,Cf,Pf,zf,Df,qf,Rf,Ff,Of,If,Uf,Bf,Yf,Lf,jf={point:Hf,lineStart:Gf,lineEnd:Vf,polygonStart:function(){jf.point=$f,jf.lineStart=Wf,jf.lineEnd=Zf,sf=new g,gf.polygonStart()},polygonEnd:function(){gf.polygonEnd(),jf.point=Hf,jf.lineStart=Gf,jf.lineEnd=Vf,df<0?(nf=-(rf=180),ef=-(of=90)):sf>bc?of=90:sf<-1e-6&&(ef=-90),hf[0]=nf,hf[1]=rf},sphere:function(){nf=-(rf=180),ef=-(of=90)}};function Hf(t,n){lf.push(hf=[nf=t,rf=t]),n<ef&&(ef=n),n>of&&(of=n)}function Xf(t,n){var e=xf([t*Sc,n*Sc]);if(ff){var r=Mf(ff,e),i=Mf([r[1],-r[0],0],r);Sf(i),i=mf(i);var o,a=t-af,u=a>0?1:-1,c=i[0]*Tc*u,f=Ec(a)>180;f^(u*af<c&&c<u*t)?(o=i[1]*Tc)>of&&(of=o):f^(u*af<(c=(c+360)%360-180)&&c<u*t)?(o=-i[1]*Tc)<ef&&(ef=o):(n<ef&&(ef=n),n>of&&(of=n)),f?t<af?Kf(nf,t)>Kf(nf,rf)&&(rf=t):Kf(t,rf)>Kf(nf,rf)&&(nf=t):rf>=nf?(t<nf&&(nf=t),t>rf&&(rf=t)):t>af?Kf(nf,t)>Kf(nf,rf)&&(rf=t):Kf(t,rf)>Kf(nf,rf)&&(nf=t)}else lf.push(hf=[nf=t,rf=t]);n<ef&&(ef=n),n>of&&(of=n),ff=e,af=t}function Gf(){jf.point=Xf}function Vf(){hf[0]=nf,hf[1]=rf,jf.point=Hf,ff=null}function $f(t,n){if(ff){var e=t-af;sf.add(Ec(e)>180?e+(e>0?360:-360):e)}else uf=t,cf=n;gf.point(t,n),Xf(t,n)}function Wf(){gf.lineStart()}function Zf(){$f(uf,cf),gf.lineEnd(),Ec(sf)>bc&&(nf=-(rf=180)),hf[0]=nf,hf[1]=rf,ff=null}function Kf(t,n){return(n-=t)<0?n+360:n}function Qf(t,n){return t[0]-n[0]}function Jf(t,n){return t[0]<=t[1]?t[0]<=n&&n<=t[1]:n<t[0]||t[1]<n}var ts={sphere:jc,point:ns,lineStart:rs,lineEnd:as,polygonStart:function(){ts.lineStart=us,ts.lineEnd=cs},polygonEnd:function(){ts.lineStart=rs,ts.lineEnd=as}};function ns(t,n){t*=Sc;var e=Cc(n*=Sc);es(e*Cc(t),e*Fc(t),Fc(n))}function es(t,n,e){++Ef,Nf+=(t-Nf)/Ef,Cf+=(n-Cf)/Ef,Pf+=(e-Pf)/Ef}function rs(){ts.point=is}function is(t,n){t*=Sc;var e=Cc(n*=Sc);Bf=e*Cc(t),Yf=e*Fc(t),Lf=Fc(n),ts.point=os,es(Bf,Yf,Lf)}function os(t,n){t*=Sc;var e=Cc(n*=Sc),r=e*Cc(t),i=e*Fc(t),o=Fc(n),a=Nc(Ic((a=Yf*o-Lf*i)*a+(a=Lf*r-Bf*o)*a+(a=Bf*i-Yf*r)*a),Bf*r+Yf*i+Lf*o);kf+=a,zf+=a*(Bf+(Bf=r)),Df+=a*(Yf+(Yf=i)),qf+=a*(Lf+(Lf=o)),es(Bf,Yf,Lf)}function as(){ts.point=ns}function us(){ts.point=fs}function cs(){ss(If,Uf),ts.point=ns}function fs(t,n){If=t,Uf=n,t*=Sc,n*=Sc,ts.point=ss;var e=Cc(n);Bf=e*Cc(t),Yf=e*Fc(t),Lf=Fc(n),es(Bf,Yf,Lf)}function ss(t,n){t*=Sc;var e=Cc(n*=Sc),r=e*Cc(t),i=e*Fc(t),o=Fc(n),a=Yf*o-Lf*i,u=Lf*r-Bf*o,c=Bf*i-Yf*r,f=Dc(a,u,c),s=Yc(f),l=f&&-s/f;Rf.add(l*a),Ff.add(l*u),Of.add(l*c),kf+=s,zf+=s*(Bf+(Bf=r)),Df+=s*(Yf+(Yf=i)),qf+=s*(Lf+(Lf=o)),es(Bf,Yf,Lf)}function ls(t){return function(){return t}}function hs(t,n){function e(e,r){return e=t(e,r),n(e[0],e[1])}return t.invert&&n.invert&&(e.invert=function(e,r){return(e=n.invert(e,r))&&t.invert(e[0],e[1])}),e}function ds(t,n){return[Ec(t)>xc?t+Math.round(-t/Ac)*Ac:t,n]}function ps(t,n,e){return(t%=Ac)?n||e?hs(ys(t),vs(n,e)):ys(t):n||e?vs(n,e):ds}function gs(t){return function(n,e){return[(n+=t)>xc?n-Ac:n<-xc?n+Ac:n,e]}}function ys(t){var n=gs(t);return n.invert=gs(-t),n}function vs(t,n){var e=Cc(t),r=Fc(t),i=Cc(n),o=Fc(n);function a(t,n){var a=Cc(n),u=Cc(t)*a,c=Fc(t)*a,f=Fc(n),s=f*e+u*r;return[Nc(c*i-s*o,u*e-f*r),Yc(s*i+c*o)]}return a.invert=function(t,n){var a=Cc(n),u=Cc(t)*a,c=Fc(t)*a,f=Fc(n),s=f*i-c*o;return[Nc(c*i+f*o,u*e+s*r),Yc(s*e-u*r)]},a}function _s(t){function n(n){return(n=t(n[0]*Sc,n[1]*Sc))[0]*=Tc,n[1]*=Tc,n}return t=ps(t[0]*Sc,t[1]*Sc,t.length>2?t[2]*Sc:0),n.invert=function(n){return(n=t.invert(n[0]*Sc,n[1]*Sc))[0]*=Tc,n[1]*=Tc,n},n}function bs(t,n,e,r,i,o){if(e){var a=Cc(n),u=Fc(n),c=r*e;null==i?(i=n+r*Ac,o=n-c/2):(i=ms(a,i),o=ms(a,o),(r>0?i<o:i>o)&&(i+=r*Ac));for(var f,s=i;r>0?s>o:s<o;s-=c)f=mf([a,-u*Cc(s),-u*Fc(s)]),t.point(f[0],f[1])}}function ms(t,n){(n=xf(n))[0]-=t,Sf(n);var e=Bc(-n[1]);return((-n[2]<0?-e:e)+Ac-bc)%Ac}function xs(){var t,n=[];return{point:function(n,e,r){t.push([n,e,r])},lineStart:function(){n.push(t=[])},lineEnd:jc,rejoin:function(){n.length>1&&n.push(n.pop().concat(n.shift()))},result:function(){var e=n;return n=[],t=null,e}}}function ws(t,n){return Ec(t[0]-n[0])<bc&&Ec(t[1]-n[1])<bc}function Ms(t,n,e,r){this.x=t,this.z=n,this.o=e,this.e=r,this.v=!1,this.n=this.p=null}function As(t,n,e,r,i){var o,a,u=[],c=[];if(t.forEach((function(t){if(!((n=t.length-1)<=0)){var n,e,r=t[0],a=t[n];if(ws(r,a)){if(!r[2]&&!a[2]){for(i.lineStart(),o=0;o<n;++o)i.point((r=t[o])[0],r[1]);return void i.lineEnd()}a[0]+=2e-6}u.push(e=new Ms(r,t,null,!0)),c.push(e.o=new Ms(r,null,e,!1)),u.push(e=new Ms(a,t,null,!1)),c.push(e.o=new Ms(a,null,e,!0))}})),u.length){for(c.sort(n),Ts(u),Ts(c),o=0,a=c.length;o<a;++o)c[o].e=e=!e;for(var f,s,l=u[0];;){for(var h=l,d=!0;h.v;)if((h=h.n)===l)return;f=h.z,i.lineStart();do{if(h.v=h.o.v=!0,h.e){if(d)for(o=0,a=f.length;o<a;++o)i.point((s=f[o])[0],s[1]);else r(h.x,h.n.x,1,i);h=h.n}else{if(d)for(f=h.p.z,o=f.length-1;o>=0;--o)i.point((s=f[o])[0],s[1]);else r(h.x,h.p.x,-1,i);h=h.p}f=(h=h.o).z,d=!d}while(!h.v);i.lineEnd()}}}function Ts(t){if(n=t.length){for(var n,e,r=0,i=t[0];++r<n;)i.n=e=t[r],e.p=i,i=e;i.n=e=t[0],e.p=i}}function Ss(t){return Ec(t[0])<=xc?t[0]:Oc(t[0])*((Ec(t[0])+xc)%Ac-xc)}function Es(t,n){var e=Ss(n),r=n[1],i=Fc(r),o=[Fc(e),-Cc(e),0],a=0,u=0,c=new g;1===i?r=wc+bc:-1===i&&(r=-wc-bc);for(var f=0,s=t.length;f<s;++f)if(h=(l=t[f]).length)for(var l,h,d=l[h-1],p=Ss(d),y=d[1]/2+Mc,v=Fc(y),_=Cc(y),b=0;b<h;++b,p=x,v=M,_=A,d=m){var m=l[b],x=Ss(m),w=m[1]/2+Mc,M=Fc(w),A=Cc(w),T=x-p,S=T>=0?1:-1,E=S*T,k=E>xc,N=v*M;if(c.add(Nc(N*S*Fc(E),_*A+N*Cc(E))),a+=k?T+S*Ac:T,k^p>=e^x>=e){var C=Mf(xf(d),xf(m));Sf(C);var P=Mf(o,C);Sf(P);var z=(k^T>=0?-1:1)*Yc(P[2]);(r>z||r===z&&(C[0]||C[1]))&&(u+=k^T>=0?1:-1)}}return(a<-1e-6||a<bc&&c<-1e-12)^1&u}function ks(t,n,e,r){return function(i){var o,a,u,c=n(i),f=xs(),s=n(f),l=!1,h={point:d,lineStart:g,lineEnd:y,polygonStart:function(){h.point=v,h.lineStart=_,h.lineEnd=b,a=[],o=[]},polygonEnd:function(){h.point=d,h.lineStart=g,h.lineEnd=y,a=V(a);var t=Es(o,r);a.length?(l||(i.polygonStart(),l=!0),As(a,Cs,t,e,i)):t&&(l||(i.polygonStart(),l=!0),i.lineStart(),e(null,null,1,i),i.lineEnd()),l&&(i.polygonEnd(),l=!1),a=o=null},sphere:function(){i.polygonStart(),i.lineStart(),e(null,null,1,i),i.lineEnd(),i.polygonEnd()}};function d(n,e){t(n,e)&&i.point(n,e)}function p(t,n){c.point(t,n)}function g(){h.point=p,c.lineStart()}function y(){h.point=d,c.lineEnd()}function v(t,n){u.push([t,n]),s.point(t,n)}function _(){s.lineStart(),u=[]}function b(){v(u[0][0],u[0][1]),s.lineEnd();var t,n,e,r,c=s.clean(),h=f.result(),d=h.length;if(u.pop(),o.push(u),u=null,d)if(1&c){if((n=(e=h[0]).length-1)>0){for(l||(i.polygonStart(),l=!0),i.lineStart(),t=0;t<n;++t)i.point((r=e[t])[0],r[1]);i.lineEnd()}}else d>1&&2&c&&h.push(h.pop().concat(h.shift())),a.push(h.filter(Ns))}return h}}function Ns(t){return t.length>1}function Cs(t,n){return((t=t.x)[0]<0?t[1]-wc-bc:wc-t[1])-((n=n.x)[0]<0?n[1]-wc-bc:wc-n[1])}ds.invert=ds;var Ps=ks((function(){return!0}),(function(t){var n,e=NaN,r=NaN,i=NaN;return{lineStart:function(){t.lineStart(),n=1},point:function(o,a){var u=o>0?xc:-xc,c=Ec(o-e);Ec(c-xc)<bc?(t.point(e,r=(r+a)/2>0?wc:-wc),t.point(i,r),t.lineEnd(),t.lineStart(),t.point(u,r),t.point(o,r),n=0):i!==u&&c>=xc&&(Ec(e-i)<bc&&(e-=i*bc),Ec(o-u)<bc&&(o-=u*bc),r=function(t,n,e,r){var i,o,a=Fc(t-e);return Ec(a)>bc?kc((Fc(n)*(o=Cc(r))*Fc(e)-Fc(r)*(i=Cc(n))*Fc(t))/(i*o*a)):(n+r)/2}(e,r,o,a),t.point(i,r),t.lineEnd(),t.lineStart(),t.point(u,r),n=0),t.point(e=o,r=a),i=u},lineEnd:function(){t.lineEnd(),e=r=NaN},clean:function(){return 2-n}}}),(function(t,n,e,r){var i;if(null==t)i=e*wc,r.point(-xc,i),r.point(0,i),r.point(xc,i),r.point(xc,0),r.point(xc,-i),r.point(0,-i),r.point(-xc,-i),r.point(-xc,0),r.point(-xc,i);else if(Ec(t[0]-n[0])>bc){var o=t[0]<n[0]?xc:-xc;i=e*o/2,r.point(-o,i),r.point(0,i),r.point(o,i)}else r.point(n[0],n[1])}),[-xc,-wc]);function zs(t){var n=Cc(t),e=6*Sc,r=n>0,i=Ec(n)>bc;function o(t,e){return Cc(t)*Cc(e)>n}function a(t,e,r){var i=[1,0,0],o=Mf(xf(t),xf(e)),a=wf(o,o),u=o[0],c=a-u*u;if(!c)return!r&&t;var f=n*a/c,s=-n*u/c,l=Mf(i,o),h=Tf(i,f);Af(h,Tf(o,s));var d=l,p=wf(h,d),g=wf(d,d),y=p*p-g*(wf(h,h)-1);if(!(y<0)){var v=Ic(y),_=Tf(d,(-p-v)/g);if(Af(_,h),_=mf(_),!r)return _;var b,m=t[0],x=e[0],w=t[1],M=e[1];x<m&&(b=m,m=x,x=b);var A=x-m,T=Ec(A-xc)<bc;if(!T&&M<w&&(b=w,w=M,M=b),T||A<bc?T?w+M>0^_[1]<(Ec(_[0]-m)<bc?w:M):w<=_[1]&&_[1]<=M:A>xc^(m<=_[0]&&_[0]<=x)){var S=Tf(d,(-p+v)/g);return Af(S,h),[_,mf(S)]}}}function u(n,e){var i=r?t:xc-t,o=0;return n<-i?o|=1:n>i&&(o|=2),e<-i?o|=4:e>i&&(o|=8),o}return ks(o,(function(t){var n,e,c,f,s;return{lineStart:function(){f=c=!1,s=1},point:function(l,h){var d,p=[l,h],g=o(l,h),y=r?g?0:u(l,h):g?u(l+(l<0?xc:-xc),h):0;if(!n&&(f=c=g)&&t.lineStart(),g!==c&&(!(d=a(n,p))||ws(n,d)||ws(p,d))&&(p[2]=1),g!==c)s=0,g?(t.lineStart(),d=a(p,n),t.point(d[0],d[1])):(d=a(n,p),t.point(d[0],d[1],2),t.lineEnd()),n=d;else if(i&&n&&r^g){var v;y&e||!(v=a(p,n,!0))||(s=0,r?(t.lineStart(),t.point(v[0][0],v[0][1]),t.point(v[1][0],v[1][1]),t.lineEnd()):(t.point(v[1][0],v[1][1]),t.lineEnd(),t.lineStart(),t.point(v[0][0],v[0][1],3)))}!g||n&&ws(n,p)||t.point(p[0],p[1]),n=p,c=g,e=y},lineEnd:function(){c&&t.lineEnd(),n=null},clean:function(){return s|(f&&c)<<1}}}),(function(n,r,i,o){bs(o,t,e,i,n,r)}),r?[0,-t]:[-xc,t-xc])}var Ds,qs,Rs,Fs,Os=1e9,Is=-Os;function Us(t,n,e,r){function i(i,o){return t<=i&&i<=e&&n<=o&&o<=r}function o(i,o,u,f){var s=0,l=0;if(null==i||(s=a(i,u))!==(l=a(o,u))||c(i,o)<0^u>0)do{f.point(0===s||3===s?t:e,s>1?r:n)}while((s=(s+u+4)%4)!==l);else f.point(o[0],o[1])}function a(r,i){return Ec(r[0]-t)<bc?i>0?0:3:Ec(r[0]-e)<bc?i>0?2:1:Ec(r[1]-n)<bc?i>0?1:0:i>0?3:2}function u(t,n){return c(t.x,n.x)}function c(t,n){var e=a(t,1),r=a(n,1);return e!==r?e-r:0===e?n[1]-t[1]:1===e?t[0]-n[0]:2===e?t[1]-n[1]:n[0]-t[0]}return function(a){var c,f,s,l,h,d,p,g,y,v,_,b=a,m=xs(),x={point:w,lineStart:function(){x.point=M,f&&f.push(s=[]);v=!0,y=!1,p=g=NaN},lineEnd:function(){c&&(M(l,h),d&&y&&m.rejoin(),c.push(m.result()));x.point=w,y&&b.lineEnd()},polygonStart:function(){b=m,c=[],f=[],_=!0},polygonEnd:function(){var n=function(){for(var n=0,e=0,i=f.length;e<i;++e)for(var o,a,u=f[e],c=1,s=u.length,l=u[0],h=l[0],d=l[1];c<s;++c)o=h,a=d,h=(l=u[c])[0],d=l[1],a<=r?d>r&&(h-o)*(r-a)>(d-a)*(t-o)&&++n:d<=r&&(h-o)*(r-a)<(d-a)*(t-o)&&--n;return n}(),e=_&&n,i=(c=V(c)).length;(e||i)&&(a.polygonStart(),e&&(a.lineStart(),o(null,null,1,a),a.lineEnd()),i&&As(c,u,n,o,a),a.polygonEnd());b=a,c=f=s=null}};function w(t,n){i(t,n)&&b.point(t,n)}function M(o,a){var u=i(o,a);if(f&&s.push([o,a]),v)l=o,h=a,d=u,v=!1,u&&(b.lineStart(),b.point(o,a));else if(u&&y)b.point(o,a);else{var c=[p=Math.max(Is,Math.min(Os,p)),g=Math.max(Is,Math.min(Os,g))],m=[o=Math.max(Is,Math.min(Os,o)),a=Math.max(Is,Math.min(Os,a))];!function(t,n,e,r,i,o){var a,u=t[0],c=t[1],f=0,s=1,l=n[0]-u,h=n[1]-c;if(a=e-u,l||!(a>0)){if(a/=l,l<0){if(a<f)return;a<s&&(s=a)}else if(l>0){if(a>s)return;a>f&&(f=a)}if(a=i-u,l||!(a<0)){if(a/=l,l<0){if(a>s)return;a>f&&(f=a)}else if(l>0){if(a<f)return;a<s&&(s=a)}if(a=r-c,h||!(a>0)){if(a/=h,h<0){if(a<f)return;a<s&&(s=a)}else if(h>0){if(a>s)return;a>f&&(f=a)}if(a=o-c,h||!(a<0)){if(a/=h,h<0){if(a>s)return;a>f&&(f=a)}else if(h>0){if(a<f)return;a<s&&(s=a)}return f>0&&(t[0]=u+f*l,t[1]=c+f*h),s<1&&(n[0]=u+s*l,n[1]=c+s*h),!0}}}}}(c,m,t,n,e,r)?u&&(b.lineStart(),b.point(o,a),_=!1):(y||(b.lineStart(),b.point(c[0],c[1])),b.point(m[0],m[1]),u||b.lineEnd(),_=!1)}p=o,g=a,y=u}return x}}var Bs={sphere:jc,point:jc,lineStart:function(){Bs.point=Ls,Bs.lineEnd=Ys},lineEnd:jc,polygonStart:jc,polygonEnd:jc};function Ys(){Bs.point=Bs.lineEnd=jc}function Ls(t,n){qs=t*=Sc,Rs=Fc(n*=Sc),Fs=Cc(n),Bs.point=js}function js(t,n){t*=Sc;var e=Fc(n*=Sc),r=Cc(n),i=Ec(t-qs),o=Cc(i),a=r*Fc(i),u=Fs*e-Rs*r*o,c=Rs*e+Fs*r*o;Ds.add(Nc(Ic(a*a+u*u),c)),qs=t,Rs=e,Fs=r}function Hs(t){return Ds=new g,Wc(t,Bs),+Ds}var Xs=[null,null],Gs={type:"LineString",coordinates:Xs};function Vs(t,n){return Xs[0]=t,Xs[1]=n,Hs(Gs)}var $s={Feature:function(t,n){return Zs(t.geometry,n)},FeatureCollection:function(t,n){for(var e=t.features,r=-1,i=e.length;++r<i;)if(Zs(e[r].geometry,n))return!0;return!1}},Ws={Sphere:function(){return!0},Point:function(t,n){return Ks(t.coordinates,n)},MultiPoint:function(t,n){for(var e=t.coordinates,r=-1,i=e.length;++r<i;)if(Ks(e[r],n))return!0;return!1},LineString:function(t,n){return Qs(t.coordinates,n)},MultiLineString:function(t,n){for(var e=t.coordinates,r=-1,i=e.length;++r<i;)if(Qs(e[r],n))return!0;return!1},Polygon:function(t,n){return Js(t.coordinates,n)},MultiPolygon:function(t,n){for(var e=t.coordinates,r=-1,i=e.length;++r<i;)if(Js(e[r],n))return!0;return!1},GeometryCollection:function(t,n){for(var e=t.geometries,r=-1,i=e.length;++r<i;)if(Zs(e[r],n))return!0;return!1}};function Zs(t,n){return!(!t||!Ws.hasOwnProperty(t.type))&&Ws[t.type](t,n)}function Ks(t,n){return 0===Vs(t,n)}function Qs(t,n){for(var e,r,i,o=0,a=t.length;o<a;o++){if(0===(r=Vs(t[o],n)))return!0;if(o>0&&(i=Vs(t[o],t[o-1]))>0&&e<=i&&r<=i&&(e+r-i)*(1-Math.pow((e-r)/i,2))<mc*i)return!0;e=r}return!1}function Js(t,n){return!!Es(t.map(tl),nl(n))}function tl(t){return(t=t.map(nl)).pop(),t}function nl(t){return[t[0]*Sc,t[1]*Sc]}function el(t,n,e){var r=Z(t,n-bc,e).concat(n);return function(t){return r.map((function(n){return[t,n]}))}}function rl(t,n,e){var r=Z(t,n-bc,e).concat(n);return function(t){return r.map((function(n){return[n,t]}))}}function il(){var t,n,e,r,i,o,a,u,c,f,s,l,h=10,d=h,p=90,g=360,y=2.5;function v(){return{type:"MultiLineString",coordinates:_()}}function _(){return Z(Pc(r/p)*p,e,p).map(s).concat(Z(Pc(u/g)*g,a,g).map(l)).concat(Z(Pc(n/h)*h,t,h).filter((function(t){return Ec(t%p)>bc})).map(c)).concat(Z(Pc(o/d)*d,i,d).filter((function(t){return Ec(t%g)>bc})).map(f))}return v.lines=function(){return _().map((function(t){return{type:"LineString",coordinates:t}}))},v.outline=function(){return{type:"Polygon",coordinates:[s(r).concat(l(a).slice(1),s(e).reverse().slice(1),l(u).reverse().slice(1))]}},v.extent=function(t){return arguments.length?v.extentMajor(t).extentMinor(t):v.extentMinor()},v.extentMajor=function(t){return arguments.length?(r=+t[0][0],e=+t[1][0],u=+t[0][1],a=+t[1][1],r>e&&(t=r,r=e,e=t),u>a&&(t=u,u=a,a=t),v.precision(y)):[[r,u],[e,a]]},v.extentMinor=function(e){return arguments.length?(n=+e[0][0],t=+e[1][0],o=+e[0][1],i=+e[1][1],n>t&&(e=n,n=t,t=e),o>i&&(e=o,o=i,i=e),v.precision(y)):[[n,o],[t,i]]},v.step=function(t){return arguments.length?v.stepMajor(t).stepMinor(t):v.stepMinor()},v.stepMajor=function(t){return arguments.length?(p=+t[0],g=+t[1],v):[p,g]},v.stepMinor=function(t){return arguments.length?(h=+t[0],d=+t[1],v):[h,d]},v.precision=function(h){return arguments.length?(y=+h,c=el(o,i,90),f=rl(n,t,y),s=el(u,a,90),l=rl(r,e,y),v):y},v.extentMajor([[-180,-89.999999],[180,89.999999]]).extentMinor([[-180,-80.000001],[180,80.000001]])}var ol,al,ul,cl,fl=t=>t,sl=new g,ll=new g,hl={point:jc,lineStart:jc,lineEnd:jc,polygonStart:function(){hl.lineStart=dl,hl.lineEnd=yl},polygonEnd:function(){hl.lineStart=hl.lineEnd=hl.point=jc,sl.add(Ec(ll)),ll=new g},result:function(){var t=sl/2;return sl=new g,t}};function dl(){hl.point=pl}function pl(t,n){hl.point=gl,ol=ul=t,al=cl=n}function gl(t,n){ll.add(cl*t-ul*n),ul=t,cl=n}function yl(){gl(ol,al)}var vl=1/0,_l=vl,bl=-vl,ml=bl,xl={point:function(t,n){t<vl&&(vl=t);t>bl&&(bl=t);n<_l&&(_l=n);n>ml&&(ml=n)},lineStart:jc,lineEnd:jc,polygonStart:jc,polygonEnd:jc,result:function(){var t=[[vl,_l],[bl,ml]];return bl=ml=-(_l=vl=1/0),t}};var wl,Ml,Al,Tl,Sl=0,El=0,kl=0,Nl=0,Cl=0,Pl=0,zl=0,Dl=0,ql=0,Rl={point:Fl,lineStart:Ol,lineEnd:Bl,polygonStart:function(){Rl.lineStart=Yl,Rl.lineEnd=Ll},polygonEnd:function(){Rl.point=Fl,Rl.lineStart=Ol,Rl.lineEnd=Bl},result:function(){var t=ql?[zl/ql,Dl/ql]:Pl?[Nl/Pl,Cl/Pl]:kl?[Sl/kl,El/kl]:[NaN,NaN];return Sl=El=kl=Nl=Cl=Pl=zl=Dl=ql=0,t}};function Fl(t,n){Sl+=t,El+=n,++kl}function Ol(){Rl.point=Il}function Il(t,n){Rl.point=Ul,Fl(Al=t,Tl=n)}function Ul(t,n){var e=t-Al,r=n-Tl,i=Ic(e*e+r*r);Nl+=i*(Al+t)/2,Cl+=i*(Tl+n)/2,Pl+=i,Fl(Al=t,Tl=n)}function Bl(){Rl.point=Fl}function Yl(){Rl.point=jl}function Ll(){Hl(wl,Ml)}function jl(t,n){Rl.point=Hl,Fl(wl=Al=t,Ml=Tl=n)}function Hl(t,n){var e=t-Al,r=n-Tl,i=Ic(e*e+r*r);Nl+=i*(Al+t)/2,Cl+=i*(Tl+n)/2,Pl+=i,zl+=(i=Tl*t-Al*n)*(Al+t),Dl+=i*(Tl+n),ql+=3*i,Fl(Al=t,Tl=n)}function Xl(t){this._context=t}Xl.prototype={_radius:4.5,pointRadius:function(t){return this._radius=t,this},polygonStart:function(){this._line=0},polygonEnd:function(){this._line=NaN},lineStart:function(){this._point=0},lineEnd:function(){0===this._line&&this._context.closePath(),this._point=NaN},point:function(t,n){switch(this._point){case 0:this._context.moveTo(t,n),this._point=1;break;case 1:this._context.lineTo(t,n);break;default:this._context.moveTo(t+this._radius,n),this._context.arc(t,n,this._radius,0,Ac)}},result:jc};var Gl,Vl,$l,Wl,Zl,Kl=new g,Ql={point:jc,lineStart:function(){Ql.point=Jl},lineEnd:function(){Gl&&th(Vl,$l),Ql.point=jc},polygonStart:function(){Gl=!0},polygonEnd:function(){Gl=null},result:function(){var t=+Kl;return Kl=new g,t}};function Jl(t,n){Ql.point=th,Vl=Wl=t,$l=Zl=n}function th(t,n){Wl-=t,Zl-=n,Kl.add(Ic(Wl*Wl+Zl*Zl)),Wl=t,Zl=n}function nh(){this._string=[]}function eh(t){return"m0,"+t+"a"+t+","+t+" 0 1,1 0,"+-2*t+"a"+t+","+t+" 0 1,1 0,"+2*t+"z"}function rh(t){return function(n){var e=new ih;for(var r in t)e[r]=t[r];return e.stream=n,e}}function ih(){}function oh(t,n,e){var r=t.clipExtent&&t.clipExtent();return t.scale(150).translate([0,0]),null!=r&&t.clipExtent(null),Wc(e,t.stream(xl)),n(xl.result()),null!=r&&t.clipExtent(r),t}function ah(t,n,e){return oh(t,(function(e){var r=n[1][0]-n[0][0],i=n[1][1]-n[0][1],o=Math.min(r/(e[1][0]-e[0][0]),i/(e[1][1]-e[0][1])),a=+n[0][0]+(r-o*(e[1][0]+e[0][0]))/2,u=+n[0][1]+(i-o*(e[1][1]+e[0][1]))/2;t.scale(150*o).translate([a,u])}),e)}function uh(t,n,e){return ah(t,[[0,0],n],e)}function ch(t,n,e){return oh(t,(function(e){var r=+n,i=r/(e[1][0]-e[0][0]),o=(r-i*(e[1][0]+e[0][0]))/2,a=-i*e[0][1];t.scale(150*i).translate([o,a])}),e)}function fh(t,n,e){return oh(t,(function(e){var r=+n,i=r/(e[1][1]-e[0][1]),o=-i*e[0][0],a=(r-i*(e[1][1]+e[0][1]))/2;t.scale(150*i).translate([o,a])}),e)}nh.prototype={_radius:4.5,_circle:eh(4.5),pointRadius:function(t){return(t=+t)!==this._radius&&(this._radius=t,this._circle=null),this},polygonStart:function(){this._line=0},polygonEnd:function(){this._line=NaN},lineStart:function(){this._point=0},lineEnd:function(){0===this._line&&this._string.push("Z"),this._point=NaN},point:function(t,n){switch(this._point){case 0:this._string.push("M",t,",",n),this._point=1;break;case 1:this._string.push("L",t,",",n);break;default:null==this._circle&&(this._circle=eh(this._radius)),this._string.push("M",t,",",n,this._circle)}},result:function(){if(this._string.length){var t=this._string.join("");return this._string=[],t}return null}},ih.prototype={constructor:ih,point:function(t,n){this.stream.point(t,n)},sphere:function(){this.stream.sphere()},lineStart:function(){this.stream.lineStart()},lineEnd:function(){this.stream.lineEnd()},polygonStart:function(){this.stream.polygonStart()},polygonEnd:function(){this.stream.polygonEnd()}};var sh=Cc(30*Sc);function lh(t,n){return+n?function(t,n){function e(r,i,o,a,u,c,f,s,l,h,d,p,g,y){var v=f-r,_=s-i,b=v*v+_*_;if(b>4*n&&g--){var m=a+h,x=u+d,w=c+p,M=Ic(m*m+x*x+w*w),A=Yc(w/=M),T=Ec(Ec(w)-1)<bc||Ec(o-l)<bc?(o+l)/2:Nc(x,m),S=t(T,A),E=S[0],k=S[1],N=E-r,C=k-i,P=_*N-v*C;(P*P/b>n||Ec((v*N+_*C)/b-.5)>.3||a*h+u*d+c*p<sh)&&(e(r,i,o,a,u,c,E,k,T,m/=M,x/=M,w,g,y),y.point(E,k),e(E,k,T,m,x,w,f,s,l,h,d,p,g,y))}}return function(n){var r,i,o,a,u,c,f,s,l,h,d,p,g={point:y,lineStart:v,lineEnd:b,polygonStart:function(){n.polygonStart(),g.lineStart=m},polygonEnd:function(){n.polygonEnd(),g.lineStart=v}};function y(e,r){e=t(e,r),n.point(e[0],e[1])}function v(){s=NaN,g.point=_,n.lineStart()}function _(r,i){var o=xf([r,i]),a=t(r,i);e(s,l,f,h,d,p,s=a[0],l=a[1],f=r,h=o[0],d=o[1],p=o[2],16,n),n.point(s,l)}function b(){g.point=y,n.lineEnd()}function m(){v(),g.point=x,g.lineEnd=w}function x(t,n){_(r=t,n),i=s,o=l,a=h,u=d,c=p,g.point=_}function w(){e(s,l,f,h,d,p,i,o,r,a,u,c,16,n),g.lineEnd=b,b()}return g}}(t,n):function(t){return rh({point:function(n,e){n=t(n,e),this.stream.point(n[0],n[1])}})}(t)}var hh=rh({point:function(t,n){this.stream.point(t*Sc,n*Sc)}});function dh(t,n,e,r,i,o){if(!o)return function(t,n,e,r,i){function o(o,a){return[n+t*(o*=r),e-t*(a*=i)]}return o.invert=function(o,a){return[(o-n)/t*r,(e-a)/t*i]},o}(t,n,e,r,i);var a=Cc(o),u=Fc(o),c=a*t,f=u*t,s=a/t,l=u/t,h=(u*e-a*n)/t,d=(u*n+a*e)/t;function p(t,o){return[c*(t*=r)-f*(o*=i)+n,e-f*t-c*o]}return p.invert=function(t,n){return[r*(s*t-l*n+h),i*(d-l*t-s*n)]},p}function ph(t){return gh((function(){return t}))()}function gh(t){var n,e,r,i,o,a,u,c,f,s,l=150,h=480,d=250,p=0,g=0,y=0,v=0,_=0,b=0,m=1,x=1,w=null,M=Ps,A=null,T=fl,S=.5;function E(t){return c(t[0]*Sc,t[1]*Sc)}function k(t){return(t=c.invert(t[0],t[1]))&&[t[0]*Tc,t[1]*Tc]}function N(){var t=dh(l,0,0,m,x,b).apply(null,n(p,g)),r=dh(l,h-t[0],d-t[1],m,x,b);return e=ps(y,v,_),u=hs(n,r),c=hs(e,u),a=lh(u,S),C()}function C(){return f=s=null,E}return E.stream=function(t){return f&&s===t?f:f=hh(function(t){return rh({point:function(n,e){var r=t(n,e);return this.stream.point(r[0],r[1])}})}(e)(M(a(T(s=t)))))},E.preclip=function(t){return arguments.length?(M=t,w=void 0,C()):M},E.postclip=function(t){return arguments.length?(T=t,A=r=i=o=null,C()):T},E.clipAngle=function(t){return arguments.length?(M=+t?zs(w=t*Sc):(w=null,Ps),C()):w*Tc},E.clipExtent=function(t){return arguments.length?(T=null==t?(A=r=i=o=null,fl):Us(A=+t[0][0],r=+t[0][1],i=+t[1][0],o=+t[1][1]),C()):null==A?null:[[A,r],[i,o]]},E.scale=function(t){return arguments.length?(l=+t,N()):l},E.translate=function(t){return arguments.length?(h=+t[0],d=+t[1],N()):[h,d]},E.center=function(t){return arguments.length?(p=t[0]%360*Sc,g=t[1]%360*Sc,N()):[p*Tc,g*Tc]},E.rotate=function(t){return arguments.length?(y=t[0]%360*Sc,v=t[1]%360*Sc,_=t.length>2?t[2]%360*Sc:0,N()):[y*Tc,v*Tc,_*Tc]},E.angle=function(t){return arguments.length?(b=t%360*Sc,N()):b*Tc},E.reflectX=function(t){return arguments.length?(m=t?-1:1,N()):m<0},E.reflectY=function(t){return arguments.length?(x=t?-1:1,N()):x<0},E.precision=function(t){return arguments.length?(a=lh(u,S=t*t),C()):Ic(S)},E.fitExtent=function(t,n){return ah(E,t,n)},E.fitSize=function(t,n){return uh(E,t,n)},E.fitWidth=function(t,n){return ch(E,t,n)},E.fitHeight=function(t,n){return fh(E,t,n)},function(){return n=t.apply(this,arguments),E.invert=n.invert&&k,N()}}function yh(t){var n=0,e=xc/3,r=gh(t),i=r(n,e);return i.parallels=function(t){return arguments.length?r(n=t[0]*Sc,e=t[1]*Sc):[n*Tc,e*Tc]},i}function vh(t,n){var e=Fc(t),r=(e+Fc(n))/2;if(Ec(r)<bc)return function(t){var n=Cc(t);function e(t,e){return[t*n,Fc(e)/n]}return e.invert=function(t,e){return[t/n,Yc(e*n)]},e}(t);var i=1+e*(2*r-e),o=Ic(i)/r;function a(t,n){var e=Ic(i-2*r*Fc(n))/r;return[e*Fc(t*=r),o-e*Cc(t)]}return a.invert=function(t,n){var e=o-n,a=Nc(t,Ec(e))*Oc(e);return e*r<0&&(a-=xc*Oc(t)*Oc(e)),[a/r,Yc((i-(t*t+e*e)*r*r)/(2*r))]},a}function _h(){return yh(vh).scale(155.424).center([0,33.6442])}function bh(){return _h().parallels([29.5,45.5]).scale(1070).translate([480,250]).rotate([96,0]).center([-.6,38.7])}function mh(t){return function(n,e){var r=Cc(n),i=Cc(e),o=t(r*i);return o===1/0?[2,0]:[o*i*Fc(n),o*Fc(e)]}}function xh(t){return function(n,e){var r=Ic(n*n+e*e),i=t(r),o=Fc(i),a=Cc(i);return[Nc(n*o,r*a),Yc(r&&e*o/r)]}}var wh=mh((function(t){return Ic(2/(1+t))}));wh.invert=xh((function(t){return 2*Yc(t/2)}));var Mh=mh((function(t){return(t=Bc(t))&&t/Fc(t)}));function Ah(t,n){return[t,qc(Uc((wc+n)/2))]}function Th(t){var n,e,r,i=ph(t),o=i.center,a=i.scale,u=i.translate,c=i.clipExtent,f=null;function s(){var o=xc*a(),u=i(_s(i.rotate()).invert([0,0]));return c(null==f?[[u[0]-o,u[1]-o],[u[0]+o,u[1]+o]]:t===Ah?[[Math.max(u[0]-o,f),n],[Math.min(u[0]+o,e),r]]:[[f,Math.max(u[1]-o,n)],[e,Math.min(u[1]+o,r)]])}return i.scale=function(t){return arguments.length?(a(t),s()):a()},i.translate=function(t){return arguments.length?(u(t),s()):u()},i.center=function(t){return arguments.length?(o(t),s()):o()},i.clipExtent=function(t){return arguments.length?(null==t?f=n=e=r=null:(f=+t[0][0],n=+t[0][1],e=+t[1][0],r=+t[1][1]),s()):null==f?null:[[f,n],[e,r]]},s()}function Sh(t){return Uc((wc+t)/2)}function Eh(t,n){var e=Cc(t),r=t===n?Fc(t):qc(e/Cc(n))/qc(Sh(n)/Sh(t)),i=e*Rc(Sh(t),r)/r;if(!r)return Ah;function o(t,n){i>0?n<-wc+bc&&(n=-wc+bc):n>wc-bc&&(n=wc-bc);var e=i/Rc(Sh(n),r);return[e*Fc(r*t),i-e*Cc(r*t)]}return o.invert=function(t,n){var e=i-n,o=Oc(r)*Ic(t*t+e*e),a=Nc(t,Ec(e))*Oc(e);return e*r<0&&(a-=xc*Oc(t)*Oc(e)),[a/r,2*kc(Rc(i/o,1/r))-wc]},o}function kh(t,n){return[t,n]}function Nh(t,n){var e=Cc(t),r=t===n?Fc(t):(e-Cc(n))/(n-t),i=e/r+t;if(Ec(r)<bc)return kh;function o(t,n){var e=i-n,o=r*t;return[e*Fc(o),i-e*Cc(o)]}return o.invert=function(t,n){var e=i-n,o=Nc(t,Ec(e))*Oc(e);return e*r<0&&(o-=xc*Oc(t)*Oc(e)),[o/r,i-Oc(r)*Ic(t*t+e*e)]},o}Mh.invert=xh((function(t){return t})),Ah.invert=function(t,n){return[t,2*kc(zc(n))-wc]},kh.invert=kh;var Ch=1.340264,Ph=-.081106,zh=893e-6,Dh=.003796,qh=Ic(3)/2;function Rh(t,n){var e=Yc(qh*Fc(n)),r=e*e,i=r*r*r;return[t*Cc(e)/(qh*(Ch+3*Ph*r+i*(7*zh+9*Dh*r))),e*(Ch+Ph*r+i*(zh+Dh*r))]}function Fh(t,n){var e=Cc(n),r=Cc(t)*e;return[e*Fc(t)/r,Fc(n)/r]}function Oh(t,n){var e=n*n,r=e*e;return[t*(.8707-.131979*e+r*(r*(.003971*e-.001529*r)-.013791)),n*(1.007226+e*(.015085+r*(.028874*e-.044475-.005916*r)))]}function Ih(t,n){return[Cc(n)*Fc(t),Fc(n)]}function Uh(t,n){var e=Cc(n),r=1+Cc(t)*e;return[e*Fc(t)/r,Fc(n)/r]}function Bh(t,n){return[qc(Uc((wc+n)/2)),-t]}function Yh(t,n){return t.parent===n.parent?1:2}function Lh(t,n){return t+n.x}function jh(t,n){return Math.max(t,n.y)}function Hh(t){var n=0,e=t.children,r=e&&e.length;if(r)for(;--r>=0;)n+=e[r].value;else n=1;t.value=n}function Xh(t,n){t instanceof Map?(t=[void 0,t],void 0===n&&(n=Vh)):void 0===n&&(n=Gh);for(var e,r,i,o,a,u=new Zh(t),c=[u];e=c.pop();)if((i=n(e.data))&&(a=(i=Array.from(i)).length))for(e.children=i,o=a-1;o>=0;--o)c.push(r=i[o]=new Zh(i[o])),r.parent=e,r.depth=e.depth+1;return u.eachBefore(Wh)}function Gh(t){return t.children}function Vh(t){return Array.isArray(t)?t[1]:null}function $h(t){void 0!==t.data.value&&(t.value=t.data.value),t.data=t.data.data}function Wh(t){var n=0;do{t.height=n}while((t=t.parent)&&t.height<++n)}function Zh(t){this.data=t,this.depth=this.height=0,this.parent=null}function Kh(t){for(var n,e,r=0,i=(t=function(t){for(var n,e,r=t.length;r;)e=Math.random()*r--|0,n=t[r],t[r]=t[e],t[e]=n;return t}(Array.from(t))).length,o=[];r<i;)n=t[r],e&&td(e,n)?++r:(e=ed(o=Qh(o,n)),r=0);return e}function Qh(t,n){var e,r;if(nd(n,t))return[n];for(e=0;e<t.length;++e)if(Jh(n,t[e])&&nd(rd(t[e],n),t))return[t[e],n];for(e=0;e<t.length-1;++e)for(r=e+1;r<t.length;++r)if(Jh(rd(t[e],t[r]),n)&&Jh(rd(t[e],n),t[r])&&Jh(rd(t[r],n),t[e])&&nd(id(t[e],t[r],n),t))return[t[e],t[r],n];throw new Error}function Jh(t,n){var e=t.r-n.r,r=n.x-t.x,i=n.y-t.y;return e<0||e*e<r*r+i*i}function td(t,n){var e=t.r-n.r+1e-9*Math.max(t.r,n.r,1),r=n.x-t.x,i=n.y-t.y;return e>0&&e*e>r*r+i*i}function nd(t,n){for(var e=0;e<n.length;++e)if(!td(t,n[e]))return!1;return!0}function ed(t){switch(t.length){case 1:return function(t){return{x:t.x,y:t.y,r:t.r}}(t[0]);case 2:return rd(t[0],t[1]);case 3:return id(t[0],t[1],t[2])}}function rd(t,n){var e=t.x,r=t.y,i=t.r,o=n.x,a=n.y,u=n.r,c=o-e,f=a-r,s=u-i,l=Math.sqrt(c*c+f*f);return{x:(e+o+c/l*s)/2,y:(r+a+f/l*s)/2,r:(l+i+u)/2}}function id(t,n,e){var r=t.x,i=t.y,o=t.r,a=n.x,u=n.y,c=n.r,f=e.x,s=e.y,l=e.r,h=r-a,d=r-f,p=i-u,g=i-s,y=c-o,v=l-o,_=r*r+i*i-o*o,b=_-a*a-u*u+c*c,m=_-f*f-s*s+l*l,x=d*p-h*g,w=(p*m-g*b)/(2*x)-r,M=(g*y-p*v)/x,A=(d*b-h*m)/(2*x)-i,T=(h*v-d*y)/x,S=M*M+T*T-1,E=2*(o+w*M+A*T),k=w*w+A*A-o*o,N=-(S?(E+Math.sqrt(E*E-4*S*k))/(2*S):k/E);return{x:r+w+M*N,y:i+A+T*N,r:N}}function od(t,n,e){var r,i,o,a,u=t.x-n.x,c=t.y-n.y,f=u*u+c*c;f?(i=n.r+e.r,i*=i,a=t.r+e.r,i>(a*=a)?(r=(f+a-i)/(2*f),o=Math.sqrt(Math.max(0,a/f-r*r)),e.x=t.x-r*u-o*c,e.y=t.y-r*c+o*u):(r=(f+i-a)/(2*f),o=Math.sqrt(Math.max(0,i/f-r*r)),e.x=n.x+r*u-o*c,e.y=n.y+r*c+o*u)):(e.x=n.x+e.r,e.y=n.y)}function ad(t,n){var e=t.r+n.r-1e-6,r=n.x-t.x,i=n.y-t.y;return e>0&&e*e>r*r+i*i}function ud(t){var n=t._,e=t.next._,r=n.r+e.r,i=(n.x*e.r+e.x*n.r)/r,o=(n.y*e.r+e.y*n.r)/r;return i*i+o*o}function cd(t){this._=t,this.next=null,this.previous=null}function fd(t){if(!(i=(t=function(t){return"object"==typeof t&&"length"in t?t:Array.from(t)}(t)).length))return 0;var n,e,r,i,o,a,u,c,f,s,l;if((n=t[0]).x=0,n.y=0,!(i>1))return n.r;if(e=t[1],n.x=-e.r,e.x=n.r,e.y=0,!(i>2))return n.r+e.r;od(e,n,r=t[2]),n=new cd(n),e=new cd(e),r=new cd(r),n.next=r.previous=e,e.next=n.previous=r,r.next=e.previous=n;t:for(u=3;u<i;++u){od(n._,e._,r=t[u]),r=new cd(r),c=e.next,f=n.previous,s=e._.r,l=n._.r;do{if(s<=l){if(ad(c._,r._)){e=c,n.next=e,e.previous=n,--u;continue t}s+=c._.r,c=c.next}else{if(ad(f._,r._)){(n=f).next=e,e.previous=n,--u;continue t}l+=f._.r,f=f.previous}}while(c!==f.next);for(r.previous=n,r.next=e,n.next=e.previous=e=r,o=ud(n);(r=r.next)!==e;)(a=ud(r))<o&&(n=r,o=a);e=n.next}for(n=[e._],r=e;(r=r.next)!==e;)n.push(r._);for(r=Kh(n),u=0;u<i;++u)(n=t[u]).x-=r.x,n.y-=r.y;return r.r}function sd(t){return null==t?null:ld(t)}function ld(t){if("function"!=typeof t)throw new Error;return t}function hd(){return 0}function dd(t){return function(){return t}}function pd(t){return Math.sqrt(t.value)}function gd(t){return function(n){n.children||(n.r=Math.max(0,+t(n)||0))}}function yd(t,n){return function(e){if(r=e.children){var r,i,o,a=r.length,u=t(e)*n||0;if(u)for(i=0;i<a;++i)r[i].r+=u;if(o=fd(r),u)for(i=0;i<a;++i)r[i].r-=u;e.r=o+u}}}function vd(t){return function(n){var e=n.parent;n.r*=t,e&&(n.x=e.x+t*n.x,n.y=e.y+t*n.y)}}function _d(t){t.x0=Math.round(t.x0),t.y0=Math.round(t.y0),t.x1=Math.round(t.x1),t.y1=Math.round(t.y1)}function bd(t,n,e,r,i){for(var o,a=t.children,u=-1,c=a.length,f=t.value&&(r-n)/t.value;++u<c;)(o=a[u]).y0=e,o.y1=i,o.x0=n,o.x1=n+=o.value*f}Rh.invert=function(t,n){for(var e,r=n,i=r*r,o=i*i*i,a=0;a<12&&(o=(i=(r-=e=(r*(Ch+Ph*i+o*(zh+Dh*i))-n)/(Ch+3*Ph*i+o*(7*zh+9*Dh*i)))*r)*i*i,!(Ec(e)<mc));++a);return[qh*t*(Ch+3*Ph*i+o*(7*zh+9*Dh*i))/Cc(r),Yc(Fc(r)/qh)]},Fh.invert=xh(kc),Oh.invert=function(t,n){var e,r=n,i=25;do{var o=r*r,a=o*o;r-=e=(r*(1.007226+o*(.015085+a*(.028874*o-.044475-.005916*a)))-n)/(1.007226+o*(.045255+a*(.259866*o-.311325-.005916*11*a)))}while(Ec(e)>bc&&--i>0);return[t/(.8707+(o=r*r)*(o*(o*o*o*(.003971-.001529*o)-.013791)-.131979)),r]},Ih.invert=xh(Yc),Uh.invert=xh((function(t){return 2*kc(t)})),Bh.invert=function(t,n){return[-n,2*kc(zc(t))-wc]},Zh.prototype=Xh.prototype={constructor:Zh,count:function(){return this.eachAfter(Hh)},each:function(t,n){let e=-1;for(const r of this)t.call(n,r,++e,this);return this},eachAfter:function(t,n){for(var e,r,i,o=this,a=[o],u=[],c=-1;o=a.pop();)if(u.push(o),e=o.children)for(r=0,i=e.length;r<i;++r)a.push(e[r]);for(;o=u.pop();)t.call(n,o,++c,this);return this},eachBefore:function(t,n){for(var e,r,i=this,o=[i],a=-1;i=o.pop();)if(t.call(n,i,++a,this),e=i.children)for(r=e.length-1;r>=0;--r)o.push(e[r]);return this},find:function(t,n){let e=-1;for(const r of this)if(t.call(n,r,++e,this))return r},sum:function(t){return this.eachAfter((function(n){for(var e=+t(n.data)||0,r=n.children,i=r&&r.length;--i>=0;)e+=r[i].value;n.value=e}))},sort:function(t){return this.eachBefore((function(n){n.children&&n.children.sort(t)}))},path:function(t){for(var n=this,e=function(t,n){if(t===n)return t;var e=t.ancestors(),r=n.ancestors(),i=null;t=e.pop(),n=r.pop();for(;t===n;)i=t,t=e.pop(),n=r.pop();return i}(n,t),r=[n];n!==e;)n=n.parent,r.push(n);for(var i=r.length;t!==e;)r.splice(i,0,t),t=t.parent;return r},ancestors:function(){for(var t=this,n=[t];t=t.parent;)n.push(t);return n},descendants:function(){return Array.from(this)},leaves:function(){var t=[];return this.eachBefore((function(n){n.children||t.push(n)})),t},links:function(){var t=this,n=[];return t.each((function(e){e!==t&&n.push({source:e.parent,target:e})})),n},copy:function(){return Xh(this).eachBefore($h)},[Symbol.iterator]:function*(){var t,n,e,r,i=this,o=[i];do{for(t=o.reverse(),o=[];i=t.pop();)if(yield i,n=i.children)for(e=0,r=n.length;e<r;++e)o.push(n[e])}while(o.length)}};var md={depth:-1},xd={};function wd(t){return t.id}function Md(t){return t.parentId}function Ad(t,n){return t.parent===n.parent?1:2}function Td(t){var n=t.children;return n?n[0]:t.t}function Sd(t){var n=t.children;return n?n[n.length-1]:t.t}function Ed(t,n,e){var r=e/(n.i-t.i);n.c-=r,n.s+=e,t.c+=r,n.z+=e,n.m+=e}function kd(t,n,e){return t.a.parent===n.parent?t.a:e}function Nd(t,n){this._=t,this.parent=null,this.children=null,this.A=null,this.a=this,this.z=0,this.m=0,this.c=0,this.s=0,this.t=null,this.i=n}function Cd(t,n,e,r,i){for(var o,a=t.children,u=-1,c=a.length,f=t.value&&(i-e)/t.value;++u<c;)(o=a[u]).x0=n,o.x1=r,o.y0=e,o.y1=e+=o.value*f}Nd.prototype=Object.create(Zh.prototype);var Pd=(1+Math.sqrt(5))/2;function zd(t,n,e,r,i,o){for(var a,u,c,f,s,l,h,d,p,g,y,v=[],_=n.children,b=0,m=0,x=_.length,w=n.value;b<x;){c=i-e,f=o-r;do{s=_[m++].value}while(!s&&m<x);for(l=h=s,y=s*s*(g=Math.max(f/c,c/f)/(w*t)),p=Math.max(h/y,y/l);m<x;++m){if(s+=u=_[m].value,u<l&&(l=u),u>h&&(h=u),y=s*s*g,(d=Math.max(h/y,y/l))>p){s-=u;break}p=d}v.push(a={value:s,dice:c<f,children:_.slice(b,m)}),a.dice?bd(a,e,r,i,w?r+=f*s/w:o):Cd(a,e,r,w?e+=c*s/w:i,o),w-=s,b=m}return v}var Dd=function t(n){function e(t,e,r,i,o){zd(n,t,e,r,i,o)}return e.ratio=function(n){return t((n=+n)>1?n:1)},e}(Pd);var qd=function t(n){function e(t,e,r,i,o){if((a=t._squarify)&&a.ratio===n)for(var a,u,c,f,s,l=-1,h=a.length,d=t.value;++l<h;){for(c=(u=a[l]).children,f=u.value=0,s=c.length;f<s;++f)u.value+=c[f].value;u.dice?bd(u,e,r,i,d?r+=(o-r)*u.value/d:o):Cd(u,e,r,d?e+=(i-e)*u.value/d:i,o),d-=u.value}else t._squarify=a=zd(n,t,e,r,i,o),a.ratio=n}return e.ratio=function(n){return t((n=+n)>1?n:1)},e}(Pd);function Rd(t,n,e){return(n[0]-t[0])*(e[1]-t[1])-(n[1]-t[1])*(e[0]-t[0])}function Fd(t,n){return t[0]-n[0]||t[1]-n[1]}function Od(t){const n=t.length,e=[0,1];let r,i=2;for(r=2;r<n;++r){for(;i>1&&Rd(t[e[i-2]],t[e[i-1]],t[r])<=0;)--i;e[i++]=r}return e.slice(0,i)}var Id=Math.random,Ud=function t(n){function e(t,e){return t=null==t?0:+t,e=null==e?1:+e,1===arguments.length?(e=t,t=0):e-=t,function(){return n()*e+t}}return e.source=t,e}(Id),Bd=function t(n){function e(t,e){return arguments.length<2&&(e=t,t=0),t=Math.floor(t),e=Math.floor(e)-t,function(){return Math.floor(n()*e+t)}}return e.source=t,e}(Id),Yd=function t(n){function e(t,e){var r,i;return t=null==t?0:+t,e=null==e?1:+e,function(){var o;if(null!=r)o=r,r=null;else do{r=2*n()-1,o=2*n()-1,i=r*r+o*o}while(!i||i>1);return t+e*o*Math.sqrt(-2*Math.log(i)/i)}}return e.source=t,e}(Id),Ld=function t(n){var e=Yd.source(n);function r(){var t=e.apply(this,arguments);return function(){return Math.exp(t())}}return r.source=t,r}(Id),jd=function t(n){function e(t){return(t=+t)<=0?()=>0:function(){for(var e=0,r=t;r>1;--r)e+=n();return e+r*n()}}return e.source=t,e}(Id),Hd=function t(n){var e=jd.source(n);function r(t){if(0==(t=+t))return n;var r=e(t);return function(){return r()/t}}return r.source=t,r}(Id),Xd=function t(n){function e(t){return function(){return-Math.log1p(-n())/t}}return e.source=t,e}(Id),Gd=function t(n){function e(t){if((t=+t)<0)throw new RangeError("invalid alpha");return t=1/-t,function(){return Math.pow(1-n(),t)}}return e.source=t,e}(Id),Vd=function t(n){function e(t){if((t=+t)<0||t>1)throw new RangeError("invalid p");return function(){return Math.floor(n()+t)}}return e.source=t,e}(Id),$d=function t(n){function e(t){if((t=+t)<0||t>1)throw new RangeError("invalid p");return 0===t?()=>1/0:1===t?()=>1:(t=Math.log1p(-t),function(){return 1+Math.floor(Math.log1p(-n())/t)})}return e.source=t,e}(Id),Wd=function t(n){var e=Yd.source(n)();function r(t,r){if((t=+t)<0)throw new RangeError("invalid k");if(0===t)return()=>0;if(r=null==r?1:+r,1===t)return()=>-Math.log1p(-n())*r;var i=(t<1?t+1:t)-1/3,o=1/(3*Math.sqrt(i)),a=t<1?()=>Math.pow(n(),1/t):()=>1;return function(){do{do{var t=e(),u=1+o*t}while(u<=0);u*=u*u;var c=1-n()}while(c>=1-.0331*t*t*t*t&&Math.log(c)>=.5*t*t+i*(1-u+Math.log(u)));return i*u*a()*r}}return r.source=t,r}(Id),Zd=function t(n){var e=Wd.source(n);function r(t,n){var r=e(t),i=e(n);return function(){var t=r();return 0===t?0:t/(t+i())}}return r.source=t,r}(Id),Kd=function t(n){var e=$d.source(n),r=Zd.source(n);function i(t,n){return t=+t,(n=+n)>=1?()=>t:n<=0?()=>0:function(){for(var i=0,o=t,a=n;o*a>16&&o*(1-a)>16;){var u=Math.floor((o+1)*a),c=r(u,o-u+1)();c<=a?(i+=u,o-=u,a=(a-c)/(1-c)):(o=u-1,a/=c)}for(var f=a<.5,s=e(f?a:1-a),l=s(),h=0;l<=o;++h)l+=s();return i+(f?h:o-h)}}return i.source=t,i}(Id),Qd=function t(n){function e(t,e,r){var i;return 0==(t=+t)?i=t=>-Math.log(t):(t=1/t,i=n=>Math.pow(n,t)),e=null==e?0:+e,r=null==r?1:+r,function(){return e+r*i(-Math.log1p(-n()))}}return e.source=t,e}(Id),Jd=function t(n){function e(t,e){return t=null==t?0:+t,e=null==e?1:+e,function(){return t+e*Math.tan(Math.PI*n())}}return e.source=t,e}(Id),tp=function t(n){function e(t,e){return t=null==t?0:+t,e=null==e?1:+e,function(){var r=n();return t+e*Math.log(r/(1-r))}}return e.source=t,e}(Id),np=function t(n){var e=Wd.source(n),r=Kd.source(n);function i(t){return function(){for(var i=0,o=t;o>16;){var a=Math.floor(.875*o),u=e(a)();if(u>o)return i+r(a-1,o/u)();i+=a,o-=u}for(var c=-Math.log1p(-n()),f=0;c<=o;++f)c-=Math.log1p(-n());return i+f}}return i.source=t,i}(Id);const ep=1/4294967296;function rp(t,n){switch(arguments.length){case 0:break;case 1:this.range(t);break;default:this.range(n).domain(t)}return this}function ip(t,n){switch(arguments.length){case 0:break;case 1:"function"==typeof t?this.interpolator(t):this.range(t);break;default:this.domain(t),"function"==typeof n?this.interpolator(n):this.range(n)}return this}const op=Symbol("implicit");function ap(){var t=new Map,n=[],e=[],r=op;function i(i){var o=i+"",a=t.get(o);if(!a){if(r!==op)return r;t.set(o,a=n.push(i))}return e[(a-1)%e.length]}return i.domain=function(e){if(!arguments.length)return n.slice();n=[],t=new Map;for(const r of e){const e=r+"";t.has(e)||t.set(e,n.push(r))}return i},i.range=function(t){return arguments.length?(e=Array.from(t),i):e.slice()},i.unknown=function(t){return arguments.length?(r=t,i):r},i.copy=function(){return ap(n,e).unknown(r)},rp.apply(i,arguments),i}function up(){var t,n,e=ap().unknown(void 0),r=e.domain,i=e.range,o=0,a=1,u=!1,c=0,f=0,s=.5;function l(){var e=r().length,l=a<o,h=l?a:o,d=l?o:a;t=(d-h)/Math.max(1,e-c+2*f),u&&(t=Math.floor(t)),h+=(d-h-t*(e-c))*s,n=t*(1-c),u&&(h=Math.round(h),n=Math.round(n));var p=Z(e).map((function(n){return h+t*n}));return i(l?p.reverse():p)}return delete e.unknown,e.domain=function(t){return arguments.length?(r(t),l()):r()},e.range=function(t){return arguments.length?([o,a]=t,o=+o,a=+a,l()):[o,a]},e.rangeRound=function(t){return[o,a]=t,o=+o,a=+a,u=!0,l()},e.bandwidth=function(){return n},e.step=function(){return t},e.round=function(t){return arguments.length?(u=!!t,l()):u},e.padding=function(t){return arguments.length?(c=Math.min(1,f=+t),l()):c},e.paddingInner=function(t){return arguments.length?(c=Math.min(1,t),l()):c},e.paddingOuter=function(t){return arguments.length?(f=+t,l()):f},e.align=function(t){return arguments.length?(s=Math.max(0,Math.min(1,t)),l()):s},e.copy=function(){return up(r(),[o,a]).round(u).paddingInner(c).paddingOuter(f).align(s)},rp.apply(l(),arguments)}function cp(t){var n=t.copy;return t.padding=t.paddingOuter,delete t.paddingInner,delete t.paddingOuter,t.copy=function(){return cp(n())},t}function fp(t){return+t}var sp=[0,1];function lp(t){return t}function hp(t,n){return(n-=t=+t)?function(e){return(e-t)/n}:function(t){return function(){return t}}(isNaN(n)?NaN:.5)}function dp(t,n,e){var r=t[0],i=t[1],o=n[0],a=n[1];return i<r?(r=hp(i,r),o=e(a,o)):(r=hp(r,i),o=e(o,a)),function(t){return o(r(t))}}function pp(t,n,e){var r=Math.min(t.length,n.length)-1,i=new Array(r),a=new Array(r),u=-1;for(t[r]<t[0]&&(t=t.slice().reverse(),n=n.slice().reverse());++u<r;)i[u]=hp(t[u],t[u+1]),a[u]=e(n[u],n[u+1]);return function(n){var e=o(t,n,1,r)-1;return a[e](i[e](n))}}function gp(t,n){return n.domain(t.domain()).range(t.range()).interpolate(t.interpolate()).clamp(t.clamp()).unknown(t.unknown())}function yp(){var t,n,e,r,i,o,a=sp,u=sp,c=Mr,f=lp;function s(){var t=Math.min(a.length,u.length);return f!==lp&&(f=function(t,n){var e;return t>n&&(e=t,t=n,n=e),function(e){return Math.max(t,Math.min(n,e))}}(a[0],a[t-1])),r=t>2?pp:dp,i=o=null,l}function l(n){return null==n||isNaN(n=+n)?e:(i||(i=r(a.map(t),u,c)))(t(f(n)))}return l.invert=function(e){return f(n((o||(o=r(u,a.map(t),_r)))(e)))},l.domain=function(t){return arguments.length?(a=Array.from(t,fp),s()):a.slice()},l.range=function(t){return arguments.length?(u=Array.from(t),s()):u.slice()},l.rangeRound=function(t){return u=Array.from(t),c=Ar,s()},l.clamp=function(t){return arguments.length?(f=!!t||lp,s()):f!==lp},l.interpolate=function(t){return arguments.length?(c=t,s()):c},l.unknown=function(t){return arguments.length?(e=t,l):e},function(e,r){return t=e,n=r,s()}}function vp(){return yp()(lp,lp)}function _p(n,e,r,i){var o,a=F(n,e,r);switch((i=ac(null==i?",f":i)).type){case"s":var u=Math.max(Math.abs(n),Math.abs(e));return null!=i.precision||isNaN(o=vc(a,u))||(i.precision=o),t.formatPrefix(i,u);case"":case"e":case"g":case"p":case"r":null!=i.precision||isNaN(o=_c(a,Math.max(Math.abs(n),Math.abs(e))))||(i.precision=o-("e"===i.type));break;case"f":case"%":null!=i.precision||isNaN(o=yc(a))||(i.precision=o-2*("%"===i.type))}return t.format(i)}function bp(t){var n=t.domain;return t.ticks=function(t){var e=n();return q(e[0],e[e.length-1],null==t?10:t)},t.tickFormat=function(t,e){var r=n();return _p(r[0],r[r.length-1],null==t?10:t,e)},t.nice=function(e){null==e&&(e=10);var r,i,o=n(),a=0,u=o.length-1,c=o[a],f=o[u],s=10;for(f<c&&(i=c,c=f,f=i,i=a,a=u,u=i);s-- >0;){if((i=R(c,f,e))===r)return o[a]=c,o[u]=f,n(o);if(i>0)c=Math.floor(c/i)*i,f=Math.ceil(f/i)*i;else{if(!(i<0))break;c=Math.ceil(c*i)/i,f=Math.floor(f*i)/i}r=i}return t},t}function mp(t,n){var e,r=0,i=(t=t.slice()).length-1,o=t[r],a=t[i];return a<o&&(e=r,r=i,i=e,e=o,o=a,a=e),t[r]=n.floor(o),t[i]=n.ceil(a),t}function xp(t){return Math.log(t)}function wp(t){return Math.exp(t)}function Mp(t){return-Math.log(-t)}function Ap(t){return-Math.exp(-t)}function Tp(t){return isFinite(t)?+("1e"+t):t<0?0:t}function Sp(t){return function(n){return-t(-n)}}function Ep(n){var e,r,i=n(xp,wp),o=i.domain,a=10;function u(){return e=function(t){return t===Math.E?Math.log:10===t&&Math.log10||2===t&&Math.log2||(t=Math.log(t),function(n){return Math.log(n)/t})}(a),r=function(t){return 10===t?Tp:t===Math.E?Math.exp:function(n){return Math.pow(t,n)}}(a),o()[0]<0?(e=Sp(e),r=Sp(r),n(Mp,Ap)):n(xp,wp),i}return i.base=function(t){return arguments.length?(a=+t,u()):a},i.domain=function(t){return arguments.length?(o(t),u()):o()},i.ticks=function(t){var n,i=o(),u=i[0],c=i[i.length-1];(n=c<u)&&(h=u,u=c,c=h);var f,s,l,h=e(u),d=e(c),p=null==t?10:+t,g=[];if(!(a%1)&&d-h<p){if(h=Math.floor(h),d=Math.ceil(d),u>0){for(;h<=d;++h)for(s=1,f=r(h);s<a;++s)if(!((l=f*s)<u)){if(l>c)break;g.push(l)}}else for(;h<=d;++h)for(s=a-1,f=r(h);s>=1;--s)if(!((l=f*s)<u)){if(l>c)break;g.push(l)}2*g.length<p&&(g=q(u,c,p))}else g=q(h,d,Math.min(d-h,p)).map(r);return n?g.reverse():g},i.tickFormat=function(n,o){if(null==o&&(o=10===a?".0e":","),"function"!=typeof o&&(o=t.format(o)),n===1/0)return o;null==n&&(n=10);var u=Math.max(1,a*n/i.ticks().length);return function(t){var n=t/r(Math.round(e(t)));return n*a<a-.5&&(n*=a),n<=u?o(t):""}},i.nice=function(){return o(mp(o(),{floor:function(t){return r(Math.floor(e(t)))},ceil:function(t){return r(Math.ceil(e(t)))}}))},i}function kp(t){return function(n){return Math.sign(n)*Math.log1p(Math.abs(n/t))}}function Np(t){return function(n){return Math.sign(n)*Math.expm1(Math.abs(n))*t}}function Cp(t){var n=1,e=t(kp(n),Np(n));return e.constant=function(e){return arguments.length?t(kp(n=+e),Np(n)):n},bp(e)}function Pp(t){return function(n){return n<0?-Math.pow(-n,t):Math.pow(n,t)}}function zp(t){return t<0?-Math.sqrt(-t):Math.sqrt(t)}function Dp(t){return t<0?-t*t:t*t}function qp(t){var n=t(lp,lp),e=1;function r(){return 1===e?t(lp,lp):.5===e?t(zp,Dp):t(Pp(e),Pp(1/e))}return n.exponent=function(t){return arguments.length?(e=+t,r()):e},bp(n)}function Rp(){var t=qp(yp());return t.copy=function(){return gp(t,Rp()).exponent(t.exponent())},rp.apply(t,arguments),t}function Fp(t){return Math.sign(t)*t*t}function Op(t){return Math.sign(t)*Math.sqrt(Math.abs(t))}var Ip=new Date,Up=new Date;function Bp(t,n,e,r){function i(n){return t(n=0===arguments.length?new Date:new Date(+n)),n}return i.floor=function(n){return t(n=new Date(+n)),n},i.ceil=function(e){return t(e=new Date(e-1)),n(e,1),t(e),e},i.round=function(t){var n=i(t),e=i.ceil(t);return t-n<e-t?n:e},i.offset=function(t,e){return n(t=new Date(+t),null==e?1:Math.floor(e)),t},i.range=function(e,r,o){var a,u=[];if(e=i.ceil(e),o=null==o?1:Math.floor(o),!(e<r&&o>0))return u;do{u.push(a=new Date(+e)),n(e,o),t(e)}while(a<e&&e<r);return u},i.filter=function(e){return Bp((function(n){if(n>=n)for(;t(n),!e(n);)n.setTime(n-1)}),(function(t,r){if(t>=t)if(r<0)for(;++r<=0;)for(;n(t,-1),!e(t););else for(;--r>=0;)for(;n(t,1),!e(t););}))},e&&(i.count=function(n,r){return Ip.setTime(+n),Up.setTime(+r),t(Ip),t(Up),Math.floor(e(Ip,Up))},i.every=function(t){return t=Math.floor(t),isFinite(t)&&t>0?t>1?i.filter(r?function(n){return r(n)%t==0}:function(n){return i.count(0,n)%t==0}):i:null}),i}var Yp=Bp((function(){}),(function(t,n){t.setTime(+t+n)}),(function(t,n){return n-t}));Yp.every=function(t){return t=Math.floor(t),isFinite(t)&&t>0?t>1?Bp((function(n){n.setTime(Math.floor(n/t)*t)}),(function(n,e){n.setTime(+n+e*t)}),(function(n,e){return(e-n)/t})):Yp:null};var Lp=Yp.range;const jp=1e3,Hp=6e4,Xp=36e5,Gp=864e5,Vp=6048e5,$p=2592e6,Wp=31536e6;var Zp=Bp((function(t){t.setTime(t-t.getMilliseconds())}),(function(t,n){t.setTime(+t+n*jp)}),(function(t,n){return(n-t)/jp}),(function(t){return t.getUTCSeconds()})),Kp=Zp.range,Qp=Bp((function(t){t.setTime(t-t.getMilliseconds()-t.getSeconds()*jp)}),(function(t,n){t.setTime(+t+n*Hp)}),(function(t,n){return(n-t)/Hp}),(function(t){return t.getMinutes()})),Jp=Qp.range,tg=Bp((function(t){t.setTime(t-t.getMilliseconds()-t.getSeconds()*jp-t.getMinutes()*Hp)}),(function(t,n){t.setTime(+t+n*Xp)}),(function(t,n){return(n-t)/Xp}),(function(t){return t.getHours()})),ng=tg.range,eg=Bp((t=>t.setHours(0,0,0,0)),((t,n)=>t.setDate(t.getDate()+n)),((t,n)=>(n-t-(n.getTimezoneOffset()-t.getTimezoneOffset())*Hp)/Gp),(t=>t.getDate()-1)),rg=eg.range;function ig(t){return Bp((function(n){n.setDate(n.getDate()-(n.getDay()+7-t)%7),n.setHours(0,0,0,0)}),(function(t,n){t.setDate(t.getDate()+7*n)}),(function(t,n){return(n-t-(n.getTimezoneOffset()-t.getTimezoneOffset())*Hp)/Vp}))}var og=ig(0),ag=ig(1),ug=ig(2),cg=ig(3),fg=ig(4),sg=ig(5),lg=ig(6),hg=og.range,dg=ag.range,pg=ug.range,gg=cg.range,yg=fg.range,vg=sg.range,_g=lg.range,bg=Bp((function(t){t.setDate(1),t.setHours(0,0,0,0)}),(function(t,n){t.setMonth(t.getMonth()+n)}),(function(t,n){return n.getMonth()-t.getMonth()+12*(n.getFullYear()-t.getFullYear())}),(function(t){return t.getMonth()})),mg=bg.range,xg=Bp((function(t){t.setMonth(0,1),t.setHours(0,0,0,0)}),(function(t,n){t.setFullYear(t.getFullYear()+n)}),(function(t,n){return n.getFullYear()-t.getFullYear()}),(function(t){return t.getFullYear()}));xg.every=function(t){return isFinite(t=Math.floor(t))&&t>0?Bp((function(n){n.setFullYear(Math.floor(n.getFullYear()/t)*t),n.setMonth(0,1),n.setHours(0,0,0,0)}),(function(n,e){n.setFullYear(n.getFullYear()+e*t)})):null};var wg=xg.range,Mg=Bp((function(t){t.setUTCSeconds(0,0)}),(function(t,n){t.setTime(+t+n*Hp)}),(function(t,n){return(n-t)/Hp}),(function(t){return t.getUTCMinutes()})),Ag=Mg.range,Tg=Bp((function(t){t.setUTCMinutes(0,0,0)}),(function(t,n){t.setTime(+t+n*Xp)}),(function(t,n){return(n-t)/Xp}),(function(t){return t.getUTCHours()})),Sg=Tg.range,Eg=Bp((function(t){t.setUTCHours(0,0,0,0)}),(function(t,n){t.setUTCDate(t.getUTCDate()+n)}),(function(t,n){return(n-t)/Gp}),(function(t){return t.getUTCDate()-1})),kg=Eg.range;function Ng(t){return Bp((function(n){n.setUTCDate(n.getUTCDate()-(n.getUTCDay()+7-t)%7),n.setUTCHours(0,0,0,0)}),(function(t,n){t.setUTCDate(t.getUTCDate()+7*n)}),(function(t,n){return(n-t)/Vp}))}var Cg=Ng(0),Pg=Ng(1),zg=Ng(2),Dg=Ng(3),qg=Ng(4),Rg=Ng(5),Fg=Ng(6),Og=Cg.range,Ig=Pg.range,Ug=zg.range,Bg=Dg.range,Yg=qg.range,Lg=Rg.range,jg=Fg.range,Hg=Bp((function(t){t.setUTCDate(1),t.setUTCHours(0,0,0,0)}),(function(t,n){t.setUTCMonth(t.getUTCMonth()+n)}),(function(t,n){return n.getUTCMonth()-t.getUTCMonth()+12*(n.getUTCFullYear()-t.getUTCFullYear())}),(function(t){return t.getUTCMonth()})),Xg=Hg.range,Gg=Bp((function(t){t.setUTCMonth(0,1),t.setUTCHours(0,0,0,0)}),(function(t,n){t.setUTCFullYear(t.getUTCFullYear()+n)}),(function(t,n){return n.getUTCFullYear()-t.getUTCFullYear()}),(function(t){return t.getUTCFullYear()}));Gg.every=function(t){return isFinite(t=Math.floor(t))&&t>0?Bp((function(n){n.setUTCFullYear(Math.floor(n.getUTCFullYear()/t)*t),n.setUTCMonth(0,1),n.setUTCHours(0,0,0,0)}),(function(n,e){n.setUTCFullYear(n.getUTCFullYear()+e*t)})):null};var Vg=Gg.range;function $g(t,n,r,i,o,a){const u=[[Zp,1,jp],[Zp,5,5e3],[Zp,15,15e3],[Zp,30,3e4],[a,1,Hp],[a,5,3e5],[a,15,9e5],[a,30,18e5],[o,1,Xp],[o,3,108e5],[o,6,216e5],[o,12,432e5],[i,1,Gp],[i,2,1728e5],[r,1,Vp],[n,1,$p],[n,3,7776e6],[t,1,Wp]];function c(n,r,i){const o=Math.abs(r-n)/i,a=e((([,,t])=>t)).right(u,o);if(a===u.length)return t.every(F(n/Wp,r/Wp,i));if(0===a)return Yp.every(Math.max(F(n,r,i),1));const[c,f]=u[o/u[a-1][2]<u[a][2]/o?a-1:a];return c.every(f)}return[function(t,n,e){const r=n<t;r&&([t,n]=[n,t]);const i=e&&"function"==typeof e.range?e:c(t,n,e),o=i?i.range(t,+n+1):[];return r?o.reverse():o},c]}const[Wg,Zg]=$g(Gg,Hg,Cg,Eg,Tg,Mg),[Kg,Qg]=$g(xg,bg,og,eg,tg,Qp);function Jg(t){if(0<=t.y&&t.y<100){var n=new Date(-1,t.m,t.d,t.H,t.M,t.S,t.L);return n.setFullYear(t.y),n}return new Date(t.y,t.m,t.d,t.H,t.M,t.S,t.L)}function ty(t){if(0<=t.y&&t.y<100){var n=new Date(Date.UTC(-1,t.m,t.d,t.H,t.M,t.S,t.L));return n.setUTCFullYear(t.y),n}return new Date(Date.UTC(t.y,t.m,t.d,t.H,t.M,t.S,t.L))}function ny(t,n,e){return{y:t,m:n,d:e,H:0,M:0,S:0,L:0}}function ey(t){var n=t.dateTime,e=t.date,r=t.time,i=t.periods,o=t.days,a=t.shortDays,u=t.months,c=t.shortMonths,f=sy(i),s=ly(i),l=sy(o),h=ly(o),d=sy(a),p=ly(a),g=sy(u),y=ly(u),v=sy(c),_=ly(c),b={a:function(t){return a[t.getDay()]},A:function(t){return o[t.getDay()]},b:function(t){return c[t.getMonth()]},B:function(t){return u[t.getMonth()]},c:null,d:zy,e:zy,f:Oy,g:$y,G:Zy,H:Dy,I:qy,j:Ry,L:Fy,m:Iy,M:Uy,p:function(t){return i[+(t.getHours()>=12)]},q:function(t){return 1+~~(t.getMonth()/3)},Q:bv,s:mv,S:By,u:Yy,U:Ly,V:Hy,w:Xy,W:Gy,x:null,X:null,y:Vy,Y:Wy,Z:Ky,"%":_v},m={a:function(t){return a[t.getUTCDay()]},A:function(t){return o[t.getUTCDay()]},b:function(t){return c[t.getUTCMonth()]},B:function(t){return u[t.getUTCMonth()]},c:null,d:Qy,e:Qy,f:rv,g:pv,G:yv,H:Jy,I:tv,j:nv,L:ev,m:iv,M:ov,p:function(t){return i[+(t.getUTCHours()>=12)]},q:function(t){return 1+~~(t.getUTCMonth()/3)},Q:bv,s:mv,S:av,u:uv,U:cv,V:sv,w:lv,W:hv,x:null,X:null,y:dv,Y:gv,Z:vv,"%":_v},x={a:function(t,n,e){var r=d.exec(n.slice(e));return r?(t.w=p.get(r[0].toLowerCase()),e+r[0].length):-1},A:function(t,n,e){var r=l.exec(n.slice(e));return r?(t.w=h.get(r[0].toLowerCase()),e+r[0].length):-1},b:function(t,n,e){var r=v.exec(n.slice(e));return r?(t.m=_.get(r[0].toLowerCase()),e+r[0].length):-1},B:function(t,n,e){var r=g.exec(n.slice(e));return r?(t.m=y.get(r[0].toLowerCase()),e+r[0].length):-1},c:function(t,e,r){return A(t,n,e,r)},d:wy,e:wy,f:ky,g:_y,G:vy,H:Ay,I:Ay,j:My,L:Ey,m:xy,M:Ty,p:function(t,n,e){var r=f.exec(n.slice(e));return r?(t.p=s.get(r[0].toLowerCase()),e+r[0].length):-1},q:my,Q:Cy,s:Py,S:Sy,u:dy,U:py,V:gy,w:hy,W:yy,x:function(t,n,r){return A(t,e,n,r)},X:function(t,n,e){return A(t,r,n,e)},y:_y,Y:vy,Z:by,"%":Ny};function w(t,n){return function(e){var r,i,o,a=[],u=-1,c=0,f=t.length;for(e instanceof Date||(e=new Date(+e));++u<f;)37===t.charCodeAt(u)&&(a.push(t.slice(c,u)),null!=(i=iy[r=t.charAt(++u)])?r=t.charAt(++u):i="e"===r?" ":"0",(o=n[r])&&(r=o(e,i)),a.push(r),c=u+1);return a.push(t.slice(c,u)),a.join("")}}function M(t,n){return function(e){var r,i,o=ny(1900,void 0,1);if(A(o,t,e+="",0)!=e.length)return null;if("Q"in o)return new Date(o.Q);if("s"in o)return new Date(1e3*o.s+("L"in o?o.L:0));if(n&&!("Z"in o)&&(o.Z=0),"p"in o&&(o.H=o.H%12+12*o.p),void 0===o.m&&(o.m="q"in o?o.q:0),"V"in o){if(o.V<1||o.V>53)return null;"w"in o||(o.w=1),"Z"in o?(i=(r=ty(ny(o.y,0,1))).getUTCDay(),r=i>4||0===i?Pg.ceil(r):Pg(r),r=Eg.offset(r,7*(o.V-1)),o.y=r.getUTCFullYear(),o.m=r.getUTCMonth(),o.d=r.getUTCDate()+(o.w+6)%7):(i=(r=Jg(ny(o.y,0,1))).getDay(),r=i>4||0===i?ag.ceil(r):ag(r),r=eg.offset(r,7*(o.V-1)),o.y=r.getFullYear(),o.m=r.getMonth(),o.d=r.getDate()+(o.w+6)%7)}else("W"in o||"U"in o)&&("w"in o||(o.w="u"in o?o.u%7:"W"in o?1:0),i="Z"in o?ty(ny(o.y,0,1)).getUTCDay():Jg(ny(o.y,0,1)).getDay(),o.m=0,o.d="W"in o?(o.w+6)%7+7*o.W-(i+5)%7:o.w+7*o.U-(i+6)%7);return"Z"in o?(o.H+=o.Z/100|0,o.M+=o.Z%100,ty(o)):Jg(o)}}function A(t,n,e,r){for(var i,o,a=0,u=n.length,c=e.length;a<u;){if(r>=c)return-1;if(37===(i=n.charCodeAt(a++))){if(i=n.charAt(a++),!(o=x[i in iy?n.charAt(a++):i])||(r=o(t,e,r))<0)return-1}else if(i!=e.charCodeAt(r++))return-1}return r}return b.x=w(e,b),b.X=w(r,b),b.c=w(n,b),m.x=w(e,m),m.X=w(r,m),m.c=w(n,m),{format:function(t){var n=w(t+="",b);return n.toString=function(){return t},n},parse:function(t){var n=M(t+="",!1);return n.toString=function(){return t},n},utcFormat:function(t){var n=w(t+="",m);return n.toString=function(){return t},n},utcParse:function(t){var n=M(t+="",!0);return n.toString=function(){return t},n}}}var ry,iy={"-":"",_:" ",0:"0"},oy=/^\s*\d+/,ay=/^%/,uy=/[\\^$*+?|[\]().{}]/g;function cy(t,n,e){var r=t<0?"-":"",i=(r?-t:t)+"",o=i.length;return r+(o<e?new Array(e-o+1).join(n)+i:i)}function fy(t){return t.replace(uy,"\\$&")}function sy(t){return new RegExp("^(?:"+t.map(fy).join("|")+")","i")}function ly(t){return new Map(t.map(((t,n)=>[t.toLowerCase(),n])))}function hy(t,n,e){var r=oy.exec(n.slice(e,e+1));return r?(t.w=+r[0],e+r[0].length):-1}function dy(t,n,e){var r=oy.exec(n.slice(e,e+1));return r?(t.u=+r[0],e+r[0].length):-1}function py(t,n,e){var r=oy.exec(n.slice(e,e+2));return r?(t.U=+r[0],e+r[0].length):-1}function gy(t,n,e){var r=oy.exec(n.slice(e,e+2));return r?(t.V=+r[0],e+r[0].length):-1}function yy(t,n,e){var r=oy.exec(n.slice(e,e+2));return r?(t.W=+r[0],e+r[0].length):-1}function vy(t,n,e){var r=oy.exec(n.slice(e,e+4));return r?(t.y=+r[0],e+r[0].length):-1}function _y(t,n,e){var r=oy.exec(n.slice(e,e+2));return r?(t.y=+r[0]+(+r[0]>68?1900:2e3),e+r[0].length):-1}function by(t,n,e){var r=/^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(n.slice(e,e+6));return r?(t.Z=r[1]?0:-(r[2]+(r[3]||"00")),e+r[0].length):-1}function my(t,n,e){var r=oy.exec(n.slice(e,e+1));return r?(t.q=3*r[0]-3,e+r[0].length):-1}function xy(t,n,e){var r=oy.exec(n.slice(e,e+2));return r?(t.m=r[0]-1,e+r[0].length):-1}function wy(t,n,e){var r=oy.exec(n.slice(e,e+2));return r?(t.d=+r[0],e+r[0].length):-1}function My(t,n,e){var r=oy.exec(n.slice(e,e+3));return r?(t.m=0,t.d=+r[0],e+r[0].length):-1}function Ay(t,n,e){var r=oy.exec(n.slice(e,e+2));return r?(t.H=+r[0],e+r[0].length):-1}function Ty(t,n,e){var r=oy.exec(n.slice(e,e+2));return r?(t.M=+r[0],e+r[0].length):-1}function Sy(t,n,e){var r=oy.exec(n.slice(e,e+2));return r?(t.S=+r[0],e+r[0].length):-1}function Ey(t,n,e){var r=oy.exec(n.slice(e,e+3));return r?(t.L=+r[0],e+r[0].length):-1}function ky(t,n,e){var r=oy.exec(n.slice(e,e+6));return r?(t.L=Math.floor(r[0]/1e3),e+r[0].length):-1}function Ny(t,n,e){var r=ay.exec(n.slice(e,e+1));return r?e+r[0].length:-1}function Cy(t,n,e){var r=oy.exec(n.slice(e));return r?(t.Q=+r[0],e+r[0].length):-1}function Py(t,n,e){var r=oy.exec(n.slice(e));return r?(t.s=+r[0],e+r[0].length):-1}function zy(t,n){return cy(t.getDate(),n,2)}function Dy(t,n){return cy(t.getHours(),n,2)}function qy(t,n){return cy(t.getHours()%12||12,n,2)}function Ry(t,n){return cy(1+eg.count(xg(t),t),n,3)}function Fy(t,n){return cy(t.getMilliseconds(),n,3)}function Oy(t,n){return Fy(t,n)+"000"}function Iy(t,n){return cy(t.getMonth()+1,n,2)}function Uy(t,n){return cy(t.getMinutes(),n,2)}function By(t,n){return cy(t.getSeconds(),n,2)}function Yy(t){var n=t.getDay();return 0===n?7:n}function Ly(t,n){return cy(og.count(xg(t)-1,t),n,2)}function jy(t){var n=t.getDay();return n>=4||0===n?fg(t):fg.ceil(t)}function Hy(t,n){return t=jy(t),cy(fg.count(xg(t),t)+(4===xg(t).getDay()),n,2)}function Xy(t){return t.getDay()}function Gy(t,n){return cy(ag.count(xg(t)-1,t),n,2)}function Vy(t,n){return cy(t.getFullYear()%100,n,2)}function $y(t,n){return cy((t=jy(t)).getFullYear()%100,n,2)}function Wy(t,n){return cy(t.getFullYear()%1e4,n,4)}function Zy(t,n){var e=t.getDay();return cy((t=e>=4||0===e?fg(t):fg.ceil(t)).getFullYear()%1e4,n,4)}function Ky(t){var n=t.getTimezoneOffset();return(n>0?"-":(n*=-1,"+"))+cy(n/60|0,"0",2)+cy(n%60,"0",2)}function Qy(t,n){return cy(t.getUTCDate(),n,2)}function Jy(t,n){return cy(t.getUTCHours(),n,2)}function tv(t,n){return cy(t.getUTCHours()%12||12,n,2)}function nv(t,n){return cy(1+Eg.count(Gg(t),t),n,3)}function ev(t,n){return cy(t.getUTCMilliseconds(),n,3)}function rv(t,n){return ev(t,n)+"000"}function iv(t,n){return cy(t.getUTCMonth()+1,n,2)}function ov(t,n){return cy(t.getUTCMinutes(),n,2)}function av(t,n){return cy(t.getUTCSeconds(),n,2)}function uv(t){var n=t.getUTCDay();return 0===n?7:n}function cv(t,n){return cy(Cg.count(Gg(t)-1,t),n,2)}function fv(t){var n=t.getUTCDay();return n>=4||0===n?qg(t):qg.ceil(t)}function sv(t,n){return t=fv(t),cy(qg.count(Gg(t),t)+(4===Gg(t).getUTCDay()),n,2)}function lv(t){return t.getUTCDay()}function hv(t,n){return cy(Pg.count(Gg(t)-1,t),n,2)}function dv(t,n){return cy(t.getUTCFullYear()%100,n,2)}function pv(t,n){return cy((t=fv(t)).getUTCFullYear()%100,n,2)}function gv(t,n){return cy(t.getUTCFullYear()%1e4,n,4)}function yv(t,n){var e=t.getUTCDay();return cy((t=e>=4||0===e?qg(t):qg.ceil(t)).getUTCFullYear()%1e4,n,4)}function vv(){return"+0000"}function _v(){return"%"}function bv(t){return+t}function mv(t){return Math.floor(+t/1e3)}function xv(n){return ry=ey(n),t.timeFormat=ry.format,t.timeParse=ry.parse,t.utcFormat=ry.utcFormat,t.utcParse=ry.utcParse,ry}t.timeFormat=void 0,t.timeParse=void 0,t.utcFormat=void 0,t.utcParse=void 0,xv({dateTime:"%x, %X",date:"%-m/%-d/%Y",time:"%-I:%M:%S %p",periods:["AM","PM"],days:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],shortDays:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],months:["January","February","March","April","May","June","July","August","September","October","November","December"],shortMonths:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]});var wv="%Y-%m-%dT%H:%M:%S.%LZ";var Mv=Date.prototype.toISOString?function(t){return t.toISOString()}:t.utcFormat(wv);var Av=+new Date("2000-01-01T00:00:00.000Z")?function(t){var n=new Date(t);return isNaN(n)?null:n}:t.utcParse(wv);function Tv(t){return new Date(t)}function Sv(t){return t instanceof Date?+t:+new Date(+t)}function Ev(t,n,e,r,i,o,a,u,c,f){var s=vp(),l=s.invert,h=s.domain,d=f(".%L"),p=f(":%S"),g=f("%I:%M"),y=f("%I %p"),v=f("%a %d"),_=f("%b %d"),b=f("%B"),m=f("%Y");function x(t){return(c(t)<t?d:u(t)<t?p:a(t)<t?g:o(t)<t?y:r(t)<t?i(t)<t?v:_:e(t)<t?b:m)(t)}return s.invert=function(t){return new Date(l(t))},s.domain=function(t){return arguments.length?h(Array.from(t,Sv)):h().map(Tv)},s.ticks=function(n){var e=h();return t(e[0],e[e.length-1],null==n?10:n)},s.tickFormat=function(t,n){return null==n?x:f(n)},s.nice=function(t){var e=h();return t&&"function"==typeof t.range||(t=n(e[0],e[e.length-1],null==t?10:t)),t?h(mp(e,t)):s},s.copy=function(){return gp(s,Ev(t,n,e,r,i,o,a,u,c,f))},s}function kv(){var t,n,e,r,i,o=0,a=1,u=lp,c=!1;function f(n){return null==n||isNaN(n=+n)?i:u(0===e?.5:(n=(r(n)-t)*e,c?Math.max(0,Math.min(1,n)):n))}function s(t){return function(n){var e,r;return arguments.length?([e,r]=n,u=t(e,r),f):[u(0),u(1)]}}return f.domain=function(i){return arguments.length?([o,a]=i,t=r(o=+o),n=r(a=+a),e=t===n?0:1/(n-t),f):[o,a]},f.clamp=function(t){return arguments.length?(c=!!t,f):c},f.interpolator=function(t){return arguments.length?(u=t,f):u},f.range=s(Mr),f.rangeRound=s(Ar),f.unknown=function(t){return arguments.length?(i=t,f):i},function(i){return r=i,t=i(o),n=i(a),e=t===n?0:1/(n-t),f}}function Nv(t,n){return n.domain(t.domain()).interpolator(t.interpolator()).clamp(t.clamp()).unknown(t.unknown())}function Cv(){var t=qp(kv());return t.copy=function(){return Nv(t,Cv()).exponent(t.exponent())},ip.apply(t,arguments)}function Pv(){var t,n,e,r,i,o,a,u=0,c=.5,f=1,s=1,l=lp,h=!1;function d(t){return isNaN(t=+t)?a:(t=.5+((t=+o(t))-n)*(s*t<s*n?r:i),l(h?Math.max(0,Math.min(1,t)):t))}function p(t){return function(n){var e,r,i;return arguments.length?([e,r,i]=n,l=jr(t,[e,r,i]),d):[l(0),l(.5),l(1)]}}return d.domain=function(a){return arguments.length?([u,c,f]=a,t=o(u=+u),n=o(c=+c),e=o(f=+f),r=t===n?0:.5/(n-t),i=n===e?0:.5/(e-n),s=n<t?-1:1,d):[u,c,f]},d.clamp=function(t){return arguments.length?(h=!!t,d):h},d.interpolator=function(t){return arguments.length?(l=t,d):l},d.range=p(Mr),d.rangeRound=p(Ar),d.unknown=function(t){return arguments.length?(a=t,d):a},function(a){return o=a,t=a(u),n=a(c),e=a(f),r=t===n?0:.5/(n-t),i=n===e?0:.5/(e-n),s=n<t?-1:1,d}}function zv(){var t=qp(Pv());return t.copy=function(){return Nv(t,zv()).exponent(t.exponent())},ip.apply(t,arguments)}function Dv(t){for(var n=t.length/6|0,e=new Array(n),r=0;r<n;)e[r]="#"+t.slice(6*r,6*++r);return e}var qv=Dv("1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf"),Rv=Dv("7fc97fbeaed4fdc086ffff99386cb0f0027fbf5b17666666"),Fv=Dv("1b9e77d95f027570b3e7298a66a61ee6ab02a6761d666666"),Ov=Dv("a6cee31f78b4b2df8a33a02cfb9a99e31a1cfdbf6fff7f00cab2d66a3d9affff99b15928"),Iv=Dv("fbb4aeb3cde3ccebc5decbe4fed9a6ffffcce5d8bdfddaecf2f2f2"),Uv=Dv("b3e2cdfdcdaccbd5e8f4cae4e6f5c9fff2aef1e2cccccccc"),Bv=Dv("e41a1c377eb84daf4a984ea3ff7f00ffff33a65628f781bf999999"),Yv=Dv("66c2a5fc8d628da0cbe78ac3a6d854ffd92fe5c494b3b3b3"),Lv=Dv("8dd3c7ffffb3bebadafb807280b1d3fdb462b3de69fccde5d9d9d9bc80bdccebc5ffed6f"),jv=Dv("4e79a7f28e2ce1575976b7b259a14fedc949af7aa1ff9da79c755fbab0ab"),Hv=t=>hr(t[t.length-1]),Xv=new Array(3).concat("d8b365f5f5f55ab4ac","a6611adfc27d80cdc1018571","a6611adfc27df5f5f580cdc1018571","8c510ad8b365f6e8c3c7eae55ab4ac01665e","8c510ad8b365f6e8c3f5f5f5c7eae55ab4ac01665e","8c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e","8c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e","5430058c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e003c30","5430058c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e003c30").map(Dv),Gv=Hv(Xv),Vv=new Array(3).concat("af8dc3f7f7f77fbf7b","7b3294c2a5cfa6dba0008837","7b3294c2a5cff7f7f7a6dba0008837","762a83af8dc3e7d4e8d9f0d37fbf7b1b7837","762a83af8dc3e7d4e8f7f7f7d9f0d37fbf7b1b7837","762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b7837","762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b7837","40004b762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b783700441b","40004b762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b783700441b").map(Dv),$v=Hv(Vv),Wv=new Array(3).concat("e9a3c9f7f7f7a1d76a","d01c8bf1b6dab8e1864dac26","d01c8bf1b6daf7f7f7b8e1864dac26","c51b7de9a3c9fde0efe6f5d0a1d76a4d9221","c51b7de9a3c9fde0eff7f7f7e6f5d0a1d76a4d9221","c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221","c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221","8e0152c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221276419","8e0152c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221276419").map(Dv),Zv=Hv(Wv),Kv=new Array(3).concat("998ec3f7f7f7f1a340","5e3c99b2abd2fdb863e66101","5e3c99b2abd2f7f7f7fdb863e66101","542788998ec3d8daebfee0b6f1a340b35806","542788998ec3d8daebf7f7f7fee0b6f1a340b35806","5427888073acb2abd2d8daebfee0b6fdb863e08214b35806","5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b35806","2d004b5427888073acb2abd2d8daebfee0b6fdb863e08214b358067f3b08","2d004b5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b358067f3b08").map(Dv),Qv=Hv(Kv),Jv=new Array(3).concat("ef8a62f7f7f767a9cf","ca0020f4a58292c5de0571b0","ca0020f4a582f7f7f792c5de0571b0","b2182bef8a62fddbc7d1e5f067a9cf2166ac","b2182bef8a62fddbc7f7f7f7d1e5f067a9cf2166ac","b2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac","b2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac","67001fb2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac053061","67001fb2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac053061").map(Dv),t_=Hv(Jv),n_=new Array(3).concat("ef8a62ffffff999999","ca0020f4a582bababa404040","ca0020f4a582ffffffbababa404040","b2182bef8a62fddbc7e0e0e09999994d4d4d","b2182bef8a62fddbc7ffffffe0e0e09999994d4d4d","b2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d","b2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d","67001fb2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d1a1a1a","67001fb2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d1a1a1a").map(Dv),e_=Hv(n_),r_=new Array(3).concat("fc8d59ffffbf91bfdb","d7191cfdae61abd9e92c7bb6","d7191cfdae61ffffbfabd9e92c7bb6","d73027fc8d59fee090e0f3f891bfdb4575b4","d73027fc8d59fee090ffffbfe0f3f891bfdb4575b4","d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4","d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4","a50026d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4313695","a50026d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4313695").map(Dv),i_=Hv(r_),o_=new Array(3).concat("fc8d59ffffbf91cf60","d7191cfdae61a6d96a1a9641","d7191cfdae61ffffbfa6d96a1a9641","d73027fc8d59fee08bd9ef8b91cf601a9850","d73027fc8d59fee08bffffbfd9ef8b91cf601a9850","d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850","d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850","a50026d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850006837","a50026d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850006837").map(Dv),a_=Hv(o_),u_=new Array(3).concat("fc8d59ffffbf99d594","d7191cfdae61abdda42b83ba","d7191cfdae61ffffbfabdda42b83ba","d53e4ffc8d59fee08be6f59899d5943288bd","d53e4ffc8d59fee08bffffbfe6f59899d5943288bd","d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd","d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd","9e0142d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd5e4fa2","9e0142d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd5e4fa2").map(Dv),c_=Hv(u_),f_=new Array(3).concat("e5f5f999d8c92ca25f","edf8fbb2e2e266c2a4238b45","edf8fbb2e2e266c2a42ca25f006d2c","edf8fbccece699d8c966c2a42ca25f006d2c","edf8fbccece699d8c966c2a441ae76238b45005824","f7fcfde5f5f9ccece699d8c966c2a441ae76238b45005824","f7fcfde5f5f9ccece699d8c966c2a441ae76238b45006d2c00441b").map(Dv),s_=Hv(f_),l_=new Array(3).concat("e0ecf49ebcda8856a7","edf8fbb3cde38c96c688419d","edf8fbb3cde38c96c68856a7810f7c","edf8fbbfd3e69ebcda8c96c68856a7810f7c","edf8fbbfd3e69ebcda8c96c68c6bb188419d6e016b","f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d6e016b","f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d810f7c4d004b").map(Dv),h_=Hv(l_),d_=new Array(3).concat("e0f3dba8ddb543a2ca","f0f9e8bae4bc7bccc42b8cbe","f0f9e8bae4bc7bccc443a2ca0868ac","f0f9e8ccebc5a8ddb57bccc443a2ca0868ac","f0f9e8ccebc5a8ddb57bccc44eb3d32b8cbe08589e","f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe08589e","f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe0868ac084081").map(Dv),p_=Hv(d_),g_=new Array(3).concat("fee8c8fdbb84e34a33","fef0d9fdcc8afc8d59d7301f","fef0d9fdcc8afc8d59e34a33b30000","fef0d9fdd49efdbb84fc8d59e34a33b30000","fef0d9fdd49efdbb84fc8d59ef6548d7301f990000","fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301f990000","fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301fb300007f0000").map(Dv),y_=Hv(g_),v_=new Array(3).concat("ece2f0a6bddb1c9099","f6eff7bdc9e167a9cf02818a","f6eff7bdc9e167a9cf1c9099016c59","f6eff7d0d1e6a6bddb67a9cf1c9099016c59","f6eff7d0d1e6a6bddb67a9cf3690c002818a016450","fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016450","fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016c59014636").map(Dv),__=Hv(v_),b_=new Array(3).concat("ece7f2a6bddb2b8cbe","f1eef6bdc9e174a9cf0570b0","f1eef6bdc9e174a9cf2b8cbe045a8d","f1eef6d0d1e6a6bddb74a9cf2b8cbe045a8d","f1eef6d0d1e6a6bddb74a9cf3690c00570b0034e7b","fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0034e7b","fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0045a8d023858").map(Dv),m_=Hv(b_),x_=new Array(3).concat("e7e1efc994c7dd1c77","f1eef6d7b5d8df65b0ce1256","f1eef6d7b5d8df65b0dd1c77980043","f1eef6d4b9dac994c7df65b0dd1c77980043","f1eef6d4b9dac994c7df65b0e7298ace125691003f","f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125691003f","f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125698004367001f").map(Dv),w_=Hv(x_),M_=new Array(3).concat("fde0ddfa9fb5c51b8a","feebe2fbb4b9f768a1ae017e","feebe2fbb4b9f768a1c51b8a7a0177","feebe2fcc5c0fa9fb5f768a1c51b8a7a0177","feebe2fcc5c0fa9fb5f768a1dd3497ae017e7a0177","fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a0177","fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a017749006a").map(Dv),A_=Hv(M_),T_=new Array(3).concat("edf8b17fcdbb2c7fb8","ffffcca1dab441b6c4225ea8","ffffcca1dab441b6c42c7fb8253494","ffffccc7e9b47fcdbb41b6c42c7fb8253494","ffffccc7e9b47fcdbb41b6c41d91c0225ea80c2c84","ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea80c2c84","ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea8253494081d58").map(Dv),S_=Hv(T_),E_=new Array(3).concat("f7fcb9addd8e31a354","ffffccc2e69978c679238443","ffffccc2e69978c67931a354006837","ffffccd9f0a3addd8e78c67931a354006837","ffffccd9f0a3addd8e78c67941ab5d238443005a32","ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443005a32","ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443006837004529").map(Dv),k_=Hv(E_),N_=new Array(3).concat("fff7bcfec44fd95f0e","ffffd4fed98efe9929cc4c02","ffffd4fed98efe9929d95f0e993404","ffffd4fee391fec44ffe9929d95f0e993404","ffffd4fee391fec44ffe9929ec7014cc4c028c2d04","ffffe5fff7bcfee391fec44ffe9929ec7014cc4c028c2d04","ffffe5fff7bcfee391fec44ffe9929ec7014cc4c02993404662506").map(Dv),C_=Hv(N_),P_=new Array(3).concat("ffeda0feb24cf03b20","ffffb2fecc5cfd8d3ce31a1c","ffffb2fecc5cfd8d3cf03b20bd0026","ffffb2fed976feb24cfd8d3cf03b20bd0026","ffffb2fed976feb24cfd8d3cfc4e2ae31a1cb10026","ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cb10026","ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cbd0026800026").map(Dv),z_=Hv(P_),D_=new Array(3).concat("deebf79ecae13182bd","eff3ffbdd7e76baed62171b5","eff3ffbdd7e76baed63182bd08519c","eff3ffc6dbef9ecae16baed63182bd08519c","eff3ffc6dbef9ecae16baed64292c62171b5084594","f7fbffdeebf7c6dbef9ecae16baed64292c62171b5084594","f7fbffdeebf7c6dbef9ecae16baed64292c62171b508519c08306b").map(Dv),q_=Hv(D_),R_=new Array(3).concat("e5f5e0a1d99b31a354","edf8e9bae4b374c476238b45","edf8e9bae4b374c47631a354006d2c","edf8e9c7e9c0a1d99b74c47631a354006d2c","edf8e9c7e9c0a1d99b74c47641ab5d238b45005a32","f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45005a32","f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45006d2c00441b").map(Dv),F_=Hv(R_),O_=new Array(3).concat("f0f0f0bdbdbd636363","f7f7f7cccccc969696525252","f7f7f7cccccc969696636363252525","f7f7f7d9d9d9bdbdbd969696636363252525","f7f7f7d9d9d9bdbdbd969696737373525252252525","fffffff0f0f0d9d9d9bdbdbd969696737373525252252525","fffffff0f0f0d9d9d9bdbdbd969696737373525252252525000000").map(Dv),I_=Hv(O_),U_=new Array(3).concat("efedf5bcbddc756bb1","f2f0f7cbc9e29e9ac86a51a3","f2f0f7cbc9e29e9ac8756bb154278f","f2f0f7dadaebbcbddc9e9ac8756bb154278f","f2f0f7dadaebbcbddc9e9ac8807dba6a51a34a1486","fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a34a1486","fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a354278f3f007d").map(Dv),B_=Hv(U_),Y_=new Array(3).concat("fee0d2fc9272de2d26","fee5d9fcae91fb6a4acb181d","fee5d9fcae91fb6a4ade2d26a50f15","fee5d9fcbba1fc9272fb6a4ade2d26a50f15","fee5d9fcbba1fc9272fb6a4aef3b2ccb181d99000d","fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181d99000d","fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181da50f1567000d").map(Dv),L_=Hv(Y_),j_=new Array(3).concat("fee6cefdae6be6550d","feeddefdbe85fd8d3cd94701","feeddefdbe85fd8d3ce6550da63603","feeddefdd0a2fdae6bfd8d3ce6550da63603","feeddefdd0a2fdae6bfd8d3cf16913d948018c2d04","fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d948018c2d04","fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d94801a636037f2704").map(Dv),H_=Hv(j_);var X_=Lr(tr(300,.5,0),tr(-240,.5,1)),G_=Lr(tr(-100,.75,.35),tr(80,1.5,.8)),V_=Lr(tr(260,.75,.35),tr(80,1.5,.8)),$_=tr();var W_=ve(),Z_=Math.PI/3,K_=2*Math.PI/3;function Q_(t){var n=t.length;return function(e){return t[Math.max(0,Math.min(n-1,Math.floor(e*n)))]}}var J_=Q_(Dv("44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725")),tb=Q_(Dv("00000401000501010601010802010902020b02020d03030f03031204041405041606051806051a07061c08071e0907200a08220b09240c09260d0a290e0b2b100b2d110c2f120d31130d34140e36150e38160f3b180f3d19103f1a10421c10441d11471e114920114b21114e22115024125325125527125829115a2a115c2c115f2d11612f116331116533106734106936106b38106c390f6e3b0f703d0f713f0f72400f74420f75440f764510774710784910784a10794c117a4e117b4f127b51127c52137c54137d56147d57157e59157e5a167e5c167f5d177f5f187f601880621980641a80651a80671b80681c816a1c816b1d816d1d816e1e81701f81721f817320817521817621817822817922827b23827c23827e24828025828125818326818426818627818827818928818b29818c29818e2a81902a81912b81932b80942c80962c80982d80992d809b2e7f9c2e7f9e2f7fa02f7fa1307ea3307ea5317ea6317da8327daa337dab337cad347cae347bb0357bb2357bb3367ab5367ab73779b83779ba3878bc3978bd3977bf3a77c03a76c23b75c43c75c53c74c73d73c83e73ca3e72cc3f71cd4071cf4070d0416fd2426fd3436ed5446dd6456cd8456cd9466bdb476adc4869de4968df4a68e04c67e24d66e34e65e44f64e55064e75263e85362e95462ea5661eb5760ec5860ed5a5fee5b5eef5d5ef05f5ef1605df2625df2645cf3655cf4675cf4695cf56b5cf66c5cf66e5cf7705cf7725cf8745cf8765cf9785df9795df97b5dfa7d5efa7f5efa815ffb835ffb8560fb8761fc8961fc8a62fc8c63fc8e64fc9065fd9266fd9467fd9668fd9869fd9a6afd9b6bfe9d6cfe9f6dfea16efea36ffea571fea772fea973feaa74feac76feae77feb078feb27afeb47bfeb67cfeb77efeb97ffebb81febd82febf84fec185fec287fec488fec68afec88cfeca8dfecc8ffecd90fecf92fed194fed395fed597fed799fed89afdda9cfddc9efddea0fde0a1fde2a3fde3a5fde5a7fde7a9fde9aafdebacfcecaefceeb0fcf0b2fcf2b4fcf4b6fcf6b8fcf7b9fcf9bbfcfbbdfcfdbf")),nb=Q_(Dv("00000401000501010601010802010a02020c02020e03021004031204031405041706041907051b08051d09061f0a07220b07240c08260d08290e092b10092d110a30120a32140b34150b37160b39180c3c190c3e1b0c411c0c431e0c451f0c48210c4a230c4c240c4f260c51280b53290b552b0b572d0b592f0a5b310a5c320a5e340a5f3609613809623909633b09643d09653e0966400a67420a68440a68450a69470b6a490b6a4a0c6b4c0c6b4d0d6c4f0d6c510e6c520e6d540f6d550f6d57106e59106e5a116e5c126e5d126e5f136e61136e62146e64156e65156e67166e69166e6a176e6c186e6d186e6f196e71196e721a6e741a6e751b6e771c6d781c6d7a1d6d7c1d6d7d1e6d7f1e6c801f6c82206c84206b85216b87216b88226a8a226a8c23698d23698f24699025689225689326679526679727669827669a28659b29649d29649f2a63a02a63a22b62a32c61a52c60a62d60a82e5fa92e5eab2f5ead305dae305cb0315bb1325ab3325ab43359b63458b73557b93556ba3655bc3754bd3853bf3952c03a51c13a50c33b4fc43c4ec63d4dc73e4cc83f4bca404acb4149cc4248ce4347cf4446d04545d24644d34743d44842d54a41d74b3fd84c3ed94d3dda4e3cdb503bdd513ade5238df5337e05536e15635e25734e35933e45a31e55c30e65d2fe75e2ee8602de9612bea632aeb6429eb6628ec6726ed6925ee6a24ef6c23ef6e21f06f20f1711ff1731df2741cf3761bf37819f47918f57b17f57d15f67e14f68013f78212f78410f8850ff8870ef8890cf98b0bf98c0af98e09fa9008fa9207fa9407fb9606fb9706fb9906fb9b06fb9d07fc9f07fca108fca309fca50afca60cfca80dfcaa0ffcac11fcae12fcb014fcb216fcb418fbb61afbb81dfbba1ffbbc21fbbe23fac026fac228fac42afac62df9c72ff9c932f9cb35f8cd37f8cf3af7d13df7d340f6d543f6d746f5d949f5db4cf4dd4ff4df53f4e156f3e35af3e55df2e661f2e865f2ea69f1ec6df1ed71f1ef75f1f179f2f27df2f482f3f586f3f68af4f88ef5f992f6fa96f8fb9af9fc9dfafda1fcffa4")),eb=Q_(Dv("0d088710078813078916078a19068c1b068d1d068e20068f2206902406912605912805922a05932c05942e05952f059631059733059735049837049938049a3a049a3c049b3e049c3f049c41049d43039e44039e46039f48039f4903a04b03a14c02a14e02a25002a25102a35302a35502a45601a45801a45901a55b01a55c01a65e01a66001a66100a76300a76400a76600a76700a86900a86a00a86c00a86e00a86f00a87100a87201a87401a87501a87701a87801a87a02a87b02a87d03a87e03a88004a88104a78305a78405a78606a68707a68808a68a09a58b0aa58d0ba58e0ca48f0da4910ea3920fa39410a29511a19613a19814a099159f9a169f9c179e9d189d9e199da01a9ca11b9ba21d9aa31e9aa51f99a62098a72197a82296aa2395ab2494ac2694ad2793ae2892b02991b12a90b22b8fb32c8eb42e8db52f8cb6308bb7318ab83289ba3388bb3488bc3587bd3786be3885bf3984c03a83c13b82c23c81c33d80c43e7fc5407ec6417dc7427cc8437bc9447aca457acb4679cc4778cc4977cd4a76ce4b75cf4c74d04d73d14e72d24f71d35171d45270d5536fd5546ed6556dd7566cd8576bd9586ada5a6ada5b69db5c68dc5d67dd5e66de5f65de6164df6263e06363e16462e26561e26660e3685fe4695ee56a5de56b5de66c5ce76e5be76f5ae87059e97158e97257ea7457eb7556eb7655ec7754ed7953ed7a52ee7b51ef7c51ef7e50f07f4ff0804ef1814df1834cf2844bf3854bf3874af48849f48948f58b47f58c46f68d45f68f44f79044f79143f79342f89441f89540f9973ff9983ef99a3efa9b3dfa9c3cfa9e3bfb9f3afba139fba238fca338fca537fca636fca835fca934fdab33fdac33fdae32fdaf31fdb130fdb22ffdb42ffdb52efeb72dfeb82cfeba2cfebb2bfebd2afebe2afec029fdc229fdc328fdc527fdc627fdc827fdca26fdcb26fccd25fcce25fcd025fcd225fbd324fbd524fbd724fad824fada24f9dc24f9dd25f8df25f8e125f7e225f7e425f6e626f6e826f5e926f5eb27f4ed27f3ee27f3f027f2f227f1f426f1f525f0f724f0f921"));function rb(t){return function(){return t}}var ib=Math.abs,ob=Math.atan2,ab=Math.cos,ub=Math.max,cb=Math.min,fb=Math.sin,sb=Math.sqrt,lb=1e-12,hb=Math.PI,db=hb/2,pb=2*hb;function gb(t){return t>1?0:t<-1?hb:Math.acos(t)}function yb(t){return t>=1?db:t<=-1?-db:Math.asin(t)}function vb(t){return t.innerRadius}function _b(t){return t.outerRadius}function bb(t){return t.startAngle}function mb(t){return t.endAngle}function xb(t){return t&&t.padAngle}function wb(t,n,e,r,i,o,a,u){var c=e-t,f=r-n,s=a-i,l=u-o,h=l*c-s*f;if(!(h*h<lb))return[t+(h=(s*(n-o)-l*(t-i))/h)*c,n+h*f]}function Mb(t,n,e,r,i,o,a){var u=t-e,c=n-r,f=(a?o:-o)/sb(u*u+c*c),s=f*c,l=-f*u,h=t+s,d=n+l,p=e+s,g=r+l,y=(h+p)/2,v=(d+g)/2,_=p-h,b=g-d,m=_*_+b*b,x=i-o,w=h*g-p*d,M=(b<0?-1:1)*sb(ub(0,x*x*m-w*w)),A=(w*b-_*M)/m,T=(-w*_-b*M)/m,S=(w*b+_*M)/m,E=(-w*_+b*M)/m,k=A-y,N=T-v,C=S-y,P=E-v;return k*k+N*N>C*C+P*P&&(A=S,T=E),{cx:A,cy:T,x01:-s,y01:-l,x11:A*(i/x-1),y11:T*(i/x-1)}}var Ab=Array.prototype.slice;function Tb(t){return"object"==typeof t&&"length"in t?t:Array.from(t)}function Sb(t){this._context=t}function Eb(t){return new Sb(t)}function kb(t){return t[0]}function Nb(t){return t[1]}function Cb(t,n){var e=rb(!0),r=null,i=Eb,o=null;function a(a){var u,c,f,s=(a=Tb(a)).length,l=!1;for(null==r&&(o=i(f=fa())),u=0;u<=s;++u)!(u<s&&e(c=a[u],u,a))===l&&((l=!l)?o.lineStart():o.lineEnd()),l&&o.point(+t(c,u,a),+n(c,u,a));if(f)return o=null,f+""||null}return t="function"==typeof t?t:void 0===t?kb:rb(t),n="function"==typeof n?n:void 0===n?Nb:rb(n),a.x=function(n){return arguments.length?(t="function"==typeof n?n:rb(+n),a):t},a.y=function(t){return arguments.length?(n="function"==typeof t?t:rb(+t),a):n},a.defined=function(t){return arguments.length?(e="function"==typeof t?t:rb(!!t),a):e},a.curve=function(t){return arguments.length?(i=t,null!=r&&(o=i(r)),a):i},a.context=function(t){return arguments.length?(null==t?r=o=null:o=i(r=t),a):r},a}function Pb(t,n,e){var r=null,i=rb(!0),o=null,a=Eb,u=null;function c(c){var f,s,l,h,d,p=(c=Tb(c)).length,g=!1,y=new Array(p),v=new Array(p);for(null==o&&(u=a(d=fa())),f=0;f<=p;++f){if(!(f<p&&i(h=c[f],f,c))===g)if(g=!g)s=f,u.areaStart(),u.lineStart();else{for(u.lineEnd(),u.lineStart(),l=f-1;l>=s;--l)u.point(y[l],v[l]);u.lineEnd(),u.areaEnd()}g&&(y[f]=+t(h,f,c),v[f]=+n(h,f,c),u.point(r?+r(h,f,c):y[f],e?+e(h,f,c):v[f]))}if(d)return u=null,d+""||null}function f(){return Cb().defined(i).curve(a).context(o)}return t="function"==typeof t?t:void 0===t?kb:rb(+t),n="function"==typeof n?n:rb(void 0===n?0:+n),e="function"==typeof e?e:void 0===e?Nb:rb(+e),c.x=function(n){return arguments.length?(t="function"==typeof n?n:rb(+n),r=null,c):t},c.x0=function(n){return arguments.length?(t="function"==typeof n?n:rb(+n),c):t},c.x1=function(t){return arguments.length?(r=null==t?null:"function"==typeof t?t:rb(+t),c):r},c.y=function(t){return arguments.length?(n="function"==typeof t?t:rb(+t),e=null,c):n},c.y0=function(t){return arguments.length?(n="function"==typeof t?t:rb(+t),c):n},c.y1=function(t){return arguments.length?(e=null==t?null:"function"==typeof t?t:rb(+t),c):e},c.lineX0=c.lineY0=function(){return f().x(t).y(n)},c.lineY1=function(){return f().x(t).y(e)},c.lineX1=function(){return f().x(r).y(n)},c.defined=function(t){return arguments.length?(i="function"==typeof t?t:rb(!!t),c):i},c.curve=function(t){return arguments.length?(a=t,null!=o&&(u=a(o)),c):a},c.context=function(t){return arguments.length?(null==t?o=u=null:u=a(o=t),c):o},c}function zb(t,n){return n<t?-1:n>t?1:n>=t?0:NaN}function Db(t){return t}Sb.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._point=0},lineEnd:function(){(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1,this._line?this._context.lineTo(t,n):this._context.moveTo(t,n);break;case 1:this._point=2;default:this._context.lineTo(t,n)}}};var qb=Fb(Eb);function Rb(t){this._curve=t}function Fb(t){function n(n){return new Rb(t(n))}return n._curve=t,n}function Ob(t){var n=t.curve;return t.angle=t.x,delete t.x,t.radius=t.y,delete t.y,t.curve=function(t){return arguments.length?n(Fb(t)):n()._curve},t}function Ib(){return Ob(Cb().curve(qb))}function Ub(){var t=Pb().curve(qb),n=t.curve,e=t.lineX0,r=t.lineX1,i=t.lineY0,o=t.lineY1;return t.angle=t.x,delete t.x,t.startAngle=t.x0,delete t.x0,t.endAngle=t.x1,delete t.x1,t.radius=t.y,delete t.y,t.innerRadius=t.y0,delete t.y0,t.outerRadius=t.y1,delete t.y1,t.lineStartAngle=function(){return Ob(e())},delete t.lineX0,t.lineEndAngle=function(){return Ob(r())},delete t.lineX1,t.lineInnerRadius=function(){return Ob(i())},delete t.lineY0,t.lineOuterRadius=function(){return Ob(o())},delete t.lineY1,t.curve=function(t){return arguments.length?n(Fb(t)):n()._curve},t}function Bb(t,n){return[(n=+n)*Math.cos(t-=Math.PI/2),n*Math.sin(t)]}function Yb(t){return t.source}function Lb(t){return t.target}function jb(t){var n=Yb,e=Lb,r=kb,i=Nb,o=null;function a(){var a,u=Ab.call(arguments),c=n.apply(this,u),f=e.apply(this,u);if(o||(o=a=fa()),t(o,+r.apply(this,(u[0]=c,u)),+i.apply(this,u),+r.apply(this,(u[0]=f,u)),+i.apply(this,u)),a)return o=null,a+""||null}return a.source=function(t){return arguments.length?(n=t,a):n},a.target=function(t){return arguments.length?(e=t,a):e},a.x=function(t){return arguments.length?(r="function"==typeof t?t:rb(+t),a):r},a.y=function(t){return arguments.length?(i="function"==typeof t?t:rb(+t),a):i},a.context=function(t){return arguments.length?(o=null==t?null:t,a):o},a}function Hb(t,n,e,r,i){t.moveTo(n,e),t.bezierCurveTo(n=(n+r)/2,e,n,i,r,i)}function Xb(t,n,e,r,i){t.moveTo(n,e),t.bezierCurveTo(n,e=(e+i)/2,r,e,r,i)}function Gb(t,n,e,r,i){var o=Bb(n,e),a=Bb(n,e=(e+i)/2),u=Bb(r,e),c=Bb(r,i);t.moveTo(o[0],o[1]),t.bezierCurveTo(a[0],a[1],u[0],u[1],c[0],c[1])}Rb.prototype={areaStart:function(){this._curve.areaStart()},areaEnd:function(){this._curve.areaEnd()},lineStart:function(){this._curve.lineStart()},lineEnd:function(){this._curve.lineEnd()},point:function(t,n){this._curve.point(n*Math.sin(t),n*-Math.cos(t))}};var Vb={draw:function(t,n){var e=Math.sqrt(n/hb);t.moveTo(e,0),t.arc(0,0,e,0,pb)}},$b={draw:function(t,n){var e=Math.sqrt(n/5)/2;t.moveTo(-3*e,-e),t.lineTo(-e,-e),t.lineTo(-e,-3*e),t.lineTo(e,-3*e),t.lineTo(e,-e),t.lineTo(3*e,-e),t.lineTo(3*e,e),t.lineTo(e,e),t.lineTo(e,3*e),t.lineTo(-e,3*e),t.lineTo(-e,e),t.lineTo(-3*e,e),t.closePath()}},Wb=Math.sqrt(1/3),Zb=2*Wb,Kb={draw:function(t,n){var e=Math.sqrt(n/Zb),r=e*Wb;t.moveTo(0,-e),t.lineTo(r,0),t.lineTo(0,e),t.lineTo(-r,0),t.closePath()}},Qb=Math.sin(hb/10)/Math.sin(7*hb/10),Jb=Math.sin(pb/10)*Qb,tm=-Math.cos(pb/10)*Qb,nm={draw:function(t,n){var e=Math.sqrt(.8908130915292852*n),r=Jb*e,i=tm*e;t.moveTo(0,-e),t.lineTo(r,i);for(var o=1;o<5;++o){var a=pb*o/5,u=Math.cos(a),c=Math.sin(a);t.lineTo(c*e,-u*e),t.lineTo(u*r-c*i,c*r+u*i)}t.closePath()}},em={draw:function(t,n){var e=Math.sqrt(n),r=-e/2;t.rect(r,r,e,e)}},rm=Math.sqrt(3),im={draw:function(t,n){var e=-Math.sqrt(n/(3*rm));t.moveTo(0,2*e),t.lineTo(-rm*e,-e),t.lineTo(rm*e,-e),t.closePath()}},om=-.5,am=Math.sqrt(3)/2,um=1/Math.sqrt(12),cm=3*(um/2+1),fm={draw:function(t,n){var e=Math.sqrt(n/cm),r=e/2,i=e*um,o=r,a=e*um+e,u=-o,c=a;t.moveTo(r,i),t.lineTo(o,a),t.lineTo(u,c),t.lineTo(om*r-am*i,am*r+om*i),t.lineTo(om*o-am*a,am*o+om*a),t.lineTo(om*u-am*c,am*u+om*c),t.lineTo(om*r+am*i,om*i-am*r),t.lineTo(om*o+am*a,om*a-am*o),t.lineTo(om*u+am*c,om*c-am*u),t.closePath()}},sm=[Vb,$b,Kb,em,nm,im,fm];function lm(){}function hm(t,n,e){t._context.bezierCurveTo((2*t._x0+t._x1)/3,(2*t._y0+t._y1)/3,(t._x0+2*t._x1)/3,(t._y0+2*t._y1)/3,(t._x0+4*t._x1+n)/6,(t._y0+4*t._y1+e)/6)}function dm(t){this._context=t}function pm(t){this._context=t}function gm(t){this._context=t}dm.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._y0=this._y1=NaN,this._point=0},lineEnd:function(){switch(this._point){case 3:hm(this,this._x1,this._y1);case 2:this._context.lineTo(this._x1,this._y1)}(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1,this._line?this._context.lineTo(t,n):this._context.moveTo(t,n);break;case 1:this._point=2;break;case 2:this._point=3,this._context.lineTo((5*this._x0+this._x1)/6,(5*this._y0+this._y1)/6);default:hm(this,t,n)}this._x0=this._x1,this._x1=t,this._y0=this._y1,this._y1=n}},pm.prototype={areaStart:lm,areaEnd:lm,lineStart:function(){this._x0=this._x1=this._x2=this._x3=this._x4=this._y0=this._y1=this._y2=this._y3=this._y4=NaN,this._point=0},lineEnd:function(){switch(this._point){case 1:this._context.moveTo(this._x2,this._y2),this._context.closePath();break;case 2:this._context.moveTo((this._x2+2*this._x3)/3,(this._y2+2*this._y3)/3),this._context.lineTo((this._x3+2*this._x2)/3,(this._y3+2*this._y2)/3),this._context.closePath();break;case 3:this.point(this._x2,this._y2),this.point(this._x3,this._y3),this.point(this._x4,this._y4)}},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1,this._x2=t,this._y2=n;break;case 1:this._point=2,this._x3=t,this._y3=n;break;case 2:this._point=3,this._x4=t,this._y4=n,this._context.moveTo((this._x0+4*this._x1+t)/6,(this._y0+4*this._y1+n)/6);break;default:hm(this,t,n)}this._x0=this._x1,this._x1=t,this._y0=this._y1,this._y1=n}},gm.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._y0=this._y1=NaN,this._point=0},lineEnd:function(){(this._line||0!==this._line&&3===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1;break;case 1:this._point=2;break;case 2:this._point=3;var e=(this._x0+4*this._x1+t)/6,r=(this._y0+4*this._y1+n)/6;this._line?this._context.lineTo(e,r):this._context.moveTo(e,r);break;case 3:this._point=4;default:hm(this,t,n)}this._x0=this._x1,this._x1=t,this._y0=this._y1,this._y1=n}};class ym{constructor(t,n){this._context=t,this._x=n}areaStart(){this._line=0}areaEnd(){this._line=NaN}lineStart(){this._point=0}lineEnd(){(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line}point(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1,this._line?this._context.lineTo(t,n):this._context.moveTo(t,n);break;case 1:this._point=2;default:this._x?this._context.bezierCurveTo(this._x0=(this._x0+t)/2,this._y0,this._x0,n,t,n):this._context.bezierCurveTo(this._x0,this._y0=(this._y0+n)/2,t,this._y0,t,n)}this._x0=t,this._y0=n}}function vm(t,n){this._basis=new dm(t),this._beta=n}vm.prototype={lineStart:function(){this._x=[],this._y=[],this._basis.lineStart()},lineEnd:function(){var t=this._x,n=this._y,e=t.length-1;if(e>0)for(var r,i=t[0],o=n[0],a=t[e]-i,u=n[e]-o,c=-1;++c<=e;)r=c/e,this._basis.point(this._beta*t[c]+(1-this._beta)*(i+r*a),this._beta*n[c]+(1-this._beta)*(o+r*u));this._x=this._y=null,this._basis.lineEnd()},point:function(t,n){this._x.push(+t),this._y.push(+n)}};var _m=function t(n){function e(t){return 1===n?new dm(t):new vm(t,n)}return e.beta=function(n){return t(+n)},e}(.85);function bm(t,n,e){t._context.bezierCurveTo(t._x1+t._k*(t._x2-t._x0),t._y1+t._k*(t._y2-t._y0),t._x2+t._k*(t._x1-n),t._y2+t._k*(t._y1-e),t._x2,t._y2)}function mm(t,n){this._context=t,this._k=(1-n)/6}mm.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._x2=this._y0=this._y1=this._y2=NaN,this._point=0},lineEnd:function(){switch(this._point){case 2:this._context.lineTo(this._x2,this._y2);break;case 3:bm(this,this._x1,this._y1)}(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1,this._line?this._context.lineTo(t,n):this._context.moveTo(t,n);break;case 1:this._point=2,this._x1=t,this._y1=n;break;case 2:this._point=3;default:bm(this,t,n)}this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=n}};var xm=function t(n){function e(t){return new mm(t,n)}return e.tension=function(n){return t(+n)},e}(0);function wm(t,n){this._context=t,this._k=(1-n)/6}wm.prototype={areaStart:lm,areaEnd:lm,lineStart:function(){this._x0=this._x1=this._x2=this._x3=this._x4=this._x5=this._y0=this._y1=this._y2=this._y3=this._y4=this._y5=NaN,this._point=0},lineEnd:function(){switch(this._point){case 1:this._context.moveTo(this._x3,this._y3),this._context.closePath();break;case 2:this._context.lineTo(this._x3,this._y3),this._context.closePath();break;case 3:this.point(this._x3,this._y3),this.point(this._x4,this._y4),this.point(this._x5,this._y5)}},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1,this._x3=t,this._y3=n;break;case 1:this._point=2,this._context.moveTo(this._x4=t,this._y4=n);break;case 2:this._point=3,this._x5=t,this._y5=n;break;default:bm(this,t,n)}this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=n}};var Mm=function t(n){function e(t){return new wm(t,n)}return e.tension=function(n){return t(+n)},e}(0);function Am(t,n){this._context=t,this._k=(1-n)/6}Am.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._x2=this._y0=this._y1=this._y2=NaN,this._point=0},lineEnd:function(){(this._line||0!==this._line&&3===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1;break;case 1:this._point=2;break;case 2:this._point=3,this._line?this._context.lineTo(this._x2,this._y2):this._context.moveTo(this._x2,this._y2);break;case 3:this._point=4;default:bm(this,t,n)}this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=n}};var Tm=function t(n){function e(t){return new Am(t,n)}return e.tension=function(n){return t(+n)},e}(0);function Sm(t,n,e){var r=t._x1,i=t._y1,o=t._x2,a=t._y2;if(t._l01_a>lb){var u=2*t._l01_2a+3*t._l01_a*t._l12_a+t._l12_2a,c=3*t._l01_a*(t._l01_a+t._l12_a);r=(r*u-t._x0*t._l12_2a+t._x2*t._l01_2a)/c,i=(i*u-t._y0*t._l12_2a+t._y2*t._l01_2a)/c}if(t._l23_a>lb){var f=2*t._l23_2a+3*t._l23_a*t._l12_a+t._l12_2a,s=3*t._l23_a*(t._l23_a+t._l12_a);o=(o*f+t._x1*t._l23_2a-n*t._l12_2a)/s,a=(a*f+t._y1*t._l23_2a-e*t._l12_2a)/s}t._context.bezierCurveTo(r,i,o,a,t._x2,t._y2)}function Em(t,n){this._context=t,this._alpha=n}Em.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._x2=this._y0=this._y1=this._y2=NaN,this._l01_a=this._l12_a=this._l23_a=this._l01_2a=this._l12_2a=this._l23_2a=this._point=0},lineEnd:function(){switch(this._point){case 2:this._context.lineTo(this._x2,this._y2);break;case 3:this.point(this._x2,this._y2)}(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){if(t=+t,n=+n,this._point){var e=this._x2-t,r=this._y2-n;this._l23_a=Math.sqrt(this._l23_2a=Math.pow(e*e+r*r,this._alpha))}switch(this._point){case 0:this._point=1,this._line?this._context.lineTo(t,n):this._context.moveTo(t,n);break;case 1:this._point=2;break;case 2:this._point=3;default:Sm(this,t,n)}this._l01_a=this._l12_a,this._l12_a=this._l23_a,this._l01_2a=this._l12_2a,this._l12_2a=this._l23_2a,this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=n}};var km=function t(n){function e(t){return n?new Em(t,n):new mm(t,0)}return e.alpha=function(n){return t(+n)},e}(.5);function Nm(t,n){this._context=t,this._alpha=n}Nm.prototype={areaStart:lm,areaEnd:lm,lineStart:function(){this._x0=this._x1=this._x2=this._x3=this._x4=this._x5=this._y0=this._y1=this._y2=this._y3=this._y4=this._y5=NaN,this._l01_a=this._l12_a=this._l23_a=this._l01_2a=this._l12_2a=this._l23_2a=this._point=0},lineEnd:function(){switch(this._point){case 1:this._context.moveTo(this._x3,this._y3),this._context.closePath();break;case 2:this._context.lineTo(this._x3,this._y3),this._context.closePath();break;case 3:this.point(this._x3,this._y3),this.point(this._x4,this._y4),this.point(this._x5,this._y5)}},point:function(t,n){if(t=+t,n=+n,this._point){var e=this._x2-t,r=this._y2-n;this._l23_a=Math.sqrt(this._l23_2a=Math.pow(e*e+r*r,this._alpha))}switch(this._point){case 0:this._point=1,this._x3=t,this._y3=n;break;case 1:this._point=2,this._context.moveTo(this._x4=t,this._y4=n);break;case 2:this._point=3,this._x5=t,this._y5=n;break;default:Sm(this,t,n)}this._l01_a=this._l12_a,this._l12_a=this._l23_a,this._l01_2a=this._l12_2a,this._l12_2a=this._l23_2a,this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=n}};var Cm=function t(n){function e(t){return n?new Nm(t,n):new wm(t,0)}return e.alpha=function(n){return t(+n)},e}(.5);function Pm(t,n){this._context=t,this._alpha=n}Pm.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._x2=this._y0=this._y1=this._y2=NaN,this._l01_a=this._l12_a=this._l23_a=this._l01_2a=this._l12_2a=this._l23_2a=this._point=0},lineEnd:function(){(this._line||0!==this._line&&3===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){if(t=+t,n=+n,this._point){var e=this._x2-t,r=this._y2-n;this._l23_a=Math.sqrt(this._l23_2a=Math.pow(e*e+r*r,this._alpha))}switch(this._point){case 0:this._point=1;break;case 1:this._point=2;break;case 2:this._point=3,this._line?this._context.lineTo(this._x2,this._y2):this._context.moveTo(this._x2,this._y2);break;case 3:this._point=4;default:Sm(this,t,n)}this._l01_a=this._l12_a,this._l12_a=this._l23_a,this._l01_2a=this._l12_2a,this._l12_2a=this._l23_2a,this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=n}};var zm=function t(n){function e(t){return n?new Pm(t,n):new Am(t,0)}return e.alpha=function(n){return t(+n)},e}(.5);function Dm(t){this._context=t}function qm(t){return t<0?-1:1}function Rm(t,n,e){var r=t._x1-t._x0,i=n-t._x1,o=(t._y1-t._y0)/(r||i<0&&-0),a=(e-t._y1)/(i||r<0&&-0),u=(o*i+a*r)/(r+i);return(qm(o)+qm(a))*Math.min(Math.abs(o),Math.abs(a),.5*Math.abs(u))||0}function Fm(t,n){var e=t._x1-t._x0;return e?(3*(t._y1-t._y0)/e-n)/2:n}function Om(t,n,e){var r=t._x0,i=t._y0,o=t._x1,a=t._y1,u=(o-r)/3;t._context.bezierCurveTo(r+u,i+u*n,o-u,a-u*e,o,a)}function Im(t){this._context=t}function Um(t){this._context=new Bm(t)}function Bm(t){this._context=t}function Ym(t){this._context=t}function Lm(t){var n,e,r=t.length-1,i=new Array(r),o=new Array(r),a=new Array(r);for(i[0]=0,o[0]=2,a[0]=t[0]+2*t[1],n=1;n<r-1;++n)i[n]=1,o[n]=4,a[n]=4*t[n]+2*t[n+1];for(i[r-1]=2,o[r-1]=7,a[r-1]=8*t[r-1]+t[r],n=1;n<r;++n)e=i[n]/o[n-1],o[n]-=e,a[n]-=e*a[n-1];for(i[r-1]=a[r-1]/o[r-1],n=r-2;n>=0;--n)i[n]=(a[n]-i[n+1])/o[n];for(o[r-1]=(t[r]+i[r-1])/2,n=0;n<r-1;++n)o[n]=2*t[n+1]-i[n+1];return[i,o]}function jm(t,n){this._context=t,this._t=n}function Hm(t,n){if((i=t.length)>1)for(var e,r,i,o=1,a=t[n[0]],u=a.length;o<i;++o)for(r=a,a=t[n[o]],e=0;e<u;++e)a[e][1]+=a[e][0]=isNaN(r[e][1])?r[e][0]:r[e][1]}function Xm(t){for(var n=t.length,e=new Array(n);--n>=0;)e[n]=n;return e}function Gm(t,n){return t[n]}function Vm(t){const n=[];return n.key=t,n}function $m(t){var n=t.map(Wm);return Xm(t).sort((function(t,e){return n[t]-n[e]}))}function Wm(t){for(var n,e=-1,r=0,i=t.length,o=-1/0;++e<i;)(n=+t[e][1])>o&&(o=n,r=e);return r}function Zm(t){var n=t.map(Km);return Xm(t).sort((function(t,e){return n[t]-n[e]}))}function Km(t){for(var n,e=0,r=-1,i=t.length;++r<i;)(n=+t[r][1])&&(e+=n);return e}Dm.prototype={areaStart:lm,areaEnd:lm,lineStart:function(){this._point=0},lineEnd:function(){this._point&&this._context.closePath()},point:function(t,n){t=+t,n=+n,this._point?this._context.lineTo(t,n):(this._point=1,this._context.moveTo(t,n))}},Im.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._y0=this._y1=this._t0=NaN,this._point=0},lineEnd:function(){switch(this._point){case 2:this._context.lineTo(this._x1,this._y1);break;case 3:Om(this,this._t0,Fm(this,this._t0))}(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){var e=NaN;if(n=+n,(t=+t)!==this._x1||n!==this._y1){switch(this._point){case 0:this._point=1,this._line?this._context.lineTo(t,n):this._context.moveTo(t,n);break;case 1:this._point=2;break;case 2:this._point=3,Om(this,Fm(this,e=Rm(this,t,n)),e);break;default:Om(this,this._t0,e=Rm(this,t,n))}this._x0=this._x1,this._x1=t,this._y0=this._y1,this._y1=n,this._t0=e}}},(Um.prototype=Object.create(Im.prototype)).point=function(t,n){Im.prototype.point.call(this,n,t)},Bm.prototype={moveTo:function(t,n){this._context.moveTo(n,t)},closePath:function(){this._context.closePath()},lineTo:function(t,n){this._context.lineTo(n,t)},bezierCurveTo:function(t,n,e,r,i,o){this._context.bezierCurveTo(n,t,r,e,o,i)}},Ym.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x=[],this._y=[]},lineEnd:function(){var t=this._x,n=this._y,e=t.length;if(e)if(this._line?this._context.lineTo(t[0],n[0]):this._context.moveTo(t[0],n[0]),2===e)this._context.lineTo(t[1],n[1]);else for(var r=Lm(t),i=Lm(n),o=0,a=1;a<e;++o,++a)this._context.bezierCurveTo(r[0][o],i[0][o],r[1][o],i[1][o],t[a],n[a]);(this._line||0!==this._line&&1===e)&&this._context.closePath(),this._line=1-this._line,this._x=this._y=null},point:function(t,n){this._x.push(+t),this._y.push(+n)}},jm.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x=this._y=NaN,this._point=0},lineEnd:function(){0<this._t&&this._t<1&&2===this._point&&this._context.lineTo(this._x,this._y),(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line>=0&&(this._t=1-this._t,this._line=1-this._line)},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1,this._line?this._context.lineTo(t,n):this._context.moveTo(t,n);break;case 1:this._point=2;default:if(this._t<=0)this._context.lineTo(this._x,n),this._context.lineTo(t,n);else{var e=this._x*(1-this._t)+t*this._t;this._context.lineTo(e,this._y),this._context.lineTo(e,n)}}this._x=t,this._y=n}};var Qm=t=>()=>t;function Jm(t,{sourceEvent:n,target:e,transform:r,dispatch:i}){Object.defineProperties(this,{type:{value:t,enumerable:!0,configurable:!0},sourceEvent:{value:n,enumerable:!0,configurable:!0},target:{value:e,enumerable:!0,configurable:!0},transform:{value:r,enumerable:!0,configurable:!0},_:{value:i}})}function tx(t,n,e){this.k=t,this.x=n,this.y=e}tx.prototype={constructor:tx,scale:function(t){return 1===t?this:new tx(this.k*t,this.x,this.y)},translate:function(t,n){return 0===t&0===n?this:new tx(this.k,this.x+this.k*t,this.y+this.k*n)},apply:function(t){return[t[0]*this.k+this.x,t[1]*this.k+this.y]},applyX:function(t){return t*this.k+this.x},applyY:function(t){return t*this.k+this.y},invert:function(t){return[(t[0]-this.x)/this.k,(t[1]-this.y)/this.k]},invertX:function(t){return(t-this.x)/this.k},invertY:function(t){return(t-this.y)/this.k},rescaleX:function(t){return t.copy().domain(t.range().map(this.invertX,this).map(t.invert,t))},rescaleY:function(t){return t.copy().domain(t.range().map(this.invertY,this).map(t.invert,t))},toString:function(){return"translate("+this.x+","+this.y+") scale("+this.k+")"}};var nx=new tx(1,0,0);function ex(t){for(;!t.__zoom;)if(!(t=t.parentNode))return nx;return t.__zoom}function rx(t){t.stopImmediatePropagation()}function ix(t){t.preventDefault(),t.stopImmediatePropagation()}function ox(t){return!(t.ctrlKey&&"wheel"!==t.type||t.button)}function ax(){var t=this;return t instanceof SVGElement?(t=t.ownerSVGElement||t).hasAttribute("viewBox")?[[(t=t.viewBox.baseVal).x,t.y],[t.x+t.width,t.y+t.height]]:[[0,0],[t.width.baseVal.value,t.height.baseVal.value]]:[[0,0],[t.clientWidth,t.clientHeight]]}function ux(){return this.__zoom||nx}function cx(t){return-t.deltaY*(1===t.deltaMode?.05:t.deltaMode?1:.002)*(t.ctrlKey?10:1)}function fx(){return navigator.maxTouchPoints||"ontouchstart"in this}function sx(t,n,e){var r=t.invertX(n[0][0])-e[0][0],i=t.invertX(n[1][0])-e[1][0],o=t.invertY(n[0][1])-e[0][1],a=t.invertY(n[1][1])-e[1][1];return t.translate(i>r?(r+i)/2:Math.min(0,r)||Math.max(0,i),a>o?(o+a)/2:Math.min(0,o)||Math.max(0,a))}ex.prototype=tx.prototype,t.Adder=g,t.Delaunay=nu,t.FormatSpecifier=uc,t.InternMap=y,t.InternSet=v,t.Voronoi=Wa,t.active=function(t,n){var e,r,i=t.__transition;if(i)for(r in n=null==n?null:n+"",i)if((e=i[r]).state>1&&e.name===n)return new ji([[t]],_o,n,+r);return null},t.arc=function(){var t=vb,n=_b,e=rb(0),r=null,i=bb,o=mb,a=xb,u=null;function c(){var c,f,s=+t.apply(this,arguments),l=+n.apply(this,arguments),h=i.apply(this,arguments)-db,d=o.apply(this,arguments)-db,p=ib(d-h),g=d>h;if(u||(u=c=fa()),l<s&&(f=l,l=s,s=f),l>lb)if(p>pb-lb)u.moveTo(l*ab(h),l*fb(h)),u.arc(0,0,l,h,d,!g),s>lb&&(u.moveTo(s*ab(d),s*fb(d)),u.arc(0,0,s,d,h,g));else{var y,v,_=h,b=d,m=h,x=d,w=p,M=p,A=a.apply(this,arguments)/2,T=A>lb&&(r?+r.apply(this,arguments):sb(s*s+l*l)),S=cb(ib(l-s)/2,+e.apply(this,arguments)),E=S,k=S;if(T>lb){var N=yb(T/s*fb(A)),C=yb(T/l*fb(A));(w-=2*N)>lb?(m+=N*=g?1:-1,x-=N):(w=0,m=x=(h+d)/2),(M-=2*C)>lb?(_+=C*=g?1:-1,b-=C):(M=0,_=b=(h+d)/2)}var P=l*ab(_),z=l*fb(_),D=s*ab(x),q=s*fb(x);if(S>lb){var R,F=l*ab(b),O=l*fb(b),I=s*ab(m),U=s*fb(m);if(p<hb&&(R=wb(P,z,I,U,F,O,D,q))){var B=P-R[0],Y=z-R[1],L=F-R[0],j=O-R[1],H=1/fb(gb((B*L+Y*j)/(sb(B*B+Y*Y)*sb(L*L+j*j)))/2),X=sb(R[0]*R[0]+R[1]*R[1]);E=cb(S,(s-X)/(H-1)),k=cb(S,(l-X)/(H+1))}}M>lb?k>lb?(y=Mb(I,U,P,z,l,k,g),v=Mb(F,O,D,q,l,k,g),u.moveTo(y.cx+y.x01,y.cy+y.y01),k<S?u.arc(y.cx,y.cy,k,ob(y.y01,y.x01),ob(v.y01,v.x01),!g):(u.arc(y.cx,y.cy,k,ob(y.y01,y.x01),ob(y.y11,y.x11),!g),u.arc(0,0,l,ob(y.cy+y.y11,y.cx+y.x11),ob(v.cy+v.y11,v.cx+v.x11),!g),u.arc(v.cx,v.cy,k,ob(v.y11,v.x11),ob(v.y01,v.x01),!g))):(u.moveTo(P,z),u.arc(0,0,l,_,b,!g)):u.moveTo(P,z),s>lb&&w>lb?E>lb?(y=Mb(D,q,F,O,s,-E,g),v=Mb(P,z,I,U,s,-E,g),u.lineTo(y.cx+y.x01,y.cy+y.y01),E<S?u.arc(y.cx,y.cy,E,ob(y.y01,y.x01),ob(v.y01,v.x01),!g):(u.arc(y.cx,y.cy,E,ob(y.y01,y.x01),ob(y.y11,y.x11),!g),u.arc(0,0,s,ob(y.cy+y.y11,y.cx+y.x11),ob(v.cy+v.y11,v.cx+v.x11),g),u.arc(v.cx,v.cy,E,ob(v.y11,v.x11),ob(v.y01,v.x01),!g))):u.arc(0,0,s,x,m,g):u.lineTo(D,q)}else u.moveTo(0,0);if(u.closePath(),c)return u=null,c+""||null}return c.centroid=function(){var e=(+t.apply(this,arguments)+ +n.apply(this,arguments))/2,r=(+i.apply(this,arguments)+ +o.apply(this,arguments))/2-hb/2;return[ab(r)*e,fb(r)*e]},c.innerRadius=function(n){return arguments.length?(t="function"==typeof n?n:rb(+n),c):t},c.outerRadius=function(t){return arguments.length?(n="function"==typeof t?t:rb(+t),c):n},c.cornerRadius=function(t){return arguments.length?(e="function"==typeof t?t:rb(+t),c):e},c.padRadius=function(t){return arguments.length?(r=null==t?null:"function"==typeof t?t:rb(+t),c):r},c.startAngle=function(t){return arguments.length?(i="function"==typeof t?t:rb(+t),c):i},c.endAngle=function(t){return arguments.length?(o="function"==typeof t?t:rb(+t),c):o},c.padAngle=function(t){return arguments.length?(a="function"==typeof t?t:rb(+t),c):a},c.context=function(t){return arguments.length?(u=null==t?null:t,c):u},c},t.area=Pb,t.areaRadial=Ub,t.ascending=n,t.autoType=function(t){for(var n in t){var e,r,i=t[n].trim();if(i)if("true"===i)i=!0;else if("false"===i)i=!1;else if("NaN"===i)i=NaN;else if(isNaN(e=+i)){if(!(r=i.match(/^([-+]\d{2})?\d{4}(-\d{2}(-\d{2})?)?(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[-+]\d{2}:\d{2})?)?$/)))continue;Tu&&r[4]&&!r[7]&&(i=i.replace(/-/g,"/").replace(/T/," ")),i=new Date(i)}else i=e;else i=null;t[n]=i}return t},t.axisBottom=function(t){return ht(3,t)},t.axisLeft=function(t){return ht(4,t)},t.axisRight=function(t){return ht(2,t)},t.axisTop=function(t){return ht(1,t)},t.bin=U,t.bisect=o,t.bisectCenter=u,t.bisectLeft=a,t.bisectRight=o,t.bisector=e,t.blob=function(t,n){return fetch(t,n).then(Su)},t.brush=function(){return Go(qo)},t.brushSelection=function(t){var n=t.__brush;return n?n.dim.output(n.selection):null},t.brushX=function(){return Go(zo)},t.brushY=function(){return Go(Do)},t.buffer=function(t,n){return fetch(t,n).then(Eu)},t.chord=function(){return ra(!1,!1)},t.chordDirected=function(){return ra(!0,!1)},t.chordTranspose=function(){return ra(!1,!0)},t.cluster=function(){var t=Yh,n=1,e=1,r=!1;function i(i){var o,a=0;i.eachAfter((function(n){var e=n.children;e?(n.x=function(t){return t.reduce(Lh,0)/t.length}(e),n.y=function(t){return 1+t.reduce(jh,0)}(e)):(n.x=o?a+=t(n,o):0,n.y=0,o=n)}));var u=function(t){for(var n;n=t.children;)t=n[0];return t}(i),c=function(t){for(var n;n=t.children;)t=n[n.length-1];return t}(i),f=u.x-t(u,c)/2,s=c.x+t(c,u)/2;return i.eachAfter(r?function(t){t.x=(t.x-i.x)*n,t.y=(i.y-t.y)*e}:function(t){t.x=(t.x-f)/(s-f)*n,t.y=(1-(i.y?t.y/i.y:1))*e})}return i.separation=function(n){return arguments.length?(t=n,i):t},i.size=function(t){return arguments.length?(r=!1,n=+t[0],e=+t[1],i):r?null:[n,e]},i.nodeSize=function(t){return arguments.length?(r=!0,n=+t[0],e=+t[1],i):r?[n,e]:null},i},t.color=de,t.contourDensity=function(){var t=Pa,n=za,e=Da,r=960,i=500,o=20,a=2,u=3*o,c=r+2*u>>a,f=i+2*u>>a,s=wa(20);function l(r){var i=new Float32Array(c*f),l=new Float32Array(c*f);r.forEach((function(r,o,s){var l=+t(r,o,s)+u>>a,h=+n(r,o,s)+u>>a,d=+e(r,o,s);l>=0&&l<c&&h>=0&&h<f&&(i[l+h*c]+=d)})),Na({width:c,height:f,data:i},{width:c,height:f,data:l},o>>a),Ca({width:c,height:f,data:l},{width:c,height:f,data:i},o>>a),Na({width:c,height:f,data:i},{width:c,height:f,data:l},o>>a),Ca({width:c,height:f,data:l},{width:c,height:f,data:i},o>>a),Na({width:c,height:f,data:i},{width:c,height:f,data:l},o>>a),Ca({width:c,height:f,data:l},{width:c,height:f,data:i},o>>a);var d=s(i);if(!Array.isArray(d)){var p=B(i);d=F(0,p,d),(d=Z(0,Math.floor(p/d)*d,d)).shift()}return ka().thresholds(d).size([c,f])(i).map(h)}function h(t){return t.value*=Math.pow(2,-2*a),t.coordinates.forEach(d),t}function d(t){t.forEach(p)}function p(t){t.forEach(g)}function g(t){t[0]=t[0]*Math.pow(2,a)-u,t[1]=t[1]*Math.pow(2,a)-u}function y(){return c=r+2*(u=3*o)>>a,f=i+2*u>>a,l}return l.x=function(n){return arguments.length?(t="function"==typeof n?n:wa(+n),l):t},l.y=function(t){return arguments.length?(n="function"==typeof t?t:wa(+t),l):n},l.weight=function(t){return arguments.length?(e="function"==typeof t?t:wa(+t),l):e},l.size=function(t){if(!arguments.length)return[r,i];var n=+t[0],e=+t[1];if(!(n>=0&&e>=0))throw new Error("invalid size");return r=n,i=e,y()},l.cellSize=function(t){if(!arguments.length)return 1<<a;if(!((t=+t)>=1))throw new Error("invalid cell size");return a=Math.floor(Math.log(t)/Math.LN2),y()},l.thresholds=function(t){return arguments.length?(s="function"==typeof t?t:Array.isArray(t)?wa(ma.call(t)):wa(t),l):s},l.bandwidth=function(t){if(!arguments.length)return Math.sqrt(o*(o+1));if(!((t=+t)>=0))throw new Error("invalid bandwidth");return o=Math.round((Math.sqrt(4*t*t+1)-1)/2),y()},l},t.contours=ka,t.count=c,t.create=function(t){return Dn(At(t).call(document.documentElement))},t.creator=At,t.cross=function(...t){const n="function"==typeof t[t.length-1]&&function(t){return n=>t(...n)}(t.pop()),e=(t=t.map(l)).map(f),r=t.length-1,i=new Array(r+1).fill(0),o=[];if(r<0||e.some(s))return o;for(;;){o.push(i.map(((n,e)=>t[e][n])));let a=r;for(;++i[a]===e[a];){if(0===a)return n?o.map(n):o;i[a--]=0}}},t.csv=Pu,t.csvFormat=hu,t.csvFormatBody=du,t.csvFormatRow=gu,t.csvFormatRows=pu,t.csvFormatValue=yu,t.csvParse=su,t.csvParseRows=lu,t.cubehelix=tr,t.cumsum=function(t,n){var e=0,r=0;return Float64Array.from(t,void 0===n?t=>e+=+t||0:i=>e+=+n(i,r++,t)||0)},t.curveBasis=function(t){return new dm(t)},t.curveBasisClosed=function(t){return new pm(t)},t.curveBasisOpen=function(t){return new gm(t)},t.curveBumpX=function(t){return new ym(t,!0)},t.curveBumpY=function(t){return new ym(t,!1)},t.curveBundle=_m,t.curveCardinal=xm,t.curveCardinalClosed=Mm,t.curveCardinalOpen=Tm,t.curveCatmullRom=km,t.curveCatmullRomClosed=Cm,t.curveCatmullRomOpen=zm,t.curveLinear=Eb,t.curveLinearClosed=function(t){return new Dm(t)},t.curveMonotoneX=function(t){return new Im(t)},t.curveMonotoneY=function(t){return new Um(t)},t.curveNatural=function(t){return new Ym(t)},t.curveStep=function(t){return new jm(t,.5)},t.curveStepAfter=function(t){return new jm(t,1)},t.curveStepBefore=function(t){return new jm(t,0)},t.descending=function(t,n){return n<t?-1:n>t?1:n>=t?0:NaN},t.deviation=d,t.difference=function(t,...n){t=new Set(t);for(const e of n)for(const n of e)t.delete(n);return t},t.disjoint=function(t,n){const e=n[Symbol.iterator](),r=new Set;for(const n of t){if(r.has(n))return!1;let t,i;for(;({value:t,done:i}=e.next())&&!i;){if(Object.is(n,t))return!1;r.add(t)}}return!0},t.dispatch=pt,t.drag=function(){var t,n,e,r,i=Xn,o=Gn,a=Vn,u=$n,c={},f=pt("start","drag","end"),s=0,l=0;function h(t){t.on("mousedown.drag",d).filter(u).on("touchstart.drag",y).on("touchmove.drag",v).on("touchend.drag touchcancel.drag",_).style("touch-action","none").style("-webkit-tap-highlight-color","rgba(0,0,0,0)")}function d(a,u){if(!r&&i.call(this,a,u)){var c=b(this,o.call(this,a,u),a,u,"mouse");c&&(Dn(a.view).on("mousemove.drag",p,!0).on("mouseup.drag",g,!0),Yn(a.view),Un(a),e=!1,t=a.clientX,n=a.clientY,c("start",a))}}function p(r){if(Bn(r),!e){var i=r.clientX-t,o=r.clientY-n;e=i*i+o*o>l}c.mouse("drag",r)}function g(t){Dn(t.view).on("mousemove.drag mouseup.drag",null),Ln(t.view,e),Bn(t),c.mouse("end",t)}function y(t,n){if(i.call(this,t,n)){var e,r,a=t.changedTouches,u=o.call(this,t,n),c=a.length;for(e=0;e<c;++e)(r=b(this,u,t,n,a[e].identifier,a[e]))&&(Un(t),r("start",t,a[e]))}}function v(t){var n,e,r=t.changedTouches,i=r.length;for(n=0;n<i;++n)(e=c[r[n].identifier])&&(Bn(t),e("drag",t,r[n]))}function _(t){var n,e,i=t.changedTouches,o=i.length;for(r&&clearTimeout(r),r=setTimeout((function(){r=null}),500),n=0;n<o;++n)(e=c[i[n].identifier])&&(Un(t),e("end",t,i[n]))}function b(t,n,e,r,i,o){var u,l,d,p=f.copy(),g=In(o||e,n);if(null!=(d=a.call(t,new Hn("beforestart",{sourceEvent:e,target:h,identifier:i,active:s,x:g[0],y:g[1],dx:0,dy:0,dispatch:p}),r)))return u=d.x-g[0]||0,l=d.y-g[1]||0,function e(o,a,f){var y,v=g;switch(o){case"start":c[i]=e,y=s++;break;case"end":delete c[i],--s;case"drag":g=In(f||a,n),y=s}p.call(o,t,new Hn(o,{sourceEvent:a,subject:d,target:h,identifier:i,active:y,x:g[0]+u,y:g[1]+l,dx:g[0]-v[0],dy:g[1]-v[1],dispatch:p}),r)}}return h.filter=function(t){return arguments.length?(i="function"==typeof t?t:jn(!!t),h):i},h.container=function(t){return arguments.length?(o="function"==typeof t?t:jn(t),h):o},h.subject=function(t){return arguments.length?(a="function"==typeof t?t:jn(t),h):a},h.touchable=function(t){return arguments.length?(u="function"==typeof t?t:jn(!!t),h):u},h.on=function(){var t=f.on.apply(f,arguments);return t===f?h:t},h.clickDistance=function(t){return arguments.length?(l=(t=+t)*t,h):Math.sqrt(l)},h},t.dragDisable=Yn,t.dragEnable=Ln,t.dsv=function(t,n,e,r){3===arguments.length&&"function"==typeof e&&(r=e,e=void 0);var i=cu(t);return Nu(n,e).then((function(t){return i.parse(t,r)}))},t.dsvFormat=cu,t.easeBack=so,t.easeBackIn=co,t.easeBackInOut=so,t.easeBackOut=fo,t.easeBounce=ao,t.easeBounceIn=function(t){return 1-ao(1-t)},t.easeBounceInOut=function(t){return((t*=2)<=1?1-ao(1-t):ao(t-1)+1)/2},t.easeBounceOut=ao,t.easeCircle=ro,t.easeCircleIn=function(t){return 1-Math.sqrt(1-t*t)},t.easeCircleInOut=ro,t.easeCircleOut=function(t){return Math.sqrt(1- --t*t)},t.easeCubic=$i,t.easeCubicIn=function(t){return t*t*t},t.easeCubicInOut=$i,t.easeCubicOut=function(t){return--t*t*t+1},t.easeElastic=po,t.easeElasticIn=ho,t.easeElasticInOut=go,t.easeElasticOut=po,t.easeExp=eo,t.easeExpIn=function(t){return no(1-+t)},t.easeExpInOut=eo,t.easeExpOut=function(t){return 1-no(t)},t.easeLinear=t=>+t,t.easePoly=Ki,t.easePolyIn=Wi,t.easePolyInOut=Ki,t.easePolyOut=Zi,t.easeQuad=Vi,t.easeQuadIn=function(t){return t*t},t.easeQuadInOut=Vi,t.easeQuadOut=function(t){return t*(2-t)},t.easeSin=to,t.easeSinIn=function(t){return 1==+t?1:1-Math.cos(t*Ji)},t.easeSinInOut=to,t.easeSinOut=function(t){return Math.sin(t*Ji)},t.every=function(t,n){if("function"!=typeof n)throw new TypeError("test is not a function");let e=-1;for(const r of t)if(!n(r,++e,t))return!1;return!0},t.extent=p,t.fcumsum=function(t,n){const e=new g;let r=-1;return Float64Array.from(t,void 0===n?t=>e.add(+t||0):i=>e.add(+n(i,++r,t)||0))},t.filter=function(t,n){if("function"!=typeof n)throw new TypeError("test is not a function");const e=[];let r=-1;for(const i of t)n(i,++r,t)&&e.push(i);return e},t.forceCenter=function(t,n){var e,r=1;function i(){var i,o,a=e.length,u=0,c=0;for(i=0;i<a;++i)u+=(o=e[i]).x,c+=o.y;for(u=(u/a-t)*r,c=(c/a-n)*r,i=0;i<a;++i)(o=e[i]).x-=u,o.y-=c}return null==t&&(t=0),null==n&&(n=0),i.initialize=function(t){e=t},i.x=function(n){return arguments.length?(t=+n,i):t},i.y=function(t){return arguments.length?(n=+t,i):n},i.strength=function(t){return arguments.length?(r=+t,i):r},i},t.forceCollide=function(t){var n,e,r,i=1,o=1;function a(){for(var t,a,c,f,s,l,h,d=n.length,p=0;p<o;++p)for(a=Lu(n,$u,Wu).visitAfter(u),t=0;t<d;++t)c=n[t],l=e[c.index],h=l*l,f=c.x+c.vx,s=c.y+c.vy,a.visit(g);function g(t,n,e,o,a){var u=t.data,d=t.r,p=l+d;if(!u)return n>f+p||o<f-p||e>s+p||a<s-p;if(u.index>c.index){var g=f-u.x-u.vx,y=s-u.y-u.vy,v=g*g+y*y;v<p*p&&(0===g&&(v+=(g=Vu(r))*g),0===y&&(v+=(y=Vu(r))*y),v=(p-(v=Math.sqrt(v)))/v*i,c.vx+=(g*=v)*(p=(d*=d)/(h+d)),c.vy+=(y*=v)*p,u.vx-=g*(p=1-p),u.vy-=y*p)}}}function u(t){if(t.data)return t.r=e[t.data.index];for(var n=t.r=0;n<4;++n)t[n]&&t[n].r>t.r&&(t.r=t[n].r)}function c(){if(n){var r,i,o=n.length;for(e=new Array(o),r=0;r<o;++r)i=n[r],e[i.index]=+t(i,r,n)}}return"function"!=typeof t&&(t=Gu(null==t?1:+t)),a.initialize=function(t,e){n=t,r=e,c()},a.iterations=function(t){return arguments.length?(o=+t,a):o},a.strength=function(t){return arguments.length?(i=+t,a):i},a.radius=function(n){return arguments.length?(t="function"==typeof n?n:Gu(+n),c(),a):t},a},t.forceLink=function(t){var n,e,r,i,o,a,u=Zu,c=function(t){return 1/Math.min(i[t.source.index],i[t.target.index])},f=Gu(30),s=1;function l(r){for(var i=0,u=t.length;i<s;++i)for(var c,f,l,h,d,p,g,y=0;y<u;++y)f=(c=t[y]).source,h=(l=c.target).x+l.vx-f.x-f.vx||Vu(a),d=l.y+l.vy-f.y-f.vy||Vu(a),h*=p=((p=Math.sqrt(h*h+d*d))-e[y])/p*r*n[y],d*=p,l.vx-=h*(g=o[y]),l.vy-=d*g,f.vx+=h*(g=1-g),f.vy+=d*g}function h(){if(r){var a,c,f=r.length,s=t.length,l=new Map(r.map(((t,n)=>[u(t,n,r),t])));for(a=0,i=new Array(f);a<s;++a)(c=t[a]).index=a,"object"!=typeof c.source&&(c.source=Ku(l,c.source)),"object"!=typeof c.target&&(c.target=Ku(l,c.target)),i[c.source.index]=(i[c.source.index]||0)+1,i[c.target.index]=(i[c.target.index]||0)+1;for(a=0,o=new Array(s);a<s;++a)c=t[a],o[a]=i[c.source.index]/(i[c.source.index]+i[c.target.index]);n=new Array(s),d(),e=new Array(s),p()}}function d(){if(r)for(var e=0,i=t.length;e<i;++e)n[e]=+c(t[e],e,t)}function p(){if(r)for(var n=0,i=t.length;n<i;++n)e[n]=+f(t[n],n,t)}return null==t&&(t=[]),l.initialize=function(t,n){r=t,a=n,h()},l.links=function(n){return arguments.length?(t=n,h(),l):t},l.id=function(t){return arguments.length?(u=t,l):u},l.iterations=function(t){return arguments.length?(s=+t,l):s},l.strength=function(t){return arguments.length?(c="function"==typeof t?t:Gu(+t),d(),l):c},l.distance=function(t){return arguments.length?(f="function"==typeof t?t:Gu(+t),p(),l):f},l},t.forceManyBody=function(){var t,n,e,r,i,o=Gu(-30),a=1,u=1/0,c=.81;function f(e){var i,o=t.length,a=Lu(t,Ju,tc).visitAfter(l);for(r=e,i=0;i<o;++i)n=t[i],a.visit(h)}function s(){if(t){var n,e,r=t.length;for(i=new Array(r),n=0;n<r;++n)e=t[n],i[e.index]=+o(e,n,t)}}function l(t){var n,e,r,o,a,u=0,c=0;if(t.length){for(r=o=a=0;a<4;++a)(n=t[a])&&(e=Math.abs(n.value))&&(u+=n.value,c+=e,r+=e*n.x,o+=e*n.y);t.x=r/c,t.y=o/c}else{(n=t).x=n.data.x,n.y=n.data.y;do{u+=i[n.data.index]}while(n=n.next)}t.value=u}function h(t,o,f,s){if(!t.value)return!0;var l=t.x-n.x,h=t.y-n.y,d=s-o,p=l*l+h*h;if(d*d/c<p)return p<u&&(0===l&&(p+=(l=Vu(e))*l),0===h&&(p+=(h=Vu(e))*h),p<a&&(p=Math.sqrt(a*p)),n.vx+=l*t.value*r/p,n.vy+=h*t.value*r/p),!0;if(!(t.length||p>=u)){(t.data!==n||t.next)&&(0===l&&(p+=(l=Vu(e))*l),0===h&&(p+=(h=Vu(e))*h),p<a&&(p=Math.sqrt(a*p)));do{t.data!==n&&(d=i[t.data.index]*r/p,n.vx+=l*d,n.vy+=h*d)}while(t=t.next)}}return f.initialize=function(n,r){t=n,e=r,s()},f.strength=function(t){return arguments.length?(o="function"==typeof t?t:Gu(+t),s(),f):o},f.distanceMin=function(t){return arguments.length?(a=t*t,f):Math.sqrt(a)},f.distanceMax=function(t){return arguments.length?(u=t*t,f):Math.sqrt(u)},f.theta=function(t){return arguments.length?(c=t*t,f):Math.sqrt(c)},f},t.forceRadial=function(t,n,e){var r,i,o,a=Gu(.1);function u(t){for(var a=0,u=r.length;a<u;++a){var c=r[a],f=c.x-n||1e-6,s=c.y-e||1e-6,l=Math.sqrt(f*f+s*s),h=(o[a]-l)*i[a]*t/l;c.vx+=f*h,c.vy+=s*h}}function c(){if(r){var n,e=r.length;for(i=new Array(e),o=new Array(e),n=0;n<e;++n)o[n]=+t(r[n],n,r),i[n]=isNaN(o[n])?0:+a(r[n],n,r)}}return"function"!=typeof t&&(t=Gu(+t)),null==n&&(n=0),null==e&&(e=0),u.initialize=function(t){r=t,c()},u.strength=function(t){return arguments.length?(a="function"==typeof t?t:Gu(+t),c(),u):a},u.radius=function(n){return arguments.length?(t="function"==typeof n?n:Gu(+n),c(),u):t},u.x=function(t){return arguments.length?(n=+t,u):n},u.y=function(t){return arguments.length?(e=+t,u):e},u},t.forceSimulation=function(t){var n,e=1,r=.001,i=1-Math.pow(r,1/300),o=0,a=.6,u=new Map,c=ri(l),f=pt("tick","end"),s=function(){let t=1;return()=>(t=(1664525*t+1013904223)%Qu)/Qu}();function l(){h(),f.call("tick",n),e<r&&(c.stop(),f.call("end",n))}function h(r){var c,f,s=t.length;void 0===r&&(r=1);for(var l=0;l<r;++l)for(e+=(o-e)*i,u.forEach((function(t){t(e)})),c=0;c<s;++c)null==(f=t[c]).fx?f.x+=f.vx*=a:(f.x=f.fx,f.vx=0),null==f.fy?f.y+=f.vy*=a:(f.y=f.fy,f.vy=0);return n}function d(){for(var n,e=0,r=t.length;e<r;++e){if((n=t[e]).index=e,null!=n.fx&&(n.x=n.fx),null!=n.fy&&(n.y=n.fy),isNaN(n.x)||isNaN(n.y)){var i=10*Math.sqrt(.5+e),o=e*nc;n.x=i*Math.cos(o),n.y=i*Math.sin(o)}(isNaN(n.vx)||isNaN(n.vy))&&(n.vx=n.vy=0)}}function p(n){return n.initialize&&n.initialize(t,s),n}return null==t&&(t=[]),d(),n={tick:h,restart:function(){return c.restart(l),n},stop:function(){return c.stop(),n},nodes:function(e){return arguments.length?(t=e,d(),u.forEach(p),n):t},alpha:function(t){return arguments.length?(e=+t,n):e},alphaMin:function(t){return arguments.length?(r=+t,n):r},alphaDecay:function(t){return arguments.length?(i=+t,n):+i},alphaTarget:function(t){return arguments.length?(o=+t,n):o},velocityDecay:function(t){return arguments.length?(a=1-t,n):1-a},randomSource:function(t){return arguments.length?(s=t,u.forEach(p),n):s},force:function(t,e){return arguments.length>1?(null==e?u.delete(t):u.set(t,p(e)),n):u.get(t)},find:function(n,e,r){var i,o,a,u,c,f=0,s=t.length;for(null==r?r=1/0:r*=r,f=0;f<s;++f)(a=(i=n-(u=t[f]).x)*i+(o=e-u.y)*o)<r&&(c=u,r=a);return c},on:function(t,e){return arguments.length>1?(f.on(t,e),n):f.on(t)}}},t.forceX=function(t){var n,e,r,i=Gu(.1);function o(t){for(var i,o=0,a=n.length;o<a;++o)(i=n[o]).vx+=(r[o]-i.x)*e[o]*t}function a(){if(n){var o,a=n.length;for(e=new Array(a),r=new Array(a),o=0;o<a;++o)e[o]=isNaN(r[o]=+t(n[o],o,n))?0:+i(n[o],o,n)}}return"function"!=typeof t&&(t=Gu(null==t?0:+t)),o.initialize=function(t){n=t,a()},o.strength=function(t){return arguments.length?(i="function"==typeof t?t:Gu(+t),a(),o):i},o.x=function(n){return arguments.length?(t="function"==typeof n?n:Gu(+n),a(),o):t},o},t.forceY=function(t){var n,e,r,i=Gu(.1);function o(t){for(var i,o=0,a=n.length;o<a;++o)(i=n[o]).vy+=(r[o]-i.y)*e[o]*t}function a(){if(n){var o,a=n.length;for(e=new Array(a),r=new Array(a),o=0;o<a;++o)e[o]=isNaN(r[o]=+t(n[o],o,n))?0:+i(n[o],o,n)}}return"function"!=typeof t&&(t=Gu(null==t?0:+t)),o.initialize=function(t){n=t,a()},o.strength=function(t){return arguments.length?(i="function"==typeof t?t:Gu(+t),a(),o):i},o.y=function(n){return arguments.length?(t="function"==typeof n?n:Gu(+n),a(),o):t},o},t.formatDefaultLocale=gc,t.formatLocale=pc,t.formatSpecifier=ac,t.fsum=function(t,n){const e=new g;if(void 0===n)for(let n of t)(n=+n)&&e.add(n);else{let r=-1;for(let i of t)(i=+n(i,++r,t))&&e.add(i)}return+e},t.geoAlbers=bh,t.geoAlbersUsa=function(){var t,n,e,r,i,o,a=bh(),u=_h().rotate([154,0]).center([-2,58.5]).parallels([55,65]),c=_h().rotate([157,0]).center([-3,19.9]).parallels([8,18]),f={point:function(t,n){o=[t,n]}};function s(t){var n=t[0],a=t[1];return o=null,e.point(n,a),o||(r.point(n,a),o)||(i.point(n,a),o)}function l(){return t=n=null,s}return s.invert=function(t){var n=a.scale(),e=a.translate(),r=(t[0]-e[0])/n,i=(t[1]-e[1])/n;return(i>=.12&&i<.234&&r>=-.425&&r<-.214?u:i>=.166&&i<.234&&r>=-.214&&r<-.115?c:a).invert(t)},s.stream=function(e){return t&&n===e?t:(r=[a.stream(n=e),u.stream(e),c.stream(e)],i=r.length,t={point:function(t,n){for(var e=-1;++e<i;)r[e].point(t,n)},sphere:function(){for(var t=-1;++t<i;)r[t].sphere()},lineStart:function(){for(var t=-1;++t<i;)r[t].lineStart()},lineEnd:function(){for(var t=-1;++t<i;)r[t].lineEnd()},polygonStart:function(){for(var t=-1;++t<i;)r[t].polygonStart()},polygonEnd:function(){for(var t=-1;++t<i;)r[t].polygonEnd()}});var r,i},s.precision=function(t){return arguments.length?(a.precision(t),u.precision(t),c.precision(t),l()):a.precision()},s.scale=function(t){return arguments.length?(a.scale(t),u.scale(.35*t),c.scale(t),s.translate(a.translate())):a.scale()},s.translate=function(t){if(!arguments.length)return a.translate();var n=a.scale(),o=+t[0],s=+t[1];return e=a.translate(t).clipExtent([[o-.455*n,s-.238*n],[o+.455*n,s+.238*n]]).stream(f),r=u.translate([o-.307*n,s+.201*n]).clipExtent([[o-.425*n+bc,s+.12*n+bc],[o-.214*n-bc,s+.234*n-bc]]).stream(f),i=c.translate([o-.205*n,s+.212*n]).clipExtent([[o-.214*n+bc,s+.166*n+bc],[o-.115*n-bc,s+.234*n-bc]]).stream(f),l()},s.fitExtent=function(t,n){return ah(s,t,n)},s.fitSize=function(t,n){return uh(s,t,n)},s.fitWidth=function(t,n){return ch(s,t,n)},s.fitHeight=function(t,n){return fh(s,t,n)},s.scale(1070)},t.geoArea=function(t){return pf=new g,Wc(t,gf),2*pf},t.geoAzimuthalEqualArea=function(){return ph(wh).scale(124.75).clipAngle(179.999)},t.geoAzimuthalEqualAreaRaw=wh,t.geoAzimuthalEquidistant=function(){return ph(Mh).scale(79.4188).clipAngle(179.999)},t.geoAzimuthalEquidistantRaw=Mh,t.geoBounds=function(t){var n,e,r,i,o,a,u;if(of=rf=-(nf=ef=1/0),lf=[],Wc(t,jf),e=lf.length){for(lf.sort(Qf),n=1,o=[r=lf[0]];n<e;++n)Jf(r,(i=lf[n])[0])||Jf(r,i[1])?(Kf(r[0],i[1])>Kf(r[0],r[1])&&(r[1]=i[1]),Kf(i[0],r[1])>Kf(r[0],r[1])&&(r[0]=i[0])):o.push(r=i);for(a=-1/0,n=0,r=o[e=o.length-1];n<=e;r=i,++n)i=o[n],(u=Kf(r[1],i[0]))>a&&(a=u,nf=i[0],rf=r[1])}return lf=hf=null,nf===1/0||ef===1/0?[[NaN,NaN],[NaN,NaN]]:[[nf,ef],[rf,of]]},t.geoCentroid=function(t){Ef=kf=Nf=Cf=Pf=zf=Df=qf=0,Rf=new g,Ff=new g,Of=new g,Wc(t,ts);var n=+Rf,e=+Ff,r=+Of,i=Dc(n,e,r);return i<mc&&(n=zf,e=Df,r=qf,kf<bc&&(n=Nf,e=Cf,r=Pf),(i=Dc(n,e,r))<mc)?[NaN,NaN]:[Nc(e,n)*Tc,Yc(r/i)*Tc]},t.geoCircle=function(){var t,n,e=ls([0,0]),r=ls(90),i=ls(6),o={point:function(e,r){t.push(e=n(e,r)),e[0]*=Tc,e[1]*=Tc}};function a(){var a=e.apply(this,arguments),u=r.apply(this,arguments)*Sc,c=i.apply(this,arguments)*Sc;return t=[],n=ps(-a[0]*Sc,-a[1]*Sc,0).invert,bs(o,u,c,1),a={type:"Polygon",coordinates:[t]},t=n=null,a}return a.center=function(t){return arguments.length?(e="function"==typeof t?t:ls([+t[0],+t[1]]),a):e},a.radius=function(t){return arguments.length?(r="function"==typeof t?t:ls(+t),a):r},a.precision=function(t){return arguments.length?(i="function"==typeof t?t:ls(+t),a):i},a},t.geoClipAntimeridian=Ps,t.geoClipCircle=zs,t.geoClipExtent=function(){var t,n,e,r=0,i=0,o=960,a=500;return e={stream:function(e){return t&&n===e?t:t=Us(r,i,o,a)(n=e)},extent:function(u){return arguments.length?(r=+u[0][0],i=+u[0][1],o=+u[1][0],a=+u[1][1],t=n=null,e):[[r,i],[o,a]]}}},t.geoClipRectangle=Us,t.geoConicConformal=function(){return yh(Eh).scale(109.5).parallels([30,30])},t.geoConicConformalRaw=Eh,t.geoConicEqualArea=_h,t.geoConicEqualAreaRaw=vh,t.geoConicEquidistant=function(){return yh(Nh).scale(131.154).center([0,13.9389])},t.geoConicEquidistantRaw=Nh,t.geoContains=function(t,n){return(t&&$s.hasOwnProperty(t.type)?$s[t.type]:Zs)(t,n)},t.geoDistance=Vs,t.geoEqualEarth=function(){return ph(Rh).scale(177.158)},t.geoEqualEarthRaw=Rh,t.geoEquirectangular=function(){return ph(kh).scale(152.63)},t.geoEquirectangularRaw=kh,t.geoGnomonic=function(){return ph(Fh).scale(144.049).clipAngle(60)},t.geoGnomonicRaw=Fh,t.geoGraticule=il,t.geoGraticule10=function(){return il()()},t.geoIdentity=function(){var t,n,e,r,i,o,a,u=1,c=0,f=0,s=1,l=1,h=0,d=null,p=1,g=1,y=rh({point:function(t,n){var e=b([t,n]);this.stream.point(e[0],e[1])}}),v=fl;function _(){return p=u*s,g=u*l,o=a=null,b}function b(e){var r=e[0]*p,i=e[1]*g;if(h){var o=i*t-r*n;r=r*t+i*n,i=o}return[r+c,i+f]}return b.invert=function(e){var r=e[0]-c,i=e[1]-f;if(h){var o=i*t+r*n;r=r*t-i*n,i=o}return[r/p,i/g]},b.stream=function(t){return o&&a===t?o:o=y(v(a=t))},b.postclip=function(t){return arguments.length?(v=t,d=e=r=i=null,_()):v},b.clipExtent=function(t){return arguments.length?(v=null==t?(d=e=r=i=null,fl):Us(d=+t[0][0],e=+t[0][1],r=+t[1][0],i=+t[1][1]),_()):null==d?null:[[d,e],[r,i]]},b.scale=function(t){return arguments.length?(u=+t,_()):u},b.translate=function(t){return arguments.length?(c=+t[0],f=+t[1],_()):[c,f]},b.angle=function(e){return arguments.length?(n=Fc(h=e%360*Sc),t=Cc(h),_()):h*Tc},b.reflectX=function(t){return arguments.length?(s=t?-1:1,_()):s<0},b.reflectY=function(t){return arguments.length?(l=t?-1:1,_()):l<0},b.fitExtent=function(t,n){return ah(b,t,n)},b.fitSize=function(t,n){return uh(b,t,n)},b.fitWidth=function(t,n){return ch(b,t,n)},b.fitHeight=function(t,n){return fh(b,t,n)},b},t.geoInterpolate=function(t,n){var e=t[0]*Sc,r=t[1]*Sc,i=n[0]*Sc,o=n[1]*Sc,a=Cc(r),u=Fc(r),c=Cc(o),f=Fc(o),s=a*Cc(e),l=a*Fc(e),h=c*Cc(i),d=c*Fc(i),p=2*Yc(Ic(Lc(o-r)+a*c*Lc(i-e))),g=Fc(p),y=p?function(t){var n=Fc(t*=p)/g,e=Fc(p-t)/g,r=e*s+n*h,i=e*l+n*d,o=e*u+n*f;return[Nc(i,r)*Tc,Nc(o,Ic(r*r+i*i))*Tc]}:function(){return[e*Tc,r*Tc]};return y.distance=p,y},t.geoLength=Hs,t.geoMercator=function(){return Th(Ah).scale(961/Ac)},t.geoMercatorRaw=Ah,t.geoNaturalEarth1=function(){return ph(Oh).scale(175.295)},t.geoNaturalEarth1Raw=Oh,t.geoOrthographic=function(){return ph(Ih).scale(249.5).clipAngle(90.000001)},t.geoOrthographicRaw=Ih,t.geoPath=function(t,n){var e,r,i=4.5;function o(t){return t&&("function"==typeof i&&r.pointRadius(+i.apply(this,arguments)),Wc(t,e(r))),r.result()}return o.area=function(t){return Wc(t,e(hl)),hl.result()},o.measure=function(t){return Wc(t,e(Ql)),Ql.result()},o.bounds=function(t){return Wc(t,e(xl)),xl.result()},o.centroid=function(t){return Wc(t,e(Rl)),Rl.result()},o.projection=function(n){return arguments.length?(e=null==n?(t=null,fl):(t=n).stream,o):t},o.context=function(t){return arguments.length?(r=null==t?(n=null,new nh):new Xl(n=t),"function"!=typeof i&&r.pointRadius(i),o):n},o.pointRadius=function(t){return arguments.length?(i="function"==typeof t?t:(r.pointRadius(+t),+t),o):i},o.projection(t).context(n)},t.geoProjection=ph,t.geoProjectionMutator=gh,t.geoRotation=_s,t.geoStereographic=function(){return ph(Uh).scale(250).clipAngle(142)},t.geoStereographicRaw=Uh,t.geoStream=Wc,t.geoTransform=function(t){return{stream:rh(t)}},t.geoTransverseMercator=function(){var t=Th(Bh),n=t.center,e=t.rotate;return t.center=function(t){return arguments.length?n([-t[1],t[0]]):[(t=n())[1],-t[0]]},t.rotate=function(t){return arguments.length?e([t[0],t[1],t.length>2?t[2]+90:90]):[(t=e())[0],t[1],t[2]-90]},e([0,0,90]).scale(159.155)},t.geoTransverseMercatorRaw=Bh,t.gray=function(t,n){return new Fe(t,0,0,null==n?1:n)},t.greatest=function(t,e=n){let r,i=!1;if(1===e.length){let o;for(const a of t){const t=e(a);(i?n(t,o)>0:0===n(t,t))&&(r=a,o=t,i=!0)}}else for(const n of t)(i?e(n,r)>0:0===e(n,n))&&(r=n,i=!0);return r},t.greatestIndex=function(t,e=n){if(1===e.length)return G(t,e);let r,i=-1,o=-1;for(const n of t)++o,(i<0?0===e(n,n):e(n,r)>0)&&(r=n,i=o);return i},t.group=M,t.groupSort=function(t,e,r){return(1===e.length?k(A(t,e,r),(([t,e],[r,i])=>n(e,i)||n(t,r))):k(M(t,r),(([t,r],[i,o])=>e(r,o)||n(t,i)))).map((([t])=>t))},t.groups=function(t,...n){return S(t,Array.from,w,n)},t.hcl=Le,t.hierarchy=Xh,t.histogram=U,t.hsl=Ae,t.html=Fu,t.image=function(t,n){return new Promise((function(e,r){var i=new Image;for(var o in n)i[o]=n[o];i.onerror=r,i.onload=function(){e(i)},i.src=t}))},t.index=function(t,...n){return S(t,w,T,n)},t.indexes=function(t,...n){return S(t,Array.from,T,n)},t.interpolate=Mr,t.interpolateArray=function(t,n){return(gr(n)?pr:yr)(t,n)},t.interpolateBasis=rr,t.interpolateBasisClosed=ir,t.interpolateBlues=q_,t.interpolateBrBG=Gv,t.interpolateBuGn=s_,t.interpolateBuPu=h_,t.interpolateCividis=function(t){return t=Math.max(0,Math.min(1,t)),"rgb("+Math.max(0,Math.min(255,Math.round(-4.54-t*(35.34-t*(2381.73-t*(6402.7-t*(7024.72-2710.57*t)))))))+", "+Math.max(0,Math.min(255,Math.round(32.49+t*(170.73+t*(52.82-t*(131.46-t*(176.58-67.37*t)))))))+", "+Math.max(0,Math.min(255,Math.round(81.24+t*(442.36-t*(2482.43-t*(6167.24-t*(6614.94-2475.67*t)))))))+")"},t.interpolateCool=V_,t.interpolateCubehelix=Yr,t.interpolateCubehelixDefault=X_,t.interpolateCubehelixLong=Lr,t.interpolateDate=vr,t.interpolateDiscrete=function(t){var n=t.length;return function(e){return t[Math.max(0,Math.min(n-1,Math.floor(e*n)))]}},t.interpolateGnBu=p_,t.interpolateGreens=F_,t.interpolateGreys=I_,t.interpolateHcl=Ir,t.interpolateHclLong=Ur,t.interpolateHsl=Rr,t.interpolateHslLong=Fr,t.interpolateHue=function(t,n){var e=ur(+t,+n);return function(t){var n=e(t);return n-360*Math.floor(n/360)}},t.interpolateInferno=nb,t.interpolateLab=function(t,n){var e=fr((t=Re(t)).l,(n=Re(n)).l),r=fr(t.a,n.a),i=fr(t.b,n.b),o=fr(t.opacity,n.opacity);return function(n){return t.l=e(n),t.a=r(n),t.b=i(n),t.opacity=o(n),t+""}},t.interpolateMagma=tb,t.interpolateNumber=_r,t.interpolateNumberArray=pr,t.interpolateObject=br,t.interpolateOrRd=y_,t.interpolateOranges=H_,t.interpolatePRGn=$v,t.interpolatePiYG=Zv,t.interpolatePlasma=eb,t.interpolatePuBu=m_,t.interpolatePuBuGn=__,t.interpolatePuOr=Qv,t.interpolatePuRd=w_,t.interpolatePurples=B_,t.interpolateRainbow=function(t){(t<0||t>1)&&(t-=Math.floor(t));var n=Math.abs(t-.5);return $_.h=360*t-100,$_.s=1.5-1.5*n,$_.l=.8-.9*n,$_+""},t.interpolateRdBu=t_,t.interpolateRdGy=e_,t.interpolateRdPu=A_,t.interpolateRdYlBu=i_,t.interpolateRdYlGn=a_,t.interpolateReds=L_,t.interpolateRgb=sr,t.interpolateRgbBasis=hr,t.interpolateRgbBasisClosed=dr,t.interpolateRound=Ar,t.interpolateSinebow=function(t){var n;return t=(.5-t)*Math.PI,W_.r=255*(n=Math.sin(t))*n,W_.g=255*(n=Math.sin(t+Z_))*n,W_.b=255*(n=Math.sin(t+K_))*n,W_+""},t.interpolateSpectral=c_,t.interpolateString=wr,t.interpolateTransformCss=Cr,t.interpolateTransformSvg=Pr,t.interpolateTurbo=function(t){return t=Math.max(0,Math.min(1,t)),"rgb("+Math.max(0,Math.min(255,Math.round(34.61+t*(1172.33-t*(10793.56-t*(33300.12-t*(38394.49-14825.05*t)))))))+", "+Math.max(0,Math.min(255,Math.round(23.31+t*(557.33+t*(1225.33-t*(3574.96-t*(1073.77+707.56*t)))))))+", "+Math.max(0,Math.min(255,Math.round(27.2+t*(3211.1-t*(15327.97-t*(27814-t*(22569.18-6838.66*t)))))))+")"},t.interpolateViridis=J_,t.interpolateWarm=G_,t.interpolateYlGn=k_,t.interpolateYlGnBu=S_,t.interpolateYlOrBr=C_,t.interpolateYlOrRd=z_,t.interpolateZoom=Dr,t.interrupt=gi,t.intersection=function(t,...n){t=new Set(t),n=n.map(et);t:for(const e of t)for(const r of n)if(!r.has(e)){t.delete(e);continue t}return t},t.interval=function(t,n,e){var r=new ei,i=n;return null==n?(r.restart(t,n,e),r):(r._restart=r.restart,r.restart=function(t,n,e){n=+n,e=null==e?ti():+e,r._restart((function o(a){a+=i,r._restart(o,i+=n,e),t(a)}),n,e)},r.restart(t,n,e),r)},t.isoFormat=Mv,t.isoParse=Av,t.json=function(t,n){return fetch(t,n).then(Du)},t.lab=Re,t.lch=function(t,n,e,r){return 1===arguments.length?Ye(t):new je(e,n,t,null==r?1:r)},t.least=function(t,e=n){let r,i=!1;if(1===e.length){let o;for(const a of t){const t=e(a);(i?n(t,o)<0:0===n(t,t))&&(r=a,o=t,i=!0)}}else for(const n of t)(i?e(n,r)<0:0===e(n,n))&&(r=n,i=!0);return r},t.leastIndex=K,t.line=Cb,t.lineRadial=Ib,t.linkHorizontal=function(){return jb(Hb)},t.linkRadial=function(){var t=jb(Gb);return t.angle=t.x,delete t.x,t.radius=t.y,delete t.y,t},t.linkVertical=function(){return jb(Xb)},t.local=Rn,t.map=function(t,n){if("function"!=typeof t[Symbol.iterator])throw new TypeError("values is not iterable");if("function"!=typeof n)throw new TypeError("mapper is not a function");return Array.from(t,((e,r)=>n(e,r,t)))},t.matcher=Ct,t.max=B,t.maxIndex=G,t.mean=function(t,n){let e=0,r=0;if(void 0===n)for(let n of t)null!=n&&(n=+n)>=n&&(++e,r+=n);else{let i=-1;for(let o of t)null!=(o=n(o,++i,t))&&(o=+o)>=o&&(++e,r+=o)}if(e)return r/e},t.median=function(t,n){return H(t,.5,n)},t.merge=V,t.min=Y,t.minIndex=$,t.namespace=xt,t.namespaces=mt,t.nice=O,t.now=ti,t.pack=function(){var t=null,n=1,e=1,r=hd;function i(i){return i.x=n/2,i.y=e/2,t?i.eachBefore(gd(t)).eachAfter(yd(r,.5)).eachBefore(vd(1)):i.eachBefore(gd(pd)).eachAfter(yd(hd,1)).eachAfter(yd(r,i.r/Math.min(n,e))).eachBefore(vd(Math.min(n,e)/(2*i.r))),i}return i.radius=function(n){return arguments.length?(t=sd(n),i):t},i.size=function(t){return arguments.length?(n=+t[0],e=+t[1],i):[n,e]},i.padding=function(t){return arguments.length?(r="function"==typeof t?t:dd(+t),i):r},i},t.packEnclose=Kh,t.packSiblings=function(t){return fd(t),t},t.pairs=function(t,n=W){const e=[];let r,i=!1;for(const o of t)i&&e.push(n(r,o)),r=o,i=!0;return e},t.partition=function(){var t=1,n=1,e=0,r=!1;function i(i){var o=i.height+1;return i.x0=i.y0=e,i.x1=t,i.y1=n/o,i.eachBefore(function(t,n){return function(r){r.children&&bd(r,r.x0,t*(r.depth+1)/n,r.x1,t*(r.depth+2)/n);var i=r.x0,o=r.y0,a=r.x1-e,u=r.y1-e;a<i&&(i=a=(i+a)/2),u<o&&(o=u=(o+u)/2),r.x0=i,r.y0=o,r.x1=a,r.y1=u}}(n,o)),r&&i.eachBefore(_d),i}return i.round=function(t){return arguments.length?(r=!!t,i):r},i.size=function(e){return arguments.length?(t=+e[0],n=+e[1],i):[t,n]},i.padding=function(t){return arguments.length?(e=+t,i):e},i},t.path=fa,t.permute=E,t.pie=function(){var t=Db,n=zb,e=null,r=rb(0),i=rb(pb),o=rb(0);function a(a){var u,c,f,s,l,h=(a=Tb(a)).length,d=0,p=new Array(h),g=new Array(h),y=+r.apply(this,arguments),v=Math.min(pb,Math.max(-pb,i.apply(this,arguments)-y)),_=Math.min(Math.abs(v)/h,o.apply(this,arguments)),b=_*(v<0?-1:1);for(u=0;u<h;++u)(l=g[p[u]=u]=+t(a[u],u,a))>0&&(d+=l);for(null!=n?p.sort((function(t,e){return n(g[t],g[e])})):null!=e&&p.sort((function(t,n){return e(a[t],a[n])})),u=0,f=d?(v-h*b)/d:0;u<h;++u,y=s)c=p[u],s=y+((l=g[c])>0?l*f:0)+b,g[c]={data:a[c],index:u,value:l,startAngle:y,endAngle:s,padAngle:_};return g}return a.value=function(n){return arguments.length?(t="function"==typeof n?n:rb(+n),a):t},a.sortValues=function(t){return arguments.length?(n=t,e=null,a):n},a.sort=function(t){return arguments.length?(e=t,n=null,a):e},a.startAngle=function(t){return arguments.length?(r="function"==typeof t?t:rb(+t),a):r},a.endAngle=function(t){return arguments.length?(i="function"==typeof t?t:rb(+t),a):i},a.padAngle=function(t){return arguments.length?(o="function"==typeof t?t:rb(+t),a):o},a},t.piecewise=jr,t.pointRadial=Bb,t.pointer=In,t.pointers=function(t,n){return t.target&&(t=On(t),void 0===n&&(n=t.currentTarget),t=t.touches||[t]),Array.from(t,(t=>In(t,n)))},t.polygonArea=function(t){for(var n,e=-1,r=t.length,i=t[r-1],o=0;++e<r;)n=i,i=t[e],o+=n[1]*i[0]-n[0]*i[1];return o/2},t.polygonCentroid=function(t){for(var n,e,r=-1,i=t.length,o=0,a=0,u=t[i-1],c=0;++r<i;)n=u,u=t[r],c+=e=n[0]*u[1]-u[0]*n[1],o+=(n[0]+u[0])*e,a+=(n[1]+u[1])*e;return[o/(c*=3),a/c]},t.polygonContains=function(t,n){for(var e,r,i=t.length,o=t[i-1],a=n[0],u=n[1],c=o[0],f=o[1],s=!1,l=0;l<i;++l)e=(o=t[l])[0],(r=o[1])>u!=f>u&&a<(c-e)*(u-r)/(f-r)+e&&(s=!s),c=e,f=r;return s},t.polygonHull=function(t){if((e=t.length)<3)return null;var n,e,r=new Array(e),i=new Array(e);for(n=0;n<e;++n)r[n]=[+t[n][0],+t[n][1],n];for(r.sort(Fd),n=0;n<e;++n)i[n]=[r[n][0],-r[n][1]];var o=Od(r),a=Od(i),u=a[0]===o[0],c=a[a.length-1]===o[o.length-1],f=[];for(n=o.length-1;n>=0;--n)f.push(t[r[o[n]][2]]);for(n=+u;n<a.length-c;++n)f.push(t[r[a[n]][2]]);return f},t.polygonLength=function(t){for(var n,e,r=-1,i=t.length,o=t[i-1],a=o[0],u=o[1],c=0;++r<i;)n=a,e=u,n-=a=(o=t[r])[0],e-=u=o[1],c+=Math.hypot(n,e);return c},t.precisionFixed=yc,t.precisionPrefix=vc,t.precisionRound=_c,t.quadtree=Lu,t.quantile=H,t.quantileSorted=X,t.quantize=function(t,n){for(var e=new Array(n),r=0;r<n;++r)e[r]=t(r/(n-1));return e},t.quickselect=L,t.radialArea=Ub,t.radialLine=Ib,t.randomBates=Hd,t.randomBernoulli=Vd,t.randomBeta=Zd,t.randomBinomial=Kd,t.randomCauchy=Jd,t.randomExponential=Xd,t.randomGamma=Wd,t.randomGeometric=$d,t.randomInt=Bd,t.randomIrwinHall=jd,t.randomLcg=function(t=Math.random()){let n=0|(0<=t&&t<1?t/ep:Math.abs(t));return()=>(n=1664525*n+1013904223|0,ep*(n>>>0))},t.randomLogNormal=Ld,t.randomLogistic=tp,t.randomNormal=Yd,t.randomPareto=Gd,t.randomPoisson=np,t.randomUniform=Ud,t.randomWeibull=Qd,t.range=Z,t.reduce=function(t,n,e){if("function"!=typeof n)throw new TypeError("reducer is not a function");const r=t[Symbol.iterator]();let i,o,a=-1;if(arguments.length<3){if(({done:i,value:e}=r.next()),i)return;++a}for(;({done:i,value:o}=r.next()),!i;)e=n(e,o,++a,t);return e},t.reverse=function(t){if("function"!=typeof t[Symbol.iterator])throw new TypeError("values is not iterable");return Array.from(t).reverse()},t.rgb=ve,t.ribbon=function(){return ba()},t.ribbonArrow=function(){return ba(_a)},t.rollup=A,t.rollups=function(t,n,...e){return S(t,Array.from,n,e)},t.scaleBand=up,t.scaleDiverging=function t(){var n=bp(Pv()(lp));return n.copy=function(){return Nv(n,t())},ip.apply(n,arguments)},t.scaleDivergingLog=function t(){var n=Ep(Pv()).domain([.1,1,10]);return n.copy=function(){return Nv(n,t()).base(n.base())},ip.apply(n,arguments)},t.scaleDivergingPow=zv,t.scaleDivergingSqrt=function(){return zv.apply(null,arguments).exponent(.5)},t.scaleDivergingSymlog=function t(){var n=Cp(Pv());return n.copy=function(){return Nv(n,t()).constant(n.constant())},ip.apply(n,arguments)},t.scaleIdentity=function t(n){var e;function r(t){return null==t||isNaN(t=+t)?e:t}return r.invert=r,r.domain=r.range=function(t){return arguments.length?(n=Array.from(t,fp),r):n.slice()},r.unknown=function(t){return arguments.length?(e=t,r):e},r.copy=function(){return t(n).unknown(e)},n=arguments.length?Array.from(n,fp):[0,1],bp(r)},t.scaleImplicit=op,t.scaleLinear=function t(){var n=vp();return n.copy=function(){return gp(n,t())},rp.apply(n,arguments),bp(n)},t.scaleLog=function t(){var n=Ep(yp()).domain([1,10]);return n.copy=function(){return gp(n,t()).base(n.base())},rp.apply(n,arguments),n},t.scaleOrdinal=ap,t.scalePoint=function(){return cp(up.apply(null,arguments).paddingInner(1))},t.scalePow=Rp,t.scaleQuantile=function t(){var e,r=[],i=[],a=[];function u(){var t=0,n=Math.max(1,i.length);for(a=new Array(n-1);++t<n;)a[t-1]=X(r,t/n);return c}function c(t){return null==t||isNaN(t=+t)?e:i[o(a,t)]}return c.invertExtent=function(t){var n=i.indexOf(t);return n<0?[NaN,NaN]:[n>0?a[n-1]:r[0],n<a.length?a[n]:r[r.length-1]]},c.domain=function(t){if(!arguments.length)return r.slice();r=[];for(let n of t)null==n||isNaN(n=+n)||r.push(n);return r.sort(n),u()},c.range=function(t){return arguments.length?(i=Array.from(t),u()):i.slice()},c.unknown=function(t){return arguments.length?(e=t,c):e},c.quantiles=function(){return a.slice()},c.copy=function(){return t().domain(r).range(i).unknown(e)},rp.apply(c,arguments)},t.scaleQuantize=function t(){var n,e=0,r=1,i=1,a=[.5],u=[0,1];function c(t){return null!=t&&t<=t?u[o(a,t,0,i)]:n}function f(){var t=-1;for(a=new Array(i);++t<i;)a[t]=((t+1)*r-(t-i)*e)/(i+1);return c}return c.domain=function(t){return arguments.length?([e,r]=t,e=+e,r=+r,f()):[e,r]},c.range=function(t){return arguments.length?(i=(u=Array.from(t)).length-1,f()):u.slice()},c.invertExtent=function(t){var n=u.indexOf(t);return n<0?[NaN,NaN]:n<1?[e,a[0]]:n>=i?[a[i-1],r]:[a[n-1],a[n]]},c.unknown=function(t){return arguments.length?(n=t,c):c},c.thresholds=function(){return a.slice()},c.copy=function(){return t().domain([e,r]).range(u).unknown(n)},rp.apply(bp(c),arguments)},t.scaleRadial=function t(){var n,e=vp(),r=[0,1],i=!1;function o(t){var r=Op(e(t));return isNaN(r)?n:i?Math.round(r):r}return o.invert=function(t){return e.invert(Fp(t))},o.domain=function(t){return arguments.length?(e.domain(t),o):e.domain()},o.range=function(t){return arguments.length?(e.range((r=Array.from(t,fp)).map(Fp)),o):r.slice()},o.rangeRound=function(t){return o.range(t).round(!0)},o.round=function(t){return arguments.length?(i=!!t,o):i},o.clamp=function(t){return arguments.length?(e.clamp(t),o):e.clamp()},o.unknown=function(t){return arguments.length?(n=t,o):n},o.copy=function(){return t(e.domain(),r).round(i).clamp(e.clamp()).unknown(n)},rp.apply(o,arguments),bp(o)},t.scaleSequential=function t(){var n=bp(kv()(lp));return n.copy=function(){return Nv(n,t())},ip.apply(n,arguments)},t.scaleSequentialLog=function t(){var n=Ep(kv()).domain([1,10]);return n.copy=function(){return Nv(n,t()).base(n.base())},ip.apply(n,arguments)},t.scaleSequentialPow=Cv,t.scaleSequentialQuantile=function t(){var e=[],r=lp;function i(t){if(null!=t&&!isNaN(t=+t))return r((o(e,t,1)-1)/(e.length-1))}return i.domain=function(t){if(!arguments.length)return e.slice();e=[];for(let n of t)null==n||isNaN(n=+n)||e.push(n);return e.sort(n),i},i.interpolator=function(t){return arguments.length?(r=t,i):r},i.range=function(){return e.map(((t,n)=>r(n/(e.length-1))))},i.quantiles=function(t){return Array.from({length:t+1},((n,r)=>H(e,r/t)))},i.copy=function(){return t(r).domain(e)},ip.apply(i,arguments)},t.scaleSequentialSqrt=function(){return Cv.apply(null,arguments).exponent(.5)},t.scaleSequentialSymlog=function t(){var n=Cp(kv());return n.copy=function(){return Nv(n,t()).constant(n.constant())},ip.apply(n,arguments)},t.scaleSqrt=function(){return Rp.apply(null,arguments).exponent(.5)},t.scaleSymlog=function t(){var n=Cp(yp());return n.copy=function(){return gp(n,t()).constant(n.constant())},rp.apply(n,arguments)},t.scaleThreshold=function t(){var n,e=[.5],r=[0,1],i=1;function a(t){return null!=t&&t<=t?r[o(e,t,0,i)]:n}return a.domain=function(t){return arguments.length?(e=Array.from(t),i=Math.min(e.length,r.length-1),a):e.slice()},a.range=function(t){return arguments.length?(r=Array.from(t),i=Math.min(e.length,r.length-1),a):r.slice()},a.invertExtent=function(t){var n=r.indexOf(t);return[e[n-1],e[n]]},a.unknown=function(t){return arguments.length?(n=t,a):n},a.copy=function(){return t().domain(e).range(r).unknown(n)},rp.apply(a,arguments)},t.scaleTime=function(){return rp.apply(Ev(Kg,Qg,xg,bg,og,eg,tg,Qp,Zp,t.timeFormat).domain([new Date(2e3,0,1),new Date(2e3,0,2)]),arguments)},t.scaleUtc=function(){return rp.apply(Ev(Wg,Zg,Gg,Hg,Cg,Eg,Tg,Mg,Zp,t.utcFormat).domain([Date.UTC(2e3,0,1),Date.UTC(2e3,0,2)]),arguments)},t.scan=function(t,n){const e=K(t,n);return e<0?void 0:e},t.schemeAccent=Rv,t.schemeBlues=D_,t.schemeBrBG=Xv,t.schemeBuGn=f_,t.schemeBuPu=l_,t.schemeCategory10=qv,t.schemeDark2=Fv,t.schemeGnBu=d_,t.schemeGreens=R_,t.schemeGreys=O_,t.schemeOrRd=g_,t.schemeOranges=j_,t.schemePRGn=Vv,t.schemePaired=Ov,t.schemePastel1=Iv,t.schemePastel2=Uv,t.schemePiYG=Wv,t.schemePuBu=b_,t.schemePuBuGn=v_,t.schemePuOr=Kv,t.schemePuRd=x_,t.schemePurples=U_,t.schemeRdBu=Jv,t.schemeRdGy=n_,t.schemeRdPu=M_,t.schemeRdYlBu=r_,t.schemeRdYlGn=o_,t.schemeReds=Y_,t.schemeSet1=Bv,t.schemeSet2=Yv,t.schemeSet3=Lv,t.schemeSpectral=u_,t.schemeTableau10=jv,t.schemeYlGn=E_,t.schemeYlGnBu=T_,t.schemeYlOrBr=N_,t.schemeYlOrRd=P_,t.select=Dn,t.selectAll=function(t){return"string"==typeof t?new Pn([document.querySelectorAll(t)],[document.documentElement]):new Pn([null==t?[]:Et(t)],Cn)},t.selection=zn,t.selector=St,t.selectorAll=Nt,t.shuffle=Q,t.shuffler=J,t.some=function(t,n){if("function"!=typeof n)throw new TypeError("test is not a function");let e=-1;for(const r of t)if(n(r,++e,t))return!0;return!1},t.sort=k,t.stack=function(){var t=rb([]),n=Xm,e=Hm,r=Gm;function i(i){var o,a,u=Array.from(t.apply(this,arguments),Vm),c=u.length,f=-1;for(const t of i)for(o=0,++f;o<c;++o)(u[o][f]=[0,+r(t,u[o].key,f,i)]).data=t;for(o=0,a=Tb(n(u));o<c;++o)u[a[o]].index=o;return e(u,a),u}return i.keys=function(n){return arguments.length?(t="function"==typeof n?n:rb(Array.from(n)),i):t},i.value=function(t){return arguments.length?(r="function"==typeof t?t:rb(+t),i):r},i.order=function(t){return arguments.length?(n=null==t?Xm:"function"==typeof t?t:rb(Array.from(t)),i):n},i.offset=function(t){return arguments.length?(e=null==t?Hm:t,i):e},i},t.stackOffsetDiverging=function(t,n){if((u=t.length)>0)for(var e,r,i,o,a,u,c=0,f=t[n[0]].length;c<f;++c)for(o=a=0,e=0;e<u;++e)(i=(r=t[n[e]][c])[1]-r[0])>0?(r[0]=o,r[1]=o+=i):i<0?(r[1]=a,r[0]=a+=i):(r[0]=0,r[1]=i)},t.stackOffsetExpand=function(t,n){if((r=t.length)>0){for(var e,r,i,o=0,a=t[0].length;o<a;++o){for(i=e=0;e<r;++e)i+=t[e][o][1]||0;if(i)for(e=0;e<r;++e)t[e][o][1]/=i}Hm(t,n)}},t.stackOffsetNone=Hm,t.stackOffsetSilhouette=function(t,n){if((e=t.length)>0){for(var e,r=0,i=t[n[0]],o=i.length;r<o;++r){for(var a=0,u=0;a<e;++a)u+=t[a][r][1]||0;i[r][1]+=i[r][0]=-u/2}Hm(t,n)}},t.stackOffsetWiggle=function(t,n){if((i=t.length)>0&&(r=(e=t[n[0]]).length)>0){for(var e,r,i,o=0,a=1;a<r;++a){for(var u=0,c=0,f=0;u<i;++u){for(var s=t[n[u]],l=s[a][1]||0,h=(l-(s[a-1][1]||0))/2,d=0;d<u;++d){var p=t[n[d]];h+=(p[a][1]||0)-(p[a-1][1]||0)}c+=l,f+=h*l}e[a-1][1]+=e[a-1][0]=o,c&&(o-=f/c)}e[a-1][1]+=e[a-1][0]=o,Hm(t,n)}},t.stackOrderAppearance=$m,t.stackOrderAscending=Zm,t.stackOrderDescending=function(t){return Zm(t).reverse()},t.stackOrderInsideOut=function(t){var n,e,r=t.length,i=t.map(Km),o=$m(t),a=0,u=0,c=[],f=[];for(n=0;n<r;++n)e=o[n],a<u?(a+=i[e],c.push(e)):(u+=i[e],f.push(e));return f.reverse().concat(c)},t.stackOrderNone=Xm,t.stackOrderReverse=function(t){return Xm(t).reverse()},t.stratify=function(){var t=wd,n=Md;function e(e){var r,i,o,a,u,c,f,s=Array.from(e),l=s.length,h=new Map;for(i=0;i<l;++i)r=s[i],u=s[i]=new Zh(r),null!=(c=t(r,i,e))&&(c+="")&&(f=u.id=c,h.set(f,h.has(f)?xd:u)),null!=(c=n(r,i,e))&&(c+="")&&(u.parent=c);for(i=0;i<l;++i)if(c=(u=s[i]).parent){if(!(a=h.get(c)))throw new Error("missing: "+c);if(a===xd)throw new Error("ambiguous: "+c);a.children?a.children.push(u):a.children=[u],u.parent=a}else{if(o)throw new Error("multiple roots");o=u}if(!o)throw new Error("no root");if(o.parent=md,o.eachBefore((function(t){t.depth=t.parent.depth+1,--l})).eachBefore(Wh),o.parent=null,l>0)throw new Error("cycle");return o}return e.id=function(n){return arguments.length?(t=ld(n),e):t},e.parentId=function(t){return arguments.length?(n=ld(t),e):n},e},t.style=Jt,t.subset=function(t,n){return rt(n,t)},t.sum=function(t,n){let e=0;if(void 0===n)for(let n of t)(n=+n)&&(e+=n);else{let r=-1;for(let i of t)(i=+n(i,++r,t))&&(e+=i)}return e},t.superset=rt,t.svg=Ou,t.symbol=function(t,n){var e=null;function r(){var r;if(e||(e=r=fa()),t.apply(this,arguments).draw(e,+n.apply(this,arguments)),r)return e=null,r+""||null}return t="function"==typeof t?t:rb(t||Vb),n="function"==typeof n?n:rb(void 0===n?64:+n),r.type=function(n){return arguments.length?(t="function"==typeof n?n:rb(n),r):t},r.size=function(t){return arguments.length?(n="function"==typeof t?t:rb(+t),r):n},r.context=function(t){return arguments.length?(e=null==t?null:t,r):e},r},t.symbolCircle=Vb,t.symbolCross=$b,t.symbolDiamond=Kb,t.symbolSquare=em,t.symbolStar=nm,t.symbolTriangle=im,t.symbolWye=fm,t.symbols=sm,t.text=Nu,t.thresholdFreedmanDiaconis=function(t,n,e){return Math.ceil((e-n)/(2*(H(t,.75)-H(t,.25))*Math.pow(c(t),-1/3)))},t.thresholdScott=function(t,n,e){return Math.ceil((e-n)/(3.5*d(t)*Math.pow(c(t),-1/3)))},t.thresholdSturges=I,t.tickFormat=_p,t.tickIncrement=R,t.tickStep=F,t.ticks=q,t.timeDay=eg,t.timeDays=rg,t.timeFormatDefaultLocale=xv,t.timeFormatLocale=ey,t.timeFriday=sg,t.timeFridays=vg,t.timeHour=tg,t.timeHours=ng,t.timeInterval=Bp,t.timeMillisecond=Yp,t.timeMilliseconds=Lp,t.timeMinute=Qp,t.timeMinutes=Jp,t.timeMonday=ag,t.timeMondays=dg,t.timeMonth=bg,t.timeMonths=mg,t.timeSaturday=lg,t.timeSaturdays=_g,t.timeSecond=Zp,t.timeSeconds=Kp,t.timeSunday=og,t.timeSundays=hg,t.timeThursday=fg,t.timeThursdays=yg,t.timeTickInterval=Qg,t.timeTicks=Kg,t.timeTuesday=ug,t.timeTuesdays=pg,t.timeWednesday=cg,t.timeWednesdays=gg,t.timeWeek=og,t.timeWeeks=hg,t.timeYear=xg,t.timeYears=wg,t.timeout=ci,t.timer=ri,t.timerFlush=ii,t.transition=Hi,t.transpose=tt,t.tree=function(){var t=Ad,n=1,e=1,r=null;function i(i){var c=function(t){for(var n,e,r,i,o,a=new Nd(t,0),u=[a];n=u.pop();)if(r=n._.children)for(n.children=new Array(o=r.length),i=o-1;i>=0;--i)u.push(e=n.children[i]=new Nd(r[i],i)),e.parent=n;return(a.parent=new Nd(null,0)).children=[a],a}(i);if(c.eachAfter(o),c.parent.m=-c.z,c.eachBefore(a),r)i.eachBefore(u);else{var f=i,s=i,l=i;i.eachBefore((function(t){t.x<f.x&&(f=t),t.x>s.x&&(s=t),t.depth>l.depth&&(l=t)}));var h=f===s?1:t(f,s)/2,d=h-f.x,p=n/(s.x+h+d),g=e/(l.depth||1);i.eachBefore((function(t){t.x=(t.x+d)*p,t.y=t.depth*g}))}return i}function o(n){var e=n.children,r=n.parent.children,i=n.i?r[n.i-1]:null;if(e){!function(t){for(var n,e=0,r=0,i=t.children,o=i.length;--o>=0;)(n=i[o]).z+=e,n.m+=e,e+=n.s+(r+=n.c)}(n);var o=(e[0].z+e[e.length-1].z)/2;i?(n.z=i.z+t(n._,i._),n.m=n.z-o):n.z=o}else i&&(n.z=i.z+t(n._,i._));n.parent.A=function(n,e,r){if(e){for(var i,o=n,a=n,u=e,c=o.parent.children[0],f=o.m,s=a.m,l=u.m,h=c.m;u=Sd(u),o=Td(o),u&&o;)c=Td(c),(a=Sd(a)).a=n,(i=u.z+l-o.z-f+t(u._,o._))>0&&(Ed(kd(u,n,r),n,i),f+=i,s+=i),l+=u.m,f+=o.m,h+=c.m,s+=a.m;u&&!Sd(a)&&(a.t=u,a.m+=l-s),o&&!Td(c)&&(c.t=o,c.m+=f-h,r=n)}return r}(n,i,n.parent.A||r[0])}function a(t){t._.x=t.z+t.parent.m,t.m+=t.parent.m}function u(t){t.x*=n,t.y=t.depth*e}return i.separation=function(n){return arguments.length?(t=n,i):t},i.size=function(t){return arguments.length?(r=!1,n=+t[0],e=+t[1],i):r?null:[n,e]},i.nodeSize=function(t){return arguments.length?(r=!0,n=+t[0],e=+t[1],i):r?[n,e]:null},i},t.treemap=function(){var t=Dd,n=!1,e=1,r=1,i=[0],o=hd,a=hd,u=hd,c=hd,f=hd;function s(t){return t.x0=t.y0=0,t.x1=e,t.y1=r,t.eachBefore(l),i=[0],n&&t.eachBefore(_d),t}function l(n){var e=i[n.depth],r=n.x0+e,s=n.y0+e,l=n.x1-e,h=n.y1-e;l<r&&(r=l=(r+l)/2),h<s&&(s=h=(s+h)/2),n.x0=r,n.y0=s,n.x1=l,n.y1=h,n.children&&(e=i[n.depth+1]=o(n)/2,r+=f(n)-e,s+=a(n)-e,(l-=u(n)-e)<r&&(r=l=(r+l)/2),(h-=c(n)-e)<s&&(s=h=(s+h)/2),t(n,r,s,l,h))}return s.round=function(t){return arguments.length?(n=!!t,s):n},s.size=function(t){return arguments.length?(e=+t[0],r=+t[1],s):[e,r]},s.tile=function(n){return arguments.length?(t=ld(n),s):t},s.padding=function(t){return arguments.length?s.paddingInner(t).paddingOuter(t):s.paddingInner()},s.paddingInner=function(t){return arguments.length?(o="function"==typeof t?t:dd(+t),s):o},s.paddingOuter=function(t){return arguments.length?s.paddingTop(t).paddingRight(t).paddingBottom(t).paddingLeft(t):s.paddingTop()},s.paddingTop=function(t){return arguments.length?(a="function"==typeof t?t:dd(+t),s):a},s.paddingRight=function(t){return arguments.length?(u="function"==typeof t?t:dd(+t),s):u},s.paddingBottom=function(t){return arguments.length?(c="function"==typeof t?t:dd(+t),s):c},s.paddingLeft=function(t){return arguments.length?(f="function"==typeof t?t:dd(+t),s):f},s},t.treemapBinary=function(t,n,e,r,i){var o,a,u=t.children,c=u.length,f=new Array(c+1);for(f[0]=a=o=0;o<c;++o)f[o+1]=a+=u[o].value;!function t(n,e,r,i,o,a,c){if(n>=e-1){var s=u[n];return s.x0=i,s.y0=o,s.x1=a,void(s.y1=c)}var l=f[n],h=r/2+l,d=n+1,p=e-1;for(;d<p;){var g=d+p>>>1;f[g]<h?d=g+1:p=g}h-f[d-1]<f[d]-h&&n+1<d&&--d;var y=f[d]-l,v=r-y;if(a-i>c-o){var _=r?(i*v+a*y)/r:a;t(n,d,y,i,o,_,c),t(d,e,v,_,o,a,c)}else{var b=r?(o*v+c*y)/r:c;t(n,d,y,i,o,a,b),t(d,e,v,i,b,a,c)}}(0,c,t.value,n,e,r,i)},t.treemapDice=bd,t.treemapResquarify=qd,t.treemapSlice=Cd,t.treemapSliceDice=function(t,n,e,r,i){(1&t.depth?Cd:bd)(t,n,e,r,i)},t.treemapSquarify=Dd,t.tsv=zu,t.tsvFormat=mu,t.tsvFormatBody=xu,t.tsvFormatRow=Mu,t.tsvFormatRows=wu,t.tsvFormatValue=Au,t.tsvParse=_u,t.tsvParseRows=bu,t.union=function(...t){const n=new Set;for(const e of t)for(const t of e)n.add(t);return n},t.utcDay=Eg,t.utcDays=kg,t.utcFriday=Rg,t.utcFridays=Lg,t.utcHour=Tg,t.utcHours=Sg,t.utcMillisecond=Yp,t.utcMilliseconds=Lp,t.utcMinute=Mg,t.utcMinutes=Ag,t.utcMonday=Pg,t.utcMondays=Ig,t.utcMonth=Hg,t.utcMonths=Xg,t.utcSaturday=Fg,t.utcSaturdays=jg,t.utcSecond=Zp,t.utcSeconds=Kp,t.utcSunday=Cg,t.utcSundays=Og,t.utcThursday=qg,t.utcThursdays=Yg,t.utcTickInterval=Zg,t.utcTicks=Wg,t.utcTuesday=zg,t.utcTuesdays=Ug,t.utcWednesday=Dg,t.utcWednesdays=Bg,t.utcWeek=Cg,t.utcWeeks=Og,t.utcYear=Gg,t.utcYears=Vg,t.variance=h,t.version="6.7.0",t.window=Wt,t.xml=Ru,t.zip=function(){return tt(arguments)},t.zoom=function(){var t,n,e,r=ox,i=ax,o=sx,a=cx,u=fx,c=[0,1/0],f=[[-1/0,-1/0],[1/0,1/0]],s=250,l=Dr,h=pt("start","zoom","end"),d=500,p=0,g=10;function y(t){t.property("__zoom",ux).on("wheel.zoom",M).on("mousedown.zoom",A).on("dblclick.zoom",T).filter(u).on("touchstart.zoom",S).on("touchmove.zoom",E).on("touchend.zoom touchcancel.zoom",k).style("-webkit-tap-highlight-color","rgba(0,0,0,0)")}function v(t,n){return(n=Math.max(c[0],Math.min(c[1],n)))===t.k?t:new tx(n,t.x,t.y)}function _(t,n,e){var r=n[0]-e[0]*t.k,i=n[1]-e[1]*t.k;return r===t.x&&i===t.y?t:new tx(t.k,r,i)}function b(t){return[(+t[0][0]+ +t[1][0])/2,(+t[0][1]+ +t[1][1])/2]}function m(t,n,e,r){t.on("start.zoom",(function(){x(this,arguments).event(r).start()})).on("interrupt.zoom end.zoom",(function(){x(this,arguments).event(r).end()})).tween("zoom",(function(){var t=this,o=arguments,a=x(t,o).event(r),u=i.apply(t,o),c=null==e?b(u):"function"==typeof e?e.apply(t,o):e,f=Math.max(u[1][0]-u[0][0],u[1][1]-u[0][1]),s=t.__zoom,h="function"==typeof n?n.apply(t,o):n,d=l(s.invert(c).concat(f/s.k),h.invert(c).concat(f/h.k));return function(t){if(1===t)t=h;else{var n=d(t),e=f/n[2];t=new tx(e,c[0]-n[0]*e,c[1]-n[1]*e)}a.zoom(null,t)}}))}function x(t,n,e){return!e&&t.__zooming||new w(t,n)}function w(t,n){this.that=t,this.args=n,this.active=0,this.sourceEvent=null,this.extent=i.apply(t,n),this.taps=0}function M(t,...n){if(r.apply(this,arguments)){var e=x(this,n).event(t),i=this.__zoom,u=Math.max(c[0],Math.min(c[1],i.k*Math.pow(2,a.apply(this,arguments)))),s=In(t);if(e.wheel)e.mouse[0][0]===s[0]&&e.mouse[0][1]===s[1]||(e.mouse[1]=i.invert(e.mouse[0]=s)),clearTimeout(e.wheel);else{if(i.k===u)return;e.mouse=[s,i.invert(s)],gi(this),e.start()}ix(t),e.wheel=setTimeout(l,150),e.zoom("mouse",o(_(v(i,u),e.mouse[0],e.mouse[1]),e.extent,f))}function l(){e.wheel=null,e.end()}}function A(t,...n){if(!e&&r.apply(this,arguments)){var i=x(this,n,!0).event(t),a=Dn(t.view).on("mousemove.zoom",h,!0).on("mouseup.zoom",d,!0),u=In(t,c),c=t.currentTarget,s=t.clientX,l=t.clientY;Yn(t.view),rx(t),i.mouse=[u,this.__zoom.invert(u)],gi(this),i.start()}function h(t){if(ix(t),!i.moved){var n=t.clientX-s,e=t.clientY-l;i.moved=n*n+e*e>p}i.event(t).zoom("mouse",o(_(i.that.__zoom,i.mouse[0]=In(t,c),i.mouse[1]),i.extent,f))}function d(t){a.on("mousemove.zoom mouseup.zoom",null),Ln(t.view,i.moved),ix(t),i.event(t).end()}}function T(t,...n){if(r.apply(this,arguments)){var e=this.__zoom,a=In(t.changedTouches?t.changedTouches[0]:t,this),u=e.invert(a),c=e.k*(t.shiftKey?.5:2),l=o(_(v(e,c),a,u),i.apply(this,n),f);ix(t),s>0?Dn(this).transition().duration(s).call(m,l,a,t):Dn(this).call(y.transform,l,a,t)}}function S(e,...i){if(r.apply(this,arguments)){var o,a,u,c,f=e.touches,s=f.length,l=x(this,i,e.changedTouches.length===s).event(e);for(rx(e),a=0;a<s;++a)c=[c=In(u=f[a],this),this.__zoom.invert(c),u.identifier],l.touch0?l.touch1||l.touch0[2]===c[2]||(l.touch1=c,l.taps=0):(l.touch0=c,o=!0,l.taps=1+!!t);t&&(t=clearTimeout(t)),o&&(l.taps<2&&(n=c[0],t=setTimeout((function(){t=null}),d)),gi(this),l.start())}}function E(t,...n){if(this.__zooming){var e,r,i,a,u=x(this,n).event(t),c=t.changedTouches,s=c.length;for(ix(t),e=0;e<s;++e)i=In(r=c[e],this),u.touch0&&u.touch0[2]===r.identifier?u.touch0[0]=i:u.touch1&&u.touch1[2]===r.identifier&&(u.touch1[0]=i);if(r=u.that.__zoom,u.touch1){var l=u.touch0[0],h=u.touch0[1],d=u.touch1[0],p=u.touch1[1],g=(g=d[0]-l[0])*g+(g=d[1]-l[1])*g,y=(y=p[0]-h[0])*y+(y=p[1]-h[1])*y;r=v(r,Math.sqrt(g/y)),i=[(l[0]+d[0])/2,(l[1]+d[1])/2],a=[(h[0]+p[0])/2,(h[1]+p[1])/2]}else{if(!u.touch0)return;i=u.touch0[0],a=u.touch0[1]}u.zoom("touch",o(_(r,i,a),u.extent,f))}}function k(t,...r){if(this.__zooming){var i,o,a=x(this,r).event(t),u=t.changedTouches,c=u.length;for(rx(t),e&&clearTimeout(e),e=setTimeout((function(){e=null}),d),i=0;i<c;++i)o=u[i],a.touch0&&a.touch0[2]===o.identifier?delete a.touch0:a.touch1&&a.touch1[2]===o.identifier&&delete a.touch1;if(a.touch1&&!a.touch0&&(a.touch0=a.touch1,delete a.touch1),a.touch0)a.touch0[1]=this.__zoom.invert(a.touch0[0]);else if(a.end(),2===a.taps&&(o=In(o,this),Math.hypot(n[0]-o[0],n[1]-o[1])<g)){var f=Dn(this).on("dblclick.zoom");f&&f.apply(this,arguments)}}}return y.transform=function(t,n,e,r){var i=t.selection?t.selection():t;i.property("__zoom",ux),t!==i?m(t,n,e,r):i.interrupt().each((function(){x(this,arguments).event(r).start().zoom(null,"function"==typeof n?n.apply(this,arguments):n).end()}))},y.scaleBy=function(t,n,e,r){y.scaleTo(t,(function(){var t=this.__zoom.k,e="function"==typeof n?n.apply(this,arguments):n;return t*e}),e,r)},y.scaleTo=function(t,n,e,r){y.transform(t,(function(){var t=i.apply(this,arguments),r=this.__zoom,a=null==e?b(t):"function"==typeof e?e.apply(this,arguments):e,u=r.invert(a),c="function"==typeof n?n.apply(this,arguments):n;return o(_(v(r,c),a,u),t,f)}),e,r)},y.translateBy=function(t,n,e,r){y.transform(t,(function(){return o(this.__zoom.translate("function"==typeof n?n.apply(this,arguments):n,"function"==typeof e?e.apply(this,arguments):e),i.apply(this,arguments),f)}),null,r)},y.translateTo=function(t,n,e,r,a){y.transform(t,(function(){var t=i.apply(this,arguments),a=this.__zoom,u=null==r?b(t):"function"==typeof r?r.apply(this,arguments):r;return o(nx.translate(u[0],u[1]).scale(a.k).translate("function"==typeof n?-n.apply(this,arguments):-n,"function"==typeof e?-e.apply(this,arguments):-e),t,f)}),r,a)},w.prototype={event:function(t){return t&&(this.sourceEvent=t),this},start:function(){return 1==++this.active&&(this.that.__zooming=this,this.emit("start")),this},zoom:function(t,n){return this.mouse&&"mouse"!==t&&(this.mouse[1]=n.invert(this.mouse[0])),this.touch0&&"touch"!==t&&(this.touch0[1]=n.invert(this.touch0[0])),this.touch1&&"touch"!==t&&(this.touch1[1]=n.invert(this.touch1[0])),this.that.__zoom=n,this.emit("zoom"),this},end:function(){return 0==--this.active&&(delete this.that.__zooming,this.emit("end")),this},emit:function(t){var n=Dn(this.that).datum();h.call(t,this.that,new Jm(t,{sourceEvent:this.sourceEvent,target:y,type:t,transform:this.that.__zoom,dispatch:h}),n)}},y.wheelDelta=function(t){return arguments.length?(a="function"==typeof t?t:Qm(+t),y):a},y.filter=function(t){return arguments.length?(r="function"==typeof t?t:Qm(!!t),y):r},y.touchable=function(t){return arguments.length?(u="function"==typeof t?t:Qm(!!t),y):u},y.extent=function(t){return arguments.length?(i="function"==typeof t?t:Qm([[+t[0][0],+t[0][1]],[+t[1][0],+t[1][1]]]),y):i},y.scaleExtent=function(t){return arguments.length?(c[0]=+t[0],c[1]=+t[1],y):[c[0],c[1]]},y.translateExtent=function(t){return arguments.length?(f[0][0]=+t[0][0],f[1][0]=+t[1][0],f[0][1]=+t[0][1],f[1][1]=+t[1][1],y):[[f[0][0],f[0][1]],[f[1][0],f[1][1]]]},y.constrain=function(t){return arguments.length?(o=t,y):o},y.duration=function(t){return arguments.length?(s=+t,y):s},y.interpolate=function(t){return arguments.length?(l=t,y):l},y.on=function(){var t=h.on.apply(h,arguments);return t===h?y:t},y.clickDistance=function(t){return arguments.length?(p=(t=+t)*t,y):Math.sqrt(p)},y.tapDistance=function(t){return arguments.length?(g=+t,y):g},y},t.zoomIdentity=nx,t.zoomTransform=ex,Object.defineProperty(t,"__esModule",{value:!0})}));

/*! markmap-lib v0.14.3 | MIT License */
!function(e, t) {
    "object" == typeof exports && "undefined" != typeof module ? t(exports, require("katex")) : "function" == typeof define && define.amd ? define(["exports", "katex"], t) : t((e = "undefined" != typeof globalThis ? globalThis : e || self).markmap = e.markmap || {}, e.window.katex)
}(this, (function(e, t) {
    "use strict";
    function r(e) {
        return e && "object" == typeof e && "default"in e ? e.default : e
    }
    var n = r(t);
    function i() {
        return i = Object.assign ? Object.assign.bind() : function(e) {
            for (var t = 1; t < arguments.length; t++) {
                var r = arguments[t];
                for (var n in r)
                    Object.prototype.hasOwnProperty.call(r, n) && (e[n] = r[n])
            }
            return e
        }
        ,
        i.apply(this, arguments)
    }
    /*! markmap-common v0.14.2 | MIT License */
    class o {
        constructor() {
            this.listeners = []
        }
        tap(e) {
            return this.listeners.push(e),
            ()=>this.revoke(e)
        }
        revoke(e) {
            const t = this.listeners.indexOf(e);
            t >= 0 && this.listeners.splice(t, 1)
        }
        revokeAll() {
            this.listeners.splice(0)
        }
        call(...e) {
            for (const t of this.listeners)
                t(...e)
        }
    }
    function s() {
        return s = Object.assign || function(e) {
            for (var t = 1; t < arguments.length; t++) {
                var r = arguments[t];
                for (var n in r)
                    Object.prototype.hasOwnProperty.call(r, n) && (e[n] = r[n])
            }
            return e
        }
        ,
        s.apply(this, arguments)
    }
    const a = ["textContent"];
    function l(e) {
        return e.replace(/[&<"]/g, (e=>({
            "&": "&amp;",
            "<": "&lt;",
            '"': "&quot;"
        }[e])))
    }
    function c(e, t) {
        return `<${e}${t ? Object.entries(t).map((([e,t])=>{
            if (null != t && !1 !== t)
                return e = ` ${l(e)}`,
                !0 === t ? e : `${e}="${l(t)}"`
        }
        )).filter(Boolean).join("") : ""}>`
    }
    function p(e, t, r) {
        return null == t ? c(e, r) : c(e, r) + (t || "") + function(e) {
            return `</${e}>`
        }(e)
    }
    function u(e, t) {
        return e.map((e=>{
            if ("script" === e.type) {
                const t = e.data
                  , {textContent: r} = t
                  , n = function(e, t) {
                    if (null == e)
                        return {};
                    var r, n, i = {}, o = Object.keys(e);
                    for (n = 0; n < o.length; n++)
                        r = o[n],
                        t.indexOf(r) >= 0 || (i[r] = e[r]);
                    return i
                }(t, a);
                return p("script", r || "", n)
            }
            if ("iife" === e.type) {
                const {fn: n, getParams: i} = e.data;
                return p("script", (r = function(e, t) {
                    const r = t.map((e=>"function" == typeof e ? e.toString() : JSON.stringify(null != e ? e : null))).join(",");
                    return `(${e.toString()})(${r})`
                }(n, (null == i ? void 0 : i(t)) || []),
                r.replace(/<(\/script>)/g, "\\x3c$2")))
            }
            var r;
            return ""
        }
        ))
    }
    function f(e, {before: t, after: r}) {
        return function(...n) {
            const i = {
                args: n,
                thisObj: this
            };
            try {
                t && t(i)
            } catch (e) {}
            i.result = e.apply(i.thisObj, i.args);
            try {
                r && r(i)
            } catch (e) {}
            return i.result
        }
    }
    function h(e, t, r) {
        const n = document.createElement(e);
        return t && Object.entries(t).forEach((([e,t])=>{
            n[e] = t
        }
        )),
        r && Object.entries(r).forEach((([e,t])=>{
            n.setAttribute(e, t)
        }
        )),
        n
    }
    Math.random().toString(36).slice(2, 8);
    const d = function(e) {
        const t = {};
        return function(...r) {
            const n = `${r[0]}`;
            let i = t[n];
            return i || (i = {
                value: e(...r)
            },
            t[n] = i),
            i.value
        }
    }((e=>{
        document.head.append(h("link", {
            rel: "preload",
            as: "script",
            href: e
        }))
    }
    ));
    async function g(e, t) {
        if (!e.loaded && ("script" === e.type && (e.loaded = new Promise(((t,r)=>{
            var n;
            document.head.append(h("script", s({}, e.data, {
                onload: t,
                onerror: r
            }))),
            null != (n = e.data) && n.src || t(void 0)
        }
        )).then((()=>{
            e.loaded = !0
        }
        ))),
        "iife" === e.type)) {
            const {fn: r, getParams: n} = e.data;
            r(...(null == n ? void 0 : n(t)) || []),
            e.loaded = !0
        }
        await e.loaded
    }
    async function m(e, t) {
        const r = e.filter((e=>{
            var t;
            return "script" === e.type && (null == (t = e.data) ? void 0 : t.src)
        }
        ));
        r.length > 1 && r.forEach((e=>d(e.data.src))),
        t = s({
            getMarkmap: ()=>window.markmap
        }, t);
        for (const r of e)
            await g(r, t)
    }
    const b = ["https://cdn.jsdelivr.net/npm/d3@6.7.0", "https://cdn.jsdelivr.net/npm/markmap-view@0.14.3"].map((e=>({
        type: "script",
        data: {
            src: e
        }
    })));
    var v = {
        Aacute: "Á",
        aacute: "á",
        Abreve: "Ă",
        abreve: "ă",
        ac: "∾",
        acd: "∿",
        acE: "∾̳",
        Acirc: "Â",
        acirc: "â",
        acute: "´",
        Acy: "А",
        acy: "а",
        AElig: "Æ",
        aelig: "æ",
        af: "⁡",
        Afr: "𝔄",
        afr: "𝔞",
        Agrave: "À",
        agrave: "à",
        alefsym: "ℵ",
        aleph: "ℵ",
        Alpha: "Α",
        alpha: "α",
        Amacr: "Ā",
        amacr: "ā",
        amalg: "⨿",
        AMP: "&",
        amp: "&",
        And: "⩓",
        and: "∧",
        andand: "⩕",
        andd: "⩜",
        andslope: "⩘",
        andv: "⩚",
        ang: "∠",
        ange: "⦤",
        angle: "∠",
        angmsd: "∡",
        angmsdaa: "⦨",
        angmsdab: "⦩",
        angmsdac: "⦪",
        angmsdad: "⦫",
        angmsdae: "⦬",
        angmsdaf: "⦭",
        angmsdag: "⦮",
        angmsdah: "⦯",
        angrt: "∟",
        angrtvb: "⊾",
        angrtvbd: "⦝",
        angsph: "∢",
        angst: "Å",
        angzarr: "⍼",
        Aogon: "Ą",
        aogon: "ą",
        Aopf: "𝔸",
        aopf: "𝕒",
        ap: "≈",
        apacir: "⩯",
        apE: "⩰",
        ape: "≊",
        apid: "≋",
        apos: "'",
        ApplyFunction: "⁡",
        approx: "≈",
        approxeq: "≊",
        Aring: "Å",
        aring: "å",
        Ascr: "𝒜",
        ascr: "𝒶",
        Assign: "≔",
        ast: "*",
        asymp: "≈",
        asympeq: "≍",
        Atilde: "Ã",
        atilde: "ã",
        Auml: "Ä",
        auml: "ä",
        awconint: "∳",
        awint: "⨑",
        backcong: "≌",
        backepsilon: "϶",
        backprime: "‵",
        backsim: "∽",
        backsimeq: "⋍",
        Backslash: "∖",
        Barv: "⫧",
        barvee: "⊽",
        Barwed: "⌆",
        barwed: "⌅",
        barwedge: "⌅",
        bbrk: "⎵",
        bbrktbrk: "⎶",
        bcong: "≌",
        Bcy: "Б",
        bcy: "б",
        bdquo: "„",
        becaus: "∵",
        Because: "∵",
        because: "∵",
        bemptyv: "⦰",
        bepsi: "϶",
        bernou: "ℬ",
        Bernoullis: "ℬ",
        Beta: "Β",
        beta: "β",
        beth: "ℶ",
        between: "≬",
        Bfr: "𝔅",
        bfr: "𝔟",
        bigcap: "⋂",
        bigcirc: "◯",
        bigcup: "⋃",
        bigodot: "⨀",
        bigoplus: "⨁",
        bigotimes: "⨂",
        bigsqcup: "⨆",
        bigstar: "★",
        bigtriangledown: "▽",
        bigtriangleup: "△",
        biguplus: "⨄",
        bigvee: "⋁",
        bigwedge: "⋀",
        bkarow: "⤍",
        blacklozenge: "⧫",
        blacksquare: "▪",
        blacktriangle: "▴",
        blacktriangledown: "▾",
        blacktriangleleft: "◂",
        blacktriangleright: "▸",
        blank: "␣",
        blk12: "▒",
        blk14: "░",
        blk34: "▓",
        block: "█",
        bne: "=⃥",
        bnequiv: "≡⃥",
        bNot: "⫭",
        bnot: "⌐",
        Bopf: "𝔹",
        bopf: "𝕓",
        bot: "⊥",
        bottom: "⊥",
        bowtie: "⋈",
        boxbox: "⧉",
        boxDL: "╗",
        boxDl: "╖",
        boxdL: "╕",
        boxdl: "┐",
        boxDR: "╔",
        boxDr: "╓",
        boxdR: "╒",
        boxdr: "┌",
        boxH: "═",
        boxh: "─",
        boxHD: "╦",
        boxHd: "╤",
        boxhD: "╥",
        boxhd: "┬",
        boxHU: "╩",
        boxHu: "╧",
        boxhU: "╨",
        boxhu: "┴",
        boxminus: "⊟",
        boxplus: "⊞",
        boxtimes: "⊠",
        boxUL: "╝",
        boxUl: "╜",
        boxuL: "╛",
        boxul: "┘",
        boxUR: "╚",
        boxUr: "╙",
        boxuR: "╘",
        boxur: "└",
        boxV: "║",
        boxv: "│",
        boxVH: "╬",
        boxVh: "╫",
        boxvH: "╪",
        boxvh: "┼",
        boxVL: "╣",
        boxVl: "╢",
        boxvL: "╡",
        boxvl: "┤",
        boxVR: "╠",
        boxVr: "╟",
        boxvR: "╞",
        boxvr: "├",
        bprime: "‵",
        Breve: "˘",
        breve: "˘",
        brvbar: "¦",
        Bscr: "ℬ",
        bscr: "𝒷",
        bsemi: "⁏",
        bsim: "∽",
        bsime: "⋍",
        bsol: "\\",
        bsolb: "⧅",
        bsolhsub: "⟈",
        bull: "•",
        bullet: "•",
        bump: "≎",
        bumpE: "⪮",
        bumpe: "≏",
        Bumpeq: "≎",
        bumpeq: "≏",
        Cacute: "Ć",
        cacute: "ć",
        Cap: "⋒",
        cap: "∩",
        capand: "⩄",
        capbrcup: "⩉",
        capcap: "⩋",
        capcup: "⩇",
        capdot: "⩀",
        CapitalDifferentialD: "ⅅ",
        caps: "∩︀",
        caret: "⁁",
        caron: "ˇ",
        Cayleys: "ℭ",
        ccaps: "⩍",
        Ccaron: "Č",
        ccaron: "č",
        Ccedil: "Ç",
        ccedil: "ç",
        Ccirc: "Ĉ",
        ccirc: "ĉ",
        Cconint: "∰",
        ccups: "⩌",
        ccupssm: "⩐",
        Cdot: "Ċ",
        cdot: "ċ",
        cedil: "¸",
        Cedilla: "¸",
        cemptyv: "⦲",
        cent: "¢",
        CenterDot: "·",
        centerdot: "·",
        Cfr: "ℭ",
        cfr: "𝔠",
        CHcy: "Ч",
        chcy: "ч",
        check: "✓",
        checkmark: "✓",
        Chi: "Χ",
        chi: "χ",
        cir: "○",
        circ: "ˆ",
        circeq: "≗",
        circlearrowleft: "↺",
        circlearrowright: "↻",
        circledast: "⊛",
        circledcirc: "⊚",
        circleddash: "⊝",
        CircleDot: "⊙",
        circledR: "®",
        circledS: "Ⓢ",
        CircleMinus: "⊖",
        CirclePlus: "⊕",
        CircleTimes: "⊗",
        cirE: "⧃",
        cire: "≗",
        cirfnint: "⨐",
        cirmid: "⫯",
        cirscir: "⧂",
        ClockwiseContourIntegral: "∲",
        CloseCurlyDoubleQuote: "”",
        CloseCurlyQuote: "’",
        clubs: "♣",
        clubsuit: "♣",
        Colon: "∷",
        colon: ":",
        Colone: "⩴",
        colone: "≔",
        coloneq: "≔",
        comma: ",",
        commat: "@",
        comp: "∁",
        compfn: "∘",
        complement: "∁",
        complexes: "ℂ",
        cong: "≅",
        congdot: "⩭",
        Congruent: "≡",
        Conint: "∯",
        conint: "∮",
        ContourIntegral: "∮",
        Copf: "ℂ",
        copf: "𝕔",
        coprod: "∐",
        Coproduct: "∐",
        COPY: "©",
        copy: "©",
        copysr: "℗",
        CounterClockwiseContourIntegral: "∳",
        crarr: "↵",
        Cross: "⨯",
        cross: "✗",
        Cscr: "𝒞",
        cscr: "𝒸",
        csub: "⫏",
        csube: "⫑",
        csup: "⫐",
        csupe: "⫒",
        ctdot: "⋯",
        cudarrl: "⤸",
        cudarrr: "⤵",
        cuepr: "⋞",
        cuesc: "⋟",
        cularr: "↶",
        cularrp: "⤽",
        Cup: "⋓",
        cup: "∪",
        cupbrcap: "⩈",
        CupCap: "≍",
        cupcap: "⩆",
        cupcup: "⩊",
        cupdot: "⊍",
        cupor: "⩅",
        cups: "∪︀",
        curarr: "↷",
        curarrm: "⤼",
        curlyeqprec: "⋞",
        curlyeqsucc: "⋟",
        curlyvee: "⋎",
        curlywedge: "⋏",
        curren: "¤",
        curvearrowleft: "↶",
        curvearrowright: "↷",
        cuvee: "⋎",
        cuwed: "⋏",
        cwconint: "∲",
        cwint: "∱",
        cylcty: "⌭",
        Dagger: "‡",
        dagger: "†",
        daleth: "ℸ",
        Darr: "↡",
        dArr: "⇓",
        darr: "↓",
        dash: "‐",
        Dashv: "⫤",
        dashv: "⊣",
        dbkarow: "⤏",
        dblac: "˝",
        Dcaron: "Ď",
        dcaron: "ď",
        Dcy: "Д",
        dcy: "д",
        DD: "ⅅ",
        dd: "ⅆ",
        ddagger: "‡",
        ddarr: "⇊",
        DDotrahd: "⤑",
        ddotseq: "⩷",
        deg: "°",
        Del: "∇",
        Delta: "Δ",
        delta: "δ",
        demptyv: "⦱",
        dfisht: "⥿",
        Dfr: "𝔇",
        dfr: "𝔡",
        dHar: "⥥",
        dharl: "⇃",
        dharr: "⇂",
        DiacriticalAcute: "´",
        DiacriticalDot: "˙",
        DiacriticalDoubleAcute: "˝",
        DiacriticalGrave: "`",
        DiacriticalTilde: "˜",
        diam: "⋄",
        Diamond: "⋄",
        diamond: "⋄",
        diamondsuit: "♦",
        diams: "♦",
        die: "¨",
        DifferentialD: "ⅆ",
        digamma: "ϝ",
        disin: "⋲",
        div: "÷",
        divide: "÷",
        divideontimes: "⋇",
        divonx: "⋇",
        DJcy: "Ђ",
        djcy: "ђ",
        dlcorn: "⌞",
        dlcrop: "⌍",
        dollar: "$",
        Dopf: "𝔻",
        dopf: "𝕕",
        Dot: "¨",
        dot: "˙",
        DotDot: "⃜",
        doteq: "≐",
        doteqdot: "≑",
        DotEqual: "≐",
        dotminus: "∸",
        dotplus: "∔",
        dotsquare: "⊡",
        doublebarwedge: "⌆",
        DoubleContourIntegral: "∯",
        DoubleDot: "¨",
        DoubleDownArrow: "⇓",
        DoubleLeftArrow: "⇐",
        DoubleLeftRightArrow: "⇔",
        DoubleLeftTee: "⫤",
        DoubleLongLeftArrow: "⟸",
        DoubleLongLeftRightArrow: "⟺",
        DoubleLongRightArrow: "⟹",
        DoubleRightArrow: "⇒",
        DoubleRightTee: "⊨",
        DoubleUpArrow: "⇑",
        DoubleUpDownArrow: "⇕",
        DoubleVerticalBar: "∥",
        DownArrow: "↓",
        Downarrow: "⇓",
        downarrow: "↓",
        DownArrowBar: "⤓",
        DownArrowUpArrow: "⇵",
        DownBreve: "̑",
        downdownarrows: "⇊",
        downharpoonleft: "⇃",
        downharpoonright: "⇂",
        DownLeftRightVector: "⥐",
        DownLeftTeeVector: "⥞",
        DownLeftVector: "↽",
        DownLeftVectorBar: "⥖",
        DownRightTeeVector: "⥟",
        DownRightVector: "⇁",
        DownRightVectorBar: "⥗",
        DownTee: "⊤",
        DownTeeArrow: "↧",
        drbkarow: "⤐",
        drcorn: "⌟",
        drcrop: "⌌",
        Dscr: "𝒟",
        dscr: "𝒹",
        DScy: "Ѕ",
        dscy: "ѕ",
        dsol: "⧶",
        Dstrok: "Đ",
        dstrok: "đ",
        dtdot: "⋱",
        dtri: "▿",
        dtrif: "▾",
        duarr: "⇵",
        duhar: "⥯",
        dwangle: "⦦",
        DZcy: "Џ",
        dzcy: "џ",
        dzigrarr: "⟿",
        Eacute: "É",
        eacute: "é",
        easter: "⩮",
        Ecaron: "Ě",
        ecaron: "ě",
        ecir: "≖",
        Ecirc: "Ê",
        ecirc: "ê",
        ecolon: "≕",
        Ecy: "Э",
        ecy: "э",
        eDDot: "⩷",
        Edot: "Ė",
        eDot: "≑",
        edot: "ė",
        ee: "ⅇ",
        efDot: "≒",
        Efr: "𝔈",
        efr: "𝔢",
        eg: "⪚",
        Egrave: "È",
        egrave: "è",
        egs: "⪖",
        egsdot: "⪘",
        el: "⪙",
        Element: "∈",
        elinters: "⏧",
        ell: "ℓ",
        els: "⪕",
        elsdot: "⪗",
        Emacr: "Ē",
        emacr: "ē",
        empty: "∅",
        emptyset: "∅",
        EmptySmallSquare: "◻",
        emptyv: "∅",
        EmptyVerySmallSquare: "▫",
        emsp: " ",
        emsp13: " ",
        emsp14: " ",
        ENG: "Ŋ",
        eng: "ŋ",
        ensp: " ",
        Eogon: "Ę",
        eogon: "ę",
        Eopf: "𝔼",
        eopf: "𝕖",
        epar: "⋕",
        eparsl: "⧣",
        eplus: "⩱",
        epsi: "ε",
        Epsilon: "Ε",
        epsilon: "ε",
        epsiv: "ϵ",
        eqcirc: "≖",
        eqcolon: "≕",
        eqsim: "≂",
        eqslantgtr: "⪖",
        eqslantless: "⪕",
        Equal: "⩵",
        equals: "=",
        EqualTilde: "≂",
        equest: "≟",
        Equilibrium: "⇌",
        equiv: "≡",
        equivDD: "⩸",
        eqvparsl: "⧥",
        erarr: "⥱",
        erDot: "≓",
        Escr: "ℰ",
        escr: "ℯ",
        esdot: "≐",
        Esim: "⩳",
        esim: "≂",
        Eta: "Η",
        eta: "η",
        ETH: "Ð",
        eth: "ð",
        Euml: "Ë",
        euml: "ë",
        euro: "€",
        excl: "!",
        exist: "∃",
        Exists: "∃",
        expectation: "ℰ",
        ExponentialE: "ⅇ",
        exponentiale: "ⅇ",
        fallingdotseq: "≒",
        Fcy: "Ф",
        fcy: "ф",
        female: "♀",
        ffilig: "ﬃ",
        fflig: "ﬀ",
        ffllig: "ﬄ",
        Ffr: "𝔉",
        ffr: "𝔣",
        filig: "ﬁ",
        FilledSmallSquare: "◼",
        FilledVerySmallSquare: "▪",
        fjlig: "fj",
        flat: "♭",
        fllig: "ﬂ",
        fltns: "▱",
        fnof: "ƒ",
        Fopf: "𝔽",
        fopf: "𝕗",
        ForAll: "∀",
        forall: "∀",
        fork: "⋔",
        forkv: "⫙",
        Fouriertrf: "ℱ",
        fpartint: "⨍",
        frac12: "½",
        frac13: "⅓",
        frac14: "¼",
        frac15: "⅕",
        frac16: "⅙",
        frac18: "⅛",
        frac23: "⅔",
        frac25: "⅖",
        frac34: "¾",
        frac35: "⅗",
        frac38: "⅜",
        frac45: "⅘",
        frac56: "⅚",
        frac58: "⅝",
        frac78: "⅞",
        frasl: "⁄",
        frown: "⌢",
        Fscr: "ℱ",
        fscr: "𝒻",
        gacute: "ǵ",
        Gamma: "Γ",
        gamma: "γ",
        Gammad: "Ϝ",
        gammad: "ϝ",
        gap: "⪆",
        Gbreve: "Ğ",
        gbreve: "ğ",
        Gcedil: "Ģ",
        Gcirc: "Ĝ",
        gcirc: "ĝ",
        Gcy: "Г",
        gcy: "г",
        Gdot: "Ġ",
        gdot: "ġ",
        gE: "≧",
        ge: "≥",
        gEl: "⪌",
        gel: "⋛",
        geq: "≥",
        geqq: "≧",
        geqslant: "⩾",
        ges: "⩾",
        gescc: "⪩",
        gesdot: "⪀",
        gesdoto: "⪂",
        gesdotol: "⪄",
        gesl: "⋛︀",
        gesles: "⪔",
        Gfr: "𝔊",
        gfr: "𝔤",
        Gg: "⋙",
        gg: "≫",
        ggg: "⋙",
        gimel: "ℷ",
        GJcy: "Ѓ",
        gjcy: "ѓ",
        gl: "≷",
        gla: "⪥",
        glE: "⪒",
        glj: "⪤",
        gnap: "⪊",
        gnapprox: "⪊",
        gnE: "≩",
        gne: "⪈",
        gneq: "⪈",
        gneqq: "≩",
        gnsim: "⋧",
        Gopf: "𝔾",
        gopf: "𝕘",
        grave: "`",
        GreaterEqual: "≥",
        GreaterEqualLess: "⋛",
        GreaterFullEqual: "≧",
        GreaterGreater: "⪢",
        GreaterLess: "≷",
        GreaterSlantEqual: "⩾",
        GreaterTilde: "≳",
        Gscr: "𝒢",
        gscr: "ℊ",
        gsim: "≳",
        gsime: "⪎",
        gsiml: "⪐",
        GT: ">",
        Gt: "≫",
        gt: ">",
        gtcc: "⪧",
        gtcir: "⩺",
        gtdot: "⋗",
        gtlPar: "⦕",
        gtquest: "⩼",
        gtrapprox: "⪆",
        gtrarr: "⥸",
        gtrdot: "⋗",
        gtreqless: "⋛",
        gtreqqless: "⪌",
        gtrless: "≷",
        gtrsim: "≳",
        gvertneqq: "≩︀",
        gvnE: "≩︀",
        Hacek: "ˇ",
        hairsp: " ",
        half: "½",
        hamilt: "ℋ",
        HARDcy: "Ъ",
        hardcy: "ъ",
        hArr: "⇔",
        harr: "↔",
        harrcir: "⥈",
        harrw: "↭",
        Hat: "^",
        hbar: "ℏ",
        Hcirc: "Ĥ",
        hcirc: "ĥ",
        hearts: "♥",
        heartsuit: "♥",
        hellip: "…",
        hercon: "⊹",
        Hfr: "ℌ",
        hfr: "𝔥",
        HilbertSpace: "ℋ",
        hksearow: "⤥",
        hkswarow: "⤦",
        hoarr: "⇿",
        homtht: "∻",
        hookleftarrow: "↩",
        hookrightarrow: "↪",
        Hopf: "ℍ",
        hopf: "𝕙",
        horbar: "―",
        HorizontalLine: "─",
        Hscr: "ℋ",
        hscr: "𝒽",
        hslash: "ℏ",
        Hstrok: "Ħ",
        hstrok: "ħ",
        HumpDownHump: "≎",
        HumpEqual: "≏",
        hybull: "⁃",
        hyphen: "‐",
        Iacute: "Í",
        iacute: "í",
        ic: "⁣",
        Icirc: "Î",
        icirc: "î",
        Icy: "И",
        icy: "и",
        Idot: "İ",
        IEcy: "Е",
        iecy: "е",
        iexcl: "¡",
        iff: "⇔",
        Ifr: "ℑ",
        ifr: "𝔦",
        Igrave: "Ì",
        igrave: "ì",
        ii: "ⅈ",
        iiiint: "⨌",
        iiint: "∭",
        iinfin: "⧜",
        iiota: "℩",
        IJlig: "Ĳ",
        ijlig: "ĳ",
        Im: "ℑ",
        Imacr: "Ī",
        imacr: "ī",
        image: "ℑ",
        ImaginaryI: "ⅈ",
        imagline: "ℐ",
        imagpart: "ℑ",
        imath: "ı",
        imof: "⊷",
        imped: "Ƶ",
        Implies: "⇒",
        in: "∈",
        incare: "℅",
        infin: "∞",
        infintie: "⧝",
        inodot: "ı",
        Int: "∬",
        int: "∫",
        intcal: "⊺",
        integers: "ℤ",
        Integral: "∫",
        intercal: "⊺",
        Intersection: "⋂",
        intlarhk: "⨗",
        intprod: "⨼",
        InvisibleComma: "⁣",
        InvisibleTimes: "⁢",
        IOcy: "Ё",
        iocy: "ё",
        Iogon: "Į",
        iogon: "į",
        Iopf: "𝕀",
        iopf: "𝕚",
        Iota: "Ι",
        iota: "ι",
        iprod: "⨼",
        iquest: "¿",
        Iscr: "ℐ",
        iscr: "𝒾",
        isin: "∈",
        isindot: "⋵",
        isinE: "⋹",
        isins: "⋴",
        isinsv: "⋳",
        isinv: "∈",
        it: "⁢",
        Itilde: "Ĩ",
        itilde: "ĩ",
        Iukcy: "І",
        iukcy: "і",
        Iuml: "Ï",
        iuml: "ï",
        Jcirc: "Ĵ",
        jcirc: "ĵ",
        Jcy: "Й",
        jcy: "й",
        Jfr: "𝔍",
        jfr: "𝔧",
        jmath: "ȷ",
        Jopf: "𝕁",
        jopf: "𝕛",
        Jscr: "𝒥",
        jscr: "𝒿",
        Jsercy: "Ј",
        jsercy: "ј",
        Jukcy: "Є",
        jukcy: "є",
        Kappa: "Κ",
        kappa: "κ",
        kappav: "ϰ",
        Kcedil: "Ķ",
        kcedil: "ķ",
        Kcy: "К",
        kcy: "к",
        Kfr: "𝔎",
        kfr: "𝔨",
        kgreen: "ĸ",
        KHcy: "Х",
        khcy: "х",
        KJcy: "Ќ",
        kjcy: "ќ",
        Kopf: "𝕂",
        kopf: "𝕜",
        Kscr: "𝒦",
        kscr: "𝓀",
        lAarr: "⇚",
        Lacute: "Ĺ",
        lacute: "ĺ",
        laemptyv: "⦴",
        lagran: "ℒ",
        Lambda: "Λ",
        lambda: "λ",
        Lang: "⟪",
        lang: "⟨",
        langd: "⦑",
        langle: "⟨",
        lap: "⪅",
        Laplacetrf: "ℒ",
        laquo: "«",
        Larr: "↞",
        lArr: "⇐",
        larr: "←",
        larrb: "⇤",
        larrbfs: "⤟",
        larrfs: "⤝",
        larrhk: "↩",
        larrlp: "↫",
        larrpl: "⤹",
        larrsim: "⥳",
        larrtl: "↢",
        lat: "⪫",
        lAtail: "⤛",
        latail: "⤙",
        late: "⪭",
        lates: "⪭︀",
        lBarr: "⤎",
        lbarr: "⤌",
        lbbrk: "❲",
        lbrace: "{",
        lbrack: "[",
        lbrke: "⦋",
        lbrksld: "⦏",
        lbrkslu: "⦍",
        Lcaron: "Ľ",
        lcaron: "ľ",
        Lcedil: "Ļ",
        lcedil: "ļ",
        lceil: "⌈",
        lcub: "{",
        Lcy: "Л",
        lcy: "л",
        ldca: "⤶",
        ldquo: "“",
        ldquor: "„",
        ldrdhar: "⥧",
        ldrushar: "⥋",
        ldsh: "↲",
        lE: "≦",
        le: "≤",
        LeftAngleBracket: "⟨",
        LeftArrow: "←",
        Leftarrow: "⇐",
        leftarrow: "←",
        LeftArrowBar: "⇤",
        LeftArrowRightArrow: "⇆",
        leftarrowtail: "↢",
        LeftCeiling: "⌈",
        LeftDoubleBracket: "⟦",
        LeftDownTeeVector: "⥡",
        LeftDownVector: "⇃",
        LeftDownVectorBar: "⥙",
        LeftFloor: "⌊",
        leftharpoondown: "↽",
        leftharpoonup: "↼",
        leftleftarrows: "⇇",
        LeftRightArrow: "↔",
        Leftrightarrow: "⇔",
        leftrightarrow: "↔",
        leftrightarrows: "⇆",
        leftrightharpoons: "⇋",
        leftrightsquigarrow: "↭",
        LeftRightVector: "⥎",
        LeftTee: "⊣",
        LeftTeeArrow: "↤",
        LeftTeeVector: "⥚",
        leftthreetimes: "⋋",
        LeftTriangle: "⊲",
        LeftTriangleBar: "⧏",
        LeftTriangleEqual: "⊴",
        LeftUpDownVector: "⥑",
        LeftUpTeeVector: "⥠",
        LeftUpVector: "↿",
        LeftUpVectorBar: "⥘",
        LeftVector: "↼",
        LeftVectorBar: "⥒",
        lEg: "⪋",
        leg: "⋚",
        leq: "≤",
        leqq: "≦",
        leqslant: "⩽",
        les: "⩽",
        lescc: "⪨",
        lesdot: "⩿",
        lesdoto: "⪁",
        lesdotor: "⪃",
        lesg: "⋚︀",
        lesges: "⪓",
        lessapprox: "⪅",
        lessdot: "⋖",
        lesseqgtr: "⋚",
        lesseqqgtr: "⪋",
        LessEqualGreater: "⋚",
        LessFullEqual: "≦",
        LessGreater: "≶",
        lessgtr: "≶",
        LessLess: "⪡",
        lesssim: "≲",
        LessSlantEqual: "⩽",
        LessTilde: "≲",
        lfisht: "⥼",
        lfloor: "⌊",
        Lfr: "𝔏",
        lfr: "𝔩",
        lg: "≶",
        lgE: "⪑",
        lHar: "⥢",
        lhard: "↽",
        lharu: "↼",
        lharul: "⥪",
        lhblk: "▄",
        LJcy: "Љ",
        ljcy: "љ",
        Ll: "⋘",
        ll: "≪",
        llarr: "⇇",
        llcorner: "⌞",
        Lleftarrow: "⇚",
        llhard: "⥫",
        lltri: "◺",
        Lmidot: "Ŀ",
        lmidot: "ŀ",
        lmoust: "⎰",
        lmoustache: "⎰",
        lnap: "⪉",
        lnapprox: "⪉",
        lnE: "≨",
        lne: "⪇",
        lneq: "⪇",
        lneqq: "≨",
        lnsim: "⋦",
        loang: "⟬",
        loarr: "⇽",
        lobrk: "⟦",
        LongLeftArrow: "⟵",
        Longleftarrow: "⟸",
        longleftarrow: "⟵",
        LongLeftRightArrow: "⟷",
        Longleftrightarrow: "⟺",
        longleftrightarrow: "⟷",
        longmapsto: "⟼",
        LongRightArrow: "⟶",
        Longrightarrow: "⟹",
        longrightarrow: "⟶",
        looparrowleft: "↫",
        looparrowright: "↬",
        lopar: "⦅",
        Lopf: "𝕃",
        lopf: "𝕝",
        loplus: "⨭",
        lotimes: "⨴",
        lowast: "∗",
        lowbar: "_",
        LowerLeftArrow: "↙",
        LowerRightArrow: "↘",
        loz: "◊",
        lozenge: "◊",
        lozf: "⧫",
        lpar: "(",
        lparlt: "⦓",
        lrarr: "⇆",
        lrcorner: "⌟",
        lrhar: "⇋",
        lrhard: "⥭",
        lrm: "‎",
        lrtri: "⊿",
        lsaquo: "‹",
        Lscr: "ℒ",
        lscr: "𝓁",
        Lsh: "↰",
        lsh: "↰",
        lsim: "≲",
        lsime: "⪍",
        lsimg: "⪏",
        lsqb: "[",
        lsquo: "‘",
        lsquor: "‚",
        Lstrok: "Ł",
        lstrok: "ł",
        LT: "<",
        Lt: "≪",
        lt: "<",
        ltcc: "⪦",
        ltcir: "⩹",
        ltdot: "⋖",
        lthree: "⋋",
        ltimes: "⋉",
        ltlarr: "⥶",
        ltquest: "⩻",
        ltri: "◃",
        ltrie: "⊴",
        ltrif: "◂",
        ltrPar: "⦖",
        lurdshar: "⥊",
        luruhar: "⥦",
        lvertneqq: "≨︀",
        lvnE: "≨︀",
        macr: "¯",
        male: "♂",
        malt: "✠",
        maltese: "✠",
        Map: "⤅",
        map: "↦",
        mapsto: "↦",
        mapstodown: "↧",
        mapstoleft: "↤",
        mapstoup: "↥",
        marker: "▮",
        mcomma: "⨩",
        Mcy: "М",
        mcy: "м",
        mdash: "—",
        mDDot: "∺",
        measuredangle: "∡",
        MediumSpace: " ",
        Mellintrf: "ℳ",
        Mfr: "𝔐",
        mfr: "𝔪",
        mho: "℧",
        micro: "µ",
        mid: "∣",
        midast: "*",
        midcir: "⫰",
        middot: "·",
        minus: "−",
        minusb: "⊟",
        minusd: "∸",
        minusdu: "⨪",
        MinusPlus: "∓",
        mlcp: "⫛",
        mldr: "…",
        mnplus: "∓",
        models: "⊧",
        Mopf: "𝕄",
        mopf: "𝕞",
        mp: "∓",
        Mscr: "ℳ",
        mscr: "𝓂",
        mstpos: "∾",
        Mu: "Μ",
        mu: "μ",
        multimap: "⊸",
        mumap: "⊸",
        nabla: "∇",
        Nacute: "Ń",
        nacute: "ń",
        nang: "∠⃒",
        nap: "≉",
        napE: "⩰̸",
        napid: "≋̸",
        napos: "ŉ",
        napprox: "≉",
        natur: "♮",
        natural: "♮",
        naturals: "ℕ",
        nbsp: " ",
        nbump: "≎̸",
        nbumpe: "≏̸",
        ncap: "⩃",
        Ncaron: "Ň",
        ncaron: "ň",
        Ncedil: "Ņ",
        ncedil: "ņ",
        ncong: "≇",
        ncongdot: "⩭̸",
        ncup: "⩂",
        Ncy: "Н",
        ncy: "н",
        ndash: "–",
        ne: "≠",
        nearhk: "⤤",
        neArr: "⇗",
        nearr: "↗",
        nearrow: "↗",
        nedot: "≐̸",
        NegativeMediumSpace: "​",
        NegativeThickSpace: "​",
        NegativeThinSpace: "​",
        NegativeVeryThinSpace: "​",
        nequiv: "≢",
        nesear: "⤨",
        nesim: "≂̸",
        NestedGreaterGreater: "≫",
        NestedLessLess: "≪",
        NewLine: "\n",
        nexist: "∄",
        nexists: "∄",
        Nfr: "𝔑",
        nfr: "𝔫",
        ngE: "≧̸",
        nge: "≱",
        ngeq: "≱",
        ngeqq: "≧̸",
        ngeqslant: "⩾̸",
        nges: "⩾̸",
        nGg: "⋙̸",
        ngsim: "≵",
        nGt: "≫⃒",
        ngt: "≯",
        ngtr: "≯",
        nGtv: "≫̸",
        nhArr: "⇎",
        nharr: "↮",
        nhpar: "⫲",
        ni: "∋",
        nis: "⋼",
        nisd: "⋺",
        niv: "∋",
        NJcy: "Њ",
        njcy: "њ",
        nlArr: "⇍",
        nlarr: "↚",
        nldr: "‥",
        nlE: "≦̸",
        nle: "≰",
        nLeftarrow: "⇍",
        nleftarrow: "↚",
        nLeftrightarrow: "⇎",
        nleftrightarrow: "↮",
        nleq: "≰",
        nleqq: "≦̸",
        nleqslant: "⩽̸",
        nles: "⩽̸",
        nless: "≮",
        nLl: "⋘̸",
        nlsim: "≴",
        nLt: "≪⃒",
        nlt: "≮",
        nltri: "⋪",
        nltrie: "⋬",
        nLtv: "≪̸",
        nmid: "∤",
        NoBreak: "⁠",
        NonBreakingSpace: " ",
        Nopf: "ℕ",
        nopf: "𝕟",
        Not: "⫬",
        not: "¬",
        NotCongruent: "≢",
        NotCupCap: "≭",
        NotDoubleVerticalBar: "∦",
        NotElement: "∉",
        NotEqual: "≠",
        NotEqualTilde: "≂̸",
        NotExists: "∄",
        NotGreater: "≯",
        NotGreaterEqual: "≱",
        NotGreaterFullEqual: "≧̸",
        NotGreaterGreater: "≫̸",
        NotGreaterLess: "≹",
        NotGreaterSlantEqual: "⩾̸",
        NotGreaterTilde: "≵",
        NotHumpDownHump: "≎̸",
        NotHumpEqual: "≏̸",
        notin: "∉",
        notindot: "⋵̸",
        notinE: "⋹̸",
        notinva: "∉",
        notinvb: "⋷",
        notinvc: "⋶",
        NotLeftTriangle: "⋪",
        NotLeftTriangleBar: "⧏̸",
        NotLeftTriangleEqual: "⋬",
        NotLess: "≮",
        NotLessEqual: "≰",
        NotLessGreater: "≸",
        NotLessLess: "≪̸",
        NotLessSlantEqual: "⩽̸",
        NotLessTilde: "≴",
        NotNestedGreaterGreater: "⪢̸",
        NotNestedLessLess: "⪡̸",
        notni: "∌",
        notniva: "∌",
        notnivb: "⋾",
        notnivc: "⋽",
        NotPrecedes: "⊀",
        NotPrecedesEqual: "⪯̸",
        NotPrecedesSlantEqual: "⋠",
        NotReverseElement: "∌",
        NotRightTriangle: "⋫",
        NotRightTriangleBar: "⧐̸",
        NotRightTriangleEqual: "⋭",
        NotSquareSubset: "⊏̸",
        NotSquareSubsetEqual: "⋢",
        NotSquareSuperset: "⊐̸",
        NotSquareSupersetEqual: "⋣",
        NotSubset: "⊂⃒",
        NotSubsetEqual: "⊈",
        NotSucceeds: "⊁",
        NotSucceedsEqual: "⪰̸",
        NotSucceedsSlantEqual: "⋡",
        NotSucceedsTilde: "≿̸",
        NotSuperset: "⊃⃒",
        NotSupersetEqual: "⊉",
        NotTilde: "≁",
        NotTildeEqual: "≄",
        NotTildeFullEqual: "≇",
        NotTildeTilde: "≉",
        NotVerticalBar: "∤",
        npar: "∦",
        nparallel: "∦",
        nparsl: "⫽⃥",
        npart: "∂̸",
        npolint: "⨔",
        npr: "⊀",
        nprcue: "⋠",
        npre: "⪯̸",
        nprec: "⊀",
        npreceq: "⪯̸",
        nrArr: "⇏",
        nrarr: "↛",
        nrarrc: "⤳̸",
        nrarrw: "↝̸",
        nRightarrow: "⇏",
        nrightarrow: "↛",
        nrtri: "⋫",
        nrtrie: "⋭",
        nsc: "⊁",
        nsccue: "⋡",
        nsce: "⪰̸",
        Nscr: "𝒩",
        nscr: "𝓃",
        nshortmid: "∤",
        nshortparallel: "∦",
        nsim: "≁",
        nsime: "≄",
        nsimeq: "≄",
        nsmid: "∤",
        nspar: "∦",
        nsqsube: "⋢",
        nsqsupe: "⋣",
        nsub: "⊄",
        nsubE: "⫅̸",
        nsube: "⊈",
        nsubset: "⊂⃒",
        nsubseteq: "⊈",
        nsubseteqq: "⫅̸",
        nsucc: "⊁",
        nsucceq: "⪰̸",
        nsup: "⊅",
        nsupE: "⫆̸",
        nsupe: "⊉",
        nsupset: "⊃⃒",
        nsupseteq: "⊉",
        nsupseteqq: "⫆̸",
        ntgl: "≹",
        Ntilde: "Ñ",
        ntilde: "ñ",
        ntlg: "≸",
        ntriangleleft: "⋪",
        ntrianglelefteq: "⋬",
        ntriangleright: "⋫",
        ntrianglerighteq: "⋭",
        Nu: "Ν",
        nu: "ν",
        num: "#",
        numero: "№",
        numsp: " ",
        nvap: "≍⃒",
        nVDash: "⊯",
        nVdash: "⊮",
        nvDash: "⊭",
        nvdash: "⊬",
        nvge: "≥⃒",
        nvgt: ">⃒",
        nvHarr: "⤄",
        nvinfin: "⧞",
        nvlArr: "⤂",
        nvle: "≤⃒",
        nvlt: "<⃒",
        nvltrie: "⊴⃒",
        nvrArr: "⤃",
        nvrtrie: "⊵⃒",
        nvsim: "∼⃒",
        nwarhk: "⤣",
        nwArr: "⇖",
        nwarr: "↖",
        nwarrow: "↖",
        nwnear: "⤧",
        Oacute: "Ó",
        oacute: "ó",
        oast: "⊛",
        ocir: "⊚",
        Ocirc: "Ô",
        ocirc: "ô",
        Ocy: "О",
        ocy: "о",
        odash: "⊝",
        Odblac: "Ő",
        odblac: "ő",
        odiv: "⨸",
        odot: "⊙",
        odsold: "⦼",
        OElig: "Œ",
        oelig: "œ",
        ofcir: "⦿",
        Ofr: "𝔒",
        ofr: "𝔬",
        ogon: "˛",
        Ograve: "Ò",
        ograve: "ò",
        ogt: "⧁",
        ohbar: "⦵",
        ohm: "Ω",
        oint: "∮",
        olarr: "↺",
        olcir: "⦾",
        olcross: "⦻",
        oline: "‾",
        olt: "⧀",
        Omacr: "Ō",
        omacr: "ō",
        Omega: "Ω",
        omega: "ω",
        Omicron: "Ο",
        omicron: "ο",
        omid: "⦶",
        ominus: "⊖",
        Oopf: "𝕆",
        oopf: "𝕠",
        opar: "⦷",
        OpenCurlyDoubleQuote: "“",
        OpenCurlyQuote: "‘",
        operp: "⦹",
        oplus: "⊕",
        Or: "⩔",
        or: "∨",
        orarr: "↻",
        ord: "⩝",
        order: "ℴ",
        orderof: "ℴ",
        ordf: "ª",
        ordm: "º",
        origof: "⊶",
        oror: "⩖",
        orslope: "⩗",
        orv: "⩛",
        oS: "Ⓢ",
        Oscr: "𝒪",
        oscr: "ℴ",
        Oslash: "Ø",
        oslash: "ø",
        osol: "⊘",
        Otilde: "Õ",
        otilde: "õ",
        Otimes: "⨷",
        otimes: "⊗",
        otimesas: "⨶",
        Ouml: "Ö",
        ouml: "ö",
        ovbar: "⌽",
        OverBar: "‾",
        OverBrace: "⏞",
        OverBracket: "⎴",
        OverParenthesis: "⏜",
        par: "∥",
        para: "¶",
        parallel: "∥",
        parsim: "⫳",
        parsl: "⫽",
        part: "∂",
        PartialD: "∂",
        Pcy: "П",
        pcy: "п",
        percnt: "%",
        period: ".",
        permil: "‰",
        perp: "⊥",
        pertenk: "‱",
        Pfr: "𝔓",
        pfr: "𝔭",
        Phi: "Φ",
        phi: "φ",
        phiv: "ϕ",
        phmmat: "ℳ",
        phone: "☎",
        Pi: "Π",
        pi: "π",
        pitchfork: "⋔",
        piv: "ϖ",
        planck: "ℏ",
        planckh: "ℎ",
        plankv: "ℏ",
        plus: "+",
        plusacir: "⨣",
        plusb: "⊞",
        pluscir: "⨢",
        plusdo: "∔",
        plusdu: "⨥",
        pluse: "⩲",
        PlusMinus: "±",
        plusmn: "±",
        plussim: "⨦",
        plustwo: "⨧",
        pm: "±",
        Poincareplane: "ℌ",
        pointint: "⨕",
        Popf: "ℙ",
        popf: "𝕡",
        pound: "£",
        Pr: "⪻",
        pr: "≺",
        prap: "⪷",
        prcue: "≼",
        prE: "⪳",
        pre: "⪯",
        prec: "≺",
        precapprox: "⪷",
        preccurlyeq: "≼",
        Precedes: "≺",
        PrecedesEqual: "⪯",
        PrecedesSlantEqual: "≼",
        PrecedesTilde: "≾",
        preceq: "⪯",
        precnapprox: "⪹",
        precneqq: "⪵",
        precnsim: "⋨",
        precsim: "≾",
        Prime: "″",
        prime: "′",
        primes: "ℙ",
        prnap: "⪹",
        prnE: "⪵",
        prnsim: "⋨",
        prod: "∏",
        Product: "∏",
        profalar: "⌮",
        profline: "⌒",
        profsurf: "⌓",
        prop: "∝",
        Proportion: "∷",
        Proportional: "∝",
        propto: "∝",
        prsim: "≾",
        prurel: "⊰",
        Pscr: "𝒫",
        pscr: "𝓅",
        Psi: "Ψ",
        psi: "ψ",
        puncsp: " ",
        Qfr: "𝔔",
        qfr: "𝔮",
        qint: "⨌",
        Qopf: "ℚ",
        qopf: "𝕢",
        qprime: "⁗",
        Qscr: "𝒬",
        qscr: "𝓆",
        quaternions: "ℍ",
        quatint: "⨖",
        quest: "?",
        questeq: "≟",
        QUOT: '"',
        quot: '"',
        rAarr: "⇛",
        race: "∽̱",
        Racute: "Ŕ",
        racute: "ŕ",
        radic: "√",
        raemptyv: "⦳",
        Rang: "⟫",
        rang: "⟩",
        rangd: "⦒",
        range: "⦥",
        rangle: "⟩",
        raquo: "»",
        Rarr: "↠",
        rArr: "⇒",
        rarr: "→",
        rarrap: "⥵",
        rarrb: "⇥",
        rarrbfs: "⤠",
        rarrc: "⤳",
        rarrfs: "⤞",
        rarrhk: "↪",
        rarrlp: "↬",
        rarrpl: "⥅",
        rarrsim: "⥴",
        Rarrtl: "⤖",
        rarrtl: "↣",
        rarrw: "↝",
        rAtail: "⤜",
        ratail: "⤚",
        ratio: "∶",
        rationals: "ℚ",
        RBarr: "⤐",
        rBarr: "⤏",
        rbarr: "⤍",
        rbbrk: "❳",
        rbrace: "}",
        rbrack: "]",
        rbrke: "⦌",
        rbrksld: "⦎",
        rbrkslu: "⦐",
        Rcaron: "Ř",
        rcaron: "ř",
        Rcedil: "Ŗ",
        rcedil: "ŗ",
        rceil: "⌉",
        rcub: "}",
        Rcy: "Р",
        rcy: "р",
        rdca: "⤷",
        rdldhar: "⥩",
        rdquo: "”",
        rdquor: "”",
        rdsh: "↳",
        Re: "ℜ",
        real: "ℜ",
        realine: "ℛ",
        realpart: "ℜ",
        reals: "ℝ",
        rect: "▭",
        REG: "®",
        reg: "®",
        ReverseElement: "∋",
        ReverseEquilibrium: "⇋",
        ReverseUpEquilibrium: "⥯",
        rfisht: "⥽",
        rfloor: "⌋",
        Rfr: "ℜ",
        rfr: "𝔯",
        rHar: "⥤",
        rhard: "⇁",
        rharu: "⇀",
        rharul: "⥬",
        Rho: "Ρ",
        rho: "ρ",
        rhov: "ϱ",
        RightAngleBracket: "⟩",
        RightArrow: "→",
        Rightarrow: "⇒",
        rightarrow: "→",
        RightArrowBar: "⇥",
        RightArrowLeftArrow: "⇄",
        rightarrowtail: "↣",
        RightCeiling: "⌉",
        RightDoubleBracket: "⟧",
        RightDownTeeVector: "⥝",
        RightDownVector: "⇂",
        RightDownVectorBar: "⥕",
        RightFloor: "⌋",
        rightharpoondown: "⇁",
        rightharpoonup: "⇀",
        rightleftarrows: "⇄",
        rightleftharpoons: "⇌",
        rightrightarrows: "⇉",
        rightsquigarrow: "↝",
        RightTee: "⊢",
        RightTeeArrow: "↦",
        RightTeeVector: "⥛",
        rightthreetimes: "⋌",
        RightTriangle: "⊳",
        RightTriangleBar: "⧐",
        RightTriangleEqual: "⊵",
        RightUpDownVector: "⥏",
        RightUpTeeVector: "⥜",
        RightUpVector: "↾",
        RightUpVectorBar: "⥔",
        RightVector: "⇀",
        RightVectorBar: "⥓",
        ring: "˚",
        risingdotseq: "≓",
        rlarr: "⇄",
        rlhar: "⇌",
        rlm: "‏",
        rmoust: "⎱",
        rmoustache: "⎱",
        rnmid: "⫮",
        roang: "⟭",
        roarr: "⇾",
        robrk: "⟧",
        ropar: "⦆",
        Ropf: "ℝ",
        ropf: "𝕣",
        roplus: "⨮",
        rotimes: "⨵",
        RoundImplies: "⥰",
        rpar: ")",
        rpargt: "⦔",
        rppolint: "⨒",
        rrarr: "⇉",
        Rrightarrow: "⇛",
        rsaquo: "›",
        Rscr: "ℛ",
        rscr: "𝓇",
        Rsh: "↱",
        rsh: "↱",
        rsqb: "]",
        rsquo: "’",
        rsquor: "’",
        rthree: "⋌",
        rtimes: "⋊",
        rtri: "▹",
        rtrie: "⊵",
        rtrif: "▸",
        rtriltri: "⧎",
        RuleDelayed: "⧴",
        ruluhar: "⥨",
        rx: "℞",
        Sacute: "Ś",
        sacute: "ś",
        sbquo: "‚",
        Sc: "⪼",
        sc: "≻",
        scap: "⪸",
        Scaron: "Š",
        scaron: "š",
        sccue: "≽",
        scE: "⪴",
        sce: "⪰",
        Scedil: "Ş",
        scedil: "ş",
        Scirc: "Ŝ",
        scirc: "ŝ",
        scnap: "⪺",
        scnE: "⪶",
        scnsim: "⋩",
        scpolint: "⨓",
        scsim: "≿",
        Scy: "С",
        scy: "с",
        sdot: "⋅",
        sdotb: "⊡",
        sdote: "⩦",
        searhk: "⤥",
        seArr: "⇘",
        searr: "↘",
        searrow: "↘",
        sect: "§",
        semi: ";",
        seswar: "⤩",
        setminus: "∖",
        setmn: "∖",
        sext: "✶",
        Sfr: "𝔖",
        sfr: "𝔰",
        sfrown: "⌢",
        sharp: "♯",
        SHCHcy: "Щ",
        shchcy: "щ",
        SHcy: "Ш",
        shcy: "ш",
        ShortDownArrow: "↓",
        ShortLeftArrow: "←",
        shortmid: "∣",
        shortparallel: "∥",
        ShortRightArrow: "→",
        ShortUpArrow: "↑",
        shy: "­",
        Sigma: "Σ",
        sigma: "σ",
        sigmaf: "ς",
        sigmav: "ς",
        sim: "∼",
        simdot: "⩪",
        sime: "≃",
        simeq: "≃",
        simg: "⪞",
        simgE: "⪠",
        siml: "⪝",
        simlE: "⪟",
        simne: "≆",
        simplus: "⨤",
        simrarr: "⥲",
        slarr: "←",
        SmallCircle: "∘",
        smallsetminus: "∖",
        smashp: "⨳",
        smeparsl: "⧤",
        smid: "∣",
        smile: "⌣",
        smt: "⪪",
        smte: "⪬",
        smtes: "⪬︀",
        SOFTcy: "Ь",
        softcy: "ь",
        sol: "/",
        solb: "⧄",
        solbar: "⌿",
        Sopf: "𝕊",
        sopf: "𝕤",
        spades: "♠",
        spadesuit: "♠",
        spar: "∥",
        sqcap: "⊓",
        sqcaps: "⊓︀",
        sqcup: "⊔",
        sqcups: "⊔︀",
        Sqrt: "√",
        sqsub: "⊏",
        sqsube: "⊑",
        sqsubset: "⊏",
        sqsubseteq: "⊑",
        sqsup: "⊐",
        sqsupe: "⊒",
        sqsupset: "⊐",
        sqsupseteq: "⊒",
        squ: "□",
        Square: "□",
        square: "□",
        SquareIntersection: "⊓",
        SquareSubset: "⊏",
        SquareSubsetEqual: "⊑",
        SquareSuperset: "⊐",
        SquareSupersetEqual: "⊒",
        SquareUnion: "⊔",
        squarf: "▪",
        squf: "▪",
        srarr: "→",
        Sscr: "𝒮",
        sscr: "𝓈",
        ssetmn: "∖",
        ssmile: "⌣",
        sstarf: "⋆",
        Star: "⋆",
        star: "☆",
        starf: "★",
        straightepsilon: "ϵ",
        straightphi: "ϕ",
        strns: "¯",
        Sub: "⋐",
        sub: "⊂",
        subdot: "⪽",
        subE: "⫅",
        sube: "⊆",
        subedot: "⫃",
        submult: "⫁",
        subnE: "⫋",
        subne: "⊊",
        subplus: "⪿",
        subrarr: "⥹",
        Subset: "⋐",
        subset: "⊂",
        subseteq: "⊆",
        subseteqq: "⫅",
        SubsetEqual: "⊆",
        subsetneq: "⊊",
        subsetneqq: "⫋",
        subsim: "⫇",
        subsub: "⫕",
        subsup: "⫓",
        succ: "≻",
        succapprox: "⪸",
        succcurlyeq: "≽",
        Succeeds: "≻",
        SucceedsEqual: "⪰",
        SucceedsSlantEqual: "≽",
        SucceedsTilde: "≿",
        succeq: "⪰",
        succnapprox: "⪺",
        succneqq: "⪶",
        succnsim: "⋩",
        succsim: "≿",
        SuchThat: "∋",
        Sum: "∑",
        sum: "∑",
        sung: "♪",
        Sup: "⋑",
        sup: "⊃",
        sup1: "¹",
        sup2: "²",
        sup3: "³",
        supdot: "⪾",
        supdsub: "⫘",
        supE: "⫆",
        supe: "⊇",
        supedot: "⫄",
        Superset: "⊃",
        SupersetEqual: "⊇",
        suphsol: "⟉",
        suphsub: "⫗",
        suplarr: "⥻",
        supmult: "⫂",
        supnE: "⫌",
        supne: "⊋",
        supplus: "⫀",
        Supset: "⋑",
        supset: "⊃",
        supseteq: "⊇",
        supseteqq: "⫆",
        supsetneq: "⊋",
        supsetneqq: "⫌",
        supsim: "⫈",
        supsub: "⫔",
        supsup: "⫖",
        swarhk: "⤦",
        swArr: "⇙",
        swarr: "↙",
        swarrow: "↙",
        swnwar: "⤪",
        szlig: "ß",
        Tab: "\t",
        target: "⌖",
        Tau: "Τ",
        tau: "τ",
        tbrk: "⎴",
        Tcaron: "Ť",
        tcaron: "ť",
        Tcedil: "Ţ",
        tcedil: "ţ",
        Tcy: "Т",
        tcy: "т",
        tdot: "⃛",
        telrec: "⌕",
        Tfr: "𝔗",
        tfr: "𝔱",
        there4: "∴",
        Therefore: "∴",
        therefore: "∴",
        Theta: "Θ",
        theta: "θ",
        thetasym: "ϑ",
        thetav: "ϑ",
        thickapprox: "≈",
        thicksim: "∼",
        ThickSpace: "  ",
        thinsp: " ",
        ThinSpace: " ",
        thkap: "≈",
        thksim: "∼",
        THORN: "Þ",
        thorn: "þ",
        Tilde: "∼",
        tilde: "˜",
        TildeEqual: "≃",
        TildeFullEqual: "≅",
        TildeTilde: "≈",
        times: "×",
        timesb: "⊠",
        timesbar: "⨱",
        timesd: "⨰",
        tint: "∭",
        toea: "⤨",
        top: "⊤",
        topbot: "⌶",
        topcir: "⫱",
        Topf: "𝕋",
        topf: "𝕥",
        topfork: "⫚",
        tosa: "⤩",
        tprime: "‴",
        TRADE: "™",
        trade: "™",
        triangle: "▵",
        triangledown: "▿",
        triangleleft: "◃",
        trianglelefteq: "⊴",
        triangleq: "≜",
        triangleright: "▹",
        trianglerighteq: "⊵",
        tridot: "◬",
        trie: "≜",
        triminus: "⨺",
        TripleDot: "⃛",
        triplus: "⨹",
        trisb: "⧍",
        tritime: "⨻",
        trpezium: "⏢",
        Tscr: "𝒯",
        tscr: "𝓉",
        TScy: "Ц",
        tscy: "ц",
        TSHcy: "Ћ",
        tshcy: "ћ",
        Tstrok: "Ŧ",
        tstrok: "ŧ",
        twixt: "≬",
        twoheadleftarrow: "↞",
        twoheadrightarrow: "↠",
        Uacute: "Ú",
        uacute: "ú",
        Uarr: "↟",
        uArr: "⇑",
        uarr: "↑",
        Uarrocir: "⥉",
        Ubrcy: "Ў",
        ubrcy: "ў",
        Ubreve: "Ŭ",
        ubreve: "ŭ",
        Ucirc: "Û",
        ucirc: "û",
        Ucy: "У",
        ucy: "у",
        udarr: "⇅",
        Udblac: "Ű",
        udblac: "ű",
        udhar: "⥮",
        ufisht: "⥾",
        Ufr: "𝔘",
        ufr: "𝔲",
        Ugrave: "Ù",
        ugrave: "ù",
        uHar: "⥣",
        uharl: "↿",
        uharr: "↾",
        uhblk: "▀",
        ulcorn: "⌜",
        ulcorner: "⌜",
        ulcrop: "⌏",
        ultri: "◸",
        Umacr: "Ū",
        umacr: "ū",
        uml: "¨",
        UnderBar: "_",
        UnderBrace: "⏟",
        UnderBracket: "⎵",
        UnderParenthesis: "⏝",
        Union: "⋃",
        UnionPlus: "⊎",
        Uogon: "Ų",
        uogon: "ų",
        Uopf: "𝕌",
        uopf: "𝕦",
        UpArrow: "↑",
        Uparrow: "⇑",
        uparrow: "↑",
        UpArrowBar: "⤒",
        UpArrowDownArrow: "⇅",
        UpDownArrow: "↕",
        Updownarrow: "⇕",
        updownarrow: "↕",
        UpEquilibrium: "⥮",
        upharpoonleft: "↿",
        upharpoonright: "↾",
        uplus: "⊎",
        UpperLeftArrow: "↖",
        UpperRightArrow: "↗",
        Upsi: "ϒ",
        upsi: "υ",
        upsih: "ϒ",
        Upsilon: "Υ",
        upsilon: "υ",
        UpTee: "⊥",
        UpTeeArrow: "↥",
        upuparrows: "⇈",
        urcorn: "⌝",
        urcorner: "⌝",
        urcrop: "⌎",
        Uring: "Ů",
        uring: "ů",
        urtri: "◹",
        Uscr: "𝒰",
        uscr: "𝓊",
        utdot: "⋰",
        Utilde: "Ũ",
        utilde: "ũ",
        utri: "▵",
        utrif: "▴",
        uuarr: "⇈",
        Uuml: "Ü",
        uuml: "ü",
        uwangle: "⦧",
        vangrt: "⦜",
        varepsilon: "ϵ",
        varkappa: "ϰ",
        varnothing: "∅",
        varphi: "ϕ",
        varpi: "ϖ",
        varpropto: "∝",
        vArr: "⇕",
        varr: "↕",
        varrho: "ϱ",
        varsigma: "ς",
        varsubsetneq: "⊊︀",
        varsubsetneqq: "⫋︀",
        varsupsetneq: "⊋︀",
        varsupsetneqq: "⫌︀",
        vartheta: "ϑ",
        vartriangleleft: "⊲",
        vartriangleright: "⊳",
        Vbar: "⫫",
        vBar: "⫨",
        vBarv: "⫩",
        Vcy: "В",
        vcy: "в",
        VDash: "⊫",
        Vdash: "⊩",
        vDash: "⊨",
        vdash: "⊢",
        Vdashl: "⫦",
        Vee: "⋁",
        vee: "∨",
        veebar: "⊻",
        veeeq: "≚",
        vellip: "⋮",
        Verbar: "‖",
        verbar: "|",
        Vert: "‖",
        vert: "|",
        VerticalBar: "∣",
        VerticalLine: "|",
        VerticalSeparator: "❘",
        VerticalTilde: "≀",
        VeryThinSpace: " ",
        Vfr: "𝔙",
        vfr: "𝔳",
        vltri: "⊲",
        vnsub: "⊂⃒",
        vnsup: "⊃⃒",
        Vopf: "𝕍",
        vopf: "𝕧",
        vprop: "∝",
        vrtri: "⊳",
        Vscr: "𝒱",
        vscr: "𝓋",
        vsubnE: "⫋︀",
        vsubne: "⊊︀",
        vsupnE: "⫌︀",
        vsupne: "⊋︀",
        Vvdash: "⊪",
        vzigzag: "⦚",
        Wcirc: "Ŵ",
        wcirc: "ŵ",
        wedbar: "⩟",
        Wedge: "⋀",
        wedge: "∧",
        wedgeq: "≙",
        weierp: "℘",
        Wfr: "𝔚",
        wfr: "𝔴",
        Wopf: "𝕎",
        wopf: "𝕨",
        wp: "℘",
        wr: "≀",
        wreath: "≀",
        Wscr: "𝒲",
        wscr: "𝓌",
        xcap: "⋂",
        xcirc: "◯",
        xcup: "⋃",
        xdtri: "▽",
        Xfr: "𝔛",
        xfr: "𝔵",
        xhArr: "⟺",
        xharr: "⟷",
        Xi: "Ξ",
        xi: "ξ",
        xlArr: "⟸",
        xlarr: "⟵",
        xmap: "⟼",
        xnis: "⋻",
        xodot: "⨀",
        Xopf: "𝕏",
        xopf: "𝕩",
        xoplus: "⨁",
        xotime: "⨂",
        xrArr: "⟹",
        xrarr: "⟶",
        Xscr: "𝒳",
        xscr: "𝓍",
        xsqcup: "⨆",
        xuplus: "⨄",
        xutri: "△",
        xvee: "⋁",
        xwedge: "⋀",
        Yacute: "Ý",
        yacute: "ý",
        YAcy: "Я",
        yacy: "я",
        Ycirc: "Ŷ",
        ycirc: "ŷ",
        Ycy: "Ы",
        ycy: "ы",
        yen: "¥",
        Yfr: "𝔜",
        yfr: "𝔶",
        YIcy: "Ї",
        yicy: "ї",
        Yopf: "𝕐",
        yopf: "𝕪",
        Yscr: "𝒴",
        yscr: "𝓎",
        YUcy: "Ю",
        yucy: "ю",
        Yuml: "Ÿ",
        yuml: "ÿ",
        Zacute: "Ź",
        zacute: "ź",
        Zcaron: "Ž",
        zcaron: "ž",
        Zcy: "З",
        zcy: "з",
        Zdot: "Ż",
        zdot: "ż",
        zeetrf: "ℨ",
        ZeroWidthSpace: "​",
        Zeta: "Ζ",
        zeta: "ζ",
        Zfr: "ℨ",
        zfr: "𝔷",
        ZHcy: "Ж",
        zhcy: "ж",
        zigrarr: "⇝",
        Zopf: "ℤ",
        zopf: "𝕫",
        Zscr: "𝒵",
        zscr: "𝓏",
        zwj: "‍",
        zwnj: "‌"
    }
      , k = Object.prototype.hasOwnProperty;
    function y(e) {
        return r = e,
        (t = v) && k.call(t, r) ? v[e] : e;
        var t, r
    }
    var A = Object.prototype.hasOwnProperty;
    function w(e) {
        var t = [].slice.call(arguments, 1);
        return t.forEach((function(t) {
            if (t) {
                if ("object" != typeof t)
                    throw new TypeError(t + "must be object");
                Object.keys(t).forEach((function(r) {
                    e[r] = t[r]
                }
                ))
            }
        }
        )),
        e
    }
    var x = /\\([\\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;
    function _(e) {
        return e.indexOf("\\") < 0 ? e : e.replace(x, "$1")
    }
    function C(e) {
        return !(e >= 55296 && e <= 57343) && (!(e >= 64976 && e <= 65007) && (65535 != (65535 & e) && 65534 != (65535 & e) && (!(e >= 0 && e <= 8) && (11 !== e && (!(e >= 14 && e <= 31) && (!(e >= 127 && e <= 159) && !(e > 1114111)))))))
    }
    function q(e) {
        if (e > 65535) {
            var t = 55296 + ((e -= 65536) >> 10)
              , r = 56320 + (1023 & e);
            return String.fromCharCode(t, r)
        }
        return String.fromCharCode(e)
    }
    var S = /&([a-z#][a-z0-9]{1,31});/gi
      , E = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))/i;
    function M(e, t) {
        var r = 0
          , n = y(t);
        return t !== n ? n : 35 === t.charCodeAt(0) && E.test(t) && C(r = "x" === t[1].toLowerCase() ? parseInt(t.slice(2), 16) : parseInt(t.slice(1), 10)) ? q(r) : e
    }
    function L(e) {
        return e.indexOf("&") < 0 ? e : e.replace(S, M)
    }
    var T = /[&<>"]/
      , I = /[&<>"]/g
      , O = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
    };
    function N(e) {
        return O[e]
    }
    function j(e) {
        return T.test(e) ? e.replace(I, N) : e
    }
    var D = {};
    function R(e, t) {
        return ++t >= e.length - 2 ? t : "paragraph_open" === e[t].type && e[t].tight && "inline" === e[t + 1].type && 0 === e[t + 1].content.length && "paragraph_close" === e[t + 2].type && e[t + 2].tight ? R(e, t + 2) : t
    }
    D.blockquote_open = function() {
        return "<blockquote>\n"
    }
    ,
    D.blockquote_close = function(e, t) {
        return "</blockquote>" + U(e, t)
    }
    ,
    D.code = function(e, t) {
        return e[t].block ? "<pre><code>" + j(e[t].content) + "</code></pre>" + U(e, t) : "<code>" + j(e[t].content) + "</code>"
    }
    ,
    D.fence = function(e, t, r, n, i) {
        var o, s, a, l, c = e[t], p = "", u = r.langPrefix;
        if (c.params) {
            if (s = (o = c.params.split(/\s+/g)).join(" "),
            a = i.rules.fence_custom,
            l = o[0],
            a && A.call(a, l))
                return i.rules.fence_custom[o[0]](e, t, r, n, i);
            p = ' class="' + u + j(L(_(s))) + '"'
        }
        return "<pre><code" + p + ">" + (r.highlight && r.highlight.apply(r.highlight, [c.content].concat(o)) || j(c.content)) + "</code></pre>" + U(e, t)
    }
    ,
    D.fence_custom = {},
    D.heading_open = function(e, t) {
        return "<h" + e[t].hLevel + ">"
    }
    ,
    D.heading_close = function(e, t) {
        return "</h" + e[t].hLevel + ">\n"
    }
    ,
    D.hr = function(e, t, r) {
        return (r.xhtmlOut ? "<hr />" : "<hr>") + U(e, t)
    }
    ,
    D.bullet_list_open = function() {
        return "<ul>\n"
    }
    ,
    D.bullet_list_close = function(e, t) {
        return "</ul>" + U(e, t)
    }
    ,
    D.list_item_open = function() {
        return "<li>"
    }
    ,
    D.list_item_close = function() {
        return "</li>\n"
    }
    ,
    D.ordered_list_open = function(e, t) {
        var r = e[t];
        return "<ol" + (r.order > 1 ? ' start="' + r.order + '"' : "") + ">\n"
    }
    ,
    D.ordered_list_close = function(e, t) {
        return "</ol>" + U(e, t)
    }
    ,
    D.paragraph_open = function(e, t) {
        return e[t].tight ? "" : "<p>"
    }
    ,
    D.paragraph_close = function(e, t) {
        var r = !(e[t].tight && t && "inline" === e[t - 1].type && !e[t - 1].content);
        return (e[t].tight ? "" : "</p>") + (r ? U(e, t) : "")
    }
    ,
    D.link_open = function(e, t, r) {
        var n = e[t].title ? ' title="' + j(L(e[t].title)) + '"' : ""
          , i = r.linkTarget ? ' target="' + r.linkTarget + '"' : "";
        return '<a href="' + j(e[t].href) + '"' + n + i + ">"
    }
    ,
    D.link_close = function() {
        return "</a>"
    }
    ,
    D.image = function(e, t, r) {
        var n = ' src="' + j(e[t].src) + '"'
          , i = e[t].title ? ' title="' + j(L(e[t].title)) + '"' : "";
        return "<img" + n + (' alt="' + (e[t].alt ? j(L(_(e[t].alt))) : "") + '"') + i + (r.xhtmlOut ? " /" : "") + ">"
    }
    ,
    D.table_open = function() {
        return "<table>\n"
    }
    ,
    D.table_close = function() {
        return "</table>\n"
    }
    ,
    D.thead_open = function() {
        return "<thead>\n"
    }
    ,
    D.thead_close = function() {
        return "</thead>\n"
    }
    ,
    D.tbody_open = function() {
        return "<tbody>\n"
    }
    ,
    D.tbody_close = function() {
        return "</tbody>\n"
    }
    ,
    D.tr_open = function() {
        return "<tr>"
    }
    ,
    D.tr_close = function() {
        return "</tr>\n"
    }
    ,
    D.th_open = function(e, t) {
        var r = e[t];
        return "<th" + (r.align ? ' style="text-align:' + r.align + '"' : "") + ">"
    }
    ,
    D.th_close = function() {
        return "</th>"
    }
    ,
    D.td_open = function(e, t) {
        var r = e[t];
        return "<td" + (r.align ? ' style="text-align:' + r.align + '"' : "") + ">"
    }
    ,
    D.td_close = function() {
        return "</td>"
    }
    ,
    D.strong_open = function() {
        return "<strong>"
    }
    ,
    D.strong_close = function() {
        return "</strong>"
    }
    ,
    D.em_open = function() {
        return "<em>"
    }
    ,
    D.em_close = function() {
        return "</em>"
    }
    ,
    D.del_open = function() {
        return "<del>"
    }
    ,
    D.del_close = function() {
        return "</del>"
    }
    ,
    D.ins_open = function() {
        return "<ins>"
    }
    ,
    D.ins_close = function() {
        return "</ins>"
    }
    ,
    D.mark_open = function() {
        return "<mark>"
    }
    ,
    D.mark_close = function() {
        return "</mark>"
    }
    ,
    D.sub = function(e, t) {
        return "<sub>" + j(e[t].content) + "</sub>"
    }
    ,
    D.sup = function(e, t) {
        return "<sup>" + j(e[t].content) + "</sup>"
    }
    ,
    D.hardbreak = function(e, t, r) {
        return r.xhtmlOut ? "<br />\n" : "<br>\n"
    }
    ,
    D.softbreak = function(e, t, r) {
        return r.breaks ? r.xhtmlOut ? "<br />\n" : "<br>\n" : "\n"
    }
    ,
    D.text = function(e, t) {
        return j(e[t].content)
    }
    ,
    D.htmlblock = function(e, t) {
        return e[t].content
    }
    ,
    D.htmltag = function(e, t) {
        return e[t].content
    }
    ,
    D.abbr_open = function(e, t) {
        return '<abbr title="' + j(L(e[t].title)) + '">'
    }
    ,
    D.abbr_close = function() {
        return "</abbr>"
    }
    ,
    D.footnote_ref = function(e, t) {
        var r = Number(e[t].id + 1).toString()
          , n = "fnref" + r;
        return e[t].subId > 0 && (n += ":" + e[t].subId),
        '<sup class="footnote-ref"><a href="#fn' + r + '" id="' + n + '">[' + r + "]</a></sup>"
    }
    ,
    D.footnote_block_open = function(e, t, r) {
        return (r.xhtmlOut ? '<hr class="footnotes-sep" />\n' : '<hr class="footnotes-sep">\n') + '<section class="footnotes">\n<ol class="footnotes-list">\n'
    }
    ,
    D.footnote_block_close = function() {
        return "</ol>\n</section>\n"
    }
    ,
    D.footnote_open = function(e, t) {
        return '<li id="fn' + Number(e[t].id + 1).toString() + '"  class="footnote-item">'
    }
    ,
    D.footnote_close = function() {
        return "</li>\n"
    }
    ,
    D.footnote_anchor = function(e, t) {
        var r = "fnref" + Number(e[t].id + 1).toString();
        return e[t].subId > 0 && (r += ":" + e[t].subId),
        ' <a href="#' + r + '" class="footnote-backref">↩</a>'
    }
    ,
    D.dl_open = function() {
        return "<dl>\n"
    }
    ,
    D.dt_open = function() {
        return "<dt>"
    }
    ,
    D.dd_open = function() {
        return "<dd>"
    }
    ,
    D.dl_close = function() {
        return "</dl>\n"
    }
    ,
    D.dt_close = function() {
        return "</dt>\n"
    }
    ,
    D.dd_close = function() {
        return "</dd>\n"
    }
    ;
    var U = D.getBreak = function(e, t) {
        return (t = R(e, t)) < e.length && "list_item_close" === e[t].type ? "" : "\n"
    }
    ;
    function F() {
        this.rules = w({}, D),
        this.getBreak = D.getBreak
    }
    function z() {
        this.__rules__ = [],
        this.__cache__ = null
    }
    function P(e, t, r, n, i) {
        this.src = e,
        this.env = n,
        this.options = r,
        this.parser = t,
        this.tokens = i,
        this.pos = 0,
        this.posMax = this.src.length,
        this.level = 0,
        this.pending = "",
        this.pendingLevel = 0,
        this.cache = [],
        this.isInLabel = !1,
        this.linkLevel = 0,
        this.linkContent = "",
        this.labelUnmatchedScopes = 0
    }
    function B(e, t) {
        var r, n, i, o = -1, s = e.posMax, a = e.pos, l = e.isInLabel;
        if (e.isInLabel)
            return -1;
        if (e.labelUnmatchedScopes)
            return e.labelUnmatchedScopes--,
            -1;
        for (e.pos = t + 1,
        e.isInLabel = !0,
        r = 1; e.pos < s; ) {
            if (91 === (i = e.src.charCodeAt(e.pos)))
                r++;
            else if (93 === i && 0 === --r) {
                n = !0;
                break
            }
            e.parser.skipToken(e)
        }
        return n ? (o = e.pos,
        e.labelUnmatchedScopes = 0) : e.labelUnmatchedScopes = r - 1,
        e.pos = a,
        e.isInLabel = l,
        o
    }
    function V(e, t, r, n) {
        var i, o, s, a, l, c;
        if (42 !== e.charCodeAt(0))
            return -1;
        if (91 !== e.charCodeAt(1))
            return -1;
        if (-1 === e.indexOf("]:"))
            return -1;
        if ((o = B(i = new P(e,t,r,n,[]), 1)) < 0 || 58 !== e.charCodeAt(o + 1))
            return -1;
        for (a = i.posMax,
        s = o + 2; s < a && 10 !== i.src.charCodeAt(s); s++)
            ;
        return l = e.slice(2, o),
        0 === (c = e.slice(o + 2, s).trim()).length ? -1 : (n.abbreviations || (n.abbreviations = {}),
        void 0 === n.abbreviations[":" + l] && (n.abbreviations[":" + l] = c),
        s)
    }
    function $(e) {
        var t = L(e);
        try {
            t = decodeURI(t)
        } catch (e) {}
        return encodeURI(t)
    }
    function G(e, t) {
        var r, n, i, o = t, s = e.posMax;
        if (60 === e.src.charCodeAt(t)) {
            for (t++; t < s; ) {
                if (10 === (r = e.src.charCodeAt(t)))
                    return !1;
                if (62 === r)
                    return i = $(_(e.src.slice(o + 1, t))),
                    !!e.parser.validateLink(i) && (e.pos = t + 1,
                    e.linkContent = i,
                    !0);
                92 === r && t + 1 < s ? t += 2 : t++
            }
            return !1
        }
        for (n = 0; t < s && 32 !== (r = e.src.charCodeAt(t)) && !(r < 32 || 127 === r); )
            if (92 === r && t + 1 < s)
                t += 2;
            else {
                if (40 === r && ++n > 1)
                    break;
                if (41 === r && --n < 0)
                    break;
                t++
            }
        return o !== t && (i = _(e.src.slice(o, t)),
        !!e.parser.validateLink(i) && (e.linkContent = i,
        e.pos = t,
        !0))
    }
    function H(e, t) {
        var r, n = t, i = e.posMax, o = e.src.charCodeAt(t);
        if (34 !== o && 39 !== o && 40 !== o)
            return !1;
        for (t++,
        40 === o && (o = 41); t < i; ) {
            if ((r = e.src.charCodeAt(t)) === o)
                return e.pos = t + 1,
                e.linkContent = _(e.src.slice(n + 1, t)),
                !0;
            92 === r && t + 1 < i ? t += 2 : t++
        }
        return !1
    }
    function Z(e) {
        return e.trim().replace(/\s+/g, " ").toUpperCase()
    }
    function Y(e, t, r, n) {
        var i, o, s, a, l, c, p, u, f;
        if (91 !== e.charCodeAt(0))
            return -1;
        if (-1 === e.indexOf("]:"))
            return -1;
        if ((o = B(i = new P(e,t,r,n,[]), 0)) < 0 || 58 !== e.charCodeAt(o + 1))
            return -1;
        for (a = i.posMax,
        s = o + 2; s < a && (32 === (l = i.src.charCodeAt(s)) || 10 === l); s++)
            ;
        if (!G(i, s))
            return -1;
        for (p = i.linkContent,
        c = s = i.pos,
        s += 1; s < a && (32 === (l = i.src.charCodeAt(s)) || 10 === l); s++)
            ;
        for (s < a && c !== s && H(i, s) ? (u = i.linkContent,
        s = i.pos) : (u = "",
        s = c); s < a && 32 === i.src.charCodeAt(s); )
            s++;
        return s < a && 10 !== i.src.charCodeAt(s) ? -1 : (f = Z(e.slice(1, o)),
        void 0 === n.references[f] && (n.references[f] = {
            title: u,
            href: p
        }),
        s)
    }
    F.prototype.renderInline = function(e, t, r) {
        for (var n = this.rules, i = e.length, o = 0, s = ""; i--; )
            s += n[e[o].type](e, o++, t, r, this);
        return s
    }
    ,
    F.prototype.render = function(e, t, r) {
        for (var n = this.rules, i = e.length, o = -1, s = ""; ++o < i; )
            "inline" === e[o].type ? s += this.renderInline(e[o].children, t, r) : s += n[e[o].type](e, o, t, r, this);
        return s
    }
    ,
    z.prototype.__find__ = function(e) {
        for (var t = this.__rules__.length, r = -1; t--; )
            if (this.__rules__[++r].name === e)
                return r;
        return -1
    }
    ,
    z.prototype.__compile__ = function() {
        var e = this
          , t = [""];
        e.__rules__.forEach((function(e) {
            e.enabled && e.alt.forEach((function(e) {
                t.indexOf(e) < 0 && t.push(e)
            }
            ))
        }
        )),
        e.__cache__ = {},
        t.forEach((function(t) {
            e.__cache__[t] = [],
            e.__rules__.forEach((function(r) {
                r.enabled && (t && r.alt.indexOf(t) < 0 || e.__cache__[t].push(r.fn))
            }
            ))
        }
        ))
    }
    ,
    z.prototype.at = function(e, t, r) {
        var n = this.__find__(e)
          , i = r || {};
        if (-1 === n)
            throw new Error("Parser rule not found: " + e);
        this.__rules__[n].fn = t,
        this.__rules__[n].alt = i.alt || [],
        this.__cache__ = null
    }
    ,
    z.prototype.before = function(e, t, r, n) {
        var i = this.__find__(e)
          , o = n || {};
        if (-1 === i)
            throw new Error("Parser rule not found: " + e);
        this.__rules__.splice(i, 0, {
            name: t,
            enabled: !0,
            fn: r,
            alt: o.alt || []
        }),
        this.__cache__ = null
    }
    ,
    z.prototype.after = function(e, t, r, n) {
        var i = this.__find__(e)
          , o = n || {};
        if (-1 === i)
            throw new Error("Parser rule not found: " + e);
        this.__rules__.splice(i + 1, 0, {
            name: t,
            enabled: !0,
            fn: r,
            alt: o.alt || []
        }),
        this.__cache__ = null
    }
    ,
    z.prototype.push = function(e, t, r) {
        var n = r || {};
        this.__rules__.push({
            name: e,
            enabled: !0,
            fn: t,
            alt: n.alt || []
        }),
        this.__cache__ = null
    }
    ,
    z.prototype.enable = function(e, t) {
        e = Array.isArray(e) ? e : [e],
        t && this.__rules__.forEach((function(e) {
            e.enabled = !1
        }
        )),
        e.forEach((function(e) {
            var t = this.__find__(e);
            if (t < 0)
                throw new Error("Rules manager: invalid rule name " + e);
            this.__rules__[t].enabled = !0
        }
        ), this),
        this.__cache__ = null
    }
    ,
    z.prototype.disable = function(e) {
        (e = Array.isArray(e) ? e : [e]).forEach((function(e) {
            var t = this.__find__(e);
            if (t < 0)
                throw new Error("Rules manager: invalid rule name " + e);
            this.__rules__[t].enabled = !1
        }
        ), this),
        this.__cache__ = null
    }
    ,
    z.prototype.getRules = function(e) {
        return null === this.__cache__ && this.__compile__(),
        this.__cache__[e] || []
    }
    ,
    P.prototype.pushPending = function() {
        this.tokens.push({
            type: "text",
            content: this.pending,
            level: this.pendingLevel
        }),
        this.pending = ""
    }
    ,
    P.prototype.push = function(e) {
        this.pending && this.pushPending(),
        this.tokens.push(e),
        this.pendingLevel = this.level
    }
    ,
    P.prototype.cacheSet = function(e, t) {
        for (var r = this.cache.length; r <= e; r++)
            this.cache.push(0);
        this.cache[e] = t
    }
    ,
    P.prototype.cacheGet = function(e) {
        return e < this.cache.length ? this.cache[e] : 0
    }
    ;
    var K = " \n()[]'\".,!?-";
    function J(e) {
        return e.replace(/([-()\[\]{}+?*.$\^|,:#<!\\])/g, "\\$1")
    }
    var W = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/
      , X = /\((c|tm|r|p)\)/gi
      , Q = {
        c: "©",
        r: "®",
        p: "§",
        tm: "™"
    };
    function ee(e) {
        return e.indexOf("(") < 0 ? e : e.replace(X, (function(e, t) {
            return Q[t.toLowerCase()]
        }
        ))
    }
    var te = /['"]/
      , re = /['"]/g
      , ne = /[-\s()\[\]]/;
    function ie(e, t) {
        return !(t < 0 || t >= e.length) && !ne.test(e[t])
    }
    function oe(e, t, r) {
        return e.substr(0, t) + r + e.substr(t + 1)
    }
    var se = [["block", function(e) {
        e.inlineMode ? e.tokens.push({
            type: "inline",
            content: e.src.replace(/\n/g, " ").trim(),
            level: 0,
            lines: [0, 1],
            children: []
        }) : e.block.parse(e.src, e.options, e.env, e.tokens)
    }
    ], ["abbr", function(e) {
        var t, r, n, i, o = e.tokens;
        if (!e.inlineMode)
            for (t = 1,
            r = o.length - 1; t < r; t++)
                if ("paragraph_open" === o[t - 1].type && "inline" === o[t].type && "paragraph_close" === o[t + 1].type) {
                    for (n = o[t].content; n.length && !((i = V(n, e.inline, e.options, e.env)) < 0); )
                        n = n.slice(i).trim();
                    o[t].content = n,
                    n.length || (o[t - 1].tight = !0,
                    o[t + 1].tight = !0)
                }
    }
    ], ["references", function(e) {
        var t, r, n, i, o = e.tokens;
        if (e.env.references = e.env.references || {},
        !e.inlineMode)
            for (t = 1,
            r = o.length - 1; t < r; t++)
                if ("inline" === o[t].type && "paragraph_open" === o[t - 1].type && "paragraph_close" === o[t + 1].type) {
                    for (n = o[t].content; n.length && !((i = Y(n, e.inline, e.options, e.env)) < 0); )
                        n = n.slice(i).trim();
                    o[t].content = n,
                    n.length || (o[t - 1].tight = !0,
                    o[t + 1].tight = !0)
                }
    }
    ], ["inline", function(e) {
        var t, r, n, i = e.tokens;
        for (r = 0,
        n = i.length; r < n; r++)
            "inline" === (t = i[r]).type && e.inline.parse(t.content, e.options, e.env, t.children)
    }
    ], ["footnote_tail", function(e) {
        var t, r, n, i, o, s, a, l, c, p = 0, u = !1, f = {};
        if (e.env.footnotes && (e.tokens = e.tokens.filter((function(e) {
            return "footnote_reference_open" === e.type ? (u = !0,
            l = [],
            c = e.label,
            !1) : "footnote_reference_close" === e.type ? (u = !1,
            f[":" + c] = l,
            !1) : (u && l.push(e),
            !u)
        }
        )),
        e.env.footnotes.list)) {
            for (s = e.env.footnotes.list,
            e.tokens.push({
                type: "footnote_block_open",
                level: p++
            }),
            t = 0,
            r = s.length; t < r; t++) {
                for (e.tokens.push({
                    type: "footnote_open",
                    id: t,
                    level: p++
                }),
                s[t].tokens ? ((a = []).push({
                    type: "paragraph_open",
                    tight: !1,
                    level: p++
                }),
                a.push({
                    type: "inline",
                    content: "",
                    level: p,
                    children: s[t].tokens
                }),
                a.push({
                    type: "paragraph_close",
                    tight: !1,
                    level: --p
                })) : s[t].label && (a = f[":" + s[t].label]),
                e.tokens = e.tokens.concat(a),
                o = "paragraph_close" === e.tokens[e.tokens.length - 1].type ? e.tokens.pop() : null,
                i = s[t].count > 0 ? s[t].count : 1,
                n = 0; n < i; n++)
                    e.tokens.push({
                        type: "footnote_anchor",
                        id: t,
                        subId: n,
                        level: p
                    });
                o && e.tokens.push(o),
                e.tokens.push({
                    type: "footnote_close",
                    level: --p
                })
            }
            e.tokens.push({
                type: "footnote_block_close",
                level: --p
            })
        }
    }
    ], ["abbr2", function(e) {
        var t, r, n, i, o, s, a, l, c, p, u, f, h = e.tokens;
        if (e.env.abbreviations)
            for (e.env.abbrRegExp || (f = "(^|[" + K.split("").map(J).join("") + "])(" + Object.keys(e.env.abbreviations).map((function(e) {
                return e.substr(1)
            }
            )).sort((function(e, t) {
                return t.length - e.length
            }
            )).map(J).join("|") + ")($|[" + K.split("").map(J).join("") + "])",
            e.env.abbrRegExp = new RegExp(f,"g")),
            p = e.env.abbrRegExp,
            r = 0,
            n = h.length; r < n; r++)
                if ("inline" === h[r].type)
                    for (t = (i = h[r].children).length - 1; t >= 0; t--)
                        if ("text" === (o = i[t]).type) {
                            for (l = 0,
                            s = o.content,
                            p.lastIndex = 0,
                            c = o.level,
                            a = []; u = p.exec(s); )
                                p.lastIndex > l && a.push({
                                    type: "text",
                                    content: s.slice(l, u.index + u[1].length),
                                    level: c
                                }),
                                a.push({
                                    type: "abbr_open",
                                    title: e.env.abbreviations[":" + u[2]],
                                    level: c++
                                }),
                                a.push({
                                    type: "text",
                                    content: u[2],
                                    level: c
                                }),
                                a.push({
                                    type: "abbr_close",
                                    level: --c
                                }),
                                l = p.lastIndex - u[3].length;
                            a.length && (l < s.length && a.push({
                                type: "text",
                                content: s.slice(l),
                                level: c
                            }),
                            h[r].children = i = [].concat(i.slice(0, t), a, i.slice(t + 1)))
                        }
    }
    ], ["replacements", function(e) {
        var t, r, n, i, o;
        if (e.options.typographer)
            for (o = e.tokens.length - 1; o >= 0; o--)
                if ("inline" === e.tokens[o].type)
                    for (t = (i = e.tokens[o].children).length - 1; t >= 0; t--)
                        "text" === (r = i[t]).type && (n = ee(n = r.content),
                        W.test(n) && (n = n.replace(/\+-/g, "±").replace(/\.{2,}/g, "…").replace(/([?!])…/g, "$1..").replace(/([?!]){4,}/g, "$1$1$1").replace(/,{2,}/g, ",").replace(/(^|[^-])---([^-]|$)/gm, "$1—$2").replace(/(^|\s)--(\s|$)/gm, "$1–$2").replace(/(^|[^-\s])--([^-\s]|$)/gm, "$1–$2")),
                        r.content = n)
    }
    ], ["smartquotes", function(e) {
        var t, r, n, i, o, s, a, l, c, p, u, f, h, d, g, m, b;
        if (e.options.typographer)
            for (b = [],
            g = e.tokens.length - 1; g >= 0; g--)
                if ("inline" === e.tokens[g].type)
                    for (m = e.tokens[g].children,
                    b.length = 0,
                    t = 0; t < m.length; t++)
                        if ("text" === (r = m[t]).type && !te.test(r.text)) {
                            for (a = m[t].level,
                            h = b.length - 1; h >= 0 && !(b[h].level <= a); h--)
                                ;
                            b.length = h + 1,
                            o = 0,
                            s = (n = r.content).length;
                            e: for (; o < s && (re.lastIndex = o,
                            i = re.exec(n)); )
                                if (l = !ie(n, i.index - 1),
                                o = i.index + 1,
                                d = "'" === i[0],
                                (c = !ie(n, o)) || l) {
                                    if (u = !c,
                                    f = !l)
                                        for (h = b.length - 1; h >= 0 && (p = b[h],
                                        !(b[h].level < a)); h--)
                                            if (p.single === d && b[h].level === a) {
                                                p = b[h],
                                                d ? (m[p.token].content = oe(m[p.token].content, p.pos, e.options.quotes[2]),
                                                r.content = oe(r.content, i.index, e.options.quotes[3])) : (m[p.token].content = oe(m[p.token].content, p.pos, e.options.quotes[0]),
                                                r.content = oe(r.content, i.index, e.options.quotes[1])),
                                                b.length = h;
                                                continue e
                                            }
                                    u ? b.push({
                                        token: t,
                                        pos: i.index,
                                        single: d,
                                        level: a
                                    }) : f && d && (r.content = oe(r.content, i.index, "’"))
                                } else
                                    d && (r.content = oe(r.content, i.index, "’"))
                        }
    }
    ]];
    function ae() {
        this.options = {},
        this.ruler = new z;
        for (var e = 0; e < se.length; e++)
            this.ruler.push(se[e][0], se[e][1])
    }
    function le(e, t, r, n, i) {
        var o, s, a, l, c, p, u;
        for (this.src = e,
        this.parser = t,
        this.options = r,
        this.env = n,
        this.tokens = i,
        this.bMarks = [],
        this.eMarks = [],
        this.tShift = [],
        this.blkIndent = 0,
        this.line = 0,
        this.lineMax = 0,
        this.tight = !1,
        this.parentType = "root",
        this.ddIndent = -1,
        this.level = 0,
        this.result = "",
        p = 0,
        u = !1,
        a = l = p = 0,
        c = (s = this.src).length; l < c; l++) {
            if (o = s.charCodeAt(l),
            !u) {
                if (32 === o) {
                    p++;
                    continue
                }
                u = !0
            }
            10 !== o && l !== c - 1 || (10 !== o && l++,
            this.bMarks.push(a),
            this.eMarks.push(l),
            this.tShift.push(p),
            u = !1,
            p = 0,
            a = l + 1)
        }
        this.bMarks.push(s.length),
        this.eMarks.push(s.length),
        this.tShift.push(0),
        this.lineMax = this.bMarks.length - 1
    }
    function ce(e, t) {
        var r, n, i;
        return (n = e.bMarks[t] + e.tShift[t]) >= (i = e.eMarks[t]) || 42 !== (r = e.src.charCodeAt(n++)) && 45 !== r && 43 !== r || n < i && 32 !== e.src.charCodeAt(n) ? -1 : n
    }
    function pe(e, t) {
        var r, n = e.bMarks[t] + e.tShift[t], i = e.eMarks[t];
        if (n + 1 >= i)
            return -1;
        if ((r = e.src.charCodeAt(n++)) < 48 || r > 57)
            return -1;
        for (; ; ) {
            if (n >= i)
                return -1;
            if (!((r = e.src.charCodeAt(n++)) >= 48 && r <= 57)) {
                if (41 === r || 46 === r)
                    break;
                return -1
            }
        }
        return n < i && 32 !== e.src.charCodeAt(n) ? -1 : n
    }
    ae.prototype.process = function(e) {
        var t, r, n;
        for (t = 0,
        r = (n = this.ruler.getRules("")).length; t < r; t++)
            n[t](e)
    }
    ,
    le.prototype.isEmpty = function(e) {
        return this.bMarks[e] + this.tShift[e] >= this.eMarks[e]
    }
    ,
    le.prototype.skipEmptyLines = function(e) {
        for (var t = this.lineMax; e < t && !(this.bMarks[e] + this.tShift[e] < this.eMarks[e]); e++)
            ;
        return e
    }
    ,
    le.prototype.skipSpaces = function(e) {
        for (var t = this.src.length; e < t && 32 === this.src.charCodeAt(e); e++)
            ;
        return e
    }
    ,
    le.prototype.skipChars = function(e, t) {
        for (var r = this.src.length; e < r && this.src.charCodeAt(e) === t; e++)
            ;
        return e
    }
    ,
    le.prototype.skipCharsBack = function(e, t, r) {
        if (e <= r)
            return e;
        for (; e > r; )
            if (t !== this.src.charCodeAt(--e))
                return e + 1;
        return e
    }
    ,
    le.prototype.getLines = function(e, t, r, n) {
        var i, o, s, a, l, c = e;
        if (e >= t)
            return "";
        if (c + 1 === t)
            return o = this.bMarks[c] + Math.min(this.tShift[c], r),
            s = n ? this.eMarks[c] + 1 : this.eMarks[c],
            this.src.slice(o, s);
        for (a = new Array(t - e),
        i = 0; c < t; c++,
        i++)
            (l = this.tShift[c]) > r && (l = r),
            l < 0 && (l = 0),
            o = this.bMarks[c] + l,
            s = c + 1 < t || n ? this.eMarks[c] + 1 : this.eMarks[c],
            a[i] = this.src.slice(o, s);
        return a.join("")
    }
    ;
    var ue = {};
    ["article", "aside", "button", "blockquote", "body", "canvas", "caption", "col", "colgroup", "dd", "div", "dl", "dt", "embed", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "iframe", "li", "map", "object", "ol", "output", "p", "pre", "progress", "script", "section", "style", "table", "tbody", "td", "textarea", "tfoot", "th", "tr", "thead", "ul", "video"].forEach((function(e) {
        ue[e] = !0
    }
    ));
    var fe = /^<([a-zA-Z]{1,15})[\s\/>]/
      , he = /^<\/([a-zA-Z]{1,15})[\s>]/;
    function de(e, t) {
        var r = e.bMarks[t] + e.blkIndent
          , n = e.eMarks[t];
        return e.src.substr(r, n - r)
    }
    function ge(e, t) {
        var r, n, i = e.bMarks[t] + e.tShift[t], o = e.eMarks[t];
        return i >= o || 126 !== (n = e.src.charCodeAt(i++)) && 58 !== n || i === (r = e.skipSpaces(i)) || r >= o ? -1 : r
    }
    var me = [["code", function(e, t, r) {
        var n, i;
        if (e.tShift[t] - e.blkIndent < 4)
            return !1;
        for (i = n = t + 1; n < r; )
            if (e.isEmpty(n))
                n++;
            else {
                if (!(e.tShift[n] - e.blkIndent >= 4))
                    break;
                i = ++n
            }
        return e.line = n,
        e.tokens.push({
            type: "code",
            content: e.getLines(t, i, 4 + e.blkIndent, !0),
            block: !0,
            lines: [t, e.line],
            level: e.level
        }),
        !0
    }
    ], ["fences", function(e, t, r, n) {
        var i, o, s, a, l, c = !1, p = e.bMarks[t] + e.tShift[t], u = e.eMarks[t];
        if (p + 3 > u)
            return !1;
        if (126 !== (i = e.src.charCodeAt(p)) && 96 !== i)
            return !1;
        if (l = p,
        (o = (p = e.skipChars(p, i)) - l) < 3)
            return !1;
        if ((s = e.src.slice(p, u).trim()).indexOf("`") >= 0)
            return !1;
        if (n)
            return !0;
        for (a = t; !(++a >= r) && !((p = l = e.bMarks[a] + e.tShift[a]) < (u = e.eMarks[a]) && e.tShift[a] < e.blkIndent); )
            if (e.src.charCodeAt(p) === i && !(e.tShift[a] - e.blkIndent >= 4 || (p = e.skipChars(p, i)) - l < o || (p = e.skipSpaces(p)) < u)) {
                c = !0;
                break
            }
        return o = e.tShift[t],
        e.line = a + (c ? 1 : 0),
        e.tokens.push({
            type: "fence",
            params: s,
            content: e.getLines(t + 1, a, o, !0),
            lines: [t, e.line],
            level: e.level
        }),
        !0
    }
    , ["paragraph", "blockquote", "list"]], ["blockquote", function(e, t, r, n) {
        var i, o, s, a, l, c, p, u, f, h, d, g = e.bMarks[t] + e.tShift[t], m = e.eMarks[t];
        if (g > m)
            return !1;
        if (62 !== e.src.charCodeAt(g++))
            return !1;
        if (e.level >= e.options.maxNesting)
            return !1;
        if (n)
            return !0;
        for (32 === e.src.charCodeAt(g) && g++,
        l = e.blkIndent,
        e.blkIndent = 0,
        a = [e.bMarks[t]],
        e.bMarks[t] = g,
        o = (g = g < m ? e.skipSpaces(g) : g) >= m,
        s = [e.tShift[t]],
        e.tShift[t] = g - e.bMarks[t],
        u = e.parser.ruler.getRules("blockquote"),
        i = t + 1; i < r && !((g = e.bMarks[i] + e.tShift[i]) >= (m = e.eMarks[i])); i++)
            if (62 !== e.src.charCodeAt(g++)) {
                if (o)
                    break;
                for (d = !1,
                f = 0,
                h = u.length; f < h; f++)
                    if (u[f](e, i, r, !0)) {
                        d = !0;
                        break
                    }
                if (d)
                    break;
                a.push(e.bMarks[i]),
                s.push(e.tShift[i]),
                e.tShift[i] = -1337
            } else
                32 === e.src.charCodeAt(g) && g++,
                a.push(e.bMarks[i]),
                e.bMarks[i] = g,
                o = (g = g < m ? e.skipSpaces(g) : g) >= m,
                s.push(e.tShift[i]),
                e.tShift[i] = g - e.bMarks[i];
        for (c = e.parentType,
        e.parentType = "blockquote",
        e.tokens.push({
            type: "blockquote_open",
            lines: p = [t, 0],
            level: e.level++
        }),
        e.parser.tokenize(e, t, i),
        e.tokens.push({
            type: "blockquote_close",
            level: --e.level
        }),
        e.parentType = c,
        p[1] = e.line,
        f = 0; f < s.length; f++)
            e.bMarks[f + t] = a[f],
            e.tShift[f + t] = s[f];
        return e.blkIndent = l,
        !0
    }
    , ["paragraph", "blockquote", "list"]], ["hr", function(e, t, r, n) {
        var i, o, s, a = e.bMarks[t], l = e.eMarks[t];
        if ((a += e.tShift[t]) > l)
            return !1;
        if (42 !== (i = e.src.charCodeAt(a++)) && 45 !== i && 95 !== i)
            return !1;
        for (o = 1; a < l; ) {
            if ((s = e.src.charCodeAt(a++)) !== i && 32 !== s)
                return !1;
            s === i && o++
        }
        return !(o < 3) && (n || (e.line = t + 1,
        e.tokens.push({
            type: "hr",
            lines: [t, e.line],
            level: e.level
        })),
        !0)
    }
    , ["paragraph", "blockquote", "list"]], ["list", function(e, t, r, n) {
        var i, o, s, a, l, c, p, u, f, h, d, g, m, b, v, k, y, A, w, x, _, C = !0;
        if ((u = pe(e, t)) >= 0)
            g = !0;
        else {
            if (!((u = ce(e, t)) >= 0))
                return !1;
            g = !1
        }
        if (e.level >= e.options.maxNesting)
            return !1;
        if (d = e.src.charCodeAt(u - 1),
        n)
            return !0;
        for (b = e.tokens.length,
        g ? (p = e.bMarks[t] + e.tShift[t],
        h = Number(e.src.substr(p, u - p - 1)),
        e.tokens.push({
            type: "ordered_list_open",
            order: h,
            lines: k = [t, 0],
            level: e.level++
        })) : e.tokens.push({
            type: "bullet_list_open",
            lines: k = [t, 0],
            level: e.level++
        }),
        i = t,
        v = !1,
        A = e.parser.ruler.getRules("list"); !(!(i < r) || ((f = (m = e.skipSpaces(u)) >= e.eMarks[i] ? 1 : m - u) > 4 && (f = 1),
        f < 1 && (f = 1),
        o = u - e.bMarks[i] + f,
        e.tokens.push({
            type: "list_item_open",
            lines: y = [t, 0],
            level: e.level++
        }),
        a = e.blkIndent,
        l = e.tight,
        s = e.tShift[t],
        c = e.parentType,
        e.tShift[t] = m - e.bMarks[t],
        e.blkIndent = o,
        e.tight = !0,
        e.parentType = "list",
        e.parser.tokenize(e, t, r, !0),
        e.tight && !v || (C = !1),
        v = e.line - t > 1 && e.isEmpty(e.line - 1),
        e.blkIndent = a,
        e.tShift[t] = s,
        e.tight = l,
        e.parentType = c,
        e.tokens.push({
            type: "list_item_close",
            level: --e.level
        }),
        i = t = e.line,
        y[1] = i,
        m = e.bMarks[t],
        i >= r) || e.isEmpty(i) || e.tShift[i] < e.blkIndent); ) {
            for (_ = !1,
            w = 0,
            x = A.length; w < x; w++)
                if (A[w](e, i, r, !0)) {
                    _ = !0;
                    break
                }
            if (_)
                break;
            if (g) {
                if ((u = pe(e, i)) < 0)
                    break
            } else if ((u = ce(e, i)) < 0)
                break;
            if (d !== e.src.charCodeAt(u - 1))
                break
        }
        return e.tokens.push({
            type: g ? "ordered_list_close" : "bullet_list_close",
            level: --e.level
        }),
        k[1] = i,
        e.line = i,
        C && function(e, t) {
            var r, n, i = e.level + 2;
            for (r = t + 2,
            n = e.tokens.length - 2; r < n; r++)
                e.tokens[r].level === i && "paragraph_open" === e.tokens[r].type && (e.tokens[r + 2].tight = !0,
                e.tokens[r].tight = !0,
                r += 2)
        }(e, b),
        !0
    }
    , ["paragraph", "blockquote"]], ["footnote", function(e, t, r, n) {
        var i, o, s, a, l, c = e.bMarks[t] + e.tShift[t], p = e.eMarks[t];
        if (c + 4 > p)
            return !1;
        if (91 !== e.src.charCodeAt(c))
            return !1;
        if (94 !== e.src.charCodeAt(c + 1))
            return !1;
        if (e.level >= e.options.maxNesting)
            return !1;
        for (a = c + 2; a < p; a++) {
            if (32 === e.src.charCodeAt(a))
                return !1;
            if (93 === e.src.charCodeAt(a))
                break
        }
        return a !== c + 2 && (!(a + 1 >= p || 58 !== e.src.charCodeAt(++a)) && (n || (a++,
        e.env.footnotes || (e.env.footnotes = {}),
        e.env.footnotes.refs || (e.env.footnotes.refs = {}),
        l = e.src.slice(c + 2, a - 2),
        e.env.footnotes.refs[":" + l] = -1,
        e.tokens.push({
            type: "footnote_reference_open",
            label: l,
            level: e.level++
        }),
        i = e.bMarks[t],
        o = e.tShift[t],
        s = e.parentType,
        e.tShift[t] = e.skipSpaces(a) - a,
        e.bMarks[t] = a,
        e.blkIndent += 4,
        e.parentType = "footnote",
        e.tShift[t] < e.blkIndent && (e.tShift[t] += e.blkIndent,
        e.bMarks[t] -= e.blkIndent),
        e.parser.tokenize(e, t, r, !0),
        e.parentType = s,
        e.blkIndent -= 4,
        e.tShift[t] = o,
        e.bMarks[t] = i,
        e.tokens.push({
            type: "footnote_reference_close",
            level: --e.level
        })),
        !0))
    }
    , ["paragraph"]], ["heading", function(e, t, r, n) {
        var i, o, s, a = e.bMarks[t] + e.tShift[t], l = e.eMarks[t];
        if (a >= l)
            return !1;
        if (35 !== (i = e.src.charCodeAt(a)) || a >= l)
            return !1;
        for (o = 1,
        i = e.src.charCodeAt(++a); 35 === i && a < l && o <= 6; )
            o++,
            i = e.src.charCodeAt(++a);
        return !(o > 6 || a < l && 32 !== i) && (n || (l = e.skipCharsBack(l, 32, a),
        (s = e.skipCharsBack(l, 35, a)) > a && 32 === e.src.charCodeAt(s - 1) && (l = s),
        e.line = t + 1,
        e.tokens.push({
            type: "heading_open",
            hLevel: o,
            lines: [t, e.line],
            level: e.level
        }),
        a < l && e.tokens.push({
            type: "inline",
            content: e.src.slice(a, l).trim(),
            level: e.level + 1,
            lines: [t, e.line],
            children: []
        }),
        e.tokens.push({
            type: "heading_close",
            hLevel: o,
            level: e.level
        })),
        !0)
    }
    , ["paragraph", "blockquote"]], ["lheading", function(e, t, r) {
        var n, i, o, s = t + 1;
        return !(s >= r) && (!(e.tShift[s] < e.blkIndent) && (!(e.tShift[s] - e.blkIndent > 3) && (!((i = e.bMarks[s] + e.tShift[s]) >= (o = e.eMarks[s])) && ((45 === (n = e.src.charCodeAt(i)) || 61 === n) && (i = e.skipChars(i, n),
        !((i = e.skipSpaces(i)) < o) && (i = e.bMarks[t] + e.tShift[t],
        e.line = s + 1,
        e.tokens.push({
            type: "heading_open",
            hLevel: 61 === n ? 1 : 2,
            lines: [t, e.line],
            level: e.level
        }),
        e.tokens.push({
            type: "inline",
            content: e.src.slice(i, e.eMarks[t]).trim(),
            level: e.level + 1,
            lines: [t, e.line - 1],
            children: []
        }),
        e.tokens.push({
            type: "heading_close",
            hLevel: 61 === n ? 1 : 2,
            level: e.level
        }),
        !0))))))
    }
    ], ["htmlblock", function(e, t, r, n) {
        var i, o, s, a = e.bMarks[t], l = e.eMarks[t], c = e.tShift[t];
        if (a += c,
        !e.options.html)
            return !1;
        if (c > 3 || a + 2 >= l)
            return !1;
        if (60 !== e.src.charCodeAt(a))
            return !1;
        if (33 === (i = e.src.charCodeAt(a + 1)) || 63 === i) {
            if (n)
                return !0
        } else {
            if (47 !== i && !function(e) {
                var t = 32 | e;
                return t >= 97 && t <= 122
            }(i))
                return !1;
            if (47 === i) {
                if (!(o = e.src.slice(a, l).match(he)))
                    return !1
            } else if (!(o = e.src.slice(a, l).match(fe)))
                return !1;
            if (!0 !== ue[o[1].toLowerCase()])
                return !1;
            if (n)
                return !0
        }
        for (s = t + 1; s < e.lineMax && !e.isEmpty(s); )
            s++;
        return e.line = s,
        e.tokens.push({
            type: "htmlblock",
            level: e.level,
            lines: [t, e.line],
            content: e.getLines(t, s, 0, !0)
        }),
        !0
    }
    , ["paragraph", "blockquote"]], ["table", function(e, t, r, n) {
        var i, o, s, a, l, c, p, u, f, h, d;
        if (t + 2 > r)
            return !1;
        if (l = t + 1,
        e.tShift[l] < e.blkIndent)
            return !1;
        if ((s = e.bMarks[l] + e.tShift[l]) >= e.eMarks[l])
            return !1;
        if (124 !== (i = e.src.charCodeAt(s)) && 45 !== i && 58 !== i)
            return !1;
        if (o = de(e, t + 1),
        !/^[-:| ]+$/.test(o))
            return !1;
        if ((c = o.split("|")) <= 2)
            return !1;
        for (u = [],
        a = 0; a < c.length; a++) {
            if (!(f = c[a].trim())) {
                if (0 === a || a === c.length - 1)
                    continue;
                return !1
            }
            if (!/^:?-+:?$/.test(f))
                return !1;
            58 === f.charCodeAt(f.length - 1) ? u.push(58 === f.charCodeAt(0) ? "center" : "right") : 58 === f.charCodeAt(0) ? u.push("left") : u.push("")
        }
        if (-1 === (o = de(e, t).trim()).indexOf("|"))
            return !1;
        if (c = o.replace(/^\||\|$/g, "").split("|"),
        u.length !== c.length)
            return !1;
        if (n)
            return !0;
        for (e.tokens.push({
            type: "table_open",
            lines: h = [t, 0],
            level: e.level++
        }),
        e.tokens.push({
            type: "thead_open",
            lines: [t, t + 1],
            level: e.level++
        }),
        e.tokens.push({
            type: "tr_open",
            lines: [t, t + 1],
            level: e.level++
        }),
        a = 0; a < c.length; a++)
            e.tokens.push({
                type: "th_open",
                align: u[a],
                lines: [t, t + 1],
                level: e.level++
            }),
            e.tokens.push({
                type: "inline",
                content: c[a].trim(),
                lines: [t, t + 1],
                level: e.level,
                children: []
            }),
            e.tokens.push({
                type: "th_close",
                level: --e.level
            });
        for (e.tokens.push({
            type: "tr_close",
            level: --e.level
        }),
        e.tokens.push({
            type: "thead_close",
            level: --e.level
        }),
        e.tokens.push({
            type: "tbody_open",
            lines: d = [t + 2, 0],
            level: e.level++
        }),
        l = t + 2; l < r && !(e.tShift[l] < e.blkIndent) && -1 !== (o = de(e, l).trim()).indexOf("|"); l++) {
            for (c = o.replace(/^\||\|$/g, "").split("|"),
            e.tokens.push({
                type: "tr_open",
                level: e.level++
            }),
            a = 0; a < c.length; a++)
                e.tokens.push({
                    type: "td_open",
                    align: u[a],
                    level: e.level++
                }),
                p = c[a].substring(124 === c[a].charCodeAt(0) ? 1 : 0, 124 === c[a].charCodeAt(c[a].length - 1) ? c[a].length - 1 : c[a].length).trim(),
                e.tokens.push({
                    type: "inline",
                    content: p,
                    level: e.level,
                    children: []
                }),
                e.tokens.push({
                    type: "td_close",
                    level: --e.level
                });
            e.tokens.push({
                type: "tr_close",
                level: --e.level
            })
        }
        return e.tokens.push({
            type: "tbody_close",
            level: --e.level
        }),
        e.tokens.push({
            type: "table_close",
            level: --e.level
        }),
        h[1] = d[1] = l,
        e.line = l,
        !0
    }
    , ["paragraph"]], ["deflist", function(e, t, r, n) {
        var i, o, s, a, l, c, p, u, f, h, d, g, m, b;
        if (n)
            return !(e.ddIndent < 0) && ge(e, t) >= 0;
        if (p = t + 1,
        e.isEmpty(p) && ++p > r)
            return !1;
        if (e.tShift[p] < e.blkIndent)
            return !1;
        if ((i = ge(e, p)) < 0)
            return !1;
        if (e.level >= e.options.maxNesting)
            return !1;
        c = e.tokens.length,
        e.tokens.push({
            type: "dl_open",
            lines: l = [t, 0],
            level: e.level++
        }),
        s = t,
        o = p;
        e: for (; ; ) {
            for (b = !0,
            m = !1,
            e.tokens.push({
                type: "dt_open",
                lines: [s, s],
                level: e.level++
            }),
            e.tokens.push({
                type: "inline",
                content: e.getLines(s, s + 1, e.blkIndent, !1).trim(),
                level: e.level + 1,
                lines: [s, s],
                children: []
            }),
            e.tokens.push({
                type: "dt_close",
                level: --e.level
            }); ; ) {
                if (e.tokens.push({
                    type: "dd_open",
                    lines: a = [p, 0],
                    level: e.level++
                }),
                g = e.tight,
                f = e.ddIndent,
                u = e.blkIndent,
                d = e.tShift[o],
                h = e.parentType,
                e.blkIndent = e.ddIndent = e.tShift[o] + 2,
                e.tShift[o] = i - e.bMarks[o],
                e.tight = !0,
                e.parentType = "deflist",
                e.parser.tokenize(e, o, r, !0),
                e.tight && !m || (b = !1),
                m = e.line - o > 1 && e.isEmpty(e.line - 1),
                e.tShift[o] = d,
                e.tight = g,
                e.parentType = h,
                e.blkIndent = u,
                e.ddIndent = f,
                e.tokens.push({
                    type: "dd_close",
                    level: --e.level
                }),
                a[1] = p = e.line,
                p >= r)
                    break e;
                if (e.tShift[p] < e.blkIndent)
                    break e;
                if ((i = ge(e, p)) < 0)
                    break;
                o = p
            }
            if (p >= r)
                break;
            if (s = p,
            e.isEmpty(s))
                break;
            if (e.tShift[s] < e.blkIndent)
                break;
            if ((o = s + 1) >= r)
                break;
            if (e.isEmpty(o) && o++,
            o >= r)
                break;
            if (e.tShift[o] < e.blkIndent)
                break;
            if ((i = ge(e, o)) < 0)
                break
        }
        return e.tokens.push({
            type: "dl_close",
            level: --e.level
        }),
        l[1] = p,
        e.line = p,
        b && function(e, t) {
            var r, n, i = e.level + 2;
            for (r = t + 2,
            n = e.tokens.length - 2; r < n; r++)
                e.tokens[r].level === i && "paragraph_open" === e.tokens[r].type && (e.tokens[r + 2].tight = !0,
                e.tokens[r].tight = !0,
                r += 2)
        }(e, c),
        !0
    }
    , ["paragraph"]], ["paragraph", function(e, t) {
        var r, n, i, o, s, a, l = t + 1;
        if (l < (r = e.lineMax) && !e.isEmpty(l))
            for (a = e.parser.ruler.getRules("paragraph"); l < r && !e.isEmpty(l); l++)
                if (!(e.tShift[l] - e.blkIndent > 3)) {
                    for (i = !1,
                    o = 0,
                    s = a.length; o < s; o++)
                        if (a[o](e, l, r, !0)) {
                            i = !0;
                            break
                        }
                    if (i)
                        break
                }
        return n = e.getLines(t, l, e.blkIndent, !1).trim(),
        e.line = l,
        n.length && (e.tokens.push({
            type: "paragraph_open",
            tight: !1,
            lines: [t, e.line],
            level: e.level
        }),
        e.tokens.push({
            type: "inline",
            content: n,
            level: e.level + 1,
            lines: [t, e.line],
            children: []
        }),
        e.tokens.push({
            type: "paragraph_close",
            tight: !1,
            level: e.level
        })),
        !0
    }
    ]];
    function be() {
        this.ruler = new z;
        for (var e = 0; e < me.length; e++)
            this.ruler.push(me[e][0], me[e][1], {
                alt: (me[e][2] || []).slice()
            })
    }
    be.prototype.tokenize = function(e, t, r) {
        for (var n, i = this.ruler.getRules(""), o = i.length, s = t, a = !1; s < r && (e.line = s = e.skipEmptyLines(s),
        !(s >= r)) && !(e.tShift[s] < e.blkIndent); ) {
            for (n = 0; n < o && !i[n](e, s, r, !1); n++)
                ;
            if (e.tight = !a,
            e.isEmpty(e.line - 1) && (a = !0),
            (s = e.line) < r && e.isEmpty(s)) {
                if (a = !0,
                ++s < r && "list" === e.parentType && e.isEmpty(s))
                    break;
                e.line = s
            }
        }
    }
    ;
    var ve = /[\n\t]/g
      , ke = /\r[\n\u0085]|[\u2424\u2028\u0085]/g
      , ye = /\u00a0/g;
    function Ae(e) {
        switch (e) {
        case 10:
        case 92:
        case 96:
        case 42:
        case 95:
        case 94:
        case 91:
        case 93:
        case 33:
        case 38:
        case 60:
        case 62:
        case 123:
        case 125:
        case 36:
        case 37:
        case 64:
        case 126:
        case 43:
        case 61:
        case 58:
            return !0;
        default:
            return !1
        }
    }
    be.prototype.parse = function(e, t, r, n) {
        var i, o = 0, s = 0;
        if (!e)
            return [];
        (e = (e = e.replace(ye, " ")).replace(ke, "\n")).indexOf("\t") >= 0 && (e = e.replace(ve, (function(t, r) {
            var n;
            return 10 === e.charCodeAt(r) ? (o = r + 1,
            s = 0,
            t) : (n = "    ".slice((r - o - s) % 4),
            s = r - o + 1,
            n)
        }
        ))),
        i = new le(e,this,t,r,n),
        this.tokenize(i, i.line, i.lineMax)
    }
    ;
    for (var we = [], xe = 0; xe < 256; xe++)
        we.push(0);
    function _e(e) {
        return e >= 48 && e <= 57 || e >= 65 && e <= 90 || e >= 97 && e <= 122
    }
    function Ce(e, t) {
        var r, n, i, o = t, s = !0, a = !0, l = e.posMax, c = e.src.charCodeAt(t);
        for (r = t > 0 ? e.src.charCodeAt(t - 1) : -1; o < l && e.src.charCodeAt(o) === c; )
            o++;
        return o >= l && (s = !1),
        (i = o - t) >= 4 ? s = a = !1 : (32 !== (n = o < l ? e.src.charCodeAt(o) : -1) && 10 !== n || (s = !1),
        32 !== r && 10 !== r || (a = !1),
        95 === c && (_e(r) && (s = !1),
        _e(n) && (a = !1))),
        {
            can_open: s,
            can_close: a,
            delims: i
        }
    }
    "\\!\"#$%&'()*+,./:;<=>?@[]^_`{|}~-".split("").forEach((function(e) {
        we[e.charCodeAt(0)] = 1
    }
    ));
    var qe = /\\([ \\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;
    var Se = /\\([ \\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;
    var Ee = ["coap", "doi", "javascript", "aaa", "aaas", "about", "acap", "cap", "cid", "crid", "data", "dav", "dict", "dns", "file", "ftp", "geo", "go", "gopher", "h323", "http", "https", "iax", "icap", "im", "imap", "info", "ipp", "iris", "iris.beep", "iris.xpc", "iris.xpcs", "iris.lwz", "ldap", "mailto", "mid", "msrp", "msrps", "mtqp", "mupdate", "news", "nfs", "ni", "nih", "nntp", "opaquelocktoken", "pop", "pres", "rtsp", "service", "session", "shttp", "sieve", "sip", "sips", "sms", "snmp", "soap.beep", "soap.beeps", "tag", "tel", "telnet", "tftp", "thismessage", "tn3270", "tip", "tv", "urn", "vemmi", "ws", "wss", "xcon", "xcon-userid", "xmlrpc.beep", "xmlrpc.beeps", "xmpp", "z39.50r", "z39.50s", "adiumxtra", "afp", "afs", "aim", "apt", "attachment", "aw", "beshare", "bitcoin", "bolo", "callto", "chrome", "chrome-extension", "com-eventbrite-attendee", "content", "cvs", "dlna-playsingle", "dlna-playcontainer", "dtn", "dvb", "ed2k", "facetime", "feed", "finger", "fish", "gg", "git", "gizmoproject", "gtalk", "hcp", "icon", "ipn", "irc", "irc6", "ircs", "itms", "jar", "jms", "keyparc", "lastfm", "ldaps", "magnet", "maps", "market", "message", "mms", "ms-help", "msnim", "mumble", "mvn", "notes", "oid", "palm", "paparazzi", "platform", "proxy", "psyc", "query", "res", "resource", "rmi", "rsync", "rtmp", "secondlife", "sftp", "sgn", "skype", "smb", "soldat", "spotify", "ssh", "steam", "svn", "teamspeak", "things", "udp", "unreal", "ut2004", "ventrilo", "view-source", "webcal", "wtai", "wyciwyg", "xfire", "xri", "ymsgr"]
      , Me = /^<([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/
      , Le = /^<([a-zA-Z.\-]{1,25}):([^<>\x00-\x20]*)>/;
    function Te(e, t) {
        return e = e.source,
        t = t || "",
        function r(n, i) {
            return n ? (i = i.source || i,
            e = e.replace(n, i),
            r) : new RegExp(e,t)
        }
    }
    var Ie = Te(/(?:unquoted|single_quoted|double_quoted)/)("unquoted", /[^"'=<>`\x00-\x20]+/)("single_quoted", /'[^']*'/)("double_quoted", /"[^"]*"/)()
      , Oe = Te(/(?:\s+attr_name(?:\s*=\s*attr_value)?)/)("attr_name", /[a-zA-Z_:][a-zA-Z0-9:._-]*/)("attr_value", Ie)()
      , Ne = Te(/<[A-Za-z][A-Za-z0-9]*attribute*\s*\/?>/)("attribute", Oe)()
      , je = Te(/^(?:open_tag|close_tag|comment|processing|declaration|cdata)/)("open_tag", Ne)("close_tag", /<\/[A-Za-z][A-Za-z0-9]*\s*>/)("comment", /<!---->|<!--(?:-?[^>-])(?:-?[^-])*-->/)("processing", /<[?].*?[?]>/)("declaration", /<![A-Z]+\s+[^>]*>/)("cdata", /<!\[CDATA\[[\s\S]*?\]\]>/)();
    var De = /^&#((?:x[a-f0-9]{1,8}|[0-9]{1,8}));/i
      , Re = /^&([a-z][a-z0-9]{1,31});/i;
    var Ue = [["text", function(e, t) {
        for (var r = e.pos; r < e.posMax && !Ae(e.src.charCodeAt(r)); )
            r++;
        return r !== e.pos && (t || (e.pending += e.src.slice(e.pos, r)),
        e.pos = r,
        !0)
    }
    ], ["newline", function(e, t) {
        var r, n, i = e.pos;
        if (10 !== e.src.charCodeAt(i))
            return !1;
        if (r = e.pending.length - 1,
        n = e.posMax,
        !t)
            if (r >= 0 && 32 === e.pending.charCodeAt(r))
                if (r >= 1 && 32 === e.pending.charCodeAt(r - 1)) {
                    for (var o = r - 2; o >= 0; o--)
                        if (32 !== e.pending.charCodeAt(o)) {
                            e.pending = e.pending.substring(0, o + 1);
                            break
                        }
                    e.push({
                        type: "hardbreak",
                        level: e.level
                    })
                } else
                    e.pending = e.pending.slice(0, -1),
                    e.push({
                        type: "softbreak",
                        level: e.level
                    });
            else
                e.push({
                    type: "softbreak",
                    level: e.level
                });
        for (i++; i < n && 32 === e.src.charCodeAt(i); )
            i++;
        return e.pos = i,
        !0
    }
    ], ["escape", function(e, t) {
        var r, n = e.pos, i = e.posMax;
        if (92 !== e.src.charCodeAt(n))
            return !1;
        if (++n < i) {
            if ((r = e.src.charCodeAt(n)) < 256 && 0 !== we[r])
                return t || (e.pending += e.src[n]),
                e.pos += 2,
                !0;
            if (10 === r) {
                for (t || e.push({
                    type: "hardbreak",
                    level: e.level
                }),
                n++; n < i && 32 === e.src.charCodeAt(n); )
                    n++;
                return e.pos = n,
                !0
            }
        }
        return t || (e.pending += "\\"),
        e.pos++,
        !0
    }
    ], ["backticks", function(e, t) {
        var r, n, i, o, s, a = e.pos;
        if (96 !== e.src.charCodeAt(a))
            return !1;
        for (r = a,
        a++,
        n = e.posMax; a < n && 96 === e.src.charCodeAt(a); )
            a++;
        for (i = e.src.slice(r, a),
        o = s = a; -1 !== (o = e.src.indexOf("`", s)); ) {
            for (s = o + 1; s < n && 96 === e.src.charCodeAt(s); )
                s++;
            if (s - o === i.length)
                return t || e.push({
                    type: "code",
                    content: e.src.slice(a, o).replace(/[ \n]+/g, " ").trim(),
                    block: !1,
                    level: e.level
                }),
                e.pos = s,
                !0
        }
        return t || (e.pending += i),
        e.pos += i.length,
        !0
    }
    ], ["del", function(e, t) {
        var r, n, i, o, s, a = e.posMax, l = e.pos;
        if (126 !== e.src.charCodeAt(l))
            return !1;
        if (t)
            return !1;
        if (l + 4 >= a)
            return !1;
        if (126 !== e.src.charCodeAt(l + 1))
            return !1;
        if (e.level >= e.options.maxNesting)
            return !1;
        if (o = l > 0 ? e.src.charCodeAt(l - 1) : -1,
        s = e.src.charCodeAt(l + 2),
        126 === o)
            return !1;
        if (126 === s)
            return !1;
        if (32 === s || 10 === s)
            return !1;
        for (n = l + 2; n < a && 126 === e.src.charCodeAt(n); )
            n++;
        if (n > l + 3)
            return e.pos += n - l,
            t || (e.pending += e.src.slice(l, n)),
            !0;
        for (e.pos = l + 2,
        i = 1; e.pos + 1 < a; ) {
            if (126 === e.src.charCodeAt(e.pos) && 126 === e.src.charCodeAt(e.pos + 1) && (o = e.src.charCodeAt(e.pos - 1),
            126 !== (s = e.pos + 2 < a ? e.src.charCodeAt(e.pos + 2) : -1) && 126 !== o && (32 !== o && 10 !== o ? i-- : 32 !== s && 10 !== s && i++,
            i <= 0))) {
                r = !0;
                break
            }
            e.parser.skipToken(e)
        }
        return r ? (e.posMax = e.pos,
        e.pos = l + 2,
        t || (e.push({
            type: "del_open",
            level: e.level++
        }),
        e.parser.tokenize(e),
        e.push({
            type: "del_close",
            level: --e.level
        })),
        e.pos = e.posMax + 2,
        e.posMax = a,
        !0) : (e.pos = l,
        !1)
    }
    ], ["ins", function(e, t) {
        var r, n, i, o, s, a = e.posMax, l = e.pos;
        if (43 !== e.src.charCodeAt(l))
            return !1;
        if (t)
            return !1;
        if (l + 4 >= a)
            return !1;
        if (43 !== e.src.charCodeAt(l + 1))
            return !1;
        if (e.level >= e.options.maxNesting)
            return !1;
        if (o = l > 0 ? e.src.charCodeAt(l - 1) : -1,
        s = e.src.charCodeAt(l + 2),
        43 === o)
            return !1;
        if (43 === s)
            return !1;
        if (32 === s || 10 === s)
            return !1;
        for (n = l + 2; n < a && 43 === e.src.charCodeAt(n); )
            n++;
        if (n !== l + 2)
            return e.pos += n - l,
            t || (e.pending += e.src.slice(l, n)),
            !0;
        for (e.pos = l + 2,
        i = 1; e.pos + 1 < a; ) {
            if (43 === e.src.charCodeAt(e.pos) && 43 === e.src.charCodeAt(e.pos + 1) && (o = e.src.charCodeAt(e.pos - 1),
            43 !== (s = e.pos + 2 < a ? e.src.charCodeAt(e.pos + 2) : -1) && 43 !== o && (32 !== o && 10 !== o ? i-- : 32 !== s && 10 !== s && i++,
            i <= 0))) {
                r = !0;
                break
            }
            e.parser.skipToken(e)
        }
        return r ? (e.posMax = e.pos,
        e.pos = l + 2,
        t || (e.push({
            type: "ins_open",
            level: e.level++
        }),
        e.parser.tokenize(e),
        e.push({
            type: "ins_close",
            level: --e.level
        })),
        e.pos = e.posMax + 2,
        e.posMax = a,
        !0) : (e.pos = l,
        !1)
    }
    ], ["mark", function(e, t) {
        var r, n, i, o, s, a = e.posMax, l = e.pos;
        if (61 !== e.src.charCodeAt(l))
            return !1;
        if (t)
            return !1;
        if (l + 4 >= a)
            return !1;
        if (61 !== e.src.charCodeAt(l + 1))
            return !1;
        if (e.level >= e.options.maxNesting)
            return !1;
        if (o = l > 0 ? e.src.charCodeAt(l - 1) : -1,
        s = e.src.charCodeAt(l + 2),
        61 === o)
            return !1;
        if (61 === s)
            return !1;
        if (32 === s || 10 === s)
            return !1;
        for (n = l + 2; n < a && 61 === e.src.charCodeAt(n); )
            n++;
        if (n !== l + 2)
            return e.pos += n - l,
            t || (e.pending += e.src.slice(l, n)),
            !0;
        for (e.pos = l + 2,
        i = 1; e.pos + 1 < a; ) {
            if (61 === e.src.charCodeAt(e.pos) && 61 === e.src.charCodeAt(e.pos + 1) && (o = e.src.charCodeAt(e.pos - 1),
            61 !== (s = e.pos + 2 < a ? e.src.charCodeAt(e.pos + 2) : -1) && 61 !== o && (32 !== o && 10 !== o ? i-- : 32 !== s && 10 !== s && i++,
            i <= 0))) {
                r = !0;
                break
            }
            e.parser.skipToken(e)
        }
        return r ? (e.posMax = e.pos,
        e.pos = l + 2,
        t || (e.push({
            type: "mark_open",
            level: e.level++
        }),
        e.parser.tokenize(e),
        e.push({
            type: "mark_close",
            level: --e.level
        })),
        e.pos = e.posMax + 2,
        e.posMax = a,
        !0) : (e.pos = l,
        !1)
    }
    ], ["emphasis", function(e, t) {
        var r, n, i, o, s, a, l, c = e.posMax, p = e.pos, u = e.src.charCodeAt(p);
        if (95 !== u && 42 !== u)
            return !1;
        if (t)
            return !1;
        if (r = (l = Ce(e, p)).delims,
        !l.can_open)
            return e.pos += r,
            t || (e.pending += e.src.slice(p, e.pos)),
            !0;
        if (e.level >= e.options.maxNesting)
            return !1;
        for (e.pos = p + r,
        a = [r]; e.pos < c; )
            if (e.src.charCodeAt(e.pos) !== u)
                e.parser.skipToken(e);
            else {
                if (n = (l = Ce(e, e.pos)).delims,
                l.can_close) {
                    for (o = a.pop(),
                    s = n; o !== s; ) {
                        if (s < o) {
                            a.push(o - s);
                            break
                        }
                        if (s -= o,
                        0 === a.length)
                            break;
                        e.pos += o,
                        o = a.pop()
                    }
                    if (0 === a.length) {
                        r = o,
                        i = !0;
                        break
                    }
                    e.pos += n;
                    continue
                }
                l.can_open && a.push(n),
                e.pos += n
            }
        return i ? (e.posMax = e.pos,
        e.pos = p + r,
        t || (2 !== r && 3 !== r || e.push({
            type: "strong_open",
            level: e.level++
        }),
        1 !== r && 3 !== r || e.push({
            type: "em_open",
            level: e.level++
        }),
        e.parser.tokenize(e),
        1 !== r && 3 !== r || e.push({
            type: "em_close",
            level: --e.level
        }),
        2 !== r && 3 !== r || e.push({
            type: "strong_close",
            level: --e.level
        })),
        e.pos = e.posMax + r,
        e.posMax = c,
        !0) : (e.pos = p,
        !1)
    }
    ], ["sub", function(e, t) {
        var r, n, i = e.posMax, o = e.pos;
        if (126 !== e.src.charCodeAt(o))
            return !1;
        if (t)
            return !1;
        if (o + 2 >= i)
            return !1;
        if (e.level >= e.options.maxNesting)
            return !1;
        for (e.pos = o + 1; e.pos < i; ) {
            if (126 === e.src.charCodeAt(e.pos)) {
                r = !0;
                break
            }
            e.parser.skipToken(e)
        }
        return r && o + 1 !== e.pos ? (n = e.src.slice(o + 1, e.pos)).match(/(^|[^\\])(\\\\)*\s/) ? (e.pos = o,
        !1) : (e.posMax = e.pos,
        e.pos = o + 1,
        t || e.push({
            type: "sub",
            level: e.level,
            content: n.replace(qe, "$1")
        }),
        e.pos = e.posMax + 1,
        e.posMax = i,
        !0) : (e.pos = o,
        !1)
    }
    ], ["sup", function(e, t) {
        var r, n, i = e.posMax, o = e.pos;
        if (94 !== e.src.charCodeAt(o))
            return !1;
        if (t)
            return !1;
        if (o + 2 >= i)
            return !1;
        if (e.level >= e.options.maxNesting)
            return !1;
        for (e.pos = o + 1; e.pos < i; ) {
            if (94 === e.src.charCodeAt(e.pos)) {
                r = !0;
                break
            }
            e.parser.skipToken(e)
        }
        return r && o + 1 !== e.pos ? (n = e.src.slice(o + 1, e.pos)).match(/(^|[^\\])(\\\\)*\s/) ? (e.pos = o,
        !1) : (e.posMax = e.pos,
        e.pos = o + 1,
        t || e.push({
            type: "sup",
            level: e.level,
            content: n.replace(Se, "$1")
        }),
        e.pos = e.posMax + 1,
        e.posMax = i,
        !0) : (e.pos = o,
        !1)
    }
    ], ["links", function(e, t) {
        var r, n, i, o, s, a, l, c, p = !1, u = e.pos, f = e.posMax, h = e.pos, d = e.src.charCodeAt(h);
        if (33 === d && (p = !0,
        d = e.src.charCodeAt(++h)),
        91 !== d)
            return !1;
        if (e.level >= e.options.maxNesting)
            return !1;
        if (r = h + 1,
        (n = B(e, h)) < 0)
            return !1;
        if ((a = n + 1) < f && 40 === e.src.charCodeAt(a)) {
            for (a++; a < f && (32 === (c = e.src.charCodeAt(a)) || 10 === c); a++)
                ;
            if (a >= f)
                return !1;
            for (h = a,
            G(e, a) ? (o = e.linkContent,
            a = e.pos) : o = "",
            h = a; a < f && (32 === (c = e.src.charCodeAt(a)) || 10 === c); a++)
                ;
            if (a < f && h !== a && H(e, a))
                for (s = e.linkContent,
                a = e.pos; a < f && (32 === (c = e.src.charCodeAt(a)) || 10 === c); a++)
                    ;
            else
                s = "";
            if (a >= f || 41 !== e.src.charCodeAt(a))
                return e.pos = u,
                !1;
            a++
        } else {
            if (e.linkLevel > 0)
                return !1;
            for (; a < f && (32 === (c = e.src.charCodeAt(a)) || 10 === c); a++)
                ;
            if (a < f && 91 === e.src.charCodeAt(a) && (h = a + 1,
            (a = B(e, a)) >= 0 ? i = e.src.slice(h, a++) : a = h - 1),
            i || (void 0 === i && (a = n + 1),
            i = e.src.slice(r, n)),
            !(l = e.env.references[Z(i)]))
                return e.pos = u,
                !1;
            o = l.href,
            s = l.title
        }
        return t || (e.pos = r,
        e.posMax = n,
        p ? e.push({
            type: "image",
            src: o,
            title: s,
            alt: e.src.substr(r, n - r),
            level: e.level
        }) : (e.push({
            type: "link_open",
            href: o,
            title: s,
            level: e.level++
        }),
        e.linkLevel++,
        e.parser.tokenize(e),
        e.linkLevel--,
        e.push({
            type: "link_close",
            level: --e.level
        }))),
        e.pos = a,
        e.posMax = f,
        !0
    }
    ], ["footnote_inline", function(e, t) {
        var r, n, i, o, s = e.posMax, a = e.pos;
        return !(a + 2 >= s) && (94 === e.src.charCodeAt(a) && (91 === e.src.charCodeAt(a + 1) && (!(e.level >= e.options.maxNesting) && (r = a + 2,
        !((n = B(e, a + 1)) < 0) && (t || (e.env.footnotes || (e.env.footnotes = {}),
        e.env.footnotes.list || (e.env.footnotes.list = []),
        i = e.env.footnotes.list.length,
        e.pos = r,
        e.posMax = n,
        e.push({
            type: "footnote_ref",
            id: i,
            level: e.level
        }),
        e.linkLevel++,
        o = e.tokens.length,
        e.parser.tokenize(e),
        e.env.footnotes.list[i] = {
            tokens: e.tokens.splice(o)
        },
        e.linkLevel--),
        e.pos = n + 1,
        e.posMax = s,
        !0)))))
    }
    ], ["footnote_ref", function(e, t) {
        var r, n, i, o, s = e.posMax, a = e.pos;
        if (a + 3 > s)
            return !1;
        if (!e.env.footnotes || !e.env.footnotes.refs)
            return !1;
        if (91 !== e.src.charCodeAt(a))
            return !1;
        if (94 !== e.src.charCodeAt(a + 1))
            return !1;
        if (e.level >= e.options.maxNesting)
            return !1;
        for (n = a + 2; n < s; n++) {
            if (32 === e.src.charCodeAt(n))
                return !1;
            if (10 === e.src.charCodeAt(n))
                return !1;
            if (93 === e.src.charCodeAt(n))
                break
        }
        return n !== a + 2 && (!(n >= s) && (n++,
        r = e.src.slice(a + 2, n - 1),
        void 0 !== e.env.footnotes.refs[":" + r] && (t || (e.env.footnotes.list || (e.env.footnotes.list = []),
        e.env.footnotes.refs[":" + r] < 0 ? (i = e.env.footnotes.list.length,
        e.env.footnotes.list[i] = {
            label: r,
            count: 0
        },
        e.env.footnotes.refs[":" + r] = i) : i = e.env.footnotes.refs[":" + r],
        o = e.env.footnotes.list[i].count,
        e.env.footnotes.list[i].count++,
        e.push({
            type: "footnote_ref",
            id: i,
            subId: o,
            level: e.level
        })),
        e.pos = n,
        e.posMax = s,
        !0)))
    }
    ], ["autolink", function(e, t) {
        var r, n, i, o, s, a = e.pos;
        return 60 === e.src.charCodeAt(a) && (!((r = e.src.slice(a)).indexOf(">") < 0) && ((n = r.match(Le)) ? !(Ee.indexOf(n[1].toLowerCase()) < 0) && (s = $(o = n[0].slice(1, -1)),
        !!e.parser.validateLink(o) && (t || (e.push({
            type: "link_open",
            href: s,
            level: e.level
        }),
        e.push({
            type: "text",
            content: o,
            level: e.level + 1
        }),
        e.push({
            type: "link_close",
            level: e.level
        })),
        e.pos += n[0].length,
        !0)) : !!(i = r.match(Me)) && (s = $("mailto:" + (o = i[0].slice(1, -1))),
        !!e.parser.validateLink(s) && (t || (e.push({
            type: "link_open",
            href: s,
            level: e.level
        }),
        e.push({
            type: "text",
            content: o,
            level: e.level + 1
        }),
        e.push({
            type: "link_close",
            level: e.level
        })),
        e.pos += i[0].length,
        !0))))
    }
    ], ["htmltag", function(e, t) {
        var r, n, i, o = e.pos;
        return !!e.options.html && (i = e.posMax,
        !(60 !== e.src.charCodeAt(o) || o + 2 >= i) && (!(33 !== (r = e.src.charCodeAt(o + 1)) && 63 !== r && 47 !== r && !function(e) {
            var t = 32 | e;
            return t >= 97 && t <= 122
        }(r)) && (!!(n = e.src.slice(o).match(je)) && (t || e.push({
            type: "htmltag",
            content: e.src.slice(o, o + n[0].length),
            level: e.level
        }),
        e.pos += n[0].length,
        !0))))
    }
    ], ["entity", function(e, t) {
        var r, n, i = e.pos, o = e.posMax;
        if (38 !== e.src.charCodeAt(i))
            return !1;
        if (i + 1 < o)
            if (35 === e.src.charCodeAt(i + 1)) {
                if (n = e.src.slice(i).match(De))
                    return t || (r = "x" === n[1][0].toLowerCase() ? parseInt(n[1].slice(1), 16) : parseInt(n[1], 10),
                    e.pending += C(r) ? q(r) : q(65533)),
                    e.pos += n[0].length,
                    !0
            } else if (n = e.src.slice(i).match(Re)) {
                var s = y(n[1]);
                if (n[1] !== s)
                    return t || (e.pending += s),
                    e.pos += n[0].length,
                    !0
            }
        return t || (e.pending += "&"),
        e.pos++,
        !0
    }
    ]];
    function Fe() {
        this.ruler = new z;
        for (var e = 0; e < Ue.length; e++)
            this.ruler.push(Ue[e][0], Ue[e][1]);
        this.validateLink = ze
    }
    function ze(e) {
        var t = e.trim().toLowerCase();
        return -1 === (t = L(t)).indexOf(":") || -1 === ["vbscript", "javascript", "file", "data"].indexOf(t.split(":")[0])
    }
    Fe.prototype.skipToken = function(e) {
        var t, r, n = this.ruler.getRules(""), i = n.length, o = e.pos;
        if ((r = e.cacheGet(o)) > 0)
            e.pos = r;
        else {
            for (t = 0; t < i; t++)
                if (n[t](e, !0))
                    return void e.cacheSet(o, e.pos);
            e.pos++,
            e.cacheSet(o, e.pos)
        }
    }
    ,
    Fe.prototype.tokenize = function(e) {
        for (var t, r, n = this.ruler.getRules(""), i = n.length, o = e.posMax; e.pos < o; ) {
            for (r = 0; r < i && !(t = n[r](e, !1)); r++)
                ;
            if (t) {
                if (e.pos >= o)
                    break
            } else
                e.pending += e.src[e.pos++]
        }
        e.pending && e.pushPending()
    }
    ,
    Fe.prototype.parse = function(e, t, r, n) {
        var i = new P(e,this,t,r,n);
        this.tokenize(i)
    }
    ;
    var Pe = {
        default: {
            options: {
                html: !1,
                xhtmlOut: !1,
                breaks: !1,
                langPrefix: "language-",
                linkTarget: "",
                typographer: !1,
                quotes: "“”‘’",
                highlight: null,
                maxNesting: 20
            },
            components: {
                core: {
                    rules: ["block", "inline", "references", "replacements", "smartquotes", "references", "abbr2", "footnote_tail"]
                },
                block: {
                    rules: ["blockquote", "code", "fences", "footnote", "heading", "hr", "htmlblock", "lheading", "list", "paragraph", "table"]
                },
                inline: {
                    rules: ["autolink", "backticks", "del", "emphasis", "entity", "escape", "footnote_ref", "htmltag", "links", "newline", "text"]
                }
            }
        },
        full: {
            options: {
                html: !1,
                xhtmlOut: !1,
                breaks: !1,
                langPrefix: "language-",
                linkTarget: "",
                typographer: !1,
                quotes: "“”‘’",
                highlight: null,
                maxNesting: 20
            },
            components: {
                core: {},
                block: {},
                inline: {}
            }
        },
        commonmark: {
            options: {
                html: !0,
                xhtmlOut: !0,
                breaks: !1,
                langPrefix: "language-",
                linkTarget: "",
                typographer: !1,
                quotes: "“”‘’",
                highlight: null,
                maxNesting: 20
            },
            components: {
                core: {
                    rules: ["block", "inline", "references", "abbr2"]
                },
                block: {
                    rules: ["blockquote", "code", "fences", "heading", "hr", "htmlblock", "lheading", "list", "paragraph"]
                },
                inline: {
                    rules: ["autolink", "backticks", "emphasis", "entity", "escape", "htmltag", "links", "newline", "text"]
                }
            }
        }
    };
    function Be(e, t, r) {
        this.src = t,
        this.env = r,
        this.options = e.options,
        this.tokens = [],
        this.inlineMode = !1,
        this.inline = e.inline,
        this.block = e.block,
        this.renderer = e.renderer,
        this.typographer = e.typographer
    }
    function Ve(e, t) {
        "string" != typeof e && (t = e,
        e = "default"),
        t && null != t.linkify && console.warn("linkify option is removed. Use linkify plugin instead:\n\nimport Remarkable from 'remarkable';\nimport linkify from 'remarkable/linkify';\nnew Remarkable().use(linkify)\n"),
        this.inline = new Fe,
        this.block = new be,
        this.core = new ae,
        this.renderer = new F,
        this.ruler = new z,
        this.options = {},
        this.configure(Pe[e]),
        this.set(t || {})
    }
    Ve.prototype.set = function(e) {
        w(this.options, e)
    }
    ,
    Ve.prototype.configure = function(e) {
        var t = this;
        if (!e)
            throw new Error("Wrong `remarkable` preset, check name/content");
        e.options && t.set(e.options),
        e.components && Object.keys(e.components).forEach((function(r) {
            e.components[r].rules && t[r].ruler.enable(e.components[r].rules, !0)
        }
        ))
    }
    ,
    Ve.prototype.use = function(e, t) {
        return e(this, t),
        this
    }
    ,
    Ve.prototype.parse = function(e, t) {
        var r = new Be(this,e,t);
        return this.core.process(r),
        r.tokens
    }
    ,
    Ve.prototype.render = function(e, t) {
        return t = t || {},
        this.renderer.render(this.parse(e, t), this.options, t)
    }
    ,
    Ve.prototype.parseInline = function(e, t) {
        var r = new Be(this,e,t);
        return r.inlineMode = !0,
        this.core.process(r),
        r.tokens
    }
    ,
    Ve.prototype.renderInline = function(e, t) {
        return t = t || {},
        this.renderer.render(this.parseInline(e, t), this.options, t)
    }
    ;
    var $e = (e,t)=>{
        const r = (t || {}).delimiter || "$";
        if (1 !== r.length)
            throw new Error("invalid delimiter");
        const i = n;
        e.inline.ruler.push("katex", ((e,t)=>{
            const n = e.pos
              , i = e.posMax;
            let o = n;
            if (e.src.charAt(o) !== r)
                return !1;
            for (++o; o < i && e.src.charAt(o) === r; )
                ++o;
            const s = e.src.slice(n, o);
            if (s.length > 2)
                return !1;
            const a = o;
            let l = 0;
            for (; o < i; ) {
                const n = e.src.charAt(o);
                if ("{" !== n || 0 != o && "\\" == e.src.charAt(o - 1)) {
                    if ("}" !== n || 0 != o && "\\" == e.src.charAt(o - 1)) {
                        if (n === r && 0 === l) {
                            const n = o;
                            let l = o + 1;
                            for (; l < i && e.src.charAt(l) === r; )
                                ++l;
                            if (l - n === s.length) {
                                if (!t) {
                                    const t = e.src.slice(a, n).replace(/[ \n]+/g, " ").trim();
                                    e.push({
                                        type: "katex",
                                        content: t,
                                        block: s.length > 1,
                                        level: e.level
                                    })
                                }
                                return e.pos = l,
                                !0
                            }
                        }
                    } else if (l -= 1,
                    l < 0)
                        return !1
                } else
                    l += 1;
                o += 1
            }
            return t || (e.pending += s),
            e.pos += s.length,
            !0
        }
        ), t),
        e.block.ruler.push("katex", ((e,t,n)=>{
            let i = !1
              , o = e.bMarks[t] + e.tShift[t]
              , s = e.eMarks[t];
            if (o + 1 > s)
                return !1;
            const a = e.src.charAt(o);
            if (a !== r)
                return !1;
            let l = o;
            o = e.skipChars(o, a);
            let c = o - l;
            if (2 !== c)
                return !1;
            let p = t;
            for (; (++p,
            !(p >= n)) && (o = l = e.bMarks[p] + e.tShift[p],
            s = e.eMarks[p],
            !(o < s && e.tShift[p] < e.blkIndent)); )
                if (e.src.charAt(o) === r && !(e.tShift[p] - e.blkIndent >= 4 || (o = e.skipChars(o, a),
                o - l < c || (o = e.skipSpaces(o),
                o < s)))) {
                    i = !0;
                    break
                }
            c = e.tShift[t],
            e.line = p + (i ? 1 : 0);
            const u = e.getLines(t + 1, p, c, !0).replace(/[ \n]+/g, " ").trim();
            return e.tokens.push({
                type: "katex",
                params: null,
                content: u,
                lines: [t, e.line],
                level: e.level,
                block: !0
            }),
            !0
        }
        ), t),
        e.renderer.rules.katex = (e,t)=>{
            return r = e[t].content,
            n = e[t].block,
            i.renderToString(r, {
                displayMode: n,
                throwOnError: !1
            });
            var r, n
        }
        ,
        e.renderer.rules.katex.delimiter = r
    }
      , Ge = {
        versions: {
            katex: "0.16.0",
            webfontloader: "1.6.28"
        },
        preloadScripts: [{
            type: "script",
            data: {
                src: "katex.min.js"
            }
        }],
        scripts: [{
            type: "iife",
            data: {
                fn: e=>{
                    window.WebFontConfig = {
                        custom: {
                            families: ["KaTeX_AMS", "KaTeX_Caligraphic:n4,n7", "KaTeX_Fraktur:n4,n7", "KaTeX_Main:n4,n7,i4,i7", "KaTeX_Math:i4,i7", "KaTeX_Script", "KaTeX_SansSerif:n4,n7,i4", "KaTeX_Size1", "KaTeX_Size2", "KaTeX_Size3", "KaTeX_Size4", "KaTeX_Typewriter"]
                        },
                        active: ()=>{
                            e().refreshHook.call()
                        }
                    }
                }
                ,
                getParams: ({getMarkmap: e})=>[e]
            }
        }, {
            type: "script",
            data: {
                src: "https://cdn.jsdelivr.net/npm/webfontloader@1.6.28/webfontloader.js",
                defer: !0
            }
        }],
        styles: [{
            type: "stylesheet",
            data: {
                href: "src/js/markmap/katex.min.css"
            }
        }]
    };
    const He = "https://cdn.jsdelivr.net/npm/";
    let Ze;
    const Ye = "katex";
    var Ke = {
        name: Ye,
        config: Ge,
        transform(e) {
            const t = (t,r)=>{
                const {katex: n} = window;
                return n ? n.renderToString(t, {
                    displayMode: r,
                    throwOnError: !1
                }) : ((Ze || (Ze = m(Ge.preloadScripts)),
                Ze).then((()=>{
                    e.retransform.call()
                }
                )),
                t)
            }
            ;
            let r = ()=>{}
            ;
            return e.parser.tap((e=>{
                e.use($e),
                e.renderer.rules.katex = (e,n)=>{
                    r();
                    return t(e[n].content, e[n].block)
                }
            }
            )),
            e.beforeParse.tap(((e,t)=>{
                r = ()=>{
                    t.features.katex = !0
                }
            }
            )),
            e.afterParse.tap(((e,t)=>{
                const {frontmatter: r} = t;
                null != r && r.markmap && ["extraJs", "extraCss"].forEach((e=>{
                    r.markmap[e] && (r.markmap[e] = function(e, t, r) {
                        return e.map((e=>("string" == typeof e && (e.startsWith(`${t}/`) ? e = `${He}${t}@${r}${e.slice(t.length)}` : e.startsWith(`${t}@`) && (e = `${He}${e}`)),
                        e)))
                    }(r.markmap[e], Ye, Ge.versions.katex))
                }
                ))
            }
            )),
            {
                styles: Ge.styles,
                scripts: Ge.scripts
            }
        }
    }
      , Je = {
        versions: {
            prismjs: "1.28.0"
        },
        preloadScripts: [{
            type: "script",
            data: {
                src: "prism-core.min.js"
            }
        }, {
            type: "script",
            data: {
                src: "prism-autoloader.min.js"
            }
        }],
        styles: [{
            type: "stylesheet",
            data: {
                href: "src/js/markmap/prism.css"
            }
        }]
    };
    let We;
    function Xe(e, t) {
        (We || (We = m(Je.preloadScripts)),
        We).then((()=>{
            window.Prism.plugins.autoloader.loadLanguages([e], (()=>{
                t.retransform.call()
            }
            ))
        }
        ))
    }
    const Qe = "prism";
    var et = {
        name: Qe,
        config: Je,
        transform(e) {
            let t = ()=>{}
            ;
            return e.parser.tap((r=>{
                r.set({
                    highlight: (r,n)=>{
                        var i;
                        t();
                        const {Prism: o} = window
                          , s = null == o || null == (i = o.languages) ? void 0 : i[n];
                        return s ? o.highlight(r, s, n) : (Xe(n, e),
                        "")
                    }
                })
            }
            )),
            e.beforeParse.tap(((e,r)=>{
                t = ()=>{
                    r.features.prism = !0
                }
            }
            )),
            {
                styles: Je.styles
            }
        }
    };
    /*! js-yaml 4.1.0 https://github.com/nodeca/js-yaml @license MIT */
    function tt(e) {
        return null == e
    }
    var rt = {
        isNothing: tt,
        isObject: function(e) {
            return "object" == typeof e && null !== e
        },
        toArray: function(e) {
            return Array.isArray(e) ? e : tt(e) ? [] : [e]
        },
        repeat: function(e, t) {
            var r, n = "";
            for (r = 0; r < t; r += 1)
                n += e;
            return n
        },
        isNegativeZero: function(e) {
            return 0 === e && Number.NEGATIVE_INFINITY === 1 / e
        },
        extend: function(e, t) {
            var r, n, i, o;
            if (t)
                for (r = 0,
                n = (o = Object.keys(t)).length; r < n; r += 1)
                    e[i = o[r]] = t[i];
            return e
        }
    };
    function nt(e, t) {
        var r = ""
          , n = e.reason || "(unknown reason)";
        return e.mark ? (e.mark.name && (r += 'in "' + e.mark.name + '" '),
        r += "(" + (e.mark.line + 1) + ":" + (e.mark.column + 1) + ")",
        !t && e.mark.snippet && (r += "\n\n" + e.mark.snippet),
        n + " " + r) : n
    }
    function it(e, t) {
        Error.call(this),
        this.name = "YAMLException",
        this.reason = e,
        this.mark = t,
        this.message = nt(this, !1),
        Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = (new Error).stack || ""
    }
    it.prototype = Object.create(Error.prototype),
    it.prototype.constructor = it,
    it.prototype.toString = function(e) {
        return this.name + ": " + nt(this, e)
    }
    ;
    var ot = it;
    function st(e, t, r, n, i) {
        var o = ""
          , s = ""
          , a = Math.floor(i / 2) - 1;
        return n - t > a && (t = n - a + (o = " ... ").length),
        r - n > a && (r = n + a - (s = " ...").length),
        {
            str: o + e.slice(t, r).replace(/\t/g, "→") + s,
            pos: n - t + o.length
        }
    }
    function at(e, t) {
        return rt.repeat(" ", t - e.length) + e
    }
    var lt = function(e, t) {
        if (t = Object.create(t || null),
        !e.buffer)
            return null;
        t.maxLength || (t.maxLength = 79),
        "number" != typeof t.indent && (t.indent = 1),
        "number" != typeof t.linesBefore && (t.linesBefore = 3),
        "number" != typeof t.linesAfter && (t.linesAfter = 2);
        for (var r, n = /\r?\n|\r|\0/g, i = [0], o = [], s = -1; r = n.exec(e.buffer); )
            o.push(r.index),
            i.push(r.index + r[0].length),
            e.position <= r.index && s < 0 && (s = i.length - 2);
        s < 0 && (s = i.length - 1);
        var a, l, c = "", p = Math.min(e.line + t.linesAfter, o.length).toString().length, u = t.maxLength - (t.indent + p + 3);
        for (a = 1; a <= t.linesBefore && !(s - a < 0); a++)
            l = st(e.buffer, i[s - a], o[s - a], e.position - (i[s] - i[s - a]), u),
            c = rt.repeat(" ", t.indent) + at((e.line - a + 1).toString(), p) + " | " + l.str + "\n" + c;
        for (l = st(e.buffer, i[s], o[s], e.position, u),
        c += rt.repeat(" ", t.indent) + at((e.line + 1).toString(), p) + " | " + l.str + "\n",
        c += rt.repeat("-", t.indent + p + 3 + l.pos) + "^\n",
        a = 1; a <= t.linesAfter && !(s + a >= o.length); a++)
            l = st(e.buffer, i[s + a], o[s + a], e.position - (i[s] - i[s + a]), u),
            c += rt.repeat(" ", t.indent) + at((e.line + a + 1).toString(), p) + " | " + l.str + "\n";
        return c.replace(/\n$/, "")
    }
      , ct = ["kind", "multi", "resolve", "construct", "instanceOf", "predicate", "represent", "representName", "defaultStyle", "styleAliases"]
      , pt = ["scalar", "sequence", "mapping"];
    var ut = function(e, t) {
        if (t = t || {},
        Object.keys(t).forEach((function(t) {
            if (-1 === ct.indexOf(t))
                throw new ot('Unknown option "' + t + '" is met in definition of "' + e + '" YAML type.')
        }
        )),
        this.options = t,
        this.tag = e,
        this.kind = t.kind || null,
        this.resolve = t.resolve || function() {
            return !0
        }
        ,
        this.construct = t.construct || function(e) {
            return e
        }
        ,
        this.instanceOf = t.instanceOf || null,
        this.predicate = t.predicate || null,
        this.represent = t.represent || null,
        this.representName = t.representName || null,
        this.defaultStyle = t.defaultStyle || null,
        this.multi = t.multi || !1,
        this.styleAliases = function(e) {
            var t = {};
            return null !== e && Object.keys(e).forEach((function(r) {
                e[r].forEach((function(e) {
                    t[String(e)] = r
                }
                ))
            }
            )),
            t
        }(t.styleAliases || null),
        -1 === pt.indexOf(this.kind))
            throw new ot('Unknown kind "' + this.kind + '" is specified for "' + e + '" YAML type.')
    };
    function ft(e, t) {
        var r = [];
        return e[t].forEach((function(e) {
            var t = r.length;
            r.forEach((function(r, n) {
                r.tag === e.tag && r.kind === e.kind && r.multi === e.multi && (t = n)
            }
            )),
            r[t] = e
        }
        )),
        r
    }
    function ht(e) {
        return this.extend(e)
    }
    ht.prototype.extend = function(e) {
        var t = []
          , r = [];
        if (e instanceof ut)
            r.push(e);
        else if (Array.isArray(e))
            r = r.concat(e);
        else {
            if (!e || !Array.isArray(e.implicit) && !Array.isArray(e.explicit))
                throw new ot("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
            e.implicit && (t = t.concat(e.implicit)),
            e.explicit && (r = r.concat(e.explicit))
        }
        t.forEach((function(e) {
            if (!(e instanceof ut))
                throw new ot("Specified list of YAML types (or a single Type object) contains a non-Type object.");
            if (e.loadKind && "scalar" !== e.loadKind)
                throw new ot("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
            if (e.multi)
                throw new ot("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.")
        }
        )),
        r.forEach((function(e) {
            if (!(e instanceof ut))
                throw new ot("Specified list of YAML types (or a single Type object) contains a non-Type object.")
        }
        ));
        var n = Object.create(ht.prototype);
        return n.implicit = (this.implicit || []).concat(t),
        n.explicit = (this.explicit || []).concat(r),
        n.compiledImplicit = ft(n, "implicit"),
        n.compiledExplicit = ft(n, "explicit"),
        n.compiledTypeMap = function() {
            var e, t, r = {
                scalar: {},
                sequence: {},
                mapping: {},
                fallback: {},
                multi: {
                    scalar: [],
                    sequence: [],
                    mapping: [],
                    fallback: []
                }
            };
            function n(e) {
                e.multi ? (r.multi[e.kind].push(e),
                r.multi.fallback.push(e)) : r[e.kind][e.tag] = r.fallback[e.tag] = e
            }
            for (e = 0,
            t = arguments.length; e < t; e += 1)
                arguments[e].forEach(n);
            return r
        }(n.compiledImplicit, n.compiledExplicit),
        n
    }
    ;
    var dt = ht
      , gt = new ut("tag:yaml.org,2002:str",{
        kind: "scalar",
        construct: function(e) {
            return null !== e ? e : ""
        }
    })
      , mt = new ut("tag:yaml.org,2002:seq",{
        kind: "sequence",
        construct: function(e) {
            return null !== e ? e : []
        }
    })
      , bt = new ut("tag:yaml.org,2002:map",{
        kind: "mapping",
        construct: function(e) {
            return null !== e ? e : {}
        }
    })
      , vt = new dt({
        explicit: [gt, mt, bt]
    });
    var kt = new ut("tag:yaml.org,2002:null",{
        kind: "scalar",
        resolve: function(e) {
            if (null === e)
                return !0;
            var t = e.length;
            return 1 === t && "~" === e || 4 === t && ("null" === e || "Null" === e || "NULL" === e)
        },
        construct: function() {
            return null
        },
        predicate: function(e) {
            return null === e
        },
        represent: {
            canonical: function() {
                return "~"
            },
            lowercase: function() {
                return "null"
            },
            uppercase: function() {
                return "NULL"
            },
            camelcase: function() {
                return "Null"
            },
            empty: function() {
                return ""
            }
        },
        defaultStyle: "lowercase"
    });
    var yt = new ut("tag:yaml.org,2002:bool",{
        kind: "scalar",
        resolve: function(e) {
            if (null === e)
                return !1;
            var t = e.length;
            return 4 === t && ("true" === e || "True" === e || "TRUE" === e) || 5 === t && ("false" === e || "False" === e || "FALSE" === e)
        },
        construct: function(e) {
            return "true" === e || "True" === e || "TRUE" === e
        },
        predicate: function(e) {
            return "[object Boolean]" === Object.prototype.toString.call(e)
        },
        represent: {
            lowercase: function(e) {
                return e ? "true" : "false"
            },
            uppercase: function(e) {
                return e ? "TRUE" : "FALSE"
            },
            camelcase: function(e) {
                return e ? "True" : "False"
            }
        },
        defaultStyle: "lowercase"
    });
    function At(e) {
        return 48 <= e && e <= 55
    }
    function wt(e) {
        return 48 <= e && e <= 57
    }
    var xt = new ut("tag:yaml.org,2002:int",{
        kind: "scalar",
        resolve: function(e) {
            if (null === e)
                return !1;
            var t, r, n = e.length, i = 0, o = !1;
            if (!n)
                return !1;
            if ("-" !== (t = e[i]) && "+" !== t || (t = e[++i]),
            "0" === t) {
                if (i + 1 === n)
                    return !0;
                if ("b" === (t = e[++i])) {
                    for (i++; i < n; i++)
                        if ("_" !== (t = e[i])) {
                            if ("0" !== t && "1" !== t)
                                return !1;
                            o = !0
                        }
                    return o && "_" !== t
                }
                if ("x" === t) {
                    for (i++; i < n; i++)
                        if ("_" !== (t = e[i])) {
                            if (!(48 <= (r = e.charCodeAt(i)) && r <= 57 || 65 <= r && r <= 70 || 97 <= r && r <= 102))
                                return !1;
                            o = !0
                        }
                    return o && "_" !== t
                }
                if ("o" === t) {
                    for (i++; i < n; i++)
                        if ("_" !== (t = e[i])) {
                            if (!At(e.charCodeAt(i)))
                                return !1;
                            o = !0
                        }
                    return o && "_" !== t
                }
            }
            if ("_" === t)
                return !1;
            for (; i < n; i++)
                if ("_" !== (t = e[i])) {
                    if (!wt(e.charCodeAt(i)))
                        return !1;
                    o = !0
                }
            return !(!o || "_" === t)
        },
        construct: function(e) {
            var t, r = e, n = 1;
            if (-1 !== r.indexOf("_") && (r = r.replace(/_/g, "")),
            "-" !== (t = r[0]) && "+" !== t || ("-" === t && (n = -1),
            t = (r = r.slice(1))[0]),
            "0" === r)
                return 0;
            if ("0" === t) {
                if ("b" === r[1])
                    return n * parseInt(r.slice(2), 2);
                if ("x" === r[1])
                    return n * parseInt(r.slice(2), 16);
                if ("o" === r[1])
                    return n * parseInt(r.slice(2), 8)
            }
            return n * parseInt(r, 10)
        },
        predicate: function(e) {
            return "[object Number]" === Object.prototype.toString.call(e) && e % 1 == 0 && !rt.isNegativeZero(e)
        },
        represent: {
            binary: function(e) {
                return e >= 0 ? "0b" + e.toString(2) : "-0b" + e.toString(2).slice(1)
            },
            octal: function(e) {
                return e >= 0 ? "0o" + e.toString(8) : "-0o" + e.toString(8).slice(1)
            },
            decimal: function(e) {
                return e.toString(10)
            },
            hexadecimal: function(e) {
                return e >= 0 ? "0x" + e.toString(16).toUpperCase() : "-0x" + e.toString(16).toUpperCase().slice(1)
            }
        },
        defaultStyle: "decimal",
        styleAliases: {
            binary: [2, "bin"],
            octal: [8, "oct"],
            decimal: [10, "dec"],
            hexadecimal: [16, "hex"]
        }
    })
      , _t = new RegExp("^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
    var Ct = /^[-+]?[0-9]+e/;
    var qt = new ut("tag:yaml.org,2002:float",{
        kind: "scalar",
        resolve: function(e) {
            return null !== e && !(!_t.test(e) || "_" === e[e.length - 1])
        },
        construct: function(e) {
            var t, r;
            return r = "-" === (t = e.replace(/_/g, "").toLowerCase())[0] ? -1 : 1,
            "+-".indexOf(t[0]) >= 0 && (t = t.slice(1)),
            ".inf" === t ? 1 === r ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : ".nan" === t ? NaN : r * parseFloat(t, 10)
        },
        predicate: function(e) {
            return "[object Number]" === Object.prototype.toString.call(e) && (e % 1 != 0 || rt.isNegativeZero(e))
        },
        represent: function(e, t) {
            var r;
            if (isNaN(e))
                switch (t) {
                case "lowercase":
                    return ".nan";
                case "uppercase":
                    return ".NAN";
                case "camelcase":
                    return ".NaN"
                }
            else if (Number.POSITIVE_INFINITY === e)
                switch (t) {
                case "lowercase":
                    return ".inf";
                case "uppercase":
                    return ".INF";
                case "camelcase":
                    return ".Inf"
                }
            else if (Number.NEGATIVE_INFINITY === e)
                switch (t) {
                case "lowercase":
                    return "-.inf";
                case "uppercase":
                    return "-.INF";
                case "camelcase":
                    return "-.Inf"
                }
            else if (rt.isNegativeZero(e))
                return "-0.0";
            return r = e.toString(10),
            Ct.test(r) ? r.replace("e", ".e") : r
        },
        defaultStyle: "lowercase"
    })
      , St = vt.extend({
        implicit: [kt, yt, xt, qt]
    })
      , Et = St
      , Mt = new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$")
      , Lt = new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");
    var Tt = new ut("tag:yaml.org,2002:timestamp",{
        kind: "scalar",
        resolve: function(e) {
            return null !== e && (null !== Mt.exec(e) || null !== Lt.exec(e))
        },
        construct: function(e) {
            var t, r, n, i, o, s, a, l, c = 0, p = null;
            if (null === (t = Mt.exec(e)) && (t = Lt.exec(e)),
            null === t)
                throw new Error("Date resolve error");
            if (r = +t[1],
            n = +t[2] - 1,
            i = +t[3],
            !t[4])
                return new Date(Date.UTC(r, n, i));
            if (o = +t[4],
            s = +t[5],
            a = +t[6],
            t[7]) {
                for (c = t[7].slice(0, 3); c.length < 3; )
                    c += "0";
                c = +c
            }
            return t[9] && (p = 6e4 * (60 * +t[10] + +(t[11] || 0)),
            "-" === t[9] && (p = -p)),
            l = new Date(Date.UTC(r, n, i, o, s, a, c)),
            p && l.setTime(l.getTime() - p),
            l
        },
        instanceOf: Date,
        represent: function(e) {
            return e.toISOString()
        }
    });
    var It = new ut("tag:yaml.org,2002:merge",{
        kind: "scalar",
        resolve: function(e) {
            return "<<" === e || null === e
        }
    })
      , Ot = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
    var Nt = new ut("tag:yaml.org,2002:binary",{
        kind: "scalar",
        resolve: function(e) {
            if (null === e)
                return !1;
            var t, r, n = 0, i = e.length, o = Ot;
            for (r = 0; r < i; r++)
                if (!((t = o.indexOf(e.charAt(r))) > 64)) {
                    if (t < 0)
                        return !1;
                    n += 6
                }
            return n % 8 == 0
        },
        construct: function(e) {
            var t, r, n = e.replace(/[\r\n=]/g, ""), i = n.length, o = Ot, s = 0, a = [];
            for (t = 0; t < i; t++)
                t % 4 == 0 && t && (a.push(s >> 16 & 255),
                a.push(s >> 8 & 255),
                a.push(255 & s)),
                s = s << 6 | o.indexOf(n.charAt(t));
            return 0 === (r = i % 4 * 6) ? (a.push(s >> 16 & 255),
            a.push(s >> 8 & 255),
            a.push(255 & s)) : 18 === r ? (a.push(s >> 10 & 255),
            a.push(s >> 2 & 255)) : 12 === r && a.push(s >> 4 & 255),
            new Uint8Array(a)
        },
        predicate: function(e) {
            return "[object Uint8Array]" === Object.prototype.toString.call(e)
        },
        represent: function(e) {
            var t, r, n = "", i = 0, o = e.length, s = Ot;
            for (t = 0; t < o; t++)
                t % 3 == 0 && t && (n += s[i >> 18 & 63],
                n += s[i >> 12 & 63],
                n += s[i >> 6 & 63],
                n += s[63 & i]),
                i = (i << 8) + e[t];
            return 0 === (r = o % 3) ? (n += s[i >> 18 & 63],
            n += s[i >> 12 & 63],
            n += s[i >> 6 & 63],
            n += s[63 & i]) : 2 === r ? (n += s[i >> 10 & 63],
            n += s[i >> 4 & 63],
            n += s[i << 2 & 63],
            n += s[64]) : 1 === r && (n += s[i >> 2 & 63],
            n += s[i << 4 & 63],
            n += s[64],
            n += s[64]),
            n
        }
    })
      , jt = Object.prototype.hasOwnProperty
      , Dt = Object.prototype.toString;
    var Rt = new ut("tag:yaml.org,2002:omap",{
        kind: "sequence",
        resolve: function(e) {
            if (null === e)
                return !0;
            var t, r, n, i, o, s = [], a = e;
            for (t = 0,
            r = a.length; t < r; t += 1) {
                if (n = a[t],
                o = !1,
                "[object Object]" !== Dt.call(n))
                    return !1;
                for (i in n)
                    if (jt.call(n, i)) {
                        if (o)
                            return !1;
                        o = !0
                    }
                if (!o)
                    return !1;
                if (-1 !== s.indexOf(i))
                    return !1;
                s.push(i)
            }
            return !0
        },
        construct: function(e) {
            return null !== e ? e : []
        }
    })
      , Ut = Object.prototype.toString;
    var Ft = new ut("tag:yaml.org,2002:pairs",{
        kind: "sequence",
        resolve: function(e) {
            if (null === e)
                return !0;
            var t, r, n, i, o, s = e;
            for (o = new Array(s.length),
            t = 0,
            r = s.length; t < r; t += 1) {
                if (n = s[t],
                "[object Object]" !== Ut.call(n))
                    return !1;
                if (1 !== (i = Object.keys(n)).length)
                    return !1;
                o[t] = [i[0], n[i[0]]]
            }
            return !0
        },
        construct: function(e) {
            if (null === e)
                return [];
            var t, r, n, i, o, s = e;
            for (o = new Array(s.length),
            t = 0,
            r = s.length; t < r; t += 1)
                n = s[t],
                i = Object.keys(n),
                o[t] = [i[0], n[i[0]]];
            return o
        }
    })
      , zt = Object.prototype.hasOwnProperty;
    var Pt = new ut("tag:yaml.org,2002:set",{
        kind: "mapping",
        resolve: function(e) {
            if (null === e)
                return !0;
            var t, r = e;
            for (t in r)
                if (zt.call(r, t) && null !== r[t])
                    return !1;
            return !0
        },
        construct: function(e) {
            return null !== e ? e : {}
        }
    })
      , Bt = Et.extend({
        implicit: [Tt, It],
        explicit: [Nt, Rt, Ft, Pt]
    })
      , Vt = Object.prototype.hasOwnProperty
      , $t = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/
      , Gt = /[\x85\u2028\u2029]/
      , Ht = /[,\[\]\{\}]/
      , Zt = /^(?:!|!!|![a-z\-]+!)$/i
      , Yt = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
    function Kt(e) {
        return Object.prototype.toString.call(e)
    }
    function Jt(e) {
        return 10 === e || 13 === e
    }
    function Wt(e) {
        return 9 === e || 32 === e
    }
    function Xt(e) {
        return 9 === e || 32 === e || 10 === e || 13 === e
    }
    function Qt(e) {
        return 44 === e || 91 === e || 93 === e || 123 === e || 125 === e
    }
    function er(e) {
        var t;
        return 48 <= e && e <= 57 ? e - 48 : 97 <= (t = 32 | e) && t <= 102 ? t - 97 + 10 : -1
    }
    function tr(e) {
        return 48 === e ? "\0" : 97 === e ? "" : 98 === e ? "\b" : 116 === e || 9 === e ? "\t" : 110 === e ? "\n" : 118 === e ? "\v" : 102 === e ? "\f" : 114 === e ? "\r" : 101 === e ? "" : 32 === e ? " " : 34 === e ? '"' : 47 === e ? "/" : 92 === e ? "\\" : 78 === e ? "" : 95 === e ? " " : 76 === e ? "\u2028" : 80 === e ? "\u2029" : ""
    }
    function rr(e) {
        return e <= 65535 ? String.fromCharCode(e) : String.fromCharCode(55296 + (e - 65536 >> 10), 56320 + (e - 65536 & 1023))
    }
    for (var nr = new Array(256), ir = new Array(256), or = 0; or < 256; or++)
        nr[or] = tr(or) ? 1 : 0,
        ir[or] = tr(or);
    function sr(e, t) {
        this.input = e,
        this.filename = t.filename || null,
        this.schema = t.schema || Bt,
        this.onWarning = t.onWarning || null,
        this.legacy = t.legacy || !1,
        this.json = t.json || !1,
        this.listener = t.listener || null,
        this.implicitTypes = this.schema.compiledImplicit,
        this.typeMap = this.schema.compiledTypeMap,
        this.length = e.length,
        this.position = 0,
        this.line = 0,
        this.lineStart = 0,
        this.lineIndent = 0,
        this.firstTabInLine = -1,
        this.documents = []
    }
    function ar(e, t) {
        var r = {
            name: e.filename,
            buffer: e.input.slice(0, -1),
            position: e.position,
            line: e.line,
            column: e.position - e.lineStart
        };
        return r.snippet = lt(r),
        new ot(t,r)
    }
    function lr(e, t) {
        throw ar(e, t)
    }
    function cr(e, t) {
        e.onWarning && e.onWarning.call(null, ar(e, t))
    }
    var pr = {
        YAML: function(e, t, r) {
            var n, i, o;
            null !== e.version && lr(e, "duplication of %YAML directive"),
            1 !== r.length && lr(e, "YAML directive accepts exactly one argument"),
            null === (n = /^([0-9]+)\.([0-9]+)$/.exec(r[0])) && lr(e, "ill-formed argument of the YAML directive"),
            i = parseInt(n[1], 10),
            o = parseInt(n[2], 10),
            1 !== i && lr(e, "unacceptable YAML version of the document"),
            e.version = r[0],
            e.checkLineBreaks = o < 2,
            1 !== o && 2 !== o && cr(e, "unsupported YAML version of the document")
        },
        TAG: function(e, t, r) {
            var n, i;
            2 !== r.length && lr(e, "TAG directive accepts exactly two arguments"),
            n = r[0],
            i = r[1],
            Zt.test(n) || lr(e, "ill-formed tag handle (first argument) of the TAG directive"),
            Vt.call(e.tagMap, n) && lr(e, 'there is a previously declared suffix for "' + n + '" tag handle'),
            Yt.test(i) || lr(e, "ill-formed tag prefix (second argument) of the TAG directive");
            try {
                i = decodeURIComponent(i)
            } catch (t) {
                lr(e, "tag prefix is malformed: " + i)
            }
            e.tagMap[n] = i
        }
    };
    function ur(e, t, r, n) {
        var i, o, s, a;
        if (t < r) {
            if (a = e.input.slice(t, r),
            n)
                for (i = 0,
                o = a.length; i < o; i += 1)
                    9 === (s = a.charCodeAt(i)) || 32 <= s && s <= 1114111 || lr(e, "expected valid JSON character");
            else
                $t.test(a) && lr(e, "the stream contains non-printable characters");
            e.result += a
        }
    }
    function fr(e, t, r, n) {
        var i, o, s, a;
        for (rt.isObject(r) || lr(e, "cannot merge mappings; the provided source object is unacceptable"),
        s = 0,
        a = (i = Object.keys(r)).length; s < a; s += 1)
            o = i[s],
            Vt.call(t, o) || (t[o] = r[o],
            n[o] = !0)
    }
    function hr(e, t, r, n, i, o, s, a, l) {
        var c, p;
        if (Array.isArray(i))
            for (c = 0,
            p = (i = Array.prototype.slice.call(i)).length; c < p; c += 1)
                Array.isArray(i[c]) && lr(e, "nested arrays are not supported inside keys"),
                "object" == typeof i && "[object Object]" === Kt(i[c]) && (i[c] = "[object Object]");
        if ("object" == typeof i && "[object Object]" === Kt(i) && (i = "[object Object]"),
        i = String(i),
        null === t && (t = {}),
        "tag:yaml.org,2002:merge" === n)
            if (Array.isArray(o))
                for (c = 0,
                p = o.length; c < p; c += 1)
                    fr(e, t, o[c], r);
            else
                fr(e, t, o, r);
        else
            e.json || Vt.call(r, i) || !Vt.call(t, i) || (e.line = s || e.line,
            e.lineStart = a || e.lineStart,
            e.position = l || e.position,
            lr(e, "duplicated mapping key")),
            "__proto__" === i ? Object.defineProperty(t, i, {
                configurable: !0,
                enumerable: !0,
                writable: !0,
                value: o
            }) : t[i] = o,
            delete r[i];
        return t
    }
    function dr(e) {
        var t;
        10 === (t = e.input.charCodeAt(e.position)) ? e.position++ : 13 === t ? (e.position++,
        10 === e.input.charCodeAt(e.position) && e.position++) : lr(e, "a line break is expected"),
        e.line += 1,
        e.lineStart = e.position,
        e.firstTabInLine = -1
    }
    function gr(e, t, r) {
        for (var n = 0, i = e.input.charCodeAt(e.position); 0 !== i; ) {
            for (; Wt(i); )
                9 === i && -1 === e.firstTabInLine && (e.firstTabInLine = e.position),
                i = e.input.charCodeAt(++e.position);
            if (t && 35 === i)
                do {
                    i = e.input.charCodeAt(++e.position)
                } while (10 !== i && 13 !== i && 0 !== i);
            if (!Jt(i))
                break;
            for (dr(e),
            i = e.input.charCodeAt(e.position),
            n++,
            e.lineIndent = 0; 32 === i; )
                e.lineIndent++,
                i = e.input.charCodeAt(++e.position)
        }
        return -1 !== r && 0 !== n && e.lineIndent < r && cr(e, "deficient indentation"),
        n
    }
    function mr(e) {
        var t, r = e.position;
        return !(45 !== (t = e.input.charCodeAt(r)) && 46 !== t || t !== e.input.charCodeAt(r + 1) || t !== e.input.charCodeAt(r + 2) || (r += 3,
        0 !== (t = e.input.charCodeAt(r)) && !Xt(t)))
    }
    function br(e, t) {
        1 === t ? e.result += " " : t > 1 && (e.result += rt.repeat("\n", t - 1))
    }
    function vr(e, t) {
        var r, n, i = e.tag, o = e.anchor, s = [], a = !1;
        if (-1 !== e.firstTabInLine)
            return !1;
        for (null !== e.anchor && (e.anchorMap[e.anchor] = s),
        n = e.input.charCodeAt(e.position); 0 !== n && (-1 !== e.firstTabInLine && (e.position = e.firstTabInLine,
        lr(e, "tab characters must not be used in indentation")),
        45 === n) && Xt(e.input.charCodeAt(e.position + 1)); )
            if (a = !0,
            e.position++,
            gr(e, !0, -1) && e.lineIndent <= t)
                s.push(null),
                n = e.input.charCodeAt(e.position);
            else if (r = e.line,
            Ar(e, t, 3, !1, !0),
            s.push(e.result),
            gr(e, !0, -1),
            n = e.input.charCodeAt(e.position),
            (e.line === r || e.lineIndent > t) && 0 !== n)
                lr(e, "bad indentation of a sequence entry");
            else if (e.lineIndent < t)
                break;
        return !!a && (e.tag = i,
        e.anchor = o,
        e.kind = "sequence",
        e.result = s,
        !0)
    }
    function kr(e) {
        var t, r, n, i, o = !1, s = !1;
        if (33 !== (i = e.input.charCodeAt(e.position)))
            return !1;
        if (null !== e.tag && lr(e, "duplication of a tag property"),
        60 === (i = e.input.charCodeAt(++e.position)) ? (o = !0,
        i = e.input.charCodeAt(++e.position)) : 33 === i ? (s = !0,
        r = "!!",
        i = e.input.charCodeAt(++e.position)) : r = "!",
        t = e.position,
        o) {
            do {
                i = e.input.charCodeAt(++e.position)
            } while (0 !== i && 62 !== i);
            e.position < e.length ? (n = e.input.slice(t, e.position),
            i = e.input.charCodeAt(++e.position)) : lr(e, "unexpected end of the stream within a verbatim tag")
        } else {
            for (; 0 !== i && !Xt(i); )
                33 === i && (s ? lr(e, "tag suffix cannot contain exclamation marks") : (r = e.input.slice(t - 1, e.position + 1),
                Zt.test(r) || lr(e, "named tag handle cannot contain such characters"),
                s = !0,
                t = e.position + 1)),
                i = e.input.charCodeAt(++e.position);
            n = e.input.slice(t, e.position),
            Ht.test(n) && lr(e, "tag suffix cannot contain flow indicator characters")
        }
        n && !Yt.test(n) && lr(e, "tag name cannot contain such characters: " + n);
        try {
            n = decodeURIComponent(n)
        } catch (t) {
            lr(e, "tag name is malformed: " + n)
        }
        return o ? e.tag = n : Vt.call(e.tagMap, r) ? e.tag = e.tagMap[r] + n : "!" === r ? e.tag = "!" + n : "!!" === r ? e.tag = "tag:yaml.org,2002:" + n : lr(e, 'undeclared tag handle "' + r + '"'),
        !0
    }
    function yr(e) {
        var t, r;
        if (38 !== (r = e.input.charCodeAt(e.position)))
            return !1;
        for (null !== e.anchor && lr(e, "duplication of an anchor property"),
        r = e.input.charCodeAt(++e.position),
        t = e.position; 0 !== r && !Xt(r) && !Qt(r); )
            r = e.input.charCodeAt(++e.position);
        return e.position === t && lr(e, "name of an anchor node must contain at least one character"),
        e.anchor = e.input.slice(t, e.position),
        !0
    }
    function Ar(e, t, r, n, i) {
        var o, s, a, l, c, p, u, f, h, d = 1, g = !1, m = !1;
        if (null !== e.listener && e.listener("open", e),
        e.tag = null,
        e.anchor = null,
        e.kind = null,
        e.result = null,
        o = s = a = 4 === r || 3 === r,
        n && gr(e, !0, -1) && (g = !0,
        e.lineIndent > t ? d = 1 : e.lineIndent === t ? d = 0 : e.lineIndent < t && (d = -1)),
        1 === d)
            for (; kr(e) || yr(e); )
                gr(e, !0, -1) ? (g = !0,
                a = o,
                e.lineIndent > t ? d = 1 : e.lineIndent === t ? d = 0 : e.lineIndent < t && (d = -1)) : a = !1;
        if (a && (a = g || i),
        1 !== d && 4 !== r || (f = 1 === r || 2 === r ? t : t + 1,
        h = e.position - e.lineStart,
        1 === d ? a && (vr(e, h) || function(e, t, r) {
            var n, i, o, s, a, l, c, p = e.tag, u = e.anchor, f = {}, h = Object.create(null), d = null, g = null, m = null, b = !1, v = !1;
            if (-1 !== e.firstTabInLine)
                return !1;
            for (null !== e.anchor && (e.anchorMap[e.anchor] = f),
            c = e.input.charCodeAt(e.position); 0 !== c; ) {
                if (b || -1 === e.firstTabInLine || (e.position = e.firstTabInLine,
                lr(e, "tab characters must not be used in indentation")),
                n = e.input.charCodeAt(e.position + 1),
                o = e.line,
                63 !== c && 58 !== c || !Xt(n)) {
                    if (s = e.line,
                    a = e.lineStart,
                    l = e.position,
                    !Ar(e, r, 2, !1, !0))
                        break;
                    if (e.line === o) {
                        for (c = e.input.charCodeAt(e.position); Wt(c); )
                            c = e.input.charCodeAt(++e.position);
                        if (58 === c)
                            Xt(c = e.input.charCodeAt(++e.position)) || lr(e, "a whitespace character is expected after the key-value separator within a block mapping"),
                            b && (hr(e, f, h, d, g, null, s, a, l),
                            d = g = m = null),
                            v = !0,
                            b = !1,
                            i = !1,
                            d = e.tag,
                            g = e.result;
                        else {
                            if (!v)
                                return e.tag = p,
                                e.anchor = u,
                                !0;
                            lr(e, "can not read an implicit mapping pair; a colon is missed")
                        }
                    } else {
                        if (!v)
                            return e.tag = p,
                            e.anchor = u,
                            !0;
                        lr(e, "can not read a block mapping entry; a multiline key may not be an implicit key")
                    }
                } else
                    63 === c ? (b && (hr(e, f, h, d, g, null, s, a, l),
                    d = g = m = null),
                    v = !0,
                    b = !0,
                    i = !0) : b ? (b = !1,
                    i = !0) : lr(e, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line"),
                    e.position += 1,
                    c = n;
                if ((e.line === o || e.lineIndent > t) && (b && (s = e.line,
                a = e.lineStart,
                l = e.position),
                Ar(e, t, 4, !0, i) && (b ? g = e.result : m = e.result),
                b || (hr(e, f, h, d, g, m, s, a, l),
                d = g = m = null),
                gr(e, !0, -1),
                c = e.input.charCodeAt(e.position)),
                (e.line === o || e.lineIndent > t) && 0 !== c)
                    lr(e, "bad indentation of a mapping entry");
                else if (e.lineIndent < t)
                    break
            }
            return b && hr(e, f, h, d, g, null, s, a, l),
            v && (e.tag = p,
            e.anchor = u,
            e.kind = "mapping",
            e.result = f),
            v
        }(e, h, f)) || function(e, t) {
            var r, n, i, o, s, a, l, c, p, u, f, h, d = !0, g = e.tag, m = e.anchor, b = Object.create(null);
            if (91 === (h = e.input.charCodeAt(e.position)))
                s = 93,
                c = !1,
                o = [];
            else {
                if (123 !== h)
                    return !1;
                s = 125,
                c = !0,
                o = {}
            }
            for (null !== e.anchor && (e.anchorMap[e.anchor] = o),
            h = e.input.charCodeAt(++e.position); 0 !== h; ) {
                if (gr(e, !0, t),
                (h = e.input.charCodeAt(e.position)) === s)
                    return e.position++,
                    e.tag = g,
                    e.anchor = m,
                    e.kind = c ? "mapping" : "sequence",
                    e.result = o,
                    !0;
                d ? 44 === h && lr(e, "expected the node content, but found ','") : lr(e, "missed comma between flow collection entries"),
                f = null,
                a = l = !1,
                63 === h && Xt(e.input.charCodeAt(e.position + 1)) && (a = l = !0,
                e.position++,
                gr(e, !0, t)),
                r = e.line,
                n = e.lineStart,
                i = e.position,
                Ar(e, t, 1, !1, !0),
                u = e.tag,
                p = e.result,
                gr(e, !0, t),
                h = e.input.charCodeAt(e.position),
                !l && e.line !== r || 58 !== h || (a = !0,
                h = e.input.charCodeAt(++e.position),
                gr(e, !0, t),
                Ar(e, t, 1, !1, !0),
                f = e.result),
                c ? hr(e, o, b, u, p, f, r, n, i) : a ? o.push(hr(e, null, b, u, p, f, r, n, i)) : o.push(p),
                gr(e, !0, t),
                44 === (h = e.input.charCodeAt(e.position)) ? (d = !0,
                h = e.input.charCodeAt(++e.position)) : d = !1
            }
            lr(e, "unexpected end of the stream within a flow collection")
        }(e, f) ? m = !0 : (s && function(e, t) {
            var r, n, i, o, s, a = 1, l = !1, c = !1, p = t, u = 0, f = !1;
            if (124 === (o = e.input.charCodeAt(e.position)))
                n = !1;
            else {
                if (62 !== o)
                    return !1;
                n = !0
            }
            for (e.kind = "scalar",
            e.result = ""; 0 !== o; )
                if (43 === (o = e.input.charCodeAt(++e.position)) || 45 === o)
                    1 === a ? a = 43 === o ? 3 : 2 : lr(e, "repeat of a chomping mode identifier");
                else {
                    if (!((i = 48 <= (s = o) && s <= 57 ? s - 48 : -1) >= 0))
                        break;
                    0 === i ? lr(e, "bad explicit indentation width of a block scalar; it cannot be less than one") : c ? lr(e, "repeat of an indentation width identifier") : (p = t + i - 1,
                    c = !0)
                }
            if (Wt(o)) {
                do {
                    o = e.input.charCodeAt(++e.position)
                } while (Wt(o));
                if (35 === o)
                    do {
                        o = e.input.charCodeAt(++e.position)
                    } while (!Jt(o) && 0 !== o)
            }
            for (; 0 !== o; ) {
                for (dr(e),
                e.lineIndent = 0,
                o = e.input.charCodeAt(e.position); (!c || e.lineIndent < p) && 32 === o; )
                    e.lineIndent++,
                    o = e.input.charCodeAt(++e.position);
                if (!c && e.lineIndent > p && (p = e.lineIndent),
                Jt(o))
                    u++;
                else {
                    if (e.lineIndent < p) {
                        3 === a ? e.result += rt.repeat("\n", l ? 1 + u : u) : 1 === a && l && (e.result += "\n");
                        break
                    }
                    for (n ? Wt(o) ? (f = !0,
                    e.result += rt.repeat("\n", l ? 1 + u : u)) : f ? (f = !1,
                    e.result += rt.repeat("\n", u + 1)) : 0 === u ? l && (e.result += " ") : e.result += rt.repeat("\n", u) : e.result += rt.repeat("\n", l ? 1 + u : u),
                    l = !0,
                    c = !0,
                    u = 0,
                    r = e.position; !Jt(o) && 0 !== o; )
                        o = e.input.charCodeAt(++e.position);
                    ur(e, r, e.position, !1)
                }
            }
            return !0
        }(e, f) || function(e, t) {
            var r, n, i;
            if (39 !== (r = e.input.charCodeAt(e.position)))
                return !1;
            for (e.kind = "scalar",
            e.result = "",
            e.position++,
            n = i = e.position; 0 !== (r = e.input.charCodeAt(e.position)); )
                if (39 === r) {
                    if (ur(e, n, e.position, !0),
                    39 !== (r = e.input.charCodeAt(++e.position)))
                        return !0;
                    n = e.position,
                    e.position++,
                    i = e.position
                } else
                    Jt(r) ? (ur(e, n, i, !0),
                    br(e, gr(e, !1, t)),
                    n = i = e.position) : e.position === e.lineStart && mr(e) ? lr(e, "unexpected end of the document within a single quoted scalar") : (e.position++,
                    i = e.position);
            lr(e, "unexpected end of the stream within a single quoted scalar")
        }(e, f) || function(e, t) {
            var r, n, i, o, s, a, l;
            if (34 !== (a = e.input.charCodeAt(e.position)))
                return !1;
            for (e.kind = "scalar",
            e.result = "",
            e.position++,
            r = n = e.position; 0 !== (a = e.input.charCodeAt(e.position)); ) {
                if (34 === a)
                    return ur(e, r, e.position, !0),
                    e.position++,
                    !0;
                if (92 === a) {
                    if (ur(e, r, e.position, !0),
                    Jt(a = e.input.charCodeAt(++e.position)))
                        gr(e, !1, t);
                    else if (a < 256 && nr[a])
                        e.result += ir[a],
                        e.position++;
                    else if ((s = 120 === (l = a) ? 2 : 117 === l ? 4 : 85 === l ? 8 : 0) > 0) {
                        for (i = s,
                        o = 0; i > 0; i--)
                            (s = er(a = e.input.charCodeAt(++e.position))) >= 0 ? o = (o << 4) + s : lr(e, "expected hexadecimal character");
                        e.result += rr(o),
                        e.position++
                    } else
                        lr(e, "unknown escape sequence");
                    r = n = e.position
                } else
                    Jt(a) ? (ur(e, r, n, !0),
                    br(e, gr(e, !1, t)),
                    r = n = e.position) : e.position === e.lineStart && mr(e) ? lr(e, "unexpected end of the document within a double quoted scalar") : (e.position++,
                    n = e.position)
            }
            lr(e, "unexpected end of the stream within a double quoted scalar")
        }(e, f) ? m = !0 : !function(e) {
            var t, r, n;
            if (42 !== (n = e.input.charCodeAt(e.position)))
                return !1;
            for (n = e.input.charCodeAt(++e.position),
            t = e.position; 0 !== n && !Xt(n) && !Qt(n); )
                n = e.input.charCodeAt(++e.position);
            return e.position === t && lr(e, "name of an alias node must contain at least one character"),
            r = e.input.slice(t, e.position),
            Vt.call(e.anchorMap, r) || lr(e, 'unidentified alias "' + r + '"'),
            e.result = e.anchorMap[r],
            gr(e, !0, -1),
            !0
        }(e) ? function(e, t, r) {
            var n, i, o, s, a, l, c, p, u = e.kind, f = e.result;
            if (Xt(p = e.input.charCodeAt(e.position)) || Qt(p) || 35 === p || 38 === p || 42 === p || 33 === p || 124 === p || 62 === p || 39 === p || 34 === p || 37 === p || 64 === p || 96 === p)
                return !1;
            if ((63 === p || 45 === p) && (Xt(n = e.input.charCodeAt(e.position + 1)) || r && Qt(n)))
                return !1;
            for (e.kind = "scalar",
            e.result = "",
            i = o = e.position,
            s = !1; 0 !== p; ) {
                if (58 === p) {
                    if (Xt(n = e.input.charCodeAt(e.position + 1)) || r && Qt(n))
                        break
                } else if (35 === p) {
                    if (Xt(e.input.charCodeAt(e.position - 1)))
                        break
                } else {
                    if (e.position === e.lineStart && mr(e) || r && Qt(p))
                        break;
                    if (Jt(p)) {
                        if (a = e.line,
                        l = e.lineStart,
                        c = e.lineIndent,
                        gr(e, !1, -1),
                        e.lineIndent >= t) {
                            s = !0,
                            p = e.input.charCodeAt(e.position);
                            continue
                        }
                        e.position = o,
                        e.line = a,
                        e.lineStart = l,
                        e.lineIndent = c;
                        break
                    }
                }
                s && (ur(e, i, o, !1),
                br(e, e.line - a),
                i = o = e.position,
                s = !1),
                Wt(p) || (o = e.position + 1),
                p = e.input.charCodeAt(++e.position)
            }
            return ur(e, i, o, !1),
            !!e.result || (e.kind = u,
            e.result = f,
            !1)
        }(e, f, 1 === r) && (m = !0,
        null === e.tag && (e.tag = "?")) : (m = !0,
        null === e.tag && null === e.anchor || lr(e, "alias node should not have any properties")),
        null !== e.anchor && (e.anchorMap[e.anchor] = e.result)) : 0 === d && (m = a && vr(e, h))),
        null === e.tag)
            null !== e.anchor && (e.anchorMap[e.anchor] = e.result);
        else if ("?" === e.tag) {
            for (null !== e.result && "scalar" !== e.kind && lr(e, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + e.kind + '"'),
            l = 0,
            c = e.implicitTypes.length; l < c; l += 1)
                if ((u = e.implicitTypes[l]).resolve(e.result)) {
                    e.result = u.construct(e.result),
                    e.tag = u.tag,
                    null !== e.anchor && (e.anchorMap[e.anchor] = e.result);
                    break
                }
        } else if ("!" !== e.tag) {
            if (Vt.call(e.typeMap[e.kind || "fallback"], e.tag))
                u = e.typeMap[e.kind || "fallback"][e.tag];
            else
                for (u = null,
                l = 0,
                c = (p = e.typeMap.multi[e.kind || "fallback"]).length; l < c; l += 1)
                    if (e.tag.slice(0, p[l].tag.length) === p[l].tag) {
                        u = p[l];
                        break
                    }
            u || lr(e, "unknown tag !<" + e.tag + ">"),
            null !== e.result && u.kind !== e.kind && lr(e, "unacceptable node kind for !<" + e.tag + '> tag; it should be "' + u.kind + '", not "' + e.kind + '"'),
            u.resolve(e.result, e.tag) ? (e.result = u.construct(e.result, e.tag),
            null !== e.anchor && (e.anchorMap[e.anchor] = e.result)) : lr(e, "cannot resolve a node with !<" + e.tag + "> explicit tag")
        }
        return null !== e.listener && e.listener("close", e),
        null !== e.tag || null !== e.anchor || m
    }
    function wr(e) {
        var t, r, n, i, o = e.position, s = !1;
        for (e.version = null,
        e.checkLineBreaks = e.legacy,
        e.tagMap = Object.create(null),
        e.anchorMap = Object.create(null); 0 !== (i = e.input.charCodeAt(e.position)) && (gr(e, !0, -1),
        i = e.input.charCodeAt(e.position),
        !(e.lineIndent > 0 || 37 !== i)); ) {
            for (s = !0,
            i = e.input.charCodeAt(++e.position),
            t = e.position; 0 !== i && !Xt(i); )
                i = e.input.charCodeAt(++e.position);
            for (n = [],
            (r = e.input.slice(t, e.position)).length < 1 && lr(e, "directive name must not be less than one character in length"); 0 !== i; ) {
                for (; Wt(i); )
                    i = e.input.charCodeAt(++e.position);
                if (35 === i) {
                    do {
                        i = e.input.charCodeAt(++e.position)
                    } while (0 !== i && !Jt(i));
                    break
                }
                if (Jt(i))
                    break;
                for (t = e.position; 0 !== i && !Xt(i); )
                    i = e.input.charCodeAt(++e.position);
                n.push(e.input.slice(t, e.position))
            }
            0 !== i && dr(e),
            Vt.call(pr, r) ? pr[r](e, r, n) : cr(e, 'unknown document directive "' + r + '"')
        }
        gr(e, !0, -1),
        0 === e.lineIndent && 45 === e.input.charCodeAt(e.position) && 45 === e.input.charCodeAt(e.position + 1) && 45 === e.input.charCodeAt(e.position + 2) ? (e.position += 3,
        gr(e, !0, -1)) : s && lr(e, "directives end mark is expected"),
        Ar(e, e.lineIndent - 1, 4, !1, !0),
        gr(e, !0, -1),
        e.checkLineBreaks && Gt.test(e.input.slice(o, e.position)) && cr(e, "non-ASCII line breaks are interpreted as content"),
        e.documents.push(e.result),
        e.position === e.lineStart && mr(e) ? 46 === e.input.charCodeAt(e.position) && (e.position += 3,
        gr(e, !0, -1)) : e.position < e.length - 1 && lr(e, "end of the stream or a document separator is expected")
    }
    function xr(e, t) {
        t = t || {},
        0 !== (e = String(e)).length && (10 !== e.charCodeAt(e.length - 1) && 13 !== e.charCodeAt(e.length - 1) && (e += "\n"),
        65279 === e.charCodeAt(0) && (e = e.slice(1)));
        var r = new sr(e,t)
          , n = e.indexOf("\0");
        for (-1 !== n && (r.position = n,
        lr(r, "null byte is not allowed in input")),
        r.input += "\0"; 32 === r.input.charCodeAt(r.position); )
            r.lineIndent += 1,
            r.position += 1;
        for (; r.position < r.length - 1; )
            wr(r);
        return r.documents
    }
    var _r = {
        loadAll: function(e, t, r) {
            null !== t && "object" == typeof t && void 0 === r && (r = t,
            t = null);
            var n = xr(e, r);
            if ("function" != typeof t)
                return n;
            for (var i = 0, o = n.length; i < o; i += 1)
                t(n[i])
        },
        load: function(e, t) {
            var r = xr(e, t);
            if (0 !== r.length) {
                if (1 === r.length)
                    return r[0];
                throw new ot("expected a single document in the stream, but found more")
            }
        }
    }
      , Cr = Object.prototype.toString
      , qr = Object.prototype.hasOwnProperty
      , Sr = 65279
      , Er = {
        0: "\\0",
        7: "\\a",
        8: "\\b",
        9: "\\t",
        10: "\\n",
        11: "\\v",
        12: "\\f",
        13: "\\r",
        27: "\\e",
        34: '\\"',
        92: "\\\\",
        133: "\\N",
        160: "\\_",
        8232: "\\L",
        8233: "\\P"
    }
      , Mr = ["y", "Y", "yes", "Yes", "YES", "on", "On", "ON", "n", "N", "no", "No", "NO", "off", "Off", "OFF"]
      , Lr = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
    function Tr(e) {
        var t, r, n;
        if (t = e.toString(16).toUpperCase(),
        e <= 255)
            r = "x",
            n = 2;
        else if (e <= 65535)
            r = "u",
            n = 4;
        else {
            if (!(e <= 4294967295))
                throw new ot("code point within a string may not be greater than 0xFFFFFFFF");
            r = "U",
            n = 8
        }
        return "\\" + r + rt.repeat("0", n - t.length) + t
    }
    function Ir(e) {
        this.schema = e.schema || Bt,
        this.indent = Math.max(1, e.indent || 2),
        this.noArrayIndent = e.noArrayIndent || !1,
        this.skipInvalid = e.skipInvalid || !1,
        this.flowLevel = rt.isNothing(e.flowLevel) ? -1 : e.flowLevel,
        this.styleMap = function(e, t) {
            var r, n, i, o, s, a, l;
            if (null === t)
                return {};
            for (r = {},
            i = 0,
            o = (n = Object.keys(t)).length; i < o; i += 1)
                s = n[i],
                a = String(t[s]),
                "!!" === s.slice(0, 2) && (s = "tag:yaml.org,2002:" + s.slice(2)),
                (l = e.compiledTypeMap.fallback[s]) && qr.call(l.styleAliases, a) && (a = l.styleAliases[a]),
                r[s] = a;
            return r
        }(this.schema, e.styles || null),
        this.sortKeys = e.sortKeys || !1,
        this.lineWidth = e.lineWidth || 80,
        this.noRefs = e.noRefs || !1,
        this.noCompatMode = e.noCompatMode || !1,
        this.condenseFlow = e.condenseFlow || !1,
        this.quotingType = '"' === e.quotingType ? 2 : 1,
        this.forceQuotes = e.forceQuotes || !1,
        this.replacer = "function" == typeof e.replacer ? e.replacer : null,
        this.implicitTypes = this.schema.compiledImplicit,
        this.explicitTypes = this.schema.compiledExplicit,
        this.tag = null,
        this.result = "",
        this.duplicates = [],
        this.usedDuplicates = null
    }
    function Or(e, t) {
        for (var r, n = rt.repeat(" ", t), i = 0, o = -1, s = "", a = e.length; i < a; )
            -1 === (o = e.indexOf("\n", i)) ? (r = e.slice(i),
            i = a) : (r = e.slice(i, o + 1),
            i = o + 1),
            r.length && "\n" !== r && (s += n),
            s += r;
        return s
    }
    function Nr(e, t) {
        return "\n" + rt.repeat(" ", e.indent * t)
    }
    function jr(e) {
        return 32 === e || 9 === e
    }
    function Dr(e) {
        return 32 <= e && e <= 126 || 161 <= e && e <= 55295 && 8232 !== e && 8233 !== e || 57344 <= e && e <= 65533 && e !== Sr || 65536 <= e && e <= 1114111
    }
    function Rr(e) {
        return Dr(e) && e !== Sr && 13 !== e && 10 !== e
    }
    function Ur(e, t, r) {
        var n = Rr(e)
          , i = n && !jr(e);
        return (r ? n : n && 44 !== e && 91 !== e && 93 !== e && 123 !== e && 125 !== e) && 35 !== e && !(58 === t && !i) || Rr(t) && !jr(t) && 35 === e || 58 === t && i
    }
    function Fr(e, t) {
        var r, n = e.charCodeAt(t);
        return n >= 55296 && n <= 56319 && t + 1 < e.length && (r = e.charCodeAt(t + 1)) >= 56320 && r <= 57343 ? 1024 * (n - 55296) + r - 56320 + 65536 : n
    }
    function zr(e) {
        return /^\n* /.test(e)
    }
    function Pr(e, t, r, n, i, o, s, a) {
        var l, c, p = 0, u = null, f = !1, h = !1, d = -1 !== n, g = -1, m = Dr(c = Fr(e, 0)) && c !== Sr && !jr(c) && 45 !== c && 63 !== c && 58 !== c && 44 !== c && 91 !== c && 93 !== c && 123 !== c && 125 !== c && 35 !== c && 38 !== c && 42 !== c && 33 !== c && 124 !== c && 61 !== c && 62 !== c && 39 !== c && 34 !== c && 37 !== c && 64 !== c && 96 !== c && function(e) {
            return !jr(e) && 58 !== e
        }(Fr(e, e.length - 1));
        if (t || s)
            for (l = 0; l < e.length; p >= 65536 ? l += 2 : l++) {
                if (!Dr(p = Fr(e, l)))
                    return 5;
                m = m && Ur(p, u, a),
                u = p
            }
        else {
            for (l = 0; l < e.length; p >= 65536 ? l += 2 : l++) {
                if (10 === (p = Fr(e, l)))
                    f = !0,
                    d && (h = h || l - g - 1 > n && " " !== e[g + 1],
                    g = l);
                else if (!Dr(p))
                    return 5;
                m = m && Ur(p, u, a),
                u = p
            }
            h = h || d && l - g - 1 > n && " " !== e[g + 1]
        }
        return f || h ? r > 9 && zr(e) ? 5 : s ? 2 === o ? 5 : 2 : h ? 4 : 3 : !m || s || i(e) ? 2 === o ? 5 : 2 : 1
    }
    function Br(e, t, r, n, i) {
        e.dump = function() {
            if (0 === t.length)
                return 2 === e.quotingType ? '""' : "''";
            if (!e.noCompatMode && (-1 !== Mr.indexOf(t) || Lr.test(t)))
                return 2 === e.quotingType ? '"' + t + '"' : "'" + t + "'";
            var o = e.indent * Math.max(1, r)
              , s = -1 === e.lineWidth ? -1 : Math.max(Math.min(e.lineWidth, 40), e.lineWidth - o)
              , a = n || e.flowLevel > -1 && r >= e.flowLevel;
            switch (Pr(t, a, e.indent, s, (function(t) {
                return function(e, t) {
                    var r, n;
                    for (r = 0,
                    n = e.implicitTypes.length; r < n; r += 1)
                        if (e.implicitTypes[r].resolve(t))
                            return !0;
                    return !1
                }(e, t)
            }
            ), e.quotingType, e.forceQuotes && !n, i)) {
            case 1:
                return t;
            case 2:
                return "'" + t.replace(/'/g, "''") + "'";
            case 3:
                return "|" + Vr(t, e.indent) + $r(Or(t, o));
            case 4:
                return ">" + Vr(t, e.indent) + $r(Or(function(e, t) {
                    var r, n, i = /(\n+)([^\n]*)/g, o = (a = e.indexOf("\n"),
                    a = -1 !== a ? a : e.length,
                    i.lastIndex = a,
                    Gr(e.slice(0, a), t)), s = "\n" === e[0] || " " === e[0];
                    var a;
                    for (; n = i.exec(e); ) {
                        var l = n[1]
                          , c = n[2];
                        r = " " === c[0],
                        o += l + (s || r || "" === c ? "" : "\n") + Gr(c, t),
                        s = r
                    }
                    return o
                }(t, s), o));
            case 5:
                return '"' + function(e) {
                    for (var t, r = "", n = 0, i = 0; i < e.length; n >= 65536 ? i += 2 : i++)
                        n = Fr(e, i),
                        !(t = Er[n]) && Dr(n) ? (r += e[i],
                        n >= 65536 && (r += e[i + 1])) : r += t || Tr(n);
                    return r
                }(t) + '"';
            default:
                throw new ot("impossible error: invalid scalar style")
            }
        }()
    }
    function Vr(e, t) {
        var r = zr(e) ? String(t) : ""
          , n = "\n" === e[e.length - 1];
        return r + (n && ("\n" === e[e.length - 2] || "\n" === e) ? "+" : n ? "" : "-") + "\n"
    }
    function $r(e) {
        return "\n" === e[e.length - 1] ? e.slice(0, -1) : e
    }
    function Gr(e, t) {
        if ("" === e || " " === e[0])
            return e;
        for (var r, n, i = / [^ ]/g, o = 0, s = 0, a = 0, l = ""; r = i.exec(e); )
            (a = r.index) - o > t && (n = s > o ? s : a,
            l += "\n" + e.slice(o, n),
            o = n + 1),
            s = a;
        return l += "\n",
        e.length - o > t && s > o ? l += e.slice(o, s) + "\n" + e.slice(s + 1) : l += e.slice(o),
        l.slice(1)
    }
    function Hr(e, t, r, n) {
        var i, o, s, a = "", l = e.tag;
        for (i = 0,
        o = r.length; i < o; i += 1)
            s = r[i],
            e.replacer && (s = e.replacer.call(r, String(i), s)),
            (Yr(e, t + 1, s, !0, !0, !1, !0) || void 0 === s && Yr(e, t + 1, null, !0, !0, !1, !0)) && (n && "" === a || (a += Nr(e, t)),
            e.dump && 10 === e.dump.charCodeAt(0) ? a += "-" : a += "- ",
            a += e.dump);
        e.tag = l,
        e.dump = a || "[]"
    }
    function Zr(e, t, r) {
        var n, i, o, s, a, l;
        for (o = 0,
        s = (i = r ? e.explicitTypes : e.implicitTypes).length; o < s; o += 1)
            if (((a = i[o]).instanceOf || a.predicate) && (!a.instanceOf || "object" == typeof t && t instanceof a.instanceOf) && (!a.predicate || a.predicate(t))) {
                if (r ? a.multi && a.representName ? e.tag = a.representName(t) : e.tag = a.tag : e.tag = "?",
                a.represent) {
                    if (l = e.styleMap[a.tag] || a.defaultStyle,
                    "[object Function]" === Cr.call(a.represent))
                        n = a.represent(t, l);
                    else {
                        if (!qr.call(a.represent, l))
                            throw new ot("!<" + a.tag + '> tag resolver accepts not "' + l + '" style');
                        n = a.represent[l](t, l)
                    }
                    e.dump = n
                }
                return !0
            }
        return !1
    }
    function Yr(e, t, r, n, i, o, s) {
        e.tag = null,
        e.dump = r,
        Zr(e, r, !1) || Zr(e, r, !0);
        var a, l = Cr.call(e.dump), c = n;
        n && (n = e.flowLevel < 0 || e.flowLevel > t);
        var p, u, f = "[object Object]" === l || "[object Array]" === l;
        if (f && (u = -1 !== (p = e.duplicates.indexOf(r))),
        (null !== e.tag && "?" !== e.tag || u || 2 !== e.indent && t > 0) && (i = !1),
        u && e.usedDuplicates[p])
            e.dump = "*ref_" + p;
        else {
            if (f && u && !e.usedDuplicates[p] && (e.usedDuplicates[p] = !0),
            "[object Object]" === l)
                n && 0 !== Object.keys(e.dump).length ? (!function(e, t, r, n) {
                    var i, o, s, a, l, c, p = "", u = e.tag, f = Object.keys(r);
                    if (!0 === e.sortKeys)
                        f.sort();
                    else if ("function" == typeof e.sortKeys)
                        f.sort(e.sortKeys);
                    else if (e.sortKeys)
                        throw new ot("sortKeys must be a boolean or a function");
                    for (i = 0,
                    o = f.length; i < o; i += 1)
                        c = "",
                        n && "" === p || (c += Nr(e, t)),
                        a = r[s = f[i]],
                        e.replacer && (a = e.replacer.call(r, s, a)),
                        Yr(e, t + 1, s, !0, !0, !0) && ((l = null !== e.tag && "?" !== e.tag || e.dump && e.dump.length > 1024) && (e.dump && 10 === e.dump.charCodeAt(0) ? c += "?" : c += "? "),
                        c += e.dump,
                        l && (c += Nr(e, t)),
                        Yr(e, t + 1, a, !0, l) && (e.dump && 10 === e.dump.charCodeAt(0) ? c += ":" : c += ": ",
                        p += c += e.dump));
                    e.tag = u,
                    e.dump = p || "{}"
                }(e, t, e.dump, i),
                u && (e.dump = "&ref_" + p + e.dump)) : (!function(e, t, r) {
                    var n, i, o, s, a, l = "", c = e.tag, p = Object.keys(r);
                    for (n = 0,
                    i = p.length; n < i; n += 1)
                        a = "",
                        "" !== l && (a += ", "),
                        e.condenseFlow && (a += '"'),
                        s = r[o = p[n]],
                        e.replacer && (s = e.replacer.call(r, o, s)),
                        Yr(e, t, o, !1, !1) && (e.dump.length > 1024 && (a += "? "),
                        a += e.dump + (e.condenseFlow ? '"' : "") + ":" + (e.condenseFlow ? "" : " "),
                        Yr(e, t, s, !1, !1) && (l += a += e.dump));
                    e.tag = c,
                    e.dump = "{" + l + "}"
                }(e, t, e.dump),
                u && (e.dump = "&ref_" + p + " " + e.dump));
            else if ("[object Array]" === l)
                n && 0 !== e.dump.length ? (e.noArrayIndent && !s && t > 0 ? Hr(e, t - 1, e.dump, i) : Hr(e, t, e.dump, i),
                u && (e.dump = "&ref_" + p + e.dump)) : (!function(e, t, r) {
                    var n, i, o, s = "", a = e.tag;
                    for (n = 0,
                    i = r.length; n < i; n += 1)
                        o = r[n],
                        e.replacer && (o = e.replacer.call(r, String(n), o)),
                        (Yr(e, t, o, !1, !1) || void 0 === o && Yr(e, t, null, !1, !1)) && ("" !== s && (s += "," + (e.condenseFlow ? "" : " ")),
                        s += e.dump);
                    e.tag = a,
                    e.dump = "[" + s + "]"
                }(e, t, e.dump),
                u && (e.dump = "&ref_" + p + " " + e.dump));
            else {
                if ("[object String]" !== l) {
                    if ("[object Undefined]" === l)
                        return !1;
                    if (e.skipInvalid)
                        return !1;
                    throw new ot("unacceptable kind of an object to dump " + l)
                }
                "?" !== e.tag && Br(e, e.dump, t, o, c)
            }
            null !== e.tag && "?" !== e.tag && (a = encodeURI("!" === e.tag[0] ? e.tag.slice(1) : e.tag).replace(/!/g, "%21"),
            a = "!" === e.tag[0] ? "!" + a : "tag:yaml.org,2002:" === a.slice(0, 18) ? "!!" + a.slice(18) : "!<" + a + ">",
            e.dump = a + " " + e.dump)
        }
        return !0
    }
    function Kr(e, t) {
        var r, n, i = [], o = [];
        for (Jr(e, i, o),
        r = 0,
        n = o.length; r < n; r += 1)
            t.duplicates.push(i[o[r]]);
        t.usedDuplicates = new Array(n)
    }
    function Jr(e, t, r) {
        var n, i, o;
        if (null !== e && "object" == typeof e)
            if (-1 !== (i = t.indexOf(e)))
                -1 === r.indexOf(i) && r.push(i);
            else if (t.push(e),
            Array.isArray(e))
                for (i = 0,
                o = e.length; i < o; i += 1)
                    Jr(e[i], t, r);
            else
                for (i = 0,
                o = (n = Object.keys(e)).length; i < o; i += 1)
                    Jr(e[n[i]], t, r)
    }
    function Wr(e, t) {
        return function() {
            throw new Error("Function yaml." + e + " is removed in js-yaml 4. Use yaml." + t + " instead, which is now safe by default.")
        }
    }
    var Xr = {
        Type: ut,
        Schema: dt,
        FAILSAFE_SCHEMA: vt,
        JSON_SCHEMA: St,
        CORE_SCHEMA: Et,
        DEFAULT_SCHEMA: Bt,
        load: _r.load,
        loadAll: _r.loadAll,
        dump: {
            dump: function(e, t) {
                var r = new Ir(t = t || {});
                r.noRefs || Kr(e, r);
                var n = e;
                return r.replacer && (n = r.replacer.call({
                    "": n
                }, "", n)),
                Yr(r, 0, n, !0, !0) ? r.dump + "\n" : ""
            }
        }.dump,
        YAMLException: ot,
        types: {
            binary: Nt,
            float: qt,
            map: bt,
            null: kt,
            pairs: Ft,
            set: Pt,
            timestamp: Tt,
            bool: yt,
            int: xt,
            merge: It,
            omap: Rt,
            seq: mt,
            str: gt
        },
        safeLoad: Wr("safeLoad", "load"),
        safeLoadAll: Wr("safeLoadAll", "loadAll"),
        safeDump: Wr("safeDump", "dump")
    };
    const Qr = [{
        name: "frontmatter",
        transform: e=>(e.beforeParse.tap(((e,t)=>{
            const r = e.parse;
            e.parse = f(r, {
                before(e) {
                    const [r] = e.args;
                    if (!r.startsWith("---\n"))
                        return;
                    const n = r.indexOf("\n---\n");
                    if (n < 0)
                        return;
                    const i = r.slice(4, n);
                    let o;
                    try {
                        var s;
                        o = Xr.load(i),
                        null != (s = o) && s.markmap && (o.markmap = function(e) {
                            if (!e)
                                return;
                            return ["color", "extraJs", "extraCss"].forEach((t=>{
                                null != e[t] && (e[t] = function(e) {
                                    var t;
                                    let r;
                                    "string" == typeof e ? r = [e] : Array.isArray(e) && (r = e.filter((e=>e && "string" == typeof e)));
                                    return null != (t = r) && t.length ? r : void 0
                                }(e[t]))
                            }
                            )),
                            ["duration", "maxWidth", "initialExpandLevel"].forEach((t=>{
                                null != e[t] && (e[t] = function(e) {
                                    if (isNaN(+e))
                                        return;
                                    return +e
                                }(e[t]))
                            }
                            )),
                            e
                        }(o.markmap))
                    } catch (e) {
                        return
                    }
                    t.frontmatter = o;
                    const a = n + 5;
                    e.args[0] = r.slice(a)
                },
                after() {
                    e.parse = r
                }
            })
        }
        )),
        {})
    }, Ke, et];
    function en(e) {
        if ("heading" === e.type)
            e.children = e.children.filter((e=>"paragraph" !== e.type));
        else if ("list_item" === e.type) {
            var t;
            e.children = e.children.filter((t=>!["paragraph", "fence"].includes(t.type) || (e.content || (e.content = t.content,
            e.payload = i({}, e.payload, t.payload)),
            !1))),
            null != (null == (t = e.payload) ? void 0 : t.index) && (e.content = `${e.payload.index}. ${e.content}`)
        } else if ("ordered_list" === e.type) {
            var r, n;
            let t = null != (r = null == (n = e.payload) ? void 0 : n.startIndex) ? r : 1;
            e.children.forEach((e=>{
                "list_item" === e.type && (e.payload = i({}, e.payload, {
                    index: t
                }),
                t += 1)
            }
            ))
        }
        0 === e.children.length ? delete e.children : (e.children.forEach((e=>en(e))),
        1 !== e.children.length || e.children[0].content || (e.children = e.children[0].children))
    }
    function tn(e, t=0) {
        var r;
        e.depth = t,
        null == (r = e.children) || r.forEach((e=>{
            tn(e, t + 1)
        }
        ))
    }
    e.Transformer = class {
        constructor(e=Qr) {
            this.assetsMap = {},
            this.plugins = e,
            this.hooks = {
                parser: new o,
                beforeParse: new o,
                afterParse: new o,
                htmltag: new o,
                retransform: new o
            };
            const t = {};
            for (const {name: r, transform: n} of e)
                t[r] = n(this.hooks);
            this.assetsMap = t;
            const r = new Ve("full",{
                html: !0,
                breaks: !0,
                maxNesting: 1 / 0
            });
            r.renderer.rules.htmltag = f(r.renderer.rules.htmltag, {
                after: e=>{
                    this.hooks.htmltag.call(e)
                }
            }),
            this.md = r,
            this.hooks.parser.call(r)
        }
        buildTree(e) {
            const {md: t} = this
              , r = {
                type: "root",
                depth: 0,
                content: "",
                children: [],
                payload: {}
            }
              , n = [r];
            let i = 0;
            for (const r of e) {
                let e = n[n.length - 1];
                if (r.type.endsWith("_open")) {
                    const t = r.type.slice(0, -5)
                      , a = {};
                    var o;
                    if (r.lines && (a.lines = r.lines),
                    "heading" === t)
                        for (i = r.hLevel; (null == (s = e) ? void 0 : s.depth) >= i; ) {
                            var s;
                            n.pop(),
                            e = n[n.length - 1]
                        }
                    else
                        i = Math.max(i, (null == (o = e) ? void 0 : o.depth) || 0) + 1,
                        "ordered_list" === t && (a.startIndex = r.order);
                    const l = {
                        type: t,
                        depth: i,
                        payload: a,
                        content: "",
                        children: []
                    };
                    e.children.push(l),
                    n.push(l)
                } else {
                    if (!e)
                        continue;
                    if (r.type === `${e.type}_close`)
                        "heading" === e.type ? i = e.depth : (n.pop(),
                        i = 0);
                    else if ("inline" === r.type) {
                        const n = this.hooks.htmltag.tap((t=>{
                            const r = t.result.match(/^<!--([\s\S]*?)-->$/)
                              , n = null == r ? void 0 : r[1].trim().split(" ");
                            "fold" === n[0] && (e.payload.fold = ["all", "recursively"].includes(n[1]) ? 2 : 1,
                            t.result = "")
                        }
                        ))
                          , i = t.renderer.render([r], t.options, {});
                        n(),
                        e.content = `${e.content || ""}${i}`
                    } else if ("fence" === r.type) {
                        let n = t.renderer.render([r], t.options, {});
                        const o = n.match(/<code( class="[^"]*")>/);
                        o && (n = n.replace("<pre>", `<pre${o[1]}>`)),
                        e.children.push({
                            type: r.type,
                            depth: i + 1,
                            content: n,
                            children: []
                        })
                    }
                }
            }
            return r
        }
        transform(e) {
            var t;
            const r = {
                features: {}
            };
            this.hooks.beforeParse.call(this.md, r);
            const n = this.md.parse(e, {});
            this.hooks.afterParse.call(this.md, r);
            let o = this.buildTree(n);
            return en(o),
            1 === (null == (t = o.children) ? void 0 : t.length) && (o = o.children[0]),
            tn(o),
            i({}, r, {
                root: o
            })
        }
        getAssets(e) {
            const t = []
              , r = [];
            null != e || (e = this.plugins.map((e=>e.name)));
            for (const n of e.map((e=>this.assetsMap[e])))
                n && (n.styles && t.push(...n.styles),
                n.scripts && r.push(...n.scripts));
            return {
                styles: t,
                scripts: r
            }
        }
        getUsedAssets(e) {
            const t = this.plugins.map((e=>e.name)).filter((t=>e[t]));
            return this.getAssets(t)
        }
    }
    ,
    e.builtInPlugins = Qr,
    e.fillTemplate = function(e, t, r) {
        r = i({
            baseJs: b
        }, r);
        const {scripts: n, styles: o} = t
          , a = [...o ? (l = o,
        l.map((e=>"stylesheet" === e.type ? p("link", null, s({
            rel: "stylesheet"
        }, e.data)) : p("style", e.data)))) : []];
        var l;
        const c = {
            getMarkmap: ()=>window.markmap,
            getOptions: r.getOptions,
            jsonOptions: r.jsonOptions,
            root: e
        }
          , f = [...u([...r.baseJs, ...n || [], {
            type: "iife",
            data: {
                fn: (e,t,r,n)=>{
                    const i = e();
                    window.mm = i.Markmap.create("svg#mindmap", (t || i.deriveOptions)(n), r)
                }
                ,
                getParams: ({getMarkmap: e, getOptions: t, root: r, jsonOptions: n})=>[e, t, r, n]
            }
        }], c)];
        return '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<meta http-equiv="X-UA-Compatible" content="ie=edge">\n<title>Markmap</title>\n<style>\n* {\n  margin: 0;\n  padding: 0;\n}\n#mindmap {\n  display: block;\n  width: 100vw;\n  height: 100vh;\n}\n</style>\n\x3c!--CSS--\x3e\n</head>\n<body>\n<svg id="mindmap"></svg>\n\x3c!--JS--\x3e\n</body>\n</html>\n'.replace("\x3c!--CSS--\x3e", (()=>a.join(""))).replace("\x3c!--JS--\x3e", (()=>f.join("")))
    }
    ,
    e.transformerVersions = {
        "markmap-lib": "0.14.3",
        d3: "6.7.0"
    }
}
));


/*! markmap-view v0.14.3 | MIT License */
!function(t, e) {
    "use strict";
    function n(t) {
        if (t && t.__esModule)
            return t;
        var e = Object.create(null);
        if (t)
            for (var n in t)
                e[n] = t[n];
        return e.default = t,
        Object.freeze(e)
    }
    var r = n(e);
    /*! markmap-common v0.14.2 | MIT License */
    class i {
        constructor() {
            this.listeners = []
        }
        tap(t) {
            return this.listeners.push(t),
            ()=>this.revoke(t)
        }
        revoke(t) {
            const e = this.listeners.indexOf(t);
            e >= 0 && this.listeners.splice(e, 1)
        }
        revokeAll() {
            this.listeners.splice(0)
        }
        call(...t) {
            for (const e of this.listeners)
                e(...t)
        }
    }
    function a() {
        return a = Object.assign || function(t) {
            for (var e = 1; e < arguments.length; e++) {
                var n = arguments[e];
                for (var r in n)
                    Object.prototype.hasOwnProperty.call(n, r) && (t[r] = n[r])
            }
            return t
        }
        ,
        a.apply(this, arguments)
    }
    const o = Math.random().toString(36).slice(2, 8);
    let s = 0;
    function l() {}
    function c(t, e, n="children") {
        const r = (t,i)=>e(t, (()=>{
            var e;
            null == (e = t[n]) || e.forEach((e=>{
                r(e, t)
            }
            ))
        }
        ), i);
        r(t)
    }
    function h(t) {
        if (Array.from)
            return Array.from(t);
        const e = [];
        for (let n = 0; n < t.length; n += 1)
            e.push(t[n]);
        return e
    }
    function d(t) {
        if ("string" == typeof t) {
            const e = t;
            t = t=>t.tagName === e
        }
        const e = t;
        return function() {
            let t = h(this.childNodes);
            return e && (t = t.filter((t=>e(t)))),
            t
        }
    }
    function u(t, e, n) {
        const r = document.createElement(t);
        return e && Object.entries(e).forEach((([t,e])=>{
            r[t] = e
        }
        )),
        n && Object.entries(n).forEach((([t,e])=>{
            r.setAttribute(t, e)
        }
        )),
        r
    }
    const p = function(t) {
        const e = {};
        return function(...n) {
            const r = `${n[0]}`;
            let i = e[r];
            return i || (i = {
                value: t(...n)
            },
            e[r] = i),
            i.value
        }
    }((t=>{
        document.head.append(u("link", {
            rel: "preload",
            as: "script",
            href: t
        }))
    }
    ));
    async function f(t, e) {
        if (!t.loaded && ("script" === t.type && (t.loaded = new Promise(((e,n)=>{
            var r;
            document.head.append(u("script", a({}, t.data, {
                onload: e,
                onerror: n
            }))),
            null != (r = t.data) && r.src || e(void 0)
        }
        )).then((()=>{
            t.loaded = !0
        }
        ))),
        "iife" === t.type)) {
            const {fn: n, getParams: r} = t.data;
            n(...(null == r ? void 0 : r(e)) || []),
            t.loaded = !0
        }
        await t.loaded
    }
    function m(t) {
        t.loaded || (t.loaded = !0,
        "style" === t.type ? document.head.append(u("style", {
            textContent: t.data
        })) : "stylesheet" === t.type && document.head.append(u("link", a({
            rel: "stylesheet"
        }, t.data))))
    }
    function g() {
        return g = Object.assign || function(t) {
            for (var e = 1; e < arguments.length; e++) {
                var n = arguments[e];
                for (var r in n)
                    Object.prototype.hasOwnProperty.call(n, r) && (t[r] = n[r])
            }
            return t
        }
        ,
        g.apply(this, arguments)
    }
    function y(t) {
        var e = 0
          , n = t.children
          , r = n && n.length;
        if (r)
            for (; --r >= 0; )
                e += n[r].value;
        else
            e = 1;
        t.value = e
    }
    function v(t, e) {
        var n, r, i, a, o, s = new b(t), l = +t.value && (s.value = t.value), c = [s];
        for (null == e && (e = x); n = c.pop(); )
            if (l && (n.value = +n.data.value),
            (i = e(n.data)) && (o = i.length))
                for (n.children = new Array(o),
                a = o - 1; a >= 0; --a)
                    c.push(r = n.children[a] = new b(i[a])),
                    r.parent = n,
                    r.depth = n.depth + 1;
        return s.eachBefore(z)
    }
    function x(t) {
        return t.children
    }
    function k(t) {
        t.data = t.data.data
    }
    function z(t) {
        var e = 0;
        do {
            t.height = e
        } while ((t = t.parent) && t.height < ++e)
    }
    function b(t) {
        this.data = t,
        this.depth = this.height = 0,
        this.parent = null
    }
    b.prototype = v.prototype = {
        constructor: b,
        count: function() {
            return this.eachAfter(y)
        },
        each: function(t) {
            var e, n, r, i, a = this, o = [a];
            do {
                for (e = o.reverse(),
                o = []; a = e.pop(); )
                    if (t(a),
                    n = a.children)
                        for (r = 0,
                        i = n.length; r < i; ++r)
                            o.push(n[r])
            } while (o.length);
            return this
        },
        eachAfter: function(t) {
            for (var e, n, r, i = this, a = [i], o = []; i = a.pop(); )
                if (o.push(i),
                e = i.children)
                    for (n = 0,
                    r = e.length; n < r; ++n)
                        a.push(e[n]);
            for (; i = o.pop(); )
                t(i);
            return this
        },
        eachBefore: function(t) {
            for (var e, n, r = this, i = [r]; r = i.pop(); )
                if (t(r),
                e = r.children)
                    for (n = e.length - 1; n >= 0; --n)
                        i.push(e[n]);
            return this
        },
        sum: function(t) {
            return this.eachAfter((function(e) {
                for (var n = +t(e.data) || 0, r = e.children, i = r && r.length; --i >= 0; )
                    n += r[i].value;
                e.value = n
            }
            ))
        },
        sort: function(t) {
            return this.eachBefore((function(e) {
                e.children && e.children.sort(t)
            }
            ))
        },
        path: function(t) {
            for (var e = this, n = function(t, e) {
                if (t === e)
                    return t;
                var n = t.ancestors()
                  , r = e.ancestors()
                  , i = null;
                t = n.pop(),
                e = r.pop();
                for (; t === e; )
                    i = t,
                    t = n.pop(),
                    e = r.pop();
                return i
            }(e, t), r = [e]; e !== n; )
                e = e.parent,
                r.push(e);
            for (var i = r.length; t !== n; )
                r.splice(i, 0, t),
                t = t.parent;
            return r
        },
        ancestors: function() {
            for (var t = this, e = [t]; t = t.parent; )
                e.push(t);
            return e
        },
        descendants: function() {
            var t = [];
            return this.each((function(e) {
                t.push(e)
            }
            )),
            t
        },
        leaves: function() {
            var t = [];
            return this.eachBefore((function(e) {
                e.children || t.push(e)
            }
            )),
            t
        },
        links: function() {
            var t = this
              , e = [];
            return t.each((function(n) {
                n !== t && e.push({
                    source: n.parent,
                    target: n
                })
            }
            )),
            e
        },
        copy: function() {
            return v(this).eachBefore(k)
        }
    };
    var S = {
        name: "d3-flextree",
        version: "2.1.2",
        main: "build/d3-flextree.js",
        module: "index",
        "jsnext:main": "index",
        author: {
            name: "Chris Maloney",
            url: "http://chrismaloney.org"
        },
        description: "Flexible tree layout algorithm that allows for variable node sizes.",
        keywords: ["d3", "d3-module", "layout", "tree", "hierarchy", "d3-hierarchy", "plugin", "d3-plugin", "infovis", "visualization", "2d"],
        homepage: "https://github.com/klortho/d3-flextree",
        license: "WTFPL",
        repository: {
            type: "git",
            url: "https://github.com/klortho/d3-flextree.git"
        },
        scripts: {
            clean: "rm -rf build demo test",
            "build:demo": "rollup -c --environment BUILD:demo",
            "build:dev": "rollup -c --environment BUILD:dev",
            "build:prod": "rollup -c --environment BUILD:prod",
            "build:test": "rollup -c --environment BUILD:test",
            build: "rollup -c",
            lint: "eslint index.js src",
            "test:main": "node test/bundle.js",
            "test:browser": "node test/browser-tests.js",
            test: "npm-run-all test:*",
            prepare: "npm-run-all clean build lint test"
        },
        dependencies: {
            "d3-hierarchy": "^1.1.5"
        },
        devDependencies: {
            "babel-plugin-external-helpers": "^6.22.0",
            "babel-preset-es2015-rollup": "^3.0.0",
            d3: "^4.13.0",
            "d3-selection-multi": "^1.0.1",
            eslint: "^4.19.1",
            jsdom: "^11.6.2",
            "npm-run-all": "^4.1.2",
            rollup: "^0.55.3",
            "rollup-plugin-babel": "^2.7.1",
            "rollup-plugin-commonjs": "^8.0.2",
            "rollup-plugin-copy": "^0.2.3",
            "rollup-plugin-json": "^2.3.0",
            "rollup-plugin-node-resolve": "^3.0.2",
            "rollup-plugin-uglify": "^3.0.0",
            "uglify-es": "^3.3.9"
        }
    };
    const {version: w} = S
      , E = Object.freeze({
        children: t=>t.children,
        nodeSize: t=>t.data.size,
        spacing: 0
    });
    function j(t) {
        const e = Object.assign({}, E, t);
        function n(t) {
            const n = e[t];
            return "function" == typeof n ? n : ()=>n
        }
        function r(t) {
            const e = a(function() {
                const t = i()
                  , e = n("nodeSize")
                  , r = n("spacing");
                return class extends t {
                    constructor(t) {
                        super(t),
                        Object.assign(this, {
                            x: 0,
                            y: 0,
                            relX: 0,
                            prelim: 0,
                            shift: 0,
                            change: 0,
                            lExt: this,
                            lExtRelX: 0,
                            lThr: null,
                            rExt: this,
                            rExtRelX: 0,
                            rThr: null
                        })
                    }
                    get size() {
                        return e(this.data)
                    }
                    spacing(t) {
                        return r(this.data, t.data)
                    }
                    get x() {
                        return this.data.x
                    }
                    set x(t) {
                        this.data.x = t
                    }
                    get y() {
                        return this.data.y
                    }
                    set y(t) {
                        this.data.y = t
                    }
                    update() {
                        return C(this),
                        X(this),
                        this
                    }
                }
            }(), t, (t=>t.children));
            return e.update(),
            e.data
        }
        function i() {
            const t = n("nodeSize")
              , e = n("spacing");
            return class n extends v.prototype.constructor {
                constructor(t) {
                    super(t)
                }
                copy() {
                    const t = a(this.constructor, this, (t=>t.children));
                    return t.each((t=>t.data = t.data.data)),
                    t
                }
                get size() {
                    return t(this)
                }
                spacing(t) {
                    return e(this, t)
                }
                get nodes() {
                    return this.descendants()
                }
                get xSize() {
                    return this.size[0]
                }
                get ySize() {
                    return this.size[1]
                }
                get top() {
                    return this.y
                }
                get bottom() {
                    return this.y + this.ySize
                }
                get left() {
                    return this.x - this.xSize / 2
                }
                get right() {
                    return this.x + this.xSize / 2
                }
                get root() {
                    const t = this.ancestors();
                    return t[t.length - 1]
                }
                get numChildren() {
                    return this.hasChildren ? this.children.length : 0
                }
                get hasChildren() {
                    return !this.noChildren
                }
                get noChildren() {
                    return null === this.children
                }
                get firstChild() {
                    return this.hasChildren ? this.children[0] : null
                }
                get lastChild() {
                    return this.hasChildren ? this.children[this.numChildren - 1] : null
                }
                get extents() {
                    return (this.children || []).reduce(((t,e)=>n.maxExtents(t, e.extents)), this.nodeExtents)
                }
                get nodeExtents() {
                    return {
                        top: this.top,
                        bottom: this.bottom,
                        left: this.left,
                        right: this.right
                    }
                }
                static maxExtents(t, e) {
                    return {
                        top: Math.min(t.top, e.top),
                        bottom: Math.max(t.bottom, e.bottom),
                        left: Math.min(t.left, e.left),
                        right: Math.max(t.right, e.right)
                    }
                }
            }
        }
        function a(t, e, n) {
            const r = (e,i)=>{
                const a = new t(e);
                Object.assign(a, {
                    parent: i,
                    depth: null === i ? 0 : i.depth + 1,
                    height: 0,
                    length: 1
                });
                const o = n(e) || [];
                return a.children = 0 === o.length ? null : o.map((t=>r(t, a))),
                a.children && Object.assign(a, a.children.reduce(((t,e)=>({
                    height: Math.max(t.height, e.height + 1),
                    length: t.length + e.length
                })), a)),
                a
            }
            ;
            return r(e, null)
        }
        return Object.assign(r, {
            nodeSize(t) {
                return arguments.length ? (e.nodeSize = t,
                r) : e.nodeSize
            },
            spacing(t) {
                return arguments.length ? (e.spacing = t,
                r) : e.spacing
            },
            children(t) {
                return arguments.length ? (e.children = t,
                r) : e.children
            },
            hierarchy(t, n) {
                const r = void 0 === n ? e.children : n;
                return a(i(), t, r)
            },
            dump(t) {
                const e = n("nodeSize")
                  , r = t=>n=>{
                    const i = t + "  "
                      , a = t + "    "
                      , {x: o, y: s} = n
                      , l = e(n)
                      , c = n.children || []
                      , h = 0 === c.length ? " " : `,${i}children: [${a}${c.map(r(a)).join(a)}${i}],${t}`;
                    return `{ size: [${l.join(", ")}],${i}x: ${o}, y: ${s}${h}},`
                }
                ;
                return r("\n")(t)
            }
        }),
        r
    }
    j.version = w;
    const C = (t,e=0)=>(t.y = e,
    (t.children || []).reduce(((e,n)=>{
        const [r,i] = e;
        C(n, t.y + t.ySize);
        const a = (0 === r ? n.lExt : n.rExt).bottom;
        0 !== r && I(t, r, i);
        return [r + 1, D(a, r, i)]
    }
    ), [0, null]),
    O(t),
    T(t),
    t)
      , X = (t,e,n)=>{
        void 0 === e && (e = -t.relX - t.prelim,
        n = 0);
        const r = e + t.relX;
        return t.relX = r + t.prelim - n,
        t.prelim = 0,
        t.x = n + t.relX,
        (t.children || []).forEach((e=>X(e, r, t.x))),
        t
    }
      , O = t=>{
        (t.children || []).reduce(((t,e)=>{
            const [n,r] = t
              , i = n + e.shift
              , a = r + i + e.change;
            return e.relX += a,
            [i, a]
        }
        ), [0, 0])
    }
      , I = (t,e,n)=>{
        const r = t.children[e - 1]
          , i = t.children[e];
        let a = r
          , o = r.relX
          , s = i
          , l = i.relX
          , c = !0;
        for (; a && s; ) {
            a.bottom > n.lowY && (n = n.next);
            const r = o + a.prelim - (l + s.prelim) + a.xSize / 2 + s.xSize / 2 + a.spacing(s);
            (r > 0 || r < 0 && c) && (l += r,
            M(i, r),
            A(t, e, n.index, r)),
            c = !1;
            const h = a.bottom
              , d = s.bottom;
            h <= d && (a = R(a),
            a && (o += a.relX)),
            h >= d && (s = $(s),
            s && (l += s.relX))
        }
        !a && s ? B(t, e, s, l) : a && !s && N(t, e, a, o)
    }
      , M = (t,e)=>{
        t.relX += e,
        t.lExtRelX += e,
        t.rExtRelX += e
    }
      , A = (t,e,n,r)=>{
        const i = t.children[e]
          , a = e - n;
        if (a > 1) {
            const e = r / a;
            t.children[n + 1].shift += e,
            i.shift -= e,
            i.change -= r - e
        }
    }
      , $ = t=>t.hasChildren ? t.firstChild : t.lThr
      , R = t=>t.hasChildren ? t.lastChild : t.rThr
      , B = (t,e,n,r)=>{
        const i = t.firstChild
          , a = i.lExt
          , o = t.children[e];
        a.lThr = n;
        const s = r - n.relX - i.lExtRelX;
        a.relX += s,
        a.prelim -= s,
        i.lExt = o.lExt,
        i.lExtRelX = o.lExtRelX
    }
      , N = (t,e,n,r)=>{
        const i = t.children[e]
          , a = i.rExt
          , o = t.children[e - 1];
        a.rThr = n;
        const s = r - n.relX - i.rExtRelX;
        a.relX += s,
        a.prelim -= s,
        i.rExt = o.rExt,
        i.rExtRelX = o.rExtRelX
    }
      , T = t=>{
        if (t.hasChildren) {
            const e = t.firstChild
              , n = t.lastChild
              , r = (e.prelim + e.relX - e.xSize / 2 + n.relX + n.prelim + n.xSize / 2) / 2;
            Object.assign(t, {
                prelim: r,
                lExt: e.lExt,
                lExtRelX: e.lExtRelX,
                rExt: n.rExt,
                rExtRelX: n.rExtRelX
            })
        }
    }
      , D = (t,e,n)=>{
        for (; null !== n && t >= n.lowY; )
            n = n.next;
        return {
            lowY: t,
            index: e,
            next: n
        }
    }
    ;
    /*! @gera2ld/jsx-dom v2.1.1 | ISC License */
    var H = "http://www.w3.org/1999/xlink"
      , L = {
        show: H,
        actuate: H,
        href: H
    };
    function P(t, e) {
        var n;
        if ("string" == typeof t)
            n = 1;
        else {
            if ("function" != typeof t)
                throw new Error("Invalid VNode type");
            n = 2
        }
        return {
            vtype: n,
            type: t,
            props: e
        }
    }
    function F(t) {
        return t.children
    }
    var Y = {
        isSvg: !1
    };
    function W(t, e) {
        if (1 === e.type)
            null != e.node && t.append(e.node);
        else {
            if (4 !== e.type)
                throw new Error("Unkown ref type " + JSON.stringify(e));
            e.children.forEach((function(e) {
                W(t, e)
            }
            ))
        }
    }
    var _ = {
        className: "class",
        labelFor: "for"
    };
    function U(t, e, n, r) {
        if (e = _[e] || e,
        !0 === n)
            t.setAttribute(e, "");
        else if (!1 === n)
            t.removeAttribute(e);
        else {
            var i = r ? L[e] : void 0;
            void 0 !== i ? t.setAttributeNS(i, e, n) : t.setAttribute(e, n)
        }
    }
    function V(t, e) {
        if (void 0 === e && (e = Y),
        null == t || "boolean" == typeof t)
            return {
                type: 1,
                node: null
            };
        if (t instanceof Node)
            return {
                type: 1,
                node: t
            };
        if (2 === (null == (o = t) ? void 0 : o.vtype)) {
            var n = t
              , r = n.type
              , i = n.props;
            if (r === F) {
                var a = document.createDocumentFragment();
                if (i.children)
                    W(a, V(i.children, e));
                return {
                    type: 1,
                    node: a
                }
            }
            return V(r(i), e)
        }
        var o;
        if (function(t) {
            return "string" == typeof t || "number" == typeof t
        }(t))
            return {
                type: 1,
                node: document.createTextNode("" + t)
            };
        if (function(t) {
            return 1 === (null == t ? void 0 : t.vtype)
        }(t)) {
            var s, l, c = t, h = c.type, d = c.props;
            if (e.isSvg || "svg" !== h || (e = Object.assign({}, e, {
                isSvg: !0
            })),
            function(t, e, n) {
                for (var r in e)
                    "key" !== r && "children" !== r && "ref" !== r && ("dangerouslySetInnerHTML" === r ? t.innerHTML = e[r].__html : "innerHTML" === r || "textContent" === r || "innerText" === r ? t[r] = e[r] : r.startsWith("on") ? t[r.toLowerCase()] = e[r] : U(t, r, e[r], n.isSvg))
            }(s = e.isSvg ? document.createElementNS("http://www.w3.org/2000/svg", h) : document.createElement(h), d, e),
            d.children) {
                var u = e;
                e.isSvg && "foreignObject" === h && (u = Object.assign({}, u, {
                    isSvg: !1
                })),
                l = V(d.children, u)
            }
            null != l && W(s, l);
            var p = d.ref;
            return "function" == typeof p && p(s),
            {
                type: 1,
                node: s
            }
        }
        if (Array.isArray(t))
            return {
                type: 4,
                children: t.map((function(t) {
                    return V(t, e)
                }
                ))
            };
        throw new Error("mount: Invalid Vnode!")
    }
    function Z(t) {
        for (var e = [], n = 0; n < t.length; n += 1) {
            var r = t[n];
            Array.isArray(r) ? e = e.concat(Z(r)) : null != r && e.push(r)
        }
        return e
    }
    function G(t) {
        return 1 === t.type ? t.node : t.children.map(G)
    }
    function J(t) {
        return Array.isArray(t) ? Z(t.map(J)) : G(V(t))
    }
    var K = ".markmap{font:300 16px/20px sans-serif}.markmap-link{fill:none}.markmap-node>circle{cursor:pointer}.markmap-foreign{display:inline-block}.markmap-foreign a{color:#0097e6}.markmap-foreign a:hover{color:#00a8ff}.markmap-foreign code{background-color:#f0f0f0;border-radius:2px;color:#555;font-size:calc(1em - 2px)}.markmap-foreign :not(pre)>code{padding:.2em .4em}.markmap-foreign del{text-decoration:line-through}.markmap-foreign em{font-style:italic}.markmap-foreign strong{font-weight:bolder}.markmap-foreign mark{background:#ffeaa7}.markmap-foreign pre,.markmap-foreign pre[class*=language-]{margin:0;padding:.2em .4em}"
      , q = ".markmap-container{height:0;left:-100px;overflow:hidden;position:absolute;top:-100px;width:0}.markmap-container>.markmap-foreign{display:inline-block}.markmap-container>.markmap-foreign>div:last-child{white-space:nowrap}";
    function Q(t) {
        const e = t.data;
        return Math.max(4 - 2 * e.depth, 1.5)
    }
    function tt(t, e) {
        return t[r.minIndex(t, e)]
    }
    function et(t) {
        t.stopPropagation()
    }
    const nt = new i
      , rt = r.scaleOrdinal(r.schemeCategory10)
      , it = "undefined" != typeof navigator && navigator.userAgent.includes("Macintosh");
    class at {
        constructor(t, e) {
            this.revokers = [],
            ["handleZoom", "handleClick", "handlePan"].forEach((t=>{
                this[t] = this[t].bind(this)
            }
            )),
            this.viewHooks = {
                transformHtml: new i
            },
            this.svg = t.datum ? t : r.select(t),
            this.styleNode = this.svg.append("style"),
            this.zoom = r.zoom().filter((t=>this.options.scrollForPan && "wheel" === t.type ? t.ctrlKey && !t.button : !(t.ctrlKey && "wheel" !== t.type || t.button))).on("zoom", this.handleZoom),
            this.setOptions(e),
            this.state = {
                id: this.options.id || this.svg.attr("id") || (s += 1,
                `mm-${o}-${s}`)
            },
            this.g = this.svg.append("g"),
            this.updateStyle(),
            this.revokers.push(nt.tap((()=>{
                this.setData()
            }
            )))
        }
        getStyleContent() {
            const {style: t} = this.options
              , {id: e} = this.state
              , n = "function" == typeof t ? t(e) : "";
            return [this.options.embedGlobalCSS && K, n].filter(Boolean).join("\n")
        }
        updateStyle() {
            this.svg.attr("class", function(t, ...e) {
                const n = (t || "").split(" ").filter(Boolean);
                return e.forEach((t=>{
                    t && n.indexOf(t) < 0 && n.push(t)
                }
                )),
                n.join(" ")
            }(this.svg.attr("class"), "markmap", this.state.id));
            const t = this.getStyleContent();
            this.styleNode.text(t)
        }
        handleZoom(t) {
            const {transform: e} = t;
            this.g.attr("transform", e)
        }
        handlePan(t) {
            t.preventDefault();
            const e = r.zoomTransform(this.svg.node())
              , n = e.translate(-t.deltaX / e.k, -t.deltaY / e.k);
            this.svg.call(this.zoom.transform, n)
        }
        handleClick(t, e) {
            var n;
            const {data: r} = e;
            r.payload = g({}, r.payload, {
                fold: null != (n = r.payload) && n.fold ? 0 : 1
            }),
            this.renderData(e.data)
        }
        initializeData(t) {
            let e = 0;
            const {color: n, nodeMinHeight: r, maxWidth: i, initialExpandLevel: a} = this.options
              , {id: o} = this.state
              , s = J(P("div", {
                className: `markmap-container markmap ${o}-g`
            }))
              , l = J(P("style", {
                children: [this.getStyleContent(), q].join("\n")
            }));
            document.body.append(s, l);
            const d = i ? `max-width: ${i}px` : "";
            let u = 0;
            c(t, ((t,r,i)=>{
                var o, l, c;
                t.children = null == (o = t.children) ? void 0 : o.map((t=>g({}, t))),
                e += 1;
                const h = J(P("div", {
                    className: "markmap-foreign",
                    style: d,
                    children: P("div", {
                        dangerouslySetInnerHTML: {
                            __html: t.content
                        }
                    })
                }));
                s.append(h),
                t.state = g({}, t.state, {
                    id: e,
                    el: h.firstChild
                }),
                t.state.path = [null == i || null == (l = i.state) ? void 0 : l.path, t.state.id].filter(Boolean).join("."),
                n(t);
                const p = 2 === (null == (c = t.payload) ? void 0 : c.fold);
                p ? u += 1 : (u || a >= 0 && t.depth >= a) && (t.payload = g({}, t.payload, {
                    fold: 1
                })),
                r(),
                p && (u -= 1)
            }
            ));
            const p = h(s.childNodes).map((t=>t.firstChild));
            this.viewHooks.transformHtml.call(this, p),
            p.forEach((t=>{
                t.parentNode.append(t.cloneNode(!0))
            }
            )),
            c(t, ((t,e,n)=>{
                var i;
                const a = t.state.el.getBoundingClientRect();
                t.content = t.state.el.innerHTML,
                t.state.size = [Math.ceil(a.width) + 1, Math.max(Math.ceil(a.height), r)],
                t.state.key = [null == n || null == (i = n.state) ? void 0 : i.id, t.state.id].filter(Boolean).join(".") + t.content,
                e()
            }
            )),
            s.remove(),
            l.remove()
        }
        setOptions(t) {
            this.options = g({}, at.defaultOptions, t),
            this.options.zoom ? this.svg.call(this.zoom) : this.svg.on(".zoom", null),
            this.svg.on("wheel", this.options.pan ? this.handlePan : null)
        }
        setData(t, e) {
            t && (this.state.data = t),
            e && this.setOptions(e),
            this.initializeData(this.state.data),
            this.renderData()
        }
        renderData(t) {
            var e, n;
            if (!this.state.data)
                return;
            const {spacingHorizontal: i, paddingX: a, spacingVertical: o, autoFit: s, color: l} = this.options
              , h = j().children((t=>{
                var e;
                return !(null != (e = t.payload) && e.fold) && t.children
            }
            )).nodeSize((t=>{
                const [e,n] = t.data.state.size;
                return [n, e + (e ? 2 * a : 0) + i]
            }
            )).spacing(((t,e)=>t.parent === e.parent ? o : 2 * o))
              , u = h.hierarchy(this.state.data);
            h(u),
            function(t, e) {
                c(t, ((t,n)=>{
                    t.ySizeInner = t.ySize - e,
                    t.y += e,
                    n()
                }
                ), "children")
            }(u, i);
            const p = u.descendants().reverse()
              , f = u.links()
              , m = r.linkHorizontal()
              , g = r.min(p, (t=>t.x - t.xSize / 2))
              , y = r.max(p, (t=>t.x + t.xSize / 2))
              , v = r.min(p, (t=>t.y))
              , x = r.max(p, (t=>t.y + t.ySizeInner));
            Object.assign(this.state, {
                minX: g,
                maxX: y,
                minY: v,
                maxY: x
            }),
            s && this.fit();
            const k = t && p.find((e=>e.data === t)) || u
              , z = null != (e = k.data.state.x0) ? e : k.x
              , b = null != (n = k.data.state.y0) ? n : k.y
              , S = this.g.selectAll(d("g")).data(p, (t=>t.data.state.key))
              , w = S.enter().append("g").attr("data-depth", (t=>t.data.depth)).attr("data-path", (t=>t.data.state.path)).attr("transform", (t=>`translate(${b + k.ySizeInner - t.ySizeInner},${z + k.xSize / 2 - t.xSize})`))
              , E = this.transition(S.exit());
            E.select("line").attr("x1", (t=>t.ySizeInner)).attr("x2", (t=>t.ySizeInner)),
            E.select("foreignObject").style("opacity", 0),
            E.attr("transform", (t=>`translate(${k.y + k.ySizeInner - t.ySizeInner},${k.x + k.xSize / 2 - t.xSize})`)).remove();
            const C = S.merge(w).attr("class", (t=>{
                var e;
                return ["markmap-node", (null == (e = t.data.payload) ? void 0 : e.fold) && "markmap-fold"].filter(Boolean).join(" ")
            }
            ));
            this.transition(C).attr("transform", (t=>`translate(${t.y},${t.x - t.xSize / 2})`));
            const X = C.selectAll(d("line")).data((t=>[t]), (t=>t.data.state.key)).join((t=>t.append("line").attr("x1", (t=>t.ySizeInner)).attr("x2", (t=>t.ySizeInner))), (t=>t), (t=>t.remove()));
            this.transition(X).attr("x1", -1).attr("x2", (t=>t.ySizeInner + 2)).attr("y1", (t=>t.xSize)).attr("y2", (t=>t.xSize)).attr("stroke", (t=>l(t.data))).attr("stroke-width", Q);
            const O = C.selectAll(d("circle")).data((t=>t.data.children ? [t] : []), (t=>t.data.state.key)).join((t=>t.append("circle").attr("stroke-width", "1.5").attr("cx", (t=>t.ySizeInner)).attr("cy", (t=>t.xSize)).attr("r", 0).on("click", ((t,e)=>this.handleClick(t, e)))), (t=>t), (t=>t.remove()));
            this.transition(O).attr("r", 6).attr("cx", (t=>t.ySizeInner)).attr("cy", (t=>t.xSize)).attr("stroke", (t=>l(t.data))).attr("fill", (t=>{
                var e;
                return null != (e = t.data.payload) && e.fold && t.data.children ? l(t.data) : "#fff"
            }
            ));
            const I = C.selectAll(d("foreignObject")).data((t=>[t]), (t=>t.data.state.key)).join((t=>{
                const e = t.append("foreignObject").attr("class", "markmap-foreign").attr("x", a).attr("y", 0).style("opacity", 0).on("mousedown", et).on("dblclick", et);
                return e.append("xhtml:div").select((function(t) {
                    const e = t.data.state.el.cloneNode(!0);
                    return this.replaceWith(e),
                    e
                }
                )).attr("xmlns", "http://www.w3.org/1999/xhtml"),
                e
            }
            ), (t=>t), (t=>t.remove())).attr("width", (t=>Math.max(0, t.ySizeInner - 2 * a))).attr("height", (t=>t.xSize));
            this.transition(I).style("opacity", 1);
            const M = this.g.selectAll(d("path")).data(f, (t=>t.target.data.state.key)).join((t=>{
                const e = [b + k.ySizeInner, z + k.xSize / 2];
                return t.insert("path", "g").attr("class", "markmap-link").attr("data-depth", (t=>t.target.data.depth)).attr("data-path", (t=>t.target.data.state.path)).attr("d", m({
                    source: e,
                    target: e
                }))
            }
            ), (t=>t), (t=>{
                const e = [k.y + k.ySizeInner, k.x + k.xSize / 2];
                return this.transition(t).attr("d", m({
                    source: e,
                    target: e
                })).remove()
            }
            ));
            this.transition(M).attr("stroke", (t=>l(t.target.data))).attr("stroke-width", (t=>Q(t.target))).attr("d", (t=>{
                const e = [t.source.y + t.source.ySizeInner, t.source.x + t.source.xSize / 2]
                  , n = [t.target.y, t.target.x + t.target.xSize / 2];
                return m({
                    source: e,
                    target: n
                })
            }
            )),
            p.forEach((t=>{
                t.data.state.x0 = t.x,
                t.data.state.y0 = t.y
            }
            ))
        }
        transition(t) {
            const {duration: e} = this.options;
            return t.transition().duration(e)
        }
        async fit() {
            const t = this.svg.node()
              , {width: e, height: n} = t.getBoundingClientRect()
              , {fitRatio: i} = this.options
              , {minX: a, maxX: o, minY: s, maxY: c} = this.state
              , h = c - s
              , d = o - a
              , u = Math.min(e / h * i, n / d * i, 2)
              , p = r.zoomIdentity.translate((e - h * u) / 2 - s * u, (n - d * u) / 2 - a * u).scale(u);
            return this.transition(this.svg).call(this.zoom.transform, p).end().catch(l)
        }
        async ensureView(t, e) {
            let n, i;
            if (this.g.selectAll(d("g")).each((function(e) {
                e.data === t && (n = this,
                i = e)
            }
            )),
            !n || !i)
                return;
            const a = this.svg.node()
              , o = a.getBoundingClientRect()
              , s = r.zoomTransform(a)
              , [c,h] = [i.y, i.y + i.ySizeInner + 2].map((t=>t * s.k + s.x))
              , [u,p] = [i.x - i.xSize / 2, i.x + i.xSize / 2].map((t=>t * s.k + s.y))
              , f = g({
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            }, e)
              , m = [f.left - c, o.width - f.right - h]
              , y = [f.top - u, o.height - f.bottom - p]
              , v = m[0] * m[1] > 0 ? tt(m, Math.abs) / s.k : 0
              , x = y[0] * y[1] > 0 ? tt(y, Math.abs) / s.k : 0;
            if (v || x) {
                const t = s.translate(v, x);
                return this.transition(this.svg).call(this.zoom.transform, t).end().catch(l)
            }
        }
        async rescale(t) {
            const e = this.svg.node()
              , {width: n, height: i} = e.getBoundingClientRect()
              , a = n / 2
              , o = i / 2
              , s = r.zoomTransform(e)
              , c = s.translate((a - s.x) * (1 - t) / s.k, (o - s.y) * (1 - t) / s.k).scale(t);
            return this.transition(this.svg).call(this.zoom.transform, c).end().catch(l)
        }
        destroy() {
            this.svg.on(".zoom", null),
            this.svg.html(null),
            this.revokers.forEach((t=>{
                t()
            }
            ))
        }
        static create(t, e, n) {
            const r = new at(t,e);
            return n && (r.setData(n),
            r.fit()),
            r
        }
    }
    at.defaultOptions = {
        autoFit: !1,
        color: t=>rt(`${t.state.path}`),
        duration: 500,
        embedGlobalCSS: !0,
        fitRatio: .95,
        maxWidth: 0,
        nodeMinHeight: 16,
        paddingX: 8,
        scrollForPan: it,
        spacingHorizontal: 80,
        spacingVertical: 5,
        initialExpandLevel: -1,
        zoom: !0,
        pan: !0
    },
    t.Markmap = at,
    t.defaultColorFn = rt,
    t.deriveOptions = function(t) {
        const e = {};
        t || (t = {});
        const {color: n, colorFreezeLevel: i} = t;
        if (1 === (null == n ? void 0 : n.length)) {
            const t = n[0];
            e.color = ()=>t
        } else if (null != n && n.length) {
            const t = r.scaleOrdinal(n);
            e.color = e=>t(`${e.state.path}`)
        }
        if (i) {
            const t = e.color || at.defaultOptions.color;
            e.color = e=>(e = g({}, e, {
                state: g({}, e.state, {
                    path: e.state.path.split(".").slice(0, i).join(".")
                })
            }),
            t(e))
        }
        return ["duration", "maxWidth", "initialExpandLevel"].forEach((n=>{
            const r = t[n];
            "number" == typeof r && (e[n] = r)
        }
        )),
        ["zoom", "pan"].forEach((n=>{
            const r = t[n];
            null != r && (e[n] = !!r)
        }
        )),
        e
    }
    ,
    t.globalCSS = ".markmap{font:300 16px/20px sans-serif}.markmap-link{fill:none}.markmap-node>circle{cursor:pointer}.markmap-foreign{display:inline-block}.markmap-foreign a{color:#0097e6}.markmap-foreign a:hover{color:#00a8ff}.markmap-foreign code{background-color:#f0f0f0;border-radius:2px;color:#555;font-size:calc(1em - 2px)}.markmap-foreign :not(pre)>code{padding:.2em .4em}.markmap-foreign del{text-decoration:line-through}.markmap-foreign em{font-style:italic}.markmap-foreign strong{font-weight:bolder}.markmap-foreign mark{background:#ffeaa7}.markmap-foreign pre,.markmap-foreign pre[class*=language-]{margin:0;padding:.2em .4em}",
    t.loadCSS = function(t) {
        for (const e of t)
            m(e)
    }
    ,
    t.loadJS = async function(t, e) {
        const n = t.filter((t=>{
            var e;
            return "script" === t.type && (null == (e = t.data) ? void 0 : e.src)
        }
        ));
        n.length > 1 && n.forEach((t=>p(t.data.src))),
        e = a({
            getMarkmap: ()=>window.markmap
        }, e);
        for (const n of t)
            await f(n, e)
    }
    ,
    t.refreshHook = nt
}(this.markmap = this.markmap || {}, d3);


!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.katex=t():e.katex=t()}("undefined"!=typeof self?self:this,(function(){return function(){"use strict";var e={d:function(t,r){for(var n in r)e.o(r,n)&&!e.o(t,n)&&Object.defineProperty(t,n,{enumerable:!0,get:r[n]})},o:function(e,t){return Object.prototype.hasOwnProperty.call(e,t)}},t={};e.d(t,{default:function(){return Qn}});var r=function e(t,r){this.position=void 0;var n,a="KaTeX parse error: "+t,i=r&&r.loc;if(i&&i.start<=i.end){var o=i.lexer.input;n=i.start;var s=i.end;n===o.length?a+=" at end of input: ":a+=" at position "+(n+1)+": ";var l=o.slice(n,s).replace(/[^]/g,"$&\u0332");a+=(n>15?"\u2026"+o.slice(n-15,n):o.slice(0,n))+l+(s+15<o.length?o.slice(s,s+15)+"\u2026":o.slice(s))}var h=new Error(a);return h.name="ParseError",h.__proto__=e.prototype,h.position=n,h};r.prototype.__proto__=Error.prototype;var n=r,a=/([A-Z])/g,i={"&":"&amp;",">":"&gt;","<":"&lt;",'"':"&quot;","'":"&#x27;"},o=/[&><"']/g;var s=function e(t){return"ordgroup"===t.type||"color"===t.type?1===t.body.length?e(t.body[0]):t:"font"===t.type?e(t.body):t},l={contains:function(e,t){return-1!==e.indexOf(t)},deflt:function(e,t){return void 0===e?t:e},escape:function(e){return String(e).replace(o,(function(e){return i[e]}))},hyphenate:function(e){return e.replace(a,"-$1").toLowerCase()},getBaseElem:s,isCharacterBox:function(e){var t=s(e);return"mathord"===t.type||"textord"===t.type||"atom"===t.type},protocolFromUrl:function(e){var t=/^\s*([^\\/#]*?)(?::|&#0*58|&#x0*3a)/i.exec(e);return null!=t?t[1]:"_relative"}},h={displayMode:{type:"boolean",description:"Render math in display mode, which puts the math in display style (so \\int and \\sum are large, for example), and centers the math on the page on its own line.",cli:"-d, --display-mode"},output:{type:{enum:["htmlAndMathml","html","mathml"]},description:"Determines the markup language of the output.",cli:"-F, --format <type>"},leqno:{type:"boolean",description:"Render display math in leqno style (left-justified tags)."},fleqn:{type:"boolean",description:"Render display math flush left."},throwOnError:{type:"boolean",default:!0,cli:"-t, --no-throw-on-error",cliDescription:"Render errors (in the color given by --error-color) instead of throwing a ParseError exception when encountering an error."},errorColor:{type:"string",default:"#cc0000",cli:"-c, --error-color <color>",cliDescription:"A color string given in the format 'rgb' or 'rrggbb' (no #). This option determines the color of errors rendered by the -t option.",cliProcessor:function(e){return"#"+e}},macros:{type:"object",cli:"-m, --macro <def>",cliDescription:"Define custom macro of the form '\\foo:expansion' (use multiple -m arguments for multiple macros).",cliDefault:[],cliProcessor:function(e,t){return t.push(e),t}},minRuleThickness:{type:"number",description:"Specifies a minimum thickness, in ems, for fraction lines, `\\sqrt` top lines, `{array}` vertical lines, `\\hline`, `\\hdashline`, `\\underline`, `\\overline`, and the borders of `\\fbox`, `\\boxed`, and `\\fcolorbox`.",processor:function(e){return Math.max(0,e)},cli:"--min-rule-thickness <size>",cliProcessor:parseFloat},colorIsTextColor:{type:"boolean",description:"Makes \\color behave like LaTeX's 2-argument \\textcolor, instead of LaTeX's one-argument \\color mode change.",cli:"-b, --color-is-text-color"},strict:{type:[{enum:["warn","ignore","error"]},"boolean","function"],description:"Turn on strict / LaTeX faithfulness mode, which throws an error if the input uses features that are not supported by LaTeX.",cli:"-S, --strict",cliDefault:!1},trust:{type:["boolean","function"],description:"Trust the input, enabling all HTML features such as \\url.",cli:"-T, --trust"},maxSize:{type:"number",default:1/0,description:"If non-zero, all user-specified sizes, e.g. in \\rule{500em}{500em}, will be capped to maxSize ems. Otherwise, elements and spaces can be arbitrarily large",processor:function(e){return Math.max(0,e)},cli:"-s, --max-size <n>",cliProcessor:parseInt},maxExpand:{type:"number",default:1e3,description:"Limit the number of macro expansions to the specified number, to prevent e.g. infinite macro loops. If set to Infinity, the macro expander will try to fully expand as in LaTeX.",processor:function(e){return Math.max(0,e)},cli:"-e, --max-expand <n>",cliProcessor:function(e){return"Infinity"===e?1/0:parseInt(e)}},globalGroup:{type:"boolean",cli:!1}};function m(e){if(e.default)return e.default;var t=e.type,r=Array.isArray(t)?t[0]:t;if("string"!=typeof r)return r.enum[0];switch(r){case"boolean":return!1;case"string":return"";case"number":return 0;case"object":return{}}}var c=function(){function e(e){for(var t in this.displayMode=void 0,this.output=void 0,this.leqno=void 0,this.fleqn=void 0,this.throwOnError=void 0,this.errorColor=void 0,this.macros=void 0,this.minRuleThickness=void 0,this.colorIsTextColor=void 0,this.strict=void 0,this.trust=void 0,this.maxSize=void 0,this.maxExpand=void 0,this.globalGroup=void 0,e=e||{},h)if(h.hasOwnProperty(t)){var r=h[t];this[t]=void 0!==e[t]?r.processor?r.processor(e[t]):e[t]:m(r)}}var t=e.prototype;return t.reportNonstrict=function(e,t,r){var a=this.strict;if("function"==typeof a&&(a=a(e,t,r)),a&&"ignore"!==a){if(!0===a||"error"===a)throw new n("LaTeX-incompatible input and strict mode is set to 'error': "+t+" ["+e+"]",r);"warn"===a?"undefined"!=typeof console&&console.warn("LaTeX-incompatible input and strict mode is set to 'warn': "+t+" ["+e+"]"):"undefined"!=typeof console&&console.warn("LaTeX-incompatible input and strict mode is set to unrecognized '"+a+"': "+t+" ["+e+"]")}},t.useStrictBehavior=function(e,t,r){var n=this.strict;if("function"==typeof n)try{n=n(e,t,r)}catch(e){n="error"}return!(!n||"ignore"===n)&&(!0===n||"error"===n||("warn"===n?("undefined"!=typeof console&&console.warn("LaTeX-incompatible input and strict mode is set to 'warn': "+t+" ["+e+"]"),!1):("undefined"!=typeof console&&console.warn("LaTeX-incompatible input and strict mode is set to unrecognized '"+n+"': "+t+" ["+e+"]"),!1)))},t.isTrusted=function(e){e.url&&!e.protocol&&(e.protocol=l.protocolFromUrl(e.url));var t="function"==typeof this.trust?this.trust(e):this.trust;return Boolean(t)},e}(),u=function(){function e(e,t,r){this.id=void 0,this.size=void 0,this.cramped=void 0,this.id=e,this.size=t,this.cramped=r}var t=e.prototype;return t.sup=function(){return p[d[this.id]]},t.sub=function(){return p[f[this.id]]},t.fracNum=function(){return p[g[this.id]]},t.fracDen=function(){return p[v[this.id]]},t.cramp=function(){return p[b[this.id]]},t.text=function(){return p[y[this.id]]},t.isTight=function(){return this.size>=2},e}(),p=[new u(0,0,!1),new u(1,0,!0),new u(2,1,!1),new u(3,1,!0),new u(4,2,!1),new u(5,2,!0),new u(6,3,!1),new u(7,3,!0)],d=[4,5,4,5,6,7,6,7],f=[5,5,5,5,7,7,7,7],g=[2,3,4,5,6,7,6,7],v=[3,3,5,5,7,7,7,7],b=[1,1,3,3,5,5,7,7],y=[0,1,2,3,2,3,2,3],x={DISPLAY:p[0],TEXT:p[2],SCRIPT:p[4],SCRIPTSCRIPT:p[6]},w=[{name:"latin",blocks:[[256,591],[768,879]]},{name:"cyrillic",blocks:[[1024,1279]]},{name:"armenian",blocks:[[1328,1423]]},{name:"brahmic",blocks:[[2304,4255]]},{name:"georgian",blocks:[[4256,4351]]},{name:"cjk",blocks:[[12288,12543],[19968,40879],[65280,65376]]},{name:"hangul",blocks:[[44032,55215]]}];var k=[];function S(e){for(var t=0;t<k.length;t+=2)if(e>=k[t]&&e<=k[t+1])return!0;return!1}w.forEach((function(e){return e.blocks.forEach((function(e){return k.push.apply(k,e)}))}));var M=80,z={doubleleftarrow:"M262 157\nl10-10c34-36 62.7-77 86-123 3.3-8 5-13.3 5-16 0-5.3-6.7-8-20-8-7.3\n 0-12.2.5-14.5 1.5-2.3 1-4.8 4.5-7.5 10.5-49.3 97.3-121.7 169.3-217 216-28\n 14-57.3 25-88 33-6.7 2-11 3.8-13 5.5-2 1.7-3 4.2-3 7.5s1 5.8 3 7.5\nc2 1.7 6.3 3.5 13 5.5 68 17.3 128.2 47.8 180.5 91.5 52.3 43.7 93.8 96.2 124.5\n 157.5 9.3 8 15.3 12.3 18 13h6c12-.7 18-4 18-10 0-2-1.7-7-5-15-23.3-46-52-87\n-86-123l-10-10h399738v-40H218c328 0 0 0 0 0l-10-8c-26.7-20-65.7-43-117-69 2.7\n-2 6-3.7 10-5 36.7-16 72.3-37.3 107-64l10-8h399782v-40z\nm8 0v40h399730v-40zm0 194v40h399730v-40z",doublerightarrow:"M399738 392l\n-10 10c-34 36-62.7 77-86 123-3.3 8-5 13.3-5 16 0 5.3 6.7 8 20 8 7.3 0 12.2-.5\n 14.5-1.5 2.3-1 4.8-4.5 7.5-10.5 49.3-97.3 121.7-169.3 217-216 28-14 57.3-25 88\n-33 6.7-2 11-3.8 13-5.5 2-1.7 3-4.2 3-7.5s-1-5.8-3-7.5c-2-1.7-6.3-3.5-13-5.5-68\n-17.3-128.2-47.8-180.5-91.5-52.3-43.7-93.8-96.2-124.5-157.5-9.3-8-15.3-12.3-18\n-13h-6c-12 .7-18 4-18 10 0 2 1.7 7 5 15 23.3 46 52 87 86 123l10 10H0v40h399782\nc-328 0 0 0 0 0l10 8c26.7 20 65.7 43 117 69-2.7 2-6 3.7-10 5-36.7 16-72.3 37.3\n-107 64l-10 8H0v40zM0 157v40h399730v-40zm0 194v40h399730v-40z",leftarrow:"M400000 241H110l3-3c68.7-52.7 113.7-120\n 135-202 4-14.7 6-23 6-25 0-7.3-7-11-21-11-8 0-13.2.8-15.5 2.5-2.3 1.7-4.2 5.8\n-5.5 12.5-1.3 4.7-2.7 10.3-4 17-12 48.7-34.8 92-68.5 130S65.3 228.3 18 247\nc-10 4-16 7.7-18 11 0 8.7 6 14.3 18 17 47.3 18.7 87.8 47 121.5 85S196 441.3 208\n 490c.7 2 1.3 5 2 9s1.2 6.7 1.5 8c.3 1.3 1 3.3 2 6s2.2 4.5 3.5 5.5c1.3 1 3.3\n 1.8 6 2.5s6 1 10 1c14 0 21-3.7 21-11 0-2-2-10.3-6-25-20-79.3-65-146.7-135-202\n l-3-3h399890zM100 241v40h399900v-40z",leftbrace:"M6 548l-6-6v-35l6-11c56-104 135.3-181.3 238-232 57.3-28.7 117\n-45 179-50h399577v120H403c-43.3 7-81 15-113 26-100.7 33-179.7 91-237 174-2.7\n 5-6 9-10 13-.7 1-7.3 1-20 1H6z",leftbraceunder:"M0 6l6-6h17c12.688 0 19.313.3 20 1 4 4 7.313 8.3 10 13\n 35.313 51.3 80.813 93.8 136.5 127.5 55.688 33.7 117.188 55.8 184.5 66.5.688\n 0 2 .3 4 1 18.688 2.7 76 4.3 172 5h399450v120H429l-6-1c-124.688-8-235-61.7\n-331-161C60.687 138.7 32.312 99.3 7 54L0 41V6z",leftgroup:"M400000 80\nH435C64 80 168.3 229.4 21 260c-5.9 1.2-18 0-18 0-2 0-3-1-3-3v-38C76 61 257 0\n 435 0h399565z",leftgroupunder:"M400000 262\nH435C64 262 168.3 112.6 21 82c-5.9-1.2-18 0-18 0-2 0-3 1-3 3v38c76 158 257 219\n 435 219h399565z",leftharpoon:"M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3\n-3.3 10.2-9.5 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5\n-18.3 3-21-1.3-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7\n-196 228-6.7 4.7-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40z",leftharpoonplus:"M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3-3.3 10.2-9.5\n 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5-18.3 3-21-1.3\n-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7-196 228-6.7 4.7\n-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40zM0 435v40h400000v-40z\nm0 0v40h400000v-40z",leftharpoondown:"M7 241c-4 4-6.333 8.667-7 14 0 5.333.667 9 2 11s5.333\n 5.333 12 10c90.667 54 156 130 196 228 3.333 10.667 6.333 16.333 9 17 2 .667 5\n 1 9 1h5c10.667 0 16.667-2 18-6 2-2.667 1-9.667-3-21-32-87.333-82.667-157.667\n-152-211l-3-3h399907v-40zM93 281 H400000 v-40L7 241z",leftharpoondownplus:"M7 435c-4 4-6.3 8.7-7 14 0 5.3.7 9 2 11s5.3 5.3 12\n 10c90.7 54 156 130 196 228 3.3 10.7 6.3 16.3 9 17 2 .7 5 1 9 1h5c10.7 0 16.7\n-2 18-6 2-2.7 1-9.7-3-21-32-87.3-82.7-157.7-152-211l-3-3h399907v-40H7zm93 0\nv40h399900v-40zM0 241v40h399900v-40zm0 0v40h399900v-40z",lefthook:"M400000 281 H103s-33-11.2-61-33.5S0 197.3 0 164s14.2-61.2 42.5\n-83.5C70.8 58.2 104 47 142 47 c16.7 0 25 6.7 25 20 0 12-8.7 18.7-26 20-40 3.3\n-68.7 15.7-86 37-10 12-15 25.3-15 40 0 22.7 9.8 40.7 29.5 54 19.7 13.3 43.5 21\n 71.5 23h399859zM103 281v-40h399897v40z",leftlinesegment:"M40 281 V428 H0 V94 H40 V241 H400000 v40z\nM40 281 V428 H0 V94 H40 V241 H400000 v40z",leftmapsto:"M40 281 V448H0V74H40V241H400000v40z\nM40 281 V448H0V74H40V241H400000v40z",leftToFrom:"M0 147h400000v40H0zm0 214c68 40 115.7 95.7 143 167h22c15.3 0 23\n-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69-70-101l-7-8h399905v-40H95l7-8\nc28.7-32 52-65.7 70-101 10.7-23.3 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 265.3\n 68 321 0 361zm0-174v-40h399900v40zm100 154v40h399900v-40z",longequal:"M0 50 h400000 v40H0z m0 194h40000v40H0z\nM0 50 h400000 v40H0z m0 194h40000v40H0z",midbrace:"M200428 334\nc-100.7-8.3-195.3-44-280-108-55.3-42-101.7-93-139-153l-9-14c-2.7 4-5.7 8.7-9 14\n-53.3 86.7-123.7 153-211 199-66.7 36-137.3 56.3-212 62H0V214h199568c178.3-11.7\n 311.7-78.3 403-201 6-8 9.7-12 11-12 .7-.7 6.7-1 18-1s17.3.3 18 1c1.3 0 5 4 11\n 12 44.7 59.3 101.3 106.3 170 141s145.3 54.3 229 60h199572v120z",midbraceunder:"M199572 214\nc100.7 8.3 195.3 44 280 108 55.3 42 101.7 93 139 153l9 14c2.7-4 5.7-8.7 9-14\n 53.3-86.7 123.7-153 211-199 66.7-36 137.3-56.3 212-62h199568v120H200432c-178.3\n 11.7-311.7 78.3-403 201-6 8-9.7 12-11 12-.7.7-6.7 1-18 1s-17.3-.3-18-1c-1.3 0\n-5-4-11-12-44.7-59.3-101.3-106.3-170-141s-145.3-54.3-229-60H0V214z",oiintSize1:"M512.6 71.6c272.6 0 320.3 106.8 320.3 178.2 0 70.8-47.7 177.6\n-320.3 177.6S193.1 320.6 193.1 249.8c0-71.4 46.9-178.2 319.5-178.2z\nm368.1 178.2c0-86.4-60.9-215.4-368.1-215.4-306.4 0-367.3 129-367.3 215.4 0 85.8\n60.9 214.8 367.3 214.8 307.2 0 368.1-129 368.1-214.8z",oiintSize2:"M757.8 100.1c384.7 0 451.1 137.6 451.1 230 0 91.3-66.4 228.8\n-451.1 228.8-386.3 0-452.7-137.5-452.7-228.8 0-92.4 66.4-230 452.7-230z\nm502.4 230c0-111.2-82.4-277.2-502.4-277.2s-504 166-504 277.2\nc0 110 84 276 504 276s502.4-166 502.4-276z",oiiintSize1:"M681.4 71.6c408.9 0 480.5 106.8 480.5 178.2 0 70.8-71.6 177.6\n-480.5 177.6S202.1 320.6 202.1 249.8c0-71.4 70.5-178.2 479.3-178.2z\nm525.8 178.2c0-86.4-86.8-215.4-525.7-215.4-437.9 0-524.7 129-524.7 215.4 0\n85.8 86.8 214.8 524.7 214.8 438.9 0 525.7-129 525.7-214.8z",oiiintSize2:"M1021.2 53c603.6 0 707.8 165.8 707.8 277.2 0 110-104.2 275.8\n-707.8 275.8-606 0-710.2-165.8-710.2-275.8C311 218.8 415.2 53 1021.2 53z\nm770.4 277.1c0-131.2-126.4-327.6-770.5-327.6S248.4 198.9 248.4 330.1\nc0 130 128.8 326.4 772.7 326.4s770.5-196.4 770.5-326.4z",rightarrow:"M0 241v40h399891c-47.3 35.3-84 78-110 128\n-16.7 32-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20\n 11 8 0 13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7\n 39-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85\n-40.5-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5\n-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67\n 151.7 139 205zm0 0v40h399900v-40z",rightbrace:"M400000 542l\n-6 6h-17c-12.7 0-19.3-.3-20-1-4-4-7.3-8.3-10-13-35.3-51.3-80.8-93.8-136.5-127.5\ns-117.2-55.8-184.5-66.5c-.7 0-2-.3-4-1-18.7-2.7-76-4.3-172-5H0V214h399571l6 1\nc124.7 8 235 61.7 331 161 31.3 33.3 59.7 72.7 85 118l7 13v35z",rightbraceunder:"M399994 0l6 6v35l-6 11c-56 104-135.3 181.3-238 232-57.3\n 28.7-117 45-179 50H-300V214h399897c43.3-7 81-15 113-26 100.7-33 179.7-91 237\n-174 2.7-5 6-9 10-13 .7-1 7.3-1 20-1h17z",rightgroup:"M0 80h399565c371 0 266.7 149.4 414 180 5.9 1.2 18 0 18 0 2 0\n 3-1 3-3v-38c-76-158-257-219-435-219H0z",rightgroupunder:"M0 262h399565c371 0 266.7-149.4 414-180 5.9-1.2 18 0 18\n 0 2 0 3 1 3 3v38c-76 158-257 219-435 219H0z",rightharpoon:"M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3\n-3.7-15.3-11-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2\n-10.7 0-16.7 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58\n 69.2 92 94.5zm0 0v40h399900v-40z",rightharpoonplus:"M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3-3.7-15.3-11\n-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2-10.7 0-16.7\n 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58 69.2 92 94.5z\nm0 0v40h399900v-40z m100 194v40h399900v-40zm0 0v40h399900v-40z",rightharpoondown:"M399747 511c0 7.3 6.7 11 20 11 8 0 13-.8 15-2.5s4.7-6.8\n 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3 8.5-5.8 9.5\n-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3-64.7 57-92 95\n-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 241v40h399900v-40z",rightharpoondownplus:"M399747 705c0 7.3 6.7 11 20 11 8 0 13-.8\n 15-2.5s4.7-6.8 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3\n 8.5-5.8 9.5-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3\n-64.7 57-92 95-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 435v40h399900v-40z\nm0-194v40h400000v-40zm0 0v40h400000v-40z",righthook:"M399859 241c-764 0 0 0 0 0 40-3.3 68.7-15.7 86-37 10-12 15-25.3\n 15-40 0-22.7-9.8-40.7-29.5-54-19.7-13.3-43.5-21-71.5-23-17.3-1.3-26-8-26-20 0\n-13.3 8.7-20 26-20 38 0 71 11.2 99 33.5 0 0 7 5.6 21 16.7 14 11.2 21 33.5 21\n 66.8s-14 61.2-42 83.5c-28 22.3-61 33.5-99 33.5L0 241z M0 281v-40h399859v40z",rightlinesegment:"M399960 241 V94 h40 V428 h-40 V281 H0 v-40z\nM399960 241 V94 h40 V428 h-40 V281 H0 v-40z",rightToFrom:"M400000 167c-70.7-42-118-97.7-142-167h-23c-15.3 0-23 .3-23\n 1 0 1.3 5.3 13.7 16 37 18 35.3 41.3 69 70 101l7 8H0v40h399905l-7 8c-28.7 32\n-52 65.7-70 101-10.7 23.3-16 35.7-16 37 0 .7 7.7 1 23 1h23c24-69.3 71.3-125 142\n-167z M100 147v40h399900v-40zM0 341v40h399900v-40z",twoheadleftarrow:"M0 167c68 40\n 115.7 95.7 143 167h22c15.3 0 23-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69\n-70-101l-7-8h125l9 7c50.7 39.3 85 86 103 140h46c0-4.7-6.3-18.7-19-42-18-35.3\n-40-67.3-66-96l-9-9h399716v-40H284l9-9c26-28.7 48-60.7 66-96 12.7-23.333 19\n-37.333 19-42h-46c-18 54-52.3 100.7-103 140l-9 7H95l7-8c28.7-32 52-65.7 70-101\n 10.7-23.333 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 71.3 68 127 0 167z",twoheadrightarrow:"M400000 167\nc-68-40-115.7-95.7-143-167h-22c-15.3 0-23 .3-23 1 0 1.3 5.3 13.7 16 37 18 35.3\n 41.3 69 70 101l7 8h-125l-9-7c-50.7-39.3-85-86-103-140h-46c0 4.7 6.3 18.7 19 42\n 18 35.3 40 67.3 66 96l9 9H0v40h399716l-9 9c-26 28.7-48 60.7-66 96-12.7 23.333\n-19 37.333-19 42h46c18-54 52.3-100.7 103-140l9-7h125l-7 8c-28.7 32-52 65.7-70\n 101-10.7 23.333-16 35.7-16 37 0 .7 7.7 1 23 1h22c27.3-71.3 75-127 143-167z",tilde1:"M200 55.538c-77 0-168 73.953-177 73.953-3 0-7\n-2.175-9-5.437L2 97c-1-2-2-4-2-6 0-4 2-7 5-9l20-12C116 12 171 0 207 0c86 0\n 114 68 191 68 78 0 168-68 177-68 4 0 7 2 9 5l12 19c1 2.175 2 4.35 2 6.525 0\n 4.35-2 7.613-5 9.788l-19 13.05c-92 63.077-116.937 75.308-183 76.128\n-68.267.847-113-73.952-191-73.952z",tilde2:"M344 55.266c-142 0-300.638 81.316-311.5 86.418\n-8.01 3.762-22.5 10.91-23.5 5.562L1 120c-1-2-1-3-1-4 0-5 3-9 8-10l18.4-9C160.9\n 31.9 283 0 358 0c148 0 188 122 331 122s314-97 326-97c4 0 8 2 10 7l7 21.114\nc1 2.14 1 3.21 1 4.28 0 5.347-3 9.626-7 10.696l-22.3 12.622C852.6 158.372 751\n 181.476 676 181.476c-149 0-189-126.21-332-126.21z",tilde3:"M786 59C457 59 32 175.242 13 175.242c-6 0-10-3.457\n-11-10.37L.15 138c-1-7 3-12 10-13l19.2-6.4C378.4 40.7 634.3 0 804.3 0c337 0\n 411.8 157 746.8 157 328 0 754-112 773-112 5 0 10 3 11 9l1 14.075c1 8.066-.697\n 16.595-6.697 17.492l-21.052 7.31c-367.9 98.146-609.15 122.696-778.15 122.696\n -338 0-409-156.573-744-156.573z",tilde4:"M786 58C457 58 32 177.487 13 177.487c-6 0-10-3.345\n-11-10.035L.15 143c-1-7 3-12 10-13l22-6.7C381.2 35 637.15 0 807.15 0c337 0 409\n 177 744 177 328 0 754-127 773-127 5 0 10 3 11 9l1 14.794c1 7.805-3 13.38-9\n 14.495l-20.7 5.574c-366.85 99.79-607.3 139.372-776.3 139.372-338 0-409\n -175.236-744-175.236z",vec:"M377 20c0-5.333 1.833-10 5.5-14S391 0 397 0c4.667 0 8.667 1.667 12 5\n3.333 2.667 6.667 9 10 19 6.667 24.667 20.333 43.667 41 57 7.333 4.667 11\n10.667 11 18 0 6-1 10-3 12s-6.667 5-14 9c-28.667 14.667-53.667 35.667-75 63\n-1.333 1.333-3.167 3.5-5.5 6.5s-4 4.833-5 5.5c-1 .667-2.5 1.333-4.5 2s-4.333 1\n-7 1c-4.667 0-9.167-1.833-13.5-5.5S337 184 337 178c0-12.667 15.667-32.333 47-59\nH213l-171-1c-8.667-6-13-12.333-13-19 0-4.667 4.333-11.333 13-20h359\nc-16-25.333-24-45-24-59z",widehat1:"M529 0h5l519 115c5 1 9 5 9 10 0 1-1 2-1 3l-4 22\nc-1 5-5 9-11 9h-2L532 67 19 159h-2c-5 0-9-4-11-9l-5-22c-1-6 2-12 8-13z",widehat2:"M1181 0h2l1171 176c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 220h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",widehat3:"M1181 0h2l1171 236c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 280h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",widehat4:"M1181 0h2l1171 296c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 340h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",widecheck1:"M529,159h5l519,-115c5,-1,9,-5,9,-10c0,-1,-1,-2,-1,-3l-4,-22c-1,\n-5,-5,-9,-11,-9h-2l-512,92l-513,-92h-2c-5,0,-9,4,-11,9l-5,22c-1,6,2,12,8,13z",widecheck2:"M1181,220h2l1171,-176c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,153l-1167,-153h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",widecheck3:"M1181,280h2l1171,-236c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,213l-1167,-213h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",widecheck4:"M1181,340h2l1171,-296c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,273l-1167,-273h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",baraboveleftarrow:"M400000 620h-399890l3 -3c68.7 -52.7 113.7 -120 135 -202\nc4 -14.7 6 -23 6 -25c0 -7.3 -7 -11 -21 -11c-8 0 -13.2 0.8 -15.5 2.5\nc-2.3 1.7 -4.2 5.8 -5.5 12.5c-1.3 4.7 -2.7 10.3 -4 17c-12 48.7 -34.8 92 -68.5 130\ns-74.2 66.3 -121.5 85c-10 4 -16 7.7 -18 11c0 8.7 6 14.3 18 17c47.3 18.7 87.8 47\n121.5 85s56.5 81.3 68.5 130c0.7 2 1.3 5 2 9s1.2 6.7 1.5 8c0.3 1.3 1 3.3 2 6\ns2.2 4.5 3.5 5.5c1.3 1 3.3 1.8 6 2.5s6 1 10 1c14 0 21 -3.7 21 -11\nc0 -2 -2 -10.3 -6 -25c-20 -79.3 -65 -146.7 -135 -202l-3 -3h399890z\nM100 620v40h399900v-40z M0 241v40h399900v-40zM0 241v40h399900v-40z",rightarrowabovebar:"M0 241v40h399891c-47.3 35.3-84 78-110 128-16.7 32\n-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20 11 8 0\n13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7 39\n-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85-40.5\n-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5\n-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67\n151.7 139 205zm96 379h399894v40H0zm0 0h399904v40H0z",baraboveshortleftharpoon:"M507,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11\nc1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17\nc2,0.7,5,1,9,1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21\nc-32,-87.3,-82.7,-157.7,-152,-211c0,0,-3,-3,-3,-3l399351,0l0,-40\nc-398570,0,-399437,0,-399437,0z M593 435 v40 H399500 v-40z\nM0 281 v-40 H399908 v40z M0 281 v-40 H399908 v40z",rightharpoonaboveshortbar:"M0,241 l0,40c399126,0,399993,0,399993,0\nc4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,\n-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6\nc-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z\nM0 241 v40 H399908 v-40z M0 475 v-40 H399500 v40z M0 475 v-40 H399500 v40z",shortbaraboveleftharpoon:"M7,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11\nc1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17c2,0.7,5,1,9,\n1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21c-32,-87.3,-82.7,-157.7,\n-152,-211c0,0,-3,-3,-3,-3l399907,0l0,-40c-399126,0,-399993,0,-399993,0z\nM93 435 v40 H400000 v-40z M500 241 v40 H400000 v-40z M500 241 v40 H400000 v-40z",shortrightharpoonabovebar:"M53,241l0,40c398570,0,399437,0,399437,0\nc4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,\n-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6\nc-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z\nM500 241 v40 H399408 v-40z M500 435 v40 H400000 v-40z"},A=function(){function e(e){this.children=void 0,this.classes=void 0,this.height=void 0,this.depth=void 0,this.maxFontSize=void 0,this.style=void 0,this.children=e,this.classes=[],this.height=0,this.depth=0,this.maxFontSize=0,this.style={}}var t=e.prototype;return t.hasClass=function(e){return l.contains(this.classes,e)},t.toNode=function(){for(var e=document.createDocumentFragment(),t=0;t<this.children.length;t++)e.appendChild(this.children[t].toNode());return e},t.toMarkup=function(){for(var e="",t=0;t<this.children.length;t++)e+=this.children[t].toMarkup();return e},t.toText=function(){var e=function(e){return e.toText()};return this.children.map(e).join("")},e}(),T={"AMS-Regular":{32:[0,0,0,0,.25],65:[0,.68889,0,0,.72222],66:[0,.68889,0,0,.66667],67:[0,.68889,0,0,.72222],68:[0,.68889,0,0,.72222],69:[0,.68889,0,0,.66667],70:[0,.68889,0,0,.61111],71:[0,.68889,0,0,.77778],72:[0,.68889,0,0,.77778],73:[0,.68889,0,0,.38889],74:[.16667,.68889,0,0,.5],75:[0,.68889,0,0,.77778],76:[0,.68889,0,0,.66667],77:[0,.68889,0,0,.94445],78:[0,.68889,0,0,.72222],79:[.16667,.68889,0,0,.77778],80:[0,.68889,0,0,.61111],81:[.16667,.68889,0,0,.77778],82:[0,.68889,0,0,.72222],83:[0,.68889,0,0,.55556],84:[0,.68889,0,0,.66667],85:[0,.68889,0,0,.72222],86:[0,.68889,0,0,.72222],87:[0,.68889,0,0,1],88:[0,.68889,0,0,.72222],89:[0,.68889,0,0,.72222],90:[0,.68889,0,0,.66667],107:[0,.68889,0,0,.55556],160:[0,0,0,0,.25],165:[0,.675,.025,0,.75],174:[.15559,.69224,0,0,.94666],240:[0,.68889,0,0,.55556],295:[0,.68889,0,0,.54028],710:[0,.825,0,0,2.33334],732:[0,.9,0,0,2.33334],770:[0,.825,0,0,2.33334],771:[0,.9,0,0,2.33334],989:[.08167,.58167,0,0,.77778],1008:[0,.43056,.04028,0,.66667],8245:[0,.54986,0,0,.275],8463:[0,.68889,0,0,.54028],8487:[0,.68889,0,0,.72222],8498:[0,.68889,0,0,.55556],8502:[0,.68889,0,0,.66667],8503:[0,.68889,0,0,.44445],8504:[0,.68889,0,0,.66667],8513:[0,.68889,0,0,.63889],8592:[-.03598,.46402,0,0,.5],8594:[-.03598,.46402,0,0,.5],8602:[-.13313,.36687,0,0,1],8603:[-.13313,.36687,0,0,1],8606:[.01354,.52239,0,0,1],8608:[.01354,.52239,0,0,1],8610:[.01354,.52239,0,0,1.11111],8611:[.01354,.52239,0,0,1.11111],8619:[0,.54986,0,0,1],8620:[0,.54986,0,0,1],8621:[-.13313,.37788,0,0,1.38889],8622:[-.13313,.36687,0,0,1],8624:[0,.69224,0,0,.5],8625:[0,.69224,0,0,.5],8630:[0,.43056,0,0,1],8631:[0,.43056,0,0,1],8634:[.08198,.58198,0,0,.77778],8635:[.08198,.58198,0,0,.77778],8638:[.19444,.69224,0,0,.41667],8639:[.19444,.69224,0,0,.41667],8642:[.19444,.69224,0,0,.41667],8643:[.19444,.69224,0,0,.41667],8644:[.1808,.675,0,0,1],8646:[.1808,.675,0,0,1],8647:[.1808,.675,0,0,1],8648:[.19444,.69224,0,0,.83334],8649:[.1808,.675,0,0,1],8650:[.19444,.69224,0,0,.83334],8651:[.01354,.52239,0,0,1],8652:[.01354,.52239,0,0,1],8653:[-.13313,.36687,0,0,1],8654:[-.13313,.36687,0,0,1],8655:[-.13313,.36687,0,0,1],8666:[.13667,.63667,0,0,1],8667:[.13667,.63667,0,0,1],8669:[-.13313,.37788,0,0,1],8672:[-.064,.437,0,0,1.334],8674:[-.064,.437,0,0,1.334],8705:[0,.825,0,0,.5],8708:[0,.68889,0,0,.55556],8709:[.08167,.58167,0,0,.77778],8717:[0,.43056,0,0,.42917],8722:[-.03598,.46402,0,0,.5],8724:[.08198,.69224,0,0,.77778],8726:[.08167,.58167,0,0,.77778],8733:[0,.69224,0,0,.77778],8736:[0,.69224,0,0,.72222],8737:[0,.69224,0,0,.72222],8738:[.03517,.52239,0,0,.72222],8739:[.08167,.58167,0,0,.22222],8740:[.25142,.74111,0,0,.27778],8741:[.08167,.58167,0,0,.38889],8742:[.25142,.74111,0,0,.5],8756:[0,.69224,0,0,.66667],8757:[0,.69224,0,0,.66667],8764:[-.13313,.36687,0,0,.77778],8765:[-.13313,.37788,0,0,.77778],8769:[-.13313,.36687,0,0,.77778],8770:[-.03625,.46375,0,0,.77778],8774:[.30274,.79383,0,0,.77778],8776:[-.01688,.48312,0,0,.77778],8778:[.08167,.58167,0,0,.77778],8782:[.06062,.54986,0,0,.77778],8783:[.06062,.54986,0,0,.77778],8785:[.08198,.58198,0,0,.77778],8786:[.08198,.58198,0,0,.77778],8787:[.08198,.58198,0,0,.77778],8790:[0,.69224,0,0,.77778],8791:[.22958,.72958,0,0,.77778],8796:[.08198,.91667,0,0,.77778],8806:[.25583,.75583,0,0,.77778],8807:[.25583,.75583,0,0,.77778],8808:[.25142,.75726,0,0,.77778],8809:[.25142,.75726,0,0,.77778],8812:[.25583,.75583,0,0,.5],8814:[.20576,.70576,0,0,.77778],8815:[.20576,.70576,0,0,.77778],8816:[.30274,.79383,0,0,.77778],8817:[.30274,.79383,0,0,.77778],8818:[.22958,.72958,0,0,.77778],8819:[.22958,.72958,0,0,.77778],8822:[.1808,.675,0,0,.77778],8823:[.1808,.675,0,0,.77778],8828:[.13667,.63667,0,0,.77778],8829:[.13667,.63667,0,0,.77778],8830:[.22958,.72958,0,0,.77778],8831:[.22958,.72958,0,0,.77778],8832:[.20576,.70576,0,0,.77778],8833:[.20576,.70576,0,0,.77778],8840:[.30274,.79383,0,0,.77778],8841:[.30274,.79383,0,0,.77778],8842:[.13597,.63597,0,0,.77778],8843:[.13597,.63597,0,0,.77778],8847:[.03517,.54986,0,0,.77778],8848:[.03517,.54986,0,0,.77778],8858:[.08198,.58198,0,0,.77778],8859:[.08198,.58198,0,0,.77778],8861:[.08198,.58198,0,0,.77778],8862:[0,.675,0,0,.77778],8863:[0,.675,0,0,.77778],8864:[0,.675,0,0,.77778],8865:[0,.675,0,0,.77778],8872:[0,.69224,0,0,.61111],8873:[0,.69224,0,0,.72222],8874:[0,.69224,0,0,.88889],8876:[0,.68889,0,0,.61111],8877:[0,.68889,0,0,.61111],8878:[0,.68889,0,0,.72222],8879:[0,.68889,0,0,.72222],8882:[.03517,.54986,0,0,.77778],8883:[.03517,.54986,0,0,.77778],8884:[.13667,.63667,0,0,.77778],8885:[.13667,.63667,0,0,.77778],8888:[0,.54986,0,0,1.11111],8890:[.19444,.43056,0,0,.55556],8891:[.19444,.69224,0,0,.61111],8892:[.19444,.69224,0,0,.61111],8901:[0,.54986,0,0,.27778],8903:[.08167,.58167,0,0,.77778],8905:[.08167,.58167,0,0,.77778],8906:[.08167,.58167,0,0,.77778],8907:[0,.69224,0,0,.77778],8908:[0,.69224,0,0,.77778],8909:[-.03598,.46402,0,0,.77778],8910:[0,.54986,0,0,.76042],8911:[0,.54986,0,0,.76042],8912:[.03517,.54986,0,0,.77778],8913:[.03517,.54986,0,0,.77778],8914:[0,.54986,0,0,.66667],8915:[0,.54986,0,0,.66667],8916:[0,.69224,0,0,.66667],8918:[.0391,.5391,0,0,.77778],8919:[.0391,.5391,0,0,.77778],8920:[.03517,.54986,0,0,1.33334],8921:[.03517,.54986,0,0,1.33334],8922:[.38569,.88569,0,0,.77778],8923:[.38569,.88569,0,0,.77778],8926:[.13667,.63667,0,0,.77778],8927:[.13667,.63667,0,0,.77778],8928:[.30274,.79383,0,0,.77778],8929:[.30274,.79383,0,0,.77778],8934:[.23222,.74111,0,0,.77778],8935:[.23222,.74111,0,0,.77778],8936:[.23222,.74111,0,0,.77778],8937:[.23222,.74111,0,0,.77778],8938:[.20576,.70576,0,0,.77778],8939:[.20576,.70576,0,0,.77778],8940:[.30274,.79383,0,0,.77778],8941:[.30274,.79383,0,0,.77778],8994:[.19444,.69224,0,0,.77778],8995:[.19444,.69224,0,0,.77778],9416:[.15559,.69224,0,0,.90222],9484:[0,.69224,0,0,.5],9488:[0,.69224,0,0,.5],9492:[0,.37788,0,0,.5],9496:[0,.37788,0,0,.5],9585:[.19444,.68889,0,0,.88889],9586:[.19444,.74111,0,0,.88889],9632:[0,.675,0,0,.77778],9633:[0,.675,0,0,.77778],9650:[0,.54986,0,0,.72222],9651:[0,.54986,0,0,.72222],9654:[.03517,.54986,0,0,.77778],9660:[0,.54986,0,0,.72222],9661:[0,.54986,0,0,.72222],9664:[.03517,.54986,0,0,.77778],9674:[.11111,.69224,0,0,.66667],9733:[.19444,.69224,0,0,.94445],10003:[0,.69224,0,0,.83334],10016:[0,.69224,0,0,.83334],10731:[.11111,.69224,0,0,.66667],10846:[.19444,.75583,0,0,.61111],10877:[.13667,.63667,0,0,.77778],10878:[.13667,.63667,0,0,.77778],10885:[.25583,.75583,0,0,.77778],10886:[.25583,.75583,0,0,.77778],10887:[.13597,.63597,0,0,.77778],10888:[.13597,.63597,0,0,.77778],10889:[.26167,.75726,0,0,.77778],10890:[.26167,.75726,0,0,.77778],10891:[.48256,.98256,0,0,.77778],10892:[.48256,.98256,0,0,.77778],10901:[.13667,.63667,0,0,.77778],10902:[.13667,.63667,0,0,.77778],10933:[.25142,.75726,0,0,.77778],10934:[.25142,.75726,0,0,.77778],10935:[.26167,.75726,0,0,.77778],10936:[.26167,.75726,0,0,.77778],10937:[.26167,.75726,0,0,.77778],10938:[.26167,.75726,0,0,.77778],10949:[.25583,.75583,0,0,.77778],10950:[.25583,.75583,0,0,.77778],10955:[.28481,.79383,0,0,.77778],10956:[.28481,.79383,0,0,.77778],57350:[.08167,.58167,0,0,.22222],57351:[.08167,.58167,0,0,.38889],57352:[.08167,.58167,0,0,.77778],57353:[0,.43056,.04028,0,.66667],57356:[.25142,.75726,0,0,.77778],57357:[.25142,.75726,0,0,.77778],57358:[.41951,.91951,0,0,.77778],57359:[.30274,.79383,0,0,.77778],57360:[.30274,.79383,0,0,.77778],57361:[.41951,.91951,0,0,.77778],57366:[.25142,.75726,0,0,.77778],57367:[.25142,.75726,0,0,.77778],57368:[.25142,.75726,0,0,.77778],57369:[.25142,.75726,0,0,.77778],57370:[.13597,.63597,0,0,.77778],57371:[.13597,.63597,0,0,.77778]},"Caligraphic-Regular":{32:[0,0,0,0,.25],65:[0,.68333,0,.19445,.79847],66:[0,.68333,.03041,.13889,.65681],67:[0,.68333,.05834,.13889,.52653],68:[0,.68333,.02778,.08334,.77139],69:[0,.68333,.08944,.11111,.52778],70:[0,.68333,.09931,.11111,.71875],71:[.09722,.68333,.0593,.11111,.59487],72:[0,.68333,.00965,.11111,.84452],73:[0,.68333,.07382,0,.54452],74:[.09722,.68333,.18472,.16667,.67778],75:[0,.68333,.01445,.05556,.76195],76:[0,.68333,0,.13889,.68972],77:[0,.68333,0,.13889,1.2009],78:[0,.68333,.14736,.08334,.82049],79:[0,.68333,.02778,.11111,.79611],80:[0,.68333,.08222,.08334,.69556],81:[.09722,.68333,0,.11111,.81667],82:[0,.68333,0,.08334,.8475],83:[0,.68333,.075,.13889,.60556],84:[0,.68333,.25417,0,.54464],85:[0,.68333,.09931,.08334,.62583],86:[0,.68333,.08222,0,.61278],87:[0,.68333,.08222,.08334,.98778],88:[0,.68333,.14643,.13889,.7133],89:[.09722,.68333,.08222,.08334,.66834],90:[0,.68333,.07944,.13889,.72473],160:[0,0,0,0,.25]},"Fraktur-Regular":{32:[0,0,0,0,.25],33:[0,.69141,0,0,.29574],34:[0,.69141,0,0,.21471],38:[0,.69141,0,0,.73786],39:[0,.69141,0,0,.21201],40:[.24982,.74947,0,0,.38865],41:[.24982,.74947,0,0,.38865],42:[0,.62119,0,0,.27764],43:[.08319,.58283,0,0,.75623],44:[0,.10803,0,0,.27764],45:[.08319,.58283,0,0,.75623],46:[0,.10803,0,0,.27764],47:[.24982,.74947,0,0,.50181],48:[0,.47534,0,0,.50181],49:[0,.47534,0,0,.50181],50:[0,.47534,0,0,.50181],51:[.18906,.47534,0,0,.50181],52:[.18906,.47534,0,0,.50181],53:[.18906,.47534,0,0,.50181],54:[0,.69141,0,0,.50181],55:[.18906,.47534,0,0,.50181],56:[0,.69141,0,0,.50181],57:[.18906,.47534,0,0,.50181],58:[0,.47534,0,0,.21606],59:[.12604,.47534,0,0,.21606],61:[-.13099,.36866,0,0,.75623],63:[0,.69141,0,0,.36245],65:[0,.69141,0,0,.7176],66:[0,.69141,0,0,.88397],67:[0,.69141,0,0,.61254],68:[0,.69141,0,0,.83158],69:[0,.69141,0,0,.66278],70:[.12604,.69141,0,0,.61119],71:[0,.69141,0,0,.78539],72:[.06302,.69141,0,0,.7203],73:[0,.69141,0,0,.55448],74:[.12604,.69141,0,0,.55231],75:[0,.69141,0,0,.66845],76:[0,.69141,0,0,.66602],77:[0,.69141,0,0,1.04953],78:[0,.69141,0,0,.83212],79:[0,.69141,0,0,.82699],80:[.18906,.69141,0,0,.82753],81:[.03781,.69141,0,0,.82699],82:[0,.69141,0,0,.82807],83:[0,.69141,0,0,.82861],84:[0,.69141,0,0,.66899],85:[0,.69141,0,0,.64576],86:[0,.69141,0,0,.83131],87:[0,.69141,0,0,1.04602],88:[0,.69141,0,0,.71922],89:[.18906,.69141,0,0,.83293],90:[.12604,.69141,0,0,.60201],91:[.24982,.74947,0,0,.27764],93:[.24982,.74947,0,0,.27764],94:[0,.69141,0,0,.49965],97:[0,.47534,0,0,.50046],98:[0,.69141,0,0,.51315],99:[0,.47534,0,0,.38946],100:[0,.62119,0,0,.49857],101:[0,.47534,0,0,.40053],102:[.18906,.69141,0,0,.32626],103:[.18906,.47534,0,0,.5037],104:[.18906,.69141,0,0,.52126],105:[0,.69141,0,0,.27899],106:[0,.69141,0,0,.28088],107:[0,.69141,0,0,.38946],108:[0,.69141,0,0,.27953],109:[0,.47534,0,0,.76676],110:[0,.47534,0,0,.52666],111:[0,.47534,0,0,.48885],112:[.18906,.52396,0,0,.50046],113:[.18906,.47534,0,0,.48912],114:[0,.47534,0,0,.38919],115:[0,.47534,0,0,.44266],116:[0,.62119,0,0,.33301],117:[0,.47534,0,0,.5172],118:[0,.52396,0,0,.5118],119:[0,.52396,0,0,.77351],120:[.18906,.47534,0,0,.38865],121:[.18906,.47534,0,0,.49884],122:[.18906,.47534,0,0,.39054],160:[0,0,0,0,.25],8216:[0,.69141,0,0,.21471],8217:[0,.69141,0,0,.21471],58112:[0,.62119,0,0,.49749],58113:[0,.62119,0,0,.4983],58114:[.18906,.69141,0,0,.33328],58115:[.18906,.69141,0,0,.32923],58116:[.18906,.47534,0,0,.50343],58117:[0,.69141,0,0,.33301],58118:[0,.62119,0,0,.33409],58119:[0,.47534,0,0,.50073]},"Main-Bold":{32:[0,0,0,0,.25],33:[0,.69444,0,0,.35],34:[0,.69444,0,0,.60278],35:[.19444,.69444,0,0,.95833],36:[.05556,.75,0,0,.575],37:[.05556,.75,0,0,.95833],38:[0,.69444,0,0,.89444],39:[0,.69444,0,0,.31944],40:[.25,.75,0,0,.44722],41:[.25,.75,0,0,.44722],42:[0,.75,0,0,.575],43:[.13333,.63333,0,0,.89444],44:[.19444,.15556,0,0,.31944],45:[0,.44444,0,0,.38333],46:[0,.15556,0,0,.31944],47:[.25,.75,0,0,.575],48:[0,.64444,0,0,.575],49:[0,.64444,0,0,.575],50:[0,.64444,0,0,.575],51:[0,.64444,0,0,.575],52:[0,.64444,0,0,.575],53:[0,.64444,0,0,.575],54:[0,.64444,0,0,.575],55:[0,.64444,0,0,.575],56:[0,.64444,0,0,.575],57:[0,.64444,0,0,.575],58:[0,.44444,0,0,.31944],59:[.19444,.44444,0,0,.31944],60:[.08556,.58556,0,0,.89444],61:[-.10889,.39111,0,0,.89444],62:[.08556,.58556,0,0,.89444],63:[0,.69444,0,0,.54305],64:[0,.69444,0,0,.89444],65:[0,.68611,0,0,.86944],66:[0,.68611,0,0,.81805],67:[0,.68611,0,0,.83055],68:[0,.68611,0,0,.88194],69:[0,.68611,0,0,.75555],70:[0,.68611,0,0,.72361],71:[0,.68611,0,0,.90416],72:[0,.68611,0,0,.9],73:[0,.68611,0,0,.43611],74:[0,.68611,0,0,.59444],75:[0,.68611,0,0,.90138],76:[0,.68611,0,0,.69166],77:[0,.68611,0,0,1.09166],78:[0,.68611,0,0,.9],79:[0,.68611,0,0,.86388],80:[0,.68611,0,0,.78611],81:[.19444,.68611,0,0,.86388],82:[0,.68611,0,0,.8625],83:[0,.68611,0,0,.63889],84:[0,.68611,0,0,.8],85:[0,.68611,0,0,.88472],86:[0,.68611,.01597,0,.86944],87:[0,.68611,.01597,0,1.18888],88:[0,.68611,0,0,.86944],89:[0,.68611,.02875,0,.86944],90:[0,.68611,0,0,.70277],91:[.25,.75,0,0,.31944],92:[.25,.75,0,0,.575],93:[.25,.75,0,0,.31944],94:[0,.69444,0,0,.575],95:[.31,.13444,.03194,0,.575],97:[0,.44444,0,0,.55902],98:[0,.69444,0,0,.63889],99:[0,.44444,0,0,.51111],100:[0,.69444,0,0,.63889],101:[0,.44444,0,0,.52708],102:[0,.69444,.10903,0,.35139],103:[.19444,.44444,.01597,0,.575],104:[0,.69444,0,0,.63889],105:[0,.69444,0,0,.31944],106:[.19444,.69444,0,0,.35139],107:[0,.69444,0,0,.60694],108:[0,.69444,0,0,.31944],109:[0,.44444,0,0,.95833],110:[0,.44444,0,0,.63889],111:[0,.44444,0,0,.575],112:[.19444,.44444,0,0,.63889],113:[.19444,.44444,0,0,.60694],114:[0,.44444,0,0,.47361],115:[0,.44444,0,0,.45361],116:[0,.63492,0,0,.44722],117:[0,.44444,0,0,.63889],118:[0,.44444,.01597,0,.60694],119:[0,.44444,.01597,0,.83055],120:[0,.44444,0,0,.60694],121:[.19444,.44444,.01597,0,.60694],122:[0,.44444,0,0,.51111],123:[.25,.75,0,0,.575],124:[.25,.75,0,0,.31944],125:[.25,.75,0,0,.575],126:[.35,.34444,0,0,.575],160:[0,0,0,0,.25],163:[0,.69444,0,0,.86853],168:[0,.69444,0,0,.575],172:[0,.44444,0,0,.76666],176:[0,.69444,0,0,.86944],177:[.13333,.63333,0,0,.89444],184:[.17014,0,0,0,.51111],198:[0,.68611,0,0,1.04166],215:[.13333,.63333,0,0,.89444],216:[.04861,.73472,0,0,.89444],223:[0,.69444,0,0,.59722],230:[0,.44444,0,0,.83055],247:[.13333,.63333,0,0,.89444],248:[.09722,.54167,0,0,.575],305:[0,.44444,0,0,.31944],338:[0,.68611,0,0,1.16944],339:[0,.44444,0,0,.89444],567:[.19444,.44444,0,0,.35139],710:[0,.69444,0,0,.575],711:[0,.63194,0,0,.575],713:[0,.59611,0,0,.575],714:[0,.69444,0,0,.575],715:[0,.69444,0,0,.575],728:[0,.69444,0,0,.575],729:[0,.69444,0,0,.31944],730:[0,.69444,0,0,.86944],732:[0,.69444,0,0,.575],733:[0,.69444,0,0,.575],915:[0,.68611,0,0,.69166],916:[0,.68611,0,0,.95833],920:[0,.68611,0,0,.89444],923:[0,.68611,0,0,.80555],926:[0,.68611,0,0,.76666],928:[0,.68611,0,0,.9],931:[0,.68611,0,0,.83055],933:[0,.68611,0,0,.89444],934:[0,.68611,0,0,.83055],936:[0,.68611,0,0,.89444],937:[0,.68611,0,0,.83055],8211:[0,.44444,.03194,0,.575],8212:[0,.44444,.03194,0,1.14999],8216:[0,.69444,0,0,.31944],8217:[0,.69444,0,0,.31944],8220:[0,.69444,0,0,.60278],8221:[0,.69444,0,0,.60278],8224:[.19444,.69444,0,0,.51111],8225:[.19444,.69444,0,0,.51111],8242:[0,.55556,0,0,.34444],8407:[0,.72444,.15486,0,.575],8463:[0,.69444,0,0,.66759],8465:[0,.69444,0,0,.83055],8467:[0,.69444,0,0,.47361],8472:[.19444,.44444,0,0,.74027],8476:[0,.69444,0,0,.83055],8501:[0,.69444,0,0,.70277],8592:[-.10889,.39111,0,0,1.14999],8593:[.19444,.69444,0,0,.575],8594:[-.10889,.39111,0,0,1.14999],8595:[.19444,.69444,0,0,.575],8596:[-.10889,.39111,0,0,1.14999],8597:[.25,.75,0,0,.575],8598:[.19444,.69444,0,0,1.14999],8599:[.19444,.69444,0,0,1.14999],8600:[.19444,.69444,0,0,1.14999],8601:[.19444,.69444,0,0,1.14999],8636:[-.10889,.39111,0,0,1.14999],8637:[-.10889,.39111,0,0,1.14999],8640:[-.10889,.39111,0,0,1.14999],8641:[-.10889,.39111,0,0,1.14999],8656:[-.10889,.39111,0,0,1.14999],8657:[.19444,.69444,0,0,.70277],8658:[-.10889,.39111,0,0,1.14999],8659:[.19444,.69444,0,0,.70277],8660:[-.10889,.39111,0,0,1.14999],8661:[.25,.75,0,0,.70277],8704:[0,.69444,0,0,.63889],8706:[0,.69444,.06389,0,.62847],8707:[0,.69444,0,0,.63889],8709:[.05556,.75,0,0,.575],8711:[0,.68611,0,0,.95833],8712:[.08556,.58556,0,0,.76666],8715:[.08556,.58556,0,0,.76666],8722:[.13333,.63333,0,0,.89444],8723:[.13333,.63333,0,0,.89444],8725:[.25,.75,0,0,.575],8726:[.25,.75,0,0,.575],8727:[-.02778,.47222,0,0,.575],8728:[-.02639,.47361,0,0,.575],8729:[-.02639,.47361,0,0,.575],8730:[.18,.82,0,0,.95833],8733:[0,.44444,0,0,.89444],8734:[0,.44444,0,0,1.14999],8736:[0,.69224,0,0,.72222],8739:[.25,.75,0,0,.31944],8741:[.25,.75,0,0,.575],8743:[0,.55556,0,0,.76666],8744:[0,.55556,0,0,.76666],8745:[0,.55556,0,0,.76666],8746:[0,.55556,0,0,.76666],8747:[.19444,.69444,.12778,0,.56875],8764:[-.10889,.39111,0,0,.89444],8768:[.19444,.69444,0,0,.31944],8771:[.00222,.50222,0,0,.89444],8773:[.027,.638,0,0,.894],8776:[.02444,.52444,0,0,.89444],8781:[.00222,.50222,0,0,.89444],8801:[.00222,.50222,0,0,.89444],8804:[.19667,.69667,0,0,.89444],8805:[.19667,.69667,0,0,.89444],8810:[.08556,.58556,0,0,1.14999],8811:[.08556,.58556,0,0,1.14999],8826:[.08556,.58556,0,0,.89444],8827:[.08556,.58556,0,0,.89444],8834:[.08556,.58556,0,0,.89444],8835:[.08556,.58556,0,0,.89444],8838:[.19667,.69667,0,0,.89444],8839:[.19667,.69667,0,0,.89444],8846:[0,.55556,0,0,.76666],8849:[.19667,.69667,0,0,.89444],8850:[.19667,.69667,0,0,.89444],8851:[0,.55556,0,0,.76666],8852:[0,.55556,0,0,.76666],8853:[.13333,.63333,0,0,.89444],8854:[.13333,.63333,0,0,.89444],8855:[.13333,.63333,0,0,.89444],8856:[.13333,.63333,0,0,.89444],8857:[.13333,.63333,0,0,.89444],8866:[0,.69444,0,0,.70277],8867:[0,.69444,0,0,.70277],8868:[0,.69444,0,0,.89444],8869:[0,.69444,0,0,.89444],8900:[-.02639,.47361,0,0,.575],8901:[-.02639,.47361,0,0,.31944],8902:[-.02778,.47222,0,0,.575],8968:[.25,.75,0,0,.51111],8969:[.25,.75,0,0,.51111],8970:[.25,.75,0,0,.51111],8971:[.25,.75,0,0,.51111],8994:[-.13889,.36111,0,0,1.14999],8995:[-.13889,.36111,0,0,1.14999],9651:[.19444,.69444,0,0,1.02222],9657:[-.02778,.47222,0,0,.575],9661:[.19444,.69444,0,0,1.02222],9667:[-.02778,.47222,0,0,.575],9711:[.19444,.69444,0,0,1.14999],9824:[.12963,.69444,0,0,.89444],9825:[.12963,.69444,0,0,.89444],9826:[.12963,.69444,0,0,.89444],9827:[.12963,.69444,0,0,.89444],9837:[0,.75,0,0,.44722],9838:[.19444,.69444,0,0,.44722],9839:[.19444,.69444,0,0,.44722],10216:[.25,.75,0,0,.44722],10217:[.25,.75,0,0,.44722],10815:[0,.68611,0,0,.9],10927:[.19667,.69667,0,0,.89444],10928:[.19667,.69667,0,0,.89444],57376:[.19444,.69444,0,0,0]},"Main-BoldItalic":{32:[0,0,0,0,.25],33:[0,.69444,.11417,0,.38611],34:[0,.69444,.07939,0,.62055],35:[.19444,.69444,.06833,0,.94444],37:[.05556,.75,.12861,0,.94444],38:[0,.69444,.08528,0,.88555],39:[0,.69444,.12945,0,.35555],40:[.25,.75,.15806,0,.47333],41:[.25,.75,.03306,0,.47333],42:[0,.75,.14333,0,.59111],43:[.10333,.60333,.03306,0,.88555],44:[.19444,.14722,0,0,.35555],45:[0,.44444,.02611,0,.41444],46:[0,.14722,0,0,.35555],47:[.25,.75,.15806,0,.59111],48:[0,.64444,.13167,0,.59111],49:[0,.64444,.13167,0,.59111],50:[0,.64444,.13167,0,.59111],51:[0,.64444,.13167,0,.59111],52:[.19444,.64444,.13167,0,.59111],53:[0,.64444,.13167,0,.59111],54:[0,.64444,.13167,0,.59111],55:[.19444,.64444,.13167,0,.59111],56:[0,.64444,.13167,0,.59111],57:[0,.64444,.13167,0,.59111],58:[0,.44444,.06695,0,.35555],59:[.19444,.44444,.06695,0,.35555],61:[-.10889,.39111,.06833,0,.88555],63:[0,.69444,.11472,0,.59111],64:[0,.69444,.09208,0,.88555],65:[0,.68611,0,0,.86555],66:[0,.68611,.0992,0,.81666],67:[0,.68611,.14208,0,.82666],68:[0,.68611,.09062,0,.87555],69:[0,.68611,.11431,0,.75666],70:[0,.68611,.12903,0,.72722],71:[0,.68611,.07347,0,.89527],72:[0,.68611,.17208,0,.8961],73:[0,.68611,.15681,0,.47166],74:[0,.68611,.145,0,.61055],75:[0,.68611,.14208,0,.89499],76:[0,.68611,0,0,.69777],77:[0,.68611,.17208,0,1.07277],78:[0,.68611,.17208,0,.8961],79:[0,.68611,.09062,0,.85499],80:[0,.68611,.0992,0,.78721],81:[.19444,.68611,.09062,0,.85499],82:[0,.68611,.02559,0,.85944],83:[0,.68611,.11264,0,.64999],84:[0,.68611,.12903,0,.7961],85:[0,.68611,.17208,0,.88083],86:[0,.68611,.18625,0,.86555],87:[0,.68611,.18625,0,1.15999],88:[0,.68611,.15681,0,.86555],89:[0,.68611,.19803,0,.86555],90:[0,.68611,.14208,0,.70888],91:[.25,.75,.1875,0,.35611],93:[.25,.75,.09972,0,.35611],94:[0,.69444,.06709,0,.59111],95:[.31,.13444,.09811,0,.59111],97:[0,.44444,.09426,0,.59111],98:[0,.69444,.07861,0,.53222],99:[0,.44444,.05222,0,.53222],100:[0,.69444,.10861,0,.59111],101:[0,.44444,.085,0,.53222],102:[.19444,.69444,.21778,0,.4],103:[.19444,.44444,.105,0,.53222],104:[0,.69444,.09426,0,.59111],105:[0,.69326,.11387,0,.35555],106:[.19444,.69326,.1672,0,.35555],107:[0,.69444,.11111,0,.53222],108:[0,.69444,.10861,0,.29666],109:[0,.44444,.09426,0,.94444],110:[0,.44444,.09426,0,.64999],111:[0,.44444,.07861,0,.59111],112:[.19444,.44444,.07861,0,.59111],113:[.19444,.44444,.105,0,.53222],114:[0,.44444,.11111,0,.50167],115:[0,.44444,.08167,0,.48694],116:[0,.63492,.09639,0,.385],117:[0,.44444,.09426,0,.62055],118:[0,.44444,.11111,0,.53222],119:[0,.44444,.11111,0,.76777],120:[0,.44444,.12583,0,.56055],121:[.19444,.44444,.105,0,.56166],122:[0,.44444,.13889,0,.49055],126:[.35,.34444,.11472,0,.59111],160:[0,0,0,0,.25],168:[0,.69444,.11473,0,.59111],176:[0,.69444,0,0,.94888],184:[.17014,0,0,0,.53222],198:[0,.68611,.11431,0,1.02277],216:[.04861,.73472,.09062,0,.88555],223:[.19444,.69444,.09736,0,.665],230:[0,.44444,.085,0,.82666],248:[.09722,.54167,.09458,0,.59111],305:[0,.44444,.09426,0,.35555],338:[0,.68611,.11431,0,1.14054],339:[0,.44444,.085,0,.82666],567:[.19444,.44444,.04611,0,.385],710:[0,.69444,.06709,0,.59111],711:[0,.63194,.08271,0,.59111],713:[0,.59444,.10444,0,.59111],714:[0,.69444,.08528,0,.59111],715:[0,.69444,0,0,.59111],728:[0,.69444,.10333,0,.59111],729:[0,.69444,.12945,0,.35555],730:[0,.69444,0,0,.94888],732:[0,.69444,.11472,0,.59111],733:[0,.69444,.11472,0,.59111],915:[0,.68611,.12903,0,.69777],916:[0,.68611,0,0,.94444],920:[0,.68611,.09062,0,.88555],923:[0,.68611,0,0,.80666],926:[0,.68611,.15092,0,.76777],928:[0,.68611,.17208,0,.8961],931:[0,.68611,.11431,0,.82666],933:[0,.68611,.10778,0,.88555],934:[0,.68611,.05632,0,.82666],936:[0,.68611,.10778,0,.88555],937:[0,.68611,.0992,0,.82666],8211:[0,.44444,.09811,0,.59111],8212:[0,.44444,.09811,0,1.18221],8216:[0,.69444,.12945,0,.35555],8217:[0,.69444,.12945,0,.35555],8220:[0,.69444,.16772,0,.62055],8221:[0,.69444,.07939,0,.62055]},"Main-Italic":{32:[0,0,0,0,.25],33:[0,.69444,.12417,0,.30667],34:[0,.69444,.06961,0,.51444],35:[.19444,.69444,.06616,0,.81777],37:[.05556,.75,.13639,0,.81777],38:[0,.69444,.09694,0,.76666],39:[0,.69444,.12417,0,.30667],40:[.25,.75,.16194,0,.40889],41:[.25,.75,.03694,0,.40889],42:[0,.75,.14917,0,.51111],43:[.05667,.56167,.03694,0,.76666],44:[.19444,.10556,0,0,.30667],45:[0,.43056,.02826,0,.35778],46:[0,.10556,0,0,.30667],47:[.25,.75,.16194,0,.51111],48:[0,.64444,.13556,0,.51111],49:[0,.64444,.13556,0,.51111],50:[0,.64444,.13556,0,.51111],51:[0,.64444,.13556,0,.51111],52:[.19444,.64444,.13556,0,.51111],53:[0,.64444,.13556,0,.51111],54:[0,.64444,.13556,0,.51111],55:[.19444,.64444,.13556,0,.51111],56:[0,.64444,.13556,0,.51111],57:[0,.64444,.13556,0,.51111],58:[0,.43056,.0582,0,.30667],59:[.19444,.43056,.0582,0,.30667],61:[-.13313,.36687,.06616,0,.76666],63:[0,.69444,.1225,0,.51111],64:[0,.69444,.09597,0,.76666],65:[0,.68333,0,0,.74333],66:[0,.68333,.10257,0,.70389],67:[0,.68333,.14528,0,.71555],68:[0,.68333,.09403,0,.755],69:[0,.68333,.12028,0,.67833],70:[0,.68333,.13305,0,.65277],71:[0,.68333,.08722,0,.77361],72:[0,.68333,.16389,0,.74333],73:[0,.68333,.15806,0,.38555],74:[0,.68333,.14028,0,.525],75:[0,.68333,.14528,0,.76888],76:[0,.68333,0,0,.62722],77:[0,.68333,.16389,0,.89666],78:[0,.68333,.16389,0,.74333],79:[0,.68333,.09403,0,.76666],80:[0,.68333,.10257,0,.67833],81:[.19444,.68333,.09403,0,.76666],82:[0,.68333,.03868,0,.72944],83:[0,.68333,.11972,0,.56222],84:[0,.68333,.13305,0,.71555],85:[0,.68333,.16389,0,.74333],86:[0,.68333,.18361,0,.74333],87:[0,.68333,.18361,0,.99888],88:[0,.68333,.15806,0,.74333],89:[0,.68333,.19383,0,.74333],90:[0,.68333,.14528,0,.61333],91:[.25,.75,.1875,0,.30667],93:[.25,.75,.10528,0,.30667],94:[0,.69444,.06646,0,.51111],95:[.31,.12056,.09208,0,.51111],97:[0,.43056,.07671,0,.51111],98:[0,.69444,.06312,0,.46],99:[0,.43056,.05653,0,.46],100:[0,.69444,.10333,0,.51111],101:[0,.43056,.07514,0,.46],102:[.19444,.69444,.21194,0,.30667],103:[.19444,.43056,.08847,0,.46],104:[0,.69444,.07671,0,.51111],105:[0,.65536,.1019,0,.30667],106:[.19444,.65536,.14467,0,.30667],107:[0,.69444,.10764,0,.46],108:[0,.69444,.10333,0,.25555],109:[0,.43056,.07671,0,.81777],110:[0,.43056,.07671,0,.56222],111:[0,.43056,.06312,0,.51111],112:[.19444,.43056,.06312,0,.51111],113:[.19444,.43056,.08847,0,.46],114:[0,.43056,.10764,0,.42166],115:[0,.43056,.08208,0,.40889],116:[0,.61508,.09486,0,.33222],117:[0,.43056,.07671,0,.53666],118:[0,.43056,.10764,0,.46],119:[0,.43056,.10764,0,.66444],120:[0,.43056,.12042,0,.46389],121:[.19444,.43056,.08847,0,.48555],122:[0,.43056,.12292,0,.40889],126:[.35,.31786,.11585,0,.51111],160:[0,0,0,0,.25],168:[0,.66786,.10474,0,.51111],176:[0,.69444,0,0,.83129],184:[.17014,0,0,0,.46],198:[0,.68333,.12028,0,.88277],216:[.04861,.73194,.09403,0,.76666],223:[.19444,.69444,.10514,0,.53666],230:[0,.43056,.07514,0,.71555],248:[.09722,.52778,.09194,0,.51111],338:[0,.68333,.12028,0,.98499],339:[0,.43056,.07514,0,.71555],710:[0,.69444,.06646,0,.51111],711:[0,.62847,.08295,0,.51111],713:[0,.56167,.10333,0,.51111],714:[0,.69444,.09694,0,.51111],715:[0,.69444,0,0,.51111],728:[0,.69444,.10806,0,.51111],729:[0,.66786,.11752,0,.30667],730:[0,.69444,0,0,.83129],732:[0,.66786,.11585,0,.51111],733:[0,.69444,.1225,0,.51111],915:[0,.68333,.13305,0,.62722],916:[0,.68333,0,0,.81777],920:[0,.68333,.09403,0,.76666],923:[0,.68333,0,0,.69222],926:[0,.68333,.15294,0,.66444],928:[0,.68333,.16389,0,.74333],931:[0,.68333,.12028,0,.71555],933:[0,.68333,.11111,0,.76666],934:[0,.68333,.05986,0,.71555],936:[0,.68333,.11111,0,.76666],937:[0,.68333,.10257,0,.71555],8211:[0,.43056,.09208,0,.51111],8212:[0,.43056,.09208,0,1.02222],8216:[0,.69444,.12417,0,.30667],8217:[0,.69444,.12417,0,.30667],8220:[0,.69444,.1685,0,.51444],8221:[0,.69444,.06961,0,.51444],8463:[0,.68889,0,0,.54028]},"Main-Regular":{32:[0,0,0,0,.25],33:[0,.69444,0,0,.27778],34:[0,.69444,0,0,.5],35:[.19444,.69444,0,0,.83334],36:[.05556,.75,0,0,.5],37:[.05556,.75,0,0,.83334],38:[0,.69444,0,0,.77778],39:[0,.69444,0,0,.27778],40:[.25,.75,0,0,.38889],41:[.25,.75,0,0,.38889],42:[0,.75,0,0,.5],43:[.08333,.58333,0,0,.77778],44:[.19444,.10556,0,0,.27778],45:[0,.43056,0,0,.33333],46:[0,.10556,0,0,.27778],47:[.25,.75,0,0,.5],48:[0,.64444,0,0,.5],49:[0,.64444,0,0,.5],50:[0,.64444,0,0,.5],51:[0,.64444,0,0,.5],52:[0,.64444,0,0,.5],53:[0,.64444,0,0,.5],54:[0,.64444,0,0,.5],55:[0,.64444,0,0,.5],56:[0,.64444,0,0,.5],57:[0,.64444,0,0,.5],58:[0,.43056,0,0,.27778],59:[.19444,.43056,0,0,.27778],60:[.0391,.5391,0,0,.77778],61:[-.13313,.36687,0,0,.77778],62:[.0391,.5391,0,0,.77778],63:[0,.69444,0,0,.47222],64:[0,.69444,0,0,.77778],65:[0,.68333,0,0,.75],66:[0,.68333,0,0,.70834],67:[0,.68333,0,0,.72222],68:[0,.68333,0,0,.76389],69:[0,.68333,0,0,.68056],70:[0,.68333,0,0,.65278],71:[0,.68333,0,0,.78472],72:[0,.68333,0,0,.75],73:[0,.68333,0,0,.36111],74:[0,.68333,0,0,.51389],75:[0,.68333,0,0,.77778],76:[0,.68333,0,0,.625],77:[0,.68333,0,0,.91667],78:[0,.68333,0,0,.75],79:[0,.68333,0,0,.77778],80:[0,.68333,0,0,.68056],81:[.19444,.68333,0,0,.77778],82:[0,.68333,0,0,.73611],83:[0,.68333,0,0,.55556],84:[0,.68333,0,0,.72222],85:[0,.68333,0,0,.75],86:[0,.68333,.01389,0,.75],87:[0,.68333,.01389,0,1.02778],88:[0,.68333,0,0,.75],89:[0,.68333,.025,0,.75],90:[0,.68333,0,0,.61111],91:[.25,.75,0,0,.27778],92:[.25,.75,0,0,.5],93:[.25,.75,0,0,.27778],94:[0,.69444,0,0,.5],95:[.31,.12056,.02778,0,.5],97:[0,.43056,0,0,.5],98:[0,.69444,0,0,.55556],99:[0,.43056,0,0,.44445],100:[0,.69444,0,0,.55556],101:[0,.43056,0,0,.44445],102:[0,.69444,.07778,0,.30556],103:[.19444,.43056,.01389,0,.5],104:[0,.69444,0,0,.55556],105:[0,.66786,0,0,.27778],106:[.19444,.66786,0,0,.30556],107:[0,.69444,0,0,.52778],108:[0,.69444,0,0,.27778],109:[0,.43056,0,0,.83334],110:[0,.43056,0,0,.55556],111:[0,.43056,0,0,.5],112:[.19444,.43056,0,0,.55556],113:[.19444,.43056,0,0,.52778],114:[0,.43056,0,0,.39167],115:[0,.43056,0,0,.39445],116:[0,.61508,0,0,.38889],117:[0,.43056,0,0,.55556],118:[0,.43056,.01389,0,.52778],119:[0,.43056,.01389,0,.72222],120:[0,.43056,0,0,.52778],121:[.19444,.43056,.01389,0,.52778],122:[0,.43056,0,0,.44445],123:[.25,.75,0,0,.5],124:[.25,.75,0,0,.27778],125:[.25,.75,0,0,.5],126:[.35,.31786,0,0,.5],160:[0,0,0,0,.25],163:[0,.69444,0,0,.76909],167:[.19444,.69444,0,0,.44445],168:[0,.66786,0,0,.5],172:[0,.43056,0,0,.66667],176:[0,.69444,0,0,.75],177:[.08333,.58333,0,0,.77778],182:[.19444,.69444,0,0,.61111],184:[.17014,0,0,0,.44445],198:[0,.68333,0,0,.90278],215:[.08333,.58333,0,0,.77778],216:[.04861,.73194,0,0,.77778],223:[0,.69444,0,0,.5],230:[0,.43056,0,0,.72222],247:[.08333,.58333,0,0,.77778],248:[.09722,.52778,0,0,.5],305:[0,.43056,0,0,.27778],338:[0,.68333,0,0,1.01389],339:[0,.43056,0,0,.77778],567:[.19444,.43056,0,0,.30556],710:[0,.69444,0,0,.5],711:[0,.62847,0,0,.5],713:[0,.56778,0,0,.5],714:[0,.69444,0,0,.5],715:[0,.69444,0,0,.5],728:[0,.69444,0,0,.5],729:[0,.66786,0,0,.27778],730:[0,.69444,0,0,.75],732:[0,.66786,0,0,.5],733:[0,.69444,0,0,.5],915:[0,.68333,0,0,.625],916:[0,.68333,0,0,.83334],920:[0,.68333,0,0,.77778],923:[0,.68333,0,0,.69445],926:[0,.68333,0,0,.66667],928:[0,.68333,0,0,.75],931:[0,.68333,0,0,.72222],933:[0,.68333,0,0,.77778],934:[0,.68333,0,0,.72222],936:[0,.68333,0,0,.77778],937:[0,.68333,0,0,.72222],8211:[0,.43056,.02778,0,.5],8212:[0,.43056,.02778,0,1],8216:[0,.69444,0,0,.27778],8217:[0,.69444,0,0,.27778],8220:[0,.69444,0,0,.5],8221:[0,.69444,0,0,.5],8224:[.19444,.69444,0,0,.44445],8225:[.19444,.69444,0,0,.44445],8230:[0,.123,0,0,1.172],8242:[0,.55556,0,0,.275],8407:[0,.71444,.15382,0,.5],8463:[0,.68889,0,0,.54028],8465:[0,.69444,0,0,.72222],8467:[0,.69444,0,.11111,.41667],8472:[.19444,.43056,0,.11111,.63646],8476:[0,.69444,0,0,.72222],8501:[0,.69444,0,0,.61111],8592:[-.13313,.36687,0,0,1],8593:[.19444,.69444,0,0,.5],8594:[-.13313,.36687,0,0,1],8595:[.19444,.69444,0,0,.5],8596:[-.13313,.36687,0,0,1],8597:[.25,.75,0,0,.5],8598:[.19444,.69444,0,0,1],8599:[.19444,.69444,0,0,1],8600:[.19444,.69444,0,0,1],8601:[.19444,.69444,0,0,1],8614:[.011,.511,0,0,1],8617:[.011,.511,0,0,1.126],8618:[.011,.511,0,0,1.126],8636:[-.13313,.36687,0,0,1],8637:[-.13313,.36687,0,0,1],8640:[-.13313,.36687,0,0,1],8641:[-.13313,.36687,0,0,1],8652:[.011,.671,0,0,1],8656:[-.13313,.36687,0,0,1],8657:[.19444,.69444,0,0,.61111],8658:[-.13313,.36687,0,0,1],8659:[.19444,.69444,0,0,.61111],8660:[-.13313,.36687,0,0,1],8661:[.25,.75,0,0,.61111],8704:[0,.69444,0,0,.55556],8706:[0,.69444,.05556,.08334,.5309],8707:[0,.69444,0,0,.55556],8709:[.05556,.75,0,0,.5],8711:[0,.68333,0,0,.83334],8712:[.0391,.5391,0,0,.66667],8715:[.0391,.5391,0,0,.66667],8722:[.08333,.58333,0,0,.77778],8723:[.08333,.58333,0,0,.77778],8725:[.25,.75,0,0,.5],8726:[.25,.75,0,0,.5],8727:[-.03472,.46528,0,0,.5],8728:[-.05555,.44445,0,0,.5],8729:[-.05555,.44445,0,0,.5],8730:[.2,.8,0,0,.83334],8733:[0,.43056,0,0,.77778],8734:[0,.43056,0,0,1],8736:[0,.69224,0,0,.72222],8739:[.25,.75,0,0,.27778],8741:[.25,.75,0,0,.5],8743:[0,.55556,0,0,.66667],8744:[0,.55556,0,0,.66667],8745:[0,.55556,0,0,.66667],8746:[0,.55556,0,0,.66667],8747:[.19444,.69444,.11111,0,.41667],8764:[-.13313,.36687,0,0,.77778],8768:[.19444,.69444,0,0,.27778],8771:[-.03625,.46375,0,0,.77778],8773:[-.022,.589,0,0,.778],8776:[-.01688,.48312,0,0,.77778],8781:[-.03625,.46375,0,0,.77778],8784:[-.133,.673,0,0,.778],8801:[-.03625,.46375,0,0,.77778],8804:[.13597,.63597,0,0,.77778],8805:[.13597,.63597,0,0,.77778],8810:[.0391,.5391,0,0,1],8811:[.0391,.5391,0,0,1],8826:[.0391,.5391,0,0,.77778],8827:[.0391,.5391,0,0,.77778],8834:[.0391,.5391,0,0,.77778],8835:[.0391,.5391,0,0,.77778],8838:[.13597,.63597,0,0,.77778],8839:[.13597,.63597,0,0,.77778],8846:[0,.55556,0,0,.66667],8849:[.13597,.63597,0,0,.77778],8850:[.13597,.63597,0,0,.77778],8851:[0,.55556,0,0,.66667],8852:[0,.55556,0,0,.66667],8853:[.08333,.58333,0,0,.77778],8854:[.08333,.58333,0,0,.77778],8855:[.08333,.58333,0,0,.77778],8856:[.08333,.58333,0,0,.77778],8857:[.08333,.58333,0,0,.77778],8866:[0,.69444,0,0,.61111],8867:[0,.69444,0,0,.61111],8868:[0,.69444,0,0,.77778],8869:[0,.69444,0,0,.77778],8872:[.249,.75,0,0,.867],8900:[-.05555,.44445,0,0,.5],8901:[-.05555,.44445,0,0,.27778],8902:[-.03472,.46528,0,0,.5],8904:[.005,.505,0,0,.9],8942:[.03,.903,0,0,.278],8943:[-.19,.313,0,0,1.172],8945:[-.1,.823,0,0,1.282],8968:[.25,.75,0,0,.44445],8969:[.25,.75,0,0,.44445],8970:[.25,.75,0,0,.44445],8971:[.25,.75,0,0,.44445],8994:[-.14236,.35764,0,0,1],8995:[-.14236,.35764,0,0,1],9136:[.244,.744,0,0,.412],9137:[.244,.745,0,0,.412],9651:[.19444,.69444,0,0,.88889],9657:[-.03472,.46528,0,0,.5],9661:[.19444,.69444,0,0,.88889],9667:[-.03472,.46528,0,0,.5],9711:[.19444,.69444,0,0,1],9824:[.12963,.69444,0,0,.77778],9825:[.12963,.69444,0,0,.77778],9826:[.12963,.69444,0,0,.77778],9827:[.12963,.69444,0,0,.77778],9837:[0,.75,0,0,.38889],9838:[.19444,.69444,0,0,.38889],9839:[.19444,.69444,0,0,.38889],10216:[.25,.75,0,0,.38889],10217:[.25,.75,0,0,.38889],10222:[.244,.744,0,0,.412],10223:[.244,.745,0,0,.412],10229:[.011,.511,0,0,1.609],10230:[.011,.511,0,0,1.638],10231:[.011,.511,0,0,1.859],10232:[.024,.525,0,0,1.609],10233:[.024,.525,0,0,1.638],10234:[.024,.525,0,0,1.858],10236:[.011,.511,0,0,1.638],10815:[0,.68333,0,0,.75],10927:[.13597,.63597,0,0,.77778],10928:[.13597,.63597,0,0,.77778],57376:[.19444,.69444,0,0,0]},"Math-BoldItalic":{32:[0,0,0,0,.25],48:[0,.44444,0,0,.575],49:[0,.44444,0,0,.575],50:[0,.44444,0,0,.575],51:[.19444,.44444,0,0,.575],52:[.19444,.44444,0,0,.575],53:[.19444,.44444,0,0,.575],54:[0,.64444,0,0,.575],55:[.19444,.44444,0,0,.575],56:[0,.64444,0,0,.575],57:[.19444,.44444,0,0,.575],65:[0,.68611,0,0,.86944],66:[0,.68611,.04835,0,.8664],67:[0,.68611,.06979,0,.81694],68:[0,.68611,.03194,0,.93812],69:[0,.68611,.05451,0,.81007],70:[0,.68611,.15972,0,.68889],71:[0,.68611,0,0,.88673],72:[0,.68611,.08229,0,.98229],73:[0,.68611,.07778,0,.51111],74:[0,.68611,.10069,0,.63125],75:[0,.68611,.06979,0,.97118],76:[0,.68611,0,0,.75555],77:[0,.68611,.11424,0,1.14201],78:[0,.68611,.11424,0,.95034],79:[0,.68611,.03194,0,.83666],80:[0,.68611,.15972,0,.72309],81:[.19444,.68611,0,0,.86861],82:[0,.68611,.00421,0,.87235],83:[0,.68611,.05382,0,.69271],84:[0,.68611,.15972,0,.63663],85:[0,.68611,.11424,0,.80027],86:[0,.68611,.25555,0,.67778],87:[0,.68611,.15972,0,1.09305],88:[0,.68611,.07778,0,.94722],89:[0,.68611,.25555,0,.67458],90:[0,.68611,.06979,0,.77257],97:[0,.44444,0,0,.63287],98:[0,.69444,0,0,.52083],99:[0,.44444,0,0,.51342],100:[0,.69444,0,0,.60972],101:[0,.44444,0,0,.55361],102:[.19444,.69444,.11042,0,.56806],103:[.19444,.44444,.03704,0,.5449],104:[0,.69444,0,0,.66759],105:[0,.69326,0,0,.4048],106:[.19444,.69326,.0622,0,.47083],107:[0,.69444,.01852,0,.6037],108:[0,.69444,.0088,0,.34815],109:[0,.44444,0,0,1.0324],110:[0,.44444,0,0,.71296],111:[0,.44444,0,0,.58472],112:[.19444,.44444,0,0,.60092],113:[.19444,.44444,.03704,0,.54213],114:[0,.44444,.03194,0,.5287],115:[0,.44444,0,0,.53125],116:[0,.63492,0,0,.41528],117:[0,.44444,0,0,.68102],118:[0,.44444,.03704,0,.56666],119:[0,.44444,.02778,0,.83148],120:[0,.44444,0,0,.65903],121:[.19444,.44444,.03704,0,.59028],122:[0,.44444,.04213,0,.55509],160:[0,0,0,0,.25],915:[0,.68611,.15972,0,.65694],916:[0,.68611,0,0,.95833],920:[0,.68611,.03194,0,.86722],923:[0,.68611,0,0,.80555],926:[0,.68611,.07458,0,.84125],928:[0,.68611,.08229,0,.98229],931:[0,.68611,.05451,0,.88507],933:[0,.68611,.15972,0,.67083],934:[0,.68611,0,0,.76666],936:[0,.68611,.11653,0,.71402],937:[0,.68611,.04835,0,.8789],945:[0,.44444,0,0,.76064],946:[.19444,.69444,.03403,0,.65972],947:[.19444,.44444,.06389,0,.59003],948:[0,.69444,.03819,0,.52222],949:[0,.44444,0,0,.52882],950:[.19444,.69444,.06215,0,.50833],951:[.19444,.44444,.03704,0,.6],952:[0,.69444,.03194,0,.5618],953:[0,.44444,0,0,.41204],954:[0,.44444,0,0,.66759],955:[0,.69444,0,0,.67083],956:[.19444,.44444,0,0,.70787],957:[0,.44444,.06898,0,.57685],958:[.19444,.69444,.03021,0,.50833],959:[0,.44444,0,0,.58472],960:[0,.44444,.03704,0,.68241],961:[.19444,.44444,0,0,.6118],962:[.09722,.44444,.07917,0,.42361],963:[0,.44444,.03704,0,.68588],964:[0,.44444,.13472,0,.52083],965:[0,.44444,.03704,0,.63055],966:[.19444,.44444,0,0,.74722],967:[.19444,.44444,0,0,.71805],968:[.19444,.69444,.03704,0,.75833],969:[0,.44444,.03704,0,.71782],977:[0,.69444,0,0,.69155],981:[.19444,.69444,0,0,.7125],982:[0,.44444,.03194,0,.975],1009:[.19444,.44444,0,0,.6118],1013:[0,.44444,0,0,.48333],57649:[0,.44444,0,0,.39352],57911:[.19444,.44444,0,0,.43889]},"Math-Italic":{32:[0,0,0,0,.25],48:[0,.43056,0,0,.5],49:[0,.43056,0,0,.5],50:[0,.43056,0,0,.5],51:[.19444,.43056,0,0,.5],52:[.19444,.43056,0,0,.5],53:[.19444,.43056,0,0,.5],54:[0,.64444,0,0,.5],55:[.19444,.43056,0,0,.5],56:[0,.64444,0,0,.5],57:[.19444,.43056,0,0,.5],65:[0,.68333,0,.13889,.75],66:[0,.68333,.05017,.08334,.75851],67:[0,.68333,.07153,.08334,.71472],68:[0,.68333,.02778,.05556,.82792],69:[0,.68333,.05764,.08334,.7382],70:[0,.68333,.13889,.08334,.64306],71:[0,.68333,0,.08334,.78625],72:[0,.68333,.08125,.05556,.83125],73:[0,.68333,.07847,.11111,.43958],74:[0,.68333,.09618,.16667,.55451],75:[0,.68333,.07153,.05556,.84931],76:[0,.68333,0,.02778,.68056],77:[0,.68333,.10903,.08334,.97014],78:[0,.68333,.10903,.08334,.80347],79:[0,.68333,.02778,.08334,.76278],80:[0,.68333,.13889,.08334,.64201],81:[.19444,.68333,0,.08334,.79056],82:[0,.68333,.00773,.08334,.75929],83:[0,.68333,.05764,.08334,.6132],84:[0,.68333,.13889,.08334,.58438],85:[0,.68333,.10903,.02778,.68278],86:[0,.68333,.22222,0,.58333],87:[0,.68333,.13889,0,.94445],88:[0,.68333,.07847,.08334,.82847],89:[0,.68333,.22222,0,.58056],90:[0,.68333,.07153,.08334,.68264],97:[0,.43056,0,0,.52859],98:[0,.69444,0,0,.42917],99:[0,.43056,0,.05556,.43276],100:[0,.69444,0,.16667,.52049],101:[0,.43056,0,.05556,.46563],102:[.19444,.69444,.10764,.16667,.48959],103:[.19444,.43056,.03588,.02778,.47697],104:[0,.69444,0,0,.57616],105:[0,.65952,0,0,.34451],106:[.19444,.65952,.05724,0,.41181],107:[0,.69444,.03148,0,.5206],108:[0,.69444,.01968,.08334,.29838],109:[0,.43056,0,0,.87801],110:[0,.43056,0,0,.60023],111:[0,.43056,0,.05556,.48472],112:[.19444,.43056,0,.08334,.50313],113:[.19444,.43056,.03588,.08334,.44641],114:[0,.43056,.02778,.05556,.45116],115:[0,.43056,0,.05556,.46875],116:[0,.61508,0,.08334,.36111],117:[0,.43056,0,.02778,.57246],118:[0,.43056,.03588,.02778,.48472],119:[0,.43056,.02691,.08334,.71592],120:[0,.43056,0,.02778,.57153],121:[.19444,.43056,.03588,.05556,.49028],122:[0,.43056,.04398,.05556,.46505],160:[0,0,0,0,.25],915:[0,.68333,.13889,.08334,.61528],916:[0,.68333,0,.16667,.83334],920:[0,.68333,.02778,.08334,.76278],923:[0,.68333,0,.16667,.69445],926:[0,.68333,.07569,.08334,.74236],928:[0,.68333,.08125,.05556,.83125],931:[0,.68333,.05764,.08334,.77986],933:[0,.68333,.13889,.05556,.58333],934:[0,.68333,0,.08334,.66667],936:[0,.68333,.11,.05556,.61222],937:[0,.68333,.05017,.08334,.7724],945:[0,.43056,.0037,.02778,.6397],946:[.19444,.69444,.05278,.08334,.56563],947:[.19444,.43056,.05556,0,.51773],948:[0,.69444,.03785,.05556,.44444],949:[0,.43056,0,.08334,.46632],950:[.19444,.69444,.07378,.08334,.4375],951:[.19444,.43056,.03588,.05556,.49653],952:[0,.69444,.02778,.08334,.46944],953:[0,.43056,0,.05556,.35394],954:[0,.43056,0,0,.57616],955:[0,.69444,0,0,.58334],956:[.19444,.43056,0,.02778,.60255],957:[0,.43056,.06366,.02778,.49398],958:[.19444,.69444,.04601,.11111,.4375],959:[0,.43056,0,.05556,.48472],960:[0,.43056,.03588,0,.57003],961:[.19444,.43056,0,.08334,.51702],962:[.09722,.43056,.07986,.08334,.36285],963:[0,.43056,.03588,0,.57141],964:[0,.43056,.1132,.02778,.43715],965:[0,.43056,.03588,.02778,.54028],966:[.19444,.43056,0,.08334,.65417],967:[.19444,.43056,0,.05556,.62569],968:[.19444,.69444,.03588,.11111,.65139],969:[0,.43056,.03588,0,.62245],977:[0,.69444,0,.08334,.59144],981:[.19444,.69444,0,.08334,.59583],982:[0,.43056,.02778,0,.82813],1009:[.19444,.43056,0,.08334,.51702],1013:[0,.43056,0,.05556,.4059],57649:[0,.43056,0,.02778,.32246],57911:[.19444,.43056,0,.08334,.38403]},"SansSerif-Bold":{32:[0,0,0,0,.25],33:[0,.69444,0,0,.36667],34:[0,.69444,0,0,.55834],35:[.19444,.69444,0,0,.91667],36:[.05556,.75,0,0,.55],37:[.05556,.75,0,0,1.02912],38:[0,.69444,0,0,.83056],39:[0,.69444,0,0,.30556],40:[.25,.75,0,0,.42778],41:[.25,.75,0,0,.42778],42:[0,.75,0,0,.55],43:[.11667,.61667,0,0,.85556],44:[.10556,.13056,0,0,.30556],45:[0,.45833,0,0,.36667],46:[0,.13056,0,0,.30556],47:[.25,.75,0,0,.55],48:[0,.69444,0,0,.55],49:[0,.69444,0,0,.55],50:[0,.69444,0,0,.55],51:[0,.69444,0,0,.55],52:[0,.69444,0,0,.55],53:[0,.69444,0,0,.55],54:[0,.69444,0,0,.55],55:[0,.69444,0,0,.55],56:[0,.69444,0,0,.55],57:[0,.69444,0,0,.55],58:[0,.45833,0,0,.30556],59:[.10556,.45833,0,0,.30556],61:[-.09375,.40625,0,0,.85556],63:[0,.69444,0,0,.51945],64:[0,.69444,0,0,.73334],65:[0,.69444,0,0,.73334],66:[0,.69444,0,0,.73334],67:[0,.69444,0,0,.70278],68:[0,.69444,0,0,.79445],69:[0,.69444,0,0,.64167],70:[0,.69444,0,0,.61111],71:[0,.69444,0,0,.73334],72:[0,.69444,0,0,.79445],73:[0,.69444,0,0,.33056],74:[0,.69444,0,0,.51945],75:[0,.69444,0,0,.76389],76:[0,.69444,0,0,.58056],77:[0,.69444,0,0,.97778],78:[0,.69444,0,0,.79445],79:[0,.69444,0,0,.79445],80:[0,.69444,0,0,.70278],81:[.10556,.69444,0,0,.79445],82:[0,.69444,0,0,.70278],83:[0,.69444,0,0,.61111],84:[0,.69444,0,0,.73334],85:[0,.69444,0,0,.76389],86:[0,.69444,.01528,0,.73334],87:[0,.69444,.01528,0,1.03889],88:[0,.69444,0,0,.73334],89:[0,.69444,.0275,0,.73334],90:[0,.69444,0,0,.67223],91:[.25,.75,0,0,.34306],93:[.25,.75,0,0,.34306],94:[0,.69444,0,0,.55],95:[.35,.10833,.03056,0,.55],97:[0,.45833,0,0,.525],98:[0,.69444,0,0,.56111],99:[0,.45833,0,0,.48889],100:[0,.69444,0,0,.56111],101:[0,.45833,0,0,.51111],102:[0,.69444,.07639,0,.33611],103:[.19444,.45833,.01528,0,.55],104:[0,.69444,0,0,.56111],105:[0,.69444,0,0,.25556],106:[.19444,.69444,0,0,.28611],107:[0,.69444,0,0,.53056],108:[0,.69444,0,0,.25556],109:[0,.45833,0,0,.86667],110:[0,.45833,0,0,.56111],111:[0,.45833,0,0,.55],112:[.19444,.45833,0,0,.56111],113:[.19444,.45833,0,0,.56111],114:[0,.45833,.01528,0,.37222],115:[0,.45833,0,0,.42167],116:[0,.58929,0,0,.40417],117:[0,.45833,0,0,.56111],118:[0,.45833,.01528,0,.5],119:[0,.45833,.01528,0,.74445],120:[0,.45833,0,0,.5],121:[.19444,.45833,.01528,0,.5],122:[0,.45833,0,0,.47639],126:[.35,.34444,0,0,.55],160:[0,0,0,0,.25],168:[0,.69444,0,0,.55],176:[0,.69444,0,0,.73334],180:[0,.69444,0,0,.55],184:[.17014,0,0,0,.48889],305:[0,.45833,0,0,.25556],567:[.19444,.45833,0,0,.28611],710:[0,.69444,0,0,.55],711:[0,.63542,0,0,.55],713:[0,.63778,0,0,.55],728:[0,.69444,0,0,.55],729:[0,.69444,0,0,.30556],730:[0,.69444,0,0,.73334],732:[0,.69444,0,0,.55],733:[0,.69444,0,0,.55],915:[0,.69444,0,0,.58056],916:[0,.69444,0,0,.91667],920:[0,.69444,0,0,.85556],923:[0,.69444,0,0,.67223],926:[0,.69444,0,0,.73334],928:[0,.69444,0,0,.79445],931:[0,.69444,0,0,.79445],933:[0,.69444,0,0,.85556],934:[0,.69444,0,0,.79445],936:[0,.69444,0,0,.85556],937:[0,.69444,0,0,.79445],8211:[0,.45833,.03056,0,.55],8212:[0,.45833,.03056,0,1.10001],8216:[0,.69444,0,0,.30556],8217:[0,.69444,0,0,.30556],8220:[0,.69444,0,0,.55834],8221:[0,.69444,0,0,.55834]},"SansSerif-Italic":{32:[0,0,0,0,.25],33:[0,.69444,.05733,0,.31945],34:[0,.69444,.00316,0,.5],35:[.19444,.69444,.05087,0,.83334],36:[.05556,.75,.11156,0,.5],37:[.05556,.75,.03126,0,.83334],38:[0,.69444,.03058,0,.75834],39:[0,.69444,.07816,0,.27778],40:[.25,.75,.13164,0,.38889],41:[.25,.75,.02536,0,.38889],42:[0,.75,.11775,0,.5],43:[.08333,.58333,.02536,0,.77778],44:[.125,.08333,0,0,.27778],45:[0,.44444,.01946,0,.33333],46:[0,.08333,0,0,.27778],47:[.25,.75,.13164,0,.5],48:[0,.65556,.11156,0,.5],49:[0,.65556,.11156,0,.5],50:[0,.65556,.11156,0,.5],51:[0,.65556,.11156,0,.5],52:[0,.65556,.11156,0,.5],53:[0,.65556,.11156,0,.5],54:[0,.65556,.11156,0,.5],55:[0,.65556,.11156,0,.5],56:[0,.65556,.11156,0,.5],57:[0,.65556,.11156,0,.5],58:[0,.44444,.02502,0,.27778],59:[.125,.44444,.02502,0,.27778],61:[-.13,.37,.05087,0,.77778],63:[0,.69444,.11809,0,.47222],64:[0,.69444,.07555,0,.66667],65:[0,.69444,0,0,.66667],66:[0,.69444,.08293,0,.66667],67:[0,.69444,.11983,0,.63889],68:[0,.69444,.07555,0,.72223],69:[0,.69444,.11983,0,.59722],70:[0,.69444,.13372,0,.56945],71:[0,.69444,.11983,0,.66667],72:[0,.69444,.08094,0,.70834],73:[0,.69444,.13372,0,.27778],74:[0,.69444,.08094,0,.47222],75:[0,.69444,.11983,0,.69445],76:[0,.69444,0,0,.54167],77:[0,.69444,.08094,0,.875],78:[0,.69444,.08094,0,.70834],79:[0,.69444,.07555,0,.73611],80:[0,.69444,.08293,0,.63889],81:[.125,.69444,.07555,0,.73611],82:[0,.69444,.08293,0,.64584],83:[0,.69444,.09205,0,.55556],84:[0,.69444,.13372,0,.68056],85:[0,.69444,.08094,0,.6875],86:[0,.69444,.1615,0,.66667],87:[0,.69444,.1615,0,.94445],88:[0,.69444,.13372,0,.66667],89:[0,.69444,.17261,0,.66667],90:[0,.69444,.11983,0,.61111],91:[.25,.75,.15942,0,.28889],93:[.25,.75,.08719,0,.28889],94:[0,.69444,.0799,0,.5],95:[.35,.09444,.08616,0,.5],97:[0,.44444,.00981,0,.48056],98:[0,.69444,.03057,0,.51667],99:[0,.44444,.08336,0,.44445],100:[0,.69444,.09483,0,.51667],101:[0,.44444,.06778,0,.44445],102:[0,.69444,.21705,0,.30556],103:[.19444,.44444,.10836,0,.5],104:[0,.69444,.01778,0,.51667],105:[0,.67937,.09718,0,.23889],106:[.19444,.67937,.09162,0,.26667],107:[0,.69444,.08336,0,.48889],108:[0,.69444,.09483,0,.23889],109:[0,.44444,.01778,0,.79445],110:[0,.44444,.01778,0,.51667],111:[0,.44444,.06613,0,.5],112:[.19444,.44444,.0389,0,.51667],113:[.19444,.44444,.04169,0,.51667],114:[0,.44444,.10836,0,.34167],115:[0,.44444,.0778,0,.38333],116:[0,.57143,.07225,0,.36111],117:[0,.44444,.04169,0,.51667],118:[0,.44444,.10836,0,.46111],119:[0,.44444,.10836,0,.68334],120:[0,.44444,.09169,0,.46111],121:[.19444,.44444,.10836,0,.46111],122:[0,.44444,.08752,0,.43472],126:[.35,.32659,.08826,0,.5],160:[0,0,0,0,.25],168:[0,.67937,.06385,0,.5],176:[0,.69444,0,0,.73752],184:[.17014,0,0,0,.44445],305:[0,.44444,.04169,0,.23889],567:[.19444,.44444,.04169,0,.26667],710:[0,.69444,.0799,0,.5],711:[0,.63194,.08432,0,.5],713:[0,.60889,.08776,0,.5],714:[0,.69444,.09205,0,.5],715:[0,.69444,0,0,.5],728:[0,.69444,.09483,0,.5],729:[0,.67937,.07774,0,.27778],730:[0,.69444,0,0,.73752],732:[0,.67659,.08826,0,.5],733:[0,.69444,.09205,0,.5],915:[0,.69444,.13372,0,.54167],916:[0,.69444,0,0,.83334],920:[0,.69444,.07555,0,.77778],923:[0,.69444,0,0,.61111],926:[0,.69444,.12816,0,.66667],928:[0,.69444,.08094,0,.70834],931:[0,.69444,.11983,0,.72222],933:[0,.69444,.09031,0,.77778],934:[0,.69444,.04603,0,.72222],936:[0,.69444,.09031,0,.77778],937:[0,.69444,.08293,0,.72222],8211:[0,.44444,.08616,0,.5],8212:[0,.44444,.08616,0,1],8216:[0,.69444,.07816,0,.27778],8217:[0,.69444,.07816,0,.27778],8220:[0,.69444,.14205,0,.5],8221:[0,.69444,.00316,0,.5]},"SansSerif-Regular":{32:[0,0,0,0,.25],33:[0,.69444,0,0,.31945],34:[0,.69444,0,0,.5],35:[.19444,.69444,0,0,.83334],36:[.05556,.75,0,0,.5],37:[.05556,.75,0,0,.83334],38:[0,.69444,0,0,.75834],39:[0,.69444,0,0,.27778],40:[.25,.75,0,0,.38889],41:[.25,.75,0,0,.38889],42:[0,.75,0,0,.5],43:[.08333,.58333,0,0,.77778],44:[.125,.08333,0,0,.27778],45:[0,.44444,0,0,.33333],46:[0,.08333,0,0,.27778],47:[.25,.75,0,0,.5],48:[0,.65556,0,0,.5],49:[0,.65556,0,0,.5],50:[0,.65556,0,0,.5],51:[0,.65556,0,0,.5],52:[0,.65556,0,0,.5],53:[0,.65556,0,0,.5],54:[0,.65556,0,0,.5],55:[0,.65556,0,0,.5],56:[0,.65556,0,0,.5],57:[0,.65556,0,0,.5],58:[0,.44444,0,0,.27778],59:[.125,.44444,0,0,.27778],61:[-.13,.37,0,0,.77778],63:[0,.69444,0,0,.47222],64:[0,.69444,0,0,.66667],65:[0,.69444,0,0,.66667],66:[0,.69444,0,0,.66667],67:[0,.69444,0,0,.63889],68:[0,.69444,0,0,.72223],69:[0,.69444,0,0,.59722],70:[0,.69444,0,0,.56945],71:[0,.69444,0,0,.66667],72:[0,.69444,0,0,.70834],73:[0,.69444,0,0,.27778],74:[0,.69444,0,0,.47222],75:[0,.69444,0,0,.69445],76:[0,.69444,0,0,.54167],77:[0,.69444,0,0,.875],78:[0,.69444,0,0,.70834],79:[0,.69444,0,0,.73611],80:[0,.69444,0,0,.63889],81:[.125,.69444,0,0,.73611],82:[0,.69444,0,0,.64584],83:[0,.69444,0,0,.55556],84:[0,.69444,0,0,.68056],85:[0,.69444,0,0,.6875],86:[0,.69444,.01389,0,.66667],87:[0,.69444,.01389,0,.94445],88:[0,.69444,0,0,.66667],89:[0,.69444,.025,0,.66667],90:[0,.69444,0,0,.61111],91:[.25,.75,0,0,.28889],93:[.25,.75,0,0,.28889],94:[0,.69444,0,0,.5],95:[.35,.09444,.02778,0,.5],97:[0,.44444,0,0,.48056],98:[0,.69444,0,0,.51667],99:[0,.44444,0,0,.44445],100:[0,.69444,0,0,.51667],101:[0,.44444,0,0,.44445],102:[0,.69444,.06944,0,.30556],103:[.19444,.44444,.01389,0,.5],104:[0,.69444,0,0,.51667],105:[0,.67937,0,0,.23889],106:[.19444,.67937,0,0,.26667],107:[0,.69444,0,0,.48889],108:[0,.69444,0,0,.23889],109:[0,.44444,0,0,.79445],110:[0,.44444,0,0,.51667],111:[0,.44444,0,0,.5],112:[.19444,.44444,0,0,.51667],113:[.19444,.44444,0,0,.51667],114:[0,.44444,.01389,0,.34167],115:[0,.44444,0,0,.38333],116:[0,.57143,0,0,.36111],117:[0,.44444,0,0,.51667],118:[0,.44444,.01389,0,.46111],119:[0,.44444,.01389,0,.68334],120:[0,.44444,0,0,.46111],121:[.19444,.44444,.01389,0,.46111],122:[0,.44444,0,0,.43472],126:[.35,.32659,0,0,.5],160:[0,0,0,0,.25],168:[0,.67937,0,0,.5],176:[0,.69444,0,0,.66667],184:[.17014,0,0,0,.44445],305:[0,.44444,0,0,.23889],567:[.19444,.44444,0,0,.26667],710:[0,.69444,0,0,.5],711:[0,.63194,0,0,.5],713:[0,.60889,0,0,.5],714:[0,.69444,0,0,.5],715:[0,.69444,0,0,.5],728:[0,.69444,0,0,.5],729:[0,.67937,0,0,.27778],730:[0,.69444,0,0,.66667],732:[0,.67659,0,0,.5],733:[0,.69444,0,0,.5],915:[0,.69444,0,0,.54167],916:[0,.69444,0,0,.83334],920:[0,.69444,0,0,.77778],923:[0,.69444,0,0,.61111],926:[0,.69444,0,0,.66667],928:[0,.69444,0,0,.70834],931:[0,.69444,0,0,.72222],933:[0,.69444,0,0,.77778],934:[0,.69444,0,0,.72222],936:[0,.69444,0,0,.77778],937:[0,.69444,0,0,.72222],8211:[0,.44444,.02778,0,.5],8212:[0,.44444,.02778,0,1],8216:[0,.69444,0,0,.27778],8217:[0,.69444,0,0,.27778],8220:[0,.69444,0,0,.5],8221:[0,.69444,0,0,.5]},"Script-Regular":{32:[0,0,0,0,.25],65:[0,.7,.22925,0,.80253],66:[0,.7,.04087,0,.90757],67:[0,.7,.1689,0,.66619],68:[0,.7,.09371,0,.77443],69:[0,.7,.18583,0,.56162],70:[0,.7,.13634,0,.89544],71:[0,.7,.17322,0,.60961],72:[0,.7,.29694,0,.96919],73:[0,.7,.19189,0,.80907],74:[.27778,.7,.19189,0,1.05159],75:[0,.7,.31259,0,.91364],76:[0,.7,.19189,0,.87373],77:[0,.7,.15981,0,1.08031],78:[0,.7,.3525,0,.9015],79:[0,.7,.08078,0,.73787],80:[0,.7,.08078,0,1.01262],81:[0,.7,.03305,0,.88282],82:[0,.7,.06259,0,.85],83:[0,.7,.19189,0,.86767],84:[0,.7,.29087,0,.74697],85:[0,.7,.25815,0,.79996],86:[0,.7,.27523,0,.62204],87:[0,.7,.27523,0,.80532],88:[0,.7,.26006,0,.94445],89:[0,.7,.2939,0,.70961],90:[0,.7,.24037,0,.8212],160:[0,0,0,0,.25]},"Size1-Regular":{32:[0,0,0,0,.25],40:[.35001,.85,0,0,.45834],41:[.35001,.85,0,0,.45834],47:[.35001,.85,0,0,.57778],91:[.35001,.85,0,0,.41667],92:[.35001,.85,0,0,.57778],93:[.35001,.85,0,0,.41667],123:[.35001,.85,0,0,.58334],125:[.35001,.85,0,0,.58334],160:[0,0,0,0,.25],710:[0,.72222,0,0,.55556],732:[0,.72222,0,0,.55556],770:[0,.72222,0,0,.55556],771:[0,.72222,0,0,.55556],8214:[-99e-5,.601,0,0,.77778],8593:[1e-5,.6,0,0,.66667],8595:[1e-5,.6,0,0,.66667],8657:[1e-5,.6,0,0,.77778],8659:[1e-5,.6,0,0,.77778],8719:[.25001,.75,0,0,.94445],8720:[.25001,.75,0,0,.94445],8721:[.25001,.75,0,0,1.05556],8730:[.35001,.85,0,0,1],8739:[-.00599,.606,0,0,.33333],8741:[-.00599,.606,0,0,.55556],8747:[.30612,.805,.19445,0,.47222],8748:[.306,.805,.19445,0,.47222],8749:[.306,.805,.19445,0,.47222],8750:[.30612,.805,.19445,0,.47222],8896:[.25001,.75,0,0,.83334],8897:[.25001,.75,0,0,.83334],8898:[.25001,.75,0,0,.83334],8899:[.25001,.75,0,0,.83334],8968:[.35001,.85,0,0,.47222],8969:[.35001,.85,0,0,.47222],8970:[.35001,.85,0,0,.47222],8971:[.35001,.85,0,0,.47222],9168:[-99e-5,.601,0,0,.66667],10216:[.35001,.85,0,0,.47222],10217:[.35001,.85,0,0,.47222],10752:[.25001,.75,0,0,1.11111],10753:[.25001,.75,0,0,1.11111],10754:[.25001,.75,0,0,1.11111],10756:[.25001,.75,0,0,.83334],10758:[.25001,.75,0,0,.83334]},"Size2-Regular":{32:[0,0,0,0,.25],40:[.65002,1.15,0,0,.59722],41:[.65002,1.15,0,0,.59722],47:[.65002,1.15,0,0,.81111],91:[.65002,1.15,0,0,.47222],92:[.65002,1.15,0,0,.81111],93:[.65002,1.15,0,0,.47222],123:[.65002,1.15,0,0,.66667],125:[.65002,1.15,0,0,.66667],160:[0,0,0,0,.25],710:[0,.75,0,0,1],732:[0,.75,0,0,1],770:[0,.75,0,0,1],771:[0,.75,0,0,1],8719:[.55001,1.05,0,0,1.27778],8720:[.55001,1.05,0,0,1.27778],8721:[.55001,1.05,0,0,1.44445],8730:[.65002,1.15,0,0,1],8747:[.86225,1.36,.44445,0,.55556],8748:[.862,1.36,.44445,0,.55556],8749:[.862,1.36,.44445,0,.55556],8750:[.86225,1.36,.44445,0,.55556],8896:[.55001,1.05,0,0,1.11111],8897:[.55001,1.05,0,0,1.11111],8898:[.55001,1.05,0,0,1.11111],8899:[.55001,1.05,0,0,1.11111],8968:[.65002,1.15,0,0,.52778],8969:[.65002,1.15,0,0,.52778],8970:[.65002,1.15,0,0,.52778],8971:[.65002,1.15,0,0,.52778],10216:[.65002,1.15,0,0,.61111],10217:[.65002,1.15,0,0,.61111],10752:[.55001,1.05,0,0,1.51112],10753:[.55001,1.05,0,0,1.51112],10754:[.55001,1.05,0,0,1.51112],10756:[.55001,1.05,0,0,1.11111],10758:[.55001,1.05,0,0,1.11111]},"Size3-Regular":{32:[0,0,0,0,.25],40:[.95003,1.45,0,0,.73611],41:[.95003,1.45,0,0,.73611],47:[.95003,1.45,0,0,1.04445],91:[.95003,1.45,0,0,.52778],92:[.95003,1.45,0,0,1.04445],93:[.95003,1.45,0,0,.52778],123:[.95003,1.45,0,0,.75],125:[.95003,1.45,0,0,.75],160:[0,0,0,0,.25],710:[0,.75,0,0,1.44445],732:[0,.75,0,0,1.44445],770:[0,.75,0,0,1.44445],771:[0,.75,0,0,1.44445],8730:[.95003,1.45,0,0,1],8968:[.95003,1.45,0,0,.58334],8969:[.95003,1.45,0,0,.58334],8970:[.95003,1.45,0,0,.58334],8971:[.95003,1.45,0,0,.58334],10216:[.95003,1.45,0,0,.75],10217:[.95003,1.45,0,0,.75]},"Size4-Regular":{32:[0,0,0,0,.25],40:[1.25003,1.75,0,0,.79167],41:[1.25003,1.75,0,0,.79167],47:[1.25003,1.75,0,0,1.27778],91:[1.25003,1.75,0,0,.58334],92:[1.25003,1.75,0,0,1.27778],93:[1.25003,1.75,0,0,.58334],123:[1.25003,1.75,0,0,.80556],125:[1.25003,1.75,0,0,.80556],160:[0,0,0,0,.25],710:[0,.825,0,0,1.8889],732:[0,.825,0,0,1.8889],770:[0,.825,0,0,1.8889],771:[0,.825,0,0,1.8889],8730:[1.25003,1.75,0,0,1],8968:[1.25003,1.75,0,0,.63889],8969:[1.25003,1.75,0,0,.63889],8970:[1.25003,1.75,0,0,.63889],8971:[1.25003,1.75,0,0,.63889],9115:[.64502,1.155,0,0,.875],9116:[1e-5,.6,0,0,.875],9117:[.64502,1.155,0,0,.875],9118:[.64502,1.155,0,0,.875],9119:[1e-5,.6,0,0,.875],9120:[.64502,1.155,0,0,.875],9121:[.64502,1.155,0,0,.66667],9122:[-99e-5,.601,0,0,.66667],9123:[.64502,1.155,0,0,.66667],9124:[.64502,1.155,0,0,.66667],9125:[-99e-5,.601,0,0,.66667],9126:[.64502,1.155,0,0,.66667],9127:[1e-5,.9,0,0,.88889],9128:[.65002,1.15,0,0,.88889],9129:[.90001,0,0,0,.88889],9130:[0,.3,0,0,.88889],9131:[1e-5,.9,0,0,.88889],9132:[.65002,1.15,0,0,.88889],9133:[.90001,0,0,0,.88889],9143:[.88502,.915,0,0,1.05556],10216:[1.25003,1.75,0,0,.80556],10217:[1.25003,1.75,0,0,.80556],57344:[-.00499,.605,0,0,1.05556],57345:[-.00499,.605,0,0,1.05556],57680:[0,.12,0,0,.45],57681:[0,.12,0,0,.45],57682:[0,.12,0,0,.45],57683:[0,.12,0,0,.45]},"Typewriter-Regular":{32:[0,0,0,0,.525],33:[0,.61111,0,0,.525],34:[0,.61111,0,0,.525],35:[0,.61111,0,0,.525],36:[.08333,.69444,0,0,.525],37:[.08333,.69444,0,0,.525],38:[0,.61111,0,0,.525],39:[0,.61111,0,0,.525],40:[.08333,.69444,0,0,.525],41:[.08333,.69444,0,0,.525],42:[0,.52083,0,0,.525],43:[-.08056,.53055,0,0,.525],44:[.13889,.125,0,0,.525],45:[-.08056,.53055,0,0,.525],46:[0,.125,0,0,.525],47:[.08333,.69444,0,0,.525],48:[0,.61111,0,0,.525],49:[0,.61111,0,0,.525],50:[0,.61111,0,0,.525],51:[0,.61111,0,0,.525],52:[0,.61111,0,0,.525],53:[0,.61111,0,0,.525],54:[0,.61111,0,0,.525],55:[0,.61111,0,0,.525],56:[0,.61111,0,0,.525],57:[0,.61111,0,0,.525],58:[0,.43056,0,0,.525],59:[.13889,.43056,0,0,.525],60:[-.05556,.55556,0,0,.525],61:[-.19549,.41562,0,0,.525],62:[-.05556,.55556,0,0,.525],63:[0,.61111,0,0,.525],64:[0,.61111,0,0,.525],65:[0,.61111,0,0,.525],66:[0,.61111,0,0,.525],67:[0,.61111,0,0,.525],68:[0,.61111,0,0,.525],69:[0,.61111,0,0,.525],70:[0,.61111,0,0,.525],71:[0,.61111,0,0,.525],72:[0,.61111,0,0,.525],73:[0,.61111,0,0,.525],74:[0,.61111,0,0,.525],75:[0,.61111,0,0,.525],76:[0,.61111,0,0,.525],77:[0,.61111,0,0,.525],78:[0,.61111,0,0,.525],79:[0,.61111,0,0,.525],80:[0,.61111,0,0,.525],81:[.13889,.61111,0,0,.525],82:[0,.61111,0,0,.525],83:[0,.61111,0,0,.525],84:[0,.61111,0,0,.525],85:[0,.61111,0,0,.525],86:[0,.61111,0,0,.525],87:[0,.61111,0,0,.525],88:[0,.61111,0,0,.525],89:[0,.61111,0,0,.525],90:[0,.61111,0,0,.525],91:[.08333,.69444,0,0,.525],92:[.08333,.69444,0,0,.525],93:[.08333,.69444,0,0,.525],94:[0,.61111,0,0,.525],95:[.09514,0,0,0,.525],96:[0,.61111,0,0,.525],97:[0,.43056,0,0,.525],98:[0,.61111,0,0,.525],99:[0,.43056,0,0,.525],100:[0,.61111,0,0,.525],101:[0,.43056,0,0,.525],102:[0,.61111,0,0,.525],103:[.22222,.43056,0,0,.525],104:[0,.61111,0,0,.525],105:[0,.61111,0,0,.525],106:[.22222,.61111,0,0,.525],107:[0,.61111,0,0,.525],108:[0,.61111,0,0,.525],109:[0,.43056,0,0,.525],110:[0,.43056,0,0,.525],111:[0,.43056,0,0,.525],112:[.22222,.43056,0,0,.525],113:[.22222,.43056,0,0,.525],114:[0,.43056,0,0,.525],115:[0,.43056,0,0,.525],116:[0,.55358,0,0,.525],117:[0,.43056,0,0,.525],118:[0,.43056,0,0,.525],119:[0,.43056,0,0,.525],120:[0,.43056,0,0,.525],121:[.22222,.43056,0,0,.525],122:[0,.43056,0,0,.525],123:[.08333,.69444,0,0,.525],124:[.08333,.69444,0,0,.525],125:[.08333,.69444,0,0,.525],126:[0,.61111,0,0,.525],127:[0,.61111,0,0,.525],160:[0,0,0,0,.525],176:[0,.61111,0,0,.525],184:[.19445,0,0,0,.525],305:[0,.43056,0,0,.525],567:[.22222,.43056,0,0,.525],711:[0,.56597,0,0,.525],713:[0,.56555,0,0,.525],714:[0,.61111,0,0,.525],715:[0,.61111,0,0,.525],728:[0,.61111,0,0,.525],730:[0,.61111,0,0,.525],770:[0,.61111,0,0,.525],771:[0,.61111,0,0,.525],776:[0,.61111,0,0,.525],915:[0,.61111,0,0,.525],916:[0,.61111,0,0,.525],920:[0,.61111,0,0,.525],923:[0,.61111,0,0,.525],926:[0,.61111,0,0,.525],928:[0,.61111,0,0,.525],931:[0,.61111,0,0,.525],933:[0,.61111,0,0,.525],934:[0,.61111,0,0,.525],936:[0,.61111,0,0,.525],937:[0,.61111,0,0,.525],8216:[0,.61111,0,0,.525],8217:[0,.61111,0,0,.525],8242:[0,.61111,0,0,.525],9251:[.11111,.21944,0,0,.525]}},B={slant:[.25,.25,.25],space:[0,0,0],stretch:[0,0,0],shrink:[0,0,0],xHeight:[.431,.431,.431],quad:[1,1.171,1.472],extraSpace:[0,0,0],num1:[.677,.732,.925],num2:[.394,.384,.387],num3:[.444,.471,.504],denom1:[.686,.752,1.025],denom2:[.345,.344,.532],sup1:[.413,.503,.504],sup2:[.363,.431,.404],sup3:[.289,.286,.294],sub1:[.15,.143,.2],sub2:[.247,.286,.4],supDrop:[.386,.353,.494],subDrop:[.05,.071,.1],delim1:[2.39,1.7,1.98],delim2:[1.01,1.157,1.42],axisHeight:[.25,.25,.25],defaultRuleThickness:[.04,.049,.049],bigOpSpacing1:[.111,.111,.111],bigOpSpacing2:[.166,.166,.166],bigOpSpacing3:[.2,.2,.2],bigOpSpacing4:[.6,.611,.611],bigOpSpacing5:[.1,.143,.143],sqrtRuleThickness:[.04,.04,.04],ptPerEm:[10,10,10],doubleRuleSep:[.2,.2,.2],arrayRuleWidth:[.04,.04,.04],fboxsep:[.3,.3,.3],fboxrule:[.04,.04,.04]},C={"\xc5":"A","\xd0":"D","\xde":"o","\xe5":"a","\xf0":"d","\xfe":"o","\u0410":"A","\u0411":"B","\u0412":"B","\u0413":"F","\u0414":"A","\u0415":"E","\u0416":"K","\u0417":"3","\u0418":"N","\u0419":"N","\u041a":"K","\u041b":"N","\u041c":"M","\u041d":"H","\u041e":"O","\u041f":"N","\u0420":"P","\u0421":"C","\u0422":"T","\u0423":"y","\u0424":"O","\u0425":"X","\u0426":"U","\u0427":"h","\u0428":"W","\u0429":"W","\u042a":"B","\u042b":"X","\u042c":"B","\u042d":"3","\u042e":"X","\u042f":"R","\u0430":"a","\u0431":"b","\u0432":"a","\u0433":"r","\u0434":"y","\u0435":"e","\u0436":"m","\u0437":"e","\u0438":"n","\u0439":"n","\u043a":"n","\u043b":"n","\u043c":"m","\u043d":"n","\u043e":"o","\u043f":"n","\u0440":"p","\u0441":"c","\u0442":"o","\u0443":"y","\u0444":"b","\u0445":"x","\u0446":"n","\u0447":"n","\u0448":"w","\u0449":"w","\u044a":"a","\u044b":"m","\u044c":"a","\u044d":"e","\u044e":"m","\u044f":"r"};function q(e,t,r){if(!T[t])throw new Error("Font metrics not found for font: "+t+".");var n=e.charCodeAt(0),a=T[t][n];if(!a&&e[0]in C&&(n=C[e[0]].charCodeAt(0),a=T[t][n]),a||"text"!==r||S(n)&&(a=T[t][77]),a)return{depth:a[0],height:a[1],italic:a[2],skew:a[3],width:a[4]}}var N={};var I=[[1,1,1],[2,1,1],[3,1,1],[4,2,1],[5,2,1],[6,3,1],[7,4,2],[8,6,3],[9,7,6],[10,8,7],[11,10,9]],R=[.5,.6,.7,.8,.9,1,1.2,1.44,1.728,2.074,2.488],O=function(e,t){return t.size<2?e:I[e-1][t.size-1]},H=function(){function e(t){this.style=void 0,this.color=void 0,this.size=void 0,this.textSize=void 0,this.phantom=void 0,this.font=void 0,this.fontFamily=void 0,this.fontWeight=void 0,this.fontShape=void 0,this.sizeMultiplier=void 0,this.maxSize=void 0,this.minRuleThickness=void 0,this._fontMetrics=void 0,this.style=t.style,this.color=t.color,this.size=t.size||e.BASESIZE,this.textSize=t.textSize||this.size,this.phantom=!!t.phantom,this.font=t.font||"",this.fontFamily=t.fontFamily||"",this.fontWeight=t.fontWeight||"",this.fontShape=t.fontShape||"",this.sizeMultiplier=R[this.size-1],this.maxSize=t.maxSize,this.minRuleThickness=t.minRuleThickness,this._fontMetrics=void 0}var t=e.prototype;return t.extend=function(t){var r={style:this.style,size:this.size,textSize:this.textSize,color:this.color,phantom:this.phantom,font:this.font,fontFamily:this.fontFamily,fontWeight:this.fontWeight,fontShape:this.fontShape,maxSize:this.maxSize,minRuleThickness:this.minRuleThickness};for(var n in t)t.hasOwnProperty(n)&&(r[n]=t[n]);return new e(r)},t.havingStyle=function(e){return this.style===e?this:this.extend({style:e,size:O(this.textSize,e)})},t.havingCrampedStyle=function(){return this.havingStyle(this.style.cramp())},t.havingSize=function(e){return this.size===e&&this.textSize===e?this:this.extend({style:this.style.text(),size:e,textSize:e,sizeMultiplier:R[e-1]})},t.havingBaseStyle=function(t){t=t||this.style.text();var r=O(e.BASESIZE,t);return this.size===r&&this.textSize===e.BASESIZE&&this.style===t?this:this.extend({style:t,size:r})},t.havingBaseSizing=function(){var e;switch(this.style.id){case 4:case 5:e=3;break;case 6:case 7:e=1;break;default:e=6}return this.extend({style:this.style.text(),size:e})},t.withColor=function(e){return this.extend({color:e})},t.withPhantom=function(){return this.extend({phantom:!0})},t.withFont=function(e){return this.extend({font:e})},t.withTextFontFamily=function(e){return this.extend({fontFamily:e,font:""})},t.withTextFontWeight=function(e){return this.extend({fontWeight:e,font:""})},t.withTextFontShape=function(e){return this.extend({fontShape:e,font:""})},t.sizingClasses=function(e){return e.size!==this.size?["sizing","reset-size"+e.size,"size"+this.size]:[]},t.baseSizingClasses=function(){return this.size!==e.BASESIZE?["sizing","reset-size"+this.size,"size"+e.BASESIZE]:[]},t.fontMetrics=function(){return this._fontMetrics||(this._fontMetrics=function(e){var t;if(!N[t=e>=5?0:e>=3?1:2]){var r=N[t]={cssEmPerMu:B.quad[t]/18};for(var n in B)B.hasOwnProperty(n)&&(r[n]=B[n][t])}return N[t]}(this.size)),this._fontMetrics},t.getColor=function(){return this.phantom?"transparent":this.color},e}();H.BASESIZE=6;var E=H,L={pt:1,mm:7227/2540,cm:7227/254,in:72.27,bp:1.00375,pc:12,dd:1238/1157,cc:14856/1157,nd:685/642,nc:1370/107,sp:1/65536,px:1.00375},D={ex:!0,em:!0,mu:!0},P=function(e){return"string"!=typeof e&&(e=e.unit),e in L||e in D||"ex"===e},F=function(e,t){var r;if(e.unit in L)r=L[e.unit]/t.fontMetrics().ptPerEm/t.sizeMultiplier;else if("mu"===e.unit)r=t.fontMetrics().cssEmPerMu;else{var a;if(a=t.style.isTight()?t.havingStyle(t.style.text()):t,"ex"===e.unit)r=a.fontMetrics().xHeight;else{if("em"!==e.unit)throw new n("Invalid unit: '"+e.unit+"'");r=a.fontMetrics().quad}a!==t&&(r*=a.sizeMultiplier/t.sizeMultiplier)}return Math.min(e.number*r,t.maxSize)},V=function(e){return+e.toFixed(4)+"em"},G=function(e){return e.filter((function(e){return e})).join(" ")},U=function(e,t,r){if(this.classes=e||[],this.attributes={},this.height=0,this.depth=0,this.maxFontSize=0,this.style=r||{},t){t.style.isTight()&&this.classes.push("mtight");var n=t.getColor();n&&(this.style.color=n)}},Y=function(e){var t=document.createElement(e);for(var r in t.className=G(this.classes),this.style)this.style.hasOwnProperty(r)&&(t.style[r]=this.style[r]);for(var n in this.attributes)this.attributes.hasOwnProperty(n)&&t.setAttribute(n,this.attributes[n]);for(var a=0;a<this.children.length;a++)t.appendChild(this.children[a].toNode());return t},X=function(e){var t="<"+e;this.classes.length&&(t+=' class="'+l.escape(G(this.classes))+'"');var r="";for(var n in this.style)this.style.hasOwnProperty(n)&&(r+=l.hyphenate(n)+":"+this.style[n]+";");for(var a in r&&(t+=' style="'+l.escape(r)+'"'),this.attributes)this.attributes.hasOwnProperty(a)&&(t+=" "+a+'="'+l.escape(this.attributes[a])+'"');t+=">";for(var i=0;i<this.children.length;i++)t+=this.children[i].toMarkup();return t+="</"+e+">"},W=function(){function e(e,t,r,n){this.children=void 0,this.attributes=void 0,this.classes=void 0,this.height=void 0,this.depth=void 0,this.width=void 0,this.maxFontSize=void 0,this.style=void 0,U.call(this,e,r,n),this.children=t||[]}var t=e.prototype;return t.setAttribute=function(e,t){this.attributes[e]=t},t.hasClass=function(e){return l.contains(this.classes,e)},t.toNode=function(){return Y.call(this,"span")},t.toMarkup=function(){return X.call(this,"span")},e}(),_=function(){function e(e,t,r,n){this.children=void 0,this.attributes=void 0,this.classes=void 0,this.height=void 0,this.depth=void 0,this.maxFontSize=void 0,this.style=void 0,U.call(this,t,n),this.children=r||[],this.setAttribute("href",e)}var t=e.prototype;return t.setAttribute=function(e,t){this.attributes[e]=t},t.hasClass=function(e){return l.contains(this.classes,e)},t.toNode=function(){return Y.call(this,"a")},t.toMarkup=function(){return X.call(this,"a")},e}(),j=function(){function e(e,t,r){this.src=void 0,this.alt=void 0,this.classes=void 0,this.height=void 0,this.depth=void 0,this.maxFontSize=void 0,this.style=void 0,this.alt=t,this.src=e,this.classes=["mord"],this.style=r}var t=e.prototype;return t.hasClass=function(e){return l.contains(this.classes,e)},t.toNode=function(){var e=document.createElement("img");for(var t in e.src=this.src,e.alt=this.alt,e.className="mord",this.style)this.style.hasOwnProperty(t)&&(e.style[t]=this.style[t]);return e},t.toMarkup=function(){var e="<img  src='"+this.src+" 'alt='"+this.alt+"' ",t="";for(var r in this.style)this.style.hasOwnProperty(r)&&(t+=l.hyphenate(r)+":"+this.style[r]+";");return t&&(e+=' style="'+l.escape(t)+'"'),e+="'/>"},e}(),$={"\xee":"\u0131\u0302","\xef":"\u0131\u0308","\xed":"\u0131\u0301","\xec":"\u0131\u0300"},Z=function(){function e(e,t,r,n,a,i,o,s){this.text=void 0,this.height=void 0,this.depth=void 0,this.italic=void 0,this.skew=void 0,this.width=void 0,this.maxFontSize=void 0,this.classes=void 0,this.style=void 0,this.text=e,this.height=t||0,this.depth=r||0,this.italic=n||0,this.skew=a||0,this.width=i||0,this.classes=o||[],this.style=s||{},this.maxFontSize=0;var l=function(e){for(var t=0;t<w.length;t++)for(var r=w[t],n=0;n<r.blocks.length;n++){var a=r.blocks[n];if(e>=a[0]&&e<=a[1])return r.name}return null}(this.text.charCodeAt(0));l&&this.classes.push(l+"_fallback"),/[\xee\xef\xed\xec]/.test(this.text)&&(this.text=$[this.text])}var t=e.prototype;return t.hasClass=function(e){return l.contains(this.classes,e)},t.toNode=function(){var e=document.createTextNode(this.text),t=null;for(var r in this.italic>0&&((t=document.createElement("span")).style.marginRight=V(this.italic)),this.classes.length>0&&((t=t||document.createElement("span")).className=G(this.classes)),this.style)this.style.hasOwnProperty(r)&&((t=t||document.createElement("span")).style[r]=this.style[r]);return t?(t.appendChild(e),t):e},t.toMarkup=function(){var e=!1,t="<span";this.classes.length&&(e=!0,t+=' class="',t+=l.escape(G(this.classes)),t+='"');var r="";for(var n in this.italic>0&&(r+="margin-right:"+this.italic+"em;"),this.style)this.style.hasOwnProperty(n)&&(r+=l.hyphenate(n)+":"+this.style[n]+";");r&&(e=!0,t+=' style="'+l.escape(r)+'"');var a=l.escape(this.text);return e?(t+=">",t+=a,t+="</span>"):a},e}(),K=function(){function e(e,t){this.children=void 0,this.attributes=void 0,this.children=e||[],this.attributes=t||{}}var t=e.prototype;return t.toNode=function(){var e=document.createElementNS("http://www.w3.org/2000/svg","svg");for(var t in this.attributes)Object.prototype.hasOwnProperty.call(this.attributes,t)&&e.setAttribute(t,this.attributes[t]);for(var r=0;r<this.children.length;r++)e.appendChild(this.children[r].toNode());return e},t.toMarkup=function(){var e='<svg xmlns="http://www.w3.org/2000/svg"';for(var t in this.attributes)Object.prototype.hasOwnProperty.call(this.attributes,t)&&(e+=" "+t+"='"+this.attributes[t]+"'");e+=">";for(var r=0;r<this.children.length;r++)e+=this.children[r].toMarkup();return e+="</svg>"},e}(),J=function(){function e(e,t){this.pathName=void 0,this.alternate=void 0,this.pathName=e,this.alternate=t}var t=e.prototype;return t.toNode=function(){var e=document.createElementNS("http://www.w3.org/2000/svg","path");return this.alternate?e.setAttribute("d",this.alternate):e.setAttribute("d",z[this.pathName]),e},t.toMarkup=function(){return this.alternate?"<path d='"+this.alternate+"'/>":"<path d='"+z[this.pathName]+"'/>"},e}(),Q=function(){function e(e){this.attributes=void 0,this.attributes=e||{}}var t=e.prototype;return t.toNode=function(){var e=document.createElementNS("http://www.w3.org/2000/svg","line");for(var t in this.attributes)Object.prototype.hasOwnProperty.call(this.attributes,t)&&e.setAttribute(t,this.attributes[t]);return e},t.toMarkup=function(){var e="<line";for(var t in this.attributes)Object.prototype.hasOwnProperty.call(this.attributes,t)&&(e+=" "+t+"='"+this.attributes[t]+"'");return e+="/>"},e}();function ee(e){if(e instanceof Z)return e;throw new Error("Expected symbolNode but got "+String(e)+".")}var te={bin:1,close:1,inner:1,open:1,punct:1,rel:1},re={"accent-token":1,mathord:1,"op-token":1,spacing:1,textord:1},ne={math:{},text:{}},ae=ne;function ie(e,t,r,n,a,i){ne[e][a]={font:t,group:r,replace:n},i&&n&&(ne[e][n]=ne[e][a])}var oe="math",se="text",le="main",he="ams",me="accent-token",ce="bin",ue="close",pe="inner",de="mathord",fe="op-token",ge="open",ve="punct",be="rel",ye="spacing",xe="textord";ie(oe,le,be,"\u2261","\\equiv",!0),ie(oe,le,be,"\u227a","\\prec",!0),ie(oe,le,be,"\u227b","\\succ",!0),ie(oe,le,be,"\u223c","\\sim",!0),ie(oe,le,be,"\u22a5","\\perp"),ie(oe,le,be,"\u2aaf","\\preceq",!0),ie(oe,le,be,"\u2ab0","\\succeq",!0),ie(oe,le,be,"\u2243","\\simeq",!0),ie(oe,le,be,"\u2223","\\mid",!0),ie(oe,le,be,"\u226a","\\ll",!0),ie(oe,le,be,"\u226b","\\gg",!0),ie(oe,le,be,"\u224d","\\asymp",!0),ie(oe,le,be,"\u2225","\\parallel"),ie(oe,le,be,"\u22c8","\\bowtie",!0),ie(oe,le,be,"\u2323","\\smile",!0),ie(oe,le,be,"\u2291","\\sqsubseteq",!0),ie(oe,le,be,"\u2292","\\sqsupseteq",!0),ie(oe,le,be,"\u2250","\\doteq",!0),ie(oe,le,be,"\u2322","\\frown",!0),ie(oe,le,be,"\u220b","\\ni",!0),ie(oe,le,be,"\u221d","\\propto",!0),ie(oe,le,be,"\u22a2","\\vdash",!0),ie(oe,le,be,"\u22a3","\\dashv",!0),ie(oe,le,be,"\u220b","\\owns"),ie(oe,le,ve,".","\\ldotp"),ie(oe,le,ve,"\u22c5","\\cdotp"),ie(oe,le,xe,"#","\\#"),ie(se,le,xe,"#","\\#"),ie(oe,le,xe,"&","\\&"),ie(se,le,xe,"&","\\&"),ie(oe,le,xe,"\u2135","\\aleph",!0),ie(oe,le,xe,"\u2200","\\forall",!0),ie(oe,le,xe,"\u210f","\\hbar",!0),ie(oe,le,xe,"\u2203","\\exists",!0),ie(oe,le,xe,"\u2207","\\nabla",!0),ie(oe,le,xe,"\u266d","\\flat",!0),ie(oe,le,xe,"\u2113","\\ell",!0),ie(oe,le,xe,"\u266e","\\natural",!0),ie(oe,le,xe,"\u2663","\\clubsuit",!0),ie(oe,le,xe,"\u2118","\\wp",!0),ie(oe,le,xe,"\u266f","\\sharp",!0),ie(oe,le,xe,"\u2662","\\diamondsuit",!0),ie(oe,le,xe,"\u211c","\\Re",!0),ie(oe,le,xe,"\u2661","\\heartsuit",!0),ie(oe,le,xe,"\u2111","\\Im",!0),ie(oe,le,xe,"\u2660","\\spadesuit",!0),ie(oe,le,xe,"\xa7","\\S",!0),ie(se,le,xe,"\xa7","\\S"),ie(oe,le,xe,"\xb6","\\P",!0),ie(se,le,xe,"\xb6","\\P"),ie(oe,le,xe,"\u2020","\\dag"),ie(se,le,xe,"\u2020","\\dag"),ie(se,le,xe,"\u2020","\\textdagger"),ie(oe,le,xe,"\u2021","\\ddag"),ie(se,le,xe,"\u2021","\\ddag"),ie(se,le,xe,"\u2021","\\textdaggerdbl"),ie(oe,le,ue,"\u23b1","\\rmoustache",!0),ie(oe,le,ge,"\u23b0","\\lmoustache",!0),ie(oe,le,ue,"\u27ef","\\rgroup",!0),ie(oe,le,ge,"\u27ee","\\lgroup",!0),ie(oe,le,ce,"\u2213","\\mp",!0),ie(oe,le,ce,"\u2296","\\ominus",!0),ie(oe,le,ce,"\u228e","\\uplus",!0),ie(oe,le,ce,"\u2293","\\sqcap",!0),ie(oe,le,ce,"\u2217","\\ast"),ie(oe,le,ce,"\u2294","\\sqcup",!0),ie(oe,le,ce,"\u25ef","\\bigcirc",!0),ie(oe,le,ce,"\u2219","\\bullet",!0),ie(oe,le,ce,"\u2021","\\ddagger"),ie(oe,le,ce,"\u2240","\\wr",!0),ie(oe,le,ce,"\u2a3f","\\amalg"),ie(oe,le,ce,"&","\\And"),ie(oe,le,be,"\u27f5","\\longleftarrow",!0),ie(oe,le,be,"\u21d0","\\Leftarrow",!0),ie(oe,le,be,"\u27f8","\\Longleftarrow",!0),ie(oe,le,be,"\u27f6","\\longrightarrow",!0),ie(oe,le,be,"\u21d2","\\Rightarrow",!0),ie(oe,le,be,"\u27f9","\\Longrightarrow",!0),ie(oe,le,be,"\u2194","\\leftrightarrow",!0),ie(oe,le,be,"\u27f7","\\longleftrightarrow",!0),ie(oe,le,be,"\u21d4","\\Leftrightarrow",!0),ie(oe,le,be,"\u27fa","\\Longleftrightarrow",!0),ie(oe,le,be,"\u21a6","\\mapsto",!0),ie(oe,le,be,"\u27fc","\\longmapsto",!0),ie(oe,le,be,"\u2197","\\nearrow",!0),ie(oe,le,be,"\u21a9","\\hookleftarrow",!0),ie(oe,le,be,"\u21aa","\\hookrightarrow",!0),ie(oe,le,be,"\u2198","\\searrow",!0),ie(oe,le,be,"\u21bc","\\leftharpoonup",!0),ie(oe,le,be,"\u21c0","\\rightharpoonup",!0),ie(oe,le,be,"\u2199","\\swarrow",!0),ie(oe,le,be,"\u21bd","\\leftharpoondown",!0),ie(oe,le,be,"\u21c1","\\rightharpoondown",!0),ie(oe,le,be,"\u2196","\\nwarrow",!0),ie(oe,le,be,"\u21cc","\\rightleftharpoons",!0),ie(oe,he,be,"\u226e","\\nless",!0),ie(oe,he,be,"\ue010","\\@nleqslant"),ie(oe,he,be,"\ue011","\\@nleqq"),ie(oe,he,be,"\u2a87","\\lneq",!0),ie(oe,he,be,"\u2268","\\lneqq",!0),ie(oe,he,be,"\ue00c","\\@lvertneqq"),ie(oe,he,be,"\u22e6","\\lnsim",!0),ie(oe,he,be,"\u2a89","\\lnapprox",!0),ie(oe,he,be,"\u2280","\\nprec",!0),ie(oe,he,be,"\u22e0","\\npreceq",!0),ie(oe,he,be,"\u22e8","\\precnsim",!0),ie(oe,he,be,"\u2ab9","\\precnapprox",!0),ie(oe,he,be,"\u2241","\\nsim",!0),ie(oe,he,be,"\ue006","\\@nshortmid"),ie(oe,he,be,"\u2224","\\nmid",!0),ie(oe,he,be,"\u22ac","\\nvdash",!0),ie(oe,he,be,"\u22ad","\\nvDash",!0),ie(oe,he,be,"\u22ea","\\ntriangleleft"),ie(oe,he,be,"\u22ec","\\ntrianglelefteq",!0),ie(oe,he,be,"\u228a","\\subsetneq",!0),ie(oe,he,be,"\ue01a","\\@varsubsetneq"),ie(oe,he,be,"\u2acb","\\subsetneqq",!0),ie(oe,he,be,"\ue017","\\@varsubsetneqq"),ie(oe,he,be,"\u226f","\\ngtr",!0),ie(oe,he,be,"\ue00f","\\@ngeqslant"),ie(oe,he,be,"\ue00e","\\@ngeqq"),ie(oe,he,be,"\u2a88","\\gneq",!0),ie(oe,he,be,"\u2269","\\gneqq",!0),ie(oe,he,be,"\ue00d","\\@gvertneqq"),ie(oe,he,be,"\u22e7","\\gnsim",!0),ie(oe,he,be,"\u2a8a","\\gnapprox",!0),ie(oe,he,be,"\u2281","\\nsucc",!0),ie(oe,he,be,"\u22e1","\\nsucceq",!0),ie(oe,he,be,"\u22e9","\\succnsim",!0),ie(oe,he,be,"\u2aba","\\succnapprox",!0),ie(oe,he,be,"\u2246","\\ncong",!0),ie(oe,he,be,"\ue007","\\@nshortparallel"),ie(oe,he,be,"\u2226","\\nparallel",!0),ie(oe,he,be,"\u22af","\\nVDash",!0),ie(oe,he,be,"\u22eb","\\ntriangleright"),ie(oe,he,be,"\u22ed","\\ntrianglerighteq",!0),ie(oe,he,be,"\ue018","\\@nsupseteqq"),ie(oe,he,be,"\u228b","\\supsetneq",!0),ie(oe,he,be,"\ue01b","\\@varsupsetneq"),ie(oe,he,be,"\u2acc","\\supsetneqq",!0),ie(oe,he,be,"\ue019","\\@varsupsetneqq"),ie(oe,he,be,"\u22ae","\\nVdash",!0),ie(oe,he,be,"\u2ab5","\\precneqq",!0),ie(oe,he,be,"\u2ab6","\\succneqq",!0),ie(oe,he,be,"\ue016","\\@nsubseteqq"),ie(oe,he,ce,"\u22b4","\\unlhd"),ie(oe,he,ce,"\u22b5","\\unrhd"),ie(oe,he,be,"\u219a","\\nleftarrow",!0),ie(oe,he,be,"\u219b","\\nrightarrow",!0),ie(oe,he,be,"\u21cd","\\nLeftarrow",!0),ie(oe,he,be,"\u21cf","\\nRightarrow",!0),ie(oe,he,be,"\u21ae","\\nleftrightarrow",!0),ie(oe,he,be,"\u21ce","\\nLeftrightarrow",!0),ie(oe,he,be,"\u25b3","\\vartriangle"),ie(oe,he,xe,"\u210f","\\hslash"),ie(oe,he,xe,"\u25bd","\\triangledown"),ie(oe,he,xe,"\u25ca","\\lozenge"),ie(oe,he,xe,"\u24c8","\\circledS"),ie(oe,he,xe,"\xae","\\circledR"),ie(se,he,xe,"\xae","\\circledR"),ie(oe,he,xe,"\u2221","\\measuredangle",!0),ie(oe,he,xe,"\u2204","\\nexists"),ie(oe,he,xe,"\u2127","\\mho"),ie(oe,he,xe,"\u2132","\\Finv",!0),ie(oe,he,xe,"\u2141","\\Game",!0),ie(oe,he,xe,"\u2035","\\backprime"),ie(oe,he,xe,"\u25b2","\\blacktriangle"),ie(oe,he,xe,"\u25bc","\\blacktriangledown"),ie(oe,he,xe,"\u25a0","\\blacksquare"),ie(oe,he,xe,"\u29eb","\\blacklozenge"),ie(oe,he,xe,"\u2605","\\bigstar"),ie(oe,he,xe,"\u2222","\\sphericalangle",!0),ie(oe,he,xe,"\u2201","\\complement",!0),ie(oe,he,xe,"\xf0","\\eth",!0),ie(se,le,xe,"\xf0","\xf0"),ie(oe,he,xe,"\u2571","\\diagup"),ie(oe,he,xe,"\u2572","\\diagdown"),ie(oe,he,xe,"\u25a1","\\square"),ie(oe,he,xe,"\u25a1","\\Box"),ie(oe,he,xe,"\u25ca","\\Diamond"),ie(oe,he,xe,"\xa5","\\yen",!0),ie(se,he,xe,"\xa5","\\yen",!0),ie(oe,he,xe,"\u2713","\\checkmark",!0),ie(se,he,xe,"\u2713","\\checkmark"),ie(oe,he,xe,"\u2136","\\beth",!0),ie(oe,he,xe,"\u2138","\\daleth",!0),ie(oe,he,xe,"\u2137","\\gimel",!0),ie(oe,he,xe,"\u03dd","\\digamma",!0),ie(oe,he,xe,"\u03f0","\\varkappa"),ie(oe,he,ge,"\u250c","\\@ulcorner",!0),ie(oe,he,ue,"\u2510","\\@urcorner",!0),ie(oe,he,ge,"\u2514","\\@llcorner",!0),ie(oe,he,ue,"\u2518","\\@lrcorner",!0),ie(oe,he,be,"\u2266","\\leqq",!0),ie(oe,he,be,"\u2a7d","\\leqslant",!0),ie(oe,he,be,"\u2a95","\\eqslantless",!0),ie(oe,he,be,"\u2272","\\lesssim",!0),ie(oe,he,be,"\u2a85","\\lessapprox",!0),ie(oe,he,be,"\u224a","\\approxeq",!0),ie(oe,he,ce,"\u22d6","\\lessdot"),ie(oe,he,be,"\u22d8","\\lll",!0),ie(oe,he,be,"\u2276","\\lessgtr",!0),ie(oe,he,be,"\u22da","\\lesseqgtr",!0),ie(oe,he,be,"\u2a8b","\\lesseqqgtr",!0),ie(oe,he,be,"\u2251","\\doteqdot"),ie(oe,he,be,"\u2253","\\risingdotseq",!0),ie(oe,he,be,"\u2252","\\fallingdotseq",!0),ie(oe,he,be,"\u223d","\\backsim",!0),ie(oe,he,be,"\u22cd","\\backsimeq",!0),ie(oe,he,be,"\u2ac5","\\subseteqq",!0),ie(oe,he,be,"\u22d0","\\Subset",!0),ie(oe,he,be,"\u228f","\\sqsubset",!0),ie(oe,he,be,"\u227c","\\preccurlyeq",!0),ie(oe,he,be,"\u22de","\\curlyeqprec",!0),ie(oe,he,be,"\u227e","\\precsim",!0),ie(oe,he,be,"\u2ab7","\\precapprox",!0),ie(oe,he,be,"\u22b2","\\vartriangleleft"),ie(oe,he,be,"\u22b4","\\trianglelefteq"),ie(oe,he,be,"\u22a8","\\vDash",!0),ie(oe,he,be,"\u22aa","\\Vvdash",!0),ie(oe,he,be,"\u2323","\\smallsmile"),ie(oe,he,be,"\u2322","\\smallfrown"),ie(oe,he,be,"\u224f","\\bumpeq",!0),ie(oe,he,be,"\u224e","\\Bumpeq",!0),ie(oe,he,be,"\u2267","\\geqq",!0),ie(oe,he,be,"\u2a7e","\\geqslant",!0),ie(oe,he,be,"\u2a96","\\eqslantgtr",!0),ie(oe,he,be,"\u2273","\\gtrsim",!0),ie(oe,he,be,"\u2a86","\\gtrapprox",!0),ie(oe,he,ce,"\u22d7","\\gtrdot"),ie(oe,he,be,"\u22d9","\\ggg",!0),ie(oe,he,be,"\u2277","\\gtrless",!0),ie(oe,he,be,"\u22db","\\gtreqless",!0),ie(oe,he,be,"\u2a8c","\\gtreqqless",!0),ie(oe,he,be,"\u2256","\\eqcirc",!0),ie(oe,he,be,"\u2257","\\circeq",!0),ie(oe,he,be,"\u225c","\\triangleq",!0),ie(oe,he,be,"\u223c","\\thicksim"),ie(oe,he,be,"\u2248","\\thickapprox"),ie(oe,he,be,"\u2ac6","\\supseteqq",!0),ie(oe,he,be,"\u22d1","\\Supset",!0),ie(oe,he,be,"\u2290","\\sqsupset",!0),ie(oe,he,be,"\u227d","\\succcurlyeq",!0),ie(oe,he,be,"\u22df","\\curlyeqsucc",!0),ie(oe,he,be,"\u227f","\\succsim",!0),ie(oe,he,be,"\u2ab8","\\succapprox",!0),ie(oe,he,be,"\u22b3","\\vartriangleright"),ie(oe,he,be,"\u22b5","\\trianglerighteq"),ie(oe,he,be,"\u22a9","\\Vdash",!0),ie(oe,he,be,"\u2223","\\shortmid"),ie(oe,he,be,"\u2225","\\shortparallel"),ie(oe,he,be,"\u226c","\\between",!0),ie(oe,he,be,"\u22d4","\\pitchfork",!0),ie(oe,he,be,"\u221d","\\varpropto"),ie(oe,he,be,"\u25c0","\\blacktriangleleft"),ie(oe,he,be,"\u2234","\\therefore",!0),ie(oe,he,be,"\u220d","\\backepsilon"),ie(oe,he,be,"\u25b6","\\blacktriangleright"),ie(oe,he,be,"\u2235","\\because",!0),ie(oe,he,be,"\u22d8","\\llless"),ie(oe,he,be,"\u22d9","\\gggtr"),ie(oe,he,ce,"\u22b2","\\lhd"),ie(oe,he,ce,"\u22b3","\\rhd"),ie(oe,he,be,"\u2242","\\eqsim",!0),ie(oe,le,be,"\u22c8","\\Join"),ie(oe,he,be,"\u2251","\\Doteq",!0),ie(oe,he,ce,"\u2214","\\dotplus",!0),ie(oe,he,ce,"\u2216","\\smallsetminus"),ie(oe,he,ce,"\u22d2","\\Cap",!0),ie(oe,he,ce,"\u22d3","\\Cup",!0),ie(oe,he,ce,"\u2a5e","\\doublebarwedge",!0),ie(oe,he,ce,"\u229f","\\boxminus",!0),ie(oe,he,ce,"\u229e","\\boxplus",!0),ie(oe,he,ce,"\u22c7","\\divideontimes",!0),ie(oe,he,ce,"\u22c9","\\ltimes",!0),ie(oe,he,ce,"\u22ca","\\rtimes",!0),ie(oe,he,ce,"\u22cb","\\leftthreetimes",!0),ie(oe,he,ce,"\u22cc","\\rightthreetimes",!0),ie(oe,he,ce,"\u22cf","\\curlywedge",!0),ie(oe,he,ce,"\u22ce","\\curlyvee",!0),ie(oe,he,ce,"\u229d","\\circleddash",!0),ie(oe,he,ce,"\u229b","\\circledast",!0),ie(oe,he,ce,"\u22c5","\\centerdot"),ie(oe,he,ce,"\u22ba","\\intercal",!0),ie(oe,he,ce,"\u22d2","\\doublecap"),ie(oe,he,ce,"\u22d3","\\doublecup"),ie(oe,he,ce,"\u22a0","\\boxtimes",!0),ie(oe,he,be,"\u21e2","\\dashrightarrow",!0),ie(oe,he,be,"\u21e0","\\dashleftarrow",!0),ie(oe,he,be,"\u21c7","\\leftleftarrows",!0),ie(oe,he,be,"\u21c6","\\leftrightarrows",!0),ie(oe,he,be,"\u21da","\\Lleftarrow",!0),ie(oe,he,be,"\u219e","\\twoheadleftarrow",!0),ie(oe,he,be,"\u21a2","\\leftarrowtail",!0),ie(oe,he,be,"\u21ab","\\looparrowleft",!0),ie(oe,he,be,"\u21cb","\\leftrightharpoons",!0),ie(oe,he,be,"\u21b6","\\curvearrowleft",!0),ie(oe,he,be,"\u21ba","\\circlearrowleft",!0),ie(oe,he,be,"\u21b0","\\Lsh",!0),ie(oe,he,be,"\u21c8","\\upuparrows",!0),ie(oe,he,be,"\u21bf","\\upharpoonleft",!0),ie(oe,he,be,"\u21c3","\\downharpoonleft",!0),ie(oe,le,be,"\u22b6","\\origof",!0),ie(oe,le,be,"\u22b7","\\imageof",!0),ie(oe,he,be,"\u22b8","\\multimap",!0),ie(oe,he,be,"\u21ad","\\leftrightsquigarrow",!0),ie(oe,he,be,"\u21c9","\\rightrightarrows",!0),ie(oe,he,be,"\u21c4","\\rightleftarrows",!0),ie(oe,he,be,"\u21a0","\\twoheadrightarrow",!0),ie(oe,he,be,"\u21a3","\\rightarrowtail",!0),ie(oe,he,be,"\u21ac","\\looparrowright",!0),ie(oe,he,be,"\u21b7","\\curvearrowright",!0),ie(oe,he,be,"\u21bb","\\circlearrowright",!0),ie(oe,he,be,"\u21b1","\\Rsh",!0),ie(oe,he,be,"\u21ca","\\downdownarrows",!0),ie(oe,he,be,"\u21be","\\upharpoonright",!0),ie(oe,he,be,"\u21c2","\\downharpoonright",!0),ie(oe,he,be,"\u21dd","\\rightsquigarrow",!0),ie(oe,he,be,"\u21dd","\\leadsto"),ie(oe,he,be,"\u21db","\\Rrightarrow",!0),ie(oe,he,be,"\u21be","\\restriction"),ie(oe,le,xe,"\u2018","`"),ie(oe,le,xe,"$","\\$"),ie(se,le,xe,"$","\\$"),ie(se,le,xe,"$","\\textdollar"),ie(oe,le,xe,"%","\\%"),ie(se,le,xe,"%","\\%"),ie(oe,le,xe,"_","\\_"),ie(se,le,xe,"_","\\_"),ie(se,le,xe,"_","\\textunderscore"),ie(oe,le,xe,"\u2220","\\angle",!0),ie(oe,le,xe,"\u221e","\\infty",!0),ie(oe,le,xe,"\u2032","\\prime"),ie(oe,le,xe,"\u25b3","\\triangle"),ie(oe,le,xe,"\u0393","\\Gamma",!0),ie(oe,le,xe,"\u0394","\\Delta",!0),ie(oe,le,xe,"\u0398","\\Theta",!0),ie(oe,le,xe,"\u039b","\\Lambda",!0),ie(oe,le,xe,"\u039e","\\Xi",!0),ie(oe,le,xe,"\u03a0","\\Pi",!0),ie(oe,le,xe,"\u03a3","\\Sigma",!0),ie(oe,le,xe,"\u03a5","\\Upsilon",!0),ie(oe,le,xe,"\u03a6","\\Phi",!0),ie(oe,le,xe,"\u03a8","\\Psi",!0),ie(oe,le,xe,"\u03a9","\\Omega",!0),ie(oe,le,xe,"A","\u0391"),ie(oe,le,xe,"B","\u0392"),ie(oe,le,xe,"E","\u0395"),ie(oe,le,xe,"Z","\u0396"),ie(oe,le,xe,"H","\u0397"),ie(oe,le,xe,"I","\u0399"),ie(oe,le,xe,"K","\u039a"),ie(oe,le,xe,"M","\u039c"),ie(oe,le,xe,"N","\u039d"),ie(oe,le,xe,"O","\u039f"),ie(oe,le,xe,"P","\u03a1"),ie(oe,le,xe,"T","\u03a4"),ie(oe,le,xe,"X","\u03a7"),ie(oe,le,xe,"\xac","\\neg",!0),ie(oe,le,xe,"\xac","\\lnot"),ie(oe,le,xe,"\u22a4","\\top"),ie(oe,le,xe,"\u22a5","\\bot"),ie(oe,le,xe,"\u2205","\\emptyset"),ie(oe,he,xe,"\u2205","\\varnothing"),ie(oe,le,de,"\u03b1","\\alpha",!0),ie(oe,le,de,"\u03b2","\\beta",!0),ie(oe,le,de,"\u03b3","\\gamma",!0),ie(oe,le,de,"\u03b4","\\delta",!0),ie(oe,le,de,"\u03f5","\\epsilon",!0),ie(oe,le,de,"\u03b6","\\zeta",!0),ie(oe,le,de,"\u03b7","\\eta",!0),ie(oe,le,de,"\u03b8","\\theta",!0),ie(oe,le,de,"\u03b9","\\iota",!0),ie(oe,le,de,"\u03ba","\\kappa",!0),ie(oe,le,de,"\u03bb","\\lambda",!0),ie(oe,le,de,"\u03bc","\\mu",!0),ie(oe,le,de,"\u03bd","\\nu",!0),ie(oe,le,de,"\u03be","\\xi",!0),ie(oe,le,de,"\u03bf","\\omicron",!0),ie(oe,le,de,"\u03c0","\\pi",!0),ie(oe,le,de,"\u03c1","\\rho",!0),ie(oe,le,de,"\u03c3","\\sigma",!0),ie(oe,le,de,"\u03c4","\\tau",!0),ie(oe,le,de,"\u03c5","\\upsilon",!0),ie(oe,le,de,"\u03d5","\\phi",!0),ie(oe,le,de,"\u03c7","\\chi",!0),ie(oe,le,de,"\u03c8","\\psi",!0),ie(oe,le,de,"\u03c9","\\omega",!0),ie(oe,le,de,"\u03b5","\\varepsilon",!0),ie(oe,le,de,"\u03d1","\\vartheta",!0),ie(oe,le,de,"\u03d6","\\varpi",!0),ie(oe,le,de,"\u03f1","\\varrho",!0),ie(oe,le,de,"\u03c2","\\varsigma",!0),ie(oe,le,de,"\u03c6","\\varphi",!0),ie(oe,le,ce,"\u2217","*",!0),ie(oe,le,ce,"+","+"),ie(oe,le,ce,"\u2212","-",!0),ie(oe,le,ce,"\u22c5","\\cdot",!0),ie(oe,le,ce,"\u2218","\\circ",!0),ie(oe,le,ce,"\xf7","\\div",!0),ie(oe,le,ce,"\xb1","\\pm",!0),ie(oe,le,ce,"\xd7","\\times",!0),ie(oe,le,ce,"\u2229","\\cap",!0),ie(oe,le,ce,"\u222a","\\cup",!0),ie(oe,le,ce,"\u2216","\\setminus",!0),ie(oe,le,ce,"\u2227","\\land"),ie(oe,le,ce,"\u2228","\\lor"),ie(oe,le,ce,"\u2227","\\wedge",!0),ie(oe,le,ce,"\u2228","\\vee",!0),ie(oe,le,xe,"\u221a","\\surd"),ie(oe,le,ge,"\u27e8","\\langle",!0),ie(oe,le,ge,"\u2223","\\lvert"),ie(oe,le,ge,"\u2225","\\lVert"),ie(oe,le,ue,"?","?"),ie(oe,le,ue,"!","!"),ie(oe,le,ue,"\u27e9","\\rangle",!0),ie(oe,le,ue,"\u2223","\\rvert"),ie(oe,le,ue,"\u2225","\\rVert"),ie(oe,le,be,"=","="),ie(oe,le,be,":",":"),ie(oe,le,be,"\u2248","\\approx",!0),ie(oe,le,be,"\u2245","\\cong",!0),ie(oe,le,be,"\u2265","\\ge"),ie(oe,le,be,"\u2265","\\geq",!0),ie(oe,le,be,"\u2190","\\gets"),ie(oe,le,be,">","\\gt",!0),ie(oe,le,be,"\u2208","\\in",!0),ie(oe,le,be,"\ue020","\\@not"),ie(oe,le,be,"\u2282","\\subset",!0),ie(oe,le,be,"\u2283","\\supset",!0),ie(oe,le,be,"\u2286","\\subseteq",!0),ie(oe,le,be,"\u2287","\\supseteq",!0),ie(oe,he,be,"\u2288","\\nsubseteq",!0),ie(oe,he,be,"\u2289","\\nsupseteq",!0),ie(oe,le,be,"\u22a8","\\models"),ie(oe,le,be,"\u2190","\\leftarrow",!0),ie(oe,le,be,"\u2264","\\le"),ie(oe,le,be,"\u2264","\\leq",!0),ie(oe,le,be,"<","\\lt",!0),ie(oe,le,be,"\u2192","\\rightarrow",!0),ie(oe,le,be,"\u2192","\\to"),ie(oe,he,be,"\u2271","\\ngeq",!0),ie(oe,he,be,"\u2270","\\nleq",!0),ie(oe,le,ye,"\xa0","\\ "),ie(oe,le,ye,"\xa0","\\space"),ie(oe,le,ye,"\xa0","\\nobreakspace"),ie(se,le,ye,"\xa0","\\ "),ie(se,le,ye,"\xa0"," "),ie(se,le,ye,"\xa0","\\space"),ie(se,le,ye,"\xa0","\\nobreakspace"),ie(oe,le,ye,null,"\\nobreak"),ie(oe,le,ye,null,"\\allowbreak"),ie(oe,le,ve,",",","),ie(oe,le,ve,";",";"),ie(oe,he,ce,"\u22bc","\\barwedge",!0),ie(oe,he,ce,"\u22bb","\\veebar",!0),ie(oe,le,ce,"\u2299","\\odot",!0),ie(oe,le,ce,"\u2295","\\oplus",!0),ie(oe,le,ce,"\u2297","\\otimes",!0),ie(oe,le,xe,"\u2202","\\partial",!0),ie(oe,le,ce,"\u2298","\\oslash",!0),ie(oe,he,ce,"\u229a","\\circledcirc",!0),ie(oe,he,ce,"\u22a1","\\boxdot",!0),ie(oe,le,ce,"\u25b3","\\bigtriangleup"),ie(oe,le,ce,"\u25bd","\\bigtriangledown"),ie(oe,le,ce,"\u2020","\\dagger"),ie(oe,le,ce,"\u22c4","\\diamond"),ie(oe,le,ce,"\u22c6","\\star"),ie(oe,le,ce,"\u25c3","\\triangleleft"),ie(oe,le,ce,"\u25b9","\\triangleright"),ie(oe,le,ge,"{","\\{"),ie(se,le,xe,"{","\\{"),ie(se,le,xe,"{","\\textbraceleft"),ie(oe,le,ue,"}","\\}"),ie(se,le,xe,"}","\\}"),ie(se,le,xe,"}","\\textbraceright"),ie(oe,le,ge,"{","\\lbrace"),ie(oe,le,ue,"}","\\rbrace"),ie(oe,le,ge,"[","\\lbrack",!0),ie(se,le,xe,"[","\\lbrack",!0),ie(oe,le,ue,"]","\\rbrack",!0),ie(se,le,xe,"]","\\rbrack",!0),ie(oe,le,ge,"(","\\lparen",!0),ie(oe,le,ue,")","\\rparen",!0),ie(se,le,xe,"<","\\textless",!0),ie(se,le,xe,">","\\textgreater",!0),ie(oe,le,ge,"\u230a","\\lfloor",!0),ie(oe,le,ue,"\u230b","\\rfloor",!0),ie(oe,le,ge,"\u2308","\\lceil",!0),ie(oe,le,ue,"\u2309","\\rceil",!0),ie(oe,le,xe,"\\","\\backslash"),ie(oe,le,xe,"\u2223","|"),ie(oe,le,xe,"\u2223","\\vert"),ie(se,le,xe,"|","\\textbar",!0),ie(oe,le,xe,"\u2225","\\|"),ie(oe,le,xe,"\u2225","\\Vert"),ie(se,le,xe,"\u2225","\\textbardbl"),ie(se,le,xe,"~","\\textasciitilde"),ie(se,le,xe,"\\","\\textbackslash"),ie(se,le,xe,"^","\\textasciicircum"),ie(oe,le,be,"\u2191","\\uparrow",!0),ie(oe,le,be,"\u21d1","\\Uparrow",!0),ie(oe,le,be,"\u2193","\\downarrow",!0),ie(oe,le,be,"\u21d3","\\Downarrow",!0),ie(oe,le,be,"\u2195","\\updownarrow",!0),ie(oe,le,be,"\u21d5","\\Updownarrow",!0),ie(oe,le,fe,"\u2210","\\coprod"),ie(oe,le,fe,"\u22c1","\\bigvee"),ie(oe,le,fe,"\u22c0","\\bigwedge"),ie(oe,le,fe,"\u2a04","\\biguplus"),ie(oe,le,fe,"\u22c2","\\bigcap"),ie(oe,le,fe,"\u22c3","\\bigcup"),ie(oe,le,fe,"\u222b","\\int"),ie(oe,le,fe,"\u222b","\\intop"),ie(oe,le,fe,"\u222c","\\iint"),ie(oe,le,fe,"\u222d","\\iiint"),ie(oe,le,fe,"\u220f","\\prod"),ie(oe,le,fe,"\u2211","\\sum"),ie(oe,le,fe,"\u2a02","\\bigotimes"),ie(oe,le,fe,"\u2a01","\\bigoplus"),ie(oe,le,fe,"\u2a00","\\bigodot"),ie(oe,le,fe,"\u222e","\\oint"),ie(oe,le,fe,"\u222f","\\oiint"),ie(oe,le,fe,"\u2230","\\oiiint"),ie(oe,le,fe,"\u2a06","\\bigsqcup"),ie(oe,le,fe,"\u222b","\\smallint"),ie(se,le,pe,"\u2026","\\textellipsis"),ie(oe,le,pe,"\u2026","\\mathellipsis"),ie(se,le,pe,"\u2026","\\ldots",!0),ie(oe,le,pe,"\u2026","\\ldots",!0),ie(oe,le,pe,"\u22ef","\\@cdots",!0),ie(oe,le,pe,"\u22f1","\\ddots",!0),ie(oe,le,xe,"\u22ee","\\varvdots"),ie(oe,le,me,"\u02ca","\\acute"),ie(oe,le,me,"\u02cb","\\grave"),ie(oe,le,me,"\xa8","\\ddot"),ie(oe,le,me,"~","\\tilde"),ie(oe,le,me,"\u02c9","\\bar"),ie(oe,le,me,"\u02d8","\\breve"),ie(oe,le,me,"\u02c7","\\check"),ie(oe,le,me,"^","\\hat"),ie(oe,le,me,"\u20d7","\\vec"),ie(oe,le,me,"\u02d9","\\dot"),ie(oe,le,me,"\u02da","\\mathring"),ie(oe,le,de,"\ue131","\\@imath"),ie(oe,le,de,"\ue237","\\@jmath"),ie(oe,le,xe,"\u0131","\u0131"),ie(oe,le,xe,"\u0237","\u0237"),ie(se,le,xe,"\u0131","\\i",!0),ie(se,le,xe,"\u0237","\\j",!0),ie(se,le,xe,"\xdf","\\ss",!0),ie(se,le,xe,"\xe6","\\ae",!0),ie(se,le,xe,"\u0153","\\oe",!0),ie(se,le,xe,"\xf8","\\o",!0),ie(se,le,xe,"\xc6","\\AE",!0),ie(se,le,xe,"\u0152","\\OE",!0),ie(se,le,xe,"\xd8","\\O",!0),ie(se,le,me,"\u02ca","\\'"),ie(se,le,me,"\u02cb","\\`"),ie(se,le,me,"\u02c6","\\^"),ie(se,le,me,"\u02dc","\\~"),ie(se,le,me,"\u02c9","\\="),ie(se,le,me,"\u02d8","\\u"),ie(se,le,me,"\u02d9","\\."),ie(se,le,me,"\xb8","\\c"),ie(se,le,me,"\u02da","\\r"),ie(se,le,me,"\u02c7","\\v"),ie(se,le,me,"\xa8",'\\"'),ie(se,le,me,"\u02dd","\\H"),ie(se,le,me,"\u25ef","\\textcircled");var we={"--":!0,"---":!0,"``":!0,"''":!0};ie(se,le,xe,"\u2013","--",!0),ie(se,le,xe,"\u2013","\\textendash"),ie(se,le,xe,"\u2014","---",!0),ie(se,le,xe,"\u2014","\\textemdash"),ie(se,le,xe,"\u2018","`",!0),ie(se,le,xe,"\u2018","\\textquoteleft"),ie(se,le,xe,"\u2019","'",!0),ie(se,le,xe,"\u2019","\\textquoteright"),ie(se,le,xe,"\u201c","``",!0),ie(se,le,xe,"\u201c","\\textquotedblleft"),ie(se,le,xe,"\u201d","''",!0),ie(se,le,xe,"\u201d","\\textquotedblright"),ie(oe,le,xe,"\xb0","\\degree",!0),ie(se,le,xe,"\xb0","\\degree"),ie(se,le,xe,"\xb0","\\textdegree",!0),ie(oe,le,xe,"\xa3","\\pounds"),ie(oe,le,xe,"\xa3","\\mathsterling",!0),ie(se,le,xe,"\xa3","\\pounds"),ie(se,le,xe,"\xa3","\\textsterling",!0),ie(oe,he,xe,"\u2720","\\maltese"),ie(se,he,xe,"\u2720","\\maltese");for(var ke='0123456789/@."',Se=0;Se<ke.length;Se++){var Me=ke.charAt(Se);ie(oe,le,xe,Me,Me)}for(var ze='0123456789!@*()-=+";:?/.,',Ae=0;Ae<ze.length;Ae++){var Te=ze.charAt(Ae);ie(se,le,xe,Te,Te)}for(var Be="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",Ce=0;Ce<Be.length;Ce++){var qe=Be.charAt(Ce);ie(oe,le,de,qe,qe),ie(se,le,xe,qe,qe)}ie(oe,he,xe,"C","\u2102"),ie(se,he,xe,"C","\u2102"),ie(oe,he,xe,"H","\u210d"),ie(se,he,xe,"H","\u210d"),ie(oe,he,xe,"N","\u2115"),ie(se,he,xe,"N","\u2115"),ie(oe,he,xe,"P","\u2119"),ie(se,he,xe,"P","\u2119"),ie(oe,he,xe,"Q","\u211a"),ie(se,he,xe,"Q","\u211a"),ie(oe,he,xe,"R","\u211d"),ie(se,he,xe,"R","\u211d"),ie(oe,he,xe,"Z","\u2124"),ie(se,he,xe,"Z","\u2124"),ie(oe,le,de,"h","\u210e"),ie(se,le,de,"h","\u210e");for(var Ne="",Ie=0;Ie<Be.length;Ie++){var Re=Be.charAt(Ie);ie(oe,le,de,Re,Ne=String.fromCharCode(55349,56320+Ie)),ie(se,le,xe,Re,Ne),ie(oe,le,de,Re,Ne=String.fromCharCode(55349,56372+Ie)),ie(se,le,xe,Re,Ne),ie(oe,le,de,Re,Ne=String.fromCharCode(55349,56424+Ie)),ie(se,le,xe,Re,Ne),ie(oe,le,de,Re,Ne=String.fromCharCode(55349,56580+Ie)),ie(se,le,xe,Re,Ne),ie(oe,le,de,Re,Ne=String.fromCharCode(55349,56736+Ie)),ie(se,le,xe,Re,Ne),ie(oe,le,de,Re,Ne=String.fromCharCode(55349,56788+Ie)),ie(se,le,xe,Re,Ne),ie(oe,le,de,Re,Ne=String.fromCharCode(55349,56840+Ie)),ie(se,le,xe,Re,Ne),ie(oe,le,de,Re,Ne=String.fromCharCode(55349,56944+Ie)),ie(se,le,xe,Re,Ne),Ie<26&&(ie(oe,le,de,Re,Ne=String.fromCharCode(55349,56632+Ie)),ie(se,le,xe,Re,Ne),ie(oe,le,de,Re,Ne=String.fromCharCode(55349,56476+Ie)),ie(se,le,xe,Re,Ne))}ie(oe,le,de,"k",Ne=String.fromCharCode(55349,56668)),ie(se,le,xe,"k",Ne);for(var Oe=0;Oe<10;Oe++){var He=Oe.toString();ie(oe,le,de,He,Ne=String.fromCharCode(55349,57294+Oe)),ie(se,le,xe,He,Ne),ie(oe,le,de,He,Ne=String.fromCharCode(55349,57314+Oe)),ie(se,le,xe,He,Ne),ie(oe,le,de,He,Ne=String.fromCharCode(55349,57324+Oe)),ie(se,le,xe,He,Ne),ie(oe,le,de,He,Ne=String.fromCharCode(55349,57334+Oe)),ie(se,le,xe,He,Ne)}for(var Ee="\xd0\xde\xfe",Le=0;Le<Ee.length;Le++){var De=Ee.charAt(Le);ie(oe,le,de,De,De),ie(se,le,xe,De,De)}var Pe=[["mathbf","textbf","Main-Bold"],["mathbf","textbf","Main-Bold"],["mathnormal","textit","Math-Italic"],["mathnormal","textit","Math-Italic"],["boldsymbol","boldsymbol","Main-BoldItalic"],["boldsymbol","boldsymbol","Main-BoldItalic"],["mathscr","textscr","Script-Regular"],["","",""],["","",""],["","",""],["mathfrak","textfrak","Fraktur-Regular"],["mathfrak","textfrak","Fraktur-Regular"],["mathbb","textbb","AMS-Regular"],["mathbb","textbb","AMS-Regular"],["","",""],["","",""],["mathsf","textsf","SansSerif-Regular"],["mathsf","textsf","SansSerif-Regular"],["mathboldsf","textboldsf","SansSerif-Bold"],["mathboldsf","textboldsf","SansSerif-Bold"],["mathitsf","textitsf","SansSerif-Italic"],["mathitsf","textitsf","SansSerif-Italic"],["","",""],["","",""],["mathtt","texttt","Typewriter-Regular"],["mathtt","texttt","Typewriter-Regular"]],Fe=[["mathbf","textbf","Main-Bold"],["","",""],["mathsf","textsf","SansSerif-Regular"],["mathboldsf","textboldsf","SansSerif-Bold"],["mathtt","texttt","Typewriter-Regular"]],Ve=function(e,t,r){return ae[r][e]&&ae[r][e].replace&&(e=ae[r][e].replace),{value:e,metrics:q(e,t,r)}},Ge=function(e,t,r,n,a){var i,o=Ve(e,t,r),s=o.metrics;if(e=o.value,s){var l=s.italic;("text"===r||n&&"mathit"===n.font)&&(l=0),i=new Z(e,s.height,s.depth,l,s.skew,s.width,a)}else"undefined"!=typeof console&&console.warn("No character metrics for '"+e+"' in style '"+t+"' and mode '"+r+"'"),i=new Z(e,0,0,0,0,0,a);if(n){i.maxFontSize=n.sizeMultiplier,n.style.isTight()&&i.classes.push("mtight");var h=n.getColor();h&&(i.style.color=h)}return i},Ue=function(e,t){if(G(e.classes)!==G(t.classes)||e.skew!==t.skew||e.maxFontSize!==t.maxFontSize)return!1;if(1===e.classes.length){var r=e.classes[0];if("mbin"===r||"mord"===r)return!1}for(var n in e.style)if(e.style.hasOwnProperty(n)&&e.style[n]!==t.style[n])return!1;for(var a in t.style)if(t.style.hasOwnProperty(a)&&e.style[a]!==t.style[a])return!1;return!0},Ye=function(e){for(var t=0,r=0,n=0,a=0;a<e.children.length;a++){var i=e.children[a];i.height>t&&(t=i.height),i.depth>r&&(r=i.depth),i.maxFontSize>n&&(n=i.maxFontSize)}e.height=t,e.depth=r,e.maxFontSize=n},Xe=function(e,t,r,n){var a=new W(e,t,r,n);return Ye(a),a},We=function(e,t,r,n){return new W(e,t,r,n)},_e=function(e){var t=new A(e);return Ye(t),t},je=function(e,t,r){var n="";switch(e){case"amsrm":n="AMS";break;case"textrm":n="Main";break;case"textsf":n="SansSerif";break;case"texttt":n="Typewriter";break;default:n=e}return n+"-"+("textbf"===t&&"textit"===r?"BoldItalic":"textbf"===t?"Bold":"textit"===t?"Italic":"Regular")},$e={mathbf:{variant:"bold",fontName:"Main-Bold"},mathrm:{variant:"normal",fontName:"Main-Regular"},textit:{variant:"italic",fontName:"Main-Italic"},mathit:{variant:"italic",fontName:"Main-Italic"},mathnormal:{variant:"italic",fontName:"Math-Italic"},mathbb:{variant:"double-struck",fontName:"AMS-Regular"},mathcal:{variant:"script",fontName:"Caligraphic-Regular"},mathfrak:{variant:"fraktur",fontName:"Fraktur-Regular"},mathscr:{variant:"script",fontName:"Script-Regular"},mathsf:{variant:"sans-serif",fontName:"SansSerif-Regular"},mathtt:{variant:"monospace",fontName:"Typewriter-Regular"}},Ze={vec:["vec",.471,.714],oiintSize1:["oiintSize1",.957,.499],oiintSize2:["oiintSize2",1.472,.659],oiiintSize1:["oiiintSize1",1.304,.499],oiiintSize2:["oiiintSize2",1.98,.659]},Ke={fontMap:$e,makeSymbol:Ge,mathsym:function(e,t,r,n){return void 0===n&&(n=[]),"boldsymbol"===r.font&&Ve(e,"Main-Bold",t).metrics?Ge(e,"Main-Bold",t,r,n.concat(["mathbf"])):"\\"===e||"main"===ae[t][e].font?Ge(e,"Main-Regular",t,r,n):Ge(e,"AMS-Regular",t,r,n.concat(["amsrm"]))},makeSpan:Xe,makeSvgSpan:We,makeLineSpan:function(e,t,r){var n=Xe([e],[],t);return n.height=Math.max(r||t.fontMetrics().defaultRuleThickness,t.minRuleThickness),n.style.borderBottomWidth=V(n.height),n.maxFontSize=1,n},makeAnchor:function(e,t,r,n){var a=new _(e,t,r,n);return Ye(a),a},makeFragment:_e,wrapFragment:function(e,t){return e instanceof A?Xe([],[e],t):e},makeVList:function(e,t){for(var r=function(e){if("individualShift"===e.positionType){for(var t=e.children,r=[t[0]],n=-t[0].shift-t[0].elem.depth,a=n,i=1;i<t.length;i++){var o=-t[i].shift-a-t[i].elem.depth,s=o-(t[i-1].elem.height+t[i-1].elem.depth);a+=o,r.push({type:"kern",size:s}),r.push(t[i])}return{children:r,depth:n}}var l;if("top"===e.positionType){for(var h=e.positionData,m=0;m<e.children.length;m++){var c=e.children[m];h-="kern"===c.type?c.size:c.elem.height+c.elem.depth}l=h}else if("bottom"===e.positionType)l=-e.positionData;else{var u=e.children[0];if("elem"!==u.type)throw new Error('First child must have type "elem".');if("shift"===e.positionType)l=-u.elem.depth-e.positionData;else{if("firstBaseline"!==e.positionType)throw new Error("Invalid positionType "+e.positionType+".");l=-u.elem.depth}}return{children:e.children,depth:l}}(e),n=r.children,a=r.depth,i=0,o=0;o<n.length;o++){var s=n[o];if("elem"===s.type){var l=s.elem;i=Math.max(i,l.maxFontSize,l.height)}}i+=2;var h=Xe(["pstrut"],[]);h.style.height=V(i);for(var m=[],c=a,u=a,p=a,d=0;d<n.length;d++){var f=n[d];if("kern"===f.type)p+=f.size;else{var g=f.elem,v=f.wrapperClasses||[],b=f.wrapperStyle||{},y=Xe(v,[h,g],void 0,b);y.style.top=V(-i-p-g.depth),f.marginLeft&&(y.style.marginLeft=f.marginLeft),f.marginRight&&(y.style.marginRight=f.marginRight),m.push(y),p+=g.height+g.depth}c=Math.min(c,p),u=Math.max(u,p)}var x,w=Xe(["vlist"],m);if(w.style.height=V(u),c<0){var k=Xe([],[]),S=Xe(["vlist"],[k]);S.style.height=V(-c);var M=Xe(["vlist-s"],[new Z("\u200b")]);x=[Xe(["vlist-r"],[w,M]),Xe(["vlist-r"],[S])]}else x=[Xe(["vlist-r"],[w])];var z=Xe(["vlist-t"],x);return 2===x.length&&z.classes.push("vlist-t2"),z.height=u,z.depth=-c,z},makeOrd:function(e,t,r){var a=e.mode,i=e.text,o=["mord"],s="math"===a||"text"===a&&t.font,l=s?t.font:t.fontFamily;if(55349===i.charCodeAt(0)){var h=function(e,t){var r=1024*(e.charCodeAt(0)-55296)+(e.charCodeAt(1)-56320)+65536,a="math"===t?0:1;if(119808<=r&&r<120484){var i=Math.floor((r-119808)/26);return[Pe[i][2],Pe[i][a]]}if(120782<=r&&r<=120831){var o=Math.floor((r-120782)/10);return[Fe[o][2],Fe[o][a]]}if(120485===r||120486===r)return[Pe[0][2],Pe[0][a]];if(120486<r&&r<120782)return["",""];throw new n("Unsupported character: "+e)}(i,a),m=h[0],c=h[1];return Ge(i,m,a,t,o.concat(c))}if(l){var u,p;if("boldsymbol"===l){var d=function(e,t,r,n,a){return"textord"!==a&&Ve(e,"Math-BoldItalic",t).metrics?{fontName:"Math-BoldItalic",fontClass:"boldsymbol"}:{fontName:"Main-Bold",fontClass:"mathbf"}}(i,a,0,0,r);u=d.fontName,p=[d.fontClass]}else s?(u=$e[l].fontName,p=[l]):(u=je(l,t.fontWeight,t.fontShape),p=[l,t.fontWeight,t.fontShape]);if(Ve(i,u,a).metrics)return Ge(i,u,a,t,o.concat(p));if(we.hasOwnProperty(i)&&"Typewriter"===u.substr(0,10)){for(var f=[],g=0;g<i.length;g++)f.push(Ge(i[g],u,a,t,o.concat(p)));return _e(f)}}if("mathord"===r)return Ge(i,"Math-Italic",a,t,o.concat(["mathnormal"]));if("textord"===r){var v=ae[a][i]&&ae[a][i].font;if("ams"===v){var b=je("amsrm",t.fontWeight,t.fontShape);return Ge(i,b,a,t,o.concat("amsrm",t.fontWeight,t.fontShape))}if("main"!==v&&v){var y=je(v,t.fontWeight,t.fontShape);return Ge(i,y,a,t,o.concat(y,t.fontWeight,t.fontShape))}var x=je("textrm",t.fontWeight,t.fontShape);return Ge(i,x,a,t,o.concat(t.fontWeight,t.fontShape))}throw new Error("unexpected type: "+r+" in makeOrd")},makeGlue:function(e,t){var r=Xe(["mspace"],[],t),n=F(e,t);return r.style.marginRight=V(n),r},staticSvg:function(e,t){var r=Ze[e],n=r[0],a=r[1],i=r[2],o=new J(n),s=new K([o],{width:V(a),height:V(i),style:"width:"+V(a),viewBox:"0 0 "+1e3*a+" "+1e3*i,preserveAspectRatio:"xMinYMin"}),l=We(["overlay"],[s],t);return l.height=i,l.style.height=V(i),l.style.width=V(a),l},svgData:Ze,tryCombineChars:function(e){for(var t=0;t<e.length-1;t++){var r=e[t],n=e[t+1];r instanceof Z&&n instanceof Z&&Ue(r,n)&&(r.text+=n.text,r.height=Math.max(r.height,n.height),r.depth=Math.max(r.depth,n.depth),r.italic=n.italic,e.splice(t+1,1),t--)}return e}},Je={number:3,unit:"mu"},Qe={number:4,unit:"mu"},et={number:5,unit:"mu"},tt={mord:{mop:Je,mbin:Qe,mrel:et,minner:Je},mop:{mord:Je,mop:Je,mrel:et,minner:Je},mbin:{mord:Qe,mop:Qe,mopen:Qe,minner:Qe},mrel:{mord:et,mop:et,mopen:et,minner:et},mopen:{},mclose:{mop:Je,mbin:Qe,mrel:et,minner:Je},mpunct:{mord:Je,mop:Je,mrel:et,mopen:Je,mclose:Je,mpunct:Je,minner:Je},minner:{mord:Je,mop:Je,mbin:Qe,mrel:et,mopen:Je,mpunct:Je,minner:Je}},rt={mord:{mop:Je},mop:{mord:Je,mop:Je},mbin:{},mrel:{},mopen:{},mclose:{mop:Je},mpunct:{},minner:{mop:Je}},nt={},at={},it={};function ot(e){for(var t=e.type,r=e.names,n=e.props,a=e.handler,i=e.htmlBuilder,o=e.mathmlBuilder,s={type:t,numArgs:n.numArgs,argTypes:n.argTypes,allowedInArgument:!!n.allowedInArgument,allowedInText:!!n.allowedInText,allowedInMath:void 0===n.allowedInMath||n.allowedInMath,numOptionalArgs:n.numOptionalArgs||0,infix:!!n.infix,primitive:!!n.primitive,handler:a},l=0;l<r.length;++l)nt[r[l]]=s;t&&(i&&(at[t]=i),o&&(it[t]=o))}function st(e){ot({type:e.type,names:[],props:{numArgs:0},handler:function(){throw new Error("Should never be called.")},htmlBuilder:e.htmlBuilder,mathmlBuilder:e.mathmlBuilder})}var lt=function(e){return"ordgroup"===e.type&&1===e.body.length?e.body[0]:e},ht=function(e){return"ordgroup"===e.type?e.body:[e]},mt=Ke.makeSpan,ct=["leftmost","mbin","mopen","mrel","mop","mpunct"],ut=["rightmost","mrel","mclose","mpunct"],pt={display:x.DISPLAY,text:x.TEXT,script:x.SCRIPT,scriptscript:x.SCRIPTSCRIPT},dt={mord:"mord",mop:"mop",mbin:"mbin",mrel:"mrel",mopen:"mopen",mclose:"mclose",mpunct:"mpunct",minner:"minner"},ft=function(e,t,r,n){void 0===n&&(n=[null,null]);for(var a=[],i=0;i<e.length;i++){var o=wt(e[i],t);if(o instanceof A){var s=o.children;a.push.apply(a,s)}else a.push(o)}if(Ke.tryCombineChars(a),!r)return a;var h=t;if(1===e.length){var m=e[0];"sizing"===m.type?h=t.havingSize(m.size):"styling"===m.type&&(h=t.havingStyle(pt[m.style]))}var c=mt([n[0]||"leftmost"],[],t),u=mt([n[1]||"rightmost"],[],t),p="root"===r;return gt(a,(function(e,t){var r=t.classes[0],n=e.classes[0];"mbin"===r&&l.contains(ut,n)?t.classes[0]="mord":"mbin"===n&&l.contains(ct,r)&&(e.classes[0]="mord")}),{node:c},u,p),gt(a,(function(e,t){var r=yt(t),n=yt(e),a=r&&n?e.hasClass("mtight")?rt[r][n]:tt[r][n]:null;if(a)return Ke.makeGlue(a,h)}),{node:c},u,p),a},gt=function e(t,r,n,a,i){a&&t.push(a);for(var o=0;o<t.length;o++){var s=t[o],l=vt(s);if(l)e(l.children,r,n,null,i);else{var h=!s.hasClass("mspace");if(h){var m=r(s,n.node);m&&(n.insertAfter?n.insertAfter(m):(t.unshift(m),o++))}h?n.node=s:i&&s.hasClass("newline")&&(n.node=mt(["leftmost"])),n.insertAfter=function(e){return function(r){t.splice(e+1,0,r),o++}}(o)}}a&&t.pop()},vt=function(e){return e instanceof A||e instanceof _||e instanceof W&&e.hasClass("enclosing")?e:null},bt=function e(t,r){var n=vt(t);if(n){var a=n.children;if(a.length){if("right"===r)return e(a[a.length-1],"right");if("left"===r)return e(a[0],"left")}}return t},yt=function(e,t){return e?(t&&(e=bt(e,t)),dt[e.classes[0]]||null):null},xt=function(e,t){var r=["nulldelimiter"].concat(e.baseSizingClasses());return mt(t.concat(r))},wt=function(e,t,r){if(!e)return mt();if(at[e.type]){var a=at[e.type](e,t);if(r&&t.size!==r.size){a=mt(t.sizingClasses(r),[a],t);var i=t.sizeMultiplier/r.sizeMultiplier;a.height*=i,a.depth*=i}return a}throw new n("Got group of unknown type: '"+e.type+"'")};function kt(e,t){var r=mt(["base"],e,t),n=mt(["strut"]);return n.style.height=V(r.height+r.depth),r.depth&&(n.style.verticalAlign=V(-r.depth)),r.children.unshift(n),r}function St(e,t){var r=null;1===e.length&&"tag"===e[0].type&&(r=e[0].tag,e=e[0].body);var n,a=ft(e,t,"root");2===a.length&&a[1].hasClass("tag")&&(n=a.pop());for(var i,o=[],s=[],l=0;l<a.length;l++)if(s.push(a[l]),a[l].hasClass("mbin")||a[l].hasClass("mrel")||a[l].hasClass("allowbreak")){for(var h=!1;l<a.length-1&&a[l+1].hasClass("mspace")&&!a[l+1].hasClass("newline");)l++,s.push(a[l]),a[l].hasClass("nobreak")&&(h=!0);h||(o.push(kt(s,t)),s=[])}else a[l].hasClass("newline")&&(s.pop(),s.length>0&&(o.push(kt(s,t)),s=[]),o.push(a[l]));s.length>0&&o.push(kt(s,t)),r?((i=kt(ft(r,t,!0))).classes=["tag"],o.push(i)):n&&o.push(n);var m=mt(["katex-html"],o);if(m.setAttribute("aria-hidden","true"),i){var c=i.children[0];c.style.height=V(m.height+m.depth),m.depth&&(c.style.verticalAlign=V(-m.depth))}return m}function Mt(e){return new A(e)}var zt=function(){function e(e,t,r){this.type=void 0,this.attributes=void 0,this.children=void 0,this.classes=void 0,this.type=e,this.attributes={},this.children=t||[],this.classes=r||[]}var t=e.prototype;return t.setAttribute=function(e,t){this.attributes[e]=t},t.getAttribute=function(e){return this.attributes[e]},t.toNode=function(){var e=document.createElementNS("http://www.w3.org/1998/Math/MathML",this.type);for(var t in this.attributes)Object.prototype.hasOwnProperty.call(this.attributes,t)&&e.setAttribute(t,this.attributes[t]);this.classes.length>0&&(e.className=G(this.classes));for(var r=0;r<this.children.length;r++)e.appendChild(this.children[r].toNode());return e},t.toMarkup=function(){var e="<"+this.type;for(var t in this.attributes)Object.prototype.hasOwnProperty.call(this.attributes,t)&&(e+=" "+t+'="',e+=l.escape(this.attributes[t]),e+='"');this.classes.length>0&&(e+=' class ="'+l.escape(G(this.classes))+'"'),e+=">";for(var r=0;r<this.children.length;r++)e+=this.children[r].toMarkup();return e+="</"+this.type+">"},t.toText=function(){return this.children.map((function(e){return e.toText()})).join("")},e}(),At=function(){function e(e){this.text=void 0,this.text=e}var t=e.prototype;return t.toNode=function(){return document.createTextNode(this.text)},t.toMarkup=function(){return l.escape(this.toText())},t.toText=function(){return this.text},e}(),Tt={MathNode:zt,TextNode:At,SpaceNode:function(){function e(e){this.width=void 0,this.character=void 0,this.width=e,this.character=e>=.05555&&e<=.05556?"\u200a":e>=.1666&&e<=.1667?"\u2009":e>=.2222&&e<=.2223?"\u2005":e>=.2777&&e<=.2778?"\u2005\u200a":e>=-.05556&&e<=-.05555?"\u200a\u2063":e>=-.1667&&e<=-.1666?"\u2009\u2063":e>=-.2223&&e<=-.2222?"\u205f\u2063":e>=-.2778&&e<=-.2777?"\u2005\u2063":null}var t=e.prototype;return t.toNode=function(){if(this.character)return document.createTextNode(this.character);var e=document.createElementNS("http://www.w3.org/1998/Math/MathML","mspace");return e.setAttribute("width",V(this.width)),e},t.toMarkup=function(){return this.character?"<mtext>"+this.character+"</mtext>":'<mspace width="'+V(this.width)+'"/>'},t.toText=function(){return this.character?this.character:" "},e}(),newDocumentFragment:Mt},Bt=function(e,t,r){return!ae[t][e]||!ae[t][e].replace||55349===e.charCodeAt(0)||we.hasOwnProperty(e)&&r&&(r.fontFamily&&"tt"===r.fontFamily.substr(4,2)||r.font&&"tt"===r.font.substr(4,2))||(e=ae[t][e].replace),new Tt.TextNode(e)},Ct=function(e){return 1===e.length?e[0]:new Tt.MathNode("mrow",e)},qt=function(e,t){if("texttt"===t.fontFamily)return"monospace";if("textsf"===t.fontFamily)return"textit"===t.fontShape&&"textbf"===t.fontWeight?"sans-serif-bold-italic":"textit"===t.fontShape?"sans-serif-italic":"textbf"===t.fontWeight?"bold-sans-serif":"sans-serif";if("textit"===t.fontShape&&"textbf"===t.fontWeight)return"bold-italic";if("textit"===t.fontShape)return"italic";if("textbf"===t.fontWeight)return"bold";var r=t.font;if(!r||"mathnormal"===r)return null;var n=e.mode;if("mathit"===r)return"italic";if("boldsymbol"===r)return"textord"===e.type?"bold":"bold-italic";if("mathbf"===r)return"bold";if("mathbb"===r)return"double-struck";if("mathfrak"===r)return"fraktur";if("mathscr"===r||"mathcal"===r)return"script";if("mathsf"===r)return"sans-serif";if("mathtt"===r)return"monospace";var a=e.text;return l.contains(["\\imath","\\jmath"],a)?null:(ae[n][a]&&ae[n][a].replace&&(a=ae[n][a].replace),q(a,Ke.fontMap[r].fontName,n)?Ke.fontMap[r].variant:null)},Nt=function(e,t,r){if(1===e.length){var n=Rt(e[0],t);return r&&n instanceof zt&&"mo"===n.type&&(n.setAttribute("lspace","0em"),n.setAttribute("rspace","0em")),[n]}for(var a,i=[],o=0;o<e.length;o++){var s=Rt(e[o],t);if(s instanceof zt&&a instanceof zt){if("mtext"===s.type&&"mtext"===a.type&&s.getAttribute("mathvariant")===a.getAttribute("mathvariant")){var l;(l=a.children).push.apply(l,s.children);continue}if("mn"===s.type&&"mn"===a.type){var h;(h=a.children).push.apply(h,s.children);continue}if("mi"===s.type&&1===s.children.length&&"mn"===a.type){var m=s.children[0];if(m instanceof At&&"."===m.text){var c;(c=a.children).push.apply(c,s.children);continue}}else if("mi"===a.type&&1===a.children.length){var u=a.children[0];if(u instanceof At&&"\u0338"===u.text&&("mo"===s.type||"mi"===s.type||"mn"===s.type)){var p=s.children[0];p instanceof At&&p.text.length>0&&(p.text=p.text.slice(0,1)+"\u0338"+p.text.slice(1),i.pop())}}}i.push(s),a=s}return i},It=function(e,t,r){return Ct(Nt(e,t,r))},Rt=function(e,t){if(!e)return new Tt.MathNode("mrow");if(it[e.type])return it[e.type](e,t);throw new n("Got group of unknown type: '"+e.type+"'")};function Ot(e,t,r,n,a){var i,o=Nt(e,r);i=1===o.length&&o[0]instanceof zt&&l.contains(["mrow","mtable"],o[0].type)?o[0]:new Tt.MathNode("mrow",o);var s=new Tt.MathNode("annotation",[new Tt.TextNode(t)]);s.setAttribute("encoding","application/x-tex");var h=new Tt.MathNode("semantics",[i,s]),m=new Tt.MathNode("math",[h]);m.setAttribute("xmlns","http://www.w3.org/1998/Math/MathML"),n&&m.setAttribute("display","block");var c=a?"katex":"katex-mathml";return Ke.makeSpan([c],[m])}var Ht=function(e){return new E({style:e.displayMode?x.DISPLAY:x.TEXT,maxSize:e.maxSize,minRuleThickness:e.minRuleThickness})},Et=function(e,t){if(t.displayMode){var r=["katex-display"];t.leqno&&r.push("leqno"),t.fleqn&&r.push("fleqn"),e=Ke.makeSpan(r,[e])}return e},Lt=function(e,t,r){var n,a=Ht(r);if("mathml"===r.output)return Ot(e,t,a,r.displayMode,!0);if("html"===r.output){var i=St(e,a);n=Ke.makeSpan(["katex"],[i])}else{var o=Ot(e,t,a,r.displayMode,!1),s=St(e,a);n=Ke.makeSpan(["katex"],[o,s])}return Et(n,r)},Dt={widehat:"^",widecheck:"\u02c7",widetilde:"~",utilde:"~",overleftarrow:"\u2190",underleftarrow:"\u2190",xleftarrow:"\u2190",overrightarrow:"\u2192",underrightarrow:"\u2192",xrightarrow:"\u2192",underbrace:"\u23df",overbrace:"\u23de",overgroup:"\u23e0",undergroup:"\u23e1",overleftrightarrow:"\u2194",underleftrightarrow:"\u2194",xleftrightarrow:"\u2194",Overrightarrow:"\u21d2",xRightarrow:"\u21d2",overleftharpoon:"\u21bc",xleftharpoonup:"\u21bc",overrightharpoon:"\u21c0",xrightharpoonup:"\u21c0",xLeftarrow:"\u21d0",xLeftrightarrow:"\u21d4",xhookleftarrow:"\u21a9",xhookrightarrow:"\u21aa",xmapsto:"\u21a6",xrightharpoondown:"\u21c1",xleftharpoondown:"\u21bd",xrightleftharpoons:"\u21cc",xleftrightharpoons:"\u21cb",xtwoheadleftarrow:"\u219e",xtwoheadrightarrow:"\u21a0",xlongequal:"=",xtofrom:"\u21c4",xrightleftarrows:"\u21c4",xrightequilibrium:"\u21cc",xleftequilibrium:"\u21cb","\\cdrightarrow":"\u2192","\\cdleftarrow":"\u2190","\\cdlongequal":"="},Pt={overrightarrow:[["rightarrow"],.888,522,"xMaxYMin"],overleftarrow:[["leftarrow"],.888,522,"xMinYMin"],underrightarrow:[["rightarrow"],.888,522,"xMaxYMin"],underleftarrow:[["leftarrow"],.888,522,"xMinYMin"],xrightarrow:[["rightarrow"],1.469,522,"xMaxYMin"],"\\cdrightarrow":[["rightarrow"],3,522,"xMaxYMin"],xleftarrow:[["leftarrow"],1.469,522,"xMinYMin"],"\\cdleftarrow":[["leftarrow"],3,522,"xMinYMin"],Overrightarrow:[["doublerightarrow"],.888,560,"xMaxYMin"],xRightarrow:[["doublerightarrow"],1.526,560,"xMaxYMin"],xLeftarrow:[["doubleleftarrow"],1.526,560,"xMinYMin"],overleftharpoon:[["leftharpoon"],.888,522,"xMinYMin"],xleftharpoonup:[["leftharpoon"],.888,522,"xMinYMin"],xleftharpoondown:[["leftharpoondown"],.888,522,"xMinYMin"],overrightharpoon:[["rightharpoon"],.888,522,"xMaxYMin"],xrightharpoonup:[["rightharpoon"],.888,522,"xMaxYMin"],xrightharpoondown:[["rightharpoondown"],.888,522,"xMaxYMin"],xlongequal:[["longequal"],.888,334,"xMinYMin"],"\\cdlongequal":[["longequal"],3,334,"xMinYMin"],xtwoheadleftarrow:[["twoheadleftarrow"],.888,334,"xMinYMin"],xtwoheadrightarrow:[["twoheadrightarrow"],.888,334,"xMaxYMin"],overleftrightarrow:[["leftarrow","rightarrow"],.888,522],overbrace:[["leftbrace","midbrace","rightbrace"],1.6,548],underbrace:[["leftbraceunder","midbraceunder","rightbraceunder"],1.6,548],underleftrightarrow:[["leftarrow","rightarrow"],.888,522],xleftrightarrow:[["leftarrow","rightarrow"],1.75,522],xLeftrightarrow:[["doubleleftarrow","doublerightarrow"],1.75,560],xrightleftharpoons:[["leftharpoondownplus","rightharpoonplus"],1.75,716],xleftrightharpoons:[["leftharpoonplus","rightharpoondownplus"],1.75,716],xhookleftarrow:[["leftarrow","righthook"],1.08,522],xhookrightarrow:[["lefthook","rightarrow"],1.08,522],overlinesegment:[["leftlinesegment","rightlinesegment"],.888,522],underlinesegment:[["leftlinesegment","rightlinesegment"],.888,522],overgroup:[["leftgroup","rightgroup"],.888,342],undergroup:[["leftgroupunder","rightgroupunder"],.888,342],xmapsto:[["leftmapsto","rightarrow"],1.5,522],xtofrom:[["leftToFrom","rightToFrom"],1.75,528],xrightleftarrows:[["baraboveleftarrow","rightarrowabovebar"],1.75,901],xrightequilibrium:[["baraboveshortleftharpoon","rightharpoonaboveshortbar"],1.75,716],xleftequilibrium:[["shortbaraboveleftharpoon","shortrightharpoonabovebar"],1.75,716]},Ft=function(e,t,r,n,a){var i,o=e.height+e.depth+r+n;if(/fbox|color|angl/.test(t)){if(i=Ke.makeSpan(["stretchy",t],[],a),"fbox"===t){var s=a.color&&a.getColor();s&&(i.style.borderColor=s)}}else{var l=[];/^[bx]cancel$/.test(t)&&l.push(new Q({x1:"0",y1:"0",x2:"100%",y2:"100%","stroke-width":"0.046em"})),/^x?cancel$/.test(t)&&l.push(new Q({x1:"0",y1:"100%",x2:"100%",y2:"0","stroke-width":"0.046em"}));var h=new K(l,{width:"100%",height:V(o)});i=Ke.makeSvgSpan([],[h],a)}return i.height=o,i.style.height=V(o),i},Vt=function(e){var t=new Tt.MathNode("mo",[new Tt.TextNode(Dt[e.replace(/^\\/,"")])]);return t.setAttribute("stretchy","true"),t},Gt=function(e,t){var r=function(){var r=4e5,n=e.label.substr(1);if(l.contains(["widehat","widecheck","widetilde","utilde"],n)){var a,i,o,s="ordgroup"===(d=e.base).type?d.body.length:1;if(s>5)"widehat"===n||"widecheck"===n?(a=420,r=2364,o=.42,i=n+"4"):(a=312,r=2340,o=.34,i="tilde4");else{var h=[1,1,2,2,3,3][s];"widehat"===n||"widecheck"===n?(r=[0,1062,2364,2364,2364][h],a=[0,239,300,360,420][h],o=[0,.24,.3,.3,.36,.42][h],i=n+h):(r=[0,600,1033,2339,2340][h],a=[0,260,286,306,312][h],o=[0,.26,.286,.3,.306,.34][h],i="tilde"+h)}var m=new J(i),c=new K([m],{width:"100%",height:V(o),viewBox:"0 0 "+r+" "+a,preserveAspectRatio:"none"});return{span:Ke.makeSvgSpan([],[c],t),minWidth:0,height:o}}var u,p,d,f=[],g=Pt[n],v=g[0],b=g[1],y=g[2],x=y/1e3,w=v.length;if(1===w)u=["hide-tail"],p=[g[3]];else if(2===w)u=["halfarrow-left","halfarrow-right"],p=["xMinYMin","xMaxYMin"];else{if(3!==w)throw new Error("Correct katexImagesData or update code here to support\n                    "+w+" children.");u=["brace-left","brace-center","brace-right"],p=["xMinYMin","xMidYMin","xMaxYMin"]}for(var k=0;k<w;k++){var S=new J(v[k]),M=new K([S],{width:"400em",height:V(x),viewBox:"0 0 "+r+" "+y,preserveAspectRatio:p[k]+" slice"}),z=Ke.makeSvgSpan([u[k]],[M],t);if(1===w)return{span:z,minWidth:b,height:x};z.style.height=V(x),f.push(z)}return{span:Ke.makeSpan(["stretchy"],f,t),minWidth:b,height:x}}(),n=r.span,a=r.minWidth,i=r.height;return n.height=i,n.style.height=V(i),a>0&&(n.style.minWidth=V(a)),n};function Ut(e,t){if(!e||e.type!==t)throw new Error("Expected node of type "+t+", but got "+(e?"node of type "+e.type:String(e)));return e}function Yt(e){var t=Xt(e);if(!t)throw new Error("Expected node of symbol group type, but got "+(e?"node of type "+e.type:String(e)));return t}function Xt(e){return e&&("atom"===e.type||re.hasOwnProperty(e.type))?e:null}var Wt=function(e,t){var r,n,a;e&&"supsub"===e.type?(r=(n=Ut(e.base,"accent")).base,e.base=r,a=function(e){if(e instanceof W)return e;throw new Error("Expected span<HtmlDomNode> but got "+String(e)+".")}(wt(e,t)),e.base=n):r=(n=Ut(e,"accent")).base;var i=wt(r,t.havingCrampedStyle()),o=0;if(n.isShifty&&l.isCharacterBox(r)){var s=l.getBaseElem(r);o=ee(wt(s,t.havingCrampedStyle())).skew}var h,m="\\c"===n.label,c=m?i.height+i.depth:Math.min(i.height,t.fontMetrics().xHeight);if(n.isStretchy)h=Gt(n,t),h=Ke.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:i},{type:"elem",elem:h,wrapperClasses:["svg-align"],wrapperStyle:o>0?{width:"calc(100% - "+V(2*o)+")",marginLeft:V(2*o)}:void 0}]},t);else{var u,p;"\\vec"===n.label?(u=Ke.staticSvg("vec",t),p=Ke.svgData.vec[1]):((u=ee(u=Ke.makeOrd({mode:n.mode,text:n.label},t,"textord"))).italic=0,p=u.width,m&&(c+=u.depth)),h=Ke.makeSpan(["accent-body"],[u]);var d="\\textcircled"===n.label;d&&(h.classes.push("accent-full"),c=i.height);var f=o;d||(f-=p/2),h.style.left=V(f),"\\textcircled"===n.label&&(h.style.top=".2em"),h=Ke.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:i},{type:"kern",size:-c},{type:"elem",elem:h}]},t)}var g=Ke.makeSpan(["mord","accent"],[h],t);return a?(a.children[0]=g,a.height=Math.max(g.height,a.height),a.classes[0]="mord",a):g},_t=function(e,t){var r=e.isStretchy?Vt(e.label):new Tt.MathNode("mo",[Bt(e.label,e.mode)]),n=new Tt.MathNode("mover",[Rt(e.base,t),r]);return n.setAttribute("accent","true"),n},jt=new RegExp(["\\acute","\\grave","\\ddot","\\tilde","\\bar","\\breve","\\check","\\hat","\\vec","\\dot","\\mathring"].map((function(e){return"\\"+e})).join("|"));ot({type:"accent",names:["\\acute","\\grave","\\ddot","\\tilde","\\bar","\\breve","\\check","\\hat","\\vec","\\dot","\\mathring","\\widecheck","\\widehat","\\widetilde","\\overrightarrow","\\overleftarrow","\\Overrightarrow","\\overleftrightarrow","\\overgroup","\\overlinesegment","\\overleftharpoon","\\overrightharpoon"],props:{numArgs:1},handler:function(e,t){var r=lt(t[0]),n=!jt.test(e.funcName),a=!n||"\\widehat"===e.funcName||"\\widetilde"===e.funcName||"\\widecheck"===e.funcName;return{type:"accent",mode:e.parser.mode,label:e.funcName,isStretchy:n,isShifty:a,base:r}},htmlBuilder:Wt,mathmlBuilder:_t}),ot({type:"accent",names:["\\'","\\`","\\^","\\~","\\=","\\u","\\.",'\\"',"\\c","\\r","\\H","\\v","\\textcircled"],props:{numArgs:1,allowedInText:!0,allowedInMath:!0,argTypes:["primitive"]},handler:function(e,t){var r=t[0],n=e.parser.mode;return"math"===n&&(e.parser.settings.reportNonstrict("mathVsTextAccents","LaTeX's accent "+e.funcName+" works only in text mode"),n="text"),{type:"accent",mode:n,label:e.funcName,isStretchy:!1,isShifty:!0,base:r}},htmlBuilder:Wt,mathmlBuilder:_t}),ot({type:"accentUnder",names:["\\underleftarrow","\\underrightarrow","\\underleftrightarrow","\\undergroup","\\underlinesegment","\\utilde"],props:{numArgs:1},handler:function(e,t){var r=e.parser,n=e.funcName,a=t[0];return{type:"accentUnder",mode:r.mode,label:n,base:a}},htmlBuilder:function(e,t){var r=wt(e.base,t),n=Gt(e,t),a="\\utilde"===e.label?.12:0,i=Ke.makeVList({positionType:"top",positionData:r.height,children:[{type:"elem",elem:n,wrapperClasses:["svg-align"]},{type:"kern",size:a},{type:"elem",elem:r}]},t);return Ke.makeSpan(["mord","accentunder"],[i],t)},mathmlBuilder:function(e,t){var r=Vt(e.label),n=new Tt.MathNode("munder",[Rt(e.base,t),r]);return n.setAttribute("accentunder","true"),n}});var $t=function(e){var t=new Tt.MathNode("mpadded",e?[e]:[]);return t.setAttribute("width","+0.6em"),t.setAttribute("lspace","0.3em"),t};ot({type:"xArrow",names:["\\xleftarrow","\\xrightarrow","\\xLeftarrow","\\xRightarrow","\\xleftrightarrow","\\xLeftrightarrow","\\xhookleftarrow","\\xhookrightarrow","\\xmapsto","\\xrightharpoondown","\\xrightharpoonup","\\xleftharpoondown","\\xleftharpoonup","\\xrightleftharpoons","\\xleftrightharpoons","\\xlongequal","\\xtwoheadrightarrow","\\xtwoheadleftarrow","\\xtofrom","\\xrightleftarrows","\\xrightequilibrium","\\xleftequilibrium","\\\\cdrightarrow","\\\\cdleftarrow","\\\\cdlongequal"],props:{numArgs:1,numOptionalArgs:1},handler:function(e,t,r){var n=e.parser,a=e.funcName;return{type:"xArrow",mode:n.mode,label:a,body:t[0],below:r[0]}},htmlBuilder:function(e,t){var r,n=t.style,a=t.havingStyle(n.sup()),i=Ke.wrapFragment(wt(e.body,a,t),t),o="\\x"===e.label.slice(0,2)?"x":"cd";i.classes.push(o+"-arrow-pad"),e.below&&(a=t.havingStyle(n.sub()),(r=Ke.wrapFragment(wt(e.below,a,t),t)).classes.push(o+"-arrow-pad"));var s,l=Gt(e,t),h=-t.fontMetrics().axisHeight+.5*l.height,m=-t.fontMetrics().axisHeight-.5*l.height-.111;if((i.depth>.25||"\\xleftequilibrium"===e.label)&&(m-=i.depth),r){var c=-t.fontMetrics().axisHeight+r.height+.5*l.height+.111;s=Ke.makeVList({positionType:"individualShift",children:[{type:"elem",elem:i,shift:m},{type:"elem",elem:l,shift:h},{type:"elem",elem:r,shift:c}]},t)}else s=Ke.makeVList({positionType:"individualShift",children:[{type:"elem",elem:i,shift:m},{type:"elem",elem:l,shift:h}]},t);return s.children[0].children[0].children[1].classes.push("svg-align"),Ke.makeSpan(["mrel","x-arrow"],[s],t)},mathmlBuilder:function(e,t){var r,n=Vt(e.label);if(n.setAttribute("minsize","x"===e.label.charAt(0)?"1.75em":"3.0em"),e.body){var a=$t(Rt(e.body,t));if(e.below){var i=$t(Rt(e.below,t));r=new Tt.MathNode("munderover",[n,i,a])}else r=new Tt.MathNode("mover",[n,a])}else if(e.below){var o=$t(Rt(e.below,t));r=new Tt.MathNode("munder",[n,o])}else r=$t(),r=new Tt.MathNode("mover",[n,r]);return r}});var Zt={">":"\\\\cdrightarrow","<":"\\\\cdleftarrow","=":"\\\\cdlongequal",A:"\\uparrow",V:"\\downarrow","|":"\\Vert",".":"no arrow"},Kt=function(e){return"textord"===e.type&&"@"===e.text};function Jt(e,t,r){var n=Zt[e];switch(n){case"\\\\cdrightarrow":case"\\\\cdleftarrow":return r.callFunction(n,[t[0]],[t[1]]);case"\\uparrow":case"\\downarrow":var a={type:"atom",text:n,mode:"math",family:"rel"},i={type:"ordgroup",mode:"math",body:[r.callFunction("\\\\cdleft",[t[0]],[]),r.callFunction("\\Big",[a],[]),r.callFunction("\\\\cdright",[t[1]],[])]};return r.callFunction("\\\\cdparent",[i],[]);case"\\\\cdlongequal":return r.callFunction("\\\\cdlongequal",[],[]);case"\\Vert":return r.callFunction("\\Big",[{type:"textord",text:"\\Vert",mode:"math"}],[]);default:return{type:"textord",text:" ",mode:"math"}}}ot({type:"cdlabel",names:["\\\\cdleft","\\\\cdright"],props:{numArgs:1},handler:function(e,t){var r=e.parser,n=e.funcName;return{type:"cdlabel",mode:r.mode,side:n.slice(4),label:t[0]}},htmlBuilder:function(e,t){var r=t.havingStyle(t.style.sup()),n=Ke.wrapFragment(wt(e.label,r,t),t);return n.classes.push("cd-label-"+e.side),n.style.bottom=V(.8-n.depth),n.height=0,n.depth=0,n},mathmlBuilder:function(e,t){var r=new Tt.MathNode("mrow",[Rt(e.label,t)]);return(r=new Tt.MathNode("mpadded",[r])).setAttribute("width","0"),"left"===e.side&&r.setAttribute("lspace","-1width"),r.setAttribute("voffset","0.7em"),(r=new Tt.MathNode("mstyle",[r])).setAttribute("displaystyle","false"),r.setAttribute("scriptlevel","1"),r}}),ot({type:"cdlabelparent",names:["\\\\cdparent"],props:{numArgs:1},handler:function(e,t){return{type:"cdlabelparent",mode:e.parser.mode,fragment:t[0]}},htmlBuilder:function(e,t){var r=Ke.wrapFragment(wt(e.fragment,t),t);return r.classes.push("cd-vert-arrow"),r},mathmlBuilder:function(e,t){return new Tt.MathNode("mrow",[Rt(e.fragment,t)])}}),ot({type:"textord",names:["\\@char"],props:{numArgs:1,allowedInText:!0},handler:function(e,t){for(var r=e.parser,a=Ut(t[0],"ordgroup").body,i="",o=0;o<a.length;o++){i+=Ut(a[o],"textord").text}var s,l=parseInt(i);if(isNaN(l))throw new n("\\@char has non-numeric argument "+i);if(l<0||l>=1114111)throw new n("\\@char with invalid code point "+i);return l<=65535?s=String.fromCharCode(l):(l-=65536,s=String.fromCharCode(55296+(l>>10),56320+(1023&l))),{type:"textord",mode:r.mode,text:s}}});var Qt=function(e,t){var r=ft(e.body,t.withColor(e.color),!1);return Ke.makeFragment(r)},er=function(e,t){var r=Nt(e.body,t.withColor(e.color)),n=new Tt.MathNode("mstyle",r);return n.setAttribute("mathcolor",e.color),n};ot({type:"color",names:["\\textcolor"],props:{numArgs:2,allowedInText:!0,argTypes:["color","original"]},handler:function(e,t){var r=e.parser,n=Ut(t[0],"color-token").color,a=t[1];return{type:"color",mode:r.mode,color:n,body:ht(a)}},htmlBuilder:Qt,mathmlBuilder:er}),ot({type:"color",names:["\\color"],props:{numArgs:1,allowedInText:!0,argTypes:["color"]},handler:function(e,t){var r=e.parser,n=e.breakOnTokenText,a=Ut(t[0],"color-token").color;r.gullet.macros.set("\\current@color",a);var i=r.parseExpression(!0,n);return{type:"color",mode:r.mode,color:a,body:i}},htmlBuilder:Qt,mathmlBuilder:er}),ot({type:"cr",names:["\\\\"],props:{numArgs:0,numOptionalArgs:1,argTypes:["size"],allowedInText:!0},handler:function(e,t,r){var n=e.parser,a=r[0],i=!n.settings.displayMode||!n.settings.useStrictBehavior("newLineInDisplayMode","In LaTeX, \\\\ or \\newline does nothing in display mode");return{type:"cr",mode:n.mode,newLine:i,size:a&&Ut(a,"size").value}},htmlBuilder:function(e,t){var r=Ke.makeSpan(["mspace"],[],t);return e.newLine&&(r.classes.push("newline"),e.size&&(r.style.marginTop=V(F(e.size,t)))),r},mathmlBuilder:function(e,t){var r=new Tt.MathNode("mspace");return e.newLine&&(r.setAttribute("linebreak","newline"),e.size&&r.setAttribute("height",V(F(e.size,t)))),r}});var tr={"\\global":"\\global","\\long":"\\\\globallong","\\\\globallong":"\\\\globallong","\\def":"\\gdef","\\gdef":"\\gdef","\\edef":"\\xdef","\\xdef":"\\xdef","\\let":"\\\\globallet","\\futurelet":"\\\\globalfuture"},rr=function(e){var t=e.text;if(/^(?:[\\{}$&#^_]|EOF)$/.test(t))throw new n("Expected a control sequence",e);return t},nr=function(e,t,r,n){var a=e.gullet.macros.get(r.text);null==a&&(r.noexpand=!0,a={tokens:[r],numArgs:0,unexpandable:!e.gullet.isExpandable(r.text)}),e.gullet.macros.set(t,a,n)};ot({type:"internal",names:["\\global","\\long","\\\\globallong"],props:{numArgs:0,allowedInText:!0},handler:function(e){var t=e.parser,r=e.funcName;t.consumeSpaces();var a=t.fetch();if(tr[a.text])return"\\global"!==r&&"\\\\globallong"!==r||(a.text=tr[a.text]),Ut(t.parseFunction(),"internal");throw new n("Invalid token after macro prefix",a)}}),ot({type:"internal",names:["\\def","\\gdef","\\edef","\\xdef"],props:{numArgs:0,allowedInText:!0,primitive:!0},handler:function(e){var t=e.parser,r=e.funcName,a=t.gullet.popToken(),i=a.text;if(/^(?:[\\{}$&#^_]|EOF)$/.test(i))throw new n("Expected a control sequence",a);for(var o,s=0,l=[[]];"{"!==t.gullet.future().text;)if("#"===(a=t.gullet.popToken()).text){if("{"===t.gullet.future().text){o=t.gullet.future(),l[s].push("{");break}if(a=t.gullet.popToken(),!/^[1-9]$/.test(a.text))throw new n('Invalid argument number "'+a.text+'"');if(parseInt(a.text)!==s+1)throw new n('Argument number "'+a.text+'" out of order');s++,l.push([])}else{if("EOF"===a.text)throw new n("Expected a macro definition");l[s].push(a.text)}var h=t.gullet.consumeArg().tokens;return o&&h.unshift(o),"\\edef"!==r&&"\\xdef"!==r||(h=t.gullet.expandTokens(h)).reverse(),t.gullet.macros.set(i,{tokens:h,numArgs:s,delimiters:l},r===tr[r]),{type:"internal",mode:t.mode}}}),ot({type:"internal",names:["\\let","\\\\globallet"],props:{numArgs:0,allowedInText:!0,primitive:!0},handler:function(e){var t=e.parser,r=e.funcName,n=rr(t.gullet.popToken());t.gullet.consumeSpaces();var a=function(e){var t=e.gullet.popToken();return"="===t.text&&" "===(t=e.gullet.popToken()).text&&(t=e.gullet.popToken()),t}(t);return nr(t,n,a,"\\\\globallet"===r),{type:"internal",mode:t.mode}}}),ot({type:"internal",names:["\\futurelet","\\\\globalfuture"],props:{numArgs:0,allowedInText:!0,primitive:!0},handler:function(e){var t=e.parser,r=e.funcName,n=rr(t.gullet.popToken()),a=t.gullet.popToken(),i=t.gullet.popToken();return nr(t,n,i,"\\\\globalfuture"===r),t.gullet.pushToken(i),t.gullet.pushToken(a),{type:"internal",mode:t.mode}}});var ar=function(e,t,r){var n=q(ae.math[e]&&ae.math[e].replace||e,t,r);if(!n)throw new Error("Unsupported symbol "+e+" and font size "+t+".");return n},ir=function(e,t,r,n){var a=r.havingBaseStyle(t),i=Ke.makeSpan(n.concat(a.sizingClasses(r)),[e],r),o=a.sizeMultiplier/r.sizeMultiplier;return i.height*=o,i.depth*=o,i.maxFontSize=a.sizeMultiplier,i},or=function(e,t,r){var n=t.havingBaseStyle(r),a=(1-t.sizeMultiplier/n.sizeMultiplier)*t.fontMetrics().axisHeight;e.classes.push("delimcenter"),e.style.top=V(a),e.height-=a,e.depth+=a},sr=function(e,t,r,n,a,i){var o=function(e,t,r,n){return Ke.makeSymbol(e,"Size"+t+"-Regular",r,n)}(e,t,a,n),s=ir(Ke.makeSpan(["delimsizing","size"+t],[o],n),x.TEXT,n,i);return r&&or(s,n,x.TEXT),s},lr=function(e,t,r){var n;return n="Size1-Regular"===t?"delim-size1":"delim-size4",{type:"elem",elem:Ke.makeSpan(["delimsizinginner",n],[Ke.makeSpan([],[Ke.makeSymbol(e,t,r)])])}},hr=function(e,t,r){var n=T["Size4-Regular"][e.charCodeAt(0)]?T["Size4-Regular"][e.charCodeAt(0)][4]:T["Size1-Regular"][e.charCodeAt(0)][4],a=new J("inner",function(e,t){switch(e){case"\u239c":return"M291 0 H417 V"+t+" H291z M291 0 H417 V"+t+" H291z";case"\u2223":return"M145 0 H188 V"+t+" H145z M145 0 H188 V"+t+" H145z";case"\u2225":return"M145 0 H188 V"+t+" H145z M145 0 H188 V"+t+" H145zM367 0 H410 V"+t+" H367z M367 0 H410 V"+t+" H367z";case"\u239f":return"M457 0 H583 V"+t+" H457z M457 0 H583 V"+t+" H457z";case"\u23a2":return"M319 0 H403 V"+t+" H319z M319 0 H403 V"+t+" H319z";case"\u23a5":return"M263 0 H347 V"+t+" H263z M263 0 H347 V"+t+" H263z";case"\u23aa":return"M384 0 H504 V"+t+" H384z M384 0 H504 V"+t+" H384z";case"\u23d0":return"M312 0 H355 V"+t+" H312z M312 0 H355 V"+t+" H312z";case"\u2016":return"M257 0 H300 V"+t+" H257z M257 0 H300 V"+t+" H257zM478 0 H521 V"+t+" H478z M478 0 H521 V"+t+" H478z";default:return""}}(e,Math.round(1e3*t))),i=new K([a],{width:V(n),height:V(t),style:"width:"+V(n),viewBox:"0 0 "+1e3*n+" "+Math.round(1e3*t),preserveAspectRatio:"xMinYMin"}),o=Ke.makeSvgSpan([],[i],r);return o.height=t,o.style.height=V(t),o.style.width=V(n),{type:"elem",elem:o}},mr={type:"kern",size:-.008},cr=["|","\\lvert","\\rvert","\\vert"],ur=["\\|","\\lVert","\\rVert","\\Vert"],pr=function(e,t,r,n,a,i){var o,s,h,m;o=h=m=e,s=null;var c="Size1-Regular";"\\uparrow"===e?h=m="\u23d0":"\\Uparrow"===e?h=m="\u2016":"\\downarrow"===e?o=h="\u23d0":"\\Downarrow"===e?o=h="\u2016":"\\updownarrow"===e?(o="\\uparrow",h="\u23d0",m="\\downarrow"):"\\Updownarrow"===e?(o="\\Uparrow",h="\u2016",m="\\Downarrow"):l.contains(cr,e)?h="\u2223":l.contains(ur,e)?h="\u2225":"["===e||"\\lbrack"===e?(o="\u23a1",h="\u23a2",m="\u23a3",c="Size4-Regular"):"]"===e||"\\rbrack"===e?(o="\u23a4",h="\u23a5",m="\u23a6",c="Size4-Regular"):"\\lfloor"===e||"\u230a"===e?(h=o="\u23a2",m="\u23a3",c="Size4-Regular"):"\\lceil"===e||"\u2308"===e?(o="\u23a1",h=m="\u23a2",c="Size4-Regular"):"\\rfloor"===e||"\u230b"===e?(h=o="\u23a5",m="\u23a6",c="Size4-Regular"):"\\rceil"===e||"\u2309"===e?(o="\u23a4",h=m="\u23a5",c="Size4-Regular"):"("===e||"\\lparen"===e?(o="\u239b",h="\u239c",m="\u239d",c="Size4-Regular"):")"===e||"\\rparen"===e?(o="\u239e",h="\u239f",m="\u23a0",c="Size4-Regular"):"\\{"===e||"\\lbrace"===e?(o="\u23a7",s="\u23a8",m="\u23a9",h="\u23aa",c="Size4-Regular"):"\\}"===e||"\\rbrace"===e?(o="\u23ab",s="\u23ac",m="\u23ad",h="\u23aa",c="Size4-Regular"):"\\lgroup"===e||"\u27ee"===e?(o="\u23a7",m="\u23a9",h="\u23aa",c="Size4-Regular"):"\\rgroup"===e||"\u27ef"===e?(o="\u23ab",m="\u23ad",h="\u23aa",c="Size4-Regular"):"\\lmoustache"===e||"\u23b0"===e?(o="\u23a7",m="\u23ad",h="\u23aa",c="Size4-Regular"):"\\rmoustache"!==e&&"\u23b1"!==e||(o="\u23ab",m="\u23a9",h="\u23aa",c="Size4-Regular");var u=ar(o,c,a),p=u.height+u.depth,d=ar(h,c,a),f=d.height+d.depth,g=ar(m,c,a),v=g.height+g.depth,b=0,y=1;if(null!==s){var w=ar(s,c,a);b=w.height+w.depth,y=2}var k=p+v+b,S=k+Math.max(0,Math.ceil((t-k)/(y*f)))*y*f,M=n.fontMetrics().axisHeight;r&&(M*=n.sizeMultiplier);var z=S/2-M,A=[];if(A.push(lr(m,c,a)),A.push(mr),null===s){var T=S-p-v+.016;A.push(hr(h,T,n))}else{var B=(S-p-v-b)/2+.016;A.push(hr(h,B,n)),A.push(mr),A.push(lr(s,c,a)),A.push(mr),A.push(hr(h,B,n))}A.push(mr),A.push(lr(o,c,a));var C=n.havingBaseStyle(x.TEXT),q=Ke.makeVList({positionType:"bottom",positionData:z,children:A},C);return ir(Ke.makeSpan(["delimsizing","mult"],[q],C),x.TEXT,n,i)},dr=.08,fr=function(e,t,r,n,a){var i=function(e,t,r){t*=1e3;var n="";switch(e){case"sqrtMain":n=function(e,t){return"M95,"+(622+e+t)+"\nc-2.7,0,-7.17,-2.7,-13.5,-8c-5.8,-5.3,-9.5,-10,-9.5,-14\nc0,-2,0.3,-3.3,1,-4c1.3,-2.7,23.83,-20.7,67.5,-54\nc44.2,-33.3,65.8,-50.3,66.5,-51c1.3,-1.3,3,-2,5,-2c4.7,0,8.7,3.3,12,10\ns173,378,173,378c0.7,0,35.3,-71,104,-213c68.7,-142,137.5,-285,206.5,-429\nc69,-144,104.5,-217.7,106.5,-221\nl"+e/2.075+" -"+e+"\nc5.3,-9.3,12,-14,20,-14\nH400000v"+(40+e)+"H845.2724\ns-225.272,467,-225.272,467s-235,486,-235,486c-2.7,4.7,-9,7,-19,7\nc-6,0,-10,-1,-12,-3s-194,-422,-194,-422s-65,47,-65,47z\nM"+(834+e)+" "+t+"h400000v"+(40+e)+"h-400000z"}(t,M);break;case"sqrtSize1":n=function(e,t){return"M263,"+(601+e+t)+"c0.7,0,18,39.7,52,119\nc34,79.3,68.167,158.7,102.5,238c34.3,79.3,51.8,119.3,52.5,120\nc340,-704.7,510.7,-1060.3,512,-1067\nl"+e/2.084+" -"+e+"\nc4.7,-7.3,11,-11,19,-11\nH40000v"+(40+e)+"H1012.3\ns-271.3,567,-271.3,567c-38.7,80.7,-84,175,-136,283c-52,108,-89.167,185.3,-111.5,232\nc-22.3,46.7,-33.8,70.3,-34.5,71c-4.7,4.7,-12.3,7,-23,7s-12,-1,-12,-1\ns-109,-253,-109,-253c-72.7,-168,-109.3,-252,-110,-252c-10.7,8,-22,16.7,-34,26\nc-22,17.3,-33.3,26,-34,26s-26,-26,-26,-26s76,-59,76,-59s76,-60,76,-60z\nM"+(1001+e)+" "+t+"h400000v"+(40+e)+"h-400000z"}(t,M);break;case"sqrtSize2":n=function(e,t){return"M983 "+(10+e+t)+"\nl"+e/3.13+" -"+e+"\nc4,-6.7,10,-10,18,-10 H400000v"+(40+e)+"\nH1013.1s-83.4,268,-264.1,840c-180.7,572,-277,876.3,-289,913c-4.7,4.7,-12.7,7,-24,7\ns-12,0,-12,0c-1.3,-3.3,-3.7,-11.7,-7,-25c-35.3,-125.3,-106.7,-373.3,-214,-744\nc-10,12,-21,25,-33,39s-32,39,-32,39c-6,-5.3,-15,-14,-27,-26s25,-30,25,-30\nc26.7,-32.7,52,-63,76,-91s52,-60,52,-60s208,722,208,722\nc56,-175.3,126.3,-397.3,211,-666c84.7,-268.7,153.8,-488.2,207.5,-658.5\nc53.7,-170.3,84.5,-266.8,92.5,-289.5z\nM"+(1001+e)+" "+t+"h400000v"+(40+e)+"h-400000z"}(t,M);break;case"sqrtSize3":n=function(e,t){return"M424,"+(2398+e+t)+"\nc-1.3,-0.7,-38.5,-172,-111.5,-514c-73,-342,-109.8,-513.3,-110.5,-514\nc0,-2,-10.7,14.3,-32,49c-4.7,7.3,-9.8,15.7,-15.5,25c-5.7,9.3,-9.8,16,-12.5,20\ns-5,7,-5,7c-4,-3.3,-8.3,-7.7,-13,-13s-13,-13,-13,-13s76,-122,76,-122s77,-121,77,-121\ns209,968,209,968c0,-2,84.7,-361.7,254,-1079c169.3,-717.3,254.7,-1077.7,256,-1081\nl"+e/4.223+" -"+e+"c4,-6.7,10,-10,18,-10 H400000\nv"+(40+e)+"H1014.6\ns-87.3,378.7,-272.6,1166c-185.3,787.3,-279.3,1182.3,-282,1185\nc-2,6,-10,9,-24,9\nc-8,0,-12,-0.7,-12,-2z M"+(1001+e)+" "+t+"\nh400000v"+(40+e)+"h-400000z"}(t,M);break;case"sqrtSize4":n=function(e,t){return"M473,"+(2713+e+t)+"\nc339.3,-1799.3,509.3,-2700,510,-2702 l"+e/5.298+" -"+e+"\nc3.3,-7.3,9.3,-11,18,-11 H400000v"+(40+e)+"H1017.7\ns-90.5,478,-276.2,1466c-185.7,988,-279.5,1483,-281.5,1485c-2,6,-10,9,-24,9\nc-8,0,-12,-0.7,-12,-2c0,-1.3,-5.3,-32,-16,-92c-50.7,-293.3,-119.7,-693.3,-207,-1200\nc0,-1.3,-5.3,8.7,-16,30c-10.7,21.3,-21.3,42.7,-32,64s-16,33,-16,33s-26,-26,-26,-26\ns76,-153,76,-153s77,-151,77,-151c0.7,0.7,35.7,202,105,604c67.3,400.7,102,602.7,104,\n606zM"+(1001+e)+" "+t+"h400000v"+(40+e)+"H1017.7z"}(t,M);break;case"sqrtTall":n=function(e,t,r){return"M702 "+(e+t)+"H400000"+(40+e)+"\nH742v"+(r-54-t-e)+"l-4 4-4 4c-.667.7 -2 1.5-4 2.5s-4.167 1.833-6.5 2.5-5.5 1-9.5 1\nh-12l-28-84c-16.667-52-96.667 -294.333-240-727l-212 -643 -85 170\nc-4-3.333-8.333-7.667-13 -13l-13-13l77-155 77-156c66 199.333 139 419.667\n219 661 l218 661zM702 "+t+"H400000v"+(40+e)+"H742z"}(t,M,r)}return n}(e,n,r),o=new J(e,i),s=new K([o],{width:"400em",height:V(t),viewBox:"0 0 400000 "+r,preserveAspectRatio:"xMinYMin slice"});return Ke.makeSvgSpan(["hide-tail"],[s],a)},gr=["(","\\lparen",")","\\rparen","[","\\lbrack","]","\\rbrack","\\{","\\lbrace","\\}","\\rbrace","\\lfloor","\\rfloor","\u230a","\u230b","\\lceil","\\rceil","\u2308","\u2309","\\surd"],vr=["\\uparrow","\\downarrow","\\updownarrow","\\Uparrow","\\Downarrow","\\Updownarrow","|","\\|","\\vert","\\Vert","\\lvert","\\rvert","\\lVert","\\rVert","\\lgroup","\\rgroup","\u27ee","\u27ef","\\lmoustache","\\rmoustache","\u23b0","\u23b1"],br=["<",">","\\langle","\\rangle","/","\\backslash","\\lt","\\gt"],yr=[0,1.2,1.8,2.4,3],xr=[{type:"small",style:x.SCRIPTSCRIPT},{type:"small",style:x.SCRIPT},{type:"small",style:x.TEXT},{type:"large",size:1},{type:"large",size:2},{type:"large",size:3},{type:"large",size:4}],wr=[{type:"small",style:x.SCRIPTSCRIPT},{type:"small",style:x.SCRIPT},{type:"small",style:x.TEXT},{type:"stack"}],kr=[{type:"small",style:x.SCRIPTSCRIPT},{type:"small",style:x.SCRIPT},{type:"small",style:x.TEXT},{type:"large",size:1},{type:"large",size:2},{type:"large",size:3},{type:"large",size:4},{type:"stack"}],Sr=function(e){if("small"===e.type)return"Main-Regular";if("large"===e.type)return"Size"+e.size+"-Regular";if("stack"===e.type)return"Size4-Regular";throw new Error("Add support for delim type '"+e.type+"' here.")},Mr=function(e,t,r,n){for(var a=Math.min(2,3-n.style.size);a<r.length&&"stack"!==r[a].type;a++){var i=ar(e,Sr(r[a]),"math"),o=i.height+i.depth;if("small"===r[a].type&&(o*=n.havingBaseStyle(r[a].style).sizeMultiplier),o>t)return r[a]}return r[r.length-1]},zr=function(e,t,r,n,a,i){var o;"<"===e||"\\lt"===e||"\u27e8"===e?e="\\langle":">"!==e&&"\\gt"!==e&&"\u27e9"!==e||(e="\\rangle"),o=l.contains(br,e)?xr:l.contains(gr,e)?kr:wr;var s=Mr(e,t,o,n);return"small"===s.type?function(e,t,r,n,a,i){var o=Ke.makeSymbol(e,"Main-Regular",a,n),s=ir(o,t,n,i);return r&&or(s,n,t),s}(e,s.style,r,n,a,i):"large"===s.type?sr(e,s.size,r,n,a,i):pr(e,t,r,n,a,i)},Ar={sqrtImage:function(e,t){var r,n,a=t.havingBaseSizing(),i=Mr("\\surd",e*a.sizeMultiplier,kr,a),o=a.sizeMultiplier,s=Math.max(0,t.minRuleThickness-t.fontMetrics().sqrtRuleThickness),l=0,h=0,m=0;return"small"===i.type?(e<1?o=1:e<1.4&&(o=.7),h=(1+s)/o,(r=fr("sqrtMain",l=(1+s+dr)/o,m=1e3+1e3*s+80,s,t)).style.minWidth="0.853em",n=.833/o):"large"===i.type?(m=1080*yr[i.size],h=(yr[i.size]+s)/o,l=(yr[i.size]+s+dr)/o,(r=fr("sqrtSize"+i.size,l,m,s,t)).style.minWidth="1.02em",n=1/o):(l=e+s+dr,h=e+s,m=Math.floor(1e3*e+s)+80,(r=fr("sqrtTall",l,m,s,t)).style.minWidth="0.742em",n=1.056),r.height=h,r.style.height=V(l),{span:r,advanceWidth:n,ruleWidth:(t.fontMetrics().sqrtRuleThickness+s)*o}},sizedDelim:function(e,t,r,a,i){if("<"===e||"\\lt"===e||"\u27e8"===e?e="\\langle":">"!==e&&"\\gt"!==e&&"\u27e9"!==e||(e="\\rangle"),l.contains(gr,e)||l.contains(br,e))return sr(e,t,!1,r,a,i);if(l.contains(vr,e))return pr(e,yr[t],!1,r,a,i);throw new n("Illegal delimiter: '"+e+"'")},sizeToMaxHeight:yr,customSizedDelim:zr,leftRightDelim:function(e,t,r,n,a,i){var o=n.fontMetrics().axisHeight*n.sizeMultiplier,s=5/n.fontMetrics().ptPerEm,l=Math.max(t-o,r+o),h=Math.max(l/500*901,2*l-s);return zr(e,h,!0,n,a,i)}},Tr={"\\bigl":{mclass:"mopen",size:1},"\\Bigl":{mclass:"mopen",size:2},"\\biggl":{mclass:"mopen",size:3},"\\Biggl":{mclass:"mopen",size:4},"\\bigr":{mclass:"mclose",size:1},"\\Bigr":{mclass:"mclose",size:2},"\\biggr":{mclass:"mclose",size:3},"\\Biggr":{mclass:"mclose",size:4},"\\bigm":{mclass:"mrel",size:1},"\\Bigm":{mclass:"mrel",size:2},"\\biggm":{mclass:"mrel",size:3},"\\Biggm":{mclass:"mrel",size:4},"\\big":{mclass:"mord",size:1},"\\Big":{mclass:"mord",size:2},"\\bigg":{mclass:"mord",size:3},"\\Bigg":{mclass:"mord",size:4}},Br=["(","\\lparen",")","\\rparen","[","\\lbrack","]","\\rbrack","\\{","\\lbrace","\\}","\\rbrace","\\lfloor","\\rfloor","\u230a","\u230b","\\lceil","\\rceil","\u2308","\u2309","<",">","\\langle","\u27e8","\\rangle","\u27e9","\\lt","\\gt","\\lvert","\\rvert","\\lVert","\\rVert","\\lgroup","\\rgroup","\u27ee","\u27ef","\\lmoustache","\\rmoustache","\u23b0","\u23b1","/","\\backslash","|","\\vert","\\|","\\Vert","\\uparrow","\\Uparrow","\\downarrow","\\Downarrow","\\updownarrow","\\Updownarrow","."];function Cr(e,t){var r=Xt(e);if(r&&l.contains(Br,r.text))return r;throw new n(r?"Invalid delimiter '"+r.text+"' after '"+t.funcName+"'":"Invalid delimiter type '"+e.type+"'",e)}function qr(e){if(!e.body)throw new Error("Bug: The leftright ParseNode wasn't fully parsed.")}ot({type:"delimsizing",names:["\\bigl","\\Bigl","\\biggl","\\Biggl","\\bigr","\\Bigr","\\biggr","\\Biggr","\\bigm","\\Bigm","\\biggm","\\Biggm","\\big","\\Big","\\bigg","\\Bigg"],props:{numArgs:1,argTypes:["primitive"]},handler:function(e,t){var r=Cr(t[0],e);return{type:"delimsizing",mode:e.parser.mode,size:Tr[e.funcName].size,mclass:Tr[e.funcName].mclass,delim:r.text}},htmlBuilder:function(e,t){return"."===e.delim?Ke.makeSpan([e.mclass]):Ar.sizedDelim(e.delim,e.size,t,e.mode,[e.mclass])},mathmlBuilder:function(e){var t=[];"."!==e.delim&&t.push(Bt(e.delim,e.mode));var r=new Tt.MathNode("mo",t);"mopen"===e.mclass||"mclose"===e.mclass?r.setAttribute("fence","true"):r.setAttribute("fence","false"),r.setAttribute("stretchy","true");var n=V(Ar.sizeToMaxHeight[e.size]);return r.setAttribute("minsize",n),r.setAttribute("maxsize",n),r}}),ot({type:"leftright-right",names:["\\right"],props:{numArgs:1,primitive:!0},handler:function(e,t){var r=e.parser.gullet.macros.get("\\current@color");if(r&&"string"!=typeof r)throw new n("\\current@color set to non-string in \\right");return{type:"leftright-right",mode:e.parser.mode,delim:Cr(t[0],e).text,color:r}}}),ot({type:"leftright",names:["\\left"],props:{numArgs:1,primitive:!0},handler:function(e,t){var r=Cr(t[0],e),n=e.parser;++n.leftrightDepth;var a=n.parseExpression(!1);--n.leftrightDepth,n.expect("\\right",!1);var i=Ut(n.parseFunction(),"leftright-right");return{type:"leftright",mode:n.mode,body:a,left:r.text,right:i.delim,rightColor:i.color}},htmlBuilder:function(e,t){qr(e);for(var r,n,a=ft(e.body,t,!0,["mopen","mclose"]),i=0,o=0,s=!1,l=0;l<a.length;l++)a[l].isMiddle?s=!0:(i=Math.max(a[l].height,i),o=Math.max(a[l].depth,o));if(i*=t.sizeMultiplier,o*=t.sizeMultiplier,r="."===e.left?xt(t,["mopen"]):Ar.leftRightDelim(e.left,i,o,t,e.mode,["mopen"]),a.unshift(r),s)for(var h=1;h<a.length;h++){var m=a[h].isMiddle;m&&(a[h]=Ar.leftRightDelim(m.delim,i,o,m.options,e.mode,[]))}if("."===e.right)n=xt(t,["mclose"]);else{var c=e.rightColor?t.withColor(e.rightColor):t;n=Ar.leftRightDelim(e.right,i,o,c,e.mode,["mclose"])}return a.push(n),Ke.makeSpan(["minner"],a,t)},mathmlBuilder:function(e,t){qr(e);var r=Nt(e.body,t);if("."!==e.left){var n=new Tt.MathNode("mo",[Bt(e.left,e.mode)]);n.setAttribute("fence","true"),r.unshift(n)}if("."!==e.right){var a=new Tt.MathNode("mo",[Bt(e.right,e.mode)]);a.setAttribute("fence","true"),e.rightColor&&a.setAttribute("mathcolor",e.rightColor),r.push(a)}return Ct(r)}}),ot({type:"middle",names:["\\middle"],props:{numArgs:1,primitive:!0},handler:function(e,t){var r=Cr(t[0],e);if(!e.parser.leftrightDepth)throw new n("\\middle without preceding \\left",r);return{type:"middle",mode:e.parser.mode,delim:r.text}},htmlBuilder:function(e,t){var r;if("."===e.delim)r=xt(t,[]);else{r=Ar.sizedDelim(e.delim,1,t,e.mode,[]);var n={delim:e.delim,options:t};r.isMiddle=n}return r},mathmlBuilder:function(e,t){var r="\\vert"===e.delim||"|"===e.delim?Bt("|","text"):Bt(e.delim,e.mode),n=new Tt.MathNode("mo",[r]);return n.setAttribute("fence","true"),n.setAttribute("lspace","0.05em"),n.setAttribute("rspace","0.05em"),n}});var Nr=function(e,t){var r,n,a,i=Ke.wrapFragment(wt(e.body,t),t),o=e.label.substr(1),s=t.sizeMultiplier,h=0,m=l.isCharacterBox(e.body);if("sout"===o)(r=Ke.makeSpan(["stretchy","sout"])).height=t.fontMetrics().defaultRuleThickness/s,h=-.5*t.fontMetrics().xHeight;else if("phase"===o){var c=F({number:.6,unit:"pt"},t),u=F({number:.35,unit:"ex"},t);s/=t.havingBaseSizing().sizeMultiplier;var p=i.height+i.depth+c+u;i.style.paddingLeft=V(p/2+c);var d=Math.floor(1e3*p*s),f="M400000 "+(n=d)+" H0 L"+n/2+" 0 l65 45 L145 "+(n-80)+" H400000z",g=new K([new J("phase",f)],{width:"400em",height:V(d/1e3),viewBox:"0 0 400000 "+d,preserveAspectRatio:"xMinYMin slice"});(r=Ke.makeSvgSpan(["hide-tail"],[g],t)).style.height=V(p),h=i.depth+c+u}else{/cancel/.test(o)?m||i.classes.push("cancel-pad"):"angl"===o?i.classes.push("anglpad"):i.classes.push("boxpad");var v=0,b=0,y=0;/box/.test(o)?(y=Math.max(t.fontMetrics().fboxrule,t.minRuleThickness),b=v=t.fontMetrics().fboxsep+("colorbox"===o?0:y)):"angl"===o?(v=4*(y=Math.max(t.fontMetrics().defaultRuleThickness,t.minRuleThickness)),b=Math.max(0,.25-i.depth)):b=v=m?.2:0,r=Ft(i,o,v,b,t),/fbox|boxed|fcolorbox/.test(o)?(r.style.borderStyle="solid",r.style.borderWidth=V(y)):"angl"===o&&.049!==y&&(r.style.borderTopWidth=V(y),r.style.borderRightWidth=V(y)),h=i.depth+b,e.backgroundColor&&(r.style.backgroundColor=e.backgroundColor,e.borderColor&&(r.style.borderColor=e.borderColor))}if(e.backgroundColor)a=Ke.makeVList({positionType:"individualShift",children:[{type:"elem",elem:r,shift:h},{type:"elem",elem:i,shift:0}]},t);else{var x=/cancel|phase/.test(o)?["svg-align"]:[];a=Ke.makeVList({positionType:"individualShift",children:[{type:"elem",elem:i,shift:0},{type:"elem",elem:r,shift:h,wrapperClasses:x}]},t)}return/cancel/.test(o)&&(a.height=i.height,a.depth=i.depth),/cancel/.test(o)&&!m?Ke.makeSpan(["mord","cancel-lap"],[a],t):Ke.makeSpan(["mord"],[a],t)},Ir=function(e,t){var r=0,n=new Tt.MathNode(e.label.indexOf("colorbox")>-1?"mpadded":"menclose",[Rt(e.body,t)]);switch(e.label){case"\\cancel":n.setAttribute("notation","updiagonalstrike");break;case"\\bcancel":n.setAttribute("notation","downdiagonalstrike");break;case"\\phase":n.setAttribute("notation","phasorangle");break;case"\\sout":n.setAttribute("notation","horizontalstrike");break;case"\\fbox":n.setAttribute("notation","box");break;case"\\angl":n.setAttribute("notation","actuarial");break;case"\\fcolorbox":case"\\colorbox":if(r=t.fontMetrics().fboxsep*t.fontMetrics().ptPerEm,n.setAttribute("width","+"+2*r+"pt"),n.setAttribute("height","+"+2*r+"pt"),n.setAttribute("lspace",r+"pt"),n.setAttribute("voffset",r+"pt"),"\\fcolorbox"===e.label){var a=Math.max(t.fontMetrics().fboxrule,t.minRuleThickness);n.setAttribute("style","border: "+a+"em solid "+String(e.borderColor))}break;case"\\xcancel":n.setAttribute("notation","updiagonalstrike downdiagonalstrike")}return e.backgroundColor&&n.setAttribute("mathbackground",e.backgroundColor),n};ot({type:"enclose",names:["\\colorbox"],props:{numArgs:2,allowedInText:!0,argTypes:["color","text"]},handler:function(e,t,r){var n=e.parser,a=e.funcName,i=Ut(t[0],"color-token").color,o=t[1];return{type:"enclose",mode:n.mode,label:a,backgroundColor:i,body:o}},htmlBuilder:Nr,mathmlBuilder:Ir}),ot({type:"enclose",names:["\\fcolorbox"],props:{numArgs:3,allowedInText:!0,argTypes:["color","color","text"]},handler:function(e,t,r){var n=e.parser,a=e.funcName,i=Ut(t[0],"color-token").color,o=Ut(t[1],"color-token").color,s=t[2];return{type:"enclose",mode:n.mode,label:a,backgroundColor:o,borderColor:i,body:s}},htmlBuilder:Nr,mathmlBuilder:Ir}),ot({type:"enclose",names:["\\fbox"],props:{numArgs:1,argTypes:["hbox"],allowedInText:!0},handler:function(e,t){return{type:"enclose",mode:e.parser.mode,label:"\\fbox",body:t[0]}}}),ot({type:"enclose",names:["\\cancel","\\bcancel","\\xcancel","\\sout","\\phase"],props:{numArgs:1},handler:function(e,t){var r=e.parser,n=e.funcName,a=t[0];return{type:"enclose",mode:r.mode,label:n,body:a}},htmlBuilder:Nr,mathmlBuilder:Ir}),ot({type:"enclose",names:["\\angl"],props:{numArgs:1,argTypes:["hbox"],allowedInText:!1},handler:function(e,t){return{type:"enclose",mode:e.parser.mode,label:"\\angl",body:t[0]}}});var Rr={};function Or(e){for(var t=e.type,r=e.names,n=e.props,a=e.handler,i=e.htmlBuilder,o=e.mathmlBuilder,s={type:t,numArgs:n.numArgs||0,allowedInText:!1,numOptionalArgs:0,handler:a},l=0;l<r.length;++l)Rr[r[l]]=s;i&&(at[t]=i),o&&(it[t]=o)}var Hr={};function Er(e,t){Hr[e]=t}var Lr=function(){function e(e,t,r){this.lexer=void 0,this.start=void 0,this.end=void 0,this.lexer=e,this.start=t,this.end=r}return e.range=function(t,r){return r?t&&t.loc&&r.loc&&t.loc.lexer===r.loc.lexer?new e(t.loc.lexer,t.loc.start,r.loc.end):null:t&&t.loc},e}(),Dr=function(){function e(e,t){this.text=void 0,this.loc=void 0,this.noexpand=void 0,this.treatAsRelax=void 0,this.text=e,this.loc=t}return e.prototype.range=function(t,r){return new e(r,Lr.range(this,t))},e}();function Pr(e){var t=[];e.consumeSpaces();for(var r=e.fetch().text;"\\hline"===r||"\\hdashline"===r;)e.consume(),t.push("\\hdashline"===r),e.consumeSpaces(),r=e.fetch().text;return t}var Fr=function(e){if(!e.parser.settings.displayMode)throw new n("{"+e.envName+"} can be used only in display mode.")};function Vr(e){if(-1===e.indexOf("ed"))return-1===e.indexOf("*")}function Gr(e,t,r){var a=t.hskipBeforeAndAfter,i=t.addJot,o=t.cols,s=t.arraystretch,l=t.colSeparationType,h=t.autoTag,m=t.singleRow,c=t.emptySingleRow,u=t.maxNumCols,p=t.leqno;if(e.gullet.beginGroup(),m||e.gullet.macros.set("\\cr","\\\\\\relax"),!s){var d=e.gullet.expandMacroAsText("\\arraystretch");if(null==d)s=1;else if(!(s=parseFloat(d))||s<0)throw new n("Invalid \\arraystretch: "+d)}e.gullet.beginGroup();var f=[],g=[f],v=[],b=[],y=null!=h?[]:void 0;function x(){h&&e.gullet.macros.set("\\@eqnsw","1",!0)}function w(){y&&(e.gullet.macros.get("\\df@tag")?(y.push(e.subparse([new Dr("\\df@tag")])),e.gullet.macros.set("\\df@tag",void 0,!0)):y.push(Boolean(h)&&"1"===e.gullet.macros.get("\\@eqnsw")))}for(x(),b.push(Pr(e));;){var k=e.parseExpression(!1,m?"\\end":"\\\\");e.gullet.endGroup(),e.gullet.beginGroup(),k={type:"ordgroup",mode:e.mode,body:k},r&&(k={type:"styling",mode:e.mode,style:r,body:[k]}),f.push(k);var S=e.fetch().text;if("&"===S){if(u&&f.length===u){if(m||l)throw new n("Too many tab characters: &",e.nextToken);e.settings.reportNonstrict("textEnv","Too few columns specified in the {array} column argument.")}e.consume()}else{if("\\end"===S){w(),1===f.length&&"styling"===k.type&&0===k.body[0].body.length&&(g.length>1||!c)&&g.pop(),b.length<g.length+1&&b.push([]);break}if("\\\\"!==S)throw new n("Expected & or \\\\ or \\cr or \\end",e.nextToken);e.consume();var M=void 0;" "!==e.gullet.future().text&&(M=e.parseSizeGroup(!0)),v.push(M?M.value:null),w(),b.push(Pr(e)),f=[],g.push(f),x()}}return e.gullet.endGroup(),e.gullet.endGroup(),{type:"array",mode:e.mode,addJot:i,arraystretch:s,body:g,cols:o,rowGaps:v,hskipBeforeAndAfter:a,hLinesBeforeRow:b,colSeparationType:l,tags:y,leqno:p}}function Ur(e){return"d"===e.substr(0,1)?"display":"text"}var Yr=function(e,t){var r,a,i=e.body.length,o=e.hLinesBeforeRow,s=0,h=new Array(i),m=[],c=Math.max(t.fontMetrics().arrayRuleWidth,t.minRuleThickness),u=1/t.fontMetrics().ptPerEm,p=5*u;e.colSeparationType&&"small"===e.colSeparationType&&(p=t.havingStyle(x.SCRIPT).sizeMultiplier/t.sizeMultiplier*.2778);var d="CD"===e.colSeparationType?F({number:3,unit:"ex"},t):12*u,f=3*u,g=e.arraystretch*d,v=.7*g,b=.3*g,y=0;function w(e){for(var t=0;t<e.length;++t)t>0&&(y+=.25),m.push({pos:y,isDashed:e[t]})}for(w(o[0]),r=0;r<e.body.length;++r){var k=e.body[r],S=v,M=b;s<k.length&&(s=k.length);var z=new Array(k.length);for(a=0;a<k.length;++a){var A=wt(k[a],t);M<A.depth&&(M=A.depth),S<A.height&&(S=A.height),z[a]=A}var T=e.rowGaps[r],B=0;T&&(B=F(T,t))>0&&(M<(B+=b)&&(M=B),B=0),e.addJot&&(M+=f),z.height=S,z.depth=M,y+=S,z.pos=y,y+=M+B,h[r]=z,w(o[r+1])}var C,q,N=y/2+t.fontMetrics().axisHeight,I=e.cols||[],R=[],O=[];if(e.tags&&e.tags.some((function(e){return e})))for(r=0;r<i;++r){var H=h[r],E=H.pos-N,L=e.tags[r],D=void 0;(D=!0===L?Ke.makeSpan(["eqn-num"],[],t):!1===L?Ke.makeSpan([],[],t):Ke.makeSpan([],ft(L,t,!0),t)).depth=H.depth,D.height=H.height,O.push({type:"elem",elem:D,shift:E})}for(a=0,q=0;a<s||q<I.length;++a,++q){for(var P=I[q]||{},G=!0;"separator"===P.type;){if(G||((C=Ke.makeSpan(["arraycolsep"],[])).style.width=V(t.fontMetrics().doubleRuleSep),R.push(C)),"|"!==P.separator&&":"!==P.separator)throw new n("Invalid separator type: "+P.separator);var U="|"===P.separator?"solid":"dashed",Y=Ke.makeSpan(["vertical-separator"],[],t);Y.style.height=V(y),Y.style.borderRightWidth=V(c),Y.style.borderRightStyle=U,Y.style.margin="0 "+V(-c/2);var X=y-N;X&&(Y.style.verticalAlign=V(-X)),R.push(Y),P=I[++q]||{},G=!1}if(!(a>=s)){var W=void 0;(a>0||e.hskipBeforeAndAfter)&&0!==(W=l.deflt(P.pregap,p))&&((C=Ke.makeSpan(["arraycolsep"],[])).style.width=V(W),R.push(C));var _=[];for(r=0;r<i;++r){var j=h[r],$=j[a];if($){var Z=j.pos-N;$.depth=j.depth,$.height=j.height,_.push({type:"elem",elem:$,shift:Z})}}_=Ke.makeVList({positionType:"individualShift",children:_},t),_=Ke.makeSpan(["col-align-"+(P.align||"c")],[_]),R.push(_),(a<s-1||e.hskipBeforeAndAfter)&&0!==(W=l.deflt(P.postgap,p))&&((C=Ke.makeSpan(["arraycolsep"],[])).style.width=V(W),R.push(C))}}if(h=Ke.makeSpan(["mtable"],R),m.length>0){for(var K=Ke.makeLineSpan("hline",t,c),J=Ke.makeLineSpan("hdashline",t,c),Q=[{type:"elem",elem:h,shift:0}];m.length>0;){var ee=m.pop(),te=ee.pos-N;ee.isDashed?Q.push({type:"elem",elem:J,shift:te}):Q.push({type:"elem",elem:K,shift:te})}h=Ke.makeVList({positionType:"individualShift",children:Q},t)}if(0===O.length)return Ke.makeSpan(["mord"],[h],t);var re=Ke.makeVList({positionType:"individualShift",children:O},t);return re=Ke.makeSpan(["tag"],[re],t),Ke.makeFragment([h,re])},Xr={c:"center ",l:"left ",r:"right "},Wr=function(e,t){for(var r=[],n=new Tt.MathNode("mtd",[],["mtr-glue"]),a=new Tt.MathNode("mtd",[],["mml-eqn-num"]),i=0;i<e.body.length;i++){for(var o=e.body[i],s=[],l=0;l<o.length;l++)s.push(new Tt.MathNode("mtd",[Rt(o[l],t)]));e.tags&&e.tags[i]&&(s.unshift(n),s.push(n),e.leqno?s.unshift(a):s.push(a)),r.push(new Tt.MathNode("mtr",s))}var h=new Tt.MathNode("mtable",r),m=.5===e.arraystretch?.1:.16+e.arraystretch-1+(e.addJot?.09:0);h.setAttribute("rowspacing",V(m));var c="",u="";if(e.cols&&e.cols.length>0){var p=e.cols,d="",f=!1,g=0,v=p.length;"separator"===p[0].type&&(c+="top ",g=1),"separator"===p[p.length-1].type&&(c+="bottom ",v-=1);for(var b=g;b<v;b++)"align"===p[b].type?(u+=Xr[p[b].align],f&&(d+="none "),f=!0):"separator"===p[b].type&&f&&(d+="|"===p[b].separator?"solid ":"dashed ",f=!1);h.setAttribute("columnalign",u.trim()),/[sd]/.test(d)&&h.setAttribute("columnlines",d.trim())}if("align"===e.colSeparationType){for(var y=e.cols||[],x="",w=1;w<y.length;w++)x+=w%2?"0em ":"1em ";h.setAttribute("columnspacing",x.trim())}else"alignat"===e.colSeparationType||"gather"===e.colSeparationType?h.setAttribute("columnspacing","0em"):"small"===e.colSeparationType?h.setAttribute("columnspacing","0.2778em"):"CD"===e.colSeparationType?h.setAttribute("columnspacing","0.5em"):h.setAttribute("columnspacing","1em");var k="",S=e.hLinesBeforeRow;c+=S[0].length>0?"left ":"",c+=S[S.length-1].length>0?"right ":"";for(var M=1;M<S.length-1;M++)k+=0===S[M].length?"none ":S[M][0]?"dashed ":"solid ";return/[sd]/.test(k)&&h.setAttribute("rowlines",k.trim()),""!==c&&(h=new Tt.MathNode("menclose",[h])).setAttribute("notation",c.trim()),e.arraystretch&&e.arraystretch<1&&(h=new Tt.MathNode("mstyle",[h])).setAttribute("scriptlevel","1"),h},_r=function(e,t){-1===e.envName.indexOf("ed")&&Fr(e);var r,a=[],i=e.envName.indexOf("at")>-1?"alignat":"align",o="split"===e.envName,s=Gr(e.parser,{cols:a,addJot:!0,autoTag:o?void 0:Vr(e.envName),emptySingleRow:!0,colSeparationType:i,maxNumCols:o?2:void 0,leqno:e.parser.settings.leqno},"display"),l=0,h={type:"ordgroup",mode:e.mode,body:[]};if(t[0]&&"ordgroup"===t[0].type){for(var m="",c=0;c<t[0].body.length;c++){m+=Ut(t[0].body[c],"textord").text}r=Number(m),l=2*r}var u=!l;s.body.forEach((function(e){for(var t=1;t<e.length;t+=2){var a=Ut(e[t],"styling");Ut(a.body[0],"ordgroup").body.unshift(h)}if(u)l<e.length&&(l=e.length);else{var i=e.length/2;if(r<i)throw new n("Too many math in a row: expected "+r+", but got "+i,e[0])}}));for(var p=0;p<l;++p){var d="r",f=0;p%2==1?d="l":p>0&&u&&(f=1),a[p]={type:"align",align:d,pregap:f,postgap:0}}return s.colSeparationType=u?"align":"alignat",s};Or({type:"array",names:["array","darray"],props:{numArgs:1},handler:function(e,t){var r=(Xt(t[0])?[t[0]]:Ut(t[0],"ordgroup").body).map((function(e){var t=Yt(e).text;if(-1!=="lcr".indexOf(t))return{type:"align",align:t};if("|"===t)return{type:"separator",separator:"|"};if(":"===t)return{type:"separator",separator:":"};throw new n("Unknown column alignment: "+t,e)})),a={cols:r,hskipBeforeAndAfter:!0,maxNumCols:r.length};return Gr(e.parser,a,Ur(e.envName))},htmlBuilder:Yr,mathmlBuilder:Wr}),Or({type:"array",names:["matrix","pmatrix","bmatrix","Bmatrix","vmatrix","Vmatrix","matrix*","pmatrix*","bmatrix*","Bmatrix*","vmatrix*","Vmatrix*"],props:{numArgs:0},handler:function(e){var t={matrix:null,pmatrix:["(",")"],bmatrix:["[","]"],Bmatrix:["\\{","\\}"],vmatrix:["|","|"],Vmatrix:["\\Vert","\\Vert"]}[e.envName.replace("*","")],r="c",a={hskipBeforeAndAfter:!1,cols:[{type:"align",align:r}]};if("*"===e.envName.charAt(e.envName.length-1)){var i=e.parser;if(i.consumeSpaces(),"["===i.fetch().text){if(i.consume(),i.consumeSpaces(),r=i.fetch().text,-1==="lcr".indexOf(r))throw new n("Expected l or c or r",i.nextToken);i.consume(),i.consumeSpaces(),i.expect("]"),i.consume(),a.cols=[{type:"align",align:r}]}}var o=Gr(e.parser,a,Ur(e.envName)),s=Math.max.apply(Math,[0].concat(o.body.map((function(e){return e.length}))));return o.cols=new Array(s).fill({type:"align",align:r}),t?{type:"leftright",mode:e.mode,body:[o],left:t[0],right:t[1],rightColor:void 0}:o},htmlBuilder:Yr,mathmlBuilder:Wr}),Or({type:"array",names:["smallmatrix"],props:{numArgs:0},handler:function(e){var t=Gr(e.parser,{arraystretch:.5},"script");return t.colSeparationType="small",t},htmlBuilder:Yr,mathmlBuilder:Wr}),Or({type:"array",names:["subarray"],props:{numArgs:1},handler:function(e,t){var r=(Xt(t[0])?[t[0]]:Ut(t[0],"ordgroup").body).map((function(e){var t=Yt(e).text;if(-1!=="lc".indexOf(t))return{type:"align",align:t};throw new n("Unknown column alignment: "+t,e)}));if(r.length>1)throw new n("{subarray} can contain only one column");var a={cols:r,hskipBeforeAndAfter:!1,arraystretch:.5};if((a=Gr(e.parser,a,"script")).body.length>0&&a.body[0].length>1)throw new n("{subarray} can contain only one column");return a},htmlBuilder:Yr,mathmlBuilder:Wr}),Or({type:"array",names:["cases","dcases","rcases","drcases"],props:{numArgs:0},handler:function(e){var t=Gr(e.parser,{arraystretch:1.2,cols:[{type:"align",align:"l",pregap:0,postgap:1},{type:"align",align:"l",pregap:0,postgap:0}]},Ur(e.envName));return{type:"leftright",mode:e.mode,body:[t],left:e.envName.indexOf("r")>-1?".":"\\{",right:e.envName.indexOf("r")>-1?"\\}":".",rightColor:void 0}},htmlBuilder:Yr,mathmlBuilder:Wr}),Or({type:"array",names:["align","align*","aligned","split"],props:{numArgs:0},handler:_r,htmlBuilder:Yr,mathmlBuilder:Wr}),Or({type:"array",names:["gathered","gather","gather*"],props:{numArgs:0},handler:function(e){l.contains(["gather","gather*"],e.envName)&&Fr(e);var t={cols:[{type:"align",align:"c"}],addJot:!0,colSeparationType:"gather",autoTag:Vr(e.envName),emptySingleRow:!0,leqno:e.parser.settings.leqno};return Gr(e.parser,t,"display")},htmlBuilder:Yr,mathmlBuilder:Wr}),Or({type:"array",names:["alignat","alignat*","alignedat"],props:{numArgs:1},handler:_r,htmlBuilder:Yr,mathmlBuilder:Wr}),Or({type:"array",names:["equation","equation*"],props:{numArgs:0},handler:function(e){Fr(e);var t={autoTag:Vr(e.envName),emptySingleRow:!0,singleRow:!0,maxNumCols:1,leqno:e.parser.settings.leqno};return Gr(e.parser,t,"display")},htmlBuilder:Yr,mathmlBuilder:Wr}),Or({type:"array",names:["CD"],props:{numArgs:0},handler:function(e){return Fr(e),function(e){var t=[];for(e.gullet.beginGroup(),e.gullet.macros.set("\\cr","\\\\\\relax"),e.gullet.beginGroup();;){t.push(e.parseExpression(!1,"\\\\")),e.gullet.endGroup(),e.gullet.beginGroup();var r=e.fetch().text;if("&"!==r&&"\\\\"!==r){if("\\end"===r){0===t[t.length-1].length&&t.pop();break}throw new n("Expected \\\\ or \\cr or \\end",e.nextToken)}e.consume()}for(var a,i,o=[],s=[o],l=0;l<t.length;l++){for(var h=t[l],m={type:"styling",body:[],mode:"math",style:"display"},c=0;c<h.length;c++)if(Kt(h[c])){o.push(m);var u=Yt(h[c+=1]).text,p=new Array(2);if(p[0]={type:"ordgroup",mode:"math",body:[]},p[1]={type:"ordgroup",mode:"math",body:[]},"=|.".indexOf(u)>-1);else{if(!("<>AV".indexOf(u)>-1))throw new n('Expected one of "<>AV=|." after @',h[c]);for(var d=0;d<2;d++){for(var f=!0,g=c+1;g<h.length;g++){if(i=u,("mathord"===(a=h[g]).type||"atom"===a.type)&&a.text===i){f=!1,c=g;break}if(Kt(h[g]))throw new n("Missing a "+u+" character to complete a CD arrow.",h[g]);p[d].body.push(h[g])}if(f)throw new n("Missing a "+u+" character to complete a CD arrow.",h[c])}}var v={type:"styling",body:[Jt(u,p,e)],mode:"math",style:"display"};o.push(v),m={type:"styling",body:[],mode:"math",style:"display"}}else m.body.push(h[c]);l%2==0?o.push(m):o.shift(),o=[],s.push(o)}return e.gullet.endGroup(),e.gullet.endGroup(),{type:"array",mode:"math",body:s,arraystretch:1,addJot:!0,rowGaps:[null],cols:new Array(s[0].length).fill({type:"align",align:"c",pregap:.25,postgap:.25}),colSeparationType:"CD",hLinesBeforeRow:new Array(s.length+1).fill([])}}(e.parser)},htmlBuilder:Yr,mathmlBuilder:Wr}),Er("\\nonumber","\\gdef\\@eqnsw{0}"),Er("\\notag","\\nonumber"),ot({type:"text",names:["\\hline","\\hdashline"],props:{numArgs:0,allowedInText:!0,allowedInMath:!0},handler:function(e,t){throw new n(e.funcName+" valid only within array environment")}});var jr=Rr;ot({type:"environment",names:["\\begin","\\end"],props:{numArgs:1,argTypes:["text"]},handler:function(e,t){var r=e.parser,a=e.funcName,i=t[0];if("ordgroup"!==i.type)throw new n("Invalid environment name",i);for(var o="",s=0;s<i.body.length;++s)o+=Ut(i.body[s],"textord").text;if("\\begin"===a){if(!jr.hasOwnProperty(o))throw new n("No such environment: "+o,i);var l=jr[o],h=r.parseArguments("\\begin{"+o+"}",l),m=h.args,c=h.optArgs,u={mode:r.mode,envName:o,parser:r},p=l.handler(u,m,c);r.expect("\\end",!1);var d=r.nextToken,f=Ut(r.parseFunction(),"environment");if(f.name!==o)throw new n("Mismatch: \\begin{"+o+"} matched by \\end{"+f.name+"}",d);return p}return{type:"environment",mode:r.mode,name:o,nameGroup:i}}});var $r=Ke.makeSpan;function Zr(e,t){var r=ft(e.body,t,!0);return $r([e.mclass],r,t)}function Kr(e,t){var r,n=Nt(e.body,t);return"minner"===e.mclass?r=new Tt.MathNode("mpadded",n):"mord"===e.mclass?e.isCharacterBox?(r=n[0]).type="mi":r=new Tt.MathNode("mi",n):(e.isCharacterBox?(r=n[0]).type="mo":r=new Tt.MathNode("mo",n),"mbin"===e.mclass?(r.attributes.lspace="0.22em",r.attributes.rspace="0.22em"):"mpunct"===e.mclass?(r.attributes.lspace="0em",r.attributes.rspace="0.17em"):"mopen"===e.mclass||"mclose"===e.mclass?(r.attributes.lspace="0em",r.attributes.rspace="0em"):"minner"===e.mclass&&(r.attributes.lspace="0.0556em",r.attributes.width="+0.1111em")),r}ot({type:"mclass",names:["\\mathord","\\mathbin","\\mathrel","\\mathopen","\\mathclose","\\mathpunct","\\mathinner"],props:{numArgs:1,primitive:!0},handler:function(e,t){var r=e.parser,n=e.funcName,a=t[0];return{type:"mclass",mode:r.mode,mclass:"m"+n.substr(5),body:ht(a),isCharacterBox:l.isCharacterBox(a)}},htmlBuilder:Zr,mathmlBuilder:Kr});var Jr=function(e){var t="ordgroup"===e.type&&e.body.length?e.body[0]:e;return"atom"!==t.type||"bin"!==t.family&&"rel"!==t.family?"mord":"m"+t.family};ot({type:"mclass",names:["\\@binrel"],props:{numArgs:2},handler:function(e,t){return{type:"mclass",mode:e.parser.mode,mclass:Jr(t[0]),body:ht(t[1]),isCharacterBox:l.isCharacterBox(t[1])}}}),ot({type:"mclass",names:["\\stackrel","\\overset","\\underset"],props:{numArgs:2},handler:function(e,t){var r,n=e.parser,a=e.funcName,i=t[1],o=t[0];r="\\stackrel"!==a?Jr(i):"mrel";var s={type:"op",mode:i.mode,limits:!0,alwaysHandleSupSub:!0,parentIsSupSub:!1,symbol:!1,suppressBaseShift:"\\stackrel"!==a,body:ht(i)},h={type:"supsub",mode:o.mode,base:s,sup:"\\underset"===a?null:o,sub:"\\underset"===a?o:null};return{type:"mclass",mode:n.mode,mclass:r,body:[h],isCharacterBox:l.isCharacterBox(h)}},htmlBuilder:Zr,mathmlBuilder:Kr});var Qr=function(e,t){var r=e.font,n=t.withFont(r);return wt(e.body,n)},en=function(e,t){var r=e.font,n=t.withFont(r);return Rt(e.body,n)},tn={"\\Bbb":"\\mathbb","\\bold":"\\mathbf","\\frak":"\\mathfrak","\\bm":"\\boldsymbol"};ot({type:"font",names:["\\mathrm","\\mathit","\\mathbf","\\mathnormal","\\mathbb","\\mathcal","\\mathfrak","\\mathscr","\\mathsf","\\mathtt","\\Bbb","\\bold","\\frak"],props:{numArgs:1,allowedInArgument:!0},handler:function(e,t){var r=e.parser,n=e.funcName,a=lt(t[0]),i=n;return i in tn&&(i=tn[i]),{type:"font",mode:r.mode,font:i.slice(1),body:a}},htmlBuilder:Qr,mathmlBuilder:en}),ot({type:"mclass",names:["\\boldsymbol","\\bm"],props:{numArgs:1},handler:function(e,t){var r=e.parser,n=t[0],a=l.isCharacterBox(n);return{type:"mclass",mode:r.mode,mclass:Jr(n),body:[{type:"font",mode:r.mode,font:"boldsymbol",body:n}],isCharacterBox:a}}}),ot({type:"font",names:["\\rm","\\sf","\\tt","\\bf","\\it","\\cal"],props:{numArgs:0,allowedInText:!0},handler:function(e,t){var r=e.parser,n=e.funcName,a=e.breakOnTokenText,i=r.mode,o=r.parseExpression(!0,a);return{type:"font",mode:i,font:"math"+n.slice(1),body:{type:"ordgroup",mode:r.mode,body:o}}},htmlBuilder:Qr,mathmlBuilder:en});var rn=function(e,t){var r=t;return"display"===e?r=r.id>=x.SCRIPT.id?r.text():x.DISPLAY:"text"===e&&r.size===x.DISPLAY.size?r=x.TEXT:"script"===e?r=x.SCRIPT:"scriptscript"===e&&(r=x.SCRIPTSCRIPT),r},nn=function(e,t){var r,n=rn(e.size,t.style),a=n.fracNum(),i=n.fracDen();r=t.havingStyle(a);var o=wt(e.numer,r,t);if(e.continued){var s=8.5/t.fontMetrics().ptPerEm,l=3.5/t.fontMetrics().ptPerEm;o.height=o.height<s?s:o.height,o.depth=o.depth<l?l:o.depth}r=t.havingStyle(i);var h,m,c,u,p,d,f,g,v,b,y=wt(e.denom,r,t);if(e.hasBarLine?(e.barSize?(m=F(e.barSize,t),h=Ke.makeLineSpan("frac-line",t,m)):h=Ke.makeLineSpan("frac-line",t),m=h.height,c=h.height):(h=null,m=0,c=t.fontMetrics().defaultRuleThickness),n.size===x.DISPLAY.size||"display"===e.size?(u=t.fontMetrics().num1,p=m>0?3*c:7*c,d=t.fontMetrics().denom1):(m>0?(u=t.fontMetrics().num2,p=c):(u=t.fontMetrics().num3,p=3*c),d=t.fontMetrics().denom2),h){var w=t.fontMetrics().axisHeight;u-o.depth-(w+.5*m)<p&&(u+=p-(u-o.depth-(w+.5*m))),w-.5*m-(y.height-d)<p&&(d+=p-(w-.5*m-(y.height-d)));var k=-(w-.5*m);f=Ke.makeVList({positionType:"individualShift",children:[{type:"elem",elem:y,shift:d},{type:"elem",elem:h,shift:k},{type:"elem",elem:o,shift:-u}]},t)}else{var S=u-o.depth-(y.height-d);S<p&&(u+=.5*(p-S),d+=.5*(p-S)),f=Ke.makeVList({positionType:"individualShift",children:[{type:"elem",elem:y,shift:d},{type:"elem",elem:o,shift:-u}]},t)}return r=t.havingStyle(n),f.height*=r.sizeMultiplier/t.sizeMultiplier,f.depth*=r.sizeMultiplier/t.sizeMultiplier,g=n.size===x.DISPLAY.size?t.fontMetrics().delim1:n.size===x.SCRIPTSCRIPT.size?t.havingStyle(x.SCRIPT).fontMetrics().delim2:t.fontMetrics().delim2,v=null==e.leftDelim?xt(t,["mopen"]):Ar.customSizedDelim(e.leftDelim,g,!0,t.havingStyle(n),e.mode,["mopen"]),b=e.continued?Ke.makeSpan([]):null==e.rightDelim?xt(t,["mclose"]):Ar.customSizedDelim(e.rightDelim,g,!0,t.havingStyle(n),e.mode,["mclose"]),Ke.makeSpan(["mord"].concat(r.sizingClasses(t)),[v,Ke.makeSpan(["mfrac"],[f]),b],t)},an=function(e,t){var r=new Tt.MathNode("mfrac",[Rt(e.numer,t),Rt(e.denom,t)]);if(e.hasBarLine){if(e.barSize){var n=F(e.barSize,t);r.setAttribute("linethickness",V(n))}}else r.setAttribute("linethickness","0px");var a=rn(e.size,t.style);if(a.size!==t.style.size){r=new Tt.MathNode("mstyle",[r]);var i=a.size===x.DISPLAY.size?"true":"false";r.setAttribute("displaystyle",i),r.setAttribute("scriptlevel","0")}if(null!=e.leftDelim||null!=e.rightDelim){var o=[];if(null!=e.leftDelim){var s=new Tt.MathNode("mo",[new Tt.TextNode(e.leftDelim.replace("\\",""))]);s.setAttribute("fence","true"),o.push(s)}if(o.push(r),null!=e.rightDelim){var l=new Tt.MathNode("mo",[new Tt.TextNode(e.rightDelim.replace("\\",""))]);l.setAttribute("fence","true"),o.push(l)}return Ct(o)}return r};ot({type:"genfrac",names:["\\dfrac","\\frac","\\tfrac","\\dbinom","\\binom","\\tbinom","\\\\atopfrac","\\\\bracefrac","\\\\brackfrac"],props:{numArgs:2,allowedInArgument:!0},handler:function(e,t){var r,n=e.parser,a=e.funcName,i=t[0],o=t[1],s=null,l=null,h="auto";switch(a){case"\\dfrac":case"\\frac":case"\\tfrac":r=!0;break;case"\\\\atopfrac":r=!1;break;case"\\dbinom":case"\\binom":case"\\tbinom":r=!1,s="(",l=")";break;case"\\\\bracefrac":r=!1,s="\\{",l="\\}";break;case"\\\\brackfrac":r=!1,s="[",l="]";break;default:throw new Error("Unrecognized genfrac command")}switch(a){case"\\dfrac":case"\\dbinom":h="display";break;case"\\tfrac":case"\\tbinom":h="text"}return{type:"genfrac",mode:n.mode,continued:!1,numer:i,denom:o,hasBarLine:r,leftDelim:s,rightDelim:l,size:h,barSize:null}},htmlBuilder:nn,mathmlBuilder:an}),ot({type:"genfrac",names:["\\cfrac"],props:{numArgs:2},handler:function(e,t){var r=e.parser,n=(e.funcName,t[0]),a=t[1];return{type:"genfrac",mode:r.mode,continued:!0,numer:n,denom:a,hasBarLine:!0,leftDelim:null,rightDelim:null,size:"display",barSize:null}}}),ot({type:"infix",names:["\\over","\\choose","\\atop","\\brace","\\brack"],props:{numArgs:0,infix:!0},handler:function(e){var t,r=e.parser,n=e.funcName,a=e.token;switch(n){case"\\over":t="\\frac";break;case"\\choose":t="\\binom";break;case"\\atop":t="\\\\atopfrac";break;case"\\brace":t="\\\\bracefrac";break;case"\\brack":t="\\\\brackfrac";break;default:throw new Error("Unrecognized infix genfrac command")}return{type:"infix",mode:r.mode,replaceWith:t,token:a}}});var on=["display","text","script","scriptscript"],sn=function(e){var t=null;return e.length>0&&(t="."===(t=e)?null:t),t};ot({type:"genfrac",names:["\\genfrac"],props:{numArgs:6,allowedInArgument:!0,argTypes:["math","math","size","text","math","math"]},handler:function(e,t){var r,n=e.parser,a=t[4],i=t[5],o=lt(t[0]),s="atom"===o.type&&"open"===o.family?sn(o.text):null,l=lt(t[1]),h="atom"===l.type&&"close"===l.family?sn(l.text):null,m=Ut(t[2],"size"),c=null;r=!!m.isBlank||(c=m.value).number>0;var u="auto",p=t[3];if("ordgroup"===p.type){if(p.body.length>0){var d=Ut(p.body[0],"textord");u=on[Number(d.text)]}}else p=Ut(p,"textord"),u=on[Number(p.text)];return{type:"genfrac",mode:n.mode,numer:a,denom:i,continued:!1,hasBarLine:r,barSize:c,leftDelim:s,rightDelim:h,size:u}},htmlBuilder:nn,mathmlBuilder:an}),ot({type:"infix",names:["\\above"],props:{numArgs:1,argTypes:["size"],infix:!0},handler:function(e,t){var r=e.parser,n=(e.funcName,e.token);return{type:"infix",mode:r.mode,replaceWith:"\\\\abovefrac",size:Ut(t[0],"size").value,token:n}}}),ot({type:"genfrac",names:["\\\\abovefrac"],props:{numArgs:3,argTypes:["math","size","math"]},handler:function(e,t){var r=e.parser,n=(e.funcName,t[0]),a=function(e){if(!e)throw new Error("Expected non-null, but got "+String(e));return e}(Ut(t[1],"infix").size),i=t[2],o=a.number>0;return{type:"genfrac",mode:r.mode,numer:n,denom:i,continued:!1,hasBarLine:o,barSize:a,leftDelim:null,rightDelim:null,size:"auto"}},htmlBuilder:nn,mathmlBuilder:an});var ln=function(e,t){var r,n,a=t.style;"supsub"===e.type?(r=e.sup?wt(e.sup,t.havingStyle(a.sup()),t):wt(e.sub,t.havingStyle(a.sub()),t),n=Ut(e.base,"horizBrace")):n=Ut(e,"horizBrace");var i,o=wt(n.base,t.havingBaseStyle(x.DISPLAY)),s=Gt(n,t);if(n.isOver?(i=Ke.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:o},{type:"kern",size:.1},{type:"elem",elem:s}]},t)).children[0].children[0].children[1].classes.push("svg-align"):(i=Ke.makeVList({positionType:"bottom",positionData:o.depth+.1+s.height,children:[{type:"elem",elem:s},{type:"kern",size:.1},{type:"elem",elem:o}]},t)).children[0].children[0].children[0].classes.push("svg-align"),r){var l=Ke.makeSpan(["mord",n.isOver?"mover":"munder"],[i],t);i=n.isOver?Ke.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:l},{type:"kern",size:.2},{type:"elem",elem:r}]},t):Ke.makeVList({positionType:"bottom",positionData:l.depth+.2+r.height+r.depth,children:[{type:"elem",elem:r},{type:"kern",size:.2},{type:"elem",elem:l}]},t)}return Ke.makeSpan(["mord",n.isOver?"mover":"munder"],[i],t)};ot({type:"horizBrace",names:["\\overbrace","\\underbrace"],props:{numArgs:1},handler:function(e,t){var r=e.parser,n=e.funcName;return{type:"horizBrace",mode:r.mode,label:n,isOver:/^\\over/.test(n),base:t[0]}},htmlBuilder:ln,mathmlBuilder:function(e,t){var r=Vt(e.label);return new Tt.MathNode(e.isOver?"mover":"munder",[Rt(e.base,t),r])}}),ot({type:"href",names:["\\href"],props:{numArgs:2,argTypes:["url","original"],allowedInText:!0},handler:function(e,t){var r=e.parser,n=t[1],a=Ut(t[0],"url").url;return r.settings.isTrusted({command:"\\href",url:a})?{type:"href",mode:r.mode,href:a,body:ht(n)}:r.formatUnsupportedCmd("\\href")},htmlBuilder:function(e,t){var r=ft(e.body,t,!1);return Ke.makeAnchor(e.href,[],r,t)},mathmlBuilder:function(e,t){var r=It(e.body,t);return r instanceof zt||(r=new zt("mrow",[r])),r.setAttribute("href",e.href),r}}),ot({type:"href",names:["\\url"],props:{numArgs:1,argTypes:["url"],allowedInText:!0},handler:function(e,t){var r=e.parser,n=Ut(t[0],"url").url;if(!r.settings.isTrusted({command:"\\url",url:n}))return r.formatUnsupportedCmd("\\url");for(var a=[],i=0;i<n.length;i++){var o=n[i];"~"===o&&(o="\\textasciitilde"),a.push({type:"textord",mode:"text",text:o})}var s={type:"text",mode:r.mode,font:"\\texttt",body:a};return{type:"href",mode:r.mode,href:n,body:ht(s)}}}),ot({type:"hbox",names:["\\hbox"],props:{numArgs:1,argTypes:["text"],allowedInText:!0,primitive:!0},handler:function(e,t){return{type:"hbox",mode:e.parser.mode,body:ht(t[0])}},htmlBuilder:function(e,t){var r=ft(e.body,t,!1);return Ke.makeFragment(r)},mathmlBuilder:function(e,t){return new Tt.MathNode("mrow",Nt(e.body,t))}}),ot({type:"html",names:["\\htmlClass","\\htmlId","\\htmlStyle","\\htmlData"],props:{numArgs:2,argTypes:["raw","original"],allowedInText:!0},handler:function(e,t){var r,a=e.parser,i=e.funcName,o=(e.token,Ut(t[0],"raw").string),s=t[1];a.settings.strict&&a.settings.reportNonstrict("htmlExtension","HTML extension is disabled on strict mode");var l={};switch(i){case"\\htmlClass":l.class=o,r={command:"\\htmlClass",class:o};break;case"\\htmlId":l.id=o,r={command:"\\htmlId",id:o};break;case"\\htmlStyle":l.style=o,r={command:"\\htmlStyle",style:o};break;case"\\htmlData":for(var h=o.split(","),m=0;m<h.length;m++){var c=h[m].split("=");if(2!==c.length)throw new n("Error parsing key-value for \\htmlData");l["data-"+c[0].trim()]=c[1].trim()}r={command:"\\htmlData",attributes:l};break;default:throw new Error("Unrecognized html command")}return a.settings.isTrusted(r)?{type:"html",mode:a.mode,attributes:l,body:ht(s)}:a.formatUnsupportedCmd(i)},htmlBuilder:function(e,t){var r=ft(e.body,t,!1),n=["enclosing"];e.attributes.class&&n.push.apply(n,e.attributes.class.trim().split(/\s+/));var a=Ke.makeSpan(n,r,t);for(var i in e.attributes)"class"!==i&&e.attributes.hasOwnProperty(i)&&a.setAttribute(i,e.attributes[i]);return a},mathmlBuilder:function(e,t){return It(e.body,t)}}),ot({type:"htmlmathml",names:["\\html@mathml"],props:{numArgs:2,allowedInText:!0},handler:function(e,t){return{type:"htmlmathml",mode:e.parser.mode,html:ht(t[0]),mathml:ht(t[1])}},htmlBuilder:function(e,t){var r=ft(e.html,t,!1);return Ke.makeFragment(r)},mathmlBuilder:function(e,t){return It(e.mathml,t)}});var hn=function(e){if(/^[-+]? *(\d+(\.\d*)?|\.\d+)$/.test(e))return{number:+e,unit:"bp"};var t=/([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(e);if(!t)throw new n("Invalid size: '"+e+"' in \\includegraphics");var r={number:+(t[1]+t[2]),unit:t[3]};if(!P(r))throw new n("Invalid unit: '"+r.unit+"' in \\includegraphics.");return r};ot({type:"includegraphics",names:["\\includegraphics"],props:{numArgs:1,numOptionalArgs:1,argTypes:["raw","url"],allowedInText:!1},handler:function(e,t,r){var a=e.parser,i={number:0,unit:"em"},o={number:.9,unit:"em"},s={number:0,unit:"em"},l="";if(r[0])for(var h=Ut(r[0],"raw").string.split(","),m=0;m<h.length;m++){var c=h[m].split("=");if(2===c.length){var u=c[1].trim();switch(c[0].trim()){case"alt":l=u;break;case"width":i=hn(u);break;case"height":o=hn(u);break;case"totalheight":s=hn(u);break;default:throw new n("Invalid key: '"+c[0]+"' in \\includegraphics.")}}}var p=Ut(t[0],"url").url;return""===l&&(l=(l=(l=p).replace(/^.*[\\/]/,"")).substring(0,l.lastIndexOf("."))),a.settings.isTrusted({command:"\\includegraphics",url:p})?{type:"includegraphics",mode:a.mode,alt:l,width:i,height:o,totalheight:s,src:p}:a.formatUnsupportedCmd("\\includegraphics")},htmlBuilder:function(e,t){var r=F(e.height,t),n=0;e.totalheight.number>0&&(n=F(e.totalheight,t)-r);var a=0;e.width.number>0&&(a=F(e.width,t));var i={height:V(r+n)};a>0&&(i.width=V(a)),n>0&&(i.verticalAlign=V(-n));var o=new j(e.src,e.alt,i);return o.height=r,o.depth=n,o},mathmlBuilder:function(e,t){var r=new Tt.MathNode("mglyph",[]);r.setAttribute("alt",e.alt);var n=F(e.height,t),a=0;if(e.totalheight.number>0&&(a=F(e.totalheight,t)-n,r.setAttribute("valign",V(-a))),r.setAttribute("height",V(n+a)),e.width.number>0){var i=F(e.width,t);r.setAttribute("width",V(i))}return r.setAttribute("src",e.src),r}}),ot({type:"kern",names:["\\kern","\\mkern","\\hskip","\\mskip"],props:{numArgs:1,argTypes:["size"],primitive:!0,allowedInText:!0},handler:function(e,t){var r=e.parser,n=e.funcName,a=Ut(t[0],"size");if(r.settings.strict){var i="m"===n[1],o="mu"===a.value.unit;i?(o||r.settings.reportNonstrict("mathVsTextUnits","LaTeX's "+n+" supports only mu units, not "+a.value.unit+" units"),"math"!==r.mode&&r.settings.reportNonstrict("mathVsTextUnits","LaTeX's "+n+" works only in math mode")):o&&r.settings.reportNonstrict("mathVsTextUnits","LaTeX's "+n+" doesn't support mu units")}return{type:"kern",mode:r.mode,dimension:a.value}},htmlBuilder:function(e,t){return Ke.makeGlue(e.dimension,t)},mathmlBuilder:function(e,t){var r=F(e.dimension,t);return new Tt.SpaceNode(r)}}),ot({type:"lap",names:["\\mathllap","\\mathrlap","\\mathclap"],props:{numArgs:1,allowedInText:!0},handler:function(e,t){var r=e.parser,n=e.funcName,a=t[0];return{type:"lap",mode:r.mode,alignment:n.slice(5),body:a}},htmlBuilder:function(e,t){var r;"clap"===e.alignment?(r=Ke.makeSpan([],[wt(e.body,t)]),r=Ke.makeSpan(["inner"],[r],t)):r=Ke.makeSpan(["inner"],[wt(e.body,t)]);var n=Ke.makeSpan(["fix"],[]),a=Ke.makeSpan([e.alignment],[r,n],t),i=Ke.makeSpan(["strut"]);return i.style.height=V(a.height+a.depth),a.depth&&(i.style.verticalAlign=V(-a.depth)),a.children.unshift(i),a=Ke.makeSpan(["thinbox"],[a],t),Ke.makeSpan(["mord","vbox"],[a],t)},mathmlBuilder:function(e,t){var r=new Tt.MathNode("mpadded",[Rt(e.body,t)]);if("rlap"!==e.alignment){var n="llap"===e.alignment?"-1":"-0.5";r.setAttribute("lspace",n+"width")}return r.setAttribute("width","0px"),r}}),ot({type:"styling",names:["\\(","$"],props:{numArgs:0,allowedInText:!0,allowedInMath:!1},handler:function(e,t){var r=e.funcName,n=e.parser,a=n.mode;n.switchMode("math");var i="\\("===r?"\\)":"$",o=n.parseExpression(!1,i);return n.expect(i),n.switchMode(a),{type:"styling",mode:n.mode,style:"text",body:o}}}),ot({type:"text",names:["\\)","\\]"],props:{numArgs:0,allowedInText:!0,allowedInMath:!1},handler:function(e,t){throw new n("Mismatched "+e.funcName)}});var mn=function(e,t){switch(t.style.size){case x.DISPLAY.size:return e.display;case x.TEXT.size:return e.text;case x.SCRIPT.size:return e.script;case x.SCRIPTSCRIPT.size:return e.scriptscript;default:return e.text}};ot({type:"mathchoice",names:["\\mathchoice"],props:{numArgs:4,primitive:!0},handler:function(e,t){return{type:"mathchoice",mode:e.parser.mode,display:ht(t[0]),text:ht(t[1]),script:ht(t[2]),scriptscript:ht(t[3])}},htmlBuilder:function(e,t){var r=mn(e,t),n=ft(r,t,!1);return Ke.makeFragment(n)},mathmlBuilder:function(e,t){var r=mn(e,t);return It(r,t)}});var cn=function(e,t,r,n,a,i,o){e=Ke.makeSpan([],[e]);var s,h,m,c=r&&l.isCharacterBox(r);if(t){var u=wt(t,n.havingStyle(a.sup()),n);h={elem:u,kern:Math.max(n.fontMetrics().bigOpSpacing1,n.fontMetrics().bigOpSpacing3-u.depth)}}if(r){var p=wt(r,n.havingStyle(a.sub()),n);s={elem:p,kern:Math.max(n.fontMetrics().bigOpSpacing2,n.fontMetrics().bigOpSpacing4-p.height)}}if(h&&s){var d=n.fontMetrics().bigOpSpacing5+s.elem.height+s.elem.depth+s.kern+e.depth+o;m=Ke.makeVList({positionType:"bottom",positionData:d,children:[{type:"kern",size:n.fontMetrics().bigOpSpacing5},{type:"elem",elem:s.elem,marginLeft:V(-i)},{type:"kern",size:s.kern},{type:"elem",elem:e},{type:"kern",size:h.kern},{type:"elem",elem:h.elem,marginLeft:V(i)},{type:"kern",size:n.fontMetrics().bigOpSpacing5}]},n)}else if(s){var f=e.height-o;m=Ke.makeVList({positionType:"top",positionData:f,children:[{type:"kern",size:n.fontMetrics().bigOpSpacing5},{type:"elem",elem:s.elem,marginLeft:V(-i)},{type:"kern",size:s.kern},{type:"elem",elem:e}]},n)}else{if(!h)return e;var g=e.depth+o;m=Ke.makeVList({positionType:"bottom",positionData:g,children:[{type:"elem",elem:e},{type:"kern",size:h.kern},{type:"elem",elem:h.elem,marginLeft:V(i)},{type:"kern",size:n.fontMetrics().bigOpSpacing5}]},n)}var v=[m];if(s&&0!==i&&!c){var b=Ke.makeSpan(["mspace"],[],n);b.style.marginRight=V(i),v.unshift(b)}return Ke.makeSpan(["mop","op-limits"],v,n)},un=["\\smallint"],pn=function(e,t){var r,n,a,i=!1;"supsub"===e.type?(r=e.sup,n=e.sub,a=Ut(e.base,"op"),i=!0):a=Ut(e,"op");var o,s=t.style,h=!1;if(s.size===x.DISPLAY.size&&a.symbol&&!l.contains(un,a.name)&&(h=!0),a.symbol){var m=h?"Size2-Regular":"Size1-Regular",c="";if("\\oiint"!==a.name&&"\\oiiint"!==a.name||(c=a.name.substr(1),a.name="oiint"===c?"\\iint":"\\iiint"),o=Ke.makeSymbol(a.name,m,"math",t,["mop","op-symbol",h?"large-op":"small-op"]),c.length>0){var u=o.italic,p=Ke.staticSvg(c+"Size"+(h?"2":"1"),t);o=Ke.makeVList({positionType:"individualShift",children:[{type:"elem",elem:o,shift:0},{type:"elem",elem:p,shift:h?.08:0}]},t),a.name="\\"+c,o.classes.unshift("mop"),o.italic=u}}else if(a.body){var d=ft(a.body,t,!0);1===d.length&&d[0]instanceof Z?(o=d[0]).classes[0]="mop":o=Ke.makeSpan(["mop"],d,t)}else{for(var f=[],g=1;g<a.name.length;g++)f.push(Ke.mathsym(a.name[g],a.mode,t));o=Ke.makeSpan(["mop"],f,t)}var v=0,b=0;return(o instanceof Z||"\\oiint"===a.name||"\\oiiint"===a.name)&&!a.suppressBaseShift&&(v=(o.height-o.depth)/2-t.fontMetrics().axisHeight,b=o.italic),i?cn(o,r,n,t,s,b,v):(v&&(o.style.position="relative",o.style.top=V(v)),o)},dn=function(e,t){var r;if(e.symbol)r=new zt("mo",[Bt(e.name,e.mode)]),l.contains(un,e.name)&&r.setAttribute("largeop","false");else if(e.body)r=new zt("mo",Nt(e.body,t));else{r=new zt("mi",[new At(e.name.slice(1))]);var n=new zt("mo",[Bt("\u2061","text")]);r=e.parentIsSupSub?new zt("mrow",[r,n]):Mt([r,n])}return r},fn={"\u220f":"\\prod","\u2210":"\\coprod","\u2211":"\\sum","\u22c0":"\\bigwedge","\u22c1":"\\bigvee","\u22c2":"\\bigcap","\u22c3":"\\bigcup","\u2a00":"\\bigodot","\u2a01":"\\bigoplus","\u2a02":"\\bigotimes","\u2a04":"\\biguplus","\u2a06":"\\bigsqcup"};ot({type:"op",names:["\\coprod","\\bigvee","\\bigwedge","\\biguplus","\\bigcap","\\bigcup","\\intop","\\prod","\\sum","\\bigotimes","\\bigoplus","\\bigodot","\\bigsqcup","\\smallint","\u220f","\u2210","\u2211","\u22c0","\u22c1","\u22c2","\u22c3","\u2a00","\u2a01","\u2a02","\u2a04","\u2a06"],props:{numArgs:0},handler:function(e,t){var r=e.parser,n=e.funcName;return 1===n.length&&(n=fn[n]),{type:"op",mode:r.mode,limits:!0,parentIsSupSub:!1,symbol:!0,name:n}},htmlBuilder:pn,mathmlBuilder:dn}),ot({type:"op",names:["\\mathop"],props:{numArgs:1,primitive:!0},handler:function(e,t){var r=e.parser,n=t[0];return{type:"op",mode:r.mode,limits:!1,parentIsSupSub:!1,symbol:!1,body:ht(n)}},htmlBuilder:pn,mathmlBuilder:dn});var gn={"\u222b":"\\int","\u222c":"\\iint","\u222d":"\\iiint","\u222e":"\\oint","\u222f":"\\oiint","\u2230":"\\oiiint"};ot({type:"op",names:["\\arcsin","\\arccos","\\arctan","\\arctg","\\arcctg","\\arg","\\ch","\\cos","\\cosec","\\cosh","\\cot","\\cotg","\\coth","\\csc","\\ctg","\\cth","\\deg","\\dim","\\exp","\\hom","\\ker","\\lg","\\ln","\\log","\\sec","\\sin","\\sinh","\\sh","\\tan","\\tanh","\\tg","\\th"],props:{numArgs:0},handler:function(e){var t=e.parser,r=e.funcName;return{type:"op",mode:t.mode,limits:!1,parentIsSupSub:!1,symbol:!1,name:r}},htmlBuilder:pn,mathmlBuilder:dn}),ot({type:"op",names:["\\det","\\gcd","\\inf","\\lim","\\max","\\min","\\Pr","\\sup"],props:{numArgs:0},handler:function(e){var t=e.parser,r=e.funcName;return{type:"op",mode:t.mode,limits:!0,parentIsSupSub:!1,symbol:!1,name:r}},htmlBuilder:pn,mathmlBuilder:dn}),ot({type:"op",names:["\\int","\\iint","\\iiint","\\oint","\\oiint","\\oiiint","\u222b","\u222c","\u222d","\u222e","\u222f","\u2230"],props:{numArgs:0},handler:function(e){var t=e.parser,r=e.funcName;return 1===r.length&&(r=gn[r]),{type:"op",mode:t.mode,limits:!1,parentIsSupSub:!1,symbol:!0,name:r}},htmlBuilder:pn,mathmlBuilder:dn});var vn=function(e,t){var r,n,a,i,o=!1;if("supsub"===e.type?(r=e.sup,n=e.sub,a=Ut(e.base,"operatorname"),o=!0):a=Ut(e,"operatorname"),a.body.length>0){for(var s=a.body.map((function(e){var t=e.text;return"string"==typeof t?{type:"textord",mode:e.mode,text:t}:e})),l=ft(s,t.withFont("mathrm"),!0),h=0;h<l.length;h++){var m=l[h];m instanceof Z&&(m.text=m.text.replace(/\u2212/,"-").replace(/\u2217/,"*"))}i=Ke.makeSpan(["mop"],l,t)}else i=Ke.makeSpan(["mop"],[],t);return o?cn(i,r,n,t,t.style,0,0):i};function bn(e,t,r){for(var n=ft(e,t,!1),a=t.sizeMultiplier/r.sizeMultiplier,i=0;i<n.length;i++){var o=n[i].classes.indexOf("sizing");o<0?Array.prototype.push.apply(n[i].classes,t.sizingClasses(r)):n[i].classes[o+1]==="reset-size"+t.size&&(n[i].classes[o+1]="reset-size"+r.size),n[i].height*=a,n[i].depth*=a}return Ke.makeFragment(n)}ot({type:"operatorname",names:["\\operatorname@","\\operatornamewithlimits"],props:{numArgs:1},handler:function(e,t){var r=e.parser,n=e.funcName,a=t[0];return{type:"operatorname",mode:r.mode,body:ht(a),alwaysHandleSupSub:"\\operatornamewithlimits"===n,limits:!1,parentIsSupSub:!1}},htmlBuilder:vn,mathmlBuilder:function(e,t){for(var r=Nt(e.body,t.withFont("mathrm")),n=!0,a=0;a<r.length;a++){var i=r[a];if(i instanceof Tt.SpaceNode);else if(i instanceof Tt.MathNode)switch(i.type){case"mi":case"mn":case"ms":case"mspace":case"mtext":break;case"mo":var o=i.children[0];1===i.children.length&&o instanceof Tt.TextNode?o.text=o.text.replace(/\u2212/,"-").replace(/\u2217/,"*"):n=!1;break;default:n=!1}else n=!1}if(n){var s=r.map((function(e){return e.toText()})).join("");r=[new Tt.TextNode(s)]}var l=new Tt.MathNode("mi",r);l.setAttribute("mathvariant","normal");var h=new Tt.MathNode("mo",[Bt("\u2061","text")]);return e.parentIsSupSub?new Tt.MathNode("mrow",[l,h]):Tt.newDocumentFragment([l,h])}}),Er("\\operatorname","\\@ifstar\\operatornamewithlimits\\operatorname@"),st({type:"ordgroup",htmlBuilder:function(e,t){return e.semisimple?Ke.makeFragment(ft(e.body,t,!1)):Ke.makeSpan(["mord"],ft(e.body,t,!0),t)},mathmlBuilder:function(e,t){return It(e.body,t,!0)}}),ot({type:"overline",names:["\\overline"],props:{numArgs:1},handler:function(e,t){var r=e.parser,n=t[0];return{type:"overline",mode:r.mode,body:n}},htmlBuilder:function(e,t){var r=wt(e.body,t.havingCrampedStyle()),n=Ke.makeLineSpan("overline-line",t),a=t.fontMetrics().defaultRuleThickness,i=Ke.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:r},{type:"kern",size:3*a},{type:"elem",elem:n},{type:"kern",size:a}]},t);return Ke.makeSpan(["mord","overline"],[i],t)},mathmlBuilder:function(e,t){var r=new Tt.MathNode("mo",[new Tt.TextNode("\u203e")]);r.setAttribute("stretchy","true");var n=new Tt.MathNode("mover",[Rt(e.body,t),r]);return n.setAttribute("accent","true"),n}}),ot({type:"phantom",names:["\\phantom"],props:{numArgs:1,allowedInText:!0},handler:function(e,t){var r=e.parser,n=t[0];return{type:"phantom",mode:r.mode,body:ht(n)}},htmlBuilder:function(e,t){var r=ft(e.body,t.withPhantom(),!1);return Ke.makeFragment(r)},mathmlBuilder:function(e,t){var r=Nt(e.body,t);return new Tt.MathNode("mphantom",r)}}),ot({type:"hphantom",names:["\\hphantom"],props:{numArgs:1,allowedInText:!0},handler:function(e,t){var r=e.parser,n=t[0];return{type:"hphantom",mode:r.mode,body:n}},htmlBuilder:function(e,t){var r=Ke.makeSpan([],[wt(e.body,t.withPhantom())]);if(r.height=0,r.depth=0,r.children)for(var n=0;n<r.children.length;n++)r.children[n].height=0,r.children[n].depth=0;return r=Ke.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:r}]},t),Ke.makeSpan(["mord"],[r],t)},mathmlBuilder:function(e,t){var r=Nt(ht(e.body),t),n=new Tt.MathNode("mphantom",r),a=new Tt.MathNode("mpadded",[n]);return a.setAttribute("height","0px"),a.setAttribute("depth","0px"),a}}),ot({type:"vphantom",names:["\\vphantom"],props:{numArgs:1,allowedInText:!0},handler:function(e,t){var r=e.parser,n=t[0];return{type:"vphantom",mode:r.mode,body:n}},htmlBuilder:function(e,t){var r=Ke.makeSpan(["inner"],[wt(e.body,t.withPhantom())]),n=Ke.makeSpan(["fix"],[]);return Ke.makeSpan(["mord","rlap"],[r,n],t)},mathmlBuilder:function(e,t){var r=Nt(ht(e.body),t),n=new Tt.MathNode("mphantom",r),a=new Tt.MathNode("mpadded",[n]);return a.setAttribute("width","0px"),a}}),ot({type:"raisebox",names:["\\raisebox"],props:{numArgs:2,argTypes:["size","hbox"],allowedInText:!0},handler:function(e,t){var r=e.parser,n=Ut(t[0],"size").value,a=t[1];return{type:"raisebox",mode:r.mode,dy:n,body:a}},htmlBuilder:function(e,t){var r=wt(e.body,t),n=F(e.dy,t);return Ke.makeVList({positionType:"shift",positionData:-n,children:[{type:"elem",elem:r}]},t)},mathmlBuilder:function(e,t){var r=new Tt.MathNode("mpadded",[Rt(e.body,t)]),n=e.dy.number+e.dy.unit;return r.setAttribute("voffset",n),r}}),ot({type:"internal",names:["\\relax"],props:{numArgs:0,allowedInText:!0},handler:function(e){return{type:"internal",mode:e.parser.mode}}}),ot({type:"rule",names:["\\rule"],props:{numArgs:2,numOptionalArgs:1,argTypes:["size","size","size"]},handler:function(e,t,r){var n=e.parser,a=r[0],i=Ut(t[0],"size"),o=Ut(t[1],"size");return{type:"rule",mode:n.mode,shift:a&&Ut(a,"size").value,width:i.value,height:o.value}},htmlBuilder:function(e,t){var r=Ke.makeSpan(["mord","rule"],[],t),n=F(e.width,t),a=F(e.height,t),i=e.shift?F(e.shift,t):0;return r.style.borderRightWidth=V(n),r.style.borderTopWidth=V(a),r.style.bottom=V(i),r.width=n,r.height=a+i,r.depth=-i,r.maxFontSize=1.125*a*t.sizeMultiplier,r},mathmlBuilder:function(e,t){var r=F(e.width,t),n=F(e.height,t),a=e.shift?F(e.shift,t):0,i=t.color&&t.getColor()||"black",o=new Tt.MathNode("mspace");o.setAttribute("mathbackground",i),o.setAttribute("width",V(r)),o.setAttribute("height",V(n));var s=new Tt.MathNode("mpadded",[o]);return a>=0?s.setAttribute("height",V(a)):(s.setAttribute("height",V(a)),s.setAttribute("depth",V(-a))),s.setAttribute("voffset",V(a)),s}});var yn=["\\tiny","\\sixptsize","\\scriptsize","\\footnotesize","\\small","\\normalsize","\\large","\\Large","\\LARGE","\\huge","\\Huge"];ot({type:"sizing",names:yn,props:{numArgs:0,allowedInText:!0},handler:function(e,t){var r=e.breakOnTokenText,n=e.funcName,a=e.parser,i=a.parseExpression(!1,r);return{type:"sizing",mode:a.mode,size:yn.indexOf(n)+1,body:i}},htmlBuilder:function(e,t){var r=t.havingSize(e.size);return bn(e.body,r,t)},mathmlBuilder:function(e,t){var r=t.havingSize(e.size),n=Nt(e.body,r),a=new Tt.MathNode("mstyle",n);return a.setAttribute("mathsize",V(r.sizeMultiplier)),a}}),ot({type:"smash",names:["\\smash"],props:{numArgs:1,numOptionalArgs:1,allowedInText:!0},handler:function(e,t,r){var n=e.parser,a=!1,i=!1,o=r[0]&&Ut(r[0],"ordgroup");if(o)for(var s="",l=0;l<o.body.length;++l){if("t"===(s=o.body[l].text))a=!0;else{if("b"!==s){a=!1,i=!1;break}i=!0}}else a=!0,i=!0;var h=t[0];return{type:"smash",mode:n.mode,body:h,smashHeight:a,smashDepth:i}},htmlBuilder:function(e,t){var r=Ke.makeSpan([],[wt(e.body,t)]);if(!e.smashHeight&&!e.smashDepth)return r;if(e.smashHeight&&(r.height=0,r.children))for(var n=0;n<r.children.length;n++)r.children[n].height=0;if(e.smashDepth&&(r.depth=0,r.children))for(var a=0;a<r.children.length;a++)r.children[a].depth=0;var i=Ke.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:r}]},t);return Ke.makeSpan(["mord"],[i],t)},mathmlBuilder:function(e,t){var r=new Tt.MathNode("mpadded",[Rt(e.body,t)]);return e.smashHeight&&r.setAttribute("height","0px"),e.smashDepth&&r.setAttribute("depth","0px"),r}}),ot({type:"sqrt",names:["\\sqrt"],props:{numArgs:1,numOptionalArgs:1},handler:function(e,t,r){var n=e.parser,a=r[0],i=t[0];return{type:"sqrt",mode:n.mode,body:i,index:a}},htmlBuilder:function(e,t){var r=wt(e.body,t.havingCrampedStyle());0===r.height&&(r.height=t.fontMetrics().xHeight),r=Ke.wrapFragment(r,t);var n=t.fontMetrics().defaultRuleThickness,a=n;t.style.id<x.TEXT.id&&(a=t.fontMetrics().xHeight);var i=n+a/4,o=r.height+r.depth+i+n,s=Ar.sqrtImage(o,t),l=s.span,h=s.ruleWidth,m=s.advanceWidth,c=l.height-h;c>r.height+r.depth+i&&(i=(i+c-r.height-r.depth)/2);var u=l.height-r.height-i-h;r.style.paddingLeft=V(m);var p=Ke.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:r,wrapperClasses:["svg-align"]},{type:"kern",size:-(r.height+u)},{type:"elem",elem:l},{type:"kern",size:h}]},t);if(e.index){var d=t.havingStyle(x.SCRIPTSCRIPT),f=wt(e.index,d,t),g=.6*(p.height-p.depth),v=Ke.makeVList({positionType:"shift",positionData:-g,children:[{type:"elem",elem:f}]},t),b=Ke.makeSpan(["root"],[v]);return Ke.makeSpan(["mord","sqrt"],[b,p],t)}return Ke.makeSpan(["mord","sqrt"],[p],t)},mathmlBuilder:function(e,t){var r=e.body,n=e.index;return n?new Tt.MathNode("mroot",[Rt(r,t),Rt(n,t)]):new Tt.MathNode("msqrt",[Rt(r,t)])}});var xn={display:x.DISPLAY,text:x.TEXT,script:x.SCRIPT,scriptscript:x.SCRIPTSCRIPT};ot({type:"styling",names:["\\displaystyle","\\textstyle","\\scriptstyle","\\scriptscriptstyle"],props:{numArgs:0,allowedInText:!0,primitive:!0},handler:function(e,t){var r=e.breakOnTokenText,n=e.funcName,a=e.parser,i=a.parseExpression(!0,r),o=n.slice(1,n.length-5);return{type:"styling",mode:a.mode,style:o,body:i}},htmlBuilder:function(e,t){var r=xn[e.style],n=t.havingStyle(r).withFont("");return bn(e.body,n,t)},mathmlBuilder:function(e,t){var r=xn[e.style],n=t.havingStyle(r),a=Nt(e.body,n),i=new Tt.MathNode("mstyle",a),o={display:["0","true"],text:["0","false"],script:["1","false"],scriptscript:["2","false"]}[e.style];return i.setAttribute("scriptlevel",o[0]),i.setAttribute("displaystyle",o[1]),i}});var wn=function(e,t){var r=e.base;return r?"op"===r.type?r.limits&&(t.style.size===x.DISPLAY.size||r.alwaysHandleSupSub)?pn:null:"operatorname"===r.type?r.alwaysHandleSupSub&&(t.style.size===x.DISPLAY.size||r.limits)?vn:null:"accent"===r.type?l.isCharacterBox(r.base)?Wt:null:"horizBrace"===r.type&&!e.sub===r.isOver?ln:null:null};st({type:"supsub",htmlBuilder:function(e,t){var r=wn(e,t);if(r)return r(e,t);var n,a,i,o=e.base,s=e.sup,h=e.sub,m=wt(o,t),c=t.fontMetrics(),u=0,p=0,d=o&&l.isCharacterBox(o);if(s){var f=t.havingStyle(t.style.sup());n=wt(s,f,t),d||(u=m.height-f.fontMetrics().supDrop*f.sizeMultiplier/t.sizeMultiplier)}if(h){var g=t.havingStyle(t.style.sub());a=wt(h,g,t),d||(p=m.depth+g.fontMetrics().subDrop*g.sizeMultiplier/t.sizeMultiplier)}i=t.style===x.DISPLAY?c.sup1:t.style.cramped?c.sup3:c.sup2;var v,b=t.sizeMultiplier,y=V(.5/c.ptPerEm/b),w=null;if(a){var k=e.base&&"op"===e.base.type&&e.base.name&&("\\oiint"===e.base.name||"\\oiiint"===e.base.name);(m instanceof Z||k)&&(w=V(-m.italic))}if(n&&a){u=Math.max(u,i,n.depth+.25*c.xHeight),p=Math.max(p,c.sub2);var S=4*c.defaultRuleThickness;if(u-n.depth-(a.height-p)<S){p=S-(u-n.depth)+a.height;var M=.8*c.xHeight-(u-n.depth);M>0&&(u+=M,p-=M)}var z=[{type:"elem",elem:a,shift:p,marginRight:y,marginLeft:w},{type:"elem",elem:n,shift:-u,marginRight:y}];v=Ke.makeVList({positionType:"individualShift",children:z},t)}else if(a){p=Math.max(p,c.sub1,a.height-.8*c.xHeight);var A=[{type:"elem",elem:a,marginLeft:w,marginRight:y}];v=Ke.makeVList({positionType:"shift",positionData:p,children:A},t)}else{if(!n)throw new Error("supsub must have either sup or sub.");u=Math.max(u,i,n.depth+.25*c.xHeight),v=Ke.makeVList({positionType:"shift",positionData:-u,children:[{type:"elem",elem:n,marginRight:y}]},t)}var T=yt(m,"right")||"mord";return Ke.makeSpan([T],[m,Ke.makeSpan(["msupsub"],[v])],t)},mathmlBuilder:function(e,t){var r,n=!1;e.base&&"horizBrace"===e.base.type&&!!e.sup===e.base.isOver&&(n=!0,r=e.base.isOver),!e.base||"op"!==e.base.type&&"operatorname"!==e.base.type||(e.base.parentIsSupSub=!0);var a,i=[Rt(e.base,t)];if(e.sub&&i.push(Rt(e.sub,t)),e.sup&&i.push(Rt(e.sup,t)),n)a=r?"mover":"munder";else if(e.sub)if(e.sup){var o=e.base;a=o&&"op"===o.type&&o.limits&&t.style===x.DISPLAY||o&&"operatorname"===o.type&&o.alwaysHandleSupSub&&(t.style===x.DISPLAY||o.limits)?"munderover":"msubsup"}else{var s=e.base;a=s&&"op"===s.type&&s.limits&&(t.style===x.DISPLAY||s.alwaysHandleSupSub)||s&&"operatorname"===s.type&&s.alwaysHandleSupSub&&(s.limits||t.style===x.DISPLAY)?"munder":"msub"}else{var l=e.base;a=l&&"op"===l.type&&l.limits&&(t.style===x.DISPLAY||l.alwaysHandleSupSub)||l&&"operatorname"===l.type&&l.alwaysHandleSupSub&&(l.limits||t.style===x.DISPLAY)?"mover":"msup"}return new Tt.MathNode(a,i)}}),st({type:"atom",htmlBuilder:function(e,t){return Ke.mathsym(e.text,e.mode,t,["m"+e.family])},mathmlBuilder:function(e,t){var r=new Tt.MathNode("mo",[Bt(e.text,e.mode)]);if("bin"===e.family){var n=qt(e,t);"bold-italic"===n&&r.setAttribute("mathvariant",n)}else"punct"===e.family?r.setAttribute("separator","true"):"open"!==e.family&&"close"!==e.family||r.setAttribute("stretchy","false");return r}});var kn={mi:"italic",mn:"normal",mtext:"normal"};st({type:"mathord",htmlBuilder:function(e,t){return Ke.makeOrd(e,t,"mathord")},mathmlBuilder:function(e,t){var r=new Tt.MathNode("mi",[Bt(e.text,e.mode,t)]),n=qt(e,t)||"italic";return n!==kn[r.type]&&r.setAttribute("mathvariant",n),r}}),st({type:"textord",htmlBuilder:function(e,t){return Ke.makeOrd(e,t,"textord")},mathmlBuilder:function(e,t){var r,n=Bt(e.text,e.mode,t),a=qt(e,t)||"normal";return r="text"===e.mode?new Tt.MathNode("mtext",[n]):/[0-9]/.test(e.text)?new Tt.MathNode("mn",[n]):"\\prime"===e.text?new Tt.MathNode("mo",[n]):new Tt.MathNode("mi",[n]),a!==kn[r.type]&&r.setAttribute("mathvariant",a),r}});var Sn={"\\nobreak":"nobreak","\\allowbreak":"allowbreak"},Mn={" ":{},"\\ ":{},"~":{className:"nobreak"},"\\space":{},"\\nobreakspace":{className:"nobreak"}};st({type:"spacing",htmlBuilder:function(e,t){if(Mn.hasOwnProperty(e.text)){var r=Mn[e.text].className||"";if("text"===e.mode){var a=Ke.makeOrd(e,t,"textord");return a.classes.push(r),a}return Ke.makeSpan(["mspace",r],[Ke.mathsym(e.text,e.mode,t)],t)}if(Sn.hasOwnProperty(e.text))return Ke.makeSpan(["mspace",Sn[e.text]],[],t);throw new n('Unknown type of space "'+e.text+'"')},mathmlBuilder:function(e,t){if(!Mn.hasOwnProperty(e.text)){if(Sn.hasOwnProperty(e.text))return new Tt.MathNode("mspace");throw new n('Unknown type of space "'+e.text+'"')}return new Tt.MathNode("mtext",[new Tt.TextNode("\xa0")])}});var zn=function(){var e=new Tt.MathNode("mtd",[]);return e.setAttribute("width","50%"),e};st({type:"tag",mathmlBuilder:function(e,t){var r=new Tt.MathNode("mtable",[new Tt.MathNode("mtr",[zn(),new Tt.MathNode("mtd",[It(e.body,t)]),zn(),new Tt.MathNode("mtd",[It(e.tag,t)])])]);return r.setAttribute("width","100%"),r}});var An={"\\text":void 0,"\\textrm":"textrm","\\textsf":"textsf","\\texttt":"texttt","\\textnormal":"textrm"},Tn={"\\textbf":"textbf","\\textmd":"textmd"},Bn={"\\textit":"textit","\\textup":"textup"},Cn=function(e,t){var r=e.font;return r?An[r]?t.withTextFontFamily(An[r]):Tn[r]?t.withTextFontWeight(Tn[r]):t.withTextFontShape(Bn[r]):t};ot({type:"text",names:["\\text","\\textrm","\\textsf","\\texttt","\\textnormal","\\textbf","\\textmd","\\textit","\\textup"],props:{numArgs:1,argTypes:["text"],allowedInArgument:!0,allowedInText:!0},handler:function(e,t){var r=e.parser,n=e.funcName,a=t[0];return{type:"text",mode:r.mode,body:ht(a),font:n}},htmlBuilder:function(e,t){var r=Cn(e,t),n=ft(e.body,r,!0);return Ke.makeSpan(["mord","text"],n,r)},mathmlBuilder:function(e,t){var r=Cn(e,t);return It(e.body,r)}}),ot({type:"underline",names:["\\underline"],props:{numArgs:1,allowedInText:!0},handler:function(e,t){return{type:"underline",mode:e.parser.mode,body:t[0]}},htmlBuilder:function(e,t){var r=wt(e.body,t),n=Ke.makeLineSpan("underline-line",t),a=t.fontMetrics().defaultRuleThickness,i=Ke.makeVList({positionType:"top",positionData:r.height,children:[{type:"kern",size:a},{type:"elem",elem:n},{type:"kern",size:3*a},{type:"elem",elem:r}]},t);return Ke.makeSpan(["mord","underline"],[i],t)},mathmlBuilder:function(e,t){var r=new Tt.MathNode("mo",[new Tt.TextNode("\u203e")]);r.setAttribute("stretchy","true");var n=new Tt.MathNode("munder",[Rt(e.body,t),r]);return n.setAttribute("accentunder","true"),n}}),ot({type:"vcenter",names:["\\vcenter"],props:{numArgs:1,argTypes:["original"],allowedInText:!1},handler:function(e,t){return{type:"vcenter",mode:e.parser.mode,body:t[0]}},htmlBuilder:function(e,t){var r=wt(e.body,t),n=t.fontMetrics().axisHeight,a=.5*(r.height-n-(r.depth+n));return Ke.makeVList({positionType:"shift",positionData:a,children:[{type:"elem",elem:r}]},t)},mathmlBuilder:function(e,t){return new Tt.MathNode("mpadded",[Rt(e.body,t)],["vcenter"])}}),ot({type:"verb",names:["\\verb"],props:{numArgs:0,allowedInText:!0},handler:function(e,t,r){throw new n("\\verb ended by end of line instead of matching delimiter")},htmlBuilder:function(e,t){for(var r=qn(e),n=[],a=t.havingStyle(t.style.text()),i=0;i<r.length;i++){var o=r[i];"~"===o&&(o="\\textasciitilde"),n.push(Ke.makeSymbol(o,"Typewriter-Regular",e.mode,a,["mord","texttt"]))}return Ke.makeSpan(["mord","text"].concat(a.sizingClasses(t)),Ke.tryCombineChars(n),a)},mathmlBuilder:function(e,t){var r=new Tt.TextNode(qn(e)),n=new Tt.MathNode("mtext",[r]);return n.setAttribute("mathvariant","monospace"),n}});var qn=function(e){return e.body.replace(/ /g,e.star?"\u2423":"\xa0")},Nn=nt,In=new RegExp("[\u0300-\u036f]+$"),Rn=function(){function e(e,t){this.input=void 0,this.settings=void 0,this.tokenRegex=void 0,this.catcodes=void 0,this.input=e,this.settings=t,this.tokenRegex=new RegExp("([ \r\n\t]+)|\\\\(\n|[ \r\t]+\n?)[ \r\t]*|([!-\\[\\]-\u2027\u202a-\ud7ff\uf900-\uffff][\u0300-\u036f]*|[\ud800-\udbff][\udc00-\udfff][\u0300-\u036f]*|\\\\verb\\*([^]).*?\\4|\\\\verb([^*a-zA-Z]).*?\\5|(\\\\[a-zA-Z@]+)[ \r\n\t]*|\\\\[^\ud800-\udfff])","g"),this.catcodes={"%":14,"~":13}}var t=e.prototype;return t.setCatcode=function(e,t){this.catcodes[e]=t},t.lex=function(){var e=this.input,t=this.tokenRegex.lastIndex;if(t===e.length)return new Dr("EOF",new Lr(this,t,t));var r=this.tokenRegex.exec(e);if(null===r||r.index!==t)throw new n("Unexpected character: '"+e[t]+"'",new Dr(e[t],new Lr(this,t,t+1)));var a=r[6]||r[3]||(r[2]?"\\ ":" ");if(14===this.catcodes[a]){var i=e.indexOf("\n",this.tokenRegex.lastIndex);return-1===i?(this.tokenRegex.lastIndex=e.length,this.settings.reportNonstrict("commentAtEnd","% comment has no terminating newline; LaTeX would fail because of commenting the end of math mode (e.g. $)")):this.tokenRegex.lastIndex=i+1,this.lex()}return new Dr(a,new Lr(this,t,this.tokenRegex.lastIndex))},e}(),On=function(){function e(e,t){void 0===e&&(e={}),void 0===t&&(t={}),this.current=void 0,this.builtins=void 0,this.undefStack=void 0,this.current=t,this.builtins=e,this.undefStack=[]}var t=e.prototype;return t.beginGroup=function(){this.undefStack.push({})},t.endGroup=function(){if(0===this.undefStack.length)throw new n("Unbalanced namespace destruction: attempt to pop global namespace; please report this as a bug");var e=this.undefStack.pop();for(var t in e)e.hasOwnProperty(t)&&(null==e[t]?delete this.current[t]:this.current[t]=e[t])},t.endGroups=function(){for(;this.undefStack.length>0;)this.endGroup()},t.has=function(e){return this.current.hasOwnProperty(e)||this.builtins.hasOwnProperty(e)},t.get=function(e){return this.current.hasOwnProperty(e)?this.current[e]:this.builtins[e]},t.set=function(e,t,r){if(void 0===r&&(r=!1),r){for(var n=0;n<this.undefStack.length;n++)delete this.undefStack[n][e];this.undefStack.length>0&&(this.undefStack[this.undefStack.length-1][e]=t)}else{var a=this.undefStack[this.undefStack.length-1];a&&!a.hasOwnProperty(e)&&(a[e]=this.current[e])}null==t?delete this.current[e]:this.current[e]=t},e}(),Hn=Hr;Er("\\noexpand",(function(e){var t=e.popToken();return e.isExpandable(t.text)&&(t.noexpand=!0,t.treatAsRelax=!0),{tokens:[t],numArgs:0}})),Er("\\expandafter",(function(e){var t=e.popToken();return e.expandOnce(!0),{tokens:[t],numArgs:0}})),Er("\\@firstoftwo",(function(e){return{tokens:e.consumeArgs(2)[0],numArgs:0}})),Er("\\@secondoftwo",(function(e){return{tokens:e.consumeArgs(2)[1],numArgs:0}})),Er("\\@ifnextchar",(function(e){var t=e.consumeArgs(3);e.consumeSpaces();var r=e.future();return 1===t[0].length&&t[0][0].text===r.text?{tokens:t[1],numArgs:0}:{tokens:t[2],numArgs:0}})),Er("\\@ifstar","\\@ifnextchar *{\\@firstoftwo{#1}}"),Er("\\TextOrMath",(function(e){var t=e.consumeArgs(2);return"text"===e.mode?{tokens:t[0],numArgs:0}:{tokens:t[1],numArgs:0}}));var En={0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,a:10,A:10,b:11,B:11,c:12,C:12,d:13,D:13,e:14,E:14,f:15,F:15};Er("\\char",(function(e){var t,r=e.popToken(),a="";if("'"===r.text)t=8,r=e.popToken();else if('"'===r.text)t=16,r=e.popToken();else if("`"===r.text)if("\\"===(r=e.popToken()).text[0])a=r.text.charCodeAt(1);else{if("EOF"===r.text)throw new n("\\char` missing argument");a=r.text.charCodeAt(0)}else t=10;if(t){if(null==(a=En[r.text])||a>=t)throw new n("Invalid base-"+t+" digit "+r.text);for(var i;null!=(i=En[e.future().text])&&i<t;)a*=t,a+=i,e.popToken()}return"\\@char{"+a+"}"}));var Ln=function(e,t,r){var a=e.consumeArg().tokens;if(1!==a.length)throw new n("\\newcommand's first argument must be a macro name");var i=a[0].text,o=e.isDefined(i);if(o&&!t)throw new n("\\newcommand{"+i+"} attempting to redefine "+i+"; use \\renewcommand");if(!o&&!r)throw new n("\\renewcommand{"+i+"} when command "+i+" does not yet exist; use \\newcommand");var s=0;if(1===(a=e.consumeArg().tokens).length&&"["===a[0].text){for(var l="",h=e.expandNextToken();"]"!==h.text&&"EOF"!==h.text;)l+=h.text,h=e.expandNextToken();if(!l.match(/^\s*[0-9]+\s*$/))throw new n("Invalid number of arguments: "+l);s=parseInt(l),a=e.consumeArg().tokens}return e.macros.set(i,{tokens:a,numArgs:s}),""};Er("\\newcommand",(function(e){return Ln(e,!1,!0)})),Er("\\renewcommand",(function(e){return Ln(e,!0,!1)})),Er("\\providecommand",(function(e){return Ln(e,!0,!0)})),Er("\\message",(function(e){var t=e.consumeArgs(1)[0];return console.log(t.reverse().map((function(e){return e.text})).join("")),""})),Er("\\errmessage",(function(e){var t=e.consumeArgs(1)[0];return console.error(t.reverse().map((function(e){return e.text})).join("")),""})),Er("\\show",(function(e){var t=e.popToken(),r=t.text;return console.log(t,e.macros.get(r),Nn[r],ae.math[r],ae.text[r]),""})),Er("\\bgroup","{"),Er("\\egroup","}"),Er("~","\\nobreakspace"),Er("\\lq","`"),Er("\\rq","'"),Er("\\aa","\\r a"),Er("\\AA","\\r A"),Er("\\textcopyright","\\html@mathml{\\textcircled{c}}{\\char`\xa9}"),Er("\\copyright","\\TextOrMath{\\textcopyright}{\\text{\\textcopyright}}"),Er("\\textregistered","\\html@mathml{\\textcircled{\\scriptsize R}}{\\char`\xae}"),Er("\u212c","\\mathscr{B}"),Er("\u2130","\\mathscr{E}"),Er("\u2131","\\mathscr{F}"),Er("\u210b","\\mathscr{H}"),Er("\u2110","\\mathscr{I}"),Er("\u2112","\\mathscr{L}"),Er("\u2133","\\mathscr{M}"),Er("\u211b","\\mathscr{R}"),Er("\u212d","\\mathfrak{C}"),Er("\u210c","\\mathfrak{H}"),Er("\u2128","\\mathfrak{Z}"),Er("\\Bbbk","\\Bbb{k}"),Er("\xb7","\\cdotp"),Er("\\llap","\\mathllap{\\textrm{#1}}"),Er("\\rlap","\\mathrlap{\\textrm{#1}}"),Er("\\clap","\\mathclap{\\textrm{#1}}"),Er("\\mathstrut","\\vphantom{(}"),Er("\\underbar","\\underline{\\text{#1}}"),Er("\\not",'\\html@mathml{\\mathrel{\\mathrlap\\@not}}{\\char"338}'),Er("\\neq","\\html@mathml{\\mathrel{\\not=}}{\\mathrel{\\char`\u2260}}"),Er("\\ne","\\neq"),Er("\u2260","\\neq"),Er("\\notin","\\html@mathml{\\mathrel{{\\in}\\mathllap{/\\mskip1mu}}}{\\mathrel{\\char`\u2209}}"),Er("\u2209","\\notin"),Er("\u2258","\\html@mathml{\\mathrel{=\\kern{-1em}\\raisebox{0.4em}{$\\scriptsize\\frown$}}}{\\mathrel{\\char`\u2258}}"),Er("\u2259","\\html@mathml{\\stackrel{\\tiny\\wedge}{=}}{\\mathrel{\\char`\u2258}}"),Er("\u225a","\\html@mathml{\\stackrel{\\tiny\\vee}{=}}{\\mathrel{\\char`\u225a}}"),Er("\u225b","\\html@mathml{\\stackrel{\\scriptsize\\star}{=}}{\\mathrel{\\char`\u225b}}"),Er("\u225d","\\html@mathml{\\stackrel{\\tiny\\mathrm{def}}{=}}{\\mathrel{\\char`\u225d}}"),Er("\u225e","\\html@mathml{\\stackrel{\\tiny\\mathrm{m}}{=}}{\\mathrel{\\char`\u225e}}"),Er("\u225f","\\html@mathml{\\stackrel{\\tiny?}{=}}{\\mathrel{\\char`\u225f}}"),Er("\u27c2","\\perp"),Er("\u203c","\\mathclose{!\\mkern-0.8mu!}"),Er("\u220c","\\notni"),Er("\u231c","\\ulcorner"),Er("\u231d","\\urcorner"),Er("\u231e","\\llcorner"),Er("\u231f","\\lrcorner"),Er("\xa9","\\copyright"),Er("\xae","\\textregistered"),Er("\ufe0f","\\textregistered"),Er("\\ulcorner",'\\html@mathml{\\@ulcorner}{\\mathop{\\char"231c}}'),Er("\\urcorner",'\\html@mathml{\\@urcorner}{\\mathop{\\char"231d}}'),Er("\\llcorner",'\\html@mathml{\\@llcorner}{\\mathop{\\char"231e}}'),Er("\\lrcorner",'\\html@mathml{\\@lrcorner}{\\mathop{\\char"231f}}'),Er("\\vdots","\\mathord{\\varvdots\\rule{0pt}{15pt}}"),Er("\u22ee","\\vdots"),Er("\\varGamma","\\mathit{\\Gamma}"),Er("\\varDelta","\\mathit{\\Delta}"),Er("\\varTheta","\\mathit{\\Theta}"),Er("\\varLambda","\\mathit{\\Lambda}"),Er("\\varXi","\\mathit{\\Xi}"),Er("\\varPi","\\mathit{\\Pi}"),Er("\\varSigma","\\mathit{\\Sigma}"),Er("\\varUpsilon","\\mathit{\\Upsilon}"),Er("\\varPhi","\\mathit{\\Phi}"),Er("\\varPsi","\\mathit{\\Psi}"),Er("\\varOmega","\\mathit{\\Omega}"),Er("\\substack","\\begin{subarray}{c}#1\\end{subarray}"),Er("\\colon","\\nobreak\\mskip2mu\\mathpunct{}\\mathchoice{\\mkern-3mu}{\\mkern-3mu}{}{}{:}\\mskip6mu\\relax"),Er("\\boxed","\\fbox{$\\displaystyle{#1}$}"),Er("\\iff","\\DOTSB\\;\\Longleftrightarrow\\;"),Er("\\implies","\\DOTSB\\;\\Longrightarrow\\;"),Er("\\impliedby","\\DOTSB\\;\\Longleftarrow\\;");var Dn={",":"\\dotsc","\\not":"\\dotsb","+":"\\dotsb","=":"\\dotsb","<":"\\dotsb",">":"\\dotsb","-":"\\dotsb","*":"\\dotsb",":":"\\dotsb","\\DOTSB":"\\dotsb","\\coprod":"\\dotsb","\\bigvee":"\\dotsb","\\bigwedge":"\\dotsb","\\biguplus":"\\dotsb","\\bigcap":"\\dotsb","\\bigcup":"\\dotsb","\\prod":"\\dotsb","\\sum":"\\dotsb","\\bigotimes":"\\dotsb","\\bigoplus":"\\dotsb","\\bigodot":"\\dotsb","\\bigsqcup":"\\dotsb","\\And":"\\dotsb","\\longrightarrow":"\\dotsb","\\Longrightarrow":"\\dotsb","\\longleftarrow":"\\dotsb","\\Longleftarrow":"\\dotsb","\\longleftrightarrow":"\\dotsb","\\Longleftrightarrow":"\\dotsb","\\mapsto":"\\dotsb","\\longmapsto":"\\dotsb","\\hookrightarrow":"\\dotsb","\\doteq":"\\dotsb","\\mathbin":"\\dotsb","\\mathrel":"\\dotsb","\\relbar":"\\dotsb","\\Relbar":"\\dotsb","\\xrightarrow":"\\dotsb","\\xleftarrow":"\\dotsb","\\DOTSI":"\\dotsi","\\int":"\\dotsi","\\oint":"\\dotsi","\\iint":"\\dotsi","\\iiint":"\\dotsi","\\iiiint":"\\dotsi","\\idotsint":"\\dotsi","\\DOTSX":"\\dotsx"};Er("\\dots",(function(e){var t="\\dotso",r=e.expandAfterFuture().text;return r in Dn?t=Dn[r]:("\\not"===r.substr(0,4)||r in ae.math&&l.contains(["bin","rel"],ae.math[r].group))&&(t="\\dotsb"),t}));var Pn={")":!0,"]":!0,"\\rbrack":!0,"\\}":!0,"\\rbrace":!0,"\\rangle":!0,"\\rceil":!0,"\\rfloor":!0,"\\rgroup":!0,"\\rmoustache":!0,"\\right":!0,"\\bigr":!0,"\\biggr":!0,"\\Bigr":!0,"\\Biggr":!0,$:!0,";":!0,".":!0,",":!0};Er("\\dotso",(function(e){return e.future().text in Pn?"\\ldots\\,":"\\ldots"})),Er("\\dotsc",(function(e){var t=e.future().text;return t in Pn&&","!==t?"\\ldots\\,":"\\ldots"})),Er("\\cdots",(function(e){return e.future().text in Pn?"\\@cdots\\,":"\\@cdots"})),Er("\\dotsb","\\cdots"),Er("\\dotsm","\\cdots"),Er("\\dotsi","\\!\\cdots"),Er("\\dotsx","\\ldots\\,"),Er("\\DOTSI","\\relax"),Er("\\DOTSB","\\relax"),Er("\\DOTSX","\\relax"),Er("\\tmspace","\\TextOrMath{\\kern#1#3}{\\mskip#1#2}\\relax"),Er("\\,","\\tmspace+{3mu}{.1667em}"),Er("\\thinspace","\\,"),Er("\\>","\\mskip{4mu}"),Er("\\:","\\tmspace+{4mu}{.2222em}"),Er("\\medspace","\\:"),Er("\\;","\\tmspace+{5mu}{.2777em}"),Er("\\thickspace","\\;"),Er("\\!","\\tmspace-{3mu}{.1667em}"),Er("\\negthinspace","\\!"),Er("\\negmedspace","\\tmspace-{4mu}{.2222em}"),Er("\\negthickspace","\\tmspace-{5mu}{.277em}"),Er("\\enspace","\\kern.5em "),Er("\\enskip","\\hskip.5em\\relax"),Er("\\quad","\\hskip1em\\relax"),Er("\\qquad","\\hskip2em\\relax"),Er("\\tag","\\@ifstar\\tag@literal\\tag@paren"),Er("\\tag@paren","\\tag@literal{({#1})}"),Er("\\tag@literal",(function(e){if(e.macros.get("\\df@tag"))throw new n("Multiple \\tag");return"\\gdef\\df@tag{\\text{#1}}"})),Er("\\bmod","\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}\\mathbin{\\rm mod}\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}"),Er("\\pod","\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern8mu}{\\mkern8mu}{\\mkern8mu}(#1)"),Er("\\pmod","\\pod{{\\rm mod}\\mkern6mu#1}"),Er("\\mod","\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern12mu}{\\mkern12mu}{\\mkern12mu}{\\rm mod}\\,\\,#1"),Er("\\pmb","\\html@mathml{\\@binrel{#1}{\\mathrlap{#1}\\kern0.5px#1}}{\\mathbf{#1}}"),Er("\\newline","\\\\\\relax"),Er("\\TeX","\\textrm{\\html@mathml{T\\kern-.1667em\\raisebox{-.5ex}{E}\\kern-.125emX}{TeX}}");var Fn=V(T["Main-Regular"]["T".charCodeAt(0)][1]-.7*T["Main-Regular"]["A".charCodeAt(0)][1]);Er("\\LaTeX","\\textrm{\\html@mathml{L\\kern-.36em\\raisebox{"+Fn+"}{\\scriptstyle A}\\kern-.15em\\TeX}{LaTeX}}"),Er("\\KaTeX","\\textrm{\\html@mathml{K\\kern-.17em\\raisebox{"+Fn+"}{\\scriptstyle A}\\kern-.15em\\TeX}{KaTeX}}"),Er("\\hspace","\\@ifstar\\@hspacer\\@hspace"),Er("\\@hspace","\\hskip #1\\relax"),Er("\\@hspacer","\\rule{0pt}{0pt}\\hskip #1\\relax"),Er("\\ordinarycolon",":"),Er("\\vcentcolon","\\mathrel{\\mathop\\ordinarycolon}"),Er("\\dblcolon",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-.9mu}\\vcentcolon}}{\\mathop{\\char"2237}}'),Er("\\coloneqq",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}=}}{\\mathop{\\char"2254}}'),Er("\\Coloneqq",'\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}=}}{\\mathop{\\char"2237\\char"3d}}'),Er("\\coloneq",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}}{\\mathop{\\char"3a\\char"2212}}'),Er("\\Coloneq",'\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}}{\\mathop{\\char"2237\\char"2212}}'),Er("\\eqqcolon",'\\html@mathml{\\mathrel{=\\mathrel{\\mkern-1.2mu}\\vcentcolon}}{\\mathop{\\char"2255}}'),Er("\\Eqqcolon",'\\html@mathml{\\mathrel{=\\mathrel{\\mkern-1.2mu}\\dblcolon}}{\\mathop{\\char"3d\\char"2237}}'),Er("\\eqcolon",'\\html@mathml{\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\vcentcolon}}{\\mathop{\\char"2239}}'),Er("\\Eqcolon",'\\html@mathml{\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\dblcolon}}{\\mathop{\\char"2212\\char"2237}}'),Er("\\colonapprox",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\approx}}{\\mathop{\\char"3a\\char"2248}}'),Er("\\Colonapprox",'\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\approx}}{\\mathop{\\char"2237\\char"2248}}'),Er("\\colonsim",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\sim}}{\\mathop{\\char"3a\\char"223c}}'),Er("\\Colonsim",'\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\sim}}{\\mathop{\\char"2237\\char"223c}}'),Er("\u2237","\\dblcolon"),Er("\u2239","\\eqcolon"),Er("\u2254","\\coloneqq"),Er("\u2255","\\eqqcolon"),Er("\u2a74","\\Coloneqq"),Er("\\ratio","\\vcentcolon"),Er("\\coloncolon","\\dblcolon"),Er("\\colonequals","\\coloneqq"),Er("\\coloncolonequals","\\Coloneqq"),Er("\\equalscolon","\\eqqcolon"),Er("\\equalscoloncolon","\\Eqqcolon"),Er("\\colonminus","\\coloneq"),Er("\\coloncolonminus","\\Coloneq"),Er("\\minuscolon","\\eqcolon"),Er("\\minuscoloncolon","\\Eqcolon"),Er("\\coloncolonapprox","\\Colonapprox"),Er("\\coloncolonsim","\\Colonsim"),Er("\\simcolon","\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\vcentcolon}"),Er("\\simcoloncolon","\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\dblcolon}"),Er("\\approxcolon","\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\vcentcolon}"),Er("\\approxcoloncolon","\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\dblcolon}"),Er("\\notni","\\html@mathml{\\not\\ni}{\\mathrel{\\char`\u220c}}"),Er("\\limsup","\\DOTSB\\operatorname*{lim\\,sup}"),Er("\\liminf","\\DOTSB\\operatorname*{lim\\,inf}"),Er("\\injlim","\\DOTSB\\operatorname*{inj\\,lim}"),Er("\\projlim","\\DOTSB\\operatorname*{proj\\,lim}"),Er("\\varlimsup","\\DOTSB\\operatorname*{\\overline{lim}}"),Er("\\varliminf","\\DOTSB\\operatorname*{\\underline{lim}}"),Er("\\varinjlim","\\DOTSB\\operatorname*{\\underrightarrow{lim}}"),Er("\\varprojlim","\\DOTSB\\operatorname*{\\underleftarrow{lim}}"),Er("\\gvertneqq","\\html@mathml{\\@gvertneqq}{\u2269}"),Er("\\lvertneqq","\\html@mathml{\\@lvertneqq}{\u2268}"),Er("\\ngeqq","\\html@mathml{\\@ngeqq}{\u2271}"),Er("\\ngeqslant","\\html@mathml{\\@ngeqslant}{\u2271}"),Er("\\nleqq","\\html@mathml{\\@nleqq}{\u2270}"),Er("\\nleqslant","\\html@mathml{\\@nleqslant}{\u2270}"),Er("\\nshortmid","\\html@mathml{\\@nshortmid}{\u2224}"),Er("\\nshortparallel","\\html@mathml{\\@nshortparallel}{\u2226}"),Er("\\nsubseteqq","\\html@mathml{\\@nsubseteqq}{\u2288}"),Er("\\nsupseteqq","\\html@mathml{\\@nsupseteqq}{\u2289}"),Er("\\varsubsetneq","\\html@mathml{\\@varsubsetneq}{\u228a}"),Er("\\varsubsetneqq","\\html@mathml{\\@varsubsetneqq}{\u2acb}"),Er("\\varsupsetneq","\\html@mathml{\\@varsupsetneq}{\u228b}"),Er("\\varsupsetneqq","\\html@mathml{\\@varsupsetneqq}{\u2acc}"),Er("\\imath","\\html@mathml{\\@imath}{\u0131}"),Er("\\jmath","\\html@mathml{\\@jmath}{\u0237}"),Er("\\llbracket","\\html@mathml{\\mathopen{[\\mkern-3.2mu[}}{\\mathopen{\\char`\u27e6}}"),Er("\\rrbracket","\\html@mathml{\\mathclose{]\\mkern-3.2mu]}}{\\mathclose{\\char`\u27e7}}"),Er("\u27e6","\\llbracket"),Er("\u27e7","\\rrbracket"),Er("\\lBrace","\\html@mathml{\\mathopen{\\{\\mkern-3.2mu[}}{\\mathopen{\\char`\u2983}}"),Er("\\rBrace","\\html@mathml{\\mathclose{]\\mkern-3.2mu\\}}}{\\mathclose{\\char`\u2984}}"),Er("\u2983","\\lBrace"),Er("\u2984","\\rBrace"),Er("\\minuso","\\mathbin{\\html@mathml{{\\mathrlap{\\mathchoice{\\kern{0.145em}}{\\kern{0.145em}}{\\kern{0.1015em}}{\\kern{0.0725em}}\\circ}{-}}}{\\char`\u29b5}}"),Er("\u29b5","\\minuso"),Er("\\darr","\\downarrow"),Er("\\dArr","\\Downarrow"),Er("\\Darr","\\Downarrow"),Er("\\lang","\\langle"),Er("\\rang","\\rangle"),Er("\\uarr","\\uparrow"),Er("\\uArr","\\Uparrow"),Er("\\Uarr","\\Uparrow"),Er("\\N","\\mathbb{N}"),Er("\\R","\\mathbb{R}"),Er("\\Z","\\mathbb{Z}"),Er("\\alef","\\aleph"),Er("\\alefsym","\\aleph"),Er("\\Alpha","\\mathrm{A}"),Er("\\Beta","\\mathrm{B}"),Er("\\bull","\\bullet"),Er("\\Chi","\\mathrm{X}"),Er("\\clubs","\\clubsuit"),Er("\\cnums","\\mathbb{C}"),Er("\\Complex","\\mathbb{C}"),Er("\\Dagger","\\ddagger"),Er("\\diamonds","\\diamondsuit"),Er("\\empty","\\emptyset"),Er("\\Epsilon","\\mathrm{E}"),Er("\\Eta","\\mathrm{H}"),Er("\\exist","\\exists"),Er("\\harr","\\leftrightarrow"),Er("\\hArr","\\Leftrightarrow"),Er("\\Harr","\\Leftrightarrow"),Er("\\hearts","\\heartsuit"),Er("\\image","\\Im"),Er("\\infin","\\infty"),Er("\\Iota","\\mathrm{I}"),Er("\\isin","\\in"),Er("\\Kappa","\\mathrm{K}"),Er("\\larr","\\leftarrow"),Er("\\lArr","\\Leftarrow"),Er("\\Larr","\\Leftarrow"),Er("\\lrarr","\\leftrightarrow"),Er("\\lrArr","\\Leftrightarrow"),Er("\\Lrarr","\\Leftrightarrow"),Er("\\Mu","\\mathrm{M}"),Er("\\natnums","\\mathbb{N}"),Er("\\Nu","\\mathrm{N}"),Er("\\Omicron","\\mathrm{O}"),Er("\\plusmn","\\pm"),Er("\\rarr","\\rightarrow"),Er("\\rArr","\\Rightarrow"),Er("\\Rarr","\\Rightarrow"),Er("\\real","\\Re"),Er("\\reals","\\mathbb{R}"),Er("\\Reals","\\mathbb{R}"),Er("\\Rho","\\mathrm{P}"),Er("\\sdot","\\cdot"),Er("\\sect","\\S"),Er("\\spades","\\spadesuit"),Er("\\sub","\\subset"),Er("\\sube","\\subseteq"),Er("\\supe","\\supseteq"),Er("\\Tau","\\mathrm{T}"),Er("\\thetasym","\\vartheta"),Er("\\weierp","\\wp"),Er("\\Zeta","\\mathrm{Z}"),Er("\\argmin","\\DOTSB\\operatorname*{arg\\,min}"),Er("\\argmax","\\DOTSB\\operatorname*{arg\\,max}"),Er("\\plim","\\DOTSB\\mathop{\\operatorname{plim}}\\limits"),Er("\\bra","\\mathinner{\\langle{#1}|}"),Er("\\ket","\\mathinner{|{#1}\\rangle}"),Er("\\braket","\\mathinner{\\langle{#1}\\rangle}"),Er("\\Bra","\\left\\langle#1\\right|"),Er("\\Ket","\\left|#1\\right\\rangle");var Vn=function(e){return function(t){var r=t.consumeArg().tokens,n=t.consumeArg().tokens,a=t.consumeArg().tokens,i=t.consumeArg().tokens,o=t.macros.get("|"),s=t.macros.get("\\|");t.macros.beginGroup();var l=function(t){return function(r){e&&(r.macros.set("|",o),a.length&&r.macros.set("\\|",s));var i=t;!t&&a.length&&("|"===r.future().text&&(r.popToken(),i=!0));return{tokens:i?a:n,numArgs:0}}};t.macros.set("|",l(!1)),a.length&&t.macros.set("\\|",l(!0));var h=t.consumeArg().tokens,m=t.expandTokens([].concat(i,h,r));return t.macros.endGroup(),{tokens:m.reverse(),numArgs:0}}};Er("\\bra@ket",Vn(!1)),Er("\\bra@set",Vn(!0)),Er("\\Braket","\\bra@ket{\\left\\langle}{\\,\\middle\\vert\\,}{\\,\\middle\\vert\\,}{\\right\\rangle}"),Er("\\Set","\\bra@set{\\left\\{\\:}{\\;\\middle\\vert\\;}{\\;\\middle\\Vert\\;}{\\:\\right\\}}"),Er("\\set","\\bra@set{\\{\\,}{\\mid}{}{\\,\\}}"),Er("\\angln","{\\angl n}"),Er("\\blue","\\textcolor{##6495ed}{#1}"),Er("\\orange","\\textcolor{##ffa500}{#1}"),Er("\\pink","\\textcolor{##ff00af}{#1}"),Er("\\red","\\textcolor{##df0030}{#1}"),Er("\\green","\\textcolor{##28ae7b}{#1}"),Er("\\gray","\\textcolor{gray}{#1}"),Er("\\purple","\\textcolor{##9d38bd}{#1}"),Er("\\blueA","\\textcolor{##ccfaff}{#1}"),Er("\\blueB","\\textcolor{##80f6ff}{#1}"),Er("\\blueC","\\textcolor{##63d9ea}{#1}"),Er("\\blueD","\\textcolor{##11accd}{#1}"),Er("\\blueE","\\textcolor{##0c7f99}{#1}"),Er("\\tealA","\\textcolor{##94fff5}{#1}"),Er("\\tealB","\\textcolor{##26edd5}{#1}"),Er("\\tealC","\\textcolor{##01d1c1}{#1}"),Er("\\tealD","\\textcolor{##01a995}{#1}"),Er("\\tealE","\\textcolor{##208170}{#1}"),Er("\\greenA","\\textcolor{##b6ffb0}{#1}"),Er("\\greenB","\\textcolor{##8af281}{#1}"),Er("\\greenC","\\textcolor{##74cf70}{#1}"),Er("\\greenD","\\textcolor{##1fab54}{#1}"),Er("\\greenE","\\textcolor{##0d923f}{#1}"),Er("\\goldA","\\textcolor{##ffd0a9}{#1}"),Er("\\goldB","\\textcolor{##ffbb71}{#1}"),Er("\\goldC","\\textcolor{##ff9c39}{#1}"),Er("\\goldD","\\textcolor{##e07d10}{#1}"),Er("\\goldE","\\textcolor{##a75a05}{#1}"),Er("\\redA","\\textcolor{##fca9a9}{#1}"),Er("\\redB","\\textcolor{##ff8482}{#1}"),Er("\\redC","\\textcolor{##f9685d}{#1}"),Er("\\redD","\\textcolor{##e84d39}{#1}"),Er("\\redE","\\textcolor{##bc2612}{#1}"),Er("\\maroonA","\\textcolor{##ffbde0}{#1}"),Er("\\maroonB","\\textcolor{##ff92c6}{#1}"),Er("\\maroonC","\\textcolor{##ed5fa6}{#1}"),Er("\\maroonD","\\textcolor{##ca337c}{#1}"),Er("\\maroonE","\\textcolor{##9e034e}{#1}"),Er("\\purpleA","\\textcolor{##ddd7ff}{#1}"),Er("\\purpleB","\\textcolor{##c6b9fc}{#1}"),Er("\\purpleC","\\textcolor{##aa87ff}{#1}"),Er("\\purpleD","\\textcolor{##7854ab}{#1}"),Er("\\purpleE","\\textcolor{##543b78}{#1}"),Er("\\mintA","\\textcolor{##f5f9e8}{#1}"),Er("\\mintB","\\textcolor{##edf2df}{#1}"),Er("\\mintC","\\textcolor{##e0e5cc}{#1}"),Er("\\grayA","\\textcolor{##f6f7f7}{#1}"),Er("\\grayB","\\textcolor{##f0f1f2}{#1}"),Er("\\grayC","\\textcolor{##e3e5e6}{#1}"),Er("\\grayD","\\textcolor{##d6d8da}{#1}"),Er("\\grayE","\\textcolor{##babec2}{#1}"),Er("\\grayF","\\textcolor{##888d93}{#1}"),Er("\\grayG","\\textcolor{##626569}{#1}"),Er("\\grayH","\\textcolor{##3b3e40}{#1}"),Er("\\grayI","\\textcolor{##21242c}{#1}"),Er("\\kaBlue","\\textcolor{##314453}{#1}"),Er("\\kaGreen","\\textcolor{##71B307}{#1}");var Gn={"^":!0,_:!0,"\\limits":!0,"\\nolimits":!0},Un=function(){function e(e,t,r){this.settings=void 0,this.expansionCount=void 0,this.lexer=void 0,this.macros=void 0,this.stack=void 0,this.mode=void 0,this.settings=t,this.expansionCount=0,this.feed(e),this.macros=new On(Hn,t.macros),this.mode=r,this.stack=[]}var t=e.prototype;return t.feed=function(e){this.lexer=new Rn(e,this.settings)},t.switchMode=function(e){this.mode=e},t.beginGroup=function(){this.macros.beginGroup()},t.endGroup=function(){this.macros.endGroup()},t.endGroups=function(){this.macros.endGroups()},t.future=function(){return 0===this.stack.length&&this.pushToken(this.lexer.lex()),this.stack[this.stack.length-1]},t.popToken=function(){return this.future(),this.stack.pop()},t.pushToken=function(e){this.stack.push(e)},t.pushTokens=function(e){var t;(t=this.stack).push.apply(t,e)},t.scanArgument=function(e){var t,r,n;if(e){if(this.consumeSpaces(),"["!==this.future().text)return null;t=this.popToken();var a=this.consumeArg(["]"]);n=a.tokens,r=a.end}else{var i=this.consumeArg();n=i.tokens,t=i.start,r=i.end}return this.pushToken(new Dr("EOF",r.loc)),this.pushTokens(n),t.range(r,"")},t.consumeSpaces=function(){for(;;){if(" "!==this.future().text)break;this.stack.pop()}},t.consumeArg=function(e){var t=[],r=e&&e.length>0;r||this.consumeSpaces();var a,i=this.future(),o=0,s=0;do{if(a=this.popToken(),t.push(a),"{"===a.text)++o;else if("}"===a.text){if(-1===--o)throw new n("Extra }",a)}else if("EOF"===a.text)throw new n("Unexpected end of input in a macro argument, expected '"+(e&&r?e[s]:"}")+"'",a);if(e&&r)if((0===o||1===o&&"{"===e[s])&&a.text===e[s]){if(++s===e.length){t.splice(-s,s);break}}else s=0}while(0!==o||r);return"{"===i.text&&"}"===t[t.length-1].text&&(t.pop(),t.shift()),t.reverse(),{tokens:t,start:i,end:a}},t.consumeArgs=function(e,t){if(t){if(t.length!==e+1)throw new n("The length of delimiters doesn't match the number of args!");for(var r=t[0],a=0;a<r.length;a++){var i=this.popToken();if(r[a]!==i.text)throw new n("Use of the macro doesn't match its definition",i)}}for(var o=[],s=0;s<e;s++)o.push(this.consumeArg(t&&t[s+1]).tokens);return o},t.expandOnce=function(e){var t=this.popToken(),r=t.text,a=t.noexpand?null:this._getExpansion(r);if(null==a||e&&a.unexpandable){if(e&&null==a&&"\\"===r[0]&&!this.isDefined(r))throw new n("Undefined control sequence: "+r);return this.pushToken(t),t}if(this.expansionCount++,this.expansionCount>this.settings.maxExpand)throw new n("Too many expansions: infinite loop or need to increase maxExpand setting");var i=a.tokens,o=this.consumeArgs(a.numArgs,a.delimiters);if(a.numArgs)for(var s=(i=i.slice()).length-1;s>=0;--s){var l=i[s];if("#"===l.text){if(0===s)throw new n("Incomplete placeholder at end of macro body",l);if("#"===(l=i[--s]).text)i.splice(s+1,1);else{if(!/^[1-9]$/.test(l.text))throw new n("Not a valid argument number",l);var h;(h=i).splice.apply(h,[s,2].concat(o[+l.text-1]))}}}return this.pushTokens(i),i},t.expandAfterFuture=function(){return this.expandOnce(),this.future()},t.expandNextToken=function(){for(;;){var e=this.expandOnce();if(e instanceof Dr)return e.treatAsRelax&&(e.text="\\relax"),this.stack.pop()}throw new Error},t.expandMacro=function(e){return this.macros.has(e)?this.expandTokens([new Dr(e)]):void 0},t.expandTokens=function(e){var t=[],r=this.stack.length;for(this.pushTokens(e);this.stack.length>r;){var n=this.expandOnce(!0);n instanceof Dr&&(n.treatAsRelax&&(n.noexpand=!1,n.treatAsRelax=!1),t.push(this.stack.pop()))}return t},t.expandMacroAsText=function(e){var t=this.expandMacro(e);return t?t.map((function(e){return e.text})).join(""):t},t._getExpansion=function(e){var t=this.macros.get(e);if(null==t)return t;if(1===e.length){var r=this.lexer.catcodes[e];if(null!=r&&13!==r)return}var n="function"==typeof t?t(this):t;if("string"==typeof n){var a=0;if(-1!==n.indexOf("#"))for(var i=n.replace(/##/g,"");-1!==i.indexOf("#"+(a+1));)++a;for(var o=new Rn(n,this.settings),s=[],l=o.lex();"EOF"!==l.text;)s.push(l),l=o.lex();return s.reverse(),{tokens:s,numArgs:a}}return n},t.isDefined=function(e){return this.macros.has(e)||Nn.hasOwnProperty(e)||ae.math.hasOwnProperty(e)||ae.text.hasOwnProperty(e)||Gn.hasOwnProperty(e)},t.isExpandable=function(e){var t=this.macros.get(e);return null!=t?"string"==typeof t||"function"==typeof t||!t.unexpandable:Nn.hasOwnProperty(e)&&!Nn[e].primitive},e}(),Yn=/^[\u208a\u208b\u208c\u208d\u208e\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089\u2090\u2091\u2095\u1d62\u2c7c\u2096\u2097\u2098\u2099\u2092\u209a\u1d63\u209b\u209c\u1d64\u1d65\u2093\u1d66\u1d67\u1d68\u1d69\u1d6a]/,Xn=Object.freeze({"\u208a":"+","\u208b":"-","\u208c":"=","\u208d":"(","\u208e":")","\u2080":"0","\u2081":"1","\u2082":"2","\u2083":"3","\u2084":"4","\u2085":"5","\u2086":"6","\u2087":"7","\u2088":"8","\u2089":"9","\u2090":"a","\u2091":"e","\u2095":"h","\u1d62":"i","\u2c7c":"j","\u2096":"k","\u2097":"l","\u2098":"m","\u2099":"n","\u2092":"o","\u209a":"p","\u1d63":"r","\u209b":"s","\u209c":"t","\u1d64":"u","\u1d65":"v","\u2093":"x","\u1d66":"\u03b2","\u1d67":"\u03b3","\u1d68":"\u03c1","\u1d69":"\u03d5","\u1d6a":"\u03c7","\u207a":"+","\u207b":"-","\u207c":"=","\u207d":"(","\u207e":")","\u2070":"0","\xb9":"1","\xb2":"2","\xb3":"3","\u2074":"4","\u2075":"5","\u2076":"6","\u2077":"7","\u2078":"8","\u2079":"9","\u1d2c":"A","\u1d2e":"B","\u1d30":"D","\u1d31":"E","\u1d33":"G","\u1d34":"H","\u1d35":"I","\u1d36":"J","\u1d37":"K","\u1d38":"L","\u1d39":"M","\u1d3a":"N","\u1d3c":"O","\u1d3e":"P","\u1d3f":"R","\u1d40":"T","\u1d41":"U","\u2c7d":"V","\u1d42":"W","\u1d43":"a","\u1d47":"b","\u1d9c":"c","\u1d48":"d","\u1d49":"e","\u1da0":"f","\u1d4d":"g","\u02b0":"h","\u2071":"i","\u02b2":"j","\u1d4f":"k","\u02e1":"l","\u1d50":"m","\u207f":"n","\u1d52":"o","\u1d56":"p","\u02b3":"r","\u02e2":"s","\u1d57":"t","\u1d58":"u","\u1d5b":"v","\u02b7":"w","\u02e3":"x","\u02b8":"y","\u1dbb":"z","\u1d5d":"\u03b2","\u1d5e":"\u03b3","\u1d5f":"\u03b4","\u1d60":"\u03d5","\u1d61":"\u03c7","\u1dbf":"\u03b8"}),Wn={"\u0301":{text:"\\'",math:"\\acute"},"\u0300":{text:"\\`",math:"\\grave"},"\u0308":{text:'\\"',math:"\\ddot"},"\u0303":{text:"\\~",math:"\\tilde"},"\u0304":{text:"\\=",math:"\\bar"},"\u0306":{text:"\\u",math:"\\breve"},"\u030c":{text:"\\v",math:"\\check"},"\u0302":{text:"\\^",math:"\\hat"},"\u0307":{text:"\\.",math:"\\dot"},"\u030a":{text:"\\r",math:"\\mathring"},"\u030b":{text:"\\H"},"\u0327":{text:"\\c"}},_n={"\xe1":"a\u0301","\xe0":"a\u0300","\xe4":"a\u0308","\u01df":"a\u0308\u0304","\xe3":"a\u0303","\u0101":"a\u0304","\u0103":"a\u0306","\u1eaf":"a\u0306\u0301","\u1eb1":"a\u0306\u0300","\u1eb5":"a\u0306\u0303","\u01ce":"a\u030c","\xe2":"a\u0302","\u1ea5":"a\u0302\u0301","\u1ea7":"a\u0302\u0300","\u1eab":"a\u0302\u0303","\u0227":"a\u0307","\u01e1":"a\u0307\u0304","\xe5":"a\u030a","\u01fb":"a\u030a\u0301","\u1e03":"b\u0307","\u0107":"c\u0301","\u1e09":"c\u0327\u0301","\u010d":"c\u030c","\u0109":"c\u0302","\u010b":"c\u0307","\xe7":"c\u0327","\u010f":"d\u030c","\u1e0b":"d\u0307","\u1e11":"d\u0327","\xe9":"e\u0301","\xe8":"e\u0300","\xeb":"e\u0308","\u1ebd":"e\u0303","\u0113":"e\u0304","\u1e17":"e\u0304\u0301","\u1e15":"e\u0304\u0300","\u0115":"e\u0306","\u1e1d":"e\u0327\u0306","\u011b":"e\u030c","\xea":"e\u0302","\u1ebf":"e\u0302\u0301","\u1ec1":"e\u0302\u0300","\u1ec5":"e\u0302\u0303","\u0117":"e\u0307","\u0229":"e\u0327","\u1e1f":"f\u0307","\u01f5":"g\u0301","\u1e21":"g\u0304","\u011f":"g\u0306","\u01e7":"g\u030c","\u011d":"g\u0302","\u0121":"g\u0307","\u0123":"g\u0327","\u1e27":"h\u0308","\u021f":"h\u030c","\u0125":"h\u0302","\u1e23":"h\u0307","\u1e29":"h\u0327","\xed":"i\u0301","\xec":"i\u0300","\xef":"i\u0308","\u1e2f":"i\u0308\u0301","\u0129":"i\u0303","\u012b":"i\u0304","\u012d":"i\u0306","\u01d0":"i\u030c","\xee":"i\u0302","\u01f0":"j\u030c","\u0135":"j\u0302","\u1e31":"k\u0301","\u01e9":"k\u030c","\u0137":"k\u0327","\u013a":"l\u0301","\u013e":"l\u030c","\u013c":"l\u0327","\u1e3f":"m\u0301","\u1e41":"m\u0307","\u0144":"n\u0301","\u01f9":"n\u0300","\xf1":"n\u0303","\u0148":"n\u030c","\u1e45":"n\u0307","\u0146":"n\u0327","\xf3":"o\u0301","\xf2":"o\u0300","\xf6":"o\u0308","\u022b":"o\u0308\u0304","\xf5":"o\u0303","\u1e4d":"o\u0303\u0301","\u1e4f":"o\u0303\u0308","\u022d":"o\u0303\u0304","\u014d":"o\u0304","\u1e53":"o\u0304\u0301","\u1e51":"o\u0304\u0300","\u014f":"o\u0306","\u01d2":"o\u030c","\xf4":"o\u0302","\u1ed1":"o\u0302\u0301","\u1ed3":"o\u0302\u0300","\u1ed7":"o\u0302\u0303","\u022f":"o\u0307","\u0231":"o\u0307\u0304","\u0151":"o\u030b","\u1e55":"p\u0301","\u1e57":"p\u0307","\u0155":"r\u0301","\u0159":"r\u030c","\u1e59":"r\u0307","\u0157":"r\u0327","\u015b":"s\u0301","\u1e65":"s\u0301\u0307","\u0161":"s\u030c","\u1e67":"s\u030c\u0307","\u015d":"s\u0302","\u1e61":"s\u0307","\u015f":"s\u0327","\u1e97":"t\u0308","\u0165":"t\u030c","\u1e6b":"t\u0307","\u0163":"t\u0327","\xfa":"u\u0301","\xf9":"u\u0300","\xfc":"u\u0308","\u01d8":"u\u0308\u0301","\u01dc":"u\u0308\u0300","\u01d6":"u\u0308\u0304","\u01da":"u\u0308\u030c","\u0169":"u\u0303","\u1e79":"u\u0303\u0301","\u016b":"u\u0304","\u1e7b":"u\u0304\u0308","\u016d":"u\u0306","\u01d4":"u\u030c","\xfb":"u\u0302","\u016f":"u\u030a","\u0171":"u\u030b","\u1e7d":"v\u0303","\u1e83":"w\u0301","\u1e81":"w\u0300","\u1e85":"w\u0308","\u0175":"w\u0302","\u1e87":"w\u0307","\u1e98":"w\u030a","\u1e8d":"x\u0308","\u1e8b":"x\u0307","\xfd":"y\u0301","\u1ef3":"y\u0300","\xff":"y\u0308","\u1ef9":"y\u0303","\u0233":"y\u0304","\u0177":"y\u0302","\u1e8f":"y\u0307","\u1e99":"y\u030a","\u017a":"z\u0301","\u017e":"z\u030c","\u1e91":"z\u0302","\u017c":"z\u0307","\xc1":"A\u0301","\xc0":"A\u0300","\xc4":"A\u0308","\u01de":"A\u0308\u0304","\xc3":"A\u0303","\u0100":"A\u0304","\u0102":"A\u0306","\u1eae":"A\u0306\u0301","\u1eb0":"A\u0306\u0300","\u1eb4":"A\u0306\u0303","\u01cd":"A\u030c","\xc2":"A\u0302","\u1ea4":"A\u0302\u0301","\u1ea6":"A\u0302\u0300","\u1eaa":"A\u0302\u0303","\u0226":"A\u0307","\u01e0":"A\u0307\u0304","\xc5":"A\u030a","\u01fa":"A\u030a\u0301","\u1e02":"B\u0307","\u0106":"C\u0301","\u1e08":"C\u0327\u0301","\u010c":"C\u030c","\u0108":"C\u0302","\u010a":"C\u0307","\xc7":"C\u0327","\u010e":"D\u030c","\u1e0a":"D\u0307","\u1e10":"D\u0327","\xc9":"E\u0301","\xc8":"E\u0300","\xcb":"E\u0308","\u1ebc":"E\u0303","\u0112":"E\u0304","\u1e16":"E\u0304\u0301","\u1e14":"E\u0304\u0300","\u0114":"E\u0306","\u1e1c":"E\u0327\u0306","\u011a":"E\u030c","\xca":"E\u0302","\u1ebe":"E\u0302\u0301","\u1ec0":"E\u0302\u0300","\u1ec4":"E\u0302\u0303","\u0116":"E\u0307","\u0228":"E\u0327","\u1e1e":"F\u0307","\u01f4":"G\u0301","\u1e20":"G\u0304","\u011e":"G\u0306","\u01e6":"G\u030c","\u011c":"G\u0302","\u0120":"G\u0307","\u0122":"G\u0327","\u1e26":"H\u0308","\u021e":"H\u030c","\u0124":"H\u0302","\u1e22":"H\u0307","\u1e28":"H\u0327","\xcd":"I\u0301","\xcc":"I\u0300","\xcf":"I\u0308","\u1e2e":"I\u0308\u0301","\u0128":"I\u0303","\u012a":"I\u0304","\u012c":"I\u0306","\u01cf":"I\u030c","\xce":"I\u0302","\u0130":"I\u0307","\u0134":"J\u0302","\u1e30":"K\u0301","\u01e8":"K\u030c","\u0136":"K\u0327","\u0139":"L\u0301","\u013d":"L\u030c","\u013b":"L\u0327","\u1e3e":"M\u0301","\u1e40":"M\u0307","\u0143":"N\u0301","\u01f8":"N\u0300","\xd1":"N\u0303","\u0147":"N\u030c","\u1e44":"N\u0307","\u0145":"N\u0327","\xd3":"O\u0301","\xd2":"O\u0300","\xd6":"O\u0308","\u022a":"O\u0308\u0304","\xd5":"O\u0303","\u1e4c":"O\u0303\u0301","\u1e4e":"O\u0303\u0308","\u022c":"O\u0303\u0304","\u014c":"O\u0304","\u1e52":"O\u0304\u0301","\u1e50":"O\u0304\u0300","\u014e":"O\u0306","\u01d1":"O\u030c","\xd4":"O\u0302","\u1ed0":"O\u0302\u0301","\u1ed2":"O\u0302\u0300","\u1ed6":"O\u0302\u0303","\u022e":"O\u0307","\u0230":"O\u0307\u0304","\u0150":"O\u030b","\u1e54":"P\u0301","\u1e56":"P\u0307","\u0154":"R\u0301","\u0158":"R\u030c","\u1e58":"R\u0307","\u0156":"R\u0327","\u015a":"S\u0301","\u1e64":"S\u0301\u0307","\u0160":"S\u030c","\u1e66":"S\u030c\u0307","\u015c":"S\u0302","\u1e60":"S\u0307","\u015e":"S\u0327","\u0164":"T\u030c","\u1e6a":"T\u0307","\u0162":"T\u0327","\xda":"U\u0301","\xd9":"U\u0300","\xdc":"U\u0308","\u01d7":"U\u0308\u0301","\u01db":"U\u0308\u0300","\u01d5":"U\u0308\u0304","\u01d9":"U\u0308\u030c","\u0168":"U\u0303","\u1e78":"U\u0303\u0301","\u016a":"U\u0304","\u1e7a":"U\u0304\u0308","\u016c":"U\u0306","\u01d3":"U\u030c","\xdb":"U\u0302","\u016e":"U\u030a","\u0170":"U\u030b","\u1e7c":"V\u0303","\u1e82":"W\u0301","\u1e80":"W\u0300","\u1e84":"W\u0308","\u0174":"W\u0302","\u1e86":"W\u0307","\u1e8c":"X\u0308","\u1e8a":"X\u0307","\xdd":"Y\u0301","\u1ef2":"Y\u0300","\u0178":"Y\u0308","\u1ef8":"Y\u0303","\u0232":"Y\u0304","\u0176":"Y\u0302","\u1e8e":"Y\u0307","\u0179":"Z\u0301","\u017d":"Z\u030c","\u1e90":"Z\u0302","\u017b":"Z\u0307","\u03ac":"\u03b1\u0301","\u1f70":"\u03b1\u0300","\u1fb1":"\u03b1\u0304","\u1fb0":"\u03b1\u0306","\u03ad":"\u03b5\u0301","\u1f72":"\u03b5\u0300","\u03ae":"\u03b7\u0301","\u1f74":"\u03b7\u0300","\u03af":"\u03b9\u0301","\u1f76":"\u03b9\u0300","\u03ca":"\u03b9\u0308","\u0390":"\u03b9\u0308\u0301","\u1fd2":"\u03b9\u0308\u0300","\u1fd1":"\u03b9\u0304","\u1fd0":"\u03b9\u0306","\u03cc":"\u03bf\u0301","\u1f78":"\u03bf\u0300","\u03cd":"\u03c5\u0301","\u1f7a":"\u03c5\u0300","\u03cb":"\u03c5\u0308","\u03b0":"\u03c5\u0308\u0301","\u1fe2":"\u03c5\u0308\u0300","\u1fe1":"\u03c5\u0304","\u1fe0":"\u03c5\u0306","\u03ce":"\u03c9\u0301","\u1f7c":"\u03c9\u0300","\u038e":"\u03a5\u0301","\u1fea":"\u03a5\u0300","\u03ab":"\u03a5\u0308","\u1fe9":"\u03a5\u0304","\u1fe8":"\u03a5\u0306","\u038f":"\u03a9\u0301","\u1ffa":"\u03a9\u0300"},jn=function(){function e(e,t){this.mode=void 0,this.gullet=void 0,this.settings=void 0,this.leftrightDepth=void 0,this.nextToken=void 0,this.mode="math",this.gullet=new Un(e,t,this.mode),this.settings=t,this.leftrightDepth=0}var t=e.prototype;return t.expect=function(e,t){if(void 0===t&&(t=!0),this.fetch().text!==e)throw new n("Expected '"+e+"', got '"+this.fetch().text+"'",this.fetch());t&&this.consume()},t.consume=function(){this.nextToken=null},t.fetch=function(){return null==this.nextToken&&(this.nextToken=this.gullet.expandNextToken()),this.nextToken},t.switchMode=function(e){this.mode=e,this.gullet.switchMode(e)},t.parse=function(){this.settings.globalGroup||this.gullet.beginGroup(),this.settings.colorIsTextColor&&this.gullet.macros.set("\\color","\\textcolor");try{var e=this.parseExpression(!1);return this.expect("EOF"),this.settings.globalGroup||this.gullet.endGroup(),e}finally{this.gullet.endGroups()}},t.subparse=function(e){var t=this.nextToken;this.consume(),this.gullet.pushToken(new Dr("}")),this.gullet.pushTokens(e);var r=this.parseExpression(!1);return this.expect("}"),this.nextToken=t,r},t.parseExpression=function(t,r){for(var n=[];;){"math"===this.mode&&this.consumeSpaces();var a=this.fetch();if(-1!==e.endOfExpression.indexOf(a.text))break;if(r&&a.text===r)break;if(t&&Nn[a.text]&&Nn[a.text].infix)break;var i=this.parseAtom(r);if(!i)break;"internal"!==i.type&&n.push(i)}return"text"===this.mode&&this.formLigatures(n),this.handleInfixNodes(n)},t.handleInfixNodes=function(e){for(var t,r=-1,a=0;a<e.length;a++)if("infix"===e[a].type){if(-1!==r)throw new n("only one infix operator per group",e[a].token);r=a,t=e[a].replaceWith}if(-1!==r&&t){var i,o,s=e.slice(0,r),l=e.slice(r+1);return i=1===s.length&&"ordgroup"===s[0].type?s[0]:{type:"ordgroup",mode:this.mode,body:s},o=1===l.length&&"ordgroup"===l[0].type?l[0]:{type:"ordgroup",mode:this.mode,body:l},["\\\\abovefrac"===t?this.callFunction(t,[i,e[r],o],[]):this.callFunction(t,[i,o],[])]}return e},t.handleSupSubscript=function(e){var t=this.fetch(),r=t.text;this.consume(),this.consumeSpaces();var a=this.parseGroup(e);if(!a)throw new n("Expected group after '"+r+"'",t);return a},t.formatUnsupportedCmd=function(e){for(var t=[],r=0;r<e.length;r++)t.push({type:"textord",mode:"text",text:e[r]});var n={type:"text",mode:this.mode,body:t};return{type:"color",mode:this.mode,color:this.settings.errorColor,body:[n]}},t.parseAtom=function(t){var r,a,i=this.parseGroup("atom",t);if("text"===this.mode)return i;for(;;){this.consumeSpaces();var o=this.fetch();if("\\limits"===o.text||"\\nolimits"===o.text){if(i&&"op"===i.type){var s="\\limits"===o.text;i.limits=s,i.alwaysHandleSupSub=!0}else{if(!i||"operatorname"!==i.type)throw new n("Limit controls must follow a math operator",o);i.alwaysHandleSupSub&&(i.limits="\\limits"===o.text)}this.consume()}else if("^"===o.text){if(r)throw new n("Double superscript",o);r=this.handleSupSubscript("superscript")}else if("_"===o.text){if(a)throw new n("Double subscript",o);a=this.handleSupSubscript("subscript")}else if("'"===o.text){if(r)throw new n("Double superscript",o);var l={type:"textord",mode:this.mode,text:"\\prime"},h=[l];for(this.consume();"'"===this.fetch().text;)h.push(l),this.consume();"^"===this.fetch().text&&h.push(this.handleSupSubscript("superscript")),r={type:"ordgroup",mode:this.mode,body:h}}else{if(!Xn[o.text])break;var m=Xn[o.text],c=Yn.test(o.text);for(this.consume();;){var u=this.fetch().text;if(!Xn[u])break;if(Yn.test(u)!==c)break;this.consume(),m+=Xn[u]}var p=new e(m,this.settings).parse();c?a={type:"ordgroup",mode:"math",body:p}:r={type:"ordgroup",mode:"math",body:p}}}return r||a?{type:"supsub",mode:this.mode,base:i,sup:r,sub:a}:i},t.parseFunction=function(e,t){var r=this.fetch(),a=r.text,i=Nn[a];if(!i)return null;if(this.consume(),t&&"atom"!==t&&!i.allowedInArgument)throw new n("Got function '"+a+"' with no arguments"+(t?" as "+t:""),r);if("text"===this.mode&&!i.allowedInText)throw new n("Can't use function '"+a+"' in text mode",r);if("math"===this.mode&&!1===i.allowedInMath)throw new n("Can't use function '"+a+"' in math mode",r);var o=this.parseArguments(a,i),s=o.args,l=o.optArgs;return this.callFunction(a,s,l,r,e)},t.callFunction=function(e,t,r,a,i){var o={funcName:e,parser:this,token:a,breakOnTokenText:i},s=Nn[e];if(s&&s.handler)return s.handler(o,t,r);throw new n("No function handler for "+e)},t.parseArguments=function(e,t){var r=t.numArgs+t.numOptionalArgs;if(0===r)return{args:[],optArgs:[]};for(var a=[],i=[],o=0;o<r;o++){var s=t.argTypes&&t.argTypes[o],l=o<t.numOptionalArgs;(t.primitive&&null==s||"sqrt"===t.type&&1===o&&null==i[0])&&(s="primitive");var h=this.parseGroupOfType("argument to '"+e+"'",s,l);if(l)i.push(h);else{if(null==h)throw new n("Null argument, please report this as a bug");a.push(h)}}return{args:a,optArgs:i}},t.parseGroupOfType=function(e,t,r){switch(t){case"color":return this.parseColorGroup(r);case"size":return this.parseSizeGroup(r);case"url":return this.parseUrlGroup(r);case"math":case"text":return this.parseArgumentGroup(r,t);case"hbox":var a=this.parseArgumentGroup(r,"text");return null!=a?{type:"styling",mode:a.mode,body:[a],style:"text"}:null;case"raw":var i=this.parseStringGroup("raw",r);return null!=i?{type:"raw",mode:"text",string:i.text}:null;case"primitive":if(r)throw new n("A primitive argument cannot be optional");var o=this.parseGroup(e);if(null==o)throw new n("Expected group as "+e,this.fetch());return o;case"original":case null:case void 0:return this.parseArgumentGroup(r);default:throw new n("Unknown group type as "+e,this.fetch())}},t.consumeSpaces=function(){for(;" "===this.fetch().text;)this.consume()},t.parseStringGroup=function(e,t){var r=this.gullet.scanArgument(t);if(null==r)return null;for(var n,a="";"EOF"!==(n=this.fetch()).text;)a+=n.text,this.consume();return this.consume(),r.text=a,r},t.parseRegexGroup=function(e,t){for(var r,a=this.fetch(),i=a,o="";"EOF"!==(r=this.fetch()).text&&e.test(o+r.text);)o+=(i=r).text,this.consume();if(""===o)throw new n("Invalid "+t+": '"+a.text+"'",a);return a.range(i,o)},t.parseColorGroup=function(e){var t=this.parseStringGroup("color",e);if(null==t)return null;var r=/^(#[a-f0-9]{3}|#?[a-f0-9]{6}|[a-z]+)$/i.exec(t.text);if(!r)throw new n("Invalid color: '"+t.text+"'",t);var a=r[0];return/^[0-9a-f]{6}$/i.test(a)&&(a="#"+a),{type:"color-token",mode:this.mode,color:a}},t.parseSizeGroup=function(e){var t,r=!1;if(this.gullet.consumeSpaces(),!(t=e||"{"===this.gullet.future().text?this.parseStringGroup("size",e):this.parseRegexGroup(/^[-+]? *(?:$|\d+|\d+\.\d*|\.\d*) *[a-z]{0,2} *$/,"size")))return null;e||0!==t.text.length||(t.text="0pt",r=!0);var a=/([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(t.text);if(!a)throw new n("Invalid size: '"+t.text+"'",t);var i={number:+(a[1]+a[2]),unit:a[3]};if(!P(i))throw new n("Invalid unit: '"+i.unit+"'",t);return{type:"size",mode:this.mode,value:i,isBlank:r}},t.parseUrlGroup=function(e){this.gullet.lexer.setCatcode("%",13),this.gullet.lexer.setCatcode("~",12);var t=this.parseStringGroup("url",e);if(this.gullet.lexer.setCatcode("%",14),this.gullet.lexer.setCatcode("~",13),null==t)return null;var r=t.text.replace(/\\([#$%&~_^{}])/g,"$1");return{type:"url",mode:this.mode,url:r}},t.parseArgumentGroup=function(e,t){var r=this.gullet.scanArgument(e);if(null==r)return null;var n=this.mode;t&&this.switchMode(t),this.gullet.beginGroup();var a=this.parseExpression(!1,"EOF");this.expect("EOF"),this.gullet.endGroup();var i={type:"ordgroup",mode:this.mode,loc:r.loc,body:a};return t&&this.switchMode(n),i},t.parseGroup=function(e,t){var r,a=this.fetch(),i=a.text;if("{"===i||"\\begingroup"===i){this.consume();var o="{"===i?"}":"\\endgroup";this.gullet.beginGroup();var s=this.parseExpression(!1,o),l=this.fetch();this.expect(o),this.gullet.endGroup(),r={type:"ordgroup",mode:this.mode,loc:Lr.range(a,l),body:s,semisimple:"\\begingroup"===i||void 0}}else if(null==(r=this.parseFunction(t,e)||this.parseSymbol())&&"\\"===i[0]&&!Gn.hasOwnProperty(i)){if(this.settings.throwOnError)throw new n("Undefined control sequence: "+i,a);r=this.formatUnsupportedCmd(i),this.consume()}return r},t.formLigatures=function(e){for(var t=e.length-1,r=0;r<t;++r){var n=e[r],a=n.text;"-"===a&&"-"===e[r+1].text&&(r+1<t&&"-"===e[r+2].text?(e.splice(r,3,{type:"textord",mode:"text",loc:Lr.range(n,e[r+2]),text:"---"}),t-=2):(e.splice(r,2,{type:"textord",mode:"text",loc:Lr.range(n,e[r+1]),text:"--"}),t-=1)),"'"!==a&&"`"!==a||e[r+1].text!==a||(e.splice(r,2,{type:"textord",mode:"text",loc:Lr.range(n,e[r+1]),text:a+a}),t-=1)}},t.parseSymbol=function(){var e=this.fetch(),t=e.text;if(/^\\verb[^a-zA-Z]/.test(t)){this.consume();var r=t.slice(5),a="*"===r.charAt(0);if(a&&(r=r.slice(1)),r.length<2||r.charAt(0)!==r.slice(-1))throw new n("\\verb assertion failed --\n                    please report what input caused this bug");return{type:"verb",mode:"text",body:r=r.slice(1,-1),star:a}}_n.hasOwnProperty(t[0])&&!ae[this.mode][t[0]]&&(this.settings.strict&&"math"===this.mode&&this.settings.reportNonstrict("unicodeTextInMathMode",'Accented Unicode text character "'+t[0]+'" used in math mode',e),t=_n[t[0]]+t.substr(1));var i,o=In.exec(t);if(o&&("i"===(t=t.substring(0,o.index))?t="\u0131":"j"===t&&(t="\u0237")),ae[this.mode][t]){this.settings.strict&&"math"===this.mode&&Ee.indexOf(t)>=0&&this.settings.reportNonstrict("unicodeTextInMathMode",'Latin-1/Unicode text character "'+t[0]+'" used in math mode',e);var s,l=ae[this.mode][t].group,h=Lr.range(e);if(te.hasOwnProperty(l)){var m=l;s={type:"atom",mode:this.mode,family:m,loc:h,text:t}}else s={type:l,mode:this.mode,loc:h,text:t};i=s}else{if(!(t.charCodeAt(0)>=128))return null;this.settings.strict&&(S(t.charCodeAt(0))?"math"===this.mode&&this.settings.reportNonstrict("unicodeTextInMathMode",'Unicode text character "'+t[0]+'" used in math mode',e):this.settings.reportNonstrict("unknownSymbol",'Unrecognized Unicode character "'+t[0]+'" ('+t.charCodeAt(0)+")",e)),i={type:"textord",mode:"text",loc:Lr.range(e),text:t}}if(this.consume(),o)for(var c=0;c<o[0].length;c++){var u=o[0][c];if(!Wn[u])throw new n("Unknown accent ' "+u+"'",e);var p=Wn[u][this.mode]||Wn[u].text;if(!p)throw new n("Accent "+u+" unsupported in "+this.mode+" mode",e);i={type:"accent",mode:this.mode,loc:Lr.range(e),label:p,isStretchy:!1,isShifty:!0,base:i}}return i},e}();jn.endOfExpression=["}","\\endgroup","\\end","\\right","&"];var $n=function(e,t){if(!("string"==typeof e||e instanceof String))throw new TypeError("KaTeX can only parse string typed expression");var r=new jn(e,t);delete r.gullet.macros.current["\\df@tag"];var a=r.parse();if(delete r.gullet.macros.current["\\current@color"],delete r.gullet.macros.current["\\color"],r.gullet.macros.get("\\df@tag")){if(!t.displayMode)throw new n("\\tag works only in display equations");a=[{type:"tag",mode:"text",body:a,tag:r.subparse([new Dr("\\df@tag")])}]}return a},Zn=function(e,t,r){t.textContent="";var n=Jn(e,r).toNode();t.appendChild(n)};"undefined"!=typeof document&&"CSS1Compat"!==document.compatMode&&("undefined"!=typeof console&&console.warn("Warning: KaTeX doesn't work in quirks mode. Make sure your website has a suitable doctype."),Zn=function(){throw new n("KaTeX doesn't work in quirks mode.")});var Kn=function(e,t,r){if(r.throwOnError||!(e instanceof n))throw e;var a=Ke.makeSpan(["katex-error"],[new Z(t)]);return a.setAttribute("title",e.toString()),a.setAttribute("style","color:"+r.errorColor),a},Jn=function(e,t){var r=new c(t);try{var n=$n(e,r);return Lt(n,e,r)}catch(t){return Kn(t,e,r)}},Qn={version:"0.16.0",render:Zn,renderToString:function(e,t){return Jn(e,t).toMarkup()},ParseError:n,SETTINGS_SCHEMA:h,__parse:function(e,t){var r=new c(t);return $n(e,r)},__renderToDomTree:Jn,__renderToHTMLTree:function(e,t){var r=new c(t);try{return function(e,t,r){var n=St(e,Ht(r)),a=Ke.makeSpan(["katex"],[n]);return Et(a,r)}($n(e,r),0,r)}catch(t){return Kn(t,e,r)}},__setFontMetrics:function(e,t){T[e]=t},__defineSymbol:ie,__defineMacro:Er,__domTree:{Span:W,Anchor:_,SymbolNode:Z,SvgNode:K,PathNode:J,LineNode:Q}};return t=t.default}()}));

!function(){if("undefined"!=typeof Prism&&"undefined"!=typeof document){var e={javascript:"clike",actionscript:"javascript",apex:["clike","sql"],arduino:"cpp",aspnet:["markup","csharp"],birb:"clike",bison:"c",c:"clike",csharp:"clike",cpp:"c",cfscript:"clike",chaiscript:["clike","cpp"],coffeescript:"javascript",crystal:"ruby","css-extras":"css",d:"clike",dart:"clike",django:"markup-templating",ejs:["javascript","markup-templating"],etlua:["lua","markup-templating"],erb:["ruby","markup-templating"],fsharp:"clike","firestore-security-rules":"clike",flow:"javascript",ftl:"markup-templating",gml:"clike",glsl:"c",go:"clike",groovy:"clike",haml:"ruby",handlebars:"markup-templating",haxe:"clike",hlsl:"c",idris:"haskell",java:"clike",javadoc:["markup","java","javadoclike"],jolie:"clike",jsdoc:["javascript","javadoclike","typescript"],"js-extras":"javascript",json5:"json",jsonp:"json","js-templates":"javascript",kotlin:"clike",latte:["clike","markup-templating","php"],less:"css",lilypond:"scheme",liquid:"markup-templating",markdown:"markup","markup-templating":"markup",mongodb:"javascript",n4js:"javascript",objectivec:"c",opencl:"c",parser:"markup",php:"markup-templating",phpdoc:["php","javadoclike"],"php-extras":"php",plsql:"sql",processing:"clike",protobuf:"clike",pug:["markup","javascript"],purebasic:"clike",purescript:"haskell",qsharp:"clike",qml:"javascript",qore:"clike",racket:"scheme",cshtml:["markup","csharp"],jsx:["markup","javascript"],tsx:["jsx","typescript"],reason:"clike",ruby:"clike",sass:"css",scss:"css",scala:"java","shell-session":"bash",smarty:"markup-templating",solidity:"clike",soy:"markup-templating",sparql:"turtle",sqf:"clike",squirrel:"clike",stata:["mata","java","python"],"t4-cs":["t4-templating","csharp"],"t4-vb":["t4-templating","vbnet"],tap:"yaml",tt2:["clike","markup-templating"],textile:"markup",twig:"markup-templating",typescript:"javascript",v:"clike",vala:"clike",vbnet:"basic",velocity:"markup",wiki:"markup",xeora:"markup","xml-doc":"markup",xquery:"markup"},a={html:"markup",xml:"markup",svg:"markup",mathml:"markup",ssml:"markup",atom:"markup",rss:"markup",js:"javascript",g4:"antlr4",ino:"arduino","arm-asm":"armasm",art:"arturo",adoc:"asciidoc",avs:"avisynth",avdl:"avro-idl",gawk:"awk",shell:"bash",shortcode:"bbcode",rbnf:"bnf",oscript:"bsl",cs:"csharp",dotnet:"csharp",cfc:"cfscript",coffee:"coffeescript",conc:"concurnas",jinja2:"django","dns-zone":"dns-zone-file",dockerfile:"docker",gv:"dot",eta:"ejs",xlsx:"excel-formula",xls:"excel-formula",gamemakerlanguage:"gml",po:"gettext",gni:"gn",ld:"linker-script","go-mod":"go-module",hbs:"handlebars",mustache:"handlebars",hs:"haskell",idr:"idris",gitignore:"ignore",hgignore:"ignore",npmignore:"ignore",webmanifest:"json",kt:"kotlin",kts:"kotlin",kum:"kumir",tex:"latex",context:"latex",ly:"lilypond",emacs:"lisp",elisp:"lisp","emacs-lisp":"lisp",md:"markdown",moon:"moonscript",n4jsd:"n4js",nani:"naniscript",objc:"objectivec",qasm:"openqasm",objectpascal:"pascal",px:"pcaxis",pcode:"peoplecode",plantuml:"plant-uml",pq:"powerquery",mscript:"powerquery",pbfasm:"purebasic",purs:"purescript",py:"python",qs:"qsharp",rkt:"racket",razor:"cshtml",rpy:"renpy",res:"rescript",robot:"robotframework",rb:"ruby","sh-session":"shell-session",shellsession:"shell-session",smlnj:"sml",sol:"solidity",sln:"solution-file",rq:"sparql",sclang:"supercollider",t4:"t4-cs",trickle:"tremor",troy:"tremor",trig:"turtle",ts:"typescript",tsconfig:"typoscript",uscript:"unrealscript",uc:"unrealscript",url:"uri",vb:"visual-basic",vba:"visual-basic",webidl:"web-idl",mathematica:"wolfram",nb:"wolfram",wl:"wolfram",xeoracube:"xeora",yml:"yaml"},r={},s="components/",t=Prism.util.currentScript();if(t){var i=/\bplugins\/autoloader\/prism-autoloader\.(?:min\.)?js(?:\?[^\r\n/]*)?$/i,l=/(^|\/)[\w-]+\.(?:min\.)?js(?:\?[^\r\n/]*)?$/i,c=t.getAttribute("data-autoloader-path");if(null!=c)s=c.trim().replace(/\/?$/,"/");else{var n=t.src;i.test(n)?s=n.replace(i,"components/"):l.test(n)&&(s=n.replace(l,"$1components/"))}}var p=Prism.plugins.autoloader={languages_path:s,use_minified:!0,loadLanguages:m};Prism.hooks.add("complete",(function(e){var a=e.element,r=e.language;if(a&&r&&"none"!==r){var s=function(e){var a=(e.getAttribute("data-dependencies")||"").trim();if(!a){var r=e.parentElement;r&&"pre"===r.tagName.toLowerCase()&&(a=(r.getAttribute("data-dependencies")||"").trim())}return a?a.split(/\s*,\s*/g):[]}(a);/^diff-./i.test(r)?(s.push("diff"),s.push(r.substr("diff-".length))):s.push(r),s.every(o)||m(s,(function(){Prism.highlightElement(a)}))}}))}function o(e){if(e.indexOf("!")>=0)return!1;if((e=a[e]||e)in Prism.languages)return!0;var s=r[e];return s&&!s.error&&!1===s.loading}function m(s,t,i){"string"==typeof s&&(s=[s]);var l=s.length,c=0,n=!1;function k(){n||++c===l&&t&&t(s)}0!==l?s.forEach((function(s){!function(s,t,i){var l=s.indexOf("!")>=0;function c(){var e=r[s];e||(e=r[s]={callbacks:[]}),e.callbacks.push({success:t,error:i}),!l&&o(s)?u(s,"success"):!l&&e.error?u(s,"error"):!l&&e.loading||(e.loading=!0,e.error=!1,function(e,a,r){var s=document.createElement("script");s.src=e,s.async=!0,s.onload=function(){document.body.removeChild(s),a&&a()},s.onerror=function(){document.body.removeChild(s),r&&r()},document.body.appendChild(s)}(function(e){return p.languages_path+"prism-"+e+(p.use_minified?".min":"")+".js"}(s),(function(){e.loading=!1,u(s,"success")}),(function(){e.loading=!1,e.error=!0,u(s,"error")})))}s=s.replace("!","");var n=e[s=a[s]||s];n&&n.length?m(n,c,i):c()}(s,k,(function(){n||(n=!0,i&&i(s))}))})):t&&setTimeout(t,0)}function u(e,a){if(r[e]){for(var s=r[e].callbacks,t=0,i=s.length;t<i;t++){var l=s[t][a];l&&setTimeout(l,0)}s.length=0}}}();

var _self="undefined"!=typeof window?window:"undefined"!=typeof WorkerGlobalScope&&self instanceof WorkerGlobalScope?self:{},Prism=function(e){var n=/(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i,t=0,r={},a={manual:e.Prism&&e.Prism.manual,disableWorkerMessageHandler:e.Prism&&e.Prism.disableWorkerMessageHandler,util:{encode:function e(n){return n instanceof i?new i(n.type,e(n.content),n.alias):Array.isArray(n)?n.map(e):n.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/\u00a0/g," ")},type:function(e){return Object.prototype.toString.call(e).slice(8,-1)},objId:function(e){return e.__id||Object.defineProperty(e,"__id",{value:++t}),e.__id},clone:function e(n,t){var r,i;switch(t=t||{},a.util.type(n)){case"Object":if(i=a.util.objId(n),t[i])return t[i];for(var l in r={},t[i]=r,n)n.hasOwnProperty(l)&&(r[l]=e(n[l],t));return r;case"Array":return i=a.util.objId(n),t[i]?t[i]:(r=[],t[i]=r,n.forEach((function(n,a){r[a]=e(n,t)})),r);default:return n}},getLanguage:function(e){for(;e;){var t=n.exec(e.className);if(t)return t[1].toLowerCase();e=e.parentElement}return"none"},setLanguage:function(e,t){e.className=e.className.replace(RegExp(n,"gi"),""),e.classList.add("language-"+t)},currentScript:function(){if("undefined"==typeof document)return null;if("currentScript"in document)return document.currentScript;try{throw new Error}catch(r){var e=(/at [^(\r\n]*\((.*):[^:]+:[^:]+\)$/i.exec(r.stack)||[])[1];if(e){var n=document.getElementsByTagName("script");for(var t in n)if(n[t].src==e)return n[t]}return null}},isActive:function(e,n,t){for(var r="no-"+n;e;){var a=e.classList;if(a.contains(n))return!0;if(a.contains(r))return!1;e=e.parentElement}return!!t}},languages:{plain:r,plaintext:r,text:r,txt:r,extend:function(e,n){var t=a.util.clone(a.languages[e]);for(var r in n)t[r]=n[r];return t},insertBefore:function(e,n,t,r){var i=(r=r||a.languages)[e],l={};for(var o in i)if(i.hasOwnProperty(o)){if(o==n)for(var s in t)t.hasOwnProperty(s)&&(l[s]=t[s]);t.hasOwnProperty(o)||(l[o]=i[o])}var u=r[e];return r[e]=l,a.languages.DFS(a.languages,(function(n,t){t===u&&n!=e&&(this[n]=l)})),l},DFS:function e(n,t,r,i){i=i||{};var l=a.util.objId;for(var o in n)if(n.hasOwnProperty(o)){t.call(n,o,n[o],r||o);var s=n[o],u=a.util.type(s);"Object"!==u||i[l(s)]?"Array"!==u||i[l(s)]||(i[l(s)]=!0,e(s,t,o,i)):(i[l(s)]=!0,e(s,t,null,i))}}},plugins:{},highlightAll:function(e,n){a.highlightAllUnder(document,e,n)},highlightAllUnder:function(e,n,t){var r={callback:t,container:e,selector:'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'};a.hooks.run("before-highlightall",r),r.elements=Array.prototype.slice.apply(r.container.querySelectorAll(r.selector)),a.hooks.run("before-all-elements-highlight",r);for(var i,l=0;i=r.elements[l++];)a.highlightElement(i,!0===n,r.callback)},highlightElement:function(n,t,r){var i=a.util.getLanguage(n),l=a.languages[i];a.util.setLanguage(n,i);var o=n.parentElement;o&&"pre"===o.nodeName.toLowerCase()&&a.util.setLanguage(o,i);var s={element:n,language:i,grammar:l,code:n.textContent};function u(e){s.highlightedCode=e,a.hooks.run("before-insert",s),s.element.innerHTML=s.highlightedCode,a.hooks.run("after-highlight",s),a.hooks.run("complete",s),r&&r.call(s.element)}if(a.hooks.run("before-sanity-check",s),(o=s.element.parentElement)&&"pre"===o.nodeName.toLowerCase()&&!o.hasAttribute("tabindex")&&o.setAttribute("tabindex","0"),!s.code)return a.hooks.run("complete",s),void(r&&r.call(s.element));if(a.hooks.run("before-highlight",s),s.grammar)if(t&&e.Worker){var c=new Worker(a.filename);c.onmessage=function(e){u(e.data)},c.postMessage(JSON.stringify({language:s.language,code:s.code,immediateClose:!0}))}else u(a.highlight(s.code,s.grammar,s.language));else u(a.util.encode(s.code))},highlight:function(e,n,t){var r={code:e,grammar:n,language:t};if(a.hooks.run("before-tokenize",r),!r.grammar)throw new Error('The language "'+r.language+'" has no grammar.');return r.tokens=a.tokenize(r.code,r.grammar),a.hooks.run("after-tokenize",r),i.stringify(a.util.encode(r.tokens),r.language)},tokenize:function(e,n){var t=n.rest;if(t){for(var r in t)n[r]=t[r];delete n.rest}var a=new s;return u(a,a.head,e),o(e,a,n,a.head,0),function(e){for(var n=[],t=e.head.next;t!==e.tail;)n.push(t.value),t=t.next;return n}(a)},hooks:{all:{},add:function(e,n){var t=a.hooks.all;t[e]=t[e]||[],t[e].push(n)},run:function(e,n){var t=a.hooks.all[e];if(t&&t.length)for(var r,i=0;r=t[i++];)r(n)}},Token:i};function i(e,n,t,r){this.type=e,this.content=n,this.alias=t,this.length=0|(r||"").length}function l(e,n,t,r){e.lastIndex=n;var a=e.exec(t);if(a&&r&&a[1]){var i=a[1].length;a.index+=i,a[0]=a[0].slice(i)}return a}function o(e,n,t,r,s,g){for(var f in t)if(t.hasOwnProperty(f)&&t[f]){var h=t[f];h=Array.isArray(h)?h:[h];for(var d=0;d<h.length;++d){if(g&&g.cause==f+","+d)return;var v=h[d],p=v.inside,m=!!v.lookbehind,y=!!v.greedy,k=v.alias;if(y&&!v.pattern.global){var x=v.pattern.toString().match(/[imsuy]*$/)[0];v.pattern=RegExp(v.pattern.source,x+"g")}for(var b=v.pattern||v,w=r.next,A=s;w!==n.tail&&!(g&&A>=g.reach);A+=w.value.length,w=w.next){var E=w.value;if(n.length>e.length)return;if(!(E instanceof i)){var P,L=1;if(y){if(!(P=l(b,A,e,m))||P.index>=e.length)break;var S=P.index,O=P.index+P[0].length,j=A;for(j+=w.value.length;S>=j;)j+=(w=w.next).value.length;if(A=j-=w.value.length,w.value instanceof i)continue;for(var C=w;C!==n.tail&&(j<O||"string"==typeof C.value);C=C.next)L++,j+=C.value.length;L--,E=e.slice(A,j),P.index-=A}else if(!(P=l(b,0,E,m)))continue;S=P.index;var N=P[0],_=E.slice(0,S),M=E.slice(S+N.length),W=A+E.length;g&&W>g.reach&&(g.reach=W);var z=w.prev;if(_&&(z=u(n,z,_),A+=_.length),c(n,z,L),w=u(n,z,new i(f,p?a.tokenize(N,p):N,k,N)),M&&u(n,w,M),L>1){var I={cause:f+","+d,reach:W};o(e,n,t,w.prev,A,I),g&&I.reach>g.reach&&(g.reach=I.reach)}}}}}}function s(){var e={value:null,prev:null,next:null},n={value:null,prev:e,next:null};e.next=n,this.head=e,this.tail=n,this.length=0}function u(e,n,t){var r=n.next,a={value:t,prev:n,next:r};return n.next=a,r.prev=a,e.length++,a}function c(e,n,t){for(var r=n.next,a=0;a<t&&r!==e.tail;a++)r=r.next;n.next=r,r.prev=n,e.length-=a}if(e.Prism=a,i.stringify=function e(n,t){if("string"==typeof n)return n;if(Array.isArray(n)){var r="";return n.forEach((function(n){r+=e(n,t)})),r}var i={type:n.type,content:e(n.content,t),tag:"span",classes:["token",n.type],attributes:{},language:t},l=n.alias;l&&(Array.isArray(l)?Array.prototype.push.apply(i.classes,l):i.classes.push(l)),a.hooks.run("wrap",i);var o="";for(var s in i.attributes)o+=" "+s+'="'+(i.attributes[s]||"").replace(/"/g,"&quot;")+'"';return"<"+i.tag+' class="'+i.classes.join(" ")+'"'+o+">"+i.content+"</"+i.tag+">"},!e.document)return e.addEventListener?(a.disableWorkerMessageHandler||e.addEventListener("message",(function(n){var t=JSON.parse(n.data),r=t.language,i=t.code,l=t.immediateClose;e.postMessage(a.highlight(i,a.languages[r],r)),l&&e.close()}),!1),a):a;var g=a.util.currentScript();function f(){a.manual||a.highlightAll()}if(g&&(a.filename=g.src,g.hasAttribute("data-manual")&&(a.manual=!0)),!a.manual){var h=document.readyState;"loading"===h||"interactive"===h&&g&&g.defer?document.addEventListener("DOMContentLoaded",f):window.requestAnimationFrame?window.requestAnimationFrame(f):window.setTimeout(f,16)}return a}(_self);"undefined"!=typeof module&&module.exports&&(module.exports=Prism),"undefined"!=typeof global&&(global.Prism=Prism);