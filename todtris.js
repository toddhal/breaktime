 // ========== TODTRIS JavaScript by ChatGPT ==========

// ==== Config ====
const COLS = 10, ROWS = 20, BLOCK = 32;
const COLORS = [null,"#00FFFF","#0000FF","#FFA500","#FFD700","#800080","#00FF00","#FF0000"];
const SHAPES = {
  I: [[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],[[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]]],
  J: [[[2,0,0],[2,2,2],[0,0,0]],[[0,2,2],[0,2,0],[0,2,0]],[[0,0,0],[2,2,2],[0,0,2]],[[0,2,0],[0,2,0],[2,2,0]]],
  L: [[[0,0,3],[3,3,3],[0,0,0]],[[0,3,0],[0,3,0],[0,3,3]],[[0,0,0],[3,3,3],[3,0,0]],[[3,3,0],[0,3,0],[0,3,0]]],
  O: [[[4,4],[4,4]]],
  T: [[[0,5,0],[5,5,5],[0,0,0]],[[0,5,0],[0,5,5],[0,5,0]],[[0,0,0],[5,5,5],[0,5,0]],[[0,5,0],[5,5,0],[0,5,0]]],
  S: [[[0,6,6],[6,6,0],[0,0,0]],[[0,6,0],[0,6,6],[0,0,6]]],
  Z: [[[7,7,0],[0,7,7],[0,0,0]],[[0,0,7],[0,7,7],[0,7,0]]]
};
const PIECES = "IJLOSTZ";
const STORAGE_KEY = "todtris_scores";

// ==== Utility ====
function randomBag() {
  let bag = PIECES.split(""), res = [];
  while (bag.length) res.push(bag.splice(Math.floor(Math.random()*bag.length),1)[0]);
  return res;
}
function clone(mat) { return JSON.parse(JSON.stringify(mat)); }
function emptyBoard() { return Array.from({length:ROWS},()=>Array(COLS).fill(0)); }

// ==== Draw "TODTRIS" Title ====
(function drawTitle() {
  const titleDiv = document.getElementById("todtris-title");
  // Each letter is a small SVG made of colored Tetris blocks
  const LETTERS = {
    T:[[1,1,1],[0,1,0],[0,1,0]],
    O:[[1,1],[1,1]],
    D:[[1,1,0],[1,0,1],[1,1,0]],
    R:[[1,1,0],[1,0,1],[1,1,0],[1,0,1]],
    I:[[1],[1],[1]],
    S:[[1,1,1],[1,0,0],[0,0,1],[1,1,1]]
  };
  const COLORS = ["#800080","#FFD700","#FF0000","#00FFFF","#00FF00","#FFA500"];
  "TODTRIS".split("").forEach((ch,i)=>{
    const grid=LETTERS[ch],c=COLORS[i%COLORS.length];
    const scale=22;
    let svg = `<svg width="${grid[0].length*scale}" height="${grid.length*scale}">`;
    grid.forEach((row,y)=>row.forEach((cell,x)=>{
      if(cell)svg+=`<rect x="${x*scale}" y="${y*scale}" width="${scale}" height="${scale}" rx="4" fill="${c}" stroke="#fff" stroke-width="2"/>`;
    }));
    svg+="</svg>";
    const span=document.createElement("span");span.innerHTML=svg;
    titleDiv.appendChild(span);
  });
})();

// ==== Main Game Logic ====
let board = emptyBoard();
let piece = null, next = [], hold = null, canHold=true;
let bag = randomBag();
let score=0, lines=0, level=1;
let paused=false, over=false, frame=0, dropCounter=0, dropInterval=800;
let particles = [];
let awaitingHighScore = false;

// DOM elements
const canvas = document.getElementById("todtris-canvas");
const ctx = canvas.getContext("2d");
const holdCanvas = document.getElementById("todtris-hold");
const holdCtx = holdCanvas.getContext("2d");
const nextCanvas = document.getElementById("todtris-next");
const nextCtx = nextCanvas.getContext("2d");

