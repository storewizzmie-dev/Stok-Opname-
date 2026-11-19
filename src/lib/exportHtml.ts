/**
 * Generates an updated standalone single-file index.html suitable for GitHub Pages
 * (e.g. storewizzmie-dev/tes) containing the user's latest UI + bug fixes.
 */
export function buildStandaloneHtml(): string {
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pantau Stok Opname</title>
<meta name="description" content="Pantau barang yang kurang atau lebih dari laporan stok opname harian.">
<style>
:root{--bg:#f3f6f5;--cd:#fff;--tx:#14211f;--mu:#5b6b68;--bd:#e1e8e6;--ac:#0d9488;--neg:#b42318;--nbg:#fdecea;--pos:#166534;--pbg:#e6f5ec;--hl:#eef3f2;--sh:0 1px 2px rgba(16,40,36,.06),0 6px 18px rgba(16,40,36,.06);color-scheme:light}
@media(prefers-color-scheme:dark){:root{--bg:#101615;--cd:#18201f;--tx:#e8f0ee;--mu:#9db0ac;--bd:#27322f;--ac:#2dd4bf;--neg:#ff8a80;--nbg:#3a1f1d;--pos:#6ee7a0;--pbg:#183226;--hl:#212b29;--sh:none;color-scheme:dark}}
*{box-sizing:border-box}[hidden]{display:none!important}
body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:20px 14px 48px}
h1{font-size:26px;margin:6px 0 4px}h2{font-size:18px;margin:0 0 12px}h3{font-size:17px;margin:0}
.mu,small{color:var(--mu)}small{display:block;font-size:13px;font-weight:400}
.neg{color:var(--neg)}.pos{color:var(--pos)}
.card{background:var(--cd);border-radius:18px;box-shadow:var(--sh);border:1px solid var(--bd);padding:18px;margin:14px 0}
.up{display:flex;flex-direction:column;gap:4px;align-items:center;text-align:center;margin-top:14px;padding:26px 16px;border:2px dashed var(--ac);border-radius:18px;background:var(--cd);cursor:pointer}
.up.on,.up:hover{background:var(--hl)}.up .big{font-size:18px;font-weight:700;color:var(--ac)}
#msg{margin:10px 2px;font-size:15px;font-weight:600;color:var(--pos)}#msg.e{color:var(--neg)}
.pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.pill{border:1px solid var(--bd);background:var(--hl);color:var(--tx);border-radius:999px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer}
.pill.on{background:var(--ac);border-color:var(--ac);color:#fff}
@media(prefers-color-scheme:dark){.pill.on{color:#0b1a18}}
select,input[type=search]{font:inherit;color:var(--tx);background:var(--cd);border:1px solid var(--bd);border-radius:12px;padding:11px 12px;min-height:46px}
input[type=search]{width:100%;margin-bottom:10px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.sp{justify-content:space-between}
button{font:inherit;color:var(--tx);cursor:pointer}
.btn{background:var(--cd);border:1px solid var(--bd);border-radius:12px;padding:10px 14px;min-height:44px;font-weight:600}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:14px 0}
.sc{border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:2px}
.sc span{font-weight:600;font-size:14px}.sc b{font-size:26px;line-height:1.2;font-variant-numeric:tabular-nums}.sc small{color:inherit;opacity:.85}
.sc.neg{background:var(--nbg);color:var(--neg)}.sc.pos{background:var(--pbg);color:var(--pos)}.sc.net{background:var(--cd);border:1px solid var(--bd);box-shadow:var(--sh)}
.hint{background:var(--hl);border-radius:14px;padding:12px 14px;margin:0 0 14px}
.chart{display:flex;gap:3px;align-items:flex-end;overflow-x:auto;padding-bottom:2px}
.bar{flex:1;min-width:18px;height:146px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;background:none;border:0;padding:0;cursor:pointer}
.bar i{display:block;width:70%;background:var(--neg);border-radius:6px 6px 0 0;opacity:.85;transition:opacity .15s}
.bar:hover i,.bar.on i{opacity:1;outline:2px solid var(--ac)}
.bar em{font:normal 11px/16px system-ui;color:var(--mu)}
.it{display:flex;width:100%;gap:10px;align-items:center;justify-content:space-between;text-align:left;background:none;border:0;border-bottom:1px solid var(--bd);padding:12px 4px;min-height:56px}
.it:last-child{border-bottom:0}.it.on{background:var(--hl);border-radius:10px}.it:hover{background:var(--hl)}
.it b{white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums}.nm{flex:1;min-width:0;font-weight:600;overflow-wrap:anywhere}
.rk{flex:none;width:28px;height:28px;border-radius:50%;background:var(--hl);display:grid;place-items:center;font-size:13px;font-weight:700}
.dr{display:flex;gap:8px 12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:10px 4px;border-bottom:1px solid var(--bd)}
.dr:last-child{border-bottom:0}.dr b{min-width:90px;text-align:right;font-variant-numeric:tabular-nums}
.badge{font-size:13px;font-weight:700;border-radius:999px;padding:3px 10px;background:var(--hl);color:var(--mu);white-space:nowrap}
.badge.neg{background:var(--nbg)}.badge.pos{background:var(--pbg)}
.pd{margin-top:14px;background:var(--hl);border-radius:16px;padding:14px}.pd .dr{border-color:var(--bd)}
.x{border:0;background:var(--cd);border-radius:10px;padding:8px 12px;font-weight:600}
details.day{border:1px solid var(--bd);border-radius:14px;margin:10px 0;background:var(--cd)}
details.day summary{list-style:none;cursor:pointer;padding:14px;display:flex;flex-direction:column;gap:6px}
details.day summary::-webkit-details-marker{display:none}
details.day[open] summary{border-bottom:1px solid var(--bd)}details.day>.dr,details.day>p{margin:0 10px}
.dt{font-weight:700;font-size:17px}.dt::after{content:" ▾";color:var(--mu);font-weight:400}
.chips{display:flex;gap:8px;flex-wrap:wrap}.chips i{font-style:normal;font-size:14px;font-weight:600;border-radius:999px;padding:3px 10px}
.chips i.neg{background:var(--nbg)}.chips i.pos{background:var(--pbg)}.pad{padding:10px 0}
details.set summary{cursor:pointer;font-weight:700}details.set .row{margin-top:12px}
</style></head><body><main>
<h1>Pantau Stok Opname</h1>
<p class="mu" style="margin:0">Upload laporan setiap hari. Aplikasi otomatis menghitung barang yang <b>kurang</b> (minus) atau <b>lebih</b> (plus).</p>
<label class="up" id="dz"><input id="f" type="file" accept=".xlsx,.xls" multiple hidden>
<span class="big">Pilih file laporan (.xlsx)</span><span class="mu">atau tarik file ke sini. Boleh pilih beberapa file sekaligus.</span></label>
<div id="msg" role="status"></div>
<div id="empty" class="card" hidden><h2>Selamat datang</h2><p style="margin:0">Belum ada data. Klik tombol upload di atas lalu pilih file laporan Stock Opname Anda. Hasilnya langsung muncul di sini.</p></div>
<div id="main" hidden>
<section class="card" id="s1"></section>
<div id="s2"></div>
<section class="card" id="s3"></section>
<section class="card"><h2>Cari barang</h2><input type="search" id="q" placeholder="Ketik nama barang, misal: udang keju" autocomplete="off"><div id="pr"></div><div id="pd"></div></section>
<section class="card" id="s5"></section>
</div>
<details class="card set"><summary>Pengaturan data</summary>
<p class="mu">Data tersimpan di browser ini. Unduh cadangan secara berkala agar aman.</p>
<div class="row"><button class="btn" id="bk">Cadangkan data</button><button class="btn" id="rs">Pulihkan cadangan</button><button class="btn" id="wipe">Hapus semua data</button><input id="rf" type="file" accept=".json" hidden></div></details>
</main>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js">${'<'}/script>
<script>
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MON=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const MONF=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const fd=t=>{const[y,m,d]=t.split('-');return +d+' '+MON[m-1]+' '+y};
const mname=k=>MONF[+k.slice(5)-1]+' '+k.slice(0,4);
const rp=n=>'Rp '+Math.abs(Math.round(n)).toLocaleString('id-ID');
const nm=n=>Math.abs(Math.round(n*100)/100).toLocaleString('id-ID',{maximumFractionDigits:2});
const sg=n=>(n>1e-9?'+':n<-1e-9?'-':'')+nm(n);
let DATA={},PC={},S={m:'',to:'',p:'',day:''},armed=false;
const D=()=>Object.keys(DATA).sort();
const M=()=>[...new Set(D().map(t=>t.slice(0,7)))];
const days=()=>D().filter(t=>t.startsWith(S.m)&&t<=S.to);
function msg(t,e){const m=$('#msg');m.textContent=t;m.className=e?'e':''}
const CV={'dbl - ayam potong dadu':['KG',10],'dbl - cabai rawit':['KG',10],'dbl - sayap':['PORSI',50,{'pack @5porsi':5}],'kecap manis':['KG',21],'skm carnation @2kg':['KG',16],'tepung wizzchick (tepung krispi)':['KG',14],'wip - adonan pangsit':['KG',12],'wip - ayam tabur':['KG',9],'wip - bola keju':['PORSI',140],'wip - ceker':['Porsi @3pcs',100],'wip - lumpia ayam':['Porsi @3pcs',130],'wip - lumpia udang':['PORSI',110],'wip - mie':['Pcs',160],'wip - pao ayam':['Porsi @3pcs',70],'wip - siomay':['Porsi @3pcs',140],'wip - udang keju':['Porsi @3pcs',120],'wip - udang rambutan':['Porsi @3pcs',140]};
const V=t=>DATA[t].map(r=>{const c=CV[r[0].toLowerCase()],u=r[1].toLowerCase();if(!c)return r;const f=u==='dos'?c[1]:((c[2]&&c[2][u])||1);if(f===1&&u!=='dos')return r;const m=x=>Math.round(x*f*1e4)/1e4;return [r[0],c[0],m(r[2]),m(r[3]),m(r[4]),r[5],r[6],r[7]]});

function parse(buf){
  const wb=XLSX.read(buf,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]];
  const a=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
  const h=a.findIndex(r=>r&&r.some(c=>String(c).trim().toLowerCase()==='stock opname date'));
  if(h<0)throw Error('Baris judul kolom "Stock Opname date" tidak ditemukan.');
  const H=a[h].map(c=>String(c||'').trim().toLowerCase()),ix=n=>H.indexOf(n);
  const c={d:ix('stock opname date'),p:ix('product'),u:ix('unit'),s:ix('period system stock'),o:ix('opname stock'),q:ix('difference qty'),v:ix('value per unit'),x:ix('difference value'),i:ix('additional information')};
  if(c.p<0||c.x<0||c.q<0)throw Error('Kolom Product, Difference Qty, atau Difference Value tidak ada.');
  const out={},num=v=>{if(typeof v==='number')return Math.round((v||0)*1e4)/1e4;if(typeof v==='string'){const n=Number(v.trim().replace(/,/g,''));return Number.isFinite(n)?Math.round(n*1e4)/1e4:0}return 0};
  for(const r of a.slice(h+1)){
    let v=r[c.d],t=null;
    if(typeof v==='number'){const p=XLSX.SSF.parse_date_code(v);if(p)t=p.y+'-'+String(p.m).padStart(2,'0')+'-'+String(p.d).padStart(2,'0')}
    else if(v instanceof Date&&!isNaN(v)){t=v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0')}
    else if(typeof v==='string'){
      const m=v.match(/(\\d{4})-(\\d{1,2})-(\\d{1,2})/);
      if(m)t=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
      else{const d=v.match(/(\\d{1,2})[/-](\\d{1,2})[/-](\\d{4})/);if(d)t=d[3]+'-'+d[2].padStart(2,'0')+'-'+d[1].padStart(2,'0')}
    }
    if(!t||!r[c.p])continue;
    (out[t]??=[]).push([String(r[c.p]).trim(),String(r[c.u]||''),num(r[c.s]),num(r[c.o]),num(r[c.q]),num(r[c.v]),Math.round(num(r[c.x])*100)/100,String(r[c.i]||'')]);
  }
  return out;
}

function save(){try{localStorage.setItem('so',JSON.stringify(DATA))}catch(e){msg('Gagal menyimpan: penyimpanan browser penuh atau diblokir.',1)}}
async function handle(files){
  let nw=0,up=0,all=[];msg('Membaca file...');
  try{
    for(const f of files){
      const o=parse(await f.arrayBuffer());
      for(const t in o){DATA[t]?up++:nw++;DATA[t]=o[t];all.push(t)}
    }
    if(!all.length)throw Error('tidak ada baris data yang terbaca');
    S.m=all.sort().slice(-1)[0].slice(0,7);S.to='';S.p='';S.day='';$('#q').value='';
    save();render();
    msg(nw+' tanggal baru ditambahkan, '+up+' tanggal diperbarui. Total '+mname(S.m)+' sudah dihitung ulang.');
  }catch(e){msg('Gagal membaca file: '+e.message+'. Pastikan itu laporan Stock Opname (.xlsx).',1)}
}
const row=(n,r)=>{const q=r[4],c=q<-1e-9?'neg':q>1e-9?'pos':'',u=esc(r[1]),info=r[7]?' · '+esc(r[7]):'';
  return '<div class="dr"><span class="nm">'+esc(n)+'<small>Di sistem '+nm(r[2])+' · Hitungan '+nm(r[3])+' '+u+info+'</small></span><span class="badge '+c+'">'+(c==='neg'?'Kurang '+nm(q)+' '+u:c==='pos'?'Lebih '+nm(q)+' '+u:'Pas')+'</span><b class="'+c+'">'+(c?rp(r[6]):'')+'</b></div>'};
const itRow=(n,sub,right,cls,rk)=>'<button class="it'+(S.p===n?' on':'')+'" data-p="'+esc(n)+'">'+(rk?'<span class="rk">'+rk+'</span>':'')+'<span class="nm">'+esc(n)+'<small>'+sub+'</small></span><b class="'+cls+'">'+right+'</b></button>';
function ensure(){
  const ms=M();if(!ms.length)return false;
  if(!ms.includes(S.m))S.m=ms[ms.length-1];
  const ds=D().filter(t=>t.startsWith(S.m));
  if(!ds.includes(S.to))S.to=ds[ds.length-1];
  return true;
}
function render(){
  const has=ensure();$('#empty').hidden=has;$('#main').hidden=!has;if(!has)return;
  const all=D().filter(t=>t.startsWith(S.m)),ds=all.filter(t=>t<=S.to);
  const st=ds.map(t=>{let n=0,p=0;DATA[t].forEach(r=>{if(r[6]<0)n+=r[6];else if(r[6]>0)p+=r[6]});return{t,n,p}});
  let cum=0;st.forEach(x=>{cum+=x.n;x.cum=cum});
  PC={};ds.forEach(t=>{const seen=new Set();V(t).forEach(r=>{const o=PC[r[0]]??={n:0,p:0,dn:0,u:{}};if(r[6]<0){o.n+=r[6];if(!seen.has(r[0])){o.dn++;seen.add(r[0])}}else if(r[6]>0)o.p+=r[6];const un=r[1]||'Unit';o.u[un]=(o.u[un]||0)+r[4]})});
  const tn=st.reduce((a,x)=>a+x.n,0),tp=st.reduce((a,x)=>a+x.p,0),net=tn+tp,vals=Object.values(PC);
  const nk=vals.filter(o=>o.n<0).length,nl=vals.filter(o=>o.p>0).length,nc=net<-0.5?'neg':net>0.5?'pos':'';
  const f1=+all[0].slice(8),l1=+all[all.length-1].slice(8),miss=[];
  for(let d=f1;d<=l1;d++)if(!DATA[S.m+'-'+String(d).padStart(2,'0')])miss.push(d);
  $('#s1').innerHTML='<h2>Pilih bulan</h2><div class="pills">'+M().map(m=>'<button class="pill'+(m===S.m?' on':'')+'" data-m="'+m+'">'+mname(m)+'</button>').join('')+'</div>'+
   '<div class="row sp"><label for="to"><b>Hitung sampai tanggal</b></label><select id="to">'+all.map(t=>'<option value="'+t+'"'+(t===S.to?' selected':'')+'>'+fd(t)+'</option>').join('')+'</select></div>'+
   '<p class="mu" style="margin:12px 0 0">Data yang sudah masuk: <b>'+all.length+' hari</b> ('+fd(all[0])+' – '+fd(all[all.length-1])+').'+(miss.length?' <b class="neg">Belum diupload: tanggal '+miss.join(', ')+'.</b>':'')+' Tiap bulan dihitung terpisah, jadi bulan baru otomatis mulai dari nol.</p>';
  const mx=Math.max(1,...st.map(x=>-x.n)),top=st.reduce((a,x)=>x.n<a.n?x:a,st[0]);
  $('#s2').innerHTML='<div class="cards"><div class="sc neg"><span>Total KURANG (minus)</span><b>'+rp(tn)+'</b><small>'+nk+' barang pernah kurang</small></div>'+
   '<div class="sc pos"><span>Total LEBIH (plus)</span><b>'+rp(tp)+'</b><small>'+nl+' barang pernah lebih</small></div>'+
   '<div class="sc net"><span>Hasil akhir</span><b class="'+nc+'">'+rp(net)+'</b><small>'+(nc==='neg'?'Stok keseluruhan KURANG':nc==='pos'?'Stok keseluruhan LEBIH':'Stok keseluruhan PAS')+'</small></div></div>'+
   '<p class="hint">Dari <b>'+fd(ds[0])+'</b> sampai <b>'+fd(S.to)+'</b>: barang yang kurang bernilai <b class="neg">'+rp(tn)+'</b> dan yang lebih <b class="pos">'+rp(tp)+'</b>.</p>'+
   '<section class="card"><h2>Nilai kurang setiap hari</h2><div class="chart">'+st.map(x=>'<button type="button" class="bar'+(S.day===x.t?' on':'')+'" data-bar="'+x.t+'" title="'+fd(x.t)+': kurang '+rp(x.n)+'"><i style="height:'+(x.n<0?Math.max(4,Math.round(-x.n/mx*120)):0)+'px"></i><em>'+(+x.t.slice(8))+'</em></button>').join('')+'</div>'+
   (top.n<0?'<p class="mu" style="margin:8px 0 0">Paling banyak kurang: tanggal '+(+top.t.slice(8))+' ('+rp(top.n)+'). Ketuk batang tanggal untuk lihat rinciannya.</p>':'')+'</section>';
  const tops=Object.keys(PC).filter(n=>PC[n].n<0).sort((a,b)=>PC[a].n-PC[b].n).slice(0,10);
  $('#s3').innerHTML='<h2>10 barang paling banyak kurang</h2>'+(tops.length?tops.map((n,i)=>itRow(n,'Kurang di '+PC[n].dn+' hari','Kurang '+rp(PC[n].n),'neg',i+1)).join(''):'<p class="mu" style="margin:0">Tidak ada barang yang kurang.</p>');
  const dh=x=>{const it=V(x.t).filter(r=>Math.abs(r[4])>1e-9||Math.abs(r[6])>0.5).sort((a,b)=>a[6]-b[6]);
    return '<details class="day" id="day-'+x.t+'"'+(S.day===x.t?' open':'')+'><summary><span class="dt">'+fd(x.t)+'</span><span class="chips"><i class="neg">Kurang '+rp(x.n)+'</i><i class="pos">Lebih '+rp(x.p)+'</i></span><small>Total kurang sampai hari ini: <b class="neg">'+rp(x.cum)+'</b></small></summary>'+(it.length?it.map(r=>row(r[0],r)).join(''):'<p class="mu pad">Semua barang pas.</p>')+'</details>'};
  $('#s5').innerHTML='<h2>Rincian per tanggal</h2><p class="mu" style="margin:0 0 4px">Ketuk satu tanggal untuk melihat barang yang selisih di hari itu.</p>'+st.slice().reverse().map(dh).join('');
  $('#s1').querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{S.m=b.dataset.m;S.to='';S.p='';S.day='';render()});
  $('#to').onchange=e=>{S.to=e.target.value;render()};
  $('#s2').querySelectorAll('[data-bar]').forEach(b=>b.onclick=()=>{S.day=b.dataset.bar;render();const dEl=$('#day-'+S.day);if(dEl)dEl.scrollIntoView({behavior:'smooth',block:'nearest'})});
  bindP($('#s3'));prod();
}
function bindP(el){el.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>pick(b.dataset.p))}
function pick(n){S.p=n;$('#q').value=n;prod();$('#pd').scrollIntoView({behavior:'smooth',block:'center'})}
function prod(){
  const q=$('#q').value.trim().toLowerCase(),el=$('#pr');let h='';
  if(!q)h='<p class="mu" style="margin:0">Ketik nama barang, misalnya "udang keju".</p>';
  else{const ns=Object.keys(PC).filter(n=>n.toLowerCase().includes(q));
    h=ns.length?ns.slice(0,30).map(n=>itRow(n,'Kurang '+rp(PC[n].n)+' · Lebih '+rp(PC[n].p),PC[n].n<0?'Kurang '+rp(PC[n].n):'Tidak ada kurang',PC[n].n<0?'neg':'mu')).join(''):'<p class="mu" style="margin:0">Barang tidak ditemukan pada bulan ini.</p>';
    if(ns.length===1)S.p=ns[0]}
  el.innerHTML=h;bindP(el);detail();
}
function detail(){
  const el=$('#pd'),o=PC[S.p];if(!S.p||!o){el.innerHTML='';return}
  const net=o.n+o.p,c=net<-0.5?'neg':net>0.5?'pos':'';
  const qs=Object.entries(o.qtyByUnit||o.u).filter(([,v])=>Math.abs(v)>1e-9).map(([u,v])=>sg(v)+' '+esc(u)).join(', ')||'0';
  el.innerHTML='<div class="pd"><div class="row sp"><h3>'+esc(S.p)+'</h3><button class="x" id="cl">Tutup</button></div>'+
   '<p>Total kurang <b class="neg">'+rp(o.n)+'</b> · total lebih <b class="pos">'+rp(o.p)+'</b> · hasil akhir <b class="'+c+'">'+(c==='neg'?'kurang ':c==='pos'?'lebih ':'pas ')+rp(net)+'</b><br><small>Total selisih qty: <b>'+qs+'</b></small></p>'+
   days().flatMap(t=>V(t).filter(x=>x[0]===S.p).map(r=>row(fd(t),r))).join('')+'</div>';
  $('#cl').onclick=()=>{S.p='';prod()};
}
function backup(){
  if(!D().length){msg('Belum ada data untuk dicadangkan.',1);return}
  const b=new Blob([JSON.stringify({v:1,data:DATA})],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='backup-stok-opname-'+D().slice(-1)[0]+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);msg('Cadangan diunduh.');
}
async function restore(f){
  try{
    const o=JSON.parse(await f.text());if(!o||!o.data)throw Error('format tidak dikenal');
    let n=0;for(const t in o.data){if(/^\\d{4}-\\d{2}-\\d{2}$/.test(t)&&Array.isArray(o.data[t])){DATA[t]=o.data[t];n++}}
    if(!n)throw Error('tidak ada data');
    S.m=D().slice(-1)[0].slice(0,7);S.to='';S.day='';save();render();msg('Dipulihkan: '+n+' tanggal.');
  }catch(e){msg('Gagal memulihkan: '+e.message,1)}
}
function wipe(){
  const b=$('#wipe');
  if(!armed){armed=true;b.textContent='Yakin? Klik lagi untuk hapus semua';setTimeout(()=>{armed=false;b.textContent='Hapus semua data'},4000);return}
  armed=false;b.textContent='Hapus semua data';DATA={};S={m:'',to:'',p:'',day:''};
  try{localStorage.removeItem('so')}catch(e){}
  $('#q').value='';msg('Semua data dihapus.');render();
}
const dz=$('#dz');
$('#f').onchange=e=>{handle([...e.target.files]);e.target.value=''};
['dragenter','dragover'].forEach(v=>dz.addEventListener(v,e=>{e.preventDefault();dz.classList.add('on')}));
['dragleave','drop'].forEach(v=>dz.addEventListener(v,e=>{e.preventDefault();dz.classList.remove('on')}));
dz.addEventListener('drop',e=>handle([...e.dataTransfer.files]));
$('#q').oninput=()=>{S.p='';prod()};
$('#bk').onclick=backup;$('#rs').onclick=()=>$('#rf').click();$('#wipe').onclick=wipe;
$('#rf').onchange=e=>{if(e.target.files[0])restore(e.target.files[0]);e.target.value=''};
try{const l=localStorage.getItem('so');if(l)DATA=JSON.parse(l)}catch(e){}
render();
</script></body></html>`;
}
