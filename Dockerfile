# CLOO · Formularios de captura
#
# Los archivos van DENTRO de la imagen, no montados desde el disco.
# En Coolify los montajes relativos (./nginx/...) no apuntan al repositorio
# clonado sino a una carpeta vacia de la aplicacion, y Docker acaba creando
# un directorio donde deberia haber un archivo de configuracion.

FROM nginx:1.27-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/salud-web || exit 1
