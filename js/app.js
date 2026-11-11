const $ = id => document.getElementById(id);
const toast = msg => {const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.remove("show"),2600);};
function showView(name){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$(name+"View").classList.add("active");document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name));$("pageTitle").textContent=name==="designer"?"ID Designer":name==="templates"?"ID Templates":"Student Records";$("sidebar").classList.remove("open");}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
$("mobileMenu").onclick=()=>$("sidebar").classList.toggle("open");
$("newStudentBtn").onclick=()=>{showView("designer");$("studentForm").reset();toast("Ready for a new student ID.");};
document.querySelectorAll(".segment").forEach(b=>b.onclick=()=>{document.querySelectorAll(".segment").forEach(x=>x.classList.toggle("active",x===b));IDCardEditor.setSide(b.dataset.side);});
function syncStudentDetails(){
 const val=id=>$(id).value.trim();
 IDCardEditor.applyInfo({
  name:val("studentName"), course:val("course"), number:val("studentNumber"),
  year:val("schoolYear"), birthdate:val("birthdate"), contact:val("contact"),
  address:val("address"), emergency:val("emergency")
 });
}
// Keep both sides of the card in sync while the user types.
["studentName","course","studentNumber","schoolYear","birthdate","contact","address","emergency"]
 .forEach(id=>$(id).addEventListener("input",syncStudentDetails));
$("applyInfoBtn").onclick=()=>{syncStudentDetails();toast("Student details applied to the ID.");};
$("photoUpload").onchange=e=>{const f=e.target.files[0];if(f){IDCardEditor.addPhoto(f);$("photoTools").classList.remove("hidden");$("photoZoom").value=1;toast("Photo added. Drag it on the card to position.");}};
$("photoZoom").oninput=e=>IDCardEditor.setPhotoZoom(e.target.value);
$("rotatePhotoBtn").onclick=()=>IDCardEditor.rotatePhoto();$("resetPhotoBtn").onclick=()=>{IDCardEditor.resetPhoto();$("photoZoom").value=1;};
$("signatureUpload").onchange=e=>{if(e.target.files[0])IDCardEditor.addSignature(e.target.files[0]);};
["front","back"].forEach(side=>{
  $(""+side+"TemplateUpload").onchange=async e=>{const f=e.target.files[0];if(f){await IDCardEditor.loadTemplate(side,f);updateTemplatePreview(side,f);toast(side+" template uploaded.");}};
});
function updateTemplatePreview(side,file){const url=URL.createObjectURL(file);$(""+side+"TemplatePreview").style.backgroundImage=`url("${url}")`;$(""+side+"TemplatePreview").textContent="";$(""+side+"TemplateStatus").textContent="Uploaded";}
$("addTextBtn").onclick=()=>IDCardEditor.addText();$("addPhotoFrameBtn").onclick=()=>IDCardEditor.addPhotoFrame();

function refreshLayers() {
    const list = $("layerList");
    list.innerHTML = "";

    const layers = IDCardEditor.state.layers[IDCardEditor.state.side];

    layers.forEach(l => {
        const row = document.createElement("div");

        row.className = "layer-row" +
            (IDCardEditor.state.selectedId === l.id ? " selected" : "");

        row.dataset.layerId = l.id;

        // Layer selection button
        const pick = document.createElement("button");
        pick.className = "layer-pick";
        pick.textContent =
            (l.type === "text" ? "T" : l.type === "photo" ? "▣" : "✎")
            + "  " + l.name;

        pick.onclick = () => {
            IDCardEditor.state.selectedId = l.id;
            IDCardEditor.draw();
            refreshProperties();
            refreshLayers();
        };

        // Visibility button
        const visibility = document.createElement("button");
        visibility.type = "button";
        visibility.className = "layer-visibility-btn";
        visibility.title = l.visible === false ? "Show layer" : "Hide layer";

        const eye = document.createElement("span");
        eye.className = "material-symbols-rounded";
        eye.textContent = l.visible === false ? "visibility_off" : "visibility";

        visibility.append(eye);

        if (l.visible === false) {
            visibility.classList.add("is-hidden");
            row.style.opacity = "0.5";
        }

        visibility.onclick = async () => {
            l.visible = l.visible === false ? true : false;

            await IDCardEditor.persist();
            IDCardEditor.draw();
            refreshLayers();
        };

        // Lock button
        const lock = document.createElement("button");
        lock.className = "layer-lock";
        lock.textContent = l.locked ? "🔒" : "🔓";
        lock.title = "Lock/unlock";

        lock.onclick = async () => {
            l.locked = !l.locked;
            await IDCardEditor.persist();
            refreshLayers();
            refreshProperties();
        };

        row.append(pick, visibility, lock);
        list.append(row);
    });
}

