/* BEFORE final hackathon review cut. Source material comes from the public live product
 * and official mainnet explorer; every sample offer is labeled as a sample.
 * NO wallet connection, no onchain signing, no WIF transfer or approval.
 */
const {chromium} = require('../qa/node_modules/playwright');
const {Wallet} = require('ethers');
const {randomBytes} = require('node:crypto');
const {join} = require('node:path');
const {existsSync,mkdirSync,writeFileSync,statSync,readFileSync} = require('node:fs');
const {spawnSync} = require('node:child_process');
const base = 'https://before-web-theta.vercel.app';
const dir = join(__dirname,'media');
const output=join(__dirname,'output');
mkdirSync(dir,{recursive:true});mkdirSync(output,{recursive:true});
const voiceIds=[
'e75f7a37-d54e-415c-9acd-a612605922aa',
'6b231c58-c804-431b-9269-59af83055454',
'bbfb812d-3ad1-44eb-803b-7f47308f36c1',
'4b3dbd5c-e540-4af4-abb3-9b74944a468a',
'66d06bb1-e467-42f7-ad2e-46b2109cc8fa'
];
const txs=[
'0x4f6b1b2d48f73643408418896a7de886be4a522bf583a1c3d1d9c104c3b42476',
'0x7e5ca115c13fed7e36109478c9f454adc81c58c2c114f569624d95792f64033a'
];
const scenes=[
['01-home',7.9,'BEFORE / VERIFIED WIF SUPPORT','Signed intent. Explicit wallet action. Public proof.'],
['02-home-proof',9.788,'LIVE PRODUCTION / REAL MAINNET PROOF','A payment claim becomes evidence anyone can inspect.'],
['03-support-intro',7.8,'LIVE PRODUCTION / START HERE','Create a signed link or open a link you received.'],
['04-create',8.544,'LIVE PRODUCTION / CREATOR FLOW','Choose the amount, return suggestion and expiry.'],
['05-signed-sample',8.8,'SAMPLE SIGNED OFFER / NO PAYMENT','A real signed sample offer; no funds have moved.'],
['06-check',8.6,'SAMPLE SIGNED OFFER / NO PAYMENT','Read the exact recipient, amount and network.'],
['07-tx1',10,'REAL MAINNET WIF / FIRST RECEIPT','200 WIF confirmed on Robinhood Chain, transaction one.'],
['08-tx2',10.064,'REAL MAINNET WIF / SECOND RECEIPT','200 WIF confirmed, fresh offer, same creator.'],
['09-pay',7.2,'LIVE PRODUCTION / ONE-OFF PAY','One-off signed requests use explicit wallet confirmation.'],
['10-permissions',7.2,'LIVE PRODUCTION / READ ONLY','WIF permissions can be checked without signing.'],
['11-evidence',9.048,'OPEN SOURCE / ORIGINAL EVIDENCE','Code, test results and real transaction proof are public.']
];
function run(bin,args,timeout=180000){
 const p=spawnSync(bin,args,{encoding:'utf8',timeout,maxBuffer:1024*1024*2});
 if(p.error||p.status!==0) throw Error(bin+' failed: '+(p.stderr||p.error?.message||'unknown').slice(-1800));
 return p.stdout||'';
}
async function capture(){
 const b=await chromium.launch({headless:true,args:['--no-sandbox']});
 const p=await b.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1,colorScheme:'light'});
 const goto=async(url,expect)=>{const r=await p.goto(url,{waitUntil:'domcontentloaded',timeout:32000});if(r?.status()!==200)throw Error('HTTP '+r?.status()+' '+url);await p.waitForTimeout(900); if(expect&&!((await p.locator('body').innerText()).toLowerCase().includes(expect.toLowerCase())))throw Error('Missing '+expect+' at '+url);};
 const shot=async(name)=>{await p.screenshot({path:join(dir,name+'.png'),fullPage:false});console.log('SCREENSHOT',name)};
 try{
  await goto(base+'/','BEFORE');await shot('01-home');
  await p.locator('#evidence').scrollIntoViewIfNeeded();await shot('02-home-proof');
  await goto(base+'/app/support/','Support');await shot('03-support-intro');
  await p.locator('#support-amount').fill('200');
  await p.locator('#support-interval').selectOption('weekly');
  await p.locator('#create-support-card').scrollIntoViewIfNeeded();await shot('04-create');
  // Offline ephemeral signer is not funded and does not broadcast.
  const {supportTypedDataFor,encodeSupportPayload,WIF_TOKEN}=await import('../web/support-core.mjs');
  const signer=Wallet.createRandom();
  const offer={recipient:signer.address,token:WIF_TOKEN,chainId:4663n,
    amount:200n*10n**18n,interval:'weekly',expiresAt:BigInt(Math.floor(Date.now()/1000)+30*86400),
    campaignId:'0x'+randomBytes(32).toString('hex')};
  const typed=supportTypedDataFor(offer);const types={...typed.types};delete types.EIP712Domain;
  const signature=await signer.signTypedData(typed.domain,types,typed.message);
  const url=base+'/app/support/?offer='+encodeSupportPayload(offer,signature);
  // The private signing key stays only in process memory; it is never stored.
  await goto(url,'Support');await p.waitForTimeout(1200);
  if(await p.locator('#offer-card').isHidden())throw Error('Sample signed offer failed validation');
  await p.locator('#offer-card').scrollIntoViewIfNeeded();await shot('05-signed-sample');
  await p.locator('#check-card').scrollIntoViewIfNeeded();await shot('06-check');
  for(let i=0;i<2;i++){
    await goto('https://robinhoodchain.blockscout.com/tx/'+txs[i],'transaction');
    await p.waitForTimeout(1900);await shot(i?'08-tx2':'07-tx1');
  }
  await goto(base+'/app/pay/','WIF');await shot('09-pay');
  await goto(base+'/app/wif/','WIF');await shot('10-permissions');
  await goto('https://github.com/Iniwura/before-protocol/blob/main/docs/ISSUE_18_MAINNET_SUPPORT_EVIDENCE.md','200');await shot('11-evidence');
 } finally { await b.close(); }
}
async function downloadVo(){
 for(let i=0;i<voiceIds.length;i++){
  const url='https://storage.googleapis.com/adm--audio-playback--7d--public/mcp-preview/'+voiceIds[i]+'.mp3';
  const r=await fetch(url);if(!r.ok)throw Error('Voice preview unavailable '+i);
  const b=Buffer.from(await r.arrayBuffer());if(b.length<30000)throw Error('Incomplete voice '+i);
  writeFileSync(join(dir,'vo'+(i+1)+'.mp3'),b);
 }
}
function render(){
 const font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
 const bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
 const clips=[];
 for(let i=0;i<scenes.length;i++){
  const [name,duration,label,caption]=scenes[i];
  writeFileSync(join(dir,'l'+i+'.txt'),label);writeFileSync(join(dir,'c'+i+'.txt'),caption);
  const filter=
   "[0:v]scale=1600:900,zoompan=z='min(zoom+0.00012,1.032)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=1600x900:fps=30,format=yuv420p[img];"+
   "[1:v]drawbox=x=157:y=67:w=1606:h=906:color=0x6c6c66:t=2[bg];"+
   "[bg][img]overlay=x=160:y=70:shortest=1,"+
   'drawtext=fontfile='+bold+':textfile='+join(dir,'l'+i+'.txt')+':fontsize=21:fontcolor=0xe5e4de:x=160:y=21,'+
   'drawtext=fontfile='+font+':textfile='+join(dir,'c'+i+'.txt')+':fontsize=25:fontcolor=0xffffff:x=160:y=1003[v]';
  const clip=join(dir,'clip'+String(i).padStart(2,'0')+'.mp4');
  run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y','-loop','1','-framerate','30','-i',join(dir,name+'.png'),
    '-f','lavfi','-i','color=c=0x131313:s=1920x1080:r=30','-filter_complex',filter,'-map','[v]','-t',String(duration),
    '-c:v','libx264','-preset','superfast','-crf','24','-pix_fmt','yuv420p','-r','30','-movflags','+faststart','-threads','4',clip]);
  clips.push(clip);console.log('RENDERED',name);
 }
 const vlist=join(dir,'video_list.txt'),alist=join(dir,'audio_list.txt');
 writeFileSync(vlist,clips.map(f=>"file '"+f+"'").join('\n')+'\n');
 writeFileSync(alist,voiceIds.map((_,i)=>"file '"+join(dir,'vo'+(i+1)+'.mp3')+"'").join('\n')+'\n');
 const joined=join(dir,'joined.mp4'),vo=join(dir,'voice.m4a');
 run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',vlist,'-c','copy',joined]);
 run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',alist,'-c:a','aac','-b:a','160k',vo]);
 const final=join(output,'BEFORE_DEMO_REVIEW_1080P.mp4');
 run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',joined,'-i',vo,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','copy','-shortest','-movflags','+faststart',final]);
 const probe=JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration,size:stream=codec_type,width,height','-of','json',final]));
 if(Number(probe.format.duration)<85||Number(probe.format.duration)>120)throw Error('Unexpected duration');
 if(!probe.streams.some(s=>s.codec_type==='video'&&s.width===1920&&s.height===1080))throw Error('Not Full HD');
 if(!probe.streams.some(s=>s.codec_type==='audio'))throw Error('Missing voice');
 console.log('FINAL_VIDEO',JSON.stringify(probe),statSync(final).size+' bytes');
}
(async()=>{await capture();await downloadVo();render()})().catch(e=>{console.error(e);process.exit(1)});
