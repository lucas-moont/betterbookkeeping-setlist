-- Postgres doesn't index foreign keys on its own. Every Current Workout and history read filters
-- Sets by workoutId, and the Progression Charts will filter them by movementId.

-- CreateIndex
CREATE INDEX "Set_workoutId_idx" ON "Set"("workoutId");

-- CreateIndex
CREATE INDEX "Set_movementId_idx" ON "Set"("movementId");
