#!/bin/bash

npx esbuild ./src/ui/index.ts ./src/ui/board_id_worker_entry.ts --bundle --splitting --minify --format=esm --outdir=docs
cp ./ui/icon.svg docs/
cp ./ui/favicon.ico docs/
npx css-minify -f ./ui/minestyle.css -o docs/
mv docs/minestyle.min.css docs/minestyle.css
npx html-minifier-terser --collapse-whitespace --remove-comments --minify-js true ./ui/minesweeper.html -o ./docs/index.html
sed -i -e 's|\.\./lib/ui/|./|g' ./docs/index.html
sed -i -e 's|\.\./lib/ui/|./|g' ./docs/index.js
