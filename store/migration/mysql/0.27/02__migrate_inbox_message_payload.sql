UPDATE `inbox` AS i
JOIN `activity` AS a
  ON a.`id` = CAST(JSON_UNQUOTE(JSON_EXTRACT(i.`message`, '$.activityId')) AS UNSIGNED)
SET i.`message` = JSON_SET(
  JSON_REMOVE(i.`message`, '$.activityId'),
  '$.memoComment',
  JSON_OBJECT(
    'memoId',
    JSON_EXTRACT(a.`payload`, '$.memoComment.memoId'),
    'relatedMemoId',
    JSON_EXTRACT(a.`payload`, '$.memoComment.relatedMemoId')
  )
)
WHERE JSON_EXTRACT(i.`message`, '$.activityId') IS NOT NULL;
