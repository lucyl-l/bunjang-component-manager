const DESIGN_STAGES=['시작 전','구조 설계','MD 작성','컴포넌트 제작','디자인QA','완료'];
const DEV_STAGES=['시작 전','개발','코드리뷰','운영 적용','완료'];
const CAT_COLORS={Color:['#EDE7F6','#5E35B1'],Typography:['#E3F2FD','#1565C0'],Spacing:['#E8F5E9','#2E7D32'],Sizing:['#E0F7FA','#00838F'],Radius:['#FFF3E0','#E65100'],Layout:['#F3E5F5','#6A1B9A']};
const PRIORITIES=[{val:'상',cls:'p-high'},{val:'중',cls:'p-mid'},{val:'하',cls:'p-low'},{val:'완료',cls:'p-done'}];
const PRIORITY_CLS={상:'p-high',중:'p-mid',하:'p-low',완료:'p-done'};
const TOKEN_TYPES=[{val:'하드코딩',cls:'tt-hard'}];
const TOKEN_TYPE_CLS={컴포넌트:'tt-comp',시멘틱:'tt-sem',하드코딩:'tt-hard'};
let modalEditMode=false;
let preEditSnapshot=null;
let currentFilter={platform:'all',status:'all'};
function priorityTagHTML(p){const v=p||'중';return`<span class="priority-tag ${PRIORITY_CLS[v]||'p-mid'}">${v}</span>`}
function tokenTypesCellHTML(comp){
  const types=[];
  const hasSem=comp.tokens&&comp.tokens.some(t=>t.isSemantic);
  const hasHard=(comp.hardcoded&&comp.hardcoded.trim().length>0)||(comp.tokenTypes&&comp.tokenTypes.includes('하드코딩'));
  const totalTokens=comp.tokens?comp.tokens.length:0;
  const semTokens=comp.tokens?comp.tokens.filter(t=>t.isSemantic).length:0;
  const compTokens=totalTokens-semTokens;
  if(hasSem)types.push({text:`시멘틱 ${semTokens}`,cls:'tt-sem'});
  if(compTokens>0)types.push({text:`컴포넌트 ${compTokens}`,cls:'tt-default'});
  if(hasHard)types.push({text:'하드코딩',cls:'tt-hard'});
  if(!types.length)return'<span style="color:var(--text-3);font-size:12px">—</span>';
  return`<div class="token-types-cell">${types.map(t=>`<span class="token-type-tag ${t.cls}">${t.text}</span>`).join('')}</div>`;
}

let components=[];

let nextId=2,currentComp=null,activeTokenCat='All',openMenuIdx=null;
// ── Firebase ──────────────────────────────────────
const firebaseConfig={apiKey:"AIzaSyA3h9WiKhKvCVIDba7lJ2qfa49e2TAL2YQ",authDomain:"component-manager-dd394.firebaseapp.com",projectId:"component-manager-dd394",storageBucket:"component-manager-dd394.firebasestorage.app",messagingSenderId:"243911232640",appId:"1:243911232640:web:330329b71b91f868562a65"};
firebase.initializeApp(firebaseConfig);
const db=firebase.firestore();
let isModalOpen=false;
let tokensReplacedByJson=false;
function saveComp(comp){if(!comp)return;const data=JSON.parse(JSON.stringify(comp));db.collection('components').doc(String(comp.id)).set(data).catch(function(e){console.error('저장 오류:',e)});}
function deleteCompFromDB(id){db.collection('components').doc(String(id)).delete().catch(function(e){console.error('삭제 오류:',e)});}
function initFirebase(){
  document.getElementById('tableBody').innerHTML='<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-3);font-size:14px">데이터 불러오는 중...</td></tr>';
  db.collection('components').onSnapshot(function(snapshot){
    if(isModalOpen)return;
    components=snapshot.docs.map(function(doc){return doc.data()});
    components.sort(function(a,b){return a.id-b.id});
    nextId=components.length>0?Math.max.apply(null,components.map(function(c){return c.id}))+1:1;
    renderTable();renderStats();
  },function(err){console.error('Firestore 오류:',err);});
}
// ─────────────────────────────────────────────────

function getStatusClass(v){return v==='완료'?'s-done':v==='시작 전'?'s-not':'s-progress'}
function getStatusLabel(v){return v==='완료'||v==='시작 전'?v:v+' 중'}
function countDone(p){return components.filter(c=>c.status[p]==='완료').length}

function renderStats(){
  const t=components.length,tk=components.reduce((s,c)=>s+c.tokens.length,0);
  const plats=[{key:'design',label:'Design',c:'design'},{key:'ios',label:'iOS',c:'ios'},{key:'android',label:'Android',c:'android'},{key:'web',label:'Web',c:'web'}];
  const pi=plats.map(p=>{const d=countDone(p.key),pct=t?Math.round(d/t*100):0;return`<div class="progress-item"><div class="plat-label">${p.label}</div><div class="progress-bar"><div class="progress-fill progress-fill-${p.c}" style="width:${pct}%"></div></div><div class="progress-text">${d} / ${t}</div></div>`}).join('');
  document.getElementById('stats').innerHTML=`<div class="stat-card-main"><div class="stat-title">전체 컴포넌트</div><div class="stat-value">${t}<span style="font-size:18px;font-weight:500;color:var(--text-2);margin-left:2px">개</span></div><div class="stat-sub">토큰 ${tk}개</div></div><div class="stat-card-progress"><div class="stat-label">진행상황</div><div class="progress-grid">${pi}</div></div>`;
}

function toggleFilterMenu(){
  document.getElementById('filterMenu').classList.toggle('active');
}
function closeFilterMenu(){
  document.getElementById('filterMenu').classList.remove('active');
}
function setFilter(platform,status){
  currentFilter={platform,status};
  updateFilterLabel();
  renderTable();
  renderStats();
  closeFilterMenu();
}
function updateFilterLabel(){
  const btn=document.getElementById('filterBtn');
  if(currentFilter.platform==='all'&&currentFilter.status==='all'){
    btn.textContent='전체';
  }else if(currentFilter.platform==='all'){
    btn.textContent=currentFilter.status;
  }else{
    const platLabels={design:'Figma',ios:'iOS',android:'Android',web:'Web'};
    btn.textContent=platLabels[currentFilter.platform]+' · '+currentFilter.status;
  }
  updateFilterMenuHighlight();
}
function updateFilterMenuHighlight(){
  document.querySelectorAll('.filter-menu-item').forEach(function(item){
    item.classList.remove('active');
    var p=item.getAttribute('data-p');
    var s=item.getAttribute('data-s');
    if(p===currentFilter.platform&&s===currentFilter.status){
      item.classList.add('active');
    }
  });
}
function getFiltered(){
  const q=document.getElementById('search').value.toLowerCase();
  const{platform,status}=currentFilter;
  return components.filter(c=>{
    if(!c.name.toLowerCase().includes(q))return false;
    if(platform==='all'&&status==='all')return true;
    if(platform==='all'&&status!=='all'){
      return['design','ios','android','web'].some(p=>{const v=c.status[p];return status==='진행중'?v!=='시작 전'&&v!=='완료':v===status});
    }
    if(platform!=='all'&&status==='all')return true;
    const v=c.status[platform];
    return status==='진행중'?v!=='시작 전'&&v!=='완료':v===status;
  });
}

function renderTable(){
  const f=getFiltered();
  document.getElementById('emptyState').style.display=f.length?'none':'block';
  document.getElementById('tableBody').innerHTML=f.map(c=>{
    const d=c.updates.length?c.updates[0].split(' ')[0]:'';
    const dot=v=>`<span class="status-dot ${getStatusClass(v)}">${getStatusLabel(v)}</span>`;
    return`<tr onclick="openModal(${c.id})"><td class="gx-end"><div class="comp-name">${c.name}</div></td><td>${priorityTagHTML(c.priority)}</td><td class="gx-end">${tokenTypesCellHTML(c)}</td><td class="gx-end">${dot(c.status.design)}</td><td>${dot(c.status.ios)}</td><td>${dot(c.status.android)}</td><td class="gx-end">${dot(c.status.web)}</td><td class="col-update">${d}</td></tr>`;
  }).join('');
}

