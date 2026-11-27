
"""Reglas V4 sin acceso a base de datos ni efectos secundarios."""

from dataclasses import dataclass
from typing import Literal


EstadoV4 = Literal["Pendiente", "En revisión", "Cerrado"]


class ReglaV4Invalida(ValueError):
    """La operación no cumple las reglas del flujo V4."""


@dataclass(frozen=True)
class DecisionVerificacionV4:
    estado_siguiente: EstadoV4
    ciclo_siguiente: int
    limpiar_cierre_vigente: bool
    requiere_nueva_asignacion: bool


def decidir_verificacion_v4(
    *,
    estado_actual: str,
    ciclo_actual: int,
    resultado: str,
    observaciones: str | None = None,
) -> DecisionVerificacionV4:
    """Calcula el efecto de evaluar un cierre, sin guardar cambios."""

    if type(ciclo_actual) is not int or ciclo_actual < 1:
        raise ReglaV4Invalida("El ciclo de atención no es válido.")

    if estado_actual != "Cerrado":
        raise ReglaV4Invalida("Solo se puede evaluar un ticket cerrado.")

    if resultado == "Conformidad":
        return DecisionVerificacionV4(
            estado_siguiente="Cerrado",
            ciclo_siguiente=ciclo_actual,
            limpiar_cierre_vigente=False,
            requiere_nueva_asignacion=False,
        )

    if resultado == "Observación":
        if not isinstance(observaciones, str) or not observaciones.strip():
            raise ReglaV4Invalida("La observación necesita un motivo.")

        return DecisionVerificacionV4(
            estado_siguiente="En revisión",
            ciclo_siguiente=ciclo_actual + 1,
            limpiar_cierre_vigente=True,
            requiere_nueva_asignacion=True,
        )

    raise ReglaV4Invalida("Resultado de verificación desconocido.")


def existe_solucion_final_del_ciclo(
    *,
    ciclo_actual: int,
    ciclo_intervencion: int,
    es_solucion_final: bool,
    solucion_aplicada: str | None,
) -> bool:
    """Evita usar una solución antigua para cerrar el ticket."""

    return (
        type(ciclo_actual) is int
        and ciclo_actual >= 1
        and type(ciclo_intervencion) is int
        and ciclo_intervencion == ciclo_actual
        and es_solucion_final is True
        and isinstance(solucion_aplicada, str)
        and bool(solucion_aplicada.strip())
    )
