const express=require("express"),http=require("http"),path=require("path");
const {Server}=require("socket.io");
const nspell=require("nspell");
const dictionaryEs=require("dictionary-es");
const app=express(),server=http.createServer(app),io=new Server(server,{cors:{origin:"*",methods:["GET","POST"]}});
const PORT=process.env.PORT||3000,MAX=4,TURN_MS=12000;
app.use(express.static(path.join(__dirname,"public")));
let spell=null,dictionaryStatus="loading";
try {
 if(typeof dictionaryEs==="function") dictionaryEs((err,dict)=>{
  if(err){console.error(err);dictionaryStatus="error";return;}
  spell=nspell(dict);dictionaryStatus="ready";console.log("Diccionario español listo.");
 });
 else if(dictionaryEs&&typeof dictionaryEs.then==="function") dictionaryEs.then(d=>{spell=nspell(d);dictionaryStatus="ready"}).catch(e=>{console.error(e);dictionaryStatus="error"});
 else {dictionaryStatus="error";console.error("Formato de dictionary-es no reconocido");}
} catch(e){console.error(e);dictionaryStatus="error"}

const rooms=new Map();
function nameClean(v){return String(v||"Jugador").replace(/[<>]/g,"").replace(/\s+/g," ").trim().slice(0,16)||"Jugador"}
function wordClean(v){return String(v||"").normalize("NFC").toLocaleLowerCase("es").trim().replace(/[^a-záéíóúüñ]/gi,"")}
function codeNew(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let s="";for(let i=0;i<5;i++)s+=chars[Math.floor(Math.random()*chars.length)];return s}
function syllableNew(){return ["ar","en","es","la","te","co","ción","mar","tra","pro","ca","dor","men","bra","que","ien","ado","tor","uni","pla","osa","ver","pre","sal","ran","sta","con","des","per","ido"][Math.floor(Math.random()*30)]}
function alive(r){return r.players.filter(p=>p.alive)}
function state(r){return {code:r.code,status:r.status,maxPlayers:MAX,players:r.players.map((p,i)=>({id:p.id,name:p.name,alive:p.alive,isHost:i===0,score:p.score})),currentPlayerId:r.currentPlayerId,syllable:r.syllable,deadline:r.deadline,usedCount:r.used.size,winnerId:r.winnerId||null,dictionaryStatus}}
function emit(r){io.to(r.code).emit("state",state(r))}
function next(r,after){let ix=r.players.findIndex(p=>p.id===after);for(let k=1;k<=r.players.length;k++){let p=r.players[(ix+k+r.players.length)%r.players.length];if(p&&p.alive)return p}return alive(r)[0]||null}
function endCheck(r){let a=alive(r);if(a.length<=1&&r.status==="playing"){r.status="finished";r.winnerId=a[0]?.id||null;clearTimeout(r.timer);emit(r);io.to(r.code).emit("notice",a[0]?`🏆 ${a[0].name} gana BOMB BLITZ.`:"Partida terminada.");return true}return false}
function turn(r,id){clearTimeout(r.timer);r.currentPlayerId=id;r.syllable=syllableNew();r.deadline=Date.now()+TURN_MS;emit(r);r.timer=setTimeout(()=>{if(r.status!=="playing"||r.currentPlayerId!==id)return;let p=r.players.find(x=>x.id===id);if(p&&p.alive){p.alive=false;io.to(r.code).emit("notice",`💥 ¡BOOM! ${p.name} se ha quedado sin tiempo.`)}if(endCheck(r))return;let n=next(r,id);if(n)turn(r,n.id)},TURN_MS)}
io.on("connection",s=>{
 s.emit("serverInfo",{dictionaryStatus,maxPlayers:MAX});
 s.on("createRoom",({name}={})=>{let c=codeNew();while(rooms.has(c))c=codeNew();let r={code:c,hostId:s.id,players:[{id:s.id,name:nameClean(name),alive:true,score:0}],status:"lobby",currentPlayerId:null,syllable:"",deadline:null,used:new Set(),winnerId:null,timer:null};rooms.set(c,r);s.join(c);s.data.roomCode=c;s.emit("joined",{code:c,playerId:s.id});emit(r)});
 s.on("joinRoom",({code,name}={})=>{code=String(code||"").toUpperCase().trim();let r=rooms.get(code);if(!r)return s.emit("errorMessage","No existe esa sala. Comprueba el código.");if(r.status!=="lobby")return s.emit("errorMessage","La partida ya ha empezado.");if(r.players.length>=MAX)return s.emit("errorMessage","Sala llena: máximo 4 jugadores.");r.players.push({id:s.id,name:nameClean(name),alive:true,score:0});s.join(code);s.data.roomCode=code;s.emit("joined",{code,playerId:s.id});io.to(code).emit("notice",`${nameClean(name)} se ha unido a la sala.`);emit(r)});
 s.on("startGame",()=>{let r=rooms.get(s.data.roomCode);if(!r)return;if(r.hostId!==s.id)return s.emit("errorMessage","Solo el anfitrión puede iniciar.");if(r.players.length<2)return s.emit("errorMessage","Necesitáis al menos 2 jugadores.");if(dictionaryStatus!=="ready"||!spell)return s.emit("errorMessage","El diccionario español aún no está listo. Espera y vuelve a intentarlo.");r.players.forEach(p=>{p.alive=true;p.score=0});r.used.clear();r.status="playing";r.winnerId=null;io.to(r.code).emit("notice","¡Partida iniciada! La bomba está activa.");turn(r,r.players[0].id)});
 s.on("submitWord",({word}={})=>{let r=rooms.get(s.data.roomCode);if(!r||r.status!=="playing")return;if(r.currentPlayerId!==s.id)return s.emit("errorMessage","No es tu turno.");let p=r.players.find(x=>x.id===s.id);if(!p||!p.alive)return;if(Date.now()>=r.deadline)return s.emit("errorMessage","¡Demasiado tarde!");if(!spell)return s.emit("errorMessage","Diccionario no disponible.");let w=wordClean(word);if(w.length<2)return s.emit("errorMessage","Escribe una palabra de al menos 2 letras.");if(!w.includes(r.syllable))return s.emit("errorMessage",`La palabra debe contener «${r.syllable}».`);if(r.used.has(w))return s.emit("errorMessage","Esa palabra ya se ha usado.");if(!spell.correct(w))return s.emit("errorMessage","El diccionario no reconoce esa palabra.");r.used.add(w);p.score++;io.to(r.code).emit("wordAccepted",{playerName:p.name,word:w});let n=next(r,p.id);if(n)turn(r,n.id)});
 s.on("disconnect",()=>{let c=s.data.roomCode,r=rooms.get(c);if(!r)return;let wasTurn=r.currentPlayerId===s.id,wasHost=r.hostId===s.id;r.players=r.players.filter(p=>p.id!==s.id);if(!r.players.length){clearTimeout(r.timer);rooms.delete(c);return}if(wasHost){r.hostId=r.players[0].id;io.to(c).emit("notice",`${r.players[0].name} ahora es anfitrión.`)}if(r.status==="playing"){if(endCheck(r))return;if(wasTurn){let n=next(r,s.id);if(n)turn(r,n.id)}else emit(r)}else emit(r)});
});
app.get("/health",(_,res)=>res.json({ok:true,dictionaryStatus,activeRooms:rooms.size}));
server.listen(PORT,()=>console.log(`BOMB BLITZ en http://localhost:${PORT}`));