function resetGame() {
  board = emptyBoard(); piece = null; next = []; hold = null; canHold=true;
  bag = randomBag(); score=0; lines=0; level=1; over=false; paused=false;
  awaitingHighScore=false;
  dropCounter=0; dropInterval=800;
  document.getElementById("todtris-score").textContent = score;
  document.getElementById("todtris-level").textContent = level;
  document.getElementById("todtris-lines").textContent = lines;
  next=[getNextPiece(),getNextPiece(),getNextPiece()];
  piece = getNextPiece();
  drawAll();
}

function getNextPiece() {
  if(bag.length===0) bag=randomBag();
  let type=bag.shift();
  let mat=clone(SHAPES[type][0]);
  return {type,mat,rot:0,pos:{x:Math.floor((COLS-mat[0].length)/2),y:0}};
}

function canMove(mat, pos) {
  for(let y=0;y<mat.length;y++)for(let x=0;x<mat[y].length;x++)
    if(mat[y][x]!==0){
      let bx=pos.x+x, by=pos.y+y;
      if(by<0)continue;
      if(bx<0||bx>=COLS||by>=ROWS) return false;
      if(board[by][bx]) return false;
    }
  return true;
}

function rotate(mat, dir) {
  let m=mat.length, n=mat[0].length, out=[];
  for(let y=0;y<n;y++){out[y]=[];
    for(let x=0;x<m;x++)out[y][x]=dir>0?mat[m-1-x][y]:mat[x][n-1-y];
  }
  return out;
}

function hardDrop() {
  let test = {...piece,pos:{...piece.pos}};
  while(canMove(test.mat,{x:test.pos.x,y:test.pos.y+1}))test.pos.y++;
  piece.pos.y=test.pos.y; lock();
}

function softDrop() {
  if(!move(0,1)) lock();
}

function move(dx, dy) {
  let newPos={x:piece.pos.x+dx,y:piece.pos.y+dy};
  if(canMove(piece.mat,newPos)) {piece.pos=newPos;drawAll();return true;}
  return false;
}

function tryRotate(dir) {
  const shapes=SHAPES[piece.type];
  let newRot=(piece.rot+dir+shapes.length)%shapes.length;
  let newMat=clone(shapes[newRot]);
  let tests=[0,-1,1,-2,2];
  for(let o of tests){
    let newPos={x:piece.pos.x+o,y:piece.pos.y};
    if(canMove(newMat,newPos)){
      piece.mat=newMat;piece.rot=newRot;piece.pos=newPos;drawAll();
      break;
    }
  }
}

function doHold() {
  if(!canHold)return;
  if(!hold){hold=clone(piece);piece=next.shift();next.push(getNextPiece());}
  else{
    let temp=clone(piece);piece=clone(hold);hold=clone(temp);
    piece.pos.x=Math.floor((COLS-piece.mat[0].length)/2);piece.pos.y=0;
  }
  canHold=false; drawAll();
}

function lock() {
  let isGameOver = false;
  piece.mat.forEach((row,y)=>{
    row.forEach((val,x)=>{
      if(val) {
        if(piece.pos.y+y<0) isGameOver=true;
        if(board[piece.pos.y+y]) board[piece.pos.y+y][piece.pos.x+x]=val;
      }
    });
  });
  // Clear lines
  let cleared=[];
  for(let y=ROWS-1;y>=0;y--){
    if(board[y].every(v=>v!==0)){
      cleared.push(y);
      board.splice(y,1); board.unshift(Array(COLS).fill(0));
      y++;
    }
  }
  // Particle effect for lines
  if(cleared.length>0) {
    for(let idx of cleared)
      for(let i=0;i<COLS;i++)
        for(let n=0;n<10;n++)
          particles.push({x:i,y:idx,dx:(Math.random()-.5)*6,dy:-Math.random()*4,color:COLORS[board[idx][i]||Math.ceil(Math.random()*7)],life:20+Math.random()*20});
  }
  score += [0,40,100,300,1200][cleared.length]*level;
  lines += cleared.length;
  if(lines/10>=level) level++;
  document.getElementById("todtris-score").textContent = score;
  document.getElementById("todtris-level").textContent = level;
  document.getElementById("todtris-lines").textContent = lines;
  piece=next.shift(); next.push(getNextPiece()); canHold=true;
  if(isGameOver) {
    over=true; drawAll();
    setTimeout(showGameOver,400);
  }
}