function openModal(id){
  isModalOpen=true;
  currentComp=components.find(c=>c.id===id);if(!currentComp)return;openMenuIdx=null;activeAddPropKey=null;
  if(!currentComp.priority)currentComp.priority='중';
  if(!currentComp.tokenTypes)currentComp.tokenTypes=[];
  if(currentComp.hardcoded==null)currentComp.hardcoded='';
  modalEditMode=false;
  preEditSnapshot=JSON.parse(JSON.stringify(currentComp));
  document.getElementById('modalTitle').textContent=currentComp.name;
  document.getElementById('editModeBtn').style.display='none';
  document.getElementById('editModeBtn2').textContent='수정';document.getElementById('deleteCompBtn').style.display='none';
  /*editModeFooterBtn removed*/
  document.getElementById('deleteCompBtn').style.display='none';
  renderPriority();renderTokenSummary();
  const plats=[{key:'design',label:'Design',stages:DESIGN_STAGES},{key:'ios',label:'iOS',stages:DEV_STAGES},{key:'android',label:'Android',stages:DEV_STAGES},{key:'web',label:'Web',stages:DEV_STAGES}];
  document.getElementById('modalPlatforms').innerHTML=plats.map(p=>{
    if(modalEditMode){
      const o=p.stages.map(s=>`<option value="${s}" ${currentComp.status[p.key]===s?'selected':''}>${getStatusLabel(s)}</option>`).join('');
      return`<div class="platform-card"><div class="label">${p.label}</div><select onchange="updateStatus('${p.key}',this.value)">${o}</select></div>`;
    }else{
      const v=currentComp.status[p.key];
      const cls=v==='완료'?'s-done':v==='시작 전'?'s-not':'s-progress';
      return`<div class="platform-card"><div class="label">${p.label}</div><div style="padding:4px 0"><span class="status-dot ${cls}">${getStatusLabel(v)}</span></div></div>`;
    }
  }).join('');
  renderProps();
  activeTokenCat='All';renderTokenTabs();renderTokenList();renderDodont();renderNote();renderHardcoded();
  renderUpdates();
  document.getElementById('overlay').classList.add('active');
}
function toggleEditMode(){
  if(!modalEditMode){
    modalEditMode=true;
    document.getElementById('editModeBtn').textContent='수정 완료';document.getElementById('editModeBtn2').textContent='수정 완료';document.getElementById('deleteCompBtn').style.display='block';
    /*editModeFooterBtn removed*/
    document.getElementById('deleteCompBtn').style.display='block';
    preEditSnapshot=JSON.parse(JSON.stringify(currentComp));
  }else{
    modalEditMode=false;
    document.getElementById('editModeBtn').textContent='수정';document.getElementById('editModeBtn2').textContent='수정';document.getElementById('deleteCompBtn').style.display='none';
    /*editModeFooterBtn removed*/
    document.getElementById('deleteCompBtn').style.display='none';
    compareAndLogChanges();
    tokensReplacedByJson=false;
    saveComp(currentComp);
  }
  renderPriority();renderProps();renderDodont();renderNote();renderTokenList();renderHardcoded();
  const plats=[{key:'design',label:'Design',stages:DESIGN_STAGES},{key:'ios',label:'iOS',stages:DEV_STAGES},{key:'android',label:'Android',stages:DEV_STAGES},{key:'web',label:'Web',stages:DEV_STAGES}];
  document.getElementById('modalPlatforms').innerHTML=plats.map(p=>{
    if(modalEditMode){
      const o=p.stages.map(s=>`<option value="${s}" ${currentComp.status[p.key]===s?'selected':''}>${getStatusLabel(s)}</option>`).join('');
      return`<div class="platform-card"><div class="label">${p.label}</div><select onchange="updateStatus('${p.key}',this.value)">${o}</select></div>`;
    }else{
      const v=currentComp.status[p.key];
      const cls=v==='완료'?'s-done':v==='시작 전'?'s-not':'s-progress';
      return`<div class="platform-card"><div class="label">${p.label}</div><div style="padding:4px 0"><span class="status-dot ${cls}">${getStatusLabel(v)}</span></div></div>`;
    }
  }).join('');
  renderTable();renderUpdates();renderStats();
}

function compareAndLogChanges(){
  if(!preEditSnapshot)return;
  const d=new Date().toISOString().slice(0,10);
  const changes=[];
  if(preEditSnapshot.priority!==currentComp.priority){changes.push('우선순위 '+(preEditSnapshot.priority||'중')+' → '+currentComp.priority);}
  if(JSON.stringify(preEditSnapshot.status)!==JSON.stringify(currentComp.status)){
    Object.keys(currentComp.status).forEach(function(k){
      if(preEditSnapshot.status[k]!==currentComp.status[k]){
        var label=k==='design'?'Design':k==='ios'?'iOS':k==='android'?'Android':'Web';
        changes.push(label+' '+preEditSnapshot.status[k]+' → '+currentComp.status[k]);
      }
    });
  }
  if(JSON.stringify(preEditSnapshot.props)!==JSON.stringify(currentComp.props)){changes.push('Props 수정');}
  if(!tokensReplacedByJson&&JSON.stringify(preEditSnapshot.tokens)!==JSON.stringify(currentComp.tokens)){
    var oldT=preEditSnapshot.tokens||[];var newT=currentComp.tokens||[];
    var oldNames=oldT.map(function(t){return t.name});var newNames=newT.map(function(t){return t.name});
    var deleted=oldT.filter(function(t){return newNames.indexOf(t.name)<0});
    var added=newT.filter(function(t){return oldNames.indexOf(t.name)<0});
    if(deleted.length)changes.push('토큰 삭제: '+deleted.map(function(t){return t.name}).join(', '));
    if(added.length)changes.push('토큰 추가: '+added.map(function(t){return t.name}).join(', '));
    var modified=[];
    oldT.forEach(function(ot){
      var nt=newT.find(function(x){return x.name===ot.name});
      if(!nt)return;
      if(ot.desc!==nt.desc){modified.push(ot.name+': 값 '+ot.desc+' → '+nt.desc);}
      if(ot.cat!==nt.cat){modified.push(ot.name+': 카테고리 '+ot.cat+' → '+nt.cat);}
    });
    if(modified.length)changes.push('토큰 내용 변경: '+modified.join(', '));
    var semChanged=[];
    oldT.forEach(function(ot){
      var nt=newT.find(function(x){return x.name===ot.name});
      if(nt&&ot.isSemantic!==nt.isSemantic)semChanged.push(nt.name);
    });
    var finalSem=newT.filter(function(t){return t.isSemantic}).map(function(t){return t.name});
    if(semChanged.length){
      var toSem=semChanged.filter(function(n){return finalSem.indexOf(n)>=0});
      var toComp=semChanged.filter(function(n){return finalSem.indexOf(n)<0});
      if(toSem.length)changes.push('시멘틱으로 변경: '+toSem.join(', '));
      if(toComp.length)changes.push('컴포넌트로 변경: '+toComp.join(', '));
    }
    var renamed=[];
    oldT.forEach(function(ot){
      if(newNames.indexOf(ot.name)>=0)return;
      newT.forEach(function(nt){
        if(oldNames.indexOf(nt.name)>=0)return;
        if(ot.desc===nt.desc&&ot.cat===nt.cat){renamed.push(ot.name+' → '+nt.name);}
      });
    });
    if(renamed.length)changes.push('토큰 이름 변경: '+renamed.join(', '));
  }
  if(JSON.stringify(preEditSnapshot.dodont)!==JSON.stringify(currentComp.dodont)){changes.push("Do/Don't 수정");}
  if((preEditSnapshot.note||'')!==(currentComp.note||'')){changes.push('비고 수정');}
  if((preEditSnapshot.hardcoded||'')!==(currentComp.hardcoded||'')){changes.push('하드코딩 수정');}
  if(changes.length>0){
    currentComp.updates.unshift(d+' '+changes.join('\n'));
  }
}
function renderPriority(){
  const cur=currentComp.priority||'중';
  document.getElementById('modalPriority').innerHTML=PRIORITIES.map(p=>`<button class="pill-btn ${p.cls} ${cur===p.val?'active':''}" ${modalEditMode?`onclick="setPriority('${p.val}')"`:''} ${!modalEditMode?'style="cursor:default;pointer-events:none"':''}>${p.val}</button>`).join('');
}
function setPriority(p){
  if(!currentComp||!modalEditMode)return;
  if(currentComp.priority===p)return;
  currentComp.priority=p;
  renderPriority();
}
function renderTokenSummary(){
  const hasSem=currentComp.tokens&&currentComp.tokens.some(t=>t.isSemantic);
  const hasHard=(currentComp.hardcoded&&currentComp.hardcoded.trim().length>0)||(currentComp.tokenTypes&&currentComp.tokenTypes.includes('하드코딩'));
  const totalTokens=currentComp.tokens?currentComp.tokens.length:0;
  const semTokens=currentComp.tokens?currentComp.tokens.filter(t=>t.isSemantic).length:0;
  const compTokens=totalTokens-semTokens;
  const types=[];
  if(hasSem)types.push({text:`시멘틱 ${semTokens}`,cls:'tt-sem'});
  if(compTokens>0)types.push({text:`컴포넌트 ${compTokens}`,cls:'tt-default'});
  if(!hasSem&&compTokens===0&&!hasHard)types.push({text:`컴포넌트 ${totalTokens}개`,cls:'tt-default'});
  if(hasHard)types.push({text:'하드코딩',cls:'tt-hard'});
  const el=document.getElementById('modalTokenSummary');
  if(!types.length){el.innerHTML='<span style="color:var(--text-3);font-size:13px">—</span>';return}
  el.innerHTML=`<div class="pill-group">${types.map(t=>`<span class="token-type-tag ${t.cls}" style="padding:7px 14px;font-size:13px;font-weight:500;border-radius:20px;line-height:1">${t.text}</span>`).join('')}</div>`;
}
function renderHardcoded(){
  var c=document.getElementById('hardcodedContainer');
  if(!currentComp.hardcoded||!currentComp.hardcoded.trim()){
    if(modalEditMode){c.innerHTML='<button class="btn-add-note" onclick="showHardcodedInput()">+ 하드코딩 내용 추가</button>';}
    else{c.innerHTML='<div style="color:var(--text-3);font-size:14px">하드코딩 된 부분 없음</div>';}
    return;
  }
  c.innerHTML='<div class="note-display">'+currentComp.hardcoded+'</div>'+(modalEditMode?'<div class="note-actions"><button class="btn" onclick="showHardcodedInput()">수정</button><button class="btn" onclick="deleteHardcoded()" style="color:var(--text-3)">삭제</button></div>':'');
}
function showHardcodedInput(){
  document.getElementById('hardcodedContainer').innerHTML=`<textarea class="note-area" id="hardcodedInput" placeholder="하드코딩된 색상, 사이즈, 값 등을 자유롭게 작성...">${currentComp.hardcoded||''}</textarea><div class="note-actions"><button class="btn" onclick="renderHardcoded()">취소</button><button class="btn btn-primary" onclick="saveHardcoded()">저장</button></div>`;
  document.getElementById('hardcodedInput').focus();
}
function saveHardcoded(){
  currentComp.hardcoded=document.getElementById('hardcodedInput').value.trim();
  renderHardcoded();renderTokenSummary();
}
function deleteHardcoded(){currentComp.hardcoded='';renderHardcoded();renderTokenSummary();}

