<div align="center">
  <h1>✨ ERPNext Desk & Portal Naidapa Theme (v15)</h1>
  <p><i>A beautifully crafted, modern glassmorphic theme for Frappe and ERPNext</i></p>
</div>

## Infinity ERP project setup (this fork)

This fork customizes the upstream theme for the Infinity ERP project: fixed
a logout-crashing boot bug, sidebar route-matching bugs, and button-color
CSS bugs; wired Theme Settings' color pickers to actually work; and ships
the project's sidebar menu (Masters/Sales/Purchases/Inventory/Finance/HR/
Projects/Reports/Administration), brand colors, and logo as **fixtures** so
a fresh install reproduces them automatically — see `git log` for the
individual fixes.

To reproduce this exact setup on a new bench (frappe `version-15` +
erpnext `version-15`, matching the site this was built against):

```bash
cd frappe-bench
bench get-app hrms --branch version-15
bench get-app https://github.com/PrashanthSubramani99/naidapa_theme
bench --site <sitename> install-app hrms
bench --site <sitename> install-app naidapa_theme
bench --site <sitename> migrate   # loads the fixtures: sidebar, colors, logo
bench build --app naidapa_theme
bench restart   # or bench start
```

No manual re-upload of logos or re-creation of the sidebar menu is needed —
`bench migrate` restores all of it from `naidapa_theme/fixtures/`.

<hr />

## 📖 Overview

**Naidapa Theme** is a cutting-edge aesthetic overhaul for your Frappe / ERPNext workspace. It radically modernizes your desk experience by replacing the default layout with fresh, deeply considered modern designs. It features glassmorphism, dynamic micro-animations, a modernized responsive sidebar navigation, and soft pastel interactive widgets that bring your screen to life.

**Desk**
<img width="1910" height="900" alt="Desk" src="https://github.com/user-attachments/assets/811c0a91-58c9-4b5b-a8f8-5575e554fff3" />
<br>
**Customer Portal**
<img width="1903" height="900" alt="Portal" src="https://github.com/user-attachments/assets/a82ef505-4ec5-40eb-911d-c4fa8bcf36ce" />
<br>
**Login**
<img width="1894" height="874" alt="Login" src="https://github.com/user-attachments/assets/9e3363a4-3947-40bd-a5a6-7ccfa2fa584b" />


## 🚀 Features

- **Modern Layouts & Glassmorphism:** Clean, soft translucency combined with beautifully tuned drop shadows.
- **Dynamic Workspaces:** Fully responsive sidebar utilizing customizable animated `iconify` icons.
- **Micro-Interactions:** Subtle hover states, uniquely colored expanding geometric orbs, and playful widget cards.
- **Custom Color Palette:** Curated earthy, warm, and bright pastel tones inspired by premium modern web design aesthetics.

## 🛠️ Installation

You can easily install this app using the standard [bench](https://github.com/frappe/bench) CLI:

```bash
cd frappe-bench
bench get-app https://github.com/iammusabutt/naidapa_theme.git
bench install-app naidapa_theme
```

## 🤝 Support & Author

Developed and proudly maintained by **Dr. Codex**. We are passionate about creating premium architectural solutions and state-of-the-art UI/UX improvements for the Frappe ecosystem.

- 🌐 **Website:** [www.drcodex.com](https://www.drcodex.com)
- ✉️ **Email:** [hello@drcodex.com](mailto:hello@drcodex.com)

If you have any questions, need extensive customizations, or just want to chat about ERPNext capabilities, feel free to reach out to us!

## 🧑‍💻 Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/naidapa_theme
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:
- `ruff`
- `eslint`
- `prettier`
- `pyupgrade`

## 📄 License

This software is released under the **MIT** License.
