/* ============================================================
   CLOO · Form Kit
   Motor compartido de los 4 formularios de captura de leads.

   Se encarga de:
     · idioma ES/EN (URL > memoria del navegador > idioma del sistema)
     · chips de opción única y valoración 1-5
     · campos condicionales
     · validación
     · envío al CRM y cola offline si no hay señal en el evento

   Cada formulario define su propia configuración en window.FORM_CONFIG
   antes de cargar este archivo.
   ============================================================ */
(function () {
  'use strict';

  /* --- Endpoint del CRM ------------------------------------------------
     Único punto a cambiar cuando el Panel de Clientes esté en el servidor.
     Mientras esté vacío, el formulario funciona en modo demostración:
     valida, muestra la pantalla de éxito y deja el envío en la cola local.
     -------------------------------------------------------------------- */
  var CRM_ENDPOINT = '/api/leads';           // ej: 'https://formularios.cielobreathwork.com/api/leads'
  var CRM_TOKEN    = 'AAa6XWl1j4Xs1x9Z7wWI';           // token público de captura, si el CRM lo pide

  var CFG = window.FORM_CONFIG || {};

  /* --- Diccionario común a los cuatro formularios ---------------------
     Cada formulario solo declara lo suyo; esto cubre contacto, tiempos,
     consentimiento, errores y cierre. Si un formulario repite una clave,
     la suya gana.
     -------------------------------------------------------------------- */
  var COMMON = {
    es: {
      f_name: 'Nombre y apellido',
      ph_name: 'Ej. María González',
      f_email: 'Correo electrónico',
      ph_email: 'nombre@correo.com',
      f_phone: 'Teléfono o WhatsApp',
      ph_phone: '+1 305 000 0000',
      f_company: 'Empresa u organización',
      ph_optional: 'Opcional',
      opt_pick: 'Selecciona una opción',

      f_when: '¿Para cuándo lo necesitas?',
      when_now: 'Lo antes posible',
      when_month: 'Este mes',
      when_quarter: 'En los próximos meses',
      when_exploring: 'Solo estoy explorando',

      f_contact_pref: '¿Cómo prefieres que te contactemos?',
      cp_whatsapp: 'WhatsApp',
      cp_call: 'Llamada',
      cp_email: 'Correo',

      f_note: '¿Algo más que debamos saber?',
      ph_note: 'Opcional. Un par de líneas bastan.',

      consent: 'Acepto que CLOO me contacte por correo, teléfono o WhatsApp para dar seguimiento. Puedo darme de baja cuando quiera.',
      submit: 'Enviar mis datos',
      sending: 'Enviando…',
      legal: 'Tus datos se usan solo para contactarte. No los compartimos con terceros.',

      err_banner: 'Falta completar algo. Revisa los campos marcados.',
      err_required: 'Este campo es obligatorio.',
      err_email: 'Revisa el correo electrónico.',
      err_phone: 'Revisa el número de teléfono.',
      err_choose: 'Elige una opción.',
      err_consent: 'Necesitamos tu autorización para contactarte.',

      done_title: '¡Gracias!',
      queued: 'Sin señal en este momento: tu registro quedó guardado en este dispositivo y se enviará solo al recuperar conexión.',
      again: 'Registrar a otra persona',

      admin_pending: 'registros guardados en este dispositivo, aún sin enviar al CRM.',
      admin_download: 'Descargar CSV',
      admin_clear: 'Vaciar',
      admin_confirm: 'Esto borra los registros guardados en este dispositivo y no se pueden recuperar. ¿Ya descargaste el CSV?'
    },
    en: {
      f_name: 'Full name',
      ph_name: 'e.g. Maria Gonzalez',
      f_email: 'Email address',
      ph_email: 'name@email.com',
      f_phone: 'Phone or WhatsApp',
      ph_phone: '+1 305 000 0000',
      f_company: 'Company or organization',
      ph_optional: 'Optional',
      opt_pick: 'Select an option',

      f_when: 'When do you need it?',
      when_now: 'As soon as possible',
      when_month: 'This month',
      when_quarter: 'In the coming months',
      when_exploring: 'Just exploring',

      f_contact_pref: 'How would you prefer we reach you?',
      cp_whatsapp: 'WhatsApp',
      cp_call: 'Phone call',
      cp_email: 'Email',

      f_note: 'Anything else we should know?',
      ph_note: 'Optional. A couple of lines is plenty.',

      consent: 'I agree that CLOO may contact me by email, phone or WhatsApp to follow up. I can unsubscribe at any time.',
      submit: 'Send my details',
      sending: 'Sending…',
      legal: 'Your details are used only to contact you. We never share them with third parties.',

      err_banner: 'Something is missing. Please check the highlighted fields.',
      err_required: 'This field is required.',
      err_email: 'Please check the email address.',
      err_phone: 'Please check the phone number.',
      err_choose: 'Please choose an option.',
      err_consent: 'We need your permission to contact you.',

      done_title: 'Thank you!',
      queued: 'No signal right now: your entry was saved on this device and will be sent automatically once you are back online.',
      again: 'Register someone else',

      admin_pending: 'entries saved on this device, not yet sent to the CRM.',
      admin_download: 'Download CSV',
      admin_clear: 'Clear',
      admin_confirm: 'This deletes the entries saved on this device and they cannot be recovered. Have you downloaded the CSV?'
    }
  };

  var I18N = {};
  Object.keys(COMMON).forEach(function (lg) {
    I18N[lg] = Object.assign({}, COMMON[lg], (CFG.i18n || {})[lg] || {});
  });
  var QUEUE = 'cloo_lead_queue';
  var LANG  = 'cloo_lang';

  var form, lang;

  /* =========================== IDIOMA =========================== */

  function initialLang() {
    var url = new URLSearchParams(location.search).get('lang');
    if (url && I18N[url]) return url;
    try {
      var saved = localStorage.getItem(LANG);
      if (saved && I18N[saved]) return saved;
    } catch (e) {}
    var nav = (navigator.language || 'es').slice(0, 2).toLowerCase();
    return I18N[nav] ? nav : (CFG.defaultLang || 'es');
  }

  function t(key) {
    var d = I18N[lang] || {};
    if (key in d) return d[key];
    var f = I18N[CFG.defaultLang || 'es'] || {};
    return (key in f) ? f[key] : key;
  }

  function applyLang(next) {
    lang = next;
    try { localStorage.setItem(LANG, lang); } catch (e) {}
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-ph'));
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    if (I18N[lang] && I18N[lang].page_title) document.title = I18N[lang].page_title;

    document.querySelectorAll('.lang button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
  }

  function mountLangSwitch() {
    var box = document.querySelector('.lang');
    if (!box) return;
    box.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-lang]');
      if (b) applyLang(b.dataset.lang);
    });
  }

  /* ===================== CHIPS Y CONDICIONALES ===================== */

  function mountChips() {
    document.querySelectorAll('.chips,.rating').forEach(function (group) {
      var name = group.dataset.name;
      if (!name) return;

      var hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = name;
      group.appendChild(hidden);

      group.addEventListener('click', function (ev) {
        var chip = ev.target.closest('.chip');
        if (!chip) return;
        var already = chip.getAttribute('aria-pressed') === 'true';
        group.querySelectorAll('.chip').forEach(function (c) {
          c.setAttribute('aria-pressed', 'false');
        });
        if (!already) {
          chip.setAttribute('aria-pressed', 'true');
          hidden.value = chip.dataset.value;
        } else {
          hidden.value = '';           // volver a tocar la opción la deselecciona
        }
        group.closest('.field').classList.remove('invalid');
        syncConditionals();
      });
    });
  }

  /* Muestra u oculta bloques con data-show-when="campo=valor|valor" */
  function syncConditionals() {
    document.querySelectorAll('[data-show-when]').forEach(function (block) {
      var parts  = block.dataset.showWhen.split('=');
      var field  = parts[0];
      var wanted = (parts[1] || '').split('|');
      var input  = form.querySelector('[name="' + field + '"]');
      var value  = input ? input.value : '';
      var show   = wanted.indexOf(value) !== -1;
      block.classList.toggle('on', show);
      if (!show) {
        block.querySelectorAll('input,select,textarea').forEach(function (el) {
          if (el.type === 'checkbox') el.checked = false;
          else el.value = '';
          var f = el.closest('.field');
          if (f) f.classList.remove('invalid');
        });
      }
    });
  }

  /* =========================== VALIDACIÓN =========================== */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  function isVisible(el) {
    var hidden = el.closest('[data-show-when]');
    return !hidden || hidden.classList.contains('on');
  }

  function markInvalid(el, msgKey) {
    var field = el.closest('.field');
    if (!field) return;
    field.classList.add('invalid');
    var slot = field.querySelector('.field-err');
    if (slot) slot.textContent = t(msgKey);
  }

  function validate() {
    var firstBad = null;

    form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('invalid'); });

    // texto, email, teléfono, selects, fechas
    form.querySelectorAll('input[data-req],select[data-req],textarea[data-req]').forEach(function (el) {
      if (!isVisible(el)) return;
      var v = (el.value || '').trim();
      var bad = false, key = 'err_required';

      if (!v) { bad = true; }
      else if (el.type === 'email' && !EMAIL_RE.test(v)) { bad = true; key = 'err_email'; }
      else if (el.type === 'tel' && v.replace(/[^0-9]/g, '').length < 7) { bad = true; key = 'err_phone'; }

      if (bad) { markInvalid(el, key); firstBad = firstBad || el; }
    });

    // email y teléfono opcionales pero mal escritos
    form.querySelectorAll('input[type=email]:not([data-req]),input[type=tel]:not([data-req])').forEach(function (el) {
      if (!isVisible(el)) return;
      var v = (el.value || '').trim();
      if (!v) return;
      if (el.type === 'email' && !EMAIL_RE.test(v)) { markInvalid(el, 'err_email'); firstBad = firstBad || el; }
      if (el.type === 'tel' && v.replace(/[^0-9]/g, '').length < 7) { markInvalid(el, 'err_phone'); firstBad = firstBad || el; }
    });

    // grupos de chips obligatorios
    form.querySelectorAll('.chips[data-req],.rating[data-req]').forEach(function (g) {
      if (!isVisible(g)) return;
      var h = g.querySelector('input[type=hidden]');
      if (!h || !h.value) {
        var field = g.closest('.field');
        field.classList.add('invalid');
        var slot = field.querySelector('.field-err');
        if (slot) slot.textContent = t('err_choose');
        firstBad = firstBad || g;
      }
    });

    // consentimiento
    form.querySelectorAll('input[type=checkbox][data-req]').forEach(function (el) {
      if (!isVisible(el)) return;
      if (!el.checked) {
        var field = el.closest('.field');
        if (field) {
          field.classList.add('invalid');
          var slot = field.querySelector('.field-err');
          if (slot) slot.textContent = t('err_consent');
        }
        firstBad = firstBad || el;
      }
    });

    if (firstBad) {
      var banner = document.querySelector('.form-err');
      if (banner) { banner.textContent = t('err_banner'); banner.classList.add('on'); }
      firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (firstBad.focus) try { firstBad.focus({ preventScroll: true }); } catch (e) {}
      return false;
    }
    var b = document.querySelector('.form-err');
    if (b) b.classList.remove('on');
    return true;
  }

  /* ======================== ENVÍO AL CRM ======================== */

  /* La línea comercial la decide quién pregunta, no el formulario:
     una clase de baile para una empresa es B2B aunque el formulario sea B2C. */
  var B2B_AUDIENCE = ['empresa', 'agencia'];
  var B2C_AUDIENCE = ['personal', 'particular', 'pareja', 'grupo'];

  function lineaDe(campos) {
    var d = campos.destinatario;
    if (B2B_AUDIENCE.indexOf(d) !== -1) return 'B2B';
    if (B2C_AUDIENCE.indexOf(d) !== -1) return 'B2C';
    return CFG.linea;
  }

  function collect() {
    var params = new URLSearchParams(location.search);
    var campos = {};

    form.querySelectorAll('input,select,textarea').forEach(function (el) {
      if (!el.name || el.name === 'website') return;              // honeypot fuera
      if (!isVisible(el)) return;
      if (el.type === 'checkbox') { campos[el.name] = el.checked; return; }
      var v = (el.value || '').trim();
      if (v) campos[el.name] = v;
    });

    return {
      form_id:     CFG.formId,
      servicio:    CFG.servicio,                                   // línea de servicio CLOO
      linea:       lineaDe(campos),                                // B2B | B2C
      idioma:      lang,
      evento:      params.get('evento') || params.get('event') || null,
      enviado_en:  new Date().toISOString(),
      campos:      campos,
      meta: {
        origen:     'formulario_qr',
        url:        location.href,
        referrer:   document.referrer || null,
        user_agent: navigator.userAgent,
        utm: {
          source:   params.get('utm_source'),
          medium:   params.get('utm_medium'),
          campaign: params.get('utm_campaign')
        }
      }
    };
  }

  function readQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE) || '[]'); } catch (e) { return []; }
  }
  function writeQueue(q) {
    try { localStorage.setItem(QUEUE, JSON.stringify(q)); } catch (e) {}
  }
  function enqueue(payload) {
    var q = readQueue(); q.push(payload); writeQueue(q);
  }

  function post(payload) {
    if (!CRM_ENDPOINT) return Promise.reject(new Error('sin endpoint'));

    var headers = { 'Content-Type': 'application/json' };
    if (CRM_TOKEN) headers['Authorization'] = 'Bearer ' + CRM_TOKEN;

    return fetch(CRM_ENDPOINT, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    }).then(function (r) {
      /* Un 4xx es culpa del envío y reintentarlo daría el mismo error, pero
         igual se guarda en la cola: preferimos un lead repetido que uno perdido.
         Quien revisa con ?admin=1 lo ve y decide. */
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r;
    });
  }

  /* Reintenta lo que quedó guardado cuando no había señal en el evento. */
  function flushQueue() {
    var q = readQueue();
    if (!q.length || !CRM_ENDPOINT || !navigator.onLine) return;
    var pending = q.slice();
    writeQueue([]);
    pending.forEach(function (p) {
      post(p).catch(function () { enqueue(p); });
    });
  }

  /* ===================== PANEL DE RESCATE (?admin=1) =====================
     Red de seguridad mientras el CRM no exista. Permite ver cuántos registros
     quedaron guardados en ESTE dispositivo y bajarlos como CSV antes de que se
     pierdan. No es almacenamiento: es un rescate manual.
     -------------------------------------------------------------------- */

  function toCSV(rows) {
    var cols = ['enviado_en', 'servicio', 'form_id', 'linea', 'idioma', 'evento'];
    rows.forEach(function (r) {
      Object.keys(r.campos || {}).forEach(function (k) {
        if (cols.indexOf(k) === -1) cols.push(k);
      });
    });
    var esc = function (v) {
      if (v === null || v === undefined) return '';
      return '"' + String(v).replace(/"/g, '""') + '"';
    };
    var lines = [cols.join(',')];
    rows.forEach(function (r) {
      lines.push(cols.map(function (c) {
        return esc(c in r ? r[c] : (r.campos || {})[c]);
      }).join(','));
    });
    return '﻿' + lines.join('\r\n');       // BOM para que Excel lea los acentos
  }

  function mountAdmin() {
    var p = new URLSearchParams(location.search);
    if (p.get('admin') !== '1') return;

    var q = readQueue();
    var box = document.createElement('div');
    box.className = 'admin';
    box.innerHTML =
      '<b>' + q.length + '</b> ' + t('admin_pending') +
      '<div class="admin-actions">' +
        '<button type="button" class="dl">' + t('admin_download') + '</button>' +
        '<button type="button" class="clr">' + t('admin_clear') + '</button>' +
      '</div>';
    document.querySelector('.shell').prepend(box);

    box.querySelector('.dl').addEventListener('click', function () {
      var rows = readQueue();
      if (!rows.length) return;
      var blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'leads-cloo-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    box.querySelector('.clr').addEventListener('click', function () {
      if (!confirm(t('admin_confirm'))) return;
      writeQueue([]);
      box.querySelector('b').textContent = '0';
    });
  }

  /* ======================== PANTALLA DE ÉXITO ======================== */

  function showDone(queued) {
    document.querySelector('.form-wrap').style.display = 'none';
    var done = document.querySelector('.done');
    done.classList.add('on');
    done.querySelector('.queued').classList.toggle('on', !!queued);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    form.reset();
    form.querySelectorAll('input[type=hidden]').forEach(function (h) { h.value = ''; });
    form.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
    form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('invalid'); });
    var b = document.querySelector('.form-err'); if (b) b.classList.remove('on');
    syncConditionals();
    document.querySelector('.done').classList.remove('on');
    document.querySelector('.form-wrap').style.display = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ============================ ARRANQUE ============================ */

  function init() {
    form = document.querySelector('form');
    if (!form) return;

    mountChips();
    mountLangSwitch();
    applyLang(initialLang());
    syncConditionals();

    // etiqueta del evento leída del QR (?evento=nombre-del-evento)
    var ev = new URLSearchParams(location.search).get('evento') ||
             new URLSearchParams(location.search).get('event');
    if (ev) {
      var badge = document.querySelector('.event-badge');
      if (badge) { badge.textContent = ev.replace(/[-_]/g, ' '); badge.classList.add('on'); }
    }

    // El error rojo desaparece en cuanto la persona corrige el campo.
    ['input', 'change', 'click'].forEach(function (evt) {
      form.addEventListener(evt, function (e) {
        var field = e.target.closest('.field');
        if (field) field.classList.remove('invalid');
        if (!form.querySelector('.field.invalid')) {
          var b = document.querySelector('.form-err');
          if (b) b.classList.remove('on');
        }
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.querySelector('[name=website]').value) return;      // bot
      if (!validate()) return;

      var btn = form.querySelector('button.submit');
      btn.disabled = true;
      btn.textContent = t('sending');

      var payload = collect();

      post(payload)
        .then(function () { showDone(false); })
        .catch(function () { enqueue(payload); showDone(true); })
        .then(function () {
          btn.disabled = false;
          btn.textContent = t('submit');
        });
    });

    var again = document.querySelector('.done .again');
    if (again) again.addEventListener('click', resetForm);

    mountAdmin();
    flushQueue();
    window.addEventListener('online', flushQueue);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
