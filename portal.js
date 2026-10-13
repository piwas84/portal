(function() {
  'use strict';

  if (window.__iptvPortalPluginLoaded)
    return;

  window.__iptvPortalPluginLoaded = true;

  var componentName = 'iptv_portal';
  
  // Жорстко фіксуємо адрес вашого Lampac-сервера
  var portalOrigin = 'http://130.61.74.91:9118';

  function storageGet(key, fallback) {
    try {
      return Lampa.Storage.get(key, fallback);
    } catch (e) {
      return fallback;
    }
  }

  function accessToken() {
    var injected = '{token}';
    if (injected && injected !== '{token}')
      return injected;

    var stored = storageGet('account_use_token', '');
    return typeof stored === 'string' ? stored : '';
  }

  function buildAppUrl(embedded) {
    var params = new URLSearchParams();
    var uid = storageGet('lampac_unic_id', '');
    var accountEmail = storageGet('account_email', '');
    var token = accessToken();

    params.set('v', '16');
    params.set('mode', 'list');
    params.set('player', '0');
    if (embedded)
      params.set('embed', '1');
    if (uid)
      params.set('uid', uid);
    if (accountEmail)
      params.set('account_email', accountEmail);
    if (token)
      params.set('token', token);

    return portalOrigin + '/lite/iptvportal/app?' + params.toString();
  }

  function ensureStyle() {
    if (document.getElementById('iptv-portal-component-style'))
      return;

    var style = document.createElement('style');
    style.id = 'iptv-portal-component-style';
    style.textContent =
      'body.iptv-portal-open{overflow:hidden!important;}' +
      'body.iptv-portal-open .head,body.iptv-portal-open .navigation-bar,body.iptv-portal-open .menu,body.iptv-portal-open>.player{visibility:hidden!important;pointer-events:none!important;}' +
      '.iptv-portal-component{position:fixed!important;inset:0!important;z-index:2147483647!important;width:100vw!important;height:100vh!important;background:#05070a;}' +
      '.iptv-portal-component__frame{display:block;width:100%;height:100%;border:0;background:#05070a;';
    document.head.appendChild(style);
  }

  function PortalComponent(object) {
    var html = $('<div class="iptv-portal-component"></div>');
    var frame = document.createElement('iframe');
    var destroyed = false;
    var activityTimer = null;

    frame.className = 'iptv-portal-component__frame';
    frame.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
    frame.setAttribute('allowfullscreen', 'allowfullscreen');

    function resetScreensaverTimer() {
      try {
        if (window.Lampa && Lampa.Screensaver && typeof Lampa.Screensaver.resetTimer === 'function')
          Lampa.Screensaver.resetTimer();
      } catch (e) {}
    }

    function startActivityBridge() {
      stopActivityBridge();
      resetScreensaverTimer();
      activityTimer = setInterval(resetScreensaverTimer, 30000);
    }

    function stopActivityBridge() {
      if (!activityTimer)
        return;

      clearInterval(activityTimer);
      activityTimer = null;
    }

    function handlePortalMessage(event) {
      if (event && event.source !== frame.contentWindow)
        return;
      if (event && portalOrigin && event.origin && event.origin !== portalOrigin)
        return;

      var data = event && event.data;
      var type = typeof data === 'string' ? data : data && data.type;
      if (type === 'iptvportal:activity') {
        resetScreensaverTimer();
        return;
      }

      if (type !== 'iptvportal:close')
        return;

      Lampa.Activity.backward();
    }

    this.create = function() {
      ensureStyle();
      window.addEventListener('message', handlePortalMessage);
      html.append(frame);
      frame.src = buildAppUrl(true);
      return this.render();
    };

    this.start = function() {
      var self = this;
      document.body.classList.add('iptv-portal-open');
      html.show();
      startActivityBridge();
      Lampa.Controller.add('content', {
        toggle: function() {
          try {
            frame.contentWindow.focus();
          } catch (e) {}
        },
        back: function() {
          self.back();
        }
      });
      Lampa.Controller.toggle('content');
      setTimeout(function() {
        try {
          frame.contentWindow.focus();
        } catch (e) {}
      }, 100);
    };

    this.back = function() {
      Lampa.Activity.backward();
    };

    this.pause = function() {
      stopActivityBridge();
      document.body.classList.remove('iptv-portal-open');
      html.hide();
    };
    this.stop = this.pause;

    this.render = function() {
      return html;
    };

    this.destroy = function() {
      if (destroyed)
        return;

      destroyed = true;
      stopActivityBridge();
      document.body.classList.remove('iptv-portal-open');
      window.removeEventListener('message', handlePortalMessage);
      frame.src = 'about:blank';
      html.remove();
    };
  }

  function openPortal() {
    if (window.Lampa && Lampa.Activity && Lampa.Component) {
      Lampa.Activity.push({
        url: '',
        title: Lampa.Lang.translate('iptv_portal'),
        component: componentName,
        page: 1
      });
      return;
    }

    location.href = buildAppUrl(false);
  }

  function menuIcon() {
    return '<svg><use xlink:href="#sprite-broadcast"></use></svg>';
  }

  function updatePluginMeta() {
    if (!window.Lampa || !Lampa.Plugins || !Lampa.Plugins.get) return;

    try {
      var plugins = Lampa.Plugins.get();
      var descr = 'IPTV портал з каналами, EPG та переглядом через Lampa.';
      var changed = false;

      for (var i = 0; i < plugins.length; i++) {
        var plugin = plugins[i];
        var url = String(plugin && plugin.url || '');

        if (/\/iptvportal(?:\.v\d+)?\.js(?:[?#].*)?$/i.test(url)) {
          if (plugin.author !== 'LampaUA') {
            plugin.author = 'LampaUA';
            changed = true;
          }
          if (plugin.descr !== descr) {
            plugin.descr = descr;
            changed = true;
          }
        }
      }

      if (changed && Lampa.Plugins.save) Lampa.Plugins.save();
    } catch (e) {}
  }

  function inject() {
    updatePluginMeta();

    if (!window.Lampa || !Lampa.Menu || !Lampa.Menu.addButton || window.__iptvPortalMenuAdded)
      return;

    window.__iptvPortalMenuAdded = true;
    ensureStyle();
    Lampa.Component.add(componentName, PortalComponent);
    Lampa.Menu.addButton(menuIcon(), Lampa.Lang.translate('iptv_portal'), openPortal);
  }

  Lampa.Lang.add({
    iptv_portal: {
      ru: 'IPTV Portal',
      uk: 'IPTV Portal',
      en: 'IPTV Portal'
    }
  });

  if (window.appready)
    inject();
  else
    Lampa.Listener.follow('app', function(e) {
      if (e.type === 'ready')
        inject();
    });
})();
