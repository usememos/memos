hljs.registerLanguage("solidity",(()=>{"use strict";function e(){try{return!0
}catch(e){return!1}}
var a=/-?(\b0[xX]([a-fA-F0-9]_?)*[a-fA-F0-9]|(\b[1-9](_?\d)*(\.((\d_?)*\d)?)?|\.\d(_?\d)*)([eE][-+]?\d(_?\d)*)?|\b0)(?!\w|\$)/
;e()&&(a=a.source.replace(/\\b/g,"(?<!\\$)\\b"));var s={className:"number",
begin:a,relevance:0},n={
keyword:"assembly let function if switch case default for leave break continue u256 jump jumpi stop return revert selfdestruct invalid",
built_in:"add sub mul div sdiv mod smod exp not lt gt slt sgt eq iszero and or xor byte shl shr sar addmod mulmod signextend keccak256 pc pop dup1 dup2 dup3 dup4 dup5 dup6 dup7 dup8 dup9 dup10 dup11 dup12 dup13 dup14 dup15 dup16 swap1 swap2 swap3 swap4 swap5 swap6 swap7 swap8 swap9 swap10 swap11 swap12 swap13 swap14 swap15 swap16 mload mstore mstore8 sload sstore msize gas address balance selfbalance caller callvalue calldataload calldatasize calldatacopy codesize codecopy extcodesize extcodecopy returndatasize returndatacopy extcodehash create create2 call callcode delegatecall staticcall log0 log1 log2 log3 log4 chainid origin gasprice basefee blockhash coinbase timestamp number difficulty gaslimit",
literal:"true false"},i={className:"string",
begin:/\bhex'(([0-9a-fA-F]{2}_?)*[0-9a-fA-F]{2})?'/},t={className:"string",
begin:/\bhex"(([0-9a-fA-F]{2}_?)*[0-9a-fA-F]{2})?"/};function r(e){
return e.inherit(e.APOS_STRING_MODE,{begin:/(\bunicode)?'/})}function l(e){
return e.inherit(e.QUOTE_STRING_MODE,{begin:/(\bunicode)?"/})}var o={
SOL_ASSEMBLY_KEYWORDS:n,baseAssembly:e=>{
var a=r(e),o=l(e),c=/[A-Za-z_$][A-Za-z_$0-9.]*/,d=e.inherit(e.TITLE_MODE,{
begin:/[A-Za-z$_][0-9A-Za-z$_]*/,lexemes:c,keywords:n}),u={className:"params",
begin:/\(/,end:/\)/,excludeBegin:!0,excludeEnd:!0,lexemes:c,keywords:n,
contains:[e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,a,o,s]},_={
className:"operator",begin:/:=|->/};return{keywords:n,lexemes:c,
contains:[a,o,i,t,e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,s,_,{
className:"function",lexemes:c,beginKeywords:"function",end:"{",excludeEnd:!0,
contains:[d,u,e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,_]}]}},
solAposStringMode:r,solQuoteStringMode:l,HEX_APOS_STRING_MODE:i,
HEX_QUOTE_STRING_MODE:t,SOL_NUMBER:s,isNegativeLookbehindAvailable:e}
;const{baseAssembly:c,solAposStringMode:d,solQuoteStringMode:u,HEX_APOS_STRING_MODE:_,HEX_QUOTE_STRING_MODE:m,SOL_NUMBER:b,isNegativeLookbehindAvailable:g}=o
;return e=>{for(var a=d(e),s=u(e),n=[],i=0;i<32;i++)n[i]=i+1
;var t=n.map((e=>8*e)),r=[];for(i=0;i<=80;i++)r[i]=i
;var l=n.map((e=>"bytes"+e)).join(" ")+" ",o=t.map((e=>"uint"+e)).join(" ")+" ",E=t.map((e=>"int"+e)).join(" ")+" ",M=[].concat.apply([],t.map((e=>r.map((a=>e+"x"+a))))),p={
keyword:"var bool string int uint "+E+o+"byte bytes "+l+"fixed ufixed "+M.map((e=>"fixed"+e)).join(" ")+" "+M.map((e=>"ufixed"+e)).join(" ")+" enum struct mapping address new delete if else for while continue break return throw emit try catch revert unchecked _ function modifier event constructor fallback receive error virtual override constant immutable anonymous indexed storage memory calldata external public internal payable pure view private returns import from as using global pragma contract interface library is abstract type assembly",
literal:"true false wei gwei szabo finney ether seconds minutes hours days weeks years",
built_in:"self this super selfdestruct suicide now msg block tx abi blockhash gasleft assert require Error Panic sha3 sha256 keccak256 ripemd160 ecrecover addmod mulmod log0 log1 log2 log3 log4"
},O={className:"operator",begin:/[+\-!~*\/%<>&^|=]/
},C=/[A-Za-z_$][A-Za-z_$0-9]*/,N={className:"params",begin:/\(/,end:/\)/,
excludeBegin:!0,excludeEnd:!0,lexemes:C,keywords:p,
contains:[e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,a,s,b,"self"]},f={
begin:/\.\s*/,end:/[^A-Za-z0-9$_\.]/,excludeBegin:!0,excludeEnd:!0,keywords:{
built_in:"gas value selector address length push pop send transfer call callcode delegatecall staticcall balance code codehash wrap unwrap name creationCode runtimeCode interfaceId min max"
},relevance:2},y=e.inherit(e.TITLE_MODE,{begin:/[A-Za-z$_][0-9A-Za-z$_]*/,
lexemes:C,keywords:p}),w={className:"built_in",
begin:(g()?"(?<!\\$)\\b":"\\b")+"(gas|value|salt)(?=:)"};function x(e,a){return{
begin:(g()?"(?<!\\$)\\b":"\\b")+e+"\\.\\s*",end:/[^A-Za-z0-9$_\.]/,
excludeBegin:!1,excludeEnd:!0,lexemes:C,keywords:{built_in:e+" "+a},
contains:[f],relevance:10}}var h=c(e),v=e.inherit(h,{
contains:h.contains.concat([{begin:/\./,end:/[^A-Za-z0-9$.]/,excludeBegin:!0,
excludeEnd:!0,keywords:{built_in:"slot offset length address selector"},
relevance:2},{begin:/_/,end:/[^A-Za-z0-9$.]/,excludeBegin:!0,excludeEnd:!0,
keywords:{built_in:"slot offset"},relevance:2}])});return{aliases:["sol"],
keywords:p,lexemes:C,
contains:[a,s,_,m,e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,b,w,O,{
className:"function",lexemes:C,
beginKeywords:"function modifier event constructor fallback receive error",
end:/[{;]/,excludeEnd:!0,
contains:[y,N,w,e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE],illegal:/%/
},x("msg","gas value data sender sig"),x("block","blockhash coinbase difficulty gaslimit basefee number timestamp chainid"),x("tx","gasprice origin"),x("abi","decode encode encodePacked encodeWithSelector encodeWithSignature encodeCall"),x("bytes","concat"),x("string","concat"),f,{
className:"class",lexemes:C,beginKeywords:"contract interface library",end:"{",
excludeEnd:!0,illegal:/[:"\[\]]/,contains:[{beginKeywords:"is",lexemes:C
},y,N,w,e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE]},{lexemes:C,
beginKeywords:"struct enum",end:"{",excludeEnd:!0,illegal:/[:"\[\]]/,
contains:[y,e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE]},{
beginKeywords:"import",end:";",lexemes:C,keywords:"import from as",
contains:[y,a,s,_,m,e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,O]},{
beginKeywords:"using",end:";",lexemes:C,keywords:"using for global",
contains:[y,e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,O]},{className:"meta",
beginKeywords:"pragma",end:";",lexemes:C,keywords:{
keyword:"pragma solidity experimental abicoder",
built_in:"ABIEncoderV2 SMTChecker v1 v2"},
contains:[e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,e.inherit(a,{
className:"meta-string"}),e.inherit(s,{className:"meta-string"})]},{
beginKeywords:"assembly",end:/\b\B/,
contains:[e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,e.inherit(a,{
className:"meta-string"}),e.inherit(s,{className:"meta-string"}),e.inherit(v,{
begin:"{",end:"}",endsParent:!0,contains:v.contains.concat([e.inherit(v,{
begin:"{",end:"}",contains:v.contains.concat(["self"])})])})]}],illegal:/#/}}
})());