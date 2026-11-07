# ADR-0012: Entornos de desarrollo, preproducción y producción

- **Estado:** aceptada
- **Fecha:** 2026-11-07

## Contexto
El proyecto debe poder desplegarse de forma gratuita y evolucionar más adelante hacia un modelo con backend y base de datos. Los planes gratuitos de los proveedores en la nube se están recortando, y ya existe un homelab con Proxmox, Docker, Nginx Proxy Manager y Cloudflare Tunnel.

## Decisión
- **Desarrollo**: WSL 2, con el repositorio dentro del sistema de ficheros de la distro, no en `/mnt/c`.
- **Preproducción**: una máquina nueva en el homelab. La PWA se sirve con Docker y se publica con la infraestructura que ya existe (Cloudflare Tunnel y Nginx Proxy Manager), sin abrir puertos. Recibe los despliegues automáticos de `main` ([ADR-0011](0011-ci-cd.md)).
- **HTTPS obligatorio** en cualquier entorno publicado, porque el service worker solo funciona en contextos seguros. Cloudflare Tunnel lo proporciona.
- **Producción**: por decidir. Al ser una PWA estática, el MVP puede ir en cualquier hosting estático, así que la decisión se puede tomar más adelante sin quedar atado a un proveedor.

## Alternativas descartadas
- **Cloudflare como único entorno desde el principio**: sigue siendo candidato para producción, pero de momento se prefiere un entorno propio para aprender el despliegue completo.
- **PaaS gratuitos (Render, Koyeb) o Oracle Always Free**: limitaciones crecientes (bases de datos que caducan, tarjeta obligatoria, recursos recortados, instancias recuperables).

## Consecuencias
- La disponibilidad de la preproducción depende del homelab.
- Quedan pendientes el tipo de máquina en Proxmox (VM o LXC) y el despliegue concreto (servidor estático y forma del artefacto).
- Cuando haya backend, habrá que revisar esta decisión para producción.
