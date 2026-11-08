-- Every email address is stored trimmed and in lower case, the form normalizeEmail() in
-- src/lib/auth/email.ts gives it, so register and sign-in treat "Lucas@Example.com" and
-- " lucas@example.com " as one account. Written by hand: Prisma can't express it. Postgres runs
-- this file as one implicit transaction, so it either applies whole or not at all.
--
-- When two users would end up with the same address, the migration refuses to run and names them
-- by id, never by address: the message lands in the deploy log. Deciding which account survives
-- (and what happens to the other one's Workouts) is for a person.
--
-- The two functions are the ones of the movements_owned_by_user migration, which explains them:
-- the whitespace class is exactly what JavaScript's trim() strips, and ICU lower-cases the way
-- JavaScript's toLowerCase() does. src/lib/auth/email.test.ts runs them from this file against
-- the code.

CREATE FUNCTION pg_temp.trim_whitespace(value TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(value, '^[ \t\n\v\f\r\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[ \t\n\v\f\r\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$', '', 'g')
$$;

CREATE FUNCTION pg_temp.normalize_email(value TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(pg_temp.trim_whitespace(value) COLLATE "und-x-icu")
$$;

DO $$
DECLARE
  account_count INT;
  groups TEXT;
  ids TEXT;
BEGIN
  SELECT sum(cardinality(group_ids)),
         string_agg(format('(%s)', array_to_string(group_ids, ', ')), ', ' ORDER BY group_ids[1]),
         string_agg(array_to_string(ARRAY(SELECT quote_literal(id) FROM unnest(group_ids) AS id), ', '), ', '
                    ORDER BY group_ids[1])
  INTO account_count, groups, ids
  FROM (
    SELECT array_agg(id ORDER BY id) AS group_ids
    FROM "User"
    GROUP BY pg_temp.normalize_email(email)
    HAVING count(*) > 1
  ) AS colliding;

  IF account_count IS NOT NULL THEN
    RAISE EXCEPTION '% accounts share an email address once case and surrounding whitespace are ignored. User ids, one group per address: %',
      account_count, groups
      USING HINT = format('See them with SELECT id, email FROM "User" WHERE id IN (%s); merge or rename them by hand, then deploy again.', ids);
  END IF;
END
$$;

UPDATE "User" SET email = pg_temp.normalize_email(email) WHERE email <> pg_temp.normalize_email(email);

DROP FUNCTION pg_temp.normalize_email, pg_temp.trim_whitespace;