function showGameOver() {
  ctx.save();
  ctx.globalAlpha=0.9;
  ctx.fillStyle="#432";
  ctx.fillRect(0,canvas.height/3,canvas.width,80);
  ctx.globalAlpha=1.0;
  ctx.fillStyle="#FFD700";
  ctx.font="bold 40px Segoe UI,Arial,sans-serif";
  ctx.textAlign="center";
  ctx.fillText("GAME OVER!",canvas.width/2,canvas.height/3+48);
  ctx.font="22px Segoe UI,Arial,sans-serif";
  ctx.fillText("Press Enter to Restart",canvas.width/2,canvas.height/3+75);
  ctx.restore();
  // High score?
  if(isHighScore(score)) setTimeout(()=>showHighScoreModal(score),500);
}

function getGhostY() {
  let testY=piece.pos.y;
  while(canMove(piece.mat,{x:piece.pos.x,y:testY+1}))testY++;
  return testY;
}

// ==== Drawing ====
function drawAll() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // Draw board
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)
    if(board[y][x])drawBlock(x,y,board[y][x],1.0);
  // Draw ghost
  if(piece){
    let ghostY=getGhostY();
    drawMatrix(piece.mat,{x:piece.pos.x,y:ghostY},0.3);
    drawMatrix(piece.mat,piece.pos,1.0);
  }
  // Draw particles
  drawParticles();
  // Draw panel
  drawPanel();
}

function drawBlock(x,y,color,alpha=1.0) {
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.fillStyle=COLORS[color];
  ctx.fillRect(x*BLOCK,y*BLOCK,BLOCK,BLOCK);
  ctx.strokeStyle="#fff";
  ctx.lineWidth=2;
  ctx.strokeRect(x*BLOCK,y*BLOCK,BLOCK,BLOCK);
  ctx.restore();
}

function drawMatrix(mat, pos, alpha) {
  for(let y=0;y<mat.length;y++)for(let x=0;x<mat[y].length;x++)
    if(mat[y][x])drawBlock(pos.x+x,pos.y+y,mat[y][x],alpha);
}

function drawPanel() {
  // Hold
  holdCtx.clearRect(0,0,holdCanvas.width,holdCanvas.height);
  if(hold)drawMatrix(hold.mat,{x:1,y:1},1.0,holdCtx);
  // Next
  nextCtx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
  for(let i=0;i<next.length;i++)
    if(next[i])drawMatrixCtx(next[i].mat,{x:1,y:1+i*3},next[i].type,nextCtx);
}

function drawMatrixCtx(mat,pos,type,context) {
  for(let y=0;y<mat.length;y++)for(let x=0;x<mat[y].length;x++)
    if(mat[y][x]) {
      context.save();
      context.globalAlpha=1.0;
      context.fillStyle=COLORS[mat[y][x]];
      context.fillRect((pos.x+x)*24,(pos.y+y)*24,24,24);
      context.strokeStyle="#fff";
      context.lineWidth=2;
      context.strokeRect((pos.x+x)*24,(pos.y+y)*24,24,24);
      context.restore();
    }
}

function drawParticles() {
  for(let p of particles){
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life/40);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x*BLOCK+BLOCK/2, p.y*BLOCK+BLOCK/2, 8, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    p.x += p.dx*0.1;
    p.y += p.dy*0.1;
    p.dy += 0.15;
    p.life--;
  }
  particles = particles.filter(p=>p.life>0);
}

