// Original instrumental miniatures, synthesized locally; no third-party recordings.
import {mkdir,writeFile} from 'node:fs/promises';
const rate=22050,folder=new URL('../static/music/',import.meta.url);
await mkdir(folder,{recursive:true});
async function render(name,chords,beat,pattern,theme){
 const bars=chords.length*2,duration=bars*beat*4+5,buffer=new Float64Array(Math.ceil(duration*rate));
 function note(midi,start,length,volume,soft=false){
  const hz=440*Math.pow(2,(midi-69)/12),begin=Math.round(start*rate),samples=Math.min(Math.round((length+2)*rate),buffer.length-begin);
  for(let i=0;i<samples;i++){
   const t=i/rate,attack=1-Math.exp(-t*95),decay=Math.exp(-t/(soft?2.3:1.3)),release=t>length?Math.exp(-(t-length)*2.7):1;
   const phase=2*Math.PI*hz*t;
   const tone=Math.sin(phase)+.25*Math.sin(2.002*phase)*Math.exp(-t*2)+.11*Math.sin(3.005*phase)*Math.exp(-t*4)+.035*Math.sin(4.01*phase)*Math.exp(-t*5);
   buffer[begin+i]+=tone*attack*decay*release*volume;
  }
 }
 for(let bar=0;bar<bars;bar++){
  const chord=chords[bar%chords.length],time=bar*beat*4;
  note(chord[0]-12,time,beat*3,.12,true);
  for(let step=0;step<8;step++)note(chord[pattern[step%pattern.length]%chord.length],time+step*beat/2,beat*.85,.065);
  const melody=theme[bar%theme.length];if(melody)note(melody,time+beat,beat*2,.075,true);
 }
 // Short quiet room reflections, with a fade at either end for clean playlist transitions.
 for(const [delay,gain] of [[.113,.10],[.197,.075],[.307,.05]]){const n=Math.round(delay*rate);for(let i=buffer.length-1;i>=n;i--)buffer[i]+=buffer[i-n]*gain;}
 const peak=Math.max(.7,buffer.reduce((max,v)=>Math.max(max,Math.abs(v)),0)),pcm=Buffer.alloc(buffer.length*2);
 for(let i=0;i<buffer.length;i++){const fade=Math.min(1,i/(rate*1.5),(buffer.length-i)/(rate*4));pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,buffer[i]/peak))*24000*fade),i*2);}
 const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
 await writeFile(new URL(name+'.wav',folder),Buffer.concat([header,pcm]));console.log(name,Math.round(duration)+'s');
}
await render('moonlit-room',[[48,55,60,64,67],[45,52,57,60,64],[41,48,53,57,60],[43,50,55,59,62],[48,55,60,64,71],[45,52,57,60,67],[41,48,53,57,64],[43,50,55,59,67]],1.05,[1,2,3,4,3,2,1,2],[76,72,69,71,74,72,69,67]);
await render('blue-hour',[[50,57,62,65,69],[46,53,58,62,65],[41,48,53,57,60],[48,55,60,64,67],[50,57,62,65,72],[46,53,58,62,69],[43,50,55,58,62],[45,52,57,61,64]],.9,[1,3,2,4,1,3,2,3],[77,74,72,76,77,74,70,73]);
await render('little-serenade',[[48,55,60,64],[43,55,59,62],[45,52,57,60],[40,52,55,59],[41,48,53,57],[48,55,60,64],[43,50,55,59],[48,55,60,64]],.78,[1,2,3,2,1,2,3,2],[76,74,72,71,69,72,71,72]);
