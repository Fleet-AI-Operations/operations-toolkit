SELECT *
FROM (
    SELECT DISTINCT ON ("createdByEmail") *
    FROM data_records
    WHERE category = 'TOP_10'
      AND "createdAt" >= DATE '2026-03-03'
      AND "createdAt" <  DATE '2026-03-04'
    ORDER BY "createdByEmail", "createdAt" DESC
) t
ORDER BY "createdAt" DESC