// ==== Animation Loop ====
function gameLoop(ts) {
  if(paused||over) return;
  frame++;
  dropCounter += 1000/60;
  if(dropCounter>dropInterval) {
    softDrop();
    dropCounter=0;
  }
  drawAll();
  requestAnimationFrame(gameLoop);
}
resetGame();
canvas.focus();
requestAnimationFrame(gameLoop);

// ==== Keyboard Controls ====
canvas.addEventListener("keydown",function(e){
  if(awaitingHighScore) return;
  if(over && e.key==="Enter"){ resetGame(); canvas.focus(); return;}
  if(paused && (e.key==="p"||e.key==="P")){ paused=false; requestAnimationFrame(gameLoop); return;}
  if(paused||over) return;
  switch(e.key) {
    case "ArrowLeft": move(-1,0); break;
    case "ArrowRight": move(1,0); break;
    case "ArrowDown": softDrop(); break;
    case "ArrowUp": tryRotate(1); break;
    case " ": hardDrop(); e.preventDefault(); break;
    case "h": case "H": doHold(); break;
    case "p": case "P": paused=true; drawAll(); break;
    case "l": case "L": showLeaderboard(); break;
    case "?": showControls(); break;
  }
});

// ==== UI/Buttons ====
document.getElementById("todtris-controls-btn").onclick = showControls;
document.getElementById("todtris-controls-close").onclick = () => modal("todtris-controls-modal", false);
document.getElementById("todtris-leaderboard-btn").onclick = showLeaderboard;
document.getElementById("todtris-leaderboard-close").onclick = () => modal("todtris-leaderboard-modal", false);
document.getElementById("todtris-restart-btn").onclick = () => {resetGame();canvas.focus();};

function showControls(){ modal("todtris-controls-modal", true);}
function showLeaderboard(){ updateLeaderboard(); modal("todtris-leaderboard-modal", true);}
function modal(id,show){document.getElementById(id).classList.toggle("show",show);}
document.addEventListener("keydown",function(e){
  if(e.key==="Escape") {
    modal("todtris-controls-modal",false);
    modal("todtris-leaderboard-modal",false);
    modal("todtris-highscore-modal",false);
  }
});

// ==== Leaderboard ====
function updateLeaderboard() {
  let list = document.getElementById("todtris-leaderboard-list");
  list.innerHTML="";
  let scores = JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
  scores.sort((a,b)=>b.score-a.score);
  scores.slice(0,10).forEach(entry=>{
    let li=document.createElement("li");
    li.innerHTML = `<b>${entry.name}</b>: ${entry.score}`;
    list.appendChild(li);
  });
}

function isHighScore(sc) {
  let scores = JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
  if(scores.length<10) return sc>0;
  return sc>scores[scores.length-1].score;
}

function showHighScoreModal(finalScore) {
  awaitingHighScore = true;
  document.getElementById("todtris-highscore-modal").classList.add("show");
  document.getElementById("todtris-highscore-input").value = "";
  document.getElementById("todtris-highscore-input").focus();
  document.getElementById("todtris-highscore-form").onsubmit = function(ev){
    ev.preventDefault();
    let name = document.getElementById("todtris-highscore-input").value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,3)||"???";
    let scores = JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
    scores.push({name,score:finalScore});
    scores.sort((a,b)=>b.score-a.score);
    scores = scores.slice(0,10);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(scores));
    document.getElementById("todtris-highscore-modal").classList.remove("show");
    showLeaderboard();
    awaitingHighScore=false;
    resetGame();
  };
}

// ==== Misc ====
document.getElementById("todtris-year").textContent = new Date().getFullYear();

// Focus canvas on click
canvas.addEventListener("click",()=>canvas.focus());
canvas.addEventListener("blur",()=>{if(!paused&&!over)paused=true;});
