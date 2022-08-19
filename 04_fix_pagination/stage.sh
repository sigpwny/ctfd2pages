for FILE in teams\?page=* users\?page=*; do
  git mv "$FILE" "${FILE/\?page=/_page_}.html"
done

sed -i 's/\?page=/_page_/g' teams*.html users*.html
