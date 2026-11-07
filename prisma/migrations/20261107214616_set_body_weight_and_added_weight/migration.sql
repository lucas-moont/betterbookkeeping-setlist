-- AlterTable
ALTER TABLE "Set" ADD COLUMN     "addedWeight" DECIMAL(6,2),
ADD COLUMN     "addedWeightNote" VARCHAR(60),
ADD COLUMN     "isBodyWeight" BOOLEAN NOT NULL DEFAULT false;

-- Hand-written: Prisma can't express CHECK constraints, so they only exist here (ADR 0003). The
-- workouts module refuses all three cases with an error code first; these keep any other writer
-- from storing a Set whose Load can't be trusted.

-- Added Weight always comes with the note saying how it was added, and a note never comes alone.
ALTER TABLE "Set" ADD CONSTRAINT "Set_addedWeight_with_note"
  CHECK (("addedWeight" IS NULL) = ("addedWeightNote" IS NULL));

-- Assistance can't be more than the weight, so Load (weight + addedWeight) is never negative.
ALTER TABLE "Set" ADD CONSTRAINT "Set_load_not_negative"
  CHECK ("addedWeight" IS NULL OR "addedWeight" >= -"weight");

-- Only a Set logged as body-weight carries Added Weight; any other Set's weight is what's on the bar.
ALTER TABLE "Set" ADD CONSTRAINT "Set_addedWeight_only_on_body_weight"
  CHECK ("addedWeight" IS NULL OR "isBodyWeight");
