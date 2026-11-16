/** Verifica SQL de capacidades en PostgreSQL WASM en memoria. Sin DATABASE_URL. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const { PGlite } = process.argv[2] ? await import(pathToFileURL(path.resolve(process.argv[2])).href) : await import("@electric-sql/pglite")
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const source = await fs.readFile(path.join(root, "backend/app/routes/usuarios.py"), "utf8")
const query = source.match(/def permisos_administrativos_verificados[\s\S]*?db\.execute\(text\("""([\s\S]*?)"""/)?.[1]
assert(query, "SQL de capacidades no encontrado")
const db = new PGlite()
try {
  await db.exec("CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY); CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE soporte_ti_api LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;")
  for (const file of ["01_esquema_mvp.sql", "02_permisos_backend.sql", "04_administracion_perfiles.sql"]) await db.exec(await fs.readFile(path.join(root, "database", file), "utf8"))
  const capacidad = async () => {
    await db.exec("SET ROLE soporte_ti_api")
    try { return Object.values((await db.query(query)).rows[0])[0] }
    finally { await db.exec("RESET ROLE") }
  }
  assert.equal(await capacidad(), false)
  console.log("OK: 02/04 no habilitan administración mientras falta el permiso del bloqueo de áreas")
  // Solo este PostgreSQL temporal: nunca propone aplicar permisos a producción.
  await db.exec("GRANT UPDATE(activo) ON public.areas TO soporte_ti_api; CREATE POLICY prueba_bloqueo_areas ON public.areas FOR UPDATE TO soporte_ti_api USING(true) WITH CHECK(true);")
  assert.equal(await capacidad(), true)
  console.log("OK: capacidad compatible con privilegios y RLS explícitos en la fixture")
  await db.exec("ALTER TABLE public.usuarios DISABLE TRIGGER trg_validar_cupo_representantes;")
  assert.equal(await capacidad(), false)
  await db.exec("ALTER TABLE public.usuarios ENABLE TRIGGER trg_validar_cupo_representantes;")
  console.log("OK: un trigger de cupo deshabilitado impide anunciar administración disponible")
  await db.exec("CREATE POLICY prueba_restrictiva ON public.usuarios AS RESTRICTIVE FOR ALL TO soporte_ti_api USING(false) WITH CHECK(false);")
  assert.equal(await capacidad(), false)
  console.log("OK: una política restrictiva impide anunciar permisos verificados")
  assert.equal((await db.query("SELECT count(*)::integer AS n FROM public.usuarios")).rows[0].n, 0)
  console.log("FASE 112B: 5 comprobaciones de capacidades aprobadas; sin perfiles ni conexiones remotas.")
} finally { await db.close() }
