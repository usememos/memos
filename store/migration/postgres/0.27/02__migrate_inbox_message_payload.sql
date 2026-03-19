UPDATE inbox AS i
SET message = jsonb_set(
  i.message::jsonb - 'activityId',
  '{memoComment}',
  jsonb_build_object(
    'memoId',
    a.payload->'memoComment'->'memoId',
    'relatedMemoId',
    a.payload->'memoComment'->'relatedMemoId'
  )
)::text
FROM activity AS a
WHERE (i.message::jsonb->>'activityId')::integer = a.id;
