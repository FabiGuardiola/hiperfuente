/* Motor de los 24 espacios. Misma arquitectura FM que "retrato":
   portadora + moduladora senoidales, VCA, eco con realimentacion, setTargetAtTime. */
(function (root) {
  var NOTE = ['do','do#','re','mib','mi','fa','fa#','sol','lab','la','sib','si'];
  var UNIT = 0.24;               // duracion de 1 de las 12 unidades (s)
  var PHRASE = 12 * UNIT;

  function R(s){ return s.split(' ').map(function(x){ var a=x.split('/'); return a.length>1 ? +a[0]/+a[1] : +a[0]; }); }
  var MODES = {
    'Jónico':    { semi:[0,2,4,5,7,9,11],  txt:'1 9/8 5/4 4/3 3/2 5/3 15/8',  cells:[2,2,1,2,2,2,1], c:6, cname:'7ª mayor' },
    'Dórico':    { semi:[0,2,3,5,7,9,10],  txt:'1 9/8 6/5 4/3 3/2 5/3 9/5',   cells:[2,1,2,2,2,1,2], c:5, cname:'6ª mayor' },
    'Frigio':    { semi:[0,1,3,5,7,8,10],  txt:'1 16/15 6/5 4/3 3/2 8/5 9/5', cells:[1,2,2,2,1,2,2], c:1, cname:'2ª menor' },
    'Lidio':     { semi:[0,2,4,6,7,9,11],  txt:'1 9/8 5/4 45/32 3/2 5/3 15/8',cells:[2,2,2,1,2,2,1], c:3, cname:'4ª aumentada' },
    'Mixolidio': { semi:[0,2,4,5,7,9,10],  txt:'1 9/8 5/4 4/3 3/2 5/3 9/5',   cells:[2,2,1,2,2,1,2], c:6, cname:'7ª menor' },
    'Eolio':     { semi:[0,2,3,5,7,8,10],  txt:'1 9/8 6/5 4/3 3/2 8/5 9/5',   cells:[2,1,2,2,1,2,2], c:5, cname:'6ª menor' }
  };
  Object.keys(MODES).forEach(function(k){ MODES[k].ratio = R(MODES[k].txt); MODES[k].ratioTxt = MODES[k].txt.split(' '); });

  var MODE_OF = { M:{ fundamental:'Jónico', tercera:'Frigio', quinta:'Mixolidio' },
                  m:{ fundamental:'Dórico', tercera:'Lidio',  quinta:'Eolio' } };
  // acorde justo por rol de la tonica: [fundamental, tercera, quinta] relativo a la tonica = 1
  var CHORD = {
    M:{ fundamental:[1,5/4,3/2],   tercera:[4/5,1,6/5], quinta:[2/3,5/6,1] },
    m:{ fundamental:[1,6/5,3/2],   tercera:[5/6,1,5/4], quinta:[2/3,4/5,1] }
  };
  var ROLE_IDX = { fundamental:0, tercera:1, quinta:2 };

  var TIMBRES = [
    { name:'Órgano de flautas', short:'órgano',  ratio:2, index:0.55, att:0.035, rel:0.20, vib:0,   vibC:0,  lp:3200 },
    { name:'Cuerda frotada',    short:'cuerda',  ratio:1, index:1.70, att:0.09,  rel:0.26, vib:5.2, vibC:7,  lp:4200 },
    { name:'Voz suave',         short:'voz',     ratio:1, index:0.80, att:0.07,  rel:0.30, vib:4.6, vibC:12, lp:2300 }
  ];
  var PLANES = ['x = 0','y = 0','z = 0'];

  var BY_PLANE = [
    { '++':0, '+-':3, '-+':9,  '--':6 },    // x=0 (y,z)
    { '++':4, '+-':5, '-+':10, '--':11 },   // y=0 (z,x)
    { '++':7, '+-':1, '-+':8,  '--':2 }     // z=0 (x,y)
  ];
  function sg(s){ return s>0 ? '+' : '-'; }
  function pieceNote(p,sx,sy,sz){
    var k = p===0 ? sg(sy)+sg(sz) : p===1 ? sg(sz)+sg(sx) : sg(sx)+sg(sy);
    return BY_PLANE[p][k];
  }
  var OCT = [[1,1,1],[1,-1,1],[1,1,-1],[1,-1,-1],[-1,1,1],[-1,-1,1],[-1,1,-1],[-1,-1,-1]];

  var ROOMS = OCT.map(function(o){
    var pcs = [0,1,2].map(function(p){ return pieceNote(p,o[0],o[1],o[2]); });
    var found = null;
    pcs.forEach(function(r){
      var rest = pcs.filter(function(x){return x!==r;}).map(function(x){return (x-r+12)%12;}).sort(function(a,b){return a-b;});
      if (rest[0]===4 && rest[1]===7) found = { root:r, q:'M' };
      if (rest[0]===3 && rest[1]===7) found = { root:r, q:'m' };
    });
    return { sign:o.map(sg).join(' '), pcs:pcs, root:found.root, q:found.q };
  });

  function foldOct(r){ while (r>=2) r/=2; while (r<1) r*=2; return r; }
  function tonicFreq(pc){ var f = 261.6256*Math.pow(2,pc/12); return pc>6 ? f/2 : f; }

  var SPACES = [];
  ROOMS.forEach(function(room,ri){
    for (var p=0;p<3;p++){
      var tonic = room.pcs[p], iv = (tonic-room.root+12)%12;
      var role = iv===0 ? 'fundamental' : iv===7 ? 'quinta' : 'tercera';
      var mode = MODE_OF[room.q][role];
      var ch = CHORD[room.q][role], ri2 = ROLE_IDX[role];
      var pad = [0,1,2].filter(function(i){return i!==ri2;}).map(function(i){ return foldOct(ch[i]); });
      var f0 = tonicFreq(tonic);
      SPACES.push({ i:SPACES.length, room:ri, roomSign:room.sign, p:p, plane:PLANES[p], tonic:tonic, role:role,
        q:room.q, root:room.root, pcs:room.pcs, mode:mode, f0:f0, padR:pad, padF:pad.map(function(r){return f0*r;}) });
    }
  });

  function melodyFor(sp){
    var md = MODES[sp.mode], C = md.c;
    var base = { fundamental:[0,2,4,C,4,2,0], tercera:[2,3,4,C,2,1,0], quinta:[4,3,2,C,4,2,0] }[sp.role];
    var prev = 7 + base[0], start = 0, out = [];
    base.forEach(function(d,i){
      var best = null;
      for (var k=0;k<=2;k++){ var pos=d+7*k; if (pos<5||pos>15) continue;
        if (best===null || Math.abs(pos-prev)<=Math.abs(best-prev)) best = pos; }
      prev = best;
      var deg = best%7, oct = Math.floor(best/7), dur = md.cells[i];
      out.push({ i:i, pos:best, deg:deg, start:start, dur:dur, isChar:i===3,
        f: sp.f0*md.ratio[deg]*Math.pow(2,oct), pc:(sp.tonic+md.semi[deg])%12 });
      start += dur;
    });
    return out;
  }

  function makeBus(ctx, dest){
    var inp = ctx.createGain(), vol = ctx.createGain(), comp = ctx.createDynamicsCompressor(), an = ctx.createAnalyser();
    comp.threshold.value = -16; comp.ratio.value = 4; an.fftSize = 256;
    inp.connect(vol); vol.connect(comp); comp.connect(an); an.connect(dest);
    return { in:inp, vol:vol, analyser:an };
  }

  function fmVoice(ctx, out, vibHz, vibC){
    var c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), vca = ctx.createGain(), lfo = null;
    c.type = 'sine'; m.type = 'sine'; c.frequency.value = 100; m.frequency.value = 100; mg.gain.value = 0; vca.gain.value = 0;
    m.connect(mg); mg.connect(c.frequency); c.connect(vca); vca.connect(out);
    if (vibHz){ lfo = ctx.createOscillator(); var lg = ctx.createGain(); lfo.frequency.value = vibHz; lg.gain.value = vibC; lfo.connect(lg); lg.connect(c.detune); lfo.start(); }
    c.start(); m.start();
    return { c:c, m:m, mg:mg, vca:vca, lfo:lfo };
  }

  function makeEngine(ctx, dest, T){
    var master = ctx.createGain(); master.gain.value = 0; master.connect(dest);
    var echo = ctx.createDelay(2), fb = ctx.createGain(), send = ctx.createGain(), lp = ctx.createBiquadFilter();
    echo.delayTime.value = UNIT*1.5; fb.gain.value = 0.5; send.gain.value = 0.3;
    lp.type = 'lowpass'; lp.frequency.value = T.lp;
    lp.connect(master); lp.connect(send); send.connect(echo); echo.connect(fb); fb.connect(echo); echo.connect(master);
    var bass = fmVoice(ctx,lp,0,0), padA = fmVoice(ctx,lp,0,0), padB = fmVoice(ctx,lp,0,0), lead = fmVoice(ctx,lp,T.vib,T.vibC);
    var voices = [bass,padA,padB,lead];

    function setPitch(v,t,f,tc){
      v.c.frequency.setTargetAtTime(f,t,tc);
      v.m.frequency.setTargetAtTime(f*T.ratio,t,tc);
      v.mg.gain.setTargetAtTime(f*T.index,t,tc);
    }
    function hold(v,t,f,level){ setPitch(v,t,f,0.02); v.vca.gain.setTargetAtTime(level,t,0.4); }
    function note(v,t,dur,f,level,bright){
      v.c.frequency.setTargetAtTime(f,t,0.025);
      v.m.frequency.setTargetAtTime(f*T.ratio,t,0.025);
      v.mg.gain.setTargetAtTime(f*T.index*1.5*bright,t,0.01);
      v.mg.gain.setTargetAtTime(f*T.index,t+0.06,0.2);
      v.vca.gain.setTargetAtTime(level,t,T.att/3);
      v.vca.gain.setTargetAtTime(0,t+Math.max(dur*0.7,dur-T.rel*0.6),T.rel/3);
    }
    return {
      master:master, bass:bass, padA:padA, padB:padB, lead:lead, hold:hold, note:note,
      fadeIn:function(t){ master.gain.setTargetAtTime(1,t,0.04); },
      fadeOut:function(t){ master.gain.setTargetAtTime(0,t,0.12);
        voices.forEach(function(v){ try{ v.c.stop(t+1.5); v.m.stop(t+1.5); if(v.lfo) v.lfo.stop(t+1.5); }catch(e){} });
        var ms = Math.max(0,(t-ctx.currentTime)*1000)+1800; if (ctx.constructor.name!=='OfflineAudioContext') setTimeout(function(){ try{master.disconnect();}catch(e){} }, ms); },
      releaseAll:function(t){ voices.forEach(function(v){ v.vca.gain.setTargetAtTime(0,t,0.25); }); }
    };
  }

  function schedulePhrase(eng, sp, t0, rep){
    var mel = melodyFor(sp), u = UNIT;
    if (rep===0){
      eng.hold(eng.bass, t0, sp.f0/2, 0.16);
      eng.hold(eng.padA, t0, sp.padF[0], 0);
      eng.hold(eng.padB, t0, sp.padF[1], 0);
    }
    [eng.padA, eng.padB].forEach(function(p){
      p.vca.gain.setTargetAtTime(0.085,t0,0.6);
      p.vca.gain.setTargetAtTime(0.04,t0+6*u,0.6);
    });
    mel.forEach(function(c){
      if (rep%4===3 && c.i<3) return;
      eng.note(eng.lead, t0+c.start*u, c.dur*u, c.f, c.isChar?0.34:0.24, c.isChar?1.4:1);
    });
  }

  function renderOffline(sp, reps, sr){
    sr = sr || 44100;
    var tail = 3, len = Math.ceil((reps*PHRASE+0.1+tail)*sr);
    var ctx = new OfflineAudioContext(1,len,sr);
    var bus = makeBus(ctx,ctx.destination), eng = makeEngine(ctx,bus.in,TIMBRES[sp.p]);
    eng.master.gain.value = 1;
    for (var r=0;r<reps;r++) schedulePhrase(eng,sp,0.1+r*PHRASE,r);
    eng.releaseAll(0.1+reps*PHRASE);
    return ctx.startRendering().then(function(b){ return b.getChannelData(0); });
  }

  function wavBlob(samples, sr){
    var peak = 0; for (var i=0;i<samples.length;i++) peak = Math.max(peak,Math.abs(samples[i]));
    var g = peak>0 ? 0.89/peak : 1, n = samples.length, buf = new ArrayBuffer(44+n*2), v = new DataView(buf);
    function s(o,t){ for (var k=0;k<t.length;k++) v.setUint8(o+k,t.charCodeAt(k)); }
    s(0,'RIFF'); v.setUint32(4,36+n*2,true); s(8,'WAVE'); s(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true);
    v.setUint16(22,1,true); v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true);
    s(36,'data'); v.setUint32(40,n*2,true);
    for (var j=0;j<n;j++) v.setInt16(44+j*2, Math.max(-1,Math.min(1,samples[j]*g))*32767, true);
    return new Blob([buf],{type:'audio/wav'});
  }

  root.Audio24 = { NOTE:NOTE, UNIT:UNIT, PHRASE:PHRASE, MODES:MODES, TIMBRES:TIMBRES, PLANES:PLANES, ROOMS:ROOMS, SPACES:SPACES,
    melodyFor:melodyFor, makeBus:makeBus, makeEngine:makeEngine, schedulePhrase:schedulePhrase, renderOffline:renderOffline, wavBlob:wavBlob };
  if (typeof module!=='undefined') module.exports = root.Audio24;
})(typeof window!=='undefined' ? window : globalThis);
