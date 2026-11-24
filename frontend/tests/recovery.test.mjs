import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
const compile=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')
const session=compile(await fs.readFile(new URL('../src/session.ts',import.meta.url),'utf8'))
const env={VITE_API_BASE_URL:'https://api.example.invalid',VITE_SUPABASE_URL:'https://auth.example.invalid',VITE_SUPABASE_ANON_KEY:'publica-ficticia',VITE_RECUPERACION_HABILITADA:'true'}
const api=await import(compile((await fs.readFile(new URL('../src/api.ts',import.meta.url),'utf8')).replaceAll('"./session"',JSON.stringify(session)).replaceAll('import.meta.env',JSON.stringify(env))))
const fixture={access_token:'qa-acceso',refresh_token:'qa-refresh',expires_in:3600}
const json=(v,status=200)=>new Response(JSON.stringify(v),{status})
test('recuperación retira tokens, valida tipo/expiración y no admite enlaces de otro flujo',()=>{
 const old=globalThis.window;let cleaned=''
 try{
  globalThis.window={location:{hash:'#type=recovery&access_token=qa-acceso&refresh_token=qa-refresh&expires_in=3600',pathname:'/',search:''},history:{replaceState:(_a,_b,u)=>{cleaned=u}}}
  assert.equal(api.recibirEnlaceAuthReal().tipo,'recovery');assert.equal(cleaned,'/')
  window.location.hash+='&expires_at=1';assert.throws(()=>api.recibirEnlaceAuthReal(),/expiró/)
  window.location.hash='#type=signup&access_token=qa&refresh_token=qa&expires_in=3600';assert.throws(()=>api.recibirEnlaceAuthReal(),/no compatible/)
  window.location.hash='';window.location.search='?code=qa-no-reutilizable';assert.throws(()=>api.recibirEnlaceAuthReal(),/no configurado/);assert.equal(cleaned,'/')
 }finally{globalThis.window=old;api.sesionReal.limpiar()}
})
test('solicitud usa el destino propio sin query/tokens, respuesta neutra y límite local',async()=>{
 const old=globalThis.window,fetchOld=globalThis.fetch
 try{
  globalThis.window={location:{origin:'https://frontend.example.invalid',pathname:'/'}}
  globalThis.fetch=async(u,o)=>{assert.equal(new URL(u).searchParams.get('redirect_to'),'https://frontend.example.invalid/');assert.deepEqual(JSON.parse(o.body),{email:'prueba@example.invalid'});assert.equal(o.redirect,'error');return json({})}
  assert.match(await api.solicitarRecuperacionReal('prueba@example.invalid'),/Si existe/)
  await assert.rejects(api.solicitarRecuperacionReal('prueba@example.invalid'),/un minuto/)
 }finally{globalThis.window=old;globalThis.fetch=fetchOld}
})
test('restablecimiento solo envía password a la identidad verificada y termina la sesión',async()=>{
 const old=globalThis.fetch;let calls=[]
 try{
  api.sesionReal.establecer(fixture)
  globalThis.fetch=async(u,o)=>{calls.push([u,o]);if(o?.method==='PUT'){assert.deepEqual(JSON.parse(o.body),{password:'Nueva-ficticia-segura-112E'});return json({id:'qa-uuid'})}return json({id:'qa-uuid'})}
  await api.completarRecuperacionReal(fixture.access_token,'qa-uuid','Nueva-ficticia-segura-112E')
  assert.equal(calls.filter(x=>x[1]?.method==='PUT').length,1);assert(calls.some(x=>x[0].includes('logout?scope=global')));assert.equal(api.sesionReal.esSesionActual(fixture.access_token),false)
 }finally{globalThis.fetch=old;api.sesionReal.limpiar()}
})
test('identidad distinta o enlace rechazado impiden el cambio y logout revoca la sesión actual',async()=>{
 const old=globalThis.fetch
 try{
  api.sesionReal.establecer(fixture)
  globalThis.fetch=async(_u,o)=>{assert.notEqual(o?.method,'PUT');return json({id:'otra-identidad'})}
  await assert.rejects(api.completarRecuperacionReal(fixture.access_token,'qa-uuid','Nueva-ficticia-segura-112E'),/sesión terminó/)
  globalThis.fetch=async(u,o)=>{assert(u.includes('logout?scope=local'));assert.equal(o.headers.Authorization,'Bearer qa-acceso');return json({})}
  await api.cerrarSesionReal(fixture.access_token);assert.equal(api.sesionReal.esSesionActual(fixture.access_token),false)
 }finally{globalThis.fetch=old;api.sesionReal.limpiar()}
})
