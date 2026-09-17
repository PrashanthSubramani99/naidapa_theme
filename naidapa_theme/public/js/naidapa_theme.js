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
        // `naidapa-sidebar-open` is the readable, intent-stating class: it is what
        // the narrow-viewport rules key off (see the mobile block in the
        // stylesheet). They used to key off `sidebar-menu-opened`, which means
        // CLOSED -- so on phones/tablets the 286px rail was pinned OPEN over the
        // content whenever the sidebar was meant to be closed, hiding the page
        // (and burying the page-head toggle underneath it).
        $('body').toggleClass('naidapa-sidebar-open', is_open);
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
        naidapa_theme.apply_page_sidebar_state(naidapa_theme.page_sidebar_is_open());
        // Before the first patch pass, in case the icon sprite was already
        // fetched and inserted while the document was still parsing.
        naidapa_theme.apply_panel_toggle_icon();
        naidapa_theme.bind_page_sidebar_toggle();
        naidapa_theme.apply_theme_colors();
        naidapa_theme.run_patches();

        // Only NOW let the rail (and the content offset that carries the toggle
        // button) animate. The state above has just been applied -- in the normal
        // case it was already applied pre-paint by the inline script in
        // www/app.html, so this is a no-op; if storage was unavailable it is an
        // instant snap rather than a 300ms slide that eats clicks aimed at the
        // moving button (see `.naidapa-sidebar-settled` in naidapa_theme.css).
        // rAF so the frame above is painted first, plus a timeout fallback because
        // rAF does not fire in a background tab.
        const settle = () => document.body.classList.add('naidapa-sidebar-settled');
        if (window.requestAnimationFrame) window.requestAnimationFrame(settle);
        window.setTimeout(settle, 250);
    };

    // -------------------------------------------------------------------------
    // PAGE-LEVEL SIDEBAR -- Frappe's `.sidebar-toggle-btn`
    // -------------------------------------------------------------------------
    // NOT the same thing as the theme rail handled above, and not the
    // `.desk-sidebar` the theme hides. This is the per-page panel Frappe mounts
    // in `.layout-main > .layout-side-section` and fills with the form sidebar
    // (Assigned To, Attachments, Tags, Share) or, on list views, the filter rail.
    //
    // DEFAULT CLOSED, on every page: the panel starts collapsed so the content
    // column spans the full width, and the user opens it with the toggle. The
    // DEFAULT itself lives in the stylesheet
    // (`body:not(.naidapa-page-sidebar-open)`, i.e. hidden from the first paint
    // and with no JS needed to get there); this key only records a user who
    // deliberately opened it, so their choice survives navigation.
    const PAGE_SIDEBAR_PREF_KEY = 'naidapa_page_sidebar_open';

    naidapa_theme.page_sidebar_is_open = function () {
        return localStorage.getItem(PAGE_SIDEBAR_PREF_KEY) === 'true';
    };

    // The panel is shown only when it is actually rendered at a non-zero width:
    // `:visible` alone is not enough, because the collapsed state is a WIDTH
    // collapse (the element still has height, so jQuery calls it visible).
    naidapa_theme.page_sidebar_is_visible = function () {
        const $panel = $('.layout-main > .layout-side-section');
        return $panel.length > 0 && $panel.is(':visible') && $panel.width() > 0;
    };

    // Frappe's own convention, kept so the button never disagrees with the rest
    // of Desk (frappe/public/js/frappe/ui/page.js update_sidebar_icon):
    //   panel OPEN   -> "collapse" icon, `>>` (clicking closes it)
    //   panel CLOSED -> "expand"   icon, `<<` (clicking opens it)
    // Derived from the DOM rather than from our stored preference, because
    // Frappe also hides the panel by itself (e.g. on an unsaved document it adds
    // `.hide-sidebar`), and the button must describe what is on screen.
    //
    // These two ids now render two DIFFERENT panel glyphs (apply_panel_toggle_icon
    // below): a hollow left column when closed, a filled one when open -- so this
    // alternation still changes what the user sees, same as it always did for
    // Frappe's own chevrons. This also means that if the sprite symbols are ever
    // not ours (a Frappe upgrade renaming them, a page that never loads the
    // sprite), the button falls back to Frappe's own state-correct chevrons
    // rather than to a blank or wrong-direction icon.
    naidapa_theme.sync_page_sidebar_toggle_icon = function () {
        $('.page-head .sidebar-toggle-btn .sidebar-toggle-icon use').attr(
            'href',
            naidapa_theme.page_sidebar_is_visible()
                ? '#es-line-sidebar-collapse'
                : '#es-line-sidebar-expand'
        );
    };

    naidapa_theme.apply_page_sidebar_state = function (is_open) {
        $('body').toggleClass('naidapa-page-sidebar-open', is_open);
        naidapa_theme.sync_page_sidebar_toggle_icon();
    };

    // -------------------------------------------------------------------------
    // PAGE-HEAD TOGGLE ICON: Frappe's `<<` / `>>` chevrons -> a "panel" icon
    // -------------------------------------------------------------------------
    // On request (2026-09-16) the page-sidebar toggle draws a panel glyph
    // (a rounded frame with a divided-off left column) instead of the double
    // chevron. First shipped as ONE glyph in both states; user feedback
    // (2026-09-16, follow-up) was that this reads as broken -- the button never
    // visibly reacts to its own click, so it looks like it "unconditionally"
    // does the same thing regardless of state. Kept the panel family (not a
    // revert to chevrons) but now the LEFT COLUMN is filled solid when the panel
    // is open (clicking closes it) and left hollow when closed (clicking opens
    // it) -- the same open/closed convention Frappe's own chevrons encoded,
    // expressed in the new glyph instead of abandoning state entirely.
    //
    // WHY THE SPRITE SYMBOLS AND NOT THE `<use href>`:
    // Frappe renders this icon from two places, and one of them rewrites the
    // button's inner markup on EVERY click:
    //   * `frappe/public/js/frappe/ui/page.html` server-templates the initial
    //     `<use href="#es-line-sidebar-collapse">`
    //   * `page.js update_sidebar_icon()` re-creates it from
    //     `frappe.utils.icon("es-line-sidebar-expand" | "es-line-sidebar-collapse")`
    //     (:240) -- so anything that just points the existing `<use>` elsewhere
    //     is undone by Frappe on the next click, and by any other Frappe re-render
    //     (resize, page re-setup) that our patch passes never see.
    // Redefining the two SYMBOLS leaves every one of those paths drawing our path
    // data, with no re-sync race to lose: the initial server markup, Frappe's own
    // re-render, and our own passes all resolve to the same two ids.
    //
    // Scoped by evidence, not by hope: `grep -rn "es-line-sidebar-expand"` over
    // frappe + erpnext matches exactly those two files -- these symbols are used
    // by nothing but this one button, so redefining them cannot leak into other
    // Desk UI. The sprite itself is fetched into `#all-symbols` by
    // `www/app.html` AFTER this script loads, so the pass has to be repeatable:
    // it is in run_patches() (every view render + every MutationObserver pass,
    // and the sprite insertion is itself a body mutation) and runs again in
    // setup() for the case where the sprite won the race.
    //
    // Geometry is NOT hand-waved -- it was fitted to the reference image the icon
    // was requested from (18x18px ink, 2px stroke) by rendering candidates in
    // Chromium and matching the alpha-weighted signature: divider centreline at
    // 0.38 of the frame's width, stroke 0.083 x width, square frame. In the 16px
    // box the espresso sprite uses, that is a 12.4 frame (outer edges 1..15, the
    // same frame Frappe's own `es-line-*` icons occupy) with rx 1.25, stroke 1.05
    // and the divider at x=6.55 -- measured match: divider 0.381 vs 0.382, stroke
    // ratio 0.0836 vs 0.0836.
    //
    // `fill="none"` on the frame and divider is load-bearing: `.es-icon` sets
    // `fill: var(--icon-stroke)`, so an unfilled attribute would paint the whole
    // frame as a solid block. The explicit `stroke` is what colours them (a
    // presentation attribute on the shape beats the inherited
    // `stroke: var(--icon-fill)` from `.es-icon`),
    // and it is the SAME variable the chevrons were filled with, so the icon keeps
    // the theme's icon colour in light and dark mode alike.
    const PANEL_ICON_FRAME =
        '<rect x="1.8" y="1.8" width="12.4" height="12.4" rx="1.25" fill="none" ' +
        'stroke="var(--icon-stroke)" stroke-width="1.05"/>' +
        '<line x1="6.55" y1="1.8" x2="6.55" y2="14.2" fill="none" ' +
        'stroke="var(--icon-stroke)" stroke-width="1.05"/>';

    // CLOSED (expand symbol -- clicking OPENS the panel): the left column is
    // hollow, matching the frame -- there is nothing on screen yet.
    const PANEL_ICON_MARKUP_EXPAND = PANEL_ICON_FRAME;

    // OPEN (collapse symbol -- clicking CLOSES the panel): the left column is
    // filled solid. Sits UNDER the divider line (drawn first, same frame), so
    // the divider stroke still reads crisply on top of the fill. Right edge of
    // the fill is intentionally square (only the outer frame corners are
    // rounded) -- it butts against the divider, not the outer border, so a
    // square inner edge there is correct, not a rendering artifact.
    const PANEL_ICON_MARKUP_COLLAPSE =
        '<rect x="1.8" y="1.8" width="4.75" height="12.4" rx="1.25" ' +
        'fill="var(--icon-stroke)" stroke="none"/>' + PANEL_ICON_FRAME;

    const PANEL_ICON_VARIANTS = {
        'es-line-sidebar-expand': PANEL_ICON_MARKUP_EXPAND,
        'es-line-sidebar-collapse': PANEL_ICON_MARKUP_COLLAPSE,
    };

    naidapa_theme.apply_panel_toggle_icon = function () {
        Object.keys(PANEL_ICON_VARIANTS).forEach(function (id) {
            const symbol = document.querySelector('symbol#' + id);
            if (!symbol) return;                                   // sprite not fetched yet
            if (symbol.getAttribute('data-naidapa-panel') === id) return;   // idempotent
            symbol.setAttribute('viewBox', '0 0 16 16');
            symbol.setAttribute('fill', 'none');
            symbol.innerHTML = PANEL_ICON_VARIANTS[id];
            // Marked LAST, so a throw halfway through leaves the symbol unmarked
            // and the next pass retries it instead of leaving a broken icon.
            symbol.setAttribute('data-naidapa-panel', id);
        });
    };

    // Frappe's click handler (page.js setup_sidebar_toggle) flips the panel with
    // an INLINE display on desktop, and opens it as an off-canvas OVERLAY on phone
    // / tablet widths. Our own handler has to drive both paths, because the button
    // it is attached to may be one we RE-CREATED (see
    // sync_page_sidebar_toggle_presence) and a re-created element carries none of
    // Frappe's bindings -- measured: `jQuery._data(button, 'events')` was empty
    // after a remove/re-insert cycle, which is why tapping the toggle on a phone
    // did nothing.
    naidapa_theme.set_page_sidebar_open = function (is_open) {
        localStorage.setItem(PAGE_SIDEBAR_PREF_KEY, is_open ? 'true' : 'false');
        naidapa_theme.apply_page_sidebar_state(is_open);

        if (frappe.utils.is_xs() || frappe.utils.is_sm()) {
            const page = window.cur_page;
            if (!page) return;
            if (is_open && page.setup_overlay_sidebar) {
                page.setup_overlay_sidebar();
            } else if (!is_open && page.close_sidebar) {
                page.close_sidebar();
            }
            return;
        }

        // Desktop: normalise the inline display Frappe's own handler leaves behind,
        // or it silently wins later (an inline `display: none` would keep the panel
        // hidden even after the user opened it, since the stylesheet only collapses
        // the panel by width).
        $('.layout-main > .layout-side-section').css('display', is_open ? 'block' : '');
    };

    naidapa_theme.bind_page_sidebar_toggle = function () {
        const handler = function () {
            // Toggle our own intent, never the DOM: reading visibility here would
            // be wrong, because the panel is still collapsed by width at this point
            // in the click.
            naidapa_theme.set_page_sidebar_open(!naidapa_theme.page_sidebar_is_open());
        };
        naidapa_theme.bind_toggle('.page-head .sidebar-toggle-btn', 'naidapa_page_sidebar', handler);
    };

    // Bind a toggle handler BOTH delegated (document) and directly on the element.
    //
    // Why both, and why this is not belt-and-braces paranoia -- MEASURED 2026-09-16,
    // on /app/buying with a real click:
    //
    //   doc-capture : target=<use>, isConnected=true,  chain "use < svg < SPAN.sidebar-toggle-icon < BUTTON..."
    //   button-mutation : childList, removed "#text,svg,#text", added "svg"   <-- Frappe
    //                     re-renders the button's inner markup DURING the click
    //   doc-bubble  : target=<use>, isConnected=FALSE, chain "use < svg"
    //
    // A delegated selector is matched by walking UP from event.target, so once that
    // target is detached the selector stops matching and the handler never runs --
    // silently, with no error. Frappe's own handler (bound directly to the button)
    // still fires, so the panel just re-collapsed and the button looked dead: the
    // reported "the toggle button is not working".
    //
    // A listener registered ON the button is part of the event path computed at
    // dispatch time, so it fires whether or not the target is still attached. It is
    // also registered after Frappe's own (which runs at page setup), so it still
    // runs last and can normalise the inline display Frappe leaves behind.
    //
    // Both bindings seeing the same click is deduped on the NATIVE event, so the
    // state can never be toggled twice by one click.
    naidapa_theme.bind_toggle = function (selector, namespace, handler) {
        const guarded = function (e) {
            const native = (e && e.originalEvent) || e;
            if (native && native.__naidapaToggleHandled) return;
            if (native) native.__naidapaToggleHandled = true;
            return handler.call(this, e);
        };
        $(document)
            .off('click.' + namespace, selector)
            .on('click.' + namespace, selector, guarded);
        $(selector)
            .off('click.' + namespace + '_direct')
            .on('click.' + namespace + '_direct', guarded);
    };

    // Frappe's own hover tooltip, on Frappe's own button.
    //
    // `page.js setup_sidebar_toggle()` does `sidebar_toggle.attr("title", "Toggle
    // Sidebar")` and then `.tooltip({trigger: 'hover'})`, so this button pops a
    // "Toggle Sidebar" bubble on hover exactly like the theme rail's did. Removed on
    // request (2026-09-16) together with the rail's -- the accessible name is left
    // intact via aria-label, so only the visual popup goes. Frappe re-adds the title
    // whenever it sets a page up, hence this runs on every patch pass; the guard
    // keeps it from disposing the tooltip over and over.
    naidapa_theme.remove_page_toggle_tooltip = function () {
        const $btn = $('.page-head .sidebar-toggle-btn');
        if (!$btn.length) return;
        if (!$btn.attr('title') && !$btn.attr('data-original-title')) return;
        $btn.removeAttr('title').removeAttr('data-original-title');
        try {
            $btn.tooltip('dispose');   // Bootstrap 5
        } catch (e) {
            try { $btn.tooltip('destroy'); } catch (e2) { /* no tooltip library */ }
        }
    };

    // Does the panel actually have anything to SHOW?
    //
    // "Non-empty" is not the same as `.layout-side-section` containing nodes.
    // Measured across route types (same DOM, different content):
    //   form  -> `.form-sidebar`  with 13 painting elements (Assigned To, ...)
    //   list  -> `.list-sidebar`  with  5 (the filter rail)
    //   workspace -> ONLY `.desk-sidebar` (1100 nodes -- which THIS THEME hides,
    //                `body.naidapa-theme-active .desk-sidebar`) plus a 1px
    //                sr-only skip-link button. So the panel is 249px of nothing,
    //                and a toggle over it is a control that shifts the page and
    //                reveals an empty band.
    //
    // REBUILT 2026-09-16 (follow-up): the previous version measured PAINT
    // (getClientRects/getBoundingClientRect) on a walk of the whole subtree,
    // which is only correct once the browser has actually laid the frame out
    // -- and that is exactly why `sync_page_sidebar_toggle_presence()` below
    // used to need a 1.5s "stayed empty" debounce, which itself lost the race
    // against the Home workspace's slower, burstier load (onboarding steps,
    // shortcut/number cards, charts): the toggle stayed visible over a
    // genuinely empty panel.
    //
    // This version is a pure DOM-STRUCTURE test -- classList and direct
    // children only, no layout measurement -- so it is correct the instant
    // the relevant elements exist, with no frame to wait for and therefore no
    // debounce needed. It exactly mirrors the CSS collapse rule in
    // naidapa_theme.css (`@media (min-width: 992px)`, the
    // `:not(:has(...))` selector), so the button's presence and the panel's
    // width can never disagree.
    naidapa_theme.page_sidebar_has_content = function () {
        const panel = document.querySelector('.layout-main > .layout-side-section');
        if (!panel) return false;

        // Frappe's OWN verdict first. For an unsaved document
        // `form_sidebar.refresh()` adds `.hide-sidebar` to this panel AND toggles
        // the widget menu off (form_sidebar.js:70-74), so opening it would show an
        // empty 249px band -- there is genuinely nothing to toggle until the record
        // is saved (at which point Frappe removes the class and the toggle returns).
        if (panel.classList.contains('hide-sidebar')) return false;

        // A direct child is "ignorable" -- contributes nothing visible -- if it
        // is Frappe's sr-only skip-link (ui/page.js:165-181, appended straight
        // to this container), a bare `.desk-sidebar` (the workspace rail this
        // theme hides, `body.naidapa-theme-active .desk-sidebar`), or a
        // `.list-sidebar` wrapper holding nothing but one (Frappe's own
        // workspace sidebar markup, views/workspace/workspace.js:57-62 --
        // `.list-sidebar` doubles as the REAL list-view filter rail elsewhere,
        // so it is only ignorable when everything inside it is `.desk-sidebar`).
        // A real `.list-sidebar`/`.form-sidebar` can still be legitimately
        // hidden at this viewport (the list filter rail is `hidden-xs` on a
        // phone; Frappe's mobile equivalent is the toolbar's "Filter" button,
        // not this toggle), so that is checked too.
        const is_ignorable = (el) => {
            if (el.classList.contains('sr-only') || el.classList.contains('sr-only-focusable')) return true;
            if (el.classList.contains('desk-sidebar')) return true;
            if (el.classList.contains('list-sidebar') || el.classList.contains('form-sidebar')) {
                if (Array.from(el.children).every((child) => child.classList.contains('desk-sidebar'))) {
                    return true;
                }
                return getComputedStyle(el).display === 'none';
            }
            return false;
        };

        return !Array.from(panel.children).every(is_ignorable);
    };

    // Frappe's page template renders the toggle; keep a copy so it can be put
    // back if the panel only gets its content later (the form sidebar is filled
    // asynchronously by form_sidebar.refresh(), after the view's make()).
    let page_toggle_html = null;

    // Keep the control and the panel in step with each other:
    //   no content in the panel -> no toggle (Frappe itself removes it when a page
    //   sets disable_sidebar_toggle), and the panel stays collapsed
    //   (body.naidapa-page-sidebar-empty, backstopped by a same-frame CSS rule
    //   that needs no class at all -- see naidapa_theme.css) so nothing shifts
    //   and no empty band appears even if the stored preference is "open".
    //
    // NO DEBOUNCE, on purpose (removed 2026-09-16 follow-up): the old version
    // waited 1.5s for the panel to "stay empty" before acting, because its
    // content test measured PAINT and could be transiently wrong before the
    // browser laid a fresh frame out. `page_sidebar_has_content()` is now a
    // pure DOM-structure test with no such window, so this can act on every
    // pass immediately -- and does, since the MutationObserver that drives
    // `run_patches()` re-fires this the moment real content (e.g. the form
    // sidebar, filled in asynchronously after the view's make()) actually
    // lands, restoring the button from the cached `page_toggle_html` and
    // re-binding it via `bind_page_sidebar_toggle()` (next step in
    // `run_patches()`), the same way a freshly re-inserted button always was.
    naidapa_theme.sync_page_sidebar_toggle_presence = function () {
        const panel = document.querySelector('.layout-main > .layout-side-section');
        if (!panel) return;

        const has_content = naidapa_theme.page_sidebar_has_content();
        const $head = $('.page-head').first();
        const $btn = $head.find('.sidebar-toggle-btn');
        if ($btn.length && !page_toggle_html) page_toggle_html = $btn[0].outerHTML;

        if (has_content) {
            $('body').removeClass('naidapa-page-sidebar-empty');
            if (!$btn.length && page_toggle_html) {
                $head.find('.page-title > .title-area').first().before(page_toggle_html);
            }
        } else {
            $('body').addClass('naidapa-page-sidebar-empty');
            $btn.remove();
        }

        naidapa_theme.sync_page_sidebar_toggle_icon();
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
            // The page toggle's icon lives in Frappe's fetched icon sprite, which
            // arrives after this script -- so re-assert on every pass (idempotent,
            // and a no-op once the symbols are ours).
            naidapa_theme.apply_panel_toggle_icon,
            // The page-level toggle is re-rendered with every page, and Frappe
            // rewrites its icon on its own clicks, so re-derive the state on every
            // pass (idempotent). With the sprite symbols redefined both branches
            // draw the same panel glyph, so this is now the FALLBACK that keeps
            // Frappe's state-correct chevrons if the sprite ever is not ours.
            naidapa_theme.sync_page_sidebar_toggle_presence,
            // Re-assert the page toggle's bindings every pass: the button is
            // removed and re-created from stored HTML when the panel goes empty and
            // comes back, and a re-created node carries neither Frappe's bindings
            // nor ours (idempotent -- bind_toggle off()s first).
            naidapa_theme.bind_page_sidebar_toggle,
            naidapa_theme.remove_page_toggle_tooltip,
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
            //
            // NO `title` attribute, on purpose: the button carries no hover
            // styling at all (measured -- transparent background, no border, no
            // shadow, no transform, no pseudo-element content), so the ONLY thing
            // hovering it did was pop the native "Toggle Sidebar" tooltip over the
            // logo/breadcrumb area. Removed on request (2026-09-16). The
            // accessible name is kept via `aria-label`, so screen readers still
            // announce it -- only the visual popup is gone. `cursor: pointer`
            // stays: that is an affordance, not a popup.
            const toggle_html = `<span class="header-toggle" role="button" tabindex="0" aria-label="${__('Toggle Sidebar')}"><iconify-icon icon="line-md:menu-fold-right"></iconify-icon></span>`;
            $('.navbar-brand').before(toggle_html);
        }

        // Bound ONCE, DELEGATED + DIRECT, and re-asserted on every pass (see
        // `bind_toggle` for why the direct one is required: Frappe re-renders
        // button internals during a click, which detaches the clicked node and
        // silently defeats a delegated-only selector).
        naidapa_theme.bind_toggle('.header-toggle', 'naidapa_rail_toggle', function () {
            // Clicking TOGGLES: if the rail is presently compacted the click
            // expands it. BOTH collapsed markers are checked, not just the
            // body class: `apply_sidebar_state()` writes both, and the inline
            // script in www/app.html writes both before boot, so reading
            // either one alone is a needless single point of failure.
            const currently_collapsed =
                $('body').hasClass('sidebar-menu-opened') ||
                $('nav.vertical-sidebar').hasClass('semi-nav');
            naidapa_theme.set_sidebar_open(currently_collapsed);
        });

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

        // The icon sprite is FETCHED into `#all-symbols` by www/app.html after
        // this script runs. The body observer above would only reach
        // run_patches() on the next animation frame, which is long enough for the
        // browser to paint the freshly inserted sprite once -- i.e. one frame of
        // Frappe's chevron before our glyph replaced it, right at page load. A
        // MutationObserver callback is delivered at the microtask checkpoint of
        // the inserting task, BEFORE the next paint, so listening to the sprite
        // host directly is what makes the swap invisible rather than nearly
        // invisible. run_patches() keeps it as a safety net.
        const sprite_host = document.getElementById('all-symbols');
        if (sprite_host && window.MutationObserver) {
            new MutationObserver(() => naidapa_theme.apply_panel_toggle_icon())
                .observe(sprite_host, { childList: true });
        }
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