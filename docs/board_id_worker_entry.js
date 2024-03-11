"use strict";(()=>{var Ce=2;function Se(n,e,...t){if(n<=Ce){let i;switch(n){case 3:i=console.info;break;case 2:i=console.warn;break;case 1:i=console.error;break;default:i=console.log;break}i(e,...t.map(r=>typeof r=="function"?r():r))}}function c(n,...e){Se(5,n,...e)}function h(n,e){if(!n)throw new Error(e??`Assertion failed: ${n}`);return n}function ne(n){return n=(n>>>0)-(n>>>1&1431655765),n=(n&858993459)+(n>>>2&858993459),(n+(n>>>4)&252645135)*16843009>>>24}function xe(n){return!!n.next}function Me(n){return!!n[Symbol.iterator]}function re(n){return xe(n)?n:Object.assign(n[Symbol.iterator](),{length:n.length})}function P(n){return Me(n)?n:{[Symbol.iterator]:()=>n,length:n.length}}function*Z(n){yield*Re(n)}function*Re(n){for(;!n.isClosed();)yield n.read()}var G=class{read(){throw new Error("End of stream")}readBatch(){throw new Error("End of stream")}maxBatch(){return 1}readBigBits(){throw new Error("End of stream")}count(){return 0}pending(){return 0}close(){}isClosed(){return!0}},qe=new G,b=class n{bits;_length=0;constructor(e,t){this.bits=Array.isArray(e)?e:e?[e]:[],this._length=this.bits.length*32,t!==void 0&&t!==this._length&&(this.length=t)}static fromBigint(e){let t=new n;return t.setBigBits(e,0),t}static fromReader(e,t){if(e instanceof N)return e.close(),e.bitset;t=t??-1;let i=new n,r=i.toWriter();function s(){return t<0?e.pending():t>0?Math.min(t,e.pending()):0}let o=s();for(;o;)r.writeBatch(e.readBatch(o),o),t-=o,o=s();return i}get length(){return this._length}set length(e){h(e>=0,"Length must be positive");let t=e+31>>>5;if(t>this.bits.length)for(let i=this.bits.length;i<t;i++)this.bits.push(0);else this.bits.length=t,e<this._length&&(this.bits[this.bits.length-1]&=4294967295>>>-(e&31));this._length=e}trim(){let e;for(e=this.bits.length;e>0&&!this.bits[e-1];--e);return this.bits.length=e,this._length=this.bits.length?(this.bits.length<<5)-Math.clz32(this.bits[this.bits.length-1]):0,this}getBit(e){if(h(e>=0,"Index out of range"),e>=this._length)return 0;let{bytePos:t,bitPos:i}=x(e);return this.bits[t]>>>i&1}setBit(e,t=1){h(e>=0,"Index out of range"),this._length<=e&&(this.length=e+1);let{bytePos:i,bitPos:r}=x(e),s=1<<r;t?this.bits[i]|=s:this.bits[i]&=~s}appendBit(e=1){this.setBit(this._length,e)}clearBit(e){this.setBit(e,0)}getBits(e,t){if(t=t??e+32,h(e>=0&&t>=e,"start or end out of range"),h(t-e<=32,"Too many bits requested - use getBigBits"),e>=this._length)return 0;t=Math.min(t,this._length);let i=t-e;if(i===0)return 0;let{bytePos:r,bitPos:s}=x(e);return s===0&&i===32?this.bits[r]:s+i<=32?this.bits[r]>>>s&4294967295>>>-i:(this.bits[r]>>>s|this.bits[r+1]<<-s)&4294967295>>>-i}setBits(e,t,i){i=i??t+32,h(t>=0&&i>=t,"start or end out of range"),h(i-t<=32,"setting bits limited to 32 bits"),i===void 0&&(i=t+32),i>=this._length&&(this.length=i);let r=i-t;if(r===0)return;let{bytePos:s,bitPos:o}=x(t);if(o+r<=32){let a=4294967295>>>-r<<o;this.bits[s]=this.bits[s]&~a|e<<o&a}else{this.bits[s]=this.bits[s]&4294967295>>>-o|e<<o;let a=4294967295<<o+r;this.bits[s+1]=this.bits[s+1]&a|e>>-o&~a}}appendBits(e,t){if(typeof e=="bigint"){this.appendBigBits(e,t);return}return t=t??32,h(t>=0&&t<=32,"bitCount must be between 0 and 32"),this.setBits(e,this._length,this._length+t)}getBigBits(e,t){if(t=t??Math.max(e,this._length),h(e>=0&&t>=e,"start or end out of range"),e>=this._length)return 0n;t=Math.min(t,this._length);let i=t-e;if(i===0)return 0n;let{bytePos:r,bitPos:s}=x(e);if(s+i<=32)return BigInt((this.bits[r]>>>s&4294967295>>>-i)>>>0);let o=BigInt(i),a=BigInt(this.bits[r]>>>s),d=32-s,l=r+1;for(;o>32+d;l++)a|=BigInt(this.bits[l]>>>0)<<BigInt(d),d+=32;return a|=BigInt((this.bits[l]&4294967295>>>d-i)>>>0)<<BigInt(d),a}setBigBits(e,t,i){if(h(t>=0&&(i===void 0||i>=t),"start or end out of range"),t===i)return 0;let r=t;i&&(e&=(1n<<BigInt(i-t))-1n,this.length=Math.max(this._length,i));let{bytePos:s,bitPos:o}=x(t);e<<=BigInt(o);let a=e<0;a&&(e=~e);let d=4294967295<<o>>>0;if(t+=32-o,e<=d&&(i||(i=Math.max(t-Math.clz32(Number(e)),this._length),this.length=Math.max(this._length,i)),i<=t))return d=d<<-i>>>-i,this.bits[s]=this.bits[s]&~d|Number(a?~e:e)&d,i-r;for(o=0,this.length=Math.max(this._length,t),this.bits[s]=this.bits[s]&~d|Number((a?~e:e)&BigInt(d)),e>>=32n,s++;i?i-t>32:this._length-t>32||e>4294967295;)this.length=Math.max(this._length,t+32),this.bits[s++]=Number((a?~e:e)&0xffffffffn)|0,t+=32,e>>=32n;return i||(i=Math.max(t+32-Math.clz32(Number(e)),this._length),this.length=Math.max(this._length,i)),d=4294967295>>>-i,this.bits[s]=this.bits[s]&~d|Number((a?~e:e)&BigInt(d)),i-r}appendBigBits(e,t){return this.setBigBits(e,this._length,t===void 0?t:this._length+t)}countBits(){return this.bits.reduce((e,t)=>e+ne(t),0)}shift(e){if(e<0){e=-e;let t=e>>>5,i=e&31;if(i===0)for(let r=0;r<this.bits.length-t;r++)this.bits[r]=this.bits[r+t];else{let r=0;for(;r<this.bits.length-t-1;r++)this.bits[r]=this.bits[r+t]>>>i|this.bits[r+t+1]<<-i;this.bits[r]=this.bits[r+t]>>>i}this.length-=e}else if(e>0){let t=e>>>5,i=e&31;if(this.length+=e+32,i===0)for(let r=this.bits.length-1;r>=t;r--)this.bits[r]=this.bits[r-t];else{for(let r=this.bits.length-1;r>t;r--)this.bits[r]=this.bits[r-t]<<i|this.bits[r-t-1]>>>-i;this.bits[t]=this.bits[0]<<i}this.length-=32}return this}toBigInt(e=0){return this.getBigBits(e,this._length)}toReader(e,t){return new N(this,e,t)}toWriter(e,t){return new g(this,e,t)}clone(){return new n([...this.bits],this._length)}[Symbol.iterator](){return Z(this.toReader())}toString(e=2){let t=this.toBigInt().toString(e);return"0".repeat(Math.max(Math.trunc(Math.log(2**this.length)/Math.log(e))-t.length,0))+t}};function x(n){return{bytePos:n>>>5,bitPos:n&31}}var I=class{constructor(e=-1){this.bitsAvailable=e}done=!1;read(){return h(!this.done,"End of stream"),this.bitsAvailable--,this.getBits(1)}readBatch(e=32){if(e===0)return 0;h(!this.done,"End of stream"),h(e>=0&&e<=32,"bitCount must be between 0 and 32 inclusive");try{return this.bitsAvailable-=e,this.getBits(e)}catch(t){throw this.bitsAvailable=0,this.done=!0,t}}readBigBits(e){h(!this.done,"End of stream"),e=e??-1;try{let t=0n,i=0,r=this.pending();for(;e<0?r>0:e>i;){h(r>0,"End of stream");let s=e<0?r:Math.min(e-i,r);t|=BigInt(this.getBits(s)>>>0)<<BigInt(i),i+=s,this.bitsAvailable-=s,r=this.pending()}return t}catch(t){throw this.bitsAvailable=0,this.done=!0,t}}maxBatch(){return 32}count(){return this.done?0:this.bitsAvailable<0?-1:this.bitsAvailable}pending(){return this.done?0:1}close(){this.done=!0}isClosed(){return this.done}asBigBitReader(){return{read:()=>this.read(),readBatch:e=>this.readBigBits(e),maxBatch:()=>4294967295,count:()=>this.count(),pending:()=>this.pending(),close:()=>this.close(),isClosed:()=>this.isClosed(),asBitReader:()=>this}}},_=class extends I{constructor(t){super();this.iter=t}getBits(t){let i=0;for(let r=0;r<t;r++){let s=this.iter.next();if(s.done)throw this.done=!0,new Error("Stream ended");i|=s.value<<r}return i}};function se(n){return new _(re(n))}var z=class{constructor(e){this.output=e}i=0;closed=!1;write(e){return h(!this.closed),this.output[this.i++]=e,this}writeBatch(e,t=32){for(let i=0;i<t;i++)this.write(e>>>i&1);return this}writeBigBits(e,t=-1){for(let i=0;t<0?e:i<t;i++)this.write(Number(e&1n)),e>>=1n;return this}isClosed(){return this.closed}close(){this.closed=!0}asBigBitWriter(){let e={write:t=>(this.write(t),e),writeBatch:(t,i)=>(this.writeBigBits(t,i),e),isClosed:()=>this.isClosed(),close:()=>this.close(),asBitWriter:()=>this};return e}};function oe(n){return new z(n)}var N=class extends I{constructor(t,i=0,r){super();this.bitset=t;this.end=r;h(i>=0,"start must be non-negative"),h(r===void 0||r>=i,"end must be greater than start"),this.pos=i}pos;isClosed(){return this.done||this.pos>=(this.end??this.bitset.length)}getBits(t){h(this.pos+t<=(this.end??this.bitset.length),"No data available");let i=this.pos;return this.pos+=t,this.bitset.getBits(i,this.pos)}count(){return this.done?0:(this.end??this.bitset.length)-this.pos}pending(){let t=this.count(),i=32-(this.pos&31);return t>=0&&t<=i?t:i}},g=class{constructor(e=new b,t=e.length,i){this.end=i;h(t>=0,"start must be non-negative"),h(i===void 0||i>=t,"end must be greater than start"),this.bitset=e??new b,this.pos=t}bitset;pos;closed=!1;isClosed(){return this.closed||!!this.end&&this.pos>=this.end}write(e){return this.assertBitCount(1),this.bitset.setBit(this.pos,e),this.pos++,this}writeBatch(e,t){return t=t??32,this.assertBitCount(t),this.bitset.setBits(e,this.pos,this.pos+t),this.pos+=t,this}writeBigBits(e,t){return this.end!==void 0&&t===void 0&&(t=this.end-this.pos),this.assertBitCount(t??0),t===void 0?t=this.bitset.setBigBits(e,this.pos):this.bitset.setBigBits(e,this.pos,this.pos+t),this.pos+=t,this}close(){this.closed=!0}assertBitCount(e){h(!this.closed,"Stream is closed"),h(!this.end||this.pos+e<=this.end,"End of stream")}asBigBitWriter(){let e={write:t=>(this.write(t),e),writeBatch:(t,i)=>(this.writeBigBits(t,i),e),isClosed:()=>this.isClosed(),close:()=>this.close(),asBitWriter:()=>this};return e}};var ae={encode:n=>n<0?~n<<1|1:n<<1,decode:n=>n&1?~(n>>>1):n>>>1},v=class n{constructor(e,t=0){this.base=e;this.min=t;h(t<=e)}static encode(e,t,i){return new n(t,i).encode(e)}static decode(e,t,i){return new n(t,i).decode(e)}encode(e){return h(e>=this.min),e>=2*(this.base-this.min)+this.min?e-this.min:ae.encode(e-this.base)}decode(e){return h(e>=0),e<2*(this.base-this.min)?ae.decode(e)+this.base:e+this.min}};function ye(n,e){if(h(e<=n&&n>=0&&e>=0),n-e<e&&(e=n-e),e===0)return 1n;let t=BigInt(n);for(let i=t-1n,r=2n;r<=e;i--,r++)t*=i,t/=r;return t}function de(n,e){h(n>=0,"val must be positive"),h(e>0,"n must be positive");let t=0n,i=1n,r=0n,s=0n;for(let o=0;o<e;o++,n>>=1n)n&1n?(t-=i,i*=++r,i/=++s,t+=i):(i*=++r,i/=r-s);return h(n===0n,"val out of range"),t}function he(n,e,t){let i=ye(e,t);h(n>=0n&&n<i,"BoardNumber out of range");let r=BigInt(e),s=BigInt(t),o=0n;for(let a=0;a<e;a++){o<<=1n;let d=i*(r-s)/r;n<d?i=d:(o|=1n,n-=i,i*=s--,i/=r,n+=i),r--}return o}var U=class{nextIntegers=new Uint32Array(16);nextIndex=16;next(){return this.nextIndex>=this.nextIntegers.length&&(crypto.getRandomValues(this.nextIntegers),this.nextIndex=0),this.nextIntegers[this.nextIndex++]}},O=class{constructor(e=new U){this.bitSource=e}workingBits=0;availableBits=0;getRandomBits(e){if(h(e>=0&&e<=32,"Random bits must be between 0 and 32"),e===32)return this.bitSource.next()>>>0;let t=0;return this.availableBits<e&&(t=this.workingBits<<e-this.availableBits,e-=this.availableBits,this.workingBits=this.bitSource.next()>>>0,this.availableBits=32),t|=this.workingBits>>>this.availableBits-e,this.availableBits-=e,this.workingBits&=(1<<this.availableBits)-1,t}getRandomInteger(e,t=0){h(t<=e,"Min must be <= max"),e-=t;let i=le(e),r;do r=this.getRandomBits(i);while(r>=e);return r+t}getRandomBigBits(e){h(e>=0,"BitLength must be positive");let t=0n;for(;e>32;)t=t<<32n|BigInt(this.getRandomBits(32)),e-=32n;return t=t<<BigInt(e)|BigInt(this.getRandomBits(Number(e))),t}getRandomBigInteger(e,t=0n){h(t<=e,"Min must be >= 0 and <= max"),e-=t;let i=le(e),r;do r=this.getRandomBigBits(i);while(r>=e);return r+t}getRandomDouble(){let e=new ArrayBuffer(8),t=new Uint32Array(e);return t[0]=this.getRandomBits(32),t[1]=this.getRandomBits(20)|1072693248,new Float64Array(e)[0]-1}};function ce(n,e=n.length,t=Oe){for(let i=0;i<e;i++){let r=t.getRandomInteger(n.length,i);if(i!=r){let s=n[i];n[i]=n[r],n[r]=s}}return n.length=e,n}function le(n){return typeof n=="number"?32-Math.clz32(n-1):BigInt((n-1n).toString(2).length)}var K=class{random;constructor(e){e=(e??Date.now())&4294967295,typeof process=="object"&&console.log("Using Test seed: %d",e),this.random=Ae(e)}next(){return Math.trunc(this.random()*4294967295)}};function Ae(n){n^=3735928559;let e=Ie(2654435769,608135816,3084996962,n);for(let t=0;t<15;t++)e();return e}function Ie(n,e,t,i){return()=>{n|=0,e|=0,t|=0,i|=0;let r=(n+e|0)+i|0;return i=i+1|0,n=e^e>>>9,e=t+(t<<3)|0,t=t<<21|t>>>11,t=t+r|0,(r>>>0)/4294967296}}function Ne(){if(typeof jasmine>"u")return;let n=jasmine?.getEnv()?.configuration()?.seed;if(n)return typeof n=="string"&&(n=Number(n)),isNaN(n)?void 0:n}var Oe=new O,lt=new O(new K(Ne()));function ue(n,e,t){return typeof n=="number"?n:(h(n.x>=0&&n.x<e&&n.y>=0&&n.y<t,"position outside grid"),n.y*e+n.x)}var R=class n{constructor(e,t,i){this.width=e;this.height=t;h(e>0&&t>0,"Width and height must be positive values"),h(i.length<=e*t,"Mine count must be <= cell count"),this.mineCount=i.length,this.initBoard(i)}mineCount;board=[];_boardNumber;static createRandomMineField(e,t,i,r,s){let o=e*t,a=new Set;for(let l of r?.map(u=>ue(u,e,t))??[])h(!a.has(l),"reserved cell already added"),a.add(l);h(i<=o-a.size,"Not enough room for the requested number of mines");let d=ce(Array.from({length:o},(l,u)=>u).filter(l=>!a.has(l)),i,s);return new n(e,t,d)}static createRandomMineFieldWithOpening(e,t,i,r,s=2,o){let{x:a,y:d}=r??{x:0,y:0},l=[];switch(s){case 0:l.push({x:a,y:d});break;case 1:for(let u=Math.max(a-1,0);u<Math.min(a+2,e);u++)for(let m=Math.max(d-1,0);m<Math.min(d+2,t);m++)l.push({x:u,y:m});break;case 2:}return this.createRandomMineField(e,t,i,l,o)}static createMineFieldWithBoardNumber(e,t,i,r){let s=e*t,o=[],a=he(r,s,i);for(let d=s-1;d>=0;d--,a>>=1n)a&1n&&o.push(d);return new n(e,t,o)}static createMineFieldWithMineMap(e,t,i){let r=[];for(let s=0;s<i.length;s++)i[s]&&r.push(s);return new n(e,t,r)}initBoard(e){let t=this.width,i=this.height;this.board.length=t*i,this.board.fill(0);let r=s=>{let o=typeof s=="number"?Math.trunc(s/t):s.y,a=typeof s=="number"?s-o*t:s.x;if(h(o>=0&&o<i&&a>=0&&a<t,"Mine position is outside the grid"),this.board[a+o*t]<0)throw new Error(`Same cell marked as mine more than once: {X: ${a}, y: ${o}}`);this.board[a+o*t]=-2;for(let d=Math.max(a-1,0);d<Math.min(a+2,t);d++)for(let l=Math.max(o-1,0);l<Math.min(o+2,i);l++)this.board[d+l*t]!==-2&&this.board[d+l*t]++};for(let s of e)r(s)}getBoardNumber(){if(this._boardNumber===void 0){let e=0n;for(let t=0;t<this.height;t++)for(let i=0;i<this.width;i++)e<<=1n,this.board[i+t*this.width]<0&&(e|=1n);this._boardNumber=de(e,this.width*this.height)}return this._boardNumber}getCellValue(e,t){return this.board[e+t*this.width]}getValueMap(){return this.board}clearTransientState(){return this._boardNumber=void 0,this}toString(){let e=this.board;return e?Array.from({length:this.height}).map((t,i)=>Array.from({length:this.width}).map((r,s)=>e[s+i*this.width]).map(r=>r===-2?"X":String(r)).join("")).join(`
`):"Uninitialized"}};var M=class{cells=[];listeners=[];cellListener;openMines=0;minesRemaining=0;cellsRemaining=0;boardStarted=0;boardEnded=0;started=!1;view;clockEventInterval=0;timerId;constructor(e){this.cellListener=this.getCellListener(),this.reset(e),this.view=e}getCellVisibleState(e,t){return this.cells[e+t*this.view.width]?.getVisibleState()??-1}getCellListener(){return(e,t)=>{switch(t.type){case 0:if(e.isMine()){let i=this.openMines===0;this.openMines++,t.attributes?.OPEN_GROUP||this.fireEvent(9,t.attributes),i&&(this.stopClock(),this.fireEvent(4,t.attributes))}else this.cellsRemaining--,this.started||(this.started=!0,this.startClock(),this.fireEvent(3,t.attributes)),t.attributes?.OPEN_GROUP||this.fireEvent(9,t.attributes),this.cellsRemaining||(this.stopClock(),this.fireEvent(6,t.attributes));break;case 2:e.isFlagged()?this.minesRemaining--:this.minesRemaining++,this.fireEvent(8,t.attributes);break;case 1:e.isMine()?(this.openMines--,this.openMines||(this.boardEnded=0,this.startClock(),this.fireEvent(5,t.attributes))):this.cellsRemaining++||(console.log("uncompleting"),this.boardEnded=0,this.startClock(),this.fireEvent(7,t.attributes));break}}}expandZeroGroup(e){let t=new Set,i=new Set;function r(){for(let s of i)return i.delete(s),s;throw new Error("Empty")}for(let s of P(e))i.add(s);for(;i.size;){let s=r(),{x:o,y:a}=s.position;if(t.add(s),this.view.getCellValue(o,a)===0)for(let l of s.getNeighbors())t.has(l)||i.add(l)}return t}getCell(e,t){return typeof e=="number"?t===void 0?(h(e>=0&&e<this.cells.length,"Index out of bounds"),this.cells[e]):(h(e>=0&&e<this.view.width&&t>=0&&t<this.view.height,"position outside grid"),this.cells[e+t*this.view.width]):this.cells[ue(e,this.view.width,this.view.height)]}getAllCells(){return this.cells}getVisibleStateMap(){return this.cells.map(e=>e.getVisibleState())}isExploded(){return this.openMines>0}isComplete(){return this.started&&this.cellsRemaining<=0}isStarted(){return this.started}getMinesRemaining(){return this.minesRemaining}getCellsRemaining(){return this.cellsRemaining}getTimeElapsed(){return this.boardStarted===0?0:this.boardEnded===0?Date.now()-this.boardStarted:this.boardEnded-this.boardStarted}setTimeElapsed(e,t){this.boardStarted=(this.boardEnded||Date.now())-e,this.startClock(t)}setClockEventInterval(e,t){this.clockEventInterval=e,e>0?this.startClock(t):this.stopClock(t)}startClock(e){this.timerId===void 0&&this.started&&this.boardEnded===0&&this.clockEventInterval>0&&(this.boardStarted||(this.boardStarted=Date.now()),this.fireEvent(10,e),this.timerId=setInterval(()=>{this.fireEvent(10,e)},this.clockEventInterval))}stopClock(e){this.boardStarted!==0&&this.boardEnded===0&&(this.boardEnded=Date.now(),this.fireEvent(10,e)),this.timerId!==void 0&&(clearInterval(this.timerId),this.timerId=void 0)}reset(e,t){this.view=e;for(let s of this.getAllCells())s.dispose(t);let{width:i,height:r}=e;this.cells.length=i*r;for(let s=0;s<i;s++)for(let o=0;o<r;o++)(this.cells[s+o*i]=new j({x:s,y:o},this)).addListener(this.cellListener);this.initializeStats(),this.fireEvent(1,t)}getView(){return this.view}initializeStats(){this.openMines=0;let{width:e,height:t,mineCount:i}=this.getView();this.minesRemaining=i,this.cellsRemaining=e*t-i,this.boardStarted=0,this.boardEnded=0,this.stopClock(),this.started=!1}dispose(e){for(let t of this.cells)t.dispose(e);this.fireEvent(0,e),this.listeners.length=0,this.cells.length=0}openGroup(e,t){for(let i of P(e))i.isOpened()||i.openNoExpand({...t,OPEN_GROUP:!0});this.fireEvent(9,t)}addListener(e){this.listeners.push(e)}fireEvent(e,t){for(let i of this.listeners)i(this,{type:e,attributes:t})}};var j=class{constructor(e,t){this.position=e;this.board=t}flagged=!1;value;opened=!1;pressed=!1;wrong=!1;listeners=[];attributes=new Map;neighbors=[];getVisibleState(){return this.opened?this.peek():this.flagged?-3:-1}isFlagged(){return this.flagged}isMine(){return this.peek()===-2}isOpened(){return this.opened}isPressed(){return this.pressed}isWrong(){return this.wrong}openNoExpand(e){return this.opened||(this.flag(!1),this.opened=!0,this.fireEvent(0,e)),this.peek()}open(e){this.board.openGroup(this.board.expandZeroGroup([this]),e)}peek(){return this.value===void 0&&(this.value=this.board.getView().getCellValue(this.position.x,this.position.y)),this.value}close(e){this.opened&&(this.fireEvent(1,e),this.opened=!1)}chord(e){if(!this.isOpened()||this.isMine())return;let t=0,i=[];this.getNeighbors().forEach(r=>{r.isFlagged()?t++:r.isOpened()||i.push(r)}),t===this.peek()&&this.board.openGroup(this.board.expandZeroGroup(i),e)}flag(e=!0,t){!this.isOpened()&&e!==this.flagged&&(this.flagged=e,this.fireEvent(2,t))}setWrong(e=!0,t){this.wrong!==e&&(this.wrong=e,this.fireEvent(3,t))}press(e=!0,t){this.isOpened()||this.isFlagged()||this.pressed!==e&&(this.pressed=e,this.fireEvent(6,t))}pressChord(e=!0,t){!this.isOpened()||this.isMine()||this.getNeighbors().forEach(i=>i.press(e,t))}pressCellOrChord(e=!0,t=!0,i=!0,r){this.isOpened()?t&&this.pressChord(e,r):i&&this.press(e,r)}getNeighbors(){if(!this.neighbors.length){let{x:e,y:t}=this.position,{width:i,height:r}=this.board.getView();for(let s=Math.max(e-1,0);s<Math.min(e+2,i);s++)for(let o=Math.max(t-1,0);o<Math.min(t+2,r);o++)(s!==e||o!==t)&&this.neighbors.push(this.board.getCell(s,o))}return this.neighbors}addListener(e){this.listeners.push(e)}reset(e){this.flagged=!1,this.opened=!1,this.pressed=!1,this.wrong=!1,this.value=void 0,this.fireEvent(4,e)}dispose(e){this.fireEvent(5,e),this.listeners.length=0,this.attributes.clear()}setAttribute(e,t){this.attributes.set(e,t)}getAttribute(e){return this.attributes.get(e)}clearAttribute(e){this.attributes.delete(e)}fireEvent(e,t){for(let i of this.listeners)i(this,{type:e,attributes:t})}};var V=class{static encoder(e){return new Q(e)}static decoder(e,t){return new X(e,t)}};function Ve(n,e,t,i=!0){let r=V.encoder(t);for(let s of n)e.encodeValue(s,r);r.close(i)}function Te(n,e,t){let i=t?t.bitset:new b,r=t??i.toWriter();return Ve(n,e,r,!!t),i}function H(n,e,t){return Te([n],e,t)}function q(n,e,t=!0){let i=V.decoder(n,t),r=e.decodeValue(i);return i.close(),r}var y=class{constructor(e,t){this.n=e;this.z=t;h(e>=0),h(t>=0&&t<=e),h(Math.trunc(e)===e&&Math.trunc(t)===t,"n and z must be integers")}encode(e,t){let i=this.n,r=this.z;for(let s of Z(e)){if(t.encodeBit(r/i,s),!--i)return;s||--r}}decode(e,t){let i=this.n,r=this.z;for(;i;--i){let s=e.decodeBit(r/i);t.write(s),s||--r}}},T=class{constructor(e,t=0){this.min=t;h(e>t),this.max=e-t-1>>>0,this.mask=e?1<<31-Math.clz32(this.max):0}max;mask;encodeValue(e,t){let i=this.mask,r=!1;for(e-=this.min,h(e>=0&&e<=this.max);i;){let s=r?.5:i/(i+(this.max&i?(this.max&i-1)+1:0)),o=e&i?1:0;t.encodeBit(s,o),r||=!o&&!!(this.max&i),i>>>=1}}decodeValue(e){let t=this.mask,i=!1,r=0;for(;t;){let s=i?.5:t/(t+(this.max&t?(this.max&t-1)+1:0)),o=e.decodeBit(s);r|=o*t,i||=!o&&!!(this.max&t),t>>>=1}return r+this.min}},S=class{constructor(e,t=.5){this.payloadBits=e;this.p=1-t}p;encode(e,t){if(this.payloadBits){for(let i=0;i<this.payloadBits;++i)t.encodeBit(.5,e.isClosed()?0:e.read());if(e.isClosed()){t.encodeBit(.5,0);return}t.encodeBit(.5,1)}for(;;){let i=e.isClosed()?0:e.read();if(e.isClosed()){t.encodeBit(this.p,0);return}t.encodeBit(this.p,1),t.encodeBit(.5,i)}}encodeValue(e,t){this.encode(new g().writeBatch(e).bitset.trim().toReader(),t)}encodeBigInt(e,t){this.encode(new g().writeBigBits(e).bitset.trim().toReader(),t)}decode(e,t){if(this.payloadBits){for(let r=0;r<this.payloadBits;++r)t.write(e.decodeBit(.5));if(!e.decodeBit(.5))return}for(;;){if(!e.decodeBit(this.p)){t.write(1);return}t.write(e.decodeBit(.5))}}decodeValue(e){let t=new b;return this.decode(e,t.toWriter()),h(t.trim().length<=32,"Value too large for a number. Use decodeBigInt"),t.getBits(0)}decodeBigInt(e){let t=new b;return this.decode(e,t.toWriter()),t.toBigInt()}asBigintCoder(){return{encode:(e,t)=>{this.encode(e,t)},decode:(e,t)=>{this.decode(e,t)},encodeValue:(e,t)=>this.encodeBigInt(e,t),decodeValue:e=>this.decodeBigInt(e)}}};var f=2147483647,me=1610612735,C=1073741824,B=536870912,X=class{constructor(e,t=!1){this.input=e;this.padStream=t}closed=!1;high=f;low=0;value=0;rangeMask=f;decodeBit(e){if(h(!this.closed,"Stream closed"),e>=1)return h(e===1,`[Arithmetic.decode] Invalid p: ${e}`),0;if(e<=0)return h(e===0,`[Arithmetic.encode] Invalid p: ${e}`),1;for(;this.high-this.low<B;){let r;this.high<C?(this.high=this.high<<1|1,this.value<<=1,this.low<<=1,r="low"):this.low>=C?(this.high=this.high<<1&f|1,this.value=this.value<<1&f,this.low=this.low<<1&f,r="high"):(this.high=this.high-B<<1|1,this.value=this.value-B<<1,this.low=this.low-B<<1,r="mid"),this.rangeMask=this.rangeMask<<1|1,c("[Arithmetic.decode] zooming %o",()=>({zoom:r,low:this.low,high:this.high,value:this.value,rangeBits:this.rangeMask}))}let t=this.low+1+Math.trunc(e*(this.high-this.low)),i=()=>({low:this.low,mid:t,high:this.high,value:this.value,rangeBits:this.rangeMask,p:e});for(c("[Arithmetic.decode] working on: %o",i);;){if(this.value>=t)return c("[Arithmetic.decode] emitting 1 bit. Data: %o",i),this.low=t,1;if(this.value+this.rangeMask<t)return c("[Arithmetic.decode] emitting 0 bit. Data: %o",i),this.high=t-1,0;{!this.padStream&&this.input.isClosed()&&(this.closed=!0,h(!1,"No more bits in the stream"));let r=this.padStream&&this.input.isClosed()?0:this.input.read();this.rangeMask>>>=1,r&&(this.value+=this.rangeMask+1),c("[Arithmetic.decode] Reading more. Data: %o",()=>({bit:r,...i()}))}}}close(){this.closed=!0}isClosed(){return this.closed}},Q=class n{constructor(e,t){this.output=e;t&&(this.closed=t.closed,this.high=t.high,this.low=t.low,this.pendingBits=t.pendingBits,this.trailingZeros=t.trailingZeros)}closed=!1;high=f;low=0;pendingBits=0;trailingZeros=0;encodeBit(e,t){if(h(!this.closed,"Stream closed"),e>=1){h(e===1&&t===0,`[Arithmetic.encode] Invalid p: ${e}, b: ${t}`),c("[Arithmetic.encode] Got p: 1, no encoding required");return}else if(e<=0){h(e===0&&t===1,`[Arithmetic.encode] Invalid p: ${e}, b: ${t}`),c("[Arithmetic.encode] Got p: 0, no encoding required");return}for(;this.high-this.low<B;)this.high<C?this.zoomLow("encode"):this.low>=C?this.zoomHigh("encode"):this.zoomMid("encode");let i=this.low+1+Math.trunc(e*(this.high-this.low));c("[Arithmetic.encode] working on: %o",()=>({low:this.low,mid:i,high:this.high,p:e,b:t})),t?this.low=i:this.high=i-1}close(e=!1){if(!this.closed)if(this.closed=!0,e){for(;this.high<f||this.low>0;)this.low>0&&this.high>=me?this.zoomHigh("terminating"):this.high<f&&this.low<=B?this.zoomLow("terminating"):this.zoomMid("terminating");for(this.pendingBits&&(this.writeBit(1),c("[Arithmetic.close] Terminating pending: 1"));this.trailingZeros;--this.trailingZeros)this.output.write(0)}else for(;this.low>0||this.pendingBits;)this.high>=C?this.zoomHigh("closing"):this.zoomLow("closing")}isClosed(){return this.closed}clone(e){return new n(e,{closed:this.closed,high:this.high,low:this.low,pendingBits:this.pendingBits,trailingZeros:this.trailingZeros})}zoomHigh(e){this.writeBit(1),this.high=this.high<<1&f|1,this.low=this.low&C?this.low<<1&f:0,c("[Arithmetic.zoom] %s %o",e,()=>({zoom:"high",low:this.low,high:this.high}))}zoomLow(e){this.writeBit(0),this.high=this.high&C?f:this.high<<1|1,this.low=this.low<<1,c("[Arithmetic.zoom] %s %o",e,()=>({zoom:"low",low:this.low,high:this.high}))}zoomMid(e){this.pendingBits++,this.high=this.high>=me?f:this.high-B<<1|1,this.low=this.low<=B?0:this.low-B<<1,c("[Arithmetic.zoom] %s %o",e,()=>({zoom:"mid",low:this.low,high:this.high}))}writeBit(e){if(e){for(;this.trailingZeros;--this.trailingZeros)this.output.write(0);this.output.write(1),this.trailingZeros=this.pendingBits,this.pendingBits=0}else{if(this.pendingBits){for(;this.trailingZeros>=0;--this.trailingZeros)this.output.write(0);for(;this.pendingBits;--this.pendingBits)this.output.write(1)}++this.trailingZeros}}};var Y="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",fe=new Array(128);for(let n=0;n<Y.length;n++)fe[Y.charCodeAt(n)]=n;function k(n){let e=[],t=0,i=0;for(;;){let r=Math.min(6-i,n.pending());if(t|=n.readBatch(r)<<i,i+=r,(i===6||i>0&&r===0)&&(e.push(Y[t]),t=0,i=0),!r)return e.join("")}}function D(n,e=new g){for(let t of n)e.writeBatch(fe[t.charCodeAt(0)],6);return e}function ke(n){return k(H(n,ve).toReader())}function De(n){let e=!1,t=[];for(let s of n.cellData){let o=s.openState??0;e||=o!==0,t.push(o)}if(!e)return;let i=R.createMineFieldWithMineMap(n.width,n.height,n.cellData.map(s=>s.isMine)),r=new L(n.width,n.height,i);return k(H(t,r).toReader())}function We(n){if(n)return k(new g().writeBigBits(BigInt(n)).bitset.toReader())}function be(n){let e=ke(n),t=De(n),i=We(n.elapsedTime);return i?{boardId:e,viewState:t,elapsedTime:i}:{boardId:e,viewState:t}}function Le(n){return q(D(n).bitset.toReader(),ve)}function Fe(n,e){if(!e)return;let t=R.createMineFieldWithMineMap(n.width,n.height,n.cellData.map(s=>s.isMine)),i=new L(n.width,n.height,t),r=q(D(e).bitset.toReader(),i);for(let s=0;s<r.length;s++)n.cellData[s].openState=r[s]}function Pe(n){if(n)return Number(D(n).bitset.toBigInt())}function Be(n){let e=Le(n.boardId);Fe(e,n.viewState);let t=Pe(n.elapsedTime);return t&&(e.elapsedTime=t),e}function we(n){let e=n;h(typeof n=="object"&&!!n&&typeof e.height=="number"&&typeof e.width=="number"&&Array.isArray(e.cellData)&&e.cellData.length===e.height*e.width,"Invalid Board State: "+JSON.stringify(n))}function Ee(n){let e=n;h(typeof e=="object"&&!!e&&typeof e.boardId=="string"&&(!e.viewState||typeof e.viewState=="string")&&(!e.elapsedTime||typeof e.elapsedTime=="string"),"Invalid Encoded Board State: "+JSON.stringify(n))}var $=class n{static valueCoder=new S(4);encodeValue(e,t){let{height:i,width:r}=e;i===16&&r===30?(t.encodeBit(.5,1),t.encodeBit(.5,1)):i===16&&r===16?(t.encodeBit(.5,1),t.encodeBit(.5,0)):i===9&&r===9?(t.encodeBit(.5,0),t.encodeBit(.5,1)):(t.encodeBit(.5,0),t.encodeBit(.5,0),n.valueCoder.encodeValue(i-1,t),n.valueCoder.encodeValue(v.encode(r,i,1),t))}decodeValue(e){let t=e.decodeBit(.5),i=e.decodeBit(.5),r,s;return t===1&&i===1?(r=16,s=30):t==1&&i===0?(r=16,s=16):t===0&&i===1?(r=9,s=9):(r=n.valueCoder.decodeValue(e)+1,s=v.decode(n.valueCoder.decodeValue(e),r,1)),{width:s,height:r}}},J=class{constructor(e,t){this.width=e;this.height=t;this.width===30&&this.height===16?(this.standardBoardSize=!0,this.expectedMineCount=99):this.width===16&&this.height===16?(this.standardBoardSize=!0,this.expectedMineCount=40):this.width===9&&this.height===9?(this.standardBoardSize=!0,this.expectedMineCount=10):(this.standardBoardSize=!1,this.expectedMineCount=Math.round(this.width*this.height/5));let i=Math.max(32-Math.clz32(this.width*this.height/20),1);this.customCoder=new S(i)}standardBoardSize;expectedMineCount;customCoder;encodeValue(e,t){if(this.standardBoardSize)if(this.expectedMineCount===e){t.encodeBit(.5,1);return}else t.encodeBit(.5,0);this.customCoder.encodeValue(v.encode(e,this.expectedMineCount),t)}decodeValue(e){return this.standardBoardSize&&e.decodeBit(.5)?this.expectedMineCount:v.decode(this.customCoder.decodeValue(e),this.expectedMineCount)}},W=class{cellCount;mineCountCoder;constructor(e,t){this.cellCount=e*t,this.mineCountCoder=new J(e,t)}encodeValue(e,t){let i=e.reduce((r,s)=>r+s,0);this.mineCountCoder.encodeValue(i,t),new y(this.cellCount,this.cellCount-i).encode(se(e),t)}decodeValue(e){let t=this.mineCountCoder.decodeValue(e),i=new y(this.cellCount,this.cellCount-t),r=[];return i.decode(e,oe(r)),r}},ee=class{constructor(e,t,i){this.width=e;this.height=t;this.mineField=i;this.cellCount=e*t,this.openCountCoder=new T(this.cellCount+1),this.flagCountCoder=new S(Math.max(32-Math.clz32(this.mineField.mineCount)-1,1)),this.openMineCountCoder=this.wrongFlagCountCoder=this.closedInOpenGroupCoder=new S(0)}cellCount;openCountCoder;openMineCountCoder;flagCountCoder;wrongFlagCountCoder;closedInOpenGroupCoder;encodeValue(e,t){this.openCountCoder.encodeValue(e.opened,t),this.openMineCountCoder.encodeValue(e.openMines+1,t),this.flagCountCoder.encodeValue(e.flags,t),this.wrongFlagCountCoder.encodeValue(e.wrongFlags+1,t),this.closedInOpenGroupCoder.encodeValue(e.closedInOpenGroup+1,t)}decodeValue(e){let t=this.openCountCoder.decodeValue(e),i=this.openMineCountCoder.decodeValue(e)-1,r=this.flagCountCoder.decodeValue(e),s=this.wrongFlagCountCoder.decodeValue(e)-1,o=this.closedInOpenGroupCoder.decodeValue(e)-1;return{cells:this.cellCount,mines:this.mineField.mineCount,opened:t,openMines:i,flags:r,wrongFlags:s,closedInOpenGroup:o}}},L=class{constructor(e,t,i){this.width=e;this.height=t;this.mineField=i;this.tallyCoder=new ee(e,t,i)}tallyCoder;encodeValue(e,t){c("[OpenStateCoder.encodeValue] encoding: %o",e);let i=ze(this.width,this.height,this.mineField,e);if(i.opened===0&&i.flags===0){c("[OpenStateCoder.encodeValue] encoding closed board"),t.encodeBit(.5,0);return}else c("[OpenStateCoder.encodeValue] encoding tally: %o",i),t.encodeBit(.5,1),this.tallyCoder.encodeValue(i,t);let r=i.mines===0?1:i.cells===i.mines?0:i.flags/i.mines/(i.opened/(i.cells-i.mines)),s=new M(this.mineField),o=0;for(let a=0;a<this.height;a++)for(let d=0;d<this.width;d++,o++){let l=this.left(e,this.mineField,d,a),u=this.up(e,this.mineField,d,a),m=this.mineField.getCellValue(d,a)===-2,p=s.getCell(d,a).isOpened(),{pOpen:w,pFlag:A}=ge([l,u].filter(F=>!!F),m,p,i,r),E=e[o]??0;c("[OpenStateCoder.encodeValue] encoding cell: %o",()=>({cellState:E,left:l,up:u,x:d,y:a,isMine:m,isInOpenGroup:p,flagRatio:r,pOpen:w,pFlag:A})),Ge(E,w,A,t),E===1&&s.getCell(d,a).openNoExpand(),ie(i,m,e[o],p,-1)}}decodeValue(e){let t=e.decodeBit(.5),i=[];if(!t){for(let a=this.width*this.height;a>0;a--)i.push(0);return i}let r=this.tallyCoder.decodeValue(e),s=r.mines===0?1:r.cells===r.mines?0:r.flags/r.mines/(r.opened/(r.cells-r.mines)),o=new M(this.mineField);for(let a=0;a<this.height;a++)for(let d=0;d<this.width;d++){let l=this.left(i,this.mineField,d,a),u=this.up(i,this.mineField,d,a),m=this.mineField.getCellValue(d,a)===-2,p=o.getCell(d,a).isOpened(),{pOpen:w,pFlag:A}=ge([l,u].filter(F=>!!F),m,p,r,s),E=_e(w,A,e);i.push(E),E===1&&o.getCell(d,a).openNoExpand(),ie(r,m,E,p,-1)}return i}neighbor(e,t,i,r,s,o){let a=i+s,d=r+o;if(!(a<0||a>=this.width||d<0||d>=this.height))return{isMine:t.getCellValue(a,d)===-2,openState:e[d*this.width+a]}}left(e,t,i,r){return this.neighbor(e,t,i,r,-1,0)}up(e,t,i,r){return this.neighbor(e,t,i,r,0,-1)}},te=class n{static dimensionCoder=new $;encodeValue(e,t){let{width:i,height:r}=e,s=e.cellData.map(o=>o.isMine?1:0);n.dimensionCoder.encodeValue(e,t),new W(i,r).encodeValue(s,t)}decodeValue(e){let{width:t,height:i}=n.dimensionCoder.decodeValue(e),s=new W(t,i).decodeValue(e).map(o=>({isMine:!!o}));return{width:t,height:i,cellData:s}}},ve=new te;function Ge(n,e,t,i){let r=n===0;i.encodeBit(Math.max(1-e-t,0),r?0:1),r||i.encodeBit(e/(e+t),n===2?1:0)}function _e(n,e,t){return t.decodeBit(Math.max(1-n-e,0))?t.decodeBit(n/(n+e))?2:1:0}function ze(n,e,t,i){let r={flags:0,opened:0,wrongFlags:0,openMines:0,mines:0,cells:0,closedInOpenGroup:0},s=new M(t),o=0;for(let a=0;a<e;a++)for(let d=0;d<n;d++,o++){let l=t.getCellValue(d,a)===-2,u=s.getCell(o).isOpened();i[o]===1&&s.getCell(o).openNoExpand(),ie(r,l,i[o],u,1)}return r}function ie(n,e,t,i,r){let s=t===2,o=t===1;n.cells+=r,s?(n.flags+=r,i&&(n.closedInOpenGroup+=r)):o?n.opened+=r:i&&(n.closedInOpenGroup+=r),e?(n.mines+=r,o&&(n.openMines+=r)):s&&(n.wrongFlags+=r)}function ge(n,e,t,i,r){c("[pOpenState] %o",{neighbors:n,isMine:e,isInOpenGroup:t,tally:i,flagRatio:r});let s=i.opened-i.openMines,o=i.cells-i.mines,a=e?i.openMines/i.mines:s/o,d=e?(i.flags-i.wrongFlags)/i.mines:i.wrongFlags/o;if(a===1||d===1||a===0&&d===0)return{pOpen:a,pFlag:d};if(t)return{pOpen:(o-i.closedInOpenGroup)/o,pFlag:Math.min(i.wrongFlags,i.closedInOpenGroup/2)/o};{let l=n.length,u=0,m=0;for(let w of n)w?.openState&&u++,w.isMine&&!w?.openState&&m++;l-=m*Math.max(1-r,0);let p=l===0?.5:u/l;return c("[pOpenState] weighting neighbor %o",{neighborOpenWeight:p,pFlag:d,pOpen:a}),e?(d=pe(1-p,d),a=Math.min(a,(1-d)/2)):(a=pe(1-p,a),d=Math.min(d,(1-a)/2)),{pOpen:a,pFlag:d}}}function pe(n,e){if(n===.5||e===0||e===1)return e;let t=2*n-1,i=n-Ze(n*n-e*t);return(1/t-1)*i+i*i/t}function Ze(n){let e=Math.sqrt(n),t=0;for(;n<e*e;){let i=e*(1-Number.EPSILON/2);i===e&&(i=e-Number.MIN_VALUE);let r=i+(e-i)/2;r<e&&r>i&&(i=r);let s=(i+e)/2;if(s<e&&s>i&&(i=s),e=i,++t>100)throw new Error("Error normalizing sqrt")}return e}typeof window>"u"&&typeof onmessage<"u"&&(onmessage=n=>{c("Processing web worker event: %o",n);let e=n.data;switch(e.messageType){case"ENCODE":{let{boardState:t}=e;we(t);let i=be(t);postMessage({messageType:"ENCODE",encodedBoardState:i});break}case"DECODE":{let{encodedBoardState:t}=e;Ee(t);let i=Be(t);postMessage({messageType:"DECODE",boardState:i});break}default:throw new Error("Unknown message type: "+e.messageType)}});})();
