# CLOO · Formularios de captura de leads

Cuatro formularios, uno por línea de servicio. Se comparten por QR en los eventos a los
que asiste el equipo; cada lead queda registrado con el evento del que salió.

**En producción:** https://forms.cloolouisville.com

| Servicio | URL |
|---|---|
| CIELO Entertainment | `/entertainment` |
| CIELO Breathwork | `/breathwork` |
| CLOO Latin Dance | `/latin-dance` |
| CLOO Performance | `/performance` |
| Generador de QR | `/qr` |

A cada una se le añade `?evento=nombre-del-evento`. Ese dato viaja hasta la base de datos
y es lo que permite saber qué networking rinde, sin preguntárselo a nadie.

---

## Qué hay aquí y qué no

```
public/          Los cuatro formularios, el motor compartido y el generador de QR
nginx/           Configuración del servidor web: URLs limpias y ruta hacia el receptor
docker-compose.yaml
```

**No están en este repositorio, a propósito:** el receptor de leads y PostgreSQL. Viven
instalados en el servidor, con la tabla `leads` ya en uso. El contenedor los alcanza por
`host.docker.internal:8090`. Se hizo así para no migrar datos que ya funcionan.

## Despliegue

Lo gestiona **Coolify**, en el mismo servidor.

- Tipo de recurso: **Docker Compose**
- Dominio: `https://forms.cloolouisville.com`
- Puerto del servicio: **80**

Al empujar cambios a `main`, Coolify vuelve a desplegar si tiene los despliegues
automáticos activados.

## Cambiar textos o preguntas

Cada formulario es un único archivo HTML autocontenido. Al final trae su diccionario
de textos en español e inglés:

```js
window.FORM_CONFIG = {
  formId: 'breathwork',
  servicio: 'breathwork',
  linea: 'B2C',
  i18n: { es: { ... }, en: { ... } }
};
```

Para cambiar una pregunta se edita ahí, en los dos idiomas. Lo que **no** conviene tocar
son los `data-value` de las opciones: son códigos estables (`estilo: "bachata"`) que la
base de datos guarda tal cual, iguales en español y en inglés. Si se cambian, los leads
viejos y los nuevos dejan de agruparse juntos.

## Cómo llegan los datos

El navegador envía a `/api/leads` un JSON con esta forma:

```json
{
  "servicio": "latin-dance",
  "linea": "B2B",
  "evento": "festival-salsa-oct",
  "campos": { "nombre": "...", "email": "...", "estilo": "salsa", "consentimiento": true },
  "meta": { "utm": {} }
}
```

Dos detalles que importan:

- **`linea` la decide quién pregunta, no el formulario.** Una clase de baile pedida por una
  empresa entra como `B2B` aunque el formulario sea B2C por defecto.
- **Si el envío falla** (sin señal en un evento), el registro queda guardado en el propio
  teléfono y se reintenta solo al recuperar conexión. Para rescatarlo a mano se abre
  cualquier formulario con `?admin=1` y se descarga un CSV.

## Sobre el token

`CRM_TOKEN`, dentro de `public/assets/form-kit.js`, viaja al navegador: **no es un secreto**,
cualquiera que abra el código de la página lo ve. Filtra envíos automáticos torpes, no es
autenticación. Lo que contiene el abuso es el límite de 20 envíos por minuto por IP del
receptor, más el campo trampa invisible del formulario.

Aun así este repositorio es privado, para no ponérselo fácil a nadie.