// Props CRUD
let openPropMenuIdx=null,activeAddPropKey=null;
function renderProps(){
  const entries=Object.entries(currentComp.props);
  const el=document.getElementById('modalProps');
  const PROP_HANDLE_SVG='<svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor"><circle cx="2.5" cy="2.5" r="1.6"/><circle cx="7.5" cy="2.5" r="1.6"/><circle cx="2.5" cy="9" r="1.6"/><circle cx="7.5" cy="9" r="1.6"/><circle cx="2.5" cy="15.5" r="1.6"/><circle cx="7.5" cy="15.5" r="1.6"/></svg>';
  el.innerHTML=entries.map(([k,v],i)=>{
    const inner=`<div class="prop-row" style="position:relative"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><span class="prop-name">${modalEditMode?`<input type="text" value="${k}" style="font-weight:600;font-size:14px;background:transparent;border:none;outline:none;padding:0;width:120px" onchange="renameProp('${k}',this.value)">`:`${k}`}</span>${modalEditMode?`<button style="width:20px;height:20px;padding:0;border:none;background:transparent;color:#bbb;cursor:pointer;font-size:16px;flex-shrink:0" onclick="event.stopPropagation();deleteProp(${i})">✕</button>`:''}</div><div class="prop-values">${v.map((x,j)=>`<span class="prop-val">${x}${modalEditMode?`<span class="chip-x" onclick="event.stopPropagation();confirmDeleteOption('${k}',${j})">&#215;</span>`:''}</span>`).join('')}${modalEditMode?`<span class="prop-add-chip" onclick="event.stopPropagation();showOptionInput('${k}')">+</span>`:''}</div>${activeAddPropKey===k&&modalEditMode?`<div class="prop-add-form-row" onclick="event.stopPropagation()"><input id="addOptInput" placeholder="옵션 입력 후 Enter"><button class="btn btn-primary" onclick="addOptionTo('${k}')">추가</button><button class="btn" onclick="cancelOptionAdd()">취소</button></div>`:''}${openPropMenuIdx===i&&modalEditMode?`<div class="meatball-menu" style="top:36px;right:8px" onclick="event.stopPropagation()"><button onclick="deleteProp(${i})">삭제</button></div>`:''}</div>`;
    if(modalEditMode){
      return `<div class="prop-wrap" draggable="true" ondragstart="propDragStart(event,${i})" ondragover="propDragOver(event,${i})" ondragleave="propDragLeave(event)" ondrop="propDrop(event,${i})" ondragend="propDragEnd(event)"><span class="prop-drag-handle" title="드래그해서 순서 변경">${PROP_HANDLE_SVG}</span>${inner}</div>`;
    }
    return inner;
  }).join('');
  document.getElementById('propsAddArea').innerHTML=`<div id="addPropForm"></div>${modalEditMode?`<button class="btn-add-note" style="margin-top:8px" onclick="showAddPropForm()">+ Props 추가</button>`:''}`;
  if(activeAddPropKey){const inp=document.getElementById('addOptInput');if(inp){inp.focus();inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addOptionTo(activeAddPropKey)}else if(e.key==='Escape')cancelOptionAdd()})}}
}

function togglePropMenu(i){openPropMenuIdx=openPropMenuIdx===i?null:i;renderProps()}
function deleteProp(i){
  const keys=Object.keys(currentComp.props);const key=keys[i];
  openPropMenuIdx=null;
  document.getElementById('confirmOverlay').classList.add('active');
  document.querySelector('.confirm-dialog h3').textContent=`'${key}' Props를 삭제할까요?`;
  document.querySelector('.confirm-dialog p').textContent='이 Props에 등록된 모든 옵션이 함께 삭제됩니다.';
  document.querySelector('.btn-confirm-delete').onclick=function(){delete currentComp.props[key];closeDeleteConfirm();renderProps()};
}
function confirmDeleteOption(propKey,optIdx){
  document.getElementById('confirmOverlay').classList.add('active');
  document.querySelector('.confirm-dialog h3').textContent='옵션을 삭제할까요?';
  document.querySelector('.confirm-dialog p').textContent='삭제하면 되돌릴 수 없습니다.';
  document.querySelector('.btn-confirm-delete').onclick=function(){currentComp.props[propKey].splice(optIdx,1);if(!currentComp.props[propKey].length)delete currentComp.props[propKey];closeDeleteConfirm();renderProps()};
}
function resetConfirmDialog(){document.querySelector('.confirm-dialog h3').textContent='컴포넌트를 삭제할까요?';document.querySelector('.confirm-dialog p').textContent='삭제하면 되돌릴 수 없습니다.';document.querySelector('.btn-cancel').textContent='취소';document.querySelector('.btn-confirm-delete').textContent='삭제';document.querySelector('.btn-confirm-delete').style.background='#E53935';document.querySelector('.btn-confirm-delete').onclick=function(){confirmDeleteComp()}}
function showOptionInput(propKey){activeAddPropKey=propKey;openPropMenuIdx=null;renderProps()}
function addOptionTo(propKey){
  const inp=document.getElementById('addOptInput');if(!inp)return;
  const v=inp.value.trim();
  if(!v)return;
  inp.value='';
  currentComp.props[propKey].push(v);
  activeAddPropKey=propKey;
  setTimeout(function(){renderProps()},0);
}
function cancelOptionAdd(){activeAddPropKey=null;renderProps()}
function showAddPropForm(){
  document.getElementById('addPropForm').innerHTML=`<div style="display:flex;gap:8px;margin-top:12px;margin-bottom:8px;align-items:center"><input id="newPropKey" placeholder="Props명" style="width:140px;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:14px;outline:none"><input id="newPropVals" placeholder="옵션 (쉼표 구분)" style="flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:14px;outline:none"><button class="btn btn-primary" style="padding:8px 14px;font-size:13px;flex-shrink:0" onclick="addPropToComp()">추가</button><button class="btn" style="padding:8px 14px;font-size:13px;flex-shrink:0" onclick="renderProps()">취소</button></div>`;
  document.getElementById('newPropKey').focus();
}
function addPropToComp(){
  const k=document.getElementById('newPropKey').value.trim();const v=document.getElementById('newPropVals').value.split(',').map(s=>s.trim()).filter(Boolean);
  if(k&&v.length){currentComp.props[k]=v;renderProps()}
}

