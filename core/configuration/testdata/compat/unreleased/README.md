# Unreleased configuration fixture

Reactions use the full Unicode emoji picker. Configuration files must omit the retired `MEMO_RELATED` setting and
`memoRelatedSetting` value, including references in `lifecycle` or `removed`. After those entries are removed, the next
apply releases the old ownership record automatically. Existing memo reactions are preserved.
