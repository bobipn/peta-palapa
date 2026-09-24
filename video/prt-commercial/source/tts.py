import json, wave
from piper import PiperVoice
from piper.config import SynthesisConfig
v=PiperVoice.load('/tmp/tts/id_ID-news_tts-medium.onnx')
cfg=SynthesisConfig(length_scale=0.9, noise_scale=0.6, noise_w_scale=0.8)
L=json.load(open('vo/lines.json')); dur={}
for sid,txt in L:
    with wave.open(f'vo/{sid}.wav','wb') as w: v.synthesize_wav(txt,w,syn_config=cfg)
    with wave.open(f'vo/{sid}.wav') as w: dur[sid]=w.getnframes()/w.getframerate()
json.dump(dur,open('vo/dur.json','w'),indent=0)
for k in ['M','T','C']: print(k, round(sum(d for s,d in dur.items() if s[0]==k),1))
