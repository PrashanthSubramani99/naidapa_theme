(function () {
    "use strict";

    frappe.provide("naidapa_theme");

    // Sidebar open/closed preference.
    //
    // Sidebar open/closed preference.
    //
    // DEFAULTS TO COLLAPSED. The rail ships as a compact icon strip; the user
    // expands it by clicking the toggle.
    //
    // A naming trap worth understanding before editing this, because it caused a
    // real inversion bug: the CSS class that means COLLAPSED is called
    // `sidebar-menu-opened` / `semi-nav`. From naidapa_theme.css:
    //
    //   nav.semi-nav, body.sidebar-menu-opened nav.vertical-sidebar { width: 64px }
    //   nav.semi-nav:not(:hover) .menu-title { display: none }
    //
    // So "sidebar-menu-opened" is the COMPACT state, despite reading like the
    // opposite. `apply_sidebar_state()` below is the single place that maps intent
    // ("is_open") onto those classes; do not set them anywhere else.
    //
    // KEY IS VERSIONED, on purpose. Earlier revisions wrote a preference whose
    // meaning was inverted, under both `naidapa_sidebar_collapsed` and then
    // `naidapa_sidebar_open`. A browser that toggled the rail under either would
    // carry a stale value that silently defeats the default -- the app would look
    // permanently expanded however many times it was refreshed. `_v2` starts from
    // a clean slate, and the old keys are removed so they cannot resurface if the
    // reading logic is ever changed back.
    const SIDEBAR_PREF_KEY = 'naidapa_sidebar_open_v2';

    naidapa_theme.sidebar_is_open = function () {
        return localStorage.getItem(SIDEBAR_PREF_KEY) === 'true';
    };

    naidapa_theme.forget_legacy_sidebar_prefs = function () {
        ['naidapa_sidebar_open', 'naidapa_sidebar_collapsed'].forEach(function (key) {
            if (localStorage.getItem(key) !== null) {
                localStorage.removeItem(key);
                console.info('naidapa_theme: removed stale sidebar preference "' + key + '"');
            }
        });
    };

    // Maps INTENT onto the framework's (inverted) class names, and keeps the
    // toggle icon in step. `is_open === true`  -> full-width rail with labels.
    // `is_open === false` -> 80px compact rail.
    naidapa_theme.apply_sidebar_state = function (is_open) {
        const collapsed = !is_open;
        $('body').toggleClass('sidebar-menu-opened', collapsed);
        $('.vertical-sidebar').toggleClass('semi-nav', collapsed);
        naidapa_theme.sync_sidebar_toggle_icon(is_open);
    };

    naidapa_theme.set_sidebar_open = function (is_open) {
        localStorage.setItem(SIDEBAR_PREF_KEY, is_open ? 'true' : 'false');
        naidapa_theme.apply_sidebar_state(is_open);
    };

    naidapa_theme.setup = function () {
        $('body').addClass('naidapa-theme-active');
        // One-time cleanup of pre-versioned keys whose semantics were inverted.
        naidapa_theme.forget_legacy_sidebar_prefs();
        // apply_sidebar_state, NOT set_sidebar_open: a first visit has no stored
        // preference and must stay collapsed without writing one.
        naidapa_theme.apply_sidebar_state(naidapa_theme.sidebar_is_open());
        naidapa_theme.apply_theme_colors();
        naidapa_theme.run_patches();
    };

    // Theme Settings ships primary_color/secondary_color color pickers, but
    // nothing ever read them -- the CSS hardcodes --primary in
    // naidapa_theme.css instead, so changing the fields in the UI had no
    // visible effect. This applies them as CSS custom property overrides on
    // :root, which every rule that uses var(--primary)/var(--primary-color)
    // already picks up.
    naidapa_theme.apply_theme_colors = function () {
        const theme_settings = (frappe.boot && frappe.boot.theme_settings) || {};
        const primary = theme_settings.primary_color;
        const secondary = theme_settings.secondary_color;
        if (!primary && !secondary) return;

        const hex_to_rgb = (hex) => {
            const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : null;
        };
        const shade = (hex, percent) => {
            const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            if (!m) return hex;
            const clamp = (v) => Math.max(0, Math.min(255, v));
            const adjust = (c) => clamp(Math.round(parseInt(c, 16) * (1 + percent)));
            return `#${[m[1], m[2], m[3]].map((c) => adjust(c).toString(16).padStart(2, '0')).join('')}`;
        };

        let css = ':root {';
        if (primary) {
            css += `--primary: ${primary}; --primary-color: ${primary}; --primary-hover: ${shade(primary, -0.2)}; --ki-primary: ${hex_to_rgb(primary) || '15, 98, 106'};`;
        }
        if (secondary) {
            css += `--secondary-color: ${secondary}; --ki-secondary: ${hex_to_rgb(secondary) || '98, 98, 98'};`;
        }
        css += '}';

        let $style = $('#naidapa-theme-color-overrides');
        if (!$style.length) {
            $style = $('<style id="naidapa-theme-color-overrides"></style>').appendTo('head');
        }
        $style.text(css);
    };

    naidapa_theme.setup_icon_picker = function () {
        const $target = $('[data-fieldname="custom_animated_icon"]');
        if ($target.length && !$target.find('.btn-icon-picker').length) {
            const $label = $target.find('.control-label');
            const $btn = $(`<button class="btn btn-xs btn-default btn-icon-picker" style="margin-left: 10px; margin-top: -2px; padding: 2px 8px; font-size: 10px;">
                <iconify-icon icon="line-md:search" width="12" style="vertical-align: middle;"></iconify-icon>
                <span style="vertical-align: middle; margin-left: 4px;">Choose Icon</span>
            </button>`);

            $label.append($btn);

            $btn.on('click', (e) => {
                e.preventDefault();
                naidapa_theme.show_icon_dialog();
            });

            // Double click on input
            $target.find('input').on('dblclick', () => {
                naidapa_theme.show_icon_dialog();
            });
        }
    };

    naidapa_theme.show_icon_dialog = function () {
        const icons = [
            'account', 'alert-circle', 'arrow-close-left', 'arrow-close-right', 'arrow-close-up', 
            'arrow-down', 'arrow-down-circle', 'arrow-down-circle-twotone', 'arrow-down-square', 
            'arrow-down-square-twotone', 'arrow-left', 'arrow-left-circle', 'arrow-left-circle-twotone', 
            'arrow-left-square', 'arrow-left-square-twotone', 'arrow-long-diagonal', 'arrow-long-diagonal-rotated', 
            'arrow-open-down', 'arrow-open-left', 'arrow-open-right', 'arrow-open-up', 'arrow-right', 
            'arrow-right-circle', 'arrow-right-circle-twotone', 'arrow-right-square', 'arrow-right-square-twotone', 
            'arrow-small-down', 'arrow-small-left', 'arrow-small-right', 'arrow-small-up', 'arrow-up', 
            'arrow-up-circle', 'arrow-up-circle-twotone', 'arrow-up-square', 'arrow-up-square-twotone', 
            'arrows-diagonal', 'arrows-diagonal-rotated', 'arrows-horizontal', 'arrows-horizontal-alt', 
            'arrows-vertical', 'arrows-vertical-alt', 'backup-restore', 'beer', 'bell', 'bell-alert', 
            'briefcase', 'buy-me-a-coffee', 'cake', 'calendar', 'cancel', 'chat', 'chat-bubble', 
            'check-all', 'check-list-3', 'chevron-double-down', 'chevron-double-left', 'chevron-double-right', 
            'chevron-double-up', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 
            'circle', 'clipboard', 'close', 'cloud', 'cloud-braces-loop', 'cloud-down', 
            'cloud-download-loop', 'cloud-upload-loop', 'coffee', 'cog', 'compass', 'computer', 
            'confirm', 'construction', 'discord', 'document', 'document-add', 'document-code', 
            'document-list', 'document-remove', 'document-report', 'double-arrow-horizontal', 
            'double-arrow-vertical', 'download-loop', 'edit', 'email', 'emoji-angry', 'emoji-frown', 
            'emoji-grin', 'emoji-neutral', 'emoji-smile', 'external-link', 'facebook', 'filter', 
            'flag', 'fork-left', 'fork-right', 'gauge', 'gauge-loop', 'github', 'grid-3', 
            'hash', 'heart', 'home', 'iconify1', 'image', 'instagram', 'laptop', 'light-dark', 
            'lightbulb', 'linkedin', 'list', 'loading-loop', 'log-in', 'log-out', 'map-marker', 
            'marker', 'mastodon', 'medical-services', 'menu', 'menu-fold-left', 'menu-fold-right', 
            'menu-to-close-transition', 'minus', 'moon', 'my-location', 'navigation', 'paint-drop', 
            'patreon', 'pause', 'pencil', 'person', 'person-add', 'person-off', 'person-search', 
            'phone', 'pixelfed', 'play', 'pleroma', 'plus', 'printer', 'question', 'reddit', 
            'refresh', 'remove', 'rotate-180', 'rotate-270', 'rotate-90', 'round-360', 'search', 
            'share', 'shield', 'shopping-cart', 'speed', 'speedometer', 'square', 'star', 
            'sun', 'switch', 'telegram', 'text-box', 'text-box-multiple', 'thumbs-down', 
            'thumbs-up', 'tiktok', 'trash', 'twitter', 'upload-loop', 'user', 'video', 'watch', 'youtube'
        ];

        const d = new frappe.ui.Dialog({
            title: __('Select Animated Icon'),
            fields: [
                { label: __('Search Icons'), fieldname: 'search', fieldtype: 'Data' },
                { label: __('Icons'), fieldname: 'icon_grid', fieldtype: 'HTML' }
            ]
        });

        const render_grid = (filter = '') => {
            let html = `<div class="icon-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 12px; max-height: 450px; overflow-y: auto; padding: 15px;">`;
            icons.filter(i => i.includes(filter.toLowerCase())).forEach(icon => {
                html += `
                    <div class="icon-item text-center" data-icon="${icon}" style="padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; cursor:pointer; transition: all 0.2s; background: var(--bg-color);">
                        <iconify-icon icon="line-md:${icon}" width="28" height="28"></iconify-icon>
                        <div style="font-size: 11px; margin-top: 8px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${icon}</div>
                    </div>`;
            });
            html += `</div>`;
            d.get_field('icon_grid').$wrapper.html(html);

            d.get_field('icon_grid').$wrapper.find('.icon-item').on('mouseenter', function() {
                $(this).css({'background-color': 'var(--fg-hover-color)', 'border-color': 'var(--primary-color)', 'transform': 'scale(1.05)'});
            }).on('mouseleave', function() {
                $(this).css({'background-color': 'var(--bg-color)', 'border-color': 'var(--border-color)', 'transform': 'scale(1)'});
            }).on('click', function() {
                const selectedIcon = $(this).attr('data-icon');
                if (cur_frm) {
                    cur_frm.set_value('custom_animated_icon', selectedIcon);
                } else {
                    $('[data-fieldname="custom_animated_icon"] input').val(selectedIcon).trigger('change');
                }
                d.hide();
            });
        };

        d.fields_dict.search.$input.on('input', (e) => {
            render_grid(e.target.value);
        });

        d.show();
        render_grid();
    };

    naidapa_theme.update_sidebar_logo = function () {
        // frappe.boot.sidebar_logo is resolved server-side by
        // naidapa_theme.branding.get_logo(), so this stays in step with the
        // <img> that ocean_sidebar.html rendered. The old fallback here was
        // "/files/dr-codex-logo.png", which does not exist on this site.
        const logo_url =
            (frappe.boot && frappe.boot.sidebar_logo) ||
            "/assets/frappe/images/frappe-framework-logo.svg";
        const $appLogo = $('.vertical-sidebar .app-logo');

        if ($appLogo.length) {
            let $img = $appLogo.find('img');
            if ($img.length === 0) {
                $appLogo.html(`
                    <a class="logo d-inline-block" href="/app" title="Home">
                        <img src="${logo_url}" alt="Logo" style="max-height: 42px; max-width: 180px; object-fit: contain;">
                    </a>
                `);
            } else if ($img.attr('src') !== logo_url) {
                $img.attr('src', logo_url);
            }
        }
    };

    naidapa_theme.toggle_collapse = function (el, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) {
                event.stopImmediatePropagation();
            }
        }

        const $link = $(el);
        let $target = $link.next('ul.collapse');

        if ($target.length === 0) {
            const targetId = $link.attr('data-bs-target') || $link.attr('href');
            if (targetId && targetId.startsWith('#')) {
                $target = $(targetId);
            }
        }

        if ($target.length) {
            const isShown = $target.hasClass('show') || $target.is(':visible');
            if (isShown) {
                $target.removeClass('show').slideUp(200);
                $link.addClass('collapsed').attr('aria-expanded', 'false');
            } else {
                $target.addClass('show').slideDown(200);
                $link.removeClass('collapsed').attr('aria-expanded', 'true');
            }
        }
        return false;
    };

    naidapa_theme.bind_collapse_events = function () {
        $(document).off('click.naidapa_collapse', '.vertical-sidebar [data-bs-toggle="collapse"]').on('click.naidapa_collapse', '.vertical-sidebar [data-bs-toggle="collapse"]', function (e) {
            naidapa_theme.toggle_collapse(this, e);
        });
    };

    naidapa_theme.run_patches = function () {
        // This runs from inside patched frappe.views[*].make() methods, which
        // Desk itself calls synchronously while booting (frappe.Application's
        // constructor). An uncaught throw here propagates out of that
        // constructor and aborts `frappe.app = new frappe.Application()`,
        // silently leaving frappe.app as an empty stub for the rest of the
        // session (e.g. frappe.app.logout stops existing). Each step is
        // isolated so one broken patch can't take down Desk boot.
        const steps = [
            // Re-assert the stored open/closed choice. This runs on every view
            // render, so it must go through the same helper as the toggle --
            // the old inline copy here read a different key and could fight the
            // toggle for control of the sidebar class.
            // Re-assert WITHOUT persisting: this runs on every view render and must
            // not rewrite the user's stored choice.
            () => naidapa_theme.apply_sidebar_state(naidapa_theme.sidebar_is_open()),
            naidapa_theme.update_sidebar_logo,
            naidapa_theme.bind_collapse_events,
            naidapa_theme.highlight_active_route,
            naidapa_theme.mutate_workspace_container,
            naidapa_theme.inject_navbar_toggle,
            naidapa_theme.mutate_number_cards,
            naidapa_theme.setup_icon_picker,
        ];
        steps.forEach((step) => {
            try {
                step();
            } catch (e) {
                console.error('naidapa_theme: patch step failed', e);
            }
        });
    };

    naidapa_theme.mutate_number_cards = function () {
        $('.number-widget-box').each(function (index) {
            $(this).attr('data-color-index', index % 4);
        });
    };

    // Is there anything for the toggle to actually toggle?
    //
    // The button controls the theme's own rail (`nav.vertical-sidebar`), so it is
    // meaningless when that rail is absent or has no navigation in it. The rail
    // markup is rendered on every desk page, but its menu only populates when
    // `menu_data` resolves to at least one item -- on a page with no visible
    // workspaces the rail is an empty shell, and a collapse/expand control over
    // an empty rail is just noise.
    naidapa_theme.sidebar_has_content = function () {
        const $rail = $('nav.vertical-sidebar');
        if ($rail.length === 0) return false;
        return $rail.find('.main-nav > li').length > 0;
    };

    // The button's icon states what clicking it will DO, not what the sidebar
    // currently is:
    //   sidebar COLLAPSED -> "fold-right" (click expands it)
    //   sidebar EXPANDED  -> "fold-left"  (click collapses it)
    //
    // Takes `is_open` explicitly rather than reading a class, because the class
    // that means COLLAPSED is called `sidebar-menu-opened` -- reading it here was
    // what made the arrow point the wrong way. Callers that already know the
    // intent should pass it; with no argument we derive it, safely.
    naidapa_theme.sync_sidebar_toggle_icon = function (is_open) {
        if (typeof is_open !== 'boolean') {
            is_open = !$('body').hasClass('sidebar-menu-opened');
        }
        $('.header-toggle iconify-icon').attr(
            'icon',
            is_open ? 'line-md:menu-fold-left' : 'line-md:menu-fold-right'
        );
    };

    naidapa_theme.inject_navbar_toggle = function () {
        // Show the control only where it does something. `.navbar-brand` is the
        // injection point; it is present on every desk page, so presence of the
        // anchor is not a signal -- presence of sidebar *content* is.
        if (!naidapa_theme.sidebar_has_content()) {
            $('.header-toggle').remove();
            return;
        }

        if ($('.header-toggle').length === 0) {
            // Spacing is owned by the stylesheet (`.header-toggle` rules in
            // naidapa_theme.css), NOT by an inline style here. The inline
            // `margin-right` this used to carry made the button's horizontal
            // geometry un-overridable from CSS, which is what left it misaligned
            // against Frappe's own `.sidebar-toggle-btn` in the page head.
            const toggle_html = `<span class="header-toggle" role="button" tabindex="0" aria-label="${__('Toggle Sidebar')}" title="${__('Toggle Sidebar')}"><iconify-icon icon="line-md:menu-fold-right"></iconify-icon></span>`;
            $('.navbar-brand').before(toggle_html);

            $('.header-toggle').on('click', function () {
                // Clicking TOGGLES: if the rail is presently compacted
                // (`sidebar-menu-opened` == collapsed), the click expands it.
                const currently_collapsed = $('body').hasClass('sidebar-menu-opened');
                naidapa_theme.set_sidebar_open(currently_collapsed);
            });
        }

        // Always re-sync: the icon must match current state on every pass, not
        // only the first time the button is injected.
        naidapa_theme.sync_sidebar_toggle_icon();
    };

    // NOTE: `naidapa_theme.mutate_custom_elements` used to live here. It only
    // rewrote `.old-style-class` -> `.new-style-class`, and neither class exists
    // anywhere in Frappe, ERPNext or this theme -- a full-tree grep for both
    // returns nothing. It was a no-op running a jQuery query on every
    // run_patches() pass, i.e. on every view render and every MutationObserver
    // frame. Removed rather than left as a template.

    naidapa_theme.highlight_active_route = function () {
        const current_path = window.location.pathname.toLowerCase();
        // frappe.get_route_str() reads frappe.router.current_route, which isn't
        // assigned yet the first time a view's make() runs during Desk startup
        // (this function is called from patched view classes below, so it can
        // fire before frappe.router exists) -- reading it then throws and, since
        // that first call happens synchronously inside frappe.Application's
        // constructor, aborts `frappe.app = new frappe.Application()` entirely,
        // leaving frappe.app as an empty stub with no .logout().
        const route_str = (
            typeof frappe !== 'undefined' && frappe.router && frappe.router.current_route && frappe.get_route_str
                ? frappe.get_route_str()
                : ''
        ).toLowerCase();

        $('.main-nav li').removeClass('active');
        $('.main-nav a').removeClass('active');
        $('.main-nav a.sidebar-group-header').removeClass('has-active-child');

        // route_str segments, normalized the same way page_slug is (spaces ->
        // hyphens), so "request for quotation" becomes "request-for-quotation"
        // and can only exact-match a link's own slug -- not merely contain it
        // as a substring. A plain route_str.includes(page_slug) check used to
        // live here and wrongly lit up e.g. the "/app/quotation" link whenever
        // the current route was "Request for Quotation" (its route string ends
        // in the word "quotation", so it "contained" every shorter slug too).
        const route_segments = route_str.split('/').map((s) => s.trim().replace(/\s+/g, '-'));

        $('.main-nav a').each(function () {
            let raw_href = $(this).attr('href') || '';
            if (!raw_href || raw_href.startsWith('javascript')) return;

            // Split off any "?field=value" filter suffix (see
            // naidapa_theme/events/sidebar.py) separately: once Frappe's SPA
            // router takes over, the address bar doesn't reliably keep query
            // strings in sync with the current list view's filters, so path
            // and filter state need to be checked against different sources
            // of truth -- the URL for the path, frappe.route_options (the
            // list view's actual live filter state) for the filter.
            let [href_path, href_query] = raw_href.toLowerCase().split('?');
            let page_slug = href_path.replace('/app/', '').replace('/', '');

            let path_matches = current_path === href_path || (page_slug && route_segments.includes(page_slug));
            if (!path_matches) return;

            let filters_match = true;
            if (href_query) {
                const params = new URLSearchParams(href_query);
                const route_options = (typeof frappe !== 'undefined' && frappe.route_options) || {};
                for (const [key, value] of params) {
                    const active_value = route_options[key];
                    if (String(active_value || '').toLowerCase() !== value.toLowerCase()) {
                        filters_match = false;
                        break;
                    }
                }
            }

            if (filters_match) {
                $(this).addClass('active');
                $(this).closest('li').addClass('active');

                // If active item is inside a collapsible group box, expand the group automatically
                const $groupBox = $(this).closest('ul.collapse');
                if ($groupBox.length) {
                    $groupBox.addClass('show').show();
                    const $groupHeader = $groupBox.prev('a.sidebar-group-header');
                    if ($groupHeader.length) {
                        $groupHeader.removeClass('collapsed').attr('aria-expanded', 'true');
                        $groupHeader.addClass('has-active-child');
                    }
                }
            }
        });
    };

    // NOTE: `naidapa_theme.remove_native_elements` used to live here:
    //
    //   $('.layout-side-section, .sidebar-toggle-btn, .desk-sidebar').hide();
    //
    // It was removed because hiding `.layout-side-section` deleted stock
    // features rather than restyling them. That class is a SHARED container
    // Frappe creates once per page (frappe/public/js/frappe/ui/page.js:101) and
    // reuses for the form sidebar (Assigned To / Attachments / Tags / Share /
    // Likes / Follow), the list-view filter rail, global search and print
    // preview. Hiding `.sidebar-toggle-btn` also removed the user's only way to
    // bring the rail back.
    //
    // The stylesheet now owns this decision and hides only the native
    // *workspace* rail, via the workspace-only `.desk-sidebar` selector. A JS
    // sweep re-asserting it on every view render and every MutationObserver
    // frame was both redundant and pure cost.
    //
    // Regression guard: myWorks/scripts/check_shared_ui_hides.py

    naidapa_theme.mutate_workspace_container = function () {
        const selectors = [
            '#body > .content > .container',
            '#body > .content > .page-head > .container',
            '.page-body.container'
        ];

        selectors.forEach(selector => {
            $(selector).removeClass('container').addClass('container-fluid');
        });
    };

    // Premium Gradient Line Chart Injector
    naidapa_theme.mutate_charts = function () {
        // Inject the SVG linear gradient globally if it doesn't exist to ensure correct namespace rendering
        if ($('#naidapa-global-gradient').length === 0) {
            const svgHTML = `
                <svg id="naidapa-global-gradient" width="0" height="0" style="position:absolute; width:0; height:0;">
                    <defs>
                        <linearGradient id="naidapa-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stop-color="#0d6b59" />
                            <stop offset="40%" stop-color="#10b981" />
                            <stop offset="65%" stop-color="#73c76b" />
                            <stop offset="85%" stop-color="#d4dda0" />
                            <stop offset="100%" stop-color="#fdf4d6" />
                        </linearGradient>
                    </defs>
                </svg>
            `;
            $('body').append(svgHTML);
        }

        // Vue components in Frappe Workspace bypass the frappe.Chart global constructor.
        // We force splines directly on rendered instances.
        $('.frappe-chart').each(function () {
            try {
                let container = $(this).get(0);
                let chart = $(container).data('chart') || (container.__vue__ && container.__vue__.chart);

                if (chart && !chart._naidapa_splined) {
                    chart._naidapa_splined = true;
                    if (chart.options && (chart.options.type === 'line' || chart.options.type === 'axis-mixed')) {
                        chart.options.lineOptions = chart.options.lineOptions || {};
                        // NOTE: `spline` is SINGULAR. This line used to read
                        // `splines`, which frappe-chart never reads, so the
                        // smoothed-curve effect this function exists to create
                        // never actually applied. Verified against the library
                        // bundle: it reads lineOptions.spline / .hideDots /
                        // .regionFill / .showDots / .trailingDot.
                        // See https://frappe.io/charts/docs/basic/trends_regions
                        chart.options.lineOptions.spline = 1;
                        chart.options.lineOptions.hideDots = 1;
                        chart.options.lineOptions.regionFill = 0;
                        chart.draw(); // Redraws with splines correctly!
                    }
                }
            } catch (e) { }
        });
    };

    const view_names = ["ListView", "FormView", "KanbanView", "ReportView", "GanttView", "Workspace"];
    view_names.forEach(name => {
        const Orig = frappe.views[name];
        if (!Orig) return;

        frappe.views[name] = class extends Orig {
            make() {
                super.make();
                naidapa_theme.run_patches();
            }
        };
    });

    // Debounced via rAF: running the full run_patches() pass synchronously on
    // every single DOM mutation (e.g. a frappe.confirm()/Dialog modal being
    // inserted) can race with the browser's own click handling on the node
    // that triggered the mutation, dropping the click. Coalescing bursts of
    // mutations into a single patch pass on the next frame avoids that.
    let patch_scheduled = false;
    const schedule_patches = function () {
        if (patch_scheduled) return;
        patch_scheduled = true;
        requestAnimationFrame(() => {
            patch_scheduled = false;
            naidapa_theme.run_patches();
        });
    };

    const observer = new MutationObserver(() => {
        schedule_patches();
    });

    $(document).ready(() => {
        naidapa_theme.setup();
        naidapa_theme.mutate_charts(); // Try patching immediately
        observer.observe(document.body, { childList: true, subtree: true });
    });

    // `page-change` covers the SPA route changes that do NOT re-run a view's
    // make() (and therefore previously left the rail expanded). Both events are
    // wired to the same idempotent pass, so applying it more than once is safe.
    $(document).on('app_ready page-change', function () {
        naidapa_theme.apply_sidebar_state(naidapa_theme.sidebar_is_open());
        naidapa_theme.run_patches();
        naidapa_theme.mutate_charts();
    });

})();