function refreshProperties(){
 const l=IDCardEditor.selected(),has=!!l;$("noSelection").classList.toggle("hidden",has);$("properties").classList.toggle("hidden",!has);if(!l){refreshLayers();return;}
 $("selectedName").textContent=l.name;$("propX").value=Math.round(l.type==="text"?l.x-l.w/2:l.x);$("propY").value=Math.round(l.type==="text"?l.y-l.h/2:l.y);$("propW").value=Math.round(l.w);$("propH").value=Math.round(l.h);$("propLabel").value=l.name;
 const text=l.type==="text";$("fontSizeRow").classList.toggle("hidden",!text);$("colorRow").classList.toggle("hidden",!text);$("alignRow").classList.toggle("hidden",!text);
 if(text){$("propFont").value=l.font;$("propColor").value=l.color;$("propAlign").value=l.align;}
 $("lockLayer").textContent=l.locked?"🔓 Unlock position":"🔒 Lock position";refreshLayers();
}
function updateSelected(patch){const l=IDCardEditor.selected();if(l)IDCardEditor.update(l.id,patch);}
["propX","propY","propW","propH"].forEach(id=>$(id).onchange=()=>{const l=IDCardEditor.selected();if(!l)return;const x=Number($("propX").value),y=Number($("propY").value),w=Math.max(10,Number($("propW").value)),h=Math.max(10,Number($("propH").value));IDCardEditor.update(l.id,l.type==="text"?{x:x+w/2,y:y+h/2,w,h}:{x,y,w,h});});
$("propFont").onchange=()=>updateSelected({font:Number($("propFont").value)});$("propColor").oninput=()=>updateSelected({color:$("propColor").value});$("propAlign").onchange=()=>updateSelected({align:$("propAlign").value});$("propLabel").onchange=()=>{updateSelected({name:$("propLabel").value});refreshLayers();};
$("lockLayer").onclick=()=>{const l=IDCardEditor.selected();if(l){IDCardEditor.update(l.id,{locked:!l.locked});refreshProperties();}};$("deleteLayer").onclick=()=>{const l=IDCardEditor.selected();if(l&&confirm("Delete this layer?"))IDCardEditor.remove(l.id);};
window.addEventListener("editor-selection",refreshProperties);window.addEventListener("editor-change",()=>{const l=IDCardEditor.selected();if(l){$("propX").value=Math.round(l.type==="text"?l.x-l.w/2:l.x);$("propY").value=Math.round(l.type==="text"?l.y-l.h/2:l.y);}});
$("zoomIn").onclick=()=>IDCardEditor.setZoom(IDCardEditor.state.zoom+.1);$("zoomOut").onclick=()=>IDCardEditor.setZoom(IDCardEditor.state.zoom-.1);$("fitCanvas").onclick=()=>IDCardEditor.setZoom(1);
$("previewBtn").onclick=()=>{$("frontPreviewCanvas").getContext("2d").drawImage(IDCardEditor.imageData("front"),0,0);$("backPreviewCanvas").getContext("2d").drawImage(IDCardEditor.imageData("back"),0,0);$("previewModal").classList.remove("hidden");};
document.querySelectorAll(".close-modal").forEach(b=>b.onclick=()=>$(b.dataset.close).classList.add("hidden"));$("previewModal").onclick=e=>{if(e.target===$("previewModal"))$("previewModal").classList.add("hidden");};
let records=[];
async function loadRecords(){records=await IDB.get("records")||[];renderRecords();}
function renderRecords(){const q=$("recordSearch").value.toLowerCase(),list=$("recordsList");list.innerHTML="";const found=records.filter(r=>(r.name+" "+r.number).toLowerCase().includes(q));if(!found.length){list.innerHTML='<div class="empty-state">No matching student records.</div>';return;}found.forEach(r=>{const row=document.createElement("div");row.className="record-row";const info=document.createElement("div");const strong=document.createElement("strong");strong.textContent=r.name;const small=document.createElement("small");small.textContent=(r.number||"No ID number")+" · "+(r.course||"No course");info.append(strong,small);const actions=document.createElement("div");actions.className="record-actions";const load=document.createElement("button");load.className="btn btn-quiet";load.textContent="Load";load.onclick=()=>{IDCardEditor.importLayers(r.layers);$("studentName").value=r.name;$("course").value=r.course;$("studentNumber").value=r.number;syncStudentDetails();showView("designer");toast("Record layout loaded.");};const del=document.createElement("button");del.className="btn btn-danger-quiet";del.textContent="Delete";del.onclick=async()=>{if(confirm("Delete this saved record?")){records=records.filter(x=>x.id!==r.id);await IDB.put("records",records);renderRecords();}};actions.append(load,del);row.append(info,actions);list.append(row);});}
$("recordSearch").oninput=renderRecords;
$("saveRecordBtn").onclick=async()=>{const name=$("studentName").value.trim();if(!name){toast("Enter a student name before saving.");return;}const record={id:Date.now(),name,course:$("course").value,number:$("studentNumber").value,layers:JSON.parse(JSON.stringify(IDCardEditor.exportLayerData())),savedAt:new Date().toISOString()};records=records.filter(r=>r.number!==record.number||!record.number);records.unshift(record);await IDB.put("records",records);renderRecords();toast("Student ID record saved on this device.");};
$("backupBtn").onclick=async()=>{const blob=await IDCardEditor.backup();downloadBlob(blob,"school-id-maker-backup.json");};
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$("clearFormBtn").onclick=()=>setTimeout(()=>toast("Form cleared. Existing canvas layers are unchanged."),0);
window.IDApp={toast,downloadBlob,loadRecords};
(async()=>{await IDCardEditor.restore();await loadRecords();refreshProperties();IDCardEditor.setZoom(1);})();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) { window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {})); }
