/* Canvas editor: background template + independently editable layers. */
const IDCardEditor = (() => {
  const canvas = document.getElementById("idCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const state = {
    side: "front", templates: { front: null, back: null }, images: {},
    layers: { front: [], back: [] }, selectedId: null, zoom: 1,
    photo: null, photoBase: null, drag: null, signature: null
  };
  let idCounter = 1;
  const uid = () => "layer-" + idCounter++;
  const defaultLayers = () => ({
    front: [
      {id:uid(),type:"text",name:"Student name",text:"STUDENT NAME",x:318,y:748,w:520,h:45,font:29,color:"#fff000",align:"center",weight:"bold"},
      {id:uid(),type:"text",name:"Course",text:"COURSE / PROGRAM",x:318,y:812,w:520,h:38,font:25,color:"#ffffff",align:"center",weight:"bold"},
      {id:uid(),type:"text",name:"Student number",text:"00000",x:318,y:890,w:520,h:42,font:34,color:"#ffffff",align:"center",weight:"normal"},
      {id:uid(),type:"photo",name:"Student photo",x:184,y:208,w:376,h:470,fit:"cover",scale:1,offsetX:0,offsetY:0,rotation:0}
    ],
    back: [
      {id:uid(),type:"text",name:"School year",text:"SCHOOL YEAR\n2023-2024",x:455,y:78,w:280,h:75,font:25,color:"#111111",align:"center",weight:"bold"},
      {id:uid(),type:"text",name:"Birthdate",text:"Birthdate:     01/01/2000",x:318,y:160,w:510,h:35,font:22,color:"#111111",align:"left",weight:"normal"},
      {id:uid(),type:"text",name:"Contact number",text:"Contact No.:   09XXXXXXXXX",x:318,y:220,w:510,h:35,font:22,color:"#111111",align:"left",weight:"normal"},
      {id:uid(),type:"text",name:"Address",text:"Address:  Barangay, Municipality",x:318,y:285,w:510,h:65,font:21,color:"#111111",align:"left",weight:"bold"},
      {id:uid(),type:"text",name:"Emergency contact",text:"IN CASE OF EMERGENCY, PLEASE CONTACT:\nCONTACT PERSON",x:318,y:575,w:540,h:70,font:19,color:"#111111",align:"center",weight:"normal"}
    ]
  });
  state.layers = defaultLayers();
  function imageFrom(src) { return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;}); }
  function roundedRect(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);c.clip();}
  function drawLayer(c, layer, selected=false) {
    c.save();
    if (layer.type === "text") {
      c.fillStyle = layer.color || "#111"; c.textAlign = layer.align || "left"; c.textBaseline = "middle";
      c.font = `${layer.weight || "normal"} ${layer.font || 24}px "DM Sans", Arial, sans-serif`;
      const lines = String(layer.text || "").split("\n");
      const lineHeight = (layer.font || 24) * 1.2;
      const startY = layer.y - ((lines.length - 1) * lineHeight / 2);
      lines.forEach((line,i)=>c.fillText(line, layer.x, startY + i*lineHeight, layer.w));
    } else if (layer.type === "photo" || layer.type === "signature") {
      const im = state.images[layer.id];
      if (im) {
        c.save();
        if (layer.type === "photo") roundedRect(c,layer.x,layer.y,layer.w,layer.h,Math.min(35,layer.radius ?? 24));
        const fitScale = layer.type === "photo" ? Math.max(layer.w/im.width,layer.h/im.height) : Math.min(layer.w/im.width,layer.h/im.height);
        const scale = fitScale * (layer.scale || 1);
        const dw=im.width*scale, dh=im.height*scale;
        c.translate(layer.x+layer.w/2+(layer.offsetX||0),layer.y+layer.h/2+(layer.offsetY||0));
        c.rotate((layer.rotation||0)*Math.PI/180);
        c.drawImage(im,-dw/2,-dh/2,dw,dh);
        c.restore();
      } else {
        c.fillStyle="#e9eef6"; c.fillRect(layer.x,layer.y,layer.w,layer.h);
        c.strokeStyle="#9aabc2";c.setLineDash([8,6]);c.strokeRect(layer.x,layer.y,layer.w,layer.h);c.setLineDash([]);
        c.fillStyle="#65758d";c.font="18px Arial";c.textAlign="center";c.fillText(layer.type==="photo"?"STUDENT PHOTO":"SIGNATURE",layer.x+layer.w/2,layer.y+layer.h/2);
      }
    }
    if (selected) {
      c.strokeStyle="#2470ff";c.lineWidth=3;c.setLineDash([8,5]);
      const b=layer.type==="text"?{x:layer.x-layer.w/2,y:layer.y-layer.h/2,w:layer.w,h:layer.h}:{x:layer.x,y:layer.y,w:layer.w,h:layer.h};
      c.strokeRect(b.x,b.y,b.w,b.h);c.setLineDash([]);
      c.fillStyle="#2470ff";c.fillRect(b.x+b.w-7,b.y+b.h-7,14,14);
    }
    c.restore();
  }
  function draw(target=canvas, opts={}) {
    const c=target.getContext("2d");c.clearRect(0,0,W,H);
    c.fillStyle="#fff";c.fillRect(0,0,W,H);
    const bg=state.templates[opts.side || state.side];
    if(bg) c.drawImage(bg,0,0,W,H);
    const side=opts.side || state.side;
state.layers[side].forEach(l => {
    if (l.visible === false) return;
    drawLayer(c, l, !opts.clean && l.id === state.selectedId && side === state.side);
});  }
  function selected(){return state.layers[state.side].find(l=>l.id===state.selectedId)||null;}
  function bounds(l){return l.type==="text"?{x:l.x-l.w/2,y:l.y-l.h/2,w:l.w,h:l.h}:{x:l.x,y:l.y,w:l.w,h:l.h};}
  function hit(x,y,l){const b=bounds(l);return x>=b.x-8&&x<=b.x+b.w+8&&y>=b.y-8&&y<=b.y+b.h+8;}
  function pointer(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
  canvas.addEventListener("pointerdown",e=>{
    const p=pointer(e);const list=state.layers[state.side];
    const layer=[...list].reverse().find(l=>hit(p.x,p.y,l));
    state.selectedId=layer?.id||null;
    if(layer&&!layer.locked){const b=bounds(layer);state.drag={id:layer.id,start:p,orig:{x:layer.x,y:layer.y,w:layer.w,h:layer.h,offsetX:layer.offsetX||0,offsetY:layer.offsetY||0},resize:p.x>b.x+b.w-20&&p.y>b.y+b.h-20,pan:layer.type==="photo"&&!e.altKey};}
    canvas.setPointerCapture(e.pointerId);draw();window.dispatchEvent(new Event("editor-selection"));
  });
  canvas.addEventListener("pointermove",e=>{
    if(!state.drag)return;const p=pointer(e),d=state.drag,l=state.layers[state.side].find(x=>x.id===d.id);if(!l)return;
    const dx=p.x-d.start.x,dy=p.y-d.start.y;
    if(d.resize){l.w=Math.max(20,d.orig.w+dx);l.h=Math.max(20,d.orig.h+dy);}
    else if(l.type==="text"){l.x=d.orig.x+dx;l.y=d.orig.y+dy;}
    else {l.x=d.orig.x+dx;l.y=d.orig.y+dy;}
    draw();window.dispatchEvent(new Event("editor-change"));
  });
  canvas.addEventListener("pointerup",()=>{state.drag=null;});
  function setSide(side){state.side=side;state.selectedId=null;draw();window.dispatchEvent(new Event("editor-selection"));}
  function setTemplate(side,img){state.templates[side]=img;draw();}
  async function loadTemplate(side,file){const url=URL.createObjectURL(file);const im=await imageFrom(url);state.templates[side]=im;await IDB.put("template-"+side,await blobToData(file));draw();return im;}
  function blobToData(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob);});}
  async function restore(){for(const side of ["front","back"]){const data=await IDB.get("template-"+side);if(data)state.templates[side]=await imageFrom(data);}const saved=await IDB.get("layers");if(saved)state.layers=saved;const photo=await IDB.get("photo");if(photo){state.photoBase=await imageFrom(photo);state.photo=state.photoBase;const l=state.layers.front.find(x=>x.type==="photo");if(l)state.images[l.id]=state.photo;}draw();}
  async function addPhoto(file){const data=await blobToData(file),im=await imageFrom(data);state.photoBase=im;state.photo=im;let l=state.layers.front.find(x=>x.type==="photo");if(!l){l={id:uid(),type:"photo",name:"Student photo",x:184,y:208,w:376,h:470,scale:1,offsetX:0,offsetY:0,rotation:0};state.layers.front.push(l);}state.images[l.id]=im;await IDB.put("photo",data);state.selectedId=l.id;draw();window.dispatchEvent(new Event("editor-selection"));}
  function addSignature(file){blobToData(file).then(async data=>{const im=await imageFrom(data);let l={id:uid(),type:"signature",name:"Signature",x:150,y:390,w:330,h:100,scale:1};state.layers.back.push(l);state.images[l.id]=im;state.selectedId=l.id;draw();window.dispatchEvent(new Event("editor-selection"));await persist();});}
  function addText(){const l={id:uid(),type:"text",name:"New text",text:"EDIT THIS TEXT",x:W/2,y:H/2,w:400,h:45,font:28,color:"#111111",align:"center",weight:"bold"};state.layers[state.side].push(l);state.selectedId=l.id;draw();window.dispatchEvent(new Event("editor-selection"));persist();}
  function addPhotoFrame(){const l={id:uid(),type:"photo",name:"Photo frame",x:180,y:200,w:270,h:340,scale:1,offsetX:0,offsetY:0,rotation:0};state.layers[state.side].push(l);state.selectedId=l.id;draw();window.dispatchEvent(new Event("editor-selection"));persist();}
  async function persist(){await IDB.put("layers",state.layers);}
  function update(id,patch){const l=state.layers[state.side].find(x=>x.id===id);if(l){Object.assign(l,patch);draw();persist();}}
  function remove(id){state.layers[state.side]=state.layers[state.side].filter(x=>x.id!==id);state.selectedId=null;draw();persist();window.dispatchEvent(new Event("editor-selection"));}
  function setPhotoZoom(v){const l=state.layers.front.find(x=>x.type==="photo");if(l){l.scale=Number(v);draw();persist();}}
  function rotatePhoto(){const l=state.layers.front.find(x=>x.type==="photo");if(l){l.rotation=(l.rotation+90)%360;draw();persist();}}
  function resetPhoto(){const l=state.layers.front.find(x=>x.type==="photo");if(l){l.scale=1;l.offsetX=0;l.offsetY=0;l.rotation=0;draw();persist();}}
  function imageData(side){const out=document.createElement("canvas");out.width=W;out.height=H;draw(out,{side,clean:true});return out;}
  function applyInfo(data){
    const f=state.layers.front,b=state.layers.back;
    const set=(arr,name,value)=>{const l=arr.find(x=>x.name===name);if(l&&value)l.text=value;};
    set(f,"Student name",data.name.toUpperCase());set(f,"Course",data.course.toUpperCase());set(f,"Student number",data.number);
    set(b,"School year","SCHOOL YEAR\n"+data.year);set(b,"Birthdate","Birthdate:     "+data.birthdate);set(b,"Contact number","Contact No.:   "+data.contact);set(b,"Address","Address:  "+data.address);set(b,"Emergency contact","IN CASE OF EMERGENCY, PLEASE CONTACT:\n"+data.emergency);
    draw();persist();
  }
  async function backup(){const all=await IDB.all();return new Blob([JSON.stringify(all)],{type:"application/json"});}
  async function restoreBackup(data){const items=JSON.parse(data);for(const item of items)await IDB.put(item.key,item.value);location.reload();}
  function exportLayerData(){return state.layers;}
  function importLayers(data){state.layers=data;draw();}
  function setZoom(z){state.zoom=Math.max(.35,Math.min(1.5,z));document.getElementById("cardWrap").style.width=(318*state.zoom)+"px";document.getElementById("zoomLabel").textContent=Math.round(state.zoom*100)+"%";}
  return {state,draw,setSide,setTemplate,loadTemplate,restore,addPhoto,addSignature,addText,addPhotoFrame,selected,update,remove,setPhotoZoom,rotatePhoto,resetPhoto,imageData,persist,applyInfo,backup,restoreBackup,exportLayerData,importLayers,setZoom};
})();

function toggleLayerVisibility(button) {
    const layerItem = button.closest(".layer-item");
    if (!layerItem) return;

    const layerId = layerItem.dataset.layerId || layerItem.dataset.id;
    if (!layerId) return;

    const editor = IDCardEditor;
    const layer = [
        ...editor.state.layers.front,
        ...editor.state.layers.back
    ].find(l => String(l.id) === String(layerId));

    if (!layer) return;

    layer.visible = layer.visible === false;

    const icon = button.querySelector(".material-symbols-rounded");

    if (layer.visible) {
        icon.textContent = "visibility";
        button.title = "Hide layer";
        button.classList.remove("is-hidden");
        layerItem.style.opacity = "1";
    } else {
        icon.textContent = "visibility_off";
        button.title = "Show layer";
        button.classList.add("is-hidden");
        layerItem.style.opacity = "0.5";
    }

    editor.draw();
    editor.persist();
}