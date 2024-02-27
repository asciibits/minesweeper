#!/bin/bash

npx esbuild ./src/ui/index.ts ./src/ui/sidebar.ts ./src/ui/board_id_worker_entry.ts --bundle --minify --outdir=dist
cp ./ui/icon.svg dist/
npx css-minify -f ./ui/minestyle.css -o dist/
mv dist/minestyle.min.css dist/minestyle.css
npx html-minifier-terser --collapse-whitespace --remove-comments --minify-js true ./ui/minesweeper.html -o ./dist/minesweeper.html
sed -i -e 's|\.\./lib/ui/|./|g' ./dist/minesweeper.html


sed -i -e "s/['\"]<<BOARD_ID_WORKER_ENTRY>>[\'\"]/\n<<BOARD_ID_WORKER_ENTRY>>\n/" ./dist/index.js

TMPFILE="$(mktemp)"
cat ./dist/index.js | (
  while IFS= read -r line; do
  if [[ "${#line}" -lt 100 && "${line}" == "<<BOARD_ID_WORKER_ENTRY>>" ]]; then
    echo -n "'$(
      sed -e s/"'"/'\\'"'"/g -e 's/\\/\\\\/g' ./dist/board_id_worker_entry.js |
      sed -e ':q;N;s/\n/\\n/g;t q;')'"
  else
    echo "${line}"
  fi
done) > "$TMPFILE"
mv "$TMPFILE" ./dist/index.js
