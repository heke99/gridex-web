"""Read Xcode's simulator-only identity from the actual Mach-O, not host codesign."""
import json,plistlib,struct,sys
from pathlib import Path

def inspect(data,bundle):
 def u32(b,o,endian='<'):
  if o<0 or o+4>len(b):raise ValueError('Truncated Mach-O')
  return struct.unpack_from(endian+'I',b,o)[0]
 magic=u32(data,0,'>')
 if magic==0xcafebabe:
  count=u32(data,4,'>')
  if not 1<=count<=16:raise ValueError('Invalid architecture count')
  images=[]
  for i in range(count):
   start=8+i*20;offset=u32(data,start+8,'>');size=u32(data,start+12,'>')
   if offset+size>len(data):raise ValueError('Invalid architecture bounds')
   images.append(data[offset:offset+size])
 else:images=[data]
 result=[]
 for b in images:
  if u32(b,0)!=0xfeedfacf:raise ValueError('Expected a 64-bit simulator binary')
  count=u32(b,16)
  if count>4096:raise ValueError('Invalid command count')
  cursor=32;platform=None;ent=None;sections=[]
  for _ in range(count):
   command=u32(b,cursor);size=u32(b,cursor+4)
   if size<8 or cursor+size>len(b):raise ValueError('Invalid command bounds')
   if command==0x32:platform=u32(b,cursor+8)
   if command==0x19:
    n=u32(b,cursor+64)
    if 72+n*80>size:raise ValueError('Invalid section count')
    for j in range(n):
     at=cursor+72+j*80;name=b[at:at+16].split(b'\0')[0].decode();segment=b[at+16:at+32].split(b'\0')[0].decode()
     if segment=='__TEXT' and name in ['__entitlements','__ents_der']:sections.append(name)
     if segment=='__TEXT' and name=='__entitlements':
      if ent is not None:raise ValueError('Duplicate identity section')
      length=struct.unpack_from('<Q',b,at+40)[0];offset=u32(b,at+48)
      if offset+length>len(b):raise ValueError('Invalid identity section bounds')
      ent=plistlib.loads(b[offset:offset+length].rstrip(b'\0'))
   cursor+=size
  if platform!=7:raise ValueError('Expected iOS Simulator build platform')
  if not isinstance(ent,dict):raise ValueError('Missing simulated identity section')
  identity=ent.get('application-identifier')
  if not isinstance(identity,str) or not(identity==bundle or identity.endswith('.'+bundle)):raise ValueError('Unexpected simulator app identity')
  groups=ent.get('keychain-access-groups')
  if groups is not None and groups!=[identity]:raise ValueError('Unexpected simulator keychain scope')
  result.append({'architecture':hex(u32(b,4)),'platform':platform,'sections':sections,'applicationIdentifier':identity,'keychainAccessGroups':groups,'identityScopedToBundle':True})
 return result

if __name__=='__main__':
 try:
  result=inspect(Path(sys.argv[1]).read_bytes(),sys.argv[2])
  Path(sys.argv[3]).write_text(json.dumps({'kind':'xcode-simulated-entitlements','architectures':result,'passed':True},indent=2)+'\n')
 except Exception as error:raise SystemExit('Simulator identity verification failed: '+str(error)) from None
