import itertools
def run(C,lpm_game,wpm_game,lpm_menu,frac_game,hours=40):
    t=0;dt=10;lv=1;xp=0;R=0;S=0;P=0;wins=0;f={};rbs=0
    need=lambda n:C['NEED0']*C['G']**(n-1)
    while t<hours*3600:
        mult=C['RB']**R*(1+C['SM']*S)
        g=dt*frac_game/60;m=dt*(1-frac_game)/60
        xp+=(lpm_game*g+C['MW']*lpm_menu*m)*C['XL']*C['PE']**P*mult
        wins+=wpm_game*g*C['WW']*mult
        while xp>=need(lv): xp-=need(lv); lv+=1
        while wins>=C['PC']*C['PG']**P: wins-=C['PC']*C['PG']**P; P+=1
        gate=C['GS']*(R+1)
        if lv>=gate+1:
            lv-=gate;xp=0;R+=1;rbs+=1;f.setdefault(('R',R,S),t)
            if R>=C['AS']+C['AI']*S:
                S+=1;R=0;P=0;lv=1;f.setdefault(('S',S),t)
        t+=dt
    return f,(R,S,P,lv,rbs)
M={'casual':(60,8,80,.6),'median':(100,14,150,.7),'fast':(160,26,250,.75),'menu':(0,0,150,0)}
def fmt(v): return '-' if v is None else (f"{v/60:.0f}m" if v<5400 else f"{v/3600:.1f}h")
def report(C):
    out=[]
    for n,a in M.items():
        f,e=run(C,*a)
        out.append((n,[f.get(('R',k,0)) for k in (1,3,5,10)],f.get(('S',1)),f.get(('S',2)),f.get(('S',3)),e))
    return out
if __name__=='__main__':
    C=dict(XL=10,MW=0.2,NEED0=100,G=1.08,GS=25,RB=2.0,WW=22,PC=300,PG=8,PE=2.5,AS=10,AI=5,SM=1.0)
    for n,r,s1,s2,s3,e in report(C):
        print(f"{n:7} R1 {fmt(r[0]):>5} R3 {fmt(r[1]):>5} R5 {fmt(r[2]):>5} R10 {fmt(r[3]):>5} ★1 {fmt(s1):>5} ★2 {fmt(s2):>5} ★3 {fmt(s3):>5} | 40h R{e[0]} ★{e[1]} P{e[2]} LV{e[3]} rebirths{e[4]}")
