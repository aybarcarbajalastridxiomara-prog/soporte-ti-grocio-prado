"""Ejecuta los bloques Python aislados de los workflows sin Docker ni servicios reales."""
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
passed = 0
skipped = 0
failed = []
for path in sorted((ROOT / ".github/workflows").glob("*.yml")):
    source = path.read_text(encoding="utf-8")
    # Los bloques incorporados en pasos Docker necesitan el entorno del workflow completo.
    steps = re.split(r"(?m)^      - name: ", source)[1:]
    for step in steps:
        name = step.splitlines()[0]
        bodies = re.findall(r"python - <<'PY'\r?\n(.*?)^          PY\s*$", step, re.M | re.S)
        if not bodies:
            continue
        if "docker " in step:
            skipped += len(bodies)
            print(f"DOCKER REQUERIDO: {path.name}: {name}", flush=True)
            continue
        for body in bodies:
            code = "\n".join(line[10:] if line.startswith(" " * 10) else line for line in body.splitlines())
            env = {**os.environ, "PYTHONPATH": str(ROOT / "backend"), "DATABASE_URL": "", "SUPABASE_URL": "", "PYTHONIOENCODING": "utf-8"}
            cwd = ROOT / "backend" if "working-directory: backend" in step else ROOT
            result = subprocess.run([sys.executable, "-c", code], cwd=cwd, env=env, text=True, encoding="utf-8", capture_output=True)
            if result.returncode:
                failed.append(f"{path.name}: {name}")
                print(result.stdout[-2500:], result.stderr[-4000:], flush=True)
            else:
                passed += 1
                print(f"OK: {path.name}: {name}\n{result.stdout[-350:]}", flush=True)
print(f"Bloques aprobados: {passed}; requieren Docker: {skipped}; fallidos: {len(failed)}", flush=True)
for item in failed:
    print(f"FALLO: {item}")
sys.exit(bool(failed))
