import sys
LAD=[1,2,5,10,25,50,100,250,500,1000]
def keym(T): return LAD[T] if T<len(LAD) else 1000*2.15**(T-9)
def run(C,lpm_g,wpm_g,lpm_m,fg,hours=10,keep_key=True):
    t=0;dt=5;lv=1;xp=0;R=0;T=0;wins=0;f={};log=[]
    need=lambda n:100*1.15**(n-1)
    C0=C['C0']
    while t<hours*3600:
        rm=C['RB']**R
        g=dt*fg/60;m=dt*(1-fg)/60
        xp+=(lpm_g*g+C['MW']*lpm_m*m)*10*keym(T)*rm
        wins+=wpm_g*g*10*1.1*rm
        while xp>=need(lv): xp-=need(lv); lv+=1
        while wins>=C0*5**T: wins-=C0*5**T; T+=1
        if lv>=C['G0']+C['GS']*R:
            R+=1; lv=1; xp=0; f.setdefault(R,t)
            if not keep_key: T=0
        t+=dt
    return f,(R,T,lv)
def fm(v): return '-' if v is None else (f"{v/60:.0f}m" if v<5400 else f"{v/3600:.1f}h")
if __name__=='__main__':
    for keep in (True,False):
      for RB in (3,):
        C=dict(RB=RB,MW=0.2,C0=150,G0=15,GS=18)
        print('KEY kept' if keep else 'KEY reset', 'RB',RB)
        for n,a in {'casual':(60,8,80,.6),'median':(100,14,150,.7),'fast':(160,26,250,.75),'masher(menu only 500lpm)':(0,0,500,0)}.items():
            f,e=run(C,*a,keep_key=keep)
            print(f"  {n:26} R1 {fm(f.get(1)):>5} R3 {fm(f.get(3)):>5} R5 {fm(f.get(5)):>5} R10 {fm(f.get(10)):>5} R20 {fm(f.get(20)):>5} | 10h: R{e[0]} KEY T{e[1]} LV{e[2]}")
