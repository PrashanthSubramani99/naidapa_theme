(function () {
    "use strict";

    frappe.provide("naidapa_theme");

    naidapa_theme.setup = function () {
        $('body').addClass('naidapa-theme-active');
        if (localStorage.getItem('naidapa_sidebar_collapsed') === 'true') {
            $('body').addClass('sidebar-menu-opened');
            $('.vertical-sidebar').addClass('semi-nav');
        }
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
        const logo_url = (frappe.boot && frappe.boot.sidebar_logo) || "/files/dr-codex-logo.png";
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
            () => {
                if (localStorage.getItem('naidapa_sidebar_collapsed') === 'true') {
                    $('body').addClass('sidebar-menu-opened');
                    $('.vertical-sidebar').addClass('semi-nav');
                }
            },
            naidapa_theme.remove_native_elements,
            naidapa_theme.update_sidebar_logo,
            naidapa_theme.bind_collapse_events,
            naidapa_theme.highlight_active_route,
            naidapa_theme.mutate_workspace_container,
            naidapa_theme.mutate_custom_elements,
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

    naidapa_theme.inject_navbar_toggle = function () {
        const isCollapsed = $('body').hasClass('sidebar-menu-opened');
        const iconName = isCollapsed ? 'line-md:menu-fold-right' : 'line-md:menu-fold-left';

        if ($('.header-toggle').length === 0) {
            const toggle_html = `<span class="header-toggle" style="margin-right: 15px; cursor: pointer; display: flex; align-items: center; font-size: 22px; color: var(--text-primary);"><iconify-icon icon="${iconName}"></iconify-icon></span>`;
            $('.navbar-brand').before(toggle_html);

            // Bind click event to toggle sidebar
            $('.header-toggle').on('click', function () {
                const $body = $('body');
                const $icon = $(this).find('iconify-icon');
                const $sidebar = $('.vertical-sidebar');

                if ($body.hasClass('sidebar-menu-opened')) {
                    $body.removeClass('sidebar-menu-opened');
                    $sidebar.removeClass('semi-nav');
                    $icon.attr('icon', 'line-md:menu-fold-left');
                    localStorage.setItem('naidapa_sidebar_collapsed', 'false');
                } else {
                    $body.addClass('sidebar-menu-opened');
                    $sidebar.addClass('semi-nav');
                    $icon.attr('icon', 'line-md:menu-fold-right');
                    localStorage.setItem('naidapa_sidebar_collapsed', 'true');
                }
            });
        } else {
            $('.header-toggle iconify-icon').attr('icon', iconName);
        }
    };

    naidapa_theme.mutate_custom_elements = function () {
        const changes = [
            { selector: '.old-style-class', add: 'new-style-class', remove: 'old-style-class' },
        ];

        changes.forEach(item => {
            let $el = $(item.selector);
            if (item.remove) $el.removeClass(item.remove);
            if (item.add) $el.addClass(item.add);
        });
    };

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

    naidapa_theme.remove_native_elements = function () {
        $('.layout-side-section, .sidebar-toggle-btn, .desk-sidebar').hide();
    };

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
                        chart.options.lineOptions.splines = 1;
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

    $(document).on('app_ready page-change', function () {
        naidapa_theme.run_patches();
        naidapa_theme.mutate_charts();
    });

})();