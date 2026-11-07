# Bandhan Travels

A minimal, static landing page for Bandhan Travels — featuring two homestays.

## Run

It's plain HTML/CSS — just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Structure

- `index.html` — markup (navbar, hero, two resort sections, contact, footer)
- `styles.css` — all styling
- `images/` — placeholder artwork

## Customize

Replace these placeholders with real details:

- **Photos** — drop real images into `images/` and update the `<img src>` in `index.html`
  (currently `homestay-1.svg` / `homestay-2.svg`).
- **Homestay info** — names, locations, and addresses in the `.resort` sections.
- **Maps** — each `<iframe>` `src` uses `https://maps.google.com/maps?q=<place>&output=embed`.
  Change `q=` to the exact location, or paste an embed link from Google Maps → Share → Embed a map.
- **Contact** — phone, email, and the WhatsApp number in `index.html`.
  WhatsApp uses `https://wa.me/<countrycode><number>` (digits only, e.g. `919800000000`).
