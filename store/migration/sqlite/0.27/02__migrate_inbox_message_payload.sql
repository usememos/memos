UPDATE inbox
SET message = json_set(
  json_remove(message, '$.activityId'),
  '$.memoComment',
  json_object(
    'memoId',
    (
      SELECT json_extract(activity.payload, '$.memoComment.memoId')
      FROM activity
      WHERE activity.id = json_extract(inbox.message, '$.activityId')
    ),
    'relatedMemoId',
    (
      SELECT json_extract(activity.payload, '$.memoComment.relatedMemoId')
      FROM activity
      WHERE activity.id = json_extract(inbox.message, '$.activityId')
    )
  )
)
WHERE json_extract(message, '$.activityId') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM activity
    WHERE activity.id = json_extract(inbox.message, '$.activityId')
  );
