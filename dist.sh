#!/bin/bash

npx esbuild ./src/ui/index.ts ./src/ui/sidebar.ts ./src/ui/board_id_worker_entry.ts --bundle --minify --outdir=docs
cp ./ui/icon.svg docs/
cp ./ui/favicon.ico docs/
npx css-minify -f ./ui/minestyle.css -o docs/
mv docs/minestyle.min.css docs/minestyle.css
npx html-minifier-terser --collapse-whitespace --remove-comments --minify-js true ./ui/minesweeper.html -o ./docs/index.html
sed -i -e 's|\.\./lib/ui/|./|g' ./docs/index.html


sed -i -e "s/['\"]<<BOARD_ID_WORKER_ENTRY>>[\'\"]/\n<<BOARD_ID_WORKER_ENTRY>>\n/" ./docs/index.js

TMPFILE="$(mktemp)"
cat ./docs/index.js | (
  while IFS= read -r line; do
  if [[ "${#line}" -lt 100 && "${line}" == "<<BOARD_ID_WORKER_ENTRY>>" ]]; then
    echo -n "'$(
      sed -e s/"'"/'\\'"'"/g -e 's/\\/\\\\/g' ./docs/board_id_worker_entry.js |
      sed -e ':q;N;s/\n/\\n/g;t q;')'"
  else
    echo "${line}"
  fi
done) > "$TMPFILE"
mv "$TMPFILE" ./docs/index.js
