-- Ejecutar manualmente después de 04 y 05, como rol de migraciones de Supabase.
BEGIN;

ALTER TABLE public.usuarios ADD COLUMN archivado boolean NOT NULL DEFAULT false;
ALTER TABLE public.usuarios ADD CONSTRAINT usuario_archivado_sin_acceso CHECK (NOT archivado OR NOT habilitado);
GRANT UPDATE (archivado) ON public.usuarios TO soporte_ti_api;
GRANT SELECT (archivado) ON public.usuarios TO soporte_ti_api;

-- Se conserva el UUID del sujeto en el historial aunque se retire su perfil.
ALTER TABLE public.auditoria_administrativa DROP CONSTRAINT auditoria_administrativa_usuario_id_fkey;
ALTER TABLE public.auditoria_administrativa DROP CONSTRAINT auditoria_administrativa_accion_check;
ALTER TABLE public.auditoria_administrativa ADD CONSTRAINT auditoria_administrativa_accion_check
    CHECK (accion IN ('EDITAR_PERFIL','INVITAR_PERFIL','HABILITAR_PERFIL','DESHABILITAR_PERFIL',
        'ARCHIVAR_PERFIL','RESTAURAR_PERFIL','ELIMINAR_PERFIL','SOLICITAR_REENVIO','SOLICITAR_RECUPERACION'));
CREATE INDEX ix_auditoria_usuario_accion_fecha
    ON public.auditoria_administrativa(usuario_id, accion, fecha_registro DESC);

CREATE FUNCTION public.validar_sujeto_auditoria()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    PERFORM 1 FROM public.usuarios WHERE id = NEW.usuario_id FOR KEY SHARE;
    IF NOT FOUND THEN
        RAISE foreign_key_violation USING MESSAGE = 'Sujeto de auditoría inexistente';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER validar_sujeto_auditoria BEFORE INSERT ON public.auditoria_administrativa
    FOR EACH ROW EXECUTE FUNCTION public.validar_sujeto_auditoria();

-- Serializa nuevas asignaciones con la retirada de acceso del técnico.
CREATE FUNCTION public.validar_tecnico_habilitado()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF NEW.fecha_fin IS NULL THEN
        PERFORM 1 FROM public.usuarios WHERE id = NEW.tecnico_id AND habilitado FOR SHARE;
        IF NOT FOUND THEN
            RAISE check_violation USING MESSAGE = 'Técnico sin acceso';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER validar_tecnico_habilitado BEFORE INSERT OR UPDATE OF tecnico_id, fecha_fin ON public.asignaciones
    FOR EACH ROW EXECUTE FUNCTION public.validar_tecnico_habilitado();
CREATE INDEX ix_asignaciones_activas_tecnico ON public.asignaciones(tecnico_id) WHERE fecha_fin IS NULL;

-- La aplicación solo recibe correo y estado. No se expone ningún secreto de Auth.
CREATE FUNCTION public.estado_auth_perfiles(p_actor uuid)
RETURNS TABLE (id uuid, correo text, activado boolean, confirmado boolean, invitado boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT a.id, a.email::text,
        a.email_confirmed_at IS NOT NULL AND NULLIF(a.encrypted_password, '') IS NOT NULL,
        a.email_confirmed_at IS NOT NULL, a.invited_at IS NOT NULL
    FROM auth.users a JOIN public.usuarios u ON u.id = a.id
    WHERE EXISTS (SELECT 1 FROM public.usuarios j WHERE j.id = p_actor AND j.habilitado AND j.rol = 'JEFE')
$$;

-- Una transacción para auditar y borrar. Las FK restrictivas protegen todo el
-- historial de negocio y el historial donde el usuario actuó como administrador.
CREATE FUNCTION public.eliminar_perfil_sin_historial(p_actor uuid, p_usuario uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    perfil public.usuarios%ROWTYPE;
BEGIN
    IF p_usuario = p_actor OR NOT EXISTS (
        SELECT 1 FROM public.usuarios WHERE id = p_actor AND habilitado AND rol = 'JEFE'
    ) THEN
        RAISE insufficient_privilege;
    END IF;
    SELECT * INTO STRICT perfil FROM public.usuarios WHERE id = p_usuario FOR UPDATE;
    IF NOT perfil.archivado THEN
        RAISE check_violation USING MESSAGE = 'Archive el perfil antes de eliminarlo';
    END IF;
    PERFORM 1 FROM auth.users WHERE id = p_usuario FOR UPDATE;
    -- Bloquea referencias con acciones automáticas fuera de las tablas internas
    -- de Auth, incluso cuando son ajenas al esquema original del sistema.
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint fk
        JOIN pg_catalog.pg_class origen ON origen.oid = fk.conrelid
        JOIN pg_catalog.pg_namespace esquema ON esquema.oid = origen.relnamespace
        WHERE fk.contype = 'f' AND fk.confdeltype NOT IN ('a', 'r')
            AND (fk.confrelid = 'public.usuarios'::regclass
                 OR (fk.confrelid = 'auth.users'::regclass AND esquema.nspname <> 'auth'))
    ) OR EXISTS (
        SELECT 1 FROM storage.objects o
        WHERE o.owner_id = p_usuario::text OR o.owner = p_usuario
    ) THEN
        RAISE foreign_key_violation USING MESSAGE = 'Existen dependencias fuera de Auth';
    END IF;
    INSERT INTO public.auditoria_administrativa (actor_id,usuario_id,accion,anterior,nuevo)
    VALUES (p_actor,p_usuario,'ELIMINAR_PERFIL',
        jsonb_build_object('usuario',perfil.usuario,'rol',perfil.rol,'area_id',perfil.area_id,'archivado',true),
        '{}'::jsonb);
    DELETE FROM public.usuarios WHERE id = p_usuario;
    DELETE FROM auth.users WHERE id = p_usuario;
    -- Hace visibles ahora las dependencias diferidas, dentro de esta operación.
    SET CONSTRAINTS ALL IMMEDIATE;
END;
$$;

REVOKE ALL ON FUNCTION public.estado_auth_perfiles(uuid), public.eliminar_perfil_sin_historial(uuid, uuid)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estado_auth_perfiles(uuid), public.eliminar_perfil_sin_historial(uuid, uuid)
    TO soporte_ti_api;

COMMIT;
