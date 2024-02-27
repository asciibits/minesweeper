"use strict";(()=>{function d(r,e){if(!r)throw new Error(e??`Assertion failed: ${r}`);return r}var k="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",$=new Array(128);for(let r=0;r<k.length;r++)$[k.charCodeAt(r)]=r;function Y(r){let e=[],t=0,i=0;for(;;){let n=Math.min(6-i,r.pending());if(t|=r.readBatch(n)<<i,i+=n,(i===6||i>0&&n===0)&&(e.push(k[t]),t=0,i=0),!n)return e.join("")}}function q(r,e){for(let t of r)e.writeBatch($[t.charCodeAt(0)],6)}function J(r){return r=(r>>>0)-(r>>>1&1431655765),r=(r&858993459)+(r>>>2&858993459),(r+(r>>>4)&252645135)*16843009>>>24}function ce(r){return!!r[Symbol.iterator]}function W(r){return ce(r)?r:{[Symbol.iterator]:()=>r,length:r.length}}function*F(r){yield*me(r)}function*me(r){for(;!r.isClosed();)yield r.read()}var D=class{read(){throw new Error("End of stream")}readBatch(e=32){throw new Error("End of stream")}maxBatch(){return 1}readBigBits(e){throw new Error("End of stream")}count(){return 0}pending(){return 0}close(){}isClosed(){return!0}},ke=new D,b=class r{bits;_length=0;constructor(e,t){this.bits=Array.isArray(e)?e:e?[e]:[],this._length=this.bits.length*32,t!==void 0&&t!==this._length&&(this.length=t)}static fromBigint(e){let t=new r;return t.setBigBits(e,0),t}static fromReader(e,t){if(e instanceof y)return e.close(),e.bitset;t=t??-1;let i=new r,n=i.toWriter();function o(){return t<0?e.pending():t>0?Math.min(t,e.pending()):0}let s=o();for(;s;)n.writeBatch(e.readBatch(s),s),t-=s,s=o();return i}get length(){return this._length}set length(e){d(e>=0,"Length must be positive");let t=e+31>>>5;if(t>this.bits.length)for(let i=this.bits.length;i<t;i++)this.bits.push(0);else this.bits.length=t,e<this._length&&(this.bits[this.bits.length-1]&=4294967295>>>-(e&31));this._length=e}trim(){let e;for(e=this.bits.length;e>0&&!this.bits[e-1];--e);return this.bits.length=e,this._length=this.bits.length?(this.bits.length<<5)-Math.clz32(this.bits[this.bits.length-1]):0,this}getBit(e){if(d(e>=0,"Index out of range"),e>=this._length)return 0;let{bytePos:t,bitPos:i}=C(e);return this.bits[t]>>>i&1}setBit(e,t=1){d(e>=0,"Index out of range"),this._length<=e&&(this.length=e+1);let{bytePos:i,bitPos:n}=C(e),o=1<<n;t?this.bits[i]|=o:this.bits[i]&=~o}appendBit(e=1){this.setBit(this._length,e)}clearBit(e){this.setBit(e,0)}getBits(e,t){if(t=t??e+32,d(e>=0&&t>=e,"start or end out of range"),d(t-e<=32,"Too many bits requested - use getBigBits"),e>=this._length)return 0;t=Math.min(t,this._length);let i=t-e;if(i===0)return 0;let{bytePos:n,bitPos:o}=C(e);return o===0&&i===32?this.bits[n]:o+i<=32?this.bits[n]>>>o&4294967295>>>-i:(this.bits[n]>>>o|this.bits[n+1]<<-o)&4294967295>>>-i}setBits(e,t,i){i=i??t+32,d(t>=0&&i>=t,"start or end out of range"),d(i-t<=32,"setting bits limited to 32 bits"),i===void 0&&(i=t+32),i>=this._length&&(this.length=i);let n=i-t;if(n===0)return;let{bytePos:o,bitPos:s}=C(t);if(s+n<=32){let a=4294967295>>>-n<<s;this.bits[o]=this.bits[o]&~a|e<<s&a}else{this.bits[o]=this.bits[o]&4294967295>>>-s|e<<s;let a=4294967295<<s+n;this.bits[o+1]=this.bits[o+1]&a|e>>-s&~a}}appendBits(e,t){if(typeof e=="bigint"){this.appendBigBits(e,t);return}return t=t??32,d(t>=0&&t<=32,"bitCount must be between 0 and 32"),this.setBits(e,this._length,this._length+t)}getBigBits(e,t){if(t=t??Math.max(e,this._length),d(e>=0&&t>=e,"start or end out of range"),e>=this._length)return 0n;t=Math.min(t,this._length);let i=t-e;if(i===0)return 0n;let{bytePos:n,bitPos:o}=C(e);if(o+i<=32)return BigInt((this.bits[n]>>>o&4294967295>>>-i)>>>0);let s=BigInt(i),a=BigInt(this.bits[n]>>>o),l=32-o,h=n+1;for(;s>32+l;h++)a|=BigInt(this.bits[h]>>>0)<<BigInt(l),l+=32;return a|=BigInt((this.bits[h]&4294967295>>>l-i)>>>0)<<BigInt(l),a}setBigBits(e,t,i){if(d(t>=0&&(i===void 0||i>=t),"start or end out of range"),t===i)return 0;let n=t;i&&(e&=(1n<<BigInt(i-t))-1n,this.length=Math.max(this._length,i));let{bytePos:o,bitPos:s}=C(t);e<<=BigInt(s);let a=e<0;a&&(e=~e);let l=4294967295<<s>>>0;if(t+=32-s,e<=l&&(i||(i=Math.max(t-Math.clz32(Number(e)),this._length),this.length=Math.max(this._length,i)),i<=t))return l=l<<-i>>>-i,this.bits[o]=this.bits[o]&~l|Number(a?~e:e)&l,i-n;for(s=0,this.length=Math.max(this._length,t),this.bits[o]=this.bits[o]&~l|Number((a?~e:e)&BigInt(l)),e>>=32n,o++;i?i-t>32:this._length-t>32||e>4294967295;)this.length=Math.max(this._length,t+32),this.bits[o++]=Number((a?~e:e)&0xffffffffn)|0,t+=32,e>>=32n;return i||(i=Math.max(t+32-Math.clz32(Number(e)),this._length),this.length=Math.max(this._length,i)),l=4294967295>>>-i,this.bits[o]=this.bits[o]&~l|Number((a?~e:e)&BigInt(l)),i-n}appendBigBits(e,t){return this.setBigBits(e,this._length,t===void 0?t:this._length+t)}countBits(){return this.bits.reduce((e,t)=>e+J(t),0)}shift(e){if(e<0){e=-e;let t=e>>>5,i=e&31;if(i===0)for(let n=0;n<this.bits.length-t;n++)this.bits[n]=this.bits[n+t];else{let n=0;for(;n<this.bits.length-t-1;n++)this.bits[n]=this.bits[n+t]>>>i|this.bits[n+t+1]<<-i;this.bits[n]=this.bits[n+t]>>>i}this.length-=e}else if(e>0){let t=e>>>5,i=e&31;if(this.length+=e+32,i===0)for(let n=this.bits.length-1;n>=t;n--)this.bits[n]=this.bits[n-t];else{for(let n=this.bits.length-1;n>t;n--)this.bits[n]=this.bits[n-t]<<i|this.bits[n-t-1]>>>-i;this.bits[t]=this.bits[0]<<i}this.length-=32}return this}toBigInt(e=0){return this.getBigBits(e,this._length)}toReader(e,t){return new y(this,e,t)}toWriter(e,t){return new g(this,e,t)}clone(){return new r([...this.bits],this._length)}[Symbol.iterator](){return F(this.toReader())}toString(e=2){let t=this.toBigInt().toString(e);return"0".repeat(Math.max(Math.trunc(Math.log(2**this.length)/Math.log(e))-t.length,0))+t}};function C(r){return{bytePos:r>>>5,bitPos:r&31}}var L=class{constructor(e=-1){this.bitsAvailable=e}done=!1;read(){return d(!this.done,"End of stream"),this.bitsAvailable--,this.getBits(1)}readBatch(e=32){if(e===0)return 0;d(!this.done,"End of stream"),d(e>=0&&e<=32,"bitCount must be between 0 and 32 inclusive");try{return this.bitsAvailable-=e,this.getBits(e)}catch(t){throw this.bitsAvailable=0,this.done=!0,t}}readBigBits(e){d(!this.done,"End of stream"),e=e??-1;try{let t=0n,i=0,n=this.pending();for(;e<0?n>0:e>i;){d(n>0,"End of stream");let o=e<0?n:Math.min(e-i,n);t|=BigInt(this.getBits(o)>>>0)<<BigInt(i),i+=o,this.bitsAvailable-=o,n=this.pending()}return t}catch(t){throw this.bitsAvailable=0,this.done=!0,t}}maxBatch(){return 32}count(){return this.done?0:this.bitsAvailable<0?-1:this.bitsAvailable}pending(){return this.done?0:1}close(){this.done=!0}isClosed(){return this.done}asBigBitReader(){return{read:()=>this.read(),readBatch:e=>this.readBigBits(e),maxBatch:()=>4294967295,count:()=>this.count(),pending:()=>this.pending(),close:()=>this.close(),isClosed:()=>this.isClosed(),asBitReader:()=>this}}},y=class extends L{constructor(t,i=0,n){super();this.bitset=t;this.end=n;d(i>=0,"start must be non-negative"),d(n===void 0||n>=i,"end must be greater than start"),this.pos=i}pos;isClosed(){return this.done||this.pos>=(this.end??this.bitset.length)}getBits(t){d(this.pos+t<=(this.end??this.bitset.length),"No data available");let i=this.pos;return this.pos+=t,this.bitset.getBits(i,this.pos)}count(){return this.done?0:(this.end??this.bitset.length)-this.pos}pending(){let t=this.count(),i=32-(this.pos&31);return t>=0&&t<=i?t:i}},g=class{constructor(e=new b,t=e.length,i){this.end=i;d(t>=0,"start must be non-negative"),d(i===void 0||i>=t,"end must be greater than start"),this.bitset=e??new b,this.pos=t}bitset;pos;closed=!1;isClosed(){return this.closed||!!this.end&&this.pos>=this.end}write(e){return this.assertBitCount(1),this.bitset.setBit(this.pos,e),this.pos++,this}writeBatch(e,t){return t=t??32,this.assertBitCount(t),this.bitset.setBits(e,this.pos,this.pos+t),this.pos+=t,this}writeBigBits(e,t){return this.end!==void 0&&t===void 0&&(t=this.end-this.pos),this.assertBitCount(t??0),t===void 0?t=this.bitset.setBigBits(e,this.pos):this.bitset.setBigBits(e,this.pos,this.pos+t),this.pos+=t,this}close(){this.closed=!0}assertBitCount(e){d(!this.closed,"Stream is closed"),d(!this.end||this.pos+e<=this.end,"End of stream")}asBigBitWriter(){let e={write:t=>(this.write(t),e),writeBatch:(t,i)=>(this.writeBigBits(t,i),e),isClosed:()=>this.isClosed(),close:()=>this.close(),asBitWriter:()=>this};return e}};var fe=2;function be(r,e,...t){if(r<=fe){let i;switch(r){case 3:i=console.info;break;case 2:i=console.warn;break;case 1:i=console.error;break;default:i=console.log;break}i(e,...t.map(n=>typeof n=="function"?n():n))}}function c(r,...e){be(5,r,...e)}var R=class{static encoder(e){return new G(e)}static decoder(e,t){return new P(e,t)}};function ge(r,e,t,i=!0){r=Array.isArray(r)?r:[r];let n=R.encoder(t);for(let o of r)e.encodeValue(o,n);n.close(i)}function ee(r,e,t){let i=t?t.bitset:new b,n=t??i.toWriter();return ge(r,e,n,!!t),i}function te(r,e,t=!0){let i=R.decoder(r,t),n=e.decodeValue(i);return i.close(),n}var x=class{constructor(e,t){this.n=e;this.z=t;d(e>=0),d(t>=0&&t<=e),d(Math.trunc(e)===e&&Math.trunc(t)===t,"n and z must be integers")}encode(e,t){let i=this.n,n=this.z;for(let o of F(e)){if(t.encodeBit(n/i,o),!--i)return;o||--n}}decode(e,t){let i=this.n,n=this.z;for(;i;--i){let o=e.decodeBit(n/i);t.write(o),o||--n}}},I=class{constructor(e,t=0){this.min=t;d(e>t),this.max=e-t-1>>>0,this.mask=e?1<<31-Math.clz32(this.max):0}max;mask;encodeValue(e,t){let i=this.mask,n=!1;for(e-=this.min,d(e>=0&&e<=this.max);i;){let o=n?.5:i/(i+(this.max&i?(this.max&i-1)+1:0)),s=e&i?1:0;t.encodeBit(o,s),n||=!s&&!!(this.max&i),i>>>=1}}decodeValue(e){let t=this.mask,i=!1,n=0;for(;t;){let o=i?.5:t/(t+(this.max&t?(this.max&t-1)+1:0)),s=e.decodeBit(o);n|=s*t,i||=!s&&!!(this.max&t),t>>>=1}return n+this.min}},B=class{constructor(e,t=.5){this.payloadBits=e;this.p=1-t}p;encode(e,t){if(this.payloadBits){for(let i=0;i<this.payloadBits;++i)t.encodeBit(.5,e.isClosed()?0:e.read());if(e.isClosed()){t.encodeBit(.5,0);return}t.encodeBit(.5,1)}for(;;){let i=e.isClosed()?0:e.read();if(e.isClosed()){t.encodeBit(this.p,0);return}t.encodeBit(this.p,1),t.encodeBit(.5,i)}}encodeValue(e,t){this.encode(new g().writeBatch(e).bitset.trim().toReader(),t)}encodeBigInt(e,t){this.encode(new g().writeBigBits(e).bitset.trim().toReader(),t)}decode(e,t){if(this.payloadBits){for(let n=0;n<this.payloadBits;++n)t.write(e.decodeBit(.5));if(!e.decodeBit(.5))return}for(;;){if(!e.decodeBit(this.p)){t.write(1);return}t.write(e.decodeBit(.5))}}decodeValue(e){let t=new b;return this.decode(e,t.toWriter()),d(t.trim().length<=32,"Value too large for a number. Use decodeBigInt"),t.getBits(0)}decodeBigInt(e){let t=new b;return this.decode(e,t.toWriter()),t.toBigInt()}asBigintCoder(){return{encode:(e,t)=>{this.encode(e,t)},decode:(e,t)=>{this.decode(e,t)},encodeValue:(e,t)=>this.encodeBigInt(e,t),decodeValue:e=>this.decodeBigInt(e)}}};var P=class{constructor(e,t=!1){this.input=e;this.padStream=t}closed=!1;high=2;low=1;value=1;valueRange=1;decodeBit(e){for(d(!this.closed,"Stream closed");this.high-this.low<=.25;){let n;this.high<=1.5?(this.high=(this.high-.5)*2,this.value=(this.value-.5)*2,this.low=(this.low-.5)*2,n="low"):this.low>=1.5?(this.high=(this.high-1)*2,this.value=(this.value-1)*2,this.low=(this.low-1)*2,n="high"):(this.high=(this.high-.75)*2,this.value=(this.value-.75)*2,this.low=(this.low-.75)*2,n="mid"),this.valueRange*=2,c("[Arithmetic.decode] zooming %o",()=>({zoom:n,low:this.low,high:this.high,value:this.value,valueRange:this.valueRange}))}let t=ie(this.low,this.high,e,"decode"),i=()=>({low:this.low,mid:t,high:this.high,value:this.value,valueRange:this.valueRange,p:e});for(c("[Arithmetic.decode] working on: %o",i);;){if(this.value>=t)return c("[Arithmetic.decode] emitting 1 bit. Data: %o",i),this.low=t,1;if(this.value+this.valueRange<=t)return c("[Arithmetic.decode] emitting 0 bit. Data: %o",i),this.high=t,0;{!this.padStream&&this.input.isClosed()&&(this.closed=!0,d(!1,"No more bits in the stream"));let n=this.padStream&&this.input.isClosed()?0:this.input.read();this.valueRange/=2,this.value+=n*this.valueRange,c("[Arithmetic.decode] Reading more. Data: %o",()=>({bit:n,...i()}))}}}close(){this.closed=!0}isClosed(){return this.closed}},G=class r{constructor(e,t){this.output=e;t&&(this.closed=t.closed,this.high=t.high,this.low=t.low,this.pendingBits=t.pendingBits,this.trailingZeros=t.trailingZeros)}closed=!1;high=2;low=1;pendingBits=0;trailingZeros=0;encodeBit(e,t){for(d(!this.closed,"Stream closed");this.high-this.low<=.25;)this.high<=1.5?this.zoomLow("encode"):this.low>=1.5?this.zoomHigh("encode"):this.zoomMid("encode");let i=ie(this.low,this.high,e,"encode");c("[Arithmetic.encode] working on: %o",()=>({low:this.low,mid:i,high:this.high,p:e,b:t})),t?(d(i<this.high,"[Arithmetic.encode] Invalid p == 1 with b === 1"),this.low=i):(d(i>this.low,"[Arithmetic.encode] Invalid p == 0 with b === 0"),this.high=i)}close(e=!1){if(!this.closed)if(this.closed=!0,e){for(;this.high<2||this.low>1;)this.low>1&&this.high>=1.75?this.zoomHigh("terminating"):this.high<2&&this.low<=1.25?this.zoomLow("terminating"):this.zoomMid("terminating");for(this.pendingBits&&(this.writeBit(1),c("[Arithmetic.close] Terminating pending: 1"));this.trailingZeros;--this.trailingZeros)this.output.write(0)}else for(;this.low>1||this.pendingBits;)this.high>1.5?this.zoomHigh("closing"):this.zoomLow("closing")}isClosed(){return this.closed}clone(e){return new r(e,{closed:this.closed,high:this.high,low:this.low,pendingBits:this.pendingBits,trailingZeros:this.trailingZeros})}zoomHigh(e){this.writeBit(1),this.high=(this.high-1)*2,this.low=(this.low-1)*2,c("[Arithmetic.zoom] %s %o",e,()=>({zoom:"high",low:this.low,high:this.high}))}zoomLow(e){this.writeBit(0),this.high=(this.high-.5)*2,this.low=(this.low-.5)*2,c("[Arithmetic.zoom] %s %o",e,()=>({zoom:"low",low:this.low,high:this.high}))}zoomMid(e){this.pendingBits++,this.high=(this.high-.75)*2,this.low=(this.low-.75)*2,c("[Arithmetic.zoom] %s %o",e,()=>({zoom:"mid",low:this.low,high:this.high}))}writeBit(e){if(e){for(;this.trailingZeros;--this.trailingZeros)this.output.write(0);this.output.write(1),this.trailingZeros=this.pendingBits,this.pendingBits=0}else{if(this.pendingBits){for(;this.trailingZeros>=0;--this.trailingZeros)this.output.write(0);for(;this.pendingBits;--this.pendingBits)this.output.write(1)}++this.trailingZeros}}};function ie(r,e,t,i){let n=r+t*(e-r);if(n>=e||isNaN(n)){if(n===e)return t<1?e-Number.EPSILON:e;throw new Error(`[Arithmetic.${i}] Invalid probablility from model: ${t}`)}if(n<=r||isNaN(n)){if(n===r)return t>0?r+Number.EPSILON:r;throw new Error(`[Arithmetic.${i}] Invalid probablility from model: ${t}`)}return n}function re(r){let e=ne(r),t=ne(r.map(i=>[i[1],i[0]]));return{encode:e,decode:t}}function ne(r){let e=[void 0,void 0];for(let i of r){let[n,o]=i,s=e;for(let l=0;l<n.bitCount-1;l++){let h=n.value>>>l&1,u=s[h];if(!u)s[h]=u=[void 0,void 0];else if(!Array.isArray(u))throw new Error(`Found conflicting encode values. 0b${H({value:n.value&(1<<l)-1,bitCount:l})} is a prefix for 0b${H(n)}.`);s=u}let a=n.value>>>n.bitCount-1&1;if(s[a])throw new Error(`Found conflicting encode values. 0b${H(n)} is a prefix for another value.`);s[a]=o}function t(i,n=""){for(let o of[0,1]){let s=i[o];if(s)Array.isArray(s)&&t(s,n+o);else throw new Error(`Incomplete tree. No code for prefix: ${n}${o}.`)}}return t(e),e}function H(r){function e(t,i){return"0".repeat(Math.max(i-t.length,0))+t}return e(r.value.toString(2),r.bitCount)}var oe={encode:r=>r<0?~r<<1|1:r<<1,decode:r=>r&1?~(r>>>1):r>>>1},v=class r{constructor(e,t=0){this.base=e;this.min=t;d(t<=e)}static encode(e,t,i){return new r(t,i).encode(e)}static decode(e,t,i){return new r(t,i).decode(e)}encode(e){return d(e>=this.min),e>=2*(this.base-this.min)+this.min?e-this.min:oe.encode(e-this.base)}decode(e){return d(e>=0),e<2*(this.base-this.min)?oe.decode(e)+this.base:e+this.min}};function pe(r,e){if(d(e<=r&&r>=0&&e>=0),r-e<e&&(e=r-e),e===0)return 1n;let t=BigInt(r);for(let i=t-1n,n=2n;n<=e;i--,n++)t*=i,t/=n;return t}function se(r,e){d(r>=0,"val must be positive"),d(e>0,"n must be positive");let t=0n,i=1n,n=0n,o=0n;for(let s=0;s<e;s++,r>>=1n)r&1n?(t-=i,i*=++n,i/=++o,t+=i):(i*=++n,i/=n-o);return d(r===0n,"val out of range"),t}function ae(r,e,t){let i=pe(e,t);d(r>=0n&&r<i,"BoardNumber out of range");let n=BigInt(e),o=BigInt(t),s=0n;for(let a=0;a<e;a++){s<<=1n;let l=i*(n-o)/n;r<l?i=l:(s|=1n,r-=i,i*=o--,i/=n,r+=i),n--}return s}var _=class{nextIntegers=new Uint32Array(16);nextIndex=16;next(){return this.nextIndex>=this.nextIntegers.length&&(crypto.getRandomValues(this.nextIntegers),this.nextIndex=0),this.nextIntegers[this.nextIndex++]}},A=class{constructor(e=new _){this.bitSource=e}workingBits=0;availableBits=0;getRandomBits(e){if(d(e>=0&&e<=32,"Random bits must be between 0 and 32"),e===32)return this.bitSource.next()>>>0;let t=0;return this.availableBits<e&&(t=this.workingBits<<e-this.availableBits,e-=this.availableBits,this.workingBits=this.bitSource.next()>>>0,this.availableBits=32),t|=this.workingBits>>>this.availableBits-e,this.availableBits-=e,this.workingBits&=(1<<this.availableBits)-1,t}getRandomInteger(e,t=0){d(t<=e,"Min must be <= max"),e-=t;let i=le(e),n;do n=this.getRandomBits(i);while(n>=e);return n+t}getRandomBigBits(e){d(e>=0,"BitLength must be positive");let t=0n;for(;e>32;)t=t<<32n|BigInt(this.getRandomBits(32)),e-=32n;return t=t<<BigInt(e)|BigInt(this.getRandomBits(Number(e))),t}getRandomBigInteger(e,t=0n){d(t<=e,"Min must be >= 0 and <= max"),e-=t;let i=le(e),n;do n=this.getRandomBigBits(i);while(n>=e);return n+t}getRandomDouble(){let e=new ArrayBuffer(8),t=new Uint32Array(e);return t[0]=this.getRandomBits(32),t[1]=this.getRandomBits(20)|1072693248,new Float64Array(e)[0]-1}};function de(r,e=r.length,t=Ce){for(let i=0;i<e;i++){let n=t.getRandomInteger(r.length,i);if(i!=n){let o=r[i];r[i]=r[n],r[n]=o}}return r.length=e,r}function le(r){return typeof r=="number"?32-Math.clz32(r-1):BigInt((r-1n).toString(2).length)}var z=class{random;constructor(e){e=(e??Date.now())&4294967295,console.log("Using Test seed: %d",e),this.random=Be(e)}next(){return Math.trunc(this.random()*4294967295)}};function Be(r){r^=3735928559;let e=we(2654435769,608135816,3084996962,r);for(let t=0;t<15;t++)e();return e}function we(r,e,t,i){return function(){r|=0,e|=0,t|=0,i|=0;let n=(r+e|0)+i|0;return i=i+1|0,r=e^e>>>9,e=t+(t<<3)|0,t=t<<21|t>>>11,t=t+n|0,(n>>>0)/4294967296}}function ve(){if(typeof jasmine>"u")return;let r=jasmine?.getEnv()?.configuration()?.seed;if(r)return typeof r=="string"&&(r=Number(r)),isNaN(r)?void 0:r}var Ce=new A,dt=new A(new z(ve()));function he(r,e,t){return typeof r=="number"?r:(d(r.x>=0&&r.x<e&&r.y>=0&&r.y<t,"position outside grid"),r.y*e+r.x)}var E=class r{constructor(e,t,i){this.width=e;this.height=t;d(e>0&&t>0,"Width and height must be positive values"),d(i.length<=e*t,"Mine count must be <= cell count"),this.mineCount=i.length,this.initBoard(i)}mineCount;board=[];_boardNumber;static createRandomMineField(e,t,i,n,o){let s=e*t,a=new Set;for(let h of n?.map(u=>he(u,e,t))??[])d(!a.has(h),"reserved cell already added"),a.add(h);d(i<=s-a.size,"Not enough room for the requested number of mines");let l=de(Array.from({length:s},(h,u)=>u).filter(h=>!a.has(h)),i,o);return new r(e,t,l)}static createRandomMineFieldWithOpening(e,t,i,n,o=2,s){let{x:a,y:l}=n??{x:0,y:0},h=[];switch(o){case 0:h.push({x:a,y:l});break;case 1:for(let u=Math.max(a-1,0);u<Math.min(a+2,e);u++)for(let m=Math.max(l-1,0);m<Math.min(l+2,t);m++)h.push({x:u,y:m});break;case 2:}return this.createRandomMineField(e,t,i,h,s)}static createMineFieldWithBoardNumber(e,t,i,n){let o=e*t,s=[],a=ae(n,o,i);for(let l=o-1;l>=0;l--,a>>=1n)a&1n&&s.push(l);return new r(e,t,s)}static createMineFieldWithMineMap(e,t,i){let n=[];for(let o=0;o<i.length;o++)i[o]&&n.push(o);return new r(e,t,n)}initBoard(e){let t=this.width,i=this.height;this.board.length=t*i,this.board.fill(0);let n=o=>{let s=typeof o=="number"?Math.trunc(o/t):o.y,a=typeof o=="number"?o-s*t:o.x;if(d(s>=0&&s<i&&a>=0&&a<t,"Mine position is outside the grid"),this.board[a+s*t]<0)throw new Error(`Same cell marked as mine more than once: {X: ${a}, y: ${s}}`);this.board[a+s*t]=-2;for(let l=Math.max(a-1,0);l<Math.min(a+2,t);l++)for(let h=Math.max(s-1,0);h<Math.min(s+2,i);h++)this.board[l+h*t]!==-2&&this.board[l+h*t]++};for(let o of e)n(o)}getBoardNumber(){if(this._boardNumber===void 0){let e=0n;for(let t=0;t<this.height;t++)for(let i=0;i<this.width;i++)e<<=1n,this.board[i+t*this.width]<0&&(e|=1n);this._boardNumber=se(e,this.width*this.height)}return this._boardNumber}getCellValue(e,t){return this.board[e+t*this.width]}getValueMap(){return this.board}clearTransientState(){return this._boardNumber=void 0,this}toString(){let e=this.board;return e?Array.from({length:this.height}).map((t,i)=>Array.from({length:this.width}).map((n,o)=>e[o+i*this.width]).map(n=>n===-2?"X":String(n)).join("")).join(`
`):"Uninitialized"}};var S=class{cells=[];listeners=[];cellListener;openMines=0;minesRemaining=0;cellsRemaining=0;boardStarted=0;boardEnded=0;started=!1;view;clockEventInterval=0;timerId;constructor(e){this.cellListener=this.getCellListener(),this.reset(e),this.view=e}getCellVisibleState(e,t){return this.cells[e+t*this.view.width]?.getVisibleState()??-1}getCellListener(){return(e,t)=>{switch(t.type){case 0:if(e.isMine()){let i=this.openMines===0;this.openMines++,i&&(this.stopClock(),this.fireEvent(4,t.attributes))}else this.cellsRemaining--,this.started||(this.started=!0,this.startClock(),this.fireEvent(3,t.attributes)),this.cellsRemaining||(this.stopClock(),this.fireEvent(6,t.attributes));break;case 2:e.isFlagged()?this.minesRemaining--:this.minesRemaining++,this.fireEvent(8,t.attributes);break;case 1:e.isMine()?(this.openMines--,this.openMines||(this.startClock(),this.fireEvent(5,t.attributes))):this.cellsRemaining++||(this.startClock(),this.fireEvent(7,t.attributes));break}}}expandZeroGroup(e){let t=new Set,i=new Set;function n(){for(let o of i)return i.delete(o),o;throw new Error("Empty")}for(let o of W(e))i.add(o);for(;i.size;){let o=n(),{x:s,y:a}=o.position;if(t.add(o),this.view.getCellValue(s,a)===0)for(let h of o.getNeighbors())t.has(h)||i.add(h)}return t}getCell(e,t){return typeof e=="number"?t===void 0?(d(e>=0&&e<this.cells.length,"Index out of bounds"),this.cells[e]):(d(e>=0&&e<this.view.width&&t>=0&&t<this.view.height,"position outside grid"),this.cells[e+t*this.view.width]):this.cells[he(e,this.view.width,this.view.height)]}getAllCells(){return this.cells}getVisibleStateMap(){return this.cells.map(e=>e.getVisibleState())}isExploded(){return this.openMines>0}isComplete(){return this.started&&this.cellsRemaining<=0}getMinesRemaining(){return this.minesRemaining}getCellsRemaining(){return this.cellsRemaining}getTimeElapsed(){return this.boardStarted===0?0:this.boardEnded===0?Date.now()-this.boardStarted:this.boardEnded-this.boardStarted}setTimeElapsed(e,t){this.boardStarted=(this.boardEnded||Date.now())-e,this.startClock(t)}setClockEventInterval(e,t){this.clockEventInterval=e,e>0?this.startClock(t):this.stopClock(t)}startClock(e){this.timerId===void 0&&this.started&&this.boardEnded===0&&this.clockEventInterval>0&&(this.boardStarted=Date.now(),this.fireEvent(10,e),this.timerId=setInterval(()=>{this.fireEvent(10,e)},this.clockEventInterval))}stopClock(e){this.boardStarted!==0&&this.boardEnded===0&&(this.boardEnded=Date.now(),this.fireEvent(10,e)),this.timerId!==void 0&&(clearInterval(this.timerId),this.timerId=void 0)}reset(e,t){this.view=e;for(let o of this.getAllCells())o.dispose(t);let{width:i,height:n}=e;this.cells.length=i*n;for(let o=0;o<i;o++)for(let s=0;s<n;s++)(this.cells[o+s*i]=new Z({x:o,y:s},this)).addListener(this.cellListener);this.initializeStats(),this.fireEvent(1,t)}getView(){return this.view}initializeStats(){this.openMines=0;let{width:e,height:t,mineCount:i}=this.getView();this.minesRemaining=i,this.cellsRemaining=e*t-i,this.boardStarted=0,this.boardEnded=0,this.stopClock(),this.started=!1}dispose(e){for(let t of this.cells)t.dispose();this.fireEvent(0,e),this.listeners.length=0,this.cells.length=0}openGroup(e,t){for(let i of W(e))i.isOpened()||i.openNoExpand();this.fireEvent(9,t)}addListener(e){this.listeners.push(e)}fireEvent(e,t){for(let i of this.listeners)i(this,{type:e,attributes:t})}};var Z=class{constructor(e,t){this.position=e;this.board=t}flagged=!1;value;opened=!1;pressed=!1;wrong=!1;listeners=[];attributes=new Map;neighbors=[];getVisibleState(){return this.opened?this.peek():this.flagged?-3:-1}isFlagged(){return this.flagged}isMine(){return this.peek()===-2}isOpened(){return this.opened}isPressed(){return this.pressed}isWrong(){return this.wrong}openNoExpand(e){return this.opened||(this.flag(!1),this.opened=!0,this.fireEvent(0,e)),this.peek()}open(e){this.board.openGroup(this.board.expandZeroGroup([this]),e)}peek(){return this.value===void 0&&(this.value=this.board.getView().getCellValue(this.position.x,this.position.y)),this.value}close(e){this.opened&&(this.fireEvent(1,e),this.opened=!1)}chord(e){if(!this.isOpened()||this.isMine())return;let t=0,i=[];this.getNeighbors().forEach(n=>{n.isFlagged()?t++:n.isOpened()||i.push(n)}),t===this.peek()&&this.board.openGroup(this.board.expandZeroGroup(i),e)}flag(e=!0,t){!this.isOpened()&&e!==this.flagged&&(this.flagged=e,this.fireEvent(2,t))}setWrong(e=!0,t){this.wrong!==e&&(this.wrong=e,this.fireEvent(3,t))}press(e=!0,t){this.isOpened()||this.isFlagged()||this.pressed!==e&&(this.pressed=e,this.fireEvent(6,t))}pressChord(e=!0,t){!this.isOpened()||this.isMine()||this.getNeighbors().forEach(i=>i.press(e,t))}pressCellOrChord(e=!0,t){this.isOpened()?this.pressChord(e,t):this.press(e,t)}getNeighbors(){if(!this.neighbors.length){let{x:e,y:t}=this.position,{width:i,height:n}=this.board.getView();for(let o=Math.max(e-1,0);o<Math.min(e+2,i);o++)for(let s=Math.max(t-1,0);s<Math.min(t+2,n);s++)(o!==e||s!==t)&&this.neighbors.push(this.board.getCell(o,s))}return this.neighbors}addListener(e){this.listeners.push(e)}reset(e){this.flagged=!1,this.opened=!1,this.pressed=!1,this.wrong=!1,this.value=void 0,this.fireEvent(4,e)}dispose(e){this.fireEvent(5,e),this.listeners.length=0,this.attributes.clear()}setAttribute(e,t){this.attributes.set(e,t)}getAttribute(e){return this.attributes.get(e)}clearAttribute(e){this.attributes.delete(e)}fireEvent(e,t){for(let i of this.listeners)i(this,{type:e,attributes:t})}};function Q(r){let e=r;d(typeof r=="object"&&!!r&&typeof e.height=="number"&&typeof e.width=="number"&&Array.isArray(e.cellData),"Invalid Board Info: "+JSON.stringify(r))}var U=class r{static valueCoder=new B(4);static timeElapsedCoder=new B(7);encodeValue(e,t){let{height:i,width:n,elapsedTime:o}=e;i===16&&n===30?(t.encodeBit(.5,1),t.encodeBit(.5,1)):i===16&&n===16?(t.encodeBit(.5,1),t.encodeBit(.5,0)):i===9&&n===9?(t.encodeBit(.5,0),t.encodeBit(.5,1)):(t.encodeBit(.5,0),t.encodeBit(.5,0),r.valueCoder.encodeValue(i-1,t),r.valueCoder.encodeValue(v.encode(n,i,1),t)),o?(t.encodeBit(.5,1),r.timeElapsedCoder.encodeValue(Math.trunc(o/500),t)):t.encodeBit(.5,0)}decodeValue(e){let t=e.decodeBit(.5),i=e.decodeBit(.5),n,o;t===1&&i===1?(n=16,o=30):t==1&&i===0?(n=16,o=16):t===0&&i===1?(n=9,o=9):(n=r.valueCoder.decodeValue(e)+1,o=v.decode(r.valueCoder.decodeValue(e),n,1));let s=0;return e.decodeBit(.5)&&(s=r.timeElapsedCoder.decodeValue(e)*500),{width:o,height:n,elapsedTime:s}}},K=class{constructor(e,t){this.width=e;this.height=t;this.width===30&&this.height===16?(this.standardBoardSize=!0,this.expectedMineCount=99):this.width===16&&this.height===16?(this.standardBoardSize=!0,this.expectedMineCount=40):this.width===9&&this.height===9?(this.standardBoardSize=!0,this.expectedMineCount=10):(this.standardBoardSize=!1,this.expectedMineCount=Math.round(this.width*this.height/5));let i=Math.max(32-Math.clz32(this.width*this.height/20),1);this.customCoder=new B(i)}standardBoardSize;expectedMineCount;customCoder;encodeValue(e,t){if(this.standardBoardSize)if(this.expectedMineCount===e){t.encodeBit(.5,1);return}else t.encodeBit(.5,0);this.customCoder.encodeValue(v.encode(e,this.expectedMineCount),t)}decodeValue(e){return this.standardBoardSize&&e.decodeBit(.5)?this.expectedMineCount:v.decode(this.customCoder.decodeValue(e),this.expectedMineCount)}},N=class{cellCount;mineCountCoder;constructor(e,t){this.cellCount=e*t,this.mineCountCoder=new K(e,t)}encodeValue(e,t){let i=0;for(let n=0;n<this.cellCount;n++)e.getBit(n)&&i++;this.mineCountCoder.encodeValue(i,t),new x(this.cellCount,this.cellCount-i).encode(e.toReader(),t)}decodeValue(e){let t=this.mineCountCoder.decodeValue(e),i=new x(this.cellCount,this.cellCount-t),n=new b;return i.decode(e,n.toWriter()),n}},j=class{constructor(e,t,i){this.width=e;this.height=t;this.mineField=i;this.cellCount=e*t,this.openCountCoder=new I(this.cellCount+1),this.flagCountCoder=new B(Math.max(32-Math.clz32(this.mineField.mineCount)-1,1)),this.openMineCountCoder=this.wrongFlagCountCoder=this.closedInOpenGroupCoder=new B(0)}cellCount;openCountCoder;openMineCountCoder;flagCountCoder;wrongFlagCountCoder;closedInOpenGroupCoder;encodeValue(e,t){this.openCountCoder.encodeValue(e.opened,t),this.openMineCountCoder.encodeValue(e.openMines+1,t),this.flagCountCoder.encodeValue(e.flags,t),this.wrongFlagCountCoder.encodeValue(e.wrongFlags+1,t),this.closedInOpenGroupCoder.encodeValue(e.closedInOpenGroup+1,t)}decodeValue(e){let t=this.openCountCoder.decodeValue(e),i=this.openMineCountCoder.decodeValue(e)-1,n=this.flagCountCoder.decodeValue(e),o=this.wrongFlagCountCoder.decodeValue(e)-1,s=this.closedInOpenGroupCoder.decodeValue(e)-1;return{cells:this.cellCount,mines:this.mineField.mineCount,opened:t,openMines:i,flags:n,wrongFlags:o,closedInOpenGroup:s}}},O=class{constructor(e,t,i){this.width=e;this.height=t;this.mineField=i;this.tallyCoder=new j(e,t,i)}tallyCoder;encodeValue(e,t){c("[OpenStateCoder.encodeValue] encoding: %o",e);let i=ye(this.width,this.height,this.mineField,e);if(i.opened===0&&i.flags===0){c("[OpenStateCoder.encodeValue] encoding closed board"),t.encodeBit(.5,0);return}else c("[OpenStateCoder.encodeValue] encoding tally: %o",i),t.encodeBit(.5,1),this.tallyCoder.encodeValue(i,t);let n=i.mines===0?1:i.cells===i.mines?0:i.flags/i.mines/(i.opened/(i.cells-i.mines)),o=new S(this.mineField),s=0;for(let a=0;a<this.height;a++)for(let l=0;l<this.width;l++,s++){let h=this.left(e,this.mineField,l,a),u=this.up(e,this.mineField,l,a),m=this.mineField.getCellValue(l,a)===-2,f=o.getCell(l,a).isOpened(),{pOpen:p,pFlag:M}=ue([h,u].filter(T=>!!T),m,f,i,n),w=e[s]??0;c("[OpenStateCoder.encodeValue] encoding cell: %o",()=>({cellState:w,left:h,up:u,x:l,y:a,isMine:m,isInOpenGroup:f,flagRatio:n,pOpen:p,pFlag:M})),Ee(w,p,M,t),w===1&&o.getCell(l,a).openNoExpand(),X(i,m,e[s],f,-1)}}decodeValue(e){let t=e.decodeBit(.5),i=[];if(!t){for(let a=this.width*this.height;a>0;a--)i.push(0);return i}let n=this.tallyCoder.decodeValue(e),o=n.mines===0?1:n.cells===n.mines?0:n.flags/n.mines/(n.opened/(n.cells-n.mines)),s=new S(this.mineField);for(let a=0;a<this.height;a++)for(let l=0;l<this.width;l++){let h=this.left(i,this.mineField,l,a),u=this.up(i,this.mineField,l,a),m=this.mineField.getCellValue(l,a)===-2,f=s.getCell(l,a).isOpened(),{pOpen:p,pFlag:M}=ue([h,u].filter(T=>!!T),m,f,n,o),w=Me(p,M,e);i.push(w),w===1&&s.getCell(l,a).openNoExpand(),X(n,m,w,f,-1)}return i}neighbor(e,t,i,n,o,s){let a=i+o,l=n+s;if(!(a<0||a>=this.width||l<0||l>=this.height))return{isMine:t.getCellValue(a,l)===-2,openState:e[l*this.width+a]}}left(e,t,i,n){return this.neighbor(e,t,i,n,-1,0)}up(e,t,i,n){return this.neighbor(e,t,i,n,0,-1)}},V=class r{static dimensionCoder=new U;encodeValue(e,t){let{width:i,height:n,elapsedTime:o}=e,{minemap:s,openState:a}=Se(e.cellData),l=E.createMineFieldWithMineMap(i,n,[...s].map(h=>!!h));r.dimensionCoder.encodeValue(e,t),new N(i,n).encodeValue(s,t),new O(i,n,l).encodeValue(a,t)}decodeValue(e){let{width:t,height:i,elapsedTime:n}=r.dimensionCoder.decodeValue(e),o=new N(t,i).decodeValue(e),s=E.createMineFieldWithMineMap(t,i,[...o].map(l=>!!l)),a=new O(t,i,s).decodeValue(e);return{width:t,height:i,elapsedTime:n,cellData:xe(o,a)}}};function Se(r){let e=new g,t=[];for(let i of r)e.write(i.isMine?1:0),t.push(i.openState??0);return{minemap:e.bitset,openState:t}}function xe(r,e){let t=[];for(let i=0;i<e.length;i++)t.push({isMine:!!r.getBit(i),openState:e[i]});return t}function Ee(r,e,t,i){let n=r===0;i.encodeBit(Math.max(1-e-t,0),n?0:1),n||i.encodeBit(e/(e+t),r===2?1:0)}function Me(r,e,t){return t.decodeBit(Math.max(1-r-e,0))?t.decodeBit(r/(r+e))?2:1:0}function ye(r,e,t,i){let n={flags:0,opened:0,wrongFlags:0,openMines:0,mines:0,cells:0,closedInOpenGroup:0},o=new S(t),s=0;for(let a=0;a<e;a++)for(let l=0;l<r;l++,s++){let h=t.getCellValue(l,a)===-2,u=o.getCell(s).isOpened();i[s]===1&&o.getCell(s).openNoExpand(),X(n,h,i[s],u,1)}return n}function X(r,e,t,i,n){let o=t===2,s=t===1;r.cells+=n,o?(r.flags+=n,i&&(r.closedInOpenGroup+=n)):s?r.opened+=n:i&&(r.closedInOpenGroup+=n),e?(r.mines+=n,s&&(r.openMines+=n)):o&&(r.wrongFlags+=n)}function ue(r,e,t,i,n){c("[pOpenState] %o",{neighbors:r,isMine:e,isInOpenGroup:t,tally:i,flagRatio:n});let o=i.opened-i.openMines,s=i.cells-i.mines,a=e?i.openMines/i.mines:o/s,l=e?(i.flags-i.wrongFlags)/i.mines:i.wrongFlags/s;if(a===1||l===1||a===0&&l===0)return{pOpen:a,pFlag:l};if(t)return{pOpen:(s-i.closedInOpenGroup)/s,pFlag:Math.min(i.wrongFlags,i.closedInOpenGroup/2)/s};{let h=r.length,u=0,m=0;for(let p of r)p?.openState&&u++,p.isMine&&!p?.openState&&m++;h-=m*Math.max(1-n,0);let f=h===0?.5:u/h;return c("[pOpenState] weighting neighbor %o",{neighborOpenWeight:f,pFlag:l,pOpen:a}),f<=.5?e?l=Math.pow(l,(.5-f)*4+1):a=Math.pow(a,(.5-f)*4+1):e?(l=1-Math.pow(1-l,(f-.5)*4+1),a=Math.min(a,(1-l)/2)):(a=1-Math.pow(1-a,(f-.5)*4+1),l=Math.min(l,(1-a)/2)),{pOpen:a,pFlag:l}}}var Nt=re([[{value:0,bitCount:3},{value:0,bitCount:1}],[{value:4,bitCount:3},{value:1,bitCount:3}],[{value:2,bitCount:3},{value:5,bitCount:3}],[{value:6,bitCount:3},{value:7,bitCount:5}],[{value:1,bitCount:3},{value:3,bitCount:3}],[{value:5,bitCount:3},{value:23,bitCount:5}],[{value:3,bitCount:3},{value:15,bitCount:5}],[{value:7,bitCount:3},{value:31,bitCount:5}]]);if(typeof window>"u"&&typeof onmessage<"u"){let r=new V;onmessage=e=>{c("Processing web worker event: %o",e);let t=e.data;switch(t.messageType){case"ENCODE":{let{boardInfo:i}=t;Q(i);let n=Y(ee(i,r).toReader());postMessage({messageType:"ENCODE",boardId:n});break}case"DECODE":{let{boardId:i}=t;d(typeof i=="string","Invalid board id: "+JSON.stringify(i));let n=new g;q(i,n);let o=te(n.bitset.toReader(),r);postMessage({messageType:"DECODE",boardInfo:o});break}case"STATS":{let{boardInfo:i}=t;Q(i),postMessage({messageType:"STATS",stats:{}});break}default:throw new Error("Unknown message type: "+t.messageType)}}}})();
