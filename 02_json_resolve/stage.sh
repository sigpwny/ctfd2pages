for FILE in $(find api -name '*.json'); do
  TARGET="${FILE%.json}"
  if [[ -d "$TARGET" ]]; then
    git mv "$FILE" "$TARGET"/index.json
  else
    git mv "$FILE" "$TARGET"
  fi
done