// Props drag-to-reorder
let draggedPropIdx=null;
function propDragStart(e,i){draggedPropIdx=i;e.currentTarget.classList.add('prop-dragging');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',String(i))}catch(_){}}
function propDragOver(e,i){e.preventDefault();e.dataTransfer.dropEffect='move';document.querySelectorAll('.prop-wrap.prop-drag-over').forEach(el=>el.classList.remove('prop-drag-over'));e.currentTarget.classList.add('prop-drag-over')}
function propDragLeave(e){e.currentTarget.classList.remove('prop-drag-over')}
function propDrop(e,i){e.preventDefault();document.querySelectorAll('.prop-wrap.prop-drag-over').forEach(el=>el.classList.remove('prop-drag-over'));if(draggedPropIdx===null||draggedPropIdx===i){draggedPropIdx=null;return}const entries=Object.entries(currentComp.props);const[removed]=entries.splice(draggedPropIdx,1);entries.splice(i,0,removed);currentComp.props=Object.fromEntries(entries);draggedPropIdx=null;renderProps()}
function propDragEnd(e){e.currentTarget.classList.remove('prop-dragging');document.querySelectorAll('.prop-wrap.prop-drag-over').forEach(el=>el.classList.remove('prop-drag-over'));draggedPropIdx=null}

// Token drag-to-reorder
let draggedTokIdx=null;
function tokDragStart(e,i){draggedTokIdx=i;e.currentTarget.classList.add('token-dragging');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',String(i))}catch(_){}}
function tokDragOver(e,i){e.preventDefault();e.dataTransfer.dropEffect='move';document.querySelectorAll('.token-wrap.token-drag-over').forEach(el=>el.classList.remove('token-drag-over'));e.currentTarget.classList.add('token-drag-over')}
function tokDragLeave(e){e.currentTarget.classList.remove('token-drag-over')}
function tokDrop(e,i){e.preventDefault();document.querySelectorAll('.token-wrap.token-drag-over').forEach(el=>el.classList.remove('token-drag-over'));if(draggedTokIdx===null||draggedTokIdx===i){draggedTokIdx=null;return}const arr=currentComp.tokens;const[removed]=arr.splice(draggedTokIdx,1);arr.splice(i,0,removed);draggedTokIdx=null;renderTokenTabs();renderTokenList();}
function tokDragEnd(e){e.currentTarget.classList.remove('token-dragging');document.querySelectorAll('.token-wrap.token-drag-over').forEach(el=>el.classList.remove('token-drag-over'));draggedTokIdx=null}

// Do/Don't CRUD
let draggedDodontIdx=null;
const HANDLE_HTML='<span class="drag-handle" title="드래그해서 순서 변경"><svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor"><circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/><circle cx="2" cy="7" r="1"/><circle cx="6" cy="7" r="1"/><circle cx="2" cy="12" r="1"/><circle cx="6" cy="12" r="1"/></svg></span>';
function renderDodont(){
  const el=document.getElementById('modalDodont');
  if(!el)return;
  if(!currentComp.dodont.length){el.innerHTML='<div style="color:var(--text-3);font-size:14px;padding:8px">아직 등록된 가이드라인이 없습니다</div>';}
  else{
    el.innerHTML=currentComp.dodont.map(function(d,i){
      var label=d.type==='do'?'DO':'DON’T';
      var safeText=(d.text||'').replace(/"/g,'&quot;');
      var delBtn=modalEditMode?'<button style="width:20px;height:20px;padding:0;border:none;background:transparent;color:#bbb;cursor:pointer;font-size:16px;flex-shrink:0" onclick="event.stopPropagation();deleteDodont('+i+')">✕</button>':'';
      var imgSlot='';
      if(d.image){
        imgSlot='<div style="flex-shrink:0"><img src="'+d.image+'" class="dodont-image" onclick="openImgLightbox(this.src)"></div>';
      } else if(modalEditMode){
        imgSlot='<label class="dodont-img-placeholder"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="5" width="18" height="13" rx="2.5"/><circle cx="10" cy="12" r="3"/><path d="M6.5 5L8 2.5h4L13.5 5" stroke-linejoin="round"/></svg><input type="file" id="ddDetailImg'+i+'" accept="image/*" style="display:none" onchange="handleDetailDdImage(event,'+i+')"></label>';
      } else {
        imgSlot='<div style="width:64px;flex-shrink:0"></div>';
      }
      var textBlock='<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:3px;min-width:0"><span style="font-size:10px;font-weight:600;letter-spacing:.5px;opacity:.4">'+label+'</span><input type="text" class="dodont-text-input" value="'+safeText+'" '+(modalEditMode?'':'readonly')+' style="padding:0;background:transparent;border:none;outline:none;font-size:14px;font-weight:500;cursor:'+(modalEditMode?'text':'default')+';min-width:0" onclick="event.stopPropagation()" onchange="editDodontText('+i+',this.value)"></div>';
      return '<div style="display:flex;align-items:center;gap:6px"><div class="dodont-item dodont-'+d.type+'" draggable="true" ondragstart="ddDragStart(event,'+i+')" ondragover="ddDragOver(event)" ondragleave="ddDragLeave(event)" ondrop="ddDrop(event,'+i+')" ondragend="ddDragEnd(event)" style="flex:1">'+HANDLE_HTML+textBlock+imgSlot+'</div>'+delBtn+'</div>';
    }).join('');
  }
  const addArea=document.getElementById('dodontAddArea');if(addArea)addArea.innerHTML='<div id="addDodontForm"></div>'+(modalEditMode?'<button class="btn-add-note" style="margin-top:8px" onclick="showAddDodontForm()">+ Do/Don\'t 추가</button>':'');
}

function ddDragStart(e,idx){draggedDodontIdx=idx;e.currentTarget.classList.add('dragging');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',String(idx))}catch(_){}}
function ddDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move';document.querySelectorAll('.dodont-item.drag-over').forEach(el=>el.classList.remove('drag-over'));e.currentTarget.classList.add('drag-over')}
function ddDragLeave(e){e.currentTarget.classList.remove('drag-over')}
function ddDrop(e,idx){e.preventDefault();document.querySelectorAll('.dodont-item.drag-over').forEach(el=>el.classList.remove('drag-over'));if(draggedDodontIdx===null||draggedDodontIdx===idx){draggedDodontIdx=null;return}const item=currentComp.dodont.splice(draggedDodontIdx,1)[0];currentComp.dodont.splice(idx,0,item);draggedDodontIdx=null;renderDodont()}
function ddDragEnd(e){e.currentTarget.classList.remove('dragging');document.querySelectorAll('.dodont-item.drag-over').forEach(el=>el.classList.remove('drag-over'));draggedDodontIdx=null}
let currentDodontImageData=null;
function showAddDodontForm(){
  currentDodontImageData=null;
  document.getElementById('addDodontForm').innerHTML=`<div class="dodont-entry" style="margin-top:12px;margin-bottom:8px;display:flex;flex-direction:column;gap:8px"><div style="display:flex;gap:6px"><select id="newDdType" style="padding:10px 28px 10px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:14px;background:var(--surface);width:140px;-webkit-appearance:none;appearance:none;background-image:url(&quot;data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E&quot;);background-repeat:no-repeat;background-position:right 10px center;cursor:pointer;outline:none"><option value="do">DO</option><option value="dont">DON'T</option></select><input id="newDdText" placeholder="내용 입력" style="flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:14px;outline:none"><button class="btn btn-primary" style="padding:8px 14px;font-size:13px;flex-shrink:0" onclick="addDodontToComp()">추가</button><button class="btn" style="padding:8px 14px;font-size:13px;flex-shrink:0" onclick="renderDodont()">취소</button></div><label id="newDdImageLabel" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border:1px dashed var(--border);border-radius:var(--radius-sm);font-size:13px;cursor:pointer;color:var(--text-3);background:transparent;transition:border-color .15s,color .15s" onmouseover="this.style.borderColor='#1a1a1a';this.style.color='#1a1a1a'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-3)'"><svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" style="flex-shrink:0"><rect x="1" y="5" width="18" height="13" rx="2.5"/><circle cx="10" cy="12" r="3"/><path d="M6.5 5L8 2.5h4L13.5 5" stroke-linejoin="round"/></svg>이미지 추가<input type="file" id="newDdImage" accept="image/*" onchange="handleDodontImageUpload(event)" style="display:none"></label><div id="dodontImagePreview"></div></div>`;
  document.getElementById('newDdText').focus();
}
function handleDodontImageUpload(e){
  const file=e.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(event){
    currentDodontImageData=event.target.result;
    const preview=document.getElementById('dodontImagePreview');
    preview.innerHTML=`<div style="margin-top:6px"><img src="${currentDodontImageData}" class="dodont-image" style="max-width:200px"><button class="btn" style="padding:5px 10px;font-size:12px;margin-top:4px" onclick="currentDodontImageData=null;document.getElementById('dodontImagePreview').innerHTML='';document.getElementById('newDdImage').value=''">이미지 제거</button></div>`;
  };
  reader.readAsDataURL(file);
}
function addDodontToComp(){
  const type=document.getElementById('newDdType').value;const text=document.getElementById('newDdText').value.trim();
  if(text){currentComp.dodont.push({type,text,image:currentDodontImageData||''});currentDodontImageData=null;renderDodont()}
}
function toggleDodontMenu(i){openMenuIdx=openMenuIdx===i?null:i;renderDodont()}
function deleteDodont(i){currentComp.dodont.splice(i,1);openMenuIdx=null;renderDodont()}
function showDodontImageUpload(i){
  currentDodontImageData=currentComp.dodont[i].image||'';
  const el=document.getElementById('modalDodont');
  const dd=currentComp.dodont[i];
  el.innerHTML=currentComp.dodont.map((d,idx)=>{
    if(idx===i)return`<div class="dodont-entry" style="margin-bottom:6px;display:flex;flex-direction:column;gap:8px"><div style="display:flex;gap:6px"><select id="editDdType"><option value="do" ${d.type==='do'?'selected':''}>DO</option><option value="dont" ${d.type==='dont'?'selected':''}>DON'T</option></select><input id="editDdText" value="${d.text}" style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;outline:none"><button class="btn" style="padding:5px 12px;font-size:12px" onclick="saveDodontEdit(${i})">저장</button><button class="btn" style="padding:5px 12px;font-size:12px" onclick="renderDodont()">취소</button></div><input type="file" id="editDdImage" accept="image/*" onchange="handleEditDodontImageUpload(event)" style="padding:6px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;cursor:pointer"><div id="editDodontImagePreview">${d.image?`<img src="${d.image}" class="dodont-image" style="max-width:200px;margin-top:8px">`:''}</div></div>`;
    return`<div class="dodont-item dodont-${d.type}">${HANDLE_HTML}<span class="dodont-text">${d.type==='do'?'DO':"DON'T"}: ${d.text}</span></div>`;
  }).join('');
}
function handleDetailDdImage(e,i){var file=e.target.files[0];if(!file||!currentComp)return;var reader=new FileReader();reader.onload=function(ev){currentComp.dodont[i].image=ev.target.result;renderDodont()};reader.readAsDataURL(file)}

function handleEditDodontImageUpload(e){
  const file=e.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(event){
    currentDodontImageData=event.target.result;
    const preview=document.getElementById('editDodontImagePreview');
    preview.innerHTML=`<img src="${currentDodontImageData}" class="dodont-image" style="max-width:200px;margin-top:8px"><button class="btn" style="padding:5px 10px;font-size:12px;margin-left:8px" onclick="currentDodontImageData='';document.getElementById('editDodontImagePreview').innerHTML='';document.getElementById('editDdImage').value=''">제거</button>`;
  };
  reader.readAsDataURL(file);
}
function editDodont(i){
  showDodontImageUpload(i);
}
function saveDodontEdit(i){currentComp.dodont[i].type=document.getElementById('editDdType').value;currentComp.dodont[i].text=document.getElementById('editDdText').value.trim();currentComp.dodont[i].image=currentDodontImageData||currentComp.dodont[i].image||'';renderDodont()}

function renderNote(){
  var c=document.getElementById('noteContainer');
  if(modalEditMode){
    c.innerHTML='<textarea class="note-area" id="noteInput" placeholder="메모, 블로커, 논의 사항..." oninput="currentComp.note=this.value">'+(currentComp.note||'')+'</textarea>';
  }else{
    if(!currentComp.note){c.innerHTML='';return;}
    c.innerHTML='<div class="note-display">'+currentComp.note+'</div>';
  }
}
function showNoteInput(){document.getElementById('noteContainer').innerHTML=`<textarea class="note-area" id="noteInput" placeholder="메모, 블로커, 논의 사항...">${currentComp.note||''}</textarea><div class="note-actions"><button class="btn" onclick="renderNote()">취소</button><button class="btn btn-primary" onclick="saveNote()">저장</button></div>`;document.getElementById('noteInput').focus()}
function saveNote(){currentComp.note=document.getElementById('noteInput').value.trim();renderNote()}
function deleteNote(){currentComp.note='';renderNote()}

function getTokenGroup(desc){const m=(desc||'').replace(/[{}]/g,'').split('.')[0].toLowerCase();return m||'기타';}
function renderTokenTabs(){
  const cats=['All',...new Set(currentComp.tokens.map(t=>getTokenGroup(t.desc)))];
  document.getElementById('tokenTabs').innerHTML=cats.map(c=>`<button class="token-tab ${c===activeTokenCat?'active':''}" data-cat="${c}" onclick="filterTokens('${c}')">${c==='All'?'전체':c} <span style="opacity:.5">${c==='All'?currentComp.tokens.length:currentComp.tokens.filter(t=>getTokenGroup(t.desc)===c).length}</span></button>`).join('');
}
let openTokenMenuIdx=null;
function renderTokenList(){
  var f=(activeTokenCat==='All'?currentComp.tokens:currentComp.tokens.filter(function(t){return getTokenGroup(t.desc)===activeTokenCat})).slice().sort(function(a,b){return getTokenGroup(a.desc).localeCompare(getTokenGroup(b.desc));});
  var html='',lastCat='';
  var maxNameLen=f.reduce(function(mx,t){return Math.max(mx,t.name.length)},0);
  var nameChWidth=Math.max(maxNameLen*7.5+24, 200);
  f.forEach(function(t,i){
    var realIdx=currentComp.tokens.indexOf(t);
    var tGroup=getTokenGroup(t.desc);if(activeTokenCat==='All'&&tGroup!==lastCat){html+='<div class="token-cat-heading">'+tGroup+'</div>';lastCat=tGroup}
    var safeN=t.name.replace(/"/g,'&quot;');
    var safeD=t.desc.replace(/"/g,'&quot;');
    if(modalEditMode){
      var compSel=!t.isSemantic;
      var semSel=t.isSemantic;
      var compStyle='padding:1px 6px;font-size:10px;border-radius:8px;cursor:pointer;border:1px solid '+(compSel?'#D0D0D0':'var(--border)')+';background:'+(compSel?'#F0F0F0':'transparent')+';color:'+(compSel?'#333':'var(--text-3)')+';font-weight:'+(compSel?'600':'400');
      var semStyle='padding:1px 6px;font-size:10px;border-radius:8px;cursor:pointer;border:1px solid '+(semSel?'#B3E5FC':'var(--border)')+';background:'+(semSel?'#E1F5FE':'transparent')+';color:'+(semSel?'#0277BD':'var(--text-3)')+';font-weight:'+(semSel?'600':'400');
      var chips='<span style="display:inline-flex;gap:4px;margin-bottom:4px">'
        +'<span style="'+compStyle+'" onclick="event.stopPropagation();if(currentComp.tokens['+realIdx+'].isSemantic){currentComp.tokens['+realIdx+'].isSemantic=false;renderTokenList();renderTokenSummary();}">컴포넌트</span>'
        +'<span style="'+semStyle+'" onclick="event.stopPropagation();if(!currentComp.tokens['+realIdx+'].isSemantic){currentComp.tokens['+realIdx+'].isSemantic=true;renderTokenList();renderTokenSummary();}">시멘틱</span>'
        +'</span>';
      var tokItemHtml='<div class="token-item" style="position:relative;display:flex;align-items:flex-start;gap:8px;padding:10px 16px">'
        +'<div style="width:'+nameChWidth+'px;flex-shrink:0">'+chips+'<input type="text" value="'+safeN+'" style="display:block;width:100%;padding:6px 10px;background:#f0f0f0;border:none;outline:none;border-radius:4px;font-family:monospace;font-size:13px;color:var(--text)" onclick="event.stopPropagation()" onchange="updateTokenName('+realIdx+',this.value)"></div>'
        +'<div style="flex:1"><div style="height:22px"></div><input type="text" value="'+safeD+'" style="display:block;width:100%;padding:6px 10px;background:#f0f0f0;border:none;outline:none;border-radius:4px;font-size:13px;color:var(--text-2)" onclick="event.stopPropagation()" onchange="updateTokenDesc('+realIdx+',this.value)"></div>'
        +'<div style="padding-top:22px"><button style="width:20px;height:20px;padding:0;border:none;background:transparent;color:#bbb;cursor:pointer;font-size:16px" onclick="event.stopPropagation();deleteToken('+realIdx+')">✕</button></div>'
        +'</div>';
      var TOK_HANDLE='<span class="token-drag-handle" title="드래그해서 순서 변경"><svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor"><circle cx="2.5" cy="2.5" r="1.6"/><circle cx="7.5" cy="2.5" r="1.6"/><circle cx="2.5" cy="9" r="1.6"/><circle cx="7.5" cy="9" r="1.6"/><circle cx="2.5" cy="15.5" r="1.6"/><circle cx="7.5" cy="15.5" r="1.6"/></svg></span>';
      html+='<div class="token-wrap" draggable="true" ondragstart="tokDragStart(event,'+realIdx+')" ondragover="tokDragOver(event,'+realIdx+')" ondragleave="tokDragLeave(event)" ondrop="tokDrop(event,'+realIdx+')" ondragend="tokDragEnd(event)">'+TOK_HANDLE+tokItemHtml+'</div>';
    }else{
      var chipCls=t.isSemantic?'tt-sem':'tt-default';
      var chipText=t.isSemantic?'시멘틱':'컴포넌트';
      var chipColor=t.isSemantic?'background:#E1F5FE;color:#0277BD;':'';
      var chipHtml='<span class="token-type-tag '+chipCls+'" style="padding:1px 6px;font-size:10px;display:inline-block;margin-bottom:4px;'+chipColor+'">'+chipText+'</span>';
      html+='<div class="token-item" style="display:flex;align-items:flex-start;gap:8px;padding:10px 16px">'
        +'<div style="width:'+nameChWidth+'px;flex-shrink:0">'+chipHtml+'<div class="name" style="display:block" title="'+safeN+'">'+t.name+'</div></div>'
        +'<div style="flex:1"><div style="height:22px"></div><div class="desc" style="display:block" title="'+safeD+'">'+t.desc+'</div></div>'
        +'</div>';
    }
  });
  document.getElementById('tokenList').innerHTML=html;
  document.getElementById('tokenAddArea').innerHTML=modalEditMode?'<div id="addTokenForm"></div><div style="display:flex;gap:8px;margin-top:8px"><button class="btn-add-note" style="flex:1" onclick="showAddTokenForm()">직접 추가</button><button class="btn-add-note" style="flex:1" onclick="document.getElementById(\'tokenJsonInput\').click()">json 파일로 불러오기<span class="btn-tooltip">기존 토큰 전체 삭제 후 교체됩니다</span></button></div>':'';
}

let newTokIsSem=false;
function showAddTokenForm(){
  newTokIsSem=false;
  const cats=['Color','Typography','Spacing','Sizing','Radius','Layout'];
  document.getElementById('addTokenForm').innerHTML=`<div style="display:flex;gap:8px;margin-top:12px;margin-bottom:8px;align-items:center;flex-wrap:wrap"><select id="newTokCat" style="padding:10px 28px 10px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:14px;background:var(--surface);width:120px;-webkit-appearance:none;appearance:none;background-image:url(&quot;data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E&quot;);background-repeat:no-repeat;background-position:right 10px center;cursor:pointer;outline:none;flex-shrink:0">${cats.map(c=>`<option value="${c}">${c}</option>`).join('')}</select><input id="newTokName" placeholder="토큰명" style="flex:1;min-width:140px;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:14px;outline:none;font-family:monospace"><input id="newTokDesc" placeholder="참조한 값" style="flex:1;min-width:120px;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:14px;outline:none"><button type="button" id="newTokSem" class="sem-toggle" onclick="toggleNewTokSem()">시멘틱</button><button class="btn btn-primary" style="padding:8px 14px;font-size:13px;flex-shrink:0" onclick="addTokenToComp()">추가</button><button class="btn" style="padding:8px 14px;font-size:13px;flex-shrink:0" onclick="renderTokenList()">취소</button></div>`;
  document.getElementById('newTokName').focus();
}
function toggleNewTokSem(){newTokIsSem=!newTokIsSem;document.getElementById('newTokSem').classList.toggle('active',newTokIsSem)}
function addTokenToComp(){
  const cat=document.getElementById('newTokCat').value;const name=document.getElementById('newTokName').value.trim();const desc=document.getElementById('newTokDesc').value.trim();
  if(name){currentComp.tokens.push({cat,name,desc,isSemantic:newTokIsSem});renderTokenTabs();renderTokenList();renderTokenSummary();}
}
function toggleTokenMenu(i){openTokenMenuIdx=openTokenMenuIdx===i?null:i;renderTokenList()}
function toggleTokenSemantic(i){if(!currentComp)return;currentComp.tokens[i].isSemantic=!currentComp.tokens[i].isSemantic;openTokenMenuIdx=null;renderTokenList();renderTokenSummary();}
function deleteToken(i){currentComp.tokens.splice(i,1);openTokenMenuIdx=null;renderTokenTabs();renderTokenList();renderTokenSummary();}
// Helper functions for inline editing
function renameProp(oldKey,newKey){
  const trimmed=newKey.trim();
  if(trimmed&&trimmed!==oldKey&&currentComp.props[trimmed]===undefined){
    currentComp.props[trimmed]=currentComp.props[oldKey];
    delete currentComp.props[oldKey];
    renderProps();
  }
}
function editDodontText(i,newText){
  currentComp.dodont[i].text=newText.trim();
}
function updateTokenName(i,newName){
  currentComp.tokens[i].name=newName.trim();
  renderTokenList();
}
function updateTokenDesc(i,newDesc){
  currentComp.tokens[i].desc=newDesc.trim();
  renderTokenList();
}
function importTokensJSONAdd(input){
  const file=input.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    const result=parseTokensJSON(e.target.result);
    if(result.error){alert(result.error);input.value='';return}
    const existing=new Set(tokenEntries.map(t=>t.name));
    result.tokens.forEach(t=>{
      if(!existing.has(t.name)){tokenEntries.push(t);existing.add(t.name);}
    });
    renderTokenEntries();
    input.value='';
  };
  reader.readAsText(file);
}

function editToken(i){
  const t=currentComp.tokens[i];openTokenMenuIdx=null;
  const el=document.getElementById('tokenList');
  const item=el.querySelectorAll('.token-item')[Array.from(el.querySelectorAll('.token-item')).findIndex(el2=>{const n=el2.querySelector('.name');return n&&n.textContent===t.name})];
  if(!item)return;
  item.innerHTML=`<input id="etName" value="${t.name}" style="flex:1;padding:6px 8px;font-family:monospace;font-size:13px;border:1px solid var(--border);border-radius:4px;outline:none"><input id="etDesc" value="${t.desc}" style="flex:1;padding:6px 8px;font-size:13px;border:1px solid var(--border);border-radius:4px;outline:none"><button class="btn" style="padding:4px 10px;font-size:12px" onclick="currentComp.tokens[${i}].name=document.getElementById('etName').value.trim();currentComp.tokens[${i}].desc=document.getElementById('etDesc').value.trim();renderTokenList()">저장</button><button class="btn" style="padding:4px 10px;font-size:12px" onclick="renderTokenList()">취소</button>`;
}
function filterTokens(c){activeTokenCat=c;renderTokenTabs();renderTokenList()}

// ===== JSON Token Import =====
const TYPE_TO_CAT={
  color:'Color',
  fontFamily:'Typography',fontFamilies:'Typography',fontWeight:'Typography',fontWeights:'Typography',
  fontSize:'Typography',fontSizes:'Typography',typography:'Typography',
  lineHeight:'Typography',lineHeights:'Typography',letterSpacing:'Typography',letterSpacings:'Typography',
  spacing:'Spacing',
  sizing:'Sizing',dimension:'Sizing',size:'Sizing',
  borderRadius:'Radius',borderWidth:'Radius',border:'Radius',radius:'Radius',
  layout:'Layout',display:'Layout',flex:'Layout',grid:'Layout'
};
function detectCatFromPath(path){
  for(const p of path){
    const l=p.toLowerCase();
    if(l.includes('color')||l.includes('bg')||l.includes('background')||l.includes('fg'))return'Color';
    if(l.includes('font')||l.includes('text')||l.includes('typography')||l.includes('label'))return'Typography';
    if(l.includes('spacing')||l.includes('gap')||l.includes('padding')||l.includes('margin'))return'Spacing';
    if(l.includes('radius')||l.includes('border'))return'Radius';
    if(l.includes('size')||l.includes('width')||l.includes('height'))return'Sizing';
    if(l.includes('layout')||l.includes('display')||l.includes('flex')||l.includes('grid'))return'Layout';
  }
  return'Color';
}
function walkNestedTokens(obj,path,tokens){
  if(!obj||typeof obj!=='object')return;
  if('$value' in obj||'value' in obj){
    const val=obj.$value!==undefined?obj.$value:obj.value;
    const type=obj.$type||obj.type||'';
    const cat=TYPE_TO_CAT[type]||detectCatFromPath(path);
    tokens.push({cat,name:path.join('.'),desc:typeof val==='string'?val:JSON.stringify(val),isSemantic:false});
    return;
  }
  for(const key in obj){
    if(!key.startsWith('$'))walkNestedTokens(obj[key],[...path,key],tokens);
  }
}
function parseTokensJSON(text){
  let parsed;
  try{parsed=JSON.parse(text)}catch(e){return{error:'유효하지 않은 JSON 형식입니다.'}}
  if(Array.isArray(parsed)){
    const tokens=parsed.filter(t=>t&&(t.name||t.token)).map(t=>({
      cat:t.cat||t.category||TYPE_TO_CAT[t.$type||t.type]||'Color',
      name:String(t.name||t.token),
      desc:String(t.desc||t.value||t.$value||''),
      isSemantic:!!t.isSemantic
    }));
    return{tokens};
  }
  if(parsed&&typeof parsed==='object'){
    const tokens=[];walkNestedTokens(parsed,[],tokens);
    return{tokens};
  }
  return{error:'알 수 없는 JSON 구조입니다.'};
}
function importTokensJSON(input){
  const file=input.files[0];if(!file)return;
  if(!currentComp){alert('컴포넌트 상세 모달에서 가져오기를 사용해 주세요.');input.value='';return}
  const reader=new FileReader();
  reader.onload=e=>{
    const result=parseTokensJSON(e.target.result);
    if(result.error){alert(result.error);input.value='';return}
    if(!result.tokens||!result.tokens.length){alert('JSON에서 토큰을 찾을 수 없습니다.\n지원 형식: 평면 배열 [{cat,name,desc}] 또는 DTCG 중첩 ($value/$type) 형식');input.value='';return}
    currentComp.tokens=result.tokens;
    tokensReplacedByJson=true;
    const d=new Date().toISOString().slice(0,10);
    currentComp.updates.unshift(`${d} 기존 토큰 전체 삭제 및 업데이트`);
    renderTokenTabs();renderTokenList();renderTokenSummary();renderUpdates();
    input.value='';
    alert(`기존 토큰이 삭제되고 ${result.tokens.length}개 토큰으로 교체되었습니다.`);
  };
  reader.readAsText(file);
}

function renderUpdates(){
  const el=document.getElementById('modalUpdateDetail');
  if(!currentComp.updates.length){el.innerHTML='<div style="color:var(--text-3);font-size:14px">아직 업데이트 이력이 없습니다</div>';return}
  el.innerHTML=currentComp.updates.map((u,i)=>{
    const date=u.split(' ')[0];const rest=u.slice(date.length+1);
    const restHtml=rest.replace(/\n/g,'<br>');
    return`<div style="display:flex;gap:12px;padding:8px 0;align-items:flex-start;${i?'border-top:1px solid var(--border-light)':''}"><span style="font-size:13px;color:var(--text-3);flex-shrink:0;white-space:nowrap;padding-top:2px">${date}</span><span style="font-size:14px;color:var(--text);line-height:1.7">${restHtml}</span></div>`;
  }).join('');
}

function updateStatus(p,v){
  if(!currentComp)return;currentComp.status[p]=v;
}
function closeModal(force){
  if(modalEditMode&&!force){
    showEditExitConfirm();
    return;
  }
  if(modalEditMode){
    modalEditMode=false;
    preEditSnapshot=null;
  }
  isModalOpen=false;document.getElementById('overlay').classList.remove('active');currentComp=null;openMenuIdx=null;activeAddPropKey=null;
}
function showEditExitConfirm(){
  document.getElementById('confirmOverlay').classList.add('active');
  document.querySelector('.confirm-dialog h3').textContent='수정을 취소할까요?';
  document.querySelector('.confirm-dialog p').textContent='지금 나가면 수정 내용이 반영되지 않습니다.';
  document.querySelector('.btn-cancel').textContent='계속 수정';
  document.querySelector('.btn-confirm-delete').textContent='나가기';
  document.querySelector('.btn-confirm-delete').style.background='#1a1a1a';
  document.querySelector('.btn-confirm-delete').onclick=function(){
    if(preEditSnapshot&&currentComp){
      var idx=components.findIndex(function(c){return c.id===currentComp.id});
      if(idx>=0){
        components[idx]=JSON.parse(JSON.stringify(preEditSnapshot));
        currentComp=components[idx];
      }
    }
    modalEditMode=false;preEditSnapshot=null;
    isModalOpen=false;
    closeDeleteConfirm();
    document.getElementById('overlay').classList.remove('active');
    currentComp=null;openMenuIdx=null;activeAddPropKey=null;
    renderTable();renderStats();
  };
}

function showDeleteConfirm(){
  if(!currentComp)return;
  resetConfirmDialog();
  document.getElementById('confirmOverlay').classList.add('active');
}
function closeDeleteConfirm(){document.getElementById('confirmOverlay').classList.remove('active');resetConfirmDialog()}
function openImgLightbox(src){document.getElementById('imgLightboxImg').src=src;document.getElementById('imgLightbox').classList.add('active')}
function closeImgLightbox(){document.getElementById('imgLightbox').classList.remove('active');document.getElementById('imgLightboxImg').src=''}
function confirmDeleteComp(){
  if(!currentComp)return;
  const deletedId=currentComp.id;
  components=components.filter(c=>c.id!==currentComp.id);
  deleteCompFromDB(deletedId);
  isModalOpen=false;
  closeDeleteConfirm();closeModal(true);renderTable();renderStats();
}

// Add form
let propEntries=[{key:'',opts:['','','']},{key:'',opts:['','','']},{key:'',opts:['','','']}];
function renderPropEntries(){document.getElementById('propsEntries').innerHTML=propEntries.map((p,i)=>`<div class="prop-entry"><input class="prop-key" placeholder="Props명" value="${p.key}" oninput="propEntries[${i}].key=this.value"><div class="prop-options-wrap">${p.opts.map((o,j)=>`<input placeholder="옵션 ${j+1}" value="${o}" oninput="propEntries[${i}].opts[${j}]=this.value">`).join('')}<button class="btn-add-opt" onclick="propEntries[${i}].opts.push('');renderPropEntries()">+</button></div><button class="btn-remove-prop" onclick="propEntries.splice(${i},1);renderPropEntries()">&times;</button></div>`).join('')}
function addPropEntry(){propEntries.push({key:'',opts:['','','']});renderPropEntries()}
let ddEntries=[{type:'do',text:''},{type:'dont',text:''}];
function renderDodontEntries(){const _de=document.getElementById('dodontEntries');if(!_de)return;_de.innerHTML=ddEntries.map(function(d,i){
  var typeClass=d.type==='do'?'dodont-do':'dodont-dont';
  var imgSlot='';
  if(d.image){
    imgSlot='<div style="flex-shrink:0;position:relative"><img src="'+d.image+'" class="dodont-image" onclick="openImgLightbox(this.src)"><button onclick="ddEntries['+i+'].image=\'\';renderDodontEntries()" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#555;border:2px solid #fff;color:#fff;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1">✕</button></div>';
  } else {
    imgSlot='<label class="dodont-img-placeholder"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="5" width="18" height="13" rx="2.5"/><circle cx="10" cy="12" r="3"/><path d="M6.5 5L8 2.5h4L13.5 5" stroke-linejoin="round"/></svg><input type="file" id="ddImgInput'+i+'" accept="image/*" style="display:none" onchange="handleAddDdImage(event,'+i+')"></label>';
  }
  var doBg='#E8F5E9',doBorder='#C8E6C9',dontBg='#FFEBEE',dontBorder='#FFCDD2';
  var selBg=d.type==='do'?doBg:dontBg,selBorder=d.type==='do'?doBorder:dontBorder;
  var selW=d.type==='do'?'54px':'76px';
  var labelSelect='<select onchange="ddEntries['+i+'].type=this.value;renderDodontEntries()" style="font-size:11px;font-weight:700;letter-spacing:.4px;width:'+selW+';background:'+selBg+';border:1px solid '+selBorder+';border-radius:var(--radius-sm);outline:none;cursor:pointer;-webkit-appearance:none;appearance:none;padding:5px 24px 5px 10px;color:inherit;font-family:inherit;flex-shrink:0;background-image:url(&quot;data:image/svg+xml,%3Csvg width=\'10\' height=\'6\' viewBox=\'0 0 10 6\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1 1l4 4 4-4\' stroke=\'currentColor\' stroke-width=\'1.8\' fill=\'none\' stroke-linecap=\'round\'/%3E%3C/svg%3E&quot;);background-repeat:no-repeat;background-position:right 8px center"><option value="do" '+(d.type==='do'?'selected':'')+'>DO</option><option value="dont" '+(d.type==='dont'?'selected':'')+">DON'T</option></select>";
  var textBlock='<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:3px;min-width:0">'+labelSelect+'<input placeholder="내용 입력" value="'+d.text.replace(/"/g,'&quot;')+'" oninput="ddEntries['+i+'].text=this.value" style="padding:0;background:transparent;border:none;outline:none;font-size:14px;font-weight:500;color:inherit;min-width:0"></div>';
  return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div class="dodont-item '+typeClass+'" style="flex:1">'+textBlock+imgSlot+'</div><button class="btn-remove-dd" onclick="ddEntries.splice('+i+',1);renderDodontEntries()">&times;</button></div>';
}).join('')}
function handleAddDdImage(e,i){var file=e.target.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(ev){ddEntries[i].image=ev.target.result;renderDodontEntries()};reader.readAsDataURL(file)}
function addDodontEntry(){ddEntries.push({type:'do',text:'',image:''});renderDodontEntries()}

let newPriority='중',newTokenTypes=[],tokenEntries=[];
const TOKEN_CATEGORIES=['Color','Typography','Spacing','Sizing','Radius','Layout'];
function renderNewPriorityPills(){document.getElementById('newPriorityPills').innerHTML=PRIORITIES.map(p=>`<button type="button" class="pill-btn ${p.cls} ${newPriority===p.val?'active':''}" onclick="newPriority='${p.val}';renderNewPriorityPills()">${p.val}</button>`).join('')}
function renderNewTokenTypePills(){document.getElementById('newTokenTypePills').innerHTML=TOKEN_TYPES.map(t=>{const label=t.val==='하드코딩'?'하드코딩':`${t.val} 토큰`;return`<button type="button" class="pill-btn ${t.cls} ${newTokenTypes.includes(t.val)?'active':''}" onclick="toggleNewTokenType('${t.val}')">${label}</button>`}).join('')}
function toggleNewTokenType(t){const i=newTokenTypes.indexOf(t);if(i>=0)newTokenTypes.splice(i,1);else newTokenTypes.push(t);renderNewTokenTypePills()}
function renderTokenEntries(){
  document.getElementById('tokensEntries').innerHTML=tokenEntries.map((t,i)=>`<div class="token-entry"><select class="tok-cat" onchange="tokenEntries[${i}].cat=this.value">${TOKEN_CATEGORIES.map(c=>`<option value="${c}" ${t.cat===c?'selected':''}>${c}</option>`).join('')}</select><input class="tok-name" placeholder="토큰명" value="${t.name.replace(/"/g,'&quot;')}" oninput="tokenEntries[${i}].name=this.value"><input class="tok-desc" placeholder="참조한 값" value="${t.desc.replace(/"/g,'&quot;')}" oninput="tokenEntries[${i}].desc=this.value"><button type="button" class="sem-toggle ${t.isSemantic?'active':''}" onclick="tokenEntries[${i}].isSemantic=!tokenEntries[${i}].isSemantic;renderTokenEntries()">시멘틱</button><button type="button" class="btn-remove-tok" onclick="tokenEntries.splice(${i},1);renderTokenEntries()">&times;</button></div>`).join('');
}
function addTokenEntry(){tokenEntries.push({cat:'Color',name:'',desc:'',isSemantic:false});renderTokenEntries()}
let newPlatformStatus={design:'시작 전',ios:'시작 전',android:'시작 전',web:'시작 전'};
function renderNewPlatformGrid(){
  const platforms=[{key:'design',label:'Design',stages:DESIGN_STAGES},{key:'ios',label:'iOS',stages:DEV_STAGES},{key:'android',label:'Android',stages:DEV_STAGES},{key:'web',label:'Web',stages:DEV_STAGES}];
  document.getElementById('newPlatformGrid').innerHTML=platforms.map(p=>`<div class="platform-card"><div class="label">${p.label}</div><select onchange="newPlatformStatus['${p.key}']=this.value">${p.stages.map(s=>`<option value="${s}" ${newPlatformStatus[p.key]===s?'selected':''}>${s}</option>`).join('')}</select></div>`).join('');
}
function openAddModal(){propEntries=[{key:'',opts:['','','']},{key:'',opts:['','','']},{key:'',opts:['','','']}];ddEntries=[{type:'do',text:''},{type:'dont',text:''}];tokenEntries=[];newPriority='중';newTokenTypes=[];newPlatformStatus={design:'시작 전',ios:'시작 전',android:'시작 전',web:'시작 전'};renderPropEntries();renderDodontEntries();renderTokenEntries();renderNewPriorityPills();renderNewPlatformGrid();document.getElementById('newName').value='';document.getElementById('newNote').value='';document.getElementById('newHardcoded').value='';document.getElementById('addOverlay').classList.add('active')}
function closeAddModal(){document.getElementById('addOverlay').classList.remove('active')}

// Close filter menu on outside click
document.addEventListener('click',function(e){
  if(!e.target.closest('.custom-filter-dropdown')){closeFilterMenu()}
});

// Events
document.getElementById('modalClose').addEventListener('click',function(e){e.stopPropagation();closeModal()});
document.getElementById('overlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal()});
document.getElementById('toggleAddBtn').addEventListener('click',openAddModal);
document.getElementById('addClose').addEventListener('click',closeAddModal);
document.getElementById('addOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeAddModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeAddModal()}});
document.addEventListener('click',()=>{if(openMenuIdx!==null){openMenuIdx=null;if(currentComp)renderDodont()}if(openTokenMenuIdx!==null){openTokenMenuIdx=null;if(currentComp)renderTokenList()}if(openPropMenuIdx!==null){openPropMenuIdx=null;if(currentComp)renderProps()}});

document.getElementById('confirmAdd').addEventListener('click',()=>{
  const name=document.getElementById('newName').value.trim();if(!name)return;
  const props={};propEntries.forEach(p=>{if(p.key.trim()){const vals=p.opts.filter(o=>o.trim()).map(o=>o.trim());if(vals.length)props[p.key.trim()]=vals}});
  const dodont=ddEntries.filter(d=>d.text.trim()).map(d=>({type:d.type,text:d.text.trim()}));
  const tokens=tokenEntries.filter(t=>t.name.trim()).map(t=>({cat:t.cat,name:t.name.trim(),desc:t.desc.trim(),isSemantic:!!t.isSemantic}));
  const note=document.getElementById('newNote').value.trim();
  const hardcoded=document.getElementById('newHardcoded').value.trim();
  const newComp={id:nextId++,name,props,status:{...newPlatformStatus},priority:newPriority,tokenTypes:[],tokens,dodont,note,hardcoded,updates:[new Date().toISOString().slice(0,10)+' 컴포넌트 추가']};
  components.push(newComp);
  saveComp(newComp);
  closeAddModal();renderTable();renderStats();
});

// Sticky nav scroll logic
const nav=document.getElementById('stickyNav');
const header=document.getElementById('mainHeader');
let lastScroll=0;
window.addEventListener('scroll',()=>{
  const trigger=header.getBoundingClientRect().bottom;
  if(trigger<0){nav.classList.add('visible')}else{nav.classList.remove('visible')}
},{passive:true});

initFirebase();renderPropEntries();renderDodontEntries();
